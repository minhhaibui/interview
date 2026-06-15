# 🧪 Lab Kafka — Tận tay

Lab này giúp bạn **tự tay** chạy Kafka và quan sát các khái niệm cốt lõi:
topic, partition, consumer group, offset, ordering theo key. Chạy thật, nhìn
log thật => nhớ lâu, trả lời phỏng vấn tự tin.

## 🎯 Mục tiêu

Sau lab này bạn sẽ hiểu rõ và giải thích được:

- Topic được chia thành **partition** như thế nào, và partition để làm gì.
- **Key** quyết định partition ra sao → vì sao cùng key giữ đúng thứ tự.
- **Consumer group**: nhiều consumer chia partition; nhiều group nhận full.
- **Offset**: con trỏ đọc, commit offset, ý nghĩa của `fromBeginning`.
- **Rebalance**: chuyện gì xảy ra khi thêm/tắt một consumer.
- Mô hình giao hàng **at-least-once**.

## 🏗️ Kiến trúc

```
                ┌──────────────────────────────────────┐
                │  lab-kafka (apache/kafka:3.7.0)       │
                │  1 broker, chế độ KRaft (no Zookeeper)│
                │                                        │
                │   topic "orders"                       │
                │   ├── partition 0  [m, m, m, ...]      │
                │   ├── partition 1  [m, m, ...]         │
                │   └── partition 2  [m, ...]            │
                └───────────────┬────────────────────────┘
                       localhost:9092
            ┌──────────────────┼───────────────────┐
        producer.js        consumer #1          consumer #2
       (gửi có key)      (group order-workers, chia partition)
```

- **1 broker** chạy KRaft (broker + controller gộp chung) → gọn, không cần Zookeeper.
- **topic `orders`** có **3 partition**, replicationFactor 1.

## ⚙️ Setup & chạy

> Yêu cầu: **Node v20+**, **Docker Compose v2** (lệnh `docker compose`).

### Bước 1 — Bật Kafka

```bash
docker compose up -d
```

Đợi broker khởi động xong (~15-20s). Kiểm tra healthy:

```bash
docker compose ps
# Cột STATUS hiển thị "healthy" là sẵn sàng.
```

### Bước 2 — Cài dependency

```bash
npm install
```

### Bước 3 — Tạo topic

```bash
npm run admin
```

Output mẫu:

```
✅ Đã tạo topic "orders" với 3 partition.

📋 Danh sách topic: [ 'orders' ]

🔎 Topic "orders" có 3 partition:
   • partition 0 → leader broker 1
   • partition 1 → leader broker 1
   • partition 2 → leader broker 1
```

### Bước 4 — Mở 2 consumer cùng group (để thấy chia partition)

**Terminal A:**

```bash
npm run consume
```

**Terminal B:**

```bash
INSTANCE=2 npm run consume
```

Khi terminal B vào group, Kafka **rebalance**: 3 partition được chia cho 2
consumer (ví dụ instance 1 ôm partition 0+1, instance 2 ôm partition 2).

### Bước 5 — Gửi message và quan sát

**Terminal C:**

```bash
npm run produce
# hoặc gửi nhiều hơn: npm run produce 30
```

Output producer mẫu:

```
📤 Bắt đầu gửi 9 message vào topic "orders"...

  → key=u1  ord-001  (amount=42.3)  => partition 2, offset 0
  → key=u2  ord-002  (amount=18.7)  => partition 0, offset 0
  → key=u3  ord-003  (amount=91.1)  => partition 1, offset 0
  → key=u1  ord-004  (amount=5.6)   => partition 2, offset 1
  → key=u2  ord-005  (amount=63.0)  => partition 0, offset 1
  ...
✅ Gửi xong. Để ý: cùng key luôn vào cùng một partition.
```

Bên 2 consumer, mỗi message rơi vào đúng consumer phụ trách partition đó:

```
[g=order-workers i=1] partition=0 offset=0 key=u2 value={"orderId":"ord-002",...}
[g=order-workers i=2] partition=2 offset=0 key=u1 value={"orderId":"ord-001",...}
[g=order-workers i=1] partition=1 offset=0 key=u3 value={"orderId":"ord-003",...}
```

## 🔍 Quan sát

1. **Cùng key → cùng partition.** Mọi message `key=u1` luôn vào cùng một
   partition (vd partition 2). Đó là cơ chế giữ **thứ tự cho mỗi user**: order
   của u1 được xử lý đúng trình tự gửi.

2. **Mỗi consumer chỉ thấy partition của mình.** Với 2 consumer cùng group,
   instance 1 không thấy message của partition mà instance 2 đang giữ. Tổng cộng
   2 consumer xử lý hết, **không trùng lặp** trong cùng group.

3. **Offset tăng dần theo partition.** Mỗi partition có offset riêng bắt đầu từ
   0. Offset là "vị trí" của message trong log của partition đó.

4. **Thử rebalance:** ở Terminal B nhấn `Ctrl+C` tắt consumer instance 2. Sau
   vài giây, Kafka rebalance và instance 1 sẽ **nhận lại cả 3 partition**. Gửi
   thêm `npm run produce` để xác nhận instance 1 nhận tất cả.

5. **Thử khác group:** chạy `npm run consume:g2` (group `order-workers-2`). Group
   mới này nhận **toàn bộ** message từ đầu — độc lập với `order-workers`. Đây
   chính là pub/sub: nhiều hệ thống cùng đọc một luồng sự kiện.

## 🧠 Khái niệm cốt lõi

- **Offset**: số thứ tự của message trong một partition (bắt đầu từ 0). Consumer
  "commit" offset để đánh dấu đã xử lý tới đâu; lần sau đọc tiếp từ đó.
- **Consumer group**: tập hợp consumer cùng `groupId`. Trong group, mỗi partition
  do đúng 1 consumer xử lý → scale ngang bằng cách thêm consumer (tối đa = số
  partition). Khác group → mỗi group nhận full (pub/sub).
- **Rebalance**: khi consumer vào/rời group (hoặc partition thay đổi), Kafka chia
  lại partition cho các consumer. Trong lúc rebalance, việc tiêu thụ tạm dừng.
- **Ordering theo key**: thứ tự chỉ đảm bảo **trong 1 partition**. Dùng key để
  dồn message liên quan vào cùng partition → giữ thứ tự cho key đó. Không key →
  round-robin, không đảm bảo thứ tự.
- **At-least-once**: mặc định KafkaJS commit offset sau khi xử lý. Nếu crash
  trước khi commit, message sẽ được xử lý lại → **mỗi message ít nhất 1 lần**.
  Vì vậy code xử lý nên **idempotent** (xử lý lại không gây sai).

## 💪 Bài tập mở rộng

1. **Thêm consumer group thứ 2** — chạy `npm run consume:g2` rồi `npm run produce`.
   Quan sát: group mới nhận **đầy đủ** mọi message từ đầu, độc lập với group cũ.

2. **Commit offset thủ công + xử lý lỗi** — đổi `consumer.run` sang
   `autoCommit: false`, dùng tham số `eachMessage` để gọi
   `consumer.commitOffsets([{ topic, partition, offset: (Number(message.offset)+1).toString() }])`
   chỉ khi xử lý thành công. Thử `throw` lỗi giữa chừng, restart, xem message
   được đọc lại (tính chất at-least-once).

3. **Dead-letter topic (DLT)** — tạo thêm topic `orders.DLT`. Trong consumer, khi
   xử lý 1 message thất bại quá N lần (vd value JSON lỗi), gửi nó sang `orders.DLT`
   bằng một producer rồi commit offset để bỏ qua. Viết consumer riêng đọc DLT.

4. **Tăng partition** — chạy
   `docker exec -it lab-kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --alter --topic orders --partitions 6`
   rồi mở tối đa 6 consumer cùng group. Quan sát mỗi consumer ôm 1 partition.
   Lưu ý: tăng partition **không** đổi lại vị trí message cũ và có thể phá vỡ
   ordering theo key đối với message tương lai (vì `hash(key) % numPartitions`
   thay đổi).

## 🛠️ Khắc phục sự cố thường gặp

- **Log `ERROR ... The group coordinator is not available` ngay khi consumer khởi động lần đầu.**
  Đây là **bình thường**, KHÔNG phải lỗi của bạn. Lần đầu có consumer group, Kafka mới tạo
  topic nội bộ `__consumer_offsets` (nơi lưu offset) nên "group coordinator" chưa sẵn sàng ngay.
  KafkaJS **tự retry** và vài giây sau consumer đọc message bình thường. Chạy lại lần 2 sẽ không thấy nữa.
- **Consumer in `partition=... offset=...` rồi đứng im.** Đúng rồi — consumer chạy *mãi mãi* để chờ
  message mới (đó là bản chất stream). Nhấn `Ctrl+C` để thoát; gửi thêm `npm run produce` ở terminal
  khác sẽ thấy nó nhận tiếp ngay.
- **`Connection error: connect ECONNREFUSED localhost:9092`.** Broker chưa sẵn sàng. Đợi tới khi
  `docker compose ps` báo `healthy` (khoảng 15-20s sau `up`) rồi mới chạy script Node.
- **Đổi code mà consumer không đọc lại từ đầu.** Cùng `groupId` thì Kafka nhớ offset đã commit nên chỉ
  đọc message MỚI. Muốn đọc lại từ đầu: đổi `GROUP_ID` khác, hoặc `docker compose down -v` xóa sạch.

## 🧹 Dọn dẹp

```bash
docker compose down -v
```

`-v` xóa luôn volume (dữ liệu Kafka) để lần sau bắt đầu sạch sẽ.

## 🎤 Liên hệ câu phỏng vấn

1. **Kafka khác RabbitMQ ở điểm gì?**
   Kafka là **distributed log** — message được lưu lại (retention), nhiều
   consumer group đọc lại độc lập, throughput rất cao, đọc theo offset. RabbitMQ
   là message broker truyền thống (push, queue, message thường biến mất sau khi
   ack). Kafka mạnh cho event streaming / replay; RabbitMQ mạnh cho routing
   phức tạp, task queue.

2. **Partition để làm gì? Thứ tự đảm bảo ở mức nào?**
   Partition cho phép **song song hóa** và scale ngang. Thứ tự **chỉ** đảm bảo
   trong phạm vi 1 partition, không phải toàn topic. Muốn giữ thứ tự cho một
   thực thể (vd 1 user) → gửi cùng một key.

3. **Consumer group hoạt động thế nào?**
   Mỗi partition do đúng 1 consumer trong group xử lý. Thêm consumer → chia tải
   (tối đa = số partition). Nhiều group → mỗi group nhận full (pub/sub). Khi
   consumer vào/ra → rebalance.

4. **Offset là gì? Khi nào commit?**
   Offset là vị trí message trong partition. Consumer commit offset để ghi nhớ
   đã xử lý tới đâu. Commit **sau** khi xử lý → at-least-once (có thể trùng).
   Commit **trước** khi xử lý → at-most-once (có thể mất). Exactly-once cần
   transaction / idempotent producer + đọc-ghi trong cùng transaction.

5. **Làm sao đảm bảo không mất message / không xử lý trùng?**
   Không mất: producer `acks=all`, replication > 1, commit offset sau khi xử lý.
   Không trùng (thực tế là chấp nhận trùng nhưng vô hại): thiết kế consumer
   **idempotent** (vd dùng khóa nghiệp vụ/dedup theo orderId).

6. **KRaft là gì, khác Zookeeper ra sao?**
   KRaft (Kafka Raft) cho phép Kafka tự quản lý metadata bằng controller nội bộ
   (giao thức Raft) thay vì phải dựng Zookeeper. Từ Kafka 3.x KRaft sẵn sàng cho
   production, giúp kiến trúc đơn giản hơn, ít thành phần phải vận hành hơn.
