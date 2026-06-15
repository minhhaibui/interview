# Capstone Project Spec: Hệ thống xử lý đơn hàng E-commerce (Microservices)

> **Mục đích**: Đây là project "vũ khí" của bạn khi phỏng vấn. Một hệ thống microservices Node.js hoàn chỉnh, áp dụng đầy đủ các pattern production-grade, để bạn trả lời mọi câu hỏi "kể về project của bạn" bằng kinh nghiệm THẬT thay vì lý thuyết suông. Lịch thực hiện 6 ngày: xem `../week-11-capstone/README.md`.

---

## 1. Mô tả hệ thống & Yêu cầu chức năng

Hệ thống backend xử lý đơn hàng cho một trang e-commerce, mô phỏng flow thật từ lúc user bấm "Đặt hàng" đến khi nhận notification xác nhận.

### Functional requirements

| # | Yêu cầu | Mô tả |
|---|---|---|
| FR1 | Xem sản phẩm | User browse product catalog (list + detail), có cache |
| FR2 | Đặt hàng | User tạo order với 1-N items; order có trạng thái: `PENDING → CONFIRMED / CANCELLED` |
| FR3 | Kiểm tra & giữ tồn kho | Khi đặt hàng, hệ thống reserve stock; **tuyệt đối không oversell** kể cả khi nhiều request đồng thời |
| FR4 | Thanh toán giả lập | Payment service giả lập gọi cổng thanh toán (delay 200-800ms, fail ngẫu nhiên ~20% để test compensation); idempotent |
| FR5 | Notification | Gửi notification (giả lập: ghi log/console + lưu DB) khi order CONFIRMED hoặc CANCELLED |
| FR6 | Truy vấn order | User xem order detail + lịch sử trạng thái (timeline) |
| FR7 | Hủy & hoàn tác | Bất kỳ bước nào fail → tự động compensation: release stock, refund (giả lập), order → CANCELLED |

### Non-functional requirements

- **Consistency**: order + inventory cần đúng tuyệt đối (eventual consistency giữa services qua saga, nhưng kết quả cuối phải nhất quán).
- **Resilience**: một service chết và sống lại → không mất event, không order kẹt vĩnh viễn.
- **Idempotency**: mọi consumer xử lý duplicate event an toàn; payment không bao giờ charge 2 lần.
- **Observability**: structured logs có correlation ID xuyên service; health checks.
- **Scalability**: mỗi service stateless, scale ngang độc lập (chứng minh bằng HPA trên K8s).

---

## 2. Kiến trúc tổng thể

```
                            ┌──────────────────────────┐
                            │         Client           │
                            │   (curl / Postman / k6)  │
                            └────────────┬─────────────┘
                                         │ HTTPS
                                         ▼
                            ┌──────────────────────────┐
                            │       API Gateway        │
                            │  (Nginx hoặc Express GW) │
                            │  - routing               │
                            │  - rate limiting (Redis) │
                            │  - auth (JWT verify)     │
                            └──────┬──────────┬────────┘
                     /orders,      │          │  /products
                     /payments...  │          │
              ┌────────────────┐  │          │  ┌────────────────────┐
              │                ▼  ▼          ▼  ▼                    │
   ┌──────────┴───────┐ ┌──────────────┐ ┌──────────────────┐ ┌─────┴────────────┐
   │  order-service   │ │ payment-     │ │ inventory-       │ │ notification-    │
   │  (Node.js)       │ │ service      │ │ service          │ │ service          │
   │                  │ │ (Node.js)    │ │ (Node.js)        │ │ (Node.js)        │
   └───┬─────────┬────┘ └───┬─────┬────┘ └───┬─────┬────────┘ └──────┬───────────┘
       │         │          │     │          │     │                 │
       ▼         │          ▼     │          ▼     ▼                 ▼
 ┌───────────┐   │   ┌───────────┐│   ┌──────────┐ ┌────────┐ ┌───────────┐
 │PostgreSQL │   │   │PostgreSQL ││   │ MongoDB  │ │ Redis  │ │PostgreSQL │
 │ orders db │   │   │payments db││   │ product  │ │ cache+ │ │ notif db  │
 │ + outbox  │   │   │ + outbox  ││   │ catalog  │ │ lock + │ │ (delivery │
 └───────────┘   │   └───────────┘│   │ +reserva-│ │ rate-  │ │  log)     │
                 │                │   │  tions   │ │ limit  │ └───────────┘
                 │                │   └──────────┘ └────────┘
                 │                │          │
                 ▼                ▼          ▼
       ┌─────────────────────────────────────────────────────┐
       │                    Kafka (event bus)                │
       │  topics:                                            │
       │   order.order-created                               │
       │   inventory.inventory-reserved / inventory-failed   │
       │   payment.payment-completed / payment-failed        │
       │   order.order-confirmed / order-cancelled           │
       │   *.dlq (dead letter topics)                        │
       └─────────────────────────────────────────────────────┘
```

**Saga choreography flow (happy path):**
```
1. POST /orders → order-service: ghi order PENDING + outbox event (1 transaction)
2. outbox relay → Kafka: "order-created"
3. inventory-service nghe → reserve stock (distributed lock + atomic update)
   → emit "inventory-reserved"
4. payment-service nghe → charge (idempotent, giả lập)
   → emit "payment-completed"
5. order-service nghe → order CONFIRMED → emit "order-confirmed"
6. notification-service nghe → gửi notification
```

**Compensation flows:**
```
inventory-failed   → order-service: order CANCELLED → emit "order-cancelled" → notification
payment-failed     → inventory-service: release stock
                   → order-service: order CANCELLED → notification
```

---

## 3. Yêu cầu kỹ thuật từng service

> Stack chung mỗi service: Node.js 20+, TypeScript (khuyến nghị) hoặc JS, Express/Fastify, `kafkajs`, `pino` (logging), validate bằng `zod`/`joi`. Mỗi service một thư mục, một `package.json`, một Dockerfile riêng.

### 3.1 API Gateway (cổng vào duy nhất)

- Nginx (đơn giản) **hoặc** Express gateway tự viết (học được nhiều hơn — khuyến nghị).
- Nhiệm vụ:
  - Route: `/api/orders/*` → order-service, `/api/products/*` → inventory-service, `/api/payments/*` → payment-service.
  - **Rate limiting**: token bucket trên Redis, 20 req/s per IP (tái dùng bài tập tuần 10).
  - Verify JWT (tự cấp token bằng script seed, không cần auth service đầy đủ), forward `x-user-id`.
  - Sinh `x-request-id` (UUID) nếu chưa có → forward xuống mọi service (correlation ID).

### 3.2 order-service (PostgreSQL)

**Endpoints:**

| Method | Path | Mô tả |
|---|---|---|
| POST | `/orders` | Tạo order. Header `Idempotency-Key` bắt buộc. Body: `{ items: [{ productId, quantity }] }`. Trả `202 Accepted` + order PENDING |
| GET | `/orders/:id` | Order detail + items + status history |
| GET | `/orders?userId=` | List orders của user (pagination cursor-based) |
| GET | `/health`, `/health/ready` | Liveness / readiness (check DB + Kafka) |

**DB schema (PostgreSQL):**
```sql
CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  status          TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING|CONFIRMED|CANCELLED
  total_amount    NUMERIC(12,2) NOT NULL,
  idempotency_key TEXT UNIQUE NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID NOT NULL REFERENCES orders(id),
  product_id TEXT NOT NULL,
  quantity   INT NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL
);

CREATE TABLE order_status_history (
  id         BIGSERIAL PRIMARY KEY,
  order_id   UUID NOT NULL REFERENCES orders(id),
  from_status TEXT,
  to_status   TEXT NOT NULL,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- OUTBOX PATTERN (bắt buộc)
CREATE TABLE outbox (
  id           BIGSERIAL PRIMARY KEY,
  aggregate_id UUID NOT NULL,         -- order id
  topic        TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  payload      JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ            -- NULL = chưa publish
);
CREATE INDEX idx_outbox_unpublished ON outbox (id) WHERE published_at IS NULL;

-- IDEMPOTENT CONSUMER (bắt buộc, mỗi service có bảng tương tự)
CREATE TABLE processed_events (
  event_id     TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Consume:** `inventory-failed`, `payment-completed`, `payment-failed` → cập nhật status + history + outbox event tiếp theo.

### 3.3 inventory-service (MongoDB + Redis)

**Endpoints:**

| Method | Path | Mô tả |
|---|---|---|
| GET | `/products` | List catalog (cache-aside Redis, TTL 60s) |
| GET | `/products/:id` | Product detail (cache-aside) |
| POST | `/products` | Seed/tạo sản phẩm (internal, cho script seed) |
| GET | `/health`, `/health/ready` | Health checks |

**MongoDB collections:**
```js
// products
{
  _id: "prod-001",
  name: "iPhone 17",
  price: 999.00,
  stock: 100,            // số lượng còn bán được
  reserved: 0,           // đang được giữ bởi order PENDING
  category: "phones",
  updatedAt: ISODate
}

// reservations (audit + để release khi compensation)
{
  _id: ObjectId,
  orderId: "uuid",
  items: [{ productId: "prod-001", quantity: 2 }],
  status: "RESERVED",    // RESERVED | RELEASED | COMMITTED
  createdAt: ISODate
}
```

**Logic reserve stock (trái tim chống oversell) — 2 lớp:**
1. **Redis distributed lock** per product khi reserve nhiều items (tránh deadlock: sort productId trước khi lock lần lượt, TTL lock 5s, dùng SET NX PX + Lua release):
   ```
   lock:product:{productId} = orderId (NX, PX 5000)
   ```
2. **MongoDB atomic conditional update** (lớp bảo vệ cuối — đúng cả khi lock fail):
   ```js
   const res = await products.updateOne(
     { _id: productId, stock: { $gte: qty } },
     { $inc: { stock: -qty, reserved: qty } }
   );
   if (res.modifiedCount === 0) throw new InsufficientStockError();
   ```
- Tất cả items reserve OK → ghi reservation + emit `inventory-reserved`. Một item fail → rollback các item đã trừ → emit `inventory-failed`.
- Consume `payment-failed` / `order-cancelled` → release (`$inc` ngược lại, reservation → RELEASED). Consume `payment-completed` → reservation → COMMITTED.
- **Cache invalidation**: sau khi update stock → `DEL product:{id}` (delete, không update cache).

### 3.4 payment-service (PostgreSQL)

**Endpoints:** `GET /payments/:orderId`, `GET /health` (charge được trigger qua event, không qua HTTP).

**DB schema:**
```sql
CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID UNIQUE NOT NULL,   -- unique = idempotency theo order
  amount          NUMERIC(12,2) NOT NULL,
  status          TEXT NOT NULL,          -- COMPLETED | FAILED | REFUNDED
  provider_txn_id TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- + bảng outbox và processed_events như order-service
```

**Logic:** consume `inventory-reserved` → check `processed_events` + unique `order_id` (idempotent 2 lớp) → giả lập gọi provider:
```js
async function fakeCharge(orderId, amount) {
  await sleep(200 + Math.random() * 600);
  if (Math.random() < 0.2) throw new PaymentDeclinedError(); // 20% fail để test saga
  return { txnId: `txn_${crypto.randomUUID()}` };
}
```
→ ghi payment + outbox `payment-completed` / `payment-failed` trong 1 transaction.

### 3.5 notification-service (PostgreSQL nhẹ hoặc dùng chung instance)

- Consume `order-confirmed`, `order-cancelled` → render message từ template → "gửi" (console.log có màu + ghi bảng `notifications`: id, order_id, channel, status, sent_at).
- Idempotent: duplicate event không gửi 2 lần (check `processed_events`).
- Retry 3 lần với backoff nếu "gửi" fail (giả lập fail 10%) → vượt → đẩy `notification.dlq`.

### 3.6 Event schema (chuẩn chung mọi event)

```json
{
  "eventId": "uuid-v4",
  "eventType": "order-created",
  "version": 1,
  "occurredAt": "2026-06-10T08:00:00.000Z",
  "correlationId": "x-request-id ban đầu",
  "aggregateId": "order uuid",
  "payload": {
    "orderId": "uuid",
    "userId": "uuid",
    "items": [{ "productId": "prod-001", "quantity": 2, "unitPrice": 999.0 }],
    "totalAmount": 1998.0
  }
}
```
- `eventId` dùng cho idempotent consumer. `correlationId` xuyên suốt để trace. Partition key Kafka = `orderId` → mọi event của 1 order vào cùng partition → **giữ ordering per order**.

---

## 4. Các pattern bắt buộc áp dụng

| Pattern | Áp dụng ở đâu | Tại sao (câu trả lời phỏng vấn) |
|---|---|---|
| **Outbox pattern** | order/payment-service: ghi event vào bảng `outbox` cùng transaction với business data; một relay loop (poll mỗi 500ms, `SELECT ... WHERE published_at IS NULL ORDER BY id LIMIT 100 FOR UPDATE SKIP LOCKED`) publish lên Kafka rồi đánh dấu | Giải dual-write problem: không bao giờ "ghi DB xong nhưng publish fail" hoặc ngược lại. Production có thể thay relay bằng Debezium CDC |
| **Saga (choreography)** | Toàn bộ order flow + compensation | Distributed transaction không dùng được 2PC; mỗi service tự chủ, eventual consistency với compensation rõ ràng |
| **Idempotent consumer** | Mọi consumer: check `eventId` trong `processed_events` TRONG CÙNG transaction với business update | Kafka là at-least-once; rebalance/retry sinh duplicate |
| **Idempotency key (API)** | `POST /orders` | Client retry không tạo order trùng |
| **Cache-aside** | inventory-service đọc product; invalidate bằng DELETE khi stock đổi | Read-heavy catalog; delete tránh race ghi đè data cũ |
| **Distributed lock** | Redis lock per product khi reserve | Serialize reserve nhiều item; lớp 2 là atomic conditional update đề phòng lock hết hạn |
| **DLQ** | Mọi consumer: fail 3 lần (backoff 1s/5s/25s) → publish sang `{topic}.dlq` kèm `error`, `originalTopic`, `retryCount` | Poison message không chặn cả partition; có thể replay sau khi fix bug |
| **Graceful shutdown** | Mọi service: bắt SIGTERM → ngừng nhận request mới → `consumer.disconnect()` (commit offset) → đóng DB pool → exit; timeout cứng 10s | K8s gửi SIGTERM khi rolling update; không mất in-flight work |
| **Health check** | `/health` (liveness: process sống) và `/health/ready` (readiness: DB + Kafka ping OK) tách riêng | K8s không route traffic vào pod chưa sẵn sàng; restart pod treo |
| **Rate limiting** | API Gateway, token bucket Redis | Chống abuse, bảo vệ downstream |

---

## 5. Hạ tầng

### 5.1 Dockerfile multi-stage (mẫu cho mỗi service)

```dockerfile
# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build            # tsc; bỏ qua nếu dùng JS thuần

# ---- production deps ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ---- runtime ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER app
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/index.js"]
```
Điểm nhấn kể được: multi-stage giảm image ~1GB → ~150MB, non-root user, `npm ci` reproducible, layer caching (copy package.json trước).

### 5.2 docker-compose (local dev)

```yaml
# docker-compose.yml — rút gọn, đủ ý chính
services:
  postgres:
    image: postgres:16-alpine
    environment: { POSTGRES_PASSWORD: dev, POSTGRES_DB: orders }
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U postgres"], interval: 5s }

  mongodb:
    image: mongo:7
    ports: ["27017:27017"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  kafka:
    image: bitnami/kafka:3.7        # KRaft mode, không cần ZooKeeper
    ports: ["9092:9092"]
    environment:
      KAFKA_CFG_NODE_ID: 0
      KAFKA_CFG_PROCESS_ROLES: controller,broker
      KAFKA_CFG_LISTENERS: PLAINTEXT://:9092,CONTROLLER://:9093
      KAFKA_CFG_CONTROLLER_QUORUM_VOTERS: 0@kafka:9093
      KAFKA_CFG_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CFG_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092

  api-gateway:
    build: ./api-gateway
    ports: ["8080:3000"]
    depends_on: [redis, order-service, inventory-service]

  order-service:
    build: ./order-service
    environment:
      DATABASE_URL: postgres://postgres:dev@postgres:5432/orders
      KAFKA_BROKERS: kafka:9092
    depends_on:
      postgres: { condition: service_healthy }
      kafka: { condition: service_started }

  # inventory-service, payment-service, notification-service: tương tự

volumes:
  pgdata:
```
Kèm script `scripts/seed.js` (tạo 20 products, 5 users + JWT) và `scripts/load-test.js` (k6 hoặc autocannon).

### 5.3 Kubernetes manifests (thư mục `k8s/`)

Mỗi service gồm 4 file (mẫu cho order-service):

```yaml
# k8s/order-service/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: order-service }
spec:
  replicas: 2
  selector: { matchLabels: { app: order-service } }
  template:
    metadata: { labels: { app: order-service } }
    spec:
      terminationGracePeriodSeconds: 30
      containers:
        - name: order-service
          image: <registry>/order-service:1.0.0
          ports: [{ containerPort: 3000 }]
          envFrom:
            - configMapRef: { name: order-service-config }
            - secretRef: { name: order-service-secret }
          resources:
            requests: { cpu: 100m, memory: 128Mi }
            limits: { cpu: 500m, memory: 512Mi }
          livenessProbe:
            httpGet: { path: /health, port: 3000 }
            initialDelaySeconds: 10
            periodSeconds: 15
          readinessProbe:
            httpGet: { path: /health/ready, port: 3000 }
            initialDelaySeconds: 5
            periodSeconds: 10
---
# k8s/order-service/service.yaml
apiVersion: v1
kind: Service
metadata: { name: order-service }
spec:
  selector: { app: order-service }
  ports: [{ port: 80, targetPort: 3000 }]
---
# k8s/order-service/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: { name: order-service }
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: order-service }
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource: { name: cpu, target: { type: Utilization, averageUtilization: 70 } }
---
# k8s/order-service/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata: { name: order-service-config }
data:
  KAFKA_BROKERS: "kafka:9092"
  LOG_LEVEL: "info"
  PORT: "3000"
```
- Gateway expose qua `Ingress` (nginx-ingress) hoặc `Service type: LoadBalancer`.
- Secrets (DATABASE_URL, JWT_SECRET) qua `Secret` (demo) — nhắc được "production dùng External Secrets/Vault" là điểm cộng.
- Test local bằng **minikube** hoặc **kind**: `kind create cluster && kubectl apply -f k8s/ -R`.
- Demo đáng giá khi phỏng vấn: `kubectl delete pod` 1 pod order-service giữa load test → chứng minh không mất order (graceful shutdown + saga recovery).

### 5.4 Deploy AWS

**Phương án chính (production-like): EKS + managed services**

| Thành phần | AWS service |
|---|---|
| K8s cluster | EKS (hoặc ECS Fargate nếu muốn đơn giản hơn) |
| PostgreSQL | RDS PostgreSQL (Multi-AZ nói được, single-AZ để tiết kiệm) |
| MongoDB | DocumentDB hoặc MongoDB Atlas free tier (M0) |
| Redis | ElastiCache Redis |
| Kafka | MSK (hoặc MSK Serverless) |
| Images | ECR |
| Ingress | ALB qua AWS Load Balancer Controller |

Các bước tóm tắt:
1. `aws ecr create-repository` × 5 → build & push images (`docker buildx --platform linux/amd64`).
2. `eksctl create cluster --name capstone --nodes 2 -t t3.medium`.
3. Tạo RDS/ElastiCache/MSK trong cùng VPC với EKS, security group cho phép node group truy cập.
4. Cập nhật ConfigMap/Secret trỏ endpoints AWS → `kubectl apply -f k8s/ -R`.
5. Smoke test qua ALB DNS.

> ⚠️ **Chi phí**: EKS ($0.10/h control plane) + MSK + ElastiCache KHÔNG free. Dựng để chụp screenshot/demo rồi **xóa ngay trong ngày** (`eksctl delete cluster`, xóa RDS/MSK/ElastiCache). Ước tính < $5 nếu gọn trong vài giờ.

**Phương án free-tier / không tốn tiền (khuyến nghị nếu ngân sách = 0):**
- **LocalStack** (docker): giả lập S3, SQS, Secrets Manager... — đủ để demo "code tích hợp AWS SDK" (ví dụ thay Kafka DLQ archive bằng S3 LocalStack).
- Kafka/Redis/Postgres/Mongo chạy docker-compose local; K8s bằng **kind/minikube** — phỏng vấn quan tâm bạn HIỂU manifests và pattern hơn là cluster thật.
- Hoặc 1 EC2 t2.micro/t3.micro (free tier 12 tháng) chạy docker-compose + RDS db.t3.micro free tier — đủ để nói "tôi đã deploy lên AWS".
- Khi kể trong phỏng vấn: "Tôi chạy production-like trên kind với đầy đủ HPA, probes, graceful shutdown; đã viết sẵn plan EKS/RDS/MSK và hiểu rõ phải đổi gì khi lên managed services" — hoàn toàn chấp nhận được.

---

## 6. Milestones 6 ngày (khớp với `../week-11-capstone/README.md`)

| Ngày | Milestone | Definition of Done |
|---|---|---|
| **1** | **Skeleton + Infra local**: monorepo structure, docker-compose (Postgres, Mongo, Redis, Kafka) chạy được, 4 service skeleton có `/health`, seed script, gateway route được | `docker compose up` → `curl localhost:8080/api/products` trả seed data |
| **2** | **Order + Outbox**: POST /orders với idempotency key, schema đầy đủ, outbox relay publish `order-created` lên Kafka | Tạo order → thấy event trên Kafka (console consumer); duplicate idempotency key → trả response cũ |
| **3** | **Inventory + chống oversell**: consume `order-created`, reserve stock với lock + atomic update, cache-aside cho GET products, emit `inventory-reserved/failed` | Test 20 orders đồng thời stock=5 → đúng 5 reserved; cache hit thấy trong log |
| **4** | **Payment + saga hoàn chỉnh**: payment consume + idempotent + outbox; order-service consume kết quả → CONFIRMED/CANCELLED; compensation release stock; notification-service | Happy path end-to-end < 3s; với 20% payment fail: stock cuối = stock đầu − orders CONFIRMED |
| **5** | **Resilience**: idempotent consumer mọi nơi, DLQ + retry backoff, graceful shutdown, chaos test (kill từng service dưới load) | Chaos script pass: kill/restart bất kỳ service nào → 0 order kẹt, 0 sai kho, 0 duplicate notification |
| **6** | **K8s + tài liệu + demo**: Dockerfile multi-stage cả 5 image, manifests apply lên kind, HPA hoạt động, README + ARCHITECTURE.md + demo script 10 phút | `kubectl apply -f k8s/ -R` xong toàn bộ chạy; load test kích HPA scale 2→4; demo được không vấp |

---

## 7. Checklist hoàn thành + điểm nhấn để kể trong phỏng vấn

### Checklist hoàn thành

- [ ] `docker compose up` một lệnh là chạy toàn bộ hệ thống (kèm seed tự động hoặc 1 lệnh seed).
- [ ] Happy path end-to-end: tạo order → CONFIRMED + notification, kiểm tra được qua `GET /orders/:id` thấy timeline đủ trạng thái.
- [ ] Compensation: ép payment fail 100% (env `PAYMENT_FAIL_RATE=1`) → order CANCELLED, stock được trả lại đúng.
- [ ] Concurrency test: 50 orders đồng thời, stock=10 → đúng 10 CONFIRMED, stock=0, không âm.
- [ ] Idempotency: gửi lại request cùng `Idempotency-Key` và replay event Kafka → không có side effect lặp.
- [ ] DLQ: inject poison message → vào `.dlq` sau 3 retries, service vẫn xử lý message khác bình thường.
- [ ] Kill -SIGTERM một service giữa load → log "graceful shutdown", không mất event sau khi restart.
- [ ] K8s: deploy lên kind/minikube, readiness probe chặn traffic khi DB chưa sẵn sàng, HPA scale được.
- [ ] README có: kiến trúc diagram, hướng dẫn chạy < 5 phút, mô tả từng pattern và VÌ SAO dùng.
- [ ] Push lên GitHub, repo public, commit history sạch (theo ngày milestone).

### Điểm nhấn để kể trong phỏng vấn (chuẩn bị sẵn câu chuyện)

1. **Outbox pattern**: "Em gặp dual-write problem: ghi DB xong, publish Kafka fail thì event mất. Em giải bằng outbox table cùng transaction + relay loop với `FOR UPDATE SKIP LOCKED` để chạy được nhiều relay instance."
2. **Chống oversell 2 lớp**: "Redis lock để serialize, nhưng lock có TTL nên không tuyệt đối — lớp cuối là conditional update `stock >= qty` ở MongoDB. Em test bằng 50 request đồng thời."
3. **Vì sao saga choreography chứ không orchestration**: flow 4 bước tuyến tính, ít branch → choreography đủ và loose coupling; nếu thêm shipping, voucher, loyalty → cân nhắc orchestrator.
4. **Idempotency 2 tầng**: API level (idempotency key) chống client retry; consumer level (processed_events trong cùng transaction) chống Kafka at-least-once.
5. **Một bug thật đã gặp** (ghi lại trong quá trình làm — chắc chắn sẽ có): ví dụ consumer rebalance làm xử lý trùng, lock không release do crash, cache trả stock cũ... Kể bug + cách debug + fix là phần ăn điểm NHẤT.
6. **Số liệu**: chuẩn bị 3-4 con số: latency p95 của POST /orders, throughput khi load test, thời gian end-to-end saga, image size trước/sau multi-stage.

---

## 8. Gợi ý mở rộng (nếu còn thời gian / để nói "next steps")

1. **Observability đầy đủ**:
   - `prom-client` expose `/metrics` từng service → Prometheus + Grafana (docker-compose thêm 2 service). Dashboard RED: request rate, error rate, p95 latency, Kafka consumer lag, event loop lag.
   - Alert rule mẫu: consumer lag > 1000 trong 5 phút.
2. **Distributed tracing**: OpenTelemetry SDK (`@opentelemetry/sdk-node` + auto-instrumentation cho http/express/kafkajs/pg) → Jaeger. Demo trace 1 order xuyên 4 service kể cả qua Kafka — cực ấn tượng khi share màn hình.
3. **CI/CD**: GitHub Actions — pipeline: lint → unit test → integration test (docker compose + testcontainers) → build & push image (tag = git sha) → `kubectl apply` lên kind trong CI hoặc deploy ArgoCD (GitOps).
4. **Schema registry**: Avro/JSON Schema cho event versioning thay vì JSON tự do.
5. **Orchestration thử nghiệm**: viết lại saga bằng Temporal để so sánh trực tiếp 2 cách — chủ đề thảo luận senior-level.
6. **Read model / CQRS-lite**: projection service nghe mọi event, build bảng `order_summary` denormalized phục vụ query/dashboard.
7. **Security hardening**: mTLS giữa services (linkerd), network policies, secret rotation.
