# 10 · Docker & Kubernetes — Java Backend

> Deploy ứng dụng thời cloud-native. Hay hỏi khi phỏng vấn backend. Đọc xong làm quiz **🐳 DevOps**.

---

## 1. Container vs Máy ảo (VM)

| | VM | Container |
|--|----|-----------|
| Ảo hoá | Cả HĐH khách (hypervisor) | Chỉ app + thư viện (chung kernel host) |
| Cô lập | Mạnh (kernel riêng) | Yếu hơn (chung kernel, dùng namespace + cgroup) |
| Kích thước | GB | MB |
| Khởi động | Phút | Giây |

> Container nhẹ nhờ **chia sẻ kernel host**, cô lập bằng **namespace** (tách process/network/mount) + **cgroup** (giới hạn CPU/RAM). Đổi lại cô lập yếu hơn VM.

---

## 2. Docker image & layer

- Image = xếp chồng các **layer chỉ-đọc** (union filesystem, copy-on-write).
- Mỗi chỉ thị Dockerfile (`RUN`/`COPY`…) sinh **một layer**, được **cache**.
- Build lại chỉ chạy **từ layer đầu tiên thay đổi** trở đi → đặt lệnh **ít đổi** (cài dependency) TRƯỚC lệnh **hay đổi** (`COPY` source) để tận dụng cache.
- Nhiều image chia sẻ layer chung (cùng base) → tiết kiệm ổ đĩa & pull nhanh.

### Multi-stage build

```dockerfile
FROM maven AS build
COPY . . && RUN mvn package        # stage build: có compiler + dependency
FROM eclipse-temurin:21-jre AS run
COPY --from=build /app/target/app.jar .   # chỉ copy artifact
ENTRYPOINT ["java","-jar","app.jar"]
```

→ Image cuối **chỉ có JRE + jar**, không chứa Maven/mã nguồn → nhỏ, bề mặt tấn công thấp.

### CMD vs ENTRYPOINT

- **ENTRYPOINT:** lệnh cố định (container như executable). `docker run img extra` → `extra` thành **tham số** cho entrypoint.
- **CMD:** tham số/lệnh mặc định, bị **override** hoàn toàn nếu truyền lệnh khi run.
- Mẫu: `ENTRYPOINT ["java","-jar","app.jar"]` + `CMD ["--spring.profiles.active=prod"]`. Dùng **dạng exec (JSON array)** để container nhận `SIGTERM` đúng (shutdown mượt).

---

## 3. Container ephemeral & Volume

Lớp ghi của container là **tạm thời** — xoá container là mất. Dữ liệu bền (DB, upload) phải để ngoài:

- **Volume** (Docker quản lý, khuyên dùng) hoặc **bind mount** (map thư mục host).
- Nguyên tắc: container **stateless**, trạng thái đẩy ra volume/DB ngoài.

---

## 4. Kubernetes — các đối tượng cốt lõi

### Pod

Đơn vị **nhỏ nhất** K8s quản lý (không phải container). Một pod = 1 container chính (+ sidecar tuỳ chọn) **chia sẻ**: network namespace (gọi nhau qua `localhost`, chung IP) + volume. Pod **ephemeral** — chết thì tạo pod mới (IP đổi).

### Deployment

Khai báo **trạng thái mong muốn** (số replica, image) và tự duy trì qua **ReplicaSet**:
- Pod chết → tạo lại.
- Scale bằng đổi `replicas`.
- Nâng cấp image bằng **rolling update** (thay dần pod, không downtime) + **rollback** khi lỗi.

> **StatefulSet** cho ứng dụng có trạng thái (DB) cần danh tính ổn định + storage riêng.

### Service

Pod IP đổi liên tục → Service cho **điểm truy cập ổn định** (DNS + ClusterIP ảo) + **load balance** tới pod khớp label:

- **ClusterIP** (mặc định, chỉ trong cluster) → **NodePort** (mở cổng trên mọi node) → **LoadBalancer** (LB cloud) → **Ingress** (định tuyến HTTP theo host/path, tiết kiệm LB).

---

## 5. Health check: Liveness vs Readiness probe

| Probe | Kiểm gì | Fail → làm gì |
|-------|---------|---------------|
| **Liveness** | Pod còn SỐNG (không treo/deadlock)? | **RESTART** pod |
| **Readiness** | Pod SẴN SÀNG nhận traffic chưa? | **Gỡ khỏi Service endpoints** (KHÔNG restart) |

> Điểm hay nhầm: readiness fail **không** restart — chỉ ngừng gửi traffic (vd pod đang khởi động/quá tải). Đặt liveness quá nhạy → restart lặp vô ích.

---

## 6. ConfigMap & Secret

Tách **cấu hình** ra khỏi image (12-factor):
- **ConfigMap:** config phi bí mật (URL, feature flag).
- **Secret:** dữ liệu nhạy cảm (mật khẩu, token). ⚠️ Secret chỉ **encode base64** — **KHÔNG phải mã hoá bảo mật** (ai cũng decode được). Cần bật **encryption-at-rest + RBAC** mới an toàn.

Nạp vào pod qua **env** hoặc **volume** → cùng một image chạy mọi môi trường, chỉ đổi config bên ngoài.

---

## 7. Autoscaling

- **HPA (Horizontal Pod Autoscaler):** tự tăng/giảm **số pod** theo metric (CPU/memory/custom) → co giãn ngang theo tải.
- **VPA (Vertical):** chỉnh **tài nguyên** (CPU/RAM) của từng pod.
- **Cluster Autoscaler:** thêm/bớt **node**.

> HPA cần đặt **resource requests** hợp lý để tính đúng % sử dụng.

---

## 8. Vì sao ứng dụng phải stateless (12-factor)

Pod bị giết & tạo lại bất cứ lúc nào (scale, rolling update, node chết). Nếu app giữ session/cache/file **cục bộ** trong pod → mất khi pod chết, và request cùng user rơi vào pod khác sẽ hỏng.

→ **Stateless:** đẩy trạng thái ra ngoài (session → Redis, file → S3/volume, dữ liệu → DB) → mọi pod tương đương, scale/thay tự do.

---

## 9. Câu hỏi phỏng vấn hay gặp

1. Container khác VM thế nào? Cô lập bằng gì?
2. Image layer mang lại lợi ích gì? Đặt lệnh Dockerfile thế nào để tận dụng cache?
3. Multi-stage build để làm gì?
4. CMD vs ENTRYPOINT?
5. Pod là gì? Deployment khác Pod và cho gì?
6. Service giải quyết vấn đề gì? Kể các loại.
7. Liveness vs readiness probe — fail thì K8s làm gì?
8. Secret có được mã hoá không? (bẫy: chỉ base64!)
9. HPA làm gì? Khác VPA/Cluster Autoscaler?
10. Vì sao app chạy container phải stateless?

> Làm tiếp: tab **🧠 Tư duy → 🐳 DevOps**.
