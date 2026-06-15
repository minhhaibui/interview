-- ============================================================
-- 🏗️  init.sql — Schema e-commerce (chuẩn hoá) + SEED dữ liệu lớn
-- File này được Postgres tự chạy 1 lần khi khởi tạo DB (volume trống).
-- Mục tiêu: có đủ dữ liệu để EXPLAIN ANALYZE cho ra plan có ý nghĩa.
-- ============================================================

-- ---------- SCHEMA (đã chuẩn hoá 3NF) ----------

-- users: thông tin người dùng. email UNIQUE (Postgres tự tạo index cho UNIQUE).
CREATE TABLE users (
  id          SERIAL PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- orders: mỗi đơn thuộc về 1 user (FK). total/status là thuộc tính của đơn.
CREATE TABLE orders (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  total       NUMERIC(12,2) NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- order_items: dòng hàng trong đơn (tách bảng để đạt 2NF — qty/price thuộc về dòng hàng).
CREATE TABLE order_items (
  id            SERIAL PRIMARY KEY,
  order_id      INTEGER NOT NULL REFERENCES orders(id),
  product_name  TEXT NOT NULL,
  qty           INTEGER NOT NULL DEFAULT 1,
  price         NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- accounts: ví tiền của user (1-1). Dùng cho demo transaction chuyển tiền (02-transaction.js).
CREATE TABLE accounts (
  id        SERIAL PRIMARY KEY,
  user_id   INTEGER NOT NULL REFERENCES users(id),
  balance   NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- ⚠️ CỐ Ý CHƯA tạo index trên orders.user_id.
-- Bài 01-join-index.js sẽ EXPLAIN khi chưa có index (Seq Scan) → tự tạo index → EXPLAIN lại (Index Scan)
-- để bạn TẬN MẮT thấy plan đổi và thời gian giảm. Đừng thêm index ở đây!

-- ---------- SEED dữ liệu lớn bằng generate_series (chạy < vài giây) ----------

-- ~5.000 users
INSERT INTO users (email, name)
SELECT
  'user' || g || '@example.com',
  'User ' || g
FROM generate_series(1, 5000) AS g;

-- mỗi user 1 account, balance khởi điểm 1000
INSERT INTO accounts (user_id, balance)
SELECT id, 1000 FROM users;

-- ~50.000 orders, user_id ngẫu nhiên trong [1..5000]
INSERT INTO orders (user_id, total, status, created_at)
SELECT
  1 + floor(random() * 5000)::int,
  round((random() * 500 + 10)::numeric, 2),
  (ARRAY['pending','paid','shipped','cancelled'])[1 + floor(random() * 4)::int],
  now() - (random() * interval '365 days')
FROM generate_series(1, 50000) AS g;

-- ~150.000 order_items (trung bình 3 item/đơn), order_id ngẫu nhiên trong [1..50000]
INSERT INTO order_items (order_id, product_name, qty, price)
SELECT
  1 + floor(random() * 50000)::int,
  'Product ' || (1 + floor(random() * 200)::int),
  1 + floor(random() * 5)::int,
  round((random() * 100 + 1)::numeric, 2)
FROM generate_series(1, 150000) AS g;

-- ANALYZE để planner có thống kê chính xác ngay từ đầu (nếu không, EXPLAIN có thể lệch).
ANALYZE users;
ANALYZE orders;
ANALYZE order_items;
ANALYZE accounts;
