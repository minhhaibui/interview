# ⚡ Rapid-fire — Tuần 5: Redis

> Câu hỏi nhanh, đáp án ngắn để **ôn cấp tốc trước phỏng vấn**. Trả lời TO THÀNH TIẾNG rồi mở đáp án so. Thuật ngữ giữ tiếng Anh.

## ⚡ Vì sao nhanh & Data structures

**1. Vì sao Redis nhanh?**
Lưu trong RAM, mô hình single-thread không khoá, I/O đa hợp (epoll), cấu trúc dữ liệu tối ưu, giao thức nhị phân gọn. Bottleneck thường là mạng/băng thông chứ không phải CPU.

**2. Redis single-thread sao tận dụng nhiều core?**
Lệnh xử lý trên 1 thread (nên không cần lock), nhưng I/O và vài tác vụ nền đa luồng. Muốn dùng nhiều core → chạy nhiều instance / Cluster.

**3. 5 kiểu dữ liệu lõi + một use case mỗi loại?**
String (cache/counter), Hash (object/field), List (queue), Set (unique/quan hệ), Sorted Set (leaderboard/priority). Thêm: Stream, Bitmap, HyperLogLog, Geo.

**4. Sorted Set dùng làm gì đắt giá?**
Leaderboard (`ZADD`/`ZRANGE`), priority queue, sliding-window rate limit, lịch hẹn theo score=timestamp. Score giúp sort + range O(log n).

**5. HyperLogLog giải bài gì?**
Đếm số phần tử duy nhất (cardinality) xấp xỉ với ~12KB cho hàng tỷ phần tử, sai số ~0.81% — vd đếm DAU mà không lưu từng user.

## 🗃️ Caching Patterns

**6. Cache-aside (lazy loading) chạy sao?**
App đọc cache; miss → đọc DB → ghi lại cache → trả về. Ghi thì cập nhật DB rồi xoá/cập nhật cache. Đơn giản, phổ biến nhất.

**7. Write-through vs write-back?**
Write-through: ghi cache + DB đồng bộ (nhất quán, ghi chậm). Write-back: ghi cache trước, flush DB sau (ghi nhanh, rủi ro mất khi cache chết).

**8. TTL để làm gì? Vì sao nên thêm jitter?**
TTL tự hết hạn dữ liệu cũ. Cùng TTL cố định cho nhiều key → hết hạn đồng loạt gây stampede; thêm jitter ngẫu nhiên để rải thời điểm hết hạn.

## 💥 Ba vấn đề kinh điển

**9. Cache penetration là gì? Khắc phục?**
Query key **không tồn tại** liên tục → đập thẳng DB. Khắc phục: cache cả giá trị null (TTL ngắn), hoặc Bloom filter chặn trước.

**10. Cache breakdown (hot key) là gì?**
Một key nóng hết hạn đúng lúc nhiều request đến → đồng loạt đập DB. Khắc phục: mutex/lock chỉ cho 1 request rebuild, hoặc logical expiry (không bao giờ hết hạn cứng).

**11. Cache avalanche là gì?**
Nhiều key hết hạn cùng lúc (hoặc Redis sập) → DB quá tải. Khắc phục: TTL + jitter, HA cho Redis, circuit breaker, warm-up cache.

## 💾 Persistence

**12. RDB vs AOF?**
RDB: snapshot định kỳ — file nhỏ, restore nhanh, mất dữ liệu giữa 2 snapshot. AOF: ghi log mọi lệnh ghi — bền hơn, file lớn, restore chậm. Production thường bật cả hai.

**13. `appendfsync` các mức?**
`always` (fsync mỗi lệnh — bền nhất, chậm), `everysec` (mỗi giây — cân bằng, mặc định), `no` (để OS quyết — nhanh, rủi ro). Đa số chọn `everysec`.

## 🔒 Distributed Lock & Rate Limit

**14. Distributed lock cơ bản bằng Redis?**
`SET key val NX PX ttl` — NX đảm bảo chỉ một client chiếm, PX đặt TTL chống deadlock khi client chết. Value là token ngẫu nhiên để chỉ chủ mới mở khoá.

**15. Vì sao xoá lock phải dùng Lua?**
Kiểm "đúng chủ rồi mới DEL" phải nguyên tử; nếu tách 2 lệnh, lock có thể hết hạn + bị client khác chiếm giữa chừng → ta xoá nhầm lock của người khác.

**16. Redlock là gì? Tranh cãi gì?**
Thuật toán khoá trên N Redis độc lập, chiếm đa số mới coi là có lock. Martin Kleppmann phản biện nó không an toàn khi clock drift/GC pause — việc quan trọng nên thêm fencing token.

**17. Rate limit: fixed window vs sliding window?**
Fixed window đơn giản nhưng cho burst gấp đôi ở ranh giới cửa sổ. Sliding window (log hoặc counter nội suy) mượt hơn, chính xác hơn, tốn bộ nhớ hơn.

**18. Token bucket khác gì?**
Bù token theo tốc độ cố định, mỗi request tiêu 1 token, cho phép burst tới dung lượng bucket. Linh hoạt — hợp API cho phép bùng ngắn rồi đều.

## 🏥 HA & vận hành

**19. Sentinel vs Cluster?**
Sentinel: giám sát + tự failover cho mô hình master-replica (1 master ghi). Cluster: sharding tự động 16384 slot trên nhiều master → scale ghi ngang.

**20. Eviction policy khi đầy RAM?**
`maxmemory-policy`: `noeviction` (lỗi khi ghi), `allkeys-lru`/`lfu` (đuổi ít dùng nhất), `volatile-*` (chỉ đuổi key có TTL). Cache thuần thường dùng `allkeys-lru`.

---

### 🎯 Tự kiểm tra
Trơn tru ≥ 16/20 là nắm chắc Redis. Lắp bắp câu nào → mở [`CO-BAN.md`](CO-BAN.md) / [`README.md`](README.md) / [`DEEP-DIVE.md`](DEEP-DIVE.md) / làm [`lab`](lab/) ôn lại.
