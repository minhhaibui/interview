# 🌱 Nhập môn — Tuần 7: Docker (cho người mới)

> Chào bạn! Đây là bậc thang ĐẦU TIÊN của Tuần 7. Hãy đọc file này TRƯỚC khi mở `README.md`. Ở đây mọi thứ cực dễ, câu ngắn, không có thuật ngữ nào mà không được giải thích. Hít một hơi thật sâu, rồi cùng đi nhé! 💪

---

## 🎯 Docker là gì?

Docker là một công cụ giúp bạn **đóng gói app của bạn** cùng với **mọi thứ nó cần** (Node, các thư viện, file cấu hình...) vào trong một cái "HỘP" khép kín. Cái hộp đó gọi là **container**.

Điều tuyệt vời: cái hộp này chạy **GIỐNG HỆT NHAU** ở mọi máy. Máy của bạn, máy của đồng nghiệp, hay máy chủ trên mây — tất cả đều chạy y chang. Hết cảnh "máy tôi chạy được mà máy anh thì không"! 🎉

**Analogy (ví von cho dễ hình dung):**

- 🍱 Giống **hộp cơm mang đi**: trong hộp có sẵn cơm, đồ ăn, đũa, muỗng. Bạn mang đi đâu cũng đủ đồ, không lo tới nơi thiếu cái này thiếu cái kia.
- 🚢 Giống **container hàng trên tàu biển**: đóng gói theo chuẩn, có cần cẩu nào, tàu nào, cảng nào cũng bốc lên đặt xuống được. Bên trong đựng gì không quan trọng — bên ngoài luôn cùng một kích thước chuẩn.

App của bạn nằm trong "hộp" Docker cũng vậy: đóng gói chuẩn một lần, mang đi đâu chạy cũng được.

---

## 🤔 Vì sao cần Docker?

Hãy xem một câu chuyện quen thuộc:

**❌ TRƯỚC khi có Docker:**

- Bạn viết app chạy ngon trên máy bạn.
- Bạn gửi cho bạn bè (hoặc đẩy lên máy chủ) để chạy.
- Máy đó **thiếu thư viện**, hoặc **cài sai phiên bản Node**, hoặc thiếu một file cấu hình.
- App **lỗi lung tung**, mỗi máy lỗi mỗi kiểu. Bạn ngồi sửa cả buổi mà vẫn không hiểu vì sao máy mình thì chạy. 😫

Vấn đề gốc: **mỗi máy mỗi khác**. Khác hệ điều hành, khác phiên bản, khác đồ đã cài.

**✅ SAU khi có Docker:**

- Bạn **đóng gói 1 lần** mọi thứ app cần vào một cái hộp.
- Cái hộp đó chạy chỗ nào cũng **y hệt nhau**.
- Gửi cho ai cũng được, deploy lên máy chủ cũng được, không lo thiếu đồ.

→ Kết quả: **dễ deploy** (đưa app lên chạy), **dễ chia sẻ**, và ít lỗi "tại máy" hơn rất nhiều.

> 💡 "Deploy" nghĩa là đưa app của bạn lên một máy chủ để chạy thật, cho người dùng vào dùng.

---

## 🧩 Khái niệm cơ bản nhất

Chỉ cần nắm 5 từ này là bạn đã hiểu được phần lớn. Tên giữ nguyên tiếng Anh (vì lúc đi làm ai cũng dùng tiếng Anh), kèm ví von cho dễ nhớ:

- 🧾 **Image** (đọc: i-mịt) — là **CÔNG THỨC nấu ăn**, hay cái **khuôn**. Nó là bản đóng gói **tĩnh** (nằm im, không chạy). Image chứa sẵn app của bạn và mọi thứ cần thiết, nhưng nó chưa "chạy".

- 🍲 **Container** (đọc: con-tên-nờ) — là **MÓN ĂN đã nấu xong** từ công thức. Đây là bản **đang chạy** của image. Từ 1 image (1 công thức), bạn có thể nấu ra nhiều container (nhiều phần ăn) giống hệt nhau.

- 📜 **Dockerfile** (đọc: đốc-cơ-phai) — là tờ **HƯỚNG DẪN** từng bước để tạo ra image. Bạn viết vào đó: "lấy Node, copy code của tôi vào, cài thư viện, chạy app". Docker đọc tờ này rồi làm ra image cho bạn.

- 🏪 **Registry / Docker Hub** (đọc: re-gít-tri / đốc-cơ-hấp) — là cái **CHỢ / kho chứa image** trên mạng. Bạn lên đó tải về những image người khác làm sẵn (ví dụ `nginx`, `redis`, `postgres`) để dùng ngay, khỏi tự làm. Cũng có thể đẩy image của bạn lên đó để chia sẻ.

**Phân biệt nhanh container và máy ảo (VM):**

> 🖥️ **Máy ảo (VM)** là cả một máy tính giả lập đầy đủ → **nặng, chậm mở** (vài GB, mất cả phút). Còn **container** chỉ đóng gói app của bạn và dùng chung hệ điều hành của máy thật → **nhẹ, mở nhanh** (vài MB, vài giây). Container giống "chỉ mang đồ ăn", còn VM giống "khênh cả cái bếp đi theo".

---

## 🛠️ Hình dung cách dùng

Bạn chưa cần thuộc lệnh ngay. Chỉ cần **nhìn cho quen** vài lệnh dễ nhất:

```bash
# 1. Chạy thử cho biết Docker hoạt động (in ra lời chào)
docker run hello-world

# 2. Chạy app của bạn, mở cổng để vào xem từ trình duyệt
docker run -p 3000:3000 myapp

# 3. Xem những container nào đang chạy
docker ps
```

Giải thích nhẹ nhàng:

- `docker run hello-world` → tải một image nhỏ tên `hello-world` về và chạy nó. Nó in vài dòng chữ để chứng minh Docker ổn. Đây là lần "thử máy" kinh điển.
- `docker run -p 3000:3000 myapp` → chạy app của bạn (image tên `myapp`). Phần `-p 3000:3000` nghĩa là "nối **cổng** 3000 của máy bạn vào cổng 3000 bên trong hộp", để bạn mở trình duyệt vào `localhost:3000` xem được. ("Cổng" / port là cánh cửa để app nhận và gửi dữ liệu mạng.)
- `docker ps` → liệt kê các container đang chạy, giống xem "có mấy nồi đang nấu trên bếp".

**Luồng làm việc, nhìn từ trên xuống:**

```
Viết Dockerfile  →  build ra image  →  run thành container
   (tờ hướng dẫn)     (cái khuôn)         (bản đang chạy)
```

> 💡 "build" nghĩa là dựng/làm ra. `docker build` đọc tờ Dockerfile rồi tạo ra image cho bạn.

---

## 📊 Khi nào DÙNG Docker

| Tình huống | Docker giúp gì | Lợi ích chính |
|---|---|---|
| Đưa app lên máy chủ chạy thật | Đóng gói 1 lần, chạy đâu cũng y hệt | Deploy **nhất quán**, ít lỗi "tại máy" |
| Cần một cái database để code thử | Tải image `postgres`/`redis` rồi chạy 1 lệnh là có ngay | Khỏi cài đặt lằng nhằng, **nhanh gọn** |
| Chia sẻ app cho đồng nghiệp | Gửi image, họ chạy là xong | Ai cũng có **môi trường giống nhau** |
| Một máy chạy nhiều app khác nhau | Mỗi app một hộp riêng, không đụng nhau | **Tách biệt**, sạch sẽ, dễ dọn |

Tóm lại: Docker giúp **chạy app giống nhau ở mọi nơi**, **dựng công cụ phụ trợ (redis, postgres) cực nhanh**, và **đóng gói gọn gàng** để chia sẻ.

---

## 🔤 Từ vựng tiếng Anh cần biết

Học thuộc dần bảng này, đi làm gặp suốt:

| Từ | Đọc (Việt-hóa) | Nghĩa |
|---|---|---|
| container | con-tên-nờ | cái "hộp" chứa app đang chạy |
| image | i-mịt | bản đóng gói tĩnh (công thức/khuôn) |
| build | bít (build) | dựng / làm ra image |
| run | răn | chạy |
| deploy | đi-ploi | đưa app lên máy chủ chạy thật |
| registry | re-gít-tri | kho / chợ chứa image trên mạng |
| volume | vô-liêm | nơi lưu dữ liệu để không mất khi tắt hộp |
| port | po (port) | cổng — cửa nhận/gửi dữ liệu mạng |
| environment | en-vai-rần-mần | môi trường (các cài đặt khi chạy) |
| lightweight | lai-uêi | nhẹ (ít tốn tài nguyên) |
| isolated | ai-sồ-lây-tịt | tách biệt, không đụng cái khác |
| package | pách-kịt | gói / đóng gói |
| pull | pun (pull) | tải image về máy |
| push | pút (push) | đẩy image lên kho |
| Dockerfile | đốc-cơ-phai | tờ hướng dẫn tạo image |

---

## 👉 Học tiếp

Khi đã thấy mấy ý trên "ngấm ngấm", đi theo thứ tự này:

1. 📗 `README.md` — bài chính của tuần, đi sâu hơn từng phần.
2. 🔬 `DEEP-DIVE.md` — đào sâu cơ chế bên trong, ví dụ nâng cao.
3. 🧪 `lab/LAB.md` — thực hành tận tay, tự build image và chạy container.

Đừng vội. Hiểu chắc file này đã, rồi bước tiếp. 🌟

---

## ✅ Checklist hiểu cơ bản

Tự hỏi mình, trả lời được hết là bạn sẵn sàng qua `README.md`:

- [ ] Tôi giải thích được Docker là gì bằng ví von "hộp cơm / container hàng".
- [ ] Tôi nói được vì sao "máy tôi chạy được mà máy anh thì không" và Docker sửa điều đó ra sao.
- [ ] Tôi phân biệt được **image** (công thức/khuôn) và **container** (món ăn đang chạy).
- [ ] Tôi biết **Dockerfile** là tờ hướng dẫn để tạo image.
- [ ] Tôi biết **registry / Docker Hub** là chợ để tải image như `nginx`, `redis`.
- [ ] Tôi nói được khác nhau giữa container và máy ảo (VM) trong 1 câu (nhẹ/nặng).
- [ ] Tôi nhớ luồng: viết Dockerfile → build ra image → run thành container.
