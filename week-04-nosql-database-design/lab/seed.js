// 🌱 seed.js — Tạo dữ liệu mẫu cho lab.
//
// CHẠY FILE NÀY TRƯỚC TIÊN:  npm run seed
//
// Sinh ra 3 collection trong database "shop":
//   - users    (~200 docs)
//   - products (~50 docs)
//   - orders   (~2000 docs) — mỗi order EMBED mảng items luôn (không tách bảng)
//
// Script idempotent: xoá sạch collection cũ rồi seed lại từ đầu, chạy bao nhiêu
// lần cũng cho kết quả như nhau.

const { getDb } = require('./src/connect');

// ----- vài helper random nho nhỏ -----
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Vũ', 'Đặng', 'Bùi', 'Đỗ'];
const TEN = ['An', 'Bình', 'Châu', 'Dũng', 'Hà', 'Khánh', 'Linh', 'Minh', 'Nam', 'Phúc', 'Quân', 'Trang'];
const PRODUCT_NAMES = ['Bàn phím', 'Chuột', 'Màn hình', 'Tai nghe', 'Webcam', 'Ổ cứng SSD', 'RAM', 'Loa', 'Cáp USB', 'Sạc dự phòng'];
const STATUSES = ['pending', 'paid', 'shipped', 'completed', 'cancelled'];

async function main() {
  const { client, db } = await getDb();
  try {
    const usersCol = db.collection('users');
    const productsCol = db.collection('products');
    const ordersCol = db.collection('orders');

    // 1) Dọn sạch để seed lặp lại không bị nhân đôi dữ liệu
    await Promise.all([
      usersCol.deleteMany({}),
      productsCol.deleteMany({}),
      ordersCol.deleteMany({}),
    ]);
    console.log('🧹 Đã xoá dữ liệu cũ (nếu có).');

    // 2) USERS (~200)
    const users = [];
    for (let i = 0; i < 200; i++) {
      const name = `${pick(HO)} ${pick(TEN)}`;
      users.push({
        name,
        email: `user${i}@example.com`,
        city: pick(['Hà Nội', 'HCM', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ']),
        createdAt: new Date(Date.now() - randInt(0, 365) * 24 * 3600 * 1000),
      });
    }
    const usersRes = await usersCol.insertMany(users);
    const userIds = Object.values(usersRes.insertedIds);
    console.log(`👤 users:    đã chèn ${usersRes.insertedCount}`);

    // 3) PRODUCTS (~50)
    const products = [];
    for (let i = 0; i < 50; i++) {
      products.push({
        name: `${pick(PRODUCT_NAMES)} ${randInt(1, 99)}`,
        category: pick(['phụ kiện', 'linh kiện', 'âm thanh', 'lưu trữ']),
        price: randInt(50, 2000) * 1000, // VND
        stock: randInt(0, 500),
      });
    }
    const productsRes = await productsCol.insertMany(products);
    const productDocs = products.map((p, idx) => ({ ...p, _id: productsRes.insertedIds[idx] }));
    console.log(`📦 products: đã chèn ${productsRes.insertedCount}`);

    // 4) ORDERS (~2000) — EMBED items vào trong order
    const NOW = Date.now();
    const DAYS = 90; // rải createdAt trong ~90 ngày gần đây
    const orders = [];
    for (let i = 0; i < 2000; i++) {
      const userId = pick(userIds);
      const nItems = randInt(1, 4);
      const items = [];
      let total = 0;
      for (let j = 0; j < nItems; j++) {
        const p = pick(productDocs);
        const qty = randInt(1, 3);
        items.push({ productId: p._id, name: p.name, qty, price: p.price });
        total += qty * p.price;
      }
      orders.push({
        userId,                              // tham chiếu tới users (reference)
        items,                               // EMBED: dữ liệu con nằm ngay trong order
        total,
        status: pick(STATUSES),
        createdAt: new Date(NOW - randInt(0, DAYS) * 24 * 3600 * 1000 - randInt(0, 86400) * 1000),
      });
    }
    const ordersRes = await ordersCol.insertMany(orders);
    console.log(`🧾 orders:   đã chèn ${ordersRes.insertedCount}`);

    console.log('\n🎉 Seed xong! Giờ chạy: npm run crud  →  npm run agg  →  npm run bucket');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('❌ Lỗi seed:', err);
  process.exit(1);
});
