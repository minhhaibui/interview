# Upgrade 2 — Redis cache cho GET /orders/:id (sau tuần 5)

Mục tiêu: thêm cache mà **service và repo Postgres không biết gì về Redis** — dùng **decorator pattern**: một repo bọc ngoài repo thật, cùng interface. Luyện được: cache-aside, TTL jitter chống stampede, invalidation, graceful degradation.

## 0. Chuẩn bị

```bash
docker run -d --name prep-redis -p 6379:6379 redis:7-alpine
cd capstone-project && npm install redis
```

## 1. Decorator — `src/repos/cached-order-repo.js`

```js
const { createClient } = require('redis');

/** Bọc một orderRepo bất kỳ và cache findById. Cache chết → fallback repo thật. */
class CachedOrderRepo {
  constructor(inner, redisUrl, { ttlSec = 60 } = {}) {
    this.inner = inner;
    this.ttlSec = ttlSec;
    this.redis = createClient({ url: redisUrl });
    this.redis.on('error', err => console.error('[redis]', err.message));
    this.redis.connect().catch(() => {}); // không chặn app nếu Redis chưa lên
  }

  key(id) { return `order:${id}`; }

  /** TTL + jitter ±20%: các key không hết hạn cùng lúc → tránh stampede */
  jitteredTtl() {
    const jitter = this.ttlSec * 0.2 * (Math.random() * 2 - 1);
    return Math.max(5, Math.round(this.ttlSec + jitter));
  }

  async findById(id) {
    // 1) thử cache — lỗi Redis thì coi như cache miss, KHÔNG làm hỏng request
    try {
      const hit = await this.redis.get(this.key(id));
      if (hit) return JSON.parse(hit);
    } catch {}

    // 2) cache miss → đọc repo thật (cache-aside: app tự nạp, không phải DB)
    const order = await this.inner.findById(id);

    // 3) ghi lại cache, best-effort
    if (order) {
      this.redis.set(this.key(id), JSON.stringify(order), { EX: this.jitteredTtl() })
        .catch(() => {});
    }
    return order;
  }

  async save(order, idempotencyKey) {
    const saved = await this.inner.save(order, idempotencyKey);
    // Write → invalidate (xóa) thay vì update cache: đơn giản và không bao giờ stale
    this.redis.del(this.key(saved.id)).catch(() => {});
    return saved;
  }

  async findByIdempotencyKey(key) {
    return this.inner.findByIdempotencyKey(key); // ít gọi, không đáng cache
  }

  async close() {
    await this.redis.quit().catch(() => {});
    if (this.inner.close) await this.inner.close();
  }
}

module.exports = { CachedOrderRepo };
```

## 2. Wiring — `src/server.js`

Decorator xếp chồng như búp bê Nga, mỗi lớp một việc:

```js
const { CachedOrderRepo } = require('./repos/cached-order-repo');

let repo = process.env.DATABASE_URL
  ? new PostgresOrderRepo(process.env.DATABASE_URL)
  : new InMemoryOrderRepo();
if (process.env.REDIS_URL) {
  repo = new CachedOrderRepo(repo, process.env.REDIS_URL, { ttlSec: 60 });
}
```

```bash
REDIS_URL=redis://localhost:6379 DATABASE_URL=postgres://postgres:secret@localhost:5432/orders \
  node capstone-project/src/server.js
```

## 3. Đo xem cache có ăn không

```bash
ID=$(curl -s -X POST localhost:3000/orders -H "content-type: application/json" \
  -d '{"items":[{"productId":"p1","quantity":1,"price":99000}]}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).id')

# Lần 1: miss (đọc DB), lần 2+: hit (đọc Redis)
time curl -s localhost:3000/orders/$ID > /dev/null
time curl -s localhost:3000/orders/$ID > /dev/null

# Soi trực tiếp key trong Redis
docker exec prep-redis redis-cli GET "order:$ID"
docker exec prep-redis redis-cli TTL "order:$ID"   # thấy TTL có jitter, không tròn 60
```

## 4. Checklist nghiệm thu

- [ ] Request thứ 2 trở đi không chạm DB (tắt hẳn Postgres → GET vẫn trả được từ cache)
- [ ] Tắt Redis → app **vẫn hoạt động bình thường**, chỉ chậm hơn (graceful degradation)
- [ ] TTL các key khác nhau (jitter hoạt động) — `redis-cli TTL` vài key mà xem
- [ ] Tạo order mới → key cache cũ của order đó bị xóa (invalidate-on-write)
- [ ] Graceful shutdown gọi `repo.close()` — Redis quit + pool end theo chuỗi decorator

## 5. Câu hỏi tự kiểm tra (trả lời to thành tiếng)

1. Cache-aside khác read-through/write-through thế nào? Tại sao ở đây chọn cache-aside?
2. Vì sao invalidate (DEL) khi write lại an toàn hơn là SET đè giá trị mới?
3. Nếu 1000 request cùng miss một key hot thì sao? (gợi ý: mutex/lock, single-flight — tuần 5 phần cache stampede)
4. Khi nào KHÔNG nên cache? (dữ liệu đổi liên tục, yêu cầu strong consistency…)

> Tiếp theo: học xong tuần 6 → `UPGRADE-03-KAFKA` (outbox pattern, publish event OrderCreated).
