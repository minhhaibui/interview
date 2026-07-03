# Tuần 8: Kubernetes

> 🌱 **Mới với chủ đề này?** Đọc [`CO-BAN.md`](CO-BAN.md) TRƯỚC — bài nhập môn cực dễ, giải thích bằng ví dụ đời thường, không thuật ngữ khó. Xong rồi quay lại đọc bài đầy đủ bên dưới.

> 🔬 **Có bản đào sâu!** Xem [`DEEP-DIVE.md`](DEEP-DIVE.md) — cơ chế bên trong, ví dụ nâng cao, bẫy production & câu hỏi phỏng vấn KHÓ hơn cho tuần này.

> 🧪 **Có lab tận tay!** Xem [`lab/LAB.md`](lab/LAB.md) — tạo cluster thật bằng `kind` (3 node) rồi `kubectl apply` Deployment + Service NodePort + ConfigMap để TẬN TAY thử self-heal, scaling, rolling update + rollback, probes.

## 🎯 Mục tiêu tuần này

- Hiểu rõ K8s architecture: control plane (api-server, etcd, scheduler, controller-manager) và worker node (kubelet, kube-proxy).
- Viết được manifest hoàn chỉnh cho Node.js app: Deployment, Service, Ingress, ConfigMap, Secret, probes, resources, HPA.
- Phân biệt và chọn đúng workload: Deployment vs StatefulSet vs DaemonSet vs Job/CronJob; Service types và khi nào dùng gì.
- Thành thạo kubectl debug: describe, logs, exec, port-forward, events — chẩn đoán được CrashLoopBackOff, ImagePullBackOff, OOMKilled, Pending.
- Deploy được Node.js app hoàn chỉnh lên minikube/kind với rolling update + rollback, và đóng gói bằng Helm chart cơ bản.

## 📚 Lý thuyết

### Ngày 1-2: Architecture, Pod, ReplicaSet & Deployment

#### Kiến trúc Kubernetes

```
┌────────────────────── Control Plane ──────────────────────┐
│  kube-apiserver ◄──── điểm vào duy nhất (REST, authn/z)   │
│      │                                                     │
│  etcd ◄──── key-value store, nguồn chân lý duy nhất        │
│  kube-scheduler ◄──── chọn node cho Pod mới                │
│  kube-controller-manager ◄──── các control loops           │
└────────────────────────────────────────────────────────────┘
        │ (kubelet watch API server)
┌────── Worker Node 1 ──────┐  ┌────── Worker Node 2 ──────┐
│ kubelet  kube-proxy        │  │ kubelet  kube-proxy        │
│ container runtime          │  │ container runtime          │
│ [Pod] [Pod] [Pod]          │  │ [Pod] [Pod]                │
└────────────────────────────┘  └────────────────────────────┘
```

**Control plane:**
- **kube-apiserver**: cổng giao tiếp duy nhất với cluster. Mọi thành phần (kubectl, kubelet, controllers) đều nói chuyện qua API server. Xử lý authentication, authorization (RBAC), admission control, validation.
- **etcd**: distributed key-value store (Raft consensus) lưu **toàn bộ** trạng thái cluster. Mất etcd = mất cluster. Chỉ API server được nói chuyện trực tiếp với etcd.
- **kube-scheduler**: watch Pods chưa có node, chọn node phù hợp dựa trên: resource requests, nodeSelector/affinity, taints/tolerations, topology spread. Scheduler chỉ **quyết định**, kubelet mới thực sự chạy Pod.
- **kube-controller-manager**: chạy các control loops (Deployment controller, ReplicaSet controller, Node controller, Job controller...). Mỗi controller liên tục so sánh **desired state** (trong etcd) với **actual state** và điều chỉnh — đây là **reconciliation loop**, triết lý cốt lõi của K8s (declarative, không imperative).

**Worker node:**
- **kubelet**: agent trên mỗi node, nhận PodSpec từ API server, chỉ đạo container runtime (containerd) chạy containers, chạy probes, báo cáo trạng thái.
- **kube-proxy**: hiện thực Service networking — lập trình iptables/IPVS rules để traffic tới ClusterIP được load-balance về các Pod backends.
- **Container runtime**: containerd/CRI-O (Docker shim đã bị bỏ từ 1.24, nhưng image Docker build vẫn chạy bình thường vì cùng chuẩn OCI).

#### Pod

Pod = đơn vị deploy nhỏ nhất, gồm **1+ containers** chia sẻ network namespace (cùng IP, gọi nhau qua localhost) và volumes. Thường 1 container/Pod; nhiều container khi cần sidecar.

**Pod lifecycle (phases):** `Pending` (chưa schedule hoặc đang pull image) → `Running` → `Succeeded`/`Failed`; `Unknown` khi mất liên lạc node. Bên trong còn container states: Waiting / Running / Terminated, và các điều kiện như `CrashLoopBackOff` (container crash liên tục, kubelet restart với exponential backoff).

**Init containers**: chạy **tuần tự, xong hết** mới đến app containers. Dùng để: chờ DB sẵn sàng, chạy migration, tải config.

```yaml
spec:
  initContainers:
    - name: wait-for-db
      image: busybox:1.36
      command: ['sh', '-c', 'until nc -z postgres 5432; do echo waiting; sleep 2; done']
    - name: migrate
      image: myapp:1.0
      command: ['node', 'dist/migrate.js']
```

**Sidecar**: container phụ chạy song song với app container — log shipper (fluent-bit), proxy (Envoy/Istio), metrics agent. Từ K8s 1.28+ có **native sidecar** (initContainer với `restartPolicy: Always`) đảm bảo sidecar start trước và stop sau app container.

#### ReplicaSet & Deployment

- **ReplicaSet**: đảm bảo đúng N replicas của Pod (theo label selector) đang chạy. Hiếm khi tạo trực tiếp.
- **Deployment**: quản lý ReplicaSets, cung cấp **rolling update** và **rollback**. Khi update image, Deployment tạo ReplicaSet mới, scale dần lên đồng thời scale ReplicaSet cũ xuống.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 3
  revisionHistoryLimit: 5
  selector:
    matchLabels: { app: api }
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1          # được tạo thêm tối đa 1 pod vượt replicas
      maxUnavailable: 0    # không pod nào down trong lúc update → zero-downtime
  template:
    metadata:
      labels: { app: api }
    spec:
      containers:
        - name: api
          image: registry.example.com/api:1.4.2
          ports: [{ containerPort: 3000 }]
```

**Strategies:**
- `RollingUpdate` (mặc định): thay dần pod, zero-downtime nếu probes + graceful shutdown đúng.
- `Recreate`: kill hết pod cũ rồi mới tạo mới — có downtime, dùng khi app không chạy được 2 version song song (vd: migration không backward-compatible, lock file).
- Blue/Green, Canary: không có sẵn trong Deployment, làm qua 2 Deployments + Service selector, hoặc Argo Rollouts/Flagger.

```bash
kubectl set image deployment/api api=registry.example.com/api:1.4.3
kubectl rollout status deployment/api
kubectl rollout history deployment/api
kubectl rollout undo deployment/api                 # rollback về revision trước
kubectl rollout undo deployment/api --to-revision=2
```

### Ngày 3-4: Service, Ingress, ConfigMap/Secret, Probes, Resources, HPA

#### Service

Pod IP là ephemeral (pod chết → IP đổi). Service cung cấp **virtual IP ổn định + DNS name + load balancing** trước một nhóm Pods (chọn theo label selector).

- **ClusterIP** (mặc định): IP nội bộ cluster. Dùng cho giao tiếp service-to-service. DNS: `api.default.svc.cluster.local`.
- **NodePort**: mở 1 port (30000-32767) trên **mọi node**. Truy cập `nodeIP:nodePort`. Ít dùng production trực tiếp.
- **LoadBalancer**: cấp cloud load balancer (AWS NLB/ELB...) trỏ vào NodePort. Mỗi service 1 LB → tốn tiền nếu nhiều services → dùng Ingress.
- **Headless** (`clusterIP: None`): không có virtual IP; DNS trả về **danh sách IP của từng Pod**. Dùng với StatefulSet (kết nối đúng pod cụ thể: `pg-0.pg.default.svc.cluster.local`) hoặc client-side load balancing (gRPC).

```yaml
apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  type: ClusterIP
  selector: { app: api }
  ports:
    - port: 80          # port của Service
      targetPort: 3000  # port của container
```

#### Ingress & Ingress Controller

**Ingress** = tập rules L7 (HTTP routing theo host/path, TLS termination). Ingress resource **chỉ là config** — phải cài **Ingress Controller** (nginx-ingress, Traefik, AWS ALB Controller) để thực thi. Một LB duy nhất route cho nhiều services.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-ingress
  annotations:
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
spec:
  ingressClassName: nginx
  tls:
    - hosts: [api.example.com]
      secretName: api-tls
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service: { name: api, port: { number: 80 } }
```

#### ConfigMap & Secret

- **ConfigMap**: config không nhạy cảm (key-value hoặc file). Inject qua env hoặc mount thành file.
- **Secret**: data nhạy cảm, **chỉ base64-encode, KHÔNG mã hóa mặc định** — phải bật encryption at rest cho etcd + RBAC chặt; production thường dùng External Secrets Operator/Sealed Secrets + AWS Secrets Manager/Vault.

```yaml
apiVersion: v1
kind: ConfigMap
metadata: { name: api-config }
data:
  LOG_LEVEL: "info"
  REDIS_URL: "redis://redis:6379"
---
apiVersion: v1
kind: Secret
metadata: { name: api-secret }
type: Opaque
stringData:                      # stringData: viết plaintext, K8s tự encode
  DATABASE_URL: "postgres://app:s3cret@postgres:5432/appdb"
```

```yaml
# trong container spec:
envFrom:
  - configMapRef: { name: api-config }
  - secretRef: { name: api-secret }
```

Lưu ý: env từ ConfigMap **không tự reload** khi ConfigMap đổi — phải restart pod (`kubectl rollout restart`). Mount file thì được cập nhật (sau vài chục giây) nhưng app phải tự watch file.

#### Probes cho Node.js app

- **livenessProbe**: "app còn sống không?" — fail → kubelet **restart container**. Chỉ nên check trạng thái nội tại (event loop hoạt động), KHÔNG check dependencies (DB down mà liveness fail → restart vô ích hàng loạt).
- **readinessProbe**: "app sẵn sàng nhận traffic chưa?" — fail → pod bị **gỡ khỏi Service endpoints** (không bị restart). NÊN check dependencies tại đây.
- **startupProbe**: dành cho app khởi động chậm — chặn liveness/readiness cho tới khi pass, tránh bị restart oan trong lúc boot.

```yaml
containers:
  - name: api
    image: api:1.4.2
    startupProbe:
      httpGet: { path: /health/live, port: 3000 }
      failureThreshold: 30        # 30 * 2s = tối đa 60s để khởi động
      periodSeconds: 2
    livenessProbe:
      httpGet: { path: /health/live, port: 3000 }
      periodSeconds: 10
      timeoutSeconds: 2
      failureThreshold: 3
    readinessProbe:
      httpGet: { path: /health/ready, port: 3000 }
      periodSeconds: 5
      failureThreshold: 2
```

```js
// Node.js: tách 2 endpoints
app.get('/health/live', (req, res) => res.status(200).json({ status: 'ok' }));

app.get('/health/ready', async (req, res) => {
  try {
    await db.query('SELECT 1');
    await redis.ping();
    res.status(200).json({ status: 'ready' });
  } catch (e) {
    res.status(503).json({ status: 'not ready', error: e.message });
  }
});
```

#### Resource requests & limits, QoS classes

- **requests**: lượng tài nguyên **đảm bảo**, scheduler dùng để chọn node. Pod Pending nếu không node nào đủ requests.
- **limits**: trần. Vượt CPU limit → bị **throttle** (chậm đi, không chết). Vượt memory limit → **OOMKilled**.

```yaml
resources:
  requests: { cpu: 250m, memory: 256Mi }
  limits:   { cpu: 500m, memory: 512Mi }
```

**QoS classes** (quyết định thứ tự bị evict khi node thiếu memory):
- **Guaranteed**: requests = limits cho mọi container → bị evict cuối cùng.
- **Burstable**: có requests < limits → evict giữa.
- **BestEffort**: không set gì → bị evict đầu tiên.

Với Node.js: app single-thread, > 1 CPU không tận dụng được trong 1 process → thường request 250m-500m, scale ngang bằng nhiều replicas thay vì tăng CPU. Đặt `--max-old-space-size` ≈ 75-80% memory limit.

#### HPA (Horizontal Pod Autoscaler)

HPA tự scale replicas dựa trên metrics (cần **metrics-server** cài sẵn). CPU utilization tính theo **% của requests** (không phải limits).

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: { name: api-hpa }
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target: { type: Utilization, averageUtilization: 70 }
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300   # tránh flapping
```

Custom metrics (requests/giây, queue lag) qua Prometheus Adapter hoặc **KEDA** (scale theo Kafka lag, SQS depth — kể cả scale về 0).

### Ngày 5-6: StatefulSet, DaemonSet, Job, RBAC, Storage, kubectl debug, deploy hoàn chỉnh, Helm

#### StatefulSet vs Deployment

| | Deployment | StatefulSet |
|---|---|---|
| Pod name | random hash (api-7d9f-x2k1) | ổn định, có thứ tự (pg-0, pg-1) |
| Storage | chia sẻ hoặc không có | mỗi pod 1 PVC riêng (volumeClaimTemplates) |
| Khởi động/xóa | song song | tuần tự (0→1→2, xóa ngược lại) |
| Network identity | qua Service chung | DNS riêng từng pod (cần headless Service) |
| Dùng cho | stateless app (API, worker) | DB, Kafka, Redis cluster, ES |

Node.js API là stateless → **luôn dùng Deployment**. Session/state đẩy ra Redis/DB.

#### DaemonSet, Job, CronJob

- **DaemonSet**: 1 pod trên **mỗi node** (hoặc node match selector). Dùng cho: log collector (fluent-bit), node monitoring (node-exporter), CNI.
- **Job**: chạy đến khi hoàn thành (completions, parallelism, backoffLimit). Dùng cho: DB migration, batch processing.
- **CronJob**: Job theo lịch cron. Chú ý `concurrencyPolicy: Forbid` (không chạy chồng) và `startingDeadlineSeconds`.

```yaml
apiVersion: batch/v1
kind: CronJob
metadata: { name: report-job }
spec:
  schedule: "0 2 * * *"
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      backoffLimit: 2
      template:
        spec:
          restartPolicy: Never
          containers:
            - name: report
              image: api:1.4.2
              command: ["node", "dist/jobs/daily-report.js"]
```

#### Namespace & RBAC cơ bản

- **Namespace**: phân vùng logic (dev/staging/prod hoặc theo team). Resource quota, network policy, RBAC áp theo namespace. DNS đầy đủ: `svc.namespace.svc.cluster.local`.
- **RBAC**: `Role` (quyền trong 1 namespace) / `ClusterRole` (toàn cluster) + `RoleBinding`/`ClusterRoleBinding` gán cho user/group/**ServiceAccount**.

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata: { name: pod-reader, namespace: dev }
rules:
  - apiGroups: [""]
    resources: ["pods", "pods/log"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata: { name: dev-pod-reader, namespace: dev }
subjects:
  - kind: ServiceAccount
    name: ci-bot
    namespace: dev
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

Kiểm tra quyền: `kubectl auth can-i list pods --as=system:serviceaccount:dev:ci-bot -n dev`.

#### PersistentVolume & PVC

- **PV**: tài nguyên storage (EBS, NFS, hostPath...) — do admin tạo hoặc **dynamic provisioning** qua StorageClass.
- **PVC**: yêu cầu storage của user ("cho tôi 10Gi RWO"). K8s bind PVC với PV phù hợp.
- **AccessModes**: RWO (1 node đọc-ghi — EBS), ROX, RWX (nhiều node — NFS/EFS).
- **reclaimPolicy**: `Delete` (xóa PVC → xóa disk) vs `Retain` (giữ lại data).

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata: { name: pg-data }
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: gp3
  resources:
    requests: { storage: 10Gi }
```

#### kubectl debug toolkit

```bash
kubectl get pods -o wide --watch                 # trạng thái + node + IP
kubectl describe pod api-xxx                     # events ở cuối: lý do Pending/ImagePullBackOff/OOMKilled
kubectl logs api-xxx -f --tail=100               # logs; thêm -c <container> nếu nhiều container
kubectl logs api-xxx --previous                  # logs của lần crash trước (vàng cho CrashLoopBackOff!)
kubectl exec -it api-xxx -- sh                   # vào shell
kubectl port-forward svc/api 8080:80             # test service từ local
kubectl get events --sort-by=.lastTimestamp -n dev
kubectl top pods                                  # CPU/RAM (cần metrics-server)
kubectl rollout restart deployment/api           # restart toàn bộ pods
kubectl debug api-xxx -it --image=busybox --target=api   # ephemeral container (debug distroless)
kubectl run tmp --rm -it --image=busybox -- sh   # pod tạm để test network/DNS trong cluster
```

Chẩn đoán nhanh:
- **Pending** → describe: thiếu resources, taint không tolerate, PVC chưa bind.
- **ImagePullBackOff** → sai tên image/tag, thiếu imagePullSecrets cho private registry.
- **CrashLoopBackOff** → `logs --previous`: app crash khi boot (thiếu env, không connect được DB).
- **OOMKilled** → describe thấy `Last State: Terminated, Reason: OOMKilled` → tăng limit / sửa leak / chỉnh max-old-space-size.
- Service không nhận traffic → `kubectl get endpoints api`: rỗng nghĩa là selector sai label hoặc readiness fail.

#### Deploy Node.js app hoàn chỉnh — manifest mẫu

```yaml
# k8s/app.yaml — gộp các resource chính
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: prod
  labels: { app: api }
spec:
  replicas: 3
  selector:
    matchLabels: { app: api }
  strategy:
    rollingUpdate: { maxSurge: 1, maxUnavailable: 0 }
  template:
    metadata:
      labels: { app: api }
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
      terminationGracePeriodSeconds: 30
      containers:
        - name: api
          image: registry.example.com/api:1.4.2
          ports: [{ containerPort: 3000, name: http }]
          envFrom:
            - configMapRef: { name: api-config }
            - secretRef: { name: api-secret }
          env:
            - name: NODE_OPTIONS
              value: "--max-old-space-size=400"
          resources:
            requests: { cpu: 250m, memory: 256Mi }
            limits:   { cpu: "1",  memory: 512Mi }
          startupProbe:
            httpGet: { path: /health/live, port: http }
            failureThreshold: 30
            periodSeconds: 2
          livenessProbe:
            httpGet: { path: /health/live, port: http }
            periodSeconds: 10
          readinessProbe:
            httpGet: { path: /health/ready, port: http }
            periodSeconds: 5
          lifecycle:
            preStop:
              exec:
                command: ["sleep", "5"]   # chờ endpoints update trước khi SIGTERM
---
apiVersion: v1
kind: Service
metadata: { name: api, namespace: prod }
spec:
  selector: { app: api }
  ports: [{ port: 80, targetPort: http }]
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata: { name: api-pdb, namespace: prod }
spec:
  minAvailable: 2
  selector:
    matchLabels: { app: api }
```

Vì sao có `preStop sleep 5`: khi pod terminating, việc gỡ pod khỏi Service endpoints và việc gửi SIGTERM xảy ra **song song** — sleep vài giây đảm bảo kube-proxy/ingress kịp ngừng gửi traffic mới trước khi app bắt đầu shutdown → tránh lỗi 502 lúc rolling update.

#### Helm cơ bản

Helm = package manager cho K8s: đóng gói manifests thành **chart**, tham số hóa bằng `values.yaml`, quản lý **release** (install/upgrade/rollback có version).

```
mychart/
├── Chart.yaml          # metadata: name, version, appVersion
├── values.yaml         # giá trị mặc định
└── templates/
    ├── deployment.yaml # Go templates
    ├── service.yaml
    └── _helpers.tpl
```

```yaml
# templates/deployment.yaml (trích)
spec:
  replicas: {{ .Values.replicaCount }}
  template:
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
```

```bash
helm create api-chart
helm install api ./api-chart -f values-prod.yaml
helm upgrade api ./api-chart --set image.tag=1.4.3
helm rollback api 1
helm template ./api-chart        # render thử, không apply
helm ls / helm history api
```

## 💬 Top 15 câu hỏi phỏng vấn thường gặp

**Q1: Mô tả các thành phần control plane của Kubernetes?**
**A:** API server là điểm vào duy nhất, xử lý mọi request và là thành phần duy nhất nói chuyện với etcd — key-value store lưu toàn bộ trạng thái cluster. Scheduler chọn node cho pod mới dựa trên resources/affinity/taints. Controller-manager chạy các reconciliation loops liên tục đưa actual state về desired state — đây là triết lý declarative cốt lõi của K8s.

**Q2: Điều gì xảy ra khi bạn chạy `kubectl apply -f deployment.yaml`?**
**A:** kubectl gửi manifest tới API server, API server authn/authz/validate rồi ghi vào etcd. Deployment controller phát hiện desired state mới, tạo ReplicaSet; ReplicaSet controller tạo Pods; scheduler gán node cho từng pod chưa có node; kubelet trên node đó watch thấy pod được gán cho mình, pull image và chạy container, sau đó chạy probes và báo trạng thái về.

**Q3: livenessProbe vs readinessProbe khác nhau thế nào? Probe nào nên check DB?**
**A:** Liveness fail → kubelet restart container; readiness fail → pod chỉ bị gỡ khỏi Service endpoints, không restart. DB nên check ở readiness: DB down thì pod ngừng nhận traffic và tự quay lại khi DB phục hồi. Nếu check DB ở liveness, DB down sẽ gây restart hàng loạt vô ích (restart không sửa được DB). StartupProbe dùng cho app boot chậm để không bị liveness giết oan.

**Q4: Rolling update hoạt động thế nào? Làm sao đạt zero-downtime?**
**A:** Deployment tạo ReplicaSet mới và scale dần theo maxSurge/maxUnavailable, pod mới phải pass readiness mới nhận traffic. Zero-downtime cần: maxUnavailable=0, readinessProbe chuẩn, graceful shutdown xử lý SIGTERM, và preStop sleep vài giây để endpoints kịp cập nhật trước khi pod nhận SIGTERM. Rollback bằng `kubectl rollout undo` về ReplicaSet revision cũ.

**Q5: Các loại Service và khi nào dùng?**
**A:** ClusterIP cho giao tiếp nội bộ service-to-service (mặc định); NodePort mở port trên mọi node, chủ yếu cho dev/test; LoadBalancer cấp cloud LB cho từng service — tốn kém nếu nhiều service; Headless (clusterIP: None) trả DNS về IP từng pod, dùng với StatefulSet hoặc gRPC client-side load balancing. Production thường dùng Ingress + 1 LB cho nhiều HTTP services.

**Q6: Ingress là gì, khác Service LoadBalancer thế nào?**
**A:** Ingress là tập rules L7: route theo host/path, TLS termination, dùng chung một load balancer cho nhiều services — trong khi LoadBalancer service là L4 và mỗi service một LB. Ingress resource chỉ là config; phải cài Ingress Controller (nginx, Traefik, AWS ALB Controller) để thực thi rules đó.

**Q7: Requests vs limits? Chuyện gì xảy ra khi vượt?**
**A:** Requests là mức đảm bảo và là cơ sở để scheduler chọn node; limits là trần. Vượt CPU limit chỉ bị throttle (chậm đi); vượt memory limit bị OOMKilled. Requests/limits còn quyết định QoS class: Guaranteed (requests=limits) bị evict cuối cùng, BestEffort (không set) bị evict đầu tiên khi node cạn memory.

**Q8: Pod bị CrashLoopBackOff, bạn debug thế nào?**
**A:** Đầu tiên `kubectl logs <pod> --previous` để xem log lần crash trước — thường là thiếu env, không connect được DB, hoặc lỗi code lúc boot. Tiếp theo `kubectl describe pod` xem exit code và events (137 = OOMKilled, 1 = app error). Nếu cần thì kubectl exec vào (hoặc kubectl debug với ephemeral container nếu image distroless) để kiểm tra config/network.

**Q9: StatefulSet khác Deployment thế nào, khi nào dùng?**
**A:** StatefulSet cho pods identity ổn định: tên có thứ tự (pg-0, pg-1), DNS riêng từng pod qua headless service, mỗi pod một PVC riêng qua volumeClaimTemplates, khởi động/xóa tuần tự. Dùng cho stateful workloads như Postgres, Kafka, Elasticsearch. Node.js API là stateless nên dùng Deployment, đẩy state ra Redis/DB.

**Q10: ConfigMap vs Secret? Secret có an toàn mặc định không?**
**A:** ConfigMap cho config thường, Secret cho data nhạy cảm — nhưng Secret mặc định chỉ base64-encode chứ không mã hóa trong etcd. Production cần bật encryption at rest, siết RBAC quyền get secrets, và thường dùng External Secrets Operator đồng bộ từ AWS Secrets Manager/Vault thay vì commit secret vào Git.

**Q11: HPA hoạt động thế nào? CPU 70% là 70% của cái gì?**
**A:** HPA định kỳ lấy metrics từ metrics-server, tính desiredReplicas = ceil(currentReplicas × currentMetric/targetMetric) và scale Deployment trong khoảng min/max. CPU utilization tính theo % của **requests**, không phải limits — vì vậy requests phải đặt chuẩn. Scale theo custom metrics (RPS, Kafka lag) cần Prometheus Adapter hoặc KEDA.

**Q12: Tại sao cần PodDisruptionBudget và preStop hook?**
**A:** PDB đảm bảo số pod tối thiểu khi có voluntary disruption (node drain, cluster upgrade) — không để toàn bộ replicas bị evict cùng lúc. PreStop sleep vài giây xử lý race condition lúc terminate: việc gỡ endpoint và gửi SIGTERM diễn ra song song, nên delay SIGTERM giúp ingress/kube-proxy ngừng gửi traffic trước khi app đóng — tránh 502 khi rolling update.

**Q13: Service có endpoints rỗng (traffic không tới pod), nguyên nhân thường gặp?**
**A:** Hai nguyên nhân chính: selector của Service không khớp labels của pod template, hoặc tất cả pods đang fail readinessProbe nên bị loại khỏi endpoints. Kiểm tra bằng `kubectl get endpoints <svc>` và so sánh `kubectl get pods --show-labels` với selector; sau đó describe pod xem readiness.

**Q14: Init container và sidecar khác nhau thế nào?**
**A:** Init containers chạy tuần tự và phải hoàn thành xong trước khi app container start — dùng cho việc chuẩn bị một lần như chờ DB, chạy migration. Sidecar chạy song song suốt đời pod — log shipper, service mesh proxy. Từ K8s 1.28 có native sidecar (initContainer với restartPolicy: Always) đảm bảo thứ tự start/stop đúng.

**Q15: Helm giải quyết vấn đề gì so với kubectl apply thuần?**
**A:** Helm đóng gói nhiều manifests thành chart có version, tham số hóa qua values.yaml nên một chart deploy được nhiều môi trường (dev/staging/prod chỉ khác values file). Helm quản lý release lifecycle: upgrade có history, rollback một lệnh, hooks cho migration. Với kubectl thuần phải tự quản lý YAML trùng lặp giữa các môi trường (hoặc dùng Kustomize làm lựa chọn thay thế).

## 💪 Bài tập thực hành (bắt buộc)

> Môi trường: cài `minikube` (hoặc `kind`) + `kubectl` + `helm`. Dùng image Node.js app đã build ở Tuần 7. Với minikube: `minikube image load myapp:v2` hoặc `eval $(minikube docker-env)` để dùng image local.

### Bài 1: Deploy Node.js app đầu tiên
**Đề bài:** Viết manifest Deployment (3 replicas) + Service ClusterIP cho Express app tuần 7. App đọc `PORT` và `LOG_LEVEL` từ ConfigMap. Apply lên minikube.
**Yêu cầu output:** `kubectl get pods` thấy 3 pods Running; `kubectl port-forward svc/api 8080:80` rồi `curl localhost:8080/health` trả 200; xóa thử 1 pod (`kubectl delete pod`) → ReplicaSet tự tạo pod mới trong vài giây (chứng minh bằng `kubectl get pods -w`).
**Gợi ý:** Nhớ `imagePullPolicy: IfNotPresent` khi dùng image local với minikube.

### Bài 2: Probes + graceful shutdown + rolling update zero-downtime
**Đề bài:** Thêm startup/liveness/readiness probes (2 endpoint /health/live và /health/ready như lý thuyết), preStop sleep 5s, terminationGracePeriodSeconds 30. Chạy `autocannon -d 60 http://localhost:8080/` qua port-forward, đồng thời rolling update sang image tag mới (đổi response body để phân biệt version).
**Yêu cầu output:** Trong 60s load test xuyên qua rolling update: 0 lỗi non-2xx; `kubectl rollout status` thành công; sau đó `kubectl rollout undo` quay về version cũ cũng 0 lỗi. Ghi lại output autocannon làm bằng chứng.
**Gợi ý:** maxUnavailable: 0; readiness fail thử bằng cách tạm trả 503 để xem pod bị gỡ khỏi endpoints (`kubectl get endpoints -w`).

### Bài 3: Full stack với ConfigMap/Secret/StatefulSet/Init container
**Đề bài:** Deploy Postgres bằng StatefulSet (1 replica, PVC 1Gi, headless service) + Redis bằng Deployment. App dùng Secret cho DATABASE_URL, ConfigMap cho phần còn lại, init container chờ Postgres sẵn sàng rồi chạy migration (node dist/migrate.js).
**Yêu cầu output:** `kubectl get pvc` thấy PVC Bound; POST /api/users lưu được vào Postgres; `kubectl delete pod postgres-0` → pod mới lên vẫn còn data (chứng minh persistence); migration chỉ chạy trong init container (xem `kubectl logs <pod> -c migrate`).
**Gợi ý:** StatefulSet cần serviceName trỏ tới headless service; dùng `stringData` trong Secret cho dễ viết.

### Bài 4: HPA + resource limits + phá để học
**Đề bài:** Đặt requests cpu 100m / limits 200m cho app, cài metrics-server (`minikube addons enable metrics-server`), tạo HPA min 2 max 6 target CPU 50%. Thêm endpoint `/burn` (vòng lặp tính toán 200ms). Bắn load vào /burn và quan sát scale out, ngừng load và quan sát scale in. Sau đó cố tình gây 3 lỗi: (a) đổi image thành tag không tồn tại, (b) memory limit 64Mi để OOMKill, (c) đổi Service selector sai — debug và ghi lại cách phát hiện từng lỗi.
**Yêu cầu output:** `kubectl get hpa -w` cho thấy replicas tăng từ 2 lên ≥4 khi load và giảm về 2 sau ~5 phút ngừng; với mỗi lỗi (a)(b)(c): ghi tên trạng thái quan sát được (ImagePullBackOff/OOMKilled/endpoints rỗng) và lệnh kubectl dùng để chẩn đoán.
**Gợi ý:** dùng `kubectl run load --rm -it --image=busybox -- sh -c 'while true; do wget -qO- http://api/burn; done'` chạy trong cluster.

### Bài 5: Helm chart + CronJob
**Đề bài:** Đóng gói toàn bộ app (Deployment, Service, ConfigMap, HPA, Ingress) thành Helm chart với values.yaml tham số hóa: image.tag, replicaCount, resources, env. Tạo values-dev.yaml (1 replica, không HPA) và values-prod.yaml (3 replicas, có HPA). Thêm CronJob chạy `node dist/jobs/cleanup.js` mỗi 5 phút với concurrencyPolicy Forbid. Bật ingress addon của minikube và truy cập app qua hostname.
**Yêu cầu output:** `helm install api-dev ./chart -f values-dev.yaml -n dev --create-namespace` và bản prod ở namespace prod chạy song song; `helm upgrade` đổi image.tag rồi `helm rollback` thành công với `helm history` hiển thị các revision; `kubectl get jobs -n prod` thấy CronJob tạo job mỗi 5 phút; `curl http://api.local` (qua /etc/hosts + minikube ingress) trả 200.
**Gợi ý:** `helm template` để kiểm tra render trước khi install; dùng `{{ if .Values.hpa.enabled }}` bọc HPA manifest.

## 📝 Bài test cuối tuần

### Phần 1: Quiz 15 câu trắc nghiệm

**Câu 1:** Thành phần nào là nơi DUY NHẤT lưu trạng thái cluster?
A. kube-apiserver  B. etcd  C. kubelet  D. controller-manager

**Câu 2:** Thành phần nào quyết định pod chạy trên node nào?
A. kubelet  B. kube-proxy  C. kube-scheduler  D. etcd

**Câu 3:** readinessProbe fail thì điều gì xảy ra?
A. Container bị restart  B. Pod bị xóa  C. Pod bị gỡ khỏi Service endpoints  D. Node bị cordon

**Câu 4:** DB connection nên được kiểm tra ở probe nào?
A. livenessProbe  B. readinessProbe  C. startupProbe  D. Cả liveness và readiness

**Câu 5:** Pod vượt memory limit thì:
A. Bị throttle  B. Bị OOMKilled  C. Tự scale lên  D. Node bị restart

**Câu 6:** Pod có requests = limits cho mọi container thuộc QoS class nào?
A. BestEffort  B. Burstable  C. Guaranteed  D. Premium

**Câu 7:** Service type nào KHÔNG có virtual IP, DNS trả thẳng IP các pod?
A. ClusterIP  B. NodePort  C. LoadBalancer  D. Headless (clusterIP: None)

**Câu 8:** `maxSurge: 1, maxUnavailable: 0` nghĩa là gì khi rolling update 3 replicas?
A. Tối đa 4 pods cùng lúc, không pod nào down  B. Tối đa 3 pods, 1 pod có thể down  C. Update từng pod, có downtime  D. Tạo 3 pods mới cùng lúc

**Câu 9:** `kubectl logs <pod> --previous` dùng để làm gì?
A. Xem log của pod đã bị xóa  B. Xem log lần container crash trước đó (debug CrashLoopBackOff)  C. Xem log của revision deployment trước  D. Xem log node

**Câu 10:** Postgres trên K8s nên dùng workload nào?
A. Deployment  B. DaemonSet  C. StatefulSet  D. Job

**Câu 11:** Secret trong K8s mặc định được bảo vệ thế nào trong etcd?
A. Mã hóa AES-256  B. Chỉ base64-encode, không mã hóa  C. Mã hóa bằng KMS tự động  D. Hash một chiều

**Câu 12:** HPA target CPU 70% được tính dựa trên:
A. % của limits  B. % của requests  C. % CPU của node  D. % CPU của namespace

**Câu 13:** Workload nào đảm bảo đúng 1 pod trên mỗi node?
A. Deployment với replicas = số node  B. StatefulSet  C. DaemonSet  D. ReplicaSet

**Câu 14:** Service có endpoints rỗng dù pods đang Running. Nguyên nhân khả dĩ nhất?
A. etcd bị lỗi  B. Selector không khớp labels hoặc readiness đang fail  C. Thiếu Ingress  D. Node hết tài nguyên

**Câu 15:** Lý do chính dùng preStop hook `sleep 5` trong Deployment?
A. Cho app thời gian khởi động  B. Chờ endpoints/ingress cập nhật trước khi app nhận SIGTERM, tránh 502  C. Đợi log flush ra disk  D. Tăng grace period

<details><summary>Đáp án</summary>

1. **B** — etcd là source of truth; API server chỉ là cổng truy cập.
2. **C** — Scheduler gán node; kubelet thực thi việc chạy container.
3. **C** — Readiness chỉ ảnh hưởng routing, không restart container.
4. **B** — Check DB ở liveness sẽ gây restart hàng loạt vô ích khi DB down.
5. **B** — Memory không nén được nên vượt limit là bị kill; CPU vượt chỉ throttle.
6. **C** — Guaranteed, bị evict cuối cùng khi node thiếu memory.
7. **D** — Headless service trả A records của từng pod, dùng cho StatefulSet/gRPC.
8. **A** — Surge thêm 1 pod mới (tổng 4), pod cũ chỉ bị xóa khi pod mới ready → zero-downtime.
9. **B** — Xem log của container instance trước khi restart, thiết yếu khi CrashLoopBackOff.
10. **C** — StatefulSet cho stable identity + PVC riêng + ordered startup.
11. **B** — Mặc định chỉ base64; cần bật encryption at rest + RBAC, hoặc external secrets.
12. **B** — Utilization = usage/requests; vì vậy requests sai thì HPA scale sai.
13. **C** — DaemonSet schedule 1 pod/node, dùng cho log agent, monitoring.
14. **B** — Hai nguyên nhân kinh điển: label selector lệch hoặc readinessProbe fail.
15. **B** — Endpoint removal và SIGTERM xảy ra song song; sleep cho data plane kịp cập nhật.

</details>

### Phần 2: Bài thực hành chấm điểm

**Đề bài:** Deploy "Todo Service" của tuần 7 lên minikube/kind ở mức production-grade, đóng gói bằng Helm. Yêu cầu hệ thống: app Node.js (Deployment), Postgres (StatefulSet + PVC), Redis (Deployment), Ingress với hostname `todo.local`, HPA, CronJob cleanup mỗi giờ, migration bằng init container hoặc Helm hook. Nộp: repo chứa Helm chart + values-dev/prod + script demo + ghi chú các lệnh kiểm chứng.

**Checklist tiêu chí chấm điểm:**

- [ ] Helm chart render và install thành công cả 2 môi trường (namespace dev & prod) từ cùng một chart
- [ ] Deployment có đủ: startup + liveness + readiness probes (2 endpoints riêng, readiness check DB/Redis thật)
- [ ] resources requests/limits đặt hợp lý, QoS Burstable trở lên, NODE_OPTIONS giới hạn heap theo memory limit
- [ ] Secret cho DATABASE_URL (không hardcode trong values commit lên Git), ConfigMap cho config thường
- [ ] Rolling update zero-downtime: autocannon 60s xuyên qua upgrade không có non-2xx; rollback bằng helm rollback thành công
- [ ] Graceful shutdown + preStop hook; `kubectl delete pod` lúc đang có in-flight request không gây lỗi client
- [ ] Postgres StatefulSet: xóa pod không mất data (PVC persist); init container/hook chạy migration đúng một lần
- [ ] HPA hoạt động: chứng minh scale out khi bắn load và scale in sau khi ngừng
- [ ] Ingress truy cập được qua `http://todo.local`; Service nội bộ dùng ClusterIP
- [ ] Demo debug: tài liệu ngắn ghi lại cách chẩn đoán 3 sự cố tự tạo (ImagePullBackOff, OOMKilled, endpoints rỗng) kèm lệnh đã dùng

**Thang điểm:** mỗi mục 1 điểm, đạt ≥ 8/10 là pass.

## ✅ Tiêu chí pass tuần

- Quiz ≥ 12/15
- Hoàn thành tất cả bài tập bắt buộc (bài 1-5)
- Bài thực hành đạt ≥ 8/10 checklist
- Vẽ lại được sơ đồ K8s architecture và giải thích luồng `kubectl apply` end-to-end không nhìn tài liệu
- Trả lời trôi chảy bộ 3 câu "định mệnh": liveness vs readiness, requests vs limits, debug CrashLoopBackOff

> 🧪 **Capstone**: học xong tuần này, hoàn tất [Upgrade 4 — Docker & K8s](../capstone-project/UPGRADE-04-DOCKER-K8S.md) và tick nghiệm thu ở tab 📅 Kế hoạch của study-web.
