// 🐢 03-n-plus-1.js — N+1 problem + cách diệt + cursor (keyset) pagination
//
// Bạn sẽ thấy:
//   - CÁCH SAI: lấy 10 orders rồi LẶP, mỗi order 1 query items → 1 + N = 11 query.
//   - CÁCH ĐÚNG: 1 query lấy hết items bằng WHERE order_id = ANY($1) → gom trong JS → 2 query.
//   - CURSOR PAGINATION: phân trang bằng keyset (WHERE id < cursor) thay vì OFFSET.
const { query, close, logConnection } = require('./connect');

const ms = (start) => `${(Number(process.hrtime.bigint() - start) / 1e6).toFixed(1)}ms`;

// ---------- CÁCH SAI: N+1 ----------
async function nPlusOne() {
  let queries = 0;
  const start = process.hrtime.bigint();

  const orders = (await query('SELECT id FROM orders ORDER BY id LIMIT 10')).rows;
  queries++; // 1 query lấy danh sách orders

  const result = [];
  for (const o of orders) {
    // ❌ Mỗi vòng lặp là 1 query riêng → N query phụ.
    const items = (await query('SELECT * FROM order_items WHERE order_id = $1', [o.id])).rows;
    queries++;
    result.push({ orderId: o.id, items: items.length });
  }

  console.log('\n❌ CÁCH SAI (N+1):');
  console.log(`   Số query = ${queries} (1 + ${orders.length}) | Thời gian = ${ms(start)}`);
  return result;
}

// ---------- CÁCH ĐÚNG: gộp bằng ANY($1) ----------
async function batched() {
  let queries = 0;
  const start = process.hrtime.bigint();

  const orders = (await query('SELECT id FROM orders ORDER BY id LIMIT 10')).rows;
  queries++;
  const ids = orders.map((o) => o.id);

  // ✅ 1 query duy nhất lấy items của TẤT CẢ order, rồi gom theo order_id trong JS.
  const items = (await query('SELECT * FROM order_items WHERE order_id = ANY($1)', [ids])).rows;
  queries++;

  const byOrder = new Map(ids.map((id) => [id, 0]));
  for (const it of items) byOrder.set(it.order_id, byOrder.get(it.order_id) + 1);

  console.log('\n✅ CÁCH ĐÚNG (gộp bằng ANY):');
  console.log(`   Số query = ${queries} (cố định, không phụ thuộc N) | Thời gian = ${ms(start)}`);
  return [...byOrder].map(([orderId, count]) => ({ orderId, items: count }));
}

// ---------- CURSOR (KEYSET) PAGINATION ----------
async function keysetPagination() {
  console.log('\n📄 CURSOR PAGINATION (keyset, ORDER BY id DESC):');

  // Trang 1: không có cursor → lấy 10 đơn id lớn nhất.
  const page1 = (
    await query('SELECT id, total, status FROM orders ORDER BY id DESC LIMIT 10')
  ).rows;
  console.log('   Trang 1 — id:', page1.map((r) => r.id).join(', '));

  // Cursor = id NHỎ NHẤT của trang vừa lấy.
  const cursor = page1[page1.length - 1].id;

  // Trang 2: WHERE id < cursor → tiếp tục từ chỗ dừng, KHÔNG quét lại trang 1.
  const page2 = (
    await query(
      'SELECT id, total, status FROM orders WHERE id < $1 ORDER BY id DESC LIMIT 10',
      [cursor]
    )
  ).rows;
  console.log(`   Cursor = ${cursor}`);
  console.log('   Trang 2 — id:', page2.map((r) => r.id).join(', '));

  console.log(
    '\n🧠 Vì sao keyset > OFFSET trên bảng lớn?\n' +
    '   - OFFSET 100000 LIMIT 10: DB vẫn phải ĐỌC & BỎ 100000 dòng đầu → càng về sau càng chậm.\n' +
    '   - Keyset (WHERE id < cursor + index trên id): nhảy thẳng tới vị trí cần, thời gian ổn định.\n' +
    '   - Bù lại: keyset không nhảy "tới trang số N" tùy ý, chỉ next/prev theo cursor.'
  );
}

async function main() {
  await logConnection();
  await nPlusOne();
  await batched();
  console.log(
    '\n👉 Cùng kết quả nhưng cách đúng dùng số query CỐ ĐỊNH (2) thay vì tăng theo N.\n' +
    '   Với danh sách 100 phần tử, N+1 = 101 query — nguồn gốc kinh điển của API chậm.'
  );
  await keysetPagination();
}

main()
  .catch((err) => {
    console.error('❌ Lỗi:', err.message);
    process.exitCode = 1;
  })
  .finally(() => close());
