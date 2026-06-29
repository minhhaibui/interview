/**
 * Ngân hàng "🌟 STAR Builder" — câu hỏi phỏng vấn HÀNH VI (behavioral) thường gặp,
 * giúp ứng viên soạn câu trả lời theo khung STAR: Situation · Task · Action · Result.
 *
 * Mỗi câu: { id, competency, q, hints:{s,t,a,r}, watchout }
 *   - competency: nhóm năng lực nhà tuyển dụng muốn thấy
 *   - hints: gợi ý cho từng phần S/T/A/R (đặt làm placeholder ô soạn)
 *   - watchout: bẫy thường gặp cần tránh khi trả lời
 *
 * KHÔNG có "đáp án đúng" — đây là công cụ soạn + tự chấm (checklist) + nhờ AI góp ý.
 */
window.STAR_QUESTIONS = [
  {
    id: 'star-conflict-01', competency: 'Xung đột nhóm',
    q: 'Kể về một lần bạn bất đồng quan điểm kỹ thuật với đồng nghiệp. Bạn xử lý thế nào?',
    hints: {
      s: 'Bối cảnh: dự án nào, bất đồng về điều gì (ví dụ chọn SQL vs NoSQL, REST vs gRPC)?',
      t: 'Vai trò của bạn và vì sao cần giải quyết bất đồng này?',
      a: 'Bạn đã làm gì: lắng nghe lập luận đối phương, đưa dữ liệu/benchmark, POC nhỏ, xin ý kiến bên thứ ba?',
      r: 'Kết quả: chốt phương án nào, vì sao, quan hệ với đồng nghiệp sau đó ra sao?',
    },
    watchout: 'Tránh tỏ ra "tôi luôn đúng". Nhà tuyển dụng muốn thấy bạn tranh luận bằng lý lẽ/dữ liệu và tôn trọng người khác.',
  },
  {
    id: 'star-failure-01', competency: 'Thất bại & học hỏi',
    q: 'Kể về một lần bạn gây ra sự cố (bug/incident) trên production. Bạn đã làm gì?',
    hints: {
      s: 'Bối cảnh sự cố: triển khai gì, ảnh hưởng ra sao (downtime, dữ liệu sai)?',
      t: 'Trách nhiệm của bạn lúc đó là gì?',
      a: 'Hành động: phát hiện thế nào, rollback/hotfix, thông báo team, điều tra root cause?',
      r: 'Kết quả + BÀI HỌC: bạn thêm test/alert/quy trình gì để không lặp lại?',
    },
    watchout: 'Đừng đổ lỗi hoàn cảnh. Nhận trách nhiệm + nhấn mạnh BÀI HỌC và cải tiến quy trình (postmortem không đổ lỗi).',
  },
  {
    id: 'star-leader-01', competency: 'Lãnh đạo',
    q: 'Kể về một lần bạn dẫn dắt một dự án hoặc một nhóm nhỏ vượt qua khó khăn.',
    hints: {
      s: 'Bối cảnh: dự án gì, khó khăn nào (deadline gấp, thiếu người, yêu cầu đổi liên tục)?',
      t: 'Bạn được giao/đứng ra nhận vai trò gì?',
      a: 'Hành động lãnh đạo: chia việc, gỡ blocker, giao tiếp với stakeholder, động viên team?',
      r: 'Kết quả đo được: kịp deadline? chất lượng? team học được gì?',
    },
    watchout: 'Dùng "tôi" cho phần lãnh đạo của bạn, nhưng ghi nhận đóng góp của team — không nhận hết công.',
  },
  {
    id: 'star-deadline-01', competency: 'Áp lực & deadline',
    q: 'Kể về lúc bạn phải hoàn thành nhiều việc gấp cùng lúc với thời gian eo hẹp.',
    hints: {
      s: 'Bối cảnh: những việc/nhiệm vụ nào dồn lại, vì sao gấp?',
      t: 'Mục tiêu bạn phải đạt là gì?',
      a: 'Cách bạn ưu tiên: phân loại quan trọng/khẩn, cắt scope, xin gia hạn, nhờ trợ giúp, tự động hoá?',
      r: 'Kết quả: hoàn thành phần quan trọng nhất ra sao, đánh đổi gì?',
    },
    watchout: 'Tránh "tôi làm xuyên đêm". Hãy cho thấy bạn ƯU TIÊN thông minh và giao tiếp kỳ vọng, không chỉ cày sức.',
  },
  {
    id: 'star-initiative-01', competency: 'Chủ động & sáng kiến',
    q: 'Kể về một lần bạn chủ động cải tiến điều gì đó mà không ai yêu cầu.',
    hints: {
      s: 'Bối cảnh: bạn nhận ra vấn đề/cơ hội gì (build chậm, nhiều bug lặp, quy trình thủ công)?',
      t: 'Vì sao bạn quyết định tự đứng ra làm?',
      a: 'Hành động: bạn đề xuất/triển khai gì (thêm CI, viết script, refactor, thêm cache)?',
      r: 'Kết quả đo được: tiết kiệm bao nhiêu thời gian, giảm bao nhiêu lỗi?',
    },
    watchout: 'Nêu con số tác động (giảm 30% thời gian build…). Sáng kiến không đo được sẽ kém thuyết phục.',
  },
  {
    id: 'star-feedback-01', competency: 'Phản hồi & critique',
    q: 'Kể về một lần bạn nhận phản hồi tiêu cực (code review gắt / đánh giá thấp). Bạn phản ứng thế nào?',
    hints: {
      s: 'Bối cảnh: ai phản hồi, về việc gì?',
      t: 'Bạn cảm thấy/đối mặt với điều gì?',
      a: 'Hành động: bạn lắng nghe, hỏi cho rõ, sửa, và thay đổi cách làm ra sao?',
      r: 'Kết quả: bạn cải thiện thế nào, quan hệ/độ tin cậy thay đổi ra sao?',
    },
    watchout: 'Cho thấy bạn xem phản hồi là cơ hội phát triển, không phòng thủ hay tự ái.',
  },
  {
    id: 'star-teamwork-01', competency: 'Làm việc nhóm',
    q: 'Kể về một lần bạn giúp một đồng nghiệp đang gặp khó khăn (kỹ thuật hoặc khối lượng việc).',
    hints: {
      s: 'Bối cảnh: đồng nghiệp gặp khó gì, ảnh hưởng tới team/dự án ra sao?',
      t: 'Vì sao bạn quyết định giúp (dù có thể không phải việc của bạn)?',
      a: 'Hành động: pair-programming, giải thích, gánh bớt task, hướng dẫn debug?',
      r: 'Kết quả: đồng nghiệp/dự án tốt lên thế nào?',
    },
    watchout: 'Cân bằng: giúp người khác mà vẫn hoàn thành việc của mình — thể hiện tinh thần đồng đội thực chất.',
  },
  {
    id: 'star-decision-01', competency: 'Ra quyết định bằng dữ liệu',
    q: 'Kể về một quyết định kỹ thuật quan trọng bạn đưa ra dựa trên dữ liệu/đo lường.',
    hints: {
      s: 'Bối cảnh: cần quyết định gì (chọn database, kiến trúc, tối ưu nào trước)?',
      t: 'Tiêu chí thành công / ràng buộc là gì?',
      a: 'Hành động: bạn thu thập dữ liệu gì (benchmark, profiling, metrics, A/B), so sánh ra sao?',
      r: 'Kết quả: quyết định cuối + tác động đo được sau đó?',
    },
    watchout: 'Nhấn mạnh bạn quyết định bằng SỐ LIỆU, không cảm tính; nêu cả phương án bị loại và lý do.',
  },
  {
    id: 'star-learn-01', competency: 'Học công nghệ mới',
    q: 'Kể về một lần bạn phải học nhanh một công nghệ/lĩnh vực hoàn toàn mới để hoàn thành việc.',
    hints: {
      s: 'Bối cảnh: công nghệ gì (Kafka, K8s, một ngôn ngữ mới), deadline ra sao?',
      t: 'Bạn cần đạt được gì với công nghệ đó?',
      a: 'Cách bạn học: đọc docs, làm POC nhỏ, hỏi người có kinh nghiệm, chia nhỏ để học dần?',
      r: 'Kết quả: bạn áp dụng được tới đâu, sản phẩm/việc hoàn thành thế nào?',
    },
    watchout: 'Cho thấy PHƯƠNG PHÁP học của bạn (học để làm được việc, không chỉ "đọc cho biết").',
  },
  {
    id: 'star-customer-01', competency: 'Hướng khách hàng',
    q: 'Kể về một lần bạn đặt nhu cầu người dùng/khách hàng lên trên giải pháp kỹ thuật "đẹp".',
    hints: {
      s: 'Bối cảnh: yêu cầu/phản ánh gì từ người dùng?',
      t: 'Mâu thuẫn giữa giải pháp lý tưởng về kỹ thuật và nhu cầu thực tế là gì?',
      a: 'Hành động: bạn chọn gì, đánh đổi gì (ví dụ ship bản đơn giản trước để giải quyết đau của user)?',
      r: 'Kết quả: người dùng hài lòng ra sao, có đo bằng feedback/metric không?',
    },
    watchout: 'Thể hiện bạn hiểu phần mềm phục vụ NGƯỜI DÙNG, không phải để khoe kỹ thuật.',
  },
  {
    id: 'star-priority-01', competency: 'Ưu tiên & đánh đổi',
    q: 'Kể về một lần bạn phải nói "không" hoặc hoãn một yêu cầu để bảo vệ chất lượng/tiến độ.',
    hints: {
      s: 'Bối cảnh: ai yêu cầu gì, vì sao nó xung đột với việc đang làm?',
      t: 'Bạn phải cân bằng điều gì (scope vs deadline vs chất lượng)?',
      a: 'Hành động: bạn giải thích đánh đổi, đề xuất phương án thay thế, thương lượng thế nào?',
      r: 'Kết quả: quyết định cuối + mọi người chấp nhận ra sao?',
    },
    watchout: 'Nói "không" một cách chuyên nghiệp kèm lý do và phương án — không phải từ chối cộc lốc.',
  },
  {
    id: 'star-ambiguity-01', competency: 'Xử lý mơ hồ',
    q: 'Kể về một lần bạn phải bắt đầu một việc khi yêu cầu chưa rõ ràng.',
    hints: {
      s: 'Bối cảnh: nhiệm vụ gì, phần nào còn mơ hồ/thiếu thông tin?',
      t: 'Bạn vẫn cần đạt mục tiêu gì?',
      a: 'Hành động: bạn đặt câu hỏi làm rõ, đưa giả định, làm prototype để lấy feedback sớm?',
      r: 'Kết quả: làm rõ được yêu cầu và giao sản phẩm ra sao?',
    },
    watchout: 'Cho thấy bạn chủ động làm rõ + tiến lên với giả định hợp lý, không đứng im chờ đủ thông tin.',
  },
  {
    id: 'star-mentor-01', competency: 'Cố vấn & chia sẻ',
    q: 'Kể về một lần bạn hướng dẫn (mentor) hoặc onboard một thành viên mới.',
    hints: {
      s: 'Bối cảnh: ai, mới ở mức nào, cần nắm gì?',
      t: 'Mục tiêu: đưa họ tới đâu trong bao lâu?',
      a: 'Hành động: bạn làm tài liệu, pair, giao task tăng dần, review nhẹ nhàng thế nào?',
      r: 'Kết quả: họ tự lập được tới đâu, phản hồi của họ/quản lý?',
    },
    watchout: 'Thể hiện bạn nâng người khác lên (giúp họ tự làm được), không làm hộ.',
  },
  {
    id: 'star-strength-01', competency: 'Tự nhận thức',
    q: 'Điểm yếu lớn nhất của bạn là gì và bạn đang làm gì để cải thiện?',
    hints: {
      s: 'Bối cảnh: điểm yếu THỰC (ví dụ ngại nói trước đám đông, hay ôm việc, viết test sau cùng).',
      t: 'Vì sao nó từng ảnh hưởng tới công việc của bạn?',
      a: 'Hành động cụ thể bạn đang làm để cải thiện (khoá học, đổi thói quen, xin feedback)?',
      r: 'Kết quả/tiến bộ đo được tới giờ?',
    },
    watchout: 'Chọn điểm yếu THẬT (không phải "tôi quá cầu toàn"). Quan trọng là cho thấy lộ trình cải thiện và tiến bộ.',
  },
];
