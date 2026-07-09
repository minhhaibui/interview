/**
 * Ngân hàng "🐳 DevOps" — Docker & Kubernetes KHÁI NIỆM cho phỏng vấn Backend.
 * (Khác mode 🖥️ CLI vốn hỏi câu LỆNH; đây hỏi kiến thức nền tảng container & orchestration.)
 *
 * Mỗi câu: { id, topic, q, options:[...], answer:idx, explain }
 */
window.DEVOPS_QUIZ = [
  {
    id: 'devops-container-vm', topic: 'Docker / Container',
    q: 'Container khác máy ảo (VM) ở điểm cốt lõi nào?',
    options: [
      'Container chạy chậm hơn VM',
      'Container CHIA SẺ kernel của host (chỉ đóng gói app + thư viện) → nhẹ, khởi động trong giây; VM ảo hoá cả HĐH khách trên hypervisor → nặng, khởi động lâu',
      'VM nhẹ hơn container',
      'Container cần một HĐH riêng cho mỗi app',
    ], answer: 1,
    explain: 'VM: hypervisor ảo hoá phần cứng, mỗi VM chạy MỘT HĐH khách đầy đủ → cô lập mạnh nhưng nặng (GB, khởi động phút). Container: dùng chung kernel host, chỉ đóng gói app + dependency, cô lập bằng namespace + cgroup của Linux → nhẹ (MB, khởi động giây), mật độ cao. Đổi lại cô lập yếu hơn VM (chung kernel).',
  },
  {
    id: 'devops-image-layer', topic: 'Docker / Image',
    q: 'Docker image gồm nhiều LAYER — điều đó mang lại lợi ích gì?',
    options: [
      'Không có lợi ích gì',
      'Mỗi lệnh Dockerfile tạo một layer bất biến; các layer được CACHE & CHIA SẺ giữa image → build nhanh (chỉ build lại layer đổi), tiết kiệm dung lượng & băng thông (pull layer đã có thì bỏ qua)',
      'Layer làm image chạy chậm hơn',
      'Mỗi layer là một container riêng',
    ], answer: 1,
    explain: 'Image = xếp chồng các layer chỉ-đọc (union filesystem, copy-on-write). Mỗi chỉ thị Dockerfile (RUN/COPY…) sinh 1 layer. Docker CACHE layer: build lại chỉ chạy từ layer ĐẦU TIÊN thay đổi trở đi. Nhiều image chia sẻ layer chung (vd cùng base) → tiết kiệm ổ đĩa & pull nhanh. Bài học: đặt lệnh ít đổi (cài dependency) TRƯỚC lệnh hay đổi (COPY source) để tận dụng cache.',
  },
  {
    id: 'devops-multistage', topic: 'Docker / Dockerfile',
    q: 'Multi-stage build trong Dockerfile để làm gì?',
    options: [
      'Chạy nhiều container',
      'Dùng một stage để BUILD (có compiler, dependency dev) rồi CHỈ COPY artifact sang stage runtime gọn nhẹ → image cuối nhỏ, không chứa công cụ build & mã nguồn',
      'Tăng số layer cho vui',
      'Build song song nhiều CPU',
    ], answer: 1,
    explain: 'Multi-stage: FROM ... AS build (cài JDK/Maven, build ra .jar) rồi FROM eclipse-temurin:jre AS run + COPY --from=build /app.jar . → image cuối chỉ có JRE + jar, KHÔNG có Maven/mã nguồn/dependency build → nhỏ hơn nhiều, bề mặt tấn công thấp. Đây là best practice đóng gói ứng dụng biên dịch (Java/Go).',
  },
  {
    id: 'devops-volume', topic: 'Docker / Storage',
    q: 'Vì sao cần volume trong Docker?',
    options: [
      'Để container chạy nhanh hơn',
      'Container vốn EPHEMERAL — xoá container là mất dữ liệu ghi trong nó. Volume (hoặc bind mount) lưu dữ liệu BÊN NGOÀI vòng đời container → giữ được dữ liệu DB/upload qua các lần restart/deploy',
      'Volume làm image nhỏ hơn',
      'Không cần volume, dữ liệu tự bền',
    ], answer: 1,
    explain: 'Lớp ghi của container là tạm thời — xoá container thì mất. Muốn dữ liệu bền (database, file upload): dùng VOLUME (Docker quản lý, khuyên dùng) hoặc BIND MOUNT (map thư mục host). Nhờ đó nâng cấp/thay container mà dữ liệu còn nguyên. Nguyên tắc: container phải STATELESS, trạng thái đẩy ra volume/DB ngoài.',
  },
  {
    id: 'devops-cmd-entrypoint', topic: 'Docker / Dockerfile',
    q: 'CMD và ENTRYPOINT trong Dockerfile khác nhau ra sao?',
    options: [
      'Giống hệt nhau',
      'ENTRYPOINT: lệnh CỐ ĐỊNH luôn chạy (container như một executable). CMD: tham số/lệnh MẶC ĐỊNH, dễ bị ghi đè khi `docker run image <args>`. Thường ENTRYPOINT đặt binary, CMD đặt tham số mặc định',
      'CMD chạy trước ENTRYPOINT',
      'ENTRYPOINT chỉ dùng cho shell',
    ], answer: 1,
    explain: 'ENTRYPOINT: điểm vào cố định — `docker run img extra` thì extra thành THAM SỐ cho entrypoint. CMD: bị THAY THẾ hoàn toàn nếu truyền lệnh khi run. Mẫu phổ biến: ENTRYPOINT ["java","-jar","app.jar"] + CMD ["--spring.profiles.active=prod"] (đổi profile bằng cách override CMD). Dùng dạng exec (JSON array) để nhận tín hiệu dừng (SIGTERM) đúng.',
  },
  {
    id: 'devops-k8s-pod', topic: 'Kubernetes / Pod',
    q: 'Pod trong Kubernetes là gì?',
    options: [
      'Một máy chủ vật lý',
      'Đơn vị triển khai NHỎ NHẤT: một hoặc nhiều container CHIA SẺ network (cùng IP/port space) và storage, luôn được lên lịch cùng nhau trên một node',
      'Một cluster con',
      'Tên khác của container',
    ], answer: 1,
    explain: 'Pod là đơn vị nhỏ nhất K8s quản lý (không phải container). Một pod thường có 1 container chính, đôi khi thêm sidecar (log/proxy). Các container trong pod CHIA SẺ: cùng network namespace (gọi nhau qua localhost, chung IP), volume chung. Pod là EPHEMERAL — chết thì controller tạo pod MỚI (IP đổi) → vì thế cần Service làm điểm truy cập ổn định.',
  },
  {
    id: 'devops-k8s-deploy', topic: 'Kubernetes / Deployment',
    q: 'Deployment khác Pod thế nào và cho gì?',
    options: [
      'Deployment là một pod đặc biệt',
      'Deployment KHAI BÁO trạng thái mong muốn (số replica, image) và tự duy trì qua ReplicaSet: pod chết thì tạo lại, hỗ trợ ROLLING UPDATE & ROLLBACK không downtime',
      'Deployment chỉ chạy một pod',
      'Pod quản lý Deployment',
    ], answer: 1,
    explain: 'Tự tạo Pod trần thì pod chết là hết. Deployment (qua ReplicaSet) duy trì ĐÚNG số replica mong muốn: pod chết → tạo lại; scale bằng đổi replicas; nâng cấp image bằng ROLLING UPDATE (thay dần pod, không downtime) và ROLLBACK về bản cũ nếu lỗi. Đây là cách chuẩn chạy ứng dụng stateless. StatefulSet cho ứng dụng có trạng thái (DB) cần danh tính ổn định.',
  },
  {
    id: 'devops-k8s-service', topic: 'Kubernetes / Service',
    q: 'Service trong K8s giải quyết vấn đề gì?',
    options: [
      'Chạy container',
      'Pod ephemeral, IP đổi liên tục → Service cho một ĐIỂM TRUY CẬP ỔN ĐỊNH (tên DNS + IP ảo) và LOAD BALANCE tới các pod khớp label. Loại: ClusterIP (nội bộ), NodePort, LoadBalancer',
      'Lưu trữ dữ liệu',
      'Đóng gói image',
    ], answer: 1,
    explain: 'Pod có thể chết/tạo lại với IP mới → không thể gọi trực tiếp IP pod. Service dùng label selector gom nhóm pod, cung cấp tên DNS + ClusterIP ảo cố định, và cân bằng tải giữa các pod. ClusterIP (mặc định, chỉ trong cluster) → NodePort (mở cổng trên mọi node) → LoadBalancer (LB của cloud) → Ingress (định tuyến HTTP theo host/path, tiết kiệm LB).',
  },
  {
    id: 'devops-k8s-probe', topic: 'Kubernetes / Probe',
    q: 'Liveness probe và readiness probe khác nhau ra sao?',
    options: [
      'Giống nhau',
      'Liveness: pod còn SỐNG không — fail thì K8s RESTART pod (thoát deadlock/treo). Readiness: pod đã SẴN SÀNG nhận traffic chưa — fail thì TẠM GỠ khỏi Service (không restart), vd đang khởi động/quá tải',
      'Cả hai đều restart pod',
      'Readiness restart, liveness gỡ traffic',
    ], answer: 1,
    explain: 'Liveness probe: kiểm pod có bị treo/deadlock không → FAIL → K8s giết & tạo lại pod. Readiness probe: kiểm pod đã sẵn sàng phục vụ chưa (đã nạp xong, kết nối DB ok) → FAIL → K8s LOẠI pod khỏi endpoints của Service (ngừng gửi traffic) nhưng KHÔNG restart → tránh gửi request vào pod chưa sẵn sàng/đang quá tải. Đặt sai liveness (quá nhạy) có thể gây restart lặp.',
  },
  {
    id: 'devops-k8s-config', topic: 'Kubernetes / Config',
    q: 'ConfigMap và Secret dùng để làm gì?',
    options: [
      'Chạy pod',
      'Tách CẤU HÌNH ra khỏi image: ConfigMap cho config thường (key-value, file), Secret cho dữ liệu nhạy cảm (mật khẩu, token — mã hoá base64, kiểm soát truy cập); nạp vào pod qua env hoặc volume → đổi config không cần build lại image',
      'Lưu trữ database',
      'Cân bằng tải',
    ], answer: 1,
    explain: 'Không nhét config/secret vào image (mỗi môi trường một bản, lộ secret). ConfigMap: cấu hình phi bí mật (URL, feature flag). Secret: mật khẩu/token/cert (base64, nên bật encryption-at-rest + RBAC). Cả hai inject vào pod qua biến môi trường hoặc mount volume → cùng một image chạy mọi môi trường, chỉ đổi config bên ngoài (12-factor app).',
  },
  {
    id: 'devops-k8s-hpa', topic: 'Kubernetes / Autoscale',
    q: 'HPA (Horizontal Pod Autoscaler) làm gì?',
    options: [
      'Tăng RAM cho một pod',
      'Tự động TĂNG/GIẢM SỐ POD (replica) theo tải (CPU/memory hoặc metric tuỳ chỉnh) → co giãn ngang khớp lưu lượng; khác VPA (chỉnh tài nguyên của từng pod)',
      'Xoá cluster khi rảnh',
      'Chỉ chạy khi deploy',
    ], answer: 1,
    explain: 'HPA theo dõi metric (mặc định CPU utilization, hoặc memory/custom metric) và tự điều chỉnh SỐ replica của Deployment trong khoảng min–max → scale NGANG theo tải (thêm pod khi đông, bớt khi vắng). Khác: VPA (Vertical) chỉnh CPU/RAM của từng pod; Cluster Autoscaler thêm/bớt NODE. Cần đặt resource requests hợp lý để HPA tính đúng %.',
  },
  {
    id: 'devops-12factor', topic: 'DevOps / 12-factor',
    q: 'Nguyên tắc "stateless" cho ứng dụng chạy container quan trọng vì sao?',
    options: [
      'Để code ngắn hơn',
      'Container/pod có thể bị giết & tạo lại bất cứ lúc nào (scale, rolling update, node chết) → app KHÔNG được giữ trạng thái trong bộ nhớ/đĩa cục bộ; đẩy session/state ra Redis/DB ngoài → mọi instance thay thế được cho nhau',
      'Stateless làm app chạy nhanh hơn tuyệt đối',
      'Không quan trọng',
    ], answer: 1,
    explain: 'Trong K8s pod ephemeral: bị reschedule, scale, thay thế liên tục. Nếu app giữ session/cache/file cục bộ trong pod → mất khi pod chết, và request của cùng user rơi vào pod khác sẽ hỏng. STATELESS: đẩy trạng thái ra ngoài (session→Redis, file→S3/volume, dữ liệu→DB) → mọi pod tương đương, scale/thay tự do. Đây là nguyên tắc 12-factor app cốt lõi cho cloud-native.',
  },
];
