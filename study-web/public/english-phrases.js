/**
 * Ngân hàng "🇬🇧 Mẫu câu tiếng Anh khi phỏng vấn" — dành cho dev Việt phỏng vấn
 * (một phần) bằng tiếng Anh. NỘI DUNG THAM KHẢO (không chấm điểm), render accordion.
 *
 * Mỗi nhóm: { id, group, icon, items: [{ en, vi }] }  (en = câu mẫu, vi = nghĩa/khi nào dùng)
 */
window.ENGLISH_PHRASES = [
  {
    id: 'ep-intro', group: 'Giới thiệu bản thân', icon: '👋',
    items: [
      { en: "Hi, I'm Nam. I'm a backend developer with around three years of experience, mostly with Node.js and PostgreSQL.", vi: 'Mở đầu chuẩn: tên + vai trò + số năm kinh nghiệm + công nghệ chính.' },
      { en: "In my current role, I'm responsible for designing and maintaining REST APIs and improving system performance.", vi: 'Nêu trách nhiệm hiện tại — dùng thì hiện tại tiếp diễn cho việc đang làm.' },
      { en: "I'm particularly interested in scalable systems and clean, well-tested code.", vi: 'Thể hiện điểm mạnh/đam mê, dẫn sang phần chuyên môn.' },
      { en: "I'm looking for a role where I can grow technically and take on more ownership.", vi: 'Lý do tìm việc — tích cực, hướng phát triển (tránh chê công ty cũ).' },
    ],
  },
  {
    id: 'ep-exp', group: 'Nói về kinh nghiệm & dự án', icon: '💼',
    items: [
      { en: "One project I'm proud of is a payment service that handles about 500 requests per second.", vi: 'Giới thiệu dự án kèm CON SỐ cụ thể để tạo ấn tượng.' },
      { en: "My main responsibility was the order-processing module, from database design to the API layer.", vi: 'Làm rõ vai trò CÁ NHÂN trong dự án (tránh nói chung chung "we").' },
      { en: "We used Redis for caching and Kafka for asynchronous processing between services.", vi: 'Nêu công nghệ và LÝ DO dùng — cho thấy quyết định có chủ đích.' },
      { en: "As a result, we reduced the p95 latency from 800 milliseconds to under 200.", vi: 'Chốt bằng kết quả đo được — mẫu câu "reduced X from … to …".' },
    ],
  },
  {
    id: 'ep-star', group: 'Trả lời behavioral (STAR) bằng tiếng Anh', icon: '🌟',
    items: [
      { en: "Sure, let me give you an example. (Situation) Last year, our API started timing out during peak hours.", vi: 'Bắt đầu STAR — "let me give you an example" rồi dựng bối cảnh.' },
      { en: "(Task) I was asked to find the root cause and fix it without downtime.", vi: 'Nêu nhiệm vụ được giao rõ ràng.' },
      { en: "(Action) I profiled the queries, found an N+1 problem, and added proper indexes and eager loading.", vi: 'Hành động của BẠN — động từ mạnh, cụ thể, ngôi "I".' },
      { en: "(Result) After that, response time dropped by 60% and the timeouts disappeared.", vi: 'Kết quả định lượng — mẫu "dropped by X%".' },
    ],
  },
  {
    id: 'ep-buytime', group: 'Khi chưa chắc / cần thời gian suy nghĩ', icon: '🧩',
    items: [
      { en: "That's a good question. Let me think about it for a second.", vi: 'Câu "mua thời gian" lịch sự thay vì im lặng lúng túng.' },
      { en: "I haven't worked with that specific tool, but based on my experience with similar ones, I'd approach it like this…", vi: 'Thành thật chưa biết NHƯNG chuyển sang cái tương tự bạn biết.' },
      { en: "Just to make sure I understand correctly, are you asking about…?", vi: 'Làm rõ câu hỏi trước khi trả lời — tránh trả lời lạc đề.' },
      { en: "Let me walk you through my thought process.", vi: 'Dẫn dắt khi giải bài — nhà tuyển dụng muốn nghe cách bạn NGHĨ.' },
    ],
  },
  {
    id: 'ep-clarify', group: 'Hỏi lại & làm rõ yêu cầu', icon: '❓',
    items: [
      { en: "Could you clarify what you mean by …?", vi: 'Hỏi lại khi chưa rõ một thuật ngữ/yêu cầu.' },
      { en: "Should I optimize for read performance or write performance here?", vi: 'Câu hỏi làm rõ trade-off khi thiết kế hệ thống — điểm cộng lớn.' },
      { en: "What's the expected scale — thousands or millions of users?", vi: 'Hỏi quy mô trước khi thiết kế; thể hiện tư duy đúng.' },
      { en: "Sorry, could you repeat that? I didn't quite catch it.", vi: 'Nhờ nhắc lại lịch sự khi nghe chưa rõ (audio/accent).' },
    ],
  },
  {
    id: 'ep-close', group: 'Kết thúc & hỏi ngược', icon: '🤝',
    items: [
      { en: "Thank you for walking me through the role. I have a couple of questions, if that's okay.", vi: 'Chuyển sang phần bạn đặt câu hỏi — lịch sự.' },
      { en: "What does success look like for this position in the first six months?", vi: 'Câu hỏi ngược thông minh về kỳ vọng (xem thêm tab 🏢).' },
      { en: "I really enjoyed our conversation and I'm excited about this opportunity.", vi: 'Câu chốt thể hiện sự hào hứng — để lại ấn tượng cuối tốt.' },
      { en: "When can I expect to hear back about the next steps?", vi: 'Hỏi về bước tiếp theo — chủ động và chuyên nghiệp.' },
    ],
  },
  {
    id: 'ep-smalltalk', group: 'Small talk mở đầu & sự cố video call', icon: '☕',
    items: [
      { en: "Hi, nice to meet you! Thanks for taking the time to talk with me today.", vi: 'Câu chào mở đầu an toàn, thân thiện cho mọi buổi phỏng vấn.' },
      { en: "Can you hear me clearly? My connection seems a bit unstable today.", vi: 'Kiểm tra/báo sự cố mạng khi phỏng vấn online — bình tĩnh, không cuống.' },
      { en: "Sorry, you cut out for a second — could you repeat the last part?", vi: '"cut out" = mất tiếng giữa chừng; xin nhắc lại phần vừa nghe sót.' },
      { en: "I'm doing well, thanks! A bit excited about this conversation, actually.", vi: 'Đáp "How are you?" tự nhiên + thể hiện thiện chí (thay vì chỉ "fine").' },
    ],
  },
  {
    id: 'ep-leaving', group: 'Lý do nghỉ việc / khoảng trống CV', icon: '🚪',
    items: [
      { en: "I've learned a lot in my current role, but I'm looking for new technical challenges.", vi: 'Công thức an toàn: ghi nhận chỗ cũ + hướng về phía trước. KHÔNG chê công ty cũ.' },
      { en: "I'm looking for an environment with a stronger engineering culture and more room to grow.", vi: 'Nói về "fit" và phát triển — tích cực, không đổ lỗi.' },
      { en: "The company went through a restructuring, and my team was affected.", vi: 'Nói về layoff một cách trung tính — chuyện bình thường, không cần xấu hổ.' },
      { en: "I took some time off to upskill — I focused on system design and improving my English.", vi: 'Giải thích khoảng trống CV bằng việc CÓ CHỦ ĐÍCH (học, dự án cá nhân).' },
    ],
  },
  {
    id: 'ep-salary', group: 'Đàm phán lương & offer', icon: '💰',
    items: [
      { en: "Could you share the salary range for this position?", vi: 'Hỏi range trước khi lộ con số của mình — thế chủ động.' },
      { en: "Based on my experience and the market rate, I'm looking for something around X.", vi: 'Neo con số kèm CĂN CỨ (kinh nghiệm + mặt bằng thị trường).' },
      { en: "I'm flexible on the base salary if there's room in other areas, like a signing bonus or review timeline.", vi: 'Mở đường thương lượng gói tổng thể thay vì chỉ lương cứng.' },
      { en: "That's a bit below my expectations. Is there any flexibility on that number?", vi: 'Từ chối mềm một offer thấp — lịch sự nhưng rõ ràng.' },
      { en: "Thank you for the offer! Could I have a couple of days to consider it?", vi: 'Xin thời gian suy nghĩ — hoàn toàn bình thường và chuyên nghiệp.' },
    ],
  },
];
