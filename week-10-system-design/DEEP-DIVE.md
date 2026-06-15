# 🔬 Đào sâu — Tuần 10: System Design

> README đã cho bạn khung 5 bước và "biết cái gì"; file này dạy "tính ra con số thế nào, vì sao thuật toán chạy được, và bẫy nào khiến bạn rớt dù thuộc lý thuyết".

---

## 🧠 Cơ chế bên trong / nguyên lý sâu

### 1. Back-of-the-envelope chuẩn — bảng số phải thuộc lòng

Phỏng vấn không cần bạn tính chính xác, cần bạn ra **đúng order-of-magnitude trong 30 giây**. Muốn vậy phải làm tròn thông minh.

**Mốc latency (Jeff Dean numbers — phiên bản rút gọn, nhớ tỷ lệ chứ không nhớ số lẻ):**

| Thao tác | Latency | Nhớ theo bội số |
|---|---|---|
| L1 cache reference | ~0.5 ns | mốc 1 |
| Branch mispredict | ~5 ns | x10 |
| L2 cache reference | ~7 ns | x14 |
| Mutex lock/unlock | ~25 ns | |
| Đọc 1MB tuần tự từ RAM | ~250 µs | |
| Round trip trong cùng datacenter | ~500 µs | **0.5 ms** |
| Đọc 1MB tuần tự từ SSD | ~1 ms | |
| Disk seek (HDD) | ~10 ms | **chậm gấp 20 lần SSD seek** |
| Đọc 1MB từ disk (HDD) | ~20 ms | |
| Round trip CA ↔ Netherlands | ~150 ms | gói tin xuyên Đại Tây Dương |

**3 hệ quả phải nói được trong phỏng vấn:**
- RAM nhanh hơn SSD ~4x, SSD nhanh hơn HDD seek ~10x → đó là LÝ DO tồn tại của cache layer và vì sao "đọc từ disk ngẫu nhiên" là kẻ thù.
- 1 round trip trong DC ~0.5ms → nếu request của bạn gọi 20 service tuần tự = 10ms chỉ riêng network → **fan-out song song, không tuần tự**.
- Cross-region ~150ms → đó là lý do CDN + edge + multi-region read replica tồn tại.

**Hằng số thời gian (thuộc lòng để chia nhẩm):**
```
1 ngày      = 86,400 s     ≈ 10^5  (làm tròn 100K — sai số 16%, chấp nhận được)
1 tháng     ≈ 2.5 × 10^6 s
1 năm       ≈ 3.15 × 10^7 s ≈ 30M s
1M req/ngày ≈ 12 RPS         (1,000,000 / 86,400)
```

**Quy tắc đơn vị dữ liệu:**
```
1 char ASCII = 1 byte | UUID = 16 byte | timestamp/int64 = 8 byte
KB→MB→GB→TB→PB = mỗi bậc × 10^3 (làm tròn 1024 thành 1000 để nhân nhẩm)
```

**Quy trình estimation 4 dòng (áp dụng cho MỌI bài):**
```
1. QPS    = DAU × actions_per_user / 86,400  ; peak = 2-3× average
2. Storage= records/ngày × bytes/record × retention(ngày) × replication_factor
3. Bandwidth = QPS × payload_size (in & out tách riêng nếu lệch)
4. Memory cache = working_set (thường 20% data nóng theo 80/20) — đủ nhét RAM không?
```

Ví dụ tính nhẩm Twitter-like (100M DAU, mỗi user đọc feed 20 lần/ngày, mỗi feed 5KB):
```
Read QPS = 100M × 20 / 86,400 ≈ 2 × 10^9 / 10^5 = 20,000 RPS → peak ~50,000 RPS
Bandwidth out = 50,000 × 5KB = 250 MB/s ≈ 2 Gbps → cần CDN/cache, 1 NIC 10Gbps gánh được nhưng cache giảm DB.
```

### 2. Consistency models — phân tầng từ mạnh đến yếu (sâu hơn README)

README liệt kê tên; đây là **thứ tự "mạnh dần" và cái gì kéo theo cái gì**:

```
Linearizable (strong)  ──┐  mạnh nhất: mọi client thấy 1 thứ tự duy nhất, real-time
   │                      │  như thể chỉ có 1 bản copy. Đắt: cần consensus (Raft/Paxos).
Sequential consistency   │
   │                     ▼
Causal consistency  ───── "nếu A xảy ra TRƯỚC B (cause→effect), mọi người thấy A trước B"
   │                      nhưng thao tác không liên quan có thể thấy thứ tự khác nhau.
Read-your-writes ──────── chỉ chính bạn thấy write của mình (session-level)
   │
Eventual ──────────────── yếu nhất: ngừng ghi đủ lâu → các replica hội tụ. Không hứa gì về "khi nào".
```

- **Causal** là "điểm ngọt" thực tế: comment phải hiện sau post mà nó reply (quan hệ nhân quả), nhưng 2 post độc lập của 2 người lạ thì thứ tự không quan trọng. Implement bằng **vector clock / version vector**.
- **Read-your-writes** giải đúng bài replication lag README nêu, nhưng nhớ phân biệt với **Monotonic reads** (không thấy data "lùi"): một user load lại trang không được thấy comment biến mất rồi hiện lại do nhảy giữa 2 replica.

### 3. Quorum (R + W > N) — vì sao công thức đó đúng

N replica. Ghi thành công coi như xong khi **W** node ack; đọc query **R** node lấy bản version cao nhất.

```
N = 3, W = 2, R = 2 → W + R = 4 > 3 = N  ✓
```

**Vì sao W + R > N đảm bảo strong-ish consistency?** Theo **pigeonhole**: tập W node đã ghi và tập R node được đọc, nếu W + R > N thì 2 tập BẮT BUỘC giao nhau ít nhất 1 node → đọc luôn chạm ≥ 1 node có bản mới nhất.

```
   nodes:  [1] [2] [3]
   write→  [1] [2]        (W=2)
   read →      [2] [3]    (R=2)  → node 2 nằm trong cả hai → đọc thấy write
```

**Tuning quorum (Cassandra/Dynamo nói được điều này là điểm cộng):**
- `W=1, R=N`: write nhanh, read chậm/đắt — workload write-heavy.
- `W=N, R=1`: read nhanh, write chậm — read-heavy nhưng write hiếm.
- `W=R=quorum (⌊N/2⌋+1)`: cân bằng, mặc định.
- `W+R ≤ N`: chấp nhận eventual để được latency/availability cao hơn (vd `W=1,R=1`).

Lưu ý: quorum classic vẫn có thể đọc stale do **read-repair chưa chạy** + write không atomic giữa các node — nên thực tế nó là "strong-ish", muốn linearizable thật cần Paxos/Raft.

### 4. Consistent hashing — sâu vào virtual node

**Hashing thường (`hash(key) % N`) sai ở đâu?** Thêm/bớt 1 node → N đổi → **gần như TẤT CẢ key remap** → cache miss đồng loạt (cache cluster sập thành thundering herd vào DB).

**Consistent hashing:** hash cả node lẫn key lên cùng 1 vòng `[0, 2^32)`. Key thuộc về node đầu tiên gặp khi đi **theo chiều kim đồng hồ**.

```
        0/2^32
          │
   N_A ●──┼──● N_B
       │     │
  k1→  │     │  ←k2  (mỗi key đi cw tới node gần nhất)
       │     │
   N_C ●─────● N_D
```

Thêm node N_E → chỉ các key nằm giữa N_E và node trước nó (cw) bị remap → **chỉ ~K/N key di chuyển**, phần còn lại đứng yên.

**Vấn đề 1 — phân bố lệch:** với ít node, các điểm rơi không đều → 1 node ôm cung lớn hơn (hot). **Giải pháp: virtual node** — mỗi node vật lý băm thành V điểm ảo (vd 100-200) rải khắp vòng → trung bình hóa, phương sai tải giảm theo `1/√V`.

```
Physical N_A → vnode A#1, A#2, ... A#150 rải đều
→ khi N_A chết, 150 cung nhỏ của nó được CHIA cho nhiều node khác nhau,
  không dồn hết tải sang đúng 1 node kế bên.
```

**Vấn đề 2 — heterogeneous node:** máy mạnh gấp đôi → cấp gấp đôi vnode → nhận gấp đôi tải. Đây là cách weighted consistent hashing hoạt động.

### 5. CAP đào sâu → PACELC (cái README chỉ chạm)

CAP chỉ nói về lúc **partition**. Nhưng partition là sự kiện hiếm; 99.9% thời gian mạng OK — và **lúc bình thường vẫn có trade-off** mà CAP bỏ qua: muốn đọc strong consistent vẫn phải đợi nhiều node ack → **tăng latency**.

```
PACELC:
  IF Partition  → chọn  A (availability)  hay  C (consistency)
  ELSE (normal) → chọn  L (latency)       hay  C (consistency)
```

| Hệ | Phân loại | Giải thích |
|---|---|---|
| DynamoDB, Cassandra | **PA/EL** | partition→còn phục vụ; bình thường→ưu latency (eventual) |
| MongoDB (default) | **PC/EC** | partition→ưu consistency; bình thường→cũng ưu consistency |
| PostgreSQL single | (CA-ish) | không phân tán nên không partition nội bộ |
| Spanner/CockroachDB | **PC/EC** | dùng TrueTime/Raft, hy sinh chút latency để có strong toàn cầu |

**Câu chốt khi phỏng vấn:** "CAP bắt tôi chọn lúc partition, nhưng PACELC nhắc rằng kể cả lúc khỏe mạnh tôi vẫn trả giá latency cho consistency — nên tôi chọn theo từng loại data trong cùng hệ thống."

### 6. Idempotency & exactly-once ở mức hệ thống

README dạy idempotency key cho API. Đào sâu: **exactly-once là ảo tưởng ở mức network**.

- Bạn không thể có exactly-once *delivery* (mạng có thể nuốt ack → sender không biết nên gửi lại). Cái bạn đạt được là **at-least-once delivery + idempotent processing = exactly-once effect**.
- 3 cơ chế khử trùng (dedup) theo độ mạnh:
  1. **Natural idempotency**: thao tác bản chất không cộng dồn — `SET status='PAID'` (gọi 100 lần như 1), `UPSERT`. Tốt nhất, không cần lưu state.
  2. **Dedup table**: lưu `processed_id` (unique constraint) → insert lần 2 fail → skip. Cần TTL/cleanup.
  3. **Sequence/version (conditional write)**: `UPDATE ... WHERE version = $expected` (optimistic lock) — vừa idempotent vừa chống lost-update.
- **Exactly-once trong Kafka** thật sự = idempotent producer (`enable.idempotence`, mỗi producer có PID + sequence number, broker khử duplicate) + **transaction** (read-process-write atomic trong phạm vi Kafka). Ra ngoài Kafka (gọi API, ghi DB khác) → exactly-once vỡ → quay lại idempotent consumer.

### 7. CDC & Event Sourcing — phân biệt rõ

| | CDC (Change Data Capture) | Event Sourcing |
|---|---|---|
| Nguồn sự thật | **Bảng state** trong DB; event là *phái sinh* | **Log event** là sự thật gốc; state là *phái sinh* (replay) |
| Cách lấy event | Đọc WAL/binlog (Debezium đọc Postgres WAL / MySQL binlog) | App ghi event vào event store (không UPDATE in-place) |
| Dùng để | Đồng bộ DB → Kafka/search/cache không double-write | Audit tuyệt đối, time-travel, rebuild read model (CQRS) |
| Rủi ro | schema coupling với binlog | replay chậm khi log dài → cần **snapshot** định kỳ |

- **CDC giải bài "dual write"**: nếu app ghi DB rồi ghi Kafka riêng → 1 trong 2 fail = inconsistent. CDC + **Outbox pattern** (README mục 16d) khử việc này: ghi outbox trong cùng transaction với business data, Debezium relay → đúng-một-nguồn.
- **Event sourcing + CQRS**: write side append event; read side build **materialized view** tối ưu cho query (eventual consistency giữa write→read model). Đắt và phức tạp — chỉ dùng khi audit/temporal là core (banking ledger, đặt vé).

### 8. Rate limiting algorithms — so sánh ở mức cơ chế

| Thuật toán | State lưu | Burst | Độ chính xác | Memory | Khi dùng |
|---|---|---|---|---|---|
| Fixed window | 1 counter | **gấp 2× ở ranh giới** | thấp | O(1) | nội bộ, đơn giản, chấp nhận sai |
| Sliding log | timestamp mỗi req | không | tuyệt đối | O(req) — đắt | cần chính xác, traffic thấp |
| Sliding counter | 2 counter (cur+prev) | giảm còn ~nhỏ | tốt | O(1) | **default production** |
| Token bucket | tokens + last_refill | **cho phép burst tới B** | tốt | O(1) | API có burst hợp lệ (Stripe/AWS) |
| Leaky bucket | queue + rate | **không** (làm phẳng) | tốt | O(queue) | cần output rate ổn định tuyệt đối |

**Token vs Leaky — khác biệt cốt lõi:**
```
Token bucket: token tích lũy khi rảnh → cho phép DỒN burst (tiêu cả bucket 1 lúc).
              "Tôi tiết kiệm quota lúc rảnh để xài lúc cao điểm."
Leaky bucket: nước rỉ ra với tốc độ CỐ ĐỊNH bất kể input → output luôn mượt, KHÔNG burst.
              "Dù bạn đổ ào, tôi vẫn nhỏ giọt đều."
```

**Sliding window counter — công thức nội suy (hay bị hỏi):**
```
estimated = count_current_window
          + count_previous_window × (1 − elapsed_in_current / window_size)

Ví dụ window=60s, prev=80, cur=20, đã trôi 15s vào cửa sổ hiện tại:
overlap = (60−15)/60 = 0.75
estimated = 20 + 80×0.75 = 80 → so với limit 100 → cho qua.
```

**Token bucket atomic trên Redis (vì sao cần Lua):** đọc tokens → tính refill → trừ → ghi là 4 thao tác; 2 instance chạy xen kẽ = race → vượt limit. Lua script chạy **single-threaded atomic** trong Redis → giải race mà không cần distributed lock.

---

## 🧪 Phân tích thiết kế mẫu

### Bài A — URL Shortener (đào sâu hơn lời giải tóm tắt ở README)

README đã cho lời giải khung. Ở đây ta đi **từng bước có số và có sơ đồ**, tập trung phần README chỉ chạm: sinh ID không trùng và redirect path.

**1. Requirement (functional / non-functional):**
- F: tạo short URL, redirect, (tùy) custom alias, expiration, analytics click.
- NF: redirect p99 < 100ms; availability redirect 99.99% (URL chết = mất tin tưởng); read:write = 100:1; URL không cần đoán tuần tự.

**2. Estimation:**
```
100M URL mới/tháng → write = 100M / 2.5M s ≈ 40 writes/s
read = 40 × 100 = 4,000 reads/s ; peak ~10,000 reads/s
Storage 5 năm: 100M × 12 × 5 = 6×10^9 record × 500 byte = 3 TB
Cache (80/20, 20% nóng): 0.2 × 3TB ≈ 600GB? → thực ra cache theo SỐ key nóng/ngày:
   reads/ngày = 4000×86400 ≈ 350M, unique hot ~vài chục triệu key × ~1KB ≈ vài chục GB → vừa RAM Redis cluster.
```

**3. API:**
```
POST /api/v1/urls   { longUrl, customAlias?, ttl? }  → 201 { shortCode, shortUrl }
GET  /{shortCode}                                     → 302 Location: longUrl
GET  /api/v1/urls/{shortCode}/stats                   → 200 { clicks, ... }
```

**4. Data model (key-value là đủ):**
```
shortCode (PK, string 7) | longUrl (text) | userId | createdAt | expireAt | clicks
```

**5. Sinh short code — 3 chiến lược (đào sâu phần README chỉ nhắc "base62"):**

| Cách | Cơ chế | Ưu | Nhược |
|---|---|---|---|
| Hash(longUrl) rồi cắt 7 ký tự | MD5/base62 → lấy 7 đầu | stateless, cùng URL→cùng code (dedup free) | **collision** → cần check+rehash; không cho 2 user shorten chung 1 URL ra code riêng |
| Counter + base62 | counter toàn cục tăng dần → encode base62 | không collision, ngắn | counter là **SPOF/bottleneck**; code đoán được (tuần tự) |
| **Counter range (ZooKeeper) hoặc Snowflake** | mỗi app server lấy 1 dải 1M id; hoặc 64-bit (timestamp+machine+seq) | scale ngang, không trùng, không cần khóa mỗi request | cần coordinator cấp range |

→ Chọn **counter range + base62** + (tùy) trộn bit để chống đoán tuần tự. `62^7 ≈ 3.5×10^12` đủ cho hàng nghìn năm.

**6. Sơ đồ + redirect path (phần quyết định p99):**
```
        ┌─────────┐
Client─▶│   CDN   │ (cache 302? — KHÔNG nếu cần analytics chính xác)
        └────┬────┘
             ▼
        ┌─────────┐   miss   ┌──────────┐   miss   ┌──────────┐
        │  Redis  │─────────▶│ API srv  │─────────▶│ KV store │
        │ (L2)    │◀─────────│ (stateless)        │(Dynamo/  │
        └─────────┘  set TTL └────┬─────┘  warm    │ Cassandra)
                                  │ async click event
                                  ▼
                             ┌─────────┐    ┌──────────┐
                             │  Kafka  │───▶│ analytics│ (KHÔNG ghi sync trong redirect path)
                             └─────────┘    └──────────┘
```

**7. Bottleneck & trade-off:**
- **301 vs 302**: 301 (permanent) → browser cache → giảm tải cực mạnh NHƯNG **mất analytics** (lần sau browser không gọi server). 302 → đếm được click nhưng mọi click đập server. Cần analytics → **302**.
- **Hot URL**: 1 link viral = hot key → giải bằng L1 in-process cache + CDN edge.
- **Custom alias race**: 2 user xin cùng alias đồng thời → unique constraint ở DB (không chỉ check-then-insert ở app → TOCTOU).
- **Expiration**: lazy delete (check `expireAt` lúc redirect, trả 404 nếu hết hạn) + batch cleanup job, không cần TTL realtime.

### Bài B — Distributed Rate Limiter (đào sâu phần multi-instance + fail mode)

**Vị trí & lý do:** đặt ở **API Gateway** (chặn sớm nhất, trước khi tốn tài nguyên backend). Latency thêm phải < 5ms → state ở Redis (RTT ~0.5ms trong DC), 1 lần gọi Lua.

```
                       ┌──────────── Redis (token bucket state, Lua atomic) ───┐
                       │                                                        │
Client ─▶ Gateway[1] ──┤                                                        │
Client ─▶ Gateway[2] ──┤  mọi gateway cùng đọc/ghi 1 bucket key cho 1 user      │
Client ─▶ Gateway[3] ──┘                                                        │
                       └────────────────────────────────────────────────────────┘
   allow → forward backend ; deny → 429 + Retry-After (không chạm backend)
```

**Vì sao Lua giải race giữa N gateway:** không có Lua, 3 gateway cùng `GET tokens=1` → cả 3 thấy 1 → cả 3 cho qua → vượt limit 3x. Lua chạy nguyên khối single-thread trong Redis → đọc-tính-trừ-ghi là 1 thao tác không thể xen.

**Pseudo-Lua token bucket:**
```
tokens, last = HGET bucket
elapsed      = now - last
tokens       = min(capacity, tokens + elapsed × refill_rate)
if tokens >= 1 then tokens -= 1; HSET bucket; return ALLOW
else return DENY
```

**Trade-off PHẢI nêu (đây là chỗ ăn điểm deep dive):**
- **Redis chết → fail-open hay fail-closed?** fail-open (cho qua) ưu UX, dùng cho API thường; fail-closed (chặn) ưu an toàn, dùng cho payment/login. Phải hỏi interviewer business chấp nhận cái nào.
- **Redis là SPOF mới**: giải bằng Redis Cluster/Sentinel + local fallback counter (degraded mode).
- **Multi-region**: 1 Redis toàn cầu = latency cross-region phá vỡ < 5ms → mỗi region 1 Redis, chấp nhận limit "xấp xỉ N×regions" hoặc dùng giới hạn theo region.
- **Hot user (1 key bị mọi gateway đập)**: shard bucket (`user:{id}:{shard}`) hoặc local token bucket cấp phát từ Redis theo batch.

---

## 🐛 Bẫy & sai lầm khi phỏng vấn system design

1. **Nhảy vào chi tiết khi chưa rõ scope.** Bạn bắt đầu vẽ Kafka, sharding khi chưa biết hệ thống có 1K hay 1B user. → *Tránh*: 5-7 phút đầu CHỈ hỏi requirement, viết functional + non-functional ra góc bảng, xác nhận in/out-of-scope với interviewer trước khi vẽ nét nào.

2. **Quên estimation (hoặc tính cho có).** Không có con số thì mọi quyết định "cần cache/sharding" đều là cảm tính → interviewer không thể đánh giá reasoning. → *Tránh*: luôn ra QPS + storage + bandwidth; nói to cách làm tròn. Estimation chính là cái *justify* mọi component sau đó.

3. **Over-engineer.** Thêm Kafka + microservices + sharding + multi-region cho hệ thống 1000 user. → *Tránh*: "với scale hiện tại, một monolith + Postgres + Redis là đủ; tôi sẽ thêm X **khi** đạt ngưỡng Y". Thể hiện bạn biết *khi nào* chứ không chỉ *cái gì*. Đơn giản đúng scale > phức tạp khoe kiến thức.

4. **Bỏ qua Single Point of Failure.** Vẽ 1 load balancer, 1 primary DB, 1 Redis rồi quên. → *Tránh*: sau khi vẽ xong, **rà từng box hỏi "nếu nó chết thì sao?"** — LB cần cặp active-passive, DB cần replica + failover, queue cần replication. Chủ động chỉ ra SPOF và cách HA hóa.

5. **Không nói trade-off.** Chọn NoSQL mà không nói mất gì, chọn eventual mà không nói tại sao chấp nhận. → *Tránh*: mỗi quyết định lớn nói công thức "Tôi chọn A **thay vì** B vì [yêu cầu], **đánh đổi** là [mất gì], **chấp nhận được vì** [lý do business]". Không có giải pháp đúng tuyệt đối, chỉ có trade-off hợp ngữ cảnh.

6. **Quên non-functional (latency/availability/consistency target).** Thiết kế xong không biết đạt p99 bao nhiêu, 99.9% hay 99.99%. → *Tránh*: gắn số NF ngay từ bước 1 và kiểm lại ở wrap-up: "design này đạt ~p99 80ms cho redirect, availability 99.99% nhờ multi-AZ — khớp yêu cầu". Availability 99.9% = 8.7h downtime/năm, 99.99% = 52 phút — con số này nên thuộc.

7. **(Bonus) Im lặng khi suy nghĩ.** Interviewer chấm *quá trình tư duy*, không phải đáp án cuối. → *Tránh*: nói to mọi giả định, kể cả khi đang phân vân giữa 2 lựa chọn.

---

## ⚖️ Đánh đổi & quyết định thiết kế

### SQL vs NoSQL ở quy mô
- **SQL** mạnh khi: cần ACID transaction đa bảng, quan hệ phức tạp (JOIN), schema ổn định, query ad-hoc đa dạng. Scale write khó (phải sharding thủ công, mất cross-shard JOIN/transaction).
- **NoSQL** (document/wide-column/KV): scale ngang sẵn (sharding tự động), schema linh hoạt, throughput cực cao — đổi lại model **query theo access pattern đã biết trước** (DynamoDB single-table thiết kế quanh query, không JOIN ad-hoc), thường eventual consistency.
- **Quyết định**: "data có quan hệ + cần transaction → SQL (Postgres); access pattern đơn giản + scale khổng lồ + key-based → NoSQL (Dynamo/Cassandra). Đa số hệ thực tế **trộn**: Postgres cho order/payment (strong), Cassandra cho feed/timeline, Redis cho cache, Elasticsearch cho search."

### Sync vs Async (message queue)
- **Sync** (gọi trực tiếp, chờ response): đơn giản, dễ trace, consistency tức thì — nhưng coupling chặt, latency cộng dồn, partial failure lan (cần circuit breaker).
- **Async** (qua queue): decouple, buffer spike (load leveling), retry/DLQ, fan-out — đổi lại eventual consistency, khó trace, phải xử lý duplicate (idempotent) + ordering.
- **Quyết định**: thao tác user cần kết quả ngay (login, đọc) → sync; thao tác có thể trễ + cần chịu spike + nhiều consumer (gửi email, index search, analytics, notification) → async. "Trả response cho user ngay, đẩy phần nặng/chậm vào queue xử lý sau."

### Strong vs Eventual consistency
- **Strong**: dễ lập trình (đọc luôn thấy mới nhất), nhưng đắt latency + giảm availability lúc partition.
- **Eventual**: availability + latency cao, scale tốt — nhưng app phải xử lý stale/conflict (last-write-wins mất data, hoặc CRDT/merge).
- **Quyết định theo data**: tiền/tồn kho/quyền → strong; like count/view/feed/recommendation → eventual. Một hệ thống trộn cả hai là dấu hiệu senior.

### Monolith vs Microservices
- README đã so sánh bảng; **điểm đào sâu**: chi phí ẩn của microservices là **distributed system tax** — mọi function call thành network call (latency + partial failure + cần retry/timeout/breaker), data ownership phá vỡ transaction (cần saga), debugging cần distributed tracing. → "Modular monolith trước, tách theo domain boundary khi có pain thật" (Strangler Fig). Đừng trả distributed tax khi chưa cần.

### Cache invalidation strategies (cái khó nhất trong CS)
| Chiến lược | Cách | Trade-off |
|---|---|---|
| **TTL** | hết hạn tự xóa | đơn giản; cửa sổ stale = TTL; chọn TTL cân giữa freshness và hit rate |
| **Write-through invalidate (delete on write)** | update DB → **xóa** cache key (không update) | fresh hơn; xóa thay vì update → tránh ghi đè data cũ do race |
| **Write-through update** | update DB + ghi cache mới | cache luôn ấm nhưng race 2 write có thể ghi nhầm thứ tự |
| **Event-based (CDC)** | DB change → event → invalidate cache | chính xác, decoupled; thêm hạ tầng CDC |
| **Versioned key** | key chứa version (`user:42:v3`) | không cần xóa, chỉ đổi version; tốn memory key cũ tới khi TTL |

→ Mặc định production: **cache-aside + delete-on-write + TTL jitter**. Lý do delete thay vì update: nếu 2 request update xen kẽ (DB ghi v2 trước nhưng cache ghi v1 sau do timing) → cache giữ data cũ vĩnh viễn; delete buộc lần đọc sau rebuild từ DB → đúng.

---

## 🎯 Câu hỏi/chủ đề phỏng vấn NÂNG CAO

**Q1: Giải thích CAP bằng ví dụ thực — và vì sao "CA" không tồn tại trong hệ phân tán?**
> Hai data center A và B replicate cho nhau; cáp giữa chúng đứt (partition). Một user ghi vào A. Giờ B có 2 lựa chọn: (C) từ chối đọc/ghi vì không chắc dữ liệu mới nhất → mất availability; hoặc (A) vẫn phục vụ bằng data cũ → mất consistency. Không thể vừa trả lời vừa đảm bảo đúng. "CA" giả định *không bao giờ partition* — phi thực tế vì mạng luôn có thể đứt, nên câu hỏi thật luôn là "khi partition, hy sinh C hay A". PACELC bổ sung: cả lúc mạng khỏe, strong consistency vẫn tốn latency (phải đợi nhiều node ack).

**Q2: Consistent hashing giải quyết vấn đề gì, và virtual node thêm vào để làm gì?**
> Giải bài "remap toàn bộ khi thêm/bớt node" của `hash % N` — với CH chỉ ~K/N key di chuyển khi cluster đổi kích thước, nên cache cluster không bị miss đồng loạt. Virtual node giải 2 vấn đề phụ: (1) phân bố tải đều hơn khi ít node (mỗi node = nhiều điểm ảo rải khắp vòng, phương sai tải giảm); (2) khi 1 node chết, tải của nó được chia cho NHIỀU node thay vì dồn hết sang node kế bên; (3) hỗ trợ máy mạnh-yếu khác nhau bằng cách cấp số vnode khác nhau.

**Q3: Làm sao đảm bảo idempotency cho payment khi mọi tầng đều có thể retry?**
> Client sinh `Idempotency-Key` (UUID) gửi kèm. Server, trước khi charge, làm `SET key 'processing' NX` (hoặc unique constraint trong DB) — nếu key đã tồn tại với response đã lưu thì trả lại response cũ (replay), không charge lại; nếu đang 'processing' thì request thứ 2 chờ hoặc trả 409. Sau khi charge xong lưu `(key, response)` TTL 24h. Quan trọng: việc charge ở provider cũng phải truyền idempotency key xuống (Stripe hỗ trợ) để ngay cả khi server của tôi retry provider cũng không charge 2 lần. Nền tảng: at-least-once là không tránh được → tôi biến *xử lý* thành idempotent thay vì cố đạt exactly-once *delivery*.

**Q4: Thiết kế rate limiter cho 1 triệu user trên nhiều instance như thế nào?**
> State tập trung ở Redis (1 bucket key/user), thuật toán token bucket, mỗi check là 1 Lua script chạy atomic để N gateway không race. 1M user × vài trăm byte state = vài trăm MB → vừa 1 Redis, nếu lớn hơn thì Redis Cluster shard theo userId. Latency thêm ~0.5ms RTT. Phải quyết fail-open (UX) hay fail-closed (an toàn) khi Redis chết, và xử lý hot user bằng sharding key hoặc local token batch. Multi-region thì mỗi region 1 Redis, chấp nhận limit xấp xỉ.

**Q5: Outbox pattern giải quyết vấn đề gì mà "ghi DB rồi ghi Kafka" không giải được?**
> Bài "dual write": ghi DB thành công nhưng ghi Kafka fail (hoặc ngược lại) → 2 hệ inconsistent, không có transaction phủ cả hai. Outbox: ghi business data + 1 dòng vào bảng `outbox` trong **cùng 1 DB transaction** (atomic) → hoặc cả hai cùng có hoặc cùng không. Một relay process (hoặc Debezium qua CDC đọc WAL) đọc bảng outbox đẩy lên Kafka và đánh dấu đã gửi. Đảm bảo "không bao giờ commit DB mà mất event". Đổi lại: event là at-least-once (relay có thể gửi lại) → consumer phải idempotent.

**Q6: Khác nhau cốt lõi giữa CDC và Event Sourcing?**
> CDC: nguồn sự thật vẫn là bảng *state* trong DB, event chỉ là phái sinh đọc từ binlog/WAL để đồng bộ ra hệ khác (search, cache, Kafka) — dùng để khử dual-write, app gần như không đổi. Event Sourcing: nguồn sự thật là *log event* (append-only, không UPDATE in-place), state hiện tại được tính bằng replay event — dùng khi cần audit tuyệt đối và time-travel, nhưng phức tạp (cần snapshot, CQRS read model). Một bên event phái sinh từ state, một bên state phái sinh từ event.

**Q7: Token bucket vs Leaky bucket — khi nào chọn cái nào?**
> Token bucket cho phép *burst có kiểm soát*: token tích lũy lúc rảnh, client dồn xài lúc cao điểm tới mức B — hợp API người dùng thật (Stripe/AWS) nơi spike ngắn là hợp lệ. Leaky bucket xử lý với tốc độ cố định, output luôn mượt và KHÔNG cho burst — hợp khi downstream cần input rate ổn định tuyệt đối (vd bảo vệ 1 hệ legacy chỉ chịu được X req/s đều đặn). Tóm: cần co giãn → token; cần làm phẳng tuyệt đối → leaky.

**Q8: Quorum R+W>N đảm bảo gì và không đảm bảo gì?**
> Đảm bảo: tập node được đọc (R) và tập node đã ghi (W) chắc chắn giao nhau ≥ 1 node (pigeonhole) → đọc luôn chạm ít nhất 1 bản mới nhất, nên không bao giờ đọc trượt write đã ack. KHÔNG đảm bảo linearizability thật sự nếu write không atomic giữa các node hoặc read-repair chưa chạy — vẫn có thể thấy bản cũ trong cửa sổ ngắn. Muốn strong tuyệt đối cần consensus (Raft/Paxos). Quorum cho ta "strong-ish" với khả năng tune (W,R) theo read-heavy hay write-heavy.

---

## 📚 Đọc thêm

- **Designing Data-Intensive Applications (Martin Kleppmann)** — "DDIA", kinh thánh: Ch.5 Replication (quorum, leader/leaderless), Ch.6 Partitioning (consistent hashing, rebalancing), Ch.7 Transactions (isolation levels), Ch.9 Consistency & Consensus (linearizability, Raft/Paxos), Ch.11 Stream Processing (CDC, event sourcing, exactly-once).
- **System Design Interview Vol.1 & 2 (Alex Xu)** — Vol.1: framework + URL shortener, rate limiter, consistent hashing, key-value store, unique ID (Snowflake), notification, news feed, chat, search autocomplete, YouTube, Google Drive. Vol.2: proximity service, nearby friends, Google Maps, metrics monitoring, ad click aggregation, hotel reservation, distributed email, S3, real-time gaming leaderboard.
- **The Architecture of Open Source Applications / aosabook.org** — case study thực tế.
- **Engineering blogs**: Netflix Tech Blog (chaos, microservices, Hystrix), Uber Engineering (geo, Schemaless, Ringpop = consistent hashing), Stripe (idempotency, rate limiting), Discord (scale từ MongoDB→Cassandra→ScyllaDB), Cloudflare (rate limiting, edge), Dropbox (Magic Pocket storage), LinkedIn (Kafka ra đời từ đây).
- **Papers gốc (đọc nếu muốn sâu)**: Dynamo (Amazon 2007 — consistent hashing + quorum + vector clock), Google Spanner (TrueTime), Raft (dễ hiểu hơn Paxos), Kafka, Bigtable, MapReduce, The Google File System.
- **Công cụ thực hành**: excalidraw.com (vẽ diagram phỏng vấn), high-scalability.com (case study), github.com/donnemartin/system-design-primer.

---

> **Cách dùng file này:** mỗi lần làm 1 bài design (Bài test cuối tuần ở README), mở lại mục 🐛 để tự soi 7 bẫy, và mục ⚖️ để ép mình nói trade-off thành công thức. Estimation (mục 🧠.1) phải tới mức *phản xạ < 30s* — đó là phần phân biệt rõ nhất junior vs mid-level trong phỏng vấn.
