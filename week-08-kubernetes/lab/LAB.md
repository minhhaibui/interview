# 🧪 Lab Kubernetes — Tận tay (kind)

Học Kubernetes bằng cách **tự tay** dựng 1 cluster thật trên máy (qua `kind`) rồi
`kubectl apply` để cảm nhận Pod / Deployment / Service / ConfigMap, probes, resources,
scaling, rolling update và self-heal. Không cần build image — dùng `nginx:1.27-alpine`.

---

## 🎯 Mục tiêu

Sau lab này bạn sẽ tự tin:

- Dựng cluster nhiều node bằng `kind`, hiểu node là gì.
- Phân biệt **Pod vs ReplicaSet vs Deployment** và cơ chế **reconciliation** (desired state).
- Dùng **ConfigMap** bơm cấu hình/nội dung vào container (không cần build lại image).
- Hiểu **Service** (ClusterIP / NodePort / LoadBalancer) và load-balancing.
- Đọc được **liveness vs readiness probe**, **requests vs limits**.
- Thực hành **self-heal**, **scaling**, **rolling update** + **rollback**.

---

## 🏗️ Kiến trúc

```
        Máy host (macOS)
        http://localhost:8080
                │  (kind extraPortMappings 8080 -> 30080)
                ▼
   ┌─────────────────────────────────────────────────────┐
   │  Cluster kind "lab" (3 node = 3 container Docker)    │
   │                                                     │
   │   control-plane        worker-1         worker-2    │
   │       │                   │                 │       │
   │   [Service web NodePort 30080]  (selector app=web)  │
   │       │            │            │                   │
   │     [Pod]        [Pod]        [Pod]   nginx:1.27-alpine
   │       └────────────┴────────────┘                   │
   │            Deployment web (3 replicas)              │
   │            └─ mount ConfigMap web-content (index.html)
   └─────────────────────────────────────────────────────┘
```

- **Cluster kind**: 1 control-plane + 2 worker → pod được rải ra nhiều node.
- **Deployment `web`**: 3 pod nginx, mỗi pod mount `index.html` từ ConfigMap.
- **ConfigMap `web-content`**: chứa trang HTML tuỳ biến.
- **Service `web` (NodePort 30080)**: cửa vào, load-balance giữa 3 pod.

---

## ⚙️ Cài đặt công cụ

Cần: **Docker** (đang chạy), **kubectl v1.34**, **kind v0.23**.

```bash
# Kiểm tra Docker đang chạy
docker info | head -n 5

# Kiểm tra kubectl
kubectl version --client
```

**Cài kind — cách 1 (khuyên dùng trên macOS):**

```bash
brew install kind
```

**Cài kind — cách 2 (tải binary trực tiếp):**

```bash
# macOS Apple Silicon (arm64):
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.23.0/kind-darwin-arm64
# macOS Intel (amd64):
# curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.23.0/kind-darwin-amd64
# Linux (amd64):
# curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.23.0/kind-$(uname -s | tr '[:upper:]' '[:lower:]')-amd64

chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind
kind --version   # mong đợi: kind version 0.23.0
```

> 💡 Lệnh tự nhận diện: `kind-$(uname -s)-$(uname -m)` — `uname -s`=Darwin/Linux, `uname -m`=arm64/x86_64.
> kind đặt tên file theo `darwin-arm64`/`darwin-amd64`/`linux-amd64`, nên với mac arm64 hãy dùng `kind-darwin-arm64` như trên.

---

## 🚀 Tạo cluster & deploy

Chạy từ thư mục `lab/` (chứa `kind-config.yaml` và thư mục `k8s/`).

**1) Tạo cluster:**

```bash
kind create cluster --config kind-config.yaml --name lab
```

Output mẫu:

```
Creating cluster "lab" ...
 ✓ Ensuring node image (kindest/node:v1.30.0) 🖼
 ✓ Preparing nodes 📦 📦 📦
 ✓ Writing configuration 📜
 ✓ Starting control-plane 🕹️
 ✓ Installing CNI 🔌
 ✓ Installing StorageClass 💾
 ✓ Joining worker nodes 🚜
Set kubectl context to "kind-lab"
```

**2) Xem node:**

```bash
kubectl get nodes
```

```
NAME                STATUS   ROLES           AGE   VERSION
lab-control-plane   Ready    control-plane   60s   v1.30.0
lab-worker          Ready    <none>          40s   v1.30.0
lab-worker2         Ready    <none>          40s   v1.30.0
```

**3) Apply toàn bộ manifest:**

```bash
# (tuỳ chọn) kiểm tra YAML hợp lệ trước khi apply thật
kubectl apply -f k8s/ --dry-run=client

kubectl apply -f k8s/
```

```
configmap/web-content created
deployment.apps/web created
service/web created
```

**4) Xem pod rải trên các node:**

```bash
kubectl get pods -o wide
```

```
NAME                   READY   STATUS    RESTARTS   AGE   IP           NODE          ...
web-6c9d8f7b5c-2kq9p   1/1     Running   0          20s   10.244.1.3   lab-worker    ...
web-6c9d8f7b5c-8x4rt   1/1     Running   0          20s   10.244.2.4   lab-worker2   ...
web-6c9d8f7b5c-pn7vz   1/1     Running   0          20s   10.244.1.4   lab-worker    ...
```

> 👀 Cột `NODE` cho thấy 3 pod nằm trên các worker khác nhau.

**5) Xem Service:**

```bash
kubectl get svc web
```

```
NAME   TYPE       CLUSTER-IP      EXTERNAL-IP   PORT(S)        AGE
web    NodePort   10.96.120.45    <none>        80:30080/TCP   30s
```

**6) Truy cập từ máy host:**

```bash
curl localhost:8080
```

```html
<!DOCTYPE html>
<html lang="vi">
  ...
  <h1>Xin chào từ Kubernetes 🚢</h1>
  ...
```

Hoặc mở trình duyệt: <http://localhost:8080> 🎉

---

## 🔍 Quan sát & thí nghiệm

### 🔬 Xem chi tiết & log

```bash
# Lấy tên 1 pod cụ thể
kubectl get pods

# Mô tả chi tiết (events, probe, volume mount, node...)
kubectl describe pod <tên-pod>

# Xem log nginx
kubectl logs <tên-pod>

# Theo dõi log realtime
kubectl logs -f <tên-pod>
```

Trong `describe` để ý mục **Events** (lịch sử pull image, schedule, probe) và **Mounts**
(thấy ConfigMap `web-content` mount vào `/usr/share/nginx/html`).

### 💚 Self-heal (tự chữa lành)

```bash
# Xoá 1 pod bất kỳ
kubectl delete pod <tên-pod>

# Xem ngay lập tức
kubectl get pods
```

Bạn sẽ thấy pod vừa xoá biến mất và **một pod MỚI** xuất hiện (tên khác) — vì Deployment
luôn reconcile về desired state = 3 replica. Đây là sức mạnh "desired state" của K8s.

### 📈 Scaling

```bash
kubectl scale deploy web --replicas=5
kubectl get pods        # thấy 5 pod
kubectl scale deploy web --replicas=3   # thu lại 3
```

### 🔄 Rolling update + rollback

```bash
# Cách A (KHUYẾN NGHỊ — nhanh, chắc chắn): buộc cuốn chiếu lại pod với image hiện có.
# Dùng khi đổi ConfigMap/Secret, hoặc chỉ để xem cơ chế rolling update.
kubectl rollout restart deploy/web

# Theo dõi quá trình cuốn chiếu
kubectl rollout status deploy/web
kubectl get pods            # thấy pod cũ Terminating, pod mới Running thay dần

# Lịch sử & quay lui nếu bản mới hỏng
kubectl rollout history deploy/web
kubectl rollout undo deploy/web
```

```bash
# Cách B (đổi image THẬT sang tag khác):
kubectl set image deploy/web nginx=nginx:1.27
kubectl rollout status deploy/web --timeout=180s
```

> ⚠️ Cách B đổi sang tag `nginx:1.27` (khác `1.27-alpine` đang chạy) nên node kind phải **kéo image mới
> từ Docker Hub** — lần đầu có thể mất 1-2 phút, `rollout status` để timeout cao (`--timeout=180s`).
> Nếu thấy "timed out waiting" chỉ là chờ pull lâu, KHÔNG phải hỏng: đợi thêm hoặc
> `kubectl get pods` xem pod mới đang `ContainerCreating`. Muốn quay lại tag nhẹ: `kubectl rollout undo deploy/web`.

> Vì `maxUnavailable: 0` nên trong lúc update luôn đủ pod phục vụ → không downtime.

### 🔁 Port-forward (không qua NodePort)

```bash
# Chuyển tiếp cổng 8081 trên máy -> cổng 80 của Service
kubectl port-forward svc/web 8081:80
# Mở tab khác: curl localhost:8081
```

Hữu ích khi không muốn (hoặc không thể) mở NodePort; truy cập trực tiếp service từ máy dev.

---

## 🧠 Khái niệm cốt lõi

| Khái niệm | Tóm tắt nhanh |
|---|---|
| **Pod** | Đơn vị nhỏ nhất, 1+ container chung network/volume. Pod là "phù du" (chết là tạo mới, IP đổi). |
| **ReplicaSet** | Đảm bảo luôn có đúng N pod. Ít khi tạo trực tiếp. |
| **Deployment** | Quản lý ReplicaSet → cho rolling update, rollback, scaling. **Bạn dùng cái này.** |
| **Service ClusterIP** | IP nội bộ ổn định, chỉ trong cluster. Mặc định. |
| **Service NodePort** | Mở cổng 30000–32767 trên mọi node → truy cập từ ngoài. |
| **Service LoadBalancer** | Nhờ cloud cấp LB ngoài (kind không có sẵn). |
| **ConfigMap** | Cấu hình/nội dung dạng thường (không bí mật), bơm qua env hoặc volume. |
| **readinessProbe** | "Sẵn sàng nhận traffic chưa?" Fail → tách khỏi Service, **không** restart. |
| **livenessProbe** | "Còn sống không?" Fail → **restart** container. |
| **requests** | Mức tài nguyên tối thiểu để scheduler xếp pod lên node. |
| **limits** | Trần cứng. Vượt memory → **OOMKilled**; vượt cpu → bị **throttle**. |
| **Rolling update** | Thay pod dần (maxSurge/maxUnavailable) → không downtime. |
| **Rollback** | `rollout undo` quay về ReplicaSet bản trước. |
| **Desired state / reconciliation** | Bạn khai báo "muốn gì", controller liên tục đưa thực tế về đúng mong muốn. |

---

## 💪 Bài tập mở rộng

1. **HorizontalPodAutoscaler (HPA):** cài `metrics-server` rồi tạo HPA tự scale theo CPU:
   ```bash
   kubectl autoscale deploy web --cpu-percent=50 --min=3 --max=8
   kubectl get hpa
   ```
   (Trên kind cần cài metrics-server, có thể phải thêm flag `--kubelet-insecure-tls`.)

2. **Secret + env:** tạo 1 Secret và inject vào container qua biến môi trường:
   ```bash
   kubectl create secret generic web-secret --from-literal=API_KEY=abc123
   ```
   Sau đó thêm `envFrom`/`valueFrom: secretKeyRef` vào `deployment.yaml`, apply lại,
   rồi `kubectl exec <pod> -- printenv API_KEY`.

3. **Làm liveness fail → CrashLoopBackOff:** đổi `livenessProbe.httpGet.path` thành `/khong-ton-tai`,
   apply lại và xem `kubectl get pods` → STATUS chuyển `CrashLoopBackOff` vì kubelet cứ restart.
   Nhớ trả lại `/` sau khi quan sát.

4. **Thêm sidecar container:** thêm 1 container thứ 2 (vd `busybox` chạy vòng lặp ghi log)
   vào cùng pod để thực hành multi-container pod (chung network/volume).

---

## 🧹 Dọn dẹp

```bash
# Xoá riêng resource của lab (giữ cluster)
kubectl delete -f k8s/

# Xoá luôn cả cluster kind (giải phóng container Docker)
kind delete cluster --name lab
```

---

## 🎤 Liên hệ câu phỏng vấn

**1) Deployment vs StatefulSet khác gì?**
Deployment dành cho ứng dụng **stateless**, pod giống hệt nhau, tên ngẫu nhiên, thay thế thoải mái.
StatefulSet dành cho **stateful** (DB...), pod có **danh tính ổn định** (tên `app-0`, `app-1`),
khởi động/thu hồi theo thứ tự, mỗi pod gắn 1 PersistentVolume riêng và có DNS ổn định.

**2) Các loại Service?**
**ClusterIP** (mặc định, nội bộ cluster), **NodePort** (mở cổng trên mọi node để truy cập từ ngoài),
**LoadBalancer** (cloud cấp LB ngoài), và **ExternalName** (ánh xạ tới một DNS bên ngoài). Ingress thì
nằm trên Service, route HTTP theo host/path.

**3) Liveness vs Readiness probe?**
**Liveness** = "còn sống không?", fail → **restart** container (chữa treo/deadlock).
**Readiness** = "sẵn sàng nhận request chưa?", fail → **tách khỏi Service** (ngừng nhận traffic) nhưng
KHÔNG restart. Có thêm **startupProbe** cho app khởi động chậm.

**4) Requests vs Limits gây ra gì?**
**requests** quyết định scheduler xếp pod lên node nào (đặt chỗ tài nguyên).
**limits** là trần: vượt **memory limit** → pod bị **OOMKilled**; vượt **cpu limit** → bị **throttle** (bóp ga, không bị giết).
Đặt requests quá cao → tốn chỗ; quá thấp → node bị quá tải.

**5) Rolling update hoạt động sao?**
Deployment tạo **ReplicaSet mới**, tăng dần pod mới và giảm dần pod cũ theo `maxSurge`/`maxUnavailable`,
chỉ chuyển traffic khi pod mới **Ready** (readiness probe). Nếu hỏng → `kubectl rollout undo` quay về
ReplicaSet cũ. Nhờ vậy cập nhật **không downtime**.

**6) ConfigMap vs Secret?**
Cả hai bơm cấu hình vào pod (env hoặc volume). **ConfigMap** cho dữ liệu **thường** (URL, flag, file config).
**Secret** cho dữ liệu **nhạy cảm** (mật khẩu, token, key) — được mã hoá base64 khi lưu và có thể bật
encryption-at-rest, kiểm soát truy cập (RBAC) chặt hơn. Lưu ý base64 **không** phải mã hoá an toàn.
