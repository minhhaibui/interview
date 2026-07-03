// Checklist nghiệm thu capstone Upgrade 1→5 — bám sát mục "Checklist nghiệm thu"
// trong từng file capstone-project/UPGRADE-0X-*.md (sửa guide thì cập nhật cả đây).
window.CAPSTONE_UPGRADES = [
  {
    id: 'up1', icon: '🐘', label: 'Upgrade 1 — Postgres', week: 3,
    doc: 'capstone-project/UPGRADE-01-POSTGRES.md',
    items: [
      'POST /orders ghi đủ 3 bảng trong MỘT transaction (kill server giữa chừng → không có order mồ côi)',
      'Gửi 2 request song song cùng Idempotency-Key → chỉ tạo 1 order (UNIQUE constraint bắt race)',
      'GET /orders/:id trả items đúng bằng json_agg (1 query, không N+1)',
      'EXPLAIN ANALYZE query findById — thấy Index Scan, không Seq Scan',
      'Graceful shutdown gọi repo.close() để pool thoát sạch',
    ],
  },
  {
    id: 'up2', icon: '⚡', label: 'Upgrade 2 — Redis cache', week: 5,
    doc: 'capstone-project/UPGRADE-02-REDIS.md',
    items: [
      'Request thứ 2 trở đi không chạm DB (tắt hẳn Postgres → GET vẫn trả được từ cache)',
      'Tắt Redis → app vẫn hoạt động bình thường, chỉ chậm hơn (graceful degradation)',
      'TTL các key khác nhau (jitter hoạt động) — redis-cli TTL vài key mà xem',
      'Tạo order mới → key cache cũ của order đó bị xóa (invalidate-on-write)',
      'Graceful shutdown: Redis quit + pool end theo chuỗi decorator',
    ],
  },
  {
    id: 'up3', icon: '📨', label: 'Upgrade 3 — Kafka outbox', week: 6,
    doc: 'capstone-project/UPGRADE-03-KAFKA.md',
    items: [
      'Tắt Kafka, tạo order → API vẫn 201, outbox tích lũy; bật lại → event tự bắn ra (resilience)',
      'Kill relay sau producer.send trước UPDATE → restart → event bắn LẠI → consumer không xử lý trùng',
      'Hiểu key → partition: đổi key orderId thành customerId xem ordering thay đổi gì',
      'Chạy 2 relay song song → không event nào bắn trùng nhờ SKIP LOCKED',
      'kafka-console-consumer thấy đủ event từ đầu topic',
    ],
  },
  {
    id: 'up4', icon: '🐳', label: 'Upgrade 4 — Docker & K8s', week: 8,
    doc: 'capstone-project/UPGRADE-04-DOCKER-K8S.md',
    items: [
      'docker build xong, image < 200MB',
      'Container chạy bằng user node, không phải root',
      '2 Pod Running, kill 1 pod → tự mọc lại trong vài giây',
      'Sửa /health trả 500 → chứng kiến liveness restart container',
      'Rolling update + rollback không rớt request nào (curl loop trong lúc update)',
    ],
  },
  {
    id: 'up5', icon: '☁️', label: 'Upgrade 5 — AWS (SQS + S3)', week: 9,
    doc: 'capstone-project/UPGRADE-05-AWS.md',
    items: [
      'Cả dây chuyền chạy: POST /orders → outbox → sqs-relay → consumer in "📧" trong ≤2 giây',
      'Kill consumer giữa chừng → message hiện lại sau visibility timeout, không mất',
      'Message hỏng fail 3 lần → nằm trong DLQ, queue chính sạch',
      'Gửi trùng MessageDeduplicationId trong 5 phút → consumer chỉ nhận 1 bản',
      'GET /orders/:id/invoice-url tải được bằng curl không kèm credentials; hết hạn → 403',
      'Trả lời được: dòng nào trong code phải đổi khi lên AWS thật?',
    ],
  },
];
