/**
 * Ngân hàng "🟢 Node.js" — LÝ THUYẾT CHUYÊN SÂU cho phỏng vấn Backend.
 * Event loop & libuv, stream & backpressure, module, cluster/worker_threads, Buffer,
 * EventEmitter, xử lý lỗi & vòng đời tiến trình, hiệu năng, bảo mật, HTTP.
 *
 * Mỗi câu: { id, topic, q, code?, options:[...], answer:idx, explain }
 */
window.NODE_QUIZ = [
  // ---------- Event loop & libuv ----------
  {
    id: 'node-loop-phases', topic: 'Event loop',
    q: 'Event loop của Node có các pha nào, theo đúng thứ tự mỗi vòng?',
    options: [
      'Chỉ có một hàng đợi callback duy nhất, chạy theo đúng thứ tự đăng ký từ trước tới sau',
      'timers → pending callbacks → idle/prepare → poll → check → close callbacks, lặp lại từ đầu',
      'poll → timers → check → microtask → render → close, mô phỏng đúng event loop của trình duyệt',
      'Mỗi callback được xếp vào một trong bốn hàng đợi ưu tiên tuỳ theo loại I/O sinh ra nó',
    ], answer: 1,
    explain: 'libuv chạy 6 pha: **timers** (`setTimeout`/`setInterval` tới hạn) → **pending callbacks** (một số callback I/O bị hoãn từ vòng trước) → **idle/prepare** (nội bộ) → **poll** (lấy sự kiện I/O mới, có thể BLOCK chờ ở đây) → **check** (`setImmediate`) → **close callbacks** (`socket.on("close")`). Giữa MỖI callback, Node vét sạch `process.nextTick` queue rồi tới microtask queue (Promise). Nhớ được thứ tự này là chìa khoá trả lời mọi câu hỏi về `setImmediate` vs `setTimeout`.',
  },
  {
    id: 'node-tick-immediate', topic: 'Event loop',
    q: '`process.nextTick` khác `setImmediate` thế nào?',
    options: [
      'Cả hai giống hệt nhau, `nextTick` chỉ là tên cũ được giữ lại cho tương thích ngược',
      '`nextTick` chạy ở pha timers còn `setImmediate` chạy ở pha poll của vòng lặp kế tiếp',
      '`nextTick` chạy NGAY sau operation hiện tại (trước cả Promise), `setImmediate` chạy ở pha check của vòng lặp',
      '`setImmediate` chạy trước `nextTick` vì nó được ưu tiên cao hơn trong hàng đợi nội bộ',
    ], answer: 2,
    explain: '`process.nextTick` KHÔNG thuộc event loop — nó là hàng đợi riêng được vét ngay sau operation hiện tại, TRƯỚC cả microtask của Promise. `setImmediate` là macrotask thật, chạy ở pha **check**. Vì nextTick ưu tiên tuyệt đối, đệ quy `nextTick` sẽ BỎ ĐÓI (starve) event loop — I/O không bao giờ được xử lý. Quy tắc thực dụng: cần hoãn tới sau vòng lặp hiện tại thì dùng `setImmediate`; `nextTick` chỉ dùng khi phải chạy trước mọi thứ khác (ví dụ phát sự kiện lỗi sau khi constructor return).',
  },
  {
    id: 'node-timeout-immediate', topic: 'Event loop',
    q: 'Trong callback của `fs.readFile`, `setTimeout(fn,0)` và `setImmediate(fn)` cái nào chạy trước?',
    options: [
      '`setImmediate` LUÔN trước, vì đang ở pha poll nên pha check tới ngay sau đó',
      '`setTimeout` luôn trước vì độ trễ 0ms nhỏ hơn nên timer tới hạn sớm hơn',
      'Không xác định được, thứ tự phụ thuộc vào tải máy nên có thể đổi giữa các lần chạy',
      'Cả hai chạy đồng thời vì cùng được xếp vào hàng đợi macrotask trong một vòng',
    ], answer: 0,
    explain: 'Đây là câu hỏi bẫy hai tầng. Ở **top-level** (ngoài I/O), thứ tự KHÔNG xác định — tuỳ hiệu năng máy lúc khởi động vòng lặp đầu tiên timer đã tới hạn hay chưa. Nhưng TRONG một callback I/O thì đang ở pha **poll**, mà pha kế ngay sau là **check** → `setImmediate` luôn chạy trước, `setTimeout` phải chờ vòng sau. Đó cũng là lý do khuyên dùng `setImmediate` khi cần "để dành việc cho sau" trong luồng I/O.',
  },
  {
    id: 'node-threadpool', topic: 'Event loop & libuv',
    q: 'Node "đơn luồng" nhưng vẫn làm nhiều việc song song — cơ chế nào?',
    options: [
      'V8 tự tách mỗi callback thành một luồng riêng ngay khi phát hiện tác vụ chạy quá lâu',
      'I/O mạng dùng epoll/kqueue bất đồng bộ của OS; còn fs/crypto/zlib đẩy sang thread pool libuv (mặc định 4 luồng)',
      'Mọi tác vụ bất đồng bộ đều được libuv đẩy sang thread pool, kích thước pool đúng bằng số core CPU',
      'Node tạo một process con cho mỗi request rồi gom kết quả lại qua kênh IPC nội bộ giữa chúng',
    ], answer: 1,
    explain: 'Phân biệt hai đường: (1) I/O MẠNG (socket, HTTP) dùng cơ chế bất đồng bộ của kernel — epoll/kqueue/IOCP, KHÔNG tốn thread; (2) một số tác vụ không có API async của OS thì libuv chạy trên THREAD POOL 4 luồng mặc định: `fs.*`, `crypto.pbkdf2/scrypt`, `zlib`, và `dns.lookup` (nhưng `dns.resolve` thì không). Hệ quả thực tế: 5 lệnh `pbkdf2` song song thì cái thứ 5 phải xếp hàng. Chỉnh bằng `UV_THREADPOOL_SIZE` (tối đa 1024) — tăng vô tội vạ thì tranh chấp CPU, không nhanh hơn.',
  },
  {
    id: 'node-cpu-block', topic: 'Event loop',
    q: 'Vì sao một vòng lặp tính toán nặng lại làm CẢ server Node ngừng phản hồi?',
    options: [
      'Vì Node giới hạn mỗi callback tối đa 100ms rồi buộc phải huỷ để nhường lượt',
      'Vì V8 dừng để chạy GC toàn phần khi phát hiện có tác vụ tính toán kéo dài',
      'Vì code JS chạy trên MỘT luồng — hàm chưa return thì event loop không thể lấy sự kiện I/O nào',
      'Vì thread pool của libuv bị chiếm hết nên không còn luồng nào phục vụ request mới',
    ], answer: 2,
    explain: 'Event loop chỉ tiến được khi call stack RỖNG. Một hàm CPU-bound (vòng lặp lớn, `JSON.parse` file khổng lồ, regex catastrophic backtracking, `bcrypt` đồng bộ, sắp xếp mảng triệu phần tử) giữ stack → mọi request đang chờ bị treo, health check timeout, load balancer đá pod ra. Cách chữa: đẩy sang `worker_threads`, tách ra service/queue riêng, chia nhỏ công việc và nhả qua `setImmediate`, hoặc dùng native addon bất đồng bộ. Đo bằng event loop lag (`perf_hooks.monitorEventLoopDelay`).',
  },
  {
    id: 'node-lag', topic: 'Hiệu năng',
    q: 'Chỉ số "event loop lag" nói lên điều gì?',
    options: [
      'Thời gian trung bình một request HTTP đi từ client tới server và quay về',
      'Độ trễ giữa lúc callback ĐÁNG LẼ chạy và lúc thực sự chạy — cao nghĩa là loop bị nghẽn',
      'Số lượng callback đang xếp hàng chờ trong hàng đợi macrotask tại một thời điểm',
      'Thời gian V8 dừng ứng dụng để chạy garbage collection trong mỗi chu kỳ thu gom',
    ], answer: 1,
    explain: 'Đặt một timer định kỳ rồi đo chênh lệch giữa thời điểm dự kiến và thời điểm chạy thật. Lag thấp (<10ms) = loop khoẻ; lag hàng trăm ms = có tác vụ đồng bộ nặng hoặc thread pool nghẽn, và mọi request đều chậm theo. Đây là metric SỐ MỘT cần cảnh báo cho service Node — quan trọng hơn CPU%, vì CPU 40% mà lag 500ms vẫn là hỏng. Đo chuẩn bằng `perf_hooks.monitorEventLoopDelay()` (histogram) hoặc thư viện như `event-loop-lag`.',
  },
  // ---------- Streams ----------
  {
    id: 'node-stream-why', topic: 'Stream',
    q: 'Vì sao đọc file 2GB bằng stream lại tốt hơn `fs.readFile`?',
    options: [
      'Vì stream nén dữ liệu lại trước khi đọc nên tổng số byte cần xử lý ít hơn hẳn',
      'Vì `readFile` chạy đồng bộ và chặn event loop, còn stream thì bất đồng bộ',
      'Vì stream xử lý theo TỪNG CHUNK — bộ nhớ chỉ giữ một buffer nhỏ, và byte đầu tới tay client sớm hơn',
      'Vì stream dùng thread pool riêng nên đọc song song nhiều phần của file cùng lúc',
    ], answer: 2,
    explain: 'Hai lợi ích: **bộ nhớ** — `readFile` nạp NGUYÊN file vào một Buffer (2GB × số request đồng thời → OOM, và vượt giới hạn buffer tối đa của V8); stream chỉ giữ ~64KB mỗi lần. **Thời gian** — stream cho TTFB thấp, client nhận byte đầu ngay chứ không chờ đọc hết. `fs.readFile` vẫn là bất đồng bộ (không chặn loop), nên đáp án "chặn event loop" là sai — vấn đề nằm ở BỘ NHỚ. Chuẩn: `pipeline(fs.createReadStream(f), res)`.',
  },
  {
    id: 'node-backpressure', topic: 'Stream',
    q: 'Backpressure trong stream là gì và Node báo hiệu nó thế nào?',
    options: [
      'Là lỗi khi stream bị đóng sớm; Node báo bằng cách phát sự kiện `error` với mã EPIPE',
      'Là cơ chế nén dữ liệu khi buffer đầy; Node tự bật zlib để giảm kích thước chunk',
      'Là khi bên ĐỌC nhanh hơn bên GHI; `write()` trả `false` khi vượt highWaterMark, phải chờ sự kiện `drain`',
      'Là độ trễ mạng giữa hai máy; Node đo bằng `stream.latency` rồi tự điều chỉnh tốc độ',
    ], answer: 2,
    explain: 'Nguồn bơm nhanh hơn đích tiêu thụ → dữ liệu dồn trong buffer nội bộ, RAM phình tới khi OOM. Hợp đồng của Node: `writable.write(chunk)` trả `false` khi lượng buffer vượt `highWaterMark` (mặc định 16KB cho stream thường, 64KB cho fs) — lúc đó phải NGỪNG ghi và chờ sự kiện `drain`. `pipe()`/`pipeline()` xử lý việc này tự động (tự `pause()`/`resume()` nguồn); tự viết vòng `while` gọi `write()` mà bỏ qua giá trị trả về là lỗi kinh điển gây OOM.',
  },
  {
    id: 'node-pipeline', topic: 'Stream',
    q: 'Vì sao nên dùng `stream.pipeline()` thay cho `.pipe()` nối chuỗi?',
    options: [
      '`pipeline` truyền dữ liệu nhanh hơn nhờ bỏ qua bước sao chép buffer trung gian',
      '`pipe()` KHÔNG lan truyền lỗi, mắt xích hỏng thì các stream kia không được dọn → rò rỉ fd',
      '`pipe()` đã bị loại bỏ khỏi Node 18 nên code cũ sẽ ném lỗi khi nâng phiên bản',
      '`pipeline` cho phép nối nhiều stream còn `pipe()` chỉ nối được đúng hai stream với nhau',
    ], answer: 1,
    explain: 'Với `a.pipe(b).pipe(c)`, nếu `b` lỗi thì `a` và `c` KHÔNG được đóng — file descriptor/socket rò rỉ, và lỗi không bắt được thì crash. `pipeline(a, b, c, cb)` (hoặc `require("stream/promises").pipeline`) lan truyền lỗi tới callback và `destroy()` mọi stream trong chuỗi. Đây là câu hỏi phân loại thật/giả rất hay dùng cho vị trí Node senior. Bonus: `pipeline` nhận cả async generator làm mắt xích biến đổi.',
  },
  {
    id: 'node-stream-mode', topic: 'Stream',
    q: 'Readable stream ở chế độ flowing và paused khác nhau thế nào?',
    options: [
      'Flowing đọc từ bộ nhớ còn paused đọc trực tiếp từ đĩa nên chậm hơn nhiều lần',
      'Flowing là chế độ mặc định của mọi readable stream, paused phải bật thủ công',
      'Flowing: dữ liệu tự ĐẨY ra qua sự kiện `data`/`pipe`; paused: bạn chủ động KÉO bằng `read()`',
      'Flowing chỉ dùng cho object mode, còn paused chỉ dùng được với Buffer nhị phân',
    ], answer: 2,
    explain: 'Stream sinh ra ở chế độ **paused**; gắn listener `data`, gọi `pipe()` hoặc `resume()` thì chuyển sang **flowing** (đẩy chunk ra liên tục). Ở paused, bạn nghe `readable` rồi tự gọi `stream.read()` — kiểm soát nhịp tốt hơn. Bẫy: gắn `data` listener sớm rồi mới xử lý bất đồng bộ sẽ làm MẤT dữ liệu vì stream đã chảy trước khi bạn sẵn sàng; và trộn `pipe()` với `data` listener dễ mất chunk. Cách hiện đại & an toàn nhất: `for await (const chunk of stream)` — có backpressure sẵn.',
  },
  {
    id: 'node-transform', topic: 'Stream',
    q: 'Bốn loại stream cơ bản của Node là gì?',
    options: [
      'Input, Output, Buffer và Pipe — tương ứng với bốn hướng luân chuyển dữ liệu',
      'Readable (đọc), Writable (ghi), Duplex (hai chiều độc lập), Transform (duplex có biến đổi dữ liệu)',
      'File, Network, Process và Memory — phân theo nguồn dữ liệu mà stream lấy vào',
      'Sync, Async, Buffered và Streaming — phân theo cách dữ liệu được đưa tới nơi nhận',
    ], answer: 1,
    explain: 'Readable (`fs.createReadStream`, `req`), Writable (`fs.createWriteStream`, `res`), Duplex — đọc và ghi ĐỘC LẬP với nhau (TCP socket), Transform — duplex mà đầu ra là hàm của đầu vào (`zlib.createGzip`, `crypto.createCipheriv`). Tự viết Transform chỉ cần cài `_transform(chunk, enc, cb)` và tuỳ chọn `_flush(cb)`. Ứng dụng backend hay gặp: đọc CSV lớn → parse → biến đổi → ghi DB theo lô, toàn bộ chỉ tốn vài chục MB RAM.',
  },
  {
    id: 'node-highwater', topic: 'Stream',
    q: '`highWaterMark` quy định điều gì?',
    options: [
      'Số byte tối đa của một chunk, chunk lớn hơn sẽ bị stream cắt nhỏ ra trước khi phát',
      'Tổng số byte tối đa mà stream được phép xử lý trong suốt vòng đời của nó',
      'Ngưỡng buffer nội bộ: vượt thì `write()` trả `false` (writable) / ngừng đọc thêm (readable)',
      'Số lượng listener tối đa được phép gắn vào một stream trước khi Node cảnh báo rò rỉ',
    ], answer: 2,
    explain: '`highWaterMark` là ngưỡng của HÀNG ĐỢI nội bộ, không phải kích thước chunk (chunk lớn hơn ngưỡng vẫn được ghi, chỉ là `write` trả `false` ngay). Mặc định: 16KB stream thường, 64KB fs stream, còn object mode thì đếm theo SỐ OBJECT (mặc định 16). Tăng lên thì thông lượng tốt hơn nhưng tốn RAM; giảm xuống thì tiết kiệm RAM nhưng nhiều lần chuyển ngữ cảnh hơn. Đây là "van" điều tiết backpressure.',
  },
  // ---------- Module ----------
  {
    id: 'node-require-cache', topic: 'Module',
    q: '`require()` cùng một module hai lần thì chuyện gì xảy ra?',
    options: [
      'Module được chạy lại từ đầu mỗi lần require, tạo instance hoàn toàn độc lập',
      'Node ném cảnh báo "duplicate module" và trả về `undefined` cho lần require thứ hai',
      'File chỉ được thực thi MỘT lần; các lần sau lấy từ `require.cache` — nên module là singleton',
      'Node so sánh nội dung file, nếu thay đổi thì chạy lại, không thì trả về bản cache cũ',
    ], answer: 2,
    explain: 'Node cache theo đường dẫn tuyệt đối đã resolve, trong `require.cache`. Hệ quả quan trọng: mọi biến top-level của module là SINGLETON toàn tiến trình — cực tiện cho DB pool, config, logger, nhưng là bẫy trong test (state rò rỉ giữa các test case, phải `delete require.cache[...]` hoặc `jest.resetModules()`). Lưu ý cùng một package cài ở hai `node_modules` khác nhau sẽ là HAI instance khác nhau — nguồn bug "instanceof trả false" khó hiểu.',
  },
  {
    id: 'node-module-wrapper', topic: 'Module',
    q: 'Vì sao trong CommonJS lại có sẵn `exports`, `require`, `__dirname` mà không phải import?',
    options: [
      'Vì Node BỌC mỗi file trong một hàm `(exports, require, module, __filename, __dirname) => {...}`',
      'Vì chúng là biến global thật, được gán vào `globalThis` khi Node khởi động tiến trình',
      'Vì V8 thêm chúng vào scope chain của mọi file `.js` khi biên dịch mã nguồn',
      'Vì Node inject một dòng `const {require, exports} = process` vào đầu mỗi file trước khi chạy',
    ], answer: 0,
    explain: 'Module wrapper: Node bọc mã nguồn của file vào một hàm rồi gọi nó. Nhờ vậy (1) biến top-level của module KHÔNG lọt ra global (khác `<script>` trên trình duyệt), (2) mỗi file có `module`/`exports`/`__dirname` riêng. Điều này cũng giải thích vì sao `this` ở top-level CJS là `module.exports` (một object rỗng) chứ không phải `globalThis`. ES module không có wrapper này — nên không có `__dirname`, phải dùng `import.meta.url` + `fileURLToPath`.',
  },
  {
    id: 'node-exports-gotcha', topic: 'Module',
    q: 'Vì sao `exports = { foo }` không xuất được gì, còn `module.exports = { foo }` thì được?',
    options: [
      'Vì `exports` chỉ nhận hàm, gán một object vào nó sẽ bị Node bỏ qua một cách im lặng',
      'Vì `exports` là một bản sao chỉ-đọc, mọi phép gán đè lên nó đều bị chặn ở strict mode',
      'Vì `exports` chỉ là biến trỏ TỚI `module.exports`; gán lại chỉ đổi biến cục bộ, thứ trả về vẫn là `module.exports`',
      'Vì thứ tự thực thi: `exports` được Node đọc trước khi thân module chạy nên gán sau không kịp',
    ], answer: 2,
    explain: 'Ban đầu `exports === module.exports`. `exports.foo = 1` sửa CHUNG object nên có tác dụng; nhưng `exports = {...}` chỉ trỏ biến cục bộ sang object mới, còn Node vẫn trả về `module.exports` cũ (rỗng). Quy tắc an toàn: cần xuất nguyên một object/class/hàm thì luôn dùng `module.exports = ...`; chỉ dùng `exports.x = ...` khi bổ sung từng field. Đây là câu hỏi kiểm tra hiểu tham chiếu ở mức module rất hay gặp.',
  },
  {
    id: 'node-esm-node', topic: 'Module',
    q: 'Trong Node, dùng ESM (`import`) có ràng buộc gì so với CommonJS?',
    options: [
      'ESM chỉ chạy được khi build qua Babel/tsc, Node chưa hỗ trợ chạy trực tiếp file .mjs',
      'ESM cần `"type":"module"` hoặc đuôi `.mjs`, phải ghi rõ đuôi file khi import, không có `__dirname`/`require`',
      'ESM không import được package CommonJS nào từ npm, phải chờ package publish bản ESM riêng',
      'ESM bắt buộc mọi import phải nằm trong khối `try/catch` vì việc nạp module là bất đồng bộ',
    ], answer: 1,
    explain: 'Bật ESM bằng `"type": "module"` trong package.json hoặc đuôi `.mjs`. Khác biệt phải nhớ: import relative phải ghi ĐỦ đuôi (`./a.js`); không có `__dirname`/`__filename`/`require` (thay bằng `import.meta.url`, `import.meta.dirname` từ Node 20.11, hoặc `createRequire`); có top-level await; import là bất đồng bộ. ESM import được CJS (lấy `module.exports` làm default export, named export thì Node cố phân tích tĩnh). Chiều ngược lại — CJS `require()` một file ESM — chỉ được từ Node 22+ và module đó không được có top-level await; trước đó phải dùng `await import()`.',
  },
  {
    id: 'node-circular-node', topic: 'Module',
    q: 'Trong CommonJS, import vòng A ↔ B gây triệu chứng gì?',
    options: [
      'Node phát hiện vòng và ném lỗi `ERR_CIRCULAR_DEPENDENCY` ngay lúc khởi động ứng dụng',
      'Module bị nạp lặp vô hạn cho tới khi tràn call stack và tiến trình bị kill',
      'Bên nạp sau nhận `module.exports` NỬA CHỪNG (thường là `{}`) → lỗi "is not a function" ở top-level',
      'Cả hai module đều bị bỏ qua và giá trị require trả về `undefined` để tránh treo tiến trình',
    ], answer: 2,
    explain: 'Node đưa module vào cache TRƯỚC khi chạy xong thân file, nên vòng không lặp vô hạn — nhưng bên gọi lại nhận được `module.exports` ở trạng thái dở dang. Nếu bạn destructure hoặc gọi ngay ở top-level thì nổ (`undefined is not a function`); nếu chỉ dùng bên trong hàm chạy sau này thì thường vẫn ổn — đó là lý do bug này hay ẩn nấp rồi lộ ra khi refactor. Chữa: tách phần dùng chung ra module thứ ba, chuyển sang lazy `require()` trong hàm, hoặc dùng dependency injection.',
  },
  // ---------- Cluster, worker, child process ----------
  {
    id: 'node-cluster-vs-worker', topic: 'Cluster & Worker',
    q: '`cluster` và `worker_threads` khác nhau thế nào và dùng cho việc gì?',
    options: [
      'Hai module giống hệt nhau, `worker_threads` chỉ là bản viết lại hiện đại hơn của `cluster`',
      '`cluster` tạo THREAD chia sẻ chung bộ nhớ, còn `worker_threads` tạo PROCESS riêng biệt hoàn toàn',
      '`cluster` nhân bản TIẾN TRÌNH dùng chung port; `worker_threads` là luồng trong cùng tiến trình, hợp tác vụ CPU',
      '`cluster` chỉ dùng được trên Linux, còn `worker_threads` thì chạy được trên mọi hệ điều hành',
    ], answer: 2,
    explain: '`cluster` fork nhiều PROCESS con, mỗi cái có V8 + event loop riêng, cùng lắng nghe một port (master phân phối kết nối) → mở rộng theo số core cho web server, và một process chết không kéo theo cái khác. `worker_threads` tạo LUỒNG trong cùng process, khởi động nhẹ hơn, chia sẻ được bộ nhớ qua `SharedArrayBuffer`/transfer `ArrayBuffer` → hợp tác vụ CPU nặng (nén ảnh, tính toán, parse file lớn). Thực tế production hay dùng PM2/Kubernetes thay `cluster` thủ công. Lưu ý: cluster KHÔNG giúp gì cho tác vụ CPU trong một request đơn lẻ.',
  },
  {
    id: 'node-worker-share', topic: 'Cluster & Worker',
    q: 'Dữ liệu truyền giữa main thread và worker_thread hoạt động ra sao?',
    options: [
      'Worker truy cập trực tiếp được mọi biến của main thread vì cả hai cùng nằm trong một tiến trình',
      'Mặc định `postMessage` COPY dữ liệu (structured clone); chia sẻ thật thì phải dùng `SharedArrayBuffer`',
      'Chỉ truyền được chuỗi JSON, mọi kiểu dữ liệu khác đều phải tự serialize thủ công trước khi gửi',
      'Dữ liệu được chia sẻ tự động qua bộ nhớ chung, nên phải tự khoá bằng mutex khi ghi',
    ], answer: 1,
    explain: 'Worker có heap V8 RIÊNG — không thấy biến của main thread. `postMessage(value)` dùng structured clone: copy được object/Map/Set/Date/TypedArray nhưng KHÔNG copy được function, class instance (mất prototype), hay closure. Object lớn thì chi phí copy đáng kể — lúc đó dùng `SharedArrayBuffer` (chia sẻ thật, đồng bộ bằng `Atomics`) hoặc transfer list để "chuyển quyền sở hữu" `ArrayBuffer` mà không copy (bên gửi mất quyền truy cập). Truyền dữ liệu ban đầu qua `workerData`.',
  },
  {
    id: 'node-child-process', topic: 'Cluster & Worker',
    q: '`spawn`, `exec` và `fork` khác nhau ở đâu?',
    options: [
      '`spawn` trả stream dữ liệu ra dần; `exec` chạy qua SHELL và gom hết output vào buffer; `fork` chạy file Node có kênh IPC',
      '`spawn` dành cho lệnh hệ thống, `exec` dành riêng cho file Node, còn `fork` thì nhân bản tiến trình hiện tại',
      'Ba hàm hoàn toàn tương đương nhau, chỉ khác ở cách truyền tham số dòng lệnh vào tiến trình con',
      '`exec` nhanh nhất vì không tạo tiến trình mới, `spawn` và `fork` đều phải khởi động lại V8',
    ], answer: 0,
    explain: '`spawn`: không qua shell mặc định, trả stream — hợp với output lớn/chạy lâu. `exec`: chạy qua `/bin/sh`, gom toàn bộ stdout vào buffer rồi mới gọi callback → tiện cho lệnh ngắn, nhưng output lớn sẽ vượt `maxBuffer` và **rủi ro command injection** nếu ghép chuỗi từ input người dùng (dùng `execFile`/`spawn` với mảng args thay thế). `fork`: trường hợp riêng của spawn để chạy file Node, tự dựng kênh IPC nên hai bên `send()`/`on("message")` được — chính là nền của `cluster`.',
  },
  // ---------- EventEmitter ----------
  {
    id: 'node-ee-sync', topic: 'EventEmitter',
    q: '`emitter.emit("x")` gọi các listener theo cách nào?',
    options: [
      'Bất đồng bộ qua microtask queue, nên listener luôn chạy sau code hiện tại',
      'ĐỒNG BỘ và theo đúng thứ tự đăng ký — `emit` chỉ trả về sau khi mọi listener chạy xong',
      'Song song trên thread pool để listener chậm không làm ảnh hưởng lẫn nhau',
      'Bất đồng bộ qua `setImmediate`, mỗi listener chạy trong một vòng lặp riêng biệt',
    ], answer: 1,
    explain: 'EventEmitter là ĐỒNG BỘ: `emit` lặp qua mảng listener và gọi lần lượt, xong hết mới return (trả `true` nếu có ít nhất một listener). Hệ quả: listener nặng làm chậm chính nơi gọi `emit`; listener ném lỗi sẽ nổi ngược lên chỗ `emit`. Muốn hoãn thì tự bọc `setImmediate`. Còn với listener **async**, `emit` KHÔNG chờ Promise — lỗi bên trong thành unhandled rejection; cần chờ thì dùng `events.once()` hoặc chuyển sang async iterator (`events.on()`).',
  },
  {
    id: 'node-ee-error', topic: 'EventEmitter',
    q: 'Điều gì xảy ra khi emit sự kiện `"error"` mà không có listener nào?',
    options: [
      'Sự kiện bị bỏ qua im lặng như mọi sự kiện khác không có listener đăng ký',
      'Node ghi log cảnh báo ra stderr rồi tiếp tục chạy bình thường không gián đoạn',
      'Node NÉM lỗi đó ra — không ai bắt thì tiến trình crash (`uncaughtException`)',
      'Node tự động chuyển sự kiện đó thành một unhandled promise rejection để xử lý sau',
    ], answer: 2,
    explain: '`"error"` là sự kiện ĐẶC BIỆT duy nhất được đối xử khác: không có listener thì EventEmitter `throw` chính error object đó, thường làm sập tiến trình. Vì vậy MỌI stream/socket/emitter dùng thật đều phải gắn `.on("error", ...)` — đây là nguyên nhân crash production phổ biến bậc nhất của Node (ví dụ client ngắt kết nối giữa chừng gây `ECONNRESET` trên response stream). Từ Node 15+, có thể dùng `captureRejections: true` để lỗi của listener async cũng thành sự kiện `error`.',
  },
  {
    id: 'node-ee-leak', topic: 'EventEmitter',
    q: 'Cảnh báo "MaxListenersExceededWarning: 11 listeners added" nghĩa là gì?',
    options: [
      'Node đã chặn listener thứ 11 để bảo vệ bộ nhớ, listener đó sẽ không bao giờ chạy',
      'Emitter vượt ngưỡng 10 listener mặc định — thường là DẤU HIỆU quên gỡ listener (rò rỉ), không phải giới hạn cứng',
      'Có 11 sự kiện khác nhau được đăng ký trên cùng một emitter, nên hiệu năng bị giảm',
      'Emitter đang bị dùng đồng thời bởi nhiều luồng nên Node cảnh báo nguy cơ tranh chấp',
    ], answer: 1,
    explain: 'Ngưỡng 10 chỉ là HEURISTIC cảnh báo rò rỉ, listener thứ 11 vẫn chạy bình thường. Nó thường báo đúng bệnh: gắn listener trong mỗi request/mỗi lần render mà không `removeListener`/`off` — mảng listener phình dần, kéo theo closure và object không được GC. Cách xử lý ĐÚNG là tìm chỗ quên gỡ (hoặc dùng `once`, hoặc `AbortSignal` để tự gỡ), chứ không phải nâng `setMaxListeners(100)` cho im tiếng.',
  },
  // ---------- Lỗi & vòng đời tiến trình ----------
  {
    id: 'node-try-async', topic: 'Xử lý lỗi',
    q: 'Vì sao `try/catch` không bắt được lỗi ném ra trong callback bất đồng bộ?',
    options: [
      'Vì callback chạy trong một call stack MỚI ở tick sau — lúc đó khối try/catch đã kết thúc',
      'Vì Node chỉ cho phép try/catch bắt lỗi đồng bộ trong cùng một file module duy nhất',
      'Vì lỗi bất đồng bộ luôn được chuyển thành sự kiện nên không thể ném ra dưới dạng exception',
      'Vì V8 xoá thông tin stack trace của lỗi khi callback được đưa vào hàng đợi macrotask',
    ], answer: 0,
    explain: 'try/catch bắt theo NGĂN XẾP, không theo thời gian. Khi callback chạy ở tick sau, frame chứa `try` đã pop khỏi stack từ lâu → lỗi nổi thẳng lên thành `uncaughtException`. Đây là lý do callback theo quy ước `(err, result)` và Promise ra đời. Với `async/await` thì `try/catch` LẠI dùng được, vì `await` nối stack logic qua microtask. Lưu ý bẫy: `try { setTimeout(() => { throw x }) } catch {}` vẫn không bắt được, kể cả trong hàm async.',
  },
  {
    id: 'node-uncaught', topic: 'Xử lý lỗi',
    q: 'Xử lý `process.on("uncaughtException")` thế nào là ĐÚNG chuẩn production?',
    options: [
      'Bắt lỗi rồi cho tiến trình chạy tiếp bình thường — như vậy server không bao giờ downtime',
      'Không bao giờ đăng ký handler này, vì đăng ký là vi phạm chuẩn Node và bị deprecate',
      'Ghi log + metric, dừng nhận request mới, đóng tài nguyên rồi THOÁT — để supervisor khởi động lại',
      'Chuyển lỗi vào một hàng đợi để thử chạy lại đoạn code đã lỗi sau vài giây',
    ], answer: 2,
    explain: 'Sau `uncaughtException`, tiến trình ở trạng thái KHÔNG XÁC ĐỊNH: transaction dở dang, biến sai, có thể rò rỉ tài nguyên. Docs Node nói rõ: dùng handler này để "cleanup rồi thoát", không phải để "chạy tiếp". Chuẩn: log đầy đủ + gửi Sentry → `server.close()` để hết request đang chạy → `process.exit(1)`, kèm timeout ép thoát; PM2/Kubernetes/systemd lo khởi động lại. Cùng cách xử lý cho `unhandledRejection` (Node ≥15 mặc định crash luôn). Ngược lại, lỗi NGHIỆP VỤ dự đoán được thì phải bắt tại chỗ, không để rơi tới đây.',
  },
  {
    id: 'node-graceful', topic: 'Vòng đời tiến trình',
    q: 'Graceful shutdown khi nhận SIGTERM gồm những bước nào?',
    options: [
      'Gọi `process.exit(0)` ngay lập tức để container được thay thế nhanh nhất có thể',
      'Bỏ qua SIGTERM và chỉ xử lý SIGKILL, vì SIGKILL mới là tín hiệu dừng thật sự của hệ điều hành',
      'Ngừng nhận kết nối mới (`server.close`), chờ request đang chạy xong, đóng DB/queue rồi mới thoát',
      'Lưu toàn bộ state trong RAM xuống đĩa rồi khôi phục lại nguyên vẹn ở lần khởi động sau',
    ], answer: 2,
    explain: 'Deploy/scale-down đều bắt đầu bằng SIGTERM. Nếu thoát ngay, request đang xử lý bị đứt → user thấy lỗi 502. Trình tự chuẩn: (1) đánh dấu readiness probe FAIL để LB ngừng gửi request mới; (2) `server.close()` — không nhận kết nối mới, kết nối keep-alive cũ vẫn chạy nốt; (3) đóng pool DB, flush producer Kafka, commit offset; (4) `process.exit(0)`. Luôn kèm `setTimeout` ép thoát (~10–30s, phải NGẮN hơn `terminationGracePeriodSeconds` của K8s). Lưu ý SIGKILL không bắt được — đó chính là lý do phải xử lý SIGTERM tử tế.',
  },
  {
    id: 'node-als', topic: 'Xử lý lỗi & context',
    q: '`AsyncLocalStorage` giải quyết bài toán gì?',
    options: [
      'Lưu dữ liệu vào localStorage của trình duyệt ngay từ phía server để hai bên chia sẻ được với nhau',
      'Giữ context (requestId, user, trace) xuyên suốt chuỗi async của MỘT request, khỏi truyền tham số khắp nơi',
      'Cache kết quả của hàm bất đồng bộ trong bộ nhớ để những lần gọi sau trả về được ngay lập tức',
      'Đồng bộ hoá truy cập biến dùng chung giữa các worker thread bằng cơ chế khoá',
    ], answer: 1,
    explain: 'Node không có thread-local storage như Java (`ThreadLocal`) vì mọi request dùng chung một luồng. `AsyncLocalStorage` (dựng trên `async_hooks`) tạo một "kho" gắn theo CHUỖI BẤT ĐỒNG BỘ: `als.run(store, fn)` thì mọi hàm async được gọi bên trong đọc được `als.getStore()`. Ứng dụng chuẩn: middleware sinh `requestId`/`traceId` rồi logger tự gắn vào mọi dòng log, hay giữ transaction DB hiện hành. Đánh đổi: có chi phí hiệu năng (nhỏ hơn nhiều so với thời `async_hooks` thuần) và context có thể mất khi đi qua thư viện dùng pool callback cũ.',
  },
  {
    id: 'node-err-operational', topic: 'Xử lý lỗi',
    q: 'Phân biệt "operational error" và "programmer error" quan trọng vì sao?',
    options: [
      'Operational là lỗi dự đoán được (mất mạng, input sai, hết đĩa) → xử lý & retry; programmer error là BUG → nên để crash và sửa code',
      'Operational error do người dùng gây ra còn programmer error do lập trình viên, cả hai đều phải retry giống nhau',
      'Đây chỉ là cách phân loại để ghi log cho đẹp, cách xử lý runtime hoàn toàn không khác nhau',
      'Operational error luôn là lỗi 5xx còn programmer error luôn là lỗi 4xx trong HTTP API',
    ], answer: 0,
    explain: 'Operational: mất kết nối DB, timeout, input không hợp lệ, hết quota — CHỜ ĐỢI được, nên xử lý cụ thể (retry có backoff, circuit breaker, trả 4xx/503 rõ ràng). Programmer error: `undefined is not a function`, gọi sai API, quên await — là BUG; "bắt rồi chạy tiếp" chỉ giấu lỗi và làm state hỏng lan rộng, tốt hơn là để crash + restart + alert rồi sửa. Ranh giới này (Joyent Error Handling guide) quyết định bạn viết `catch` ở đâu — hỏi rất nhiều ở vị trí senior.',
  },
  // ---------- HTTP & web ----------
  {
    id: 'node-req-stream', topic: 'HTTP',
    q: 'Trong `http.createServer((req,res)=>{})`, `req` bản chất là gì?',
    options: [
      'Một object thuần đã chứa sẵn `body` được Node parse tự động từ nội dung request',
      'Một Readable STREAM — body phải tự đọc theo chunk (hoặc dùng middleware body-parser)',
      'Một Promise sẽ resolve thành nội dung request khi toàn bộ dữ liệu đã tới nơi',
      'Một Buffer chứa toàn bộ request thô, kể cả header lẫn body, chưa được phân tách',
    ], answer: 1,
    explain: '`req` là `IncomingMessage` — một Readable stream; header đã parse sẵn nhưng BODY thì chưa (Node core cố tình không parse để không tốn RAM và cho phép xử lý upload lớn theo dòng). Muốn có body phải gom chunk thủ công, hoặc dùng `express.json()`/`body-parser`. `res` là Writable stream. Hiểu điều này giải thích được: vì sao stream file upload thẳng lên S3 mà không tốn RAM, vì sao đọc body hai lần thì lần sau rỗng, và vì sao phải giới hạn kích thước body để chống tấn công nuốt RAM.',
  },
  {
    id: 'node-keepalive', topic: 'HTTP',
    q: 'Vì sao gọi API ngoài trong Node nên bật HTTP keep-alive agent?',
    options: [
      'Vì keep-alive nén payload nên tiết kiệm băng thông cho mỗi lời gọi ra ngoài',
      'Vì không có nó thì Node giới hạn tối đa 5 request đồng thời tới cùng một host',
      'Vì TÁI DÙNG kết nối TCP/TLS, tránh bắt tay lại mỗi request — giảm mạnh độ trễ và cạn port ephemeral',
      'Vì keep-alive tự động thử lại request khi gặp lỗi mạng tạm thời như ECONNRESET',
    ], answer: 2,
    explain: 'Không keep-alive thì mỗi request phải bắt tay TCP (1 RTT) + TLS (1–2 RTT) rồi đóng — với service gọi nhau nội bộ hàng nghìn lần/giây, đó là độ trễ khổng lồ và nguy cơ cạn cổng ephemeral / đầy TIME_WAIT. Bật bằng `new http.Agent({ keepAlive: true, maxSockets })` (undici/fetch của Node đã bật sẵn pool). Nhớ chỉnh `maxSockets` hợp lý và đặt `keepAliveMsecs` NGẮN hơn idle timeout của phía server/LB, nếu không sẽ dính lỗi ECONNRESET do dùng lại socket vừa bị đầu kia đóng.',
  },
  {
    id: 'node-timeout-http', topic: 'HTTP',
    q: 'Vì sao mọi lời gọi HTTP ra ngoài đều phải đặt timeout?',
    options: [
      'Vì Node mặc định không có timeout nên request treo giữ socket + bộ nhớ vô hạn, gây lan truyền sự cố',
      'Vì mặc định Node timeout sau 2 phút, quá ngắn cho các API xử lý dữ liệu lớn',
      'Vì timeout giúp giảm chi phí băng thông khi bên kia trả về dữ liệu quá lớn',
      'Vì không có timeout thì Node không thể ghi được metric thời gian phản hồi của request',
    ], answer: 0,
    explain: 'Không timeout, một dependency chậm sẽ giữ socket + Promise + bộ nhớ vô thời hạn; request dồn lại cho tới khi hết socket/RAM — sự cố của họ trở thành sự cố của bạn (cascading failure). Đặt timeout ở nhiều tầng: kết nối, đọc dữ liệu, và tổng thể (`AbortSignal.timeout(ms)` với fetch). Kết hợp cùng retry có exponential backoff + jitter (chỉ retry thao tác idempotent), circuit breaker, và bulkhead giới hạn số request đồng thời cho mỗi dependency.',
  },
  {
    id: 'node-cluster-sticky', topic: 'HTTP',
    q: 'Vì sao state trong RAM (session, cache cục bộ) là lựa chọn tồi khi chạy nhiều instance Node?',
    options: [
      'Vì bộ nhớ của Node bị giới hạn cứng 512MB nên không chứa nổi session của nhiều người dùng',
      'Vì mỗi process/pod có RAM RIÊNG — request lần sau vào instance khác sẽ không thấy state đó',
      'Vì V8 tự xoá các biến toàn cục sau mỗi chu kỳ GC nên state không tồn tại được lâu',
      'Vì Node không cho phép giữ object trong bộ nhớ lâu hơn thời gian sống của một request',
    ], answer: 1,
    explain: 'Cluster/K8s chạy N tiến trình độc lập, load balancer rải request luân phiên → session lưu trong RAM của pod A thì request kế vào pod B là mất, cache cục bộ thì mỗi pod một phiên bản (không nhất quán), và scale-down/deploy là bay sạch. Giải pháp 12-factor: giữ tiến trình STATELESS — session/cache đẩy sang Redis, file lên S3, job lên queue. Nếu buộc phải dính vào một instance thì cần sticky session, nhưng nó phá cân bằng tải và vẫn mất khi pod chết.',
  },
  // ---------- Hiệu năng & bộ nhớ ----------
  {
    id: 'node-memleak', topic: 'Bộ nhớ',
    q: 'Nguyên nhân rò rỉ bộ nhớ phổ biến nhất trong ứng dụng Node là gì?',
    options: [
      'Do V8 không có garbage collector đủ tốt cho các ứng dụng chạy dài ngày liên tục trên server',
      'Do dùng quá nhiều Promise, mỗi Promise chiếm một lượng bộ nhớ cố định không được giải phóng',
      'Do object vẫn REACHABLE ngoài ý muốn: cache phình mãi, listener/interval chưa gỡ, closure giữ dữ liệu lớn',
      'Do đọc file bằng stream mà quên gọi `close`, khiến buffer nội bộ không được thu hồi',
    ], answer: 2,
    explain: 'GC dọn cái KHÔNG reachable; leak nghĩa là bạn vô tình còn giữ đường tham chiếu. Bốn thủ phạm quen mặt: (1) cache/Map dùng làm bộ nhớ đệm nhưng không có TTL/giới hạn (dùng LRU hoặc `WeakMap`); (2) `addEventListener`/`setInterval` không gỡ; (3) đẩy vào mảng/biến module-level mãi (log buffer, mảng metrics); (4) closure trong callback sống lâu giữ nguyên request/buffer lớn. Chẩn đoán: chụp heap snapshot ở hai thời điểm rồi so sánh trong Chrome DevTools, hoặc `--inspect` + `clinic.js`; theo dõi `process.memoryUsage().heapUsed` tăng đơn điệu sau mỗi lần GC.',
  },
  {
    id: 'node-heap-limit', topic: 'Bộ nhớ',
    q: 'Lỗi "JavaScript heap out of memory" trong Node nghĩa là gì?',
    options: [
      'Máy chủ đã hết RAM vật lý nên hệ điều hành từ chối cấp thêm bộ nhớ cho tiến trình',
      'Heap của V8 chạm giới hạn (`--max-old-space-size`) — có thể do leak, hoặc do nạp quá nhiều dữ liệu một lúc',
      'Có quá nhiều biến toàn cục nên bảng ký hiệu của V8 bị tràn dung lượng cho phép',
      'Số lượng object vượt quá số lượng tối đa mà một tiến trình Node được phép tạo ra',
    ], answer: 1,
    explain: 'V8 giới hạn old-space riêng (thường ~2–4GB tuỳ phiên bản/kiến trúc), độc lập với RAM máy — nên máy 32GB vẫn OOM được. Hai hướng chẩn: LEAK (bộ nhớ tăng đơn điệu, tăng limit chỉ kéo dài thời gian) hay CAO ĐỘT BIẾN hợp lệ (đọc cả file lớn/`SELECT *` triệu dòng vào mảng — chữa bằng stream, phân trang, xử lý theo lô). Chỉ tăng `--max-old-space-size` khi đã hiểu rõ lý do; trong container nhớ đặt giá trị THẤP hơn memory limit, nếu không sẽ bị OOMKilled trước khi V8 kịp báo lỗi.',
  },
  {
    id: 'node-sync-api', topic: 'Hiệu năng',
    q: 'Vì sao `fs.readFileSync` trong request handler là chống chỉ định?',
    options: [
      'Vì bản đồng bộ đọc chậm hơn bản bất đồng bộ do không dùng được thread pool của libuv',
      'Vì nó CHẶN toàn bộ event loop — mọi request khác đứng chờ, thông lượng sập theo',
      'Vì nó không đọc được file lớn hơn 2GB, còn bản async thì đọc được không giới hạn',
      'Vì API đồng bộ đã bị deprecate và sẽ bị gỡ khỏi Node trong phiên bản LTS kế tiếp',
    ], answer: 1,
    explain: 'API `*Sync` giữ call stack tới khi xong → event loop đứng im, TẤT CẢ request khác bị treo theo. Chấp nhận được ở lúc KHỞI ĐỘNG (nạp config, đọc cert) hoặc trong script CLI; tuyệt đối tránh trong đường xử lý request. Cùng loại nguy hiểm: `crypto.pbkdf2Sync`, `bcrypt.hashSync`, `zlib.gzipSync`, `JSON.parse` chuỗi khổng lồ, và `child_process.execSync`.',
  },
  {
    id: 'node-buffer', topic: 'Buffer & encoding',
    q: '`Buffer` trong Node là gì?',
    options: [
      'Một mảng JS thường chứa các số nguyên, được Node tối ưu riêng cho thao tác đọc ghi file',
      'Một chuỗi nhị phân bất biến, mọi thao tác cắt ghép đều tạo ra bản sao mới',
      'Vùng nhớ NGOÀI heap V8 (subclass của `Uint8Array`) chứa byte thô — cần chỉ rõ encoding khi chuyển sang chuỗi',
      'Một hàng đợi tạm để giữ dữ liệu chờ ghi ra đĩa, được flush tự động theo chu kỳ',
    ], answer: 2,
    explain: 'Buffer = dãy byte thô, cấp phát ngoài heap V8 (nên không tính vào `--max-old-space-size` nhưng vẫn tốn RAM tiến trình), kế thừa `Uint8Array`. Byte KHÔNG mang thông tin encoding — `buf.toString("utf8"|"base64"|"hex")` mới quyết định cách diễn giải. Hai bẫy: (1) `buf.length` là số BYTE, không phải số ký tự (tiếng Việt/emoji nhiều byte mỗi ký tự); (2) cắt buffer giữa chừng một ký tự UTF-8 nhiều byte sẽ ra ký tự hỏng — dùng `StringDecoder` khi ghép chunk từ stream.',
  },
  {
    id: 'node-buffer-alloc', topic: 'Buffer & encoding',
    q: '`Buffer.allocUnsafe(n)` khác `Buffer.alloc(n)` ở chỗ nào?',
    options: [
      '`allocUnsafe` cấp phát ngoài giới hạn heap nên có thể làm tiến trình bị OOM bất ngờ',
      '`allocUnsafe` nhanh hơn vì KHÔNG zero-fill — buffer chứa dữ liệu cũ, lộ thông tin nếu không ghi đè hết',
      '`allocUnsafe` không kiểm tra tham số đầu vào nên truyền số âm sẽ làm tiến trình crash ngay lập tức',
      '`allocUnsafe` chỉ dùng được bên trong worker thread vì nó bỏ qua cơ chế khoá bộ nhớ của libuv',
    ], answer: 1,
    explain: '`Buffer.alloc(n)` cấp phát rồi ZERO-FILL — an toàn, chậm hơn chút. `allocUnsafe(n)` lấy bộ nhớ chưa xoá (có thể tái dùng từ pool nội bộ), nên nội dung ban đầu là RÁC từ dữ liệu cũ của chính tiến trình — từng gây lỗ hổng lộ dữ liệu (Heartbleed-style) khi lập trình viên trả nguyên buffer ra ngoài mà chưa ghi đè. Chỉ dùng khi bạn chắc chắn ghi đè TOÀN BỘ ngay sau đó (ví dụ đọc đúng n byte vào). Ngoài ra `new Buffer()` cũ đã deprecated vì chính lý do này.',
  },
  // ---------- Bảo mật ----------
  {
    id: 'node-sec-injection', topic: 'Bảo mật',
    q: 'Vì sao `exec(\`git log ${branch}\`)` là lỗ hổng nghiêm trọng?',
    options: [
      'Vì `exec` chạy chậm hơn `spawn` nên dễ bị lợi dụng để tấn công từ chối dịch vụ',
      'Vì `exec` chạy qua SHELL: input chứa `;`, `&&`, `$()` sẽ thành lệnh hệ thống — command injection',
      'Vì chuỗi template không escape ký tự Unicode nên tên nhánh tiếng Việt sẽ gây lỗi cú pháp',
      'Vì `exec` giữ toàn bộ output trong bộ nhớ nên input dài sẽ làm tràn maxBuffer',
    ], answer: 1,
    explain: '`exec` truyền chuỗi cho `/bin/sh`, nên `branch = "main; rm -rf /"` được shell hiểu là hai lệnh. Cách chữa: dùng `execFile("git", ["log", branch])` hoặc `spawn` với MẢNG tham số — không qua shell nên không có ký tự đặc biệt nào được diễn giải; kèm allowlist/regex validate input. Cùng họ lỗ hổng: SQL injection (dùng parameterized query), path traversal (`../../etc/passwd` — chuẩn hoá bằng `path.resolve` rồi kiểm tra prefix), và prototype pollution khi merge object từ input.',
  },
  {
    id: 'node-sec-password', topic: 'Bảo mật',
    q: 'Lưu mật khẩu người dùng đúng cách trong Node là thế nào?',
    options: [
      'Băm bằng SHA-256 kèm salt ngẫu nhiên, vì SHA-256 là thuật toán băm mạnh nhất hiện nay',
      'Mã hoá AES-256 bằng khoá lưu trong biến môi trường để khi cần còn giải mã ra được',
      'Băm bằng thuật toán CHẬM có salt: bcrypt/scrypt/argon2, với cost factor chỉnh theo phần cứng',
      'Băm hai lần bằng MD5 rồi SHA-1 để không thể tra ngược bằng rainbow table',
    ], answer: 2,
    explain: 'Mật khẩu phải BĂM (một chiều), không mã hoá — lộ khoá là lộ hết. SHA-256 quá NHANH: GPU thử hàng tỷ tổ hợp mỗi giây. Dùng hàm cố tình chậm và tốn bộ nhớ: bcrypt (cost ~12), scrypt (có sẵn trong `crypto`), hoặc argon2id (khuyến nghị của OWASP hiện nay). Chúng tự sinh salt riêng cho mỗi mật khẩu. Nhớ dùng bản BẤT ĐỒNG BỘ (`bcrypt.hash`, không `hashSync`) vì hàm này CPU-bound sẽ chặn event loop, và so sánh bằng hàm timing-safe.',
  },
  {
    id: 'node-sec-timing', topic: 'Bảo mật',
    q: '`crypto.timingSafeEqual` dùng để làm gì?',
    options: [
      'Đo thời gian thực thi của hai đoạn code để so sánh hiệu năng giữa các thuật toán',
      'So sánh hai buffer trong thời gian KHÔNG phụ thuộc nội dung — chống timing attack khi so token/HMAC',
      'Đảm bảo hai thao tác mã hoá hoàn thành cùng lúc để tránh race condition giữa các luồng',
      'Kiểm tra chữ ký số còn hạn hay chưa dựa trên timestamp nhúng trong token',
    ], answer: 1,
    explain: 'So sánh chuỗi bằng `===` DỪNG ở byte khác đầu tiên → thời gian chạy rò rỉ thông tin về số ký tự đầu đã đúng; kẻ tấn công đo hàng nghìn lần có thể dò dần từng byte của token/HMAC/API key. `timingSafeEqual` luôn duyệt hết mọi byte nên thời gian không đổi (yêu cầu hai buffer CÙNG độ dài — độ dài vẫn rò rỉ, nên thường băm trước rồi so). Dùng khi kiểm tra webhook signature, API key, session token, mã OTP.',
  },
  {
    id: 'node-sec-jwt', topic: 'Bảo mật',
    q: 'Sai lầm bảo mật kinh điển khi dùng JWT là gì?',
    options: [
      'Đặt hạn dùng cho token, vì token hết hạn giữa chừng sẽ làm hỏng trải nghiệm của người dùng',
      'Ký token bằng thuật toán RS256, vì khoá bất đối xứng chậm hơn nhiều lần so với HS256',
      'Tin vào header `alg` của token (chấp nhận `alg: none`) và nhét dữ liệu nhạy cảm vào payload',
      'Lưu token ở phía client, vì mọi dữ liệu ở client đều có thể bị chỉnh sửa tuỳ ý',
    ], answer: 2,
    explain: 'Ba lỗi hay gặp: (1) để thư viện tự đọc `alg` từ token — kẻ tấn công đổi thành `none` hoặc hạ RS256 xuống HS256 rồi ký bằng public key; luôn TRUYỀN CỨNG danh sách thuật toán khi verify; (2) không kiểm `exp`/`iss`/`aud`; (3) payload chỉ được base64 (KHÔNG mã hoá) nên ai cũng đọc được — đừng để thông tin nhạy cảm. Thêm: JWT không thu hồi được trước hạn → đặt access token ngắn hạn + refresh token có thể thu hồi, hoặc giữ danh sách jti bị chặn.',
  },
  {
    id: 'node-sec-deps', topic: 'Bảo mật',
    q: 'Vì sao `npm ci` được ưu tiên hơn `npm install` trong CI/CD?',
    options: [
      'Vì `npm ci` cài đặt song song được nhiều package hơn nên luôn nhanh hơn khoảng chừng hai lần',
      'Vì `npm ci` tự động cập nhật package lên bản mới nhất, đảm bảo luôn có bản vá bảo mật',
      'Vì `npm ci` cài ĐÚNG theo lock file và không sửa nó, còn `npm install` có thể nâng phiên bản theo range',
      'Vì `npm ci` luôn bỏ qua devDependencies nên image Docker sinh ra bao giờ cũng nhỏ gọn hơn',
    ], answer: 2,
    explain: '`npm install` có thể cập nhật `package-lock.json` khi range `^`/`~` cho phép bản mới → hai lần build cho ra cây phụ thuộc khác nhau ("chạy máy tôi thì được"), và mở đường cho tấn công supply chain qua bản patch độc hại. `npm ci` xoá `node_modules` rồi cài chính xác theo lock, lỗi ngay nếu lock lệch `package.json` — tái lập được và nhanh hơn trong CI. Kèm theo: commit lock file, chạy `npm audit`/Dependabot, và cân nhắc pin phiên bản chặt cho phụ thuộc quan trọng.',
  },
  {
    id: 'node-env-secret', topic: 'Bảo mật',
    q: 'Quản lý secret (DB password, API key) trong Node thế nào là đúng?',
    options: [
      'Đưa vào `config.json` rồi commit lên repo private — repo private thì chỉ team mới đọc được',
      'Nạp từ biến môi trường / secret manager lúc chạy, không commit; xoay vòng định kỳ và không log ra ngoài',
      'Mã hoá bằng base64 rồi hardcode trong mã nguồn để không ai đọc trực tiếp được',
      'Lưu trong database chung của ứng dụng để mọi service đều truy vấn được khi cần',
    ], answer: 1,
    explain: 'Nguyên tắc 12-factor: config theo môi trường nằm ở BIẾN MÔI TRƯỜNG hoặc secret manager (K8s Secret + KMS, AWS Secrets Manager, Vault), nạp lúc chạy. Không commit `.env` (thêm vào `.gitignore`, chỉ commit `.env.example`). Base64 KHÔNG phải mã hoá — chỉ là encoding, ai cũng giải được. Nhớ thêm: lọc secret khỏi log và error message (redact), xoay vòng khoá định kỳ, phân quyền tối thiểu, và nếu lỡ commit thì phải THU HỒI khoá — xoá commit thôi là chưa đủ vì nó đã nằm trong lịch sử/clone của người khác.',
  },
  // ---------- Kiến trúc & tooling ----------
  {
    id: 'node-semver', topic: 'Tooling',
    q: 'Trong package.json, `^1.2.3` và `~1.2.3` cho phép nâng tới đâu?',
    options: [
      '`^` chỉ cho nâng patch (1.2.x), `~` cho nâng cả minor (1.x.x) — ngược với trực giác thông thường',
      '`^` cho phép nâng minor+patch (<2.0.0), `~` chỉ cho nâng patch (<1.3.0)',
      'Cả hai đều chỉ cho nâng patch, khác nhau ở chỗ `^` còn cho phép nâng cả bản major',
      'Cả hai giống nhau hoàn toàn, npm chỉ giữ hai ký hiệu để tương thích với yarn cũ',
    ], answer: 1,
    explain: 'SemVer `MAJOR.MINOR.PATCH`: major = thay đổi phá vỡ tương thích, minor = thêm tính năng tương thích ngược, patch = sửa lỗi. `^1.2.3` → `>=1.2.3 <2.0.0`; `~1.2.3` → `>=1.2.3 <1.3.0`; ghi trần `1.2.3` là pin cứng. Lưu ý ngoại lệ: với `0.x` thì `^0.2.3` chỉ cho `<0.3.0` (coi minor như major vì API chưa ổn định). Range chỉ là Ý ĐỊNH — cái thực sự được cài nằm ở `package-lock.json`.',
  },
  {
    id: 'node-12factor-log', topic: 'Kiến trúc',
    q: 'Theo 12-factor, ứng dụng Node nên xử lý log thế nào?',
    options: [
      'Ghi vào file trong container rồi định kỳ nén và xoay vòng bằng cron nội bộ',
      'Gửi thẳng từ ứng dụng lên Elasticsearch bằng HTTP để có log ngay lập tức',
      'Ghi JSON có cấu trúc ra STDOUT/STDERR như một luồng sự kiện; hạ tầng lo thu thập và lưu trữ',
      'Chỉ ghi log khi có lỗi, để giảm chi phí lưu trữ và tránh làm chậm ứng dụng',
    ], answer: 2,
    explain: 'App coi log là STREAM sự kiện, in ra stdout/stderr; việc gom, xoay vòng, lưu, tìm kiếm là của hạ tầng (Docker log driver, Fluent Bit → Loki/ELK/CloudWatch). Ghi file trong container thì log bay khi pod chết và gây đầy đĩa. Gửi thẳng lên Elasticsearch từ app thì app phải lo retry/buffer và sẽ chậm/kẹt khi ES sự cố. Dùng logger JSON có cấu trúc (pino, winston) — có level, `requestId`/`traceId` (kết hợp `AsyncLocalStorage`), và redact trường nhạy cảm; `console.log` là ĐỒNG BỘ khi ra file/pipe nên tránh dùng ở hot path.',
  },
  {
    id: 'node-docker-node', topic: 'Kiến trúc',
    q: 'Vì sao không nên chạy `npm start` làm PID 1 trong Docker cho service Node?',
    options: [
      'Vì npm chiếm thêm khoảng 200MB RAM khi chạy nền cùng với tiến trình Node',
      'Vì npm KHÔNG chuyển tiếp SIGTERM tới tiến trình con đúng cách → mất graceful shutdown',
      'Vì npm cần quyền root để chạy nên vi phạm chính sách bảo mật của Kubernetes',
      'Vì npm luôn chạy lại `npm install` khi khởi động, làm container mất nhiều thời gian sẵn sàng',
    ], answer: 1,
    explain: 'PID 1 phải nhận và chuyển tiếp tín hiệu; npm là một lớp bọc và thường không forward SIGTERM tới `node` con, cũng không reap tiến trình mồ côi. Kết quả: khi K8s gửi SIGTERM, app không kịp graceful shutdown và bị SIGKILL sau grace period — request đang xử lý bị đứt. Chuẩn: `CMD ["node", "server.js"]` (exec form, không dùng shell form) và thêm `--init`/tini nếu cần reap zombie. Kèm theo các thực hành khác: multi-stage build, chạy bằng user non-root, `NODE_ENV=production`, và `npm ci --omit=dev`.',
  },
  // ===== Đợt #2 =====
  {
    id: 'node-fs-api', topic: 'Hiệu năng',
    q: 'Node có 3 kiểu API cho `fs` — nên chọn kiểu nào trong service?',
    options: [
      '`fs.readFileSync` vì code gọn nhất và không phải lo callback hell hay chuỗi Promise dài',
      '`fs/promises` (async/await) cho code trong request; bản `*Sync` chỉ dùng lúc khởi động hoặc script CLI',
      'Bản callback cổ điển vì nó nhanh hơn Promise do không phải tạo object trung gian',
      'Kiểu nào cũng như nhau vì cả ba đều được libuv đẩy sang thread pool để xử lý',
    ], answer: 1,
    explain: 'Ba kiểu: callback (`fs.readFile(p, cb)`), promise (`require("fs/promises")`), và sync (`fs.readFileSync`). Sync CHẶN event loop — chỉ chấp nhận được lúc bootstrap (đọc config, cert) hoặc script chạy một lần. Trong đường xử lý request luôn dùng `fs/promises` cho dễ đọc và bắt lỗi bằng try/catch. Nhớ thêm: file LỚN thì đừng `readFile` kiểu nào cả — dùng stream để không nạp hết vào RAM. Và mọi bản async đều chạy trên thread pool 4 luồng của libuv, nên hàng chục thao tác fs đồng thời vẫn phải xếp hàng.',
  },
  {
    id: 'node-path-traversal', topic: 'Bảo mật',
    q: 'API tải file nhận `req.query.name` rồi `fs.readFile(path.join(DIR, name))` — lỗ hổng gì?',
    options: [
      'Không có lỗ hổng vì `path.join` đã tự động loại bỏ mọi ký tự nguy hiểm trong đường dẫn',
      'Chỉ rò rỉ tên file trong thư mục, nội dung vẫn an toàn vì bị giới hạn bởi quyền của tiến trình',
      'PATH TRAVERSAL: `name = "../../.env"` thoát khỏi thư mục — phải `resolve` rồi kiểm tra prefix, hoặc dùng allowlist',
      'Chỉ là vấn đề hiệu năng vì đường dẫn dài làm hệ điều hành phải duyệt nhiều thư mục hơn',
    ], answer: 2,
    explain: '`path.join("/app/files", "../../.env")` cho ra `/.env` — `join` CHUẨN HOÁ đường dẫn chứ không chặn thoát thư mục. Kẻ tấn công đọc được `.env`, `/etc/passwd`, key SSH. Cách chữa đúng: `const p = path.resolve(DIR, name); if (!p.startsWith(DIR + path.sep)) throw ...` — kiểm tra SAU khi resolve; tốt hơn nữa là đừng nhận tên file từ người dùng mà dùng id tra ra tên thật trong DB (allowlist). Cẩn thận thêm: ký tự null byte, symlink trỏ ra ngoài, và tên file đã URL-encode (`%2e%2e%2f`) được decode trước khi tới tay bạn.',
  },
  {
    id: 'node-crypto-random', topic: 'Bảo mật',
    q: 'Sinh token đặt lại mật khẩu bằng `Math.random().toString(36)` có vấn đề gì?',
    options: [
      'Chỉ là vấn đề độ dài: token quá ngắn nên dễ trùng nhau giữa các người dùng khác nhau',
      '`Math.random` KHÔNG an toàn mật mã — kết quả đoán được từ vài mẫu; phải dùng `crypto.randomBytes`/`randomUUID`',
      'Không có vấn đề gì, `Math.random` trong V8 đã dùng nguồn entropy của hệ điều hành',
      '`toString(36)` làm mất entropy vì chỉ giữ lại chữ số và chữ cái thường trong kết quả',
    ], answer: 1,
    explain: '`Math.random` dùng PRNG (xorshift128+) tối ưu cho TỐC ĐỘ, không phải bảo mật: biết vài giá trị liên tiếp là suy được trạng thái nội bộ và dự đoán mọi giá trị sau — đủ để kẻ tấn công đoán token reset password của người khác. Dùng CSPRNG: `crypto.randomBytes(32).toString("hex")`, `crypto.randomUUID()`, hoặc `crypto.getRandomValues`. Áp dụng cho: token reset, session id, mã OTP, salt, state của OAuth, tên file tạm. Kèm theo: token phải có HẠN ngắn, dùng một lần, và lưu ở DB dưới dạng đã BĂM (rò DB thì token vẫn vô dụng).',
  },
  {
    id: 'node-express-error', topic: 'HTTP',
    q: 'Trong Express 4, vì sao lỗi ném từ một async route handler lại làm treo request?',
    options: [
      'Vì Express chỉ bắt lỗi ném ĐỒNG BỘ — Promise reject không ai bắt nên không tới được error middleware',
      'Vì async handler chạy trên thread pool riêng nên Express mất dấu request tương ứng',
      'Vì Express cần handler khai báo đủ 4 tham số thì mới nhận diện được đây là route hợp lệ',
      'Vì lỗi bất đồng bộ luôn bị chuyển thành sự kiện `error` của server nên không vào middleware',
    ], answer: 0,
    explain: 'Express 4 bọc handler trong try/catch ĐỒNG BỘ; `async` handler trả Promise, reject của nó Express không biết → không gọi `next(err)` → request treo tới timeout, và Node ≥15 có thể crash vì unhandled rejection. Ba cách chữa: (1) tự `try { } catch (e) { next(e) }`; (2) wrapper `const wrap = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next)`; (3) nâng lên Express 5 — đã tự chuyển tiếp Promise reject. Nhớ thêm: error middleware phải khai báo ĐỦ 4 tham số `(err, req, res, next)` mới được nhận diện, và phải đăng ký SAU tất cả route.',
  },
  {
    id: 'node-body-limit', topic: 'Bảo mật',
    q: 'Vì sao phải giới hạn kích thước request body?',
    options: [
      'Để tiết kiệm băng thông mạng cho người dùng đang dùng kết nối di động chậm',
      'Vì Node không parse được JSON lớn hơn 1MB nên request sẽ lỗi cú pháp khi vượt ngưỡng',
      'Không có body limit thì một request lớn nuốt hết RAM (và `JSON.parse` chặn loop) — DoS chỉ với vài request',
      'Để đảm bảo request đi vừa trong một gói TCP duy nhất, tránh phải ghép lại nhiều mảnh',
    ], answer: 2,
    explain: 'Body được gom vào RAM trước khi parse: vài request body 500MB là hết bộ nhớ tiến trình, chưa kể `JSON.parse` một chuỗi khổng lồ chặn event loop hàng giây. Đặt `express.json({ limit: "100kb" })` (mặc định đã là 100kb — đừng nâng vô cớ) và cấu hình limit ở cả reverse proxy (`client_max_body_size` của nginx). Upload file thì đừng đi qua body parser: stream thẳng lên S3/đĩa bằng busboy/multer với giới hạn kích thước và kiểm tra loại file. Cùng nhóm phòng thủ: rate limit, timeout, và giới hạn số kết nối đồng thời.',
  },
  {
    id: 'node-proto-pollution', topic: 'Bảo mật',
    q: 'Prototype pollution xảy ra thế nào và hậu quả ra sao?',
    options: [
      'Khi hai module npm định nghĩa cùng một tên class, prototype của chúng ghi đè lẫn nhau lúc chạy',
      'Khi merge sâu object từ input người dùng mà không lọc key `__proto__` — mọi object trong app bị thêm thuộc tính',
      'Khi gán `Object.prototype = null` khiến mọi object trong app mất hết method kế thừa sẵn có',
      'Khi tạo quá nhiều instance khiến chuỗi prototype dài ra và tra cứu thuộc tính bị chậm dần',
    ], answer: 1,
    explain: 'Gửi `{"__proto__": {"isAdmin": true}}` vào một hàm deep-merge cẩu thả thì `Object.prototype.isAdmin = true` — TỪ ĐÓ mọi object trong tiến trình đều "có" `isAdmin`, vượt qua kiểm tra quyền, hoặc chèn được `Object.prototype.shell` để leo thang thành RCE trong một số thư viện. Phòng: bỏ qua key `__proto__`/`constructor`/`prototype` khi merge, dùng `Object.create(null)` cho map thuần, `Object.freeze(Object.prototype)` lúc khởi động, validate input bằng schema (zod/ajv) có `additionalProperties: false`, và dùng `Map` thay object khi key đến từ người dùng.',
  },
  {
    id: 'node-dns', topic: 'Event loop & libuv',
    q: '`dns.lookup` và `dns.resolve` khác nhau ở điểm nào quan trọng nhất?',
    options: [
      '`lookup` trả về nhiều bản ghi, còn `resolve` thì chỉ trả về đúng một địa chỉ IP duy nhất',
      '`lookup` gọi getaddrinfo của HĐH nên chạy trên THREAD POOL (dễ nghẽn); `resolve` truy vấn DNS qua mạng',
      '`lookup` là bản đồng bộ, còn `resolve` là bản bất đồng bộ của cùng một chức năng đó',
      '`lookup` chỉ hoạt động với tên miền nội bộ còn `resolve` dùng cho tên miền công khai',
    ], answer: 1,
    explain: '`dns.lookup` (thứ mà `http`, `net`, mọi HTTP client dùng ngầm) gọi `getaddrinfo` của hệ điều hành — API này KHÔNG có bản async nên libuv phải chạy nó trên thread pool 4 luồng, dùng chung với `fs`, `crypto`, `zlib`. Hệ quả bất ngờ: DNS chậm làm nghẽn cả thao tác đọc file, và ngược lại. `dns.resolve*` dùng c-ares gửi truy vấn DNS thẳng qua mạng, không chiếm thread — nhưng bỏ qua `/etc/hosts` và cấu hình hệ thống. Trong service tải cao nên bật DNS cache ở tầng ứng dụng (`cacheable-lookup`) và cân nhắc tăng `UV_THREADPOOL_SIZE`.',
  },
  {
    id: 'node-profiling', topic: 'Hiệu năng',
    q: 'Service Node chậm mà không biết vì sao — công cụ nào cho biết CPU đang tốn ở đâu?',
    options: [
      'Rải `console.time`/`console.timeEnd` khắp code rồi đọc log để đoán xem hàm nào đang chậm nhất',
      'Đọc `process.memoryUsage()` định kỳ, vì bộ nhớ tăng luôn đồng nghĩa với CPU cao',
      'CPU profile (`--cpu-prof`, `--inspect` + DevTools, clinic/0x) cho flame graph theo hàm, kèm đo event loop lag',
      'Bật `NODE_DEBUG=*` để Node in ra thời gian thực thi của từng lời gọi hàm nội bộ của nó',
    ], answer: 2,
    explain: 'Quy trình chuẩn: (1) đo EVENT LOOP LAG trước — lag cao nghĩa là có tác vụ đồng bộ chặn, lag thấp mà vẫn chậm thì nghẽn ở I/O/dependency; (2) lấy CPU profile bằng `node --cpu-prof app.js` hoặc gắn `--inspect` rồi record trong Chrome DevTools, đọc FLAME GRAPH tìm hàm chiếm nhiều self-time; `clinic doctor`/`0x` cho báo cáo dễ đọc hơn. (3) Nghi rò rỉ bộ nhớ thì chụp hai heap snapshot cách nhau rồi so sánh. (4) Với hệ phân tán, distributed tracing (OpenTelemetry) chỉ ra chặng nào chậm trước khi bạn đào vào một service.',
  },
  // ===== Đợt #3 =====
  {
    id: 'node-db-pool', topic: 'Kiến trúc',
    q: 'Vì sao service Node phải dùng connection pool tới database?',
    options: [
      'Vì Node không mở được nhiều hơn một kết nối TCP tới cùng một máy chủ database',
      'Vì pool nén dữ liệu truyền giữa app và database nên giảm được đáng kể lưu lượng mạng',
      'Vì mở kết nối mới rất đắt và DB chỉ chịu được số kết nối hữu hạn — pool tái dùng và ĐẶT TRẦN',
      'Vì pool tự động chia truy vấn cho nhiều replica để cân bằng tải giữa các máy chủ',
    ], answer: 2,
    explain: 'Mỗi kết nối Postgres là một PROCESS phía server (~vài MB RAM) — mở/đóng liên tục vừa chậm vừa giết DB. Pool giữ sẵn N kết nối và cho mượn. Ba điều hay bị hỏi tiếp: (1) tính `max` theo TỔNG số instance × pool size phải nhỏ hơn `max_connections` của DB, nếu không deploy thêm pod là DB từ chối kết nối; (2) POOL EXHAUSTION — quên `release()`/`client.end()` sau transaction, hoặc gọi API chậm khi đang giữ connection, làm mọi request xếp hàng chờ; (3) transaction PHẢI chạy trên CÙNG một connection mượn ra, không được dùng `pool.query` giữa chừng. Quy mô lớn thì thêm PgBouncer ở giữa.',
  },
  {
    id: 'node-cache-header', topic: 'HTTP',
    q: '`Cache-Control` và `ETag` phối hợp với nhau thế nào?',
    options: [
      '`Cache-Control` cho thời gian dùng cache KHÔNG cần hỏi lại; hết hạn thì `ETag` cho nhận `304` nếu chưa đổi',
      '`ETag` thay thế được hoàn toàn `Cache-Control`, chỉ cần một trong hai là đủ cho mọi tình huống',
      '`Cache-Control` dành cho CDN còn `ETag` chỉ có tác dụng với cache của trình duyệt',
      'Cả hai chỉ là gợi ý, trình duyệt vẫn luôn tải lại tài nguyên mỗi khi người dùng mở trang',
    ], answer: 0,
    explain: 'Hai tầng. `Cache-Control: max-age=3600` → trong 1 giờ trình duyệt dùng bản cache mà KHÔNG gửi request nào (nhanh nhất). Hết hạn, nó gửi kèm `If-None-Match: <etag>`; server so sánh, chưa đổi thì trả `304 Not Modified` (không có body — tiết kiệm băng thông nhưng vẫn tốn một RTT). Chiến lược chuẩn cho web: file có hash trong tên (`app.a3f9.js`) thì `max-age=31536000, immutable`; còn `index.html` thì `no-cache` (luôn hỏi lại) để deploy mới có hiệu lực ngay. Thêm `private` cho nội dung theo người dùng và `Vary` khi response phụ thuộc header.',
  },
  {
    id: 'node-compression', topic: 'HTTP',
    q: 'Nén response (gzip/brotli) cho API Node nên đặt ở đâu?',
    options: [
      'Luôn nén trong ứng dụng Node bằng middleware để kiểm soát được mức nén chi tiết nhất',
      'Ưu tiên nén ở reverse proxy/CDN vì nén là việc CPU-bound; nén trong Node thì chiếm event loop',
      'Không bao giờ nên nén vì giải nén ở phía client làm trang hiển thị chậm hơn',
      'Nén ở tầng database để dữ liệu đã nhỏ sẵn trước khi đi qua ứng dụng Node',
    ], answer: 1,
    explain: 'Nén là CPU-bound. `compression()` của Express dùng zlib chạy trên thread pool libuv (4 luồng, dùng chung với fs/crypto) — tải cao thì thành nút cổ chai. Đặt ở nginx/CDN/ALB sẽ tốt hơn và còn được brotli sẵn. Nếu buộc phải nén trong Node: đặt ngưỡng (`threshold`) vì payload dưới ~1KB nén xong còn to hơn, đừng nén lại thứ đã nén (ảnh JPEG/PNG, video, file .gz), và cân nhắc cache kết quả nén cho nội dung tĩnh. Lưu ý bảo mật: nén response chứa dữ liệu bí mật kèm input người dùng có thể bị tấn công kiểu BREACH.',
  },
  {
    id: 'node-probe', topic: 'Kiến trúc',
    q: 'Liveness probe và readiness probe của một service Node khác nhau thế nào?',
    options: [
      'Liveness "còn sống không" — fail thì RESTART; readiness "nhận request được chưa" — fail thì tạm gỡ khỏi load balancer',
      'Liveness kiểm tra ứng dụng còn kết nối được database, readiness kiểm tra tiến trình còn chạy',
      'Hai probe giống nhau, Kubernetes chỉ giữ cả hai tên để tương thích với bản cũ',
      'Liveness chạy một lần lúc khởi động, readiness chạy định kỳ trong suốt vòng đời của pod',
    ], answer: 0,
    explain: 'Liveness = "tiến trình có hỏng hẳn không" → fail thì K8s giết và tạo pod mới. Readiness = "lúc này có phục vụ được không" → fail thì chỉ tạm ngừng gửi traffic, pod vẫn sống. Sai lầm kinh điển: cho liveness kiểm tra DB — DB chập chờn sẽ khiến K8s restart TOÀN BỘ pod cùng lúc, biến sự cố nhỏ thành sập dịch vụ. Đúng: liveness chỉ trả 200 nếu event loop còn quay; readiness mới kiểm dependency và pool. Readiness còn là chìa khoá của graceful shutdown — nhận SIGTERM thì cho readiness fail TRƯỚC, đợi LB rút traffic rồi mới đóng server.',
  },
  {
    id: 'node-idempotency', topic: 'Kiến trúc',
    q: 'Vì sao API tạo đơn hàng nên nhận `Idempotency-Key`?',
    options: [
      'Để phía server biết thứ tự các request và sắp xếp lại đúng trình tự người dùng thao tác',
      'Để mã hoá nội dung request, tránh bị đọc trộm khi truyền qua mạng công cộng',
      'Vì client có thể gửi lại khi timeout/mất mạng — cùng key thì server trả LẠI kết quả cũ thay vì tạo đơn thứ hai',
      'Để giới hạn số request mỗi người dùng được gửi trong một khoảng thời gian nhất định',
    ], answer: 2,
    explain: 'Mạng không đáng tin: client gửi POST, server tạo đơn xong nhưng response mất giữa đường → client retry → hai đơn. Client sinh key duy nhất (UUID) cho MỖI Ý ĐỊNH tạo đơn và gửi kèm; server lưu key → kết quả trong Redis/DB (có TTL), gặp lại key cũ thì trả nguyên response cũ. Cần lưu ý: chèn key vào DB với ràng buộc UNIQUE trong cùng transaction để chống race hai request song song, và xử lý trạng thái "đang chạy dở". Cùng họ ý tưởng: consumer Kafka phải idempotent vì delivery là at-least-once. Đây là câu hỏi gần như chắc chắn có khi phỏng vấn backend thanh toán.',
  },
  {
    id: 'node-queue', topic: 'Kiến trúc',
    q: 'Khi nào nên đẩy việc sang hàng đợi (BullMQ/SQS) thay vì làm ngay trong request?',
    options: [
      'Với mọi thao tác ghi database, để request nào cũng trả về trong vài mili giây',
      'Chỉ khi hệ thống đã có sẵn Kafka, còn dự án nhỏ thì luôn xử lý trực tiếp là đủ',
      'Khi việc CHẬM hoặc dễ lỗi mà người dùng không cần chờ: gửi mail, xử lý ảnh, gọi bên thứ ba, xuất báo cáo',
      'Khi cần đảm bảo dữ liệu nhất quán tuyệt đối, vì queue có transaction mạnh hơn database',
    ], answer: 2,
    explain: 'Việc chậm nằm trong request thì giữ connection, chiếm worker, và một lỗi tạm của bên thứ ba làm hỏng cả thao tác chính. Đẩy sang queue: API trả `202 Accepted` ngay, worker xử lý riêng với retry + backoff, DLQ cho job chết, và scale worker độc lập với web. Ba điều phải kèm theo: job phải IDEMPOTENT (at-least-once nên có thể chạy lại), phải có cách báo tiến độ/kết quả cho người dùng (polling, websocket, email), và ghi job trong CÙNG transaction với dữ liệu (mẫu Outbox) để không rơi vào cảnh "đã tạo đơn mà mất job" hoặc ngược lại.',
  },
  {
    id: 'node-cors', topic: 'HTTP',
    q: 'CORS thực chất bảo vệ ai?',
    options: [
      'Bảo vệ server khỏi request độc hại — không cấu hình CORS thì ai cũng gọi được API của bạn',
      'Là cơ chế của TRÌNH DUYỆT bảo vệ người dùng: chặn JS ở origin A đọc response của origin B khi chưa được cho phép',
      'Là lớp mã hoá bổ sung cho HTTPS khi request đi qua nhiều tên miền khác nhau',
      'Là cách giới hạn băng thông để một trang web không gọi quá nhiều API bên ngoài',
    ], answer: 1,
    explain: 'CORS KHÔNG bảo vệ server: curl, Postman, hay một backend khác gọi API của bạn thoải mái vì không có trình duyệt nào áp same-origin policy. Nó bảo vệ NGƯỜI DÙNG — ngăn trang độc đọc dữ liệu từ site bạn đang đăng nhập. Cơ chế: request "không đơn giản" (có header tuỳ biến, method PUT/DELETE…) sẽ có preflight `OPTIONS`; server trả `Access-Control-Allow-Origin`/`-Methods`/`-Headers` thì trình duyệt mới cho JS đọc. Hai lưu ý: `Allow-Origin: *` KHÔNG dùng được cùng `credentials: true` (phải liệt kê origin cụ thể); và xác thực/phân quyền vẫn phải làm ở server, CORS không thay thế được.',
  },
  {
    id: 'node-time-utc', topic: 'Kiến trúc',
    q: 'Lưu thời gian trong hệ thống backend thế nào cho đúng?',
    options: [
      'Lưu chuỗi đã format sẵn theo múi giờ người dùng để hiển thị lại cho nhanh, khỏi phải chuyển đổi',
      'Lưu theo giờ máy chủ, vì mọi instance đều chạy trong cùng một trung tâm dữ liệu',
      'Lưu mốc thời gian tuyệt đối ở UTC (`timestamptz`/epoch), chỉ đổi sang múi giờ người dùng ở tầng HIỂN THỊ',
      'Lưu kèm chuỗi tên múi giờ trong cùng một cột để biết thời điểm đó thuộc vùng nào',
    ], answer: 2,
    explain: 'Quy tắc: lưu và truyền UTC, đổi múi giờ ở rìa hệ thống (UI). Lưu theo giờ địa phương thì: DST làm một giờ bị lặp lại/biến mất mỗi năm, đổi server sang vùng khác là dữ liệu cũ sai hết, và so sánh/sắp xếp giữa các bản ghi khác vùng thành vô nghĩa. Postgres dùng `timestamptz` (KHÔNG phải `timestamp`) — nó chuẩn hoá về UTC; MySQL thì `DATETIME` lưu UTC + đặt `time_zone` rõ ràng. Ngoại lệ đáng nhớ: sự kiện tương lai theo lịch địa phương ("9h sáng thứ Hai ở Hà Nội") nên lưu thêm TÊN múi giờ IANA (`Asia/Ho_Chi_Minh`), vì quy tắc DST có thể đổi trước khi tới ngày đó.',
  },
];
