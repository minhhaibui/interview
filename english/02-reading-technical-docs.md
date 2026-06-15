# Đọc hiểu tài liệu kỹ thuật — Reading Technical Documentation

> Track tiếng Anh — Lộ trình ôn phỏng vấn Backend Node.js 12 tuần
> Trình độ mục tiêu: A2-B1 → đọc docs tiếng Anh trôi chảy, không cần dịch trong đầu.

---

## Mục lục

1. [Tại sao đọc docs khó?](#1-tại-sao-đọc-docs-khó)
2. [Ngữ pháp sống còn trong docs](#2-ngữ-pháp-sống-còn-trong-docs)
3. [Chiến thuật đọc](#3-chiến-thuật-đọc)
4. [8 bài đọc thực hành](#4-8-bài-đọc-thực-hành)
5. [Lộ trình đọc thật 12 tuần](#5-lộ-trình-đọc-thật-12-tuần)

---

## 1. Tại sao đọc docs khó?

Nhiều bạn đọc tutorial tiếng Việt rất nhanh nhưng mở docs Node.js hay Kafka lên là "tụt mood". Lý do không phải bạn kém — mà vì **văn phong docs khác hẳn tiếng Anh giao tiếp**:

| Đặc điểm | Ví dụ | Vì sao khó |
|---|---|---|
| **Câu rất dài** | "If the process is spawned with an IPC channel established between the parent and child, the `subprocess.send()` method can be used to send messages to the child process." | 1 câu = 3-4 mệnh đề lồng nhau. Đọc đến cuối câu thì quên đầu câu. |
| **Passive voice dày đặc** | "The connection **is established**...", "Errors **are emitted**..." | Tiếng Việt ít dùng bị động → não phải "lật ngược" câu. |
| **Conditional khắp nơi** | "If the buffer exceeds the limit...", "Unless otherwise specified..." | Docs mô tả hành vi theo điều kiện, không kể chuyện tuyến tính. |
| **Thuật ngữ chồng thuật ngữ** | "idempotent producer", "eventual consistency", "backpressure" | Mỗi thuật ngữ lại được định nghĩa bằng... thuật ngữ khác. |
| **Danh từ hóa (nominalization)** | "the **invocation** of the callback", "upon **serialization**" | Động từ quen thuộc (invoke, serialize) bị biến thành danh từ lạ mắt. |

### Mục tiêu của file này

> **Đọc KHÔNG dịch trong đầu.**

Nghĩa là: nhìn câu "The event loop is blocked" → não hiểu ngay *event loop đang bị chặn* như một **hình ảnh/khái niệm**, chứ không phải dịch từng từ "cái vòng lặp sự kiện thì bị làm cho tắc nghẽn". Dịch trong đầu làm tốc độ đọc giảm 3-5 lần và khiến bạn kiệt sức sau 2 trang.

Cách đạt được:
1. **Học các MẪU CÂU lặp đi lặp lại** trong docs (mục 2). Docs chỉ dùng khoảng 20-30 mẫu câu — thuộc mẫu rồi thì chỉ cần điền thuật ngữ vào.
2. **Đọc nhiều, đọc đều** (mục 5). Não tự động hóa nhờ tần suất, không nhờ cố gắng.
3. **Chấp nhận hiểu 80%**. Đọc docs không phải dịch thuật — bỏ qua từ lạ nếu không cản trở ý chính.

---

## 2. Ngữ pháp sống còn trong docs

> Mỗi mục dưới đây: giải thích ngắn bằng tiếng Việt → câu ví dụ thật từ docs → phân tích cấu trúc. **Học mẫu, không học thuộc câu.**

### 2.1. Passive voice (câu bị động)

**Tại sao docs dùng nhiều:** docs mô tả *điều gì xảy ra với object/dữ liệu*, không quan tâm *ai* làm. "The connection is closed" — ai đóng không quan trọng, quan trọng là trạng thái connection.

**Công thức nhận diện:** `be (is/are/was/will be/has been) + V3 (past participle)`

**Mẹo đọc nhanh:** gặp `is/are + V-ed/V3` → hiểu là "**bị/được** + động từ", và chủ ngữ là **thứ nhận hành động**.

Ví dụ thật từ docs:

| # | Câu (văn phong docs) | Phân tích |
|---|---|---|
| 1 | "The connection **is established** before any data is sent." *(Node.js `net`)* | `is established` = được thiết lập. Hai bị động trong 1 câu: connection được thiết lập / data được gửi. |
| 2 | "Messages **are guaranteed to be delivered** in the order they were sent." *(Kafka)* | Bị động kép: `are guaranteed` (được đảm bảo) + `to be delivered` (sẽ được giao). Đọc gộp: "messages chắc chắn đến đúng thứ tự gửi". |
| 3 | "An `'error'` event **is emitted** if the stream **is destroyed** while writing." *(Node.js streams)* | Mẫu cực phổ biến: `X event is emitted if/when ...` = "sự kiện X được phát ra khi...". |
| 4 | "Keys **are evicted** when the `maxmemory` limit **is reached**." *(Redis)* | `are evicted` = bị loại bỏ (khỏi bộ nhớ). `evict` là từ "ruột" của Redis/caching. |
| 5 | "Pods **are scheduled** onto nodes by the scheduler, and **are not moved** unless deleted." *(Kubernetes)* | Bị động + phủ định: `are not moved` = không bị di chuyển. `unless deleted` = trừ khi bị xóa (rút gọn của "unless they are deleted"). |

**Bài tập nhanh:** đọc câu sau và xác định *thứ gì nhận hành động*:
"The response body **is compressed** automatically when the `Accept-Encoding` header **is provided** by the client."
→ Đáp án: body *được nén*, header *được cung cấp* (bởi client).

---

### 2.2. Conditionals (câu điều kiện)

**Tại sao docs dùng nhiều:** hành vi của hệ thống luôn phụ thuộc điều kiện — config thế nào, input ra sao, lỗi gì xảy ra.

**Các từ khóa cần thuộc lòng:**

| Từ khóa | Nghĩa | Ghi nhớ |
|---|---|---|
| `if` | nếu | điều kiện thường |
| `unless` | trừ khi (= if not) | **rất hay gặp**, dễ hiểu ngược nghĩa! |
| `when / whenever` | khi / bất cứ khi nào | điều kiện chắc chắn xảy ra |
| `once` | một khi / ngay sau khi | "Once connected, ..." = ngay sau khi kết nối xong |
| `in case (of)` | trong trường hợp | "in case of failure" = khi có lỗi |
| `provided that / as long as` | miễn là | điều kiện ràng buộc |
| `otherwise` | nếu không thì | mô tả nhánh else |

Ví dụ thật từ docs:

| # | Câu | Phân tích |
|---|---|---|
| 1 | "**If** the buffer exceeds the `highWaterMark` limit, the stream **will stop** reading from the underlying resource." *(Node.js streams)* | Conditional loại 1: `If + hiện tại, will + V`. Mô tả hành vi backpressure. |
| 2 | "**Unless otherwise specified**, all commands are executed atomically." *(Redis)* | Cụm đóng đinh trong mọi docs: "unless otherwise specified" = *trừ khi có ghi chú khác*. Gặp là hiểu ngay, không cần phân tích. |
| 3 | "**When** a consumer fails, its partitions **are reassigned** to the remaining consumers in the group." *(Kafka)* | `when` + bị động: khi consumer chết, partition được chia lại. |
| 4 | "**Once** the container exits, it is not restarted **unless** the restart policy is set to `always`." *(Docker)* | 2 điều kiện trong 1 câu: `once` (một khi) + `unless` (trừ khi). Đọc chậm câu kiểu này. |
| 5 | "The function returns a promise **if** no callback is provided; **otherwise**, the callback is invoked with the result." *(Node.js)* | Mẫu if/otherwise = if/else trong code. Map thẳng sang tư duy lập trình. |

**Bẫy hay gặp:** `unless` = "trừ khi", KHÔNG phải "nếu". "Unless you set X" = "nếu bạn KHÔNG set X". Đọc sai unless → hiểu ngược hành vi hệ thống → bug.

---

### 2.3. Modal verbs trong spec: MUST / SHOULD / MAY (RFC 2119)

**Bối cảnh:** các spec/RFC (HTTP, REST API design, Kafka protocol...) dùng modal verbs theo chuẩn **RFC 2119** — mỗi từ có mức độ bắt buộc PHÁP LÝ rõ ràng:

| Từ | Mức độ | Nghĩa khi đọc spec |
|---|---|---|
| **MUST / SHALL / REQUIRED** | Bắt buộc tuyệt đối | Không làm = vi phạm spec, hệ thống hỏng |
| **MUST NOT / SHALL NOT** | Cấm tuyệt đối | |
| **SHOULD / RECOMMENDED** | Nên làm | Được phép bỏ qua nếu có lý do chính đáng, nhưng phải hiểu hậu quả |
| **SHOULD NOT** | Không nên | |
| **MAY / OPTIONAL** | Tùy chọn | Làm hay không đều hợp lệ |

Ví dụ thật:

| # | Câu | Phân tích |
|---|---|---|
| 1 | "A server **MUST NOT** send a response body for a `HEAD` request." *(HTTP spec — RFC 9110)* | Cấm tuyệt đối. Server nào trả body cho HEAD là sai spec. |
| 2 | "Clients **SHOULD** retry the request with exponential backoff." *(AWS API guidelines)* | Khuyến nghị mạnh: nên retry với backoff, không bắt buộc nhưng rất nên. |
| 3 | "The consumer **MAY** commit offsets manually by disabling `enable.auto.commit`." *(Kafka)* | Tùy chọn — bạn được phép commit thủ công. |
| 4 | "This flag is experimental and **should not be used in production**." *(Node.js docs)* | Mẫu cảnh báo kinh điển. `should not be used in production` = đừng dùng trên production. Gặp câu này → dừng lại, đọc kỹ. |
| 5 | "Applications **must** handle the `'error'` event; otherwise, the process **will** crash." *(Node.js)* | `must` + hậu quả (`will crash`). Docs Node.js viết thường (không viết hoa) nhưng nghĩa vẫn là bắt buộc. |

**Lưu ý:** ngoài spec chính thức, docs thường dùng `must/should/may` viết thường với nghĩa nhẹ hơn một chút, nhưng thứ tự mức độ vẫn giữ nguyên: must > should > may. Còn `can` = "có khả năng / được phép", `will` = "chắc chắn sẽ xảy ra".

---

### 2.4. Relative clauses (mệnh đề quan hệ)

**Tại sao docs dùng nhiều:** để định nghĩa chính xác *object nào* đang được nói đến. Đây là nguyên nhân chính khiến câu docs dài.

**Từ nối:** `that`, `which`, `who`, `whose`, `where`, `when` — và dạng **rút gọn** (bỏ that/which, dùng V-ing/V3).

**Mẹo đọc:** gặp `that/which` → phần sau là **thông tin bổ sung mô tả danh từ ngay trước nó**. Có thể tạm "đóng ngoặc" phần đó lại, đọc câu chính trước, rồi quay lại đọc phần mô tả.

Ví dụ thật:

| # | Câu | Phân tích |
|---|---|---|
| 1 | "The child process inherits the environment of **the process that spawned it**." *(Node.js `child_process`)* | `that spawned it` mô tả `the process` → "tiến trình *(mà)* đã sinh ra nó" = tiến trình cha. |
| 2 | "A callback **which is invoked when the operation completes**." *(Node.js — khắp nơi)* | `which is invoked when...` = "(callback) được gọi khi thao tác hoàn tất". Mẫu siêu phổ biến: `a callback which/that is invoked/called when ...` |
| 3 | "A topic is a category **to which records are published**." *(Kafka)* | Giới từ + which: `to which ... are published` = "(category) mà records được publish VÀO". Khó hơn vì giới từ đứng trước. |
| 4 | "A Service routes traffic to Pods **whose labels match the selector**." *(Kubernetes)* | `whose` = "mà ... của nó": Pods *mà label của chúng* khớp selector. |
| 5 | "The number of partitions **assigned to each consumer** depends on the group size." *(Kafka)* | **Rút gọn**: `assigned to` = `which are assigned to`. Docs rút gọn rất nhiều — gặp `danh từ + V3` thì 90% là mệnh đề quan hệ rút gọn. |

**Bài tập nhanh:** tìm danh từ được mô tả: "Connections **that remain idle for more than 60 seconds** are closed automatically."
→ `that remain idle...` mô tả `Connections` → các kết nối *(mà)* rảnh quá 60 giây sẽ bị đóng.

---

### 2.5. Nominalization (danh từ hóa)

**Là gì:** biến động từ thành danh từ. `invoke` → `invocation`, `serialize` → `serialization`. Văn phong học thuật/kỹ thuật rất chuộng kiểu này.

**Tại sao khó:** bạn biết động từ `create` nhưng gặp `the creation of` lại khựng. Thực ra **nghĩa không đổi** — chỉ đổi vai trò ngữ pháp.

**Mẹo:** gặp danh từ đuôi `-tion / -sion / -ment / -ance / -al` → thử "dịch ngược" về động từ gốc, câu sẽ dễ hiểu ngay.

Bảng quy đổi hay gặp:

| Danh từ trong docs | Động từ gốc | Nghĩa |
|---|---|---|
| invocation | invoke | việc gọi (hàm) |
| serialization / deserialization | serialize | việc tuần tự hóa |
| instantiation | instantiate | việc khởi tạo (instance) |
| execution | execute | việc thực thi |
| allocation | allocate | việc cấp phát |
| termination | terminate | việc kết thúc |
| replication | replicate | việc nhân bản |
| eviction | evict | việc loại bỏ (cache) |
| invalidation | invalidate | việc vô hiệu hóa |
| deployment | deploy | việc triển khai |
| retrieval | retrieve | việc lấy (dữ liệu) |

Ví dụ thật:

| # | Câu | Phân tích — dịch ngược về động từ |
|---|---|---|
| 1 | "**The instantiation of** a new client is an expensive operation and should be done once per application." *(Redis client docs)* | = "*Instantiating* a new client is expensive" → việc tạo client mới tốn kém, chỉ tạo 1 lần. |
| 2 | "Lazy **evaluation** defers **the invocation of** the function until the result is needed." | = "...defers *invoking* the function..." → hoãn việc gọi hàm đến khi cần kết quả. |
| 3 | "**Serialization** overhead can become a bottleneck at high throughput." *(Kafka)* | = chi phí của việc *serialize* có thể thành nút cổ chai. |
| 4 | "Cache **invalidation** is triggered upon **modification of** the underlying record." | = cache bị *invalidate* khi record bị *modify*. |
| 5 | "Graceful **termination** allows in-flight requests to complete before **shutdown**." *(K8s)* | = *terminate* một cách êm: cho request đang chạy xong rồi mới tắt. |

---

### 2.6. Cấu trúc cảnh báo / lưu ý

**Tại sao quan trọng:** đây là những câu chứa thông tin "đắt" nhất trong docs — bug, edge case, hành vi bất ngờ. **Gặp các cụm này → giảm tốc độ đọc xuống 50%, đọc 2 lần.**

| Cụm từ | Nghĩa | Mức độ chú ý |
|---|---|---|
| "**Note that** ..." | Lưu ý rằng... | Trung bình — thông tin dễ bỏ sót |
| "**Keep in mind (that)** ..." | Hãy nhớ rằng... | Trung bình |
| "**It is worth noting that** ..." | Đáng chú ý là... | Trung bình |
| "**Beware of** ... / **Be aware that** ..." | Cẩn thận với... | **Cao** — thường là bẫy/bug |
| "**Caution:** / **Warning:** / **Important:**" | Cảnh báo | **Cao nhất** |
| "**However**, ... / **Note, however, that** ..." | Tuy nhiên... | Cao — đảo ngược điều vừa nói |
| "**A common pitfall is** ..." | Lỗi thường gặp là... | **Cao** — kinh nghiệm xương máu |
| "**This may lead to / result in** ..." | Điều này có thể dẫn đến... | Cao — mô tả hậu quả |

Ví dụ thật:

| # | Câu | Phân tích |
|---|---|---|
| 1 | "**Note that** the order of execution is not guaranteed when multiple promises are awaited concurrently." | Cảnh báo về thứ tự thực thi không đảm bảo — chính là loại câu hay bị hỏi trong phỏng vấn. |
| 2 | "**Keep in mind that** `KEYS` blocks the server and **should never be used in production** — use `SCAN` instead." *(Redis)* | Cảnh báo + giải pháp thay thế (`use X instead`). Mẫu rất hay gặp. |
| 3 | "**Beware of** unbounded memory growth **if** consumers cannot keep up with producers." *(Kafka)* | Beware of + danh từ + điều kiện. Đây là mô tả backpressure problem. |
| 4 | "**It is worth noting that** synchronous methods block the event loop and **may significantly degrade** performance." *(Node.js `fs`)* | `may significantly degrade` = có thể làm giảm nghiêm trọng. |
| 5 | "Setting this value too low **may result in** frequent rebalances, **which can lead to** increased latency." *(Kafka consumer config)* | Chuỗi nhân-quả: set thấp → rebalance nhiều → latency tăng. Docs hay viết chuỗi hậu quả kiểu này. |

---

## 3. Chiến thuật đọc

### 3.1. Skim structure trước (đọc khung trước, thịt sau)

**Đừng đọc docs như đọc truyện** (từ trái sang phải, trên xuống dưới). Quy trình đúng:

1. **Đọc toàn bộ headings trước** (30 giây) → vẽ trong đầu cái "mục lục": trang này nói về gì, phần nào liên quan đến thứ mình cần.
2. **Lướt qua các code blocks** → code là "ngôn ngữ mẹ đẻ" của bạn, hiểu code trước rồi text chỉ là phần giải thích thêm.
3. **Đọc các phần in đậm, Note/Warning boxes** → thông tin đắt nhất.
4. **Cuối cùng mới đọc body text**, và chỉ đọc kỹ phần liên quan trực tiếp.

### 3.2. Đọc code example TRƯỚC text

Với dev A2-B1, code example là chiếc "phao":

- Đọc code → đoán được 70% nội dung đoạn text phía trên.
- Sau đó đọc text để xác nhận + lấp 30% còn lại (edge cases, warnings).
- Tên hàm/biến trong code chính là từ vựng của đoạn văn: thấy `client.connect()` trong code thì đoạn text chắc chắn nói về "establishing a connection".

### 3.3. Đoán nghĩa từ context — KHÔNG tra từ điển vội

Quy tắc 3 bước khi gặp từ lạ:

1. **Bỏ qua, đọc tiếp hết câu/đoạn** — nhiều khi không cần từ đó vẫn hiểu ý chính.
2. **Đoán từ ngữ cảnh**: 
   - "Keys are **evicted** when memory is full" → memory đầy thì keys bị... gì đó kiểu "đuổi đi/xóa bỏ" → đoán đúng 90%.
   - Từ có gốc quen: `eviction` ← `evict`, `retrieval` ← `retrieve`.
   - Cặp tương phản: "synchronous ... whereas asynchronous ..." → 2 từ ngược nghĩa nhau.
3. **Chỉ tra từ điển khi**: (a) từ đó lặp lại ≥ 3 lần trong bài, hoặc (b) không hiểu từ đó thì cả đoạn vô nghĩa. Tra xong **ghi vào sổ từ vựng cá nhân** (xem mục 5.3).

> Lý do: dừng tra từ điển mỗi 2 phút sẽ phá vỡ mạch đọc, và bạn sẽ không bao giờ luyện được kỹ năng đoán — kỹ năng quan trọng nhất khi đọc nhanh.

### 3.4. Quy tắc "2 lượt đọc"

- **Lượt 1 — đọc lấy ý (2-3 phút/trang):** không dừng, không tra từ, gạch chân chỗ không hiểu. Mục tiêu: trả lời "trang này nói về cái gì, dùng khi nào?"
- **Lượt 2 — đọc lấy chi tiết (chỉ phần cần):** quay lại chỗ gạch chân, phân tích câu khó bằng các mẫu ngữ pháp ở mục 2, tra từ nếu đạt điều kiện ở 3.3.

---

## 4. 8 bài đọc thực hành

> Độ khó tăng dần từ Bài 1 → Bài 8. Mỗi bài: đọc đoạn văn (viết theo đúng văn phong docs thật) → trả lời câu hỏi KHÔNG nhìn lại đoạn văn → check glossary → mở đáp án.
>
> **Cách làm:** lượt 1 đọc trong thời gian gợi ý, lượt 2 đọc kỹ rồi trả lời. Trả lời bằng tiếng Anh ngắn gọn (luyện luôn cho phỏng vấn).

---

### Bài 1 — Node.js: The `fs` module *(dễ — mục tiêu: 2 phút)*

> The `fs` module enables interacting with the file system. All file system operations have synchronous, callback, and promise-based forms. The promise-based APIs are accessible via `require('node:fs/promises')`.
>
> The callback form takes a completion callback as its last argument. The first argument passed to the callback is always reserved for an exception. If the operation completes successfully, the first argument will be `null`.
>
> The synchronous forms block the Node.js event loop until the operation completes. Note that this may significantly degrade the performance of your application. Synchronous methods should be avoided in server environments; however, they are acceptable in scripts and command-line tools, where blocking is not a concern.

**Câu hỏi:**
1. The `fs` module has how many forms of APIs? Name them.
2. In the callback form, what is the first argument of the callback reserved for?
3. What happens to the event loop when you use a synchronous method?
4. According to the text, where is it acceptable to use synchronous methods?

**Glossary:**
- `enable + V-ing` — cho phép làm gì
- `is reserved for` — được dành riêng cho
- `block` (v) — chặn, làm tắc
- `degrade` (v) — làm giảm (chất lượng/hiệu năng)
- `is not a concern` — không phải là vấn đề đáng lo

<details>
<summary><b>Đáp án</b></summary>

1. Three forms: synchronous, callback, and promise-based.
2. It is reserved for an exception (the error). If the operation succeeds, it is `null`. *(Đây chính là error-first callback convention — hay bị hỏi phỏng vấn.)*
3. The event loop is blocked until the operation completes.
4. In scripts and command-line tools, where blocking is not a concern. (NOT in server environments.)

**Phân tích câu khó:** "Synchronous methods **should be avoided** in server environments" — modal + passive: "nên được tránh" = đừng dùng. Mẫu `should be avoided / should not be used` xuất hiện trong mọi docs.
</details>

---

### Bài 2 — Express: Error handling middleware *(dễ — 2 phút)*

> Error-handling middleware functions are defined in the same way as other middleware functions, except that they take four arguments instead of three: `(err, req, res, next)`. You must provide all four arguments to identify the function as an error-handling middleware, even if you do not need to use the `next` object.
>
> If you pass an error to `next()`, and you do not handle it in a custom error handler, it will be handled by the built-in error handler, which writes the error message and the stack trace to the client. The stack trace is not included in the production environment.
>
> Note that the default error handler is added at the end of the middleware stack. If you call `next(err)` after you have started writing the response, the built-in handler closes the connection and fails the request.

**Câu hỏi:**
1. How is an error-handling middleware different from a normal middleware?
2. What happens if you pass an error to `next()` but never handle it yourself?
3. Is the stack trace sent to the client in production?
4. What does the built-in handler do if you call `next(err)` after the response has already started?

**Glossary:**
- `except that` — ngoại trừ việc
- `identify ... as ...` — nhận diện ... là ...
- `built-in` — có sẵn, tích hợp sẵn
- `stack trace` — dấu vết lời gọi hàm khi lỗi
- `fails the request` — làm request thất bại

<details>
<summary><b>Đáp án</b></summary>

1. It takes **four** arguments `(err, req, res, next)` instead of three. All four must be provided.
2. The built-in (default) error handler handles it — it writes the error message and stack trace to the client.
3. No. "The stack trace is not included in the production environment."
4. It closes the connection and fails the request.

**Phân tích:** "even if you do not need to use the `next` object" — `even if` = "ngay cả khi". Khác `even though` (mặc dù — sự thật) ở chỗ `even if` là giả định.
</details>

---

### Bài 3 — Redis: Key eviction *(trung bình — 3 phút)*

> When Redis is used as a cache, it is often convenient to let it automatically evict old data as you add new data. This behavior is controlled by the `maxmemory` configuration directive, which limits the amount of memory Redis may use.
>
> When the `maxmemory` limit is reached, Redis follows the configured eviction policy. If the policy is set to `noeviction`, Redis replies with an error to write commands once the limit is reached, and read-only commands continue to be served. The `allkeys-lru` policy, on the other hand, evicts the least recently used keys first, regardless of whether an expiration is set on them.
>
> Keep in mind that the LRU implementation in Redis is approximated: rather than tracking access times for all keys, Redis samples a small number of keys and evicts the best candidate among them. This trades precision for memory efficiency.

**Câu hỏi:**
1. Which configuration directive limits Redis memory usage?
2. With the `noeviction` policy, what happens to write commands when the limit is reached? What about read commands?
3. Which keys does `allkeys-lru` evict first?
4. Why is Redis's LRU called "approximated"?
5. What does Redis trade for memory efficiency?

**Glossary:**
- `evict` (v) — loại bỏ (key khỏi bộ nhớ)
- `directive` (n) — chỉ thị cấu hình (= config option)
- `least recently used (LRU)` — ít được dùng gần đây nhất
- `regardless of whether` — bất kể có ... hay không
- `approximated` — xấp xỉ, gần đúng
- `sample` (v) — lấy mẫu
- `trade X for Y` — đánh đổi X lấy Y

<details>
<summary><b>Đáp án</b></summary>

1. The `maxmemory` configuration directive.
2. Write commands get an error reply; read-only commands continue to be served (vẫn hoạt động bình thường).
3. The least recently used keys, regardless of whether they have an expiration set.
4. Because Redis does not track access times for all keys — it samples a small number of keys and evicts the best candidate among them.
5. It trades **precision** for memory efficiency (chấp nhận kém chính xác để tiết kiệm bộ nhớ).

**Phân tích câu khó:** "**rather than** tracking access times for all keys, Redis samples..." — `rather than + V-ing` = "thay vì làm X, (chủ ngữ) làm Y". Mẫu so sánh 2 cách tiếp cận, gặp rất nhiều trong docs và system design blog.
</details>

---

### Bài 4 — Docker: Restart policies *(trung bình — 3 phút)*

> Docker provides restart policies to control whether your containers start automatically when they exit, or when the Docker daemon restarts. A restart policy only takes effect after a container starts successfully — that is, the container must run for at least 10 seconds before the policy is applied. This prevents a container which fails immediately from entering a restart loop.
>
> The `on-failure` policy restarts the container only if it exits with a non-zero exit code, and optionally accepts a maximum number of retries. The `always` policy, by contrast, restarts the container under any circumstances; however, if the container is manually stopped, it is restarted only when the daemon restarts or the container itself is manually restarted.
>
> Unless a restart policy is explicitly specified, the default policy is `no`, meaning containers are never restarted automatically.

**Câu hỏi:**
1. How long must a container run before its restart policy takes effect, and why is this rule needed?
2. When does `on-failure` restart a container?
3. With the `always` policy, what happens if you manually stop a container?
4. What is the default restart policy if you do not specify one?

**Glossary:**
- `take effect` — có hiệu lực
- `non-zero exit code` — mã thoát khác 0 (tức là lỗi)
- `by contrast` — ngược lại, trái lại
- `under any circumstances` — trong mọi hoàn cảnh
- `explicitly` — một cách tường minh, rõ ràng

<details>
<summary><b>Đáp án</b></summary>

1. At least 10 seconds. This prevents a container that fails immediately from entering a restart loop (tránh vòng lặp restart vô hạn).
2. Only when the container exits with a non-zero exit code (exit do lỗi). It can also take a max retry count.
3. It stays stopped — it is only restarted when the daemon restarts or when you manually restart it.
4. `no` — containers are never restarted automatically.

**Phân tích câu khó:** "This prevents **a container which fails immediately** from entering a restart loop" — cấu trúc `prevent X from V-ing` (ngăn X làm gì) + mệnh đề quan hệ chen giữa. Tách câu: prevent [a container (which fails immediately)] from [entering a restart loop].
</details>

---

### Bài 5 — Kafka: Consumer groups *(trung bình-khó — 4 phút)*

> Consumers label themselves with a consumer group name, and each record published to a topic is delivered to one consumer instance within each subscribing consumer group. If all the consumer instances have the same consumer group, then the records will effectively be load-balanced over the consumer instances. If all the consumer instances have different consumer groups, then each record will be broadcast to all the consumer processes.
>
> The way partition assignment works is that each partition is consumed by exactly one consumer in the group at any given time. Consequently, having more consumers than partitions results in idle consumers that receive no records. It is therefore recommended that the number of partitions be at least equal to the number of consumers.
>
> When a consumer instance fails, the partitions assigned to it are reassigned to the remaining instances — a process known as rebalancing. Be aware that frequent rebalances may cause duplicate processing, since offsets committed by the failed consumer may lag behind the records it has already processed.

**Câu hỏi:**
1. If all consumers share the same group, how are records distributed? And if they all have different groups?
2. How many consumers can consume one partition at a given time (within one group)?
3. What happens if there are more consumers than partitions?
4. What is "rebalancing"?
5. Why can frequent rebalances cause duplicate processing?

**Glossary:**
- `label themselves with` — tự gắn nhãn bằng
- `effectively` — về thực chất, trên thực tế
- `broadcast` (v) — phát cho tất cả
- `at any given time` — tại bất kỳ thời điểm nào
- `idle` — rảnh rỗi, không có việc
- `lag behind` — tụt lại phía sau
- `duplicate processing` — xử lý trùng lặp

<details>
<summary><b>Đáp án</b></summary>

1. Same group → records are load-balanced over the consumers (mỗi record chỉ 1 consumer nhận). Different groups → each record is broadcast to all consumers (mọi consumer đều nhận).
2. Exactly one consumer per partition at any given time.
3. The extra consumers are idle — they receive no records.
4. When a consumer fails, its partitions are reassigned to the remaining instances. That reassignment process is called rebalancing.
5. Because the offsets committed by the failed consumer may **lag behind** the records it already processed — so the new consumer re-reads some records (đọc lại các record chưa kịp commit offset).

**Phân tích câu khó:** "It is therefore recommended **that the number of partitions be at least equal to** the number of consumers." — Subjunctive: sau `recommend/require/suggest that`, động từ ở dạng nguyên thể (`be`, không phải `is`). Văn phong trang trọng, hay gặp trong spec.
</details>

---

### Bài 6 — Kubernetes: Liveness and readiness probes *(khó — 4 phút)*

> The kubelet uses liveness probes to know when to restart a container. For example, liveness probes could catch a deadlock, where an application is running but unable to make progress. Restarting a container in such a state can help to make the application more available despite bugs.
>
> Readiness probes, by contrast, determine whether a container is ready to accept traffic. A Pod is considered ready only when all of its containers are ready, and Services use this signal to decide which Pods traffic should be routed to. Should a readiness probe fail, the Pod's IP address is removed from the endpoints of all Services that match the Pod — without the container being restarted.
>
> A common pitfall is configuring a liveness probe whose timeout is shorter than the application's worst-case response time under load. This may result in cascading restarts: containers are killed precisely when the system is under the most pressure, which further reduces capacity and amplifies the failure.

**Câu hỏi:**
1. What is the purpose of a liveness probe? Give the example mentioned in the text.
2. When is a Pod considered "ready"?
3. What happens when a readiness probe fails? Is the container restarted?
4. Describe the "common pitfall" mentioned in the last paragraph.
5. Why are cascading restarts especially harmful?

**Glossary:**
- `probe` (n) — phép thăm dò / kiểm tra sức khỏe
- `deadlock` — bế tắc (app chạy nhưng kẹt, không tiến triển)
- `make progress` — tiến triển
- `route traffic to` — định tuyến lưu lượng đến
- `pitfall` — cạm bẫy, lỗi dễ mắc
- `worst-case` — trường hợp xấu nhất
- `under load / under pressure` — khi chịu tải
- `cascading` — dây chuyền, lan truyền
- `amplify` (v) — khuếch đại

<details>
<summary><b>Đáp án</b></summary>

1. To know when to **restart** a container. Example: catching a deadlock — the app is running but unable to make progress.
2. Only when **all** of its containers are ready.
3. The Pod's IP is removed from the endpoints of all matching Services (không nhận traffic nữa), but the container is **not** restarted.
4. Setting a liveness probe timeout **shorter than the app's worst-case response time under load** — khi hệ thống chịu tải nặng, app trả lời chậm, probe fail, container bị kill.
5. Containers are killed exactly when the system is under the most pressure → capacity giảm thêm → failure bị khuếch đại (vòng xoáy tử thần).

**Phân tích câu khó:** "**Should a readiness probe fail**, the Pod's IP address is removed..." — đảo ngữ điều kiện: `Should X fail` = `If X fails`. Văn phong trang trọng, gặp nhiều trong docs AWS/K8s. Gặp `Should + S + V` đầu câu → hiểu là "Nếu".
</details>

---

### Bài 7 — PostgreSQL: Transaction isolation *(khó — 5 phút)*

> The SQL standard defines four levels of transaction isolation, of which the most strict is Serializable. In PostgreSQL, however, the default isolation level is Read Committed: a `SELECT` query sees only data committed before the query began, and never sees uncommitted changes made by concurrent transactions.
>
> Note that two successive `SELECT` commands within the same transaction can see different data under Read Committed, since other transactions may commit between them. Applications for which this is unacceptable should use Repeatable Read, under which all statements in a transaction see a snapshot taken at the start of the transaction.
>
> It is worth noting that Repeatable Read transactions may fail with a serialization error when they attempt to modify a row that has been changed by another transaction since the snapshot was taken. Applications using this level must therefore be prepared to retry transactions. Holding transactions open longer than necessary should be avoided, as doing so delays cleanup of old row versions and may lead to table bloat.

**Câu hỏi:**
1. What is PostgreSQL's default isolation level?
2. Under Read Committed, can a query see uncommitted changes from other transactions?
3. Why can two `SELECT`s in the same transaction return different data under Read Committed?
4. Under Repeatable Read, when may a transaction fail with a serialization error, and what must applications be prepared to do?
5. Why should you avoid holding transactions open longer than necessary?

**Glossary:**
- `isolation level` — mức cô lập (transaction)
- `committed / uncommitted` — đã/chưa commit
- `concurrent` — đồng thời
- `successive` — liên tiếp
- `snapshot` — ảnh chụp trạng thái dữ liệu tại một thời điểm
- `be prepared to` — sẵn sàng để
- `bloat` (n) — sự phình to (table chứa nhiều row version chết)

<details>
<summary><b>Đáp án</b></summary>

1. Read Committed.
2. No — it sees only data committed before the query began.
3. Because other transactions may commit **between** the two SELECTs — mỗi SELECT thấy snapshot mới hơn.
4. When it attempts to modify a row that has been changed by another transaction since the snapshot was taken. Applications must be prepared to **retry** the transaction.
5. Because it delays cleanup of old row versions (VACUUM không dọn được) and may lead to table bloat.

**Phân tích câu khó:** "Applications **for which this is unacceptable** should use Repeatable Read" — giới từ + which: "các ứng dụng *mà điều này không chấp nhận được đối với chúng*". Tách câu: This is unacceptable **for** some applications → those applications should use Repeatable Read.
Câu 2: "**as doing so** delays cleanup" — `as` = vì; `doing so` = việc làm điều đó (giữ transaction mở lâu).
</details>

---

### Bài 8 — System design blog: Cache stampede *(khó nhất — 5 phút)*

> Caching reduces load on the database, but it introduces a failure mode that is frequently overlooked: the cache stampede. Consider a popular cache entry — say, the rendered homepage — that expires under heavy traffic. The moment it expires, every incoming request misses the cache, and all of them proceed to recompute the same expensive value concurrently. The database, which had been shielded by the cache until that point, is suddenly hit by hundreds of identical queries, and may be overwhelmed precisely because the cache was doing its job so well before.
>
> Several mitigations exist, each with trade-offs. With request coalescing, only the first request that misses the cache is allowed to recompute the value, while the remaining requests wait for that computation to complete — or are served the stale value, should one still be available. Probabilistic early expiration, by contrast, has each request occasionally refresh the entry before it actually expires, the probability of doing so increasing as the expiration time approaches. Neither approach eliminates the problem entirely; which one is preferable depends on whether your application tolerates stale reads.

**Câu hỏi:**
1. Describe in your own words what a cache stampede is.
2. Why does the text say the database may be overwhelmed "precisely because the cache was doing its job so well before"?
3. With request coalescing, what happens to the requests that are NOT first?
4. How does probabilistic early expiration work?
5. According to the text, what determines which mitigation is preferable?

**Glossary:**
- `stampede` — sự giẫm đạp (đàn thú chạy loạn) → ở đây: cơn lũ request
- `overlooked` — bị bỏ qua, không để ý
- `recompute` — tính toán lại
- `shielded` — được che chắn
- `overwhelmed` — bị quá tải
- `mitigation` — biện pháp giảm thiểu
- `coalescing` — gộp lại (nhiều request thành một)
- `stale` — cũ, ôi (dữ liệu hết hạn)
- `tolerate` — chịu được, chấp nhận được

<details>
<summary><b>Đáp án</b></summary>

1. When a popular cache entry expires under heavy traffic, all incoming requests miss the cache at the same time and concurrently recompute the same expensive value, hitting the database with hundreds of identical queries. *(Gợi ý trả lời phỏng vấn: "A cache stampede happens when a hot key expires and many requests recompute the same value at once, overwhelming the database.")*
2. Because the cache was absorbing (shielding) all that traffic — the database never saw it. The better the cache worked, the bigger the sudden burst when it expires (DB không quen chịu tải đó).
3. They wait for the first request's computation to complete, or they are served the stale value if one is still available.
4. Each request occasionally refreshes the entry **before** it actually expires; the probability of refreshing increases as the expiration time approaches (càng gần hết hạn càng dễ refresh sớm).
5. Whether your application tolerates **stale reads** (có chấp nhận đọc dữ liệu cũ hay không).

**Phân tích câu khó:**
- "The database, **which had been shielded by the cache until that point**, is suddenly hit..." — mệnh đề quan hệ chen giữa + past perfect passive (`had been shielded` = đã từng được che chắn trước đó).
- "...are served the stale value, **should one still be available**" — lại đảo ngữ `should` = "if one is still available" (nếu vẫn còn giá trị cũ).
- "**the probability of doing so increasing** as the expiration time approaches" — absolute clause (mệnh đề độc lập rút gọn): "với xác suất tăng dần khi gần đến hạn". Đây là cấu trúc khó nhất bài — gặp trong blog/paper, ít gặp trong docs.
</details>

---

## 5. Lộ trình đọc thật 12 tuần

> Nguyên tắc: **đọc docs khớp với chủ đề kỹ thuật bạn đang ôn tuần đó** — học 1 được 2 (kiến thức + tiếng Anh). Mục tiêu thời lượng: **30 phút/ngày, 5 ngày/tuần**. Số trang chỉ là gợi ý — chất lượng (hiểu + note) quan trọng hơn số lượng.

### 5.1. Lịch đọc theo tuần

| Tuần | Chủ đề kỹ thuật | Đọc gì (link) | Mục tiêu |
|---|---|---|---|
| **1** | Node.js core | [Node.js — Introduction to Node.js](https://nodejs.org/en/learn/getting-started/introduction-to-nodejs) và các bài trong mục Learn → Getting Started | 4-5 bài ngắn. Khởi động nhẹ, làm quen văn phong. |
| **2** | Event loop, async | [The Node.js Event Loop](https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick) + [Don't Block the Event Loop](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop) | 2 bài dài. Đây là 2 bài "kinh thánh" — đọc 2 lượt, note kỹ. |
| **3** | Streams, buffers | [Node.js Streams docs](https://nodejs.org/api/stream.html) — chỉ đọc phần đầu đến hết "Types of streams" + [Backpressuring in Streams](https://nodejs.org/en/learn/modules/backpressuring-in-streams) | ~8-10 trang API docs. Luyện đọc reference-style (khô hơn guide). |
| **4** | Express, REST API | [Express — Writing middleware](https://expressjs.com/en/guide/writing-middleware.html) + [Error handling](https://expressjs.com/en/guide/error-handling.html) + [Best practices: performance](https://expressjs.com/en/advanced/best-practice-performance.html) | 3 bài. Docs Express ngắn, dễ — tăng tốc độ đọc, thử đọc lượt 1 không quá 3 phút/bài. |
| **5** | PostgreSQL | [PostgreSQL — Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html) + [Indexes — Introduction](https://www.postgresql.org/docs/current/indexes-intro.html) | 2 chương. PostgreSQL docs là văn phong học thuật nhất — đi chậm, dùng kỹ thuật mục 2. |
| **6** | Kafka | [Kafka — Introduction](https://kafka.apache.org/intro) + [Kafka Design — Motivation & Persistence](https://kafka.apache.org/documentation/#design) (đọc 2-3 mục đầu) | Intro + 2-3 mục design. So sánh với Bài đọc 5 ở trên. |
| **7** | Redis, caching | [Redis — Key eviction](https://redis.io/docs/latest/develop/reference/eviction/) + [Redis persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/) + 1 bài [Redis data types](https://redis.io/docs/latest/develop/data-types/) | 3 bài. Redis docs viết thân thiện — tuần "xả hơi" sau PostgreSQL/Kafka. |
| **8** | Docker | [Docker — What is a container?](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-a-container/) + [Restart policies](https://docs.docker.com/engine/containers/start-containers-automatically/) + [Multi-stage builds](https://docs.docker.com/build/building/multi-stage/) | 3 bài. Chú ý các câu mệnh lệnh (imperative) trong hướng dẫn từng bước. |
| **9** | Kubernetes | [K8s Concepts — Pods](https://kubernetes.io/docs/concepts/workloads/pods/) + [Services](https://kubernetes.io/docs/concepts/services-networking/service/) + [Liveness/Readiness Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/) | 3 bài, K8s docs dài — đọc theo kỹ thuật skim mục 3.1, chỉ đọc kỹ phần concept, bỏ qua YAML chi tiết. |
| **10** | System design | [AWS Well-Architected — Reliability Pillar](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html) (đọc Design Principles + 2-3 mục) + 1 bài [ByteByteGo blog](https://blog.bytebytego.com/) | Văn phong AWS trang trọng nhất trong lộ trình (nhiều `should`, đảo ngữ). |
| **11** | System design + interview | 2 bài engineering blog: 1 bài [Cloudflare blog](https://blog.cloudflare.com/) hoặc [Stripe blog](https://stripe.com/blog/engineering) + 1 bài [High Scalability](http://highscalability.com/) | Blog = văn phong tự nhiên hơn docs, chuẩn bị cho việc *nói* về system design. |
| **12** | Tổng ôn | Đọc lại các note Cornell của 11 tuần + đọc job description tiếng Anh của 3-5 vị trí thật trên LinkedIn/TopDev | Ôn từ vựng + làm quen ngôn ngữ JD trước phỏng vấn. |

### 5.2. Quy tắc thực hiện

- **Đọc lượt 1 trước khi học kỹ thuật, lượt 2 sau khi học** — lượt 2 bạn sẽ ngạc nhiên vì đọc dễ hơn hẳn (kiến thức nền kéo tiếng Anh lên).
- Tuần nào quá tải kỹ thuật → giảm xuống mức tối thiểu **1 bài/tuần + note**, đừng bỏ hẳn. Đứt quãng 1 tuần là mất đà.
- Từ tuần 4 trở đi: mỗi tuần chọn **1 đoạn ~100 từ tâm đắc nhất, đọc to thành tiếng 2 lần** — bước đệm cho track Listening & Speaking (file 03).

### 5.3. Kỹ thuật note-taking: Cornell đơn giản hóa cho docs

Chia trang note (giấy hoặc Notion) thành 3 vùng:

```
┌────────────────────┬─────────────────────────────────────────┐
│  CUE (gợi nhớ)     │  NOTES (ghi khi đọc)                    │
│                    │                                         │
│  Từ khóa/câu hỏi   │  - Ý chính, mỗi ý 1 dòng, TIẾNG ANH     │
│  tự đặt, ví dụ:    │    ngắn gọn (chép lại cụm gốc của docs) │
│                    │  - VD: "sync methods block event loop   │
│  "When is a Pod    │    → avoid in servers, OK in CLI"       │
│   ready?"          │  - Từ mới (≤5 từ/bài): từ + nghĩa +     │
│                    │    CỤM đi kèm ("evict keys", "take      │
│  "evict = ?"       │    effect", "under load")               │
├────────────────────┴─────────────────────────────────────────┤
│  SUMMARY (tóm tắt) — viết SAU khi đọc xong, KHÔNG nhìn lại:  │
│  2-3 câu TIẾNG ANH tự viết tóm tắt cả bài.                   │
│  VD: "Redis evicts keys when maxmemory is reached. The LRU   │
│  is approximated: it samples keys instead of tracking all."  │
└──────────────────────────────────────────────────────────────┘
```

**3 quy tắc vàng:**

1. **Note bằng tiếng Anh, chép CỤM TỪ gốc của docs** (không dịch sang tiếng Việt rồi note) — đây chính là cách luyện "đọc không dịch", và các cụm này sẽ thành câu trả lời phỏng vấn của bạn.
2. **Tối đa 5 từ mới/bài.** Tham ghi 20 từ = không nhớ từ nào. Chọn từ xuất hiện ≥ 2 lần hoặc là thuật ngữ core.
3. **Ôn cue column cuối tuần:** che cột NOTES, nhìn cột CUE, tự trả lời thành tiếng bằng tiếng Anh. 10 phút mỗi Chủ nhật. Đây vừa là ôn đọc, vừa là luyện nói.

---

> **File tiếp theo:** [03-listening-speaking.md](./03-listening-speaking.md) — Nghe hiểu và nói cho developer.
