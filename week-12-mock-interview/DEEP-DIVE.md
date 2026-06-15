# 🔬 Đào sâu — Tuần 12: Chiến thuật phỏng vấn

> README đã cho bạn checklist, script mock và outline STAR; tài liệu này dạy bạn **cách trình bày** để cùng một lượng kiến thức nghe như senior thay vì junior — vì phỏng vấn chấm cách bạn nghĩ, không chỉ cái bạn biết.

---

## 🧠 Khung trả lời sâu cho từng vòng

Một nguyên tắc xuyên suốt: **interviewer không đọc được suy nghĩ trong đầu bạn**. Họ chỉ chấm những gì bạn nói thành tiếng. Vì vậy "trả lời tốt" = cấu trúc rõ + nói to quá trình + chủ động nêu trade-off mà không cần bị hỏi.

### Vòng Technical (coding + knowledge): khung "định nghĩa → cơ chế → đánh đổi → ví dụ thực tế"

Đây là khung 4 tầng để mọi câu hỏi kiến thức nghe có chiều sâu. Ví dụ với câu "Index là gì?":

1. **Định nghĩa (1 câu)** — "Index là cấu trúc dữ liệu phụ (thường B-tree) giúp tìm row mà không phải quét toàn bảng."
2. **Cơ chế (2-3 câu)** — "B-tree giữ key đã sắp xếp, tra cứu O(log n); mỗi index là một cây riêng phải cập nhật khi write."
3. **Đánh đổi (2 câu) — đây là tầng tách senior khỏi junior** — "Đổi lại: write chậm hơn vì phải maintain thêm cây, tốn disk, và index sai còn hại hơn không có. Nên index theo query pattern thật, không index bừa."
4. **Ví dụ thực tế (1-2 câu)** — "Trong capstone em thêm composite index `(user_id, created_at)` cho màn lịch sử đơn hàng, p95 query từ ~400ms còn ~30ms."

> 💡 Junior dừng ở tầng 1-2. Senior luôn đi tới tầng 3 (trade-off) và tầng 4 (đã từng làm thật). Nếu bạn chỉ nhớ 1 điều từ cả tài liệu này: **chủ động nói trade-off khi chưa bị hỏi.**

**Coding round — nói to (think out loud) là bắt buộc:**
- Trước khi gõ: nhắc lại đề bằng lời mình ("Em hiểu là tìm... với ràng buộc...") + hỏi 1-2 clarify (input có thể null? size tối đa? cần tối ưu time hay memory?).
- Nêu brute-force trước, gọi tên độ phức tạp, rồi nói "em sẽ cải thiện bằng...". Việc này cho thấy bạn biết có giải pháp tốt hơn ngay cả khi chưa code xong.
- Vừa code vừa giải thích từng bước. Im lặng gõ 5 phút = interviewer không biết bạn đang nghĩ đúng hay lạc.
- Tự test: chạy thử với 1 case thường + 1 edge case (mảng rỗng, 1 phần tử, trùng lặp).

**Cách xử lý khi KHÔNG biết câu trả lời (quan trọng hơn bạn tưởng):**
Không ai biết hết. Cách bạn xử lý khoảng trống mới là tín hiệu. Quy trình 3 bước:
1. **Think out loud để thu hẹp** — "Em chưa làm trực tiếp cái này, nhưng nó giống... mà em từng làm, để em suy luận từ đó." Suy luận to thành tiếng đôi khi dẫn bạn tới đáp án đúng.
2. **Thừa nhận trung thực phần không biết** — "Phần chi tiết X em không chắc, em sẽ không đoán bừa." Trung thực ăn điểm; chém gió rồi bị xoáy sập thì mất sạch.
3. **Cho thấy cách bạn sẽ tìm ra** — "Nếu gặp ở việc thật, em sẽ đọc... / benchmark... / hỏi...". Nhà tuyển dụng thuê người **giải quyết được cái chưa biết**, không phải người biết sẵn mọi thứ.

### Vòng System Design: khung CLARIFY → ESTIMATE → API → DATA → SCALE → TRADE-OFF

README tuần 10 có framework 5 bước; đây là bản tinh chỉnh cho **quản lý thời gian 45 phút** và tránh các bẫy thời gian:

| Phút | Giai đoạn | Việc làm | Bẫy phải tránh |
|---|---|---|---|
| 0-5 | **CLARIFY** | Hỏi functional + non-functional requirement, chốt scope, ghi lên góc bảng | Nhảy vào vẽ box ngay khi chưa rõ đề |
| 5-10 | **ESTIMATE** | QPS, storage, bandwidth — phép tính thô là đủ | Tính quá lâu, số quá chi tiết vô nghĩa |
| 10-15 | **API + DATA** | Vài endpoint chính + data model/schema cốt lõi | Bỏ qua data model, nhảy thẳng sang scale |
| 15-30 | **HIGH-LEVEL → SCALE** | Vẽ kiến trúc cơ bản chạy được TRƯỚC, rồi mới scale | Over-engineer ngay từ đầu (xem red flag) |
| 30-40 | **DEEP DIVE** | Đào sâu 1-2 thành phần interviewer quan tâm | Tự chọn phần dễ thay vì phần họ muốn |
| 40-45 | **TRADE-OFF + WRAP** | Tóm tắt, nêu bottleneck còn lại, "nếu có thêm thời gian em sẽ..." | Hết giờ mà chưa kịp tổng kết |

> 💡 Mẹo quản lý thời gian: **liếc đồng hồ ở phút 15 và 30**. Nếu phút 15 còn loay hoay clarify → bạn đang chậm, chốt scope ngay. Luôn vẽ một kiến trúc **chạy được** trước khi tô vẽ chi tiết — interviewer cần thấy hệ thống hoạt động end-to-end, không cần thấy bạn biết 10 công nghệ.

**Câu thần chú điều hướng:** "Em sẽ bắt đầu đơn giản rồi scale dần — anh/chị muốn em đào sâu phần nào nhất?" Câu này (a) cho thấy bạn biết tự kiềm chế over-engineer, (b) để interviewer lái về đúng cái họ đang chấm.

### Vòng Behavioral: STAR đào sâu + cách chọn câu chuyện

README đã định nghĩa STAR. Ba điều đào sâu hơn:

**1. Tỷ lệ vàng giữa các phần** — nhiều người dồn 80% thời gian vào Situation (kể lể bối cảnh). Tỷ lệ đúng:
- **S: 15%** (1-2 câu đủ context, không kể cả lịch sử công ty)
- **T: 10%** (nhiệm vụ CỦA BẠN, không phải của team)
- **A: 60%** — phần dài nhất, nói **"tôi"**, kể từng quyết định và *vì sao* bạn chọn vậy
- **R: 15%** — kết quả ĐO ĐƯỢC + bài học

**2. Cách CHỌN câu chuyện** — chuẩn bị sẵn một "kho" 5-6 câu chuyện mạnh, mỗi câu phủ được nhiều câu hỏi. Một câu chuyện bug production tốt có thể trả lời được: "bug khó nhất", "lần gây sự cố", "lần làm việc dưới áp lực", "lần học nhanh". Đừng học thuộc 10 câu chuyện riêng lẻ; hãy có 5-6 câu **đa năng** và uốn nắn theo câu hỏi.

Tiêu chí một câu chuyện đáng kể: (a) bạn là nhân vật chính có hành động cụ thể, (b) có xung đột/khó khăn thật, (c) có kết quả đo được, (d) có bài học. Tránh câu chuyện mà bạn chỉ là người đứng xem.

**3. Định lượng Result kể cả khi không có số tròn trịa** — không phải lúc nào cũng có "giảm 80% latency". Khi thiếu số tuyệt đối, dùng:
- So sánh tương đối: "trước đây mỗi lần debug mất nửa ngày, sau khi thêm correlation ID còn ~30 phút."
- Quy mô tác động: "fix này chặn lỗi ảnh hưởng ~tất cả đơn hàng có thanh toán."
- Hệ quả phòng ngừa: "thêm test + alert nên lỗi này không tái diễn suốt 6 tháng sau."

---

## 🧪 Ví dụ trả lời mẫu (good vs bad)

### Cặp 1 — Technical: "Sự khác nhau giữa SQL và NoSQL?"

❌ **Nông (junior):** "SQL có schema cố định và quan hệ, NoSQL thì linh hoạt schema và scale tốt hơn. NoSQL nhanh hơn cho dữ liệu lớn."
> Vấn đề: đúng nhưng hời hợt, không trade-off, không ví dụ, câu cuối còn sai (NoSQL không "nhanh hơn" một cách tuyệt đối).

✅ **Sâu (có trade-off + ví dụ):** "SQL phù hợp khi dữ liệu có quan hệ rõ và cần ACID mạnh — như giao dịch tài chính, nơi một transaction trừ tiền phải atomic. NoSQL phù hợp khi cần schema linh hoạt, write throughput rất cao và query chủ yếu theo key, chấp nhận eventual consistency. **Trade-off cốt lõi là consistency vs scale-out**: NoSQL scale ngang dễ vì bỏ join và relaxed consistency, nhưng bạn phải tự lo những thứ SQL cho sẵn như transaction đa bảng. Trong capstone em dùng PostgreSQL cho order vì cần transaction và ràng buộc tồn kho chặt, nhưng nếu là hệ thống log/event nghìn write/giây thì em sẽ chọn Cassandra. Không có cái nào 'tốt hơn' — chọn theo access pattern."
> Tốt vì: định nghĩa → cơ chế (vì sao NoSQL scale ngang) → trade-off thẳng → ví dụ thật → kết luận chững chạc "tùy bài toán".

### Cặp 2 — Behavioral STAR: "Kể về lần bạn xử lý một bug khó."

❌ **Mơ hồ:** "Có lần hệ thống bị lỗi và mất khá lâu mới tìm ra. Chúng tôi đã cùng nhau debug và cuối cùng sửa được. Em học được là phải cẩn thận hơn."
> Vấn đề: không có bối cảnh cụ thể, "chúng tôi" che mất vai trò bạn, không quy trình, không số liệu, bài học sáo rỗng.

✅ **Cụ thể có số liệu (STAR):**
- *(S)* "Ở capstone, sau khi lên prod môi trường staging, ~2% đơn hàng bị kẹt ở trạng thái PENDING không bao giờ hoàn tất."
- *(T)* "Em phụ trách order service nên nhận điều tra."
- *(A)* "Em lần theo correlation ID trong log của một đơn kẹt, thấy event `payment.completed` được publish nhưng consumer không xử lý. Em tái hiện bằng cách bắn lại event và phát hiện consumer crash giữa chừng *sau khi* xử lý nhưng *trước khi* commit offset — restart thì offset đã nhảy nên message bị bỏ. Em đổi sang commit offset SAU xử lý và làm consumer idempotent bằng bảng processed_event_id, rồi thêm DLQ cho message lỗi."
- *(R)* "Tỷ lệ đơn kẹt về 0; em thêm alert trên consumer lag để bắt sớm nếu tái diễn. Bài học lớn nhất: ordering giữa 'xử lý' và 'commit offset' quyết định tính đúng đắn — và idempotency là lưới an toàn bắt buộc cho at-least-once."
> Tốt vì: bối cảnh cụ thể, "em" rõ vai trò, quy trình debug bài bản (log → tái hiện → cô lập → fix → phòng ngừa), kết quả đo được, bài học có chiều sâu kỹ thuật.

### Cặp 3 — Tình huống nhạy cảm: "Kể về lần bạn bất đồng với đồng nghiệp / hoặc làm hỏng production."

❌ **Đổ lỗi / né tránh:** "Đồng nghiệp em viết code ẩu nên gây lỗi, em phải sửa giúp." Hoặc: "Em chưa từng gây sự cố production bao giờ."
> Vấn đề: đổ lỗi = red flag về teamwork; "chưa từng" = thiếu trải nghiệm hoặc thiếu trung thực. Cả hai đều trượt câu kiểm tra ownership.

✅ **Nhận trách nhiệm + cho thấy trưởng thành:** "Một lần em chạy migration thêm cột mà quên thứ tự deploy, khiến code cũ đọc phải schema mới và ~10 phút API lỗi 500. Em là người gây ra. Em rollback migration ngay, báo team và stakeholder trong kênh sự cố thay vì im lặng, rồi viết postmortem blameless. Hành động hệ thống: bọn em thêm rule 'migration phải backward-compatible' và một CI check chặn migration phá tương thích. Từ đó loại lỗi này không tái diễn. Em học được rằng sự cố không tránh được hoàn toàn — điều quan trọng là minh bạch khi xử lý và biến nó thành rào chắn cho cả team."
> Tốt vì: nhận lỗi thẳng (ownership), quy trình xử lý đúng (rollback → communicate → postmortem), biện pháp hệ thống chứ không chỉ "lần sau cẩn thận hơn", và đóng bằng bài học.

---

## 🐛 Sai lầm & red flag hay gặp

| # | Sai lầm / Red flag | Vì sao trượt | Cách tránh |
|---|---|---|---|
| 1 | **Trả lời vòng vo, không trả lời thẳng câu hỏi** | Interviewer nghĩ bạn không hiểu câu hỏi hoặc đang giấu dốt | Trả lời **kết luận trước, giải thích sau** (BLUF — bottom line up front). "Câu trả lời ngắn là X. Lý do là..." |
| 2 | **Chém gió cái không biết** | Bị hỏi sâu thêm 2 câu là sập, mất luôn niềm tin vào phần bạn nói thật | Dùng quy trình "không biết" 3 bước ở trên. Thừa nhận biên giới hiểu biết |
| 3 | **Chê công ty cũ / sếp / đồng nghiệp** | Interviewer nghĩ "mai mốt nó sẽ nói xấu mình y vậy" | Hướng về phía trước: nói cái bạn muốn TỚI, không phải cái bạn muốn TRỐN. Trung lập với quá khứ |
| 4 | **Không hỏi ngược interviewer** | Tín hiệu thiếu quan tâm / không nghiêm túc với vị trí | LUÔN chuẩn bị 3-4 câu hỏi thật (xem README Ngày 6). Hỏi cả interviewer về trải nghiệm của họ |
| 5 | **Không định lượng kết quả** | "Cải thiện performance" — bao nhiêu? Nghe như chưa từng đo | Gắn số vào mọi thành tích; nếu không có số tuyệt đối thì dùng so sánh tương đối |
| 6 | **Im lặng khi bí (không think out loud)** | Interviewer không chấm được tư duy → coi như bạn bí hoàn toàn | Nói to mọi suy nghĩ kể cả khi bí: "Em đang phân vân giữa A và B vì..." Quá trình cũng được chấm |
| 7 | **Over-engineer system design ngay từ đầu** | Vẽ Kafka + sharding + service mesh cho hệ thống 100 user = thiếu phán đoán | Bắt đầu đơn giản nhất chạy được, scale khi interviewer đẩy tải lên. Mọi component phải có lý do |
| 8 | **Không làm rõ requirement trước khi giải** | Giải sai đề, hoặc giải bài khó hơn cần thiết | Dành 2-5 phút clarify. "Để em chắc đã hiểu đúng..." Vài câu hỏi đúng đáng giá hơn 20 phút code sai hướng |
| 9 | **Nói "chúng tôi" che mất vai trò cá nhân** | Interviewer không biết BẠN làm gì hay chỉ đứng cạnh | Trong phần Action của STAR, dùng "tôi/em". Dùng "chúng tôi" chỉ khi mô tả bối cảnh chung |
| 10 | **Tranh cãi với interviewer khi bị phản biện** | Cố chấp = khó làm việc cùng | Phản biện thường là phép thử. "Ý hay, để em cân nhắc lại..." rồi hoặc điều chỉnh, hoặc bảo vệ bằng data một cách bình tĩnh |

---

## ⚖️ Chiến thuật & quyết định

### Deal lương — chi tiết hơn README

Nguyên tắc nền: **người nói số trước thường bất lợi** vì tự đặt trần cho mình. Chiến thuật theo tình huống:

- **Bị hỏi "mong muốn bao nhiêu?" ở vòng đầu / qua HR:** trì hoãn lịch sự, **neo theo thị trường** thay vì hoàn cảnh cá nhân.
  - *Mẫu:* "Em muốn hiểu rõ scope và level của vị trí trước khi bàn con số. Anh/chị chia sẻ được range budget cho role này không?"
- **Bị ép phải nói số:** đưa **range** với **cận dưới = mức bạn thực sự hài lòng** (vì họ thường offer quanh cận dưới). Neo bằng dữ kiện thị trường: "Theo khảo sát mặt bằng cho [vị trí + level + khu vực], range hợp lý là X-Y, em kỳ vọng trong khoảng đó."
- **Khi nhận offer:** KHÔNG nhận ngay tại chỗ. Xin 2-3 ngày — hoàn toàn chuyên nghiệp. Cảm ơn nhiệt tình để giữ thiện chí.
- **Negotiate bằng đòn bẩy, không bằng cảm xúc:** offer cạnh tranh đang có, mặt bằng thị trường, giá trị cụ thể bạn mang (skill hiếm, có thể onboard nhanh). KHÔNG dùng "em cần tiền vì..." — đó là vấn đề của bạn, không phải đòn bẩy.
- **Nhìn TOTAL COMP, không chỉ base:** lương cứng + thưởng + chu kỳ review (6 hay 12 tháng — ảnh hưởng lớn tới tăng lương) + equity (hỏi rõ vesting & định giá) + ngày phép + remote/hybrid + budget học tập + bảo hiểm. Một base thấp hơn 10% nhưng review 6 tháng + remote có thể tốt hơn.
- **Mọi thỏa thuận → xin offer letter BẰNG VĂN BẢN** trước khi báo nghỉ chỗ cũ. Thỏa thuận miệng không tính.

### Chọn offer khi có nhiều lựa chọn

Đừng chỉ so lương. Lập bảng cân nhắc theo trọng số riêng của bạn:

| Tiêu chí | Vì sao quan trọng |
|---|---|
| Học được gì / chất lượng team | 2-3 năm tới quyết định nhiều hơn 10% lương trước mắt |
| Bài toán kỹ thuật & quy mô | Có giúp bạn lên level tiếp theo không? |
| Manager & văn hóa engineering | "Người ta nghỉ vì sếp, không vì công ty" — có postmortem blameless? code review lành mạnh? |
| Tăng trưởng & ổn định công ty | Runway, sản phẩm có khách hàng thật không |
| Total comp & chu kỳ review | Như trên |
| Work-life & remote | Bền vững dài hạn |

> 💡 Mức lương nhiều khi quên sau 3 tháng; một manager tệ hoặc codebase không học được gì thì ám ảnh mỗi ngày. Cân nhắc dài hạn.

### Câu hỏi nên hỏi interviewer ở MỖI vòng

README cho danh sách chung; mẹo là **chọn câu hợp với vai trò người đang phỏng vấn** — nó cho thấy bạn tinh ý:

- **Vòng với engineer/tech lead:** "Hệ thống đau nhất ở đâu về kỹ thuật?", "Tỷ lệ thời gian feature mới vs trả nợ kỹ thuật?", "Quy trình code review & on-call?"
- **Vòng với engineering manager:** "Em sẽ được đánh giá bằng tiêu chí gì trong 6 tháng đầu?", "Team đang định scale thế nào?", "Lộ trình phát triển từ vị trí này?"
- **Vòng với HR/recruiter:** quy trình & timeline các vòng tiếp theo, cấu trúc total comp, văn hóa, chính sách remote (để dành lương cho stage offer).
- **Câu vàng cho bất kỳ ai:** "Điều gì khiến anh/chị ở lại công ty này?" — câu trả lời (và độ ngập ngừng) tiết lộ rất nhiều.

### Follow-up sau phỏng vấn

- Gửi **thank-you note ngắn** trong 24h (email hoặc qua recruiter): cảm ơn, nhắc 1 điểm cụ thể trong buổi nói chuyện làm bạn thêm hứng thú, tái khẳng định quan tâm. Ngắn 3-4 câu, không sáo.
- Nếu có câu bạn trả lời chưa tốt, có thể bổ sung ngắn gọn: "Về câu X anh/chị hỏi, em nghĩ thêm và muốn bổ sung..." — cho thấy bạn vẫn suy nghĩ về vấn đề.
- Hỏi rõ **timeline phản hồi**; nếu quá hạn 2-3 ngày, follow-up lịch sự một lần. Im lặng không phải là từ chối — đừng tự suy diễn.

---

## 🎯 Câu hỏi phỏng vấn KINH ĐIỂN + cách trả lời

> README đã xử lý "Giới thiệu bản thân" và 15 câu meta. Đây là các câu **cạm bẫy/cảm xúc** và vài câu technical hay gặp, kèm chiến thuật trả lời.

**1. "Điểm yếu lớn nhất của bạn là gì?"**
Công thức: điểm yếu **thật** + **không chí mạng** với vị trí + **đang khắc phục có bằng chứng**.
> "Em từng ôm việc quá lâu trước khi nhờ giúp vì sợ làm phiền. Hệ quả là vài lần kẹt cả buổi cho thứ đồng nghiệp giải trong 10 phút. Giờ em đặt quy tắc: kẹt 45 phút mà chưa tiến triển thì hỏi, kèm theo đúng những gì đã thử để người giúp đỡ nhanh." Tránh sáo rỗng "em quá cầu toàn / quá chăm chỉ" — interviewer nghe cả trăm lần và biết đó là né tránh.

**2. "Vì sao bạn nghỉ việc cũ / ứng tuyển vị trí này?"**
Luôn hướng **về phía trước**, không nói xấu. Nối với điểm cụ thể của công ty đang ứng tuyển.
> "Em học được nhiều ở chỗ cũ, nhưng hệ thống ở đó scale tới ngưỡng hiện tại là đủ và em muốn thử thách lớn hơn về [domain/scale]. Em chú ý công ty mình đang làm [sản phẩm/bài toán cụ thể] với [stack], đúng hướng em muốn đi sâu." Tuyệt đối không: "sếp cũ tệ", "lương thấp", "công ty cũ chán".

**3. "Mức lương mong muốn của bạn?"**
Xem phần Deal lương ở trên: trì hoãn lịch sự → hỏi range của họ → nếu buộc thì đưa range neo theo thị trường với cận dưới = mức hài lòng. Không nói một con số cứng ở vòng đầu.

**4. "Kể về dự án khó nhất / bạn tự hào nhất."**
Dùng STAR. Chọn dự án bạn là **nhân vật chính** và có **quyết định kỹ thuật thật** để kể. Capstone hoàn hảo cho câu này: nêu bài toán (consistency trong order distributed), quyết định khó (saga vs 2PC, outbox vì sao), và kết quả đo được. Nhấn vào **vì sao bạn chọn vậy** — đó là cái họ chấm.

**5. "Bạn có câu hỏi gì cho chúng tôi không?"**
LUÔN có. Không hỏi = red flag. Chọn câu hợp vai trò người phỏng vấn (xem mục Chiến thuật). Tránh hỏi lương/phép ở vòng kỹ thuật.

**6. (Technical) "Bạn tối ưu một API chậm thế nào?"**
Khung ngắn-sâu: **"Đo trước, đoán sau."** → metrics khoanh vùng (endpoint nào, p95 hay toàn bộ, từ khi nào) → distributed tracing tìm span chậm (DB? external call? event loop lag?) → nếu DB thì EXPLAIN ANALYZE + index + lock → fix → **thêm alert cho metric đó**. Nhấn: không tối ưu mù, không đoán bừa.

**7. (Technical) "Idempotency là gì và khi nào cần?"**
Định nghĩa → "thao tác chạy nhiều lần cho kết quả như chạy một lần." Cơ chế → idempotency key + unique constraint / state machine. Trade-off → cần lưu key (TTL, dọn dẹp), xử lý race khi 2 request cùng key đến đồng thời. Ví dụ → "POST /payments: client gửi Idempotency-Key, em unique constraint trên key; request trùng trả về kết quả cũ thay vì charge lần hai." Bắt buộc cho mọi thứ có retry (payment, webhook, message consumer at-least-once).

**8. (Technical) "Làm sao đảm bảo không mất message giữa ghi DB và publish Kafka?"**
Kỳ vọng: **Outbox pattern.** "Hai thao tác (ghi DB + publish) không thể atomic qua hai hệ thống. Em ghi event vào bảng `outbox` *trong cùng transaction* với ghi nghiệp vụ; một relay/CDC đọc outbox publish sang Kafka rồi đánh dấu đã gửi. Đảm bảo at-least-once, consumer idempotent để khử trùng." Đây là câu phân biệt người đã làm distributed system thật.

**9. (Technical) "Microservices vs monolith — khi nào tách?"**
Chống over-engineer: "Mặc định em ủng hộ monolith module hóa tốt cho team nhỏ — tách microservices đổi một vấn đề lấy mười vấn đề phân tán (network, consistency, observability). Chỉ tách khi có lý do thật: cần scale/deploy độc lập một phần, ranh giới domain đã rõ, team đủ lớn để vận hành. Khi tách thì tách dần bằng Strangler Fig từ module ít phụ thuộc nhất." Câu trả lời "tách càng nhiều càng tốt" là red flag.

**10. "Bạn còn yếu phần nào?" (bẫy trung thực)**
Tương tự câu điểm yếu nhưng về kỹ thuật: nêu phần thật còn mỏng + kế hoạch bù cụ thể. "Em mạnh Node, database, messaging; phần còn mỏng là vận hành K8s production ở quy mô nhiều node — em mới ở mức kind/minikube qua capstone, đang bù bằng [tài liệu/khóa cụ thể]." Tự nhận thức tốt ăn điểm hơn vờ biết hết.

---

## 📚 Đọc thêm

- **Cracking the Coding Interview** (Gayle Laakmann McDowell) — kinh điển cho coding round; chương về behavioral & quy trình phỏng vấn đáng đọc kể cả khi bạn không thi thuật toán nặng.
- **System Design Interview – An Insider's Guide, Vol 1 & 2** (Alex Xu / ByteByteGo) — bám sát framework system design; đọc kèm tuần 10 để luyện cấu trúc 45 phút.
- **Designing Data-Intensive Applications** (Martin Kleppmann) — nền tảng để trả lời sâu mọi câu về consistency, replication, partitioning ở vòng design/technical.
- **levels.fyi** — dữ liệu lương theo công ty/level/khu vực; dùng để **neo thị trường** khi negotiate. Lọc theo khu vực của bạn.
- **Glassdoor / Blind / cộng đồng dev địa phương** — review công ty, câu hỏi phỏng vấn thật, mặt bằng lương; chéo kiểm với levels.fyi.
- **"Tech Interview Handbook"** (techinterviewhandbook.org) — miễn phí, có phần behavioral & negotiation rất thực dụng.
- Blog negotiation kinh điển: **"Salary Negotiation" của Patrick McKenzie (kalzumeus)** — bài dài nhưng đổi đời về cách thương lượng.

---

> 🎓 Lời cuối: phỏng vấn là **kỹ năng luyện được**, không phải tài năng bẩm sinh. Bạn đã có 11 tuần kiến thức và một capstone thật để kể — giờ chỉ là gói nó lại cho gọn, nói cho rõ, và nêu trade-off cho chững chạc. Ghi âm, nghe lại, sửa, lặp. Mỗi buổi mock làm bạn bình tĩnh hơn buổi thật một bậc. Bạn sẵn sàng hơn bạn nghĩ. Đi và lấy offer đó. 💪
