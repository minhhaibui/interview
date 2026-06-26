# ⚡ Rapid-fire — Tuần 11: Capstone (Order Processing Microservices)

> Câu hỏi nhanh, đáp án ngắn để **ôn cấp tốc trước phỏng vấn**. Trả lời TO THÀNH TIẾNG rồi mở đáp án so. Thuật ngữ giữ tiếng Anh. Đây là phần *tổng hợp* — bạn phải kể được hệ thống mình tự xây.

## 🏗️ Kiến trúc tổng thể

**1. Hệ Order Processing gồm những service nào? Vì sao tách?**
Order, Inventory, Payment (+ gateway/API). Tách theo bounded context để scale/triển khai/độc lập, mỗi service một DB riêng (database-per-service) → không chia sẻ schema.

**2. Vì sao mỗi service một database?**
Tránh coupling qua schema chung; mỗi team đổi schema tự do; lỗi DB này không kéo theo service khác. Hệ quả: không JOIN cross-service → phải dùng event + eventual consistency.

**3. Giao tiếp đồng bộ (REST) vs bất đồng bộ (Kafka) — dùng chỗ nào?**
Sync khi cần phản hồi ngay (đọc, validate). Async (event) cho luồng nghiệp vụ dài + decoupling (đặt hàng → trừ kho → thanh toán). Capstone dùng event để nối các service.

## 🔄 Saga & Tính nhất quán

**4. Vì sao không dùng distributed transaction (2PC) cho đặt hàng?**
2PC khoá tài nguyên xuyên service, không scale, lock coordinator là single point. Microservices dùng **saga**: chuỗi local transaction + bù trừ khi fail.

**5. Saga trong capstone: orchestration hay choreography?**
Choreography: service phản ứng theo event (OrderCreated → reserve stock → payment). Hoặc orchestration: một Saga coordinator điều phối từng bước + bù trừ. Kể rõ bạn chọn kiểu nào và vì sao.

**6. Compensating transaction là gì? Ví dụ trong hệ?**
Hành động "đảo ngược" logic của bước trước khi bước sau fail. Vd payment fail → phát `StockReleaseRequested` để hoàn kho, set order `CANCELLED`. Không rollback DB — bù bằng nghiệp vụ.

**7. Trạng thái Order đi qua những state nào?**
PENDING → (reserve stock) → CONFIRMED/PAID → … hoặc → CANCELLED/FAILED. State machine rõ ràng giúp suy luận luồng + xử lý lỗi từng chặng.

## 🛡️ Resilience & Đảm bảo bất biến

**8. Outbox pattern dùng ở đâu trong capstone?**
Khi service vừa ghi DB vừa publish event: ghi event vào bảng outbox **cùng transaction** với thay đổi nghiệp vụ, relay đẩy lên Kafka → không mất/không lệch (chống dual-write).

**9. Idempotent consumer — vì sao bắt buộc?**
Kafka at-least-once → message lặp. Consumer phải khử trùng (theo event id / business key) để không trừ kho 2 lần, không charge 2 lần. Lưu processed-id hoặc upsert theo key.

**10. Những "bất biến" (invariant) nào của hệ phải luôn đúng?**
Không bán quá tồn kho (oversell), tổng tiền order = tổng line item, không order PAID mà chưa trừ kho, không charge khi order đã CANCELLED. Script verify kiểm các bất biến này.

**11. Circuit breaker + retry đặt ở đâu?**
Ở lời gọi sync giữa service (vd Order→Payment) và tới hạ tầng ngoài. Retry backoff+jitter cho lỗi tạm thời, breaker mở khi downstream sập để fail nhanh + cho hồi phục.

**12. Graceful shutdown trong hệ microservices vì sao quan trọng?**
Khi pod bị thay (rolling update/scale), service phải ngừng nhận request mới, xử lý nốt message in-flight, commit offset, đóng connection → không mất/đúp việc, không rớt order.

## 📊 Kafka & Vận hành

**13. Vì sao chọn key cho message khi publish event order?**
Key = orderId → mọi event của một order vào **cùng partition** → giữ thứ tự theo order (Created trước Paid). Không key → có thể xử lý sai thứ tự.

**14. Rebalance ảnh hưởng gì? Bạn quan sát được gì khi thực nghiệm?**
Thêm/bớt consumer → partition chia lại, tạm dừng tiêu thụ, lag nhảy. Idempotency giúp xử-lý-lại sau rebalance an toàn. Đây là điểm hay được hỏi từ lab thực nghiệm.

**15. Consumer lag tăng vọt — bạn debug thế nào?**
Xem consumer chậm do xử lý nặng/DB chậm/lỗi retry vòng lặp; cân nhắc tăng partition + consumer, tối ưu xử lý, tách DLQ cho poison message. Lag là tín hiệu sức khoẻ chính.

## ☸️ Kubernetes & Demo

**16. Triển khai capstone lên K8s gồm gì?**
Mỗi service một Deployment + Service; ConfigMap/Secret cho cấu hình; Postgres/Kafka/Redis (StatefulSet hoặc managed); probes + resources + HPA. Ingress cho entrypoint.

**17. Probes cấu hình sao cho service phụ thuộc Kafka/DB?**
Readiness fail khi chưa kết nối được Kafka/DB → không nhận traffic tới khi sẵn sàng. Liveness chỉ phản ánh "process còn sống" để tránh restart vô ích khi downstream chậm.

**18. Failure injection bạn đã thử những gì?**
Giết broker Kafka, kill pod giữa saga, làm payment timeout, ngắt DB → kiểm hệ tự hồi phục, không mất order, không vi phạm bất biến. Ma trận failure là điểm cộng lớn khi kể.

## 🎤 Kể chuyện phỏng vấn

**19. Nếu được làm lại, bạn cải thiện gì?**
Vd: thêm tracing phân tán (OpenTelemetry) để debug saga, dùng schema registry cho event, tách read model (CQRS) cho báo cáo, tự động hoá load test trong CI. Cho thấy tư duy đánh đổi.

**20. Tóm tắt 60 giây về capstone (elevator pitch)?**
"Hệ đặt hàng microservices: Order/Inventory/Payment, database-per-service, nối bằng Kafka theo saga choreography, đảm bảo không oversell và không double-charge nhờ outbox + idempotent consumer, chạy trên K8s với probes/HPA, đã test bằng failure injection và load test."

---

### 🎯 Tự kiểm tra
Trơn tru ≥ 16/20 và kể được hệ thống của mình là sẵn sàng bảo vệ capstone. Lắp bắp câu nào → mở [`README.md`](README.md) / [`DEEP-DIVE.md`](DEEP-DIVE.md) ôn lại.
