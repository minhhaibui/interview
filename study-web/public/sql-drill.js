/**
 * Ngân hàng "🗄️ SQL Drill" — trắc nghiệm SQL cốt lõi cho phỏng vấn Backend.
 * JOIN, GROUP BY/HAVING, NULL, index, transaction/ACID/isolation, normalization,
 * window function, đoán kết quả query, EXPLAIN, deadlock, N+1.
 *
 * Mỗi câu: { id, topic, q, options:[...], answer:idx, explain, sql?:'...' }
 * Trường `sql` (tuỳ chọn) là snippet được render trong <pre><code class="language-sql"> có tô màu.
 */
window.SQL_DRILL = [
  {
    id: 'sql-join-01', topic: 'JOIN',
    q: 'INNER JOIN giữa users và orders sẽ trả về những hàng nào?',
    options: [
      'Mọi user, kể cả user không có order (order = NULL)',
      'Chỉ những user CÓ ít nhất một order khớp điều kiện',
      'Mọi order, kể cả order không thuộc user nào',
      'Tích Descartes mọi cặp user × order',
    ], answer: 1,
    explain: 'INNER JOIN chỉ giữ các hàng có khớp ở CẢ HAI bảng. User không có order sẽ bị loại. Muốn giữ mọi user thì dùng LEFT JOIN.',
  },
  {
    id: 'sql-join-02', topic: 'LEFT JOIN',
    q: 'Query đếm số order mỗi user. Có user chưa từng đặt order. Cách nào ĐÚNG để user đó hiện count = 0?',
    sql: `-- A:
SELECT u.id, COUNT(o.id)
FROM users u LEFT JOIN orders o ON o.user_id = u.id
GROUP BY u.id;
-- B:
SELECT u.id, COUNT(*)
FROM users u LEFT JOIN orders o ON o.user_id = u.id
GROUP BY u.id;`,
    options: ['A đúng, B sai', 'B đúng, A sai', 'Cả hai cho kết quả giống nhau', 'Cả hai đều sai'],
    answer: 0,
    explain: 'COUNT(o.id) đếm số giá trị KHÔNG NULL của cột bảng phải → user không có order cho 0. COUNT(*) đếm số HÀNG, mà LEFT JOIN vẫn sinh 1 hàng (cột phải toàn NULL) → trả về 1 thay vì 0. Luôn COUNT cột không-null của bảng bên phải khi LEFT JOIN.',
  },
  {
    id: 'sql-null-01', topic: 'NULL',
    q: 'Bảng có cột status với một số hàng NULL. Câu nào lấy đúng các hàng status KHÁC "active" (kể cả NULL)?',
    sql: `WHERE status <> 'active'            -- (1)
WHERE status <> 'active' OR status IS NULL  -- (2)
WHERE status != 'active' OR status = NULL   -- (3)`,
    options: ['(1)', '(2)', '(3)', 'Cả ba'],
    answer: 1,
    explain: "Trong SQL, NULL <> 'active' cho UNKNOWN (không TRUE), nên (1) bỏ sót hàng NULL. (3) sai vì `= NULL` luôn UNKNOWN — phải dùng `IS NULL`. Chỉ (2) đúng.",
  },
  {
    id: 'sql-group-01', topic: 'GROUP BY / HAVING',
    q: 'Khác biệt cốt lõi giữa WHERE và HAVING là gì?',
    options: [
      'Không khác gì, dùng thay nhau được',
      'WHERE lọc TRƯỚC khi gộp nhóm (theo từng hàng); HAVING lọc SAU khi gộp (theo nhóm/aggregate)',
      'HAVING nhanh hơn WHERE',
      'WHERE chỉ dùng với JOIN, HAVING chỉ dùng với subquery',
    ], answer: 1,
    explain: 'WHERE áp dụng trên từng hàng trước GROUP BY nên KHÔNG dùng được hàm aggregate. HAVING áp dụng sau khi nhóm nên lọc được theo COUNT/SUM... Ví dụ: HAVING COUNT(*) > 5.',
  },
  {
    id: 'sql-group-02', topic: 'GROUP BY',
    q: 'Query này chạy được trên PostgreSQL (chế độ chuẩn) không?',
    sql: `SELECT user_id, name, COUNT(*)
FROM orders
GROUP BY user_id;`,
    options: [
      'Có, name tự lấy hàng đầu',
      'Lỗi: "name" phải nằm trong GROUP BY hoặc trong hàm aggregate',
      'Có, nhưng name luôn NULL',
      'Lỗi cú pháp ở COUNT(*)',
    ], answer: 1,
    explain: 'SQL chuẩn (và Postgres) yêu cầu mọi cột trong SELECT không nằm trong aggregate thì phải có trong GROUP BY. MySQL cũ với ONLY_FULL_GROUP_BY tắt thì cho qua (lấy giá trị tuỳ ý) — nhưng đó là hành vi không chuẩn, dễ sai.',
  },
  {
    id: 'sql-out-01', topic: 'Đoán kết quả',
    q: 'Bảng t(x) có các giá trị: 1, 2, NULL, 4. Kết quả của query sau là bao nhiêu?',
    sql: `SELECT COUNT(x), COUNT(*), SUM(x), AVG(x) FROM t;`,
    options: ['4, 4, 7, 1.75', '3, 4, 7, 2.333…', '4, 4, 7, 2.333…', '3, 3, 7, 2.333…'],
    answer: 1,
    explain: 'COUNT(x) bỏ qua NULL → 3. COUNT(*) đếm mọi hàng → 4. SUM bỏ NULL → 1+2+4 = 7. AVG = SUM/COUNT(x) = 7/3 ≈ 2.333 (KHÔNG chia 4). NULL bị aggregate bỏ qua, đây là bẫy kinh điển.',
  },
  {
    id: 'sql-idx-01', topic: 'Index',
    q: 'Cột email có B-tree index. Truy vấn nào KHÔNG dùng được index đó hiệu quả?',
    options: [
      "WHERE email = 'a@b.com'",
      "WHERE email LIKE 'abc%'",
      "WHERE email LIKE '%@gmail.com'",
      'WHERE email > \'m\' ORDER BY email',
    ], answer: 2,
    explain: "LIKE với wildcard ở ĐẦU ('%...') không dùng được B-tree (phải quét toàn bộ) vì index sắp theo tiền tố. Bằng (=), tiền tố ('abc%'), và range/order theo cột đều tận dụng được B-tree.",
  },
  {
    id: 'sql-idx-02', topic: 'Composite index',
    q: 'Có composite index (a, b, c). WHERE nào tận dụng được index (ít nhất phần đầu)?',
    options: [
      'WHERE b = 2 AND c = 3',
      'WHERE c = 3',
      'WHERE a = 1 AND b = 2',
      'WHERE b = 2',
    ], answer: 2,
    explain: 'Composite index dùng theo nguyên tắc "leftmost prefix": phải có a (cột trái nhất) thì mới dùng tiếp b, c. WHERE chỉ có b hoặc c (bỏ qua a) không dùng được index này.',
  },
  {
    id: 'sql-tx-01', topic: 'ACID',
    q: 'Trong ACID, chữ "D" (Durability) bảo đảm điều gì?',
    options: [
      'Các transaction chạy như thể tuần tự, không giẫm lên nhau',
      'Mọi ràng buộc (constraint) luôn được giữ',
      'Khi đã COMMIT thì dữ liệu tồn tại vĩnh viễn, kể cả khi mất điện/crash ngay sau đó',
      'Transaction hoặc xong hết hoặc rollback hết',
    ], answer: 2,
    explain: 'Durability: sau COMMIT, thay đổi được ghi bền (thường qua WAL/redo log) và sống sót qua crash. A = Isolation, B = Consistency, D-mô-tả-sai-ở-câu-cuối là Atomicity.',
  },
  {
    id: 'sql-tx-02', topic: 'Isolation level',
    q: 'Hiện tượng "phantom read" (đọc bóng ma) là gì?',
    options: [
      'Đọc lại cùng một hàng nhưng giá trị đã đổi',
      'Đọc dữ liệu của transaction khác chưa commit',
      'Chạy lại cùng một truy vấn theo điều kiện thì xuất hiện hàng MỚI do transaction khác vừa insert/commit',
      'Hai transaction cùng update một hàng gây deadlock',
    ], answer: 2,
    explain: 'Phantom read: cùng một query (vd WHERE age > 30) chạy 2 lần trong 1 transaction lại ra số HÀNG khác vì transaction khác đã insert hàng khớp điều kiện. Chặn được bằng mức SERIALIZABLE. A = non-repeatable read, B = dirty read.',
  },
  {
    id: 'sql-tx-03', topic: 'Isolation level',
    q: 'Mức cô lập (isolation level) mặc định của PostgreSQL là gì?',
    options: ['READ UNCOMMITTED', 'READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE'],
    answer: 1,
    explain: 'PostgreSQL mặc định READ COMMITTED (mỗi câu lệnh thấy dữ liệu đã commit tại thời điểm câu lệnh bắt đầu). Lưu ý Postgres không thực sự có READ UNCOMMITTED — yêu cầu nó sẽ hành xử như READ COMMITTED. MySQL/InnoDB mặc định REPEATABLE READ.',
  },
  {
    id: 'sql-norm-01', topic: 'Normalization',
    q: 'Một bảng vi phạm chuẩn 1NF (First Normal Form) khi nào?',
    options: [
      'Có khoá ngoại trỏ bảng khác',
      'Một ô (cell) chứa nhiều giá trị, ví dụ cột phones = "0901,0902,0903"',
      'Có cột phụ thuộc một phần vào khoá chính ghép',
      'Có cột phụ thuộc bắc cầu qua cột không-khoá',
    ], answer: 1,
    explain: '1NF yêu cầu mỗi ô là giá trị nguyên tử (atomic), không phải danh sách/lặp. Lưu "0901,0902" trong một ô vi phạm 1NF → tách ra bảng phones riêng. Phụ thuộc một phần = vi phạm 2NF, phụ thuộc bắc cầu = vi phạm 3NF.',
  },
  {
    id: 'sql-out-02', topic: 'Đoán kết quả',
    q: 'Bảng a(id) = {1,2,3}, bảng b(id) = {2,3,4}. Kết quả của query?',
    sql: `SELECT a.id FROM a
LEFT JOIN b ON a.id = b.id
WHERE b.id IS NULL;`,
    options: ['{2, 3}', '{1}', '{4}', '{1, 4}'],
    answer: 1,
    explain: 'Đây là mẫu "anti-join": LEFT JOIN rồi lọc b.id IS NULL → lấy các hàng của a KHÔNG khớp b. a có {1,2,3}, khớp được {2,3}, còn lại {1}. Đây là cách tìm "có ở A nhưng không có ở B".',
  },
  {
    id: 'sql-win-01', topic: 'Window function',
    q: 'Khác biệt giữa ROW_NUMBER(), RANK() và DENSE_RANK() khi có giá trị bằng nhau (ties)?',
    options: [
      'Cả ba luôn cho kết quả giống nhau',
      'ROW_NUMBER luôn duy nhất 1,2,3…; RANK nhảy số sau ties (1,1,3); DENSE_RANK không nhảy (1,1,2)',
      'RANK luôn duy nhất, ROW_NUMBER mới nhảy số',
      'DENSE_RANK chỉ chạy trên số nguyên',
    ], answer: 1,
    explain: 'Với 2 giá trị bằng nhau ở hạng nhất: ROW_NUMBER = 1,2 (luôn khác nhau, tuỳ ý). RANK = 1,1,3 (bỏ qua hạng 2). DENSE_RANK = 1,1,2 (không bỏ hạng). Câu hỏi rất hay bị hỏi khi làm "top N theo nhóm".',
  },
  {
    id: 'sql-out-03', topic: 'Đoán kết quả',
    q: 'Trong PostgreSQL, kết quả của: SELECT NULL = NULL;',
    options: ['true', 'false', 'NULL (UNKNOWN)', 'Lỗi cú pháp'],
    answer: 2,
    explain: 'So sánh với NULL bằng = luôn ra NULL/UNKNOWN, kể cả NULL = NULL. Để kiểm tra bằng nhau coi NULL như nhau phải dùng `IS NOT DISTINCT FROM`, còn kiểm tra null thì dùng `IS NULL`.',
  },
  {
    id: 'sql-perf-01', topic: 'N+1',
    q: 'Vấn đề "N+1 query" trong ORM là gì và cách khắc phục phổ biến?',
    options: [
      'Query quá dài; khắc phục bằng cách thêm index',
      'Lấy N bản ghi cha rồi chạy thêm 1 query con cho MỖI bản ghi (1 + N query); khắc phục bằng eager-load/JOIN hoặc IN(...)',
      'Database bị chia N+1 shard; khắc phục bằng gộp shard',
      'Có N+1 transaction lồng nhau; khắc phục bằng savepoint',
    ], answer: 1,
    explain: 'N+1: 1 query lấy danh sách cha, rồi vòng lặp chạy thêm 1 query con cho từng cha → 1+N query, rất chậm. Khắc phục: eager loading (JOIN / include / preload) hoặc gom id rồi WHERE id IN (...) chỉ 2 query.',
  },
  {
    id: 'sql-explain-01', topic: 'EXPLAIN',
    q: 'Trong kế hoạch thực thi (EXPLAIN) PostgreSQL, "Seq Scan" trên bảng lớn ở truy vấn lọc theo 1 cột thường báo hiệu gì?',
    options: [
      'Truy vấn đang dùng index tối ưu',
      'Quét tuần tự toàn bảng — thường do thiếu index phù hợp trên cột lọc (cần cân nhắc thêm index)',
      'Bảng đang bị khoá',
      'Kết quả đã được cache',
    ], answer: 1,
    explain: 'Seq Scan = đọc tuần tự toàn bộ bảng. Với bảng lớn lọc theo cột chọn lọc cao, đó thường là dấu hiệu thiếu index → cân nhắc tạo index. (Với bảng nhỏ hoặc lấy phần lớn hàng thì Seq Scan lại hợp lý hơn Index Scan.)',
  },
  {
    id: 'sql-lock-01', topic: 'Deadlock',
    q: 'Deadlock giữa hai transaction xảy ra điển hình khi nào?',
    options: [
      'Khi một transaction chạy quá lâu (timeout)',
      'Khi T1 giữ khoá A chờ khoá B, còn T2 giữ khoá B chờ khoá A — chờ vòng tròn',
      'Khi quên đóng connection',
      'Khi hai transaction đọc cùng một hàng',
    ], answer: 1,
    explain: 'Deadlock = phụ thuộc khoá theo vòng (T1 chờ T2, T2 chờ T1). DB phát hiện và hủy (rollback) một transaction "nạn nhân". Phòng tránh: luôn khoá tài nguyên theo CÙNG một thứ tự, giữ transaction ngắn.',
  },
  {
    id: 'sql-out-04', topic: 'Đoán kết quả',
    q: 'orders(id, amount): (1,100),(2,NULL),(3,50). Kết quả của query?',
    sql: `SELECT COUNT(*) FROM orders WHERE amount > 60;`,
    options: ['1', '2', '3', '0'],
    answer: 0,
    explain: 'amount > 60 đúng với 100 (id 1). Hàng amount = NULL cho NULL > 60 = UNKNOWN → KHÔNG được tính. 50 < 60 → loại. Vậy chỉ 1 hàng. NULL không bao giờ thỏa điều kiện so sánh.',
  },
  {
    id: 'sql-key-01', topic: 'Khoá',
    q: 'Khác biệt giữa PRIMARY KEY và UNIQUE constraint?',
    options: [
      'Không khác gì',
      'PRIMARY KEY: duy nhất + KHÔNG cho NULL + mỗi bảng chỉ 1; UNIQUE: duy nhất nhưng cho phép NULL và có nhiều cái',
      'UNIQUE không cho NULL, PRIMARY KEY thì cho',
      'PRIMARY KEY không tạo index, UNIQUE thì có',
    ], answer: 1,
    explain: 'PRIMARY KEY = UNIQUE + NOT NULL, mỗi bảng chỉ một. UNIQUE cho phép (thường) một hoặc nhiều NULL tùy DB và một bảng có nhiều ràng buộc UNIQUE. Cả hai đều tự tạo index để ép tính duy nhất.',
  },
  {
    id: 'sql-agg-01', topic: 'DISTINCT',
    q: 'Khác biệt giữa COUNT(col) và COUNT(DISTINCT col)?',
    options: [
      'Giống hệt nhau',
      'COUNT(col) đếm số giá trị không-NULL; COUNT(DISTINCT col) đếm số giá trị KHÁC NHAU và không-NULL',
      'COUNT(DISTINCT col) tính cả NULL như một giá trị',
      'COUNT(col) bao gồm cả NULL',
    ], answer: 1,
    explain: 'Cả hai bỏ qua NULL. COUNT(col) đếm tổng số giá trị không-null; COUNT(DISTINCT col) khử trùng lặp rồi mới đếm. Ví dụ {a,a,b,NULL}: COUNT(col)=3, COUNT(DISTINCT col)=2.',
  },
  {
    id: 'sql-tx-04', topic: 'Transaction',
    q: 'Vì sao nên bọc thao tác chuyển tiền (trừ A, cộng B) trong một transaction?',
    options: [
      'Để chạy nhanh hơn',
      'Để bảo đảm tính nguyên tử (atomicity): cả hai bước cùng thành công hoặc cùng rollback — không bị trừ A mà chưa cộng B khi crash giữa chừng',
      'Để tránh phải đánh index',
      'Vì transaction giúp giảm dung lượng lưu trữ',
    ], answer: 1,
    explain: 'Không có transaction, nếu crash sau khi trừ A nhưng trước khi cộng B thì tiền "bốc hơi". Transaction bảo đảm nguyên tử: hoặc cả hai update cùng commit, hoặc rollback toàn bộ.',
  },
  {
    id: 'sql-out-05', topic: 'Đoán kết quả',
    q: 'Kết quả thứ tự các hàng của query (Postgres)?',
    sql: `SELECT name FROM users
ORDER BY last_login DESC NULLS LAST
LIMIT 2;`,
    options: [
      'Hai user đăng nhập GẦN ĐÂY nhất, user chưa từng login (NULL) bị đẩy xuống cuối nên khó vào top 2',
      'Hai user có last_login NULL trước tiên',
      'Sắp tăng dần theo last_login',
      'Lỗi: NULLS LAST không hợp lệ',
    ], answer: 0,
    explain: 'ORDER BY ... DESC mặc định Postgres đặt NULL lên đầu; thêm NULLS LAST để đẩy NULL xuống cuối. Vậy LIMIT 2 lấy 2 user có last_login mới nhất, user NULL không lọt top. Kiểm soát vị trí NULL là điểm hay quên khi sort.',
  },
];
