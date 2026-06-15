# 🐳 Dockerfile MULTI-STAGE — chú thích tiếng Việt từng phần
# Multi-stage = nhiều khối "FROM". Khối build (builder) chứa công cụ build,
# khối runtime chỉ giữ thứ cần để CHẠY → image cuối nhỏ và sạch hơn.

# =====================================================================
# 🧱 STAGE 1: builder — nơi cài dependency và chuẩn bị source
# =====================================================================
# Pin chính xác phiên bản base image: node:20-alpine (Alpine = bản Linux siêu nhẹ ~5MB).
# Pin version giúp build LẶP LẠI được (reproducible), tránh "máy tôi chạy được, máy bạn thì không".
FROM node:20-alpine AS builder

# 📂 Thư mục làm việc bên trong image. Mọi lệnh COPY/RUN sau đó chạy ở đây.
WORKDIR /app

# 🎯 THỨ TỰ COPY rất quan trọng cho LAYER CACHE!
# Mỗi dòng trong Dockerfile tạo ra 1 "layer". Docker cache lại layer nếu input không đổi.
# Ta COPY package.json TRƯỚC, cài deps, RỒI MỚI COPY source code.
# => Khi chỉ sửa server.js (không đổi package.json), Docker tái dùng layer cài deps đã cache,
#    không cài lại từ đầu → build nhanh hơn nhiều.
COPY app/package.json ./

# 📦 Cài dependency. App này KHÔNG có dep ngoài, nhưng vẫn để dòng này để minh hoạ quy trình thật.
# --omit=dev: bỏ devDependencies (chỉ giữ deps cần cho production).
# "|| true": vì không có package-lock và không có dep, npm có thể không làm gì — không để build fail.
# (Dự án thật nên dùng `npm ci` cùng package-lock.json để cài deterministic.)
RUN npm install --omit=dev || true

# 📁 Bây giờ mới COPY toàn bộ source code của app.
# Layer này thay đổi mỗi khi sửa code, nhưng nằm SAU layer cài deps nên không phá cache của deps.
COPY app/ ./

# =====================================================================
# 🏃 STAGE 2: runtime — image cuối cùng để chạy, chỉ giữ thứ cần thiết
# =====================================================================
# Vì sao multi-stage giảm size? Stage builder có thể kéo theo npm cache, file tạm, devDeps...
# Stage runtime bắt đầu LẠI từ base sạch, chỉ COPY phần đã build sang → không mang theo rác.
FROM node:20-alpine AS runtime

# 🔐 Tạo user NON-ROOT để chạy app.
# Vì sao non-root? Nếu app bị khai thác, kẻ tấn công chỉ có quyền của user thường,
# khó "thoát" ra ngoài container hay leo thang đặc quyền. Đây là best practice bảo mật.
# addgroup/adduser là lệnh của Alpine (BusyBox). -S = system account, -G = gán nhóm.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# 📂 Thư mục làm việc cho stage runtime.
WORKDIR /app

# 📥 COPY phần đã chuẩn bị từ stage builder sang. --from=builder = lấy từ stage tên 'builder'.
# --chown=appuser:appgroup để file thuộc về user non-root (tránh lỗi quyền khi ghi/đọc).
COPY --from=builder --chown=appuser:appgroup /app ./

# 👤 Từ đây trở đi, container chạy bằng user non-root (không phải root).
USER appuser

# 🌐 Khai báo cổng app lắng nghe (mang tính TÀI LIỆU + dùng cho một số tool).
# EXPOSE KHÔNG tự publish cổng ra host — vẫn cần `-p 3000:3000` khi `docker run`.
EXPOSE 3000

# ❤️ HEALTHCHECK — Docker định kỳ chạy lệnh này để biết container có "khỏe" không.
# Dùng `node -e` gọi http tới /health (zero-dep, không cần curl/wget trong image).
# Nếu lệnh thoát code 0 → healthy; khác 0 → unhealthy. Compose có thể đợi service_healthy.
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# 🚀 CMD dạng EXEC FORM (mảng JSON), KHÔNG dùng shell form ("node server.js").
# Vì sao exec form? Shell form sẽ chạy qua /bin/sh -c, khiến Node KHÔNG nhận trực tiếp PID 1
# và KHÔNG nhận được tín hiệu SIGTERM từ Docker → graceful shutdown hỏng.
# Exec form cho Node làm PID 1 trực tiếp, nhận SIGTERM đúng cách (xem server.js).
CMD ["node", "server.js"]
