/**
 * Ngân hàng "🏗️ Phân tán" — hệ thống phân tán & message queue cho phỏng vấn Java backend (senior).
 * Message queue (Kafka), delivery semantics, CAP, distributed transaction, distributed ID, idempotency.
 *
 * Mỗi câu: { id, topic, q, options:[...], answer:idx, explain }
 */
window.DIST_QUIZ = [
  {
    id: 'dist-mq-why', topic: 'Message Queue',
    q: 'Ba lợi ích cốt lõi của message queue (Kafka/RabbitMQ) là gì?',
    options: [
      'Chỉ để lưu trữ dữ liệu',
      'Giải耦 (decouple: bên gửi & nhận không phụ thuộc trực tiếp), 削峰 (buffer lúc tải đỉnh), 异步 (xử lý bất đồng bộ → phản hồi nhanh)',
      'Tăng tốc CPU',
      'Thay thế database',
    ], answer: 1,
    explain: 'MQ giúp: (1) DECOUPLE — producer chỉ đẩy message, không cần biết consumer là ai/còn sống không; (2) PEAK SHAVING (削峰) — hàng đợi hấp thụ đỉnh tải, consumer xử lý theo nhịp của mình, bảo vệ hệ sau; (3) ASYNC — tác vụ chậm (gửi mail, xử lý ảnh) đẩy vào queue, API trả về ngay. Đánh đổi: thêm độ phức tạp, độ trễ, và phải xử lý message trùng/mất/thứ tự.',
  },
  {
    id: 'dist-kafka-part', topic: 'Kafka',
    q: 'Partition và consumer group trong Kafka để làm gì?',
    options: [
      'Không liên quan gì đến nhau',
      'Partition chia topic thành nhiều phần để xử lý SONG SONG & mở rộng; trong một consumer group, mỗi partition chỉ do MỘT consumer đọc → số consumer hữu ích tối đa = số partition',
      'Consumer group làm chậm hệ thống',
      'Mỗi partition do mọi consumer đọc cùng lúc',
    ], answer: 1,
    explain: 'Topic chia thành N partition → cho phép ghi/đọc song song, mở rộng thông lượng. Consumer group: các consumer chia nhau partition, MỖI partition chỉ gán cho MỘT consumer trong group (đảm bảo không xử lý trùng trong group). Vì vậy thêm consumer quá số partition thì consumer dư sẽ rảnh. Nhiều group khác nhau đọc cùng topic độc lập (pub-sub).',
  },
  {
    id: 'dist-kafka-order', topic: 'Kafka',
    q: 'Kafka đảm bảo thứ tự message ở phạm vi nào?',
    options: [
      'Toàn bộ topic',
      'Chỉ TRONG MỘT partition (thứ tự theo offset). Toàn topic KHÔNG đảm bảo thứ tự → muốn giữ thứ tự theo entity thì dùng message key để cùng entity vào cùng partition',
      'Không đảm bảo thứ tự ở đâu cả',
      'Theo thời gian gửi tuyệt đối',
    ], answer: 1,
    explain: 'Kafka chỉ đảm bảo thứ tự TRONG một partition (đọc tuần tự theo offset). Giữa các partition thì song song, không có thứ tự tổng. Muốn các message của cùng một thực thể (vd cùng orderId) giữ đúng thứ tự → đặt message KEY = orderId để Kafka băm vào cùng partition. Bài học: cần thứ tự toàn cục thì dùng 1 partition (mất song song) hoặc thiết kế lại.',
  },
  {
    id: 'dist-delivery', topic: 'Delivery semantics',
    q: 'At-least-once, at-most-once, exactly-once khác nhau thế nào?',
    options: [
      'Giống nhau',
      'At-most-once: có thể MẤT, không trùng. At-least-once: không mất nhưng có thể TRÙNG (phổ biến nhất). Exactly-once: đúng một lần (khó/đắt) — thực tế thường dùng at-least-once + consumer IDEMPOTENT',
      'Exactly-once là mặc định của mọi MQ',
      'At-least-once làm mất message',
    ], answer: 1,
    explain: 'At-most-once: gửi rồi thôi, mất thì chịu (log không quan trọng). At-least-once: retry tới khi ack → không mất nhưng có thể xử lý TRÙNG (mặc định thực tế của Kafka/RabbitMQ). Exactly-once: đảm bảo đúng một lần — tốn kém, cần transaction/idempotent producer + consumer. GIẢI PHÁP THỰC TẾ: chấp nhận at-least-once và làm CONSUMER IDEMPOTENT (xử lý trùng không gây tác dụng phụ).',
  },
  {
    id: 'dist-idempotent', topic: 'Idempotency',
    q: 'Làm sao để consumer xử lý message TRÙNG mà không gây hậu quả (idempotent)?',
    options: [
      'Không thể tránh được',
      'Dùng khoá idempotency: lưu id message/nghiệp vụ đã xử lý (DB unique / Redis SET NX); trước khi xử lý kiểm tra đã làm chưa → làm rồi thì bỏ qua. Hoặc thao tác vốn idempotent (UPSERT, set trạng thái)',
      'Xử lý message càng nhanh càng tốt',
      'Tăng số consumer',
    ], answer: 1,
    explain: 'Idempotent consumer: (1) mỗi message có id duy nhất; lưu bảng "đã xử lý" với UNIQUE constraint hoặc Redis SETNX → gặp lại thì bỏ qua; (2) thiết kế thao tác vốn idempotent: UPSERT thay INSERT, "set trạng thái = PAID" (làm lại vẫn PAID) thay "cộng tiền". Đây là cách chuẩn để sống chung với at-least-once mà không cần exactly-once đắt đỏ.',
  },
  {
    id: 'dist-backlog', topic: 'Message backlog',
    q: 'Message tồn đọng (consumer lag lớn) — xử lý thế nào?',
    options: [
      'Xoá hết message',
      'Tăng số consumer (tới ≤ số partition) & tối ưu xử lý; nếu vẫn nghẽn → tạm ghi message ra nơi khác rồi xử lý sau, hoặc tăng partition; điều tra nguyên nhân consumer chậm (DB, lỗi retry)',
      'Không làm gì, tự hết',
      'Giảm số partition',
    ], answer: 1,
    explain: 'Backlog = producer nhanh hơn consumer. Xử lý: (1) tăng consumer trong group (nhưng chỉ hữu ích tới SỐ PARTITION → có khi phải tăng partition); (2) tối ưu logic consumer (batch, bỏ N+1, async I/O); (3) tình huống khẩn: consume nhanh rồi đẩy sang hàng đợi/bảng tạm xử lý sau. Luôn theo dõi consumer lag như một metric cảnh báo.',
  },
  {
    id: 'dist-cap', topic: 'CAP',
    q: 'Định lý CAP nói gì?',
    options: [
      'Hệ phân tán đạt được cả 3: Consistency, Availability, Partition tolerance',
      'Khi có phân vùng mạng (Partition), phải CHỌN giữa Consistency (nhất quán) và Availability (sẵn sàng) — không thể cả hai. Vì mạng luôn có thể phân vùng nên thực tế là chọn CP hoặc AP',
      'Chỉ áp dụng cho database SQL',
      'C, A, P không liên quan nhau',
    ], answer: 1,
    explain: 'CAP: một hệ phân tán KHÔNG thể đồng thời đảm bảo cả Consistency (mọi node thấy dữ liệu mới nhất), Availability (mọi request được trả lời), và Partition tolerance (chịu được mất kết nối giữa các node). Vì partition là điều không tránh khỏi (P bắt buộc), khi partition xảy ra phải chọn: CP (từ chối trả lời để giữ nhất quán — vd ZooKeeper) hay AP (vẫn trả lời, chấp nhận dữ liệu cũ — vd Eureka, Cassandra). BASE (eventual consistency) là hướng AP.',
  },
  {
    id: 'dist-txn', topic: 'Distributed transaction',
    q: 'Các giải pháp transaction phân tán phổ biến?',
    options: [
      'Chỉ có 2PC',
      '2PC (mạnh nhưng chặn & điểm chết prepare), TCC (Try-Confirm-Cancel, bù trừ ở tầng ứng dụng), Saga (chuỗi giao dịch cục bộ + bù trừ khi lỗi), Local message table / Outbox (đảm bảo cuối cùng qua MQ)',
      'Distributed transaction là bất khả thi',
      'Chỉ dùng transaction database thường là đủ',
    ], answer: 1,
    explain: 'Khi nghiệp vụ trải nhiều service/DB: (1) 2PC/XA — nhất quán mạnh nhưng khoá tài nguyên lâu, coordinator là điểm chết; (2) TCC — mỗi bước có Try (giữ chỗ)/Confirm/Cancel, ứng dụng tự bù; (3) Saga — chuỗi transaction cục bộ, lỗi thì chạy các bước bù (compensating) ngược lại; (4) Local message table / Outbox pattern — ghi message vào DB cùng transaction nghiệp vụ rồi đẩy MQ → nhất quán CUỐI CÙNG. Thực tế microservice ưu tiên eventual consistency (Saga/Outbox) hơn 2PC.',
  },
  {
    id: 'dist-id', topic: 'Distributed ID',
    q: 'Sinh ID duy nhất toàn cục trong hệ phân tán — Snowflake hoạt động thế nào?',
    options: [
      'Dùng AUTO_INCREMENT của 1 DB',
      'Snowflake ghép 64-bit: timestamp + machine/worker id + sequence trong cùng ms → ID duy nhất, TĂNG DẦN theo thời gian (tốt cho index B+Tree), không cần điều phối tập trung',
      'Dùng UUID vì luôn tốt nhất',
      'Random số cho tới khi không trùng',
    ], answer: 1,
    explain: 'Snowflake (Twitter): 1 bit dấu + 41 bit timestamp + 10 bit machine id + 12 bit sequence = 64-bit long. Ưu: duy nhất toàn cục, tăng dần theo thời gian (thân thiện clustered index, tránh page split như UUID ngẫu nhiên), sinh cục bộ không cần chốt tập trung → nhanh. Nhược: phụ thuộc đồng hồ (clock skew/quay ngược gây trùng — cần xử lý). UUID: đơn giản nhưng 128-bit, NGẪU NHIÊN → index kém, tốn chỗ. DB auto-increment: đơn giản nhưng là điểm nghẽn/khó sharding.',
  },
  {
    id: 'dist-consistency', topic: 'Consistency',
    q: 'Strong consistency và eventual consistency khác nhau ra sao?',
    options: [
      'Giống nhau',
      'Strong: đọc luôn thấy giá trị mới nhất ngay sau ghi (đắt, giảm availability). Eventual: sau một khoảng thời gian mọi bản sao sẽ hội tụ về cùng giá trị (nhanh, sẵn sàng cao) — nền của nhiều hệ phân tán quy mô lớn',
      'Eventual consistency làm mất dữ liệu',
      'Strong consistency luôn nhanh hơn',
    ], answer: 1,
    explain: 'Strong consistency: sau khi ghi thành công, mọi lần đọc (ở mọi node) thấy giá trị mới — cần đồng bộ/khoá, giảm availability & tăng độ trễ. Eventual consistency (BASE): chấp nhận các bản sao lệch nhau tạm thời, nhưng "cuối cùng" hội tụ — đổi lấy tính sẵn sàng & khả năng mở rộng cao. Chọn theo nghiệp vụ: số dư ngân hàng cần strong; like/view/feed thì eventual là đủ.',
  },
  {
    id: 'dist-mq-loss', topic: 'Message Queue',
    q: 'Làm sao đảm bảo message KHÔNG BỊ MẤT xuyên suốt (producer → broker → consumer)?',
    options: [
      'Không thể đảm bảo',
      '3 chặng: producer gửi có xác nhận (acks=all) + retry; broker PERSIST message xuống đĩa + nhân bản (replication); consumer xử lý XONG mới commit offset (thủ công), không auto-commit trước khi xử lý',
      'Chỉ cần tăng RAM broker',
      'Gửi message 2 lần cho chắc',
    ], answer: 1,
    explain: 'Mất message có thể ở 3 chặng: (1) PRODUCER → broker: dùng acks=all (chờ mọi replica nhận) + retry, không "gửi rồi quên"; (2) trong BROKER: bật persistence + replication (Kafka replication factor ≥ 2) để không mất khi 1 node chết; (3) BROKER → consumer: commit offset THỦ CÔNG sau khi xử lý xong (nếu auto-commit trước khi xử lý mà crash → mất). Đánh đổi: đảm bảo không mất thường kéo theo khả năng trùng → cần consumer idempotent.',
  },
  {
    id: 'dist-mq-pick', topic: 'Message Queue',
    q: 'Kafka và RabbitMQ — chọn cái nào cho tình huống nào?',
    options: [
      'Luôn dùng Kafka',
      'Kafka: thông lượng CỰC CAO, lưu log/stream, giữ message theo thời gian, replay được — hợp big data/event streaming. RabbitMQ: định tuyến linh hoạt (exchange/routing), độ trễ thấp, hợp hàng đợi tác vụ/微服务 truyền thống',
      'RabbitMQ nhanh hơn Kafka mọi mặt',
      'Không có khác biệt',
    ], answer: 1,
    explain: 'Kafka: thiết kế cho THÔNG LƯỢNG lớn & lưu trữ log bền (message giữ lại theo retention, consumer replay từ offset bất kỳ) → event streaming, thu thập log, pipeline dữ liệu. RabbitMQ: broker truyền thống với routing mạnh (exchange: direct/topic/fanout), độ trễ thấp, hỗ trợ priority/TTL/dead-letter → hàng đợi tác vụ, giao tiếp microservice cần định tuyến linh hoạt. Chọn theo nhu cầu, không có cái "tốt hơn" tuyệt đối.',
  },
  // ---------- Microservices / Spring Cloud ----------
  {
    id: 'dist-ms-discovery', topic: 'Microservices / Service Discovery',
    q: 'Service discovery (Eureka/Nacos/Consul) giải quyết vấn đề gì?',
    options: [
      'Tăng tốc độ mạng',
      'Service instance lên/xuống & đổi IP liên tục (scale, deploy) → không thể hardcode địa chỉ. Registry để service ĐĂNG KÝ mình + client TRA CỨU danh sách instance đang sống (health check), rồi load balance tới',
      'Lưu trữ dữ liệu người dùng',
      'Mã hoá giao tiếp giữa service',
    ], answer: 1,
    explain: 'Trong microservice, số instance & IP thay đổi liên tục. Service registry (Eureka, Nacos, Consul): mỗi service ĐĂNG KÝ (register) địa chỉ khi khởi động + gửi heartbeat; service gọi thì TRA CỨU (discover) registry để lấy danh sách instance còn sống rồi chọn một để gọi. Nhờ đó không cần cấu hình IP tĩnh, tự thích ứng khi scale/deploy. Registry thường AP (Eureka) để ưu tiên sẵn sàng.',
  },
  {
    id: 'dist-ms-gateway', topic: 'Microservices / API Gateway',
    q: 'API Gateway (Spring Cloud Gateway) trong kiến trúc microservice để làm gì?',
    options: [
      'Chỉ để chuyển tiếp request',
      'MỘT cửa vào duy nhất cho client: định tuyến tới service phía sau + xử lý tập trung các concern chung (xác thực/uỷ quyền, rate limit, CORS, logging, ghép/che service nội bộ) → client không gọi thẳng từng service',
      'Thay thế database',
      'Tăng số instance service',
    ], answer: 1,
    explain: 'API Gateway là điểm vào duy nhất (single entry point): client chỉ gọi gateway, gateway ĐỊNH TUYẾN tới microservice tương ứng và xử lý TẬP TRUNG cross-cutting concern: auth/JWT, rate limit, CORS, logging, tổng hợp response, che giấu topology nội bộ. Tránh mỗi service tự làm lại + client không phải biết địa chỉ từng service. Ví dụ: Spring Cloud Gateway, Nginx, Kong.',
  },
  {
    id: 'dist-ms-circuit', topic: 'Microservices / Resilience',
    q: 'Circuit breaker (Resilience4j/Sentinel/Hystrix) hoạt động thế nào?',
    options: [
      'Ngắt điện máy chủ',
      'Khi service phụ thuộc lỗi/chậm vượt ngưỡng → "mở mạch" (OPEN): fail nhanh + trả fallback thay vì chờ timeout, tránh LAN TRUYỀN lỗi (cascading failure); sau thời gian thử lại (HALF-OPEN) rồi đóng nếu ổn',
      'Tăng số retry vô hạn',
      'Khoá toàn bộ hệ thống',
    ], answer: 1,
    explain: 'Circuit breaker chống CASCADING FAILURE: khi gọi service B liên tục lỗi/timeout vượt ngưỡng → chuyển trạng thái OPEN → các lời gọi tiếp theo FAIL NHANH (trả fallback/default) thay vì chờ timeout kéo thread pool cạn kiệt và sập luôn service A. Sau khoảng nghỉ → HALF-OPEN thử vài request; ổn thì CLOSED (bình thường), lỗi thì OPEN lại. Kết hợp retry + timeout + bulkhead. Ví dụ: Resilience4j (khuyên dùng), Sentinel, Hystrix (đã ngừng phát triển).',
  },
  {
    id: 'dist-ms-config', topic: 'Microservices / Config',
    q: 'Config center (Spring Cloud Config / Nacos Config) để làm gì?',
    options: [
      'Chạy service',
      'Quản lý cấu hình TẬP TRUNG cho nhiều service/môi trường ở một nơi (thường có version qua Git); service nạp config lúc chạy và có thể REFRESH nóng khi đổi mà không cần deploy lại',
      'Cân bằng tải',
      'Lưu session người dùng',
    ], answer: 1,
    explain: 'Hàng chục microservice × nhiều môi trường → config rải rác khó quản. Config center tập trung cấu hình ở một nơi (Spring Cloud Config backed by Git, hoặc Nacos/Apollo): service kéo config lúc khởi động; đổi config có thể đẩy REFRESH nóng (@RefreshScope) mà không cần build/deploy lại. Kết hợp với secret management cho dữ liệu nhạy cảm.',
  },
  {
    id: 'dist-ms-trace', topic: 'Microservices / Observability',
    q: 'Distributed tracing (Sleuth/Zipkin, OpenTelemetry) giải quyết vấn đề gì?',
    options: [
      'Tăng tốc request',
      'Một request đi qua NHIỀU service → khó biết chậm/lỗi ở đâu. Tracing gắn traceId/spanId xuyên suốt các service → dựng lại toàn bộ hành trình request + đo thời gian từng chặng để tìm nút thắt',
      'Lưu log vào database',
      'Mã hoá request',
    ], answer: 1,
    explain: 'Trong microservice, một request người dùng có thể đi qua gateway → service A → B → DB/MQ. Khi chậm/lỗi rất khó lần theo. Distributed tracing gắn một traceId chung + spanId cho từng chặng (propagate qua header), gửi về hệ thu thập (Zipkin/Jaeger) → dựng lại cây gọi + thời gian mỗi span → tìm đúng service/bước gây chậm. Cùng với log tập trung (ELK) và metrics (Prometheus/Grafana) tạo thành 3 trụ observability.',
  },
];
