# ⚡ Rapid-fire — Tuần 4: NoSQL & Database Design

> Câu hỏi nhanh, đáp án ngắn để **ôn cấp tốc trước phỏng vấn**. Trả lời TO THÀNH TIẾNG rồi mở đáp án so. Thuật ngữ giữ tiếng Anh.

## 🆚 SQL vs NoSQL

**1. NoSQL khác SQL ở điểm cốt lõi nào?**
NoSQL bỏ schema cứng + JOIN, đổi lấy mở rộng ngang (horizontal scaling) và mô hình dữ liệu linh hoạt. SQL mạnh về quan hệ, transaction ACID, query phức tạp.

**2. 4 họ NoSQL chính?**
Document (MongoDB), Key-Value (Redis/DynamoDB), Column-family (Cassandra/HBase), Graph (Neo4j). Chọn theo hình dạng dữ liệu và pattern truy vấn.

**3. Khi nào chọn MongoDB thay PostgreSQL?**
Schema thay đổi nhanh, dữ liệu dạng document lồng nhau, cần scale ghi ngang. Tránh khi nghiệp vụ nhiều quan hệ phức tạp và cần transaction nhiều bảng mạnh.

## 📄 MongoDB cơ bản

**4. BSON là gì?**
Binary JSON — định dạng nhị phân Mongo lưu document. Thêm kiểu (ObjectId, Date, Decimal128, Binary) và nhanh hơn JSON thuần khi parse.

**5. ObjectId gồm gì?**
12 byte: 4 byte timestamp + 5 byte random (machine/process) + 3 byte counter. Gần như duy nhất, có thể trích thời gian tạo, sort xấp xỉ theo thời gian.

**6. Document tối đa bao nhiêu? Hệ quả?**
16MB/document. Vì vậy mảng con phình to vô hạn (vd toàn bộ comment) là anti-pattern → dùng reference hoặc bucket.

## 🎨 Schema Design Patterns

**7. Embed vs Reference — quy tắc chọn?**
Embed khi "đọc cùng nhau, quan hệ 1-ít, ít đổi" (one-to-few). Reference khi quan hệ 1-nhiều lớn, dữ liệu con dùng độc lập, hoặc bị giới hạn 16MB.

**8. Bucket pattern dùng khi nào?**
Time-series / IoT: gom nhiều phép đo vào 1 document theo cửa sổ thời gian → giảm số document, giảm overhead index, đọc theo dải thời gian nhanh.

**9. Outlier pattern là gì?**
Đa số document nhỏ nhưng vài cái khổng lồ (vd user có triệu follower). Tách phần "tràn" sang collection phụ + cờ `has_overflow` để không phá thiết kế chung.

**10. Computed pattern?**
Tính sẵn giá trị tổng hợp (sum/avg/count) lúc ghi thay vì tính lại mỗi lần đọc — đổi chỗ chi phí từ read sang write khi đọc nhiều.

**11. Extended reference?**
Khi reference nhưng hay cần vài field của doc kia → sao chép vài field nóng (vd `customer.name`) vào doc hiện tại, tránh JOIN/lookup. Đánh đổi: đồng bộ khi đổi.

## 🔎 Index & Query

**12. `$lookup` là gì? Lưu ý?**
JOIN của Mongo trong aggregation. Đắt, không tận dụng index tốt như SQL JOIN → thiết kế nên giảm phụ thuộc lookup; ưu tiên embed/extended reference.

**13. Compound index — quy tắc ESR?**
Thứ tự field: **E**quality → **S**ort → **R**ange. Đặt field lọc `=` trước, rồi field sort, cuối là field range (`$gt`,`$lt`) để index hiệu quả nhất.

**14. Multikey index?**
Index trên field là mảng — Mongo tạo entry cho mỗi phần tử. Một compound index chỉ được chứa **một** field mảng.

**15. `explain()` xem gì để biết index ổn?**
`COLLSCAN` = quét toàn bộ (xấu). `IXSCAN` = dùng index. So `totalKeysExamined`/`totalDocsExamined` với `nReturned` — chênh lớn là index kém chọn lọc.

## 🌐 Replication & Sharding

**16. Replica set hoạt động sao?**
1 primary nhận ghi, các secondary sao chép qua oplog. Primary chết → bầu lại (election) trong vài giây. Tăng độ sẵn sàng + đọc phân tải (đọc secondary).

**17. Write concern `w:1` vs `w:majority`?**
`w:1`: chỉ primary ack — nhanh nhưng có thể mất nếu failover. `majority`: đa số node ack — bền, chống rollback, đổi lại chậm hơn.

**18. Sharding là gì? Vai trò shard key?**
Chia dữ liệu ngang theo shard key qua nhiều shard. Shard key quyết định phân bố: chọn sai → hotspot (1 shard gánh hết) hoặc scatter-gather mọi query.

**19. Hashed vs ranged shard key?**
Hashed: phân bố đều, tránh hotspot ghi, nhưng range query phải hỏi mọi shard. Ranged: range query nhanh nhưng dễ hotspot nếu key tăng đơn điệu (vd timestamp).

**20. Transaction đa document trong Mongo?**
Có từ 4.0 (replica set) / 4.2 (sharded), hỗ trợ ACID. Nhưng đắt — thiết kế tốt nên gói dữ liệu liên quan vào **một** document để cập nhật nguyên tử tự nhiên.

---

### 🎯 Tự kiểm tra
Trơn tru ≥ 16/20 là nắm chắc NoSQL & data modeling. Lắp bắp câu nào → mở [`README.md`](README.md) / [`DEEP-DIVE.md`](DEEP-DIVE.md) / [`DESIGN-CASES.md`](DESIGN-CASES.md) / làm [`lab`](lab/) ôn lại.
