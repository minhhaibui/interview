# 📚 Study Web — Ôn phỏng vấn Backend Node.js

Web ôn luyện phỏng vấn Backend (Node.js · Database · Redis · Kafka · Docker · K8s ·
System Design) — toàn bộ tiếng Việt, thuật ngữ giữ tiếng Anh. Tiến độ lưu trong
`localStorage`, có thể **đồng bộ đa thiết bị** qua Firebase.

Là **PWA**: cài như app trên điện thoại/desktop và **học offline** — `sw.js` cache
app shell + dữ liệu; `manifest.webmanifest` + `icon.svg` lo phần cài đặt.
Deploy bản mới khi đang mở app → banner **🔄 "Có bản cập nhật mới → Tải lại"** tự hiện,
không cần biết mẹo hard-refresh.

## Tính năng chính

- **🔥 Hôm nay** — buổi ôn trong ngày (từ đến hạn SRS, câu đã sai, ôn nhanh…),
  vòng tròn mục tiêu/ngày, chuỗi ngày học, huy hiệu, mẹo phỏng vấn xoay vòng;
  **🎯 đếm ngược ngày phỏng vấn** + **🏁 Ưu tiên nước rút** (3 mảng yếu nhất khi còn ≤14 ngày);
  task **📖 Đọc tiếp** — mở lại bài đang đọc dở, bài đó xong rồi thì tự gợi ý bài kế tiếp chưa đọc;
  **❓ Câu hỏi hôm nay** — mỗi ngày một câu phỏng vấn từ kho mock (cả ngày giữ 1 câu, xem đáp án
  tính 1 lượt học); **🔔 nhắc giờ học** — đặt giờ cạnh mục tiêu/ngày, tới giờ app báo
  Notification (khi đang mở, mỗi ngày 1 lần — máy ngủ trượt phút hẹn vẫn nhắc bù).
- **📚 Học** — đọc bộ tài liệu lộ trình 12 tuần + tìm kiếm toàn văn. Ngoài ra có các
  track chuyên đề trong sidebar:
  - **☕ Java nền tảng (từ số 0)** — 12 bài cho người **chưa biết Java**: Hello World →
    biến/kiểu → điều khiển → method → OOP (class/kế thừa/đa hình/interface) → **SOLID** →
    Collections → Exception → Maven → **capstone** (tự viết app Quản lý sinh viên) →
    **🔧 sổ tra lỗi hay gặp**; mỗi bài có phần *🧪 Tự thử*.
  - **☕ Java Backend (để đi làm)** — 10 bài trình phỏng vấn (JVM, concurrency,
    collections, Spring, MySQL, Redis, mạng, hệ phân tán, HĐH/IO, Docker/K8s).
  - 🧩 System Design Scenarios · 🏗️ Design Patterns · 🇬🇧 English Track.
  - Trải nghiệm đọc: **📋 copy** trên từng code block (hover), **📖 Gần đây** đầu sidebar,
    **📗 tự đánh dấu đã đọc** khi cuộn hết bài (✓ từng bài + badge *x/y* mỗi nhóm +
    thanh tiến độ ở Dashboard; đọc trọn 1 bài tính 1 lượt học giữ chuỗi 🔥),
    nút **◀ Bài trước / Bài tiếp ▶** cuối bài (hoặc phím `←`/`→`) để học tuần tự,
    **📝 ghi chú cá nhân** cuối mỗi bài (tự lưu + sync cloud; chấm 📝 ở sidebar,
    panel tổng hợp + **📤 xuất .md** ở Tiến độ, tìm được qua 🔎 toàn cục).
- **🃏 Flashcards** — học từ vựng theo SRS (Leitner box), lọc theo tuần / đến hạn /
  từ hay sai; kèm 2 chế độ luyện: **📝 test gõ** (tiếng Anh gõ từ, Hàn/Trung **gõ
  phiên âm** — hiện chữ gốc → gõ romanization/pinyin, chấm bỏ dấu thanh điệu) và
  **🎯 quiz chọn nghĩa** (chọn nghĩa đúng trong 4, chấm ngay + cập nhật SRS; đổi
  được **2 chiều** Từ→Nghĩa để nhận diện hoặc Nghĩa→Từ để nhớ chủ động) — cả hai
  chạy cho mọi ngôn ngữ.
  Bộ chọn **🌏 ngôn ngữ**: 🇬🇧 Anh · 🇰🇷 Hàn · 🇨🇳 Trung — Hàn/Trung mỗi thứ tiếng
  168 từ/cụm nhập môn theo 21 chủ đề (chào hỏi, số đếm, số lớn, gia đình, ăn uống, thời
  gian, công việc, giao tiếp, nơi chốn, màu sắc, mua sắm, động từ, cảm xúc, thời tiết,
  đi lại, cơ thể, quần áo, thứ ngày, trong nhà, từ để hỏi, tính từ),
  kèm phiên âm (romanization/pinyin), câu ví dụ và **phát âm TTS đúng giọng bản ngữ**;
  SRS/từ cứng đầu dùng chung cơ chế, có 🌏 panel tiến độ + huy hiệu riêng.
- **✍️ Luyện viết** — dịch từ, điền câu, nghe & gõ, đọc to (TTS + nhận diện giọng nói).
- **⌨️ Luyện gõ code** — rèn phản xạ gõ, đo WPM.
- **🧠 Tư duy** — 12 chế độ:
  - 💻 **Lập trình** & 🐛 **Sửa bug** — viết/sửa code rồi **chạy test THẬT** trong trình duyệt.
  - 🧩 **IQ**, 🔍 **Đoán output**, ⏱️ **Độ phức tạp**, 📡 **API/HTTP**, 🗄️ **SQL**, 🖥️ **CLI**, ☕ **Java**, ☁️ **Redis**, 🏗️ **Phân tán**, 🐳 **DevOps**,
    🟨 **JavaScript**, 🟢 **Node.js**, ⚛️ **React** — trắc nghiệm có giải thích.
    ⏱️ **Độ phức tạp (Big-O)**: nhìn một đoạn code rồi chọn Big-O — câu hỏi tủ ngay sau khi
    bạn giải xong bài. Gồm vòng lặp lồng, chia đôi (log n), bẫy kinh điển (`includes`/`shift`/
    `unshift` trong vòng lặp), đệ quy & memo hoá, sinh tổ hợp 2ⁿ/n!, và cả **bộ nhớ phụ**.
    🏗️ **Hệ phân tán & MQ**: message queue (Kafka partition/ordering/delivery), CAP, transaction phân tán (2PC/TCC/Saga/Outbox), distributed ID (Snowflake), idempotency.
    ☁️ **Redis phỏng vấn**: kiểu dữ liệu, RDB/AOF, cache penetration/breakdown/avalanche, khoá phân tán, HA.
    ☕ **Java phỏng vấn** chuyên sâu (theo khung [JavaGuide](https://javaguide.cn)): JVM &amp; bộ nhớ,
    GC, String pool, equals/hashCode, HashMap nội bộ, concurrency (volatile/synchronized/
    ConcurrentHashMap/ThreadLocal), generics &amp; type erasure, Java 8+ (stream/Optional), OOP,
    Spring/JPA (DI, bean scope, @Transactional, N+1), **MyBatis** (#{}/${}, mapper proxy,
    cache 2 tầng), **SOLID** (5 nguyên lý).
    📖 **Lý thuyết chuyên sâu JS · Node · React** (165 câu) — hỏi KHÁI NIỆM & CƠ CHẾ, không phải
    đoán output; **làm riêng** ở đây theo từng mảng, hoặc **làm chung** trong buổi 🎯 Phỏng vấn:
    🟨 **JavaScript** (61 câu): scope & hoisting/TDZ, closure, `this` & binding, prototype/class,
    ép kiểu & tham chiếu, event loop & microtask, Promise/async, generator & iterator, Proxy,
    WeakMap & GC, ESM vs CommonJS, Symbol, số nguyên an toàn & BigInt, bẫy regex (ReDoS, lastIndex),
    mutate vs bất biến, lỗi tuỳ biến & `cause`, async iterator.
    🟢 **Node.js** (54 câu): 6 pha event loop & libuv thread pool, `nextTick` vs `setImmediate`,
    stream & **backpressure**, `pipeline` vs `pipe`, require cache & module wrapper,
    cluster vs worker_threads, Buffer, EventEmitter, `uncaughtException` & **graceful shutdown**,
    rò rỉ bộ nhớ, bảo mật (command injection, path traversal, prototype pollution, băm mật khẩu,
    JWT, secret, body limit, `npm ci`), dns.lookup vs resolve, và cách profiling khi service chậm.
    ⚛️ **React** (50 câu): virtual DOM & reconciliation, **key**, batching & bất biến, derived state,
    quy tắc hooks, deps & cleanup, **stale closure**, `memo`/`useMemo`/`useCallback`, context
    re-render, virtualization, controlled form, error boundary, StrictMode, và React 18/19
    (Suspense, `useTransition`, `useSyncExternalStore`, `useId`, RSC, hydration); thêm định tuyến SPA,
    kiểm thử với React Testing Library, server state (React Query) vs store toàn cục, a11y và XSS.
  - 🔁 **Ôn câu sai** — gom mọi câu trắc nghiệm từng chọn sai (output/API/SQL/CLI +
    vòng Tiếng Anh/Tình huống của buổi phỏng vấn) vào một phiên ôn tập trung
    (đúng → rời hàng đợi); có **📉 chip chủ đề yếu** (câu sai dồn cụm ở đâu —
    bấm chip để ôn riêng chủ đề đó); kèm 🎲 **Ôn trộn nhanh** bốc ngẫu nhiên mọi
    mode và 📌 **Ôn câu đã ghim** — câu nào hay thì bấm ghim ở phần giải thích
    để tự gom bộ xem-lại-trước-giờ-G (chỉ gỡ tay, trả lời đúng không tự gỡ).
  - 🎓 **Thi thử** — bài kiểm tra tổng hợp **có tính giờ** mô phỏng screening test online
    (⚡ 10 câu·7 phút, 🎓 20 câu·15 phút bốc xen kẽ đều mọi mảng trắc nghiệm —
    hoặc chọn **phạm vi đề = 1 mảng** để luyện chuyên đề, lịch sử ghi rõ mảng; hoặc
    🔥 **nước rút** 15 câu·10 phút dồn câu vào mảng yếu — độ phủ thấp/đang sai nhiều
    được hỏi nhiều hơn, ưu tiên câu đang sai và câu chưa từng làm đúng):
    không hiện đúng/sai giữa chừng, hết giờ tự nộp (đồng hồ tính theo deadline nên
    rời tab hay **cả F5/reload** cũng không "câu giờ" được — bài dở tự nối lại
    đúng câu, đúng deadline); nộp xong mới chấm — điểm + phân bố theo mảng +
    xem lại từng câu sai, câu sai tự vào hàng đợi 🔁; lưu lịch sử điểm các lần thi
    (đồ thị 🎓 ở Dashboard, tab Hôm nay nhắc thi lại khi quá 7 ngày chưa đo phong độ).
  - Mỗi nút mode có **badge độ phủ** (đã đúng/tổng). Bấm **1–4** chọn đáp án, **Enter** sang câu tiếp.
- **🏛️ Thiết kế hệ thống** — đề kinh điển + rubric 5 bước, tự chấm hoặc nhờ **AI chấm**.
- **🎯 Phỏng vấn** — một tab gộp cả buổi phỏng vấn, có 3 chế độ:
  - **🏅 Buổi phỏng vấn** (mặc định) — đúng **3 phần** như phần lớn buổi thật:
    🇬🇧 Tiếng Anh **8 câu** → 🧩 **IQ 24 câu** (phần nặng ký nhất, có tính giờ) →
    ⌨️ Code **8 câu** (đọc code: đoán output & tính Big-O), khép lại bằng gợi ý
    **💬 câu hỏi nên hỏi lại nhà tuyển dụng**.
  - **🧩 Luyện nhanh (hỏi đáp)** — bốc câu từ kho 180 câu Q&A của 12 tuần, đếm giờ,
    tự chấm; câu chưa tốt vào kho ôn lại.
  - **🤖 Phỏng vấn AI** — Claude đóng vai người phỏng vấn (BYOK API key): hỏi → bạn trả lời
    (gõ hoặc nói) → đào sâu → chấm điểm cuối buổi.

  Ô trả lời có **🎙️ nói-để-điền** (đọc chính tả VI/EN thay vì gõ — cũng có ở 4 ô STAR và
  dàn ý Thiết kế HT). Ngoài buổi đầy đủ còn **chọn được kiểu bài khác**:
  - 💬 **Thêm hỏi miệng** — ba phần như trên, thêm 2 vòng câu hỏi MỞ mở màn: 🏷 giới thiệu bản
    thân (tiếng Anh) và 💬 hỏi kiến thức từ kho 180 câu — trả lời miệng/gõ, đối chiếu đáp án mẫu
    rồi **tự chấm 3 mức**; có nút 🤖 nhờ AI chấm /10 nếu có API key.
  - ⌨️ **Thêm viết code** — phần code có thêm 2 bài tự giải, chạy test thật trong trình duyệt.
  - 🏅 **Phỏng vấn + lý thuyết** — buổi đầy đủ, chèn thêm vòng 📖 **lý thuyết 10 câu**
    (trộn đều JS · Node · React) ngay sau phần tiếng Anh.
  - 📖 **Chỉ lý thuyết** — bỏ IQ & tiếng Anh: 16 câu lý thuyết JS/Node/React rồi 6 câu đọc code,
    dành cho buổi phỏng vấn thiên kiến thức nền.

  Kho câu đủ lớn để ôn dài hơi mà **không lặp lại**: 🧩 IQ **363 câu** (10 nhóm: dãy số ·
  chữ cái · logic · toán nhanh · tương tự · xác suất · mã hoá · hình & không gian ·
  chuyển động & công việc · chọn từ khác loại), 🇬🇧 tiếng Anh **125 câu** (82 câu giao tiếp),
  ⌨️ code **110 câu** (đoán output 52 + Big-O 58), 📖 lý thuyết **165 câu**
  (JS 61 · Node 54 · React 50) — chạy được **~15 buổi liên tiếp** mà IQ, tiếng Anh và
  lý thuyết không lặp câu nào.

  **🚫 Không hỏi lại câu của buổi trước**: mỗi câu được ghi vào `prep-iv-seen` NGAY khi bạn trả lời
  (bỏ dở buổi cũng không bị hỏi lại), buổi sau chỉ bốc từ phần chưa hỏi — quan trọng nhất với câu
  **IQ**. Màn chọn kiểu bài hiện *🆕 còn X/Y câu chưa từng hỏi* cho từng phần; kho cạn thì dùng nốt
  câu mới rồi mới quay vòng từ câu hỏi lâu nhất, và có nút **↻ cho hỏi lại từ đầu**.

  Vòng hỏi mở chấm theo **tự đánh giá** (✓ tốt 100 · △ tạm 60 · ✗ chưa 20) nên chạy được cả
  khi không có API key; vòng **🔍 đọc code** trộn *đoán output* và *tính Big-O*; vòng **🇬🇧 tiếng Anh** thiên
  **giao tiếp**: sát nghĩa, sắc thái & ngữ điệu (chọn cách nói phù hợp, hiểu hàm ý của
  “not quite right”, trọng âm câu đổi nghĩa…) chứ không nặng ngữ pháp.
  Cuối buổi có **báo cáo chi tiết**: điểm từng vòng, kết luận Đậu/Cân nhắc/Chưa đạt,
  **📉 chủ đề sai nhiều nhất**, và **🔍 xem lại từng câu** (bạn chọn gì · đáp án đúng · giải thích).
  Mỗi buổi được **lưu vào lịch sử** — bấm một dòng để mở lại đúng báo cáo đó (10 buổi
  gần nhất giữ chi tiết từng câu).
- **🌟 STAR Builder** — 19 câu behavioral (kể cả sự cố production, technical debt,
  bất đồng với sếp…): soạn theo khung STAR, tự chấm checklist + AI góp ý; kèm
  **🇬🇧 mẫu câu tiếng Anh khi phỏng vấn** (9 nhóm, có **nút 🔊 nghe & ▶️ shadowing**).
- **📅 Kế hoạch** — lộ trình 12 tuần theo lịch (ngày bắt đầu + ngày phỏng vấn, nhịp độ
  thực tế vs lịch), và **🧪 Capstone tracker**: checklist nghiệm thu Upgrade 1→5
  (Postgres → Redis → Kafka → Docker/K8s → AWS), tick từng mục đã tận tay làm —
  tab Hôm nay tự nhắc upgrade đến hạn theo tuần.
- **📊 Tiến độ** — heatmap hoạt động, phân bố SRS, biểu đồ (kể cả **📬 dự báo từ
  đến hạn 7 ngày tới** — quá hạn dồn vào cột "Nay", và **⏱ phút học thực tế** — app tự đếm
  mỗi phút có thao tác khi tab mở, AFK/tab nền không tính), **📊 tổng kết 7 ngày qua vs 7 ngày
  trước** (lượt · phút · bài đọc mới, mũi tên xu hướng), **Điểm sẵn sàng phỏng vấn**,
  và **🖨️ Bản in ôn nhanh** (cheat sheet cá nhân hoá: từ hay quên, câu đang sai + câu
  đã ghim kèm đáp án, ý chính các đề design yếu — in ra đọc trước giờ phỏng vấn).
- **🔎 Tìm kiếm toàn cục** — nút 🔎 topbar hoặc phím `/`: tìm khắp mọi ngân hàng
  (quiz trắc nghiệm · lập trình · sửa bug · thiết kế · STAR · 💬 câu hỏi ngược ·
  🇬🇧 mẫu câu tiếng Anh · **📝 ghi chú của bạn**), **gõ không dấu vẫn khớp**; chọn câu trắc nghiệm → luyện
  ngay 1 câu, loại khác → mở đúng bài/nhóm; kèm lối tắt tìm tiếp trong tài liệu.
- **☁️ Đồng bộ** đa thiết bị (Firebase Auth + Firestore, realtime).
- Sáng/tối, **bảng phím tắt** (bấm `?`), onboarding lần đầu.

## Kiểm thử

Bộ test zero-dependency (chạy bằng `node:test`) kiểm toàn vẹn dữ liệu (id duy nhất,
**chạy thật lời giải coding/bug/đoán-output**, rubric design tổng trọng số = 100…) và
wiring tĩnh (tab ↔ view ↔ switchView, id `getElementById`, PREP_KEYS…).
Có cả **luật chống “lộ đáp án”**: đáp án đúng không được vừa dài nhất vừa dài hơn trung
bình các lựa chọn còn lại ≥40% — tật kinh điển khiến nhìn phát là chọn được mà không cần
hiểu. Câu mới soạn phải viết distractor cụ thể & hợp lý ngang đáp án đúng:

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

### Cấu hình Firebase (đồng bộ cloud)

`public/firebase-config.js` **không nằm trong git** — `build.js` sinh nó từ env, nếu thiếu thì
app báo *"Chưa cấu hình Firebase"* và chỉ lưu `localStorage`. Hai cách khai báo:

| Môi trường | Cách làm |
|---|---|
| Local | Tạo `study-web/.env` với 7 biến `FIREBASE_*` (xem mẫu trong `build.js`) |
| GitHub Pages | Settings → Secrets and variables → Actions → **New repository secret**, tên `FIREBASE_CONFIG`, giá trị là **nguyên khối JSON** copy từ Firebase Console |

Ưu tiên `FIREBASE_CONFIG` (một secret duy nhất); nếu trống mới đọc 7 biến rời. JSON sai cú pháp
sẽ **fail build ngay** thay vì deploy ra site thiếu config. Đây không phải secret thật — config
web Firebase vốn công khai, bảo mật nằm ở Firestore Rules.
