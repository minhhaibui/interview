# Upgrade 4 — Docker hóa + chạy trên Kubernetes (sau tuần 7-8)

`Dockerfile`, `.dockerignore` và `k8s/order-service.yaml` đã có sẵn trong thư mục này — bạn build và apply được ngay. Mục tiêu: hiểu từng dòng và trả lời được các câu hỏi đi kèm.

## 1. Docker — build & chạy

```bash
cd capstone-project
docker build -t order-service:dev .
docker run -d --name order-svc -p 3000:3000 order-service:dev

curl localhost:3000/health
docker logs order-svc
docker rm -f order-svc
```

Điểm đáng nói trong Dockerfile hiện tại:
- `node:20-alpine` — base nhỏ (~50MB thay vì ~1GB của bản full)
- `USER node` — không chạy bằng root (security best practice, PV hay hỏi)
- `.dockerignore` loại test/docs → context build nhỏ, không lộ file thừa vào image

## 2. Multi-stage — dùng khi đã có package.json (sau Upgrade 1-3)

Thứ tự COPY quyết định cache: `package*.json` trước (ít đổi) → `npm ci` được cache; source sau (đổi liên tục) → chỉ layer cuối rebuild.

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
```

## 3. Kubernetes — chạy bằng kind hoặc minikube

```bash
# kind: tạo cluster + nạp image local vào node
kind create cluster --name prep
kind load docker-image order-service:dev --name prep

kubectl apply -f k8s/
kubectl get pods -w        # chờ 2/2 Running, READY 1/1

# Gọi thử qua Service
kubectl port-forward svc/order-service 8080:80
curl localhost:8080/health
```

Đọc kỹ `k8s/order-service.yaml` — 3 khối quan trọng nhất:
- **livenessProbe**: fail → restart container. Dành cho app treo hẳn.
- **readinessProbe**: fail → rút Pod khỏi Service nhưng không restart. Dành cho lúc warm-up/quá tải. Nhầm hai cái này → restart loop (RAPID-FIRE Q31).
- **resources**: `requests` để scheduler xếp chỗ và HPA tính %, `limits` chặn một Pod ăn cả node.

## 4. Thí nghiệm đáng làm (mỗi cái 5 phút)

```bash
# Rolling update không downtime: đổi tag image rồi quan sát
kubectl set image deployment/order-service order-service=order-service:dev2
kubectl rollout status deployment/order-service
kubectl rollout undo deployment/order-service

# Tự hồi phục: xóa 1 pod → Deployment tạo lại ngay
kubectl delete pod -l app=order-service --wait=false && kubectl get pods -w

# HPA (cần metrics-server): scale 2→10 theo CPU
kubectl autoscale deployment order-service --min=2 --max=10 --cpu-percent=70
```

## 5. Checklist nghiệm thu

- [ ] `docker build` xong, image < 200MB (`docker images order-service:dev`)
- [ ] Container chạy bằng user `node`, không phải root (`docker exec order-svc whoami`)
- [ ] 2 Pod Running, kill 1 pod → tự mọc lại trong vài giây
- [ ] Sửa /health trả 500 → chứng kiến liveness restart container (xem `kubectl describe pod`)
- [ ] Rolling update + rollback chạy được, không rớt request nào (chạy `while true; do curl -s localhost:8080/health; sleep 0.2; done` trong lúc update)

## 6. Câu hỏi tự kiểm tra (trả lời to thành tiếng)

1. Vì sao COPY package.json trước COPY src? Đảo lại thì build chậm đi thế nào?
2. Liveness và readiness khác nhau gì? Cho ví dụ một app cần readiness mà không cần liveness.
3. Thiếu `resources.requests` thì HPA và scheduler bị ảnh hưởng gì?
4. Image alpine có trade-off gì? (musl vs glibc, native module…)

> Tiếp theo: tuần 9 → UPGRADE-05 AWS (SQS thay outbox consumer, S3 presigned URL cho invoice).
