# Tuần 5: Redis

> 🧪 **Có lab tận tay!** Xem [`lab/LAB.md`](lab/LAB.md) — `docker compose up` + chạy thử cache-aside, rate-limit, leaderboard, pub/sub với `redis.conf` có chú thích từng dòng.

## 🎯 Mục tiêu tuần này

- Hiểu sâu tại sao Redis nhanh (in-memory, single-threaded event loop, I/O multiplexing) — không trả lời hời hợt "vì nó là cache".
- Thành thạo các data structures và chọn đúng cấu trúc cho từng use case (leaderboard, rate limit, counter, queue...).
- Nắm vững caching patterns và xử lý được 3 vấn đề kinh điển: **stampede, penetration, avalanche** — đây là cụm câu hỏi "ăn tiền" nhất khi phỏng vấn về Redis.
- Hiểu persistence (RDB/AOF), HA (Sentinel/Cluster), eviction policies, hot key.
- Tự cài đặt được distributed lock và rate limiter bằng `ioredis` với Node.js.

## 📚 Lý thuyết

### Ngày 1-2: Redis cơ bản — Tại sao nhanh & Data Structures

#### 1. Redis là gì & tại sao nhanh?

Redis (REmote DIctionary Server) là **in-memory data structure store** — dùng làm cache, database, message broker, lock manager. Có thể xử lý ~100K+ ops/giây trên một instance. Ba lý do khiến nó nhanh (trả lời đủ cả 3 khi phỏng vấn):

1. **In-memory:** mọi thao tác trên RAM (~100ns) thay vì disk (~ms). Đây là yếu tố lớn nhất.
2. **Single-threaded command execution:** mọi lệnh chạy tuần tự trên 1 thread → **không cần lock**, không context switching, không race condition trong engine. Mỗi lệnh đơn lẻ là **atomic** một cách tự nhiên. (Từ Redis 6, I/O đọc/ghi socket có thể multi-thread, nhưng *thực thi lệnh* vẫn single-thread.)
3. **I/O multiplexing (epoll/kqueue):** một thread phục vụ hàng chục nghìn connection bằng event loop — y hệt cơ chế của Node.js. Kết hợp với data structures được tối ưu (SDS string, skiplist, ziplist/listpack).

**Hệ quả quan trọng của single-thread:** một lệnh chậm (vd `KEYS *`, `SMEMBERS` trên set 10 triệu phần tử, Lua script dài) sẽ **block toàn bộ Redis**. Vì vậy: cấm `KEYS` trên production (dùng `SCAN`), cẩn thận các lệnh O(N).

```js
// Setup ioredis
const Redis = require('ioredis');
const redis = new Redis({ host: 'localhost', port: 6379 });
```

#### 2. Data Structures & Use Cases

**String** — giá trị tối đa 512MB; lưu text, số, JSON, binary.
```js
await redis.set('user:1:name', 'Linh');
await redis.set('session:abc', JSON.stringify(session), 'EX', 3600); // kèm TTL
await redis.incr('page:home:views');           // atomic counter
await redis.set('lock:order:9', 'tok', 'EX', 10, 'NX'); // SET NX — nền tảng của lock
```
Use case: cache JSON, session, counter (view, like), distributed lock, feature flag.

**Hash** — map field→value trong một key. Tiết kiệm hơn nhiều string keys, update từng field không cần đọc/ghi cả JSON.
```js
await redis.hset('user:1', { name: 'Linh', age: 28, city: 'HN' });
await redis.hincrby('user:1', 'loginCount', 1);
const user = await redis.hgetall('user:1');
```
Use case: object cache (user profile), shopping cart (`field=productId, value=qty`).

**List** — linked list hai đầu, push/pop O(1).
```js
await redis.lpush('queue:emails', JSON.stringify(job));
const job = await redis.brpop('queue:emails', 5);   // blocking pop → worker queue
await redis.lpush('feed:user:1', postId);
await redis.ltrim('feed:user:1', 0, 99);            // giữ 100 item mới nhất
```
Use case: simple job queue (producer LPUSH, consumer BRPOP), timeline/feed gần đây, log buffer.

**Set** — tập hợp không trùng, hỗ trợ giao/hợp/hiệu.
```js
await redis.sadd('post:9:likes', userId);
await redis.sismember('post:9:likes', userId);       // đã like chưa? O(1)
await redis.sinter('friends:1', 'friends:2');        // bạn chung
await redis.srandmember('lottery:players', 3);       // bốc thăm
```
Use case: unique tracking (ai đã like/vote), tag, mutual friends, random sampling.

**Sorted Set (ZSET)** — set có score, sắp xếp theo score (skiplist). Cấu trúc "đáng tiền" nhất.
```js
await redis.zincrby('leaderboard', 50, 'player:7');
await redis.zrevrange('leaderboard', 0, 9, 'WITHSCORES');  // top 10
await redis.zrevrank('leaderboard', 'player:7');           // hạng của tôi
// dùng timestamp làm score → sliding window rate limit, delayed queue
await redis.zadd('delayed:jobs', Date.now() + 60000, jobId);
```
Use case: leaderboard, ranking, sliding window rate limiter, delayed job, priority queue.

**Bitmap** — string thao tác theo bit. 1 bit/user → 10 triệu user chỉ tốn ~1.2MB.
```js
await redis.setbit(`active:2026-06-10`, userId, 1);  // user online hôm nay
await redis.bitcount('active:2026-06-10');           // DAU
// Điểm danh liên tục 7 ngày: BITOP AND nhiều bitmap theo ngày
```
Use case: daily active users, check-in/điểm danh, bloom-filter thủ công.

**HyperLogLog** — đếm cardinality (số phần tử duy nhất) **xấp xỉ** (sai số ~0.81%) với chỉ **12KB** bất kể tỉ phần tử.
```js
await redis.pfadd('uv:2026-06-10', ip1, ip2);
await redis.pfcount('uv:2026-06-10');                // unique visitors
```
Use case: đếm UV, unique search terms — nơi chấp nhận sai số nhỏ đổi lấy bộ nhớ tí hon.

**Stream** — append-only log giống Kafka mini: có consumer group, ack, pending list, ID dạng `timestamp-seq`.
```js
await redis.xadd('orders:events', '*', 'type', 'created', 'orderId', '9');
await redis.xgroup('CREATE', 'orders:events', 'gr1', '$', 'MKSTREAM');
const msgs = await redis.xreadgroup('GROUP', 'gr1', 'consumer1',
  'COUNT', 10, 'BLOCK', 5000, 'STREAMS', 'orders:events', '>');
await redis.xack('orders:events', 'gr1', msgId);
```
Use case: event log nhẹ, task queue cần ack/retry mà chưa muốn dựng Kafka.

### Ngày 3-4: Caching Patterns, các vấn đề kinh điển & Persistence

#### 1. Caching Patterns

**Cache-Aside (Lazy Loading)** — phổ biến nhất, app tự quản lý cache:
```js
async function getProduct(id) {
  const key = `product:${id}`;
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);            // cache hit

  const product = await db.products.findById(id);    // cache miss → đọc DB
  if (product) await redis.set(key, JSON.stringify(product), 'EX', 300);
  return product;
}
// Khi update: ghi DB rồi XOÁ cache (không update cache — tránh race)
async function updateProduct(id, data) {
  await db.products.update(id, data);
  await redis.del(`product:${id}`);
}
```
Ưu: đơn giản, chỉ cache cái được đọc, Redis chết app vẫn chạy (chậm). Nhược: miss đầu tiên chậm, có khoảng cửa sổ inconsistency.

**Read-Through:** giống cache-aside nhưng tầng cache (library/proxy) tự load từ DB, app chỉ hỏi cache. **Write-Through:** ghi cache + DB đồng bộ trong cùng thao tác — cache luôn fresh, nhưng write chậm hơn và cache cả thứ không bao giờ đọc. **Write-Behind (write-back):** ghi cache trước, trả lời ngay, flush xuống DB **bất đồng bộ** theo batch — write cực nhanh (counter view, like), nhưng **rủi ro mất dữ liệu** nếu Redis chết trước khi flush.

**Câu hỏi kinh điển: tại sao "ghi DB rồi DELETE cache" thay vì "UPDATE cache"?** Vì 2 write update cache đồng thời có thể đến cache theo thứ tự ngược với DB → cache sai vĩnh viễn. DELETE thì tệ nhất chỉ là 1 lần cache miss. (Nâng cao hơn nữa: delayed double delete, hoặc CDC/binlog → invalidate.)

#### 2. Cache Invalidation & TTL Strategy

- Mọi key cache **phải có TTL** — TTL là lưới an toàn cuối cùng cho mọi bug invalidation.
- TTL ngắn cho dữ liệu thay đổi nhanh (giá, stock: 10-60s), dài cho dữ liệu tĩnh (category: giờ/ngày).
- **Jitter:** cộng ngẫu nhiên ±10-20% vào TTL để các key không hết hạn đồng loạt (chống avalanche): `EX 300 + Math.floor(Math.random()*60)`.
- Versioned key: `product:v2:{id}` — đổi version khi đổi format dữ liệu, khỏi phải xoá hàng loạt.

#### 3. Ba vấn đề kinh điển — BẮT BUỘC trả lời được

**Cache Stampede / Thundering Herd:** một **hot key** hết hạn, 10.000 request cùng miss → 10.000 query giống nhau đập vào DB cùng lúc.
Giải pháp:
- **Mutex/lock:** chỉ 1 request được rebuild cache, số còn lại đợi hoặc dùng giá trị cũ:
```js
async function getWithLock(key, loader, ttl = 300) {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const lockKey = `lock:${key}`;
  const acquired = await redis.set(lockKey, '1', 'EX', 10, 'NX');
  if (acquired) {
    try {
      const data = await loader();                       // chỉ mình tôi query DB
      await redis.set(key, JSON.stringify(data), 'EX', ttl);
      return data;
    } finally { await redis.del(lockKey); }
  }
  await new Promise(r => setTimeout(r, 100));            // người khác: đợi rồi thử lại
  return getWithLock(key, loader, ttl);
}
```
- **Request coalescing trong process:** Node.js single-process chỉ cần map `key → Promise` đang bay, các request sau `await` chung promise.
- **Early/probabilistic refresh (xfetch):** refresh trước khi hết hạn theo xác suất, hoặc background job refresh hot key định kỳ — key "logic expire" không bao giờ thật sự hết hạn.

**Cache Penetration:** truy vấn key **không tồn tại trong cả cache lẫn DB** (id âm, id random — thường do attacker) → mọi request đều xuyên thủng xuống DB.
Giải pháp: (1) **cache negative result** — lưu `"NULL"` với TTL ngắn 30-60s; (2) **Bloom filter** chứa toàn bộ id hợp lệ — không có trong filter thì chặn ngay không cần hỏi DB; (3) validate input (id phải đúng format) tại API layer.

**Cache Avalanche:** **hàng loạt key hết hạn cùng lúc** (cache vừa warm cùng thời điểm) hoặc **Redis sập** → toàn bộ traffic dồn vào DB → DB sập → toàn hệ thống sập dây chuyền.
Giải pháp: TTL jitter; Redis HA (Sentinel/Cluster); circuit breaker + rate limit trước DB; multi-level cache (in-process LRU + Redis); warm-up cache khi deploy.

So sánh nhanh để khỏi lẫn: **Stampede = 1 hot key hết hạn**; **Penetration = key không bao giờ tồn tại**; **Avalanche = nhiều key chết cùng lúc / cache chết**.

#### 4. Persistence: RDB vs AOF

- **RDB (snapshot):** fork process con, dump toàn bộ dataset ra file `.rdb` nhị phân theo lịch (`save 900 1`...). Ưu: file compact, restore nhanh, ít ảnh hưởng performance. Nhược: **mất dữ liệu giữa 2 lần snapshot** (vài phút); fork tốn RAM (copy-on-write) với dataset lớn.
- **AOF (Append Only File):** ghi lại **mọi lệnh write** vào file log. `appendfsync everysec` (mặc định — mất tối đa 1 giây dữ liệu) / `always` (an toàn nhất, chậm) / `no` (OS quyết định). File phình to → **AOF rewrite** nén lại. Ưu: bền dữ liệu hơn nhiều. Nhược: file lớn hơn, restore chậm hơn.
- **Thực tế production:** bật cả hai — AOF để bền, RDB để restore nhanh + backup. Redis 7 có thêm hybrid (RDB preamble + AOF tail). Nếu Redis *chỉ là cache thuần*, có thể tắt persistence hoàn toàn.

#### 5. Pub/Sub vs Streams

- **Pub/Sub:** fire-and-forget, **không lưu message** — subscriber offline là mất, không ack, không replay. Dùng cho: realtime broadcast (chat fanout giữa các Node instance + Socket.IO adapter, invalidate local cache giữa các app instance).
- **Streams:** message **được lưu lại**, có consumer group (chia việc), ack, pending list (xử lý consumer chết giữa chừng), replay từ ID bất kỳ, `XAUTOCLAIM` để claim message kẹt. Dùng khi cần độ tin cậy: task queue, event log.
- Chốt phỏng vấn: *"Mất message có sao không? Không sao → Pub/Sub. Có sao → Streams (hoặc Kafka khi cần scale/retention lớn)."*

### Ngày 5-6: Distributed Lock, Rate Limiting, HA & vận hành

#### 1. Distributed Lock

**Lock đơn giản với SET NX** — đúng chuẩn phải có đủ 3 yếu tố: NX (chỉ set khi chưa tồn tại), **TTL** (holder chết thì lock tự nhả — chống deadlock), **token ngẫu nhiên** (chỉ chủ lock mới được unlock):

```js
const { randomUUID } = require('crypto');

async function acquireLock(key, ttlMs = 10000) {
  const token = randomUUID();
  const ok = await redis.set(`lock:${key}`, token, 'PX', ttlMs, 'NX');
  return ok ? token : null;
}

// Unlock PHẢI bằng Lua: check token + del phải atomic.
// Nếu GET rồi DEL ở app: lock hết hạn giữa 2 lệnh → bạn xoá nhầm lock của người khác.
const UNLOCK_LUA = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else return 0 end`;
async function releaseLock(key, token) {
  return redis.eval(UNLOCK_LUA, 1, `lock:${key}`, token);
}
```

**Vấn đề còn lại:** process giữ lock bị GC pause/chậm quá TTL → lock hết hạn, người khác vào, **2 người cùng trong critical section**. Giảm thiểu bằng watchdog (gia hạn TTL định kỳ khi còn sống — Redisson làm vậy) và **fencing token** (số tăng dần kèm theo lock, resource từ chối token cũ).

**Redlock và tranh cãi:** Redlock = lấy lock trên N (5) Redis node độc lập, thành công khi đa số đồng ý trong thời gian đủ ngắn — chống mất lock khi 1 node Redis chết. **Martin Kleppmann phản biện:** Redlock phụ thuộc giả định về clock và timing không an toàn; với mục đích **correctness** (không bao giờ được 2 holder) thì không nên dùng — hãy dùng hệ có consensus (ZooKeeper/etcd) + fencing token. **Antirez phản hồi** bảo vệ Redlock cho đa số trường hợp thực tế. Kết luận chuẩn phỏng vấn: *lock cho efficiency (tránh làm việc trùng lặp, sai cũng không chết ai) → Redis lock đơn + TTL là đủ; lock cho correctness tuyệt đối → fencing token + consensus store.*

#### 2. Rate Limiting với Redis

**Fixed Window** — đơn giản nhất, đếm theo cửa sổ cố định:
```js
async function fixedWindow(userId, limit = 100, windowSec = 60) {
  const key = `rl:${userId}:${Math.floor(Date.now() / 1000 / windowSec)}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSec);
  return count <= limit;
}
// Nhược: burst ở ranh giới — 100 req cuối phút này + 100 req đầu phút sau = 200 req/vài giây
```

**Sliding Window Log** — chính xác, dùng ZSET với timestamp làm score:
```js
async function slidingWindow(userId, limit = 100, windowMs = 60000) {
  const key = `rl:sw:${userId}`;
  const now = Date.now();
  const results = await redis.multi()
    .zremrangebyscore(key, 0, now - windowMs)   // xoá request ngoài cửa sổ
    .zadd(key, now, `${now}-${Math.random()}`)  // ghi request hiện tại
    .zcard(key)                                  // đếm trong cửa sổ
    .pexpire(key, windowMs)
    .exec();
  return results[2][1] <= limit;
}
// Chính xác nhưng tốn memory O(số request trong cửa sổ)
```

**Token Bucket** — cho phép burst có kiểm soát, refill đều đặn; phải dùng Lua để atomic:
```js
const TOKEN_BUCKET_LUA = `
  local key, rate, capacity, now = KEYS[1], tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])
  local data = redis.call('HMGET', key, 'tokens', 'ts')
  local tokens = tonumber(data[1]) or capacity
  local ts = tonumber(data[2]) or now
  tokens = math.min(capacity, tokens + (now - ts) / 1000 * rate)  -- refill
  local allowed = tokens >= 1
  if allowed then tokens = tokens - 1 end
  redis.call('HMSET', key, 'tokens', tokens, 'ts', now)
  redis.call('PEXPIRE', key, math.ceil(capacity / rate * 1000) * 2)
  return allowed and 1 or 0`;

async function tokenBucket(userId, ratePerSec = 10, capacity = 20) {
  return await redis.eval(TOKEN_BUCKET_LUA, 1, `rl:tb:${userId}`,
    ratePerSec, capacity, Date.now()) === 1;
}
```
So sánh: fixed window (rẻ, có burst biên), sliding window (chính xác, tốn RAM), token bucket (chuẩn công nghiệp — smooth + cho burst, hơi phức tạp). Sliding window **counter** (nội suy 2 cửa sổ) là điểm cộng nếu nêu được.

#### 3. Redis Sentinel & Cluster (HA + Scale)

- **Replication:** 1 master (write) + N replicas (read, **async** replication → có thể mất vài write khi failover).
- **Sentinel:** bộ process giám sát master; khi master chết, các Sentinel đồng thuận (quorum) và **tự động promote** replica thành master. Client (ioredis hỗ trợ sẵn) hỏi Sentinel "master hiện tại là ai". Giải quyết **HA**, không giải quyết scale write/memory — toàn bộ data vẫn nằm trên 1 master.
```js
const redis = new Redis({
  sentinels: [{ host: 's1', port: 26379 }, { host: 's2', port: 26379 }, { host: 's3', port: 26379 }],
  name: 'mymaster'
});
```
- **Cluster:** sharding chính chủ — keyspace chia thành **16384 hash slots**, mỗi master node giữ một dải slot, mỗi master có replica riêng → vừa HA vừa scale write/memory. Hạn chế: lệnh multi-key (MGET, SINTER, transaction, Lua nhiều key) chỉ chạy khi các key **cùng slot** → dùng **hash tag**: `cart:{user1}:items` và `profile:{user1}` (chỉ phần trong `{}` được hash).
```js
const cluster = new Redis.Cluster([{ host: 'node1', port: 6379 }]);
```
- Chọn: chỉ cần HA, data < RAM 1 máy → Sentinel. Cần scale write/memory vượt 1 máy → Cluster.

#### 4. Eviction Policies & Hot Key

**Eviction** — khi đạt `maxmemory`, Redis làm gì:
- `noeviction` (mặc định): từ chối write, báo lỗi — hợp khi Redis là database.
- `allkeys-lru`: đuổi key ít dùng gần đây nhất trong **mọi** key — **chuẩn cho cache thuần**.
- `volatile-lru`: chỉ đuổi key **có TTL** — khi trộn cache + data quan trọng (data không đặt TTL).
- `allkeys-lfu` / `volatile-lfu` (Redis 4+): theo **tần suất** — chống trường hợp key được quét 1 lần (backup scan) đá mất hot key thật. LRU/LFU của Redis là **xấp xỉ** (sample ngẫu nhiên ~5 key) để tiết kiệm tài nguyên.
- `volatile-ttl`, `allkeys-random`, `volatile-random`.

**Hot key problem:** một key được đọc cực nhiều (sản phẩm flash-sale, celebrity profile) → 1 node Cluster gánh toàn bộ (sharding không cứu được vì 1 key = 1 slot = 1 node), băng thông node nghẽn. Giải pháp: (1) **local cache in-process** (LRU trong Node.js, TTL 1-5s) chặn phần lớn read; (2) **key replication thủ công:** nhân bản `hotkey:1..N`, mỗi client random đọc 1 bản; (3) read từ replicas (`READONLY` mode); (4) phát hiện bằng `redis-cli --hotkeys` hoặc `MONITOR` (cẩn thận, MONITOR rất nặng).

## 💬 Top 15 câu hỏi phỏng vấn thường gặp

**Q1: Tại sao Redis nhanh dù single-threaded?**
**A:** Ba lý do: dữ liệu nằm hoàn toàn trên RAM; single-thread loại bỏ chi phí lock và context switching, mỗi lệnh atomic tự nhiên; I/O multiplexing (epoll) cho phép 1 thread phục vụ hàng chục nghìn connection. Bottleneck thường là network/memory chứ không phải CPU.

**Q2: Single-thread của Redis có nhược điểm gì?**
**A:** Một lệnh chậm block toàn bộ server — `KEYS *` hay thao tác O(N) trên collection lớn làm mọi client treo. Vì vậy production cấm KEYS (dùng SCAN), tránh lệnh trên tập dữ liệu lớn, và chia nhỏ Lua script dài.

**Q3: Khi nào dùng Hash thay vì String chứa JSON?**
**A:** Khi cần đọc/ghi từng field riêng lẻ (HGET/HSET/HINCRBY) mà không phải deserialize cả object, hoặc cần atomic increment một field. String JSON hợp khi luôn đọc/ghi cả object và cần lưu nested structure.

**Q4: Thiết kế leaderboard realtime cho 10 triệu người chơi?**
**A:** Sorted Set: ZINCRBY khi có điểm, ZREVRANGE 0 9 cho top 10, ZREVRANK cho hạng của user — tất cả O(logN). Nếu quá lớn, shard theo mùa giải/khu vực, hoặc chỉ giữ top N + đếm phần đuôi xấp xỉ.

**Q5: Cache-aside hoạt động thế nào, và khi update dữ liệu thì update hay delete cache?**
**A:** Đọc: hit thì trả từ cache, miss thì đọc DB và set cache kèm TTL. Khi update: ghi DB rồi **delete** cache — vì update cache song song có thể đến sai thứ tự gây cache sai vĩnh viễn, còn delete tệ nhất chỉ tốn một lần miss.

**Q6: Phân biệt cache stampede, penetration, avalanche?**
**A:** Stampede: 1 hot key hết hạn, nghìn request cùng rebuild → mutex lock/request coalescing/early refresh. Penetration: query key không tồn tại trong DB → cache negative + Bloom filter. Avalanche: hàng loạt key hết hạn cùng lúc hoặc Redis sập → TTL jitter + HA + circuit breaker.

**Q7: RDB vs AOF — khác nhau và production dùng gì?**
**A:** RDB snapshot định kỳ: compact, restore nhanh, nhưng mất dữ liệu giữa 2 snapshot. AOF ghi log mọi lệnh write (fsync everysec mất tối đa ~1s): bền hơn nhưng file lớn, restore chậm. Production thường bật cả hai; Redis làm cache thuần thì có thể tắt hết.

**Q8: Redis Pub/Sub khác Streams thế nào?**
**A:** Pub/Sub fire-and-forget: không lưu message, subscriber offline là mất, không ack — hợp broadcast realtime. Streams lưu message, có consumer group, ack, pending list, replay — hợp task queue/event log cần độ tin cậy. Quy tắc: mất message không sao → Pub/Sub; có sao → Streams.

**Q9: Cài distributed lock với Redis cần lưu ý gì?**
**A:** SET key token NX PX ttl — phải có TTL chống deadlock và token random để chỉ chủ lock unlock được; unlock phải bằng Lua script (check token + del atomic). Rủi ro còn lại: GC pause khiến holder vượt TTL → cần watchdog gia hạn hoặc fencing token nếu yêu cầu correctness.

**Q10: Redlock là gì và tranh cãi quanh nó?**
**A:** Redlock lấy lock trên đa số trong 5 Redis node độc lập để chịu được node chết. Kleppmann phản biện rằng nó dựa trên giả định timing/clock không an toàn cho correctness; Antirez bảo vệ cho use case thực tế. Kết luận: lock để tránh làm việc trùng (efficiency) → Redis đơn là đủ; lock cho correctness → consensus store + fencing token.

**Q11: So sánh fixed window, sliding window, token bucket cho rate limiting?**
**A:** Fixed window rẻ nhất nhưng cho phép burst gấp đôi ở ranh giới cửa sổ. Sliding window log (ZSET) chính xác nhưng tốn memory theo số request. Token bucket refill đều + cho burst tới capacity — chuẩn công nghiệp, cần Lua script để atomic.

**Q12: Sentinel khác Cluster thế nào?**
**A:** Sentinel chỉ lo HA: giám sát và tự failover master, toàn bộ data vẫn trên 1 master — không scale write/memory. Cluster shard data ra 16384 slots trên nhiều master (mỗi master có replica) → vừa HA vừa scale, đổi lại multi-key operation bị giới hạn cùng slot (giải bằng hash tag `{...}`).

**Q13: Eviction policy nào cho cache thuần, policy nào khi trộn data quan trọng?**
**A:** Cache thuần: `allkeys-lru` (hoặc `allkeys-lfu` nếu sợ scan một lần đá mất hot key). Trộn data quan trọng: `volatile-lru` — chỉ đuổi key có TTL, data quan trọng không đặt TTL nên an toàn. Mặc định `noeviction` sẽ từ chối write khi đầy memory.

**Q14: Hot key là gì và xử lý ra sao?**
**A:** Một key được truy cập áp đảo (flash sale) khiến 1 node Cluster nghẽn vì 1 key chỉ nằm trên 1 node. Xử lý: local cache in-process TTL ngắn chặn phần lớn read, nhân bản key thành N bản đọc random, hoặc đọc từ replica. Phát hiện bằng `redis-cli --hotkeys`.

**Q15: Tại sao phải dùng Lua script trong Redis? Có đánh đổi gì?**
**A:** Lua chạy atomic trên server — gom nhiều lệnh thành một đơn vị không bị xen kẽ (check-then-act như unlock, token bucket), giảm round-trip. Đánh đổi: script chạy lâu block toàn server (single-thread), và trên Cluster mọi key trong script phải cùng slot.

## 💪 Bài tập thực hành (bắt buộc)

### Bài 1: Cache-aside middleware cho Express (cơ bản)
**Đề:** Xây API Express `GET /products/:id` đọc từ PostgreSQL/MongoDB (hoặc giả lập DB bằng hàm có `setTimeout` 300ms). Viết middleware cache-aside với ioredis: TTL 60s + jitter ±10s, header `X-Cache: HIT|MISS`, và `PUT /products/:id` ghi DB xong delete cache.
**Yêu cầu output:** Dùng `autocannon -c 50 -d 10` đo và ghi lại req/s + latency p99 khi có cache vs khi tắt cache (chênh lệch phải rõ rệt); log chứng minh sau PUT thì request kế tiếp là MISS.
**Gợi ý:** key đặt dạng `product:v1:{id}`; serialize bằng JSON.stringify; nhớ xử lý cả trường hợp Redis down (try/catch → fallback DB, đừng để API chết theo cache).

### Bài 2: Realtime leaderboard + DAU tracking (cơ bản–trung bình)
**Đề:** Xây service game điểm số: `POST /score {userId, points}` cộng điểm; `GET /leaderboard?limit=10` trả top kèm rank; `GET /users/:id/rank` trả hạng + điểm + 2 người ngay trên/dưới; mỗi lần ghi điểm đánh dấu user active hôm nay bằng Bitmap; `GET /stats/dau?date=` trả DAU.
**Yêu cầu output:** Seed 100.000 user điểm random; cả 3 endpoint đọc phải trả về < 10ms (log thời gian xử lý); DAU đúng với số user đã ghi điểm trong ngày.
**Gợi ý:** ZINCRBY, ZREVRANGE WITHSCORES, ZREVRANK; lân cận = ZREVRANGE quanh rank của user; bitmap key theo ngày `active:{yyyy-mm-dd}` + SETBIT theo userId số nguyên.

### Bài 3: Chống stampede + penetration (trung bình)
**Đề:** Mở rộng bài 1: viết hàm `getCached(key, loader, ttl)` chống stampede bằng 2 lớp — (1) request coalescing trong process (map key→Promise đang bay), (2) mutex lock qua Redis SET NX cho nhiều instance. Chống penetration bằng negative cache (`"NULL"`, TTL 30s). 
**Yêu cầu output:** Test 1: xoá key rồi bắn 200 request đồng thời vào cùng 1 id → counter trong loader chỉ tăng **1** (in counter ra để chứng minh). Test 2: bắn 100 request id không tồn tại → DB chỉ bị query 1 lần, các lần sau trả 404 từ cache.
**Gợi ý:** loader bọc qua biến đếm `let dbCalls = 0`; coalescing: `if (inflight.has(key)) return inflight.get(key)`; nhớ `finally { inflight.delete(key) }`.

### Bài 4: Rate limiter 3 thuật toán + so sánh (trung bình–khó)
**Đề:** Cài middleware rate limit cho Express theo 3 thuật toán: fixed window (INCR+EXPIRE), sliding window log (ZSET + MULTI), token bucket (Lua script). Limit 10 req/10s mỗi IP, trả 429 + header `X-RateLimit-Remaining`, `Retry-After`.
**Yêu cầu output:** Viết script test bắn 15 request liên tiếp → đúng 10 pass / 5 bị 429 ở cả 3 thuật toán. Test riêng boundary burst: bắn 10 req ở giây thứ 9 và 10 req ở giây thứ 11 — chỉ ra fixed window cho qua cả 20 còn sliding window thì không (in kết quả 2 cột so sánh).
**Gợi ý:** dùng `redis.defineCommand('tokenBucket', { numberOfKeys: 1, lua: ... })` của ioredis cho gọn; thời gian lấy từ `Date.now()` truyền vào ARGV để dễ test.

### Bài 5: Distributed lock cho cron job đa instance (khó)
**Đề:** Có job "gửi email báo cáo" chạy mỗi 10 giây bằng `setInterval`. Chạy **3 instance** app cùng lúc (3 process Node). Yêu cầu: mỗi chu kỳ chỉ đúng 1 instance chạy job. Cài lock SET NX PX + token UUID + unlock bằng Lua; thêm watchdog gia hạn TTL mỗi 3s khi job còn chạy (job giả lập random 2-8s, TTL lock 5s).
**Yêu cầu output:** Log của 3 process trong 2 phút: mỗi chu kỳ chỉ 1 dòng "RUNNING job" (kèm instance id); kill -9 instance đang giữ lock giữa chừng → chu kỳ sau instance khác chiếm được lock (log timeline chứng minh, lock được nhả nhờ TTL chứ không kẹt vĩnh viễn).
**Gợi ý:** chạy 3 process bằng `node app.js 1 &`... hoặc `concurrently`; watchdog = `setInterval` PEXPIRE qua Lua có check token, nhớ clear khi job xong; thử bỏ watchdog đi và quan sát job 8s với TTL 5s bị instance khác chen vào — ghi lại hiện tượng.

## 📝 Bài test cuối tuần

### Phần 1: Quiz 15 câu trắc nghiệm

**Câu 1:** Yếu tố nào KHÔNG phải lý do Redis nhanh?
A. Dữ liệu trên RAM  B. I/O multiplexing  C. Thực thi lệnh đa luồng song song  D. Không tốn chi phí lock do single-thread

**Câu 2:** Lệnh nào bị cấm dùng trên production Redis có nhiều key?
A. SCAN  B. KEYS *  C. GET  D. TTL

**Câu 3:** Cấu trúc dữ liệu phù hợp nhất cho leaderboard?
A. List  B. Hash  C. Sorted Set  D. Set

**Câu 4:** Đếm unique visitors hàng chục triệu/ngày, chấp nhận sai số ~1%, tiết kiệm memory nhất dùng?
A. Set  B. HyperLogLog  C. Bitmap  D. Hash

**Câu 5:** Trong cache-aside, khi update dữ liệu nên làm gì với cache?
A. Update cache trước rồi update DB  B. Update DB rồi update cache  C. Update DB rồi delete cache  D. Không cần làm gì, chờ TTL

**Câu 6:** 10.000 request cùng miss một hot key vừa hết hạn và cùng đập vào DB — đây là?
A. Cache penetration  B. Cache stampede  C. Cache avalanche  D. Hot key problem

**Câu 7:** Bloom filter giải quyết vấn đề nào?
A. Stampede  B. Penetration (key không tồn tại trong DB)  C. Avalanche  D. Replication lag

**Câu 8:** TTL jitter (cộng random vào TTL) nhằm chống?
A. Stampede trên 1 key  B. Avalanche do nhiều key hết hạn đồng loạt  C. Penetration  D. Hot key

**Câu 9:** AOF với `appendfsync everysec` có thể mất tối đa bao nhiêu dữ liệu khi crash?
A. Không mất gì  B. ~1 giây write  C. Toàn bộ từ lần snapshot trước  D. 1 lệnh cuối cùng

**Câu 10:** Khác biệt cốt lõi giữa Pub/Sub và Streams?
A. Pub/Sub nhanh hơn nên tốt hơn mọi mặt  B. Streams lưu message + ack + consumer group, Pub/Sub fire-and-forget  C. Pub/Sub chỉ chạy trên Cluster  D. Streams không dùng được với Node.js

**Câu 11:** Tại sao unlock distributed lock phải dùng Lua script?
A. Lua nhanh hơn lệnh thường  B. GET-check-DEL ở app không atomic — lock có thể hết hạn giữa chừng và bạn xoá nhầm lock của holder mới  C. Redis bắt buộc unlock bằng Lua  D. Để code ngắn hơn

**Câu 12:** Phản biện chính của Kleppmann về Redlock?
A. Redlock quá chậm  B. Redlock dựa trên giả định timing/clock không an toàn cho correctness; nên dùng fencing token + consensus store  C. Redlock không chạy trên Cluster  D. Redlock tốn memory

**Câu 13:** Thuật toán rate limit nào bị "boundary burst" (gấp đôi limit quanh ranh giới)?
A. Sliding window log  B. Token bucket  C. Fixed window  D. Leaky bucket

**Câu 14:** Redis Cluster yêu cầu gì với lệnh multi-key (MGET, transaction)?
A. Không hỗ trợ trong mọi trường hợp  B. Các key phải cùng hash slot (dùng hash tag `{...}`)  C. Phải bật chế độ đặc biệt  D. Chỉ chạy trên replica

**Câu 15:** Redis làm cache thuần, đầy memory thì nên dùng eviction policy nào?
A. noeviction  B. volatile-ttl  C. allkeys-lru (hoặc allkeys-lfu)  D. volatile-random

<details><summary>Đáp án</summary>

1. **C** — thực thi lệnh là single-thread (Redis 6+ chỉ đa luồng phần I/O socket).
2. **B** — KEYS quét toàn bộ keyspace O(N) và block server; thay bằng SCAN incremental.
3. **C** — ZSET cho insert/update/rank/range theo score đều O(logN).
4. **B** — HLL chỉ tốn ~12KB với sai số ~0.81%; Set chính xác nhưng tốn GB; Bitmap cần userId là số nguyên liên tục.
5. **C** — delete an toàn hơn update vì 2 update đồng thời có thể đến cache sai thứ tự so với DB.
6. **B** — stampede/thundering herd: 1 hot key hết hạn → rebuild đồng loạt; giải bằng lock/coalescing/early refresh.
7. **B** — filter chứa các id hợp lệ, request id "chắc chắn không có" bị chặn trước khi đụng DB.
8. **B** — rải thời điểm hết hạn để tránh dồn cục.
9. **B** — fsync mỗi giây nên crash mất tối đa khoảng 1 giây lệnh write.
10. **B** — Streams có persistence, consumer group, ack, pending list, replay; Pub/Sub không lưu gì.
11. **B** — check token và del phải là một thao tác atomic, nếu không sẽ có cửa sổ race xoá nhầm.
12. **B** — đúng nội dung bài "How to do distributed locking"; phân biệt lock efficiency vs correctness.
13. **C** — fixed window reset counter ở ranh giới nên 2 cửa sổ liền kề có thể nhận 2×limit trong thời gian ngắn.
14. **B** — keyspace chia 16384 slot; hash tag bắt các key liên quan vào cùng slot.
15. **C** — cache thuần muốn mọi key đều có thể bị đuổi theo độ "nguội"; noeviction sẽ làm write lỗi khi đầy.

</details>

### Phần 2: Bài thực hành chấm điểm

**Đề bài: Xây "Flash Sale Service" chịu tải cao bằng Node.js + Redis**

Bối cảnh: sale 1.000 sản phẩm X lúc 9h sáng, dự kiến 50.000 user bấm mua trong phút đầu. Yêu cầu:
1. `GET /sale/products/:id` — thông tin + số lượng còn lại; chịu được hot key (local cache in-process TTL 1-2s + Redis), kèm chống stampede.
2. `POST /sale/orders` — mua hàng: **không oversell** (trừ kho atomic bằng Lua: check stock + DECR + ghi user đã mua trong 1 script), mỗi user chỉ mua tối đa 1 sản phẩm (Set kiểm tra), rate limit 5 req/s mỗi user (token bucket).
3. Đơn thành công đẩy vào Redis Stream `orders:stream`; một worker process riêng đọc qua consumer group, "ghi DB" (giả lập 100ms), ack; xử lý message pending khi worker crash (XAUTOCLAIM).
4. Script load test: 5.000 request đồng thời từ 2.000 user giả → kiểm chứng đúng 1.000 đơn thành công, kho cuối = 0, không user nào mua được 2 lần.

**Checklist tiêu chí chấm điểm:**

- [ ] Trừ kho bằng Lua script atomic (check + decrement + mark user trong 1 script) — tuyệt đối không read-check-write từ app
- [ ] Load test pass: đúng 1.000 success, stock = 0 không âm, không user trùng
- [ ] Rate limiter token bucket hoạt động (test riêng chứng minh 429)
- [ ] Hot key được giảm tải bằng local cache TTL ngắn (so sánh số lệnh Redis trước/sau bằng `INFO commandstats` hoặc counter)
- [ ] Chống stampede có coalescing hoặc mutex, có test chứng minh loader chỉ chạy 1 lần
- [ ] Stream + consumer group đúng: ack sau khi xử lý xong, kill worker giữa chừng không mất đơn (pending được claim lại)
- [ ] Xử lý Redis down gracefully (API trả 503 có kiểm soát, không crash process)
- [ ] Code tách lớp rõ (route / service / redis client), Lua script có comment giải thích
- [ ] Trả lời được vấn đáp: tại sao chọn từng cấu trúc dữ liệu, điều gì xảy ra nếu bỏ Lua đi

## ✅ Tiêu chí pass tuần

- Quiz ≥ 12/15
- Hoàn thành tất cả bài tập bắt buộc (bài 3 và 5 phải có log/counter chứng minh, không chỉ "chạy được")
- Bài thực hành đạt ≥ 7/9 mục checklist, trong đó mục Lua atomic + load test là **bắt buộc**
- Vẽ lại được từ trí nhớ sơ đồ xử lý 3 vấn đề: stampede / penetration / avalanche, và giải thích miệng trôi chảy trong 3 phút
