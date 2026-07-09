# 01 · Biến & Kiểu dữ liệu

> Biến = "cái hộp" có tên để chứa dữ liệu. Kiểu dữ liệu = loại dữ liệu cái hộp chứa (số, chữ, đúng/sai).

---

## 1. Khai báo biến

Cú pháp: `KiểuDữLiệu tênBiến = giáTrị;`

```java
int tuoi = 25;                 // số nguyên
double luong = 15000.5;        // số thực
boolean dangLamViec = true;    // đúng/sai
String ten = "Nam";            // chuỗi chữ
```

- **Java là ngôn ngữ "static typing"**: phải khai báo kiểu, và biến chỉ chứa đúng kiểu đó. `int tuoi = "abc";` → lỗi ngay khi biên dịch (khác JavaScript/Python).
- Đặt tên biến kiểu **camelCase**: `soLuongSanPham`, không dấu cách, không bắt đầu bằng số.

## 2. 8 kiểu nguyên thuỷ (primitive) — nhớ nhóm chính

| Kiểu | Chứa gì | Ví dụ |
|------|---------|-------|
| `int` | Số nguyên (hay dùng nhất) | `int x = 100;` |
| `long` | Số nguyên rất lớn | `long ds = 9000000000L;` (có `L`) |
| `double` | Số thực (hay dùng) | `double pi = 3.14;` |
| `float` | Số thực nhỏ hơn | `float f = 1.5f;` (có `f`) |
| `boolean` | `true` / `false` | `boolean ok = false;` |
| `char` | **Một** ký tự | `char c = 'A';` (nháy đơn) |
| `byte`, `short` | Số nguyên nhỏ (ít dùng) | |

> **Mẹo thực tế cho người mới:** dùng `int` cho số nguyên, `double` cho số lẻ, `boolean` cho đúng/sai, `String` cho chữ. Đủ 90% trường hợp.

## 3. Kiểu tham chiếu (reference) — String, object…

Ngoài 8 primitive, mọi thứ còn lại là **kiểu tham chiếu**: `String`, mảng, và các object bạn tạo. Khác biệt cốt lõi:

- **Primitive** lưu **trực tiếp giá trị** (ví dụ số 25).
- **Reference** biến chỉ lưu **địa chỉ** trỏ tới object nằm ở nơi khác trong bộ nhớ (heap).

```java
int a = 25;            // a chứa thẳng số 25
String s = "Nam";      // s chứa "địa chỉ" trỏ tới chuỗi "Nam"
```

> Điều này giải thích vì sao so sánh String phải dùng `.equals()` chứ không phải `==` (xem bài 06). Nhớ điểm này — phỏng vấn hay hỏi.

## 4. `String` — chuỗi ký tự (dùng cực nhiều)

```java
String hoTen = "Nguyễn Văn Nam";
System.out.println(hoTen.length());        // độ dài: 15
System.out.println(hoTen.toUpperCase());   // IN HOA
System.out.println(hoTen.substring(0, 6)); // "Nguyễn"
String chao = "Xin chào " + hoTen;         // nối chuỗi bằng dấu +
```

- Chuỗi đặt trong **nháy kép** `"..."`; ký tự đơn dùng **nháy đơn** `'A'`.
- Nối chuỗi bằng `+`. Số cộng chuỗi sẽ tự biến thành chuỗi: `"Tuổi: " + 25` → `"Tuổi: 25"`.

## 5. Hằng số — `final`

Muốn giá trị **không đổi được nữa**, thêm `final`:

```java
final double VAT = 0.1;   // gán 1 lần, sửa lại là lỗi
// VAT = 0.2;             // ❌ lỗi biên dịch
```

Hằng thường đặt tên **VIẾT HOA**: `MAX_SIZE`, `PI`.

## 6. `var` — để Java tự suy kiểu (Java 10+)

```java
var tuoi = 25;          // Java hiểu là int
var ten = "Nam";        // Java hiểu là String
```

- `var` **không phải** "kiểu động" — kiểu vẫn cố định, chỉ là bạn khỏi gõ ra. Chỉ dùng được cho biến cục bộ **có gán giá trị ngay**.

## 7. Ép kiểu (casting)

```java
double d = 9.7;
int i = (int) d;        // ép double → int: i = 9 (CẮT phần lẻ, không làm tròn)

int a = 5;
double b = a;           // int → double: tự động (an toàn, không mất mát)
```

- Từ nhỏ → lớn (`int`→`double`): **tự động**.
- Từ lớn → nhỏ (`double`→`int`): phải **ép tay** `(int)` và có thể **mất dữ liệu**.

## 8. Nhập / xuất cơ bản

```java
import java.util.Scanner;               // đặt ở đầu file

Scanner sc = new Scanner(System.in);
System.out.print("Nhập tuổi: ");
int tuoi = sc.nextInt();                // đọc số nguyên từ bàn phím
System.out.println("Năm sau bạn " + (tuoi + 1) + " tuổi");
```

---

## 🧪 Tự thử

1. Khai báo biến cho: tên (String), tuổi (int), chiều cao mét (double), đã đi làm chưa (boolean). In tất cả ra.
2. Tính diện tích hình chữ nhật: khai báo `dai`, `rong` rồi in `dai * rong`.
3. Ép một `double = 3.99` sang `int` và in ra — xem nó ra 3 hay 4 (hiểu vì sao).
4. Dùng `Scanner` cho người dùng nhập 2 số rồi in tổng.

> Xong? Qua **bài 02 · Toán tử & điều khiển luồng**.
