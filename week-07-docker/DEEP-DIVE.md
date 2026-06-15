# 🔬 Đào sâu — Tuần 7: Docker

> README đã dạy "container là process được isolate bằng namespaces + cgroups"; phần này mổ xẻ tới mức syscall, layer digest, overlay2 và signal flow để khi phỏng vấn senior bạn giải thích được *cơ chế*, không chỉ *kết quả*.

## 🧠 Cơ chế bên trong

### 1. Namespaces — không phải "isolate" chung chung mà là từng loại view riêng

Mỗi namespace là một kernel object; một process tham gia 1 namespace của mỗi loại. `runc` tạo container bằng `clone()` / `unshare()` với các flag tương ứng:

| Namespace | Flag clone | Isolate cái gì | Hệ quả thực tế |
|---|---|---|---|
| **PID** | `CLONE_NEWPID` | Process tree | Trong container app là PID 1; host nhìn thấy nó là PID 31xxx. `kill -9 1` trong container ≠ kill init host. |
| **NET** | `CLONE_NEWNET` | Interfaces, routing table, iptables, port | Mỗi container có `eth0` ảo (veth pair) gắn vào `docker0`. Port 3000 trong 2 container không đụng nhau. |
| **MNT** | `CLONE_NEWNS` | Mount points / filesystem tree | Đây là cái biến rootfs (overlay) thành "/" của container. |
| **UTS** | `CLONE_NEWUTS` | hostname, domainname | `hostname` trong container = container ID, không ảnh hưởng host. |
| **IPC** | `CLONE_NEWIPC` | SysV IPC, POSIX shared memory | `/dev/shm` riêng → mặc định chỉ 64MB (gotcha với Chromium/Postgres). |
| **USER** | `CLONE_NEWUSER` | UID/GID mapping | uid 0 trong container map thành uid 100000 trên host → rootless. |

```bash
# Nhìn tận mắt: PID namespace tách biệt
docker run -d --name n nginx
docker inspect -f '{{.State.Pid}}' n        # vd 31245 (PID trên HOST)
sudo ls -l /proc/31245/ns/                   # các symlink net/pid/mnt... = id namespace
ps -o pid,comm -p 31245                       # host thấy nginx; trong container nó là PID 1
```

Điểm phỏng vấn hay bỏ sót: **kernel là chung**. Container không có kernel riêng → một kernel CVE (vd Dirty COW) khai thác được từ trong container là vá toàn host. Đó là lý do isolation của container "yếu hơn VM" — không phải vì namespaces yếu, mà vì attack surface là toàn bộ syscall table của host kernel.

### 2. cgroups v2 — accounting + enforcement, và OOM killer

cgroups không "ảo hóa" gì cả, nó chỉ **đếm và chặn**. cgroup v2 (default trên distro mới) gộp mọi controller vào một cây thống nhất ở `/sys/fs/cgroup`:

- `memory.max` = hard limit. Khi container chạm limit và không thể reclaim → kernel **OOM killer** chọn process trong cgroup đó để giết (SIGKILL, exit 137). Quan trọng: OOM xảy ra **bên trong cgroup của container**, host vẫn còn RAM → dmesg trên host mới thấy log, app không nhận được signal có ý nghĩa.
- `cpu.max` = `quota period` (vd `50000 100000` = 0.5 CPU). Đây là **CFS throttling**: process không bị giảm priority mà bị *dừng* khi hết quota trong chu kỳ → gây latency spike, không phải "chậm đều". Đây là nguồn gốc của tail-latency bí ẩn khi set `--cpus` thấp.
- `pids.max` = chặn fork bomb.

```bash
docker run -d --name lim --memory=256m --cpus=0.5 nginx
cat /sys/fs/cgroup/system.slice/docker-*.scope/memory.max   # 268435456
docker inspect -f '{{.State.OOMKilled}}' lim                # true nếu bị OOM giết
```

Liên hệ Node.js: V8 heap không nằm trong `memory.max` của container theo cách trực tiếp — RSS = heap + external buffers + stack + native. Nếu chỉ nhìn `--max-old-space-size` mà quên Buffer/Worker → vẫn OOM dù heap chưa đầy.

### 3. Union filesystem / overlay2 — copy-on-write thực sự hoạt động thế nào

overlay2 storage driver dựng "/" của container từ nhiều thư mục xếp chồng:

```
merged/  ← cái container "thấy" là "/" (kết quả union)
  ↑
upper/   ← writable layer của container (mọi thay đổi ghi vào đây)
lower/   ← các image layers (read-only), nối nhau bằng dấu ":"
```

- **Đọc** file chưa sửa → kernel trả từ `lower` (chia sẻ giữa mọi container dùng image đó → tiết kiệm RAM/disk).
- **Ghi/sửa** file đang ở `lower` → **copy-up**: kernel copy toàn bộ file lên `upper` rồi mới sửa. Sửa 1 byte của file 1GB → copy cả 1GB lên writable layer. Đây là lý do *ghi nhiều vào container layer rất chậm và phình* → phải dùng volume cho data I/O cao (DB).
- **Xóa** file ở `lower` → tạo **whiteout** (file đặc biệt `c 0 0`) ở `upper` để "che" → file vẫn chiếm chỗ ở image layer, không thật sự xóa được khỏi image.

```bash
docker run --name w alpine sh -c 'echo hi > /a.txt'
# Tìm upperdir của container:
docker inspect -f '{{.GraphDriver.Data.UpperDir}}' w   # .../diff
sudo ls $(docker inspect -f '{{.GraphDriver.Data.UpperDir}}' w)   # thấy a.txt
```

### 4. Image layer digest & build cache invalidation — vì sao thứ tự COPY quyết định tốc độ

Mỗi layer có **content-addressable digest** (`sha256` của nội dung layer). Image manifest liệt kê các digest này. Khi build, với mỗi instruction Docker tính một **cache key**:

- `RUN`: key dựa trên *chuỗi lệnh* (string) + parent layer. Đổi 1 ký tự trong `RUN` → miss.
- `COPY`/`ADD`: key dựa trên **checksum nội dung** của các file được copy + parent layer. Không phải timestamp — đổi mtime mà nội dung giữ nguyên vẫn hit (với BuildKit).

Quy tắc sắt: **một layer miss → tất cả layer sau nó miss** (vì parent đã đổi → cache key con đổi theo dây chuyền). Đó là toàn bộ lý do của:

```dockerfile
COPY package*.json ./   # ít đổi → đứng trước → npm ci được cache
RUN npm ci
COPY . .                # hay đổi → đứng sau → đổi code KHÔNG làm npm ci chạy lại
```

Nếu đảo `COPY . .` lên trước `RUN npm ci`: mỗi lần sửa bất kỳ file source nào → checksum build context đổi → COPY miss → npm ci miss → rebuild deps. `docker history --no-trunc img` cho thấy từng layer + lệnh tạo ra nó.

### 5. PID 1 & signal/zombie reaping — vì sao cần tini/`--init`

Hai đặc thù của PID 1 do kernel quy định (README đã nêu hiện tượng; đây là *cơ chế*):

- **Default signal disposition bị tắt cho PID 1.** Với process thường, kernel cài default handler (vd SIGTERM → terminate). Với PID 1, kernel **không** cài default → signal nào không có handler đăng ký sẽ bị *drop*. Node tự đăng ký SIGINT/SIGTERM handler ở mức libuv nên *có thể* nhận — nhưng chỉ khi nó là PID 1 thật (exec form). Với shell-form, PID 1 là `sh`, và `sh` không trap SIGTERM cũng không forward → node con không bao giờ thấy signal.
- **Reaping zombie.** Khi process con kết thúc, nó thành "zombie" cho tới khi cha gọi `wait()`. Nếu cha chết, con mồ côi được **re-parent về PID 1**, và PID 1 có nghĩa vụ `wait()` để dọn. Node *không* reap zombie con-mồ-côi → tích tụ zombie (ăn slot trong process table → cuối cùng `fork()` fail). App spawn child process (image processing, `child_process.exec`) là nạn nhân điển hình.

`tini` (hoặc `docker run --init`) là init tối giản: cài làm PID 1, forward mọi signal xuống child group, và `wait()` reap mọi zombie. Chi phí ~1MB, gần như bắt buộc nếu app có child process.

### 6. Rootless & user namespace remap

Mặc định container chạy root (uid 0) *và daemon cũng chạy root* → container escape = root host. Hai lớp phòng thủ:

- **`USER node` trong Dockerfile**: app chạy uid 1000 *bên trong* container — nhưng nếu không bật userns, uid 1000 đó = uid 1000 trên host (vẫn là một user thật trên host).
- **User namespace remap** (`CLONE_NEWUSER`): map uid 0 trong container → uid 100000 trên host. Bây giờ "root trong container" hoàn toàn không phải root host. Bật bằng `dockerd --userns-remap` hoặc chạy **rootless mode** (toàn bộ daemon chạy dưới user thường) — defense-in-depth mạnh nhất.

## 🧪 Ví dụ nâng cao

### Dockerfile production: cache tối ưu + multi-stage + non-root + healthcheck (giải thích từng tầng)

```dockerfile
# syntax=docker/dockerfile:1.7      # bật cú pháp BuildKit (cache mount, secret mount)

# ---------- Stage builder: có devDeps + compiler ----------
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
# BuildKit cache mount: thư mục ~/.npm được PERSIST giữa các lần build,
# KHÔNG nằm trong layer cuối → vừa nhanh (không tải lại tarball) vừa không phình image.
RUN --mount=type=cache,target=/root/.npm \
    npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build                     # tsc -> dist/

# ---------- Stage deps: chỉ production node_modules ----------
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# ---------- Stage runner: image cuối tối thiểu ----------
FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production
# tini làm PID 1 đúng nghĩa (reap zombie + forward signal)
RUN apt-get update && apt-get install -y --no-install-recommends tini \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --chown=node:node --from=deps    /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist          ./dist
COPY --chown=node:node package.json ./
USER node                              # hạ quyền TRƯỚC khi chạy
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD ["node", "healthcheck.js"]
ENTRYPOINT ["/usr/bin/tini", "--"]     # tini nuốt signal, forward cho node
CMD ["node", "dist/server.js"]
```

Giải thích từng tầng:
- **`builder` tách khỏi `deps`**: builder cần devDeps (tsc) nhưng `dist/` ra rồi thì không cần. `deps` cài lại sạch với `--omit=dev` → `node_modules` runtime không lẫn devDeps. Hai stage chạy *song song* trong BuildKit.
- **cache mount `/root/.npm`**: khác với layer cache (cache *kết quả layer*), cache mount cache *thư mục trung gian* → đổi `package.json` vẫn không phải tải lại tarball đã có.
- **`--chown=node:node` khi COPY**: nếu COPY rồi mới `chown -R` ở RUN riêng → tạo thêm 1 layer copy-up toàn bộ file (phình). `--chown` set quyền ngay lúc copy, 0 layer thừa.
- **`USER node` đặt sau COPY**: phải copy bằng quyền root (để ghi vào `/app`) rồi mới hạ quyền chạy.

### .dockerignore — không chỉ để nhanh

```
node_modules        # tránh copy node_modules host (musl≠glibc → lỗi) + phá cache
.git                # MB và lịch sử → leak + chậm
.env .env.*         # tránh secret lọt vào build context → vào layer
dist                # build trong image, không copy bản host (stale)
Dockerfile*
docker-compose*.yml
*.md
coverage
```

Lý do *bảo mật*: build context được gửi nguyên vào daemon. Một `COPY . .` mà không có `.dockerignore` sẽ nuốt cả `.env`, `.git/config` (có thể chứa token) vào layer — vĩnh viễn trong history.

### CMD vs ENTRYPOINT — shell form, exec form, signal forwarding

```dockerfile
# exec form (JSON array): node là PID 1, nhận SIGTERM trực tiếp → graceful OK
CMD ["node", "server.js"]

# shell form: thực chất chạy /bin/sh -c "node server.js"
# → PID 1 là sh, node là con. docker stop gửi SIGTERM cho sh, sh KHÔNG forward → node chờ tới SIGKILL (137)
CMD node server.js
```

Quy tắc kết hợp: `ENTRYPOINT` = cái cố định, `CMD` = arg mặc định override được.

```dockerfile
ENTRYPOINT ["node", "server.js"]   # docker run img --port=4000 → thêm arg
ENTRYPOINT ["/usr/bin/tini", "--"] # tini wrap; CMD là lệnh thật chạy dưới tini
CMD ["node", "server.js"]
```

Gotcha: nếu `ENTRYPOINT` dùng *shell form* thì arg từ `CMD` và từ `docker run` **bị bỏ qua** — vì shell form đã wrap thành chuỗi cứng.

### Giảm size: distroless / alpine và gotcha musl

```dockerfile
# distroless: không shell, không apk/apt, không libc thừa → ~130MB, attack surface min
FROM gcr.io/distroless/nodejs22-debian12 AS runner
WORKDIR /app
COPY --from=deps    /app/node_modules ./node_modules
COPY --from=builder /app/dist          ./dist
USER nonroot                            # distroless có sẵn user nonroot (uid 65532)
# KHÔNG có wget/curl → healthcheck PHẢI bằng node
HEALTHCHECK CMD ["node", "healthcheck.js"]
CMD ["dist/server.js"]                  # base image đã ENTRYPOINT ["/nodejs/bin/node"]
```

- **alpine musl gotcha**: alpine dùng musl libc. Native module (bcrypt, sharp, `@grpc/grpc-js` native, `better-sqlite3`) thường có prebuilt cho glibc → trên alpine phải *compile từ source* (cần `apk add build-base python3`) hoặc dùng prebuilt musl. Nếu vô tình COPY `node_modules` build trên macOS/glibc vào alpine → binary `.node` không load được.
- **DNS**: musl resolver xử lý `/etc/resolv.conf` khác glibc — từng có vụ chỉ query A không query AAAA đúng, hoặc không hỗ trợ `search` domain đầy đủ → lỗi resolve service trong K8s. Hiện đã ổn hơn nhưng vẫn là rủi ro với native DNS.

## 🐛 Bẫy & sự cố production

### Bẫy 1 — Image phình do cache layer & secret lọt vào history

**Dấu hiệu**: image 1.5GB dù app nhỏ; `docker history img` thấy layer RUN khổng lồ. Hoặc tệ hơn: secret xem được dù dòng sau đã `rm`.

```dockerfile
# ❌ apt cache + secret nằm trong layer, rm ở RUN sau KHÔNG xóa khỏi layer trước
RUN apt-get update && apt-get install -y curl
COPY .npmrc /root/.npmrc     # chứa _authToken → vĩnh viễn trong layer
RUN npm ci && rm /root/.npmrc   # quá muộn — token đã ở layer của COPY
```

**Fix**: gộp install + clean trong *một* RUN; dùng BuildKit secret mount cho token build-time:

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci   # secret KHÔNG vào layer
# build: docker build --secret id=npmrc,src=$HOME/.npmrc .
```
Kiểm chứng: `docker history --no-trunc img` và `dive img` để soi layer.

### Bẫy 2 — Chạy root

**Dấu hiệu**: `docker exec api whoami` → `root`; pentest flag CRITICAL. Nếu app có RCE → attacker là root container, ghi đè được file, dễ escape khi có `--privileged` hay mounted socket.
**Fix**: `USER node` (hoặc `nonroot` distroless) + `--cap-drop=ALL --cap-add=NET_BIND_SERVICE` + `--read-only`. Lưu ý port < 1024 cần `NET_BIND_SERVICE` hoặc nghe port ≥ 1024.

### Bẫy 3 — App không nhận SIGTERM (shell-form CMD) → bị SIGKILL

**Dấu hiệu**: `docker stop` luôn mất đúng 10s; exit code **143** trở thành **137**; request đang xử lý bị cắt; connection DB không đóng sạch (Postgres báo "unexpected EOF").
**Chẩn đoán**: `docker inspect -f '{{.Config.Cmd}}'` — nếu thấy `[/bin/sh -c node server.js]` là shell form.
**Fix**: exec form `CMD ["node","server.js"]` + tini + handler `process.on('SIGTERM')` gọi `server.close()`.

### Bẫy 4 — cgroup memory limit → OOM bị kill âm thầm

**Dấu hiệu**: container biến mất, exit **137**, log app **không có** dòng lỗi nào (vì SIGKILL không bắt được). App không crash — nó *bị giết*.
**Chẩn đoán**:
```bash
docker inspect -f '{{.State.OOMKilled}}' api    # true
dmesg | grep -i 'killed process'                 # trên HOST
docker stats --no-stream                          # xem MEM USAGE sát LIMIT
```
**Fix**: đặt `NODE_OPTIONS=--max-old-space-size=400` ở mức ~75-80% của `--memory=512m` (chừa chỗ cho Buffer/native/stack ngoài heap V8); tìm leak (heapsnapshot); tăng limit nếu nhu cầu thật.

### Bẫy 5 — Ghi vào container layer thay vì volume → mất data + chậm

**Dấu hiệu**: sau `docker compose down && up` mất sạch data Postgres; hoặc DB I/O cực chậm.
**Nguyên nhân**: data ghi vào writable layer (overlay copy-on-write rất tệ cho random write của DB) và writable layer bị xóa cùng container.
**Fix**: named volume `-v pgdata:/var/lib/postgresql/data`. Volume bypass overlay → ghi thẳng vào `/var/lib/docker/volumes` (hoặc backing FS), nhanh và persist.

### Bẫy 6 — alpine DNS/musl khác glibc

**Dấu hiệu**: app trên alpine không resolve được service trong K8s, hoặc `bcrypt` ném `Error: ... invalid ELF header`; build OK trên CI Debian nhưng fail runtime alpine.
**Fix**: đổi sang `-slim` (glibc) cho app có native deps; nếu giữ alpine → build native module *trong* alpine, đừng copy `node_modules` host. Với DNS K8s, cân nhắc `slim` hoặc cấu hình `ndots`.

### Bẫy bonus — `docker0` / port không publish, default bridge không có DNS

`-p 3000:3000` chỉ map ra host; container-to-container vẫn cần **user-defined network** mới resolve theo tên. Trên *default* bridge phải dùng IP (DNS theo tên tắt). Compose tự tạo user-defined network nên thường không gặp — nhưng `docker run` thủ công thì gặp ngay.

## ⚖️ Đánh đổi & quyết định thiết kế

### alpine vs slim vs distroless

| | alpine | slim (Debian) | distroless |
|---|---|---|---|
| Base size | ~50–80MB | ~75–80MB | ~120MB (đã gồm node) |
| libc | musl | glibc | glibc |
| Native deps | rủi ro (compile/prebuilt musl) | tốt nhất | tốt (glibc) |
| Shell/debug | có `sh` | có `bash` | **không** (dùng `kubectl debug`) |
| Attack surface | nhỏ | trung bình | **nhỏ nhất** |
| Khi nào dùng | đã test kỹ, không native deps | **mặc định prod** có native deps | security ưu tiên tối đa |

Quyết định mặc định: **`-slim` cho prod**. Native deps chạy ổn (glibc), vẫn nhỏ, còn shell để debug. Lên distroless khi đã chín và security là KPI.

### multi-stage vs single

- **Multi-stage**: image cuối nhỏ (~150MB vs >1GB), không devDeps/compiler/source TS → ít CVE, ít leak. Đánh đổi: Dockerfile dài hơn, cần hiểu `COPY --from`.
- **Single-stage**: chỉ chấp nhận cho throwaway/dev. Prod gần như luôn multi-stage.

### bind mount vs named volume

- **bind mount** (`$(pwd)/src:/app/src`): thấy ngay thay đổi host → **dev hot reload**. Nhược: phụ thuộc layout host, quyền uid lệch (host uid ≠ container uid → permission denied), trên Docker Desktop macOS/Windows chậm (đi qua VM filesystem).
- **named volume**: Docker quản lý, **persist data prod** (DB), backup/migrate dễ, lifecycle độc lập container. Nhược: không tiện sửa file trực tiếp từ host.
- Quy ước: **bind cho dev, named volume cho prod data.**

### 1 process / container

Mỗi container nên 1 process chính (1 concern). Lý do: PID 1 graceful + signal đơn giản, scale từng phần độc lập, log gọn (1 luồng stdout), healthcheck rõ ràng. Cần nhiều process (cron + app) → đa số là dấu hiệu nên tách container hoặc dùng orchestrator, không nhồi `supervisord`. Ngoại lệ hợp lý: sidecar pattern (tách *ra* container khác), hoặc `tini` (không phải "process nghiệp vụ").

## 🎯 Câu hỏi phỏng vấn NÂNG CAO

**Q1. Container khác VM ở tầng kernel ra sao? Vì sao isolation "yếu hơn"?**
VM có hypervisor + guest kernel riêng cho mỗi VM; cách ly ở ranh giới phần cứng ảo. Container *chia sẻ kernel host*, chỉ tách view bằng namespaces và tách tài nguyên bằng cgroups — không có kernel riêng. Yếu hơn vì attack surface là toàn bộ syscall table của host kernel: một kernel CVE khai thác từ trong container ảnh hưởng cả host. VM phải vượt qua thêm lớp hypervisor.

**Q2. Vì sao app không nhận SIGTERM khi dùng CMD dạng shell?**
Shell form `CMD node server.js` chạy thành `/bin/sh -c "node server.js"`, nên PID 1 là `sh`, node là con. `docker stop` gửi SIGTERM tới PID 1 (=`sh`); `sh` mặc định không trap và không forward SIGTERM cho con → node không bao giờ thấy signal, container chờ hết grace 10s rồi bị SIGKILL (137). Exec form làm node thành PID 1 nhận trực tiếp; thêm tini để vừa forward signal vừa reap zombie.

**Q3. Build cache invalidate khi nào? Vì sao thứ tự COPY quan trọng?**
Mỗi instruction có cache key = (parent layer + nội dung instruction). `RUN` key theo chuỗi lệnh; `COPY` key theo checksum file được copy. Một layer miss kéo theo *mọi* layer sau miss (cache key con phụ thuộc parent). Vì thế đặt cái ít đổi trước: `COPY package*.json` + `npm ci` trước `COPY . .` → sửa source không làm `npm ci` chạy lại. Đảo lại thì mỗi lần sửa code đều rebuild deps.

**Q4. Secret trong ARG/ENV có an toàn không?**
Không. `ENV` nằm trong image metadata vĩnh viễn (đọc qua `docker history`/`inspect`). `ARG` không vào ENV cuối nhưng *vẫn lộ trong build history/cache* và hiện trong `docker history` nếu được dùng trong layer. `COPY .env` thì secret nằm thẳng trong layer filesystem. Đúng cách: runtime env / Docker–K8s secrets; build-time secret dùng BuildKit `--mount=type=secret` (không persist vào layer).

**Q5. overlay2 copy-on-write hoạt động thế nào? Vì sao DB không nên ghi vào container layer?**
overlay2 union `lower` (image, read-only) + `upper` (writable) thành `merged`. Đọc file chưa sửa lấy từ lower (chia sẻ). Sửa file ở lower → **copy-up** toàn bộ file lên upper rồi mới sửa → ghi nhỏ vào file lớn rất đắt. DB làm random write liên tục → copy-up + overlay overhead → chậm và phình; thêm nữa writable layer mất khi xóa container → mất data. Dùng named volume (bypass overlay) cho DB.

**Q6. Exit code 137 vs 143 khác gì? Debug 137 thế nào?**
143 = 128+15 (SIGTERM) — thường graceful shutdown bình thường. 137 = 128+9 (SIGKILL) — bị giết cứng: do OOM killer (chạm `memory.max`) hoặc do `docker stop` hết grace period vì app không xử lý SIGTERM. Debug: `docker inspect -f '{{.State.OOMKilled}}'` (true → OOM), `dmesg|grep -i killed` trên host, `docker stats` xem MEM sát limit, kiểm tra CMD có shell-form không. Fix tương ứng: chỉnh heap/limit/leak, hoặc sửa graceful shutdown.

**Q7. PID 1 cần làm gì mà Node không tự làm? Hệ quả nếu thiếu?**
PID 1 phải reap zombie: process con mồ côi re-parent về PID 1 và cần `wait()` để dọn. Node không reap con-mồ-côi → app spawn child process tích tụ zombie, đầy process table, cuối cùng `fork()` fail. Ngoài ra kernel không đặt default signal handler cho PID 1 → signal không có handler bị drop. Dùng tini/`--init` làm PID 1: reap zombie + forward signal.

**Q8. Mount `/var/run/docker.sock` vào container có rủi ro gì? Vì sao?**
Socket đó là API đầy đủ của Docker daemon (chạy root). Container có quyền truy cập socket = điều khiển daemon = tạo container mới mount `/` của host với `--privileged` → đọc/ghi toàn bộ host → **container escape thành root host**. Nếu buộc phải dùng (CI runner), cân nhắc socket proxy giới hạn endpoint, rootless daemon, hoặc Sysbox/gVisor.

**Q9. Vì sao `--cpus=0.5` gây latency spike chứ không "chậm đều"?**
`--cpus` set CFS quota (quota/period). Khi process tiêu hết quota trong một period, kernel **throttle** — *dừng hẳn* process tới đầu period sau, không hạ priority. Tác vụ burst CPU bị "đóng băng" từng đợt → p99 latency tăng vọt dù CPU trung bình thấp. Với app bursty, nới quota hoặc dùng cpu shares (relative weight) thay vì hard quota.

## 📚 Đọc thêm

- Docker docs — *Storage drivers / overlayfs*: cơ chế lower/upper/merged và copy-on-write.
- `man 7 namespaces`, `man 7 cgroups`: nguồn gốc kernel của isolation.
- BuildKit docs — *cache mounts* và *secret mounts* (`RUN --mount=type=cache|secret`).
- `krallin/tini` README: vì sao cần init process; cờ `-g` để forward signal cho cả process group.
- Google distroless repo: images không shell, debug bằng ephemeral container.
- `wagoodman/dive`: soi từng layer, tìm chỗ phình và file thừa.
- Node.js docs — *process signals* và `server.close()`: nền tảng graceful shutdown trong container.
- Aqua/Trivy & `docker scout`: scan CVE, tích hợp CI fail trên CRITICAL.
