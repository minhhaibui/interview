# 03 · Collections — Java Backend

> Cấu trúc dữ liệu bạn dùng **hằng ngày** và hay bị hỏi "nội bộ hoạt động thế nào". Đọc xong làm quiz **☕ Java** chủ đề *Collections*.

---

## 1. Bản đồ Collections Framework

```
Collection
 ├─ List   (có thứ tự, cho trùng)      → ArrayList, LinkedList
 ├─ Set    (không trùng)               → HashSet, LinkedHashSet, TreeSet
 └─ Queue  (hàng đợi)                  → ArrayDeque, PriorityQueue
Map (cặp key-value, không kế thừa Collection) → HashMap, LinkedHashMap, TreeMap, ConcurrentHashMap
```

---

## 2. `ArrayList` vs `LinkedList`

| | ArrayList | LinkedList |
|--|--|--|
| Cấu trúc | Mảng động | Danh sách liên kết đôi |
| `get(i)` | **O(1)** | O(n) (phải duyệt) |
| Chèn/xoá giữa | O(n) (dịch phần tử) | O(1) *khi đã có tham chiếu node* |
| Cache locality | Tốt (liền mạch) | Kém |

> **Thực tế:** `ArrayList` gần như luôn là lựa chọn tốt hơn nhờ cache-locality; `LinkedList` hiếm khi tối ưu. Câu trả lời phỏng vấn "chèn/xoá dùng LinkedList" chỉ đúng khi bạn **đã giữ tham chiếu node** — còn `list.add(i, x)` vẫn phải duyệt tới i.

### ArrayList mở rộng (resize) thế nào?

Khi đầy, `ArrayList` tạo mảng mới **1.5×** kích thước cũ rồi copy sang (`Arrays.copyOf`). Biết trước số lượng → khởi tạo `new ArrayList<>(capacity)` để tránh copy nhiều lần.

---

## 3. `HashMap` — nội bộ (câu hỏi kinh điển)

`HashMap` lưu cặp key-value trong một **mảng bucket**. Vị trí bucket = `hash(key) & (n-1)`.

```
index = (n - 1) & hash(key)   // n là capacity, luôn là luỹ thừa của 2
```

### Xử lý va chạm (collision)

Nhiều key rơi vào cùng bucket → nối thành **danh sách liên kết**. Từ **Java 8**: khi 1 bucket có **≥ 8 nút** VÀ bảng **≥ 64**, nó **treeify** thành **cây đỏ-đen** → tra cứu trong bucket từ O(n) xuống **O(log n)** (chống tấn công collision). Xuống dưới ngưỡng lại chuyển về list.

### Resize (mở rộng)

- **Load factor** mặc định 0.75: khi `size > capacity × 0.75` → **gấp đôi** capacity và **rehash**.
- Vì sao 0.75? Cân bằng giữa tốn bộ nhớ (thấp quá) và nhiều collision (cao quá).

### `equals()` và `hashCode()` — hợp đồng BẮT BUỘC

```java
// Nếu a.equals(b) == true  →  a.hashCode() phải == b.hashCode()
```

- Override `equals()` mà **quên** `hashCode()` → hai object "bằng nhau" rơi vào bucket khác nhau → `HashMap.get()` **không tìm thấy**. Luôn override **cả hai** cùng tập trường.
- Ngược lại KHÔNG bắt buộc: hai object khác nhau **có thể** trùng hashCode (collision là hợp lệ).

> **Bẫy:** dùng object **mutable** làm key rồi đổi field tham gia hashCode sau khi `put` → không bao giờ lấy lại được. Key nên **immutable** (như `String`).

### HashMap KHÔNG thread-safe

Nhiều thread `put` đồng thời có thể hỏng cấu trúc (Java 7 còn gây vòng lặp vô hạn khi resize). Đa luồng → dùng **`ConcurrentHashMap`**.

---

## 4. `ConcurrentHashMap` — Map cho đa luồng

- Java 8: dùng **CAS + khoá theo bucket/node** (không khoá toàn bảng) → nhiều thread ghi song song tốt.
- Khác `Collections.synchronizedMap(HashMap)`: cái kia khoá **toàn map** mỗi thao tác → nghẽn.
- **Không cho** null key/value (tránh nhập nhằng "không có key" vs "value null" khi đa luồng). `HashMap` thì cho.

---

## 5. `LinkedHashMap` & `TreeMap`

- **`LinkedHashMap`**: HashMap + duy trì **thứ tự chèn** (hoặc thứ tự truy cập — `accessOrder=true`). Thứ tự truy cập là nền để làm **LRU cache** (override `removeEldestEntry`).
- **`TreeMap`**: cây đỏ-đen, key **luôn được sắp xếp** (theo `Comparable`/`Comparator`); `get/put` O(log n); có `firstKey/lastKey/subMap` cho range.

---

## 6. Fail-fast iterator

Duyệt `ArrayList`/`HashMap` rồi **sửa cấu trúc** (add/remove) ngoài iterator → ném **`ConcurrentModificationException`** (kiểm `modCount`). Muốn xoá an toàn khi duyệt: dùng `iterator.remove()` hoặc `removeIf()`.

---

## 7. `Comparable` vs `Comparator`

- **`Comparable`** (`compareTo`): thứ tự "tự nhiên" **trong** class (String, Integer đã có).
- **`Comparator`** (`compare`): thứ tự **ngoài**, linh hoạt nhiều tiêu chí — truyền vào `sort()`/`TreeMap` mà không sửa class gốc.

```java
list.sort(Comparator.comparing(User::getAge).thenComparing(User::getName));
```

---

## 8. Chọn cấu trúc nào? (bảng quyết định nhanh)

| Nhu cầu | Dùng |
|--------|------|
| Danh sách, truy cập theo index nhiều | `ArrayList` |
| Không trùng, không cần thứ tự | `HashSet` |
| Không trùng, giữ thứ tự chèn | `LinkedHashSet` |
| Không trùng, sắp xếp | `TreeSet` |
| Map thường | `HashMap` |
| Map đa luồng | `ConcurrentHashMap` |
| Map sắp xếp theo key / range | `TreeMap` |
| LRU cache | `LinkedHashMap(accessOrder)` |
| Hàng đợi 2 đầu / stack | `ArrayDeque` |

---

## 9. Câu hỏi phỏng vấn hay gặp

1. `ArrayList` vs `LinkedList` — khác nhau và khi nào dùng cái nào?
2. `HashMap` xử lý va chạm thế nào? Java 8 khác gì (treeify)?
3. Load factor 0.75 nghĩa là gì? Khi nào resize?
4. Override `equals` mà quên `hashCode` gây lỗi gì?
5. `hashCode` của 2 object khác nhau có bắt buộc khác nhau không?
6. `ConcurrentHashMap` khác `synchronizedMap` và `HashMap` ra sao? (gợi ý: null, khoá)
7. Làm LRU cache bằng gì trong Java chuẩn?
8. Fail-fast là gì? Xoá phần tử khi đang duyệt sao cho an toàn?

> Làm tiếp: tab **🧠 Tư duy → ☕ Java**, các câu chủ đề *Collections* / *equals / hashCode*.
