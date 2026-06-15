# 🔬 Đào sâu — Tuần 3: SQL Database

> README đã dạy bạn *dùng* index, transaction, EXPLAIN. File này mổ xẻ *vì sao* chúng hoạt động như vậy — đủ sâu để bạn trả lời câu hỏi "tại sao" mà phỏng vấn senior luôn hỏi tiếp.

## 🧠 Cơ chế bên trong

### 1. B-tree index thực sự là gì và vì sao O(log n)

B-tree (chính xác hơn ở Postgres là **B+tree**) không phải cây nhị phân — nó là cây **đa nhánh (high fanout)**. Mỗi node là một **page 8KB**, chứa hàng trăm khóa + con trỏ. Vì fanout cao (thường 100–500 nhánh/node), chiều cao cây rất thấp:

- 1 triệu dòng, fanout ~200 → chiều cao chỉ ~3 levels (200³ = 8 triệu).
- 1 tỷ dòng → ~4–5 levels.

Tìm một giá trị = đi từ root xuống leaf, mỗi level đọc **1 page**. Vậy tra cứu = **3–5 lần đọc page**, bất kể bảng 1 triệu hay 1 tỷ dòng. Đó chính là O(log n) với base lớn — và vì base lớn, hằng số log gần như "phẳng". So với Seq Scan đọc toàn bộ bảng (O(n) page), khác biệt là vài chục page vs hàng trăm nghìn page.

**Cấu trúc B+tree (khác B-tree thuần):**
- **Internal node** chỉ chứa khóa định tuyến (routing) — không chứa dữ liệu, để nhồi được nhiều khóa hơn → fanout cao hơn → cây thấp hơn.
- **Leaf node** chứa toàn bộ khóa đã sort + con trỏ (ở Postgres là `TID` = `(block, offset)` trỏ vào heap; ở InnoDB secondary index trỏ về giá trị **PK**).
- Các leaf node được nối thành **doubly-linked list** → range scan (`BETWEEN`, `>`, `ORDER BY`) chỉ cần tìm điểm đầu rồi đi tuần tự theo link, không cần quay lại root.

### 2. Vì sao index trên cột selectivity thấp là vô dụng

**Selectivity** = số giá trị distinct / tổng số dòng. Cột `gender` (2 giá trị) trên 1 triệu dòng → selectivity ~0.000002, cực thấp.

Mấu chốt là **chi phí random I/O**. Khi query lấy 50% bảng qua index, planner phải: tìm trong index → với mỗi entry, nhảy random vào heap lấy dòng. Đọc 500k dòng theo **random order** (đúng thứ tự index, lung tung trong heap) đắt hơn nhiều so với đọc **tuần tự** toàn bộ bảng (sequential read, prefetch, đọc theo block).

Postgres mô hình hóa điều này: `seq_page_cost = 1.0` nhưng `random_page_cost = 4.0` (mặc định, giả định HDD; trên SSD nên hạ xuống ~1.1). Planner tính: nếu số dòng cần lấy vượt ngưỡng (~5–10% bảng tùy random_page_cost), Seq Scan **rẻ hơn** → bỏ index. Đây là quyết định **đúng đắn**, không phải bug. Index chỉ có giá trị khi nó **loại bỏ được phần lớn** dữ liệu (high selectivity).

> Ngoại lệ: **partial index** cứu cột selectivity thấp khi truy vấn luôn lọc một giá trị hiếm: `CREATE INDEX ON orders (created_at) WHERE status = 'pending'` — index nhỏ, chỉ chứa dòng pending (giả sử pending là thiểu số).

### 3. Covering index & Index-Only Scan — và cái bẫy visibility map

Index-Only Scan đọc thẳng từ index, bỏ bước "heap fetch". Nhưng index Postgres **không lưu thông tin transaction (xmin/xmax)** — nó không biết một dòng có hiển thị với snapshot hiện tại hay không (do MVCC, một entry index có thể trỏ tới dòng đã bị transaction khác xóa nhưng chưa VACUUM).

Để tránh phải về heap kiểm tra, Postgres dùng **visibility map (VM)** — 1 bit/page đánh dấu "mọi dòng trong page này hiển thị với mọi transaction". Index-Only Scan chỉ thực sự "only" khi page tương ứng **all-visible** trong VM. VM chỉ được cập nhật bởi **VACUUM**.

→ Hệ quả thực chiến: vừa tạo covering index trên bảng vừa ghi nhiều, EXPLAIN ANALYZE vẫn thấy `Heap Fetches: <số lớn>` — Index-Only Scan đang phải về heap, không nhanh như kỳ vọng. **Fix: chạy `VACUUM table`**. Luôn nhìn dòng `Heap Fetches` trong plan để xác nhận covering index thực sự hiệu lực.

### 4. Composite index & leftmost-prefix — góc nhìn vật lý

README đã cho quy tắc. Lý do vật lý: index `(a, b, c)` sort dữ liệu giống như sort danh bạ theo (họ, tên đệm, tên). Bạn tìm nhanh theo "họ" hoặc "họ + tên đệm", nhưng tìm "mọi người tên đệm = Văn" thì phải quét cả danh bạ — vì cùng "tên đệm Văn" nằm rải rác ở mọi "họ".

**Vì sao cột range phải đứng cuối:** index sort theo `a`, rồi *trong mỗi a* sort theo `b`, rồi *trong mỗi (a,b)* sort theo `c`. Với `WHERE a = 5 AND b > 10 AND c = 3`: sau khi seek tới `a=5, b>10`, các dòng thỏa nằm liền nhau theo `b`, nhưng `c` **không còn sort liên tục** trong dải đó → `c` chỉ dùng làm **filter** (lọc sau), không dùng để **seek** (nhảy thẳng). Trong plan, để ý: cột seek nằm ở `Index Cond`, cột chỉ filter nằm ở `Filter` — đó là cách phân biệt cột nào thực sự thu hẹp index.

### 5. MVCC của Postgres — UPDATE không sửa tại chỗ

Postgres **không update in-place**. Mỗi `UPDATE` tạo một **tuple (row version) mới** và đánh dấu tuple cũ là "chết" (dead) bằng cách set `xmax`. Mỗi tuple mang theo:
- `xmin` — transaction id đã tạo nó.
- `xmax` — transaction id đã xóa/update nó (0 nếu còn sống).

Một transaction với snapshot của nó chỉ "nhìn thấy" tuple mà `xmin` đã commit *trước* snapshot và `xmax` chưa commit (hoặc = 0). Đó là cơ chế reader-không-block-writer.

**Hệ quả 1 — bloat:** UPDATE 1 dòng 1 triệu lần để lại 999.999 tuple chết. Bảng phình to, index phình theo. Đọc chậm vì phải lướt qua xác chết.

**Hệ quả 2 — VACUUM:** dọn tuple chết, trả không gian cho tái sử dụng (autovacuum chạy nền). Nhưng `VACUUM` thường **không trả đĩa lại cho OS** — chỉ đánh dấu space tái dùng. Muốn co bảng thật cần `VACUUM FULL` (khóa bảng, viết lại) hoặc `pg_repack` (không khóa).

**Hệ quả 3 — HOT update:** nếu UPDATE **không đụng cột nào được index** và page còn chỗ, Postgres dùng **HOT (Heap-Only Tuple)** — tuple mới nằm cùng page, **không cần cập nhật index**, giảm bloat index. Đây là lý do thực tế để **không index những cột bị update liên tục** (vd `last_seen_at`).

**Hệ quả 4 — transaction ID wraparound:** xid là 32-bit, quay vòng sau ~4 tỷ. Bảng không được VACUUM lâu có thể gây "wraparound" buộc DB dừng để bảo vệ dữ liệu. Đây là sự cố production kinh điển ở Postgres bị bỏ bê autovacuum.

### 6. Planner ước lượng cost ra sao

Planner không "chạy thử" — nó **ước lượng** dựa trên thống kê trong `pg_statistic` (cập nhật bởi `ANALYZE`, thường do autovacuum gọi). Thống kê chính:
- `n_distinct` — số giá trị distinct (suy ra selectivity).
- `null_frac` — tỉ lệ NULL.
- **MCV (Most Common Values)** — danh sách giá trị phổ biến nhất + tần suất → ước lượng chính xác cho `WHERE status = 'paid'` khi 'paid' là MCV.
- **Histogram** — phân bố cho cột nhiều giá trị → ước lượng `WHERE price BETWEEN ...`.

Planner tính cost mỗi plan = `(số page × page_cost) + (số tuple × cpu_tuple_cost) + ...` rồi chọn rẻ nhất. **Điểm yếu chí mạng:** Postgres mặc định giả định các cột **độc lập**. Với `WHERE city = 'HN' AND district = 'Ba Đình'` (district phụ thuộc city), nó nhân hai selectivity lại → ước lượng quá thấp → chọn sai plan (Nested Loop thay vì Hash Join). Fix: `CREATE STATISTICS ... (dependencies) ON city, district FROM addresses` (extended statistics, từ PG 10).

Mặc định planner chỉ giữ **100 buckets** histogram + 100 MCV (`default_statistics_target`). Cột lệch nặng có thể cần tăng riêng: `ALTER TABLE t ALTER COLUMN c SET STATISTICS 1000`.

### 7. Isolation levels qua lăng kính snapshot — đi sâu hơn bảng anomaly

README cho bảng "level nào chặn anomaly nào". Đây là **cơ chế**:

- **READ COMMITTED (mặc định PG):** mỗi **câu lệnh** lấy một snapshot **mới**. Vì vậy hai `SELECT` trong cùng transaction có thể thấy dữ liệu khác nhau (non-repeatable read xảy ra). Đặc biệt: một `UPDATE ... WHERE` đang chờ lock; khi lock được nhả, Postgres **re-evaluate** điều kiện WHERE trên *phiên bản mới nhất* của dòng (gọi là EvalPlanQual) — không phải snapshot cũ. Đây là lý do `UPDATE accounts SET balance = balance - 10 WHERE id = 1` an toàn dưới READ COMMITTED dù có concurrency.

- **REPEATABLE READ (PG):** lấy **một snapshot duy nhất** lúc câu lệnh đầu tiên, giữ nguyên cho cả transaction. Mọi đọc đều nhất quán → chặn non-repeatable **và** phantom (vì là **Snapshot Isolation** thực sự, mạnh hơn chuẩn SQL yêu cầu). Đổi lại: nếu hai transaction RR update **cùng một dòng**, transaction thứ hai khi commit gặp lỗi `could not serialize access (40001)` — phải retry. Lưu ý: RR của Postgres **không** chặn được **write skew** (xem dưới).

- **SERIALIZABLE (PG = SSI, Serializable Snapshot Isolation):** xây trên RR + theo dõi các **rw-dependency** (transaction A đọc dữ liệu mà B sắp ghi). Khi phát hiện một "dangerous structure" (chu trình phụ thuộc có thể tạo ra kết quả không thể đạt được bởi bất kỳ thứ tự tuần tự nào), nó abort một transaction với 40001. Đây là khác biệt cốt lõi vs RR: **SERIALIZABLE chặn write skew**.

**Write skew** (anomaly mà RR không chặn): hai bác sĩ cùng on-call, ràng buộc "ít nhất 1 người on-call". Mỗi người đọc thấy "có 2 người", tự off-call. Cả hai transaction đọc snapshot riêng, không đụng cùng dòng → RR cho commit cả hai → vi phạm ràng buộc (0 người on-call). Chỉ SERIALIZABLE (SSI) phát hiện được, vì nó thấy giao tiếp đọc-ghi chéo. Đây là câu hỏi senior phân biệt RR vs SERIALIZABLE.

## 🧪 Ví dụ nâng cao (SQL thật)

### A. Đọc plan: Seq Scan vs Index Scan vs Bitmap Heap Scan

```sql
-- Lấy nhiều dòng rải rác (vài %): planner chọn Bitmap, KHÔNG phải Index Scan
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders WHERE status = 'shipped';
```

```
Bitmap Heap Scan on orders  (cost=215.00..18500.00 rows=42000 ...) (actual rows=41877 ...)
  Recheck Cond: (status = 'shipped'::text)
  Heap Blocks: exact=9210
  ->  Bitmap Index Scan on idx_orders_status  (cost=0.00..204.5 rows=42000 ...)
        Index Cond: (status = 'shipped'::text)
```

Vì sao **Bitmap** chứ không phải Index Scan thuần? Index Scan đọc index → nhảy heap → đọc index → nhảy heap... (random I/O xen kẽ). Khi số dòng lớn, Postgres thay bằng 2 pha: (1) **Bitmap Index Scan** quét index dựng một bitmap đánh dấu *page nào* chứa dòng cần; (2) **Bitmap Heap Scan** đọc các page đó theo **thứ tự vật lý** (gần sequential, ít random). `Recheck Cond` xuất hiện vì bitmap có thể "lossy" (khi quá nhiều page, nó chỉ nhớ page chứ không nhớ dòng) → đọc page xong phải lọc lại điều kiện. Quy luật: **ít dòng → Index Scan, nhiều dòng (nhưng chưa tới mức quét cả bảng) → Bitmap, rất nhiều dòng → Seq Scan**.

### B. Composite index & leftmost-prefix: seek vs filter trong plan

```sql
CREATE INDEX idx_o_user_status_created ON orders (user_id, status, created_at);
ANALYZE orders;

-- Query 1: dùng trọn cả 3 cột để SEEK
EXPLAIN ANALYZE
SELECT * FROM orders WHERE user_id = 5 AND status = 'paid' AND created_at > '2025-01-01';
-- Index Cond: ((user_id = 5) AND (status = 'paid') AND (created_at > '2025-01-01'))  ← cả 3 nằm trong Index Cond

-- Query 2: bỏ qua status → created_at TỤT xuống Filter
EXPLAIN ANALYZE
SELECT * FROM orders WHERE user_id = 5 AND created_at > '2025-01-01';
-- Index Cond: (user_id = 5)
-- Filter: (created_at > '2025-01-01')   ← KHÔNG seek được vì status đứng giữa bị bỏ trống
```

Bài học đọc plan: cột trong **`Index Cond`** = thu hẹp phạm vi quét index (tốt). Cột trong **`Filter`** = vẫn phải đọc rồi vứt (lãng phí). Query 2 cho thấy "lỗ hổng" ở cột giữa (`status`) làm `created_at` mất khả năng seek — đúng quy tắc leftmost-prefix nhìn từ plan thật.

### C. Cố ý tạo deadlock và xem Postgres tự gỡ

```sql
-- Session 1                              | -- Session 2
BEGIN;                                    | BEGIN;
UPDATE accounts SET bal=bal-10            |
  WHERE id=1;  -- khóa dòng id=1          |
                                          | UPDATE accounts SET bal=bal-10
                                          |   WHERE id=2;  -- khóa dòng id=2
UPDATE accounts SET bal=bal+10            |
  WHERE id=2;  -- CHỜ Session 2 nhả id=2  |
                                          | UPDATE accounts SET bal=bal+10
                                          |   WHERE id=1;  -- CHỜ Session 1 → DEADLOCK
```

Sau ~1 giây (`deadlock_timeout`, mặc định 1s), Postgres chạy **thuật toán phát hiện chu trình** trên đồ thị "ai chờ ai" (wait-for graph). Thấy chu trình S1→S2→S1, nó **chọn nạn nhân** (thường transaction phát hiện ra deadlock) và abort:

```
ERROR:  deadlock detected
DETAIL:  Process 1234 waits for ShareLock on transaction 5678; blocked by process 4321.
        Process 4321 waits for ShareLock on transaction 9012; blocked by process 1234.
HINT:  See server log for query details.
```

`SQLSTATE = 40P01`. Transaction nạn nhân bị ROLLBACK, transaction kia chạy tiếp. **Cách diệt:** luôn khóa theo thứ tự id tăng dần — nếu cả hai session đều lock id=1 trước rồi id=2, không thể có chu trình (transaction thứ hai chỉ chờ ở id=1, không giữ id=2). Cộng với **retry** ở tầng app:

```js
async function withDeadlockRetry(fn, max = 3) {
  for (let i = 0; ; i++) {
    try { return await fn(); }
    catch (e) {
      // 40P01 deadlock, 40001 serialization failure
      if ((e.code === '40P01' || e.code === '40001') && i < max) {
        await new Promise(r => setTimeout(r, 50 * 2 ** i)); // exponential backoff
        continue;
      }
      throw e;
    }
  }
}
```

### D. Job queue trên SQL bằng FOR UPDATE SKIP LOCKED

`SKIP LOCKED` biến Postgres thành một message queue đủ tốt cho nhiều hệ thống (không cần Kafka/RabbitMQ cho throughput vừa):

```sql
-- Mỗi worker chạy trong transaction; SKIP LOCKED = bỏ qua job worker khác đang giữ
BEGIN;
UPDATE jobs
SET status = 'processing', locked_at = now()
WHERE id = (
  SELECT id FROM jobs
  WHERE status = 'pending'
  ORDER BY created_at          -- FIFO
  FOR UPDATE SKIP LOCKED       -- không chờ, nhảy sang job tiếp theo
  LIMIT 1
)
RETURNING *;                   -- trả về job đã claim, hoặc 0 dòng nếu hết việc
COMMIT;
```

Vì sao subquery + `FOR UPDATE` ở subquery? Để **claim atomic**: chọn-và-khóa job rảnh trong cùng một câu, hai worker không bao giờ lấy trùng job. Không có `SKIP LOCKED`, 10 worker sẽ **xếp hàng chờ** cùng một dòng đầu tiên → mất song song. Cần index `(status, created_at)` để bước SELECT không Seq Scan.

### E. Keyset pagination vs OFFSET — đo sự khác biệt

```sql
-- OFFSET sâu: vẫn phải tạo và VỨT 500000 dòng
EXPLAIN ANALYZE
SELECT * FROM orders ORDER BY created_at DESC, id DESC LIMIT 20 OFFSET 500000;
-- Index Scan Backward ... rows=500020 ... actual time=412 ms   ← đọc 500020, trả 20

-- Keyset: seek thẳng tới mốc, đọc đúng 20 dòng
EXPLAIN ANALYZE
SELECT * FROM orders
WHERE (created_at, id) < ('2025-03-01 10:00:00', 8842910)
ORDER BY created_at DESC, id DESC
LIMIT 20;
-- Index Scan Backward ... rows=20 ... actual time=0.05 ms      ← O(log n), phẳng mọi trang
```

Điểm tinh tế: `WHERE (created_at, id) < ($1, $2)` là **row-value comparison** (so sánh tuple theo từ điển), không phải `created_at < $1 OR (created_at = $1 AND id < $2)` viết tay (dài, dễ sai, và planner cũ đôi khi không dùng index tốt). Index phải khớp **chính xác chiều sort**: `(created_at DESC, id DESC)` — sai chiều thì planner phải sort lại.

## 🐛 Bẫy & sự cố production

### 1. Index "có mà không chạy" do hàm/type mismatch
**Dấu hiệu:** EXPLAIN cho thấy `Seq Scan` dù cột đã index; trong plan điều kiện nằm ở `Filter` chứ không `Index Cond`.
**Nguyên nhân:** `WHERE lower(email) = 'a@b.com'` (hàm bọc cột), hoặc `WHERE user_id = '5'` khi cột là `bigint` còn tham số là `text` (implicit cast làm cột bị cast → index trên cột gốc vô dụng). Ở Node, bug type-mismatch hay đến từ truyền số dạng string trong driver.
**Fix:** expression index `CREATE INDEX ON users (lower(email))` (và query phải dùng đúng `lower(email)`); hoặc citext; sửa kiểu tham số cho khớp cột.

### 2. Long-running transaction giữ lock & gây bloat
**Dấu hiệu:** autovacuum "chạy mà bảng vẫn phình"; `pg_stat_activity` có transaction `idle in transaction` từ lâu; query trên bảng nóng chậm dần theo ngày.
**Nguyên nhân:** VACUUM **không thể** dọn tuple chết "mới hơn" transaction cũ nhất còn sống — một transaction mở quên commit (thường do code Node `BEGIN` rồi `await` một HTTP call lâu, hoặc quên `COMMIT`/`release`) **chặn dọn dẹp toàn DB**. Tuple chết tích tụ → bloat → chậm.
**Fix:** set `idle_in_transaction_session_timeout`; không bao giờ gọi I/O ngoài (API, message) giữa BEGIN…COMMIT; monitor `xact_start` cũ nhất trong `pg_stat_activity`.

### 3. N+1 ẩn trong serializer/ORM lazy-load
**Dấu hiệu:** một endpoint chậm tuyến tính theo số dòng; query log thấy N câu giống hệt khác mỗi `id`.
**Nguyên nhân khó thấy:** không chỉ vòng lặp tường minh — **lazy relation** của TypeORM/Sequelize kích hoạt query khi serializer truy cập `order.items` lúc `JSON.stringify`. N+1 "vô hình" vì không có vòng `for` rõ ràng.
**Fix:** eager load (`include`/`relations`/`leftJoinAndSelect`), hoặc batch `WHERE IN` + group ở app, GraphQL dùng DataLoader. Phòng ngừa: bật log query trong test, assert số query ≤ ngưỡng.

### 4. OFFSET sâu giết phân trang vô hạn
**Dấu hiệu:** trang đầu nhanh, trang sâu (vô hạn scroll xuống lâu) p99 tăng dần; load càng nhiều càng chậm.
**Nguyên nhân:** OFFSET là O(offset) — luôn duyệt lại từ đầu (xem ví dụ E). Tệ hơn: insert/delete xen giữa làm trang **trùng hoặc sót** dòng.
**Fix:** keyset/cursor pagination trên cột thuộc index + tie-breaker `id`. OFFSET chỉ dùng cho UI "nhảy tới trang N" với tổng số trang nhỏ.

### 5. Thiếu index trên FK → lock leo thang khi xóa/update cha
**Dấu hiệu:** xóa một dòng `users` chậm bất thường, hoặc khóa lan rộng bảng `orders`.
**Nguyên nhân:** Postgres **không tự tạo index cho FK** (chỉ tạo cho PK). Khi xóa/update khóa cha, DB phải quét bảng con để kiểm tra ràng buộc `ON DELETE`. Không index `orders.user_id` → **Seq Scan toàn bảng orders** mỗi lần đụng một user, và giữ lock lâu.
**Fix:** **luôn tạo index thủ công trên mọi cột FK**. Đây là một trong những index "bị quên" phổ biến nhất.

### 6. Connection pool cạn → mọi request treo
**Dấu hiệu:** request đứng im rồi fail hàng loạt với "timeout acquiring connection"/"too many clients"; `pool.totalCount` chạm `max` và đứng yên; DB CPU thấp nhưng app "treo".
**Nguyên nhân:** (a) quên `client.release()` trong nhánh lỗi (rò connection — mỗi lỗi mất 1 connection cho tới khi cạn); (b) tổng `max × số instance > max_connections` của DB; (c) transaction dài giữ connection. 
**Fix:** luôn `release()` trong `finally`; đặt `connectionTimeoutMillis` để fail fast thay vì treo; quy mô lớn đặt **PgBouncer** (transaction pooling) — nhưng nhớ PgBouncer transaction mode **không tương thích** prepared statement/session-level state, cần cấu hình tương ứng ở driver.

## ⚖️ Đánh đổi & quyết định thiết kế

**Normalize vs denormalize.** Normalize là *mặc định đúng*: một nguồn sự thật, không update anomaly. Denormalize là *tối ưu có chủ đích sau khi đo* — chấp nhận phải tự bảo trì consistency (trigger/transaction/job) để đổi lấy đọc nhanh. Lưu ý sắc thái: `orders.customer_name` snapshot **không phải** vi phạm chuẩn hóa — đó là **dữ liệu lịch sử có chủ đích** (tên lúc mua, khác tên hiện tại). Phân biệt "denormalize vì hiệu năng" (phải đồng bộ) với "lưu snapshot nghiệp vụ" (cố ý đóng băng).

**Index nhiều: đọc nhanh, ghi chậm.** Mỗi index thêm một cây phải cập nhật mỗi INSERT/UPDATE/DELETE (trừ HOT update). Trên bảng write-heavy, 8 index có thể làm INSERT chậm gấp nhiều lần. Index cũng tốn RAM cache (cạnh tranh shared_buffers) và đĩa. Quy tắc: index theo **query thật đang chậm**, không theo "phòng xa". Gộp nhiều query vào một composite tận dụng leftmost-prefix thay vì nhiều index đơn. Dùng `pg_stat_user_indexes` tìm index `idx_scan = 0` (chưa bao giờ dùng) để xóa.

**Optimistic vs pessimistic lock.** Pessimistic (`FOR UPDATE`) hợp khi xung đột **cao** và không được phép fail-rồi-retry tốn kém (trừ kho, đặt ghế) — đổi lại giảm concurrency, rủi ro deadlock. Optimistic (cột `version`) hợp khi xung đột **thấp**, đọc nhiều — không giữ lock, nhưng phải có đường retry và chấp nhận một số ghi thất bại phải làm lại. Sai lầm phổ biến: dùng optimistic ở điểm tranh chấp cực cao (vd giảm stock một flash-sale item) → retry storm; ở đó pessimistic hoặc atomic `UPDATE ... WHERE stock >= qty` (đẩy kiểm tra xuống DB) tốt hơn.

**Chọn isolation level.** READ COMMITTED (mặc định) đủ cho 95% nghiệp vụ CRUD, và atomic `UPDATE ... WHERE` đã an toàn dưới mức này. Lên REPEATABLE READ khi cần **đọc một loạt bảng nhất quán** (báo cáo tài chính trong một transaction). Lên SERIALIZABLE khi có **invariant đa dòng** dễ bị write skew (đếm số người on-call, kiểm tra tổng dưới hạn mức) — nhưng **bắt buộc** có retry 40001 và chấp nhận throughput thấp hơn. Đừng "tăng isolation cho chắc": mỗi nấc lên là thêm serialization failure phải xử lý.

## 🎯 Câu hỏi phỏng vấn NÂNG CAO

**Q1: Thêm index làm INSERT chậm — chính xác chậm ở đâu?**
Mỗi index là một B+tree độc lập phải được cập nhật: tìm đúng leaf page rồi chèn entry (giữ sort), có thể gây **page split** (tách page khi đầy) lan ngược lên trên — đắt và phân mảnh. Với 8 index, một INSERT = 1 ghi heap + 8 lần cập nhật cây. Postgres giảm nhẹ bằng **HOT update** (UPDATE không đụng cột index thì khỏi sửa index) — đó là lý do tránh index cột bị update liên tục. Ngoài ra index ăn WAL (mỗi thay đổi index đều ghi WAL để durable) và cạnh tranh buffer cache.

**Q2: SERIALIZABLE khác REPEATABLE READ ở đâu trong Postgres?**
RR của Postgres là Snapshot Isolation: mỗi transaction một snapshot nhất quán, chặn dirty/non-repeatable/phantom, nhưng **không chặn write skew** (hai transaction đọc cùng tập, ghi vào dòng khác nhau, cùng commit, phá vỡ invariant đa dòng). SERIALIZABLE dùng **SSI** — theo dõi rw-dependency giữa các transaction; phát hiện cấu trúc nguy hiểm (chu trình) thì abort một bên với 40001. Trả giá: phải retry. Tóm: RR chặn anomaly trên **cùng một dòng**; SERIALIZABLE chặn cả anomaly **xuyên nhiều dòng**.

**Q3: Phát hiện và xử lý deadlock thế nào trong production?**
Postgres tự phát hiện qua wait-for graph sau `deadlock_timeout` (1s) và abort một nạn nhân với 40P01 — DB **không bao giờ treo vĩnh viễn** vì deadlock. Việc của app: (1) **phòng** bằng khóa cùng thứ tự (id tăng dần) + transaction ngắn (không I/O ngoài giữa BEGIN…COMMIT); (2) **chịu đựng** bằng retry với exponential backoff cho 40P01/40001; (3) **quan sát** qua log (`log_lock_waits = on`) và `pg_stat_activity`/`pg_locks` tìm cặp đang chờ chéo. Deadlock thi thoảng là chấp nhận được nếu có retry; deadlock thường xuyên là tín hiệu sai thứ tự khóa.

**Q4: Khi nào index KHÔNG được dùng dù tồn tại?**
(a) Hàm/biểu thức bọc cột (`lower(email)`) hoặc implicit cast type mismatch — cần expression index hoặc sửa kiểu; (b) leading wildcard `LIKE '%x'` — cần pg_trgm/full-text; (c) selectivity thấp khiến Seq Scan rẻ hơn (planner đúng, không phải bug); (d) statistics cũ làm planner ước lượng sai (`ANALYZE`); (e) cột vi phạm leftmost-prefix của composite index; (f) bảng quá nhỏ — Seq Scan rẻ hơn cả việc mở index. Chẩn đoán bằng EXPLAIN: cột nằm ở `Filter` thay vì `Index Cond` là dấu hiệu không seek được.

**Q5: Một covering index đã tạo nhưng EXPLAIN vẫn thấy Heap Fetches cao — vì sao và sửa thế nào?**
Index Postgres không lưu thông tin visibility (xmin/xmax). Index-Only Scan chỉ "only" khi page tương ứng được đánh dấu all-visible trong **visibility map**, mà VM chỉ cập nhật bởi **VACUUM**. Bảng vừa ghi nhiều có nhiều page chưa all-visible → vẫn phải về heap kiểm tra (Heap Fetches). Fix: `VACUUM table`. Đây là phân biệt người hiểu MVCC vs người học vẹt "covering = nhanh".

**Q6: Vì sao UPDATE một dòng nhiều lần làm bảng và index phình to (bloat)?**
Postgres MVCC không update in-place: mỗi UPDATE tạo tuple mới, đánh dấu tuple cũ chết. Tuple chết chỉ được thu hồi bởi VACUUM, mà VACUUM không thể dọn tuple "trẻ hơn" transaction cũ nhất còn sống → một long-running transaction chặn dọn dẹp toàn DB. Bloat làm mỗi lần đọc phải lướt qua xác chết. Giảm bằng: tránh transaction dài, để autovacuum chạy đủ tích cực, dùng HOT update (không index cột hay đổi), `pg_repack` khi đã bloat nặng.

**Q7: 5 instance Node mỗi pool max 30, DB max_connections 100 — sai ở đâu, sửa sao mà không giảm throughput?**
5 × 30 = 150 > 100 → khi cao tải sẽ "too many clients (53300)". Giảm pool xuống <20/instance là cách nhanh, nhưng pool to thường **không** tăng throughput (DB chỉ chạy song song hữu hạn theo core/đĩa; quá nhiều connection gây context switch + tranh chấp lock). Giải pháp đúng quy mô lớn: **PgBouncer transaction pooling** — hàng nghìn client app dùng chung vài chục connection thật tới Postgres, vì mỗi transaction ngắn chỉ "mượn" connection trong khoảnh khắc. Cảnh báo: transaction mode phá prepared statement, cần cấu hình driver phù hợp.

**Q8: Atomic `UPDATE ... WHERE stock >= qty` có cần FOR UPDATE / transaction không? Vì sao nó đã an toàn?**
Không cần lock tường minh. Một câu UPDATE đơn là atomic; dưới READ COMMITTED, khi hai transaction tranh cùng dòng, transaction thứ hai **chờ** lock dòng, và khi được chạy nó **re-evaluate** điều kiện `WHERE stock >= qty` trên phiên bản mới nhất (EvalPlanQual). Nếu transaction trước đã làm stock < qty, điều kiện không khớp → 0 dòng bị update → app trả "hết hàng". Vậy việc kiểm-tra-rồi-trừ gói trong **một câu** đẩy được race condition xuống DB, không bao giờ trừ quá. Cần FOR UPDATE/transaction chỉ khi logic trải qua **nhiều câu** (đọc rồi mới quyết định rồi mới ghi).

## 📚 Đọc thêm

- **PostgreSQL Docs — MVCC** (`Concurrency Control`) và **Transaction Isolation**: nguồn gốc về snapshot, SSI, write skew.
- **PostgreSQL Docs — Index Types / Indexes and ORDER BY / Index-Only Scans**: covering index, visibility map.
- **`Use The Index, Luke!`** (use-the-index-luke.com) — kinh thánh về B-tree, leftmost-prefix, sargable predicate, pagination.
- **"Designing Data-Intensive Applications" (Kleppmann), Ch.7 Transactions**: phân tích anomaly + write skew rõ nhất, độc lập DB.
- **PgBouncer docs** — pooling modes (session/transaction/statement) và giới hạn của mỗi mode.
- **`pg_stat_statements`, `auto_explain`, `pgbadger`** — bộ công cụ săn slow query thực chiến.
- **`EXPLAIN` glossary** của Postgres + **explain.dalibo.com** / **explain.depesz.com** — dán plan vào để đọc trực quan.
