# English for Backend Developers — Lộ trình 12 tuần song song

> Track tiếng Anh chạy **song song** với lộ trình ôn phỏng vấn Backend Node.js 12 tuần. Mỗi tuần học tiếng Anh đúng theo chủ đề kỹ thuật bạn đang ôn — học đến đâu, dùng được đến đó.

---

## 1. Mục tiêu sau 12 tuần

Sau 12 tuần, bạn sẽ đạt được 3 mục tiêu cụ thể (không hứa hẹn "giỏi tiếng Anh", chỉ những thứ đo được):

| # | Mục tiêu | Tiêu chí đo |
|---|----------|-------------|
| 1 | **Đọc docs không cần dịch** | Đọc một trang docs mới (Node.js, Redis, AWS...) hiểu ≥ 90% mà không cần Google Translate; tốc độ đọc gần bằng đọc tiếng Việt |
| 2 | **Trả lời phỏng vấn kỹ thuật bằng tiếng Anh ở mức ổn** | Trả lời được các câu hỏi kỹ thuật quen thuộc (event loop, caching, scaling...) trong 1-2 phút, mạch lạc, dùng đúng thuật ngữ — chấp nhận ngữ pháp chưa hoàn hảo |
| 3 | **Giao tiếp công việc cơ bản** | Nói được standup update 1 phút, viết được commit message / PR description / tin nhắn Slack / email ngắn mà người nước ngoài đọc hiểu ngay |

**Không phải mục tiêu**: phát âm như người bản xứ, small talk trôi chảy, viết văn hay. Đừng phí thời gian vào những thứ đó trong 12 tuần này.

---

## 2. Nguyên tắc học cho dev bận rộn

1. **30-45 phút/ngày, đều đặn hơn là nhiều.** 30 phút mỗi ngày ăn đứt 4 tiếng dồn vào Chủ nhật. Não cần lặp lại cách quãng (spaced repetition), không cần cày cuốc.
2. **Học từ vựng THEO chủ đề kỹ thuật đang ôn tuần đó.** Tuần 5 bạn ôn Redis thì học vocab Redis (`eviction`, `cache invalidation`, `replication lag`...). Context kỹ thuật giúp nhớ từ gấp nhiều lần học từ rời rạc — bạn vừa đọc docs Redis xong, gặp lại từ ngay lập tức.
3. **Input trước output.** Tuần 1-8 tập trung đọc + nghe (input). Tuần 9-12 mới đẩy mạnh nói (output). Đừng cố nói khi trong đầu chưa có đủ "nguyên liệu" — sẽ chỉ tạo thói quen nói sai.
4. **Shadowing thay vì học phát âm lý thuyết.** Nghe 1 câu từ tech talk → pause → nhại lại y hệt (cả ngữ điệu). 10 phút shadowing mỗi ngày hiệu quả hơn mọi khóa phát âm.
5. **Dùng tiếng Anh làm việc thật ngay từ tuần 5.** Commit message, comment code, ghi chú ôn tập — viết bằng tiếng Anh hết. Sai cũng được, miễn là dùng.
6. **Đừng dịch trong đầu.** Khi đọc docs, cố hiểu trực tiếp bằng tiếng Anh. Chỉ tra từ điển khi 1 từ chặn đứng việc hiểu cả đoạn.

---

## 3. Lịch 12 tuần

| Tuần | Chủ đề kỹ thuật | Trọng tâm tiếng Anh | Tài liệu trong track | Bài tập tuần |
|------|-----------------|---------------------|----------------------|--------------|
| 1 | Node.js Core (event loop, async) | Kỹ thuật đọc docs: skim/scan, đoán nghĩa theo context; vocab Week 1 | [01](./01-technical-vocabulary.md) · [02](./02-reading-technical-docs.md) | Đọc trang "The Node.js Event Loop" trên docs chính thức, highlight 10 từ mới, viết tóm tắt 3 câu tiếng Anh |
| 2 | Node.js Advanced (streams, cluster, perf) | Đọc hiểu câu dài/bị động trong docs; vocab Week 2 | [01](./01-technical-vocabulary.md) · [02](./02-reading-technical-docs.md) | Đọc docs Streams, dịch xuôi 5 câu khó (không dịch ngược); tự giải thích backpressure bằng tiếng Anh 3 câu |
| 3 | SQL (PostgreSQL, indexing, transactions) | Đọc error message & changelog; vocab Week 3 | [01](./01-technical-vocabulary.md) · [02](./02-reading-technical-docs.md) | Đọc 1 mục trong PostgreSQL docs (indexes), viết 5 câu mô tả khi nào dùng index nào |
| 4 | NoSQL (MongoDB, data modeling) | Tổng ôn đọc: đọc 1 bài blog kỹ thuật dài hoàn chỉnh; vocab Week 4 | [01](./01-technical-vocabulary.md) · [02](./02-reading-technical-docs.md) | Đọc 1 bài blog MongoDB schema design, viết outline tiếng Anh 5 gạch đầu dòng |
| 5 | Redis (caching, pub/sub) | **Bắt đầu listening**: tech talk có phụ đề, shadowing 10p/ngày; **viết commit message chuẩn**; vocab Week 5 | [01](./01-technical-vocabulary.md) · [03](./03-listening-speaking.md) · [05](./05-workplace-communication.md) | Nghe 1 talk về caching (bật phụ đề EN), shadow 5 phút; viết lại 10 commit message cũ của bạn bằng tiếng Anh chuẩn |
| 6 | Kafka (messaging, event-driven) | Listening podcast không phụ đề (chậm); **viết PR description**; vocab Week 6 | [01](./01-technical-vocabulary.md) · [03](./03-listening-speaking.md) · [05](./05-workplace-communication.md) | Nghe 1 tập podcast về Kafka/event-driven, ghi lại 10 cụm từ nghe được; viết 1 PR description hoàn chỉnh theo template |
| 7 | Docker (containers, images) | Listening tốc độ thật; **viết tin nhắn Slack**: hỏi, báo blocker, nhờ review; vocab Week 7 | [01](./01-technical-vocabulary.md) · [03](./03-listening-speaking.md) · [05](./05-workplace-communication.md) | Xem 1 video "Docker explained", shadow 10 phút; viết 5 tin nhắn Slack tình huống thật (báo bug, xin review, hỏi deadline) |
| 8 | Kubernetes (deployment, scaling) | Tổng ôn listening + writing; **viết email công việc**; vocab Week 8 | [01](./01-technical-vocabulary.md) · [03](./03-listening-speaking.md) · [05](./05-workplace-communication.md) | Nghe 1 conference talk về K8s (20p), tóm tắt 5 câu; viết 1 email xin nghỉ phép + 1 email follow-up sau phỏng vấn |
| 9 | AWS (EC2, S3, Lambda, RDS) | **Bắt đầu nói**: mô tả kiến trúc hệ thống bằng tiếng Anh; vocab Week 9 | [01](./01-technical-vocabulary.md) · [03](./03-listening-speaking.md) · [04](./04-interview-english.md) | Vẽ kiến trúc 1 hệ thống bạn từng làm, tự nói mô tả 3 phút, **ghi âm lại**, nghe lại và sửa |
| 10 | System Design (scalability, trade-offs) | Nói: trình bày trade-off, dùng cấu trúc "It depends on..."; vocab Week 10 | [01](./01-technical-vocabulary.md) · [04](./04-interview-english.md) | Tự trình bày miệng 1 bài system design (URL shortener) 10 phút bằng tiếng Anh, ghi âm, tự chấm theo checklist trong [04](./04-interview-english.md) |
| 11 | Behavioral + ôn tổng hợp | Kể về project (STAR method), trả lời behavioral questions; vocab Week 11-12 | [01](./01-technical-vocabulary.md) · [04](./04-interview-english.md) | Chuẩn bị + ghi âm 3 câu chuyện STAR về project của bạn (mỗi câu chuyện 2 phút); mock interview tiếng Anh với bạn bè hoặc AI |
| 12 | Mock interview tổng hợp | **Mock interview full English**: technical + system design + behavioral | [04](./04-interview-english.md) | 2 buổi mock interview full English (60p/buổi) — ghi âm, review, lập danh sách lỗi lặp lại để sửa |

**Phân bổ tổng thể:**
- **Tuần 1-4 — Nền tảng đọc**: đọc docs + xây vocab nền. Chưa cần nói.
- **Tuần 5-8 — Thêm listening + writing**: tai quen với tech talks/podcasts; tay quen viết commit, PR, Slack, email.
- **Tuần 9-11 — Nói**: mô tả kiến trúc, kể về project, mock interview từng phần.
- **Tuần 12 — Mock interview full English**: tổng duyệt như thi thật.

---

## 4. Daily routine (30-45 phút, chia 3 phần)

Làm **mỗi ngày**, kể cả cuối tuần (cuối tuần có thể rút còn 30 phút):

### Phần 1 — 10 phút: Vocab review (Anki / spaced repetition)
- Mở Anki, ôn hết thẻ đến hạn của ngày hôm đó. Thường 20-40 thẻ, đúng ~10 phút.
- Thêm 5-10 thẻ mới từ bảng vocab tuần hiện tại trong [01-technical-vocabulary.md](./01-technical-vocabulary.md).
- Quy tắc: **đọc to** từ + câu ví dụ khi ôn. Mắt nhìn, miệng đọc, tai nghe — nhớ gấp đôi.

### Phần 2 — 20 phút: Đọc hoặc nghe (input)
- **Tuần 1-4**: đọc docs của chủ đề kỹ thuật tuần đó (đằng nào cũng phải đọc để ôn — một công đôi việc).
- **Tuần 5-8**: xen kẽ — ngày chẵn đọc, ngày lẻ nghe (tech talk / podcast theo gợi ý trong [03-listening-speaking.md](./03-listening-speaking.md)).
- **Tuần 9-12**: nghe mock interview mẫu trên YouTube, chú ý cách interviewer hỏi và cách candidate cấu trúc câu trả lời.

### Phần 3 — 10-15 phút: Nói hoặc viết (output)
- **Tuần 1-4**: viết — tóm tắt 3 câu tiếng Anh về thứ vừa đọc.
- **Tuần 5-8**: xen kẽ shadowing (nhại theo video 10 phút) và viết (commit/PR/Slack theo bài tập tuần).
- **Tuần 9-12**: nói — tự trả lời 1 câu hỏi phỏng vấn thành tiếng, **ghi âm**, nghe lại 1 lần. Ghi âm là bắt buộc: bạn sẽ tự nghe ra lỗi mà lúc nói không nhận ra.

---

## 5. Đo tiến bộ mỗi tuần (mini-test cuối tuần, ~30 phút)

Mỗi Chủ nhật, tự kiểm tra 3 mục. Ghi kết quả vào một file log (vd: `progress.md`) để thấy đường tiến bộ:

| Bài test | Cách làm | Đạt khi |
|----------|----------|---------|
| **Đọc** | Mở 1 đoạn docs **chưa đọc bao giờ** (~300 từ) đúng chủ đề tuần, đọc 1 lần, viết tóm tắt 3-5 câu tiếng Anh | Hiểu ≥ 80% không tra từ điển; tóm tắt đúng ý chính |
| **Nói** | Bật ghi âm, nói 2 phút về chủ đề tuần (vd tuần 5: "How does caching with Redis work?") | Nói đủ 2 phút không bỏ cuộc; dùng ≥ 5 từ vocab tuần đó |
| **Vocab** | Tự test 20 từ của tuần: che cột nghĩa, nhìn từ → nói nghĩa + đặt 1 câu | Đúng ≥ 16/20 (80%) |

- **Trượt mục nào** → tuần sau dành thêm 10 phút/ngày cho mục đó, KHÔNG học thêm vocab mới cho đến khi qua.
- Mỗi 4 tuần (tuần 4, 8, 12): làm lại bài test của tuần đầu chu kỳ để xác nhận kiến thức cũ chưa rơi rụng.

---

## 6. Các file trong track này

| File | Nội dung | Dùng khi nào |
|------|----------|--------------|
| [01-technical-vocabulary.md](./01-technical-vocabulary.md) | Từ vựng theo chủ đề 12 tuần (IPA, nghĩa, câu ví dụ thật) + hướng dẫn import Anki | Mỗi ngày, phần 1 của daily routine |
| [02-reading-technical-docs.md](./02-reading-technical-docs.md) | Kỹ thuật đọc docs: skim/scan, xử lý câu dài, đọc error message | Tuần 1-4 |
| [03-listening-speaking.md](./03-listening-speaking.md) | Danh sách talks/podcasts theo chủ đề + hướng dẫn shadowing | Tuần 5-12 |
| [04-interview-english.md](./04-interview-english.md) | Mẫu câu phỏng vấn: mở đầu, câu giờ, trình bày trade-off, STAR stories | Tuần 9-12 |
| [05-workplace-communication.md](./05-workplace-communication.md) | Template standup, commit message, PR description, Slack, email | Tuần 5-8 và dùng mãi về sau |
| [06-daily-life-vocabulary.md](./06-daily-life-vocabulary.md) | 323 từ giao tiếp đời sống theo 16 chủ đề (IPA, nghĩa, ví dụ) | Học song song, luyện ở tab Flashcards |

### 🌱 Bộ VỠ LÒNG — dành cho người mới / học yếu tiếng Anh (bắt đầu từ đây!)

> Nếu bạn thấy các file trên hơi khó, hãy học 4 file này TRƯỚC. Chúng cực kỳ chi tiết, có **phiên âm Việt-hóa** (đọc gần đúng bằng âm tiếng Việt) nên không cần biết IPA vẫn học được.

| File | Nội dung | Dùng khi nào |
|------|----------|--------------|
| [07-phat-am-co-ban.md](./07-phat-am-co-ban.md) | Phát âm cho người Việt: âm cuối, đuôi -s/-ed, âm khó (th, r/l…), trọng âm — có Việt-hóa | Tuần 1 trở đi, luyện 10 phút/ngày |
| [08-ngu-phap-vo-long.md](./08-ngu-phap-vo-long.md) | Ngữ pháp nền tảng đủ để TỰ ĐẶT CÂU: to be, present simple, câu hỏi, mạo từ, can/want to… + lỗi người Việt hay mắc | Tuần 1-3, nền tảng |
| [09-cau-giao-tiep-song-con.md](./09-cau-giao-tiep-song-con.md) | ~120 câu giao tiếp sống còn (chào hỏi, nhờ giúp, xin nhắc lại, standup…) — học thuộc là nói được | Mỗi ngày 5 câu |
| [10-doc-tieng-anh-di-lam.md](./10-doc-tieng-anh-di-lam.md) | Đọc tiếng Anh ở công ty cho người mới: ~200 từ UI/trạng thái/Slack, đọc error message, cách đọc câu dài từng bước | Khi đọc giao diện/Slack/lỗi ở chỗ làm |

---

*Bắt đầu từ hôm nay: nếu mới học, mở [09-cau-giao-tiep-song-con.md](./09-cau-giao-tiep-song-con.md) học thuộc 5 câu + [07-phat-am-co-ban.md](./07-phat-am-co-ban.md) luyện âm cuối 10 phút. Nếu đã khá, mở [01-technical-vocabulary.md](./01-technical-vocabulary.md), nạp 10 thẻ Week 1 và đọc trang đầu Node.js docs.*
