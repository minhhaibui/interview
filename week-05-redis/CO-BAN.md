# 🌱 Nhập môn — Tuần 5: Redis (cho người mới)

> Chưa từng nghe đến Redis? Không sao cả. File này dành riêng cho bạn. Hãy đọc file này TRƯỚC, rồi mới mở `README.md`. Cứ đi từ từ, mỗi đoạn một chút, bạn sẽ hiểu hết.

---

## 🎯 Redis là gì? (giải thích siêu đơn giản)

Redis là một **cái kho chứa dữ liệu siêu nhanh**, nằm trong bộ nhớ RAM của máy tính.

Hãy tưởng tượng thế này:
- Bạn làm việc ở một văn phòng.
- Có một cái **KHO lớn** ở tầng hầm chứa tất cả hồ sơ. Muốn lấy gì phải đi xuống, lục tìm, khá lâu. Cái kho đó là **database** (cơ sở dữ liệu).
- Trên bàn làm việc của bạn có một cuốn **SỔ TAY** nhỏ. Những thứ hay dùng, bạn ghi ngay vào sổ. Cần là với tay lấy, tích tắc. Cuốn sổ tay đó chính là **Redis**.

Redis nhanh vì nó giữ mọi thứ trong **RAM** (bộ nhớ tạm của máy, rất nhanh) thay vì trên ổ đĩa (chậm hơn nhiều). Lấy dữ liệu từ Redis chỉ mất một phần rất nhỏ của giây.

> Một câu để nhớ: **Redis = cuốn sổ tay để ngay trên bàn, lấy thông tin tích tắc.**

---

## 🤔 Vì sao cần Redis?

Hãy xem một câu chuyện **TRƯỚC và SAU**.

**TRƯỚC khi có Redis:**
- Bạn làm một trang web bán hàng.
- Mỗi khi có người mở trang sản phẩm, web phải đi hỏi database: "Sản phẩm này tên gì, giá bao nhiêu?"
- Một người hỏi thì không sao. Nhưng 10.000 người cùng hỏi một lúc thì database **quá tải, web chậm như rùa**.
- Mà tệ hơn: cùng một sản phẩm bị hỏi đi hỏi lại hàng nghìn lần, dù câu trả lời **y hệt nhau**.

**SAU khi có Redis:**
- Lần đầu hỏi database xong, ta **giữ lại bản sao câu trả lời trong Redis**.
- Lần sau có người hỏi cùng sản phẩm đó, ta lấy luôn từ Redis, **không cần làm phiền database nữa**.
- Kết quả: web nhanh hơn gấp nhiều lần, database được nghỉ ngơi.

Cái "bản sao để sẵn cho nhanh" đó có một cái tên: **cache** (đọc là "kẹt").

> **Cache** nghĩa đơn giản là: bản sao của dữ liệu, để sẵn ở chỗ nhanh, để lần sau khỏi phải đi lấy lại từ chỗ chậm.

Redis là công cụ phổ biến nhất để làm cache.

---

## 🧩 Khái niệm cơ bản nhất

Đây là vài từ bạn sẽ gặp hoài. Đọc qua cho quen, chưa cần thuộc.

**1. In-memory (trong RAM)**
- "Memory" ở đây là RAM — bộ nhớ tạm của máy tính, rất nhanh nhưng mất hết khi tắt máy.
- Redis giữ dữ liệu trong RAM nên cực nhanh. Đổi lại, nếu mất điện đột ngột thì có thể mất dữ liệu (Redis có cách lưu phòng hờ, nhưng đừng lo chuyện đó vội).
- Hãy nhớ: **trong RAM = nhanh, nhưng mong manh.**

**2. Key-Value (chìa khóa — giá trị)**
- Redis lưu dữ liệu giống một cuốn **từ điển**: bạn tra một "key" (từ khóa) ra một "value" (nội dung).
- Ví dụ: key là `"ten_user_1"`, value là `"An"`. Đưa key vào, Redis trả value ra.
- Đơn giản như ngăn tủ có dán nhãn: nhìn nhãn (key) là biết bên trong có gì (value).

**3. Cache (bản sao cho nhanh)**
- Như đã nói ở trên: bản sao dữ liệu để sẵn ở chỗ nhanh.
- Đây là việc người ta dùng Redis nhiều nhất.

**4. TTL (hạn sử dụng)**
- TTL viết tắt của "Time To Live" — nghĩa là "sống được bao lâu".
- Bạn có thể bảo Redis: "Giữ thông tin này 60 giây thôi, sau đó tự xóa giùm."
- Giống hộp sữa có hạn dùng: tới hạn là tự bỏ đi, khỏi cần ai nhắc.
- Rất hữu ích: ví dụ mã OTP chỉ nên sống 1 phút rồi biến mất.

**5. Các kiểu dữ liệu (data types)**
- Redis không chỉ lưu chữ. Nó có nhiều "kiểu" chứa đồ khác nhau, chọn đúng kiểu thì tiện hơn nhiều. Đây là 5 kiểu cơ bản, giải thích bằng ví dụ đời thường:

| Kiểu | Hình dung đời thường | Dùng để làm gì |
|------|---------------------|----------------|
| **String** (chuỗi) | Một mẩu giấy nhớ ghi một thứ | Tên, số, một đoạn JSON, đếm lượt xem |
| **List** (danh sách) | Hàng người xếp hàng, vào trước ra trước | Hàng chờ công việc, danh sách bài đăng mới |
| **Hash** (bảng băm) | Một tấm danh thiếp: nhiều ô (tên, tuổi, thành phố) trong một thẻ | Lưu thông tin một người dùng |
| **Set** (tập hợp) | Một túi chỉ chứa món khác nhau, không trùng | Danh sách "ai đã like", lọc trùng |
| **Sorted Set** (tập hợp có thứ hạng) | Bảng xếp hạng game: ai điểm cao đứng trên | Bảng xếp hạng, top người chơi |

Chưa cần nhớ hết. Chỉ cần biết: "À, Redis có nhiều kiểu chứa đồ, mỗi kiểu hợp một việc."

---

## 🛠️ Hình dung cách nó chạy

Bạn nói chuyện với Redis bằng những **lệnh** ngắn gọn. Đây là vài lệnh dễ nhất. (Bạn gõ phần in đậm, Redis trả lời ở dòng dưới.)

**Lưu một thứ vào:**
```
SET name "An"
```
Nghĩa là: "Đặt (SET) cái key tên `name` bằng giá trị `An`." Redis trả lời `OK`.

> Hãy đọc như tiếng người: "Set name là An." Lưu lại tên An.

**Lấy nó ra:**
```
GET name
```
Nghĩa là: "Lấy (GET) giá trị của key `name`." Redis trả lời `"An"`.

> "Get name." Cho tôi xem name là gì.

**Lưu một thứ kèm hạn dùng:**
```
SET otp 123 EX 60
```
Nghĩa là: "Lưu mã `otp` là `123`, và `EX 60` nghĩa là cho nó sống 60 giây thôi."
Sau 60 giây, mã này **tự biến mất**. Bạn không cần làm gì cả.

> `EX` là viết tắt của "expire" (hết hạn). `EX 60` = hết hạn sau 60 giây.

Thấy chưa? Chỉ là những câu lệnh rất ngắn: lưu vào, lấy ra, đặt hạn. Đó là phần lõi của Redis.

---

## 📊 Khi nào DÙNG / KHÔNG nên dùng Redis

Redis rất tuyệt, nhưng không phải việc gì cũng dùng. Quy tắc dễ nhớ:

| ✅ NÊN dùng Redis cho | ❌ KHÔNG nên dùng Redis làm |
|----------------------|---------------------------|
| **Cache** — bản sao cho nhanh | Nơi lưu **duy nhất** dữ liệu quan trọng (tiền bạc, đơn hàng, tài khoản) |
| **Session** — giữ trạng thái đăng nhập của người dùng | Dữ liệu mà mất đi là **không thể chấp nhận** |
| **Đếm** — số lượt xem, lượt thích | Dữ liệu quá lớn không vừa trong RAM |
| **Xếp hạng** — bảng top người chơi | Truy vấn phức tạp kiểu báo cáo, thống kê nhiều bảng |
| **Hàng chờ** — danh sách việc cần làm | |

**Vì sao không nên lưu duy nhất dữ liệu quan trọng trong Redis?**
Vì Redis sống trong RAM — mong manh. Nếu máy mất điện, dữ liệu có thể bay mất. Cho nên: **dữ liệu gốc, quan trọng luôn nằm trong database (cái kho).** Redis chỉ giữ bản sao cho nhanh.

> Cách nghĩ an toàn: Redis là sổ tay tiện lợi, KHÔNG phải két sắt. Đồ quý cất trong két (database), sổ tay chỉ ghi tạm cho nhanh.

---

## 🔤 Từ vựng tiếng Anh cần biết

Những từ này lặp đi lặp lại khắp tài liệu Redis. Quen mặt chúng là đọc README dễ hơn nhiều.

| Từ | Đọc (Việt-hóa) | Nghĩa |
|----|----------------|-------|
| cache | kẹt | bản sao để sẵn cho nhanh |
| key | ki | chìa khóa / từ khóa để tra |
| value | va-liu | giá trị / nội dung được lưu |
| in-memory | in me-mò-ri | nằm trong RAM (bộ nhớ tạm) |
| expire | ích-x-pai-ơ | hết hạn, tự xóa |
| set | sét | đặt / lưu một giá trị vào |
| get | gét | lấy một giá trị ra |
| server | sơ-vơ | máy chủ (chỗ Redis chạy) |
| client | clai-ợnt | phía gọi tới Redis (app của bạn) |
| database | đây-ta-bây | cơ sở dữ liệu (cái kho chính) |
| fast | phát | nhanh |
| store | sto | kho chứa, nơi lưu trữ |
| memory | me-mò-ri | bộ nhớ (RAM) |
| data | đây-ta | dữ liệu |
| session | sét-sần | phiên đăng nhập của người dùng |

---

## 👉 Học tiếp

Bạn vừa xây xong trực giác cơ bản. Giờ đi tiếp theo bậc thang:

1. **`README.md`** — lý thuyết đầy đủ của tuần: vì sao Redis nhanh, từng kiểu dữ liệu, cách làm cache đúng, câu hỏi phỏng vấn. Đọc cái này tiếp theo.
2. **`DEEP-DIVE.md`** — đào sâu: cơ chế bên trong, bẫy khi chạy thật, câu hỏi phỏng vấn khó. Đọc khi đã nắm chắc README.
3. **`lab/LAB.md`** — thực hành tận tay: tự chạy Redis, gõ lệnh thật, làm cache, rate-limit, bảng xếp hạng. Làm cái này để "thấm" bằng tay.

> Đừng vội nhảy sang DEEP-DIVE. Cứ đi từng bậc một: file này → README → LAB → DEEP-DIVE.

---

## ✅ Checklist: tôi hiểu cơ bản chưa?

Tự hỏi bản thân. Nếu trả lời được hết, bạn sẵn sàng mở README.

- [ ] Tôi giải thích được **Redis là gì** cho một người bạn bằng đúng 1 câu (gợi ý: cuốn sổ tay siêu nhanh trên bàn).
- [ ] Tôi hiểu **cache** nghĩa là gì bằng lời của mình (bản sao để sẵn cho nhanh).
- [ ] Tôi nói được **vì sao Redis nhanh** (vì nó giữ dữ liệu trong RAM).
- [ ] Tôi hiểu **key-value** là gì (tra key ra value, như từ điển).
- [ ] Tôi biết **TTL** dùng để làm gì (đặt hạn dùng, tự xóa sau X giây).
- [ ] Tôi đọc được 3 lệnh `SET name "An"`, `GET name`, `SET otp 123 EX 60` và nói được chúng làm gì.
- [ ] Tôi biết **không nên** dùng Redis làm nơi lưu duy nhất dữ liệu quan trọng (vì nó ở RAM, mong manh).

Xong hết rồi? Tuyệt vời. Mở `README.md` và đi tiếp nhé. Bạn làm được! 🌱
