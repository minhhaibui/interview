# ⚡ Rapid-fire — Tuần 9: AWS

> Câu hỏi nhanh, đáp án ngắn để **ôn cấp tốc trước phỏng vấn**. Trả lời TO THÀNH TIẾNG rồi mở đáp án so. Thuật ngữ giữ tiếng Anh.

## 🔐 IAM & Networking

**1. IAM Role khác IAM User?**
User: danh tính cố định (người/app) với credential dài hạn. Role: danh tính tạm, được **assume**, cấp credential ngắn hạn — ưu tiên cho service (EC2/Lambda) thay vì nhúng access key.

**2. Nguyên tắc least privilege trong IAM?**
Chỉ cấp đúng quyền cần thiết qua policy (Effect/Action/Resource/Condition). Tránh `*:*`. Dùng role + temporary credential, bật MFA cho thao tác nhạy cảm.

**3. VPC, subnet public vs private?**
VPC = mạng ảo riêng. Public subnet có route ra Internet Gateway (cho LB, bastion). Private subnet không lộ ra Internet (cho app/DB), ra ngoài qua NAT Gateway.

**4. Security Group vs NACL?**
SG: stateful, gắn vào instance, chỉ có allow rule (reply tự cho qua). NACL: stateless, gắn vào subnet, có cả allow/deny, phải mở cả 2 chiều. SG là tuyến phòng thủ chính.

## 💻 Compute & Storage

**5. EC2 vs Lambda vs Fargate — chọn khi nào?**
EC2: toàn quyền, workload chạy liên tục. Lambda: event-driven, ngắn, tự scale, trả theo ms. Fargate: container không cần quản node. Chọn theo mức kiểm soát vs vận hành.

**6. S3 storage classes chính?**
Standard (nóng), Standard-IA / One Zone-IA (ít truy cập), Glacier / Deep Archive (lưu trữ lạnh, lấy chậm rẻ). Lifecycle policy tự chuyển lớp để tiết kiệm chi phí.

**7. Presigned URL giải bài gì?**
Cho client upload/download trực tiếp S3 mà không lộ credential và không đi qua server app → giảm tải backend. URL có hạn dùng + quyền giới hạn.

**8. S3 đảm bảo gì về consistency?**
Strong read-after-write cho mọi thao tác (từ 2020). PUT mới đọc ra ngay. Vẫn nên thiết kế idempotent vì lưu lượng/event có thể lặp.

## 🗃️ Data & Messaging

**9. RDS vs DynamoDB?**
RDS: relational, SQL, JOIN, transaction mạnh, scale dọc + read replica. DynamoDB: NoSQL key-value/document, scale ngang gần như vô hạn, single-digit ms — cần thiết kế theo access pattern.

**10. ElastiCache dùng làm gì?**
Redis/Memcached managed: cache giảm tải DB, session store, rate limit, leaderboard. Giảm latency và chi phí đọc DB cho dữ liệu nóng.

**11. SQS vs SNS vs EventBridge?**
SQS: hàng đợi điểm-điểm (1 consumer xử lý). SNS: pub/sub fan-out (nhiều subscriber). EventBridge: event bus có routing rule theo nội dung + tích hợp SaaS. Hay ghép SNS→SQS.

**12. SQS standard vs FIFO?**
Standard: throughput cao, at-least-once, không đảm bảo thứ tự. FIFO: giữ thứ tự + exactly-once trong group, throughput thấp hơn. Dùng FIFO khi thứ tự/khử trùng quan trọng.

**13. DLQ trong SQS để làm gì?**
Sau N lần xử lý thất bại (maxReceiveCount), message chuyển sang Dead Letter Queue → tách message độc, không kẹt hàng đợi, để điều tra/replay sau.

## ⚡ Serverless & Edge

**14. Lambda cold start là gì? Giảm sao?**
Lần gọi đầu phải khởi tạo runtime + code → trễ. Giảm: provisioned concurrency, gói nhỏ, runtime nhẹ, giữ kết nối ngoài handler, tránh VPC không cần thiết.

**15. API Gateway vai trò gì?**
Cổng HTTP/REST/WebSocket trước Lambda/backend: auth, throttling, rate limit, caching, transform request. Tách lo việc "cổng vào" khỏi business logic.

**16. CloudFront giải bài gì?**
CDN cache nội dung ở edge gần user → giảm latency + tải gốc. Phục vụ static (S3) và động (có TTL), thêm TLS, WAF, chống DDoS lớp biên.

## 📈 Vận hành & Well-Architected

**17. CloudWatch cung cấp gì?**
Metrics, Logs, Alarms, Dashboards. Theo dõi sức khoẻ (CPU, lỗi, lag), bắn alarm → auto scaling/thông báo. Là nền tảng observability của AWS.

**18. Multi-AZ vs Multi-Region?**
Multi-AZ: replica đồng bộ khác data center cùng region → chịu lỗi AZ, RDS tự failover. Multi-Region: chịu thảm hoạ cả region + giảm latency toàn cầu, phức tạp/đắt hơn.

**19. 5 trụ Well-Architected Framework?**
Operational Excellence, Security, Reliability, Performance Efficiency, Cost Optimization (+ Sustainability). Khung đánh giá kiến trúc cloud — hay được hỏi trong design.

**20. Cách kiểm soát chi phí cơ bản?**
Right-sizing instance, auto scaling, Spot cho việc chịu gián đoạn, Savings Plans/Reserved cho ổn định, S3 lifecycle, tắt tài nguyên idle, đặt budget alarm theo dõi.

---

### 🎯 Tự kiểm tra
Trơn tru ≥ 16/20 là nắm chắc AWS. Lắp bắp câu nào → mở [`CO-BAN.md`](CO-BAN.md) / [`README.md`](README.md) / [`DEEP-DIVE.md`](DEEP-DIVE.md) / [`DESIGN-CASES.md`](DESIGN-CASES.md) ôn lại.
