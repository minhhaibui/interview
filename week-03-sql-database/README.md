# Tuần 3: SQL Database (PostgreSQL/MySQL)

## 🎯 Mục tiêu tuần này

- Thiết kế schema đúng: hiểu **normalization (1NF–3NF)** và biết **khi nào nên denormalize** có chủ đích.
- Thành thạo **JOIN các loại**, **index** (B-tree, composite, covering) và nhận diện được khi nào index **không** được dùng.
- Đọc được **query plan** qua `EXPLAIN / EXPLAIN ANALYZE` và tối ưu slow query thật.
- Hiểu sâu **transaction, ACID, isolation levels** và các anomaly (dirty read, non-repeatable read, phantom); xử lý **locking & deadlock**.
- Vận hành DB từ Node.js đúng cách: **connection pooling, N+1 problem, pagination offset vs cursor, trade-offs của ORM** (Sequelize/TypeORM/Prisma).

## 📚 Lý thuyết

### Ngày 1-2: Normalization, JOIN, Index

#### 1. Normalization (1NF → 3NF) và khi nào denormalize

- **1NF**: mỗi cột là giá trị nguyên tử (atomic), không lặp nhóm cột. Vi phạm: cột `phone_numbers = '090...,098...'` → tách bảng `user_phones`.
- **2NF**: đạt 1NF + mọi cột non-key phụ thuộc **toàn bộ** khóa chính (chỉ có ý nghĩa với composite key). Vi phạm: bảng `order_items(order_id, product_id, product_name)` — `product_name` chỉ phụ thuộc `product_id` → tách sang bảng `products`.
- **3NF**: đạt 2NF + không có phụ thuộc bắc cầu (non-key phụ thuộc non-key khác). Vi phạm: `employees(id, department_id, department_name)` — `department_name` phụ thuộc `department_id` → tách bảng `departments`.

Lợi ích chuẩn hóa: không dư thừa, không update anomaly (sửa 1 chỗ là đủ). Chi phí: nhiều JOIN khi đọc.

**Khi nào denormalize (có chủ đích, đo đạc trước):**

- Hệ thống **read-heavy**, JOIN nhiều bảng lớn làm chậm query nóng → nhúng sẵn giá trị (vd `orders.customer_name` snapshot tại thời điểm đặt hàng — vừa nhanh vừa đúng nghiệp vụ lưu lịch sử).
- **Cột tổng hợp/counter**: `posts.comment_count` thay vì `COUNT(*)` mỗi lần (cập nhật qua trigger/transaction/job).
- Bảng báo cáo/materialized view cho analytics.
- Đánh đổi: phải tự đảm bảo consistency (trigger, transaction, event) — chấp nhận độ phức tạp ghi để đổi tốc độ đọc.

#### 2. JOIN các loại

```sql
-- INNER JOIN: chỉ dòng khớp ở CẢ HAI bảng
SELECT u.name, o.total FROM users u
JOIN orders o ON o.user_id = u.id;

-- LEFT JOIN: tất cả dòng bảng trái + dòng khớp bảng phải (không khớp → NULL)
-- Câu kinh điển "tìm user CHƯA có order":
SELECT u.* FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE o.id IS NULL;

-- RIGHT JOIN: ngược lại LEFT (ít dùng, viết lại bằng LEFT cho dễ đọc)
-- FULL OUTER JOIN: hợp của LEFT + RIGHT (MySQL không hỗ trợ trực tiếp → UNION 2 query)
-- CROSS JOIN: tích Descartes (mọi cặp) — cẩn thận bùng nổ số dòng
-- SELF JOOIN: bảng join chính nó (vd employees.manager_id → employees.id)
```

Bẫy phỏng vấn hay gặp: đặt điều kiện lọc bảng phải ở `WHERE` thay vì `ON` trong LEFT JOIN sẽ **biến nó thành INNER JOIN** (vì NULL không thỏa WHERE):

```sql
-- SAI Ý ĐỒ: mất các user chưa có order
SELECT u.*, o.total FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE o.status = 'paid';
-- ĐÚNG: điều kiện của bảng phải đưa vào ON
SELECT u.*, o.total FROM users u
LEFT JOIN orders o ON o.user_id = u.id AND o.status = 'paid';
```

Cách engine thực thi join (nên biết khi đọc plan): **Nested Loop** (tốt khi 1 bên nhỏ + có index bên kia), **Hash Join** (build hash table từ bảng nhỏ, tốt cho equi-join bảng lớn), **Merge Join** (2 bên đã sort theo khóa join).

#### 3. Index

**B-tree** (mặc định ở Postgres/MySQL InnoDB): cây cân bằng, leaf node chứa giá trị đã **sắp xếp** + con trỏ tới dòng → tìm kiếm O(log n), hỗ trợ `=`, `<`, `>`, `BETWEEN`, `ORDER BY`, và `LIKE 'abc%'` (prefix). Trong InnoDB, bảng tự nó là **clustered index** theo primary key; secondary index trỏ về PK (nên PK to làm mọi index to theo).

**Composite index** — quy tắc **leftmost prefix** (câu hỏi bắt buộc phải trả lời được):

```sql
CREATE INDEX idx_orders_user_status_created ON orders (user_id, status, created_at);

-- DÙNG ĐƯỢC index:
WHERE user_id = 5
WHERE user_id = 5 AND status = 'paid'
WHERE user_id = 5 AND status = 'paid' AND created_at > '2026-01-01'
WHERE user_id = 5 ORDER BY status, created_at   -- tận dụng cả sort

-- KHÔNG dùng được (thiếu cột đầu):
WHERE status = 'paid'
WHERE created_at > '2026-01-01'
-- Dùng MỘT PHẦN: WHERE user_id = 5 AND created_at > ... (chỉ dùng được cột user_id)
```

Thứ tự cột: cột equality và selectivity (độ chọn lọc) cao đứng trước, cột range đứng cuối.

**Covering index**: index chứa **đủ mọi cột query cần** → đọc thẳng từ index, không cần về bảng (Postgres: *Index Only Scan*, có thể thêm cột "chở theo" bằng `INCLUDE`):

```sql
CREATE INDEX idx_orders_cover ON orders (user_id, created_at) INCLUDE (total); -- Postgres
SELECT created_at, total FROM orders WHERE user_id = 5; -- Index Only Scan, cực nhanh
```

**Khi nào index KHÔNG được dùng (các bẫy kinh điển):**

1. **Hàm/biểu thức trên cột**: `WHERE YEAR(created_at) = 2026`, `WHERE LOWER(email) = ...` → viết lại dạng range (`created_at >= '2026-01-01' AND < '2027-01-01'`) hoặc tạo **expression index** (`CREATE INDEX ON users (LOWER(email))`).
2. **Leading wildcard**: `LIKE '%abc'` (B-tree sort theo prefix) → cần full-text search/trigram (pg_trgm).
3. **Implicit type cast**: cột VARCHAR so sánh với số `WHERE phone = 0901234567` → cast cả cột, index vô dụng.
4. **Selectivity thấp**: cột `status` chỉ có 2-3 giá trị mà query lấy 50% bảng → planner chọn seq scan (đúng đắn, vì random I/O qua index đắt hơn đọc tuần tự).
5. **`OR` giữa các cột khác nhau** không có index riêng từng cột; **`!=` / `NOT IN`** thường quét gần cả bảng.
6. **Thống kê (statistics) cũ** → planner ước lượng sai: chạy `ANALYZE`.

Trade-off của index: tăng tốc đọc nhưng **chậm write** (mỗi INSERT/UPDATE/DELETE phải cập nhật mọi index) và tốn dung lượng — không phải "cứ chậm là thêm index".

### Ngày 3-4: EXPLAIN, Transaction & ACID, Isolation Levels, Locking

#### 1. Đọc query plan với EXPLAIN / EXPLAIN ANALYZE

- `EXPLAIN`: chỉ hiển thị **kế hoạch dự kiến** + cost ước lượng (không chạy query).
- `EXPLAIN ANALYZE`: **chạy thật** và in thời gian thực tế, số dòng thực tế (cẩn thận với INSERT/UPDATE — bọc trong transaction rồi ROLLBACK).

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders WHERE user_id = 5 ORDER BY created_at DESC LIMIT 10;
```

```
Limit (cost=0.43..12.20 rows=10 width=64) (actual time=0.041..0.078 rows=10 loops=1)
  -> Index Scan Backward using idx_orders_user_created on orders
       (cost=0.43..118.50 rows=98 width=64) (actual time=0.039..0.072 rows=10 loops=1)
       Index Cond: (user_id = 5)
  Buffers: shared hit=13
Planning Time: 0.190 ms
Execution Time: 0.110 ms
```

Cách đọc (đọc từ node **sâu nhất ra ngoài**):

- **Node type**: `Seq Scan` (quét cả bảng — đỏ nếu bảng lớn + lọc ít dòng), `Index Scan` (dò index rồi về bảng lấy dòng), `Index Only Scan` (covering — không về bảng), `Bitmap Heap Scan` (gom nhiều vị trí từ index rồi đọc theo block), `Nested Loop / Hash Join / Merge Join`.
- **`rows` ước lượng vs `actual rows`**: lệch hàng trăm/nghìn lần → statistics sai → `ANALYZE table`; planner có thể chọn sai join strategy vì lệch này.
- **`loops`**: node bị lặp bao nhiêu lần (Nested Loop với loops=10000 × vài ms = thủ phạm).
- **`Buffers: shared hit/read`**: hit = lấy từ cache, read = đọc đĩa.
- MySQL: `EXPLAIN` xem cột `type` (tốt dần: ALL → index → range → ref → eq_ref → const), `key` (index được chọn), `rows`, `Extra` (`Using filesort`, `Using temporary` là cờ đỏ); MySQL 8.0.18+ có `EXPLAIN ANALYZE`.

#### 2. Transaction & ACID

- **Atomicity**: tất cả hoặc không gì cả — lỗi giữa chừng thì ROLLBACK toàn bộ.
- **Consistency**: transaction đưa DB từ trạng thái hợp lệ này sang trạng thái hợp lệ khác (constraint, FK, trigger được tôn trọng).
- **Isolation**: các transaction đồng thời không "giẫm chân" nhau — mức độ tùy isolation level.
- **Durability**: đã COMMIT là không mất kể cả mất điện (WAL/redo log fsync trước khi báo thành công).

```js
// Transaction đúng cách với pg (node-postgres) — chuyển tiền
const client = await pool.connect();   // PHẢI cùng 1 client cho cả transaction
try {
  await client.query('BEGIN');
  const { rows } = await client.query(
    'UPDATE accounts SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING balance',
    [amount, fromId]
  );
  if (rows.length === 0) throw new Error('Insufficient balance');
  await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, toId]);
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();                    // luôn trả connection về pool
}
```

#### 3. Isolation levels & anomalies

| Anomaly | Mô tả |
|---|---|
| **Dirty read** | Đọc được dữ liệu CHƯA commit của transaction khác (nó có thể rollback!) |
| **Non-repeatable read** | Cùng 1 dòng, đọc 2 lần trong 1 transaction ra 2 giá trị khác nhau (bị transaction khác UPDATE + commit xen giữa) |
| **Phantom read** | Cùng 1 điều kiện WHERE, đọc 2 lần ra **tập dòng** khác nhau (bị INSERT/DELETE xen giữa) |
| **Lost update** | 2 transaction cùng read-modify-write, bản ghi sau đè mất bản ghi trước |

| Level | Dirty read | Non-repeatable | Phantom |
|---|---|---|---|
| READ UNCOMMITTED | Có thể | Có thể | Có thể |
| READ COMMITTED | Không | Có thể | Có thể |
| REPEATABLE READ | Không | Không | Có thể* |
| SERIALIZABLE | Không | Không | Không |

Ghi chú thực chiến: **Postgres** mặc định READ COMMITTED, không bao giờ có dirty read kể cả khai báo READ UNCOMMITTED (MVCC); REPEATABLE READ của Postgres dùng snapshot nên thực tế **chặn cả phantom**, đổi lại có thể ném `serialization failure` (40001) phải retry. **MySQL InnoDB** mặc định REPEATABLE READ, chống phantom phần lớn nhờ **gap lock / next-key lock**. SERIALIZABLE an toàn nhất nhưng throughput thấp nhất — app phải có **retry logic**.

Cả hai DB dùng **MVCC** (Multi-Version Concurrency Control): reader không block writer, writer không block reader — mỗi transaction đọc từ snapshot phiên bản dữ liệu phù hợp.

#### 4. Locking: pessimistic vs optimistic, deadlock

**Pessimistic** — khóa trước, làm sau (xung đột cao, transaction ngắn):

```sql
BEGIN;
SELECT * FROM seats WHERE id = 7 AND status = 'available' FOR UPDATE;
-- transaction khác SELECT ... FOR UPDATE dòng này sẽ CHỜ đến khi ta commit
UPDATE seats SET status = 'booked', user_id = 5 WHERE id = 7;
COMMIT;
```

Biến thể hữu ích: `FOR UPDATE NOWAIT` (lỗi ngay thay vì chờ), `FOR UPDATE SKIP LOCKED` (bỏ qua dòng đang khóa — pattern **job queue trên SQL** kinh điển), `FOR SHARE` (khóa đọc chung).

**Optimistic** — không khóa, kiểm tra version lúc ghi (xung đột thấp, đọc nhiều):

```sql
-- Bảng có cột version INT
UPDATE products SET stock = stock - 1, version = version + 1
WHERE id = 10 AND version = 42;
-- affectedRows = 0 → có người sửa trước → app retry (đọc lại, tính lại, update lại)
```

**Deadlock**: T1 khóa A chờ B, T2 khóa B chờ A → DB tự phát hiện và **kill một transaction** (Postgres: error 40P01; MySQL: 1213). Phòng tránh: (1) mọi nơi **khóa theo cùng một thứ tự** (vd luôn lock account id nhỏ trước), (2) transaction ngắn — không gọi API/await việc khác giữa BEGIN...COMMIT, (3) app luôn có **retry với backoff** cho lỗi deadlock/serialization.

### Ngày 5-6: Connection Pooling, N+1, Pagination, ORM, Tối ưu Slow Query

#### 1. Connection pooling từ Node.js

Mỗi connection Postgres là 1 process phía server (~vài MB) và handshake TCP + auth tốn hàng chục ms → tạo connection mỗi request là tự sát. **Pool** giữ sẵn N connection tái sử dụng:

```js
const { Pool } = require('pg');
const pool = new Pool({
  max: 20,                       // số connection tối đa
  idleTimeoutMillis: 30_000,     // đóng connection idle
  connectionTimeoutMillis: 5_000 // chờ lấy connection từ pool tối đa 5s → fail fast
});

// Query đơn lẻ: pool.query() tự mượn-trả
const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
// Transaction: PHẢI pool.connect() giữ 1 client xuyên suốt (xem ví dụ ở trên)
```

Sizing thực tế: max pool × số instance app **phải <** `max_connections` của DB (Postgres mặc định 100, trừ hao cho admin/migration). Công thức tham khảo của HikariCP: `connections ≈ cores × 2 + số đĩa` — pool to KHÔNG đồng nghĩa nhanh hơn, thường ngược lại. Quy mô lớn dùng **PgBouncer** (transaction pooling) đứng giữa. Bug Node kinh điển: quên `client.release()` → pool cạn → mọi request treo ở `connectionTimeout`.

#### 2. N+1 query problem

1 query lấy N bản ghi cha, rồi **lặp N query** lấy con của từng bản ghi:

```js
// SAI: 1 + N queries (N = 100 → 101 round-trip)
const users = await db('users').limit(100);
for (const u of users) {
  u.orders = await db('orders').where('user_id', u.id); // chạy 100 lần!
}

// ĐÚNG cách 1: JOIN (1 query, tự gom nhóm trong JS)
const rows = await db('users')
  .leftJoin('orders', 'orders.user_id', 'users.id')
  .select('users.*', 'orders.id as order_id', 'orders.total');

// ĐÚNG cách 2: 2 queries + WHERE IN (thường gọn nhất)
const users2 = await db('users').limit(100);
const orders = await db('orders').whereIn('user_id', users2.map(u => u.id));
const byUser = Map.groupBy(orders, o => o.user_id);
users2.forEach(u => (u.orders = byUser.get(u.id) ?? []));
```

Với ORM: Sequelize `include`, TypeORM `relations`/QueryBuilder `leftJoinAndSelect`, Prisma `include` (Prisma tự dùng chiến lược batch WHERE IN). GraphQL: **DataLoader** batch các lookup trong cùng tick. Cách phát hiện: bật query log, thấy hàng loạt query giống nhau chỉ khác tham số.

#### 3. Pagination: OFFSET vs Cursor (keyset)

```sql
-- OFFSET: đơn giản, nhảy trang tùy ý, NHƯNG
SELECT * FROM orders ORDER BY created_at DESC LIMIT 20 OFFSET 100000;
-- DB vẫn phải đọc và BỎ ĐI 100000 dòng đầu → càng sâu càng chậm (O(offset))
-- + dữ liệu mới insert làm trang bị lệch (trùng/sót dòng)

-- CURSOR (keyset): client gửi giá trị mốc của trang trước
SELECT * FROM orders
WHERE (created_at, id) < ($1, $2)        -- tuple comparison, id phá hòa khi trùng created_at
ORDER BY created_at DESC, id DESC
LIMIT 20;
-- Nhảy thẳng vào index → O(log n) bất kể trang sâu bao nhiêu, ổn định khi có insert mới
```

Cursor trả về client nên encode (base64 của `created_at|id`). Nhược điểm cursor: không nhảy đến "trang 57" tùy ý, cột sort phải thuộc index và xác định duy nhất (thêm `id` tie-breaker). API hiện đại (Facebook, Stripe, Slack) đều dùng cursor.

#### 4. ORM trade-offs (Sequelize / TypeORM / Prisma)

| | Sequelize | TypeORM | Prisma |
|---|---|---|---|
| Phong cách | Active Record, JS thuần lâu đời | Data Mapper/Active Record, decorator, hợp NestJS | Schema file riêng → generate client, type-safe nhất |
| Type safety | Yếu (types bolt-on) | Khá (nhưng nhiều chỗ lỏng) | Rất mạnh (autocomplete theo schema) |
| Migration | sequelize-cli (tự viết nhiều) | Tự generate từ entity (cần soát lại) | `prisma migrate` mượt, declarative |
| Raw/linh hoạt | `sequelize.query` | QueryBuilder khá mạnh | `$queryRaw` (tagged template, an toàn injection) |
| Điểm trừ | API cũ, dễ sinh query kém | Bug/độ ổn định từng tai tiếng, lazy relation dễ N+1 | Trừu tượng cao, join phức tạp/window function phải raw; engine từng nặng |

Trade-off chung của ORM: **tăng tốc phát triển, type-safe, chống injection mặc định, migration**; đổi lại **che giấu SQL** (dễ sinh query tệ mà không biết), khó với query phân tích phức tạp, và tốn chi phí mapping. Lời khuyên phỏng vấn: dùng ORM cho CRUD 80%, nhưng **phải biết bật query log, đọc SQL nó sinh ra, và sẵn sàng viết raw SQL** cho 20% query nóng. Query builder (Knex) là điểm cân bằng giữa hai thế giới.

#### 5. Quy trình tối ưu slow query (checklist thực chiến)

1. **Tìm thủ phạm**: bật `slow_query_log` (MySQL) / `log_min_duration_statement` (Postgres), hoặc extension `pg_stat_statements` (top query theo total_time).
2. **`EXPLAIN ANALYZE`** query đó với tham số thật.
3. Nhìn theo thứ tự: Seq Scan trên bảng lớn? → thiếu index / index không dùng được (hàm trên cột? cast? leading wildcard?). Estimate lệch actual xa? → `ANALYZE`. Filesort/temporary? → index phục vụ ORDER BY. Nested loop lặp khổng lồ? → thiếu index khóa join.
4. **Sửa query trước, thêm index sau**: chỉ SELECT cột cần (tránh `SELECT *` để mở cửa Index Only Scan), viết lại điều kiện sargable, tách OR thành UNION nếu cần.
5. Cân nhắc tầng trên: cache (Redis) cho dữ liệu đọc nhiều ít đổi, denormalize/materialized view cho báo cáo, pagination cursor thay offset sâu.
6. **Đo lại** bằng EXPLAIN ANALYZE + load test — tối ưu không đo là đoán.

## 💬 Top 15 câu hỏi phỏng vấn thường gặp

**Q1: Giải thích 1NF, 2NF, 3NF bằng ví dụ ngắn?**
**A:** 1NF: mỗi ô là giá trị nguyên tử — không lưu `'sách,bút'` trong 1 cột. 2NF: non-key phụ thuộc toàn bộ composite key — `product_name` trong `order_items(order_id, product_id)` chỉ phụ thuộc `product_id` nên phải tách. 3NF: không phụ thuộc bắc cầu — `department_name` phụ thuộc `department_id` chứ không phụ thuộc trực tiếp `employee_id`, tách sang bảng `departments`.

**Q2: Khi nào bạn chủ động denormalize?**
**A:** Khi hệ read-heavy và JOIN trở thành bottleneck đã đo đạc được: cột counter (`comment_count`), snapshot dữ liệu lịch sử (`orders.customer_name` tại thời điểm mua), bảng/materialized view cho báo cáo. Đánh đổi là phải tự duy trì consistency qua transaction/trigger/job — chấp nhận ghi phức tạp để đọc nhanh.

**Q3: LEFT JOIN với điều kiện ở WHERE và ở ON khác gì nhau?**
**A:** Điều kiện trên bảng phải đặt ở `ON` được áp trước khi join nên vẫn giữ đủ dòng bảng trái (không khớp thì NULL); đặt ở `WHERE` thì lọc sau khi join, dòng NULL bị loại — LEFT JOIN âm thầm thành INNER JOIN. Đây là bug logic rất phổ biến trong báo cáo.

**Q4: Composite index `(a, b, c)` dùng được cho những query nào?**
**A:** Theo quy tắc leftmost prefix: `WHERE a=?`, `a=? AND b=?`, `a=? AND b=? AND c=?` dùng trọn; `WHERE b=?` hay `c=?` đứng riêng thì không dùng được. Cột range nên đặt cuối vì sau cột range các cột tiếp theo trong index không còn được dùng để seek; index này còn phục vụ `ORDER BY a, b`.

**Q5: Covering index là gì, nhận biết trong query plan thế nào?**
**A:** Là index chứa đủ mọi cột mà query cần nên DB đọc thẳng từ index, không phải về bảng lấy dòng — Postgres hiển thị `Index Only Scan` (hỗ trợ `INCLUDE` cột chở theo), MySQL hiển thị `Using index` trong cột Extra. Hiệu quả lớn với query nóng vì giảm hẳn I/O, đổi lại index to hơn.

**Q6: Kể các trường hợp có index mà query vẫn không dùng?**
**A:** Hàm/biểu thức bọc cột (`LOWER(email)=...` cần expression index), `LIKE '%x'` leading wildcard, implicit cast khác kiểu dữ liệu, selectivity thấp khiến planner chọn seq scan rẻ hơn, và statistics cũ làm ước lượng sai (chạy ANALYZE). Vì vậy chuẩn đoán phải bằng EXPLAIN chứ không đoán.

**Q7: EXPLAIN khác EXPLAIN ANALYZE thế nào? Đọc plan thì nhìn gì đầu tiên?**
**A:** EXPLAIN chỉ in kế hoạch và cost ước lượng; EXPLAIN ANALYZE chạy thật, in thời gian và số dòng thực tế. Nhìn đầu tiên: node tốn thời gian nhất (đọc từ trong ra), Seq Scan trên bảng lớn, độ lệch giữa `rows` ước lượng và `actual rows` (lệch xa = statistics sai = planner chọn sai chiến lược), và `loops` của Nested Loop.

**Q8: Trình bày 4 anomaly của concurrent transaction và level nào ngăn được?**
**A:** Dirty read (đọc dữ liệu chưa commit) — chặn từ READ COMMITTED; non-repeatable read (đọc lại 1 dòng ra giá trị khác) — chặn từ REPEATABLE READ; phantom (đọc lại 1 điều kiện ra tập dòng khác) — chặn ở SERIALIZABLE (Postgres RR thực tế cũng chặn nhờ snapshot, InnoDB nhờ gap lock); lost update — tránh bằng locking hoặc optimistic versioning. Level càng cao càng an toàn nhưng throughput giảm và phải retry serialization error.

**Q9: MVCC là gì và lợi ích chính?**
**A:** Multi-Version Concurrency Control — DB giữ nhiều phiên bản của dòng, mỗi transaction đọc từ snapshot nhất quán của nó. Nhờ vậy reader không block writer và ngược lại, throughput cao hơn hẳn khóa đọc truyền thống; chi phí là phải dọn phiên bản cũ (VACUUM ở Postgres, purge undo log ở InnoDB).

**Q10: Pessimistic vs optimistic locking — khi nào dùng cái nào?**
**A:** Pessimistic (`SELECT ... FOR UPDATE`) khóa trước khi sửa, hợp khi xung đột cao và nghiệp vụ không được fail (trừ kho, đặt ghế); đổi lại giảm concurrency và có rủi ro deadlock. Optimistic (cột version, `UPDATE ... WHERE version = ?`) không khóa, kiểm tra lúc ghi và retry khi affectedRows = 0 — hợp hệ đọc nhiều ghi ít, xung đột thấp.

**Q11: Deadlock xảy ra thế nào và phòng tránh ra sao?**
**A:** Hai transaction giữ khóa của nhau và chờ chéo (T1 giữ A chờ B, T2 giữ B chờ A); DB phát hiện và kill một bên. Phòng tránh: luôn khóa tài nguyên theo cùng một thứ tự (vd id tăng dần), giữ transaction ngắn (không await API ngoài trong transaction), và app luôn có retry với backoff cho error code deadlock (MySQL 1213, Postgres 40P01).

**Q12: Vì sao cần connection pool? Pool max bao nhiêu là hợp lý?**
**A:** Tạo connection mới tốn handshake + auth (chục ms) và mỗi connection Postgres là một process tốn RAM — pool tái sử dụng connection và giới hạn tải lên DB. Sizing: tổng (max pool × số instance) phải nhỏ hơn `max_connections`; pool quá to còn làm chậm vì context switch — bắt đầu nhỏ (10-20/instance), đo rồi chỉnh, quy mô lớn thêm PgBouncer.

**Q13: N+1 query là gì, phát hiện và sửa thế nào?**
**A:** Lấy N bản ghi cha rồi lặp N query lấy dữ liệu con — 101 round-trip thay vì 1-2. Phát hiện bằng query log/APM thấy hàng loạt query giống nhau khác mỗi tham số. Sửa: JOIN, hoặc batch bằng `WHERE id IN (...)` rồi group ở app, hoặc dùng eager loading của ORM (`include`/`relations`), GraphQL thì dùng DataLoader.

**Q14: Offset pagination có vấn đề gì và cursor pagination giải quyết ra sao?**
**A:** `OFFSET 100000` buộc DB đọc và vứt 100000 dòng → càng sâu càng chậm, và dữ liệu insert mới làm trang bị trùng/sót. Cursor (keyset) dùng `WHERE (sort_col, id) < (giá_trị_mốc) ORDER BY ... LIMIT n` để seek thẳng vào index — O(log n) bất kể độ sâu và ổn định khi có ghi mới; đổi lại không nhảy trang tùy ý được.

**Q15: Bạn xử lý một API đang chậm do query thế nào, kể quy trình?**
**A:** Xác định query thủ phạm bằng pg_stat_statements/slow query log và APM; chạy EXPLAIN ANALYZE với tham số thật; tìm Seq Scan bất thường, estimate lệch, filesort, nested loop lặp lớn. Sửa theo thứ tự: viết lại query cho sargable + bớt cột, thêm/sửa index (composite/covering), rồi mới đến cache/denormalize; cuối cùng đo lại trước-sau và theo dõi tác động lên write.

## 💪 Bài tập thực hành (bắt buộc)

> Setup chung: `docker run -d --name pg -e POSTGRES_PASSWORD=secret -p 5432:5432 postgres:16`. Dùng Node.js với `pg` hoặc `knex`. Schema mẫu: `users`, `products`, `orders`, `order_items`.

### Bài 1: Seed dữ liệu lớn + JOIN cơ bản (Dễ)

**Đề bài:** Viết script Node.js `seed.js` sinh **1 triệu orders**, 100k users, 10k products, 3 triệu order_items (dùng `generate_series` của Postgres hoặc batch insert 10k dòng/lần từ Node — KHÔNG insert từng dòng). Sau đó viết 4 query: (a) top 10 user chi tiêu nhiều nhất, (b) user chưa từng đặt hàng (LEFT JOIN ... IS NULL), (c) doanh thu theo tháng năm 2025, (d) sản phẩm chưa từng được bán.

**Yêu cầu output:** Seed xong dưới 2 phút; 4 query trả kết quả đúng kèm thời gian chạy (`\timing` trong psql hoặc `console.time`).
**Gợi ý:** `INSERT INTO orders SELECT ... FROM generate_series(1, 1000000)` nhanh hơn mọi cách từ Node; nếu seed từ Node thì dùng 1 transaction + multi-row VALUES.

### Bài 2: Săn index với EXPLAIN ANALYZE (Trung bình)

**Đề bài:** Trên dữ liệu bài 1, lấy query "đơn hàng của 1 user theo status, mới nhất trước": `SELECT id, total, created_at FROM orders WHERE user_id = $1 AND status = 'paid' ORDER BY created_at DESC LIMIT 20`. (a) EXPLAIN ANALYZE khi chưa có index — ghi lại plan + thời gian. (b) Thêm index đơn `(user_id)`, đo lại. (c) Thêm composite `(user_id, status, created_at DESC)`, đo lại. (d) Biến nó thành covering index để đạt Index Only Scan. (e) Chứng minh 2 trường hợp index bị vô hiệu: `WHERE DATE(created_at) = ...` và `WHERE status = 'paid'` (không có user_id).

**Yêu cầu output:** Bảng so sánh 4 giai đoạn: node type, thời gian, buffers; mỗi giai đoạn 1-2 câu giải thích vì sao nhanh hơn.
**Gợi ý:** Sau khi tạo index chạy `ANALYZE orders` và `VACUUM` để Index Only Scan hoạt động (visibility map); xem `Buffers: shared hit` giảm dần qua các giai đoạn.

### Bài 3: API chuyển tiền — transaction, lock, deadlock (Trung bình–Khó)

**Đề bài:** Viết Express API `POST /transfer {fromId, toId, amount}` dùng `pg`: transaction + `SELECT ... FOR UPDATE`, kiểm tra số dư, ghi bảng `transactions` log. Sau đó viết script `stress.js` bắn 200 transfer đồng thời giữa 10 account theo cặp ngẫu nhiên 2 chiều (A→B và B→A trộn lẫn) để **tự gây deadlock**. Cuối cùng sửa: (1) lock theo thứ tự id tăng dần, (2) retry tối đa 3 lần khi gặp error code `40P01`/`40001`.

**Yêu cầu output:** Trước fix: log xuất hiện deadlock error từ Postgres. Sau fix: 200 request đều thành công hoặc fail hợp lệ (thiếu số dư), và **tổng tiền toàn hệ thống không đổi** (query kiểm chứng trước/sau).
**Gợi ý:** Để gây deadlock dễ, trong transaction lock account thứ nhất rồi `await sleep(50)` trước khi lock account thứ hai.

### Bài 4: Diệt N+1 + pagination cursor (Khó)

**Đề bài:** Viết endpoint `GET /api/users/:id/orders?limit=20&cursor=...` trả về orders kèm items và product name. Phiên bản 1 (cố ý xấu): lặp từng order query items, lặp từng item query product, dùng OFFSET — log số query/request. Phiên bản 2: tối đa **3 query** (orders theo cursor keyset trên `(created_at, id)`, items bằng `WHERE order_id IN`, products bằng `WHERE id IN`), cursor encode base64. Benchmark cả hai bằng autocannon ở trang nông và "trang sâu" (offset 500k vs cursor tương đương).

**Yêu cầu output:** Bảng: số query/request (V1 ≈ 1+20+60 vs V2 = 3), latency p99 trang nông và trang sâu của cả 2 bản; response có `nextCursor` hoạt động đúng (gọi liên tiếp không trùng/sót dòng kể cả khi vừa insert order mới).
**Gợi ý:** Đếm query bằng cách wrap `pool.query` hoặc bật `log_statement = 'all'`; tuple comparison `WHERE (created_at, id) < ($1, $2)` cần index `(created_at DESC, id DESC)` khớp chiều sort.

### Bài 5: Tổng lực tối ưu slow query + so sánh ORM (Khó)

**Đề bài:** Cho query báo cáo: "top 20 sản phẩm theo doanh thu 90 ngày gần nhất, kèm % thay đổi so với 90 ngày trước đó". (a) Viết bằng raw SQL (CTE + window function hoặc 2 aggregate có FILTER), tối ưu đến khi chạy < 1s trên dữ liệu bài 1 — ghi lại hành trình EXPLAIN ANALYZE từng bước (index nào thêm, vì sao). (b) Viết lại cùng logic bằng Prisma hoặc Sequelize ở mức cao nhất có thể, bật query log, **dán SQL mà ORM sinh ra** và so sánh plan + thời gian với bản raw. (c) Kết luận 5-7 câu: khi nào bạn sẽ rời ORM xuống raw SQL trong dự án thật.

**Yêu cầu output:** File `optimization-journey.md` chứa: plan trước/sau từng index, SQL của ORM vs raw, bảng thời gian, kết luận.
**Gợi ý:** `SUM(oi.qty * oi.price) FILTER (WHERE o.created_at >= now() - interval '90 days')` gom 2 kỳ trong 1 lần quét; cân nhắc partial index theo thời gian hoặc materialized view nếu vẫn chậm.

## 📝 Bài test cuối tuần

### Phần 1: Quiz 15 câu trắc nghiệm

**Câu 1.** Bảng `orders(id, customer_id, customer_email)` trong đó email lấy theo customer vi phạm chuẩn nào?
A. 1NF  B. 2NF  C. 3NF (phụ thuộc bắc cầu)  D. Không vi phạm

**Câu 2.** Query tìm "user chưa có order nào" đúng là:
A. INNER JOIN + WHERE o.id IS NULL  B. LEFT JOIN orders + WHERE o.id IS NULL  C. RIGHT JOIN + WHERE u.id IS NULL  D. CROSS JOIN + DISTINCT

**Câu 3.** Với index `(user_id, status, created_at)`, query nào KHÔNG tận dụng được index để seek?
A. `WHERE user_id = 1`  B. `WHERE user_id = 1 AND status = 'paid'`  C. `WHERE status = 'paid' AND created_at > '2026-01-01'`  D. `WHERE user_id = 1 AND status = 'paid' AND created_at > '2026-01-01'`

**Câu 4.** `WHERE LOWER(email) = 'a@b.com'` không dùng index trên `email` vì:
A. Email quá dài  B. Hàm bọc cột khiến B-tree không seek được; cần expression index  C. So sánh string không dùng index  D. Thiếu dấu %

**Câu 5.** "Index Only Scan" trong Postgres nghĩa là:
A. Chỉ có 1 index được dùng  B. Mọi cột cần thiết nằm trong index, không phải đọc bảng  C. Quét toàn bộ index  D. Index đang được build

**Câu 6.** Trong EXPLAIN ANALYZE, `rows=10` (ước lượng) nhưng `actual rows=80000` gợi ý:
A. Index bị hỏng  B. Statistics lỗi thời → chạy ANALYZE  C. Query đúng, không cần làm gì  D. Cần thêm RAM

**Câu 7.** Non-repeatable read là:
A. Đọc dữ liệu chưa commit  B. Đọc lại cùng 1 dòng trong 1 transaction ra giá trị khác do transaction khác đã update+commit  C. Đọc lại cùng điều kiện ra thêm dòng mới  D. Mất update do ghi đè

**Câu 8.** Isolation level mặc định của PostgreSQL và MySQL InnoDB lần lượt là:
A. READ COMMITTED / REPEATABLE READ  B. REPEATABLE READ / READ COMMITTED  C. SERIALIZABLE / READ COMMITTED  D. READ UNCOMMITTED / REPEATABLE READ

**Câu 9.** `SELECT ... FOR UPDATE SKIP LOCKED` thường dùng để:
A. Tăng tốc SELECT thường  B. Implement job queue trên SQL — worker lấy job chưa bị worker khác khóa  C. Tránh dirty read  D. Khóa toàn bảng

**Câu 10.** Optimistic locking thất bại (version không khớp) thì app nên:
A. Bỏ qua, coi như thành công  B. Đọc lại dữ liệu mới, tính toán lại và retry update  C. Khóa bảng rồi update  D. Tăng isolation lên SERIALIZABLE

**Câu 11.** Cách phòng deadlock hiệu quả nhất trong các lựa chọn:
A. Tăng pool size  B. Mọi transaction khóa tài nguyên theo cùng một thứ tự nhất quán  C. Dùng OFFSET pagination  D. Tắt autocommit

**Câu 12.** 5 instance Node, mỗi instance pool max = 30, Postgres `max_connections = 100`. Vấn đề là:
A. Không vấn đề gì  B. Tổng 150 connection tiềm năng > 100 → lỗi "too many clients" khi cao tải  C. Pool quá nhỏ  D. Postgres tự scale connection

**Câu 13.** Trang 5000 (`OFFSET 99980 LIMIT 20`) chậm vì:
A. LIMIT nhỏ quá  B. DB phải đọc và bỏ qua 99980 dòng trước khi trả 20 dòng  C. Thiếu RAM  D. ORDER BY không hoạt động với OFFSET

**Câu 14.** Đặc trưng nổi bật của Prisma so với Sequelize/TypeORM:
A. Nhanh hơn raw SQL  B. Schema file riêng + generated client type-safe mạnh  C. Không cần migration  D. Hỗ trợ mọi loại JOIN phức tạp hơn raw SQL

**Câu 15.** 100 user kèm orders của họ — cách số query tối ưu (không JOIN) là:
A. 1 + 100 query  B. 2 query: lấy users, rồi orders WHERE user_id IN (...)  C. 100 query song song bằng Promise.all  D. 1 query cho mỗi order

<details><summary>Đáp án</summary>

1. **C** — `customer_email` phụ thuộc `customer_id` (non-key) chứ không phụ thuộc khóa `id` → phụ thuộc bắc cầu, vi phạm 3NF.
2. **B** — LEFT JOIN giữ mọi user; dòng không khớp có o.id IS NULL chính là user chưa có order.
3. **C** — Thiếu cột đầu `user_id` nên vi phạm leftmost prefix, không seek được.
4. **B** — B-tree sort theo giá trị gốc của cột; bọc hàm phải tạo index trên biểu thức `LOWER(email)`.
5. **B** — Covering: đọc đủ dữ liệu từ index, bỏ bước heap fetch (cần visibility map sạch).
6. **B** — Ước lượng lệch lớn = thống kê cũ, planner dễ chọn sai chiến lược; chạy ANALYZE.
7. **B** — Đúng định nghĩa; A là dirty read, C là phantom, D là lost update.
8. **A** — Postgres mặc định READ COMMITTED; InnoDB mặc định REPEATABLE READ.
9. **B** — SKIP LOCKED bỏ qua dòng đang bị khóa, các worker không chờ nhau — pattern queue kinh điển.
10. **B** — Bản chất optimistic là phát hiện xung đột lúc ghi rồi retry với dữ liệu mới.
11. **B** — Khóa cùng thứ tự loại bỏ chờ chéo — điều kiện hình thành deadlock.
12. **B** — 5 × 30 = 150 > 100; phải giảm pool hoặc dùng PgBouncer.
13. **B** — OFFSET là O(n): vẫn phải duyệt qua toàn bộ dòng bị bỏ; keyset seek thẳng vào index.
14. **B** — Prisma định nghĩa schema riêng và generate client với type chính xác từng query.
15. **B** — Batch bằng WHERE IN: 2 round-trip, group ở app; tránh cả N+1 lẫn duplicate dòng do JOIN.

</details>

### Phần 2: Bài thực hành chấm điểm

**Đề bài: Xây dựng "E-commerce Order API" với PostgreSQL — Node.js + `pg` hoặc `knex` (KHÔNG dùng full ORM để chứng minh hiểu SQL; migration được phép dùng knex migrate).**

Trên schema users/products/orders/order_items (seed ≥ 500k orders):

1. `POST /api/orders` — tạo đơn từ giỏ `{items: [{productId, qty}]}`: **một transaction** trừ stock có kiểm tra (`UPDATE ... WHERE stock >= qty` hoặc FOR UPDATE), insert order + items; trả 409 khi hết hàng; chống deadlock bằng lock product theo thứ tự id + retry.
2. `GET /api/orders?limit=&cursor=&status=` — **cursor pagination** trên `(created_at, id)`, kèm items + product name với tối đa 3 query (không N+1).
3. `GET /api/reports/revenue?from=&to=&groupBy=day|month` — query aggregate có EXPLAIN ANALYZE chứng minh dùng index, chạy < 500ms trên dữ liệu seed.
4. `PATCH /api/products/:id/stock` — **optimistic locking** bằng cột `version`, trả 409 kèm code `VERSION_CONFLICT` khi xung đột.
5. Vận hành: pool có `max`, `connectionTimeoutMillis`; mọi query parameterized; script `npm run stress` bắn 100 đơn đồng thời vào cùng 1 sản phẩm stock = 50.

**Checklist tiêu chí chấm điểm:**

- [ ] Stress test 100 đơn đồng thời vào product stock 50 → đúng 50 đơn thành công, stock cuối = 0, không âm, không deadlock chưa xử lý (có retry log).
- [ ] Transaction dùng đúng 1 client xuyên suốt, có ROLLBACK trong catch và `client.release()` trong finally — kill DB giữa chừng không leak connection.
- [ ] Pagination cursor: duyệt hết 500k orders qua nhiều trang không trùng/sót dòng (script kiểm chứng đếm tổng), trang sâu nhanh tương đương trang đầu (chênh < 2 lần).
- [ ] Endpoint list orders dùng tối đa 3 query (đính kèm query log 1 request làm bằng chứng).
- [ ] File `EXPLAIN.md` chứa plan trước/sau khi thêm index cho query report và query pagination, mỗi index có 1-2 câu lý do.
- [ ] Optimistic locking trả 409 đúng khi 2 PATCH đồng thời (có test hoặc script chứng minh).
- [ ] 100% query đi qua parameterized query/binding — grep codebase không có template string nối input vào SQL.
- [ ] Tổng connection sử dụng không vượt pool max khi stress (log `pool.totalCount`), không request nào lỗi "timeout acquiring connection".

## ✅ Tiêu chí pass tuần

- Quiz ≥ 12/15
- Hoàn thành tất cả bài tập bắt buộc (5/5), riêng bài 3 phải tái hiện được deadlock thật trước khi fix
- Bài thực hành đạt đủ checklist (8/8 mục)
- Cầm một query plan EXPLAIN ANALYZE lạ (do người khác đưa) và chỉ ra được bottleneck + đề xuất index trong vòng 5 phút
