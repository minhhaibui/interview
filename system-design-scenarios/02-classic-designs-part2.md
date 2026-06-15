# Bài toán System Design kinh điển — Phần 2: Lời giải chi tiết

> **Cách dùng tài liệu này:** Mỗi bài được trình bày đúng theo flow 45-60 phút của một buổi phỏng vấn system design thật: clarify → estimate → high-level → deep dive → trade-offs → follow-up. Phần "ở vai Node.js backend engineer" là vũ khí khác biệt của bạn — interviewer rất thích ứng viên nối được lý thuyết với code thực tế mình từng viết.

---

## Bài 1: Design Payment System (Stripe-lite / Ví điện tử)

### 🎤 Cách nhà tuyển dụng đặt câu hỏi

Câu hỏi gốc:
> "Hãy thiết kế một hệ thống thanh toán cho sàn e-commerce: user bấm Pay, tiền bị trừ, merchant nhận tiền. Hệ thống phải đảm bảo **không bao giờ mất tiền và không bao giờ trừ tiền 2 lần**."

Các biến thể hay gặp:
- "Design một ví điện tử như Momo/ZaloPay — nạp tiền, chuyển tiền P2P, thanh toán merchant."
- "Design payment gateway integration layer — hệ thống của bạn đứng giữa app và Stripe/VNPay."
- "User bấm Pay rồi mất mạng, retry — làm sao không charge 2 lần?" (đi thẳng vào idempotency)
- "Cuối ngày số dư hệ thống bạn lệch với báo cáo của ngân hàng — xử lý thế nào?" (đi thẳng vào reconciliation)

**Interviewer đánh giá gì ở bài này:** correctness > scale. Đây là bài hiếm hoi mà nói "tôi chấp nhận eventual consistency cho số dư" là **trừ điểm nặng**. Họ muốn nghe: ledger, idempotency, reconciliation, xử lý webhook an toàn.

### Bước 1: Clarify requirements

Câu hỏi BẠN nên hỏi lại interviewer:

1. "Mình tự giữ tiền (ví điện tử, cần license) hay chỉ orchestrate qua payment gateway bên thứ 3 (Stripe/VNPay)?" → Thường là **cả hai**: internal ledger + gateway cho nạp/rút.
2. "Cần hỗ trợ những payment method nào? Card, bank transfer, ví nội bộ?" → Chốt: card qua gateway + ví nội bộ.
3. "Có cần refund, partial refund không?" → Có refund full, partial là nice-to-have.
4. "Volume khoảng bao nhiêu transaction/ngày? Peak vào lúc nào (flash sale)?"
5. "Yêu cầu về compliance? Mình có chạm vào số thẻ không (PCI DSS scope)?" → Chốt: **không bao giờ chạm raw card number**, dùng tokenization của gateway.

Requirements chốt lại:

**Functional:**
- Pay: charge user (card qua gateway, hoặc trừ ví), credit merchant.
- Wallet: nạp tiền, xem số dư, lịch sử giao dịch.
- Refund.
- Nhận webhook từ gateway để cập nhật trạng thái async.

**Non-functional:**
- **Correctness là số 1**: không mất tiền, không double-charge, mọi đồng tiền đều trace được.
- Exactly-once **về mặt nghiệp vụ** (effectively-once): hạ tầng chỉ đảm bảo at-least-once, ta dùng idempotency để khử duplicate.
- Availability 99.99% cho luồng pay; độ trễ p99 < 1s cho phần đồng bộ (phần gateway thì async).
- Auditability: ledger immutable, append-only.

### Bước 2: Ước lượng quy mô (back-of-envelope)

- DAU: 10 triệu user, trung bình 1 user thanh toán 0.5 lần/ngày → **5 triệu transactions/ngày**.
- Write QPS trung bình: 5,000,000 / 86,400 ≈ **~60 TPS**. Peak (flash sale 12:00) x10 → **~600 TPS**.
- Mỗi transaction sinh ~5 bản ghi (payment, 2-4 dòng ledger, events) → ~300 writes/s lúc bình thường, ~3,000 writes/s lúc peak.
- Read QPS (check balance, history): x10 write → **~600 RPS thường, 6,000 RPS peak**.
- Storage: 1 transaction ≈ 2 KB (payment row + ledger entries + metadata). 5M/ngày × 2 KB = **10 GB/ngày ≈ 3.6 TB/năm**. Giữ hot 1 năm trong Postgres, archive phần cũ sang cold storage (S3 + Parquet) — ledger **không bao giờ xóa**.

**Insight để nói ra miệng:** "600 TPS là con số nhỏ với database — bài toán payment không khó vì scale, mà khó vì **correctness dưới partial failure**. Nên tôi sẽ dành thời gian cho ledger và idempotency thay vì sharding."

### Bước 3: High-level design

```
                 ┌─────────────┐
   Client ──────▶│ API Gateway │ (auth, rate limit, TLS)
                 └──────┬──────┘
                        │ POST /payments (Idempotency-Key: uuid)
                        ▼
              ┌──────────────────┐      ┌────────────────────┐
              │ Payment Service  │─────▶│ Idempotency Store  │
              │ (Node.js)        │      │ (Postgres/Redis)   │
              └──┬───────────┬───┘      └────────────────────┘
                 │           │
        sync     │           │ async (outbox → Kafka)
                 ▼           ▼
        ┌──────────────┐   ┌──────────────┐
        │ Ledger       │   │ Kafka        │──▶ Notification Svc
        │ Service      │   │ (events)     │──▶ Analytics
        │ + Postgres   │   └──────────────┘──▶ Reconciliation Svc
        │ (double-entry│
        │  ledger)     │   ┌──────────────────────┐
        └──────────────┘   │ PSP Adapter Service  │◀── Webhook ── Stripe/VNPay
                           │ (gọi gateway, retry) │              (HMAC verify)
                           └──────────────────────┘
                                      │ daily settlement file (SFTP/API)
                                      ▼
                           ┌──────────────────────┐
                           │ Reconciliation Svc   │ (so khớp ledger vs PSP)
                           └──────────────────────┘
```

Luồng thanh toán bằng thẻ (happy path):
1. Client gọi `POST /payments` kèm header `Idempotency-Key` (UUID client tự sinh).
2. Payment Service check idempotency store: nếu key đã có → trả lại response cũ, **không xử lý lại**.
3. Tạo payment record trạng thái `PENDING`, ghi ledger entry "pending" (hoặc hold), ghi outbox event — **tất cả trong 1 DB transaction**.
4. PSP Adapter gọi gateway (Stripe `paymentIntents.create`) — truyền luôn idempotency key xuống gateway.
5. Gateway trả kết quả ngay hoặc bắn webhook sau → Payment Service chuyển `PENDING → SUCCEEDED/FAILED`, ghi ledger entries chính thức.
6. Event `payment.succeeded` đẩy ra Kafka qua outbox pattern → notification, fulfillment.

Giải thích component:
- **Payment Service**: state machine của payment (`CREATED → PENDING → SUCCEEDED | FAILED | REFUNDED`). Chỉ cho phép chuyển trạng thái hợp lệ.
- **Ledger Service**: nguồn sự thật duy nhất về tiền. Append-only, double-entry.
- **PSP Adapter**: cô lập mọi thứ liên quan gateway (API, webhook, retry) — đổi gateway không đụng core.
- **Reconciliation Service**: batch job hằng ngày so khớp ledger nội bộ với settlement file của gateway.

### Bước 4: Deep dive

#### 4.1. Double-entry ledger — schema cụ thể

Nguyên tắc kế toán kép: **mỗi giao dịch ghi ít nhất 2 dòng, tổng debit = tổng credit**. Không bao giờ `UPDATE balance = balance - x` trên một cột số dư duy nhất rồi quên log.

```sql
-- Tài khoản: của user, merchant, và cả tài khoản hệ thống (cash-in từ PSP, phí, escrow)
CREATE TABLE accounts (
  id          BIGINT PRIMARY KEY,
  owner_type  TEXT NOT NULL,      -- 'user' | 'merchant' | 'system'
  currency    CHAR(3) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ledger: APPEND-ONLY. Không UPDATE, không DELETE. Sai thì ghi bút toán đảo.
CREATE TABLE ledger_entries (
  id              BIGSERIAL PRIMARY KEY,
  transaction_id  UUID NOT NULL,         -- gom các dòng của cùng 1 giao dịch
  account_id      BIGINT NOT NULL REFERENCES accounts(id),
  direction       TEXT NOT NULL CHECK (direction IN ('DEBIT','CREDIT')),
  amount          BIGINT NOT NULL CHECK (amount > 0),  -- minor unit (xu/cent), KHÔNG dùng float
  currency        CHAR(3) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ledger_account ON ledger_entries(account_id, id);

-- Số dư: bảng materialized, cập nhật cùng transaction với ledger
CREATE TABLE balances (
  account_id  BIGINT PRIMARY KEY,
  balance     BIGINT NOT NULL CHECK (balance >= 0),  -- chặn âm tiền ở mức DB
  version     BIGINT NOT NULL DEFAULT 0              -- optimistic lock
);
```

Ví dụ user A chuyển 100k cho merchant B, phí 2k:

| transaction_id | account | direction | amount |
|---|---|---|---|
| tx-1 | user_A | DEBIT | 100,000 |
| tx-1 | merchant_B | CREDIT | 98,000 |
| tx-1 | system_fee | CREDIT | 2,000 |

Invariant kiểm tra được bằng query: `SUM(debit) = SUM(credit)` theo từng `transaction_id` và toàn hệ thống. Đây là nền của reconciliation nội bộ.

Trừ tiền an toàn trong Postgres (chống race khi 2 request trừ cùng ví):

```sql
BEGIN;
SELECT balance FROM balances WHERE account_id = $1 FOR UPDATE; -- row lock
-- check đủ tiền ở tầng app
INSERT INTO ledger_entries (...) VALUES (...), (...);
UPDATE balances SET balance = balance - $2, version = version + 1
  WHERE account_id = $1 AND balance >= $2;  -- check lần nữa, atomic
COMMIT;
```

Nếu hot account (1 merchant lớn nhận hàng nghìn credit/s) → `FOR UPDATE` thành bottleneck. Giải pháp: **balance sharding** (chia 1 account thành N sub-account, credit rải đều, đọc thì SUM) hoặc credit theo batch từ queue.

#### 4.2. Idempotency — exactly-once về mặt nghiệp vụ

Vấn đề: client gọi pay → timeout → retry. Server có thể đã xử lý xong. Network chỉ cho at-least-once, ta phải tự khử duplicate.

Thiết kế idempotency key:
- Client sinh UUID cho mỗi **ý định thanh toán** (không phải mỗi request), gửi qua header `Idempotency-Key`.
- Server lưu key + fingerprint của request body + response, TTL 24-48h.
- Request trùng key + trùng body → trả response cũ. Trùng key nhưng **khác body** → trả `422` (client bug).
- Request trùng key khi request đầu **đang xử lý** → trả `409 Conflict` (đừng xử lý song song).

**Ở vai Node.js backend engineer, kể thế này** — "Tôi từng viết idempotency middleware cho Express, dùng Postgres unique constraint làm lock":

```js
// middleware/idempotency.js
async function idempotency(req, res, next) {
  const key = req.header('Idempotency-Key');
  if (!key) return res.status(400).json({ error: 'Idempotency-Key required' });

  const fingerprint = sha256(JSON.stringify(req.body));
  try {
    // INSERT làm "lock": unique constraint trên key đảm bảo chỉ 1 request thắng
    await db.query(
      `INSERT INTO idempotency_keys (key, fingerprint, status)
       VALUES ($1, $2, 'IN_PROGRESS')`,
      [key, fingerprint]
    );
  } catch (err) {
    if (err.code === '23505') { // unique_violation
      const row = await db.query(
        `SELECT * FROM idempotency_keys WHERE key = $1`, [key]);
      const rec = row.rows[0];
      if (rec.fingerprint !== fingerprint)
        return res.status(422).json({ error: 'Key reused with different payload' });
      if (rec.status === 'IN_PROGRESS')
        return res.status(409).json({ error: 'Request in progress, retry later' });
      return res.status(rec.response_code).json(rec.response_body); // replay
    }
    return next(err);
  }
  // hook: sau khi handler chạy xong thì lưu response vào idempotency_keys
  res.saveIdempotentResponse = async (code, body) => {
    await db.query(
      `UPDATE idempotency_keys SET status='COMPLETED', response_code=$2, response_body=$3
       WHERE key=$1`, [key, code, body]);
  };
  next();
}
```

Điểm cộng lớn khi nói thêm: "Tôi **truyền tiếp idempotency key xuống PSP** (Stripe hỗ trợ native) — nếu server tôi chết sau khi gọi Stripe nhưng trước khi lưu kết quả, lần retry sau Stripe vẫn không charge đôi."

Edge case interviewer hay xoáy: server crash khi status `IN_PROGRESS` mãi mãi → cần TTL/timeout cho `IN_PROGRESS` + recovery job query PSP để hỏi "transaction này đã thành công chưa?" trước khi quyết định retry hay fail.

#### 4.3. Webhook từ PSP — verify, retry, out-of-order

Webhook là nguồn sự thật về kết quả charge, nhưng đến **at-least-once, có thể trùng, có thể sai thứ tự** (`refund.succeeded` đến trước `payment.succeeded`).

Quy tắc xử lý:
1. **Verify signature** trước khi tin bất kỳ byte nào — dùng raw body, không phải parsed JSON:

```js
// Stripe webhook trong Express — PHẢI dùng express.raw, vì signature tính trên raw bytes
app.post('/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,                          // Buffer, KHÔNG phải req.body đã parse
        req.headers['stripe-signature'],   // HMAC-SHA256 + timestamp chống replay
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      return res.status(400).send(`Signature verification failed`);
    }
    // 2. ACK NGAY (2xx), xử lý async — nếu xử lý lâu, PSP timeout và retry bão
    enqueue('webhook-events', event);
    res.sendStatus(200);
  });
```

2. **Dedupe theo `event.id`**: bảng `processed_webhook_events(event_id PRIMARY KEY)` — insert trước khi xử lý, trùng thì bỏ qua.
3. **Out-of-order**: đừng xử lý theo "event nói gì" mà theo **state machine**. Nhận `refund.succeeded` khi payment đang `PENDING` → không hợp lệ → đẩy vào retry queue với delay (chờ event trước đến) hoặc **gọi API PSP để fetch trạng thái hiện tại** (poll-to-reconcile) thay vì tin event.
4. **Đừng chỉ dựa vào webhook**: có cron job poll các payment kẹt `PENDING` quá 15 phút và hỏi thẳng PSP. Webhook là tối ưu hoá độ trễ, polling là lưới an toàn.

#### 4.4. Saga cho luồng thanh toán + Reconciliation

Luồng order = nhiều bước qua nhiều service (reserve inventory → charge → create shipment). Không có distributed transaction → dùng **Saga (orchestration)**:

```
Order Saga (orchestrator):
  1. Reserve inventory      → fail? → kết thúc
  2. Charge payment         → fail? → compensate: release inventory
  3. Confirm order          → fail? → compensate: refund + release inventory
```

- Mỗi bước có **compensating action** (refund là compensation của charge — không phải "rollback", tiền đã đi là đi, chỉ ghi bút toán đảo).
- Saga state lưu DB, orchestrator chết thì node khác đọc state chạy tiếp.
- Mọi step phải idempotent (vì orchestrator retry).

**Reconciliation** (điểm rất ăn tiền, ít ứng viên nhắc):
- Hằng ngày PSP gửi settlement file (danh sách transaction + số tiền họ đã xử lý).
- Job đối soát 3 chiều: **internal ledger ↔ payment records ↔ PSP file**.
- Lệch loại 1 — mình có, PSP không: có thể charge fail mà mình ghi nhầm success → điều tra, hoàn tiền/sửa bút toán đảo.
- Lệch loại 2 — PSP có, mình không: webhook bị mất và poll cũng sót → bù bút toán.
- Kết quả ra dashboard + alert; lệch tiền là incident P1.

PCI DSS scope (nói tổng quan 30 giây): "Frontend dùng Stripe Elements/hosted fields → số thẻ đi thẳng từ browser tới Stripe, backend tôi chỉ nhận **token**. Như vậy hệ thống nằm ở SAQ-A scope nhỏ nhất, không phải audit cả hạ tầng theo chuẩn PCI Level 1."

### Bước 5: Trade-offs & bottlenecks

| Quyết định | Chọn | Đánh đổi |
|---|---|---|
| DB cho ledger | PostgreSQL (ACID) | Khó scale write hơn NoSQL, nhưng correctness > scale; 600 TPS Postgres thừa sức |
| Balance | Materialized + ledger append-only | Ghi 2 nơi mỗi transaction, nhưng đọc balance O(1) thay vì SUM cả ledger |
| Đồng bộ vs async với PSP | Sync tạo intent, async chốt kết quả qua webhook | UX phải xử lý trạng thái "processing"; đổi lại không block và chịu được PSP chậm |
| Exactly-once | At-least-once + idempotency | Tốn 1 bảng + 1 round-trip mỗi request, nhưng là cách duy nhất đúng |
| Event publish | Outbox pattern (ghi event cùng transaction, relay đọc bảng outbox đẩy Kafka) | Thêm độ trễ ~100ms và 1 component relay; đổi lại không bao giờ "DB commit nhưng event mất" |

Bottlenecks & cách xử lý:
- **Hot merchant account** (flash sale, vạn credit/s vào 1 row balance): shard sub-account hoặc gom credit theo batch 100ms.
- **PSP down**: circuit breaker + queue payment intent lại, trả client "processing"; tuyệt đối không fail-open.
- **Idempotency store phình**: TTL 48h + partition theo ngày để drop rẻ.
- **Ledger table khổng lồ**: partition theo tháng (`created_at`), archive partition cũ sang S3; balance đã materialized nên đọc không đụng ledger cũ.

### ❓ Follow-up questions interviewer hay hỏi tiếp

1. **"Tại sao không dùng float/double cho tiền?"** → Sai số nhị phân (0.1 + 0.2 ≠ 0.3). Dùng integer minor unit (cents/xu) hoặc `NUMERIC`. Trong Node.js cẩn thận `Number` chỉ an toàn tới 2^53 — số tiền lớn dùng `BigInt` hoặc string.
2. **"Hai request trừ cùng một ví cùng lúc, làm sao không âm tiền?"** → Row lock `SELECT ... FOR UPDATE` + constraint `CHECK (balance >= 0)` làm tầng phòng thủ cuối; hoặc optimistic lock bằng cột `version` rồi retry.
3. **"Refund hoạt động thế nào trong ledger?"** → Không sửa/xóa bút toán cũ; ghi transaction mới đảo chiều (debit merchant, credit user), link tới transaction gốc, state machine chặn refund quá số tiền gốc.
4. **"Nếu Kafka mất event payment.succeeded thì sao?"** → Không thể mất nếu dùng outbox: event nằm trong DB cùng commit; relay retry tới khi Kafka ack. Consumer phía sau idempotent theo event id.
5. **"Multi-currency xử lý sao?"** → Mỗi account 1 currency; chuyển đổi đi qua cặp tài khoản system FX với tỷ giá snapshot tại thời điểm giao dịch — bản thân FX conversion cũng là 1 transaction kế toán kép.
6. **"Làm sao test được hệ thống không mất tiền?"** → Invariant check chạy liên tục (SUM debit = SUM credit), chaos testing kill service giữa saga, property-based test cho state machine, và sandbox PSP cho integration test.

---

## Bài 2: Design File Storage & Sharing (Dropbox / Google Drive)

### 🎤 Cách nhà tuyển dụng đặt câu hỏi

Câu hỏi gốc:
> "Thiết kế Dropbox: user upload file, sync giữa nhiều thiết bị, share file cho người khác."

Biến thể:
- "Design Google Drive" (giống ~90%, thêm collab/permission sâu hơn).
- "Design tính năng upload file 10GB qua mạng chập chờn." (xoáy resumable upload)
- "Hai thiết bị cùng sửa 1 file khi offline, sync lên thì xử lý sao?" (xoáy conflict)
- "Làm sao tiết kiệm storage khi 1000 user cùng upload 1 file giống nhau?" (xoáy dedup)

**Interviewer đánh giá gì:** tách metadata vs blob, hiểu chunking/dedup/delta sync, và xử lý conflict — đây là bài "data-intensive client sync" kinh điển.

### Bước 1: Clarify requirements

Câu hỏi nên hỏi lại:
1. "File size tối đa? Loại file gì?" → Chốt: tối đa 10 GB, mọi loại (binary).
2. "Sync tự động giữa devices hay chỉ upload/download thủ công?" → Có desktop client sync tự động.
3. "Có cần edit đồng thời kiểu Google Docs không?" → **Không** (đó là bài OT/CRDT khác hẳn) — chỉ file-level sync, conflict thì tạo bản copy.
4. "Share theo link, theo user, theo folder? Quyền gì?" → Share user/link, quyền view/edit.
5. "Cần version history không?" → Có, giữ 30 ngày.

**Functional:** upload/download (resumable), auto-sync đa thiết bị, share + permission, version history, notify thay đổi gần realtime.

**Non-functional:** durability **11 nines** cho dữ liệu file (mất file của user là chết), availability 99.9%, sync latency vài giây, tiết kiệm bandwidth (delta sync) và storage (dedup), consistency: metadata strong-consistent, nội dung file eventual giữa các thiết bị.

### Bước 2: Ước lượng quy mô (back-of-envelope)

- Users: 50M đăng ký, DAU 10M.
- Mỗi user trung bình lưu 5 GB → raw storage = 50M × 5 GB = **250 PB**. Sau dedup + compression (tỷ lệ thực tế ~30-40% tiết kiệm) → **~150 PB**. Cộng replication 3x hoặc erasure coding (1.5x) → erasure coding tiết kiệm hơn nhiều ở scale này.
- Upload: mỗi DAU upload/sửa 2 file/ngày, file trung bình 2 MB → 20M file/ngày → write **~230 file/s**, peak x3 ≈ 700 file/s; băng thông ghi ≈ 230 × 2 MB ≈ **460 MB/s** (chưa tính peak).
- Download/read gấp ~5 lần write → **~2.3 GB/s** băng thông đọc → bắt buộc CDN/edge cache cho file hay được tải.
- Metadata: mỗi file ~1 KB metadata + chunk list. 50M user × 1,000 file = 50 tỷ file → ~50 TB metadata → cần shard metadata DB.
- Chunk size 4 MB → file 2 MB = 1 chunk; file 10 GB = 2,560 chunks.

### Bước 3: High-level design

```
 Desktop/Mobile Client
 ┌─────────────────────────────┐
 │ Watcher (FS events)         │
 │ Chunker (4MB, hash SHA-256) │
 │ Local index (SQLite)        │
 └───┬─────────────┬───────────┘
     │ metadata    │ chunks (data plane)
     ▼             ▼
┌──────────┐   ┌─────────────────┐     ┌──────────────────┐
│ Meta     │   │ Block Service   │────▶│ Object Storage   │
│ Service  │   │ (presigned URL, │     │ (S3) — chunk     │
│ (Node.js)│   │  dedup check)   │     │ key = sha256     │
└────┬─────┘   └─────────────────┘     └──────────────────┘
     │
     ▼
┌─────────────────┐    ┌────────────────┐    ┌─────────────────────┐
│ Metadata DB     │    │ Kafka          │───▶│ Notification Service │
│ (Postgres shard │───▶│ (change events)│    │ (WebSocket/long-poll)│
│  by user_id)    │    └────────────────┘    └──────────┬──────────┘
└─────────────────┘                                     │ "có thay đổi!"
                                                        ▼
                                                  Other devices ──▶ pull changes
```

Luồng upload file mới:
1. Client chia file thành chunk 4 MB, tính SHA-256 từng chunk + hash cả file.
2. Client gửi danh sách chunk hash lên Block Service → server trả về **những chunk chưa tồn tại** (dedup).
3. Client chỉ upload chunk thiếu, qua **presigned URL** thẳng lên S3 (không đi qua app server — tiết kiệm băng thông server).
4. Upload xong, client commit metadata: file path, version, chunk list → Meta Service ghi DB + bắn event Kafka.
5. Notification Service đẩy tín hiệu "namespace của bạn có thay đổi" tới các thiết bị khác → thiết bị pull metadata mới → tải đúng chunk thay đổi.

Điểm kiến trúc quan trọng để nói ra: **tách control plane (metadata, nhỏ, cần consistency) khỏi data plane (chunk, to, cần throughput)**. Notification chỉ là "ping", thiết bị luôn **pull** trạng thái thật từ Meta Service — tránh phải đảm bảo ordered delivery trên kênh push.

### Bước 4: Deep dive

#### 4.1. Chunk upload, resumable & dedup — schema

```sql
-- Metadata DB (shard theo user_id / namespace_id)
CREATE TABLE files (
  id              UUID PRIMARY KEY,
  namespace_id    BIGINT NOT NULL,     -- thư mục gốc của user hoặc shared folder
  path            TEXT NOT NULL,
  current_version BIGINT NOT NULL,
  is_deleted      BOOLEAN DEFAULT FALSE,
  UNIQUE (namespace_id, path)
);

CREATE TABLE file_versions (
  file_id      UUID NOT NULL,
  version      BIGINT NOT NULL,
  size         BIGINT NOT NULL,
  content_hash CHAR(64) NOT NULL,      -- hash toàn file
  chunk_list   JSONB NOT NULL,         -- [{idx: 0, hash: "ab12...", size: 4194304}, ...]
  device_id    UUID,                   -- thiết bị tạo version (phục vụ conflict)
  created_at   TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (file_id, version)
);

-- Bảng chunk toàn cục (dedup): chunk định danh bằng CHÍNH NỘI DUNG của nó
CREATE TABLE chunks (
  hash       CHAR(64) PRIMARY KEY,     -- SHA-256 → cũng là S3 key
  size       INT NOT NULL,
  ref_count  BIGINT NOT NULL DEFAULT 0 -- GC khi = 0 (cẩn thận race, xem dưới)
);
```

- **Content-addressed storage**: S3 key = SHA-256 của chunk → dedup tự nhiên (2 user upload cùng chunk → cùng key, lưu 1 lần). 1000 user upload cùng file cài đặt 2 GB → lưu đúng 1 bản.
- **Resumable**: client giữ local state "đã upload chunk nào". Đứt mạng → hỏi server `GET /uploads/:id/status` → chỉ upload chunk thiếu. Với chunk lớn, dùng S3 multipart upload bên dưới presigned URL.
- **Dedup mức nào?** File-level dedup (hash cả file) rẻ nhưng sửa 1 byte là mất dedup. Chunk-level fixed-size 4 MB là lựa chọn cân bằng. Nâng cao: **content-defined chunking (Rabin fingerprint)** — ranh giới chunk theo nội dung, chèn 1 byte đầu file không làm lệch toàn bộ chunk sau; đắt CPU hơn, Dropbox thực tế dùng biến thể này.
- **Bảo mật dedup**: dedup cross-user mở ra side-channel ("upload nhanh bất thường = file đã tồn tại" → đoán được ai đó có file gì). Nói được điểm này là bonus; giải pháp: chỉ xác nhận dedup sau khi client chứng minh sở hữu nội dung (proof of ownership) hoặc chấp nhận risk có kiểm soát.
- **GC chunk**: `ref_count` giảm khi version bị xoá quá 30 ngày; xoá chunk khi `ref_count = 0`. Race (vừa định xoá thì có ref mới): dùng tombstone + grace period 7 ngày thay vì xoá ngay.

#### 4.2. Delta sync & conflict resolution

**Delta sync:** client sửa file → chunker chạy lại → so chunk hash mới với `chunk_list` của version cũ → chỉ upload chunk khác. File 10 GB sửa 4 MB cuối → upload đúng 1 chunk. Version mới = chunk list mới trỏ phần lớn vào chunk cũ (kiểu git: snapshot logic, share object vật lý).

**Sync conflict** — câu xoáy kinh điển: 2 thiết bị offline cùng sửa file, cùng sync lên.

Cơ chế: **optimistic concurrency trên metadata commit**.

```
Device A: commit version mới với base_version = 5  →  OK, file thành version 6
Device B: commit version mới với base_version = 5  →  REJECT (current = 6)
```

Server check `base_version == current_version` trong transaction. Thua thì client B có 2 lựa chọn:
- File-level: tạo **conflicted copy** — `report (conflicted copy from B's laptop 2026-06-10).docx` — đúng cách Dropbox làm. Đơn giản, không mất dữ liệu, đẩy quyết định cho user. **Đây là đáp án nên chốt.**
- Merge tự động chỉ khả thi với text/structured data (Google Docs dùng OT/CRDT) — nói rõ "đó là bài toán khác, out of scope với binary file sync".

Nói thêm cho điểm cộng: **last-write-wins là đáp án sai** ở đây vì mất dữ liệu thầm lặng; interviewer thường gài câu "sao không lấy timestamp mới hơn?" — trả lời: clock các thiết bị không tin được, và kể cả đúng giờ thì ghi đè công sức của người kia vẫn là mất dữ liệu.

#### 4.3. Share permission & notification

**Permission model:**

```sql
CREATE TABLE shares (
  id          UUID PRIMARY KEY,
  resource_id UUID NOT NULL,           -- file hoặc folder
  grantee     BIGINT,                  -- user_id; NULL nếu là share-by-link
  link_token  TEXT,                    -- token ngẫu nhiên cho anyone-with-link
  role        TEXT CHECK (role IN ('viewer','editor')),
  expires_at  TIMESTAMPTZ
);
```

- Share **folder** → quyền kế thừa xuống con. Check quyền 1 file = đi ngược cây cha (path materialization hoặc closure table) → cache kết quả check trong Redis (`user:resource → role`, TTL ngắn, invalidate khi share đổi).
- Shared folder = namespace riêng: file của shared folder thuộc `namespace_id` của folder, các thành viên mount namespace đó — đổi quyền 1 chỗ ảnh hưởng mọi người, không copy data.
- Download file share: vẫn qua presigned URL ngắn hạn (5 phút) sau khi check quyền — không bao giờ để S3 public.

**Notification (long polling vs WebSocket):**
- Desktop client: **HTTP long polling** là lựa chọn thực dụng (Dropbox dùng): client gọi `GET /longpoll?cursor=...`, server giữ connection ~60s, có thay đổi thì trả ngay. Dễ đi qua proxy/firewall doanh nghiệp, dễ load-balance, stateless hơn WebSocket.
- Nội dung notify chỉ là **"namespace X có thay đổi"** — client pull delta qua `GET /delta?cursor=...` (cursor = vị trí trong change log). Pattern "notify-then-pull" này tránh mất message và tránh ordering issue trên kênh push.
- Scale: 10M client giữ long-poll connection → mỗi connection idle tốn ít RAM; Node.js xử lý tốt bài này (event loop, không thread-per-connection) — **1 instance Node.js giữ được ~100k idle connections**, cần ~100 instance + sticky theo namespace hash để fan-out nhanh.

### Bước 5: Trade-offs & bottlenecks

| Quyết định | Chọn | Đánh đổi |
|---|---|---|
| Chunk size | 4 MB cố định | Nhỏ hơn → dedup/delta tốt hơn nhưng metadata phình + nhiều request; lớn hơn → ngược lại |
| Upload path | Presigned URL thẳng S3 | Server không thấy nội dung (muốn virus-scan phải scan async sau); đổi lại tiết kiệm khổng lồ băng thông server |
| Metadata DB | Postgres shard theo namespace | Cross-namespace query (search toàn bộ file của user trong shared folders) phải scatter-gather; đổi lại transaction trong 1 namespace dễ |
| Conflict | Conflicted copy | UX hơi phiền, nhưng không bao giờ mất dữ liệu thầm lặng |
| Notify | Long polling | Latency nhỉnh hơn WebSocket một chút, nhưng vận hành đơn giản, friendly với firewall |
| Durability | Erasure coding thay vì 3x replication | Đọc chậm hơn chút khi mất node (phải reconstruct), nhưng tiết kiệm ~50% storage ở scale PB |

Bottlenecks:
- **Metadata DB hot shard**: user doanh nghiệp với 10M file trong 1 namespace → sub-shard theo folder, hoặc dành shard riêng cho big tenant.
- **Thundering herd khi file hot thay đổi** (shared folder 10k thành viên): fan-out notify qua queue, jitter việc client pull, cache delta response.
- **Hash toàn bộ file lớn trên client yếu**: hash từng chunk song song, hash cây (Merkle) để verify từng phần.
- **S3 rate limit theo prefix**: key là hash ngẫu nhiên đều → tự nhiên rải prefix, không bị hot partition.

### ❓ Follow-up questions interviewer hay hỏi tiếp

1. **"Làm sao client biết file thay đổi mà không quét lại cả ổ đĩa?"** → FS events (inotify/FSEvents) + local SQLite index lưu (path, mtime, size, hash); quét full chỉ khi khởi động hoặc nghi mất event.
2. **"Xoá file thì chunk bị xoá ngay không?"** → Không. Soft delete + version history 30 ngày → ref_count giảm khi version hết hạn → GC nền xoá chunk mồ côi với grace period.
3. **"Search file theo tên/nội dung?"** → Tên: index trong metadata DB hoặc Elasticsearch (CDC từ metadata qua Kafka). Nội dung: pipeline async extract text → index; không làm đường sync chậm đi.
4. **"Nếu 2 chunk khác nhau trùng SHA-256 thì sao?"** → Xác suất collision SHA-256 nhỏ hơn lỗi phần cứng nhiều bậc (~2^-128 cho birthday bound) — chấp nhận; nếu paranoid thì so thêm size + verify khi đọc.
5. **"Encrypt dữ liệu thế nào?"** → At-rest: S3 SSE hoặc envelope encryption per-chunk; in-transit: TLS. Lưu ý E2E encryption (client giữ key) sẽ **giết chết dedup cross-user** — trade-off phải nói rõ.
6. **"Upload 10 GB từ mạng VN sang server US chậm — cải thiện sao?"** → Edge/transfer acceleration (upload vào POP gần nhất rồi đi backbone), upload chunk song song nhiều connection, nén trước với loại file nén được.

---

## Bài 3: Design Distributed Job Scheduler (Airflow-lite / Delayed Jobs)

### 🎤 Cách nhà tuyển dụng đặt câu hỏi

Câu hỏi gốc:
> "Thiết kế một hệ thống chạy job theo lịch: user đăng ký 'chạy task X lúc 2h sáng mỗi ngày' hoặc 'gửi email này sau 30 phút nữa'. Hệ thống phải scale tới hàng triệu job và không được chạy trùng job."

Biến thể:
- "Design distributed cron." / "Design hệ thống delayed job (như Sidekiq/BullMQ scale lớn)."
- "Design hệ thống gửi reminder/notification hẹn giờ cho 100M user."
- "Nếu máy đang chạy job chết giữa chừng thì sao?" (xoáy at-least-once + recovery)
- "Hai scheduler node cùng nhìn thấy job đến hạn, làm sao không chạy đôi?" (xoáy coordination)

**Interviewer đánh giá gì:** hiểu at-least-once vs exactly-once, leader election/locking, pull vs push, và xử lý failure của cả scheduler lẫn worker.

### Bước 1: Clarify requirements

Câu hỏi nên hỏi lại:
1. "Job loại gì — recurring (cron) hay one-shot delayed, hay cả hai?" → Cả hai.
2. "Độ chính xác thời gian cần mức nào? Lệch 1s có sao không?" → SLA: chạy trong vòng **60s** sau giờ hẹn là đạt.
3. "Job chạy bao lâu? Có job chạy hàng giờ không?" → Đa số < 1 phút, có job dài tới 1 giờ.
4. "Có cần DAG/dependency giữa các job (như Airflow) không?" → Không, job độc lập (nói rõ nếu cần DAG thì thêm topological scheduling — out of scope).
5. "Ngữ nghĩa thực thi: at-least-once hay at-most-once?" → **At-least-once + worker idempotent** (chuẩn ngành; exactly-once thuần là không tồn tại trên hạ tầng phân tán).

**Functional:** CRUD job (cron expression hoặc `run_at`), execute đúng hạn ±60s, retry với backoff khi fail, priority, xem lịch sử execution, pause/resume.

**Non-functional:** at-least-once, **không duplicate execution trong điều kiện bình thường** (duplicate chỉ chấp nhận khi failover, và worker idempotent xử lý), scale 100M job đăng ký / 10M execution mỗi ngày, scheduler không có single point of failure.

### Bước 2: Ước lượng quy mô (back-of-envelope)

- 100M job đăng ký (đa số recurring), 10M execution/ngày.
- Execution rate trung bình: 10M / 86,400 ≈ **~115 jobs/s**; nhưng cron có tính chất "dồn cục" — mọi người thích đặt `0 0 * * *` → peak phút 00:00 có thể **x100 = ~10,000 jobs/s trong vài giây** → thiết kế cho burst, queue để hấp thụ.
- Job record ~500 bytes × 100M = **50 GB** job store — vừa một Postgres khoẻ, shard khi cần.
- Execution history: 10M/ngày × 300 bytes = 3 GB/ngày → giữ 30 ngày = ~90 GB, partition theo ngày, archive ra S3.
- Worker: nếu job trung bình 5s CPU-bound nhẹ, 115 jobs/s × 5s = ~600 job đồng thời → vài chục worker node là đủ; autoscale theo queue depth cho peak.

### Bước 3: High-level design

```
            ┌────────────┐
  Client ──▶│  Job API   │──▶ Job Store (Postgres)
            │ (Node.js)  │     jobs / job_runs
            └────────────┘          ▲
                                    │ poll "due jobs" (FOR UPDATE SKIP LOCKED)
        ┌───────────────────────────┴─────┐
        │ Scheduler cluster (3 nodes)     │
        │  - chia partition theo shard_id │
        │  - lease/election qua DB hoặc ZK│
        └───────────────┬─────────────────┘
                        │ enqueue khi job đến hạn
                        ▼
              ┌──────────────────┐
              │ Queue             │  (Redis Streams / RabbitMQ / Kafka)
              │ + priority queues │  high / default / low
              └────────┬─────────┘
                       │ PULL (worker tự lấy khi rảnh)
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   ┌─────────┐    ┌─────────┐   ┌─────────┐
   │ Worker  │    │ Worker  │   │ Worker  │   — heartbeat + lease
   └────┬────┘    └────┬────┘   └────┬────┘
        └───────── report status ────┘
                       ▼
              job_runs (status, attempt, output)
```

Luồng:
1. Client tạo job → Job API ghi vào `jobs` với `next_run_at` đã tính sẵn (từ cron expression).
2. Scheduler node (theo partition mình sở hữu) poll mỗi giây: "job nào `next_run_at <= now`?" → tạo `job_run`, đẩy message vào queue, tính và cập nhật `next_run_at` kế tiếp.
3. Worker **pull** từ queue → claim run (lease) → execute → report kết quả.
4. Fail → retry với exponential backoff (re-enqueue với delay). Quá max attempts → dead letter queue + alert.

Tách 2 vai trò rõ ràng để nói: **Scheduler chỉ quyết định "khi nào"** (time → queue), **Worker chỉ quyết định "chạy như thế nào"** (queue → execution). Tách ra thì scale độc lập và lỗi không lan.

### Bước 4: Deep dive

#### 4.1. Job store schema + chống duplicate khi nhiều scheduler

```sql
CREATE TABLE jobs (
  id           UUID PRIMARY KEY,
  shard_id     INT NOT NULL,            -- hash(id) % 64: đơn vị phân chia cho scheduler
  schedule     TEXT,                    -- cron expr; NULL nếu one-shot
  run_at       TIMESTAMPTZ,             -- one-shot
  next_run_at  TIMESTAMPTZ NOT NULL,
  priority     SMALLINT DEFAULT 5,
  payload      JSONB NOT NULL,
  status       TEXT DEFAULT 'ACTIVE',   -- ACTIVE | PAUSED
  max_attempts INT DEFAULT 5
);
-- Index quyết định sống còn: tìm job đến hạn theo shard
CREATE INDEX idx_due ON jobs (shard_id, next_run_at) WHERE status = 'ACTIVE';

CREATE TABLE job_runs (
  id            UUID PRIMARY KEY,
  job_id        UUID NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  attempt       INT DEFAULT 0,
  status        TEXT, -- ENQUEUED | RUNNING | SUCCEEDED | FAILED | DEAD
  lease_until   TIMESTAMPTZ,            -- worker lease, gia hạn bằng heartbeat
  worker_id     TEXT,
  UNIQUE (job_id, scheduled_for)        -- ⭐ chốt chặn duplicate ở tầng DB
);
```

**`UNIQUE (job_id, scheduled_for)`** là câu trả lời 1 dòng cho "hai scheduler cùng fire 1 job": kể cả 2 node cùng nhìn thấy job đến hạn, chỉ 1 INSERT thành công, node kia nhận unique violation và bỏ qua. Defense in depth — kể cả election có split-brain ngắn cũng không chạy đôi.

**Phân chia công việc giữa scheduler nodes** — 2 phương án nói trong interview:

*Phương án A — partition + lease (khuyên chọn):* 64 shard logic, mỗi scheduler node thuê (lease) một tập shard, lease ghi trong DB/ZooKeeper kèm TTL, heartbeat gia hạn. Node chết → lease hết hạn → node khác nhận shard. Không cần "1 leader toàn cục" (single bottleneck) mà là **nhiều owner nhỏ** — scale tuyến tính.

*Phương án B — competing consumers với `SKIP LOCKED`* (đơn giản, đủ tốt tới scale trung bình — và là pattern Node.js engineer hay tự xây trên Postgres):

```sql
-- Mỗi scheduler tick chạy: lấy việc mà KHÔNG chặn nhau, không double-claim
WITH due AS (
  SELECT id FROM jobs
  WHERE status = 'ACTIVE' AND next_run_at <= now()
  ORDER BY next_run_at
  LIMIT 100
  FOR UPDATE SKIP LOCKED        -- ⭐ node khác đang giữ row nào thì nhảy qua
)
UPDATE jobs j SET next_run_at = compute_next(j.schedule, now())
FROM due WHERE j.id = due.id
RETURNING j.id, j.payload;
```

`FOR UPDATE SKIP LOCKED` biến Postgres thành work queue an toàn — nhiều node poll song song, không ai lấy trùng row. Trả lời câu "tại sao không cần ZooKeeper ngay từ đầu" rất gọn.

#### 4.2. Pull vs Push cho worker, at-least-once + idempotency, retry

**Pull (worker tự lấy) — chọn pull, lý do:**
- Backpressure tự nhiên: worker bận thì không lấy thêm; push thì scheduler phải track tải từng worker.
- Worker chết không ai phải phát hiện để "đẩy lại" — message còn trong queue/lease hết hạn thì tự về.
- Push chỉ thắng khi cần latency cực thấp (ms) — bài này SLA 60s, pull thắng tuyệt đối.

**At-least-once + lease + heartbeat (xử lý "node chết giữa chừng"):**
1. Worker nhận message → set `lease_until = now() + 60s`, status `RUNNING`.
2. Job dài → heartbeat mỗi 20s gia hạn lease.
3. Worker chết → hết heartbeat → reaper job quét `RUNNING AND lease_until < now()` → đánh fail, re-enqueue (tăng `attempt`).
4. Hệ quả: job có thể chạy lại dù lần trước đã *gần xong* → **worker bắt buộc idempotent**.

Cách làm worker idempotent (nói cụ thể, đừng chỉ hô khẩu hiệu):
- Job "gửi email": check bảng `sent_emails(run_id PRIMARY KEY)` trước khi gửi — dedup theo run_id.
- Job "cộng tiền": dùng idempotency key = `run_id` truyền vào payment API (nối với Bài 1).
- Job "ghi file báo cáo": ghi vào path theo `run_id`, ghi đè vô hại (naturally idempotent).

**Retry với backoff + jitter:**

```js
// delay = min(cap, base * 2^attempt) + random jitter — tránh thundering herd
const delayMs = Math.min(15 * 60_000, 1000 * 2 ** attempt)
              + Math.floor(Math.random() * 1000);
// BullMQ: { attempts: 5, backoff: { type: 'exponential', delay: 1000 } }
```

Phân biệt retryable (timeout, 5xx, deadlock) vs non-retryable (validation error, 4xx) — non-retryable đi thẳng DLQ, đừng đốt 5 attempts vô ích. Quá max attempts → **dead letter queue** + alert + UI cho phép replay thủ công sau khi fix bug.

#### 4.3. Delayed jobs hiệu năng cao — Redis sorted set & timing wheel

Với one-shot delay ngắn khối lượng lớn ("gửi push sau 30 phút" × hàng triệu), poll Postgres mỗi giây sẽ đuối → 2 kỹ thuật chuyên dụng:

**Redis sorted set (cách BullMQ làm — kể được vì là Node.js engineer):**

```
ZADD delayed:jobs <timestamp_ms> <job_id>      # thêm job hẹn giờ
# Mover chạy mỗi ~1s, atomic bằng Lua script:
#   ZRANGEBYSCORE delayed:jobs 0 <now> LIMIT 0 1000   → lấy job đến hạn
#   → LPUSH ready:queue ...  +  ZREM ...               (cùng 1 script = atomic)
```

- O(log N) insert, lấy job đến hạn O(log N + M). 10M delayed jobs vẫn nhẹ nhàng.
- Lua script đảm bảo "lấy + xoá + đẩy sang ready queue" là atomic — không mất job giữa 2 lệnh.
- Trade-off: Redis là RAM — bật AOF `everysec` (chấp nhận mất ≤1s job khi crash) hoặc job store gốc vẫn ở Postgres, Redis chỉ là "tầng hẹn giờ" rebuild được.

**Kafka + timing wheel (khi cần durability của Kafka):** Kafka không hỗ trợ delay native → pattern nhiều topic theo nấc delay (`delay-1m`, `delay-10m`, `delay-1h`); consumer của topic delay đọc message, thấy chưa đến hạn thì **pause partition** đến hạn rồi forward sang topic đích. Hierarchical timing wheel (cách Kafka dùng nội bộ cho purgatory) cho phép O(1) insert/expire hàng triệu timer trong RAM. Nói ngắn: "sorted set đơn giản hơn nhiều, tôi chỉ với tới timing wheel khi cần throughput triệu timer/s."

**Priority queue:** đừng làm 1 queue có sort phức tạp — làm **N queue riêng** (high/default/low), worker poll theo weighted round-robin (vd 5:3:1) để low không bị starve tuyệt đối. Trong BullMQ có priority option nhưng scale lớn thì separate queue + dành riêng worker pool cho high vẫn sạch hơn.

### Bước 5: Trade-offs & bottlenecks

| Quyết định | Chọn | Đánh đổi |
|---|---|---|
| Semantics | At-least-once + idempotent worker | Đẩy gánh nặng idempotency cho người viết job handler; nhưng at-most-once nghĩa là chấp nhận mất job — thường tệ hơn |
| Coordination | Partition + lease trong DB (không ZooKeeper từ đầu) | Granularity failover là cả shard (vài giây delay khi node chết); đổi lại bớt 1 hệ thống phải vận hành |
| Worker model | Pull | Latency nhỉnh hơn push vài trăm ms; backpressure và fault tolerance đơn giản hơn hẳn |
| Delayed jobs | Redis sorted set | Phải lo persistence cho Redis; đổi lại đơn giản và nhanh hơn poll DB nhiều |
| Job store | Postgres | Tới ~50k jobs/s do dòng `next_run_at` update nhiều; lúc đó mới cần chuyển scheduling state sang chuyên dụng |

Bottlenecks:
- **Cron dồn cục lúc 00:00**: queue hấp thụ burst + autoscale worker theo queue depth; với recurring job nội bộ, chủ động **jitter** lịch (`0 0 * * *` → rải ngẫu nhiên trong 0-5 phút nếu user cho phép).
- **Hot index `next_run_at`**: update liên tục → bloat; partial index + autovacuum tuning; hoặc tách "due queue" sang Redis như trên.
- **Job dài chiếm hết worker**: pool riêng theo loại job (queue routing), timeout cứng + kill, giới hạn concurrency theo tenant để 1 khách không chiếm cả cluster (noisy neighbor).
- **Reaper là single point**: chính reaper cũng chạy như một job có lease — bất kỳ node nào cũng nhận được.

### ❓ Follow-up questions interviewer hay hỏi tiếp

1. **"Exactly-once có làm được không?"** → Không tồn tại exactly-once *delivery* trên network không tin cậy; chỉ có exactly-once *processing* = at-least-once delivery + idempotent processing (dedup theo run_id). Trả lời này áp dụng cho mọi bài queue.
2. **"Job phải chạy đúng giờ tới mili giây thì sao?"** → Đổi kiến trúc: pre-load job sắp đến hạn (1-2 phút tới) vào RAM của scheduler, dùng in-memory timer (timing wheel) fire chính xác; chấp nhận phức tạp hơn khi failover.
3. **"DST/timezone xử lý sao với cron?"** → Lưu timezone theo job, tính `next_run_at` bằng thư viện tz-aware (Luxon/cron-parser); xử lý ca 2:30 AM không tồn tại / tồn tại 2 lần khi đổi giờ — skip hoặc fire-once theo policy khai báo.
4. **"Làm sao biết job 'chết âm thầm' — không fail nhưng không bao giờ xong?"** → Timeout cứng theo loại job + lease expiry; metric `runtime p99` theo job type, alert khi vượt baseline.
5. **"DAG dependency (job B chạy sau job A) thêm vào thế nào?"** → Thêm bảng `job_dependencies`, job B ở trạng thái `WAITING`, khi A succeed thì event trigger đánh giá B; cần topological sort và phát hiện cycle lúc đăng ký — chính là core của Airflow.
6. **"BullMQ/Sidekiq có sẵn rồi, sao phải tự build?"** → Câu hỏi bẫy về judgment: trả lời "đúng, dưới ~10k jobs/s tôi dùng BullMQ + Redis, không tự build; tự build chỉ khi cần multi-region, multi-tenant isolation, hoặc compliance đặc thù" — thể hiện biết build-vs-buy.

---

## Bài 4: Design Real-time Leaderboard (Game ranking / Top seller)

### 🎤 Cách nhà tuyển dụng đặt câu hỏi

Câu hỏi gốc:
> "Thiết kế leaderboard realtime cho game 50 triệu người chơi: cập nhật điểm liên tục, xem top 10 toàn server, và xem rank chính xác của bản thân."

Biến thể:
- "Design bảng xếp hạng top seller cho sàn TMĐT, cập nhật theo giờ/ngày/tháng."
- "Design ranking cho cuộc thi 100M người tham gia, ai cũng muốn biết mình hạng mấy." (xoáy rank chính xác ở scale lớn)
- "Tại sao không `SELECT ... ORDER BY score DESC` là xong?" (mồi để bạn giải thích vì sao RDBMS không gánh nổi)
- "Một sorted set Redis không chứa nổi thì làm sao?" (xoáy sharding)

**Interviewer đánh giá gì:** nắm chắc Redis sorted set và độ phức tạp của nó, biết giới hạn của single-key và cách shard, phân biệt bài "top-N" (dễ) với bài "rank chính xác của 1 user" (khó), và ý thức về persistence của Redis.

### Bước 1: Clarify requirements

Câu hỏi nên hỏi lại:
1. "Leaderboard theo phạm vi nào — global, per-region, per-friend-list?" → Global + monthly reset; friend leaderboard là follow-up.
2. "Realtime tới mức nào? Điểm cập nhật xong bao lâu phải thấy trên bảng?" → < 1-2 giây cho top-N; rank cá nhân chấp nhận xấp xỉ khi scale lớn.
3. "Điểm chỉ tăng hay có giảm?" → Có thể cả hai (ZADD xử lý được cả hai, nhưng ảnh hưởng cách shard theo bucket).
4. "Tie-break thế nào khi bằng điểm?" → Ai đạt trước xếp trên.
5. "Cần lịch sử (leaderboard tuần trước) không?" → Có, lưu snapshot.

**Functional:** update điểm khi user chơi xong trận; xem top-N (N ≤ 100); xem rank + điểm của chính mình; xem hàng xóm quanh rank mình (±5); reset theo mùa/tháng; leaderboard lịch sử.

**Non-functional:** read latency p99 < 50ms; update-to-visible < 2s; 50M user/leaderboard; chịu được Redis restart không mất bảng xếp hạng (rebuild được); top-N phải **chính xác**, rank cá nhân ở tail có thể xấp xỉ.

### Bước 2: Ước lượng quy mô (back-of-envelope)

- 50M player, DAU 10M, mỗi DAU chơi 20 trận/ngày → 200M score updates/ngày → **~2,300 writes/s trung bình, peak tối x5 ≈ 12,000 writes/s**.
- Read: xem leaderboard 5 lần/DAU/ngày → 50M reads/ngày ≈ 600 RPS, nhưng top-10 cache được nên đa số read không chạm sorted set.
- Memory cho 1 sorted set 50M member: Redis zset ≈ ~100-130 bytes/entry (skiplist + dict + member string ~10 byte) → **~6 GB** — *vừa* trong 1 Redis node lớn, nhưng 12k writes/s + single-threaded + đây là dữ liệu sống còn → vẫn nên bàn sharding/replica.
- Persistence nguồn sự thật: bảng `scores` trong Postgres, 50M rows × 100 bytes = 5 GB — nhỏ; Redis chỉ là serving layer.

**Insight nói ra miệng:** "Một zset 50M entry về dung lượng thì 1 node Redis chứa được — bài toán shard không phải vì RAM mà vì **throughput, blast radius và HA**. Và tôi sẽ tách rõ: top-N là bài dễ, rank chính xác của user hạng 23,456,789 mới là bài khó."

### Bước 3: High-level design

```
 Game Server ──(match result)──▶ Kafka topic: score-events
                                      │
                      ┌───────────────┴────────────────┐
                      ▼                                ▼
            ┌──────────────────┐            ┌────────────────────┐
            │ Score Consumer   │            │ Postgres `scores`  │
            │ (Node.js)        │            │ (source of truth,  │
            │ ZADD / ZINCRBY   │            │  rebuild + audit)  │
            └────────┬─────────┘            └────────────────────┘
                     ▼
            ┌──────────────────┐   replica   ┌──────────────────┐
            │ Redis (primary)  │────────────▶│ Redis replicas   │
            │ zset lb:2026-06  │             │ (read scaling)   │
            └────────┬─────────┘             └──────────────────┘
                     │
                     ▼
            ┌──────────────────┐
            │ Leaderboard API  │──▶ cache top-100 (in-process, TTL 1-2s)
            │ (Node.js)        │──▶ GET /leaderboard/top?n=10
            └──────────────────┘──▶ GET /leaderboard/me   (ZSCORE + ZREVRANK)
```

Luồng:
1. Trận đấu kết thúc → game server bắn event vào Kafka (durable, replay được).
2. Consumer ghi **cả hai nơi**: Postgres (truth) và Redis (serving). Đi qua Kafka nên hai bên eventual-consistent với nhau và rebuild được.
3. Đọc top-10: API đọc cache in-process (TTL 1-2s) → cache miss thì `ZREVRANGE lb:2026-06 0 9 WITHSCORES` → O(log N + 10), dưới 1ms.
4. Đọc rank của tôi: `ZREVRANK` + `ZSCORE` — O(log N).

Lệnh Redis cốt lõi (nói được độ phức tạp là điểm cộng):

```
ZADD lb:2026-06 15300 user:42           # set điểm — O(log N)
ZINCRBY lb:2026-06 50 user:42           # cộng dồn điểm — O(log N)
ZREVRANGE lb:2026-06 0 9 WITHSCORES     # top 10 — O(log N + M)
ZREVRANK lb:2026-06 user:42             # rank của user (0-based) — O(log N)
ZREVRANGE lb:2026-06 (r-5) (r+5)        # hàng xóm quanh rank — O(log N + M)
ZCOUNT lb:2026-06 (myScore +inf         # đếm số người điểm cao hơn — O(log N)
```

Tie-break "đạt trước xếp trên" bằng composite score: `score thực × 2^20 + (2^20 − timestamp_offset)` — nhét tie-breaker vào phần thấp của double (cẩn thận: score Redis là double 64-bit, chính xác nguyên vẹn tới 2^53 — phải nói ra giới hạn này).

### Bước 4: Deep dive

#### 4.1. Khi 1 sorted set không đủ — shard theo bucket điểm

Khi nào phải shard: zset 500M+ entry, write > 50-100k/s (Redis single-thread ~100k ops/s), hoặc muốn blast radius nhỏ. Cách shard quyết định query nào còn rẻ:

**Shard theo user_id (hash) — KHÔNG dùng cho leaderboard:** điểm của các user rải ngẫu nhiên khắp shard → muốn top-10 phải hỏi mọi shard rồi merge (chấp nhận được, k nhỏ), nhưng muốn **rank của 1 user** thì phải hỏi mọi shard "bao nhiêu người điểm cao hơn X?" rồi cộng — mọi query rank đều scatter-gather. Nêu ra để bác bỏ.

**Shard theo bucket điểm (range) — cách đúng:**

```
shard 0: score [0, 1000)        — zset riêng, ~30M users (đáy phân bố)
shard 1: score [1000, 5000)     — ~15M users
shard 2: score [5000, 20000)    — ~4M users
shard 3: score [20000, +inf)    — ~1M users (đỉnh)

Bảng đếm (cache, cập nhật định kỳ): count[i] = số member shard i
```

- **Top-N**: chỉ đụng shard cao nhất (tràn thì lấy thêm shard kế) — O(log n_shard + N), rẻ.
- **Rank của user điểm S thuộc shard i**: `rank = Σ count[j] (j > i) + ZCOUNT shard_i (S +inf`. Một query vào đúng 1 shard + bảng đếm cache — không scatter-gather.
- **Cái giá phải nói rõ**: (1) phân bố điểm lệch → bucket boundary phải chỉnh theo percentile thực tế, định kỳ rebalance; (2) user tăng/giảm điểm **vượt biên bucket** → phải `ZREM` shard cũ + `ZADD` shard mới — 2 thao tác trên 2 node, cần Lua/transaction-per-shard + dedup, chấp nhận hở vài ms; (3) `count[j]` là cache vài giây tuổi → rank lệch nhẹ — chấp nhận được vì rank hạng triệu không ai soi từng đơn vị.

#### 4.2. Top-N chính xác vs rank chính xác của 1 user — và lối thoát xấp xỉ

Đây là phân tích interviewer chờ nghe nhất:

- **Top-N (N ≤ 100):** luôn rẻ, luôn chính xác được — một zset hoặc shard đỉnh, cache 1-2s là hết chuyện. SLA chặt.
- **Rank chính xác của user bất kỳ:** `ZREVRANK` O(log N) trên 1 zset là ổn; nhưng ở 500M+ user sharded, hoặc khi cần "percentile của tôi" trên nhiều chiều, đắt dần. Câu hỏi đúng để hỏi lại interviewer: **"user hạng 23 triệu có cần biết chính xác mình hạng 23,456,789 hay chỉ cần 'top 5%'?"** — gần như mọi sản phẩm thật chỉ cần xấp xỉ ở tail.

**Giải pháp xấp xỉ cho rank tail:** giữ **histogram phân bố điểm** (ví dụ 10,000 bucket đều theo score, cập nhật bằng counter khi score đổi). Rank(S) ≈ tổng count các bucket > S + nội suy tuyến tính trong bucket chứa S. Sai số ≤ kích thước 1 bucket (~0.01%), chi phí O(1) mỗi query, RAM vài trăm KB. Top 1000 thì vẫn dùng zset chính xác. Kết hợp: **chính xác ở đầu bảng, xấp xỉ ở đuôi** — đúng chỗ user nhạy cảm.

**Kết hợp batch (chính xác) + realtime (xấp xỉ)** — pattern cho leaderboard "top seller" e-commerce:
- Batch: mỗi giờ, job chạy trên Postgres/warehouse tính bảng xếp hạng **chuẩn** (logic phức tạp: trừ đơn hoàn, anti-fraud, loại seller vi phạm) → ghi đè baseline vào Redis.
- Realtime: giữa 2 lần batch, consumer cộng dồn delta trực tiếp vào Redis (xấp xỉ — chưa trừ hoàn đơn).
- Lambda-style: serving = baseline + delta; mỗi giờ delta được "thanh lý" vào baseline. User thấy số nhảy realtime, số "chuẩn" tự điều chỉnh mỗi giờ. Nói rõ: game score đơn giản thì pure-realtime đủ; pattern này dành cho khi **logic tính điểm phức tạp/cần sửa lại quá khứ**.

#### 4.3. Persistence & rebuild — Redis chết thì sao?

Nguyên tắc phải phát biểu: **Redis là serving layer, không phải source of truth.** Mọi score event đi qua Kafka và đáp xuống Postgres trước/song song với Redis.

```sql
CREATE TABLE scores (
  leaderboard_id TEXT NOT NULL,         -- 'lb:2026-06'
  user_id        BIGINT NOT NULL,
  score          BIGINT NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (leaderboard_id, user_id)
);
CREATE INDEX idx_scores_rank ON scores (leaderboard_id, score DESC); -- phục vụ rebuild + batch
```

Phòng thủ nhiều lớp:
1. **Redis replication + sentinel/cluster**: primary chết → failover sang replica trong vài giây, mất nhiều nhất vài giây ghi (async replication) — đuổi kịp nhờ bước 3.
2. **AOF everysec**: restart cùng node chỉ mất ≤1s dữ liệu. (RDB-only có thể mất hàng phút — nói được sự khác nhau là điểm cộng.)
3. **Rebuild từ truth**: script đọc Postgres theo trang (`ORDER BY score DESC`), pipeline `ZADD` batch 5,000 — 50M entry với pipeline ~50-100k entry/s → **~10-15 phút**. Trong lúc rebuild, serve từ replica cũ hoặc degrade (chỉ hiện top-100 từ snapshot gần nhất).
4. **Replay Kafka từ offset** sau thời điểm snapshot để vá đoạn hở — vì consumer idempotent (ZADD set tuyệt đối là idempotent tự nhiên; ZINCRBY thì phải dedup theo event_id).

Reset mùa: key mới `lb:2026-07` (đừng xoá in-place); key cũ snapshot top-N vào Postgres rồi để TTL tự dọn. Đổi key = zero-downtime reset.

### Bước 5: Trade-offs & bottlenecks

| Quyết định | Chọn | Đánh đổi |
|---|---|---|
| Serving store | Redis zset | RAM-bound và single-threaded/key; nhưng không có cấu trúc nào khác cho rank O(log N) tiện như vậy |
| Source of truth | Postgres + Kafka, Redis chỉ derive | Ghi 2 nơi, eventual giữa 2 nơi; đổi lại rebuild được và audit được |
| ZADD vs ZINCRBY | ZADD (set tuyệt đối, score tính từ truth) | Phải đọc-tính trước khi ghi; đổi lại idempotent tự nhiên, replay không sợ cộng đôi |
| Rank tail | Xấp xỉ bằng histogram | Sai số ~0.01%; đổi lại O(1) và không scatter-gather |
| Top-N | Cache 1-2s | Trễ tối đa 2s so với "tuyệt đối realtime"; chặn được stampede đọc |

Bottlenecks:
- **Hot key**: 1 zset = 1 key = 1 core Redis. Write 12k/s ổn; vượt 50-100k/s → shard bucket (4.1) hoặc gom delta phía consumer (aggregate 100ms rồi ZINCRBY 1 lần/user).
- **Top-10 read stampede**: cache in-process mỗi API node + single-flight (1 request đi refresh, số còn lại dùng giá trị cũ).
- **Celebrity watching** (triệu người xem profile/rank của 1 streamer): cache rank của user hot theo TTL ngắn riêng.
- **Phân bố lệch khi shard bucket**: theo dõi count từng shard, alert lệch >2x, rebalance boundary trong cửa sổ bảo trì (hoặc online bằng double-write 2 boundary trong lúc chuyển).

### ❓ Follow-up questions interviewer hay hỏi tiếp

1. **"Sao không dùng SQL `ORDER BY score DESC LIMIT 10` + index?"** → Top-10 thì được; nhưng `rank của user X` = `COUNT(*) WHERE score > X` là O(N) scan index trên hàng chục triệu row, lại x nghìn QPS → chết. Window function `RANK()` cũng tính toàn bộ. Zset cho cả hai ở O(log N).
2. **"Friend leaderboard (rank trong 200 bạn bè) làm sao?"** → Đừng tạo zset/friend-list (50M zset!); lấy 200 friend_id → `ZMSCORE` (1 lệnh) → sort 200 phần tử trong app — N nhỏ thì compute-on-read luôn thắng.
3. **"Chống gian lận điểm?"** → Score event phải từ game server authoritative (không bao giờ tin client), signed event, anomaly detection (delta điểm/phút vượt trần) đẩy vào quarantine trước khi vào bảng chính — đây là lý do nữa để mọi event qua Kafka + truth DB.
4. **"Leaderboard theo nhiều chiều (ngày/tuần/tháng/region)?"** → Mỗi chiều 1 zset (`lb:day:2026-06-10`, `lb:region:VN:2026-06`), 1 event fan-out ZADD vào k zset — write x k nhưng read vẫn O(log N); kiểm soát k bằng cách chỉ giữ chiều có người xem.
5. **"Score là double, điểm của tôi là số nguyên 64-bit lớn thì sao?"** → Score zset là IEEE double — chính xác nguyên vẹn chỉ tới 2^53; điểm vượt mức đó phải chia scale hoặc lưu điểm thật ở DB còn zset giữ điểm rút gọn.
6. **"Update-to-visible < 100ms thì kiến trúc đổi gì?"** → Bỏ Kafka khỏi đường serving: API ghi Redis đồng bộ (vẫn bắn Kafka async cho truth), cache top-N giảm TTL còn ~100ms hoặc đẩy invalidation qua pub/sub tới các API node.

---

## Bài 5: Design Proximity Service (Yelp nearby / Grab tìm tài xế)

### 🎤 Cách nhà tuyển dụng đặt câu hỏi

Câu hỏi gốc:
> "Thiết kế tính năng 'tìm quán ăn trong bán kính 5km quanh tôi' như Yelp/Google Maps — 200M địa điểm, 100k QPS search."

Biến thể:
- "Design hệ thống matching tài xế gần nhất cho Grab/Uber." (thêm chiều **vị trí cập nhật liên tục** — write-heavy)
- "Design 'bạn bè quanh đây' / 'người lạ gần bạn' kiểu Tinder."
- "Tại sao index B-tree trên (lat, lng) không hiệu quả cho query bán kính?" (mồi để bạn giải thích spatial index)
- "So sánh geohash với quadtree, khi nào dùng cái nào?"

**Interviewer đánh giá gì:** hiểu vì sao dữ liệu 2 chiều cần index đặc biệt, so sánh được geohash/quadtree/Redis GEO/PostGIS, và tách được 2 bài con rất khác nhau: **static places (read-heavy)** vs **moving objects (write-heavy)**.

### Bước 1: Clarify requirements

Câu hỏi nên hỏi lại:
1. "Đối tượng tĩnh (quán ăn) hay di động (tài xế)?" → Chốt: chính là quán ăn (tĩnh), phần deep dive bàn thêm biến thể tài xế.
2. "Bán kính search tối đa? Kết quả tối đa bao nhiêu, có filter (category, rating, đang mở cửa) và sort không?" → ≤ 20km, top 50, có filter category + sort theo khoảng cách/rating.
3. "Độ chính xác khoảng cách cần mức nào? Kết quả trễ vài phút so với data mới có sao không?" → Khoảng cách sai số vài chục mét OK; quán mới tạo xuất hiện sau ≤1 phút OK.
4. "Phạm vi địa lý — một quốc gia hay toàn cầu (multi-region)?" → Toàn cầu.
5. "QPS bao nhiêu, tỷ lệ read/write?" → Read-heavy: search nhiều, business ít thay đổi.

**Functional:** search nearby (lat, lng, radius, filter) trả danh sách sắp xếp theo khoảng cách; CRUD business; xem chi tiết business. (Biến thể driver: update vị trí mỗi vài giây + match gần nhất.)

**Non-functional:** search p99 < 200ms; 100k QPS search; eventual consistency cho dữ liệu business (trễ ≤1 phút chấp nhận); HA — search là tính năng cửa ngõ của app.

### Bước 2: Ước lượng quy mô (back-of-envelope)

- 200M business toàn cầu. Mỗi record (id, tên, toạ độ, category, rating...) ~1 KB → **200 GB** business data; phần phục vụ geo-index chỉ cần (id, lat, lng, geohash) ~50 bytes → **~10 GB** — *nằm gọn trong RAM một node* — insight quan trọng: geo-index nhỏ hơn người ta tưởng nhiều.
- Search: DAU 100M, 5 search/ngày = 500M search/ngày ≈ 5,800 QPS trung bình, **peak giờ ăn trưa/tối x10-15 ≈ 60-100k QPS** → khớp đề bài.
- Write business: 0.1% business thay đổi/ngày = 200k writes/ngày ≈ **2-3 writes/s** — gần như không đáng kể → read-heavy cực đoan (tỷ lệ ~40,000:1) → mọi quyết định nghiêng về cache + replica.
- *Biến thể driver*: 1M tài xế online, gửi vị trí mỗi 4s → **250k location writes/s** — đảo ngược hoàn toàn bài toán → phần 4.3.

### Bước 3: High-level design

```
   Client (lat, lng, r=5km, category=food)
        │
        ▼
 ┌─────────────┐     ┌──────────────────────────────┐
 │ LB / API GW │────▶│ Search Service (Node.js)      │
 └─────────────┘     │ 1. lat/lng → geohash cells    │
                     │ 2. query index theo cells     │
        ┌────────────│ 3. tính distance chính xác,   │
        │            │    filter, rank, paginate     │
        │            └───────────┬──────────────────┘
        │ cache theo cell        │ candidate ids → fetch detail
        ▼                        ▼
 ┌──────────────┐    ┌────────────────────┐   ┌─────────────────────┐
 │ Redis        │    │ Geo Index          │   │ Business Service     │
 │ cell:wx4g0 → │    │ (Redis GEO /       │   │ + Postgres (PostGIS) │
 │ [ids] TTL 5m │    │  in-memory geohash │   │ + read replicas      │
 └──────────────┘    │  map, rebuild từ DB)│  └──────────┬──────────┘
                     └────────────────────┘              │ CDC / cron rebuild
                                                         ▼
                                              Geo Index được làm mới ≤1 phút
```

Luồng search:
1. Client gửi toạ độ + radius. Service tính **geohash precision phù hợp radius** rồi suy ra cell trung tâm + 8 cell hàng xóm.
2. Lấy candidate ids theo cell — ưu tiên trúng cache Redis theo cell; miss thì hỏi geo index.
3. Tính khoảng cách chính xác (haversine) cho từng candidate, lọc đúng bán kính (vì cell là vuông, vòng tròn là tròn), filter category, sort, limit 50.
4. Hydrate chi tiết business từ cache/DB replica.

Luồng write: business update → Postgres (truth) → CDC/cron job cập nhật geo index + invalidate cache cell liên quan. Trễ ≤1 phút là đạt yêu cầu — **đừng** làm strong-consistent path cho thứ không cần.

### Bước 4: Deep dive

#### 4.1. Vì sao cần spatial index — và chọn geohash vs quadtree vs Redis GEO vs PostGIS

**Vấn đề gốc (nói trước tiên):** B-tree index trên `(lat, lng)` không trả lời được query 2 chiều hiệu quả: `WHERE lat BETWEEN ... AND lng BETWEEN ...` chỉ dùng được index cho **một** chiều, chiều kia phải scan. Bản chất mọi spatial index là **ánh xạ không gian 2D về 1D mà vẫn giữ tính lân cận**.

**Geohash** — chia đôi kinh/vĩ độ đệ quy, đan xen bit, encode base32:

```
precision 4 → cell ~ 39 km × 19.5 km   (search radius ~20 km)
precision 5 → cell ~ 4.9 km × 4.9 km   (search radius ~2-5 km)  ← hay dùng nhất
precision 6 → cell ~ 1.2 km × 0.6 km   (search radius ~0.5-1 km)

"wx4g0..." — chung prefix dài hơn ⇒ (thường) gần nhau hơn
```

- Ưu: cell id là **string tĩnh** → làm key Redis/cột DB index B-tree thường được; "tìm trong cell" = prefix match; đơn giản, dễ shard theo cell.
- Nhược + cách xử lý (phải nói, đây là chỗ phân biệt ứng viên): (1) **boundary problem** — 2 điểm sát nhau nhưng nằm 2 bên ranh giới cell có geohash khác hẳn → **luôn query cell trung tâm + 8 neighbors**; (2) cell kích thước cố định → khu đông (quận 1) và sa mạc cùng độ phân giải — khu đông phải lọc nhiều candidate.

**Quadtree** — cây chia 4 đệ quy, **chia sâu hơn ở nơi dày đặc** (split khi node > ngưỡng ~100 điểm):
- Ưu: adaptive theo mật độ — giải quyết đúng nhược điểm 2 của geohash; tìm "k điểm gần nhất" (kNN) tự nhiên hơn (lan dần ra node lân cận).
- Nhược: cấu trúc in-memory trên 1 process, phân tán khó hơn (phải tự shard cây, rebalance khi mật độ đổi); update làm thay đổi cấu trúc cây (split/merge) cần lock.
- Khi nào chọn: index in-memory tự quản và mật độ cực lệch, hoặc cần kNN chuẩn. (Google S2 — đề cập 1 câu: dùng Hilbert curve, được Uber/Google dùng, ý tưởng "cell + 1D ordering" giống geohash nhưng cell đều diện tích hơn và locality tốt hơn.)

**Redis GEO** — chính là geohash 52-bit lưu làm score của... sorted set (nối kiến thức Bài 4):

```
GEOADD geo:restaurants 106.7009 10.7769 biz:42
GEOSEARCH geo:restaurants FROMLONLAT 106.70 10.77 BYRADIUS 5 km ASC COUNT 50
```

- Ưu: 2 lệnh là xong, nhanh (in-memory), tự xử lý boundary hộ bạn.
- Nhược: index 1 key → 1 node (shard phải tự làm theo region), RAM, filter thuộc tính (category, rating) phải làm ở app sau khi lấy candidates.

**PostGIS** — `GiST index` (R-tree) trên kiểu `geography`:

```sql
CREATE TABLE businesses (
  id        BIGSERIAL PRIMARY KEY,
  name      TEXT,
  category  TEXT,
  rating    REAL,
  location  GEOGRAPHY(POINT, 4326) NOT NULL
);
CREATE INDEX idx_biz_location ON businesses USING GIST (location);

SELECT id, name, ST_Distance(location, ref.geog) AS meters
FROM businesses,
     (SELECT ST_MakePoint($lng, $lat)::geography AS geog) ref
WHERE ST_DWithin(location, ref.geog, 5000)        -- dùng GiST index
  AND category = 'restaurant'
ORDER BY location <-> ref.geog                     -- KNN operator, index-assisted
LIMIT 50;
```

- Ưu: **filter + sort + geo trong 1 query**, transactional với business data, kNN operator `<->` dùng index. Nhược: vertical-scale + read replica là chính; 100k QPS thuần PostGIS sẽ cần nhiều replica → đặt cache phía trước.

**Kiến trúc chốt cho bài Yelp:** Postgres + PostGIS làm truth và xử lý query phức tạp; **Redis GEO/cell-cache phía trước** hấp thụ 90%+ traffic các query phổ biến ("đồ ăn gần đây bán kính mặc định"); index data chỉ 10 GB nên mỗi search node thậm chí giữ được **bản in-memory geohash map** (cell → ids) rebuild mỗi phút từ DB — search không network hop, p99 cực thấp. Đó là lợi thế của read-heavy + data nhỏ + cho phép trễ 1 phút.

#### 4.2. Tính search radius → chọn cells, và cache theo cell

Thuật toán chọn cell theo radius (nói cụ thể để show độ sâu):
1. Chọn precision sao cho **cạnh cell ≳ radius** (radius 5km → precision 5, cell ~4.9km) → vòng tròn search phủ tối đa bởi 3×3 cells.
2. Query 9 cells (center + 8 neighbors) → union candidates.
3. **Lọc lại bằng haversine** từng candidate (cell vuông ⊃ hình tròn → có false positive, không có false negative).
4. Nếu kết quả < k (vùng thưa): **mở rộng dần** — giảm precision 1 nấc (cell to gấp ~4-8 lần) hoặc thêm vành cell ngoài, lặp tới khi đủ k hoặc chạm radius trần 20km. Đây chính là "kNN bằng geohash".

Cache theo cell (chứ không theo toạ độ user!):
- Key: `cell:{geohash5}:{category}` → danh sách top ids đã sort sẵn theo rating, TTL 5-10 phút.
- Vì sao theo cell: toạ độ user là **liên tục** (vô hạn key, hit rate ~0); cell là **rời rạc** (hữu hạn key) — nghìn user đứng quanh Bến Thành cùng rơi vào `wx4g0...` → hit rate rất cao. Đây là câu trả lời mẫu cho "cache kết quả search kiểu gì khi input là toạ độ?"
- Sai số chấp nhận: user ở mép cell thấy kết quả "lệch tâm" nhẹ — đã được bù bằng việc query 9 cell và lọc haversine ở tầng cuối (chỉ cache danh sách candidate theo cell, còn distance + sort cuối vẫn tính theo toạ độ thật của user — rẻ, vài chục phần tử).
- Invalidation: business update → xoá các key `cell:{hash}:*` chứa nó (tính được từ toạ độ) — write 2-3/s nên invalidation gần như miễn phí.

#### 4.3. Biến thể write-heavy: vị trí tài xế cập nhật liên tục (Grab/Uber)

Đề đổi một câu — "tìm **tài xế** gần nhất" — là cả thiết kế đảo chiều, interviewer rất hay bẻ lái như vậy giữa buổi:

- Write: 1M driver × 1 update/4s = **250k writes/s**; mỗi update có TTL ý nghĩa (vị trí cũ 30s là rác). Đặc điểm vàng: **chỉ cần vị trí mới nhất**, không cần lịch sử trong đường nóng, mất 1 update chẳng sao (4s sau có cái mới) → **không được dùng disk-based DB cho đường này; không cần durability**.
- Thiết kế: **in-memory cell map, shard theo geohash cell**:

```
Driver app ──(loc mỗi 4s)──▶ Gateway (WebSocket) ──▶ shard theo geohash4 của vị trí
                                                          │
                              ┌────────────────────────────┴──────────┐
                              ▼                                       ▼
                    Location shard A (Node.js/Redis)        Location shard B ...
                    cells wx4*: { cell5 → Map(driverId →    
                                  {lat,lng,ts}) }           
                    - TTL sweep: xoá entry ts > 30s
                    - driver đổi cell: remove cũ + add mới
```

  - Mỗi shard giữ vài nghìn cell trong RAM (Map/Redis hash + GEOADD per-cell key). 250k writes/s chia ~10 shard = 25k/s/shard — Node.js hoặc Redis đều nhẹ.
  - Match: rider request → 9 cells quanh điểm đón → lấy drivers, lọc ts còn tươi, haversine, chấm điểm (distance + heading + rating) → top 5.
  - Driver di chuyển nhanh qua biên cell → "remove cũ + add mới" trên có thể 2 shard → chấp nhận hở/đúp vài giây, lọc bằng `ts` mới nhất theo driverId.
  - Lịch sử di chuyển (cần cho pricing, ETA model, audit) đi **đường nguội riêng**: gateway fan-out event vào Kafka → S3/warehouse — tách hot path khỏi cold path.
- Tối ưu write phía client (điểm cộng thực chiến): adaptive frequency — đứng yên gửi 30s/lần, đang di chuyển 2-4s/lần; gửi kèm heading/speed để server **dead-reckoning** (nội suy vị trí giữa 2 update) → giảm 50-70% writes.

**Ở vai Node.js backend engineer, kể thế này:** "Tôi sẽ nhận location qua WebSocket gateway bằng Node.js (`ws`/`uWebSockets.js`) — một instance giữ 100k+ driver connections; handler chỉ làm việc O(1): validate, đóng dấu ts, `GEOADD` vào key cell trên Redis và publish Kafka — không await gì nặng trên đường nóng. Search thì `GEOSEARCH ... BYRADIUS 2 km COUNT 10 ASC` trên 9 cell keys bằng pipeline, p99 vài ms."

### Bước 5: Trade-offs & bottlenecks

| Quyết định | Chọn | Đánh đổi |
|---|---|---|
| Spatial index (places) | Geohash cells + PostGIS làm truth | Geohash cell cố định, khu đậm đặc lọc nhiều candidate; đổi lại đơn giản, cache/shard theo cell tự nhiên |
| Consistency | Eventual (index trễ ≤1 phút) | Quán mới tạo chưa hiện ngay; đổi lại toàn bộ read path cache được mạnh tay |
| Cache key | Theo cell, không theo toạ độ user | Kết quả "lệch tâm" nhẹ ở mép cell; đổi lại hit rate từ ~0% lên rất cao |
| Driver location | In-memory + TTL, không durable | Mất update khi node chết — vô hại vì 4s sau có update mới; đổi lại chịu được 250k writes/s rẻ |
| Search node | Giữ index in-memory mỗi node | RAM 10-20 GB/node + rebuild mỗi phút; đổi lại không network hop khi search |

Bottlenecks:
- **Hot cell** (trung tâm Sài Gòn giờ ăn trưa, sự kiện đông người): cache theo cell hấp thụ read; với driver-write thì sub-shard cell nóng (cell5 → 4 cell6) hoặc tách cell nóng ra shard riêng.
- **Thundering herd khi cache cell expire**: stale-while-revalidate — serve bản cũ, 1 request đi refresh.
- **Vùng thưa phải mở rộng radius nhiều vòng**: precompute "mật độ theo cell" để chọn precision khởi điểm đúng ngay lần đầu.
- **Multi-region**: dữ liệu địa lý tự nhiên phân vùng — user VN không search quán ở Paris → mỗi region cluster độc lập, route theo geo-DNS; "biên giới region" hiếm và xử lý bằng query cả 2 (rất ít traffic).

### ❓ Follow-up questions interviewer hay hỏi tiếp

1. **"Vì sao composite B-tree index (lat, lng) không đủ?"** → Range query 2 chiều: index chỉ thu hẹp được chiều đầu (lat), chiều lng phải lọc trên toàn bộ dải lat đó — với dải toàn cầu là hàng triệu row. Spatial index (geohash/R-tree) giữ tính lân cận 2D trong cấu trúc 1D nên cắt được cả 2 chiều.
2. **"Geohash boundary problem là gì, xử lý sao?"** → Hai điểm cách nhau 10m nhưng nằm 2 bên ranh giới cell (kể cả ranh giới lớn như xích đạo/kinh tuyến gốc) có hash khác hoàn toàn → luôn query 8 neighbors; hash của neighbors tính được bằng công thức, O(1).
3. **"Sort theo 'liên quan' (rating + distance + đang mở cửa) thì làm ở đâu?"** → Lấy candidate bằng geo trước (vài trăm), rank ở app layer bằng scoring function; nếu cần full-text + geo + facet thì Elasticsearch (`geo_distance` query) làm serving index, CDC từ Postgres sang.
4. **"ETA (thời gian đến) thay vì khoảng cách đường chim bay?"** → Haversine để **lọc thô**, ETA thật cần routing trên road graph (OSRM/Google API) — chỉ tính cho top ~10 candidates cuối, vì routing đắt hơn nhiều bậc.
5. **"Driver matching: 2 rider cùng lúc match 1 driver thì sao?"** → Match là bài **reservation**: chọn candidate xong phải claim driver bằng atomic op (Redis `SET driver:lock:{id} riderId NX PX 10000`) — thua thì lấy candidate kế. Geo chỉ là bước đề cử, concurrency control mới chốt.
6. **"Nếu phải hỗ trợ polygon (tìm trong quận 1, không phải bán kính)?"** → PostGIS `ST_Contains(polygon, location)` với GiST index làm chuẩn; với hệ cell thì precompute "cell nào thuộc polygon nào" (cover polygon bằng tập cells — S2 covering) rồi quy về bài tra cell.

---

## 📋 Bảng chọn công nghệ nhanh

| Yêu cầu | Công nghệ phù hợp | Lý do 1 dòng |
|---|---|---|
| Sổ cái tiền bạc, không được sai | PostgreSQL (ACID) + double-entry ledger append-only | Correctness và audit quan trọng hơn scale; 600 TPS chưa là gì với Postgres |
| Chống double-charge khi retry | Idempotency key + unique constraint (Postgres/Redis) | Unique violation là cái lock rẻ và đáng tin nhất |
| Publish event không được mất sau khi DB commit | Outbox pattern + Kafka | Event nằm cùng transaction với data, relay đảm bảo đẩy đi bằng được |
| Luồng nghiệp vụ nhiều bước qua nhiều service | Saga (orchestration) + compensating actions | Không có distributed transaction; mỗi bước có hành động bù |
| Webhook từ bên thứ 3 | Verify HMAC trên raw body + dedupe theo event id + ack nhanh, xử lý async | Webhook là at-least-once, trùng và sai thứ tự là mặc định |
| Lưu file lớn, durable, rẻ | Object storage (S3) + presigned URL | Durability 11 nines, client upload thẳng không tốn băng thông server |
| Dedup file/chunk | Content-addressed storage (key = SHA-256) | Hai nội dung giống nhau tự rơi vào cùng key, dedup không cần lookup phức tạp |
| Sync ít băng thông | Chunking 4MB + delta sync (so chunk hash) | Sửa 1 chunk chỉ upload 1 chunk, version mới tham chiếu chunk cũ |
| Conflict 2 thiết bị cùng sửa file | Optimistic concurrency (base_version) + conflicted copy | Không bao giờ mất dữ liệu thầm lặng; LWW theo timestamp là sai |
| Notify thay đổi tới hàng triệu client | Long polling + notify-then-pull (cursor) | Friendly với firewall, kênh push chỉ cần là "ping", state thật luôn pull |
| Delayed job / hẹn giờ | Redis sorted set (ZADD ts) + mover Lua script — hoặc BullMQ | O(log N) insert, lấy job đến hạn theo score, atomic bằng Lua |
| Work queue trên Postgres, nhiều consumer | `SELECT ... FOR UPDATE SKIP LOCKED` | Nhiều worker poll song song không claim trùng row, khỏi cần broker riêng |
| Tránh duplicate execution của scheduled job | `UNIQUE (job_id, scheduled_for)` + lease & heartbeat | Constraint là chốt chặn cuối kể cả khi election split-brain |
| Retry an toàn | Exponential backoff + jitter + DLQ, phân loại retryable/non-retryable | Backoff không jitter = tự tạo thundering herd; lỗi 4xx retry là vô ích |
| Realtime ranking / top-N | Redis sorted set (ZADD/ZREVRANGE/ZREVRANK) | Update và rank đều O(log N), không cấu trúc nào tiện hơn |
| Rank chính xác ở scale 500M+ | Shard zset theo bucket điểm + bảng đếm; tail dùng histogram xấp xỉ | Top-N chỉ đụng shard đỉnh; rank = tổng count shard trên + ZCOUNT 1 shard |
| Leaderboard logic phức tạp (hoàn đơn, fraud) | Batch chính xác (giờ) + realtime delta (Redis), lambda-style | Số nhảy realtime, số chuẩn tự điều chỉnh mỗi chu kỳ batch |
| Geo query "gần đây" đơn giản | Redis GEO (GEOADD/GEOSEARCH) | Hai lệnh là xong, bản chất là geohash nhét vào sorted set |
| Geo query + filter + transaction | PostGIS (GiST index, ST_DWithin, KNN `<->`) | Geo + thuộc tính + sort trong 1 SQL, sống chung với data chính |
| Cache kết quả search theo vị trí | Cache theo geohash cell, không theo toạ độ user | Toạ độ liên tục → hit ~0%; cell rời rạc → nghìn user chung key |
| Vị trí di động tần suất cao (driver) | In-memory cell map / Redis GEO per-cell + TTL, Kafka cho cold path | Chỉ cần vị trí mới nhất, không cần durability trên hot path |
| Search full-text + geo + facet | Elasticsearch (CDC từ DB qua Kafka) | Serving index chuyên reads phức tạp, DB vẫn là source of truth |
| Giữ triệu connection idle (notify, driver location) | Node.js + WebSocket/long-poll (uWebSockets.js) | Event loop giữ ~100k idle connection/instance, không thread-per-connection |

---

> **Mẹo chốt buổi phỏng vấn:** mỗi bài ở trên đều có 1 câu "thần chú" đáng nói ra trong 5 phút đầu — Payment: *"correctness trước scale, at-least-once + idempotency = effectively exactly-once"*; Dropbox: *"tách control plane (metadata) khỏi data plane (chunks)"*; Scheduler: *"scheduler quyết định khi nào, worker quyết định thế nào — và unique constraint là chốt chặn duplicate cuối cùng"*; Leaderboard: *"top-N là bài dễ, rank chính xác của 1 user mới là bài khó — chính xác ở đầu bảng, xấp xỉ ở đuôi"*; Proximity: *"bản chất spatial index là ép 2D về 1D mà giữ tính lân cận — và places (read-heavy) khác hẳn drivers (write-heavy)"*. Nói được câu định hướng sớm, interviewer sẽ tin bạn kiểm soát được bài toán.
