# 🚀 Capstone — Bắt đầu code

Skeleton **Order Service** chạy được ngay bằng Node core (không cần `npm install`), kiến trúc 3 lớp đúng những gì đã học: `server (HTTP) → service (business) → repo (storage)`.

## Chạy thử

```bash
# Chạy server
node capstone-project/src/server.js

# Tạo order (idempotency key chống tạo trùng khi retry)
curl -X POST localhost:3000/orders \
  -H "content-type: application/json" -H "idempotency-key: demo-1" \
  -d '{"items":[{"productId":"p1","quantity":2,"price":50000}]}'

# Gửi LẠI đúng lệnh trên → nhận lại order cũ với "idempotentReplay": true

# Lấy order theo id
curl localhost:3000/orders/<id-vừa-tạo>

# Chạy unit test
node --test capstone-project/test/
```

## Cấu trúc

```
src/
  server.js              # HTTP layer + composition root (wiring dependency)
  lib/router.js          # router tối giản, match '/orders/:id'
  lib/errors.js          # AppError có statusCode — service không biết về HTTP
  services/order-service.js  # business logic: validate, total, idempotency
  repos/order-repo.js    # in-memory, interface sẵn sàng swap Postgres
test/
  order-service.test.js  # node:test — không cần framework
```

## Lộ trình mở rộng (mỗi tuần học xong thì quay lại đây nâng cấp)

| Sau tuần | Việc cần làm | Pattern luyện được |
|---|---|---|
| 3 (SQL) | Viết `PostgresOrderRepo` cùng interface — làm theo [UPGRADE-01-POSTGRES.md](UPGRADE-01-POSTGRES.md) | Repository pattern, transaction |
| 5 (Redis) | Cache `GET /orders/:id` — làm theo [UPGRADE-02-REDIS.md](UPGRADE-02-REDIS.md) | Cache-aside, stampede |
| 6 (Kafka) | Publish event `OrderCreated` — làm theo [UPGRADE-03-KAFKA.md](UPGRADE-03-KAFKA.md) | Outbox, at-least-once |
| 7 (Docker) | Build image — `Dockerfile` có sẵn, xem [UPGRADE-04-DOCKER-K8S.md](UPGRADE-04-DOCKER-K8S.md) | Layer caching |
| 8 (K8s) | Apply `k8s/order-service.yaml` — cùng guide Upgrade 4 | Probes, rolling update |
| 9 (AWS) | Thay outbox consumer bằng SQS, file invoice lên S3 presigned URL | Managed services |

> Spec đầy đủ của hệ thống (inventory, payment, notification service…) xem `README.md` cùng thư mục. Skeleton này là service đầu tiên — làm chủ nó rồi mới tách tiếp các service khác.
