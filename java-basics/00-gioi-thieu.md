# 00 · Bắt đầu với Java — dành cho người MỚI

> Track này dạy Java **từ số 0**: chưa biết gì cũng học được. Đọc theo thứ tự 00 → 09, gõ lại từng ví dụ. Học xong track này, bạn mới nên qua track **☕ Java Backend (để đi làm)** — vì track đó giả định bạn đã biết cú pháp.

---

## 1. Java là gì? Vì sao đáng học?

- **Java** là ngôn ngữ lập trình hướng đối tượng, ra đời 1995, cực phổ biến cho **backend** (server xử lý dữ liệu cho web/app), ngân hàng, hệ thống lớn.
- Slogan: **"Write once, run anywhere"** — viết một lần, chạy mọi nơi. Vì code Java không chạy trực tiếp trên máy, mà chạy trên **JVM** (Java Virtual Machine) — máy ảo có mặt trên Windows/Mac/Linux.
- Việc làm nhiều, lương tốt, hệ sinh thái khổng lồ (**Spring Boot**, **MyBatis**, Kafka…). Học chắc Java → dễ xin việc backend.

## 2. Chương trình Java chạy thế nào? (rất quan trọng để hiểu)

```
Code .java  →  [javac biên dịch]  →  Bytecode .class  →  [JVM chạy]  →  Kết quả
 (bạn viết)                          (máy hiểu, đa nền tảng)
```

- Bạn viết file **`.java`** (văn bản thường).
- Trình biên dịch **`javac`** dịch ra **bytecode** (file `.class`) — không phải mã máy cụ thể, mà là "mã trung gian".
- **JVM** đọc bytecode và chạy. Nhờ vậy cùng một file `.class` chạy được trên mọi hệ điều hành có JVM.

> **JDK vs JRE vs JVM** (hay hỏi):
> - **JVM**: máy ảo chạy bytecode.
> - **JRE** = JVM + thư viện để **chạy** chương trình.
> - **JDK** = JRE + công cụ để **lập trình** (javac, debugger…). **Bạn cần cài JDK.**

## 3. Cài đặt (làm 1 lần)

1. Tải **JDK 21** (bản LTS, ổn định lâu dài) — gõ Google "download JDK 21 Temurin" (Adoptium) hoặc Oracle.
2. Cài xong, mở Terminal kiểm tra:

```bash
java -version     # phải in ra "21..."
javac -version    # phải in ra "javac 21..."
```

3. Cài một IDE cho dễ (khuyên **IntelliJ IDEA Community** — miễn phí, tốt nhất cho Java). IDE tự biên dịch & chạy giúp bạn, có gợi ý code.

## 4. Chương trình Java đầu tiên — Hello World

Tạo file **`Hello.java`**:

```java
public class Hello {
    public static void main(String[] args) {
        System.out.println("Xin chào Java!");
    }
}
```

Chạy bằng dòng lệnh (hoặc bấm nút ▶ trong IntelliJ):

```bash
javac Hello.java     # tạo ra Hello.class
java Hello           # in: Xin chào Java!
```

### Giải thích TỪNG dòng (đừng bỏ qua)

| Phần | Ý nghĩa |
|------|---------|
| `public class Hello` | Khai báo một **class** tên `Hello`. **Tên class phải TRÙNG tên file** (`Hello.java`). |
| `public static void main(String[] args)` | **Điểm bắt đầu** của chương trình. JVM luôn tìm và chạy `main` đầu tiên. Câu này gần như bất biến — cứ nhớ mẫu. |
| `System.out.println(...)` | In ra màn hình rồi xuống dòng (`print` = in, `ln` = line/xuống dòng). |
| `;` | Mỗi câu lệnh **kết thúc bằng dấu chấm phẩy**. Quên là lỗi. |
| `{ }` | Gom nhóm code thành khối. Mở `{` thì phải đóng `}`. |

> Java **phân biệt hoa/thường**: `Main` khác `main`, `String` khác `string`. Viết sai hoa/thường là lỗi.

## 5. Lộ trình track này

| Bài | Học gì |
|-----|--------|
| 01 | Biến & kiểu dữ liệu (số, chữ, true/false) |
| 02 | Toán tử & điều khiển luồng (if, switch, vòng lặp) |
| 03 | Method (hàm) — chia nhỏ chương trình |
| 04 | OOP phần 1: class & object |
| 05 | OOP phần 2: kế thừa, đa hình, interface |
| 06 | SOLID — 5 nguyên lý viết OOP tốt |
| 07 | String, mảng & Collections (List/Map) hay dùng |
| 08 | Xử lý lỗi (Exception) |
| 09 | Tổ chức project (package, Maven) + cầu nối sang phỏng vấn |

## 6. Cách học hiệu quả nhất

1. **Gõ lại** mọi ví dụ (đừng chỉ đọc) — tay quen mới nhớ.
2. Mỗi bài có phần **"🧪 Tự thử"** — làm hết trước khi qua bài sau.
3. Đọc xong track nền tảng → làm quiz **🧠 Tư duy → ☕ Java** (lọc chủ đề cơ bản trước).
4. Sai câu nào → nó vào **🔁 Ôn câu sai** để ôn lại.

---

## 🧪 Tự thử

1. Cài JDK, chạy được `java -version`.
2. Viết `Hello.java` in ra tên bạn.
3. Sửa để in **2 dòng** (dùng 2 câu `println`).
4. Thử **cố ý** quên một dấu `;` → xem thông báo lỗi trông thế nào (làm quen với lỗi từ sớm).

> Xong? Qua **bài 01 · Biến & kiểu dữ liệu**.
