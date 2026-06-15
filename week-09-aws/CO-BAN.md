# 🌱 Nhập môn — Tuần 9: AWS (cho người mới)

> Đây là bậc thang ĐẦU TIÊN của tuần 9. Hãy đọc file này TRƯỚC `README.md` nhé. Cực dễ, không cần biết gì về cloud từ trước. Hít một hơi, bắt đầu thôi! 🚀

---

## 🎯 AWS / Cloud là gì?

Bình thường, để chạy một website, bạn cần một cái **máy chủ** (server) — một cái máy tính luôn bật, nối internet, để hứng người dùng vào.

Bạn có 2 cách để có cái máy đó:
1. **Tự mua** máy về, cắm điện, nối mạng, tự lo khi nó hỏng. Tốn tiền, mệt.
2. **Thuê** máy của Amazon qua internet. Dùng bao nhiêu trả bấy nhiêu. Nhàn.

**Cloud** (điện toán đám mây) chính là cách số 2. "Cloud" nói cho vui là **máy của người ta**, đặt ở đâu đó xa xa, bạn thuê và dùng từ xa qua internet.

**AWS** (Amazon Web Services) là dịch vụ cho thuê đó của Amazon — cho thuê máy chủ, kho chứa, mạng... Lớn nhất thế giới luôn.

### Vài hình ảnh cho dễ hiểu

- 🏠 **Giống thuê nhà** có sẵn điện nước, internet — thay vì tự đi xây nhà từ viên gạch.
- 🚗 **Giống đi Grab** — bạn cần đi đâu thì gọi, trả tiền chuyến đó. Không cần mua hẳn một chiếc ô tô, không lo xăng, bảo dưỡng, chỗ đậu.

Bạn không sở hữu cái máy. Bạn chỉ **thuê dùng**, và Amazon lo phần cứng.

---

## 🤔 Vì sao dùng AWS?

Hãy nhìn vào sự khác nhau giữa **TỰ MUA** và **THUÊ**:

**Hồi xưa — tự mua server:**
- Phải bỏ một đống tiền MUA máy TRƯỚC, dù chưa biết có khách hay không.
- Đông khách bất ngờ? Phải đi mua thêm máy, chờ giao hàng vài tuần. Trễ mất rồi.
- Vắng khách? Máy đắt tiền nằm không, vẫn tốn tiền.
- Máy hỏng, mất điện, đứt mạng — bạn phải tự lo hết. Mệt và lo.

**Bây giờ — thuê cloud (AWS):**
- Cần máy? Bấm vài nút, **vài phút sau có ngay**. Không cần trả tiền trước.
- Đông khách? **Thuê thêm** máy trong vài phút. Vắng khách? **Trả bớt** đi.
- Phần cứng, điện, mạng, hỏng hóc — **Amazon lo hết**. Bạn chỉ lo code.
- **Trả tiền theo mức dùng** — dùng nhiều trả nhiều, dùng ít trả ít, không dùng thì tắt đi cho khỏi tốn.

Nói gọn: AWS giúp bạn **bắt đầu nhanh, linh hoạt, và đỡ lo phần cứng**. Đó là lý do gần như công ty nào cũng dùng cloud.

---

## 🧩 Các dịch vụ AWS cơ bản nhất

AWS có hàng trăm dịch vụ, nghe rất choáng. Nhưng người mới chỉ cần biết khoảng 6 cái sau. Mỗi cái mình giải thích bằng một câu đời thường:

| Tên | Đọc nôm na là | Nó là gì (1 câu đời thường) |
|---|---|---|
| **EC2** | "i-xi hai" | Thuê **một máy chủ ảo** — như mượn một cái máy tính trên mạng để chạy app của bạn. |
| **S3** | "ét ba" | Một **cái kho khổng lồ** trên mạng để chứa file, ảnh, video... bao nhiêu cũng được. |
| **RDS** | "a-rờ-đê-ét" | Một **database có sẵn**, Amazon lo vận hành (sao lưu, vá lỗi) giúp bạn. |
| **Lambda** | "lam-đa" | Chạy **một đoạn code** mà KHÔNG cần thuê máy — trả tiền theo từng lần chạy. |
| **IAM** | "ai-am" | **Phân quyền**: ai được làm gì. Như chùm chìa khóa + bản nội quy của ngôi nhà. |
| **VPC** | "vi-pi-xi" | **Mạng riêng** của bạn bên trong AWS — như khu đất có hàng rào riêng. |

Đừng cố nhớ hết ngay. Cứ hiểu đại ý từng cái là được. README sẽ đào sâu sau.

Một câu để nhớ nhanh:
- Cần **máy để chạy app** → EC2 (hoặc Lambda nếu code nhỏ, chạy thưa).
- Cần **chỗ chứa file/ảnh** → S3.
- Cần **database** → RDS.
- Cần **quản ai được làm gì** → IAM.
- Cần **mạng riêng** → VPC.

---

## 🛠️ Hình dung một web nhỏ trên AWS

Tưởng tượng bạn làm một web bán hàng nhỏ. Trên AWS nó thường gồm 3 phần:

- **EC2** — máy chủ chạy app Node.js của bạn (xử lý logic, nhận request).
- **RDS** — database chứa dữ liệu (đơn hàng, người dùng...).
- **S3** — kho chứa ảnh sản phẩm, file người dùng tải lên.

Sơ đồ đơn giản:

```
   👤 Người dùng (qua internet)
            |
            v
      ┌───────────┐
      │   EC2     │   <- máy chủ chạy app Node.js của bạn
      │  (app)    │
      └─────┬─────┘
            |
     ┌──────┴───────┐
     v              v
 ┌───────┐     ┌────────┐
 │  RDS  │     │   S3   │
 │  (DB) │     │ (ảnh)  │
 └───────┘     └────────┘
```

Người dùng gõ vào web → request đi tới **EC2** → EC2 hỏi **RDS** để lấy dữ liệu, lấy ảnh từ **S3** → trả về cho người dùng. Đơn giản vậy thôi.

### Một từ hay gặp: "Region" (vùng)

**Region** = một **trung tâm dữ liệu** của Amazon đặt ở một khu vực địa lý. Ví dụ: Singapore, Tokyo, Virginia (Mỹ)...

Nguyên tắc: **chọn region gần người dùng** của bạn nhất. Vì máy chủ càng gần thì truy cập càng nhanh. Người dùng ở Việt Nam thì chọn region Singapore (gần nhất) là hợp lý.

---

## 📊 Lưu ý cho người mới

Vài điều quan trọng phải nhớ NGAY từ đầu, nhất là về **TIỀN** (vì AWS tính tiền thật):

- 💸 **Coi chừng tiền!** AWS tính tiền theo mức dùng. Luôn xem giá trước khi bật một dịch vụ. **Tài nguyên không dùng thì TẮT đi** (nhất là EC2, RDS — chúng tính tiền theo giờ kể cả khi bạn không xài).
- 🔔 **Bật cảnh báo chi phí** (Budget alert) ngay ngày đầu. Khi tiền sắp vượt mức bạn đặt, AWS sẽ báo cho bạn — tránh "hết tháng nhận hóa đơn sốc".
- 🆓 **Dùng Free Tier để học.** AWS cho người mới một gói miễn phí (Free Tier) trong giới hạn nhất định. Học thì xài cái này cho an toàn ví tiền.
- 🔐 **Bảo mật IAM — đừng cho quyền quá rộng.** Chỉ cấp đúng quyền cần thiết. Đừng để một tài khoản "được làm tất cả mọi thứ" — lỡ bị lộ là nguy.
- ⚠️ **Đừng dùng tài khoản gốc (root) cho việc hằng ngày.** Tạo tài khoản con với quyền vừa đủ mà dùng.

---

## 🔤 Từ vựng tiếng Anh cần biết

Những từ này sẽ gặp đi gặp lại. Học trước cho đỡ bỡ ngỡ:

| Từ | Đọc (Việt-hóa) | Nghĩa |
|---|---|---|
| cloud | clao | đám mây — máy của người ta, thuê dùng từ xa |
| server | sơ-vơ | máy chủ — máy luôn bật để chạy app |
| instance | in-xtần | một "bản" máy chủ ảo bạn đang thuê (một con EC2) |
| storage | xto-rịt | kho chứa dữ liệu (file, ảnh...) |
| region | ri-jần | vùng — trung tâm dữ liệu ở một khu vực |
| scale | xkeo | tăng/giảm quy mô (thêm/bớt máy theo lượng khách) |
| deploy | đi-ploi | đưa app lên chạy trên máy chủ |
| compute | còm-piu | phần "tính toán" — sức mạnh xử lý (CPU) |
| network | nét-uợc | mạng — kết nối giữa các máy |
| permission | pơ-mít-sần | quyền — ai được làm gì |
| bucket | bắc-kịt | "cái thùng" — một kho chứa file trong S3 |
| serverless | sơ-vơ-lét | "không cần lo server" — như Lambda, bạn chỉ viết code |
| database | đây-ta-bệt | cơ sở dữ liệu — nơi lưu trữ dữ liệu có tổ chức |
| backup | bách-ấp | bản sao lưu phòng khi mất dữ liệu |
| failover | pheo-ô-vơ | tự chuyển sang máy dự phòng khi máy chính hỏng |

---

## 👉 Học tiếp

Xong file này là bạn đã có nền rồi! Đi tiếp theo thứ tự:

1. **`README.md`** — học chi tiết từng dịch vụ (IAM, VPC, EC2, S3, RDS, Lambda, SQS...) và câu hỏi phỏng vấn.
2. **`DEEP-DIVE.md`** — đào sâu cơ chế bên trong và các bẫy production.

> 📌 **Lưu ý:** Tuần này **chưa có lab bắt buộc bằng AWS thật**, vì AWS cần tài khoản có thể bị tính phí. README sẽ chỉ bạn dùng **LocalStack** (một bản AWS giả chạy trên máy bạn, miễn phí) để thực hành an toàn.

---

## ✅ Checklist hiểu cơ bản

Tự hỏi lại, trả lời được hết là ngon:

- [ ] Mình giải thích được "cloud" là gì bằng một câu đời thường (máy của người ta, thuê dùng từ xa)?
- [ ] Mình nói được vì sao thuê cloud lợi hơn tự mua server (nhanh, linh hoạt, trả theo dùng)?
- [ ] Mình nhớ EC2, S3, RDS mỗi cái dùng để làm gì?
- [ ] Mình biết "Lambda" khác EC2 ở chỗ không cần lo server, trả theo lần chạy?
- [ ] Mình hiểu "Region" là vùng đặt máy chủ, và nên chọn gần người dùng?
- [ ] Mình nhớ phải coi chừng TIỀN và bật cảnh báo chi phí?
- [ ] Mình biết IAM là phân quyền, và không nên cho quyền quá rộng?
