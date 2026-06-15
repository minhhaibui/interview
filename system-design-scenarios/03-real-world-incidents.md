# Tình huống thực tế production — Nhà tuyển dụng hỏi "Nếu gặp X bạn xử lý thế nào?"

> Dạng câu hỏi **scenario-based** này khác hoàn toàn với bài "design Twitter từ đầu". Interviewer không cần bạn vẽ kiến trúc đẹp — họ muốn biết: **bạn đã từng đứng giữa đám cháy production chưa, và bạn có quy trình hay chỉ đoán mò?**

## Framework trả lời (áp dụng cho MỌI tình huống)

Khi nghe câu hỏi dạng "Nếu X xảy ra, bạn làm gì?", LUÔN trả lời theo 4 bước:

1. **Ổn định hệ thống trước (stop the bleeding)** — Ưu tiên số 1 là giảm thiệt hại cho user, KHÔNG phải tìm root cause ngay. Rollback, scale out, bật feature flag tắt tính năng, chuyển traffic... Nói rõ: *"Em sẽ stop the bleeding trước, root cause tính sau."*
2. **Chẩn đoán có phương pháp: metrics → logs → traces** — Đi từ tổng quan đến chi tiết:
   - **Metrics** (Grafana/Datadog/CloudWatch): cái gì thay đổi, từ lúc nào, ở tầng nào? So sánh với baseline.
   - **Logs** (ELK/Loki): error message cụ thể, stack trace, tần suất.
   - **Traces** (Jaeger/Tempo/X-Ray): request chậm ở span nào, service nào.
   - Luôn hỏi: **"Có gì vừa thay đổi không?"** — deploy, config, migration, traffic pattern, dependency. 80% sự cố đến từ change.
3. **Fix ngắn hạn** — đưa hệ thống về trạng thái phục vụ được, chấp nhận giải pháp tạm (restart, tăng limit, kill query...).
4. **Fix gốc rễ + phòng ngừa** — sau incident: root cause fix, thêm alert/dashboard để phát hiện sớm hơn, **blameless postmortem**, action items có owner và deadline.

⚠️ **Lưu ý quan trọng:** Interviewer muốn nghe **TƯ DUY CÓ HỆ THỐNG**, không phải đoán mò. Câu trả lời tệ: *"Chắc là do DB, em sẽ restart DB."* Câu trả lời tốt: *"Em sẽ khoanh vùng từng tầng bằng metrics: latency tăng ở LB hay ở app? Nếu ở app thì event loop có block không? DB query time có tăng không?..."* — Đi từng tầng, mỗi bước có công cụ và tiêu chí quyết định rõ ràng. Cũng đừng quên yếu tố con người: thông báo cho team/stakeholder, mở incident channel, chỉ định incident commander nếu nghiêm trọng.

---

## Tình huống 1: API latency đột ngột tăng từ 100ms lên 5s

**🎤 Câu hỏi:** "Một sáng thứ Hai, alert báo p99 latency của API chính tăng từ 100ms lên 5 giây, nhưng error rate vẫn thấp. Bạn xử lý thế nào?"

### Phân tích nguyên nhân khả dĩ
1. **Database chậm** — query plan đổi, missing index sau khi data lớn lên, lock contention, connection pool cạn (phổ biến nhất).
2. **External/downstream call chậm** — third-party API, service nội bộ khác degrade, mà mình không có timeout đúng.
3. **Event loop bị block** (đặc thù Node.js) — code sync nặng (JSON.parse payload lớn, regex catastrophic backtracking, crypto sync), GC pressure.
4. **Resource bão hòa** — CPU throttling trên K8s, thiếu pod sau khi traffic tăng dần, noisy neighbor.
5. **Thay đổi gần đây** — deploy cuối tuần, config thay đổi, cache bị flush.

### Các bước xử lý (trả lời mẫu)
1. **Khoanh vùng tầng bị chậm bằng metrics, đi từ ngoài vào:**
   - LB/Ingress metrics (ALB `TargetResponseTime`, nginx `upstream_response_time`): latency tăng ở upstream hay ở chính LB? Nếu LB nhanh mà client chậm → vấn đề network/CDN.
   - APM/distributed tracing (Datadog, Jaeger): mở vài trace của request chậm, xem **span nào chiếm 4.9s** — app tự xử lý, chờ DB, hay chờ external call? Đây là cách nhanh nhất.
2. **Kiểm tra "có gì vừa thay đổi":** `kubectl rollout history deployment/api`, lịch deploy, feature flag, cron job nặng chạy sáng thứ Hai (report, backfill).
3. **Nếu nghi ngờ app (Node.js):**
   - Event loop lag metric (`monitorEventLoopDelay`, hoặc metric `nodejs_eventloop_lag_seconds` từ prom-client). Lag > 100ms = event loop bị block.
   - `kubectl top pods` xem CPU/memory; CPU 100% trên 1 core với Node = nghi block sync code.
   - Lấy CPU profile nhanh: `kill -USR1 <pid>` bật inspector rồi attach Chrome DevTools, hoặc `clinic flame` ở staging với traffic replay.
4. **Nếu nghi ngờ DB:**
   - Dashboard DB: active connections, CPU, `pg_stat_activity` xem query đang chạy lâu: `SELECT pid, now()-query_start AS dur, query FROM pg_stat_activity WHERE state='active' ORDER BY dur DESC;`
   - Connection pool metrics phía app (pool exhausted? wait time tăng?). Pool cạn thì latency tăng nhưng error ít — khớp triệu chứng đề bài.
5. **Nếu nghi external call:** trace cho thấy span gọi third-party chiếm phần lớn → kiểm tra status page của họ, kiểm tra timeout config của mình (timeout 30s mặc định là thủ phạm kinh điển khiến latency "5s" thay vì fail nhanh).
6. **Quyết định:** xác định được tầng → áp fix ngắn hạn tương ứng (kill query, rollback deploy, hạ timeout + bật fallback...).

### Fix ngắn hạn vs dài hạn

| Fix ngắn hạn | Fix dài hạn |
|---|---|
| Rollback deploy gần nhất nếu trùng thời điểm | Thêm dashboard latency breakdown theo tầng (LB/app/DB/external) |
| Kill long-running query, restart connection pool | Index/query tuning, review query plan định kỳ |
| Hạ timeout external call + trả fallback/cached data | Circuit breaker + timeout budget cho mọi external call |
| Scale out pod tạm thời | Alert trên event loop lag, p99 per-endpoint thay vì global |

### 💡 Điểm ăn điểm khi trả lời
- Nhấn mạnh **distributed tracing là công cụ khoanh vùng nhanh nhất** — thay vì đoán, mở trace ra là thấy span nào chậm.
- Nói được đặc thù Node.js: **event loop lag là metric phải có**, vì CPU 100% trên Node nghĩa là 1 request block tất cả request khác.
- Kết thúc bằng phòng ngừa: alert theo p99 per-endpoint + SLO burn rate, postmortem ghi lại "vì sao mất 30 phút mới tìm ra" để cải thiện observability.

---

## Tình huống 2: Traffic tăng x10 trong ngày sale, hệ thống sắp sập

**🎤 Câu hỏi:** "Ngày 11/11, traffic tăng gấp 10 lần dự kiến. Latency tăng, một số request bắt đầu timeout. Bạn cứu hệ thống thế nào trong 15 phút tới?"

### Phân tích nguyên nhân khả dĩ
1. **App tier thiếu capacity** — autoscaling không kịp hoặc chạm max replicas.
2. **DB là bottleneck** — app scale được nhưng DB không; write QPS vượt khả năng, connection storm từ nhiều pod mới.
3. **Cache hit ratio giảm** — traffic mới đa dạng key hơn, hoặc cache không đủ nóng.
4. **Một feature phụ ăn tài nguyên** — recommendation, analytics tracking, export... cạnh tranh tài nguyên với luồng mua hàng chính.
5. **Retry storm** — client timeout rồi retry, nhân thêm tải (10x thực tế thành 30x).

### Các bước xử lý (trả lời mẫu)
1. **Scale ngay những gì scale được (stop the bleeding):**
   - `kubectl get hpa` xem đã chạm `maxReplicas` chưa → nâng max: `kubectl patch hpa api -p '{"spec":{"maxReplicas":100}}'`. Kiểm tra cluster còn node không (`kubectl get nodes`, cluster autoscaler hoạt động chưa, có pod Pending không).
   - Bật thêm read replica / nâng instance DB nếu managed (RDS modify) — nhưng cái này chậm, không phải cứu cánh 15 phút.
2. **Load shedding — bảo vệ luồng quan trọng:**
   - Bật rate limiting ở edge (API gateway/nginx `limit_req`) cho các endpoint không quan trọng; trả `429` kèm `Retry-After` thay vì để request xếp hàng chết chùm.
   - Ưu tiên: checkout/payment > browse > recommendation > analytics.
3. **Degrade gracefully bằng feature flag:** tắt tính năng phụ (recommendation, live inventory count, review section, ảnh chất lượng cao) — mỗi cái tắt đi giải phóng DB/CPU cho luồng mua hàng. Đây là lý do **feature flag phải chuẩn bị TRƯỚC ngày sale**.
4. **Tăng cache mạnh tay:** tăng TTL cho dữ liệu ít đổi (product detail, category) từ 1 phút lên 10 phút — chấp nhận stale data đổi lấy việc sống sót. Bật CDN cache cho API read nếu có thể (`Cache-Control: s-maxage`).
5. **Chống write đột biến bằng queue:** đẩy các write không cần đồng bộ (ghi log đơn, gửi email, cập nhật điểm thưởng) vào Kafka/SQS, xử lý async — DB chỉ nhận write tối thiểu cho order. Nếu kiến trúc đã có queue, tăng buffer; nếu chưa, ghi nhận làm bài học.
6. **Kiểm soát retry storm:** xác nhận client/SDK có exponential backoff chưa; nếu mobile app retry vô tội vạ, chặn bớt ở gateway.
7. **Theo dõi liên tục:** dashboard chính (RPS, p99, error rate, DB connections, queue depth) chiếu lên màn hình, war room mở, mỗi thay đổi quan sát 2-3 phút trước khi làm tiếp.

### Fix ngắn hạn vs dài hạn

| Fix ngắn hạn | Fix dài hạn |
|---|---|
| Nâng max HPA, thêm node, scale read replica | Load test trước sự kiện (k6, Gatling) với 15-20x baseline |
| Tắt feature phụ qua feature flag | Thiết kế degrade mode có chủ đích, diễn tập "game day" |
| Tăng TTL cache, bật CDN cho API read | Cache strategy chuẩn + warm-up trước sale |
| Rate limit / load shedding tại edge | Queue cho mọi write không cần sync, capacity planning hàng quý |
| Trả 429 + Retry-After cho traffic thừa | Client SDK chuẩn hoá retry với backoff + jitter |

### 💡 Điểm ăn điểm khi trả lời
- Nói rõ tư duy **"protect the core"**: thà 100% user mua hàng được mà không có recommendation, còn hơn 100% user thấy đủ tính năng nhưng 50% timeout.
- Chỉ ra **retry storm là kẻ nhân tải vô hình** — ít ứng viên nhắc đến.
- Đề cập chuẩn bị TRƯỚC: load test, feature flag kill-switch, runbook ngày sale, war room — chứng tỏ bạn từng vận hành sự kiện lớn thật.

---

## Tình huống 3: Database CPU 100%, query chậm hàng loạt

**🎤 Câu hỏi:** "DBA báo PostgreSQL CPU 100%, hàng loạt API timeout. Bạn không phải DBA nhưng là người on-call. Bạn làm gì?"

### Phân tích nguyên nhân khả dĩ
1. **Một/vài query tệ chiếm CPU** — missing index sau khi bảng lớn lên, query plan đổi sau `ANALYZE`/autovacuum, deploy mới thêm query N+1.
2. **Connection storm** — app scale out hoặc restart hàng loạt, mỗi pod mở pool mới; Postgres tốn CPU per-connection.
3. **Traffic tăng tự nhiên** vượt capacity, hoặc cron/batch job (report, export) chạy giờ cao điểm.
4. **Lock contention** — transaction dài giữ lock, các query khác chờ rồi dồn ứ.
5. **Autovacuum/bloat** — vacuum chạy nặng trên bảng lớn, hoặc bloat khiến seq scan tốn CPU.

### Các bước xử lý (trả lời mẫu)
1. **Tìm thủ phạm đang chạy:**
   ```sql
   SELECT pid, now()-query_start AS duration, state, wait_event_type, left(query,100)
   FROM pg_stat_activity WHERE state != 'idle' ORDER BY duration DESC LIMIT 20;
   ```
   Nhìn: query nào lặp lại nhiều, chạy lâu, wait_event là gì (CPU hay Lock?).
2. **Thống kê query ăn CPU nhất:** `pg_stat_statements`:
   ```sql
   SELECT calls, mean_exec_time, total_exec_time, left(query,100)
   FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;
   ```
3. **Stop the bleeding:**
   - Kill query tệ: `SELECT pg_cancel_backend(pid);` (nhẹ) hoặc `pg_terminate_backend(pid);` (mạnh).
   - Nếu thủ phạm là deploy mới → **rollback deploy** thay vì sửa query lúc cháy nhà.
   - Nếu connection storm: kiểm tra `SELECT count(*) FROM pg_stat_activity;` so với `max_connections`; giảm pool size mỗi pod hoặc xác nhận PgBouncer hoạt động.
   - Nếu batch job → pause job.
4. **Chẩn đoán query xấu:** `EXPLAIN (ANALYZE, BUFFERS)` query nghi ngờ — tìm `Seq Scan` trên bảng lớn, `Rows Removed by Filter` khổng lồ, nested loop với estimate sai.
5. **Fix nhanh nếu missing index:** `CREATE INDEX CONCURRENTLY idx_orders_user_id ON orders(user_id);` — `CONCURRENTLY` để không lock bảng (chậm hơn nhưng an toàn trên production).
6. **Giảm tải đọc:** chuyển query read-heavy sang **read replica** nếu có; tăng cache TTL tạm thời ở tầng app.
7. **Xác nhận hồi phục:** CPU giảm, p99 API về baseline, connection count ổn định — rồi mới viết postmortem.

### Fix ngắn hạn vs dài hạn

| Fix ngắn hạn | Fix dài hạn |
|---|---|
| Kill query, pause batch job, rollback deploy | Bật `pg_stat_statements` + slow query log (`log_min_duration_statement = 200ms`) thường trực |
| `CREATE INDEX CONCURRENTLY` cho missing index rõ ràng | Review EXPLAIN trong CI cho query mới / migration |
| Đẩy read sang replica, tăng cache TTL | PgBouncer (transaction pooling) để chống connection storm |
| Giảm pool size app để cứu DB | Tách workload: replica cho report/analytics, lịch batch tránh giờ cao điểm |

### 💡 Điểm ăn điểm khi trả lời
- Biết `pg_stat_activity` + `pg_stat_statements` thuộc lòng = đã từng làm thật.
- Nhắc `CREATE INDEX CONCURRENTLY` (không lock bảng) — chi tiết nhỏ nhưng phân biệt senior với junior.
- Nói về connection storm + PgBouncer: nhiều người chỉ nghĩ "query chậm" mà quên Postgres rất nhạy cảm với số connection.

---

## Tình huống 4: Node.js service bị memory leak, OOM restart liên tục trên K8s

**🎤 Câu hỏi:** "Một service Node.js cứ chạy được 6 tiếng là memory chạm limit, bị OOMKilled, K8s restart, rồi lặp lại. Bạn truy memory leak thế nào?"

### Phân tích nguyên nhân khả dĩ
1. **Cache in-memory không bound** — `Map`/object dùng làm cache nhưng không có max size/TTL (rất phổ biến).
2. **Event listener tích lũy** — `emitter.on()` trong request handler mà không `removeListener`, warning `MaxListenersExceededWarning`.
3. **Closure giữ reference** — callback/promise giữ ref đến object lớn (request body, buffer), global array push mãi không clear.
4. **Thư viện bên thứ ba leak** — phiên bản cũ của client lib (gRPC, redis client) giữ connection/buffer.
5. **Không hẳn leak** — heap limit Node mặc định không khớp container limit, hoặc memory fragmentation/Buffer ngoài heap (RSS cao nhưng heap bình thường).

### Các bước xử lý (trả lời mẫu)
1. **Xác nhận pattern:** `kubectl describe pod` thấy `Reason: OOMKilled`, `kubectl top pods` + Grafana memory graph: memory tăng **tuyến tính theo thời gian** (leak thật) hay **theo traffic** (thiếu capacity)?
2. **Stop the bleeding:**
   - Tăng memory limit tạm thời để giãn chu kỳ chết (6h → 24h), đủ thời gian điều tra.
   - Kiểm tra `--max-old-space-size` có khớp container limit không: limit 2Gi thì nên đặt `--max-old-space-size=1536` (chừa chỗ cho buffer/stack ngoài heap). Nếu không đặt, Node có thể không GC đủ tích cực hoặc bị OOMKilled trước khi heap đầy.
   - Nếu nhiều replica: restart lệch pha (rolling) để không bao giờ tất cả chết cùng lúc.
3. **Khoanh vùng heap hay ngoài heap:** expose metric `process.memoryUsage()` — nếu `heapUsed` tăng đều → leak trong JS; nếu `rss` tăng mà heap ổn → Buffer/native addon/fragmentation.
4. **Kỹ thuật heap snapshot 3 lần (three-snapshot technique):**
   - Bật inspector trên 1 pod: `kubectl exec <pod> -- kill -USR1 1`, rồi `kubectl port-forward <pod> 9229:9229`, mở `chrome://inspect`.
   - Chụp snapshot #1 → để chạy nhận traffic 15-30 phút → snapshot #2 → tiếp tục → snapshot #3.
   - Trong DevTools, so sánh "Objects allocated between snapshot 1 and 2" mà **vẫn còn sống ở snapshot 3** — đó là đối tượng leak. Xem **retainer chain** để biết ai đang giữ reference.
   - Thay thế khi không vào pod được: `heapdump`/`v8.writeHeapSnapshot()` qua admin endpoint, tải file `.heapsnapshot` về phân tích offline.
5. **Tìm pattern quen thuộc trong snapshot:** hàng nghìn instance cùng class, `Map` với hàng triệu entry, string trùng lặp khổng lồ, listener array dài bất thường trên một emitter.
6. **Fix:** bound cache bằng `lru-cache` (max size + TTL), `once()` thay vì `on()` hoặc cleanup trong `finally`, đừng giữ ref request-scoped vào biến module-level.
7. **Verify:** deploy fix lên 1 canary pod, theo dõi heap 24h phẳng → rollout toàn bộ.

### Fix ngắn hạn vs dài hạn

| Fix ngắn hạn | Fix dài hạn |
|---|---|
| Tăng memory limit, giãn chu kỳ OOM | Fix root cause (bound cache, cleanup listener) |
| Đặt `--max-old-space-size` khớp container limit | Metric `heapUsed`/`rss`/event loop lag mặc định mọi service |
| Restart lệch pha các replica | Alert memory tăng tuyến tính (predictive), không chờ OOM |
| Liveness probe hợp lý để restart "êm" thay vì OOMKilled | Load test soak (chạy dài) trong pipeline để bắt leak trước production |

### 💡 Điểm ăn điểm khi trả lời
- Mô tả đúng **three-snapshot technique + retainer chain** — đây là dấu hiệu rõ nhất bạn từng debug leak thật, không phải đọc blog.
- Phân biệt **heap leak vs RSS cao** (Buffer/native) — nhiều ứng viên không biết RSS ≠ heap.
- Nhấn mạnh OOMKilled định kỳ thực ra là "tự chữa" tạm — nguy hiểm là nó che giấu vấn đề; alert nên bắn theo **xu hướng tăng**, không phải lúc chết.

---

## Tình huống 5: Kafka consumer lag tăng không ngừng

**🎤 Câu hỏi:** "Alert báo consumer lag của topic `orders` tăng từ vài trăm lên 2 triệu messages và tiếp tục tăng. Bạn xử lý thế nào?"

### Phân tích nguyên nhân khả dĩ
1. **Consumer xử lý chậm hơn tốc độ produce** — logic mỗi message gọi DB/API chậm, hoặc producer tăng tốc (campaign, backfill).
2. **Poison message** — message lỗi khiến consumer crash/retry vô hạn, kẹt tại 1 offset.
3. **Rebalance liên tục** — consumer xử lý lâu hơn `max.poll.interval.ms`, bị kick khỏi group, trigger rebalance, lặp vô tận (lag tăng mà CPU consumer thấp).
4. **Partition skew** — key phân bố lệch, 1 partition nhận phần lớn message, 1 consumer gánh hết.
5. **Consumer chết/scale down** — deploy lỗi, pod crash, ít consumer hơn dự kiến.

### Các bước xử lý (trả lời mẫu)
1. **Đo lag chi tiết theo partition:**
   ```bash
   kafka-consumer-groups --bootstrap-server kafka:9092 --describe --group orders-consumer
   ```
   Đọc cột `LAG`, `CURRENT-OFFSET`, `CONSUMER-ID`:
   - Lag đều trên mọi partition → consumer chậm toàn cục.
   - Lag dồn 1 partition → partition skew hoặc poison message.
   - `CONSUMER-ID` trống → không có consumer nào assigned, group chết.
   - Offset của 1 partition **đứng yên** → kẹt poison message.
2. **Kiểm tra sức khỏe consumer:** `kubectl get pods` (crash loop?), log consumer tìm exception lặp lại, log broker/consumer tìm chữ `rebalance` xuất hiện dồn dập.
3. **Xử lý theo nhánh:**
   - **Consumer chậm:** scale thêm consumer instance — nhớ nguyên tắc **số consumer hữu dụng ≤ số partition** (topic 12 partition thì consumer thứ 13 ngồi không). Nếu đã max, tăng throughput mỗi consumer: xử lý **batch** (gom N message ghi DB 1 lần), tăng concurrency trong consumer (xử lý song song theo key để giữ ordering), bỏ await tuần tự không cần thiết.
   - **Poison message:** xác định offset kẹt từ log → fix nhanh là **skip**: `kafka-consumer-groups --reset-offsets --group orders-consumer --topic orders:3 --to-offset <offset+1> --execute` (ghi lại message bị skip để xử lý tay). Lâu dài: try/catch + đẩy vào **DLQ (dead letter queue)** sau N lần retry.
   - **Rebalance loop:** tăng `max.poll.interval.ms`, giảm `max.poll.records` để mỗi vòng poll xử lý nhanh hơn; kiểm tra liveness probe không giết pod đang xử lý batch dài.
   - **Partition skew:** xem Tình huống 12.
4. **Đánh giá tác động nghiệp vụ:** lag 2M nghĩa là đơn hàng trễ bao lâu? Có cần thông báo stakeholder? Có chạm `retention.ms` khiến **mất message chưa đọc** không — nếu sắp chạm, tăng retention ngay.
5. **Theo dõi recovery:** lag phải giảm dần; tính ETA = lag / (consume rate − produce rate) để báo cáo.

### Fix ngắn hạn vs dài hạn

| Fix ngắn hạn | Fix dài hạn |
|---|---|
| Scale consumer lên = số partition | Tăng số partition (cẩn thận: đổi mapping key→partition) + capacity planning |
| Skip poison message bằng reset offset | DLQ + retry policy chuẩn cho mọi consumer |
| Tăng `max.poll.interval.ms` chặn rebalance loop | Batch processing, tối ưu I/O trong consumer |
| Tăng retention tránh mất message | Alert lag theo **đạo hàm** (tốc độ tăng) và theo thời gian trễ (time lag), không chỉ con số tuyệt đối |

### 💡 Điểm ăn điểm khi trả lời
- Đọc output `kafka-consumer-groups --describe` và suy luận theo **phân bố lag per-partition** — chứng tỏ kinh nghiệm thật.
- Nhắc giới hạn **consumer ≤ partition** và hệ quả khi scale.
- Nói về **DLQ và poison message** — interviewer biết ngay bạn từng bị consumer kẹt lúc nửa đêm.

---

## Tình huống 6: Redis down — hệ thống có sống được không?

**🎤 Câu hỏi:** "Redis cluster của bạn đột nhiên down hoàn toàn. Chuyện gì xảy ra với hệ thống, và bạn xử lý thế nào?"

### Phân tích nguyên nhân khả dĩ (tác động, tuỳ cách dùng Redis)
1. **Redis chỉ là cache** → mọi request dồn xuống DB (cache miss 100%) → DB quá tải → sập dây chuyền. Đây là kịch bản chính cần lo.
2. **Redis là dependency cứng** — session store, rate limiter, distributed lock, queue (Bull/BullMQ) → tính năng tương ứng chết hẳn: user bị logout, job không chạy.
3. **App xử lý lỗi Redis tệ** — không có timeout/catch, mỗi request treo chờ Redis 30s → toàn bộ API chết dù DB vẫn khỏe.

### Các bước xử lý (trả lời mẫu)
1. **Đánh giá blast radius ngay:** dashboard — error rate API nào tăng? DB load tăng bao nhiêu? Trả lời câu hỏi "hệ thống đang chết vì *thiếu cache* hay vì *app không chịu được lỗi Redis*?"
2. **Stop the bleeding phía app:**
   - Nếu app treo vì chờ Redis: xác nhận client có `connectTimeout`/`commandTimeout` ngắn (vd 100-500ms) và code có catch lỗi để **fall through xuống DB**. Nếu không có → hotfix bật **circuit breaker / kill-switch cache** (env var `CACHE_ENABLED=false`) để app bỏ qua Redis hoàn toàn.
   - Nếu DB không chịu nổi 100% traffic: kết hợp load shedding/rate limit (như Tình huống 2), scale read replica, tắt feature phụ.
3. **Khôi phục Redis:**
   - Có **Sentinel/Cluster**: kiểm tra failover tự động — `redis-cli -p 26379 sentinel master mymaster` xem master mới được bầu chưa; nếu kẹt, failover tay: `sentinel failover mymaster`. Với Redis Cluster: `redis-cli --cluster check` xem slot coverage.
   - Managed (ElastiCache): kiểm tra event log, multi-AZ failover; node đơn thì chờ/khởi tạo lại.
   - Kiểm tra nguyên nhân gốc: OOM (`used_memory` vs `maxmemory`), `INFO` keyspace, lệnh nặng (`SLOWLOG GET`), network partition.
4. **Chống stampede khi Redis quay lại (bước hay bị quên):** Redis mới lên là **cache rỗng** — nếu mở traffic ào ạt, hàng triệu cache miss đồng thời đập vào DB lần nữa (thundering herd):
   - **Warm-up**: chạy script populate trước các key nóng nhất (top products, configs).
   - **Request coalescing / single-flight**: chỉ 1 request đi DB cho mỗi key, các request khác chờ kết quả.
   - **Jittered TTL** khi ghi lại: `TTL = base + random(0, 0.1*base)` để tránh mass expire đồng loạt về sau.
   - Mở traffic dần (giảm rate limit từ từ).
5. **Với phần dùng Redis làm dependency cứng:** session → chấp nhận re-login hoặc fallback JWT; rate limiter → fail-open (cho qua) hay fail-closed (chặn) là **quyết định nghiệp vụ phải định trước**; lock → các job đòi lock phải dừng an toàn.

### Fix ngắn hạn vs dài hạn

| Fix ngắn hạn | Fix dài hạn |
|---|---|
| Kill-switch cache, app fall through xuống DB | Circuit breaker chuẩn quanh mọi call Redis, timeout ngắn |
| Failover Sentinel/Cluster, dựng lại node | HA topology: Redis Sentinel/Cluster multi-AZ, test failover định kỳ |
| Warm-up + mở traffic dần khi Redis sống lại | Jittered TTL + single-flight thành pattern mặc định |
| Rate limit bảo vệ DB | Tách Redis theo vai trò: cache riêng, session riêng, queue riêng — blast radius nhỏ |

### 💡 Điểm ăn điểm khi trả lời
- Mở đầu bằng câu hỏi phản biện: *"Hệ quả phụ thuộc Redis là cache hay hard dependency — đây là điều phải biết TRƯỚC khi sự cố xảy ra"* — thể hiện tư duy failure mode analysis.
- Nhắc đến **stampede khi Redis quay lại** — phần lớn ứng viên chỉ nói đến lúc nó chết.
- Nêu quyết định **fail-open vs fail-closed** cho rate limiter — tư duy trade-off nghiệp vụ chứ không thuần kỹ thuật.

---

## Tình huống 7: Cache avalanche sau khi deploy (mass expire / cold cache)

**🎤 Câu hỏi:** "Mỗi lần deploy xong, DB load tăng vọt trong 5 phút rồi mới hạ. Một lần tệ nhất DB suýt sập. Chuyện gì đang xảy ra và bạn fix thế nào?"

### Phân tích nguyên nhân khả dĩ
1. **Cold cache sau deploy** — deploy flush cache (in-memory cache mất khi restart pod, hoặc script deploy `FLUSHALL`/đổi cache key prefix theo version).
2. **Mass expire đồng loạt** — cache được set cùng lúc (sau deploy/warm-up) với TTL giống nhau → hết hạn cùng lúc → avalanche định kỳ.
3. **Thundering herd trên key nóng** — 1 key hot hết hạn, 1000 request cùng miss và cùng query DB (cache stampede, dạng cục bộ của avalanche).
4. **Deploy đổi schema cache key** — code mới đọc key mới, toàn bộ key cũ thành vô dụng.

### Các bước xử lý (trả lời mẫu)
1. **Xác nhận giả thuyết bằng metrics:** Grafana — cache hit ratio rớt từ 95% xuống ~0% đúng thời điểm deploy? `redis-cli INFO stats` xem `keyspace_misses` tăng vọt? DB QPS tăng tương ứng? → đúng cold cache.
2. **Tìm nguyên nhân cache lạnh:** review deploy script có `FLUSHALL`/`FLUSHDB` không; cache key có chứa version/build hash không (`cache:v2.3.1:product:123` — mỗi deploy đổi prefix là toàn bộ cache thành rác); app dùng in-memory cache (node-cache, LRU local) thì restart pod đương nhiên mất.
3. **Fix ngay cho lần deploy tới (ngắn hạn):**
   - Bỏ flush cache khỏi deploy script trừ khi bắt buộc (đổi format data thì dùng versioned key cho **từng loại key**, không phải toàn bộ).
   - Deploy rolling chậm hơn để cache cục bộ chỉ lạnh từng phần.
4. **Triển khai 4 kỹ thuật chống avalanche (dài hạn):**
   - **Jittered TTL:** `ttl = 600 + Math.floor(Math.random() * 120)` — phá vỡ mass expire đồng loạt.
   - **Cache warm-up:** sau deploy, job tự động populate top N key nóng (lấy từ analytics/`redis-cli --hotkeys` trước đó) TRƯỚC khi nhận traffic; hook vào readiness probe — pod chỉ ready khi warm xong.
   - **Request coalescing (single-flight):** với mỗi key đang miss, chỉ 1 promise đi DB, các caller khác await chung promise đó. Node.js trong 1 process: giữ `Map<key, Promise>`; cross-instance: lock ngắn bằng `SET key:lock 1 NX PX 3000`.
   - **Stale-while-revalidate:** lưu kèm `logical_ttl` < TTL thật; khi quá logical TTL, trả data cũ ngay lập tức và refresh nền — user không bao giờ chờ DB, DB không bao giờ nhận burst.
5. **Verify:** lần deploy sau, hit ratio chỉ rớt nhẹ, DB load phẳng → đóng incident, ghi pattern vào engineering guideline.

### Fix ngắn hạn vs dài hạn

| Fix ngắn hạn | Fix dài hạn |
|---|---|
| Bỏ flush cache khỏi deploy script | Jittered TTL thành chuẩn mọi nơi set cache |
| Deploy rolling chậm, giờ thấp điểm | Warm-up tự động gắn vào readiness probe |
| Lock NX tạm cho vài key nóng nhất | Single-flight + stale-while-revalidate trong cache library chung của team |
| Tăng DB capacity tạm trong lúc deploy | Alert trên cache hit ratio (rớt dưới 80% = cảnh báo) |

### 💡 Điểm ăn điểm khi trả lời
- Phân biệt rạch ròi 3 khái niệm hay bị lẫn: **avalanche** (nhiều key chết cùng lúc), **stampede/thundering herd** (1 key nóng, nhiều request cùng miss), **penetration** (query key không tồn tại — fix bằng negative caching/bloom filter). Nói thêm penetration là điểm cộng.
- Đề xuất **đóng gói các pattern này vào cache library dùng chung** thay vì fix từng chỗ — tư duy platform.
- Liên hệ deploy process: cache là một phần của deploy strategy, không phải chuyện riêng của runtime.

---

## Tình huống 8: Endpoint bị gọi trùng gây tạo đơn hàng đôi

**🎤 Câu hỏi:** "CS báo có khách bị tạo 2 đơn hàng giống hệt nhau, trừ tiền 2 lần. Log cho thấy 2 request POST /orders giống nhau cách nhau 800ms. Bạn xử lý và phòng chống thế nào?"

### Phân tích nguyên nhân khả dĩ
1. **User double-click** nút thanh toán, frontend không disable nút.
2. **Client/SDK tự retry** khi request đầu chậm (timeout phía client nhưng server vẫn xử lý thành công) — kinh điển: mobile app retry, axios-retry, gateway retry POST.
3. **Load balancer / proxy retry** request khi upstream trả lỗi sau khi đã ghi DB một phần.
4. **Message queue redelivery** — nếu order tạo qua consumer, at-least-once delivery + xử lý không idempotent.
5. **Race trong chính server** — 2 request song song cùng pass bước check "đơn đã tồn tại chưa" (check-then-act không atomic).

### Các bước xử lý (trả lời mẫu)
1. **Xử lý hậu quả trước (nghiệp vụ):** xác định phạm vi — query tìm các đơn trùng:
   ```sql
   SELECT user_id, amount, count(*) FROM orders
   WHERE created_at > now() - interval '7 days'
   GROUP BY user_id, amount, date_trunc('minute', created_at) HAVING count(*) > 1;
   ```
   Phối hợp CS refund/hủy đơn trùng. Khách bị trừ tiền 2 lần là sự cố mức độ cao — ưu tiên xử lý tiền trước, code sau.
2. **Truy nguồn request trùng:** so sánh 2 request trong log — cùng `User-Agent`, cùng device? Khoảng cách 800ms gợi ý client retry với timeout ngắn hoặc double-click. Kiểm tra config retry của client/SDK/gateway (ALB/nginx `proxy_next_upstream` có retry POST không — mặc định nguy hiểm).
3. **Fix căn cơ ở server — KHÔNG tin client:**
   - **Idempotency key:** client sinh `Idempotency-Key` (UUID) gắn vào header khi tạo đơn. Server: trước khi xử lý, `INSERT INTO idempotency_keys(key, status) VALUES($1,'processing')` — nếu vi phạm unique → request trùng: nếu request gốc xong rồi, trả lại **response đã lưu** (cùng status code/body); nếu đang xử lý, trả `409`. Lưu key với TTL (vd 24h) — đây là **dedup window**.
   - **Unique constraint làm lưới cuối:** kể cả có idempotency key, vẫn thêm ràng buộc nghiệp vụ: `UNIQUE (user_id, cart_id)` hoặc `UNIQUE (client_order_ref)` — DB là chốt chặn atomic cuối cùng, vì check-then-act ở app luôn có race.
   - Lý do cần cả hai: idempotency key cho trải nghiệm đúng (trả lại response cũ), unique constraint cho an toàn tuyệt đối.
4. **Fix phía client (giảm tần suất, không phải giải pháp chính):** disable nút sau click, client sinh idempotency key **một lần cho mỗi lần bấm mua** và giữ nguyên khi retry.
5. **Rà soát retry-safe toàn hệ thống:** phân loại endpoint — GET/PUT/DELETE idempotent tự nhiên, POST thì không; quy ước: **chỉ retry POST khi có idempotency key**. Với consumer Kafka/SQS: thiết kế handler idempotent (upsert theo message id) vì at-least-once là mặc định.

### Fix ngắn hạn vs dài hạn

| Fix ngắn hạn | Fix dài hạn |
|---|---|
| Refund/hủy đơn trùng, script tìm duplicate | Idempotency key chuẩn cho mọi endpoint ghi tiền/đơn |
| Hotfix unique constraint `(user_id, cart_id)` | Unique constraint nghiệp vụ + xử lý lỗi 23505 trả response thân thiện |
| Tắt retry POST ở gateway/SDK | Quy ước retry policy toàn công ty: POST chỉ retry kèm key |
| Frontend disable nút submit | Consumer idempotent (dedup theo message id), test chaos gửi trùng |

### 💡 Điểm ăn điểm khi trả lời
- Mở màn bằng **xử lý tiền của khách trước, fix code sau** — tư duy ưu tiên đúng của người làm production.
- Khẳng định **defense in depth: idempotency key (UX đúng) + unique constraint (an toàn tuyệt đối)** — và giải thích vì sao check-then-act ở app không bao giờ đủ.
- Mở rộng sang at-least-once delivery của message queue — cho thấy hiểu duplicate là bản chất của distributed system, không phải bug hi hữu.

---

## Tình huống 9: Deadlock trong PostgreSQL xuất hiện ngẫu nhiên

**🎤 Câu hỏi:** "Log production thỉnh thoảng xuất hiện `deadlock detected`, tần suất tăng dần theo traffic. Bạn điều tra và xử lý thế nào?"

### Phân tích nguyên nhân khả dĩ
1. **Hai transaction lock các row theo thứ tự ngược nhau** — TX1 update A rồi B, TX2 update B rồi A (nguyên nhân số 1).
2. **Batch update không sắp xếp** — `UPDATE ... WHERE id IN (...)` hoặc vòng lặp update nhiều row với thứ tự khác nhau giữa các worker.
3. **Foreign key + lock lan truyền** — update bảng con lock luôn row bảng cha (FK check), đan xen với transaction khác.
4. **Transaction quá dài** — giữ lock lâu (gọi API ngoài giữa transaction!), tăng cửa sổ va chạm.
5. **Job/worker song song giành cùng tập row** — nhiều worker cùng claim task từ 1 bảng queue.

### Các bước xử lý (trả lời mẫu)
1. **Đọc kỹ log deadlock — Postgres cho biết chính xác:**
   ```
   DETAIL: Process 1234 waits for ShareLock on transaction 567; blocked by process 5678.
           Process 5678 waits for ShareLock on transaction 568; blocked by process 1234.
   CONTEXT: ... 2 queries kèm theo
   ```
   Log chứa **2 query đang giành nhau** — đây là manh mối chính. Bật `log_lock_waits = on` và `deadlock_timeout = 1s` để có thêm dữ liệu về lock chờ lâu (tiền thân của deadlock).
2. **Tái dựng kịch bản:** từ 2 query, lần ngược code tìm 2 code path chạm cùng các bảng/row — vẽ thứ tự lock của từng transaction. Tìm điểm thứ tự ngược nhau.
3. **Fix ngắn hạn — retry:** deadlock không phải lỗi chí mạng, Postgres tự kill 1 victim. App phải **retry transaction khi gặp SQLSTATE 40P01** (với backoff, max 3 lần). Đa số ORM không tự làm — wrap transaction helper. Điều này biến deadlock từ "lỗi user thấy" thành "blip vô hình".
4. **Fix gốc rễ theo từng nguyên nhân:**
   - **Thứ tự lock nhất quán:** quy ước toàn codebase — luôn lock theo thứ tự cố định (vd: sort theo primary key tăng dần trước khi update batch: `SELECT ... WHERE id IN (...) ORDER BY id FOR UPDATE` rồi mới update; với 2 bảng, luôn bảng A trước bảng B).
   - **Rút ngắn transaction:** TUYỆT ĐỐI không gọi external API/queue trong transaction; tách read chuẩn bị ra ngoài, transaction chỉ còn vài statement ghi.
   - **Worker giành row (job queue pattern):** dùng `SELECT ... FOR UPDATE SKIP LOCKED LIMIT 10` — worker chỉ lấy row chưa ai giữ, không chờ không deadlock. Đây là pattern chuẩn cho queue trên Postgres.
   - Cân nhắc lock granularity: advisory lock (`pg_advisory_xact_lock`) cho các luồng tranh chấp theo entity.
5. **Giám sát:** đếm deadlock qua `pg_stat_database.deadlocks`, alert khi tăng; log retry count phía app để biết tần suất thật (retry che mất triệu chứng).

### Fix ngắn hạn vs dài hạn

| Fix ngắn hạn | Fix dài hạn |
|---|---|
| Retry transaction khi SQLSTATE 40P01 (backoff) | Quy ước thứ tự lock nhất quán toàn codebase (sort by PK) |
| Bật `log_lock_waits` thu thêm dữ liệu | Rút ngắn transaction, cấm external call trong transaction |
| Giảm concurrency worker đang va nhau | `FOR UPDATE SKIP LOCKED` cho mọi job-queue pattern |
| — | Alert trên `pg_stat_database.deadlocks` + metric retry phía app |

### 💡 Điểm ăn điểm khi trả lời
- Nói được **log deadlock của Postgres in sẵn 2 query thủ phạm** — người chưa từng đọc log đó sẽ không biết.
- Khẳng định deadlock là **điều bình thường ở hệ concurrent, chiến lược đúng là retry + giảm tần suất**, không phải "diệt sạch deadlock" — tư duy thực tế.
- Nhắc `SELECT FOR UPDATE SKIP LOCKED` đúng ngữ cảnh worker/queue — pattern senior hay dùng.

---

## Tình huống 10: Migrate bảng 500 triệu rows không downtime

**🎤 Câu hỏi:** "Bạn cần đổi schema một bảng 500 triệu rows đang phục vụ production 24/7 — ví dụ đổi kiểu cột, thêm cột NOT NULL, hoặc tách bảng. Kế hoạch của bạn?"

### Phân tích rủi ro nếu làm "ngây thơ"
1. `ALTER TABLE ... ALTER COLUMN TYPE` → rewrite toàn bảng + giữ `ACCESS EXCLUSIVE` lock → khóa đọc/ghi hàng giờ → downtime.
2. Thêm cột `NOT NULL DEFAULT` trên phiên bản DB cũ → rewrite bảng (Postgres 11+ đã ok với default tĩnh — phải biết version).
3. Backfill 500M rows một lệnh `UPDATE` → bloat khổng lồ, WAL đầy, replication lag, lock dài.
4. Không có rollback plan → kẹt giữa chừng không tiến không lùi được.

### Các bước xử lý (trả lời mẫu) — Expand/Contract pattern
1. **Expand — thêm cái mới, không đụng cái cũ:**
   - Thêm cột/bảng mới ở dạng nullable, không default rewrite: `ALTER TABLE orders ADD COLUMN amount_v2 bigint;` (metadata-only, gần như tức thì). Index mới: `CREATE INDEX CONCURRENTLY`.
   - Schema cũ và mới **tồn tại song song** — đây là chìa khóa zero-downtime.
2. **Dual write:** deploy code ghi **cả cột cũ lẫn mới** trong cùng transaction (hoặc qua trigger DB nếu nhiều service cùng ghi — trigger đảm bảo không sót đường ghi nào). Đọc vẫn từ cột cũ.
3. **Backfill theo batch:**
   ```sql
   UPDATE orders SET amount_v2 = amount::bigint
   WHERE id BETWEEN $start AND $start + 10000 AND amount_v2 IS NULL;
   ```
   - Batch 5-10k rows, **sleep giữa các batch**, chạy giờ thấp điểm; theo dõi replication lag (`pg_stat_replication`), CPU, bloat — lag tăng thì giảm tốc (throttle tự động).
   - Script phải **resumable** (lưu checkpoint id) và idempotent.
   - 500M rows với 10k/batch ≈ 50k batch — chạy vài ngày là bình thường, không vội.
4. **Verify:** so sánh checksum/count giữa cũ và mới: `SELECT count(*) FROM orders WHERE amount_v2 IS DISTINCT FROM amount::bigint;` phải = 0. Chạy verify liên tục trong giai đoạn dual write.
5. **Cutover đọc:** deploy code đọc cột mới (lý tưởng sau **feature flag** để chuyển % dần và bật lại cũ trong 1 giây nếu lỗi). Theo dõi vài ngày.
6. **Contract — dọn dẹp:** ngừng ghi cột cũ → đợi 1-2 release an toàn → `ALTER TABLE DROP COLUMN amount` (nhanh, chỉ metadata). Thêm `NOT NULL` cho cột mới: dùng `ADD CONSTRAINT ... CHECK (amount_v2 IS NOT NULL) NOT VALID` rồi `VALIDATE CONSTRAINT` (không lock dài).
7. **Rollback plan ở MỌI bước:** trước cutover — chỉ cần tắt dual write; sau cutover — flag đọc lại cột cũ (vẫn đang được ghi). Điểm không thể quay lại là DROP COLUMN — vì vậy làm muộn nhất.
8. **Công cụ:** MySQL có **gh-ost**/pt-online-schema-change (tạo shadow table + đọc binlog để sync, rồi atomic rename — cùng triết lý expand/contract tự động hóa). Postgres: bloat sau backfill xử lý bằng **pg_repack** (rebuild online không lock).

### Fix ngắn hạn vs dài hạn

| Fix ngắn hạn (trong dự án migrate) | Fix dài hạn (quy trình) |
|---|---|
| Throttle backfill khi replication lag tăng | Checklist migration chuẩn: mọi `ALTER` phải trả lời "lock gì, bao lâu?" |
| Feature flag cho cutover đọc, rollback 1 giây | CI lint migration (vd squawk cho Postgres) chặn lệnh nguy hiểm |
| Checkpoint + resume cho script backfill | `lock_timeout = 2s` mặc định cho mọi DDL — thà fail còn hơn treo production |
| pg_repack dọn bloat sau backfill | Diễn tập migrate trên bản sao production-size trước khi chạy thật |

### 💡 Điểm ăn điểm khi trả lời
- Gọi tên **expand/contract (parallel change)** và nhấn mạnh **mỗi bước đều có rollback** — đây là điều interviewer chấm cao nhất.
- Chi tiết "đắt tiền": `lock_timeout` cho DDL, `NOT VALID` + `VALIDATE`, `CREATE INDEX CONCURRENTLY`, throttle theo replication lag — chứng tỏ từng chạy migration lớn thật.
- Nói về thời gian thực tế: "backfill chạy vài ngày là chấp nhận được, an toàn quan trọng hơn nhanh" — tư duy vận hành chín chắn.

---

## Tình huống 11: Service downstream chậm làm cả hệ thống chậm theo (cascading failure)

**🎤 Câu hỏi:** "Service `recommendation` chậm, nhưng kéo theo cả trang chủ và checkout — những thứ tưởng như không liên quan — cũng chết. Vì sao, và bạn thiết kế lại thế nào?"

### Phân tích nguyên nhân khả dĩ (cơ chế lan truyền)
1. **Thiếu timeout hoặc timeout quá dài** — request chờ recommendation 30s, giữ connection/worker → backpressure dồn ngược lên caller.
2. **Cạn shared resource** — connection pool/worker chung cho mọi downstream: gọi recommendation chiếm hết pool, checkout không còn slot dù downstream của nó khỏe (thiếu bulkhead).
3. **Retry storm** — caller retry ngay khi chậm, nhân 2-3 lần tải lên service đang hấp hối, đảm bảo nó không bao giờ hồi phục.
4. **Node.js event loop/heap nghẽn** — hàng vạn promise pending chờ response tích tụ, memory tăng, GC dày → chính caller cũng chậm với mọi request.
5. **Sync call cho thứ đáng lẽ optional** — trang chủ chờ recommendation xong mới render thay vì coi nó là phụ.

### Các bước xử lý (trả lời mẫu)
1. **Stop the bleeding:** tắt/bypass call sang recommendation ngay (feature flag, hoặc hotfix trả empty list) — trang chủ và checkout hồi phục lập tức vì hết bị giữ connection. Sau đó mới cứu recommendation.
2. **Xác nhận cơ chế lan truyền:** trace cho thấy span recommendation 30s trong request trang chủ; metric pool (`active/idle/pending`) cho thấy pool cạn; đếm pending requests. Hiểu rõ "vì sao lan" để fix đúng tầng.
3. **Thiết kế lại — bộ tứ resilience patterns:**
   - **Timeout đúng chỗ và có ngân sách (timeout budget):** mọi call ra ngoài PHẢI có timeout, và timeout downstream < timeout của caller. VD: client chờ 3s → gateway 2.5s → service 2s → DB/downstream 1s. Recommendation cho trang chủ: timeout 200ms là đủ — quá thì bỏ.
   - **Circuit breaker** (opossum cho Node.js): error/timeout rate vượt ngưỡng (vd 50% trong 10s) → mở mạch, fail fast ngay không gọi nữa; sau `resetTimeout` thử half-open vài request. Tác dụng kép: caller không tốn tài nguyên chờ, downstream được giảm tải để hồi phục.
   - **Bulkhead:** tách pool/limit concurrency theo từng downstream — recommendation tối đa 50 in-flight requests, hết slot thì fail ngay. Chìm một khoang, tàu không chìm.
   - **Retry có kỷ luật:** chỉ retry lỗi transient (timeout, 503), exponential backoff + **full jitter**, giới hạn **retry budget** (vd retry ≤ 10% tổng request) — vượt budget thì thôi không retry; không retry khi circuit đang mở; không retry ở nhiều tầng chồng nhau (gateway retry × service retry = nhân tải).
   - **Fallback có ý nghĩa:** recommendation chết → trả danh sách phổ biến đã cache/empty; mỗi dependency phải phân loại trước: **critical** (checkout không có payment thì fail thật) vs **optional** (degrade êm).
4. **Kiểm chứng:** chaos test — inject latency 30s vào recommendation ở staging (toxiproxy/chaos mesh), xác nhận trang chủ vẫn p99 < 500ms.

### Fix ngắn hạn vs dài hạn

| Fix ngắn hạn | Fix dài hạn |
|---|---|
| Feature flag bypass downstream đang chậm | Timeout budget chuẩn hóa toàn chuỗi gọi |
| Hạ timeout call recommendation xuống vài trăm ms | Circuit breaker + bulkhead trong shared HTTP client library |
| Tắt retry tự động đang nhân tải | Retry policy có jitter + budget, quy ước 1 tầng retry duy nhất |
| Scale caller tạm thời để có thêm pool | Phân loại dependency critical/optional + fallback; chaos testing định kỳ |

### 💡 Điểm ăn điểm khi trả lời
- Giải thích được **cơ chế lan truyền** (giữ connection/pool cạn/promise tích tụ) chứ không chỉ liệt kê tên pattern — interviewer phân biệt người đọc blog với người từng bị.
- Nhắc **retry budget và tác hại retry chồng tầng** — chi tiết ít người nói.
- Chốt bằng **chaos testing**: "resilience không test thì coi như không có".

---

## Tình huống 12: Hot partition trong Kafka / hot key trong Redis

**🎤 Câu hỏi:** "Cluster Redis 10 node nhưng 1 node CPU 90% trong khi 9 node còn lại 10%. Tương tự, 1 partition Kafka lag trong khi các partition khác bình thường. Bạn chẩn đoán và xử lý thế nào?"

### Phân tích nguyên nhân khả dĩ
1. **Key design tạo hot key** — 1 entity siêu nóng: sản phẩm flash-sale, celebrity user, key config global (`settings:global`) mọi request đều đọc.
2. **Partition key Kafka kém phân tán** — key theo `tenant_id` mà 1 tenant chiếm 60% traffic; hoặc key null/cố định khiến message dồn 1 partition (tùy partitioner).
3. **Key cardinality thấp** — hash theo trường chỉ có vài giá trị (status, country).
4. **Big key chứ không phải hot key** — 1 key Redis chứa list/hash hàng triệu phần tử, mỗi thao tác O(N) ăn CPU node đó.

### Các bước xử lý (trả lời mẫu)
1. **Phát hiện và định danh:**
   - Redis: `redis-cli --hotkeys` (cần `maxmemory-policy` LFU) tìm key truy cập nhiều nhất; `redis-cli --bigkeys` tìm big key; `MONITOR` vài giây trên node nóng (cẩn thận, MONITOR nặng — chỉ chạy thật ngắn) hoặc `redis-cli --stat`. Xem `SLOWLOG GET 20` tìm lệnh O(N).
   - Kafka: metric per-partition (`kafka.log:type=Log,name=Size`, messages-in per partition; hoặc dashboard JMX/Burrow) — partition nào nhận nhiều nhất; lấy mẫu message trong partition đó xem key nào lặp lại: `kafka-console-consumer --partition 3 --property print.key=true --max-messages 1000 | sort | uniq -c | sort -rn`.
2. **Stop the bleeding:**
   - Redis hot key dạng đọc: bật **local cache (in-process) trước Redis** cho riêng key đó — TTL 1-5s đủ giảm 99% lượt gọi mà data vẫn gần như tươi. Đây là fix nhanh hiệu quả nhất.
   - Kafka: tăng tài nguyên consumer đang gánh partition nóng (vertical), tạm thời.
3. **Fix gốc rễ — sửa key design:**
   - **Key salting / split key (đọc nhiều):** nhân bản hot key thành N bản — ghi vào `product:123:0..9` (10 bản), đọc random 1 bản: `product:123:{rand(0,9)}`. Trade-off: ghi tốn 10 lần, nhất quán giữa các bản phải chấp nhận eventual.
   - **Counter ghi nhiều (vd đếm view):** sharded counter — `INCR view:123:{rand(0,9)}`, đọc tổng bằng cộng 10 key; hoặc gom batch trong app rồi flush định kỳ.
   - **Kafka salting:** key = `tenant_id + "-" + (hash(msg_id) % 4)` cho tenant lớn → trải sang 4 partition. Trade-off quan trọng: **mất ordering toàn cục theo tenant** — chỉ còn ordering trong sub-key; phải xác nhận consumer chịu được.
   - **Big key:** tách cấu trúc — hash lớn thành nhiều hash nhỏ theo bucket, list dài sang sorted set phân trang; tránh lệnh O(N) (`LRANGE 0 -1`, `HGETALL` trên hash khổng lồ, `KEYS`).
   - Tăng partition Kafka chỉ giúp khi skew do **ít partition**, không giúp khi skew do **1 key** — nói rõ phân biệt này.
4. **Giám sát lâu dài:** dashboard per-node Redis CPU/ops, per-partition Kafka throughput + lag; alert khi **độ lệch chuẩn** giữa các node/partition vượt ngưỡng (max/avg > 3) — phát hiện skew trước khi cháy.

### Fix ngắn hạn vs dài hạn

| Fix ngắn hạn | Fix dài hạn |
|---|---|
| Local in-process cache (TTL ngắn) chắn trước hot key | Key salting / split key cho entity nóng |
| Scale dọc node/consumer đang gánh | Thiết kế partition key: cardinality cao + phân tán đều, review khi tạo topic |
| Giảm tần suất đọc key config global (cache app-level) | Sharded counter cho write nóng |
| Tách big key thủ công | Alert trên skew (max/avg per node, per partition) |

### 💡 Điểm ăn điểm khi trả lời
- Phân biệt **hot key vs big key** (truy cập nhiều vs giá trị to) — hai bệnh khác nhau, chữa khác nhau.
- Nói rõ trade-off của salting: **đánh đổi ordering (Kafka) / consistency (Redis) lấy phân tán** — không có giải pháp miễn phí.
- Chỉ ra "thêm node/partition không chữa được 1 key nóng" — hiểu bản chất hashing, rất nhiều ứng viên trả lời sai chỗ này.

---

## Tình huống 13: Sau deploy lỗi tăng vọt — rollback hay fix forward?

**🎤 Câu hỏi:** "10 phút sau khi deploy version mới, error rate nhảy từ 0.1% lên 8%. Dev báo 'em biết lỗi rồi, sửa 1 dòng là xong'. Bạn rollback hay để dev fix forward? Vì sao?"

### Phân tích tình huống
1. **Mặc định là ROLLBACK.** Quy tắc vàng: production đang chảy máu, con đường về trạng thái tốt **đã được kiểm chứng** là quay lại version cũ. "Sửa 1 dòng" nghe nhanh nhưng: build + test + deploy mất 15-30 phút, và fix viết dưới áp lực có xác suất sai cao (fix đè fix là kịch bản kinh điển làm incident dài gấp ba).
2. **Khi nào fix forward hợp lý:** (a) rollback **không an toàn** — version mới đã ghi data theo format mới mà version cũ không đọc được, DB migration không tương thích ngược; (b) lỗi đã có sẵn ở version cũ (rollback vô ích); (c) fix thật sự trivial VÀ pipeline deploy < 5 phút VÀ error rate thấp chưa nghiêm trọng; (d) version mới chứa fix bảo mật không thể gỡ.
3. **Trường hợp khó nhất: DB migration đã chạy.** Đây là lý do quy tắc **migration phải backward-compatible** tồn tại.

### Các bước xử lý (trả lời mẫu)
1. **Xác nhận deploy là thủ phạm:** error rate tăng trùng timestamp rollout? `kubectl rollout history deployment/api`; lỗi chỉ xuất hiện ở pod version mới (so sánh theo label/canary)? Nếu chỉ tương quan thời gian mơ hồ — kiểm tra thêm 1 phút, đừng rollback mù.
2. **Đánh giá rollback có an toàn không (30 giây tự hỏi):**
   - Release này có **DB migration** không? Migration thuộc loại nào — additive (thêm cột/bảng: rollback code vô tư, schema mới cứ để đó) hay destructive (xóa/đổi cột: code cũ sẽ vỡ)?
   - Version mới đã **ghi data format mới** chưa? Có message version mới trong queue mà consumer cũ không parse được không?
3. **Thực hiện rollback:** `kubectl rollout undo deployment/api` (hoặc deploy lại tag cũ qua CI — ưu tiên cách có audit trail), theo dõi error rate về baseline, xác nhận với dashboard chứ không tin cảm giác.
4. **Nếu có feature flag:** còn nhanh hơn rollback — tắt flag của feature lỗi, code mới vẫn chạy, không cần deploy gì cả. Đây là lý do **feature mới nên ở sau flag**.
5. **Nếu migration chặn rollback (destructive đã chạy):** không rollback code mù — các lựa chọn theo thứ tự: (a) fix forward có kiểm soát, thêm người review fix; (b) viết migration bù (re-add cột) rồi mới rollback code; (c) rollback code kèm patch nhỏ cho code cũ chịu được schema mới. Đồng thời ghi nhận vi phạm quy trình: lẽ ra destructive migration phải tách khỏi release đổi code (expand/contract — xem Tình huống 10).
6. **Sau khi ổn định:** dev fix đàng hoàng, review kỹ, test bổ sung tái hiện đúng lỗi, deploy lại qua canary. Postmortem: vì sao test không bắt được? Vì sao canary không chặn?

### Fix ngắn hạn vs dài hạn

| Fix ngắn hạn | Fix dài hạn |
|---|---|
| `kubectl rollout undo` / deploy lại tag cũ | Canary deployment: 5% traffic 10 phút + tự động rollback theo error rate |
| Tắt feature flag của feature lỗi | Mọi feature đáng kể đều sau feature flag |
| Migration bù nếu rollback bị chặn | Quy tắc: migration luôn backward-compatible, tách release schema khỏi release code |
| Thêm reviewer cho hotfix viết dưới áp lực | Alert error rate gắn vào pipeline deploy (tự dừng rollout), test tái hiện bug vào CI |

### 💡 Điểm ăn điểm khi trả lời
- Trả lời dứt khoát **"mặc định rollback"** kèm lý do "đường về trạng thái tốt đã kiểm chứng" — rồi mới liệt kê ngoại lệ. Do dự kiểu "tùy ạ" bị đánh giá thấp.
- Chủ động nêu **DB migration là cái bẫy của rollback** và nối sang expand/contract — thể hiện nhìn thấy trước vấn đề.
- Nhắc canary + automated rollback: mục tiêu dài hạn là **con người không phải ra quyết định này lúc 2h sáng**.

---

## Tình huống 14: Hai service cập nhật cùng dữ liệu gây race condition / mất update

**🎤 Câu hỏi:** "Inventory service và Order service cùng cập nhật số tồn kho. Thỉnh thoảng số tồn bị sai — bán 5 cái nhưng tồn chỉ giảm 3. Bạn truy và fix thế nào?"

### Phân tích nguyên nhân khả dĩ
1. **Lost update do read-modify-write:** cả hai đọc `stock=10`, A ghi `10-2=8`, B ghi `10-3=7` → mất update của A. Nguyên nhân số 1 khi thấy "giảm thiếu".
2. **Check-then-act không atomic:** `if (stock >= qty) then update` — 2 request cùng pass check rồi cùng trừ, oversell.
3. **Cache/replica stale:** đọc số tồn từ cache hoặc read replica trễ rồi ghi đè ngược vào DB.
4. **Event xử lý sai thứ tự / trùng:** consumer at-least-once xử lý event 2 lần, hoặc 2 event đến trái thứ tự mà handler kiểu "set giá trị tuyệt đối".
5. **Hai nguồn ghi không qua một cửa:** cả hai service ghi thẳng vào bảng, không service nào là owner.

### Các bước xử lý (trả lời mẫu)
1. **Tái hiện và chứng minh:** đọc code đường ghi tồn kho — tìm pattern `const s = await getStock(); await setStock(s - qty);` (read-modify-write = án tại hồ sơ). Viết test bắn 50 request song song trừ kho, xác nhận số cuối sai. Audit log/event history của các đơn bị lệch để xem 2 update chồng thời gian.
2. **Fix theo thang công cụ, từ đơn giản đến phức tạp — chọn cái ĐƠN GIẢN NHẤT đủ dùng:**
   - **Atomic operation (ưu tiên số 1):** đừng đọc rồi ghi — để DB tính:
     ```sql
     UPDATE inventory SET stock = stock - $qty
     WHERE product_id = $id AND stock >= $qty;
     ```
     Check `rowCount`: 0 nghĩa là hết hàng → reject. Một câu lệnh giải quyết cả lost update lẫn oversell, không lock thủ công, không version. 80% bài toán dừng ở đây.
   - **Optimistic locking (khi update phức tạp nhiều bước/nhiều field):** thêm cột `version`; `UPDATE ... SET ..., version = version + 1 WHERE id = $id AND version = $expected` — rowCount = 0 nghĩa là ai đó sửa trước → đọc lại, tính lại, retry (giới hạn lần). Hợp khi conflict hiếm.
   - **Pessimistic locking (`SELECT ... FOR UPDATE`):** khi conflict dày đặc và logic giữa đọc-ghi phức tạp, serialize hẳn. Trade-off: throughput giảm, cẩn thận deadlock (Tình huống 9).
   - **Distributed lock (Redis/ZooKeeper) — CHỈ khi thật sự cần:** tức là critical section trải qua **nhiều resource ngoài một DB** (vd trừ kho + gọi API đối tác phải đi cùng nhau). Nếu data trong 1 DB, lock của DB luôn đúng hơn — Redis lock có vấn đề expiry giữa chừng, clock drift; cần fencing token mới an toàn. Đừng vung distributed lock khi `UPDATE ... WHERE` là đủ — interviewer rất hay gài chỗ này.
3. **Fix ở tầng kiến trúc (gốc rễ):**
   - **Single writer:** chỉ Inventory service được ghi bảng tồn kho; Order service gửi command/event (`ReserveStock`) thay vì ghi thẳng. Ranh giới ownership rõ thì race biến mất theo thiết kế.
   - **Event sourcing (hướng tiếp cận, khi cần audit + đúng tuyệt đối):** không lưu "stock = 7" mà lưu chuỗi sự kiện `StockReserved(-2)`, `StockReleased(+1)` append-only; số tồn = tổng sự kiện. Hết lost update vì không ai "ghi đè", kèm audit trail tự nhiên. Đổi lại độ phức tạp cao — chỉ đề xuất cho domain tiền/kho thật sự cần.
   - Event handler phải **idempotent** (dedup theo event id) và dùng delta thay vì giá trị tuyệt đối.
4. **Sửa data đã sai:** reconciliation job — tính lại tồn từ nguồn sự thật (tổng đơn hàng/nhập kho), so với bảng hiện tại, sửa lệch và báo cáo. Chạy định kỳ luôn để phát hiện tái diễn.

### Fix ngắn hạn vs dài hạn

| Fix ngắn hạn | Fix dài hạn |
|---|---|
| Chuyển sang atomic `UPDATE ... WHERE stock >= qty` | Single writer: một service own một bảng |
| Reconciliation script sửa số tồn sai | Optimistic locking (version) thành chuẩn cho entity tranh chấp |
| Thêm version column + retry cho luồng phức tạp | Event sourcing cho domain cần audit + chính xác tuyệt đối |
| Idempotent hóa consumer (dedup theo event id) | Reconciliation định kỳ như invariant check + alert khi lệch |

### 💡 Điểm ăn điểm khi trả lời
- Trình bày theo **thang leo độ phức tạp: atomic op → optimistic → pessimistic → distributed lock** và nói rõ "chọn cái đơn giản nhất đủ dùng" — đây chính xác là điều interviewer muốn nghe.
- Cảnh giác đúng chỗ với **distributed lock** (expiry, fencing token, "nếu trong 1 DB thì dùng lock của DB") — ứng viên trung bình lao vào Redis lock ngay.
- Nhắc **reconciliation job** — người làm hệ thống tiền/kho thật luôn có job đối soát, vì phòng bệnh không bao giờ tuyệt đối.

---

## Tình huống 15: Disk Kafka broker / DB sắp đầy lúc 2h sáng

**🎤 Câu hỏi:** "2h sáng, alert: disk của Kafka broker (hoặc DB) đã 92% và đang tăng 1%/15 phút. Bạn bị gọi dậy. Hành động của bạn?"

### Phân tích nguyên nhân khả dĩ
1. **Retention quá dài so với throughput mới tăng** — producer mới/log level debug khiến data vào nhanh hơn dự toán.
2. **Một topic/bảng phình bất thường** — bug producer bắn loop, backfill job xả dữ liệu, table bloat do update nhiều mà autovacuum không kịp.
3. **WAL/binlog tích tụ** — replication slot bỏ rơi (Postgres: replica chết nhưng slot còn giữ WAL), consumer CDC (Debezium) chết.
4. **Log/temp file của chính hệ thống** — application log, core dump, temp file query lớn.
5. **Compaction/cleanup không chạy** — Kafka log cleaner chết, vacuum bị tắt.

### Các bước xử lý (trả lời mẫu)
1. **Tính thời gian còn lại trước:** 92%, tăng 1%/15 phút → **~2 tiếng đến 100%**. Disk đầy với Kafka = broker crash, với Postgres = DB ngừng nhận write hoặc tệ hơn. Có 2 tiếng — đủ làm bài bản, không panic nhưng không lề mề.
2. **Tìm cái gì đang ăn disk:**
   ```bash
   df -h && du -sh /var/lib/kafka/data/* | sort -rh | head -20   # topic-partition nào to nhất
   # Postgres:
   SELECT relname, pg_size_pretty(pg_total_relation_size(oid)) FROM pg_class ORDER BY pg_total_relation_size(oid) DESC LIMIT 10;
   SELECT slot_name, active, pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) FROM pg_replication_slots;  -- slot bỏ rơi giữ WAL
   ```
3. **Giải phóng nhanh nhất, an toàn trước (Kafka):**
   - Giảm retention topic to nhất (đặc biệt topic ít quan trọng — logs, metrics, debug): `kafka-configs --alter --entity-type topics --entity-name app-logs --add-config retention.ms=21600000` (6h) — Kafka xóa segment cũ trong vài phút. **Xác nhận consumer đã đọc qua phần sẽ xóa** (check lag) trước khi giảm, tránh mất data chưa consume.
   - Xóa topic rác/test nếu có. KHÔNG bao giờ `rm` file segment bằng tay — hỏng broker.
4. **Giải phóng nhanh (DB):**
   - Drop replication slot bỏ rơi: `SELECT pg_drop_replication_slot('dead_slot');` — thường giải phóng hàng chục GB WAL ngay (xác nhận slot đó thật sự không còn ai dùng).
   - Xóa/nén log cũ của app, temp file; `TRUNCATE` bảng log/audit đã được archive.
   - Đừng `VACUUM FULL` lúc này (lock + cần thêm disk); ghi chú pg_repack cho ban ngày.
5. **Song song: mở rộng volume nếu là cloud:** EBS/PD cho phép tăng size online — `aws ec2 modify-volume --size 1000` rồi `resize2fs`/`xfs_growfs` (K8s: sửa PVC nếu storage class cho phép expand). Đây thường là nước đi an toàn nhất — làm NGAY cả khi đã giảm retention, vì nó không có downside ngoài tiền.
6. **Chặn nguồn nếu là bug:** throughput topic nào tăng bất thường → tìm producer (bug release tối qua? log level debug quên tắt?) → tắt/rollback nguồn xả.
7. **Sáng hôm sau (không được quên):** trả lại retention đúng, postmortem trả lời câu hỏi quan trọng nhất: **vì sao alert bắn lúc 92% lúc 2h sáng thay vì 80% lúc 3h chiều?** Alert disk đúng chuẩn: cảnh báo sớm ở 75-80% **trong giờ hành chính**, và alert theo **dự báo thời-gian-đến-đầy** (vd "sẽ đầy trong < 24h" dựa trên tốc độ tăng — Prometheus `predict_linear(node_filesystem_avail_bytes[6h], 24*3600) < 0`) chứ không chỉ ngưỡng tĩnh. Capacity planning: review tăng trưởng disk hàng tháng, quota theo topic, autoscaling storage nếu có.

### Fix ngắn hạn vs dài hạn

| Fix ngắn hạn | Fix dài hạn |
|---|---|
| Giảm retention topic lớn (sau khi check consumer lag) | Alert 2 tầng: 75% warning giờ hành chính + `predict_linear` time-to-full |
| Drop replication slot bỏ rơi, dọn log/temp | Monitor replication slot/CDC consumer — chết là alert ngay |
| Mở rộng volume online (cloud) | Capacity planning định kỳ, quota per topic, retention theo giá trị data |
| Tắt nguồn xả bất thường (rollback producer lỗi) | Runbook "disk đầy" để on-call 2h sáng làm theo, không sáng tạo |

### 💡 Điểm ăn điểm khi trả lời
- Mở đầu bằng **tính time-to-full** — định lượng mức khẩn cấp trước khi hành động, đúng phong cách SRE.
- Biết bẫy thực chiến: **replication slot bỏ rơi giữ WAL** (Postgres) và **không bao giờ rm file segment Kafka bằng tay** — hai chi tiết người từng trực mới biết.
- Chốt bằng câu hỏi postmortem "vì sao alert không bắn ở 80% lúc 3h chiều" — chuyển từ chữa cháy sang phòng cháy, và nhắc **runbook cho on-call** vì người ngái ngủ không nên phải suy nghĩ từ đầu.

---

## 🎯 Checklist câu chuyện của riêng bạn

Mười lăm tình huống trên giúp bạn trả lời "nếu gặp X thì làm gì". Nhưng câu hỏi đắt giá nhất của interviewer là: **"Kể về sự cố nghiêm trọng nhất bạn từng xử lý."** — câu này không bịa được, và nó quyết định bạn được tin là senior hay không. Hãy chuẩn bị **2-3 incident THẬT** từ kinh nghiệm của bạn theo format **STAR**:

### Format STAR cho incident

- **S — Situation:** Bối cảnh hệ thống (quy mô: RPS, số user, stack), sự cố xảy ra khi nào, tác động nghiệp vụ định lượng được ("checkout fail 40% trong 25 phút, ước tính ảnh hưởng X đơn hàng"). Con số cụ thể = đáng tin.
- **T — Task:** Vai trò của BẠN — on-call chính? incident commander? người được gọi hỗ trợ? Nói rõ phần nào là bạn làm, phần nào là team — interviewer sẽ hỏi xoáy để kiểm tra.
- **A — Action:** Kể theo đúng framework đầu file: bạn stop the bleeding bằng gì → chẩn đoán theo trình tự nào (metric nào nhìn đầu tiên, giả thuyết nào loại bỏ, lệnh/công cụ cụ thể) → fix ngắn hạn → fix gốc rễ. **Kể cả ngõ cụt** ("ban đầu em nghi DB, mất 10 phút mới nhận ra là cache") — ngõ cụt làm câu chuyện thật hơn và cho thấy bạn biết tự điều chỉnh.
- **R — Result:** Thời gian khôi phục (MTTR), tác động cuối cùng, và quan trọng nhất: **những gì thay đổi sau đó** — alert mới, runbook mới, pattern code mới, postmortem dẫn đến quyết định kiến trúc gì.

### Checklist chuẩn bị (làm trước buổi phỏng vấn)

- [ ] Chọn 2-3 incident đa dạng loại: 1 về **performance/scale** (latency, traffic), 1 về **data/correctness** (duplicate, race, mất data), 1 về **infrastructure** (OOM, disk, dependency chết).
- [ ] Mỗi chuyện có **ít nhất 3 con số**: quy mô hệ thống, mức độ tác động, thời gian khôi phục.
- [ ] Xác định rõ **đóng góp cá nhân** — tránh "team em đã..." cho toàn bộ câu chuyện.
- [ ] Có ít nhất 1 chi tiết kỹ thuật sâu (lệnh, metric, config cụ thể) chứng minh bạn trực tiếp làm chứ không nghe kể lại.
- [ ] Có phần **"bài học + phòng ngừa"** — kết mỗi chuyện bằng cái đã thay đổi: alert, test, kiến trúc, quy trình. Đây là phần phân biệt senior.
- [ ] Có 1 câu chuyện mà **bạn từng làm sai** (rollback nhầm, fix đè fix...) và rút ra gì — dám kể thất bại một cách có cấu trúc là tín hiệu của người trưởng thành, miễn là kết thúc bằng bài học rõ ràng.
- [ ] Tập kể mỗi chuyện trong **2-3 phút** bản ngắn; chuẩn bị sẵn các nhánh chi tiết khi bị hỏi sâu ("vì sao chọn rollback?", "metric nào cho bạn biết điều đó?").
- [ ] Khớp câu chuyện với công ty đang phỏng vấn: công ty e-commerce → ưu tiên chuyện ngày sale; fintech → chuyện correctness/idempotency.

> **Mẹo cuối:** Khi gặp tình huống bạn CHƯA từng xử lý thật, đừng bịa. Nói thẳng: *"Em chưa gặp đúng tình huống này, nhưng em sẽ tiếp cận thế này..."* rồi áp framework 4 bước đầu file. Interviewer đánh giá quy trình tư duy cao hơn việc tỏ ra cái gì cũng từng làm.
