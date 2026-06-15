# Workplace English — Giao tiếp công việc hằng ngày

> **Dành cho ai**: Backend developer A2-B1 chuẩn bị làm việc trong môi trường dùng tiếng Anh (công ty nước ngoài, remote, hoặc team có người nước ngoài).
>
> **Vì sao file này quan trọng ngang file phỏng vấn**: Đậu phỏng vấn chỉ là bắt đầu. 90% tiếng Anh bạn dùng hằng ngày là standup, PR comment, Slack, email — KHÔNG phải tiếng Anh phỏng vấn. Tin tốt: tiếng Anh công việc lặp đi lặp lại với một bộ mẫu câu khá nhỏ. Học chắc bộ mẫu trong file này là sống khỏe 6 tháng đầu.
>
> **4 lỗi gốc của người Việt** (sẽ nhắc lại trong từng mục):
> 1. **"Please" + mệnh lệnh = ra lệnh.** "Please review my PR" nghe như sếp nói với nhân viên. Dùng câu hỏi: "Could you review my PR when you have time?"
> 2. **"I want" nghe như đòi hỏi.** Dùng `I'd like to...` / `Could I...?` / `It would be great if...`
> 3. **Câu quá dài** vì dịch nguyên câu tiếng Việt nhiều mệnh đề. Một ý = một câu. Câu 10-15 từ.
> 4. **Dịch word-by-word từ tiếng Việt**: "I have just fixed bug done already" ❌ → "I've just fixed the bug" ✅. Khi không chắc, dùng cấu trúc mẫu trong file này thay vì tự dịch.

---

## 1. Daily standup

### 1.1. Cấu trúc 3 phần

Standup KHÔNG phải báo cáo thành tích, mà là **đồng bộ thông tin trong 60-90 giây**:

```
YESTERDAY  — Hôm qua làm gì (kết quả, không phải hoạt động)
TODAY      — Hôm nay định làm gì
BLOCKERS   — Có gì đang chặn mình không (quan trọng nhất, đừng giấu)
```

### 1.2. Ba bản mẫu thực tế

**Mẫu 1 — Ngày bình thường (có review PR):**

> "Morning everyone. **Yesterday**, I finished the pagination for the orders endpoint and opened a PR — it's ready for review, so if anyone has time today, that would be great. I also reviewed Nam's PR on the payment retry logic.
> **Today**, I'll pick up the ticket for the Redis cache invalidation bug.
> **No blockers** from my side."

*Dịch: Chào mọi người. Hôm qua tôi xong phần pagination cho endpoint orders và mở PR — sẵn sàng để review, ai có thời gian hôm nay thì tốt quá. Tôi cũng review PR của Nam về retry logic thanh toán. Hôm nay tôi sẽ nhận ticket bug invalidate cache Redis. Phía tôi không có blocker.*

**Mẫu 2 — Đang kẹt (có blocker, có bug):**

> "**Yesterday**, I was debugging the duplicate order issue on staging. **It turned out that** the Kafka consumer was processing some messages twice after a rebalance — I have a fix, but I want to test it more before opening the PR.
> **Today**, I'll keep working on that, and I should have the PR up by this afternoon.
> **One blocker**: I'm blocked on the staging database access — I requested it two days ago but haven't heard back. @Anna, could you help push that along?"

*Dịch: Hôm qua tôi debug vụ order trùng trên staging. Hóa ra Kafka consumer xử lý một số message hai lần sau rebalance — tôi có fix rồi nhưng muốn test thêm trước khi mở PR. Hôm nay tôi tiếp tục, chắc chiều nay PR sẽ lên. Một blocker: tôi đang kẹt vụ quyền truy cập database staging — xin từ 2 ngày trước mà chưa thấy phản hồi. Anna giúp tôi đẩy nhanh vụ này được không?*

**Mẫu 3 — Ngày deploy:**

> "**Yesterday**, the inventory service changes passed QA, so we're good to go.
> **Today**, the main thing is the production deploy at 2 PM. I'll monitor the dashboards for an hour after that. If everything looks stable, I'll start on the notification service refactoring.
> **No blockers**, but heads up — there might be a few minutes of degraded performance during the deploy."

*Dịch: Hôm qua các thay đổi của inventory service qua QA rồi, sẵn sàng triển khai. Hôm nay việc chính là deploy production lúc 2 giờ chiều. Tôi sẽ theo dõi dashboard 1 tiếng sau đó. Nếu ổn định, tôi bắt đầu refactor notification service. Không có blocker, nhưng lưu ý — có thể có vài phút hiệu năng giảm trong lúc deploy.*

### 1.3. Cụm hay dùng

| Cụm | Nghĩa / khi nào dùng |
|---|---|
| `I'm still working on...` | Đang làm dở — trung thực, bình thường, không cần xin lỗi |
| `I'm blocked by/on...` | Đang bị chặn bởi... (blocked **on** + việc/thứ; blocked **by** + nguyên nhân/người) |
| `I'll pick up the ticket for...` | Tôi sẽ nhận ticket... |
| `It turned out that...` | Hóa ra là... (kể kết quả debug) |
| `The PR is ready for review` | PR sẵn sàng để review |
| `I should have X done by...` | Chắc tôi xong X trước... ("should" = ước lượng có trách nhiệm, an toàn hơn "will") |
| `heads up — ...` | Báo trước nè — ... |
| `we're good to go` | Sẵn sàng triển khai |
| `I haven't heard back (from X)` | Chưa thấy (X) phản hồi |
| `Nothing blocking me` / `No blockers from my side` | Không có gì chặn tôi |

### 1.4. Lỗi người Việt hay mắc ở standup

- **Kể hoạt động thay vì kết quả**: ❌ "Yesterday I read code and thought about the bug and tried many things" → ✅ "Yesterday I narrowed the bug down to the consumer rebalance logic." (dù chưa fix xong, vẫn nói được kết quả: *thu hẹp được phạm vi*).
- **Giấu blocker vì sợ mất mặt** — văn hóa phương Tây coi việc nói blocker sớm là chuyên nghiệp, giấu đến deadline mới là tệ. Câu thần chú: `I'm stuck on X and could use a second pair of eyes.` (*Tôi đang kẹt ở X, cần thêm một người nhìn cùng.*)
- **Nói quá dài, đi vào chi tiết kỹ thuật sâu** — standup là headline; chi tiết để sau: `I can go into details after standup if anyone's interested.`

---

## 2. Code review

### 2.1. Viết nhận xét PR — lịch sự VÀ rõ ràng

Nguyên tắc: **comment về CODE, không về NGƯỜI** ("this function" chứ không "you"); **đề xuất kèm lý do**; **đánh dấu mức độ** để người nhận biết phải sửa hay tùy chọn.

**Thang mức độ — phân biệt blocking vs non-blocking:**

| Prefix | Mức độ | Ví dụ |
|---|---|---|
| `nit:` | Vụn vặt, không bắt buộc sửa (naming, format) | `nit: minor, but I'd rename this to fetchOrderById for consistency.` |
| `suggestion:` / `Consider...` | Đề xuất, tác giả tự quyết | `Consider using Promise.all here — these two calls don't depend on each other.` |
| `question:` | Hỏi để hiểu, không phán xét | `question: is there a reason we skip validation here?` |
| `blocking:` / `This might cause...` | Phải giải quyết trước khi merge | `blocking: this might cause a race condition when two requests update the same order.` |

> Nhiều team dùng convention "Conventional Comments" — hỏi team bạn có convention không trước khi tự chế.

**Bộ mẫu câu viết nhận xét:**

- `Consider using X instead of Y — it would [lý do].` — *Cân nhắc dùng X thay vì Y — vì...*
- `What do you think about extracting this into a helper?` — *Bạn nghĩ sao nếu tách phần này ra helper?* (dạng câu hỏi = tôn trọng nhất)
- `This might cause an issue when [tình huống]. Could we handle that case?` — *Đoạn này có thể gây vấn đề khi... Mình xử lý case đó nhé?*
- `I might be missing something, but doesn't this break when the array is empty?` — *Có thể tôi bỏ sót gì đó, nhưng đoạn này hỏng khi array rỗng thì phải?* (cách chỉ ra bug mà vẫn chừa đường — rất nên học)
- `Nice solution!` / `I like this approach.` — khen cũng là review; PR chỉ toàn chê tạo cảm giác thù địch.
- `Not blocking, but worth a follow-up ticket.` — *Không chặn merge, nhưng đáng mở ticket làm sau.*

### 2.2. Phản hồi nhận xét

- `Good catch! Fixed in the latest commit.` — *Bắt hay đấy! Đã sửa ở commit mới nhất.*
- `Done.` / `Fixed.` / `Updated.` — đủ dùng cho nit nhỏ, không cần văn vẻ.
- `Good point. I've refactored it as you suggested.` — *Có lý. Tôi đã refactor như bạn đề xuất.*
- `I'd prefer to keep it as is, because [lý do]. But I'm open to discussing it.` — *Tôi muốn giữ nguyên vì... Nhưng sẵn sàng thảo luận.* (disagree lịch sự — PHẢI có lý do)
- `That's intentional — [lý do]. I'll add a comment to make it clearer.` — *Chỗ đó cố ý — vì... Tôi sẽ thêm comment cho rõ.*
- `You're right that X, but in this case Y, so I think the current approach is safer. What do you think?` — công thức disagree hoàn chỉnh: công nhận → phản biện có lý do → mở cửa thảo luận.
- `Let's hop on a quick call — I think it'll be faster than going back and forth here.` — *Call nhanh đi — nhanh hơn là cãi qua lại ở đây.* (khi thread quá 3 vòng)

### 2.3. 10 cặp ❌ thô / ✅ lịch sự

| # | ❌ Thô (thường do dịch thẳng từ tiếng Việt) | ✅ Lịch sự và rõ |
|---|---|---|
| 1 | `This is wrong.` | `I think this might not handle the null case — what happens if the user is not found?` |
| 2 | `Why did you do this?` (nghe như buộc tội) | `question: what's the reason for this approach? I might be missing context.` |
| 3 | `Please fix this.` | `Could we handle the empty-array case here as well?` |
| 4 | `You should use map here.` | `nit: this could be a .map() — slightly more readable, but up to you.` |
| 5 | `This code is bad. Rewrite it.` | `This function is doing quite a lot. What do you think about splitting it into validation and processing steps?` |
| 6 | `Don't use var.` | `nit: let's use const here to match the rest of the codebase.` |
| 7 | `You forgot the tests.` | `Could we add a test for the failure path? Especially the timeout case.` |
| 8 | `This will break production.` | `blocking: I'm worried this could break the checkout flow when Redis is down — can we add a fallback?` |
| 9 | `No. We discussed this before.` | `I think we agreed in the design doc to use the outbox pattern here — am I remembering right? Happy to revisit if things changed.` |
| 10 | `OK` (trả lời review dài của người khác) | `Thanks for the detailed review! I've addressed everything except #3 — left a reply there.` |

**Lưu ý lỗi người Việt:**
- `Please fix this` — chính là lỗi "please + mệnh lệnh = ra lệnh". Trong code review, gần như không bao giờ cần "please" — dùng dạng câu hỏi `Could we...?` / `Can you...?` là đủ lịch sự.
- Dùng `we` thay vì `you` khi nói về việc cần sửa (`Could we handle...` thay vì `You must handle...`) — biến vấn đề thành việc chung của team.
- Đừng sợ `Done.` cộc lốc — với nit nhỏ, trả lời ngắn là chuẩn văn hóa dev, không phải bất lịch sự.

---

## 3. Viết kỹ thuật ngắn

### 3.1. Commit message (Conventional Commits)

Cấu trúc: `type(scope): mô tả ở thì hiện tại, dạng mệnh lệnh, không viết hoa chữ đầu, không dấu chấm cuối`

```
feat(order): add idempotency key check to payment consumer
fix(cache): invalidate product cache on price update
refactor(auth): extract token verification into middleware
perf(db): add composite index on orders(user_id, created_at)
docs(readme): update local setup instructions for Kafka
chore(deps): bump kafkajs to 2.2.4
test(order): add tests for concurrent order creation
```

**Quy tắc ngữ pháp**: dùng **động từ nguyên mẫu** (add, fix, remove, update) — KHÔNG dùng `added`, `adds`, `adding`. Tưởng tượng câu đầy đủ là: "If applied, this commit will **add idempotency key check**".

❌ Lỗi hay gặp của người Việt:
- `fix bug` — fix bug gì? Luôn nói rõ: `fix(order): prevent duplicate orders on double-click`
- `update code` / `change some files` — vô nghĩa, đừng bao giờ.
- `fixed the bug that customer cannot make the payment when they click the button` — quá dài + sai thì. → `fix(payment): handle declined card error on checkout`

Body (khi cần giải thích **vì sao**, không phải cái gì):

```
fix(consumer): commit offset only after successful DB write

Previously the offset was committed before the transaction,
so a crash between the two caused message loss.
```

### 3.2. PR description template

```markdown
## What
Add Redis-based rate limiting to the API gateway.

## Why
During the last sale campaign, a single client sent 2,000 req/s
and degraded the service for everyone. (Closes #142)

## How
- Sliding window counter in Redis (see `rateLimiter.ts`)
- Limits configurable per route via env vars
- Returns 429 with a `Retry-After` header

## Testing
- Unit tests for the limiter logic
- Tested locally with k6: 100 req/s passes, 150 req/s gets throttled correctly

## Notes for reviewers
The Lua script in `slidingWindow.lua` is the tricky part —
extra eyes there would be appreciated.
```

**Điểm cần nhớ**: mục `Why` quan trọng nhất và hay bị dev Việt bỏ qua nhất. Reviewer không sống trong đầu bạn. Câu `extra eyes there would be appreciated` (*mong được soi kỹ chỗ đó*) là cách điều hướng reviewer rất chuyên nghiệp.

### 3.3. Bug report

```markdown
## Summary
Order total is wrong when a discount code is applied twice.

## Steps to reproduce
1. Add any product to the cart (e.g., product #1023, price $50)
2. Apply discount code SAVE10
3. Go back to the cart and apply SAVE10 again
4. Proceed to checkout

## Expected
The code is rejected the second time; total stays $45.

## Actual
The discount is applied twice; total becomes $40.

## Environment
- staging, build 2024.6.1 (commit a1b2c3d)
- Reproduced on Chrome and via curl, so it's backend-side

## Extra info
Looks related to the `discount_usages` check — it only checks
per-user, not per-order. Logs attached below.
```

**Cụm hay**: `Steps to reproduce` (các bước tái hiện), `Expected vs Actual` (kỳ vọng vs thực tế), `Reproduced on...` (tái hiện được trên...), `Looks related to...` (có vẻ liên quan đến... — đoán có căn cứ, dùng "looks/seems" để không khẳng định bừa).

❌ Bug report kiểu Việt hay gặp: "Payment not working, please check" — không ai làm gì được với thông tin này. Quy tắc: người đọc phải **tái hiện được bug mà không cần hỏi lại bạn**.

### 3.4. Slack messages

**Hỏi giúp đỡ — không vòng vo (no hello!):**

❌ Tệ (kiểu Việt Nam lịch sự nhưng tốn thời gian người khác):
> "Hi anh Tom"
> *(chờ 20 phút Tom trả lời "hi")*
> "Are you busy? I have a question..."

✅ Tốt — chào + câu hỏi + ngữ cảnh + những gì đã thử, TRONG MỘT TIN:
> "Hi Tom! Quick question about the Kafka setup: my consumer keeps rebalancing every ~30 seconds on staging. I've already checked `session.timeout.ms` (it's 30s, default) and the consumer isn't doing any heavy work. Have you seen this before? No rush — whenever you have a moment."

*Dịch: Chào Tom! Hỏi nhanh về setup Kafka: consumer của tôi cứ rebalance mỗi ~30 giây trên staging. Tôi check session.timeout.ms rồi (30s, mặc định) và consumer không làm gì nặng. Anh từng gặp chưa? Không gấp — khi nào anh rảnh.*

Cụm vàng: `Quick question about...`, `I've already tried/checked X and Y` (chứng minh bạn đã tự cố — người ta sẵn lòng giúp hơn nhiều), `Have you seen this before?`, `No rush` / `Whenever you have a moment` (không gấp), `It's a bit urgent because...` (khi gấp thật — nói rõ vì sao).

**Báo sự cố:**

> "@here Heads up: we're seeing elevated error rates on the order service in production (~8% 5xx since 14:05). I'm investigating — suspect it's related to today's deploy. Will update in this thread every 15 minutes. Rollback is on standby."

*Dịch: Mọi người chú ý: order service production đang có tỉ lệ lỗi cao (~8% 5xx từ 14:05). Tôi đang điều tra — nghi liên quan deploy hôm nay. Sẽ update trong thread này mỗi 15 phút. Rollback đang sẵn sàng.*

Cụm vàng: `Heads up:` (báo động nhẹ), `we're seeing...` (đang quan sát thấy — khách quan), `I'm investigating`, `Will update in this thread`, `on standby` (sẵn sàng chờ lệnh). **Chú ý**: báo sự cố KHÔNG đổ lỗi, không "Nam's deploy broke production" — chỉ sự kiện + hành động.

**Update tiến độ (khi được hỏi hoặc chủ động):**

> "Update on the cache invalidation bug: root cause found — we were publishing the invalidation event before the DB commit, so a fast reader could re-cache stale data. Fix is in PR #234, waiting for review. Should be on staging by EOD."

*Dịch: Update vụ bug cache invalidation: tìm ra nguyên nhân gốc — bọn tôi publish event invalidation trước khi DB commit, nên reader nhanh có thể cache lại dữ liệu cũ. Fix nằm ở PR #234, đang chờ review. Chắc lên staging trước cuối ngày.*

Cụm vàng: `Update on X:`, `root cause found`, `waiting for review`, `by EOD` (end of day), `ETA is...` (dự kiến xong lúc...), `It's taking longer than expected because...` (trễ hơn dự kiến vì... — báo trễ SỚM là chuyên nghiệp, im lặng đến deadline là tối kỵ).

---

## 4. Meetings

### 4.1. Sống sót trong meeting tiếng Anh khi nghe chưa tốt

Chiến lược 3 lớp:

**Lớp 1 — Trước meeting (quan trọng nhất với A2-B1):**
- Đọc agenda trước, tra trước từ vựng của chủ đề. Nếu meeting không có agenda, hỏi: `Could you share the agenda beforehand? I'd like to prepare.` — câu này còn ghi điểm chuyên nghiệp.
- Nếu bạn phải trình bày phần nào, viết trước bullet points.
- Bật phụ đề tự động (Meet/Teams/Zoom đều có) — không xấu hổ gì cả, native speaker cũng bật.

**Lớp 2 — Trong meeting, khi nghe không kịp:**
- `Sorry, could you repeat that? The audio cut out a bit.` — *Xin lỗi, nhắc lại được không? Âm thanh hơi đứt.* (đổ cho audio — gương mặt được giữ, mọi người đều dùng chiêu này)
- `Sorry, I didn't catch that last part.` — *Tôi nghe sót đoạn cuối.*
- `Could you go a bit slower? I want to make sure I follow.` — *Chậm lại chút được không? Tôi muốn chắc là theo kịp.*
- **Câu xác nhận hiểu đúng — câu QUAN TRỌNG NHẤT file này**: `Just to confirm, you want me to migrate the consumer first, and hold off on the API changes — is that right?` — *Để xác nhận: anh muốn tôi migrate consumer trước, và khoan động vào API — đúng không?* Gật đầu bừa khi chưa hiểu rồi làm sai là lỗi nghiêm trọng nhất của dev Việt trong môi trường tiếng Anh. `Just to confirm, ...` chữa được 90% rủi ro đó.

**Lớp 3 — Sau meeting:**
- Gửi tóm tắt vào Slack/email: `Quick recap of what I understood: 1)... 2)... Let me know if I missed anything.` — vừa xác nhận lại lần nữa, vừa tạo văn bản lưu lại, vừa luyện viết. (Người nghe yếu mà chăm recap còn đáng tin hơn người nghe tốt mà không recap.)

### 4.2. Nêu ý kiến / đồng ý / phản đối lịch sự

| Mục đích | Mẫu câu | Dịch |
|---|---|---|
| Xin chen vào | `Can I jump in here for a second?` | Tôi chen vào một chút được không? |
| Nêu ý kiến | `From my side, I think...` / `My take is...` | Từ phía tôi... / Quan điểm của tôi là... |
| Nêu ý kiến (mềm) | `I might be wrong, but shouldn't we...?` | Có thể tôi sai, nhưng chẳng phải mình nên...? |
| Đồng ý | `That makes sense.` / `I'm on board with that.` | Hợp lý đấy. / Tôi ủng hộ. |
| Đồng ý một phần | `I agree with the direction, but I have a concern about the timeline.` | Tôi đồng ý hướng đi, nhưng băn khoăn về timeline. |
| Phản đối lịch sự | `I see your point, but I'm a bit worried that...` | Tôi hiểu ý anh, nhưng hơi lo là... |
| Phản đối (mạnh hơn) | `I'd push back on that a little — in my experience, ...` | Tôi xin phản biện chút — theo kinh nghiệm của tôi... |
| Đề xuất phương án | `What if we did X instead?` / `Another option would be...` | Hay là mình làm X? / Một phương án khác là... |
| Hoãn để tìm hiểu | `I don't have enough context to answer now — can I get back to you after the meeting?` | Tôi chưa đủ thông tin để trả lời ngay — sau meeting tôi phản hồi được không? |

> **Lưu ý văn hóa**: Trong meeting phương Tây, **im lặng = không có ý kiến = không đóng góp**. Mỗi meeting cố nói ít nhất 1-2 lần, dù chỉ là `That makes sense to me` hay một câu hỏi. Câu hỏi cũng được tính là đóng góp.

### 4.3. Báo cáo tiến độ trong sprint review

Cấu trúc: **What was planned → What was done → Demo/result → What's next → Risks**

> "This sprint, I had two main items: the rate limiter and the order export feature.
> The rate limiter is done and deployed — I'll show a quick demo in a minute. The export feature is about 80 percent done; the API works, but I'm still adding tests, so it'll carry over to next sprint.
> One risk to flag: the export queries are heavy, and I'd like to discuss moving them to a read replica before we ship."

*Dịch: Sprint này tôi có 2 hạng mục chính: rate limiter và tính năng export đơn hàng. Rate limiter xong và đã deploy — lát tôi demo nhanh. Export xong khoảng 80%; API chạy rồi nhưng tôi đang viết thêm test, nên sẽ kéo sang sprint sau. Một rủi ro cần nêu: query export khá nặng, tôi muốn bàn việc chuyển sang read replica trước khi ship.*

Cụm hay: `it'll carry over to next sprint` (kéo sang sprint sau — cách nói chuẩn, trung tính, không phải thú tội), `One risk to flag:` (một rủi ro cần nêu), `I'll show a quick demo`, `about 80 percent done`.

---

## 5. Email — 4 mẫu đầy đủ

Quy tắc chung: **subject rõ ràng → đi thẳng vào việc trong 2 câu đầu → bullet points khi liệt kê → 1 câu hành động mong muốn ở cuối**. Email công việc tiếng Anh NGẮN hơn email tiếng Việt nhiều — không cần "Em kính gửi anh, lời đầu tiên em xin chúc...".

### 5.1. Xin nghỉ phép

```
Subject: Annual leave request: June 24–26

Hi Sarah,

I'd like to request annual leave from Tuesday, June 24 to Thursday,
June 26 (3 days) for a family event.

Before I leave, I'll:
- Finish and deploy the cache invalidation fix (due June 20)
- Hand over the on-call duty to Nam (he's already agreed)
- Post a status summary of my open tickets in the team channel

I'll have limited access to Slack, but you can reach me by phone
if anything urgent comes up.

Could you let me know if these dates work?

Thanks,
Linh
```

**Điểm cần nhớ**: `I'd like to request...` chứ KHÔNG `I want to take leave` (lỗi "I want" kinh điển). Phần "before I leave, I'll..." là thứ khiến manager duyệt ngay không hỏi — bạn đã lo phần việc của họ. `if anything urgent comes up` = *nếu có gì gấp xảy ra*.

### 5.2. Hỏi thông tin technical từ team khác

```
Subject: Question: rate limits for the Payments API

Hi Payments team,

I'm Linh from the Order team. We're integrating with your
/v2/charges endpoint for the new checkout flow, and I have
a couple of questions:

1. What are the rate limits per client, and what should we
   expect when we exceed them (429 with Retry-After, or something else)?
2. Is there a sandbox environment we can run load tests against?

For context: we expect around 50 requests/second at peak
during sale campaigns.

I checked your docs at go/payments-api but couldn't find
rate-limit details — sorry if I missed them.

No big rush — sometime this week would be great.

Thanks!
Linh
```

**Điểm cần nhớ**: tự giới thiệu 1 câu (họ không biết bạn), câu hỏi đánh số (dễ trả lời từng cái), `For context:` cung cấp ngữ cảnh để họ trả lời đúng tầm, `I checked your docs... but couldn't find` — chứng minh đã tự tìm trước khi hỏi, `No big rush — sometime this week would be great` — cho deadline mềm thay vì để mơ hồ.

### 5.3. Báo cáo incident (what / impact / action)

```
Subject: [RESOLVED] Order service outage — June 10, 14:05–14:38 UTC

Hi all,

Summary of today's incident:

WHAT HAPPENED
From 14:05 to 14:38 UTC, the order service returned 5xx errors
for about 30% of requests. Root cause: today's deploy changed the
Redis connection settings, and the pool was exhausted under load.

IMPACT
- ~1,200 failed order attempts (most users retried successfully)
- 47 orders stuck in "pending" — already reprocessed, all recovered
- No data loss, no payment impact

ACTIONS
- 14:21 — issue identified, rollback started
- 14:38 — service fully recovered
- Next: we're adding a connection-pool alert and a config review
  step to the deploy checklist. Full post-mortem by Friday.

Sorry for the disruption. Questions welcome in #incident-0610.

Linh
```

**Điểm cần nhớ**: cấu trúc What/Impact/Action giúp người không kỹ thuật (manager, CS team) đọc 30 giây nắm đủ. Số liệu cụ thể (`~1,200`, `47 orders`) tạo niềm tin. `No data loss, no payment impact` — trả lời ngay câu mọi người lo nhất. Không đổ lỗi cá nhân. `Full post-mortem by Friday` — cam kết bước tiếp theo có deadline.

### 5.4. Follow-up sau phỏng vấn

```
Subject: Thank you — Backend Engineer interview (June 10)

Hi David,

Thank you for taking the time to talk with me today. I really
enjoyed our discussion, especially the part about how your team
is migrating the event pipeline to Kafka — it's very close to
what I built in my own project, and it made me even more excited
about the role.

One small follow-up: regarding your question about exactly-once
processing, I oversimplified a bit. After thinking about it, I'd
add that Kafka transactions only cover the Kafka-to-Kafka path —
for the database side you still need the idempotency approach
I described.

Please don't hesitate to reach out if you need anything else
from me. I look forward to hearing about the next steps.

Best regards,
Linh
```

**Điểm cần nhớ**: gửi trong vòng 24h. Nhắc 1 chi tiết cụ thể của buổi nói chuyện (chứng minh không phải template). Đoạn "follow-up sửa câu trả lời" là **tùy chọn nhưng cực ăn điểm** — cho thấy bạn còn suy nghĩ về vấn đề sau buổi phỏng vấn; chỉ dùng khi có ý thật sự đáng bổ sung. `I look forward to hearing about the next steps` — kết chuẩn, không cầu xin.

---

## 6. Small talk với đồng nghiệp nước ngoài

### 6.1. Vì sao phải học small talk

Với dev Việt, small talk thường khó hơn... system design. Nhưng nó là chất keo của team: người không bao giờ small talk dễ bị xem là lạnh lùng/khó gần (dù thực ra chỉ là ngại tiếng Anh). Tin tốt: small talk công sở xoay quanh ~5 chủ đề, hoàn toàn chuẩn bị trước được.

### 6.2. Chủ đề an toàn vs nên tránh

**An toàn**: cuối tuần/kỳ nghỉ, đồ ăn, thời tiết, phim/series/game, thể thao, công nghệ mới (dev nói chuyện AI/tool mới là dễ nhất!), du lịch, pet, cà phê.

**Tránh**: lương thưởng, tôn giáo, chính trị, ngoại hình/cân nặng ("you look fat/thin" — ở VN là quan tâm, ở phương Tây là xúc phạm), tuổi tác, tình trạng hôn nhân/"sao chưa có con" — các câu hỏi rất bình thường ở Việt Nam nhưng là vùng cấm ở môi trường quốc tế.

### 6.3. Câu mở chuyện

- `How's it going?` / `How's your day so far?` — câu chào vạn năng. Lưu ý: đáp lại ngắn gọn tích cực (`Pretty good! How about you?`) — đây là nghi thức, không phải câu hỏi thật về sức khỏe.
- `Any plans for the weekend?` — thứ Năm/Sáu.
- `How was your weekend?` — thứ Hai.
- `Have you tried that new ramen place near the office?` — đồ ăn luôn an toàn.
- `Did you watch the game last night?` — nếu biết họ theo đội nào.
- `Have you played with [Claude/Copilot/tool mới] yet? I tried it for code review this week.` — small talk "sân nhà" của dev, dễ nhất cho người ngại nói.
- Khen đúng cách: `Nice setup! Is that a split keyboard?` — khen đồ vật/lựa chọn, không khen ngoại hình.

### 6.4. Trả lời "How was your weekend?" — đừng trả lời 1 từ

❌ "Good." *(chấm hết — người hỏi hết đường nói tiếp, không khí đông cứng)*

✅ Công thức 3 bước: **trả lời + 1 chi tiết + hỏi lại**

> "Pretty good! I took my kids to the zoo on Saturday — they loved the elephants, I loved the air conditioning in the aquarium. How about yours?"

> "Quiet, actually — I mostly stayed home and binge-watched a series. Have you seen 'The Bear'? I can't stop. What did you get up to?"

> "Busy but fun — my friend got married on Sunday, so the whole weekend was basically eating. How was yours?"

*Dịch lần lượt: Khá ổn! Thứ Bảy tôi đưa bọn trẻ đi sở thú — chúng mê voi, còn tôi mê điều hòa trong khu thủy cung. Cuối tuần của anh thế nào? / Yên ắng — tôi chủ yếu ở nhà cày một series. Anh xem 'The Bear' chưa? Tôi dứt không nổi. Anh làm gì cuối tuần? / Bận mà vui — bạn tôi cưới Chủ nhật, nên cả cuối tuần về cơ bản là ăn. Còn anh?*

**Chi tiết nhỏ + chút hài hước tự giễu** (`I loved the air conditioning`) là thứ làm câu trả lời sống động. Và **luôn hỏi lại** (`How about yours?` / `What did you get up to?`) — quả bóng phải được đá trả.

### 6.5. Thoát khỏi cuộc nói chuyện lịch sự

- `Anyway, I should get back to it — talk to you later!` — *Thôi tôi quay lại làm việc đây — nói chuyện sau nhé!*
- `I've got a meeting in a few minutes, but let's catch up later.` — *Tôi sắp có meeting, nhưng lát nói chuyện tiếp nhé.*

### 6.6. Lỗi người Việt hay mắc trong small talk

| Lỗi | Vì sao | Sửa |
|---|---|---|
| Trả lời 1 từ ("Good.", "Fine.", "Yes.") | Trong văn hóa Anh-Mỹ, trả lời cụt = tín hiệu "tôi không muốn nói chuyện với bạn" | Công thức: trả lời + 1 chi tiết + hỏi lại |
| Hỏi "Where are you going?", "Have you eaten yet?" như ở VN | Dịch word-by-word câu xã giao Việt ("Đi đâu đấy?", "Ăn cơm chưa?") — người nước ngoài hiểu là câu hỏi thật và thấy bị soi | Thay bằng `How's it going?` |
| Hỏi tuổi, lương, hôn nhân | Quan tâm kiểu VN = xâm phạm riêng tư kiểu Tây | Bám danh sách chủ đề an toàn |
| Im lặng tuyệt đối trong pantry/trước meeting | Bị hiểu nhầm là khó gần, lâu dài ảnh hưởng cả cơ hội thăng tiến | Chuẩn bị sẵn 2-3 câu mở chuyện mỗi tuần — small talk là kỹ năng luyện được, không phải tính cách |
| Khiêm tốn quá khi được khen ("No no, my English is very bad") | Phủ nhận lời khen làm người khen lúng túng | Chỉ cần: `Thanks! Still working on it.` |

---

## Phụ lục: Bảng "cấp cứu" — tra nhanh trước khi gửi

| Định nói (kiểu Việt) | Đừng viết | Hãy viết |
|---|---|---|
| Nhờ review PR | `Please review my PR.` | `Could you review my PR when you have a chance?` |
| Muốn xin nghỉ | `I want to take a leave.` | `I'd like to request leave on...` |
| Không hiểu | `I don't understand.` (cụt, dễ nghe như trách) | `Sorry, I'm not sure I follow — could you give an example?` |
| Làm xong rồi | `I have finished done already.` | `Done — it's deployed to staging.` |
| Sắp trễ deadline | *(im lặng và cố cày)* | `Heads up — X is taking longer than expected. New ETA is Thursday. The reason is...` |
| Không đồng ý | `No, you are wrong.` | `I see your point, but I'm a bit worried that...` |
| Nhờ giúp | `Help me check this bug.` | `I'm stuck on this bug — could you take a quick look when you're free? I've already tried X and Y.` |
| Xác nhận task | `OK.` | `Just to confirm — you want me to do X first, then Y, right?` |
