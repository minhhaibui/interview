# 🔬 Đào sâu — Tuần 11: Capstone & Distributed Patterns

> README đã cho bạn lịch thi công và 15 câu "kể project"; file này đào xuống TẦNG LÝ THUYẾT PHÂN TÁN bên dưới mỗi quyết định — đủ để chịu câu hỏi xoáy 3 tầng của interviewer senior.

## 🧠 Pattern phân tán cốt lõi (đào sâu)

### 1. Saga: Choreography vs Orchestration

Saga = một **chuỗi local transaction**, mỗi transaction commit ở một service và publish event kích hoạt bước kế. Khi một bước fail, chạy **compensating transaction** đi ngược lại các bước đã xong. Saga thay thế cho distributed transaction (2PC) vì 2PC không hợp với microservices.

**Vì sao KHÔNG dùng 2PC (Two-Phase Commit):**
- 2PC cần một **coordinator** giữ lock trên TẤT CẢ resource trong suốt prepare→commit. Lock kéo dài xuyên service = giảm throughput thảm hại.
- **Blocking protocol**: nếu coordinator chết sau phase 1 (prepare), các participant kẹt giữ lock vô thời hạn (in-doubt). Không có timeout an toàn.
- Đòi hỏi mọi DB hỗ trợ XA transaction — Mongo/Kafka/Redis thì không. 2PC không co giãn (không scale) và đi ngược triết lý "mỗi service một DB".
- → Microservices chấp nhận **eventual consistency** qua saga thay vì **strong consistency** qua 2PC.

| | **Choreography** (capstone dùng) | **Orchestration** |
|---|---|---|
| Điều phối | Không có trung tâm; mỗi service nghe event tự phản ứng | Một orchestrator gọi/ra lệnh từng bước |
| Coupling | Loose — thêm service không sửa service cũ | Service phụ thuộc orchestrator |
| Nhìn toàn cảnh flow | Khó — logic rải khắp, phải đọc nhiều service | Dễ — flow nằm một chỗ |
| Nguy cơ | Vòng lặp event ngầm, khó debug | Orchestrator thành single point of failure + "god service" |
| Hợp khi | Flow ngắn (≤4 bước), ít branch | Flow dài, nhiều nhánh điều kiện, cần timeout/retry tập trung |
| Công cụ | Kafka thuần | Temporal, AWS Step Functions, Camunda |

**Compensating transaction — 3 tính chất bắt buộc:**
- **Semantic undo, không phải rollback**: order đã commit, không xóa được. Compensation là transaction MỚI làm ngược tác dụng (release stock, set CANCELLED). Giữ lại bản ghi để audit.
- **Idempotent**: compensation có thể chạy lại (event trùng) → phải check trạng thái trước (chỉ release khi reservation đang `RESERVED`).
- **Commutative/an toàn theo thứ tự**: `payment-failed` và `order-cancelled` có thể đến lệch thứ tự → conditional update bảo vệ.

> Phân loại bước saga (Garcia-Molina): **compensatable** (reserve stock — có thể undo), **pivot** (charge payment — điểm không quay lại), **retriable** (confirm order — phải thành công bằng retry). Pivot xác định ranh giới: trước pivot thì compensate, sau pivot thì forward-recover.

### 2. Outbox Pattern — giải quyết Dual-Write

**Dual-write problem:** một thao tác nghiệp vụ cần ghi 2 nơi (Postgres + Kafka). Không có transaction xuyên cả hai → 4 trường hợp, 2 trong số đó hỏng:

```
①  DB commit OK  +  Kafka publish OK   → đúng
②  DB commit OK  +  Kafka publish FAIL → order tồn tại nhưng KHÔNG ai biết (mất event)
③  DB FAIL       +  Kafka publish OK   → event "order-created" cho order KHÔNG tồn tại (ghost)
④  cả hai fail                          → đúng (không làm gì)
```
Đảo thứ tự (publish trước, ghi sau) chỉ đổi ② thành ③, không giải quyết được.

**Transactional Outbox + Relay:** ghi event vào bảng `outbox` trong CÙNG transaction với business data → atomic (chỉ còn ① và ④). Một **relay** poll bảng đó publish lên Kafka.

```
┌─ TRANSACTION (Postgres) ────────────┐
│  INSERT orders (PENDING)            │   ← business
│  INSERT order_items                 │
│  INSERT outbox (order-created, ...) │   ← event, cùng tx
└─ COMMIT (atomic) ───────────────────┘
                │
        Relay loop (poll 500ms)
                │  SELECT ... WHERE published_at IS NULL
                │  FOR UPDATE SKIP LOCKED
                ▼
            Kafka (key = orderId)  → UPDATE outbox SET published_at = now()
```

- **Ordering theo aggregate**: dùng `orderId` làm Kafka partition key → mọi event của một order vào cùng partition → consumer thấy đúng thứ tự. Trong outbox, sort theo `id` (sequence) để publish theo thứ tự sinh ra.
- **At-least-once cố hữu**: relay có thể crash SAU publish, TRƯỚC khi update `published_at` → event được publish 2 lần. Đây là lý do **gốc rễ** vì sao consumer BẮT BUỘC idempotent.
- **Production**: thay relay tự viết bằng **Debezium CDC** đọc trực tiếp Postgres WAL (Write-Ahead Log) → không tốn query polling, độ trễ thấp, không bỏ sót.

### 3. Idempotency — vì sao MỌI consumer phải idempotent

Kafka (và hầu hết message broker) cho **at-least-once delivery**. Duplicate xảy ra vì: consumer xử lý xong nhưng crash trước khi commit offset; rebalance khi scale/deploy; outbox relay publish lại; producer retry sau timeout giả.

> "Exactly-once" của Kafka chỉ đúng TRONG biên giới Kafka (Kafka transactions, read-process-write giữa các topic). Nó KHÔNG bao trùm side effect ra ngoài: ghi Postgres, charge Stripe, gửi email. Vì vậy thực tế ta thiết kế cho at-least-once + idempotent.

**Cách đúng — dedupe table trong cùng transaction:**
```sql
BEGIN;
  -- nếu eventId đã xử lý → unique violation → ROLLBACK, skip an toàn
  INSERT INTO processed_events (event_id) VALUES ($1);
  UPDATE inventory SET stock = stock - $2 WHERE ...;  -- business
COMMIT;
```
Mấu chốt: **đánh dấu processed và business update phải atomic**. Nếu tách (check Redis trước, set sau) → crash giữa khe hở tạo ra mất hoặc trùng.

3 tầng idempotency trong capstone:
1. **Idempotency-Key** (API layer): client gửi key, unique constraint chặn double-submit do user/retry HTTP.
2. **processed_events** (consumer layer): dedupe theo eventId cho mọi consumer.
3. **Business unique constraint**: `payment(order_id)` UNIQUE → không thể có 2 payment cho 1 order, kể cả khi 2 tầng trên lọt.

### 4. Inbox Pattern (đối xứng với Outbox)

Outbox đảm bảo event được **gửi** chắc chắn; **Inbox** đảm bảo event được **nhận & xử lý đúng một lần về mặt hiệu ứng**. Consumer ghi message nhận được vào bảng `inbox` (PK = eventId) trong cùng transaction với xử lý → bảng `processed_events` của capstone CHÍNH LÀ một dạng inbox tối giản. Inbox đầy đủ còn lưu payload để có thể re-process khi logic đổi.

### 5. Distributed Tracing & Correlation ID

- **Correlation ID** (capstone đã có): một `x-request-id` sinh ở gateway, truyền qua HTTP header VÀ nhúng vào event payload/Kafka header → grep 1 ID thấy cả vòng đời order xuyên 4 service. Đây là mức tối thiểu.
- **Trace / Span** (bước nâng cấp, OpenTelemetry): một **trace** = toàn bộ hành trình một request; gồm nhiều **span** (mỗi đơn vị công việc: HTTP handler, DB query, Kafka publish/consume). Span có `traceId` chung + `spanId` riêng + `parentSpanId`.
- **Propagation xuyên Kafka**: nhét `traceparent` (W3C Trace Context) vào **Kafka message header**, consumer đọc ra để nối span của mình vào trace gốc → thấy được "saga này tốn 2.3s, nghẽn ở payment 1.8s".
- Correlation ID trả lời "request này log gì"; tracing trả lời "thời gian đi đâu, nghẽn ở khâu nào".

## 🧪 Ví dụ thiết kế & code (sát capstone)

### Sơ đồ luồng đặt hàng qua Saga (choreography + compensation)

```
 Client          order-svc        inventory-svc      payment-svc      notif-svc
   │  POST /orders   │                  │                 │              │
   ├────────────────>│ tx: order PENDING│                 │              │
   │   202 Accepted  │     + outbox     │                 │              │
   │<────────────────┤                  │                 │              │
   │           [order-created]─────────>│ reserve stock   │              │
   │                 │                  │ (lock+condUpd)  │              │
   │                 │                  │                 │              │
   │      ┌──────────┴── HAPPY PATH ────┴─────────────────┴──────────────┤
   │      │     [inventory-reserved]───────────────────>│ fakeCharge     │
   │      │          │                  │          [payment-completed]   │
   │      │  CONFIRMED│<─────────────────────────────────┤               │
   │      │  +outbox  │             [payment-completed]──>│ COMMIT reserv │
   │      │     [order-confirmed]──────────────────────────────────────> │ notify ✅
   │      │
   │      └──────────┬── COMPENSATION (payment fail / oversell) ─────────┤
   │                 │                  │          [payment-failed]      │
   │                 │  CANCELLED       │<─── [payment-failed] ──────────┤
   │                 │  +outbox         │  release stock                 │
   │                 │                  │  (chỉ khi RESERVED)            │
   │      [order-cancelled]──────────────────────────────────────────────> notify ❌
   │
   │   Nhánh oversell: inventory emit [inventory-failed] (bỏ qua payment)
   │     → order-svc CANCELLED → order-cancelled → notify
```
Điểm chốt: **pivot = payment charge**. Trước pivot fail → compensate (release). Sau pivot thành công → forward (confirm + commit reservation), không quay lại.

### Outbox: insert trong cùng transaction + relay

```js
// order-service: tạo order — business + event ATOMIC
async function createOrder(input, idempotencyKey) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // idempotency tầng API: trùng key → unique violation → trả order cũ
    const order = await client.query(
      `INSERT INTO orders (user_id, status, idempotency_key)
       VALUES ($1,'PENDING',$2) RETURNING id`,
      [input.userId, idempotencyKey]);
    const orderId = order.rows[0].id;
    await client.query(`INSERT INTO order_items ...`, [...]);
    await client.query(
      `INSERT INTO order_status_history (order_id, status) VALUES ($1,'PENDING')`,
      [orderId]);
    // EVENT vào outbox — cùng transaction
    await client.query(
      `INSERT INTO outbox (aggregate_id, topic, payload)
       VALUES ($1,'order-created',$2)`,
      [orderId, JSON.stringify({ eventId: uuid(), orderId, items: input.items })]);
    await client.query('COMMIT');
    return orderId;
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') return findExistingOrder(idempotencyKey); // dedupe
    throw e;
  } finally { client.release(); }
}

// Relay: nhiều instance chạy song song nhờ SKIP LOCKED
async function relayLoop() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT id, aggregate_id, topic, payload FROM outbox
       WHERE published_at IS NULL
       ORDER BY id              -- giữ ordering theo sequence
       FOR UPDATE SKIP LOCKED LIMIT 100`);
    for (const r of rows) {
      await producer.send({ topic: r.topic,
        messages: [{ key: r.aggregate_id, value: r.payload }] }); // key = partition
      await client.query(`UPDATE outbox SET published_at = now() WHERE id = $1`, [r.id]);
    }
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); }
  finally { client.release(); }
}
setInterval(relayLoop, 500);
// LƯU Ý: crash giữa send() và UPDATE → publish lại → consumer phải idempotent.
```

### Idempotency middleware cho consumer (wrapper dùng chung)

```js
async function handleIdempotent(eventId, businessFn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    try {
      await client.query(
        `INSERT INTO processed_events (event_id) VALUES ($1)`, [eventId]);
    } catch (e) {
      if (e.code === '23505') {        // đã xử lý → bỏ qua AN TOÀN
        await client.query('ROLLBACK');
        return { skipped: true };
      }
      throw e;
    }
    await businessFn(client);          // business chạy CÙNG transaction
    await client.query('COMMIT');      // đánh dấu + business commit cùng lúc
    return { processed: true };
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}
```

### Circuit Breaker (đóng / mở / nửa-mở)

Ngăn cascading failure: khi payment-svc chết, ngừng gọi nó ngay thay vì để mỗi request chờ timeout rồi dồn ứ.

```
        lỗi ≥ ngưỡng (vd 50%/10s)
   ┌──────────────────────────────────┐
   ▼                                   │
[CLOSED] ── cho qua, đếm lỗi ──> [OPEN] ── fail-fast ngay, không gọi
   ▲                                   │   (trả lỗi / fallback)
   │  thử thành công                   │  sau cooldown (vd 30s)
   │                                   ▼
   └────────── [HALF-OPEN] ── cho QUA vài request thử ──┐
              thất bại → quay lại OPEN ─────────────────┘
```
```js
const breaker = { state:'CLOSED', failures:0, threshold:5, cooldown:30000, openedAt:0 };
async function call(fn) {
  if (breaker.state === 'OPEN') {
    if (Date.now() - breaker.openedAt > breaker.cooldown) breaker.state = 'HALF_OPEN';
    else throw new Error('circuit open');           // fail-fast
  }
  try {
    const r = await withTimeout(fn(), 2000);         // LUÔN có timeout
    if (breaker.state === 'HALF_OPEN') { breaker.state='CLOSED'; breaker.failures=0; }
    return r;
  } catch (e) {
    if (++breaker.failures >= breaker.threshold || breaker.state==='HALF_OPEN') {
      breaker.state='OPEN'; breaker.openedAt=Date.now();
    }
    throw e;
  }
}
```
Trong capstone, giao tiếp giữa service chủ yếu async qua Kafka nên ít cần breaker; breaker hợp nhất khi gọi **dependency đồng bộ bên ngoài** (cổng thanh toán thật, API ship). Thư viện: `opossum`.

## 🐛 Bẫy & sự cố production

| # | Sự cố | Dấu hiệu | Fix |
|---|---|---|---|
| 1 | **Dual-write** (ghi DB rồi publish Kafka, crash giữa chừng) | Order tồn tại trong DB nhưng không service nào reserve/charge; hoặc event cho order không có thật | Transactional outbox — event vào DB cùng tx; relay publish sau |
| 2 | **Saga không compensation** → kẹt trạng thái | Order PENDING/RESERVED vĩnh viễn; stock bị "treo" reserved không bao giờ release | Mỗi bước phải có compensation; thêm **reconciliation/timeout sweeper** quét trạng thái trung gian quá X phút |
| 3 | **Thiếu idempotency** → trừ kho / charge 2 lần | Stock âm; user bị charge nhiều lần; tổng tiền ≠ tổng order | `processed_events` dedupe + business unique constraint, tất cả trong cùng transaction |
| 4 | **Retry storm** (retry đồng loạt không backoff) | Service vừa hồi phục lại sập ngay; CPU/conn pool cạn theo nhịp | Exponential backoff **+ jitter** (random hóa) để rải retry; giới hạn số lần; kết hợp circuit breaker |
| 5 | **Thiếu circuit breaker** → cascading failure | Một service chậm kéo theo các service gọi nó treo, conn pool cạn dây chuyền | Circuit breaker fail-fast + bulkhead (tách pool/quota theo dependency) |
| 6 | **Không timeout giữa service** | Request treo vô hạn chờ service chết; tài nguyên không bao giờ giải phóng | Timeout ở MỌI cuộc gọi mạng (HTTP, DB, Kafka produce); timeout < timeout của caller cha (timeout budget) |
| 7 | **Compensation không idempotent** (bug README câu 13) | Stock bị release 2 lần khi `payment-failed` + `order-cancelled` cùng đến → kho phồng lên | Conditional update: `WHERE status='RESERVED'`; chỉ chuyển trạng thái 1 lần |
| 8 | **Poison message chặn partition** | Một consumer kẹt mãi ở một offset; mọi message sau partition đó đứng | Retry có giới hạn → đẩy vào `.dlq` → commit offset đi tiếp |

**Backoff + jitter** (chống retry storm) — luôn dùng full jitter:
```js
const base = 1000, cap = 30000;
const delay = Math.random() * Math.min(cap, base * 2 ** attempt); // full jitter
```

## ⚖️ Đánh đổi & quyết định thiết kế

- **Choreography vs Orchestration**: capstone chọn choreography vì flow 4 bước tuyến tính → loose coupling, thêm notification không sửa ai. Đổi lại mất tầm nhìn toàn cảnh (bù bằng correlation ID + status_history). Khi thêm shipping/voucher/refund nhiều nhánh → chuyển orchestrator (Temporal) để có flow tập trung, timeout & retry quản lý một chỗ.
- **Sync REST vs Async event**: sync đơn giản, dễ debug, trả kết quả ngay — nhưng coupling chặt (callee chết → caller chết) và latency cộng dồn. Async (Kafka) cho decoupling, buffering, replay, chịu lỗi tốt — đổi lại eventual consistency, khó trace, phải xử lý duplicate/ordering. Order flow chọn async; truy vấn đọc (`GET /products`) vẫn sync REST.
- **Eventual consistency chấp nhận tới đâu**: với **order/inventory** chấp nhận được — user thấy "đang xử lý" vài giây là bình thường (vì thế trả `202`). Với **payment** thì ranh giới chặt hơn: bản thân thao tác charge phải mạnh (unique constraint, không double charge), nhưng việc *xác nhận order sau charge* vẫn eventual. Quy tắc: cho phép eventual ở chỗ user chịu được độ trễ; ép strong (unique/atomic) ở chỗ tiền bạc & oversell.
- **Microservices vs Modular monolith**: với team 1 người, chi phí vận hành 4 service (network, eventual consistency, distributed debugging, infra) là THẬT. Modular monolith (module tách rõ, 1 DB, 1 deploy) cho 90% lợi ích kiến trúc với 10% chi phí vận hành, và **dễ tách ra microservice sau** khi biên giới đã rõ. Capstone chọn microservices có chủ đích để HỌC trade-off — nói rõ điều này khi phỏng vấn là điểm cộng (không coi microservices là mặc định đúng).

## 🎯 Câu hỏi phỏng vấn NÂNG CAO

1. **Dual-write problem là gì và outbox giải quyết ra sao?** → Ghi DB + publish Kafka không atomic; crash giữa chừng làm 1 trong 2 mất → lệch trạng thái vĩnh viễn. Outbox ghi event vào bảng cùng transaction với business (atomic), relay poll publish sau. Đảo thứ tự không cứu được, chỉ đổi hướng lỗi.

2. **Saga đảm bảo gì và KHÔNG đảm bảo gì?** → ĐẢM BẢO: atomicity ngữ nghĩa (hoặc mọi bước done hoặc đã compensate), eventual consistency. KHÔNG đảm bảo: isolation (trạng thái trung gian VISIBLE — order khác có thể đọc thấy stock đang reserved dở), không rollback tức thời, không strong consistency. Thiếu isolation gây "dirty read"/lost update → bù bằng semantic lock hoặc versioning.

3. **Vì sao consumer BẮT BUỘC idempotent?** → Broker là at-least-once; duplicate sinh từ rebalance, crash-trước-commit-offset, outbox publish lại, producer retry. Exactly-once của Kafka không bao trùm side effect ngoài Kafka (DB, charge tiền). Idempotent = check+insert eventId cùng transaction với business.

4. **Circuit breaker hoạt động ra sao, khác retry thế nào?** → 3 trạng thái CLOSED→OPEN→HALF_OPEN. CLOSED cho qua đếm lỗi; quá ngưỡng → OPEN fail-fast không gọi; sau cooldown → HALF_OPEN thử vài request, ok thì CLOSED. Retry = "thử lại cùng request"; breaker = "ngừng gọi service đang chết để không lãng phí + cho nó hồi phục". Hai thứ bù nhau, không thay nhau.

5. **Vì sao không dùng 2PC trong microservices?** → 2PC blocking (coordinator chết → participant kẹt giữ lock in-doubt), giữ lock xuyên service giết throughput, cần XA mà Kafka/Mongo/Redis không có, không scale. Saga + eventual consistency là lựa chọn thực dụng.

6. **Saga compensation chạy 2 lần thì sao? Làm sao an toàn?** → Compensation phải idempotent: conditional update theo trạng thái (`WHERE status='RESERVED'`), chỉ chuyển 1 lần. `payment-failed` và `order-cancelled` đến lệch thứ tự vẫn an toàn nhờ check trạng thái — đây là bug thật trong BUGLOG.

7. **Phân biệt at-most-once / at-least-once / exactly-once. Capstone ở đâu?** → at-most-once (commit offset trước xử lý — có thể mất); at-least-once (xử lý trước commit — có thể trùng); exactly-once (lý tưởng, chỉ đạt trong biên Kafka). Capstone = **at-least-once + idempotent consumer**, tạo ra *effectively-once* về mặt hiệu ứng nghiệp vụ.

8. **Order kẹt PENDING vì một event lạc mất (bug hiếm). Lưới an toàn cuối cùng?** → Reconciliation/timeout sweeper: job định kỳ quét order ở trạng thái trung gian quá X phút → CANCEL + release reservation, hoặc re-emit event. Outbox chống mất event lúc publish nhưng không chống mọi bug → defense-in-depth. Nói được điều này = tín hiệu senior.

9. **Ordering trong Kafka đảm bảo tới đâu? Vì sao partition key là orderId?** → Kafka chỉ đảm bảo ordering TRONG một partition. Key = orderId → mọi event của một order vào cùng partition → đúng thứ tự per-order. Đánh đổi: lệch tải nhẹ nếu một order "nóng"; tăng partition để scale consumer vẫn giữ được ordering per order.

## 📚 Đọc thêm

- **microservices.io** (Chris Richardson) — patterns: Saga, Transactional Outbox, Idempotent Consumer, Transaction Log Tailing (CDC), API Composition. Đọc trực tiếp các trang pattern này.
- **DDIA** (Kleppmann) — *Designing Data-Intensive Applications*: Ch.7 Transactions (isolation, 2PC), Ch.8-9 Distributed troubles & Consistency/Consensus (linearizability, fencing token chống lock hết hạn).
- **Sam Newman** — *Building Microservices* (2nd ed): chương về saga, microservice communication, độ chín (modular monolith trước khi tách).
- **Garcia-Molina & Salem (1987)** — paper gốc "Sagas" (compensatable / pivot / retriable).
- **Debezium docs** — CDC outbox event router (production-grade thay relay tự viết).
- **OpenTelemetry** — distributed tracing & W3C Trace Context propagation xuyên Kafka.
- **opossum** — circuit breaker cho Node.js.
