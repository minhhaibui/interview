# Tuần 6: Kafka

> 🔬 **Có bản đào sâu!** Xem [`DEEP-DIVE.md`](DEEP-DIVE.md) — cơ chế bên trong, ví dụ nâng cao, bẫy production & câu hỏi phỏng vấn KHÓ hơn cho tuần này.

> 🧪 **Có lab tận tay!** Xem [`lab/LAB.md`](lab/LAB.md) — Kafka KRaft qua `docker compose`, tự tạo topic 3 partition rồi producer/consumer để thấy consumer group chia partition & cùng key giữ thứ tự.

## 🎯 Mục tiêu tuần này

- Hiểu Kafka là gì, kiến trúc lõi (broker, topic, partition, offset) và **khi nào dùng Kafka vs RabbitMQ/SQS** — trả lời có tiêu chí, không cảm tính.
- Nắm vững producer (acks, idempotence, batching) và consumer group (rebalancing, offset commit) — đủ sâu để debug sự cố thực tế.
- Trình bày được delivery semantics (at-most/at-least/exactly-once) và **ordering guarantees** — 2 chủ đề được hỏi nhiều nhất.
- Biết xử lý lỗi production: retry, DLQ, poison message, consumer lag.
- Áp dụng Kafka vào microservices: event-driven architecture, outbox pattern; code được producer/consumer hoàn chỉnh với `kafkajs`.

## 📚 Lý thuyết

### Ngày 1-2: Kafka là gì, so sánh với RabbitMQ/SQS & kiến trúc lõi

#### 1. Kafka là gì?

Kafka là **distributed event streaming platform** — bản chất là một **commit log phân tán**: message được append vào log, lưu lại theo retention (mặc định 7 ngày), consumer tự kéo (pull) và tự theo dõi vị trí đọc (offset). Khác tư duy với message queue truyền thống: message **không bị xoá khi consume** — nhiều consumer group đọc cùng dữ liệu độc lập, replay được quá khứ.

Dùng cho: event-driven microservices, log/metrics pipeline, CDC (Change Data Capture), stream processing, event sourcing.

#### 2. Kafka vs RabbitMQ vs SQS — khi nào dùng gì?

| Tiêu chí | Kafka | RabbitMQ | SQS |
|---|---|---|---|
| Mô hình | Log phân tán, consumer **pull** | Smart broker **push**, queue/exchange routing | Managed queue, polling |
| Message sau consume | Giữ lại theo retention, **replay được** | Xoá sau ack | Xoá sau ack |
| Throughput | Rất cao (hàng triệu msg/s) | Cao vừa (chục–trăm nghìn) | Đủ dùng, AWS tự scale |
| Ordering | Trong partition | Trong queue (1 consumer) | FIFO queue (giới hạn throughput) |
| Routing phức tạp | Không (chỉ topic/partition) | Mạnh (topic/fanout/headers exchange, priority, per-message TTL) | Cơ bản |
| Vận hành | Nặng (cluster, tuning) — trừ khi dùng managed (MSK/Confluent) | Trung bình | Zero ops |

**Chọn thế nào (chuẩn phỏng vấn):**
- **Kafka:** throughput rất lớn, cần replay/giữ event lâu, nhiều consumer độc lập cùng đọc một luồng dữ liệu, event-driven architecture, stream processing.
- **RabbitMQ:** task queue cổ điển (gửi email, resize ảnh), cần routing phức tạp, per-message ack/retry/priority/delay, throughput vừa phải.
- **SQS:** đang ở AWS, muốn zero ops, cần queue đơn giản đáng tin cậy; ghép SNS để fanout.
- Câu chốt: *"Kafka là sổ ghi chép sự kiện cho nhiều người đọc lại; RabbitMQ/SQS là hòm thư giao việc — việc xong thì thư biến mất."*

#### 3. Kiến trúc: Broker, Topic, Partition, Offset, Segment

- **Broker:** một server Kafka; cluster gồm nhiều broker. Metadata/điều phối do ZooKeeper (cũ) hoặc **KRaft** (Kafka 3.x+, không cần ZooKeeper) quản lý.
- **Topic:** kênh logic chứa message (vd `orders.created`).
- **Partition:** topic chia thành N partition — **đơn vị song song hoá và scale**. Mỗi partition là một log **append-only, có thứ tự** nằm trên một broker (leader) + bản sao trên broker khác (follower). Số partition quyết định số consumer tối đa chạy song song trong một group.
- **Offset:** số thứ tự tăng dần của message **trong một partition**. Consumer tự lưu "đã đọc đến offset nào" (vào topic nội bộ `__consumer_offsets`). Offset chỉ có ý nghĩa trong phạm vi một partition.
- **Segment:** mỗi partition trên disk chia thành các file segment (vd 1GB/segment) + index file. Kafka ghi **tuần tự** vào segment cuối (sequential disk I/O nhanh gần bằng RAM) và xoá retention bằng cách **drop nguyên segment cũ** — rẻ hơn xoá từng message. Đọc nhanh nhờ **zero-copy** (sendfile) và page cache của OS.

```
Topic "orders" (3 partitions):
P0: [0][1][2][3][4][5] →   (key=user-A luôn vào P0 → có thứ tự)
P1: [0][1][2][3] →
P2: [0][1][2][3][4] →
```

**Message** gồm: key (quyết định partition), value, headers, timestamp. Cùng key → cùng partition → **giữ thứ tự**.

```js
// kafkajs — setup cơ bản
const { Kafka } = require('kafkajs');
const kafka = new Kafka({
  clientId: 'order-service',
  brokers: ['localhost:9092'],
  retry: { initialRetryTime: 300, retries: 8 }
});
```

### Ngày 3-4: Producer, Consumer Group, Delivery Semantics & Replication

#### 1. Producer

```js
const producer = kafka.producer({
  idempotent: true,                 // bật idempotent producer (kéo theo acks: -1)
  maxInFlightRequests: 5
});
await producer.connect();
await producer.send({
  topic: 'orders.created',
  messages: [{
    key: order.userId,              // cùng user → cùng partition → giữ thứ tự
    value: JSON.stringify(order),
    headers: { 'correlation-id': reqId }
  }],
  acks: -1,                         // -1 = all
  compression: CompressionTypes.GZIP
});
```

**acks — write được coi là thành công khi nào:**
- `acks=0`: không chờ ai — nhanh nhất, mất message khi broker lỗi (metrics, log không quan trọng).
- `acks=1`: leader ghi xong là ack — leader chết trước khi replicate thì mất (cân bằng).
- `acks=all (-1)`: chờ **mọi replica trong ISR** ghi xong — bền nhất, kết hợp `min.insync.replicas=2` thành "chuẩn không mất message".

**Idempotent producer:** retry của producer có thể gây **duplicate** (gửi thành công nhưng ack bị mất trên đường về → producer gửi lại). Bật `enable.idempotence=true`: mỗi producer có PID + sequence number per partition, broker phát hiện và loại bản trùng → **exactly-once trong phạm vi 1 partition, 1 producer session**. Gần như miễn phí, production nên luôn bật.

**Batching & Compression:** producer gom message thành batch theo `batch.size` và `linger.ms` (chờ thêm vài ms cho đầy batch) → throughput tăng vọt, đổi lấy chút latency. Compression (lz4/snappy/zstd phổ biến, gzip nén sâu nhưng tốn CPU) áp dụng theo batch — batch càng lớn nén càng hiệu quả.

**Partitioner:** message có key → `hash(key) % numPartitions`; không key → round-robin/sticky (gom theo batch). Có thể tự viết partitioner. **Cảnh báo:** tăng số partition làm `hash(key) % N` đổi kết quả → key cũ sang partition mới → **vỡ ordering theo key** trong giai đoạn chuyển tiếp.

#### 2. Consumer & Consumer Group

```js
const consumer = kafka.consumer({ groupId: 'email-service' });
await consumer.connect();
await consumer.subscribe({ topic: 'orders.created', fromBeginning: false });

await consumer.run({
  eachMessage: async ({ topic, partition, message, heartbeat }) => {
    const order = JSON.parse(message.value.toString());
    await sendEmail(order);          // xử lý
    // kafkajs tự commit offset định kỳ (autoCommit mặc định)
  }
});
```

- **Consumer group:** các consumer cùng `groupId` **chia nhau** partition — mỗi partition chỉ giao cho đúng 1 consumer trong group (1 consumer có thể giữ nhiều partition). Nhiều group khác nhau đọc cùng topic **độc lập** (mỗi group có offset riêng) — đây là cách 1 event `orders.created` vừa đến email-service vừa đến inventory-service.
- **Số consumer > số partition → consumer thừa ngồi không.** Muốn scale consumer phải tăng partition (quyết định từ đầu cho khéo).
- **Rebalancing:** consumer vào/ra group (deploy, crash, miss heartbeat, xử lý quá `max.poll.interval.ms`) → Kafka chia lại partition. Trong lúc rebalance kiểu eager, **cả group dừng xử lý** (stop-the-world); cooperative/incremental rebalancing (mới hơn) chỉ di chuyển partition cần thiết. Static membership (`group.instance.id`) giúp restart nhanh không gây rebalance.
- **Offset commit:** auto-commit theo chu kỳ tiện nhưng nguy hiểm — có thể commit offset của message **chưa xử lý xong** (crash → mất message) hoặc xử lý xong chưa kịp commit (crash → xử lý lại). Cần kiểm soát chặt thì commit thủ công sau khi xử lý xong:

```js
const consumer = kafka.consumer({ groupId: 'email-service' });
await consumer.run({
  autoCommit: false,
  eachMessage: async ({ topic, partition, message }) => {
    await handle(message);                                    // xử lý XONG trước
    await consumer.commitOffsets([{
      topic, partition, offset: (Number(message.offset) + 1).toString()  // commit offset + 1
    }]);
  }
});
```

#### 3. Delivery Semantics

- **At-most-once:** commit offset **trước** khi xử lý → crash giữa chừng là mất message, không bao giờ duplicate. Hiếm khi muốn.
- **At-least-once (mặc định thực tế):** xử lý xong **mới** commit → crash trước commit thì message được xử lý lại → **có thể duplicate**. Hệ quả bắt buộc: **consumer phải idempotent** (xem phần xử lý lỗi).
- **Exactly-once (EOS):** trong phạm vi Kafka→Kafka (consume–process–produce), dùng **transactions**: idempotent producer + transactional.id, gửi message và commit offset trong **cùng một transaction**, consumer phía sau đặt `isolation.level=read_committed`.

```js
// kafkajs transaction (consume-process-produce)
const producer = kafka.producer({ transactionalId: 'order-tx-1', idempotent: true });
const tx = await producer.transaction();
try {
  await tx.send({ topic: 'orders.enriched', messages: [...] });
  await tx.sendOffsets({ consumerGroupId: 'enricher', topics: [...] }); // offset trong cùng tx
  await tx.commit();
} catch (e) { await tx.abort(); }
```

**Lưu ý phỏng vấn quan trọng:** exactly-once của Kafka **không vươn ra ngoài Kafka** (ghi DB, gọi API, gửi email). Với side effect bên ngoài, thực tế là **at-least-once + idempotent consumer** — câu này thể hiện bạn hiểu thật.

#### 4. Replication: Leader/Follower, ISR, min.insync.replicas

- Mỗi partition có `replication.factor` bản (thường 3): 1 **leader** (nhận mọi read/write) + các **follower** (kéo dữ liệu từ leader).
- **ISR (In-Sync Replicas):** tập replica đang bám kịp leader. Follower tụt quá `replica.lag.time.max.ms` bị loại khỏi ISR.
- Leader chết → controller chọn leader mới **từ ISR** → không mất dữ liệu đã ack. (`unclean.leader.election.enable=false` để cấm bầu replica ngoài ISR — thà mất availability còn hơn mất data.)
- **Bộ ba chống mất message:** `replication.factor=3` + `acks=all` + `min.insync.replicas=2`. Nếu ISR tụt xuống dưới 2, producer với acks=all sẽ bị **từ chối ghi** (`NotEnoughReplicas`) — hệ chọn consistency thay vì âm thầm mất dữ liệu.

#### 5. Retention & Compaction

- **Delete policy (mặc định):** xoá segment cũ theo `retention.ms` (7 ngày) hoặc `retention.bytes` — bất kể đã được consume hay chưa.
- **Compact policy:** giữ **bản ghi mới nhất cho mỗi key**, xoá các bản cũ hơn của cùng key; message value=null là **tombstone** (xoá key). Dùng cho topic dạng "trạng thái mới nhất": bảng user-profile, giá sản phẩm, `__consumer_offsets` chính là compacted topic. Có thể kết hợp `compact,delete`.

### Ngày 5-6: Ordering, xử lý lỗi, monitoring & Kafka trong Microservices

#### 1. Ordering Guarantees

- Kafka **chỉ đảm bảo thứ tự trong một partition** — không có thứ tự toàn topic.
- Muốn các event của một thực thể (user, order) có thứ tự → dùng **id thực thể làm message key** → cùng key vào cùng partition.
- Cạm bẫy phá ordering: (1) retry với `max.in.flight > 1` khi **không bật** idempotence (batch sau thành công trước batch retry) — bật idempotence là hết; (2) **tăng số partition** làm key đổi partition; (3) consumer xử lý song song nhiều message một partition trong app (vd gom batch rồi `Promise.all`).
- Hot partition: một key quá nóng (1 khách hàng khổng lồ) dồn vào 1 partition → consumer đó quá tải; cân nhắc key composite hoặc xử lý riêng.

#### 2. Xử lý lỗi: Retry, DLQ, Poison Message

- **Poison message:** message lỗi vĩnh viễn (JSON hỏng, dữ liệu vi phạm logic) — retry mãi không thoát. Vì offset commit tuần tự, một poison message có thể **chặn cả partition** (head-of-line blocking) nếu cứ retry tại chỗ.
- **Chiến lược chuẩn:** phân loại lỗi *transient* (DB timeout, mạng) vs *permanent* (parse error). Transient → retry có giới hạn + exponential backoff. Permanent hoặc hết lượt retry → đẩy sang **DLQ** (topic `orders.created.dlq`, kèm header lý do lỗi + offset gốc) rồi commit để dòng chảy tiếp tục. DLQ có alert + tool reprocess sau khi fix bug.
- **Retry topic pattern** (kiểu Uber): các topic `orders.retry.1m`, `orders.retry.10m`... — lỗi thì đẩy sang retry topic kèm delay, hết các tầng retry thì vào DLQ. Tránh block partition chính, đổi lại **mất ordering** cho các message bị retry — phải cân nhắc theo nghiệp vụ.

```js
await consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    try {
      await handleWithRetry(message, { retries: 3, backoff: 'exponential' });
    } catch (err) {
      await dlqProducer.send({
        topic: `${topic}.dlq`,
        messages: [{
          key: message.key, value: message.value,
          headers: { ...message.headers,
            'x-error': err.message, 'x-original-offset': message.offset,
            'x-original-partition': String(partition), 'x-failed-at': new Date().toISOString() }
        }]
      });
      // không throw → kafkajs coi như xử lý xong → commit, partition không bị kẹt
    }
  }
});
```

- **Idempotent consumer** (bắt buộc với at-least-once): xử lý phải an toàn khi lặp lại. Cách làm: lưu `eventId` đã xử lý vào bảng `processed_events` (unique constraint) **trong cùng transaction DB** với nghiệp vụ; hoặc thao tác tự nhiên idempotent (UPSERT, `SET status='paid'` thay vì `balance += x`).

#### 3. Consumer Lag & Monitoring

- **Consumer lag** = (log end offset của partition) − (committed offset của group) — số message đang chờ xử lý. Lag tăng đều = consumer xử lý không kịp tốc độ produce → user nhận email trễ 2 tiếng, dashboard sai số liệu.
- Theo dõi: `kafka-consumer-groups.sh --describe --group email-service`, exporter (Burrow, kafka-lag-exporter) + Prometheus/Grafana, alert khi lag vượt ngưỡng hoặc tăng liên tục.
- Xử lý lag: tối ưu handler (thường nghẽn ở DB/HTTP call chứ không phải Kafka), tăng consumer (≤ số partition), tăng partition, batch processing (`eachBatch` trong kafkajs), tách việc nặng ra chỗ khác.
- Ngoài lag, theo dõi thêm: rebalance frequency, ISR shrink, request latency của broker, disk usage.

#### 4. Schema Registry & Avro (khái niệm)

- Vấn đề: producer đổi format JSON (đổi tên field) → consumer vỡ âm thầm lúc runtime. 
- **Schema Registry** lưu schema theo version cho mỗi topic; message chỉ chứa schema ID + payload nhị phân (**Avro**/Protobuf — nhỏ hơn JSON đáng kể). Registry **chặn ngay từ lúc produce** các thay đổi vi phạm quy tắc tương thích:
  - *Backward compatibility:* consumer mới đọc được message cũ (thêm field mới phải có default).
  - *Forward compatibility:* consumer cũ đọc được message mới.
- Node.js dùng `@kafkajs/confluent-schema-registry` để encode/decode. Mức khái niệm này là đủ cho phỏng vấn backend.

#### 5. Kafka trong Microservices

**Event-driven architecture:** thay vì order-service gọi HTTP đồng bộ sang email/inventory/analytics (coupling chặt, một service chết kéo cả chuỗi), order-service chỉ **publish** `OrderCreated`; các service khác tự subscribe. Lợi: loose coupling, thêm consumer mới không sửa producer, chịu lỗi tốt (consumer chết thì message chờ sẵn). Giá phải trả: **eventual consistency**, debug khó hơn (cần correlation id + distributed tracing).

Phân biệt nhanh: **Event notification** (event mỏng, chỉ id — consumer gọi lại API lấy chi tiết) vs **Event-carried state transfer** (event chứa đủ dữ liệu — consumer không cần gọi lại).

**Event sourcing:** không lưu trạng thái hiện tại mà lưu **chuỗi event bất biến** (`OrderCreated`, `OrderPaid`, `OrderShipped`); trạng thái = replay events. Được audit trail trọn vẹn, time-travel debug; đổi lại phức tạp (snapshot, versioning event, thường đi kèm CQRS). Lưu ý trung thực khi phỏng vấn: Kafka thường làm **transport/log** trong kiến trúc event sourcing, dùng Kafka làm event store chính thống có nhiều tranh luận (query theo aggregate khó).

**Outbox pattern — câu hỏi rất hay gặp:** Làm sao ghi DB và publish Kafka **atomic**? Ghi DB xong publish lỗi → hệ thống lệch nhau; publish trước ghi DB lỗi → cũng lệch. Two-phase commit không khả thi với Kafka.

```
1. Trong MỘT transaction DB:
   INSERT INTO orders (...);
   INSERT INTO outbox (event_id, aggregate_id, type, payload) VALUES (...);
   COMMIT;  -- atomic: hoặc cả hai, hoặc không gì cả
2. Relay process: đọc bảng outbox → publish Kafka → đánh dấu đã gửi
   (polling đơn giản, hoặc CDC bằng Debezium đọc WAL/binlog — không sót, không poll)
3. Relay là at-least-once → có thể publish trùng → consumer idempotent theo event_id
```

```js
// Outbox với pg — phía ghi
await client.query('BEGIN');
const { rows: [order] } = await client.query(
  'INSERT INTO orders(user_id, total) VALUES($1,$2) RETURNING *', [userId, total]);
await client.query(
  `INSERT INTO outbox(event_id, aggregate_id, type, payload)
   VALUES(gen_random_uuid(), $1, 'OrderCreated', $2)`,
  [order.id, JSON.stringify(order)]);
await client.query('COMMIT');
```

## 💬 Top 15 câu hỏi phỏng vấn thường gặp

**Q1: Kafka khác RabbitMQ ở điểm cốt lõi nào? Khi nào chọn gì?**
**A:** Kafka là distributed log: message giữ lại theo retention, consumer pull và tự quản offset, nhiều group đọc độc lập, replay được — hợp event streaming throughput lớn. RabbitMQ là smart broker push: routing phong phú, ack/xoá từng message — hợp task queue và routing phức tạp. Cần replay + nhiều consumer độc lập + throughput lớn → Kafka; cần giao việc với retry/priority/delay từng message → RabbitMQ.

**Q2: Partition là gì và tại sao quan trọng?**
**A:** Partition là đơn vị song song hoá: mỗi partition là log có thứ tự, được giao cho đúng 1 consumer trong group. Số partition quyết định mức scale tối đa của consumer group và là ranh giới của ordering guarantee. Chọn ít quá thì nghẽn, nhiều quá thì tốn tài nguyên broker và rebalance chậm.

**Q3: Kafka đảm bảo ordering thế nào?**
**A:** Chỉ trong một partition. Muốn các event của một thực thể có thứ tự thì dùng id thực thể làm key — cùng key vào cùng partition. Lưu ý các thứ phá ordering: retry không bật idempotence với max.in.flight>1, và tăng số partition làm key đổi chỗ.

**Q4: acks=0/1/all khác nhau gì?**
**A:** acks=0 không chờ xác nhận (nhanh, có thể mất); acks=1 chờ leader ghi xong (leader chết trước khi replicate thì mất); acks=all chờ mọi replica trong ISR. Chuẩn chống mất message: acks=all + replication.factor=3 + min.insync.replicas=2.

**Q5: Idempotent producer giải quyết vấn đề gì?**
**A:** Retry của producer có thể tạo duplicate (broker nhận rồi nhưng ack thất lạc → gửi lại). Bật idempotence, mỗi message mang PID + sequence number để broker loại bản trùng → exactly-once trong phạm vi một partition/session, gần như không tốn thêm gì nên production nên luôn bật.

**Q6: Consumer group hoạt động thế nào?**
**A:** Các consumer cùng groupId chia nhau partition — mỗi partition chỉ thuộc 1 consumer trong group; group khác đọc cùng topic với offset độc lập. Consumer nhiều hơn partition thì phần thừa ngồi không. Đây là cơ chế vừa scale (trong group) vừa fanout (giữa các group).

**Q7: Rebalancing là gì, khi nào xảy ra, có hại gì?**
**A:** Là việc chia lại partition khi thành viên group thay đổi (deploy, crash, miss heartbeat, xử lý lâu quá max.poll.interval.ms). Eager rebalance dừng cả group (stop-the-world) và có thể gây xử lý lặp. Giảm tác hại bằng cooperative rebalancing, static membership, và đảm bảo handler không vượt poll interval.

**Q8: At-least-once vs exactly-once — thực tế dùng gì?**
**A:** Mặc định thực tế là at-least-once (xử lý xong mới commit offset) kèm duplicate khi crash. Exactly-once của Kafka chỉ áp dụng cho chuỗi Kafka→Kafka qua transactions; với side effect ngoài Kafka (DB, email) thì không có phép màu — giải pháp thực tế là at-least-once + idempotent consumer (dedupe theo eventId).

**Q9: Làm consumer idempotent bằng cách nào?**
**A:** Lưu eventId đã xử lý vào bảng processed_events với unique constraint, trong cùng transaction DB với nghiệp vụ — gặp lại thì bỏ qua. Hoặc thiết kế thao tác tự nhiên idempotent: UPSERT, set trạng thái tuyệt đối thay vì cộng dồn.

**Q10: ISR và min.insync.replicas có ý nghĩa gì?**
**A:** ISR là tập replica đang bám kịp leader; failover chỉ bầu leader từ ISR nên không mất dữ liệu đã ack. min.insync.replicas=2 + acks=all nghĩa là write chỉ thành công khi ít nhất 2 replica có message; nếu ISR tụt dưới 2, broker từ chối ghi — chọn consistency thay vì âm thầm mất data.

**Q11: Log compaction khác retention delete thế nào, dùng khi nào?**
**A:** Delete xoá segment cũ theo thời gian/dung lượng bất kể key. Compaction giữ giá trị mới nhất cho mỗi key (value null là tombstone để xoá key) — dùng cho topic mang "trạng thái mới nhất" như user profile, bảng giá, __consumer_offsets, hoặc làm nguồn rebuild state.

**Q12: Poison message là gì, xử lý sao để không chặn partition?**
**A:** Message lỗi vĩnh viễn, retry mãi không thoát, gây head-of-line blocking cả partition. Xử lý: phân loại lỗi — transient thì retry có giới hạn + backoff, permanent hoặc hết lượt thì đẩy sang DLQ kèm metadata lỗi rồi commit offset cho dòng chảy đi tiếp; DLQ có alert và quy trình reprocess.

**Q13: Consumer lag là gì, xử lý thế nào khi lag tăng?**
**A:** Lag = log end offset trừ committed offset — số message tồn chưa xử lý. Lag tăng đều nghĩa là consume chậm hơn produce. Xử lý: tối ưu handler (thường nghẽn ở DB/external call), thêm consumer đến tối đa bằng số partition, tăng partition, xử lý theo batch; monitor bằng kafka-lag-exporter + alert.

**Q14: Outbox pattern giải quyết vấn đề gì và hoạt động ra sao?**
**A:** Giải bài toán dual-write: ghi DB và publish Kafka không thể atomic. Ghi event vào bảng outbox trong cùng transaction với nghiệp vụ; relay (polling hoặc Debezium CDC) đọc outbox và publish sau. Relay là at-least-once nên consumer vẫn phải idempotent theo eventId.

**Q15: Schema Registry dùng để làm gì?**
**A:** Quản lý schema (Avro/Protobuf) theo version cho từng topic và enforce quy tắc tương thích (backward/forward) ngay lúc produce — chặn việc đổi format làm vỡ consumer âm thầm. Message chỉ mang schema ID + payload nhị phân nên nhỏ hơn JSON, decode an toàn theo đúng version.

## 💪 Bài tập thực hành (bắt buộc)

### Bài 1: Producer/Consumer đầu tiên + quan sát partition (cơ bản)
**Đề:** Dựng Kafka bằng Docker Compose (1 broker KRaft là đủ). Tạo topic `orders.created` với **3 partition**. Viết producer Node.js (kafkajs) gửi 30 order cho 5 userId (key = userId); consumer in ra `partition / offset / key / value`.
**Yêu cầu output:** Log chứng minh: cùng userId luôn vào cùng partition; offset tăng dần trong từng partition. Chạy lại producer **không key** và chỉ ra message rải đều các partition.
**Gợi ý:** dùng image `bitnami/kafka` hoặc `confluentinc/cp-kafka`; tạo topic bằng `kafka-topics.sh --create --partitions 3` hoặc `admin.createTopics()` của kafkajs.

### Bài 2: Consumer group scaling & rebalancing (cơ bản–trung bình)
**Đề:** Với topic 3 partition ở bài 1: chạy lần lượt 1 → 2 → 3 → 4 consumer cùng `groupId` (4 terminal hoặc 4 process). Sau đó chạy thêm 1 consumer với `groupId` khác. Producer bắn đều 5 msg/s trong suốt thí nghiệm.
**Yêu cầu output:** Bảng ghi nhận: với mỗi số lượng consumer, consumer nào giữ partition nào (log từ `consumer.on(consumer.events.GROUP_JOIN)`); chứng minh consumer thứ 4 ngồi không; chứng minh group thứ hai nhận **toàn bộ** message độc lập; mô tả hiện tượng khi kill 1 consumer (rebalance mất bao lâu, partition về tay ai).
**Gợi ý:** đặt `clientId` khác nhau cho dễ đọc log; bật log level INFO của kafkajs để thấy member assignment.

### Bài 3: At-least-once + idempotent consumer (trung bình)
**Đề:** Consumer ghi order vào PostgreSQL. Cấu hình `autoCommit: false`, commit thủ công sau khi ghi DB. Mô phỏng crash: handler `process.exit(1)` ngẫu nhiên 10% **sau khi ghi DB nhưng trước khi commit offset** (dùng biến env bật/tắt). Chạy supervisor tự restart (nodemon/`while true`). Bước 2: thêm bảng `processed_events(event_id unique)` và dedupe trong cùng transaction.
**Yêu cầu output:** Bắn 1.000 message (mỗi message có `eventId` UUID). Trước khi có dedupe: bảng orders có **> 1.000 dòng** (chứng minh duplicate của at-least-once bằng số liệu cụ thể). Sau khi thêm dedupe: đúng 1.000 dòng dù crash bao nhiêu lần.
**Gợi ý:** `INSERT ... ON CONFLICT (event_id) DO NOTHING` + check rowCount, hoặc bảng processed_events riêng trong cùng `BEGIN/COMMIT`.

### Bài 4: Retry + DLQ + poison message (trung bình–khó)
**Đề:** Consumer xử lý payment: message có `amount < 0` là poison (lỗi vĩnh viễn); ngoài ra mô phỏng lỗi transient 20% (random throw). Cài: retry tối đa 3 lần với exponential backoff cho transient; poison hoặc hết retry → publish sang `payments.dlq` kèm headers (`x-error`, `x-original-offset`, `x-retry-count`) rồi commit. Viết thêm script `reprocess-dlq.js` đọc DLQ và bơm lại topic chính.
**Yêu cầu output:** Bắn 100 message trong đó 5 poison: topic chính xử lý xong 95, DLQ chứa đúng 5, **partition không bị kẹt** (95 message sau poison vẫn được xử lý — chứng minh bằng log thứ tự). Chạy reprocess sau khi "fix bug" (bỏ check amount âm) → DLQ về 0.
**Gợi ý:** retry tại chỗ trong handler bằng vòng lặp + sleep backoff; phân biệt lỗi bằng custom error class `PermanentError` vs `TransientError`.

### Bài 5: Outbox pattern end-to-end (khó — chuẩn bị cho bài test)
**Đề:** Xây 2 service: `order-service` (Express + Postgres) nhận `POST /orders`, ghi bảng `orders` + bảng `outbox` trong **một transaction**; relay process poll outbox mỗi 500ms (`SELECT ... WHERE published = false ORDER BY id LIMIT 100 FOR UPDATE SKIP LOCKED`), publish Kafka rồi update `published = true`; `notification-service` consume và "gửi email" (log), idempotent theo `event_id`.
**Yêu cầu output:** Test 1: tắt Kafka, gọi `POST /orders` → order vẫn tạo thành công (201), outbox tồn message; bật Kafka lại → relay tự đẩy hết, notification nhận đủ. Test 2: kill relay ngay sau khi publish nhưng trước khi update `published` → restart relay gửi trùng → notification-service log "duplicated, skipped" nhờ dedupe. Đếm cuối cùng: số order = số email gửi (không thiếu, không thừa).
**Gợi ý:** `FOR UPDATE SKIP LOCKED` cho phép chạy nhiều relay không giẫm chân nhau; event_id sinh bằng `gen_random_uuid()` ngay trong INSERT outbox.

## 📝 Bài test cuối tuần

### Phần 1: Quiz 15 câu trắc nghiệm

**Câu 1:** Khác biệt cốt lõi giữa Kafka và message queue truyền thống (RabbitMQ)?
A. Kafka không hỗ trợ nhiều consumer  B. Message trong Kafka được giữ theo retention và replay được, consumer tự quản offset  C. Kafka chỉ chạy trên cloud  D. Kafka push message tới consumer

**Câu 2:** Kafka đảm bảo thứ tự message ở phạm vi nào?
A. Toàn cluster  B. Toàn topic  C. Trong một partition  D. Trong một consumer group

**Câu 3:** Muốn mọi event của cùng một order được xử lý đúng thứ tự, làm gì?
A. Dùng 1 partition cho cả topic  B. Dùng orderId làm message key  C. Sort lại ở consumer  D. Tăng replication factor

**Câu 4:** acks=1 có rủi ro gì?
A. Chậm nhất trong 3 mức  B. Leader ack xong nhưng chết trước khi replicate → mất message  C. Luôn tạo duplicate  D. Không gửi được message lớn

**Câu 5:** Cấu hình "chuẩn chống mất message" là?
A. acks=0 + replication.factor=3  B. acks=1 + min.insync.replicas=1  C. acks=all + replication.factor=3 + min.insync.replicas=2  D. acks=all + replication.factor=1

**Câu 6:** Idempotent producer hoạt động nhờ?
A. Consumer tự lọc trùng  B. PID + sequence number per partition để broker loại bản trùng khi retry  C. Hash toàn bộ message  D. Lưu message vào DB trước khi gửi

**Câu 7:** Group có 4 consumer, topic có 3 partition. Điều gì xảy ra?
A. Lỗi cấu hình  B. 1 consumer ngồi không (idle)  C. 2 consumer chia nhau 1 partition  D. Kafka tự tăng partition lên 4

**Câu 8:** Auto-commit offset có rủi ro gì?
A. Không có rủi ro  B. Có thể commit offset của message chưa xử lý xong → crash là mất message  C. Làm tăng replication  D. Chặn rebalancing

**Câu 9:** Xử lý xong message rồi mới commit offset, crash ngay trước khi commit. Kết quả?
A. Message bị mất  B. Message được xử lý lại (duplicate) — đây là at-least-once  C. Partition bị khoá  D. Kafka tự phát hiện và bỏ qua

**Câu 10:** Exactly-once semantics của Kafka transactions áp dụng trọn vẹn cho trường hợp nào?
A. Consumer ghi vào PostgreSQL  B. Consumer gửi email  C. Chuỗi consume–process–produce giữa các topic Kafka  D. Mọi hệ thống bên ngoài

**Câu 11:** Log compaction giữ lại gì?
A. Message trong 7 ngày gần nhất  B. Bản ghi mới nhất cho mỗi key  C. Message chưa được consume  D. Message có size nhỏ

**Câu 12:** Poison message gây hại chính là gì nếu chỉ retry tại chỗ vô hạn?
A. Tốn disk  B. Head-of-line blocking — chặn mọi message phía sau trong partition  C. Làm broker crash  D. Mất ordering

**Câu 13:** Consumer lag được tính bằng?
A. Thời gian xử lý 1 message  B. Log end offset − committed offset của group  C. Số partition − số consumer  D. Số message trong DLQ

**Câu 14:** Outbox pattern giải quyết vấn đề gì?
A. Consumer chậm  B. Dual-write: ghi DB và publish Kafka không atomic — gom vào 1 transaction DB rồi relay publish sau  C. Message quá lớn  D. Thiếu partition

**Câu 15:** Backward compatibility trong Schema Registry nghĩa là?
A. Producer cũ gửi được vào topic mới  B. Consumer dùng schema mới đọc được message ghi bằng schema cũ  C. Broker cũ chạy được client mới  D. Topic đổi tên không ảnh hưởng consumer

<details><summary>Đáp án</summary>

1. **B** — Kafka là commit log: không xoá khi consume, nhiều group đọc độc lập, replay theo offset.
2. **C** — ordering chỉ tồn tại trong partition; toàn topic không có thứ tự tổng.
3. **B** — cùng key → cùng partition → tuần tự; dùng 1 partition (A) đúng về lý thuyết nhưng giết scalability.
4. **B** — chỉ leader xác nhận; follower chưa kịp kéo mà leader chết là mất dữ liệu đã ack.
5. **C** — bộ ba kinh điển; min.insync.replicas=2 đảm bảo ít nhất 2 bản trước khi ack.
6. **B** — broker so sequence number để phát hiện bản gửi lại do retry.
7. **B** — mỗi partition chỉ giao cho 1 consumer trong group; thừa thì idle (dự phòng nóng).
8. **B** — auto-commit theo chu kỳ, không gắn với việc xử lý xong hay chưa.
9. **B** — định nghĩa at-least-once; vì vậy consumer phải idempotent.
10. **C** — transaction gom send + sendOffsets; side effect ngoài Kafka không nằm trong transaction.
11. **B** — compaction theo key, tombstone (value null) để xoá key.
12. **B** — offset tuần tự nên message hỏng đứng đầu chặn cả hàng; giải bằng DLQ.
13. **B** — lag = số message đã ghi nhưng group chưa xử lý/commit.
14. **B** — bảng outbox cùng transaction với nghiệp vụ, relay đảm bảo publish (at-least-once).
15. **B** — schema mới đọc được data cũ; điều kiện điển hình: field mới phải có default.

</details>

### Phần 2: Bài thực hành chấm điểm

**Đề bài: Hệ thống xử lý đơn hàng event-driven hoàn chỉnh**

Xây 3 service Node.js (kafkajs) + Postgres + Kafka (Docker Compose):
1. **order-service:** `POST /orders` → ghi `orders` + `outbox` trong 1 transaction; relay (poll hoặc tích hợp trong service) publish `OrderCreated` (key = orderId, value có `eventId`).
2. **inventory-service:** consume `OrderCreated`, trừ kho trong Postgres (idempotent theo eventId), thành công → publish `InventoryReserved`, hết hàng → publish `OrderRejected`. Lỗi transient (giả lập 15%) retry 3 lần backoff; lỗi vĩnh viễn → `inventory.dlq`.
3. **notification-service:** consumer group riêng, consume cả `InventoryReserved` lẫn `OrderRejected`, log "email" (idempotent).
4. Script `loadtest.js`: bắn 500 đơn (50 đơn vượt tồn kho), trong lúc chạy **kill -9 inventory-service** một lần rồi restart.
5. Script `lag-report.js`: dùng `admin.fetchOffsets` + `fetchTopicOffsets` in consumer lag của từng group.

Kết quả phải nghiệm thu được: tổng (reserved + rejected) = 500, kho không âm, không đơn nào xử lý 2 lần (dù đã kill consumer), DLQ chứa đúng các message lỗi vĩnh viễn, lag về 0 sau khi chạy xong.

**Checklist tiêu chí chấm điểm:**

- [ ] Outbox đúng: tắt Kafka vẫn tạo được order, bật lại tự đẩy đủ — không dùng dual-write trần
- [ ] Producer cấu hình đúng: idempotent, acks=all, key = orderId (giải thích được vì sao chọn key này)
- [ ] Consumer commit offset thủ công sau khi xử lý xong (hoặc giải thích rõ chiến lược autoCommit đã chọn và rủi ro)
- [ ] Idempotent consumer bằng eventId + unique constraint trong cùng transaction DB — pass test kill -9
- [ ] Phân loại lỗi transient/permanent, retry có backoff, DLQ kèm headers metadata, partition không bị block
- [ ] Trừ kho atomic không oversell (conditional update, kiểm tra rowCount)
- [ ] Hai consumer group độc lập hoạt động đúng (notification nhận đủ event dù inventory chậm)
- [ ] Lag report chạy được và lag về 0; có graceful shutdown (consumer.disconnect khi SIGTERM)
- [ ] Trả lời vấn đáp: điều gì xảy ra nếu tăng partition của `OrderCreated` từ 3 lên 6? Nếu relay publish trùng thì sao?

## ✅ Tiêu chí pass tuần

- Quiz ≥ 12/15
- Hoàn thành tất cả bài tập bắt buộc (bài 3 phải có số liệu duplicate trước/sau dedupe; bài 5 phải pass cả 2 test)
- Bài thực hành đạt ≥ 7/9 mục checklist, trong đó outbox + idempotent consumer là **bắt buộc**
- Vẽ lại được từ trí nhớ sơ đồ: topic/partition/consumer group, luồng outbox pattern, và luồng retry→DLQ; giải thích miệng delivery semantics trong 3 phút không nhìn tài liệu
