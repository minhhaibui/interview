# 06 · Redis — Java Backend

> Cache và lưu trữ tốc độ cao — gần như dự án backend nào cũng dùng. Đọc xong làm quiz **☁️ Redis**.

---

## 1. Vì sao Redis nhanh (dù đơn luồng)?

- **In-memory:** dữ liệu nằm trong RAM, không phải đĩa.
- **Cấu trúc dữ liệu tối ưu:** skiplist, hash, ziplist…
- **Đơn luồng thực thi lệnh:** không tốn chi phí khoá / chuyển ngữ cảnh, không đua tranh.
- **I/O đa hồi tiếp (epoll):** một luồng quản hàng vạn kết nối.

> Redis 6+ thêm **đa luồng cho I/O mạng** (đọc/ghi socket), nhưng **thực thi lệnh vẫn đơn luồng**.

⚠️ Vì đơn luồng, một lệnh **O(n) trên tập lớn** sẽ **chặn** mọi request khác. Cấm `KEYS *` trên production → dùng `SCAN` (phân trang, non-blocking). Xoá key khổng lồ dùng `UNLINK` (bất đồng bộ) thay `DEL`.

---

## 2. Năm kiểu dữ liệu & use case

| Kiểu | Dùng cho |
|------|----------|
| **String** | Cache giá trị, đếm (`INCR`), bit |
| **Hash** | Lưu object nhiều field, sửa từng field |
| **List** | Hàng đợi, feed/timeline (`LPUSH`/`BRPOP`) |
| **Set** | Tập không trùng, tag, giao/hợp |
| **ZSet** (Sorted Set) | Bảng xếp hạng (leaderboard), top-N (có score) |

Ngoài ra: Bitmap, HyperLogLog (đếm UV xấp xỉ), Geo, Stream.

---

## 3. Persistence: RDB vs AOF

| | RDB | AOF |
|--|-----|-----|
| Cách | Snapshot nhị phân theo chu kỳ | Ghi lại từng lệnh ghi |
| File | Nhỏ, khôi phục nhanh | To hơn, khôi phục chậm |
| An toàn | Mất dữ liệu giữa 2 snapshot | Mất tối đa ~1s (`appendfsync everysec`) |
| Hợp cho | Backup | An toàn dữ liệu |

> Thực tế thường **bật cả hai**: RDB để backup + AOF để an toàn (Redis 4+ có mixed persistence).

---

## 4. Ba vấn đề cache kinh điển (穿透 / 击穿 / 雪崩)

### a) Cache穿透 (penetration) — hỏi key KHÔNG tồn tại

Liên tục hỏi id không có (id âm, id bịa) → cache luôn miss → DB gánh hết (thường do tấn công).

**Chống:** cache lại giá trị **rỗng (null)** với TTL ngắn; hoặc **Bloom filter** chặn trước (không có id hợp lệ thì trả luôn).

### b) Cache击穿 (breakdown) — một HOT KEY hết hạn

Một key nóng hết hạn đúng lúc tải cao → nghìn request cùng miss và cùng query DB.

**Chống:** **mutex / distributed lock** (chỉ 1 request rebuild cache, số còn lại chờ); hoặc **logical expiration** (không set TTL thật, làm mới nền); hoặc key nóng "không hết hạn".

### c) Cache雪崩 (avalanche) — NHIỀU key hết hạn cùng lúc

Loạt key cùng TTL hết hạn đồng thời (hoặc Redis sập) → DB dồn tải đột ngột.

**Chống:** TTL + **ngẫu nhiên (jitter)** để rải thời điểm; Redis cluster/sentinel (không sập cả hệ); circuit breaker / hạn dòng bảo vệ DB.

> **Nhớ nhanh:** 穿透 = key không có thật; 击穿 = 1 key nóng chết; 雪崩 = nhiều key chết cùng lúc.

---

## 5. Hết hạn & thu hồi bộ nhớ

**Xoá key hết hạn** — kết hợp:
- **Lazy:** khi truy cập key, nếu hết hạn thì mới xoá.
- **Periodic:** định kỳ lấy **mẫu ngẫu nhiên** key có TTL để xoá (tránh quét toàn bộ tốn CPU).

**Khi đầy bộ nhớ (`maxmemory`)** — chính sách thu hồi:
- `noeviction` (mặc định): từ chối ghi.
- `allkeys-lru` / `allkeys-lfu`: đuổi key ít dùng gần đây / ít tần suất — **hợp làm cache**.
- `volatile-*`: chỉ đuổi trong nhóm key **có TTL**.

---

## 6. Khoá phân tán (distributed lock)

```
SET lock:order:42 <uuid> NX EX 10        # đúng: một lệnh nguyên tử
```

- `SET ... NX EX` là **một lệnh nguyên tử**: chỉ set nếu chưa có + kèm hết hạn (tránh `SETNX` rồi `EXPIRE` tách rời → crash giữa chừng gây khoá kẹt vĩnh viễn).
- `value` = **UUID** của người giữ khoá.
- **Nhả khoá** bằng script **Lua**: chỉ `DEL` nếu value khớp (tránh xoá nhầm khoá người khác khi khoá mình đã hết hạn).

> Nhiều node master → **Redlock** (còn tranh cãi). Production Java thường dùng **Redisson**.

---

## 7. Nhất quán cache-DB (cache-aside)

- **Đọc:** cache miss → query DB → set cache.
- **Ghi:** cập nhật DB rồi **XOÁ cache** (không update cache).

Vì sao **xoá** chứ không update: tránh ghi đè bằng giá trị cũ do race, và lười tính (chỉ nạp khi cần). Vẫn còn cửa sổ bất nhất nhỏ → kỹ thuật "delayed double delete" hoặc đồng bộ qua binlog (Canal). Cần nhất quán mạnh tuyệt đối thì Redis không phải công cụ phù hợp.

---

## 8. High Availability

- **Replication** (master-replica): sao chép + mở rộng đọc, dự phòng.
- **Sentinel:** giám sát + **tự động failover** khi master sập (HA).
- **Cluster:** **sharding** dữ liệu qua **16384 slot** trên nhiều master → mở rộng ghi + dung lượng.

> Chỉ cần HA → Sentinel; cần scale ghi/bộ nhớ lớn → Cluster.

---

## 9. Câu hỏi phỏng vấn hay gặp

1. Vì sao Redis nhanh dù đơn luồng? Redis 6 đa luồng ở đâu?
2. Kể 5 kiểu dữ liệu và use case tương ứng.
3. RDB vs AOF khác nhau thế nào? Nên dùng cái nào?
4. Phân biệt cache穿透 / 击穿 / 雪崩 và cách chống mỗi loại.
5. Redis xoá key hết hạn bằng chiến lược nào? Khi đầy RAM chọn policy gì cho cache?
6. Làm khoá phân tán bằng Redis đúng cách? Vì sao cần Lua khi nhả khoá?
7. Cập nhật DB và cache thế nào để giảm bất nhất?
8. Replication / Sentinel / Cluster khác nhau ra sao?

> Làm tiếp: tab **🧠 Tư duy → ☁️ Redis**.
