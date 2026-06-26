# ⚡ Rapid-fire — Tuần 8: Kubernetes

> Câu hỏi nhanh, đáp án ngắn để **ôn cấp tốc trước phỏng vấn**. Trả lời TO THÀNH TIẾNG rồi mở đáp án so. Thuật ngữ giữ tiếng Anh.

## 🧭 Architecture

**1. Control plane gồm gì?**
API Server (cổng vào mọi thao tác), etcd (kho trạng thái key-value), Scheduler (chọn node cho pod), Controller Manager (vòng lặp điều hoà trạng thái). Quản lý "mong muốn vs thực tế".

**2. Node có gì?**
kubelet (chạy & báo cáo pod), kube-proxy (định tuyến Service), container runtime (containerd). kubelet nhận spec từ API Server và đảm bảo container đúng như mong muốn.

**3. Mô hình "declarative + reconciliation" nghĩa là?**
Ta khai báo **trạng thái mong muốn** (YAML), controller liên tục so sánh với thực tế và hành động để khớp. Pod chết → tự tạo lại; đây là cốt lõi self-healing.

**4. etcd là gì? Vì sao quan trọng?**
Kho lưu trữ phân tán (Raft) chứa toàn bộ trạng thái cluster. Mất etcd = mất cluster → phải backup. Mọi object đều đọc/ghi qua API Server vào etcd.

## 🧩 Pod, ReplicaSet, Deployment

**5. Pod là gì? Vì sao là đơn vị nhỏ nhất?**
Pod = một nhóm container chia sẻ network (cùng IP) + volume, luôn cùng node. Đơn vị triển khai nhỏ nhất; thường 1 container chính + sidecar phụ.

**6. ReplicaSet vs Deployment?**
ReplicaSet giữ đúng số replica của pod. Deployment quản lý ReplicaSet và thêm rolling update/rollback. Ta hầu như luôn dùng Deployment, không tạo ReplicaSet tay.

**7. Rolling update zero-downtime cần gì?**
Deployment thay pod từ từ (maxSurge/maxUnavailable) + readiness probe để chỉ route khi pod sẵn sàng + graceful shutdown (preStop + SIGTERM) để không rớt request đang xử lý.

**8. Vì sao Pod nên ephemeral/stateless?**
Pod bị xoá/tái tạo bất cứ lúc nào (scale, reschedule, node chết), IP đổi. State phải nằm ngoài (DB, PV) và truy cập qua Service ổn định.

## 🌐 Service, Ingress, Config

**9. Các loại Service?**
ClusterIP (nội bộ, mặc định), NodePort (mở cổng trên mọi node), LoadBalancer (LB của cloud), ExternalName (CNAME). Service cho IP/DNS ổn định trỏ tới nhóm pod đổi liên tục.

**10. Service tìm pod bằng cách nào?**
Qua **label selector** khớp label của pod → tạo tập Endpoints. kube-proxy load-balance request tới các pod đó. Pod đến/đi, Endpoints tự cập nhật.

**11. Ingress khác Service LoadBalancer?**
Ingress là L7 (HTTP) routing theo host/path qua **một** entry point + TLS, do Ingress Controller (nginx, traefik) thực thi. Tiết kiệm so với tạo nhiều LoadBalancer L4.

**12. ConfigMap vs Secret?**
Cả hai inject cấu hình (env/volume). ConfigMap cho dữ liệu thường; Secret cho dữ liệu nhạy cảm (chỉ base64, nên bật encryption-at-rest + RBAC). Tách config khỏi image.

## ❤️ Probes, Resources, HPA

**13. Liveness vs Readiness vs Startup probe?**
Liveness: fail → restart container (treo/deadlock). Readiness: fail → ngừng route traffic (chưa sẵn sàng nhưng còn sống). Startup: bảo vệ app khởi động chậm khỏi bị liveness giết oan.

**14. requests vs limits?**
requests: tài nguyên đảm bảo, Scheduler dùng để xếp pod. limits: trần — vượt CPU bị throttle, vượt memory bị OOM-kill. Đặt sai → pod bị giết hoặc node quá tải.

**15. QoS classes ảnh hưởng gì khi node thiếu RAM?**
Guaranteed (requests=limits) bị giết sau cùng; Burstable ở giữa; BestEffort (không đặt gì) bị evict đầu tiên. Quyết định thứ tự khi node bị memory pressure.

**16. HPA scale dựa trên gì?**
Tự tăng/giảm số replica theo metric (CPU/memory hoặc custom). Cần metrics-server. Lưu app phải stateless để scale ngang; đặt requests đúng để % CPU có nghĩa.

## 🗄️ StatefulSet, Job, RBAC, Storage

**17. StatefulSet khác Deployment?**
Cho app có trạng thái (DB): pod có **danh tính ổn định** (tên cố định `app-0,1,2`), PV riêng theo pod, khởi động/scale theo thứ tự. Deployment thì pod vô danh, thay thế tự do.

**18. PV vs PVC vs StorageClass?**
PV: tài nguyên lưu trữ thật. PVC: yêu cầu lưu trữ của ứng dụng. StorageClass: provisioner cấp PV động khi có PVC. App xin qua PVC, không cần biết hạ tầng bên dưới.

**19. Job vs CronJob vs DaemonSet?**
Job: chạy tới khi hoàn thành (batch). CronJob: Job theo lịch cron. DaemonSet: đúng một pod trên **mỗi** node (log agent, monitoring). Khác Deployment ở mục đích chạy.

**20. RBAC gồm những gì?**
Role/ClusterRole (tập quyền trên resource) + RoleBinding/ClusterRoleBinding (gán cho user/group/ServiceAccount). Nguyên tắc least privilege; pod dùng ServiceAccount để gọi API.

---

### 🎯 Tự kiểm tra
Trơn tru ≥ 16/20 là nắm chắc Kubernetes. Lắp bắp câu nào → mở [`CO-BAN.md`](CO-BAN.md) / [`README.md`](README.md) / [`DEEP-DIVE.md`](DEEP-DIVE.md) / làm [`lab`](lab/) ôn lại.
