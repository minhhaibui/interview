// 🔌 connect.js — Tạo & kết nối Redis client (redis@4)
//
// redis@4 dùng API kiểu Promise:
//   - createClient({ url }) tạo client
//   - await client.connect() để kết nối (KHÁC redis@3 tự connect)
//   - đa số lệnh là async: await client.get(...), await client.set(...)
//
// Module này export 1 hàm tiện dụng để các demo khác tái sử dụng.

const { createClient } = require('redis');

// Đọc cấu hình từ biến môi trường, mặc định localhost:6379.
// Nếu bật requirepass trong redis.conf thì set REDIS_PASSWORD để ghép vào URL.
const HOST = process.env.REDIS_HOST || 'localhost';
const PORT = process.env.REDIS_PORT || '6379';
const PASSWORD = process.env.REDIS_PASSWORD || '';

function buildUrl() {
  // Dạng URL: redis://[:password@]host:port
  const auth = PASSWORD ? `:${PASSWORD}@` : '';
  return `redis://${auth}${HOST}:${PORT}`;
}

/**
 * Tạo client, gắn handler log/lỗi, rồi connect.
 * @returns {Promise<import('redis').RedisClientType>} client đã sẵn sàng dùng
 */
async function getClient() {
  const url = buildUrl();
  const client = createClient({ url });

  // 'error' bắt buộc lắng nghe, nếu không lỗi mạng có thể làm crash process.
  client.on('error', (err) => {
    console.error('❌ Lỗi Redis:', err.message);
  });
  client.on('reconnecting', () => {
    console.log('🔄 Đang kết nối lại Redis...');
  });

  await client.connect();
  console.log(`✅ Đã kết nối Redis tại ${HOST}:${PORT}`);
  return client;
}

module.exports = { getClient };
