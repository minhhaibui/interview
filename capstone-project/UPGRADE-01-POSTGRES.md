# Upgrade 1 — Swap repo sang PostgreSQL (sau tuần 3)

Mục tiêu: thay `InMemoryOrderRepo` bằng `PostgresOrderRepo` **mà không sửa một dòng nào** trong `order-service.js` — đó chính là giá trị của Repository pattern. Làm xong upgrade này bạn luyện được: schema design, transaction, connection pool, parameterized query.

## 0. Chuẩn bị

```bash
# Chạy Postgres bằng Docker (tuần 7 sẽ hiểu sâu lệnh này)
docker run -d --name prep-pg -e POSTGRES_PASSWORD=secret -e POSTGRES_DB=orders -p 5432:5432 postgres:16-alpine

# Driver pg là package DUY NHẤT cần cài cho upgrade này
cd capstone-project && npm init -y && npm install pg
```

## 1. Schema — `sql/001-init.sql`

Tách `order_items` ra bảng riêng (1-n), idempotency key có bảng riêng với UNIQUE constraint — DB tự chặn race condition thay vì code tự lo.

```sql
CREATE TABLE orders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT NOT NULL DEFAULT 'guest',
  total       NUMERIC(14,2) NOT NULL CHECK (total >= 0),
  status      TEXT NOT NULL DEFAULT 'CREATED',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  quantity   INT  NOT NULL CHECK (quantity > 0),
  price      NUMERIC(14,2) NOT NULL CHECK (price >= 0)
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);

CREATE TABLE idempotency_keys (
  key        TEXT PRIMARY KEY,
  order_id   UUID NOT NULL REFERENCES orders(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Nạp schema:

```bash
docker exec -i prep-pg psql -U postgres -d orders < sql/001-init.sql
```

## 2. Repo — `src/repos/postgres-order-repo.js`

Cùng interface với bản in-memory: `save`, `findById`, `findByIdempotencyKey`.

```js
const { Pool } = require('pg');

class PostgresOrderRepo {
  constructor(connectionString) {
    // Pool chứ KHÔNG phải Client: tái dùng kết nối, có giới hạn (câu hỏi PV kinh điển)
    this.pool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 30000 });
  }

  async save(order, idempotencyKey) {
    const client = await this.pool.connect();
    try {
      // Transaction: order + items + idem key sống chết cùng nhau
      await client.query('BEGIN');
      const { rows: [row] } = await client.query(
        `INSERT INTO orders (customer_id, total, status)
         VALUES ($1, $2, $3) RETURNING id, created_at`,
        [order.customerId, order.total, order.status],
      );
      for (const it of order.items) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity, price)
           VALUES ($1, $2, $3, $4)`,
          [row.id, it.productId, it.quantity, it.price],
        );
      }
      if (idempotencyKey) {
        await client.query(
          'INSERT INTO idempotency_keys (key, order_id) VALUES ($1, $2)',
          [idempotencyKey, row.id],
        );
      }
      await client.query('COMMIT');
      return { ...order, id: row.id, createdAt: row.created_at.toISOString() };
    } catch (err) {
      await client.query('ROLLBACK');
      // 23505 = unique_violation: request song song cùng key → trả order đã tạo
      if (err.code === '23505' && idempotencyKey) {
        return this.findByIdempotencyKey(idempotencyKey);
      }
      throw err;
    } finally {
      client.release(); // QUÊN release = leak connection, pool cạn là treo cả app
    }
  }

  async findById(id) {
    const { rows } = await this.pool.query(
      `SELECT o.id, o.customer_id, o.total, o.status, o.created_at,
              json_agg(json_build_object(
                'productId', i.product_id, 'quantity', i.quantity, 'price', i.price
              )) AS items
       FROM orders o
       JOIN order_items i ON i.order_id = o.id
       WHERE o.id = $1
       GROUP BY o.id`,
      [id],
    );
    return rows[0] ? this.toOrder(rows[0]) : null;
  }

  async findByIdempotencyKey(key) {
    const { rows } = await this.pool.query(
      'SELECT order_id FROM idempotency_keys WHERE key = $1',
      [key],
    );
    return rows[0] ? this.findById(rows[0].order_id) : null;
  }

  toOrder(row) {
    return {
      id: row.id,
      customerId: row.customer_id,
      items: row.items,
      total: Number(row.total),
      status: row.status,
      createdAt: row.created_at.toISOString(),
    };
  }

  async close() {
    await this.pool.end(); // gọi trong graceful shutdown
  }
}

module.exports = { PostgresOrderRepo };
```

## 3. Wiring — sửa đúng 2 dòng trong `src/server.js`

```js
const { PostgresOrderRepo } = require('./repos/postgres-order-repo');
const repo = process.env.DATABASE_URL
  ? new PostgresOrderRepo(process.env.DATABASE_URL)
  : new InMemoryOrderRepo(); // không có DB vẫn chạy được — tiện dev/test
```

```bash
DATABASE_URL=postgres://postgres:secret@localhost:5432/orders node capstone-project/src/server.js
```

`order-service.js` và toàn bộ unit test **không đổi một ký tự** — service chỉ biết interface, không biết storage. Đây là câu trả lời mẫu khi PV hỏi "dependency injection để làm gì".

## 4. Checklist nghiệm thu

- [ ] POST /orders ghi đủ 3 bảng trong MỘT transaction (kill server giữa chừng → không có order mồ côi)
- [ ] Gửi 2 request song song cùng `Idempotency-Key` → chỉ tạo 1 order (UNIQUE constraint bắt race)
- [ ] GET /orders/:id trả items đúng bằng `json_agg` (1 query, không N+1)
- [ ] `EXPLAIN ANALYZE` query findById — thấy Index Scan, không Seq Scan
- [ ] Graceful shutdown gọi `repo.close()` để pool thoát sạch

## 5. Câu hỏi tự kiểm tra (trả lời to thành tiếng)

1. Tại sao dùng `Pool` thay vì `Client`? Pool size bao nhiêu là hợp lý?
2. Nếu không có bảng `idempotency_keys` mà check bằng `SELECT` trước khi `INSERT` thì race condition xảy ra thế nào?
3. `NUMERIC` vs `FLOAT` cho tiền — vì sao?
4. Khi nào cần thêm index lên `order_items.product_id`?

> Tiếp theo: học xong tuần 5 → `UPGRADE-02-REDIS` (cache GET /orders/:id, cache-aside + TTL jitter).
