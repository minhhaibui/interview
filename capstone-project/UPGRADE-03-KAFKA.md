# Upgrade 3 — Publish event OrderCreated qua Kafka + Outbox (sau tuần 6)

Vấn đề kinh điển: tạo order (ghi DB) **và** bắn event (ghi Kafka) là 2 hệ thống khác nhau — không có transaction chung. Ghi DB xong mà publish fail → các service khác không bao giờ biết có order. Publish trước mà DB fail → event ma. Đây là **dual-write problem**, và lời giải chuẩn là **Outbox pattern**.

## 0. Chuẩn bị

```bash
# Kafka single-node KRaft (không cần ZooKeeper)
docker run -d --name prep-kafka -p 9092:9092 apache/kafka:3.7.0

cd capstone-project && npm install kafkajs
```

## 1. Bảng outbox — `sql/002-outbox.sql`

Event được ghi vào DB **trong cùng transaction** với order → hoặc cả hai cùng tồn tại, hoặc không gì cả.

```sql
CREATE TABLE outbox (
  id           BIGSERIAL PRIMARY KEY,
  topic        TEXT NOT NULL,
  key          TEXT NOT NULL,         -- orderId → cùng key vào cùng partition, giữ ordering
  payload      JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ            -- NULL = chưa bắn
);

CREATE INDEX idx_outbox_unpublished ON outbox (id) WHERE published_at IS NULL;
```

## 2. Ghi outbox trong transaction của `save()`

Thêm vào `postgres-order-repo.js`, NGAY TRƯỚC `COMMIT`:

```js
await client.query(
  `INSERT INTO outbox (topic, key, payload) VALUES ($1, $2, $3)`,
  ['orders', row.id, JSON.stringify({
    type: 'OrderCreated',
    orderId: row.id,
    customerId: order.customerId,
    total: order.total,
    occurredAt: new Date().toISOString(),
  })],
);
```

## 3. Outbox relay — `src/outbox-relay.js`

Process riêng: poll outbox → produce → đánh dấu đã bắn. Crash giữa chừng → lần sau bắn lại → **at-least-once** (consumer phải idempotent — RAPID-FIRE Q24).

```js
const { Pool } = require('pg');
const { Kafka } = require('kafkajs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const kafka = new Kafka({ clientId: 'outbox-relay', brokers: ['localhost:9092'] });
const producer = kafka.producer();

async function relayBatch() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // FOR UPDATE SKIP LOCKED: chạy nhiều relay song song không giẫm chân nhau
    const { rows } = await client.query(
      `SELECT id, topic, key, payload FROM outbox
       WHERE published_at IS NULL
       ORDER BY id LIMIT 100
       FOR UPDATE SKIP LOCKED`,
    );
    if (rows.length) {
      await producer.send({
        topic: rows[0].topic,
        messages: rows.map(r => ({ key: r.key, value: JSON.stringify(r.payload) })),
      });
      await client.query(
        'UPDATE outbox SET published_at = now() WHERE id = ANY($1)',
        [rows.map(r => r.id)],
      );
    }
    await client.query('COMMIT');
    return rows.length;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

(async () => {
  await producer.connect();
  console.log('Outbox relay chạy — poll mỗi giây');
  while (true) {
    try {
      const n = await relayBatch();
      if (n) console.log(`đã bắn ${n} event`);
    } catch (err) { console.error('[relay]', err.message); }
    await new Promise(r => setTimeout(r, 1000));
  }
})();
```

## 4. Consumer thử — `src/consumers/notification-consumer.js`

```js
const { Kafka } = require('kafkajs');

const kafka = new Kafka({ clientId: 'notification-service', brokers: ['localhost:9092'] });
const consumer = kafka.consumer({ groupId: 'notification' });
const seen = new Set(); // idempotency tối giản — thật thì lưu DB/Redis

(async () => {
  await consumer.connect();
  await consumer.subscribe({ topic: 'orders', fromBeginning: true });
  await consumer.run({
    eachMessage: async ({ message }) => {
      const event = JSON.parse(message.value.toString());
      if (seen.has(event.orderId)) return; // at-least-once → có thể nhận trùng
      seen.add(event.orderId);
      console.log(`📧 Gửi email xác nhận order ${event.orderId} (${event.total}đ)`);
    },
  });
})();
```

## 5. Chạy cả dây chuyền

```bash
# 4 terminal (hoặc dùng & ):
node capstone-project/src/server.js                       # API
node capstone-project/src/outbox-relay.js                 # relay
node capstone-project/src/consumers/notification-consumer.js  # consumer

curl -X POST localhost:3000/orders -H "content-type: application/json" \
  -d '{"items":[{"productId":"p1","quantity":1,"price":99000}]}'
# → consumer in ra "📧 Gửi email xác nhận order …" sau ≤1 giây
```

## 6. Checklist nghiệm thu

- [ ] Tắt Kafka, tạo order → API vẫn 201, outbox tích lũy; bật Kafka lại → event tự bắn ra (resilience!)
- [ ] Kill relay ngay sau `producer.send` trước `UPDATE` → restart → event bắn LẠI → consumer không xử lý trùng (idempotent)
- [ ] 2 order cùng customer ra cùng partition? (không — key là orderId; thử đổi key thành customerId xem ordering thay đổi gì)
- [ ] Chạy 2 relay song song → không event nào bắn trùng do `SKIP LOCKED`
- [ ] `docker exec prep-kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --from-beginning` thấy đủ event

## 7. Câu hỏi tự kiểm tra (trả lời to thành tiếng)

1. Outbox giải quyết dual-write thế nào? Sao không dùng 2PC?
2. Vì sao relay là at-least-once chứ không exactly-once? Consumer phải làm gì?
3. `FOR UPDATE SKIP LOCKED` để làm gì? Bỏ đi thì 2 relay song song bị gì?
4. Khi nào nên thay relay tự viết bằng Debezium (CDC đọc WAL)?

> Tiếp theo: tuần 7-8 → Dockerfile multi-stage + K8s manifest cho cả 3 process (xem bảng trong GETTING-STARTED).
