# 08 · Hệ phân tán & Message Queue — Java Backend

> Mảng cho vị trí **senior / hệ thống lớn**. Đọc xong làm quiz **🏗️ Phân tán**.

---

## 1. Message Queue — vì sao dùng?

Ba lợi ích cốt lõi (nhớ: **decouple · peak shaving · async**):

- **Decouple (tách phụ thuộc):** producer chỉ đẩy message, không cần biết consumer là ai/còn sống không.
- **Peak shaving (hấp thụ đỉnh tải):** hàng đợi hấp thụ đỉnh tải, consumer xử lý theo nhịp của mình → bảo vệ hệ phía sau.
- **Async (bất đồng bộ):** tác vụ chậm (gửi mail, xử lý ảnh) đẩy vào queue → API trả về ngay.

> Đánh đổi: thêm độ phức tạp, độ trễ, và phải xử lý **mất / trùng / sai thứ tự** message.

---

## 2. Kafka — partition & consumer group

- **Partition:** chia topic thành nhiều phần → ghi/đọc **song song**, mở rộng thông lượng.
- **Consumer group:** các consumer chia nhau partition; **mỗi partition chỉ do MỘT consumer** trong group đọc → không xử lý trùng trong group.
- ⇒ Số consumer hữu ích **tối đa = số partition** (thêm nữa thì dư, rảnh).
- Nhiều group khác nhau đọc cùng topic độc lập (pub-sub).

### Thứ tự message

Kafka chỉ đảm bảo thứ tự **TRONG một partition** (theo offset). Toàn topic **không** có thứ tự tổng.

> Muốn cùng một thực thể (vd `orderId`) giữ đúng thứ tự → đặt **message key = orderId** để Kafka băm vào **cùng partition**.

---

## 3. Delivery semantics (đảm bảo giao nhận)

| Kiểu | Ý nghĩa |
|------|---------|
| At-most-once | Có thể **mất**, không trùng |
| **At-least-once** | Không mất nhưng có thể **trùng** (phổ biến nhất) |
| Exactly-once | Đúng một lần (khó/đắt) |

> **Giải pháp thực tế:** chấp nhận **at-least-once** + làm **consumer idempotent** (xử lý trùng không gây hậu quả) — rẻ và đủ tốt, thay cho exactly-once đắt đỏ.

### Idempotent consumer

- Mỗi message có **id duy nhất** → lưu "đã xử lý" (DB UNIQUE / Redis `SETNX`); gặp lại thì bỏ qua.
- Hoặc thiết kế thao tác **vốn idempotent**: `UPSERT` thay `INSERT`, "set trạng thái = PAID" (làm lại vẫn PAID) thay "cộng tiền".

### Không mất message — 3 chặng

1. **Producer → broker:** `acks=all` (chờ mọi replica) + retry, không "gửi rồi quên".
2. **Trong broker:** persistence + **replication** (Kafka replication factor ≥ 2).
3. **Broker → consumer:** commit offset **THỦ CÔNG sau khi xử lý xong** (auto-commit trước khi xử lý mà crash → mất).

---

## 4. Kafka vs RabbitMQ

| | Kafka | RabbitMQ |
|--|-------|----------|
| Điểm mạnh | Thông lượng **cực cao**, lưu log/stream, **replay** được | Định tuyến linh hoạt (exchange/routing), độ trễ thấp |
| Hợp cho | Big data, event streaming, pipeline | Hàng đợi tác vụ, microservice cần routing |

---

## 5. CAP theorem

Một hệ phân tán **không** thể đồng thời đảm bảo cả 3:
- **C**onsistency — mọi node thấy dữ liệu mới nhất.
- **A**vailability — mọi request được trả lời.
- **P**artition tolerance — chịu được mất kết nối giữa các node.

Vì **partition là điều không tránh khỏi** (P bắt buộc), khi partition xảy ra phải chọn:
- **CP:** từ chối trả lời để giữ nhất quán (vd ZooKeeper).
- **AP:** vẫn trả lời, chấp nhận dữ liệu cũ (vd Eureka, Cassandra).

> **BASE** (Basically Available, Soft state, Eventual consistency) là hướng AP — nền của nhiều hệ quy mô lớn.

---

## 6. Transaction phân tán

Khi nghiệp vụ trải nhiều service/DB:

| Giải pháp | Cách làm | Đánh đổi |
|-----------|----------|----------|
| **2PC / XA** | Prepare → Commit qua coordinator | Nhất quán mạnh nhưng **khoá lâu**, coordinator là điểm chết |
| **TCC** | Try (giữ chỗ) → Confirm / Cancel | Ứng dụng tự viết bù trừ |
| **Saga** | Chuỗi transaction cục bộ + bước **bù (compensating)** khi lỗi | Nhất quán cuối cùng |
| **Outbox / Local message table** | Ghi message vào DB cùng transaction nghiệp vụ → đẩy MQ | Nhất quán cuối cùng, đơn giản |

> Microservice thực tế ưu tiên **eventual consistency** (Saga / Outbox) hơn 2PC.

---

## 7. Distributed ID (Snowflake)

Sinh ID duy nhất toàn cục mà không cần chốt tập trung. **Snowflake** ghép 64-bit:

```
[1 bit dấu][41 bit timestamp][10 bit machine id][12 bit sequence]
```

- **Duy nhất** toàn cục, **tăng dần theo thời gian** → thân thiện clustered index (tránh page split như UUID ngẫu nhiên).
- Sinh **cục bộ**, không cần điều phối → nhanh.
- Nhược: phụ thuộc **đồng hồ** (clock quay ngược có thể gây trùng — cần xử lý).

So sánh: **UUID** đơn giản nhưng 128-bit, ngẫu nhiên → index kém; **DB auto-increment** đơn giản nhưng là điểm nghẽn/khó sharding.

---

## 8. Consistency: strong vs eventual

- **Strong:** đọc luôn thấy giá trị mới nhất ngay sau ghi — đắt, giảm availability (vd số dư ngân hàng).
- **Eventual:** sau một khoảng thời gian mọi bản sao **hội tụ** về cùng giá trị — nhanh, sẵn sàng cao (vd like/view/feed).

> Chọn theo nghiệp vụ, không phải cái nào "tốt hơn" tuyệt đối.

---

## 9. Câu hỏi phỏng vấn hay gặp

1. Vì sao dùng message queue? (3 lợi ích)
2. Kafka partition & consumer group để làm gì? Số consumer hữu ích tối đa?
3. Kafka đảm bảo thứ tự ở phạm vi nào? Giữ thứ tự theo entity sao?
4. At-least-once vs exactly-once? Thực tế xử lý message trùng thế nào?
5. Đảm bảo message không mất — cần làm gì ở 3 chặng?
6. Phát biểu CAP. Khi partition xảy ra chọn gì? CP vs AP cho ví dụ.
7. Kể các giải pháp transaction phân tán và đánh đổi.
8. Snowflake sinh ID thế nào? Ưu/nhược so với UUID?

> Làm tiếp: tab **🧠 Tư duy → 🏗️ Phân tán**.
