# 🧪 Lab Redis — Tận tay

Lab này để bạn **TỰ TAY** chạy Redis thật bằng Docker, rồi gọi từ Node.js để hiểu
các pattern hay gặp khi phỏng vấn backend: Cache-Aside, Rate Limit, Leaderboard, Pub/Sub.

> Môi trường: **Node v20**, **Docker Compose v2** (lệnh `docker compose`), client npm **`redis@^4`**, image **`redis:7-alpine`**.

---

## 🎯 Mục tiêu

Sau lab này bạn có thể tự tin trả lời/giải thích:

- Redis dùng để làm gì, tại sao nhanh (in-memory, single-thread + I/O multiplexing).
- Cache-Aside hoạt động ra sao, vì sao cần TTL, hit/miss khác nhau thế nào.
- Rate limit fixed-window bằng `INCR` + `EXPIRE`, hạn chế & hướng cải tiến.
- Sorted Set giải bài leaderboard/ranking.
- Pub/Sub và vì sao subscriber cần client riêng.
- Persistence (AOF vs RDB) và eviction policy (LRU/LFU…).

---

## 🏗️ Kiến trúc lab

```
lab/
├── docker-compose.yml   # Dựng Redis 7 (alpine) + healthcheck + volume bền
├── redis.conf           # Config có chú thích: maxmemory, eviction, AOF, RDB...
├── package.json         # scripts: cache / ratelimit / leaderboard / pubsub
├── src/
│   ├── connect.js       # Tạo & kết nối redis client (dùng chung)
│   ├── cache-aside.js   # Pattern Cache-Aside (GET -> miss -> DB -> SET EX)
│   ├── rate-limit.js    # Fixed-window: INCR + EXPIRE
│   ├── leaderboard.js   # Sorted Set: ZADD / ZREVRANGE / ZREVRANK / ZINCRBY
│   └── pubsub.js        # Pub/Sub với 2 client (subscriber + publisher)
└── LAB.md               # File bạn đang đọc
```

Node (host) ⇄ cổng `6379` ⇄ container `lab-redis` (Redis 7).

---

## ⚙️ Setup & chạy

### 1) Bật Redis bằng Docker

```bash
docker compose up -d
```

Kiểm tra container đã chạy & healthy:

```bash
docker compose ps
```

Kỳ vọng (cột STATUS có chữ `healthy`):

```
NAME         IMAGE            STATUS                   PORTS
lab-redis    redis:7-alpine   Up 10 seconds (healthy)  0.0.0.0:6379->6379/tcp
```

Ping thử cho chắc:

```bash
docker compose exec redis redis-cli ping     # -> PONG
```

### 2) Cài dependency Node

```bash
npm install
```

### 3) Chạy từng demo

#### 🗄️ Cache-Aside

```bash
npm run cache
```

Output mẫu:

```
✅ Đã kết nối Redis tại localhost:6379

--- Lần 1 (kỳ vọng MISS -> chậm vì xuống DB) ---
🐌 MISS user:42 — phải query DB...
💾 SET  user:42 (TTL 30s) — tổng 3xx ms

--- Lần 2 (kỳ vọng HIT -> nhanh hơn hẳn) ---
⚡ HIT  user:42 (0-1ms) — lấy từ cache
```

👉 So sánh: lần 1 ~300ms (xuống DB), lần 2 gần 0ms (cache). Đó là giá trị của cache.

#### 🚦 Rate limit

```bash
npm run ratelimit
```

Output mẫu:

```
🚦 Giới hạn: 5 request / 10s cho user "alice"

✅ Request #1: PASS  (count=1, còn lại 4)
...
✅ Request #5: PASS  (count=5, còn lại 0)
⛔ Request #6: 429 TOO MANY REQUESTS (count=6)
⛔ Request #7: 429 TOO MANY REQUESTS (count=7)
⛔ Request #8: 429 TOO MANY REQUESTS (count=8)
```

#### 🏆 Leaderboard

```bash
npm run leaderboard
```

Output mẫu:

```
➕ alice +400 điểm -> tổng 1900

🏆 TOP 3 BẢNG XẾP HẠNG
┌──────┬────────────┬────────┐
│ Hạng │ Người chơi │  Điểm  │
├──────┼────────────┼────────┤
│  1   │ alice      │   1900 │
│  2   │ carol      │   1800 │
│  3   │ erin       │   1350 │
└──────┴────────────┴────────┘

🔎 bob đang hạng 5 với 1200 điểm.
```

#### 📣 Pub/Sub

```bash
npm run pubsub
```

Output mẫu (thứ tự publish/nhận có thể xen kẽ):

```
👂 Subscriber đang nghe kênh "news"...
📤 Publish: "Tin 1: ..." -> 1 subscriber nhận
📩 Nhận trên "news": Tin 1: ...
...
✅ Đã nhận đủ message. Thoát.
```

> Gặp lỗi kết nối? Kiểm tra `docker compose ps` (phải `healthy`) và cổng 6379 không bị chiếm.
> Nếu bạn **bật `requirepass`** trong `redis.conf`, hãy chạy kèm biến môi trường, ví dụ:
> `REDIS_PASSWORD=MatKhauSieuManh_DoiDi npm run cache`

---

## 🔧 Giải thích redis.conf (tóm tắt)

| Tuỳ chọn | Ý nghĩa | Khi nào đổi |
|---|---|---|
| `maxmemory 256mb` | Trần RAM Redis được dùng | Tăng nếu cache nóng nhiều; cân với RAM máy |
| `maxmemory-policy allkeys-lru` | Khi đầy thì evict key ít dùng gần đây | `allkeys-lfu` nếu có hot key ổn định; `volatile-*` nếu trộn data bền + cache; `noeviction` nếu Redis là DB chính |
| `appendonly yes` + `appendfsync everysec` | Bật AOF, fsync mỗi giây (bền, mất tối đa ~1s) | `always` nếu cần bền tối đa (chậm); `no` nếu chấp nhận mất nhiều để nhanh |
| `save 900 1 / 300 10 / 60 10000` | RDB snapshot theo (giây, số thay đổi) | Tải nặng -> snapshot dày hơn; muốn nhẹ I/O -> thưa hơn |
| `requirepass` (đang comment) | Mật khẩu truy cập | **Bật ở mọi môi trường thật** |
| `dir /data` | Nơi lưu dump.rdb / AOF | Trùng volume `redisdata:/data` |

**AOF vs RDB ngắn gọn:** RDB = snapshot gọn, restore nhanh, có thể mất data giữa 2 lần chụp.
AOF = ghi từng lệnh, bền hơn, file to hơn. Thực tế hay bật **cả hai**.

---

## 🔍 Quan sát thêm (trong redis-cli)

Mở CLI bên trong container:

```bash
docker compose exec redis redis-cli
```

Rồi thử:

```redis
INFO memory                 # used_memory, maxmemory, policy...
INFO persistence            # trạng thái AOF/RDB, lần save cuối
DBSIZE                      # số key đang có

TTL user:42                 # thời gian sống còn lại của key (giây); -2 = không tồn tại, -1 = không TTL
OBJECT ENCODING user:42     # cách Redis lưu (embstr/int/raw...)
OBJECT ENCODING leaderboard:game   # listpack (nhỏ) hoặc skiplist (lớn)

MONITOR                     # XEM REALTIME mọi lệnh tới Redis (Ctrl-C để dừng).
                            # Mở thêm 1 terminal chạy npm run cache để thấy GET/SET hiện ra.
```

> `MONITOR` rất hữu ích để "nhìn tận mắt" pattern của bạn sinh ra lệnh gì.

---

## 💪 Bài tập mở rộng

1. **Sliding Window** — Thay fixed-window bằng sliding window dùng Sorted Set:
   mỗi request `ZADD key <now> <unique>`, xoá phần tử cũ hơn `now - window`
   bằng `ZREMRANGEBYSCORE`, rồi `ZCARD` để đếm. So sánh độ "mượt" so với fixed-window.

2. **Distributed Lock (SET NX EX)** — Viết hàm `acquireLock(resource, ttl)` dùng
   `SET lock:<resource> <token> NX EX <ttl>` (redis@4: `client.set(key, token, { NX: true, EX: ttl })`).
   Nhả lock an toàn bằng Lua so khớp token trước khi DEL (tránh xoá nhầm lock của người khác).

3. **Cache Stampede + Lock** — Khi cache MISS đồng loạt, hàng loạt request cùng đánh DB.
   Dùng lock ở bài 2: chỉ 1 request được "build" cache, các request khác chờ/đọc lại.
   Quan sát số lần `slowDbQuery` giảm hẳn.

4. **Đổi eviction policy** — Đổi `maxmemory` xuống nhỏ (vd `2mb`) và thử các policy
   (`allkeys-lru` vs `noeviction` vs `allkeys-lfu`). Nạp nhiều key rồi xem `INFO stats`
   (`evicted_keys`) và hành vi khi ghi lúc đầy. Sau khi sửa `redis.conf` nhớ:
   `docker compose restart redis`.

---

## 🧹 Dọn dẹp

```bash
docker compose down        # dừng & xoá container (GIỮ dữ liệu trong volume)
docker compose down -v      # dừng & xoá luôn volume -> MẤT dữ liệu Redis
```

---

## 🎤 Liên hệ câu phỏng vấn

**1) Vì sao Redis nhanh dù single-thread?**
Dữ liệu nằm trong RAM (in-memory), thao tác O(1)/O(log n), dùng I/O multiplexing
(epoll) để xử lý nhiều kết nối; single-thread tránh chi phí khoá/đua dữ liệu.

**2) Cache-Aside là gì? Khác Write-Through chỗ nào?**
Cache-Aside: app tự đọc cache, miss thì xuống DB và ghi lại cache (lazy).
Write-Through: ghi đi qua cache rồi mới xuống DB (cache luôn mới nhưng mọi ghi đều tốn).

**3) Làm rate limit với Redis thế nào? Hạn chế?**
Fixed-window: `INCR` + `EXPIRE`. Hạn chế: burst ở biên cửa sổ.
Cải tiến: sliding window (ZSET) hoặc token bucket.

**4) AOF vs RDB?**
RDB = snapshot định kỳ (gọn, restore nhanh, có thể mất data giữa 2 lần).
AOF = ghi từng lệnh (bền hơn, file to hơn). `appendfsync everysec` cân bằng tốt.

**5) Eviction policy & maxmemory?**
`maxmemory` đặt trần RAM; khi đầy áp `maxmemory-policy`.
Cache thuần -> `allkeys-lru/lfu`. Redis làm DB chính -> `noeviction`.
Trộn cache + data bền -> đặt TTL cho cache và dùng `volatile-*`.

**6) Vì sao subscriber Pub/Sub cần client riêng? Khi nào dùng Streams thay Pub/Sub?**
Client đang subscribe không chạy lệnh thường được nên phải tách 2 kết nối.
Pub/Sub là fire-and-forget (offline thì mất tin); cần lưu/replay/consumer-group -> dùng **Redis Streams**.
