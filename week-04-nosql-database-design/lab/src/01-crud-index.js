// 📝 src/01-crud-index.js — CRUD cơ bản + Index + EXPLAIN.
//
// Chạy:  npm run crud   (NHỚ npm run seed trước).
//
// Bạn sẽ thấy tận mắt:
//   1) insertOne / findOne / updateOne / deleteOne — 4 thao tác CRUD.
//   2) Tạo index thường và compound index.
//   3) explain('executionStats') TRƯỚC và SAU khi có index → so sánh
//      COLLSCAN (quét toàn bộ collection) vs IXSCAN (đi theo index).

const { getDb } = require('./connect');

async function main() {
  const { client, db } = await getDb();
  try {
    const users = db.collection('users');
    const orders = db.collection('orders');

    console.log('\n======== 1) CRUD trên users ========');

    // --- CREATE ---
    const insertRes = await users.insertOne({
      name: 'Người Học Lab',
      email: 'lab@example.com',
      city: 'Hà Nội',
      createdAt: new Date(),
    });
    const newId = insertRes.insertedId;
    console.log('➕ insertOne → _id =', newId.toString());

    // --- READ ---
    let doc = await users.findOne({ _id: newId });
    console.log('🔎 findOne →', { name: doc.name, email: doc.email, city: doc.city });

    // --- UPDATE ($set chỉ sửa field chỉ định, không ghi đè cả document) ---
    const updRes = await users.updateOne({ _id: newId }, { $set: { city: 'Đà Nẵng' } });
    console.log(`✏️  updateOne → matched=${updRes.matchedCount}, modified=${updRes.modifiedCount}`);
    doc = await users.findOne({ _id: newId });
    console.log('   city sau update =', doc.city);

    // --- DELETE ---
    const delRes = await users.deleteOne({ _id: newId });
    console.log(`🗑️  deleteOne → deleted=${delRes.deletedCount}`);

    console.log('\n======== 2) Index + EXPLAIN trên orders ========');

    // Lấy 1 userId thật trong dữ liệu để test query.
    const sample = await orders.findOne({});
    const someUserId = sample.userId;

    // --- EXPLAIN TRƯỚC khi có index ---
    // Xoá index cũ (nếu bạn chạy lại lần 2) để thấy lại cảnh COLLSCAN.
    try {
      await orders.dropIndex('userId_1');
    } catch (_) { /* lần đầu chưa có index thì bỏ qua */ }

    const before = await orders
      .find({ userId: someUserId })
      .explain('executionStats');
    const beforeStage = stageOf(before);
    console.log('\n— TRƯỚC index —');
    console.log(`   stage = ${beforeStage}  (COLLSCAN = quét sạch collection)`);
    console.log(`   totalDocsExamined = ${before.executionStats.totalDocsExamined}`);
    console.log(`   nReturned        = ${before.executionStats.nReturned}`);

    // --- Tạo index đơn ---
    await orders.createIndex({ userId: 1 });
    console.log('\n🏗️  Đã tạo index: { userId: 1 }');

    // --- Tạo compound index theo ESR (Equality → Sort → Range) ---
    // Query mẫu: lọc status (Equality) rồi sort theo createdAt (Sort).
    await orders.createIndex({ status: 1, createdAt: -1 });
    console.log('🏗️  Đã tạo compound index: { status: 1, createdAt: -1 }');

    // --- EXPLAIN SAU khi có index ---
    const after = await orders
      .find({ userId: someUserId })
      .explain('executionStats');
    const afterStage = stageOf(after);
    console.log('\n— SAU index —');
    console.log(`   stage = ${afterStage}  (IXSCAN = đi theo B-tree index, không quét hết)`);
    console.log(`   totalDocsExamined = ${after.executionStats.totalDocsExamined}`);
    console.log(`   nReturned        = ${after.executionStats.nReturned}`);

    console.log('\n💡 Nhận xét:');
    console.log(`   totalDocsExamined giảm từ ${before.executionStats.totalDocsExamined} → ${after.executionStats.totalDocsExamined}.`);
    console.log('   COLLSCAN phải đọc TỪNG document; IXSCAN nhảy thẳng tới đúng vùng dữ liệu.');
    console.log('   Compound index theo ESR: field Equality trước, Sort giữa, Range cuối.');

    console.log('\n📋 Danh sách index hiện có trên orders:');
    const idx = await orders.indexes();
    idx.forEach((i) => console.log('   -', i.name, JSON.stringify(i.key)));
  } finally {
    await client.close();
  }
}

// explain() có thể trả winningPlan lồng nhau (FETCH → IXSCAN). Lấy stage "lõi".
function stageOf(explainOutput) {
  let plan = explainOutput.queryPlanner.winningPlan;
  // đi sâu xuống inputStage cho tới khi gặp IXSCAN/COLLSCAN
  while (plan.inputStage) plan = plan.inputStage;
  return plan.stage;
}

main().catch((err) => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
