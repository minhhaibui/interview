# 🔬 Đào sâu — Tuần 5: Redis

> README đã cho bạn "cái gì" và "khi nào"; tài liệu này mổ xẻ "vì sao nó hoạt động như vậy" ở mức memory layout, kernel syscall và race condition thật.

## 🧠 Cơ chế bên trong

### Vì sao single-thread vẫn cán mốc 100k+ ops/s

README nói "in-memory + single-thread + I/O multiplexing". Đi sâu hơn: bottleneck thật của một key-value store **không phải CPU tính toán mà là chờ I/O mạng và đồng bộ hóa**. Khi bạn loại bỏ I/O bằng cách để dữ liệu trên RAM, thứ còn lại đắt nhất là:

1. **Context switch & lock contention.** Một server multi-thread phục vụ N connection phải dùng mutex bảo vệ shared hash table. Mỗi lần lock/unlock + cache-line bouncing giữa các core (do MESI cache coherency) tốn hàng chục đến hàng trăm ns, và khi contention cao thì thread bị park → context switch (~1-5µs). Redis bỏ sạch khoản này: 1 thread, không lock, không atomic CAS trên hot path. Một lệnh `GET` thực chất chỉ là 1 hash lookup (~80-100ns) trên RAM.

2. **I/O multiplexing thật sự là gì.** Redis không tạo 1 thread/connection. Nó dùng `epoll` (Linux) / `kqueue` (BSD/macOS) / `evport` qua lớp trừu tượng `ae.c` (Redis's event loop). Một `epoll_wait()` syscall trả về danh sách fd đã sẵn sàng đọc/ghi; Redis lặp qua chúng, đọc command, thực thi, ghi reply — tất cả trong 1 vòng lặp. Đây là **readiness model** (giống Node.js libuv): kernel báo "fd này đọc được" thay vì bạn block trên từng `read()`. Chi phí mỗi vòng lặp ~O(số fd sẵn sàng), không phải O(tổng số connection).

3. **Batching tự nhiên.** Vì 1 thread xử lý tuần tự, nhiều command từ pipeline/nhiều client được gom xử lý liên tiếp mà không cần đồng bộ — CPU cache nóng, branch predictor ấm.

**Redis 6+ threaded I/O** giải quyết điểm nghẽn còn lại: với value lớn / nhiều client, việc `read()` từ socket và `write()` reply (kèm parse/format protocol RESP) chiếm đáng kể CPU. Redis 6 tách phần **đọc/ghi socket + parse** ra các I/O thread phụ (`io-threads 4`), nhưng **việc thực thi lệnh vẫn nằm trên main thread duy nhất** — nên model atomic không đổi. Mặc định chỉ thread hóa phần write; bật `io-threads-do-reads yes` để thread cả phần đọc. Chỉ bật khi đã chứng minh CPU là bottleneck (thường ở instance >4 core với throughput rất cao); bật bừa trên máy nhỏ còn chậm hơn.

### Encoding nội bộ — vì sao cùng một type lại tốn RAM khác nhau

Redis chọn **encoding nội bộ** theo kích thước/nội dung để tiết kiệm RAM; soi bằng `OBJECT ENCODING key`:

| Type | Encoding nhỏ (compact) | Encoding lớn | Ngưỡng chuyển (config) |
|------|----------------------|--------------|------------------------|
| String | `int` (số nguyên), `embstr` (≤44 byte) | `raw` (>44 byte) | cố định |
| Hash | `listpack` (cũ: `ziplist`) | `hashtable` | `hash-max-listpack-entries 128`, `hash-max-listpack-value 64` |
| List | `listpack` → bọc trong `quicklist` | `quicklist` (linked list các listpack node) | `list-max-listpack-size 128` |
| Set | `intset` (toàn số), `listpack` (ít phần tử) | `hashtable` | `set-max-intset-entries 512`, `set-max-listpack-entries 128` |
| ZSet | `listpack` | `skiplist` + dict | `zset-max-listpack-entries 128`, `zset-max-listpack-value 64` |

```bash
127.0.0.1:6379> RPUSH mylist a b c
127.0.0.1:6379> OBJECT ENCODING mylist        # "listpack"
127.0.0.1:6379> SADD nums 1 2 3
127.0.0.1:6379> OBJECT ENCODING nums          # "intset"
127.0.0.1:6379> SADD nums hello
127.0.0.1:6379> OBJECT ENCODING nums          # "listpack" (hết toàn số)
127.0.0.1:6379> ZADD z 1 a
127.0.0.1:6379> OBJECT ENCODING z             # "listpack"
```

**Vì sao quan trọng:** `listpack`/`intset` là **mảng liền kề trong bộ nhớ** — duyệt là O(N) nhưng N nhỏ nên nhanh và cực tiết kiệm RAM (không có pointer 8 byte/phần tử, không overhead của dict). Khi vượt ngưỡng, Redis tự "upgrade" sang `hashtable`/`skiplist` — **không bao giờ downgrade lại** (kể cả khi bạn xóa bớt phần tử). Hệ quả thực tế: một hash 200 field rồi xóa còn 5 field vẫn giữ `hashtable` tốn RAM. `ziplist` là tên cũ; từ Redis 7 đổi thành `listpack` (fix lỗi cascade update của ziplist).

**ZSET dùng cả 2 cấu trúc cùng lúc** khi ở dạng `skiplist`: một **skiplist** (sắp xếp theo score, cho `ZRANGE`/`ZRANK` O(logN)) **+ một hashtable** (map member→score, cho `ZSCORE` O(1)). Đó là lý do ZSET tốn RAM gấp đôi so với set thường nhưng truy vấn cả 2 chiều đều nhanh.

### Expiration — vì sao key có TTL vẫn ăn RAM sau khi "hết hạn"

TTL không có "timer" đẩy key ra ngay khi hết giờ (làm vậy cần hàng triệu timer). Redis dùng **2 cơ chế kết hợp**:

1. **Lazy expiration (passive):** khi một lệnh chạm vào key, Redis kiểm tra TTL; nếu đã hết hạn thì xóa ngay rồi xử lý như key không tồn tại. Vấn đề: key hết hạn mà **không ai đụng tới** sẽ nằm lì trong RAM mãi.

2. **Active expiration (sampling):** mỗi `serverCron` tick (mặc định 10 lần/giây, `hz 10`), Redis chạy vòng: lấy ngẫu nhiên ~20 key **trong tập key có TTL** (`expires` dict), xóa những key đã hết hạn; **nếu >25% mẫu đã hết hạn thì lặp lại ngay** (vì có vẻ còn nhiều key chết). Đây là thuật toán xác suất giữ tỉ lệ "key chết còn sót" dưới ~25%.

**Hệ quả phỏng vấn:** bạn không thể giả định RAM được giải phóng đúng giây TTL hết hạn. Với 1 triệu key cùng TTL hết hạn đồng loạt, active cycle sẽ xóa dần và có thể gây spike CPU/latency. Trong replication, **replica không tự xóa key hết hạn** — nó chờ lệnh `DEL` (Redis ≥ `UNLINK`) do master gửi xuống, để đảm bảo consistency; replica chỉ "che giấu" key hết hạn khi đọc.

### AOF rewrite, fork & copy-on-write — vì sao RAM phình lúc save

Cả `BGSAVE` (RDB) và `BGREWRITEAOF` đều gọi `fork()`. `fork()` không copy toàn bộ RAM — kernel dùng **copy-on-write (COW)**: process con chia sẻ page với cha, chỉ khi một bên **ghi** vào page thì kernel mới clone page đó.

- Process con (child) chỉ đọc snapshot dataset để ghi ra file → nó không ghi vào data page.
- Process cha (Redis chính) vẫn nhận write từ client → mỗi write làm "bẩn" page, kernel clone page → **RAM thực tế tăng lên** trong lúc save. Worst case (write rất nhiều trong lúc save): gần gấp đôi RAM dataset.

Đó là lý do bạn phải để dư RAM (overcommit) và set `vm.overcommit_memory=1` ở Linux — nếu không `fork()` có thể fail khi kernel từ chối cấp địa chỉ ảo. Theo dõi qua `INFO`: `latest_fork_usec` (fork lâu = dataset to/máy chậm), `aof_rewrite_in_progress`, `mem_fragmentation_ratio`.

**AOF rewrite làm gì:** thay vì append mãi mãi (file phình vô hạn), rewrite tạo file AOF mới **nhỏ gọn** biểu diễn trạng thái hiện tại bằng số lệnh tối thiểu (vd 1000 lệnh `INCR` → 1 lệnh `SET key 1000`). Trong lúc child ghi file mới, lệnh write mới được đệm vào `aof_rewrite_buf` rồi append vào cuối file mới khi xong. Redis 7 dùng **multi-part AOF**: 1 file base (RDB hoặc AOF) + các file incremental, quản lý bởi manifest → rewrite gọn và an toàn hơn.

### Cluster: 16384 hash slot & redirect MOVED/ASK

Cluster không hash key trực tiếp ra node mà qua **slot trung gian**: `slot = CRC16(key) mod 16384`. Mỗi master "sở hữu" một dải slot. Vì sao 16384 (2^14) chứ không nhiều hơn? Mỗi node phải gossip bitmap slot nó giữ trong heartbeat; 16384 bit = 2KB/message — đủ nhỏ để gossip thường xuyên, đủ lớn để chia mịn cho tới ~1000 node (antirez giải thích trực tiếp lý do này).

Client thông minh cache **bản đồ slot→node**. Hai loại redirect khi client hỏi sai node:

- **`MOVED slot host:port`**: slot đã **dời hẳn** sang node khác (resharding xong). Client cập nhật bản đồ và đi thẳng node mới từ giờ.
- **`ASK slot host:port`**: slot **đang di chuyển dở** (migration). Key này tạm ở node đích; client gửi `ASKING` rồi lệnh tới node đích **chỉ cho request này**, không cập nhật bản đồ (vì slot chưa dời hẳn).

```bash
127.0.0.1:7000> GET user:42
(error) MOVED 12182 127.0.0.1:7002    # client tự đi tới 7002
```

**Hash tag** (README đã nhắc): chỉ phần trong `{}` đầu tiên được đưa vào CRC16 → `{user1}:cart` và `{user1}:profile` rơi cùng slot, dùng được MULTI/Lua/MGET trên chúng. Lạm dụng hash tag → dồn data lệch về vài slot (hot slot), mất cân bằng cluster.

## 🧪 Ví dụ nâng cao

### 1. Distributed lock ĐÚNG: SET NX PX + token + Lua release

README đã có khung. Phần đào sâu là **tại sao từng dòng tồn tại** và một release Lua có thêm cảnh báo:

```lua
-- release.lua: chỉ xóa nếu token khớp (atomic check-and-del)
-- KEYS[1] = lock key, ARGV[1] = token của tôi
if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
else
    return 0   -- lock đã thuộc về người khác → KHÔNG xóa
end
```

```bash
# acquire: NX (chỉ set khi chưa có) + PX (ttl ms, chống deadlock nếu holder chết)
SET lock:order:9 a1b2-token-uuid PX 10000 NX     # trả OK hoặc nil
# release: luôn qua EVAL, không bao giờ GET rồi DEL ở app
EVAL "<release.lua>" 1 lock:order:9 a1b2-token-uuid
```

**Hạn chế của single-node lock (phải nói được khi phỏng vấn):**
- Master nhận lock → master crash **trước khi** replicate sang replica → Sentinel promote replica (chưa có lock) → người thứ 2 lấy được cùng lock. Replication async là gốc rễ.
- **GC pause / STW dài** (Node ít bị nhưng vẫn có khi event loop nghẽn, hoặc VM bị steal CPU): holder "đứng hình" quá TTL → lock auto-expire → người 2 vào → cả 2 cùng critical section. TTL không cứu được điều này.

**Redlock** sinh ra để chống case crash node: lấy lock trên N=5 master độc lập, thành công nếu **đa số (3/5)** ack trong thời gian < TTL. Kleppmann phản biện: với **correctness tuyệt đối**, Redlock vẫn không an toàn vì phụ thuộc clock đồng bộ (NTP nhảy giờ) và không có **fencing token** (số tăng dần resource dùng để từ chối holder cũ). Chốt: lock cho **efficiency** (chống làm trùng) → single-node lock + TTL là đủ; lock cho **correctness** (không bao giờ 2 holder, vd ghi tiền) → consensus store (etcd/ZooKeeper) + fencing token.

### 2. Watchdog gia hạn TTL an toàn (có check token)

```lua
-- extend.lua: chỉ gia hạn nếu mình vẫn là chủ lock
if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("PEXPIRE", KEYS[1], ARGV[2])
else
    return 0
end
```
Gọi định kỳ (vd mỗi TTL/3 giây) khi job còn chạy. Phải có check token, nếu không bạn sẽ gia hạn nhầm lock của holder mới.

### 3. Sliding window rate limit bằng ZSET (gói trong 1 Lua = atomic)

README có bản MULTI; bản Lua dưới đây atomic tuyệt đối và trả luôn `remaining`:

```lua
-- sliding_window.lua
-- KEYS[1]=rl key  ARGV[1]=now(ms)  ARGV[2]=window(ms)  ARGV[3]=limit  ARGV[4]=member duy nhất
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1] - ARGV[2])  -- dọn request ngoài cửa sổ
local count = redis.call('ZCARD', KEYS[1])
if count < tonumber(ARGV[3]) then
    redis.call('ZADD', KEYS[1], ARGV[1], ARGV[4])
    redis.call('PEXPIRE', KEYS[1], ARGV[2])
    return tonumber(ARGV[3]) - count - 1     -- remaining
end
return -1                                     -- bị chặn (429)
```
```js
redis.defineCommand('slidingWindow', { numberOfKeys: 1, lua: SLIDING_WINDOW_LUA });
const remaining = await redis.slidingWindow(`rl:${ip}`, Date.now(), 60000, 100, `${Date.now()}-${process.hrtime.bigint()}`);
```
Atomic hơn MULTI ở chỗ: nếu dùng MULTI mà thêm trước rồi đếm sau, request bị chặn vẫn bị `ZADD` (ô nhiễm cửa sổ); bản Lua chỉ ZADD khi thực sự cho qua.

### 4. Chống cache stampede bằng early/probabilistic recompute (XFetch)

Thay vì để key hết hạn rồi mới đua nhau rebuild, lưu kèm metadata và **làm mới sớm theo xác suất** — request "xui" sẽ tự nguyện rebuild trước khi hết hạn thật:

```js
// Lưu kèm: value, delta (thời gian tính loader, ms), expiry tuyệt đối
// XFetch: recompute nếu now - delta*beta*ln(rand()) >= expiry
function shouldRecompute(deltaMs, expiryAt, beta = 1) {
  return Date.now() - deltaMs * beta * Math.log(Math.random()) >= expiryAt;
}
async function xfetch(key, loader, ttlMs) {
  const raw = await redis.get(key);
  if (raw) {
    const { v, delta, exp } = JSON.parse(raw);
    if (!shouldRecompute(delta, exp)) return v;     // đa số: dùng cache
  }
  const t0 = Date.now();
  const v = await loader();
  const delta = Date.now() - t0;
  const exp = Date.now() + ttlMs;
  await redis.set(key, JSON.stringify({ v, delta, exp }), 'PX', ttlMs + 10000);
  return v;
}
```
Ý tưởng: key nào **load lâu** (delta lớn) thì xác suất recompute sớm cao hơn → tránh để cả đám miss cùng lúc. Kết hợp với in-process coalescing (map `key→Promise`) là chắc nhất cho Node.

### 5. Atomic check-and-set (trừ kho không oversell) bằng Lua

```lua
-- decr_stock.lua: check tồn kho + trừ + đánh dấu user trong 1 atomic unit
-- KEYS[1]=stock key  KEYS[2]=buyers set  ARGV[1]=userId
if redis.call('SISMEMBER', KEYS[2], ARGV[1]) == 1 then return -2 end  -- đã mua rồi
local stock = tonumber(redis.call('GET', KEYS[1]))
if not stock or stock <= 0 then return -1 end                         -- hết hàng
redis.call('DECR', KEYS[1])
redis.call('SADD', KEYS[2], ARGV[1])
return stock - 1                                                       -- tồn còn lại
```
Không bao giờ làm read-check-write ở app (TOCTOU race → oversell). Trên Cluster, `KEYS[1]` và `KEYS[2]` phải cùng slot → đặt `stock:{sale9}` và `buyers:{sale9}`.

### 6. Pipeline vs MULTI/EXEC — khác nhau bản chất

| | Pipeline | MULTI/EXEC (transaction) |
|---|---|---|
| Mục đích | Gom nhiều lệnh → **1 round-trip** (giảm latency mạng) | Nhóm lệnh chạy **liền mạch không bị xen** |
| Atomic? | **Không** — lệnh khác có thể chen vào giữa | **Có** — block luận lý, không lệnh ngoài chen vào |
| Rollback? | — | **Không có rollback** (khác SQL): lệnh lỗi runtime vẫn để các lệnh khác chạy |
| Đọc giá trị giữa chừng để quyết định? | Được (gửi tuần tự, đọc reply) | **Không** — lệnh chỉ queue, chưa thực thi tới EXEC |

```js
// Pipeline: nhanh nhưng KHÔNG atomic
await redis.pipeline().set('a', 1).incr('a').get('a').exec();
// Transaction + optimistic lock bằng WATCH (check-and-set kiểu CAS)
await redis.watch('balance');
const bal = Number(await redis.get('balance'));
if (bal >= 100) {
  const res = await redis.multi().decrby('balance', 100).exec(); // null nếu 'balance' đổi sau WATCH
}
```
`WATCH` cho phép CAS lạc quan: nếu key bị sửa giữa WATCH và EXEC, EXEC trả `null` → bạn retry. Khi logic phức tạp, **Lua thường gọn và an toàn hơn WATCH/MULTI** vì atomic mà không cần retry.

## 🐛 Bẫy & sự cố production

**1. `KEYS *` đóng băng cả server.** `KEYS` là O(N) trên toàn keyspace và **block** vì single-thread → với 10 triệu key, mọi client treo vài giây, healthcheck timeout, có khi bị nhầm là "Redis chết". *Dấu hiệu:* latency spike đồng loạt, `INFO commandstats` thấy `cmdstat_keys` với `usec_per_call` khổng lồ. *Fix:* dùng `SCAN 0 MATCH prefix:* COUNT 100` (cursor, không block lâu, không bảo đảm snapshot nhưng an toàn). Cấm `KEYS`, `FLUSHALL`, `SMEMBERS`/`HGETALL` trên collection lớn ở prod; có thể rename-command để vô hiệu hóa.

**2. Big key & hot key.** *Big key:* một key chứa hàng triệu phần tử (vd 1 list 5M item). `DEL` nó **block** vì giải phóng O(N) → dùng `UNLINK` (xóa bất đồng bộ ở thread phụ). *Hot key:* 1 key bị đọc áp đảo → trên Cluster dồn 1 node nghẽn băng thông (sharding không cứu vì 1 key = 1 slot). *Dấu hiệu:* `redis-cli --bigkeys`, `--hotkeys`, hoặc CPU/băng thông lệch hẳn 1 node. *Fix big key:* tách nhỏ (shard thành nhiều key), dùng `HSCAN`/`SSCAN` để duyệt từng phần. *Fix hot key:* local cache in-process TTL 1-2s, nhân bản key `hot:1..N` đọc random, đọc từ replica.

**3. Penetration vs Breakdown vs Avalanche — phân biệt dứt khoát.**
- **Penetration (xuyên thủng):** key **không tồn tại trong cả cache lẫn DB** (id âm/random, thường do attacker dò). Mọi request xuyên xuống DB. *Fix:* cache negative result (`SET key "NULL" EX 60`), Bloom filter chứa id hợp lệ, validate input ở API.
- **Breakdown (đánh sập 1 điểm) = chính là stampede:** **một hot key đang tồn tại** vừa hết hạn → nghìn request cùng rebuild. *Fix:* mutex lock chỉ 1 request rebuild, request coalescing, early/XFetch refresh, hoặc hot key không bao giờ set TTL (refresh bằng background job).
- **Avalanche (tuyết lở):** **nhiều key hết hạn cùng lúc** (cùng warm 1 lần) **hoặc Redis sập** → toàn bộ traffic dồn DB → DB sập dây chuyền. *Fix:* TTL jitter (±10-20%), HA (Sentinel/Cluster), circuit breaker + rate limit trước DB, multi-level cache.

Một câu nhớ: **Penetration = không bao giờ có; Breakdown/Stampede = 1 key đang nóng vừa chết; Avalanche = cả đám chết cùng lúc / Redis chết.**

**4. Eviction bất ngờ do `maxmemory`.** Cache "tự nhiên mất key" dù TTL chưa hết: thực ra Redis chạm `maxmemory` và **evict** theo policy. Tệ hơn: nếu để `noeviction` (mặc định), write bị **từ chối** với `OOM command not allowed` → app tưởng Redis lỗi. *Dấu hiệu:* `INFO stats` có `evicted_keys` tăng, hoặc lỗi OOM. *Fix:* set `maxmemory` (vd 75% RAM máy) + policy phù hợp (`allkeys-lru`/`allkeys-lfu` cho cache thuần); cảnh báo khi `evicted_keys` tăng nhanh — dấu hiệu cache quá nhỏ hoặc có key rác.

**5. Mất dữ liệu khi chỉ bật RDB + crash.** RDB snapshot mỗi vài phút; crash giữa 2 snapshot → mất toàn bộ write từ snapshot trước (có thể vài phút). *Dấu hiệu:* sau restart, data tụt về thời điểm cũ. *Fix:* nếu Redis là source-of-truth thì bật AOF (`appendfsync everysec`, mất tối đa ~1s) + RDB; nếu chỉ là cache thì chấp nhận mất (và phải đảm bảo cold-cache không làm sập DB — xem avalanche).

**6. Release nhầm lock của người khác (thiếu token).** Lock TTL 10s, job chạy 12s → lock auto-expire ở giây 10, người B lấy lock; tới giây 12 job A xong gọi `DEL lock` → **xóa nhầm lock của B**, người C lại vào → loạn. *Dấu hiệu:* 2 instance cùng chạy 1 job "độc quyền", data bị xử lý 2 lần. *Fix:* token UUID + release bằng Lua (check token rồi mới DEL); thêm watchdog gia hạn TTL khi job còn sống; TTL phải dài hơn thời gian job tối đa với biên an toàn.

## ⚖️ Đánh đổi & quyết định thiết kế

**Cache-aside vs write-through vs write-behind.**
- *Cache-aside:* đơn giản, chỉ cache cái được đọc, Redis chết app vẫn chạy (chậm); đổi lại miss đầu chậm + cửa sổ inconsistency nhỏ. **Default cho 90% trường hợp.**
- *Write-through:* ghi cache + DB đồng bộ → cache luôn fresh, đọc luôn hit; đổi lại write chậm hơn và cache cả thứ không bao giờ đọc (phí RAM). Hợp khi đọc >> ghi và cần fresh.
- *Write-behind:* ghi cache, trả lời ngay, flush DB bất đồng bộ theo batch → write cực nhanh (counter view/like); **rủi ro mất data nếu Redis chết trước khi flush**. Chỉ dùng cho dữ liệu chấp nhận mất chút (analytics, counter), không cho tiền/đơn.

**RDB vs AOF vs cả hai.** RDB: file nhỏ, restore nhanh, ít ảnh hưởng runtime, nhưng mất data giữa 2 snapshot + fork tốn RAM. AOF: bền (mất ≤1s với everysec) nhưng file lớn, restore chậm. **Production có data quan trọng → bật cả hai** (AOF để bền + RDB để backup/restore nhanh; Redis 7 hybrid càng tốt). **Cache thuần → tắt cả hai** (persistence chỉ tốn I/O và làm fork lag).

**TTL ngắn vs dài.** Ngắn (10-60s): fresh hơn, ít stale, nhưng hit rate thấp + nhiều lần rebuild (dễ stampede). Dài (giờ/ngày): hit rate cao, nhẹ DB, nhưng stale lâu + cần invalidation chủ động khi data đổi. Quy tắc: TTL ≈ mức độ chấp nhận stale của business; **luôn có TTL** làm lưới an toàn dù đã có invalidation; thêm jitter để chống avalanche.

**Redis làm cache vs làm primary store.** Cache: chấp nhận mất, dùng `allkeys-lru`, không cần persistence, lỗi thì fallback DB. Primary store: **phải** bật AOF + replica + backup, dùng `noeviction` (không bao giờ evict data thật), giám sát chặt; cân nhắc rằng toàn bộ data phải vừa RAM (đắt) và mất data vẫn có rủi ro phi-zero do replication async. Đa số nên dùng Redis như cache/derived state, để DB bền làm source-of-truth.

## 🎯 Câu hỏi phỏng vấn NÂNG CAO

**Q1: Single-thread sao chịu nổi 100k+ ops/s, và khi nào single-thread thành nhược điểm?**
Vì dữ liệu trên RAM (lệnh ~100ns) và single-thread loại sạch lock/context-switch — bottleneck là network/memory chứ không phải CPU; I/O multiplexing (epoll) cho 1 thread phục vụ vạn connection. Thành nhược điểm khi có **1 lệnh O(N) chậm** (`KEYS *`, big key `DEL`, Lua dài) → block toàn server. Redis 6 thread hóa I/O socket nhưng thực thi lệnh vẫn single-thread.

**Q2: Lua script có atomic không? Vì sao? Đánh đổi gì?**
Có. Vì Redis thực thi lệnh single-thread, **cả script chạy liền mạch không lệnh nào chen vào** — biến check-then-act (unlock, trừ kho, token bucket) thành 1 đơn vị không thể race. Đánh đổi: script chạy lâu **block toàn server**; trên Cluster mọi key trong script phải **cùng slot**; tránh lệnh non-deterministic (random/time) trong script ghi vào dataset (gây lệch replica) — Redis chặn hoặc yêu cầu `redis.replicate_commands()` (cũ).

**Q3: Redlock có an toàn cho correctness không?**
Không tuyệt đối. Redlock chống được case 1 node Redis chết (lấy đa số 3/5 node), nhưng Kleppmann chỉ ra nó phụ thuộc clock/timing không an toàn (NTP nhảy, GC pause vượt TTL) và **thiếu fencing token**. Cho **efficiency** (tránh làm trùng, sai cũng không chết ai) → single-node lock + TTL đủ. Cho **correctness** (không bao giờ 2 holder) → consensus store (etcd/ZooKeeper) + fencing token để resource từ chối holder cũ.

**Q4: Phân biệt penetration / breakdown(stampede) / avalanche và cách chống từng cái?**
*Penetration:* key không tồn tại trong DB → cache negative + Bloom filter + validate input. *Breakdown/stampede:* 1 hot key đang tồn tại vừa hết hạn → mutex 1 rebuild + coalescing + early/XFetch refresh hoặc hot key không TTL. *Avalanche:* nhiều key chết cùng lúc / Redis sập → TTL jitter + HA + circuit breaker + multi-level cache.

**Q5: Vì sao key có TTL vẫn tốn RAM sau khi hết hạn? Có cách nào ép giải phóng?**
Redis dùng lazy (xóa khi đụng tới) + active sampling (cron lấy ~20 key có TTL, xóa key chết, lặp nếu >25% chết) — không có timer per-key. Key hết hạn mà không ai đụng + chưa tới lượt sample vẫn nằm RAM. Không nên "ép" thủ công; nếu lo dọn, giảm `hz` cao hơn (tốn CPU) hoặc đảm bảo có truy cập. Đừng dựa vào RAM được giải phóng đúng giây TTL.

**Q6: Vì sao RAM Redis tăng vọt lúc BGSAVE/rewrite, và nó có thể OOM không?**
`fork()` dùng copy-on-write: child chia sẻ page với parent, chỉ clone khi parent ghi. Trong lúc save, write từ client làm bẩn page → kernel clone → RAM tăng, worst case gần gấp đôi nếu write nhiều. Có thể OOM/fork-fail nếu thiếu RAM; fix: để dư RAM, `vm.overcommit_memory=1`, theo dõi `latest_fork_usec` và `mem_fragmentation_ratio`.

**Q7: MOVED khác ASK thế nào trong Cluster?**
`MOVED` = slot đã dời hẳn → client cập nhật bản đồ slot→node và đi node mới mãi mãi. `ASK` = slot đang migrate dở, key tạm ở node đích → client gửi `ASKING` rồi lệnh tới node đích **chỉ cho request đó**, không cập nhật bản đồ (vì slot chưa dời xong).

**Q8: Khi nào chọn pipeline, khi nào MULTI/EXEC, khi nào Lua?**
Pipeline khi chỉ cần **giảm round-trip** nhiều lệnh độc lập (không cần atomic). MULTI/EXEC khi cần nhóm lệnh **không bị xen** và có thể dùng `WATCH` cho CAS lạc quan (nhưng không đọc giá trị giữa chừng để quyết định, không rollback). Lua khi cần **check-then-act atomic có logic điều kiện** (trừ kho, rate limit, unlock) — gọn và an toàn hơn WATCH/retry, đổi lại phải giữ script ngắn.

**Q9: `DEL` một list 5 triệu phần tử trên prod — chuyện gì xảy ra, làm sao tránh?**
`DEL` giải phóng O(N) đồng bộ trên main thread → block server vài trăm ms tới vài giây. Dùng `UNLINK` (Redis 4+) để giải phóng bất đồng bộ ở lazyfree thread; bật `lazyfree-lazy-server-del`, `lazyfree-lazy-eviction`, `lazyfree-lazy-expire yes` để eviction/expire/del lớn không block.

## 📚 Đọc thêm

- Redis docs: *Memory optimization* (encoding & ngưỡng listpack), *Expire* (lazy/active), *Persistence* (RDB/AOF/fork COW), *Cluster spec* (16384 slot, MOVED/ASK).
- Martin Kleppmann — *"How to do distributed locking"* và phản hồi của antirez — đọc cả hai để nắm tranh luận Redlock + fencing token.
- antirez blog — *"Redis cluster, no central dictatorship"* (vì sao 16384 slot) và *"Lazy Redis is better Redis"* (UNLINK/lazyfree).
- *Designing Data-Intensive Applications* (Kleppmann) — chương replication & consistency để hiểu vì sao replication async làm lock/single-node không an toàn cho correctness.
- Probabilistic early expiration / XFetch: paper *"Optimal Probabilistic Cache Stampede Prevention"* (Vattani et al.).
- Công cụ: `redis-cli --bigkeys --hotkeys --memkeys`, `MEMORY USAGE key`, `OBJECT ENCODING`, `INFO commandstats/stats/persistence`, `LATENCY DOCTOR`, `SLOWLOG GET`.
