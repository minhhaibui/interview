# 🔬 Đào sâu — Tuần 1: Node.js Core

> File này bổ sung **chiều sâu** cho `README.md` — đọc README trước cho chắc nền tảng, rồi quay lại đây để hiểu cơ chế bên trong, bẫy production và các câu hỏi phỏng vấn khó hơn.

## 🧠 Cơ chế bên trong (internals)

### 1. libuv thread pool — chi tiết hơn

README đã nói pool mặc định 4 thread phục vụ fs/dns.lookup/crypto/zlib. Phần này đào sâu **tại sao** và **giới hạn**.

`UV_THREADPOOL_SIZE` phải set **trước khi thread pool được tạo lần đầu** — tức trước I/O async đầu tiên. Set giữa chừng (`process.env.UV_THREADPOOL_SIZE = 16` sau khi đã `fs.readFile`) **không có tác dụng**, vì pool đã khởi tạo lazy ngay lần dùng đầu.

```js
// PHẢI nằm trên cùng, trước mọi require gây I/O:
process.env.UV_THREADPOOL_SIZE = 16; // hoặc set qua biến môi trường khi chạy
const fs = require('fs');
```

Phân loại rõ ràng cái gì **dùng pool** và cái gì **không**:

| Dùng thread pool | Dùng kernel async (epoll/kqueue/IOCP) — KHÔNG pool |
|---|---|
| `fs.*` (đọc/ghi file, stat...) | TCP/UDP socket (`net`, `http`, `https`) |
| `dns.lookup` (gọi `getaddrinfo` C — blocking) | `dns.resolve*` (gửi query DNS qua network) |
| `crypto.pbkdf2`, `scrypt`, `randomBytes` (async), `randomFill` | `crypto` đồng bộ thì block main thread (không pool) |
| `zlib.*` async (gzip/gunzip/brotli) | `fs.watch` (dùng inotify/kqueue của OS) |

Bẫy hay nhầm: `dns.lookup` (mà mọi `http.get('http://host')` dùng ngầm để phân giải hostname) **chiếm thread pool**. Nếu app gọi nhiều outbound HTTP tới các host khác nhau, các `getaddrinfo` này tranh thread với `fs` và `crypto`. Cách giảm tải: dùng DNS cache (lib như `cacheable-lookup`) hoặc tăng pool size.

Thread pool tối đa **1024** (Node ≥ 12), nhưng tăng vô tội vạ không giúp gì — số thread hữu ích bị giới hạn bởi số CPU core vật lý cho công việc CPU-bound (crypto), còn fs thì bị giới hạn bởi tốc độ disk.

### 2. V8 quản lý heap như thế nào

V8 chia heap thành các generation, dựa trên giả thuyết "hầu hết object chết trẻ":

- **New space (young generation)**: nhỏ (~1–16MB), nơi object mới sinh ra. GC ở đây là **Scavenge** (thuật toán Cheney): cực nhanh, copy object còn sống từ "from-space" sang "to-space", phần còn lại bỏ nguyên cụm. Object sống qua 2 lần scavenge thì được **promote** sang old space.
- **Old space (old generation)**: lớn, chứa object sống lâu. GC ở đây là **Mark-Sweep-Compact**: mark object reachable từ root, sweep phần chết, thỉnh thoảng compact để chống phân mảnh. Đây là loại GC tốn thời gian → có thể gây **stop-the-world pause** (mọi JS đứng im vài ms tới vài chục ms).

V8 hiện đại làm phần lớn mark **concurrent/incremental** (chạy xen trên background thread) để giảm pause, nhưng vẫn có những pha phải dừng main thread.

```bash
# Mặc định old space ~ vài trăm MB (cũ ~1.4–1.7GB tùy bản). Tăng khi cần:
node --max-old-space-size=4096 app.js   # 4GB
# Soi GC theo thời gian thực:
node --trace-gc app.js
```

Liên hệ với event loop: **GC chạy trên main thread V8** (trừ phần concurrent), nên một pha GC nặng cũng làm tăng **event loop lag** y như code sync — đây là lý do leak memory không chỉ gây OOM mà còn làm p99 latency xấu đi (GC chạy thường xuyên hơn, lâu hơn).

### 3. Backpressure — sâu hơn cơ chế write/drain

README đã nói `write()` trả `false` khi vượt `highWaterMark`. Điểm tinh tế:

- `highWaterMark` là **ngưỡng tư vấn (advisory)**, KHÔNG phải giới hạn cứng. `write()` trả `false` **vẫn nhận chunk đó** và đẩy vào buffer — nó chỉ *báo* "đừng ghi tiếp". Nếu producer phớt lờ và cứ `write()`, buffer phình **không giới hạn** → đó chính là nguồn gốc OOM ở Bài 4 của README.
- Với **object mode** stream, `highWaterMark` đếm theo **số object** (mặc định 16), không phải byte.
- `cork()` / `uncork()`: gom nhiều `write()` nhỏ lại ghi một lần (giảm syscall) — hữu ích khi ghi nhiều mảnh nhỏ liên tiếp.

### 4. Microtask draining giữa các phase — so sánh sâu

README nói "giữa mỗi callback, drain nextTick rồi Promise microtask". Điểm đào sâu: **drain xảy ra giữa từng callback, không phải giữa từng phase**.

Trong **một phase** (ví dụ timers phase) có nhiều callback xếp hàng. Sau **mỗi** callback đó, Node chạy `runNextTicks()` rồi `runMicrotasks()`. Hệ quả: nếu một `setTimeout` callback queue thêm một `nextTick`, cái `nextTick` đó chạy **trước** `setTimeout` callback kế tiếp trong cùng phase — chứ không đợi hết phase.

```js
setTimeout(() => { console.log('t1'); process.nextTick(() => console.log('nt')); }, 0);
setTimeout(() => console.log('t2'), 0);
// Output: t1 → nt → t2   (nt chen vào GIỮA hai timer callback)
```

Ngoại lệ lịch sử quan trọng: trong các bản Node cũ, microtask **không** drain giữa các callback của cùng một phase — hành vi này được sửa từ Node 11 để **thống nhất với trình duyệt**. Câu hỏi phỏng vấn hay xoáy vào "code này trên Node 10 và Node 18 cho output khác nhau không?".

## 🧪 Ví dụ nâng cao & phân tích

### Ví dụ 1 — nextTick lồng trong Promise lồng trong I/O

```js
const fs = require('fs');

console.log('start');

setImmediate(() => console.log('immediate'));

fs.readFile(__filename, () => {
  console.log('readFile cb');
  Promise.resolve().then(() => console.log('  promise in readFile'));
  process.nextTick(() => console.log('  nextTick in readFile'));
});

Promise.resolve().then(() => {
  console.log('promise top');
  process.nextTick(() => console.log('  nextTick in promise'));
});

console.log('end');
```

**Output:**
```
start
end
promise top
  nextTick in promise
immediate
readFile cb
  nextTick in readFile
  promise in readFile
```

**Phân tích:** Sync chạy trước (`start`, `end`). Hết sync → drain microtask: `promise top` chạy, nó **queue thêm** một nextTick; vì đang ở pha drain, nextTick này chạy ngay sau (`nextTick in promise`). Vào event loop: `fs.readFile` chưa xong (disk chậm) nên poll phase chưa có nó; check phase chạy `immediate`. Vòng sau, poll phase có kết quả file → `readFile cb`; bên trong nó queue cả nextTick lẫn promise, và **nextTick luôn ưu tiên trước Promise microtask** → `nextTick in readFile` trước `promise in readFile`.

### Ví dụ 2 — async function "ẩn" microtask

```js
async function a() {
  console.log('a start');
  await b();          // await tạo điểm dừng → phần sau là microtask
  console.log('a end');
}
async function b() {
  console.log('b');
}

console.log('script start');
a();
Promise.resolve().then(() => console.log('promise'));
console.log('script end');
```

**Output:** `script start` → `a start` → `b` → `script end` → `a end` → `promise`

**Phân tích:** `a()` chạy đồng bộ tới `await b()`. `b()` chạy đồng bộ in `b` rồi trả Promise đã resolved. `await` **luôn nhường** một microtask kể cả khi giá trị đã sẵn — phần sau `await` (`a end`) bị đẩy vào microtask queue **trước** cái `.then` bên dưới. Sau khi `script end` chạy xong, drain microtask theo thứ tự enqueue: `a end` trước `promise`.

### Ví dụ 3 — starvation: nextTick "đói" I/O

```js
const fs = require('fs');
let count = 0;

fs.readFile(__filename, () => console.log('FILE READ DONE')); // sẽ bị trì hoãn rất lâu

function loop() {
  if (count++ < 1e6) process.nextTick(loop); // đệ quy nextTick
}
loop();
```

`FILE READ DONE` chỉ in **sau khi** 1 triệu lần nextTick chạy xong, vì nextTick queue phải **cạn** trước khi event loop bước sang poll phase để xử lý kết quả file. Nếu thay `process.nextTick(loop)` bằng `setImmediate(loop)` thì I/O được xen vào giữa các vòng → file đọc xong sớm hơn nhiều. Đây là minh họa "starve event loop".

### Ví dụ 4 — backpressure ĐÚNG khi pipe file lớn (manual, để hiểu bản chất)

```js
const fs = require('fs');

function copyWithBackpressure(src, dest) {
  return new Promise((resolve, reject) => {
    const rs = fs.createReadStream(src, { highWaterMark: 64 * 1024 });
    const ws = fs.createWriteStream(dest);

    rs.on('data', (chunk) => {
      const ok = ws.write(chunk);
      if (!ok) {
        rs.pause();                      // buffer đầy → ngừng đọc
        ws.once('drain', () => rs.resume()); // xả xong → đọc tiếp
      }
    });
    rs.on('end', () => ws.end());
    rs.on('error', reject);
    ws.on('error', reject);
    ws.on('finish', resolve);
  });
}
```

Trong production thì luôn dùng `pipeline(rs, ws)` (README đã nêu) — đoạn trên chỉ để hiểu cơ chế `pause`/`drain`/`resume` mà `pipe` làm ngầm.

### Ví dụ 5 — AsyncLocalStorage: context xuyên suốt async chain

Vấn đề thực tế: gắn `requestId` vào mọi log của một request mà **không phải truyền tham số qua từng hàm**. Trước đây phải nhét vào `req` rồi chuyền tay; `AsyncLocalStorage` giải quyết gọn:

```js
const { AsyncLocalStorage } = require('async_hooks');
const als = new AsyncLocalStorage();

function log(msg) {
  const store = als.getStore();
  console.log(`[req=${store?.requestId}] ${msg}`);
}

// Middleware giả lập: mỗi request chạy trong một "store" riêng
function handleRequest(requestId) {
  als.run({ requestId }, async () => {
    log('bắt đầu xử lý');
    await new Promise((r) => setTimeout(r, 10));
    log('xong'); // vẫn thấy đúng requestId dù đã qua await
  });
}

handleRequest('A1');
handleRequest('B2'); // hai context không lẫn vào nhau
```

`als.run(store, cb)` lưu `store` gắn với async context hiện tại; mọi callback/await nảy sinh bên trong đều `getStore()` ra đúng `store`, kể cả sau nhiều lần `await`. Đây là nền tảng của các thư viện tracing/logging hiện đại (pino, OpenTelemetry). Lưu ý: có chi phí nhỏ về hiệu năng, và phải cẩn thận với event emitter "thoát" khỏi context.

### Ví dụ 6 — worker_threads cho CPU-bound

README nói CPU-bound block main thread, cần worker. Đây là khung tối thiểu chuyển một tính toán nặng sang thread khác:

```js
// main.js
const { Worker } = require('worker_threads');

function runHeavy(n) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, { workerData: n });
    worker.once('message', resolve);
    worker.once('error', reject);
    worker.once('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker stopped, code ${code}`));
    });
  });
}

// worker.js (gộp chung file cho gọn)
const { isMainThread, parentPort, workerData } = require('worker_threads');
if (!isMainThread) {
  let sum = 0;
  for (let i = 0; i < workerData; i++) sum += Math.sqrt(i); // CPU-bound
  parentPort.postMessage(sum);
}

if (require.main === module && require('worker_threads').isMainThread) {
  (async () => {
    console.log(await runHeavy(1e9)); // main thread KHÔNG bị block, vẫn nhận request khác
  })();
}
```

Điểm cần nói khi phỏng vấn: worker có **V8 isolate + event loop riêng**, không share memory trừ khi dùng `SharedArrayBuffer`; truyền dữ liệu qua `postMessage` dùng **structured clone** (copy), nên truyền payload lớn có chi phí — với dữ liệu nhị phân lớn dùng `transferList` để chuyển quyền sở hữu (zero-copy) thay vì copy.

## 🐛 Bẫy & sự cố production hay gặp

### 1. Block event loop bằng thao tác sync nặng → p99 latency tăng vọt

`JSON.parse`/`JSON.stringify` một object vài MB, `crypto.*Sync`, `fs.readFileSync`, regex thảm họa (ReDoS), vòng `for` lớn — tất cả **block main thread**. Khi đó **mọi** request đang chờ đều bị đóng băng, p99/p999 latency tăng đột biến dù p50 vẫn đẹp.

- **Dấu hiệu:** event loop lag cao (đo bằng `perf_hooks.monitorEventLoopDelay()`), p99 nhảy vọt khi traffic tăng, CPU một core full.
- **Fix:** dùng bản async (`crypto.pbkdf2` thay `pbkdf2Sync`), stream thay vì parse cả file, chia nhỏ vòng lặp bằng `setImmediate`, đẩy CPU-bound sang `worker_threads`.

```js
const { monitorEventLoopDelay } = require('perf_hooks');
const h = monitorEventLoopDelay({ resolution: 20 });
h.enable();
setInterval(() => console.log('loop p99 (ms):', (h.percentile(99) / 1e6).toFixed(1)), 1000);
```

### 2. Memory leak do listener / closure không gỡ → MaxListenersExceededWarning

Đăng ký listener trong mỗi request mà không `removeListener`/`off`, hoặc closure giữ tham chiếu tới object lớn.

- **Dấu hiệu:** `(node) MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 listeners added`. RSS tăng đều không tụt sau GC.
- **Fix:** dùng `emitter.once()` khi chỉ cần một lần; gỡ listener trong `finally`/`close`; với async dùng `AbortController` + `{ signal }` để auto-remove; soi bằng heap snapshot (`node --inspect`, Chrome DevTools, so sánh 2 snapshot tìm object tăng).

```js
const ac = new AbortController();
emitter.on('data', onData, { signal: ac.signal });
// ... khi xong:
ac.abort(); // gỡ listener tự động, không cần nhớ tên hàm để removeListener
```

### 3. unhandledRejection làm crash process (Node ≥ 15)

Quên `catch`, hoặc `await` trong vòng lặp mà một promise reject, hoặc tạo promise "fire-and-forget" không xử lý lỗi.

- **Dấu hiệu:** process chết với `UnhandledPromiseRejection`, log có stack của promise không ai catch.
- **Fix:** luôn `.catch` cho promise fire-and-forget; bọc `try/catch` quanh `await`; đăng ký `process.on('unhandledRejection')` để log có cấu trúc **trước khi** crash (như README) — nhưng đừng dùng nó để nuốt lỗi và sống tiếp.

### 4. Đọc cả file vào RAM thay vì stream → OOM

`const data = await fs.readFile('huge.csv')` rồi `data.split('\n')` với file vài GB → cấp một Buffer khổng lồ ngoài heap + mảng string khổng lồ trong heap → chạm `--max-old-space-size` → `JavaScript heap out of memory`.

- **Dấu hiệu:** crash `FATAL ERROR: ... heap out of memory` chỉ khi gặp file lớn; RSS nhảy dựng đứng đúng lúc xử lý file.
- **Fix:** `readline` trên `createReadStream`, hoặc Transform stream (Bài 3 README). Buffer còn bị giới hạn cứng kích thước (`buffer.constants.MAX_LENGTH`) — file vượt ngưỡng sẽ ném lỗi ngay cả khi đủ RAM.

### 5. Nhầm `__dirname` / `require` trong ESM

Trong file ESM (`"type": "module"` hoặc `.mjs`), `__dirname`, `__filename`, `require` **không tồn tại** → `ReferenceError: __dirname is not defined`.

- **Dấu hiệu:** `ReferenceError: require is not defined in ES module scope` hoặc tương tự khi đổi sang ESM.
- **Fix:** Node ≥ 20.11 dùng `import.meta.dirname` / `import.meta.filename`; bản cũ hơn:

```js
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Cần require trong ESM:
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
```

### 6. Quên error handler cho stream → crash do 'error' không listener

Stream/socket emit `'error'` (file không tồn tại, EPIPE khi client ngắt, ECONNRESET) mà không có `.on('error')` → throw, crash cả server (README đã nêu hành vi 'error' của EventEmitter).

- **Dấu hiệu:** server chết bất chợt với `Error: ENOENT`/`EPIPE`/`ECONNRESET` không rõ chỗ catch.
- **Fix:** dùng `pipeline()` (gom error về một chỗ); với stream rời luôn gắn `.on('error')`; client abort giữa chừng thì cleanup file dở (xóa file `.tmp`, `stream.destroy()`).

## ⚖️ Đánh đổi & quyết định thiết kế

### worker_threads vs cluster vs child_process

| | Dùng khi | Cơ chế | Lưu ý |
|---|---|---|---|
| **worker_threads** | CPU-bound trong **cùng app** (parse/transform/hash/ảnh) | Thread, cùng process, share được `SharedArrayBuffer` | Khởi tạo rẻ hơn process; giao tiếp qua message (structured clone); KHÔNG cô lập crash hoàn toàn |
| **cluster** | Scale **I/O-bound HTTP server** theo số core | Fork nhiều process Node, share cùng port (kernel load-balance) | Mỗi worker là process độc lập; thường thay bằng PM2/orchestrator (k8s) trong thực tế |
| **child_process** | Chạy **chương trình ngoài** (ffmpeg, git) hoặc cô lập hẳn | Process con riêng, giao tiếp qua stdio/IPC | Cô lập mạnh nhất; chi phí spawn cao nhất |

Quy tắc nhanh: **CPU-bound trong JS → worker_threads**; **nhân bản server để dùng hết core → cluster (hoặc nhiều pod)**; **gọi binary ngoài → child_process**.

### Stream vs Buffer (đọc nguyên khối)

- **Buffer/`readFile`**: code đơn giản, truy cập ngẫu nhiên dễ, **chỉ hợp file nhỏ** (config, ảnh thumbnail). Latency thấp vì không có overhead chunk.
- **Stream**: memory hằng số bất kể kích thước, bắt đầu xử lý ngay từ byte đầu (TTFB thấp), compose qua pipeline. Đổi lại code phức tạp hơn, khó truy cập ngẫu nhiên. **Mặc định chọn stream cho dữ liệu kích thước không kiểm soát được** (upload của user, file log, response proxy).

### CommonJS vs ESM trong dự án thật

- **Chọn ESM** cho dự án mới: chuẩn tương lai, tree-shaking, top-level await, đồng nhất với frontend. Đổi lại: phải ghi đuôi `.js` khi import, một số lib cũ chỉ CJS gây ma sát, mock trong test khó hơn (không hijack `require` được).
- **Giữ CJS** khi: codebase lớn đang chạy ổn, phụ thuộc nhiều lib/cấu hình CJS, cần `require` động theo điều kiện. Node ≥ 22 cho `require()` ESM đồng bộ (nếu không có top-level await) làm interop dễ thở hơn.
- **Tránh trộn lẫn** lung tung trong cùng package — chọn một kiểu chủ đạo, khai báo `"type"` rõ ràng để khỏi nhầm cách Node phân giải.

## 🎯 Câu hỏi phỏng vấn NÂNG CAO

**Q1: Vì sao `Promise.then` chạy trước `setTimeout(fn, 0)` dù cùng "0ms"?**
Khác **loại hàng đợi**, không phải khác thời gian. `.then` là **microtask** — được drain **sạch** ngay sau callback hiện tại, trước khi event loop bước sang phase kế. `setTimeout` là **macrotask** ở timers phase và chỉ chạy ở vòng lặp sau. Ngoài ra `setTimeout(fn, 0)` thực tế bị Node ép tối thiểu ~1ms. Nên microtask luôn "chen ngang" trước.

**Q2: `UV_THREADPOOL_SIZE` ảnh hưởng gì khi server gọi crypto/bcrypt nhiều?**
`pbkdf2`/`scrypt`/`bcrypt` chạy trên thread pool (4 thread mặc định). N request login đồng thời > 4 → các request thứ 5 trở đi **xếp hàng** chờ thread, đồng thời tranh thread với `fs` và `dns.lookup` → tăng latency cho cả các thao tác không liên quan. Tăng `UV_THREADPOOL_SIZE` (ví dụ = số core, hoặc cao hơn cho I/O-bound mix) giảm nghẽn — nhưng vượt số CPU core thật thì crypto (CPU-bound) không nhanh thêm, chỉ giúp khi mix với fs/dns. Lưu ý phải set **trước** I/O đầu tiên.

**Q3: Giải thích "Zalgo" và cách tránh.**
Zalgo = một API **lúc gọi callback đồng bộ, lúc bất đồng bộ** tùy nhánh (ví dụ: có cache thì `cb()` ngay, không cache thì `cb()` sau I/O). Hệ quả: thứ tự thực thi không đoán được, biến khởi tạo sau `cb` có thể chưa tồn tại khi nhánh sync chạy → bug ẩn rất khó tái hiện. **Tránh:** làm callback **luôn async nhất quán** bằng `process.nextTick(() => cb(...))` ở nhánh đồng bộ (như ví dụ `readConfig` trong README), hoặc dùng Promise (Promise đảm bảo `.then` luôn async).

**Q4: Event loop bị block thì health check (`GET /health`) còn trả lời không?**
**Không.** Health check cũng là một callback chạy trên main thread; event loop đã đứng thì nó nằm chờ trong queue, không được thực thi → load balancer timeout, đánh dấu instance unhealthy. Đó là lý do nên (a) không bao giờ chạy CPU-bound nặng trên main thread, (b) đẩy việc nặng sang worker, (c) cân nhắc theo dõi event loop lag và để orchestrator restart khi lag vượt ngưỡng. Đây cũng là lý do health check không nên tự nó làm việc nặng.

**Q5: Trên Node 10 và Node 18, đoạn code microtask cùng-phase có cho output khác nhau không?**
**Có thể.** Từ Node 11, microtask được drain **giữa từng callback của cùng một phase** (đồng bộ với hành vi trình duyệt); Node 10 trở về trước drain ở ranh giới khác. Vì vậy code có nhiều timer/I/O callback cùng phase mà mỗi callback lại queue microtask sẽ cho thứ tự khác giữa hai bản. Phỏng vấn hỏi câu này để kiểm tra mình có hiểu "drain theo từng callback" chứ không phải "theo từng phase".

**Q6: `await` một giá trị không phải Promise (ví dụ `await 5`) có nhường event loop không?**
**Có.** `await` luôn bọc giá trị vào `Promise.resolve` và xếp phần code sau nó vào **microtask queue**, kể cả khi giá trị đã sẵn sàng. Nó nhường cho các microtask đã enqueue trước đó chạy, nhưng **không** nhường tới macrotask (timer/I/O) — chỉ một "lượt" microtask. Đây là lý do thứ tự ở Ví dụ 2 phía trên.

**Q7: Vì sao memory leak làm tăng latency chứ không chỉ gây OOM?**
Heap càng đầy, V8 chạy GC (đặc biệt mark-sweep old space) **thường xuyên hơn và lâu hơn**. GC chạy trên main thread (phần stop-the-world) → mỗi pha GC là một khoảng event loop bị đóng băng → p99 latency xấu đi từ từ **trước khi** process thực sự OOM. Quan sát `--trace-gc` thấy tần suất và thời lượng GC tăng dần là dấu hiệu sớm.

**Q8: Tại sao network I/O không cần thread pool nhưng `dns.lookup` lại cần?**
Network socket có API async ở kernel (epoll/kqueue/IOCP) — kernel chủ động báo khi socket readable/writable, libuv chỉ poll trạng thái, không cần thread chờ. Còn `dns.lookup` gọi hàm C `getaddrinfo` của hệ điều hành — hàm này **blocking, không có biến thể async ở libc** → buộc phải đẩy ra thread pool để khỏi block main thread. Ngược lại `dns.resolve` tự gửi gói tin DNS qua **network socket** nên dùng kernel async, không tốn thread pool.

## 📚 Đọc thêm

- **libuv design overview** — tài liệu chính thức libuv (mục "Design overview": event loop, thread pool, handles vs requests).
- **Node.js docs** — "The Node.js Event Loop, Timers, and process.nextTick()"; "Don't Block the Event Loop"; trang `worker_threads`, `async_hooks` (AsyncLocalStorage), `stream` (backpressure).
- **V8 blog** — "Trash talk: the Orinoco garbage collector", "Concurrent marking in V8" (giải thích scavenge, mark-sweep, concurrent GC).
- **Keyword tra cứu:** `monitorEventLoopDelay`, `--trace-gc`, `--max-old-space-size`, `cacheable-lookup` (DNS cache), `pino` + AsyncLocalStorage, `buffer.constants.MAX_LENGTH`, `ReDoS`, structured clone + `transferList`.
