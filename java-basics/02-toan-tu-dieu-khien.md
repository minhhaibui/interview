# 02 · Toán tử & Điều khiển luồng

> "Điều khiển luồng" = quyết định code chạy theo hướng nào (nếu… thì…) và lặp lại việc gì đó.

---

## 1. Toán tử số học

```java
int a = 7, b = 2;
a + b   // 9
a - b   // 5
a * b   // 14
a / b   // 3   ⚠️ CHIA NGUYÊN (int / int) → bỏ phần lẻ!
a % b   // 1   (phần dư — rất hay dùng: chẵn/lẻ, chia hết)
```

> ⚠️ Bẫy kinh điển: `7 / 2 = 3` (không phải 3.5) vì cả hai là `int`. Muốn ra 3.5 phải có số thực: `7.0 / 2` hoặc `(double) a / b`.

```java
a % 2 == 0   // true nếu a chẵn
```

## 2. Tăng/giảm & gán rút gọn

```java
int x = 5;
x++;        // x = 6 (tăng 1)
x--;        // giảm 1
x += 3;     // x = x + 3
x *= 2;     // x = x * 2
```

## 3. Toán tử so sánh (kết quả là boolean)

```java
==   // bằng          (chú ý: 2 dấu =, KHÁC dấu gán =)
!=   // khác
>  <  >=  <=
```

> `=` là **gán**, `==` là **so sánh**. Nhầm là lỗi phổ biến nhất của người mới.

## 4. Toán tử logic

```java
&&   // VÀ   (cả hai đúng mới đúng)
||   // HOẶC (một trong hai đúng là đúng)
!    // PHỦ ĐỊNH (đảo true↔false)

boolean duocVao = tuoi >= 18 && coVe;
```

## 5. `if / else if / else`

```java
int diem = 75;
if (diem >= 80) {
    System.out.println("Giỏi");
} else if (diem >= 50) {
    System.out.println("Đạt");
} else {
    System.out.println("Trượt");
}
```

- Điều kiện trong `()` phải là **boolean**.
- Java xét **từ trên xuống**, gặp nhánh đúng đầu tiên thì chạy rồi thoát.

## 6. `switch` — nhiều nhánh theo giá trị

```java
int thu = 3;
switch (thu) {
    case 2 -> System.out.println("Thứ Hai");
    case 3 -> System.out.println("Thứ Ba");
    default -> System.out.println("Ngày khác");
}
```

- Cú pháp `->` (switch mới, Java 14+) gọn và **không bị "rơi" (fall-through)** như `case:` cũ.
- `default` chạy khi không case nào khớp.

## 7. Vòng lặp `for` — lặp số lần biết trước

```java
for (int i = 1; i <= 5; i++) {
    System.out.println("Lần " + i);
}
// In: Lần 1 ... Lần 5
```

Đọc `for (khởi tạo; điều kiện; bước nhảy)`:
1. `int i = 1` — chạy 1 lần lúc đầu.
2. `i <= 5` — kiểm tra trước mỗi vòng; còn đúng thì chạy tiếp.
3. `i++` — chạy sau mỗi vòng.

### for-each — duyệt danh sách (gọn, hay dùng)

```java
int[] diem = {8, 6, 9};
for (int d : diem) {           // "với mỗi d trong diem"
    System.out.println(d);
}
```

## 8. Vòng lặp `while` — lặp khi chưa biết số lần

```java
int n = 10;
while (n > 0) {
    System.out.println(n);
    n--;                       // ⚠️ phải làm điều kiện tiến tới sai, không là lặp vô tận!
}
```

- `do { } while (đk);` — chạy **ít nhất 1 lần** rồi mới kiểm tra.

## 9. `break` và `continue`

```java
for (int i = 1; i <= 10; i++) {
    if (i == 5) break;         // THOÁT hẳn vòng lặp
    if (i % 2 == 0) continue;  // BỎ QUA phần còn lại, nhảy vòng kế
    System.out.println(i);     // in 1, 3
}
```

---

## 🧪 Tự thử

1. In các số từ 1 đến 20; số nào chia hết cho 3 thì in "Fizz" thay vì số.
2. Nhập một số, dùng `if` in ra "chẵn" hay "lẻ" (dùng `% 2`).
3. Tính tổng 1 + 2 + … + 100 bằng vòng `for`.
4. Cho mảng `{5, 2, 9, 1, 7}`, dùng for-each tìm **số lớn nhất**.
5. Dùng `while` đếm ngược từ 5 về 1 rồi in "Bắt đầu!".

> Xong? Qua **bài 03 · Method**.
