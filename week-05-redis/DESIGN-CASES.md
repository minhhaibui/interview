# Tuần 5 — Thiết kế hệ thống & Case thực tế: Redis

> Tài liệu bổ trợ cho README.md cùng thư mục. Học sau khi xong phần lý thuyết.

## 🏗️ Mini System Design (scoped vào chủ đề tuần)

### Bài 1: Caching layer cho trang chủ e-commerce 100K RPS

**Đề bài:**
Trang chủ + trang category của sàn TMĐT:
- 100K RPS lúc cao điểm (flash sale), bình thường 20K RPS.
- Dữ liệu render: banner, danh sách category, top products mỗi category, giá + tồn kho hiển thị.
- Nguồn: Postgres + MongoDB, tổng thời gian build trang từ DB ~150ms.
- Admin sửa sản phẩm/banner phải thấy thay đổi trong ≤ 60s; riêng giá flash sale phải cập nhật ≤ 5s.
- DB chỉ chịu được ~2K QPS cho loại query này.

**Phân tích & lời giải:**

**Bước 1 — Định lượng: cache phải hấp thụ bao nhiêu?**

100K RPS vào, DB chịu 2K QPS → cache hit ratio tối thiểu 98%. Mọi quyết định sau (TTL, coalescing, multi-layer) đều phục vụ con số này. Nói được phép tính này ngay đầu là điểm cộng lớn.

**Bước 2 — Kiến trúc multi-layer**

```
Client ── CDN (HTML/JSON edge cache, TTL 30s cho trang anonymous)
            │ miss
            ▼
        Node.js app ── L1: in-process LRU (lru-cache, TTL 5–10s, max ~50MB)
            │ miss                │
            ▼                     │  L1 hấp thụ "siêu hot keys" (homepage payload),
        L2: Redis Cluster ◄───────┘  giảm cả network round-trip lẫn tải Redis
            │ miss (≤2%)
            ▼
        Postgres / MongoDB
```

Vì sao cần L1 local LRU? Ở 100K RPS, ngay cả Redis cũng thành điểm nóng cho **một key duy nhất** (payload trang chủ): 100K GET/s cùng 1 key dồn vào 1 node Redis (key chỉ nằm trên 1 shard — cluster không giúp gì cho hot key đơn lẻ). L1 với TTL 5s biến 100K req/s thành (số instance app × 1 request/5s) tới Redis. Trade-off: dữ liệu lệch tối đa TTL(L1) giữa các instance — 5–10s, nằm trong yêu cầu 60s.

**Bước 3 — Cache key design**

```
home:v3:{locale}                      → JSON payload trang chủ (đã build sẵn)
cat:v3:{categoryId}:p{page}           → danh sách sản phẩm trang category
prod:v3:{productId}                   → chi tiết sản phẩm
price:{productId}                     → giá + flag sale (TTL ngắn riêng, 5s)
```

Nguyên tắc:
- **Version trong key (`v3`)**: deploy đổi cấu trúc payload → bump version, cache cũ tự chết theo TTL, không cần flush (flush trên production là cấm kỵ).
- **Tách giá ra key riêng TTL 5s**: yêu cầu "giá flash sale ≤ 5s" chỉ áp cho giá; đừng để yêu cầu freshness khắt khe nhất kéo TTL của toàn bộ payload xuống — đây là kỹ thuật "tách theo tốc độ thay đổi của data".
- Key có cấu trúc phẳng, đoán được, không nhúng giá trị user-specific vào trang anonymous (giữ cardinality thấp để hit ratio cao).

**Bước 4 — TTL + jitter, cache-aside + request coalescing**

```js
const BASE_TTL = 60;
function ttlWithJitter(base) {
  return Math.floor(base * (0.85 + Math.random() * 0.3)); // 51–69s
}

// Cache-aside + single-flight (coalescing trong 1 process)
const inflight = new Map();
async function getCached(key, loader, ttl = BASE_TTL) {
  const hit = await redis.get(key);
  if (hit) return JSON.parse(hit);

  if (inflight.has(key)) return inflight.get(key);   // gộp request trùng
  const p = (async () => {
    try {
      // Khóa nhẹ liên-process: chỉ 1 instance được rebuild
      const gotLock = await redis.set(`lock:${key}`, "1", "EX", 10, "NX");
      if (!gotLock) {                                 // instance khác đang build
        await sleep(100);
        const retry = await redis.get(key);
        if (retry) return JSON.parse(retry);
        // fallback: tự build nếu chờ không thấy
      }
      const data = await loader();                    // query DB ~150ms
      await redis.set(key, JSON.stringify(data), "EX", ttlWithJitter(ttl));
      return data;
    } finally { inflight.delete(key); }
  })();
  inflight.set(key, p);
  return p;
}
```

Vì sao từng món:
- **Jitter**: 200 key category cùng set TTL 60s vào lúc deploy → 60s sau cùng expire → DB ăn 200 query nặng cùng lúc, lặp lại mỗi phút. Jitter ±15% rải đều thời điểm expire (xem Case 1).
- **Coalescing/single-flight**: khi key hot expire, ở 100K RPS có thể có hàng nghìn request cùng miss trong 150ms build → nghìn query giống hệt nhau đập DB (cache stampede / dog-pile). In-process map gộp trong 1 instance; `SET NX` lock gộp giữa các instance.
- Nâng cao đáng nói thêm: **stale-while-revalidate** — lưu `expireAt` logic trong value, TTL Redis dài hơn; hết hạn logic thì trả data cũ ngay và rebuild nền → user không bao giờ chờ 150ms.

**Bước 5 — Invalidation khi admin sửa**

```
Admin service ──(sau khi commit DB)──> publish event "product.updated" {id}
                                            │
        Consumer: DEL prod:v3:{id}, DEL price:{id}
                  DEL cat:v3:{categoryId}:* các trang chứa nó (hoặc bump version key của category)
                  PUBLISH invalidate-channel {keys}  ──> mọi app instance xóa L1 LRU
```

- **Event-driven DEL** cho mutation chủ động (admin sửa) — thấy thay đổi trong ~1s.
- **TTL là lưới an toàn** cho mọi đường ghi khác (job, script, sửa tay DB) — bảo đảm trần 60s ngay cả khi event bị rớt. Luôn dùng cả hai, đừng chỉ một.
- Xóa theo wildcard `cat:*` không có lệnh trực tiếp → dùng **version key per category**: `GET catver:{id}` rồi ghép vào cache key; invalidate = `INCR catver:{id}` (O(1), không cần SCAN).

**Trade-offs:**
- Multi-layer → 2 tầng staleness cộng dồn (L1 + L2); chấp nhận vì yêu cầu 60s rộng rãi, và giá đã tách kênh TTL 5s.
- CDN cache chỉ áp được cho phần anonymous; phần cá nhân hóa (giỏ hàng, gợi ý) phải tách API riêng — thiết kế payload tách "shell tĩnh + data động" ngay từ đầu.
- DEL-on-write giữ cache fresh nhưng tạo miss đúng lúc data hot → kết hợp warm lại key ngay sau DEL cho key quan trọng (write-through cho trang chủ).

**Follow-up interviewer hay hỏi:**
1. *"Redis sập thì sao?"* — Phải sống được: circuit breaker quanh Redis client, timeout ngắn (50–100ms), degrade về L1 + DB với rate limit/queue ở tầng app, trả trang giản lược nếu quá tải. Cache là tăng tốc, không phải dependency cứng.
2. *"Cache giỏ hàng/user-specific khác gì trang chủ?"* — Cardinality cao, hit ratio thấp hơn, không dùng L1 chia sẻ (sai user là tai nạn), key theo userId, TTL ngắn, cân nhắc có đáng cache không.
3. *"Làm sao biết hit ratio đang bao nhiêu?"* — `INFO stats` (keyspace_hits/misses), metric per-key-prefix tự đo ở client, dashboard + alert khi hit ratio tụt (thường là dấu hiệu key design hỏng hoặc TTL sai sau deploy).

---

### Bài 2: Session store cho 5M concurrent users

**Đề bài:**
Hệ thống app mobile + web với 5M user đồng thời:
- Mỗi request kèm session token; cần lookup session < 5ms p99.
- Session chứa: userId, roles, deviceInfo, vài flags — khoảng 15 fields.
- Session sống 30 ngày không hoạt động thì hết hạn; **mỗi lần user hoạt động thì gia hạn (sliding TTL)**.
- Peak: 150K lookups/s, 30K updates/s.
- Yêu cầu ước tính memory và thiết kế topology Redis.

**Phân tích & lời giải:**

**Bước 1 — Hash hay String?**

```
# Phương án A: String — JSON serialize cả session
SET sess:{token} '{"userId":123,"roles":["user"],...}' EX 2592000

# Phương án B: Hash — mỗi field một entry
HSET sess:{token} userId 123 roles '["user"]' lastSeen 1717999999 ...
EXPIRE sess:{token} 2592000
```

| Tiêu chí | String (JSON) | Hash |
|---|---|---|
| Đọc cả session (pattern chính của auth middleware) | 1 GET, 1 lần parse — đơn giản | HGETALL — tương đương |
| Update 1 field (`lastSeen`) | phải GET → parse → SET cả object (race condition giữa GET/SET) | `HSET` 1 field, atomic — **thắng rõ** |
| Memory | JSON overhead (tên field lặp trong chuỗi) | **listpack encoding**: hash nhỏ (< 128 fields, value < 64 bytes — `hash-max-listpack-entries`) được nén cực gọn — **thắng** |
| TTL per-field | không | Redis 7.4+ có HEXPIRE; trước đó TTL chỉ ở mức key |

**Chọn Hash**: session có updates lẻ tẻ từng field (lastSeen, flags) và 15 fields nhỏ lọt listpack encoding. Nếu session chỉ read-only sau khi tạo thì String + JSON cũng ổn — nêu được điều kiện đổi chiều này là điểm cộng.

**Bước 2 — Sliding TTL**

```js
// Auth middleware (Node.js)
async function loadSession(token) {
  const key = `sess:${token}`;
  // Pipeline 1 round-trip: đọc + gia hạn
  const [sess] = await redis.pipeline()
    .hgetall(key)
    .expire(key, 30 * 24 * 3600)
    .exec();
  return sess;
}
```

Tối ưu quan trọng: **không cần EXPIRE mỗi request**. 150K EXPIRE/s là lãng phí — TTL 30 ngày thì gia hạn chính xác đến từng giây vô nghĩa. Chỉ gia hạn khi TTL còn lại < 29 ngày (tức tối đa 1 lần/ngày/user): lưu `lastRefresh` trong hash hoặc dùng `EXPIRE key ttl GT`/kiểm tra `TTL` trước. Giảm ~99% lệnh ghi từ middleware.

**Bước 3 — Ước tính memory**

- Payload 15 fields ≈ 400 bytes data thực.
- Hash listpack-encoded + key string (~40 bytes) + per-key overhead (dict entry, robj, expire entry ≈ 60–90 bytes) → ước **~600 bytes–1KB/session**. Lấy 1KB cho an toàn.
- Số session ≥ số user concurrent: 5M concurrent nhưng session sống 30 ngày → tổng session tồn tại đồng thời có thể là 50–100M (mọi user active trong 30 ngày, nhiều device). **Đây là cái bẫy của đề** — đừng tính 5M × 1KB = 5GB rồi dừng; phải hỏi lại MAU/devices. Giả sử 60M sessions → **~60GB**.
- - Cộng replication buffer, fragmentation (×1.5 an toàn) → **~90GB RAM tổng**, kèm headroom 30%.

**Bước 4 — Topology: Redis Cluster**

```
Redis Cluster: 6 masters × 16GB (used) + 6 replicas  (16384 slots chia đều)
  - Key sess:{token}: token random → phân bố slot tự nhiên đều, không hot slot
  - Client: ioredis cluster mode, đọc từ master (session cần read-your-write)
```

- 150K ops/s: một node Redis làm được ~100–200K ops/s đơn giản → 6 masters dư sức kể cả lệch tải.
- **Persistence**: bật AOF `everysec` hoặc chấp nhận RDB + mất vài phút session khi node chết (user login lại — thường chấp nhận được; nói rõ trade-off với interviewer). Replica + automatic failover của cluster là tuyến phòng thủ chính.
- `maxmemory-policy`: **`volatile-lru`** — mọi key đều có TTL; nếu memory căng, Redis evict session lâu không dùng trước → degrade mềm thay vì lỗi ghi (`noeviction` sẽ làm login mới fail — tệ hơn nhiều).

**Trade-offs:**
- Cluster mode: không multi-key transaction xuyên slot — session vốn single-key nên không đau; nhưng nếu sau này cần "list mọi session của user X" phải tự maintain set `user_sessions:{userId}` (đặt hashtag `{userId}` nếu cần cùng slot).
- Sticky read từ master (bỏ qua replica read) → an toàn consistency, tốn capacity master; chấp nhận vì auth là critical path.
- JWT stateless là phương án thay thế (không cần store) — nhưng mất khả năng revoke tức thì + session data động; nêu được so sánh này rất ăn điểm: *"JWT cho phần xác thực chữ ký, Redis session cho revoke list / data động"* là hybrid phổ biến.

**Follow-up interviewer hay hỏi:**
1. *"Logout-all-devices làm thế nào?"* — Set `user_sessions:{userId}` chứa các token; logout-all = SMEMBERS + DEL từng cái (pipeline), hoặc lưu `minSessionVersion` per user và check khi load.
2. *"Mất nguyên node master trước khi replica sync kịp thì sao?"* — Mất vài giây session ghi gần nhất → user đó re-login; định lượng được blast radius (1/6 keyspace, chỉ session ghi trong ~1s cuối) là câu trả lời senior.
3. *"Vì sao không dùng Memcached?"* — Hash data structure, sliding TTL theo lệnh, replication + failover built-in, Lua khi cần; Memcached chỉ thắng ở multi-thread thuần KV — không đủ cho bài này.

---

### Bài 3: Distributed lock cho job tranh chấp tồn kho

**Đề bài:**
Flash sale: 10K users cùng bấm mua 1 SKU có 100 đơn vị tồn kho. Service `checkout` chạy 20 instances. Thao tác giữ hàng: đọc tồn kho → kiểm tra → trừ → tạo reservation, tổng ~50ms (có gọi DB). Yêu cầu: không oversell, không deadlock khi instance crash giữa chừng. Thiết kế distributed lock bằng Redis và chỉ ra giới hạn của nó.

**Phân tích & lời giải:**

**Bước 1 — Lock đúng cách: SET NX + random token + Lua release**

```js
const { randomUUID } = require("crypto");

async function acquireLock(redis, key, ttlMs = 3000) {
  const token = randomUUID();
  // NX: chỉ set nếu chưa tồn tại; PX: TTL — phải atomic trong 1 lệnh
  const ok = await redis.set(`lock:${key}`, token, "PX", ttlMs, "NX");
  return ok ? token : null;
}

// Release PHẢI bằng Lua: check-token-rồi-xóa phải atomic
const RELEASE_LUA = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
  else
    return 0
  end`;
async function releaseLock(redis, key, token) {
  return redis.eval(RELEASE_LUA, 1, `lock:${key}`, token);
}
```

Ba lỗi kinh điển mà thiết kế trên tránh được (nói rõ từng cái khi phỏng vấn):
1. **SETNX rồi EXPIRE riêng** → crash giữa 2 lệnh = lock vĩnh viễn, deadlock. Phải `SET NX PX` một lệnh.
2. **Không có token, release bằng DEL trần** → instance A xử lý quá TTL, lock hết hạn, B chiếm lock, A xong việc DEL nhầm lock của B → 2 instance cùng trong critical section.
3. **GET so token rồi DEL bằng 2 lệnh** → race ngay giữa GET và DEL. Phải Lua.

**Bước 2 — Lock TTL vs thời gian xử lý**

Quy tắc: `TTL ≥ p99 thời gian xử lý × hệ số an toàn (3–5x)`. Xử lý ~50ms, p99 có thể 500ms (DB chậm) → TTL 3s.
- TTL quá ngắn → lock hết hạn khi đang xử lý → mất mutual exclusion → chính là nguồn oversell.
- TTL quá dài → instance crash thì SKU bị khóa lâu (users chờ).
- Phương án xử lý dài không đoán trước: **watchdog/lock extension** — timer gia hạn `PEXPIRE` mỗi TTL/3 chừng nào còn xử lý (Redisson gọi là watchdog; với Node tự cài bằng `setInterval` + Lua check-token-rồi-PEXPIRE). Nhưng nhớ: watchdog chết cùng process crash — đó là feature, không phải bug.

**Bước 3 — Giới hạn của Redis lock & fencing token**

Sự thật phải nói với interviewer: **lock TTL-based không bao giờ tuyệt đối an toàn** — GC pause/network delay có thể khiến client tưởng mình còn giữ lock trong khi đã hết hạn (tranh luận Kleppmann vs Redlock kinh điển). Tầng bảo vệ cuối phải nằm ở resource:

```js
// Fencing token: số tăng đơn điệu cấp kèm lock
const token = await redis.incr("fence:sku:123");   // 41, 42, 43...

// DB là người gác cuối: từ chối ghi với token cũ
// UPDATE reservations SET ... WHERE sku_id = $1 AND $2 > last_fence_token
```

Resource (DB) nhớ token lớn nhất từng thấy và từ chối token nhỏ hơn → kẻ giữ lock "ma" (đã expire) bị chặn ở tầng ghi.

**Bước 4 — Lùi một bước: bài tồn kho có cần lock không?**

Câu trả lời ăn điểm nhất: **không**. Trừ tồn kho là phép toán atomic được, lock là dùng dao mổ trâu:

```lua
-- Lua: kiểm tra + trừ atomic, không lock
local stock = tonumber(redis.call("GET", KEYS[1]))
if stock and stock >= tonumber(ARGV[1]) then
  return redis.call("DECRBY", KEYS[1], ARGV[1])
end
return -1
```

Hoặc thuần DB: `UPDATE inventory SET qty = qty - 1 WHERE sku=$1 AND qty >= 1` (atomic, check affected rows). Lock chỉ thật sự cần khi critical section gồm **nhiều bước không gộp được thành một phép atomic** (gọi API bên thứ ba + ghi DB). Trình bày theo thứ tự "atomic operation trước, lock là phương án cuối" thể hiện đúng tư duy senior.

**Trade-offs:**
- Single Redis lock: nhanh, đủ cho mục đích *efficiency* (tránh làm trùng việc); failover có thể cấp 2 lock (replica chưa sync) → với mục đích *correctness* phải có fencing ở resource. Redlock (5 node độc lập) đắt và vẫn bị tranh cãi — thực chiến đa số chọn single Redis + fencing/idempotency ở DB.
- Lock per-SKU granularity: lock toàn kho thì chết throughput; lock theo `sku:{id}` để 10K SKU bán song song.
- Chờ lock: spin-retry với backoff + jitter, giới hạn tổng thời gian chờ rồi trả 429/"hết lượt" — flash sale thà từ chối nhanh còn hơn treo connection.

**Follow-up interviewer hay hỏi:**
1. *"Redlock là gì, có nên dùng không?"* — Thuật toán lấy lock trên đa số của 5 Redis độc lập để sống sót node failure; tranh cãi Kleppmann: vẫn không an toàn trước clock drift/GC pause nếu thiếu fencing. Trả lời: hiểu nó, nhưng thực dụng chọn single instance + fencing token.
2. *"Reservation giữ hàng 10 phút rồi user không thanh toán thì sao?"* — TTL trên reservation + job hoàn kho; hoặc key Redis có TTL và keyspace notification/scheduled job cộng trả `DECRBY` ngược.
3. *"Khác gì advisory lock của Postgres?"* — `pg_advisory_lock` gắn với session/transaction, tự nhả khi connection chết — an toàn hơn TTL-guessing nếu mọi instance đã dùng chung Postgres; Redis lock thắng khi cần cross-service và throughput cao. Biết chọn cái có sẵn trong stack là điểm cộng.

---

### Bài 4: Hệ thống đếm view bài viết 50K views/s

**Đề bài:**
Nền tảng tin tức/video:
- 50K view events/s lúc cao điểm, 10M bài viết.
- Hiển thị: tổng view (gần realtime, sai số nhỏ chấp nhận được) + **unique viewers** theo ngày.
- View count phải bền (về DB) để báo cáo; DB chịu được ~2K writes/s.
- Chống đếm trùng F5 spam ở mức hợp lý.

**Phân tích & lời giải:**

**Bước 1 — Tại sao không ghi thẳng DB?**

50K writes/s `UPDATE posts SET views = views + 1` → row lock contention trên bài hot, WAL phình, DB 2K writes/s chết ngay. Pattern chuẩn: **Redis hấp thụ write, batch flush về DB** — đổi durability-tức-thì lấy throughput.

**Bước 2 — Tổng view: INCR + batch flush**

```js
// Đường nóng: 1 lệnh Redis, ~50K ops/s là chuyện nhỏ với 1 node
await redis.hincrby(`views:buf:${minuteBucket}`, postId, 1);
// Dùng hash bucket theo phút thay vì 10M key lẻ: flush gọn, key ít

// Flusher (chạy mỗi 30–60s, 1 worker — bầu leader bằng chính lock bài 3):
async function flush() {
  const prevBucket = currentMinute() - 1;
  const key = `views:buf:${prevBucket}`;
  const counts = await redis.hgetall(key);          // { postId: delta }
  if (!Object.keys(counts).length) return;
  // 1 câu SQL batch thay vì N câu:
  // UPDATE posts SET views = views + d.delta FROM (VALUES ...) d(id, delta) WHERE posts.id = d.id
  await db.batchIncrementViews(counts);
  await redis.del(key);                             // flush xong mới xóa
}
```

- Flush **bucket phút đã đóng** (phút trước), không flush bucket đang ghi → tránh race giữa HGETALL và HINCRBY đang bay vào.
- 50K events/s gom 60s = 3M increments nhưng chỉ ~vài trăm nghìn postId distinct → vài nghìn rows/flush → DB thở tốt.
- Hiển thị tổng view realtime: `views_db + SUM(buf các bucket chưa flush)` hoặc đơn giản hơn: thêm counter realtime `INCR views:rt:{postId}` (TTL 1 ngày) chỉ để hiển thị, DB là source of truth cho báo cáo.

**Bước 3 — Unique viewers: HyperLogLog**

Đếm chính xác unique = Set chứa userId: bài 1M unique viewers ≈ set 1M phần tử × ~50 bytes ≈ 50MB **mỗi bài mỗi ngày** → 10M bài thì bất khả thi. HyperLogLog: **12KB cố định/key, sai số chuẩn ~0.81%**:

```js
// Ghi
await redis.pfadd(`uv:${postId}:${yyyymmdd}`, userIdOrDeviceId);
await redis.expire(`uv:${postId}:${yyyymmdd}`, 3 * 86400);

// Đọc
const daily = await redis.pfcount(`uv:${postId}:${yyyymmdd}`);
// Unique theo tuần: merge không mất tính đúng (union của HLL = HLL của union)
const weekly = await redis.pfcount(...sevenDayKeys);   // PFCOUNT k1 k2 ... k7
```

Trade-off chính xác phải nói thẳng: HLL trả "~1,003,500" khi thật là 1,000,000 — với hiển thị "1M lượt xem" hoàn toàn ổn; **không dùng cho billing/đối soát tiền** (chỗ đó dùng exact set hoặc đếm trong warehouse). Chống F5 spam: `SET seen:{postId}:{userId} 1 EX 600 NX` — chỉ INCR khi SET thành công (dedup 10 phút), hoặc chấp nhận HLL tự dedup cho phần unique còn tổng view cho phép trùng.

**Bước 4 — Độ bền của phần đếm trong Redis**

Redis restart mất buffer chưa flush (tối đa ~60s data) → chấp nhận với view count (nói rõ!), giảm thiểu bằng AOF everysec (mất ≤1s) + flush interval ngắn. Nếu interviewer đòi không-mất-gì: đổi kiến trúc sang Kafka (event log bền) + consumer aggregate — chỉ ra được "ngưỡng yêu cầu nào thì đổi công cụ" là câu trả lời đẹp.

**Trade-offs:**
- Batch flush: mất tối đa 1 interval data khi Redis chết — đổi lấy giảm 95%+ write DB. View count chấp nhận, tiền thì không.
- HLL: 12KB/key, sai số ~0.8%, không thể hỏi "user X đã xem chưa" (chỉ đếm, không membership) — cần membership thì kèm key `seen:` TTL ngắn như trên.
- Hash bucket theo phút: thêm logic bucket nhưng flush O(1) lần HGETALL thay vì SCAN 10M key.

**Follow-up interviewer hay hỏi:**
1. *"Trending posts (top view 1 giờ qua) làm thế nào?"* — Sorted set theo time window: `ZINCRBY trend:{hourBucket} 1 {postId}`, đọc `ZREVRANGE` union 1–2 bucket gần nhất, TTL bucket cũ; đây là câu mở rộng tự nhiên của INCR design.
2. *"Flusher chết thì sao? Chạy 2 flusher có sao không?"* — Bucket phút vẫn nằm trong Redis chờ flush (không mất, chỉ trễ); 2 flusher cùng chạy có thể double-count → leader election bằng lock, hoặc flush idempotent (RENAME bucket sang key processing trước khi đọc — RENAME atomic nên 2 flusher không lấy trùng).
3. *"Sai số HLL 0.8% có tệ hơn với số nhỏ không?"* — Số nhỏ (< vài nghìn) Redis HLL dùng sparse encoding, sai số thực tế rất thấp; sai số chuẩn 0.81% là tiệm cận. Mức 'biết tồn tại sparse/dense encoding' là đủ gây ấn tượng.

---

## 🌍 Case thực tế

### Case 1: Cache stampede 0h đêm — mass TTL hết hạn cùng lúc

**Bối cảnh:** Sàn TMĐT VN chạy campaign sale "0h ngày đôi" (9/9, 11/11). Đêm trước, team chạy job warm-up cache toàn bộ trang category + sản phẩm hot lúc 23h00, tất cả set TTL đúng 3600s "cho chẵn".

**Vấn đề gặp phải:**
- Đúng 0h00 — thời điểm traffic cao nhất năm — toàn bộ cache **expire cùng một giây** (warm cùng lúc + TTL bằng nhau).
- Hàng trăm nghìn requests cùng miss → đập thẳng vào MySQL: connection pool cạn trong ~10s, query queue dồn, p99 từ 80ms lên 30s, health check fail, autoscaler bung thêm app instance càng tạo thêm connection đập DB → **sập dây chuyền đúng giờ vàng**.
- Bản chất là 2 lỗi chồng nhau: *synchronized expiration* (TTL đồng loạt) + *dog-pile* (N request cùng rebuild 1 key, không ai nhường ai).

**Giải pháp & tại sao:**
1. **TTL jitter**: `ttl = base * (0.85 + random*0.3)` — phá vỡ sự đồng bộ, expire rải trong cửa sổ ±15%. Một dòng code, loại bỏ cả lớp sự cố.
2. **Single-flight / request coalescing**: lock `SET NX` per-key — chỉ 1 request rebuild, số còn lại chờ ngắn rồi đọc lại cache (code mẫu ở Bài 1). Lượng query tới DB cho 1 key về đúng 1 bất kể bao nhiêu request miss.
3. **Stale-while-revalidate cho key hot**: TTL vật lý dài hơn TTL logic; hết hạn logic thì serve cũ + rebuild nền → không có "khoảnh khắc trống cache" với key quan trọng.
4. Vận hành: warm-up xong **kiểm tra phân bố TTL** (`TTL` sample các key) như một bước trong checklist campaign; load test kịch bản "cache lạnh hoàn toàn" để biết DB chịu được bao lâu.

**Bài học rút ra:**
- TTL bằng nhau cho hàng loạt key được tạo cùng lúc = hẹn giờ cho một cuộc tấn công tự DDoS chính mình.
- Cache hit ratio 99% nghĩa là DB chỉ quen chịu 1% tải — mọi thiết kế phải trả lời câu "điều gì xảy ra phút cache biến mất".
- Autoscaling tầng app khi nghẽn ở DB là đổ thêm dầu: cần backpressure (giới hạn connection pool, queue có trần, fail fast).

**💬 Cách dùng case này khi phỏng vấn:** Khi được hỏi về caching, chủ động nói: *"Em luôn set TTL kèm jitter và single-flight ngay từ đầu — em từng chứng kiến/đọc post-mortem hệ thống sập đúng 0h ngày sale vì warm cache cùng lúc với TTL đồng loạt; chi phí phòng là 5 dòng code, chi phí chữa là một đêm sale."*

### Case 2: `KEYS *` trên production làm Redis treo

**Bối cảnh:** Team vận hành một hệ thống có Redis ~20M keys làm session store + cache. Một dev cần dọn cache theo prefix sau khi đổi format, SSH vào và chạy `redis-cli KEYS "cache:v1:*"`. Một bản khác của case này: đoạn code Node.js dùng `redis.keys(pattern)` trong API "clear cache" của admin panel — chạy ngon ở staging (1000 keys), lên production thì thành bom.

**Vấn đề gặp phải:**
- Redis xử lý lệnh trên **một thread duy nhất**: `KEYS` quét toàn bộ keyspace 20M keys → block event loop của Redis vài giây.
- Trong thời gian đó **mọi lệnh khác xếp hàng**: toàn bộ lookup session timeout → mọi API trả 401/timeout → user văng hàng loạt.
- Sentinel/healthcheck ping không được trả lời đúng hạn → đánh dấu master down → **failover không cần thiết**, client mất kết nối thêm một nhịp nữa. Một lệnh gõ tay gây sự cố cấp P1.

**Giải pháp & tại sao:**
1. **Thay bằng SCAN** — duyệt cursor-based từng đợt nhỏ, không block:
```js
let cursor = "0";
do {
  const [next, keys] = await redis.scan(cursor, "MATCH", "cache:v1:*", "COUNT", 500);
  cursor = next;
  if (keys.length) await redis.unlink(...keys);   // UNLINK: xóa async, không block như DEL key to
} while (cursor !== "0");
```
2. **Chặn từ gốc**: `rename-command KEYS ""` (hoặc ACL Redis 6+: `-keys -flushall -flushdb` cho user app/ops thường) — lệnh nguy hiểm không nên tồn tại trên production.
3. Thiết kế để khỏi cần xóa theo pattern: **version trong key** (`cache:v2:*`) — bump version là "xóa" tức thì, rác cũ chết theo TTL.
4. Quy trình: thao tác sửa dữ liệu production đi qua runbook/script đã review, không gõ chay; alert trên `slowlog` của Redis để bắt lệnh chậm sớm.

**Bài học rút ra:**
- Với hệ single-threaded, mọi lệnh O(N) toàn keyspace (`KEYS`, `FLUSHALL` đồng bộ, `SMEMBERS` set khổng lồ, `HGETALL` hash triệu field, `DEL` key to) đều là lệnh chặn cả hệ thống — review độ phức tạp lệnh Redis như review query SQL.
- "Chạy ngon ở staging" vô nghĩa với lệnh O(N) — N của production khác N của staging vài bậc.
- Khả năng phá hoại của một lệnh ad-hoc = lý do tồn tại của ACL, rename-command, và runbook.

**💬 Cách dùng case này khi phỏng vấn:** Khi nói về Redis ở production, đệm vào: *"Nguyên tắc của em là không bao giờ có lệnh O(N)-toàn-keyspace trên prod — KEYS bị disable bằng ACL, mọi nhu cầu duyệt key đi qua SCAN, xóa key lớn dùng UNLINK; đây là bài học từ những sự cố treo Redis kinh điển vì một câu KEYS gõ tay."*

### Case 3: Dùng Redis List làm message queue — mất message khi crash

**Bối cảnh:** Hệ thống gửi email/notification của một công ty SaaS: producer `LPUSH queue:emails`, N worker Node.js `BRPOP` lấy job ra xử lý. Chạy êm 1 năm, "Redis làm queue nhẹ nhàng khỏi cần RabbitMQ".

**Vấn đề gặp phải:**
- `BRPOP` **xóa message khỏi list ngay khi trả về** (at-most-once). Worker pop xong, đang gọi SMTP thì crash/OOM/deploy rollout → message biến mất vĩnh viễn. Email kích hoạt tài khoản, email reset password lặng lẽ không đến — khách phàn nàn rải rác hàng tháng trời mới truy ra.
- Không có acknowledgement, không retry, không dead-letter, không biết message nào "đang xử lý dở".
- Vá tạm bằng `BRPOPLPUSH` sang list `processing` (pattern reliable queue cổ điển) thì lại đẻ việc mới: phải tự viết janitor quét list processing tìm message mồ côi, tự đếm số lần retry, tự làm delay — tức là tự cài lại nửa cái message broker, có bug riêng của nó.

**Giải pháp & tại sao:**
1. **Chuyển sang Redis Streams + consumer group** — đúng nhu cầu mà không thêm hạ tầng mới:
```
XADD emails * payload {...}
XGROUP CREATE emails workers $
XREADGROUP GROUP workers w1 COUNT 10 BLOCK 5000 STREAMS emails >
-- xử lý xong mới: XACK emails workers <id>
-- worker chết: message nằm trong PEL (pending entries list)
XAUTOCLAIM emails workers w2 1800000 0   -- claim message pending > 30 phút về worker sống
```
   Streams cho đủ bộ: at-least-once (ACK rời khỏi delivery), PEL theo dõi message đang dở, `XAUTOCLAIM` thay janitor, delivery counter để đưa message lỗi nhiều lần vào DLQ stream riêng.
2. Vì at-least-once nghĩa là **có thể nhận trùng** → handler phải idempotent: key dedup `SET sent:{emailJobId} NX EX 86400` trước khi gửi.
3. Ngưỡng đổi công cụ (nói được điều này là điểm senior): Streams ổn đến hàng chục nghìn msg/s, retention giới hạn bởi RAM (`MAXLEN ~ 1000000`); cần retention dài để replay, throughput rất lớn, nhiều consumer hệ khác nhau, ordering + partition rõ ràng → **Kafka**. Đội này chọn Streams vì volume nhỏ (vài trăm msg/s) và không muốn vận hành thêm một cụm Kafka.

**Bài học rút ra:**
- Queue thật sự = delivery semantics + ack + retry + DLQ + visibility, không phải "chỗ nhét message". List cho được mỗi cái cuối.
- Hỏi "mất message này có sao không?" cho *từng loại* message — email marketing mất 1 cái không sao, email reset password thì có.
- At-least-once luôn đi kèm nghĩa vụ idempotency ở consumer — hai mặt của một đồng xu.

**💬 Cách dùng case này khi phỏng vấn:** Khi được hỏi "Redis làm queue được không?", trả lời có cấu trúc: *"Được, nhưng phải là Streams + consumer group chứ không phải List — List với BRPOP là at-most-once, crash là mất message; em từng thấy hệ thống mất email reset password vì pattern này. Và nếu cần retention dài hay throughput lớn thì em đổi sang Kafka."*

---

## ✅ Checklist tự kiểm tra

1. Tôi có thể tính ngược từ hit ratio yêu cầu (DB chịu X QPS, traffic Y RPS) ra thiết kế TTL/layer, và giải thích vì sao hot key đơn lẻ cần local LRU chứ Redis Cluster không cứu được không?
2. Tôi có viết được (trên bảng trắng) flow cache-aside kèm jitter + single-flight, và nói được khi nào nâng cấp lên stale-while-revalidate không?
3. Tôi có trình bày được 3 lỗi kinh điển của distributed lock (SETNX+EXPIRE rời, DEL không token, GET+DEL không Lua) và vì sao tầng bảo vệ cuối là fencing/idempotency ở resource chứ không phải lock không?
4. Tôi có ước tính được memory cho một bài Redis (bytes/key × số key × hệ số overhead) và chọn được `maxmemory-policy` phù hợp từng use case không?
5. Tôi có liệt kê được các lệnh O(N) nguy hiểm trên production và phương án thay thế (SCAN, UNLINK, version key) không?
6. Tôi có so sánh được List vs Streams vs Kafka cho bài queue theo trục delivery semantics / retention / throughput, và nêu ngưỡng đổi công cụ không?
7. Với bài đếm (view, like, rate limit), tôi có chọn đúng cấu trúc dữ liệu (INCR/hash bucket/HLL/sorted set) kèm trade-off chính xác vs memory, và thiết kế flush về DB không mất/không trùng không?
