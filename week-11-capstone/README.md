# Tuần 11: Capstone Week — Xây dựng hệ thống Order Processing Microservices

> **Spec chi tiết của project**: xem [`../capstone-project/README.md`](../capstone-project/README.md). File này là LỊCH THI CÔNG 6 ngày + bộ câu hỏi phỏng vấn "kể về project của bạn" và cách trả lời dựa trên chính capstone.

## 🎯 Mục tiêu tuần này

- Xây hoàn chỉnh **hệ thống xử lý đơn hàng e-commerce microservices** (4 services Node.js + API Gateway, PostgreSQL, MongoDB, Redis, Kafka) theo spec trong `../capstone-project/README.md`.
- Áp dụng THẬT các pattern đã học 10 tuần: outbox, saga choreography, idempotent consumer, cache-aside, distributed lock, DLQ, graceful shutdown, health checks, rate limiting.
- Containerize + deploy lên Kubernetes (kind/minikube), có HPA.
- Chuẩn bị **bài demo 10 phút** + tập trả lời trọn bộ câu hỏi "walk me through your project".
- Kết thúc tuần: có 1 repo GitHub đủ chất lượng để đưa vào CV và làm chủ đề chính cho vòng phỏng vấn technical deep-dive.

> ⚠️ **Nguyên tắc tuần này**: làm > đọc. Mỗi ngày 1 milestone, cuối ngày PHẢI chạy được demo của milestone đó (Definition of Done — DoD). Bị kẹt quá 45 phút ở một lỗi → ghi bug vào `BUGLOG.md` (sau này là chuyện kể phỏng vấn) rồi tìm đường đơn giản hơn để đi tiếp.

---

## 📚 Lý thuyết

Tuần này lý thuyết tối thiểu — mỗi ngày chỉ đọc lại đúng phần spec liên quan trước khi code (15-30 phút), thời gian còn lại là thi công.

### Ngày 1-2: Skeleton, Infra & Order Service (cơ bản)

**Ngày 1 — Milestone 1: Skeleton + Infra local**
- *Ôn nhanh trước khi code*: docker-compose networking (service name = hostname), Kafka KRaft config, healthcheck & `depends_on: condition`.
- Việc cần làm:
  1. Tạo monorepo: `api-gateway/`, `order-service/`, `inventory-service/`, `payment-service/`, `notification-service/`, `k8s/`, `scripts/`, `docker-compose.yml`.
  2. docker-compose: Postgres, MongoDB, Redis, Kafka (KRaft) — copy mẫu spec mục 5.2, `docker compose up` xanh hết.
  3. Skeleton 4 service + gateway: Express/Fastify, pino logger (JSON, có `x-request-id`), endpoint `/health` và `/health/ready`.
  4. Gateway: routing 4 service + middleware sinh/forward `x-request-id` + rate limit token bucket Redis (tái dùng bài tập tuần 10).
  5. `scripts/seed.js`: 20 products vào MongoDB, in ra 2 JWT user test.
- **DoD**: `docker compose up` → `curl localhost:8080/api/products` trả seed data; `/health` mọi service trả 200.

**Ngày 2 — Milestone 2: Order Service + Outbox pattern**
- *Ôn nhanh*: outbox pattern (spec mục 4), transaction trong `pg`, idempotency key.
- Việc cần làm:
  1. Migrations: `orders`, `order_items`, `order_status_history`, `outbox`, `processed_events` (SQL trong spec mục 3.2).
  2. `POST /orders`: validate (zod) → check `Idempotency-Key` (unique constraint, trùng → trả response cũ) → 1 transaction ghi order PENDING + items + history + outbox row → trả `202`.
  3. Outbox relay: loop 500ms, `SELECT ... WHERE published_at IS NULL FOR UPDATE SKIP LOCKED LIMIT 100` → publish Kafka (partition key = `orderId`) → set `published_at`.
  4. `GET /orders/:id` (items + status history), `GET /orders?userId=` cursor pagination.
- **DoD**: tạo order → `kafka-console-consumer` thấy event `order-created` đúng schema; gửi lại cùng idempotency key → trả order cũ, không có row mới; kill relay giữa chừng → restart → event vẫn được publish (không mất).

### Ngày 3-4: Inventory, Payment & Saga hoàn chỉnh (trung cấp)

**Ngày 3 — Milestone 3: Inventory Service + chống oversell**
- *Ôn nhanh*: cache-aside + invalidation, Redis distributed lock (SET NX PX, Lua release), MongoDB conditional update.
- Việc cần làm:
  1. Consumer `order-created` (consumer group `inventory-service`): idempotent qua collection `processed_events`.
  2. Reserve flow 2 lớp: sort productIds → lock từng product (`SET lock:product:{id} {orderId} NX PX 5000`) → `updateOne({_id, stock: {$gte: qty}}, {$inc: {stock: -qty, reserved: qty}})` → check `modifiedCount`.
  3. Tất cả OK → ghi `reservations` + emit `inventory-reserved`; 1 item fail → rollback các item đã trừ → emit `inventory-failed`.
  4. `GET /products`, `GET /products/:id` với cache-aside Redis TTL 60s; mọi update stock → `DEL product:{id}`.
- **DoD**: bắn 20 orders đồng thời cho product stock=5 → đúng 5 `inventory-reserved`, 15 `inventory-failed`, stock cuối = 0 không âm; log thấy cache HIT/MISS.

**Ngày 4 — Milestone 4: Payment + đóng vòng saga + Notification**
- *Ôn nhanh*: saga choreography + compensation (spec mục 2), at-least-once semantics.
- Việc cần làm:
  1. payment-service: consume `inventory-reserved` → idempotent (processed_events + unique `order_id`) → `fakeCharge` (fail rate qua env `PAYMENT_FAIL_RATE`, mặc định 0.2) → ghi payment + outbox `payment-completed`/`payment-failed` cùng transaction.
  2. order-service consume `payment-completed` → CONFIRMED + history + outbox `order-confirmed`; consume `payment-failed`/`inventory-failed` → CANCELLED (kèm reason) + outbox `order-cancelled`.
  3. inventory-service consume `payment-failed` + `order-cancelled` → release stock (`$inc` ngược), reservation → RELEASED, chỉ release khi reservation đang ở RESERVED (compensation phải idempotent); consume `payment-completed` → COMMITTED.
  4. notification-service: consume `order-confirmed`/`order-cancelled` → render template → console + bảng `notifications`; idempotent.
- **DoD**: happy path end-to-end < 3 giây, `GET /orders/:id` thấy timeline PENDING→CONFIRMED; `PAYMENT_FAIL_RATE=1` → mọi order CANCELLED và stock trả lại đủ; 30 orders với fail rate 0.2 → bất biến: `stock_đầu − stock_cuối = tổng qty của orders CONFIRMED`.

### Ngày 5-6: Resilience, Kubernetes & Demo (nâng cao)

**Ngày 5 — Milestone 5: Resilience (DLQ, graceful shutdown, chaos test)**
- *Ôn nhanh*: DLQ, retry backoff, SIGTERM lifecycle trong K8s.
- Việc cần làm:
  1. Consumer wrapper chung: try/catch → retry 3 lần backoff 1s/5s/25s → publish `{topic}.dlq` kèm `{ error, stack, originalTopic, retryCount, failedAt }` → commit offset đi tiếp.
  2. Graceful shutdown mọi service: SIGTERM → `server.close()` → `consumer.disconnect()` (commit offset, rebalance sạch) → đóng pg pool/mongo/redis → exit; hard timeout 10s → `process.exit(1)`.
  3. Chaos script (`scripts/chaos.sh`): load 2 orders/s liên tục, lần lượt `docker compose kill` rồi `up` từng service (mỗi service down 20s) → verify: không order PENDING quá 60s, kho khớp, notification không trùng.
  4. Inject poison message (JSON hỏng) → vào DLQ, consumer không chết, message sau vẫn xử lý.
- **DoD**: chaos test pass toàn bộ; ghi kết quả + mọi bug đã gặp vào `BUGLOG.md`.

**Ngày 6 — Milestone 6: Docker multi-stage, K8s, tài liệu, demo**
- *Ôn nhanh*: K8s probes, HPA, ConfigMap/Secret (spec mục 5.3).
- Việc cần làm:
  1. Dockerfile multi-stage cho cả 5 image (mẫu spec 5.1); ghi lại image size trước/sau.
  2. `kind create cluster` → apply manifests (deployment + service + hpa + configmap mỗi service; infra Postgres/Mongo/Redis/Kafka có thể chạy docker-compose ngoài cluster và trỏ vào — chấp nhận được cho demo, nói rõ trade-off).
  3. Demo HPA: cài metrics-server, load test k6/autocannon → order-service scale 2→4.
  4. Demo rolling update + graceful shutdown: `kubectl rollout restart` dưới load → 0 lỗi 5xx.
  5. Viết `README.md` (chạy được trong 5 phút), `ARCHITECTURE.md` (diagram + từng pattern + VÌ SAO), `DEMO.md` (kịch bản demo 10 phút từng lệnh).
  6. Push GitHub, đối chiếu checklist hoàn thành trong spec mục 7. (Tùy chọn: thực hiện plan AWS spec 5.4 — dựng nhanh, screenshot, xóa ngay.)
- **DoD**: người lạ clone repo và chạy được theo README; bạn demo trọn 10 phút không vấp.

---

## 💬 Top 15 câu hỏi phỏng vấn thường gặp

Dạng "kể về project của bạn" — câu trả lời mẫu dựa trên chính capstone. Tập nói thành tiếng từng câu sau Ngày 4.

**Q1: Walk me through your project's architecture.**
**A:** Em xây hệ thống xử lý đơn hàng e-commerce gồm API Gateway và 4 service Node.js: order, inventory, payment, notification — giao tiếp async qua Kafka theo saga choreography. Order dùng PostgreSQL với outbox pattern, catalog dùng MongoDB với Redis cache-aside, Redis còn làm rate limiting và distributed lock chống oversell. Toàn bộ containerize bằng Docker multi-stage và deploy lên Kubernetes với HPA, health probes, graceful shutdown.

**Q2: Why Kafka and not RabbitMQ?**
**A:** Em cần event bus mà nhiều service cùng tiêu thụ một event độc lập — ví dụ `payment-failed` được cả order-service lẫn inventory-service nghe — consumer groups của Kafka làm việc này tự nhiên. Kafka còn giữ message theo retention nên em replay được khi consumer có bug, rất quý khi debug saga. Nếu chỉ cần task queue với routing phức tạp thì RabbitMQ hợp hơn, nhưng use case của em là event-driven giữa services.

**Q3: How do you handle failure — chẳng hạn payment-service chết giữa chừng?**
**A:** Ba lớp: thứ nhất, event nằm trong Kafka với offset chưa commit nên service sống lại xử lý tiếp, không mất message. Thứ hai, consumer idempotent — check eventId trong processed_events cùng transaction — nên xử lý lại không charge trùng. Thứ ba, nếu payment fail thực sự thì saga compensation chạy: inventory release stock, order chuyển CANCELLED. Em đã viết chaos test kill từng service 20 giây dưới load để chứng minh không mất order, không sai kho.

**Q4: Tại sao dùng outbox pattern? Không có nó thì sao?**
**A:** Không có nó em gặp dual-write problem: ghi order vào Postgres thành công nhưng publish Kafka fail — hoặc ngược lại — hệ thống lệch trạng thái vĩnh viễn. Outbox ghi event vào một bảng cùng transaction với order nên hai thứ atomic; relay loop poll bảng đó publish lên Kafka, dùng `FOR UPDATE SKIP LOCKED` để chạy được nhiều instance. Production quy mô lớn em sẽ thay relay tự viết bằng Debezium CDC.

**Q5: Làm sao chống oversell khi 50 người mua cùng lúc sản phẩm còn 5 cái?**
**A:** Hai lớp: Redis distributed lock per product để serialize reserve khi order có nhiều item — em sort productId trước khi lock để tránh deadlock. Nhưng lock có TTL nên không tuyệt đối, vì vậy lớp quyết định là conditional update của MongoDB: `updateOne({stock: {$gte: qty}}, {$inc: {stock: -qty}})` và check modifiedCount — atomic ở DB level. Em test 20 request đồng thời với stock 5, đúng 5 thành công.

**Q6: Saga của bạn là choreography hay orchestration? Vì sao?**
**A:** Choreography — các service tự nghe event và phản ứng, không có điều phối trung tâm. Em chọn vì flow chỉ 4 bước tuyến tính, ít branch, và choreography cho loose coupling: thêm notification-service em không sửa dòng nào ở service khác. Nhược điểm em nhận rõ là flow khó nhìn toàn cảnh, nên bù bằng correlation ID xuyên suốt và bảng order_status_history. Nếu flow dài thêm shipping, voucher thì em sẽ chuyển sang orchestrator như Temporal.

**Q7: Điều gì xảy ra nếu cùng một event được deliver hai lần?**
**A:** Kafka là at-least-once nên duplicate chắc chắn xảy ra, nhất là khi consumer rebalance. Mỗi consumer của em check eventId trong bảng processed_events và insert nó trong CÙNG transaction với business update — hoặc cả hai cùng commit, hoặc không gì cả. Payment còn lớp nữa: unique constraint trên order_id, không thể có hai payment cho một order.

**Q8: Bạn xử lý poison message thế nào?**
**A:** Consumer wrapper retry 3 lần với exponential backoff 1s, 5s, 25s; vẫn fail thì publish sang topic `.dlq` kèm error, stack trace, retry count rồi commit offset đi tiếp — để một message hỏng không chặn cả partition. Em có script đọc DLQ để phân tích và replay sau khi fix bug, và đã test bằng cách inject một event JSON hỏng.

**Q9: Tại sao vừa PostgreSQL vừa MongoDB? Sao không một DB?**
**A:** Order cần ACID transaction và quan hệ rõ giữa orders, items, history, outbox — Postgres là lựa chọn tự nhiên. Catalog schema linh hoạt theo category, read-heavy, không join với order — MongoDB cùng Redis cache phù hợp. Thật lòng một mình Postgres vẫn làm được cả hai; em chọn polyglot có chủ đích để nắm trade-off của cả hai loại DB, và mỗi service sở hữu DB riêng đúng nguyên tắc microservices.

**Q10: Cache invalidate thế nào? Có race condition không?**
**A:** Cache-aside: đọc check Redis trước, miss thì query Mongo và set TTL 60 giây; khi stock thay đổi em DELETE key thay vì update — vì update cache song song có thể ghi đè data mới bằng data cũ, delete thì request sau tự rebuild từ source of truth. Vẫn còn race nhỏ giữa lúc đọc DB và set cache; với catalog, TTL ngắn là chấp nhận được, cần chặt hơn thì dùng versioning hoặc lock khi rebuild.

**Q11: Graceful shutdown hoạt động ra sao trong Kubernetes?**
**A:** Khi rolling update, K8s gửi SIGTERM; service ngừng nhận request mới bằng `server.close()`, disconnect Kafka consumer để commit offset và rebalance sạch, đóng connection pool rồi mới exit — có hard timeout 10 giây. Readiness probe fail trước nên LB ngừng route traffic vào pod sắp chết. Em demo bằng `kubectl rollout restart` dưới load và không có lỗi 5xx nào.

**Q12: Nếu traffic tăng 10 lần, hệ thống vỡ ở đâu trước?**
**A:** Các service stateless scale ngang qua HPA nên không phải bottleneck. Vỡ trước là Postgres của order-service vì mọi order đều ghi vào đó — em sẽ thêm PgBouncer cho connection pooling, read replica cho query, rồi partition bảng orders theo thời gian. Kafka thì tăng partition để tăng song song consumer — partition key là orderId nên ordering per order vẫn giữ. Outbox relay polling cũng nên chuyển sang Debezium CDC để giảm tải DB.

**Q13: Bug khó nhất bạn gặp trong project là gì?**
**A:** (Trả lời bằng bug THẬT trong `BUGLOG.md` của bạn — đây là lý do phải ghi log bug. Ví dụ mẫu:) Khi chaos test, em thấy stock bị release hai lần khi `payment-failed` và `order-cancelled` cùng đến — hai event đều trigger release. Em debug bằng correlation ID, phát hiện thiếu check trạng thái reservation; fix bằng conditional update: chỉ release khi reservation đang RESERVED. Bài học: compensation cũng phải idempotent và state machine phải chặt.

**Q14: Bạn observe hệ thống này bằng gì?**
**A:** Structured JSON logs bằng pino, mọi log có correlation ID sinh ở gateway và truyền qua cả HTTP header lẫn event payload — grep một ID là thấy cả vòng đời order xuyên 4 service. Health check tách liveness/readiness cho K8s. Bước tiếp theo trong roadmap là prom-client expose metrics RED cho Prometheus/Grafana và OpenTelemetry tracing xuyên qua cả Kafka — em đã thiết kế sẵn chỗ cắm.

**Q15: Nếu làm lại từ đầu, bạn sẽ thay đổi gì?**
**A:** Ba điều: viết integration test với testcontainers sớm hơn thay vì test tay nhiều ở ngày 3-4; định nghĩa event schema bằng schema registry từ đầu vì em từng mất thời gian do hai service hiểu payload khác nhau; và cân nhắc modular monolith trước — với team một người, chi phí vận hành 4 service là thật, em tách vì mục tiêu học. Em nghĩ câu này quan trọng vì microservices là trade-off chứ không phải mặc định đúng.

---

## 💪 Bài tập thực hành (bắt buộc)

Tuần này "bài tập" chính = 6 milestones. Thêm 5 bài kiểm chứng/đào sâu sau, làm xen kẽ sau khi xong milestone tương ứng, độ khó tăng dần:

### Bài 1: Script verify bất biến hệ thống (sau Ngày 4) — Dễ
Viết `scripts/verify-invariants.js` kiểm tra 4 bất biến và in PASS/FAIL:
1. Không order nào ở PENDING quá 60 giây.
2. `sum(stock ban đầu) − sum(stock hiện tại) = tổng quantity của orders CONFIRMED`.
3. Mỗi order CONFIRMED có đúng 1 payment COMPLETED; không order CANCELLED nào giữ payment COMPLETED mà không refund.
4. Số notification = số order ở trạng thái cuối (không trùng, không thiếu).
Chạy script này sau MỌI load test / chaos test.

### Bài 2: Load test có số liệu (sau Ngày 4) — Trung bình
k6 hoặc autocannon: 50 VU × 2 phút bắn `POST /orders`. Thu thập: p50/p95/p99 latency API, thời gian end-to-end saga (created → CONFIRMED, đo bằng timestamp trong history), throughput, error rate. Ghi vào `PERFORMANCE.md` — đây là các con số bạn sẽ nói trong phỏng vấn.

### Bài 3: Kafka rebalance thực nghiệm (sau Ngày 5) — Trung bình
Scale inventory-service lên 3 instance (`docker compose up --scale`), quan sát partition assignment trong log. Trả lời bằng thực nghiệm: topic 3 partition thì instance thứ 4 làm gì? Kill 1 instance đang xử lý dở → message đó đi đâu? Ghi câu trả lời + log bằng chứng vào `BUGLOG.md`.

### Bài 4: Ma trận failure injection (sau Ngày 5) — Khó
Lập bảng 6 kịch bản, mỗi ô ghi: hành vi mong đợi / hành vi thực tế / fix nếu lệch:
(1) Kafka down 30s khi đang tạo order; (2) Redis down — rate limit và lock fallback ra sao (fail-open hay fail-closed?); (3) Mongo down khi reserve; (4) Postgres down khi outbox relay đang chạy; (5) duplicate event bắn tay bằng `kafka-console-producer`; (6) TTL lock rút còn 100ms để giả lập lock hết hạn sớm.

### Bài 5: Demo dry-run + ghi hình (Ngày 6) — Khó
Chạy trọn kịch bản `DEMO.md` 10 phút và GHI HÌNH: kiến trúc (2') → happy path (2') → compensation demo với `PAYMENT_FAIL_RATE=1` (2') → oversell/chaos test (2') → K8s HPA + rolling update (2'). Xem lại video, sửa chỗ vấp, quay lần 2. Video lần 2 là tài liệu ôn tập cho tuần 12.

---

## 📝 Bài test cuối tuần

### Phần 1: Quiz 15 câu trắc nghiệm

**Câu 1:** Outbox pattern giải quyết vấn đề gì?
- A. Consumer xử lý message trùng lặp
- B. Ghi DB và publish event không atomic với nhau (dual-write problem)
- C. Message bị xử lý sai thứ tự
- D. Producer gửi message quá nhanh

<details><summary>Đáp án</summary>

**B.** Outbox ghi event vào bảng trong CÙNG transaction với business data, relay publish sau — loại bỏ trường hợp "ghi DB thành công nhưng mất event". A là việc của idempotent consumer, C là partition key, D là backpressure.
</details>

**Câu 2:** Vì sao partition key của Kafka trong capstone là `orderId`?
- A. Để load phân bố đều tuyệt đối
- B. Để mọi event của cùng một order vào cùng partition, đảm bảo ordering per order
- C. Vì Kafka bắt buộc phải có key
- D. Để giảm số partition cần thiết

<details><summary>Đáp án</summary>

**B.** Kafka chỉ đảm bảo ordering TRONG một partition. Cùng key → cùng partition → event của một order được xử lý đúng thứ tự bởi consumer group. Key có thể gây lệch tải nhẹ (ngược với A); Kafka không bắt buộc key (C sai — không key thì round-robin/sticky).
</details>

**Câu 3:** Idempotent consumer đúng cách là:
- A. Check eventId trong Redis trước khi xử lý, xử lý xong thì set
- B. Check + insert eventId vào bảng processed_events trong CÙNG transaction với business update
- C. Dựa vào Kafka exactly-once là đủ
- D. Chỉ cần commit offset sau khi xử lý xong

<details><summary>Đáp án</summary>

**B.** Nếu check/set tách rời transaction (A), crash giữa chừng tạo khoảng hở: đã đánh dấu processed nhưng business chưa commit (mất) hoặc ngược lại (trùng). C: exactly-once của Kafka chỉ trong phạm vi Kafka transactions, không bao trùm DB ngoài. D chỉ cho at-least-once, vẫn duplicate khi crash sau xử lý trước commit offset.
</details>

**Câu 4:** Vì sao lớp chống oversell quyết định là conditional update ở DB chứ không phải Redis lock?
- A. Redis chậm hơn MongoDB
- B. Lock có TTL — process bị pause (GC, network) quá TTL thì lock hết hạn, process khác chen vào; conditional update atomic tại DB là chốt chặn cuối
- C. MongoDB không hỗ trợ lock
- D. Redis lock không hoạt động khi có nhiều instance

<details><summary>Đáp án</summary>

**B.** Điểm yếu kinh điển của distributed lock (bài toán fencing token — Kleppmann). Lock chỉ để serialize giảm contention; tính đúng đắn cuối cùng phải nằm ở thao tác atomic trên data: `update where stock >= qty`.
</details>

**Câu 5:** Compensation khi payment fail trong capstone gồm:
- A. Xóa order khỏi DB
- B. Release stock đã reserve + order sang CANCELLED + notification
- C. Retry payment vô hạn đến khi thành công
- D. Rollback transaction của order-service

<details><summary>Đáp án</summary>

**B.** Saga không có rollback xuyên service (D sai — transaction tạo order đã commit từ lâu); compensation là transaction MỚI làm ngược tác dụng. Không xóa order (A) vì cần audit trail. C làm hệ thống treo và có thể charge sai.
</details>

**Câu 6:** `FOR UPDATE SKIP LOCKED` trong outbox relay để làm gì?
- A. Tăng tốc query
- B. Cho nhiều relay instance chạy song song: mỗi instance lấy batch row khác nhau, không xử lý trùng, không chờ lock của nhau
- C. Khóa toàn bộ bảng outbox
- D. Bỏ qua các row bị lỗi

<details><summary>Đáp án</summary>

**B.** `FOR UPDATE` khóa row đang lấy; `SKIP LOCKED` khiến instance khác bỏ qua row đã bị khóa thay vì chờ — pattern queue-on-Postgres chuẩn. Lưu ý relay vẫn có thể publish trùng (crash sau publish trước khi update `published_at`) → consumer phải idempotent.
</details>

**Câu 7:** Trong saga choreography, service nào quyết định order chuyển CANCELLED?
- A. inventory-service vì nó phát hiện hết hàng
- B. payment-service vì nó phát hiện thanh toán fail
- C. order-service — chủ sở hữu aggregate order, nghe event fail và tự cập nhật trạng thái của mình
- D. API Gateway

<details><summary>Đáp án</summary>

**C.** Nguyên tắc data ownership: chỉ service sở hữu data mới được đổi trạng thái data đó. Inventory/payment chỉ EMIT sự kiện fail; order-service nghe và tự quyết định trạng thái order.
</details>

**Câu 8:** Khi Redis (rate limiter) down, gateway nên làm gì với capstone này?
- A. Trả 500 cho mọi request
- B. Fail-open: cho request qua, log warning — vì rate limit là bảo vệ phụ, không đáng làm sập toàn hệ thống
- C. Fail-closed: chặn mọi request
- D. Chờ Redis sống lại rồi xử lý tiếp request đang treo

<details><summary>Đáp án</summary>

**B.** Với e-commerce, chặn toàn bộ traffic vì rate limiter chết là thiệt hại lớn hơn rủi ro bị abuse trong thời gian ngắn. Fail-closed (C) chỉ hợp với API cực nhạy cảm (payment authorization). D làm cạn connection. Quan trọng là bạn NÊU ĐƯỢC trade-off này khi phỏng vấn.
</details>

**Câu 9:** Vì sao `POST /orders` trả `202 Accepted` chứ không `201 Created` với trạng thái cuối?
- A. 202 nhanh hơn 201
- B. Vì saga xử lý async — tại thời điểm response, order mới PENDING, kết quả cuối (CONFIRMED/CANCELLED) chưa biết; client poll `GET /orders/:id` hoặc nhận notification
- C. Vì Kafka yêu cầu như vậy
- D. Để tránh duplicate order

<details><summary>Đáp án</summary>

**B.** Đây là hệ quả trực tiếp của eventual consistency trong saga: API chỉ cam kết "đã nhận và sẽ xử lý". Chờ saga xong mới trả (sync) sẽ giữ connection 1-3s và fail theo bất kỳ service nào — mất hết lợi ích decoupling.
</details>

**Câu 10:** Thứ tự đúng trong graceful shutdown của một service consumer là:
- A. Đóng DB pool → đóng consumer → đóng HTTP server
- B. `process.exit(0)` ngay khi nhận SIGTERM
- C. Ngừng nhận request mới (server.close) → disconnect consumer (commit offset) → đóng DB pool → exit
- D. Disconnect consumer → nhận thêm request 10s → exit

<details><summary>Đáp án</summary>

**C.** Nguyên tắc: chặn input mới trước (HTTP + consumer ngừng fetch), drain việc đang dở, rồi mới đóng resource phía dưới (DB). Đóng DB trước (A) làm in-flight request fail. B mất in-flight work và offset chưa commit gây duplicate lớn.
</details>

**Câu 11:** Liveness probe và readiness probe khác nhau thế nào?
- A. Giống nhau, K8s yêu cầu khai 2 lần
- B. Liveness fail → K8s restart container; readiness fail → K8s ngừng route traffic tới pod nhưng không restart
- C. Readiness fail → restart; liveness fail → ngừng traffic
- D. Liveness chỉ dùng cho database

<details><summary>Đáp án</summary>

**B.** Liveness = "process còn sống không, treo thì giết làm lại"; readiness = "đã sẵn sàng nhận traffic chưa (DB/Kafka connect xong chưa)". Để readiness check dependency, còn liveness chỉ check bản thân process — nếu liveness check cả DB thì DB chết sẽ kéo restart loop toàn bộ pods.
</details>

**Câu 12:** Multi-stage Dockerfile trong capstone mang lại lợi ích chính nào?
- A. Container chạy nhanh hơn nhiều lần
- B. Image cuối chỉ chứa production deps + code đã build, không có devDependencies/toolchain → nhỏ hơn nhiều lần và giảm attack surface
- C. Không cần package.json nữa
- D. Tự động scale tốt hơn

<details><summary>Đáp án</summary>

**B.** Build stage có tsc/devDeps; runtime stage copy `node_modules` (chỉ `--omit=dev`) + `dist`. Kết quả ~150MB thay vì ~1GB, pull/deploy nhanh hơn, ít CVE hơn. Kèm non-root user là điểm cộng security.
</details>

**Câu 13:** Order có 2 items: A (còn hàng) và B (hết hàng). Inventory-service phải làm gì?
- A. Reserve A, emit inventory-reserved cho riêng A
- B. Rollback phần đã trừ của A, emit `inventory-failed` cho cả order — reserve phải all-or-nothing theo order
- C. Chờ B có hàng rồi reserve tiếp
- D. Emit cả inventory-reserved và inventory-failed

<details><summary>Đáp án</summary>

**B.** Đơn vị của saga là ORDER, không phải item. Reserve một phần (A, D) tạo trạng thái mồ côi: payment charge thiếu hoặc order giao thiếu hàng. C block consumer vô thời hạn. Đây chính là "local transaction phải atomic" trong từng bước saga.
</details>

**Câu 14:** Tại sao DELETE cache key sau khi update stock thay vì SET giá trị mới?
- A. DELETE nhanh hơn SET
- B. Hai process cùng SET có thể interleave: process đọc data cũ ghi đè sau process ghi data mới → cache giữ data cũ đến hết TTL; DELETE buộc lần đọc sau rebuild từ DB
- C. Redis không cho SET key đã tồn tại
- D. Để tiết kiệm memory

<details><summary>Đáp án</summary>

**B.** Race kinh điển của write-then-set-cache: T1 đọc DB (v1), T2 update DB (v2) + set cache (v2), T1 mới set cache (v1) → cache sai. Delete-on-write thu hẹp đáng kể cửa sổ lỗi và đơn giản hơn.
</details>

**Câu 15:** Một order kẹt PENDING vĩnh viễn vì event `inventory-reserved` lạc mất trước khi payment xử lý (bug hiếm). Cơ chế lưới an toàn đúng là:
- A. Không cần làm gì, đã có outbox
- B. Job định kỳ (reconciliation/timeout sweeper) quét order PENDING quá X phút → tự CANCEL + release reservation nếu có, hoặc re-emit event
- C. Tăng retention của Kafka
- D. Cho user tự xóa order

<details><summary>Đáp án</summary>

**B.** Mọi hệ saga thực tế cần "saga timeout / reconciliation job" làm lưới cuối — phát hiện trạng thái trung gian quá hạn và đưa hệ về trạng thái nhất quán. Outbox (A) chống mất event lúc publish nhưng không chống mọi bug; đây là defense-in-depth. Nói được điều này trong phỏng vấn là dấu hiệu senior.
</details>

### Phần 2: Bài thực hành chấm điểm

**Đề bài:** Demo capstone hoàn chỉnh như một buổi "tech review" 30 phút (tự quay video hoặc trình bày cho bạn/mentor): 10 phút demo theo `DEMO.md` + 20 phút trả lời vấn đáp (người hỏi chọn ngẫu nhiên 8 câu trong Top 15 ở trên + được phép hỏi xoáy "tại sao" 2 tầng).

**Checklist chấm điểm (100 điểm):**

| Tiêu chí | Điểm |
|---|---|
| **Milestones (50đ)** — mỗi milestone đạt DoD: M1(5) M2(10) M3(10) M4(10) M5(10) M6(5) | 50 |
| Happy path live demo: tạo order → CONFIRMED + notification, show timeline | 5 |
| Compensation live demo: `PAYMENT_FAIL_RATE=1` → CANCELLED + stock hoàn lại | 5 |
| Oversell test live: 20 concurrent / stock 5 → đúng 5 CONFIRMED | 5 |
| Chaos demo: kill 1 service dưới load → hệ tự hồi phục, verify-invariants PASS | 5 |
| K8s: pods chạy, probes hoạt động, HPA scale khi load | 5 |
| Vấn đáp: trả lời 8 câu, mỗi câu nêu được trade-off chứ không chỉ mô tả (≥6/8 đạt) | 10 |
| Chịu được câu hỏi xoáy 2 tầng ("tại sao X?" → "thế tại sao không Y?") ở ≥ 3 chủ đề | 5 |
| `BUGLOG.md` có ≥ 3 bug thật kèm cách debug; kể lại 1 bug trôi chảy | 5 |
| Repo: README chạy được < 5 phút, ARCHITECTURE.md, commit history theo milestone | 5 |

---

## ✅ Tiêu chí pass tuần

- [ ] Cả 6 milestones đạt Definition of Done (mục Lý thuyết + spec mục 6).
- [ ] **Demo được end-to-end**: happy path, compensation, chống oversell, chaos recovery — live, không dùng video thay thế.
- [ ] Deploy lên kind/minikube thành công, HPA + rolling update demo được.
- [ ] Quiz: ≥ 12/15 câu đúng.
- [ ] Bài thực hành chấm điểm: ≥ 75/100, trong đó phần vấn đáp ≥ 6/8 câu đạt.
- [ ] Trả lời trôi chảy cả 15 câu "kể về project" mà không nhìn tài liệu, mỗi câu ≤ 90 giây.
- [ ] Repo đã push GitHub, link sẵn sàng đưa vào CV.

Chưa đạt milestone nào → dùng tối đa 2 ngày đệm để hoàn thành TRƯỚC khi sang tuần 12 (tuần 12 cần capstone hoàn chỉnh để mock interview). Nếu buộc phải cắt: ưu tiên giữ M2-M5 (core patterns), giản lược M6 (K8s chỉ cần 1 service làm mẫu + nói được phần còn lại).
