# Tuần 12: Mock Interview & Tổng ôn

## 🎯 Mục tiêu tuần này

- Tổng ôn toàn bộ 11 tuần dưới dạng **flash questions** — phát hiện và vá lỗ hổng kiến thức.
- Hoàn thành **1 mock technical interview** (30 câu xuyên stack) + **2 mock system design** (45 phút/đề) trong điều kiện như thật.
- Chuẩn bị **behavioral questions theo STAR method** — 10 câu mẫu có câu chuyện riêng của bạn.
- Hoàn thiện CV, danh sách câu hỏi ngược nhà tuyển dụng, và nắm nguyên tắc negotiation cơ bản.
- **Final test**: 50 câu quiz tổng hợp toàn stack, pass khi ≥ 40/50.
- Kết thúc tuần: sẵn sàng ứng tuyển và phỏng vấn thật.

---

## 📚 Lý thuyết

Tuần này không học kiến thức mới — toàn bộ là ÔN + LUYỆN trong điều kiện mô phỏng phỏng vấn thật. Lịch 6 ngày:

### Ngày 1-2: Rapid Review — Flash checklist toàn bộ 11 tuần (cơ bản)

Cách dùng: che phần gợi ý, đọc câu hỏi, **nói to câu trả lời trong ≤ 60 giây**. Trả lời được mượt → tick. Ấp úng → mở lại README tuần tương ứng ôn ngay 15-30 phút rồi quay lại. Mục tiêu: tick ≥ 90% sau 2 ngày.

**Tuần 1 — Node.js Core**
- [ ] Event loop có những phase nào? `setTimeout` vs `setImmediate` vs `process.nextTick` vs microtask chạy thứ tự ra sao?
- [ ] Vì sao Node.js xử lý được nhiều concurrent connections với 1 thread? Khi nào mô hình này thua thread-based?
- [ ] Streams: 4 loại? Backpressure là gì, `pipe`/`pipeline` xử lý thế nào? Vì sao đọc file 2GB phải dùng stream?
- [ ] CommonJS vs ESM khác nhau gì (hoisting, cách load, top-level await)?
- [ ] Buffer là gì? `Buffer.alloc` vs `allocUnsafe`?
- [ ] Error handling: vì sao callback lỗi phải `return callback(err)`? `uncaughtException` vs `unhandledRejection` nên xử lý sao?

**Tuần 2 — Node.js Advanced**
- [ ] Cluster module hoạt động thế nào? Khác gì worker threads? Khi nào dùng cái nào?
- [ ] CPU-bound task làm gì để không block event loop? (worker threads, offload sang service khác, chia nhỏ bằng `setImmediate`)
- [ ] Memory leak trong Node thường do đâu (closure giữ tham chiếu, global cache không giới hạn, listeners không remove)? Debug bằng gì (heap snapshot, `--inspect`, clinic.js)?
- [ ] Đo và xử lý event loop lag thế nào?
- [ ] Security: top lỗ hổng phải kể được — SQL injection, XSS, CSRF, prototype pollution, ReDoS — và cách chống (parameterized query, helmet, validation, rate limit)?
- [ ] Graceful shutdown đầy đủ gồm những bước nào?

**Tuần 3 — SQL Database**
- [ ] B-tree index hoạt động thế nào? Vì sao index làm chậm write? Composite index — quy tắc leftmost prefix?
- [ ] Khi nào query KHÔNG dùng index (function trên column, leading wildcard, type mismatch, selectivity thấp)?
- [ ] 4 isolation levels + anomaly tương ứng (dirty read, non-repeatable read, phantom read)? Default của PostgreSQL?
- [ ] Optimistic vs pessimistic locking? `SELECT ... FOR UPDATE` làm gì? Deadlock xảy ra và phòng thế nào?
- [ ] Đọc `EXPLAIN ANALYZE`: seq scan vs index scan, khi nào planner chọn seq scan?
- [ ] N+1 query là gì, fix thế nào? Connection pool vì sao bắt buộc?

**Tuần 4 — NoSQL & Database Design**
- [ ] MongoDB: embed vs reference — quyết định dựa trên gì (cardinality, access pattern, kích thước doc 16MB)?
- [ ] Replica set: election, write concern, read preference? Sharding: shard key chọn thế nào?
- [ ] Khi nào chọn SQL, khi nào NoSQL? (câu này 99% bị hỏi)
- [ ] Chuẩn hóa (1NF-3NF) vs denormalization — trade-off?
- [ ] Transaction trong MongoDB có không, giới hạn gì?

**Tuần 5 — Redis**
- [ ] Data structures và use case từng cái: String (cache, counter), Hash (object), List (queue), Set, Sorted Set (leaderboard, sliding window), Streams?
- [ ] Vì sao Redis nhanh? Single-threaded có ý nghĩa gì với atomic operations?
- [ ] Cache-aside / write-through / write-behind? Stampede, penetration, hot key — giải pháp?
- [ ] Distributed lock đúng cách: SET NX PX + Lua release? Vì sao cần value = owner id? Hạn chế của Redlock?
- [ ] Persistence: RDB vs AOF? Eviction policies (`allkeys-lru`...)?
- [ ] Redis Cluster vs Sentinel?

**Tuần 6 — Kafka**
- [ ] Topic, partition, offset, consumer group — vẽ lại được mô hình? Số consumer > số partition thì sao?
- [ ] Ordering đảm bảo ở mức nào? Partition key dùng làm gì?
- [ ] At-most/at-least/exactly-once? Idempotent producer (`acks=all`, `enable.idempotence`)? Consumer commit offset trước hay sau khi xử lý — hệ quả?
- [ ] Rebalance khi nào xảy ra, tác hại, giảm thiểu thế nào?
- [ ] Consumer lag là gì, monitor và xử lý sao? DLQ pattern?
- [ ] Kafka vs RabbitMQ vs SQS — chọn theo tiêu chí gì?

**Tuần 7 — Docker**
- [ ] Container vs VM? Image layers và build cache — vì sao COPY package.json trước COPY source?
- [ ] Multi-stage build lợi gì? Vì sao chạy non-root user?
- [ ] CMD vs ENTRYPOINT? EXPOSE có thực sự mở port không?
- [ ] Docker networking: bridge, host; container gọi nhau bằng gì trong compose?
- [ ] Volume vs bind mount? PID 1 problem và signal handling trong Node container?

**Tuần 8 — Kubernetes**
- [ ] Pod, Deployment, ReplicaSet, Service (ClusterIP/NodePort/LoadBalancer), Ingress — vai trò từng cái?
- [ ] Liveness vs readiness vs startup probe?
- [ ] Rolling update hoạt động thế nào (`maxSurge`, `maxUnavailable`)? Rollback?
- [ ] HPA scale dựa trên gì? requests vs limits — OOMKilled khi nào?
- [ ] ConfigMap vs Secret? Pod chết thì điều gì xảy ra (restartPolicy, rescheduling)?
- [ ] StatefulSet khác Deployment gì, khi nào cần?

**Tuần 9 — AWS**
- [ ] EC2 vs Lambda vs ECS/Fargate vs EKS — chọn theo tiêu chí gì?
- [ ] S3: storage classes, presigned URL, static hosting?
- [ ] RDS Multi-AZ vs Read Replica — khác nhau mục đích (HA vs scale read)?
- [ ] SQS vs SNS vs EventBridge? SQS visibility timeout, DLQ?
- [ ] IAM: user vs role vs policy? Vì sao EC2/Lambda nên dùng role thay vì access key?
- [ ] VPC cơ bản: public/private subnet, security group vs NACL, NAT gateway?
- [ ] ElastiCache, MSK, CloudWatch — map với stack capstone thế nào?

**Tuần 10 — System Design** (ôn bằng cách vẽ lại trên giấy trắng, mỗi cái ≤ 5 phút)
- [ ] Framework 5 bước + phân bổ thời gian 45 phút?
- [ ] Vẽ: token bucket rate limiter trên Redis; circuit breaker state machine; saga choreography order flow; outbox pattern.
- [ ] CAP/PACELC giải thích trong 1 phút + 2 ví dụ chọn CP/AP?
- [ ] Thứ tự scale database (tune → cache → replicate → shard)?
- [ ] 4 bài kinh điển: URL shortener, rate limiter, notification system, order system — nói lại key points mỗi bài ≤ 3 phút?

**Tuần 11 — Capstone** (ôn bằng video demo đã quay + BUGLOG.md)
- [ ] Vẽ lại kiến trúc capstone trong 3 phút không nhìn tài liệu?
- [ ] Kể trơn tru 15 câu "kể về project" trong week-11? Đặc biệt: outbox, oversell, idempotency 2 tầng, bug khó nhất?
- [ ] Nhớ các con số: p95 latency, throughput, saga end-to-end time, image size?

### Ngày 3-4: Mock Technical Interview & Mock System Design (trung cấp)

**Ngày 3 — Mock technical interview script (30 câu xuyên stack)**

Cách làm: lý tưởng nhất là nhờ bạn bè/mentor đóng vai interviewer đọc lần lượt (script dưới có thứ tự từ dễ → khó như phỏng vấn thật, 60-90 phút). Không có ai hỏi → tự ghi âm: đọc câu hỏi, trả lời thành tiếng 1-2 phút, nghe lại và chấm. **Chấm**: 2đ trả lời đúng + có trade-off/ví dụ; 1đ đúng nhưng nông; 0đ sai/ấp úng. Pass: ≥ 45/60.

*Khởi động (1-6):*
1. Event loop của Node.js hoạt động thế nào? Điều gì xảy ra khi một handler chạy CPU 5 giây?
2. `async/await` thực chất là gì? Lỗi trong `async function` không catch thì đi đâu?
3. `Promise.all` vs `Promise.allSettled` vs `Promise.race` — khi nào dùng từng cái?
4. Vì sao phải dùng parameterized query? Demo một SQL injection đơn giản.
5. HTTP status codes: 200 vs 201 vs 202 vs 204; 401 vs 403; 429; 502 vs 503 vs 504?
6. JWT hoạt động thế nào? Lưu ở đâu phía client và vì sao? Revoke JWT bằng cách nào?

*Node.js sâu (7-12):*
7. Cluster module vs worker threads vs child process — phân biệt và use case?
8. Backpressure trong streams là gì? Điều gì xảy ra nếu bỏ qua giá trị trả về của `writable.write()`?
9. Memory leak: kể 3 nguyên nhân phổ biến và quy trình debug của bạn?
10. `process.nextTick` lạm dụng thì gây ra vấn đề gì?
11. Làm sao đo event loop lag trong production và ngưỡng nào đáng báo động?
12. Graceful shutdown: viết pseudo-code đầy đủ cho một service có HTTP server + Kafka consumer + DB pool.

*Database (13-18):*
13. Composite index `(a, b, c)`: query nào dùng được, query nào không?
14. Transaction isolation: tài khoản ngân hàng bị double-spend ở READ COMMITTED thế nào? Fix bằng gì (SELECT FOR UPDATE / serializable / optimistic version)?
15. Bảng 100M rows, query chậm dần — quy trình chẩn đoán và các phương án xử lý theo thứ tự?
16. MongoDB embed vs reference: thiết kế schema cho bài toán user-orders-products?
17. Replication lag gây vấn đề gì cho hệ thống đọc replica? Giải pháp?
18. Khi nào bạn CHỌN NoSQL thay vì PostgreSQL? Cho ví dụ cụ thể từ capstone.

*Redis & Kafka (19-24):*
19. Thiết kế distributed lock bằng Redis đúng cách — những lỗi kinh điển nào phải tránh?
20. Cache stampede và 3 cách xử lý?
21. Kafka consumer group rebalance: khi nào xảy ra và bạn đã thấy hệ quả gì trong capstone?
22. Consumer commit offset trước khi xử lý vs sau khi xử lý — hệ quả mỗi cách? Bạn chọn gì?
23. Làm sao đảm bảo không mất event giữa "ghi DB" và "publish Kafka"? (kỳ vọng: outbox)
24. Consumer lag tăng liên tục — các bước chẩn đoán và xử lý?

*Infra & Design (25-30):*
25. Multi-stage Dockerfile của bạn trông thế nào và tiết kiệm được gì?
26. Liveness vs readiness probe — vì sao readiness không nên check DB... hay là nên? Tranh luận 2 chiều.
27. Rolling update không downtime cần những điều kiện gì từ phía application?
28. RDS Multi-AZ vs read replica? Hệ thống của bạn dùng gì cho HA và gì cho scale?
29. Thiết kế idempotency cho POST /payments — đầy đủ các edge case (concurrent, retry, TTL)?
30. Walk me through your capstone architecture + nếu traffic x10 thì vỡ ở đâu trước?

**Ngày 4 — Mock System Design (2 đề × 45 phút, như thật)**

Setup: bấm giờ, vẽ trên giấy/whiteboard/Excalidraw, NÓI THÀNH TIẾNG toàn bộ (ghi âm), không tra tài liệu. Dùng checklist 10 tiêu chí của tuần 10 để chấm (file `../week-10-system-design/README.md`, Phần 1 bài test) — pass khi mỗi đề ≥ 16/20.

> **Đề 1: Design a Chat Application** (1-1 + group chat, 10M DAU, online status, message history, đã xem/chưa xem; trọng tâm: WebSocket ở scale, fan-out message, ordering trong group, lưu trữ message).
> *Gợi ý đối chiếu sau khi làm*: WebSocket gateway stateless + Redis pub/sub hoặc Kafka để route giữa các gateway node; connection registry (user → gateway node) trong Redis; message ID theo Snowflake để ordering; lưu Cassandra/DynamoDB partition theo conversation_id; online status bằng heartbeat + TTL; group lớn dùng fan-out-on-read.

> **Đề 2: Design a Payment Webhook Processing System** (nhận webhook từ Stripe-like provider, 5K/s peak, không mất, không xử lý trùng, retry từ provider, thứ tự không đảm bảo; trọng tâm: idempotency, durability, out-of-order handling).
> *Gợi ý đối chiếu*: endpoint mỏng — verify signature → ghi raw event vào DB/Kafka NGAY rồi trả 200 (không xử lý sync); idempotency theo provider event id (unique constraint); xử lý async qua queue + DLQ; out-of-order giải bằng state machine chỉ cho phép transition hợp lệ + version/timestamp; reconciliation job đối soát với provider API.

Sau mỗi đề: nghe lại ghi âm, tự chấm, ghi 3 điểm cần cải thiện. Nếu đề nào < 16/20 → làm thêm 1 đề bù vào ngày 6 (đề bù: design news feed).

### Ngày 5-6: Behavioral, CV & Negotiation (nâng cao)

**Ngày 5 — Behavioral questions theo STAR method**

**STAR** = **S**ituation (bối cảnh, 1-2 câu) → **T**ask (nhiệm vụ/trách nhiệm CỦA BẠN) → **A**ction (bạn đã làm gì — phần dài nhất, nói "tôi" không phải "chúng tôi") → **R**esult (kết quả ĐO ĐƯỢC + bài học). Mỗi câu trả lời 2-3 phút. Hôm nay: viết outline STAR cho cả 10 câu bằng trải nghiệm THẬT của bạn (capstone và project công ty đều dùng được), rồi tập nói từng câu 2 lần.

1. **"Kể về một bug khó nhất bạn từng xử lý."** — *Gợi ý*: dùng bug trong BUGLOG.md capstone hoặc bug production thật. Nhấn vào QUY TRÌNH debug (đọc log theo correlation ID → tái hiện → cô lập → fix → thêm test/alert chống tái diễn). Result: thời gian giải quyết + biện pháp phòng ngừa.
2. **"Kể về lần bạn phải đánh đổi giữa chất lượng và deadline."** — *Gợi ý*: nói về technical debt có kiểm soát: cắt scope chứ không cắt chất lượng phần core, ghi rõ TODO/ticket, quay lại trả nợ. Tránh trả lời "tôi luôn chọn chất lượng" (thiếu thực tế) hoặc "cứ ship bừa" (thiếu trách nhiệm).
3. **"Kể về lần bạn bất đồng quan điểm kỹ thuật với đồng nghiệp/sếp."** — *Gợi ý*: nhấn vào cách tranh luận bằng DATA (benchmark, PoC, trade-off table), lắng nghe ý kiến đối phương, và chấp nhận disagree-and-commit nếu quyết định cuối khác ý mình. Kết quả tốt cả khi bạn đúng lẫn khi bạn sai (học được gì).
4. **"Kể về lần bạn làm hỏng/gây sự cố production."** — *Gợi ý*: chọn sự cố thật, nhận trách nhiệm thẳng (không đổ lỗi), kể quy trình xử lý (rollback, communicate, postmortem blameless), và biện pháp hệ thống để không tái diễn (CI check, migration review, alert). Câu này đánh giá ownership — giấu giếm hoặc "em chưa từng gây lỗi" là red flag.
5. **"Kể về lần bạn phải học công nghệ mới trong thời gian ngắn."** — *Gợi ý*: dùng chính lộ trình 12 tuần này (Kafka/K8s từ con số 0 → capstone chạy được). Nhấn phương pháp học: docs chính thống → build ngay thứ nhỏ → đập vỡ và sửa → dạy lại được người khác.
6. **"Kể về lần bạn nhận feedback tiêu cực."** — *Gợi ý*: feedback cụ thể (vd code review chê PR quá to, thiếu test), phản ứng đầu tiên (cảm ơn, hỏi rõ ví dụ), hành động thay đổi đo được (PR nhỏ hơn, coverage tăng), và follow-up xin feedback lại.
7. **"Kể về lần bạn phải thuyết phục team thay đổi cách làm."** — *Gợi ý*: cấu trúc: phát hiện vấn đề bằng số liệu → đề xuất nhỏ ít rủi ro (pilot) → kết quả pilot thuyết phục → nhân rộng. Vd: thêm structured logging/correlation ID giúp giảm thời gian debug.
8. **"Kể về lần bạn phải xử lý nhiều việc gấp cùng lúc — bạn ưu tiên thế nào?"** — *Gợi ý*: framework ưu tiên rõ ràng (impact × urgency; sự cố production > deadline > việc dài hạn), communicate sớm với stakeholder về cái bị hoãn, nhờ trợ giúp đúng lúc thay vì ôm hết.
9. **"Tại sao bạn rời công ty hiện tại / tại sao ứng tuyển vị trí này?"** — *Gợi ý*: hướng về phía TRƯỚC (muốn làm hệ thống scale lớn hơn, học từ team giỏi hơn, domain mới) — tuyệt đối không nói xấu công ty/sếp cũ. Nối với điểm cụ thể của công ty đang ứng tuyển (sản phẩm, stack, văn hóa engineering).
10. **"Điểm yếu lớn nhất của bạn là gì?"** — *Gợi ý*: điểm yếu THẬT nhưng không chí mạng với vị trí + đang khắc phục có bằng chứng. Vd: "Em từng ôm việc quá lâu trước khi hỏi — giờ em đặt quy tắc kẹt 45 phút là phải hỏi kèm theo những gì đã thử." Tránh đáp án sáo rỗng kiểu "em quá cầu toàn".

**Ngày 6 — CV, câu hỏi ngược & negotiation**

**CV checklist (1 trang, PDF):**
- [ ] Mỗi bullet theo công thức **X-Y-Z**: "Làm được X, đo bằng Y, nhờ cách Z" — vd: *"Giảm p95 latency API từ 800ms → 120ms (Y) bằng Redis cache-aside + composite index (Z) cho service catalog (X)"*.
- [ ] Có số liệu ở ≥ 50% bullets (latency, throughput, % lỗi, thời gian build, số user).
- [ ] Capstone project có mặt với 3-4 bullets: kiến trúc (microservices, Kafka saga, outbox), con số load test, link GitHub.
- [ ] Skills xếp theo nhóm: Languages / Backend / Databases / Infra — chỉ liệt kê thứ sẵn sàng bị hỏi sâu.
- [ ] Không lỗi chính tả; tense nhất quán; không ảnh/tuổi/thông tin thừa (tùy thị trường); file tên `Ho-Ten-Backend-Engineer.pdf`.
- [ ] Nhờ 1 người khác đọc 30 giây rồi hỏi họ nhớ được gì — đó là thông điệp thực sự của CV bạn.

**Câu hỏi ngược nhà tuyển dụng (chọn 3-4 mỗi buổi, hỏi thật — đây cũng là cách bạn đánh giá họ):**
1. "Một ngày/sprint điển hình của team trông như thế nào? Quy trình từ idea đến production?"
2. "Hệ thống hiện tại đau nhất ở đâu về mặt kỹ thuật? Team đang định giải quyết thế nào?"
3. "Quy trình on-call và xử lý sự cố thế nào? Có postmortem blameless không?"
4. "Em sẽ được đánh giá bằng tiêu chí gì trong 6 tháng đầu? Thế nào là 'làm tốt' ở vị trí này?"
5. "Lộ trình thăng tiến engineer ở công ty — từ vị trí này lên senior/lead cần gì?"
6. "Tỷ lệ thời gian giữa feature mới vs trả technical debt?"
7. "Điều gì khiến anh/chị ở lại công ty này?" (hỏi chính interviewer — câu trả lời rất lộ thông tin)

**Negotiation cơ bản:**
- **Trước**: khảo sát mặt bằng lương vị trí + thị trường của bạn (hỏi bạn bè cùng level, cộng đồng, các báo cáo lương). Xác định 3 con số: lý tưởng / hài lòng / sàn (dưới mức này từ chối).
- **Khi bị hỏi lương mong muốn sớm**: trì hoãn lịch sự — "Em muốn hiểu rõ scope công việc trước; anh/chị có thể chia sẻ range budget của vị trí không?" Nếu buộc phải nói → nói RANGE với cận dưới = mức hài lòng của bạn.
- **Khi nhận offer**: KHÔNG nhận lời ngay tại chỗ — xin 2-3 ngày cân nhắc (hoàn toàn bình thường). Negotiate bằng dữ kiện: offer khác đang có, mặt bằng thị trường, giá trị cụ thể bạn mang lại — không bằng hoàn cảnh cá nhân.
- **Tổng package, không chỉ lương**: lương cứng, thưởng, review cycle (6 tháng hay 12), ngày phép, remote/hybrid, budget học tập, equity (nếu có — hỏi rõ vesting).
- Nguyên tắc: bên nào đưa số trước thường bất lợi; mọi thứ đã thỏa thuận → xin XÁC NHẬN BẰNG VĂN BẢN (offer letter) trước khi báo nghỉ công ty cũ.
- Từ chối offer cũng phải lịch sự và giữ quan hệ — thị trường rất nhỏ.

---

## 💬 Top 15 câu hỏi phỏng vấn thường gặp

Tuần này là 15 câu "meta + tổng hợp" — những câu gần như chắc chắn gặp ở mọi buổi phỏng vấn, luyện đến mức phản xạ:

**Q1: Giới thiệu về bản thân bạn (Tell me about yourself).**
**A:** Cấu trúc 60-90 giây: hiện tại (vai trò + stack chính) → quá khứ chọn lọc (1-2 thành tích nổi bật có số liệu) → tương lai (vì sao vị trí này). Ví dụ: "Em là backend engineer 3 năm kinh nghiệm Node.js, hiện làm hệ thống X phục vụ Y users. Gần đây em xây hệ thống order processing microservices với Kafka, PostgreSQL, K8s — xử lý được Z orders/s với saga pattern đảm bảo consistency. Em ứng tuyển vì muốn làm hệ thống quy mô lớn hơn ở mảng [domain của công ty]."

**Q2: Vì sao chọn Node.js cho backend? Khi nào KHÔNG nên dùng Node.js?**
**A:** Node hợp I/O-bound workload — API, real-time, microservices — nhờ event loop non-blocking xử lý hàng chục nghìn concurrent connections với ít tài nguyên, cùng hệ sinh thái npm và một ngôn ngữ cho cả stack. Không nên dùng cho CPU-bound nặng (xử lý ảnh/video, ML, tính toán khoa học) vì block event loop — khi đó dùng worker threads hoặc tách sang Go/Rust/Python service riêng.

**Q3: Mô tả flow một HTTP request từ browser đến database trong hệ thống của bạn.**
**A:** DNS resolve → TCP/TLS handshake → CDN/edge nếu có → load balancer (L7, terminate TLS) → API gateway (rate limit, auth, routing) → service Node.js: middleware chain (logging với request-id, validate, authorize) → business logic → connection pool lấy connection → query DB (qua index) → response ngược lại, có thể được cache ở Redis/CDN cho lần sau. Nêu được điểm fail và độ trễ ở từng chặng là điểm cộng.

**Q4: Sự khác nhau giữa authentication và authorization? Bạn implement thế nào?**
**A:** Authentication xác minh "bạn là ai" (login → JWT/session), authorization xác minh "bạn được làm gì" (role/permission check). Em dùng JWT ngắn hạn (15 phút) + refresh token rotation lưu httpOnly cookie; authorization bằng middleware check role/permission per route, và resource-level check ở service layer (user chỉ xem order của mình). Revoke bằng blacklist refresh token trong Redis.

**Q5: Làm sao bạn đảm bảo chất lượng code? Quy trình test của bạn?**
**A:** Testing pyramid: unit test cho business logic (nhanh, nhiều), integration test với testcontainers cho repository/API layer, ít E2E cho flow chính. Kèm CI chạy lint + test mỗi PR, code review bắt buộc, và coverage có ý nghĩa hơn coverage cao — em ưu tiên test behavior chứ không test implementation detail.

**Q6: REST API tốt khác REST API tồi ở điểm gì?**
**A:** Tốt: resource-oriented URL, đúng HTTP verbs và status codes, versioning, pagination cursor-based cho data lớn, error response nhất quán có error code, idempotency cho retry, rate limit headers, tài liệu OpenAPI. Tồi: verbs trong URL (`/getUser`), 200 cho mọi response kể cả lỗi, trả stack trace cho client, breaking change không version.

**Q7: Bạn debug một API đang chậm ở production như thế nào?**
**A:** Theo thứ tự: dashboard metrics xác định phạm vi (endpoint nào, từ khi nào, p95 hay toàn bộ) → distributed tracing tìm span chậm (DB? external call? event loop?) → nếu DB: EXPLAIN ANALYZE query nghi vấn, check index, lock contention → nếu Node: event loop lag, GC pause, heap. Fix xong thêm alert cho metric đó. Nhấn mạnh: đo trước, đoán sau — không tối ưu mù.

**Q8: Race condition là gì? Kể một race condition bạn từng gặp và cách fix.**
**A:** Hai luồng xử lý truy cập cùng resource và kết quả phụ thuộc thứ tự thực thi. Ví dụ từ capstone: hai request cùng trừ tồn kho — read-check-write không atomic nên cả hai đều thấy stock đủ. Fix bằng atomic conditional update (`UPDATE ... WHERE stock >= qty`) thay vì read-rồi-write, hoặc distributed lock khi flow phức tạp. Node.js single-threaded nhưng race vẫn xảy ra giữa các await và giữa các instance.

**Q9: Eventual consistency là gì — giải thích cho người không chuyên?**
**A:** Hệ thống tạm thời cho phép các nơi nhìn thấy dữ liệu khác nhau, nhưng đảm bảo cuối cùng tất cả hội tụ về cùng một giá trị. Như chuyển tiền liên ngân hàng: tiền trừ ngay ở tài khoản gửi nhưng vài phút sau mới hiện ở tài khoản nhận — trạng thái trung gian được chấp nhận, miễn kết quả cuối đúng. Đổi lại được availability và performance cao hơn strong consistency.

**Q10: Monolith của công ty đang chậm và khó maintain — bạn được giao cải thiện, bạn làm gì?**
**A:** Không vội tách microservices. Bước 1: đo — APM, slow query log, build time, tìm pain point thật. Bước 2: low-hanging fruits — index, cache, N+1. Bước 3: modular hóa bên trong monolith theo domain boundary. Bước 4: nếu vẫn có module cần scale/release độc lập → tách DẦN bằng Strangler Fig, bắt đầu từ module ít phụ thuộc nhất. Tách vội khi chưa rõ boundary là đổi một vấn đề lấy mười vấn đề phân tán.

**Q11: Bạn handle secret (DB password, API key) thế nào qua các môi trường?**
**A:** Không bao giờ commit vào git (thêm gitleaks/secret scanning vào CI); local dùng `.env` (gitignored); staging/production dùng secret manager — K8s Secret (tốt hơn: External Secrets + AWS Secrets Manager/Vault), inject qua env vars hoặc mounted file; rotate định kỳ; IAM role thay cho access key tĩnh khi chạy trên AWS; least privilege cho mỗi service.

**Q12: CI/CD pipeline lý tưởng của bạn cho một Node.js microservice?**
**A:** PR: lint + typecheck + unit test + integration test (testcontainers) + security scan (npm audit, gitleaks) — xanh mới được merge. Merge vào main: build Docker image (multi-stage, tag bằng git SHA), push registry, deploy tự động lên staging, chạy smoke test. Production: deploy qua GitOps (ArgoCD) hoặc manual approval, rolling update với readiness probe, rollback một lệnh khi metrics xấu.

**Q13: Sự khác nhau giữa scale ứng dụng stateless và stateful?**
**A:** Stateless chỉ cần thêm instance sau LB — mọi state đẩy ra ngoài (Redis, DB, S3). Stateful khó hơn nhiều: cần sticky session hoặc state replication, scale down phải drain, storage gắn với instance — như database phải replication/sharding với consistency phức tạp. Nguyên tắc thiết kế của em: đẩy mọi state về tầng data chuyên dụng, giữ tầng app stateless tuyệt đối.

**Q14: Bạn còn yếu phần nào trong stack này? (câu bẫy trung thực)**
**A:** Trả lời thật + kế hoạch: ví dụ "Em mạnh ở Node.js, database và messaging; phần em đang còn mỏng là vận hành K8s ở quy mô production — em mới dùng ở mức kind/minikube và hiểu manifests, probes, HPA qua capstone, chưa từng vận hành cluster nhiều node thật. Em đang bù bằng [tài liệu/khóa cụ thể]." Trung thực + tự nhận thức tốt ăn điểm hơn là vờ biết hết rồi bị xoáy sập.

**Q15: Bạn có câu hỏi gì cho chúng tôi không?**
**A:** LUÔN có — không hỏi gì là dấu hiệu thiếu quan tâm. Chọn 3 câu từ danh sách Ngày 6, ưu tiên: pain point kỹ thuật hiện tại của team, tiêu chí đánh giá 6 tháng đầu, và quy trình on-call/postmortem. Tránh hỏi lương/phép ở vòng kỹ thuật — để dành cho HR/offer stage.

---

## 💪 Bài tập thực hành (bắt buộc)

### Bài 1: Vá lỗ hổng từ flash review (Ngày 1-2) — Dễ
Sau khi chạy hết flash checklist: lập danh sách các mục chưa tick, nhóm theo tuần, ôn lại và TỰ VIẾT tóm tắt mỗi chủ đề yếu thành 5-7 dòng (viết lại bằng lời mình = nhớ lâu). Mục tiêu: 100% checklist tick trước Ngày 3.

### Bài 2: Mock technical interview 30 câu (Ngày 3) — Trung bình
Thực hiện đầy đủ script 30 câu như mô tả Ngày 3 (có người hỏi hoặc tự ghi âm). Chấm điểm theo thang 0-2/câu. Với mọi câu ≤ 1 điểm: viết lại câu trả lời chuẩn ra giấy và nói lại 2 lần. Nộp: bảng điểm 30 câu + danh sách câu phải luyện lại.

### Bài 3: Mock system design 2 đề (Ngày 4) — Khó
Làm 2 đề (Chat App + Payment Webhook) đúng điều kiện thật: 45 phút/đề, ghi âm, vẽ tay. Tự chấm theo checklist 10 tiêu chí tuần 10. Nộp: ảnh diagram + bảng điểm + 3 điểm cải thiện mỗi đề.

### Bài 4: 10 bộ STAR cá nhân (Ngày 5) — Trung bình
Viết outline STAR (4-6 dòng/câu) cho cả 10 behavioral questions bằng trải nghiệm thật của bạn. Quay video tự trả lời 3 câu khó nhất (1, 4, 9), xem lại và sửa: lan man? thiếu Result đo được? nói "chúng tôi" thay vì "tôi"?

### Bài 5: Hồ sơ ứng tuyển hoàn chỉnh (Ngày 6) — Khó
Hoàn thiện bộ hồ sơ: CV 1 trang theo checklist (PDF) + GitHub capstone repo đã polish (README, ARCHITECTURE, demo GIF/video) + LinkedIn cập nhật + danh sách 5 công ty mục tiêu kèm range lương dự kiến và 3 con số negotiation của bạn (lý tưởng/hài lòng/sàn). Nhờ ít nhất 1 người review CV.

---

## 📝 Bài test cuối tuần

### Phần 1: FINAL TEST — 50 câu quiz tổng hợp toàn stack

> Thay cho quiz 15 câu hàng tuần. Làm 1 lần duy nhất, không tra tài liệu, tối đa 100 phút. **Pass: ≥ 40/50.** Mỗi câu sai → ghi lại tuần tương ứng để ôn.

#### Node.js (câu 1-8)

**Câu 1:** Thứ tự output của: `setTimeout(f,0)`, `setImmediate(g)`, `process.nextTick(h)`, `Promise.resolve().then(k)` (chạy trong main module)?
- A. f → g → h → k
- B. h → k → f → g (f/g có thể đảo tùy môi trường)
- C. k → h → f → g
- D. h → k → g → f (luôn cố định)

<details><summary>Đáp án</summary>

**B.** `nextTick` queue chạy trước microtask queue (Promise), cả hai chạy trước khi event loop tiếp tục; `setTimeout 0` vs `setImmediate` trong main module thứ tự không xác định (phụ thuộc thời điểm vào timers phase), nhưng trong I/O callback thì `setImmediate` luôn trước.
</details>

**Câu 2:** Một endpoint chạy `JSON.parse` payload 200MB. Hệ quả?
- A. Không sao, Node xử lý async
- B. Block event loop trong suốt thời gian parse — mọi request khác trên process đó bị treo
- C. Node tự đẩy sang thread pool
- D. Chỉ request đó chậm, các request khác bình thường

<details><summary>Đáp án</summary>

**B.** `JSON.parse` là synchronous CPU-bound, chạy trên main thread. Thread pool (libuv) chỉ phục vụ một số việc như fs, crypto, dns — không phải JS code của bạn. Fix: streaming parser, giới hạn payload size, hoặc worker thread.
</details>

**Câu 3:** `writable.write(chunk)` trả về `false` nghĩa là gì?
- A. Ghi thất bại, phải retry
- B. Internal buffer vượt highWaterMark — nên dừng ghi và chờ event `drain` (backpressure)
- C. Stream đã đóng
- D. Chunk quá lớn

<details><summary>Đáp án</summary>

**B.** Đây là tín hiệu backpressure. Ghi vẫn được nhận vào buffer (không fail), nhưng tiếp tục ghi bất chấp sẽ phình memory. `pipeline()`/`pipe()` xử lý tự động việc này.
</details>

**Câu 4:** Cluster module và worker threads khác nhau cốt lõi:
- A. Cluster nhanh hơn worker threads
- B. Cluster fork nhiều PROCESS (memory riêng, share port qua master) — scale I/O qua nhiều core; worker threads là THREAD trong cùng process (share memory được qua SharedArrayBuffer) — cho CPU-bound task
- C. Worker threads chỉ dùng được trên Linux
- D. Giống nhau, hai tên cho một thứ

<details><summary>Đáp án</summary>

**B.** Chọn cluster/PM2 để tận dụng multi-core cho HTTP server; worker threads để offload tính toán nặng khỏi event loop. Trên K8s, thường bỏ cluster mà chạy nhiều pod 1-process.
</details>

**Câu 5:** `unhandledRejection` xử lý đúng đắn trong production là:
- A. Bỏ qua, Node tự xử lý
- B. Log đầy đủ rồi tiếp tục chạy mãi mãi
- C. Log + metrics, và coi như bug phải fix; với `uncaughtException` thì log rồi graceful shutdown vì process đã ở trạng thái không xác định
- D. Restart máy chủ

<details><summary>Đáp án</summary>

**C.** Sau `uncaughtException` state có thể hỏng (connection dở dang, lock chưa nhả) — tiếp tục chạy là rủi ro; đúng bài là log, đóng graceful, để orchestrator (K8s/PM2) restart. Từ Node 15+, unhandledRejection mặc định cũng crash process.
</details>

**Câu 6:** Cách nào sau đây KHÔNG giúp với memory leak?
- A. Heap snapshot so sánh 2 thời điểm
- B. Giới hạn kích thước cache in-memory (LRU)
- C. Tăng `--max-old-space-size` lên gấp đôi
- D. Remove event listeners khi không dùng

<details><summary>Đáp án</summary>

**C.** Tăng heap chỉ trì hoãn OOM, không sửa leak — thậm chí làm GC pause dài hơn. A là công cụ chẩn đoán, B và D là 2 nguồn leak phổ biến nhất.
</details>

**Câu 7:** `Promise.all([a, b, c])` — một promise reject thì:
- A. Các promise còn lại bị cancel
- B. `Promise.all` reject ngay với lỗi đầu tiên; các promise khác VẪN tiếp tục chạy nhưng kết quả bị bỏ qua
- C. Chờ tất cả xong rồi mới reject
- D. Trả về mảng có lỗi xen kẽ kết quả

<details><summary>Đáp án</summary>

**B.** JS không có cancellation tự động (cần AbortController). Muốn nhận tất cả kết quả kể cả lỗi → `Promise.allSettled`. Đây là nguồn bug kinh điển: side effect của promise "bị bỏ rơi" vẫn xảy ra.
</details>

**Câu 8:** Vì sao Express error middleware phải khai báo 4 tham số `(err, req, res, next)`?
- A. Quy ước thẩm mỹ
- B. Express phân biệt error middleware với middleware thường bằng SỐ LƯỢNG tham số của function
- C. Để truy cập stack trace
- D. Bắt buộc của JavaScript

<details><summary>Đáp án</summary>

**B.** Express check `fn.length === 4`. Lưu ý thêm: Express 4 không tự bắt lỗi trong async handler — phải `next(err)` hoặc dùng wrapper/Express 5.
</details>

#### SQL & NoSQL (câu 9-16)

**Câu 9:** Index `(last_name, first_name)` KHÔNG hỗ trợ query nào?
- A. `WHERE last_name = 'A'`
- B. `WHERE last_name = 'A' AND first_name = 'B'`
- C. `WHERE first_name = 'B'`
- D. `WHERE last_name LIKE 'A%'`

<details><summary>Đáp án</summary>

**C.** Leftmost prefix rule: composite index dùng được khi điều kiện chứa cột đầu tiên. Thiếu `last_name` thì B-tree không có điểm vào (trừ index-only scan đặc biệt).
</details>

**Câu 10:** Hai transaction cùng đọc số dư 100, cùng trừ 80, cả hai commit thành công ở READ COMMITTED → số dư -60. Đây là anomaly gì và fix chuẩn?
- A. Dirty read; fix bằng index
- B. Lost update; fix bằng `SELECT ... FOR UPDATE`, optimistic locking (version column), hoặc atomic `UPDATE ... SET balance = balance - 80 WHERE balance >= 80`
- C. Phantom read; fix bằng REPEATABLE READ
- D. Deadlock; fix bằng retry

<details><summary>Đáp án</summary>

**B.** Lost update kinh điển. Atomic conditional update là cách rẻ và đúng nhất cho case đơn giản; FOR UPDATE khi cần đọc-tính-ghi phức tạp; optimistic khi contention thấp.
</details>

**Câu 11:** `EXPLAIN` cho thấy seq scan trên bảng 10M rows dù cột WHERE đã có index. Nguyên nhân KHÔNG thể là:
- A. Điều kiện áp function lên cột: `WHERE lower(email) = ...`
- B. Selectivity thấp — điều kiện match 60% bảng, planner thấy seq scan rẻ hơn
- C. Type mismatch giữa cột và giá trị so sánh
- D. Bảng có quá nhiều cột

<details><summary>Đáp án</summary>

**D.** Số cột không quyết định việc dùng index. A cần functional index, B là hành vi đúng của planner (index scan 60% bảng đắt hơn seq scan), C khiến index không áp được.
</details>

**Câu 12:** Isolation level mặc định của PostgreSQL?
- A. READ UNCOMMITTED
- B. READ COMMITTED
- C. REPEATABLE READ
- D. SERIALIZABLE

<details><summary>Đáp án</summary>

**B.** READ COMMITTED — mỗi statement thấy snapshot mới nhất đã commit. Lưu ý PostgreSQL không có dirty read thực sự kể cả khi set READ UNCOMMITTED (nó hành xử như READ COMMITTED).
</details>

**Câu 13:** Khi nào embed document trong MongoDB thay vì reference?
- A. Luôn embed cho nhanh
- B. Khi quan hệ 1-ít, child luôn được đọc cùng parent, child không bị query độc lập, và tổng size không tiến tới 16MB
- C. Khi quan hệ many-to-many
- D. Khi child được update cực kỳ thường xuyên bởi nhiều writer

<details><summary>Đáp án</summary>

**B.** Quy tắc: "data được truy cập cùng nhau thì lưu cùng nhau" với các điều kiện trên. C và D là dấu hiệu nên reference; unbounded array (comments của post hot) là anti-pattern embed kinh điển.
</details>

**Câu 14:** Chọn shard key tốt cho collection orders 500M docs, query chủ yếu theo `userId`:
- A. `orderDate` (range) — vì dễ đọc
- B. `userId` (hashed) — phân bố đều, query theo user route thẳng tới 1 shard
- C. `status` — chỉ có 3 giá trị
- D. `_id` tự tăng dạng range

<details><summary>Đáp án</summary>

**B.** Shard key cần: cardinality cao, phân bố đều, xuất hiện trong query chính. A và D dồn write vào 1 shard (monotonically increasing); C cardinality quá thấp.
</details>

**Câu 15:** RDS Multi-AZ và Read Replica khác nhau:
- A. Là một
- B. Multi-AZ: standby ĐỒNG BỘ cho failover tự động (HA), không nhận read; Read Replica: bản sao BẤT ĐỒNG BỘ để scale read, có lag
- C. Read Replica đồng bộ, Multi-AZ bất đồng bộ
- D. Multi-AZ chỉ có ở Aurora

<details><summary>Đáp án</summary>

**B.** Multi-AZ = availability (failover ~1-2 phút, cùng endpoint); Read Replica = scalability (chia tải đọc, chấp nhận replication lag, promote thủ công được khi disaster).
</details>

**Câu 16:** Hệ thống cần: schema linh hoạt, write throughput rất cao, query chủ yếu theo key, chấp nhận eventual consistency. Lựa chọn hợp lý nhất?
- A. PostgreSQL chuẩn hóa 3NF
- B. NoSQL dạng wide-column/document (Cassandra, DynamoDB, MongoDB)
- C. SQLite
- D. Redis làm primary database duy nhất

<details><summary>Đáp án</summary>

**B.** Đúng profile của NoSQL phân tán. A vẫn làm được nhưng trả giá ở write scale; D sai vì Redis là in-memory — làm primary store cho data lớn vừa đắt vừa rủi ro durability.
</details>

#### Redis (câu 17-22)

**Câu 17:** Cấu trúc Redis phù hợp cho leaderboard real-time?
- A. List
- B. Hash
- C. Sorted Set (ZADD score, ZREVRANGE / ZRANK lấy top-N và hạng)
- D. String với JSON

<details><summary>Đáp án</summary>

**C.** Sorted Set giữ member theo score: thêm/cập nhật O(log N), lấy top-N và rank O(log N) — đúng bài leaderboard, sliding window rate limit, delay queue.
</details>

**Câu 18:** Release distributed lock đúng cách phải dùng Lua script vì:
- A. Lua nhanh hơn lệnh thường
- B. Cần atomic "GET so sánh owner value rồi mới DEL" — nếu tách 2 lệnh, lock của mình có thể hết hạn giữa chừng và mình DEL nhầm lock mà process khác vừa acquire
- C. Redis bắt buộc dùng Lua cho DEL
- D. Để lock không bao giờ hết hạn

<details><summary>Đáp án</summary>

**B.** Check-and-delete phải atomic. Đây cũng là lý do value của lock phải là ID duy nhất của owner (không phải giá trị cố định).
</details>

**Câu 19:** Cache stampede khác cache penetration:
- A. Giống nhau
- B. Stampede: key TỒN TẠI nhưng hết hạn → nhiều request cùng rebuild; Penetration: key KHÔNG TỒN TẠI trong cả cache lẫn DB → mọi request đều xuyên xuống DB
- C. Penetration chỉ xảy ra với Memcached
- D. Stampede do hacker, penetration do bug

<details><summary>Đáp án</summary>

**B.** Fix stampede: lock rebuild + TTL jitter + stale-while-revalidate. Fix penetration: cache null TTL ngắn + Bloom filter + validate input (chặn id rác từ đầu).
</details>

**Câu 20:** Redis làm pub/sub thuần (PUBLISH/SUBSCRIBE) có đặc tính nào?
- A. Message được lưu lại cho subscriber offline
- B. Fire-and-forget: subscriber offline lúc publish là MẤT message; cần durability thì dùng Redis Streams hoặc Kafka
- C. Đảm bảo exactly-once
- D. Tự động retry

<details><summary>Đáp án</summary>

**B.** Pub/sub không có persistence và ack. Redis Streams (XADD/XREADGROUP) mới có consumer group, ack, pending list — gần với Kafka hơn.
</details>

**Câu 21:** `maxmemory-policy allkeys-lru` nghĩa là:
- A. Từ chối write khi đầy memory
- B. Khi chạm maxmemory, evict key ÍT ĐƯỢC DÙNG GẦN ĐÂY NHẤT trong TẤT CẢ key (kể cả không có TTL)
- C. Chỉ evict key có TTL
- D. Xóa toàn bộ cache

<details><summary>Đáp án</summary>

**B.** `allkeys-lru` phù hợp khi Redis là pure cache. `volatile-lru` chỉ evict key có TTL; `noeviction` (default) trả lỗi write khi đầy — nguy hiểm nếu không để ý.
</details>

**Câu 22:** RDB vs AOF:
- A. RDB ghi từng lệnh, AOF snapshot định kỳ
- B. RDB snapshot định kỳ (restore nhanh, có thể mất vài phút data); AOF log từng write (bền hơn, file lớn hơn, restore chậm hơn); production thường bật cả hai
- C. AOF không thể cấu hình fsync
- D. Chỉ chọn được một trong hai

<details><summary>Đáp án</summary>

**B.** AOF có `appendfsync everysec` (cân bằng phổ biến — mất tối đa ~1s data). Câu phụ hay gặp: Redis làm cache thì có thể tắt persistence hoàn toàn.
</details>

#### Kafka (câu 23-28)

**Câu 23:** Topic có 6 partitions, consumer group có 8 consumers:
- A. 8 consumer chia đều mỗi cái 0.75 partition
- B. 6 consumer mỗi cái 1 partition, 2 consumer NGỒI KHÔNG — số consumer hữu dụng tối đa = số partitions
- C. Lỗi cấu hình, Kafka từ chối
- D. 2 consumer thừa đọc trùng partition

<details><summary>Đáp án</summary>

**B.** Một partition chỉ được gán cho 1 consumer trong cùng group tại một thời điểm. Đây là lý do số partition quyết định độ song song tối đa — và vì sao phải tính trước khi tạo topic.
</details>

**Câu 24:** Consumer xử lý xong message rồi crash TRƯỚC khi commit offset. Khi restart:
- A. Message bị mất
- B. Message được deliver lại → xử lý TRÙNG → đây chính là lý do consumer phải idempotent (at-least-once)
- C. Kafka biết và bỏ qua message đó
- D. Cả partition bị khóa

<details><summary>Đáp án</summary>

**B.** Commit-sau-xử-lý cho at-least-once (duplicate có thể); commit-trước-xử-lý cho at-most-once (mất có thể). Chọn at-least-once + idempotent consumer là cấu hình chuẩn cho hệ thống nghiệp vụ.
</details>

**Câu 25:** `acks=all` + `enable.idempotence=true` ở producer đảm bảo:
- A. Exactly-once toàn hệ thống đến tận DB của consumer
- B. Message được ghi bền vào tất cả in-sync replicas và không bị duplicate DO PRODUCER RETRY — nhưng consumer vẫn có thể thấy duplicate vì lý do phía consumer
- C. Throughput cao nhất
- D. Ordering toàn topic

<details><summary>Đáp án</summary>

**B.** Idempotent producer chỉ khử duplicate trong phạm vi producer-broker. End-to-end exactly-once cần Kafka transactions (giới hạn trong Kafka) hoặc idempotent consumer ở tầng ứng dụng.
</details>

**Câu 26:** Rebalance của consumer group KHÔNG bị trigger bởi:
- A. Consumer mới join group
- B. Consumer chết / mất heartbeat / xử lý quá `max.poll.interval.ms`
- C. Thêm partition vào topic
- D. Producer gửi message tốc độ cao hơn

<details><summary>Đáp án</summary>

**D.** Tốc độ produce không gây rebalance (chỉ gây lag). B đáng chú ý nhất trong thực tế: xử lý 1 batch quá lâu → bị coi là chết → rebalance bão hòa (storm). Fix: giảm `max.poll.records`, tăng `max.poll.interval.ms`, offload việc nặng.
</details>

**Câu 27:** Consumer lag tăng đều không giảm. Cách xử lý SAI là:
- A. Tăng số consumer instance (tới giới hạn số partition)
- B. Tối ưu thời gian xử lý mỗi message (batch DB write, bỏ call sync chậm)
- C. Tăng số partition (kế hoạch trước) để tăng song song
- D. Giảm retention của topic xuống 1 phút để lag tự biến mất

<details><summary>Đáp án</summary>

**D.** Giảm retention làm message bị XÓA trước khi xử lý = mất data, không phải hết lag. A-C là các đòn đúng theo thứ tự nên thử.
</details>

**Câu 28:** Vì sao DLQ cần kèm metadata (original topic, partition, offset, error, retry count)?
- A. Cho đẹp log
- B. Để phân tích nguyên nhân và REPLAY message về đúng chỗ sau khi fix bug — không có metadata thì DLQ chỉ là nghĩa địa message
- C. Kafka yêu cầu schema này
- D. Để tính billing

<details><summary>Đáp án</summary>

**B.** DLQ chỉ có giá trị khi có quy trình: alert khi DLQ có message → phân tích → fix → replay. Không có metadata + tooling thì poison message coi như mất.
</details>

#### Docker & Kubernetes (câu 29-36)

**Câu 29:** Vì sao `COPY package*.json` + `RUN npm ci` đặt TRƯỚC `COPY . .`?
- A. npm yêu cầu thứ tự này
- B. Tận dụng layer cache: code đổi mỗi commit nhưng dependencies ít đổi — tách layer giúp build sau chỉ cài lại deps khi package.json đổi
- C. Bảo mật
- D. Giảm image size

<details><summary>Đáp án</summary>

**B.** Layer cache invalidate từ layer thay đổi trở xuống. Đảo thứ tự → mọi thay đổi code đều chạy lại `npm ci` (chậm hơn nhiều lần).
</details>

**Câu 30:** Node.js chạy PID 1 trong container, `docker stop` mà app không tắt, chờ 10s rồi bị SIGKILL. Nguyên nhân thường gặp:
- A. Docker lỗi
- B. PID 1 không có default signal handler — app không tự đăng ký handler SIGTERM thì signal bị bỏ qua; fix: handle SIGTERM trong code, hoặc dùng `tini`/`--init`, và dùng exec form `CMD ["node", "app.js"]` (shell form làm shell nhận signal thay vì node)
- C. Node không hỗ trợ signal
- D. Phải dùng SIGKILL luôn mới đúng

<details><summary>Đáp án</summary>

**B.** Bộ ba kinh điển: exec form + signal handler + (tùy chọn) init process. Liên quan trực tiếp tới graceful shutdown trên K8s.
</details>

**Câu 31:** CMD vs ENTRYPOINT:
- A. Giống nhau
- B. ENTRYPOINT là lệnh cố định, CMD là default arguments có thể bị override khi `docker run image <args>`; kết hợp: ENTRYPOINT ["node"], CMD ["app.js"]
- C. CMD chạy lúc build, ENTRYPOINT lúc run
- D. ENTRYPOINT chỉ dùng cho shell script

<details><summary>Đáp án</summary>

**B.** `docker run image other.js` → chạy `node other.js`. C sai — cả hai đều là runtime instruction (RUN mới là build time).
</details>

**Câu 32:** Pod bị `OOMKilled` liên tục. Nguyên nhân và hướng xử lý:
- A. Node hết disk; xóa images
- B. Container vượt memory LIMIT → kernel kill; xử lý: đo memory thực tế, tăng limit hợp lý hoặc fix leak, lưu ý đặt `--max-old-space-size` của Node thấp hơn limit để V8 GC chủ động trước khi chạm trần
- C. CPU limit quá thấp
- D. Thiếu liveness probe

<details><summary>Đáp án</summary>

**B.** CPU vượt limit chỉ bị throttle (chậm), memory vượt limit là bị giết. Node mặc định không biết cgroup limit (bản cũ) → heap có thể phình vượt limit nếu không cấu hình.
</details>

**Câu 33:** Service type `ClusterIP`:
- A. Expose ra internet
- B. Virtual IP chỉ truy cập được TRONG cluster — mặc định cho giao tiếp service-to-service; ra ngoài cần NodePort/LoadBalancer/Ingress
- C. Mở port trên mọi node
- D. Tạo cloud load balancer

<details><summary>Đáp án</summary>

**B.** C là NodePort, D là LoadBalancer. Thực tế phổ biến: ClusterIP cho mọi service nội bộ + 1 Ingress (L7) làm cửa vào.
</details>

**Câu 34:** Rolling update với `maxSurge: 1, maxUnavailable: 0` nghĩa là:
- A. Tắt hết pod cũ rồi bật pod mới
- B. Luôn đủ số replica phục vụ: tạo 1 pod mới → chờ READY (readiness probe pass) → mới giết 1 pod cũ — zero-downtime nếu app có graceful shutdown
- C. Update 1 pod mỗi ngày
- D. Không bao giờ update được

<details><summary>Đáp án</summary>

**B.** Đây là cấu hình zero-downtime tiêu chuẩn. Điều kiện phía app: readiness probe trung thực + xử lý SIGTERM + (nên có) preStop hook/delay để LB kịp rút traffic.
</details>

**Câu 35:** HPA scale dựa trên CPU utilization 70% nghĩa là:
- A. Scale khi node đạt 70% CPU
- B. HPA giữ trung bình CPU của các pod ≈ 70% mức REQUESTS (không phải limits): vượt thì thêm pod, thấp hơn thì bớt (về minReplicas)
- C. Scale khi 70% pods bị lỗi
- D. Mỗi pod bị giới hạn 70% 1 core

<details><summary>Đáp án</summary>

**B.** Công thức: `desiredReplicas = ceil(current × currentUtil/targetUtil)`. Cần metrics-server; pod không khai `resources.requests` thì HPA theo CPU không hoạt động.
</details>

**Câu 36:** Liveness probe của service NÊN check gì?
- A. Cả DB, Redis, Kafka — chết cái nào restart cái đó
- B. Chỉ bản thân process (HTTP 200 đơn giản / event loop còn phản hồi) — vì liveness fail là RESTART pod; check dependency vào liveness sẽ gây restart storm cả fleet khi DB chỉ chập chờn
- C. Disk của node
- D. Không cần probe

<details><summary>Đáp án</summary>

**B.** Dependency để cho READINESS (ngừng nhận traffic chứ không restart). Nhầm hai cái này là lỗi cấu hình production rất phổ biến.
</details>

#### AWS (câu 37-41)

**Câu 37:** Workload: API traffic thất thường, spike ngắn, idle phần lớn thời gian, team nhỏ không muốn quản lý server. Chọn:
- A. EC2 reserved instances
- B. Lambda + API Gateway (serverless: scale to zero, trả tiền theo invocation; chấp nhận cold start và giới hạn thời gian chạy)
- C. EKS cluster 10 nodes
- D. Máy vật lý on-premise

<details><summary>Đáp án</summary>

**B.** Profile chuẩn của serverless. Trade-off phải nêu được: cold start (Node.js nhẹ nên đỡ), max 15 phút, connection pooling với RDS cần RDS Proxy.
</details>

**Câu 38:** SQS visibility timeout là:
- A. Thời gian message tồn tại trong queue
- B. Khoảng thời gian message bị ẨN khỏi các consumer khác sau khi một consumer nhận nó — xử lý xong phải DELETE message; không delete kịp thì message hiện lại và bị xử lý trùng
- C. Timeout của HTTP request
- D. TTL của DLQ

<details><summary>Đáp án</summary>

**B.** Hệ quả: visibility timeout phải > thời gian xử lý tối đa, và consumer phải idempotent. `maxReceiveCount` + redrive policy là cơ chế DLQ tích hợp của SQS.
</details>

**Câu 39:** SNS vs SQS:
- A. Như nhau
- B. SNS là pub/sub PUSH fan-out tới nhiều subscriber (không lưu message); SQS là queue PULL có lưu trữ; pattern phổ biến: SNS fan-out vào nhiều SQS queue để mỗi consumer vừa độc lập vừa durable
- C. SQS push, SNS pull
- D. SNS chỉ gửi SMS

<details><summary>Đáp án</summary>

**B.** "SNS topic → nhiều SQS queues" là kiến trúc fan-out chuẩn trên AWS, tương đương consumer groups của Kafka ở mức khái niệm.
</details>

**Câu 40:** Service trên EC2/ECS cần đọc S3. Cách ĐÚNG:
- A. Hardcode access key trong code
- B. Access key trong file .env commit lên git private repo
- C. Gắn IAM ROLE cho instance/task với policy least-privilege — SDK tự lấy temporary credentials, không có secret tĩnh để lộ
- D. Dùng tài khoản root

<details><summary>Đáp án</summary>

**C.** IAM role + instance profile/task role là chuẩn. A, B là nguồn rò rỉ key phổ biến nhất; D là tối kỵ tuyệt đối.
</details>

**Câu 41:** Database RDS nên đặt ở:
- A. Public subnet để dễ debug
- B. Private subnet, security group chỉ cho phép inbound từ security group của app tier, không có route từ internet
- C. Subnet nào cũng được
- D. Ngoài VPC

<details><summary>Đáp án</summary>

**B.** Nguyên tắc: chỉ LB ở public subnet; app và data ở private. Outbound internet cho private subnet (npm install, gọi API ngoài) đi qua NAT gateway.
</details>

#### System Design & Patterns (câu 42-50)

**Câu 42:** Hệ thống booking vé (không bán trùng ghế) ưu tiên gì theo CAP khi có partition?
- A. Availability — cứ bán, sai sửa sau
- B. Consistency — thà từ chối request còn hơn double-book; với view số lượng vé còn lại thì có thể eventual
- C. Cả hai cùng lúc tuyệt đối
- D. CAP không liên quan booking

<details><summary>Đáp án</summary>

**B.** Phân tách theo thao tác: hành động RESERVE cần strong consistency (CP), hành động XEM có thể AP. Trả lời phân tách như vậy là dấu hiệu hiểu sâu.
</details>

**Câu 43:** Token bucket với capacity 20, refill 10/s. Client im lặng 5 giây rồi bắn 25 requests trong 100ms:
- A. Cả 25 pass
- B. 20 pass (bucket đầy ở capacity 20 — không tích lũy vượt trần), 5 bị 429
- C. 10 pass
- D. Tất cả bị chặn

<details><summary>Đáp án</summary>

**B.** Bucket refill tối đa tới capacity (20), không phải 5s × 10 = 50. Đây chính là tính chất "cho phép burst CÓ KIỂM SOÁT" của token bucket.
</details>

**Câu 44:** Circuit breaker đang OPEN. Request mới tới sẽ:
- A. Chờ đến khi service hồi phục
- B. Fail fast ngay (hoặc trả fallback) KHÔNG gọi downstream; hết open-timeout mới chuyển HALF-OPEN cho vài request thăm dò
- C. Retry 3 lần rồi mới fail
- D. Vẫn gọi bình thường nhưng log warning

<details><summary>Đáp án</summary>

**B.** Mục đích của OPEN là cho downstream thở và bảo vệ caller khỏi cạn tài nguyên chờ timeout. Retry trong lúc OPEN (C) phá hỏng mục đích đó.
</details>

**Câu 45:** Idempotency key cho POST /orders KHÔNG giải quyết được tình huống nào?
- A. Client timeout và retry cùng key
- B. User bấm nút submit 2 lần (cùng key do client giữ)
- C. Hai NGƯỜI DÙNG khác nhau vô tình đặt 2 đơn giống hệt nội dung (key khác nhau)
- D. Load balancer retry request

<details><summary>Đáp án</summary>

**C.** Idempotency key dedupe theo KEY, không theo nội dung. Hai key khác nhau = hai request hợp lệ — muốn chặn phải dùng business rule riêng (vd: không cho 2 đơn giống nhau trong 1 phút).
</details>

**Câu 46:** Trong saga, "compensating transaction" là:
- A. Rollback của DB transaction gốc
- B. Transaction MỚI làm nghịch đảo nghiệp vụ của bước đã commit (refund cho charge, release cho reserve) — vì transaction gốc đã commit, không rollback được
- C. Bồi thường tiền cho khách
- D. Retry bước bị lỗi

<details><summary>Đáp án</summary>

**B.** Hệ quả thiết kế: mọi bước trong saga phải CÓ THỂ nghịch đảo về mặt nghiệp vụ, và compensation cũng phải idempotent (có thể được trigger nhiều lần).
</details>

**Câu 47:** Outbox relay crash SAU khi publish event lên Kafka nhưng TRƯỚC khi update `published_at`. Khi restart:
- A. Event bị mất
- B. Event được publish LẦN NỮA → duplicate trên topic → vô hại NẾU consumer idempotent — outbox cho at-least-once, không phải exactly-once
- C. Cả bảng outbox bị khóa
- D. Kafka tự khử duplicate

<details><summary>Đáp án</summary>

**B.** Hiểu được "outbox = at-least-once" và mối quan hệ cộng sinh với idempotent consumer là điểm phân biệt người làm thật với người đọc lý thuyết.
</details>

**Câu 48:** API Gateway tập trung KHÔNG nên ôm nhiệm vụ nào?
- A. Rate limiting, authentication
- B. Routing, TLS termination
- C. Business logic của domain (tính giá, validate tồn kho)
- D. Request ID generation, CORS

<details><summary>Đáp án</summary>

**C.** Gateway chứa cross-cutting concerns; nhét business logic vào biến nó thành "god service" bóp nghẹt mọi team — anti-pattern phổ biến khi chuyển sang microservices.
</details>

**Câu 49:** Đo lường nào nói lên trải nghiệm người dùng tốt nhất khi API có latency phân bố lệch?
- A. Average latency
- B. p95/p99 latency — average che giấu tail; 1% requests chậm 10s vẫn cho average đẹp nhưng đó có thể là những user nặng nhất, giá trị nhất
- C. Tổng số request
- D. Uptime %

<details><summary>Đáp án</summary>

**B.** Luôn nói percentile trong phỏng vấn lẫn SLO thực tế. Câu phụ hay gặp: vì sao p99 của hệ thống fan-out tệ hơn từng service (xác suất chạm tail cộng dồn theo số call).
</details>

**Câu 50:** Hệ thống đọc nhiều ghi ít (100:1), data đọc chấp nhận stale 1 phút. Chiến lược hiệu quả nhất theo thứ tự ưu tiên:
- A. Shard database ngay
- B. Cache-aside Redis TTL 60s (+ CDN nếu là nội dung public) → đỡ ~99% read; sau đó mới tính read replica nếu vẫn quá tải; sharding là phương án cuối
- C. Mua máy chủ to nhất
- D. Chuyển hết sang NoSQL

<details><summary>Đáp án</summary>

**B.** "Stale 1 phút OK" + "read-heavy" gần như hét lên: CACHE. Trình tự cache → replicate → shard là quy tắc vàng; nhảy thẳng tới sharding (A) là over-engineering kinh điển.
</details>

---

**Chấm điểm Final Test:**

| Điểm | Đánh giá |
|---|---|
| 45-50 | Xuất sắc — sẵn sàng phỏng vấn senior |
| 40-44 | **PASS** — ôn lại các câu sai rồi bắt đầu ứng tuyển |
| 33-39 | Chưa pass — xác định tuần yếu nhất (nhóm câu sai), ôn 2-3 ngày, làm lại bộ đề |
| < 33 | Quay lại flash checklist Ngày 1-2, ôn nghiêm túc từng tuần yếu trước khi thi lại |

### Phần 2: Bài thực hành chấm điểm

**Đề bài: "Full Interview Loop Simulation"** — mô phỏng trọn một vòng phỏng vấn thật trong 1 buổi (3 tiếng, lý tưởng có người đóng vai interviewer; không có thì tự ghi hình từng phần):
1. **Intro + behavioral (30 phút)**: tell me about yourself + 3 câu STAR ngẫu nhiên trong bộ 10.
2. **Technical deep-dive (60 phút)**: walk through capstone + 10 câu ngẫu nhiên từ script 30 câu, có hỏi xoáy.
3. **System design (60 phút)**: 1 đề CHƯA từng làm (gợi ý: design Twitter timeline / design distributed job scheduler / design file storage như Dropbox).
4. **Reverse questions + wrap up (15 phút)**: hỏi ngược 3 câu + trả lời câu hỏi lương theo kịch bản negotiation.

**Checklist chấm điểm (100 điểm):**

| Tiêu chí | Điểm |
|---|---|
| Self-intro 60-90 giây: đúng cấu trúc hiện tại→quá khứ→tương lai, có số liệu | 10 |
| 3 câu behavioral: đủ 4 thành phần STAR, Result đo được, nói "tôi" rõ vai trò | 15 |
| Capstone walk-through: vẽ kiến trúc < 3 phút, giải thích ≥ 4 patterns kèm lý do | 15 |
| Technical 10 câu: ≥ 7 câu trả lời có trade-off/ví dụ (mức 2 điểm theo thang Ngày 3) | 20 |
| System design đề mới: ≥ 16/20 theo checklist 10 tiêu chí tuần 10 | 20 |
| Chịu nhiệt: khi bị xoáy "tại sao không làm cách Y?", phân tích được Y thay vì bối rối hoặc đổi ý vô căn cứ | 10 |
| Reverse questions chất lượng (không hỏi thứ search 10 giây ra) + xử lý câu hỏi lương đúng kịch bản | 5 |
| Giao tiếp: cấu trúc rõ, không lan man > 3 phút/câu, biết nói "em không chắc, nhưng em sẽ tiếp cận thế này" thay vì bịa | 5 |

---

## ✅ Tiêu chí pass tuần

- [ ] Flash checklist 11 tuần: tick ≥ 90%, các mục yếu đã ôn lại và viết tóm tắt.
- [ ] Mock technical 30 câu: ≥ 45/60 điểm.
- [ ] Mock system design: cả 2 đề ≥ 16/20.
- [ ] 10 bộ STAR cá nhân viết xong, 3 câu khó nhất đã quay video và tự sửa.
- [ ] CV 1 trang hoàn chỉnh đã được ≥ 1 người review; GitHub capstone polish xong; 3 con số negotiation đã chốt.
- [ ] **FINAL TEST: ≥ 40/50.**
- [ ] Full Interview Loop Simulation: ≥ 75/100.

**Pass tất cả → bạn đã hoàn thành lộ trình 12 tuần. Bước tiếp theo: rải CV vào 5 công ty mục tiêu, đặt lịch phỏng vấn cách nhau ≥ 2 ngày (công ty ít muốn nhất xếp trước để lấy kinh nghiệm), và sau MỖI buổi phỏng vấn thật — ghi lại mọi câu bị hỏi mà trả lời chưa tốt vào file `interview-log.md` rồi ôn ngay. Phỏng vấn cũng là kỹ năng: buổi thứ 3 của bạn sẽ tốt hơn buổi đầu rất nhiều. Chúc may mắn! 🚀**
