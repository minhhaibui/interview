// 📊 src/02-aggregation.js — Aggregation Pipeline làm báo cáo bán hàng.
//
// Chạy:  npm run agg   (NHỚ npm run seed trước).
//
// Aggregation = dây chuyền (pipeline) gồm nhiều "stage". Document chảy qua
// từng stage, mỗi stage biến đổi rồi đẩy sang stage sau — giống Unix pipe.

const { getDb } = require('./connect');

async function main() {
  const { client, db } = await getDb();
  try {
    const orders = db.collection('orders');

    console.log('\n======== Pipeline 1: Top 5 khách chi nhiều nhất ========');

    const topCustomers = await orders.aggregate([
      // $match: lọc trước cho gọn. ⚡ Đặt $match ở ĐẦU pipeline để cắt bớt dữ liệu
      // sớm → các stage sau xử lý ít document hơn, và còn tận dụng được index.
      { $match: { status: 'completed' } },

      // $group: gom theo userId, tính tổng tiền và đếm số đơn.
      {
        $group: {
          _id: '$userId',
          totalSpent: { $sum: '$total' },
          orderCount: { $sum: 1 },
        },
      },

      // $sort: xếp giảm dần theo tổng chi tiêu.
      { $sort: { totalSpent: -1 } },

      // $limit: chỉ lấy top 5 (đặt sau $sort).
      { $limit: 5 },

      // $lookup: JOIN sang collection users để lấy tên (kiểu LEFT JOIN của SQL).
      {
        $lookup: {
          from: 'users',
          localField: '_id',        // _id ở đây chính là userId sau $group
          foreignField: '_id',
          as: 'user',
        },
      },

      // $project: chọn/định dạng field xuất ra cho gọn.
      // $arrayElemAt lấy phần tử đầu của mảng user (vì $lookup trả về mảng).
      {
        $project: {
          _id: 0,
          userId: '$_id',
          name: { $arrayElemAt: ['$user.name', 0] },
          totalSpent: 1,
          orderCount: 1,
        },
      },
    ]).toArray();

    console.log('Hạng | Tên khách             | Số đơn | Tổng chi (VND)');
    console.log('-----+-----------------------+--------+----------------');
    topCustomers.forEach((r, i) => {
      const name = String(r.name || '(không rõ)').padEnd(21);
      console.log(`  ${String(i + 1).padEnd(2)} | ${name} |   ${String(r.orderCount).padEnd(4)} | ${r.totalSpent.toLocaleString('vi-VN')}`);
    });

    console.log('\n======== Pipeline 2: Doanh thu theo ngày ========');

    const revenueByDay = await orders.aggregate([
      // $group theo chuỗi ngày YYYY-MM-DD từ createdAt.
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
      // $sort theo ngày tăng dần để xem theo trình tự thời gian.
      { $sort: { _id: 1 } },
    ]).toArray();

    console.log(`(tổng ${revenueByDay.length} ngày có đơn — in 7 ngày đầu)`);
    console.log('Ngày        | Số đơn | Doanh thu (VND)');
    console.log('------------+--------+----------------');
    revenueByDay.slice(0, 7).forEach((r) => {
      console.log(`${r._id} |   ${String(r.orders).padEnd(4)} | ${r.revenue.toLocaleString('vi-VN')}`);
    });

    console.log('\n💡 Mẹo phỏng vấn: aggregation mạnh hơn find() khi cần GROUP/JOIN/biến đổi.');
    console.log('   find() chỉ lọc + chiếu field; muốn tính tổng/đếm/nhóm thì dùng aggregate.');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
