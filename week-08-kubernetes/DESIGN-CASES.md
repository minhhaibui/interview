# Tuần 8 — Thiết kế hệ thống & Case thực tế: Kubernetes

> Tài liệu bổ trợ cho README.md cùng thư mục. Học sau khi xong phần lý thuyết.

## 🏗️ Mini System Design (scoped vào chủ đề tuần)

### Bài 1: Topology deploy 4 microservices Node.js lên K8s

**Đề bài:** Hệ thống gồm 4 services Node.js: `gateway` (BFF, public), `users`, `orders`, `notifications` (worker, không nhận HTTP từ ngoài). Số liệu đo từ staging/production cũ:

| Service | RPS peak | p99 latency | CPU/pod lúc peak | Memory ổn định | Memory peak |
|---|---|---|---|---|---|
| gateway | 2.000 | 120ms | ~0.6 core | 220MB | 350MB |
| users | 800 | 60ms | ~0.3 core | 180MB | 250MB |
| orders | 600 | 200ms | ~0.5 core | 300MB | 450MB |
| notifications | (queue) | — | ~0.2 core | 150MB | 400MB (burst gửi email) |

Yêu cầu: thiết kế namespace, Deployment + HPA cho từng service, ingress routing, quản lý config/secret, PDB; **giải thích cách suy ra resource requests/limits từ bảng số liệu trên**.

**Phân tích & lời giải:**

**Bước 1 — Topology tổng thể:**

```
                    Internet
                       │
              ┌────────▼────────┐
              │ Ingress (nginx) │  TLS terminate, /api/* → gateway
              └────────┬────────┘
        namespace: shop-prod
   ┌───────────────────┼──────────────────────────────┐
   │            ┌──────▼──────┐                       │
   │            │  gateway    │ Deployment x3-10 (HPA)│
   │            └──┬───────┬──┘                       │
   │      ClusterIP│       │ClusterIP                 │
   │        ┌──────▼──┐ ┌──▼──────┐  ┌─────────────┐  │
   │        │  users  │ │ orders  │  │notifications│  │
   │        │  x2-6   │ │  x2-8   │  │  x2-?(queue)│  │
   │        └─────────┘ └────┬────┘  └──────▲──────┘  │
   │                         │ publish      │ consume │
   │                         └────► Queue ──┘         │
   └──────────────────────────────────────────────────┘
   ConfigMap/Secret per-service · PDB per-service · NetworkPolicy
```

Quyết định namespace: **1 namespace cho cả hệ thống theo môi trường** (`shop-prod`, `shop-staging`) thay vì 1 namespace/service. Lý do: 4 services cùng một team, cùng vòng đời — namespace là ranh giới của *team/tenant/môi trường* (RBAC, ResourceQuota, NetworkPolicy), không phải của từng service. Tách namespace per-service chỉ đáng khi nhiều team sở hữu riêng.

**Bước 2 — Suy ra requests/limits từ số liệu (phần interviewer chấm điểm nhất):**

Nguyên tắc:
- **CPU request** = mức dùng thực tế lúc cao điểm (p95) — vì scheduler xếp pod theo request; request quá cao là lãng phí node, quá thấp là pod bị "nhồi nhét" rồi đói CPU.
- **CPU limit**: với Node.js nên đặt **rộng tay hoặc không đặt** — CPU là tài nguyên compressible, vượt thì bị throttle chứ không chết; CFS throttling làm latency tăng vọt khó hiểu. Phổ biến: limit = 2× request, hoặc bỏ limit nếu cluster tin cậy.
- **Memory request = memory limit** (Guaranteed-ish về memory) — memory là incompressible, vượt là OOMKill; đặt limit = peak đo được × 1.3-1.5 headroom.
- Node single-thread cho JS: request CPU > 1 core/pod gần như vô nghĩa với service thuần JS → **scale ngang thay vì tăng CPU/pod**.

Áp vào `orders` (CPU 0.5 core peak, mem 450MB peak):

```yaml
resources:
  requests:
    cpu: 500m
    memory: 640Mi      # 450MB × 1.4
  limits:
    cpu: "1"           # rộng tay, tránh throttle khi GC/burst
    memory: 640Mi      # = request → tránh node memory overcommit
```

Kèm `NODE_OPTIONS=--max-old-space-size=480` (~75% của 640Mi).

**Bước 3 — Manifest mẫu cho 1 service (orders), các service khác cùng khuôn:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orders
  namespace: shop-prod
  labels: { app: orders }
spec:
  replicas: 2                      # HPA sẽ quản, đây là min ban đầu
  selector: { matchLabels: { app: orders } }
  template:
    metadata:
      labels: { app: orders }
    spec:
      topologySpreadConstraints:    # trải pod ra nhiều node/AZ
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: ScheduleAnyway
          labelSelector: { matchLabels: { app: orders } }
      containers:
        - name: orders
          image: ghcr.io/myorg/orders:sha-3f2a91c   # immutable tag
          ports: [{ containerPort: 3000 }]
          envFrom:
            - configMapRef: { name: orders-config }
            - secretRef:    { name: orders-secrets }
          resources:
            requests: { cpu: 500m, memory: 640Mi }
            limits:   { cpu: "1",  memory: 640Mi }
          readinessProbe:
            httpGet: { path: /healthz/ready, port: 3000 }
            periodSeconds: 5
            failureThreshold: 3
          livenessProbe:
            httpGet: { path: /healthz/live, port: 3000 }
            initialDelaySeconds: 10
            periodSeconds: 10
            failureThreshold: 3
          lifecycle:
            preStop:
              exec: { command: ["sleep", "5"] }
      terminationGracePeriodSeconds: 30
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: { name: orders, namespace: shop-prod }
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: orders }
  minReplicas: 2
  maxReplicas: 8
  metrics:
    - type: Resource
      resource:
        name: cpu
        target: { type: Utilization, averageUtilization: 70 }
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata: { name: orders, namespace: shop-prod }
spec:
  minAvailable: 1                 # node drain không bao giờ giết hết pod orders
  selector: { matchLabels: { app: orders } }
```

**Bước 4 — Các quyết định còn lại:**

- **Ingress**: chỉ `gateway` được expose (`/` → gateway). `users`/`orders` là ClusterIP nội bộ, gateway gọi qua DNS `http://users.shop-prod.svc.cluster.local`. `notifications` không có Service HTTP nào (chỉ consume queue) → không cần Service object, chỉ Deployment.
- **ConfigMap vs Secret**: config thường (log level, feature flags, URL nội bộ) vào ConfigMap; credentials (DB URL có password, API keys) vào Secret — production nên dùng External Secrets Operator/Sealed Secrets thay vì Secret thuần commit vào git (Secret chỉ base64, không phải mã hóa).
- **PDB từng service** `minAvailable: 1` (hoặc `maxUnavailable: 1` khi replica nhiều): bảo vệ khỏi *voluntary disruption* (node drain, cluster upgrade) giết đồng loạt.
- **HPA notifications không theo CPU** mà theo queue depth (xem Bài 2) — worker CPU thấp vẫn có thể tồn backlog.
- **NetworkPolicy**: default deny trong namespace, chỉ mở gateway→users/orders, orders→queue... — điểm cộng security.

**Trade-offs:**
- Đặt CPU limit cao/bỏ limit: latency ổn định, nhưng noisy neighbor có thể ăn CPU node — chấp nhận được khi requests đặt đúng (CFS share vẫn đảm bảo tối thiểu theo request).
- 1 Deployment/service đơn giản; nếu mỗi service cần nhiều "profile" (HTTP + worker trong cùng codebase) thì tách Deployment theo vai trò, cùng image khác `command`.
- minReplicas=2 mọi service tốn tiền hơn 1, nhưng 1 replica nghĩa là mỗi lần deploy/drain đều có khoảnh khắc 0 instance — không chấp nhận được cho prod.

**Follow-up interviewer hay hỏi:**
1. *"Vì sao không đặt CPU limit = request luôn cho 'an toàn'?"* — Gợi ý: CPU compressible, limit chặt gây CFS throttle → p99 tăng dù CPU node còn rảnh; kiểm chứng bằng metric `container_cpu_cfs_throttled_periods_total`.
2. *"Service-to-service gọi nhau qua gì, có cần service mesh không?"* — Gợi ý: ClusterIP + DNS là đủ cho 4 services; mesh (Istio/Linkerd) mua mTLS + retry + traffic split nhưng trả giá độ phức tạp — nói "chưa, vì..." là câu trả lời senior.
3. *"Pod Node.js nên 1 process hay cluster module để tận dụng nhiều core?"* — Gợi ý: 1 process/pod, request ~1 CPU, scale bằng replicas — đơn giản hóa metrics, OOM isolation, scheduling.

---

### Bài 2: Autoscaling cho ngày sale (traffic gấp 10 lần trong 2 giờ)

**Đề bài:** Sàn TMĐT chạy flash sale 20h ngày 11/11. Bình thường gateway nhận 2K RPS; lịch sử cho thấy 20h00-20h05 traffic vọt lên **20K RPS gần như tức thì**. Hệ thống Bài 1 hiện scale bằng HPA CPU 70%. Lần sale trước: 5 phút đầu lỗi 503 hàng loạt rồi mới hồi. Thiết kế lại autoscaling: HPA theo CPU vs custom metrics, scale trước theo lịch, cluster autoscaler, chống flapping.

**Phân tích & lời giải:**

**Bước 1 — Mổ xẻ vì sao lần trước fail.** Chuỗi delay cộng dồn của reactive autoscaling:

```
traffic tăng ──► metrics scrape (15-30s) ──► HPA sync (15s)
 ──► tạo pod mới ──► KHÔNG còn node trống!
 ──► cluster autoscaler xin node (~30s quyết định)
 ──► EC2 boot + join cluster (1-3 phút) ──► pull image ──► pod ready
                                   Tổng: 3-5 phút lỗ hổng = 5 phút 503
```

Kết luận: với **traffic dạng bậc thang biết trước**, reactive autoscaling *không bao giờ kịp* — phải kết hợp **proactive (scale trước theo lịch)** + reactive (HPA bắt phần lệch dự đoán).

**Bước 2 — Chọn metric cho HPA.**

| Metric | Ưu | Nhược | Dùng cho |
|---|---|---|---|
| CPU utilization | Có sẵn (metrics-server), không cần hạ tầng thêm | Proxy gián tiếp: Node.js có thể nghẽn event loop/downstream mà CPU thấp; ngược lại GC làm CPU spike giả | Baseline cho service CPU-bound |
| RPS per pod (custom) | Phản ánh trực tiếp tải; tính được capacity/pod từ load test | Cần Prometheus + prometheus-adapter/KEDA | gateway, API |
| Queue depth / lag (external) | Đúng bản chất worker: backlog là thứ cần dập | Cần KEDA/external metrics | notifications, consumer |

Thiết kế: gateway scale theo **RPS per pod** (load test cho biết 1 pod chịu được 700 RPS ở p99 đạt SLO → target 500 RPS/pod, chừa 30% headroom), kết hợp CPU làm metric thứ hai (HPA lấy **max** của các metrics — vế nào đòi nhiều replica hơn thì theo vế đó). `notifications` dùng KEDA theo queue depth:

```yaml
# HPA gateway: 2 metrics, lấy max
metrics:
  - type: Pods
    pods:
      metric: { name: http_requests_per_second }
      target: { type: AverageValue, averageValue: "500" }
  - type: Resource
    resource:
      name: cpu
      target: { type: Utilization, averageUtilization: 70 }
```

```yaml
# KEDA ScaledObject cho notifications
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata: { name: notifications }
spec:
  scaleTargetRef: { name: notifications }
  minReplicaCount: 2
  maxReplicaCount: 30
  triggers:
    - type: aws-sqs-queue
      metadata:
        queueURL: https://sqs...../notify-queue
        queueLength: "100"        # ~100 msg/pod là ngưỡng thêm pod
```

**Bước 3 — Scale trước theo lịch.** Cách gọn nhất: CronJob (hoặc KEDA cron trigger) nâng `minReplicas` của HPA trước giờ G, hạ sau khi sale nguội:

```yaml
# 19:30: nâng sàn — patch minReplicas thay vì replicas
# (patch replicas trực tiếp sẽ bị HPA ghi đè ngay)
kubectl patch hpa gateway -p '{"spec":{"minReplicas":25}}'
# 23:00: trả về bình thường
kubectl patch hpa gateway -p '{"spec":{"minReplicas":3}}'
```

Số 25 lấy từ đâu? 20K RPS / 500 RPS-per-pod = 40 pods cho đỉnh tuyệt đối; nâng sàn lên ~60-70% dự phóng (25) trước giờ G, để HPA reactive lo phần còn lại — cân bằng giữa chi phí và an toàn. Nếu đỉnh quá rủi ro (sale doanh thu lớn), nâng thẳng 40.

**Bước 4 — Capacity tầng node.** Pod scale trước cũng vô ích nếu không có node:
- **Overprovisioning trick**: deployment "pause pods" priorityClass thấp chiếm chỗ sẵn vài node; khi pod thật cần chỗ, pause pods bị preempt ngay lập tức (0s thay vì 2-3 phút boot node), cluster autoscaler bù node cho pause pods sau.
- Trước giờ G nâng số pause pods / hoặc nâng min của node group.
- Image nhỏ (tuần 7!) + pre-pull để pod ready nhanh trên node mới.
- Kiểm tra các trần khác: quota EC2, max ENI/IP per node, **connection pool DB** — 40 pods × pool 10 = 400 connections, RDS chịu nổi không? (đây là chỗ autoscaling app làm sập DB — cần PgBouncer/RDS Proxy).

**Bước 5 — Chống flapping.** Traffic dao động quanh ngưỡng làm HPA thêm/bớt pod liên tục → churn connection, cold cache. `behavior` của HPA v2:

```yaml
behavior:
  scaleUp:
    stabilizationWindowSeconds: 0       # lên thì lên ngay
    policies:
      - { type: Percent, value: 100, periodSeconds: 30 }  # tối đa gấp đôi mỗi 30s
  scaleDown:
    stabilizationWindowSeconds: 300     # nhìn 5 phút mới dám xuống
    policies:
      - { type: Pods, value: 2, periodSeconds: 60 }       # xuống tối đa 2 pod/phút
```

Triết lý: **scale up hung hãn, scale down rụt rè** — chi phí thừa vài pod trong vài phút rẻ hơn nhiều so với 503.

**Trade-offs:**
- Pre-scale theo lịch tốn tiền chạy thừa capacity vài giờ — nhưng so với doanh thu flash sale thì không đáng kể; cái giá thật là quy trình (ai nhớ patch lại minReplicas? → tự động hóa bằng cron, đừng làm tay).
- Custom metrics chuẩn hơn CPU nhưng thêm hạ tầng (Prometheus, adapter/KEDA) phải vận hành — với hệ nhỏ, CPU + pre-scale có khi đủ.
- Overprovisioning pause pods = trả tiền node "trống" thường trực; tinh chỉnh theo mức độ chịu rủi ro.

**Follow-up interviewer hay hỏi:**
1. *"HPA và VPA dùng chung được không?"* — Gợi ý: không nên cùng trên CPU/memory (giành nhau); pattern phổ biến: VPA recommendation-mode để *gợi ý* requests đúng, HPA lo scale ngang.
2. *"Scale pod nhanh rồi nhưng p99 vẫn xấu 1-2 phút đầu, vì sao?"* — Gợi ý: pod mới cold — JIT chưa nóng, connection pool chưa mở, cache rỗng; giải pháp: readiness chỉ ready sau warm-up, slow-start ở LB.
3. *"Nếu downstream (DB) mới là bottleneck thì autoscale app có ích gì?"* — Gợi ý: không — còn làm tệ hơn (thêm connections). Phải xác định bottleneck bằng load test trước; bảo vệ DB bằng pool ceiling, queue, backpressure.

---

### Bài 3: Zero-downtime deploy + rollback strategy

**Đề bài:** Service `orders` (Bài 1) deploy 5-10 lần/ngày, SLO 99.9%. Lần trước deploy bản lỗi: 100% traffic ăn bug trong 15 phút trước khi rollback thủ công. Thiết kế: rolling update đúng cách (maxSurge/maxUnavailable, readiness), canary (2 Deployments + ingress weight hoặc Argo Rollouts), và **tiêu chí auto-rollback định lượng**.

**Phân tích & lời giải:**

**Bước 1 — Nền móng: rolling update không rớt request.** Zero-downtime có 2 nửa: *pod mới chỉ nhận traffic khi sẵn sàng* và *pod cũ chỉ chết sau khi hết traffic*.

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 25%          # cho phép tạo thêm 25% pod mới trước khi giết cũ
    maxUnavailable: 0      # KHÔNG BAO GIỜ giảm capacity dưới mức hiện tại
```

`maxUnavailable: 0` là chốt quan trọng: deploy lúc cao điểm mà cho phép giảm 25% capacity là tự gây sự cố. Trả giá: cần room trên cluster cho pod surge.

Nửa "vào": readiness probe phải **thật** — chỉ ready khi app đã listen + pool đã mở + warm-up xong (không phải trả 200 từ dòng đầu tiên của `main()`). Nửa "ra": chuỗi SIGTERM như tuần 7 + `preStop sleep 5` — vì K8s rút endpoint khỏi Service **song song** với việc gửi SIGTERM, không tuần tự; sleep cho kube-proxy/ingress kịp cập nhật trước khi app đóng listener.

**Bước 2 — Vì sao rolling update chưa đủ.** Rolling chỉ chống lỗi "pod không lên nổi" (crash, fail readiness). Bug logic — order tính sai giá nhưng trả 200 — sẽ lên 100% traffic êm ái. Cần **canary: đưa bản mới cho một phần nhỏ traffic, đo, rồi mới mở rộng**.

**Phương án A — thủ công bằng 2 Deployments + ingress weight (hiểu bản chất):**

```
                 ┌────────────────────────┐
 traffic ───────►│ ingress-nginx          │
                 │ canary-weight: 5%      │
                 └────┬──────────────┬────┘
                  95% │              │ 5%
            ┌─────────▼───┐   ┌──────▼────────┐
            │ orders      │   │ orders-canary │
            │ (stable) x6 │   │ x1, image mới │
            └─────────────┘   └───────────────┘
```

```yaml
# Ingress thứ hai, trỏ service canary
metadata:
  annotations:
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "5"
```

Quy trình: deploy canary 1 pod → 5% traffic → quan sát 10-15 phút → tăng 25% → 50% → cập nhật image lên Deployment stable, weight về 0, xóa canary. Hoạt động nhưng **nhiều bước tay → con người chính là điểm hỏng** (case "15 phút mới rollback" sinh ra từ đây).

**Phương án B — Argo Rollouts (tự động hóa toàn bộ vòng lặp):** thay `Deployment` bằng CRD `Rollout`, controller tự quản 2 ReplicaSets + traffic shifting + **analysis**:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
spec:
  strategy:
    canary:
      steps:
        - setWeight: 5
        - pause: { duration: 10m }
        - analysis: { templates: [{ templateName: success-rate }] }
        - setWeight: 25
        - pause: { duration: 10m }
        - setWeight: 50
        - pause: { duration: 5m }
      trafficRouting:
        nginx: { stableIngress: orders }
---
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata: { name: success-rate }
spec:
  metrics:
    - name: error-rate
      interval: 1m
      failureLimit: 2
      provider:
        prometheus:
          address: http://prometheus:9090
          query: |
            sum(rate(http_requests_total{app="orders",canary="true",status=~"5.."}[2m]))
            / sum(rate(http_requests_total{app="orders",canary="true"}[2m]))
      successCondition: result[0] < 0.01
```

**Bước 3 — Tiêu chí auto-rollback (phải định lượng, đừng nói "thấy lỗi thì rollback"):**
- Error rate (5xx) của canary > 1% trong 2 datapoint liên tiếp → abort.
- p99 latency canary > 1.5× stable cùng thời điểm (so sánh tương đối, tránh nhiễu giờ cao điểm).
- Business metric khi có (order success rate giảm > X%).
- Abort = weight về 0 ngay lập tức, ReplicaSet stable còn nguyên → "rollback" chỉ là chuyển traffic, **mất vài giây** thay vì 15 phút re-deploy.

**Bước 4 — Điều kiện tiên quyết bị bỏ quên:** canary nghĩa là **2 phiên bản code chạy đồng thời** → schema DB và API contract phải backward-compatible giữa N và N-1 (liên quan trực tiếp Bài 4). Nếu bản mới đổi schema kiểu phá vỡ, canary vô nghĩa — stable sẽ lỗi.

**Trade-offs:**
- Rolling mặc định: zero hạ tầng thêm, nhưng bug logic lên 100%. Canary tay: kiểm soát nhưng phụ thuộc kỷ luật người. Argo Rollouts: tự động + auto-rollback, trả giá thêm CRD/controller phải vận hành và metric phải sạch (label canary phân biệt được).
- Blue-green (đổi 100% một nhát, giữ bản cũ standby): rollback nhanh nhất, test được bản mới trước khi nhận traffic, nhưng tốn 2× capacity và không có giai đoạn "5% chịu trận".
- Canary theo % traffic là ngẫu nhiên theo request — session của 1 user có thể nhảy qua lại 2 version; nếu cần sticky thì dùng header/cookie-based routing.

**Follow-up interviewer hay hỏi:**
1. *"`kubectl rollout undo` có phải là chiến lược rollback đủ tốt?"* — Gợi ý: nó re-deploy ReplicaSet cũ (mất thời gian roll lại) và là hành động tay; với canary/blue-green, rollback = chuyển traffic, nhanh hơn nhiều bậc. Undo cũng không hoàn tác DB migration.
2. *"Feature flags thay được canary không?"* — Gợi ý: bổ trợ nhau — flags kiểm soát *tính năng* theo user segment ở runtime; canary kiểm soát *binary/hạ tầng* (memory leak, dependency mới). Bug ở tầng runtime thì flags không cứu.
3. *"Canary 5% mà RPS thấp thì bao lâu mới đủ tự tin về error rate?"* — Gợi ý: cần đủ sample size — 5% của 10 RPS là ~30 request/phút, không đủ thống kê → tăng thời gian quan sát, hoặc dùng mirror/shadow traffic.

---

### Bài 4: Database migration an toàn trong K8s

**Đề bài:** Service `orders` dùng Postgres + Prisma/Knex migrations. Hiện migration chạy trong lệnh start app (`npx prisma migrate deploy && node dist/server.js`). Đã xảy ra: deploy 6 replica, nhiều pod cùng chạy migration → lock contention, 1 pod treo quá grace period bị giết giữa chừng migration. Thiết kế lại: chạy migration ở đâu (Job vs initContainer — phân tích trade-off), làm sao backward-compatible với rolling/canary, và chống chạy đôi.

**Phân tích & lời giải:**

**Bước 1 — Tại sao migration-on-start là bom hẹn giờ:** (1) N replica = N lần thử chạy migration đồng thời; (2) migration dài hơn `initialDelaySeconds`/grace period → pod bị giết giữa chừng, để lại schema lửng lơ; (3) không có điểm dừng để quyết định "migration fail thì đừng deploy code mới"; (4) quyền DDL gắn vào credentials của app runtime (vi phạm least privilege).

**Bước 2 — So sánh 2 phương án đặt migration:**

| Tiêu chí | initContainer (trong pod app) | Job riêng (chạy trước khi rollout) |
|---|---|---|
| Số lần chạy | Mỗi pod chạy lại (6 replica = 6 lần thử) → bắt buộc dựa vào lock | 1 lần duy nhất, có `backoffLimit` |
| Thứ tự với deploy | Tự nhiên gắn vào rollout, không cần orchestration ngoài | Cần pipeline điều phối: Job xong → mới apply Deployment |
| Fail handling | Pod kẹt `Init:Error`, rollout treo — cũng là một dạng "an toàn" nhưng khó quan sát | Job fail → pipeline dừng, code mới chưa hề ra — sạch sẽ |
| Quyền DB | Pod app phải mang credentials có quyền DDL | Job dùng secret riêng quyền DDL, app chỉ DML |
| Scale-up giữa chừng | Pod mới do HPA tạo cũng chạy init lại (vô ích, thêm rủi ro) | Không ảnh hưởng |
| Độ phức tạp | Thấp (chỉ sửa manifest) | Cần bước pipeline / ArgoCD PreSync hook |

**Chọn Job** cho production nghiêm túc. initContainer chấp nhận được cho hệ nhỏ ít replica, **với điều kiện migration tool có lock**.

**Bước 3 — Thiết kế Job + pipeline:**

```
CI/CD pipeline:
  build image ──► kubectl apply job (migrate, image MỚI)
              ──► kubectl wait --for=condition=complete --timeout=300s
              ──► nếu OK: kubectl apply deployment (image mới)
              ──► nếu FAIL: dừng, alert, code cũ vẫn chạy nguyên vẹn
```

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: orders-migrate-3f2a91c     # tên theo sha → mỗi version 1 Job, audit được
spec:
  backoffLimit: 2
  activeDeadlineSeconds: 300
  ttlSecondsAfterFinished: 86400
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: migrate
          image: ghcr.io/myorg/orders:sha-3f2a91c   # cùng image với app
          command: ["npx", "prisma", "migrate", "deploy"]
          envFrom:
            - secretRef: { name: orders-db-ddl }     # secret riêng, quyền DDL
```

(Nếu dùng ArgoCD: annotation `argocd.argoproj.io/hook: PreSync` cho Job — Argo tự chạy Job trước khi sync Deployment.)

**Bước 4 — Chống chạy đôi (defense in depth):** kể cả khi pipeline đảm bảo 1 Job, vẫn nên có lock tầng DB vì có thể 2 pipeline chạy song song / ai đó chạy tay:
- Prisma/Flyway/Liquibase có cơ chế riêng (bảng `_prisma_migrations`, Flyway dùng lock).
- Với Knex/node-pg-migrate hoặc script tự viết: **Postgres advisory lock**:

```sql
SELECT pg_advisory_lock(727274);   -- block đến khi giành được lock
-- chạy migrations...
SELECT pg_advisory_unlock(727274);
```

Process thứ hai sẽ chờ (hoặc dùng `pg_try_advisory_lock` để fail-fast). Lock tự nhả khi session chết — không bị kẹt lock như lock bằng row.

**Bước 5 — Backward-compatible migration (expand–contract), phần quan trọng nhất:** trong rolling/canary, **code cũ và schema mới chung sống** một khoảng thời gian → mọi migration đi kèm 1 deploy phải an toàn cho cả version N-1.

Ví dụ đổi tên cột `address` → `shipping_address` KHÔNG được làm bằng 1 lệnh `RENAME`. Làm theo expand–contract qua nhiều release:

```
Release 1 (expand):  ADD COLUMN shipping_address; code ghi CẢ HAI cột, đọc cột mới ưu tiên
Release 2 (migrate): backfill dữ liệu cũ (batch nhỏ, ngoài giờ cao điểm)
Release 3 (contract): code chỉ dùng cột mới; xác nhận không còn truy cập cột cũ
Release 4:           DROP COLUMN address
```

Danh sách thao tác nguy hiểm cần quy trình riêng: `DROP/RENAME COLUMN|TABLE`, `ALTER TYPE`, thêm cột `NOT NULL` không default (Postgres cũ rewrite bảng), tạo index không `CONCURRENTLY` (lock ghi cả bảng lớn).

**Trade-offs:**
- Job + pipeline thêm bước điều phối ngoài K8s, nhưng đổi lại có "cổng" rõ ràng: schema fail thì code không ra.
- Expand–contract kéo 1 thay đổi thành 3-4 release, chậm và đòi kỷ luật — nhưng là cách duy nhất để migration không phá zero-downtime; với bảng nhỏ + downtime window chấp nhận được, có thể đi đường tắt *có chủ đích*.
- Rollback code dễ, rollback schema khó — nguyên tắc thực tế: **migration chỉ tiến (roll-forward)**, thiết kế sao cho code cũ vẫn chạy được trên schema mới thay vì viết down-migration ảo tưởng.

**Follow-up interviewer hay hỏi:**
1. *"Migration chạy 30 phút (backfill bảng 100M rows) thì để trong Job deploy được không?"* — Gợi ý: tách schema migration (nhanh, trong pipeline) khỏi data backfill (chậm, chạy nền batch có checkpoint/resume, throttle để không đè production).
2. *"Rollback app về version cũ thì có chạy down-migration không?"* — Gợi ý: không — vì expand–contract đảm bảo schema mới tương thích code cũ; down-migration trên production có data mới thường phá hủy nhiều hơn cứu.
3. *"Job dùng cùng image với app hay image riêng cho migration?"* — Gợi ý: cùng image (đảm bảo migration files khớp đúng version code, ít artifact hơn), khác `command` và khác secret/quyền DB.

---

## 🌍 Case thực tế

### Case 1: Pod bị OOMKilled chỉ lúc traffic cao

**Bối cảnh:** Service `orders` chạy ổn nhiều tuần, nhưng cứ giờ cao điểm (trưa, tối) lại có vài pod restart. `kubectl describe pod` cho thấy `Last State: Terminated, Reason: OOMKilled, Exit Code: 137`. Vì pod restart nhanh và HPA bù pod, không ai để ý cho đến khi một đợt cao điểm lớn làm restart dây chuyền: pod chết → pod còn lại gánh nhiều hơn → memory càng cao → chết tiếp.

**Vấn đề gặp phải:** Mổ xẻ ra 3 lớp lỗi chồng nhau:
1. Manifest đặt `requests.memory: 256Mi`, `limits.memory: 512Mi` — copy từ template service khác, chưa bao giờ đo lại. Thực tế memory ổn định đã ~300MB, cao điểm ~600MB.
2. Node process **không có `--max-old-space-size`** — V8 nhìn RAM node host (32GB) nên thoải mái nở heap vượt 512Mi limit của cgroup → kernel OOM kill thẳng, không một dòng log.
3. Requests < limits (Burstable) với khoảng cách lớn: scheduler xếp pod theo 256Mi nên nhồi nhiều pod/node; cao điểm tất cả cùng burst → node memory pressure, thêm cả eviction.

**Giải pháp & tại sao:**
1. **Đo trước khi đặt số**: dashboard `container_memory_working_set_bytes` (đây là metric OOM killer nhìn, không phải RSS thuần) theo percentile trong 2 tuần → peak thực ~620MB.
2. Đặt lại `requests = limits = 896Mi` (peak × ~1.4) → memory thuộc nhóm không-overcommit, loại trừ nhồi nhét node.
3. `NODE_OPTIONS=--max-old-space-size=672` (~75% limit) — V8 GC chủ động trước khi chạm trần cgroup; nếu thật sự leak thì chết bằng heap OOM **có stack trace** thay vì SIGKILL câm.
4. Truy gốc memory cao điểm: endpoint export đơn hàng load cả result set — chuyển sang cursor + stream → peak giảm hẳn.
5. Alert: `OOMKilled` count > 0 và working set > 85% limit — biến lỗi câm thành tín hiệu sớm.

**Bài học rút ra:**
- Requests/limits copy từ template mà không đo là norm đáng sợ ở nhiều team — con số phải đến từ metric của chính workload.
- "Chạy ổn lúc thường, chết lúc cao điểm" + exit 137 + không log ⇒ nghĩ OOM trước tiên; và OOMKill có thể gây **cascade** (pod chết dồn tải cho pod sống).
- Bộ ba phải khớp nhau: cgroup limit ↔ `--max-old-space-size` ↔ behavior thực của app.

**💬 Cách dùng case này khi phỏng vấn:** Khi hỏi về resource management trên K8s, kể chuỗi chẩn đoán: describe pod thấy 137/OOMKilled → soi working_set metric → phát hiện limit đặt theo template + Node không biết cgroup → fix cả ba tầng (limit theo số đo, max-old-space-size, sửa code stream). Thể hiện tư duy nhiều lớp thay vì một câu "tăng limit là xong".

---

### Case 2: Readiness probe gọi DB làm cascade failure khi DB chậm

**Bối cảnh:** Hệ thống microservices, team quy ước endpoint `/healthz` "kiểm tra sâu": ping Postgres, Redis và một downstream service, có vấn đề gì trả 503. Cả readiness lẫn liveness probe đều trỏ vào endpoint này — nghe có vẻ "kỹ càng".

**Vấn đề gặp phải:** Một đêm Postgres bị chậm 30 giây (vacuum + lock từ một migration tay). Chuỗi domino:
1. `/healthz` của **tất cả** pod orders timeout vì query ping treo → readiness fail → K8s rút **toàn bộ** pod khỏi Service endpoints → orders mất sạch khả năng phục vụ, kể cả những endpoint **không đụng DB** (health của gateway gọi sang, API đọc cache).
2. Tệ hơn: **liveness** cũng fail 3 lần liên tiếp → K8s **restart hàng loạt pod** — restart không sửa được DB chậm, nhưng xóa sạch connection pool, in-flight work, và tạo thundering herd reconnect khi DB hồi.
3. Gateway thấy orders unhealthy → trả lỗi → probe của vài service khác cũng check chuỗi dependency → lan rộng. Sự cố DB chậm 30 giây thành outage 20 phút toàn hệ thống.

**Giải pháp & tại sao:**
1. **Tách 3 loại health với mục đích khác nhau:**
   - `livenessProbe` → `/healthz/live`: CHỈ trả lời "process này còn sống và event loop còn quay không" — không đụng bất kỳ dependency nào. Restart chỉ chữa được bệnh *nội tại* (deadlock, event loop treo); restart không chữa được DB hỏng.
   - `readinessProbe` → `/healthz/ready`: trạng thái *của chính service* (đã boot xong, đang shutdown thì 503). Về dependency: cực kỳ hạn chế — chỉ những dependency *thiếu nó thì 100% request fail*, và phải dùng **trạng thái cached của connection pool/circuit breaker** (không query trực tiếp mỗi lần probe).
   - Deep check (ping mọi dependency) → `/healthz/deep`: cho monitoring/dashboard con người xem, **không bao giờ** gắn vào probe.
2. Lý do nguyên tắc "probe chỉ check bản thân": khi dependency chung hỏng, *mọi* replica fail cùng lúc → rút hết endpoint = biến degraded (một phần lỗi) thành blackout (100% lỗi). Để request fail tại handler còn cho phép phục vụ phần không phụ thuộc DB, trả error có ngữ nghĩa, và circuit breaker hoạt động đúng tầng.
3. Cấu hình lại: liveness `failureThreshold` cao + `timeoutSeconds` thoáng (restart là hành động bạo lực, phải chắc chắn); thêm timeout cho chính handler health (probe timeout 1s mà handler treo vô hạn là tự bắn chân).

**Bài học rút ra:**
- Health check "càng kỹ càng tốt" là trực giác sai: **probe quyết định hành động của K8s** (rút traffic / restart), nên câu hỏi đúng là "hành động đó có chữa được lỗi này không?".
- Liveness fail → restart: chỉ hợp lệ cho lỗi nội tại process. Readiness fail → rút traffic: chỉ hợp lệ khi instance *này* tệ hơn các instance khác.
- Mọi sự cố dependency chậm sẽ "chiếu" qua health check sai thiết kế thành sự cố toàn hệ thống.

**💬 Cách dùng case này khi phỏng vấn:** Câu hỏi liveness vs readiness rất hay gặp — thay vì trả lời định nghĩa, kể case này: "probe check DB nghe có vẻ kỹ, nhưng DB chậm 30s đã rút hết endpoints + restart cả fleet, degraded thành blackout" — và chốt nguyên tắc: probe trả lời về *bản thân instance*, deep check để cho người xem.

---

### Case 3: HPA không scale — "có HPA rồi mà vẫn sập"

**Bối cảnh:** Team mới migrate sang K8s (cluster tự dựng bằng kubeadm), tự tin vì "đã cấu hình HPA cho mọi service". Đợt traffic tăng do chiến dịch marketing: latency tăng dần rồi 503, trong khi `kubectl get hpa` cho thấy replicas đứng yên ở mức min.

**Vấn đề gặp phải:** `kubectl describe hpa orders` lộ ra mọi thứ:

```
Metrics: <unknown> / 70%
Conditions:
  AbleToScale     True
  ScalingActive   False  FailedGetResourceMetric: unable to get metrics
                         for resource cpu: ... metrics-server not found
Events: FailedGetResourceMetric (x∞)
```

Hai lỗi độc lập cùng tồn tại:
1. **Cluster không cài metrics-server.** HPA theo CPU/memory lấy số liệu từ Metrics API do metrics-server cung cấp — managed K8s (GKE/EKS addon) thường có sẵn nên team tưởng là "của chùa", cluster kubeadm thì không. Không metrics → HPA mù → target hiển thị `<unknown>`.
2. Sau khi cài metrics-server, một nửa số service **vẫn** không scale: deployment của chúng **không khai báo `resources.requests.cpu`**. HPA tính utilization = usage / **requests** — không có mẫu số thì không có phép chia. (Pod không requests cũng rơi vào QoS BestEffort — nạn nhân đầu tiên khi node bị eviction, họa kép.)

**Giải pháp & tại sao:**
1. Cài metrics-server; xác minh bằng `kubectl top pods` chạy được (đây là smoke test nhanh nhất cho Metrics API).
2. Khai báo `requests` cho mọi container — đưa vào **policy tự động**: CI lint manifest (datree/kube-score/OPA Gatekeeper) chặn Deployment thiếu requests, thay vì dựa vào trí nhớ con người.
3. Đưa vào runbook khoản "kiểm tra HPA sống thật": `kubectl describe hpa` phải thấy current metric là con số, không phải `<unknown>`; thêm alert trên condition `ScalingActive=False`.
4. Game-day: load test bắn vào staging để **chứng kiến** HPA scale từ 2→8 trước khi tin nó — "đã cấu hình" khác "đã hoạt động".

**Bài học rút ra:**
- HPA là một chuỗi phụ thuộc: app expose metric → metrics-server/adapter thu → HPA đọc → có requests để tính % → mới ra quyết định. Đứt bất kỳ mắt xích nào là HPA thành vật trang trí, và nó **fail im lặng**.
- `kubectl describe hpa` + `kubectl top` là 2 lệnh chẩn đoán đầu tiên; `<unknown>` trong cột target là cờ đỏ phải có alert.
- Cơ chế an toàn chưa được diễn tập = chưa tồn tại.

**💬 Cách dùng case này khi phỏng vấn:** Khi hỏi "HPA hoạt động thế nào", trả lời cơ chế xong hãy thêm: "và 2 lý do phổ biến nhất khiến nó *không* hoạt động là thiếu metrics-server và thiếu resources.requests — tôi từng gặp cả hai trong một sự cố, giờ tôi luôn verify bằng describe hpa và load test trước khi tin autoscaling." Cho thấy bạn vận hành thật chứ không học vẹt.

---

## ✅ Checklist tự kiểm tra

1. Tôi có giải thích được cách suy ra `requests`/`limits` từ số liệu đo thực tế, vì sao memory nên `request = limit` còn CPU limit nên rộng tay (CFS throttling), và vì sao pod Node.js không cần request > 1 core?
2. Tôi có phân biệt rạch ròi liveness vs readiness — mỗi loại fail thì K8s làm gì, và vì sao probe không nên check dependency chung như DB?
3. Tôi có trình bày được vì sao reactive HPA không kịp cho traffic bậc thang, và tổ hợp giải pháp: pre-scale minReplicas theo lịch + custom metric (RPS/queue depth) + overprovisioning node + scale-down rụt rè?
4. Tôi có viết được cấu hình rolling update zero-downtime hoàn chỉnh (maxSurge/maxUnavailable: 0, readiness thật, preStop sleep, grace period) và giải thích vì sao cần preStop khi K8s rút endpoint song song với SIGTERM?
5. Tôi có so sánh được canary bằng 2 Deployments + ingress weight vs Argo Rollouts, và nêu được tiêu chí auto-rollback định lượng (error rate, p99 so với stable)?
6. Tôi có biện luận được Job vs initContainer cho DB migration, mô tả expand–contract cho thay đổi schema phá vỡ, và cơ chế advisory lock chống chạy đôi?
7. Nếu pod restart liên tục với exit code 137 chỉ lúc cao điểm, tôi có nêu được đầy đủ chuỗi chẩn đoán và 3 tầng fix (limit theo số đo, --max-old-space-size, sửa code)?
