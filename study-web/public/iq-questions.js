/*
 * Ngân hàng câu hỏi luyện IQ / Logic (trắc nghiệm).
 * { id, category, q, options:[...], answer: <chỉ số đáp án đúng>, explain }
 * Mang tính rèn tư duy & giải trí — "điểm IQ" chỉ là ước lượng vui, không phải bài test chuẩn.
 */
window.IQ_QUESTIONS = [
  // ---- Dãy số ----
  { id: 'seq1', category: '🔢 Dãy số', q: 'Số tiếp theo: 2, 4, 8, 16, ?', options: ['24', '30', '32', '64'], answer: 2,
    explain: 'Mỗi số gấp đôi số trước: 16 × 2 = 32.' },
  { id: 'seq2', category: '🔢 Dãy số', q: 'Số tiếp theo: 1, 1, 2, 3, 5, 8, ?', options: ['11', '12', '13', '21'], answer: 2,
    explain: 'Dãy Fibonacci: mỗi số bằng tổng hai số trước. 5 + 8 = 13.' },
  { id: 'seq3', category: '🔢 Dãy số', q: 'Số tiếp theo: 3, 6, 11, 18, 27, ?', options: ['35', '36', '38', '40'], answer: 2,
    explain: 'Khoảng cách tăng dần theo số lẻ +3, +5, +7, +9, +11. 27 + 11 = 38.' },
  { id: 'seq4', category: '🔢 Dãy số', q: 'Số tiếp theo: 1, 4, 9, 16, 25, ?', options: ['30', '35', '36', '49'], answer: 2,
    explain: 'Bình phương các số: 1², 2², 3², 4², 5², 6² = 36.' },
  { id: 'seq5', category: '🔢 Dãy số', q: 'Số tiếp theo: 1, 2, 6, 24, 120, ?', options: ['240', '360', '600', '720'], answer: 3,
    explain: 'Giai thừa: mỗi số nhân với chỉ số kế tiếp. 120 × 6 = 720.' },
  { id: 'seq6', category: '🔢 Dãy số', q: 'Số tiếp theo: 100, 96, 88, 76, 60, ?', options: ['36', '40', '44', '48'], answer: 1,
    explain: 'Trừ dần 4, 8, 12, 16, 20. 60 − 20 = 40.' },
  { id: 'seq7', category: '🔢 Dãy số', q: 'Số tiếp theo: 7, 14, 28, 56, ?', options: ['84', '98', '112', '120'], answer: 2,
    explain: 'Mỗi số gấp đôi số trước: 56 × 2 = 112.' },
  { id: 'seq8', category: '🔢 Dãy số', q: 'Số tiếp theo: 2, 3, 5, 7, 11, ?', options: ['12', '13', '14', '15'], answer: 1,
    explain: 'Dãy các số nguyên tố. Sau 11 là 13.' },

  // ---- Chữ cái / quy luật ----
  { id: 'let1', category: '🔠 Chữ cái', q: 'Chữ tiếp theo: A, C, E, G, ?', options: ['H', 'I', 'J', 'K'], answer: 1,
    explain: 'Cách một chữ một (bỏ B, D, F, H). Sau G là I.' },
  { id: 'let2', category: '🔠 Chữ cái', q: 'Chữ tiếp theo: A, B, D, G, K, ?', options: ['N', 'O', 'P', 'Q'], answer: 2,
    explain: 'Khoảng cách tăng dần +1, +2, +3, +4, +5. Từ K (vị trí 11) + 5 = vị trí 16 = P.' },
  { id: 'odd1', category: '🧠 Logic', q: 'Số nào KHÔNG cùng nhóm: 9, 16, 24, 36?', options: ['9', '16', '24', '36'], answer: 2,
    explain: '9, 16, 36 đều là số chính phương (3², 4², 6²); 24 thì không.' },

  // ---- Toán nhanh ----
  { id: 'math1', category: '➗ Toán nhanh', q: 'Áo giá 200.000đ, giảm 25%. Giá còn lại?', options: ['140.000đ', '150.000đ', '160.000đ', '175.000đ'], answer: 1,
    explain: '25% của 200.000 là 50.000. 200.000 − 50.000 = 150.000đ.' },
  { id: 'math2', category: '➗ Toán nhanh', q: 'Vòi A đầy bể sau 6 giờ, vòi B sau 3 giờ. Mở cả hai thì mất bao lâu?', options: ['1,5 giờ', '2 giờ', '2,5 giờ', '4,5 giờ'], answer: 1,
    explain: 'Mỗi giờ: 1/6 + 1/3 = 1/2 bể. Vậy đầy bể sau 2 giờ.' },
  { id: 'math3', category: '➗ Toán nhanh', q: 'Một món tăng giá 10% rồi giảm 10%. So với giá gốc thì?', options: ['Bằng nhau', 'Cao hơn 1%', 'Thấp hơn 1%', 'Thấp hơn 10%'], answer: 2,
    explain: '1,10 × 0,90 = 0,99 → còn 99% giá gốc, tức thấp hơn 1%.' },
  { id: 'math4', category: '➗ Toán nhanh', q: 'Một nửa của 1/2 là bao nhiêu?', options: ['1', '1/4', '1/2', '2'], answer: 1,
    explain: 'Một nửa của 1/2 = 1/2 × 1/2 = 1/4.' },
  { id: 'math5', category: '➗ Toán nhanh', q: 'Đồng hồ chỉ 3:00. Góc giữa kim giờ và kim phút?', options: ['60°', '90°', '120°', '180°'], answer: 1,
    explain: 'Mỗi giờ cách nhau 30°. Từ số 12 đến số 3 là 3 × 30° = 90°.' },

  // ---- Logic / suy luận ----
  { id: 'log1', category: '🧠 Logic', q: 'Mẹ của Mai sinh 4 người con: Xuân, Hạ, Thu và người thứ tư tên gì?', options: ['Đông', 'Mai', 'Không đủ dữ kiện', 'Hạ'], answer: 1,
    explain: 'Bẫy "tên theo mùa": người con thứ tư chính là Mai — người đang được nhắc tới trong câu.' },
  { id: 'log2', category: '🧠 Logic', q: '"Hôm qua của ngày mai" là thứ Tư. Vậy hôm nay là thứ mấy?', options: ['Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Hai'], answer: 1,
    explain: '"Hôm qua của ngày mai" chính là hôm nay. Nên hôm nay là thứ Tư.' },
  { id: 'log3', category: '🧠 Logic', q: 'An cao hơn Bình, Bình cao hơn Cường. Ai thấp nhất?', options: ['An', 'Bình', 'Cường', 'Chưa biết'], answer: 2,
    explain: 'Thứ tự chiều cao: An > Bình > Cường. Cường thấp nhất.' },
  { id: 'log4', category: '🧠 Logic', q: 'Mọi Bloop đều là Razzie. Mọi Razzie đều là Lazzie. Kết luận đúng?', options: ['Mọi Lazzie là Bloop', 'Mọi Bloop là Lazzie', 'Không Bloop nào là Lazzie', 'Không kết luận được'], answer: 1,
    explain: 'Suy luận bắc cầu: Bloop ⊂ Razzie ⊂ Lazzie ⇒ mọi Bloop đều là Lazzie. (Chiều ngược lại KHÔNG đúng.)' },
  { id: 'log5', category: '🧠 Logic', q: 'Đi 1km về Nam, 1km về Đông, 1km về Bắc rồi về đúng điểm xuất phát. Xuất phát ở đâu?', options: ['Xích đạo', 'Bắc Cực', 'Nam Cực', 'Không thể xảy ra'], answer: 1,
    explain: 'Kinh điển: chỉ ở Bắc Cực thì đi Nam rồi Bắc cùng quãng đường mới quay lại đúng chỗ (đoạn Đông chỉ xoay quanh cực).' },
  { id: 'log6', category: '🧠 Logic', q: 'Có 3 quả táo, bạn lấy đi 2 quả. Bạn đang có mấy quả?', options: ['1', '2', '3', '5'], answer: 1,
    explain: 'Bạn LẤY 2 quả, nên bạn ĐANG CÓ 2 quả (không phải số còn lại trên bàn).' },

  // ---- Tương tự (analogy) ----
  { id: 'ana1', category: '🔗 Tương tự', q: 'Bàn tay : Găng tay = Bàn chân : ?', options: ['Giày', 'Tất (vớ)', 'Dép', 'Ngón chân'], answer: 1,
    explain: 'Găng tay là lớp bọc ôm sát bàn tay; tương ứng với bàn chân là tất (vớ).' },
  { id: 'ana2', category: '🔗 Tương tự', q: 'Chó : Sủa = Mèo : ?', options: ['Gáy', 'Kêu meo', 'Hí', 'Rống'], answer: 1,
    explain: 'Mỗi con vật có tiếng kêu đặc trưng: chó sủa, mèo kêu "meo".' },
  { id: 'ana3', category: '🔗 Tương tự', q: 'Sách : Đọc = Nhạc : ?', options: ['Viết', 'Nghe', 'Nhìn', 'Ngửi'], answer: 1,
    explain: 'Quan hệ "đối tượng : giác quan/hành động tiếp nhận". Sách để đọc, nhạc để nghe.' },
];
