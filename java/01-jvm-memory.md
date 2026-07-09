# 01 · JVM & Bộ nhớ — Java Backend

> Mảng bị hỏi NHIỀU NHẤT khi phỏng vấn Java. Hiểu chắc phần này là ghi điểm lớn. Đọc xong hãy làm quiz **☕ Java** chủ đề *JVM / bộ nhớ*.

---

## 1. JVM là gì và vì sao Java "chạy mọi nơi"

Java **không** biên dịch thẳng ra mã máy như C. Thay vào đó:

```
Mã nguồn .java  --javac-->  Bytecode .class  --JVM-->  Mã máy của từng HĐH
```

- `javac` biên dịch `.java` thành **bytecode** (`.class`) — một dạng trung gian, độc lập nền tảng.
- **JVM** (Java Virtual Machine) trên mỗi máy đọc bytecode và dịch/chạy nó. Máy Windows có JVM cho Windows, máy Linux có JVM cho Linux…

> Một câu để nhớ: **"Write once, run anywhere"** — viết một lần, chạy mọi nơi — là nhờ tầng JVM ở giữa.

JVM còn có **JIT (Just-In-Time compiler)**: đoạn code chạy nhiều lần ("hot") sẽ được dịch thẳng ra mã máy và tối ưu → càng chạy càng nhanh.

---

## 2. Các vùng bộ nhớ của JVM

Khi chương trình chạy, JVM chia bộ nhớ thành mấy vùng. Đây là hình dung đơn giản:

| Vùng | Chứa gì | Chia sẻ giữa thread? |
|------|---------|----------------------|
| **Heap** | Mọi **object** (`new ...`), mảng | ✅ Dùng chung |
| **Stack** (mỗi thread 1 cái) | Biến cục bộ, tham chiếu, khung gọi hàm | ❌ Riêng từng thread |
| **Metaspace** | Metadata của class (từ Java 8, thay PermGen) | ✅ Dùng chung |
| **PC Register / Native stack** | Con trỏ lệnh, gọi native | ❌ Riêng |

### Stack vs Heap — ví dụ

```java
void demo() {
    int x = 5;                 // x nằm trên STACK (biến cục bộ nguyên thuỷ)
    User u = new User("Hai");  // biến u (tham chiếu) trên STACK,
                               // nhưng OBJECT User thật nằm trên HEAP
}
```

- `x` (nguyên thuỷ) và `u` (tham chiếu) nằm trên **stack** của thread đang chạy.
- Object `User` mà `u` trỏ tới nằm trên **heap** (chia sẻ, do GC quản lý).
- Khi `demo()` kết thúc → stack frame bị xoá ngay; object trên heap thì chờ **GC** dọn khi không còn ai trỏ tới.

> **Bẫy phỏng vấn:** "biến local và object nằm ở đâu?" → biến local trên stack, object trên heap. Trả lời gọn thế này là đạt.

### PermGen → Metaspace (Java 8)

- Trước Java 8: metadata class nằm ở **PermGen** — kích thước cố định, dễ lỗi `OutOfMemoryError: PermGen space` khi nạp quá nhiều class.
- Java 8+: thay bằng **Metaspace** nằm trong **native memory**, mặc định **tự mở rộng** (giới hạn bởi `-XX:MaxMetaspaceSize`). → giảm hẳn lỗi PermGen.

---

## 3. Class loading — nạp một class thế nào

Khi lần đầu dùng tới một class, JVM nạp nó qua các bước:

```
Loading → Linking (Verification → Preparation → Resolution) → Initialization
```

1. **Loading** — tìm & đọc bytecode, tạo `Class` object.
2. **Verification** — kiểm bytecode hợp lệ, an toàn.
3. **Preparation** — cấp bộ nhớ cho biến `static`, gán **giá trị mặc định** (0/null/false).
4. **Resolution** — phân giải symbolic reference thành tham chiếu thật.
5. **Initialization** — chạy `static {}` block + gán giá trị static **thật** (`<clinit>`).

> Class được nạp **lười (lazy)**: chỉ khi lần đầu thực sự dùng tới.

### Mô hình "song thân uỷ nhiệm" (Parent Delegation)

ClassLoader có phân cấp: `Application` → `Platform/Extension` → `Bootstrap`.

Khi nạp một class, loader con **hỏi loader cha trước**; cha không nạp được mới tới con. Vì sao?

- **An toàn:** class lõi (`java.lang.String`…) luôn do Bootstrap nạp → không ai thay được bằng bản giả mạo.
- **Tránh nạp trùng:** một class chỉ nạp một lần.

> Tomcat/OSGi cố tình *phá vỡ* mô hình này để cô lập nhiều ứng dụng trong cùng JVM.

---

## 4. Garbage Collection (GC) — dọn rác tự động

Java **không** cần `free()` thủ công như C. GC tự tìm object "không còn ai trỏ tới" và thu hồi.

### Vì sao chia thế hệ (generational)?

Quan sát thực tế: **đa số object chết trẻ** (tạo ra rồi bỏ ngay). Nên heap chia:

```
Young Generation (Eden + 2 Survivor)  |  Old Generation
        ↑ Minor GC (nhanh, thường xuyên)        ↑ Major/Full GC (chậm, thưa)
```

- Object mới sinh ở **Eden**. Minor GC quét Young rất nhanh; object sống sót qua vài lần GC mới được "thăng" lên **Old**.
- Old chứa object sống lâu; quét (Full GC) đắt hơn nên diễn ra thưa.

### Ba thuật toán GC nền tảng

| Thuật toán | Cách làm | Nhược điểm | Dùng cho |
|-----------|----------|------------|----------|
| **Mark-Sweep** | Đánh dấu object sống → xoá object chết | Để lại **phân mảnh** | — |
| **Copying** | Chép object sống sang nửa vùng khác | Lãng phí 50% bộ nhớ | **Young** (đa số chết trẻ) |
| **Mark-Compact** | Đánh dấu → dồn object sống về một đầu | Tốn công di chuyển | **Old** |

> Java **không** dùng reference counting (đếm tham chiếu) vì không xử lý được **vòng tham chiếu** (A trỏ B, B trỏ A). GC hiện đại dùng **reachability** (truy vết từ GC Roots).

Các bộ GC thực tế: **G1** (mặc định từ Java 9, chia vùng, độ trễ thấp), **ZGC/Shenandoah** (độ trễ cực thấp cho heap lớn), CMS (đã bỏ).

---

## 5. Bốn loại tham chiếu

GC xử lý object khác nhau tuỳ loại tham chiếu trỏ tới nó:

| Loại | GC thu khi nào | Dùng làm gì |
|------|----------------|-------------|
| **Strong** (mặc định) | Không bao giờ, khi còn được trỏ | Bình thường (nhưng dễ gây leak) |
| **Soft** | Khi **sắp hết** bộ nhớ | Cache nhạy bộ nhớ |
| **Weak** | Ở **lần GC kế tiếp** | `WeakHashMap`, tránh leak |
| **Phantom** | Đã bị thu, chỉ để nhận thông báo dọn | Dọn dẹp thay `finalize` |

---

## 6. Memory leak vs OutOfMemoryError

- **Memory leak (rò rỉ):** object **không dùng nữa** nhưng **vẫn bị tham chiếu** → GC không thu được → bộ nhớ tăng dần. Nguyên nhân hay gặp:
  - `static` Collection cứ thêm mà không xoá.
  - `ThreadLocal` không gọi `remove()` (trong thread pool → thread tái dùng → leak).
  - Listener/callback đăng ký mà không gỡ.
- **OutOfMemoryError (OOM):** JVM thực sự **không cấp nổi** bộ nhớ nữa (`java.lang.OutOfMemoryError: Java heap space`).

> Leak tích tụ lâu ngày **dẫn đến** OOM. Điều tra: chụp **heap dump** (`jmap`) rồi phân tích bằng **MAT** để tìm object nào giữ bộ nhớ.

---

## 7. Câu hỏi phỏng vấn hay gặp (tự trả lời trước khi xem quiz)

1. Biến cục bộ và object nằm ở vùng bộ nhớ nào? Vì sao?
2. Java 8 thay PermGen bằng gì? Khác biệt quan trọng nhất?
3. Vì sao GC chia Young/Old generation?
4. Kể 3 thuật toán GC và nhược điểm mỗi loại. Vì sao Java không dùng reference counting?
5. Phân biệt strong/soft/weak/phantom reference.
6. Memory leak khác OOM thế nào? Kể vài nguyên nhân leak thường gặp.
7. Mô hình parent delegation của ClassLoader là gì và để làm gì?

> Làm tiếp: tab **🧠 Tư duy → ☕ Java**, lọc các câu chủ đề *JVM / bộ nhớ*, *Garbage Collection*, *JVM / Class loading*.
