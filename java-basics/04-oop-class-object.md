# 04 · OOP phần 1 — Class & Object

> **OOP** (lập trình hướng đối tượng) là cách tổ chức code quanh các "đối tượng" mô phỏng thực tế. Đây là linh hồn của Java — hiểu chắc phần này là hiểu Java.

---

## 1. Class và Object — khác nhau thế nào?

- **Class** = bản thiết kế (khuôn). Ví dụ: bản vẽ "Xe hơi".
- **Object** = sản phẩm thật tạo từ khuôn. Ví dụ: chiếc xe cụ thể của bạn, của tôi (từ cùng bản vẽ).

```java
// CLASS = khuôn
public class SinhVien {
    String ten;      // thuộc tính (field)
    int tuoi;
}

// tạo OBJECT từ khuôn
SinhVien sv1 = new SinhVien();   // 'new' tạo một object mới
sv1.ten = "Nam";
sv1.tuoi = 20;

SinhVien sv2 = new SinhVien();   // object khác, độc lập
sv2.ten = "Lan";
```

- `field` (thuộc tính): dữ liệu của object (`ten`, `tuoi`).
- `new` tạo object trong bộ nhớ và trả về **tham chiếu** gán vào biến.
- Mỗi object có bộ dữ liệu **riêng**: sửa `sv1` không ảnh hưởng `sv2`.

## 2. Method của object — hành vi

Ngoài dữ liệu, object có **hành vi** (method):

```java
public class SinhVien {
    String ten;
    int diemToan, diemVan;

    double diemTrungBinh() {          // method KHÔNG static
        return (diemToan + diemVan) / 2.0;
    }
    void gioiThieu() {
        System.out.println("Tôi là " + ten + ", ĐTB " + diemTrungBinh());
    }
}

SinhVien sv = new SinhVien();
sv.ten = "Nam"; sv.diemToan = 8; sv.diemVan = 6;
sv.gioiThieu();          // Tôi là Nam, ĐTB 7.0
```

> Method của object **không** có `static` — vì nó làm việc trên dữ liệu **của một object cụ thể** (`this`). Gọi qua `object.method()`.

## 3. Constructor — khởi tạo object gọn gàng

Gán từng field như trên rất dài. **Constructor** cho phép truyền dữ liệu ngay khi tạo:

```java
public class SinhVien {
    String ten;
    int tuoi;

    // Constructor: cùng tên class, KHÔNG có kiểu trả về
    public SinhVien(String ten, int tuoi) {
        this.ten = ten;        // this.ten = field; ten = tham số
        this.tuoi = tuoi;
    }
}

SinhVien sv = new SinhVien("Nam", 20);   // gọn!
```

- **`this`** = "object hiện tại". `this.ten = ten` nghĩa là gán tham số `ten` vào field `ten` của object.
- Nếu bạn **không viết** constructor nào, Java tự cho một constructor rỗng mặc định. Khi đã viết constructor có tham số, muốn có bản rỗng phải tự thêm.

## 4. ⭐ Đóng gói (Encapsulation) — trụ cột số 1 của OOP

Để `field` là `public` thì ai cũng sửa lung tung được:

```java
sv.tuoi = -5;    // vô lý nhưng không bị chặn!
```

**Đóng gói**: che field bằng `private`, chỉ cho truy cập qua method **getter/setter** có kiểm soát:

```java
public class TaiKhoan {
    private double soDu;                 // private: bên ngoài KHÔNG đụng trực tiếp

    public double getSoDu() {            // getter: đọc
        return soDu;
    }
    public void napTien(double tien) {   // method có kiểm tra
        if (tien > 0) soDu += tien;      // chặn giá trị vô lý
    }
}

TaiKhoan tk = new TaiKhoan();
// tk.soDu = -100;      ❌ lỗi: soDu là private
tk.napTien(500);        // ✅ qua method hợp lệ
System.out.println(tk.getSoDu());   // 500
```

> **Vì sao đóng gói?** Bảo vệ dữ liệu khỏi bị đặt sai, và cho phép đổi cách lưu bên trong mà không ảnh hưởng nơi dùng. Đây là lý do bạn thấy class nào cũng `private` field + getter/setter.

## 5. Bốn trụ cột OOP (tổng quan — sẽ gặp lại)

| Trụ cột | Nghĩa | Học ở |
|---------|-------|-------|
| **Đóng gói** (Encapsulation) | Che dữ liệu, truy cập qua method | Bài này |
| **Kế thừa** (Inheritance) | Class con dùng lại class cha | Bài 05 |
| **Đa hình** (Polymorphism) | Cùng lời gọi, nhiều hành vi | Bài 05 |
| **Trừu tượng** (Abstraction) | Ẩn chi tiết, chỉ lộ cái cần | Bài 05 |

---

## 🧪 Tự thử

1. Tạo class `HinhChuNhat` có field `dai`, `rong`, method `dienTich()` và `chuVi()`.
2. Thêm constructor `HinhChuNhat(double dai, double rong)`. Tạo 2 object với kích thước khác nhau, in diện tích mỗi cái.
3. Tạo class `TaiKhoan` với `soDu` private, method `napTien`, `rutTien` (chặn rút quá số dư), `getSoDu`. Thử rút quá số dư xem có bị chặn không.
4. Giải thích cho chính mình: vì sao `sv1` và `sv2` có `ten` khác nhau dù cùng class?

> Xong? Qua **bài 05 · Kế thừa, Đa hình & Interface**.
