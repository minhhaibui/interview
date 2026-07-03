# Upgrade 5 — Lên "AWS": SQS thay Kafka + S3 presigned URL cho invoice (sau tuần 9)

Hai bài toán rất hay gặp khi PV hỏi "đưa hệ của em lên AWS thì đổi gì?":

1. **Kafka → SQS**: team nhỏ không muốn vận hành broker (patch, rebalance, scale partition). SQS là queue managed — trả tiền theo request, không có gì để vá. Đổi lấy gì? Mất replay (message đọc xong là mất, Kafka giữ theo retention), mất fan-out tự nhiên (1 queue = 1 nhóm consumer; muốn nhiều nhóm phải thêm SNS trước SQS), FIFO throughput trần 300 msg/s/MessageGroupId. Nói được trade-off này là ăn điểm câu "SQS vs Kafka".
2. **Invoice qua S3 presigned URL**: file KHÔNG đi qua Node server (không nghẽn event loop, không tốn băng thông server) — server chỉ ký một URL có hạn dùng, client tự tải thẳng từ S3.

Thực hành **miễn phí 100% bằng LocalStack** — giả lập AWS chạy local, SDK trỏ endpoint `localhost:4566` là xong, code giữ nguyên khi lên AWS thật.

## 0. Chuẩn bị

```bash
# LocalStack — PHẢI pin tag 4.5: tag `latest` (2026.x) đòi license token mới chạy
# S3_SKIP_SIGNATURE_VALIDATION=0 để presigned URL hết hạn bị từ chối thật (mặc định LocalStack bỏ qua chữ ký!)
docker run -d --name prep-localstack -p 4566:4566 \
  -e S3_SKIP_SIGNATURE_VALIDATION=0 localstack/localstack:4.5

cd capstone-project && npm install @aws-sdk/client-sqs @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

## 1. Tạo queue FIFO + DLQ (awslocal có sẵn trong container)

```bash
docker exec prep-localstack awslocal sqs create-queue \
  --queue-name orders-dlq.fifo --attributes FifoQueue=true

docker exec prep-localstack awslocal sqs create-queue --queue-name orders.fifo \
  --attributes '{"FifoQueue":"true","VisibilityTimeout":"10","RedrivePolicy":"{\"deadLetterTargetArn\":\"arn:aws:sqs:us-east-1:000000000000:orders-dlq.fifo\",\"maxReceiveCount\":\"3\"}"}'
```

- **FIFO** (`.fifo`): giữ thứ tự trong cùng `MessageGroupId` — vai trò y hệt partition key bên Kafka.
- **RedrivePolicy**: message bị nhận quá `maxReceiveCount` lần mà không delete → tự văng sang DLQ. Kafka KHÔNG có sẵn cái này, phải tự viết — điểm cộng của SQS.
- **VisibilityTimeout=10**: nhận xong message bị "ẩn" 10 giây; không delete kịp → hiện lại cho consumer khác. Đây là cơ chế at-least-once của SQS.

## 2. Relay: đổi `producer.send` thành SQS — `src/sqs-relay.js`

Copy `outbox-relay.js`, phần poll outbox + `SKIP LOCKED` giữ NGUYÊN (pattern không đổi, chỉ đổi transport), thay Kafka producer bằng:

```js
const { SQSClient, SendMessageBatchCommand } = require('@aws-sdk/client-sqs');

const sqs = new SQSClient({
  region: 'us-east-1',
  endpoint: 'http://localhost:4566',            // lên AWS thật: xóa dòng này
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' }, // thật: dùng IAM role, KHÔNG hardcode
});
const QUEUE_URL = 'http://localhost:4566/000000000000/orders.fifo';

// trong relayBatch(), thay producer.send bằng:
await sqs.send(new SendMessageBatchCommand({
  QueueUrl: QUEUE_URL,
  Entries: rows.map(r => ({
    Id: String(r.id),
    MessageBody: JSON.stringify(r.payload),
    MessageGroupId: r.key,                // = orderId → giữ thứ tự per-order, như key Kafka
    MessageDeduplicationId: String(r.id), // = outbox id → SQS TỰ nuốt bản trùng trong 5 phút
  })),
}));
```

Chi tiết đắt giá: relay crash sau send trước `UPDATE published_at` → lần sau gửi LẠI, nhưng `MessageDeduplicationId` là outbox id nên SQS **tự dedup trong cửa sổ 5 phút** — consumer đỡ nhận trùng mà không cần code gì. (Vẫn phải idempotent: quá 5 phút hoặc queue standard thì dedup không cứu.)

## 3. Consumer: long polling — `src/consumers/sqs-notification-consumer.js`

```js
const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');

const sqs = new SQSClient({
  region: 'us-east-1',
  endpoint: 'http://localhost:4566',
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
});
const QUEUE_URL = 'http://localhost:4566/000000000000/orders.fifo';

(async () => {
  console.log('SQS consumer chạy — long polling 20s');
  while (true) {
    const { Messages = [] } = await sqs.send(new ReceiveMessageCommand({
      QueueUrl: QUEUE_URL,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 20, // LONG POLLING: giữ kết nối chờ 20s, không có message mới trả rỗng
    }));
    for (const m of Messages) {
      const event = JSON.parse(m.Body);
      console.log(`📧 Gửi email xác nhận order ${event.orderId} (${event.total}đ)`);
      // Delete = "ack". Xử lý fail → KHÔNG delete → hiện lại sau visibility timeout → quá 3 lần → DLQ
      await sqs.send(new DeleteMessageCommand({ QueueUrl: QUEUE_URL, ReceiptHandle: m.ReceiptHandle }));
    }
  }
})();
```

Vì sao long polling (PV hay hỏi): short polling (WaitTimeSeconds=0) trả về ngay kể cả khi rỗng → poll liên tục = tốn request = tốn tiền (SQS tính tiền theo request). 20 giây là max và gần như luôn là lựa chọn đúng.

## 4. Invoice qua S3 presigned URL — thêm route vào `server.js`

```js
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3 = new S3Client({
  region: 'us-east-1',
  endpoint: 'http://localhost:4566',
  forcePathStyle: true, // LocalStack cần path-style (bucket trên path thay vì subdomain)
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
});
const BUCKET = 'prep-invoices';

// Khi order được tạo (hoặc trong consumer): sinh invoice lên S3
await s3.send(new PutObjectCommand({
  Bucket: BUCKET, Key: `invoices/${order.id}.txt`,
  Body: `HOA DON ${order.id} — ${order.total}đ`,
  ContentType: 'text/plain; charset=utf-8',
}));

// GET /orders/:id/invoice-url → trả URL ký sẵn, client tự tải thẳng từ S3
router.get('/orders/:id/invoice-url', async (req, res) => {
  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: `invoices/${req.params.id}.txt` }),
    { expiresIn: 300 }, // 5 phút — URL là "chìa khóa tạm", lộ ra cũng tự chết
  );
  res.json({ url });
});
```

Tạo bucket một lần: `docker exec prep-localstack awslocal s3 mb s3://prep-invoices`

## 5. Thí nghiệm đáng làm (mỗi cái 5 phút)

```bash
# 1. Poison message → DLQ: trong consumer, throw với 1 orderId cụ thể (không delete)
#    → chứng kiến message hiện lại sau mỗi 10s, đúng 3 lần rồi biến mất → check DLQ:
docker exec prep-localstack awslocal sqs receive-message \
  --queue-url http://localhost:4566/000000000000/orders-dlq.fifo

# 2. Dedup: chạy relay 2 lần liên tiếp với cùng outbox rows (giả lập crash trước UPDATE)
#    → consumer chỉ nhận MỖI event 1 lần (đã test thật: gửi 2×3 message, nhận đúng 3)

# 3. Presigned hết hạn: đổi expiresIn thành 5, lấy URL, curl ngay (200) → đợi 7s → curl lại (403)

# 4. Ordering: 2 event cùng orderId (OrderCreated → OrderPaid) luôn về đúng thứ tự;
#    khác orderId thì không đảm bảo — y hệt Kafka partition theo key
```

## 6. Checklist nghiệm thu

- [ ] Cả dây chuyền chạy: POST /orders → outbox → sqs-relay → consumer in "📧" trong ≤2 giây
- [ ] Kill consumer giữa chừng (sau receive, trước delete) → message hiện lại sau visibility timeout, không mất
- [ ] Message hỏng fail 3 lần → nằm trong DLQ, queue chính sạch (consumer không kẹt retry mãi)
- [ ] Gửi trùng MessageDeduplicationId trong 5 phút → consumer chỉ nhận 1 bản
- [ ] `GET /orders/:id/invoice-url` trả URL tải được bằng curl KHÔNG kèm credentials; hết hạn → 403
- [ ] Trả lời được: dòng nào trong code phải đổi khi lên AWS thật? (endpoint + credentials → IAM role, còn lại giữ nguyên)

## 7. Câu hỏi tự kiểm tra (trả lời to thành tiếng)

1. SQS vs Kafka: kể 3 thứ mất đi và 2 thứ được thêm khi chuyển. Khi nào quay lại Kafka?
2. Visibility timeout để làm gì? Đặt quá ngắn thì bị gì? Quá dài thì bị gì?
3. Vì sao presigned URL tốt hơn cho file qua Node server? Còn presigned PUT (upload) dùng khi nào?
4. `MessageDeduplicationId` có thay được idempotency ở consumer không? Vì sao không?
5. Trên AWS thật, credentials lấy từ đâu khi chạy trên ECS/EC2? Vì sao không dùng access key trong env?

> Hết chuỗi Upgrade 1→5 — capstone đã đi đủ Postgres, Redis, Kafka, Docker/K8s, AWS. Tuần 10-12: system design + mock interview, quay lại tab 🏛️ Thiết kế HT và 🎤 Mock trong study-web.
