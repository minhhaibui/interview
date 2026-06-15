// 🛠️ Admin: tạo topic `orders` với 3 partition và in thông tin.
//
// PARTITION để làm gì?
//  - Partition là đơn vị song song của Kafka. Một topic được chia thành nhiều
//    partition; mỗi partition là một "log" có thứ tự riêng (offset tăng dần).
//  - Nhiều partition => nhiều consumer trong cùng group có thể xử lý song song
//    (mỗi partition do đúng 1 consumer của group đảm nhận).
//  - Thứ tự CHỈ được đảm bảo trong phạm vi 1 partition, không phải toàn topic.
//    Vì vậy ta dùng KEY để dồn các message liên quan (vd cùng userId) vào cùng
//    một partition => giữ đúng thứ tự cho key đó.

const { kafka } = require('./client');

const TOPIC = 'orders';
const NUM_PARTITIONS = 3;

async function main() {
  const admin = kafka.admin();
  await admin.connect();

  try {
    // createTopics trả về false nếu topic đã tồn tại => idempotent, chạy lại OK.
    const created = await admin.createTopics({
      waitForLeaders: true,
      topics: [
        {
          topic: TOPIC,
          numPartitions: NUM_PARTITIONS,
          replicationFactor: 1, // chỉ 1 broker nên không nhân bản được
        },
      ],
    });

    if (created) {
      console.log(`✅ Đã tạo topic "${TOPIC}" với ${NUM_PARTITIONS} partition.`);
    } else {
      console.log(`ℹ️  Topic "${TOPIC}" đã tồn tại, bỏ qua việc tạo.`);
    }

    // In danh sách tất cả topic hiện có.
    const topics = await admin.listTopics();
    console.log('\n📋 Danh sách topic:', topics);

    // Mô tả chi tiết các partition của topic orders.
    const meta = await admin.fetchTopicMetadata({ topics: [TOPIC] });
    for (const t of meta.topics) {
      console.log(`\n🔎 Topic "${t.name}" có ${t.partitions.length} partition:`);
      for (const p of t.partitions) {
        console.log(
          `   • partition ${p.partitionId} → leader broker ${p.leader}`,
        );
      }
    }
  } finally {
    await admin.disconnect();
  }
}

main().catch((err) => {
  console.error('❌ Lỗi admin:', err);
  process.exit(1);
});
