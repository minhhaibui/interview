// 🔌 src/connect.js — Hàm kết nối dùng chung cho mọi script trong lab.
//
// Dùng driver chính thức "mongodb" (KHÔNG phải Mongoose) để bạn thấy rõ
// API trần của MongoDB. URI lấy từ env MONGO_URL, mặc định trỏ localhost.

const { MongoClient } = require('mongodb');

// Cho phép đổi URL qua biến môi trường (vd khi chạy trong container khác).
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = 'shop';

/**
 * Mở kết nối tới MongoDB và trả về { client, db }.
 * - client: dùng để client.close() khi xong (NHỚ đóng để script thoát).
 * - db:     đối tượng database "shop" để lấy collection.
 */
async function getDb() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);
  console.log(`✅ Đã kết nối MongoDB tại ${MONGO_URL} → database "${DB_NAME}"`);
  return { client, db };
}

module.exports = { getDb };
