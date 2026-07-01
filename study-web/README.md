# 📚 Study Web — Ôn phỏng vấn Backend Node.js

Web ôn luyện phỏng vấn Backend (Node.js · Database · Redis · Kafka · Docker · K8s ·
System Design) — toàn bộ tiếng Việt, thuật ngữ giữ tiếng Anh. Tiến độ lưu trong
`localStorage`, có thể **đồng bộ đa thiết bị** qua Firebase.

Là **PWA**: cài như app trên điện thoại/desktop và **học offline** — `sw.js` cache
app shell + dữ liệu; `manifest.webmanifest` + `icon.svg` lo phần cài đặt.

## Tính năng chính

- **🔥 Hôm nay** — buổi ôn trong ngày (từ đến hạn SRS, câu đã sai, ôn nhanh…),
  vòng tròn mục tiêu/ngày, chuỗi ngày học, huy hiệu, mẹo phỏng vấn xoay vòng.
- **📚 Học** — đọc bộ tài liệu lộ trình 12 tuần + tìm kiếm toàn văn.
- **🃏 Flashcards** — học từ vựng theo SRS (Leitner box), lọc theo tuần / đến hạn /
  từ hay sai; kèm chế độ **test gõ từ** (hiện nghĩa Việt → gõ tiếng Anh).
- **✍️ Luyện viết** — dịch từ, điền câu, nghe & gõ, đọc to (TTS + nhận diện giọng nói).
- **⌨️ Luyện gõ code** — rèn phản xạ gõ, đo WPM.
- **🧠 Tư duy** — 8 chế độ:
  - 💻 **Lập trình** & 🐛 **Sửa bug** — viết/sửa code rồi **chạy test THẬT** trong trình duyệt.
  - 🧩 **IQ**, 🔍 **Đoán output**, 📡 **API/HTTP**, 🗄️ **SQL**, 🖥️ **CLI** — trắc nghiệm có giải thích.
  - 🔁 **Ôn câu sai** — gom mọi câu trắc nghiệm từng chọn sai (output/API/SQL/CLI) vào một
    phiên ôn tập trung (đúng → rời hàng đợi); kèm 🎲 **Ôn trộn nhanh** bốc ngẫu nhiên mọi mode.
  - Mỗi nút mode có **badge độ phủ** (đã đúng/tổng). Bấm **1–4** chọn đáp án, **Enter** sang câu tiếp.
- **🏛️ Thiết kế hệ thống** — đề kinh điển + rubric 5 bước, tự chấm hoặc nhờ **AI chấm**.
- **🎯 Mock interview** & **🏢 Phỏng vấn tổng hợp** — mô phỏng 4 vòng liên tiếp, kèm bộ
  **💬 câu hỏi nên hỏi lại nhà tuyển dụng**.
- **🌟 STAR Builder** — soạn câu trả lời behavioral theo khung STAR, tự chấm checklist +
  AI góp ý; kèm **🇬🇧 mẫu câu tiếng Anh khi phỏng vấn**.
- **📊 Tiến độ** — heatmap hoạt động, phân bố SRS, biểu đồ, và **Điểm sẵn sàng phỏng vấn**.
- **☁️ Đồng bộ** đa thiết bị (Firebase Auth + Firestore, realtime).
- Sáng/tối, **bảng phím tắt** (bấm `?`), onboarding lần đầu.

## Kiểm thử

Bộ test zero-dependency (chạy bằng `node:test`) kiểm toàn vẹn dữ liệu (id duy nhất,
**chạy thật lời giải coding/bug/đoán-output**, rubric design tổng trọng số = 100…) và
wiring tĩnh (tab ↔ view ↔ switchView, id `getElementById`, PREP_KEYS…):

```bash
node --test study-web/test/
```

## Chạy local (đầy đủ, có backend đọc file)

```bash
node study-web/server.js     # → http://localhost:4321
```

## Bản online (GitHub Pages — tĩnh)

GitHub Pages chỉ phục vụ file tĩnh nên không chạy được `server.js`. Thay vào đó
`study-web/build.js` gói sẵn dữ liệu thành `public/data/*.json`:

- `tree.json` — cây mục lục (thay `/api/tree`)
- `snippets.json` — snippet luyện gõ code (thay `/api/snippets`)
- `docs.json` — toàn bộ nội dung markdown để đọc + tìm kiếm (thay `/api/file`, `/api/search`)

Frontend (`app.js`) tự dò: gọi được `/api` thì dùng backend động, không thì tự chuyển
sang đọc `data/*.json`. GitHub Actions (`.github/workflows/pages.yml`) tự build và deploy
mỗi khi push lên `main`.

> Tự build thử bản tĩnh: `node study-web/build.js` rồi mở `public/` bằng web server tĩnh bất kỳ.
