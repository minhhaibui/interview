# Tuần 10: System Design

## 🎯 Mục tiêu tuần này

- Nắm vững **framework 5 bước** để trả lời mọi câu hỏi system design trong phỏng vấn (45-60 phút).
- Hiểu sâu và giải thích được trade-offs của: scalability, load balancing, caching, database scaling, CAP/PACELC, consistency patterns.
- Thiết kế được hệ thống dùng message queue, microservices, distributed transactions (saga pattern).
- Áp dụng thành thạo các pattern: idempotency, rate limiting, circuit breaker, observability.
- Tự giải được 4 bài design kinh điển: URL shortener, rate limiter, notification system, order system — và trình bày trôi chảy trong 45 phút.
- Cuối tuần: hoàn thành 2 bài system design tự làm (45 phút/bài) đạt ≥ 80% checklist.

---

## 📚 Lý thuyết

### Ngày 1-2: Framework trả lời & Nền tảng Scalability

#### 1. Framework 5 bước trả lời câu hỏi System Design

Đây là khung xương sống cho MỌI câu hỏi system design. Luyện đến mức phản xạ:

**Bước 1 — Clarify requirements (5-7 phút)**
- **Functional requirements**: Hệ thống làm gì? Liệt kê 3-5 use case chính, xác nhận với interviewer cái nào in-scope. Ví dụ với URL shortener: tạo short URL, redirect, custom alias?, expiration?, analytics?
- **Non-functional requirements**: Availability bao nhiêu (99.9%? 99.99%?), latency mục tiêu (p99 < 200ms?), consistency yêu cầu mức nào (strong hay eventual?), read-heavy hay write-heavy?
- **Câu hỏi vàng**: "What's the read/write ratio?", "How many DAU?", "Is it okay if data is stale for a few seconds?"

**Bước 2 — Estimate scale (3-5 phút) — Back-of-the-envelope**
- DAU → requests/second: `100M DAU × 10 requests/ngày ÷ 86,400s ≈ 11,600 RPS` (peak = 2-3x average).
- Storage: `số record/ngày × kích thước record × số năm lưu trữ`.
- Bandwidth: `RPS × kích thước response`.
- Số nhớ lòng: 1 ngày ≈ 86,400s (làm tròn 100K cho dễ tính); 1M requests/ngày ≈ 12 RPS; char ≈ 1 byte; UUID ≈ 16 bytes.

**Bước 3 — High-level design (10-15 phút)**
- Vẽ diagram: Client → CDN → Load Balancer → API servers → Cache → DB → Queue → Workers.
- Định nghĩa API chính (REST endpoints hoặc gRPC methods), data model sơ bộ.
- Đi qua từng use case trên diagram để chứng minh design hoạt động.

**Bước 4 — Deep dive (15-20 phút)**
- Interviewer thường lái vào 1-2 component. Chủ động đề xuất: "Tôi nghĩ phần thú vị nhất là X, chúng ta đi sâu vào đó nhé?"
- Các chủ đề hay deep dive: sharding strategy, cache invalidation, hot key problem, race condition, failure handling.

**Bước 5 — Trade-offs & wrap-up (5 phút)**
- Nêu rõ những gì bạn đã đánh đổi: "Tôi chọn eventual consistency để được availability cao hơn, vì use case này chấp nhận stale data vài giây."
- Nêu bottleneck còn lại + hướng mở rộng nếu có thêm thời gian.

> ⚠️ **Lỗi kinh điển của junior**: nhảy thẳng vào vẽ kiến trúc khi chưa clarify. Interviewer sẽ đánh giá thấp ngay lập tức. LUÔN hỏi trước khi vẽ.

#### 2. Scalability: Vertical vs Horizontal

| | Vertical Scaling (scale up) | Horizontal Scaling (scale out) |
|---|---|---|
| Cách làm | Tăng CPU/RAM/Disk của 1 máy | Thêm nhiều máy |
| Ưu điểm | Đơn giản, không đổi code, không lo distributed | Gần như vô hạn, fault tolerance, cost-effective |
| Nhược điểm | Có trần phần cứng, SPOF, giá tăng phi tuyến | Phức tạp: cần LB, stateless, data consistency |
| Khi nào dùng | Giai đoạn đầu, DB chưa quá tải | Khi traffic lớn, cần HA |

- **Node.js cụ thể**: 1 process Node chỉ dùng 1 CPU core → trong 1 máy đã phải "scale out" bằng `cluster` module hoặc PM2 (`pm2 start app.js -i max`). Sau đó scale ngang qua nhiều máy sau load balancer.
- **Điều kiện tiên quyết để scale ngang**: app phải **stateless** — session đẩy vào Redis/JWT, file upload đẩy vào S3, không lưu gì trong memory của process mà request sau cần đọc lại.

#### 3. Load Balancing

**L4 vs L7:**

| | L4 (Transport layer) | L7 (Application layer) |
|---|---|---|
| Hoạt động trên | IP + TCP/UDP port | HTTP headers, URL, cookies, body |
| Tốc độ | Rất nhanh (không parse HTTP) | Chậm hơn (terminate + parse) |
| Khả năng | Chỉ forward packet | Path-based routing (`/api/orders` → order-service), SSL termination, sticky session bằng cookie, compression, WAF |
| Ví dụ | AWS NLB, HAProxy (TCP mode) | AWS ALB, Nginx, HAProxy (HTTP mode), Envoy |

**Algorithms:**
- **Round Robin**: chia đều lần lượt. Đơn giản, phù hợp khi server đồng nhất.
- **Weighted Round Robin**: server mạnh nhận nhiều hơn theo trọng số.
- **Least Connections**: chọn server đang có ít connection nhất — tốt khi request có thời gian xử lý không đều (phù hợp Node.js API có endpoint nhanh/chậm lẫn lộn).
- **IP Hash**: cùng client IP → cùng server (sticky đơn giản, nhưng lệch tải khi nhiều user sau NAT).
- **Consistent Hashing**: hash key → vị trí trên ring; thêm/bớt node chỉ ảnh hưởng ~1/N key. Dùng cho cache cluster, sharding. Phỏng vấn RẤT hay hỏi.
- **Health checks**: LB chủ động gọi `/health` mỗi vài giây, loại node fail khỏi pool (active) hoặc theo dõi lỗi response thực tế (passive).

### Ngày 3-4: Caching, Database Scaling, CAP & Consistency

#### 4. Caching layers

Đi từ ngoài vào trong:

1. **Client cache**: browser cache, `Cache-Control`, `ETag`.
2. **CDN** (CloudFront, Cloudflare): cache static assets + có thể cache API response read-only ở edge. Giảm latency theo địa lý. Invalidation qua versioned URL (`app.v2.js`) hoặc purge API.
3. **Application cache** (Redis/Memcached):
   - **Cache-aside (lazy loading)** — phổ biến nhất:
     ```js
     async function getProduct(id) {
       const cached = await redis.get(`product:${id}`);
       if (cached) return JSON.parse(cached);
       const product = await db.products.findById(id);
       await redis.set(`product:${id}`, JSON.stringify(product), 'EX', 300);
       return product;
     }
     ```
   - **Write-through**: ghi cache + DB cùng lúc → cache luôn fresh, nhưng write chậm hơn.
   - **Write-behind (write-back)**: ghi cache trước, flush DB async → write cực nhanh nhưng rủi ro mất data.
   - **Invalidation khi update**: ưu tiên **delete cache key** thay vì update cache (tránh race condition ghi đè data cũ).
4. **Database cache**: buffer pool (InnoDB), query cache, materialized views.

**Các vấn đề cache kinh điển (deep dive hay hỏi):**
- **Cache stampede / thundering herd**: key hot hết hạn → hàng nghìn request cùng đổ vào DB. Giải pháp: distributed lock (chỉ 1 request rebuild), stale-while-revalidate, TTL jitter (random ±10%).
- **Hot key**: 1 key được đọc quá nhiều → quá tải 1 Redis node. Giải pháp: local in-memory cache (L1) + Redis (L2), hoặc nhân bản key (`key:1`, `key:2`...).
- **Cache penetration**: query key không tồn tại liên tục → luôn miss → đập DB. Giải pháp: cache cả null (TTL ngắn) hoặc Bloom filter.

#### 5. Database scaling

Thứ tự ưu tiên khi DB quá tải (nói đúng thứ tự này là điểm cộng lớn):
1. **Tối ưu trước**: index, query tuning, connection pooling.
2. **Caching**: giảm read load.
3. **Read Replication**: 1 primary (write) + N replicas (read).
   - **Replication lag** → vấn đề **read-your-own-writes**: user vừa update profile, đọc lại từ replica thấy data cũ. Giải pháp: đọc từ primary trong X giây sau khi write, hoặc sticky theo user.
   - Async replication (mặc định, có thể mất data khi primary chết) vs sync (an toàn nhưng chậm).
4. **Federation (functional partitioning)**: tách DB theo domain — `users_db`, `orders_db`, `products_db`. Microservices chính là federation tự nhiên. Nhược: mất JOIN cross-database.
5. **Sharding (horizontal partitioning)**: chia 1 bảng lớn ra nhiều node theo shard key.
   - **Hash-based**: `hash(user_id) % N` → phân bố đều nhưng resharding đau đớn → dùng consistent hashing.
   - **Range-based**: theo khoảng giá trị → tốt cho range query nhưng dễ hot shard (data mới dồn vào 1 shard).
   - **Chọn shard key**: cardinality cao, phân bố đều, xuất hiện trong hầu hết query. Sai shard key = scatter-gather query (hỏi tất cả shard) = thảm họa.
   - Hệ quả: mất cross-shard JOIN và transaction, cần application-level hoặc middleware (Vitess, Citus).

#### 6. CAP & PACELC

- **CAP theorem**: khi xảy ra **network Partition**, hệ phân tán chỉ chọn được 1 trong 2:
  - **CP**: từ chối request để giữ consistency (ví dụ: ZooKeeper, etcd, MongoDB mặc định).
  - **AP**: vẫn phục vụ nhưng có thể trả data cũ (Cassandra, DynamoDB, DNS).
  - Lưu ý khi phỏng vấn: "CA" không tồn tại thực tế trong hệ phân tán vì partition LUÔN có thể xảy ra — câu hỏi thật là *khi partition xảy ra, bạn hy sinh C hay A*.
- **PACELC** — mở rộng thực tế hơn: **P**artition → **A** or **C**; **E**lse (bình thường) → **L**atency or **C**onsistency. Ví dụ: DynamoDB là PA/EL (ưu availability + latency), MongoDB là PC/EC.
- Áp dụng: số dư ngân hàng/tồn kho → cần C; news feed, like count → A/eventual là đủ. Trong 1 hệ thống có thể trộn: order = strong consistency, product view count = eventual.

#### 7. Consistency patterns

- **Strong consistency**: đọc luôn thấy write mới nhất (single-node RDBMS, quorum read/write, linearizable).
- **Eventual consistency**: replicas hội tụ sau một khoảng thời gian; đọc có thể stale.
- **Read-your-own-writes / session consistency**: ít nhất chính user đó thấy write của mình.
- **Monotonic reads**: không bao giờ đọc thấy data "lùi thời gian" (đọc replica A thấy v2, sau đó replica B trả v1 — vi phạm).
- **Quorum**: với N replicas, ghi W bản, đọc R bản; nếu `W + R > N` → đọc chắc chắn chạm ít nhất 1 bản mới nhất. Ví dụ N=3, W=2, R=2.

### Ngày 5-6: Distributed Systems Patterns & Bài design kinh điển

#### 8. Message Queue trong thiết kế

- **Vai trò**: decoupling (producer không cần biết consumer), buffering/load leveling (hấp thụ traffic spike), async processing (trả response ngay, xử lý sau), fan-out (1 event → nhiều consumer).
- **Kafka vs RabbitMQ** (so sánh hay gặp nhất):

| | Kafka | RabbitMQ |
|---|---|---|
| Mô hình | Distributed log, consumer pull | Smart broker, push to consumer |
| Throughput | Hàng triệu msg/s | Hàng chục nghìn msg/s |
| Retention | Giữ message theo thời gian, replay được | Xóa sau khi ack |
| Ordering | Đảm bảo trong 1 partition | Trong 1 queue |
| Routing | Đơn giản (topic/partition) | Linh hoạt (exchange: direct, topic, fanout, headers) |
| Phù hợp | Event streaming, event sourcing, log pipeline, nhiều consumer group | Task queue, RPC, routing phức tạp, priority queue |

- **Delivery semantics**: at-most-once (mất ok), **at-least-once (mặc định thực tế — duplicate có thể xảy ra → consumer PHẢI idempotent)**, exactly-once (rất đắt, Kafka chỉ hỗ trợ trong phạm vi Kafka transactions).
- **Backpressure**: consumer chậm hơn producer → queue phình. Giải pháp: scale consumers (Kafka: tối đa = số partitions), batch processing, rate limit producer, DLQ cho message lỗi.

#### 9. Microservices vs Monolith

| | Monolith | Microservices |
|---|---|---|
| Deploy | 1 đơn vị | Độc lập từng service |
| Scale | Toàn khối | Từng service theo nhu cầu |
| Transaction | ACID dễ dàng | Distributed (saga) — khó |
| Độ phức tạp vận hành | Thấp | Cao: service discovery, tracing, network failure |
| Team | Phù hợp team nhỏ | Phù hợp nhiều team tự chủ |

- **Khi nào tách**: team > ~20 dev giẫm chân nhau; 1 module cần scale/release độc lập (ví dụ: payment cần compliance riêng); tech stack khác nhau cho từng phần; build/deploy monolith quá chậm.
- **Khi nào KHÔNG tách**: startup giai đoạn tìm product-market fit, team < 10 người, domain boundary chưa rõ. Câu trả lời an toàn trong phỏng vấn: **"Start with a modular monolith, tách dần theo domain boundary khi có pain point thực tế"** (Strangler Fig pattern).
- Hệ quả phải xử lý khi tách: network call thay function call (latency, partial failure), data ownership (mỗi service 1 DB), distributed transaction, observability.

#### 10. API Design: REST vs GraphQL vs gRPC

| | REST | GraphQL | gRPC |
|---|---|---|---|
| Format | JSON/HTTP | JSON/HTTP (1 endpoint) | Protobuf/HTTP2 |
| Điểm mạnh | Đơn giản, cache HTTP tốt, phổ cập | Client chọn field (hết over/under-fetching), 1 round trip cho nhiều resource | Nhanh (binary), streaming 2 chiều, codegen strict contract |
| Điểm yếu | Over/under-fetching, nhiều round trip | Cache khó, query phức tạp dễ làm sập server (cần depth/complexity limit), N+1 (cần DataLoader) | Browser không hỗ trợ trực tiếp (cần grpc-web), khó debug |
| Phù hợp | Public API, CRUD | BFF cho mobile/web có nhiều màn hình khác nhau | Internal service-to-service |

- Câu trả lời chuẩn: **public API → REST; client đa dạng cần linh hoạt → GraphQL ở tầng BFF; internal microservices → gRPC** (hoặc REST nếu team chưa quen).
- REST tốt: versioning (`/v1/`), pagination (cursor-based cho data lớn — offset-based chậm dần và lệch khi insert), proper status codes, HATEOAS chỉ cần nhắc tên.

#### 11. Idempotency

- **Định nghĩa**: gọi API N lần cho kết quả y như gọi 1 lần. Bắt buộc cho payment, order — vì retry (client, LB, queue at-least-once) luôn xảy ra.
- **Cơ chế Idempotency Key**:
  1. Client tự sinh key (UUID) gửi trong header `Idempotency-Key`.
  2. Server check key trong Redis/DB: nếu đã có → trả lại response đã lưu, KHÔNG xử lý lại.
  3. Nếu chưa → xử lý, lưu `(key, response)` với TTL (24h), trả response.
  4. Chống race 2 request cùng key cùng lúc: `SET key processing NX` (Redis) hoặc unique constraint trong DB.
- GET/PUT/DELETE vốn idempotent theo ngữ nghĩa; POST thì không → cần key.
- Consumer của message queue cũng cần idempotent: lưu `processed_message_ids`, hoặc dùng UPSERT/conditional update.

#### 12. Distributed Transactions: 2PC vs Saga

**Two-Phase Commit (2PC):**
- Phase 1 (prepare): coordinator hỏi tất cả participants "commit được không?" → khóa resource.
- Phase 2 (commit/abort): tất cả OK → commit; 1 thằng fail → abort hết.
- Nhược điểm chí mạng: **blocking** (coordinator chết giữa chừng → participants khóa resource chờ vô hạn), latency cao, không hợp microservices. Trong phỏng vấn: nhắc tới 2PC để loại nó, rồi đề xuất saga.

**Saga pattern**: chuỗi local transactions; mỗi bước fail → chạy **compensating transactions** để undo các bước trước.

- **Choreography (event-driven)**: các service tự nghe event và phản ứng, không có điều phối trung tâm.
  ```
  order-service:    tạo order (PENDING) → emit "order-created"
  inventory-service: nghe → reserve stock → emit "inventory-reserved" (hoặc "inventory-failed")
  payment-service:   nghe → charge → emit "payment-completed" (hoặc "payment-failed")
  order-service:     nghe "payment-completed" → order CONFIRMED
  -- Compensation: "payment-failed" → inventory-service nghe → release stock; order → CANCELLED
  ```
  Ưu: loose coupling, không SPOF. Nhược: flow khó nhìn toàn cảnh ("đọc code không biết flow đi đâu"), dễ vòng lặp event, khó debug.
- **Orchestration**: 1 orchestrator (ví dụ order-orchestrator, hoặc Temporal/Camunda) gọi tuần tự từng service và quyết định compensation.
  Ưu: flow tường minh 1 chỗ, dễ xử lý timeout/retry. Nhược: orchestrator có thể thành SPOF + "god service", coupling cao hơn.
- **Chọn**: flow ngắn (3-4 bước) → choreography; flow dài, nhiều branch, cần visibility → orchestration.
- Saga chỉ cho **eventual consistency** — phải chấp nhận trạng thái trung gian (order PENDING) và thiết kế compensation cẩn thận (refund, release stock).

#### 13. Rate Limiting

Các thuật toán (đề thi design rate limiter hỏi đủ 4 cái):
- **Fixed Window Counter**: đếm request trong mỗi cửa sổ cố định (vd 100 req/phút). Đơn giản nhưng **burst gấp đôi ở ranh giới** (100 cuối phút này + 100 đầu phút sau = 200 trong 2 giây).
- **Sliding Window Log**: lưu timestamp từng request (Redis sorted set), đếm trong cửa sổ trượt. Chính xác tuyệt đối nhưng tốn memory.
- **Sliding Window Counter**: nội suy giữa 2 fixed window — `count = curr + prev × overlap%`. Cân bằng tốt, thực tế hay dùng.
- **Token Bucket**: bucket chứa tối đa B token, refill r token/s; mỗi request lấy 1 token. **Cho phép burst có kiểm soát** (đến B). Được AWS, Stripe dùng. Implement bằng Redis Lua script để atomic.
- **Leaky Bucket**: queue + xử lý với tốc độ cố định → output mượt tuyệt đối, nhưng request có thể chờ lâu.
- Distributed: counter đặt ở Redis (shared) — chấp nhận hơi over/under-limit do race, hoặc Lua script cho atomic. Trả `429 Too Many Requests` + headers `X-RateLimit-Remaining`, `Retry-After`.

#### 14. Circuit Breaker

- **Vấn đề**: service B chết, service A cứ gọi và chờ timeout → thread/connection của A cạn → **cascading failure** lan toàn hệ thống.
- **3 trạng thái**:
  - **CLOSED**: bình thường, đếm tỷ lệ lỗi. Lỗi vượt ngưỡng (vd 50% trong 10s) → mở.
  - **OPEN**: fail fast ngay lập tức không gọi B (trả lỗi/fallback). Sau timeout (vd 30s) → half-open.
  - **HALF-OPEN**: cho 1 vài request thử. Thành công → CLOSED; fail → OPEN tiếp.
- Node.js: thư viện `opossum`. Kết hợp với: **timeout** (mọi external call PHẢI có timeout), **retry với exponential backoff + jitter** (chỉ retry lỗi transient, jitter tránh retry storm), **fallback** (trả cache cũ, default value, hoặc degrade gracefully), **bulkhead** (pool riêng cho từng dependency).

#### 15. Observability — 3 trụ cột

- **Logging**: structured JSON logs (pino/winston), tập trung về ELK/Loki/CloudWatch. Mỗi log có `correlation-id`/`request-id` truyền qua mọi service (header `x-request-id`) để trace 1 request xuyên hệ thống. KHÔNG log PII, password, token.
- **Metrics**: số liệu aggregate theo thời gian — Prometheus + Grafana. Nhớ 2 framework:
  - **RED** (cho service): Rate, Errors, Duration (latency p50/p95/p99).
  - **USE** (cho resource): Utilization, Saturation, Errors.
  - Node.js riêng: event loop lag, heap usage, active handles.
  - Alert dựa trên **SLO** (vd 99.9% request < 500ms), tránh alert fatigue.
- **Distributed Tracing**: OpenTelemetry + Jaeger/Tempo/Zipkin. 1 request = 1 trace gồm nhiều span (mỗi hop 1 span); context (`traceparent` header — W3C Trace Context) tự động propagate qua HTTP/Kafka. Trả lời câu "request chậm ở service nào?".
- Phân biệt nhanh: **monitoring** = biết trước những gì cần hỏi (dashboards, alerts); **observability** = đủ dữ liệu để hỏi câu hỏi CHƯA biết trước khi sự cố xảy ra.

#### 16. Bốn bài design kinh điển — lời giải tóm tắt

**(a) Design URL Shortener (TinyURL)**
- Requirements: shorten + redirect; 100M URL mới/tháng; read:write = 100:1; latency redirect < 100ms; URL không được đoán tuần tự (tùy chọn).
- Estimate: write ~40/s, read ~4,000/s; storage 5 năm: 100M × 12 × 5 × 500 bytes ≈ 3 TB.
- Key design: short code = **base62** của ID. Sinh ID: counter range (mỗi app server nhận 1 dải ID từ ZooKeeper/DB, vd 1M ID/lần) hoặc Snowflake ID. 7 ký tự base62 = 62^7 ≈ 3.5 nghìn tỷ — quá đủ.
- Redirect: `GET /{code}` → check cache (cache-aside, hit rate cao vì hot URLs theo phân phối 80/20) → DB → **HTTP 301** (permanent, browser cache, giảm tải) vs **302** (cần analytics đếm click — chọn 302 nếu yêu cầu analytics).
- DB: key-value là đủ (DynamoDB/Cassandra) vì không cần relation; hoặc PostgreSQL + cache nếu scale vừa. Sharding theo hash(code).
- Deep dive thường gặp: custom alias (unique constraint + check trước), expiration (TTL + lazy delete + batch cleanup), analytics (ghi event vào Kafka, xử lý async — KHÔNG ghi sync trong redirect path).

**(b) Design Rate Limiter (distributed)**
- Requirements: limit theo user/IP/API key, nhiều rule (10 req/s và 1000 req/h), chạy trên nhiều instance, latency thêm < 5ms, fail-open hay fail-closed?
- Vị trí: middleware tại API Gateway (chặn sớm nhất).
- Thuật toán: **Token bucket trên Redis + Lua script** (đọc-tính-ghi atomic trong 1 lần gọi):
  ```lua
  -- KEYS[1]=bucket key, ARGV: capacity, refill_rate, now
  -- đọc tokens + last_refill → tính token mới = min(capacity, tokens + elapsed*rate)
  -- nếu >= 1 thì trừ 1, trả 1 (allow); ngược lại trả 0 (deny)
  ```
- Rules lưu cache local + refresh từ config store. Response 429 + `Retry-After`.
- Trade-offs phải nêu: Redis chết thì sao → **fail-open** (cho qua, ưu UX) vs fail-closed (chặn, ưu an toàn — chọn cho payment); race giữa các instance → Lua giải quyết; multi-region → mỗi region 1 Redis, chấp nhận limit xấp xỉ.

**(c) Design Notification System**
- Requirements: 3 kênh (push, email, SMS), 10M notifications/ngày, không gửi trùng, retry khi fail, user preferences (opt-out), soft real-time (trễ vài giây OK).
- Kiến trúc:
  ```
  Services → Notification API → validate + check preferences/rate cap
           → Kafka (topic per channel: push / email / sms)
           → Workers per channel → 3rd party (FCM/APNs, SES, Twilio)
           → fail → retry với backoff → vượt N lần → DLQ
  ```
- Điểm nhấn: queue để hấp thụ spike + decouple 3rd party chậm; **idempotency key per notification** chống gửi trùng (dedupe bằng Redis SETNX); template service tách riêng nội dung; priority queue (OTP đi nhanh hơn marketing); tracking delivery status (webhook từ provider → update DB); rate limit per user (tránh spam 1 user).

**(d) Design Order System (e-commerce checkout)**
- Requirements: đặt hàng, check tồn kho (KHÔNG oversell), thanh toán, notification; 10K orders/phút peak (flash sale); order data cần strong consistency.
- Kiến trúc: API Gateway → order-service (PostgreSQL) + inventory-service (DB + Redis) + payment-service → Kafka event bus → saga choreography (như mục 12).
- Deep dive bắt buộc nắm:
  - **Chống oversell**: atomic conditional update `UPDATE inventory SET stock = stock - 1 WHERE id = $1 AND stock >= 1` (check affected rows), hoặc Redis `DECR` + Lua check, hoặc distributed lock (Redlock) cho flow phức tạp. Flash sale: pre-load stock vào Redis, DB chỉ ghi async.
  - **Outbox pattern**: ghi order + event vào CÙNG 1 DB transaction (bảng `outbox`), relay process/Debezium đọc outbox đẩy lên Kafka → không bao giờ "ghi DB thành công nhưng mất event".
  - **Payment idempotency**: idempotency key per order, không charge 2 lần khi retry.
  - **Compensation**: payment fail → release reserved stock, order → CANCELLED.
  - Đây chính là **capstone project tuần 11** — học kỹ bài này.

---

## 💬 Top 15 câu hỏi phỏng vấn thường gặp

**Q1: Bạn tiếp cận một câu hỏi system design như thế nào?**
**A:** Tôi đi theo 5 bước: clarify functional + non-functional requirements, estimate scale (RPS, storage), vẽ high-level design và đi qua từng use case, deep dive vào 1-2 component quan trọng nhất, cuối cùng tổng kết trade-offs và bottlenecks. Tôi luôn xác nhận read/write ratio và yêu cầu consistency trước khi vẽ vì chúng quyết định toàn bộ kiến trúc.

**Q2: Horizontal scaling yêu cầu điều kiện gì ở application layer?**
**A:** App phải stateless: session lưu ở Redis hoặc dùng JWT, file lưu ở object storage như S3, không giữ state trong memory process. Ngoài ra cần load balancer phía trước với health check, và DB/cache phải chịu được số connection tăng lên — thường giải bằng connection pooling hoặc proxy như PgBouncer.

**Q3: Khác nhau giữa L4 và L7 load balancer?**
**A:** L4 hoạt động ở tầng TCP/UDP, chỉ forward packet dựa trên IP/port nên rất nhanh nhưng không hiểu nội dung. L7 terminate HTTP nên route được theo path/header/cookie, làm SSL termination và sticky session, đổi lại chậm hơn. Thực tế tôi dùng L7 (ALB/Nginx) cho routing microservices, L4 (NLB) khi cần throughput cực cao hoặc protocol non-HTTP.

**Q4: Cache stampede là gì và xử lý thế nào?**
**A:** Là khi một hot key hết hạn, hàng nghìn request cùng cache miss và đồng loạt đổ vào DB. Tôi xử lý bằng distributed lock để chỉ một request rebuild cache trong khi số còn lại trả stale data hoặc chờ, kết hợp TTL jitter để các key không hết hạn cùng lúc, và stale-while-revalidate cho key cực hot.

**Q5: Khi nào chọn sharding thay vì read replica?**
**A:** Read replica giải quyết read-heavy workload nhưng không giúp gì khi bottleneck là write hoặc dataset quá lớn so với 1 máy. Khi đó mới sharding — chia data theo shard key ra nhiều node. Tôi luôn làm theo thứ tự: index/query tuning → caching → replication → sharding cuối cùng, vì sharding đánh đổi cross-shard transaction và JOIN.

**Q6: Giải thích CAP theorem và cho ví dụ áp dụng thực tế?**
**A:** Khi network partition xảy ra, hệ phân tán phải chọn giữa Consistency (từ chối request, trả lỗi) hoặc Availability (phục vụ nhưng có thể stale). Ví dụ: số tiền trong tài khoản hoặc tồn kho tôi chọn CP; news feed hay view count chọn AP. PACELC mở rộng thêm: ngay cả khi không partition, vẫn phải đánh đổi giữa latency và consistency.

**Q7: Replication lag gây ra vấn đề gì và bạn xử lý ra sao?**
**A:** Vấn đề điển hình là read-your-own-writes: user vừa update xong, đọc lại từ replica thấy data cũ. Tôi xử lý bằng cách route read của chính user đó về primary trong vài giây sau khi write, hoặc dùng session sticky/timestamp để đảm bảo replica đã catch up. Với data không nhạy cảm thì chấp nhận eventual consistency.

**Q8: Tại sao chọn Kafka thay vì RabbitMQ (hoặc ngược lại)?**
**A:** Kafka là distributed log: throughput rất cao, giữ message để replay, nhiều consumer group đọc độc lập — hợp event streaming và event-driven microservices. RabbitMQ là smart broker: routing linh hoạt, per-message ack, priority — hợp task queue và RPC. Tôi chọn Kafka khi cần event bus cho nhiều service cùng tiêu thụ và cần replay; RabbitMQ khi cần work queue đơn giản với routing phức tạp.

**Q9: At-least-once delivery nghĩa là gì với consumer của bạn?**
**A:** Nghĩa là message có thể được giao nhiều lần (do retry, rebalance), nên consumer bắt buộc phải idempotent. Tôi implement bằng cách lưu processed message ID vào DB/Redis và skip duplicate, hoặc thiết kế thao tác tự nhiên idempotent như UPSERT và conditional update thay vì increment mù.

**Q10: Saga pattern là gì, so sánh choreography và orchestration?**
**A:** Saga thay thế distributed transaction bằng chuỗi local transaction, mỗi bước fail thì chạy compensating transaction để undo các bước trước — chấp nhận eventual consistency. Choreography để các service tự nghe event và phản ứng, loose coupling nhưng flow khó theo dõi; orchestration có một điều phối viên gọi tuần tự, flow tường minh dễ debug nhưng thêm một điểm tập trung. Flow ngắn tôi dùng choreography, flow dài nhiều nhánh thì orchestration.

**Q11: Tại sao 2PC ít được dùng trong microservices?**
**A:** 2PC blocking: participants phải khóa resource trong cả 2 phase, nếu coordinator chết giữa chừng thì resource bị khóa vô thời hạn. Nó cũng tăng latency và yêu cầu mọi service hỗ trợ protocol XA, làm giảm availability của toàn chuỗi. Vì vậy microservices ưu tiên saga với compensation, đổi strong consistency lấy availability.

**Q12: Làm sao đảm bảo idempotency cho payment API?**
**A:** Client sinh idempotency key gửi kèm request; server check key trong Redis hoặc DB với unique constraint — nếu đã tồn tại thì trả lại response đã lưu thay vì xử lý lại. Để chống hai request cùng key chạy đồng thời, tôi dùng SET NX đánh dấu "processing" trước khi thực thi. Key lưu kèm response với TTL khoảng 24 giờ, giống cách Stripe làm.

**Q13: So sánh các thuật toán rate limiting, bạn chọn cái nào cho production?**
**A:** Fixed window đơn giản nhưng bị burst gấp đôi ở ranh giới cửa sổ; sliding window log chính xác nhưng tốn memory; token bucket cho phép burst có kiểm soát và tính toán rẻ. Production tôi thường chọn token bucket hoặc sliding window counter, implement trên Redis với Lua script để atomic giữa nhiều instance, và trả 429 kèm Retry-After.

**Q14: Circuit breaker hoạt động thế nào và khác gì retry?**
**A:** Circuit breaker có 3 trạng thái: CLOSED đếm lỗi, vượt ngưỡng thì OPEN — fail fast không gọi downstream nữa, sau timeout chuyển HALF-OPEN thử vài request để quyết định đóng lại. Retry giải quyết lỗi transient ngắn, còn circuit breaker bảo vệ khi downstream chết hẳn — retry vào service đang chết chỉ làm nó chết thêm. Tôi luôn dùng cả hai cùng timeout và fallback, ví dụ với thư viện opossum trong Node.js.

**Q15: Ba trụ cột của observability là gì? Distributed tracing giải quyết vấn đề gì?**
**A:** Logging (structured logs có correlation ID), metrics (RED: rate, errors, duration — Prometheus/Grafana) và distributed tracing (OpenTelemetry/Jaeger). Tracing giải quyết câu hỏi "request này chậm hoặc fail ở service nào trong chuỗi": mỗi request là một trace gồm nhiều span, context propagate qua header traceparent xuyên qua HTTP lẫn Kafka, nên nhìn một waterfall là thấy ngay bottleneck.

---

## 💪 Bài tập thực hành (bắt buộc)

### Bài 1: Back-of-the-envelope drills (Dễ)
Tính tay (không máy tính) rồi mới kiểm tra lại, cho 3 hệ thống:
1. Chat app: 50M DAU, mỗi user gửi 40 messages/ngày, mỗi message 100 bytes → tính RPS trung bình, peak (x3), storage/năm.
2. Video platform: 10M DAU, mỗi user xem 5 video, mỗi video metadata request 2KB → bandwidth metadata.
3. E-commerce: 1M orders/ngày, mỗi order 2KB + 5 events Kafka 500 bytes → write RPS vào DB và Kafka, storage 3 năm.
- **Yêu cầu nộp**: file `estimates.md` với từng bước tính. Mục tiêu: làm mỗi bài < 5 phút.

### Bài 2: Implement Rate Limiter middleware (Trung bình)
Viết Express/Fastify middleware rate limit bằng **token bucket trên Redis**:
- Limit theo API key (header `x-api-key`), config: 10 req/s, burst 20.
- Dùng Lua script để check-and-decrement atomic.
- Trả `429` + headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`.
- Viết test bắn 100 request đồng thời (Promise.all) chứng minh đúng ~20 pass.
- **Bonus**: thêm chế độ fail-open khi Redis down.

### Bài 3: Idempotent payment endpoint (Trung bình)
Xây `POST /payments` với idempotency hoàn chỉnh:
- Header `Idempotency-Key` bắt buộc (thiếu → 400).
- Lần đầu: xử lý (giả lập 500ms), lưu key + response vào PostgreSQL (unique constraint) hoặc Redis.
- Gọi lại cùng key: trả lại đúng response cũ, status `200` + header `Idempotent-Replayed: true`.
- Hai request cùng key ĐỒNG THỜI: chỉ 1 cái xử lý, cái kia chờ hoặc trả `409 Conflict`.
- Viết test chứng minh cả 3 case.

### Bài 4: Circuit breaker + retry tự viết (Khó)
Không dùng thư viện, tự viết class `CircuitBreaker`:
- Config: `failureThreshold` (%), `windowSize` (số request), `openTimeout`, `halfOpenMaxCalls`.
- Wrap một HTTP call tới mock server (tự dựng, có endpoint `/flaky` fail theo tỷ lệ điều khiển được).
- Kết hợp retry với exponential backoff + jitter (max 3 lần) BÊN TRONG breaker.
- Emit event khi đổi trạng thái, in metrics: tổng calls, short-circuited, success rate.
- Test scenario: mock server chết 30s → breaker OPEN → hồi phục → HALF-OPEN → CLOSED. So sánh kết quả với `opossum`.

### Bài 5: Mini saga choreography (Khó)
Dựng 3 service Node.js nhỏ (3 process, có thể chung repo) + Redis Streams hoặc Kafka (docker-compose):
- `order-service`: `POST /orders` → ghi order PENDING (SQLite/Postgres) → emit `order-created`.
- `inventory-service`: nghe `order-created` → trừ stock (atomic, stock được seed = 5) → emit `inventory-reserved` hoặc `inventory-failed`.
- `payment-service`: nghe `inventory-reserved` → giả lập charge (random fail 30%) → emit `payment-completed`/`payment-failed`.
- `order-service` nghe kết quả → CONFIRMED/CANCELLED; `inventory-service` nghe `payment-failed` → release stock.
- **Kiểm chứng**: bắn 10 orders, kiểm tra cuối cùng `tổng stock đã trừ = số order CONFIRMED`, không âm kho, không order kẹt PENDING. Đây là bản nháp cho capstone tuần 11.

---

## 📝 Bài test cuối tuần

### Phần 1: 2 bài System Design tự làm (45 phút/bài, thay cho quiz)

Làm như phỏng vấn thật: bấm giờ 45 phút, nói thành tiếng (hoặc ghi âm), vẽ diagram trên giấy/Excalidraw, viết notes. KHÔNG tra tài liệu trong lúc làm.

**Đề 1: Design a Ride-Sharing Backend (kiểu Grab/Uber — phần matching đơn giản hóa)**
> Yêu cầu: rider tạo request, tìm driver gần nhất trong bán kính 5km, driver accept/reject, track vị trí driver real-time (update mỗi 4s), 1M active drivers, 100K concurrent rides. Tập trung: location updates ingest, matching, trạng thái ride.

**Đề 2: Design a Flash Sale System**
> Yêu cầu: 1 sản phẩm 10,000 units, 1M users đổ vào lúc 12:00:00, không oversell, mỗi user mua tối đa 1, kết quả công bằng (FCFS xấp xỉ), hệ thống không sập. Tập trung: chống oversell, hấp thụ spike, chống bot cơ bản.

**Checklist tự chấm (mỗi đề, 20 điểm — quay lại video/notes của mình và chấm trung thực):**

| # | Tiêu chí | Điểm |
|---|---|---|
| 1 | Clarify ≥ 4 câu hỏi requirements trước khi vẽ (functional + non-functional) | 2 |
| 2 | Estimate: RPS, storage, có số cụ thể và cách tính | 2 |
| 3 | High-level diagram đầy đủ: client → LB → services → cache → DB → queue | 3 |
| 4 | Định nghĩa API chính (endpoint + payload) và data model | 2 |
| 5 | Đi qua (walk through) ít nhất 2 use case chính trên diagram | 2 |
| 6 | Deep dive đúng trọng tâm đề (đề 1: geo-index/matching; đề 2: chống oversell) | 3 |
| 7 | Xử lý failure: nêu được ≥ 2 failure mode và cách handle (retry, DLQ, breaker...) | 2 |
| 8 | Nêu ≥ 3 trade-offs có lý do (consistency vs availability, SQL vs NoSQL, push vs pull...) | 2 |
| 9 | Quản lý thời gian: xong wrap-up trong 45 phút, không sa đà 1 phần > 20 phút | 1 |
| 10 | Nêu bottleneck còn lại + hướng mở rộng | 1 |

**Gợi ý đáp án để đối chiếu SAU khi tự chấm:**
- Đề 1: location updates → ingest qua gateway, ghi Redis (key `driver:{id}` + TTL); geo-query bằng Redis GEO (`GEOADD`/`GEOSEARCH`) hoặc geohash/S2; matching service lấy top-K driver gần nhất, gửi offer qua push, lock driver bằng Redis SETNX tránh 2 ride cùng 1 driver; trạng thái ride là state machine trong PostgreSQL; location history đẩy Kafka → S3 cho analytics.
- Đề 2: pre-load 10,000 vào Redis counter; gate bằng queue (user vào waiting room/token); `DECR` atomic hoặc Lua check-decr — âm thì trả hết hàng ngay (fail fast); thành công → đẩy order vào Kafka, ghi DB async; idempotency per user (`SETNX sale:{saleId}:user:{userId}`) đảm bảo 1 user 1 đơn; CDN + static page cho phần đọc; rate limit + CAPTCHA chống bot.

### Phần 2: Bài thực hành chấm điểm

**Đề bài:** Hoàn thiện **Bài 5 (mini saga)** thành phiên bản "production-lite", thêm:
1. Idempotent consumer cho cả 3 service (xử lý duplicate event không hỏng data).
2. DLQ: event xử lý fail 3 lần → đẩy vào stream/topic `*.dlq` kèm lý do lỗi.
3. Endpoint `GET /orders/:id` trả order + lịch sử trạng thái (event log).
4. Health check `/health` (check được DB + broker connection) cho mỗi service.
5. Chaos test script: kill payment-service giữa chừng 20s rồi bật lại → chứng minh không mất order, không sai kho.

**Checklist chấm điểm (100 điểm):**

| Tiêu chí | Điểm |
|---|---|
| Saga flow chạy đúng happy path (order → reserved → paid → CONFIRMED) | 15 |
| Compensation đúng: payment fail → release stock → CANCELLED | 15 |
| Idempotent consumer: replay cùng event 2 lần, data không đổi | 15 |
| DLQ hoạt động: event độc (poison message) vào DLQ sau 3 retries, kèm error metadata | 10 |
| Không oversell: 20 orders đồng thời với stock=5 → đúng 5 CONFIRMED | 15 |
| Chaos test pass: kill/restart service không mất event, không order kẹt vĩnh viễn | 15 |
| Health check + graceful shutdown (đóng consumer trước, drain rồi mới exit) | 10 |
| Code sạch: tách layer, config qua env, README hướng dẫn chạy | 5 |

---

## ✅ Tiêu chí pass tuần

- [ ] Trình bày lại framework 5 bước không cần nhìn tài liệu, kèm timeline phân bổ phút.
- [ ] Hoàn thành cả 5 bài thực hành; bài 5 chạy được end-to-end.
- [ ] 2 bài system design cuối tuần: mỗi bài ≥ 16/20 điểm theo checklist tự chấm.
- [ ] Bài thực hành chấm điểm: ≥ 75/100.
- [ ] Trả lời trôi chảy 12/15 câu hỏi phỏng vấn (nhờ bạn hỏi xáo trộn thứ tự, trả lời không quá 1 phút/câu).
- [ ] Giải thích được trên giấy trắng: saga choreography cho order flow, token bucket, circuit breaker state machine, outbox pattern — mỗi cái < 3 phút.

Nếu chưa đạt: dành thêm 2 ngày làm lại 2 đề design với đề mới (design Twitter timeline, design chat app) trước khi sang tuần 11. **Tuần 11 (capstone) sẽ dùng trực tiếp kiến thức tuần này.**
