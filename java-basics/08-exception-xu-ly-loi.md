# 08 · Xử lý lỗi (Exception)

> Exception = lỗi xảy ra **lúc chạy** (chia cho 0, file không tồn tại, gọi method trên `null`…). Java cho cơ chế "bắt" lỗi để chương trình không sập ngang.

---

## 1. Vì sao cần? Khi lỗi xảy ra chuyện gì?

```java
int[] a = {1, 2, 3};
System.out.println(a[5]);   // 💥 ArrayIndexOutOfBoundsException → chương trình DỪNG
System.out.println("dòng này không chạy");
```

Nếu không xử lý, Java **ném exception** và chương trình **dừng** tại đó. `try/catch` giúp bạn **bắt** lỗi và xử lý êm.

## 2. `try / catch / finally`

```java
try {
    int kq = 10 / 0;                 // ném ArithmeticException
} catch (ArithmeticException e) {
    System.out.println("Không chia cho 0 được: " + e.getMessage());
} finally {
    System.out.println("Luôn chạy — dù lỗi hay không");
}
```

- **`try`**: đặt code có thể lỗi.
- **`catch`**: chạy khi có lỗi đúng loại; `e` chứa thông tin lỗi (`e.getMessage()`).
- **`finally`**: **luôn** chạy (kể cả có lỗi hay `return`) — hay dùng để dọn dẹp (đóng file/kết nối).

### Bắt nhiều loại lỗi

```java
try {
    // ...
} catch (NumberFormatException e) {
    System.out.println("Số sai định dạng");
} catch (Exception e) {              // Exception là "cha" — bắt mọi lỗi còn lại (để CUỐI)
    System.out.println("Lỗi khác: " + e.getMessage());
}
```

## 3. `throw` — tự ném lỗi khi dữ liệu vô lý

```java
void napTien(double tien) {
    if (tien <= 0)
        throw new IllegalArgumentException("Số tiền phải > 0");
    // ...
}
```

→ Chủ động báo lỗi thay vì để dữ liệu sai lọt vào hệ thống.

## 4. ⭐ Checked vs Unchecked — hay hỏi phỏng vấn

| | Checked exception | Unchecked (RuntimeException) |
|--|-------------------|------------------------------|
| Khi nào | Lỗi **ngoài tầm** code (I/O, DB, file) | Lỗi **do lập trình** (null, chia 0, index) |
| Bắt buộc xử lý? | **CÓ** — phải `try/catch` hoặc khai `throws`, không thì **không biên dịch** | Không bắt buộc |
| Ví dụ | `IOException`, `SQLException` | `NullPointerException`, `ArithmeticException`, `IllegalArgumentException` |

```java
// checked → phải khai 'throws' hoặc try/catch
void docFile(String p) throws IOException {
    Files.readAllLines(Path.of(p));
}
```

> Cây phân cấp: `Throwable` → `Exception` (có `RuntimeException` = unchecked) và `Error` (lỗi JVM nghiêm trọng như `OutOfMemoryError` — đừng bắt).

## 5. `NullPointerException` — lỗi phổ biến nhất, cách tránh

```java
String s = null;
s.length();        // 💥 NullPointerException (gọi method trên null)
```

Cách phòng:

```java
if (s != null) s.length();                 // kiểm tra null
Objects.requireNonNullElse(s, "").length(); // hoặc cho giá trị mặc định
// dùng Optional (track nâng cao) để biểu thị "có thể vắng"
```

## 6. try-with-resources — tự đóng tài nguyên (nên dùng)

```java
try (Scanner sc = new Scanner(System.in)) {   // khai trong ()
    int x = sc.nextInt();
}   // Java TỰ đóng sc khi ra khỏi block, kể cả có lỗi
```

→ Khỏi cần `finally { sc.close(); }` thủ công. Áp dụng cho file, kết nối DB…

## 7. Tự tạo exception riêng

```java
class SoDuKhongDuException extends RuntimeException {
    public SoDuKhongDuException(String msg) { super(msg); }
}

void rutTien(double tien) {
    if (tien > soDu) throw new SoDuKhongDuException("Số dư không đủ");
}
```

→ Tên lỗi rõ nghĩa nghiệp vụ, dễ bắt đúng loại ở nơi gọi.

---

## 🧪 Tự thử

1. Viết code chia 2 số người dùng nhập, dùng `try/catch` bắt chia cho 0 và nhập chữ (`InputMismatchException`).
2. Viết method `kiemTraTuoi(int t)` ném `IllegalArgumentException` nếu `t < 0`.
3. Chứng minh `finally` luôn chạy: đặt `return` trong `try`, in gì đó trong `finally`.
4. Gây một `NullPointerException` rồi sửa bằng cách kiểm tra null.
5. Tạo exception riêng `EmailKhongHopLeException` và ném khi chuỗi không chứa `@`.

> Xong? Qua **bài 09 · Tổ chức project & cầu nối sang phỏng vấn**.
