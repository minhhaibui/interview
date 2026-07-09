# 11 · Lỗi Java hay gặp & cách sửa (tra cứu)

> Bài này để **tra cứu** khi bạn kẹt, không cần đọc một mạch. Người mới tự học hay bỏ cuộc vì một dòng lỗi khó hiểu — thực ra 90% là các lỗi kinh điển dưới đây. Đọc **thông báo lỗi** (đừng sợ nó), tìm đúng mục.

Có 2 loại lỗi:
- **Lỗi biên dịch** (compile error): `javac` báo, chương trình chưa chạy được. Có số dòng — sửa theo dòng đó.
- **Lỗi lúc chạy** (exception): chạy được rồi mới văng lỗi giữa chừng.

---

## A. Lỗi BIÊN DỊCH (compile)

### `cannot find symbol`
Java không nhận ra một tên bạn dùng. Nguyên nhân thường gặp:
- **Gõ sai tên** biến/method/class (nhớ Java phân biệt hoa/thường: `myList` ≠ `mylist`).
- **Chưa khai báo** biến trước khi dùng.
- **Thiếu `import`** (vd dùng `List`/`ArrayList`/`Scanner` mà quên `import java.util.*`).
- Dùng biến **ngoài phạm vi** `{}` nơi nó được khai báo.

```java
Scanner sc = new Scanner(System.in);   // ❌ cannot find symbol: class Scanner
// → thêm ở đầu file: import java.util.Scanner;
```

### `';' expected` / `reached end of file while parsing`
- `';' expected`: **quên dấu chấm phẩy** cuối câu lệnh.
- `reached end of file`: **thiếu dấu `}`** — số `{` và `}` không khớp. Mẹo: dùng IDE tự canh lề để thấy khối nào chưa đóng.

### `incompatible types: X cannot be converted to Y`
Gán sai kiểu.
```java
int x = 3.5;          // ❌ double không tự về int
int x = (int) 3.5;    // ✅ ép kiểu (mất phần lẻ → 3)

String s = 5;         // ❌
String s = "5";       // ✅  hoặc String.valueOf(5)
```

### `class X is public, should be declared in a file named X.java`
Tên **file** phải trùng tên **public class**.
```java
// file Test.java
public class SinhVien { }   // ❌ → đổi tên file thành SinhVien.java (hoặc bỏ 'public')
```

### `non-static method xxx() cannot be referenced from a static context`
Gọi method/field **của object** (không `static`) trực tiếp từ `main` (là `static`) mà chưa tạo object.
```java
public class App {
    void chao() { }                       // method instance
    public static void main(String[] a) {
        chao();                            // ❌
        new App().chao();                  // ✅ tạo object rồi gọi
    }
}
```
(Xem lại bài 03 mục static & bài 04.)

### `variable x might not have been initialized`
Dùng biến cục bộ khi chưa gán giá trị.
```java
int x;
System.out.println(x);   // ❌ → int x = 0; trước khi dùng
```

### `missing return statement`
Method khai báo trả về kiểu (không `void`) nhưng có nhánh không `return`.
```java
int max(int a, int b) {
    if (a > b) return a;
    // ❌ thiếu return khi a <= b
    return b;                // ✅
}
```

---

## B. Lỗi LÚC CHẠY (exception)

### `NullPointerException` (NPE) — phổ biến nhất
Gọi method/field trên biến đang là `null`.
```java
String s = null;
s.length();          // 💥 NPE
```
**Sửa:** kiểm tra null trước (`if (s != null)`), hoặc đảm bảo đã khởi tạo. Hay gặp: quên `new` cho ArrayList, `map.get(key)` trả null rồi đem dùng. (Bài 08.)

### `ArrayIndexOutOfBoundsException` / `StringIndexOutOfBounds`
Truy cập chỉ số ngoài phạm vi. Mảng `n` phần tử có chỉ số **0 → n-1**.
```java
int[] a = {1, 2, 3};
a[3];                // 💥 (chỉ có a[0..2])
for (int i = 0; i <= a.length; i++)   // ❌ '<=' → dùng '<'
```

### `NumberFormatException`
`Integer.parseInt` / `Double.parseDouble` gặp chuỗi **không phải số**.
```java
Integer.parseInt("abc");     // 💥
Integer.parseInt(" 5 ");     // 💥 (có khoảng trắng → .trim() trước)
```
**Sửa:** bọc `try/catch (NumberFormatException e)` khi nhận input người dùng.

### `Could not find or load main class X`
Chạy sai. Nếu class có `package com.demo;` thì phải chạy từ thư mục gốc:
```bash
java com.demo.App        # ✅ (không phải: java App, cũng không java App.class)
```

### `Exception in thread "main" ... ClassCastException`
Ép một object về kiểu nó **không phải**.
```java
Object o = "hello";
Integer n = (Integer) o;   // 💥 String không phải Integer
```

### `ConcurrentModificationException`
**Sửa/xoá** phần tử của List **trong khi đang** for-each nó.
```java
for (String x : list)
    if (x.equals("a")) list.remove(x);   // 💥
// ✅ dùng list.removeIf(x -> x.equals("a"));
```

---

## C. Lỗi LOGIC (chạy được nhưng SAI kết quả) — nguy hiểm vì không báo lỗi

### So sánh chuỗi bằng `==`
```java
if (ten == "Nam")            // ❌ so địa chỉ, thường ra false
if (ten.equals("Nam"))       // ✅ so nội dung
```
(Bài 07 — lỗi kinh điển nhất.)

### Chia số nguyên
```java
double tb = 7 / 2;           // ❌ = 3.0 (chia nguyên trước rồi mới gán double)
double tb = 7.0 / 2;         // ✅ = 3.5
```

### Vòng lặp vô tận
```java
int n = 5;
while (n > 0) { System.out.println(n); }   // ❌ quên n-- → chạy mãi
```
**Dừng chương trình treo:** `Ctrl + C` ở terminal.

### Nhầm `=` với `==`
```java
if (x = 5)     // ❌ (may là Java chặn: 'incompatible types' vì '=' trả int, không phải boolean)
if (x == 5)    // ✅
```

---

## Mẹo đọc lỗi & tự gỡ

1. **Đọc DÒNG ĐẦU và SỐ DÒNG** trong thông báo — nó chỉ gần đúng chỗ sai.
2. Với exception, xem dòng `at TenClass.method(File.java:42)` → mở đúng dòng 42.
3. **In ra để soi** (`System.out.println("x = " + x)`) trước dòng nghi ngờ để biết giá trị thực.
4. Copy nguyên dòng lỗi lên Google — 99% đã có người hỏi.
5. Sửa **một lỗi rồi biên dịch lại** — lỗi đầu thường kéo theo nhiều lỗi giả phía sau.

---

## 🧪 Tự thử

1. Cố ý tạo mỗi lỗi sau rồi đọc thông báo: quên `;`, so sánh chuỗi bằng `==`, `a[a.length]`, gọi method trên `null`.
2. Với mỗi lỗi, ghi lại: thông báo trông thế nào + bạn sửa ra sao. Lần sau gặp lại sẽ nhận ra ngay.

> Đây là bài cuối track nền tảng. Gặp lỗi khi làm bài tập → quay lại đây tra. Sẵn sàng thì qua **☕ Java Backend (để đi làm)**.
