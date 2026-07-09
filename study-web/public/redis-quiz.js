/**
 * Ngân hàng "☁️ Redis" — trắc nghiệm Redis CHUYÊN SÂU cho phỏng vấn Backend (theo khung JavaGuide).
 * Vì sao nhanh, kiểu dữ liệu, persistence (RDB/AOF), hết hạn & thu hồi bộ nhớ,
 * cache穿透/击穿/雪崩, khoá phân tán, đơn luồng, replication/sentinel/cluster, nhất quán cache-DB.
 *
 * Mỗi câu: { id, topic, q, options:[...], answer:idx, explain, cmd?:'...' (snippet lệnh Redis) }
 */
window.REDIS_QUIZ = [
  {
    id: 'redis-fast', topic: 'Redis / Cơ chế',
    q: 'Vì sao Redis nhanh dù xử lý lệnh trên MỘT luồng chính?',
    options: [
      'Vì Redis chạy trên GPU',
      'Dữ liệu nằm trong RAM (in-memory), cấu trúc dữ liệu tối ưu, đơn luồng nên không tốn chi phí khoá/chuyển ngữ cảnh, + I/O đa hồi tiếp (epoll) xử lý hàng vạn kết nối',
      'Vì Redis dùng nhiều luồng cho mọi lệnh',
      'Vì Redis ghi thẳng xuống đĩa mỗi lệnh',
    ], answer: 1,
    explain: 'Redis nhanh nhờ: (1) toàn bộ dữ liệu trong bộ nhớ; (2) cấu trúc dữ liệu hiệu quả (skiplist, hash, ziplist…); (3) xử lý lệnh ĐƠN LUỒNG → không cần khoá, không đua tranh, không chuyển ngữ cảnh; (4) I/O multiplexing (epoll/kqueue) một luồng quản nhiều socket. Redis 6+ thêm ĐA LUỒNG cho phần đọc/ghi mạng (I/O), nhưng thực thi lệnh vẫn đơn luồng.',
  },
  {
    id: 'redis-types', topic: 'Redis / Kiểu dữ liệu',
    q: 'Ghép đúng use case với kiểu dữ liệu Redis?',
    options: [
      'Mọi thứ đều dùng String',
      'String (cache/counter/INCR), Hash (object nhiều field), List (hàng đợi/timeline), Set (thành viên/khử trùng), ZSet (bảng xếp hạng có điểm)',
      'ZSet chỉ để lưu chuỗi',
      'List dùng cho khoá phân tán',
    ], answer: 1,
    explain: '5 kiểu cơ bản: String (cache giá trị, đếm INCR/DECR, bit); Hash (lưu object gọn, sửa từng field); List (danh sách 2 đầu — hàng đợi, feed, LPUSH/BRPOP); Set (tập không trùng — tag, giao/hợp); ZSet/Sorted Set (mỗi phần tử có score — leaderboard, top-N, hàng đợi ưu tiên). Ngoài ra còn Bitmap, HyperLogLog (đếm xấp xỉ UV), Geo, Stream.',
  },
  {
    id: 'redis-persist', topic: 'Redis / Persistence',
    q: 'RDB và AOF khác nhau thế nào?',
    options: [
      'Giống nhau',
      'RDB = snapshot nhị phân theo chu kỳ (nhỏ gọn, khôi phục nhanh, có thể mất dữ liệu giữa 2 lần snapshot). AOF = ghi lại từng lệnh ghi (an toàn hơn, mất tối đa ~1s với appendfsync everysec, file lớn hơn)',
      'RDB an toàn hơn AOF trong mọi trường hợp',
      'AOF là bản snapshot nén',
    ], answer: 1,
    explain: 'RDB: chụp toàn bộ dataset thành file dump.rdb theo chu kỳ (fork process) — file nhỏ, khôi phục nhanh, hợp backup; nhược điểm mất dữ liệu từ snapshot cuối tới khi crash. AOF: append mỗi lệnh ghi vào log; appendfsync everysec (mặc định) mất tối đa ~1 giây; an toàn hơn nhưng file to & khôi phục chậm. Thực tế thường BẬT CẢ HAI: RDB để backup + AOF để an toàn (Redis 4+ có mixed persistence).',
  },
  {
    id: 'redis-penetration', topic: 'Redis / Cache穿透',
    q: 'Cache penetration (穿透) là gì và chống thế nào?',
    options: [
      'Cache đầy bộ nhớ',
      'Truy vấn key KHÔNG TỒN TẠI cả ở cache lẫn DB (thường do tấn công) → mọi request đều xuống DB; chống bằng cache giá trị rỗng (null) có TTL ngắn hoặc Bloom filter chặn trước',
      'Nhiều key hết hạn cùng lúc',
      'Một hot key hết hạn',
    ], answer: 1,
    explain: 'Cache穿透: liên tục hỏi key không tồn tại (id âm, id bịa) → cache luôn miss, DB gánh hết. Chống: (1) cache lại kết quả RỖNG (null) với TTL ngắn để lần sau chặn ở cache; (2) Bloom filter chứa tập id hợp lệ, hỏi trước — không có thì trả luôn, khỏi chạm DB. Kết hợp validate tham số đầu vào.',
  },
  {
    id: 'redis-breakdown', topic: 'Redis / Cache击穿',
    q: 'Cache breakdown (击穿) — một HOT KEY hết hạn khiến hàng loạt request đổ xuống DB. Cách xử lý?',
    options: [
      'Xoá toàn bộ cache',
      'Dùng mutex (khoá phân tán): chỉ 1 request được build lại cache, số còn lại chờ; hoặc “logical expire” (không đặt TTL thật, làm mới nền)',
      'Không làm gì được',
      'Tăng RAM',
    ], answer: 1,
    explain: 'Cache击穿: 1 key NÓNG hết hạn đúng lúc lượng truy cập cao → nghìn request cùng miss và cùng query DB (đè DB). Xử lý: (1) mutex/distributed lock — chỉ 1 thread rebuild cache, thread khác chờ hoặc trả giá trị cũ; (2) logical expiration — lưu kèm thời điểm hết hạn logic, không set TTL Redis, một luồng nền làm mới; (3) key nóng đặt “không bao giờ hết hạn”.',
  },
  {
    id: 'redis-avalanche', topic: 'Redis / Cache雪崩',
    q: 'Cache avalanche (雪崩) là gì và phòng ra sao?',
    options: [
      'Một key hết hạn',
      'RẤT NHIỀU key hết hạn cùng thời điểm (hoặc Redis sập) → DB bị dồn tải đột ngột; phòng bằng TTL + ngẫu nhiên (jitter), Redis cụm/độ sẵn sàng cao, và lớp giảm tải (circuit breaker, hàng đợi)',
      'Cache bị tấn công bằng key giả',
      'Một hot key bị đọc nhiều',
    ], answer: 1,
    explain: 'Cache雪崩: một loạt key hết hạn CÙNG LÚC (vd đặt cùng TTL) hoặc cả Redis sập → toàn bộ tải dồn xuống DB gây sập dây chuyền. Phòng: (1) TTL cộng thêm ngẫu nhiên (jitter) để rải thời điểm hết hạn; (2) Redis cluster/sentinel để không sập cả hệ; (3) circuit breaker / hạn dòng bảo vệ DB; (4) cache nhiều tầng.',
  },
  {
    id: 'redis-expire', topic: 'Redis / Hết hạn',
    q: 'Redis xoá key đã hết hạn bằng chiến lược nào?',
    options: [
      'Quét toàn bộ mỗi giây',
      'Lazy (kiểm tra khi truy cập key mới xoá) + Periodic (định kỳ lấy mẫu ngẫu nhiên trong các key có TTL để xoá) — kết hợp để cân bằng CPU & bộ nhớ',
      'Chỉ xoá khi restart',
      'Không bao giờ tự xoá',
    ], answer: 1,
    explain: 'Redis KHÔNG xoá ngay khi hết hạn. Kết hợp: (1) Lazy/passive — khi có ai truy cập key, nếu đã hết hạn thì mới xoá & trả nil; (2) Periodic/active — mỗi ~100ms lấy MẪU ngẫu nhiên các key có TTL, xoá key đã hết hạn, lặp nếu tỉ lệ hết hạn cao. Nhờ vậy tránh quét toàn bộ (tốn CPU) mà vẫn không để rác tồn quá lâu. Key hết hạn nhưng chưa bị xoá vẫn tính vào bộ nhớ tới khi bị thu hồi.',
  },
  {
    id: 'redis-evict', topic: 'Redis / Eviction',
    q: 'Khi Redis đầy bộ nhớ (maxmemory), chính sách thu hồi nào phổ biến cho hệ thống cache?',
    options: [
      'noeviction luôn tốt nhất',
      'allkeys-lru (bỏ key ít dùng gần đây nhất trên MỌI key) — hợp cache; ngoài ra volatile-lru/lfu/ttl chỉ áp lên key có TTL, allkeys-lfu theo tần suất',
      'Xoá ngẫu nhiên toàn bộ',
      'Chuyển hết xuống đĩa',
    ], answer: 1,
    explain: 'maxmemory-policy: noeviction (từ chối ghi khi đầy — mặc định); allkeys-lru (đuổi key ít dùng gần đây nhất, hợp làm cache thuần); allkeys-lfu (theo TẦN SUẤT dùng, Redis 4+, tránh “dùng 1 lần rồi thôi” chiếm chỗ); volatile-* chỉ đuổi trong nhóm key CÓ TTL. Chọn allkeys-lru/lfu cho cache; noeviction/volatile khi Redis vừa cache vừa lưu dữ liệu cần giữ.',
  },
  {
    id: 'redis-lock', topic: 'Redis / Distributed lock',
    q: 'Khoá phân tán bằng Redis — cách làm ĐÚNG là?',
    cmd: 'SET lock:order:42 <uuid> NX EX 10',
    options: [
      'SETNX rồi EXPIRE ở 2 lệnh riêng',
      'SET key value NX EX <ttl> (một lệnh nguyên tử: chỉ set nếu chưa có + kèm hết hạn); value là UUID của chủ khoá; nhả khoá bằng Lua kiểm value trước khi DEL',
      'Chỉ cần DEL là đủ',
      'Dùng GET rồi SET',
    ], answer: 1,
    explain: 'Khoá đúng: (1) SET ... NX EX là MỘT lệnh nguyên tử (tránh set khoá xong crash trước khi EXPIRE → khoá kẹt vĩnh viễn như cách SETNX + EXPIRE tách rời); (2) value là định danh DUY NHẤT (UUID) của người giữ khoá; (3) NHẢ khoá bằng script Lua: chỉ DEL nếu value khớp (tránh xoá nhầm khoá của người khác khi khoá mình đã hết hạn). Với môi trường nhiều master → Redlock (còn tranh cãi); production thường dùng Redisson.',
  },
  {
    id: 'redis-consistency', topic: 'Redis / Nhất quán cache-DB',
    q: 'Cập nhật DB và cache thế nào để giảm bất nhất (cache aside)?',
    options: [
      'Cập nhật cache trước, DB sau',
      'Cache-aside: đọc thì cache-miss → load DB → set cache; ghi thì cập nhật DB rồi XOÁ cache (không update cache). Xoá an toàn hơn update; cân nhắc delayed double delete cho race',
      'Luôn update cache song song DB',
      'Không bao giờ xoá cache',
    ], answer: 1,
    explain: 'Cache-aside (phổ biến nhất): đọc → miss → query DB → ghi cache. Ghi → cập nhật DB rồi INVALIDATE (xoá) cache, để lần đọc sau nạp lại giá trị mới. Vì sao XOÁ chứ không UPDATE cache: tránh ghi đè bằng giá trị cũ do race, và lười tính (chỉ nạp khi cần). Vẫn còn cửa sổ bất nhất nhỏ → kỹ thuật “delayed double delete” hoặc dựa binlog (Canal) để đồng bộ. Bất nhất mạnh tuyệt đối thì Redis không phải công cụ phù hợp.',
  },
  {
    id: 'redis-single-thread', topic: 'Redis / Đơn luồng',
    q: 'Lệnh nào có thể làm CHẬM/BLOCK Redis vì nó chạy trên luồng đơn?',
    cmd: 'KEYS *   # nguy hiểm trên production',
    options: [
      'GET/SET đơn lẻ',
      'KEYS * (quét toàn bộ keyspace, O(n) chặn luồng), hoặc lệnh O(n) trên tập lớn (HGETALL/SMEMBERS/lrange lớn); nên dùng SCAN/HSCAN (phân trang, không chặn)',
      'INCR',
      'EXPIRE',
    ], answer: 1,
    explain: 'Vì Redis thực thi lệnh ĐƠN LUỒNG, một lệnh O(n) trên dữ liệu lớn sẽ CHẶN tất cả request khác. KEYS * quét toàn bộ keyspace → cấm dùng trên production; thay bằng SCAN (con trỏ, phân trang, non-blocking). Tương tự HGETALL/SMEMBERS/LRANGE trên tập khổng lồ → dùng HSCAN/SSCAN hoặc giới hạn. Cũng tránh xoá 1 key cực lớn bằng DEL (dùng UNLINK — xoá bất đồng bộ).',
  },
  {
    id: 'redis-ha', topic: 'Redis / High Availability',
    q: 'Replication, Sentinel và Cluster của Redis giải quyết điều gì?',
    options: [
      'Đều giống nhau',
      'Replication (master-replica: sao chép + đọc mở rộng); Sentinel (giám sát + tự động failover khi master sập); Cluster (sharding chia dữ liệu theo 16384 slot để mở rộng ghi + dung lượng)',
      'Cluster chỉ để sao lưu',
      'Sentinel dùng để tăng dung lượng',
    ], answer: 1,
    explain: 'Replication: master ghi, replica sao chép — mở rộng ĐỌC & dự phòng, nhưng failover thủ công. Sentinel: cụm giám sát master/replica, tự BẦU replica lên master khi master chết (high availability), báo cho client địa chỉ mới. Cluster: CHIA dữ liệu (sharding) qua 16384 hash slot trên nhiều master → mở rộng cả GHI lẫn dung lượng, mỗi master có replica riêng. Chọn theo nhu cầu: chỉ cần HA → Sentinel; cần scale ghi/bộ nhớ lớn → Cluster.',
  },
];
