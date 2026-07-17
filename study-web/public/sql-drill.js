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
  {
    id: 'sql-tx-05', topic: 'Isolation level',
    q: 'Ở mức cô lập nào thì "phantom read" (cùng một query range chạy 2 lần trong 1 transaction lại ra số hàng KHÁC nhau vì giao dịch khác chèn hàng mới) bị ngăn hoàn toàn theo chuẩn SQL?',
    options: ['READ COMMITTED', 'REPEATABLE READ (theo chuẩn SQL)', 'SERIALIZABLE', 'READ UNCOMMITTED'],
    answer: 2,
    explain: 'Theo chuẩn SQL: READ COMMITTED ngăn dirty read; REPEATABLE READ ngăn thêm non-repeatable read nhưng VẪN cho phép phantom; chỉ SERIALIZABLE ngăn cả phantom. (Lưu ý: REPEATABLE READ của Postgres dùng snapshot nên thực tế đã chặn phantom, nhưng câu hỏi hỏi theo chuẩn SQL.)',
  },
  {
    id: 'sql-idx-03', topic: 'Composite index',
    q: 'Có index (a, b, c). Query WHERE nào KHÔNG seek nhanh được theo index này?',
    sql: `-- chọn câu WHERE không dùng được index (a,b,c)
WHERE a = 1 AND b = 2        -- (1)
WHERE a = 1 AND c = 3        -- (2)
WHERE b = 2 AND c = 3        -- (3)`,
    options: ['(1)', '(2) — seek theo a rồi lọc c', '(3) — thiếu cột a dẫn đầu nên không seek theo prefix', 'Cả ba đều dùng tốt như nhau'],
    answer: 2,
    explain: 'Index composite chỉ seek hiệu quả theo "leftmost prefix": phải dùng a (rồi b, rồi c) từ trái sang. (3) thiếu a dẫn đầu → không seek theo cây index (trừ index-only/skip scan đặc biệt). (2) seek theo a rồi lọc c. Thứ tự cột trong composite index rất quan trọng.',
  },
  {
    id: 'sql-perf-02', topic: 'EXISTS vs IN',
    q: 'Kiểm tra "user nào CÓ ít nhất 1 order". Cách viết nào thường tối ưu & an toàn với NULL nhất?',
    sql: `-- A:
SELECT * FROM users u
WHERE u.id IN (SELECT o.user_id FROM orders o);
-- B:
SELECT * FROM users u
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id);`,
    options: ['A luôn nhanh hơn', 'B (EXISTS) — dừng ngay khi thấy 1 khớp & không bẫy NULL như IN', 'Hai cách luôn giống hệt nhau mọi mặt', 'Cả hai đều sai cú pháp'],
    answer: 1,
    explain: 'EXISTS short-circuit (thấy 1 hàng khớp là dừng) và không dính bẫy NULL của "NOT IN" khi subquery có NULL. Nhiều optimizer xem IN/EXISTS tương đương cho trường hợp dương, nhưng với NOT IN/NOT EXISTS thì khác biệt NULL gây bug kinh điển. Thói quen tốt: dùng EXISTS cho kiểm tra tồn tại.',
  },
  {
    id: 'sql-win-02', topic: 'Window function',
    q: 'Khác nhau giữa ROW_NUMBER(), RANK() và DENSE_RANK() khi có giá trị BẰNG nhau (tie)?',
    sql: `SELECT name, score,
  ROW_NUMBER() OVER (ORDER BY score DESC),
  RANK()       OVER (ORDER BY score DESC),
  DENSE_RANK() OVER (ORDER BY score DESC)
FROM players;`,
    options: [
      'Cả ba luôn cho số giống nhau',
      'ROW_NUMBER luôn duy nhất 1,2,3…; RANK nhảy số sau tie (1,1,3); DENSE_RANK không nhảy (1,1,2)',
      'RANK luôn duy nhất, ROW_NUMBER mới nhảy số',
      'DENSE_RANK luôn cho số lớn nhất',
    ], answer: 1,
    explain: 'ROW_NUMBER đánh số duy nhất theo thứ tự (tie thì tuỳ ý). RANK cho cùng hạng khi tie rồi "nhảy" (1,1,3). DENSE_RANK cũng cùng hạng khi tie nhưng KHÔNG nhảy (1,1,2). Lấy "top-N theo nhóm" thường dùng ROW_NUMBER với PARTITION BY.',
  },
  {
    id: 'sql-upsert-01', topic: 'Upsert',
    q: 'Cần "có thì cập nhật, chưa có thì chèn" theo khoá duy nhất, an toàn khi nhiều request đồng thời. Cách chuẩn trong Postgres?',
    sql: `INSERT INTO counters(key, n) VALUES ('hits', 1)
ON CONFLICT (key) DO UPDATE SET n = counters.n + 1;`,
    options: [
      'SELECT trước, nếu không có thì INSERT, có thì UPDATE (2 query rời)',
      'INSERT ... ON CONFLICT (key) DO UPDATE — atomic, nhờ ràng buộc UNIQUE chống race',
      'Chỉ UPDATE là đủ',
      'DELETE rồi INSERT lại',
    ], answer: 1,
    explain: 'INSERT ... ON CONFLICT ... DO UPDATE (upsert) là câu lệnh nguyên tử dựa trên ràng buộc UNIQUE/PK, tránh race giữa SELECT-rồi-INSERT (hai request cùng thấy "chưa có" rồi cùng INSERT → trùng hoặc nhân đôi). MySQL có INSERT ... ON DUPLICATE KEY UPDATE tương tự.',
  },
  {
    id: 'sql-explain-02', topic: 'EXPLAIN',
    q: 'Trong EXPLAIN ANALYZE Postgres, thấy "Seq Scan" trên bảng lớn với điều kiện WHERE chọn lọc ít hàng. Điều này thường gợi ý gì?',
    options: [
      'Mọi thứ tối ưu, không cần làm gì',
      'Có thể THIẾU index phù hợp cho cột trong WHERE (hoặc thống kê cũ) → cân nhắc tạo index / ANALYZE',
      'Seq Scan luôn nhanh hơn Index Scan',
      'Phải DROP bảng và tạo lại',
    ], answer: 1,
    explain: 'Seq Scan đọc toàn bộ bảng. Với bảng lớn mà WHERE chỉ lấy ít hàng, đó thường là dấu hiệu thiếu index trên cột lọc, hoặc thống kê (ANALYZE) lỗi thời khiến planner ước lượng sai. Tạo index phù hợp hoặc chạy ANALYZE có thể chuyển sang Index Scan nhanh hơn nhiều. (Với bảng nhỏ thì Seq Scan lại hợp lý.)',
  },
  {
    id: 'sql-union-all', topic: 'UNION vs UNION ALL',
    q: 'Khác nhau chính giữa UNION và UNION ALL là gì?',
    options: [
      'Hai lệnh hoàn toàn giống nhau',
      'UNION ALL loại bỏ dòng trùng, UNION giữ lại',
      'UNION khử dòng trùng (tốn sort/hash để so sánh nên chậm hơn); UNION ALL giữ TẤT CẢ, nhanh hơn',
      'UNION ALL chỉ dùng được với đúng 2 bảng',
    ], answer: 2,
    explain: 'UNION khử trùng lặp — DB phải sort hoặc hash để so sánh nên tốn kém hơn. UNION ALL nối thẳng kết quả, giữ cả dòng trùng, nhanh hơn. Nếu chắc chắn không trùng (hoặc không cần khử), hãy dùng UNION ALL cho hiệu năng.',
  },
{
    id: 'sql-fk-cascade', topic: 'Khoá ngoại',
    q: 'Khóa ngoại khai báo `ON DELETE CASCADE`. Khi xoá một dòng CHA đang được tham chiếu thì sao?',
    options: [
      'Bị chặn, báo lỗi ràng buộc',
      'Các dòng con được set NULL',
      'Các dòng CON tham chiếu tới nó cũng bị XOÁ theo',
      'Không có gì xảy ra',
    ], answer: 2,
    explain: 'ON DELETE CASCADE: xoá cha thì các dòng con bị xoá theo. So sánh: RESTRICT/NO ACTION chặn xoá khi còn con; SET NULL đặt FK của con thành NULL. Chọn đúng hành vi để tránh mất dữ liệu ngoài ý muốn hoặc để lại orphan rows.',
  },
  {
    id: 'sql-truncate', topic: 'TRUNCATE vs DELETE',
    q: 'Điểm khác biệt quan trọng giữa TRUNCATE và DELETE (khi xoá TOÀN BỘ bảng)?',
    options: [
      'TRUNCATE nhanh hơn (không log từng dòng), thường KHÔNG kích trigger & reset auto-increment; DELETE log từng dòng, kích trigger, rollback linh hoạt',
      'TRUNCATE có thể lọc theo WHERE, DELETE thì không',
      'Hai lệnh giống hệt nhau',
      'DELETE reset auto-increment, còn TRUNCATE thì không',
    ], answer: 0,
    explain: 'TRUNCATE thao tác ở mức bảng (giải phóng page) → rất nhanh, thường reset identity/auto-increment và không kích row trigger; nhiều DB không cho kèm WHERE. DELETE xoá từng dòng nên chậm hơn với bảng lớn, nhưng log được, kích trigger và rollback linh hoạt.',
  },
  {
    id: 'sql-keyset-pagination', topic: 'Phân trang',
    q: 'Phân trang bằng `LIMIT 20 OFFSET 100000` chậm dần khi offset lớn. Cách tối ưu phổ biến?',
    options: [
      'Tăng LIMIT lên thật lớn',
      'Bỏ ORDER BY đi',
      'Dùng SELECT * thay vì liệt kê cột',
      'Keyset/seek pagination: nhớ khóa dòng cuối rồi `WHERE id > :last_id ORDER BY id LIMIT 20`',
    ], answer: 3,
    explain: 'OFFSET N buộc DB DUYỆT rồi BỎ N dòng đầu → càng sâu càng chậm. Keyset (seek) pagination nhớ giá trị khóa của dòng cuối trang trước rồi `WHERE id > :last ORDER BY id LIMIT n` — nhảy thẳng nhờ index, ổn định. Đánh đổi: không nhảy tới trang bất kỳ dễ như OFFSET.',
  },
  {
    id: 'sql-cte', topic: 'CTE',
    q: 'Mệnh đề WITH (CTE — Common Table Expression) chủ yếu dùng để làm gì?',
    sql: 'WITH recent AS (\n  SELECT * FROM orders WHERE created_at > NOW() - INTERVAL \'7 days\'\n)\nSELECT user_id, COUNT(*) FROM recent GROUP BY user_id;',
    options: [
      'Tăng tốc mọi truy vấn một cách tự động',
      'Đặt tên cho truy vấn con để tái dùng & DỄ ĐỌC hơn; còn hỗ trợ đệ quy (WITH RECURSIVE)',
      'Thay thế hoàn toàn cho index',
      'Chỉ dùng được bên trong stored procedure',
    ], answer: 1,
    explain: 'CTE tách truy vấn phức tạp thành các bước có tên, dễ đọc và tái dùng trong cùng câu; WITH RECURSIVE cho phép ĐỆ QUY (duyệt cây/đồ thị như sơ đồ tổ chức). Lưu ý: CTE không tự làm nhanh hơn subquery — vài DB còn "materialize" CTE gây chậm nếu dùng lại nhiều lần.',
  },
  {
    id: 'sql-lag-01', topic: 'Window function',
    q: 'Muốn tính CHÊNH LỆCH doanh thu của mỗi tháng so với THÁNG LIỀN TRƯỚC trong cùng một query. Hàm window nào đúng việc?',
    sql: "SELECT month, revenue,\n       revenue - ___(revenue) OVER (ORDER BY month) AS diff\nFROM monthly_revenue;",
    options: ['ROW_NUMBER', 'FIRST_VALUE', 'SUM', 'LAG'], answer: 3,
    explain: 'LAG(col) OVER (ORDER BY …) lấy giá trị của HÀNG TRƯỚC theo thứ tự chỉ định (LEAD lấy hàng sau) — chuẩn cho so sánh kỳ-trước/kỳ-sau. ROW_NUMBER chỉ đánh số; FIRST_VALUE lấy hàng đầu cả khung; SUM OVER là tổng luỹ kế.',
  },
  {
    id: 'sql-sarg-01', topic: 'Index',
    q: 'Bảng users có index trên cột email, nhưng query dưới vẫn Seq Scan. Vì sao?',
    sql: "SELECT * FROM users WHERE LOWER(email) = 'an@x.com';",
    options: [
      'B-tree index lưu giá trị GỐC — bọc cột trong hàm LOWER() khiến index không dùng được (non-sargable); cần functional index trên LOWER(email) hoặc so sánh không qua hàm',
      'Index chỉ hoạt động với cột số, không hoạt động với text',
      'Thiếu dấu nháy kép quanh tên cột',
      'Phải thêm LIMIT thì index mới được dùng',
    ], answer: 0,
    explain: 'Điều kiện "sargable" = so trực tiếp trên cột. Bọc cột trong hàm (LOWER, DATE, +1…) làm DB không tra được B-tree theo giá trị gốc. Giải pháp: functional/expression index `CREATE INDEX ON users (LOWER(email))` (Postgres), hoặc chuẩn hoá dữ liệu khi ghi. Bẫy tương tự: WHERE created_at + INTERVAL, WHERE id::text.',
  },
  {
    id: 'sql-covering-01', topic: 'Index',
    q: '"Covering index" (index-only scan) nghĩa là gì?',
    options: [
      'Index bao phủ mọi cột của bảng',
      'Index tự nhân bản sang replica',
      'Mọi cột query cần đều CÓ TRONG INDEX → DB đọc mỗi index, khỏi truy ra bảng (heap) — nhanh hơn hẳn',
      'Index có điều kiện WHERE (partial index)',
    ], answer: 2,
    explain: 'Bình thường index chỉ dẫn tới hàng rồi vẫn phải đọc bảng lấy cột còn thiếu. Nếu SELECT/WHERE chỉ đụng các cột nằm trong index (kể cả cột INCLUDE thêm vào) → index-only scan, bỏ hẳn bước đọc heap. Ví dụ: index (user_id, created_at) INCLUDE (total) phục vụ trọn "SELECT total WHERE user_id=? ORDER BY created_at".',
  },
  {
    id: 'sql-notin-null', topic: 'Đoán kết quả',
    q: 'orders có user_id ∈ {1, 2, NULL}. Query dưới trả về gì?',
    sql: "SELECT * FROM users\nWHERE id NOT IN (SELECT user_id FROM orders);\n-- users có id: 1, 2, 3, 4",
    options: [
      'User 3 và 4',
      '0 HÀNG — vì danh sách NOT IN chứa NULL nên mọi so sánh thành "không xác định"',
      'User 3, 4 và một hàng NULL',
      'Lỗi cú pháp',
    ], answer: 1,
    explain: 'Bẫy SQL kinh điển: `x NOT IN (1, 2, NULL)` ⇔ `x≠1 AND x≠2 AND x≠NULL` — mà `x≠NULL` là UNKNOWN, kéo cả biểu thức thành UNKNOWN → không hàng nào qua lọc. Sửa: lọc NULL trong subquery (`WHERE user_id IS NOT NULL`) hoặc dùng `NOT EXISTS` (miễn nhiễm với NULL).',
  },
  // ---------- MySQL chuyên sâu (InnoDB) ----------
  {
    id: 'sql-idx-btree', topic: 'MySQL / Index',
    q: 'Vì sao index của InnoDB dùng cây B+ (B+Tree) thay vì B-Tree hay hash?',
    options: [
      'Vì B+Tree tra cứu O(1)',
      'B+Tree: dữ liệu chỉ ở lá + các lá nối kề nhau (linked list) → giỏi cả tra điểm LẪN quét khoảng (range) & ORDER BY; cây thấp nên ít lần đọc đĩa. Hash chỉ tra bằng “=”, không range',
      'Vì hash không có trong MySQL',
      'B-Tree nhanh hơn nhưng tốn bộ nhớ',
    ], answer: 1,
    explain: 'B+Tree: chỉ NODE LÁ chứa dữ liệu, node trong chỉ chứa khoá → fan-out cao, cây thấp (thường 3-4 tầng cho hàng triệu bản ghi) ít lần I/O. Lá nối thành danh sách liên kết đôi → range query (BETWEEN, >, ORDER BY) rất nhanh. Hash index tra “=” O(1) nhưng vô dụng với range/sort. Vì vậy InnoDB mặc định B+Tree.',
  },
  {
    id: 'sql-idx-cluster', topic: 'MySQL / Index',
    q: 'Clustered index (index gom cụm) của InnoDB là gì và “back-to-table lookup” (tra ngược bảng) nghĩa là?',
    options: [
      'Không có khái niệm này trong MySQL',
      'Clustered = dữ liệu hàng được lưu NGAY tại lá của index khoá chính; index phụ (secondary) lá chỉ chứa khoá chính → phải tra khoá chính lần nữa để lấy đủ cột = “back-to-table lookup” (tra ngược bảng)',
      'Clustered index là index trên nhiều bảng',
      'Back-to-table lookup là thao tác xoá bảng',
    ], answer: 1,
    explain: 'InnoDB: bảng CHÍNH là clustered index theo khoá chính — lá chứa toàn bộ hàng. Secondary index lá chỉ lưu (giá trị index → khoá chính); muốn lấy cột khác phải dùng khoá chính tra clustered index lần nữa = back-to-table lookup (tốn thêm I/O). Covering index (index chứa đủ cột cần) tránh được back-to-table. Đó là lý do khoá chính nên nhỏ & tăng dần (AUTO_INCREMENT), tránh UUID ngẫu nhiên gây tách trang.',
  },
  {
    id: 'sql-idx-leftmost', topic: 'MySQL / Index',
    q: 'Với composite index (a, b, c), truy vấn nào KHÔNG dùng được index hiệu quả (leftmost prefix)?',
    sql: 'CREATE INDEX idx ON t (a, b, c);\n-- Câu nào KHÔNG tận dụng idx?',
    options: [
      'WHERE a = 1 AND b = 2',
      'WHERE b = 2 AND c = 3  (thiếu cột a đứng đầu → không khớp leftmost prefix)',
      'WHERE a = 1',
      'WHERE a = 1 AND b = 2 AND c = 3',
    ], answer: 1,
    explain: 'Quy tắc leftmost prefix: composite index (a,b,c) chỉ dùng được khi điều kiện bắt đầu từ cột a liền mạch: (a), (a,b), (a,b,c). Bỏ qua a → không dùng được index (phải full scan). Ngoài ra range (>, <, BETWEEN, LIKE ‘x%’) ở một cột sẽ CHẶN các cột sau nó dùng index cho phần bằng.',
  },
  {
    id: 'sql-iso-levels', topic: 'MySQL / Transaction',
    q: 'Bốn mức cô lập (isolation level) và lỗi mỗi mức cho phép — theo thứ tự tăng dần?',
    options: [
      'Tất cả giống nhau',
      'READ UNCOMMITTED (dirty read) < READ COMMITTED (non-repeatable read) < REPEATABLE READ (mặc định MySQL, chặn non-repeatable, InnoDB gần như chặn phantom nhờ gap lock) < SERIALIZABLE (tuần tự hoá, chậm nhất)',
      'SERIALIZABLE là mức mặc định của MySQL',
      'READ COMMITTED chặn được mọi lỗi',
    ], answer: 1,
    explain: 'Tăng dần cô lập: READ UNCOMMITTED (đọc bẩn) → READ COMMITTED (mặc định Oracle/Postgres, còn non-repeatable read) → REPEATABLE READ (mặc định MySQL/InnoDB, snapshot ổn định trong transaction; InnoDB dùng gap lock hạn chế phantom) → SERIALIZABLE (khoá đọc, an toàn nhất, chậm nhất). Đánh đổi: cô lập cao = an toàn nhưng ít đồng thời.',
  },
  {
    id: 'sql-mvcc', topic: 'MySQL / MVCC',
    q: 'MVCC (Multi-Version Concurrency Control) trong InnoDB cho phép điều gì?',
    options: [
      'Khoá toàn bảng khi đọc',
      'Đọc KHÔNG khoá (đọc bản snapshot cũ qua undo log + hidden column trx_id/roll_pointer) trong khi ghi vẫn diễn ra → đọc-ghi không chặn nhau, tăng đồng thời',
      'Chỉ cho 1 transaction chạy',
      'Xoá lịch sử phiên bản ngay lập tức',
    ], answer: 1,
    explain: 'MVCC: mỗi hàng có cột ẩn trx_id + roll_pointer trỏ vào undo log (các phiên bản cũ). Read View quyết định transaction thấy phiên bản nào → SELECT thường (snapshot read) không cần khoá, không chặn INSERT/UPDATE. Nhờ đó “readers don’t block writers, writers don’t block readers”. SELECT ... FOR UPDATE/LOCK IN SHARE MODE mới là current read (có khoá).',
  },
  {
    id: 'sql-lock-types', topic: 'MySQL / Lock',
    q: 'Record lock, gap lock và next-key lock của InnoDB khác nhau ra sao?',
    options: [
      'Đều khoá toàn bảng',
      'Record lock khoá 1 bản ghi (chỉ số); gap lock khoá KHOẢNG TRỐNG giữa các bản ghi (chặn insert vào khe → chống phantom); next-key = record + gap (mặc định ở REPEATABLE READ)',
      'Gap lock khoá cả database',
      'Không có khoá dòng trong InnoDB',
    ], answer: 1,
    explain: 'InnoDB khoá ở tầng INDEX: Record lock khoá bản ghi index cụ thể. Gap lock khoá khoảng hở giữa 2 bản ghi (không khoá bản ghi), ngăn INSERT vào khe → chống phantom read. Next-key lock = record + gap (khoá bản ghi và khoảng trước nó), là kiểu mặc định ở REPEATABLE READ. Khoá dòng chỉ hoạt động khi truy cập QUA INDEX; không có index → thoái hoá thành khoá bảng.',
  },
  {
    id: 'sql-explain-type', topic: 'MySQL / EXPLAIN',
    q: 'Trong EXPLAIN, cột `type` giá trị nào sau đây TỆ NHẤT (cần tối ưu)?',
    sql: 'EXPLAIN SELECT * FROM users WHERE age > 18;',
    options: [
      'const / eq_ref',
      'ALL (full table scan — quét toàn bảng, không dùng index)',
      'ref',
      'range',
    ], answer: 1,
    explain: 'Thứ tự type từ TỐT→TỆ: system > const > eq_ref > ref > range > index > ALL. ALL = full table scan (không index, chậm nhất với bảng lớn). index = quét toàn bộ index. range = quét theo khoảng (ổn). ref/eq_ref/const = tra qua index chọn lọc (tốt). Thấy ALL trên bảng lớn → xét thêm index. Cũng để ý cột Extra: “Using filesort”, “Using temporary” là dấu hiệu cần tối ưu.',
  },
];
