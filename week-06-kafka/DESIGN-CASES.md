# Tuần 6 — Thiết kế hệ thống & Case thực tế: Kafka

> Tài liệu bổ trợ cho README.md cùng thư mục. Học sau khi xong phần lý thuyết.

## 🏗️ Mini System Design (scoped vào chủ đề tuần)

### Bài 1: Event pipeline cho hệ thống đơn hàng

**Đề bài:**
Sàn TMĐT tách microservices: `order-service` phát sự kiện cho `inventory`, `payment`, `notification`, `analytics` tiêu thụ.
- 2M orders/ngày, peak 500 orders/s; mỗi order phát ~6 events trong vòng đời (created → confirmed → paid → packed → shipped → delivered) → peak ~3K events/s.
- Event size trung bình 2KB.
- Ràng buộc cứng: events của **cùng một order phải được xử lý đúng thứ tự** (không được thấy `paid` trước `created`).
- Analytics muốn replay 7 ngày dữ liệu khi đổi logic.
Thiết kế: bao nhiêu topic, đặt tên thế nào, bao nhiêu partition, key theo gì.

**Phân tích & lời giải:**

**Bước 1 — Bao nhiêu topic? Một topic `orders` hay sáu topic theo từng status?**

Chọn **một topic `orders` chứa mọi event trong vòng đời**, phân biệt bằng field `eventType`. Lý do quyết định: **Kafka chỉ đảm bảo ordering trong một partition của một topic**. Nếu tách `order-created`, `order-paid` thành 2 topic, consumer không có cách nào rẻ để biết `created` đã đến trước `paid` cho cùng order — mất luôn ràng buộc cứng của đề. Quy tắc phát biểu được trong phỏng vấn: *"những event cần ordering với nhau phải nằm cùng topic, cùng key"*.

Tách topic khi: domain khác nhau (`payments` riêng vì schema/đội sở hữu/retention khác), hoặc throughput chênh lệch quá lớn, hoặc yêu cầu retention/ACL khác nhau.

```
Naming convention (chọn một và nhất quán):
  <domain>.<entity>.<version>     →  commerce.orders.v1
  Kèm: commerce.orders.v1.retry.5m / .retry.30m / .dlq (bài 3 sẽ dùng)
```

**Bước 2 — Key theo gì?**

```js
// Producer (KafkaJS)
await producer.send({
  topic: "commerce.orders.v1",
  messages: [{
    key: order.id,                      // ⇐ toàn bộ ordering nằm ở dòng này
    value: JSON.stringify({
      eventId: uuid(),                  // cho idempotency phía consumer
      eventType: "order.paid",
      version: 4,                       // sequence trong vòng đời order
      occurredAt: new Date().toISOString(),
      payload: { ... }
    })
  }]
});
```

`key = orderId` → mọi event của 1 order hash vào đúng 1 partition → ordering per-order được đảm bảo, trong khi các order khác nhau vẫn song song trên các partition khác. Key theo `userId` cũng giữ được ordering per-order (order thuộc 1 user) nhưng tạo skew nếu có user/đại lý đặt cực nhiều — `orderId` phân bố đều hơn. Tuyệt đối không để key = null (round-robin) — vỡ ordering ngay.

**Bước 3 — Bao nhiêu partition? Công thức tính**

```
P = max( ceil(T_target / T_producer_per_partition),
         ceil(T_target / T_consumer_per_partition),
         max_parallelism_cần_cho_consumer_chậm_nhất )
```

Áp số:
- Throughput đích: 3K events/s × 2KB = 6MB/s — về byte là muỗi với Kafka (1 partition kham được 10–50MB/s tùy disk/replication).
- Nhưng nghẽn thật nằm ở **consumer**: `notification` gọi API ngoài, xử lý ~100 msg/s mỗi consumer instance → cần 3000/100 = **30 consumers song song** → cần ≥ 30 partitions (số consumer hữu dụng trong 1 group ≤ số partition).
- Cộng headroom tăng trưởng ×2 (tăng partition sau này được nhưng **làm vỡ key→partition mapping**, ordering xáo trộn trong giai đoạn chuyển — nên tính dư từ đầu), chọn số chẵn đẹp: **60 partitions**.
- Replication factor 3, `min.insync.replicas=2`, producer `acks=all` — combo tiêu chuẩn cho dữ liệu tiền nong.

**Bước 4 — Retention & consumer groups**

```
retention.ms = 7 ngày (yêu cầu replay của analytics quyết định con số này)
Mỗi service một consumer group riêng:
  inventory-cg, payment-cg, notification-cg, analytics-cg
  → cùng đọc 1 topic, offset độc lập, replay của analytics không ảnh hưởng ai
```

```
                        commerce.orders.v1 (60 partitions, RF=3)
order-service ──produce──►  ├── p0..p59 ──► inventory-cg     (10 consumers)
 (key=orderId)              │              payment-cg        (10 consumers)
                            │              notification-cg   (30 consumers)
                            └──────────►   analytics-cg      (5 consumers, batch)
```

**Bước 5 — Đừng quên: producer ghi DB + ghi Kafka thế nào cho không lệch?**

Order ghi vào Postgres rồi publish Kafka = 2 hệ thống, không có transaction chung → dùng **outbox pattern** (chi tiết ở Bài 2). Chủ động nhắc đến outbox ở bài này thể hiện bạn nhìn thấy vấn đề dual-write trước khi bị hỏi.

**Trade-offs:**
- 1 topic chung: consumer phải filter eventType mình không quan tâm (đọc rồi bỏ — chi phí nhỏ); đổi lại ordering và một schema contract duy nhất.
- 60 partitions hơi dư cho 6MB/s: tốn file handles/metadata trên broker — chấp nhận vì đổi partition sau này đắt hơn nhiều.
- `acks=all` + `min.insync.replicas=2`: tăng latency ghi (vài ms) đổi lấy không mất event đã ack — đúng cho orders; với topic clickstream thì nới sang `acks=1`.
- JSON dễ debug nhưng không có schema enforcement → production nghiêm túc dùng Schema Registry (Avro/Protobuf) để event thành contract có kiểm soát version.

**Follow-up interviewer hay hỏi:**
1. *"Tăng partition từ 60 lên 120 thì điều gì xảy ra với ordering?"* — Key hash sang partition mới → event mới của order cũ có thể sang partition khác trong khi event cũ còn ở partition cũ → ordering vỡ tạm thời. Cách làm an toàn: tạo topic mới với partition count mới, migrate consumer dần, hoặc chỉ tăng khi chấp nhận cửa sổ xáo trộn.
2. *"Consumer notification chết 2 giờ rồi sống lại thì sao?"* — Không mất gì: offset của group đứng yên, message còn trong retention 7 ngày, consumer đọc tiếp từ offset cũ; cần monitor consumer lag để biết đang tụt.
3. *"Exactly-once có cần không?"* — Producer idempotence (`enable.idempotence=true`) chống duplicate do retry network; end-to-end thì rẻ và bền nhất là consumer idempotent theo `eventId` (xem Case 3), Kafka transactions chỉ đáng giá cho pipeline Kafka-to-Kafka (Kafka Streams).

---

### Bài 2: Đồng bộ Postgres → Elasticsearch qua Kafka

**Đề bài:**
Hệ thống có bảng `products` (5M rows) và `orders` trong Postgres; cần search full-text + filter trên Elasticsearch.
- Mọi insert/update/delete ở Postgres phải phản ánh sang ES trong < 5s.
- Không được mất update; không được để ES hiển thị bản cũ đè bản mới (out-of-order).
- Thỉnh thoảng cần reindex toàn bộ (đổi mapping/analyzer).
- Tải ghi: 200–1000 updates/s.

**Phân tích & lời giải:**

**Bước 1 — Vì sao không để app ghi thẳng 2 nơi (dual-write)?**

```
App ──► Postgres  ✅ commit
   └──► Elasticsearch ❌ timeout   → 2 store lệch nhau vĩnh viễn, không có cơ chế tự lành
```

Dual-write không atomic: crash giữa 2 lệnh ghi, retry tạo thứ tự đảo, không replay được. Đây là câu mở bài bắt buộc — interviewer hỏi bài này chủ yếu để nghe bạn bắn hạ dual-write.

**Bước 2 — Hai phương án đẩy change vào Kafka: CDC vs Outbox**

**Phương án A — CDC bằng Debezium**: đọc WAL (logical replication) của Postgres, phát mọi row-change vào Kafka.
- ✅ Không sửa code app, không thể quên ghi (bắt cả update từ script/migration), độ trễ thấp.
- ❌ Event là row-level (before/after image), gắn chặt schema bảng — đổi schema DB là đổi contract; vận hành thêm Kafka Connect cluster.

**Phương án B — Outbox pattern**: app ghi business event vào bảng `outbox` **trong cùng transaction** với bảng chính; một relay (hoặc chính Debezium đọc bảng outbox) đẩy sang Kafka.

```sql
BEGIN;
UPDATE products SET name = $1, version = version + 1 WHERE id = $2;
INSERT INTO outbox (aggregate_id, topic, payload, created_at)
VALUES ($2, 'catalog.products.v1',
        jsonb_build_object('eventType','product.updated','productId',$2,
                           'version', (SELECT version FROM products WHERE id=$2)), now());
COMMIT;   -- atomic: có update là chắc chắn có event
```

- ✅ Event là business contract sạch (không lộ schema bảng), kiểm soát payload.
- ❌ Sửa code mọi đường ghi; quên một chỗ là lệch.

Chọn cho bài này: **search index cần "trạng thái mới nhất của row" → CDC Debezium là vừa khít** (mục tiêu là mirror data, không phải business semantics). Outbox để dành khi event là contract giữa các domain (như Bài 1). Nói được tiêu chí chọn giữa hai pattern này là phần ăn điểm nhất của bài.

**Bước 3 — Pipeline & consumer idempotent upsert**

```
Postgres ──WAL──► Debezium ──► Kafka topic: cdc.products (12 partitions, key=productId)
                                   │
                                   ▼
                          indexer-service (Node.js consumer)
                                   │  transform row → search doc
                                   ▼
                            Elasticsearch (index: products_v7)
```

- `key = productId` → mọi change của 1 product cùng partition, **đến theo thứ tự** → consumer xử lý tuần tự per-partition là đủ giữ order trong điều kiện bình thường.
- Consumer ghi ES bằng **idempotent upsert**: `PUT /products_v7/_doc/{productId}` (index theo `_id`) — chạy lại bao nhiêu lần kết quả vẫn vậy → at-least-once của Kafka trở nên vô hại.

**Bước 4 — Chống out-of-order bằng version**

Dù partition giữ order, out-of-order vẫn lọt vào từ: retry batch chồng nhau, reindex chạy song song với CDC, lỗi vận hành reset offset. Lưới an toàn cuối: **optimistic concurrency của ES bằng external version**:

```js
// version lấy từ cột version (tăng mỗi update) hoặc LSN của WAL
await es.index({
  index: "products_v7",
  id: doc.productId,
  version: doc.version,            // ⇐ số tăng đơn điệu theo mỗi update
  version_type: "external_gte",    // ES từ chối ghi nếu version < version hiện có
  document: doc
});
// Bản cũ đến muộn → 409 conflict → log & bỏ qua, KHÔNG retry — đây là hành vi đúng
```

- Delete: CDC phát tombstone → `DELETE /_doc/{id}`; cẩn thận race delete-rồi-update-cũ-đến-muộn → soft-delete bằng doc `{deleted: true, version}` rồi dọn sau là cách an toàn hơn.

**Bước 5 — Reindex từ đầu (đổi mapping)**

```
1. Tạo index mới products_v8 với mapping mới (KHÔNG đụng v7 đang serve)
2. Indexer bản v8 chạy consumer group MỚI (indexer-cg-v8), reset offset về earliest
   — nếu retention topic không đủ giữ toàn bộ lịch sử: chạy snapshot (Debezium
   incremental snapshot / hoặc backfill SELECT từ Postgres bơm qua cùng pipeline)
3. CDC live tiếp tục chảy vào cả v7 (group cũ) lẫn v8 (group mới) — version guard
   ở bước 4 đảm bảo snapshot cũ không đè update mới
4. v8 đuổi kịp (lag ≈ 0) → đảo alias: products_alias → products_v8  (atomic, zero-downtime)
5. Quan sát vài ngày → xóa v7
```

Chìa khóa: **alias của ES + consumer group mới + version guard** = reindex không downtime, rollback chỉ là đảo alias ngược lại.

**Trade-offs:**
- Debezium/Kafka Connect: thêm một hệ phải vận hành (monitor connector status, snapshot lock, replication slot đầy disk khi consumer chết — phải có alert `pg_replication_slots` lag).
- Eventual consistency vài giây giữa Postgres và ES — UI phải chấp nhận (sau khi user sửa sản phẩm, redirect về trang detail đọc từ Postgres, đừng đọc từ search).
- `version_type: external_gte` đẩy trách nhiệm sinh version đơn điệu về phía nguồn — cột `version` tăng trong transaction hoặc LSN; nếu nguồn không có thì phải thêm.

**Follow-up interviewer hay hỏi:**
1. *"Search doc cần join products + categories + inventory thì CDC từng bảng rời rạc xử lý sao?"* — Indexer đọc CDC bảng chính rồi enrich bằng query lookup (cache), hoặc Kafka Streams join các CDC topic, hoặc Postgres view/outbox phát document hoàn chỉnh. Nêu được "join là phần đau nhất của CDC-to-search" là điểm cộng.
2. *"Replication slot của Debezium bị tắc 3 ngày, WAL phình đầy disk Postgres — phòng thế nào?"* — Alert trên slot lag + `max_slot_wal_keep_size` (Postgres 13+) để hi sinh slot trước khi hi sinh DB.
3. *"Sao không dùng ES làm luôn primary store?"* — ES không có ACID transaction, near-real-time refresh, không phải source of truth được thiết kế để chống mất dữ liệu ở mức DB — nó là derived store, rebuild được từ Postgres; quan hệ một chiều này chính là kiến trúc đúng.

---

### Bài 3: Notification fan-out 1M push/phút từ 1 event

**Đề bài:**
Khi một KOL (5M followers) đăng bài / một flash sale mở màn, hệ thống phát 1 event `campaign.published`, cần gửi ~1M push notification (FCM/APNs) trong vòng 5 phút (~17K push/s burst).
- FCM rate limit thực dụng phía mình: ~5K req/s (batch 500 token/request vẫn phải kiểm soát).
- Token chết/invalid ~5%, FCM lỗi transient ~1%.
- Không spam: mỗi user nhận tối đa 1 push cho 1 campaign (dedup), retry không được tạo push trùng.

**Phân tích & lời giải:**

**Bước 1 — Tách 2 tầng: fan-out (1 → N) và delivery (N → FCM)**

```
campaign.published (1 event)
      │
      ▼
fanout-service: stream followers từ DB theo trang 10K,
  băm thành task {campaignId, userIds[500]}        ← batch 500 khớp FCM multicast
      │ produce, key = userIds[0] (hoặc taskId)
      ▼
topic: push.dispatch.v1  (100 partitions)
      │
      ▼
push-worker consumer group (50–100 consumers)
  ├─ đọc batch → lookup tokens → gọi FCM (500 tokens/call)
  ├─ rate limiter phân tán (Redis token bucket, ngân sách 5K req/s toàn cluster)
  ├─ lỗi transient → topic retry tiers
  └─ token invalid → event xóa token (topic token.cleanup)

push.dispatch.v1.retry.5m ──(delay 5 phút)──► push-worker
push.dispatch.v1.retry.30m ─(delay 30 phút)──► push-worker
push.dispatch.v1.dlq ───────────────────────► lưu + alert, xử lý tay
```

Vì sao tách: 1 event 1M đích **không được xử lý trong 1 message** — phải "exploded" thành ~2000 task message để chia đều cho consumer group, và tiến độ checkpoint theo từng task (crash chỉ làm lại 1 task 500 user, không làm lại 1M).

**Bước 2 — Scale consumer group & batch**

- Mỗi FCM multicast call (500 tokens) ~100–200ms → 1 worker tuần tự làm ~5–10 calls/s = 2.5–5K push/s. Cần 17K push/s → **~10–20 workers đủ về lý thuyết, lấy 50 cho headroom + retry load** → 100 partitions để còn room scale.
- Trong mỗi worker Node.js: đọc 1 task = 1 FCM call — đừng gom quá nhiều task xử lý lâu trong 1 poll loop kẻo dính `max.poll.interval` (xem Case 2).
- Ordering không quan trọng với push → key có thể round-robin/taskId; đây là điểm đối lập đáng nói so với Bài 1 (orders cần ordering, push thì cần phân tán đều — key design đi theo yêu cầu).

**Bước 3 — Rate limit downstream FCM**

Consumer scale tốt đến đâu thì FCM vẫn là cái phễu. Token bucket tập trung trên Redis:

```lua
-- Lua token bucket: mỗi worker xin quota trước khi gọi FCM
-- refill 5000 token/s, capacity 10000 (cho phép burst ngắn)
local tokens = refill_and_get(KEYS[1], 5000, 10000)
if tokens >= tonumber(ARGV[1]) then
  redis.call("DECRBY", KEYS[1], ARGV[1]); return 1
end
return 0
```

Không xin được quota → worker `pause()` consumer vài trăm ms rồi thử lại (KafkaJS `consumer.pause([{topic}])`) — **backpressure đúng cách là pause consumer, không phải buffer message trong RAM worker**. Nhận `429/QUOTA_EXCEEDED` từ FCM → coi như tín hiệu hạ refill rate động.

**Bước 4 — Retry topic + DLQ với backoff tiers**

Vì sao không retry tại chỗ (sleep trong consumer)? Sleep block luôn partition đó → message sau oan uổng + nguy cơ vượt `max.poll.interval`. Pattern chuẩn: **retry topic theo tầng**:

```js
// Trong push-worker, khi FCM lỗi transient:
const attempt = (msg.headers.attempt ?? 0) + 1;
const target =
  attempt === 1 ? "push.dispatch.v1.retry.5m"  :
  attempt === 2 ? "push.dispatch.v1.retry.30m" :
                  "push.dispatch.v1.dlq";
await producer.send({ topic: target, messages: [{
  ...msg, headers: { ...msg.headers, attempt: String(attempt),
                     notBefore: String(Date.now() + delayOf(target)) }
}]});
await commitOffset(msg); // commit ngay — message gốc coi như xong, vòng đời chuyển sang topic retry

// Consumer của topic retry: đọc message, nếu chưa tới notBefore thì pause partition
// đến đúng giờ (Kafka không có native delay — đây là cách giả lập phổ biến)
```

- Tier 5m bắt lỗi thoáng qua (FCM chập chờn); tier 30m bắt sự cố dài hơn; quá nữa → DLQ + alert, vì push trễ >1 giờ thường hết giá trị (đặc thù notification — TTL nghiệp vụ, nói được điều này rất thực chiến).
- DLQ message giữ nguyên payload + headers (attempt, lỗi cuối, timestamp) để forensics và re-drive bằng tay.

**Bước 5 — Dedup: tối đa 1 push/user/campaign**

At-least-once + retry topic = chắc chắn có lúc gửi lại task đã gửi một phần. Idempotency key per user-campaign:

```js
// Trước khi đưa user vào FCM call:
const fresh = await redis.set(`pushed:${campaignId}:${userId}`, 1, "EX", 86400, "NX");
if (!fresh) continue;  // đã gửi rồi → bỏ qua
```

Đặt dedup **trước call FCM** (chống trùng) và chấp nhận hệ quả: crash giữa SET và FCM call thành công → user đó *mất* push (at-most-once cục bộ). Với notification, gửi thiếu 1 < gửi trùng 3 — chọn chiều an toàn theo nghiệp vụ và nói rõ lựa chọn.

**Trade-offs:**
- Retry topic tiers: mất ordering (vốn không cần cho push), cộng N topic phải quản; đổi lấy main topic không bao giờ bị block bởi lỗi downstream.
- Redis token bucket tập trung = thêm 1 round-trip/call + single point cần HA; đổi lấy không vượt quota FCM toàn cục (rate limit per-worker chia tĩnh sẽ lãng phí khi worker lệch tải).
- Dedup bằng Redis TTL 24h: ~1M key/campaign × vài chục bytes — rẻ; nhưng Redis mất data = có thể gửi trùng → chấp nhận, vì exact dedup cần DB unique constraint (chậm hơn nhiều ở 17K/s).

**Follow-up interviewer hay hỏi:**
1. *"Kafka không có delayed message — còn cách nào khác ngoài pause-until-notBefore?"* — Scheduler ngoài (lưu vào Redis sorted set/DB theo due time, job bơm lại vào topic), hoặc dùng broker có native delay (RabbitMQ delayed exchange, SQS delay) cho riêng nhánh retry.
2. *"Campaign bị hủy giữa chừng khi mới gửi 300K/1M thì sao?"* — Flag `campaign:cancelled` trong Redis, worker check trước mỗi task — minh họa đẹp cho "control plane (flag) tách khỏi data plane (queue)".
3. *"Đo đếm thế nào để biết đã gửi đủ 1M?"* — Counter Redis `INCRBY sent:{campaignId}` per batch + reconcile với tổng follower; dashboard consumer lag của cả retry topics (lag ở retry.30m cao bất thường = downstream đang ốm).

---

### Bài 4: Log/metrics aggregation pipeline 500K events/s

**Đề bài:**
Công ty có ~2000 service instances đẩy logs + metrics:
- 500K events/s, trung bình 800 bytes/event (~400MB/s raw).
- Đích: ClickHouse (phân tích) + S3 (lưu trữ lạnh) + alerting realtime.
- Logs chịu được mất mát rất nhỏ và trễ vài chục giây; alerting cần trễ < 5s.
- Retention trên Kafka: chỉ cần đệm đủ để consumer chậm/chết đuổi kịp.
Thiết kế topic/partition/compression/retention và phương án khi consumer tụt lại.

**Phân tích & lời giải:**

**Bước 1 — Topic & partition theo gì?**

```
logs.app.v1       (200 partitions)  — log thường, volume lớn nhất
logs.access.v1    (100 partitions)  — access log, schema riêng
metrics.v1        (100 partitions)  — đi đường riêng vì alerting cần latency thấp
```

Tách `metrics` khỏi `logs`: yêu cầu latency khác nhau (5s vs 30s+), consumer khác nhau, và sự cố bão log (log storm khi một service lỗi in stacktrace 100×) không được kéo chết đường alerting — **bulkhead bằng topic**.

Partition key: **không key (sticky round-robin)** cho logs — không có yêu cầu ordering giữa các dòng log của cả hệ thống, ưu tiên tuyệt đối là phân bố đều. Đặc biệt **không key theo `serviceName`**: một service bão log sẽ nung chín đúng vài partition (skew kinh điển của pipeline logging). Nếu cần xem log 1 instance theo thứ tự thì đã có timestamp + sequence trong payload để sort lúc query — ordering xử lý ở tầng đọc, không trả giá ở tầng vận chuyển.

Số partition: 400MB/s ÷ ~10MB/s an toàn mỗi partition (đã tính replication) ≈ 40 tối thiểu về byte; nhưng consumer ClickHouse/S3 sink cần song song cao và headroom cho burst ×3 → 200 partitions cho topic lớn nhất.

**Bước 2 — Compression: chốt chặn quan trọng nhất của bài này**

```js
// Producer config (KafkaJS)
{
  compression: CompressionTypes.ZSTD,   // zstd: tỉ lệ nén ~3-4x trên log text, CPU rẻ
  batchSize: 1048576,                   // 1MB — nén theo batch mới hiệu quả
  lingerMs: 50,                         // đợi 50ms gom batch: log chịu được trễ này
  acks: 1                               // log mất vài dòng khi broker fail: chấp nhận
}
```

- Log text nén zstd thường còn ~25–30%: 400MB/s → ~110MB/s qua network và đĩa, **nhân 3 lần replication nữa** thì khoản tiết kiệm là khổng lồ — compression là đòn bẩy chi phí số 1 của pipeline log.
- `linger.ms` + batch lớn ↔ nén hiệu quả: nén từng message lẻ gần như vô dụng. Đây là bộ ba (batch–linger–compression) luôn đi cùng nhau.
- `acks=1` (không chờ replica): khác hẳn bài orders — lại một lần nữa, **độ bền đặt theo giá trị của data**.

**Bước 3 — Retention: Kafka là buffer, không phải kho**

```
retention.ms = 24–48h   (đủ cho: consumer chết tối thứ 6 → sửa sáng thứ 2? → chọn 72h nếu muốn ngủ yên cuối tuần)
retention.bytes per partition làm phanh an toàn (đĩa không bao giờ đầy vì log storm)
Kho thật: S3 (sink riêng, retention vô hạn, rẻ) — Kafka chỉ là băng chuyền
```

Cách nghĩ để nói trong phỏng vấn: retention của Kafka ở pipeline log = **thời gian tối đa cho phép một consumer chết mà chưa mất dữ liệu**. Nó là tham số vận hành (MTTR của đội), không phải tham số nghiệp vụ.

**Bước 4 — Consumer phía sink**

```
metrics.v1 ──► alert-evaluator (streaming, latency 1-2s, đọc tail)
logs.*     ──► clickhouse-sink: gom micro-batch 10-30s → INSERT batch lớn
           └─► s3-sink: gom theo 5 phút/partition → file Parquet lên S3
```

ClickHouse ưa insert batch to (trăm nghìn rows/insert) — consumer chủ động gom rồi commit offset **sau khi** insert thành công (at-least-once; ClickHouse dedup bằng ReplacingMergeTree/insert_deduplication nếu cần).

**Bước 5 — Consumer chậm thì sao? (câu hỏi chính của đề)**

Phân loại theo nguyên nhân, mỗi loại một thuốc:
1. **Chậm tạm thời (burst)**: chính là lý do Kafka tồn tại — lag tăng rồi tự đuổi kịp; chỉ cần alert lag theo *thời gian* (`lag_seconds`, ý nghĩa hơn lag theo message count) với ngưỡng < retention.
2. **Chậm hệ thống (sink yếu hơn nguồn)**: scale consumer đến trần = số partition; quá trần thì nghẽn nằm ở sink (ClickHouse) — phải scale sink hoặc giảm dữ liệu (sampling DEBUG logs, drop ở agent). Thêm consumer khi sink đã nghẽn là vô ích.
3. **Chậm vĩnh viễn không cứu được trong retention**: quyết định kinh doanh — mất log cũ (chấp nhận với log) hay tăng retention (tăng tiền đĩa). Vì có S3 sink độc lập khỏe, mất trên Kafka ≠ mất vĩnh viễn miễn S3 sink không tụt — ưu tiên giữ S3 sink khỏe nhất.
4. **Một partition chậm bất thường**: thường là skew (xem lại key) hoặc 1 broker ốm — đây là lúc metric per-partition lag cứu bạn.

**Trade-offs:**
- `acks=1` + không fsync từng message: có thể mất một nhúm log khi broker fail — đổi lấy throughput/chi phí; alerting metrics quan trọng hơn thì cân nhắc `acks=all` riêng cho topic metrics.
- Round-robin key: không ordering per-service trên wire — xử lý bằng sort theo timestamp lúc query (ClickHouse `ORDER BY`); cái giá gần như bằng 0 cho use case này.
- Retention ngắn 24–72h: rủi ro mất khi sự cố dài ngày — bù bằng S3 sink là consumer được ưu tiên phục hồi số 1.

**Follow-up interviewer hay hỏi:**
1. *"Tiered storage của Kafka (KIP-405) thay đổi gì bài này?"* — Cho phép retention dài trên S3 ngay trong Kafka, replay sâu không cần sink riêng; nhưng latency đọc dữ liệu cũ cao hơn và vẫn nên có định dạng phân tích (Parquet) cho query — chưa thay thế hoàn toàn S3 sink.
2. *"Agent trên 2000 instances đẩy thẳng vào Kafka hay qua gateway?"* — Thẳng (client Kafka trong agent, ví dụ Vector/Fluent Bit) cho ít hop; gateway (HTTP → Kafka) khi cần auth đơn giản/multi-tenant/giới hạn connection số lượng lớn tới broker. 2000 connections là ổn cho thẳng.
3. *"Backpressure khi Kafka chính nó quá tải?"* — Agent local buffer trên disk + drop policy theo mức độ (drop DEBUG trước INFO trước ERROR) — degrade có chủ đích thay vì chết ngẫu nhiên.

---

## 🌍 Case thực tế

### Case 1: Poison message — 1 message lỗi kẹt cả partition

**Bối cảnh:** Hệ thống xử lý đơn của một sàn TMĐT: consumer Node.js đọc topic `orders`, mỗi message gọi service tính phí vận chuyển rồi ghi DB. Một ngày, team upstream deploy bản mới phát ra một event có `shippingAddress: null` (schema lệch).

**Vấn đề gặp phải:**
- Consumer parse message này → throw → **không commit offset** → consumer crash/restart hoặc retry chính message đó → throw tiếp → lặp vô hạn.
- Vì offset partition đó đứng yên, **toàn bộ message phía sau trong cùng partition bị kẹt** — hàng nghìn đơn hợp lệ không được xử lý, lag partition đó tăng dựng đứng trong khi các partition khác bình thường (dấu hiệu nhận diện đặc trưng: lag lệch hẳn ở 1 partition).
- Tệ hơn: consumer crash-loop gây rebalance liên tục, kéo giảm throughput của cả group. Một message rác làm tê liệt một luồng nghiệp vụ trong nhiều giờ.

**Giải pháp & tại sao:**
1. **Phân loại lỗi ngay trong handler** — đây là cốt lõi:
```js
try {
  await handle(msg);
} catch (e) {
  if (isTransient(e)) throw e;            // lỗi hạ tầng (DB down, timeout) → retry tại chỗ/retry topic
  // lỗi vĩnh viễn (parse fail, validate fail): retry 1 tỷ lần vẫn fail
  await producer.send({ topic: "orders.dlq", messages: [{
    key: msg.key, value: msg.value,
    headers: { error: e.message, stack: e.stack?.slice(0, 500),
               srcPartition: String(partition), srcOffset: msg.offset }
  }]});
}
// cả 2 nhánh đều đi tới: commit offset → partition chảy tiếp
```
   Nguyên tắc: **lỗi không thể tự lành bằng retry thì DLQ + skip; lỗi hạ tầng mới retry**. Skip không phải mất message — message nằm trong DLQ chờ sửa schema rồi re-drive.
2. DLQ kèm metadata lỗi + offset gốc → debug và re-drive (consumer nhỏ đọc DLQ bơm lại main topic sau khi fix).
3. Phòng từ gốc: Schema Registry với compatibility check — upstream không thể deploy schema vỡ contract; validation tại producer.
4. Alert trên per-partition lag (không chỉ tổng lag) + alert trên DLQ depth.

**Bài học rút ra:**
- Trong Kafka, các message trong 1 partition sống chết có nhau — một poison message là hostage-taking cả partition; consumer **bắt buộc** có chiến lược lỗi vĩnh viễn vs transient ngay từ ngày đầu, không phải để "sau này thêm".
- "Skip + DLQ" là quyết định nghiệp vụ cần ghi rõ trong design: ordering của key đó bị thủng một message — với orders thì các event sau của order hỏng đó cũng nên route theo (parking lot pattern) nếu nghiệp vụ yêu cầu chặt.
- Tổng lag trông bình thường vẫn có thể có 1 partition chết — monitor phải nhìn theo partition.

**💬 Cách dùng case này khi phỏng vấn:** Khi vẽ bất kỳ consumer nào, chủ động vẽ luôn nhánh DLQ và nói: *"Em mặc định phân loại lỗi transient/permanent ngay từ đầu — em từng thấy một message null field làm kẹt nguyên partition orders nhiều giờ vì consumer chỉ biết retry vô hạn."*

### Case 2: Rebalance liên tục vì xử lý vượt `max.poll.interval.ms`

**Bối cảnh:** Consumer group Node.js (KafkaJS) đọc topic `media.uploaded`, mỗi message resize ảnh + upload CDN (~2s/ảnh). Code poll batch 500 messages xử lý tuần tự. Ngày thường ổn vì batch thực tế nhỏ; đến đợt campaign, backlog dồn, mỗi lần poll nhận đủ 500 message.

**Vấn đề gặp phải:**
- 500 ảnh × 2s = ~17 phút xử lý cho một vòng poll, vượt xa `max.poll.interval.ms` (mặc định 5 phút) → broker coi consumer là chết → **đá khỏi group → rebalance**.
- Message đang xử lý dở bị giao cho consumer khác làm lại từ offset chưa commit → tốn công kép; consumer "bị đá" xử lý xong quay lại join → **lại rebalance**. Cả group rơi vào vòng xoáy rebalance storm: throughput thực tế gần 0, lag tăng không phanh, CPU bận rộn nhưng không có gì hoàn thành — càng lag càng poll full batch, càng chắc chắn timeout: **vòng lặp tự duy trì**.
- Log đặc trưng đứng đầy: `The coordinator is not aware of this member`, `Attempt to heartbeat failed since group is rebalancing`.

**Giải pháp & tại sao:**
1. **Ngắn hạn — co khối lượng mỗi vòng poll**: giảm `max.poll.records`-tương-đương (KafkaJS: xử lý theo `eachMessage` hoặc giới hạn số message xử lý mỗi `eachBatch`, gọi `heartbeat()` định kỳ trong vòng lặp batch):
```js
await consumer.run({
  eachBatch: async ({ batch, resolveOffset, heartbeat }) => {
    for (const m of batch.messages) {
      await processImage(m);          // 2s
      resolveOffset(m.offset);        // checkpoint từng message
      await heartbeat();              // báo sống — chìa khóa thoát timeout
    }
  }
});
```
   Quy tắc an toàn: `thời_gian_xử_lý_tối_đa_một_vòng < max.poll.interval / 2`.
2. **Dài hạn — tách xử lý nặng khỏi consumer**: consumer chỉ làm việc nhẹ (validate, ghi job vào DB/queue nội bộ với trạng thái) rồi commit ngay; pool worker riêng kéo job xử lý 2s/ảnh theo nhịp của nó. Consumer Kafka trở thành "ingestion" thuần — nhanh, không bao giờ vi phạm poll interval; scale worker độc lập với số partition (vượt được trần consumers ≤ partitions!).
3. Tinh chỉnh kèm: tăng `max.poll.interval.ms` chỉ là mua thời gian (và làm chậm phát hiện consumer chết thật); `sessionTimeout`/`heartbeatInterval` tách khỏi thời gian xử lý (heartbeat chạy thread/loop riêng — vi phạm poll interval vẫn bị đá dù heartbeat đều); bật **cooperative/incremental rebalancing** (hoặc static membership `group.instance.id`) để rebalance bớt đau khi rolling deploy.

**Bài học rút ra:**
- Consumer Kafka phải "nhai nhanh nuốt nhanh": thời gian giữa 2 lần poll là một SLA với broker; xử lý nặng/blocking trong poll loop là thiết kế sai tầng.
- Lag cao + throughput thấp + log rebalance lặp = nghĩ ngay đến poll interval, đừng vội thêm consumer (thêm consumer còn gây thêm rebalance).
- Tách "nhận message" khỏi "xử lý message" mở khóa cả hai: tuân thủ nhịp poll và scale xử lý vượt số partition. Cái giá: phải tự quản trạng thái job + at-least-once hai tầng.

**💬 Cách dùng case này khi phỏng vấn:** Khi được hỏi "consumer xử lý chậm thì sao", trả lời theo tầng: *"Trước hết em đảm bảo không vi phạm max.poll.interval — em từng debug một rebalance storm do batch 500 ảnh × 2s; fix ngắn hạn là heartbeat trong batch + giảm batch, fix đúng là tách xử lý nặng ra worker pool, consumer chỉ ingest."*

### Case 3: Duplicate message sau deploy — at-least-once gặp consumer không idempotent

**Bối cảnh:** Service `loyalty` cộng điểm thưởng: consume `order.completed`, cộng điểm vào tài khoản user (`UPDATE users SET points = points + ?`). Chạy nhiều tháng "không sao". Một lần deploy rolling restart đúng giờ cao điểm, hôm sau CSKH nhận loạt khiếu nại... ngược: user *khoe* được cộng điểm gấp đôi, kế toán thì không vui.

**Vấn đề gặp phải:**
- Kafka consumer mặc định là **at-least-once**: xử lý xong → commit offset. Deploy/rebalance xảy ra **sau khi UPDATE DB nhưng trước khi commit offset** → partition về tay consumer mới → đọc lại từ offset đã commit cuối → **xử lý lại message đã xử lý** → cộng điểm lần 2.
- Lỗi này im lặng nhiều tháng vì rebalance hiếm khi rơi trúng khe hở; rolling deploy giờ cao điểm = hàng chục rebalance × throughput lớn → xác suất thành chắc chắn. Phép toán `points = points + X` là **không idempotent** — chạy 2 lần ra kết quả khác chạy 1 lần.
- Hướng vá sai từng được bàn: "commit offset trước, xử lý sau" — đổi sang at-most-once, deploy rơi vào khe thì *mất* điểm của user: đổi lỗi này lấy lỗi tệ hơn.

**Giải pháp & tại sao:**
1. **Processed table + unique constraint, cùng transaction với side effect** — biến handler thành idempotent thực sự:
```sql
CREATE TABLE processed_events (
  event_id   UUID PRIMARY KEY,         -- producer phải gắn eventId vào mọi event
  consumer   VARCHAR(64) NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT now()
);
```
```js
await db.tx(async t => {
  const r = await t.query(
    `INSERT INTO processed_events (event_id, consumer)
     VALUES ($1, 'loyalty') ON CONFLICT (event_id) DO NOTHING`,
    [msg.eventId]);
  if (r.rowCount === 0) return;            // đã xử lý → no-op, an toàn tuyệt đối
  await t.query(`UPDATE users SET points = points + $1 WHERE id = $2`,
                [msg.points, msg.userId]);
});
// transaction commit xong mới commit offset — duplicate giờ vô hại
```
   Điểm mấu chốt: insert dedup và update điểm **trong cùng DB transaction** — atomic; unique constraint là người gác cuối do DB enforce, không phải logic code có thể race.
2. Backfill sửa hậu quả: tìm các event nghi xử lý trùng trong khung giờ deploy (so log offset reset với bảng giao dịch điểm) → trừ điểm điều chỉnh, kèm thông báo khéo.
3. Nâng chuẩn hệ thống: mọi event bắt buộc có `eventId` (enforce ở schema registry/producer lib chung); checklist review consumer mới có mục "handler có idempotent không? bằng cơ chế gì?"; cân nhắc lưu kèm `(topic, partition, offset)` để forensics. Lựa chọn thay thế cho phép toán cộng dồn: ghi **ledger append-only** (mỗi event 1 dòng có unique eventId, points = SUM) — idempotent tự nhiên và audit được, đúng kiểu kế toán.

**Bài học rút ra:**
- "Exactly-once" end-to-end với side effect ngoài Kafka không phải config bật lên là có — nó được *xây* bằng at-least-once + consumer idempotent; Kafka transactions chỉ phủ Kafka-to-Kafka.
- Duplicate không phải bug của Kafka, nó là **hợp đồng** của at-least-once — consumer nào chưa trả lời được "message này đến 2 lần thì sao?" là consumer chưa xong.
- Bug xác suất thấp × throughput cao × thời điểm xấu = sự cố chắc chắn; "chạy nhiều tháng không sao" không phải bằng chứng đúng.

**💬 Cách dùng case này khi phỏng vấn:** Câu này gài được vào hầu hết câu hỏi Kafka: *"Em mặc định mọi consumer là at-least-once nên handler luôn idempotent — hoặc phép toán tự nhiên idempotent (upsert theo version như sync ES), hoặc processed table với unique constraint cùng transaction; em từng thấy hệ thống loyalty cộng điểm gấp đôi sau một lần rolling deploy chỉ vì thiếu đúng cái bảng đó."*

---

## ✅ Checklist tự kiểm tra

1. Tôi có quyết định được số topic và message key cho một bài toán bất kỳ dựa trên câu hỏi "cái gì cần ordering với cái gì?" — và giải thích được vì sao tăng partition làm vỡ key mapping không?
2. Tôi có công thức ước lượng số partition (throughput bytes, throughput consumer chậm nhất, headroom) và nói được hệ quả của việc chọn thừa/thiếu không?
3. Tôi có bắn hạ được dual-write và trình bày rành mạch CDC vs Outbox — kèm tiêu chí khi nào chọn cái nào không?
4. Tôi có thiết kế được consumer chống cả 3 bệnh kinh điển: poison message (phân loại lỗi + DLQ + skip), vi phạm max.poll.interval (heartbeat, tách worker), và duplicate (idempotency: processed table / upsert theo version) không?
5. Tôi có vẽ được retry topic tiers (5m/30m/DLQ) và giải thích vì sao không retry-bằng-sleep trong consumer không?
6. Tôi có chọn được đúng bộ config theo giá trị data — `acks`, `min.insync.replicas`, compression, `linger.ms`, retention — và giải thích vì sao bài orders và bài logs chọn ngược nhau không?
7. Khi nhìn dashboard, tôi có chẩn đoán được từ hình dạng lag (1 partition lệch / tổng lag tăng đều / lag răng cưa kèm log rebalance) ra đúng bệnh và đúng thuốc không?
