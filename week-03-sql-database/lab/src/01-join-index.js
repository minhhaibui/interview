// 🔍 01-join-index.js — Index & EXPLAIN ANALYZE TẬN TAY
//
// Bạn sẽ thấy: cùng một query lọc orders theo user_id,
//   - TRƯỚC khi có index  → Seq Scan (quét toàn bảng 50k dòng)
//   - SAU khi có index    → Index Scan (nhảy thẳng tới dòng cần)
// và thời gian thực tế khác nhau ra sao.
const { query, close, logConnection } = require('./connect');

// In gọn plan của EXPLAIN ANALYZE và trích ra dòng "actual time".
function printPlan(title, rows) {
  console.log(`\n----- ${title} -----`);
  for (const r of rows) console.log('  ' + r['QUERY PLAN']);
}

// Lấy tổng thời gian thực thi từ output EXPLAIN ANALYZE (dòng "Execution Time: ... ms").
function execTime(rows) {
  const line = rows.map((r) => r['QUERY PLAN']).find((l) => l.includes('Execution Time'));
  return line ? line.trim() : '(không đọc được)';
}

async function main() {
  await logConnection();

  // Chọn 1 user_id có nhiều đơn để query trả về vài dòng (đẹp cho demo).
  const { rows: pick } = await query(
    `SELECT user_id FROM orders GROUP BY user_id ORDER BY count(*) DESC LIMIT 1`
  );
  const userId = pick[0].user_id;
  console.log(`\n🎯 Sẽ EXPLAIN cho query: SELECT * FROM orders WHERE user_id = ${userId}`);

  // Dọn index cũ nếu chạy lại nhiều lần → đảm bảo lần đầu luôn là Seq Scan.
  await query('DROP INDEX IF EXISTS idx_orders_user');

  // ---------- 1) CHƯA có index: kỳ vọng Seq Scan ----------
  const before = await query(
    'EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = $1',
    [userId]
  );
  printPlan('TRƯỚC khi tạo index (kỳ vọng Seq Scan — quét cả 50k dòng)', before.rows);
  const tBefore = execTime(before.rows);

  // ---------- 2) Tạo index B-tree rồi EXPLAIN lại: kỳ vọng Index Scan ----------
  await query('CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)');
  await query('ANALYZE orders'); // cập nhật thống kê để planner chắc chắn chọn index
  const after = await query(
    'EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = $1',
    [userId]
  );
  printPlan('SAU khi tạo index idx_orders_user (kỳ vọng Index Scan)', after.rows);
  const tAfter = execTime(after.rows);

  console.log('\n📊 So sánh thời gian thực thi:');
  console.log('   TRƯỚC (Seq Scan)  :', tBefore);
  console.log('   SAU   (Index Scan):', tAfter);
  console.log(
    '   👉 Index biến việc "đọc hết bảng" thành "nhảy thẳng tới dòng cần".\n' +
    '      Lưu ý: index CHỈ có ích khi điều kiện chọn lọc tốt (ít dòng khớp).\n' +
    '      Nếu query trả về phần lớn bảng, planner vẫn chọn Seq Scan vì rẻ hơn.'
  );

  // ---------- 3) Ví dụ JOIN 3 bảng: users → orders → order_items ----------
  console.log('\n🔗 JOIN users-orders-order_items (đơn hàng + item của 1 user):');
  const joined = await query(
    `SELECT u.name, o.id AS order_id, o.status, oi.product_name, oi.qty, oi.price
       FROM users u
       JOIN orders o      ON o.user_id = u.id
       JOIN order_items oi ON oi.order_id = o.id
      WHERE u.id = $1
      ORDER BY o.id
      LIMIT 8`,
    [userId]
  );
  for (const r of joined.rows) {
    console.log(
      `   order#${r.order_id} [${r.status}] ${r.product_name} x${r.qty} @ ${r.price} — ${r.name}`
    );
  }
  if (joined.rows.length === 0) console.log('   (user này chưa có order_items khớp)');
}

main()
  .catch((err) => {
    console.error('❌ Lỗi:', err.message);
    process.exitCode = 1;
  })
  .finally(() => close());
