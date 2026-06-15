# Bài toán System Design kinh điển — Phần 1: Lời giải chi tiết

> Tài liệu này viết theo đúng flow một buổi phỏng vấn system design 45-60 phút: **Clarify → Estimate → High-level → Deep dive → Trade-offs → Follow-up**. Mỗi bài đều có góc nhìn "ở vai Node.js backend engineer thì kể những gì" — vì interviewer luôn muốn nghe bạn map design vào công nghệ bạn thực sự dùng.

> ⚠️ Quy tắc vàng: interviewer KHÔNG chấm bạn vì vẽ được kiến trúc "đúng đáp án". Họ chấm vì bạn **đặt câu hỏi đúng, ước lượng có cơ sở, nói được trade-off, và tự dẫn dắt cuộc nói chuyện**.

---

## Bài 1: Design News Feed (Facebook/Instagram feed)

### 🎤 Cách nhà tuyển dụng đặt câu hỏi

Câu hỏi gốc:
> "Hãy thiết kế news feed như Facebook — user follow nhau, post bài, và thấy feed gồm các bài mới nhất từ người mình follow."

Các biến thể hay gặp:
- "Design Twitter timeline" (gần như identical, nhấn mạnh celebrity problem hơn).
- "Design Instagram" (thêm phần media storage, nhưng lõi vẫn là feed).
- "Hệ thống đang fan-out on write, một celebrity 50M followers post bài thì chuyện gì xảy ra?" (đi thẳng vào deep dive — họ muốn test bạn đã từng nghĩ về hybrid chưa).
- "Feed của ta đang sort theo thời gian, giờ muốn ranking theo mức độ quan tâm thì kiến trúc đổi thế nào?"

Tín hiệu interviewer muốn thấy: bạn **chủ động nêu fan-out on write vs on read** mà không cần gợi ý — đây là "trái tim" của bài này.

### Bước 1: Clarify requirements

Câu hỏi bạn NÊN hỏi lại (hỏi 4-6 câu, đừng hỏi 15 câu):
1. "Feed sort theo thời gian (chronological) hay theo ranking? Em đề xuất bắt đầu với chronological rồi bàn ranking ở deep dive." → Interviewer thường đồng ý.
2. "Quy mô bao nhiêu DAU? Một user follow trung bình bao nhiêu người?" 
3. "Có celebrity (hàng chục triệu followers) không?" → Câu này ghi điểm lớn vì cho thấy bạn biết trước vấn đề.
4. "Post chỉ là text hay có ảnh/video?" → Thường chốt: text + ảnh, media để ngoài scope (chỉ lưu URL).
5. "Độ trễ chấp nhận được khi load feed? Post xong bao lâu thì follower thấy?" → Thường: load feed < 200ms, post xuất hiện trong vài giây (eventual consistency OK).

**Functional requirements (chốt lại):**
- User post bài (text + ảnh).
- User follow/unfollow user khác.
- User xem feed: bài mới nhất từ những người mình follow, có pagination (infinite scroll).

**Non-functional requirements:**
- 300M DAU, read-heavy (xem feed nhiều hơn post rất nhiều).
- Feed load p99 < 200ms.
- Eventual consistency chấp nhận được (post xuất hiện trễ vài giây không sao) — nhưng **read-your-own-write**: chính mình phải thấy bài mình vừa đăng ngay.
- Highly available — feed sập là sự cố P0.

### Bước 2: Ước lượng quy mô (back-of-envelope)

Nói to từng bước tính — interviewer chấm cách bạn suy luận, không chấm số đúng tuyệt đối.

- **DAU**: 300M. Mỗi user mở feed ~10 lần/ngày, mỗi lần load ~2 trang → 300M × 20 = **6B feed reads/ngày**.
- **Read QPS**: 6B / 86,400s ≈ **70K QPS**, peak ×2-3 → **~200K QPS read**.
- **Write (post)**: 10% user post/ngày, mỗi người 1-2 bài → ~50M posts/ngày ≈ **600 QPS write**, peak ~2K QPS.
- → **Read:Write ≈ 100:1** → kết luận quan trọng cần NÓI RA: *"hệ thống read-heavy nặng, nên em sẽ tối ưu đường read bằng precompute + cache, chấp nhận write đắt hơn."*
- **Storage**: mỗi post metadata ~1KB (text 500 bytes + user_id, timestamps, media URLs). 50M posts/ngày × 1KB = **50GB/ngày** ≈ 18TB/năm (chưa tính media — media nằm ở object storage + CDN, ngoài scope).
- **Fan-out write**: trung bình 1 user có 200 followers → 50M posts × 200 = **10B cache insertions/ngày** ≈ 120K ops/s. Con số này lớn → cần message queue + workers, không làm sync trong request.
- **Cache feed**: mỗi user cache 500 post IDs gần nhất × 8 bytes/ID ≈ 4KB/user (+ overhead). 300M user × ~5KB ≈ **1.5TB RAM** → Redis Cluster vài chục node. Khả thi.

### Bước 3: High-level design

```
                                   ┌──────────────┐
  Client ──► CDN (media) ─────────►│ Object Store │
    │                              └──────────────┘
    ▼
┌──────────────┐      ┌─────────────────┐
│ Load Balancer│─────►│  API Gateway     │ (auth, rate limit)
└──────────────┘      └────────┬────────┘
                       ┌───────┴────────────┐
              write    ▼                    ▼   read
              ┌────────────────┐   ┌────────────────┐
              │ Post Service   │   │ Feed Service   │
              │ (Node.js)      │   │ (Node.js)      │
              └───┬───────┬────┘   └───┬───────┬────┘
                  │       │            │       │
        save post ▼       ▼ publish    ▼       ▼ fallback
            ┌─────────┐ ┌────────┐ ┌─────────┐ ┌──────────┐
            │ Post DB │ │ Kafka  │ │ Redis    │ │ Post DB │
            │(sharded)│ └───┬────┘ │ Feed     │ │ + Graph │
            └─────────┘     │      │ Cache    │ │ DB      │
                            ▼      └─────────┘ └──────────┘
                   ┌────────────────┐    ▲
                   │ Fan-out Workers│────┘  (đẩy post_id vào
                   └───────┬────────┘       feed list của followers)
                           │ lookup followers
                           ▼
                   ┌────────────────┐
                   │ Social Graph DB│ (user_id → follower list)
                   └────────────────┘
```

**Luồng write (đăng bài):**
1. Client → `POST /v1/posts` → Post Service validate, ghi vào Post DB (sharded by `post_id` hoặc `user_id`).
2. Post Service publish event `{post_id, author_id, created_at}` vào Kafka → trả 200 ngay (write path nhanh).
3. Fan-out Workers consume: query Social Graph lấy follower list của author, rồi `LPUSH` `post_id` vào Redis list `feed:{follower_id}` của từng follower, `LTRIM` giữ 500 phần tử.

**Luồng read (xem feed):**
1. Client → `GET /v1/feed?cursor=...` → Feed Service.
2. Feed Service đọc `feed:{user_id}` từ Redis → có sẵn danh sách post IDs đã precompute → **hydrate**: batch-get post content + author info (từ post cache, miss thì DB) → trả về.
3. Cache miss (user lâu không hoạt động, feed bị evict): fallback pull model — query bài mới nhất từ những người user follow, merge, rebuild cache.

**Ở vai Node.js engineer kể gì:** Feed Service là dạng I/O-bound điển hình — Node.js rất hợp. Hydrate post bằng `Promise.all` + Redis `MGET`/pipeline thay vì gọi tuần tự; dùng DataLoader pattern để batch + dedupe lookup author. Fan-out worker là consumer Kafka (`kafkajs`), xử lý theo batch, ghi Redis bằng pipeline để giảm round-trip.

### Bước 4: Deep dive

#### 4.1 Fan-out on write vs fan-out on read — và hybrid cho celebrity problem

Đây là phần interviewer chắc chắn xoáy. Trình bày như bảng so sánh:

| | Fan-out on write (push) | Fan-out on read (pull) |
|---|---|---|
| Cách hoạt động | Post xong, đẩy post_id vào feed cache của TẤT CẢ followers | Lúc user mở feed mới query bài từ tất cả người họ follow rồi merge |
| Read latency | Rất nhanh (đọc 1 list có sẵn) | Chậm (N queries + merge mỗi lần đọc) |
| Write cost | Đắt: celebrity 50M followers → 50M writes cho 1 post | Rẻ: ghi 1 lần |
| Lãng phí | Tốn công cho user không bao giờ online | Không lãng phí |
| Hợp với | User thường (followers ít, read nhiều) | Celebrity, user ít hoạt động |

**Celebrity problem**: nếu pure push, 1 post của celebrity 50M followers tạo 50M cache writes → spike khổng lồ, hàng queue tắc, post của user thường bị delay theo. 

**Hybrid (đáp án mong đợi):**
- User có < N followers (ví dụ 100K): **push** như bình thường.
- Celebrity (≥ 100K followers): **không fan-out**. Đánh dấu trong profile.
- Khi user đọc feed: lấy precomputed list từ Redis **+** query riêng các bài mới của những celebrity mà user follow (danh sách celebrity một user follow thường ngắn — vài chục) → **merge tại read time** theo timestamp.
- Bài mới của celebrity được cache nóng riêng (`celebrity_posts:{celebrity_id}`) nên phần pull này vẫn nhanh.

Nói thêm 1 câu ăn điểm: *"Ngưỡng 100K không hard-code mãi mãi — nên đo cost thực tế (write amplification vs read latency) để tune; và user inactive > 30 ngày cũng có thể chuyển sang pull để khỏi lãng phí fan-out."*

#### 4.2 Schema DB & sharding

```sql
-- Post DB (MySQL/Postgres sharded, hoặc Cassandra)
posts(post_id BIGINT PK,      -- Snowflake ID: timestamp-ordered, sortable
      author_id BIGINT,
      content TEXT,
      media_urls JSON,
      created_at TIMESTAMP)
-- index (author_id, created_at DESC) để pull bài theo author

-- Social graph (quan hệ follow)
follows(follower_id, followee_id, created_at)
  -- 2 bảng/2 index: theo follower_id (lấy "tôi follow ai")
  -- và theo followee_id (lấy "ai follow tôi" — cần cho fan-out)
```

- **Snowflake ID** thay vì auto-increment: 64-bit = timestamp + machine_id + sequence → generate phân tán không cần điểm tập trung, và ID tự sort theo thời gian → dùng làm cursor pagination luôn.
- **Sharding**: posts shard theo `author_id` (lấy tất cả bài 1 người trên 1 shard — cần cho pull model). Graph shard theo user_id. Cẩn thận hot shard với celebrity → cache đỡ phần lớn.

#### 4.3 Feed ranking (khi interviewer hỏi "không sort theo thời gian nữa thì sao?")

- Kiến trúc đổi: feed cache không còn là list sort theo thời gian, mà là **2 bước: candidate generation → scoring**.
- Fan-out vẫn đẩy post_id vào "candidate pool" của user (ví dụ 500 bài gần nhất). Khi đọc, Feed Service gọi **Ranking Service**: lấy features (affinity user-author, loại content, engagement dự đoán, độ mới) → model chấm điểm → sort theo score.
- Trade-off: scoring at read time tăng latency → cache kết quả ranking vài phút; hoặc pre-rank bằng worker cho user active.
- Ở vai backend: bạn không cần biết ML model, chỉ cần nói rõ **contract**: gửi batch (user_id, [post_ids + features]) → nhận scores, p99 budget ~50ms, có fallback sort theo thời gian nếu ranking service down (graceful degradation).

#### 4.4 Pagination cho infinite scroll

- **Đừng dùng offset** (`LIMIT 20 OFFSET 40`): feed thay đổi liên tục → trùng/sót bài khi có post mới chen vào, và offset lớn thì DB scan đắt.
- **Cursor-based**: trả `next_cursor = post_id cuối cùng` (Snowflake ID đã sort theo thời gian) → request sau: "cho tôi 20 bài có id < cursor". Ổn định, O(1).
- Redis list: trang đầu `LRANGE feed:{uid} 0 19`; các trang sau dùng cursor lọc — hoặc dùng **ZSET** (score = timestamp) với `ZREVRANGEBYSCORE` để cursor tự nhiên hơn.

### Bước 5: Trade-offs & bottlenecks

| Quyết định | Đánh đổi | Lý do chọn |
|---|---|---|
| Push (precompute feed) | Write amplification ×200, tốn 1.5TB RAM | Read 100:1, latency đọc là KPI số 1 |
| Hybrid cho celebrity | Code phức tạp hơn (2 đường đọc + merge) | Tránh write storm 50M ops/post |
| Eventual consistency | Follower thấy bài trễ vài giây | UX chấp nhận được; đổi lấy throughput |
| Redis làm feed store | Mất cache → rebuild đắt | Có fallback pull; bật AOF/replica để giảm xác suất |
| Cursor pagination | Không jump đến trang N | Feed không ai jump trang N |

**Bottlenecks & xử lý:**
- **Fan-out lag giờ cao điểm**: queue depth tăng → scale workers theo lag; tách topic riêng cho user nhiều followers để không block user thường; ưu tiên fan-out đến follower đang active trước.
- **Hot key Redis** (feed của user nổi tiếng được đọc dồn dập? — không, feed là per-user; hot key thật là `celebrity_posts:*`) → replicate key đó ra nhiều node, hoặc cache local in-process (LRU vài giây) ở Feed Service.
- **Thundering herd khi cache miss đồng loạt** (Redis node chết): request coalescing — chỉ 1 request rebuild, số còn lại chờ (Node.js: giữ map `inflightPromises` theo key, các caller cùng key `await` chung 1 promise).

### ❓ Follow-up questions interviewer hay hỏi tiếp

1. **"Unfollow thì feed cập nhật thế nào?"** → Không cần xóa ngay khỏi cache (đắt); filter at read time (check còn follow không) hoặc lazy: chấp nhận vài bài cũ còn sót đến khi feed tự trôi. Nếu là block (nghiêm trọng hơn) → xóa chủ động.
2. **"Xóa/sửa post thì sao?"** → Feed chỉ lưu post_id, nội dung hydrate lúc đọc → sửa post tự có hiệu lực; xóa post → hydrate trả null, filter ra, và backfill thêm 1 bài cho đủ trang.
3. **"Làm sao user thấy ngay bài mình vừa đăng?"** → Read-your-own-write: ghi bài vào feed cache của chính author sync trong request, hoặc client-side optimistic insert.
4. **"Redis cluster sập thì sao?"** → Degrade sang pull model (chậm hơn nhưng sống); circuit breaker + giới hạn QPS xuống DB để không kéo sập DB theo.
5. **"Đo lường gì để biết hệ thống khỏe?"** → Feed load p99, fan-out lag (giây từ post → xuất hiện trong feed), cache hit ratio, Kafka consumer lag.
6. **"Feed có cần đếm like/comment realtime không?"** → Counter là bài toán riêng: đếm trong Redis (`INCR`), flush về DB theo batch; số liệu hiển thị chấp nhận xấp xỉ/trễ.

---

## Bài 2: Design Chat App (Messenger/WhatsApp)

### 🎤 Cách nhà tuyển dụng đặt câu hỏi

Câu hỏi gốc:
> "Thiết kế hệ thống chat như WhatsApp: nhắn tin 1-1, group chat, trạng thái sent/delivered/seen, online status."

Biến thể hay gặp:
- "Design Slack" (nhấn channel/group lớn + search message).
- "Hai user ở 2 server WebSocket khác nhau thì message đi thế nào?" (đi thẳng vào routing — câu này lọc người chỉ học vẹt).
- "Làm sao đảm bảo message không mất và đúng thứ tự?"
- "User offline 3 ngày, mở app lên thì sync thế nào?"

### Bước 1: Clarify requirements

Câu hỏi nên hỏi lại:
1. "Chat 1-1 và group? Group tối đa bao nhiêu thành viên?" → Chốt: 1-1 + group ≤ 500 (như WhatsApp; group 100K kiểu Telegram channel là bài khác).
2. "Cần sent/delivered/seen receipts và online presence không?" → Có.
3. "Message là text hay cả media?" → Text + media (media qua object storage, chat chỉ truyền URL).
4. "Có cần end-to-end encryption không?" → Thường để ngoài scope, nhưng NÊU RA được là điểm cộng (E2EE nghĩa là server không đọc được nội dung → ảnh hưởng search, ranking).
5. "Lưu lịch sử bao lâu? Multi-device không?" → Lưu vĩnh viễn; bắt đầu single-device, multi-device bàn ở follow-up.

**Functional:** gửi/nhận message 1-1 và group realtime; trạng thái sent/delivered/seen; online/last seen; lịch sử chat + sync khi online lại; push notification khi offline.

**Non-functional:** 100M DAU; latency gửi→nhận < 500ms cùng region; **không được mất message** (durability là số 1, hơn cả latency); message trong 1 cuộc hội thoại phải đúng thứ tự; hàng triệu kết nối concurrent.

### Bước 2: Ước lượng quy mô (back-of-envelope)

- **DAU 100M**, mỗi user gửi ~40 messages/ngày → **4B messages/ngày** ≈ **46K msg/s**, peak ~150K msg/s.
- Mỗi message gửi đi kéo theo ~2-3 lần deliver (recipient + receipts ngược lại) → đường push ~300-500K ops/s peak.
- **Concurrent connections**: ~30% DAU online cùng lúc giờ peak → **30M WebSocket connections**. Một server tuned tốt giữ ~200K-1M connections (chủ yếu giới hạn bởi memory ~10KB/conn và heartbeat CPU) → cần **50-150 chat servers**. Đây là con số quan trọng nhất bài này — nó dẫn tới bài toán routing giữa các server.
- **Storage**: message trung bình ~100 bytes text + ~200 bytes metadata = 300 bytes. 4B/ngày × 300B = **1.2TB/ngày** ≈ 440TB/năm → bắt buộc DB scale ngang, write-heavy → trỏ tới Cassandra-style.
- **Bandwidth**: 1.2TB/ngày ≈ 14MB/s trung bình — nhỏ; bandwidth không phải bottleneck, **số connection và write throughput mới là bottleneck**.

### Bước 3: High-level design

```
 User A                                                User B
   │  WebSocket                                WebSocket │
   ▼                                                     ▼
┌────────────┐                                   ┌────────────┐
│ Chat Server│                                   │ Chat Server│
│   WS-1     │                                   │   WS-7     │
└──┬─────┬───┘                                   └─────▲──────┘
   │     │ (B ở server nào?)                           │
   │     ▼                                             │
   │  ┌──────────────────┐     route/publish      ┌────┴─────┐
   │  │ Session Registry │ ──────────────────────►│ Redis    │
   │  │ (Redis:          │                        │ Pub/Sub  │
   │  │  user→server)    │                        │ /Kafka   │
   │  └──────────────────┘                        └──────────┘
   │ persist (trước khi ack)
   ▼
┌─────────────────┐    ┌──────────────────┐   ┌─────────────────┐
│ Message Store   │    │ Presence Service │   │ Push Notif Svc  │
│ (Cassandra)     │    │ (Redis TTL keys) │   │ (APNs/FCM)      │
└─────────────────┘    └──────────────────┘   └─────────────────┘

 HTTP API (stateless): login, lấy lịch sử chat, search, upload media
```

**Luồng gửi message 1-1 (A → B):**
1. A gửi message qua WebSocket đến WS-1, kèm `client_msg_id` (UUID phía client — để dedupe khi retry).
2. WS-1 **persist message vào Cassandra trước**, rồi mới ack về A → A hiển thị ✓ (sent). *Persist-then-ack là nguyên tắc không mất message.*
3. WS-1 tra Session Registry: B đang ở WS-7 → publish message tới WS-7 (qua Redis Pub/Sub channel theo server, hoặc Kafka topic partition theo user).
4. WS-7 đẩy xuống B; B ack lại → receipt "delivered" chạy ngược về A → ✓✓.
5. B mở conversation → gửi "seen" → A thấy ✓✓ xanh.
6. Nếu B offline (không có entry trong registry): message đã nằm trong Cassandra (đóng vai trò inbox luôn) → trigger Push Notification Service gửi FCM/APNs. Khi B online lại sẽ sync (xem deep dive).

**Ở vai Node.js engineer kể gì:** Node.js cực hợp cho chat server — event loop giữ hàng trăm nghìn idle connections rẻ. Dùng `ws` (nhẹ, raw WebSocket) thay vì Socket.IO khi tự kiểm soát protocol; Socket.IO nếu muốn sẵn fallback + room abstraction + redis-adapter. Nhớ nói: **heartbeat ping/pong** để phát hiện dead connection, **backpressure** (check `bufferedAmount`/`socket.send` callback, ngắt client đọc chậm), graceful shutdown (drain connections khi deploy), và sticky LB ở layer 4 — WebSocket là stateful, scale chat server khác hẳn scale HTTP stateless.

### Bước 4: Deep dive

#### 4.1 WebSocket vs polling, và bài toán routing cross-server

- **Short polling**: client hỏi mỗi 2s → lãng phí, latency tệ, 100M user giết server. Loại.
- **Long polling**: giữ request đến khi có data → đỡ hơn nhưng vẫn tốn chu kỳ reconnect, khó nhận receipts 2 chiều. Dùng làm fallback.
- **WebSocket**: full-duplex, 1 connection bền → chuẩn cho chat. Trade-off: stateful → LB phải sticky, deploy/restart phải drain, cần heartbeat + auto-reconnect với exponential backoff phía client.
- (Nói thêm nếu kịp: SSE chỉ 1 chiều server→client, hợp notification hơn chat.)

**Routing cross-server** (câu hỏi lọc ứng viên): user A ở WS-1, B ở WS-7 — WS-1 làm sao chuyển message?
- **Session Registry**: Redis hash `session:{user_id} → {server_id, connected_at}`, có TTL + được heartbeat refresh. Connect thì SET, disconnect thì DEL.
- Cách 1 — **Redis Pub/Sub**: mỗi chat server subscribe channel `server:{id}` của mình; WS-1 PUBLISH vào `server:7`. Đơn giản, latency thấp; nhược: Pub/Sub là fire-and-forget, message rớt nếu subscriber chết — chấp nhận được vì Cassandra mới là source of truth, client sẽ sync lại được.
- Cách 2 — **Kafka** partition theo `user_id`: durable, ordered, nhưng latency cao hơn và consumer group rebalance phức tạp khi server scale lên xuống. 
- Đáp án thực dụng: Pub/Sub cho đường realtime + Cassandra là durability layer → mất push realtime thì sync bù.

#### 4.2 Message storage — vì sao Cassandra-style wide column

So sánh nhanh (interviewer thích nghe phân tích lựa chọn hơn là nghe tên DB):
- **RDBMS sharded**: làm được, nhưng 1.2TB/ngày write-heavy → B-tree write amplification, sharding + reshard thủ công mệt.
- **MongoDB**: OK, nhưng pattern truy cập của chat quá khớp wide-column nên Cassandra/ScyllaDB/HBase là lựa chọn "kể chuyện" tốt nhất.
- **Cassandra**: LSM-tree → write rẻ (đúng workload), scale ngang tuyến tính, và mô hình partition khớp hoàn hảo:

```
CREATE TABLE messages (
  channel_id   bigint,      -- conversation id (1-1 hoặc group)
  bucket       int,         -- tháng, vd 202606 → chặn partition phình quá lớn
  message_id   timeuuid,    -- time-ordered, unique
  sender_id    bigint,
  content      text,
  media_url    text,
  PRIMARY KEY ((channel_id, bucket), message_id)
) WITH CLUSTERING ORDER BY (message_id DESC);
```

- Partition key `(channel_id, bucket)` → toàn bộ message 1 cuộc hội thoại trong 1 tháng nằm gọn 1 partition, đọc "50 tin gần nhất" = 1 sequential read. Bucket theo tháng để partition không vượt ~100MB (anti-pattern của Cassandra là partition vô hạn).
- `channel_id` cho chat 1-1: derive ổn định từ cặp user, vd `hash(min(u1,u2), max(u1,u2))` → 2 chiều chung 1 channel.
- Trade-off phải tự nói: Cassandra không có transaction/join, query phải biết trước access pattern; "seen status" cập nhật nhiều → giữ ở bảng/Redis riêng (`conversation_state: last_seen_message_id per user`) chứ đừng update từng message row.

#### 4.3 Message ordering & delivery status

- **Đừng dùng timestamp client** (clock skew) và đừng hứa "global ordering" — chỉ cần **ordering trong 1 conversation**.
- Cấp **sequence number per channel**: cách nhẹ là `timeuuid`/Snowflake tại server persist; chặt chẽ hơn là `INCR seq:{channel_id}` trên Redis. Client sort theo seq; nếu thấy hổng (nhận seq 10 mà chưa có 9) → kéo bù từ store.
- **Delivery states**: 
  - ✓ sent = server đã persist (ack sau khi ghi Cassandra).
  - ✓✓ delivered = device người nhận đã ack nhận.
  - ✓✓ xanh = người nhận đã mở conversation; chỉ cần lưu `last_seen_message_id` per (user, channel) — mọi message ≤ nó coi như seen. O(1) thay vì update N rows.
- **Exactly-once là ảo tưởng** — nói câu này ăn điểm: hệ thống thực tế làm **at-least-once + idempotent dedupe**: client retry kèm `client_msg_id`, server check trùng (unique constraint / Redis SETNX trong cửa sổ vài phút) → người nhận không bao giờ thấy double.

#### 4.4 Group chat fan-out & offline sync

**Group (≤500 thành viên):**
1. A gửi vào group → persist 1 bản theo `channel_id` của group (không copy 500 bản nội dung).
2. Fan-out **deliver**: lấy member list (cache trong Redis), tra registry, group theo server đích → publish 1 lần/server thay vì 1 lần/user (giảm 500 publishes xuống ~vài chục).
3. Member offline → cập nhật con trỏ unread + push notification (có collapse: "5 tin nhắn mới từ nhóm X" thay vì 5 notification).
4. Receipts trong group: KHÔNG gửi seen của 500 người về realtime cho nhau (N² storm) → aggregate, query khi user mở "message info".

**Offline sync (user mất mạng 3 ngày):**
- Mỗi user/device giữ **sync cursor**: `last_synced_message_id` per conversation (hoặc 1 sequence per user-inbox).
- Online lại: client gửi cursors → server query Cassandra `message_id > cursor` từng conversation (hoặc bảng inbox per-user) → trả theo trang.
- Quá nhiều hội thoại? Trả về danh sách conversation có tin mới + count trước, lazy-load nội dung khi user mở từng cái — đừng bơm 3 ngày data một cục.

### Bước 5: Trade-offs & bottlenecks

| Quyết định | Đánh đổi | Lý do |
|---|---|---|
| WebSocket | Stateful, deploy khó hơn HTTP | Latency + chi phí/connection thấp nhất |
| Persist-then-ack | Tăng latency gửi (~vài chục ms) | Durability > latency với chat |
| Redis Pub/Sub cho routing | Có thể rớt push realtime | Cassandra bù; đổi lấy độ trễ thấp + đơn giản |
| Cassandra | Không transaction, query cứng | Write-heavy + access pattern khớp 100% |
| Ordering per-channel (không global) | Không so thứ tự giữa 2 hội thoại | Không ai cần; global ordering cực đắt |
| Presence dùng TTL heartbeat | "Online" trễ 5-30s so với thực tế | Chính xác tuyệt đối không đáng giá đó |

**Bottlenecks:**
- **Hot group / hot user**: group 500 người chat dồn dập → fan-out theo server-batch + rate limit per channel.
- **Connection storm sau sự cố** (1 server chết, 500K client reconnect cùng lúc): client jittered exponential backoff; server-side admission control; registry phải chịu được burst SET.
- **Presence write storm**: 30M user heartbeat mỗi 30s = 1M writes/s vào presence → dùng Redis cluster riêng cho presence, TTL key `presence:{uid}` EX 60; hiển thị "online" chỉ fetch lazy khi mở conversation, đừng broadcast mọi thay đổi cho mọi friend.
- **Slow consumer trên WebSocket**: client mạng yếu làm buffer server phình → đo `bufferedAmount`, vượt ngưỡng thì drop connection cho client sync lại sau, bảo vệ memory server.

### ❓ Follow-up questions interviewer hay hỏi tiếp

1. **"Multi-device (WhatsApp Web + phone) thì sao?"** → Registry map `user_id → [device_id → server]`; deliver tới mọi device; mỗi device giữ sync cursor riêng; seen từ device nào cũng cập nhật chung conversation state.
2. **"End-to-end encryption ảnh hưởng gì đến design?"** → Server chỉ thấy ciphertext → không server-side search/moderation; key exchange (Signal protocol) per device; group E2EE phức tạp hơn (sender keys). Kiến trúc deliver gần như giữ nguyên.
3. **"Làm typing indicator thế nào?"** → Ephemeral event qua đường WebSocket, KHÔNG persist, throttle phía client (gửi tối đa 1 event/3s), TTL tự hết.
4. **"Search lịch sử chat?"** → Cassandra không full-text search → CDC/Kafka đẩy sang Elasticsearch, index per user; với E2EE thì chỉ search local trên device.
5. **"Đảm bảo không mất message khi chat server crash giữa chừng?"** → Server crash trước khi persist → client không nhận ack → retry với cùng `client_msg_id`. Crash sau persist trước push → recipient sync bù từ store. Mọi nhánh đều hội tụ nhờ store là source of truth.
6. **"Last seen privacy ('chỉ bạn bè thấy')?"** → Check quyền at read time tại Presence Service, đừng nhân bản trạng thái theo audience.

---

## Bài 3: Design hệ thống đặt vé / Flash sale (Ticketmaster/Shopee flash sale)

### 🎤 Cách nhà tuyển dụng đặt câu hỏi

Câu hỏi gốc:
> "Thiết kế hệ thống bán vé concert: 50,000 vé, mở bán lúc 10h sáng, 1 triệu người vào cùng lúc. Không được bán quá số vé."

Biến thể hay gặp:
- "Design Shopee flash sale: 1000 chiếc iPhone giá 1đ" (giống hệt, inventory thay cho seat).
- "Design BookMyShow/CGV đặt ghế xem phim" (thêm seat map — chọn ghế cụ thể).
- "Hệ thống của em đang oversell, 1000 hàng mà bán ra 1050 đơn — debug và fix thế nào?" (biến thể đi thẳng vào concurrency).
- "User bấm thanh toán 2 lần thì sao?" (idempotency).

Đây là bài test **correctness under contention** — khác hẳn feed/chat vốn test scale read/write. Phải nói rõ: *"bài này consistency quan trọng hơn availability ở đúng thao tác trừ kho."*

### Bước 1: Clarify requirements

Câu hỏi nên hỏi lại:
1. "Chọn ghế cụ thể (reserved seating) hay general admission (chỉ trừ số lượng)?" → Ảnh hưởng lớn đến design. Chốt: general admission làm chính, seat map bàn thêm.
2. "Sau khi giữ chỗ, user có bao nhiêu phút để thanh toán?" → Chốt: 10 phút, hết hạn trả vé về pool.
3. "Một user mua tối đa mấy vé? Có cần chống bot/scalper không?" → Tối đa 4 vé/user; có chống bot.
4. "Thanh toán qua bên thứ ba (Stripe/VNPay)? Mất bao lâu?" → Bên thứ ba, vài giây, có thể fail.
5. "Khi quá tải, ưu tiên gì: ai cũng vào được nhưng chậm, hay xếp hàng công bằng?" → Xếp hàng (virtual waiting queue).

**Functional:** xem event/sản phẩm; giữ chỗ (reserve) → thanh toán → xác nhận; reservation hết hạn sau 10 phút; giới hạn 4 vé/user; hàng chờ ảo khi quá tải.

**Non-functional:** **TUYỆT ĐỐI không oversell** (strong consistency cho inventory); chịu spike 1M users trong phút đầu; công bằng (FIFO tương đối, chống bot); idempotent payment; phần browse có thể eventual consistency thoải mái.

### Bước 2: Ước lượng quy mô (back-of-envelope)

- **Spike**: 1M user đổ vào trong ~60s đầu → **~17K-50K QPS** vào trang event (đỉnh nhọn, không phải tải đều). Phần lớn là **read tĩnh** (thông tin event) → CDN + cache gánh 95%.
- **Write thực sự**: chỉ 50K vé → tối đa ~50K reservation thành công + (1M − 50K) request thất bại/chờ. Insight phải NÓI RA: *"đây là bài toán 1M người tranh 50K suất — vấn đề không phải throughput ghi DB, mà là **contention trên một hot row** (counter tồn kho) và việc reject 95% người một cách rẻ và công bằng."*
- **Inventory ops**: nếu để 1M request cùng `UPDATE` 1 row → row lock serialize toàn bộ, DB nghẹt. Redis single-thread làm atomic decrement ~100K ops/s/instance → 1 instance đủ cho 1 hot item; nhiều item thì shard theo item.
- **Storage**: orders 50K × 1KB = 50MB — không đáng kể. Bài này **không phải bài storage**.
- **Queue**: waiting room giữ 1M entries × ~100 bytes = 100MB Redis — nhẹ.

(Đây là bài duy nhất trong 5 bài mà phần estimate ngắn — hãy nói thẳng với interviewer là trọng tâm nằm ở correctness, họ sẽ đánh giá cao việc bạn phân bổ thời gian đúng.)

### Bước 3: High-level design

```
 1M users
    │
    ▼
┌─────────┐   static content
│   CDN   │◄──────────────────────────────┐
└────┬────┘                               │
     ▼                                    │
┌──────────────┐   ┌────────────────────┐ │
│ Load Balancer│──►│ Virtual Waiting     │ │
└──────────────┘   │ Queue (gatekeeper)  │ │
                   │ Redis sorted set    │ │
                   └─────────┬──────────┘  │
              chỉ N user/s được "thả" vào  │
                             ▼             │
                   ┌──────────────────┐    │
                   │ API Gateway      │────┘
                   │ (auth, rate limit,│
                   │  bot check)      │
                   └───┬──────────┬───┘
                       ▼          ▼
            ┌──────────────┐  ┌──────────────────┐
            │ Reservation  │  │  Order/Payment   │
            │ Service      │  │  Service         │
            │ (Node.js)    │  │  (Node.js)       │
            └──┬────────┬──┘  └───┬──────────┬───┘
               ▼        ▼        ▼           ▼
        ┌──────────┐ ┌───────────────┐ ┌──────────┐
        │ Redis    │ │ Inventory/    │ │ Payment  │
        │ inventory│ │ Order DB      │ │ Gateway  │
        │ (atomic  │ │ (Postgres)    │ │ (Stripe) │
        │  + Lua)  │ │ source of     │ └──────────┘
        └──────────┘ │ truth         │
               ▲     └───────────────┘
               │ expiry events (TTL / delayed queue)
        ┌──────┴──────────┐
        │ Expiry Worker   │ (trả vé về pool sau 10 phút)
        └─────────────────┘
```

**Luồng chính:**
1. User vào → CDN trả trang event. Bấm "Mua" → vào **waiting queue**, nhận `queue_token` + vị trí, client poll/SSE xem thứ tự.
2. Gatekeeper thả user vào theo tốc độ kiểm soát (vd 500 user/s) → user nhận `access_token` có TTL.
3. `POST /reserve` (kèm access_token): Reservation Service **trừ kho atomic trên Redis** → thành công thì tạo reservation TTL 10 phút + ghi DB; thất bại trả "hết vé" ngay (rẻ).
4. User thanh toán trong 10 phút: `POST /pay` với **idempotency key** → gọi payment gateway → thành công: reservation → order CONFIRMED.
5. Hết 10 phút chưa trả tiền: Expiry Worker hoàn kho (`INCRBY` Redis + update DB) → vé quay lại pool cho người trong queue.

**Ở vai Node.js engineer kể gì:** Node.js làm gateway/reservation service tốt vì toàn I/O; nhưng phải nhấn: **đừng giữ inventory trong memory của process Node** (nhiều instance → race) — mọi atomic operation dồn về Redis/DB. Lua script gọi qua `ioredis` `defineCommand` (script được EVALSHA, atomic trên server Redis). Payment webhook handler phải idempotent vì Stripe/VNPay retry webhook. Expiry dùng delayed queue (BullMQ delayed job) thay vì `setTimeout` trong process (process chết là mất timer).

### Bước 4: Deep dive

#### 4.1 Chống oversell: 3 phương án (phần interviewer xoáy nhất)

**Phương án A — Pessimistic locking (khóa trước):**
```sql
BEGIN;
SELECT quantity FROM inventory WHERE item_id = 1 FOR UPDATE; -- giữ row lock
-- check quantity > 0
UPDATE inventory SET quantity = quantity - 1 WHERE item_id = 1;
INSERT INTO reservations ...;
COMMIT;
```
- Đúng tuyệt đối, dễ hiểu. Nhược: 1M request xếp hàng sau 1 row lock → throughput sụp, connection pool cạn, latency tăng dựng đứng. Hợp khi contention THẤP (đặt ghế máy bay thường ngày), không hợp flash sale.

**Phương án B — Optimistic locking (CAS bằng version/điều kiện):**
```sql
UPDATE inventory SET quantity = quantity - 1
WHERE item_id = 1 AND quantity > 0;   -- hoặc AND version = :v
-- affected_rows = 0 nghĩa là thua, retry hoặc báo hết
```
- Không giữ lock lâu, đúng tuyệt đối. Nhược ở flash sale: contention CAO → 99% request fail-and-retry → retry storm tự giết mình. Hợp contention vừa.

**Phương án C — Redis atomic decrement + Lua (đáp án cho flash sale):**
```lua
-- KEYS[1]=stock:item:1, KEYS[2]=bought:item:1:{user_id}
-- ARGV[1]=qty, ARGV[2]=max_per_user
local bought = tonumber(redis.call('GET', KEYS[2]) or '0')
if bought + tonumber(ARGV[1]) > tonumber(ARGV[2]) then return -2 end  -- vượt limit/user
local stock = tonumber(redis.call('GET', KEYS[1]))
if stock < tonumber(ARGV[1]) then return -1 end                        -- hết hàng
redis.call('DECRBY', KEYS[1], ARGV[1])
redis.call('INCRBY', KEYS[2], ARGV[1])
return stock - tonumber(ARGV[1])
```
- Lua script chạy **atomic** trên Redis (single-threaded) → check-limit + check-stock + decrement là MỘT đơn vị, không có race. ~100K ops/s, reject "hết vé" trong sub-ms.
- **Điểm phải tự nói, không chờ hỏi**: Redis là **bộ lọc tốc độ cao, không phải source of truth**. Sau khi qua Redis, ghi reservation xuống DB (qua queue cũng được). Rủi ro: Redis chết sau DECR trước khi DB ghi → mất đồng bộ → cần reconciliation job đối chiếu Redis vs DB định kỳ; Redis bật AOF `everysec` + replica. Vì kho trong Redis được trừ TRƯỚC, sai số nếu có chỉ theo hướng **bán thiếu vài vé** (an toàn) chứ không oversell — nói được câu này là ăn trọn phần này.

| | Pessimistic | Optimistic | Redis + Lua |
|---|---|---|---|
| Correctness | ✅ | ✅ | ✅ (kèm reconcile) |
| Throughput @ contention cao | ❌ sụp | ❌ retry storm | ✅ |
| Độ phức tạp vận hành | Thấp | Thấp | Trung bình (sync 2 nơi) |
| Khi nào dùng | Booking thường | Contention vừa | Flash sale |

#### 4.2 Virtual waiting queue & chống bot

**Vì sao cần queue thay vì rate limit thường:** rate limit reject ngẫu nhiên → unfair + user F5 liên tục càng tăng tải. Queue cho user một **vị trí + kỳ vọng** → họ ngừng bấm F5, tải vào hệ thống lõi trở thành hằng số do MÌNH chọn.

- Cài đặt: Redis Sorted Set `waiting:{event_id}`, member = user_id, score = timestamp vào hàng (`ZADD NX` — vào lại không bị mất chỗ). Vị trí = `ZRANK`. 
- Gatekeeper mỗi giây `ZPOPMIN` N user (N = công suất downstream, vd 500/s — backpressure đúng nghĩa) → phát `access_token` (JWT TTL 5 phút, bind user_id + event_id) → chỉ token hợp lệ mới gọi được `/reserve`.
- Client nhận vị trí qua polling 5s hoặc SSE. Trang chờ serve từ CDN → 1M người chờ gần như không tốn gì.

**Chống bot/scalper (kể 4-5 lớp, không có lớp nào đủ một mình):**
1. Phải login + account age/phone-verified trước giờ mở bán.
2. CAPTCHA tại điểm vào queue (chỉ 1 lần, không phải mỗi request).
3. Rate limit theo user_id + IP + device fingerprint; limit 4 vé/user enforce trong chính Lua script (lớp cuối, không bypass được).
4. Phát hiện hành vi: hàng trăm account chung IP/payment method → flag, hủy đơn sau (Ticketmaster làm thật).
5. Token của queue ký + ngắn hạn → không share/bán token được.

#### 4.3 Idempotency khi thanh toán & reservation TTL

**Idempotency:**
- Client tạo `idempotency_key` (UUID) khi vào trang thanh toán, gửi kèm `POST /pay`. 
- Server: `INSERT INTO payment_requests(idempotency_key UNIQUE, status, response_body)` — request trùng key: nếu IN_PROGRESS → trả 409/chờ; nếu DONE → **trả lại đúng response cũ** (không gọi gateway lần 2). Có thể chặn nhanh bằng Redis `SET key NX EX 86400` trước khi chạm DB.
- Gọi Stripe cũng truyền idempotency key xuống (Stripe hỗ trợ native) → double-protection.
- Webhook từ gateway cũng phải idempotent (gateway retry webhook): xử lý theo `event_id`, đã xử lý thì ack và bỏ qua.

**Reservation TTL — cách hết hạn đúng giờ:**
- Đừng dựa vào Redis key expiry notification làm cơ chế chính (best-effort, có thể trễ/rớt).
- Cách chắc chắn: reservation row trong DB có `expires_at`; **delayed job** (BullMQ delayed 10 phút / Kafka + scheduler) đến giờ thì: nếu status vẫn RESERVED → set EXPIRED + hoàn kho (Redis INCRBY + DB). Kèm sweeper cron quét `expires_at < now AND status = RESERVED` mỗi phút làm lưới an toàn.
- Edge case kinh điển interviewer sẽ thử: **user trả tiền đúng giây thứ 599-601** → mọi chuyển trạng thái RESERVED→CONFIRMED và RESERVED→EXPIRED đều phải là conditional update (`UPDATE ... WHERE status='RESERVED'`) — chỉ một bên thắng. Nếu payment thành công nhưng reservation đã EXPIRED → auto-refund hoặc cấp lại vé nếu pool còn.

#### 4.4 (Nếu hỏi) Reserved seating — chọn ghế cụ thể
- Mỗi ghế là 1 row `seat(event_id, seat_id, status, hold_user, hold_expires_at)` → không còn hot counter duy nhất, contention phân tán theo ghế → optimistic per-seat hoạt động tốt: `UPDATE seats SET status='HELD' WHERE seat_id=? AND status='AVAILABLE'`.
- Seat map hiển thị realtime: cache trạng thái map trong Redis, cập nhật đẩy qua SSE/WebSocket, chấp nhận trễ 1-2s (đằng nào bấm vào ghế cũng re-check atomic).

### Bước 5: Trade-offs & bottlenecks

| Quyết định | Đánh đổi | Lý do |
|---|---|---|
| Redis lọc kho trước DB | Phải reconcile 2 nguồn | Throughput; sai số nghiêng về bán thiếu (an toàn) |
| Waiting queue | User chờ, UX "xếp hàng" | Fair + biến spike thành tải hằng số |
| Reservation 10 phút | Vé bị "giam" bởi người không mua | Không có hold thì checkout race liên tục; TTL trả vé về pool |
| Idempotency key per payment | Thêm 1 bảng + 1 bước | Không bao giờ charge double — bắt buộc |
| Consistency > availability cho inventory | Khi nghi ngờ, từ chối bán | Oversell tệ hơn mất doanh thu vài vé |

**Bottlenecks:**
- **Hot item key trên Redis**: 1 item = 1 key = 1 node gánh hết → với 50K vé có thể **chia kho thành 10 sub-counter** (`stock:item:1:0..9`, mỗi cái 5K), request hash vào 1 bucket, bucket hết thì thử bucket khác — trade-off: phút cuối có thể báo hết nhầm cục bộ → gom bucket lẻ về 1 khi tổng còn ít.
- **DB write sau Redis**: đẩy qua queue ghi async để Redis-pass không bị nghẽn bởi DB; trade-off là cửa sổ nhỏ user "đã giữ chỗ" nhưng DB chưa có row → API đọc reservation phải đọc được từ cache trước.
- **Thundering herd lúc 10:00:00**: countdown phía client + jitter vài giây; mở queue TRƯỚC giờ bán để hấp thụ dần.

### ❓ Follow-up questions interviewer hay hỏi tiếp

1. **"Redis chết ngay giữa flash sale thì sao?"** → Replica + failover (Sentinel/Cluster); trong cửa sổ failover: fail-closed (tạm dừng bán vài giây) chứ không fail-open; sau failover chạy reconcile Redis vs DB. Nhấn mạnh: thà ngừng bán 10s còn hơn oversell.
2. **"Làm sao test được hệ thống không oversell?"** → Load test bắn 100K concurrent vào item 1K hàng, assert tổng đơn CONFIRMED + RESERVED ≤ 1K; chaos test kill Redis/worker giữa chừng; kiểm chứng invariant bằng đối chiếu cuối ngày.
3. **"Hoàn vé/refund thì kho xử lý sao?"** → INCR kho (Redis + DB trong cùng flow như expiry), nhưng quyết định có mở bán lại không là business rule (sát giờ diễn thì không).
4. **"Nhiều event flash sale cùng lúc?"** → Shard theo event/item: mỗi item một key Redis độc lập, queue riêng per event — kiến trúc tự scale ngang vì không có state chung giữa các item.
5. **"User phàn nàn vào queue sớm mà mất chỗ?"** → Queue token ký + persist score; reconnect dùng lại token cũ giữ nguyên score (`ZADD NX`); đây là lý do score = thời điểm vào lần đầu.
6. **"Sao không dùng Kafka làm hàng đợi mua hàng luôn (mọi order vào topic, consumer xử lý tuần tự)?"** → Cũng là một đáp án hợp lệ (serialize qua single partition per item) — trade-off: latency phản hồi "còn/hết hàng" cao hơn (phải chờ consumer), nhưng durable hơn Redis. Nói được cả hai và so sánh là điểm cộng lớn.

---

## Bài 4: Design Search Autocomplete (Google suggest)

### 🎤 Cách nhà tuyển dụng đặt câu hỏi

Câu hỏi gốc:
> "Thiết kế tính năng gợi ý tìm kiếm: user gõ 'di', hiện ra 'dien thoai iphone', 'dien may xanh'... trong vài chục ms."

Biến thể hay gặp:
- "Design typeahead cho thanh search của một e-commerce" (giống hệt, data nhỏ hơn).
- "Top 10 gợi ý lấy từ đâu ra? Tính lúc nào?" (xoáy vào precompute vs realtime).
- "Một sự kiện hot vừa xảy ra, làm sao query mới nổi lên trong gợi ý sau vài phút thay vì hôm sau?" (xoáy vào streaming pipeline).
- "Trie của em to quá không nhét vừa 1 máy thì sao?" (xoáy vào sharding).

### Bước 1: Clarify requirements

Câu hỏi nên hỏi lại:
1. "Gợi ý dựa trên độ phổ biến của query lịch sử, hay search trong catalog sản phẩm?" → Chốt: query log phổ biến (kiểu Google).
2. "Cần bao nhiêu suggestions mỗi lần? Latency mục tiêu?" → Top 5-10; p99 < 100ms (lý tưởng < 50ms vì bắn theo TỪNG keystroke).
3. "Có cần personalization / theo vị trí / theo ngôn ngữ không?" → Bản chính global, personalization bàn deep dive.
4. "Độ tươi: query hot mới cần xuất hiện sau bao lâu?" → Trending: phút; còn lại: cập nhật hàng ngày là đủ.
5. "Có cần lọc nội dung nhạy cảm không?" → Có (blacklist) — nêu ra được là điểm cộng, nhiều ứng viên quên.

**Functional:** gõ prefix → trả top 10 query phổ biến bắt đầu bằng prefix đó; sort theo tần suất (có trọng số thời gian); lọc nội dung cấm.

**Non-functional:** p99 < 100ms (tốt nhất ~20-50ms vì mỗi keystroke 1 request); availability cao; **độ chính xác tuyệt đối của tần suất KHÔNG quan trọng** (xấp xỉ là được — insight quan trọng, mở đường cho mọi quyết định sau); eventual freshness.

### Bước 2: Ước lượng quy mô (back-of-envelope)

- **10M DAU** (search engine cỡ vừa/e-commerce lớn), mỗi user 10 searches/ngày = 100M searches/ngày.
- Mỗi search gõ trung bình ~15 ký tự → ~15 keystroke requests (thực tế ít hơn nhờ client debounce ~150ms, còn ~5-7 request/search) → 100M × 6 ≈ **600M autocomplete reads/ngày ≈ 7K QPS**, peak ~20K QPS. Toàn read tí hon (vài trăm bytes response) → bài toán **latency**, không phải bandwidth.
- **Write**: 100M query logs/ngày — nhưng KHÔNG ghi vào serving store realtime; log → pipeline. Nói rõ tách read path / write path là điểm cộng.
- **Storage cho Trie**: giả sử 1B query unique đã từng xuất hiện, giữ top ~100M query có nghĩa, trung bình 30 bytes/query + tần suất + cấu trúc node → thô ~10-20GB; precompute top-10 tại mỗi node làm tăng thêm vài lần → **~50-100GB** → vẫn nhét vừa RAM của vài node hoặc shard nhẹ. Kết luận: serving in-memory hoàn toàn khả thi.
- **Log storage**: 100M/ngày × 50 bytes ≈ 5GB/ngày raw — đổ data lake, giữ vài tháng cho batch job.

### Bước 3: High-level design

```
            READ PATH (serving, tối ưu từng ms)
 Client ──debounce 150ms──► CDN/Edge cache (prefix ngắn, TTL ~1h)
    │                            │ miss
    ▼                            ▼
┌──────────────┐        ┌─────────────────┐
│ LB / Gateway │───────►│ Suggest Service │ (Node.js, stateless)
└──────────────┘        └───┬─────────┬───┘
                            │         │ miss
                   ┌────────▼──┐  ┌───▼────────────────┐
                   │ Redis     │  │ Trie Servers        │
                   │ prefix→   │  │ (in-memory, sharded │
                   │ top10     │  │  theo prefix range) │
                   └───────────┘  └────────▲───────────┘
                                           │ swap snapshot mới
            WRITE PATH (pipeline, không đụng read path)
 Search Service ──log──► Kafka (query events)
                           │
              ┌────────────┴─────────────┐
              ▼                          ▼
     ┌─────────────────┐       ┌──────────────────────┐
     │ Batch (Spark,   │       │ Streaming (Flink,     │
     │ daily/hourly):  │       │ sliding window 5-60p):│
     │ full aggregate, │       │ đếm trending, top-k   │
     │ build Trie      │       │ xấp xỉ                │
     │ snapshot        │       └──────────┬───────────┘
     └────────┬────────┘                  │ merge boost
              ▼                           ▼
        Object Storage ──► Trie Builder/Loader ──► Trie Servers
```

**Read path:** keystroke → (client debounce + cache local) → edge cache → Suggest Service → Redis (`prefix → top10` đã precompute) → miss thì hỏi Trie server → trả JSON bé xíu. Mục tiêu: đại đa số request chết ở cache trước khi chạm Trie.

**Write path:** mỗi search submit → event vào Kafka → (1) batch job tổng hợp tần suất toàn cục, áp time-decay, build **Trie snapshot mới** mỗi giờ/ngày → Trie servers load snapshot và swap atomic; (2) streaming job đếm cửa sổ trượt phát hiện trending → boost vào kết quả serving gần-realtime.

**Ở vai Node.js engineer kể gì:** Suggest Service là Node.js stateless thuần I/O — hợp. Nhưng nên nói thẳng: **Trie server giữ chục GB cấu trúc trong heap thì Node KHÔNG phải lựa chọn tốt nhất** (GC pause với heap lớn, giới hạn heap V8) → Trie server viết Go/Java/Rust, hoặc nếu buộc dùng Node thì để data trong `Buffer`/off-heap (serialized trie, binary search trên buffer) thay vì object graph. Tự chỉ ra giới hạn của Node đúng chỗ là tín hiệu senior rất mạnh. Client-side: debounce, hủy request cũ bằng `AbortController`, cache prefix đã hỏi.

### Bước 4: Deep dive

#### 4.1 Trie + top-k: precompute vs tính lúc query

Trie cơ bản: mỗi node = 1 prefix; tìm gợi ý cho "di" = đi xuống node `d→i`, rồi lấy các query con phổ biến nhất.

**Naive (tính lúc query):** từ node prefix, DFS toàn bộ subtree, sort theo tần suất, lấy 10. Subtree của prefix ngắn ("a") có hàng triệu node → O(rất to) mỗi keystroke → loại ngay, nhưng NÊU ra để dẫn vào tối ưu.

**Precompute top-k tại mỗi node (đáp án chuẩn):**
```
node "di":
  children: {e: ..., n: ...}
  top10: [("dien thoai iphone", 9.5M), ("dien may xanh", 7.2M), ...]
```
- Lookup = đi xuống đúng node theo prefix O(L) rồi đọc list có sẵn → **O(1) thực tế, sub-ms**.
- Trade-off: storage phình (mỗi node lưu 10 con trỏ/string — giảm bằng cách lưu ID + bảng query riêng), và **update đắt**: 1 query tăng hạng phải sửa top10 dọc mọi prefix tổ tiên → đây chính là lý do **không update Trie online** mà rebuild snapshot offline. Nói được mạch suy luận "vì precompute nên mới sinh ra kiến trúc rebuild-and-swap" là ăn điểm cấu trúc.
- Rebuild-and-swap: builder dựng trie mới từ aggregate → serialize → Trie server load bản mới song song bản cũ → atomic pointer swap → free bản cũ. Zero-downtime, không bao giờ serve trie đang dở.
- Sharding khi không vừa 1 máy: **shard theo prefix range** (a-d / e-k / ...) dựa trên phân bố tải thực tế (không chia đều bảng chữ cái — 'x' ít hơn 'b' rất nhiều); router map prefix→shard; mỗi shard có replicas.

#### 4.2 Data pipeline: batch + streaming (Lambda-style)

Interviewer xoáy: "con số tần suất ở đâu ra, cập nhật thế nào?"

- **Batch layer (chính xác, chậm):** Spark job mỗi giờ/ngày đọc query log → đếm tần suất → áp **time decay** (vd score = Σ count × 0.9^tuổi_theo_ngày — để "world cup 2022" không ám trie vĩnh viễn) → lọc blacklist + spam (1 IP bắn 1 query 1M lần phải bị chặn ở đây) → xuất bảng `query → score` → build trie snapshot.
- **Streaming layer (xấp xỉ, nhanh):** Flink/Kafka Streams đếm trên **sliding window** 5-60 phút. Đếm chính xác top-k trên stream tốn nhớ → dùng cấu trúc xấp xỉ: **count-min sketch** đếm tần suất + min-heap k phần tử giữ top-k ứng viên. Phát hiện query có velocity bất thường ("động đất ở X") → đẩy vào **trending overlay** (bảng nhỏ trong Redis: `prefix → trending queries`).
- **Merge lúc serve:** kết quả = top10 từ trie (ổn định) ⊕ trending overlay (boost lên đầu nếu khớp prefix). Hai layer độc lập: streaming chết thì chỉ mất trending, autocomplete vẫn chạy — graceful degradation có chủ đích.

#### 4.3 Caching nhiều tầng

Liệt kê từ gần user ra xa — và nói rõ vì sao bài này cache "trúng mánh":
1. **Client/browser**: cache map `prefix→suggestions` trong phiên gõ; gõ thêm ký tự có thể lọc từ kết quả prefix cha trước khi chờ network.
2. **CDN/edge**: response cho prefix là **giống nhau cho mọi user** (bản chưa personalize) + tập prefix ngắn nhỏ (1-2 ký tự chỉ có vài nghìn tổ hợp nhưng chiếm tỷ trọng request lớn) → cache key = chính prefix, TTL 30-60 phút. Riêng tầng này gánh được phần lớn traffic.
3. **Redis**: `suggest:{prefix}` → JSON top10, TTL ~1h, warm sẵn các prefix hot ngay sau mỗi lần swap snapshot (tránh thundering herd vào trie mới).
4. **In-process LRU** trong Suggest Service (vài nghìn prefix hot nhất, TTL 1 phút) → khỏi cả round-trip Redis.
- Trade-off phải nói: nhiều tầng cache = staleness cộng dồn → chấp nhận được vì đề bài đã chốt "tần suất xấp xỉ là OK". Trending overlay thì TTL ngắn (1 phút) hoặc bypass CDN.

#### 4.4 Personalization (nếu interviewer kéo sang)

- Nguyên tắc: **không nhét personalization vào trie** (trie per user là không tưởng). Giữ trie global, re-rank ở tầng ngoài:
  - Lấy top ~30 từ trie thay vì 10 → Suggest Service trộn với (a) lịch sử search của chính user (vài chục entry, lưu Redis/cookie — match prefix thì đẩy lên đầu), (b) signal thô: ngôn ngữ, location (có thể tách trie/overlay theo region).
  - Nặng đô hơn: gọi ranking model re-rank 30 ứng viên — nhưng budget latency chỉ ~20ms → model phải cực nhẹ hoặc chỉ áp dụng sau ký tự thứ 3+.
- Trade-off: personalize làm **mất khả năng cache CDN** (response khác nhau per user) → cách dung hòa: CDN vẫn serve bản global, client merge với local history; hoặc chỉ personalize khi user đã login và bỏ edge cache cho nhóm đó.

### Bước 5: Trade-offs & bottlenecks

| Quyết định | Đánh đổi | Lý do |
|---|---|---|
| Precompute top-k tại node | Storage ×n, update đắt → phải rebuild offline | Read O(1) — latency là vua ở bài này |
| Rebuild snapshot thay vì update online | Data trễ giờ/ngày | Đơn giản, an toàn; trending overlay vá phần "tươi" |
| Count-min sketch cho trending | Đếm sai số (overcount nhẹ) | Bộ nhớ O(1); đề bài cho phép xấp xỉ |
| Cache CDN theo prefix | Mất personalization ở edge | Hit ratio cực cao cho prefix ngắn |
| Trie server bằng Go/Java thay vì Node | Thêm 1 stack trong hệ thống | Heap lớn + GC: dùng đúng tool cho đúng việc |

**Bottlenecks:**
- **Prefix 1 ký tự** là hot nhất hệ thống → phải chết ở client cache/CDN; thậm chí không gợi ý dưới 2 ký tự (Google từng làm vậy) — một quyết định product giải bài toán hạ tầng, nêu ra rất ăn điểm.
- **Swap snapshot gây cold cache** → warm Redis từ chính snapshot mới trước khi chuyển traffic.
- **Skew giữa shard** (shard chứa 'b','c' nóng hơn 'x','z') → chia shard theo histogram tải, rebalance định kỳ.
- **Query injection vào suggest** (spam bẩn lên gợi ý) → lọc ở pipeline (ngưỡng user unique tối thiểu, blacklist, dedupe theo user) — đây vừa là technical vừa là trust & safety.

### ❓ Follow-up questions interviewer hay hỏi tiếp

1. **"Hỗ trợ tiếng Việt có dấu / unicode / lỗi chính tả thì sao?"** → Normalize khi index lẫn khi query (NFC, lowercase, có thể thêm bản bỏ dấu map về bản có dấu); fuzzy/typo-tolerance thì trie thuần yếu → thêm tầng fuzzy (edit distance trên candidates, hoặc dùng engine như Elasticsearch completion suggester) cho phần đuôi.
2. **"Tại sao không dùng luôn Elasticsearch completion suggester mà tự build trie?"** → Hoàn toàn hợp lệ ở quy mô vừa (nó cũng là FST in-memory bên dưới); tự build khi cần kiểm soát ranking/trending merge và chi phí ở quy mô rất lớn. Trả lời "ở công ty em, em sẽ bắt đầu bằng ES" thể hiện pragmatism tốt.
3. **"Đo chất lượng gợi ý bằng gì?"** → CTR của suggestion, vị trí được chọn trung bình, % search dùng suggestion, A/B test ranking mới.
4. **"Trending giả (bị bơm) lọt lên thì sao?"** → Ngưỡng số user unique (không phải số lần gõ), giới hạn đóng góp per user/IP trong sketch, human-review queue cho trending nhạy cảm.
5. **"Client gửi mỗi keystroke có lãng phí không?"** → Debounce 150ms + hủy request cũ (AbortController) + tối thiểu 2 ký tự + cache local — giảm ~70% request mà UX không đổi.
6. **"Snapshot build 1 giờ, nhưng giữa chừng builder chết?"** → Build là job idempotent từ data bất biến (log đã chốt) → retry từ đầu, version snapshot rõ ràng, server chỉ load snapshot có checksum hợp lệ; bản cũ vẫn serve — không có trạng thái dở dang.

---

## Bài 5: Design Video Streaming (YouTube/TikTok)

### 🎤 Cách nhà tuyển dụng đặt câu hỏi

Câu hỏi gốc:
> "Thiết kế YouTube: user upload video, hệ thống xử lý, người khác xem được trên mọi thiết bị, mọi tốc độ mạng."

Biến thể hay gặp:
- "Design TikTok" (nhấn feed video ngắn + thời gian start playback < 1s).
- "Upload video 2GB qua mạng chập chờn thì làm sao?" (xoáy chunk upload/resumable).
- "Vì sao video lúc nét lúc mờ khi mạng yếu? Đằng sau là gì?" (xoáy adaptive bitrate).
- "View count 1 video viral 10M views/giờ, đếm thế nào?" (xoáy counting).
- Lưu ý: live streaming là bài KHÁC — nếu đề là VOD thì chủ động khoanh "live ngoài scope".

### Bước 1: Clarify requirements

Câu hỏi nên hỏi lại:
1. "VOD (video on demand) hay có cả live streaming?" → Chốt VOD.
2. "Độ dài video tối đa? Kích thước file?" → Tối đa 1 giờ / vài GB.
3. "Sau khi upload bao lâu thì video xem được?" → Vài phút là chấp nhận (processing async).
4. "Hỗ trợ thiết bị/mạng đa dạng? → cần adaptive bitrate?" → Có, từ 240p đến 4K.
5. "Scope gồm những gì: upload + watch + view count? Còn comment, recommendation?" → Chốt: upload pipeline + playback + metadata + view count; recommendation ngoài scope.

**Functional:** upload video (resumable); transcode ra nhiều độ phân giải/format; stream với adaptive bitrate; xem metadata (title, views); đếm view.

**Non-functional:** 100M DAU xem; start playback < 1-2s, không buffering (quan trọng nhất với người xem); upload chịu được mạng chập chờn; durability tuyệt đối cho video gốc; chi phí storage + bandwidth là mối lo hàng đầu (nói ra điều này rất "senior" — video là bài toán TIỀN).

### Bước 2: Ước lượng quy mô (back-of-envelope)

- **Xem**: 100M DAU × 30 phút/ngày = 3B phút xem/ngày. Bitrate trung bình 2 Mbps (720p) → 1 phút ≈ 15MB → **45PB/ngày egress** ≈ trung bình 4.3 Tbps, peak ~10 Tbps. Con số này nói lên điều quan trọng nhất: **không nguồn gốc nào serve nổi — CDN là bắt buộc, và chi phí CDN/bandwidth chi phối toàn bộ design.**
- **Upload**: tỷ lệ xem:upload ~1000:1 → ~500K videos/ngày, trung bình 300MB/video gốc → **150TB/ngày ingest**.
- **Storage**: video gốc 150TB/ngày + transcoded ra ~5 bậc chất lượng (tổng các bản encode ≈ 1-1.5× gốc nhờ codec tốt hơn) → **~350TB/ngày mới** ≈ 130PB/năm → object storage + tiering (bản 4K của video không ai xem → cold storage; thậm chí chỉ transcode 4K khi có nhu cầu).
- **Transcode compute**: 500K video/ngày × ~5-10 phút máy/video (song song hóa theo segment thì wall-time ngắn hơn nhiều) → cluster hàng nghìn worker, autoscale theo queue depth, tận dụng spot instances (job retry được → chịu được preemption — chi tiết rất thực chiến).
- **Metadata QPS**: mỗi lượt xem kéo ~2-3 metadata call; 3B lượt-phút → cỡ vài trăm K QPS đọc metadata lúc peak → cache là chính, DB phía sau nhỏ hơn nhiều.

### Bước 3: High-level design

```
 UPLOAD PATH
 Creator ──1. POST /videos (metadata)──► Upload Service ──► Metadata DB
    │            ◄─presigned URLs + upload_id─┘
    │ 2. PUT chunks (song song, resumable)
    ▼
 Object Storage (raw bucket)
    │ 3. event: upload complete
    ▼
 ┌─────────────────────────────────────────────────────┐
 │ Transcoding Pipeline                                 │
 │ Orchestrator (DAG) ──► Message Queue ──► Workers     │
 │   split → [transcode 240p..4K song song theo segment]│
 │   → thumbnail / audio / inspection (nhánh DAG)       │
 │   → package HLS/DASH (manifest + segments)           │
 └───────────────┬─────────────────────────────────────┘
                 ▼
 Object Storage (processed) ──► CDN (origin pull + pre-warm video hot)
                 │
                 └──► Metadata DB: status = READY

 WATCH PATH
 Viewer ──► API (Node.js): metadata + manifest URL (signed)
    │
    ▼
 CDN ──hit──► trả manifest .m3u8 → player tự chọn bitrate,
    │          kéo segment .ts/.mp4 4-6s liên tục
    └─miss──► origin (object storage)

 VIEW COUNT
 Player ──view events──► Kafka ──► Flink/worker aggregate ──► counter DB
                                   └► Redis (số hiển thị gần đúng)
```

**Luồng upload:**
1. Client gọi `POST /videos` với metadata → Upload Service tạo `video_id`, status `UPLOADING`, trả về **presigned URLs** cho từng chunk.
2. Client cắt file thành chunk (5-10MB), upload **thẳng lên object storage** song song — không đi qua app server.
3. Hoàn tất → storage event (S3 event/notification) trigger pipeline; status → `PROCESSING`.
4. Transcode xong, manifest + segments nằm ở processed bucket → status `READY` → notify creator.

**Luồng xem:** client lấy metadata + manifest URL → tải manifest từ CDN → player đo băng thông, chọn rendition, kéo từng segment từ CDN. App server **không bao giờ chạm vào byte video** — chỉ phục vụ metadata + URL ký.

**Ở vai Node.js engineer kể gì:** Node phụ trách control plane: API metadata, cấp presigned URL (`@aws-sdk/s3-request-presigner`), orchestrator nhận S3 event và đẩy job vào queue (BullMQ/SQS), webhook/WS báo trạng thái transcode cho creator. Nhấn mạnh: **đừng proxy file qua Node** — vừa tốn compute vừa thành bottleneck; presigned URL đẩy thẳng client↔S3. Transcode worker thì spawn `ffmpeg` như child process (Node chỉ làm vỏ điều phối, ffmpeg làm việc nặng) hoặc dùng managed service (MediaConvert) — nói được lựa chọn build vs buy là điểm cộng.

### Bước 4: Deep dive

#### 4.1 Upload pipeline: chunk upload + presigned URL

- **Vì sao chunk**: file 2GB upload 1 stream — đứt mạng ở 99% là mất sạch; chunk 5-10MB → retry đúng chunk hỏng, upload song song nhiều chunk (tăng throughput trên mạng latency cao), **resumable** (client hỏi server "đã có chunk nào" rồi up tiếp — chuẩn hóa bởi S3 multipart upload / tus protocol).
- **Vì sao presigned URL**: app server cấp URL ký sẵn (quyền PUT đúng key, hết hạn 15 phút) → client đẩy thẳng vào storage. Lợi: app server không gánh 150TB/ngày, không giữ connection dài, storage tự lo durability. Trade-off: mất khả năng inspect nội dung inline → validate sau bằng pipeline (định dạng, virus scan, content moderation là một stage của DAG).
- Mỗi chunk kèm checksum (MD5/CRC) để phát hiện hỏng; hoàn tất thì gọi complete-multipart để storage ghép.
- **Dedupe** (điểm cộng): hash nội dung (theo chunk hoặc cả file) → file trùng hoàn toàn khỏi lưu/transcode lại — tiết kiệm đáng kể vì video re-upload rất nhiều.

#### 4.2 Transcoding: DAG + message queue

- **Vì sao DAG**: xử lý video không phải 1 bước tuyến tính mà là đồ thị: inspect → split thành segments → [transcode mỗi segment × mỗi resolution — hàng trăm task song song] → merge/package → [thumbnail, audio, caption chạy nhánh riêng]. Biểu diễn DAG cho phép: song song hóa tối đa, **retry đúng task fail** (không làm lại cả video), thêm bước mới (watermark, moderation) không đập pipeline.
- **Orchestrator** (tự build trên queue, hoặc Temporal/Step Functions): giữ state machine per video; mỗi task là message trên queue (tách queue theo loại task để scale độc lập — transcode 4K cần máy GPU/CPU khác thumbnail).
- **Worker**: stateless, kéo job → tải segment từ storage → chạy ffmpeg → đẩy output lên storage → ack. Task **idempotent** (output ghi theo key tất định, ghi đè vô hại) → at-least-once delivery của queue là đủ, chịu được spot instance bị thu hồi.
- Tối ưu kể thêm nếu kịp: transcode theo segment giúp video 1 giờ xong trong ~vài phút wall-time; ưu tiên encode bậc 360p/720p trước để video sớm READY, 4K bổ sung sau (progressive availability).

#### 4.3 Adaptive bitrate (HLS/DASH) & CDN strategy

**ABR — trả lời cho "vì sao lúc nét lúc mờ":**
- Mỗi video transcode thành **ladder**: 240p/400kbps, 360p/800k, 720p/2.5M, 1080p/5M, 4K/15M. Mỗi rendition cắt thành **segment 4-6 giây**.
- **Manifest** (HLS `.m3u8` / DASH `.mpd`) liệt kê các rendition + URL segments. Player tải manifest, đo throughput thực tế + độ đầy buffer → tự quyết segment tiếp theo lấy ở bậc nào → mạng tụt thì chuyển 1080p→480p **giữa hai segment**, không đứt hình. Toàn bộ "thông minh" nằm ở client; server chỉ serve file tĩnh — đây là vẻ đẹp của thiết kế: **đẩy độ phức tạp ra client để server-side thành bài toán CDN thuần túy.**
- HLS vs DASH: HLS bắt buộc cho hệ Apple, DASH codec-agnostic — thực tế package cả hai (hoặc CMAF chung segment, 2 manifest).

**CDN strategy (nơi 90% tiền chảy qua):**
- Video bản chất **bất biến sau khi encode** → cache key ổn định, TTL dài vô hạn — món quà cho CDN.
- Phân phối theo độ nóng: video **hot** (trending/viral — đoán được từ view velocity) chủ động **pre-warm** lên edge ở region dự kiến; **long-tail** (đa số video, ít người xem) dùng origin-pull, chỉ lên edge khi có người xem, evict theo LRU. KHÔNG đẩy tất cả lên edge — không đủ chỗ và phí tiền.
- Tầng giữa: edge miss → **regional/shield cache** → mới về origin (giảm tải origin + phí egress từ storage).
- Multi-CDN (điểm cộng): 2-3 nhà cung cấp, điều phối theo giá + chất lượng theo region + failover.
- **Signed URL/cookie** cho segment để chống hotlink/leech, TTL theo phiên xem.
- TikTok-style (nếu bị hỏi): video ngắn, cần start < 1s → prefetch sẵn segment đầu của vài video tiếp theo trong feed về player; segment đầu encode ưu tiên, đặt sẵn ở edge.

#### 4.4 Metadata DB & view count

**Metadata:**
```sql
videos(video_id BIGINT PK,        -- Snowflake
       uploader_id, title, description,
       status ENUM(UPLOADING, PROCESSING, READY, FAILED, BLOCKED),
       duration, created_at,
       manifest_url, thumbnail_url)
renditions(video_id, resolution, bitrate, manifest_path, status)
```
- Đặc tính: ghi 1 lần khi upload, đọc cực nhiều, hầu như không update → **cache-friendly tuyệt đối**: Redis + CDN cache JSON metadata của video hot, TTL phút. DB phía sau: Postgres/MySQL shard theo `video_id` là quá đủ (write chỉ ~500K/ngày); hoặc DynamoDB/Cassandra nếu muốn vận hành nhàn. Đừng nói "dùng NoSQL vì big data" chung chung — chỉ ra access pattern mới là điều interviewer chấm.

**View count — bài toán con kinh điển:**
- Naive `UPDATE videos SET views = views + 1` mỗi lượt xem → video viral 10M views/giờ = ~3K update/s vào **1 row** → lock contention, WAL phình. Loại.
- Đáp án: **đếm xấp xỉ + batch aggregate**:
  1. Player gửi view event (kèm watch time, đạt ngưỡng "tính là 1 view" — vd xem ≥ 30s) → **Kafka**.
  2. Consumer/Flink aggregate theo cửa sổ 10-60s → mỗi video 1 con số delta → `INCRBY` Redis (số hiển thị) + flush định kỳ vào DB (số bền vững): 3K writes/s/row → vài writes/phút/row.
  3. Hiển thị từ Redis — trễ ~1 phút, sai lệch nhỏ, không ai bận tâm. Số liệu phục vụ **trả tiền creator/quảng cáo** thì chạy batch job chính xác từ raw events trong data lake (kèm lọc fake view) — tách "số cho UI" khỏi "số cho tiền" là một câu trả lời rất senior.
- Chống view ảo: dedupe theo (user/device, video, cửa sổ thời gian), ngưỡng watch-time, anomaly detection offline.

### Bước 5: Trade-offs & bottlenecks

| Quyết định | Đánh đổi | Lý do |
|---|---|---|
| Presigned URL, client→storage trực tiếp | Khó inspect inline, phụ thuộc storage provider | App server thoát 150TB/ngày |
| Transcode async (video READY sau vài phút) | Creator phải chờ | Transcode sync là bất khả thi; progressive (720p trước) giảm đau |
| Segment 4-6s | Segment ngắn → nhiều request, dài → chuyển bitrate chậm | 4-6s là điểm cân bằng ngành |
| Pre-warm CDN chỉ cho video hot | Long-tail xem lần đầu hơi chậm | Edge storage hữu hạn, tiền hữu hạn |
| View count xấp xỉ | Số trễ ~1 phút, không khớp tuyệt đối | Hot row là không thể; số chính xác để batch lo |
| Spot instances cho transcode | Job bị preempt giữa chừng | Idempotent + retry → rẻ hơn 60-70% |

**Bottlenecks:**
- **Video viral đột ngột** ở region chưa pre-warm → origin bị dồn: shield cache + request coalescing tại CDN (1 miss → 1 fetch origin, các request sau chờ), tự động pre-warm khi view velocity vượt ngưỡng.
- **Transcode queue dồn ứ** giờ cao điểm upload: autoscale theo queue depth; queue ưu tiên (creator lớn / video ngắn trước); degrade: tạm chỉ encode đến 720p, các bậc cao bù sau.
- **Metadata hot key** (video viral, mọi người mở cùng lúc) → cache nhiều tầng + in-process LRU vài giây; metadata gần như bất biến nên stale vô hại.
- **Storage cost phình vĩnh viễn** → lifecycle: bậc phân giải cao của video không xem > N tháng xuống cold/xóa, giữ bản gốc + 720p; codec mới (AV1/H.265) giảm 30-50% bitrate — đáng kể ở 45PB/ngày egress, nhưng tốn compute encode hơn (lại một trade-off để kể).

### ❓ Follow-up questions interviewer hay hỏi tiếp

1. **"Resume upload sau khi app bị kill thì state nằm đâu?"** → `upload_id` + danh sách chunk đã hoàn tất persist server-side (storage multipart API có sẵn ListParts); client hỏi rồi up tiếp phần thiếu; upload dở quá 24h thì cleanup job abort để khỏi trả tiền storage rác.
2. **"Làm sao biết nên pre-warm video nào, region nào?"** → Tín hiệu: view velocity, share rate, nguồn traffic theo geo; rule đơn giản (đạo hàm view vượt ngưỡng) trước, ML sau; với TikTok thì recommendation system biết trước video sắp được phát cho ai.
3. **"Video vi phạm bản quyền/nội dung xấu?"** → Một stage trong DAG: fingerprinting (Content ID-style: so khớp audio/video fingerprint với DB bản quyền) + ML moderation + human review queue; status BLOCKED chặn ở metadata → mọi đường phát đều tắt vì manifest không được trả về.
4. **"Vì sao không dùng WebSocket/streaming protocol cho VOD mà dùng HTTP segments?"** → HTTP tĩnh = cache được trên mọi CDN, xuyên firewall/proxy, player retry từng segment đơn giản; protocol stateful chỉ cần cho live latency thấp (WebRTC/LL-HLS).
5. **"DRM cho nội dung trả phí?"** → Encrypt segment (AES-128/CENC), license server phát key theo phiên + entitlement; Widevine/FairPlay/PlayReady tùy nền tảng — biết đến mức gọi tên + chỗ đặt license server là đủ cho backend role.
6. **"Nếu phải hỗ trợ live streaming thì kiến trúc đổi gì?"** → Ingest RTMP/SRT, transcode realtime (luôn bật, không phải job), segment đẩy CDN liên tục, latency là KPI thay vì throughput; phần playback ABR + CDN tái dùng được — chỉ ra phần nào tái dùng được thể hiện tư duy kiến trúc tốt.

---

## 🧭 Mẹo chung khi trả lời

1. **Drive the conversation — bạn lái, không phải interviewer.** Mở đầu bằng: "Em sẽ đi theo 5 bước: clarify → estimate → high-level → deep dive → trade-offs. Mình bắt đầu với requirements nhé?" Người tự dẫn dắt và check-in đều đặn ("phần này em đi sâu thêm hay chuyển sang X?") được chấm cao hơn hẳn người chờ hỏi gì đáp nấy.

2. **Đừng nhảy vào chi tiết sớm.** Lỗi rớt phổ biến nhất: nghe "design chat app" xong nói ngay "em dùng WebSocket với Cassandra". Khi chưa chốt requirements và chưa ước lượng, mọi lựa chọn công nghệ đều là đoán mò — interviewer nhìn thấy ngay. Vẽ xong high-level rồi mới đào sâu TỪNG phần, và để interviewer chọn phần họ muốn đào.

3. **Mọi quyết định phải kèm trade-off.** Không bao giờ nói "em dùng Kafka" trống không — nói "em dùng Kafka thay vì gọi trực tiếp vì cần buffer spike và replay, đổi lại chấp nhận thêm độ trễ và một hệ thống phải vận hành". Câu thần chú: *"option A được X nhưng mất Y, option B ngược lại; với requirement này em chọn A vì..."*. Đây là tín hiệu senior rõ nhất trong cả buổi.

4. **Con số phải dẫn đến kết luận.** Back-of-envelope không phải nghi thức làm cho có — mỗi con số tính ra phải đổi thành một quyết định: "read:write 100:1 → precompute đường read"; "30M connections → 100 server stateful → cần session registry"; "45PB/ngày egress → CDN là trung tâm của design". Tính xong mà không kết luận gì là phí thời gian.

5. **Nói từ kinh nghiệm thật của mình.** Ở vai Node.js backend, chêm chi tiết thực chiến đúng lúc: "với WebSocket em từng phải xử lý backpressure khi client đọc chậm", "BullMQ delayed job cho TTL vì setTimeout chết theo process". Một chi tiết thật đáng giá hơn mười buzzword. Và ngược lại — dám nói "phần ML ranking em chỉ biết ở mức contract API" trung thực hơn là bịa.

6. **Khi bị thử thách, đừng phòng thủ.** Interviewer nói "cách này có vấn đề X đấy" thường là test khả năng tiếp nhận: dừng lại, suy nghĩ thật, hoặc bảo vệ có căn cứ ("đúng là có X, nhưng với scale này em nghĩ chấp nhận được vì...") hoặc điều chỉnh thoải mái ("anh/chị nói đúng, vậy em đổi sang... "). Cãi cùn và gió chiều nào theo chiều ấy đều bị trừ điểm như nhau.

7. **Quản lý đồng hồ: 45 phút chia ~5/5/10/20/5.** Clarify 5', estimate 5', high-level 10', deep dive 20' (phần ăn điểm nhất — đừng để hết giờ ở high-level), trade-offs + wrap-up 5'. Cuối buổi chủ động tổng kết 30 giây: "tóm lại design của em là..., điểm yếu lớn nhất là..., nếu có thêm thời gian em sẽ...". Kết thúc gọn gàng để lại ấn tượng cuối rất mạnh.
