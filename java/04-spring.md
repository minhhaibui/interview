# 04 · Spring & JPA — Java Backend

> 90% việc làm Java backend dùng **Spring**. Hiểu IoC/AOP/transaction là bắt buộc. Đọc xong làm quiz **☕ Java** chủ đề *Spring* & *JPA*.

---

## 1. IoC & DI — trái tim của Spring

**IoC (Inversion of Control):** đảo ngược quyền điều khiển — thay vì object **tự tạo** dependency (`new`), **container** tạo và đưa vào.

**DI (Dependency Injection):** cách hiện thực IoC — "tiêm" dependency vào bean.

```java
// KHÔNG dùng DI — coupling chặt, khó test
class OrderService {
    private PaymentClient client = new PaymentClient(); // tự new
}

// Dùng DI — container tiêm vào, dễ mock khi test
@Service
class OrderService {
    private final PaymentClient client;
    OrderService(PaymentClient client) { this.client = client; } // constructor injection
}
```

**Lợi ích:** dễ test (tiêm mock), giảm phụ thuộc cụ thể, cấu hình tập trung.

### Kiểu injection — nên dùng constructor

| Kiểu | Ưu | Nhược |
|------|----|-------|
| **Constructor** ✅ | Bất biến (final), phát hiện thiếu dependency & vòng tròn sớm, dễ test | Nhiều tham số thì dài |
| Setter | Linh hoạt, đổi được | Object có thể chưa đủ dependency |
| Field (`@Autowired` field) | Ngắn | Khó test, ẩn dependency, không final |

### `@Autowired` vs `@Resource`

- `@Autowired` (Spring): khớp theo **kiểu** (byType); nhiều bean cùng kiểu → `@Qualifier("tên")` hoặc `@Primary`.
- `@Resource` (chuẩn JSR-250): khớp theo **tên** (byName) trước.

---

## 2. Vòng đời một bean

```
Instantiate → Populate (tiêm dependency) → Aware callbacks →
BeanPostProcessor.before → Init (@PostConstruct → afterPropertiesSet → init-method) →
BeanPostProcessor.after  ← (AOP proxy tạo ở đây) →
[Sử dụng] → Destroy (@PreDestroy → destroy)
```

> **AOP proxy** được tạo ở bước `postProcessAfterInitialization`. Nhớ điều này để hiểu vì sao self-invocation không được proxy (mục 4).

### Scope bean

- **singleton** (mặc định): 1 instance cho cả container → bean nên **stateless** (không giữ trạng thái mutable) để an toàn thread.
- **prototype**: mỗi lần lấy một instance mới.
- **request / session**: theo vòng đời web request/session.

---

## 3. Circular dependency (phụ thuộc vòng tròn)

A cần B, B cần A. Spring giải bằng **tam cấp cache** (three-level cache): đưa "early reference" của bean đang tạo ra sớm để bên kia dùng.

- **Field/Setter injection** vòng tròn → Spring **cứu được**.
- **Constructor injection** vòng tròn → **KHÔNG cứu được** (chưa có instance để expose) → ném `BeanCurrentlyInCreationException`.

> Đây là một lý do nữa để dùng constructor injection: nó **phát hiện sớm** thiết kế vòng tròn xấu thay vì giấu đi.

---

## 4. AOP & `@Transactional`

**AOP (Aspect-Oriented Programming):** tách "concern xuyên suốt" (log, transaction, security) ra khỏi business, chèn vào bằng **proxy**.

- Bean có **interface** → JDK dynamic proxy. Không có → **CGLIB** (kế thừa class).

### `@Transactional` THẤT BẠI khi nào (chùm câu hỏi kinh điển)

1. **Method không `public`** — proxy không chặn được.
2. **Self-invocation** — gọi `this.inner()` trong cùng class → **không đi qua proxy** → annotation vô hiệu.
   ```java
   public void outer() { this.inner(); }         // inner() KHÔNG có transaction!
   @Transactional public void inner() { ... }
   ```
   Giải: tách sang bean khác, hoặc `AopContext.currentProxy()`.
3. **Nuốt exception** — `catch` mà không ném lại → không rollback.
4. **Checked exception** — mặc định chỉ rollback với `RuntimeException`/`Error`. Checked exception phải khai `@Transactional(rollbackFor = Exception.class)`.
5. **Bean không do Spring quản lý** (tự `new`).

### Propagation (lan truyền)

- **REQUIRED** (mặc định): có transaction thì dùng chung, chưa có thì tạo.
- **REQUIRES_NEW**: luôn **tạm dừng** transaction ngoài và mở transaction **mới độc lập** (commit/rollback riêng) — hữu ích ghi audit/log cần commit dù cha rollback.

---

## 5. Spring MVC — luồng một request

```
Request → DispatcherServlet → HandlerMapping (tìm controller) →
HandlerAdapter gọi Controller → trả ModelAndView →
ViewResolver render view
   (REST: @ResponseBody → HttpMessageConverter ghi JSON thẳng, bỏ qua ViewResolver)
```

`@RestController` = `@Controller` + `@ResponseBody`.

---

## 6. Spring Boot — auto-configuration

`@SpringBootApplication` bật `@EnableAutoConfiguration` → nạp các lớp auto-config (đăng ký trong `META-INF/.../AutoConfiguration.imports`). Mỗi lớp gắn `@Conditional`:

- `@ConditionalOnClass` — có thư viện trong classpath.
- `@ConditionalOnMissingBean` — bạn chưa tự định nghĩa bean đó.
- `@ConditionalOnProperty` — có property tương ứng.

→ Thêm dependency là "chạy được ngay"; muốn override thì tự khai bean.

---

## 7. JPA / Hibernate — bẫy hiệu năng

### N+1 query (câu hỏi backend kinh điển)

Lấy N entity cha (1 query), rồi truy cập quan hệ LAZY của **từng** cha → bắn thêm N query con = **1 + N**.

**Khắc phục:** `JOIN FETCH` trong JPQL, `@EntityGraph`, hoặc `@BatchSize` để gộp.

### LAZY vs EAGER

- **LAZY**: chỉ nạp quan hệ khi truy cập (proxy) — tiết kiệm, nhưng coi chừng `LazyInitializationException` khi dùng ngoài session.
- **EAGER**: nạp ngay cùng entity cha — dễ nạp thừa/N+1.
- Mặc định: `@OneToMany` LAZY, `@ManyToOne` EAGER.

> **Thực hành tốt:** để LAZY, và chủ động `JOIN FETCH` khi thực sự cần quan hệ.

---

## 8. Câu hỏi phỏng vấn hay gặp

1. IoC và DI khác nhau thế nào? Vì sao nên dùng constructor injection?
2. Kể vòng đời một Spring bean. AOP proxy tạo ở bước nào?
3. Scope mặc định của bean? Vì sao bean nên stateless?
4. Spring giải circular dependency thế nào? Vì sao constructor injection không cứu được?
5. `@Transactional` thất bại trong những trường hợp nào? (kể ít nhất 3)
6. REQUIRED vs REQUIRES_NEW khác gì?
7. Luồng xử lý request trong Spring MVC?
8. N+1 query là gì và khắc phục ra sao?

> Làm tiếp: tab **🧠 Tư duy → ☕ Java**, các câu chủ đề *Spring* / *JPA*.
