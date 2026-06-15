# ⚡ Rapid-fire — 40 câu trả lời nhanh

> Mỗi câu trả lời TO THÀNH TIẾNG trong **30 giây**, đáp án chỉ 1-3 dòng. Dùng để khởi động trước buổi mock đầy đủ, hoặc ôn lại toàn bộ lộ trình trong 20 phút. Trong app: tab 🎯 Mock PV → chọn phạm vi "⚡ Rapid-fire", đặt 1 phút/câu.

---

## Node.js

**Q1: Event loop có những phase chính nào?**
**A:** 6 phase: timers → pending callbacks → idle/prepare → poll → check (`setImmediate`) → close callbacks. Microtask (Promise, `process.nextTick`) chạy xen giữa mỗi phase.

**Q2: `process.nextTick` khác `setImmediate` thế nào?**
**A:** `nextTick` chạy NGAY sau operation hiện tại, trước mọi phase tiếp theo (ưu tiên cao nhất, dễ starve event loop). `setImmediate` chạy ở phase check, sau poll.

**Q3: Khi nào dùng worker threads, khi nào dùng cluster?**
**A:** Worker threads cho việc CPU-bound trong cùng process (share memory được). Cluster fork nhiều process để tận dụng nhiều core cho I/O-bound HTTP server, mỗi process độc lập.

**Q4: Backpressure trong streams là gì, xử lý sao?**
**A:** Consumer chậm hơn producer làm buffer phình. `pipe()`/`pipeline()` tự xử lý: dừng đọc khi `write()` trả false, đọc tiếp khi sự kiện `drain`.

**Q5: Làm sao phát hiện event loop bị block?**
**A:** Đo event loop lag (`perf_hooks.monitorEventLoopDelay`) hoặc dùng APM. Lag cao → có code đồng bộ nặng (JSON lớn, crypto sync, vòng lặp dài).

**Q6: Các nguyên nhân memory leak phổ biến trong Node.js?**
**A:** Listener không remove (`EventEmitter`), closure giữ object lớn, cache không giới hạn (Map/object toàn cục), timer quên clear, global biến tích lũy.

**Q7: Graceful shutdown gồm những bước nào?**
**A:** Bắt SIGTERM → ngừng nhận request mới (`server.close`) → chờ request đang chạy xong (có timeout) → đóng DB/queue connection → exit 0.

**Q8: `require` (CJS) khác `import` (ESM) ở điểm nào quan trọng nhất?**
**A:** CJS load đồng bộ lúc runtime, export là object copy-by-reference. ESM load bất đồng bộ, phân tích tĩnh lúc parse (tree-shaking được), binding là live.

## SQL & Database

**Q9: Index B-tree tăng tốc truy vấn nào, vô dụng với truy vấn nào?**
**A:** Tăng tốc: so sánh =, <, >, BETWEEN, prefix LIKE 'abc%'. Vô dụng: hàm trên cột (`LOWER(email)`), LIKE '%abc', cột có cardinality thấp.

**Q10: N+1 query là gì, sửa thế nào?**
**A:** 1 query lấy danh sách + N query lấy chi tiết từng dòng. Sửa: JOIN, `IN (ids)` batch, eager loading của ORM, hoặc DataLoader.

**Q11: Kể 4 isolation level và vấn đề chúng giải quyết.**
**A:** Read uncommitted (dirty read), Read committed (chặn dirty read), Repeatable read (chặn non-repeatable read), Serializable (chặn phantom read). Càng cao càng chậm.

**Q12: Deadlock xảy ra khi nào, phòng tránh sao?**
**A:** 2 transaction giữ lock và chờ lock của nhau. Tránh: truy cập bảng/row theo cùng thứ tự, transaction ngắn, lock timeout + retry.

**Q13: Connection pool để làm gì, sizing thế nào?**
**A:** Tái dùng kết nối DB (mở kết nối rất đắt). Size ≈ số core DB × 2-4; pool quá lớn gây contention, quá nhỏ gây chờ. Luôn set timeout.

## NoSQL

**Q14: Định lý CAP nói gì?**
**A:** Khi có network Partition, hệ phân tán chỉ chọn được Consistency hoặc Availability. Ví dụ: MongoDB thiên CP, Cassandra thiên AP.

**Q15: Khi nào nên denormalize dữ liệu trong NoSQL?**
**A:** Khi read nhiều hơn write rõ rệt và cần đọc 1 document là đủ (tránh join/lookup). Đổi lại phải tự lo cập nhật dữ liệu trùng lặp.

**Q16: Tại sao MongoDB query chậm dù đã có index?**
**A:** Index không khớp query shape (sai thứ tự compound index, không theo quy tắc ESR: Equality-Sort-Range), hoặc query trả về quá nhiều document, hoặc index không vừa RAM.

## Redis

**Q17: Redis đơn luồng, tại sao vẫn nhanh?**
**A:** Toàn bộ data trong RAM, cấu trúc dữ liệu tối ưu, I/O multiplexing (epoll), không tốn chi phí lock/context-switch. Đơn luồng xử lý lệnh nhưng I/O và background task có thread riêng.

**Q18: Cache stampede là gì, 3 cách chống?**
**A:** Key hot hết hạn → hàng nghìn request cùng dồn vào DB. Chống: lock/mutex (1 request rebuild), TTL jitter ngẫu nhiên, refresh sớm trước khi hết hạn (early recompute).

**Q19: RDB khác AOF thế nào?**
**A:** RDB: snapshot định kỳ — nhanh, file nhỏ, có thể mất dữ liệu giữa 2 lần snapshot. AOF: ghi log mọi lệnh write — bền hơn, file lớn, replay chậm hơn. Production thường bật cả hai.

**Q20: Làm distributed lock bằng Redis cần lưu ý gì?**
**A:** `SET key value NX PX ttl`; value là token ngẫu nhiên, chỉ chủ token được xóa (check bằng Lua script). TTL phải dài hơn thời gian giữ lock; cần xử lý lock hết hạn giữa chừng (fencing token).

**Q21: Các chiến lược eviction của Redis?**
**A:** noeviction (báo lỗi khi đầy), allkeys-lru / volatile-lru, allkeys-lfu / volatile-lfu, random, volatile-ttl. Cache thuần thì dùng allkeys-lru/lfu.

## Kafka

**Q22: Kafka đảm bảo ordering ở mức nào?**
**A:** Chỉ trong MỘT partition. Message cùng key luôn vào cùng partition → cùng key thì có thứ tự, khác key thì không.

**Q23: Consumer group rebalance xảy ra khi nào, tác hại gì?**
**A:** Khi consumer join/leave/chết (miss heartbeat) hoặc thêm partition. Trong lúc rebalance cả group ngừng consume → lag tăng. Giảm bằng cooperative sticky assignor, tăng `max.poll.interval.ms`.

**Q24: At-least-once khác exactly-once trong Kafka thế nào?**
**A:** At-least-once: commit offset SAU khi xử lý → có thể xử lý trùng, consumer phải idempotent. Exactly-once: dùng transaction + idempotent producer, chỉ trọn vẹn trong hệ sinh thái Kafka (read-process-write).

**Q25: Khi nào message vào Dead Letter Queue?**
**A:** Khi retry xử lý thất bại quá N lần (lỗi không tự hết như data sai schema). DLQ giữ message để điều tra/replay, tránh chặn cả partition.

**Q26: Producer `acks=0/1/all` khác nhau gì?**
**A:** 0: không chờ — nhanh nhất, mất message được. 1: leader ghi xong — mất nếu leader chết trước khi replicate. all: chờ đủ ISR — bền nhất, chậm nhất; kết hợp `min.insync.replicas=2`.

## Docker

**Q27: Image khác container thế nào?**
**A:** Image là template bất biến (các layer read-only). Container là instance đang chạy của image + 1 layer ghi được ở trên cùng.

**Q28: Multi-stage build để làm gì?**
**A:** Build trong stage đầu (đủ toolchain), copy artifact sang stage cuối nhỏ gọn (alpine/distroless) → image production nhỏ, không chứa devDependencies/source.

**Q29: Layer caching hoạt động sao, tối ưu Dockerfile thế nào?**
**A:** Mỗi instruction là 1 layer, thay đổi 1 layer làm rebuild mọi layer sau nó. Tối ưu: COPY package.json + install TRƯỚC, COPY source SAU; lệnh ít đổi đặt lên trên.

## Kubernetes

**Q30: Pod, Deployment, Service khác nhau thế nào?**
**A:** Pod: đơn vị chạy nhỏ nhất (1+ container). Deployment: quản lý số replica + rolling update cho Pod. Service: endpoint ổn định (DNS + load balance) trỏ tới các Pod theo label.

**Q31: Liveness probe khác readiness probe gì?**
**A:** Liveness fail → restart container (app treo). Readiness fail → chỉ rút Pod khỏi Service, không restart (app đang bận/chưa sẵn sàng). Nhầm 2 cái này gây restart loop.

**Q32: HPA scale dựa trên gì?**
**A:** Metric: CPU/memory utilization hoặc custom metric (RPS, queue lag) so với target → tự điều chỉnh số replica giữa min/max. Cần requests/limits đặt đúng để tính %.

**Q33: ConfigMap khác Secret thế nào?**
**A:** Cả hai inject config vào Pod (env/volume). Secret dành cho dữ liệu nhạy cảm: base64, có thể mã hóa at-rest (KMS), gắn RBAC chặt hơn; ConfigMap là plain text cho config thường.

## AWS

**Q34: SQS khác SNS thế nào, khi nào dùng cả hai?**
**A:** SQS: queue — 1 consumer group kéo message, có retry/DLQ. SNS: pub/sub — đẩy 1 message tới nhiều subscriber. Fan-out pattern: SNS → nhiều SQS queue.

**Q35: S3 presigned URL dùng để làm gì?**
**A:** Cho client upload/download trực tiếp với S3 trong thời hạn ngắn mà không cần credentials — server chỉ ký URL, không phải trung chuyển file.

**Q36: IAM role khác IAM user thế nào?**
**A:** User: danh tính cố định có credentials dài hạn (cho người). Role: danh tính tạm thời được assume (cho service/EC2/Lambda), credentials tự xoay vòng — best practice cho ứng dụng.

## System Design

**Q37: Kể 3 thuật toán rate limiting và trade-off.**
**A:** Fixed window (đơn giản, burst ở biên cửa sổ), sliding window log/counter (chính xác hơn, tốn bộ nhớ hơn), token bucket (cho phép burst có kiểm soát — phổ biến nhất).

**Q38: Idempotency key hoạt động thế nào?**
**A:** Client gửi key duy nhất theo request (ví dụ UUID cho 1 lần thanh toán). Server lưu key + kết quả; request trùng key trả lại kết quả cũ thay vì xử lý lại → an toàn khi retry.

**Q39: Horizontal khác vertical scaling, vì sao web tier nên stateless?**
**A:** Vertical: tăng cấu hình 1 máy (có trần, có downtime). Horizontal: thêm máy (cần load balancer). Stateless để request nào vào máy nào cũng được — session đẩy ra Redis/DB.

**Q40: CDC (Change Data Capture) là gì, dùng khi nào?**
**A:** Bắt thay đổi từ binlog/WAL của DB rồi đẩy thành event (Debezium → Kafka). Dùng để sync search index/cache/data warehouse mà không sửa code nghiệp vụ, tránh dual-write.
