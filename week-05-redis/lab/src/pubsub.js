// 📣 pubsub.js — Pub/Sub (Publish/Subscribe)
//
// Mô hình: publisher gửi message vào 1 KÊNH (channel), mọi subscriber đang
// subscribe kênh đó nhận được. Đây là "fire-and-forget":
//   - KHÔNG lưu lịch sử: ai không online lúc publish thì KHÔNG nhận lại được.
//   - Cần lưu/replay -> dùng Redis Streams (XADD/XREAD) thay vì Pub/Sub.
//
// ⚠️ QUAN TRỌNG: một client ĐANG ở chế độ subscribe KHÔNG chạy được lệnh
// thường (GET/SET...). Vì vậy ta cần 2 CLIENT RIÊNG:
//   - subscriber: chỉ để subscribe & nhận
//   - publisher : để publish (và làm việc khác)
// redis@4 hỗ trợ tách bằng client.duplicate().

const { getClient } = require('./connect');

const CHANNEL = 'news';
const MESSAGES = ['Tin 1: Redis rất nhanh ⚡', 'Tin 2: ZSET hợp leaderboard 🏆', 'Tin 3: Hết tin 👋'];

async function main() {
  // Client gốc làm publisher
  const publisher = await getClient();
  // Nhân bản 1 kết nối riêng làm subscriber (cấu hình giống hệt)
  const subscriber = publisher.duplicate();
  await subscriber.connect();

  let received = 0;

  // Subscribe kênh "news". redis@4: subscribe(channel, listener)
  await subscriber.subscribe(CHANNEL, async (message) => {
    received += 1;
    console.log(`📩 Nhận trên "${CHANNEL}": ${message}`);

    // Khi nhận đủ số message -> dọn dẹp & thoát.
    if (received === MESSAGES.length) {
      await subscriber.unsubscribe(CHANNEL);
      await subscriber.quit();
      await publisher.quit();
      console.log('\n✅ Đã nhận đủ message. Thoát.');
      process.exit(0);
    }
  });
  console.log(`👂 Subscriber đang nghe kênh "${CHANNEL}"...\n`);

  // Publish lần lượt, cách nhau một chút cho dễ quan sát thứ tự.
  for (const msg of MESSAGES) {
    const numSubs = await publisher.publish(CHANNEL, msg);
    console.log(`📤 Publish: "${msg}" -> ${numSubs} subscriber nhận`);
    await new Promise((r) => setTimeout(r, 200));
  }

  // Phòng trường hợp lỗi không thoát: tự kết thúc sau 3s.
  setTimeout(() => {
    console.error('⏰ Hết giờ chờ, thoát.');
    process.exit(1);
  }, 3000);
}

main().catch((err) => {
  console.error('Lỗi:', err);
  process.exit(1);
});
