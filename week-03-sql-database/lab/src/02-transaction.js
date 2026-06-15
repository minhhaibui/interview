// 💸 02-transaction.js — Transaction + Lock TẬN TAY (chuyển tiền giữa 2 account)
//
// Khái niệm minh hoạ:
//   ACID:
//     - Atomicity: trừ tiền A và cộng tiền B hoặc CẢ HAI xảy ra, hoặc KHÔNG gì cả (ROLLBACK).
//     - Consistency: tổng tiền hệ thống không đổi, không ai âm số dư.
//     - Isolation: dùng SELECT ... FOR UPDATE khoá hàng để 2 giao dịch không giẫm chân nhau.
//     - Durability: sau COMMIT, dữ liệu được ghi bền vững.
//   FOR UPDATE: khoá hàng được SELECT cho tới khi COMMIT/ROLLBACK → giao dịch khác phải CHỜ.
//   Khoá theo THỨ TỰ id cố định (nhỏ trước, lớn sau) để TRÁNH DEADLOCK.
const { pool, query, close, logConnection } = require('./connect');

async function getBalances(a, b) {
  const { rows } = await query(
    'SELECT user_id, balance FROM accounts WHERE user_id = ANY($1) ORDER BY user_id',
    [[a, b]]
  );
  return rows;
}

// Chuyển `amount` từ account của fromUserId sang toUserId — trong MỘT transaction.
async function transfer(fromUserId, toUserId, amount) {
  const client = await pool.connect(); // PHẢI dùng cùng 1 client cho cả transaction
  try {
    await client.query('BEGIN');

    // ⚠️ Khoá theo thứ tự id TĂNG DẦN (không theo from/to) để mọi giao dịch
    // luôn khoá id nhỏ trước → không bao giờ tạo vòng chờ chéo → tránh deadlock.
    const [firstId, secondId] = [fromUserId, toUserId].sort((x, y) => x - y);
    await client.query('SELECT balance FROM accounts WHERE user_id = $1 FOR UPDATE', [firstId]);
    await client.query('SELECT balance FROM accounts WHERE user_id = $1 FOR UPDATE', [secondId]);

    // Đọc lại số dư của người gửi (đã được khoá an toàn).
    const { rows } = await client.query(
      'SELECT balance FROM accounts WHERE user_id = $1',
      [fromUserId]
    );
    const fromBalance = Number(rows[0].balance);
    if (fromBalance < amount) {
      // Không đủ tiền → hủy toàn bộ giao dịch (Atomicity).
      throw new Error(
        `Số dư không đủ: user ${fromUserId} có ${fromBalance}, cần chuyển ${amount}`
      );
    }

    await client.query(
      'UPDATE accounts SET balance = balance - $1 WHERE user_id = $2',
      [amount, fromUserId]
    );
    await client.query(
      'UPDATE accounts SET balance = balance + $1 WHERE user_id = $2',
      [amount, toUserId]
    );

    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK'); // có lỗi → trả mọi thứ về như trước BEGIN
    return { ok: false, error: err.message };
  } finally {
    client.release(); // LUÔN trả client về pool, kể cả khi lỗi
  }
}

async function main() {
  await logConnection();
  const A = 1; // user_id 1
  const B = 2; // user_id 2

  console.log('\n💰 Balance TRƯỚC:');
  console.table(await getBalances(A, B));

  // 1) Chuyển hợp lệ (200) → COMMIT.
  console.log('\n➡️  Chuyển 200 từ user 1 → user 2 (hợp lệ)...');
  console.log('   Kết quả:', await transfer(A, B, 200));

  // 2) Chuyển vượt số dư (999999) → ROLLBACK, báo lỗi gọn.
  console.log('\n➡️  Chuyển 999999 từ user 1 → user 2 (vượt số dư, phải ROLLBACK)...');
  console.log('   Kết quả:', await transfer(A, B, 999999));

  console.log('\n💰 Balance SAU:');
  console.table(await getBalances(A, B));
  console.log(
    '\n🧠 Lưu ý: lần chuyển vượt số dư KHÔNG làm thay đổi balance (Atomicity + ROLLBACK).' +
    '\n   Chỉ lần chuyển hợp lệ (200) mới được ghi nhận sau COMMIT.'
  );
}

main()
  .catch((err) => {
    console.error('❌ Lỗi:', err.message);
    process.exitCode = 1;
  })
  .finally(() => close());
