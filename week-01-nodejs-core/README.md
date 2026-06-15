# Tuần 1: Node.js Core

## 🎯 Mục tiêu tuần này

- Hiểu sâu **event loop** của Node.js: các phase, thứ tự thực thi, vì sao Node.js "single-threaded" nhưng vẫn xử lý được hàng nghìn connection.
- Phân biệt rõ **microtask vs macrotask**, `process.nextTick` vs `setImmediate`, và dự đoán chính xác output của các đoạn code async phức tạp.
- Thành thạo **callback → Promise → async/await**, biết cách handle error đúng chuẩn (kể cả `unhandledRejection`, `uncaughtException`).
- Nắm vững **Buffer, Streams (4 loại), backpressure, EventEmitter** — các khái niệm "ăn điểm" trong phỏng vấn senior.
- Hiểu **libuv & thread pool**: cái gì chạy trên thread pool, cái gì chạy trên kernel async I/O, và cách tune `UV_THREADPOOL_SIZE`.

## 📚 Lý thuyết

### Ngày 1-2: Event Loop, Microtask/Macrotask, Async Patterns

#### 1. Kiến trúc Node.js & Event Loop

Node.js = **V8** (thực thi JavaScript) + **libuv** (event loop + async I/O) + các binding C++. JavaScript chạy trên **một thread duy nhất** (main thread), nhưng I/O được delegate cho kernel (epoll/kqueue/IOCP) hoặc thread pool của libuv → Node.js xử lý concurrent I/O mà không cần tạo thread cho mỗi request.

Event loop của libuv chạy lặp qua **6 phase** theo thứ tự:

```
   ┌───────────────────────────┐
┌─>│        timers             │  ← callback của setTimeout, setInterval
│  ├───────────────────────────┤
│  │   pending callbacks       │  ← một số callback I/O bị hoãn từ vòng trước (vd: lỗi TCP)
│  ├───────────────────────────┤
│  │     idle, prepare         │  ← nội bộ libuv
│  ├───────────────────────────┤
│  │         poll              │  ← lấy I/O event mới; thực thi callback I/O (đọc file, socket...)
│  │                           │     Node có thể BLOCK ở đây chờ I/O nếu không có timer/setImmediate
│  ├───────────────────────────┤
│  │        check              │  ← callback của setImmediate
│  ├───────────────────────────┤
└──┤    close callbacks        │  ← vd: socket.on('close', ...)
   └───────────────────────────┘
```

Điểm quan trọng nhất (hay bị hỏi): **giữa MỖI lần chuyển callback, Node.js xả (drain) toàn bộ microtask queue** — gồm `process.nextTick` queue (ưu tiên cao nhất) rồi đến Promise microtask queue.

#### 2. Microtask vs Macrotask

| Loại | Ví dụ | Khi nào chạy |
|---|---|---|
| **Macrotask** (task) | `setTimeout`, `setInterval`, `setImmediate`, I/O callback | Theo phase của event loop |
| **Microtask** | `Promise.then/catch/finally`, `queueMicrotask` | Sau mỗi macrotask/callback, trước khi sang phase tiếp theo |
| **nextTick queue** | `process.nextTick` | TRƯỚC cả Promise microtask, ngay sau operation hiện tại |

Ví dụ kinh điển — hãy dự đoán output trước khi chạy:

```js
console.log('1: sync');

setTimeout(() => console.log('2: setTimeout'), 0);
setImmediate(() => console.log('3: setImmediate'));

Promise.resolve().then(() => console.log('4: promise'));
process.nextTick(() => console.log('5: nextTick'));

console.log('6: sync end');

// Output:
// 1: sync
// 6: sync end
// 5: nextTick      ← nextTick queue xả trước
// 4: promise       ← rồi đến Promise microtask
// 2: setTimeout    ← timers phase
// 3: setImmediate  ← check phase
```

⚠️ Lưu ý: `setTimeout(fn, 0)` vs `setImmediate(fn)` ở **top-level** thì thứ tự **không xác định** (phụ thuộc thời điểm event loop khởi động). Nhưng **bên trong một I/O callback** thì `setImmediate` LUÔN chạy trước `setTimeout`, vì sau poll phase là check phase:

```js
const fs = require('fs');
fs.readFile(__filename, () => {
  setTimeout(() => console.log('timeout'), 0);
  setImmediate(() => console.log('immediate'));
});
// Luôn luôn: immediate → timeout
```

#### 3. `process.nextTick` vs `setImmediate`

- `process.nextTick(fn)`: chạy **ngay sau operation hiện tại**, trước khi event loop tiếp tục. Lạm dụng (gọi đệ quy) sẽ **starve event loop** — I/O không bao giờ được xử lý.
- `setImmediate(fn)`: chạy ở **check phase** của vòng lặp hiện tại/kế tiếp — an toàn hơn cho việc "defer" công việc.

Tên gọi bị "ngược" vì lý do lịch sử: `nextTick` chạy ngay lập tức hơn, `setImmediate` lại chạy ở tick sau. Use case thực tế của `nextTick`: đảm bảo callback luôn được gọi **bất đồng bộ một cách nhất quán** (tránh "Zalgo" — API lúc sync lúc async):

```js
function readConfig(cb) {
  if (cache) {
    // SAI: cb(null, cache) → gọi đồng bộ, gây hành vi không nhất quán
    return process.nextTick(() => cb(null, cache)); // ĐÚNG
  }
  fs.readFile('config.json', cb);
}
```

#### 4. Callback → Promise → async/await

**Callback (error-first convention):** tham số đầu là error.

```js
fs.readFile('a.txt', 'utf8', (err, data) => {
  if (err) return handleError(err);
  console.log(data);
});
```

Vấn đề: callback hell, khó compose, dễ quên handle error.

**Promise:** object đại diện giá trị tương lai, có 3 trạng thái `pending → fulfilled | rejected` (settle xong là bất biến).

```js
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
// hoặc: const fs = require('fs/promises');

readFile('a.txt', 'utf8')
  .then(data => JSON.parse(data))
  .catch(err => console.error('Lỗi đọc HOẶC parse:', err)) // catch bắt cả chain phía trên
  .finally(() => console.log('done'));
```

Các static method cần nắm:

- `Promise.all([...])` — fail-fast: 1 cái reject là reject toàn bộ.
- `Promise.allSettled([...])` — chờ tất cả settle, trả về `{status, value/reason}` từng cái.
- `Promise.race([...])` — settle theo cái ĐẦU TIÊN settle (dùng làm timeout).
- `Promise.any([...])` — fulfilled theo cái đầu tiên fulfilled, reject nếu TẤT CẢ reject.

**async/await:** syntactic sugar trên Promise, chạy tuần tự dễ đọc, dùng `try/catch` quen thuộc.

```js
// Chạy SONG SONG đúng cách (lỗi phổ biến: await tuần tự không cần thiết)
// SAI (chậm, tuần tự ~2s):
const user = await getUser(id);      // 1s
const orders = await getOrders(id);  // 1s, không phụ thuộc user

// ĐÚNG (~1s):
const [user2, orders2] = await Promise.all([getUser(id), getOrders(id)]);
```

### Ngày 3-4: Error Handling, CommonJS vs ESM, Buffer

#### 1. Error handling trong Node.js

4 nguồn lỗi: (1) lỗi sync (throw), (2) lỗi async qua callback, (3) Promise rejection, (4) lỗi emit từ EventEmitter (`'error'` event).

**`try/catch` với async/await:**

```js
async function handler(req, res, next) {
  try {
    const user = await db.findUser(req.params.id);
    if (!user) throw new NotFoundError('User not found');
    res.json(user);
  } catch (err) {
    next(err); // đẩy về error middleware của Express
  }
}
```

**Operational error vs Programmer error** (câu hỏi rất hay gặp):

- *Operational error*: lỗi runtime hợp lệ — mất kết nối DB, input sai, timeout → **handle và recover được**.
- *Programmer error*: bug — đọc property của `undefined`, gọi sai API → state của process không còn tin được → **log, alert, và restart process** (kết hợp PM2/Kubernetes).

**`unhandledRejection` & `uncaughtException`:**

```js
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', reason);
  throw reason; // chuyển thành uncaughtException để xử lý 1 chỗ
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  // Dọn dẹp nhanh (close server, flush log) rồi exit — KHÔNG tiếp tục chạy
  process.exit(1);
});
```

Từ Node 15+, `unhandledRejection` mặc định **crash process** (trước đó chỉ warning). Best practice: không nuốt lỗi để "process sống bằng mọi giá" — crash nhanh, restart sạch (fail-fast).

**Custom error class:**

```js
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}
```

#### 2. CommonJS (CJS) vs ES Modules (ESM)

| Tiêu chí | CommonJS | ESM |
|---|---|---|
| Cú pháp | `require()` / `module.exports` | `import` / `export` |
| Load | **Đồng bộ**, runtime | **Bất đồng bộ**, parse-time (static) |
| Phân tích tĩnh | Không (require có thể nằm trong if) | Có → tree-shaking, kiểm tra import lúc parse |
| Giá trị export | **Copy** (snapshot lúc require) | **Live binding** (tham chiếu sống) |
| `this` top-level | `module.exports` | `undefined` |
| Có sẵn | `__dirname`, `__filename`, `require` | `import.meta.url` (Node 20.11+: `import.meta.dirname`) |
| Kích hoạt | Mặc định, hoặc file `.cjs` | `"type": "module"` trong package.json, hoặc `.mjs` |
| Top-level await | Không | Có |

```js
// CJS
const { sum } = require('./math');
module.exports = { sum };

// ESM
import { sum } from './math.js'; // ESM bắt buộc ghi đuôi file
export const sum = (a, b) => a + b;
```

Interop: ESM `import` được CJS module (default export = `module.exports`); CJS muốn load ESM phải dùng **dynamic `import()`** (vì ESM là async) — từ Node 22 có thể `require()` ESM đồng bộ nếu module không dùng top-level await.

#### 3. Buffer

`Buffer` là vùng nhớ thô (raw binary) cấp phát **ngoài V8 heap**, dùng xử lý dữ liệu nhị phân: file, TCP packet, ảnh, mã hóa.

```js
const buf1 = Buffer.from('Xin chào', 'utf8'); // từ string
const buf2 = Buffer.alloc(10);                // 10 byte, zero-filled (an toàn)
const buf3 = Buffer.allocUnsafe(10);          // nhanh hơn nhưng chứa dữ liệu cũ — phải ghi đè!

console.log(buf1.toString('hex'));    // 58696e20636861cc8020...
console.log(buf1.toString('base64'));
console.log(buf1.length);             // số BYTE, không phải số ký tự (UTF-8 multi-byte!)

// Đọc số từ binary protocol
const buf = Buffer.from([0x00, 0x00, 0x01, 0xf4]);
console.log(buf.readUInt32BE(0)); // 500
```

Câu hỏi bẫy: `'à'.length === 1` nhưng `Buffer.from('à').length === 2` (UTF-8). Khi xử lý stream chunk, một ký tự multi-byte có thể bị **cắt đôi giữa 2 chunk** → dùng `string_decoder` hoặc set encoding trên stream thay vì tự `toString()` từng chunk.

### Ngày 5-6: Streams, EventEmitter, libuv & Thread Pool

#### 1. Streams — 4 loại

Stream xử lý dữ liệu **theo từng chunk** thay vì load hết vào RAM → đọc file 10GB với vài chục MB memory.

| Loại | Vai trò | Ví dụ |
|---|---|---|
| **Readable** | Nguồn đọc | `fs.createReadStream`, `req` (HTTP request), `process.stdin` |
| **Writable** | Đích ghi | `fs.createWriteStream`, `res` (HTTP response), `process.stdout` |
| **Duplex** | Vừa đọc vừa ghi (2 kênh độc lập) | TCP socket (`net.Socket`) |
| **Transform** | Duplex mà output biến đổi từ input | `zlib.createGzip()`, `crypto.createCipheriv()` |

```js
// Nén file lớn — memory ổn định dù file hàng GB
const fs = require('fs');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');

await pipeline(
  fs.createReadStream('huge.log'),
  zlib.createGzip(),
  fs.createWriteStream('huge.log.gz')
);
```

**Custom Transform stream:**

```js
const { Transform } = require('stream');

const upperCase = new Transform({
  transform(chunk, encoding, callback) {
    callback(null, chunk.toString().toUpperCase());
  }
});
process.stdin.pipe(upperCase).pipe(process.stdout);
```

#### 2. Backpressure

Khi producer (Readable) nhanh hơn consumer (Writable) — vd đọc disk nhanh, ghi qua network chậm — data dồn vào buffer nội bộ → memory phình to. Cơ chế backpressure:

- `writable.write(chunk)` trả về **`false`** khi internal buffer vượt `highWaterMark` (mặc định 64KB với byte stream) → producer phải **dừng** (`readable.pause()`).
- Khi buffer xả xong, Writable emit **`'drain'`** → producer tiếp tục (`readable.resume()`).

```js
// Xử lý backpressure thủ công (hiểu để trả lời phỏng vấn):
readable.on('data', (chunk) => {
  if (!writable.write(chunk)) {
    readable.pause();                          // dừng đọc
    writable.once('drain', () => readable.resume()); // đọc tiếp khi xả xong
  }
});
```

Trong thực tế: **dùng `pipe()` hoặc tốt hơn là `pipeline()`** — chúng tự xử lý backpressure. `pipeline()` ưu việt hơn `pipe()` vì: tự **propagate error** và **destroy tất cả stream** khi 1 stream lỗi (pipe không tự destroy → leak file descriptor).

#### 3. EventEmitter

Nền tảng pattern Observer của Node — hầu hết core module (stream, server, socket) kế thừa từ nó.

```js
const EventEmitter = require('events');

class OrderService extends EventEmitter {
  createOrder(data) {
    const order = { id: Date.now(), ...data };
    this.emit('order:created', order); // listener chạy ĐỒNG BỘ theo thứ tự đăng ký
    return order;
  }
}

const svc = new OrderService();
svc.on('order:created', (o) => sendEmail(o));
svc.once('order:created', (o) => console.log('first order!', o.id)); // chỉ chạy 1 lần
svc.createOrder({ item: 'laptop' });
```

Điểm cần nhớ khi phỏng vấn:

- `emit()` gọi listener **đồng bộ** (theo thứ tự đăng ký) — không phải async như nhiều người tưởng.
- Event **`'error'`** đặc biệt: emit `'error'` mà không có listener → **throw và crash process**. Luôn đăng ký `.on('error')` cho stream/socket.
- Memory leak phổ biến: đăng ký listener trong vòng lặp/request handler mà không `removeListener` → warning `MaxListenersExceededWarning` (mặc định 10 listener).

#### 4. libuv & Thread Pool

libuv cung cấp event loop và 2 cơ chế async:

1. **Kernel async I/O** (epoll/kqueue/IOCP): **network I/O** (TCP/UDP/HTTP) — KHÔNG dùng thread pool, kernel notify khi socket sẵn sàng → đây là lý do Node chịu tải hàng chục nghìn connection.
2. **Thread pool** (mặc định **4 thread**): những việc không có API async ở kernel:
   - **File system** (`fs.*` async)
   - **DNS lookup** (`dns.lookup` — chú ý: `dns.resolve` thì dùng network, không dùng pool)
   - **Crypto nặng**: `crypto.pbkdf2`, `scrypt`, `bcrypt` (lib), `randomBytes` async
   - **zlib** (nén/giải nén async)

```bash
# Tăng thread pool khi app làm nhiều fs/crypto (max 1024):
UV_THREADPOOL_SIZE=16 node app.js
```

Hệ quả thực chiến: 4 request `pbkdf2` đồng thời chiếm hết 4 thread → request `fs.readFile` thứ 5 phải **xếp hàng** dù "async". CPU-bound thuần JS (vd vòng for tính toán) thì **block luôn main thread** — không thread pool nào cứu được → cần `worker_threads` (học ở Tuần 2).

```js
// Đo event loop bị block:
const start = Date.now();
setTimeout(() => console.log(`Loop delay: ${Date.now() - start - 100}ms`), 100);
// Nếu delay lớn → có code sync đang block
```

## 💬 Top 15 câu hỏi phỏng vấn thường gặp

**Q1: Node.js là single-threaded hay multi-threaded?**
**A:** JavaScript code chạy trên một main thread duy nhất, nhưng Node.js bản thân là multi-threaded: libuv có thread pool (mặc định 4 thread) cho fs/crypto/dns.lookup/zlib, và V8 có thread riêng cho GC. Network I/O thì dùng kernel async (epoll/kqueue) nên không cần thread.

**Q2: Mô tả các phase của event loop?**
**A:** Gồm 6 phase lặp theo thứ tự: timers (setTimeout/setInterval) → pending callbacks → idle/prepare → poll (nhận và xử lý I/O, có thể block chờ) → check (setImmediate) → close callbacks. Giữa mỗi callback, Node xả toàn bộ nextTick queue rồi đến Promise microtask queue.

**Q3: `process.nextTick` khác `setImmediate` thế nào?**
**A:** `nextTick` chạy ngay sau operation hiện tại, trước mọi phase tiếp theo và trước cả Promise microtask; `setImmediate` chạy ở check phase sau poll. Gọi `nextTick` đệ quy sẽ starve event loop (I/O không chạy được), còn `setImmediate` đệ quy vẫn cho I/O xen vào giữa các vòng lặp.

**Q4: `setTimeout(fn, 0)` và `setImmediate(fn)` cái nào chạy trước?**
**A:** Ở top-level thì thứ tự không xác định, phụ thuộc thời gian khởi động event loop (timer 0 thực chất là 1ms). Bên trong I/O callback thì `setImmediate` luôn chạy trước vì sau poll phase là check phase, còn timers phải đợi vòng lặp sau.

**Q5: Microtask và macrotask khác nhau thế nào?**
**A:** Macrotask (setTimeout, setImmediate, I/O callback) được xử lý theo phase của event loop, mỗi vòng lấy một lượng task. Microtask (Promise callback, queueMicrotask) được xả TOÀN BỘ ngay sau mỗi macrotask, trước khi event loop đi tiếp — nên microtask luôn "chen ngang" trước macrotask kế tiếp.

**Q6: `Promise.all` khác `Promise.allSettled` thế nào? Khi nào dùng cái nào?**
**A:** `Promise.all` fail-fast — một promise reject là toàn bộ reject ngay (nhưng các promise khác vẫn tiếp tục chạy ngầm). `allSettled` luôn chờ tất cả settle và trả về mảng `{status, value/reason}`. Dùng `all` khi các kết quả phụ thuộc nhau (thiếu 1 là vô nghĩa), dùng `allSettled` khi muốn xử lý từng kết quả độc lập, vd gửi notification cho nhiều user.

**Q7: Nên làm gì trong handler `uncaughtException`?**
**A:** Log lỗi, gửi alert, đóng các kết nối đang mở (graceful nhanh) rồi `process.exit(1)` — không nên tiếp tục chạy vì state của process đã không còn đáng tin (có thể leak memory, treo handle). Để process manager (PM2, Kubernetes) restart lại process sạch.

**Q8: CommonJS và ESM khác nhau ở những điểm nào?**
**A:** CJS load đồng bộ lúc runtime, export là bản copy giá trị; ESM static, phân tích lúc parse-time, export là live binding, hỗ trợ tree-shaking và top-level await. CJS có `__dirname`/`require`, ESM dùng `import.meta.url` và bắt buộc ghi rõ đuôi file khi import tương đối.

**Q9: Buffer là gì, vì sao cần khi đã có string?**
**A:** Buffer là vùng nhớ nhị phân thô cấp phát ngoài V8 heap, dùng cho dữ liệu binary (file, TCP packet, ảnh) mà string UTF-16 không biểu diễn an toàn được. `Buffer.alloc` zero-fill an toàn, `allocUnsafe` nhanh hơn nhưng chứa dữ liệu cũ của memory nên phải ghi đè toàn bộ trước khi dùng.

**Q10: Kể 4 loại stream và cho ví dụ thực tế?**
**A:** Readable (`fs.createReadStream`, HTTP request), Writable (`fs.createWriteStream`, HTTP response), Duplex — đọc và ghi độc lập (TCP socket), Transform — Duplex mà output là biến đổi của input (`zlib.createGzip`, mã hóa). Stream giúp xử lý dữ liệu lớn theo chunk với memory cố định.

**Q11: Backpressure là gì và Node xử lý ra sao?**
**A:** Là tình trạng producer ghi nhanh hơn consumer xử lý, làm buffer nội bộ phình to gây tốn memory. Cơ chế: `writable.write()` trả về `false` khi buffer vượt `highWaterMark` → producer pause, đợi event `'drain'` rồi resume. Thực tế dùng `pipeline()` để tự động xử lý backpressure lẫn error propagation.

**Q12: `pipe()` và `pipeline()` khác gì nhau?**
**A:** Cả hai đều nối stream và xử lý backpressure, nhưng `pipe()` không propagate error — stream giữa chain lỗi thì các stream khác không bị destroy, gây leak file descriptor/memory. `pipeline()` (stream/promises) tự destroy toàn bộ chain khi có lỗi và trả về Promise, là lựa chọn chuẩn production.

**Q13: Điều gì xảy ra khi EventEmitter emit `'error'` mà không có listener?**
**A:** Node throw error đó và crash process — đây là hành vi đặc biệt riêng của event `'error'`. Vì vậy luôn phải đăng ký `.on('error')` cho stream, socket, và mọi emitter có thể lỗi; đây là nguồn crash production rất phổ biến.

**Q14: Những operation nào dùng libuv thread pool? Network I/O có dùng không?**
**A:** Thread pool (mặc định 4 thread) phục vụ fs async, `dns.lookup`, crypto nặng (pbkdf2/scrypt), zlib. Network I/O KHÔNG dùng thread pool mà dùng kernel async (epoll/kqueue/IOCP). Hệ quả: nhiều request crypto đồng thời có thể nghẽn thread pool làm chậm cả fs — tune bằng `UV_THREADPOOL_SIZE`.

**Q15: Code CPU-bound (vd tính toán vòng lặp lớn) ảnh hưởng Node thế nào? Giải pháp?**
**A:** Nó block main thread → event loop đứng im, mọi request khác bị treo (kể cả health check). Giải pháp: chia nhỏ công việc bằng `setImmediate` để nhường loop, đẩy sang `worker_threads`, hoặc tách thành service riêng/queue. Thread pool không giúp được vì JS code chỉ chạy trên main thread.

## 💪 Bài tập thực hành (bắt buộc)

### Bài 1: Dự đoán output event loop (Dễ)

**Đề bài:** Viết file `predict.js` chứa đoạn code dưới, **viết dự đoán output ra comment trước**, rồi chạy kiểm chứng và giải thích từng dòng vì sao:

```js
const fs = require('fs');
console.log('A');
setTimeout(() => console.log('B'), 0);
setImmediate(() => console.log('C'));
fs.readFile(__filename, () => {
  console.log('D');
  setTimeout(() => console.log('E'), 0);
  setImmediate(() => console.log('F'));
  process.nextTick(() => console.log('G'));
});
Promise.resolve().then(() => { console.log('H'); process.nextTick(() => console.log('I')); });
process.nextTick(() => console.log('J'));
console.log('K');
```

**Yêu cầu output:** File markdown ngắn giải thích thứ tự, chỉ rõ dòng nào thuộc phase/queue nào.
**Gợi ý:** Vẽ ra 3 hàng đợi: nextTick queue, microtask queue, và các phase timers/poll/check. Chú ý `I` chạy sau `H` nhưng trước macrotask.

### Bài 2: Promisify thủ công + retry với exponential backoff (Trung bình)

**Đề bài:** Không dùng `util.promisify`. Viết:
1. Hàm `promisify(fn)` chuyển một hàm callback error-first thành hàm trả Promise.
2. Hàm `retry(asyncFn, { retries: 3, baseDelay: 100 })` — gọi lại khi reject, delay tăng theo lũy thừa 2 (100ms, 200ms, 400ms), ném lỗi cuối cùng nếu hết lượt.
3. Test với một hàm giả lập fail ngẫu nhiên 70%.

**Yêu cầu output:** Console log mỗi lần retry kèm số attempt và delay; cuối cùng in kết quả hoặc lỗi cuối.
**Gợi ý:** `promisify` trả về `(...args) => new Promise((res, rej) => fn(...args, (err, data) => ...))`. Delay bằng `await new Promise(r => setTimeout(r, ms))`.

### Bài 3: CLI xử lý file log lớn bằng Stream (Trung bình–Khó)

**Đề bài:** Sinh file `access.log` ~200MB (tự viết script generate dòng dạng `GET /api/users 200 123ms`). Viết `analyze.js` dùng **stream + Transform** đếm: số request theo status code, top 5 path chậm nhất (avg). KHÔNG được dùng `fs.readFile`.

**Yêu cầu output:** In bảng thống kê; `process.memoryUsage().rss` trước và sau phải chênh < 100MB để chứng minh không load hết file vào RAM.
**Gợi ý:** Dùng `readline.createInterface({ input: fs.createReadStream(...) })` hoặc tự viết Transform tách dòng (cẩn thận dòng bị cắt giữa 2 chunk — giữ phần dư lại bằng biến `remainder`).

### Bài 4: Demo backpressure thật (Khó)

**Đề bài:** Viết HTTP server stream một file 1GB (generate bằng `fs.createWriteStream` + loop). Phiên bản 1: đọc bằng `'data'` event và `res.write()` **không** kiểm tra giá trị trả về. Phiên bản 2: dùng `pipeline(readStream, res)`. Dùng `curl --limit-rate 100k` làm client chậm, theo dõi `process.memoryUsage().rss` mỗi giây.

**Yêu cầu output:** Bảng so sánh RSS của 2 phiên bản theo thời gian (phiên bản 1 phải phình memory rõ rệt, phiên bản 2 ổn định), kèm giải thích 3-5 câu.
**Gợi ý:** highWaterMark mặc định 64KB; ở phiên bản 1, data dồn vào buffer của `res` vì client nhận chậm.

### Bài 5: Mini Job Queue với EventEmitter + concurrency limit (Khó)

**Đề bài:** Viết class `JobQueue extends EventEmitter` với: `add(asyncFn)` thêm job, option `concurrency` (vd 3) giới hạn số job chạy đồng thời, emit các event `job:start`, `job:done`, `job:error`, `queue:drained`. Job lỗi không được làm sập queue. Viết demo 10 job (sleep ngẫu nhiên 0.5–2s, 2 job throw lỗi).

**Yêu cầu output:** Log timeline cho thấy không bao giờ quá 3 job chạy cùng lúc; event `queue:drained` bắn đúng 1 lần khi xong hết; lỗi được bắt qua `job:error`.
**Gợi ý:** Giữ counter `running`; sau mỗi job xong (`finally`) thì lấy job tiếp theo từ mảng pending. Nhớ handle trường hợp `add()` sau khi queue đã drain.

## 📝 Bài test cuối tuần

### Phần 1: Quiz 15 câu trắc nghiệm

**Câu 1.** Phase nào của event loop thực thi callback của `setImmediate`?
A. timers  B. poll  C. check  D. close callbacks

**Câu 2.** Output của đoạn code sau?
```js
process.nextTick(() => console.log('A'));
Promise.resolve().then(() => console.log('B'));
setTimeout(() => console.log('C'), 0);
```
A. A B C  B. B A C  C. C A B  D. A C B

**Câu 3.** `Promise.all([p1, p2, p3])` với p2 reject sau 1s, p1/p3 fulfilled sau 3s. Khi nào nó settle?
A. Sau 3s, fulfilled  B. Sau 1s, rejected  C. Sau 3s, rejected  D. Sau 1s, fulfilled với 2 phần tử

**Câu 4.** Operation nào KHÔNG dùng libuv thread pool?
A. `fs.readFile`  B. `crypto.pbkdf2`  C. TCP socket I/O  D. `dns.lookup`

**Câu 5.** `Buffer.allocUnsafe(10)` "unsafe" vì:
A. Có thể gây buffer overflow  B. Chứa dữ liệu memory cũ chưa được zero-fill  C. Không thể resize  D. Cấp phát trên V8 heap

**Câu 6.** Trong I/O callback, thứ tự nào ĐÚNG và ổn định?
A. setTimeout(0) trước setImmediate  B. setImmediate trước setTimeout(0)  C. Ngẫu nhiên  D. Cả hai chạy cùng lúc

**Câu 7.** `writable.write(chunk)` trả về `false` nghĩa là gì?
A. Ghi thất bại, cần retry  B. Stream đã đóng  C. Internal buffer vượt highWaterMark, nên pause nguồn  D. Chunk bị mất

**Câu 8.** EventEmitter emit `'error'` không có listener thì:
A. Bỏ qua im lặng  B. In warning  C. Throw và crash process  D. Đẩy vào `unhandledRejection`

**Câu 9.** Điểm khác biệt về export giữa CJS và ESM:
A. CJS là live binding, ESM là copy  B. CJS là copy giá trị, ESM là live binding  C. Cả hai đều copy  D. Cả hai đều live binding

**Câu 10.** Gọi `process.nextTick` đệ quy vô hạn sẽ:
A. Crash vì stack overflow  B. Chặn I/O vĩnh viễn (starve event loop)  C. Vẫn cho I/O chạy xen kẽ  D. Bị Node tự giới hạn 1000 lần

**Câu 11.** `Promise.race([fetchData(), timeout(5000)])` dùng để làm gì?
A. Chạy song song lấy cả 2 kết quả  B. Lấy kết quả của promise settle đầu tiên (pattern timeout)  C. Lấy promise fulfilled đầu tiên, bỏ qua rejected  D. Chờ cả 2 xong

**Câu 12.** Listener của `emitter.emit('x')` được gọi:
A. Bất đồng bộ ở tick sau  B. Đồng bộ ngay lập tức theo thứ tự đăng ký  C. Song song trên thread pool  D. Theo thứ tự ngẫu nhiên

**Câu 13.** Vì sao `pipeline()` được khuyên dùng thay `pipe()`?
A. Nhanh hơn đáng kể  B. Tự xử lý error propagation và destroy toàn bộ chain khi lỗi  C. Không cần backpressure  D. Hỗ trợ nhiều stream hơn

**Câu 14.** Từ Node 15+, một Promise rejection không được catch sẽ:
A. Chỉ in warning  B. Bị bỏ qua  C. Crash process (mặc định)  D. Tự retry

**Câu 15.** App của bạn hash password bằng `crypto.pbkdf2` và đồng thời đọc file nhiều. Cách tối ưu đúng?
A. Tăng `UV_THREADPOOL_SIZE`  B. Chuyển hết sang sync để nhanh hơn  C. Thêm RAM  D. Dùng `process.nextTick` bọc pbkdf2

<details><summary>Đáp án</summary>

1. **C** — setImmediate chạy ở check phase, ngay sau poll.
2. **A** — nextTick queue xả trước Promise microtask; setTimeout là macrotask chạy cuối.
3. **B** — `Promise.all` fail-fast: reject ngay khi p2 reject sau 1s (p1, p3 vẫn chạy ngầm nhưng kết quả bị bỏ).
4. **C** — Network I/O dùng kernel async (epoll/kqueue), không qua thread pool.
5. **B** — `allocUnsafe` không zero-fill nên có thể lộ dữ liệu cũ trong memory.
6. **B** — Sau poll phase là check phase (setImmediate); timers phải chờ vòng sau.
7. **C** — Đây là tín hiệu backpressure; pause nguồn và chờ event `'drain'`.
8. **C** — `'error'` là event đặc biệt: không có listener thì throw, crash process.
9. **B** — CJS export snapshot giá trị lúc require; ESM export tham chiếu sống.
10. **B** — nextTick queue xả cạn trước khi event loop tiếp tục → đệ quy vô hạn chặn I/O.
11. **B** — `race` settle theo promise đầu tiên settle, là pattern timeout kinh điển.
12. **B** — emit gọi listener đồng bộ, theo đúng thứ tự đăng ký.
13. **B** — pipe không destroy các stream khác khi 1 stream lỗi → leak; pipeline xử lý trọn vẹn.
14. **C** — Từ Node 15, unhandledRejection mặc định throw làm crash process.
15. **A** — pbkdf2 và fs cùng tranh 4 thread mặc định; tăng UV_THREADPOOL_SIZE giảm nghẽn.

</details>

### Phần 2: Bài thực hành chấm điểm

**Đề bài: Xây dựng "File Processing Service" thuần Node.js core (không framework, không thư viện ngoài).**

Viết HTTP server (module `http`) với các endpoint:

1. `POST /upload` — nhận body là file text (stream), **vừa nhận vừa** gzip (Transform `zlib`) và ghi xuống `./storage/<id>.gz`. Trả về `{ id, originalSize, compressedSize }`. Tuyệt đối không buffer toàn bộ file vào memory.
2. `GET /download/:id` — stream file đã nén về client với giải nén on-the-fly (`gunzip`), set đúng header. File không tồn tại → 404 JSON.
3. `GET /stats` — trả về thống kê qua một class `StatsCollector extends EventEmitter` lắng nghe event `upload:done`, `download:done` từ 2 endpoint trên (đếm số lần, tổng byte).
4. Error handling toàn cục: handler `uncaughtException`/`unhandledRejection` log và exit; mọi stream đều có error handler; client ngắt kết nối giữa chừng không được làm crash server hoặc leak file mở dở.

**Checklist tiêu chí chấm điểm:**

- [ ] Upload file 500MB thành công, RSS của process không vượt quá ~150MB trong suốt quá trình (chứng minh dùng stream + backpressure đúng).
- [ ] Dùng `pipeline()` (không phải `pipe()` trần) cho mọi chain stream, có xử lý lỗi.
- [ ] Client abort giữa chừng (Ctrl+C curl) → server không crash, file dở bị xóa (cleanup trong error handler).
- [ ] `StatsCollector` hoạt động đúng qua EventEmitter, có xử lý event `'error'`.
- [ ] Có custom error class (vd `NotFoundError`) và response lỗi dạng JSON nhất quán `{ error, statusCode }`.
- [ ] Code dùng async/await + `stream/promises`, không callback hell.
- [ ] Có file `NOTES.md` giải thích: luồng đi của 1 request upload qua các phase event loop, và vì sao memory ổn định.

## ✅ Tiêu chí pass tuần

- Quiz ≥ 12/15
- Hoàn thành tất cả bài tập bắt buộc (5/5), bài 1 phải dự đoán đúng tối thiểu 80% thứ tự output **trước khi chạy**
- Bài thực hành đạt đủ checklist (7/7 mục)
- Giải thích miệng (hoặc viết) được sơ đồ event loop và đường đi của `process.nextTick`/microtask trong vòng 3 phút, không nhìn tài liệu
