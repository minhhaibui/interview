# Tuần 7 — Thiết kế hệ thống & Case thực tế: Docker

> Tài liệu bổ trợ cho README.md cùng thư mục. Học sau khi xong phần lý thuyết.

## 🏗️ Mini System Design (scoped vào chủ đề tuần)

### Bài 1: Dockerfile tối ưu cho monorepo Node.js TypeScript (3 services dùng chung packages)

**Đề bài:** Bạn có một monorepo dùng pnpm workspaces + Turborepo, cấu trúc:

```
monorepo/
├── apps/
│   ├── api/          # Express API (port 3000)
│   ├── worker/       # BullMQ consumer
│   └── admin/        # Internal admin API (port 3001)
├── packages/
│   ├── shared/       # types, utils dùng chung
│   └── db/           # Prisma client + migrations
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

Yêu cầu:
- Build được 3 image riêng cho 3 services từ cùng một codebase.
- Sửa code 1 service không làm invalidate cache layer `node_modules` (hiện build mất ~8 phút mỗi lần vì cài lại deps).
- Image cuối **< 200MB** mỗi service (hiện đang ~1.4GB vì copy nguyên repo + dev deps).
- Production image không chứa source TypeScript, không chứa devDependencies.

**Phân tích & lời giải:**

**Bước 1 — Xác định nguyên nhân image to và cache vỡ.** Anti-pattern phổ biến:

```dockerfile
# ❌ BAD: mọi thay đổi code đều invalidate layer install
COPY . .
RUN pnpm install
RUN pnpm build
```

Layer caching của Docker hoạt động theo nguyên tắc: layer N bị invalidate nếu input của nó (file COPY vào hoặc lệnh RUN) thay đổi, và **mọi layer sau đó rebuild theo**. `COPY . .` đặt toàn bộ source trước `pnpm install` → đổi 1 dòng code là cài lại toàn bộ deps.

**Bước 2 — Tách "dependency manifest" ra khỏi source.** Chỉ copy các file quyết định dependency tree (`package.json` của từng workspace + lockfile) trước, install, rồi mới copy source. Với monorepo nhiều workspace, copy thủ công từng `package.json` rất dễ sót — dùng `turbo prune` để tự sinh ra một thư mục tối giản:

```bash
turbo prune --scope=api --docker
# Sinh ra:
# out/json/   → chỉ package.json + lockfile của api và các package nó phụ thuộc
# out/full/   → source code của api + packages liên quan (KHÔNG có worker, admin)
```

**Bước 3 — Multi-stage Dockerfile (1 Dockerfile dùng chung, tham số hóa bằng ARG):**

```dockerfile
# syntax=docker/dockerfile:1.7
ARG SERVICE=api

# ---------- Stage 1: prune monorepo ----------
FROM node:20-alpine AS pruner
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm dlx turbo prune --scope=${SERVICE} --docker

# ---------- Stage 2: install deps (cache-friendly) ----------
FROM node:20-alpine AS deps
RUN corepack enable
WORKDIR /repo
# Chỉ copy manifest → layer này chỉ rebuild khi deps đổi
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
# BuildKit cache mount: pnpm store tồn tại giữa các lần build
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---------- Stage 3: build TypeScript ----------
FROM deps AS builder
ARG SERVICE
COPY --from=pruner /repo/out/full/ .
RUN pnpm turbo build --filter=${SERVICE}
# Loại bỏ devDependencies, chỉ giữ prod deps
RUN pnpm --filter=${SERVICE} deploy --prod /prod/${SERVICE}

# ---------- Stage 4: runtime ----------
FROM node:20-alpine AS runner
ARG SERVICE
ENV NODE_ENV=production
RUN apk add --no-cache tini
# Chạy non-root (node user có sẵn trong image chính thức)
USER node
WORKDIR /app
COPY --from=builder --chown=node:node /prod/${SERVICE} .
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
```

Build từng service:

```bash
docker build --build-arg SERVICE=api    -t myorg/api:latest .
docker build --build-arg SERVICE=worker -t myorg/worker:latest .
docker build --build-arg SERVICE=admin  -t myorg/admin:latest .
```

**Bước 4 — Giải thích từng quyết định:**

| Quyết định | Lý do |
|---|---|
| `turbo prune --docker` | Tách json (manifest) khỏi full (source) → đổi code không phá cache install; build api không bị invalidate khi đổi code worker |
| `node:20-alpine` thay vì `node:20` | Base ~50MB thay vì ~1GB. Lưu ý: alpine dùng musl libc — nếu có native deps (sharp, bcrypt) cần test kỹ hoặc dùng `node:20-slim` (Debian, glibc, ~75MB) |
| `--mount=type=cache` cho pnpm store | Ngay cả khi layer install invalidate, package đã tải vẫn nằm trong cache mount → install nhanh hơn nhiều |
| `pnpm deploy --prod` | Tạo thư mục self-contained chỉ chứa prod deps của đúng service đó (giải quyết vấn đề symlink của pnpm workspaces) |
| Stage `runner` riêng | Image cuối không có source `.ts`, không có devDeps (typescript, jest, eslint thường chiếm 300-500MB) |
| `USER node` + `tini` | Security (không chạy root) + xử lý signal/zombie process đúng (xem Case 3) |

**Kết quả thực tế:** base alpine ~55MB + prod deps ~60-80MB + dist ~5MB ≈ **130-150MB**. Build lại khi chỉ đổi code: ~40 giây (chỉ stage builder + runner chạy lại).

**Trade-offs:**
- `turbo prune` thêm 1 stage và phụ thuộc Turborepo; nếu repo nhỏ có thể copy thủ công từng `package.json` nhưng dễ sót khi thêm package mới.
- Alpine/musl có thể gây bug ngầm với native modules và DNS resolver khác glibc; `node:20-slim` an toàn hơn, trả giá ~30MB.
- 1 Dockerfile + ARG dễ maintain nhưng nếu services khác nhau nhiều (service cần ffmpeg, service không) thì tách Dockerfile riêng rõ ràng hơn.
- Distroless (`gcr.io/distroless/nodejs20`) nhỏ và an toàn hơn nữa nhưng không có shell → khó debug `kubectl exec`.

**Follow-up interviewer hay hỏi:**
1. *"Tại sao không dùng `npm ci` với `node_modules` cache mount là xong?"* — Gợi ý: cache mount giải quyết tốc độ install nhưng không giải quyết việc layer bị invalidate sai và image cuối chứa devDeps; vấn đề cốt lõi là **thứ tự layer** và **tách build/runtime stage**.
2. *"`.dockerignore` cần những gì và tại sao quan trọng?"* — Gợi ý: `node_modules`, `dist`, `.git`, `.env`, `*.md`. Nó giảm build context gửi tới daemon (nhanh hơn), tránh `COPY . .` vô tình chép `node_modules` của máy host (sai platform binary) và tránh leak secret trong `.env`.
3. *"Nếu package `db` dùng Prisma, generate client ở stage nào?"* — Gợi ý: `prisma generate` ở stage builder (cần schema + devDep prisma CLI), nhưng phải đảm bảo `@prisma/client` + query engine binary đúng platform (alpine cần `binaryTargets = ["linux-musl-openssl-3.0.x"]`) được copy sang runner.

---

### Bài 2: Môi trường local dev cho team 10 người bằng docker-compose

**Đề bài:** Team 10 backend engineers làm việc trên hệ thống gồm: API Node.js (TypeScript), Postgres 16, Redis 7, Kafka. Yêu cầu:
- `git clone` xong chạy **1 lệnh** là có môi trường đầy đủ, đồng nhất giữa 10 máy (cả macOS lẫn Linux).
- Sửa code thấy kết quả ngay (hot-reload), không rebuild image.
- DB có sẵn seed data (10K users, 50K orders) để dev/test.
- API chỉ start khi Postgres/Redis/Kafka **thực sự sẵn sàng** (không phải chỉ container started).
- Kafka + Kafka UI là optional — máy yếu không cần chạy.

**Phân tích & lời giải:**

**Bước 1 — Kiến trúc tổng thể:**

```
┌─────────────────────────────────────────────────────┐
│ docker compose (network: app_net)                    │
│                                                      │
│  ┌─────────┐ bind mount ./src  ┌──────────────┐      │
│  │  api    │◄────hot reload────│ máy dev      │      │
│  │ :3000   │                   │ (VS Code)    │      │
│  └──┬──┬───┘                   └──────────────┘      │
│     │  │ depends_on (healthy)                        │
│  ┌──▼──────┐  ┌─────────┐  ┌─────────────────┐       │
│  │ postgres│  │  redis  │  │ kafka (profile)  │      │
│  │ :5432   │  │  :6379  │  │ :9092            │      │
│  └──▲──────┘  └─────────┘  └─────────────────┘       │
│     │ chạy 1 lần rồi exit                            │
│  ┌──┴──────┐                                         │
│  │  seed   │ (service one-shot)                      │
│  └─────────┘                                         │
└─────────────────────────────────────────────────────┘
```

**Bước 2 — Dockerfile dev riêng (target trong cùng multi-stage):**

```dockerfile
# Thêm stage dev vào Dockerfile ở Bài 1
FROM deps AS dev
WORKDIR /repo
ENV NODE_ENV=development
# KHÔNG copy source — source sẽ bind mount lúc runtime
CMD ["pnpm", "--filter=api", "dev"]   # tsx watch / nodemon
```

**Bước 3 — `docker-compose.yml`:**

```yaml
name: myapp

services:
  api:
    build:
      context: .
      target: dev            # dùng stage dev, có devDeps
    ports:
      - "3000:3000"
      - "9229:9229"          # Node inspector cho debug
    environment:
      DATABASE_URL: postgres://app:app@postgres:5432/app
      REDIS_URL: redis://redis:6379
      KAFKA_BROKERS: kafka:9092
    volumes:
      - ./apps:/repo/apps              # bind mount source → hot reload
      - ./packages:/repo/packages
      - api_node_modules:/repo/node_modules  # named volume "che" node_modules
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      seed:
        condition: service_completed_successfully
    develop:
      watch:                  # docker compose watch (thay thế/bổ sung bind mount)
        - action: sync
          path: ./apps/api/src
          target: /repo/apps/api/src

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: app
    ports:
      - "5432:5432"
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d app"]
      interval: 5s
      timeout: 3s
      retries: 10

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

  seed:
    build:
      context: .
      target: dev
    command: ["pnpm", "--filter=db", "run", "migrate-and-seed"]
    environment:
      DATABASE_URL: postgres://app:app@postgres:5432/app
    depends_on:
      postgres:
        condition: service_healthy
    restart: "no"             # one-shot: chạy migrate + seed rồi exit 0

  kafka:
    image: bitnami/kafka:3.7
    profiles: ["kafka"]       # optional — chỉ chạy khi bật profile
    environment:
      KAFKA_CFG_NODE_ID: 0
      KAFKA_CFG_PROCESS_ROLES: controller,broker   # KRaft, không cần Zookeeper
      KAFKA_CFG_CONTROLLER_QUORUM_VOTERS: 0@kafka:9093
      KAFKA_CFG_LISTENERS: PLAINTEXT://:9092,CONTROLLER://:9093
      KAFKA_CFG_CONTROLLER_LISTENER_NAMES: CONTROLLER
    ports:
      - "9092:9092"
    healthcheck:
      test: ["CMD-SHELL", "kafka-topics.sh --bootstrap-server localhost:9092 --list"]
      interval: 10s
      timeout: 10s
      retries: 12

  kafka-ui:
    image: provectuslabs/kafka-ui:latest
    profiles: ["kafka"]
    ports:
      - "8080:8080"
    environment:
      KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: kafka:9092
    depends_on:
      kafka:
        condition: service_healthy

volumes:
  pg_data:
  api_node_modules:
```

**Bước 4 — Trải nghiệm dev:**

```bash
docker compose up                    # core stack: api + pg + redis + seed
docker compose --profile kafka up    # thêm Kafka khi cần test event flow
docker compose down -v               # reset sạch DB, seed lại từ đầu
```

**Giải thích các quyết định then chốt:**

- **Named volume che `node_modules`** (`api_node_modules:/repo/node_modules`): khi bind mount `./apps` từ host, `node_modules` trên host (nếu có, build cho macOS) sẽ đè lên của container (build cho Linux) → native module crash. Named volume mount "sâu hơn" sẽ che path đó, giữ `node_modules` Linux trong container. Đây là câu hỏi phỏng vấn kinh điển.
- **`depends_on` + `condition: service_healthy`**: `depends_on` mặc định chỉ chờ container *started* — Postgres container có thể started nhưng chưa accept connection. Healthcheck `pg_isready` mới phản ánh "sẵn sàng thật". Lưu ý interviewer: trên production K8s không có cơ chế này, app phải tự retry connection.
- **Seed là service one-shot** + `condition: service_completed_successfully`: tách migrate/seed khỏi app startup → seed idempotent (script dùng `ON CONFLICT DO NOTHING` hoặc check marker table), api chỉ start sau khi data sẵn sàng.
- **`profiles: ["kafka"]`**: máy 8GB RAM không cần gánh Kafka khi làm task không liên quan; CI cũng chọn profile theo loại test.
- **Port 9229**: attach debugger từ VS Code vào process trong container — điểm cộng lớn khi phỏng vấn hỏi "debug trong container thế nào".

**Trade-offs:**
- Bind mount trên macOS/Windows (qua VM) chậm hơn Linux đáng kể với project nhiều file; `docker compose watch` (sync mode) hoặc dev container giảm đau nhưng thêm độ phức tạp.
- Chạy mọi thứ trong Docker đồng nhất môi trường nhưng tốn RAM; phương án lai (Node chạy trên host, chỉ infra trong Docker) nhẹ hơn nhưng lại lệch môi trường (DNS `postgres` vs `localhost`, version Node mỗi máy một kiểu).
- Seed 50K rows mỗi lần `down -v` mất thời gian → có thể thay bằng image Postgres custom đã bake sẵn data (nhanh hơn nhưng phải rebuild image khi schema đổi).

**Follow-up interviewer hay hỏi:**
1. *"Hot-reload không nhận thay đổi file trên máy đồng nghiệp dùng macOS, vì sao?"* — Gợi ý: file watcher (chokidar) dựa vào inotify event không truyền qua một số cơ chế mount → bật polling (`CHOKIDAR_USEPOLLING=true`) hoặc dùng `compose watch` sync.
2. *"Làm sao các máy không lệch version compose config và env?"* — Gợi ý: commit `docker-compose.yml` + `.env.example`, dùng `env_file`, pin image tag cụ thể (không dùng `latest`), thêm lệnh `make dev` để chuẩn hóa.
3. *"Test integration trên CI dùng lại compose này được không?"* — Gợi ý: được, dùng `docker compose run --rm api pnpm test:integration` + profiles; hoặc Testcontainers để mỗi test suite tự quản lifecycle.

---

### Bài 3: CI build pipeline cho Docker image

**Đề bài:** Thiết kế pipeline GitHub Actions cho repo ở Bài 1:
- Mỗi push lên `main` build 3 images; PR chỉ build + test, không push.
- Build trên CI hiện mất 9 phút vì không có layer cache (runner stateless).
- Tag strategy phải hỗ trợ: rollback chính xác về commit bất kỳ, release theo semver, và môi trường staging luôn chạy bản mới nhất của `main`.
- Image phải được scan vulnerability, **fail pipeline nếu có CRITICAL** có fix.
- Hỗ trợ cả `linux/amd64` (EC2 Intel) và `linux/arm64` (Graviton — rẻ hơn ~20%).

**Phân tích & lời giải:**

**Bước 1 — Tag strategy (quyết định trước, vì nó chi phối mọi thứ):**

```
ghcr.io/myorg/api:sha-3f2a91c     ← immutable, mọi build đều có → rollback chính xác
ghcr.io/myorg/api:main            ← mutable, trỏ bản mới nhất của main → staging
ghcr.io/myorg/api:1.4.2           ← semver, gắn khi tạo git tag v1.4.2 → production
ghcr.io/myorg/api:1.4             ← semver minor, tiện cho consumer muốn auto-patch
```

Nguyên tắc: **production deploy bằng tag immutable** (sha hoặc semver đầy đủ), không bao giờ deploy `latest`/`main` lên prod vì không biết đang chạy code nào và không rollback được ("rollback về latest" là vô nghĩa).

**Bước 2 — Layer cache trên CI stateless.** GitHub Actions runner mới tinh mỗi lần chạy → local layer cache vô dụng. Giải pháp: BuildKit **registry cache backend** — đẩy cache layer lên chính registry:

```yaml
# .github/workflows/docker.yml
name: docker
on:
  push:
    branches: [main]
    tags: ["v*"]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      security-events: write
    strategy:
      matrix:
        service: [api, worker, admin]
    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-qemu-action@v3      # emulation cho arm64
      - uses: docker/setup-buildx-action@v3    # BuildKit builder

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/myorg/${{ matrix.service }}
          tags: |
            type=sha,prefix=sha-,format=short
            type=ref,event=branch              # → :main
            type=semver,pattern={{version}}    # v1.4.2 → :1.4.2
            type=semver,pattern={{major}}.{{minor}}

      - uses: docker/build-push-action@v6
        with:
          context: .
          build-args: SERVICE=${{ matrix.service }}
          platforms: linux/amd64,linux/arm64
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=registry,ref=ghcr.io/myorg/${{ matrix.service }}:buildcache
          cache-to: type=registry,ref=ghcr.io/myorg/${{ matrix.service }}:buildcache,mode=max
          provenance: true                     # SLSA provenance attestation

      - name: Scan image
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ghcr.io/myorg/${{ matrix.service }}:sha-${{ github.sha }}
          severity: CRITICAL,HIGH
          exit-code: "1"                       # fail pipeline
          ignore-unfixed: true                 # chỉ fail khi CÓ fix
          format: sarif
          output: trivy-${{ matrix.service }}.sarif

      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: trivy-${{ matrix.service }}.sarif
```

**Bước 3 — Giải thích quyết định:**

- **`cache-to mode=max`**: cache cả layer của intermediate stages (deps, builder), không chỉ stage cuối — quan trọng với multi-stage vì stage runner cuối rất nhỏ, cái đắt là stage deps/builder. Kết quả thực tế: 9 phút → ~1.5-2 phút khi deps không đổi.
- **Multi-arch bằng buildx + QEMU**: 1 manifest list chứa cả 2 arch, node tự pull đúng arch. Lưu ý: QEMU emulate arm64 trên runner amd64 **chậm 3-5x** với bước compile — phương án tốt hơn ở scale lớn: 2 native runners (matrix theo arch) build song song rồi `buildx imagetools create` merge manifest.
- **`ignore-unfixed: true`**: tránh pipeline đỏ vĩnh viễn vì CVE chưa có patch trong base image — đây là điểm thực chiến: scan gate phải *actionable*, không thì team sẽ tắt nó đi.
- **Matrix theo service**: 3 build chạy song song; nhờ `turbo prune`, đổi code worker không phá cache của api.
- **Thứ tự scan trước khi promote**: ở đây scan sau push (đơn giản); chuẩn hơn nữa là push vào tag tạm → scan → retag promote, để registry không bao giờ chứa image "bẩn" với tag deployable.

**Trade-offs:**
- Registry cache tốn storage + băng thông pull/push cache (~vài trăm MB mỗi build); GitHub Actions cache (`type=gha`) miễn phí nhưng giới hạn 10GB/repo và bị evict — registry cache bền hơn cho team nhiều người.
- QEMU đơn giản (1 job) vs native runners (nhanh nhưng pipeline phức tạp, cần merge manifest).
- Fail-on-CRITICAL chặt chẽ về security nhưng có thể block hotfix khẩn — cần cơ chế exception có kiểm soát (`.trivyignore` với comment lý do + expiry date).

**Follow-up interviewer hay hỏi:**
1. *"Làm sao biết image đang chạy trên prod được build từ commit nào?"* — Gợi ý: tag `sha-*` + `LABEL org.opencontainers.image.revision=$GIT_SHA` (OCI labels) + provenance attestation; `docker inspect` là ra.
2. *"Hai engineer cùng push gần nhau, tag `:main` bị ghi đè — có vấn đề gì?"* — Gợi ý: đó là lý do mutable tag chỉ dùng cho staging/dev; mọi promotion dùng digest (`@sha256:...`) hoặc immutable tag; có thể bật immutable tags trên ECR.
3. *"Giảm bề mặt CVE từ gốc thay vì chỉ scan?"* — Gợi ý: base image nhỏ (alpine/distroless/chainguard), update base định kỳ (Renovate/Dependabot), multi-stage để devDeps không vào runtime, `npm audit`/`pnpm audit` ở tầng app deps.

---

### Bài 4: Containerize legacy Node app theo 12-factor

**Đề bài:** App Node.js 8 năm tuổi chạy trên 1 con EC2 bằng PM2, có các "tật":
- Ghi file user upload vào `./uploads/` và file export CSV vào `./exports/` trên disk local.
- Dùng `node-cron` chạy 3 jobs trong chính process API (cleanup 2h sáng, gửi report 8h sáng, sync inventory mỗi 15 phút).
- Log bằng winston ra file `./logs/app.log` với daily rotate.
- Config đọc từ file `config/production.json` commit trong repo (có cả DB password).
- Yêu cầu: containerize để chạy được **nhiều replica** sau load balancer, không mất tính năng nào, lộ trình ít rủi ro.

**Phân tích & lời giải:**

Vấn đề cốt lõi: app này **stateful và độc bản** (single instance). Containerize "nguyên trạng" thì chạy được 1 container, nhưng scale 3 replica là hỏng ngay: cron chạy 3 lần, upload nằm rải rác 3 disk, log kẹt trong container. Cần 12-factor hóa từng điểm:

```
┌──────────────── TRƯỚC ────────────────┐   ┌──────────────── SAU ─────────────────┐
│ EC2 + PM2                             │   │                                       │
│ ┌───────────────────────────────────┐ │   │  ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│ │ API + cron + file I/O + log file  │ │   │  │ api x3  │ │ api x3  │ │ api x3  │  │
│ │  ./uploads ./exports ./logs       │ │   │  └────┬────┘ stateless, log→stdout    │
│ │  config/production.json (secret!) │ │   │       │                               │
│ └───────────────────────────────────┘ │   │  ┌────▼─────────┐  ┌───────────────┐  │
└───────────────────────────────────────┘   │  │ S3 / volume  │  │ cron runner   │  │
                                            │  │ uploads,csv  │  │ (container    │  │
                                            │  └──────────────┘  │  riêng x1)    │  │
                                            │  env/secret store  └───────────────┘  │
                                            └───────────────────────────────────────┘
```

**Bước 1 — File trên disk (Factor: backing services + disposability).**

- *Đích đến:* `uploads/` và `exports/` chuyển sang **S3** (hoặc MinIO nếu on-prem). Code đổi `fs.writeFile` → abstraction `StorageService` với 2 implementation (local/S3) chọn qua env `STORAGE_DRIVER` — cho phép migrate dần và dev local không cần S3.
- *Bước đệm ít rủi ro:* nếu chưa kịp sửa code, mount **shared volume** (EFS/NFS) vào cùng path cho mọi replica. Chạy được ngay nhưng chấp nhận latency NFS và đây là nợ kỹ thuật, không phải đích.

```js
// storage/index.js — seam để migrate dần
const driver = process.env.STORAGE_DRIVER || "local";
module.exports = driver === "s3" ? require("./s3") : require("./local");
```

**Bước 2 — Cron trong process (Factor: processes, concurrency).**

3 replica → cron job chạy 3 lần → report gửi 3 email, sync inventory race condition. Hai phương án:

- **Phương án A (đích):** tách cron ra khỏi API. Entry point mới `cron.js` import đúng các job functions hiện có, chạy thành container riêng **1 replica** (hoặc K8s CronJob/ECS Scheduled Task từng job). Cùng một image, khác `CMD`:

```dockerfile
# cùng image, 2 cách chạy
CMD ["node", "dist/server.js"]      # API
# container cron: docker run ... node dist/cron.js
```

- **Phương án B (bước đệm):** giữ cron trong app nhưng thêm **distributed lock** (Redis `SET cron:sync-inventory <id> NX PX 840000`) — chỉ replica giành được lock mới chạy. Nhanh, ít sửa code, nhưng job lifecycle vẫn dính vào API (deploy API giữa chừng job đang chạy là job chết).

Chọn A làm đích vì: scale API không nhân bản cron, deploy API không giết job đang chạy, resource limit riêng cho job nặng.

**Bước 3 — Log ra file (Factor: logs as event streams).**

Container ghi log vào filesystem của container → mất khi container chết, không xem tập trung được. Sửa: winston transport → **stdout/stderr**, bỏ file rotate (việc của platform):

```js
const logger = winston.createLogger({
  format: winston.format.json(),       // JSON để parse được fields
  transports: [new winston.transports.Console()],
});
```

Platform (Docker logging driver, Fluent Bit sidecar/DaemonSet, CloudWatch) lo thu gom và rotate. Nếu *không thể* sửa code ngay: sidecar pattern — container phụ `tail -F /logs/app.log` trên shared volume — nhưng nhấn mạnh với interviewer đây là workaround.

**Bước 4 — Config + secret trong repo (Factor: config in env).**

- Đổi `config/production.json` → đọc env vars (`process.env.DATABASE_URL`...), giữ file json làm default cho dev. Dùng lib như `convict`/`zod` validate env lúc boot — **fail fast** nếu thiếu.
- DB password đã commit vào git = **đã bị lộ** (nằm trong git history vĩnh viễn) → phải **rotate ngay**, không chỉ xóa file. Secret mới đưa vào secret manager (AWS Secrets Manager / K8s Secret), inject qua env lúc runtime.

**Bước 5 — Những thứ container hóa cần thêm:**
- Graceful shutdown: PM2 trước đây lo restart; giờ app phải tự handle `SIGTERM` — đóng server, drain connection (chi tiết ở Case 3).
- Healthcheck endpoint `/healthz` cho orchestrator.
- Bỏ PM2 trong container (orchestrator lo restart + replica; PM2 cluster mode trong container là anti-pattern phổ biến — 1 process/container, scale bằng replica).

**Lộ trình rollout ít rủi ro:** (1) log→stdout + config→env + graceful shutdown (không đổi behavior nghiệp vụ) → chạy 1 replica trong container, so sánh với EC2; (2) storage→S3 sau feature flag; (3) tách cron; (4) bật nhiều replica; (5) tắt EC2 cũ.

**Trade-offs:**
- Sửa code về S3/cron riêng tốn sprint nhưng là đích đúng; shared volume + Redis lock nhanh hơn nhưng là nợ — nêu cả hai và lộ trình là câu trả lời senior.
- Tách cron thành container riêng tăng số deployable units phải vận hành; với job 15 phút/lần thì CronJob platform-level tốt hơn long-running container chạy node-cron.

**Follow-up interviewer hay hỏi:**
1. *"Session đang lưu in-memory thì sao khi chạy 3 replica?"* — Gợi ý: cùng họ vấn đề — chuyển session store sang Redis, hoặc chuyển JWT stateless; sticky session ở LB chỉ là workaround.
2. *"Job sync inventory đang chạy giữa chừng thì deploy, xử lý sao?"* — Gợi ý: job phải idempotent + checkpoint; K8s Job có `terminationGracePeriodSeconds` đủ dài; thiết kế job resume được.
3. *"Tại sao không dùng PM2 cluster mode trong container cho đủ CPU?"* — Gợi ý: phá vỡ mô hình 1 process/container — orchestrator không thấy từng worker chết, resource limit/metrics sai, signal handling phức tạp; scale bằng replica + để scheduler xếp chỗ.

---

## 🌍 Case thực tế

### Case 1: Image 1.8GB làm mỗi lần deploy chậm 10 phút

**Bối cảnh:** Startup e-commerce, API Node.js deploy lên ECS, 5-10 lần deploy/ngày. Mỗi lần deploy: build 4 phút + push 3 phút + các node pull image 3-4 phút. Autoscale lúc flash sale cũng chậm vì node mới phải pull 1.8GB trước khi task chạy được.

**Vấn đề gặp phải:** Chạy `docker history --human myapp:latest` cho thấy phân bố layer:

```
node:20 (Debian full)        ~1.0GB   ← base image full có cả gcc, python, perl
COPY . .                     ~250MB   ← có .git, node_modules host, test fixtures
RUN npm install              ~480MB   ← cả devDependencies (typescript, jest, cypress)
RUN npm run build            ~60MB    ← dist + source .ts song song
```

Dockerfile gốc kiểu "chạy được là được": single-stage, `FROM node:20`, `COPY . .`, không có `.dockerignore`.

**Giải pháp & tại sao:**
1. **Multi-stage**: stage builder cài đủ deps + compile; stage runner chỉ `COPY --from=builder dist/ node_modules/` (prod deps). DevDeps ~400MB không bao giờ vào image cuối.
2. **Base `node:20-alpine`**: 1.0GB → ~55MB. Test lại native deps (`sharp` cần `binaryTargets`/prebuilt musl).
3. **`.dockerignore`**: loại `.git` (180MB), `node_modules` host, `coverage/`, fixtures.
4. **`npm ci --omit=dev`** ở stage cuối (hoặc `npm prune --omit=dev` sau build).
5. Đo bằng `dive` để xác nhận không còn layer rác.

Kết quả: **1.8GB → 180MB**. Push/pull còn ~20-30 giây; tổng thời gian deploy từ ~10 phút còn ~3 phút; autoscale phản ứng nhanh hơn rõ rệt vì pull nhanh + layer base được cache sẵn trên node.

**Bài học rút ra:**
- Image size không chỉ là thẩm mỹ — nó là **deploy velocity, tốc độ autoscale, chi phí registry/băng thông và attack surface** (image full Debian có hàng trăm CVE từ package không bao giờ dùng).
- `docker history` và `dive` là công cụ chẩn đoán đầu tiên — đo trước khi sửa.
- `.dockerignore` là thứ rẻ nhất mang lại hiệu quả lớn nhất, và hay bị quên nhất.

**💬 Cách dùng case này khi phỏng vấn:** Khi được hỏi về tối ưu Dockerfile, đừng chỉ liệt kê kỹ thuật — kể theo mạch "đo bằng docker history → thấy 3 thủ phạm: base full, devDeps, COPY rác → xử lý từng cái → 1.8GB còn 180MB, deploy 10 phút còn 3 phút". Con số trước-sau là thứ interviewer nhớ.

---

### Case 2: Container bị kill "ngẫu nhiên" trên production

**Bối cảnh:** Service Node.js xử lý báo cáo chạy trên ECS (memory limit 512MB cho task). Vài lần mỗi ngày container chết không rõ lý do rồi tự restart, mất các job đang xử lý dở. Log application không có error nào trước khi chết — "chết im lặng".

**Vấn đề gặp phải:** Kiểm tra `docker inspect` / ECS stopped reason thấy `OOMKilled: true` (exit code 137). Nguyên nhân kép:
1. Process Node **không biết gì về cgroup limit**. Node nhìn thấy RAM của *host* (ví dụ 16GB) và mặc định cho phép old-generation heap lớn (heuristic theo RAM máy, có thể tới ~2GB) — trong khi cgroup limit chỉ 512MB. V8 thấy "còn nhiều room" nên lười GC; RSS vượt 512MB → kernel OOM killer bắn `SIGKILL` thẳng (không catch được, không có log).
2. Limit 512MB đặt theo cảm tính, không đo thực tế workload (job báo cáo load nhiều rows vào memory).

**Giải pháp & tại sao:**
1. **Cấu hình heap tường minh theo limit**: `NODE_OPTIONS=--max-old-space-size=384` cho limit 512MB. Quy tắc thực dụng: heap ≈ **75-80% memory limit**, chừa phần còn lại cho stack, native memory, Buffer (off-heap!), code. Khi heap chạm trần, V8 GC tích cực hơn, và nếu thật sự hết, Node ném "heap out of memory" **có stack trace** thay vì bị SIGKILL câm lặng.
2. Node 12+ thực ra có cải thiện đọc cgroup, nhưng với cgroup v2 và nhiều môi trường vẫn không đáng tin — đặt tường minh luôn là best practice.
3. **Đo lại memory thực**: chạy workload nặng nhất, xem `container_memory_working_set_bytes` → đặt limit có headroom (p99 usage × 1.3-1.5), nâng task lên 768MB.
4. Sửa gốc rễ ứng dụng: job báo cáo chuyển sang **stream** (cursor + `pipeline`) thay vì load toàn bộ rows — memory phẳng bất kể data size.
5. Thêm alert trên metric OOMKilled count và memory > 85% limit để phát hiện sớm thay vì "ngẫu nhiên chết".

**Bài học rút ra:**
- "Container chết không log + exit 137" ⇒ nghĩ ngay đến OOMKill, kiểm tra `docker inspect`/`kubectl describe` trước khi đào log app.
- Node (và JVM, v.v.) cần được *nói* về memory limit — container limit không tự động dạy runtime cách behave.
- Phân biệt heap vs RSS: Buffer/native memory nằm ngoài heap, nên `--max-old-space-size` không phải là trần tổng — vẫn cần headroom.

**💬 Cách dùng case này khi phỏng vấn:** Câu "exit code 137 nghĩa là gì?" gần như chắc chắn xuất hiện ở vòng DevOps — trả lời 128+9=SIGKILL/OOM rồi kể luôn case này: Node không thấy cgroup limit, fix bằng `--max-old-space-size` ≈ 75-80% limit + đo lại workload, sẽ rất thuyết phục.

---

### Case 3: App không nhận SIGTERM khi deploy, rớt request của user

**Bối cảnh:** Mỗi lần deploy rolling, dashboard báo một loạt 502/ECONNRESET trong ~30 giây. Team đổ cho load balancer, nhưng thực ra là container cũ bị giết thô bạo trong khi vẫn đang giữ in-flight requests.

**Vấn đề gặp phải:** Hai lỗi chồng nhau:

1. **PID 1 sai process.** Dockerfile dùng:

```dockerfile
CMD npm start            # ❌ shell form
```

Shell form chạy `/bin/sh -c "npm start"` → PID 1 là `sh`, fork ra `npm`, npm lại fork ra `node`. Khi orchestrator gửi `SIGTERM`: `sh` và `npm` **không forward signal** xuống `node`. Node không hề biết mình sắp chết. Hết `stop_timeout`/`terminationGracePeriodSeconds` (mặc định 10-30s), orchestrator gửi `SIGKILL` → process chết giữa chừng, in-flight requests đứt, connection trong pool không được đóng.

2. **App không có graceful shutdown handler** — kể cả nhận được SIGTERM cũng exit ngay.

**Giải pháp & tại sao:**

1. **Exec form + gọi node trực tiếp, bỏ npm khỏi runtime:**

```dockerfile
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]    # ✅ exec form, không qua shell/npm
```

`tini` làm PID 1 đúng nghĩa: forward signal cho child và reap zombie process (PID 1 trong Linux có trách nhiệm đặc biệt mà node không đảm nhiệm tốt). Có thể dùng `docker run --init` thay vì cài tini.

2. **Graceful shutdown trong app:**

```js
const server = app.listen(3000);
let shuttingDown = false;

process.on("SIGTERM", async () => {
  shuttingDown = true;                  // /healthz trả 503 → LB ngừng route mới
  server.close(async () => {           // ngừng nhận conn mới, chờ in-flight xong
    await db.end();                     // đóng pool sạch sẽ
    await redis.quit();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 25_000).unref();  // chốt chặn < grace period
});
```

3. **Phối hợp với orchestrator**: grace period (30s) phải > thời gian xử lý request dài nhất + thời gian LB deregister; trên K8s thêm `preStop: sleep 5` để chờ endpoint được rút khỏi LB trước khi app đóng cửa (SIGTERM và việc rút traffic xảy ra song song, không tuần tự).

Kết quả: deploy giữa giờ cao điểm zero 502.

**Bài học rút ra:**
- Chuỗi tử thần kinh điển: `CMD npm start` → shell PID 1 → SIGTERM rơi vào hư không → SIGKILL. Luôn dùng **exec form** + chạy `node` trực tiếp + init process (tini/`--init`).
- Graceful shutdown là hợp đồng 3 bên: app (handle SIGTERM, drain), container (signal đến đúng process), orchestrator (grace period đủ + rút traffic trước).
- Test được ngay trên local: `docker stop` và đo thời gian — nếu mất đúng 10s (timeout) nghĩa là app không hề nhận SIGTERM.

**💬 Cách dùng case này khi phỏng vấn:** Khi hỏi "deploy thế nào để không rớt request", đi từ tầng thấp lên: signal về đúng PID (exec form + tini) → app drain → orchestrator phối hợp (readiness, preStop, grace period). Nhắc mẹo test bằng `docker stop` xem có chờ đúng 10s không — chi tiết nhỏ này thể hiện kinh nghiệm thật.

---

## ✅ Checklist tự kiểm tra

1. Tôi có giải thích được vì sao thứ tự `COPY package.json` → `RUN install` → `COPY src` quyết định hiệu quả layer cache, và `turbo prune` giải quyết gì thêm trong monorepo?
2. Tôi có viết được multi-stage Dockerfile từ trí nhớ: stage nào chứa devDeps, stage nào vào production, và image cuối gồm những gì?
3. Tôi có biết vì sao cần named volume "che" `node_modules` khi bind mount source trong docker-compose, và `depends_on` khác gì `condition: service_healthy`?
4. Tôi có trình bày được tag strategy (sha immutable + semver + mutable branch tag) và lý do production không bao giờ deploy `latest`?
5. Tôi có giải thích được exit code 137 là gì, vì sao Node cần `--max-old-space-size` dù container đã có memory limit?
6. Tôi có vẽ được chuỗi signal khi `docker stop`: SIGTERM → ai nhận → điều gì xảy ra với shell form vs exec form, và tini để làm gì?
7. Nếu được đưa một legacy app (cron in-process, ghi file local, log ra file), tôi có nêu được từng vi phạm 12-factor, phương án đích lẫn phương án bước đệm, và lộ trình rollout ít rủi ro?
