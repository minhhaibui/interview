# ☕ Java Backend — Tài liệu học để đi làm

> Bộ tài liệu **đọc để HIỂU** (không chỉ luyện quiz). Bám khung [JavaGuide](https://javaguide.cn) — cẩm nang phỏng vấn Java được dùng nhiều nhất. Đọc doc ở đây, rồi vào tab **🧠 Tư duy → ☕ Java / ☁️ Redis** để tự kiểm tra.

> ⚠️ **CHƯA BIẾT NHIỀU JAVA?** Track này **giả định bạn đã biết cú pháp** (nó ở trình độ phỏng vấn). Người mới hãy học track **☕ Java nền tảng (từ số 0)** TRƯỚC — dạy từ Hello World → OOP → SOLID → tổ chức project — rồi mới quay lại đây.

## Cách học hiệu quả

1. **Đọc doc theo thứ tự** dưới đây — mỗi bài đi từ "vì sao" đến "cụ thể" đến "câu phỏng vấn hay hỏi".
2. Đọc xong một mảng → làm **quiz ☕ Java** lọc đúng chủ đề đó. Câu nào sai sẽ vào **🔁 Ôn câu sai**.
3. Trước buổi phỏng vấn → làm **🎓 Thi thử** (đề trộn có tính giờ) để đo phong độ.

## Mục lục

**Java core**
| # | Bài | Nội dung cốt lõi |
|---|-----|------------------|
| 01 | **JVM & Bộ nhớ** | Heap/Stack/Metaspace, class loading, GC, tham chiếu, leak vs OOM |
| 02 | **Concurrency** | Thread, JMM, volatile/synchronized, khoá, thread pool, CAS |
| 03 | **Collections** | HashMap nội bộ, ConcurrentHashMap, List/Set/Map chọn cái nào |
| 04 | **Spring & JPA** | IoC/DI, bean lifecycle, AOP, @Transactional, N+1 |
| 12 | **Java hiện đại** | Lambda/Stream/Optional (Java 8), record, sealed + switch expression, var, virtual thread (Loom) |

**Hệ sinh thái backend** (bám JavaGuide)
| # | Bài | Nội dung cốt lõi |
|---|-----|------------------|
| 05 | **MySQL** | Index B+Tree, clustered index, back-to-table lookup, isolation, MVCC, khoá, EXPLAIN |
| 06 | **Redis** | Kiểu dữ liệu, RDB/AOF, cache penetration/breakdown/avalanche, khoá phân tán, HA |
| 07 | **Mạng** | TCP handshake, TCP vs UDP, HTTPS/TLS, HTTP 1.1/2/3 |
| 08 | **Hệ phân tán & MQ** | Kafka, delivery semantics, CAP, transaction phân tán, Snowflake |
| 09 | **HĐH & I/O models** | Process/thread, 5 mô hình I/O, select/poll/epoll, zero-copy (Netty/Kafka) |
| 10 | **Docker & Kubernetes** | Container vs VM, image layer, Pod/Deployment/Service, probe, HPA, stateless |

**Kỹ năng đi làm**
| # | Bài | Nội dung cốt lõi |
|---|-----|------------------|
| 11 | **Testing** | JUnit 5 (lifecycle, assertThrows), Mockito (mock/spy, stub vs verify, @InjectMocks), Spring test (@WebMvcTest/@SpringBootTest/@DataJpaTest) |

> Mỗi bài kết bằng phần **"Câu hỏi phỏng vấn hay gặp"** để bạn tự trả lời trước khi xem đáp án trong quiz. **Đủ 12 bài** — đọc theo thứ tự để nắm chắc nền tảng.

## Lộ trình gợi ý (nếu ít thời gian)

- **Sắp phỏng vấn (1 tuần):** đọc phần "Câu hỏi hay gặp" cuối mỗi bài + làm 🎓 Thi thử mỗi ngày.
- **Học chắc gốc (1 tháng):** đọc trọn từng bài, tự code lại ví dụ, rồi quiz.

---

*Tài liệu này là bản đọc; phần luyện tập tương ứng nằm ở tab 🧠 Tư duy trong app.*
