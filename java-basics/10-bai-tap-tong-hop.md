# 10 · Bài tập tổng hợp — Ứng dụng "Quản lý sinh viên"

> Gộp mọi thứ đã học (class, ArrayList, method, vòng lặp, Scanner, exception) thành **một chương trình chạy được**. Đây là cách nhớ lâu nhất: **làm thật**. Gõ theo từng bước, đừng copy cả cục.

Chương trình cho phép: thêm sinh viên, xem danh sách, tìm theo tên, tính điểm trung bình lớp — qua một menu console.

---

## Bước 1 — Class `SinhVien` (áp dụng bài 04)

Mỗi sinh viên có tên, tuổi, điểm. Đóng gói field `private`, cho constructor và method:

```java
public class SinhVien {
    private String ten;
    private double diem;

    public SinhVien(String ten, double diem) {
        this.ten = ten;
        this.diem = diem;
    }

    public String getTen()  { return ten; }
    public double getDiem() { return diem; }

    public String xepLoai() {                 // hành vi của object
        if (diem >= 8) return "Giỏi";
        if (diem >= 5) return "Đạt";
        return "Chưa đạt";
    }

    @Override
    public String toString() {                // để in object cho đẹp
        return ten + " — điểm " + diem + " (" + xepLoai() + ")";
    }
}
```

> `toString()` là method của mọi object (kế thừa từ `Object`); **override** nó để `System.out.println(sv)` in ra chuỗi ta muốn thay vì mã băm khó hiểu.

## Bước 2 — Lưu danh sách bằng `ArrayList` (áp dụng bài 07)

Số sinh viên thay đổi → dùng `ArrayList`, không dùng mảng cố định:

```java
import java.util.ArrayList;
import java.util.List;

List<SinhVien> danhSach = new ArrayList<>();
danhSach.add(new SinhVien("Nam", 8.5));
danhSach.add(new SinhVien("Lan", 6.0));
```

## Bước 3 — Các method xử lý (áp dụng bài 03)

Mỗi việc một method, nhận `List` làm tham số:

```java
static void inDanhSach(List<SinhVien> ds) {
    if (ds.isEmpty()) { System.out.println("(trống)"); return; }
    for (int i = 0; i < ds.size(); i++)
        System.out.println((i + 1) + ". " + ds.get(i));   // gọi toString()
}

static SinhVien timTheoTen(List<SinhVien> ds, String ten) {
    for (SinhVien sv : ds)
        if (sv.getTen().equalsIgnoreCase(ten)) return sv;  // so chuỗi bằng equals!
    return null;                                           // không thấy
}

static double diemTrungBinh(List<SinhVien> ds) {
    if (ds.isEmpty()) return 0;
    double tong = 0;
    for (SinhVien sv : ds) tong += sv.getDiem();
    return tong / ds.size();
}
```

> Nhớ bài 07: so sánh tên dùng `.equals()`/`.equalsIgnoreCase()`, **không** dùng `==`.

## Bước 4 — Menu + nhập liệu + bắt lỗi (áp dụng bài 02 & 08)

```java
import java.util.Scanner;

public class QuanLySinhVien {
    public static void main(String[] args) {
        List<SinhVien> ds = new ArrayList<>();
        Scanner sc = new Scanner(System.in);

        while (true) {                                   // vòng lặp menu
            System.out.println("\n1. Thêm  2. Xem  3. Tìm  4. ĐTB lớp  0. Thoát");
            System.out.print("Chọn: ");
            String chon = sc.nextLine();

            switch (chon) {
                case "1" -> {
                    System.out.print("Tên: ");
                    String ten = sc.nextLine();
                    try {
                        System.out.print("Điểm: ");
                        double diem = Double.parseDouble(sc.nextLine());
                        if (diem < 0 || diem > 10)
                            throw new IllegalArgumentException("Điểm phải 0–10");
                        ds.add(new SinhVien(ten, diem));
                        System.out.println("✓ Đã thêm");
                    } catch (NumberFormatException e) {
                        System.out.println("✗ Điểm phải là số");
                    } catch (IllegalArgumentException e) {
                        System.out.println("✗ " + e.getMessage());
                    }
                }
                case "2" -> inDanhSach(ds);
                case "3" -> {
                    System.out.print("Tên cần tìm: ");
                    SinhVien sv = timTheoTen(ds, sc.nextLine());
                    System.out.println(sv != null ? sv : "Không tìm thấy");
                }
                case "4" -> System.out.printf("ĐTB lớp: %.2f%n", diemTrungBinh(ds));
                case "0" -> { System.out.println("Tạm biệt!"); return; }
                default  -> System.out.println("Lựa chọn không hợp lệ");
            }
        }
    }
    // dán 3 method ở Bước 3 vào đây (cùng class, đều static)
}
```

> Điểm hay: dùng `try/catch` để chương trình **không sập** khi người dùng gõ điểm sai; `throw` để chặn điểm vô lý (bài 08). `switch ->` gọn (bài 02).

## Bước 5 — Chạy thử

Đặt `SinhVien.java` và `QuanLySinhVien.java` (mỗi public class một file — bài 05) cùng thư mục:

```bash
javac SinhVien.java QuanLySinhVien.java
java QuanLySinhVien
```

Thử: thêm vài sinh viên, gõ điểm "abc" xem có bị bắt lỗi không, xem danh sách, tính ĐTB.

---

## Bạn vừa dùng lại toàn bộ track!

| Khái niệm | Dùng ở đâu |
|-----------|------------|
| Biến & kiểu (01) | `String ten`, `double diem` |
| Điều khiển luồng (02) | `while`, `switch`, `if` xếp loại |
| Method (03) | `inDanhSach`, `timTheoTen`, `diemTrungBinh` |
| Class & đóng gói (04) | `SinhVien` private field + getter |
| Override (05) | `toString()`, `@Override` |
| Collections (07) | `ArrayList<SinhVien>`, `.equalsIgnoreCase` |
| Exception (08) | `try/catch`, `throw`, `parseDouble` |

## 🧪 Tự nâng cấp (làm để giỏi hơn)

1. Thêm chức năng **xoá** sinh viên theo tên (dùng `ds.removeIf(...)` hoặc tìm rồi `ds.remove(sv)`).
2. Thêm **sắp xếp** danh sách theo điểm giảm dần (`ds.sort((a,b) -> Double.compare(b.getDiem(), a.getDiem()))`).
3. Đếm số sinh viên mỗi xếp loại bằng `HashMap<String,Integer>`.
4. Tách riêng một class `QuanLy` chứa các method (áp dụng **Single Responsibility** — bài 06 SOLID): `main` chỉ lo menu, `QuanLy` lo dữ liệu.
5. **Thử thách:** biến nó thành REST API bằng Spring Boot sau khi học track ☕ Java Backend.

---

> 🎉 Hoàn thành **toàn bộ track Java nền tảng**! Giờ bạn viết được một chương trình Java hoàn chỉnh. Bước tiếp: track **☕ Java Backend (để đi làm)** + quiz **🧠 Tư duy → ☕ Java**.
