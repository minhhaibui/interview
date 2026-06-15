// 🗄️ cache-aside.js — Pattern Cache-Aside (Lazy Loading)
//
// Ý tưởng: ứng dụng tự quản cache.
//   1) GET cache theo key.
//   2) HIT  -> trả luôn (nhanh).
//   3) MISS -> query DB (chậm), rồi SET vào cache kèm TTL (EX) để lần sau HIT.
//
// Vì sao đặt TTL? Để dữ liệu cache tự hết hạn -> tránh "stale data" sống mãi.
// Đánh đổi: TTL ngắn -> tươi hơn nhưng miss nhiều; TTL dài -> nhanh nhưng dễ cũ.

const { getClient } = require('./connect');

const TTL_SECONDS = 30; // Cache sống 30 giây cho dễ quan sát

// Giả lập một câu query DB CHẬM (~300ms). Trong thực tế là Postgres/Mongo...
function slowDbQuery(id) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ id, name: `User #${id}`, fetchedAt: new Date().toISOString() });
    }, 300);
  });
}

// Lấy user qua cache. Trả về { data, source: 'CACHE'|'DB', ms }
async function getUser(client, id) {
  const key = `user:${id}`;
  const start = Date.now();

  // 1) Thử lấy từ cache
  const cached = await client.get(key);
  if (cached) {
    const ms = Date.now() - start;
    console.log(`⚡ HIT  ${key} (${ms}ms) — lấy từ cache`);
    return { data: JSON.parse(cached), source: 'CACHE', ms };
  }

  // 2) MISS -> đi xuống DB chậm
  console.log(`🐌 MISS ${key} — phải query DB...`);
  const data = await slowDbQuery(id);

  // 3) Ghi vào cache kèm TTL. redis@4: client.set(key, value, { EX: seconds })
  await client.set(key, JSON.stringify(data), { EX: TTL_SECONDS });

  const ms = Date.now() - start;
  console.log(`💾 SET  ${key} (TTL ${TTL_SECONDS}s) — tổng ${ms}ms`);
  return { data, source: 'DB', ms };
}

async function main() {
  const client = await getClient();
  const id = 42;

  console.log('\n--- Lần 1 (kỳ vọng MISS -> chậm vì xuống DB) ---');
  await getUser(client, id);

  console.log('\n--- Lần 2 (kỳ vọng HIT -> nhanh hơn hẳn) ---');
  await getUser(client, id);

  console.log('\n--- Lần 3 (vẫn HIT trong vòng TTL) ---');
  await getUser(client, id);

  console.log(`\n👉 Xem TTL còn lại: docker compose exec redis redis-cli TTL user:${id}`);
  console.log('👉 Đợi >30s rồi chạy lại sẽ MISS lại do cache hết hạn.');

  await client.quit();
}

main().catch((err) => {
  console.error('Lỗi:', err);
  process.exit(1);
});
