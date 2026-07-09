# 06 · SOLID — 5 nguyên lý viết OOP tốt

> SOLID là 5 nguyên lý thiết kế hướng đối tượng (Robert C. Martin) giúp code **dễ sửa, dễ mở rộng, dễ test, ít hỏng lan**. Đây là câu phỏng vấn **kinh điển** — hiểu qua ví dụ, đừng học vẹt.

**S**ingle Responsibility · **O**pen/Closed · **L**iskov Substitution · **I**nterface Segregation · **D**ependency Inversion

---

## S — Single Responsibility (Đơn nhiệm)

> **Một class chỉ nên có MỘT lý do để thay đổi** — tức làm một nhiệm vụ.

❌ Class ôm đồm nhiều việc:

```java
class User {
    void save() { /* lưu DB */ }
    void sendEmail() { /* gửi mail */ }
    void exportPdf() { /* xuất PDF */ }   // quá nhiều trách nhiệm!
}
```

Sửa cách gửi mail lại phải đụng vào class `User` → dễ làm hỏng phần lưu DB.

✅ Tách theo trách nhiệm:

```java
class User { /* chỉ dữ liệu user */ }
class UserRepository { void save(User u) {} }     // lo lưu trữ
class EmailService   { void send(User u) {} }     // lo gửi mail
class PdfExporter    { void export(User u) {} }   // lo xuất PDF
```

→ Mỗi class một việc, sửa cái này không ảnh hưởng cái kia. Đây là lý do trong Spring bạn thấy tách `Controller` / `Service` / `Repository`.

---

## O — Open/Closed (Mở để mở rộng, đóng với sửa đổi)

> **Thêm tính năng mới bằng cách VIẾT THÊM code, không SỬA code cũ đã chạy ổn.**

❌ Thêm loại mới phải sửa `if/else` cũ (dễ gây lỗi hồi quy):

```java
class DienTich {
    double tinh(Object hinh) {
        if (hinh instanceof HinhTron t)  return 3.14 * t.r * t.r;
        if (hinh instanceof HinhVuong v) return v.canh * v.canh;
        // thêm hình mới → lại sửa method này 😖
        return 0;
    }
}
```

✅ Dùng đa hình: mỗi hình tự tính, thêm hình mới **không đụng** code cũ:

```java
interface Hinh { double dienTich(); }
class HinhTron  implements Hinh { double r;    public double dienTich(){ return 3.14*r*r; } }
class HinhVuong implements Hinh { double canh; public double dienTich(){ return canh*canh; } }
// Thêm HinhTamGiac: chỉ viết class mới, KHÔNG sửa ai cả ✅

double tong(Hinh[] ds){ double s=0; for(Hinh h: ds) s+=h.dienTich(); return s; }
```

---

## L — Liskov Substitution (Thay thế Liskov)

> **Object class con phải THAY được class cha mà chương trình vẫn chạy đúng** — con không được phá vỡ "hợp đồng" của cha.

❌ Vi phạm kinh điển — Hình vuông kế thừa Hình chữ nhật:

```java
class HinhChuNhat {
    int dai, rong;
    void setDai(int d){ dai=d; }
    void setRong(int r){ rong=r; }
}
class HinhVuong extends HinhChuNhat {
    void setDai(int d){ dai=rong=d; }   // ép dài=rộng → phá kỳ vọng của cha!
    void setRong(int r){ dai=rong=r; }
}
```

Code kỳ vọng `setDai(5); setRong(4);` → diện tích 20, nhưng `HinhVuong` cho 16 → **sai âm thầm** khi thay cha bằng con.

✅ Đừng ép quan hệ kế thừa sai. Nếu con không thật sự "là một" cha theo đúng hành vi → tách riêng/ dùng interface. **Kế thừa phải giữ đúng hành vi cha mong đợi.**

---

## I — Interface Segregation (Tách nhỏ interface)

> **Đừng ép một class phải cài các method nó không dùng.** Nhiều interface nhỏ tốt hơn một interface to.

❌ Interface "béo":

```java
interface May {
    void in();
    void scan();
    void fax();
}
class MayInGiaRe implements May {
    public void in()   { /* ok */ }
    public void scan() { throw new UnsupportedOperationException(); }  // không hỗ trợ mà buộc cài 😖
    public void fax()  { throw new UnsupportedOperationException(); }
}
```

✅ Tách thành interface nhỏ, class cài đúng cái nó làm được:

```java
interface MayIn   { void in(); }
interface MayScan { void scan(); }

class MayInGiaRe    implements MayIn {}               // chỉ in
class MayDaNang     implements MayIn, MayScan {}      // in + scan
```

---

## D — Dependency Inversion (Đảo ngược phụ thuộc)

> **Phụ thuộc vào INTERFACE (trừu tượng), không phụ thuộc class cụ thể.** Module cấp cao không nên "dính chết" vào chi tiết cấp thấp.

❌ Service dính chặt vào một class cụ thể:

```java
class MySQLDatabase { void luu(String s){} }
class UserService {
    private MySQLDatabase db = new MySQLDatabase();   // khoá cứng vào MySQL 😖
    void dangKy(String u){ db.luu(u); }               // đổi sang Postgres/mock test → phải sửa
}
```

✅ Phụ thuộc interface, "tiêm" cài đặt cụ thể từ ngoài vào:

```java
interface Database { void luu(String s); }
class MySQLDatabase    implements Database { public void luu(String s){} }
class PostgresDatabase implements Database { public void luu(String s){} }

class UserService {
    private final Database db;
    UserService(Database db){ this.db = db; }          // tiêm phụ thuộc (DI)
    void dangKy(String u){ db.luu(u); }
}

new UserService(new MySQLDatabase());     // hoặc Postgres, hoặc bản giả để test
```

> Đây chính là nền tảng của **Dependency Injection** trong Spring (`@Autowired`). Nhờ D, bạn đổi DB hay viết test dễ dàng mà không sửa `UserService`.

---

## Tóm tắt 1 dòng mỗi nguyên lý

| | Nguyên lý | Nhớ nhanh |
|--|-----------|-----------|
| **S** | Single Responsibility | 1 class = 1 việc = 1 lý do để đổi |
| **O** | Open/Closed | Thêm code mới, đừng sửa code cũ |
| **L** | Liskov | Con phải thay được cha mà không sai |
| **I** | Interface Segregation | Interface nhỏ, đừng ép cài method thừa |
| **D** | Dependency Inversion | Phụ thuộc interface, không phụ thuộc class cụ thể |

> SOLID không phải luật cứng — là **kim chỉ nam**. Đừng lạm dụng (over-engineer) cho bài toán nhỏ. Nhưng hiểu chúng giúp bạn giải thích được "vì sao code này tổ chức thế" khi phỏng vấn.

---

## 🧪 Tự thử

1. Tìm trong code cũ của bạn một class làm nhiều việc → tách theo **S**.
2. Viết `interface ThanhToan { void tra(double tien); }` với 2 cài đặt `Momo`, `TheTinDung`. Một class `DonHang` nhận `ThanhToan` qua constructor (áp **D** + **O**: thêm cổng thanh toán mới không sửa `DonHang`).
3. Giải thích ví dụ Hình vuông/Hình chữ nhật vi phạm **L** thế nào.
4. Tự đọc lại code mình từng viết, chỉ ra 1 chỗ vi phạm SOLID.

> Xong? Qua **bài 07 · String, Mảng & Collections**.
