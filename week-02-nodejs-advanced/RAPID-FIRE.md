# ⚡ Rapid-fire — Tuần 2: Node.js Advanced

> Câu hỏi nhanh, đáp án ngắn để **ôn cấp tốc trước phỏng vấn**. Tự trả lời TO THÀNH TIẾNG ~10 giây rồi mở đáp án so. Thuật ngữ giữ tiếng Anh.

## 🧵 Scaling & Process

**1. `cluster` vs `worker_threads` vs `child_process`?**
`cluster`: nhân bản server theo số CPU core, **chia tải connection** (mỗi worker là một process). `worker_threads`: thread trong cùng process, **chia sẻ memory** (`SharedArrayBuffer`) — hợp tính toán CPU nặng. `child_process`: spawn process độc lập, giao tiếp qua IPC/stdio.

**2. Scale ngang vs scale dọc?**
Dọc = thêm CPU/RAM cho một máy (có giới hạn). Ngang = thêm nhiều instance + load balancer (cần app **stateless**). Node thường scale ngang vì single-thread.

**3. Vì sao app phải stateless để scale ngang?**
Mỗi request có thể vào instance khác nhau → không được lưu session trong RAM process. Đẩy state ra **Redis/DB** ngoài.

## 🧠 Memory & GC

**4. V8 chia heap thế nào?**
**New space** (object trẻ, GC nhanh — Scavenge) và **Old space** (object sống lâu, Mark-Sweep-Compact). Object sống qua vài lần GC sẽ được "promote" sang old space.

**5. 5 loại memory leak phổ biến?**
Global variable tích lũy, closure giữ tham chiếu lớn, event listener không gỡ, timer/interval không clear, cache không giới hạn (thiếu LRU/TTL).

**6. Debug memory leak bằng gì?**
Heap snapshot qua `--inspect` + Chrome DevTools (so sánh 2 snapshot tìm object tăng), `clinic.js`, `--max-old-space-size` để giới hạn.

## 🌐 Express / API

**7. Middleware trong Express là gì?**
Hàm `(req, res, next)` chạy theo thứ tự trong pipeline. Gọi `next()` để qua middleware kế; `next(err)` nhảy tới error handler.

**8. Thứ tự error-handling middleware?**
Phải khai báo **cuối cùng**, có **4 tham số** `(err, req, res, next)`. Express nhận diện qua số arity = 4.

**9. Thiết kế REST chuẩn: status code hay dùng?**
`200` OK, `201` Created, `204` No Content, `400` Bad Request, `401` Unauthorized, `403` Forbidden, `404` Not Found, `409` Conflict, `422` Unprocessable, `429` Too Many Requests, `500` Server Error.

**10. Idempotent methods?**
`GET`, `PUT`, `DELETE`, `HEAD` idempotent (gọi nhiều lần cùng kết quả). `POST` **không** idempotent (trừ khi dùng idempotency key).

## 🔐 Auth & Security

**11. JWT vs session?**
JWT: **stateless**, server không lưu, client gửi token mỗi request — khó thu hồi sớm. Session: server lưu (Redis), gửi session id qua cookie — thu hồi dễ, nhưng cần storage chung khi scale.

**12. Refresh token rotation là gì?**
Mỗi lần dùng refresh token sẽ cấp **token mới** và **vô hiệu token cũ**. Nếu token cũ bị tái sử dụng → phát hiện trộm, hủy cả chuỗi.

**13. Access token nên sống bao lâu?**
Ngắn (vài phút–1 giờ) để giảm rủi ro nếu lộ; refresh token sống dài hơn, lưu an toàn (httpOnly cookie).

**14. Phòng SQL injection thế nào?**
Dùng **parameterized query / prepared statement**, KHÔNG nối chuỗi. ORM giúp nhưng vẫn cẩn thận raw query.

**15. `helmet` làm gì?**
Set các HTTP security header (CSP, HSTS, X-Frame-Options…) để giảm XSS, clickjacking, MIME sniffing.

**16. Rate limiting để làm gì, cài thế nào?**
Chống brute-force/DoS. Thuật toán: token bucket, sliding window; lưu counter ở **Redis** để chia sẻ giữa các instance.

## 🚀 Production

**17. Graceful shutdown làm gì?**
Bắt `SIGTERM` → ngừng nhận request mới → đóng server → đóng DB/Redis pool → exit. Tránh cắt ngang request đang chạy.

**18. Health check: liveness vs readiness?**
**Liveness**: process còn sống không (restart nếu chết). **Readiness**: sẵn sàng nhận traffic chưa (đã kết nối DB?). K8s dùng cả hai.

**19. Unit test vs integration test?**
Unit: test một hàm/đơn vị, **mock** phụ thuộc. Integration: test nhiều thành phần thật phối hợp (vd API + DB test). Cân bằng theo "test pyramid".

**20. Mocking dùng khi nào?**
Khi phụ thuộc chậm/khó kiểm soát (network, DB, thời gian). Mock để test cô lập và nhanh — nhưng đừng mock quá nhiều khiến test vô nghĩa.

---

### 🎯 Tự kiểm tra
Trơn tru ≥ 16/20 là nắm chắc Node.js advanced. Lắp bắp câu nào → mở [`README.md`](README.md) / [`DEEP-DIVE.md`](DEEP-DIVE.md) ôn phần đó.
