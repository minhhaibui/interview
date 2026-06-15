# Tuần 4 — Thiết kế hệ thống & Case thực tế: NoSQL & Database Design

> Tài liệu bổ trợ cho README.md cùng thư mục. Học sau khi xong phần lý thuyết.

## 🏗️ Mini System Design (scoped vào chủ đề tuần)

### Bài 1: Product catalog cho e-commerce 10M sản phẩm, attributes động theo category

**Đề bài:**
Thiết kế database cho catalog của một sàn e-commerce:
- 10M sản phẩm, ~2000 categories.
- Mỗi category có bộ attributes khác nhau: điện thoại có `ram`, `screen_size`, `chip`; áo thun có `size`, `color`, `material`; sách có `author`, `publisher`, `pages`.
- Traffic: 20K read QPS (xem chi tiết + filter theo attribute), 50 write QPS (seller cập nhật).
- Yêu cầu filter: "điện thoại RAM >= 8GB, giá 5–10 triệu, brand Samsung" phải trả về < 100ms.
- Schema attribute thay đổi thường xuyên: marketing thêm attribute mới cho category mà không cần migration.

**Phân tích & lời giải:**

**Bước 1 — Tại sao chọn document model (MongoDB)?**

Đặc trưng bài toán: schema **không đồng nhất giữa các category** nhưng **đồng nhất trong một category**, và read pattern là "lấy nguyên một sản phẩm" (1 document = 1 màn hình chi tiết sản phẩm). Đây là sweet spot của document DB: dữ liệu đọc cùng nhau thì lưu cùng nhau.

**Bước 2 — Schema document với Attribute Pattern**

Cách ngây thơ là nhúng attributes thành object phẳng:

```js
// ❌ Cách ngây thơ — KHÔNG index nổi
{
  _id: ObjectId("..."),
  name: "Galaxy S24",
  category: "smartphone",
  ram: 8, screen_size: 6.2, chip: "Exynos 2400"  // mỗi category một bộ field khác nhau
}
```

Vấn đề: muốn filter theo attribute bất kỳ thì phải tạo index riêng cho **từng field của từng category** → hàng trăm index, write chậm, không quản nổi khi marketing thêm attribute mới.

Lời giải chuẩn: **Attribute Pattern** — chuyển attributes thành mảng key/value:

```js
{
  _id: ObjectId("..."),
  sku: "SS-S24-256-BLK",
  name: "Samsung Galaxy S24 256GB",
  categoryId: "smartphone",
  brand: "Samsung",
  price: 18990000,            // field "nóng", dùng chung mọi category → để top-level
  stockStatus: "in_stock",
  attrs: [
    { k: "ram",         v: 8,      u: "GB" },
    { k: "screen_size", v: 6.2,    u: "inch" },
    { k: "chip",        v: "Exynos 2400" },
    { k: "color",       v: "black" }
  ],
  // dữ liệu hiển thị, không filter → object tự do, không cần pattern
  description: "...",
  images: ["..."],
  specsDisplay: { "Bảo hành": "12 tháng", ... },
  updatedAt: ISODate("...")
}
```

**Bước 3 — Index**

```js
// 1 index "thần thánh" phủ mọi attribute của mọi category:
db.products.createIndex({ "attrs.k": 1, "attrs.v": 1 })

// Index cho query pattern chính (category + price là filter phổ biến nhất):
db.products.createIndex({ categoryId: 1, price: 1 })
db.products.createIndex({ categoryId: 1, brand: 1, price: 1 })

// Query filter:
db.products.find({
  categoryId: "smartphone",
  brand: "Samsung",
  price: { $gte: 5000000, $lte: 10000000 },
  attrs: { $elemMatch: { k: "ram", v: { $gte: 8 } } }
})
```

Điểm ăn tiền khi phỏng vấn: giải thích được rằng `{ "attrs.k": 1, "attrs.v": 1 }` là **multikey index** — Mongo tạo index entry cho từng phần tử mảng, nên 1 index phục vụ được filter trên *mọi* attribute, kể cả attribute marketing thêm vào ngày mai. Đây chính là lý do pattern này tồn tại.

**Bước 4 — Kiến trúc đọc**

```
Client ──> API (Node.js)
              │
              ├─ GET /products/:id ──> Redis cache ──miss──> MongoDB (primary read by _id)
              │
              └─ GET /search?filter ──> Elasticsearch (faceted search, full-text)
                                            ▲
              MongoDB ── Change Streams ────┘  (sync async, lag ~1s chấp nhận được)
```

Với 20K QPS: filter đơn giản (category + price + 1-2 attrs) Mongo + index gánh tốt; nhưng **faceted search** (đếm số sản phẩm theo từng giá trị attribute, full-text search) thì đẩy sang Elasticsearch — Mongo không sinh ra để làm việc đó. Nói rõ điều này thể hiện bạn biết giới hạn của từng tool.

**Bước 5 — So sánh nếu làm bằng EAV trên SQL**

EAV (Entity-Attribute-Value) là cách "giả lập schema động" trên RDBMS:

```sql
CREATE TABLE products (id BIGINT PK, name TEXT, category_id INT, price BIGINT);
CREATE TABLE product_attributes (
  product_id BIGINT REFERENCES products(id),
  attr_key   VARCHAR(64),
  attr_value TEXT,            -- mất type safety: số cũng lưu thành text
  PRIMARY KEY (product_id, attr_key)
);
```

Query "RAM >= 8 AND color = black" cần **self-join mỗi attribute một lần**:

```sql
SELECT p.* FROM products p
JOIN product_attributes a1 ON a1.product_id = p.id
  AND a1.attr_key = 'ram' AND CAST(a1.attr_value AS INT) >= 8
JOIN product_attributes a2 ON a2.product_id = p.id
  AND a2.attr_key = 'color' AND a2.attr_value = 'black'
WHERE p.category_id = 12 AND p.price BETWEEN 5000000 AND 10000000;
```

Với 10M sản phẩm × ~15 attrs = 150M rows trong bảng EAV; mỗi filter thêm 1 join; `CAST` giết index. Đây là anti-pattern kinh điển (Magento 1 dùng EAV và nổi tiếng chậm vì nó). Lưu ý: Postgres hiện đại có lối thoát là cột `JSONB` + GIN index — về bản chất là "document model trong SQL", và là câu trả lời tốt nếu interviewer ép phải dùng Postgres.

**Trade-offs:**
- Attribute pattern: query hơi xấu (`$elemMatch`), app phải tự enforce schema attribute theo category (dùng JSON Schema validation của Mongo hoặc validate ở tầng service).
- Multikey index phình to khi mảng `attrs` dài (>30 phần tử) → chỉ đưa attribute *filterable* vào `attrs`, attribute chỉ-hiển-thị để trong `specsDisplay`.
- Sync sang Elasticsearch thêm độ trễ và một hệ thống phải vận hành; đổi lại faceted search và full-text đúng công cụ.
- Denormalize `brand`, `categoryName` vào document → đổi tên category phải chạy batch update, nhưng read không cần join ($lookup).

**Follow-up interviewer hay hỏi:**
1. *"Attribute có nhiều kiểu dữ liệu (số, chuỗi, boolean) thì index `attrs.v` hoạt động thế nào?"* — Mongo index được mixed types nhưng so sánh range chỉ đúng trong cùng type (BSON type ordering); thực chiến nên tách `v_num` / `v_str` hoặc đảm bảo mỗi `k` luôn cùng type, validate ở tầng ghi.
2. *"Nếu một sản phẩm có 500 variants (size × color) thì sao?"* — Đừng nhúng hết: tách collection `variants` reference về `productId` (tránh document phình + mảng lớn làm chậm update), hoặc nhúng nếu < ~100 variants và luôn đọc cùng nhau.
3. *"Làm sao đảm bảo seller A và B cùng update một sản phẩm không ghi đè nhau?"* — Optimistic concurrency: thêm field `version`, update với điều kiện `{ _id, version: oldVersion }` + `$inc: { version: 1 }`.

---

### Bài 2: Hệ thống comment lồng nhau (nested comments)

**Đề bài:**
Thiết kế lưu trữ comment cho một trang tin tức/video lớn:
- 2M bài viết, bài hot có thể có 100K comments.
- Comment lồng nhau tối đa hiển thị 3 cấp (reply of reply).
- Read pattern: load 20 comment gốc mới nhất + 3 reply đầu mỗi comment; bấm "xem thêm" để phân trang.
- Write: 500 comments/s lúc cao điểm (bài hot, livestream).
- Cần đếm tổng số comment mỗi bài.

**Phân tích & lời giải:**

**Bước 1 — Embedded vs Reference: chọn theo "cardinality"**

Quy tắc vàng của Mongo: *one-to-few thì embed, one-to-many thì reference, one-to-squillions thì reference + nghĩ đến bucket*. Comment là one-to-squillions (bài hot 100K comments) → **không bao giờ embed toàn bộ comment vào document bài viết**:
- Document limit 16MB sẽ vỡ.
- Mỗi comment mới = rewrite document khổng lồ.
- Không phân trang được trong mảng một cách hiệu quả.

**Bước 2 — Thiết kế reference + materialized path**

```js
// collection: comments
{
  _id: ObjectId("..."),
  postId: ObjectId("..."),
  parentId: ObjectId("...") | null,      // null = comment gốc
  rootId: ObjectId("..."),               // comment gốc của cả thread (chính nó nếu là gốc)
  path: "65a1f.../65a2b.../",            // materialized path: chuỗi id tổ tiên
  depth: 2,                              // 0 = gốc, app chặn depth > 2
  authorId: ObjectId("..."),
  authorSnapshot: { name: "Linh", avatar: "..." },  // denormalize để không $lookup users
  content: "...",
  likeCount: 0,
  replyCount: 3,                         // counter cache cho "xem thêm N trả lời"
  status: "visible",                     // visible | hidden | deleted
  createdAt: ISODate("...")
}

// Indexes
db.comments.createIndex({ postId: 1, parentId: 1, createdAt: -1 })  // load gốc + reply theo trang
db.comments.createIndex({ rootId: 1, createdAt: 1 })                // load nguyên thread
db.comments.createIndex({ path: 1 })                                 // tìm toàn bộ con cháu (prefix)
```

Query thực tế:

```js
// 20 comment gốc mới nhất
db.comments.find({ postId, parentId: null, status: "visible" })
  .sort({ createdAt: -1 }).limit(20)

// 3 reply đầu của một comment (lazy load phần còn lại)
db.comments.find({ parentId: cid, status: "visible" })
  .sort({ createdAt: 1 }).limit(3)

// Mod xóa 1 comment + toàn bộ con cháu: dùng materialized path
db.comments.updateMany(
  { path: { $regex: `^${escapeRegex(parentPath + parentId)}/` } },
  { $set: { status: "hidden" } }
)
```

Tại sao materialized path thay vì đệ quy `parentId`? Vì lấy "toàn bộ subtree" bằng 1 query prefix-match trên index thay vì N round-trips đệ quy. Trên SQL tương đương là cột `path` (ltree của Postgres) hoặc recursive CTE.

**Bước 3 — Bucket pattern khi thread > 1000 comments**

Vấn đề với one-doc-per-comment ở quy mô 100K comments/bài: load 20 comments = 20 random reads; index `postId` rất nóng. **Bucket pattern** gom comment thành "trang" sẵn:

```js
// collection: comment_buckets — mỗi bucket chứa tối đa 100 comment gốc
{
  _id: "post123_page_0",
  postId: ObjectId("post123"),
  page: 0,
  count: 100,                     // đầy thì mở bucket mới
  comments: [
    { cid, authorSnapshot, content, createdAt, likeCount, replyCount },
    // ... tối đa 100
  ]
}

// Ghi comment mới: upsert vào bucket cuối nếu count < 100, ngược lại tạo bucket mới
db.comment_buckets.updateOne(
  { postId, count: { $lt: 100 } },
  { $push: { comments: c }, $inc: { count: 1 },
    $setOnInsert: { _id: `${postId}_page_${nextPage}` } },
  { sort: { page: -1 }, upsert: true }
)
```

1 read = 1 bucket = 100 comments hiển thị sẵn. Trade-off: sửa/xóa 1 comment phải update positional (`comments.$.status`), và reply sâu vẫn nên để collection riêng. Thực chiến: **bắt đầu bằng one-doc-per-comment, chỉ chuyển bucket cho read path của comment gốc khi đo thấy cần** — nói được câu này trong phỏng vấn rất ăn điểm vì thể hiện tư duy "measure trước, optimize sau".

**Bước 4 — Đếm tổng comment**

Không `countDocuments({postId})` mỗi lần render (scan index, chậm với 100K). Counter cache trên document bài viết: `$inc: { commentCount: 1 }` khi tạo comment, chấp nhận lệch nhẹ khi có lỗi giữa chừng, chạy job reconcile mỗi đêm.

**Trade-offs:**
- Denormalize `authorSnapshot` → user đổi avatar thì comment cũ hiển thị avatar cũ (đa số sản phẩm chấp nhận, hoặc lazy-refresh khi đọc).
- Materialized path: di chuyển subtree (hiếm gặp với comment) phải rewrite path của cả nhánh.
- Counter cache lệch khi write lỗi giữa 2 thao tác → chấp nhận eventual + reconcile, hoặc dùng transaction (Mongo 4.0+) nếu cần chính xác tuyệt đối nhưng chậm hơn.
- Soft delete (`status: "deleted"`, hiển thị "comment đã xóa") thay vì hard delete để giữ cấu trúc cây.

**Follow-up interviewer hay hỏi:**
1. *"Sort comment theo 'top' (nhiều like nhất) thì sao?"* — Thêm index `{ postId: 1, parentId: 1, likeCount: -1 }`; với bucket pattern thì khó hơn — thường giải bằng cách cache bảng xếp hạng top comments trong Redis sorted set, rebuild định kỳ.
2. *"500 writes/s vào một bài viết hot, counter `commentCount` trên 1 document có thành điểm nghẽn không?"* — Mongo lock theo document; 500 `$inc`/s vào 1 doc bắt đầu căng. Giải pháp: sharded counter (N doc counter cộng dồn khi đọc) hoặc đẩy counting qua Redis INCR rồi flush về DB.
3. *"Phân trang bằng skip/limit có ổn với 100K comments không?"* — Không, `skip(99000)` phải duyệt qua 99K entries. Dùng cursor-based pagination: `{ createdAt: { $lt: lastSeen }, _id: { $lt: lastId } }`.

---

### Bài 3: Social follow graph cho 50M users

**Đề bài:**
Thiết kế hệ thống follow kiểu Twitter/TikTok:
- 50M users; trung bình 200 followings/user; celebrity có thể có 10M followers.
- Operations: follow/unfollow (2K writes/s), kiểm tra "A có follow B không?" (rất nóng — render mọi profile/feed, 100K QPS), lấy danh sách followers/followings có phân trang, hiển thị số followers.
- Tổng quan hệ ước tính: 50M × 200 = **10 tỷ edges**.

**Phân tích & lời giải:**

**Bước 1 — Mô hình dữ liệu: adjacency list, một document/row mỗi edge**

```js
// MongoDB — collection: follows (1 doc = 1 edge)
{
  _id: "u123_u456",            // composite key: followerId_followeeId → check tồn tại bằng 1 point read
  followerId: "u123",
  followeeId: "u456",
  createdAt: ISODate("...")
}

db.follows.createIndex({ followerId: 1, createdAt: -1 })  // danh sách following của tôi
db.follows.createIndex({ followeeId: 1, createdAt: -1 })  // danh sách followers của tôi
```

Tại sao không lưu mảng `followings: [...]` trong document user? 10M followers của celebrity → vỡ 16MB; thêm/xóa phần tử trong mảng triệu phần tử cực chậm. **Mảng trong document chỉ dành cho one-to-few.**

Trên SQL gần như y hệt:

```sql
CREATE TABLE follows (
  follower_id BIGINT, followee_id BIGINT, created_at TIMESTAMPTZ,
  PRIMARY KEY (follower_id, followee_id)
);
CREATE INDEX idx_followee ON follows (followee_id, created_at DESC);
```

**Bước 2 — So sánh 3 lựa chọn engine**

| Tiêu chí | MongoDB (sharded) | SQL (Postgres, partitioned) | Graph DB (Neo4j) |
|---|---|---|---|
| Check "A follows B?" | 1 point read theo `_id` — rất nhanh | PK lookup — rất nhanh | nhanh nhưng không nhanh hơn |
| List followers paginated | index scan — tốt | index scan — tốt | tốt |
| Traversal sâu (friends-of-friends, gợi ý) | nhiều round-trip, tệ | recursive CTE — tệ ở scale này | **đây mới là chỗ graph DB thắng** |
| Scale 10B edges | sharding built-in | Citus/Vitess hoặc tự shard | Neo4j scale-out khó/đắt |

Insight để nói trong phỏng vấn: **bài toán follow thực ra không phải bài toán graph traversal** — 95% queries là độ-sâu-1 (list/check/count). Adjacency list trên key-value/document/SQL shard tốt là đủ và rẻ. Graph DB chỉ đáng giá khi feature chính là traversal nhiều bậc (gợi ý bạn bè kiểu LinkedIn "2nd degree"). Twitter thật cũng làm vậy (FlockDB — adjacency list trên MySQL sharded).

**Bước 3 — Sharding cho 10B edges (Mongo)**

```js
sh.shardCollection("social.follows", { followerId: "hashed" })
```

- Shard theo `followerId` → "danh sách following của tôi" nằm gọn 1 shard (query phổ biến nhất khi build feed).
- Hệ quả: "danh sách followers của B" thành **scatter-gather** mọi shard. Với celebrity 10M followers thì kiểu gì cũng nặng → giải bằng bảng đảo chiều: collection `followers` shard theo `followeeId`, ghi kép 2 collection khi follow (eventual consistent, có job reconcile). Đây là pattern "ghi 2 chiều" mà Twitter/Instagram đều dùng.

**Bước 4 — Check "A follows B?" ở 100K QPS**

DB không nên gánh trực tiếp. Cache bằng Redis:

```
SISMEMBER followings:{userId} {targetId}   // set followings của user đang active
```

- Chỉ cache user đang online (TTL 30 phút, load từ DB khi miss). 200 followings × 5M user online × ~30 bytes ≈ 30GB → Redis Cluster vài node là vừa.
- Với user follow > 100K người (hiếm): fallback đọc DB point read, vốn cũng chỉ ~1ms.

**Bước 5 — Đếm followers: counter cache**

`db.follows.countDocuments({followeeId})` trên 10M edges mỗi lần render profile là tự sát. Counter cache:

```js
// collection: user_stats
{ _id: "u456", followerCount: 10000000, followingCount: 200 }

// Khi follow: 2 thao tác, chấp nhận eventual giữa chúng
db.follows.insertOne({...})
db.user_stats.updateOne({ _id: followeeId }, { $inc: { followerCount: 1 } })
```

Chống lệch: job reconcile chạy đêm so `countDocuments` với counter cho user active; hiển thị làm tròn ("10.2M followers") nên lệch vài đơn vị không ai biết. Với celebrity bị flash-follow (50K follows/phút sau một scandal): buffer `INCRBY` trong Redis, flush về DB mỗi 5–10s — biến 1000 writes/s thành 0.1 write/s vào hot document.

**Trade-offs:**
- Ghi kép 2 collection (2 chiều) → tăng write amplification + cần reconcile; đổi lại cả 2 chiều đọc đều local-shard.
- Counter cache eventual → đơn giản, nhanh; nếu interviewer đòi exact, trả lời bằng transaction nhưng chỉ rõ chi phí (latency, lock hot doc của celebrity).
- Không chọn graph DB → mất khả năng traversal sâu; nếu sau này cần "gợi ý follow", build pipeline offline (Spark/batch) thay vì query online.

**Follow-up interviewer hay hỏi:**
1. *"Unfollow xảy ra giữa lúc ghi kép bị lỗi nửa chừng thì sao?"* — Idempotent write + outbox/queue để retry; hoặc coi collection `follows` là source of truth, collection đảo chiều rebuild được từ nó.
2. *"Build news feed cho follower của celebrity 10M người thế nào?"* — Dẫn sang fan-out-on-write vs fan-out-on-read: user thường thì push vào feed cache của follower; celebrity thì pull-at-read và merge. (Câu này gần như chắc chắn được hỏi tiếp — chuẩn bị sẵn.)
3. *"Sao không dùng Redis làm primary store cho cả graph?"* — Durability và cost: 10B edges trong RAM quá đắt; Redis là cache/accelerator, DB là source of truth.

---

### Bài 4: Chọn shard key cho collection `orders` 1 tỷ documents

**Đề bài:**
Sàn TMĐT có collection `orders`: 1 tỷ documents, ~1KB/doc (~1TB data), tăng 2M orders/ngày.
Query patterns (theo thứ tự tần suất):
1. Lấy đơn theo `orderId` (tra cứu, webhook thanh toán) — 5K QPS.
2. "Đơn hàng của tôi": list orders theo `userId`, sort mới nhất — 3K QPS.
3. Seller dashboard: orders theo `sellerId` + khoảng thời gian — 500 QPS.
4. Báo cáo nội bộ theo ngày — batch, chạy đêm.
Hãy phân tích 3 ứng viên shard key, chỉ ra hậu quả nếu chọn sai, và cách reshard.

**Phân tích & lời giải:**

**Bước 1 — Nhắc lại 3 tiêu chí chấm điểm một shard key**
1. **Cardinality** cao (đủ giá trị để chia nhỏ chunk).
2. **Write distribution** đều (không hot shard khi ghi).
3. **Query isolation**: query phổ biến nhất nên route được vào 1 shard (targeted query), tránh scatter-gather.

**Bước 2 — Phân tích 3 ứng viên**

**Ứng viên A: `{ createdAt: 1 }` (hoặc `_id` ObjectId mặc định — vì ObjectId có timestamp prefix, monotonic tương tự)**
- ❌ Monotonically increasing → **mọi insert dồn vào chunk cuối cùng trên 1 shard** ("hot shard"). 2M orders/ngày đổ hết vào 1 máy, các shard còn lại ngồi chơi. Balancer phải liên tục split & migrate chunk nóng.
- ✅ Duy nhất query 4 (báo cáo theo ngày) được lợi.
- **Kết luận: loại.** Đây là lỗi chọn shard key kinh điển nhất (xem Case 2 bên dưới).

**Ứng viên B: `{ orderId: "hashed" }`**
- ✅ Write phân bố hoàn hảo (hash đều).
- ✅ Query 1 (theo orderId) targeted — query nóng nhất được phục vụ tốt.
- ❌ Query 2 và 3 (theo userId/sellerId) thành **scatter-gather toàn bộ shards** — 3.5K QPS scatter trên cluster 20 shards = 70K shard-queries/s. Đau.
- ❌ Hashed key không hỗ trợ range query trên chính key đó.

**Ứng viên C: `{ userId: 1, orderId: 1 }` (compound)**
- ✅ Query 2 ("đơn của tôi") targeted vào 1 shard — và mọi đơn của 1 user nằm cùng shard, sort theo thời gian dùng index local.
- ✅ Query 1: nếu hệ thống tra cứu luôn có cả userId (token đăng nhập) thì targeted; webhook thanh toán chỉ có orderId → giải bằng cách **nhúng userId vào orderId** (`orderId = {userId-prefix}{random}`) hoặc bảng lookup `orderId → userId` (cache Redis). 
- ✅ Write phân bố tốt: hàng triệu userId active, không monotonic. `orderId` trong compound chống trường hợp 1 user khổng lồ (key cardinality nội bộ).
- ⚠️ Query 3 (sellerId) vẫn scatter-gather → chấp nhận (500 QPS, dashboard chịu được vài trăm ms), hoặc nuôi read model riêng cho seller (collection `orders_by_seller` sync qua change streams / Kafka).
- ⚠️ Jumbo chunk nếu 1 user có quá nhiều đơn? Compound với orderId cho phép split bên trong 1 userId → ổn.

**Kết luận: chọn C**, kèm read model phụ cho seller. Nếu interviewer ép "chỉ được 1 collection", chọn C và biện luận trade-off cho query 3.

**Bước 3 — Hậu quả chọn sai & resharding**

Hậu quả thực tế của chọn sai (ví dụ đã chọn A): hot shard 100% CPU trong khi cluster idle; balancer migrate chunk liên tục chiếm I/O; latency p99 tăng theo giờ trong ngày.

Cách thoát:
- **MongoDB 5.0+**: `reshardCollection` — Mongo build collection mới với key mới ở background rồi cut over; cần dung lượng disk ~2x, tốn I/O, làm vào giờ thấp điểm, vẫn rủi ro ở 1TB.
- **Trước 5.0 / muốn kiểm soát**: dual-write sang collection mới + backfill batch + so khớp + đổi read path — về bản chất là một cuộc migration online vài tuần.
- Bài học để chốt với interviewer: *"shard key là quyết định one-way-door đắt nhất trong Mongo — tôi sẽ dành thời gian liệt kê hết query patterns trước khi chọn, vì đổi sau này là một dự án migration."*

**Trade-offs:**
- C tối ưu cho B2C read path, hi sinh seller path → bù bằng CQRS-style read model (thêm pipeline phải vận hành).
- Nhúng userId vào orderId làm lộ thông tin nếu orderId public → hash/encode phần prefix.
- Pre-splitting chunks khi go-live để tránh giai đoạn đầu mọi data dồn 1 shard.

**Follow-up interviewer hay hỏi:**
1. *"Zone sharding dùng khi nào?"* — Data residency (orders user VN nằm DC VN) hoặc tiering (orders > 2 năm về shard máy rẻ): gắn tag range của shard key vào zone.
2. *"Tại sao không shard theo `{ sellerId: 1 }`?"* — Cardinality lệch nặng: 1 seller lớn (official store) chiếm % đơn khổng lồ → jumbo chunks không split được (mọi doc cùng key value), hot shard theo seller.
3. *"Số lượng shard tính thế nào?"* — Working set / RAM per node + write throughput / khả năng ghi mỗi node + headroom 30–40%; ví dụ 1TB data, working set 20% = 200GB, node 64GB RAM hữu dụng → tối thiểu 4–5 shard, lấy 6–8 cho tăng trưởng.

---

## 🌍 Case thực tế

### Case 1: Embed quá tay — document chạm 16MB và update ngày càng chậm

**Bối cảnh:** Startup logistics ở VN xây hệ thống quản lý vận đơn trên MongoDB. Team thiết kế document `shipment` nhúng tất cả cho "tiện đọc": toàn bộ `trackingEvents` (mỗi lần xe quét mã = 1 event), `statusHistory`, ảnh proof-of-delivery dạng base64.

**Vấn đề gặp phải:**
- Vận đơn liên tỉnh nhiều chặng tích lũy hàng nghìn tracking events; vài tháng sau xuất hiện lỗi `BSONObjectTooLarge` (chạm 16MB) ở các đơn fulfillment lớn.
- Trước cả khi vỡ limit, hệ thống đã chậm dần: mỗi `$push` event vào mảng lớn khiến Mongo phải rewrite/move document ngày càng to; WiredTiger cache toàn document khủng dù app chỉ cần status mới nhất → cache hit ratio giảm, mọi query chậm theo.
- Mảng `trackingEvents` không bound → unbounded array là anti-pattern số 1 của Mongo.

**Giải pháp & tại sao:**
1. Tách `trackingEvents` ra collection riêng, reference bằng `shipmentId` + index `{ shipmentId: 1, ts: -1 }` — event là append-only, ghi nhanh, đọc phân trang.
2. Trên document `shipment` chỉ giữ cái màn hình chính cần: `currentStatus`, `lastEvent` (denormalized), `eventCount` — đây là **Subset Pattern**: nhúng N phần tử mới nhất, phần còn lại reference.
3. Ảnh POD chuyển sang S3, document chỉ lưu URL. Base64 trong DB là tội đồ kích thước.
4. Migration online: dual-write 2 tuần, backfill bằng batch job, verify count rồi cắt read path.

**Bài học rút ra:**
- Câu hỏi đúng khi thiết kế không phải "dữ liệu này thuộc về ai" mà là **"dữ liệu này được đọc cùng nhau không và mảng có bound không"**.
- Mảng tăng vô hạn theo thời gian (events, logs, messages) → luôn tách collection hoặc bucket ngay từ đầu.
- 16MB limit là triệu chứng cuối; performance đã chết từ từ trước đó rất lâu.

**💬 Cách dùng case này khi phỏng vấn:** Khi được hỏi "embedded vs reference", đừng chỉ trả lời lý thuyết — kể: *"Em từng gặp/biết một hệ thống nhúng tracking events vào shipment đến vỡ 16MB; từ đó rule của em là mảng unbounded thì bắt buộc reference, và dùng subset pattern giữ N phần tử mới nhất cho read path."*

### Case 2: Shard key theo ngày tạo → hot shard

**Bối cảnh:** Hệ thống thu thập dữ liệu giao dịch của một fintech, collection `transactions` sharded MongoDB, team chọn shard key `{ createdAt: 1 }` vì "báo cáo toàn query theo ngày, cho nó nhanh".

**Vấn đề gặp phải:**
- Vì `createdAt` tăng đơn điệu, **100% inserts luôn rơi vào chunk có range cao nhất** → một shard duy nhất nhận toàn bộ write trong khi 7 shard còn lại gần như idle. Cluster 8 shard nhưng write throughput = throughput của 1 máy.
- Balancer liên tục split & migrate chunk nóng → chiếm disk I/O, làm shard nóng càng nghẹt; alert latency nổ vào đúng giờ cao điểm giao dịch.
- Mua thêm shard không giải quyết gì — tiền đốt vô ích, vì điểm nghẽn là *phân phối key*, không phải capacity.

**Giải pháp & tại sao:**
1. Reshard sang `{ accountId: "hashed" }` (Mongo 5.0 `reshardCollection`; với version cũ hơn phải dual-write + backfill sang collection mới): write rải đều mọi shard ngay lập tức; query nóng nhất ("giao dịch của account X") thành targeted.
2. Báo cáo theo ngày — query đã hi sinh — chuyển sang chạy trên warehouse (BigQuery/ClickHouse) sync từ change streams; báo cáo batch không có quyền quyết định shard key của hệ thống OLTP.
3. Nếu thật sự cần cả hai trên Mongo: compound key dạng `{ coarseTimeBucket: 1, accountId: "hashed" }`-style cũng được bàn nhưng bị loại vì vẫn dồn write vào bucket thời gian hiện tại.

**Bài học rút ra:**
- Monotonic key (timestamp, auto-increment, ObjectId thô) làm shard key = hot shard, gần như không có ngoại lệ.
- Chọn shard key theo **write distribution + query nóng nhất của OLTP**, đừng chọn theo nhu cầu báo cáo — báo cáo có thể offload.
- "Thêm máy" không chữa được bệnh phân phối key — phải chẩn đoán đúng tầng.

**💬 Cách dùng case này khi phỏng vấn:** Khi bàn về sharding, chủ động nói: *"Red flag đầu tiên em check là shard key có monotonic không — em từng thấy cluster 8 shard mà write throughput bằng 1 máy vì shard theo createdAt; hashed theo accountId mới giải quyết được."*

### Case 3: Hybrid SQL + Mongo trong cùng một hệ thống — và cách biện luận

**Bối cảnh:** Sàn e-commerce quy mô vừa (kiểu Haravan/Sapo merchants hoặc một sàn ngách): module `orders` + payment + inventory, và module `catalog` sản phẩm với attributes động theo ngành hàng. Team tranh cãi "all-in Postgres" vs "all-in Mongo".

**Vấn đề gặp phải:**
- Đặt hàng cần **transaction đa bảng thật sự**: trừ tồn kho + tạo order + ghi payment intent — atomic, có FK, có constraint chống oversell. Làm trên Mongo được (multi-doc transaction từ 4.0) nhưng chậm hơn, lock dài hơn, và mọi invariant (số dư không âm, FK) phải tự enforce bằng code.
- Catalog thì ngược lại: schema theo ngành hàng thay đổi hàng tuần; trên Postgres thuần (không JSONB) mỗi lần thêm attribute là một migration + bảng EAV query khổ sở (xem Bài 1).
- Khi all-in một DB, một nửa hệ thống luôn "gồng mình" làm việc nó không giỏi.

**Giải pháp & tại sao:**
1. **Orders/payment/inventory → Postgres**: ACID transaction, `CHECK (stock >= 0)`, FK, `SERIALIZABLE` khi cần — đúng nghĩa "money path cần constraints do DB enforce, không tin code".
2. **Catalog → MongoDB**: attribute pattern (Bài 1), seller tự thêm attribute không cần migration, read scale bằng secondaries.
3. Khâu nối: order line **snapshot** tên/giá/ảnh sản phẩm tại thời điểm mua vào row order (đúng cả về nghiệp vụ — giá lúc mua không được đổi theo catalog), nên **không cần cross-DB join hay cross-DB transaction** — đây là chìa khóa khiến hybrid khả thi.
4. Chi phí thừa nhận thẳng: 2 hệ DB = 2 bộ backup, monitoring, expertise; team nhỏ phải cân nhắc — nếu chỉ có 3 backend dev, Postgres + JSONB cho catalog là lựa chọn B hợp lý.

**Bài học rút ra:**
- Polyglot persistence chọn theo **access pattern và invariant**, không theo trend: cần DB-enforced invariants → SQL; cần schema động + document read → Mongo.
- Ranh giới giữa 2 DB phải đặt ở chỗ **không cần transaction xuyên qua** — nếu nghiệp vụ buộc transaction xuyên 2 store, thiết kế ranh giới sai rồi.
- Luôn nêu được phương án 1-DB (Postgres + JSONB) và lý do vì sao chọn/không chọn — interviewer đánh giá cách cân nhắc hơn là kết luận.

**💬 Cách dùng case này khi phỏng vấn:** Khi bị hỏi "SQL hay NoSQL?", trả lời bằng framework thay vì phe phái: *"Em chọn theo invariant và access pattern — ví dụ hệ trước em để orders ở Postgres vì cần transaction và constraint chống oversell, còn catalog ở Mongo vì schema động; ranh giới đặt ở chỗ order snapshot dữ liệu sản phẩm nên không bao giờ cần transaction xuyên 2 DB."*

---

## ✅ Checklist tự kiểm tra

1. Tôi có nêu được quy tắc quyết định embed vs reference (đọc cùng nhau? mảng có bound? one-to-few hay one-to-squillions?) và áp dụng vào một ví dụ cụ thể trong 2 phút không?
2. Tôi có giải thích được Attribute Pattern giải quyết vấn đề gì, vì sao 1 multikey index `{attrs.k, attrs.v}` thay được hàng trăm index, và khi nào nó thua Elasticsearch không?
3. Cho một bộ query patterns bất kỳ, tôi có chấm điểm được 3 ứng viên shard key theo cardinality / write distribution / query isolation, và chỉ ra ngay key monotonic là bẫy không?
4. Tôi có trình bày được ít nhất 2 cách xử lý counter ở high write (counter cache + $inc, Redis buffer + flush, sharded counter) và khi nào dùng cách nào không?
5. Tôi có vẽ được sơ đồ comment system với materialized path và nói được khi nào nâng cấp lên bucket pattern không?
6. Tôi có biện luận được một kiến trúc hybrid SQL + NoSQL: tiêu chí chọn, ranh giới đặt ở đâu, và chi phí vận hành phải trả không?
7. Nếu interviewer hỏi "denormalize thì update thế nào?", tôi có sẵn câu trả lời về snapshot-theo-nghiệp-vụ, batch update, change streams, và reconcile job không?
