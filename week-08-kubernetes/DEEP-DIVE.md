# 🔬 Đào sâu — Tuần 8: Kubernetes

> README đã dạy *cái gì* và *dùng thế nào*; tài liệu này mổ xẻ *vì sao K8s hành xử như vậy* — từ reconcile loop, scheduler, kube-proxy iptables, tới CFS throttling và OOM eviction.

## 🧠 Cơ chế bên trong

### 1. Reconcile loop — level-triggered, không phải edge-triggered

Controller K8s KHÔNG phản ứng theo "sự kiện" (edge-triggered) mà theo **trạng thái hiện tại** (level-triggered). Đây là khác biệt sống còn:

- **Edge-triggered** (vd interrupt phần cứng): "Pod vừa chết" → chạy handler 1 lần. Nếu controller đang restart và bỏ lỡ sự kiện → mất luôn, không bao giờ sửa.
- **Level-triggered** (K8s): vòng lặp liên tục đọc `desired` (spec, trong etcd) và `actual` (status, từ kubelet report), rồi tính `diff` và hành động để thu hẹp diff. Bỏ lỡ event không sao — vòng sau vẫn thấy "đang thiếu 1 pod" và tạo lại.

```
for {
    desired := getDesiredState()   // spec từ etcd (qua informer cache)
    actual  := getActualState()    // status thực tế
    diff    := desired - actual
    if diff != 0 { reconcile(diff) }  // tạo/xóa để khớp
    // KHÔNG return — lặp mãi mãi
}
```

Hệ quả thực tế: vì sao `kubectl delete pod` (pod do Deployment quản lý) thì pod mới mọc lại ngay — ReplicaSet controller thấy `actual=2 < desired=3` và tạo bù. Muốn xóa thật phải xóa Deployment (sửa desired). Đây cũng là lý do K8s **self-healing** và **idempotent**: apply 2 lần kết quả như nhau.

**Informer/watch**: controller không poll API server liên tục (tốn kém). Nó dùng **informer** — mở 1 watch connection, API server push delta (ADDED/MODIFIED/DELETED), lưu vào **local cache** + đẩy vào **workqueue**. Reconcile đọc từ cache. `resourceVersion` đảm bảo không miss update khi watch bị đứt và reconnect.

### 2. Luồng đầy đủ của `kubectl apply -f deploy.yaml`

```
kubectl ──HTTP POST──> kube-apiserver
                          │ 1. Authentication (cert/token/OIDC)
                          │ 2. Authorization (RBAC: can-i create deployments?)
                          │ 3. Admission controllers (mutating: thêm default, sidecar inject;
                          │                            validating: deny nếu vi phạm policy)
                          │ 4. Schema validation
                          │ 5. WRITE vào etcd (chỉ apiserver được chạm etcd)
                          ▼
        ┌─────────────────┴──────────────────────────────────┐
        │ (mỗi component WATCH apiserver, hoạt động bất đồng bộ)│
        ▼                                                      ▼
Deployment controller                              kube-scheduler
  thấy Deployment mới → tạo ReplicaSet                thấy Pod có nodeName="" (chưa schedule)
        ▼                                                  │ filter (predicates) → score (priorities)
ReplicaSet controller                                      ▼ ghi binding: pod.spec.nodeName = node-2
  thấy RS desired=3, actual=0 → tạo 3 Pod object       (chỉ cập nhật field, KHÔNG tự chạy container)
        ▼                                                      │
   (Pod được ghi vào etcd, nodeName rỗng)                      ▼
                                              kubelet trên node-2 WATCH pod gán cho mình
                                                  │ gọi CRI (containerd) qua gRPC: pull image, tạo container
                                                  │ tạo sandbox (pause container giữ network ns)
                                                  │ CNI plugin gán pod IP
                                                  │ chạy probes, mount volumes (CSI)
                                                  ▼ cập nhật pod.status → apiserver → etcd
```

Điểm mấu chốt: **không có thành phần nào gọi trực tiếp thành phần khác**. Tất cả giao tiếp gián tiếp qua etcd/apiserver theo mô hình watch. Đây là lý do K8s chịu lỗi tốt: scheduler chết thì pod nằm Pending, khi scheduler sống lại nó thấy ngay và xử lý — không mất việc.

### 3. Scheduler: filter → score

Scheduler chạy 2 pha cho mỗi pod chưa schedule:

**Pha Filter (predicates)** — loại bỏ node KHÔNG chạy được:
- `NodeResourcesFit`: node còn đủ `requests` cpu/memory không? (so với *allocatable*, đã trừ pod đang chạy)
- `NodeAffinity` / `nodeSelector`: node có label khớp không
- `TaintToleration`: node có taint mà pod không tolerate → loại
- `PodTopologySpread` / `InterPodAffinity`: ràng buộc với pod khác
- `VolumeBinding`: PVC bind được vào node này không (zone của EBS)

**Pha Score (priorities)** — chấm điểm các node còn lại (0-100), chọn cao nhất:
- `LeastAllocated` (mặc định): ưu tiên node trống hơn → rải đều
- `ImageLocality`: node đã có image → khởi động nhanh
- `PodTopologySpreadConstraint`: rải đều theo zone/hostname

**Taint & Toleration** (cơ chế "đẩy"): taint đặt trên node `key=value:Effect`.
- `NoSchedule`: không schedule pod mới (trừ pod tolerate)
- `PreferNoSchedule`: cố tránh nhưng vẫn được nếu hết chỗ
- `NoExecute`: evict cả pod đang chạy nếu không tolerate (vd node `not-ready` → evict sau `tolerationSeconds`)

Affinity (cơ chế "kéo") ngược với taint: pod chủ động chọn/tránh node hoặc pod khác.

### 4. Service được thực thi thế nào — endpoints + kube-proxy

Service KHÔNG phải một process proxy. ClusterIP là một IP **ảo không tồn tại trên interface nào** — nó chỉ là đích trong bảng iptables/IPVS.

```
1. Bạn tạo Service (selector: app=api)
2. EndpointSlice controller watch các Pod khớp selector VÀ readinessProbe pass
   → ghi danh sách IP:port pod vào EndpointSlice object
3. kube-proxy trên MỌI node watch Service + EndpointSlice
   → lập trình iptables/IPVS rules: "traffic tới ClusterIP:80 → DNAT về 1 trong N pod IP"
4. Khi pod gọi ClusterIP, packet bị iptables intercept ở netfilter, DNAT random về pod backend
```

**iptables mode** (mặc định cũ): dùng chain iptables với xác suất (`statistic mode random probability`). Nhược điểm: O(n) rules, với hàng nghìn service thì cập nhật bảng chậm (vài giây), latency thêm.

**IPVS mode**: dùng hash table trong kernel (LVS), O(1) lookup, hỗ trợ nhiều thuật toán LB (rr, lc, wrr). Khuyến nghị cho cluster lớn.

Điểm thi hay hỏi: **vì sao endpoints rỗng = không có traffic?** Vì nếu không pod nào pass readiness, EndpointSlice rỗng → kube-proxy không có đích DNAT → packet bị drop/reject. Kiểm tra: `kubectl get endpointslices -l kubernetes.io/service-name=api`.

### 5. Rolling update qua ReplicaSet — vai trò của readiness

Deployment KHÔNG tự sửa pod. Nó điều phối 2 ReplicaSet (cũ + mới):

```
replicas=3, maxSurge=1, maxUnavailable=0:
RS-old=3 RS-new=0
→ tạo RS-new pod (surge): RS-old=3 RS-new=1 (tổng 4, được vì surge=1)
→ ĐỢI pod RS-new READY (readinessProbe pass) ← mấu chốt
→ chỉ khi ready mới xóa 1 pod RS-old: RS-old=2 RS-new=1 (tổng 3)
→ tạo tiếp: RS-old=2 RS-new=2 → ready → RS-old=1 RS-new=2
→ ... → RS-old=0 RS-new=3
```

`maxUnavailable=0` nghĩa là: số pod *available* (ready) không bao giờ tụt dưới `replicas - 0 = 3`. Vì sao readiness quyết định "ready"? Deployment đọc `status.readyReplicas` — chỉ tăng khi readinessProbe pass. **Nếu không có readinessProbe**, pod bị coi là ready ngay khi container start (process chạy), kể cả khi app chưa connect DB/chưa nghe port → traffic tới sớm → lỗi. Đây là lỗi zero-downtime kinh điển.

`revisionHistoryLimit` giữ lại các RS cũ (scale về 0) để `rollout undo` — undo chỉ là scale RS cũ lên lại, RS mới xuống.

### 6. QoS class & thứ tự eviction

Khi node thiếu memory (memory pressure), kubelet chạy **eviction** theo thứ tự QoS để cứu node:

| QoS | Điều kiện | Thứ tự bị giết |
|---|---|---|
| **BestEffort** | không set request/limit | **đầu tiên** |
| **Burstable** | có request, request < limit | **giữa** (pod vượt request nhiều nhất chết trước) |
| **Guaranteed** | request = limit (cả cpu lẫn mem, mọi container) | **cuối cùng** |

Phân biệt 2 cơ chế giết khác nhau:
- **OOMKilled** (cgroup): container vượt *memory limit* của chính nó → kernel OOM killer giết → kubelet restart container (exit 137). Xảy ra bất kể QoS.
- **Eviction** (kubelet): *node* hết RAM → kubelet chủ động đuổi pod (theo QoS) để giải phóng, pod bị xóa và reschedule chỗ khác.

`oom_score_adj`: Guaranteed có score thấp nhất (-998), BestEffort cao nhất (1000) → khi node OOM, kernel ưu tiên giết BestEffort.

### 7. requests vs limits & CPU throttling (CFS quota)

CPU là **compressible** (nén được — chỉ làm chậm), memory **incompressible** (vượt là chết).

- `requests.cpu` → ánh xạ thành **cgroup cpu.shares** (weighting tương đối khi tranh chấp). 250m = 256 shares. Chỉ có tác dụng khi CPU bị tranh chấp.
- `limits.cpu` → ánh xạ thành **CFS quota** (`cpu.cfs_quota_us` / `cpu.cfs_period_us`). Period mặc định 100ms. limit `500m` = quota 50ms mỗi period 100ms.

**CPU throttling**: nếu container dùng hết quota trong 1 period, kernel **đình chỉ** (throttle) nó tới hết period rồi mới cho chạy tiếp. Với Node.js đây là cái bẫy p99 chí mạng:

```
limit cpu = 500m → 50ms CPU mỗi 100ms.
Một request cần 80ms CPU burst (JSON parse lớn, crypto):
  chạy 50ms → hết quota → THROTTLE 50ms (treo) → chạy nốt 30ms.
  → latency thực: 130ms thay vì 80ms. Tail latency phình to dù CPU trung bình thấp.
```

Đó là lý do nhiều team **bỏ hẳn CPU limit** (chỉ giữ requests) cho service latency-sensitive, để pod được "burst" khi node rảnh — đánh đổi: mất QoS Guaranteed và rủi ro noisy-neighbor. Kiểm tra throttling: metric `container_cpu_cfs_throttled_periods_total`.

---

## 🧪 Ví dụ nâng cao (YAML)

### Probe đúng — ba loại, ba mục đích

```yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: api, namespace: prod }
spec:
  replicas: 4
  selector: { matchLabels: { app: api } }
  template:
    metadata: { labels: { app: api } }
    spec:
      terminationGracePeriodSeconds: 45
      containers:
        - name: api
          image: registry.example.com/api:2.1.0
          ports: [{ containerPort: 3000, name: http }]

          # startup: app boot chậm (load model, warm cache). Chặn liveness/readiness
          # tới khi pass → tránh liveness giết oan lúc đang khởi động.
          startupProbe:
            httpGet: { path: /health/live, port: http }
            periodSeconds: 3
            failureThreshold: 40        # tối đa 40*3 = 120s để boot xong

          # liveness: CHỈ check sống nội tại (process/event loop). KHÔNG gọi DB.
          # fail → restart container.
          livenessProbe:
            httpGet: { path: /health/live, port: http }
            periodSeconds: 10
            timeoutSeconds: 2
            failureThreshold: 3         # 3 fail liên tiếp mới restart → tránh nhạy
            successThreshold: 1

          # readiness: check dependency (DB/Redis). fail → gỡ khỏi endpoints, KHÔNG restart.
          readinessProbe:
            httpGet: { path: /health/ready, port: http }
            periodSeconds: 5
            timeoutSeconds: 2
            failureThreshold: 2
```

### Graceful shutdown: preStop + terminationGracePeriod

```yaml
        # ... trong container spec
          lifecycle:
            preStop:
              exec:
                # sleep cho kube-proxy/ingress kịp xóa pod khỏi endpoints
                # TRƯỚC khi app nhận SIGTERM → tránh 502 lúc rolling update.
                command: ["sh", "-c", "sleep 10"]
```

Timeline khi pod bị terminate (giả sử `terminationGracePeriodSeconds: 45`):

```
t=0   : pod chuyển Terminating → SONG SONG: (a) endpoint controller gỡ pod khỏi EndpointSlice
        (b) kubelet chạy preStop hook
t=0   : preStop sleep 10 chạy (app CHƯA nhận SIGTERM)
        ← trong 10s này kube-proxy cập nhật iptables, traffic mới ngừng tới
t=10  : preStop xong → kubelet gửi SIGTERM cho process chính
        → app đóng server (ngừng nhận conn mới), xử lý nốt in-flight, đóng DB pool
t=10..45: app có (45-10)=35s để drain
t=45  : nếu chưa thoát → SIGKILL (cứng). Đặt grace > thời gian request dài nhất.
```

Code Node.js bắt SIGTERM:

```js
process.on('SIGTERM', async () => {
  server.close();                    // ngừng nhận connection mới, giữ in-flight
  await new Promise(r => setTimeout(r, 0));
  await pool.end(); await redis.quit();
  process.exit(0);
});
```

### PodDisruptionBudget — bảo vệ lúc node drain

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata: { name: api-pdb, namespace: prod }
spec:
  minAvailable: 3            # hoặc maxUnavailable: 1 / "25%"
  selector:
    matchLabels: { app: api }
# Khi node drain (upgrade cluster), evict chỉ được tiến hành nếu vẫn còn >=3 pod available.
# PDB chỉ chặn VOLUNTARY disruption (drain, autoscaler). KHÔNG chặn node chết đột ngột.
# Bẫy: minAvailable = replicas (vd 3/3) → drain BỊ TREO mãi vì không evict nổi pod nào.
```

### HPA theo custom metric (RPS)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: { name: api-hpa, namespace: prod }
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: api }
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource              # CPU theo % của requests
      resource:
        name: cpu
        target: { type: Utilization, averageUtilization: 70 }
    - type: Pods                  # custom metric: requests/giây mỗi pod (qua Prometheus Adapter)
      pods:
        metric: { name: http_requests_per_second }
        target: { type: AverageValue, averageValue: "100" }
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 0     # scale out NGAY (phản ứng nhanh với spike)
      policies:
        - type: Percent
          value: 100                    # cho phép gấp đôi pod mỗi 15s
          periodSeconds: 15
    scaleDown:
      stabilizationWindowSeconds: 300   # scale in CHẬM (5 phút) → tránh flapping
# Khi nhiều metric: HPA tính desiredReplicas cho TỪNG metric, lấy MAX → an toàn nhất.
```

### Anti-affinity — rải pod để chịu lỗi node

```yaml
      affinity:
        podAntiAffinity:
          # "bắt buộc": không 2 pod api nào cùng 1 node (mất node = mất tối đa 1 pod)
          requiredDuringSchedulingIgnoredDuringExecution:
            - labelSelector:
                matchLabels: { app: api }
              topologyKey: kubernetes.io/hostname
          # "ưu tiên": cố rải theo zone (chịu lỗi cả AZ)
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector: { matchLabels: { app: api } }
                topologyKey: topology.kubernetes.io/zone
```

Bẫy: `required` anti-affinity với `replicas > số node` → pod thừa kẹt `Pending` mãi. Cân nhắc dùng `topologySpreadConstraints` (mềm dẻo hơn, có `maxSkew`).

---

## 🐛 Bẫy & sự cố production

### 1. Liveness probe quá nhạy → restart loop toàn cụm

- **Dấu hiệu**: pod restart liên tục dù app "có vẻ ổn"; `kubectl describe` thấy `Liveness probe failed`; `RESTARTS` tăng đều. Tệ nhất: lúc tải cao, liveness timeout vì app bận → bị restart → tải dồn sang pod còn lại → chúng cũng timeout → restart → **cascading failure**.
- **Nguyên nhân**: `timeoutSeconds` quá ngắn (1s) hoặc liveness gọi việc nặng/gọi DB; `failureThreshold` quá thấp.
- **Fix**: liveness chỉ check nội tại, nhẹ; `failureThreshold: 3`, `timeoutSeconds: 2-5`; tách `startupProbe` cho boot. KHÔNG bao giờ gọi dependency trong liveness.

### 2. Thiếu readiness → nhận traffic khi chưa sẵn sàng (502/connection refused)

- **Dấu hiệu**: ngay sau rollout/scale, một tỉ lệ request lỗi 502/ECONNREFUSED rồi tự hết; `kubectl get endpoints` thấy pod được thêm vào quá sớm.
- **Nguyên nhân**: không có readinessProbe → pod vào endpoints ngay khi container start, trước khi app `listen()` hoặc connect DB xong.
- **Fix**: thêm readinessProbe check `/health/ready` (đã connect DB/Redis + đang listen). Có readiness, rolling update mới thực sự zero-downtime.

### 3. Không set requests → scheduler đặt sai, eviction sớm

- **Dấu hiệu**: pod chạy ngon ở môi trường rảnh nhưng bị evict/OOM khi node đông; pod dồn hết vào 1 node; QoS = BestEffort.
- **Nguyên nhân**: không có requests → scheduler tưởng pod "không tốn gì" → nhồi quá nhiều vào 1 node → node overcommit → evict.
- **Fix**: luôn set requests (cả cpu & memory). Đặt requests ≈ usage thực p50-p90. Burstable tối thiểu; latency-critical thì Guaranteed.

### 4. CPU limit gây throttling → p99 phình

- **Dấu hiệu**: CPU trung bình thấp (20-30%) nhưng p99 latency cao bất thường; metric `container_cpu_cfs_throttled_seconds_total` tăng.
- **Nguyên nhân**: CFS quota chặt; request burst CPU vượt quota trong 1 period 100ms → bị treo tới hết period (xem mục 7 trên).
- **Fix**: nới CPU limit hoặc bỏ CPU limit (giữ requests) cho service latency-sensitive; với Node.js single-thread thường limit ≥ 1 CPU. Theo dõi throttle ratio.

### 5. OOMKilled do limit thấp / heap vượt limit

- **Dấu hiệu**: `kubectl describe pod` → `Last State: Terminated, Reason: OOMKilled, Exit Code: 137`; restart đột ngột không có log lỗi app.
- **Nguyên nhân**: memory limit < heap thực; hoặc V8 heap (`--max-old-space-size`) đặt ≥ memory limit nên app dùng tới limit rồi bị kill trước cả khi GC.
- **Fix**: đặt `--max-old-space-size` ≈ 75-80% của memory limit (chừa chỗ cho buffer/native/stack). Vd limit 512Mi → `--max-old-space-size=400`. Nếu vẫn OOM → tìm memory leak (heap snapshot) hoặc tăng limit.

### 6. Rolling update mất request do thiếu preStop/graceful

- **Dấu hiệu**: mỗi lần deploy có một nhúm 502/reset connection; client thấy request đang chạy bị ngắt giữa chừng.
- **Nguyên nhân**: SIGTERM và việc gỡ endpoint xảy ra **song song** → app shutdown trước khi kube-proxy kịp ngừng route traffic tới; hoặc app không bắt SIGTERM, bị SIGKILL ngay.
- **Fix**: `preStop: sleep 10`; bắt SIGTERM → `server.close()` drain in-flight; `terminationGracePeriodSeconds` > request dài nhất; `maxUnavailable: 0`.

### 7. Secret base64 ≠ mã hóa

- **Dấu hiệu**: secret "trông như đã mã hóa" trong YAML nhưng `echo <val> | base64 -d` ra plaintext; ai có quyền `get secrets` hoặc đọc etcd đều thấy.
- **Nguyên nhân**: hiểu nhầm base64 là mã hóa. Mặc định etcd lưu secret dạng plaintext (chỉ base64).
- **Fix**: bật **encryption at rest** cho etcd (EncryptionConfiguration + KMS); siết RBAC `get/list secrets`; production dùng External Secrets Operator/Sealed Secrets/Vault thay vì commit secret vào Git.

---

## ⚖️ Đánh đổi & quyết định thiết kế

**Deployment vs StatefulSet**: chọn StatefulSet CHỈ khi cần *stable identity* (tên/DNS pod ổn định) + *PVC riêng từng pod* + *khởi động/xóa có thứ tự* — tức stateful thật (DB, Kafka, ES). Mọi thứ khác dùng Deployment. StatefulSet phức tạp hơn (headless service bắt buộc, scale chậm hơn vì tuần tự). Node.js API stateless → Deployment, đẩy state ra ngoài.

**requests=limits (Guaranteed) vs Burstable**: Guaranteed cho latency-sensitive workload cần dự đoán được (evict cuối, không bị noisy neighbor) — nhưng lãng phí (giữ tài nguyên kể cả khi rảnh) và CPU limit gây throttle. Burstable tận dụng tài nguyên rảnh tốt hơn, rẻ hơn, nhưng rủi ro bị throttle/evict khi node đông. Thực dụng: memory request=limit (tránh OOM bất ngờ) nhưng CPU chỉ set request (cho burst).

**Liveness có nên gọi DB không?** KHÔNG. Liveness fail = restart, mà restart không sửa được DB down → DB chập chờn sẽ giết toàn bộ pod đồng loạt (cascading). DB thuộc readiness (chỉ gỡ khỏi traffic, tự hồi khi DB lên). Nguyên tắc: liveness = "process này có cần restart không", readiness = "có nên gửi traffic không".

**HPA vs VPA**: HPA scale *số lượng* pod (ngang) — hợp với stateless, traffic biến động, là lựa chọn mặc định cho web/API. VPA chỉnh *requests/limits* của pod (dọc) — hợp workload không scale ngang được (vài singleton, batch). KHÔNG dùng HPA + VPA trên cùng metric CPU (xung đột: VPA đổi requests làm HPA tính sai utilization). KEDA mở rộng HPA cho event-driven (Kafka lag, queue depth, scale-to-zero).

**ClusterIP / NodePort / LoadBalancer / Ingress**: ClusterIP cho mọi giao tiếp nội bộ (mặc định). NodePort chủ yếu dev/test hoặc làm nền cho LB. LoadBalancer = 1 cloud LB/service → đắt và tốn IP nếu nhiều service L4. Ingress = 1 LB + routing L7 (host/path, TLS) cho N service HTTP → tiết kiệm, chuẩn production cho web. Cần L4/non-HTTP (gRPC raw, TCP/UDP) hoặc thông lượng cực cao → LoadBalancer hoặc Gateway API.

---

## 🎯 Câu hỏi phỏng vấn NÂNG CAO

**Q1: Reconcile loop là level-triggered hay edge-triggered, khác biệt thực tế là gì?**
Level-triggered: controller liên tục so desired (etcd) vs actual và sửa diff, không phụ thuộc "đã nhận event chưa". Khác biệt: nếu controller restart và bỏ lỡ một sự kiện, vòng reconcile sau vẫn thấy trạng thái lệch và tự sửa → self-healing, idempotent, chịu lỗi. Edge-triggered (xử lý event 1 lần) sẽ mất việc nếu lỡ event. Đó là lý do xóa pod do Deployment quản lý thì nó mọc lại — desired vẫn là 3.

**Q2: Liveness vs readiness khác nhau thế nào, đặt sai gây gì?**
Liveness fail → kubelet *restart container*; readiness fail → pod bị *gỡ khỏi Service endpoints* (không restart). Đặt DB-check vào liveness là sai chí mạng: DB chập chờn → toàn bộ pod restart đồng loạt (cascading) mà restart chẳng sửa được DB. Thiếu readiness → pod nhận traffic trước khi sẵn sàng → 502 lúc rollout. Đúng: liveness check nội tại nhẹ, readiness check dependency.

**Q3: CPU limit gây throttling ra sao? Vì sao p99 cao dù CPU trung bình thấp?**
limits.cpu → CFS quota: vd 500m = 50ms CPU mỗi period 100ms. Request nào burst CPU vượt 50ms trong 1 period sẽ bị kernel *treo* tới hết period rồi mới chạy tiếp → cộng thêm độ trễ. CPU trung bình thấp vì đo trên cửa sổ dài, nhưng tail (p99) phình do throttle ở các burst ngắn. Fix: nới hoặc bỏ CPU limit cho service latency-sensitive; theo dõi `cfs_throttled_periods`.

**Q4: Rolling update zero-downtime cần đủ những gì?**
(1) `maxUnavailable: 0` để không tụt số pod ready; (2) readinessProbe chuẩn để pod mới chỉ nhận traffic khi thật sự sẵn sàng; (3) graceful shutdown — bắt SIGTERM, `server.close()` drain in-flight; (4) `preStop: sleep` cho kube-proxy/ingress kịp gỡ endpoint trước khi SIGTERM; (5) `terminationGracePeriodSeconds` > request dài nhất; (6) PDB để node drain không evict quá nhiều cùng lúc.

**Q5: QoS class ảnh hưởng thế nào khi node hết RAM?**
Khi node memory pressure, kubelet evict theo thứ tự: BestEffort (không set gì) trước → Burstable (request<limit, pod vượt request nhiều nhất chết trước) → Guaranteed (request=limit) cuối. Khác với OOMKilled cấp container (vượt *limit của chính nó* → kernel giết, restart). Muốn pod sống dai nhất → Guaranteed (request=limit cả cpu lẫn mem).

**Q6: Điều gì xảy ra từ lúc `kubectl apply` tới khi container chạy, theo trình tự component?**
apiserver authn→authz(RBAC)→admission→validate→ghi etcd. Deployment controller → tạo ReplicaSet → ReplicaSet controller tạo Pod (nodeName rỗng). Scheduler filter+score chọn node, ghi binding. kubelet node đó watch thấy pod của mình → gọi CRI pull image, tạo sandbox, CNI gán IP, mount volume (CSI), chạy probe, report status. Mọi giao tiếp gián tiếp qua etcd theo watch, không gọi trực tiếp nhau.

**Q7: Service endpoints rỗng dù pod Running — chẩn đoán?**
Hai nguyên nhân kinh điển: (a) Service selector không khớp labels pod template; (b) tất cả pod fail readinessProbe nên bị loại khỏi EndpointSlice. Kiểm tra: `kubectl get endpointslices -l kubernetes.io/service-name=<svc>` (rỗng?), so `kubectl get pods --show-labels` với selector, rồi `describe pod` xem readiness. Endpoints rỗng = kube-proxy không có đích DNAT → traffic bị drop.

**Q8: Vì sao cần preStop hook dù đã bắt SIGTERM trong app?**
Vì khi pod terminate, việc *gỡ endpoint* (qua endpoint controller → kube-proxy cập nhật iptables) và việc *gửi SIGTERM* xảy ra **song song và bất đồng bộ**. Nếu app shutdown ngay khi nhận SIGTERM, có thể kube-proxy chưa kịp ngừng route → traffic mới vẫn tới pod đang đóng → reset/502. `preStop: sleep` trì hoãn SIGTERM vài giây để data plane kịp hội tụ. Đây là vấn đề timing của hệ phân tán, không phải app tự giải quyết được.

**Q9: Khi nào KHÔNG nên đặt CPU limit, và đánh đổi là gì?**
Service latency-sensitive (API user-facing) nên cân nhắc bỏ CPU limit (giữ request) để pod burst khi node rảnh → giảm throttle p99. Đánh đổi: mất QoS Guaranteed, rủi ro noisy-neighbor (1 pod ăn hết CPU node ảnh hưởng pod khác — nhưng cpu.shares theo request vẫn đảm bảo công bằng khi tranh chấp), và khó dự đoán capacity. Batch/untrusted workload thì nên giữ limit.

---

## 📚 Đọc thêm

- Kubernetes docs — *Concepts: Controllers & Reconciliation*, *Assigning Pods to Nodes* (affinity/taint), *Pod QoS Classes*.
- Kubernetes docs — *Configure Liveness, Readiness and Startup Probes* + *Pod Lifecycle* (termination flow).
- "Kubernetes Patterns" (Bilgin Ibryam) — Health Probe, Managed Lifecycle, Predictable Demands patterns.
- KodeKloud / "Kubernetes The Hard Way" (Kelsey Hightower) — dựng control plane tay để hiểu luồng apiserver→etcd→kubelet.
- Bài blog *"CPU limits and aggressive throttling in Kubernetes"* (Omio/Buffer) — số liệu thực về CFS throttling.
- kube-proxy & EndpointSlice internals; IPVS vs iptables mode (docs *Virtual IPs and Service Proxies*).
- KEDA docs — scale-to-zero theo event source (Kafka, SQS) làm nền cho UPGRADE-05 AWS.
