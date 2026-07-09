# 07 · Mạng máy tính — Java Backend

> Backend nói chuyện qua mạng → hiểu TCP/HTTP là nền tảng. Đọc xong làm quiz **📡 API/HTTP** chủ đề *Mạng*.

---

## 1. TCP bắt tay BA bước (3-way handshake)

Mở kết nối TCP cần 3 bước để đồng bộ số thứ tự (seq) cả 2 chiều:

```
Client  --SYN-->      Server     "Tôi muốn kết nối, seq=x"
Client  <--SYN+ACK--  Server     "OK, seq=y, xác nhận x+1"
Client  --ACK-->      Server     "Xác nhận y+1"  → kết nối mở
```

**Vì sao không 2 bước?** Bước 3 để **server chắc chắn client còn sống & nhận được phản hồi**. Nếu chỉ 2 bước: một gói SYN cũ bị **trễ** tới server sẽ khiến server mở kết nối vô ích mà client không hề muốn ("kết nối ma").

---

## 2. TCP đóng BỐN bước (4-way) & TIME_WAIT

TCP là **song công** (2 chiều độc lập) → đóng từng chiều:

```
A --FIN-->  B      A hết dữ liệu gửi
A <--ACK--  B      B xác nhận (B có thể còn data để gửi nốt)
A <--FIN--  B      B cũng hết dữ liệu
A --ACK-->  B      A xác nhận → A vào TIME_WAIT
```

Bốn bước vì **ACK và FIN của B tách rời** (B có thể còn dữ liệu gửi sau khi ACK).

**TIME_WAIT** (~2×MSL) ở bên **chủ động đóng**:
- Đảm bảo ACK cuối đến B (nếu mất, B resend FIN).
- Để mọi gói cũ tan hết trước khi tái dùng cổng (tránh lẫn vào kết nối mới).

> Server có nhiều TIME_WAIT thường do server **chủ động đóng** → cân nhắc keep-alive.

---

## 3. TCP vs UDP

| | TCP | UDP |
|--|-----|-----|
| Kết nối | Có (bắt tay) | Không |
| Tin cậy | Có (ACK, truyền lại, đúng thứ tự) | Không đảm bảo |
| Kiểm soát | Luồng + tắc nghẽn | Không |
| Tốc độ | Chậm hơn (nặng) | Nhanh, nhẹ |
| Dùng cho | HTTP, DB, file | Video, game realtime, DNS, VoIP |

> **HTTP/3** dựng trên **QUIC (UDP)** để bỏ head-of-line blocking của TCP.

---

## 4. HTTPS / TLS — bảo mật

HTTPS = HTTP + TLS. **Kết hợp** hai loại mã hoá:

1. **Bắt tay (bất đối xứng):** server gửi **certificate** (CA ký) để client xác thực danh tính (chống man-in-the-middle); hai bên dùng RSA/**ECDHE** thoả thuận ra **khoá phiên**.
2. **Truyền dữ liệu (đối xứng):** dùng khoá phiên + **AES** mã hoá — nhanh hơn nhiều.

> Vì sao kết hợp: bất đối xứng an toàn cho trao khoá + xác thực, nhưng chậm; đối xứng nhanh nhưng cần chia sẻ khoá an toàn trước. TLS lấy ưu điểm cả hai. **ECDHE** cho *forward secrecy* (lộ khoá riêng sau này vẫn không giải mã được phiên cũ).

HTTPS đảm bảo **3 thứ:** bảo mật (mã hoá) + toàn vẹn (không bị sửa) + xác thực (đúng server).

---

## 5. HTTP/1.1 vs HTTP/2 vs HTTP/3

| | HTTP/1.1 | HTTP/2 | HTTP/3 |
|--|----------|--------|--------|
| Định dạng | Text | Nhị phân | Nhị phân |
| Ghép kênh | 1 request/lúc (HOL) | **Multiplexing** nhiều stream / 1 kết nối TCP | Multiplexing trên QUIC |
| Nén header | Không | HPACK | QPACK |
| Vận chuyển | TCP | TCP | **QUIC (UDP)** |
| HOL blocking | Có (tầng ứng dụng) | Còn ở **tầng TCP** khi mất gói | **Không** (stream độc lập) |

> Điểm hay bị nói sai: HTTP/2 **vẫn** dính HOL blocking **ở tầng TCP** (mất 1 gói chặn mọi stream). HTTP/3 dùng QUIC nên mỗi stream độc lập → khắc phục, cộng bắt tay nhanh hơn (0-RTT).

---

## 6. GET vs POST (bản chất)

| | GET | POST |
|--|-----|------|
| Ngữ nghĩa | Đọc (safe) | Thay đổi trạng thái |
| Idempotent | ✅ | ❌ (gửi 2 lần tạo 2 bản ghi) |
| Tham số | Trên URL (bị cache/log/bookmark, giới hạn độ dài) | Trong body (không cache mặc định) |

> "POST an toàn hơn GET" là **hiểu lầm** — cả hai đều lộ nếu không có HTTPS. Khác biệt nằm ở **ngữ nghĩa** (safe/idempotent), không phải bảo mật.

---

## 7. Câu hỏi phỏng vấn hay gặp

1. TCP bắt tay 3 bước — vì sao không đủ 2 bước?
2. Vì sao đóng TCP cần 4 bước? TIME_WAIT để làm gì?
3. TCP khác UDP thế nào? Khi nào dùng UDP?
4. HTTPS bảo mật bằng đối xứng hay bất đối xứng? Giải thích cơ chế.
5. HTTP/1.1 vs 2 vs 3 khác gì? HTTP/2 còn HOL blocking không?
6. GET vs POST khác nhau thực chất (ngoài "lấy/gửi")?

> Làm tiếp: tab **🧠 Tư duy → 📡 API/HTTP**, các câu chủ đề *Mạng*.

---

## 🎉 Hoàn tất bộ tài liệu Java Backend

Bạn đã đọc xong 7 bài nền tảng. Lộ trình ôn tập:
1. **Đọc** doc từng mảng (📚 Học).
2. **Luyện** quiz tương ứng (🧠 Tư duy → ☕ Java / 🗄️ SQL / ☁️ Redis / 📡 API).
3. Câu sai tự vào **🔁 Ôn câu sai**.
4. Trước phỏng vấn: **🎓 Thi thử** (đề trộn có tính giờ) mỗi ngày.

Chúc bạn phỏng vấn thành công! 🚀
