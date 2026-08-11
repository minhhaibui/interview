/**
 * Ngân hàng "☁️ Redis" — trắc nghiệm Redis CHUYÊN SÂU cho phỏng vấn Backend (theo khung JavaGuide).
 * Vì sao nhanh, kiểu dữ liệu, persistence (RDB/AOF), hết hạn & thu hồi bộ nhớ,
 * cache penetration/breakdown/avalanche, khoá phân tán, đơn luồng, replication/sentinel/cluster, nhất quán cache-DB.
 *
 * Mỗi câu: { id, topic, q, options:[...], answer:idx, explain, cmd?:'...' (snippet lệnh Redis) }
 */
window.REDIS_QUIZ = [
  {
    id: 'redis-fast', topic: 'Redis / Cơ chế',
    q: 'Vì sao Redis nhanh dù xử lý lệnh trên MỘT luồng chính?',
    options: [
      'Vì Redis dùng GPU để xử lý song song hàng vạn lệnh mỗi giây',
      'Dữ liệu trong RAM + cấu trúc tối ưu + đơn luồng khỏi khoá + epoll',
      'Vì Redis tạo một luồng riêng cho mỗi lệnh nên xử lý song song',
      'Vì Redis ghi thẳng xuống SSD sau mỗi lệnh nên không cần cache',
    ], answer: 1,
    explain: 'Redis nhanh nhờ: (1) toàn bộ dữ liệu trong bộ nhớ; (2) cấu trúc dữ liệu hiệu quả (skiplist, hash, ziplist…); (3) xử lý lệnh ĐƠN LUỒNG → không cần khoá, không đua tranh, không chuyển ngữ cảnh; (4) I/O multiplexing (epoll/kqueue) một luồng quản nhiều socket. Redis 6+ thêm ĐA LUỒNG cho phần đọc/ghi mạng (I/O), nhưng thực thi lệnh vẫn đơn luồng.',
  },
  {
    id: 'redis-types', topic: 'Redis / Kiểu dữ liệu',
    q: 'Ghép đúng use case với kiểu dữ liệu Redis?',
    options: [
      'Dùng String cho mọi trường hợp là cách đơn giản và nhanh nhất',
      'String (counter), Hash (object), List (queue), Set (khử trùng), ZSet (rank)',
      'ZSet chỉ để lưu chuỗi văn bản dài, không dùng cho bảng xếp hạng',
      'List là cấu trúc chuẩn để cài đặt khoá phân tán trong Redis',
    ], answer: 1,
    explain: '5 kiểu cơ bản: String (cache giá trị, đếm INCR/DECR, bit); Hash (lưu object gọn, sửa từng field); List (danh sách 2 đầu — hàng đợi, feed, LPUSH/BRPOP); Set (tập không trùng — tag, giao/hợp); ZSet/Sorted Set (mỗi phần tử có score — leaderboard, top-N, hàng đợi ưu tiên). Ngoài ra còn Bitmap, HyperLogLog (đếm xấp xỉ UV), Geo, Stream.',
  },
  {
    id: 'redis-persist', topic: 'Redis / Persistence',
    q: 'RDB và AOF khác nhau thế nào?',
    options: [
      'Giống nhau, chỉ khác định dạng file lưu trên đĩa của Redis',
      'RDB = snapshot theo chu kỳ (gọn, có thể mất dữ liệu); AOF = ghi từng lệnh',
      'RDB an toàn hơn AOF trong mọi trường hợp vì lưu dạng nhị phân',
      'AOF chính là bản snapshot đã được nén lại cho nhẹ hơn RDB',
    ], answer: 1,
    explain: 'RDB: chụp toàn bộ dataset thành file dump.rdb theo chu kỳ (fork process) — file nhỏ, khôi phục nhanh, hợp backup; nhược điểm mất dữ liệu từ snapshot cuối tới khi crash. AOF: append mỗi lệnh ghi vào log; appendfsync everysec (mặc định) mất tối đa ~1 giây; an toàn hơn nhưng file to & khôi phục chậm. Thực tế thường BẬT CẢ HAI: RDB để backup + AOF để an toàn (Redis 4+ có mixed persistence).',
  },
  {
    id: 'redis-penetration', topic: 'Redis / Cache penetration',
    q: 'Cache penetration là gì và chống thế nào?',
    options: [
      'Cache bị đầy bộ nhớ nên phải thu hồi key liên tục theo LRU',
      'Truy vấn key KHÔNG tồn tại ở cả cache lẫn DB; chống bằng null cache/Bloom',
      'Rất nhiều key hết hạn cùng một lúc khiến DB bị dồn tải đột ngột',
      'Một hot key hết hạn khiến hàng loạt request cùng dựng lại cache',
    ], answer: 1,
    explain: 'Cache penetration: liên tục hỏi key không tồn tại (id âm, id bịa) → cache luôn miss, DB gánh hết. Chống: (1) cache lại kết quả RỖNG (null) với TTL ngắn để lần sau chặn ở cache; (2) Bloom filter chứa tập id hợp lệ, hỏi trước — không có thì trả luôn, khỏi chạm DB. Kết hợp validate tham số đầu vào.',
  },
  {
    id: 'redis-breakdown', topic: 'Redis / Cache breakdown',
    q: 'Cache breakdown — một HOT KEY hết hạn khiến hàng loạt request đổ xuống DB. Cách xử lý?',
    options: [
      'Xoá toàn bộ cache rồi để hệ thống tự dựng lại từ đầu cho sạch',
      'Dùng mutex: chỉ 1 request dựng lại cache; hoặc "logical expire" làm mới nền',
      'Không có cách nào xử lý, phải chấp nhận DB bị dồn tải lúc đó',
      'Tăng RAM cho Redis để key nóng không bao giờ bị hết hạn nữa',
    ], answer: 1,
    explain: 'Cache breakdown: 1 key NÓNG hết hạn đúng lúc lượng truy cập cao → nghìn request cùng miss và cùng query DB (đè DB). Xử lý: (1) mutex/distributed lock — chỉ 1 thread rebuild cache, thread khác chờ hoặc trả giá trị cũ; (2) logical expiration — lưu kèm thời điểm hết hạn logic, không set TTL Redis, một luồng nền làm mới; (3) key nóng đặt “không bao giờ hết hạn”.',
  },
  {
    id: 'redis-avalanche', topic: 'Redis / Cache avalanche',
    q: 'Cache avalanche là gì và phòng ra sao?',
    options: [
      'Một key duy nhất hết hạn khiến các request phải chờ dựng lại',
      'RẤT NHIỀU key hết hạn cùng lúc (hoặc Redis sập); phòng bằng TTL + jitter',
      'Cache bị tấn công bằng hàng loạt key giả không hề có trong DB',
      'Một hot key bị đọc quá nhiều làm nghẽn băng thông tới Redis',
    ], answer: 1,
    explain: 'Cache avalanche: một loạt key hết hạn CÙNG LÚC (vd đặt cùng TTL) hoặc cả Redis sập → toàn bộ tải dồn xuống DB gây sập dây chuyền. Phòng: (1) TTL cộng thêm ngẫu nhiên (jitter) để rải thời điểm hết hạn; (2) Redis cluster/sentinel để không sập cả hệ; (3) circuit breaker / hạn dòng bảo vệ DB; (4) cache nhiều tầng.',
  },
  {
    id: 'redis-expire', topic: 'Redis / Hết hạn',
    q: 'Redis xoá key đã hết hạn bằng chiến lược nào?',
    options: [
      'Quét toàn bộ keyspace mỗi giây để xoá hết key đã hết hạn',
      'Lazy (xoá khi truy cập) + Periodic (định kỳ lấy mẫu ngẫu nhiên key có TTL)',
      'Chỉ dọn key hết hạn vào lúc Redis khởi động lại tiến trình',
      'Không bao giờ tự xoá, ứng dụng phải chủ động gọi DEL cho key',
    ], answer: 1,
    explain: 'Redis KHÔNG xoá ngay khi hết hạn. Kết hợp: (1) Lazy/passive — khi có ai truy cập key, nếu đã hết hạn thì mới xoá & trả nil; (2) Periodic/active — mỗi ~100ms lấy MẪU ngẫu nhiên các key có TTL, xoá key đã hết hạn, lặp nếu tỉ lệ hết hạn cao. Nhờ vậy tránh quét toàn bộ (tốn CPU) mà vẫn không để rác tồn quá lâu. Key hết hạn nhưng chưa bị xoá vẫn tính vào bộ nhớ tới khi bị thu hồi.',
  },
  {
    id: 'redis-evict', topic: 'Redis / Eviction',
    q: 'Khi Redis đầy bộ nhớ (maxmemory), chính sách thu hồi nào phổ biến cho hệ thống cache?',
    options: [
      'noeviction — luôn tốt nhất vì không bao giờ mất dữ liệu cache',
      'allkeys-lru — bỏ key ít dùng gần đây nhất trên MỌI key, hợp cache',
      'Xoá ngẫu nhiên toàn bộ keyspace khi chạm ngưỡng maxmemory',
      'Chuyển bớt key xuống đĩa (swap) để giải phóng RAM cho key mới',
    ], answer: 1,
    explain: 'maxmemory-policy: noeviction (từ chối ghi khi đầy — mặc định); allkeys-lru (đuổi key ít dùng gần đây nhất, hợp làm cache thuần); allkeys-lfu (theo TẦN SUẤT dùng, Redis 4+, tránh “dùng 1 lần rồi thôi” chiếm chỗ); volatile-* chỉ đuổi trong nhóm key CÓ TTL. Chọn allkeys-lru/lfu cho cache; noeviction/volatile khi Redis vừa cache vừa lưu dữ liệu cần giữ.',
  },
  {
    id: 'redis-lock', topic: 'Redis / Distributed lock',
    q: 'Khoá phân tán bằng Redis — cách làm ĐÚNG là?',
    cmd: 'SET lock:order:42 <uuid> NX EX 10',
    options: [
      'SETNX rồi EXPIRE bằng hai lệnh riêng biệt chạy liên tiếp',
      'SET key uuid NX EX <ttl> (nguyên tử); nhả khoá bằng Lua kiểm value',
      'Chỉ cần DEL key khi xong việc là đủ để nhả khoá một cách an toàn',
      'GET xem key có chưa, chưa có thì SET để chiếm lấy khoá đó',
    ], answer: 1,
    explain: 'Khoá đúng: (1) SET ... NX EX là MỘT lệnh nguyên tử (tránh set khoá xong crash trước khi EXPIRE → khoá kẹt vĩnh viễn như cách SETNX + EXPIRE tách rời); (2) value là định danh DUY NHẤT (UUID) của người giữ khoá; (3) NHẢ khoá bằng script Lua: chỉ DEL nếu value khớp (tránh xoá nhầm khoá của người khác khi khoá mình đã hết hạn). Với môi trường nhiều master → Redlock (còn tranh cãi); production thường dùng Redisson.',
  },
  {
    id: 'redis-consistency', topic: 'Redis / Nhất quán cache-DB',
    q: 'Cập nhật DB và cache thế nào để giảm bất nhất (cache aside)?',
    options: [
      'Cập nhật cache trước rồi mới ghi xuống DB cho phản hồi nhanh',
      'Cache-aside: đọc miss thì load DB & set cache; ghi thì update DB rồi XOÁ cache',
      'Luôn update song song cả cache lẫn DB trong cùng một transaction',
      'Không bao giờ xoá cache, chỉ đặt TTL ngắn để dữ liệu tự mới lại',
    ], answer: 1,
    explain: 'Cache-aside (phổ biến nhất): đọc → miss → query DB → ghi cache. Ghi → cập nhật DB rồi INVALIDATE (xoá) cache, để lần đọc sau nạp lại giá trị mới. Vì sao XOÁ chứ không UPDATE cache: tránh ghi đè bằng giá trị cũ do race, và lười tính (chỉ nạp khi cần). Vẫn còn cửa sổ bất nhất nhỏ → kỹ thuật “delayed double delete” hoặc dựa binlog (Canal) để đồng bộ. Bất nhất mạnh tuyệt đối thì Redis không phải công cụ phù hợp.',
  },
  {
    id: 'redis-single-thread', topic: 'Redis / Đơn luồng',
    q: 'Lệnh nào có thể làm CHẬM/BLOCK Redis vì nó chạy trên luồng đơn?',
    cmd: 'KEYS *   # nguy hiểm trên production',
    options: [
      'GET/SET đơn lẻ trên key nhỏ vì lệnh nào cũng phải chờ tới lượt',
      'KEYS * và lệnh O(n) trên tập lớn (HGETALL/SMEMBERS) — nên dùng SCAN',
      'INCR vì phải khoá key để đảm bảo tăng đúng khi nhiều client gọi',
      'EXPIRE vì Redis phải quét lại toàn bộ keyspace sau mỗi lần đặt',
    ], answer: 1,
    explain: 'Vì Redis thực thi lệnh ĐƠN LUỒNG, một lệnh O(n) trên dữ liệu lớn sẽ CHẶN tất cả request khác. KEYS * quét toàn bộ keyspace → cấm dùng trên production; thay bằng SCAN (con trỏ, phân trang, non-blocking). Tương tự HGETALL/SMEMBERS/LRANGE trên tập khổng lồ → dùng HSCAN/SSCAN hoặc giới hạn. Cũng tránh xoá 1 key cực lớn bằng DEL (dùng UNLINK — xoá bất đồng bộ).',
  },
  {
    id: 'redis-ha', topic: 'Redis / High Availability',
    q: 'Replication, Sentinel và Cluster của Redis giải quyết điều gì?',
    options: [
      'Cả ba đều là tên gọi khác nhau của cùng một cơ chế nhân bản',
      'Replication (sao chép/đọc), Sentinel (giám sát & failover), Cluster (sharding)',
      'Cluster chỉ dùng để sao lưu dữ liệu định kỳ sang máy dự phòng',
      'Sentinel dùng để tăng dung lượng lưu trữ bằng cách chia nhỏ slot',
    ], answer: 1,
    explain: 'Replication: master ghi, replica sao chép — mở rộng ĐỌC & dự phòng, nhưng failover thủ công. Sentinel: cụm giám sát master/replica, tự BẦU replica lên master khi master chết (high availability), báo cho client địa chỉ mới. Cluster: CHIA dữ liệu (sharding) qua 16384 hash slot trên nhiều master → mở rộng cả GHI lẫn dung lượng, mỗi master có replica riêng. Chọn theo nhu cầu: chỉ cần HA → Sentinel; cần scale ghi/bộ nhớ lớn → Cluster.',
  },
];
