# 12 · Java hiện đại — Lambda, Stream, Optional, record → Virtual Thread

> Java 8 (2014) là bước ngoặt lớn nhất của ngôn ngữ; Java 17/21 LTS mang thêm `record`, `sealed`, virtual thread. Phỏng vấn RẤT hay hỏi "Java 8 có gì mới?" và "biết gì về Java 17/21?". Đọc xong làm quiz **☕ Java** chủ đề *Java 8+* và *Java mới*.

---

## 1. Lambda & Functional Interface (Java 8)

- **Functional interface** = interface có **đúng 1 abstract method** (SAM). Đánh dấu `@FunctionalInterface` để compiler kiểm hộ.
- **Lambda** là cách viết gọn implementation của SAM — thay cho anonymous class dài dòng.

```java
// Trước Java 8
Runnable r1 = new Runnable() { public void run() { System.out.println("hi"); } };
// Java 8+
Runnable r2 = () -> System.out.println("hi");
Comparator<User> byAge = (a, b) -> a.age() - b.age();   // hoặc Comparator.comparingInt(User::age)
```

Bộ functional interface chuẩn trong `java.util.function` — nhớ 4 anh lớn:

| Interface | Ký hiệu | Dùng khi |
|---|---|---|
| `Function<T,R>` | T → R | biến đổi giá trị (map) |
| `Predicate<T>` | T → boolean | kiểm điều kiện (filter) |
| `Consumer<T>` | T → void | tiêu thụ (forEach) |
| `Supplier<T>` | () → T | sản xuất/lazy (orElseGet) |

**Method reference** `User::getName` = lambda `u -> u.getName()` — dùng khi lambda chỉ gọi đúng 1 method.

---

## 2. Stream API — xử lý collection kiểu khai báo

```java
List<String> top3 = users.stream()
    .filter(u -> u.age() >= 18)          // trung gian (lazy)
    .sorted(Comparator.comparing(User::score).reversed())
    .map(User::name)                      // trung gian (lazy)
    .limit(3)
    .collect(Collectors.toList());        // TERMINAL — lúc này mới chạy
```

Điểm hay bị hỏi:

- **Lazy:** thao tác trung gian (`filter/map/sorted…`) KHÔNG chạy gì cho tới khi gặp **terminal** (`collect/forEach/count/reduce/findFirst…`). Stream đã dùng terminal rồi thì **không dùng lại được** (ném `IllegalStateException`).
- **Không đổi nguồn:** stream không sửa collection gốc — nó tạo pipeline giá trị mới (khác `sort()` in-place của List).
- **`Collectors` hay dùng:** `toList()`, `toMap(k, v)`, `groupingBy(User::dept)`, `joining(", ")`, `counting()`.
- **`parallelStream()`**: chia việc cho ForkJoinPool chung — CHỈ lợi khi dữ liệu lớn + phép tính nặng + không side-effect; với list nhỏ hoặc I/O nó thường CHẬM hơn và khó lường. Đừng dùng theo phản xạ.
- **Đừng lạm dụng:** vòng `for` thường vẫn hợp lý khi logic nhiều nhánh, cần index, hoặc cần break sớm phức tạp.

---

## 3. Optional — thay thế "trả về null"

`Optional<T>` là hộp CÓ THỂ rỗng — buộc người gọi xử lý trường hợp thiếu giá trị ngay tại chỗ, thay vì NPE nổ ở nơi khác.

```java
Optional<User> u = repo.findByEmail(email);          // repository trả Optional, KHÔNG trả null
String name = u.map(User::name).orElse("khách");     // biến đổi + mặc định
User user  = u.orElseThrow(() -> new NotFoundException(email)); // hoặc ném lỗi rõ ràng
```

- `orElse(x)` — x **luôn được tính** kể cả khi có giá trị; `orElseGet(supplier)` — chỉ tính khi rỗng → dùng `orElseGet` nếu tạo mặc định tốn kém.
- **Anti-pattern:** `opt.get()` không kiểm tra (NPE kiểu mới); dùng Optional làm **field/tham số** (chỉ nên làm **kiểu trả về**); `Optional.of(null)` (ném NPE — muốn bọc giá trị có thể null phải dùng `ofNullable`).

---

## 4. `record` (Java 16) — data class bất biến

```java
record Point(int x, int y) { }
// Compiler TỰ sinh: constructor, x(), y(), equals(), hashCode(), toString()
```

- Field là `final` — **bất biến**, không có setter. Hợp cho DTO, value object, key của Map, message giữa các tầng.
- Vẫn viết thêm được: method, static factory, **compact constructor** để validate:

```java
record Range(int lo, int hi) {
    Range { if (lo > hi) throw new IllegalArgumentException("lo > hi"); }
}
```

- Khác `class` thường: không kế thừa class khác (đã ngầm extends `Record`), không thêm được instance field ngoài header.
- So với Lombok `@Data`: record là **ngôn ngữ chuẩn**, bất biến thật; Lombok sinh mutable bean (getter/setter) qua xử lý annotation.

---

## 5. `sealed`, switch expression, `var`

### `sealed` (Java 17) — kế thừa có kiểm soát
```java
sealed interface Shape permits Circle, Square { }
record Circle(double r) implements Shape { }
record Square(double a) implements Shape { }
```
Chỉ các class được `permits` mới implement được → compiler BIẾT đủ mọi nhánh con, kết hợp pattern matching khỏi cần `default`:

```java
double area(Shape s) {
    return switch (s) {                 // thiếu 1 nhánh là compile error — exhaustive
        case Circle c -> Math.PI * c.r() * c.r();
        case Square q -> q.a() * q.a();
    };
}
```

### switch expression (Java 14)
- `switch` **trả về giá trị**, mũi tên `->` không fall-through, `yield` cho block dài. Hết cảnh quên `break`.

### `var` (Java 10)
- **Suy luận kiểu lúc COMPILE** cho biến cục bộ — vẫn static typing 100%, không phải dynamic như JS. Chỉ dùng được khi khai báo + gán ngay, không dùng cho field/tham số. Dùng khi kiểu đã rõ rành rành (`var list = new ArrayList<User>()`), tránh khi vế phải mù mờ.

---

## 6. Virtual Thread (Java 21) — Project Loom

- Thread thường (platform thread) = 1:1 với thread OS — nặng (~1MB stack), tạo vài nghìn là đuối → phải dùng thread pool.
- **Virtual thread** do JVM quản lý, rất nhẹ — tạo **hàng triệu** cũng được. Khi virtual thread **block trên I/O**, JVM tự "tháo" (unmount) nó khỏi carrier thread để carrier chạy việc khác → concurrency cao mà vẫn viết code blocking dễ đọc, không cần reactive/callback.

```java
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    ids.forEach(id -> executor.submit(() -> fetchUser(id)));   // mỗi task 1 virtual thread
}
```

- **Hợp:** tác vụ **I/O-bound** số lượng lớn (gọi HTTP, chờ DB) — mô hình thread-per-request sống lại.
- **KHÔNG lợi:** tác vụ **CPU-bound** (số core không đổi); code `synchronized` giữ lock lâu có thể "ghim" (pin) virtual thread vào carrier (dùng `ReentrantLock` thay thế nếu gặp).
- Spring Boot 3.2+: `spring.threads.virtual.enabled=true` là mỗi request chạy trên virtual thread.

---

## Câu hỏi phỏng vấn hay gặp

1. **Java 8 có gì mới quan trọng nhất?** — Lambda + functional interface, Stream API, Optional, default method trong interface, java.time.
2. **Thao tác trung gian và terminal của Stream khác gì nhau?** — Trung gian lazy trả stream mới; terminal kích hoạt chạy cả pipeline và kết thúc stream.
3. **Khi nào KHÔNG nên dùng parallelStream?** — Dữ liệu nhỏ, phép tính nhẹ, có side-effect/thứ tự quan trọng, hoặc trong môi trường đã nhiều thread (web server) vì dùng chung ForkJoinPool.
4. **orElse vs orElseGet?** — orElse luôn tính đối số; orElseGet chỉ gọi supplier khi Optional rỗng.
5. **record khác class thường thế nào, khi nào dùng?** — Bất biến, tự sinh equals/hashCode/toString; hợp DTO/value object; không dùng khi cần mutable state hay kế thừa.
6. **sealed giải quyết vấn đề gì?** — Giới hạn ai được kế thừa → mô hình hoá tập nhánh đóng, switch pattern matching exhaustive không cần default.
7. **var có làm Java thành dynamic typing không?** — Không; kiểu chốt lúc compile, chỉ là đỡ gõ lại kiểu.
8. **Virtual thread khác platform thread ra sao, khi nào dùng?** — JVM-managed, siêu nhẹ, unmount khi block I/O; dùng cho I/O-bound tải cao; không tăng tốc CPU-bound.
