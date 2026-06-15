# 🌱 Nhập môn — Tuần 6: Kafka (cho người mới)

> Đừng lo nếu bạn chưa nghe tới Kafka bao giờ. File này đi từ con số 0, câu ngắn, dễ thở. Đọc xong file này rồi mới mở [`README.md`](README.md) — README sâu hơn nhiều, đọc trước sẽ choáng.

---

## 🎯 Kafka là gì?

Kafka là một phần mềm giúp các chương trình **gửi tin nhắn cho nhau**.

Hãy tưởng tượng Kafka như một **băng chuyền** (hoặc một **bưu điện**) cho dữ liệu.

- Một bên đặt tin nhắn lên băng chuyền.
- Bên kia nhặt tin nhắn xuống và xử lý.
- Hai bên **không cần biết nhau**. Không cần chờ nhau.

Có một điều đặc biệt: Kafka **giữ lại** tin nhắn, giống như một cuốn **nhật ký**. Tin nhắn không biến mất ngay khi có người đọc. Bạn có thể **đọc lại** từ đầu bất cứ lúc nào.

Đó là điểm khác biệt lớn nhất của Kafka so với các công cụ tương tự.

---

## 🤔 Vì sao cần Kafka?

Hãy xem một vấn đề rất thật.

**Trước khi có Kafka:**

Giả sử bạn có 2 dịch vụ (service) nhỏ:
- Service A: nhận đơn hàng.
- Service B: gửi email xác nhận.

Cách đơn giản: A **gọi thẳng** sang B mỗi khi có đơn.

Nghe ổn. Nhưng:

- Nếu B đang **sập**, A gọi sang sẽ bị lỗi → A cũng **kẹt** theo.
- Vào giờ cao điểm, đơn dồn về quá nhiều → B **không xử lý kịp** → quá tải.
- A phải **đứng chờ** B làm xong mới tiếp tục → chậm.

**Sau khi có Kafka (đặt Kafka ở giữa):**

- A chỉ cần **gửi tin** vào Kafka rồi đi làm việc khác ngay.
- B **lấy tin ra xử lý từ từ**, theo đúng sức của nó.
- B có sập một lúc? Không sao. Tin vẫn nằm yên trong Kafka, chờ B sống lại rồi xử lý tiếp. **Không mất việc.**

Người ta gọi đây là **tách rời** (tiếng Anh: *decouple*) — hai bên không còn dính chặt vào nhau.

**Một lợi ích nữa:** một tin gửi đi, **nhiều bên cùng nhận** được.

Ví dụ: khách đặt hàng → bắn ra một tin "đã có đơn mới" → cùng lúc:
- Kho nhận tin để chuẩn bị hàng.
- Bộ phận email nhận tin để gửi xác nhận.
- Bộ phận thống kê nhận tin để cập nhật báo cáo.

Cả ba cùng nhận, cùng làm việc của mình, không ai cản ai.

---

## 🧩 Khái niệm cơ bản nhất

Kafka có vài từ chuyên môn. Đừng sợ, mỗi từ chỉ là một ý đơn giản.

| Từ (tiếng Anh) | Hình dung đơn giản |
|---|---|
| **producer** | **Người gửi** tin. Bên đặt tin nhắn lên băng chuyền. |
| **consumer** | **Người nhận** tin và xử lý. Bên nhặt tin xuống. |
| **topic** | **Hộp thư theo chủ đề** / một kênh. Ví dụ: kênh "đơn hàng mới", kênh "thanh toán". Tin cùng loại thì bỏ vào cùng một topic. |
| **partition** | **Ngăn nhỏ** bên trong hộp thư. Một topic được chia ra nhiều ngăn để **nhiều người xử lý song song cho nhanh**. |
| **offset** | **Số thứ tự lá thư**. Đánh dấu người nhận đã đọc tới lá thứ mấy rồi. |
| **broker** | **Máy chủ Kafka** — cái máy thật sự giữ các lá thư. |
| **consumer group** | **Một nhóm người nhận** cùng nhau chia việc. Mỗi người ôm vài ngăn, không ai làm trùng việc của ai. |

Bạn chỉ cần nhớ 3 từ quan trọng nhất trước: **producer** (gửi), **consumer** (nhận), **topic** (kênh chứa tin). Ba từ kia hiểu dần.

---

## 🛠️ Hình dung luồng chạy

Đây là toàn bộ câu chuyện, vẽ ra cho dễ thấy:

```
   Producer                 Topic "đơn hàng"                Consumer
  (người gửi)            (chia làm 3 ngăn nhỏ)           (người nhận)

                       ┌─────────────────────┐
   gửi tin  ──────►    │ Ngăn 0: [thư][thư]  │   ──────►   đọc & xử lý
                       │ Ngăn 1: [thư][thư]  │
                       │ Ngăn 2: [thư]       │
                       └─────────────────────┘
```

Đọc theo lời:

1. **Producer** tạo một tin nhắn (ví dụ: "khách số 5 vừa đặt hàng") và **gửi** vào một **topic**.
2. Topic chia tin ra các **ngăn** (partition). Mỗi tin rơi vào một ngăn.
3. **Consumer** mở ngăn ra, lấy tin **theo thứ tự** từ trên xuống, rồi **xử lý** (gửi email, trừ kho...).
4. Consumer ghi nhớ **đã đọc tới đâu** (offset) để lần sau đọc tiếp, không đọc lại tin cũ.

Vậy thôi. Gửi vào → nằm trong ngăn → lấy ra xử lý.

> Mẹo: các tin của **cùng một khách** thường được xếp vào **cùng một ngăn**. Nhờ vậy chúng được xử lý **đúng thứ tự** (đặt hàng trước, hủy hàng sau — không bị lộn).

---

## 📊 Khi nào DÙNG Kafka / khi nào KHÔNG

Kafka rất mạnh, nhưng không phải lúc nào cũng cần. Đừng dùng dao mổ trâu để cắt rau.

| Tình huống | Nên dùng Kafka? |
|---|---|
| Nhiều dịch vụ cần **cùng nhận** một sự kiện (kho + email + thống kê) | ✅ Rất hợp |
| Cần xử lý **bất đồng bộ** (gửi đi rồi xử lý sau, không chờ) | ✅ Hợp |
| Lượng dữ liệu **cực lớn**, dòng log/sự kiện chảy liên tục | ✅ Hợp |
| Cần **đọc lại** dữ liệu cũ sau này | ✅ Hợp |
| App nhỏ, chỉ 1-2 dịch vụ gọi nhau là đủ | ❌ Chưa cần — gọi thẳng cho gọn |
| Chỉ cần lấy dữ liệu ngay lập tức rồi trả lời người dùng | ❌ Cứ gọi API trực tiếp |

**So sánh một dòng:**
Gọi API trực tiếp = *gọi điện thoại*, phải có người bắt máy ngay thì mới xong.
Dùng Kafka = *gửi tin nhắn*, gửi xong cứ đi, bên kia rảnh thì đọc và làm.

---

## 🔤 Từ vựng tiếng Anh cần biết

Học những từ này để đọc tài liệu và nghe phỏng vấn không bị khựng.

| Từ | Đọc (Việt-hóa) | Nghĩa |
|---|---|---|
| message | mét-xịch | tin nhắn |
| event | i-vần(t) | sự kiện (một việc vừa xảy ra) |
| queue | kiu | hàng chờ (xếp hàng) |
| producer | prồ-điu-xơ | người gửi tin |
| consumer | cừn-xsiu-mơ | người nhận / xử lý tin |
| topic | tóp-pích | kênh / chủ đề chứa tin |
| partition | pa-ti-sần | ngăn nhỏ trong kênh |
| broker | brâu-cơ | máy chủ Kafka giữ tin |
| publish | pấp-lích | đăng / gửi tin lên |
| subscribe | sấp-scrai | đăng ký nhận tin |
| stream | strim | dòng dữ liệu chảy liên tục |
| offset | óp-sét | vị trí đã đọc tới |
| asynchronous | ây-sin-crồ-nợs | bất đồng bộ (không chờ nhau) |
| commit | cừm-mít | xác nhận "đã đọc xong tới đây" |
| retention | ri-ten-sần | thời gian giữ lại tin |

---

## 👉 Học tiếp

Đi theo đúng thứ tự này, từ dễ tới khó:

1. **File này** (`CO-BAN.md`) — bạn đang ở đây. ✅
2. [`README.md`](README.md) — đầy đủ kiến thức: kiến trúc, producer/consumer sâu, đảm bảo thứ tự, xử lý lỗi, câu hỏi phỏng vấn.
3. [`DEEP-DIVE.md`](DEEP-DIVE.md) — đào sâu cơ chế bên trong, bẫy thực tế khi chạy thật.
4. [`lab/LAB.md`](lab/LAB.md) — tự tay dựng Kafka và chạy thử bằng Docker.

Cứ từ từ. Mỗi ngày một ít là được.

---

## ✅ Checklist hiểu cơ bản

Tự hỏi mình. Trả lời được hết là bạn đã nắm phần nhập môn:

- [ ] Tôi giải thích được Kafka giống **băng chuyền / bưu điện** cho dữ liệu như thế nào.
- [ ] Tôi nói được **một lý do** vì sao đặt Kafka ở giữa lại tốt hơn gọi thẳng.
- [ ] Tôi phân biệt được **producer** (người gửi) và **consumer** (người nhận).
- [ ] Tôi biết **topic** là gì và **partition** (ngăn) dùng để làm gì.
- [ ] Tôi hiểu Kafka **giữ lại** tin và **đọc lại được** (khác với tin nhắn thường biến mất).
- [ ] Tôi nêu được **một trường hợp nên dùng** và **một trường hợp chưa cần** Kafka.
- [ ] Tôi đọc được hầu hết các từ tiếng Anh trong bảng từ vựng.

Xong rồi? Tuyệt vời. Giờ mở [`README.md`](README.md) nhé. 🚀
