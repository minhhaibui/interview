# 🔬 Đào sâu — Tuần 6: Kafka

> README đã dạy *cái gì* và *khi nào*; tài liệu này mổ xẻ *vì sao* và *bên trong nó chạy ra sao* — đủ để trả lời câu hỏi phỏng vấn ở tầng staff/senior.

## 🧠 Cơ chế bên trong

### 1. Log segment + offset index trên đĩa

Một partition không phải một file khổng lồ — nó là **một thư mục** chứa nhiều **segment**. Mỗi segment có 3 file đi kèm, đặt tên theo **base offset** (offset của message đầu segment):

```
orders-0/                       # partition 0 của topic orders
├── 00000000000000000000.log    # message thật, ghi tuần tự (append-only)
├── 00000000000000000000.index  # ánh xạ relative-offset → byte position trong .log
├── 00000000000000000000.timeindex  # ánh xạ timestamp → offset (cho seek theo thời gian)
├── 00000000000000170024.log    # segment kế tiếp, base offset = 170024
├── 00000000000000170024.index
└── ...
```

- **`.log`** chứa các **record batch** (không phải từng message lẻ): producer gom nhiều message thành 1 batch, broker lưu nguyên batch, compression cũng theo batch. Đây là lý do `compression` và `linger.ms` ảnh hưởng lớn tới throughput.
- **`.index`** là **sparse index** — không index mọi message mà cứ `log.index.interval.bytes` (mặc định 4KB) mới ghi một entry `(relative offset → physical byte position)`. Để đọc message tại offset X: binary-search trong `.index` tìm entry gần nhất ≤ X, nhảy tới byte đó trong `.log`, rồi **scan tuần tự** vài record tới đúng X. Index nhỏ (vài MB), nằm gọn trong page cache → tra cứu cực nhanh mà không tốn RAM lưu offset của từng message.
- Chỉ **segment cuối (active segment)** được ghi; các segment cũ là read-only → an toàn để mmap, nén, hoặc drop.
- Retention làm việc ở mức **segment**: hết hạn thì `unlink` cả file segment — O(1), không cần quét và xoá từng record. Đây là lý do retention 7 ngày của Kafka gần như miễn phí.

### 2. Vì sao Kafka nhanh — 3 trụ cột

1. **Sequential disk I/O.** Append vào cuối file là tuần tự. Disk tuần tự (kể cả HDD) đạt hàng trăm MB/s, gần bằng random RAM access và nhanh hơn random disk I/O cả trăm lần. Kafka không bao giờ update tại chỗ, không bao giờ seek lung tung khi ghi.
2. **Page cache thay vì heap cache.** Kafka **không** tự cache message trong JVM heap (tránh GC pressure + duplicate dữ liệu). Nó ghi/đọc qua **page cache của OS**. Message vừa produce còn nóng trong page cache → consumer đọc kịp (consumer bám sát "tail") gần như không chạm đĩa. JVM heap của broker do đó nhỏ (vài GB), phần RAM còn lại để OS làm page cache.
3. **Zero-copy với `sendfile()`.** Đường truyền thông thường khi gửi file qua socket: `disk → page cache → app buffer (user space) → socket buffer (kernel) → NIC` — 4 lần copy, 2 lần chuyển context kernel↔user. Kafka dùng syscall **`sendfile`** (`FileChannel.transferTo` trong Java NIO): kernel chuyển thẳng `page cache → socket buffer → NIC`, **dữ liệu không bao giờ vào user space** của broker. Loại bỏ 2 copy + context switch. *Lưu ý:* zero-copy chỉ hoạt động khi **không cần biến đổi dữ liệu** — bật TLS hoặc broker-side decompress/re-compress sẽ **mất** zero-copy.

### 3. ISR, high-watermark, acks=all, min.insync.replicas

- **High-watermark (HW):** offset cao nhất mà **mọi replica trong ISR** đã sao chép. Consumer **chỉ đọc được tới HW** — message ghi vào leader nhưng chưa replicate đủ thì *vô hình* với consumer. Điều này ngăn việc consumer đọc một message rồi message đó biến mất khi leader failover.
- **Log End Offset (LEO):** offset kế tiếp sẽ ghi của một replica. Leader's HW = min(LEO của tất cả replica trong ISR).
- **acks=all + min.insync.replicas=2:** producer chờ tới khi đủ replica trong ISR ack. Nhưng **`acks=all` một mình KHÔNG đủ** — nếu ISR co lại còn đúng 1 (chỉ leader), thì "all" = "leader thôi" → quay về acks=1 và có thể mất data khi leader chết. `min.insync.replicas=2` là cái chốt: nếu ISR < 2, broker **từ chối ghi** (`NotEnoughReplicasException`) thay vì âm thầm ack với chỉ 1 bản. Hai tham số này phải đi cùng nhau.
- **Phép tính chịu lỗi:** `replication.factor=3` + `min.insync.replicas=2` → chịu được **mất 1 broker** mà vẫn ghi được (còn 2 trong ISR), và chịu được **mất 2 broker** mà không mất data (chỉ là tạm dừng ghi). Đây là lý do công thức 3/2/all là chuẩn vàng.

### 4. Leader epoch — chống mất dữ liệu khi failover

Trước Kafka 0.11, follower dùng HW để truncate log khi có leader mới — cơ chế này có **race condition** gây mất hoặc phân kỳ dữ liệu (log divergence) khi leader đổi liên tiếp lúc network chập chờn. **Leader epoch** giải quyết: mỗi lần bầu leader mới, epoch (số nguyên tăng dần) +1. Mỗi record batch gắn epoch của leader lúc ghi. Khi follower cần đồng bộ lại, nó hỏi leader "ở epoch E, offset cuối của epoch đó là bao nhiêu?" (`OffsetsForLeaderEpoch`) và truncate **chính xác** tới ranh giới epoch thay vì đoán mò qua HW. Kết quả: không còn mất message do truncate sai khi failover.

### 5. Rebalance protocol: eager vs cooperative

- **Eager (Stop-the-World), giao thức cũ:** khi bất kỳ thành viên nào join/leave, **mọi** consumer **revoke toàn bộ** partition đang giữ → group coordinator tính lại assignment → ai nấy nhận partition mới. Trong khoảng này **cả group dừng consume**. Group càng lớn, rebalance càng đau (1 deploy rolling = N lần stop-the-world).
- **Cooperative / Incremental (`CooperativeStickyAssignor`), giao thức mới:** rebalance qua **2 vòng**. Vòng 1: chỉ revoke đúng những partition cần **đổi chủ**, các partition còn lại **tiếp tục được xử lý**. Vòng 2: gán những partition vừa được nhả. Không stop-the-world toàn cục → deploy rolling mượt hơn nhiều.
- **Trigger rebalance:** member join (scale up), member rời (crash, `session.timeout.ms` hết hạn không nhận heartbeat), hoặc **handler chạy quá `max.poll.interval.ms`** (coi như consumer treo → bị đá khỏi group). Trong kafkajs, mỗi vòng `eachMessage`/`eachBatch` ngầm gửi heartbeat, nhưng nếu **một message** xử lý lâu hơn `max.poll.interval.ms` (mặc định 5 phút) thì consumer bị loại bất kể heartbeat.
- **Static membership (`group.instance.id`):** gán ID cố định cho mỗi consumer. Khi restart (deploy), nếu consumer quay lại trong `session.timeout.ms`, coordinator **giữ nguyên** assignment cũ → **không rebalance**. Cực hợp với Kubernetes pod có identity ổn định.

### 6. Offset commit & các tầng delivery semantics (đào sâu)

- **`__consumer_offsets`** là một **compacted topic** nội bộ 50 partition. Commit offset = produce một message `(group, topic, partition) → offset` vào topic này. Compaction giữ lại bản mới nhất cho mỗi key → group luôn đọc được vị trí đọc gần nhất khi restart.
- **Auto-commit** (kafkajs `autoCommit: true`) commit theo `autoCommitInterval` **theo lịch**, **độc lập** với việc message đã xử lý xong chưa → đây là gốc rễ của cả mất message (commit trước khi xử lý) lẫn duplicate (xử lý xong, crash trước khi tới kỳ commit).
- **Manual commit** = commit `offset của message vừa xử lý + 1` (vì offset commit nghĩa là "vị trí đọc tiếp theo", không phải "đã đọc tới đâu").
- **At-least-once + idempotent consumer** là kiến trúc thực dụng nhất. **Exactly-once** thật sự chỉ tồn tại trong vòng tròn Kafka→Kafka: **idempotent producer** (chống trùng do retry) + **transaction** (gom `send` business message và `sendOffsets` commit offset vào **một** atomic unit) + consumer hạ nguồn đặt **`isolation.level=read_committed`** (chỉ đọc message của transaction đã commit, bỏ qua transaction đang mở hoặc bị abort). Transaction marker (control record) được ghi vào log để đánh dấu commit/abort.

### 7. Retention by time/size vs Compaction

- **`cleanup.policy=delete`** (mặc định): drop segment khi quá `retention.ms` (theo thời gian) **hoặc** `retention.bytes` (theo tổng dung lượng partition), tuỳ cái nào tới trước. Hợp với event stream "dùng rồi quên".
- **`cleanup.policy=compact`:** một thread (log cleaner) định kỳ quét, với mỗi **key** chỉ giữ **value mới nhất**. `value=null` là **tombstone** → xoá key (giữ tombstone thêm `delete.retention.ms` để consumer kịp thấy lệnh xoá rồi mới dọn). Hợp với "snapshot trạng thái": user profile, bảng giá, hoặc chính `__consumer_offsets`.
- **`compact,delete`:** vừa giữ bản mới nhất theo key, vừa xoá hẳn key quá cũ — hợp với KTable có TTL.
- Lưu ý: active segment **không** bị compact; chỉ phần "tail" (đã đóng segment) mới được log cleaner xử lý → một key vừa update vẫn có thể tồn tại nhiều bản trong active segment.

## 🧪 Ví dụ nâng cao (kafkajs)

### 1. Producer idempotent + acks=all + ordering theo key

```js
const { Kafka, CompressionTypes, Partitioners } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'order-service',
  brokers: ['localhost:9092'],
  retry: { initialRetryTime: 300, retries: 10 }, // retry an toàn vì idempotent
});

const producer = kafka.producer({
  idempotent: true,           // ⇒ tự ép acks=-1 (all) và maxInFlightRequests ≤ 5
  maxInFlightRequests: 5,     // idempotent vẫn giữ thứ tự dù >1 nhờ sequence number
  createPartitioner: Partitioners.DefaultPartitioner, // murmur2(key) — đồng nhất với Java client
  transactionTimeout: 30000,
});

async function publishOrder(order) {
  await producer.send({
    topic: 'orders.created',
    // KHÔNG set acks ở đây khi idempotent=true; kafkajs ép acks=-1, set khác sẽ lỗi
    compression: CompressionTypes.LZ4,
    messages: [{
      key: order.userId,                  // cùng user → cùng partition → giữ thứ tự
      value: JSON.stringify(order),
      headers: {
        'event-id': order.eventId,        // để consumer dedupe
        'correlation-id': order.reqId,
      },
    }],
  });
}
```

> Vì sao `key = userId` chứ không phải `orderId`? Nếu muốn các event của **cùng một user** (created → paid → shipped) giữ thứ tự thì key phải là `userId`. Nếu mỗi order độc lập và chỉ cần dedupe thì `orderId` cũng được — chọn key = **chiều cần đảm bảo ordering**.

### 2. Consumer at-least-once: commit thủ công SAU khi xử lý

```js
const consumer = kafka.consumer({
  groupId: 'email-service',
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
  maxInFlightRequests: 1,        // không xử lý chồng nhiều message một lúc (giữ ordering app-level)
});

await consumer.connect();
await consumer.subscribe({ topic: 'orders.created', fromBeginning: false });

await consumer.run({
  autoCommit: false,             // tự kiểm soát hoàn toàn
  eachMessage: async ({ topic, partition, message, heartbeat }) => {
    const order = JSON.parse(message.value.toString());

    await handleWithIdempotency(order, message); // xử lý XONG trước (mục 5)

    await consumer.commitOffsets([{
      topic,
      partition,
      offset: (Number(message.offset) + 1).toString(), // "đọc tiếp từ offset+1"
    }]);

    await heartbeat(); // chủ động heartbeat nếu xử lý lâu, tránh bị đá khỏi group
  },
});
```

### 3. Idempotent consumer — dedupe theo event-id trong cùng transaction DB

```js
// processed_events(event_id TEXT PRIMARY KEY) — unique constraint là điểm mấu chốt
async function handleWithIdempotency(order, message) {
  const eventId = message.headers['event-id'].toString();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ins = await client.query(
      'INSERT INTO processed_events(event_id) VALUES($1) ON CONFLICT DO NOTHING',
      [eventId]
    );
    if (ins.rowCount === 0) {           // đã xử lý rồi → bỏ qua, vẫn commit offset bình thường
      await client.query('ROLLBACK');
      console.log(`duplicated ${eventId}, skipped`);
      return;
    }

    // nghiệp vụ thật nằm CÙNG transaction với việc đánh dấu đã-xử-lý
    await client.query(
      'INSERT INTO orders(id, user_id, total) VALUES($1,$2,$3)',
      [order.id, order.userId, order.total]
    );

    await client.query('COMMIT');       // atomic: hoặc cả "đã xử lý" + "nghiệp vụ", hoặc không gì
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;                            // ném ra để retry/DLQ ở tầng ngoài lo
  } finally {
    client.release();
  }
}
```

### 4. Poison message → dead-letter topic, không kẹt partition

```js
const dlqProducer = kafka.producer({ idempotent: true });

class PermanentError extends Error {}    // parse lỗi, vi phạm logic → không retry
class TransientError extends Error {}    // DB timeout, mạng → retry được

async function processWithRetryAndDLQ({ topic, partition, message }) {
  const maxRetries = 3;
  let attempt = 0;
  while (true) {
    try {
      await businessLogic(message);
      return;                            // thành công
    } catch (err) {
      if (err instanceof PermanentError) break;        // không retry
      if (++attempt > maxRetries) break;               // hết lượt
      await sleep(2 ** attempt * 100);                 // exponential backoff
    }
  }
  // tới đây: permanent hoặc hết retry → đẩy DLQ rồi để dòng chảy đi tiếp
  await dlqProducer.send({
    topic: `${topic}.dlq`,
    messages: [{
      key: message.key,
      value: message.value,
      headers: {
        ...message.headers,
        'x-error': 'failed after retries',
        'x-original-topic': topic,
        'x-original-partition': String(partition),
        'x-original-offset': message.offset,
        'x-failed-at': new Date().toISOString(),
      },
    }],
  });
  // KHÔNG throw → kafkajs coi message này đã "xử lý" → offset tiến → partition không kẹt
}
```

### 5. Exactly-once outline (consume → process → produce, Kafka→Kafka)

```js
const eosProducer = kafka.producer({
  transactionalId: 'enricher-tx-1',   // ID ổn định cho mỗi instance (zombie fencing)
  idempotent: true,
  maxInFlightRequests: 1,
});
await eosProducer.connect();

const consumer = kafka.consumer({ groupId: 'enricher' });
// hạ nguồn đọc orders.enriched phải đặt isolation.level=read_committed

await consumer.run({
  autoCommit: false,                  // offset đi trong transaction, KHÔNG commit riêng
  eachBatch: async ({ batch }) => {
    const tx = await eosProducer.transaction();
    try {
      const offsets = [];
      for (const message of batch.messages) {
        const enriched = enrich(JSON.parse(message.value.toString()));
        await tx.send({
          topic: 'orders.enriched',
          messages: [{ key: message.key, value: JSON.stringify(enriched) }],
        });
        offsets.push({
          topic: batch.topic,
          partition: batch.partition,
          offset: (Number(message.offset) + 1).toString(),
        });
      }
      // commit offset của input NẰM TRONG cùng transaction với output → atomic
      await tx.sendOffsets({ consumerGroupId: 'enricher', topics: groupByTopic(offsets) });
      await tx.commit();              // 1 trong 2: cả send + offset, hoặc abort cả hai
    } catch (e) {
      await tx.abort();
      throw e;
    }
  },
});
```

> **Zombie fencing:** `transactionalId` ổn định cho phép broker phát hiện một instance cũ "sống lại" (zombie) sau khi đã có instance mới với cùng ID — instance cũ bị **fence** (mọi write của nó bị từ chối) nhờ cơ chế producer epoch. Đây là phần cốt lõi khiến EOS đúng kể cả khi consumer crash giữa transaction.

## 🐛 Bẫy & sự cố production

### 1. Consumer lag tăng đều, xử lý không kịp
- **Dấu hiệu:** `kafka-consumer-groups --describe` thấy cột LAG tăng tuyến tính; user nhận email/notification trễ dần; dashboard sai số.
- **Nguyên nhân thật:** 99% nghẽn ở **handler** (DB query chậm, gọi HTTP đồng bộ, không batch) chứ không phải Kafka.
- **Fix:** tối ưu handler trước (index DB, gọi async/batch); tăng consumer **tới đúng số partition** (thêm nữa là idle); chuyển `eachMessage` → `eachBatch` để xử lý lô; nếu vẫn không kịp thì **tăng partition** (chấp nhận ảnh hưởng ordering, xem mục 6).

### 2. Rebalance liên tục (rebalance storm)
- **Dấu hiệu:** log đầy `Rebalancing`, throughput giật cục, một số message bị xử lý lại.
- **Nguyên nhân:** một message xử lý lâu hơn `max.poll.interval.ms` (mặc định 5 phút) → consumer bị coi là treo → bị đá → rebalance → message giao consumer khác → lại lâu → lặp vô tận.
- **Fix:** tăng `max.poll.interval.ms`; giảm số message mỗi lần poll (`maxBytes`/batch nhỏ hơn); tách phần xử lý nặng ra job riêng; chủ động gọi `heartbeat()`; dùng **cooperative rebalancing** + **static membership** để giảm cả tần suất lẫn chi phí.

### 3. Mất message vì acks=1 + leader chết
- **Dấu hiệu:** consumer thiếu message mà không có lỗi nào ở producer; số liệu đối soát lệch sau một sự cố broker.
- **Nguyên nhân:** `acks=1` ack ngay khi leader ghi xong, follower chưa kịp kéo; leader chết, leader mới (từ follower) không có message đó → mất vĩnh viễn.
- **Fix:** bộ ba `acks=all` + `replication.factor=3` + `min.insync.replicas=2`; và **`unclean.leader.election.enable=false`** để cấm bầu replica ngoài ISR làm leader.

### 4. Duplicate vì commit trước khi xử lý xong
- **Dấu hiệu:** một order ghi DB 2 lần; email gửi đôi; số dòng > số message.
- **Nguyên nhân:** auto-commit (theo lịch) commit offset của message **chưa** xử lý xong; hoặc code commit trước rồi mới gọi handler. Crash giữa chừng → at-most-once (mất) hoặc commit sai chỗ.
- **Fix:** `autoCommit: false`, commit **sau** khi xử lý; và phòng thủ chiều sâu bằng **idempotent consumer** (dedupe theo event-id) vì at-least-once **luôn** có khả năng trùng dù code đúng.

### 5. Quá nhiều partition gây overhead
- **Dấu hiệu:** rebalance chậm (giây→chục giây), broker tốn nhiều file handle/bộ nhớ metadata, leader election lâu khi broker restart, end-to-end latency tăng.
- **Nguyên nhân:** mỗi partition = thêm file segment, thêm replica fetch, thêm entry metadata; hàng chục nghìn partition/cluster làm controller và rebalance ì ạch.
- **Fix:** ước lượng partition theo **throughput mục tiêu / throughput mỗi partition** thay vì "càng nhiều càng tốt"; gộp topic ít traffic; nhớ partition **chỉ tăng được, không giảm**.

### 6. Key null làm mất ordering
- **Dấu hiệu:** event của cùng một user/order bị xử lý sai thứ tự (paid trước created).
- **Nguyên nhân:** message **không có key** → partitioner rải round-robin/sticky → các event cùng thực thể nằm rải nhiều partition → không còn ordering. Tương tự: **tăng số partition** làm `hash(key) % N` đổi → key cũ sang partition mới, ordering vỡ trong giai đoạn chuyển tiếp.
- **Fix:** luôn set key = id thực thể cần ordering; cố định số partition từ đầu (over-provision nhẹ); nếu buộc phải tăng partition, chấp nhận một cửa sổ mất ordering hoặc dùng partitioner tuỳ biến giữ ánh xạ key cũ.

## ⚖️ Đánh đổi & quyết định thiết kế

### Kafka vs RabbitMQ vs SQS — chọn theo trục nào
| Trục quyết định | Nghiêng Kafka | Nghiêng RabbitMQ | Nghiêng SQS |
|---|---|---|---|
| Replay / giữ lịch sử | ✅ log giữ theo retention | ❌ xoá sau ack | ❌ xoá sau ack |
| Nhiều consumer độc lập cùng luồng | ✅ consumer group | ⚠️ phải fanout exchange | ⚠️ ghép SNS |
| Throughput cực lớn | ✅ triệu msg/s | ⚠️ chục–trăm nghìn | ✅ AWS tự scale |
| Routing phức tạp, priority, per-msg TTL/delay | ❌ chỉ topic/partition | ✅ thế mạnh | ❌ cơ bản |
| Ops nhẹ / zero-ops | ❌ nặng (trừ MSK/Confluent) | ⚠️ trung bình | ✅ zero ops |

Câu chốt phỏng vấn: *Kafka = sổ ghi sự kiện cho nhiều người đọc lại; RabbitMQ/SQS = hòm thư giao việc, việc xong thì thư biến mất.*

### Số partition: throughput vs ordering vs rebalance
- **Nhiều partition** → song song hoá cao (nhiều consumer chạy được), throughput lớn — **nhưng** rebalance chậm, overhead metadata, và ordering chỉ trong từng partition (toàn cục càng "loãng").
- **Ít partition** → ordering tập trung, rebalance nhanh — **nhưng** trần scale của consumer group thấp (consumer thừa idle).
- **Quy tắc:** `partitions ≈ max(throughput_in / throughput_per_partition, throughput_out / consumer_throughput)`, làm tròn lên, over-provision nhẹ vì **chỉ tăng được**.

### At-least-once + idempotent consumer vs Exactly-once transaction
- **EOS transaction** đúng cho **Kafka→Kafka** thuần (stream processing). Cái giá: throughput giảm (~10–30%), độ phức tạp cao (transactionalId, fencing, read_committed), và **không vươn ra ngoài Kafka**.
- **At-least-once + idempotent consumer** đơn giản, chịu được mọi side effect ngoài (DB/email/API), debug dễ. Cái giá: phải tự lo dedupe (event-id + unique constraint).
- **Mặc định nên chọn at-least-once + idempotent** trừ khi pipeline thuần Kafka và thực sự cần EOS.

### Retention (delete) vs Compaction
- **delete:** event stream "dùng rồi quên" — log/metrics/audit theo thời gian. Đơn giản, rẻ.
- **compact:** topic mang "trạng thái mới nhất theo key" — có thể rebuild state từ đầu topic (changelog của KTable). Tốn CPU log cleaner, không hợp dữ liệu cần giữ toàn bộ lịch sử.

## 🎯 Câu hỏi phỏng vấn NÂNG CAO

**Q1. "Exactly-once" trong Kafka thực sự nghĩa là gì?**
Chỉ đúng trong vòng tròn **Kafka→Kafka** (consume–process–produce): idempotent producer chống trùng do retry, transaction gom business message + commit offset thành một atomic unit, consumer hạ nguồn đặt `read_committed`. Nó **không** mở rộng ra side effect ngoài Kafka (DB, email, HTTP) — với những thứ đó vẫn là at-least-once + idempotent consumer. Trả lời "Kafka có exactly-once cho mọi thứ" là sai và lộ ngay.

**Q2. Vì sao thêm partition có thể phá vỡ ordering?**
Partition của một key được chọn bằng `hash(key) % numPartitions`. Tăng `numPartitions` đổi kết quả phép chia dư → cùng một key giờ map sang partition khác. Trong giai đoạn chuyển tiếp, event cũ của key nằm ở partition cũ, event mới nằm ở partition mới → consumer có thể đọc message mới trước message cũ → **vỡ ordering theo key**. Vì vậy partition thường được over-provision từ đầu và hạn chế thay đổi.

**Q3. `acks=all` có đảm bảo không mất dữ liệu không?**
**Không, nếu đứng một mình.** "all" nghĩa là "mọi replica **trong ISR**". Nếu ISR co lại còn 1 (chỉ leader), `acks=all` ≈ `acks=1` và mất data khi leader chết. Phải kèm `min.insync.replicas=2` (ISR < 2 thì từ chối ghi) + `replication.factor=3` + `unclean.leader.election.enable=false`. Bộ này mới là "không mất dữ liệu đã ack".

**Q4. High-watermark để làm gì? Vì sao consumer không đọc được tới LEO của leader?**
HW = offset cao nhất đã được mọi ISR sao chép. Consumer chỉ đọc tới HW để đảm bảo **không đọc message có thể biến mất** khi leader failover. Nếu cho consumer đọc tới LEO (message mới ghi leader nhưng chưa replicate), rồi leader chết, leader mới không có message đó → consumer "thấy ma". HW là ranh giới an toàn cho tính nhất quán đọc.

**Q5. Outbox pattern giải quyết vấn đề gì, và vì sao không dùng 2PC?**
Giải bài **dual-write**: ghi DB và publish Kafka không thể atomic (ghi DB xong publish lỗi, hoặc ngược lại → lệch trạng thái). Outbox ghi event vào bảng `outbox` **trong cùng transaction DB** với nghiệp vụ → atomic; relay (polling `FOR UPDATE SKIP LOCKED` hoặc CDC Debezium đọc WAL/binlog) publish sau. Không dùng 2PC vì Kafka không hỗ trợ XA transaction với DB, và 2PC giòn (coordinator chết là treo) + chậm. Relay là at-least-once nên consumer vẫn cần idempotent theo event-id.

**Q6. Cooperative rebalancing khác eager ở đâu, vì sao quan trọng với rolling deploy?**
Eager revoke **toàn bộ** partition của mọi consumer mỗi lần rebalance → stop-the-world toàn group. Một rolling deploy N pod = N lần dừng. Cooperative chỉ revoke **những partition cần đổi chủ**, phần còn lại tiếp tục consume, qua 2 vòng. Kết hợp static membership (`group.instance.id`) thì restart trong `session.timeout.ms` **không** rebalance. Với cluster lớn deploy thường xuyên, đây là khác biệt giữa "giật cục mỗi lần deploy" và "mượt".

**Q7. Zero-copy là gì và khi nào Kafka mất nó?**
`sendfile()` cho kernel chuyển dữ liệu thẳng từ page cache ra NIC, không copy qua user space của broker → bỏ 2 lần copy + 2 context switch. Kafka **mất** zero-copy khi cần biến đổi dữ liệu trên đường đi: **TLS/SSL** (phải mã hoá trong user space) hoặc khi broker phải **decompress/re-compress** (vd format chuyển đổi, down-conversion cho client cũ). Đây là một lý do TLS làm giảm throughput broker.

**Q8. Leader epoch giải quyết vấn đề gì so với truncate-by-HW?**
Cơ chế cũ dùng HW để truncate khi có leader mới, có race condition gây **log divergence/mất message** khi leader đổi liên tiếp lúc mạng chập chờn. Leader epoch gắn số epoch tăng dần vào mỗi batch; follower hỏi `OffsetsForLeaderEpoch` để biết ranh giới chính xác của từng epoch và truncate đúng điểm phân kỳ, thay vì đoán qua HW. Loại bỏ mất dữ liệu do truncate sai khi failover.

## 📚 Đọc thêm
- Kafka: The Definitive Guide (Narkhede, Shapira, Palino) — chương Internals, Reliable Data Delivery, Exactly-Once.
- Confluent docs: *Transactions*, *Idempotent Producer*, *Incremental Cooperative Rebalancing* (KIP-429), *Leader Epoch* (KIP-101/KIP-279).
- Jay Kreps — "The Log: What every software engineer should know about real-time data's unifying abstraction".
- Martin Fowler — *Transactional Outbox* và *Event-Carried State Transfer*.
- KIP-98 (EOS/Transactions), KIP-345 (Static Membership) — đọc thẳng KIP để hiểu thiết kế gốc.
