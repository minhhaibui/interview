# Tuần 1 — Thiết kế hệ thống & Case thực tế: Node.js Core

> Tài liệu bổ trợ cho README.md cùng thư mục. Học sau khi xong phần lý thuyết.

## 🏗️ Mini System Design (scoped vào chủ đề tuần)

### Bài 1: Log Processing Pipeline đọc file 50GB bằng Streams

**Đề bài:** Hệ thống của bạn sinh ra access log dạng JSON-lines, mỗi ngày 1 file ~50GB (~200 triệu dòng). Viết một CLI tool bằng Node.js để: parse từng dòng, lọc các request có `status >= 500`, đếm theo `endpoint`, ghi kết quả ra file CSV. **Ràng buộc:** process chỉ được cấp heap 512MB (`--max-old-space-size=512`), không được OOM, phải xử lý được dòng JSON bị hỏng (skip + đếm lỗi).

**Phân tích & lời giải:**

Bước 1 — Nhận diện bẫy: `fs.readFile` file 50GB là chết ngay (buffer toàn bộ vào memory, vượt cả giới hạn buffer của Node ~2GB). Đáp án bắt buộc là **stream pipeline**.

Bước 2 — Kiến trúc pipeline:

```
fs.createReadStream (highWaterMark 64KB)
        │ chunk Buffer (cắt giữa dòng!)
        ▼
LineSplitter (Transform)  ← giữ phần dòng dở dang trong biến tạm
        │ từng dòng string
        ▼
ParseFilter (Transform)   ← JSON.parse trong try/catch, lọc status >= 500
        │ { endpoint }
        ▼
Aggregator (Writable)     ← Map<endpoint, count> (chỉ giữ aggregate, không giữ raw)
        │ (khi 'finish')
        ▼
fs.writeFile kết quả CSV
```

Điểm mấu chốt khi present: **memory tiêu thụ là O(số endpoint khác nhau), không phải O(kích thước file)**. 512MB thừa sức vì ta chỉ giữ 1 chunk + 1 dòng dở + 1 Map aggregate.

Bước 3 — Code lõi (dùng `pipeline` để có backpressure + error propagation tự động):

```js
const { pipeline } = require('node:stream/promises');
const { Transform, Writable } = require('node:stream');
const fs = require('node:fs');

// Tách dòng: chunk có thể cắt GIỮA một dòng → phải giữ "leftover"
class LineSplitter extends Transform {
  constructor() {
    super({ readableObjectMode: true });
    this.leftover = '';
  }
  _transform(chunk, _enc, cb) {
    const lines = (this.leftover + chunk.toString('utf8')).split('\n');
    this.leftover = lines.pop(); // dòng cuối có thể chưa trọn vẹn
    for (const line of lines) if (line) this.push(line);
    cb();
  }
  _flush(cb) {
    if (this.leftover) this.push(this.leftover);
    cb();
  }
}

class ParseFilter extends Transform {
  constructor(stats) {
    super({ objectMode: true });
    this.stats = stats;
  }
  _transform(line, _enc, cb) {
    try {
      const log = JSON.parse(line);
      if (log.status >= 500) this.push(log.endpoint);
    } catch {
      this.stats.badLines++; // dòng hỏng: skip, không crash
    }
    cb();
  }
}

async function run(file) {
  const stats = { badLines: 0 };
  const counts = new Map();

  await pipeline(
    fs.createReadStream(file, { highWaterMark: 64 * 1024 }),
    new LineSplitter(),
    new ParseFilter(stats),
    new Writable({
      objectMode: true,
      write(endpoint, _enc, cb) {
        counts.set(endpoint, (counts.get(endpoint) || 0) + 1);
        cb();
      },
    })
  );

  const csv = ['endpoint,count_5xx',
    ...[...counts.entries()].map(([e, c]) => `${e},${c}`)].join('\n');
  await fs.promises.writeFile('report.csv', csv);
  console.log(`Done. Bad lines skipped: ${stats.badLines}`);
}
```

Bước 4 — Giải thích backpressure (interviewer chắc chắn đào vào đây):
- Mỗi stream có buffer nội bộ giới hạn bởi `highWaterMark`. Khi consumer chậm, `push()`/`write()` trả về `false` → stream phía trước **tự dừng đọc** (pause), buffer xả bớt thì `'drain'` → đọc tiếp.
- `pipeline()` (khác với `.pipe()` chay) wire sẵn cơ chế này + **destroy toàn bộ chuỗi khi 1 stream lỗi** → không leak file descriptor.
- Nếu tự `readStream.on('data', cb)` mà không pause → data dồn vào memory → OOM dù dùng "stream".

Bước 5 — Tối ưu thêm nếu bị hỏi "chạy nhanh hơn nữa": CPU-bound chỗ `JSON.parse` → chia file theo byte-range cho N `worker_threads`, mỗi worker chạy pipeline riêng rồi merge các Map (map-reduce). Lưu ý xử lý dòng bị cắt tại ranh giới range.

**Trade-offs:**
- `pipeline()` vs `.pipe()`: `pipeline` an toàn hơn (cleanup, error propagation) nhưng phải nhớ nó destroy hết khi lỗi — muốn "skip lỗi và đi tiếp" thì phải catch **bên trong** Transform như trên.
- `highWaterMark` lớn → ít syscall, throughput cao hơn, nhưng tốn memory hơn và backpressure phản ứng chậm hơn.
- `readline.createInterface` đơn giản hơn LineSplitter tự viết, nhưng tự viết Transform thể hiện hiểu bản chất (và kiểm soát được objectMode).
- Aggregate trong memory: nếu cardinality endpoint cực lớn (hàng chục triệu) thì Map cũng phình → khi đó flush partial result xuống disk/Redis theo chu kỳ.

**Follow-up interviewer hay hỏi:**
1. *"Nếu giữa chừng process crash thì sao, chạy lại từ đầu à?"* → Gợi ý: checkpoint byte offset đã xử lý (ghi định kỳ ra file), restart thì `createReadStream(file, { start: offset })`; đổi lại phải chấp nhận xử lý lại 1 đoạn nhỏ (at-least-once) và aggregate phải idempotent hoặc lưu kèm offset.
2. *"`highWaterMark` 64KB nghĩa là memory tối đa 64KB?"* → Không. Mỗi stream trong chuỗi có buffer riêng, cộng thêm leftover string; objectMode tính theo **số object** (mặc định 16) chứ không theo byte.
3. *"File nén .gz thì sao?"* → Chèn `zlib.createGunzip()` vào ngay sau read stream — đây chính là vẻ đẹp của composable streams.

---

### Bài 2: Real-time Notification Gateway — 50K WebSocket connections trên 1 process

**Đề bài:** Thiết kế một notification gateway giữ **50.000 WebSocket connections** đồng thời trên **1 process Node.js** (4GB RAM). Backend khác publish event (qua Redis Pub/Sub), gateway đẩy xuống đúng user. Yêu cầu: phát hiện và dọn connection chết trong ≤ 60s (heartbeat), p99 latency đẩy message < 100ms, không được để event loop bị block.

**Phân tích & lời giải:**

Bước 1 — Tại sao 1 process Node giữ nổi 50K connections? Vì connection nhàn rỗi gần như **không tốn CPU** — chỉ tốn memory (socket buffer + object ~ vài chục KB/conn → 50K * ~30-50KB ≈ 1.5–2.5GB, vừa khít 4GB) và 1 file descriptor (nhớ `ulimit -n` phải > 50K). Event loop + epoll/kqueue xử lý hàng chục nghìn socket idle là chuyện thường — đây đúng sở trường của Node.

```
                 ┌────────────────────────────────────┐
 Backend ──pub──▶│ Redis Pub/Sub (channel: notif)     │
                 └───────────────┬────────────────────┘
                                 │ subscribe
                 ┌───────────────▼────────────────────┐
                 │  Gateway (1 Node process)          │
                 │  Map<userId, Set<WebSocket>>       │  ← 1 user nhiều device
                 │  heartbeat timer (1 timer chung)   │
                 └───────────────┬────────────────────┘
                       50K WebSocket connections
                                 ▼
                              Clients
```

Bước 2 — Routing table & lifecycle:

```js
const { WebSocketServer } = require('ws');
const wss = new WebSocketServer({ port: 8080 });
const userSockets = new Map(); // userId -> Set<ws>

wss.on('connection', (ws, req) => {
  const userId = authenticate(req); // verify JWT từ query/header, fail → ws.close(4401)
  if (!userId) return ws.close(4401, 'unauthorized');

  ws.isAlive = true;
  ws.userId = userId;
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId).add(ws);

  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('close', () => {
    const set = userSockets.get(userId);
    set?.delete(ws);
    if (set?.size === 0) userSockets.delete(userId); // tránh leak key
  });
  ws.on('error', () => ws.terminate());
});
```

Bước 3 — Heartbeat: **1 interval duy nhất quét toàn bộ**, tuyệt đối không tạo 50K `setInterval` (50K timer object + 50K callback rải rác phá nát event loop):

```js
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) return ws.terminate(); // 2 chu kỳ không pong → chết
    ws.isAlive = false;
    ws.ping(); // ping frame chuẩn WS, browser tự trả pong
  }
}, 30_000); // 2 lần miss = phát hiện chết trong ≤60s ✓
```

Nếu lo vòng `for` 50K phần tử block lâu (thực tế chỉ vài ms): chia quét theo batch bằng `setImmediate` giữa các batch 5K connection.

Bước 4 — Nhận event từ Redis và fan-out:

```js
sub.subscribe('notif', (raw) => {
  const { userId, payload } = JSON.parse(raw);
  const sockets = userSockets.get(userId);
  if (!sockets) return; // user không connect node này → bỏ qua
  const msg = JSON.stringify(payload); // serialize 1 LẦN cho mọi socket
  for (const ws of sockets) {
    if (ws.bufferedAmount > 1_000_000) ws.terminate(); // client chậm: cắt, đừng để buffer phình
    else ws.send(msg);
  }
});
```

Bước 5 — Kỷ luật "không block event loop":
- Mọi handler phải xong trong < vài ms. Cấm `JSON.parse` payload lớn, cấm sync I/O, cấm vòng lặp CPU nặng trong path này.
- Theo dõi **event loop lag** (đo bằng `perf_hooks.monitorEventLoopDelay()`), export metric; lag p99 > 50ms là báo động.
- Broadcast cho toàn bộ 50K user (announcement) → chia batch + `setImmediate` để chen các tick I/O vào giữa.

**Trade-offs:**
- 1 process to vs nhiều process nhỏ sau LB: 1 process đơn giản (routing table local) nhưng là SPOF và restart = rớt 50K conn cùng lúc (thundering herd reconnect → cần client backoff + jitter). Nhiều process thì cần Redis Pub/Sub làm message bus chung (mỗi node subscribe, tự lọc user của mình) — chính là kiến trúc đã vẽ, scale ngang chỉ là thêm node.
- `ws.ping()` (protocol-level) vs app-level heartbeat JSON: ping frame nhẹ và chuẩn, nhưng một số proxy/client lib xử lý kém → app-level `{type:'ping'}` tương thích hơn, tốn bandwidth hơn chút.
- Kick client chậm (`bufferedAmount` cao) vs buffer giúp nó: kick giữ gateway khỏe (bảo vệ memory), đổi lại client mạng yếu bị mất kết nối thường xuyên → cần cơ chế resume/missed-messages phía API.

**Follow-up interviewer hay hỏi:**
1. *"Scale lên 500K connections thì sao?"* → Nhiều gateway node sau LB (L4), mỗi node ~50K conn; Redis Pub/Sub broadcast cho mọi node (đơn giản, hơi phí) hoặc thêm registry `userId → nodeId` (Redis hash, TTL) để route đích danh; sticky không cần vì WS là kết nối bền, chỉ cần LB phân connection mới.
2. *"Deploy gateway mà không rớt hàng loạt?"* → Rolling restart từng node + gửi close frame có code yêu cầu client reconnect với jitter; node mới vào pool trước khi node cũ drain.
3. *"Làm sao biết event loop đang bị block trên production?"* → `monitorEventLoopDelay`, metric `nodejs_eventloop_lag_seconds` (prom-client), kết hợp CPU profile (`--cpu-prof` hoặc clinic.js) khi lag tăng.

---

### Bài 3: Task Runner — 1000 async jobs với concurrency limit

**Đề bài:** Bạn cần gọi 1 API bên thứ ba để enrich 1000 records (mỗi call ~300ms, API cho phép tối đa **10 requests đồng thời**, quá thì trả 429). Viết task runner: chạy đúng 10 jobs song song, job xong thì lấy job tiếp theo (không chạy theo "batch 10"), thu thập cả kết quả lẫn lỗi (không fail-fast), hỗ trợ retry có backoff cho lỗi 429/5xx. **Tự viết p-limit, không dùng thư viện.**

**Phân tích & lời giải:**

Bước 1 — Chỉ ra 2 đáp án sai kinh điển:
- `Promise.all(items.map(call))` → bắn 1000 request cùng lúc → 429 hàng loạt / socket exhaustion.
- Chia batch 10 rồi `await Promise.all(batch)` → **convoy effect**: cả batch phải đợi job chậm nhất, slot rảnh mà không được dùng. Đúng yêu cầu phải là **worker-pool / sliding window**.

Bước 2 — Tự viết `pLimit` (đây là câu hỏi code phỏng vấn rất hay gặp):

```js
function pLimit(concurrency) {
  const queue = [];
  let active = 0;

  const next = () => {
    if (active >= concurrency || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn().then(resolve, reject).finally(() => {
      active--;
      next(); // job xong → kéo ngay job kế tiếp (sliding window)
    });
  };

  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
}
```

Giải thích trọng tâm: closure giữ `active` + `queue`; mỗi promise của caller được "nối dây" vào job thật qua `resolve/reject` lưu trong queue. `finally` đảm bảo slot được trả lại **kể cả khi job throw**.

Bước 3 — Retry với exponential backoff + jitter, tôn trọng `Retry-After`:

```js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, { retries = 3, baseMs = 500 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const retriable = err.status === 429 || err.status >= 500;
      if (!retriable || attempt >= retries) throw err;
      const retryAfter = Number(err.headers?.['retry-after']) * 1000;
      const backoff = retryAfter || baseMs * 2 ** attempt;
      await sleep(backoff + Math.random() * 200); // jitter chống đồng loạt retry
    }
  }
}
```

Bước 4 — Ghép lại, thu thập kết quả không fail-fast:

```js
async function enrichAll(records) {
  const limit = pLimit(10);
  const settled = await Promise.allSettled(
    records.map((rec) =>
      limit(() => withRetry(() => callApi(rec)))
    )
  );
  const ok = [], failed = [];
  settled.forEach((s, i) =>
    s.status === 'fulfilled'
      ? ok.push(s.value)
      : failed.push({ record: records[i], reason: s.reason })
  );
  return { ok, failed }; // failed có thể ghi DLQ/file để xử lý tay
}
```

Lưu ý quan trọng: `records.map(...)` tạo 1000 promise ngay nhưng **job thật chỉ chạy khi pLimit cho phép** — vì ta truyền `() => fn()` (lazy), không phải promise đã chạy. Đây là chỗ ứng viên hay sai: `limit(callApi(rec))` là đã bắn request rồi.

Bước 5 — Nâng cấp nếu bị hỏi thêm: concurrency limit mới chỉ giới hạn "đồng thời", chưa giới hạn "rate". API quota 100 req/s thì cần thêm token bucket trước mỗi call. Và 1000 jobs trong-process là ổn; 10 triệu jobs hoặc cần survive restart → chuyển sang job queue thật (BullMQ/Redis) — dẫn sang tuần Redis.

**Trade-offs:**
- Worker-pool sliding window vs batch: sliding window tận dụng tối đa slot, code phức tạp hơn một chút (nên thuộc lòng pLimit ~20 dòng).
- `Promise.allSettled` vs `Promise.all`: allSettled cho phép gom lỗi từng phần — đúng với bài ETL/enrichment; all phù hợp khi "thiếu 1 là toàn bộ vô nghĩa".
- Retry trong từng job vs requeue về cuối hàng: retry tại chỗ giữ slot bị chiếm trong lúc sleep → giảm throughput; requeue (push lại queue) trả slot ngay nhưng mất ordering và cần đếm attempt theo job.

**Follow-up interviewer hay hỏi:**
1. *"Thêm timeout cho từng job thế nào?"* → `AbortController` + `setTimeout` gọi `controller.abort()`, truyền `signal` vào fetch; nhớ `clearTimeout` khi xong để không giữ event loop.
2. *"Nếu muốn dừng toàn bộ khi quá 50 job lỗi?"* → Thêm biến đếm lỗi trong closure; vượt ngưỡng thì set cờ `stopped`, `next()` thấy cờ thì reject toàn bộ queue còn lại (graceful abort) — đây là dạng circuit breaker thủ công.
3. *"`process.exit()` giữa chừng thì các job in-flight ra sao?"* → Mất trắng, không có `finally` nào chạy với exit. Muốn an toàn: bắt SIGTERM, ngừng nhận job mới, await số active về 0 rồi mới exit — liên hệ graceful shutdown tuần 2.

---

### Bài 4: File Upload Service — streaming thẳng lên S3, không buffer vào memory

**Đề bài:** Thiết kế upload service cho phép user upload video tối đa **5GB**. Server chạy container 1GB RAM, có thể có **200 upload đồng thời**. Yêu cầu: stream thẳng từ request lên S3, không bao giờ giữ toàn bộ file trong memory/disk; validate content-type & size limit ngay khi đang stream; upload hỏng giữa chừng không để lại rác trên S3.

**Phân tích & lời giải:**

Bước 1 — Nhận diện ràng buộc: 200 uploads * 5GB không thể buffer (kể cả ghi temp file cũng tốn 1TB disk + chậm gấp đôi). Request body của Node **vốn đã là Readable stream** → bài toán là nối stream đó vào S3 với backpressure xuyên suốt:

```
Client ──HTTP──▶ Node (req stream) ──▶ Busboy (parse multipart)
                                          │ file stream
                                          ▼
                              Guard (size + magic bytes)
                                          │
                                          ▼
                       @aws-sdk/lib-storage Upload (multipart S3)
                              part 5MB ──▶ S3   ← chỉ giữ vài part/upload
                                                  trong memory (~25-50MB)
```

Bước 2 — Hai phương án, nêu cả hai rồi chọn:

**Phương án A — Presigned URL (nên nêu trước):** server chỉ cấp presigned URL (hoặc presigned multipart cho file lớn), client upload **thẳng lên S3**, không đi qua server. Server tải ~0, đây là best practice khi client là browser/mobile. Chọn phương án B khi: cần validate/transform nội dung khi đang stream, cần che giấu storage backend, hoặc client là bên thứ ba không tích hợp được flow presigned.

**Phương án B — Proxy streaming qua server** (trọng tâm bài này):

```js
const Busboy = require('busboy');
const { Upload } = require('@aws-sdk/lib-storage');
const { PassThrough, Transform } = require('node:stream');

app.post('/upload', (req, res) => {
  const bb = Busboy({
    headers: req.headers,
    limits: { fileSize: 5 * 1024 ** 3, files: 1 },
  });

  bb.on('file', async (_name, fileStream, info) => {
    // 1. Validate magic bytes ở chunk đầu (đừng tin Content-Type header)
    const guard = new MagicByteGuard(['video/mp4', 'video/webm']);
    const body = new PassThrough();

    const upload = new Upload({
      client: s3,
      params: { Bucket: 'videos', Key: makeKey(info.filename), Body: body },
      partSize: 8 * 1024 * 1024, // part 8MB
      queueSize: 3,              // tối đa 3 part in-flight/upload → ~24MB RAM/upload
    });

    fileStream.on('limit', () => {           // vượt 5GB
      upload.abort();                         // S3 AbortMultipartUpload → dọn part rác
      res.status(413).end('File too large');
    });

    try {
      // pipeline có backpressure: S3 chậm → body đầy → guard dừng → req socket dừng đọc
      await Promise.all([
        pipeline(fileStream, guard, body),
        upload.done(),
      ]);
      res.status(201).json({ key: upload.params.Key });
    } catch (err) {
      await upload.abort().catch(() => {});   // không để rác multipart trên S3
      if (!res.headersSent) res.status(400).end('Upload failed');
    }
  });

  req.pipe(bb);
});
```

Bước 3 — Tính memory để chứng minh đạt 1GB RAM: mỗi upload giữ tối đa `queueSize × partSize ≈ 24MB` + buffer stream vài trăm KB. 200 uploads × ~25MB ≈ 5GB → **vượt!** Vậy phải hạ: `queueSize: 1`, `partSize: 5MB` (min của S3) → ~5-6MB/upload × 200 ≈ 1.2GB, vẫn căng → giới hạn 100 upload đồng thời/instance (semaphore — chính là pLimit bài 3) + scale ngang. **Trình bày được phép tính này là điểm ăn tiền** — chứng minh "streaming" không có nghĩa là "miễn phí memory".

Bước 4 — Chống rác trên S3: upload hỏng giữa chừng để lại multipart parts (vẫn tính tiền). Hai lớp: `upload.abort()` trong error path, và **S3 Lifecycle rule** `AbortIncompleteMultipartUpload` sau 1 ngày (lưới an toàn khi process crash mất luôn cơ hội gọi abort).

Bước 5 — Client disconnect: lắng nghe `req.on('aborted')` / lỗi `ECONNRESET` → abort upload ngay, không chờ timeout.

**Trade-offs:**
- Presigned URL vs proxy qua server: presigned rẻ và scale vô hạn nhưng mất khả năng inspect nội dung khi stream và lộ flow S3 cho client; proxy kiểm soát hoàn toàn nhưng trả giá bằng bandwidth + memory của server.
- `partSize` nhỏ → ít memory nhưng nhiều request S3 hơn (giới hạn 10.000 parts → file 5GB cần part ≥ 512KB; S3 min 5MB nên 5GB = 1000 parts, ổn).
- Validate sâu (scan virus, probe codec bằng ffprobe) không làm inline khi stream được → ghi lên S3 trước với prefix `quarantine/`, job async validate xong mới move sang `public/` — accept-then-verify.

**Follow-up interviewer hay hỏi:**
1. *"Resume upload khi đứt mạng?"* → Dùng S3 multipart trực tiếp: server cấp `uploadId`, client upload từng part qua presigned part URLs, ghi lại part đã xong (ETag), đứt thì upload tiếp part còn thiếu rồi `CompleteMultipartUpload`. Hoặc chuẩn tus protocol.
2. *"Tại sao không ghi temp file rồi upload?"* → Tốn gấp đôi thời gian (ghi rồi đọc), tốn disk (200×5GB), crash để lại rác local, và disk container thường ephemeral + chậm. Chỉ hợp lý khi cần xử lý cả file trước upload (vd transcode).
3. *"Node có phù hợp làm việc này không hay nên dùng nginx?"* → Bản chất là I/O relay → Node rất hợp; nhưng nếu chỉ relay thuần không logic thì presigned URL (bỏ hẳn server khỏi data path) tốt hơn cả hai.

---

## 🌍 Case thực tế

### Case 1: Netflix & PayPal chuyển sang Node.js — vì sao event loop thắng thread-per-request

**Bối cảnh:** Khoảng 2012–2014, PayPal chạy web app trên Java (Spring), Netflix chạy UI layer trên Java. Cả hai đối mặt: team frontend/backend tách rời, thời gian build chậm, và workload đặc thù — tầng web/API chủ yếu là **I/O bound**: nhận request, gọi vài service nội bộ, gom JSON, render/trả về. Thread-per-request nghĩa là mỗi request chiếm 1 thread (~1MB stack) chỉ để... ngồi đợi I/O.

**Vấn đề gặp phải:** Concurrency cao → hàng nghìn thread đợi I/O, tốn memory và context-switch; muốn chịu tải phải vung tiền scale. PayPal đo đạc khi viết lại app Account Overview song song bằng Java và Node.js.

**Giải pháp & tại sao:** Chuyển tầng web/API sang Node.js. Kết quả PayPal công bố: bản Node được xây nhanh hơn (~2x, ít người hơn ~33%), **response time giảm ~35%**, phục vụ gấp đôi request/giây so với bản Java tương đương — dù chạy trên 1 core (Java bản đó dùng 5 core). Netflix báo cáo startup time của UI layer giảm từ ~40 phút (JVM app cũ) xuống dưới 1 phút. Lý do cốt lõi: với I/O bound, event loop + non-blocking I/O cho phép **1 thread phục vụ hàng nghìn request đang đợi I/O cùng lúc** — "đợi" gần như miễn phí, không chiếm thread. Cộng thêm: 1 ngôn ngữ JS xuyên suốt frontend–backend, npm ecosystem, iterate nhanh.

**Bài học rút ra:** Node thắng ở **I/O bound, high-concurrency** — đúng profile của API gateway, BFF, real-time service. Bài học ngược cũng quan trọng: cùng các công ty đó **không** dùng Node cho CPU-bound (encoding, recommendation, big data) — 1 phép tính nặng trên event loop là mọi request khác đứng hình. Chọn runtime theo workload, không theo trend.

**💬 Cách dùng case này khi phỏng vấn:** Khi được hỏi "vì sao chọn Node / Node hơn gì Java-Go", đừng trả lời lý thuyết suông — dẫn số liệu PayPal (35% latency, gấp đôi RPS cho I/O bound) rồi **chủ động nêu giới hạn CPU-bound** để thể hiện tư duy hai mặt.

---

### Case 2: API chậm bí ẩn vì `JSON.parse` payload 10MB block event loop

**Bối cảnh:** Tình huống rất điển hình ở các dự án outsource/product VN: hệ thống quản lý đơn hàng tích hợp với đối tác. Đối tác đẩy webhook batch đơn hàng — bình thường vài chục KB, nhưng cuối ngày họ đẩy batch tổng hợp **8–12MB JSON**. Service Node 1 process duy nhất phục vụ cả webhook lẫn API cho mobile app.

**Vấn đề gặp phải:** Mỗi chiều ~17h, mobile app báo API chậm bất thường: p99 nhảy từ 80ms lên 2–4s theo từng "nhịp". CPU tổng thể chỉ ~30%, DB khỏe, không có slow query — đội mất nhiều ngày nghi ngờ network/DB. Bản chất: `app.use(express.json({ limit: '20mb' }))` → mỗi webhook 10MB khiến `JSON.parse` chạy **đồng bộ ~300–600ms**; trong khoảng đó event loop đứng im, **mọi** request khác (kể cả health check) xếp hàng. Vài webhook liên tiếp = vài giây tê liệt. Triệu chứng đặc trưng: latency tăng đều ở *tất cả* endpoint cùng lúc, theo nhịp — dấu vân tay của event loop blocking.

**Giải pháp & tại sao:**
1. **Đo trước đã**: thêm `monitorEventLoopDelay()` + log request có body lớn → xác nhận lag spike trùng thời điểm webhook to. (Khi kể trong phỏng vấn, nhấn mạnh bước "chứng minh bằng số liệu" trước khi sửa.)
2. Fix ngắn hạn: hạ `limit` body về 1MB cho API thường; webhook lớn nhận raw rồi **trả 202 ngay**, đẩy buffer sang xử lý sau.
3. Fix căn cơ: parse JSON lớn trong `worker_threads` (hoặc tách hẳn webhook consumer thành service riêng đọc từ queue); đề nghị đối tác chuyển batch lớn sang upload file + gọi webhook báo "có file" (claim-check pattern).
4. Phòng tái diễn: alert trên metric event loop lag, load test có kịch bản payload lớn.

**Bài học rút ra:** "Async" của Node chỉ áp dụng cho I/O; `JSON.parse`/`stringify`, regex phức tạp, crypto sync, vòng lặp lớn đều block. Một endpoint "hư" có thể đánh sập SLA của toàn bộ endpoint khác trong cùng process — blast radius của blocking là **cả process**. Và: triệu chứng "mọi endpoint chậm cùng lúc, CPU không cao" → nghĩ ngay đến event loop lag.

**💬 Cách dùng case này khi phỏng vấn:** Khi hỏi về event loop, kể debug story này theo mạch "triệu chứng lạ → đo event loop lag → tìm ra sync parse → fix nhiều tầng" — câu chuyện chẩn đoán có số liệu thuyết phục hơn nhiều so với thuộc lòng các phase của libuv.

---

### Case 3: Dùng worker_threads cho image resize — cứu API khỏi chết vì CPU-bound

**Bối cảnh:** Nền tảng e-commerce (kiểu Shopee seller tools), seller upload ảnh sản phẩm, hệ thống resize ra 4 kích cỡ (thumbnail/list/detail/zoom). Ban đầu MVP làm resize **inline trong request handler** bằng sharp — chạy ổn khi ít seller.

**Vấn đề gặp phải:** Chiến dịch onboard seller mới → hàng trăm upload/phút. Dù sharp resize phần lớn chạy trên libuv threadpool, phần encode + xử lý buffer + các thao tác JS quanh nó vẫn ăn CPU; threadpool mặc định chỉ **4 thread** nên các tác vụ I/O khác (DNS lookup, fs, crypto) bị xếp hàng sau các job resize; API khác trong cùng process p99 tăng 5–10x, pod bị OOMKilled vì giữ nhiều buffer ảnh gốc cùng lúc.

**Giải pháp & tại sao:**
1. **Tách CPU-bound khỏi serving path**: upload trả 202 ngay với ảnh gốc, resize chạy async — UX hiển thị "đang xử lý ảnh".
2. Dùng **worker_threads pool** (piscina) cố định `số worker = số core - 1` cho job resize; main thread chỉ điều phối. Truyền ảnh qua `ArrayBuffer` transferable để **không copy** buffer giữa threads.
3. Nâng `UV_THREADPOOL_SIZE` cho phần sharp còn dùng threadpool, và giới hạn số job resize đồng thời (semaphore) để chặn OOM.
4. Bước tiến hóa tiếp theo (khi scale nữa): tách hẳn thành image-worker service riêng đọc từ queue — lúc đó scale resize độc lập với API, và crash của native lib không kéo API chết theo.

**Bài học rút ra:** Thang xử lý CPU-bound trong Node: (1) inline — chỉ cho job < vài ms; (2) `worker_threads` pool — CPU-bound vừa phải, muốn ở cùng process; (3) tách service + queue — khối lượng lớn, cần scale/isolate độc lập. `worker_threads` không miễn phí: spawn tốn ~vài chục ms và vài MB/worker → **luôn dùng pool**, không spawn per-request. Phân biệt rõ với `cluster`: cluster nhân bản cả app để tận dụng core cho *nhiều request*, worker_threads chia việc nặng của *một loại task*.

**💬 Cách dùng case này khi phỏng vấn:** Câu "Node xử lý CPU-bound thế nào?" → trình bày thang 3 nấc trên rồi kể case này như minh chứng đã từng đi từ nấc 1 lên nấc 2, kèm chi tiết transferable ArrayBuffer để ghi điểm độ sâu.

---

## ✅ Checklist tự kiểm tra

1. Tôi có vẽ và giải thích được đường đi của backpressure trong một pipeline 4 tầng (ai pause ai, tín hiệu gì, `highWaterMark` vai trò gì) không?
2. Tôi có viết được `pLimit` trong ~20 dòng từ trí nhớ, và giải thích vì sao phải truyền `() => fn()` thay vì promise đã chạy không?
3. Cho một triệu chứng "mọi endpoint chậm cùng lúc, CPU thấp", tôi có nêu được ngay 3 nghi phạm sync code và cách đo event loop lag để chứng minh không?
4. Tôi có ước lượng được memory cho 50K WebSocket connections và giải thích vì sao chỉ dùng 1 heartbeat timer thay vì 50K timer không?
5. Tôi có phân biệt rạch ròi khi nào dùng `cluster`, khi nào `worker_threads`, khi nào tách service + queue — kèm ví dụ workload cho từng cái không?
6. Với bài upload 5GB, tôi có làm được phép tính memory (partSize × queueSize × concurrent uploads) để chứng minh thiết kế fit RAM, và biết khi nào nên đề xuất presigned URL thay vì proxy không?
7. Tôi có ít nhất 1 con số thật (PayPal 35% latency / Netflix startup 40 phút → <1 phút) để dẫn chứng khi bàn "Node hợp loại workload nào" không?
