# Tuần 9 — Thiết kế hệ thống & Case thực tế: AWS

> Tài liệu bổ trợ cho README.md cùng thư mục. Học sau khi xong phần lý thuyết.

## 🏗️ Mini System Design (scoped vào chủ đề tuần)

### Bài 1: Kiến trúc AWS cho e-commerce Node.js mức 100K user

**Đề bài:** Hệ thống e-commerce: 100K registered users, ~10K DAU, peak ~500 RPS (đợt sale ~2.000 RPS), read/write ratio ~85/15, catalog ~50K sản phẩm, ảnh sản phẩm ~200GB. Team 6 backend engineers, chưa có DevOps chuyên trách. Yêu cầu: thiết kế VPC, lựa chọn compute (ECS Fargate vs EKS — biện luận), tầng data (RDS Multi-AZ + read replica, ElastiCache), static content (S3 + CloudFront), và **ước tính chi phí tháng**.

**Phân tích & lời giải:**

**Bước 1 — Sơ đồ tổng thể:**

```
                        Route 53
                           │
              ┌────────────▼─────────────┐
              │ CloudFront (CDN)         │──► S3 (ảnh sản phẩm, static)
              └────────────┬─────────────┘
                    /api/* │
┌──────────────────────────▼──────────────────── VPC 10.0.0.0/16 ──┐
│            AZ-a                          AZ-b                     │
│  ┌─────────────────────┐    ┌─────────────────────┐               │
│  │ public 10.0.0.0/24  │    │ public 10.0.1.0/24  │               │
│  │   ALB ─────────────────────── ALB (node 2)     │               │
│  │   NAT GW            │    │  (NAT GW khi cần HA)│               │
│  └──────────┬──────────┘    └─────────────────────┘               │
│  ┌──────────▼──────────┐    ┌─────────────────────┐               │
│  │ private-app .10.0/24│    │ private-app .11.0/24│               │
│  │  ECS Fargate tasks  │    │  ECS Fargate tasks  │               │
│  │  api x2-8, worker x2│    │  api x2-8           │               │
│  └──────────┬──────────┘    └──────────┬──────────┘               │
│  ┌──────────▼──────────┐    ┌──────────▼──────────┐               │
│  │ private-db .20.0/24 │    │ private-db .21.0/24 │               │
│  │  RDS primary        │───►│  RDS standby (Multi-AZ)             │
│  │  Read replica       │    │  ElastiCache Redis  │               │
│  └─────────────────────┘    └─────────────────────┘               │
│  VPC Endpoints: S3 (gateway), ECR, CloudWatch (interface)         │
└───────────────────────────────────────────────────────────────────┘
```

**Bước 2 — VPC layout.** 3 tầng subnet × 2 AZ (3 AZ nếu ngân sách cho phép):
- **Public subnets**: chỉ ALB + NAT Gateway. Không bao giờ đặt app/DB ở đây.
- **Private-app subnets**: ECS tasks. Ra Internet (gọi Stripe, SendGrid) qua NAT GW; vào từ ALB qua security group.
- **Private-db subnets**: RDS + ElastiCache, không có route ra Internet, security group chỉ nhận từ SG của app (reference SG theo ID, không theo CIDR).
- **VPC Endpoints**: S3 gateway endpoint (miễn phí!) + interface endpoints cho ECR/CloudWatch — traffic tới AWS services không đi qua NAT GW (xem Case 1 vì sao điều này quan trọng với hóa đơn).
- Security group là stateful firewall theo tầng: ALB-SG (443 từ 0.0.0.0/0 — hoặc chỉ từ CloudFront prefix list) → App-SG (3000 từ ALB-SG) → DB-SG (5432 từ App-SG).

**Bước 3 — ECS Fargate vs EKS (câu biện luận trọng tâm):**

| Tiêu chí | ECS Fargate | EKS |
|---|---|---|
| Vận hành | Không quản node, không control plane để vá; service + task definition là hết | Phải quản version K8s, addons, node groups (hoặc Fargate profile), upgrade mỗi ~4 tháng |
| Đường cong học | Vài ngày cho team biết Docker | Cần kỹ năng K8s thực thụ; team 6 người không DevOps sẽ trả giá |
| Hệ sinh thái | Đủ dùng: autoscaling, blue/green qua CodeDeploy, service discovery | Vô địch: Helm, operators, Argo, KEDA... |
| Chi phí cố định | $0 control plane | ~$73/tháng/cluster + chi phí nhân lực (đắt nhất) |
| Khóa chân (lock-in) | API riêng AWS | Portable trên giấy tờ; thực tế vẫn dính ALB controller, IAM, EBS CSI |

**Chọn ECS Fargate.** Lý do quyết định không phải tiền mà là **nhân lực**: 6 backend engineers không DevOps — chi phí lớn nhất của EKS là người vận hành nó. Quy mô 4-5 services, 500 RPS chưa chạm bất kỳ giới hạn nào của ECS. Nói thêm với interviewer điều kiện đổi chiều: nhiều team + cần hệ sinh thái K8s (operators, service mesh, multi-cluster) + có platform team → EKS.

**Bước 4 — Tầng data:**
- **RDS Postgres `db.r6g.large` Multi-AZ**: standby đồng bộ ở AZ khác, failover tự động ~1-2 phút. Multi-AZ là cho **availability**, không tăng read throughput (standby không nhận query).
- **1 read replica** (async): nhận query đọc nặng — catalog browsing, search, báo cáo. App tách 2 pool: write→primary, read-tolerant-staleness→replica. Lưu ý replication lag: đọc "your own writes" (vd ngay sau đặt hàng) phải vào primary.
- **ElastiCache Redis `cache.r6g.large` (1 primary + 1 replica, Multi-AZ)**: cache catalog/session/cart. Với 85% read, cache-aside + TTL giảm phần lớn tải đọc xuống DB — đây là đòn bẩy hiệu năng lớn nhất của hệ này.
- **S3 + CloudFront**: ảnh sản phẩm serve qua CDN, origin access control để bucket không public; API cũng có thể đứng sau CloudFront để tận dụng TLS edge + WAF.

**Bước 5 — Ước tính chi phí tháng (us-east-1, số tròn để biện luận):**

| Hạng mục | Cấu hình | ~$/tháng |
|---|---|---|
| ECS Fargate | api: 4 task × (1 vCPU, 2GB) avg + worker 2 task × (0.5, 1GB) | ~$190 |
| ALB | 1 ALB + LCU | ~$30 |
| RDS Postgres | db.r6g.large Multi-AZ + 200GB gp3 | ~$480 |
| Read replica | db.r6g.large Single-AZ | ~$240 |
| ElastiCache | 2 × cache.r6g.large | ~$300 |
| NAT Gateway | 1 cái + ~200GB processed | ~$42 |
| S3 | 200GB + requests | ~$10 |
| CloudFront | ~1TB out | ~$85 |
| CloudWatch, ECR, Route53, linh tinh | | ~$50 |
| **Tổng** | | **~$1.400-1.500/tháng** |

Đòn giảm chi phí nêu kèm: Savings Plans/RI cho RDS + Fargate (giảm 25-40% phần baseline), Graviton (đã chọn r6g), scale-to-min ban đêm cho non-prod, cân nhắc bỏ read replica giai đoạn đầu (cache gánh trước) tiết kiệm $240.

**Trade-offs:**
- Multi-AZ RDS gấp đôi tiền DB so với Single-AZ — với e-commerce có doanh thu, 1-2 phút failover tự động đáng giá; non-prod thì Single-AZ.
- 1 NAT GW (1 AZ) rẻ hơn 2 nhưng AZ đó chết là private subnet AZ kia mất đường ra Internet — chấp nhận được giai đoạn đầu, ghi rõ vào risk register, lên 2 khi nghiêm túc về HA.
- Fargate đắt hơn ~20-30% so với ECS trên EC2 tự quản ở mức sử dụng đều — đổi lấy zero quản node; khi bill compute lớn mới đáng tối ưu ngược.

**Follow-up interviewer hay hỏi:**
1. *"Traffic gấp 10 thì kiến trúc này vỡ ở đâu trước?"* — Gợi ý: DB write path (primary) vỡ trước — connection storm + write IOPS; thuốc theo thứ tự: RDS Proxy/PgBouncer, cache mạnh hơn, tách service ghi nặng + queue, cuối cùng mới sharding/Aurora.
2. *"Vì sao không serverless hết bằng Lambda + API Gateway?"* — Gợi ý: hợp lệ ở traffic thấp/spiky; với 500 RPS đều đặn, Fargate rẻ hơn và tránh cold start + giới hạn 29s API GW + bài toán connection pool RDS (Bài 2, Case 2 bàn tiếp).
3. *"Session đặt ở đâu khi nhiều task?"* — Gợi ý: Redis hoặc JWT stateless; tuyệt đối không in-memory + sticky session.

---

### Bài 2: Image processing pipeline serverless

**Đề bài:** Users upload ảnh sản phẩm (tới 50MB/file, ~20K uploads/ngày, đỉnh 50 uploads/phút). Mỗi ảnh cần 4 size: thumbnail 150px, small 480px, medium 1024px, webp variant. Yêu cầu: pipeline serverless S3 → Lambda → S3 → CloudFront; xử lý ảnh lớn vượt giới hạn Lambda; **idempotency khi S3 event bị duplicate**; user thấy ảnh đã xử lý trong < 30 giây.

**Phân tích & lời giải:**

**Bước 1 — Luồng tổng thể:**

```
Client ──(1) POST /uploads ──► API (Node) ── tạo presigned PUT URL + key có ulid
   │                              │
   └──(2) PUT ảnh trực tiếp ─────►│ S3 bucket: uploads-raw/{ulid}.jpg
                                  │      │ (3) S3 event: ObjectCreated
                                  │      ▼
                                  │   SQS queue ◄── (buffer, retry, DLQ)
                                  │      │ (4) event source mapping, batch 5
                                  │      ▼
                                  │   Lambda resize (sharp, 2GB RAM)
                                  │      │ (5) ghi 4 sizes
                                  │      ▼
                                  │   S3 bucket: images-processed/{ulid}/{size}.webp
                                  │      │ (6) cập nhật status
                                  │      ▼
                                  │   DynamoDB: image_status (idempotency + tracking)
                                  ▼
Client ◄── CloudFront ◄── images-processed (OAC)
```

**Các quyết định:**

- **(1)(2) Presigned URL, upload thẳng S3**: file 50MB không nên chảy qua API (tốn compute, ALB timeout, double bandwidth). API chỉ cấp presigned PUT URL (TTL 5 phút, ràng buộc content-type/size qua điều kiện) — đây là pattern mặc định cho upload trên AWS.
- **(3)(4) S3 → SQS → Lambda thay vì S3 → Lambda trực tiếp**: SQS cho (a) buffer khi burst, (b) retry có kiểm soát + **DLQ** cho ảnh hỏng/quá khổ, (c) batch để giảm invocation, (d) điều tiết concurrency. S3→Lambda trực tiếp retry chỉ 2 lần rồi mất event nếu không cấu hình destination.
- **Tách bucket raw / processed**: nếu Lambda ghi output vào cùng bucket+prefix đang trigger → **vòng lặp đệ quy vô hạn** (output lại sinh event) — lỗi cháy ví kinh điển. Tách bucket (hoặc ít nhất prefix filter chặt) là bắt buộc.

**Bước 2 — Lambda resize (Node.js + sharp):**

```js
import sharp from "sharp";
const SIZES = [
  { name: "thumb", width: 150 }, { name: "small", width: 480 },
  { name: "medium", width: 1024 }, { name: "webp", width: 1024, format: "webp" },
];

export const handler = async (event) => {
  const failures = [];
  for (const record of event.Records) {           // SQS batch
    const { bucket, key } = parseS3Event(record);
    try {
      // Idempotency gate — xem Bước 4
      if (!(await claimWork(key))) continue;       // đã/đang xử lý → bỏ qua

      const input = await s3.getObject(bucket, key);   // stream
      await Promise.all(SIZES.map(async (s) => {
        const out = await sharp(await buf(input)).rotate()  // tôn trọng EXIF
          .resize({ width: s.width, withoutEnlargement: true })
          .toFormat(s.format ?? "jpeg", { quality: 80 }).toBuffer();
        await s3.putObject(PROCESSED_BUCKET, `${id(key)}/${s.name}`, out);
      }));
      await markDone(key);
    } catch (err) {
      failures.push({ itemIdentifier: record.messageId });  // partial batch failure
    }
  }
  return { batchItemFailures: failures };  // chỉ retry message lỗi, không cả batch
};
```

Cấu hình: memory **2048MB** (Lambda cấp CPU tỉ lệ theo memory — sharp là CPU-bound, 2GB chạy nhanh hơn *và thường rẻ hơn* 512MB vì duration giảm mạnh); timeout 60s; `reserved concurrency` 50 để không nuốt hết concurrency account khi backlog lớn. Sharp phải build cho `linux-arm64`/`linux-x64` đúng kiến trúc Lambda (dùng layer hoặc container image).

**Bước 3 — File lớn vượt giới hạn Lambda.** Các trần liên quan: payload event 6MB (không sao — event chỉ chứa metadata, file lấy từ S3), `/tmp` mặc định 512MB (tăng được tới 10GB), memory 10GB max, timeout 15 phút. Với ảnh 50MB: stream từ S3 + sharp xử lý theo stream là đủ trong 2GB RAM. Phòng xa:
- Validate size ngay từ presigned URL (condition `content-length-range`) — chặn từ cổng.
- Nếu sau này nhận video/ảnh RAW hàng GB: Lambda không còn phù hợp → cùng queue đó trỏ sang consumer **ECS Fargate task** (pattern "Lambda cho 99% nhỏ, Fargate cho phần ngoại cỡ" — route theo size trong message), hoặc AWS Batch.

**Bước 4 — Idempotency (trọng tâm đề).** S3 events có ngữ nghĩa **at-least-once**; SQS standard cũng vậy; Lambda retry khi lỗi → một ảnh có thể được xử lý 2-3 lần. Resize vốn idempotent về *kết quả* (ghi đè cùng key, cùng nội dung) nhưng không idempotent về *chi phí* và có race khi 2 invocation chạy song song. Giải pháp: **conditional write trên DynamoDB làm claim**:

```js
async function claimWork(key) {
  try {
    await ddb.putItem({
      TableName: "image_status",
      Item: { pk: key, status: "PROCESSING", startedAt: Date.now(), ttl: ... },
      // chỉ thành công nếu chưa có record, hoặc record cũ PROCESSING đã quá hạn (lambda chết giữa chừng)
      ConditionExpression: "attribute_not_exists(pk) OR (status = :p AND startedAt < :stale)",
      ExpressionAttributeValues: { ":p": "PROCESSING", ":stale": Date.now() - 120_000 },
    });
    return true;
  } catch (e) {
    if (e.name === "ConditionalCheckFailedException") return false;  // ai đó đang/đã làm
    throw e;
  }
}
```

Điểm tinh tế nêu khi phỏng vấn: khóa idempotency dùng **S3 object key (chứa ulid duy nhất mỗi upload)**, không dùng SQS messageId (duplicate event có messageId khác nhau!). Record có TTL stale để Lambda chết giữa chừng không khóa vĩnh viễn. Output ghi đè cùng key nên lần xử lý lặp (nếu lọt) vẫn vô hại — defense in depth.

**Bước 5 — Trải nghiệm client < 30s**: client poll `GET /uploads/{id}/status` (đọc DynamoDB) hoặc nhận push qua WebSocket/AppSync; placeholder/blur-hash trong lúc chờ. CloudFront trước bucket processed với cache TTL dài + key bất biến (ulid) → không bao giờ phải invalidate.

**Trade-offs:**
- SQS giữa S3 và Lambda thêm một hop (~vài trăm ms) và một thành phần — đổi lấy DLQ, throttle, batch; với hệ "đồ chơi" S3→Lambda trực tiếp đơn giản hơn.
- Resize "eager" cả 4 size mỗi upload vs "lazy" (resize on-the-fly qua Lambda@Edge khi miss cache): eager đơn giản, dự đoán được, tốn storage; lazy tiết kiệm storage và linh hoạt size mới nhưng phức tạp + latency lần đầu.
- DynamoDB cho status thêm chi phí nhỏ (~vài $) nhưng mua được idempotency + tracking — gần như luôn đáng.

**Follow-up interviewer hay hỏi:**
1. *"Nếu dùng SQS FIFO thay standard thì có hết duplicate không?"* — Gợi ý: FIFO dedup trong cửa sổ 5 phút và theo dedup-id, nhưng S3 event notification không gửi được vào FIFO trực tiếp và duplicate có thể đến ngoài cửa sổ; idempotency tầng application vẫn bắt buộc — dedup của hạ tầng chỉ là tối ưu.
2. *"Lambda memory bao nhiêu là 'đúng'?"* — Gợi ý: đo bằng AWS Lambda Power Tuning (step function chạy thử các mức) — vì CPU tỉ lệ memory, sweet spot chi phí thường ở mức memory cao hơn trực giác.
3. *"Ảnh độc hại (decompression bomb, file giả mạo content-type) thì sao?"* — Gợi ý: validate magic bytes, `sharp().metadata()` check kích thước pixel trước khi decode, limit `pixels`, DLQ + alert cho file fail.

---

### Bài 3: Hệ thống gửi email/notification dùng SQS

**Đề bài:** Platform cần gửi email/push: transactional (xác nhận đơn — phải đến nhanh, không được mất) ~50K/ngày và campaign (marketing burst 500K trong 1 giờ). Provider (SES/SendGrid) giới hạn 200 req/s. Yêu cầu: producer API → SQS → consumer trên ECS; biện luận FIFO vs standard; DLQ + redrive; **visibility timeout đặt thế nào so với thời gian xử lý**; scale consumer theo queue depth; không gửi trùng email khi retry.

**Phân tích & lời giải:**

**Bước 1 — Topology:**

```
 order-service ──► SQS notify-transactional ──► consumer ECS (2-10 tasks) ──► SES
 campaign-svc ───► SQS notify-campaign ──────► consumer ECS (0-30 tasks) ──► SES
                        │ maxReceiveCount=5            ▲ rate limiter 200/s (chia theo task)
                        ▼                              │
                   SQS notify-dlq ── alarm ── redrive (sau khi fix)
```

**Tách 2 queue theo SLA** — quyết định quan trọng nhất: nếu chung 1 queue, 500K email campaign xếp trước sẽ chặn email xác nhận đơn hàng (head-of-line blocking theo nghĩa backlog). Transactional cần latency giây; campaign cần throughput, trễ 30 phút không sao. Tách queue → scale, alarm, concurrency độc lập. (SQS không có priority — "priority" trên SQS = nhiều queue.)

**Bước 2 — FIFO vs Standard:**

| | Standard | FIFO |
|---|---|---|
| Thứ tự | Best-effort | Đảm bảo theo MessageGroupId |
| Dedup | Không | 5-phút window theo dedup-id |
| Throughput | Gần như vô hạn | 300 msg/s (3.000 với batching; high-throughput mode cao hơn nhưng vẫn có trần theo group) |
| Giá | Rẻ hơn | Đắt hơn ~25% |

**Chọn Standard cho cả hai**, vì: (a) email không cần thứ tự toàn cục — "đến nơi" quan trọng hơn "đúng thứ tự"; (b) trần throughput FIFO thành nghẽn lúc campaign burst; (c) dedup 5 phút của FIFO **không thay được idempotency** ở consumer (retry sau 6 phút vẫn trùng). Nêu ngoại lệ cho điểm cộng: nếu có chuỗi phụ thuộc thứ tự theo user (vd "đơn tạo" rồi "đơn hủy" không được đảo), dùng FIFO với `MessageGroupId = userId` — thứ tự trong từng user, song song giữa các user.

**Bước 3 — Visibility timeout vs thời gian xử lý (câu đề bài nhấn):** Khi consumer nhận message, SQS *ẩn* nó trong `VisibilityTimeout`; không delete kịp trong thời gian đó → message hiện lại cho consumer khác = **xử lý trùng**.

- Đo thời gian xử lý: gọi SES + ghi DB ≈ p99 ~3-5s. Quy tắc: **visibility timeout ≈ 6× p99 processing time** (khuyến nghị AWS: ít nhất 6× timeout của client) → đặt **30s** cho per-message; nếu consumer xử lý batch 10 message tuần tự thì phải tính cả batch.
- Đặt quá ngắn: trùng hàng loạt khi hệ chậm (chính lúc tệ nhất). Đặt quá dài (vd 12h): message của consumer chết kẹt ẩn hàng giờ mới được xử lý lại — với transactional là thảm họa.
- Kỹ thuật nâng cao nêu thêm: job dài/không đoán trước → **heartbeat `ChangeMessageVisibility`** gia hạn dần trong khi xử lý, thay vì đặt timeout khổng lồ từ đầu.

**Bước 4 — DLQ + redrive:**

```json
{ "redrivePolicy": { "deadLetterTargetArn": "...notify-dlq", "maxReceiveCount": 5 } }
```

- `maxReceiveCount: 5`: phân biệt lỗi transient (SES throttle, network — retry sẽ qua) với lỗi vĩnh viễn (email không hợp lệ, template hỏng — retry vô ích). 5 lần nhận mà vẫn fail → sang DLQ, **không chặn queue chính**.
- Retention DLQ 14 ngày (max). CloudWatch alarm trên `ApproximateNumberOfMessagesVisible` của DLQ > 0 — DLQ có hàng tức là có bug/sự cố cần người xem.
- Quy trình redrive: xem message trong DLQ → tìm nguyên nhân → fix code/config → dùng **DLQ redrive** (tính năng SQS có sẵn) bơm ngược về queue gốc. Không bao giờ redrive trước khi fix — chỉ tạo vòng lặp fail.
- Backoff giữa các lần retry: dùng `ChangeMessageVisibility` tăng dần theo receiveCount (SQS không có exponential backoff sẵn cho re-delivery).

**Bước 5 — Scale consumer theo queue depth.** Metric đúng không phải độ dài queue tuyệt đối mà là **backlog per task** (hoặc tốt nhất: backlog ÷ tốc độ xử lý = thời gian cần để xử lý hết, so với SLA):

```
desired_tasks = ceil( ApproximateNumberOfMessagesVisible / (msgs_per_task_per_min × SLA_phút) )
```

Triển khai bằng ECS Service Auto Scaling: target tracking trên custom metric `backlogPerTask` (Lambda nhỏ publish metric mỗi phút = queue depth ÷ running tasks), hoặc step scaling theo queue depth. Campaign consumer cho phép **scale về 0** ngoài giờ (ECS làm được qua scheduled/step scaling; nếu dùng KEDA trên EKS thì scale-to-zero là tính năng có sẵn). Lưu ý trần phía SES 200 req/s: scale consumer vô hạn chỉ tổ ăn throttle — rate limiter phân tán (token bucket trên Redis) hoặc chia quota tĩnh theo task, và đây là lý do consumer ECS dài hạn hợp hơn Lambda (giữ rate limiter + connection ổn định).

**Bước 6 — Không gửi trùng:** SQS standard = at-least-once → consumer **phải idempotent**: bảng `sent_log` với key `(notificationId)` — producer sinh `notificationId` (ulid) lúc enqueue; consumer `INSERT ... ON CONFLICT DO NOTHING` (hoặc DynamoDB conditional put) **trước khi** gọi SES; đã tồn tại → ack và bỏ qua. Khe hở còn lại (insert xong, gọi SES xong, crash trước khi delete message → message quay lại nhưng record đã có → bỏ qua: đúng). Trường hợp insert xong nhưng SES fail → cần status `PENDING→SENT` 2 bước, record PENDING quá hạn được phép thử lại.

**Trade-offs:**
- 2 queue (hay nhiều hơn theo tier) tăng số thứ phải vận hành nhưng là cách duy nhất có "priority" và blast-radius isolation trên SQS.
- Consumer ECS luôn chạy tối thiểu 2 task (tiền cố định) vs Lambda event source (scale-to-zero thật) — chọn ECS vì rate limit provider + connection reuse + xử lý đều đặn; Lambda thắng khi traffic rất spiky và không có trần provider.
- Idempotency bằng DB thêm 1 write mỗi message — vài $ mỗi tháng đổi lấy không bao giờ gửi trùng email xác nhận đơn (uy tín thương hiệu).

**Follow-up interviewer hay hỏi:**
1. *"Sao không dùng SNS, hay SNS+SQS fan-out?"* — Gợi ý: SNS khi 1 event cần nhiều consumer khác loại (email + push + webhook) → SNS topic fan-out vào nhiều SQS queue, mỗi queue một consumer/SLA riêng; SQS thuần khi chỉ 1 loại worker.
2. *"Consumer đang xử lý thì deploy, message có mất không?"* — Gợi ý: không mất — chưa delete thì sau visibility timeout message hiện lại; nhưng cần graceful shutdown (ngừng nhận mới, xử lý nốt in-flight trong stopTimeout) để giảm trùng lặp/độ trễ.
3. *"Làm sao biết hệ 'khỏe'? Kể 3 metric quan trọng nhất."* — Gợi ý: `ApproximateAgeOfOldestMessage` (SLA thực — quan trọng hơn queue depth), DLQ depth, throttle/error rate từ SES.

---

### Bài 4: Disaster recovery & backup strategy

**Đề bài:** Hệ e-commerce ở Bài 1 (RDS Postgres 200GB, S3 200GB ảnh, ECS stateless) chạy ở `ap-southeast-1`. CEO hỏi sau một sự cố của một cloud provider trên báo: "Nếu cả region sập, hoặc engineer xóa nhầm database, chúng ta mất gì và bao lâu thì sống lại?" Doanh thu ~$50K/ngày. Thiết kế DR: định nghĩa RTO/RPO theo từng kịch bản, RDS snapshot + PITR, S3 cross-region replication, so sánh pilot light vs warm standby, và chi phí của từng mức.

**Phân tích & lời giải:**

**Bước 1 — Ngôn ngữ chung trước, công nghệ sau.** DR bắt đầu bằng 2 con số kinh doanh, không phải bằng service AWS:
- **RPO (Recovery Point Objective)** — chấp nhận mất tối đa bao nhiêu *dữ liệu* (tính bằng thời gian)?
- **RTO (Recovery Time Objective)** — chấp nhận *ngừng phục vụ* tối đa bao lâu?

Và phải tách **theo kịch bản** — gộp chung là sai phổ biến:

| Kịch bạn | Xác suất | Cơ chế phục hồi | RPO/RTO đề xuất |
|---|---|---|---|
| Xóa nhầm data, bad migration | Cao nhất! | PITR trong region | RPO ≤ 5 phút, RTO ≤ 1h |
| AZ outage | Thỉnh thoảng | Multi-AZ (đã có ở Bài 1) — tự động | RPO ≈ 0, RTO ≈ phút |
| Region outage | Rất hiếm | Cross-region DR | RPO ≤ 15 phút, RTO ≤ 4h |
| Account bị chiếm / ransomware | Hiếm nhưng chí tử | Backup sang **account khác**, immutable | RPO ≤ 24h |

Với $50K doanh thu/ngày: mỗi giờ downtime ≈ $2K — đầu tư DR phải tương xứng con số này, không hơn.

**Bước 2 — Tầng backup (chống kịch bản phổ biến nhất: lỗi con người):**
- **RDS automated backup + PITR**: bật retention 14-35 ngày → restore về *bất kỳ thời điểm nào* (transaction log 5 phút/lần) trong khoảng đó. Đây là vũ khí chống "DROP TABLE nhầm": restore về 13:59, ngay trước câu lệnh 14:00. Lưu ý quan trọng để nói trong phỏng vấn: **PITR restore tạo instance MỚI** (endpoint mới, ~20-60 phút cho 200GB) — không phải "undo tại chỗ"; quy trình phải tính thời gian trỏ lại app + reconcile data viết sau thời điểm restore.
- **Manual snapshot** trước mỗi migration lớn (gắn vào pipeline) + snapshot định kỳ **copy sang region khác và sang account backup riêng** (AWS Backup làm tự động + backup vault lock chống xóa) — chống cả region outage lẫn kẻ tấn công có quyền xóa backup.
- **S3**: bật **Versioning** (chống ghi đè/xóa nhầm — delete chỉ tạo delete marker) + **Cross-Region Replication** sang bucket ở `ap-northeast-1` (replication ~phút, RPO nhỏ) + lifecycle xuống IA/Glacier cho version cũ. MFA delete/Object Lock cho mức paranoid.
- Code & config: ECR replication cross-region; hạ tầng là **Terraform/CDK trong git** — không có IaC thì mọi kế hoạch DR region chỉ là văn mẫu, vì không ai dựng lại VPC bằng tay trong 4 giờ.

**Bước 3 — Chiến lược cross-region: 4 mức của AWS, biện luận 2 mức giữa:**

```
Backup-restore ──► Pilot light ──► Warm standby ──► Multi-site active-active
RTO: 8-24h+        1-4h             phút-1h           ~0
$: rất thấp        thấp             trung bình        rất cao (2× + complexity)
```

- **Pilot light**: ở region phụ chỉ duy trì "đốm lửa": data được replicate liên tục (RDS cross-region read replica hoặc snapshot copy + S3 CRR + ECR), còn compute = 0 (task count 0, hạ tầng định nghĩa sẵn trong Terraform). Khi thảm họa: promote read replica → primary, terraform apply/scale ECS lên, trỏ Route 53. Chi phí thêm: ~$250-300/tháng (replica single-AZ + storage + chút phí replication). RTO thực tế: 1-4h (phần lâu nhất là con người + DNS + những thứ chưa diễn tập).
- **Warm standby**: bản sao thu nhỏ *đang chạy* — ECS 1-2 task mỗi service, replica đã promote-able, ALB sẵn sàng, Route 53 failover routing + health check. RTO: phút đến <1h (chủ yếu là scale up + DNS TTL). Chi phí thêm: ~$600-800/tháng.

**Chọn cho hệ này: Pilot light**, vì region outage hiếm và $2K/giờ × 4h = $8K thiệt hại kịch bản xấu, không biện minh được thêm ~$400/tháng vĩnh viễn của warm standby; trong khi đó **dồn tiền vào tầng backup + PITR + diễn tập** — thứ chống kịch bản xác suất cao nhất (lỗi người). Điều kiện đổi chiều: doanh thu tăng 5-10×, hoặc SLA hợp đồng B2B quy định RTO < 1h → nâng warm standby.

**Bước 4 — Phần bị quên nhiều nhất: kiểm chứng.**
- **DR drill mỗi quý**: thực sự restore PITR ra instance mới và đo thời gian; thực sự dựng pilot light region phụ. "Backup chưa từng restore thử = không có backup."
- Runbook từng bước, có chủ sở hữu, quyết định failover là quyết định *con người* có tiêu chí rõ (region degraded ≥ X phút theo health check + status page) — failover DB tự động cross-region dễ split-brain.
- Giám sát chính việc backup: alarm khi automated backup fail, khi replication lag S3/RDS vượt ngưỡng (lag chính là RPO thực của bạn).

**Trade-offs:**
- Tiền DR là tiền "bảo hiểm" thuần — chọn mức theo chi phí downtime, đừng theo sự hào nhoáng kiến trúc. Active-active đa region cho hệ $50K/ngày là over-engineering kinh điển.
- Cross-region read replica cho RPO phút nhưng replica async — promote là chấp nhận mất vài giây-phút cuối; snapshot copy rẻ hơn nhưng RPO hàng giờ.
- Backup sang account riêng + vault lock thêm ma sát vận hành — nhưng là lớp duy nhất sống sót kịch bản credentials bị chiếm (ransomware hiện đại xóa backup trước, mã hóa sau).

**Follow-up interviewer hay hỏi:**
1. *"RPO 5 phút bằng PITR — vậy RPO của kịch bản region outage là bao nhiêu với pilot light?"* — Gợi ý: bằng replication lag của cross-region replica (giây→phút) hoặc tuổi snapshot copy gần nhất (giờ) tùy cách chọn — RPO phải khai theo từng kịch bản.
2. *"Failover xong thì fail-back về region chính thế nào?"* — Gợi ý: phần khó hơn failover — data đã ghi ở region phụ phải replicate ngược, thường làm có kế hoạch trong maintenance window; nêu được điều này là điểm senior.
3. *"DynamoDB global tables / Aurora Global Database thay đổi bài toán thế nào?"* — Gợi ý: managed cross-region replication với RPO ~1s và failover phút — mua RTO/RPO bằng tiền + ràng buộc công nghệ; Aurora Global ~ nâng cấp tự nhiên khi cần warm standby DB.

---

## 🌍 Case thực tế

### Case 1: Bill AWS tăng gấp 5 vì NAT Gateway data transfer

**Bối cảnh:** Team chuyển batch xử lý file (đọc/ghi S3 hàng TB mỗi tháng) từ EC2 public subnet sang Lambda đặt **trong VPC private subnet** (để gọi được RDS). Tháng sau, bill nhảy từ ~$800 lên ~$4.000. Không ai đổi gì "lớn" — chỉ là một migration "best practice".

**Vấn đề gặp phải:** Mở Cost Explorer, group by service → khoản phình to là **EC2-Other**, drill xuống usage type `NatGateway-Bytes`. Truy ra: Lambda trong private subnet, mọi cuộc gọi tới S3 (public endpoint) phải đi qua **NAT Gateway** — NAT GW tính **$0.045/GB data processed** (cộng thêm $0.045/giờ tồn tại). ~70TB/tháng qua NAT ≈ $3.150 chỉ riêng processing fee. Trớ trêu: traffic đi từ VPC tới S3 *cùng region* vốn có thể **miễn phí hoàn toàn** — chỉ vì thiếu một resource cấu hình mà mỗi GB bị "đánh thuế".

**Giải pháp & tại sao:**
1. **S3 Gateway VPC Endpoint** — fix 15 phút: tạo gateway endpoint, gắn vào route table của private subnets → traffic tới S3 đi nội bộ mạng AWS, **$0 phí endpoint, $0 phí data** cùng region. DynamoDB cũng có gateway endpoint miễn phí tương tự.
2. Rà tiếp các "khách quen" khác của NAT: ECR pull (interface endpoints `ecr.api`, `ecr.dkr` + S3 vì layer nằm trên S3), CloudWatch Logs, Secrets Manager, SQS — interface endpoint giá ~$7.3/tháng/AZ + $0.01/GB: rẻ hơn NAT processing 4.5 lần, đáng tiền khi service đó có lưu lượng đáng kể (làm phép tính hoà vốn, không bật tràn lan).
3. Thiết lập **guardrail tài chính**: AWS Budgets alert theo ngưỡng + anomaly detection — để lần sau biết trong 3 ngày, không phải khi hóa đơn chốt tháng; tag tài nguyên theo team/feature để truy chi phí nhanh.
4. Đưa vào checklist kiến trúc: "đặt workload vào private subnet" phải đi kèm câu hỏi "nó nói chuyện với AWS service nào → endpoint gì".

**Bài học rút ra:**
- Trên AWS, **data transfer và NAT là chi phí tàng hình** — kiến trúc "đúng security" có thể sai thảm về tiền nếu quên tầng network economics.
- S3/DynamoDB gateway endpoints miễn phí — gần như không có lý do gì để không bật mặc định cho mọi VPC.
- Kỹ năng đọc Cost Explorer theo usage type (NatGateway-Bytes, DataTransfer-Out) là kỹ năng debug như đọc stack trace.

**💬 Cách dùng case này khi phỏng vấn:** Khi được hỏi về cost optimization hay VPC design, kể đường chẩn đoán: Cost Explorer → EC2-Other → NatGateway-Bytes → à, Lambda private subnet gọi S3 qua NAT → gateway endpoint miễn phí, bill về lại bình thường trong một ngày. Chốt bằng nguyên tắc "private subnet + AWS service = nghĩ tới VPC endpoint trước".

---

### Case 2: Lambda cold start làm API p99 lên 3 giây

**Bối cảnh:** API serverless (API Gateway + Lambda Node.js + RDS Postgres) phục vụ mobile app. p50 đẹp (~80ms) nhưng p99 ~3s, user phàn nàn app "thỉnh thoảng đơ". Đồng thời, vào giờ cao điểm xuất hiện lỗi `too many connections` từ Postgres.

**Vấn đề gặp phải:** Hai bệnh riêng nhưng cùng gốc "mỗi invocation là một thế giới":
1. **Cold start cộng dồn**: bundle 35MB (import nguyên `aws-sdk` v2 + lodash + moment), Lambda trong VPC (thời xưa ENI attach chậm — nay đã cải thiện nhiều nhưng vẫn cộng), init code mở connection + load config **ngoài handler một cách nặng nề** → cold start 2.5-3s. Traffic spiky → tỷ lệ cold start cao → chính là cái đuôi p99.
2. **Connection storm**: mỗi Lambda environment giữ 1 connection Postgres; burst 300 concurrent invocations = 300 connections; RDS `max_connections` cho instance nhỏ ~tầm 100-200 → từ chối kết nối. Lambda scale theo request, RDS thì không — mismatch mô hình căn bản.

**Giải pháp & tại sao:**
1. **Giảm cold start trước khi mua cold start**: bundle bằng esbuild, chỉ import modular AWS SDK v3 (`@aws-sdk/client-s3` thay vì cả SDK) → 35MB còn ~2MB, init từ ~2.5s còn ~400ms. Lazy-init những thứ không phải request nào cũng cần. Tăng memory (CPU tỉ lệ theo) cũng rút ngắn init.
2. **Provisioned concurrency** cho các route nóng: giữ N environment đã init sẵn → cold start ≈ 0 cho phần traffic trong N; bật theo schedule (giờ làm việc) bằng Application Auto Scaling để không trả tiền 24/7. Trade-off: trả tiền cho concurrency giữ sẵn — đến một mức sử dụng đều đặn, **chuyển hẳn sang ECS Fargate** (process sống lâu, không có khái niệm cold start, rẻ hơn cho tải đều) là câu trả lời đúng — đội này sau cùng chuyển các route core sang Fargate, giữ Lambda cho phần event-driven thật sự.
3. **RDS Proxy** chữa connection storm: Lambda kết nối tới proxy, proxy giữ pool thật (multiplexing) tới RDS → 300 invocation chia sẻ vài chục connection thật; thêm lợi ích failover nhanh hơn. Phí ~$0.015/ACU-giờ. Kèm kỷ luật code: tạo client **ngoài handler** (tái sử dụng theo environment), pool size = 1/environment.
4. Đo đúng trước-sau: CloudWatch `InitDuration` trong REPORT log lines + X-Ray trace, đếm % cold start — quyết định bằng số.

**Bài học rút ra:**
- p99 của serverless là câu chuyện cold start — và đòn rẻ nhất hiệu quả nhất là **giảm bundle/init**, không phải vung tiền provisioned concurrency ngay.
- Lambda + RDB truyền thống là cặp lệch pha về connection model; RDS Proxy (hoặc Data API/serverless DB) là miếng đệm bắt buộc khi concurrency cao.
- "Serverless vs container" không phải tôn giáo: tải spiky/event-driven → Lambda; tải đều, latency-sensitive → Fargate. Câu trả lời senior là biết điểm gãy và chỉ ra mình đã từng chuyển.

**💬 Cách dùng case này khi phỏng vấn:** Khi hỏi "Lambda có nhược điểm gì / xử lý cold start thế nào", trả lời theo bậc thang chi phí: đo InitDuration → bundle esbuild + SDK v3 (2.5s→400ms, miễn phí) → provisioned concurrency theo schedule (có giá) → đổi sang Fargate khi tải đều (kiến trúc); và đừng quên kể cặp đôi RDS Proxy cho connection storm — hai vấn đề này hầu như luôn đi cùng nhau.

---

### Case 3: Hardcode AWS key bị lộ trên GitHub

**Bối cảnh:** Engineer mới cần test script upload S3, tạo IAM user `dev-test` với policy `AdministratorAccess` "cho nhanh", dán access key vào `config.js`, commit. Vài tuần sau repo private được chuyển public để share với đối tác. **Trong vòng chưa tới một giờ**, bot quét GitHub tìm thấy key (pattern `AKIA...` bị scan liên tục bởi cả AWS lẫn kẻ xấu): hàng trăm EC2 instance cỡ lớn được spin up ở 5 region để đào coin, kèm các API call thăm dò (`ListBuckets`, `GetCallerIdentity`). Billing alert (may mà có) reo khi chi phí vượt ngưỡng.

**Vấn đề gặp phải:** Chuỗi sai nhiều lớp: secret dài hạn nằm trong code → key gắn quyền admin thay vì least privilege → không có process review trước khi public repo → không có secret scanning → phát hiện nhờ billing chứ không nhờ security telemetry.

**Giải pháp & tại sao:**

*Xử lý sự cố ngay (thứ tự quan trọng):*
1. **Vô hiệu hóa key ngay lập tức** (deactivate rồi delete) — trước mọi việc khác; xóa file khỏi repo là vô nghĩa vì key đã nằm trong git history và đã bị thu hoạch.
2. Đánh giá phạm vi: **CloudTrail** lọc theo access key ID → kẻ tấn công đã gọi gì, ở region nào, có tạo **persistence** không (IAM user/key/role mới, thay đổi policy, Lambda backdoor) — dọn cả những thứ chúng tạo ra, không chỉ tắt EC2.
3. Diệt tài nguyên lạ ở **mọi region** (kẻ tấn công cố tình dùng region ít ai nhìn); kiểm tra cả những dịch vụ đắt hay bị lạm dụng (SES gửi spam, SageMaker).
4. Mở case với AWS Support (trường hợp compromised account có quy trình riêng, có thể thương lượng phần chi phí gian lận).
5. Rotate **mọi** secret mà key này có quyền đọc (Secrets Manager, parameter store) — quyền admin nghĩa là phải coi như tất cả đã lộ.

*Phòng ngừa tái diễn (phần interviewer muốn nghe nhất):*
1. **Loại bỏ long-lived keys khỏi mọi nơi có thể**: code chạy trên AWS dùng **IAM Role** (ECS task role, Lambda execution role, EC2 instance profile) — credential tạm, tự rotate, không có gì để commit. CI/CD dùng **OIDC federation** (GitHub Actions → assume role) thay vì key trong secrets.
2. Secret còn lại buộc vào **Secrets Manager** với rotation tự động; app đọc lúc runtime, không bao giờ ở file/env commit được.
3. **Chặn ở cổng**: pre-commit hook (gitleaks/trufflehog) + GitHub secret scanning với **push protection** bật org-wide — chặn ngay lúc push, không phải phát hiện sau.
4. Least privilege làm mặc định: không ai có user access key quyền admin; quyền cấp theo role + permission boundary; SCP chặn region không dùng.
5. Phát hiện chủ động: GuardDuty (có finding riêng cho credential bị dùng bất thường), billing anomaly alert, alarm trên API `CreateAccessKey`/`AttachUserPolicy` bất thường.

**Bài học rút ra:**
- Key lộ trên GitHub bị khai thác trong **phút**, không phải ngày — "revoke trước, điều tra sau" là phản xạ bắt buộc, và xóa commit không phải là remediation.
- Cách chống lộ key tốt nhất là **không có key**: IAM role + OIDC cho gần như mọi tình huống hợp lệ ngày nay.
- Sự cố security luôn là chuỗi lỗi quy trình, không phải một cá nhân — fix bằng guardrail tự động (push protection, SCP, GuardDuty), không phải bằng "nhắc anh em cẩn thận".

**💬 Cách dùng case này khi phỏng vấn:** Câu "nếu phát hiện AWS key bị lộ thì làm gì" là câu screening kinh điển — trả lời theo khung: contain (deactivate key ngay) → assess (CloudTrail, tìm persistence, mọi region) → eradicate & recover (dọn tài nguyên, rotate secrets, AWS support) → prevent (IAM role/OIDC thay key, push protection, GuardDuty). Nói thêm "xóa file khỏi git không có tác dụng vì history" để cho thấy hiểu thật.

---

## ✅ Checklist tự kiểm tra

1. Tôi có vẽ được VPC chuẩn 3 tầng subnet × multi-AZ, giải thích cái gì nằm ở đâu, security group reference nhau thế nào, và vai trò của NAT GW vs VPC endpoints?
2. Tôi có biện luận được ECS Fargate vs EKS theo ngữ cảnh team/quy mô (chứ không theo "cái nào xịn hơn"), và nêu điều kiện khiến quyết định đổi chiều?
3. Tôi có phân biệt RDS Multi-AZ (availability) với read replica (read scaling), và biết khi nào đọc bắt buộc phải vào primary (read-your-own-writes)?
4. Tôi có thiết kế được pipeline S3 event đúng bài: presigned upload, S3→SQS→Lambda, tách bucket chống đệ quy, idempotency bằng conditional write, partial batch failure, và phương án cho file vượt giới hạn Lambda?
5. Tôi có giải thích được visibility timeout đặt thế nào so với processing time, vì sao FIFO dedup không thay được idempotency, DLQ + maxReceiveCount + quy trình redrive, và scale consumer theo backlog-per-task thay vì queue depth thô?
6. Tôi có trình bày được RPO/RTO theo từng kịch bản (lỗi người / AZ / region / account bị chiếm), PITR khác snapshot thế nào, và biện luận pilot light vs warm standby bằng chi phí downtime thực?
7. Nếu bill AWS đột biến hoặc key bị lộ, tôi có nói được trình tự chẩn đoán/xử lý từng bước như một người đã từng làm (Cost Explorer theo usage type; deactivate key → CloudTrail → persistence → prevent bằng role/OIDC)?
