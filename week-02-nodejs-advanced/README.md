# Tuần 2: Node.js Advanced

> 🔬 **Có bản đào sâu!** Xem [`DEEP-DIVE.md`](DEEP-DIVE.md) — cơ chế bên trong, ví dụ nâng cao, bẫy production & câu hỏi phỏng vấn KHÓ hơn cho tuần này.

## 🎯 Mục tiêu tuần này

- Phân biệt và chọn đúng công cụ scaling: **cluster vs worker_threads vs child_process**, hiểu cách scale Node.js theo chiều ngang/dọc.
- Hiểu **V8 memory & garbage collection**, nhận diện 5 loại memory leak phổ biến và debug bằng **heap snapshot**, profiling bằng `--inspect`/clinic.js.
- Nắm vững **Express/NestJS middleware & request lifecycle**, thiết kế **REST API** chuẩn production.
- Thành thạo **authentication** (JWT vs session, refresh token rotation) và **security** theo OWASP (injection, XSS, rate limiting, helmet).
- Biết vận hành chuẩn production: **graceful shutdown, health check**, và viết **test** (unit/integration với Jest, mocking).

## 📚 Lý thuyết

### Ngày 1-2: Scaling — cluster, worker_threads, child_process; Memory & Performance

#### 1. Ba cách "đa nhân hóa" Node.js

| | `child_process` | `cluster` | `worker_threads` |
|---|---|---|---|
| Bản chất | Spawn **process** mới (có thể là lệnh bất kỳ) | Wrapper trên child_process, fork process **cùng app**, **chia sẻ server port** | **Thread** trong cùng process |
| Memory | Tách biệt hoàn toàn | Tách biệt hoàn toàn | Chia sẻ được qua `SharedArrayBuffer`; mỗi worker có V8 isolate + event loop riêng |
| Giao tiếp | IPC, stdin/stdout | IPC (serialize JSON) | `postMessage` (structured clone), SharedArrayBuffer (zero-copy) |
| Use case | Chạy lệnh ngoài (ffmpeg, python script) | **Scale HTTP server** ra nhiều core | **CPU-bound task** (tính toán, parse lớn, nén, resize ảnh) |
| Chi phí | Nặng (process) | Nặng (process) | Nhẹ hơn (~vài MB/worker) |

```js
// cluster: tận dụng đủ CPU core cho HTTP server
const cluster = require('cluster');
const os = require('os');

if (cluster.isPrimary) {
  for (let i = 0; i < os.availableParallelism(); i++) cluster.fork();
  cluster.on('exit', (worker, code) => {
    console.log(`Worker ${worker.process.pid} died, restarting...`);
    cluster.fork(); // tự hồi sinh worker chết
  });
} else {
  require('./server'); // mỗi worker listen cùng port — primary phân phối connection (round-robin)
}
```

```js
// worker_threads: đẩy CPU-bound ra khỏi main thread
// main.js
const { Worker } = require('worker_threads');
function runFib(n) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./fib-worker.js', { workerData: n });
    worker.on('message', resolve);
    worker.on('error', reject);
  });
}

// fib-worker.js
const { parentPort, workerData } = require('worker_threads');
const fib = (n) => (n < 2 ? n : fib(n - 1) + fib(n - 2));
parentPort.postMessage(fib(workerData));
```

**Scaling tổng thể:** 1 máy → `cluster`/PM2 (`pm2 start app.js -i max`); nhiều máy → load balancer (nginx/ALB) + **stateless app** (session/cache đẩy ra Redis, file đẩy ra S3); tác vụ nặng → message queue (BullMQ/RabbitMQ) + worker service riêng. Lưu ý: cluster khiến in-memory state (rate limit counter, WebSocket room) không chia sẻ giữa worker → phải externalize.

#### 2. V8 Memory & Garbage Collection

V8 heap chia thế hệ (generational GC):

- **New space (young generation)**: object mới sinh, nhỏ (~16-32MB), GC bằng **Scavenge** (rất nhanh, chạy thường xuyên). Object sống sót qua 2 lần scavenge được promote lên old space.
- **Old space (old generation)**: object sống lâu, GC bằng **Mark-Sweep-Compact** (chậm hơn, một phần chạy song song/incremental để giảm pause).
- Ngoài heap: Buffer (off-heap), stack, code space.

Giới hạn heap mặc định ~4GB (64-bit, Node hiện đại; cũ hơn là ~1.5-2GB) — tăng bằng `node --max-old-space-size=8192 app.js`. Khi heap đầy và GC không giải phóng được → crash `FATAL ERROR: JavaScript heap out of memory`.

**5 memory leak phổ biến trong Node.js:**

1. **Biến global / module-level cache không giới hạn** — `const cache = {}` cứ set không bao giờ xóa → dùng LRU (`lru-cache`) hoặc TTL.
2. **Closure giữ tham chiếu object lớn** — callback/timer giữ reference tới request data đã xong.
3. **Event listener không remove** — `emitter.on()` trong request handler, mỗi request thêm 1 listener.
4. **Timer không clear** — `setInterval` tham chiếu object, quên `clearInterval`.
5. **Map/Set giữ key là object** — dùng `WeakMap`/`WeakRef` nếu chỉ cần "kèm metadata" theo vòng đời object.

**Debug bằng heap snapshot:**

```bash
node --inspect app.js   # mở Chrome → chrome://inspect → Memory tab
```

Quy trình chuẩn (3-snapshot technique): chụp snapshot 1 → bắn tải (vd 1000 request) → chụp snapshot 2 → bắn tải tiếp → snapshot 3 → so sánh "Objects allocated between 1 and 2" còn sống ở snapshot 3 → đó là leak. Nhìn cột **Retained Size** và **Retainers** để truy ra ai đang giữ reference. Có thể chụp bằng code: `require('v8').writeHeapSnapshot()` hoặc `process.kill(pid, 'SIGUSR2')` với heapdump.

#### 3. Performance profiling

- **`node --inspect`** + Chrome DevTools: CPU profile (flame chart — hàm nào chiếm thời gian), Memory (heap snapshot, allocation timeline).
- **`node --prof`** → `node --prof-process isolate*.log`: V8 tick profiler, xem % thời gian ở JS/C++/GC.
- **clinic.js** (NearForm):
  - `clinic doctor -- node app.js` — chẩn đoán tổng quát: event loop delay, CPU, memory, active handles → gợi ý vấn đề thuộc nhóm nào.
  - `clinic flame` — flamegraph tìm hot function (CPU-bound).
  - `clinic bubbleprof` — trực quan hóa async flow, tìm chỗ delay I/O.
- Đo nhanh event loop lag trong app: `perf_hooks.monitorEventLoopDelay()` — metric quan trọng nhất của Node service (loop delay cao = có code block).

```js
const { monitorEventLoopDelay } = require('perf_hooks');
const h = monitorEventLoopDelay({ resolution: 20 });
h.enable();
setInterval(() => console.log('p99 loop delay (ms):', h.percentile(99) / 1e6), 5000);
```

### Ngày 3-4: Express/NestJS, REST API Design, Authentication

#### 1. Express middleware & lifecycle

Express về bản chất là **một chuỗi middleware**: `(req, res, next) => {}` chạy tuần tự theo thứ tự đăng ký, cho đến khi có middleware kết thúc response.

```js
const express = require('express');
const app = express();

app.use(express.json({ limit: '1mb' }));          // 1. parse body
app.use(requestLogger);                            // 2. logging
app.use('/api', authenticate);                     // 3. auth cho /api/*
app.get('/api/users/:id', validate, getUserHandler); // 4. route handler

// 404 — đặt SAU tất cả route
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Error middleware — nhận diện bằng 4 THAM SỐ, đặt CUỐI CÙNG
app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  logger.error(err);
  res.status(status).json({ error: err.isOperational ? err.message : 'Internal error' });
});
```

Điểm hay bị hỏi:

- `next()` chuyển middleware kế; `next(err)` nhảy thẳng đến **error middleware**; quên gọi `next()` và không kết thúc response → request treo.
- **Express 4**: lỗi throw trong `async` handler KHÔNG tự vào error middleware — phải `try/catch + next(err)` hoặc dùng `express-async-errors`. **Express 5** đã tự bắt rejected promise.
- Thứ tự `app.use` quyết định tất cả — đặt body parser sau route thì route không có `req.body`.

**NestJS request lifecycle** (thứ tự chuẩn — câu hỏi NestJS kinh điển):

```
Middleware → Guards → Interceptors (trước) → Pipes → Controller Handler
→ Service → Interceptors (sau) → Exception Filters (nếu lỗi) → Response
```

- **Guard**: quyết định cho qua hay không (authz) — `CanActivate`.
- **Interceptor**: bọc quanh handler (logging, transform response, cache) — như AOP.
- **Pipe**: validate/transform input (`ValidationPipe` + class-validator).
- **Exception Filter**: format lỗi tập trung.
- DI container: provider mặc định singleton, inject qua constructor → dễ test (mock provider).

#### 2. REST API design best practices

- **Resource là danh từ, số nhiều**: `GET /users/123/orders` — không phải `/getUserOrders?id=123`.
- **HTTP method đúng ngữ nghĩa**: GET (đọc, idempotent, cache được), POST (tạo), PUT (thay toàn bộ, idempotent), PATCH (sửa một phần), DELETE (idempotent).
- **Status code đúng**: 200/201 (created, kèm `Location`)/204 (no content); 400 (input sai), 401 (chưa authenticate), 403 (không có quyền), 404, 409 (conflict), 422 (validation), 429 (rate limit); 500/503.
- **Versioning**: `/api/v1/...` (phổ biến nhất) hoặc header `Accept`.
- **Pagination, filter, sort chuẩn hóa**: `GET /orders?status=paid&sort=-createdAt&limit=20&cursor=abc`.
- **Response error nhất quán**: `{ "error": { "code": "ORDER_NOT_FOUND", "message": "...", "details": [...] } }`.
- **Idempotency-Key** cho POST quan trọng (thanh toán) — client gửi key, server lưu kết quả, retry không tạo bản ghi đôi.
- Validate input ở biên (Joi/zod/class-validator), không tin client; trả 422 kèm danh sách field lỗi.

#### 3. Authentication: JWT vs Session, Refresh Token Rotation

| | Session (stateful) | JWT (stateless) |
|---|---|---|
| Lưu trữ | Server lưu session (Redis), client giữ cookie chứa session ID | Server không lưu; token tự chứa claims, ký bằng secret/private key |
| Thu hồi | Tức thì (xóa session) | Khó — token sống đến khi hết hạn (cần blacklist/short TTL) |
| Scale | Cần shared store (Redis) | Dễ scale ngang, service nào cũng verify được |
| Phù hợp | Web truyền thống, cần revoke ngay | API, microservices, mobile |

JWT = `header.payload.signature` (base64url). **Payload chỉ được encode, KHÔNG mã hóa** — không nhét dữ liệu nhạy cảm. Server verify chữ ký (HS256: shared secret; RS256: ký bằng private key, verify bằng public key — chuẩn cho microservices vì service khác không thể tự phát hành token).

**Access token + Refresh token pattern:**

- Access token TTL ngắn (5-15 phút) — gửi kèm mỗi request (`Authorization: Bearer`).
- Refresh token TTL dài (7-30 ngày) — **lưu server-side** (DB/Redis, hash), client giữ trong **httpOnly + Secure + SameSite cookie** (không để JS đọc được → chống XSS đánh cắp).

**Refresh token rotation** (chuẩn hiện đại): mỗi lần refresh, server cấp **cặp token mới** và **vô hiệu refresh token cũ**. Nếu một refresh token cũ (đã dùng) bị dùng lại → nghi token bị đánh cắp → **revoke cả family** (toàn bộ token gốc từ lần login đó), buộc đăng nhập lại.

```js
// Phác thảo refresh endpoint với rotation
app.post('/auth/refresh', async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;
    const record = await store.findByHash(sha256(token));
    if (!record) throw new AppError('Invalid token', 401);
    if (record.revoked) {                 // reuse detection!
      await store.revokeFamily(record.familyId);
      throw new AppError('Token reuse detected', 401);
    }
    await store.revoke(record.id);        // rotation: cũ chết ngay
    const newPair = await issueTokens(record.userId, record.familyId);
    res.cookie('refreshToken', newPair.refresh, { httpOnly: true, secure: true, sameSite: 'strict', path: '/auth' });
    res.json({ accessToken: newPair.access });
  } catch (err) { next(err); }
});
```

Password: hash bằng **bcrypt/argon2** (slow hash + salt), không bao giờ MD5/SHA thuần.

### Ngày 5-6: Security (OWASP), Graceful Shutdown, Health Check, Testing

#### 1. Security — OWASP cho Node.js

- **Injection (SQL/NoSQL/Command):** luôn dùng **parameterized query** (`pool.query('SELECT * FROM users WHERE id = $1', [id])`), không nối chuỗi. NoSQL: chặn object trong input (`{ $gt: '' }` bypass login Mongo) — sanitize/validate type. Không truyền input vào `child_process.exec` (dùng `execFile` với mảng args).
- **Broken Authentication:** rate limit login, lockout, bcrypt/argon2, không lộ "user không tồn tại" vs "sai mật khẩu".
- **XSS:** escape output (template engine tự làm), với API thì nguy hiểm nhất là **stored XSS qua dữ liệu trả về cho frontend** → sanitize input HTML (`DOMPurify` server-side), set `Content-Type` đúng, CSP header.
- **Security headers với helmet:**

```js
const helmet = require('helmet');
app.use(helmet()); // set ~13 header: HSTS, X-Content-Type-Options: nosniff,
                   // X-Frame-Options/frame-ancestors (chống clickjacking), CSP, ẩn X-Powered-By...
```

- **Rate limiting:** chống brute-force/DoS.

```js
const rateLimit = require('express-rate-limit');
app.use('/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true }));
// Production multi-instance: dùng store Redis (rate-limit-redis) thay vì memory
```

- Khác: **CSRF** (SameSite cookie + CSRF token cho web session), **dependency audit** (`npm audit`, lockfile, cảnh giác supply chain), **không chạy bằng root**, secrets qua env/secret manager (không commit), giới hạn body size, validate `Content-Type`, ReDoS (regex độc với input dài — dùng `safe-regex` hoặc RE2).

#### 2. Graceful shutdown & Health check

Khi deploy/scale-down, orchestrator gửi **SIGTERM** — app phải: ngừng nhận request mới → xử lý nốt request đang dở → đóng DB/queue connection → exit 0. Nếu kill ngang: request đứt, transaction dở, mất job.

```js
const server = app.listen(3000);

async function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  server.close(async () => {            // ngừng nhận connection mới, chờ request đang chạy xong
    try {
      await db.end();                    // đóng pool DB
      await redis.quit();
      await queue.close();
      process.exit(0);
    } catch (e) { process.exit(1); }
  });
  setTimeout(() => process.exit(1), 10_000).unref(); // hard timeout 10s — không chờ vô hạn
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

Lưu ý: `server.close()` không cắt **keep-alive connection** đang idle — Node 18.2+ có `server.closeIdleConnections()`; với Kubernetes nhớ phối hợp `preStop` hook + readiness fail trước khi SIGTERM.

**Health check — phân biệt 2 loại** (Kubernetes liveness vs readiness):

- **Liveness** (`/healthz`): "process còn sống không?" — chỉ trả 200, KHÔNG check DB (DB chết mà restart app thì vô ích, còn gây restart loop).
- **Readiness** (`/readyz`): "sẵn sàng nhận traffic chưa?" — check dependency (DB ping, Redis, migration xong) → fail thì LB ngừng đẩy traffic nhưng không kill pod.

#### 3. Testing với Jest

- **Unit test**: test 1 hàm/class cô lập, mock mọi dependency — nhanh, chạy nhiều.
- **Integration test**: test nhiều tầng thật (route → service → DB test/testcontainers) — chậm hơn, tin cậy hơn.
- Tháp test: nhiều unit, vừa integration, ít E2E.

```js
// userService.test.js — unit test với mock
jest.mock('../repositories/userRepo');           // auto-mock module
const userRepo = require('../repositories/userRepo');
const { getUserProfile } = require('../services/userService');

describe('getUserProfile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('trả về profile khi user tồn tại', async () => {
    userRepo.findById.mockResolvedValue({ id: 1, name: 'Linh', password: 'hash' });
    const result = await getUserProfile(1);
    expect(result).toEqual({ id: 1, name: 'Linh' });   // không lộ password
    expect(userRepo.findById).toHaveBeenCalledWith(1);
  });

  it('throw NotFoundError khi không có user', async () => {
    userRepo.findById.mockResolvedValue(null);
    await expect(getUserProfile(99)).rejects.toThrow('User not found');
  });
});
```

```js
// Integration test API với supertest
const request = require('supertest');
const app = require('../app');

it('POST /api/users trả 201 và tạo user', async () => {
  const res = await request(app)
    .post('/api/users')
    .send({ email: 'a@b.com', password: 'Secret123!' })
    .expect(201);
  expect(res.body).toHaveProperty('id');
});
```

Khái niệm cần phân biệt khi phỏng vấn: **stub** (trả giá trị định sẵn), **mock** (stub + assert được cách gọi), **spy** (bọc hàm thật, ghi lại lời gọi — `jest.spyOn`), **fake** (cài đặt nhẹ thay thật, vd SQLite in-memory). Khác: `mockResolvedValue` vs `mockReturnValue`, fake timers (`jest.useFakeTimers()`) để test setTimeout/debounce không phải chờ thật, coverage (`--coverage`) — chỉ tiêu tham khảo, không phải mục tiêu mù quáng.

## 💬 Top 15 câu hỏi phỏng vấn thường gặp

**Q1: Khi nào dùng cluster, khi nào dùng worker_threads?**
**A:** `cluster` để scale HTTP server ra nhiều CPU core — fork nhiều process cùng share port, mỗi process độc lập memory, phù hợp I/O-bound web app. `worker_threads` để đẩy tác vụ CPU-bound (tính toán, parse/nén lớn) ra khỏi main thread trong cùng process, chia sẻ memory được qua SharedArrayBuffer. Một app production có thể dùng cả hai.

**Q2: Cluster module hoạt động thế nào, vì sao nhiều process listen cùng một port được?**
**A:** Primary process tạo listening socket và phân phối connection cho các worker theo round-robin (mặc định trên Linux/macOS), hoặc các worker share socket handle và OS tự phân phối. Worker chết thì primary nhận event `exit` và fork worker mới — pattern tự hồi phục.

**Q3: V8 quản lý memory và GC như thế nào?**
**A:** Heap chia thế hệ: new space cho object mới, GC bằng Scavenge nhanh và thường xuyên; object sống sót được promote lên old space, GC bằng Mark-Sweep-Compact (có incremental/concurrent marking để giảm pause). Heap mặc định giới hạn ~4GB, chỉnh bằng `--max-old-space-size`; Buffer nằm ngoài heap.

**Q4: Kể vài nguyên nhân memory leak phổ biến trong Node và cách phát hiện?**
**A:** Cache/global không giới hạn, closure giữ object lớn, event listener không remove, setInterval không clear, Map giữ key object (nên dùng WeakMap). Phát hiện: theo dõi RSS/heapUsed tăng đều theo thời gian, rồi chụp 3 heap snapshot (trước tải – sau tải – sau tải tiếp) qua `--inspect`, so sánh object allocated còn sống và truy Retainers.

**Q5: Express error middleware khác middleware thường thế nào? Lỗi trong async handler thì sao?**
**A:** Error middleware có 4 tham số `(err, req, res, next)` và được gọi khi có `next(err)` hoặc throw sync. Ở Express 4, lỗi trong async handler không tự được bắt — promise reject sẽ thành unhandledRejection — nên phải try/catch rồi `next(err)` hoặc dùng wrapper/express-async-errors; Express 5 đã tự forward rejected promise.

**Q6: Trình bày request lifecycle của NestJS?**
**A:** Middleware → Guards (authz, CanActivate) → Interceptors phần trước → Pipes (validate/transform DTO) → Controller handler → Service → Interceptors phần sau (transform response) → Exception Filters nếu có lỗi. Guard quyết định cho qua hay chặn, Pipe xử lý input, Interceptor bọc quanh như AOP, Filter format lỗi tập trung.

**Q7: JWT khác session-based auth thế nào, trade-off chính là gì?**
**A:** Session là stateful — server lưu state (thường Redis), revoke tức thì nhưng cần shared store khi scale. JWT là stateless — token tự chứa claims và chữ ký, scale ngang dễ, nhưng thu hồi trước hạn khó (phải blacklist hoặc TTL ngắn) và payload chỉ encode chứ không mã hóa. Thực tế hay kết hợp: access token JWT ngắn hạn + refresh token lưu server-side.

**Q8: Refresh token rotation là gì và giải quyết vấn đề gì?**
**A:** Mỗi lần dùng refresh token, server cấp cặp token mới và vô hiệu hóa ngay token cũ. Nếu phát hiện một refresh token đã dùng bị dùng lại (reuse detection) — dấu hiệu token bị đánh cắp — server revoke cả token family buộc re-login. Nó thu hẹp cửa sổ tấn công khi refresh token bị lộ.

**Q9: Vì sao không nên lưu JWT trong localStorage?**
**A:** localStorage đọc được bằng JavaScript, nên một lỗ hổng XSS bất kỳ là kẻ tấn công lấy được token. Khuyến nghị: refresh token trong httpOnly + Secure + SameSite cookie (JS không đọc được), access token ngắn hạn giữ trong memory; đổi lại phải xử lý CSRF cho cookie (SameSite/CSRF token).

**Q10: Làm sao chống SQL injection và NoSQL injection trong Node?**
**A:** Luôn dùng parameterized query/prepared statement hoặc query builder/ORM — không bao giờ nối chuỗi input vào SQL. Với MongoDB, validate kiểu dữ liệu input (chặn object như `{$gt: ''}`), dùng schema validation (zod/Joi) ở biên. Với shell command dùng `execFile` kèm mảng args thay vì `exec` nối chuỗi.

**Q11: Helmet làm gì? Kể vài header quan trọng?**
**A:** Helmet là tập middleware set các security header: HSTS (ép HTTPS), X-Content-Type-Options: nosniff (chặn MIME sniffing), frame-ancestors/X-Frame-Options (chống clickjacking), Content-Security-Policy (giới hạn nguồn script — lớp chống XSS), và ẩn X-Powered-By. Một dòng `app.use(helmet())` là baseline rẻ mà hiệu quả.

**Q12: Graceful shutdown trong Node gồm những bước nào?**
**A:** Bắt SIGTERM/SIGINT → `server.close()` ngừng nhận connection mới và chờ request đang chạy xong → đóng DB pool, Redis, queue → exit 0; kèm hard timeout (vd 10s) để không treo vô hạn. Trên Kubernetes phối hợp readiness probe fail trước để LB ngừng đẩy traffic, và chú ý đóng keep-alive idle connection.

**Q13: Liveness và readiness probe khác nhau thế nào? Health check có nên check DB không?**
**A:** Liveness trả lời "process còn sống không" — fail thì orchestrator restart pod, nên KHÔNG check dependency (DB chết mà restart app gây restart loop vô ích). Readiness trả lời "sẵn sàng nhận traffic chưa" — check DB/Redis/migration, fail thì chỉ rút khỏi load balancer. Tách 2 endpoint là best practice.

**Q14: Phân biệt mock, stub, spy trong testing?**
**A:** Stub thay hàm thật bằng kết quả định sẵn; mock là stub kèm khả năng assert cách được gọi (số lần, tham số); spy bọc quanh hàm thật để ghi lại lời gọi mà vẫn chạy logic gốc (`jest.spyOn`). Trong Jest, `jest.fn()`/`jest.mock()` đóng cả vai mock lẫn stub.

**Q15: Làm sao phát hiện và xử lý khi event loop bị block trong production?**
**A:** Theo dõi event loop delay (`perf_hooks.monitorEventLoopDelay`, hoặc metric của APM) — p99 cao là có code sync block. Truy thủ phạm bằng CPU profile (`--inspect` flame chart, `clinic flame`): thường là JSON.parse/stringify payload lớn, regex độc, vòng lặp lớn, crypto sync. Xử lý: chuyển sang bản async, chia nhỏ bằng setImmediate, hoặc đẩy sang worker_threads/queue.

## 💪 Bài tập thực hành (bắt buộc)

### Bài 1: Cluster hóa HTTP server + đo throughput (Dễ)

**Đề bài:** Viết một Express server có endpoint `GET /hash?text=...` dùng `crypto.pbkdf2Sync` (cố ý sync, 100k iterations). Chạy bản single-process và bản cluster (full core). Benchmark cả hai bằng `autocannon -c 50 -d 10`.

**Yêu cầu output:** Bảng so sánh req/s và latency p99 của 2 bản; giải thích 3-5 câu vì sao chênh lệch, và vì sao pbkdf2Sync đặc biệt tệ với single process.
**Gợi ý:** `npx autocannon`. Log `process.pid` trong handler để thấy request được phân phối cho các worker.

### Bài 2: Tự tạo memory leak rồi tự bắt (Trung bình)

**Đề bài:** Viết server có endpoint `/leak` mỗi lần gọi push một object lớn (~1MB string) vào một mảng module-level kèm một listener `process.on('warning')` không bao giờ remove. Bắn 500 request. Dùng `node --inspect` + Chrome DevTools chụp 3 heap snapshot theo kỹ thuật 3-snapshot, xác định đúng retainer. Sau đó sửa leak (LRU max 50 phần tử, remove listener) và chứng minh heap ổn định.

**Yêu cầu output:** 2 ảnh chụp màn hình snapshot comparison (trước/sau fix) hoặc số liệu `heapUsed` log mỗi giây; đoạn văn chỉ rõ chain retainer dẫn tới leak.
**Gợi ý:** Trong Memory tab chọn "Comparison" giữa snapshot 2 và 1, sort theo "Size Delta"; chú ý `(string)` và `Array` tăng bất thường.

### Bài 3: JWT auth đầy đủ với refresh token rotation (Trung bình–Khó)

**Đề bài:** Xây Express API: `POST /auth/register` (bcrypt), `POST /auth/login` (trả access token 10 phút + refresh token 7 ngày trong httpOnly cookie), `POST /auth/refresh` (rotation + reuse detection → revoke family), `POST /auth/logout`, `GET /me` (route bảo vệ bằng middleware verify Bearer token). Lưu refresh token đã hash trong SQLite/Postgres kèm `familyId`, `revoked`.

**Yêu cầu output:** File `demo.http` hoặc script curl chứng minh: (1) refresh bình thường hoạt động, (2) dùng lại refresh token cũ → 401 và toàn bộ family bị revoke, (3) access token hết hạn → 401 với code `TOKEN_EXPIRED` riêng biệt.
**Gợi ý:** Dùng `jsonwebtoken`; phân biệt lỗi `TokenExpiredError` vs `JsonWebTokenError` để trả error code khác nhau cho client biết khi nào cần refresh.

### Bài 4: Security hardening + viết test chứng minh (Khó)

**Đề bài:** Lấy API ở bài 3, bổ sung: helmet, rate limit 5 req/15 phút cho `/auth/login` (store memory là đủ), validate input bằng zod (email format, password ≥ 8 ký tự có số), chặn NoSQL-style injection (body chứa object lồng nhau ở field string → 400), giới hạn body 100kb. Viết **Jest + supertest integration tests** cho từng cơ chế.

**Yêu cầu output:** Test suite ≥ 10 test pass, gồm: request thứ 6 vào login trả 429; payload `{"email": {"$gt": ""}}` trả 400; response có header `x-content-type-options: nosniff` và không có `x-powered-by`; body 200kb trả 413.
**Gợi ý:** `request(app)` của supertest không cần listen port thật; dùng `expect(res.headers).not.toHaveProperty('x-powered-by')`.

### Bài 5: Graceful shutdown + worker_threads + zero-downtime (Khó)

**Đề bài:** Server có endpoint `GET /report` đẩy việc tính toán nặng (vd fibonacci 42 hoặc tổng hợp 1 triệu record giả) sang worker_threads pool (tự viết pool 4 worker, có hàng đợi). Cài graceful shutdown đầy đủ: SIGTERM → ngừng nhận request mới, chờ request + worker job đang chạy xong (timeout 15s), đóng pool, exit. Viết script test: bắn 20 request `/report` rồi gửi SIGTERM ở giây thứ 2.

**Yêu cầu output:** Log chứng minh: các request đã nhận đều trả về 200 đầy đủ trước khi process exit 0; request đến SAU SIGTERM bị từ chối (503 hoặc connection refused); không có worker bị kill ngang.
**Gợi ý:** Đếm số request in-flight bằng counter middleware; `server.close(cb)` + đợi `Promise.all` các job trong pool; gửi signal bằng `kill -TERM <pid>`.

## 📝 Bài test cuối tuần

### Phần 1: Quiz 15 câu trắc nghiệm

**Câu 1.** Tác vụ resize ảnh CPU-bound trong web server Node nên xử lý bằng:
A. `process.nextTick` chia nhỏ  B. `worker_threads` (hoặc queue + worker riêng)  C. Tăng `UV_THREADPOOL_SIZE`  D. `cluster.fork()` thêm trong lúc chạy

**Câu 2.** Trong cluster module, các worker:
A. Chia sẻ chung memory heap  B. Là các process độc lập, giao tiếp qua IPC  C. Là thread của cùng process  D. Chia sẻ event loop

**Câu 3.** Object sống sót qua các lần Scavenge GC sẽ:
A. Bị xóa  B. Được promote lên old space  C. Chuyển ra ngoài heap  D. Được nén lại

**Câu 4.** Dấu hiệu điển hình của memory leak trong production:
A. CPU 100% liên tục  B. heapUsed tăng đều theo thời gian và không giảm sau GC  C. Event loop delay cao  D. Số file descriptor giảm

**Câu 5.** Error middleware trong Express được nhận diện bằng:
A. Tên hàm là `errorHandler`  B. Đăng ký bằng `app.error()`  C. Có đúng 4 tham số `(err, req, res, next)`  D. Đặt trước tất cả route

**Câu 6.** Trong NestJS, thành phần quyết định request có được phép đi tiếp hay không (authorization) là:
A. Pipe  B. Interceptor  C. Guard  D. Exception Filter

**Câu 7.** Phát biểu ĐÚNG về JWT:
A. Payload được mã hóa nên an toàn chứa password  B. Payload chỉ được base64url encode, ai cũng decode được  C. Server phải lưu mọi JWT đã cấp  D. JWT không thể hết hạn

**Câu 8.** Lợi ích chính của refresh token rotation:
A. Giảm số lần gọi DB  B. Access token sống lâu hơn  C. Phát hiện token bị đánh cắp qua reuse detection và thu hồi cả family  D. Không cần HTTPS nữa

**Câu 9.** Cách đúng để chống SQL injection trong Node + Postgres:
A. Escape dấu nháy đơn thủ công  B. Parameterized query `$1, $2`  C. Lọc từ khóa SELECT/DROP trong input  D. Mã hóa input bằng base64

**Câu 10.** Liveness probe NÊN:
A. Check kết nối DB và Redis  B. Chỉ xác nhận process còn phản hồi, không check dependency  C. Chạy migration  D. Trả 503 khi DB chậm

**Câu 11.** `server.close()` trong graceful shutdown làm gì?
A. Cắt ngay mọi connection  B. Ngừng nhận connection mới, chờ connection hiện tại xong  C. Kill process  D. Đóng DB pool

**Câu 12.** PUT khác PATCH ở chỗ:
A. PUT tạo mới, PATCH cập nhật  B. PUT thay thế toàn bộ resource và idempotent, PATCH sửa một phần  C. PATCH idempotent hơn PUT  D. Không khác gì nhau

**Câu 13.** `jest.spyOn(obj, 'method')` khác `jest.fn()` ở chỗ:
A. spyOn không assert được số lần gọi  B. spyOn bọc method thật trên object, mặc định vẫn chạy implementation gốc  C. jest.fn() chỉ dùng cho async  D. spyOn không restore được

**Câu 14.** Status code phù hợp khi client gửi quá nhiều request:
A. 403  B. 422  C. 429  D. 503

**Câu 15.** Rate limit với store in-memory gặp vấn đề gì khi chạy cluster/nhiều instance?
A. Tốc độ chậm  B. Mỗi process đếm riêng → limit thực tế bị nhân lên theo số instance  C. Memory leak  D. Không hoạt động với Express

<details><summary>Đáp án</summary>

1. **B** — CPU-bound phải rời main thread; nextTick/threadpool không chạy JS user code, fork lúc runtime không giải quyết bản chất.
2. **B** — Cluster fork process độc lập (trên child_process), giao tiếp IPC, không share heap.
3. **B** — Generational GC: sống sót qua scavenge (2 lần) thì promote lên old space.
4. **B** — Leak = heap tăng đơn điệu không hồi sau GC; CPU/loop delay là vấn đề khác.
5. **C** — Express phân biệt error middleware bằng arity 4 tham số, đặt cuối chain.
6. **C** — Guard implement `CanActivate`, chạy sau middleware và trước interceptor/pipe.
7. **B** — JWT chỉ ký (integrity), không mã hóa (confidentiality) — không chứa dữ liệu nhạy cảm.
8. **C** — Rotation + reuse detection cho phép phát hiện refresh token bị trộm và revoke cả family.
9. **B** — Parameterized query tách data khỏi SQL ở tầng protocol; escape/lọc thủ công dễ bị bypass.
10. **B** — Liveness check dependency sẽ gây restart loop khi DB sự cố; việc đó thuộc readiness.
11. **B** — close ngừng accept mới và đợi connection hiện có; DB pool phải tự đóng riêng.
12. **B** — PUT replace toàn bộ và idempotent; PATCH partial update (không bắt buộc idempotent).
13. **B** — spyOn theo dõi method thật (restore được), mặc định gọi xuyên implementation gốc.
14. **C** — 429 Too Many Requests, thường kèm header Retry-After.
15. **B** — Counter nằm riêng từng process; cần store chia sẻ (Redis) để limit chính xác.

</details>

### Phần 2: Bài thực hành chấm điểm

**Đề bài: Xây dựng "Task Management API" chuẩn production.**

Express (hoặc NestJS) + PostgreSQL/SQLite, gồm:

1. **Auth**: register/login/refresh (rotation + reuse detection)/logout; password bcrypt; access token 10 phút, refresh token httpOnly cookie.
2. **CRUD `/api/v1/tasks`**: user chỉ thấy task của mình; validate input bằng zod/Joi; pagination `?limit&cursor`; status code và error format nhất quán `{ error: { code, message } }`.
3. **Endpoint nặng** `POST /api/v1/tasks/export` — sinh báo cáo CSV từ 100k dòng giả lập, chạy trên worker_threads, không block event loop (chứng minh: gọi `/healthz` song song vẫn trả < 50ms).
4. **Vận hành**: helmet, rate limit cho `/auth/*`, request logging có request-id, `/healthz` (liveness) + `/readyz` (readiness check DB), graceful shutdown SIGTERM.
5. **Testing**: Jest — unit test cho service layer (mock repository, ≥ 80% coverage cho services), integration test bằng supertest cho auth flow và CRUD (≥ 12 test).

**Checklist tiêu chí chấm điểm:**

- [ ] Auth flow đầy đủ; reuse refresh token cũ bị phát hiện và revoke cả family (có test chứng minh).
- [ ] Mọi query DB dùng parameterized query/ORM — không có string concatenation chứa input.
- [ ] Error handling tập trung 1 middleware/filter; lỗi async không bao giờ thành unhandledRejection; lỗi 500 không lộ stack trace ra client.
- [ ] `/export` không làm tăng event loop delay quá 50ms (đo bằng `monitorEventLoopDelay` hoặc gọi `/healthz` song song).
- [ ] Gửi SIGTERM giữa lúc đang có request → request hoàn thành, pool đóng, exit code 0, có log từng bước.
- [ ] Liveness không phụ thuộc DB; readiness trả 503 khi tắt DB.
- [ ] Test suite pass toàn bộ; có cả unit (mock) lẫn integration; coverage service ≥ 80%.
- [ ] Có rate limit hoạt động (test 429) và header bảo mật của helmet xuất hiện trong response.

## ✅ Tiêu chí pass tuần

- Quiz ≥ 12/15
- Hoàn thành tất cả bài tập bắt buộc (5/5)
- Bài thực hành đạt đủ checklist (8/8 mục)
- Trình bày được trong 5 phút: sơ đồ luồng refresh token rotation và quy trình debug memory leak bằng 3-snapshot, không nhìn tài liệu
