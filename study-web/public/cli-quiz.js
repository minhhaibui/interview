/**
 * Ngân hàng "🖥️ CLI Quiz" — trắc nghiệm câu lệnh thường dùng khi làm Backend.
 * git, docker, kubectl, redis-cli, psql, linux/bash — đúng những lệnh hay bị hỏi
 * và hay gõ hằng ngày.
 *
 * Mỗi câu: { id, topic, q, options:[...], answer:idx, explain, cmd?:'...' }
 * Trường `cmd` (tuỳ chọn) là snippet shell render trong <pre><code class="language-bash"> có tô màu.
 */
window.CLI_QUIZ = [
  {
    id: 'cli-git-01', topic: 'git',
    q: 'Khác biệt giữa `git reset --soft HEAD~1` và `git reset --hard HEAD~1`?',
    options: [
      'Giống nhau hoàn toàn',
      '--soft lùi commit nhưng GIỮ thay đổi ở staging; --hard lùi commit và XOÁ luôn thay đổi ở working tree',
      '--soft xoá thay đổi, --hard giữ lại',
      '--hard chỉ đổi message commit',
    ], answer: 1,
    explain: '--soft: con trỏ branch lùi 1 commit, các thay đổi vẫn nằm trong staging (index). --mixed (mặc định): bỏ staging, giữ ở working tree. --hard: lùi commit VÀ vứt mọi thay đổi — nguy hiểm, mất dữ liệu chưa commit.',
  },
  {
    id: 'cli-git-02', topic: 'git',
    q: 'Đã push commit lên nhánh CHUNG (nhiều người dùng) và muốn hoàn tác an toàn. Nên dùng lệnh nào?',
    options: [
      'git reset --hard rồi git push --force',
      'git revert <commit> — tạo commit mới đảo ngược, không viết lại lịch sử',
      'git rebase -i để xoá commit',
      'git commit --amend',
    ], answer: 1,
    explain: 'Trên nhánh chung, KHÔNG viết lại lịch sử (reset/rebase/force-push) vì làm hỏng repo của người khác. git revert tạo một commit MỚI đảo ngược thay đổi — an toàn để push. reset/amend chỉ hợp cho commit chưa chia sẻ.',
  },
  {
    id: 'cli-git-03', topic: 'git',
    q: 'Khác biệt giữa `git fetch` và `git pull`?',
    options: [
      'Giống hệt nhau',
      'fetch chỉ TẢI dữ liệu mới về remote-tracking branch; pull = fetch + merge (hoặc rebase) vào nhánh hiện tại',
      'pull chỉ tải, fetch mới gộp',
      'fetch dùng cho push, pull dùng cho clone',
    ], answer: 1,
    explain: 'git fetch chỉ cập nhật các ref remote (origin/main…) mà KHÔNG đụng nhánh đang làm việc. git pull = fetch rồi tự merge/rebase vào nhánh hiện tại. Fetch an toàn để xem trước, pull thay đổi working tree ngay.',
  },
  {
    id: 'cli-git-04', topic: 'git',
    q: '`HEAD~2` và `HEAD^2` trỏ tới đâu?',
    options: [
      'Cả hai trỏ cùng một commit',
      'HEAD~2 = ông nội (lùi 2 đời theo first-parent); HEAD^2 = parent THỨ HAI của commit (nhánh được merge vào)',
      'HEAD~2 là parent thứ 2, HEAD^2 là lùi 2 đời',
      'Cả hai đều không hợp lệ',
    ], answer: 1,
    explain: '~n đi NGƯỢC n đời theo dòng first-parent (HEAD~2 = parent của parent). ^n chọn parent THỨ n của một commit merge (HEAD^2 = nhánh thứ hai được gộp). Phân biệt quan trọng khi thao tác với merge commit.',
  },
  {
    id: 'cli-git-05', topic: 'git',
    q: 'Đang sửa dở, cần chuyển nhánh gấp nhưng chưa muốn commit. Lệnh nào cất tạm thay đổi?',
    cmd: 'git stash',
    options: [
      'git stash (rồi git stash pop để lấy lại)',
      'git rm --cached',
      'git clean -fd',
      'git checkout -- .',
    ], answer: 0,
    explain: 'git stash cất các thay đổi (tracked) vào ngăn tạm và trả working tree về sạch để chuyển nhánh. Lấy lại bằng git stash pop (áp dụng + xoá stash) hoặc git stash apply (giữ stash). `git clean -fd` và `checkout -- .` sẽ XOÁ thay đổi.',
  },
  {
    id: 'cli-docker-01', topic: 'docker',
    q: 'Lệnh chạy container ở chế độ nền (detached) và map cổng 8080 host → 3000 container?',
    cmd: 'docker run -d -p 8080:3000 myimage',
    options: [
      'docker run -it -p 3000:8080 myimage',
      'docker run -d -p 8080:3000 myimage',
      'docker run --detach --port 8080 myimage',
      'docker start -d -p 8080:3000 myimage',
    ], answer: 1,
    explain: '-d (detached) chạy nền; -p HOST:CONTAINER nên 8080:3000 = cổng 8080 trên host trỏ vào 3000 trong container. -it là interactive (ngược với -d). `docker start` chỉ khởi động lại container đã tạo, không nhận -p.',
  },
  {
    id: 'cli-docker-02', topic: 'docker',
    q: 'Container đang chạy tên `api`. Lệnh nào mở shell bên trong nó để debug?',
    cmd: 'docker exec -it api sh',
    options: [
      'docker run -it api sh',
      'docker exec -it api sh',
      'docker attach api sh',
      'docker shell api',
    ], answer: 1,
    explain: 'docker exec chạy lệnh MỚI trong container ĐANG chạy; -it cấp terminal tương tác. docker run lại TẠO container mới từ image. docker attach gắn vào tiến trình chính (stdout) chứ không mở shell riêng.',
  },
  {
    id: 'cli-docker-03', topic: 'docker',
    q: 'Khác biệt giữa `docker ps` và `docker ps -a`?',
    options: [
      'Giống nhau',
      'docker ps chỉ hiện container ĐANG chạy; -a hiện TẤT CẢ kể cả đã dừng/thoát',
      '-a hiện image thay vì container',
      'docker ps hiện tất cả, -a lọc theo tên',
    ], answer: 1,
    explain: 'docker ps liệt kê container đang chạy. Thêm -a (--all) hiện cả container đã exit/created — hữu ích khi tìm container vừa crash để xem `docker logs`. (Image thì xem bằng `docker images`.)',
  },
  {
    id: 'cli-docker-04', topic: 'docker',
    q: 'Lệnh nào xem log (stdout/stderr) của container `worker` và theo dõi log mới theo thời gian thực?',
    cmd: 'docker logs -f worker',
    options: [
      'docker logs -f worker',
      'docker inspect worker',
      'docker tail worker',
      'docker exec worker cat /var/log',
    ], answer: 0,
    explain: 'docker logs in stdout/stderr container; -f (--follow) bám đuôi log như tail -f. docker inspect xem metadata (config/network), không phải log. Không có lệnh `docker tail`.',
  },
  {
    id: 'cli-k8s-01', topic: 'kubectl',
    q: 'Pod liên tục restart. Lệnh nào hợp nhất để xem NGUYÊN NHÂN (sự kiện, lý do kill)?',
    cmd: 'kubectl describe pod <name>',
    options: [
      'kubectl get pods',
      'kubectl describe pod <name>',
      'kubectl apply -f pod.yaml',
      'kubectl scale pod <name> --replicas=1',
    ], answer: 1,
    explain: 'kubectl describe pod hiện Events (OOMKilled, CrashLoopBackOff, probe fail, lý do kill, restart count) + trạng thái container — chỗ đầu tiên để chẩn đoán. `get pods` chỉ cho trạng thái tóm tắt. Xem log app thì thêm `kubectl logs <pod> --previous` (lần chạy trước khi crash).',
  },
  {
    id: 'cli-k8s-02', topic: 'kubectl',
    q: 'Vừa sửa ConfigMap, muốn các pod của Deployment `web` nạp lại cấu hình mà KHÔNG đổi image. Lệnh gọn nhất?',
    cmd: 'kubectl rollout restart deployment/web',
    options: [
      'kubectl delete deployment web',
      'kubectl rollout restart deployment/web',
      'kubectl apply -f web.yaml',
      'kubectl scale deployment/web --replicas=0',
    ], answer: 1,
    explain: 'kubectl rollout restart tạo rollout mới (rolling, không downtime) khiến pod được tạo lại và đọc ConfigMap/Secret mới — không cần đổi image hay sửa YAML. delete sẽ gây downtime; scale 0 thì tắt hẳn dịch vụ.',
  },
  {
    id: 'cli-k8s-03', topic: 'kubectl',
    q: 'Lệnh nào hoàn tác (rollback) một Deployment về phiên bản trước?',
    cmd: 'kubectl rollout undo deployment/web',
    options: [
      'kubectl rollout undo deployment/web',
      'kubectl delete rollout web',
      'kubectl apply --rollback',
      'kubectl get rollout web --undo',
    ], answer: 0,
    explain: 'kubectl rollout undo deployment/<name> quay về ReplicaSet của bản triển khai trước (thêm --to-revision=N để về bản cụ thể; xem lịch sử bằng rollout history). Đây là cứu cánh khi bản mới lỗi.',
  },
  {
    id: 'cli-k8s-04', topic: 'kubectl',
    q: 'Lệnh áp dụng (tạo/cập nhật) tài nguyên từ file YAML theo kiểu khai báo?',
    cmd: 'kubectl apply -f deploy.yaml',
    options: [
      'kubectl create deploy.yaml',
      'kubectl apply -f deploy.yaml',
      'kubectl run -f deploy.yaml',
      'kubectl set -f deploy.yaml',
    ], answer: 1,
    explain: 'kubectl apply -f áp dụng khai báo (declarative): tạo nếu chưa có, cập nhật nếu đã có, và lưu cấu hình để diff lần sau. `kubectl create` là mệnh lệnh (imperative), lỗi nếu tài nguyên đã tồn tại.',
  },
  {
    id: 'cli-redis-01', topic: 'redis-cli',
    q: 'Trên Redis PRODUCTION có hàng triệu key, cần tìm key theo mẫu `user:*`. Vì sao KHÔNG nên dùng `KEYS user:*`?',
    cmd: 'SCAN 0 MATCH user:* COUNT 100',
    options: [
      'KEYS không hỗ trợ wildcard',
      'KEYS quét TOÀN BỘ keyspace trong một lệnh, CHẶN Redis (single-thread) → nên dùng SCAN duyệt từng phần không chặn',
      'KEYS chỉ chạy trên replica',
      'KEYS làm mất dữ liệu',
    ], answer: 1,
    explain: 'Redis chạy đơn luồng; KEYS duyệt toàn bộ keyspace O(N) trong MỘT lệnh → block mọi client khác, có thể treo server. SCAN dùng con trỏ duyệt từng lô (cursor-based), không chặn — luôn dùng SCAN/HSCAN/SSCAN trong production.',
  },
  {
    id: 'cli-redis-02', topic: 'redis-cli',
    q: 'Lệnh nào đặt key `session` = "abc" và TỰ HẾT HẠN sau 60 giây trong một lệnh?',
    cmd: 'SET session abc EX 60',
    options: [
      'SET session abc EX 60',
      'SET session abc; EXPIRE 60',
      'SETEX session abc 60',
      'SET session abc TTL 60',
    ], answer: 0,
    explain: 'SET key value EX <giây> đặt giá trị + TTL nguyên tử trong một lệnh. (SETEX key <giây> value cũng được nhưng thứ tự tham số khác — đáp án C đảo sai thứ tự.) Không có tuỳ chọn `TTL` trong SET; TTL là lệnh ĐỌC thời gian sống còn lại.',
  },
  {
    id: 'cli-redis-03', topic: 'redis-cli',
    q: 'Lệnh nào tăng giá trị số của key `counter` lên 1 một cách nguyên tử (atomic)?',
    cmd: 'INCR counter',
    options: ['INCR counter', 'SET counter +1', 'ADD counter 1', 'UPDATE counter 1'],
    answer: 0,
    explain: 'INCR tăng giá trị (kiểu số) lên 1 nguyên tử, trả về giá trị mới — an toàn cho đếm view/rate-limit dù nhiều client cùng gọi. INCRBY để tăng theo bước; DECR/DECRBY để giảm. SET/ADD/UPDATE không phải lệnh tăng đếm của Redis.',
  },
  {
    id: 'cli-psql-01', topic: 'psql',
    q: 'Trong psql, lệnh meta nào LIỆT KÊ tất cả bảng của database hiện tại?',
    cmd: '\\dt',
    options: ['\\dt', '\\l', '\\d+', 'SHOW TABLES;'],
    answer: 0,
    explain: '\\dt liệt kê các bảng. \\l (hoặc \\list) liệt kê DATABASE. \\d <tên> mô tả một bảng (cột, index, FK). `SHOW TABLES;` là cú pháp MySQL, không có trong Postgres.',
  },
  {
    id: 'cli-psql-02', topic: 'psql',
    q: 'Muốn xem một truy vấn có dùng index hay không và chi phí THỰC TẾ khi chạy. Dùng gì?',
    cmd: 'EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 42;',
    options: [
      'EXPLAIN (chỉ ước lượng, không chạy)',
      'EXPLAIN ANALYZE (chạy thật + đo thời gian, số hàng thực)',
      'DESCRIBE SELECT ...',
      'SHOW PLAN',
    ], answer: 1,
    explain: 'EXPLAIN in kế hoạch ƯỚC LƯỢNG (không chạy). EXPLAIN ANALYZE THỰC SỰ chạy truy vấn rồi báo thời gian thật, số hàng thật, Seq Scan vs Index Scan — cách chuẩn để tìm truy vấn chậm. (Cẩn thận: ANALYZE chạy thật nên với INSERT/UPDATE phải bọc trong transaction để rollback.)',
  },
  {
    id: 'cli-bash-01', topic: 'bash',
    q: 'Lệnh nào theo dõi (bám đuôi) file log đang được ghi liên tục theo thời gian thực?',
    cmd: 'tail -f /var/log/app.log',
    options: ['tail -f /var/log/app.log', 'cat /var/log/app.log', 'head /var/log/app.log', 'less /var/log/app.log'],
    answer: 0,
    explain: 'tail -f (follow) in các dòng cuối rồi tiếp tục hiện dòng mới khi file được ghi thêm — chuẩn để theo dõi log trực tiếp. cat in toàn bộ rồi thoát; head in phần đầu; less để cuộn (nhấn F trong less cũng mô phỏng tail -f).',
  },
  {
    id: 'cli-bash-02', topic: 'bash',
    q: 'Lệnh nào tìm chuỗi "ERROR" trong mọi file `.log` của thư mục hiện tại (đệ quy)?',
    cmd: 'grep -r "ERROR" --include="*.log" .',
    options: [
      'grep ERROR *.log',
      'grep -r "ERROR" --include="*.log" .',
      'find ERROR -name "*.log"',
      'cat *.log | ERROR',
    ], answer: 1,
    explain: 'grep -r (recursive) tìm trong cây thư mục; --include="*.log" giới hạn loại file. `grep ERROR *.log` chỉ tìm ở thư mục hiện tại (không đệ quy). find dùng để tìm FILE theo tên/thuộc tính, không tìm nội dung.',
  },
  {
    id: 'cli-bash-03', topic: 'bash',
    q: 'Một tiến trình treo, đã thử dừng bình thường không được. Lệnh nào buộc kill tiến trình PID 1234?',
    cmd: 'kill -9 1234',
    options: [
      'kill -9 1234 (gửi SIGKILL — không thể bắt/bỏ qua)',
      'kill -1 1234',
      'stop 1234',
      'kill -0 1234',
    ], answer: 0,
    explain: 'kill -9 gửi SIGKILL — hệ điều hành buộc kết thúc tiến trình ngay, không cho dọn dẹp (dùng khi SIGTERM mặc định thất bại). -1 là SIGHUP (thường reload), -0 chỉ KIỂM TRA tiến trình còn sống (không gửi tín hiệu thật). Ưu tiên kill (SIGTERM) trước, -9 là phương án cuối.',
  },
  {
    id: 'cli-bash-04', topic: 'bash',
    q: 'Lệnh nào cấp quyền THỰC THI cho file `deploy.sh`?',
    cmd: 'chmod +x deploy.sh',
    options: ['chmod +x deploy.sh', 'chmod 644 deploy.sh', 'chown +x deploy.sh', 'exec deploy.sh'],
    answer: 0,
    explain: 'chmod +x thêm bit execute (cho phép chạy ./deploy.sh). 644 = rw-r--r-- (KHÔNG có execute). chown đổi CHỦ SỞ HỮU file, không phải quyền. Sau chmod +x thường chạy bằng `./deploy.sh`.',
  },
  {
    id: 'cli-git-06', topic: 'git',
    q: 'Đang sửa dở (chưa commit) thì cần đổi nhánh gấp để fix bug khác. Cách gọn để CẤT tạm thay đổi rồi lấy lại sau?',
    cmd: `git stash            # cất thay đổi, working tree sạch
git switch hotfix    # qua nhánh khác fix
git switch -         # quay lại
git stash pop        # lấy lại thay đổi`,
    options: [
      'git commit hết rồi reset sau',
      'git stash để cất tạm, git stash pop để lấy lại',
      'Xoá file rồi gõ lại',
      'git rm --cached toàn bộ',
    ], answer: 1,
    explain: 'git stash cất các thay đổi chưa commit vào ngăn tạm và trả working tree về sạch; git stash pop áp lại và xoá khỏi stash (git stash apply thì giữ lại bản stash). Hợp khi cần nhảy nhánh nhanh mà chưa muốn tạo commit dở.',
  },
  {
    id: 'cli-docker-05', topic: 'docker',
    q: 'Container đang chạy tên `api`. Muốn mở shell BÊN TRONG nó để xem file/biến môi trường. Lệnh nào?',
    cmd: 'docker exec -it api sh',
    options: [
      'docker run -it api sh (tạo container MỚI, không vào cái đang chạy)',
      'docker exec -it api sh',
      'docker attach api để gõ lệnh mới',
      'docker shell api',
    ], answer: 1,
    explain: 'docker exec chạy một tiến trình MỚI bên trong container ĐANG chạy; -it cấp terminal tương tác. `docker run` lại tạo container mới từ image (không phải cái đang chạy). `docker attach` gắn vào tiến trình chính sẵn có (PID 1), không mở shell riêng nên dễ vô tình dừng container khi Ctrl-C.',
  },
  {
    id: 'cli-k8s-05', topic: 'kubectl',
    q: 'Vừa rollout một bản deploy lỗi. Lệnh nào để QUAY VỀ bản trước đó nhanh nhất?',
    cmd: `kubectl rollout undo deployment/api
kubectl rollout status deployment/api`,
    options: [
      'kubectl delete deployment api rồi apply lại từ đầu',
      'kubectl rollout undo deployment/api',
      'kubectl scale deployment/api --replicas=0',
      'kubectl restart api',
    ], answer: 1,
    explain: 'kubectl rollout undo quay deployment về revision trước (dùng lịch sử ReplicaSet) — nhanh và không downtime. `delete` rồi apply gây gián đoạn. `scale 0` chỉ tắt pod chứ không sửa bản lỗi. Xem lịch sử bằng `kubectl rollout history deployment/api`.',
  },
  {
    id: 'cli-redis-04', topic: 'redis-cli',
    q: 'Trên Redis production có hàng triệu key, cần liệt kê các key theo pattern mà KHÔNG làm nghẽn server. Dùng lệnh nào?',
    cmd: `SCAN 0 MATCH "session:*" COUNT 100   # lặp theo cursor
# TRÁNH: KEYS session:*   (quét toàn bộ, chặn server)`,
    options: [
      'KEYS session:* — nhanh và an toàn',
      'SCAN với cursor + MATCH — duyệt từng phần, không chặn server',
      'GET session:* lấy tất cả',
      'FLUSHALL rồi tạo lại',
    ], answer: 1,
    explain: 'KEYS quét TOÀN BỘ keyspace trong một lần, chặn Redis (single-thread) → nguy hiểm trên production. SCAN duyệt tăng dần theo cursor, mỗi lần trả một ít key, không khoá server lâu (cùng họ có HSCAN/SSCAN/ZSCAN). COUNT là gợi ý số phần tử mỗi vòng.',
  },
  {
    id: 'cli-bash-05', topic: 'bash',
    q: 'Muốn tìm tiến trình đang nghe cổng 3000 (vì "address already in use"). Lệnh nào hợp lý?',
    cmd: `lsof -i :3000        # liệt kê tiến trình giữ cổng 3000
# hoặc:
kill -9 $(lsof -ti :3000)   # lấy PID rồi kill`,
    options: [
      'cat :3000',
      'lsof -i :3000 (hoặc `ss -ltnp | grep 3000`) để tìm PID đang giữ cổng',
      'ping localhost:3000',
      'grep 3000 /etc/hosts',
    ], answer: 1,
    explain: 'lsof -i :3000 liệt kê tiến trình đang mở/nghe cổng 3000; `lsof -ti :3000` chỉ in PID để truyền vào kill. Trên Linux không có lsof có thể dùng `ss -ltnp` hoặc `netstat -ltnp`. Đây là cách gỡ lỗi "EADDRINUSE / address already in use" rất hay gặp.',
  },
  {
    id: 'cli-git-07', topic: 'git',
    q: 'Bạn muốn áp dụng RIÊNG một commit (theo hash) từ nhánh khác vào nhánh hiện tại. Dùng lệnh nào?',
    cmd: 'git cherry-pick 3f9a1c2',
    options: [
      'git merge 3f9a1c2',
      'git cherry-pick 3f9a1c2',
      'git rebase 3f9a1c2',
      'git checkout 3f9a1c2',
    ], answer: 1,
    explain: 'git cherry-pick <hash> sao chép ĐÚNG một commit sang nhánh hiện tại (tạo commit mới cùng nội dung). Khác merge/rebase (gộp cả một loạt commit) và checkout (chuyển nhánh/lấy file). Hữu ích khi cần đưa một bản vá lẻ sang nhánh release.',
  },
  {
    id: 'cli-docker-06', topic: 'docker',
    q: 'Ổ đĩa đầy vì image/container/network cũ không dùng. Lệnh dọn dẹp nhanh (kể cả image không còn được tham chiếu)?',
    cmd: 'docker system prune -a',
    options: [
      'docker rm -f $(docker ps -q)',
      'docker system prune -a',
      'docker image ls',
      'docker stop $(docker ps -q)',
    ], answer: 1,
    explain: 'docker system prune dọn container dừng, network thừa, build cache và dangling image; thêm `-a` xoá cả image KHÔNG còn container nào dùng. Rất hay dùng để lấy lại dung lượng. Cẩn thận: -a có thể xoá image bạn muốn giữ nhưng chưa chạy.',
  },
  {
    id: 'cli-psql-03', topic: 'psql',
    q: 'Trong psql, xem CẤU TRÚC (cột, kiểu dữ liệu, index) của bảng `users` bằng meta-command nào?',
    cmd: '\\d users',
    options: [
      'DESCRIBE users;',
      'SHOW COLUMNS FROM users;',
      '\\d users',
      '\\list users',
    ], answer: 2,
    explain: 'Trong psql, `\\d users` hiển thị cột + kiểu + index + ràng buộc của bảng (`\\d+ users` chi tiết hơn). DESCRIBE / SHOW COLUMNS là của MySQL, không có trong PostgreSQL. `\\dt` liệt kê các bảng, `\\l` liệt kê database.',
  },
  {
    id: 'cli-psql-04', topic: 'psql',
    q: 'Sao lưu (backup) toàn bộ database `mydb` ra một file SQL?',
    cmd: 'pg_dump mydb > backup.sql',
    options: [
      'psql mydb > backup.sql',
      'pg_dump mydb > backup.sql',
      'pg_restore mydb backup.sql',
      'cp mydb backup.sql',
    ], answer: 1,
    explain: 'pg_dump xuất schema + dữ liệu ra file SQL (hoặc định dạng nén với -Fc). Khôi phục bằng `psql mydb < backup.sql` (với dump SQL thuần) hoặc `pg_restore` (với dump định dạng custom/-Fc). psql chỉ là client tương tác, không phải công cụ dump.',
  },
  {
    id: 'cli-k8s-06', topic: 'kubectl',
    q: 'Muốn truy cập tạm một pod trong cluster từ máy local (vd mở cổng 8080 → 80 của pod) để debug?',
    cmd: 'kubectl port-forward pod/mypod 8080:80',
    options: [
      'kubectl expose pod mypod',
      'kubectl port-forward pod/mypod 8080:80',
      'kubectl proxy mypod',
      'kubectl get pod mypod -o wide',
    ], answer: 1,
    explain: 'kubectl port-forward chuyển tiếp một cổng local vào pod/service trong cluster — tiện để debug nhanh mà không cần expose ra ngoài. Khác expose (tạo Service lâu dài) và proxy (proxy tới API server). Kết nối chỉ tồn tại khi lệnh còn chạy.',
  },
  {
    id: 'cli-bash-06', topic: 'bash',
    q: 'Xoá MỌI file `.tmp` nằm rải rác trong cây thư mục hiện tại (mọi cấp con)?',
    cmd: "find . -name '*.tmp' -delete",
    options: [
      "rm *.tmp",
      "find . -name '*.tmp' -delete",
      "rm -r *.tmp",
      "ls -R *.tmp",
    ], answer: 1,
    explain: '`find . -name "*.tmp" -delete` duyệt ĐỆ QUY toàn cây và xoá file khớp. `rm *.tmp` chỉ xoá ở thư mục hiện tại (glob không đệ quy). Có thể thay -delete bằng `-exec rm {} +` để chạy lệnh tuỳ ý. Nên chạy thử với `-print` trước khi -delete cho an toàn.',
  },
];
