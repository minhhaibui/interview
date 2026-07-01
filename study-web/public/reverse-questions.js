/**
 * Ngân hàng "💬 Câu hỏi NÊN HỎI nhà tuyển dụng" — kỹ năng phỏng vấn hay bị bỏ quên.
 * Cuối buổi phỏng vấn thường có "Bạn có câu hỏi gì cho chúng tôi không?" — hỏi câu
 * hay thể hiện sự nghiêm túc, tư duy kỹ sư và giúp BẠN đánh giá ngược công ty.
 *
 * Mỗi nhóm: { id, group, icon, note?, items: [{ q, why }] }  (q = câu hỏi, why = vì sao nên hỏi)
 * Đây là NỘI DUNG THAM KHẢO (không phải quiz) — render dạng accordion, không chấm điểm.
 */
window.REVERSE_QUESTIONS = [
  {
    id: 'rq-tech', group: 'Về kỹ thuật & hệ thống', icon: '🧑‍💻',
    items: [
      { q: 'Tech stack backend hiện tại là gì, và service được deploy & scale ra sao?', why: 'Cho thấy bạn quan tâm kiến trúc thật, không chỉ ngôn ngữ. Hé lộ độ trưởng thành hạ tầng.' },
      { q: 'Team đang gặp thách thức kỹ thuật lớn nhất nào ở thời điểm này?', why: 'Câu trả lời cho biết công việc thực tế sẽ ra sao và mức độ nợ kỹ thuật.' },
      { q: 'Quy trình review code, CI/CD và cách release lên production như thế nào?', why: 'Đo văn hoá chất lượng: có test/automation hay deploy thủ công, rủi ro cao.' },
      { q: 'Hệ thống xử lý bao nhiêu traffic, và phần nào thường là bottleneck?', why: 'Thể hiện tư duy về scale & performance — điểm cộng cho vị trí Backend.' },
      { q: 'Team quan sát (observability) & xử lý sự cố production ra sao — có on-call không?', why: 'Giúp bạn biết áp lực vận hành và mức độ đầu tư vào monitoring/alerting.' },
    ],
  },
  {
    id: 'rq-team', group: 'Về team & cách làm việc', icon: '👥',
    items: [
      { q: 'Team có bao nhiêu người, cơ cấu ra sao (backend/frontend/QA/DevOps)?', why: 'Hiểu bạn sẽ làm cùng ai và ranh giới trách nhiệm.' },
      { q: 'Team theo quy trình nào (Scrum/Kanban), sprint dài bao lâu?', why: 'Cho biết nhịp làm việc và mức độ họp hành/planning.' },
      { q: 'Một ngày làm việc điển hình của vị trí này trông như thế nào?', why: 'Kỳ vọng thực tế về tỉ lệ code vs họp vs support.' },
      { q: 'Anh/chị thích điều gì nhất khi làm ở đây, và điều gì muốn cải thiện?', why: 'Câu hỏi cá nhân hoá tạo thiện cảm, và câu trả lời thật thường rất tiết lộ.' },
    ],
  },
  {
    id: 'rq-role', group: 'Về vai trò & kỳ vọng', icon: '📈',
    items: [
      { q: 'Trong 3–6 tháng đầu, thành công của người vào vị trí này được đo bằng gì?', why: 'Cho thấy bạn định hướng kết quả (outcome) và giúp bạn biết cần tập trung vào đâu.' },
      { q: 'Vị trí này mở ra vì team mở rộng hay thay thế người cũ?', why: 'Ngữ cảnh quan trọng: đội đang lớn lên hay đang có vấn đề giữ người.' },
      { q: 'Ai sẽ là người quản lý trực tiếp, và phong cách quản lý ra sao?', why: 'Quan hệ với line-manager ảnh hưởng lớn tới trải nghiệm làm việc.' },
    ],
  },
  {
    id: 'rq-growth', group: 'Về phát triển & lộ trình', icon: '🚀',
    items: [
      { q: 'Công ty hỗ trợ học tập/phát triển thế nào (mentor, budget khoá học, hội thảo)?', why: 'Thể hiện bạn muốn phát triển lâu dài, không chỉ nhận lương.' },
      { q: 'Lộ trình thăng tiến từ vị trí này thường đi như thế nào?', why: 'Cho thấy bạn nghĩ dài hạn; đo xem công ty có khung phát triển rõ ràng.' },
      { q: 'Kỹ sư ở đây thường học được điều gì trong năm đầu tiên?', why: 'Câu trả lời cụ thể chứng tỏ môi trường có đầu tư cho con người.' },
    ],
  },
  {
    id: 'rq-process', group: 'Về bước tiếp theo', icon: '📝',
    items: [
      { q: 'Các bước tiếp theo của quy trình tuyển dụng là gì và khi nào có kết quả?', why: 'Chuyên nghiệp, giúp bạn chủ động theo dõi và quản lý kỳ vọng.' },
      { q: 'Có điều gì trong hồ sơ/buổi trao đổi khiến anh/chị còn băn khoăn về tôi không?', why: 'Câu hỏi dũng cảm — cho bạn cơ hội GỠ nghi ngại ngay tại chỗ.' },
    ],
  },
  {
    id: 'rq-avoid', group: 'Nên TRÁNH hỏi (ở vòng đầu)', icon: '⚠️',
    note: 'Không phải cấm — nhưng hỏi quá sớm dễ tạo ấn tượng chỉ quan tâm quyền lợi. Để dành khi đã có offer.',
    items: [
      { q: '“Lương/thưởng bao nhiêu?” ngay vòng kỹ thuật đầu', why: 'Nên bàn khi tới bước thương lượng offer, không phải lúc đang đánh giá năng lực.' },
      { q: '“Có phải OT nhiều không?” hỏi kiểu dò xét', why: 'Nên hỏi khéo qua “một ngày điển hình” / “văn hoá work-life balance” thay vì hỏi thẳng tiêu cực.' },
      { q: '“Công ty làm sản phẩm gì?” — thứ có thể tự tìm hiểu trước', why: 'Chứng tỏ chưa chuẩn bị. Hãy nghiên cứu công ty trước và hỏi câu SÂU hơn.' },
    ],
  },
];
