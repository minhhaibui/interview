# 09 · Tổ chức project & Cầu nối sang phỏng vấn

> Bài cuối track nền tảng: cách một project Java thật được tổ chức, công cụ build (Maven), và bạn nên học tiếp gì.

---

## 1. `package` & `import` — sắp xếp code

- **package** = thư mục gom các class liên quan, tránh trùng tên. Đặt ở **dòng đầu** file:

```java
package com.myshop.service;      // file nằm ở thư mục com/myshop/service/

public class OrderService { }
```

- Dùng class ở package khác → **import**:

```java
import com.myshop.model.User;    // hoặc java.util.List, java.util.ArrayList
```

- Quy ước tên package: **ngược tên miền** + module: `com.tencongty.tenduan.tinhnang`.

## 2. Access modifier — phạm vi truy cập

| Modifier | Truy cập được từ |
|----------|------------------|
| `public` | mọi nơi |
| `protected` | cùng package + class con |
| *(mặc định, không ghi)* | cùng package |
| `private` | chỉ trong class đó |

> Nguyên tắc: **để hẹp nhất có thể** (thường `private` cho field, `public` cho method cần lộ). Đây là "đóng gói" (bài 04) ở mức tổ chức.

## 3. Maven — công cụ build & quản lý thư viện

Project Java thật gần như luôn dùng **Maven** (hoặc Gradle) để: tải thư viện, biên dịch, đóng gói, chạy test. Trái tim là file **`pom.xml`**:

```xml
<project>
    <groupId>com.myshop</groupId>       <!-- tổ chức -->
    <artifactId>shop-api</artifactId>   <!-- tên project -->
    <version>1.0.0</version>

    <dependencies>
        <dependency>                    <!-- khai báo thư viện cần -->
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
    </dependencies>
</project>
```

Lệnh hay dùng:

```bash
mvn compile        # biên dịch
mvn test           # chạy test
mvn package        # đóng gói thành file .jar
mvn spring-boot:run  # chạy app Spring Boot
```

> Chỉ cần khai `dependency` trong `pom.xml`, Maven **tự tải** thư viện từ mạng về (Maven Central). Không phải copy file .jar thủ công.

## 4. Cấu trúc thư mục chuẩn (Maven)

```
shop-api/
├── pom.xml
└── src/
    ├── main/
    │   ├── java/com/myshop/        ← code chính (.java)
    │   └── resources/              ← file cấu hình (application.yml)
    └── test/
        └── java/com/myshop/        ← code test
```

## 5. Cách ĐỌC HIỂU code người khác (kỹ năng đi làm)

1. Tìm **`main`** (hoặc class có `@SpringBootApplication`) — điểm khởi động.
2. Xem cấu trúc package: thường có **`controller`** (nhận request) → **`service`** (xử lý nghiệp vụ) → **`repository`** (truy cập DB) → **`model/entity`** (dữ liệu).
3. Lần theo một tính năng: request vào Controller nào → gọi Service nào → đụng DB ở Repository nào.
4. Đọc `pom.xml` để biết project dùng thư viện gì (Spring? MyBatis? Kafka?).

> Ba lớp **Controller / Service / Repository** chính là áp dụng **Single Responsibility** (bài 06 SOLID) ở quy mô project.

## 6. Bạn đã học xong nền tảng! Học tiếp gì?

Giờ bạn đã nắm: cú pháp, OOP, SOLID, collections, exception, tổ chức project. **Đây là lúc bước sang track phỏng vấn.**

### Lộ trình đề xuất

| Bước | Học ở đâu trong app |
|------|---------------------|
| 1. Ôn chắc nền tảng | Quiz **🧠 Tư duy → ☕ Java** (lọc chủ đề core, OOP) |
| 2. Hiểu sâu máy ảo & bộ nhớ | Track **☕ Java Backend → 01 JVM & bộ nhớ** |
| 3. Đa luồng | **02 Concurrency** |
| 4. Cấu trúc dữ liệu bên trong | **03 Collections** (HashMap hoạt động thế nào) |
| 5. Framework đi làm | **04 Spring & JPA** + quiz MyBatis |
| 6. Nền backend | **05 MySQL → 10 Docker/K8s** |
| 7. Luyện phản xạ | 🎓 **Thi thử** (đề trộn tính giờ) trước buổi phỏng vấn |

### Lời khuyên cuối

- **Code mỗi ngày** — làm hết phần "🧪 Tự thử". Đọc suông không đủ.
- Làm một **project nhỏ** (API quản lý sản phẩm với Spring Boot) — học nhanh gấp nhiều lần.
- Sai câu quiz nào → nó vào **🔁 Ôn câu sai**, ôn lại đến khi đúng.

---

## 🧪 Tự thử

1. Tạo project Maven (dùng IntelliJ: New Project → Maven), viết `Hello` in ra màn hình, chạy `mvn package`.
2. Đặt code vào package `com.demo`, tạo class ở package con `com.demo.util`, `import` và dùng nó.
3. Mở một project Java open-source bất kỳ trên GitHub, tìm `main` và vẽ sơ đồ Controller→Service→Repository của một tính năng.
4. Tự lên kế hoạch: 2 tuần tới đọc track Backend bài nào, ngày nào.

> 🎉 **Hoàn thành track nền tảng!** Qua **☕ Java Backend (để đi làm)** để lên trình phỏng vấn.
