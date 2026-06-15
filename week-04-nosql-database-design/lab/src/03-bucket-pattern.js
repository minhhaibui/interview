// 🪣 src/03-bucket-pattern.js — Bucket Pattern cho dữ liệu time-series / nhiều bản ghi.
//
// Chạy:  npm run bucket
//
// VẤN ĐỀ: mỗi sự kiện (vd: 1 lượt xem sản phẩm) lưu thành 1 document riêng.
// Với traffic lớn → HÀNG TRIỆU document tí hon → tốn RAM cho index, đọc theo
// dải thời gian chậm, _id phình to.
//
// GIẢI PHÁP — BUCKET PATTERN: gom nhiều "đo lường" vào 1 document "bucket"
// (theo sản phẩm + theo giờ). Mỗi bucket chứa mảng measurements + count + start.
// → Ít document hơn HÀNG CHỤC lần, đọc 1 dải thời gian chỉ cần vài bucket.

const { getDb } = require('./connect');

const MAX_PER_BUCKET = 60; // ví dụ: tối đa 60 lượt/bucket (mô phỏng 60 phút/giờ)

async function main() {
  const { client, db } = await getDb();
  try {
    const views = db.collection('product_views'); // cách "ngây thơ": 1 doc / sự kiện
    const buckets = db.collection('view_buckets'); // cách bucket: gom lại

    // dọn sạch để chạy lặp lại sạch sẽ
    await views.deleteMany({});
    await buckets.deleteMany({});

    const productId = 'P-001';
    const baseHour = new Date('2026-06-15T08:00:00Z'); // giờ bắt đầu của bucket

    console.log('\n======== Cách 1 (ngây thơ): mỗi sự kiện 1 document ========');
    const naiveDocs = [];
    for (let i = 0; i < 150; i++) {
      naiveDocs.push({ productId, ts: new Date(baseHour.getTime() + i * 1000) });
    }
    await views.insertMany(naiveDocs);
    console.log(`   → ${await views.countDocuments()} document tí hon trong product_views 😱`);

    console.log('\n======== Cách 2 (Bucket): dồn vào bucket theo sản phẩm + giờ ========');

    // Đẩy 150 lượt xem y hệt, nhưng dồn vào các bucket.
    for (let i = 0; i < 150; i++) {
      const measurement = { ts: new Date(baseHour.getTime() + i * 1000) };

      // updateOne với upsert: tìm bucket CHƯA đầy (count < MAX) của product+giờ này.
      //   $push  → thêm phần tử vào mảng measurements
      //   $inc   → tăng count lên 1
      //   $setOnInsert → chỉ set khi tạo bucket mới (lần đầu)
      //   upsert:true  → không có bucket phù hợp thì TẠO MỚI
      await buckets.updateOne(
        { productId, hour: baseHour, count: { $lt: MAX_PER_BUCKET } },
        {
          $push: { measurements: measurement },
          $inc: { count: 1 },
          $setOnInsert: { productId, hour: baseHour, start: measurement.ts },
        },
        { upsert: true },
      );
    }

    const bucketList = await buckets.find({ productId }).sort({ start: 1 }).toArray();
    console.log(`   → 150 lượt xem được gom vào CHỈ ${bucketList.length} bucket 🎉`);
    bucketList.forEach((b, i) => {
      console.log(`   bucket #${i + 1}: count=${b.count}, start=${b.start.toISOString()}, mảng có ${b.measurements.length} phần tử`);
    });

    console.log('\n💡 Lợi ích Bucket Pattern:');
    console.log('   - Ít document hơn nhiều → index nhỏ, nằm gọn trong RAM → nhanh.');
    console.log('   - Đọc theo dải thời gian (vd 1 giờ) chỉ cần lấy vài bucket, không quét triệu doc.');
    console.log('   - Phù hợp time-series: IoT, log, lượt xem, giá chứng khoán theo phút.');

    console.log('\n🧩 Embed vs Reference vs Bucket — chọn thế nào?');
    console.log('   • EMBED: dữ liệu con luôn đọc/ghi cùng cha, số lượng GIỚI HẠN (vd items trong order).');
    console.log('   • REFERENCE: quan hệ nhiều-nhiều, dữ liệu con lớn/độc lập, hay đổi riêng (vd userId trong order).');
    console.log('   • BUCKET: rất nhiều bản ghi nhỏ cùng loại, truy vấn theo dải (time-series).');
    console.log(`   ⚠️  Nhớ giới hạn 16MB/document → đừng embed mảng tăng vô hạn; đó là lúc dùng bucket/reference.`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
