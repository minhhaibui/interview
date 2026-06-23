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

  // ===== BỔ SUNG ĐỢT 2 (khó hơn + dạng mới) =====
  // ---- Dãy số nâng cao ----
  { id: 'seq9', category: '🔢 Dãy số', q: 'Số tiếp theo: 1, 8, 27, 64, ?', options: ['100', '125', '128', '216'], answer: 1,
    explain: 'Lập phương các số: 1³, 2³, 3³, 4³, 5³ = 125.' },
  { id: 'seq10', category: '🔢 Dãy số', q: 'Số tiếp theo: 2, 6, 12, 20, 30, ?', options: ['36', '40', '42', '48'], answer: 2,
    explain: 'Tích n×(n+1): 1·2, 2·3, 3·4, 4·5, 5·6, 6·7 = 42.' },
  { id: 'seq11', category: '🔢 Dãy số', q: 'Số tiếp theo: 1, 3, 6, 10, 15, ?', options: ['18', '20', '21', '24'], answer: 2,
    explain: 'Dãy số tam giác, khoảng cách tăng dần +2, +3, +4, +5, +6. 15 + 6 = 21.' },
  { id: 'seq12', category: '🔢 Dãy số', q: 'Số tiếp theo: 1, 2, 4, 7, 11, 16, ?', options: ['20', '22', '24', '21'], answer: 1,
    explain: 'Khoảng cách tăng +1, +2, +3, +4, +5, +6. 16 + 6 = 22.' },
  { id: 'seq13', category: '🔢 Dãy số', q: 'Số tiếp theo: 3, 9, 27, 81, ?', options: ['162', '216', '243', '324'], answer: 2,
    explain: 'Nhân 3 mỗi bước: 81 × 3 = 243.' },
  { id: 'seq14', category: '🔢 Dãy số', q: 'Số tiếp theo: 5, 11, 23, 47, ?', options: ['91', '94', '95', '96'], answer: 2,
    explain: 'Quy luật × 2 + 1: 47 × 2 + 1 = 95.' },
  { id: 'seq15', category: '🔢 Dãy số', q: 'Số tiếp theo: 1, 4, 2, 8, 3, 12, 4, ?', options: ['16', '13', '5', '20'], answer: 0,
    explain: 'Hai dãy xen kẽ: 1,2,3,4 và 4,8,12,16. Số kế tiếp thuộc dãy thứ hai → 16.' },

  // ---- Chữ cái ----
  { id: 'let3', category: '🔠 Chữ cái', q: 'Chữ tiếp theo: Z, X, V, T, ?', options: ['S', 'R', 'Q', 'P'], answer: 1,
    explain: 'Lùi 2 chữ mỗi bước (Z, X, V, T...). Sau T là R.' },

  // ---- Toán nhanh ----
  { id: 'math6', category: '➗ Toán nhanh', q: '3 quả cam giá 12.000đ. Vậy 7 quả giá bao nhiêu?', options: ['21.000đ', '24.000đ', '28.000đ', '30.000đ'], answer: 2,
    explain: 'Mỗi quả 12.000 ÷ 3 = 4.000đ. 7 quả = 7 × 4.000 = 28.000đ.' },
  { id: 'math7', category: '➗ Toán nhanh', q: 'Một số nhân 3 rồi cộng 6 thì được 21. Số đó là?', options: ['5', '7', '9', '3'], answer: 0,
    explain: '3x + 6 = 21 ⇒ 3x = 15 ⇒ x = 5.' },
  { id: 'math8', category: '➗ Toán nhanh', q: 'Giảm giá 50%, rồi giảm thêm 50% nữa. Tổng cộng giảm bao nhiêu %?', options: ['100%', '75%', '50%', '25%'], answer: 1,
    explain: 'Còn 0,5 × 0,5 = 0,25 = 25% giá gốc ⇒ đã giảm 75% (KHÔNG phải 100%).' },
  { id: 'math9', category: '➗ Toán nhanh', q: 'Trung bình cộng của 10, 20, 30, 40 là?', options: ['20', '25', '30', '100'], answer: 1,
    explain: '(10 + 20 + 30 + 40) ÷ 4 = 100 ÷ 4 = 25.' },
  { id: 'math10', category: '➗ Toán nhanh', q: '1/2 + 1/3 = ?', options: ['2/5', '5/6', '1/6', '3/5'], answer: 1,
    explain: 'Quy đồng mẫu 6: 3/6 + 2/6 = 5/6.' },

  // ---- Logic / suy luận nâng cao ----
  { id: 'log7', category: '🧠 Logic', q: '6 người gặp nhau, mỗi cặp bắt tay đúng 1 lần. Có tổng cộng bao nhiêu cái bắt tay?', options: ['12', '15', '30', '36'], answer: 1,
    explain: 'Số cặp = C(6,2) = 6×5/2 = 15.' },
  { id: 'log8', category: '🧠 Logic', q: 'Bố của Nam có 5 người con: Một, Hai, Ba, Bốn và người thứ năm tên gì?', options: ['Năm', 'Nam', 'Sáu', 'Không rõ'], answer: 1,
    explain: 'Bẫy "đếm số": người con thứ năm chính là Nam — chủ thể trong câu.' },
  { id: 'log9', category: '🧠 Logic', q: 'Hôm nay là thứ Sáu. 100 ngày nữa là thứ mấy?', options: ['Thứ Bảy', 'Chủ Nhật', 'Thứ Hai', 'Thứ Sáu'], answer: 1,
    explain: '100 chia 7 dư 2. Từ thứ Sáu tiến 2 ngày → Chủ Nhật.' },
  { id: 'log10', category: '🧠 Logic', q: '5 máy làm 5 sản phẩm mất 5 phút. Hỏi 100 máy làm 100 sản phẩm mất bao lâu?', options: ['5 phút', '20 phút', '100 phút', '1 phút'], answer: 0,
    explain: 'Mỗi máy làm 1 sản phẩm trong 5 phút. 100 máy làm song song 100 sản phẩm vẫn chỉ mất 5 phút.' },
  { id: 'log11', category: '🧠 Logic', q: 'Ốc sên dưới đáy giếng sâu 10m. Ban ngày leo 3m, ban đêm tụt 2m. Mấy ngày thì lên tới miệng?', options: ['8 ngày', '10 ngày', '9 ngày', '7 ngày'], answer: 0,
    explain: 'Mỗi ngày tịnh tiến 1m, nhưng ngày thứ 8 leo từ 7m + 3m = 10m là tới miệng rồi (không tụt nữa). Đáp án: 8 ngày.' },
  { id: 'log12', category: '🧠 Logic', q: 'An đứng thứ 5 từ trái và thứ 9 từ phải trong một hàng. Hàng có bao nhiêu người?', options: ['12', '13', '14', '15'], answer: 1,
    explain: 'Tổng = (5 − 1) + (9 − 1) + 1 = 13. Hoặc 5 + 9 − 1 = 13 (trừ 1 vì An được đếm hai lần).' },

  // ---- Xác suất / đếm ----
  { id: 'prob1', category: '🎲 Xác suất', q: 'Tung một đồng xu 2 lần. Xác suất ra CẢ HAI lần mặt ngửa?', options: ['1/2', '1/4', '1/3', '3/4'], answer: 1,
    explain: 'Hai lần độc lập: 1/2 × 1/2 = 1/4.' },
  { id: 'prob2', category: '🎲 Xác suất', q: 'Túi có 3 bi đỏ và 2 bi xanh. Lấy ngẫu nhiên 1 bi, xác suất được bi đỏ?', options: ['2/5', '3/5', '1/2', '3/2'], answer: 1,
    explain: '3 bi đỏ trên tổng 5 bi ⇒ xác suất 3/5.' },
  { id: 'prob3', category: '🎲 Xác suất', q: 'Gieo một con xúc xắc 6 mặt. Xác suất ra số chẵn?', options: ['1/6', '1/3', '1/2', '2/3'], answer: 2,
    explain: 'Số chẵn là 2, 4, 6 — tức 3 trên 6 khả năng ⇒ 1/2.' },

  // ---- Tương tự ----
  { id: 'ana4', category: '🔗 Tương tự', q: 'Nóng : Lạnh = Cao : ?', options: ['Rộng', 'Thấp', 'Dài', 'Ngắn'], answer: 1,
    explain: 'Quan hệ trái nghĩa. Trái nghĩa của "cao" là "thấp".' },
  { id: 'ana5', category: '🔗 Tương tự', q: 'Bác sĩ : Bệnh nhân = Giáo viên : ?', options: ['Sách', 'Học sinh', 'Trường', 'Bảng'], answer: 1,
    explain: 'Quan hệ "người phục vụ : đối tượng được phục vụ". Bác sĩ chữa bệnh nhân, giáo viên dạy học sinh.' },
  { id: 'ana6', category: '🔗 Tương tự', q: 'Chim : Tổ = Người : ?', options: ['Hang', 'Nhà', 'Phòng', 'Lều'], answer: 1,
    explain: 'Quan hệ "loài : nơi ở". Chim ở tổ, người ở nhà.' },
];
