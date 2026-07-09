# 02 · Concurrency (Đa luồng) — Java Backend

> Mảng **khó và hay hỏi bậc nhất**. Backend luôn xử lý nhiều request song song → hiểu concurrency là bắt buộc. Đọc xong làm quiz **☕ Java** chủ đề *Concurrency*.

---

## 1. Thread — luồng thực thi

Một chương trình có thể chạy **nhiều luồng cùng lúc** để tận dụng nhiều nhân CPU / không phải chờ I/O.

- Mỗi thread có **stack riêng** (biến cục bộ), nhưng **chung heap** (object) → đây là gốc của mọi rắc rối đồng bộ.
- Tạo thread: implements `Runnable` (khuyên dùng) hoặc kế thừa `Thread`. Gọi `start()` (KHÔNG gọi `run()` — `run()` chạy trên thread hiện tại, không tạo thread mới).

> **Đừng tự `new Thread()` cho mỗi tác vụ** trong production → dùng **thread pool** (mục 5).

---

## 2. Vấn đề gốc: Race condition & Visibility

Khi nhiều thread cùng đọc/ghi **dữ liệu chia sẻ** trên heap, có 2 loại lỗi:

### a) Race condition (thao tác không nguyên tử)

```java
count++;  // TRÔNG như 1 lệnh, thực ra là 3: đọc count → +1 → ghi lại
```

Hai thread cùng `count++` có thể cùng đọc giá trị cũ rồi ghi đè nhau → mất một lần tăng.

### b) Visibility (khả năng nhìn thấy)

Mỗi CPU core có cache riêng. Thread A ghi biến nhưng nằm ở cache của core A → thread B (core B) **không thấy** giá trị mới, cứ đọc bản cũ.

> Hai vấn đề này khác nhau: **atomicity** (thao tác trọn vẹn) và **visibility** (thấy giá trị mới). Cần công cụ khác nhau.

---

## 3. `volatile` — chỉ giải quyết Visibility

```java
private volatile boolean running = true;  // thread khác set false → dừng
```

`volatile` đảm bảo:
- **Visibility:** mọi thread luôn đọc/ghi thẳng main memory, không dùng cache cũ.
- **Cấm sắp xếp lại lệnh** (happens-before), chống lỗi reorder.

`volatile` **KHÔNG** đảm bảo atomicity: `count++` vẫn sai dù `count` là volatile.

> **Quy tắc chọn:** cờ boolean bật/tắt đơn giản (không phụ thuộc giá trị cũ) → `volatile` là đủ. Có thao tác đọc-sửa-ghi (`i++`) → cần `synchronized` hoặc `Atomic*`.

---

## 4. `synchronized` — loại trừ lẫn nhau (mutual exclusion)

```java
public synchronized void inc() { count++; }   // khoá trên `this`
// hoặc
synchronized (lock) { ... }                    // khoá trên object `lock`
```

- Chỉ **một thread** vào được vùng `synchronized` cùng lúc → đảm bảo cả atomicity lẫn visibility.
- Ở tầng dưới: dựa trên **monitor** của object (`monitorenter`/`monitorexit`), trạng thái khoá lưu ở **Mark Word** trong object header.
- JVM tối ưu bằng **lock escalation** (nâng cấp khoá): không khoá → biased lock → lightweight lock (CAS) → heavyweight lock (mutex OS). Nên từ Java 6+ `synchronized` KHÔNG còn chậm như lời đồn.

> *Lưu ý cập nhật:* **biased locking** đã bị **tắt mặc định từ Java 15** (JEP 374) và **gỡ bỏ ở Java 18** — trên JVM mới chuỗi thực tế là lightweight (CAS) → heavyweight. Câu trả lời "biased → lightweight → heavyweight" vẫn là kinh điển cho Java 8/11, nhưng nói thêm ý này sẽ ghi điểm với interviewer khó tính.

### `ReentrantLock` — khoá linh hoạt hơn

| | synchronized | ReentrantLock |
|--|--|--|
| Nhả khoá | Tự động khi rời block | **Phải** `unlock()` trong `finally` |
| Thử khoá | Không | `tryLock()` / `tryLock(timeout)` |
| Ngắt khi chờ | Không | `lockInterruptibly()` |
| Công bằng (fair) | Không | Có tuỳ chọn |
| Nhiều điều kiện | 1 (`wait/notify`) | Nhiều `Condition` |

> Dùng `synchronized` cho phần lớn trường hợp (đơn giản, JVM tối ưu). Cần tryLock/timeout/fair/nhiều condition → `ReentrantLock`.

---

## 5. Thread Pool (`ExecutorService`) — chuẩn production

Tạo thread rất tốn kém; tạo bừa → cạn tài nguyên. **Thread pool** tái sử dụng thread.

```java
ExecutorService pool = new ThreadPoolExecutor(
    corePoolSize, maximumPoolSize, keepAliveTime, unit,
    workQueue, threadFactory, rejectedHandler);
Future<Integer> f = pool.submit(() -> 1 + 1);
```

### Thứ tự xử lý khi submit (câu hỏi kinh điển)

```
1. Còn dưới corePoolSize  → tạo core thread mới chạy ngay
2. Core đầy               → đẩy task vào workQueue (hàng đợi)
3. Queue đầy              → tạo thêm thread tới maximumPoolSize
4. Max + queue đều đầy    → chạy RejectedExecutionHandler (từ chối)
```

- **Reject policy:** `AbortPolicy` (ném exception, mặc định), `CallerRunsPolicy` (chạy ở thread gọi — giảm tốc độ nhận), `DiscardPolicy` / `DiscardOldestPolicy`.
- **TRÁNH** `Executors.newFixedThreadPool()` / `newCachedThreadPool()` trong production: hàng đợi vô hạn (dễ OOM) hoặc số thread vô hạn. Tự tạo `ThreadPoolExecutor` với **queue có giới hạn** và tham số hợp lý.

---

## 6. CAS & Atomic — lock-free

`AtomicInteger`, `AtomicLong`… tăng/giảm an toàn **không cần khoá**, dựa trên **CAS (Compare-And-Swap)**: lệnh phần cứng nguyên tử "nếu giá trị hiện tại == kỳ vọng thì cập nhật".

```java
AtomicInteger n = new AtomicInteger();
n.incrementAndGet();   // nguyên tử, không khoá
```

**Nhược điểm CAS:**
- **ABA:** giá trị đổi A→B→A, CAS tưởng chưa đổi → dùng `AtomicStampedReference` (thêm version).
- **Spin lâu** tốn CPU khi tranh chấp cao.
- Chỉ đảm bảo **một** biến.

> CAS là nền của `Atomic*` và **AQS** (AbstractQueuedSynchronizer) — bộ khung dựng nên `ReentrantLock`, `CountDownLatch`, `Semaphore`…

---

## 7. `ThreadLocal` — biến riêng mỗi thread

Mỗi thread có **bản sao riêng** của biến → tránh chia sẻ trạng thái. Dùng cho: user context per-request, `SimpleDateFormat` (vốn không thread-safe)…

> ⚠️ Trong **thread pool** phải gọi `remove()` sau khi dùng, nếu không thread bị tái sử dụng → **rò rỉ bộ nhớ** (và lẫn dữ liệu request cũ).

---

## 8. Deadlock (bế tắc)

Xảy ra khi đồng thời đủ **4 điều kiện** (Coffman): loại trừ lẫn nhau, giữ-và-chờ, không tước đoạt, chờ vòng tròn.

**Cách tránh phổ biến nhất:** luôn lấy nhiều khoá theo **MỘT thứ tự cố định** (phá "chờ vòng tròn"), hoặc dùng `tryLock` có timeout (phá "giữ-và-chờ").

---

## 9. Câu hỏi phỏng vấn hay gặp

1. `volatile` đảm bảo gì, KHÔNG đảm bảo gì? Vì sao `i++` với volatile vẫn sai?
2. Cờ boolean giữa các thread nên dùng `volatile` hay `synchronized`? Vì sao?
3. `synchronized` hoạt động ở tầng dưới thế nào (monitor, Mark Word, lock escalation)?
4. `ReentrantLock` hơn `synchronized` ở điểm nào?
5. Kể thứ tự xử lý khi submit task vào `ThreadPoolExecutor`. Vì sao tránh `newFixedThreadPool`?
6. CAS là gì? Vấn đề ABA và cách khắc phục?
7. `ThreadLocal` dùng làm gì? Vì sao phải `remove()` trong thread pool?
8. 4 điều kiện deadlock và cách phá?

> Làm tiếp: tab **🧠 Tư duy → ☕ Java**, các câu chủ đề *Concurrency*.
