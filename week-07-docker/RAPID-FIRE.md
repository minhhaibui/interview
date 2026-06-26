# ⚡ Rapid-fire — Tuần 7: Docker

> Câu hỏi nhanh, đáp án ngắn để **ôn cấp tốc trước phỏng vấn**. Trả lời TO THÀNH TIẾNG rồi mở đáp án so. Thuật ngữ giữ tiếng Anh.

## 📦 Container vs VM & Kiến trúc

**1. Container khác VM ở đâu?**
Container chia sẻ kernel host, chỉ đóng gói process + dependency → nhẹ, khởi động mili-giây. VM ảo hoá cả OS qua hypervisor → nặng, cách ly mạnh hơn, khởi động chậm.

**2. Container thực chất là gì trên host?**
Chỉ là **process** bị cô lập bằng namespaces (PID, net, mount, user…) + giới hạn tài nguyên bằng cgroups. Không có "máy ảo" nào — chạy `ps` trên host vẫn thấy process đó.

**3. Image vs Container?**
Image: template chỉ-đọc, gồm các layer. Container: instance đang chạy = image + một lớp ghi (writable layer) ở trên. Một image → nhiều container.

**4. Layer & union filesystem?**
Mỗi lệnh Dockerfile tạo một layer chỉ-đọc; Docker xếp chồng (overlayfs). Layer được cache và chia sẻ giữa image → tiết kiệm dung lượng và thời gian build.

## 📝 Dockerfile best practices

**5. Vì sao COPY package.json trước rồi mới COPY source?**
Tận dụng layer cache: chỉ khi `package*.json` đổi thì `npm ci` mới chạy lại. Đổi source code không làm mất cache cài dependency → build nhanh.

**6. `RUN`, `CMD`, `ENTRYPOINT` khác gì?**
RUN: chạy lúc build (tạo layer). CMD: lệnh mặc định lúc chạy (dễ bị override). ENTRYPOINT: chương trình cố định lúc chạy; CMD thành tham số cho nó.

**7. Multi-stage build lợi gì?**
Stage build có toolchain (compiler, devDeps) nặng; stage runtime chỉ copy artifact cần thiết → image cuối nhỏ, ít lỗ hổng, không lộ source/build tool.

**8. `COPY` vs `ADD`?**
COPY chỉ sao chép file/thư mục — rõ ràng, nên dùng mặc định. ADD thêm tự giải nén tar + tải URL → "ma thuật ngầm", chỉ dùng khi thật cần.

**9. Vì sao nên dùng base image nhỏ (alpine/slim/distroless)?**
Ít dung lượng, ít gói → ít lỗ hổng (attack surface), pull nhanh. Lưu ý alpine dùng musl libc có thể gây lỗi native module → cân nhắc slim/distroless.

**10. `.dockerignore` để làm gì?**
Loại `node_modules`, `.git`, file lớn khỏi build context → context nhỏ, build nhanh, tránh vô tình copy secret vào image.

## 🌐 Networking & Volumes

**11. Các network mode chính?**
bridge (mặc định, NAT), host (dùng chung network host, không cách ly cổng), none (không mạng), và user-defined bridge (container gọi nhau qua tên service — DNS nội bộ).

**12. Bind mount vs named volume?**
Bind mount: ánh xạ thư mục host (hợp dev hot-reload, phụ thuộc đường dẫn host). Named volume: Docker quản lý (hợp production, dữ liệu bền, portable hơn).

**13. Vì sao dữ liệu trong container "biến mất" khi xoá?**
Lớp ghi của container bị xoá cùng container. Muốn bền phải đưa ra volume/bind mount. Container nên **stateless**, state nằm ngoài.

## 🐙 docker-compose

**14. docker-compose giải bài gì?**
Khai báo nhiều service (api, db, redis…) + network + volume trong 1 file YAML, lên/xuống cả stack bằng `up`/`down`. Hợp dev và môi trường nhỏ.

**15. `depends_on` có đảm bảo DB sẵn sàng không?**
Không — chỉ đảm bảo **thứ tự khởi động**, không chờ DB *ready*. Cần healthcheck + `condition: service_healthy` hoặc retry kết nối trong app.

## 🛡️ Resource, Security, Lifecycle

**16. Healthcheck dùng làm gì?**
Lệnh định kỳ kiểm tra container còn "khoẻ" (vd gọi `/health`). Trạng thái healthy/unhealthy giúp orchestrator/compose quyết định restart hay route traffic.

**17. Vì sao chạy non-root user trong container?**
Giảm thiệt hại nếu bị thoát container (privilege escalation). Thêm `USER node` thay vì chạy root. Kết hợp read-only filesystem, drop capabilities.

**18. Resource limits (`--memory`, `--cpus`) quan trọng vì?**
Một container ngốn hết RAM/CPU sẽ ảnh hưởng cả host (noisy neighbor). Đặt limit để cô lập; vượt memory limit → bị OOM-kill.

**19. Vì sao cần PID 1 xử lý signal (tini/--init)?**
PID 1 trong container không reap zombie và không forward signal mặc định → `SIGTERM` không tới app, graceful shutdown hỏng. tini làm init process chuẩn để reap + forward.

**20. Graceful shutdown trong container Node.js làm sao?**
Bắt `SIGTERM`, ngừng nhận request mới, đóng server + connection pool, rồi `process.exit`. Đảm bảo lệnh ở dạng exec form (`["node","app.js"]`) để Node nhận signal trực tiếp.

---

### 🎯 Tự kiểm tra
Trơn tru ≥ 16/20 là nắm chắc Docker. Lắp bắp câu nào → mở [`CO-BAN.md`](CO-BAN.md) / [`README.md`](README.md) / [`DEEP-DIVE.md`](DEEP-DIVE.md) / làm [`lab`](lab/) ôn lại.
