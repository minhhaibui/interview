# ⚡ Rapid-fire — Tuần 10: System Design

> Câu hỏi nhanh, đáp án ngắn để **ôn cấp tốc trước phỏng vấn**. Trả lời TO THÀNH TIẾNG rồi mở đáp án so. Thuật ngữ giữ tiếng Anh.

## 🧭 Framework & Scalability

**1. Khung 4 bước trả lời bài system design?**
(1) Làm rõ yêu cầu + scope (functional/non-functional). (2) Ước lượng tải (QPS, storage). (3) Vẽ high-level + API + data model. (4) Đào sâu bottleneck + đánh đổi. Luôn hỏi trước khi vẽ.

**2. Vertical vs horizontal scaling?**
Vertical: máy mạnh hơn — đơn giản nhưng có trần + single point. Horizontal: thêm máy + load balancer — scale gần vô hạn nhưng cần app stateless + xử lý phân tán. Mặc định ưu tiên ngang.

**3. Stateless quan trọng vì sao khi scale?**
Mọi instance phục vụ được mọi request → thêm/bớt node tự do, LB chia tải dễ. State (session) đẩy ra Redis/DB ngoài. Có state cục bộ → sticky session, scale khó.

**4. Back-of-the-envelope: ước lượng gì?**
QPS (DAU × hành động / 86400, nhân hệ số peak), storage (số record × kích thước × thời gian giữ), băng thông, bộ nhớ cache. Mục tiêu đúng *cấp độ*, không cần chính xác.

## ⚖️ Load Balancing & CAP

**5. L4 vs L7 load balancer?**
L4: định tuyến theo IP/port (nhanh, không hiểu nội dung). L7: hiểu HTTP → route theo path/header, TLS termination, sticky. L7 linh hoạt hơn, L4 throughput cao hơn.

**6. Thuật toán LB phổ biến?**
Round-robin, weighted, least-connections, IP-hash (sticky), consistent hashing. Least-connections tốt khi request không đều; consistent hashing giảm xáo trộn khi thêm/bớt node.

**7. CAP theorem nói gì?**
Khi có network **P**artition, hệ phân tán chỉ chọn được **C** (consistency) hoặc **A** (availability). Không partition thì có cả hai. Thực tế là chọn CP hay AP khi sự cố mạng.

**8. CP vs AP hệ thống — ví dụ?**
CP (ưu tiên đúng): ngân hàng, inventory — thà từ chối còn hơn sai (vd ZooKeeper, etcd). AP (ưu tiên sẵn sàng): feed, giỏ hàng — chấp nhận stale (vd Cassandra, DynamoDB).

**9. Strong vs eventual consistency?**
Strong: đọc luôn ra ghi mới nhất (chậm/đắt, cần đồng bộ). Eventual: các bản sao hội tụ sau một lúc (nhanh, sẵn sàng). Chọn theo nghiệp vụ chịu stale được tới đâu.

## 🗄️ Database Scaling

**10. Read replica giải bài gì? Hạn chế?**
Sao chép read sang nhiều replica → scale **đọc**. Hạn chế: replication lag (đọc replica có thể thấy dữ liệu cũ), không scale ghi. Ghi vẫn dồn về primary.

**11. Sharding & các chiến lược?**
Chia ghi/dữ liệu ngang theo shard key: range, hash, hoặc directory. Đánh đổi: cross-shard query/transaction khó, rebalancing đau. Consistent hashing giảm di chuyển dữ liệu khi thêm shard.

**12. Hot partition/celebrity problem?**
Một shard/key nóng gánh quá tải (vd user nổi tiếng). Giảm: thêm hậu tố ngẫu nhiên vào key, tách riêng outlier, cache lớp trên, hoặc chọn shard key phân bố đều hơn.

## 🚀 Caching & CDN

**13. Cache đặt ở những tầng nào?**
Client/browser, CDN (edge), reverse proxy, application cache (Redis), DB query cache. Càng gần user càng nhanh; chiến lược TTL + invalidation cho từng tầng.

**14. Vì sao "cache invalidation" khó?**
Khó biết *khi nào* dữ liệu cũ và *cập nhật cache nào*. Sai → phục vụ stale hoặc miss hàng loạt. Chiến lược: TTL, write-through, event-based invalidation; chấp nhận stale có kiểm soát.

## 🧩 Distributed Patterns

**15. Idempotency key giải bài gì?**
Client gửi key duy nhất cho mỗi thao tác; server lưu kết quả theo key → retry không tạo bản trùng (vd double charge). Cốt lõi cho payment/POST an toàn khi network không tin cậy.

**16. Rate limiting — 4 thuật toán?**
Fixed window, sliding window log, sliding window counter, token bucket / leaky bucket. Token bucket cho burst có kiểm soát; sliding window mượt hơn fixed ở ranh giới.

**17. Circuit breaker hoạt động sao?**
Theo dõi tỉ lệ lỗi của downstream; vượt ngưỡng → **mở** mạch, fail nhanh (không gọi nữa) một thời gian, rồi half-open thử lại. Chống cascading failure + cho downstream hồi phục.

**18. Retry cần kèm gì để an toàn?**
Exponential backoff + jitter (tránh thundering herd), giới hạn số lần, chỉ retry lỗi tạm thời (timeout/5xx), và thao tác phải **idempotent** kẻo retry nhân đôi tác dụng.

**19. Saga pattern giải bài gì?**
Transaction phân tán qua nhiều service không thể 2PC: chuỗi local transaction + **compensating action** khi một bước fail. Hai kiểu: choreography (event) và orchestration (điều phối trung tâm).

**20. Message queue mang lại lợi ích gì cho kiến trúc?**
Decoupling (producer/consumer độc lập), load leveling (đệm khi tải bùng), độ bền (không mất việc khi consumer chết), retry/DLQ. Đổi lại: thêm độ phức tạp + eventual consistency.

---

### 🎯 Tự kiểm tra
Trơn tru ≥ 16/20 là nắm chắc System Design. Lắp bắp câu nào → mở [`README.md`](README.md) / [`DEEP-DIVE.md`](DEEP-DIVE.md) hoặc [`system-design-scenarios`](../system-design-scenarios/) ôn lại.
