# 09 · Hệ điều hành & I/O models — Java Backend

> Nền tảng giải thích **vì sao Netty/Redis/Nginx nhanh**. Hay hỏi khi phỏng vấn Java backend (NIO, Netty). Đọc để hiểu bản chất phía dưới.

---

## 1. Process vs Thread

| | Process (tiến trình) | Thread (luồng) |
|--|----------------------|----------------|
| Không gian địa chỉ | Riêng, độc lập | Chung trong process |
| Chi phí tạo/chuyển | Nặng | Nhẹ |
| Giao tiếp | IPC (pipe, socket, shared memory…) | Chung bộ nhớ (nhưng phải đồng bộ) |
| Cô lập lỗi | Một process chết không kéo process khác | Một thread lỗi có thể sập cả process |

> Thread nhẹ hơn nhưng chia sẻ bộ nhớ → cần đồng bộ (xem bài **02 · Concurrency**). Java dùng thread; virtual thread (Java 21) còn nhẹ hơn nữa.

---

## 2. User mode vs Kernel mode & System call

- CPU chạy ở 2 chế độ: **user mode** (ứng dụng, hạn chế) và **kernel mode** (nhân HĐH, toàn quyền).
- Muốn làm việc đặc quyền (đọc file, gửi mạng) → ứng dụng gọi **system call** → chuyển sang kernel mode → làm xong quay lại.
- Chuyển đổi chế độ (mode switch) và **context switch** (đổi thread/process) có **chi phí** → nhiều I/O nhỏ hoặc nhiều thread → tốn CPU cho việc chuyển.

---

## 3. Năm mô hình I/O (câu hỏi gốc của NIO/Netty)

Khi đọc dữ liệu mạng, có 2 giai đoạn: **chờ dữ liệu sẵn sàng** (kernel nhận đủ gói) và **copy dữ liệu** (kernel → user). Các mô hình khác nhau ở cách xử lý 2 giai đoạn:

| Mô hình | Đặc điểm |
|---------|----------|
| **BIO (blocking)** | Thread bị **chặn** suốt cả 2 giai đoạn. Mỗi kết nối 1 thread → nhiều kết nối = nhiều thread, tốn kém |
| **NIO (non-blocking)** | Thread hỏi liên tục "có dữ liệu chưa?" (polling) — không chặn nhưng phí CPU nếu tự quay vòng |
| **IO multiplexing** | **select/poll/epoll**: MỘT thread theo dõi NHIỀU socket, kernel báo cái nào sẵn sàng → xử lý. Nền của Netty/Redis/Nginx |
| Signal-driven | Kernel gửi tín hiệu khi sẵn sàng |
| **AIO (async)** | Kernel làm cả chờ lẫn copy rồi báo khi XONG |

### select / poll / epoll

- **select/poll:** mỗi lần gọi phải **duyệt toàn bộ** danh sách fd → O(n), chậm khi nhiều kết nối; select giới hạn 1024 fd.
- **epoll (Linux):** đăng ký fd một lần, kernel dùng **callback** báo chính xác fd nào sẵn sàng → **O(1)** theo số fd sẵn sàng, không giới hạn cứng. Vì thế **epoll là lý do C10K/C10M khả thi** — một thread quản hàng vạn kết nối.

> Java **NIO** (`Selector`) ánh xạ tới epoll/kqueue của HĐH. **Netty** đóng gói NIO thành framework mạng hiệu năng cao (event loop = 1 thread + selector xử lý nhiều kết nối). **Redis** đơn luồng cũng nhờ IO multiplexing (xem bài 06).

---

## 4. Zero-copy (Kafka nhanh nhờ đâu)

Gửi file qua mạng kiểu thường tốn nhiều lần copy + mode switch:

```
Đĩa → kernel buffer → USER buffer → socket buffer → NIC   (4 lần copy, 4 mode switch)
```

**Zero-copy** (`sendfile`, hoặc `mmap`): dữ liệu đi thẳng từ kernel buffer → socket/NIC, **bỏ qua user space** → giảm copy & mode switch → nhanh hơn nhiều.

> **Kafka** dùng zero-copy (`sendfile`) để đẩy message từ đĩa ra consumer cực nhanh. Java: `FileChannel.transferTo()`.

---

## 5. Context switch & vì sao "ít thread hơn" đôi khi nhanh hơn

- Mỗi lần đổi thread, CPU phải lưu/khôi phục ngữ cảnh (register, stack pointer…) + làm nguội cache → **tốn**.
- Mô hình "1 thread / 1 kết nối" (BIO) với hàng vạn kết nối → hàng vạn thread → context switch điên cuồng, tốn RAM (mỗi thread ~1MB stack).
- Mô hình **event loop** (ít thread + IO multiplexing) tránh được → thông lượng cao hơn cho I/O-bound. Đây là triết lý của Netty/Node.js/Nginx.

> Virtual thread (Java 21) là cách "có cả hai": viết code kiểu blocking đơn giản, nhưng JVM lập lịch trên ít carrier thread → không bùng nổ thread OS.

---

## 6. Câu hỏi phỏng vấn hay gặp

1. Process và thread khác nhau thế nào? Vì sao thread nhẹ hơn?
2. User mode / kernel mode / system call là gì? Vì sao context switch tốn?
3. Kể 5 mô hình I/O. IO multiplexing là gì?
4. select/poll khác epoll ra sao? Vì sao epoll hiệu quả với nhiều kết nối?
5. Java NIO / Netty liên quan gì tới epoll?
6. Zero-copy là gì? Kafka nhanh nhờ đâu?
7. Vì sao event loop (ít thread) đôi khi nhanh hơn 1-thread-mỗi-kết-nối?

> Liên hệ: bài **02 · Concurrency** (thread, đồng bộ) và **06 · Redis** (đơn luồng + IO multiplexing).
