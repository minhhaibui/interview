# 03 · Method (Hàm)

> Method = một đoạn code có tên, làm một việc, gọi lại được nhiều lần. Giúp chia chương trình thành các phần nhỏ, dễ đọc, khỏi lặp code.

---

## 1. Khai báo & gọi method

```java
public class Demo {
    // Khai báo method
    static int cong(int a, int b) {
        return a + b;
    }

    public static void main(String[] args) {
        int kq = cong(3, 5);        // GỌI method, kq = 8
        System.out.println(kq);
    }
}
```

Cấu trúc: `KiểuTrảVề tênMethod(tham số) { thân method }`

| Phần | Ý nghĩa |
|------|---------|
| `int` (kiểu trả về) | Method này trả về một `int`. Nếu **không trả gì** → dùng `void`. |
| `cong` | Tên method (camelCase, thường là **động từ**: `tinhTong`, `layTen`). |
| `(int a, int b)` | **Tham số** — dữ liệu đưa vào. |
| `return a + b;` | Trả kết quả về nơi gọi. Gặp `return` là method kết thúc. |

## 2. `void` — method không trả về gì

```java
static void chao(String ten) {
    System.out.println("Xin chào " + ten);
    // không có return
}

chao("Nam");    // Xin chào Nam
```

## 3. Vì sao nên tách method? (tư duy quan trọng)

Thay vì viết một `main` dài 200 dòng, tách thành nhiều method nhỏ:

```java
static double tinhBmi(double kg, double m) {
    return kg / (m * m);
}
static String xepLoai(double bmi) {
    if (bmi < 18.5) return "Gầy";
    if (bmi < 25)   return "Bình thường";
    return "Thừa cân";
}
```

→ Mỗi method làm **một việc**, tên nói rõ nó làm gì, tái sử dụng & test dễ. Đây là bước đầu của "code sạch".

## 4. Nạp chồng method (overloading)

Cùng **tên** method nhưng **khác tham số** (số lượng hoặc kiểu) → Java coi là các method khác nhau:

```java
static int cong(int a, int b)         { return a + b; }
static double cong(double a, double b){ return a + b; }
static int cong(int a, int b, int c)  { return a + b + c; }

cong(1, 2);        // gọi bản int
cong(1.5, 2.5);    // gọi bản double
cong(1, 2, 3);     // gọi bản 3 tham số
```

> Java tự chọn đúng bản dựa trên đối số bạn truyền. Đây gọi là **overloading** — hay hỏi phỏng vấn (phân biệt với **overriding** ở bài 05).

## 5. `static` là gì? (giải thích cho người mới)

- Method có `static` → gọi được **trực tiếp** qua tên class, **không cần tạo object**. `main` luôn `static`.
- Method **không** `static` (gọi là method của thể hiện) → phải tạo object mới gọi được (học ở bài 04).
- Giai đoạn này (chưa học object), cứ để các method phụ là `static` để `main` gọi được.

## 6. ⭐ Truyền tham trị (pass-by-value) — điểm CỰC hay hỏi

Java **luôn truyền BẢN SAO của giá trị** vào method:

```java
static void tang(int x) { x = x + 100; }

int a = 5;
tang(a);
System.out.println(a);   // vẫn 5! (method sửa bản sao, không đụng a)
```

Nhưng với **object/mảng** (kiểu tham chiếu), bản sao đó là **bản sao của địa chỉ** — vẫn trỏ tới cùng object, nên **sửa nội dung object thì thấy được**:

```java
static void doi(int[] arr) { arr[0] = 999; }

int[] m = {1, 2, 3};
doi(m);
System.out.println(m[0]);   // 999! (sửa nội dung mảng qua địa chỉ)
```

> Nhớ: Java **luôn** pass-by-value. Với object, cái được sao chép là **tham chiếu (địa chỉ)**, không phải object. Câu này gài rất nhiều người.

---

## 🧪 Tự thử

1. Viết method `boolean laNguyenTo(int n)` kiểm tra số nguyên tố, gọi thử với vài số.
2. Viết method `int max(int a, int b)` trả về số lớn hơn.
3. Overload `dienTich`: một bản cho hình vuông `dienTich(int canh)`, một bản cho chữ nhật `dienTich(int dai, int rong)`.
4. Kiểm chứng pass-by-value: viết method cố đổi giá trị một `int` truyền vào, in ra thấy biến gốc không đổi.

> Xong? Qua **bài 04 · OOP: Class & Object** — trái tim của Java.
