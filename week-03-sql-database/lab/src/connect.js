// 🔌 connect.js — tạo MỘT Pool dùng chung cho cả lab
// pg v8 API: new Pool({...}), pool.query(text, params), pool.connect() lấy 1 client.
const { Pool } = require('pg');

// Đọc cấu hình từ env, có default cho lab (khớp docker-compose.yml).
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'lab',
  password: process.env.PGPASSWORD || 'lab',
  database: process.env.PGDATABASE || 'shop',
  max: 10,                       // tối đa 10 connection trong pool
  connectionTimeoutMillis: 5000, // chờ lấy connection tối đa 5s → fail fast nếu pool cạn
});

// Bắt lỗi của idle client để app không crash bất ngờ.
pool.on('error', (err) => {
  console.error('❌ Lỗi pool (idle client):', err.message);
});

let announced = false;
async function logConnection() {
  // pool.query() tự mượn-trả 1 connection. Gọi 1 truy vấn nhẹ để xác nhận kết nối.
  const { rows } = await pool.query('SELECT current_database() AS db, current_user AS usr');
  if (!announced) {
    console.log(`✅ Đã kết nối Postgres → db=${rows[0].db}, user=${rows[0].usr}`);
    announced = true;
  }
}

// Helper truy vấn nhanh (query đơn lẻ, không transaction).
function query(sql, params) {
  return pool.query(sql, params);
}

// Đóng pool khi script chạy xong để Node thoát sạch.
function close() {
  return pool.end();
}

module.exports = { pool, query, close, logConnection };
