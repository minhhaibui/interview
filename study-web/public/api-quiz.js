/**
 * Ngân hàng "📡 API & HTTP" — trắc nghiệm kiến thức HTTP/REST cốt lõi cho phỏng vấn Backend.
 * status codes, idempotency/safe methods, REST, caching/ETag, auth, CORS, pagination, rate limit.
 *
 * Mỗi câu: { id, topic, q, options:[...], answer:idx, explain }
 * App hiển thị câu hỏi + options, user chọn → reveal đúng/sai + giải thích.
 */
window.API_QUIZ = [
  {
    id: 'api-201', topic: 'Status code',
    q: 'POST /users tạo mới một user thành công. Status code phù hợp nhất?',
    options: ['200 OK', '201 Created', '204 No Content', '202 Accepted'], answer: 1,
    explain: '201 Created khi một resource MỚI được tạo (thường kèm header Location trỏ resource mới). 200 dùng cho thao tác thành công chung; 202 khi xử lý bất đồng bộ chưa xong.',
  },
  {
    id: 'api-204', topic: 'Status code',
    q: 'DELETE /users/42 xoá thành công, không cần trả về body. Status code nào hợp nhất?',
    options: ['200 OK', '404 Not Found', '204 No Content', '410 Gone'], answer: 2,
    explain: '204 No Content: thành công nhưng không có body trả về — hợp cho DELETE/PUT không cần phản hồi dữ liệu.',
  },
  {
    id: 'api-401-403', topic: 'Auth',
    q: 'Khác biệt chính giữa 401 Unauthorized và 403 Forbidden?',
    options: [
      '401 = chưa/đăng nhập sai (thiếu hoặc sai credential); 403 = đã xác thực nhưng KHÔNG đủ quyền',
      '401 và 403 giống hệt nhau',
      '401 = không đủ quyền; 403 = chưa đăng nhập',
      '403 chỉ dùng cho lỗi server',
    ], answer: 0,
    explain: '401 = "chưa biết bạn là ai / credential sai" → cần xác thực lại. 403 = "biết bạn là ai rồi nhưng bạn không được phép" → xác thực lại cũng vô ích.',
  },
  {
    id: 'api-idempotent', topic: 'HTTP methods',
    q: 'Method nào sau đây KHÔNG idempotent (gọi nhiều lần cho kết quả khác)?',
    options: ['GET', 'PUT', 'DELETE', 'POST'], answer: 3,
    explain: 'POST không idempotent — gọi 2 lần thường tạo 2 resource. GET/PUT/DELETE idempotent: lặp lại không đổi trạng thái thêm (DELETE lần 2 vẫn "đã xoá").',
  },
  {
    id: 'api-safe', topic: 'HTTP methods',
    q: 'Method "safe" (không làm thay đổi trạng thái server) là?',
    options: ['POST', 'GET', 'PUT', 'PATCH'], answer: 1,
    explain: 'GET (và HEAD, OPTIONS) là safe: chỉ đọc, không thay đổi dữ liệu. POST/PUT/PATCH/DELETE đều thay đổi trạng thái.',
  },
  {
    id: 'api-put-patch', topic: 'HTTP methods',
    q: 'Khác biệt giữa PUT và PATCH?',
    options: [
      'PUT thay thế TOÀN BỘ resource; PATCH cập nhật MỘT PHẦN (chỉ field gửi lên)',
      'PUT cập nhật một phần; PATCH thay thế toàn bộ',
      'Hai cái giống hệt nhau',
      'PATCH chỉ dùng để xoá',
    ], answer: 0,
    explain: 'PUT mang ý nghĩa thay thế toàn bộ representation (idempotent). PATCH áp dụng thay đổi một phần. PATCH có thể không idempotent tùy cách định nghĩa.',
  },
  {
    id: 'api-409', topic: 'Status code',
    q: 'Tạo user với email đã tồn tại (vi phạm ràng buộc unique). Status code phù hợp?',
    options: ['400 Bad Request', '409 Conflict', '422 Unprocessable Entity', '500 Internal Server Error'], answer: 1,
    explain: '409 Conflict: yêu cầu xung đột với trạng thái hiện tại của resource (trùng unique, version conflict). Một số API dùng 422 cho lỗi validation nghiệp vụ — nhưng "đã tồn tại" đúng nghĩa là Conflict.',
  },
  {
    id: 'api-422', topic: 'Status code',
    q: 'Body đúng JSON cú pháp nhưng sai nghiệp vụ (vd tuổi âm). Nhiều REST API dùng status nào?',
    options: ['400 Bad Request', '422 Unprocessable Entity', '406 Not Acceptable', '415 Unsupported Media Type'], answer: 1,
    explain: '422 Unprocessable Entity: cú pháp hợp lệ nhưng không xử lý được về mặt ngữ nghĩa (lỗi validation). 400 dùng khi request hỏng cú pháp/không parse được. (Cả hai đều chấp nhận được tùy quy ước team.)',
  },
  {
    id: 'api-429', topic: 'Rate limit',
    q: 'Client gọi quá hạn mức rate limit. Server nên trả status nào + header gì?',
    options: [
      '503 + Retry-After',
      '429 Too Many Requests + Retry-After',
      '403 Forbidden + WWW-Authenticate',
      '400 Bad Request',
    ], answer: 1,
    explain: '429 Too Many Requests báo vượt rate limit; kèm header Retry-After (hoặc X-RateLimit-Reset) để client biết khi nào thử lại.',
  },
  {
    id: 'api-304', topic: 'Caching',
    q: 'Client gửi request kèm If-None-Match và ETag chưa đổi. Server trả về?',
    options: ['200 OK kèm full body', '304 Not Modified (không body)', '204 No Content', '412 Precondition Failed'], answer: 1,
    explain: '304 Not Modified: tài nguyên chưa thay đổi (ETag khớp) → không gửi lại body, client dùng bản cache. Tiết kiệm băng thông.',
  },
  {
    id: 'api-etag', topic: 'Caching',
    q: 'ETag dùng để làm gì?',
    options: [
      'Mã hoá body response',
      '"Vân tay" phiên bản resource — client gửi lại để kiểm tra cache còn hợp lệ / chống lost update',
      'Token xác thực người dùng',
      'Định tuyến load balancer',
    ], answer: 1,
    explain: 'ETag là fingerprint của một phiên bản resource. Dùng cho conditional request (If-None-Match → 304) và optimistic concurrency (If-Match → 412 nếu đã đổi).',
  },
  {
    id: 'api-cache-control', topic: 'Caching',
    q: 'Header nào điều khiển cách cache (thời gian, public/private, no-store)?',
    options: ['Content-Type', 'Cache-Control', 'Accept', 'Authorization'], answer: 1,
    explain: 'Cache-Control (vd `max-age=3600`, `no-store`, `private`) là cơ chế cache chính của HTTP. `Expires` là cách cũ; `ETag`/`Last-Modified` cho revalidation.',
  },
  {
    id: 'api-rest-stateless', topic: 'REST',
    q: 'Nguyên tắc "stateless" của REST nghĩa là gì?',
    options: [
      'Server không bao giờ lưu dữ liệu vào database',
      'Mỗi request chứa đủ thông tin để xử lý; server KHÔNG lưu session state giữa các request',
      'Client không được giữ state nào',
      'API chỉ dùng GET',
    ], answer: 1,
    explain: 'Stateless: server không lưu ngữ cảnh phiên giữa các request — mỗi request tự đủ (vd kèm token auth). Giúp scale ngang dễ (request nào cũng tới instance nào cũng được).',
  },
  {
    id: 'api-bearer', topic: 'Auth',
    q: 'Gửi JWT/access token trong request, header chuẩn là?',
    options: [
      'Cookie: token=...',
      'Authorization: Bearer <token>',
      'X-Token: <token>',
      'Auth: <token>',
    ], answer: 1,
    explain: 'Chuẩn: `Authorization: Bearer <token>` cho token-based auth (JWT/OAuth2). Basic auth dùng `Authorization: Basic <base64(user:pass)>`.',
  },
  {
    id: 'api-cors', topic: 'CORS',
    q: 'CORS (Cross-Origin Resource Sharing) giải quyết vấn đề gì?',
    options: [
      'Mã hoá dữ liệu truyền',
      'Cho phép trình duyệt ở origin A gọi API ở origin B một cách có kiểm soát (qua header Access-Control-Allow-*)',
      'Nén response',
      'Cân bằng tải',
    ], answer: 1,
    explain: 'CORS là cơ chế trình duyệt: theo same-origin policy, JS không gọi được cross-origin trừ khi server trả header Access-Control-Allow-Origin... Preflight OPTIONS kiểm tra trước với request "không đơn giản".',
  },
  {
    id: 'api-idem-key', topic: 'Reliability',
    q: 'Để POST /payments an toàn khi client retry do timeout (không charge 2 lần), dùng kỹ thuật gì?',
    options: [
      'Idempotency-Key: client gửi key duy nhất, server lưu kết quả theo key',
      'Tăng timeout lên thật lớn',
      'Chuyển sang GET',
      'Bỏ retry hoàn toàn',
    ], answer: 0,
    explain: 'Idempotency key: client gắn key duy nhất cho mỗi thao tác; server lưu kết quả theo key → retry cùng key trả lại kết quả cũ thay vì tạo giao dịch mới. Chuẩn cho payment/POST quan trọng.',
  },
  {
    id: 'api-pagination', topic: 'API design',
    q: 'API trả danh sách rất lớn, đổi liên tục. Kiểu phân trang nào ổn định & nhanh ở trang sâu?',
    options: [
      'Offset/limit (OFFSET 100000)',
      'Cursor/keyset pagination (WHERE id > last_id)',
      'Tải hết một lần',
      'Random sampling',
    ], answer: 1,
    explain: 'Cursor/keyset pagination nhanh ở trang sâu (dùng index theo cursor) và ổn định khi dữ liệu chèn/xoá. Offset lớn vừa chậm (phải đếm bỏ qua) vừa lệch khi data đổi.',
  },
  {
    id: 'api-500-502-503', topic: 'Status code',
    q: 'API Gateway gọi upstream service nhưng service đó đang chết/không phản hồi. Gateway nên trả?',
    options: ['500 Internal Server Error', '502 Bad Gateway / 503 Service Unavailable', '400 Bad Request', '404 Not Found'], answer: 1,
    explain: '502 Bad Gateway (upstream trả phản hồi không hợp lệ) hoặc 503 Service Unavailable (tạm quá tải/đang bảo trì), 504 nếu upstream timeout. 500 là lỗi nội tại chung của chính server đó.',
  },
  {
    id: 'api-301-302', topic: 'Redirect',
    q: 'Khác biệt giữa 301 Moved Permanently và 302 Found?',
    options: [
      '301 và 302 giống hệt nhau',
      '301 = chuyển VĨNH VIỄN (client/SEO nên cập nhật URL mới, được cache); 302 = chuyển TẠM THỜI (giữ URL gốc)',
      '302 là một mã lỗi phía client',
      '301 chỉ dùng được với HTTPS',
    ], answer: 1,
    explain: '301 báo URL đã đổi vĩnh viễn → trình duyệt & search engine cập nhật và cache lại. 302 (và 307) là chuyển tạm thời → giữ URL gốc. Lỡ dùng 301 cho redirect tạm sẽ bị cache "dính" rất khó gỡ.',
  },
  {
    id: 'api-head', topic: 'HTTP method',
    q: 'Method HEAD khác GET ở điểm nào?',
    options: [
      'HEAD ghi dữ liệu lên server',
      'HEAD giống POST, có body request',
      'HEAD giống GET nhưng server CHỈ trả headers (không body) — kiểm tra tồn tại / Content-Length / Last-Modified mà không tải nội dung',
      'HEAD không tồn tại trong HTTP',
    ], answer: 2,
    explain: 'HEAD giống hệt GET nhưng phản hồi CHỈ có headers, bỏ body. Hữu ích để kiểm tra resource có tồn tại, kích thước (Content-Length), hay đã đổi chưa (Last-Modified/ETag) trước khi tải. HEAD là safe và idempotent.',
  },
  {
    id: 'api-cookie-flags', topic: 'Bảo mật',
    q: 'Cookie chứa phiên đăng nhập nên đặt các cờ nào để an toàn?',
    options: [
      'Chỉ cần Expires là đủ',
      'HttpOnly (JS không đọc được → chống XSS trộm cookie) + Secure (chỉ gửi qua HTTPS) + SameSite (chống CSRF)',
      'Path=/ là đã an toàn',
      'Đặt Domain=* cho tiện dùng',
    ], answer: 1,
    explain: 'HttpOnly chặn JavaScript đọc cookie → giảm rủi ro đánh cắp qua XSS. Secure đảm bảo cookie chỉ truyền trên HTTPS. SameSite (Lax/Strict) hạn chế gửi cookie trong request cross-site → chống CSRF. Bộ ba này là chuẩn cho cookie nhạy cảm.',
  },
  {
    id: 'api-versioning', topic: 'REST design',
    q: 'Cách phổ biến để đánh version một REST API?',
    options: [
      'Không bao giờ cần version API',
      'Đổi tên toàn bộ endpoint mỗi lần sửa',
      'Nhúng version vào URL (/v1/users) hoặc qua header (Accept: application/vnd.api.v2+json)',
      'Chỉ version bằng cách đổi số cổng',
    ], answer: 2,
    explain: 'Hai cách hay dùng: (1) version trong URL path /v1/, /v2/ — dễ thấy, dễ route/cache; (2) version qua header (content negotiation) — URL "sạch" nhưng khó debug hơn. Mấu chốt là KHÔNG phá client cũ khi ra phiên bản mới (backward compatibility).',
  },
  {
    id: 'api-413', topic: 'Status code',
    q: 'Client upload file vượt quá giới hạn kích thước server cho phép. Status code phù hợp nhất?',
    options: ['413 Payload Too Large', '400 Bad Request', '507 Insufficient Storage', '200 OK'], answer: 0,
    explain: '413 Content/Payload Too Large: body của request vượt giới hạn server chấp nhận (vd upload quá to). 507 nói về dung lượng LƯU TRỮ của server, khác ngữ cảnh. Nên đặt giới hạn body rõ ràng để tránh lạm dụng bộ nhớ.',
  },
  {
    id: 'api-retry-after', topic: 'Rate limit',
    q: 'Server trả 429 Too Many Requests (hoặc 503). Header nào cho client biết khi nào nên thử lại?',
    options: ['X-Forwarded-For', 'Content-Type', 'ETag', 'Retry-After (số giây hoặc mốc thời gian nên chờ trước khi gọi lại)'], answer: 3,
    explain: 'Retry-After cho client biết nên đợi bao lâu trước khi retry (giá trị là số giây hoặc HTTP-date). Client lịch sự nên tôn trọng nó kết hợp exponential backoff. Thường đi kèm 429 (rate limit) và 503 (tạm quá tải/bảo trì).',
  },
  {
    id: 'api-preflight', topic: 'CORS',
    q: 'Khi nào trình duyệt gửi request "preflight" OPTIONS trước request thật (CORS)?',
    options: [
      'Với mọi request cross-origin, không có ngoại lệ',
      'Chỉ khi request là "non-simple" — vd method PUT/DELETE, hoặc có header tuỳ chỉnh / Content-Type application/json',
      'Chỉ với request GET',
      'Chỉ khi server bật HTTPS',
    ], answer: 1,
    explain: 'Request "simple" (GET/POST/HEAD với vài Content-Type cơ bản như form/text, không header lạ) KHÔNG cần preflight. Request "non-simple" (PUT/DELETE/PATCH, có header tuỳ chỉnh, hoặc Content-Type: application/json) khiến trình duyệt gửi OPTIONS trước để hỏi server có cho phép không (Access-Control-Allow-*).',
  },
  {
    id: 'api-jwt-stateless', topic: 'Auth',
    q: 'Nhược điểm chính của JWT (JSON Web Token) so với session lưu ở server là gì?',
    options: [
      'JWT không thể mang thông tin user',
      'JWT khó THU HỒI trước khi hết hạn vì server không lưu trạng thái',
      'JWT bắt buộc phải dùng cookie',
      'JWT không dùng được với HTTPS',
    ], answer: 1,
    explain: 'JWT là stateless & self-contained: server chỉ verify chữ ký, không tra DB. Ưu điểm là scale tốt, nhưng vì server không lưu, muốn THU HỒI (logout, ban) một token trước hạn thì phải thêm cơ chế (blacklist, token version, hạn ngắn + refresh token). Session server-side thì xoá là mất hiệu lực ngay.',
  },
  {
    id: 'api-202-async', topic: 'Status code',
    q: 'Client gửi yêu cầu xử lý nặng (vd xuất báo cáo), server nhận và xử lý NỀN bất đồng bộ. Status code phù hợp?',
    options: ['200 OK', '201 Created', '202 Accepted', '204 No Content'], answer: 2,
    explain: '202 Accepted: yêu cầu đã được TIẾP NHẬN nhưng CHƯA xử lý xong. Thường trả kèm một URL/id để client poll trạng thái (vd GET /jobs/{id}) hoặc dùng webhook báo khi xong. Tránh giữ kết nối chờ tác vụ dài.',
  },
  {
    id: 'api-406-415', topic: 'Content negotiation',
    q: 'Client gửi `Content-Type: application/xml` nhưng API chỉ nhận JSON. Status code đúng nhất?',
    options: [
      '400 Bad Request',
      '406 Not Acceptable',
      '415 Unsupported Media Type',
      '422 Unprocessable Entity',
    ], answer: 2,
    explain: '415 Unsupported Media Type: server từ chối vì ĐỊNH DẠNG BODY (Content-Type) không được hỗ trợ. Phân biệt: 406 Not Acceptable là khi server không tạo được định dạng client YÊU CẦU qua header Accept (chiều response); 422 là body đúng định dạng nhưng sai nghiệp vụ.',
  },
  {
    id: 'api-206-range', topic: 'Caching / streaming',
    q: 'Trình phát video tua tới giữa clip bằng header `Range: bytes=1000000-`. Server trả status nào khi gửi một phần?',
    options: ['200 OK', '206 Partial Content', '204 No Content', '302 Found'], answer: 1,
    explain: '206 Partial Content: server hỗ trợ Range request và trả về ĐÚNG khúc byte được yêu cầu (kèm header Content-Range). Cực quan trọng cho stream video/audio và resume tải file. Server báo hỗ trợ qua Accept-Ranges: bytes.',
  },
  {
    id: 'api-idempotent-methods', topic: 'HTTP methods',
    q: 'Nhóm method nào SAU đây đều idempotent (gọi nhiều lần cho cùng kết quả trạng thái)?',
    options: [
      'GET, PUT, DELETE',
      'POST, PATCH, GET',
      'POST, PUT, DELETE',
      'PATCH, POST, GET',
    ], answer: 0,
    explain: 'GET (chỉ đọc), PUT (ghi đè toàn bộ về cùng trạng thái) và DELETE (xoá — gọi lại vẫn "đã xoá") đều IDEMPOTENT. POST thường KHÔNG (tạo mới mỗi lần → cần idempotency key để an toàn khi retry). PATCH có thể idempotent hoặc không, tuỳ nội dung sửa.',
  },
];
