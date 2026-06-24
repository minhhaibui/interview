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

  // ===== ĐỢT 3 — mở rộng kho + gắn độ khó d (1 dễ · 2 trung bình · 3 khó) =====
  // ---- Dãy số ----
  { id: 'sq21', category: '🔢 Dãy số', d: 1, q: 'Số tiếp theo: 4, 9, 16, 25, 36, ?', options: ['42', '45', '49', '64'], answer: 2, explain: 'Bình phương 2²,3²,4²,5²,6²,7² = 49.' },
  { id: 'sq22', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 2, 4, 8, 14, 22, ?', options: ['28', '30', '32', '34'], answer: 2, explain: 'Khoảng cách tăng +2,+4,+6,+8,+10. 22+10 = 32.' },
  { id: 'sq23', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 81, 64, 49, 36, ?', options: ['25', '30', '24', '16'], answer: 0, explain: 'Bình phương giảm dần 9²,8²,7²,6²,5² = 25.' },
  { id: 'sq24', category: '🔢 Dãy số', d: 1, q: 'Số tiếp theo: 1, 2, 3, 5, 8, 13, ?', options: ['18', '20', '21', '24'], answer: 2, explain: 'Fibonacci: 8+13 = 21.' },
  { id: 'sq25', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 2, 5, 10, 17, 26, ?', options: ['35', '37', '38', '40'], answer: 1, explain: 'Quy luật n²+1: 6²+1 = 37.' },
  { id: 'sq26', category: '🔢 Dãy số', d: 1, q: 'Số tiếp theo: 6, 12, 24, 48, ?', options: ['72', '96', '64', '108'], answer: 1, explain: 'Nhân đôi mỗi bước: 48×2 = 96.' },
  { id: 'sq27', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 1, 3, 7, 15, 31, ?', options: ['47', '62', '63', '64'], answer: 2, explain: 'Quy luật ×2+1: 31×2+1 = 63.' },
  { id: 'sq28', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 10, 9, 7, 4, ?', options: ['0', '1', '2', '-1'], answer: 0, explain: 'Trừ dần 1,2,3,4. 4−4 = 0.' },
  { id: 'sq29', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 3, 5, 9, 17, 33, ?', options: ['64', '65', '66', '49'], answer: 1, explain: 'Quy luật ×2−1: 33×2−1 = 65.' },
  { id: 'sq30', category: '🔢 Dãy số', d: 1, q: 'Số tiếp theo: 2, 6, 18, 54, ?', options: ['108', '150', '162', '216'], answer: 2, explain: 'Nhân 3 mỗi bước: 54×3 = 162.' },
  { id: 'sq31', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 7, 10, 16, 25, 37, ?', options: ['49', '50', '52', '54'], answer: 2, explain: 'Khoảng cách +3,+6,+9,+12,+15. 37+15 = 52.' },
  { id: 'sq32', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 1, 1, 2, 6, 24, ?', options: ['96', '100', '120', '125'], answer: 2, explain: 'Nhân lần lượt ×1,×2,×3,×4,×5: 24×5 = 120 (giai thừa).' },

  // ---- Toán nhanh ----
  { id: 'mt11', category: '➗ Toán nhanh', d: 1, q: '15% của 200 là bao nhiêu?', options: ['25', '30', '35', '20'], answer: 1, explain: '15% × 200 = 0,15 × 200 = 30.' },
  { id: 'mt12', category: '➗ Toán nhanh', d: 1, q: '7 × 8 = ?', options: ['54', '56', '63', '48'], answer: 1, explain: '7 × 8 = 56.' },
  { id: 'mt13', category: '➗ Toán nhanh', d: 2, q: 'Một tá rưỡi là bao nhiêu cái?', options: ['15', '16', '18', '24'], answer: 2, explain: '1 tá = 12, rưỡi = 6 ⇒ 12 + 6 = 18.' },
  { id: 'mt14', category: '➗ Toán nhanh', d: 1, q: '3/4 của 100 là?', options: ['25', '60', '75', '80'], answer: 2, explain: '100 ÷ 4 × 3 = 75.' },
  { id: 'mt15', category: '➗ Toán nhanh', d: 2, q: 'Nếu x + 5 = 12 thì 2x bằng?', options: ['7', '12', '14', '24'], answer: 2, explain: 'x = 7 ⇒ 2x = 14.' },
  { id: 'mt16', category: '➗ Toán nhanh', d: 2, q: 'Số nào chia hết cho cả 2, 3 và 5?', options: ['15', '20', '30', '45'], answer: 2, explain: '30 chia hết cho 2, 3 và 5 (bội chung nhỏ nhất là 30).' },
  { id: 'mt17', category: '➗ Toán nhanh', d: 1, q: 'Trung bình cộng của 4 và 16 là?', options: ['8', '10', '12', '20'], answer: 1, explain: '(4 + 16) ÷ 2 = 10.' },
  { id: 'mt18', category: '➗ Toán nhanh', d: 2, q: '2³ + 3² = ?', options: ['13', '17', '25', '36'], answer: 1, explain: '8 + 9 = 17.' },
  { id: 'mt19', category: '➗ Toán nhanh', d: 2, q: '20% của một số bằng 10. Số đó là?', options: ['30', '40', '50', '200'], answer: 2, explain: 'Số = 10 ÷ 0,2 = 50.' },
  { id: 'mt20', category: '➗ Toán nhanh', d: 1, q: '1 giờ 15 phút bằng bao nhiêu phút?', options: ['65', '75', '90', '115'], answer: 1, explain: '60 + 15 = 75 phút.' },

  // ---- Logic ----
  { id: 'lg13', category: '🧠 Logic', d: 1, q: 'Nếu A > B và B > C thì A so với C thế nào?', options: ['A > C', 'A < C', 'A = C', 'Chưa biết'], answer: 0, explain: 'Bắc cầu: A > B > C ⇒ A > C.' },
  { id: 'lg14', category: '🧠 Logic', d: 1, q: 'Mọi con mèo đều có đuôi. Tom là mèo. Vậy?', options: ['Tom không có đuôi', 'Tom có đuôi', 'Tom là chó', 'Chưa biết'], answer: 1, explain: 'Tam đoạn luận: Tom là mèo ⇒ Tom có đuôi.' },
  { id: 'lg15', category: '🧠 Logic', d: 2, q: 'Hôm nay là thứ Hai. Hôm kia (2 ngày trước) là thứ mấy?', options: ['Chủ Nhật', 'Thứ Bảy', 'Thứ Sáu', 'Thứ Ba'], answer: 1, explain: 'Lùi 2 ngày từ thứ Hai: Chủ Nhật → thứ Bảy.' },
  { id: 'lg16', category: '🧠 Logic', d: 3, q: 'Tàu dài 200m chạy 10 m/s, đi qua hết cây cầu dài 300m mất bao lâu?', options: ['20 giây', '30 giây', '50 giây', '80 giây'], answer: 2, explain: 'Quãng đường = 200 + 300 = 500m. Thời gian = 500 ÷ 10 = 50 giây.' },
  { id: 'lg17', category: '🧠 Logic', d: 2, q: '5 con mèo bắt 5 con chuột mất 5 phút. Vậy 1 con mèo bắt 1 con chuột mất mấy phút?', options: ['1 phút', '5 phút', '10 phút', '25 phút'], answer: 1, explain: 'Mỗi con mèo bắt 1 chuột trong 5 phút (làm song song).' },
  { id: 'lg18', category: '🧠 Logic', d: 3, q: 'Cha hơn con 30 tuổi. 5 năm nữa cha gấp đôi tuổi con. Hiện con bao nhiêu tuổi?', options: ['15', '20', '25', '30'], answer: 2, explain: '(x+30+5) = 2(x+5) ⇒ x+35 = 2x+10 ⇒ x = 25.' },
  { id: 'lg19', category: '🧠 Logic', d: 3, q: 'Xếp 4 người ngồi quanh một bàn tròn (xoay vòng coi như giống nhau) có mấy cách?', options: ['4', '6', '12', '24'], answer: 1, explain: 'Số hoán vị vòng = (4−1)! = 3! = 6.' },
  { id: 'lg20', category: '🧠 Logic', d: 2, q: 'Ao sen: số lá gấp đôi mỗi ngày, ngày 30 phủ kín ao. Ngày nào phủ nửa ao?', options: ['Ngày 15', 'Ngày 28', 'Ngày 29', 'Ngày 30'], answer: 2, explain: 'Gấp đôi mỗi ngày ⇒ hôm trước khi đầy (ngày 29) là vừa nửa ao.' },
  { id: 'lg21', category: '🧠 Logic', d: 1, q: 'Một năm KHÔNG nhuận có bao nhiêu ngày?', options: ['360', '364', '365', '366'], answer: 2, explain: 'Năm thường 365 ngày; năm nhuận mới 366.' },
  { id: 'lg22', category: '🧠 Logic', d: 2, q: 'Vào phòng tối có đèn dầu, nến và lò sưởi. Bạn chỉ có 1 que diêm — châm cái gì TRƯỚC?', options: ['Đèn dầu', 'Que diêm', 'Nến', 'Lò sưởi'], answer: 1, explain: 'Phải châm (đốt) que diêm trước thì mới có lửa để mồi những thứ khác.' },

  // ---- Xác suất / đếm ----
  { id: 'pr4', category: '🎲 Xác suất', d: 2, q: 'Rút ngẫu nhiên 1 lá từ bộ bài 52 lá. Xác suất được lá Át (có 4 lá Át)?', options: ['1/4', '1/13', '1/52', '4/13'], answer: 1, explain: '4 lá Át trên 52 lá = 4/52 = 1/13.' },
  { id: 'pr5', category: '🎲 Xác suất', d: 2, q: 'Có bao nhiêu số tự nhiên có đúng 2 chữ số?', options: ['89', '90', '99', '100'], answer: 1, explain: 'Từ 10 đến 99 ⇒ 99 − 10 + 1 = 90 số.' },
  { id: 'pr6', category: '🎲 Xác suất', d: 3, q: 'Tung 2 con xúc xắc. Xác suất tổng bằng 7?', options: ['1/6', '5/36', '1/9', '1/12'], answer: 0, explain: 'Có 6 cách (1-6,2-5,3-4,4-3,5-2,6-1) trên 36 ⇒ 6/36 = 1/6.' },
  { id: 'pr7', category: '🎲 Xác suất', d: 1, q: 'Lớp 30 bạn, có 18 nữ. Chọn ngẫu nhiên 1 bạn, xác suất là nữ?', options: ['2/5', '1/2', '3/5', '18/12'], answer: 2, explain: '18/30 = 3/5.' },
  { id: 'pr8', category: '🎲 Xác suất', d: 2, q: 'Có bao nhiêu cách chọn 2 người từ 4 người?', options: ['4', '6', '8', '12'], answer: 1, explain: 'C(4,2) = 4×3/2 = 6.' },
  { id: 'pr9', category: '🎲 Xác suất', d: 1, q: 'Tung 1 xúc xắc, xác suất KHÔNG ra mặt 6?', options: ['1/6', '1/2', '2/3', '5/6'], answer: 3, explain: '5 mặt còn lại trên 6 ⇒ 5/6.' },

  // ---- Tương tự ----
  { id: 'an7', category: '🔗 Tương tự', d: 1, q: 'Cá : Bơi = Chim : ?', options: ['Chạy', 'Bay', 'Nhảy', 'Bò'], answer: 1, explain: 'Cách di chuyển đặc trưng: cá bơi, chim bay.' },
  { id: 'an8', category: '🔗 Tương tự', d: 1, q: 'Ngày : Đêm = Trắng : ?', options: ['Xám', 'Đen', 'Sáng', 'Xanh'], answer: 1, explain: 'Quan hệ trái nghĩa. Trắng ↔ Đen.' },
  { id: 'an9', category: '🔗 Tương tự', d: 2, q: 'Kim : Đồng hồ = Trang : ?', options: ['Bút', 'Sách', 'Chữ', 'Giấy'], answer: 1, explain: 'Quan hệ "bộ phận : tổng thể". Kim thuộc đồng hồ, trang thuộc sách.' },
  { id: 'an10', category: '🔗 Tương tự', d: 2, q: 'Vua : Ngai vàng = Thuyền trưởng : ?', options: ['Biển', 'Tàu', 'Thủy thủ', 'Bến'], answer: 1, explain: 'Quan hệ "người đứng đầu : nơi cai quản". Vua trên ngai (vương quốc), thuyền trưởng trên tàu.' },
  { id: 'an11', category: '🔗 Tương tự', d: 1, q: 'Lửa : Nóng = Băng : ?', options: ['Ướt', 'Lạnh', 'Cứng', 'Trắng'], answer: 1, explain: 'Quan hệ "vật : tính chất". Lửa nóng, băng lạnh.' },
  { id: 'an12', category: '🔗 Tương tự', d: 1, q: 'Đói : Ăn = Khát : ?', options: ['Ngủ', 'Uống', 'Nghỉ', 'Chạy'], answer: 1, explain: 'Quan hệ "nhu cầu : hành động giải quyết". Đói thì ăn, khát thì uống.' },

  // ---- Chữ cái ----
  { id: 'lt5', category: '🔠 Chữ cái', d: 1, q: 'Chữ tiếp theo: B, D, F, H, ?', options: ['I', 'J', 'K', 'L'], answer: 1, explain: 'Cách 1 chữ một. Sau H là J.' },
  { id: 'lt6', category: '🔠 Chữ cái', d: 2, q: 'Chữ tiếp theo: A, Z, B, Y, C, X, ?', options: ['D', 'E', 'W', 'V'], answer: 0, explain: 'Hai dãy xen kẽ: A,B,C,D (từ đầu) và Z,Y,X (từ cuối). Tiếp theo là D.' },
  { id: 'lt7', category: '🔠 Chữ cái', d: 2, q: 'Cặp tiếp theo: AB, CD, EF, GH, ?', options: ['HI', 'IJ', 'JK', 'IK'], answer: 1, explain: 'Mỗi cặp gồm 2 chữ liền nhau, nối tiếp bảng chữ: sau GH là IJ.' },
  { id: 'lt8', category: '🔠 Chữ cái', d: 1, q: 'Chữ tiếp theo: Z, Y, X, W, ?', options: ['U', 'V', 'T', 'S'], answer: 1, explain: 'Đếm ngược bảng chữ cái. Sau W là V.' },
  { id: 'lt9', category: '🔠 Chữ cái', d: 3, q: 'Chữ tiếp theo: A, C, F, J, ?', options: ['N', 'O', 'P', 'M'], answer: 1, explain: 'Khoảng cách tăng +2,+3,+4,+5: A(1)→C(3)→F(6)→J(10)→O(15).' },
  { id: 'lt10', category: '🔠 Chữ cái', d: 2, q: 'Chữ tiếp theo: M, K, I, G, ?', options: ['F', 'E', 'H', 'D'], answer: 1, explain: 'Lùi 2 chữ mỗi bước: M,K,I,G,E.' },

  // ---- Bổ sung đợt mới ----
  { id: 'nx1', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 2, 5, 10, 17, 26, ?', options: ['35', '37', '38', '40'], answer: 1, explain: 'Cộng số lẻ tăng dần +3,+5,+7,+9,+11. 26 + 11 = 37 (chính là n²+1).' },
  { id: 'nx2', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 1, 2, 4, 7, 11, 16, ?', options: ['20', '21', '22', '23'], answer: 2, explain: 'Khoảng cách tăng dần +1,+2,+3,+4,+5,+6. 16 + 6 = 22.' },
  { id: 'nx3', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 81, 27, 9, 3, ?', options: ['0', '1', '2', '3'], answer: 1, explain: 'Chia 3 mỗi bước: 3 ÷ 3 = 1.' },
  { id: 'nx4', category: '🧠 Logic', d: 2, q: 'Mọi backend dev đều biết SQL. Nam là backend dev. Vậy?', options: ['Nam không biết SQL', 'Nam biết SQL', 'Không kết luận được', 'Nam là frontend'], answer: 1, explain: 'Tam đoạn luận: mọi A có tính chất P, Nam ∈ A ⇒ Nam có P.' },
  { id: 'nx5', category: '🧠 Logic', d: 3, q: '1 server xử lý 1 request mất 3 giây (chạy song song). 100 server xử lý 100 request mất bao lâu?', options: ['3 giây', '100 giây', '300 giây', '1 giây'], answer: 0, explain: 'Mỗi request 3 giây và độc lập, chạy song song — thêm server vẫn 3 giây.' },
  { id: 'nx6', category: '➗ Toán nhanh', d: 1, q: '15% của 200 là?', options: ['20', '25', '30', '35'], answer: 2, explain: '10% của 200 = 20; thêm 5% = 10; tổng 30.' },
  { id: 'nx7', category: '🧠 Logic', d: 2, q: 'Giao thức nào KHÁC nhóm: TCP, UDP, HTTP, IP?', options: ['TCP', 'UDP', 'HTTP', 'IP'], answer: 2, explain: 'TCP/UDP/IP ở tầng giao vận/mạng; HTTP ở tầng ứng dụng.' },
  { id: 'nx8', category: '➗ Toán nhanh', d: 2, q: 'Một USD = 25.000đ. 2 triệu đồng đổi được bao nhiêu USD?', options: ['$50', '$80', '$100', '$200'], answer: 1, explain: '2.000.000 ÷ 25.000 = 80 USD.' },
];
