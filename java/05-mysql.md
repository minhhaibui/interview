# 05 · MySQL (InnoDB) — Java Backend

> Database là mảng **bắt buộc** cho backend. Câu hỏi xoay quanh **index, transaction, khoá**. Đọc xong làm quiz **🗄️ SQL** chủ đề *MySQL*.

---

## 1. Vì sao index dùng cây B+ (B+Tree)?

Index giúp tìm dữ liệu nhanh mà không phải quét cả bảng. InnoDB dùng **B+Tree**, không phải B-Tree hay hash:

```
       [10 | 20 | 30]          ← node trong: CHỈ chứa khoá (điều hướng)
      /     |     \
 [..7][..]  ...   [..]         ← node LÁ: chứa dữ liệu, nối nhau thành linked list
 └──────────────────────┘        → quét khoảng (range) rất nhanh
```

- **Chỉ node lá chứa dữ liệu**, node trong chỉ chứa khoá → fan-out cao → cây **thấp** (3–4 tầng cho hàng triệu bản ghi) → ít lần đọc đĩa.
- **Lá nối thành danh sách liên kết** → `BETWEEN`, `>`, `ORDER BY` (range/sort) rất nhanh.
- **Hash index** tra `=` là O(1) nhưng **vô dụng với range/sort** → InnoDB mặc định B+Tree.

---

## 2. Clustered index & "回表" (table lookback)

- Bảng InnoDB **chính là** clustered index theo **khoá chính**: node lá chứa **toàn bộ hàng**.
- **Secondary index** (index phụ): node lá chỉ chứa `(giá trị index → khoá chính)`. Muốn lấy cột khác → phải dùng khoá chính **tra clustered index lần nữa** = **回表** (tốn thêm I/O).
- **Covering index** (index chứa đủ cột cần) → tránh được 回表.

> Vì thế khoá chính nên **nhỏ và tăng dần** (`AUTO_INCREMENT`), tránh UUID ngẫu nhiên gây **tách trang** (page split) và index phụ phình to.

---

## 3. Leftmost prefix (composite index)

Với `INDEX(a, b, c)`, chỉ dùng được index khi điều kiện bắt đầu **liền mạch từ trái**:

| Truy vấn | Dùng index? |
|----------|-------------|
| `WHERE a=1` | ✅ |
| `WHERE a=1 AND b=2` | ✅ |
| `WHERE a=1 AND b=2 AND c=3` | ✅ |
| `WHERE b=2 AND c=3` | ❌ (thiếu `a` dẫn đầu) |

> Ngoài ra: **range** (`>`, `<`, `BETWEEN`, `LIKE 'x%'`) ở một cột sẽ **chặn** các cột SAU nó dùng index cho phần bằng.

---

## 4. Bốn mức cô lập (isolation level)

Tăng dần cô lập → an toàn hơn nhưng ít đồng thời hơn:

| Mức | Lỗi còn cho phép | Ghi chú |
|-----|------------------|---------|
| READ UNCOMMITTED | Dirty read (đọc bẩn) | Hầu như không dùng |
| READ COMMITTED | Non-repeatable read | Mặc định **Oracle/PostgreSQL** |
| **REPEATABLE READ** | (InnoDB gần như chặn cả phantom) | **Mặc định MySQL** |
| SERIALIZABLE | — (an toàn nhất) | Chậm nhất, khoá đọc |

- **Dirty read:** đọc dữ liệu chưa commit của transaction khác.
- **Non-repeatable read:** đọc cùng 1 hàng 2 lần ra 2 giá trị (do transaction khác update+commit ở giữa).
- **Phantom read:** cùng điều kiện, lần 2 xuất hiện thêm hàng mới (do insert).

---

## 5. MVCC — đọc không khoá

**MVCC (Multi-Version Concurrency Control):** cho phép đọc bản **snapshot cũ** trong khi ghi vẫn diễn ra → đọc và ghi **không chặn nhau**.

Cơ chế: mỗi hàng có cột ẩn `trx_id` (transaction tạo) + `roll_pointer` trỏ vào **undo log** (các phiên bản cũ). **Read View** quyết định transaction thấy phiên bản nào.

- `SELECT` thường = **snapshot read** → không khoá.
- `SELECT ... FOR UPDATE` / `LOCK IN SHARE MODE` = **current read** → có khoá.

> "Readers don't block writers, writers don't block readers" — đây là lý do MySQL chịu tải đồng thời tốt.

---

## 6. Khoá trong InnoDB

Khoá ở **tầng index**:

- **Record lock:** khoá 1 bản ghi index cụ thể.
- **Gap lock:** khoá **khoảng trống** giữa các bản ghi (không khoá bản ghi) → ngăn INSERT vào khe → **chống phantom**.
- **Next-key lock** = record + gap → mặc định ở REPEATABLE READ.

> Khoá dòng chỉ hoạt động khi truy cập **qua index**. Không có index phù hợp → thoái hoá thành **khoá bảng** (rất tệ cho đồng thời).

---

## 7. Đọc EXPLAIN — tối ưu truy vấn

Cột `type` (thứ tự **tốt → tệ**):

```
system > const > eq_ref > ref > range > index > ALL
```

- **ALL** = full table scan (không index) — tệ nhất với bảng lớn.
- **index** = quét toàn bộ index.
- **range** = quét theo khoảng (ổn).
- **ref/eq_ref/const** = tra qua index chọn lọc (tốt).

Cột **Extra** cần chú ý: `Using filesort` (sắp xếp tốn kém), `Using temporary` (bảng tạm) → dấu hiệu cần tối ưu (thêm index phù hợp).

---

## 8. Câu hỏi phỏng vấn hay gặp

1. Vì sao InnoDB dùng B+Tree cho index, không dùng B-Tree/hash?
2. Clustered index là gì? "回表" là gì và tránh bằng cách nào?
3. Leftmost prefix của composite index — cho ví dụ truy vấn KHÔNG dùng được index.
4. Kể 4 isolation level và lỗi mỗi mức. Mặc định của MySQL là gì?
5. MVCC hoạt động thế nào? Vì sao đọc không khoá?
6. Record/gap/next-key lock khác nhau ra sao? Gap lock để làm gì?
7. Trong EXPLAIN, `type = ALL` nghĩa là gì? Còn thấy gì ở Extra thì cần tối ưu?

> Làm tiếp: tab **🧠 Tư duy → 🗄️ SQL**, các câu chủ đề *MySQL / Index / Transaction / MVCC / Lock / EXPLAIN*.
