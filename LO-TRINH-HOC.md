# 🗺️ Lộ trình học hiệu quả nhất — Học gì trước, học gì sau

> File này là **kim chỉ nam**: nói cho bạn thứ tự học tối ưu, trong mỗi tuần làm gì trước gì sau, và cách ghép tiếng Anh vào. Nếu thấy ngợp vì nhiều tài liệu quá — chỉ cần bám theo file này là đủ.

---

## 🎯 4 nguyên tắc vàng (đọc 1 lần, nhớ cả đời)

1. **Học theo thứ tự phụ thuộc** — cái sau cần cái trước. Ví dụ: phải biết Docker rồi mới học Kubernetes; phải biết ngôn ngữ rồi mới nói chuyện database.
2. **Học 2 LƯỢT, đừng tham lượt đầu.**
   - **Lượt 1 — để HIỂU:** Nhập môn → Lý thuyết → Lab → tự kiểm. *Tạm bỏ qua phần Đào sâu nếu thấy khó.*
   - **Lượt 2 — để SÂU (vài tuần trước khi đi phỏng vấn):** Đào sâu → Design & Cases → Rapid-fire → Mock interview.
   > Người mới hay sai lầm: lượt đầu đã nhảy vào "Đào sâu" → ngợp → nản. Đừng. Hiểu trực giác trước, chi tiết sau.
3. **Học tiếng Anh SONG SONG mỗi ngày một ít** — không đợi "giỏi tiếng Anh rồi mới học kỹ thuật".
4. **Luôn bắt đầu chủ đề mới bằng 🌱 Nhập môn** (nếu tuần đó có) — hiểu "nó là gì, để làm gì" trước khi vào chi tiết.

---

## 🧭 Bản đồ tổng thể — thứ tự 5 giai đoạn

```
GIAI ĐOẠN 1: NỀN TẢNG NGÔN NGỮ        (phải có trước tiên)
   Tuần 1: Node.js Core  ──►  Tuần 2: Node.js Advanced
                                   │
GIAI ĐOẠN 2: LƯU TRỮ DỮ LIỆU         (app nào cũng cần nơi chứa data)
   Tuần 3: SQL (Postgres)  ──►  Tuần 4: NoSQL (MongoDB)
                                   │
GIAI ĐOẠN 3: TĂNG TỐC & KẾT NỐI      (làm hệ thống nhanh & rời rạc)
   Tuần 5: Redis (cache)  ──►  Tuần 6: Kafka (messaging)
                                   │
GIAI ĐOẠN 4: ĐÓNG GÓI & VẬN HÀNH     (đưa app lên chạy thật)
   Tuần 7: Docker  ──►  Tuần 8: Kubernetes  ──►  Tuần 9: AWS
   (K8s BẮT BUỘC học sau Docker)
                                   │
GIAI ĐOẠN 5: TƯ DUY HỆ THỐNG & LUYỆN THI
   Tuần 10: System Design  ──►  Tuần 11: Capstone  ──►  Tuần 12: Mock Interview
   (ghép tất cả lại)            (làm dự án thật)        (luyện phỏng vấn)

XUYÊN SUỐT (song song mỗi ngày):  🇬🇧 English  ·  🏗️ Design Patterns  ·  🧩 System Design Scenarios
```

### Vì sao thứ tự này?

| Giai đoạn | Vì sao học ở đây |
|---|---|
| 1. Ngôn ngữ | Không biết Node.js thì không làm được gì cả — đây là công cụ. |
| 2. Database | App = code + **dữ liệu**. Học SQL trước (phổ biến, chặt chẽ), rồi NoSQL (linh hoạt). |
| 3. Redis/Kafka | Khi đã có DB, học cách **làm nhanh** (Redis cache) và **kết nối nhiều service** (Kafka). |
| 4. Docker→K8s→AWS | Học cách **đóng gói** (Docker), **điều phối nhiều container** (K8s — cần Docker trước!), rồi **chạy trên cloud** (AWS). |
| 5. Design→Capstone→Mock | Giờ mới đủ kiến thức để **thiết kế hệ thống lớn**, **làm dự án ghép tất cả**, và **luyện phỏng vấn**. |

> 💡 **Nếu bạn ĐÃ biết Node.js** (bạn là dev Node rồi): lướt nhanh Tuần 1-2 (xem như ôn lại), dành thời gian cho Tuần 3 trở đi — đó mới là phần mới với bạn.

---

## 📚 Trong MỖI tuần — học theo đúng thứ tự này

### ✅ LƯỢT 1 (lần đầu gặp chủ đề — mục tiêu: HIỂU và làm được)

| Bước | Làm gì | Có ở tuần nào |
|---|---|---|
| 1 | 🌱 **Nhập môn** (`CO-BAN.md`) — hiểu "là gì, để làm gì" bằng ví dụ đời thường | Tuần 5, 6, 7, 8, 9 |
| 2 | 📘 **Lý thuyết** (`README.md`) — đọc theo Ngày 1-2 → 3-4 → 5-6, đừng đọc hết một lúc | Mọi tuần |
| 3 | 🧪 **Lab tận tay** (`lab/LAB.md`) — gõ lệnh, chạy thật. *Nhớ gấp đôi đọc suông.* | Tuần 3, 4, 5, 6, 7, 8 |
| 4 | 💪 **Bài tập** + 🧪 **Quiz tự chấm** cuối tuần (mục tiêu ≥ 12/15) | Mọi tuần |

> Ở lượt 1, **CỨ TẠM BỎ QUA** `DEEP-DIVE.md`, `DESIGN-CASES.md`, `RAPID-FIRE.md` nếu thấy khó. Chúng dành cho lượt 2.

### 🔬 LƯỢT 2 (ôn lại & chuẩn bị phỏng vấn — làm khi đã đi hết lượt 1, hoặc 3-4 tuần trước khi phỏng vấn)

| Bước | Làm gì | Có ở tuần nào |
|---|---|---|
| 5 | 🔬 **Đào sâu** (`DEEP-DIVE.md`) — cơ chế bên trong + câu hỏi phỏng vấn KHÓ | Cả 12 tuần |
| 6 | 🏗️ **Design & Cases** + ⚡ **Rapid-fire** — tình huống thực tế, trả lời nhanh | Tuần 1-9, 12 |
| 7 | 🎯 **Mock Interview** — vào tab Mock PV, dùng **🤖 Phỏng vấn AI** hoặc tự chấm | Tuần 12 / bất cứ lúc nào |

---

## 🇬🇧 Tiếng Anh — học song song mỗi ngày (đặc biệt nếu bạn đang yếu)

Đừng học English thành một "khối" riêng — **rải đều mỗi ngày 20-30 phút**:

**Nếu bạn mới/yếu tiếng Anh → bắt đầu bộ VỠ LÒNG trước:**
1. 🗣️ `english/07-phat-am-co-ban.md` — luyện **âm cuối** 10 phút/ngày (quan trọng nhất).
2. 📘 `english/08-ngu-phap-vo-long.md` — đủ để tự đặt câu.
3. 💬 `english/09-cau-giao-tiep-song-con.md` — thuộc **5 câu/ngày**.
4. 🃏 Tab **Flashcards** → bộ **640 từ vựng cơ bản** — lật **15 thẻ/ngày** (app tự lên lịch ôn).
5. 📖 `english/10-doc-tieng-anh-di-lam.md` — khi gặp tiếng Anh ở chỗ làm.

**Khi đã đỡ hơn:** chuyển sang `01-technical-vocabulary` (từ chuyên ngành theo tuần), `02-reading-technical-docs`, `04-interview-english`.

> Công thức mỗi ngày: **15 thẻ Flashcards + 5 câu giao tiếp + 10 phút phát âm**. Đều đặn quan trọng hơn nhiều.

---

## 📅 Chọn tốc độ phù hợp với bạn

| Tốc độ | Phù hợp với | Mỗi chủ đề | Tổng thời gian |
|---|---|---|---|
| 🐢 **Chậm & chắc** | Người mới, bận, ~1h/ngày | 1.5-2 tuần | ~5-6 tháng |
| 🚶 **Vừa** | ~2h/ngày, có nền cơ bản | 1 tuần (đúng như đánh số) | ~3 tháng |
| 🏃 **Gấp** | Đã có nền, sắp phỏng vấn | Gộp giai đoạn | ~6-8 tuần |

> Người mới: **chọn 🐢 đừng ngại chậm.** Hiểu chắc 1 chủ đề tốt hơn lướt qua 5 chủ đề.

---

## 🧠 4 mẹo học để NHỚ LÂU (khoa học)

1. **Active recall** — học xong tự hỏi "X là gì? để làm gì?" mà không nhìn tài liệu. Dùng phần Checklist cuối mỗi bài Nhập môn + Quiz tự chấm.
2. **Spaced repetition** — ôn lại theo lịch giãn dần. Tab **Flashcards** và **Luyện viết** trong app đã tự làm việc này cho bạn (hệ thống SRS).
3. **Làm Lab, đừng chỉ đọc** — tay gõ lệnh giúp nhớ gấp nhiều lần đọc suông.
4. **Dạy lại** — giải thích chủ đề cho bạn bè/người thân bằng ngôn ngữ đơn giản. Giải thích được = đã hiểu thật.

---

## 🚀 Bắt đầu NGAY HÔM NAY — 3 việc nhỏ

1. **Kỹ thuật:** Nếu mới với Node — mở `week-01-nodejs-core/README.md`, đọc phần **Ngày 1-2**. Nếu đã biết Node — nhảy tới `week-03-sql-database/README.md`.
2. **Tiếng Anh:** mở tab **Flashcards**, chọn một chủ đề trong bộ **640 từ cơ bản**, lật 15 thẻ. Thuộc 5 câu trong `english/09-cau-giao-tiep-song-con.md`.
3. **Đánh dấu tiến độ:** vào tab **📊 Tiến độ**, tick các mục đã xong mỗi tuần để thấy mình đang tiến lên.

> Đừng cố làm hết trong 1 ngày. Mỗi ngày một chút, đều đặn — sau 3 tháng bạn sẽ ngạc nhiên về chính mình. 💪
