// 🚦 rate-limit.js — Rate Limit kiểu Fixed Window bằng INCR + EXPIRE
//
// Quy tắc demo: tối đa 5 request / 10 giây cho mỗi user.
// Cách làm:
//   - Key dạng rl:<user>  (1 cửa sổ thời gian gắn với key này)
//   - INCR key -> nếu kết quả == 1 (lần đầu trong cửa sổ) thì EXPIRE 10s
//   - Nếu count > LIMIT -> chặn (HTTP 429 Too Many Requests)
//
// ⚠️ Hạn chế Fixed Window: "burst ở biên cửa sổ".
//   Ví dụ giới hạn 5/10s: gửi 5 req ở giây thứ 9, rồi 5 req ở giây thứ 11
//   -> 10 req trong ~2 giây mà vẫn hợp lệ vì rơi vào 2 cửa sổ khác nhau.
// 👉 Khắc phục: Sliding Window (log/counter) hoặc Token Bucket.
//    Xem bài tập mở rộng trong LAB.md.

const { getClient } = require('./connect');

const LIMIT = 5;        // số request tối đa
const WINDOW = 10;      // độ dài cửa sổ (giây)

// Trả về { allowed, count, remaining }
async function hitRateLimit(client, userId) {
  const key = `rl:${userId}`;

  // INCR là atomic: an toàn khi nhiều request đồng thời.
  const count = await client.incr(key);

  // Chỉ đặt EXPIRE ở lần đầu của cửa sổ (count === 1),
  // tránh "gia hạn" cửa sổ mỗi lần INCR.
  if (count === 1) {
    await client.expire(key, WINDOW);
  }

  const allowed = count <= LIMIT;
  return { allowed, count, remaining: Math.max(0, LIMIT - count) };
}

async function main() {
  const client = await getClient();
  const userId = 'alice';

  // Dọn key cũ để demo sạch
  await client.del(`rl:${userId}`);

  console.log(`\n🚦 Giới hạn: ${LIMIT} request / ${WINDOW}s cho user "${userId}"\n`);

  // Mô phỏng 8 request liên tiếp -> 5 cái đầu pass, 3 cái sau bị chặn.
  for (let i = 1; i <= 8; i++) {
    const { allowed, count, remaining } = await hitRateLimit(client, userId);
    if (allowed) {
      console.log(`✅ Request #${i}: PASS  (count=${count}, còn lại ${remaining})`);
    } else {
      console.log(`⛔ Request #${i}: 429 TOO MANY REQUESTS (count=${count})`);
    }
  }

  const ttl = await client.ttl(`rl:${userId}`);
  console.log(`\n⏳ Cửa sổ sẽ reset sau ~${ttl}s. Chạy lại sau đó sẽ pass tiếp.`);

  await client.quit();
}

main().catch((err) => {
  console.error('Lỗi:', err);
  process.exit(1);
});
