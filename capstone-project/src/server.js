/**
 * Order Service — entry point.
 * Chạy:  node capstone-project/src/server.js   →  http://localhost:3000
 * Node core thuần, không cần npm install. Kiến trúc: server → router → service → repo.
 */
const http = require('http');
const { Router } = require('./lib/router');
const { AppError } = require('./lib/errors');
const { OrderService } = require('./services/order-service');
const { InMemoryOrderRepo } = require('./repos/order-repo');

const PORT = process.env.PORT || 3000;

// Composition root — wiring dependency ở một chỗ duy nhất
const repo = new InMemoryOrderRepo();
const orderService = new OrderService(repo);
const router = new Router();

router.add('GET', '/health', async () => ({ status: 200, body: { ok: true, uptime: process.uptime() } }));
router.add('POST', '/orders', async req => ({
  status: 201,
  body: await orderService.createOrder(req.body, req.headers['idempotency-key']),
}));
router.add('GET', '/orders/:id', async (req, params) => ({
  status: 200,
  body: await orderService.getOrder(params.id),
}));

/** Đọc body JSON có giới hạn kích thước — chống payload khổng lồ */
function readJson(req, limit = 1e6) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new AppError('Payload quá lớn', 413)); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve(undefined);
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
      catch { reject(new AppError('Body không phải JSON hợp lệ', 400)); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  const send = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
  };

  try {
    const matched = router.match(req.method, pathname);
    if (!matched) return send(404, { error: `Không có route ${req.method} ${pathname}` });
    if (req.method === 'POST' || req.method === 'PUT') req.body = await readJson(req);
    const { status, body } = await matched.handler(req, matched.params);
    send(status, body);
  } catch (err) {
    // AppError là lỗi nghiệp vụ đã phân loại; còn lại là bug → 500 + log
    if (err instanceof AppError) return send(err.statusCode, { error: err.message });
    console.error(err);
    send(500, { error: 'Internal server error' });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`\n  🛒 Order Service đang chạy: http://localhost:${PORT}`);
    console.log('  Thử:  curl -X POST localhost:' + PORT + '/orders -H "content-type: application/json" -H "idempotency-key: demo-1" -d \'{"items":[{"productId":"p1","quantity":2,"price":50000}]}\'\n');
  });

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  function shutdown() {
    console.log('\n  Graceful shutdown…');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref(); // thoát cứng nếu còn kết nối treo
  }
}

module.exports = { server };
