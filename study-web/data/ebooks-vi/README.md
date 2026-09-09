# Bản dịch tiếng Việt của corpus ebook

Mỗi file `<sách>/<chương>.json` là một map `{ "khoá băm": "bản dịch" }`. Khoá băm
lấy từ nội dung tiếng Anh (`k` trong `data/ebooks-en/`), nên trích lại PDF hay
đổi cách tách đoạn cũng không làm lệch bản dịch — test `ebook: bản dịch tiếng
Việt khớp khoá băm của bản gốc` sẽ báo nếu có bản dịch mồ côi.

Quy trình dịch một chương:

```bash
python3 tools/eb_dump.py --todo                      # còn chương nào chưa xong
python3 tools/eb_dump.py grokking 008-load-balancers # in ra "số<TAB>câu gốc"
python3 tools/eb_apply.py grokking 008-load-balancers < ban-dich.txt
node build.js                                        # ghép EN+VI ra public/data/
```

## Quy ước thuật ngữ

Nguyên tắc: **giữ nguyên thuật ngữ mà dân backend Việt Nam vẫn dùng bằng tiếng
Anh** (server, client, request, cache, node, shard, queue…), dịch phần diễn giải.
Lần đầu xuất hiện trong chương thì ghi kèm bản tiếng Anh trong ngoặc.

| Tiếng Anh | Tiếng Việt |
|---|---|
| availability | tính sẵn sàng |
| scalability | khả năng mở rộng |
| reliability | độ tin cậy |
| maintainability | khả năng bảo trì |
| fault tolerance | khả năng chịu lỗi |
| consistency | tính nhất quán |
| eventual consistency | nhất quán cuối (eventual consistency) |
| strong consistency | nhất quán mạnh |
| latency | độ trễ |
| throughput | thông lượng |
| bottleneck | nút thắt cổ chai |
| load balancer | bộ cân bằng tải (load balancer) |
| rate limiter | bộ giới hạn tốc độ (rate limiter) |
| throttling | chặn bớt / điều tiết |
| building block | khối xây dựng |
| back-of-the-envelope | ước lượng nhanh |
| single point of failure | điểm chết đơn (single point of failure) |
| replication | nhân bản |
| sharding / partitioning | chia mảnh (sharding) / phân vùng |
| failover | chuyển dự phòng |
| stateless / stateful | phi trạng thái / có trạng thái |
| write-through, write-back | ghi xuyên, ghi trễ |
| cache hit / miss | trúng cache / trượt cache |
| deployment | triển khai |
| trade-off | đánh đổi |
| overhead | chi phí phát sinh |
| workload | tải công việc |
