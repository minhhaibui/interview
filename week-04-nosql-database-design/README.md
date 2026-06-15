# Tuần 4: NoSQL & Database Design

> 🔬 **Có bản đào sâu!** Xem [`DEEP-DIVE.md`](DEEP-DIVE.md) — cơ chế bên trong, ví dụ nâng cao, bẫy production & câu hỏi phỏng vấn KHÓ hơn cho tuần này.

> 🧪 **Có lab tận tay!** Xem [`lab/LAB.md`](lab/LAB.md) — MongoDB qua `docker compose` + seed 2k đơn hàng để thực hành CRUD/index (COLLSCAN→IXSCAN), aggregation pipeline báo cáo bán hàng, và bucket pattern cho time-series.

## 🎯 Mục tiêu tuần này

- Hiểu rõ sự khác biệt giữa SQL và NoSQL, biết **khi nào chọn cái gì** và lý do (không trả lời cảm tính kiểu "NoSQL nhanh hơn").
- Thành thạo MongoDB: document model, embedded vs reference, aggregation pipeline, index.
- Nắm các **schema design patterns** thực chiến (bucket, outlier, computed) và áp dụng được vào bài toán cụ thể.
- Hiểu replication, sharding, CAP theorem, eventual consistency — trả lời được câu hỏi system design về database scaling.
- Thiết kế được data model hoàn chỉnh cho một hệ thống thực tế (e-commerce) và trình bày được migration/backup strategy.

## 📚 Lý thuyết

### Ngày 1-2: SQL vs NoSQL & MongoDB cơ bản

#### 1. SQL vs NoSQL — khi nào chọn gì?

Đây là câu hỏi phỏng vấn kinh điển. Đừng trả lời "NoSQL scale tốt hơn" — hãy trả lời theo **đặc tính dữ liệu và access pattern**.

**Chọn SQL (PostgreSQL, MySQL) khi:**
- Dữ liệu có quan hệ chặt chẽ, nhiều bảng liên kết, cần JOIN phức tạp (báo cáo, phân tích).
- Cần **ACID transactions** mạnh: chuyển tiền, đặt hàng, inventory — nơi mất consistency là mất tiền.
- Schema ổn định, ít thay đổi, cần ràng buộc toàn vẹn (foreign key, unique, check constraint).
- Truy vấn ad-hoc đa dạng, chưa biết trước access pattern.

**Chọn NoSQL khi:**
- **Document store (MongoDB):** dữ liệu dạng cây/tài liệu, schema linh hoạt thay đổi thường xuyên (catalog sản phẩm với attribute khác nhau theo loại, CMS, user profile).
- **Key-value (Redis, DynamoDB):** access pattern đơn giản get/set theo key, cần latency cực thấp, throughput cực cao (session, cache, leaderboard).
- **Wide-column (Cassandra):** write throughput khổng lồ, time-series, log, dữ liệu phân tán nhiều datacenter.
- **Graph (Neo4j):** quan hệ là trọng tâm — social network, fraud detection, recommendation.

**Nguyên tắc vàng:** SQL model dữ liệu theo **cấu trúc dữ liệu** (normalize trước, query sau). NoSQL model theo **access pattern** (biết query trước, thiết kế schema sau). Trong phỏng vấn, hãy nói: *"Tôi sẽ bắt đầu với PostgreSQL trừ khi có lý do cụ thể, vì RDBMS hiện đại scale rất tốt và Postgres còn có JSONB cho dữ liệu linh hoạt."* — câu trả lời này thể hiện sự trưởng thành kỹ thuật.

#### 2. MongoDB Document Model

MongoDB lưu dữ liệu dạng **BSON** (Binary JSON) trong **collection** (tương đương table). Mỗi document tối đa **16MB**, có `_id` duy nhất (mặc định là ObjectId — 12 bytes chứa timestamp + random + counter, nên sortable theo thời gian tạo).

```js
// Một document — dữ liệu liên quan nằm cùng nhau, không cần JOIN
{
  _id: ObjectId("665f1a..."),
  name: "Nguyễn Văn A",
  email: "a@example.com",
  addresses: [                      // embedded array
    { type: "home", city: "Hà Nội", street: "123 Láng Hạ" },
    { type: "office", city: "HCM", street: "45 NVL" }
  ],
  createdAt: ISODate("2026-06-01T00:00:00Z")
}
```

CRUD cơ bản với Node.js driver / Mongoose:

```js
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.MONGO_URI);
const users = client.db('shop').collection('users');

await users.insertOne({ name: 'A', email: 'a@example.com' });
await users.find({ 'addresses.city': 'Hà Nội' }).limit(10).toArray();
await users.updateOne(
  { email: 'a@example.com' },
  { $set: { name: 'A2' }, $push: { tags: 'vip' } }
);
await users.deleteOne({ email: 'a@example.com' });
```

#### 3. Embedded vs Reference — quyết định quan trọng nhất khi thiết kế MongoDB

**Embed (nhúng)** khi:
- Quan hệ 1-1 hoặc 1-few (ít phần tử, có giới hạn): user + addresses, order + order items.
- Dữ liệu con luôn được đọc cùng dữ liệu cha (read together → store together).
- Dữ liệu con không có ý nghĩa độc lập ngoài cha.

**Reference (tham chiếu)** khi:
- Quan hệ 1-many không giới hạn (unbounded): user → hàng triệu logs. Nhúng sẽ phình document, chạm trần 16MB.
- Dữ liệu được truy cập độc lập hoặc dùng chung bởi nhiều cha (many-to-many): products ↔ categories.
- Dữ liệu con thay đổi thường xuyên mà cha thì không — tránh rewrite document lớn.

```js
// Reference: comment trỏ về post
{ _id: ..., postId: ObjectId("..."), author: "B", content: "..." }

// Join lúc query bằng $lookup (nhưng đừng lạm dụng — $lookup đắt)
db.posts.aggregate([
  { $match: { _id: postId } },
  { $lookup: { from: 'comments', localField: '_id', foreignField: 'postId', as: 'comments' } }
]);
```

**Hybrid — Extended Reference pattern:** nhúng *một phần* dữ liệu hay đọc (vd: order nhúng `{ productId, name, price }` thay vì chỉ `productId`) — vừa tránh $lookup, vừa "đóng băng" giá tại thời điểm mua (đây thực ra là điều bạn MUỐN trong e-commerce).

#### 4. Aggregation Pipeline

Pipeline là chuỗi các stage, output của stage trước là input stage sau:

```js
// Doanh thu theo tháng của các đơn đã thanh toán năm 2026
db.orders.aggregate([
  { $match: { status: 'paid', createdAt: { $gte: ISODate('2026-01-01') } } }, // lọc sớm để dùng index
  { $unwind: '$items' },
  { $group: {
      _id: { month: { $month: '$createdAt' } },
      revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } },
      orders: { $addToSet: '$_id' }
  }},
  { $project: { month: '$_id.month', revenue: 1, orderCount: { $size: '$orders' }, _id: 0 } },
  { $sort: { month: 1 } }
]);
```

Các stage cần thuộc: `$match`, `$group`, `$project`, `$sort`, `$limit`, `$skip`, `$unwind`, `$lookup`, `$facet` (chạy nhiều pipeline song song — hay dùng cho pagination + count), `$merge`/`$out` (ghi kết quả ra collection — nền tảng của Computed pattern).

**Tip phỏng vấn:** luôn đặt `$match` và `$sort` (có index hỗ trợ) lên đầu pipeline — chỉ các stage đầu mới tận dụng được index.

#### 5. Index trong MongoDB

- **Single field:** `db.users.createIndex({ email: 1 })`. Thêm `{ unique: true }` cho ràng buộc duy nhất.
- **Compound index:** `{ status: 1, createdAt: -1 }` — tuân theo quy tắc **ESR (Equality, Sort, Range)**: field so sánh bằng đứng trước, field sort ở giữa, field range cuối cùng.
- **Multikey index:** tự động khi index field là array (vd `tags`). Lưu ý: một compound index chỉ được tối đa 1 field array.
- **Text index / Atlas Search:** full-text search. **TTL index:** `{ createdAt: 1 }, { expireAfterSeconds: 3600 }` — tự xoá document (session, OTP). **Partial index:** chỉ index document thoả điều kiện — nhỏ hơn, nhanh hơn.
- **Covered query:** query chỉ cần đọc index, không đụng document → cực nhanh.

```js
// Đọc query plan — kỹ năng bắt buộc
db.orders.find({ status: 'paid' }).sort({ createdAt: -1 }).explain('executionStats');
// Nhìn: stage IXSCAN (tốt) vs COLLSCAN (xấu), totalKeysExamined vs nReturned (tỉ lệ ~1:1 là tốt)
```

### Ngày 3-4: Schema Design Patterns, Replication & Sharding

#### 1. Schema Design Patterns

**Bucket Pattern** — gom nhiều bản ghi nhỏ vào một document. Kinh điển cho time-series/IoT:

```js
// Thay vì 1 document/1 lần đo (hàng tỉ docs), gom theo sensor + giờ
{
  sensorId: "s-01",
  hour: ISODate("2026-06-10T09:00:00Z"),
  count: 58,
  measurements: [
    { ts: ISODate("...09:00:12Z"), temp: 27.1 },
    { ts: ISODate("...09:01:12Z"), temp: 27.3 }
  ],
  sumTemp: 1571.2   // pre-aggregate luôn để tính avg nhanh
}
// Ghi bằng upsert + $push, giới hạn kích thước bucket bằng điều kiện count
db.readings.updateOne(
  { sensorId: 's-01', hour: hourStart, count: { $lt: 200 } },
  { $push: { measurements: m }, $inc: { count: 1, sumTemp: m.temp } },
  { upsert: true }
);
```
Lợi ích: giảm số document và index entry hàng trăm lần, đọc theo khoảng thời gian chỉ chạm vài document.

**Outlier Pattern** — thiết kế cho trường hợp phổ biến, xử lý riêng ngoại lệ. Vd: sách trên Amazon nhúng danh sách người mua — 99.9% sách có < 1000 người mua thì nhúng OK, nhưng Harry Potter có hàng triệu. Giải pháp: nhúng tối đa N phần tử, khi tràn thì set cờ `hasOverflow: true` và đẩy phần dư sang collection overflow. Application code kiểm tra cờ để query thêm. → Không bắt 99.9% trường hợp trả giá cho 0.1% ngoại lệ.

**Computed Pattern** — tính trước kết quả đắt đỏ lúc ghi (hoặc định kỳ), đọc thì lấy sẵn. Vd: thay vì `$avg` toàn bộ reviews mỗi lần load trang sản phẩm, lưu `ratingSum`, `ratingCount` ngay trên product và `$inc` khi có review mới:

```js
db.products.updateOne({ _id: pid }, { $inc: { ratingSum: 5, ratingCount: 1 } });
// avg = ratingSum / ratingCount — O(1) khi đọc
```
Đánh đổi: dữ liệu tính sẵn có thể lệch nhẹ (eventual) và phải lo chuyện đồng bộ — chấp nhận được khi read >> write.

Các pattern khác nên biết tên: **Schema Versioning** (field `schemaVersion` trong document, migrate dần), **Subset** (nhúng 10 review mới nhất, phần còn lại reference), **Polymorphic** (nhiều loại document chung collection, phân biệt bằng `type`).

#### 2. Replication — Replica Set

Một **replica set** gồm 1 **primary** (nhận mọi write) + các **secondary** (sao chép qua **oplog**). Tối thiểu 3 node (hoặc 2 node + 1 arbiter — không khuyến nghị production). Khi primary chết, các node bầu cử (Raft-like) chọn primary mới — cần **đa số phiếu**, vì vậy luôn deploy **số lẻ** node voting.

**Write Concern** — write được coi là thành công khi nào:
- `w: 1` (ack từ primary — mặc định cũ), `w: 'majority'` (đa số node đã ghi — mặc định hiện nay, chống mất dữ liệu khi failover/rollback), `w: 0` (fire-and-forget), `j: true` (đã flush journal xuống disk).

**Read Preference** — đọc từ đâu:
- `primary` (mặc định, consistency cao nhất), `primaryPreferred`, `secondary` / `secondaryPreferred` (giảm tải primary — chấp nhận **stale read** do replication lag), `nearest` (latency thấp nhất, hay dùng multi-region).

**Read Concern:** `local`, `majority` (chỉ đọc dữ liệu đã được đa số ack — không bị rollback), `linearizable`.

```js
// ioredis-style URI cho Mongo: chỉ định write concern + read preference
const client = new MongoClient(
  'mongodb://n1,n2,n3/shop?replicaSet=rs0&w=majority&readPreference=secondaryPreferred'
);
```

**Câu hỏi bẫy thường gặp:** *"Đọc từ secondary có phải cách scale read tốt nhất?"* — Không hẳn: secondary cũng phải replay toàn bộ write, và bạn nhận stale data. Scale read đúng bài hơn là cache hoặc sharding.

#### 3. Sharding

Sharding = chia dữ liệu **theo chiều ngang** ra nhiều replica set (shard). Kiến trúc: **mongos** (router) + **config servers** (metadata) + các **shard**. Dữ liệu chia thành **chunk** theo **shard key**.

**Chọn shard key — quyết định gần như không thể đảo ngược:**
- **High cardinality:** nhiều giá trị khác nhau (email tốt, `gender` tệ).
- **Even distribution:** tránh **hot shard**. Shard key tăng đơn điệu (`_id` ObjectId, timestamp) với **ranged sharding** → mọi insert dồn vào shard cuối.
- **Query isolation:** query phổ biến nên chứa shard key để mongos route đến đúng 1 shard (**targeted query**); thiếu shard key → **scatter-gather** đến mọi shard.

**Hashed vs Ranged:**
- **Hashed:** hash giá trị key → phân bố write cực đều. Nhược: mất khả năng range query hiệu quả trên key (vd query theo khoảng thời gian thành scatter-gather).
- **Ranged:** giữ dữ liệu gần nhau theo giá trị → range query hiệu quả. Nhược: dễ hot shard nếu key tăng đơn điệu.
- Compound shard key kiểu `{ tenantId: 1, timestamp: 1 }` thường là lời giải đẹp: phân bố theo tenant, range query theo thời gian trong tenant.

#### 4. CAP Theorem & Eventual Consistency

**CAP:** khi xảy ra **network Partition** (P — bắt buộc phải chịu trong hệ phân tán), bạn phải chọn giữa **Consistency** (mọi read thấy write mới nhất) và **Availability** (mọi request đều được trả lời). 
- MongoDB, HBase: thiên **CP** — khi partition, minority side từ chối write để giữ consistency.
- Cassandra, DynamoDB (cấu hình mặc định): thiên **AP** — luôn trả lời, chấp nhận dữ liệu tạm lệch, hoà giải sau (last-write-wins, vector clock).

**Lưu ý phỏng vấn:** CAP chỉ nói về lúc *có* partition. Lúc bình thường, trade-off thực tế là **latency vs consistency** (xem PACELC: *if Partition then A or C, Else Latency or Consistency*). Nói được PACELC là điểm cộng lớn.

**Eventual consistency** thực tế: bạn ghi xong đọc lại từ replica chưa kịp sync → không thấy dữ liệu của chính mình. Cách xử lý: **read-your-own-writes** (đọc từ primary trong N giây sau khi user vừa ghi, hoặc session token), version số, hoặc đơn giản là UI optimistic update.

### Ngày 5-6: Database Scaling, Data Modeling thực tế, Migration & Backup

#### 1. Database Scaling tổng quát (áp dụng cả SQL)

Thứ tự "leo thang" khi DB quá tải — trình bày đúng thứ tự này trong phỏng vấn system design:

1. **Tối ưu trước:** index, sửa query N+1, connection pooling, denormalize có chọn lọc.
2. **Caching:** Redis cho hot data — giải quyết 80% vấn đề read-heavy.
3. **Vertical scaling:** tăng CPU/RAM — đơn giản, có trần.
4. **Read replicas:** primary nhận write, replicas nhận read (streaming replication trong Postgres). Lưu ý replication lag → stale read; route read/write ở tầng app:

```js
// Knex/Sequelize: tách read/write connection
const sequelize = new Sequelize('db', null, null, {
  dialect: 'postgres',
  replication: {
    write: { host: 'primary.db' },
    read: [{ host: 'replica1.db' }, { host: 'replica2.db' }]
  }
});
```

5. **Partitioning (trong 1 server):** chia bảng lớn thành partition theo range/list/hash (Postgres declarative partitioning theo tháng cho bảng orders). Lợi: query prune partition, drop partition cũ tức thì thay vì DELETE.
6. **Sharding (nhiều server):** bước cuối cùng vì độ phức tạp cao — mất cross-shard JOIN, distributed transaction, resharding đau đớn. Với SQL có thể: shard ở tầng app (route theo `user_id % N`), dùng middleware (Vitess, Citus), hoặc chuyển sang NewSQL (CockroachDB, Spanner).
7. **Tách theo chức năng (functional partitioning):** mỗi service một DB (microservices) — orders DB riêng, users DB riêng.

#### 2. Data Modeling thực tế: thiết kế DB cho E-commerce

Bài toán: hệ e-commerce với users, products (nhiều loại attribute), cart, orders, inventory, reviews. Lời giải hybrid hay được kỳ vọng:

**Dùng PostgreSQL cho phần "tiền":**
```sql
-- Orders cần ACID: trừ inventory + tạo order + ghi payment phải atomic
CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',   -- pending|paid|shipped|cancelled
  total_amount NUMERIC(12,2) NOT NULL,      -- NUMERIC, không bao giờ dùng FLOAT cho tiền
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE order_items (
  order_id BIGINT REFERENCES orders(id),
  product_id BIGINT NOT NULL,
  product_name TEXT NOT NULL,   -- snapshot tên + giá tại thời điểm mua
  unit_price NUMERIC(12,2) NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0)
);
-- Chống oversell: UPDATE có điều kiện, atomic
UPDATE inventory SET stock = stock - $qty
WHERE product_id = $pid AND stock >= $qty;  -- rowCount = 0 nghĩa là hết hàng
```

**Dùng MongoDB cho catalog (schema linh hoạt):**
```js
// Áo thun và laptop có attribute hoàn toàn khác nhau — document model toả sáng
{ _id, sku: 'TSHIRT-01', type: 'apparel', name: 'Áo thun', price: 199000,
  attrs: { sizes: ['S','M','L'], material: 'cotton' },
  ratingSum: 4210, ratingCount: 950 }       // Computed pattern
{ _id, sku: 'LAPTOP-99', type: 'laptop', name: 'ThinkPad', price: 25000000,
  attrs: { cpu: 'i7', ram: '32GB', ports: ['USB-C','HDMI'] } }
```

**Cart:** Redis (TTL tự dọn cart bỏ quên) hoặc Mongo. **Reviews:** Mongo, reference về product + Subset pattern (nhúng 5 review mới nhất vào product). **Search:** Elasticsearch/Atlas Search, sync qua CDC.

Điểm cần nói khi phỏng vấn: ranh giới consistency (chỗ nào ACID, chỗ nào eventual), snapshot dữ liệu trên order, chống oversell, và cách sync dữ liệu giữa các store (event/outbox — học ở tuần Kafka).

#### 3. Migration Strategy

- **Schema migration có version:** dùng tool (Knex migrations, Prisma Migrate, node-pg-migrate, migrate-mongo). Mỗi migration có `up`/`down`, chạy tuần tự, lưu trạng thái trong bảng `migrations`. Không bao giờ sửa migration đã chạy trên production — viết migration mới.
- **Zero-downtime migration — expand/contract pattern:** (1) *Expand:* thêm cột/bảng mới, code ghi cả cũ lẫn mới (dual-write), backfill dữ liệu cũ theo batch; (2) chuyển read sang mới; (3) *Contract:* xoá code ghi cũ, xoá cột cũ. Mỗi bước deploy riêng, rollback được.
- Lưu ý thực chiến: `ALTER TABLE ... ADD COLUMN ... NOT NULL DEFAULT` trên bảng lớn từng lock cả bảng (Postgres < 11); thêm index trên production phải dùng `CREATE INDEX CONCURRENTLY`; backfill phải chia batch + sleep để không giết replica lag.
- **MongoDB:** Schema Versioning pattern — đọc document cũ vẫn chạy được, migrate lazy khi document được ghi lại, hoặc background job.

#### 4. Backup & Recovery

- Hai chỉ số phải nói được: **RPO** (Recovery Point Objective — chấp nhận mất tối đa bao nhiêu dữ liệu) và **RTO** (Recovery Time Objective — bao lâu phải khôi phục xong).
- **Logical backup:** `pg_dump`, `mongodump` — portable, chậm với DB lớn, restore lâu.
- **Physical backup:** snapshot disk/filesystem, `pg_basebackup` — nhanh, restore nhanh.
- **PITR (Point-in-Time Recovery):** base backup + WAL archiving (Postgres) / oplog (Mongo) → khôi phục về *đúng một thời điểm* (vd: 1 phút trước khi dev lỡ tay `DELETE` không `WHERE`). Replica KHÔNG phải backup — lệnh DELETE replicate sang replica ngay lập tức.
- Quy tắc **3-2-1:** 3 bản, 2 loại media, 1 bản off-site. Và quan trọng nhất: **backup chưa được test restore thì coi như không có backup** — lên lịch restore drill định kỳ.

## 💬 Top 15 câu hỏi phỏng vấn thường gặp

**Q1: Khi nào bạn chọn NoSQL thay vì SQL?**
**A:** Tôi chọn theo đặc tính dữ liệu và access pattern: NoSQL khi schema linh hoạt/thay đổi nhiều, access pattern biết trước và đơn giản, cần scale ngang write throughput lớn. SQL khi cần ACID mạnh, quan hệ phức tạp, query ad-hoc. Mặc định tôi bắt đầu với PostgreSQL và chỉ chuyển khi có lý do cụ thể.

**Q2: Embedded vs Reference trong MongoDB — quyết định thế nào?**
**A:** "Dữ liệu được đọc cùng nhau thì lưu cùng nhau." Embed cho quan hệ 1-few có giới hạn và con không truy cập độc lập; Reference cho quan hệ unbounded, many-to-many, hoặc con thay đổi thường xuyên. Cẩn thận giới hạn 16MB/document và array phình to làm chậm mọi update.

**Q3: Aggregation pipeline là gì? Làm sao tối ưu?**
**A:** Là chuỗi stage xử lý dữ liệu tuần tự ($match, $group, $project...). Tối ưu bằng cách đặt $match/$sort có index hỗ trợ lên đầu pipeline (chỉ stage đầu dùng được index), $project sớm để giảm dữ liệu qua các stage, và tránh $lookup trên dataset lớn.

**Q4: Quy tắc ESR khi tạo compound index là gì?**
**A:** Equality–Sort–Range: field lọc bằng đứng trước, field sort ở giữa, field lọc theo khoảng cuối cùng. Vd query `{status: 'paid', amount: {$gt: 100}}` sort theo `createdAt` → index `{status: 1, createdAt: -1, amount: 1}`.

**Q5: Write concern `w: majority` giải quyết vấn đề gì?**
**A:** Đảm bảo write đã được đa số node trong replica set xác nhận trước khi báo thành công. Nếu chỉ `w: 1` mà primary chết trước khi replicate, primary mới được bầu không có write đó → write bị rollback, mất dữ liệu dù client đã nhận success.

**Q6: Đọc từ secondary có rủi ro gì?**
**A:** Stale read do replication lag — user vừa update profile, đọc lại từ secondary thấy dữ liệu cũ. Xử lý bằng read-your-own-writes (đọc primary sau khi vừa ghi), causal consistency session, hoặc chỉ route các read chịu được stale (analytics, listing) sang secondary.

**Q7: Tiêu chí chọn shard key tốt?**
**A:** Ba tiêu chí: cardinality cao, phân bố write đều (tránh key tăng đơn điệu với ranged sharding → hot shard), và xuất hiện trong query phổ biến để được targeted query thay vì scatter-gather. Compound key như `{tenantId, timestamp}` thường cân bằng tốt cả ba.

**Q8: Hashed sharding khác ranged sharding thế nào?**
**A:** Hashed phân bố write đều tuyệt đối nhưng range query trên shard key thành scatter-gather. Ranged giữ dữ liệu liền kề → range query hiệu quả nhưng dễ hot shard với key tăng đơn điệu. Chọn theo workload: write-heavy đều → hashed; range query nhiều → ranged với key được thiết kế cẩn thận.

**Q9: Giải thích CAP theorem và áp dụng thực tế?**
**A:** Khi có network partition, hệ phân tán phải chọn Consistency (từ chối phục vụ phía minority) hoặc Availability (phục vụ tiếp, chấp nhận lệch dữ liệu). MongoDB thiên CP, Cassandra thiên AP. Thực tế nên nói thêm PACELC: ngay cả khi không partition, vẫn phải đánh đổi latency vs consistency.

**Q10: Eventual consistency gây vấn đề gì cho UX và xử lý ra sao?**
**A:** User ghi xong đọc lại không thấy dữ liệu của mình (đọc trúng replica chưa sync). Xử lý: read-your-own-writes — pin read về primary trong vài giây sau write, hoặc dùng session/causal token; phía UI có thể optimistic update.

**Q11: Read replica của Postgres giúp gì và không giúp gì?**
**A:** Giúp scale read và làm standby cho HA. Không giúp scale write (mọi write vẫn qua primary, replica vẫn replay toàn bộ WAL) và không phải backup (DELETE nhầm replicate ngay). Phải xử lý replication lag ở tầng app.

**Q12: Partitioning khác sharding thế nào?**
**A:** Partitioning chia bảng thành nhiều phần trong cùng một server (Postgres partition theo tháng) — lợi về query pruning và drop dữ liệu cũ. Sharding chia dữ liệu ra nhiều server — scale cả write/storage nhưng mất cross-shard JOIN và transaction, phức tạp hơn nhiều.

**Q13: Làm sao chống oversell inventory khi nhiều người mua cùng lúc?**
**A:** Atomic conditional update: `UPDATE inventory SET stock = stock - qty WHERE product_id = ? AND stock >= qty` rồi kiểm tra rowCount — DB tự lock row nên không có race. Tránh kiểu read-check-write ở tầng app. Scale lớn hơn thì reserve qua Redis atomic ops hoặc queue.

**Q14: Zero-downtime migration làm thế nào?**
**A:** Expand/contract: thêm schema mới song song schema cũ, dual-write, backfill theo batch, chuyển read sang mới, cuối cùng mới xoá cũ. Mỗi bước deploy riêng và rollback được. Index mới trên Postgres phải `CREATE INDEX CONCURRENTLY` để không lock bảng.

**Q15: RPO và RTO là gì? Replica có thay được backup không?**
**A:** RPO là lượng dữ liệu tối đa chấp nhận mất, RTO là thời gian tối đa để khôi phục. Replica không thay được backup vì thao tác phá hoại (DELETE/DROP) replicate ngay lập tức — cần backup định kỳ + PITR (WAL/oplog) để quay về thời điểm trước sự cố, và phải test restore định kỳ.

## 💪 Bài tập thực hành (bắt buộc)

### Bài 1: CRUD + Index với MongoDB driver (cơ bản)
**Đề:** Viết script Node.js (driver `mongodb` thuần, không Mongoose) seed 100.000 documents `users` (`name`, `email` unique, `age`, `city`, `createdAt`). Viết query: tìm user theo email; tìm users theo `city` + sort `createdAt` desc + phân trang.
**Yêu cầu output:** In kết quả `explain('executionStats')` TRƯỚC và SAU khi tạo index phù hợp — phải thấy COLLSCAN → IXSCAN và `totalDocsExamined` giảm mạnh. Ghi nhận thời gian thực thi 2 trường hợp.
**Gợi ý:** dùng `@faker-js/faker` để seed, `insertMany` theo batch 1000; index `{ city: 1, createdAt: -1 }` theo quy tắc ESR.

### Bài 2: Aggregation pipeline cho báo cáo bán hàng (trung bình)
**Đề:** Seed collection `orders` (50.000 docs: `userId`, `items: [{sku, price, qty}]`, `status`, `createdAt` rải trong 12 tháng). Viết 3 aggregation: (a) doanh thu + số đơn theo tháng (chỉ đơn `paid`); (b) top 10 SKU bán chạy theo quantity; (c) một query duy nhất dùng `$facet` trả về cả danh sách đơn phân trang lẫn tổng số đơn.
**Yêu cầu output:** Kết quả in ra console dạng bảng (`console.table`), pipeline (a) phải có `$match` đứng đầu và bạn chứng minh nó dùng index qua explain.
**Gợi ý:** (a) cần `$unwind` items trước khi `$group`; (b) `$group` theo `items.sku` rồi `$sort` + `$limit`.

### Bài 3: Bucket pattern cho time-series (trung bình–khó)
**Đề:** Mô phỏng 10 sensor gửi nhiệt độ mỗi giây trong "1 giờ" (giả lập, không cần chạy real-time). Cài đặt theo 2 cách: (1) naive — mỗi reading một document; (2) bucket — gom theo `sensorId + phút`, mỗi bucket tối đa 60 readings, kèm `sumTemp`/`count` pre-aggregated.
**Yêu cầu output:** So sánh 2 cách về: tổng số documents, kích thước collection (`db.collection.stats()`), thời gian query "nhiệt độ trung bình mỗi phút của sensor X trong 1 giờ". Viết kết luận 3-5 dòng.
**Gợi ý:** bucket dùng `updateOne` với `upsert: true` và filter `count: { $lt: 60 }`.

### Bài 4: Replica set + write concern + failover (khó)
**Đề:** Dựng replica set 3 node bằng Docker Compose (3 container `mongo` + `rs.initiate`). Viết script Node.js: (a) ghi liên tục 1 doc/giây với `w: 1` và đo latency; lặp lại với `w: 'majority'`; (b) trong khi script đang ghi, `docker stop` container primary và quan sát: app lỗi gì, bao lâu thì tự phục hồi (driver retry + election), có mất write nào không (đếm số doc thực tế vs số lần báo success).
**Yêu cầu output:** Bảng so sánh latency `w:1` vs `w:majority`; log timeline của sự kiện failover; trả lời: `retryWrites=true` đã cứu được những lỗi nào?
**Gợi ý:** connection string phải liệt kê cả 3 host + `replicaSet=rs0`; bọc write trong try/catch ghi lại timestamp lỗi.

### Bài 5: Thiết kế DB e-commerce hoàn chỉnh (khó — chuẩn bị cho bài test)
**Đề:** Thiết kế và cài đặt data layer cho mini e-commerce: catalog (MongoDB — ít nhất 2 loại sản phẩm có attrs khác nhau), orders + inventory (PostgreSQL với transaction), API Express: `POST /orders` (kiểm tra + trừ kho atomic trong transaction, snapshot giá vào order_items), `GET /products/:id` (kèm avg rating dùng Computed pattern), `POST /products/:id/reviews` (ghi review + `$inc` ratingSum/ratingCount).
**Yêu cầu output:** Chạy script bắn 50 request `POST /orders` **đồng thời** (Promise.all) mua cùng 1 sản phẩm chỉ còn 30 cái → đúng 30 đơn thành công, 20 đơn nhận lỗi `OUT_OF_STOCK`, stock cuối = 0 (không âm).
**Gợi ý:** dùng `pg` với `BEGIN/COMMIT`, update kho bằng conditional update và check `rowCount`; viết file `DESIGN.md` ngắn giải thích tại sao chia Postgres/Mongo như vậy.

## 📝 Bài test cuối tuần

### Phần 1: Quiz 15 câu trắc nghiệm

**Câu 1:** Giới hạn kích thước tối đa của một document MongoDB là?
A. 4MB  B. 16MB  C. 64MB  D. Không giới hạn

**Câu 2:** Trường hợp nào sau đây NÊN dùng reference thay vì embed?
A. Order và order items  B. User và 2-3 addresses  C. User và hàng triệu activity logs  D. Bài viết và phần metadata SEO của nó

**Câu 3:** Stage nào nên đặt ĐẦU aggregation pipeline để tận dụng index?
A. $project  B. $group  C. $match  D. $unwind

**Câu 4:** Query `{ status: 'paid', total: { $gt: 100 } }` sort theo `createdAt`. Compound index tối ưu theo quy tắc ESR là?
A. `{ status: 1, total: 1, createdAt: 1 }`  B. `{ status: 1, createdAt: 1, total: 1 }`  C. `{ createdAt: 1, status: 1, total: 1 }`  D. `{ total: 1, status: 1, createdAt: 1 }`

**Câu 5:** Write concern `w: 'majority'` chủ yếu bảo vệ khỏi điều gì?
A. Query chậm  B. Write bị rollback khi primary failover  C. Disk đầy  D. Replication lag khi đọc secondary

**Câu 6:** Replica set MongoDB nên có số node voting là số lẻ vì?
A. Tiết kiệm chi phí  B. Election cần đa số phiếu, số chẵn dễ bế tắc/giảm khả năng chịu lỗi  C. Oplog chỉ hỗ trợ số lẻ  D. Số chẵn làm chậm replication

**Câu 7:** Shard key là `createdAt` (timestamp) với ranged sharding. Vấn đề lớn nhất là?
A. Không tạo được index  B. Mọi insert dồn vào một shard (hot shard)  C. Không query được theo thời gian  D. Document vượt 16MB

**Câu 8:** Theo CAP theorem, khi xảy ra network partition, hệ CP sẽ?
A. Luôn trả lời mọi request  B. Phía minority từ chối phục vụ để giữ consistency  C. Tự sửa dữ liệu lệch bằng vector clock  D. Chuyển hết sang chế độ đọc

**Câu 9:** Bucket pattern phù hợp nhất cho loại dữ liệu nào?
A. Hồ sơ người dùng  B. Dữ liệu time-series/IoT tần suất cao  C. Danh mục sản phẩm  D. Cấu hình hệ thống

**Câu 10:** Computed pattern đánh đổi điều gì?
A. Read chậm hơn để write nhanh hơn  B. Write phức tạp hơn + dữ liệu có thể lệch nhẹ, đổi lấy read O(1)  C. Tốn index hơn  D. Mất khả năng aggregation

**Câu 11:** Read replica của PostgreSQL KHÔNG giúp được việc gì?
A. Scale read  B. Standby cho HA  C. Scale write throughput  D. Giảm tải báo cáo analytics khỏi primary

**Câu 12:** Cách đúng để chống oversell khi trừ kho?
A. SELECT stock rồi if (stock >= qty) thì UPDATE  B. UPDATE ... SET stock = stock - qty WHERE stock >= qty và kiểm tra rowCount  C. Đặt isolation level READ UNCOMMITTED  D. Cache stock trong biến toàn cục của Node.js

**Câu 13:** "Expand/contract" trong zero-downtime migration nghĩa là?
A. Tăng rồi giảm kích thước connection pool  B. Thêm schema mới chạy song song, dual-write + backfill, chuyển read, rồi mới xoá schema cũ  C. Nén dữ liệu trước khi migrate  D. Scale out rồi scale in số replica

**Câu 14:** PITR (Point-in-Time Recovery) cần những gì?
A. Chỉ cần read replica  B. Base backup + WAL/oplog archive  C. Chỉ cần snapshot disk hằng tuần  D. RAID 10

**Câu 15:** TTL index trong MongoDB dùng để làm gì?
A. Tăng tốc range query  B. Tự động xoá document sau khoảng thời gian (session, OTP, cache)  C. Giới hạn thời gian chạy query  D. Hết hạn connection trong pool

<details><summary>Đáp án</summary>

1. **B** — 16MB là giới hạn BSON document; dữ liệu lớn hơn dùng GridFS hoặc thiết kế lại schema.
2. **C** — quan hệ unbounded sẽ phình document không kiểm soát; A/B/D là 1-few đọc cùng nhau, nên embed.
3. **C** — chỉ các stage đầu pipeline tận dụng được index; $match sớm giảm dữ liệu cho các stage sau.
4. **B** — ESR: Equality (`status`) → Sort (`createdAt`) → Range (`total`).
5. **B** — đảm bảo đa số node có write; nếu chỉ `w:1`, primary chết trước khi replicate thì write bị rollback.
6. **B** — election cần majority; 4 node cũng chỉ chịu được 1 node chết như 3 node, lại tốn thêm tài nguyên.
7. **B** — key tăng đơn điệu khiến chunk "nóng" luôn nằm cuối range → một shard gánh toàn bộ insert.
8. **B** — CP hy sinh availability ở phía không đủ quorum để dữ liệu không phân nhánh.
9. **B** — gom nhiều điểm đo vào một document giảm mạnh số docs/index entries, đọc theo khoảng thời gian rất nhanh.
10. **B** — tính trước lúc ghi (write phức tạp hơn, có thể lệch nhẹ) để đọc lấy sẵn O(1).
11. **C** — mọi write vẫn phải qua primary và mọi replica vẫn replay toàn bộ write.
12. **B** — conditional update là atomic ở DB, loại bỏ race; A là read-check-write kinh điển bị race condition.
13. **B** — đúng định nghĩa expand/contract, mỗi bước rollback được.
14. **B** — backup nền + chuỗi WAL/oplog cho phép replay về đúng một thời điểm.
15. **B** — background thread của MongoDB xoá document có field thời gian quá hạn `expireAfterSeconds`.

</details>

### Phần 2: Bài thực hành chấm điểm

**Đề bài: Thiết kế và cài đặt data layer cho hệ thống đặt vé sự kiện (event ticketing)**

Yêu cầu chức năng: quản lý events (nhiều loại: concert/workshop/webinar với attrs khác nhau), mỗi event có nhiều hạng vé với số lượng giới hạn; user đặt vé (1 order nhiều vé, không được oversell); trang event hiển thị số vé còn lại + rating trung bình; admin xem báo cáo doanh thu theo tháng/theo event; activity log lượng lớn (mỗi view/click một record).

Deliverables: (1) document thiết kế ngắn (chọn DB nào cho phần nào + lý do, schema/collection cụ thể, index); (2) code Node.js chạy được: API đặt vé + script test concurrency 100 request mua đồng thời hạng vé còn 50 chỗ; (3) aggregation/SQL cho báo cáo doanh thu; (4) nêu migration plan khi cần thêm field `seatNumber` vào vé đã bán, và backup strategy (RPO 5 phút).

**Checklist tiêu chí chấm điểm:**

- [ ] Chọn đúng store cho từng loại dữ liệu và **giải thích được lý do** (transaction cho booking, document model cho event attrs linh hoạt, bucket/TTL cho activity log)
- [ ] Schema có snapshot giá vé tại thời điểm mua (không reference giá động)
- [ ] Chống oversell bằng atomic conditional update hoặc transaction — test 100 concurrent requests cho đúng 50 success, stock cuối = 0
- [ ] Index được thiết kế theo query thực tế, có giải thích bằng explain (không index bừa)
- [ ] Báo cáo doanh thu dùng aggregation pipeline/SQL GROUP BY đúng, có $match đầu pipeline
- [ ] Activity log dùng bucket pattern hoặc TTL/partition — giải thích được tại sao không lưu naive
- [ ] Migration plan theo expand/contract, không lock bảng, rollback được
- [ ] Backup strategy nêu được RPO/RTO, PITR, và lý do replica không thay được backup
- [ ] Code có error handling (transaction rollback, retry), không có race condition kiểu read-check-write

## ✅ Tiêu chí pass tuần

- Quiz ≥ 12/15
- Hoàn thành tất cả bài tập bắt buộc (bài 4 phải có log failover thực tế, bài 5 phải pass test concurrency)
- Bài thực hành đạt ≥ 7/9 mục checklist, trong đó mục chống oversell và chọn store là **bắt buộc**
- Giải thích được bằng lời (không nhìn tài liệu) 3 chủ đề: embedded vs reference, cách chọn shard key, CAP/PACELC — tự ghi âm 2 phút mỗi chủ đề và nghe lại
