# Tuần 7: Docker

> 🌱 **Mới với chủ đề này?** Đọc [`CO-BAN.md`](CO-BAN.md) TRƯỚC — bài nhập môn cực dễ, giải thích bằng ví dụ đời thường, không thuật ngữ khó. Xong rồi quay lại đọc bài đầy đủ bên dưới.

> 🔬 **Có bản đào sâu!** Xem [`DEEP-DIVE.md`](DEEP-DIVE.md) — cơ chế bên trong, ví dụ nâng cao, bẫy production & câu hỏi phỏng vấn KHÓ hơn cho tuần này.

> 🧪 **Có lab tận tay!** Xem [`lab/LAB.md`](lab/LAB.md) — build image multi-stage cho app Node zero-dep, chạy `docker compose` 2 service (app + redis) để hiểu layer cache, non-root, healthcheck, service discovery.

## 🎯 Mục tiêu tuần này

- Hiểu sâu kiến trúc Docker (daemon, client, registry) và phân biệt rõ container vs VM, image vs container.
- Viết được Dockerfile production-grade cho Node.js app: multi-stage build, layer caching, non-root user, image size < 200MB.
- Thành thạo Docker networking, volumes, và viết docker-compose cho stack Node.js + Postgres + Redis + Kafka.
- Xử lý đúng container lifecycle: graceful shutdown với SIGTERM, hiểu PID 1 problem.
- Debug được container đang chạy (logs, exec, inspect) và áp dụng security best practices (scan image, resource limits).

## 📚 Lý thuyết

### Ngày 1-2: Container vs VM, Docker architecture, Image vs Container, Dockerfile cơ bản

#### Container vs VM

| | Virtual Machine | Container |
|---|---|---|
| Ảo hóa | Hardware (qua hypervisor) | OS-level (qua kernel namespaces + cgroups) |
| OS | Mỗi VM có guest OS riêng | Chia sẻ kernel với host |
| Kích thước | GBs | MBs |
| Thời gian boot | Phút | Giây/ms |
| Isolation | Mạnh hơn (tách kernel) | Yếu hơn (chung kernel) |

Container **không phải** là VM nhẹ. Container thực chất là một process bình thường trên host, được isolate bằng 2 cơ chế của Linux kernel:

- **Namespaces**: isolate cái process "nhìn thấy" — PID namespace (process tree riêng), NET namespace (network stack riêng), MNT (filesystem), UTS (hostname), IPC, USER.
- **cgroups** (control groups): giới hạn cái process "được dùng" — CPU, memory, disk I/O, network bandwidth.

```bash
# Chứng minh container chỉ là process trên host:
docker run -d --name test nginx
ps aux | grep nginx   # thấy nginx process ngay trên host (Linux)
```

#### Docker architecture

```
┌──────────────┐   REST API    ┌─────────────────────────┐         ┌──────────────┐
│ Docker CLI   │ ────────────► │ Docker Daemon (dockerd) │ ◄─────► │   Registry   │
│ (client)     │  /var/run/    │  - build images         │  push/  │ (Docker Hub, │
│ docker build │  docker.sock  │  - run containers       │  pull   │  ECR, GHCR)  │
│ docker run   │               │  - manage networks/vols │         └──────────────┘
└──────────────┘               │  └─ containerd ─ runc   │
                               └─────────────────────────┘
```

- **Docker client** (`docker` CLI): gửi lệnh qua REST API tới daemon (qua Unix socket `/var/run/docker.sock` hoặc TCP).
- **Docker daemon** (`dockerd`): nhận lệnh, quản lý objects (images, containers, networks, volumes). Bên dưới ủy quyền cho **containerd** (quản lý lifecycle container) và **runc** (thực sự tạo container theo chuẩn OCI).
- **Registry**: nơi lưu trữ image (Docker Hub, AWS ECR, GitHub Container Registry...). `docker pull/push` làm việc với registry.

> Câu hỏi phỏng vấn hay gặp: "Mount `/var/run/docker.sock` vào container có rủi ro gì?" → Container đó có toàn quyền điều khiển Docker daemon = root trên host (container escape).

#### Image vs Container

- **Image**: template **read-only**, gồm nhiều **layers** xếp chồng (mỗi layer là diff của filesystem). Image được định danh bằng tag hoặc digest (`sha256:...`).
- **Container**: instance **đang chạy** (hoặc đã dừng) của image. Docker thêm một **writable layer** mỏng lên trên image (copy-on-write). Xóa container → mất writable layer (vì vậy data cần persist phải dùng volume).

```bash
docker image ls                 # liệt kê images
docker history node:22-alpine  # xem các layers của image
docker ps -a                    # liệt kê containers (kể cả đã stop)
```

#### Dockerfile cơ bản cho Node.js

```dockerfile
# Dockerfile (phiên bản naive — sẽ tối ưu ở ngày 3-4)
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

Các instruction quan trọng:

- `FROM`: base image. Luôn pin version cụ thể (`node:22.11-alpine`), không dùng `latest`.
- `RUN`: chạy lệnh **lúc build**, tạo layer mới.
- `CMD` vs `ENTRYPOINT`: `ENTRYPOINT` là lệnh cố định, `CMD` là tham số mặc định (có thể override khi `docker run`). Kết hợp: `ENTRYPOINT ["node"]` + `CMD ["server.js"]`.
- `COPY` vs `ADD`: dùng `COPY` (rõ ràng). `ADD` có thêm magic (tự giải nén tar, tải URL) — chỉ dùng khi thật sự cần.
- **Exec form vs shell form**: `CMD ["node", "server.js"]` (exec form — node là PID 1, nhận signal trực tiếp) vs `CMD node server.js` (shell form — `/bin/sh -c` là PID 1, **node không nhận SIGTERM**). Luôn dùng exec form.

### Ngày 3-4: Dockerfile best practices, multi-stage build, base image, networking, volumes, docker-compose

#### Layer caching & thứ tự lệnh

Docker cache theo từng layer: nếu một layer thay đổi, **tất cả layers sau nó** bị rebuild. Nguyên tắc: **lệnh ít thay đổi đặt trước, hay thay đổi đặt sau**.

```dockerfile
# ❌ SAI: mỗi lần sửa code → npm ci chạy lại (chậm)
COPY . .
RUN npm ci

# ✅ ĐÚNG: chỉ khi package*.json đổi thì npm ci mới chạy lại
COPY package*.json ./
RUN npm ci
COPY . .
```

#### .dockerignore

Giảm build context (tăng tốc build, tránh leak secrets, tránh phá vỡ cache):

```
node_modules
npm-debug.log
.git
.env
*.md
coverage
dist
.vscode
Dockerfile
docker-compose*.yml
```

#### Multi-stage build cho Node.js (ví dụ TypeScript app)

Multi-stage giúp: (1) image cuối không chứa devDependencies, compiler, source TS; (2) giảm size từ ~1.2GB xuống < 200MB; (3) giảm attack surface.

```dockerfile
# ---------- Stage 1: build ----------
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci                       # cài cả devDependencies để build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build                # tsc -> dist/

# ---------- Stage 2: production deps ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---------- Stage 3: runtime ----------
FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
# tạo non-root user (image node đã có sẵn user "node")
USER node
COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node package.json ./
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/server.js"]
```

So sánh size thực tế (Express + TS app điển hình):

| Cách build | Size |
|---|---|
| `node:22` single-stage | ~1.1 GB |
| `node:22-slim` single-stage | ~350 MB |
| `node:22-alpine` multi-stage | ~150 MB |
| distroless multi-stage | ~130 MB |

#### Base image: alpine vs slim vs distroless

- **`node:22-alpine`** (~80MB base): nhỏ nhất phổ biến, dùng **musl libc** thay glibc → một số native modules (bcrypt, sharp, grpc) có thể lỗi hoặc chậm hơn; DNS resolver từng có bug. Có shell → dễ debug.
- **`node:22-slim`** (~200MB base): Debian rút gọn, dùng glibc → tương thích tốt nhất với native modules. Lựa chọn an toàn cho production.
- **`gcr.io/distroless/nodejs22`**: không có shell, không package manager → attack surface nhỏ nhất, bảo mật cao nhất. Nhược: khó debug (không `exec sh` được), phải dùng `kubectl debug`/ephemeral container.

Khuyến nghị: **slim** cho production khi có native deps; **alpine** khi cần nhỏ và đã test kỹ; **distroless** khi security là ưu tiên số 1.

#### Docker networking

- **bridge** (mặc định): Docker tạo virtual bridge `docker0`. Container trên cùng **user-defined bridge network** gọi nhau bằng **container name** (Docker DNS nội bộ). Default bridge KHÔNG có DNS theo tên — vì vậy luôn tạo network riêng.
- **host**: container dùng network stack của host trực tiếp (không port mapping, hiệu năng tốt, mất isolation). Chỉ Linux.
- **overlay**: network trải dài nhiều hosts (Docker Swarm / multi-host).
- **none**: không network.

```bash
docker network create app-net
docker run -d --name pg --network app-net postgres:16
docker run -d --name api --network app-net -p 3000:3000 my-api
# trong container api: kết nối postgres qua host "pg" (DATABASE_URL=postgres://...@pg:5432/db)
```

`-p 3000:3000` = publish port: host:container, dùng iptables NAT.

#### Volumes & bind mounts

- **Named volume** (`-v pgdata:/var/lib/postgresql/data`): Docker quản lý, lưu ở `/var/lib/docker/volumes/`. Dùng cho **data persistence** (DB).
- **Bind mount** (`-v $(pwd)/src:/app/src`): map thư mục host vào container. Dùng cho **development** (hot reload).
- **tmpfs**: trong RAM, mất khi container dừng. Dùng cho secrets/temp data.

#### docker-compose: stack Node.js + Postgres + Redis + Kafka

```yaml
# docker-compose.yml
services:
  api:
    build:
      context: .
      target: runner            # multi-stage target
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://app:secret@postgres:5432/appdb
      REDIS_URL: redis://redis:6379
      KAFKA_BROKERS: kafka:9092
    depends_on:
      postgres:
        condition: service_healthy   # chờ healthcheck pass, không chỉ "started"
      redis:
        condition: service_healthy
      kafka:
        condition: service_healthy
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: appdb
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d appdb"]
      interval: 5s
      timeout: 3s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  kafka:
    image: bitnami/kafka:3.7      # KRaft mode, không cần Zookeeper
    environment:
      KAFKA_CFG_NODE_ID: 0
      KAFKA_CFG_PROCESS_ROLES: controller,broker
      KAFKA_CFG_CONTROLLER_QUORUM_VOTERS: 0@kafka:9093
      KAFKA_CFG_LISTENERS: PLAINTEXT://:9092,CONTROLLER://:9093
      KAFKA_CFG_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
      KAFKA_CFG_CONTROLLER_LISTENER_NAMES: CONTROLLER
    volumes:
      - kafkadata:/bitnami/kafka
    healthcheck:
      test: ["CMD-SHELL", "kafka-topics.sh --bootstrap-server localhost:9092 --list"]
      interval: 10s
      timeout: 10s
      retries: 10

volumes:
  pgdata:
  redisdata:
  kafkadata:
```

Lưu ý quan trọng: `depends_on` mặc định chỉ chờ container **start**, không chờ service **ready** → dùng `condition: service_healthy` + healthcheck, và app vẫn nên có retry logic khi connect DB.

### Ngày 5-6: Resource limits, healthcheck, security, debugging, lifecycle & signals

#### Resource limits

```bash
docker run -d \
  --memory=512m --memory-swap=512m \   # hard limit RAM; swap = memory => không swap
  --cpus=1.5 \                          # tối đa 1.5 CPU cores
  --pids-limit=256 \                    # chống fork bomb
  my-api
```

Với Node.js cần chú ý: V8 mặc định không "thấy" cgroup memory limit ở Node cũ → đặt `NODE_OPTIONS=--max-old-space-size=400` (khoảng 75-80% memory limit) để tránh container bị OOMKilled trước khi V8 GC kịp. Node 12+ đã hỗ trợ detect cgroup limit nhưng đặt tường minh vẫn an toàn hơn.

#### Healthcheck

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node healthcheck.js
```

```js
// healthcheck.js — tránh phụ thuộc curl/wget (distroless không có)
const http = require('http');
const req = http.get('http://localhost:3000/health', (res) => {
  process.exit(res.statusCode === 200 ? 0 : 1);
});
req.on('error', () => process.exit(1));
req.setTimeout(2000, () => { req.destroy(); process.exit(1); });
```

Lưu ý: Kubernetes **bỏ qua** Docker HEALTHCHECK — K8s dùng probes riêng (tuần 8).

#### Security best practices

1. **Non-root user**: mặc định container chạy root. Nếu attacker khai thác được app → root trong container, nguy hiểm khi kết hợp với misconfiguration (mounted socket, privileged).
   ```dockerfile
   # image node có sẵn user "node" (uid 1000)
   USER node
   # hoặc tự tạo:
   RUN addgroup -S app && adduser -S app -G app
   USER app
   ```
2. **Scan image**: `docker scout cves my-api:latest` hoặc `trivy image my-api:latest`. Tích hợp vào CI, fail build nếu có CRITICAL CVE.
3. **Không nhúng secrets vào image**: `ENV API_KEY=...` hay `COPY .env` đều nằm vĩnh viễn trong layer (xem được bằng `docker history`). Dùng runtime env, Docker secrets, hoặc BuildKit secret mount: `RUN --mount=type=secret,id=npmrc npm ci`.
4. **Read-only filesystem**: `docker run --read-only --tmpfs /tmp my-api`.
5. **Drop capabilities**: `--cap-drop=ALL --cap-add=NET_BIND_SERVICE`.
6. **Pin image bằng digest** cho production: `node:22-alpine@sha256:...`.

#### Debugging container

```bash
docker logs -f --tail 100 api          # xem stdout/stderr (app nên log ra stdout, không file)
docker exec -it api sh                 # vào shell container đang chạy
docker inspect api                     # full config JSON: IP, mounts, env, restart policy
docker inspect -f '{{.State.OOMKilled}}' api   # check bị OOM kill?
docker stats                           # CPU/RAM realtime
docker top api                         # processes trong container
docker events                          # stream sự kiện daemon
docker diff api                        # file thay đổi so với image
docker cp api:/app/heapdump.heapsnapshot .   # copy file ra ngoài
```

Exit codes hay gặp: `137` = SIGKILL (thường OOMKilled hoặc stop timeout), `139` = segfault, `143` = SIGTERM (graceful), `1` = app error.

#### Container lifecycle & signals — PID 1 problem

Khi `docker stop`:
1. Docker gửi **SIGTERM** tới **PID 1** trong container.
2. Chờ grace period (mặc định **10s**, chỉnh bằng `-t`).
3. Hết thời gian → gửi **SIGKILL** (không thể bắt được, mất data đang xử lý).

**PID 1 problem**: process PID 1 trong Linux có 2 đặc thù:
- Kernel **không áp default signal handlers** cho PID 1 → nếu Node không tự đăng ký handler, SIGTERM bị **bỏ qua** → container luôn chờ 10s rồi bị SIGKILL.
- PID 1 phải **reap zombie processes** (con mồ côi) — Node không làm việc này.

Ngoài ra, nếu dùng **shell form** (`CMD node server.js`), PID 1 là `sh` và sh **không forward signal** cho node → node không bao giờ nhận SIGTERM.

Giải pháp:

```dockerfile
# Cách 1: dùng tini làm init process (reap zombies + forward signals)
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]

# Cách 2: docker run --init my-api  (Docker tự chèn tini)
```

```js
// Graceful shutdown chuẩn cho Node.js trong container
const server = app.listen(3000);

async function shutdown(signal) {
  console.log(`${signal} received, shutting down gracefully...`);
  // 1. Ngừng nhận request mới, chờ request đang xử lý xong
  server.close(async () => {
    // 2. Đóng các kết nối ngoài
    await db.end();
    await redis.quit();
    await kafkaConsumer.disconnect();
    process.exit(0);
  });
  // 3. Force exit nếu quá lâu (trước khi Docker SIGKILL)
  setTimeout(() => process.exit(1), 8000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

## 💬 Top 15 câu hỏi phỏng vấn thường gặp

**Q1: Container khác VM thế nào?**
**A:** VM ảo hóa phần cứng qua hypervisor, mỗi VM chạy guest OS riêng nên nặng (GBs) và boot chậm. Container ảo hóa ở mức OS, chia sẻ kernel với host, isolate bằng namespaces (cái process thấy) và cgroups (tài nguyên process dùng). Container nhẹ hơn, boot nhanh hơn nhưng isolation yếu hơn VM vì chung kernel.

**Q2: Image và container khác nhau thế nào?**
**A:** Image là template read-only gồm nhiều layers xếp chồng. Container là instance runtime của image, Docker thêm một writable layer (copy-on-write) lên trên. Một image chạy được nhiều containers; xóa container thì mất writable layer nên data cần persist phải dùng volume.

**Q3: Layer caching hoạt động thế nào và tối ưu Dockerfile ra sao?**
**A:** Mỗi instruction tạo một layer; nếu một layer thay đổi thì mọi layer sau bị rebuild. Vì vậy đặt lệnh ít thay đổi lên trước: COPY package*.json rồi npm ci trước, COPY source code sau — sửa code không làm chạy lại npm ci. Kèm theo dùng .dockerignore để loại node_modules, .git khỏi build context.

**Q4: Multi-stage build là gì, tại sao quan trọng với Node.js?**
**A:** Là kỹ thuật dùng nhiều FROM trong một Dockerfile: stage build cài đủ devDependencies và compile TypeScript, stage runtime chỉ COPY --from dist/ và production node_modules. Kết quả image cuối nhỏ hơn nhiều (1.1GB → ~150MB), không chứa compiler/dev tools nên giảm attack surface.

**Q5: CMD và ENTRYPOINT khác nhau thế nào?**
**A:** ENTRYPOINT là lệnh cố định của container, CMD là tham số mặc định có thể bị override khi `docker run image <args>`. Kết hợp cả hai: ENTRYPOINT ["node"], CMD ["server.js"]. Quan trọng: luôn dùng exec form (JSON array) để process nhận signal trực tiếp, shell form sẽ bọc qua `sh -c` làm mất signal.

**Q6: COPY và ADD khác nhau thế nào?**
**A:** Cả hai copy file vào image, nhưng ADD có thêm tính năng tự giải nén tar local và tải từ URL. Best practice là luôn dùng COPY vì hành vi rõ ràng, dễ đoán; chỉ dùng ADD khi thực sự cần auto-extract tar.

**Q7: PID 1 problem trong Docker là gì?**
**A:** Process PID 1 không được kernel áp default signal handler và phải chịu trách nhiệm reap zombie processes. Nếu Node chạy như PID 1 mà không đăng ký handler, SIGTERM bị bỏ qua, container chờ hết grace period rồi bị SIGKILL. Giải pháp: đăng ký process.on('SIGTERM') trong code và dùng tini (`docker run --init` hoặc ENTRYPOINT tini) để reap zombies và forward signals.

**Q8: docker stop hoạt động thế nào? Làm graceful shutdown cho Node.js ra sao?**
**A:** docker stop gửi SIGTERM tới PID 1, chờ grace period (mặc định 10s) rồi gửi SIGKILL. Trong Node.js, bắt SIGTERM rồi gọi server.close() để ngừng nhận request mới và chờ request đang xử lý xong, sau đó đóng DB/Redis/Kafka connections, cuối cùng process.exit(0); thêm timeout force-exit ngắn hơn grace period để không bị SIGKILL giữa chừng.

**Q9: Named volume và bind mount khác nhau thế nào, khi nào dùng gì?**
**A:** Named volume do Docker quản lý (trong /var/lib/docker/volumes), phù hợp persist data production như Postgres data. Bind mount map trực tiếp thư mục host vào container, phù hợp development để hot reload code. Volume có lifecycle độc lập với container, dễ backup và không phụ thuộc cấu trúc thư mục host.

**Q10: Các Docker network drivers? Container trong cùng compose gọi nhau thế nào?**
**A:** Bridge (mặc định, NAT qua docker0), host (dùng network host trực tiếp, không isolation), overlay (multi-host), none. Compose tự tạo một user-defined bridge network, các services resolve nhau qua Docker DNS bằng service name — ví dụ api kết nối `postgres:5432` thay vì IP. Lưu ý default bridge không có DNS theo tên, phải là user-defined network.

**Q11: alpine, slim, distroless — chọn base image nào cho Node.js?**
**A:** Alpine nhỏ nhất nhưng dùng musl libc nên native modules (sharp, bcrypt) có thể gặp vấn đề. Slim là Debian rút gọn với glibc, tương thích tốt nhất — lựa chọn an toàn cho production. Distroless không có shell/package manager, bảo mật nhất nhưng khó debug. Chọn slim làm mặc định, alpine khi đã test kỹ, distroless khi yêu cầu security cao.

**Q12: Tại sao không nên chạy container bằng root? Làm sao để không?**
**A:** Mặc định process trong container chạy với uid 0; nếu app bị khai thác, attacker là root trong container và có thể escape khi có misconfiguration (mount docker.sock, privileged mode, kernel exploit). Khắc phục: thêm USER node trong Dockerfile (image node có sẵn user này), COPY --chown đúng quyền, kết hợp --read-only, --cap-drop=ALL.

**Q13: Secrets không nên đưa vào image thế nào cho đúng?**
**A:** ENV hay COPY .env trong Dockerfile sẽ nằm vĩnh viễn trong layer, ai pull image cũng đọc được qua docker history/inspect. Đúng cách: inject qua environment lúc runtime, dùng Docker/K8s secrets, hoặc BuildKit secret mount (RUN --mount=type=secret) khi cần secret lúc build như .npmrc cho private registry.

**Q14: depends_on trong compose có đảm bảo Postgres sẵn sàng trước khi app start không?**
**A:** Không — depends_on mặc định chỉ chờ container started, không chờ service ready. Phải dùng `depends_on: condition: service_healthy` kết hợp healthcheck (pg_isready) trên service postgres. Ngoài ra app vẫn nên có retry/backoff khi connect DB vì trong production orchestrator không đảm bảo thứ tự.

**Q15: Container bị kill với exit code 137, anh/chị debug thế nào?**
**A:** 137 = 128 + 9 (SIGKILL), thường do OOMKilled hoặc không shutdown kịp grace period. Kiểm tra `docker inspect -f '{{.State.OOMKilled}}'`, xem docker stats/logs, dmesg trên host. Nếu OOM: tăng memory limit hoặc đặt --max-old-space-size cho V8 khoảng 75-80% limit và tìm memory leak; nếu do shutdown chậm: sửa graceful shutdown handler.

## 💪 Bài tập thực hành (bắt buộc)

### Bài 1: Dockerize Express app cơ bản
**Đề bài:** Tạo Express app có 2 endpoints: `GET /health` trả `{status: "ok"}` và `GET /api/users` trả mảng users hardcode. Viết Dockerfile single-stage với node:22-alpine, kèm `.dockerignore`.
**Yêu cầu output:** `docker build -t myapp:v1 .` thành công; `docker run -p 3000:3000 myapp:v1` và `curl localhost:3000/health` trả 200; `docker image ls` cho size < 200MB; build lần 2 sau khi sửa code không chạy lại `npm ci` (cache hit).
**Gợi ý:** COPY package*.json trước, npm ci, rồi mới COPY src; nhớ exec form cho CMD.

### Bài 2: Multi-stage build cho TypeScript app
**Đề bài:** Chuyển app bài 1 sang TypeScript. Viết Dockerfile 3 stages (builder, deps, runner): builder compile TS, runner chỉ chứa dist/ + production deps, chạy bằng user `node`.
**Yêu cầu output:** Image cuối < 160MB; `docker exec <id> whoami` trả `node`; trong image cuối không tồn tại `tsc` lẫn devDependencies (`docker exec <id> ls node_modules/.bin` không có tsc); so sánh size 2 image bài 1 vs bài 2 trong bảng.
**Gợi ý:** `npm ci --omit=dev` ở stage deps riêng; COPY --chown=node:node.

### Bài 3: Graceful shutdown & signal handling
**Đề bài:** Thêm endpoint `GET /slow` (chờ 5s mới response). Implement graceful shutdown: bắt SIGTERM, ngừng nhận request mới, chờ request đang chạy xong, đóng kết nối rồi exit 0. Test cả 2 trường hợp: có và không có signal handler.
**Yêu cầu output:** Chạy `curl localhost:3000/slow &` rồi `docker stop app` ngay: request slow vẫn nhận được response đầy đủ, container exit code 0 (xem bằng `docker inspect -f '{{.State.ExitCode}}'`), thời gian stop < 6s. Phiên bản KHÔNG có handler: chứng minh container chờ đủ 10s rồi exit 137.
**Gợi ý:** server.close(callback) + đếm connections; log timestamp khi nhận SIGTERM để chứng minh.

### Bài 4: docker-compose full stack
**Đề bài:** Viết docker-compose.yml chạy: app Node.js (build từ Dockerfile bài 2, thêm route ghi/đọc Postgres và cache Redis), Postgres 16, Redis 7, Kafka (KRaft). App có producer gửi message vào topic `events` mỗi khi tạo user, và một consumer service riêng (cùng codebase, command khác) log message ra console.
**Yêu cầu output:** `docker compose up -d` xong, `POST /api/users` lưu vào Postgres, `GET /api/users` lần 2 trả từ Redis cache (đo bằng header `X-Cache: HIT`), consumer log được event; `docker compose down && up` không mất data Postgres (named volume); tất cả services có healthcheck và app chỉ start khi deps healthy.
**Gợi ý:** depends_on với condition: service_healthy; KAFKA_CFG_ADVERTISED_LISTENERS phải là `kafka:9092` cho internal.

### Bài 5: Hardening & debugging
**Đề bài:** Hardening image bài 4: non-root, read-only filesystem (--read-only + tmpfs /tmp), memory limit 256MB + `--max-old-space-size=200`, HEALTHCHECK bằng script Node (không curl), scan bằng Trivy và sửa các CRITICAL CVEs (nâng base image). Sau đó cố tình tạo memory leak (mảng global push mỗi request) và debug đến khi xác định được nguyên nhân OOM.
**Yêu cầu output:** `trivy image myapp:v3 --severity CRITICAL` trả 0 CVE; `docker inspect` cho thấy ReadonlyRootfs=true, Memory=268435456; sau khi bắn 1000 requests vào route leak, chứng minh container OOMKilled (inspect .State.OOMKilled=true) và viết 5-10 dòng giải thích cách phát hiện leak bằng docker stats + heapsnapshot.
**Gợi ý:** dùng `autocannon` để bắn load; `docker stats --no-stream` theo dõi RAM tăng dần.

## 📝 Bài test cuối tuần

### Phần 1: Quiz 15 câu trắc nghiệm

**Câu 1:** Cơ chế nào của Linux kernel giúp container giới hạn lượng CPU/memory được dùng?
A. Namespaces  B. cgroups  C. seccomp  D. chroot

**Câu 2:** `docker stop` gửi signal gì đầu tiên, và sau grace period gửi gì?
A. SIGKILL rồi SIGTERM  B. SIGINT rồi SIGKILL  C. SIGTERM rồi SIGKILL  D. SIGHUP rồi SIGTERM

**Câu 3:** Dockerfile có `CMD node server.js` (shell form). Vấn đề là gì?
A. Không có vấn đề  B. node không nhận SIGTERM vì sh là PID 1  C. Image to hơn  D. Không chạy được trên alpine

**Câu 4:** Để tận dụng layer cache tốt nhất khi build Node.js app, thứ tự đúng là:
A. COPY . . → RUN npm ci  B. RUN npm ci → COPY . .  C. COPY package*.json → RUN npm ci → COPY . .  D. Thứ tự không quan trọng

**Câu 5:** Image `node:22-alpine` dùng libc nào?
A. glibc  B. musl  C. uclibc  D. bionic

**Câu 6:** Container A và B trên **default bridge network**. A có gọi B bằng tên container được không?
A. Được, Docker DNS luôn bật  B. Không, DNS theo tên chỉ có trên user-defined network  C. Chỉ được nếu cùng image  D. Chỉ được khi dùng --link... là cách khuyến nghị hiện nay

**Câu 7:** Data của Postgres trong container nên lưu bằng gì?
A. Writable layer của container  B. Bind mount tới /tmp  C. Named volume  D. ENV variable

**Câu 8:** `depends_on` (không có condition) trong compose đảm bảo điều gì?
A. Service phụ thuộc đã healthy  B. Service phụ thuộc đã started (container chạy)  C. Port đã mở  D. DB đã accept connections

**Câu 9:** Container exit code 137 nghĩa là gì?
A. App return 137  B. SIGTERM  C. SIGKILL (thường OOMKilled hoặc stop quá grace period)  D. Segfault

**Câu 10:** Lệnh nào xem container có bị OOMKilled không?
A. docker logs  B. docker inspect -f '{{.State.OOMKilled}}' <c>  C. docker top  D. docker diff

**Câu 11:** Vì sao `ENV API_KEY=xxx` trong Dockerfile là sai cho production secrets?
A. ENV không hoạt động trong container  B. Giá trị nằm trong image layer, đọc được qua docker history  C. Làm image chậm hơn  D. ENV chỉ dùng được lúc build

**Câu 12:** Lợi ích CHÍNH của multi-stage build với Node.js TypeScript app?
A. Build nhanh hơn  B. Image cuối không chứa devDependencies/compiler → nhỏ và an toàn hơn  C. Không cần .dockerignore  D. Tự động minify code

**Câu 13:** `tini` (hoặc `docker run --init`) giải quyết vấn đề gì?
A. Tăng tốc startup  B. Reap zombie processes và forward signals khi app là PID 1  C. Giảm image size  D. Tự restart app khi crash

**Câu 14:** Network driver nào cho phép containers giao tiếp xuyên nhiều Docker hosts?
A. bridge  B. host  C. overlay  D. none

**Câu 15:** Node.js app trong container limit 512MB RAM. Cấu hình nào hợp lý nhất?
A. --max-old-space-size=512  B. --max-old-space-size=400 (≈75-80% limit)  C. --max-old-space-size=1024  D. Không cần cấu hình gì

<details><summary>Đáp án</summary>

1. **B** — cgroups giới hạn tài nguyên; namespaces chỉ isolate cái process "nhìn thấy".
2. **C** — SIGTERM trước, hết grace period (mặc định 10s) thì SIGKILL.
3. **B** — Shell form bọc qua `sh -c`, sh là PID 1 và không forward SIGTERM cho node.
4. **C** — Copy manifest trước để npm ci được cache khi chỉ sửa code.
5. **B** — Alpine dùng musl libc, có thể gây vấn đề với native modules build cho glibc.
6. **B** — Default bridge không có embedded DNS theo container name; phải tạo user-defined network.
7. **C** — Named volume có lifecycle độc lập, persist qua các lần recreate container.
8. **B** — Chỉ chờ container started; muốn chờ ready phải dùng condition: service_healthy + healthcheck.
9. **C** — 137 = 128+9 (SIGKILL), thường gặp do OOM hoặc không shutdown kịp.
10. **B** — Trường State.OOMKilled trong docker inspect.
11. **B** — ENV nằm vĩnh viễn trong image metadata/layer, lộ qua history/inspect.
12. **B** — Tách build stage khỏi runtime: image nhỏ (~150MB vs >1GB), ít attack surface.
13. **B** — tini làm init process đúng nghĩa: reap zombies + forward signals.
14. **C** — Overlay network dùng cho multi-host (Swarm).
15. **B** — Đặt heap V8 thấp hơn limit để chừa chỗ cho non-heap memory (buffers, stack, native), tránh OOMKill trước khi GC chạy.

</details>

### Phần 2: Bài thực hành chấm điểm

**Đề bài:** Dockerize hoàn chỉnh một REST API "Todo Service" (Express + TypeScript + Postgres + Redis) chuẩn production và giao nộp repo gồm: `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `docker-compose.dev.yml` (override cho dev với bind mount + hot reload bằng nodemon), script `healthcheck.js`, và `README` ghi các lệnh build/run/test. API: CRUD `/todos` (Postgres), cache `GET /todos` qua Redis với invalidation khi write, `GET /health` kiểm tra cả DB và Redis.

**Checklist tiêu chí chấm điểm:**

- [ ] Multi-stage Dockerfile (≥2 stages), image cuối < 180MB, base image pin version cụ thể
- [ ] Layer caching đúng: sửa source code không trigger lại `npm ci` (chứng minh bằng output build lần 2)
- [ ] `.dockerignore` loại node_modules, .git, .env, dist
- [ ] Container chạy non-root (USER node), exec-form CMD
- [ ] Graceful shutdown: `docker stop` < 5s, exit code 0, request in-flight không bị đứt
- [ ] HEALTHCHECK trong Dockerfile dùng script Node, /health kiểm tra thật DB + Redis (down DB → health fail)
- [ ] Compose: healthchecks cho mọi service, depends_on condition service_healthy, named volumes, resource limits cho app
- [ ] Cache hoạt động: GET lần 2 có X-Cache: HIT, sau POST/PUT/DELETE cache bị invalidate
- [ ] Dev workflow: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up` hot reload khi sửa code
- [ ] `trivy image` không còn CRITICAL CVE; không có secret nào trong image (kiểm bằng docker history)

**Thang điểm:** mỗi mục 1 điểm, đạt ≥ 8/10 là pass.

## ✅ Tiêu chí pass tuần

- Quiz ≥ 12/15
- Hoàn thành tất cả bài tập bắt buộc (bài 1-5)
- Bài thực hành đạt ≥ 8/10 checklist
- Giải thích miệng (mock interview) được trôi chảy: PID 1 problem, multi-stage build, layer caching — không nhìn tài liệu
- Image cuối của bài thực hành < 180MB và stop time < 5s

> 🧪 **Capstone**: học xong tuần này, làm phần Docker của [Upgrade 4 — Docker & K8s](../capstone-project/UPGRADE-04-DOCKER-K8S.md); phần K8s để sau tuần 8. Tick nghiệm thu ở tab 📅 Kế hoạch của study-web.
