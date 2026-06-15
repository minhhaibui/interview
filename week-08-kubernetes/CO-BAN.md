# 🌱 Nhập môn — Tuần 8: Kubernetes (cho người mới)

> Đừng lo nếu nghe "Kubernetes" thấy ghê ghê — ai cũng bắt đầu từ con số 0 thôi! 💪
> Bạn chỉ cần biết **Docker** (cái tạo ra **container** — "hộp" chứa app) là đủ để đọc file này.
> File này là bậc thang ĐẦU TIÊN — hãy đọc nó **TRƯỚC** `README.md` nhé. Cực dễ, cứ thong thả.

---

## 🎯 Kubernetes là gì?

Kubernetes (viết tắt là **K8s** — chữ "ubernete" có 8 ký tự nên gọi K-8-s 😄) là một **người quản lý container tự động**.

Hình dung thế này:
- **Docker** tạo ra các **"hộp"** (container), mỗi hộp chứa 1 app đang chạy.
- Lúc đầu bạn chỉ có **1-2 hộp** → tự tay bật/tắt, dễ ợt.
- Nhưng khi bạn có **HÀNG CHỤC, HÀNG TRĂM hộp** chạy trên **nhiều máy chủ** khác nhau → ai trông coi tất cả? Hộp nào chết thì ai bật lại? Đông khách thì ai thêm hộp?

👉 **K8s chính là người trông coi đó.**

> 🍜 **Analogy: K8s như TRƯỞNG CA của một nhà hàng lớn.**
> Bạn (ông chủ) chỉ nói: "Tôi muốn lúc nào cũng có **3 đầu bếp** đứng bếp." Trưởng ca lo phần còn lại:
> - Đầu bếp nào **nghỉ/ốm** (hộp chết) → tự gọi người mới vào thay ngay.
> - **Đông khách** (nhiều người dùng) → tự thêm đầu bếp.
> - **Vắng khách** → cho bớt người về nghỉ.
> - Sắp xếp ai đứng bếp nào (đặt hộp lên máy nào) cho hợp lý.

Người ta hay gọi K8s là công cụ **"tự lái" cụm container** — giống xe tự lái, bạn nói điểm đến, nó tự xử lý đường đi.

---

## 🤔 Vì sao cần K8s?

Hãy nhìn vấn đề theo kiểu **TRƯỚC** và **SAU**:

**TRƯỚC khi có K8s (làm tay):**
- Chạy 1-2 container bằng tay → **ổn**, không vấn đề gì.
- Nhưng nếu cần:
  - **Nhiều container** trên **nhiều máy** → phải nhớ cái nào ở đâu 😵
  - App phải **sống 24/7** → ai canh lúc 3 giờ sáng nó chết?
  - **Tự phục hồi** khi hỏng → bạn phải thức dậy bật lại bằng tay.
  - **Cập nhật phiên bản mới mà không sập web** (không downtime) → cực kỳ khó làm tay.
  - **Đông khách thì thêm máy, vắng thì bớt** → mệt mỏi vô cùng.

👉 Làm tay tất cả những việc này thì **không nổi** — vừa cực vừa dễ sai.

**SAU khi có K8s:**
K8s lo hết, theo một cách rất hay gọi là **KHAI BÁO** (declarative):
- Bạn không ra lệnh từng bước "bật cái này, tắt cái kia".
- Bạn chỉ **nói ra điều mình MUỐN**: *"Tôi muốn luôn có 3 bản app chạy."*
- K8s sẽ **tự làm mọi thứ** để giữ đúng 3 bản đó — chết 1 thì nó tạo lại, dư 1 thì nó xóa bớt.

> 💡 Ví dụ vui: Bạn nói "tôi muốn ly nước **luôn đầy**". Mỗi lần bạn uống vơi, có người tự động rót thêm cho đầy lại. Bạn không cần ra lệnh "rót đi" — họ tự lo. K8s làm việc kiểu đó.

---

## 🧩 Khái niệm cơ bản nhất

Bạn chỉ cần nhớ 6 từ này thôi, mỗi từ kèm 1 ví dụ cho dễ nhớ:

**1. Pod** 🥚 (đọc: "pót")
- Đơn vị **nhỏ nhất** mà K8s quản lý. Một Pod **bọc 1 (đôi khi vài) container** bên trong.
- Analogy: Pod như **vỏ trứng** bọc lấy lòng đỏ (container). K8s không cầm trực tiếp container, nó cầm cái vỏ trứng.

**2. Deployment** 📋 (đọc: "đi-ploi-mần")
- Người quản lý các Pod: bạn khai báo **"muốn N bản chạy"**, nó giữ đúng số đó. Cũng lo việc **cập nhật dần dần** sang phiên bản mới.
- Analogy: như **bảng phân công ca làm**: "luôn cần 3 người trực" — thiếu thì gọi thêm, đổi ca thì thay từ từ chứ không cho nghỉ hết một lúc.

**3. Service** 📞 (đọc: "sơ-vít")
- Một **địa chỉ và cổng cố định** để gọi vào app, đồng thời **chia tải** (chia đều khách) cho các Pod. Cần nó vì các Pod **hay sinh ra rồi mất đi**, địa chỉ riêng của từng Pod thay đổi liên tục.
- Analogy: như **tổng đài** của công ty. Bạn luôn gọi 1 số duy nhất; tổng đài tự nối máy cho một nhân viên đang rảnh. Nhân viên nghỉ việc, người mới vào — bạn chẳng cần biết, vẫn gọi số cũ.

**4. Node** 🖥️ (đọc: "nốt")
- Một **máy chủ thật** (hoặc máy ảo) nơi các Pod thực sự chạy.
- Analogy: như **một cái bếp** trong nhà hàng, nơi các đầu bếp (Pod) đứng nấu.

**5. Cluster** 🏢 (đọc: "cờ-lát-tơ")
- **Cả dàn máy** (tất cả các Node) gộp lại, được K8s quản lý chung như một khối.
- Analogy: như **cả nhà hàng** — gồm nhiều bếp, nhiều nhân viên, do trưởng ca điều hành.

**6. Desired state & Reconcile** 🎯🔄 (đọc: "đi-zai-ơ-đờ x-tết" và "re-con-sai")
- **Desired state** = trạng thái bạn **mong muốn** (ví dụ: "3 Pod đang chạy").
- **Reconcile** = K8s liên tục **so sánh thực tế với mong muốn** rồi tự đưa thực tế về đúng như vậy.
- Analogy: như **máy điều hòa**. Bạn đặt 25°C (mong muốn), điều hòa liên tục đo nhiệt độ thật và tự chỉnh để giữ đúng 25°C. Bạn không cần bật/tắt liên tục.

---

## 🛠️ Hình dung cách chạy

Luồng cơ bản kể bằng lời:

1. Bạn viết một file văn bản tên là **YAML** (đọc: "ya-mồ") — trong đó ghi điều bạn muốn, ví dụ: *"Tôi muốn 3 Pod chạy app này."*
2. Bạn gõ lệnh **`kubectl apply`** (kubectl đọc là "kiu-bê-con-trồ" hoặc "kiu-bích-tồ") để **đưa file đó cho K8s**.
3. K8s đọc xong, **tự tạo và giữ đúng 3 Pod** luôn sống. Một Pod chết → nó tạo lại ngay.

Sơ đồ siêu đơn giản:

```
   Bạn viết file app.yaml
   ("tôi muốn 3 Pod")
            │
            ▼
   kubectl apply -f app.yaml   ◄── bạn ra lệnh 1 lần
            │
            ▼
   ┌──────── K8s (trưởng ca) ────────┐
   │  Luôn giữ đúng 3 Pod sống:      │
   │     [Pod] [Pod] [Pod]          │
   │  Chết 1 cái → tự tạo lại 1 cái │
   └─────────────────────────────────┘
```

Vài lệnh dễ để làm quen (chưa cần thuộc, chỉ cần thấy quen mặt):

```bash
kubectl get pods            # Xem hiện đang có những Pod nào, sống hay chết
kubectl apply -f app.yaml   # Gửi file mong muốn cho K8s (tạo/cập nhật)
kubectl scale deployment my-app --replicas=5   # Đổi từ 3 lên 5 bản chạy
```

> 💡 Mẹo: `get` là "cho tôi xem", `apply` là "làm theo file này", `scale` là "tăng/giảm số bản". Chỉ vậy thôi!

---

## 📊 Khi nào CẦN K8s / khi nào CHƯA cần

| Tình huống | Cần K8s? | Vì sao |
|---|---|---|
| App nhỏ, 1 server, ít người dùng | ❌ CHƯA cần | Dùng tay hoặc **Docker Compose** là đủ, nhẹ nhàng hơn nhiều |
| Vài container, chạy trên 1 máy | ❌ CHƯA cần | Docker Compose lo được, K8s là "dùng dao mổ trâu giết gà" |
| Đang học / làm dự án cá nhân | ❌ CHƯA cần | Cứ tập trung làm app chạy được trước đã |
| **Nhiều service** nói chuyện với nhau | ✅ Bắt đầu cần | K8s quản lý nhiều thành phần gọn gàng hơn |
| **Quy mô lớn**, nhiều máy chủ | ✅ Cần | K8s sắp xếp container trên nhiều máy giùm bạn |
| Cần **tự phục hồi** khi hỏng (24/7) | ✅ Cần | K8s tự bật lại Pod chết, không cần bạn thức đêm |
| Cần **tự co giãn** theo lượng khách | ✅ Cần | K8s tự thêm/bớt Pod theo tải |
| Cần **cập nhật không downtime** | ✅ Cần | K8s thay từng Pod một, web không bao giờ sập |

> 🙏 **Nói thật lòng:** K8s **mạnh nhưng phức tạp**. Đừng vội nhồi nó vào mọi dự án. Nếu app của bạn còn nhỏ, **Docker Compose** đã quá đủ. Hãy dùng K8s khi bạn **thật sự** gặp những bài toán ở cột "✅ Cần" phía trên. Học để biết là tốt, nhưng dùng đúng lúc mới khôn. 😉

---

## 🔤 Từ vựng tiếng Anh cần biết

| Từ | Đọc (Việt-hóa) | Nghĩa |
|---|---|---|
| cluster | cờ-lát-tơ | Cả dàn máy được K8s quản lý chung |
| node | nốt | Một máy chủ thật trong cluster, nơi chạy Pod |
| pod | pót | Đơn vị nhỏ nhất, bọc 1 (vài) container |
| deployment | đi-ploi-mần | Bộ quản lý "muốn N bản chạy" + cập nhật dần |
| service | sơ-vít | Địa chỉ/cổng cố định + chia tải vào các Pod |
| container | con-tên-nơ | "Hộp" chứa app đang chạy (từ Docker) |
| replica | re-pli-ca | Một bản sao đang chạy của app (mỗi bản là 1 Pod) |
| scale | x-câu (scale) | Tăng/giảm số bản chạy |
| orchestration | o-két-x-trây-sần | Việc "điều phối" nhiều container — chính là việc của K8s |
| self-healing | seo-hi-linh | Tự phục hồi: hỏng thì tự bật lại |
| desired state | đi-zai-ơ-đờ x-tết | Trạng thái bạn mong muốn ("tôi muốn 3 Pod") |
| actual state | ác-chu-ồ x-tết | Trạng thái thực tế đang có |
| reconcile | re-con-sai | K8s tự đưa thực tế về đúng mong muốn |
| rollout | rôn-aut | Tung phiên bản mới ra dần dần |
| rollback | rôn-bách | Quay về phiên bản cũ khi bản mới lỗi |
| YAML | ya-mồ | Định dạng file văn bản để khai báo mong muốn |
| kubectl | kiu-bê-con-trồ | Lệnh để ra lệnh cho K8s từ máy của bạn |

---

## 👉 Học tiếp

Khi đã thấy quen quen với mấy khái niệm trên, đi tiếp theo thứ tự này nhé:

1. 📖 **[`README.md`](README.md)** — học bài bản hơn: kiến trúc K8s, viết manifest cho app Node.js, các loại workload, debug bằng kubectl.
2. 🔬 **[`DEEP-DIVE.md`](DEEP-DIVE.md)** — đào sâu cơ chế bên trong, bẫy thực tế (production) và câu hỏi phỏng vấn khó.
3. 🧪 **[`lab/LAB.md`](lab/LAB.md)** — **tận tay thực hành**: tạo cluster thật bằng `kind` rồi tự thử self-heal, scale, cập nhật & quay lui.

> Đi từ từ, mỗi ngày một bậc. Đừng nhảy cóc — nền vững thì sau này nhàn. 🌱

---

## ✅ Checklist hiểu cơ bản

Tự hỏi bản thân, nếu trả lời được hết là bạn đã nắm vững phần nhập môn:

- [ ] Mình giải thích được K8s là gì bằng 1 câu (gợi ý: "người quản lý container tự động").
- [ ] Mình nói được vì sao **chạy tay vài container thì ổn, nhưng nhiều thì cần K8s**.
- [ ] Mình phân biệt được **Pod, Deployment, Service, Node, Cluster** (kèm ví dụ của riêng mình).
- [ ] Mình hiểu **desired state** và **reconcile** qua ví dụ máy điều hòa / ly nước luôn đầy.
- [ ] Mình hiểu ý nghĩa của 3 lệnh: `kubectl get pods`, `kubectl apply`, `kubectl scale`.
- [ ] Mình biết **khi nào CHƯA cần K8s** (app nhỏ → Docker Compose là đủ).
- [ ] Mình sẵn sàng mở `README.md` để học sâu hơn. 🚀
