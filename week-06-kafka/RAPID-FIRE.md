# ⚡ Rapid-fire — Tuần 6: Kafka

> Câu hỏi nhanh, đáp án ngắn để **ôn cấp tốc trước phỏng vấn**. Trả lời TO THÀNH TIẾNG rồi mở đáp án so. Thuật ngữ giữ tiếng Anh.

## 🧱 Kiến trúc lõi

**1. Kafka là gì? Khác message queue truyền thống?**
Distributed commit log: message được **ghi bền vào log** và giữ lại theo retention, nhiều consumer đọc độc lập. RabbitMQ đẩy & xoá sau khi ack; Kafka kéo & replay được.

**2. Topic, partition, offset?**
Topic là luồng logic, chia thành partition (đơn vị song song + thứ tự). Offset là vị trí tăng dần của message trong một partition. Thứ tự chỉ đảm bảo **trong** partition.

**3. Vì sao partition quyết định throughput?**
Mỗi partition đọc/ghi song song và mỗi partition chỉ một consumer trong group xử lý → số partition giới hạn mức song song tối đa của consumer group.

**4. Kafka so với RabbitMQ và SQS — chọn khi nào?**
Kafka: throughput cao, replay, event sourcing, stream. RabbitMQ: routing phức tạp, độ trễ thấp, hàng đợi tác vụ. SQS: managed đơn giản, không cần vận hành.

**5. Replication factor & ISR?**
Mỗi partition có 1 leader + N-1 follower; RF=3 nghĩa 3 bản. ISR (in-sync replicas) là tập follower theo kịp leader. Mất leader → bầu từ ISR.

## 📤 Producer

**6. `acks=0/1/all` khác nhau?**
0: bắn rồi quên (nhanh, dễ mất). 1: leader ghi xong là ack (mất nếu leader chết trước khi replicate). all: chờ ISR ack (bền nhất, chậm hơn).

**7. Message vào partition nào được quyết định sao?**
Có key → hash(key) % partitions (cùng key cùng partition → giữ thứ tự theo entity). Không key → round-robin/sticky để cân tải.

**8. Idempotent producer giải bài gì?**
Chống ghi trùng do retry (producer gửi lại khi timeout). Bật `enable.idempotence=true` → broker khử trùng bằng (producer id, sequence) → exactly-once **khi ghi**.

**9. `min.insync.replicas` phối hợp `acks=all` thế nào?**
Đặt số replica tối thiểu phải đồng bộ thì ghi mới thành công. RF=3 + `min.insync=2` + `acks=all` = chịu được 1 broker chết mà không mất dữ liệu, vẫn ghi được.

## 📥 Consumer

**10. Consumer group hoạt động sao?**
Các consumer cùng `group.id` chia nhau partition; mỗi partition chỉ một consumer trong group. Thêm consumer (≤ số partition) → scale ngang; dư consumer thì ngồi không.

**11. Rebalancing là gì? Vì sao đau?**
Khi consumer vào/ra group, partition được chia lại → tạm dừng tiêu thụ (stop-the-world). Hay xảy ra do xử lý lâu vượt `max.poll.interval.ms`. Giảm đau: cooperative rebalance, xử lý nhanh.

**12. Commit offset: auto vs manual?**
Auto-commit định kỳ → đơn giản nhưng dễ mất/đúp khi crash. Manual commit **sau khi xử lý xong** → kiểm soát chính xác delivery semantics. Production nên manual.

**13. Commit trước hay sau khi xử lý — ảnh hưởng gì?**
Commit trước rồi xử lý = at-most-once (crash giữa chừng → mất). Xử lý xong rồi commit = at-least-once (crash sau xử lý trước commit → xử lý lại).

## 🎯 Delivery Semantics

**14. At-most-once / at-least-once / exactly-once?**
At-most: có thể mất, không đúp. At-least: không mất, có thể đúp (mặc định thực dụng). Exactly: không mất không đúp — cần idempotent producer + transaction hoặc consumer idempotent.

**15. Vì sao at-least-once + idempotent consumer là lựa chọn thực tế?**
Exactly-once end-to-end phức tạp/đắt. Phổ biến hơn: đảm bảo at-least-once rồi làm consumer **idempotent** (khử trùng theo message id/business key) → hiệu ứng exactly-once.

## 🔧 Xử lý lỗi & vận hành

**16. Consumer lag là gì? Vì sao theo dõi?**
Lag = offset mới nhất − offset đã commit = số message tồn chưa xử lý. Lag tăng đều → consumer không theo kịp producer; là metric cảnh báo quan trọng nhất.

**17. Retry + DLQ xử lý poison message ra sao?**
Message lỗi mãi (poison) làm kẹt partition. Giải: retry có giới hạn (retry topic theo bậc), quá ngưỡng đẩy sang Dead Letter Queue để xử lý tay, không chặn luồng chính.

**18. Vì sao không nên chỉ tăng partition để giữ thứ tự + song song?**
Thứ tự chỉ trong partition; muốn giữ thứ tự theo entity phải route cùng key vào cùng partition. Tăng partition làm thay đổi hashing → có thể vỡ thứ tự dữ liệu cũ.

## 🏗️ Kafka trong Microservices

**19. Outbox pattern giải bài gì?**
Ghi DB và publish Kafka không nguyên tử (dual write) → có thể lệch. Outbox: ghi event vào bảng outbox **trong cùng transaction** với dữ liệu, rồi relay (CDC/poller) đẩy lên Kafka.

**20. Log compaction khác retention thường?**
Retention xoá theo thời gian/dung lượng. Compaction giữ **bản mới nhất theo key** (xoá bản cũ trùng key) → hợp lưu trạng thái mới nhất (vd snapshot user), không phải lịch sử đầy đủ.

---

### 🎯 Tự kiểm tra
Trơn tru ≥ 16/20 là nắm chắc Kafka. Lắp bắp câu nào → mở [`CO-BAN.md`](CO-BAN.md) / [`README.md`](README.md) / [`DEEP-DIVE.md`](DEEP-DIVE.md) / làm [`lab`](lab/) ôn lại.
