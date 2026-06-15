// 🚀 server.js — HTTP server ZERO-DEPENDENCY (chỉ dùng module core của Node)
// Mục đích: minh hoạ Docker mà KHÔNG vướng npm install (không có dependency ngoài).
// Module core dùng: 'http' (tạo server), 'os' (lấy hostname container), 'net' (nối tới redis).

const http = require('http');
const os = require('os');
const net = require('net');

// 🔧 Đọc cấu hình từ BIẾN MÔI TRƯỜNG (env) — đây là cách Docker truyền config vào container.
// Không hard-code: cùng 1 image có thể chạy ở nhiều môi trường chỉ bằng cách đổi env.
const PORT = process.env.PORT || 3000;
const REDIS_HOST = process.env.REDIS_HOST || 'redis';
const REDIS_PORT = process.env.REDIS_PORT || 6379;

// 📊 Bộ đếm lượt gọi — LƯU TRONG RAM (giữ zero-dep, không cần DB).
// Lưu ý: biến này mất khi container restart, và KHÔNG chia sẻ giữa nhiều instance khi scale.
let hits = 0;

// ⏱️ Mốc thời gian khởi động để tính uptime.
const startedAt = Date.now();

// 🛰️ pingRedis(): minh hoạ GIAO TIẾP SERVICE-TO-SERVICE mà vẫn zero-dep.
// Dùng module 'net' core mở TCP socket tới redis, gửi lệnh PING theo giao thức RESP,
// redis trả về "+PONG\r\n". Đây là cách "thủ công" thay cho thư viện client redis.
function pingRedis() {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: REDIS_HOST, port: Number(REDIS_PORT) });

    // ⏰ Timeout phòng khi redis không phản hồi — tránh treo request mãi mãi.
    socket.setTimeout(2000);

    socket.on('connect', () => {
      // Giao thức RESP đơn giản nhất: gửi chuỗi "PING\r\n".
      socket.write('PING\r\n');
    });

    socket.on('data', (data) => {
      const reply = data.toString().trim(); // mong đợi "+PONG"
      socket.end();
      resolve(reply);
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('redis timeout'));
    });

    socket.on('error', (err) => {
      reject(err);
    });
  });
}

// 🌐 Tạo HTTP server. Một handler xử lý tất cả route.
const server = http.createServer(async (req, res) => {
  // 📝 LOG mỗi request — trong Docker, log ra stdout sẽ được `docker logs` thu lại.
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  // Helper trả JSON gọn gàng.
  const sendJson = (status, obj) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
  };

  // GET / → thông tin cơ bản. hostname = os.hostname() chính là CONTAINER ID,
  // rất hữu ích khi scale nhiều instance để thấy request đi vào container nào.
  if (req.method === 'GET' && req.url === '/') {
    return sendJson(200, {
      message: 'Xin chào từ Docker Lab! 🐳',
      hostname: os.hostname(),
      uptime: Math.round((Date.now() - startedAt) / 1000) + 's',
    });
  }

  // GET /health → endpoint cho HEALTHCHECK của Docker/compose.
  // Phải nhẹ và nhanh; chỉ cần trả 200 là Docker coi container "healthy".
  if (req.method === 'GET' && req.url === '/health') {
    return sendJson(200, { status: 'ok' });
  }

  // GET /hits → đếm số lần gọi (trong RAM).
  if (req.method === 'GET' && req.url === '/hits') {
    hits += 1;
    return sendJson(200, { hits });
  }

  // GET /ping-redis → thử nói chuyện với service 'redis' qua tên service (DNS nội bộ của compose).
  if (req.method === 'GET' && req.url === '/ping-redis') {
    try {
      const reply = await pingRedis();
      return sendJson(200, {
        redis: `${REDIS_HOST}:${REDIS_PORT}`,
        reply, // "+PONG" nếu thành công
        ok: reply.includes('PONG'),
      });
    } catch (err) {
      // 🛡️ Bọc try/catch: nếu chạy `docker run` đơn lẻ (không có redis) thì trả lỗi gọn,
      // app vẫn sống bình thường thay vì crash.
      return sendJson(503, {
        redis: `${REDIS_HOST}:${REDIS_PORT}`,
        ok: false,
        error: err.message,
      });
    }
  }

  // Mọi route khác → 404.
  return sendJson(404, { error: 'Not Found', path: req.url });
});

server.listen(PORT, () => {
  console.log(`✅ Server đang nghe tại http://0.0.0.0:${PORT} (hostname=${os.hostname()})`);
});

// ✋ GRACEFUL SHUTDOWN — RẤT QUAN TRỌNG trong Docker.
// Vì sao? Khi process chạy là PID 1 trong container (CMD ["node","server.js"] dạng exec form),
// Docker gửi tín hiệu SIGTERM khi `docker stop` / `docker compose stop`.
// Mặc định Node KHÔNG tự thoát đẹp; nếu không bắt SIGTERM, Docker chờ ~10s rồi SIGKILL (kill cứng),
// làm rớt request đang xử lý. Bắt SIGTERM để đóng server có trật tự: ngừng nhận request mới,
// xử lý nốt request đang chạy, rồi thoát với code 0.
// SIGINT là khi bạn nhấn Ctrl+C lúc chạy foreground — xử lý tương tự cho tiện dev.
function shutdown(signal) {
  console.log(`\n⚠️  Nhận tín hiệu ${signal} — đang tắt server một cách nhẹ nhàng...`);
  server.close(() => {
    console.log('👋 Đã đóng server. Tạm biệt!');
    process.exit(0);
  });

  // Phòng hờ: nếu sau 5s vẫn chưa đóng xong (có kết nối treo) thì thoát luôn.
  setTimeout(() => {
    console.error('⏱️  Hết thời gian chờ — buộc thoát.');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', () => shutdown('SIGTERM')); // Docker stop
process.on('SIGINT', () => shutdown('SIGINT')); // Ctrl+C
