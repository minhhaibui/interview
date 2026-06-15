# Tuần 2 — Thiết kế hệ thống & Case thực tế: Node.js Advanced

> Tài liệu bổ trợ cho README.md cùng thư mục. Học sau khi xong phần lý thuyết.

## 🏗️ Mini System Design (scoped vào chủ đề tuần)

### Bài 1: API server chịu 10K RPS trên máy 8 core

**Đề bài:** Một REST API (CRUD + gọi DB, mỗi request ~10ms xử lý, trong đó ~8ms đợi I/O) cần chịu **10.000 RPS** ổn định. Hạ tầng: 1 máy bare-metal 8 core / 16GB RAM (giai đoạn 1), sau đó chuyển lên Kubernetes (giai đoạn 2). Thiết kế cách tận dụng đủ 8 core, so sánh cluster/PM2 vs nhiều container replica, và chỉ rõ khi nào cần sticky session.

**Phân tích & lời giải:**

Bước 1 — Capacity math (luôn mở đầu bằng con số):
- 1 process Node = 1 event loop = dùng tốt ~1 core. Request 10ms nhưng chỉ ~2ms CPU → 1 process lý thuyết ~500 RPS/core (1000ms / 2ms CPU), thực tế ăn toàn ~300–400 RPS sau overhead GC/serialize.
- 10K RPS / ~350 RPS ≈ cần **~28-30 process** lý thuyết? Không — tính lại: 2ms CPU/req → 1 core xử lý 500 req/s; 8 core ≈ 4000 RPS/máy thực dụng (~70% utilization → ~2800-3500). **Kết luận quan trọng: 1 máy 8 core KHÔNG đủ cho 10K RPS** → cần ~3-4 máy sau load balancer, hoặc phải đo profile thật để khẳng định CPU/req thấp hơn. Trình bày được "tôi tính ra cần scale ngang" tốt hơn là gồng ép 1 máy.

Bước 2 — Tận dụng 8 core trên 1 máy (giai đoạn 1):

```
                 ┌──────────── Máy 8 core ────────────┐
   LB/nginx ───▶ │  PM2 cluster mode (8 workers)      │
                 │  Master: fork + SO_REUSEPORT-style │
                 │  round-robin phân connection       │
                 │  W1 W2 W3 W4 W5 W6 W7 W8           │
                 └────────────────────────────────────┘
```

- `cluster` module / PM2 cluster mode: master fork N worker, **các worker share cùng 1 port**; trên Linux master nhận connection và round-robin phát cho worker (mặc định từ Node 0.12) để tránh phân phối lệch của kernel.
- PM2 cho thêm: auto-restart khi crash, `pm2 reload` zero-downtime (restart từng worker một), max-memory-restart như lưới chống leak.

```bash
pm2 start app.js -i max --max-memory-restart 1G
```

Bước 3 — Giai đoạn 2, lên Kubernetes — đổi mô hình:

| Tiêu chí | PM2 cluster trong 1 container | Nhiều replica, 1 process/container |
|---|---|---|
| Triết lý container | Sai (nhiều process/container) | Đúng (1 process = 1 container) |
| Scale | Theo máy (dọc) | HPA theo CPU/RPS (ngang) |
| Cô lập lỗi | 1 worker leak → cùng cgroup memory | Mỗi pod giới hạn riêng, OOM kill 1 pod |
| Quan sát | PM2 logs/metrics tự quản | K8s/Prometheus chuẩn hóa |
| Phân tải | PM2 master round-robin | kube-proxy/Service + LB |

→ Trên K8s: **bỏ PM2, chạy `node app.js` trần 1 process/pod**, request limit ~1 CPU/pod, 10-12 replica + HPA. PM2 trong K8s là anti-pattern phổ biến (2 tầng supervisor chồng nhau, health check và signal handling rối).

Bước 4 — Sticky session, khi nào cần?
- API **stateless** (JWT, session trong Redis) → **không cần** sticky, đây là mặc định nên hướng tới.
- Bắt buộc sticky khi: state nằm trong memory của process — Socket.IO với polling fallback (handshake nhiều request phải về cùng worker), in-memory session, SSE có state cục bộ.
- Cách làm: nginx `ip_hash`/`hash $cookie_x`, hoặc trên K8s `sessionAffinity: ClientIP`. Nhấn mạnh trong phỏng vấn: *"sticky session là mùi của state đặt sai chỗ — tôi sẽ tìm cách đẩy state ra Redis trước khi chấp nhận sticky."*

Bước 5 — Những thứ làm 10K RPS chết ngoài CPU: connection pool DB (8 worker × pool 10 = 80 conn; 12 pod × 10 = 120 conn → cần PgBouncer), keep-alive giữa LB và Node (`server.keepAliveTimeout` phải **lớn hơn** idle timeout của LB, không thì dính lỗi 502 ngẫu nhiên), và GC pressure (giảm allocate object trong hot path).

**Trade-offs:**
- PM2/cluster: tận dụng máy to đơn giản, deploy kiểu VM truyền thống tốt; nhưng scale theo "máy", khó autoscale, master là điểm điều phối thêm.
- Nhiều replica nhỏ: cô lập, autoscale, rolling update chuẩn; đổi lại tốn overhead per-pod (base memory ~70-100MB/process) và cần hạ tầng orchestration.
- Ít process to (heap lớn) vs nhiều process nhỏ: heap to → GC pause dài hơn; nhiều process nhỏ → GC pause ngắn, blast radius nhỏ.

**Follow-up interviewer hay hỏi:**
1. *"Worker crash thì request đang xử lý ra sao?"* → Mất (socket reset). Giảm thiểu: LB retry idempotent request, graceful shutdown khi chủ động restart (bài 3), và đảm bảo `uncaughtException` → log + exit chứ không gắng chạy tiếp với state hỏng.
2. *"Vì sao không tăng `worker_threads` thay vì cluster?"* → worker_threads chia sẻ 1 event loop chính cho HTTP — accept/parse request vẫn dồn 1 thread; cluster nhân bản cả event loop, đúng công cụ cho bài "nhiều request độc lập".
3. *"HPA scale theo metric gì với Node?"* → CPU thường trễ và không phản ánh I/O bound; tốt hơn: RPS per pod (custom metric) hoặc event loop lag / p95 latency qua Prometheus adapter.

---

### Bài 2: Auth service hoàn chỉnh — JWT access + refresh rotation

**Đề bài:** Thiết kế auth service cho app mobile + web, 2 triệu user, 200K DAU. Yêu cầu: access token stateless để các service khác tự verify; refresh token có **rotation**; revoke được phiên (đổi mật khẩu, nghi ngờ lộ); **logout tất cả thiết bị**; user đăng nhập tối đa 5 thiết bị. Chỉ rõ lưu refresh token ở đâu (server + client).

**Phân tích & lời giải:**

Bước 1 — Mô hình token kép:
- **Access token**: JWT, TTL **10-15 phút**, ký RS256/EdDSA (asymmetric) để service khác verify bằng public key (JWKS endpoint) mà không cần gọi auth service, không cần share secret. Claims tối thiểu: `sub`, `sid` (session id), `iat`, `exp`, `jti`, roles gọn.
- **Refresh token**: chuỗi random opaque 256-bit (không cần JWT — nó luôn được verify tại auth service nên stateless không có lợi), TTL 30 ngày trượt, **một-lần-dùng** (rotation).

Bước 2 — Lưu trữ server-side:

```sql
CREATE TABLE refresh_sessions (
  id            UUID PRIMARY KEY,          -- sid, nhúng vào access token
  user_id       BIGINT NOT NULL REFERENCES users(id),
  token_hash    TEXT NOT NULL,             -- SHA-256 của refresh token (KHÔNG lưu plaintext)
  family_id     UUID NOT NULL,             -- chuỗi rotation cùng 1 lần login
  device_info   JSONB,                     -- model, os, ip — hiển thị "phiên đang hoạt động"
  expires_at    TIMESTAMPTZ NOT NULL,
  rotated_at    TIMESTAMPTZ,               -- NULL = token hiện hành của family
  revoked_at    TIMESTAMPTZ
);
CREATE INDEX ON refresh_sessions (user_id);
CREATE UNIQUE INDEX ON refresh_sessions (token_hash);
```

Lưu DB (Postgres) làm source of truth + cache Redis cho hot path. Hash token trước khi lưu — DB bị dump cũng không dùng được token.

Bước 3 — Flow rotation + phát hiện token bị trộm (reuse detection):

```
POST /token/refresh { refresh_token }
  ├─ hash → tìm row
  ├─ Không thấy / hết hạn / revoked  → 401
  ├─ rotated_at != NULL  ⚠️ TOKEN CŨ BỊ DÙNG LẠI
  │     → kẻ trộm hoặc client race. An toàn trước:
  │     REVOKE TOÀN BỘ family_id, bắt đăng nhập lại, alert user
  └─ Hợp lệ:
        đánh dấu rotated_at = now()
        tạo token mới CÙNG family_id
        trả { access_token, refresh_token mới }
```

Đây là điểm ăn tiền: rotation không chỉ để "đổi token cho vui" — nó biến refresh token thành **bẫy phát hiện trộm**: token cũ xuất hiện lần 2 nghĩa là có 2 bên cùng giữ (client thật + kẻ trộm) → diệt cả family.

Bước 4 — Revoke access token đang còn hạn (bài toán khó nhất của stateless JWT): access token 15 phút "không thu hồi được" theo nghĩa thuần stateless. Giải pháp lai:
- **Denylist theo `sid`** trong Redis, TTL = TTL còn lại của token: `SET revoked:sid:<sid> 1 EX 900`. Service khác verify chữ ký xong, check thêm 1 lệnh Redis GET (~0.5ms). Logout-all-devices = revoke mọi `sid` của user (hoặc lưu `token_version` trong user record, nhúng vào claim, bump version là chết hết).
- Chấp nhận trade-off: thêm 1 network hop cho mỗi request — đổi lấy revoke tức thì. Phương án rẻ hơn: chỉ check denylist ở endpoint nhạy cảm (đổi pass, thanh toán), endpoint thường chấp nhận trễ tối đa 15 phút.

Bước 5 — Lưu phía client:
- **Web**: refresh token trong cookie `HttpOnly; Secure; SameSite=Strict; Path=/token/refresh` (JS không đọc được → chống XSS đánh cắp); access token giữ trong memory (biến JS), không localStorage. CSRF cho endpoint refresh chặn bằng SameSite + custom header.
- **Mobile**: Keychain (iOS) / Keystore (Android).
- Giới hạn 5 thiết bị: khi login, đếm family đang active của user, vượt 5 → revoke family cũ nhất (LRU).

**Trade-offs:**
- TTL access ngắn ↔ tải refresh: 15 phút × 200K DAU ≈ vài chục refresh/s — nhẹ. TTL 1 phút thì "an toàn hơn" nhưng auth service thành hot path.
- JWT asymmetric vs symmetric: RS256 cho verify phân tán + rotate key qua JWKS (`kid` header); HS256 đơn giản, nhanh hơn, nhưng mọi service giữ secret = mọi service ký được token.
- Stateless thuần vs denylist lai: thuần = không revoke được trước expiry; lai = thêm Redis dependency. Hầu hết hệ thống thật chọn lai.
- Refresh token là JWT vs opaque: opaque thắng — ngắn hơn, không lộ metadata, và đằng nào cũng phải tra DB.

**Follow-up interviewer hay hỏi:**
1. *"Hai tab cùng refresh một lúc, token bị rotate 2 lần → tab kia dính reuse-detection oan?"* → Grace period: token cũ vẫn được chấp nhận trong ~10-30s sau khi rotate (trả về đúng token mới đã phát) — hoặc client-side mutex (chỉ 1 refresh in-flight, các request khác đợi).
2. *"Rotate signing key thế nào không làm chết token đang lưu hành?"* → JWKS chứa nhiều key, token có `kid`; phát hành bằng key mới, vẫn verify key cũ đến khi mọi token cũ hết hạn (15 phút), sau đó gỡ key cũ.
3. *"Sao không dùng session truyền thống cho khỏe?"* → Trong monolith thì đúng là nên cân nhắc! JWT trả giá bằng revoke khó. JWT thắng khi nhiều service cần verify phân tán không gọi về trung tâm. Trả lời "tùy kiến trúc" + tiêu chí chọn = điểm senior.

---

### Bài 3: Graceful deploy không rớt request

**Đề bài:** Service Node trên Kubernetes, 30 pod, deploy 5 lần/ngày, traffic 3K RPS liên tục. Hiện mỗi lần deploy có ~0.05% request lỗi 502/ECONNRESET. Yêu cầu thiết kế quy trình shutdown + cấu hình k8s để deploy **zero failed requests**, kể cả request đang chạy dở và connection keep-alive đang mở.

**Phân tích & lời giải:**

Bước 1 — Mổ xẻ vì sao rớt request khi deploy. Trình tự k8s khi kill pod:

```
Pod bị chọn terminate
  ├─ (song song!) ① Gửi SIGTERM cho container
  └─ (song song!) ② Xóa pod khỏi Endpoints → LB ngừng gửi traffic MỚI
                      nhưng ② lan truyền mất 1-5s (kube-proxy, ingress reload)
  ⚠️ Khoảng hở: pod đã nhận SIGTERM nhưng VẪN còn nhận request mới vài giây
  └─ Hết terminationGracePeriodSeconds (mặc định 30s) → SIGKILL
```

3 nguồn lỗi: (a) process exit ngay khi SIGTERM → chém ngang request đang chạy; (b) đóng listener rồi nhưng LB chưa biết, request mới đến bị refuse; (c) connection keep-alive đang mở bị reset.

Bước 2 — Thiết kế shutdown sequence trong code:

```js
const server = app.listen(3000);
const sockets = new Set();
server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); });

let shuttingDown = false;

process.on('SIGTERM', async () => {
  shuttingDown = true;                    // ① readiness bắt đầu trả 503

  await sleep(8000);                      // ② chờ endpoint update lan truyền
                                          //    (vẫn phục vụ bình thường trong lúc này)

  server.close(async () => {              // ③ ngừng accept connection mới,
    await db.pool.end();                  //    chờ request in-flight xong
    await redis.quit();                   // ④ đóng dependency theo thứ tự
    process.exit(0);
  });

  // ⑤ chủ động đóng keep-alive idle (server.close không tự cắt chúng)
  for (const s of sockets) if (!s._httpMessage) s.destroy();
  // Node >= 18: server.closeIdleConnections() làm sạch hơn

  setTimeout(() => process.exit(1), 20_000).unref(); // ⑥ hard deadline < gracePeriod
});

app.get('/readyz', (req, res) => shuttingDown ? res.status(503).end() : res.end('ok'));
app.get('/healthz', (req, res) => res.end('ok')); // liveness KHÔNG đổi khi shutdown
```

Giải thích từng quyết định:
- **Readiness ≠ liveness**: readiness fail → ngừng nhận traffic mới; liveness fail → k8s *giết* pod (điều ngược lại điều ta muốn khi đang drain). Lỗi cấu hình kinh điển là dùng chung 1 endpoint.
- **Sleep trước khi close** giải quyết khoảng hở (b): pod tiếp tục phục vụ trong lúc LB cập nhật. Cách chuẩn k8s tương đương: `preStop: exec: command: ["sleep", "8"]` — preStop chạy **trước** khi SIGTERM được gửi, code app khỏi cần sleep.
- **Đóng keep-alive idle chủ động**: `server.close()` chỉ chờ socket *active* xong, socket keep-alive idle sẽ treo `close` callback mãi → phải destroy idle, còn socket đang chạy request thì để nó xong (header `Connection: close` ở response cuối).

Bước 3 — Cấu hình k8s đi kèm:

```yaml
spec:
  terminationGracePeriodSeconds: 45      # > sleep(8) + drain(20) + dependency close
  containers:
  - lifecycle:
      preStop: { exec: { command: ["sleep", "8"] } }
    readinessProbe:
      httpGet: { path: /readyz, port: 3000 }
      periodSeconds: 2
      failureThreshold: 1
strategy:
  rollingUpdate: { maxUnavailable: 0, maxSurge: 25% }   # pod mới Ready rồi mới giết pod cũ
```

Và pod mới: readiness chỉ pass khi đã **warm** (DB pool connect xong, config load xong) — không là rớt request ở đầu kia của rolling update.

Bước 4 — Bẫy Docker hay gặp: chạy `CMD npm start` → PID 1 là npm, **không forward SIGTERM** cho node → app không bao giờ nhận signal, đợi hết 30s rồi bị SIGKILL. Fix: `CMD ["node", "server.js"]` (exec form, node làm PID 1) hoặc dùng tini.

**Trade-offs:**
- Grace period dài → deploy chậm (30 pod × 45s tuần tự từng batch); ngắn → request dài (export, upload) bị chém. Có endpoint chạy > 30s thì đừng kéo grace period lên 10 phút — chuyển job dài sang async queue (đúng bài học case 3 bên dưới).
- `sleep` trong preStop là "đoán" thời gian lan truyền — đơn giản, hoạt động tốt 99%; chính xác tuyệt đối thì cần LB chủ động drain (ALB deregistration delay, Envoy drain) — phức tạp hơn.
- maxUnavailable 0 an toàn nhưng cần dư capacity cho surge pod.

**Follow-up interviewer hay hỏi:**
1. *"WebSocket/SSE connection sống hàng giờ thì drain kiểu gì?"* → Không thể chờ — gửi frame yêu cầu client reconnect (kèm jitter), client tự nối sang pod mới; đặt deadline ~30s rồi đóng phần còn lại.
2. *"Job consumer (Kafka/Bull) thì graceful shutdown khác gì HTTP?"* → Ngừng poll/nhận message mới, chờ message in-flight xử lý xong + commit offset/ack xong rồi mới exit; deadline để message dở được requeue thay vì mất.
3. *"Làm sao chứng minh đã zero-downtime?"* → Chạy load test (k6/vegeta) liên tục xuyên qua một lần deploy, đếm non-2xx; đây là test nên đưa vào CI/CD pipeline.

---

### Bài 4: Rate limiting middleware đa tầng cho API public

**Đề bài:** API public (có cả endpoint anonymous lẫn authenticated) chạy 12 instance sau LB. Thiết kế rate limiting **3 tầng**: per-IP 100 req/phút cho anonymous, per-user theo gói (free 1K/giờ, pro 50K/giờ), per-endpoint đặc biệt (`POST /auth/login` 5 lần/15 phút theo IP+email chống credential stuffing). Phải nhất quán giữa 12 instance, chịu được khi Redis chết, trả đúng header chuẩn 429.

**Phân tích & lời giải:**

Bước 1 — Vì sao phải counter tập trung: limit in-memory trên 12 instance nghĩa là user thực tế được 12×limit (LB round-robin) và con số nhảy múa theo số replica → **Redis làm shared counter**.

Bước 2 — Chọn thuật toán theo tầng:

| Thuật toán | Ưu | Nhược | Dùng cho |
|---|---|---|---|
| Fixed window | 1 INCR+EXPIRE, rẻ nhất | Burst 2x ở ranh giới window | per-user quota giờ (sai số chấp nhận được) |
| Sliding window (counter 2 window nội suy) | Mượt, vẫn rẻ | Xấp xỉ | per-IP phút |
| Token bucket | Cho phép burst có kiểm soát, refill đều | Cần Lua giữ atomic | API trả phí cần burst |
| Sliding log (ZSET) | Chính xác tuyệt đối | O(N) memory theo số request | login limit (N=5, quá rẻ) |

Bước 3 — Atomic là bắt buộc (GET rồi SET là race giữa 12 instance) → Lua script chạy nguyên tử trên Redis. Ví dụ fixed-window:

```lua
-- KEYS[1]=key  ARGV[1]=limit  ARGV[2]=window_sec
local current = redis.call('INCR', KEYS[1])
if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[2]) end
if current > tonumber(ARGV[1]) then
  return {0, redis.call('TTL', KEYS[1])}   -- bị chặn, kèm thời gian chờ
end
return {1, tonumber(ARGV[1]) - current}    -- cho qua, kèm remaining
```

Bước 4 — Kiến trúc middleware xếp lớp:

```js
// Thứ tự: rẻ trước, đắt sau; chặn sớm nhất có thể
app.use(ipLimiter);          // tầng 1: per-IP — chạy TRƯỚC auth (chặn cả anonymous flood)
app.use(authenticate);
app.use(userQuotaLimiter);   // tầng 2: per-user theo plan (đọc plan từ JWT claim, khỏi query DB)
app.post('/auth/login', loginLimiter, loginHandler); // tầng 3: gắn đích danh endpoint

function makeLimiter({ keyFn, limit, windowSec }) {
  return async (req, res, next) => {
    try {
      const [allowed, info] = await redis.evalsha(SHA, 1, keyFn(req), limit(req), windowSec);
      res.set({
        'RateLimit-Limit': limit(req),
        'RateLimit-Remaining': Math.max(0, info),
        ...(allowed ? {} : { 'Retry-After': info }),
      });
      if (!allowed) return res.status(429).json({ error: 'rate_limited' });
      next();
    } catch (err) {            // Redis chết → quyết định fail-open hay fail-closed
      metrics.rateLimitErrors.inc();
      next();                  // fail-open cho API thường (xem trade-off)
    }
  };
}
```

Chi tiết quan trọng:
- **Key tầng 3**: `login:{ip}:{sha1(email)}` — theo cặp IP+email chống cả 1 IP thử nhiều email lẫn nhiều IP thử 1 email (thêm key `login:email:{hash}` ngưỡng cao hơn).
- **Lấy IP đúng**: sau LB phải đọc `X-Forwarded-For` với `app.set('trust proxy', số_hop_chính_xác)` — set `true` bừa là attacker tự fake IP qua header để né limit.
- **Trả `Retry-After` + body rõ ràng**: client tử tế biết đường backoff, giảm retry storm.

Bước 5 — Khi Redis chết: API thường **fail-open** (mất rate limit vài phút ít thiệt hại hơn chặn 100% traffic — availability trước); riêng `/auth/login` **fail-closed sang fallback in-memory** per-instance (bảo mật trước — chấp nhận limit lỏng hơn 12 lần còn hơn mở toang cho brute-force).

**Trade-offs:**
- Fail-open vs fail-closed: chọn **theo từng endpoint** dựa trên cái gì đắt hơn — mất availability hay mất an toàn. Trả lời "tùy endpoint" kèm tiêu chí là câu trả lời senior.
- Limit ở API gateway (Kong/nginx/Cloudflare) vs trong app: gateway chặn sớm, rẻ, đỡ tải app; trong app mới biết user/plan/business logic. Thực tế dùng cả hai: gateway chặn thô (per-IP), app chặn tinh (per-user/plan).
- Sliding log chính xác nhưng ZSET tốn memory O(requests) → chỉ dùng cho key có limit nhỏ như login.

**Follow-up interviewer hay hỏi:**
1. *"Một round-trip Redis mỗi request có thành bottleneck?"* → Redis chịu ~100K ops/s/instance, latency nội DC ~0.3-0.5ms; cao hơn nữa thì local cache quyết định "block" vài giây (block là trạng thái lan truyền được), pipeline các tầng vào 1 round-trip, hoặc Redis Cluster shard theo key.
2. *"Distributed rate limit có đếm chính xác tuyệt đối được không?"* → Trên thực tế chấp nhận xấp xỉ (race nhỏ ở biên, replica lag); chính xác tuyệt đối đòi consensus → đắt vô lý cho bài toán này. Nói được "đây là bài toán chọn độ chính xác đủ dùng" là điểm cộng.
3. *"Phân biệt rate limiting với circuit breaker / load shedding?"* → Rate limit bảo vệ theo **danh tính client** (công bằng, quota); load shedding bảo vệ **chính server** khi quá tải tổng (rớt bớt theo độ ưu tiên); circuit breaker bảo vệ **khi downstream hỏng**. Ba lớp bổ sung nhau.

---

## 🌍 Case thực tế

### Case 1: Memory leak production — cache không giới hạn trong module scope

**Bối cảnh:** Service Node phục vụ catalog sản phẩm cho app e-commerce (kiểu Tiki/Sendo scale vừa), 6 pod trên k8s, limit memory 1GB/pod. Một dev thêm "optimization": cache kết quả tính giá khuyến mãi vào một `Map` ở module scope, key là `${productId}:${userId}` — vì giá phụ thuộc cả user segment.

**Vấn đề gặp phải:** Sau deploy 2 tuần, pod bắt đầu bị **OOMKilled lác đác lúc rạng sáng**, k8s tự restart nên không ai để ý — cho đến đợt sale, traffic gấp 5, pod chết liên tục mỗi 2-3 giờ, restart storm làm p99 tăng vọt (pod mới cold start + cache rỗng). Đồ thị memory dạng **răng cưa đi lên**: leo dần, restart, leo lại — chữ ký kinh điển của leak chậm. Key `productId × userId` về bản chất là không chặn trên: 100K sản phẩm × 500K user active.

**Giải pháp & tại sao (kể đúng trình tự debug — đây là phần phỏng vấn muốn nghe):**
1. **Xác nhận leak**: đồ thị `process_memory_heap_used` tăng đơn điệu qua nhiều ngày bất kể traffic → leak, không phải thiếu RAM.
2. **Heap snapshot so sánh**: chụp qua `node --inspect` (hoặc `v8.writeHeapSnapshot()` qua endpoint admin) tại 2 thời điểm cách nhau 1 giờ trên cùng pod, mở Chrome DevTools → tab Comparison → sort theo "Retained Size delta" → thấy 1 `Map` retain 600MB, đi ngược retainer chain → ra đúng module pricing cache.
3. **Fix**: thay `Map` bằng **LRU có giới hạn** (`lru-cache`, max 50K entries + TTL 5 phút). Cân nhắc cả việc bỏ `userId` khỏi key — cache theo `productId:segmentId` (vài chục segment) giảm cardinality 4 bậc.
4. **Phòng tái diễn**: alert khi heap > 80% kéo dài; review checklist "mọi cache phải có max size + TTL"; load test soak (chạy 8 tiếng) trước release lớn.

**Bài học rút ra:** Module scope trong Node sống suốt đời process — mọi cấu trúc dữ liệu tự quản ở đó (Map cache, mảng listeners, closure giữ context) là ứng viên leak. "Cache không có max size" không phải cache, là leak có chủ đích. Răng cưa memory + OOMKilled định kỳ = đi tìm heap snapshot, đừng tăng RAM limit (chỉ trì hoãn).

**💬 Cách dùng case này khi phỏng vấn:** Câu "đã từng debug memory leak chưa?" → kể theo mạch 4 bước trên, nhấn vào kỹ thuật **so sánh 2 snapshot + retainer chain** — đó là chi tiết phân biệt người đã làm thật với người đọc blog.

---

### Case 2: Lộ JWT secret — xử lý sự cố và rotate

**Bối cảnh:** Startup fintech, auth dùng JWT HS256 với secret nằm trong file `.env`... bị commit lên một repo private, rồi repo được mở public khi open-source một tool nội bộ. Một researcher báo qua email bảo mật: secret nằm trong git history, ai cũng có thể **tự ký token với quyền bất kỳ user nào**, kể cả admin.

**Vấn đề gặp phải:** Đây là sự cố mức nghiêm trọng nhất của auth: attacker không cần đánh cắp token của ai — tự forge được token tùy ý, bypass toàn bộ. Khó ở chỗ: rotate secret ngay lập tức = **toàn bộ token đang lưu hành chết** = logout cưỡng bức hàng trăm nghìn user giữa giờ cao điểm; không rotate = cửa mở từng phút.

**Giải pháp & tại sao:**
1. **Quyết định trong 15 phút: rotate ngay, chấp nhận mass logout.** Với fintech, an toàn > tiện lợi, không có tranh cãi. (Với app ít nhạy cảm hơn, có thể cân nhắc dual-secret vài giờ — nhưng phải nói rõ làm vậy là kéo dài cửa sổ tấn công.)
2. Kỹ thuật rotate mềm nhất có thể: deploy verify chấp nhận **2 key theo `kid`** (key mới + key cũ) nhưng key cũ chỉ sống **15 phút** (đúng TTL access token) rồi gỡ; mọi token mới ký bằng key mới. Refresh token (opaque, lưu DB) không bị ảnh hưởng → user có refresh token hợp lệ tự lấy lại access token, **phần lớn user không nhận ra sự cố**. Đây là lúc thiết kế "access ngắn + refresh opaque" (bài 2) cứu mạng.
3. **Điều tra**: quét log bất thường trong khoảng phơi nhiễm — token có `iat` lạ, user-agent lạ, hành vi leo thang quyền; revoke phiên đáng ngờ; vì HS256 token forge **không phân biệt được với token thật bằng chữ ký**, phải dò bằng hành vi (token hợp lệ nhưng không có bản ghi login tương ứng là red flag).
4. **Sửa gốc**: chuyển secret sang secret manager (AWS Secrets Manager/Vault), gắn `gitleaks` vào CI + pre-commit, **chuyển HS256 → RS256** (private key chỉ auth service giữ; các service khác chỉ có public key → diện lộ thu hẹp từ "mọi service" xuống "một service"), viết runbook rotate để lần sau là thao tác 10 phút thay vì sự cố.

**Bài học rút ra:** (1) Khả năng rotate phải được **thiết kế từ đầu** (`kid` header + verify đa key) — lúc sự cố mới làm là quá muộn. (2) HS256 nhân diện lộ theo số service giữ secret; asymmetric thu về một điểm. (3) TTL access token chính là "thời gian khắc phục tối đa" của bạn — token 24h nghĩa là cửa mở 24h sau rotate. (4) Secret không bao giờ nằm trong code/env file đã commit.

**💬 Cách dùng case này khi phỏng vấn:** Khi hỏi "JWT có nhược điểm gì" hoặc "xử lý sự cố bảo mật thế nào" — kể case này để chuyển câu trả lời từ liệt kê lý thuyết sang quy trình incident response có quyết định trade-off (rotate ngay vs dual-key) và fix phòng ngừa.

---

### Case 3: Endpoint export CSV làm sập cả service

**Bối cảnh:** Hệ thống quản lý bán hàng cho chuỗi cửa hàng (dự án rất điển hình ở VN), Node + Express + MySQL, 4 instance. Có nút "Xuất Excel/CSV" cho chủ chuỗi tải toàn bộ đơn hàng. Code ban đầu: `SELECT * WHERE shop_id = ?` bằng ORM → load hết vào mảng → map sang CSV string → `res.send()`.

**Vấn đề gặp phải:** Chuỗi lớn nhất chạm mốc ~2 triệu đơn. Mỗi lần kế toán của họ bấm export cuối tháng: (1) ORM hydrate 2M object → heap phình ~1.5-2GB → **OOM crash hoặc GC pause hàng giây**; (2) build CSV string là CPU sync → **block event loop**, mọi user khác trên instance đó đứng hình; (3) request chạy > 60s → LB timeout trả 504 → kế toán... bấm lại, nhân đôi thảm họa; (4) instance crash → LB dồn traffic sang 3 instance còn lại → nguy cơ cascade. Một nút bấm của 1 user hạ cả service của nghìn user.

**Giải pháp & tại sao (2 nấc):**
1. **Nấc 1 — Streaming (fix nhanh trong tuần):** mysql2 `.stream()` đọc cursor từng row → Transform sang dòng CSV → pipe thẳng vào `res` với `Content-Disposition: attachment`. Memory từ ~2GB xuống ~vài chục MB bất kể số dòng, không còn khối sync lớn. Đây là bài stream tuần 1 áp vào thực tế.
2. **Nấc 2 — Async job (fix đúng):** export vẫn là việc nặng chiếm connection hàng phút và không survive deploy/restart → chuyển mô hình: `POST /exports` trả `202 { jobId }` → worker riêng (process tách biệt, đọc từ Redis queue/BullMQ) stream query → ghi file lên S3 → user nhận link presigned (polling hoặc email/notification). Kèm: chống bấm trùng (job dedup theo `shopId + tham số + ngày`), giới hạn N export đồng thời/shop, retry + TTL file 7 ngày.

Tại sao nấc 2 dù nấc 1 đã "chạy được": tách **workload tương tác** (cần latency ms) khỏi **workload batch** (cần throughput, chạy phút) — hai loại này chung process thì batch luôn phá SLA của interactive; worker riêng còn scale và deploy độc lập, graceful shutdown đơn giản hơn (bài 3: job dài không còn chặn drain).

**Bài học rút ra:** (1) Mọi endpoint có cost tỷ lệ theo kích thước data của khách (export, report, bulk) là bom hẹn giờ — chạy tốt ở demo, nổ khi khách lớn nhất dùng. (2) Quy tắc ngón tay cái: việc chạy quá ~30s không được sống trong request/response cycle — trả 202 + job queue. (3) Blast radius: trong Node, một handler tồi không chỉ chậm chính nó — nó kéo sập mọi request cùng process.

**💬 Cách dùng case này khi phỏng vấn:** Đây là case đa năng nhất — dùng được cho câu hỏi về streams, về event loop blocking, về job queue, lẫn "kể về một lần anh/chị cải thiện hệ thống". Kể theo mạch nấc 1 → nấc 2 để thể hiện biết phân biệt fix nhanh và fix đúng.

---

## ✅ Checklist tự kiểm tra

1. Tôi có làm được capacity math từ "X ms CPU/request" ra số process/pod cần cho N RPS, và giải thích vì sao chạy PM2 cluster bên trong pod k8s là anti-pattern không?
2. Tôi có vẽ được flow refresh token rotation kèm reuse-detection (vì sao token cũ dùng lại lần 2 → revoke cả family) và nói được refresh token lưu ở đâu trên web vs mobile không?
3. Tôi có liệt kê được 3 nguồn rớt request khi deploy (SIGTERM sớm, endpoint propagation trễ, keep-alive bị reset) và cách bịt từng cái (readiness 503, preStop sleep, closeIdleConnections) không?
4. Tôi có giải thích được vì sao rate limiter phải atomic (Lua) trên Redis, và lập luận fail-open vs fail-closed theo từng loại endpoint không?
5. Cho đồ thị memory răng cưa đi lên + OOMKilled định kỳ, tôi có mô tả được quy trình heap snapshot comparison → retainer chain để tìm thủ phạm không?
6. Nếu JWT secret bị lộ ngay bây giờ, tôi có nói được trình tự 4 bước xử lý (rotate đa key theo kid, giữ refresh flow, dò token forge bằng hành vi, chuyển asymmetric + secret manager) không?
7. Tôi có nêu được quy tắc "việc > 30s không sống trong request cycle" và vẽ kiến trúc 202 + job queue + presigned link thay cho endpoint export đồng bộ không?
