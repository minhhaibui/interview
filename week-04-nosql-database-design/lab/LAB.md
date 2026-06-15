# 🧪 Lab MongoDB — Tận tay

Lab chạy được để **tự tay** sờ vào CRUD, index, `explain`, aggregation pipeline và schema design pattern (embed vs reference, bucket). Không học chay — chạy thật, đọc output thật.

> 📍 Toàn bộ file nằm trong thư mục `week-04-nosql-database-design/lab/`. Lý thuyết đầy đủ xem ở `../README.md`.

---

## 🎯 Mục tiêu

Sau lab này bạn sẽ:

- Làm được 4 thao tác CRUD bằng driver `mongodb` v6 (không qua Mongoose, thấy API trần).
- Hiểu **index** giúp gì: so sánh `COLLSCAN` vs `IXSCAN` qua `explain('executionStats')`.
- Nắm quy tắc **ESR** cho compound index.
- Viết **aggregation pipeline** thật (`$match → $group → $sort → $limit → $lookup → $project`).
- Hiểu **schema design**: khi nào embed, khi nào reference, và **bucket pattern** cho time-series.

---

## 🏗️ Dữ liệu mẫu

Database tên **`shop`**, gồm 3 collection (chạy `npm run seed` để tạo):

| Collection | Số lượng | Mô tả |
|-----------|---------|-------|
| `users`    | ~200  | Khách hàng: `name`, `email`, `city`, `createdAt`. |
| `products` | ~50   | Sản phẩm: `name`, `category`, `price`, `stock`. |
| `orders`   | ~2000 | Đơn hàng — xem cấu trúc embed bên dưới. |

Mỗi `order` **EMBED** thẳng mảng `items` (không tách thành collection riêng) và **REFERENCE** tới user bằng `userId`:

```js
{
  _id: ObjectId("..."),
  userId: ObjectId("..."),        // 🔗 reference tới users._id
  items: [                        // 📦 embed: dữ liệu con nằm ngay trong order
    { productId: ObjectId("..."), name: "Chuột 12", qty: 2, price: 350000 }
  ],
  total: 700000,
  status: "completed",            // pending | paid | shipped | completed | cancelled
  createdAt: ISODate("2026-05-20T...")  // rải trong ~90 ngày
}
```

👉 Vì sao embed `items`? Vì items **luôn được đọc/ghi cùng order** và số lượng **có giới hạn** (1–4 món). Đây đúng tiêu chí để embed.

---

## ⚙️ Setup & chạy

Yêu cầu: **Node v20**, **Docker Compose v2** (`docker compose`).

### Bước 1 — Bật MongoDB

```bash
docker compose up -d
```

Đợi tới khi container **healthy** (healthcheck dùng `mongosh ping`):

```bash
docker compose ps
# STATUS phải là:  Up (healthy)
```

### Bước 2 — Cài dependency

```bash
npm install
```

### Bước 3 — Seed dữ liệu (LÀM TRƯỚC TIÊN!)

```bash
npm run seed
```

Output mẫu:

```
✅ Đã kết nối MongoDB tại mongodb://localhost:27017 → database "shop"
🧹 Đã xoá dữ liệu cũ (nếu có).
👤 users:    đã chèn 200
📦 products: đã chèn 50
🧾 orders:   đã chèn 2000

🎉 Seed xong! Giờ chạy: npm run crud  →  npm run agg  →  npm run bucket
```

### Bước 4 — CRUD + Index + Explain

```bash
npm run crud
```

Output mẫu (số có thể khác):

```
======== 2) Index + EXPLAIN trên orders ========

— TRƯỚC index —
   stage = COLLSCAN  (COLLSCAN = quét sạch collection)
   totalDocsExamined = 2000
   nReturned        = 11

🏗️  Đã tạo index: { userId: 1 }
🏗️  Đã tạo compound index: { status: 1, createdAt: -1 }

— SAU index —
   stage = IXSCAN  (IXSCAN = đi theo B-tree index, không quét hết)
   totalDocsExamined = 11
   nReturned        = 11

💡 Nhận xét:
   totalDocsExamined giảm từ 2000 → 11.
```

👉 Đây là **bằng chứng** index hoạt động: cùng query mà số document phải đọc giảm từ 2000 xuống đúng bằng số kết quả.

### Bước 5 — Aggregation

```bash
npm run agg
```

Output mẫu:

```
======== Pipeline 1: Top 5 khách chi nhiều nhất ========
Hạng | Tên khách             | Số đơn | Tổng chi (VND)
-----+-----------------------+--------+----------------
  1  | Trần Linh             |   6    | 18.420.000
  ...

======== Pipeline 2: Doanh thu theo ngày ========
Ngày        | Số đơn | Doanh thu (VND)
------------+--------+----------------
2026-03-17  |   18   | 41.250.000
  ...
```

### Bước 6 — Bucket Pattern

```bash
npm run bucket
```

Output mẫu:

```
======== Cách 1 (ngây thơ): mỗi sự kiện 1 document ========
   → 150 document tí hon trong product_views 😱

======== Cách 2 (Bucket): dồn vào bucket theo sản phẩm + giờ ========
   → 150 lượt xem được gom vào CHỈ 3 bucket 🎉
   bucket #1: count=60, start=..., mảng có 60 phần tử
   bucket #2: count=60, ...
   bucket #3: count=30, ...
```

---

## 🔍 Quan sát thêm (mongosh)

Vào shell Mongo trực tiếp để nghịch:

```bash
docker compose exec mongo mongosh shop
```

Trong `mongosh`:

```js
show collections                       // liệt kê collection

db.orders.findOne()                    // xem 1 order thật (có items embed + userId)

// lấy 1 userId rồi xem query plan
const u = db.orders.findOne().userId
db.orders.find({ userId: u }).explain("executionStats")

db.orders.getIndexes()                 // các index đang có

// thử aggregation ngay trong shell
db.orders.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }])
```

Thoát: `.exit`

---

## 🧠 Khái niệm cốt lõi

### Document model
MongoDB lưu **BSON** (Binary JSON) trong **collection** (≈ table). Mỗi document tối đa **16MB**, có `_id` duy nhất (mặc định `ObjectId` — chứa timestamp nên sortable theo thời gian tạo). Dữ liệu liên quan có thể nằm cùng nhau → đỡ JOIN.

### Embed vs Reference
- **Embed** (nhúng): dữ liệu con nằm trong document cha. Dùng khi: đọc/ghi cùng nhau, quan hệ 1–ít, số lượng có giới hạn. Vd: `items` trong `order`, `addresses` trong `user`. Ưu: 1 lần đọc lấy đủ. Nhược: document phình, khó cập nhật riêng phần con, đụng giới hạn 16MB.
- **Reference** (tham chiếu): lưu `_id` trỏ sang collection khác, JOIN bằng `$lookup`. Dùng khi: quan hệ nhiều–nhiều, dữ liệu con lớn/độc lập/thay đổi riêng. Vd: `userId` trong `order`. Ưu: linh hoạt, không trùng lặp. Nhược: cần nhiều query / `$lookup`.

### Index — COLLSCAN vs IXSCAN
- Không index → **COLLSCAN**: Mongo đọc **từng document** để lọc → chậm khi data lớn.
- Có index → **IXSCAN**: đi theo cây **B-tree** đã sắp xếp, nhảy thẳng tới vùng dữ liệu → `totalDocsExamined` giảm mạnh.
- `explain('executionStats')` cho biết `stage`, `totalDocsExamined`, `nReturned`. Mục tiêu: `totalDocsExamined` xấp xỉ `nReturned`.

### ESR — thứ tự field trong compound index
Compound index xếp field theo: **E**quality → **S**ort → **R**ange.
- **Equality** (`status: "completed"`) đặt **trước** — thu hẹp nhanh nhất.
- **Sort** (`createdAt`) đặt **giữa** — index đã sắp xếp sẵn nên không cần sort lại trong RAM.
- **Range** (`price > 100`, `createdAt > X`) đặt **cuối**.
Sai thứ tự → Mongo có thể bỏ qua phần index hoặc phải sort thủ công.

### Aggregation stages
Pipeline là dây chuyền stage, document chảy qua từng stage:
- `$match` — lọc (đặt **đầu** để cắt dữ liệu sớm, tận dụng index).
- `$group` — gom nhóm + tính tổng/đếm (`$sum`, `$avg`...).
- `$sort`, `$limit`, `$skip` — sắp xếp/phân trang.
- `$lookup` — JOIN sang collection khác.
- `$project` — chọn/đổi tên/tính field xuất ra.
- `$unwind` — bung mảng thành nhiều document (mỗi phần tử 1 doc).
- `$facet` — chạy nhiều pipeline con song song trên cùng input.

### Bucket pattern
Gom nhiều bản ghi nhỏ cùng loại (time-series: log, lượt xem, metric) vào 1 document bucket (mảng `measurements` + `count` + `start`). Lợi: ít document → index nhỏ gọn trong RAM, đọc theo dải thời gian nhanh. Dùng `$push` + `$inc` + `upsert` để dồn vào bucket chưa đầy.

### Replication & Sharding (chỉ để hiểu, lab không chạy)
- **Replication (Replica Set):** nhiều bản sao dữ liệu (1 primary + nhiều secondary). Primary nhận ghi, secondary nhân bản → **high availability** + đọc phân tải. Nếu primary chết, bầu primary mới (failover). Secondary có thể trễ chút → **eventual consistency** khi đọc từ secondary.
- **Sharding:** chia dữ liệu ngang theo **shard key** ra nhiều máy → scale ngang khi 1 máy không chứa nổi. Chọn shard key tốt là quan trọng nhất (xem phần phỏng vấn).

---

## 💪 Bài tập mở rộng

1. **`$facet`** — Trong `02-aggregation.js`, viết 1 pipeline dùng `$facet` để cùng lúc trả về: (a) top 5 khách, (b) phân bố số đơn theo `status`. So sánh với việc chạy 2 query riêng.
2. **Text index + `$text`** — Tạo `db.products.createIndex({ name: "text" })`, rồi `db.products.find({ $text: { $search: "Chuột" } })`. Xem `explain` để thấy stage `TEXT_MATCH`.
3. **`$unwind` items** — Bung mảng `items` trong orders bằng `$unwind: "$items"`, rồi `$group` theo `items.productId` để tính **sản phẩm bán chạy nhất** (tổng `qty`). Gợi ý: `$sum: "$items.qty"`.
4. **Embed → Reference** — Thiết kế lại: tách `items` ra collection `order_items` riêng (mỗi item 1 doc, có `orderId`). Bàn trade-off: khi nào cách này tốt hơn embed? (gợi ý: khi item rất nhiều, cần query/aggregate item độc lập, hoặc item thay đổi thường xuyên).

---

## 🧹 Dọn dẹp

```bash
docker compose down        # dừng container, GIỮ dữ liệu trong volume
docker compose down -v     # dừng + XOÁ luôn volume mongodata (sạch hoàn toàn)
```

---

## 🎤 Liên hệ câu phỏng vấn

**1. Khi nào dùng SQL, khi nào NoSQL?**
SQL khi dữ liệu quan hệ chặt, cần ACID mạnh (thanh toán, đặt hàng), schema ổn định, query ad-hoc đa dạng. NoSQL document khi schema linh hoạt, model theo **access pattern**, dữ liệu dạng cây. Câu trả lời "chín": *"Mặc định tôi chọn PostgreSQL trừ khi có lý do cụ thể — RDBMS hiện đại scale tốt và có JSONB cho dữ liệu linh hoạt."*

**2. Embed vs Reference?**
Embed khi dữ liệu con đọc/ghi cùng cha, số lượng giới hạn (items trong order). Reference khi quan hệ nhiều–nhiều, dữ liệu con lớn/độc lập/đổi riêng, hoặc nguy cơ chạm 16MB. Nguyên tắc: **dữ liệu được truy cập cùng nhau thì lưu cùng nhau**.

**3. Compound index nên xếp field theo thứ tự nào?**
Theo **ESR**: Equality → Sort → Range. Equality thu hẹp trước, Sort tận dụng thứ tự sẵn của index (khỏi sort RAM), Range để cuối. Kiểm chứng bằng `explain` xem có `IXSCAN` và `totalDocsExamined ≈ nReturned` không.

**4. Aggregation khác find() ở đâu?**
`find()` chỉ lọc + chiếu field. `aggregate()` là pipeline nhiều stage, làm được GROUP, JOIN (`$lookup`), biến đổi, tính toán — như SQL `GROUP BY`/`JOIN`. Cần báo cáo/thống kê thì dùng aggregate. Luôn đẩy `$match` lên đầu để cắt dữ liệu sớm và dùng được index.

**5. Chọn shard key thế nào?**
Shard key tốt cần: **cardinality cao** (nhiều giá trị khác nhau để chia đều), **phân tán ghi đều** (tránh hotspot — đừng dùng key tăng đơn điệu như timestamp/ObjectId làm hash thấp → dồn ghi 1 shard), và **khớp với query phổ biến** (để query trúng 1 shard thay vì scatter-gather mọi shard). Ví dụ tốt thường là **hashed key** hoặc compound key gắn với access pattern.

**6. Eventual consistency là gì?**
Trong hệ phân tán/replica, ghi vào primary rồi nhân bản dần sang secondary. Đọc từ secondary có thể thấy dữ liệu **trễ một chút** trước khi mọi bản sao đồng bộ → "eventual consistency" (cuối cùng sẽ nhất quán). Đánh đổi theo **CAP**: ưu tiên Availability + Partition tolerance thì hi sinh Consistency tức thời. MongoDB cho chỉnh qua **write concern** / **read concern** để cân bằng độ bền vs độ trễ.
