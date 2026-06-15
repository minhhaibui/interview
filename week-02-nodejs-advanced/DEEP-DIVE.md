# 🔬 Đào sâu — Tuần 2: Node.js Advanced

> README đã dạy "dùng cái gì, khi nào"; tài liệu này mổ xẻ "bên dưới nó hoạt động ra sao" và những chỗ dễ chết khi lên production.

## 🧠 Cơ chế bên trong

### Cluster: master phân phối connection thế nào?

Node có **2 chiến lược** phân phối connection trong cluster, không chỉ "round-robin chung chung":

1. **`SCHED_RR` (round-robin) — mặc định trên Linux/macOS.** Chỉ **master** gọi `accept()` trên listening socket, rồi tự tay gửi file descriptor của connection cho từng worker theo vòng tròn qua IPC (`sendHandle`). Master làm "load balancer trong process". Ưu điểm: phân phối đều. Nhược: master là một điểm phải đi qua, và quyết định không dựa trên độ bận thực của worker.

2. **`SCHED_NONE` — mặc định trên Windows.** Tất cả worker cùng `accept()` trên một shared socket handle, để **kernel** tự đánh thức process nào. Vấn đề kinh điển: **"thundering herd"** và phân phối lệch — một worker có thể ôm phần lớn connection.

```js
const cluster = require('cluster');
cluster.schedulingPolicy = cluster.SCHED_RR; // ép round-robin tường minh
```

**`SO_REUSEPORT` — khác với cluster.** Đây là socket option ở tầng kernel (Linux 3.9+): nhiều process cùng `bind()` một port, **kernel** hash theo 4-tuple (src IP/port + dst IP/port) để chia connection — và giữ **cùng client luôn vào cùng process** (sticky theo connection). Node 18.19+/20 expose qua `{ reusePort: true }` trong `server.listen()`. Đây là hướng "mỗi process tự listen độc lập", thay cho mô hình master-phân-phối của cluster — gần với cách chạy nhiều container hơn.

```js
// Node 20: mỗi process listen độc lập, kernel chia tải — không cần master
require('http').createServer(handler).listen({ port: 3000, reusePort: true });
```

**Sticky session khi có WebSocket.** Round-robin của cluster phân connection ngẫu nhiên cho worker → với HTTP stateless thì ổn, nhưng WebSocket/Socket.IO (đặc biệt khi fallback long-polling) cần **cùng client luôn vào cùng worker**, nếu không handshake và message frame rơi vào worker khác → lỗi `Session ID unknown`. Cách xử lý:

- Sticky theo IP ở tầng cân bằng (nginx `ip_hash`, ALB stickiness cookie), HOẶC `SO_REUSEPORT` (hash 4-tuple).
- Quan trọng hơn: **đừng giữ state trong worker**. Dùng `@socket.io/redis-adapter` để mọi worker publish/subscribe qua Redis → broadcast tới room hoạt động xuyên worker/instance, lúc đó sticky chỉ còn cần cho transport chứ không cho dữ liệu.

### worker_threads: chia sẻ memory thật sự

`postMessage` mặc định dùng **structured clone** → **copy** dữ liệu (tốn CPU + RAM với payload lớn). Có 2 cách tránh copy:

- **`SharedArrayBuffer`**: vùng nhớ **dùng chung thật** giữa các thread (không clone). Đọc/ghi qua TypedArray. Vì nhiều thread đụng cùng byte → cần `Atomics` để tránh race condition; `Atomics.wait/notify` cho phép một thread ngủ chờ thread khác (xây mutex/semaphore).
- **Transferable (`ArrayBuffer`, `MessagePort`)**: **chuyển quyền sở hữu** (zero-copy) — sau khi transfer, bên gửi mất quyền truy cập buffer đó.

```js
// Chia sẻ counter giữa main và worker mà KHÔNG copy
const shared = new SharedArrayBuffer(4);
const view = new Int32Array(shared);
const worker = new Worker('./w.js', { workerData: shared });
// w.js: const view = new Int32Array(workerData); Atomics.add(view, 0, 1);
Atomics.add(view, 0, 5);          // an toàn cho đa thread
Atomics.load(view, 0);            // đọc giá trị nhất quán
```

**`MessageChannel`** tạo cặp port hai chiều, có thể `transfer` một port sang worker để worker nói chuyện trực tiếp với worker khác mà không qua main thread — nền tảng để dựng worker pool có hàng đợi.

### JWT internals

`header.payload.signature`, mỗi phần **base64url** (khác base64: `+`→`-`, `/`→`_`, bỏ `=` padding):

- **header**: `{"alg":"HS256","typ":"JWT"}` — `alg` quyết định verify thế nào, và đây chính là chỗ bị tấn công (xem bẫy `alg:none`).
- **payload**: claims chuẩn `iss, sub, aud, exp, iat, jti`. `exp/iat` là Unix seconds. **Chỉ encode, không mã hóa** → ai có token cũng đọc được; muốn giấu nội dung phải dùng JWE.
- **signature**: `HMAC-SHA256(base64url(header) + "." + base64url(payload), secret)`.

**HS256 vs RS256:**

| | HS256 (symmetric) | RS256 (asymmetric) |
|---|---|---|
| Khóa | 1 secret chung để ký VÀ verify | Private key ký, **public key** verify |
| Rủi ro | Ai verify được cũng **giả mạo token được** | Service verify chỉ có public key → không phát hành giả được |
| Dùng khi | Monolith, một bên vừa ký vừa verify | Microservices, OAuth/OIDC — auth server giữ private key, mọi service verify bằng public key (JWKS) |

**Vì sao KHÔNG để secret yếu (HS256):** signature chỉ an toàn bằng entropy của secret. Secret kiểu `"secret"`/`"123456"` bị brute-force offline trong vài giây (tool `hashcat`/`jwt_tool`) — kẻ tấn công lấy 1 token hợp lệ, crack secret, rồi **tự ký token admin**. Quy tắc: HS256 secret ≥ 256-bit ngẫu nhiên (`crypto.randomBytes(32)`), không bao giờ commit.

**Refresh token rotation & blacklist** (đào sâu phần README đã giới thiệu):

- Access token JWT cố ý **stateless** → không thể "xóa" giữa chừng. Để logout/revoke tức thì có 2 kỹ thuật:
  - **TTL ngắn (5-15')**: chấp nhận token lộ sống tối đa vài phút — đơn giản, hay dùng.
  - **Blacklist theo `jti`**: lưu `jti` của token bị thu hồi vào Redis với TTL = thời gian còn lại đến `exp`. Mỗi request verify xong còn check `jti` có trong blacklist không. Đánh đổi: thêm một lần I/O → bán-stateful, mất một phần lợi ích stateless.
- Refresh token nên là **chuỗi ngẫu nhiên (opaque)** lưu **hash** ở server, không nên là JWT — vì refresh là thứ cần revoke được, để stateless lại đi ngược mục đích.

### Middleware pipeline của Express

Bản chất là **mảng layer** xếp theo thứ tự `app.use`/route. `next()` chỉ là "gọi layer kế trong mảng". Vài điểm sâu hay bị hỏi:

- **Error-handling middleware nhận diện bằng arity = 4** `(err, req, res, next)`. Express đọc `fn.length` để phân loại; nếu bạn để `next` không dùng mà rút xuống 3 tham số, nó **không còn là** error handler. Express **bỏ qua** mọi error middleware cho đến khi có `next(err)`, rồi **bỏ qua** mọi middleware thường còn lại để nhảy thẳng tới error handler kế tiếp.
- `next('route')` (chỉ trong route handler) bỏ qua các handler còn lại của **route đó**, sang route khớp tiếp theo — khác hẳn `next(err)`.
- Middleware đăng ký **sau** khi response đã gửi mà vẫn `res.send` lần nữa → `ERR_HTTP_HEADERS_SENT`.

## 🧪 Ví dụ nâng cao

### 1. Graceful shutdown ĐÚNG (drain + stop accepting + force-exit)

README có bản cơ bản; bản dưới xử lý đúng **3 vấn đề bị bỏ sót**: readiness fail trước, keep-alive idle connection, và chống double-signal.

```js
const http = require('http');
const server = http.createServer(app);
server.listen(3000);

let shuttingDown = false;
let inFlight = 0;

// Đếm request đang chạy + từ chối request mới khi đang shutdown
app.use((req, res, next) => {
  if (shuttingDown) {
    res.set('Connection', 'close');        // báo client đừng tái sử dụng socket
    return res.status(503).json({ error: 'Server shutting down' });
  }
  inFlight++;
  res.on('finish', () => inFlight--);
  next();
});

// readiness: trả 503 ngay khi bắt đầu shutdown -> LB rút traffic TRƯỚC khi đóng
app.get('/readyz', (req, res) =>
  res.status(shuttingDown ? 503 : 200).json({ ready: !shuttingDown }));

async function shutdown(signal) {
  if (shuttingDown) return;                 // chống nhận SIGTERM 2 lần
  shuttingDown = true;
  console.log(`[shutdown] ${signal} — bắt đầu drain, in-flight=${inFlight}`);

  // 1) Ngừng nhận connection MỚI; chờ request đang chạy xong
  server.close(async () => {
    console.log('[shutdown] mọi connection đã đóng, dọn tài nguyên');
    try {
      await Promise.allSettled([db.end(), redis.quit(), queue.close()]);
      console.log('[shutdown] xong, exit 0');
      process.exit(0);
    } catch (e) {
      console.error('[shutdown] lỗi khi dọn', e);
      process.exit(1);
    }
  });

  // 2) Cắt các keep-alive connection ĐANG IDLE (không thì server.close treo)
  server.closeIdleConnections?.();          // Node 18.2+

  // 3) Hard timeout — không drain được thì cưỡng chế thoát
  setTimeout(() => {
    console.error('[shutdown] quá hạn 15s, force exit');
    process.exit(1);
  }, 15_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

### 2. Rate-limit middleware (token bucket, tự viết để hiểu cơ chế)

```js
// Token bucket: mỗi key có 'capacity' token, hồi 'refillPerSec' token/giây.
// Hiểu cơ chế trước khi xài express-rate-limit; production thì đẩy bucket sang Redis.
function rateLimit({ capacity = 10, refillPerSec = 1 }) {
  const buckets = new Map(); // key -> { tokens, last }
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    let b = buckets.get(key) ?? { tokens: capacity, last: now };
    // hồi token theo thời gian trôi qua
    b.tokens = Math.min(capacity, b.tokens + ((now - b.last) / 1000) * refillPerSec);
    b.last = now;
    if (b.tokens < 1) {
      const retry = Math.ceil((1 - b.tokens) / refillPerSec);
      res.set('Retry-After', String(retry));
      buckets.set(key, b);
      return res.status(429).json({ error: 'Too Many Requests' });
    }
    b.tokens -= 1;
    buckets.set(key, b);
    next();
  };
}
app.use('/auth/login', rateLimit({ capacity: 5, refillPerSec: 5 / 900 })); // ~5/15 phút
```

> Lưu ý production: `Map` nằm trong RAM → leak nếu không dọn key cũ, và mỗi worker đếm riêng (xem README mục cluster). Bản thật dùng `rate-limit-redis` với `INCR + EXPIRE` atomic.

### 3. Đo & vá memory leak bằng heap snapshot (bằng code, không cần DevTools)

```js
const v8 = require('v8');
const fs = require('fs');

// Chụp snapshot theo lệnh: kill -USR2 <pid>
process.on('SIGUSR2', () => {
  const file = `/tmp/heap-${Date.now()}.heapsnapshot`;
  const out = fs.createWriteStream(file);
  v8.getHeapSnapshot().pipe(out);           // stream, không nuốt RAM
  out.on('finish', () => console.log('snapshot ->', file));
});

// Log heap mỗi 5s để thấy xu hướng (leak = đường đi lên, không tụt sau GC)
setInterval(() => {
  const m = process.memoryUsage();
  console.log(`rss=${(m.rss/2**20)|0}MB heapUsed=${(m.heapUsed/2**20)|0}MB ext=${(m.external/2**20)|0}MB`);
}, 5000);
```

Quy trình: chụp 3 snapshot (trước tải → sau tải → sau tải tiếp), mở Chrome DevTools → Memory → **Comparison** giữa snapshot 2 và 1, sort theo **Size Delta**. Object còn sống ở snapshot 3 mà sinh giữa 1–2 là nghi phạm; nhìn **Retainers** để truy ai giữ reference. Vá điển hình: thay cache vô hạn bằng `lru-cache`, `removeListener`, `clearInterval`, đổi `Map` sang `WeakMap`.

### 4. JWT verify middleware (phân biệt expired vs invalid)

```js
const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) {
    return res.status(401).json({ error: { code: 'NO_TOKEN', message: 'Missing bearer token' } });
  }
  try {
    const payload = jwt.verify(h.slice(7), process.env.JWT_PUBLIC_KEY, {
      algorithms: ['RS256'],                 // KHÓA cứng alg -> chặn 'alg:none' & confusion
      issuer: 'auth.myapp.com',
      audience: 'myapp-api',
    });
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    // Phân biệt để client biết khi nào cần refresh
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: { code: 'TOKEN_EXPIRED', message: 'Access token expired' } });
    }
    return res.status(401).json({ error: { code: 'TOKEN_INVALID', message: 'Invalid token' } });
  }
}
```

## 🐛 Bẫy & sự cố production

**1. Không xử lý SIGTERM → mất request khi rolling update.**
*Dấu hiệu:* mỗi lần deploy có một nhúm 502/503, log của pod cũ bị cắt giữa chừng, transaction dở dang.
*Nguyên nhân:* Kubernetes gửi SIGTERM rồi đợi `terminationGracePeriodSeconds` (mặc định 30s) mới SIGKILL; nếu app không bắt SIGTERM, nó chạy tiếp tới khi bị kill cứng giữa lúc đang serve.
*Fix:* graceful shutdown (mục ví dụ trên) + readiness fail ngay + `preStop: sleep 5` để LB kịp rút endpoint trước khi process đóng socket.

**2. CORS sai.**
*Dấu hiệu:* browser báo "blocked by CORS policy"; hoặc tệ hơn, mọi origin đều qua được.
*Nguyên nhân:* `app.use(cors())` mở `*` cho mọi origin; mà `origin: '*'` **không thể đi cùng** `credentials: true` (cookie) — browser từ chối. Nhiều người "fix" bằng cách reflect bừa `Access-Control-Allow-Origin` = origin client gửi lên → vô hiệu hóa CORS, mở cửa CSRF.
*Fix:* whitelist origin tường minh; nếu cần cookie thì `origin: [danh sách], credentials: true`. CORS là cơ chế của **browser**, không bảo vệ được khỏi client non-browser — đừng coi nó là auth.

**3. JWT trong localStorage (XSS) vs httpOnly cookie (CSRF).**
*Dấu hiệu:* token bị đánh cắp dù server "đúng chuẩn JWT".
*Nguyên nhân:* localStorage đọc được bằng JS → một lỗ XSS bất kỳ là mất token. Đổi sang cookie thì né XSS nhưng cookie tự gửi kèm → mở **CSRF**.
*Fix:* access token ngắn hạn giữ **trong memory** (biến JS, mất khi reload — chấp nhận được); refresh token trong **httpOnly + Secure + SameSite=Strict/Lax** cookie; thêm **CSRF token** (double-submit) cho các route dùng cookie. Không có chỗ "an toàn tuyệt đối" — chọn để tối thiểu hóa bề mặt tấn công.

**4. N+1 ở tầng service.**
*Dấu hiệu:* endpoint list chậm tuyến tính theo số bản ghi; log DB thấy hàng trăm query gần giống nhau `SELECT ... WHERE id = ?`.
*Nguyên nhân:* lấy danh sách `orders` rồi `for (o of orders) await getUser(o.userId)` → 1 + N query.
*Fix:* gom bằng `WHERE id IN (...)` / JOIN; với GraphQL/ORM dùng **DataLoader** (gộp + cache trong 1 request tick). Đừng "fix" bằng cache mù — sửa hình dạng query trước.

**5. Không set timeout cho outbound HTTP → cạn socket.**
*Dấu hiệu:* app treo dần rồi đứng hẳn, `ECONNRESET`/`ETIMEDOUT` lác đác, số socket `ESTABLISHED` tăng không giảm.
*Nguyên nhân:* `fetch`/axios mặc định **không có timeout** → một upstream chậm/treo giữ socket vô hạn; connection pool cạn, request mới xếp hàng.
*Fix:* luôn đặt timeout (`AbortSignal.timeout(5000)` cho fetch Node 20, hoặc `timeout` của axios) + retry có **circuit breaker** + giới hạn `maxSockets` trên agent. Một dependency chậm không được phép kéo sập cả service.

```js
// Node 20: outbound fetch luôn có hạn chót
const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
```

**6. Log đồng bộ chặn event loop.**
*Dấu hiệu:* p99 latency tăng vọt dưới tải, `monitorEventLoopDelay` báo p99 cao, CPU không cao tương ứng.
*Nguyên nhân:* `console.log` ghi ra file/pipe có thể **blocking** khi đích là file; `JSON.stringify` object khổng lồ mỗi log line; log synchronous trong hot path.
*Fix:* dùng logger async/buffered (**pino** — serialize nhanh, ghi qua transport ở thread khác), log ở mức hợp lý, không stringify payload lớn trong vòng nóng.

## ⚖️ Đánh đổi & quyết định thiết kế

**Session vs JWT — không phải "cái nào tốt hơn" mà "revoke tức thì có quan trọng không":**
- Cần đăng xuất/khóa tài khoản có hiệu lực **ngay** (ngân hàng, admin) → **session** (hoặc JWT + blacklist `jti`, chấp nhận bán-stateful).
- Microservices/mobile, muốn mọi service tự verify không gọi auth server mỗi request → **JWT RS256**, đổi lấy việc revoke khó.
- Thực dụng nhất: **access JWT ngắn + refresh opaque stateful** — lấy cái tốt của cả hai.

**Express vs NestJS vs Fastify:**
- **Express**: tối giản, linh hoạt, hệ sinh thái khổng lồ; nhưng để tự ráp cấu trúc, async error (v4) phải tự lo, throughput không cao bằng Fastify.
- **Fastify**: nhanh nhất (schema-based serialization, validation bằng JSON Schema biên dịch sẵn), plugin/encapsulation tốt; trade-off là ecosystem nhỏ hơn Express.
- **NestJS**: opinionated (DI, module, decorator), tuyệt cho team lớn/codebase lớn cần cấu trúc thống nhất; trade-off là boilerplate nhiều, learning curve cao, một lớp abstraction phủ lên (mặc định dùng Express, có thể đổi adapter sang Fastify).

**Cluster vs nhiều container sau load balancer (12-factor):**
- **Cluster/PM2** trên một máy: tận dụng đủ core với 1 deploy unit, IPC rẻ; nhưng vi phạm tinh thần 12-factor (one process per container), khó scale qua nhiều máy, một process master lỗi ảnh hưởng cả nhóm, observability rối (nhiều worker chung 1 container).
- **Nhiều container 1-process sau LB (K8s/ECS)**: scale ngang xuyên máy, mỗi pod độc lập, rolling update/health check/autoscale do orchestrator lo, đúng 12-factor; trade-off là cần hạ tầng (LB, orchestrator) và state **bắt buộc** externalize (Redis/S3).
- **Thực tế:** trong K8s thường chạy **1 process/pod** và để **HPA** scale số pod — đừng lồng cluster trong container trừ khi muốn ép một pod xài đủ core của node. `SO_REUSEPORT` là điểm giữa: nhiều process độc lập, không cần master.

## 🎯 Câu hỏi phỏng vấn NÂNG CAO

**Q1: JWT bị lộ thì thu hồi bằng cách nào?**
Stateless JWT không "xóa" được. Lựa chọn: (a) chờ `exp` — nên đặt TTL ngắn để cửa sổ thiệt hại nhỏ; (b) blacklist theo `jti` trong Redis (TTL = thời gian còn lại) → mỗi request check thêm, đổi tính stateless lấy khả năng revoke; (c) đổi/bump khóa ký để vô hiệu **toàn bộ** token (giải pháp nặng tay, dùng khi nghi khóa lộ); (d) tăng `tokenVersion` per-user, nhúng vào token, đổi DB khi cần revoke 1 user. Refresh token thì để **opaque + stateful** ngay từ đầu để revoke dễ.

**Q2: Vì sao stateless auth khó logout, và cách giảm đau?**
Vì server không lưu trạng thái token → không có gì để "đánh dấu đã chết". Logout phía client chỉ là xóa token khỏi máy client, token cũ vẫn hợp lệ tới `exp`. Giảm đau: TTL ngắn + refresh rotation (logout = revoke refresh family, access tự chết sau vài phút) + blacklist `jti` cho yêu cầu logout-ngay.

**Q3: `alg:none` / algorithm confusion là gì?**
`alg:none`: kẻ tấn công sửa header thành `{"alg":"none"}`, bỏ signature; thư viện cấu hình lỏng sẽ "verify" pass. Confusion (RS256→HS256): server dùng RS256, attacker đổi header sang HS256 rồi ký bằng **public key** (vốn công khai) làm "secret" HMAC; nếu code verify không khóa thuật toán, nó lấy public key làm HMAC secret → pass. **Fix:** luôn truyền `algorithms: ['RS256']` tường minh khi verify; không bao giờ để thư viện tự suy `alg` từ token.

**Q4: cluster vs Kubernetes replica — chọn cái nào?**
Trong môi trường có orchestrator: **1 process/pod + HPA scale replica** (12-factor, scale xuyên máy, health/rolling do K8s). Cluster chỉ hợp khi bạn buộc phải vắt đủ core của một node trong một deploy unit và không có orchestrator. Lồng cluster trong pod thường gấp đôi sự phức tạp mà không thêm lợi ích. `SO_REUSEPORT` là phương án giữa nếu muốn nhiều process độc lập trên một host.

**Q5: Làm sao zero-downtime deploy với graceful shutdown?**
Phối hợp 5 mảnh: (1) **readiness probe** fail ngay khi nhận SIGTERM → LB ngừng đẩy traffic; (2) `preStop` hook `sleep` vài giây để LB kịp xóa endpoint trước khi process đóng socket; (3) `server.close()` drain request đang chạy + `closeIdleConnections()`; (4) hard timeout < `terminationGracePeriodSeconds`; (5) rolling update với `maxUnavailable: 0` để luôn còn pod cũ phục vụ tới khi pod mới `ready`.

**Q6: Khi nào dùng SharedArrayBuffer thay vì postMessage, và rủi ro?**
Khi cần chia sẻ vùng dữ liệu lớn/đổi liên tục giữa các worker mà không chịu chi phí clone (vd buffer ảnh, mảng số khổng lồ). Rủi ro: nhiều thread đụng cùng byte → **data race**; phải dùng `Atomics` để đọc/ghi nhất quán và đồng bộ. SharedArrayBuffer cũng từng bị tắt mặc định vì Spectre — trong browser cần COOP/COEP, trong Node thì bật sẵn.

**Q7: HS256 vs RS256, chọn cho hệ microservices có nhiều service verify token?**
**RS256**: auth server giữ private key để ký, các service chỉ có **public key** (lấy qua JWKS endpoint, cache + xoay khóa theo `kid`) để verify → service bị xâm nhập cũng **không phát hành token giả** được. HS256 dùng secret chung: mọi service verify được cũng tự ký được → một service rò secret là sập cả hệ. Nên dùng RS256 (hoặc ES256) cho hệ phân tán.

**Q8: Express error middleware không bắt được lỗi async — vì sao và sửa thế nào?**
Express 4 chỉ tự bắt lỗi **đồng bộ** throw trong handler; một `async` handler reject sẽ thành **unhandledRejection**, không tới error middleware. Sửa: bọc handler bằng helper `wrap(fn) = (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next)`, hoặc `express-async-errors`, hoặc nâng lên **Express 5** (đã tự forward rejected promise vào error pipeline).

## 📚 Đọc thêm

- Node.js docs — [Cluster](https://nodejs.org/api/cluster.html), [Worker Threads](https://nodejs.org/api/worker_threads.html), [`net.Server` (`reusePort`)](https://nodejs.org/api/net.html).
- V8 blog — [Trash talk: GC thế hệ](https://v8.dev/blog/trash-talk), [Orinoco GC](https://v8.dev/blog/concurrent-marking).
- [RFC 7519 (JWT)](https://datatracker.ietf.org/doc/html/rfc7519), [RFC 8725 — JWT Best Current Practices](https://datatracker.ietf.org/doc/html/rfc8725) (đọc kỹ phần `alg` confusion).
- OWASP — [Cheat Sheet: JWT for Java/Node](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html), [REST Security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html).
- Kubernetes — [Pod termination lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-termination), [Liveness/Readiness probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/).
- [The Twelve-Factor App](https://12factor.net/) — Concurrency, Disposability, Stateless processes.
- Thư viện nên xem: `pino` (logging), `lru-cache`, `rate-limit-redis`, `@socket.io/redis-adapter`, `helmet`.
