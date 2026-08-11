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
      'Chủ yếu để lưu trữ dữ liệu lâu dài thay cho một database thường',
      'Decouple bên gửi/nhận, peak shaving lúc tải đỉnh, xử lý bất đồng bộ',
      'Tăng tốc CPU nhờ đẩy việc tính toán sang tiến trình khác xử lý',
      'Thay thế database vì message queue cũng lưu được dữ liệu bền',
    ], answer: 1,
    explain: 'MQ giúp: (1) DECOUPLE — producer chỉ đẩy message, không cần biết consumer là ai/còn sống không; (2) PEAK SHAVING (hấp thụ đỉnh tải) — hàng đợi hấp thụ đỉnh tải, consumer xử lý theo nhịp của mình, bảo vệ hệ sau; (3) ASYNC — tác vụ chậm (gửi mail, xử lý ảnh) đẩy vào queue, API trả về ngay. Đánh đổi: thêm độ phức tạp, độ trễ, và phải xử lý message trùng/mất/thứ tự.',
  },
  {
    id: 'dist-kafka-part', topic: 'Kafka',
    q: 'Partition và consumer group trong Kafka để làm gì?',
    options: [
      'Hai khái niệm không liên quan gì nhau trong kiến trúc Kafka',
      'Partition chia topic để chạy song song; mỗi partition chỉ 1 consumer trong group',
      'Consumer group làm chậm hệ thống vì các consumer phải chờ nhau',
      'Mỗi partition được mọi consumer trong group cùng đọc song song',
    ], answer: 1,
    explain: 'Topic chia thành N partition → cho phép ghi/đọc song song, mở rộng thông lượng. Consumer group: các consumer chia nhau partition, MỖI partition chỉ gán cho MỘT consumer trong group (đảm bảo không xử lý trùng trong group). Vì vậy thêm consumer quá số partition thì consumer dư sẽ rảnh. Nhiều group khác nhau đọc cùng topic độc lập (pub-sub).',
  },
  {
    id: 'dist-kafka-order', topic: 'Kafka',
    q: 'Kafka đảm bảo thứ tự message ở phạm vi nào?',
    options: [
      'Trên toàn bộ topic, bất kể topic có bao nhiêu partition',
      'Chỉ TRONG MỘT partition theo offset; dùng key để cùng entity vào một partition',
      'Không đảm bảo thứ tự ở bất kỳ phạm vi nào, kể cả trong partition',
      'Theo thời gian gửi tuyệt đối nhờ timestamp gắn trong mỗi message',
    ], answer: 1,
    explain: 'Kafka chỉ đảm bảo thứ tự TRONG một partition (đọc tuần tự theo offset). Giữa các partition thì song song, không có thứ tự tổng. Muốn các message của cùng một thực thể (vd cùng orderId) giữ đúng thứ tự → đặt message KEY = orderId để Kafka băm vào cùng partition. Bài học: cần thứ tự toàn cục thì dùng 1 partition (mất song song) hoặc thiết kế lại.',
  },
  {
    id: 'dist-delivery', topic: 'Delivery semantics',
    q: 'At-least-once, at-most-once, exactly-once khác nhau thế nào?',
    options: [
      'Ba khái niệm giống nhau, chỉ khác cách gọi theo từng hệ thống',
      'At-most-once có thể MẤT; at-least-once có thể TRÙNG; exactly-once khó & đắt',
      'Exactly-once là mặc định của mọi message queue hiện đại ngày nay',
      'At-least-once làm mất message khi consumer xử lý chậm hơn producer',
    ], answer: 1,
    explain: 'At-most-once: gửi rồi thôi, mất thì chịu (log không quan trọng). At-least-once: retry tới khi ack → không mất nhưng có thể xử lý TRÙNG (mặc định thực tế của Kafka/RabbitMQ). Exactly-once: đảm bảo đúng một lần — tốn kém, cần transaction/idempotent producer + consumer. GIẢI PHÁP THỰC TẾ: chấp nhận at-least-once và làm CONSUMER IDEMPOTENT (xử lý trùng không gây tác dụng phụ).',
  },
  {
    id: 'dist-idempotent', topic: 'Idempotency',
    q: 'Làm sao để consumer xử lý message TRÙNG mà không gây hậu quả (idempotent)?',
    options: [
      'Không thể tránh được, phải chấp nhận dữ liệu bị ghi trùng lặp',
      'Lưu id đã xử lý (DB unique / Redis SET NX) hoặc dùng thao tác UPSERT',
      'Xử lý message càng nhanh càng tốt để giảm xác suất bị gửi lại',
      'Tăng số consumer để mỗi message chỉ được đúng một consumer nhận',
    ], answer: 1,
    explain: 'Idempotent consumer: (1) mỗi message có id duy nhất; lưu bảng "đã xử lý" với UNIQUE constraint hoặc Redis SETNX → gặp lại thì bỏ qua; (2) thiết kế thao tác vốn idempotent: UPSERT thay INSERT, "set trạng thái = PAID" (làm lại vẫn PAID) thay "cộng tiền". Đây là cách chuẩn để sống chung với at-least-once mà không cần exactly-once đắt đỏ.',
  },
  {
    id: 'dist-backlog', topic: 'Message backlog',
    q: 'Message tồn đọng (consumer lag lớn) — xử lý thế nào?',
    options: [
      'Xoá hết message tồn đọng để consumer bắt đầu lại từ offset mới',
      'Tăng consumer (≤ số partition) & tối ưu xử lý; điều tra vì sao consumer chậm',
      'Không cần làm gì, lag sẽ tự hết khi lưu lượng producer giảm xuống',
      'Giảm số partition để consumer hiện có không bị chia nhỏ tài nguyên',
    ], answer: 1,
    explain: 'Backlog = producer nhanh hơn consumer. Xử lý: (1) tăng consumer trong group (nhưng chỉ hữu ích tới SỐ PARTITION → có khi phải tăng partition); (2) tối ưu logic consumer (batch, bỏ N+1, async I/O); (3) tình huống khẩn: consume nhanh rồi đẩy sang hàng đợi/bảng tạm xử lý sau. Luôn theo dõi consumer lag như một metric cảnh báo.',
  },
  {
    id: 'dist-cap', topic: 'CAP',
    q: 'Định lý CAP nói gì?',
    options: [
      'Hệ phân tán đạt được cả ba: Consistency, Availability, Partition tolerance',
      'Khi mạng bị phân vùng, phải CHỌN giữa Consistency và Availability',
      'Chỉ áp dụng cho database SQL, còn NoSQL thì không bị ràng buộc',
      'Ba yếu tố C, A, P độc lập nhau nên có thể tối ưu riêng từng cái',
    ], answer: 1,
    explain: 'CAP: một hệ phân tán KHÔNG thể đồng thời đảm bảo cả Consistency (mọi node thấy dữ liệu mới nhất), Availability (mọi request được trả lời), và Partition tolerance (chịu được mất kết nối giữa các node). Vì partition là điều không tránh khỏi (P bắt buộc), khi partition xảy ra phải chọn: CP (từ chối trả lời để giữ nhất quán — vd ZooKeeper) hay AP (vẫn trả lời, chấp nhận dữ liệu cũ — vd Eureka, Cassandra). BASE (eventual consistency) là hướng AP.',
  },
  {
    id: 'dist-txn', topic: 'Distributed transaction',
    q: 'Các giải pháp transaction phân tán phổ biến?',
    options: [
      'Chỉ có duy nhất 2PC là giải pháp khả thi cho transaction phân tán',
      '2PC (chặn), TCC (bù trừ), Saga (chuỗi + bù trừ), Outbox/local message table',
      'Transaction phân tán là bất khả thi nên phải gộp về một database',
      'Chỉ cần dùng transaction của database thường là đủ cho mọi tình huống',
    ], answer: 1,
    explain: 'Khi nghiệp vụ trải nhiều service/DB: (1) 2PC/XA — nhất quán mạnh nhưng khoá tài nguyên lâu, coordinator là điểm chết; (2) TCC — mỗi bước có Try (giữ chỗ)/Confirm/Cancel, ứng dụng tự bù; (3) Saga — chuỗi transaction cục bộ, lỗi thì chạy các bước bù (compensating) ngược lại; (4) Local message table / Outbox pattern — ghi message vào DB cùng transaction nghiệp vụ rồi đẩy MQ → nhất quán CUỐI CÙNG. Thực tế microservice ưu tiên eventual consistency (Saga/Outbox) hơn 2PC.',
  },
  {
    id: 'dist-id', topic: 'Distributed ID',
    q: 'Sinh ID duy nhất toàn cục trong hệ phân tán — Snowflake hoạt động thế nào?',
    options: [
      'Dùng AUTO_INCREMENT của một database trung tâm cho mọi service',
      'Snowflake ghép 64-bit: timestamp + worker id + sequence, tăng dần theo thời gian',
      'Dùng UUID v4 vì ngẫu nhiên nên luôn là lựa chọn tốt nhất mọi lúc',
      'Sinh số ngẫu nhiên rồi kiểm tra trong DB cho tới khi không trùng',
    ], answer: 1,
    explain: 'Snowflake (Twitter): 1 bit dấu + 41 bit timestamp + 10 bit machine id + 12 bit sequence = 64-bit long. Ưu: duy nhất toàn cục, tăng dần theo thời gian (thân thiện clustered index, tránh page split như UUID ngẫu nhiên), sinh cục bộ không cần chốt tập trung → nhanh. Nhược: phụ thuộc đồng hồ (clock skew/quay ngược gây trùng — cần xử lý). UUID: đơn giản nhưng 128-bit, NGẪU NHIÊN → index kém, tốn chỗ. DB auto-increment: đơn giản nhưng là điểm nghẽn/khó sharding.',
  },
  {
    id: 'dist-consistency', topic: 'Consistency',
    q: 'Strong consistency và eventual consistency khác nhau ra sao?',
    options: [
      'Hai khái niệm giống nhau, chỉ khác thuật ngữ theo từng tài liệu',
      'Strong: đọc luôn thấy giá trị mới nhất; Eventual: các bản sao hội tụ sau một lúc',
      'Eventual consistency đồng nghĩa với việc dữ liệu có thể mất hẳn',
      'Strong consistency luôn nhanh hơn vì khỏi phải đồng bộ nhiều bản',
    ], answer: 1,
    explain: 'Strong consistency: sau khi ghi thành công, mọi lần đọc (ở mọi node) thấy giá trị mới — cần đồng bộ/khoá, giảm availability & tăng độ trễ. Eventual consistency (BASE): chấp nhận các bản sao lệch nhau tạm thời, nhưng "cuối cùng" hội tụ — đổi lấy tính sẵn sàng & khả năng mở rộng cao. Chọn theo nghiệp vụ: số dư ngân hàng cần strong; like/view/feed thì eventual là đủ.',
  },
  {
    id: 'dist-mq-loss', topic: 'Message Queue',
    q: 'Làm sao đảm bảo message KHÔNG BỊ MẤT xuyên suốt (producer → broker → consumer)?',
    options: [
      'Không thể đảm bảo tuyệt đối nên phải chấp nhận mất một phần',
      'Producer acks=all + broker persist/replication + commit offset SAU khi xử lý',
      'Chỉ cần tăng RAM cho broker để message không bị đẩy khỏi bộ nhớ',
      'Gửi mỗi message hai lần cho chắc rồi khử trùng ở phía consumer',
    ], answer: 1,
    explain: 'Mất message có thể ở 3 chặng: (1) PRODUCER → broker: dùng acks=all (chờ mọi replica nhận) + retry, không "gửi rồi quên"; (2) trong BROKER: bật persistence + replication (Kafka replication factor ≥ 2) để không mất khi 1 node chết; (3) BROKER → consumer: commit offset THỦ CÔNG sau khi xử lý xong (nếu auto-commit trước khi xử lý mà crash → mất). Đánh đổi: đảm bảo không mất thường kéo theo khả năng trùng → cần consumer idempotent.',
  },
  {
    id: 'dist-mq-pick', topic: 'Message Queue',
    q: 'Kafka và RabbitMQ — chọn cái nào cho tình huống nào?',
    options: [
      'Luôn chọn Kafka vì nó mạnh hơn RabbitMQ ở mọi khía cạnh kỹ thuật',
      'Kafka: thông lượng cao, lưu log/stream, replay; RabbitMQ: định tuyến linh hoạt',
      'RabbitMQ nhanh hơn Kafka mọi mặt nên hợp cả big data lẫn tác vụ',
      'Không có khác biệt đáng kể, chọn cái nào cũng cho kết quả như nhau',
    ], answer: 1,
    explain: 'Kafka: thiết kế cho THÔNG LƯỢNG lớn & lưu trữ log bền (message giữ lại theo retention, consumer replay từ offset bất kỳ) → event streaming, thu thập log, pipeline dữ liệu. RabbitMQ: broker truyền thống với routing mạnh (exchange: direct/topic/fanout), độ trễ thấp, hỗ trợ priority/TTL/dead-letter → hàng đợi tác vụ, giao tiếp microservice cần định tuyến linh hoạt. Chọn theo nhu cầu, không có cái "tốt hơn" tuyệt đối.',
  },
  // ---------- Microservices / Spring Cloud ----------
  {
    id: 'dist-ms-discovery', topic: 'Microservices / Service Discovery',
    q: 'Service discovery (Eureka/Nacos/Consul) giải quyết vấn đề gì?',
    options: [
      'Tăng tốc độ mạng giữa các service bằng cách rút ngắn đường đi',
      'Instance lên/xuống & đổi IP liên tục → registry để đăng ký và tra cứu',
      'Lưu trữ dữ liệu người dùng dùng chung cho nhiều service cùng lúc',
      'Mã hoá toàn bộ giao tiếp giữa các service bằng chứng chỉ nội bộ',
    ], answer: 1,
    explain: 'Trong microservice, số instance & IP thay đổi liên tục. Service registry (Eureka, Nacos, Consul): mỗi service ĐĂNG KÝ (register) địa chỉ khi khởi động + gửi heartbeat; service gọi thì TRA CỨU (discover) registry để lấy danh sách instance còn sống rồi chọn một để gọi. Nhờ đó không cần cấu hình IP tĩnh, tự thích ứng khi scale/deploy. Registry thường AP (Eureka) để ưu tiên sẵn sàng.',
  },
  {
    id: 'dist-ms-gateway', topic: 'Microservices / API Gateway',
    q: 'API Gateway (Spring Cloud Gateway) trong kiến trúc microservice để làm gì?',
    options: [
      'Chỉ đơn thuần chuyển tiếp request tới đúng service ở phía sau',
      'Một cửa vào duy nhất: định tuyến + xác thực, rate limit, CORS, logging',
      'Thay thế database bằng cách cache toàn bộ dữ liệu đọc thường xuyên',
      'Tự động tăng số instance của service khi lưu lượng vào tăng cao',
    ], answer: 1,
    explain: 'API Gateway là điểm vào duy nhất (single entry point): client chỉ gọi gateway, gateway ĐỊNH TUYẾN tới microservice tương ứng và xử lý TẬP TRUNG cross-cutting concern: auth/JWT, rate limit, CORS, logging, tổng hợp response, che giấu topology nội bộ. Tránh mỗi service tự làm lại + client không phải biết địa chỉ từng service. Ví dụ: Spring Cloud Gateway, Nginx, Kong.',
  },
  {
    id: 'dist-ms-circuit', topic: 'Microservices / Resilience',
    q: 'Circuit breaker (Resilience4j/Sentinel/Hystrix) hoạt động thế nào?',
    options: [
      'Ngắt nguồn điện của máy chủ đang quá tải để bảo vệ phần cứng',
      'Lỗi vượt ngưỡng → OPEN: fail nhanh + fallback, sau đó HALF-OPEN thử lại',
      'Tăng số lần retry lên vô hạn cho tới khi service kia phản hồi lại',
      'Khoá toàn bộ hệ thống lại khi phát hiện một service bị lỗi nặng',
    ], answer: 1,
    explain: 'Circuit breaker chống CASCADING FAILURE: khi gọi service B liên tục lỗi/timeout vượt ngưỡng → chuyển trạng thái OPEN → các lời gọi tiếp theo FAIL NHANH (trả fallback/default) thay vì chờ timeout kéo thread pool cạn kiệt và sập luôn service A. Sau khoảng nghỉ → HALF-OPEN thử vài request; ổn thì CLOSED (bình thường), lỗi thì OPEN lại. Kết hợp retry + timeout + bulkhead. Ví dụ: Resilience4j (khuyên dùng), Sentinel, Hystrix (đã ngừng phát triển).',
  },
  {
    id: 'dist-ms-config', topic: 'Microservices / Config',
    q: 'Config center (Spring Cloud Config / Nacos Config) để làm gì?',
    options: [
      'Chạy và giám sát vòng đời của các service bên trong cluster',
      'Quản lý cấu hình TẬP TRUNG cho nhiều service/môi trường, refresh nóng',
      'Cân bằng tải request giữa các instance của cùng một service',
      'Lưu session người dùng tập trung để mọi service cùng dùng chung',
    ], answer: 1,
    explain: 'Hàng chục microservice × nhiều môi trường → config rải rác khó quản. Config center tập trung cấu hình ở một nơi (Spring Cloud Config backed by Git, hoặc Nacos/Apollo): service kéo config lúc khởi động; đổi config có thể đẩy REFRESH nóng (@RefreshScope) mà không cần build/deploy lại. Kết hợp với secret management cho dữ liệu nhạy cảm.',
  },
  {
    id: 'dist-ms-trace', topic: 'Microservices / Observability',
    q: 'Distributed tracing (Sleuth/Zipkin, OpenTelemetry) giải quyết vấn đề gì?',
    options: [
      'Tăng tốc request bằng cách gộp nhiều lời gọi service thành một',
      'Gắn traceId/spanId xuyên suốt → dựng lại hành trình & đo từng chặng',
      'Lưu toàn bộ log ứng dụng vào database để tiện truy vấn về sau',
      'Mã hoá request giữa các service để không bị đọc trộm nội dung',
    ], answer: 1,
    explain: 'Trong microservice, một request người dùng có thể đi qua gateway → service A → B → DB/MQ. Khi chậm/lỗi rất khó lần theo. Distributed tracing gắn một traceId chung + spanId cho từng chặng (propagate qua header), gửi về hệ thu thập (Zipkin/Jaeger) → dựng lại cây gọi + thời gian mỗi span → tìm đúng service/bước gây chậm. Cùng với log tập trung (ELK) và metrics (Prometheus/Grafana) tạo thành 3 trụ observability.',
  },
];
