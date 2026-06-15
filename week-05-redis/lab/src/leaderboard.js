// 🏆 leaderboard.js — Bảng xếp hạng bằng Sorted Set (ZSET)
//
// Sorted Set = tập hợp các member, mỗi member gắn 1 score (số).
// Redis tự sắp xếp theo score -> CỰC hợp cho leaderboard, ranking.
//
// Lệnh dùng (redis@4 camelCase):
//   ZADD            -> client.zAdd(key, [{ score, value }, ...])
//   ZREVRANGE+SCORE -> client.zRangeWithScores(key, start, stop, { REV: true })
//   ZREVRANK        -> client.zRevRank(key, member)   // hạng (0 = cao nhất)
//   ZINCRBY         -> client.zIncrBy(key, delta, member)
//   ZSCORE          -> client.zScore(key, member)

const { getClient } = require('./connect');

const KEY = 'leaderboard:game';

async function main() {
  const client = await getClient();

  // Dọn sạch để demo lặp lại ổn định
  await client.del(KEY);

  // ZADD: nạp điểm cho vài người chơi.
  await client.zAdd(KEY, [
    { score: 1500, value: 'alice' },
    { score: 1200, value: 'bob' },
    { score: 1800, value: 'carol' },
    { score: 900, value: 'dave' },
    { score: 1350, value: 'erin' },
  ]);

  // ZINCRBY: alice ghi thêm 400 điểm -> 1900 (vượt lên dẫn đầu).
  const aliceNew = await client.zIncrBy(KEY, 400, 'alice');
  console.log(`\n➕ alice +400 điểm -> tổng ${aliceNew}`);

  // ZREVRANGE ... WITHSCORES: lấy Top N (điểm cao nhất trước).
  const topN = 3;
  const top = await client.zRangeWithScores(KEY, 0, topN - 1, { REV: true });

  console.log(`\n🏆 TOP ${topN} BẢNG XẾP HẠNG`);
  console.log('┌──────┬────────────┬────────┐');
  console.log('│ Hạng │ Người chơi │  Điểm  │');
  console.log('├──────┼────────────┼────────┤');
  top.forEach((row, i) => {
    const rank = String(i + 1).padEnd(4);
    const name = String(row.value).padEnd(10);
    const score = String(row.score).padStart(6);
    console.log(`│  ${rank}│ ${name} │ ${score} │`);
  });
  console.log('└──────┴────────────┴────────┘');

  // ZREVRANK: hạng của bob (0-based) -> +1 cho thân thiện người dùng.
  const bobRank = await client.zRevRank(KEY, 'bob');
  const bobScore = await client.zScore(KEY, 'bob');
  console.log(`\n🔎 bob đang hạng ${bobRank + 1} với ${bobScore} điểm.`);

  console.log('\n👉 Thử trong redis-cli:');
  console.log(`   ZREVRANGE ${KEY} 0 -1 WITHSCORES   # xem toàn bộ`);
  console.log(`   OBJECT ENCODING ${KEY}             # xem encoding (listpack/skiplist)`);

  await client.quit();
}

main().catch((err) => {
  console.error('Lỗi:', err);
  process.exit(1);
});
