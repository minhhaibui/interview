# 11 · Testing — JUnit 5, Mockito & Spring Test

> Gần như mọi JD Java backend đều yêu cầu **viết unit test**. Nắm JUnit 5 + Mockito là bắt buộc; biết test tầng Spring (slice test) là điểm cộng lớn. Đọc xong làm quiz **☕ Java** chủ đề *Testing*.

---

## 1. Vì sao & test cái gì — kim tự tháp test

```
        /\        ít, chậm, đắt — E2E (cả hệ thống)
       /  \
      /----\      vừa — Integration (nhiều thành phần thật: DB, HTTP)
     /      \
    /--------\    NHIỀU, nhanh, rẻ — Unit (một class, mock dependency)
```

- **Unit test:** kiểm 1 đơn vị (thường 1 class) **cô lập** — dependency được **mock**. Nhanh (mili giây), tất định, chạy hàng nghìn cái mỗi lần build.
- **Integration test:** ghép nhiều thành phần thật (service + DB thật/Testcontainers). Chậm hơn, bắt được lỗi ở ranh giới (mapping SQL, serialize JSON).
- **Nguyên tắc:** viết NHIỀU unit test, ÍT e2e. Đừng test getter/setter hay code framework — test **logic nghiệp vụ** và **nhánh rẽ** (edge case, lỗi).

---

## 2. JUnit 5 — khung chạy test

### Vòng đời & cấu trúc AAA
```java
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @BeforeAll  static void initShared() { /* chạy 1 LẦN trước tất cả — phải static */ }
    @BeforeEach void reset()            { /* chạy trước MỖI @Test — dựng trạng thái sạch */ }

    @Test
    void withdraw_should_reduce_balance() {
        // Arrange — chuẩn bị dữ liệu
        var acc = new Account(100);
        // Act — gọi hành vi cần test
        acc.withdraw(30);
        // Assert — khẳng định kết quả
        assertEquals(70, acc.getBalance());
    }
}
```
> `@BeforeAll`/`@AfterAll` chạy **một lần** ở mức class (mặc định phải `static`, trừ khi đặt `@TestInstance(Lifecycle.PER_CLASS)`). `@BeforeEach`/`@AfterEach` chạy lại quanh **mỗi** test để các test không ảnh hưởng nhau.

### Assertion & test exception
```java
assertEquals(70, acc.getBalance());
assertTrue(list.isEmpty());
assertAll( () -> assertEquals(1, a), () -> assertEquals(2, b) ); // gom nhiều assert

// Test method NÉM exception — assertThrows trả về chính exception để assert message
var ex = assertThrows(IllegalArgumentException.class,
        () -> acc.withdraw(-1));
assertEquals("số tiền phải > 0", ex.getMessage());
```
> `assertThrows(...)` là cách của JUnit **5**. Thuộc tính `@Test(expected = ...)` là cú pháp JUnit **4** (đã bỏ) và không assert được message.

### Test tham số hoá (đỡ lặp)
```java
@ParameterizedTest
@ValueSource(ints = {-1, 0, -999})
void reject_non_positive(int amount) {
    assertThrows(IllegalArgumentException.class, () -> acc.withdraw(amount));
}
```

---

## 3. Mockito — giả lập dependency

### mock vs spy
| | `mock(T.class)` / `@Mock` | `spy(obj)` / `@Spy` |
|---|---|---|
| Bản chất | Đối tượng **giả hoàn toàn** | **Bọc** object thật |
| Method chưa stub | Trả **default**: `null`/`0`/`false`/collection rỗng | **Gọi code thật** |
| Dùng khi | Cô lập hẳn dependency (thường dùng) | Cần chạy phần lớn code thật, chỉ ghi đè vài method |

### Stub (chuẩn bị) vs Verify (kiểm hành vi)
```java
@Mock  UserRepository repo;
@Mock  EmailClient email;
@InjectMocks  UserService service;   // repo + email được TIÊM vào service thật

@Test
void register_should_save_and_notify() {
    // STUB — dàn dựng đầu vào cho kịch bản (when/thenReturn)
    when(repo.existsByEmail("a@x.com")).thenReturn(false);
    when(repo.save(any(User.class))).thenAnswer(i -> i.getArgument(0));

    service.register("a@x.com");

    // VERIFY — khẳng định TƯƠNG TÁC đã xảy ra (đúng số lần, đúng tham số)
    verify(repo).save(argThat(u -> u.getEmail().equals("a@x.com")));
    verify(email, times(1)).sendWelcome("a@x.com");
    verify(email, never()).sendAlert(any());
}
```
- **Stubbing** (`when(...).thenReturn`) = chuẩn bị **trạng thái/giá trị trả về**.
- **Verification** (`verify(...)`) = kiểm **hành vi/tương tác**. Với method `void` chỉ có cách verify (và `doThrow`/`doNothing` để stub).
- **`@InjectMocks`** tạo instance **thật** của lớp cần test rồi tiêm các `@Mock` (ưu tiên constructor). Nhờ đó test logic mà cô lập khỏi DB/HTTP.
- Ở JUnit 5 cần `@ExtendWith(MockitoExtension.class)` để annotation có hiệu lực.

### Argument matcher & bẫy thường gặp
```java
when(repo.find(anyLong())).thenReturn(user);   // matcher
// ⚠ Nếu 1 tham số dùng matcher thì TẤT CẢ phải là matcher:
when(svc.pay(eq("a"), anyInt())).thenReturn(true); // dùng eq("a"), KHÔNG để "a" trần
```
> Khi stub **spy**, dùng `doReturn(x).when(spy).foo()` thay vì `when(spy.foo()).thenReturn(x)` — cú pháp sau sẽ **gọi thật** `foo()` ngay lúc stub.

---

## 4. Test tầng Spring — full context vs slice

| Annotation | Nạp gì | Dùng khi |
|---|---|---|
| `@SpringBootTest` | **Toàn bộ** ApplicationContext | Integration test đầu-cuối; kèm `webEnvironment = RANDOM_PORT` + `TestRestTemplate` để gọi HTTP thật |
| `@WebMvcTest(XController.class)` | Chỉ tầng web (controller, filter, `@ControllerAdvice`) + `MockMvc` | Test controller cô lập — service `@MockBean` |
| `@DataJpaTest` | Chỉ tầng JPA (repository + H2 in-memory, rollback tự động) | Test repository/truy vấn |

```java
@WebMvcTest(OrderController.class)
class OrderControllerTest {
    @Autowired MockMvc mvc;
    @MockBean  OrderService service;      // thay bean thật bằng mock trong context

    @Test
    void get_order_returns_200() throws Exception {
        when(service.find(1L)).thenReturn(new Order(1L, "PAID"));
        mvc.perform(get("/orders/1"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.status").value("PAID"));
    }
}
```
- **Slice test** (`@WebMvcTest`/`@DataJpaTest`) chỉ nạp một lát cắt → **nhanh hơn nhiều** so với `@SpringBootTest`. Ưu tiên slice; để integration test cho luồng quan trọng.
- `@MockBean` thay một bean trong context bằng mock (khác `@Mock` thuần Mockito không đụng context Spring).
- Cần DB/Kafka/Redis **thật** trong integration test → dùng **Testcontainers** (khởi container Docker thật, tất định hơn H2).

---

## 5. Nguyên tắc viết test tốt

- **AAA / Given-When-Then:** tách rõ chuẩn bị — hành động — khẳng định.
- **Đặt tên nói ý định:** `withdraw_moreThanBalance_throws()` thay vì `test1()`.
- **Mỗi test một lý do thất bại:** một hành vi / một nhánh; đừng nhồi nhiều assert vô quan.
- **Độc lập & tất định:** không phụ thuộc thứ tự chạy, không dùng `now()`/random/DB chung không reset → tránh test *flaky*.
- **Test hành vi, không test hiện thực:** đừng verify từng lời gọi nội bộ đến mức đổi refactor là gãy test.
- **Đo phủ nhưng đừng thờ phượng coverage:** 80% có nghĩa nếu đúng nhánh quan trọng; 100% mà bỏ edge case thì vô ích.

---

## Câu hỏi phỏng vấn hay gặp

1. **Khác nhau giữa `@BeforeAll` và `@BeforeEach`?** Vì sao `@BeforeAll` phải `static`?
2. **`mock()` khác `spy()` thế nào?** Method chưa stub của mỗi loại trả về gì?
3. **Phân biệt stubbing (`when/thenReturn`) và verification (`verify`)** — cái nào kiểm trạng thái, cái nào kiểm hành vi? Test method `void` thì làm sao?
4. **`@Mock` + `@InjectMocks` phối hợp ra sao?** Ở JUnit 5 cần annotation gì để chúng hoạt động?
5. **Test method ném exception** trong JUnit 5 viết thế nào? Khác gì JUnit 4?
6. **`@SpringBootTest` khác `@WebMvcTest`/`@DataJpaTest`?** Khi nào chọn slice test, khi nào cần full context?
7. **Test flaky là gì**, thường do đâu (thời gian, thứ tự, tài nguyên chung), cách tránh?
8. **Vì sao mock repository thay vì đụng DB thật** trong unit test? Khi nào cần DB thật (Testcontainers)?

> Trả lời miệng trước, rồi mở tab 🧠 Tư duy → mode **☕ Java** làm phần *Testing* để tự chấm.
