# ⚡ Rapid-fire — Tuần 3: SQL Database

> Câu hỏi nhanh, đáp án ngắn để **ôn cấp tốc trước phỏng vấn**. Trả lời TO THÀNH TIẾNG rồi mở đáp án so. Thuật ngữ giữ tiếng Anh.

## 🗂️ Schema & Normalization

**1. 1NF, 2NF, 3NF tóm tắt?**
1NF: mỗi ô một giá trị nguyên tử (không list). 2NF: 1NF + không phụ thuộc một phần vào khoá tổ hợp. 3NF: 2NF + không phụ thuộc bắc cầu (cột không khoá không phụ thuộc cột không khoá khác).

**2. Khi nào denormalize có chủ đích?**
Khi đọc nhiều hơn ghi và JOIN tốn kém — chấp nhận lặp dữ liệu để tăng tốc đọc (vd lưu sẵn `comment_count`). Đánh đổi: phải đồng bộ khi cập nhật.

**3. Primary key vs unique key?**
PK: định danh duy nhất + NOT NULL, mỗi bảng một cái. Unique: đảm bảo không trùng nhưng có thể NULL và nhiều cái.

## 🔗 JOIN & Index

**4. INNER vs LEFT vs RIGHT vs FULL JOIN?**
INNER: chỉ hàng khớp cả hai. LEFT: tất cả hàng trái + khớp phải (thiếu thì NULL). RIGHT: ngược lại. FULL: tất cả cả hai bên.

**5. Index B-tree giúp gì?**
Tra cứu/sắp xếp theo cột nhanh O(log n) thay vì full scan. Tốt cho `=`, `<`, `>`, `BETWEEN`, `ORDER BY`, prefix `LIKE 'abc%'`.

**6. Composite index — quy tắc thứ tự cột?**
"Leftmost prefix": index `(a,b,c)` dùng được cho điều kiện trên `a`, `a,b`, `a,b,c` — KHÔNG dùng nếu chỉ lọc theo `b` hoặc `c`.

**7. Covering index là gì?**
Index chứa đủ mọi cột query cần → đọc thẳng từ index, **không** phải truy bảng (index-only scan).

**8. Khi nào index KHÔNG được dùng?**
Dùng hàm lên cột (`WHERE YEAR(d)=...`), `LIKE '%abc'` (wildcard đầu), kiểu dữ liệu lệch, hoặc optimizer thấy bảng nhỏ/độ chọn lọc thấp nên full scan rẻ hơn.

## 📊 Query Plan & Tối ưu

**9. `EXPLAIN` cho biết gì?**
Kế hoạch thực thi: dùng index nào, kiểu scan (seq/index), thứ tự JOIN, ước lượng số hàng. `EXPLAIN ANALYZE` chạy thật và đo thời gian.

**10. Thấy "Seq Scan" trên bảng lớn nghĩa là?**
Có thể thiếu index phù hợp cho điều kiện lọc → cân nhắc thêm index (nếu độ chọn lọc cao).

## 💳 Transaction & ACID

**11. ACID là gì?**
Atomicity (toàn bộ hoặc không), Consistency (giữ ràng buộc), Isolation (giao dịch không nhiễu nhau), Durability (commit là bền vững).

**12. 4 isolation level?**
Read Uncommitted → Read Committed → Repeatable Read → Serializable. Càng cao càng ít anomaly nhưng càng tốn khoá/giảm concurrency.

**13. Dirty / non-repeatable / phantom read?**
Dirty: đọc dữ liệu chưa commit. Non-repeatable: đọc lại cùng hàng ra giá trị khác (bị UPDATE). Phantom: query lại ra **thêm/bớt hàng** (bị INSERT/DELETE).

**14. Deadlock xảy ra khi nào? Tránh sao?**
Hai transaction giữ khoá chéo chờ nhau. Tránh: khoá theo **thứ tự nhất quán**, giữ transaction ngắn, dùng timeout/retry; DB tự phát hiện và hủy một bên.

**15. Optimistic vs pessimistic locking?**
Pessimistic: khoá hàng khi đọc (`SELECT ... FOR UPDATE`). Optimistic: không khoá, kiểm tra `version` lúc ghi, xung đột thì retry. Optimistic hợp ít tranh chấp.

## 🔌 SQL từ Node.js

**16. Connection pool để làm gì?**
Tái dùng kết nối DB (tạo connection rất đắt). Pool giới hạn số connection đồng thời, tránh quá tải DB.

**17. N+1 problem là gì? Khắc phục?**
Truy vấn 1 lần lấy N hàng rồi lặp N query con. Khắc phục: JOIN, `IN (...)`, eager loading, hoặc DataLoader (batch).

**18. Offset vs cursor pagination?**
Offset (`LIMIT/OFFSET`): đơn giản nhưng **chậm ở trang sâu** và lệch khi data đổi. Cursor (keyset, `WHERE id > last`): nhanh, ổn định — hợp infinite scroll.

**19. ORM trade-offs?**
Lợi: năng suất, an toàn injection, migration. Hại: query ngầm kém tối ưu, N+1 dễ xảy ra, khó kiểm soát SQL phức tạp → cần biết "thoát xuống" raw query.

**20. `VARCHAR` vs `TEXT`; `INT` vs `BIGINT` — chọn sao?**
Chọn kiểu **đủ dùng, nhỏ nhất**: tiết kiệm bộ nhớ/index, nhanh hơn. `BIGINT` cho id có thể vượt ~2.1 tỷ; `TEXT` cho nội dung dài không cần index toàn phần.

---

### 🎯 Tự kiểm tra
Trơn tru ≥ 16/20 là nắm chắc SQL. Lắp bắp câu nào → mở [`README.md`](README.md) / [`DEEP-DIVE.md`](DEEP-DIVE.md) / làm [`lab`](lab/) ôn lại.
