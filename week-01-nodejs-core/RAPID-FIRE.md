# ⚡ Rapid-fire — Tuần 1: Node.js Core

> Câu hỏi nhanh, đáp án ngắn gọn để **ôn cấp tốc trước phỏng vấn**. Đọc câu hỏi, tự trả lời TO THÀNH TIẾNG trong ~10 giây, rồi mở đáp án so sánh. Thuật ngữ giữ tiếng Anh đúng như khi đi phỏng vấn.

## 🔄 Event Loop & Async

**1. Node.js là single-threaded hay multi-threaded?**
JavaScript chạy trên **một main thread**, nhưng libuv có một **thread pool** (mặc định 4) cho fs, dns, crypto, zlib. I/O mạng dùng async của kernel (epoll/kqueue/IOCP), không tốn thread.

**2. Các phase của event loop theo thứ tự?**
`timers` → `pending callbacks` → `idle/prepare` → `poll` → `check` → `close callbacks`. Lặp lại mỗi vòng (tick).

**3. `process.nextTick` vs `setImmediate` vs `setTimeout(fn, 0)`?**
`nextTick` chạy **trước** mọi microtask khác, ngay sau thao tác hiện tại. `setImmediate` chạy ở phase `check`. `setTimeout(0)` chạy ở phase `timers` — thường sau `setImmediate` nếu gọi trong I/O callback.

**4. Microtask vs macrotask?**
Microtask = Promise callbacks + `queueMicrotask` + `process.nextTick`, chạy **cạn hàng đợi** sau mỗi macrotask. Macrotask = timers, I/O, setImmediate.

**5. Vì sao không nên chạy CPU nặng trên main thread?**
Nó **chặn event loop** → mọi request khác chờ. Giải pháp: `worker_threads`, chia nhỏ tác vụ, hoặc đẩy sang service riêng.

**6. `unhandledRejection` và `uncaughtException` khác gì?**
`unhandledRejection`: Promise reject không có `.catch`. `uncaughtException`: lỗi đồng bộ không bắt — process ở trạng thái **không xác định**, nên log rồi **thoát** (để process manager restart), đừng cố chạy tiếp.

## 📦 Modules, Buffer, Streams

**7. CommonJS vs ES Modules?**
CJS: `require`/`module.exports`, **đồng bộ**, nạp lúc chạy. ESM: `import`/`export`, **bất đồng bộ**, tĩnh (phân tích được lúc build, tree-shaking). ESM dùng `.mjs` hoặc `"type":"module"`.

**8. `require` có cache không?**
Có. Lần đầu nạp module sẽ cache vào `require.cache`; các lần sau trả về **cùng một object**. Đây là lý do module hoạt động như singleton.

**9. Buffer là gì?**
Vùng nhớ **nhị phân thô** ngoài V8 heap, dùng cho dữ liệu binary (file, network). Kích thước cố định khi tạo.

**10. Bốn loại stream?**
`Readable` (đọc), `Writable` (ghi), `Duplex` (cả hai), `Transform` (Duplex có biến đổi dữ liệu, vd gzip).

**11. Backpressure là gì? Xử lý sao?**
Khi nguồn đẩy dữ liệu nhanh hơn đích tiêu thụ. Dùng `.pipe()` (tự xử lý) hoặc kiểm tra giá trị trả về của `write()` (false = chờ event `drain`).

**12. Vì sao stream tốt hơn đọc cả file vào memory?**
Xử lý **từng chunk** → bộ nhớ không phình theo kích thước file, bắt đầu xử lý sớm hơn (giảm latency). Quan trọng với file lớn.

## ⚙️ Thực thi & Lỗi thường gặp

**13. `__dirname` vs `process.cwd()`?**
`__dirname` = thư mục chứa **file hiện tại**. `process.cwd()` = thư mục **chạy lệnh node**. Hai cái thường khác nhau.

**14. EventEmitter dùng để làm gì?**
Mẫu pub/sub trong process: `.on(event, handler)` đăng ký, `.emit(event, data)` phát. Nền tảng của streams, HTTP server, nhiều core module.

**15. Memory leak hay gặp trong Node?**
Listener không gỡ (`removeListener`), closure giữ tham chiếu lớn, cache không giới hạn, biến global tích lũy. Dò bằng heap snapshot (`--inspect`).

**16. `UV_THREADPOOL_SIZE` ảnh hưởng gì?**
Số thread của libuv thread pool (mặc định 4, tối đa 1024). Tăng giúp các tác vụ fs/crypto/dns song song hơn — nhưng quá nhiều thì tốn context-switch.

**17. Làm sao chạy tác vụ CPU-bound song song?**
`worker_threads` (chia sẻ memory qua `SharedArrayBuffer`) cho tính toán nặng; `child_process`/`cluster` cho tách process. `cluster` nhân bản server theo số core để tận dụng CPU.

**18. `Promise.all` vs `Promise.allSettled` vs `Promise.race`?**
`all`: chờ tất cả, **fail nhanh** nếu một cái reject. `allSettled`: chờ tất cả, không reject, trả mảng `{status,value/reason}`. `race`: trả kết quả/đầu tiên xong (kể cả reject).

**19. Vì sao `async` function luôn trả về Promise?**
Theo đặc tả: giá trị `return` được bọc trong Promise resolved; `throw` thành Promise rejected. Nên luôn `await` hoặc `.catch`.

**20. Streaming một file qua HTTP đúng cách?**
`fs.createReadStream(path).pipe(res)` — pipe tự lo backpressure và đóng stream. Tránh `fs.readFile` rồi `res.end(buf)` vì buffer cả file vào RAM.

---

### 🎯 Tự kiểm tra
Trả lời trơn tru ≥ 16/20 câu trên trong vòng 5 phút là bạn đã nắm chắc nền tảng Node.js core. Câu nào lắp bắp → mở [`README.md`](README.md) hoặc [`DEEP-DIVE.md`](DEEP-DIVE.md) ôn lại phần tương ứng.
