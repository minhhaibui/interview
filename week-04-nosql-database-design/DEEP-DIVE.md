# 🔬 Đào sâu — Tuần 4: NoSQL & Database Design

> README đã dạy *cái gì* và *khi nào*; tài liệu này mổ xẻ *bên trong nó hoạt động thế nào* — storage engine, B-tree, election, balancer — để bạn trả lời được câu hỏi "tại sao" trong phỏng vấn senior.

## 🧠 Cơ chế bên trong

### 1. WiredTiger storage engine — cái gì xảy ra khi bạn ghi 1 document?

WiredTiger là storage engine mặc định từ MongoDB 3.2. Hiểu nó là chìa khoá giải thích hành vi lock, memory và durability.

**Document-level concurrency (không phải collection-level).** WiredTiger dùng **optimistic concurrency control + MVCC**: hai ghi vào *hai document khác nhau* trong cùng collection chạy song song, không chặn nhau. Chỉ khi hai transaction đụng cùng một document mới có **write conflict** — WiredTiger phát hiện, **abort** một bên và server tự **retry trong suốt** (bạn không thấy). Đây là lý do throughput ghi cao hơn nhiều so với MMAPv1 (engine cũ, lock cấp collection/database).

**Snapshot & MVCC.** Mỗi transaction nhìn thấy một **snapshot nhất quán** tại thời điểm bắt đầu. WiredTiger giữ nhiều version của document trong memory; reader đọc version phù hợp với snapshot của mình mà không bị writer chặn (reader không block writer, writer không block reader).

**Checkpoint.** Cứ ~60 giây (hoặc khi journal đạt 2GB), WiredTiger ghi một **checkpoint** — một snapshot bền vững toàn bộ dataset xuống disk. Giữa hai checkpoint, dữ liệu đã commit nằm ở đâu? → **journal**.

**Journal (write-ahead log).** Mỗi write được ghi vào **journal** (WAL) trước, buffer journal được flush xuống disk mỗi ~100ms (hoặc ngay nếu `j: true`). Nếu server crash giữa hai checkpoint, lúc khởi động lại WiredTiger **replay journal** từ checkpoint gần nhất → không mất write đã được journal. Đây chính là ý nghĩa `j: true` trong write concern: "chờ tới khi write nằm an toàn trong journal trên disk".

```js
// w: 'majority' + j: true = bền vững nhất: đa số node đã ghi VÀ đã flush journal
await coll.insertOne(doc, { writeConcern: { w: 'majority', j: true, wtimeout: 5000 } });
// wtimeout BẮT BUỘC có trong production: nếu không đủ node majority, write sẽ treo VÔ HẠN
```

**Cache.** WiredTiger cache mặc định = `max(50% RAM - 1GB, 256MB)`. Đây là nơi giữ working set (B-tree pages, version MVCC). Khác với filesystem cache của OS — Mongo dùng cả hai. Nếu working set > cache → page eviction liên tục → đọc đĩa nhiều → latency tăng. Dấu hiệu trong `db.serverStatus().wiredTiger.cache`: `bytes read into cache` cao bất thường.

### 2. Index là B-tree — vì sao ESR đúng

Index MongoDB là **B-tree** (chính xác là B+-tree-like). Mỗi entry = `{ giá trị field → con trỏ tới document}`, sắp xếp theo thứ tự field. Hiểu điều này giải thích trọn vẹn quy tắc **ESR (Equality → Sort → Range)**:

- **Equality trước:** field lọc `=` thu hẹp ngay về một dải con trỏ liền kề trong B-tree — như tra từ điển mở đúng trang.
- **Sort giữa:** trong dải con trỏ đó, nếu field kế tiếp đã sắp xếp đúng thứ tự sort cần thiết, Mongo **đọc tuần tự index** mà KHÔNG cần sort trong memory (tránh stage `SORT` blocking, vốn giới hạn 100MB rồi tràn ra disk).
- **Range cuối:** field range (`$gt`, `$lt`) trả về nhiều entry liền kề — phải đặt cuối, vì sau nó index không còn "sắp xếp đẹp" cho field nào nữa.

```js
// Query: { status: 'paid', total: { $gt: 100 } } sort { createdAt: -1 }
// ĐÚNG: Equality(status) → Sort(createdAt) → Range(total)
db.orders.createIndex({ status: 1, createdAt: -1, total: 1 });
// SAI: { status:1, total:1, createdAt:-1 } → range total trước sort
//      → Mongo phải SORT in-memory, explain hiện stage "SORT" (xấu)
```

**Index prefix.** Compound index `{ a:1, b:1, c:1 }` phục vụ được luôn query trên `{a}`, `{a,b}`, `{a,b,c}` — nhưng KHÔNG phục vụ query chỉ trên `{b}` hay `{c}`. Đây là lý do thứ tự field quyết định bạn cần bao nhiêu index (giảm index = giảm chi phí ghi).

### 3. Replica set election — chuyện gì xảy ra trong 10 giây primary chết

MongoDB dùng giao thức bầu cử **kiểu Raft** (protocol version 1).

1. **Heartbeat** mỗi 2 giây giữa các node. Nếu một secondary không nghe thấy primary trong `electionTimeoutMillis` (mặc định **10s**) → nó nghi primary chết.
2. Secondary đó tự đề cử, gửi yêu cầu vote. Node nào có **oplog mới nhất** (ít lag nhất) được ưu tiên. Mỗi node chỉ vote **một lần / nhiệm kỳ (term)**.
3. Cần **đa số voting member** đồng ý (vì sao luôn deploy số lẻ node). Node thắng tăng `term`, trở thành primary mới.
4. Trong khoảng election (vài giây tới ~12s), **không có primary → mọi write bị từ chối** (đây là bản chất CP của MongoDB). Driver có `retryWrites=true` sẽ tự thử lại write một lần sau khi primary mới lên.

**Oplog (operations log).** Là một **capped collection** (`local.oplog.rs`) ghi mọi thao tác thay đổi dữ liệu dưới dạng **idempotent** (vd `$inc` được dịch thành `$set` giá trị tuyệt đối — để replay nhiều lần không sai). Secondary kéo (tail) oplog của primary và áp lại. Oplog là **vòng tròn** (capped): nếu secondary tụt quá xa, oplog cũ bị ghi đè → secondary "stale", phải **resync toàn bộ**. Cùng cơ chế này là nền tảng của **change streams** và **PITR**.

**Rollback.** Nếu primary nhận write với `w:1`, chết trước khi replicate, primary mới (không có write đó) lên ngôi → khi node cũ sống lại, các write "thừa" của nó bị ghi vào file rollback và **biến mất khỏi DB**. `w:'majority'` ngăn chính xác kịch bản này.

### 4. Sharding internals — chunk, balancer, hotspot

- **Chunk:** dữ liệu một shard chia thành chunk (mặc định **128MB** từ Mongo 6.0, trước là 64MB) theo dải giá trị shard key.
- **Balancer:** tiến trình chạy trên primary của config server, định kỳ kiểm tra số chunk lệch giữa các shard, **di chuyển chunk** từ shard nhiều sang shard ít. Migration có overhead → nên đặt balancer window vào giờ thấp điểm.
- **Jumbo chunk:** nếu nhiều document có **cùng giá trị shard key** (cardinality thấp), chunk chứa chúng không thể tách (không chia nhỏ hơn một giá trị key) → phình quá ngưỡng, đánh dấu `jumbo`, balancer **không di chuyển được** → mất cân bằng vĩnh viễn. Đây là hậu quả trực tiếp của shard key cardinality thấp.
- **Hotspot:** shard key tăng đơn điệu + ranged sharding → chunk "max" luôn nằm một shard, mọi insert dồn vào đó. Fix: **hashed shard key** (phân tán insert đều), hoặc compound key bắt đầu bằng field cardinality cao phân tán (`{ tenantId: 1, ts: 1 }`).

```js
sh.shardCollection("shop.events", { tenantId: 1, _id: 1 });  // ranged compound
sh.shardCollection("shop.logs",   { deviceId: "hashed" });   // hashed, write đều
```

### 5. Multi-document transaction — vì sao đắt

Từ Mongo 4.0 (replica set) / 4.2 (sharded), MongoDB hỗ trợ ACID transaction đa-document. Nhưng nó **đắt** vì:
- Giữ snapshot và lock trong suốt transaction → tăng cache pressure, write conflict.
- Mặc định transaction có `maxTimeMS` ~60s; transaction dài bị abort.
- Trên sharded cluster, transaction cross-shard cần **two-phase commit** → latency cao.

Nguyên tắc: nếu bạn *thường xuyên* cần transaction đa-document, đó là **mùi của schema sai** — dữ liệu đáng lẽ nên nằm chung một document (embed) để cập nhật atomic-tự-nhiên (write một document luôn atomic, không cần transaction).

```js
const session = client.startSession();
try {
  await session.withTransaction(async () => {     // tự retry on transient error
    await accounts.updateOne({ _id: 'A' }, { $inc: { bal: -100 } }, { session });
    await accounts.updateOne({ _id: 'B' }, { $inc: { bal:  100 } }, { session });
  }, { readConcern: { level: 'majority' }, writeConcern: { w: 'majority' } });
} finally { await session.endSession(); }
```

## 🧪 Ví dụ nâng cao

### 1. `$facet` — pagination + count + thống kê trong MỘT lần quét

`$facet` chạy nhiều sub-pipeline **song song trên cùng input** — tránh quét collection nhiều lần.

```js
db.orders.aggregate([
  { $match: { status: 'paid', createdAt: { $gte: ISODate('2026-01-01') } } }, // dùng index, đứng đầu
  { $facet: {
      page:       [ { $sort: { createdAt: -1 } }, { $skip: 0 }, { $limit: 20 } ],
      totalCount: [ { $count: 'n' } ],
      byStatus:   [ { $group: { _id: '$paymentMethod', sum: { $sum: '$total' } } } ]
  }},
  { $project: {
      orders: '$page',
      total:  { $ifNull: [ { $arrayElemAt: ['$totalCount.n', 0] }, 0 ] },
      revenueByMethod: '$byStatus'
  }}
]);
```

### 2. `$lookup` + `$unwind` + `$group` — báo cáo join nhiều collection

```js
// Doanh thu theo tên sản phẩm (orders reference tới products)
db.orders.aggregate([
  { $match: { status: 'paid' } },
  { $unwind: '$items' },
  { $lookup: {                              // join sang products
      from: 'products',
      localField: 'items.productId',
      foreignField: '_id',
      as: 'product'
  }},
  { $unwind: '$product' },                   // $lookup trả về array → mở ra
  { $group: {
      _id: '$product.name',
      revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } },
      units:   { $sum: '$items.qty' }
  }},
  { $sort: { revenue: -1 } },
  { $limit: 10 }
]);
// ⚠️ $lookup không dùng được index trên collection được join nếu localField không match _id
//    → trên dataset lớn, đây là phép join O(n*m) chậm. Cân nhắc Extended Reference để né hẳn.
```

### 3. Bucket pattern time-series có giới hạn kích thước

```js
const hourStart = new Date(Math.floor(Date.now() / 3600000) * 3600000);
await readings.updateOne(
  { sensorId: 's-01', hour: hourStart, count: { $lt: 200 } },  // chặn bucket phình
  { $push:  { m: { ts: new Date(), temp: 27.4 } },
    $inc:   { count: 1, sumTemp: 27.4 },
    $min:   { minTemp: 27.4 }, $max: { maxTemp: 27.4 },
    $setOnInsert: { sensorId: 's-01', hour: hourStart } },
  { upsert: true }
);
// count >= 200 → filter không match → upsert tạo bucket MỚI cùng (sensorId, hour)
```

### 4. Schema Versioning pattern — migrate dần không downtime

```js
// Document cũ không có schemaVersion; mới có _sv: 2 với email tách thành object
function normalize(doc) {
  if (!doc._sv || doc._sv < 2) {
    doc.contact = { email: doc.email, verified: false };  // lazy upgrade khi đọc
    doc._sv = 2;
  }
  return doc;
}
// Migrate lazy (khi ghi lại) + background job quét document _sv < 2 dần
```

### 5. `explain('executionStats')` — đọc IXSCAN vs COLLSCAN

```js
const e = db.orders.find({ status: 'paid' }).sort({ createdAt: -1 })
            .explain('executionStats');
// Cần nhìn:
// e.executionStats.executionStages.stage         → "IXSCAN" tốt, "COLLSCAN" xấu
// e.executionStats.totalKeysExamined              → số index entry quét
// e.executionStats.totalDocsExamined              → số document chạm tới
// e.executionStats.nReturned                      → số doc trả về
// TỈ LỆ VÀNG: totalDocsExamined / nReturned ≈ 1  → index chuẩn, không đọc thừa
// Nếu thấy stage "SORT" → đang sort in-memory, thiếu field sort trong index (vi phạm ESR)
// Nếu thấy "FETCH" lớn nhưng query chỉ cần vài field → cân nhắc covered query
```

### 6. Computed + Extended Reference + Subset cùng một product

```js
{
  _id: ObjectId("..."), sku: 'LAPTOP-99', name: 'ThinkPad', price: 25000000,
  ratingSum: 4210, ratingCount: 950,           // Computed: avg = sum/count O(1)
  category: { _id: ObjectId("..."), name: 'Laptop' }, // Extended Reference: né $lookup
  recentReviews: [ /* 5 review mới nhất */ ]    // Subset: phần còn lại reference collection reviews
}
```

## 🐛 Bẫy & sự cố production

**1. Unbounded array phình document tới 16MB.** Nhúng `comments`/`events` không giới hạn vào một document.
*Dấu hiệu:* update ngày càng chậm (mỗi `$push` rewrite cả document + mọi index entry liên quan), rồi lỗi `BSONObjectTooLarge`.
*Fix:* Subset pattern (giữ N phần tử mới nhất, phần dư sang collection riêng) hoặc Bucket; đặt giới hạn `$slice` khi `$push`: `{ $push: { recent: { $each: [x], $slice: -50 } } }`.

**2. Shard key kém → hot shard / jumbo chunk.** Chọn `createdAt` ranged hoặc field cardinality thấp.
*Dấu hiệu:* một shard CPU 100% còn lại nhàn rỗi (`sh.status()` chunk lệch); cảnh báo `jumbo` chunk.
*Fix:* không thể đổi shard key dễ dàng (Mongo 5.0+ có `reshardCollection` nhưng tốn kém) → thiết kế đúng từ đầu: hashed cho write đều, hoặc compound bắt đầu bằng field phân tán cao.

**3. Thiếu index → COLLSCAN.** Query mới deploy không có index hỗ trợ.
*Dấu hiệu:* latency tăng tuyến tính theo kích thước collection; explain hiện `COLLSCAN`; log có `slow query`.
*Fix:* bật profiler `db.setProfilingLevel(1, { slowms: 100 })`, soi `db.system.profile`, tạo index theo ESR. Tạo trên production dùng rolling index build để tránh chặn.

**4. Đọc từ secondary bị stale.** Route read sang `secondary` để giảm tải primary.
*Dấu hiệu:* user vừa cập nhật, đọc lại thấy dữ liệu cũ (replication lag); báo cáo lệch số.
*Fix:* read-your-own-writes bằng causal consistency session, hoặc pin read về primary trong N giây sau write; chỉ route read chịu được stale (analytics, listing) sang secondary. Theo dõi lag qua `rs.printSecondaryReplicationInfo()`.

**5. `$lookup` lớn chậm.** Join hai collection lớn trong aggregation hot-path.
*Dấu hiệu:* aggregation từ vài ms lên vài giây khi data lớn; CPU primary tăng.
*Fix:* Extended Reference (nhúng sẵn field hay đọc để né join), hoặc Computed pattern ghi sẵn kết quả ra collection bằng `$merge`/materialized view; đảm bảo `foreignField` có index.

**6. Không bật `w: 'majority'` → mất write khi failover.** Dùng `w: 1` (hoặc `w: 0`).
*Dấu hiệu:* sau một sự cố election, một số order client đã nhận "success" lại biến mất (rollback file trên node cũ).
*Fix:* `w: 'majority'` cho mọi write quan trọng (tiền, order); thêm `wtimeout` để không treo vô hạn; `retryWrites=true` trong URI để driver tự retry qua election.

## ⚖️ Đánh đổi & quyết định thiết kế

**Embed vs Reference — khung quyết định định lượng.**

| Tiêu chí | Nghiêng Embed | Nghiêng Reference |
|---|---|---|
| Cardinality quan hệ | 1-1, 1-few (có trần) | 1-many unbounded |
| Tần suất đọc cùng nhau | Luôn đọc chung | Đọc độc lập |
| Tần suất ghi của con | Con ít đổi | Con đổi liên tục (tránh rewrite cha) |
| Chia sẻ bởi nhiều cha | Không | Có (many-to-many) |
| Kích thước | Tổng < 16MB an toàn | Có nguy cơ vượt 16MB |

Câu thần chú: *"data accessed together should be stored together"* — nhưng luôn kiểm tra cận trên kích thước. Khi lưng chừng → **Subset/Extended Reference** (lai cả hai).

**SQL vs NoSQL.** README đã nêu access-pattern-first. Đào sâu hơn: PostgreSQL với **JSONB + GIN index** cho bạn ~80% sự linh hoạt của document model *cùng* với ACID, JOIN, và transaction mạnh — nên rất nhiều bài toán "tưởng cần Mongo" thực ra Postgres giải tốt hơn. Chỉ chọn Mongo khi: schema thực sự đa hình mạnh, scale-out sharding là yêu cầu thật, và bạn model theo access pattern rõ ràng. Đừng chọn Mongo vì "ghét viết SQL".

**Consistency vs Availability (CAP/PACELC).** Khi partition: MongoDB là CP — minority side từ chối write để không phân nhánh dữ liệu. Nhưng câu hỏi senior thực sự là **PACELC**: *kể cả khi KHÔNG partition (Else)*, bạn vẫn đánh đổi **Latency vs Consistency** — `w:'majority'` + `readConcern:'majority'` cho consistency mạnh nhưng latency cao hơn `w:1`. Chọn theo từng loại dữ liệu, không phải toàn hệ thống: order dùng majority, view-count dùng `w:1`.

**Single large collection vs nhiều collection.** Mongo khuyến khích ít collection hơn (polymorphic pattern: nhiều `type` chung một collection) vì: index dùng chung, query đa hình một lần, không cross-collection join. Tách collection riêng khi: lifecycle khác hẳn (TTL khác nhau), quyền truy cập khác, hoặc một loại lớn áp đảo gây ảnh hưởng cache của loại kia. Đừng tách collection theo thói quen "một bảng một entity" của SQL.

## 🎯 Câu hỏi phỏng vấn NÂNG CAO

**Q1: Chọn shard key thế nào để tránh hotspot và jumbo chunk?**
Ba tiêu chí: cardinality cao (tránh jumbo — chunk không tách được dưới một giá trị key), phân bố write đều (tránh key tăng đơn điệu với ranged → hot shard), và xuất hiện trong query phổ biến (targeted query thay vì scatter-gather). Write-heavy đều → hashed; cần range query → compound bắt đầu bằng field phân tán (`{tenantId, ts}`). Nhấn mạnh: gần như không đảo ngược được, `reshardCollection` tốn kém → thiết kế đúng từ đầu.

**Q2: `w: 'majority'` đánh đổi gì so với `w: 1`?**
Đổi **latency lấy durability**: phải chờ đa số node ack nên chậm hơn, và nếu không đủ node majority (mất quá nhiều node) thì write treo tới `wtimeout`. Bù lại không bao giờ mất write đã báo success khi failover (chống rollback). Quyết định theo loại dữ liệu: tiền/order dùng majority, metric/log dùng `w:1`.

**Q3: Khi nào KHÔNG nên dùng MongoDB?**
Khi cần ACID đa-thực-thể thường xuyên (chuyển tiền nhiều tài khoản, kế toán), nhiều quan hệ many-to-many với JOIN ad-hoc đa dạng (Postgres JOIN mạnh hơn nhiều), cần ràng buộc toàn vẹn chặt (FK, check constraint), hoặc query phân tích phức tạp chưa biết trước. Nếu thấy mình *liên tục* cần transaction đa-document hoặc `$lookup` nhiều tầng → đó là tín hiệu chọn sai store.

**Q4: Đọc từ secondary có rủi ro gì, khi nào chấp nhận được?**
Rủi ro stale read do replication lag và secondary cũng replay toàn bộ write (không "miễn phí"). Chấp nhận được cho read chịu stale: analytics, báo cáo, listing không quan trọng độ tươi. Không dùng cho read-after-write của chính user. Đọc secondary KHÔNG phải cách scale read tốt nhất — cache (Redis) và sharding đúng bài hơn.

**Q5: WiredTiger lock ở cấp nào, vì sao quan trọng?**
Document-level (optimistic + MVCC), không phải collection-level như engine cũ MMAPv1. Hai write vào hai document khác nhau không chặn nhau → throughput cao. Đụng cùng document gây write conflict, server tự retry. Reader không block writer nhờ MVCC snapshot.

**Q6: `j: true` và checkpoint liên quan thế nào tới mất dữ liệu khi crash?**
Write được ghi journal (WAL) trước, flush mỗi ~100ms; checkpoint snapshot toàn bộ ~60s. Crash → replay journal từ checkpoint gần nhất. `j: true` buộc chờ write nằm an toàn trong journal trên disk trước khi ack → không mất write đó kể cả mất điện đột ngột giữa hai checkpoint.

**Q7: Vì sao replica set luôn cần số lẻ node voting?**
Election cần đa số (majority) phiếu. 3 node chịu mất 1, 4 node cũng chỉ chịu mất 1 nhưng tốn thêm tài nguyên và dễ split-vote. Số lẻ tối ưu khả năng chịu lỗi trên mỗi node. Cần thêm fault tolerance thì nhảy 3→5, không phải 3→4.

**Q8: Giải thích PACELC và áp dụng vào cấu hình write/read concern.**
PACELC: *if Partition then Availability or Consistency, Else Latency or Consistency*. MongoDB là PC/EC — ưu tiên consistency cả khi partition lẫn bình thường, đổi lại latency. Áp dụng: chọn concern theo từng nghiệp vụ, không cào bằng — order = `w:'majority'`+`readConcern:'majority'` (consistency); đếm view = `w:1` (latency).

## 📚 Đọc thêm

- MongoDB Manual — WiredTiger Storage Engine (journal, checkpoint, cache, snapshot).
- MongoDB Manual — Replica Set Elections & Oplog; Read/Write Concern reference.
- MongoDB Manual — Sharding: chọn shard key, balancer, jumbo chunk, `reshardCollection`.
- "Building with Patterns" (MongoDB blog) — bộ 12 schema design pattern đầy đủ.
- Aggregation Pipeline reference — `$facet`, `$lookup`, `$merge`, `$bucket`.
- Daniel Abadi — "Consistency Tradeoffs in Modern Distributed Database System Design" (bài gốc PACELC).
- Martin Kleppmann — *Designing Data-Intensive Applications*, ch. 5 (Replication), ch. 6 (Partitioning), ch. 9 (Consistency).
