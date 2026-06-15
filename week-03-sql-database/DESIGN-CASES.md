# Tuần 3 — Thiết kế hệ thống & Case thực tế: SQL Database

> Tài liệu bổ trợ cho README.md cùng thư mục. Học sau khi xong phần lý thuyết.

## 🏗️ Mini System Design (scoped vào chủ đề tuần)

### Bài 1: Schema hệ thống booking phòng khách sạn — chống double-booking

**Đề bài:** Thiết kế schema (PostgreSQL) cho hệ thống đặt phòng: 5.000 khách sạn, 200K phòng, 50K booking/ngày, peak 30 booking/giây vào đợt lễ. Yêu cầu cứng: **tuyệt đối không double-booking** — hai khách không thể giữ cùng một phòng với khoảng ngày giao nhau, kể cả khi 2 request đến cùng millisecond. Chỉ rõ cơ chế chống trùng ở tầng nào và isolation level cần thiết.

**Phân tích & lời giải:**

Bước 1 — Schema lõi:

```sql
CREATE TABLE rooms (
  id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  hotel_id  BIGINT NOT NULL REFERENCES hotels(id),
  room_no   TEXT NOT NULL,
  type      TEXT NOT NULL,
  UNIQUE (hotel_id, room_no)
);

CREATE TABLE bookings (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_id     BIGINT NOT NULL REFERENCES rooms(id),
  guest_id    BIGINT NOT NULL REFERENCES guests(id),
  stay        DATERANGE NOT NULL,            -- [check_in, check_out) — nửa mở!
  status      TEXT NOT NULL DEFAULT 'confirmed'
              CHECK (status IN ('pending','confirmed','cancelled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Chọn `DATERANGE` nửa mở `[check_in, check_out)`: khách trả phòng ngày 10 thì khách khác nhận đúng ngày 10 không tính là giao nhau — range nửa mở mô hình hóa điều này tự nhiên, khỏi xử lý ±1 ngày thủ công.

Bước 2 — Tầng chống double-booking. So 3 phương án từ yếu đến mạnh:

- **(Sai) Check-then-insert ở app**: `SELECT` xem trống rồi `INSERT` — race kinh điển: 2 transaction cùng SELECT thấy trống, cùng INSERT, cả hai commit. Ở READ COMMITTED không gì ngăn được. Nói rõ đây là đáp án loại.
- **(Được) Khóa pessimistic**: `SELECT ... FROM rooms WHERE id = $1 FOR UPDATE` để serialize mọi booking trên cùng phòng rồi mới check + insert. Hoạt động đúng, nhưng dồn lock lên row room, và sự đúng đắn phụ thuộc *mọi* code path đều nhớ lấy lock.
- **(Đúng nhất) Exclusion constraint — đẩy invariant xuống DB:**

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings ADD CONSTRAINT no_double_booking
  EXCLUDE USING gist (room_id WITH =, stay WITH &&)
  WHERE (status <> 'cancelled');
```

Đọc là: không cho tồn tại 2 row có cùng `room_id` **và** range `stay` giao nhau (`&&`), bỏ qua booking đã hủy. DB tự lock đúng mức ở index GiST khi insert; 2 insert xung đột thì 1 cái nhận lỗi `23P01` → app bắt lỗi này trả "phòng vừa được đặt, mời chọn lại". **Constraint trong DB là hàng rào cuối cùng không phụ thuộc kỷ luật của dev** — mọi code path, kể cả script chạy tay, đều bị chặn.

Bước 3 — Isolation level cần gì? Đây là điểm hay bị hỏi vặn: với exclusion constraint, **READ COMMITTED là đủ** cho chính việc chống trùng — constraint được enforce ở mức index bất kể isolation. SERIALIZABLE không cần thiết cho bài này (trả giá retry + throughput vô ích). Chỉ cần nâng isolation/khóa khi invariant **không thể** biểu diễn bằng constraint — ví dụ "khách sạn chỉ cho oversell tối đa 5% số phòng" (logic đếm tổng) thì cần `FOR UPDATE` trên hotel row hoặc SERIALIZABLE + retry.

Bước 4 — Flow giữ chỗ khi thanh toán (booking thật luôn có bước pay):

```
1. INSERT booking status='pending', stay=..., expires_at = now() + 10 phút
   → exclusion constraint TÍNH CẢ pending → phòng bị giữ ngay từ lúc này
2. Thanh toán OK  → UPDATE status='confirmed'
3. Quá hạn       → cron/job đổi 'cancelled' → constraint thả range ra
```

(Thêm `expires_at` vào bảng và đưa `status='pending'` vào phạm vi constraint — chỉ loại `cancelled`.)

Bước 5 — Index phục vụ tìm phòng trống:

```sql
CREATE INDEX idx_bookings_room_stay ON bookings USING gist (room_id, stay)
  WHERE status <> 'cancelled';
-- Tìm phòng trống: NOT EXISTS (SELECT 1 FROM bookings b
--   WHERE b.room_id = r.id AND b.stay && daterange($1,$2) AND status <> 'cancelled')
```

30 booking/giây + đọc availability vài trăm QPS là rất nhẹ với 1 Postgres tử tế — nói rõ điều này để thể hiện sense về tải (đừng vội kéo cache/shard vào bài chưa cần).

**Trade-offs:**
- Exclusion constraint (Postgres-only) vs `FOR UPDATE` (portable mọi DB): constraint an toàn tuyệt đối + gọn, nhưng MySQL không có → trên MySQL buộc dùng lock pessimistic hoặc bảng `room_nights (room_id, night DATE, UNIQUE)` — insert 1 row/đêm, UNIQUE chặn trùng (đổi lấy N rows/booking, nhưng portable và dễ hiểu).
- Pessimistic lock: đơn giản, dễ reason; nhưng giảm concurrency trên phòng hot và phụ thuộc kỷ luật code.
- SERIALIZABLE: bảo vệ mọi invariant kể cả chưa nghĩ ra, nhưng phải viết retry loop cho cả app + throughput giảm — dùng có chọn lọc, không bật mặc định.

**Follow-up interviewer hay hỏi:**
1. *"Nếu đặt theo loại phòng (10 phòng Deluxe, khách không chọn phòng cụ thể)?"* → Thành bài toán đếm: bảng `room_type_inventory (room_type_id, date, total, booked)` — `UPDATE ... SET booked = booked + 1 WHERE date BETWEEN ... AND booked < total` cho từng đêm trong 1 transaction; row update là atomic, số dòng affected < số đêm → rollback. Đây chính là pattern của Booking.com-style inventory.
2. *"Scale lên 100x thì sao?"* → Đọc availability tách sang read replica/cache (chấp nhận hơi stale, vì write path vẫn có constraint chặn cuối); shard theo `hotel_id` vì mọi truy vấn đều scoped theo khách sạn — không có transaction xuyên khách sạn.
3. *"Vì sao không khóa bằng Redis `SETNX` cho nhanh?"* → Redis lock chống được phần lớn race nhưng là lock *advisory* có TTL — process treo quá TTL, clock lệch, hay code path quên lấy lock là thủng; tính đúng đắn cuối cùng vẫn phải nằm ở DB constraint. Redis chỉ nên là tầng giảm contention phía trước.

---

### Bài 2: Bảng audit log 100M rows/tháng — partitioning + archive

**Đề bài:** Hệ thống fintech phải lưu audit log mọi hành động (login, chuyển tiền, đổi thông tin): **100 triệu rows/tháng** (~40 RPS ghi trung bình, peak 500/s), mỗi row ~500 bytes (~50GB data + index/tháng). Yêu cầu: tra cứu theo `user_id + khoảng thời gian` trả về < 1s cho dữ liệu 3 tháng gần; giữ online 12 tháng; sau đó archive sang cold storage, giữ 10 năm (quy định); việc xóa data cũ không được làm nghẽn DB.

**Phân tích & lời giải:**

Bước 1 — Vì sao bảng thường sẽ chết: sau 1 năm là 1.2 tỷ rows ~600GB+. Index B-tree sâu dần, ghi chậm dần; còn `DELETE WHERE created_at < ...` 100M rows là thảm họa — lock dài, bloat khổng lồ, vacuum cày nhiều ngày, WAL phình. **Câu trả lời cấu trúc là partition theo thời gian: xóa = DROP partition, O(1).**

Bước 2 — Schema + partitioning:

```sql
CREATE TABLE audit_logs (
  id          BIGINT GENERATED ALWAYS AS IDENTITY,
  occurred_at TIMESTAMPTZ NOT NULL,
  user_id     BIGINT NOT NULL,
  action      TEXT NOT NULL,            -- 'transfer.create', 'auth.login', ...
  resource    TEXT,
  ip          INET,
  detail      JSONB,                    -- payload linh hoạt, KHÔNG index toàn bộ
  PRIMARY KEY (occurred_at, id)         -- partition key bắt buộc nằm trong PK
) PARTITION BY RANGE (occurred_at);

CREATE TABLE audit_logs_2026_06 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
-- pg_partman/cron tự tạo partition tháng tới + drop partition quá 12 tháng
```

Chọn partition **theo tháng**: 12 partition online, mỗi cái ~100M rows ~50GB — kích thước mà index per-partition vẫn khỏe. (Theo ngày → 365 partition, planning overhead tăng, chỉ đáng khi ghi nặng hơn nhiều.)

Bước 3 — Index strategy (per-partition, Postgres tự tạo qua partitioned index):

```sql
CREATE INDEX idx_audit_user_time ON audit_logs (user_id, occurred_at DESC);
CREATE INDEX idx_audit_action_time ON audit_logs (action, occurred_at DESC); -- nếu có truy vấn theo action
-- KHÔNG GIN index trên detail từ đầu — ghi 500/s mà GIN sẽ rất đau; thêm sau nếu có nhu cầu thật
```

Truy vấn `WHERE user_id = ? AND occurred_at BETWEEN ?` → planner **partition pruning** chỉ quét 3 partition liên quan, mỗi cái đi index `(user_id, occurred_at)` → vài chục ms. Nhớ nói: query **luôn phải kèm điều kiện thời gian**, không thì quét mọi partition — đây là kỷ luật đội dev phải theo.

Bước 4 — Tối ưu ghi 500/s peak: audit log là append-only → batch insert từ app (gom 100-500 rows hoặc 200ms, multi-row `INSERT ... VALUES (...), (...)` hoặc `COPY`); ghi qua queue (app → queue → writer) để hấp thụ peak và không làm chậm request chính — audit ghi trễ 1-2s chấp nhận được, **mất thì không** (queue bền như Kafka, không phải fire-and-forget).

Bước 5 — Vòng đời archive:

```
Tháng hiện tại + 11 tháng trước : partition online trong Postgres
Tháng thứ 13 (job đầu tháng)   : COPY partition → Parquet → S3 (Glacier sau 90 ngày)
                                  → verify checksum + đếm rows → DETACH → DROP partition
Tra cứu data cổ (hiếm)         : Athena/DuckDB query thẳng Parquet trên S3
```

DROP partition là thao tác metadata gần như tức thời — đối chiếu với DELETE 100M rows để làm nổi giá trị của thiết kế.

**Trade-offs:**
- Partition tháng vs ngày: tháng → ít partition, quản trị nhẹ; ngày → pruning mịn + drop mịn hơn nhưng planning overhead và rủi ro quên tạo partition cao hơn (luôn kèm default partition làm lưới).
- Giữ trong Postgres vs đẩy hẳn sang Elasticsearch/ClickHouse: ES/CH search/aggregate mạnh hơn nhiều, nhưng thêm một hệ thống phải vận hành; khi pattern truy cập chỉ là "lookup theo user + thời gian" thì Postgres partition là đủ và rẻ — đừng over-engineer khi access pattern hẹp.
- JSONB `detail` linh hoạt nhưng không ràng buộc schema; cột nào cần filter thường xuyên thì thăng cấp thành cột thật.

**Follow-up interviewer hay hỏi:**
1. *"Audit log có cần chống sửa/xóa (tamper-evident) không?"* → Fintech: có. REVOKE UPDATE/DELETE với mọi role app trên bảng; mạnh hơn: hash chain (`row_hash = sha256(prev_hash || row_data)`) hoặc xuất định kỳ digest sang storage WORM/S3 Object Lock.
2. *"Tổng kết 'số hành động theo loại theo ngày' cho dashboard thì sao?"* → Đừng aggregate trên bảng raw mỗi lần — bảng `audit_daily_summary` được job tổng hợp mỗi đêm (hoặc incremental theo giờ); đúng pattern pre-aggregate của bài 3.
3. *"Một user chiếm 30% log (system bot) làm lệch index?"* → Tách bot ra bảng/partition riêng theo `LIST` sub-partition, hoặc loại bot khỏi index bằng partial index `WHERE user_id <> BOT_ID`.

---

### Bài 3: Báo cáo doanh thu real-time-ish trên DB transactional

**Đề bài:** Sàn TMĐT: Postgres chính chứa `orders` (5M đơn/tháng, ~80GB sau 2 năm), team vận hành cần dashboard doanh thu: theo giờ trong ngày hôm nay (chấp nhận trễ ≤ 2 phút), theo ngày/tháng/danh mục/seller cho 24 tháng (chấp nhận trễ tới sáng hôm sau). Hiện tại dashboard query `SUM/GROUP BY` thẳng vào DB chính làm CPU DB spike 80% mỗi lần ai đó mở báo cáo tháng. Thiết kế lại, nêu rõ trade-off độ trễ của từng tầng.

**Phân tích & lời giải:**

Bước 1 — Gọi tên vấn đề: trộn **OLTP** (đơn hàng — nhiều write nhỏ, cần latency ms) với **OLAP** (báo cáo — scan + aggregate hàng chục triệu rows) trên cùng instance → báo cáo chiếm CPU/RAM/buffer cache, làm chậm checkout — tức là **báo cáo đang làm hại doanh thu mà nó đo**. Nguyên tắc: cô lập workload, và mỗi yêu cầu độ tươi khác nhau xứng đáng một tầng khác nhau.

Bước 2 — Kiến trúc 3 tầng theo độ tươi:

```
                    Postgres PRIMARY (OLTP — chỉ phục vụ giao dịch)
                         │ streaming replication (lag ~giây)
                         ▼
                    READ REPLICA  ──── tầng 1: query "hôm nay theo giờ"
                         │                      (trễ = replication lag, ~giây)
        job 2 phút       │                 chỉ quét partition hôm nay → nhẹ
   ┌─────────────────────┘
   ▼
revenue_hourly (summary table)  ── tầng 2: intraday dashboard, trễ ≤ 2 phút
   ▼ job hằng đêm (rollup)
revenue_daily / monthly         ── tầng 3: báo cáo lịch sử 24 tháng, trễ ≤ 1 ngày
```

Bước 3 — Tầng 2, incremental aggregate (phần đáng nói nhất):

```sql
CREATE TABLE revenue_hourly (
  bucket_hour  TIMESTAMPTZ NOT NULL,
  category_id  BIGINT NOT NULL,
  seller_id    BIGINT NOT NULL,
  order_count  BIGINT NOT NULL,
  gross        NUMERIC(18,2) NOT NULL,   -- tiền: NUMERIC, không bao giờ FLOAT
  PRIMARY KEY (bucket_hour, category_id, seller_id)
);

-- Job mỗi 2 phút: chỉ aggregate phần MỚI kể từ watermark trước
INSERT INTO revenue_hourly
SELECT date_trunc('hour', o.created_at), o.category_id, o.seller_id,
       count(*), sum(o.total)
FROM orders o
WHERE o.created_at >= $last_watermark AND o.created_at < $now
  AND o.status = 'completed'
GROUP BY 1, 2, 3
ON CONFLICT (bucket_hour, category_id, seller_id)
DO UPDATE SET order_count = revenue_hourly.order_count + EXCLUDED.order_count,
              gross       = revenue_hourly.gross       + EXCLUDED.gross;
```

Điểm cần nói khi present: (a) job chạy trên **replica đọc, ghi vào bảng summary ở DB riêng cho reporting** (hoặc primary nếu nhỏ) — incremental theo watermark nên mỗi lần chỉ đụng vài nghìn rows; (b) **đơn bị hủy/refund sau khi đã cộng?** — chọn 1 trong 2: cộng bằng event delta (order_completed +x, order_refunded −x, idempotent theo event id), hoặc recompute lại các bucket gần (24-48h cuối) mỗi lần chạy — đơn giản hơn, đủ đúng vì refund muộn hiếm; (c) dashboard query bảng summary vài nghìn rows → ms, không đụng bảng orders.

Bước 4 — Vì sao không dùng `MATERIALIZED VIEW` cho tầng 2: matview Postgres refresh là **tính lại toàn bộ**; `REFRESH ... CONCURRENTLY` không chặn đọc nhưng vẫn tốn full recompute mỗi 2 phút trên bảng 80GB → phí vô lý. Matview hợp cho tầng 3 (refresh 1 lần/đêm) hoặc view nhỏ. Summary table + incremental upsert cho ta kiểm soát hoàn toàn — trả giá bằng code job + xử lý watermark/late events. (Nhắc thêm: TimescaleDB continuous aggregates làm sẵn pattern này.)

Bước 5 — Nói trước đường tiến hóa: khi cần slice-and-dice tự do (ad-hoc theo chục chiều) → CDC (Debezium) stream `orders` sang ClickHouse/BigQuery; trễ ~giây-phút, OLAP thật sự. Nêu như "bước sau khi nhu cầu vượt summary table" — thể hiện biết điểm dừng của từng giải pháp.

**Trade-offs:**
- Read replica: zero code, độ tươi cao; nhưng vẫn là engine row-store chạy query OLAP (chậm trên 24 tháng data) và query nặng trên replica gây lag/conflict — chỉ phù hợp query hẹp (1 ngày).
- Summary table: đọc nhanh nhất, rẻ nhất; trả giá: chiều aggregate phải **định trước** (thêm chiều mới = backfill), code job + watermark + late-event là phần phải maintain.
- Matview: ít code nhất; trả giá full recompute + không incremental (Postgres thuần).
- CDC + columnar DB: linh hoạt + nhanh nhất cho OLAP; trả giá cả một hệ thống mới (Kafka, Debezium, ClickHouse) — chỉ đáng khi nhu cầu ad-hoc thật.

**Follow-up interviewer hay hỏi:**
1. *"Job aggregate chết 30 phút thì sao?"* → Watermark lưu bền (bảng `etl_state`), job chạy lại tự đuổi kịp từ watermark cũ; ON CONFLICT upsert + delta idempotent đảm bảo chạy lại không double-count; alert khi `now - watermark > 5 phút`.
2. *"Đơn tạo lúc 23:59 nhưng completed 00:10 hôm sau tính vào ngày nào?"* → Câu hỏi business chứ không phải kỹ thuật — chốt với stakeholder bucket theo `completed_at` hay `created_at` rồi nhất quán mọi tầng; nêu được "đây là quyết định business" là điểm cộng senior.
3. *"Replication lag tăng đột biến ảnh hưởng gì và phát hiện thế nào?"* → Dashboard "hôm nay" bị thiếu số phút cuối → hiển thị "data as of HH:MM" lấy từ `pg_last_xact_replay_timestamp()`; alert lag > ngưỡng; query nặng trên replica có thể bị cancel do conflict → cân nhắc `hot_standby_feedback` (đổi bằng bloat trên primary).

---

### Bài 4: Multi-tenant database — shared schema vs schema-per-tenant vs DB-per-tenant

**Đề bài:** Bạn xây SaaS quản lý nhân sự (HRM) bán cho doanh nghiệp VN: mục tiêu 3 năm là 2.000 tenant — 1.900 SME (< 200 nhân viên) + ~100 enterprise (5K-50K nhân viên, có yêu cầu compliance, vài khách đòi "dữ liệu tách riêng"). Chọn chiến lược multi-tenancy cho Postgres, thiết kế cơ chế chống lộ dữ liệu chéo tenant, và kế hoạch cho tenant "to bất thường".

**Phân tích & lời giải:**

Bước 1 — Bảng so sánh 3 mô hình (nên vẽ ngay khi vào bài):

| Tiêu chí | Shared schema (cột `tenant_id`) | Schema-per-tenant | DB-per-tenant |
|---|---|---|---|
| Cô lập dữ liệu | Logic (RLS/WHERE) — yếu nhất | Trung bình (namespace) | Mạnh nhất (vật lý) |
| Số tenant chịu được | Hàng trăm nghìn | ~Hàng trăm — vài nghìn schema thì migration & pg_dump bắt đầu khổ | Hàng chục — vài trăm (chi phí/ops mỗi DB) |
| Migration | Chạy 1 lần | Chạy N lần (drift là ác mộng thật sự) | Chạy N lần + điều phối version |
| Chi phí/tenant | Thấp nhất | Trung bình | Cao nhất |
| Noisy neighbor | Cao (chung bảng, chung buffer) | Trung bình | Không |
| Backup/restore 1 tenant | Khó (lọc rows) | Dump 1 schema | Trivial |
| Tùy biến per-tenant | Khó | Được | Thoải mái |
| Connection pool | 1 pool chung | 1 pool chung (set search_path) | Pool riêng mỗi DB — dễ nổ số connection |

Bước 2 — Quyết định: **hybrid**. 1.900 SME → shared schema + RLS (chi phí biên ~0, vận hành 1 DB); ~100 enterprise/khách đòi tách → DB-per-tenant (bán như tier "dedicated", tính thêm tiền — cô lập là feature có giá). Routing qua catalog:

```sql
CREATE TABLE tenant_directory (        -- nằm ở DB điều phối
  tenant_id   UUID PRIMARY KEY,
  tier        TEXT NOT NULL,           -- 'shared' | 'dedicated'
  dsn         TEXT NOT NULL,           -- trỏ về DB shared hoặc DB riêng
  plan        TEXT NOT NULL
);
```

App resolve tenant (từ subdomain/JWT claim) → tra directory (cache) → lấy connection đúng nơi. Schema-per-tenant bị loại làm mô hình chính: nhận đủ điểm yếu của cả hai (migration N lần, ops phức tạp) mà cô lập vẫn nửa vời — chỉ giữ làm bước đệm nếu hệ thống legacy đã lỡ theo.

Bước 3 — Chống lộ dữ liệu chéo tenant trong shared schema — **không tin WHERE clause của dev**, bật Row-Level Security:

```sql
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees FORCE ROW LEVEL SECURITY;   -- chặn cả owner của bảng

CREATE POLICY tenant_isolation ON employees
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

```js
// Middleware: mọi query của request chạy trong transaction đã "đóng dấu" tenant
await client.query('BEGIN');
// SET LOCAL: hết transaction tự reset → connection trả về pool SẠCH, không dính tenant cũ
await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
```

Hai chi tiết ăn điểm: (1) **`SET LOCAL` (set_config với `is_local=true`)** vì connection pool dùng chung — dùng SET thường thì connection trả về pool còn dính tenant_id cũ, request sau đọc nhầm tenant: lỗi bảo mật kinh điển của shared pool; (2) app dùng **role không phải owner** + `FORCE RLS`, vì owner mặc định bypass RLS. Một dev quên WHERE → query trả 0 rows thay vì trả dữ liệu công ty khác.

Bước 4 — Index & layout cho shared schema: mọi bảng có `tenant_id` đứng **đầu** trong composite index (`(tenant_id, employee_code)`, `(tenant_id, created_at)`...) — mọi query đều scoped nên index phải scoped theo. FK cũng nên composite (`(tenant_id, department_id)` tham chiếu `(tenant_id, id)`) để chặn tham chiếu xuyên tenant ngay ở mức ràng buộc.

Bước 5 — Tenant to bất thường trong shared pool (noisy neighbor): phát hiện qua metric per-tenant (rows, QPS, storage — đo từ `pg_stat_statements` gắn tag); kịch bản "tốt nghiệp" tenant: quá ngưỡng → migrate sang dedicated DB (dump rows theo `tenant_id` → restore → đổi `dsn` trong directory → cutover bằng maintenance window ngắn hoặc dual-write). **Thiết kế directory routing từ ngày đầu chính là để cuộc migrate này chỉ là đổi 1 dòng config.**

**Trade-offs:**
- Hybrid: tối ưu chi phí + đáp ứng compliance, nhưng đội phải vận hành **2 mô hình** (test, migration, backup cho cả hai đường) — trả giá bằng độ phức tạp quy trình.
- RLS: hàng rào trong DB không phụ thuộc kỷ luật dev; chi phí: planner thêm điều kiện mỗi query (vài %), debug khó hơn ("sao query trả rỗng?"), và policy phức tạp có thể chặn dùng index — giữ policy dạng so sánh bằng đơn giản.
- DB-per-tenant cho enterprise: cô lập + backup/restore từng khách + điểm cộng khi bán hàng; chi phí: fleet hàng trăm DB cần tooling migration (chạy theo đợt, theo dõi version từng DB) và tổng connection — cần PgBouncer per-DB hoặc connection budget.

**Follow-up interviewer hay hỏi:**
1. *"Migration cho 100 DB dedicated chạy thế nào để không có DB bị bỏ quên?"* → Bảng version per-tenant trong directory, job migration chạy theo batch có canary (vài tenant nhỏ trước), app tương thích N và N−1 (expand → migrate → contract) để không cần đồng loạt.
2. *"RLS có ảnh hưởng performance không, đo thế nào?"* → Policy đơn giản: planner inline điều kiện như WHERE thường, overhead vài %; đo bằng `EXPLAIN ANALYZE` cùng query có/không RLS; cẩn thận policy gọi function volatile — không inline được, chạy per-row.
3. *"Tenant yêu cầu data residency (dữ liệu phải ở VN/EU)?"* → DB-per-tenant đặt đúng region, directory routing đã hỗ trợ sẵn vì `dsn` per-tenant; với shared tier thì dựng thêm 1 shared cluster mỗi region — tenant gắn region lúc tạo.

---

## 🌍 Case thực tế

### Case 1: Slow query sau 1 năm vận hành — hàm trên cột giết index

**Bối cảnh:** Hệ thống quản lý đơn cho chuỗi bán lẻ (Postgres, ~12M đơn sau 1 năm). Màn hình "đơn hàng hôm nay" của cửa hàng dùng query do dev viết từ ngày đầu:

```sql
SELECT * FROM orders
WHERE store_id = $1 AND DATE(created_at) = CURRENT_DATE
ORDER BY created_at DESC;
```

**Vấn đề gặp phải:** 6 tháng đầu chạy êm (bảng nhỏ, seq scan vài trăm nghìn rows vẫn nhanh — đây là điểm thâm: **query tồi không biểu hiện khi data nhỏ**). Đến tháng thứ 10-12, màn hình load 4-6s, sáng thứ Hai (nhiều người mở cùng lúc) CPU DB căng 90%, app timeout dây chuyền. `EXPLAIN ANALYZE` cho thấy: dù có index `(store_id, created_at)`, plan vẫn lọc `DATE(created_at) = ...` bằng filter sau khi quét toàn bộ đơn của store — vì **`DATE(created_at)` là biểu thức hàm trên cột, B-tree index trên `created_at` không dùng được cho điều kiện này** (index lưu giá trị gốc, không lưu giá trị qua hàm). 12M rows + hàm chạy per-row = chậm tuyến tính theo tuổi hệ thống.

**Giải pháp & tại sao:**
1. **Fix đúng nhất — viết lại điều kiện thành sargable** (so sánh range trên cột trần):

```sql
WHERE store_id = $1
  AND created_at >= CURRENT_DATE
  AND created_at < CURRENT_DATE + INTERVAL '1 day'
```

Index `(store_id, created_at)` lập tức được dùng → 4s xuống ~5ms. Không cần index mới, chỉ cần query đúng.
2. **Phương án functional index** — khi không sửa được query (ORM sinh, code bên thứ ba): `CREATE INDEX ON orders (store_id, (DATE(created_at)))` (lưu ý timezone của DATE trên timestamptz phải cố định/immutable). Hoạt động, nhưng là index "may đo" cho 1 dạng query — range query khác không hưởng lợi; team này chọn sửa query là chính, functional index chỉ dùng cho một báo cáo legacy.
3. Quét toàn codebase tìm cùng pattern: `LOWER(email) = ?` (→ functional index `LOWER(email)` hoặc cột `citext`), `WHERE status + 0`, cast ngầm `varchar_col = 123` — tất cả cùng họ "non-sargable".

**Bài học rút ra:** (1) Hàm/biểu thức bọc quanh cột trong WHERE = vô hiệu index thường — viết điều kiện về dạng `col <op> hằng/range`. (2) Bài kiểm tra không phải "có index chưa" mà là "**plan có dùng index không**" — `EXPLAIN ANALYZE` là phản xạ, đừng đoán. (3) Hệ thống chậm dần theo data growth cần được đón đầu bằng `pg_stat_statements` + alert trên mean/p99 của top query, đừng đợi user kêu.

**💬 Cách dùng case này khi phỏng vấn:** Khi được hỏi "indexing strategy" hay "đã từng tối ưu query chậm chưa" — kể đúng cú twist *"có index sẵn rồi nhưng không được dùng vì hàm trên cột"* kèm con số 4s → 5ms; nó chứng minh bạn đọc execution plan chứ không chỉ biết tạo index.

---

### Case 2: Deadlock giờ cao điểm giữa 2 job batch — thứ tự lock

**Bối cảnh:** Ví điện tử/ứng dụng loyalty: mỗi tối 20h chạy đồng thời (a) job **settlement** quét giao dịch trong ngày và cập nhật số dư ví theo *merchant*, (b) job **cashback** cộng điểm thưởng vào ví theo *campaign*. Cả hai cùng UPDATE bảng `wallets`, mỗi job gom nhiều ví vào một transaction lớn cho "nhanh".

**Vấn đề gặp phải:** Log Postgres mỗi tối rải rác `ERROR: deadlock detected — Process 41 waits for ShareLock on transaction 1023; blocked by process 52...`. Job framework retry cả batch → chạy lại từ đầu → đêm cao điểm job settlement trễ 2 tiếng, sáng hôm sau đối soát lệch. Nguyên nhân: job A duyệt ví theo thứ tự *merchant_id* (ví 7 → 3), job B duyệt theo thứ tự *campaign* (ví 3 → 7). A giữ row-lock ví 7 chờ ví 3; B giữ ví 3 chờ ví 7 → vòng chờ → Postgres chọn 1 victim để giết. Deadlock không phải bug của DB — là bug **thứ tự khóa** của ứng dụng.

**Giải pháp & tại sao:**
1. **Quy ước thứ tự lock toàn cục** — fix gốc rẻ nhất: mọi job/transaction đụng nhiều ví phải xử lý **theo `wallet_id` tăng dần**. Hai transaction cùng thứ tự thì chỉ có chờ (block) chứ không bao giờ tạo vòng → deadlock biến mất về nguyên lý:

```sql
SELECT id FROM wallets WHERE id = ANY($1)
ORDER BY id            -- thứ tự thống nhất toàn hệ thống
FOR UPDATE;            -- lấy hết lock cần thiết NGAY ĐẦU transaction
```

2. **Thu nhỏ transaction**: thay vì 1 transaction 50K ví, chia batch 100-500 ví/transaction — deadlock nếu còn thì victim chỉ mất 1 batch, retry rẻ; lock giữ ngắn nên độ tranh chấp giảm mạnh.
3. **Retry đúng tầng**: deadlock victim nhận SQLSTATE `40P01` — retry **transaction đó** với backoff + jitter (vài lần), không retry cả job; code phải idempotent (cập nhật theo delta đã đánh dấu processed, không cộng mù).
4. Giảm va chạm bằng lập lịch: 2 job lệch giờ nhau, hoặc settlement dùng `FOR UPDATE SKIP LOCKED` bỏ qua ví đang bị job khác giữ, vòng sau quay lại — pattern queue-trên-SQL rất đáng nhắc.

**Bài học rút ra:** (1) Đa số deadlock chữa bằng **một câu quy ước**: mọi nơi khóa nhiều resource phải khóa theo cùng một thứ tự (sort theo PK). (2) Transaction batch càng to càng "hiệu quả" trên giấy, càng dễ deadlock + retry càng đắt — batch nhỏ là vị thuốc kép. (3) Deadlock là điều kiện **phải được retry** ở app — không bắt `40P01` thì lỗi nổi thẳng lên user. (4) Đọc log deadlock của Postgres (nó in cả 2 query) là kỹ năng cụ thể nên luyện.

**💬 Cách dùng case này khi phỏng vấn:** Câu "deadlock là gì, xử lý thế nào" — đừng dừng ở định nghĩa vòng chờ; kể case 2 job đêm này và chốt bằng nguyên tắc "global lock ordering + batch nhỏ + retry 40P01" để cho thấy bạn đã chữa nó trong đời thật.

---

### Case 3: Pagination OFFSET 1M → cursor: p99 từ 8s xuống 50ms

**Bối cảnh:** API mở cho đối tác của một nền tảng logistics: `GET /shipments?page=N&limit=100` trên bảng ~30M rows, sort theo `created_at DESC`. Vài đối tác lớn viết script "đồng bộ toàn bộ": cào tuần tự từ page 1 đến page 300.000.

**Vấn đề gặp phải:** Trang đầu nhanh (20ms), nhưng `OFFSET 1000000` buộc DB **đọc và vứt đi 1M rows** trước khi trả 100 rows — OFFSET không "nhảy cóc" được, nó đếm bằng cách duyệt. Càng sâu càng chậm tuyến tính: p99 của endpoint lên 8s, mỗi script sync của đối tác chiếm 1 connection + 1 core hàng giờ, buffer cache bị flush bởi scan sâu → query của user thường cũng chậm lây. Bonus bug: data mới chèn vào trong lúc cào làm trang bị **trôi** — đối tác nhận trùng/sót bản ghi mà không biết.

**Giải pháp & tại sao:**
1. **Chuyển sang cursor/keyset pagination** — thay "đếm tới vị trí" bằng "tìm tiếp từ sau vị trí đã biết" (seek):

```sql
-- Tie-breaker bằng id vì created_at có thể trùng
SELECT * FROM shipments
WHERE (created_at, id) < ($cursor_created_at, $cursor_id)
ORDER BY created_at DESC, id DESC
LIMIT 100;
-- Index bắt buộc khớp thứ tự sort: (created_at DESC, id DESC)
```

Điều kiện `(a,b) < (x,y)` là **row comparison** — index range scan trượt thẳng đến vị trí, đọc đúng 100 rows. Trang thứ 1 hay thứ 300.000 đều ~vài ms → p99 8s → 50ms.
2. **API trả opaque cursor**: response kèm `next_cursor = base64(created_at|id)` (có thể ký HMAC chống giả mạo); client gửi lại `?cursor=...`. Không expose cấu trúc bên trong → sau này đổi sort key không gãy contract.
3. Migration cho đối tác: giữ `page=` (giới hạn `page <= 100` — vẫn phục vụ UI nhảy trang nông), endpoint sync chuyển hẳn sang cursor + viết doc; đối tác lớn còn được lợi: cursor **ổn định khi data mới chèn vào** (không trùng/sót như offset) — đây là lý do thuyết phục họ migrate, không chỉ vì DB của mình.
4. Chặn tái phát: lint/review quy ước "không OFFSET quá 10K", limit max 1000, và bài toán "đồng bộ toàn bộ" về dài hạn nên là export file/CDC feed thay vì cào API từng trang.

**Bài học rút ra:** (1) `OFFSET N` = O(N) — mọi endpoint phân trang công khai trên bảng lớn rồi sẽ bị ai đó cào tới đáy; thiết kế cursor **ngay từ đầu** cho API public. (2) Keyset cần sort key **xác định + duy nhất** (luôn thêm tie-breaker `id`) và index khớp đúng hướng sort. (3) Nhược điểm thật của cursor — không nhảy thẳng trang 50, không biết tổng số trang — thường giải bằng UI infinite-scroll và `count` ước lượng (`reltuples`); nêu được nhược điểm này mới là hiểu đủ hai mặt.

**💬 Cách dùng case này khi phỏng vấn:** Câu hỏi pagination/tối ưu query rất hay gặp — trả lời bằng cặp số "8s → 50ms" + giải thích vì sao OFFSET phải đọc-rồi-vứt 1M rows còn keyset seek thẳng qua index, rồi chốt bằng trade-off "mất khả năng nhảy trang" để thể hiện cân bằng.

---

## ✅ Checklist tự kiểm tra

1. Tôi có trình bày được 3 phương án chống double-booking (check-then-insert sai vì sao, FOR UPDATE, exclusion constraint) và giải thích vì sao constraint trong DB đáng tin hơn kỷ luật ở app, cùng việc READ COMMITTED là đủ khi đã có constraint không?
2. Tôi có giải thích được vì sao DELETE 100M rows là thảm họa còn DROP partition là O(1), và thiết kế được vòng đời partition → detach → Parquet/S3 → drop không?
3. Tôi có so sánh được 4 tầng báo cáo (replica, summary table incremental, matview, CDC + columnar) theo trục độ-tươi/chi-phí/độ-phức-tạp, và xử lý được câu hỏi late event/refund với watermark + upsert idempotent không?
4. Tôi có vẽ lại được bảng so sánh 3 mô hình multi-tenant, lập luận hybrid theo phân bố khách hàng, và viết được policy RLS kèm 2 chi tiết `SET LOCAL` với connection pool và `FORCE RLS` với owner không?
5. Gặp query có index nhưng vẫn chậm, tôi có phản xạ kiểm tra plan bằng `EXPLAIN ANALYZE` và nhận diện các pattern non-sargable (hàm trên cột, cast ngầm, leading wildcard) cùng 2 đường fix (viết lại sargable vs functional index) không?
6. Tôi có phát biểu được nguyên tắc chống deadlock "global lock ordering + transaction nhỏ + retry 40P01 idempotent" và biết khi nào dùng `SKIP LOCKED` không?
7. Tôi có viết được query keyset pagination với tie-breaker và index khớp hướng sort, giải thích vì sao OFFSET là O(N), và nêu được cả nhược điểm của cursor (không jump trang, không total count rẻ) không?
