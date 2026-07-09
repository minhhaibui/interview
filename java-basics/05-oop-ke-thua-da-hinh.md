# 05 · OOP phần 2 — Kế thừa, Đa hình & Interface

> Ba khái niệm này giúp code **dùng lại** và **linh hoạt**. Hiểu chắc là qua được 3/4 câu OOP khi phỏng vấn.

---

## 1. Kế thừa (Inheritance) — dùng lại code của class cha

Dùng `extends`: class con **thừa hưởng** field + method của class cha, khỏi viết lại.

```java
public class DongVat {
    String ten;
    void an() { System.out.println(ten + " đang ăn"); }
}

public class Cho extends DongVat {      // Cho "là một" DongVat
    void sua() { System.out.println(ten + " sủa gâu gâu"); }
}

Cho c = new Cho();
c.ten = "Milu";
c.an();      // kế thừa từ DongVat → "Milu đang ăn"
c.sua();     // riêng của Cho
```

- Quan hệ kế thừa là quan hệ **"là một"** (is-a): Chó *là một* Động vật.
- Java **chỉ kế thừa 1 class cha** (đơn kế thừa). Muốn nhiều "khả năng" → dùng interface (mục 4).

## 2. `super` và `@Override`

```java
public class DongVat {
    void keu() { System.out.println("..."); }
}
public class Meo extends DongVat {
    @Override
    void keu() {                          // GHI ĐÈ method của cha
        System.out.println("Meo meo");
    }
}
```

- **`@Override`**: viết đè lại method của cha (cùng tên, cùng tham số). Annotation này giúp trình biên dịch báo lỗi nếu bạn viết sai chữ ký.
- **`super.keu()`** gọi bản của **cha**; `super(...)` trong constructor gọi constructor cha.

> **Overriding vs Overloading** (hay hỏi):
> - **Override**: class con viết **đè** method cùng chữ ký của cha (đa hình lúc chạy).
> - **Overload**: cùng tên, **khác tham số**, trong cùng class (bài 03).

## 3. ⭐ Đa hình (Polymorphism) — cùng lời gọi, nhiều hành vi

Biến kiểu **cha** có thể trỏ tới object **con**, và khi gọi method, Java chạy bản của **object thật**:

```java
DongVat dv;              // kiểu cha
dv = new Cho();  dv.keu();   // chạy bản của Cho
dv = new Meo();  dv.keu();   // chạy bản của Meo — "Meo meo"

// Sức mạnh: xử lý CHUNG nhiều loại
DongVat[] ds = { new Cho(), new Meo() };
for (DongVat d : ds) d.keu();     // mỗi con kêu theo cách riêng
```

> Đây là lý do đa hình mạnh: code viết theo kiểu **cha/trừu tượng**, chạy đúng hành vi của từng loại con. Thêm loài mới **không phải sửa** vòng lặp trên.

## 4. Interface — "hợp đồng" về khả năng

`interface` khai báo **những method phải có**, không nói làm thế nào. Class `implements` thì **bắt buộc** cài đủ.

```java
public interface CoTheBay {
    void bay();                     // chỉ khai báo, không thân
}

public class Chim implements CoTheBay {
    public void bay() { System.out.println("Chim vỗ cánh bay"); }
}
public class MayBay implements CoTheBay {
    public void bay() { System.out.println("Máy bay dùng động cơ"); }
}
```

- Một class **implements được NHIỀU interface** (khắc phục việc chỉ extends 1 class).
- Interface là quan hệ **"có khả năng"** (can-do): Chim *có thể* bay.
- Dùng interface làm kiểu để code linh hoạt (tiêm phụ thuộc — nền tảng của Spring sau này):

```java
CoTheBay x = new MayBay();
x.bay();
```

## 5. `abstract class` — nửa giữa

`abstract class` vừa có method **đã cài sẵn** (chung), vừa có method **abstract** (bắt con cài):

```java
public abstract class Hinh {
    abstract double dienTich();          // con phải tự tính
    void in() { System.out.println("Diện tích: " + dienTich()); }  // dùng chung
}
public class HinhTron extends Hinh {
    double r;
    double dienTich() { return Math.PI * r * r; }
}
```

- Không thể `new Hinh()` (nó trừu tượng) — chỉ new class con cụ thể.

### Interface vs Abstract class — chọn cái nào?

| | interface | abstract class |
|--|-----------|----------------|
| Ý nghĩa | "CÓ KHẢ NĂNG" (can-do) | "LÀ MỘT LOẠI" (is-a) |
| Đa kế thừa | implements **nhiều** | extends **một** |
| Có state (field) | Không (chỉ hằng) | Có |
| Khi nào | Nhiều class không liên quan cùng có 1 khả năng | Các class họ hàng chia sẻ code chung |

---

## 🧪 Tự thử

1. Tạo class cha `NhanVien` (field `ten`, `luongCoBan`, method `tinhLuong()`), hai class con `NhanVienChinhThuc` (+ thưởng) và `CongTacVien` (theo giờ) **override** `tinhLuong()`.
2. Cho mảng `NhanVien[]` chứa cả hai loại, dùng vòng lặp in lương từng người (thấy đa hình hoạt động).
3. Tạo interface `CoTheLuu` có method `luu()`, cho 2 class không liên quan (`File`, `Database`) implements.
4. Tự trả lời: khi nào dùng interface, khi nào abstract class?

> Xong? Qua **bài 06 · SOLID** — 5 nguyên lý viết OOP tốt.
