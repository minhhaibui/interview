# 🧪 Lab Docker — Tận tay

Lab này giúp bạn **tự tay** build image, chạy container và hiểu các khái niệm Docker
quan trọng nhất khi phỏng vấn backend: multi-stage build, layer cache, `.dockerignore`,
compose nhiều service, healthcheck, non-root, biến môi trường.

> App được viết **zero-dependency** (chỉ dùng Node core: `http`, `os`, `net`) để bạn
> tập trung 100% vào **Docker**, không vướng `npm install`.

---

## 🎯 Mục tiêu

Sau lab này bạn sẽ:

- Build được image và hiểu **layer** là gì, **cache** hoạt động ra sao.
- Hiểu **multi-stage build** giúp image nhỏ và sạch như thế nào.
- Chạy nhiều service bằng **Docker Compose v2** và cho chúng nói chuyện với nhau.
- Biết vì sao cần **healthcheck**, **non-root user**, **graceful shutdown (SIGTERM)**.
- Truyền cấu hình bằng **biến môi trường**.

**Yêu cầu:** Docker đã cài, Docker Compose v2 (lệnh `docker compose`, không phải `docker-compose`). Node 20 (đã pin trong image).

---

## 🏗️ Kiến trúc

```
┌────────────────────────────────────────────┐
│              Docker Compose                 │
│   (mạng default + DNS theo tên service)     │
│                                             │
│   ┌──────────────┐        ┌──────────────┐  │
│   │     app      │  PING  │    redis     │  │
│   │ Node http    │──────► │ redis:7      │  │
│   │ :3000        │ :6379  │ :6379        │  │
│   └──────┬───────┘        └──────────────┘  │
│          │                                  │
└──────────┼──────────────────────────────────┘
           │ -p 3000:3000
        host: http://localhost:3000
```

Các route của app:

| Route          | Ý nghĩa                                                        |
| -------------- | ------------------------------------------------------------- |
| `GET /`        | JSON `{ message, hostname, uptime }` — `hostname` = container ID |
| `GET /health`  | `200 { status: 'ok' }` — dùng cho healthcheck                  |
| `GET /hits`    | Đếm lượt gọi (lưu trong RAM)                                   |
| `GET /ping-redis` | Mở TCP tới `redis:6379`, gửi `PING`, mong nhận `+PONG`      |

---

## ⚙️ Phần A — Docker cơ bản

> Mọi lệnh chạy **trong thư mục lab này** (`week-07-docker/lab/`).

### A1. Build image

```bash
docker build -t docker-lab .
```

- `-t docker-lab`: đặt tên (tag) cho image.
- `.`: build context = thư mục hiện tại.

Quan sát output: Docker chạy lần lượt từng **layer** (mỗi dòng Dockerfile ~ 1 layer).

### A2. Xem image & size

```bash
docker images docker-lab
```

Ghi lại cột **SIZE** (image alpine + node thường ~130–180MB). So sánh ở Phần B.

### A3. Chạy container (single, không có redis)

```bash
docker run --rm -p 3000:3000 --name lab docker-lab
```

- `-p 3000:3000`: map cổng host→container.
- `--rm`: tự xoá container khi dừng.
- Để chạy nền thêm `-d`.

### A4. Test các route

Mở terminal khác:

```bash
curl localhost:3000
curl localhost:3000/health
curl localhost:3000/hits
curl localhost:3000/ping-redis   # sẽ báo lỗi 503 vì chạy đơn lẻ, chưa có redis — bình thường!
```

### A5. Vào trong container & xem log

```bash
# Lấy container id / tên
docker ps

# Mở shell bên trong (alpine dùng sh, không có bash)
docker exec -it lab sh
#   thử: whoami   (sẽ là appuser, không phải root)
#   thử: ls -la ; env | grep PORT
#   exit để thoát

# Xem log (nếu chạy -d)
docker logs lab
docker logs -f lab   # theo dõi realtime
```

### A6. Dừng & xoá

```bash
docker stop lab        # gửi SIGTERM → app graceful shutdown (xem log thấy "Tạm biệt!")
# vì có --rm nên container tự xoá. Nếu không, xoá bằng:
# docker rm lab
docker rmi docker-lab  # xoá image (khi không cần)
```

---

## 🧱 Phần B — Multi-stage & cache

### B1. Vì sao tách stage?

`Dockerfile` có 2 stage:

- **builder**: cài dependency + copy source (có thể kéo theo npm cache, devDeps...).
- **runtime**: bắt đầu lại từ base sạch, chỉ `COPY --from=builder` phần cần chạy.

→ Image cuối **nhỏ và sạch**, không mang theo công cụ build.

### B2. Quan sát LAYER CACHE

Build lần đầu (đã làm ở A1). Bây giờ **sửa một dòng** trong `app/server.js`
(ví dụ đổi chữ trong `message`), rồi build lại:

```bash
docker build -t docker-lab .
```

Quan sát: các layer `COPY package.json` và `RUN npm install` hiện **CACHED**
(vì package.json không đổi), chỉ layer `COPY app/ ./` trở đi chạy lại.
→ Đó là lý do ta COPY `package.json` **trước**, source code **sau**.

### B3. So sánh size (thử nghiệm)

Bạn có thể tạm tạo một Dockerfile single-stage (chỉ 1 `FROM`, không tách runtime)
và build với tag khác để so size:

```bash
docker images | grep docker-lab
```

Image multi-stage thường gọn hơn vì không dính rác của stage build.

---

## 🌐 Phần C — Compose nhiều service

### C1. Dựng cả app + redis

```bash
docker compose up -d --build
```

- `-d`: chạy nền.
- `--build`: build lại image app trước khi chạy.

### C2. Xem trạng thái

```bash
docker compose ps
```

Cột `STATUS` sẽ thấy `healthy` khi healthcheck pass.

### C3. Test giao tiếp service-to-service

```bash
curl localhost:3000/ping-redis
```

Kết quả mong đợi:

```json
{ "redis": "redis:6379", "reply": "+PONG", "ok": true }
```

→ App đã nói chuyện được với redis **qua TÊN service** `redis` (DNS nội bộ của compose),
không cần biết IP. Đây là **service discovery**.

### C4. Xem log

```bash
docker compose logs -f app
docker compose logs redis
```

---

## 🔍 Quan sát

### Healthcheck

```bash
docker ps          # cột STATUS hiển thị (healthy) / (unhealthy) / (health: starting)
docker inspect --format='{{json .State.Health.Status}}' docker-lab-app
```

### Non-root

```bash
docker compose exec app whoami     # → appuser (KHÔNG phải root)
docker compose exec app id
```

### Graceful shutdown

```bash
docker compose logs -f app   # mở 1 terminal theo dõi log
# terminal khác:
docker compose stop app
# Quan sát log: thấy "Nhận tín hiệu SIGTERM ... Tạm biệt!" → app tắt nhẹ nhàng nhờ bắt SIGTERM.
```

---

## 💪 Bài tập mở rộng

1. **Thêm biến môi trường:** thêm `APP_NAME` vào `docker-compose.yml` (mục `environment`),
   đọc `process.env.APP_NAME` trong `server.js` và trả về ở route `/`. Build lại & kiểm tra.

2. **Giảm size hơn nữa:** thử đổi base runtime sang `node:20-slim` (Debian gọn) hoặc tìm hiểu
   image **distroless** (`gcr.io/distroless/nodejs20`). So sánh `docker images` trước/sau.
   (Lưu ý distroless không có shell → không `docker exec ... sh` được.)

3. **Thêm volume:** gắn volume cho redis để dữ liệu không mất khi restart:
   thêm `volumes: [redisdata:/data]` cho service redis và khai báo `volumes: { redisdata: {} }` cấp top-level.

4. **Resource limits:** thêm giới hạn CPU/RAM cho service app:
   ```yaml
   deploy:
     resources:
       limits:
         cpus: "0.50"
         memory: 128M
   ```
   Kiểm tra bằng `docker stats`.

5. **Scale app:** thử `docker compose up -d --scale app=2`.
   ⚠️ Lưu ý: vì đang map cổng cố định `3000:3000` nên scale sẽ **xung đột cổng** —
   bỏ `ports` cố định (hoặc dùng dải `"3000-3001:3000"`) rồi gọi `/` nhiều lần để thấy
   `hostname` đổi giữa các container. Đây là lúc cần một **load balancer / reverse proxy**.

---

## 🧹 Dọn dẹp

```bash
docker compose down            # dừng & xoá container + mạng của compose
docker compose down -v         # ... và xoá cả volume (nếu có)
docker image prune             # xoá image "dangling" không còn tag
docker system prune            # dọn tổng (cẩn thận: xoá nhiều thứ không dùng)
```

---

## 🎤 Liên hệ câu phỏng vấn

**1. Image vs Container khác nhau thế nào?**
Image là **bản mẫu** chỉ-đọc (gồm các layer: code + runtime + config). Container là một
**instance đang chạy** của image (có process, có lớp ghi-được riêng). 1 image → nhiều container.

**2. Layer là gì? Cache hoạt động sao?**
Mỗi chỉ thị (`FROM/COPY/RUN/...`) tạo 1 layer chỉ-đọc, xếp chồng. Docker **cache** layer:
nếu chỉ thị và input không đổi thì tái dùng layer cũ. Vì thế đặt thứ ít đổi (cài deps) lên trước,
thứ hay đổi (source) ra sau để tối ưu tốc độ build.

**3. Multi-stage build để làm gì?**
Tách giai đoạn **build** (có compiler, devDeps, công cụ) khỏi giai đoạn **runtime**.
Stage runtime chỉ `COPY --from` phần cần chạy → image **nhỏ hơn, ít lỗ hổng hơn**, không lộ công cụ build.

**4. `CMD` vs `ENTRYPOINT`?**
`ENTRYPOINT` là lệnh **chính** luôn chạy; `CMD` cung cấp **tham số mặc định** (hoặc lệnh mặc định)
và **dễ bị override** khi `docker run image <args>`. Hay dùng `ENTRYPOINT` cho binary cố định +
`CMD` cho tham số. Cả hai nên dùng **exec form** (mảng JSON) để nhận tín hiệu SIGTERM đúng cách.

**5. Vì sao chạy container bằng non-root?**
Giảm thiệt hại nếu bị tấn công: user thường không thể leo thang đặc quyền, khó thoát container,
khó ghi vào nơi nhạy cảm. Đây là nguyên tắc **least privilege**. (Ta tạo `appuser` và `USER appuser`.)

**6. `COPY` vs `ADD`?**
`COPY` chỉ sao chép file/thư mục từ build context — **rõ ràng, nên dùng mặc định**.
`ADD` làm thêm "phép thuật": tự giải nén tar local và tải URL từ xa — dễ gây bất ngờ,
nên chỉ dùng khi thực sự cần (ví dụ giải nén tar).

**Bonus — `EXPOSE` có publish cổng không?**
KHÔNG. `EXPOSE` chỉ mang tính tài liệu/metadata. Muốn truy cập từ host phải `-p host:container`.
