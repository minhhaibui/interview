/*
 * Ngân hàng câu Tiếng Anh cho vòng phỏng vấn (trắc nghiệm tự chấm).
 * Tập trung tiếng Anh công sở / kỹ thuật: ngữ pháp, từ vựng, giao tiếp.
 * { id, q, options:[...], answer:<chỉ số>, explain }
 */
window.ENGLISH_QUESTIONS = [
  { id: 'en1', q: 'Chọn câu đúng: "We ___ the release until next week."', options: ['postpone', 'has postponed', 'have postponed', 'postponing'], answer: 2,
    explain: 'Chủ ngữ "We" + thì hiện tại hoàn thành ⇒ "have postponed".' },
  { id: 'en2', q: 'Điền từ: "If the server ___ down, users can\'t log in."', options: ['go', 'goes', 'gone', 'going'], answer: 1,
    explain: 'Câu điều kiện loại 1, chủ ngữ "the server" (số ít) ⇒ "goes".' },
  { id: 'en3', q: 'Chọn từ đúng: "Please ___ me know if you have questions."', options: ['let', 'make', 'allow', 'leave'], answer: 0,
    explain: 'Cụm cố định "let someone know" = báo cho ai biết.' },
  { id: 'en4', q: 'Điền từ nối: "The API returns an error ___ the token is invalid."', options: ['when', 'what', 'which', 'who'], answer: 0,
    explain: '"when" chỉ thời điểm/điều kiện: khi token không hợp lệ.' },
  { id: 'en5', q: 'Từ đồng nghĩa với "increase":', options: ['drop', 'rise', 'hold', 'lose'], answer: 1,
    explain: '"increase" (tăng) đồng nghĩa "rise".' },
  { id: 'en6', q: 'Trong vận hành, "roll back" nghĩa là gì?', options: ['mở rộng hệ thống', 'quay lại phiên bản trước', 'biên dịch lại', 'gộp nhánh'], answer: 1,
    explain: '"roll back" = hoàn tác, quay lại phiên bản trước khi deploy.' },
  { id: 'en7', q: 'Điền giới từ: "I\'m responsible ___ the database."', options: ['of', 'for', 'to', 'with'], answer: 1,
    explain: 'Cụm "responsible for" = chịu trách nhiệm về.' },
  { id: 'en8', q: 'Câu nào LỊCH SỰ nhất? "___ you mind reviewing my PR?"', options: ['Do', 'Would', 'Are', 'Will'], answer: 1,
    explain: '"Would you mind + V-ing?" là cách đề nghị lịch sự nhất.' },
  { id: 'en9', q: '"The meeting was pushed back to Friday." nghĩa là?', options: ['bị hủy', 'dời sớm hơn', 'bị hoãn sang thứ Sáu', 'bị rút ngắn'], answer: 2,
    explain: '"push back" = hoãn/dời lại (sang thứ Sáu).' },
  { id: 'en10', q: 'Điền cụm: "Let\'s ___ a call to discuss this."', options: ['set up', 'set off', 'set in', 'set down'], answer: 0,
    explain: '"set up a call/meeting" = sắp xếp một cuộc gọi.' },
  { id: 'en11', q: '"scalable" nghĩa là gì?', options: ['dễ hỏng', 'có thể mở rộng quy mô', 'bảo mật cao', 'chạy nhanh'], answer: 1,
    explain: '"scalable" = có khả năng mở rộng (chịu tải lớn hơn).' },
  { id: 'en12', q: 'Điền giới từ: "The feature is ___ progress."', options: ['on', 'in', 'at', 'under'], answer: 1,
    explain: 'Cụm "in progress" = đang được thực hiện.' },
  { id: 'en13', q: 'Điền giới từ: "He has a lot of experience ___ backend development."', options: ['in', 'on', 'of', 'for'], answer: 0,
    explain: 'Cụm "experience in (a field)" = kinh nghiệm trong lĩnh vực.' },
  { id: 'en14', q: 'Trong standup, báo tiến độ: "Yesterday I ___ the login bug."', options: ['fix', 'fixed', 'was fix', 'fixing'], answer: 1,
    explain: 'Hành động đã xong hôm qua ⇒ quá khứ đơn "fixed".' },
  { id: 'en15', q: 'Điền giới từ: "Could you elaborate ___ that point?"', options: ['on', 'in', 'at', 'about'], answer: 0,
    explain: 'Cụm "elaborate on something" = nói rõ thêm về điều gì.' },
  { id: 'en16', q: '"ASAP" viết tắt của?', options: ['as small as possible', 'as soon as possible', 'after some action plan', 'always send a packet'], answer: 1,
    explain: 'ASAP = as soon as possible = càng sớm càng tốt.' },
];
