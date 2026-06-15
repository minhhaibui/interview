// 📥 Consumer: thuộc consumer group `order-workers`, đọc topic `orders`.
//
// 🧩 CONSUMER GROUP — quy tắc vàng:
//   - Trong CÙNG một group, mỗi partition chỉ do ĐÚNG 1 consumer xử lý.
//       • 1 consumer  + 3 partition  => 1 consumer ôm cả 3 partition.
//       • 2 consumer  + 3 partition  => Kafka REBALANCE, chia ví dụ 2 + 1.
//       • 4 consumer  + 3 partition  => 1 consumer ngồi chơi (thừa).
//   - KHÁC group => mỗi group nhận TOÀN BỘ message (bản sao độc lập). Đây là
//     cách làm pub/sub: nhiều hệ thống cùng tiêu thụ một luồng sự kiện.
//
// 🎛️ Có thể đổi group / đặt tên instance qua biến môi trường:
//      GROUP_ID=order-workers-2  INSTANCE=2  npm run consume
//   để mở nhiều terminal và quan sát việc chia partition / rebalance.

const { kafka } = require('./client');

const TOPIC = 'orders';
const GROUP_ID = process.env.GROUP_ID || 'order-workers';
const INSTANCE = process.env.INSTANCE || '1';

async function main() {
  const consumer = kafka.consumer({ groupId: GROUP_ID });
  await consumer.connect();

  // fromBeginning: true => đọc từ offset đầu tiên còn lưu (xem được message cũ).
  // Lần sau, nếu group đã commit offset thì sẽ đọc tiếp từ offset đã commit.
  await consumer.subscribe({ topic: TOPIC, fromBeginning: true });

  console.log(
    `📥 Consumer [group=${GROUP_ID}, instance=${INSTANCE}] đang lắng nghe "${TOPIC}"...\n`,
  );

  await consumer.run({
    // eachMessage được gọi cho mỗi message. KafkaJS tự commit offset định kỳ
    // (at-least-once): nếu crash giữa chừng, message có thể được xử lý lại.
    eachMessage: async ({ topic, partition, message }) => {
      const key = message.key ? message.key.toString() : '(null)';
      const value = message.value ? message.value.toString() : '';
      console.log(
        `[g=${GROUP_ID} i=${INSTANCE}] partition=${partition} ` +
          `offset=${message.offset} key=${key} value=${value}`,
      );
    },
  });
}

// Đóng consumer gọn gàng khi nhấn Ctrl+C để Kafka rebalance cho consumer còn lại.
const shutdown = async () => {
  console.log('\n👋 Đang đóng consumer...');
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch((err) => {
  console.error('❌ Lỗi consumer:', err);
  process.exit(1);
});
