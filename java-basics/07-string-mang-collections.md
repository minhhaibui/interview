# 07 · String, Mảng & Collections

> Ba thứ bạn dùng **hằng ngày** khi lập trình Java: chuỗi, mảng, và các cấu trúc chứa dữ liệu động (List/Map/Set).

---

## 1. String — chuỗi ký tự

### So sánh String: `==` vs `.equals()` — ⭐ bẫy phỏng vấn kinh điển

```java
String a = "hello";
String b = "hello";
String c = new String("hello");

a == b            // true  (cùng trỏ tới 1 chuỗi trong "string pool")
a == c            // FALSE (c là object mới, địa chỉ khác)
a.equals(c)       // true  (so sánh NỘI DUNG)
```

> **Luật vàng:** so sánh nội dung chuỗi **luôn dùng `.equals()`**, đừng dùng `==`. Vì `==` so sánh **địa chỉ tham chiếu**, `.equals()` so sánh **nội dung** (nhớ lại bài 01: String là kiểu tham chiếu).

### String là bất biến (immutable)

```java
String s = "abc";
s.toUpperCase();          // KHÔNG đổi s! trả về chuỗi MỚI
System.out.println(s);    // vẫn "abc"
s = s.toUpperCase();      // phải gán lại mới thấy "ABC"
```

- Mọi thao tác "sửa" chuỗi thực ra tạo **chuỗi mới**. Nối chuỗi nhiều lần trong vòng lặp → tốn bộ nhớ.
- Nối nhiều → dùng **`StringBuilder`**:

```java
StringBuilder sb = new StringBuilder();
for (int i = 0; i < 3; i++) sb.append(i).append("-");
System.out.println(sb.toString());   // "0-1-2-"
```

### Method String hay dùng

```java
s.length()          s.charAt(0)         s.substring(1, 4)
s.toUpperCase()     s.toLowerCase()     s.trim()          // bỏ khoảng trắng đầu/cuối
s.contains("ell")   s.startsWith("he")  s.replace("a","b")
s.split(",")        // "a,b,c" → mảng ["a","b","c"]
s.isEmpty()         s.equalsIgnoreCase("HELLO")
```

## 2. Mảng (Array) — nhiều phần tử CÙNG kiểu, kích thước CỐ ĐỊNH

```java
int[] diem = new int[3];       // 3 phần tử, mặc định 0
diem[0] = 8;  diem[1] = 6;  diem[2] = 9;

int[] a = {5, 2, 9, 1};        // khai báo + gán luôn
System.out.println(a.length);  // 4 (độ dài, KHÔNG có ())
System.out.println(a[0]);      // 5 (chỉ số bắt đầu từ 0)

for (int x : a) System.out.println(x);   // duyệt
```

- Chỉ số từ **0** đến `length - 1`. Vượt ra → lỗi `ArrayIndexOutOfBoundsException`.
- Mảng **không đổi kích thước** sau khi tạo. Cần thêm/bớt linh hoạt → dùng `ArrayList`.

## 3. Collections — cấu trúc dữ liệu động (dùng RẤT nhiều)

### `ArrayList` — danh sách co giãn (thay mảng khi cần thêm/bớt)

```java
import java.util.ArrayList;
import java.util.List;

List<String> ten = new ArrayList<>();
ten.add("Nam");            // thêm
ten.add("Lan");
ten.get(0);                // "Nam" (lấy theo chỉ số)
ten.size();                // 2
ten.remove("Nam");         // xoá
ten.contains("Lan");       // true

for (String t : ten) System.out.println(t);
```

- `List<String>` — `<String>` là **generic**: quy định list chỉ chứa String (an toàn kiểu). Dùng `<Integer>`, `<Double>`… cho kiểu khác (số phải là kiểu bao: `Integer` không phải `int`).

### `HashMap` — cặp khoá → giá trị (như từ điển)

```java
import java.util.HashMap;
import java.util.Map;

Map<String, Integer> tuoi = new HashMap<>();
tuoi.put("Nam", 20);           // khoá "Nam" → giá trị 20
tuoi.put("Lan", 22);
tuoi.get("Nam");               // 20
tuoi.containsKey("Lan");       // true
tuoi.getOrDefault("X", 0);     // 0 nếu không có khoá

for (Map.Entry<String, Integer> e : tuoi.entrySet())
    System.out.println(e.getKey() + " = " + e.getValue());
```

- Tra cứu theo khoá **cực nhanh**. Khoá **không trùng** (put trùng khoá → ghi đè).

### `HashSet` — tập hợp, KHÔNG trùng lặp

```java
import java.util.HashSet;
import java.util.Set;

Set<String> s = new HashSet<>();
s.add("a"); s.add("a"); s.add("b");
System.out.println(s.size());   // 2 (bỏ trùng tự động)
```

### Chọn cái nào? (bảng nhớ nhanh)

| Cần | Dùng |
|-----|------|
| Danh sách có thứ tự, cho trùng, truy cập theo vị trí | `ArrayList` |
| Tra cứu theo khoá (id → object) | `HashMap` |
| Tập hợp không trùng | `HashSet` |
| Mảng kích thước cố định, hiệu năng cao | `int[]` |

> Chi tiết HashMap hoạt động bên trong thế nào (hash, bucket, treeify) → xem track **☕ Java Backend → 03 Collections**. Giờ chỉ cần biết **dùng**.

---

## 🧪 Tự thử

1. Cho `String s = "  Xin Chao  "`, in ra: độ dài sau `trim()`, bản IN HOA, và tách `"a,b,c".split(",")`.
2. Chứng minh bẫy `==`: tạo `new String("hi")` so với literal `"hi"` bằng `==` và `.equals()`.
3. Dùng `ArrayList<Integer>` thêm 5 số, tính tổng và trung bình.
4. Dùng `HashMap<String,Integer>` đếm số lần xuất hiện mỗi từ trong câu `"a b a c b a"`.
5. Dùng `HashSet` lọc trùng từ mảng `{1,2,2,3,3,3}`.

> Xong? Qua **bài 08 · Xử lý lỗi (Exception)**.
