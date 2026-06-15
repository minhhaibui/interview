# 🧪 Lab SQL/Postgres — Tận tay

Lab này giúp bạn **TỰ TAY chạy** và **nhìn thấy** những thứ hay bị hỏi trong phỏng vấn backend:
index & `EXPLAIN ANALYZE`, transaction & lock, N+1 & cursor pagination. Không học chay — chạy thật, quan sát plan và thời gian thật.

> Bám sát lý thuyết tuần 3 ở [`../README.md`](../README.md).

## 🎯 Mục tiêu

- Thấy tận mắt **Seq Scan → Index Scan** khi thêm index, đo thời gian trước/sau.
- Hiểu **transaction + `FOR UPDATE`**: chuyển tiền atomic, vượt số dư thì ROLLBACK, khoá theo thứ tự để tránh deadlock.
- Diệt **N+1** (1+N query → 2 query) và phân trang **keyset (cursor)** thay cho OFFSET.

## 🏗️ Schema & dữ liệu seed

`init.sql` tạo schema e-commerce đã chuẩn hoá (3NF) và seed dữ liệu lớn (chạy < vài giây):

| Bảng          | Mô tả                                              | Số dòng (xấp xỉ) |
|---------------|----------------------------------------------------|------------------|
| `users`       | id, email (UNIQUE), name, created_at               | ~5.000           |
| `orders`      | id, user_id → users, total, status, created_at     | ~50.000          |
| `order_items` | id, order_id → orders, product_name, qty, price    | ~150.000         |
| `accounts`    | id, user_id → users, balance (default 1000)        | ~5.000           |

> ⚠️ **Cố ý chưa tạo index** trên `orders.user_id`. Bài `npm run join` sẽ tự thêm để bạn so sánh trước/sau.

## ⚙️ Setup & chạy

### 1. Khởi động Postgres bằng Docker

```bash
docker compose up -d
```

### 2. Đợi tới khi container "healthy"

```bash
docker compose ps
# Đợi tới khi cột STATUS hiện: Up (healthy)
```

(Lần đầu Postgres còn chạy `init.sql` để seed — chờ vài giây cho tới `healthy`.)

### 3. Cài dependency Node

```bash
npm install
```

### 4. Chạy từng bài

```bash
npm run join     # 🔍 Index & EXPLAIN ANALYZE
npm run tx       # 💸 Transaction & Lock (chuyển tiền)
npm run nplus1   # 🐢 N+1 & cursor pagination
```

### Output mẫu mong đợi

**`npm run join`** (số liệu thời gian sẽ khác máy bạn):

```
✅ Đã kết nối Postgres → db=shop, user=lab
🎯 Sẽ EXPLAIN cho query: SELECT * FROM orders WHERE user_id = 1234

----- TRƯỚC khi tạo index (kỳ vọng Seq Scan — quét cả 50k dòng) -----
  Seq Scan on orders  (cost=0.00..1041.00 rows=11 width=...) (actual time=0.2..6.5 rows=12 ...)
  ...
  Execution Time: 6.800 ms

----- SAU khi tạo index idx_orders_user (kỳ vọng Index Scan) -----
  Index Scan using idx_orders_user on orders  (cost=0.29..40.0 rows=11 ...) (actual time=0.03..0.06 ...)
  Execution Time: 0.150 ms

📊 So sánh thời gian thực thi:
   TRƯỚC (Seq Scan)  : Execution Time: 6.800 ms
   SAU   (Index Scan): Execution Time: 0.150 ms
```

**`npm run tx`**:

```
💰 Balance TRƯỚC:    (user 1: 1000, user 2: 1000)
➡️  Chuyển 200 ... Kết quả: { ok: true }
➡️  Chuyển 999999 ... Kết quả: { ok: false, error: 'Số dư không đủ: ...' }
💰 Balance SAU:      (user 1: 800, user 2: 1200)   ← chỉ lần hợp lệ được ghi
```

**`npm run nplus1`**:

```
❌ CÁCH SAI (N+1):   Số query = 11 (1 + 10) | Thời gian = ...
✅ CÁCH ĐÚNG (gộp):  Số query = 2 (cố định) | Thời gian = ...
📄 CURSOR PAGINATION: Trang 1 id: 50000..49991 | Trang 2 id: 49990..49981
```

## 🔍 Quan sát thêm (vào psql trực tiếp)

```bash
docker compose exec postgres psql -U lab -d shop
```

Trong psql, thử:

```sql
\dt                         -- liệt kê các bảng
\di                         -- liệt kê index (xem idx_orders_user xuất hiện sau khi chạy npm run join)

-- Tự chạy EXPLAIN: so sánh điều kiện chọn lọc tốt vs xấu
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 1234;     -- ít dòng → Index Scan
EXPLAIN ANALYZE SELECT * FROM orders WHERE total > 0;          -- gần như cả bảng → Seq Scan (index vô dụng)
```

### Demo LOCK chặn nhau (mở 2 cửa sổ psql)

Cửa sổ **A**:

```sql
BEGIN;
SELECT balance FROM accounts WHERE user_id = 1 FOR UPDATE;   -- khoá hàng, CHƯA commit
```

Cửa sổ **B** (chạy ngay sau đó):

```sql
BEGIN;
SELECT balance FROM accounts WHERE user_id = 1 FOR UPDATE;   -- ⏳ BỊ TREO, đợi A
```

Quay lại **A** gõ `COMMIT;` → ngay lập tức **B** được giải phóng và chạy tiếp. Đó chính là pessimistic lock.

## 🧠 Khái niệm cốt lõi

- **Index B-tree**: cấu trúc cây cân bằng cho phép tìm/khoảng (`=`, `<`, `>`, `BETWEEN`, `ORDER BY`) nhanh ~O(log n) thay vì quét tuyến tính.
- **Seq Scan vs Index Scan**: Seq Scan đọc toàn bộ bảng; Index Scan dùng index nhảy tới dòng cần. Planner chọn Seq Scan khi query trả về **phần lớn** bảng (lúc đó index còn chậm hơn vì phải nhảy đĩa nhiều lần) → **index chỉ có ích khi điều kiện chọn lọc tốt**.
- **ACID**: Atomicity (tất cả-hoặc-không), Consistency (giữ ràng buộc), Isolation (cô lập đồng thời), Durability (bền sau commit).
- **Isolation levels** (Postgres): `READ COMMITTED` (mặc định — không dirty read), `REPEATABLE READ` (chặn non-repeatable read; Postgres còn chặn được phantom nhờ snapshot), `SERIALIZABLE` (như chạy tuần tự — có thể ném *serialization failure* để bạn retry).
- **N+1**: lấy danh sách rồi vòng lặp query con cho từng phần tử → 1+N truy vấn. Diệt bằng 1 query gộp (`WHERE id = ANY(...)` / JOIN) rồi gom trong app.
- **Keyset (cursor) pagination**: `WHERE id < cursor ORDER BY id DESC LIMIT n`. Ổn định và nhanh trên bảng lớn vì không phải đọc-bỏ như `OFFSET`.

## 💪 Bài tập mở rộng

1. **Composite index + EXPLAIN**: tạo `CREATE INDEX ON orders(user_id, status);` rồi `EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 1234 AND status = 'paid';`. So sánh với khi chỉ có index trên `user_id`. Thử đổi thứ tự cột trong index xem có còn được dùng cho query chỉ lọc `status` không (gợi ý: không, vì leftmost-prefix).
2. **SERIALIZABLE gặp serialization error**: mở 2 psql, cả hai `BEGIN ISOLATION LEVEL SERIALIZABLE;` cùng đọc rồi cùng ghi giao nhau (vd cùng đọc tổng balance rồi mỗi bên UPDATE) → một bên `COMMIT` lỗi `could not serialize access` (code 40001). Đây là lý do app cần **retry**.
3. **Deadlock cố ý**: cửa sổ A `BEGIN; ... FOR UPDATE user_id=1;` rồi `... FOR UPDATE user_id=2;`. Cửa sổ B làm NGƯỢC thứ tự: `... user_id=2;` rồi `... user_id=1;`. Postgres sẽ phát hiện và kill một transaction (error `40P01 deadlock detected`). Đối chiếu với cách `02-transaction.js` luôn khoá id nhỏ trước để **không bao giờ** dính lỗi này.
4. **OFFSET vs keyset trên 50k dòng**: so sánh `EXPLAIN ANALYZE SELECT * FROM orders ORDER BY id LIMIT 10 OFFSET 49990;` với `... WHERE id < 11 ORDER BY id DESC LIMIT 10;`. Nhìn số dòng phải đọc và Execution Time.

## 🧹 Dọn dẹp

```bash
docker compose down -v   # -v xoá luôn volume pgdata → lần sau seed lại từ đầu
```

## 🎤 Liên hệ câu phỏng vấn

- **Khi nào index vô dụng?** Khi query trả về phần lớn bảng (planner chọn Seq Scan), khi cột bị bọc hàm/biến đổi (`WHERE lower(email)=...` mà không có functional index), khi dữ liệu quá ít, hoặc khi điều kiện không khớp leftmost-prefix của composite index. Index cũng **làm chậm ghi** (INSERT/UPDATE/DELETE) và tốn dung lượng.
- **ACID là gì?** Atomicity, Consistency, Isolation, Durability — bộ đảm bảo của transaction. Ví dụ chuyển tiền: trừ và cộng phải atomic, không ai âm số dư (consistency), giao dịch song song không giẫm chân (isolation), commit xong là bền (durability).
- **Các isolation level & anomaly?** READ COMMITTED (chặn dirty read), REPEATABLE READ (chặn non-repeatable read, Postgres chặn cả phantom), SERIALIZABLE (tuần tự hoá, có thể ném serialization error). Càng cao càng an toàn nhưng càng dễ xung đột/chậm.
- **N+1 là gì và diệt thế nào?** Lấy N bản ghi rồi query con cho từng cái → 1+N truy vấn. Diệt bằng 1 query gộp (`IN`/`ANY`/JOIN) hoặc dùng dataloader/eager-loading của ORM.
- **OFFSET vs keyset pagination?** OFFSET phải đọc-bỏ các dòng trước → chậm dần ở trang sâu; keyset (`WHERE id < cursor`) nhảy thẳng nhờ index → nhanh ổn định, nhưng chỉ next/prev chứ không nhảy tới trang bất kỳ.
- **Optimistic vs pessimistic lock?** Pessimistic: khoá hàng trước khi sửa (`SELECT ... FOR UPDATE`) — hợp khi tranh chấp cao. Optimistic: không khoá, dùng cột `version`/`updated_at`, lúc ghi kiểm tra chưa ai đổi (`UPDATE ... WHERE version = $old`), nếu trượt thì retry — hợp khi tranh chấp thấp, nhiều đọc.
