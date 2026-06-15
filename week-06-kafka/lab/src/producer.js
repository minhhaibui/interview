// 📤 Producer: gửi N message vào topic `orders`.
//
// MỖI message có:
//   - key   = userId (thuộc tập nhỏ {u1, u2, u3})
//   - value = JSON { orderId, amount, ts }
//
// 🔑 Vì sao có key? Kafka băm key (hash) để chọn partition:
//        partition = hash(key) % numPartitions
//   => CÙNG key luôn rơi vào CÙNG partition => các message của cùng một user
//      được giữ ĐÚNG THỨ TỰ (vì thứ tự chỉ đảm bảo trong 1 partition).
//   Nếu key = null, Kafka phân phối xoay vòng (round-robin) => không đảm bảo thứ tự.

const { kafka } = require('./client');

const TOPIC = 'orders';
const USERS = ['u1', 'u2', 'u3'];
// Số message gửi đi: lấy từ tham số dòng lệnh hoặc env, mặc định 9.
const COUNT = Number(process.env.COUNT || process.argv[2] || 9);

async function main() {
  const producer = kafka.producer();
  await producer.connect();
  console.log(`📤 Bắt đầu gửi ${COUNT} message vào topic "${TOPIC}"...\n`);

  try {
    for (let i = 1; i <= COUNT; i++) {
      // Xoay vòng user để 3 partition đều có dữ liệu.
      const userId = USERS[(i - 1) % USERS.length];
      const order = {
        orderId: `ord-${String(i).padStart(3, '0')}`,
        amount: Math.round(Math.random() * 1000) / 10,
        ts: Date.now(),
      };

      // send() trả về metadata cho biết message rơi vào partition nào.
      const [meta] = await producer.send({
        topic: TOPIC,
        messages: [{ key: userId, value: JSON.stringify(order) }],
      });

      console.log(
        `  → key=${userId}  ${order.orderId}  (amount=${order.amount})  ` +
          `=> partition ${meta.partition}, offset ${meta.baseOffset}`,
      );
    }

    console.log('\n✅ Gửi xong. Để ý: cùng key luôn vào cùng một partition.');
  } finally {
    await producer.disconnect();
  }
}

main().catch((err) => {
  console.error('❌ Lỗi producer:', err);
  process.exit(1);
});
