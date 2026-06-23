/*
 * Ngân hàng câu Xử lý tình huống (Situational Judgement) + case sự cố production.
 * Trắc nghiệm chọn cách xử lý TỐT NHẤT; có giải thích vì sao.
 * { id, type:'behavioral'|'incident', q, options:[...], answer:<chỉ số>, explain }
 */
window.SITUATIONAL_QUESTIONS = [
  // ---- Hành vi / làm việc nhóm ----
  { id: 'sit1', type: 'behavioral', q: 'Bạn nhận một task nhưng chưa hiểu rõ yêu cầu. Nên làm gì?', options: ['Cứ code theo cách hiểu của mình', 'Hỏi lại người giao để làm rõ trước khi bắt đầu', 'Để đó chờ người khác làm', 'Làm đại rồi sửa sau'], answer: 1,
    explain: 'Làm rõ yêu cầu sớm tránh làm sai phải làm lại — tiết kiệm thời gian cho cả nhóm.' },
  { id: 'sit2', type: 'behavioral', q: 'Khi review, bạn thấy code đồng nghiệp có lỗ hổng bảo mật. Cách xử lý tốt nhất?', options: ['Im lặng cho qua', 'Báo sếp để phạt họ', 'Comment thẳng vào PR, chỉ rõ vấn đề và đề xuất cách sửa', 'Tự ý sửa mà không nói'], answer: 2,
    explain: 'Góp ý trực tiếp, mang tính xây dựng trong review là chuẩn mực — minh bạch và giúp người khác học.' },
  { id: 'sit3', type: 'behavioral', q: 'Sắp đến deadline mà tính năng chưa xong. Nên?', options: ['Giấu đến phút chót', 'Báo sớm cho quản lý và đề xuất phương án (giảm scope/xin thêm thời gian)', 'Làm ẩu cho kịp', 'Đổ lỗi cho yêu cầu thay đổi'], answer: 1,
    explain: 'Báo sớm + đề xuất giải pháp giúp team kịp điều chỉnh kế hoạch, thể hiện trách nhiệm.' },
  { id: 'sit4', type: 'behavioral', q: 'Bạn bất đồng quan điểm kỹ thuật với đồng nghiệp. Nên?', options: ['Tranh cãi cho tới khi thắng', 'Nghe theo người nói to hơn', 'Đưa dữ liệu/đo đạc và thử nghiệm để cùng quyết định', 'Mặc kệ, làm theo ý mình'], answer: 2,
    explain: 'Quyết định dựa trên dữ liệu và bằng chứng (POC, benchmark) thay vì cảm tính hay thâm niên.' },
  { id: 'sit5', type: 'behavioral', q: 'Được giao công nghệ mới bạn chưa từng dùng. Phản ứng tốt nhất?', options: ['Từ chối vì chưa biết', 'Chủ động đọc tài liệu, làm một POC nhỏ để học', 'Chờ người khác hướng dẫn từng bước', 'Dùng đại không tìm hiểu'], answer: 1,
    explain: 'Tinh thần tự học + thử nghiệm nhỏ (POC) là phẩm chất được đánh giá cao.' },
  { id: 'sit6', type: 'behavioral', q: 'Code review của bạn bị nhận nhiều góp ý gắt gao. Nên?', options: ['Tự ái và phản bác', 'Tách cảm xúc, tiếp thu phần chuyên môn, hỏi lại chỗ chưa rõ', 'Bỏ qua hết góp ý', 'Nghỉ làm vì bị chê'], answer: 1,
    explain: 'Góp ý nhắm vào code, không phải con người — tiếp thu để tiến bộ.' },
  { id: 'sit7', type: 'behavioral', q: 'Bạn vô tình xóa nhầm dữ liệu trên production. Nên?', options: ['Giấu đi và hy vọng không ai biết', 'Báo ngay cho team và khôi phục từ backup, minh bạch nguyên nhân', 'Đổ cho hệ thống lỗi', 'Tự khắc phục lặng lẽ rồi quên đi'], answer: 1,
    explain: 'Minh bạch + khôi phục nhanh từ backup giảm thiệt hại; che giấu khiến sự cố tệ hơn.' },
  { id: 'sit8', type: 'behavioral', q: 'Sau một sự cố, buổi post-mortem nên tập trung vào điều gì?', options: ['Tìm người để đổ lỗi', 'Cải tiến quy trình & hệ thống để không tái diễn (blameless)', 'Phạt người gây lỗi', 'Bỏ qua cho nhanh'], answer: 1,
    explain: 'Post-mortem "blameless" tập trung vào hệ thống/quy trình, giúp đội học hỏi mà không sợ hãi.' },

  // ---- Case sự cố production ----
  { id: 'sit9', type: 'incident', q: 'API production trả lỗi 500 hàng loạt ngay sau khi deploy. Bước ĐẦU TIÊN nên làm?', options: ['Sửa code trực tiếp trên production', 'Xem log & metrics để đánh giá mức ảnh hưởng, cân nhắc rollback bản vừa deploy', 'Khởi động lại toàn bộ server', 'Chờ xem có tự hết không'], answer: 1,
    explain: 'Ưu tiên giảm tác động: đánh giá nhanh qua log/metrics và rollback nếu lỗi đến từ bản mới — root cause tính sau.' },
  { id: 'sit10', type: 'incident', q: 'Database CPU tăng vọt lên 100% ngay sau một lần deploy. Nghi ngờ đầu tiên?', options: ['Phần cứng hỏng', 'Query mới hoặc thiếu index từ bản vừa deploy (xem slow query log)', 'Do người dùng tăng đột biến ngẫu nhiên', 'Mạng bị nghẽn'], answer: 1,
    explain: 'Trùng thời điểm deploy ⇒ nghi query/migration mới hoặc thiếu index; xem slow query, cân nhắc rollback.' },
  { id: 'sit11', type: 'incident', q: 'Redis (cache) bị sập. Hệ thống được thiết kế tốt nên?', options: ['Sập theo Redis', 'Vẫn chạy được nhờ fallback đọc thẳng từ DB (suy giảm nhẹ, chậm hơn)', 'Trả lỗi 500 cho mọi request', 'Mất toàn bộ dữ liệu'], answer: 1,
    explain: 'Cache nên là tối ưu, không phải điểm chết: mất cache thì degrade gracefully (chậm hơn) chứ không sập.' },
  { id: 'sit12', type: 'incident', q: 'Một pod bị restart liên tục do rò rỉ bộ nhớ (memory leak). Giải pháp TẠM THỜI hợp lý?', options: ['Bỏ mặc', 'Tăng giới hạn RAM/scale thêm và restart định kỳ để giảm tác động, song song tìm nguyên nhân gốc', 'Xóa toàn bộ dữ liệu', 'Tắt hẳn dịch vụ'], answer: 1,
    explain: 'Mitigate trước (tăng RAM/scale, restart định kỳ) để dịch vụ ổn định, rồi mới điều tra & vá leak.' },
  { id: 'sit13', type: 'incident', q: 'Khách báo bug nghiêm trọng lúc 10h tối. Ưu tiên SỐ MỘT của bạn?', options: ['Tìm bằng được ai gây ra lỗi', 'Đánh giá mức ảnh hưởng và giảm thiểu/khắc phục tác động cho người dùng trước', 'Viết báo cáo dài', 'Đợi sáng mai xử lý'], answer: 1,
    explain: 'Trong sự cố, ưu tiên khôi phục dịch vụ cho người dùng (mitigate) trước; phân tích nguyên nhân làm sau.' },
  { id: 'sit14', type: 'incident', q: 'Một endpoint thỉnh thoảng chậm bất thường, khó tái hiện. Hướng điều tra tốt nhất?', options: ['Đoán mò rồi sửa đại', 'Thêm log/trace & đo p95–p99, tìm điểm nghẽn (DB, lock, GC, N+1) theo dữ liệu', 'Khởi động lại server mỗi khi chậm', 'Phớt lờ vì hiếm khi xảy ra'], answer: 1,
    explain: 'Lỗi hiệu năng khó tái hiện cần đo đạc (tracing, percentile latency) để tìm nghẽn thật, không đoán mò.' },
];
