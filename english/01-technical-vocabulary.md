# Technical Vocabulary — Từ vựng theo chủ đề từng tuần

> Mỗi tuần ~20-25 từ/cụm từ, chọn từ **thật sự xuất hiện** trong docs chính thức và phỏng vấn. Học đúng tuần đang ôn chủ đề đó — context giúp nhớ.
>
> **Cách dùng**: mỗi ngày nạp 5-10 từ vào Anki (hướng dẫn ở [cuối file](#hướng-dẫn-import-vào-anki)), ôn thẻ đến hạn 10 phút/ngày, **đọc to** từ + câu ví dụ.
>
> ⚠️ = từ dev Việt hay phát âm sai. Đọc kỹ lưu ý, đọc to 5 lần ngay khi gặp.

---

## Week 1 — Node.js Core

| Từ/cụm | IPA | Nghĩa | Câu ví dụ thật từ docs/phỏng vấn |
|--------|-----|-------|----------------------------------|
| event loop | /ɪˈvent luːp/ | vòng lặp sự kiện | The event loop is what allows Node.js to perform non-blocking I/O operations. |
| asynchronous | /eɪˈsɪŋkrənəs/ | bất đồng bộ | Node.js uses an asynchronous, event-driven architecture. |
| non-blocking | /ˌnɒn ˈblɒkɪŋ/ | không chặn (luồng) | All I/O in Node.js is non-blocking by default. |
| single-threaded | /ˌsɪŋɡl ˈθredɪd/ | đơn luồng | JavaScript execution in Node.js is single-threaded. |
| concurrency | /kənˈkʌrənsi/ | tính đồng thời | Node.js achieves concurrency through the event loop, not threads. |
| callback | /ˈkɔːlbæk/ | hàm gọi lại | The callback is invoked once the file has been read. |
| invoke ⚠️ | /ɪnˈvoʊk/ | gọi (hàm) | The function is invoked with two arguments. — ⚠️ đọc /ɪn-VÔÚC/, trọng âm âm 2, KHÔNG đọc "in-vốc-kê" |
| queue ⚠️ | /kjuː/ | hàng đợi | Callbacks are pushed onto the task queue. — ⚠️ đọc /KIU/, một âm tiết, KHÔNG đọc "cu-ê" hay "quê-ưu" |
| emit | /ɪˈmɪt/ | phát (sự kiện) | The server emits a 'connection' event each time a client connects. |
| listener | /ˈlɪsənə(r)/ | hàm lắng nghe | Adding too many listeners can indicate a memory leak. |
| runtime | /ˈrʌntaɪm/ | môi trường chạy | Node.js is a JavaScript runtime built on Chrome's V8 engine. |
| execute | /ˈeksɪkjuːt/ | thực thi | Synchronous code executes before any callbacks. — ⚠️ trọng âm âm ĐẦU: /ÉC-si-kiut/ |
| tick | /tɪk/ | một vòng/nhịp của event loop | `process.nextTick()` runs before the next event loop tick. |
| defer | /dɪˈfɜː(r)/ | hoãn lại | `setImmediate()` defers execution until the current poll phase completes. |
| pending | /ˈpendɪŋ/ | đang chờ | The promise stays pending until the operation completes. |
| resolve | /rɪˈzɒlv/ | hoàn thành (promise); giải quyết | The promise resolves with the parsed JSON data. |
| reject | /rɪˈdʒekt/ | từ chối (promise báo lỗi) | If the request fails, the promise is rejected with an error. |
| under the hood | /ˌʌndə ðə ˈhʊd/ | bên trong, về bản chất | Under the hood, `async/await` is just syntactic sugar over promises. |
| out of the box | /ˌaʊt əv ðə ˈbɒks/ | sẵn có, không cần cấu hình | Node.js supports ES modules out of the box since v14. |
| garbage collection | /ˈɡɑːbɪdʒ kəˌlekʃn/ | thu gom rác (bộ nhớ) | Long pauses can be caused by garbage collection in V8. |
| heap | /hiːp/ | vùng nhớ heap | An out-of-memory error means the heap limit was exceeded. |
| call stack | /ˈkɔːl stæk/ | ngăn xếp lời gọi hàm | A deep recursion can overflow the call stack. |
| spawn | /spɔːn/ | sinh ra (process) | `child_process.spawn()` spawns a new process to run the command. |

**Luyện nói cuối tuần — 3 câu dùng 5+ từ của tuần (đọc to, ghi âm):**

1. *Node.js is single-threaded, but the event loop lets it handle thousands of concurrent connections with non-blocking I/O.*
   → Node.js đơn luồng, nhưng event loop cho phép nó xử lý hàng nghìn kết nối đồng thời với I/O không chặn.
2. *When the asynchronous operation completes, the callback is pushed onto the queue and invoked on the next tick.*
   → Khi thao tác bất đồng bộ hoàn tất, callback được đẩy vào hàng đợi và được gọi ở tick tiếp theo.
3. *Under the hood, `await` pauses the function until the promise resolves or rejects.*
   → Về bản chất, `await` tạm dừng hàm cho đến khi promise hoàn thành hoặc bị từ chối.

---

## Week 2 — Node.js Advanced

| Từ/cụm | IPA | Nghĩa | Câu ví dụ thật từ docs/phỏng vấn |
|--------|-----|-------|----------------------------------|
| stream | /striːm/ | luồng dữ liệu | Streams let you process data piece by piece without loading it all into memory. |
| backpressure | /ˈbækˌpreʃə(r)/ | áp lực ngược (consumer chậm hơn producer) | Backpressure occurs when the writable stream can't keep up with the readable stream. |
| pipe | /paɪp/ | nối luồng | You can pipe a readable stream into a writable stream. |
| buffer | /ˈbʌfə(r)/ | vùng đệm | Incoming data is stored in an internal buffer until it's consumed. |
| cluster | /ˈklʌstə(r)/ | cụm (nhiều process) | The cluster module lets you fork multiple workers to use all CPU cores. |
| fork | /fɔːk/ | nhân bản process | Each forked worker shares the same server port. |
| worker thread | /ˈwɜːkə θred/ | luồng worker | Use worker threads for CPU-intensive tasks like image processing. |
| memory leak | /ˈmeməri liːk/ | rò rỉ bộ nhớ | A common cause of memory leaks is forgetting to remove event listeners. |
| profiling | /ˈproʊfaɪlɪŋ/ | đo hiệu năng chi tiết | We found the hot path by profiling the app under production load. |
| throttle | /ˈθrɒtl/ | giới hạn tần suất (đều đặn) | We throttle outgoing requests to avoid hitting the rate limit. |
| debounce | /diːˈbaʊns/ | gộp/trì hoãn gọi (chỉ chạy sau khi ngừng) | Debounce the search input so we only call the API after the user stops typing. |
| race condition | /ˈreɪs kənˌdɪʃn/ | điều kiện tranh chấp | Two requests updating the same record can cause a race condition. |
| deadlock | /ˈdedlɒk/ | bế tắc (chờ lẫn nhau) | A deadlock happens when two operations wait for each other forever. |
| graceful shutdown | /ˈɡreɪsfl ˈʃʌtdaʊn/ | tắt êm (xử lý xong mới tắt) | On SIGTERM, we do a graceful shutdown: stop accepting new requests and drain existing ones. |
| middleware | /ˈmɪdlweə(r)/ | phần mềm trung gian | Authentication is handled by a middleware before the route handler runs. |
| propagate | /ˈprɒpəɡeɪt/ | lan truyền | Unhandled errors propagate up to the global handler. — ⚠️ trọng âm âm ĐẦU |
| instantiate | /ɪnˈstænʃieɪt/ | khởi tạo (đối tượng) | We instantiate a single database client and reuse it across requests. |
| deprecate ⚠️ | /ˈdeprəkeɪt/ | đánh dấu lỗi thời | `url.parse()` is deprecated; use the WHATWG URL API instead. — ⚠️ đọc /ĐÉP-rờ-cây/, KHÔNG đọc "đi-pri-cây" |
| idempotent ⚠️ | /ˌaɪdemˈpoʊtnt/ | bất biến khi gọi lặp | A retry is safe only if the operation is idempotent. — ⚠️ đọc /ai-đem-PÔ-từnt/, trọng âm âm 3 |
| stack trace | /ˈstæk treɪs/ | dấu vết lỗi | The stack trace shows exactly where the exception was thrown. |
| hierarchy ⚠️ | /ˈhaɪərɑːki/ | hệ phân cấp | Errors bubble up through the middleware hierarchy. — ⚠️ đọc /HAI-ơ-ra-ki/, KHÔNG đọc "hi-ra-chi" |
| overhead | /ˈoʊvəhed/ | chi phí phụ trội | Spawning a process per request adds too much overhead. |
| bottleneck | /ˈbɒtlnek/ | nút thắt cổ chai | Profiling showed the JSON serialization was the bottleneck. |

**Luyện nói cuối tuần:**

1. *We use streams with proper backpressure handling to process large files without a memory leak.*
   → Chúng tôi dùng streams với xử lý backpressure đúng cách để xử lý file lớn mà không rò rỉ bộ nhớ.
2. *After profiling, we found the bottleneck and moved the CPU-heavy work to a worker thread.*
   → Sau khi profiling, chúng tôi tìm ra nút thắt và chuyển phần việc nặng CPU sang worker thread.
3. *Retries are only safe because the endpoint is idempotent — calling it twice has the same effect as once.*
   → Retry chỉ an toàn vì endpoint là idempotent — gọi hai lần có hiệu quả y như một lần.

---

## Week 3 — SQL (PostgreSQL)

| Từ/cụm | IPA | Nghĩa | Câu ví dụ thật từ docs/phỏng vấn |
|--------|-----|-------|----------------------------------|
| query ⚠️ | /ˈkwɪəri/ | truy vấn | This query does a full table scan because there's no index. — ⚠️ đọc /QUI-ơ-ri/, KHÔNG đọc "que-ry" |
| schema ⚠️ | /ˈskiːmə/ | lược đồ | We version every schema change with a migration. — ⚠️ đọc /SKI-mơ/, KHÔNG đọc "sờ-che-ma" |
| index (số nhiều: indexes/indices) | /ˈɪndeks/ | chỉ mục | Adding a composite index brought the query from 2 seconds down to 5 milliseconds. |
| transaction | /trænˈzækʃn/ | giao dịch | Wrap both updates in a transaction so they succeed or fail together. |
| commit | /kəˈmɪt/ | xác nhận giao dịch | Changes are not visible to other sessions until you commit. |
| rollback | /ˈroʊlbæk/ | hoàn tác | If any step fails, we roll back the entire transaction. |
| isolation level | /ˌaɪsəˈleɪʃn ˌlevl/ | mức cô lập | Under the default isolation level, you can still get non-repeatable reads. |
| atomicity | /ˌætəˈmɪsəti/ | tính nguyên tử | Atomicity means the transaction either fully completes or has no effect at all. |
| durability | /ˌdjʊərəˈbɪləti/ | tính bền vững | Durability guarantees committed data survives a crash. |
| constraint | /kənˈstreɪnt/ | ràng buộc | A unique constraint prevents duplicate emails at the database level. |
| foreign key | /ˈfɒrən kiː/ | khóa ngoại | The foreign key ensures every order references an existing user. |
| join | /dʒɔɪn/ | phép nối bảng | An N+1 problem can usually be fixed with a single join. |
| normalize | /ˈnɔːməlaɪz/ | chuẩn hóa | We normalized the schema to avoid duplicating customer data. |
| denormalize | /diːˈnɔːməlaɪz/ | phi chuẩn hóa | We denormalized this table to avoid an expensive join on every read. |
| execution plan | /ˌeksɪˈkjuːʃn plæn/ | kế hoạch thực thi | Run `EXPLAIN ANALYZE` to see the actual execution plan. |
| full table scan | /ˌfʊl ˈteɪbl skæn/ | quét toàn bảng | The planner chose a full table scan because the filter matches most rows. |
| lock contention | /ˈlɒk kənˌtenʃn/ | tranh chấp khóa | Long transactions cause lock contention on hot rows. |
| connection pool | /kəˈnekʃn puːl/ | bể kết nối | Use a connection pool instead of opening a new connection per request. |
| migration | /maɪˈɡreɪʃn/ | di trú (thay đổi schema) | Run migrations in CI before deploying the new code. |
| stored procedure | /stɔːd prəˈsiːdʒə(r)/ | thủ tục lưu sẵn | We avoid stored procedures because they're hard to version and test. |
| sharding | /ˈʃɑːdɪŋ/ | phân mảnh dữ liệu | We sharded the users table by user ID to scale writes. |
| replication | /ˌreplɪˈkeɪʃn/ | nhân bản | Read replicas use streaming replication from the primary. |
| N+1 query problem | /ˌen plʌs ˈwʌn/ | vấn đề N+1 truy vấn | The ORM caused an N+1 query problem: one query per item in the list. |

**Luyện nói cuối tuần:**

1. *I checked the execution plan and saw a full table scan, so I added a composite index on those two columns.*
   → Tôi xem kế hoạch thực thi, thấy quét toàn bảng, nên đã thêm composite index trên hai cột đó.
2. *We wrapped the updates in a transaction to guarantee atomicity — if anything fails, everything rolls back.*
   → Chúng tôi gói các lệnh update trong một transaction để đảm bảo tính nguyên tử — nếu có gì lỗi, tất cả được hoàn tác.
3. *Denormalizing that table was a trade-off: faster reads, but we accepted some data duplication.*
   → Phi chuẩn hóa bảng đó là một sự đánh đổi: đọc nhanh hơn, nhưng chấp nhận trùng lặp dữ liệu.

---

## Week 4 — NoSQL (MongoDB)

| Từ/cụm | IPA | Nghĩa | Câu ví dụ thật từ docs/phỏng vấn |
|--------|-----|-------|----------------------------------|
| document | /ˈdɒkjumənt/ | tài liệu (bản ghi) | In MongoDB, each record is a BSON document. |
| collection | /kəˈlekʃn/ | bộ sưu tập (≈ bảng) | Documents in a collection don't need to share the same structure. |
| embedded document | /ɪmˈbedɪd/ | tài liệu nhúng | We store addresses as embedded documents inside the user document. |
| reference | /ˈrefrəns/ | tham chiếu | Use references instead of embedding when the sub-documents grow unbounded. |
| schemaless | /ˈskiːmələs/ | không ép lược đồ | Schemaless doesn't mean no schema — it means the schema lives in your code. |
| aggregation pipeline | /ˌæɡrɪˈɡeɪʃn ˈpaɪplaɪn/ | đường ống tổng hợp | The aggregation pipeline groups orders by month and sums revenue. |
| upsert | /ˈʌpsɜːt/ | update-hoặc-insert | An upsert inserts the document if no match is found. |
| replica set | /ˈreplɪkə set/ | bộ bản sao | A replica set gives you automatic failover when the primary goes down. |
| failover | /ˈfeɪloʊvə(r)/ | chuyển đổi dự phòng | During failover, a secondary is elected as the new primary. |
| partition | /pɑːˈtɪʃn/ | phân vùng | Data is partitioned across shards by the shard key. |
| shard key | /ˈʃɑːd kiː/ | khóa phân mảnh | A bad shard key creates hot partitions and uneven load. |
| hot partition | /ˌhɒt pɑːˈtɪʃn/ | phân vùng quá tải | Using timestamp as the shard key caused a hot partition for recent data. |
| horizontal scaling | /ˌhɒrɪˈzɒntl ˈskeɪlɪŋ/ | mở rộng ngang (thêm máy) | NoSQL databases are designed for horizontal scaling across commodity servers. |
| eventual consistency | /ɪˈventʃuəl kənˈsɪstənsi/ | nhất quán cuối cùng | Reads from secondaries are eventually consistent — you might see stale data. |
| strong consistency | /strɒŋ kənˈsɪstənsi/ | nhất quán mạnh | Reading from the primary gives you strong consistency at the cost of throughput. |
| stale data | /steɪl ˈdeɪtə/ | dữ liệu cũ/ôi | The dashboard can tolerate stale data, so we read from replicas. |
| write concern | /ˈraɪt kənˌsɜːn/ | mức xác nhận ghi | With write concern "majority", the write is acknowledged by most replicas. |
| acknowledge ⚠️ | /əkˈnɒlɪdʒ/ | xác nhận | The driver waits until the write is acknowledged. — ⚠️ đọc /ờc-NO-lịch/, "k" đầu CÂM |
| TTL (time to live) | /ˌtiː tiː ˈel/ | thời gian sống | A TTL index automatically deletes expired session documents. |
| CAP theorem | /ˌkæp ˈθɪərəm/ | định lý CAP | The CAP theorem says you can't have consistency and availability during a network partition. |
| throughput | /ˈθruːpʊt/ | thông lượng | Sharding increased our write throughput by 4x. |
| latency ⚠️ | /ˈleɪtənsi/ | độ trễ | Embedding reduced read latency because we avoid an extra lookup. — ⚠️ đọc /LÂY-từn-si/, KHÔNG đọc "la-ten-si" |
| trade-off | /ˈtreɪd ɒf/ | sự đánh đổi | Embedding versus referencing is a classic trade-off between read speed and document size. |

**Luyện nói cuối tuần:**

1. *We embedded the comments to cut read latency, accepting the trade-off that documents grow larger.*
   → Chúng tôi nhúng comments để giảm độ trễ đọc, chấp nhận đánh đổi là document phình to hơn.
2. *Reads from secondaries are eventually consistent, so the dashboard may show stale data for a few seconds.*
   → Đọc từ secondary là nhất quán cuối cùng, nên dashboard có thể hiển thị dữ liệu cũ vài giây.
3. *A bad shard key gave us a hot partition; we changed it and write throughput doubled.*
   → Shard key tệ gây ra hot partition; chúng tôi đổi nó và thông lượng ghi tăng gấp đôi.

---

## Week 5 — Redis

| Từ/cụm | IPA | Nghĩa | Câu ví dụ thật từ docs/phỏng vấn |
|--------|-----|-------|----------------------------------|
| cache ⚠️ | /kæʃ/ | bộ nhớ đệm | We cache the user profile in Redis for five minutes. — ⚠️ đọc /KÉ-sh/ như "cash", KHÔNG đọc "cát-chê" hay "ca-che" |
| in-memory | /ˌɪn ˈmeməri/ | trong bộ nhớ RAM | Redis is an in-memory data store, which is why it's so fast. |
| key-value store | /ˌkiː ˈvæljuː stɔː(r)/ | kho khóa-giá trị | At its core, Redis is a key-value store with rich data types. |
| cache hit / cache miss | /kæʃ hɪt/ /kæʃ mɪs/ | trúng/trượt cache | Our cache hit ratio is around 95%; every miss falls through to the database. |
| cache invalidation | /ˌɪnvəlɪˈdeɪʃn/ | vô hiệu hóa cache | Cache invalidation is one of the two hard problems in computer science. |
| expiration | /ˌekspəˈreɪʃn/ | hết hạn | Set an expiration on every key so stale entries clean themselves up. |
| eviction | /ɪˈvɪkʃn/ | trục xuất (xóa key khi đầy RAM) | When memory is full, the eviction policy decides which keys to remove. |
| LRU (least recently used) | /ˌel ɑːr ˈjuː/ | ít dùng gần đây nhất | We use the `allkeys-lru` eviction policy, so the least recently used keys go first. |
| persistence | /pəˈsɪstəns/ | lưu bền (xuống đĩa) | Redis offers two persistence options: RDB snapshots and AOF. |
| snapshot | /ˈsnæpʃɒt/ | ảnh chụp dữ liệu | RDB takes point-in-time snapshots of your dataset at intervals. |
| append-only file (AOF) | /əˌpend ˈoʊnli faɪl/ | file chỉ ghi nối | The append-only file logs every write operation for durability. |
| replication lag | /ˌreplɪˈkeɪʃn læɡ/ | độ trễ nhân bản | Under heavy writes, replication lag can cause replicas to serve stale data. |
| cache stampede | /kæʃ stæmˈpiːd/ | giẫm đạp cache (nhiều request cùng rebuild) | When a hot key expires, a cache stampede can hammer the database. |
| cache-aside | /ˌkæʃ əˈsaɪd/ | mẫu cache-aside | With cache-aside, the app reads from cache first and falls back to the database on a miss. |
| write-through | /ˈraɪt θruː/ | ghi xuyên qua cache | Write-through keeps the cache and database in sync on every write. |
| fallback | /ˈfɔːlbæk/ | phương án dự phòng | If Redis is down, we fall back to querying the database directly. |
| distributed lock | /dɪˈstrɪbjuːtɪd lɒk/ | khóa phân tán | We use a Redis distributed lock to make sure only one worker processes the job. |
| atomic operation | /əˈtɒmɪk ˌɒpəˈreɪʃn/ | thao tác nguyên tử | `INCR` is an atomic operation, so concurrent increments never lose updates. |
| pub/sub | /ˈpʌb sʌb/ | xuất bản/đăng ký | We use Redis pub/sub to broadcast events to all connected servers. |
| sorted set | /ˌsɔːtɪd ˈset/ | tập có thứ tự | A sorted set is perfect for a real-time leaderboard. |
| rate limiting | /ˈreɪt ˌlɪmɪtɪŋ/ | giới hạn tần suất | We implement rate limiting with a sliding window counter in Redis. |
| warm up (the cache) | /ˌwɔːm ˈʌp/ | làm nóng cache | After a deploy, we warm up the cache with the most popular keys. |
| single point of failure | /ˌsɪŋɡl pɔɪnt əv ˈfeɪljə(r)/ | điểm lỗi duy nhất | A single Redis instance is a single point of failure — use Sentinel or Cluster. |

**Luyện nói cuối tuần:**

1. *We use the cache-aside pattern: on a cache miss, we read from the database, then populate Redis with an expiration of five minutes.*
   → Chúng tôi dùng mẫu cache-aside: khi trượt cache, đọc từ database rồi nạp vào Redis với thời hạn 5 phút.
2. *When a hot key expires, a cache stampede can hit the database, so we add a distributed lock around the rebuild.*
   → Khi một hot key hết hạn, cache stampede có thể dồn vào database, nên chúng tôi thêm khóa phân tán quanh việc rebuild.
3. *A single Redis node is a single point of failure; with replication there's still lag, so reads can be slightly stale.*
   → Một node Redis đơn lẻ là điểm lỗi duy nhất; có replication thì vẫn có độ trễ, nên dữ liệu đọc có thể hơi cũ.

---

## Week 6 — Kafka

| Từ/cụm | IPA | Nghĩa | Câu ví dụ thật từ docs/phỏng vấn |
|--------|-----|-------|----------------------------------|
| broker | /ˈbroʊkə(r)/ | máy chủ Kafka | A Kafka cluster consists of multiple brokers for fault tolerance. |
| topic | /ˈtɒpɪk/ | chủ đề (kênh message) | Producers write events to a topic; consumers read from it. |
| partition | /pɑːˈtɪʃn/ | phân vùng | Each topic is split into partitions to allow parallel consumption. |
| offset | /ˈɒfset/ | vị trí đọc | The consumer commits its offset so it can resume after a restart. |
| producer | /prəˈdjuːsə(r)/ | bên gửi | The producer batches messages to improve throughput. |
| consumer group | /kənˈsjuːmə ɡruːp/ | nhóm tiêu thụ | Each partition is consumed by exactly one consumer in a consumer group. |
| consumer lag | /kənˈsjuːmə læɡ/ | độ trễ tiêu thụ | Consumer lag is growing, which means we can't keep up with the producers. |
| rebalance | /ˌriːˈbæləns/ | tái phân bổ partition | When a consumer joins or leaves, the group triggers a rebalance. |
| retention | /rɪˈtenʃn/ | thời gian lưu giữ | With a seven-day retention, you can replay any event from the past week. |
| replay | /ˌriːˈpleɪ/ | phát lại | We reset the offset to replay all events from the beginning. |
| at-least-once delivery | /ət ˌliːst ˈwʌns/ | giao ít nhất một lần | At-least-once delivery means consumers must handle duplicate messages. |
| exactly-once semantics | /ɪɡˌzæktli ˈwʌns sɪˈmæntɪks/ | ngữ nghĩa đúng một lần | Exactly-once semantics requires idempotent producers and transactions. |
| ordering guarantee | /ˈɔːdərɪŋ ˌɡærənˈtiː/ | đảm bảo thứ tự | Kafka only guarantees ordering within a single partition. |
| serialize | /ˈsɪəriəlaɪz/ | tuần tự hóa (object → bytes) | We serialize events with Avro and validate them against a schema registry. |
| deserialize | /diːˈsɪəriəlaɪz/ | giải tuần tự | The consumer failed to deserialize the message because the schema changed. |
| dead letter queue (DLQ) | /ˌded ˈletə kjuː/ | hàng đợi thư chết | Messages that fail processing three times are routed to a dead letter queue. |
| decouple | /diːˈkʌpl/ | tách rời phụ thuộc | Kafka decouples producers from consumers — they don't need to know about each other. |
| event-driven | /ɪˈvent ˌdrɪvn/ | hướng sự kiện | We moved to an event-driven architecture to decouple our services. |
| durable ⚠️ | /ˈdjʊərəbl/ | bền vững | Messages are durable: they're written to disk and replicated. — ⚠️ đọc /ĐIU-rờ-bồl/, KHÔNG đọc "đu-ra-ble" |
| commit (an offset) | /kəˈmɪt/ | ghi nhận offset | Commit the offset only after the message is fully processed. |
| backlog | /ˈbæklɒɡ/ | tồn đọng | After the outage, we had a backlog of two million unprocessed events. |
| poison message | /ˈpɔɪzn ˌmesɪdʒ/ | message độc (gây lỗi mãi) | A poison message kept crashing the consumer until we added a DLQ. |
| fan-out | /ˈfæn aʊt/ | tỏa ra nhiều nơi | One order event fans out to the billing, inventory, and email services. |

**Luyện nói cuối tuần:**

1. *Kafka decouples our services: the producer just publishes to a topic, and each consumer group reads at its own pace.*
   → Kafka tách rời các service: producer chỉ publish vào topic, mỗi consumer group đọc theo nhịp riêng.
2. *With at-least-once delivery we get duplicates, so the consumer has to be idempotent.*
   → Với giao hàng ít-nhất-một-lần sẽ có message trùng, nên consumer phải idempotent.
3. *Consumer lag was growing after the rebalance, so we added partitions and scaled out the consumer group.*
   → Consumer lag tăng dần sau rebalance, nên chúng tôi thêm partition và scale nhóm consumer ra.

---

## Week 7 — Docker

| Từ/cụm | IPA | Nghĩa | Câu ví dụ thật từ docs/phỏng vấn |
|--------|-----|-------|----------------------------------|
| container | /kənˈteɪnə(r)/ | vùng chứa | Containers share the host kernel, unlike virtual machines. |
| image ⚠️ | /ˈɪmɪdʒ/ | ảnh (template container) | A container is a running instance of an image. — ⚠️ đọc /Í-mịch/, trọng âm âm ĐẦU, KHÔNG đọc "i-mây-giơ" |
| layer | /ˈleɪə(r)/ | lớp | Each instruction in a Dockerfile creates a new layer, and layers are cached. |
| base image | /ˌbeɪs ˈɪmɪdʒ/ | ảnh nền | Use a slim base image like `node:20-alpine` to keep the image small. |
| build | /bɪld/ | dựng (image) | The build failed because a layer couldn't be cached. |
| tag | /tæɡ/ | nhãn phiên bản | Never deploy the `latest` tag to production — pin a specific version. |
| registry | /ˈredʒɪstri/ | kho chứa image | We push images to a private registry after CI passes. |
| multi-stage build | /ˌmʌlti steɪdʒ ˈbɪld/ | build nhiều giai đoạn | A multi-stage build keeps dev dependencies out of the final image. |
| volume | /ˈvɒljuːm/ | ổ dữ liệu gắn ngoài | Use a volume to persist database data outside the container. |
| mount | /maʊnt/ | gắn (thư mục/ổ) | In development, we mount the source code into the container for hot reload. |
| expose | /ɪkˈspoʊz/ | mở (cổng) | The Dockerfile exposes port 3000, but you still need to publish it. |
| port mapping | /ˈpɔːt ˌmæpɪŋ/ | ánh xạ cổng | The port mapping `-p 8080:3000` maps host port 8080 to container port 3000. |
| isolation | /ˌaɪsəˈleɪʃn/ | sự cô lập | Containers provide process and filesystem isolation. |
| lightweight | /ˈlaɪtweɪt/ | nhẹ | Containers are lightweight because they don't include a full OS. |
| ephemeral | /ɪˈfemərəl/ | phù du, tồn tại ngắn | Containers are ephemeral — never store state inside them. |
| reproducible | /ˌriːprəˈdjuːsəbl/ | tái lập được | Docker makes builds reproducible across every developer's machine. |
| entrypoint | /ˈentripɔɪnt/ | lệnh khởi chạy | The entrypoint script runs migrations before starting the server. |
| environment variable | /ɪnˈvaɪrənmənt ˌveəriəbl/ | biến môi trường | Configuration is injected through environment variables, not baked into the image. |
| daemon ⚠️ | /ˈdiːmən/ | tiến trình nền | The Docker daemon manages all containers on the host. — ⚠️ đọc /ĐI-mừn/ như "demon", KHÔNG đọc "đa-ê-mon" |
| orchestrate | /ˈɔːkɪstreɪt/ | điều phối | Docker Compose orchestrates multiple containers for local development. |
| healthcheck | /ˈhelθtʃek/ | kiểm tra sức khỏe | The healthcheck pings `/health` every ten seconds to verify the container is alive. |
| "it works on my machine" | — | "máy em chạy bình thường mà" | Docker exists to kill the phrase "it works on my machine". |
| shrink / slim down | /ʃrɪŋk/ | thu gọn | We slimmed the image down from 1.2 GB to 180 MB with a multi-stage build. |

**Luyện nói cuối tuần:**

1. *We use a multi-stage build with an Alpine base image, which slimmed the final image down to under 200 megabytes.*
   → Chúng tôi dùng multi-stage build với ảnh nền Alpine, thu gọn image cuối xuống dưới 200 MB.
2. *Containers are ephemeral, so all state lives in volumes or external services, and config comes in through environment variables.*
   → Container là phù du, nên mọi state nằm ở volume hoặc service bên ngoài, còn config được truyền qua biến môi trường.
3. *Docker makes the build reproducible — the same image runs identically on my machine, in CI, and in production.*
   → Docker giúp build tái lập được — cùng một image chạy y hệt trên máy tôi, trên CI và trên production.

---

## Week 8 — Kubernetes

| Từ/cụm | IPA | Nghĩa | Câu ví dụ thật từ docs/phỏng vấn |
|--------|-----|-------|----------------------------------|
| pod | /pɒd/ | đơn vị chạy nhỏ nhất | A pod can contain multiple containers that share a network namespace. |
| node | /noʊd/ | máy chạy pod | The scheduler decides which node each pod runs on. |
| deployment | /dɪˈplɔɪmənt/ | bản triển khai | The Deployment ensures three replicas of the API are always running. |
| replica | /ˈreplɪkə/ | bản sao | We scaled from three to ten replicas during the sale event. |
| manifest | /ˈmænɪfest/ | file khai báo | All our manifests are stored in Git and applied by ArgoCD. |
| declarative | /dɪˈklærətɪv/ | khai báo (mô tả trạng thái mong muốn) | Kubernetes is declarative: you describe the desired state, and it makes it happen. |
| reconcile | /ˈrekənsaɪl/ | đối soát (kéo trạng thái thật về trạng thái mong muốn) | The controller continuously reconciles the actual state with the desired state. |
| rollout | /ˈroʊlaʊt/ | triển khai dần | The rollout replaces pods gradually so there's no downtime. |
| rollback | /ˈroʊlbæk/ | quay về bản trước | We rolled back to the previous revision within a minute of seeing errors. |
| rolling update | /ˌroʊlɪŋ ˈʌpdeɪt/ | cập nhật cuốn chiếu | A rolling update keeps old pods serving traffic until new ones are ready. |
| drain | /dreɪn/ | rút hết pod khỏi node | Drain the node before maintenance so pods are rescheduled elsewhere. |
| evict | /ɪˈvɪkt/ | trục xuất (pod) | Under memory pressure, the kubelet evicts low-priority pods first. |
| taint | /teɪnt/ | đánh dấu hạn chế (trên node) | We taint the GPU nodes so regular workloads don't get scheduled there. |
| toleration | /ˌtɒləˈreɪʃn/ | sự dung sai (cho pod vào node bị taint) | Only pods with a matching toleration can run on a tainted node. |
| liveness probe | /ˈlaɪvnəs proʊb/ | kiểm tra còn sống | If the liveness probe fails, Kubernetes restarts the container. |
| readiness probe | /ˈredinəs proʊb/ | kiểm tra sẵn sàng | A failing readiness probe removes the pod from the load balancer, but doesn't restart it. |
| autoscaling | /ˈɔːtoʊˌskeɪlɪŋ/ | tự co giãn | Horizontal pod autoscaling adds replicas when CPU crosses 70%. |
| ingress | /ˈɪnɡres/ | cổng vào (định tuyến HTTP) | The ingress routes `/api` traffic to the backend service. |
| service discovery | /ˈsɜːvɪs dɪˌskʌvəri/ | khám phá dịch vụ | Service discovery lets pods find each other by DNS name instead of IP. |
| self-healing | /ˌself ˈhiːlɪŋ/ | tự hồi phục | Kubernetes is self-healing: crashed pods are restarted automatically. |
| resource limit | /ˈriːsɔːs ˌlɪmɪt/ | giới hạn tài nguyên | Without resource limits, one pod can starve everything else on the node. |
| OOMKilled | /ˌoʊ oʊ ˈem kɪld/ | bị giết vì hết RAM | The pod was OOMKilled because it exceeded its memory limit. |
| namespace | /ˈneɪmspeɪs/ | không gian tên | Each team gets its own namespace with resource quotas. |
| scheduler ⚠️ | /ˈʃedjuːlə(r)/ (Anh) /ˈskedʒuːlər/ (Mỹ) | bộ lập lịch | The scheduler places pods based on resource requests and affinity rules. — ⚠️ Mỹ đọc /SKE-jù-lờr/, KHÔNG đọc "sờ-che-du-lê" |

**Luyện nói cuối tuần:**

1. *Kubernetes is declarative and self-healing: the controller reconciles the actual state with the desired state in the manifest.*
   → Kubernetes là khai báo và tự hồi phục: controller liên tục đối soát trạng thái thật với trạng thái mong muốn trong manifest.
2. *During a rolling update, the readiness probe keeps traffic away from new pods until they're actually ready.*
   → Trong rolling update, readiness probe giữ traffic tránh xa các pod mới cho đến khi chúng thật sự sẵn sàng.
3. *Before node maintenance, we drain the node so pods get evicted gracefully and rescheduled elsewhere.*
   → Trước khi bảo trì node, chúng tôi drain node để pod được trục xuất êm và lập lịch lại sang chỗ khác.

---

## Week 9 — AWS

| Từ/cụm | IPA | Nghĩa | Câu ví dụ thật từ docs/phỏng vấn |
|--------|-----|-------|----------------------------------|
| provision | /prəˈvɪʒn/ | cấp phát (tài nguyên) | We provision all infrastructure with Terraform — nothing is created by hand. |
| instance | /ˈɪnstəns/ | máy ảo / thực thể | The auto scaling group launches a new instance when CPU stays above 70%. |
| region | /ˈriːdʒən/ | vùng địa lý | We deploy to the Singapore region to reduce latency for Vietnamese users. |
| availability zone (AZ) | /əˌveɪləˈbɪləti zoʊn/ | vùng khả dụng | Spreading instances across availability zones protects against a data center failure. |
| high availability | /ˌhaɪ əˌveɪləˈbɪləti/ | tính sẵn sàng cao | For high availability, the database runs in multi-AZ mode with automatic failover. |
| fault tolerance | /ˈfɔːlt ˌtɒlərəns/ | chịu lỗi | Fault tolerance means the system keeps working even when components fail. |
| load balancer | /ˈloʊd ˌbælənsə(r)/ | bộ cân bằng tải | The load balancer distributes traffic across healthy instances only. |
| auto scaling | /ˌɔːtoʊ ˈskeɪlɪŋ/ | tự co giãn | Auto scaling adds capacity during peak hours and removes it at night. |
| serverless | /ˈsɜːvələs/ | không quản lý server | With serverless, you pay only for the compute time you actually use. |
| cold start | /ˌkoʊld ˈstɑːt/ | khởi động nguội | Lambda cold starts add a few hundred milliseconds to the first request. |
| throttle | /ˈθrɒtl/ | bóp tần suất | API Gateway throttles requests that exceed your configured rate. |
| quota | /ˈkwoʊtə/ | hạn ngạch | We hit the Lambda concurrency quota and had to request an increase. |
| bucket | /ˈbʌkɪt/ | thùng chứa (S3) | Static assets are served from an S3 bucket behind CloudFront. |
| durability | /ˌdjʊərəˈbɪləti/ | độ bền dữ liệu | S3 is designed for eleven nines of durability. |
| managed service | /ˌmænɪdʒd ˈsɜːvɪs/ | dịch vụ được quản lý hộ | We chose a managed service so we don't have to patch and back up the database ourselves. |
| IAM role | /ˌaɪ eɪ ˈem roʊl/ | vai trò phân quyền | The Lambda assumes an IAM role that grants read-only access to the bucket. |
| least privilege | /ˌliːst ˈprɪvəlɪdʒ/ | đặc quyền tối thiểu | Follow the principle of least privilege: grant only the permissions each service needs. |
| VPC | /ˌviː piː ˈsiː/ | mạng riêng ảo | The database sits in a private subnet inside the VPC. |
| subnet | /ˈsʌbnet/ | mạng con | Public subnets host the load balancer; private subnets host the app servers. |
| egress / ingress | /ˈiːɡres/ /ˈɪnɡres/ | lưu lượng ra / vào | Data egress to the internet is what really drives the bill up. |
| pay-as-you-go | /ˌpeɪ əz ju ˈɡoʊ/ | trả theo dùng | The pay-as-you-go model means no upfront cost, but watch your usage. |
| spot instance | /ˈspɒt ˌɪnstəns/ | máy giá rẻ (có thể bị thu hồi) | Batch jobs run on spot instances to cut compute costs by 70%. |
| billing | /ˈbɪlɪŋ/ | hóa đơn, tính phí | Set up billing alerts before you provision anything. |
| vendor lock-in | /ˌvendə ˈlɒk ɪn/ | bị trói vào nhà cung cấp | Using too many proprietary services creates vendor lock-in. |

**Luyện nói cuối tuần:**

1. *For high availability, we run instances across two availability zones behind a load balancer, with auto scaling on CPU.*
   → Để sẵn sàng cao, chúng tôi chạy instance trên hai AZ sau load balancer, với auto scaling theo CPU.
2. *We went serverless for this workload: no servers to provision, pay-as-you-go pricing, but we had to accept cold starts.*
   → Chúng tôi chọn serverless cho workload này: không phải cấp phát server, trả theo dùng, nhưng phải chấp nhận cold start.
3. *Each service assumes an IAM role with least privilege — it can only read the one bucket it needs.*
   → Mỗi service nhận một IAM role với đặc quyền tối thiểu — chỉ đọc được đúng cái bucket nó cần.

---

## Week 10 — System Design

| Từ/cụm | IPA | Nghĩa | Câu ví dụ thật từ docs/phỏng vấn |
|--------|-----|-------|----------------------------------|
| trade-off | /ˈtreɪd ɒf/ | sự đánh đổi | Every design decision is a trade-off; my job is to pick the right one for the requirements. |
| "It depends on..." | — | "Còn tùy vào..." | It depends on the read/write ratio — if reads dominate, I'd add a cache first. |
| bottleneck | /ˈbɒtlnek/ | nút thắt cổ chai | At this scale, the database becomes the bottleneck, so let's talk about sharding. |
| single point of failure | /ˌsɪŋɡl pɔɪnt əv ˈfeɪljə(r)/ | điểm lỗi duy nhất | The message broker is a single point of failure, so we run it as a cluster. |
| scalability | /ˌskeɪləˈbɪləti/ | khả năng mở rộng | Let's check the scalability of this design at ten times the current traffic. |
| scale out / scale up | /skeɪl aʊt/ /skeɪl ʌp/ | mở rộng ngang / dọc | We scale out the stateless API servers and scale up the database. |
| stateless / stateful | /ˈsteɪtləs/ /ˈsteɪtfl/ | không/có lưu trạng thái | Keep the API servers stateless so any instance can handle any request. |
| latency vs. throughput | /ˈleɪtənsi/ /ˈθruːpʊt/ | độ trễ vs thông lượng | Batching improves throughput but increases latency — a classic trade-off. |
| availability | /əˌveɪləˈbɪləti/ | tính sẵn sàng | Five nines of availability allows about five minutes of downtime per year. |
| consistency | /kənˈsɪstənsi/ | tính nhất quán | For the payment flow we need strong consistency; for the feed, eventual is fine. |
| redundancy | /rɪˈdʌndənsi/ | sự dư thừa (dự phòng) | Redundancy at every layer removes single points of failure. |
| replication | /ˌreplɪˈkeɪʃn/ | nhân bản | Replication improves read throughput and availability, at the cost of consistency. |
| mitigate | /ˈmɪtɪɡeɪt/ | giảm thiểu | We can mitigate the thundering herd problem with request coalescing. |
| degrade gracefully | /dɪˌɡreɪd ˈɡreɪsfəli/ | xuống cấp êm | When the recommendation service is down, the page degrades gracefully to a static list. |
| back-of-the-envelope | /ˌbæk əv ði ˈenvəloʊp/ | ước lượng nhanh | Let me do a back-of-the-envelope calculation: a million users, ten requests each per day... |
| rate limiting | /ˈreɪt ˌlɪmɪtɪŋ/ | giới hạn tần suất | Rate limiting protects the API from abuse and from accidental retry storms. |
| circuit breaker | /ˈsɜːkɪt ˌbreɪkə(r)/ | cầu dao (ngắt gọi service lỗi) | The circuit breaker opens after five consecutive failures and stops calling the dead service. |
| load shedding | /ˈloʊd ˌʃedɪŋ/ | xả tải | Under extreme load, we shed low-priority traffic to keep the core flow alive. |
| fan-out | /ˈfæn aʊt/ | tỏa ra | A celebrity post fans out to millions of followers' feeds — that's the hard part. |
| hot spot | /ˈhɒt spɒt/ | điểm nóng | A poor partition key creates hot spots on a few servers. |
| capacity planning | /kəˈpæsəti ˌplænɪŋ/ | hoạch định công suất | Capacity planning starts with estimating peak QPS and storage growth. |
| denormalize | /diːˈnɔːməlaɪz/ | phi chuẩn hóa | At read-heavy scale, we denormalize and precompute the feed. |
| asynchronous processing | /eɪˈsɪŋkrənəs ˈproʊsesɪŋ/ | xử lý bất đồng bộ | Anything that doesn't need an immediate response goes to a queue for asynchronous processing. |
| idempotency key ⚠️ | /ˌaɪdemˈpoʊtnsi kiː/ | khóa chống trùng | The payment API requires an idempotency key so retries don't double-charge. — ⚠️ /ai-đem-PÔ-từn-si/ |
| SLA / SLO | /ˌes el ˈeɪ/ /ˌes el ˈoʊ/ | cam kết / mục tiêu chất lượng dịch vụ | Our SLO is 99.9% of requests under 200 milliseconds. |

**Luyện nói cuối tuần:**

1. *It depends on the requirements: if we need five nines of availability, we add redundancy at every layer and remove every single point of failure.*
   → Còn tùy yêu cầu: nếu cần độ sẵn sàng 99.999%, ta thêm dự phòng ở mọi tầng và loại bỏ mọi điểm lỗi duy nhất.
2. *Let me do a back-of-the-envelope calculation to find the bottleneck before we talk about scaling out.*
   → Để tôi ước lượng nhanh để tìm nút thắt trước khi bàn chuyện scale ngang.
3. *We mitigate cascading failures with circuit breakers, rate limiting, and degrading gracefully when a dependency is down.*
   → Chúng tôi giảm thiểu lỗi dây chuyền bằng circuit breaker, rate limiting, và xuống cấp êm khi một dependency sập.

---

## Week 11-12 — Interview English

| Từ/cụm | IPA | Nghĩa | Câu ví dụ thật từ docs/phỏng vấn |
|--------|-----|-------|----------------------------------|
| walk (someone) through | /wɔːk θruː/ | trình bày từng bước | Let me walk you through how the request flows through the system. |
| elaborate (on) | /ɪˈlæbəreɪt/ | nói chi tiết hơn | Could you elaborate on what you mean by "high traffic"? |
| clarify | /ˈklærəfaɪ/ | làm rõ | Before I start, I'd like to clarify a few requirements. |
| assumption | /əˈsʌmpʃn/ | giả định | I'll make an assumption that reads outnumber writes ten to one — is that fair? |
| constraint | /kənˈstreɪnt/ | ràng buộc | Given the time constraint, I'll focus on the core flow first. |
| edge case | /ˈedʒ keɪs/ | trường hợp biên | What happens in the edge case where the user submits twice? |
| corner case | /ˈkɔːnə keɪs/ | trường hợp hiếm | We hit a corner case where the token expired exactly during the retry. |
| backward compatible | /ˌbækwəd kəmˈpætəbl/ | tương thích ngược | We versioned the API so the change is backward compatible with old clients. |
| legacy code | /ˈleɡəsi koʊd/ | code cũ kế thừa | Half my job was migrating legacy code to the new service without downtime. |
| refactor | /ˌriːˈfæktə(r)/ | tái cấu trúc code | I refactored the module first so the new feature wouldn't add more tech debt. |
| tech(nical) debt | /ˈtek det/ | nợ kỹ thuật | We allocated 20% of each sprint to paying down technical debt. — ⚠️ "debt" đọc /đét/, chữ "b" CÂM |
| take ownership | /teɪk ˈoʊnəʃɪp/ | nhận trách nhiệm chủ động | I took ownership of the incident, wrote the postmortem, and fixed the root cause. |
| root cause | /ˈruːt kɔːz/ | nguyên nhân gốc | The root cause was a missing index, not the cache as we first thought. |
| postmortem | /ˌpoʊstˈmɔːtəm/ | báo cáo sau sự cố | We run a blameless postmortem after every production incident. |
| "Let me think out loud" | — | "Để tôi vừa nghĩ vừa nói" | Let me think out loud here — there are two approaches I'd consider. |
| "Off the top of my head" | — | "Theo trí nhớ ngay lúc này" | Off the top of my head, I'd say around 100 milliseconds, but I'd want to measure it. |
| "Correct me if I'm wrong" | — | "Nếu tôi sai xin chỉnh giúp" | Correct me if I'm wrong, but you want this to work offline as well? |
| "To be honest" | — | "Thành thật mà nói" | To be honest, I haven't used Kafka Streams in production, but I understand the concepts. |
| "That's a good question" | — | câu giờ lịch sự | That's a good question — let me take a second to structure my answer. |
| prioritize ⚠️ | /praɪˈɒrətaɪz/ | ưu tiên | I prioritize tasks by impact and urgency. — ⚠️ đọc /prai-O-rờ-tai/, KHÔNG đọc "pri-ô-ri-tai" |
| collaborate | /kəˈlæbəreɪt/ | hợp tác | I collaborated closely with the frontend team to define the API contract. |
| stakeholder | /ˈsteɪkhoʊldə(r)/ | bên liên quan | I kept stakeholders updated when the deadline was at risk. |
| notice period | /ˈnoʊtɪs ˌpɪəriəd/ | thời gian báo trước nghỉ | My notice period is 30 days, so I could start in early August. |
| salary expectation | /ˈsæləri ˌekspekˈteɪʃn/ | mức lương kỳ vọng | My salary expectation is in the range of X, depending on the total package. |
| follow up | /ˌfɒloʊ ˈʌp/ | liên hệ tiếp sau | Thank you for your time — I'll follow up by email with the document I mentioned. |
| strength / weakness | /streŋθ/ /ˈwiːknəs/ | điểm mạnh / yếu | My main strength is debugging under pressure; my weakness is that I used to under-communicate, which I now fix with daily written updates. |
| suite ⚠️ | /swiːt/ | bộ (test suite) | The whole test suite runs in under three minutes. — ⚠️ đọc /SUYT/ giống "sweet", KHÔNG đọc "su-ít" hay "siu" |
| deteriorate ⚠️ | /dɪˈtɪəriəreɪt/ | xuống cấp dần | Performance deteriorated as the table grew past 100 million rows. — ⚠️ đọc /đi-TI-ơ-ri-ơ-rêit/, 5 âm tiết |

**Luyện nói cuối tuần:**

1. *Let me walk you through the architecture, and correct me if I'm wrong about any of the constraints.*
   → Để tôi trình bày kiến trúc từng bước, và nếu tôi hiểu sai ràng buộc nào xin chỉnh giúp.
2. *To be honest, I missed an edge case in that release; I took ownership, found the root cause, and added it to the test suite.*
   → Thành thật mà nói, tôi đã bỏ sót một edge case trong release đó; tôi nhận trách nhiệm, tìm nguyên nhân gốc và thêm nó vào bộ test.
3. *That's a good question — let me think out loud: we could refactor the legacy code now, or ship first and accept some technical debt.*
   → Câu hỏi hay — để tôi vừa nghĩ vừa nói: ta có thể refactor code cũ ngay, hoặc ship trước và chấp nhận một ít nợ kỹ thuật.

---

## Hướng dẫn import vào Anki

### Bước 1 — Tạo file import (tab-separated)

Tạo file `week-XX.txt` (UTF-8), mỗi dòng 1 thẻ, các cột cách nhau bằng **phím Tab** theo format:

```text
Front<TAB>Back<TAB>Tags
```

Trong đó:
- **Front**: từ/cụm từ + IPA
- **Back**: nghĩa tiếng Việt + câu ví dụ (+ lưu ý phát âm nếu có ⚠️)
- **Tags**: `english week01 nodejs` (để lọc theo tuần)

Ví dụ 3 dòng (ký tự `→` bên dưới tượng trưng cho 1 phím Tab):

```text
queue /kjuː/ → hàng đợi. Ví dụ: Callbacks are pushed onto the task queue. ⚠️ Đọc /KIU/, một âm tiết. → english week01 nodejs
cache /kæʃ/ → bộ nhớ đệm. Ví dụ: We cache the user profile in Redis. ⚠️ Đọc như "cash", KHÔNG đọc "cát-chê". → english week05 redis
trade-off /ˈtreɪd ɒf/ → sự đánh đổi. Ví dụ: Every design decision is a trade-off. → english week10 systemdesign
```

Mẹo: copy bảng markdown của tuần trong file này, paste vào ChatGPT/Claude và yêu cầu "convert this markdown table to Anki tab-separated format with columns Front, Back, Tags" — đỡ gõ tay.

### Bước 2 — Import vào Anki

1. Mở Anki → **File → Import** (Ctrl/Cmd + Shift + I), chọn file `.txt`.
2. **Field separator**: chọn **Tab**.
3. **Note type**: Basic (hoặc **Basic (and reversed card)** nếu muốn ôn cả 2 chiều Anh→Việt và Việt→Anh — khuyên dùng từ tuần 5 trở đi).
4. **Deck**: tạo deck `English::Backend-Interview`.
5. Tick **Allow HTML in fields** nếu bạn có dùng thẻ in đậm.
6. Map cột: Field 1 → Front, Field 2 → Back, Field 3 → Tags. Bấm **Import**.

### Bước 3 — Quy tắc ôn spaced repetition

1. **Nạp đều, đừng dồn**: 5-10 thẻ mới/ngày (cài trong Deck Options → New cards/day = 10). Một tuần ~25 từ là vừa khớp.
2. **Ôn hết thẻ đến hạn MỖI NGÀY** — đây là luật quan trọng nhất. Bỏ 3 ngày là nợ thẻ dồn lên gấp 3, dễ bỏ cuộc. Mỗi ngày chỉ ~10 phút nếu đều đặn.
3. **Đọc to khi ôn**: nhìn Front → nói to từ + nghĩa + đọc to câu ví dụ → mới lật thẻ. Đặc biệt với từ có ⚠️, đọc to 3 lần.
4. **Chấm trung thực**: nhớ ngay → `Good`; ngắc ngứ nhưng nhớ → `Hard`; quên → `Again`. Đừng tự lừa mình bấm `Easy` cho nhanh.
5. **Khoảng cách Anki mặc định đã tốt**: thẻ trả lời đúng sẽ quay lại sau 1 ngày → 3 ngày → 1 tuần → 2 tuần → 1 tháng... Đừng chỉnh trừ khi đã dùng quen.
6. **Thẻ "leech" (quên đi quên lại ≥ 8 lần)**: đừng cố nhồi — viết tay từ đó vào 3 câu của riêng bạn về project thật của bạn, từ sẽ tự dính.
7. **Cuối mỗi tuần**: lọc theo tag (`tag:week05`) → Custom Study → ôn lại cả tuần 1 lượt trước khi làm mini-test trong [README](./README.md#5-đo-tiến-bộ-mỗi-tuần-mini-test-cuối-tuần-30-phút).
