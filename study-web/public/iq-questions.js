/*
 * Ngân hàng câu hỏi luyện IQ / Logic (trắc nghiệm).
 * { id, category, q, options:[...], answer: <chỉ số đáp án đúng>, explain }
 * Câu dạng NHÌN HÌNH có thêm { fig: <HTML hình đề bài>, optFig: [<SVG từng lựa chọn>] }
 * — lúc đó `options` chỉ là nhãn "Hình 1..4" để hiển thị trong phần xem lại.
 * Mang tính rèn tư duy & giải trí — "điểm IQ" chỉ là ước lượng vui, không phải bài test chuẩn.
 */

// ===========================================================================
// BỘ VẼ HÌNH (SVG) — dùng cho nhóm 🖼️ Suy luận hình
// Mọi hình dùng currentColor ⇒ tự đổi màu theo theme sáng/tối, không hard-code màu.
// ===========================================================================

/** Khung SVG vuông 60×60 cho một ô hình. */
const iqSvg = (inner, cls = '') => `<svg class="iqfig${cls ? ' ' + cls : ''}" viewBox="0 0 60 60" aria-hidden="true">${inner}</svg>`;

/** Hàng hình nằm ngang (chuỗi đề bài). Phần tử '?' thành ô dấu hỏi.
 *  size='lg': ô to gấp đôi — dành cho hình cần soi kỹ (đếm tam giác/hình vuông). */
const figRow = (items, size = '') => `<div class="iq-frow${size ? ' ' + size : ''}">${items.map(figCell).join('')}</div>`;
/** Lưới hình n cột (ma trận 3×3…). */
const figGrid = (items, cols = 3) => `<div class="iq-mtx" style="--c:${cols}">${items.map(figCell).join('')}</div>`;
const figCell = it => it === '?' ? '<div class="iq-mcell qm">?</div>' : `<div class="iq-mcell">${it}</div>`;

// ---- Lưới ô vuông 3×3 (chuỗi 9 ký tự '0'/'1', có thể xen '/' cho dễ đọc) ----
const gCells = p => p.replace(/[^01]/g, '');
/** Vẽ lưới 3×3: ô '1' tô đặc, ô '0' để trống. */
function gSvg(p) {
  const c = gCells(p);
  let s = '';
  for (let r = 0; r < 3; r++) {
    for (let k = 0; k < 3; k++) {
      const x = 3 + k * 18, y = 3 + r * 18;
      s += `<rect class="gl" x="${x}" y="${y}" width="18" height="18"/>`;
      if (c[r * 3 + k] === '1') s += `<rect class="gf" x="${x + 3}" y="${y + 3}" width="12" height="12"/>`;
    }
  }
  return iqSvg(s);
}
/** Phép chồng hai lưới: xor (chỉ một bên có), and (cả hai), or (ít nhất một). */
const gOp = (a, b, op) => [...gCells(a)].map((v, i) => {
  const x = v === '1', y = gCells(b)[i] === '1';
  return (op === 'xor' ? x !== y : op === 'and' ? x && y : x || y) ? '1' : '0';
}).join('');
const gRot = p => { const c = gCells(p); let o = ''; for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) o += c[(2 - k) * 3 + r]; return o; }; // xoay 90° thuận
const gFlip = p => { const c = gCells(p); let o = ''; for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) o += c[r * 3 + (2 - k)]; return o; }; // lật gương trái↔phải
const gFlipV = p => gFlip(gRot(gRot(p))); // lật trên↔dưới
const gInv = p => [...gCells(p)].map(v => (v === '1' ? '0' : '1')).join('');
const gTog = (p, i) => { const c = [...gCells(p)]; c[i] = c[i] === '1' ? '0' : '1'; return c.join(''); };

// ---- Hình cơ bản: k = c(tròn) s(vuông) t(tam giác) d(thoi) h(lục giác) p(ngũ giác) x(chữ thập) r(sao)
//      f = 0 rỗng · 1 rỗng + chấm giữa · 2 tô đặc ----
const polyPts = (n, r, rot) => Array.from({ length: n }, (_, i) => {
  const a = (rot + i * 360 / n) * Math.PI / 180;
  return `${(30 + r * Math.cos(a)).toFixed(1)},${(30 + r * Math.sin(a)).toFixed(1)}`;
}).join(' ');
const starPts = (r1, r2) => Array.from({ length: 10 }, (_, i) => {
  const a = (-90 + i * 36) * Math.PI / 180, r = i % 2 ? r2 : r1;
  return `${(30 + r * Math.cos(a)).toFixed(1)},${(30 + r * Math.sin(a)).toFixed(1)}`;
}).join(' ');
const SHAPE_PATH = {
  c: cl => `<circle class="${cl}" cx="30" cy="30" r="19"/>`,
  s: cl => `<rect class="${cl}" x="11" y="11" width="38" height="38"/>`,
  t: cl => `<polygon class="${cl}" points="${polyPts(3, 21, -90)}"/>`,
  d: cl => `<polygon class="${cl}" points="30,8 52,30 30,52 8,30"/>`,
  h: cl => `<polygon class="${cl}" points="${polyPts(6, 20, 0)}"/>`,
  p: cl => `<polygon class="${cl}" points="${polyPts(5, 20, -90)}"/>`,
  x: cl => `<polygon class="${cl}" points="22,8 38,8 38,22 52,22 52,38 38,38 38,52 22,52 22,38 8,38 8,22 22,22"/>`,
  r: cl => `<polygon class="${cl}" points="${starPts(21, 9)}"/>`,
};
/** Một hình cơ bản kèm kiểu tô (0 rỗng · 1 rỗng + chấm giữa · 2 tô đặc). */
const shape = (k, f = 0) => SHAPE_PATH[k](f === 2 ? 'sf' : 'so') +
  (f === 1 ? '<circle class="sf" cx="30" cy="30" r="5"/>' : '');
/** Đa giác đều n cạnh, CÓ CHẤM ở mỗi đỉnh — không chấm thì 7 với 8 cạnh nhìn như nhau,
 *  câu "đếm số cạnh" sẽ thành đoán mò. Dùng cho mọi ô của các câu đếm cạnh. */
const polyShape = (n, f = 0) => `<polygon class="${f === 2 ? 'sf' : 'so'}" points="${polyPts(n, 20, -90)}"/>` +
  polyPts(n, 20, -90).split(' ').map(pt => `<circle class="sf" cx="${pt.split(',')[0]}" cy="${pt.split(',')[1]}" r="3.2"/>`).join('');
/** Ô hình cơ bản (đã bọc SVG). */
const sCell = (k, f = 0) => iqSvg(shape(k, f));
/** Bọc một hình trong phép xoay (độ, thuận chiều kim đồng hồ). */
const rot = (inner, deg) => `<g transform="rotate(${deg} 30 30)">${inner}</g>`;

// ---- Mũi tên / cờ / chữ L: hình BẤT ĐỐI XỨNG để nhìn ra góc xoay ----
const ARROW = '<path class="so" d="M30 52 L30 12 M30 12 L21 23 M30 12 L39 23"/><rect class="sf" x="26" y="46" width="8" height="8"/>';
const FLAG = '<path class="so" d="M16 52 L16 10"/><polygon class="sf" points="16,10 44,17 16,26"/>';
const ELL = '<path class="so" d="M16 10 L16 48 L46 48"/><circle class="sf" cx="16" cy="10" r="5"/>';

/** n chấm tròn xếp theo lưới 3×3 (thứ tự: giữa → các ô quanh) — dùng cho chuỗi đếm số lượng. */
function dots(n) {
  const pos = [[30, 30], [15, 15], [45, 15], [15, 45], [45, 45], [30, 12], [30, 48], [12, 30], [48, 30]];
  return pos.slice(0, n).map(([x, y]) => `<circle class="sf" cx="${x}" cy="${y}" r="5"/>`).join('');
}
/** Lưới 3×3 chỉ có MỘT chấm ở ô thứ i (0..8) — dùng cho chuỗi "chấm di chuyển". */
function dotAt(i) {
  let s = '';
  for (let r2 = 0; r2 < 3; r2++) {
    for (let k = 0; k < 3; k++) s += `<rect class="gl" x="${3 + k * 18}" y="${3 + r2 * 18}" width="18" height="18"/>`;
  }
  return iqSvg(s + `<circle class="sf" cx="${12 + (i % 3) * 18}" cy="${12 + Math.floor(i / 3) * 18}" r="6"/>`);
}
/** Ô chứa một con số (ma trận số). */
const numCell = n => iqSvg(`<text class="stx" x="30" y="30" text-anchor="middle" dominant-baseline="central">${n}</text>`);

/**
 * Đóng gói một câu NHÌN HÌNH.
 * opts[0] LUÔN là đáp án đúng khi viết đề; hàm tự xoay vòng vị trí theo id
 * để đáp án không dồn về nút đầu tiên (mà vẫn ổn định giữa các lần chạy).
 */
function figQ(o) {
  const n = o.opts.length;
  const k = [...o.id].reduce((a, ch) => a + ch.charCodeAt(0), 0) % n;
  const shifted = o.opts.slice(n - k).concat(o.opts.slice(0, n - k)); // ⇒ shifted[k] === opts[0]
  return {
    id: o.id, category: o.category || '🖼️ Suy luận hình', d: o.d || 2, q: o.q, fig: o.fig,
    optFig: shifted, options: shifted.map((_, i) => `Hình ${i + 1}`), answer: k, explain: o.explain,
  };
}

/**
 * Câu "chồng hai lưới": A <op> B = ? — đáp án TÍNH RA nên không thể sai;
 * mồi nhử lấy từ các phép còn lại và biến thể (đảo/xoay/lật/đổi 1 ô) của đáp án, đã lọc trùng.
 */
function gOpQ(id, d, a, b, op, explain) {
  const ans = gOp(a, b, op);
  const opts = [ans];
  for (const c of [gOp(a, b, 'and'), gOp(a, b, 'or'), gOp(a, b, 'xor'), gInv(ans), gRot(ans), gFlip(ans), gTog(ans, 4), gTog(ans, 0), gTog(ans, 8), gTog(ans, 2)]) {
    if (opts.length >= 4) break;
    if (!opts.includes(c)) opts.push(c);
  }
  const sym = op === 'xor' ? '⊕ (chỉ MỘT bên tô)' : op === 'and' ? '∩ (CẢ HAI cùng tô)' : '∪ (ít nhất một bên tô)';
  return figQ({
    id, d, q: `Lưới A và B chồng lên nhau theo quy tắc ${sym}. Kết quả là hình nào?`,
    fig: figRow([gSvg(a), gSvg(b), '?']), opts: opts.map(gSvg), explain,
  });
}

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
{ id: 'lg15', category: '🧠 Logic', d: 2, q: 'Hôm nay là thứ Hai. Hôm kia (2 ngày trước) là thứ mấy?', options: ['Chủ Nhật', 'Thứ Bảy', 'Thứ Sáu', 'Thứ Ba'], answer: 1, explain: 'Lùi 2 ngày từ thứ Hai: Chủ Nhật → thứ Bảy.' },
  { id: 'lg16', category: '🧠 Logic', d: 3, q: 'Tàu dài 200m chạy 10 m/s, đi qua hết cây cầu dài 300m mất bao lâu?', options: ['20 giây', '30 giây', '50 giây', '80 giây'], answer: 2, explain: 'Quãng đường = 200 + 300 = 500m. Thời gian = 500 ÷ 10 = 50 giây.' },
{ id: 'lg18', category: '🧠 Logic', d: 3, q: 'Cha hơn con 30 tuổi. 5 năm nữa cha gấp đôi tuổi con. Hiện con bao nhiêu tuổi?', options: ['15', '20', '25', '30'], answer: 2, explain: '(x+30+5) = 2(x+5) ⇒ x+35 = 2x+10 ⇒ x = 25.' },
  { id: 'lg19', category: '🧠 Logic', d: 3, q: 'Xếp 4 người ngồi quanh một bàn tròn (xoay vòng coi như giống nhau) có mấy cách?', options: ['4', '6', '12', '24'], answer: 1, explain: 'Số hoán vị vòng = (4−1)! = 3! = 6.' },
  { id: 'lg20', category: '🧠 Logic', d: 2, q: 'Ao sen: số lá gấp đôi mỗi ngày, ngày 30 phủ kín ao. Ngày nào phủ nửa ao?', options: ['Ngày 15', 'Ngày 28', 'Ngày 29', 'Ngày 30'], answer: 2, explain: 'Gấp đôi mỗi ngày ⇒ hôm trước khi đầy (ngày 29) là vừa nửa ao.' },
  { id: 'lg21', category: '🧠 Logic', d: 1, q: 'Một năm KHÔNG nhuận có bao nhiêu ngày?', options: ['360', '364', '365', '366'], answer: 2, explain: 'Năm thường 365 ngày; năm nhuận mới 366.' },
  { id: 'lg22', category: '🧠 Logic', d: 2, q: 'Vào phòng tối có đèn dầu, nến và lò sưởi. Bạn chỉ có 1 que diêm — châm cái gì TRƯỚC?', options: ['Đèn dầu', 'Que diêm', 'Nến', 'Lò sưởi'], answer: 1, explain: 'Phải châm (đốt) que diêm trước thì mới có lửa để mồi những thứ khác.' },

  // ---- Xác suất / đếm ----
  { id: 'pr4', category: '🎲 Xác suất', d: 2, q: 'Rút ngẫu nhiên 1 lá từ bộ bài 52 lá. Xác suất được lá Át (có 4 lá Át)?', options: ['1/4', '1/13', '1/52', '4/13'], answer: 1, explain: '4 lá Át trên 52 lá = 4/52 = 1/13.' },
  { id: 'pr5', category: '🎲 Xác suất', d: 2, q: 'Có bao nhiêu số tự nhiên có đúng 2 chữ số?', options: ['89', '90', '99', '100'], answer: 1, explain: 'Từ 10 đến 99 ⇒ 99 − 10 + 1 = 90 số.' },
  { id: 'pr6', category: '🎲 Xác suất', d: 3, q: 'Tung 2 con xúc xắc. Xác suất tổng bằng 7?', options: ['1/6', '5/36', '1/9', '1/12'], answer: 0, explain: 'Có 6 cách (1-6,2-5,3-4,4-3,5-2,6-1) trên 36 ⇒ 6/36 = 1/6.' },
{ id: 'pr8', category: '🎲 Xác suất', d: 2, q: 'Có bao nhiêu cách chọn 2 người từ 4 người?', options: ['4', '6', '8', '12'], answer: 1, explain: 'C(4,2) = 4×3/2 = 6.' },
  { id: 'pr9', category: '🎲 Xác suất', d: 1, q: 'Tung 1 xúc xắc, xác suất KHÔNG ra mặt 6?', options: ['1/6', '1/2', '2/3', '5/6'], answer: 3, explain: '5 mặt còn lại trên 6 ⇒ 5/6.' },

  // ---- Tương tự ----

  // ---- Chữ cái ----
  { id: 'lt5', category: '🔠 Chữ cái', d: 1, q: 'Chữ tiếp theo: B, D, F, H, ?', options: ['I', 'J', 'K', 'L'], answer: 1, explain: 'Cách 1 chữ một. Sau H là J.' },
  { id: 'lt6', category: '🔠 Chữ cái', d: 2, q: 'Chữ tiếp theo: A, Z, B, Y, C, X, ?', options: ['D', 'E', 'W', 'V'], answer: 0, explain: 'Hai dãy xen kẽ: A,B,C,D (từ đầu) và Z,Y,X (từ cuối). Tiếp theo là D.' },
  { id: 'lt7', category: '🔠 Chữ cái', d: 2, q: 'Cặp tiếp theo: AB, CD, EF, GH, ?', options: ['HI', 'IJ', 'JK', 'IK'], answer: 1, explain: 'Mỗi cặp gồm 2 chữ liền nhau, nối tiếp bảng chữ: sau GH là IJ.' },
  { id: 'lt8', category: '🔠 Chữ cái', d: 1, q: 'Chữ tiếp theo: Z, Y, X, W, ?', options: ['U', 'V', 'T', 'S'], answer: 1, explain: 'Đếm ngược bảng chữ cái. Sau W là V.' },
  { id: 'lt9', category: '🔠 Chữ cái', d: 3, q: 'Chữ tiếp theo: A, C, F, J, ?', options: ['N', 'O', 'P', 'M'], answer: 1, explain: 'Khoảng cách tăng +2,+3,+4,+5: A(1)→C(3)→F(6)→J(10)→O(15).' },
  { id: 'lt10', category: '🔠 Chữ cái', d: 2, q: 'Chữ tiếp theo: M, K, I, G, ?', options: ['F', 'E', 'H', 'D'], answer: 1, explain: 'Lùi 2 chữ mỗi bước: M,K,I,G,E.' },

  // ---- Bổ sung đợt mới ----
{ id: 'nx3', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 81, 27, 9, 3, ?', options: ['0', '1', '2', '3'], answer: 1, explain: 'Chia 3 mỗi bước: 3 ÷ 3 = 1.' },
  { id: 'nx4', category: '🧠 Logic', d: 2, q: 'Mọi backend dev đều biết SQL. Nam là backend dev. Vậy?', options: ['Nam không biết SQL', 'Nam biết SQL', 'Không kết luận được', 'Nam là frontend'], answer: 1, explain: 'Tam đoạn luận: mọi A có tính chất P, Nam ∈ A ⇒ Nam có P.' },
{ id: 'nx7', category: '🧠 Logic', d: 2, q: 'Giao thức nào KHÁC nhóm: TCP, UDP, HTTP, IP?', options: ['TCP', 'UDP', 'HTTP', 'IP'], answer: 2, explain: 'TCP/UDP/IP ở tầng giao vận/mạng; HTTP ở tầng ứng dụng.' },
  { id: 'nx8', category: '➗ Toán nhanh', d: 2, q: 'Một USD = 25.000đ. 2 triệu đồng đổi được bao nhiêu USD?', options: ['$50', '$80', '$100', '$200'], answer: 1, explain: '2.000.000 ÷ 25.000 = 80 USD.' },
{ id: 'nlog2', category: '🧠 Logic', q: 'Nếu hôm nay trời mưa thì trận đấu bị hoãn. Trận đấu KHÔNG bị hoãn. Suy ra?', options: ['Trời mưa', 'Trời không mưa', 'Không kết luận được', 'Trận đấu bị hủy'], answer: 1,
    explain: 'Phủ định hậu quả (modus tollens): nếu P→Q và ¬Q thì ¬P. Không hoãn ⇒ không mưa.' },
  { id: 'nlog3', category: '🧠 Logic', q: 'Có 3 hộp: 1 toàn táo, 1 toàn cam, 1 lẫn lộn — NHÃN đều dán SAI. Bốc 1 quả từ hộp ghi "lẫn lộn" tối thiểu mấy lần để dán đúng cả 3?', options: ['1', '2', '3', 'không thể'], answer: 0,
    explain: 'Vì mọi nhãn đều sai, hộp "lẫn lộn" thực ra thuần một loại — bốc 1 quả là biết, rồi suy ra hai hộp còn lại.' },
{ id: 'nmath3', category: '➗ Toán nhanh', q: 'Nếu 3 máy làm xong việc trong 6 giờ, thì 6 máy (cùng tốc độ) làm xong trong?', options: ['2 giờ', '3 giờ', '4 giờ', '12 giờ'], answer: 1,
    explain: 'Tỉ lệ nghịch: gấp đôi số máy ⇒ nửa thời gian = 3 giờ.' },
  { id: 'nmath4', category: '➗ Toán nhanh', q: '2^10 bằng bao nhiêu?', options: ['512', '1000', '1024', '2048'], answer: 2,
    explain: '2^10 = 1024 — con số quen thuộc với dân lập trình (1 KiB).' },

  // ============================================================================
  // MỞ RỘNG KHO (2026-08): buổi phỏng vấn bốc 24 câu IQ/lần và KHÔNG hỏi lại câu cũ,
  // nên kho càng lớn càng lâu quay vòng. Ưu tiên thêm câu d=2/d=3 cho cân độ khó.
  // ============================================================================

  // ---- 🔢 Dãy số ----
  { id: 's2-1', category: '🔢 Dãy số', d: 1, q: 'Số tiếp theo: 5, 10, 20, 40, ?', options: ['60', '70', '80', '90'], answer: 2,
    explain: 'Mỗi số gấp đôi số trước: 40 × 2 = 80.' },
  { id: 's2-2', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 2, 5, 11, 23, ?', options: ['35', '41', '47', '53'], answer: 2,
    explain: 'Quy luật ×2 + 1: 23 × 2 + 1 = 47.' },
  { id: 's2-3', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 1, 4, 13, 40, ?', options: ['94', '108', '121', '133'], answer: 2,
    explain: 'Quy luật ×3 + 1: 40 × 3 + 1 = 121.' },
  { id: 's2-4', category: '🔢 Dãy số', d: 1, q: 'Số tiếp theo: 3, 7, 15, 31, ?', options: ['47', '55', '63', '71'], answer: 2,
    explain: 'Quy luật ×2 + 1: 31 × 2 + 1 = 63. (Cũng là 2ⁿ − 1.)' },
  { id: 's2-5', category: '🔢 Dãy số', d: 1, q: 'Số tiếp theo: 100, 50, 25, 12.5, ?', options: ['5', '6.25', '7.5', '8.25'], answer: 1,
    explain: 'Mỗi số bằng nửa số trước: 12.5 ÷ 2 = 6.25.' },
  { id: 's2-7', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 1, 3, 12, 60, ?', options: ['240', '300', '360', '420'], answer: 2,
    explain: 'Nhân dần ×3, ×4, ×5 ⇒ tiếp theo ×6: 60 × 6 = 360.' },
  { id: 's2-8', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 7, 10, 16, 28, ?', options: ['40', '46', '52', '56'], answer: 2,
    explain: 'Khoảng cách gấp đôi mỗi bước: +3, +6, +12 ⇒ +24: 28 + 24 = 52.' },
  { id: 's2-10', category: '🔢 Dãy số', d: 1, q: 'Số tiếp theo: 2, 3, 5, 7, 11, 13, ?', options: ['15', '16', '17', '19'], answer: 2,
    explain: 'Dãy số nguyên tố: sau 13 là 17 (15 = 3×5 nên không phải).' },
  { id: 's2-12', category: '🔢 Dãy số', d: 1, q: 'Số tiếp theo: 2, 3, 5, 8, 13, ?', options: ['18', '20', '21', '24'], answer: 2,
    explain: 'Mỗi số bằng tổng hai số trước: 8 + 13 = 21.' },
  { id: 's2-14', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 5, 10, 7, 14, 11, ?', options: ['20', '22', '24', '28'], answer: 1,
    explain: 'Xen kẽ ×2 rồi −3: 11 × 2 = 22.' },
  { id: 's2-17', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 1, 5, 14, 30, ?', options: ['45', '50', '55', '60'], answer: 2,
    explain: 'Tổng bình phương dồn: 1, 1+4, +9, +16 ⇒ +25 = 55.' },
  { id: 's2-18', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 6, 11, 21, 41, ?', options: ['61', '71', '81', '91'], answer: 2,
    explain: 'Quy luật ×2 − 1: 41 × 2 − 1 = 81.' },
  { id: 's2-19', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 2, 8, 18, 32, ?', options: ['40', '46', '50', '54'], answer: 2,
    explain: 'Dãy 2n²: 2, 8, 18, 32 ⇒ 2 × 25 = 50.' },
  { id: 's2-20', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 1, 4, 10, 22, 46, ?', options: ['82', '88', '94', '98'], answer: 2,
    explain: 'Quy luật ×2 + 2: 46 × 2 + 2 = 94.' },
  { id: 's2-21', category: '🔢 Dãy số', d: 1, q: 'Số tiếp theo: 13, 17, 19, 23, ?', options: ['25', '27', '29', '31'], answer: 2,
    explain: 'Dãy số nguyên tố liên tiếp: sau 23 là 29 (25, 27 chia hết cho 5 và 3).' },
  { id: 's2-22', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 5, 12, 26, 54, ?', options: ['96', '104', '110', '118'], answer: 2,
    explain: 'Quy luật ×2 + 2: 54 × 2 + 2 = 110.' },
  { id: 's2-25', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 3, 8, 15, 24, 35, ?', options: ['44', '46', '48', '50'], answer: 2,
    explain: 'Dãy n² − 1: 4−1, 9−1, 16−1, 25−1, 36−1 ⇒ 49 − 1 = 48.' },
  { id: 's2-27', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 1, 2, 4, 8, 15, 26, ?', options: ['38', '40', '42', '44'], answer: 2,
    explain: 'Khoảng cách 1, 2, 4, 7, 11 — chính nó tăng 1, 2, 3, 4 ⇒ khoảng cách kế là 16: 26 + 16 = 42.' },
  { id: 's2-28', category: '🔢 Dãy số', d: 1, q: 'Số tiếp theo: 4, 12, 36, 108, ?', options: ['216', '270', '324', '432'], answer: 2,
    explain: 'Mỗi số nhân 3: 108 × 3 = 324.' },
  { id: 's2-29', category: '🔢 Dãy số', d: 1, q: 'Số tiếp theo: 20, 19, 17, 14, 10, ?', options: ['4', '5', '6', '7'], answer: 1,
    explain: 'Trừ dần 1, 2, 3, 4 ⇒ trừ 5: 10 − 5 = 5.' },
  { id: 's2-30', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 2, 3, 6, 18, 108, ?', options: ['648', '1296', '1944', '2160'], answer: 2,
    explain: 'Mỗi số bằng TÍCH hai số liền trước: 18 × 108 = 1944.' },
  { id: 's2-31', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 11, 13, 17, 25, 41, ?', options: ['65', '69', '73', '81'], answer: 2,
    explain: 'Khoảng cách gấp đôi: +2, +4, +8, +16 ⇒ +32: 41 + 32 = 73.' },
  { id: 's2-32', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 6, 12, 21, 33, ?', options: ['42', '45', '48', '51'], answer: 2,
    explain: 'Khoảng cách tăng đều 6, 9, 12 ⇒ +15: 33 + 15 = 48.' },
  { id: 's2-33', category: '🔢 Dãy số', d: 1, q: 'Số tiếp theo: 96, 48, 24, 12, ?', options: ['4', '6', '8', '10'], answer: 1,
    explain: 'Mỗi số chia đôi: 12 ÷ 2 = 6.' },
  { id: 's2-34', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 2, 4, 12, 48, ?', options: ['144', '192', '240', '288'], answer: 2,
    explain: 'Nhân dần ×2, ×3, ×4 ⇒ ×5: 48 × 5 = 240.' },
  { id: 's2-35', category: '🔢 Dãy số', d: 1, q: 'Số tiếp theo: 5, 6, 8, 11, 15, 20, ?', options: ['24', '25', '26', '27'], answer: 2,
    explain: 'Khoảng cách tăng đều 1, 2, 3, 4, 5 ⇒ +6: 20 + 6 = 26.' },
  { id: 's2-36', category: '🔢 Dãy số', d: 3, q: 'Số còn thiếu: 4, 9, 16, ?, 36, 49', options: ['20', '24', '25', '30'], answer: 2,
    explain: 'Bình phương 2², 3², 4², 5², 6², 7² ⇒ chỗ trống là 5² = 25.' },
  { id: 's2-37', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 1, 2, 5, 14, 41, ?', options: ['108', '116', '122', '128'], answer: 2,
    explain: 'Quy luật ×3 − 1: 41 × 3 − 1 = 122.' },
  { id: 's2-38', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 100, 81, 64, 49, ?', options: ['30', '32', '36', '40'], answer: 2,
    explain: 'Bình phương giảm dần: 10², 9², 8², 7² ⇒ 6² = 36.' },
  { id: 's2-39', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 1, 3, 9, 19, 33, ?', options: ['47', '51', '55', '59'], answer: 1,
    explain: 'Khoảng cách 2, 6, 10, 14 (tăng đều 4) ⇒ +18: 33 + 18 = 51.' },
  { id: 's2-40', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 8, 6, 9, 7, 10, 8, ?', options: ['9', '10', '11', '12'], answer: 2,
    explain: 'Hai bước một: −2 rồi +3. Sau 8 là 8 + 3 = 11.' },

  // ---- 🔠 Chữ cái ----
  { id: 'l2-2', category: '🔠 Chữ cái', d: 2, q: 'Chữ tiếp theo: B, D, G, K, ?', options: ['N', 'O', 'P', 'Q'], answer: 2,
    explain: 'Vị trí 2, 4, 7, 11 — bước tăng 2, 3, 4 ⇒ +5 = 16 = P.' },
  { id: 'l2-4', category: '🔠 Chữ cái', d: 2, q: 'Chữ tiếp theo: A, B, D, H, ?', options: ['L', 'N', 'P', 'R'], answer: 2,
    explain: 'Vị trí gấp đôi mỗi bước: 1, 2, 4, 8 ⇒ 16 = P.' },
  { id: 'l2-5', category: '🔠 Chữ cái', d: 1, q: 'Chữ tiếp theo: C, F, I, L, ?', options: ['M', 'N', 'O', 'P'], answer: 2,
    explain: 'Cách 3 chữ: C(3), F(6), I(9), L(12) ⇒ O(15).' },
  { id: 'l2-6', category: '🔠 Chữ cái', d: 2, q: 'Cặp tiếp theo: AZ, BY, CX, ?', options: ['DV', 'DW', 'EW', 'DX'], answer: 1,
    explain: 'Chữ đầu tiến A→B→C→D, chữ sau lùi Z→Y→X→W ⇒ DW.' },
  { id: 'l2-7', category: '🔠 Chữ cái', d: 1, q: 'Tiếp theo: A1, C3, E5, ?', options: ['F6', 'G6', 'G7', 'H8'], answer: 2,
    explain: 'Chữ cách một (A, C, E, G) và số bằng đúng vị trí chữ (1, 3, 5, 7) ⇒ G7.' },
  { id: 'l2-8', category: '🔠 Chữ cái', d: 3, q: 'Chữ tiếp theo: A, B, D, G, K, P, ?', options: ['T', 'U', 'V', 'W'], answer: 2,
    explain: 'Vị trí 1, 2, 4, 7, 11, 16 — bước tăng đều 1, 2, 3, 4, 5 ⇒ +6 = 22 = V.' },
  { id: 'l2-9', category: '🔠 Chữ cái', d: 1, q: 'Tiếp theo: JAN, MAR, MAY, ?', options: ['JUN', 'JUL', 'AUG', 'SEP'], answer: 1,
    explain: 'Các tháng cách nhau 2: tháng 1, 3, 5 ⇒ tháng 7 = JUL.' },
  { id: 'l2-10', category: '🔠 Chữ cái', d: 1, q: 'Tiếp theo: MON, WED, FRI, ?', options: ['SAT', 'SUN', 'TUE', 'THU'], answer: 1,
    explain: 'Cách 2 ngày: thứ Hai, thứ Tư, thứ Sáu ⇒ Chủ nhật (SUN).' },
  { id: 'l2-11', category: '🔠 Chữ cái', d: 1, q: 'Viết ngược chuỗi "CODE" được?', options: ['ECOD', 'EDOC', 'DEOC', 'ODEC'], answer: 1,
    explain: 'Đọc từ phải sang trái: E, D, O, C ⇒ EDOC.' },
  { id: 'l2-12', category: '🔠 Chữ cái', d: 1, q: 'Nếu A=1, B=2, C=3… thì "CAB" viết thành số là?', options: ['132', '213', '312', '321'], answer: 2,
    explain: 'C=3, A=1, B=2 ⇒ 312.' },
  { id: 'l2-13', category: '🔠 Chữ cái', d: 2, q: 'Bỏ hết nguyên âm khỏi "INTERVIEW" còn lại?', options: ['NTRVW', 'INTRVW', 'NTERVW', 'NTRVWS'], answer: 0,
    explain: 'INTERVIEW gồm I-N-T-E-R-V-I-E-W; bỏ 4 nguyên âm I, E, I, E ⇒ còn N, T, R, V, W.' },
  { id: 'l2-14', category: '🔠 Chữ cái', d: 1, q: 'Chữ cái thứ 5 tính từ CUỐI bảng chữ cái tiếng Anh là?', options: ['U', 'V', 'W', 'X'], answer: 1,
    explain: 'Đếm ngược: Z(1), Y(2), X(3), W(4), V(5) ⇒ V.' },
  { id: 'l2-15', category: '🔠 Chữ cái', d: 1, q: 'Chữ cái nằm CHÍNH GIỮA H và P là?', options: ['J', 'K', 'L', 'M'], answer: 2,
    explain: 'H(8) và P(16), giữa là (8+16)/2 = 12 ⇒ L.' },
  { id: 'l2-16', category: '🔠 Chữ cái', d: 2, q: 'Chữ tiếp theo: A, D, I, P, ?', options: ['U', 'W', 'Y', 'Z'], answer: 2,
    explain: 'Vị trí là bình phương: 1, 4, 9, 16 ⇒ 25 = Y.' },
  { id: 'l2-17', category: '🔠 Chữ cái', d: 2, q: 'Chữ tiếp theo: E, G, J, N, ?', options: ['Q', 'R', 'S', 'T'], answer: 2,
    explain: 'Vị trí 5, 7, 10, 14 — bước tăng 2, 3, 4 ⇒ +5 = 19 = S.' },
  { id: 'l2-18', category: '🔠 Chữ cái', d: 2, q: 'Nếu "MOUSE" mã hoá thành "NPVTF" thì "CAT" mã hoá thành?', options: ['CBU', 'DBT', 'DBU', 'EBV'], answer: 2,
    explain: 'Mỗi chữ tiến 1 bậc: C→D, A→B, T→U ⇒ DBU.' },
  { id: 'l2-19', category: '🔠 Chữ cái', d: 1, q: 'Chữ tiếp theo: X, U, R, O, ?', options: ['K', 'L', 'M', 'N'], answer: 1,
    explain: 'Lùi 3 chữ mỗi bước: X(24), U(21), R(18), O(15) ⇒ L(12).' },
  { id: 'l2-20', category: '🔠 Chữ cái', d: 3, q: 'Tiếp theo: B2, D4, H8, ?', options: ['J10', 'L12', 'N14', 'P16'], answer: 3,
    explain: 'Vị trí chữ = số đi kèm và cả hai gấp đôi mỗi bước: 2, 4, 8 ⇒ 16 = P ⇒ P16.' },

  // ---- 🧠 Logic ----
  { id: 'g2-1', category: '🧠 Logic', d: 1, q: 'Mọi lập trình viên đều biết gõ phím. Nam biết gõ phím. Kết luận nào ĐÚNG?', options: ['Nam là lập trình viên', 'Nam không phải lập trình viên', 'Chưa đủ dữ kiện để kết luận', 'Mọi người biết gõ đều là lập trình viên'], answer: 2,
    explain: 'Đây là lỗi "khẳng định hệ quả": biết gõ phím không suy ngược ra là lập trình viên.' },
  { id: 'g2-2', category: '🧠 Logic', d: 2, q: 'Nếu trời mưa thì đường ướt. Đường KHÔNG ướt. Suy ra?', options: ['Trời có mưa', 'Trời không mưa', 'Không kết luận được gì', 'Đường vừa được lau khô'], answer: 1,
    explain: 'Phản đảo (modus tollens): "nếu A thì B" + "không B" ⇒ "không A".' },
  { id: 'g2-3', category: '🧠 Logic', d: 2, q: 'An đứng thứ 7 từ đầu và thứ 12 từ cuối trong một hàng. Hàng có bao nhiêu người?', options: ['17', '18', '19', '20'], answer: 1,
    explain: '7 + 12 = 19, nhưng An bị đếm hai lần ⇒ 19 − 1 = 18 người.' },
  { id: 'g2-4', category: '🧠 Logic', d: 2, q: 'Ba bạn Lan, Mai, Hoa có chiều cao khác nhau. Lan không cao nhất, Mai không thấp nhất, Hoa cao hơn Mai. Ai cao nhất?', options: ['Lan', 'Mai', 'Hoa', 'Không xác định được'], answer: 2,
    explain: 'Hoa > Mai và Mai không thấp nhất ⇒ Lan thấp nhất; Lan không cao nhất cũng khớp ⇒ Hoa cao nhất.' },
  { id: 'g2-5', category: '🧠 Logic', d: 1, q: 'Hôm nay là thứ Tư. 100 ngày nữa là thứ mấy?', options: ['Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu'], answer: 3,
    explain: '100 chia 7 dư 2 ⇒ tiến 2 ngày từ thứ Tư = thứ Sáu.' },
  { id: 'g2-6', category: '🧠 Logic', d: 2, q: 'Một cuốn sách đánh số trang từ 1 đến 100. Chữ số 9 xuất hiện bao nhiêu lần?', options: ['10', '11', '19', '20'], answer: 3,
    explain: 'Hàng đơn vị: 9, 19, …, 99 → 10 lần. Hàng chục: 90–99 → 10 lần. Tổng 20 lần.' },
  { id: 'g2-7', category: '🧠 Logic', d: 2, q: 'Trong một phòng có 5 người, mỗi người bắt tay tất cả những người còn lại đúng một lần. Có bao nhiêu cái bắt tay?', options: ['8', '10', '15', '20'], answer: 1,
    explain: 'C(5,2) = 5×4/2 = 10 (chia 2 vì bắt tay A–B trùng B–A).' },
  { id: 'g2-8', category: '🧠 Logic', d: 3, q: 'Có 8 quả bóng giống hệt nhau, 1 quả nặng hơn. Cần ÍT NHẤT mấy lần cân (cân đĩa) để chắc chắn tìm ra?', options: ['1 lần', '2 lần', '3 lần', '4 lần'], answer: 1,
    explain: 'Chia 3-3-2: cân 3 vs 3. Cân bằng thì quả nặng nằm trong 2 quả còn lại (cân lần 2). Lệch thì lấy nhóm 3 nặng, cân 1 vs 1 ⇒ luôn xong sau 2 lần.' },
  { id: 'g2-9', category: '🧠 Logic', d: 2, q: 'Một con ốc sên leo giếng sâu 10m: ban ngày leo 3m, ban đêm tụt 2m. Sau bao nhiêu ngày nó lên tới miệng giếng?', options: ['7 ngày', '8 ngày', '9 ngày', '10 ngày'], answer: 1,
    explain: 'Mỗi ngày đêm thực leo 1m; hết ngày 7 ở mét thứ 7, ngày 8 leo thêm 3m là chạm 10m và không tụt nữa.' },
  { id: 'g2-10', category: '🧠 Logic', d: 1, q: 'Một cái bánh cắt 3 nhát thẳng, nhiều nhất được mấy phần?', options: ['4 phần', '5 phần', '6 phần', '7 phần'], answer: 3,
    explain: 'Công thức 1 + n(n+1)/2 với n = 3 ⇒ 1 + 6 = 7 phần (các nhát cắt nhau, không đồng quy).' },
  { id: 'g2-11', category: '🧠 Logic', d: 2, q: 'Nếu tất cả A là B, và một số B là C, thì kết luận nào chắc chắn đúng?', options: ['Một số A chắc chắn là C', 'Không có A nào là C cả', 'Tất cả C đều phải là A', 'Không kết luận chắc chắn được'], answer: 3,
    explain: 'Phần B giao với C có thể hoàn toàn nằm ngoài A ⇒ không suy ra được quan hệ A–C.' },
  { id: 'g2-12', category: '🧠 Logic', d: 2, q: 'Cha hơn con 30 tuổi. 5 năm nữa tuổi cha gấp 3 lần tuổi con. Hiện con bao nhiêu tuổi?', options: ['8 tuổi', '10 tuổi', '12 tuổi', '15 tuổi'], answer: 1,
    explain: 'Gọi tuổi con là x: (x + 35) = 3(x + 5) ⇒ x + 35 = 3x + 15 ⇒ x = 10.' },
  { id: 'g2-13', category: '🧠 Logic', d: 1, q: 'Có 3 cái tất đen và 3 cái tất trắng trong ngăn kéo tối. Bốc ít nhất mấy chiếc để chắc chắn có một đôi cùng màu?', options: ['2 chiếc', '3 chiếc', '4 chiếc', '6 chiếc'], answer: 1,
    explain: 'Nguyên lý chuồng bồ câu: 2 chiếc có thể khác màu, chiếc thứ 3 chắc chắn trùng màu một trong hai.' },
  { id: 'g2-14', category: '🧠 Logic', d: 3, q: 'Bốn người qua cầu ban đêm, chỉ có 1 đèn pin, mỗi lần tối đa 2 người và phải cầm đèn. Thời gian lần lượt 1, 2, 5, 10 phút (đi cùng thì tính người chậm hơn). Thời gian ÍT NHẤT để cả 4 qua?', options: ['17 phút', '19 phút', '21 phút', '23 phút'], answer: 0,
    explain: '1&2 qua (2), 1 quay lại (1), 5&10 qua (10), 2 quay lại (2), 1&2 qua (2) ⇒ 17 phút. Mẹo: cho hai người chậm nhất đi cùng nhau.' },
  { id: 'g2-15', category: '🧠 Logic', d: 2, q: 'Một đội có 20 người, 12 người biết Java, 15 người biết SQL, ai cũng biết ít nhất một thứ. Bao nhiêu người biết CẢ HAI?', options: ['5 người', '7 người', '8 người', '9 người'], answer: 1,
    explain: 'Bao hàm–loại trừ: 12 + 15 − 20 = 7 người biết cả hai.' },
  { id: 'g2-16', category: '🧠 Logic', d: 1, q: 'Nếu hôm kia là thứ Hai thì ngày mai là thứ mấy?', options: ['Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu'], answer: 2,
    explain: 'Hôm kia thứ Hai ⇒ hôm qua thứ Ba, hôm nay thứ Tư ⇒ ngày mai thứ Năm.' },
  { id: 'g2-17', category: '🧠 Logic', d: 2, q: 'Trong 3 hộp có 1 hộp đựng vàng. Hộp A ghi "vàng ở đây", hộp B ghi "không có vàng ở đây", hộp C ghi "vàng không ở A". Chỉ MỘT dòng chữ đúng. Vàng ở hộp nào?', options: ['Hộp A', 'Hộp B', 'Hộp C', 'Không xác định được'], answer: 1,
    explain: 'Thử: vàng ở B ⇒ A sai, B sai? — B ghi "không có vàng ở đây" là sai, C ghi "vàng không ở A" là ĐÚNG ⇒ đúng một dòng ✓. Hai giả thiết kia đều cho 2 dòng đúng.' },
  { id: 'g2-18', category: '🧠 Logic', d: 2, q: 'Một sản phẩm giảm giá 20%, sau đó giảm tiếp 20% nữa. Tổng cộng đã giảm bao nhiêu so với giá gốc?', options: ['36%', '40%', '44%', '60%'], answer: 0,
    explain: 'Còn lại 0.8 × 0.8 = 0.64 giá gốc ⇒ giảm 36%, không phải 40%.' },
  { id: 'g2-19', category: '🧠 Logic', d: 3, q: 'Bạn gặp hai người: một luôn nói thật, một luôn nói dối, không biết ai là ai. Chỉ hỏi MỘT câu cho MỘT người để biết đường nào về nhà. Nên hỏi gì?', options: ['"Đường nào về nhà?" rồi cứ thế mà đi', '"Người kia sẽ chỉ đường nào?" rồi đi ngược lại', '"Bạn có luôn nói thật không?" rồi tin lời đó', '"Đường nào ngắn hơn?" rồi chọn đường đó'], answer: 1,
    explain: 'Hỏi về câu trả lời của NGƯỜI KIA: qua một lần nói dối (dù ở người nào) đáp án luôn sai ⇒ cứ đi ngược lại là đúng.' },
  { id: 'g2-20', category: '🧠 Logic', d: 2, q: 'Đồng hồ chỉ 3 giờ 00. Góc giữa kim giờ và kim phút là?', options: ['60 độ', '75 độ', '90 độ', '120 độ'], answer: 2,
    explain: 'Mỗi giờ ứng 30°; kim phút ở số 12, kim giờ ở số 3 ⇒ 3 × 30 = 90°.' },
  { id: 'g2-21', category: '🧠 Logic', d: 3, q: 'Đồng hồ chỉ 3 giờ 30. Góc giữa kim giờ và kim phút là?', options: ['70 độ', '75 độ', '80 độ', '90 độ'], answer: 1,
    explain: 'Kim phút ở 180°; kim giờ ở 3×30 + 30×0.5 = 105° ⇒ chênh 75°. Bẫy: kim giờ đã nhích nửa vạch.' },
  { id: 'g2-22', category: '🧠 Logic', d: 1, q: 'Một trận đấu loại trực tiếp có 64 đội. Cần bao nhiêu trận để tìm ra nhà vô địch?', options: ['32 trận', '63 trận', '64 trận', '127 trận'], answer: 1,
    explain: 'Mỗi trận loại đúng 1 đội; phải loại 63 đội ⇒ 63 trận.' },
  { id: 'g2-23', category: '🧠 Logic', d: 2, q: 'Nam nói: "Câu này của tôi là nói dối". Câu đó là?', options: ['Đúng — vì Nam thừa nhận nói dối', 'Sai — vì Nam đang nói ra sự thật', 'Nghịch lý — không đúng cũng không sai', 'Vừa đúng vừa sai tuỳ ngữ cảnh nói'], answer: 2,
    explain: 'Nghịch lý kẻ nói dối: giả sử đúng thì hoá sai và ngược lại ⇒ không gán được giá trị chân lý.' },
  { id: 'g2-24', category: '🧠 Logic', d: 2, q: '5 con mèo bắt 5 con chuột trong 5 phút. Vậy 100 con mèo bắt 100 con chuột trong bao lâu?', options: ['5 phút', '20 phút', '100 phút', '500 phút'], answer: 0,
    explain: 'Mỗi con mèo bắt 1 con chuột trong 5 phút — tỉ lệ không đổi khi nhân đều cả hai vế.' },
  { id: 'g2-25', category: '🧠 Logic', d: 3, q: 'Vi khuẩn nhân đôi mỗi phút, đầy bình sau 60 phút. Bình ĐẦY MỘT NỬA ở phút thứ mấy?', options: ['30', '45', '59', '58'], answer: 2,
    explain: 'Đi lùi một bước nhân đôi: nửa bình ở phút 59. Trực giác "một nửa thời gian" là bẫy kinh điển.' },

  // ---- ➗ Toán nhanh ----
  { id: 'm2-2', category: '➗ Toán nhanh', d: 1, q: '25 × 12 bằng bao nhiêu?', options: ['240', '280', '300', '360'], answer: 2,
    explain: '25 × 12 = 25 × 4 × 3 = 100 × 3 = 300.' },
  { id: 'm2-3', category: '➗ Toán nhanh', d: 2, q: 'Một số tăng 25% rồi giảm 20%. So với ban đầu?', options: ['Tăng 5%', 'Không đổi', 'Giảm 5%', 'Tăng 1%'], answer: 1,
    explain: '1.25 × 0.8 = 1.0 ⇒ đúng bằng ban đầu.' },
  { id: 'm2-4', category: '➗ Toán nhanh', d: 1, q: 'Trung bình cộng của 4, 8, 10, 14 là?', options: ['8', '9', '10', '11'], answer: 1,
    explain: 'Tổng 36 chia 4 = 9.' },
  { id: 'm2-5', category: '➗ Toán nhanh', d: 2, q: '2^16 bằng bao nhiêu?', options: ['32768', '65536', '131072', '262144'], answer: 1,
    explain: '2^10 = 1024, 2^16 = 2^10 × 2^6 = 1024 × 64 = 65536 (giới hạn cổng TCP quen thuộc).' },
  { id: 'm2-6', category: '➗ Toán nhanh', d: 1, q: '1/4 + 1/8 bằng bao nhiêu?', options: ['1/6', '2/12', '3/8', '5/8'], answer: 2,
    explain: 'Quy đồng: 2/8 + 1/8 = 3/8.' },
  { id: 'm2-7', category: '➗ Toán nhanh', d: 2, q: 'Giá gốc 800k, giảm 15%. Giá sau giảm?', options: ['640k', '660k', '680k', '720k'], answer: 2,
    explain: '15% của 800k là 120k ⇒ còn 680k.' },
  { id: 'm2-8', category: '➗ Toán nhanh', d: 2, q: '99 × 99 bằng bao nhiêu?', options: ['9701', '9801', '9901', '9981'], answer: 1,
    explain: '(100 − 1)² = 10000 − 200 + 1 = 9801.' },
  { id: 'm2-9', category: '➗ Toán nhanh', d: 1, q: 'Một giờ có bao nhiêu giây?', options: ['360', '600', '3600', '86400'], answer: 2,
    explain: '60 phút × 60 giây = 3600 giây (86400 là số giây một ngày).' },
  { id: 'm2-10', category: '➗ Toán nhanh', d: 2, q: 'Số nào chia hết cho 3: 1234, 2345, 3456, 4567?', options: ['1234', '2345', '3456', '4567'], answer: 2,
    explain: 'Tổng chữ số 3+4+5+6 = 18 chia hết cho 3 ⇒ 3456 chia hết cho 3.' },
  { id: 'm2-11', category: '➗ Toán nhanh', d: 2, q: 'Bình phương của 15 là?', options: ['205', '215', '225', '250'], answer: 2,
    explain: 'Mẹo số tận cùng 5: 1×(1+1) = 2 rồi ghép 25 ⇒ 225.' },
  { id: 'm2-12', category: '➗ Toán nhanh', d: 1, q: '0.1 + 0.2 trong toán học (không phải floating point) bằng?', options: ['0.3', '0.30000000000000004', '0.12', '1.2'], answer: 0,
    explain: 'Toán học đúng bằng 0.3; máy tính ra 0.30000000000000004 vì IEEE-754 nhị phân không biểu diễn chính xác 0.1.' },
  { id: 'm2-13', category: '➗ Toán nhanh', d: 2, q: 'Một công việc 12 người làm 8 ngày xong. 16 người làm mấy ngày?', options: ['4 ngày', '6 ngày', '9 ngày', '10 ngày'], answer: 1,
    explain: 'Tổng công 96 người-ngày ⇒ 96 / 16 = 6 ngày.' },
  { id: 'm2-14', category: '➗ Toán nhanh', d: 1, q: '7 × 8 + 6 × 4 bằng bao nhiêu?', options: ['72', '76', '80', '84'], answer: 2,
    explain: '56 + 24 = 80.' },
  { id: 'm2-15', category: '➗ Toán nhanh', d: 2, q: 'Một tam giác có hai góc 50° và 60°. Góc còn lại?', options: ['60 độ', '70 độ', '80 độ', '90 độ'], answer: 1,
    explain: 'Tổng ba góc bằng 180° ⇒ 180 − 110 = 70°.' },
  { id: 'm2-16', category: '➗ Toán nhanh', d: 2, q: 'Tổng các số từ 1 đến 100 bằng bao nhiêu?', options: ['4950', '5000', '5050', '5100'], answer: 2,
    explain: 'Công thức n(n+1)/2 = 100 × 101 / 2 = 5050.' },
  { id: 'm2-17', category: '➗ Toán nhanh', d: 2, q: 'Nếu 3x + 7 = 25 thì x bằng?', options: ['4', '5', '6', '7'], answer: 2,
    explain: '3x = 18 ⇒ x = 6.' },
  { id: 'm2-18', category: '➗ Toán nhanh', d: 3, q: '1 GiB bằng bao nhiêu byte?', options: ['1.000.000.000', '1.048.576', '1.073.741.824', '4.294.967.296'], answer: 2,
    explain: '2^30 = 1.073.741.824 byte (1.000.000.000 là 1 GB theo hệ thập phân của nhà sản xuất ổ cứng).' },
  { id: 'm2-19', category: '➗ Toán nhanh', d: 2, q: 'Một hình vuông có chu vi 36cm. Diện tích là?', options: ['64 cm²', '81 cm²', '100 cm²', '144 cm²'], answer: 1,
    explain: 'Cạnh = 36/4 = 9cm ⇒ diện tích 9² = 81 cm².' },
  { id: 'm2-20', category: '➗ Toán nhanh', d: 3, q: 'Lãi kép 10%/năm, gửi 100 triệu. Sau 3 năm được bao nhiêu (làm tròn)?', options: ['130 triệu', '131 triệu', '133 triệu', '135 triệu'], answer: 2,
    explain: '100 × 1.1³ = 133.1 triệu — hơn lãi đơn (130 triệu) nhờ lãi mẹ đẻ lãi con.' },

  // ---- 🎲 Xác suất ----
  { id: 'p2-1', category: '🎲 Xác suất', d: 1, q: 'Tung một con xúc xắc 6 mặt, xác suất ra số chẵn là?', options: ['1/6', '1/3', '1/2', '2/3'], answer: 2,
    explain: 'Ba mặt chẵn (2, 4, 6) trên 6 mặt ⇒ 3/6 = 1/2.' },
  { id: 'p2-2', category: '🎲 Xác suất', d: 2, q: 'Tung 2 đồng xu, xác suất ra ĐÚNG một mặt ngửa là?', options: ['1/4', '1/3', '1/2', '3/4'], answer: 2,
    explain: '4 khả năng (NN, NS, SN, SS), có 2 trường hợp đúng một ngửa ⇒ 2/4 = 1/2.' },
  { id: 'p2-3', category: '🎲 Xác suất', d: 2, q: 'Túi có 3 bi đỏ và 2 bi xanh. Bốc 1 bi, xác suất được bi đỏ?', options: ['2/5', '1/2', '3/5', '2/3'], answer: 2,
    explain: '3 bi đỏ trên tổng 5 bi ⇒ 3/5.' },
  { id: 'p2-4', category: '🎲 Xác suất', d: 3, q: 'Tung 2 xúc xắc, xác suất tổng bằng 7 là?', options: ['1/12', '1/9', '1/6', '1/4'], answer: 2,
    explain: '6 cặp cho tổng 7 (1-6, 2-5, 3-4, 4-3, 5-2, 6-1) trên 36 khả năng ⇒ 6/36 = 1/6 — tổng hay gặp nhất.' },
  { id: 'p2-5', category: '🎲 Xác suất', d: 2, q: 'Xác suất KHÔNG ra mặt 6 khi tung một xúc xắc hai lần liên tiếp?', options: ['11/36', '25/36', '5/6', '1/36'], answer: 1,
    explain: 'Mỗi lần trượt 6 là 5/6 ⇒ hai lần: 5/6 × 5/6 = 25/36.' },
  { id: 'p2-6', category: '🎲 Xác suất', d: 2, q: 'Rút 1 lá từ bộ 52 lá, xác suất được lá cơ (hearts)?', options: ['1/13', '1/4', '1/2', '4/13'], answer: 1,
    explain: '13 lá cơ trên 52 lá ⇒ 13/52 = 1/4.' },
  { id: 'p2-7', category: '🎲 Xác suất', d: 3, q: 'Một xét nghiệm đúng 99%. Bệnh hiếm gặp ở 1/10.000 người. Bạn dương tính — khả năng thật sự mắc bệnh gần nhất với?', options: ['Khoảng 1%', 'Khoảng 50%', 'Khoảng 90%', 'Khoảng 99%'], answer: 0,
    explain: 'Bẫy tỉ lệ nền (base rate): trong 10.000 người có 1 người bệnh và ~100 dương tính giả ⇒ xác suất thật ≈ 1/101 ≈ 1%.' },
  { id: 'p2-8', category: '🎲 Xác suất', d: 2, q: 'Tung đồng xu 5 lần đều ra ngửa. Lần thứ 6 ra ngửa có xác suất?', options: ['1/2', 'Nhỏ hơn 1/2', 'Lớn hơn 1/2', 'Gần bằng 0'], answer: 0,
    explain: 'Đồng xu không có trí nhớ — vẫn 1/2. Nghĩ khác đi là "ngộ nhận con bạc" (gambler\'s fallacy).' },
  { id: 'p2-9', category: '🎲 Xác suất', d: 3, q: 'Trong phòng 23 người, xác suất có ít nhất 2 người TRÙNG ngày sinh gần nhất với?', options: ['Khoảng 6%', 'Khoảng 23%', 'Khoảng 50%', 'Khoảng 99%'], answer: 2,
    explain: 'Nghịch lý ngày sinh: chỉ cần 23 người là đã ~50%, vì đếm theo số CẶP (253 cặp) chứ không phải số người.' },
  { id: 'p2-10', category: '🎲 Xác suất', d: 2, q: 'Túi có 4 bi trắng, 6 bi đen. Bốc 2 bi liên tiếp không hoàn lại, xác suất cả hai đều trắng?', options: ['2/15', '4/25', '1/5', '6/25'], answer: 0,
    explain: '4/10 × 3/9 = 12/90 = 2/15.' },

  // ---- 🔀 Mã hoá & quy luật (dạng coding-decoding kinh điển của test IQ) ----
  { id: 'c2-1', category: '🔀 Mã hoá', d: 2, q: 'Nếu "BOOK" = "CPPL" thì "WORD" = ?', options: ['XPSD', 'XPSE', 'VNQC', 'XQSE'], answer: 1,
    explain: 'Mỗi chữ tiến 1 bậc: W→X, O→P, R→S, D→E ⇒ XPSE.' },
  { id: 'c2-2', category: '🔀 Mã hoá', d: 2, q: 'Nếu "CAT" = "XZG" thì quy luật mã hoá là gì?', options: ['Tiến 3 bậc trong bảng chữ cái', 'Lùi 3 bậc trong bảng chữ cái', 'Lấy chữ đối xứng qua giữa bảng chữ cái', 'Đảo ngược thứ tự các chữ trong từ'], answer: 2,
    explain: 'A↔Z, B↔Y, C↔X (mã Atbash): C→X, A→Z, T→G.' },
  { id: 'c2-3', category: '🔀 Mã hoá', d: 1, q: 'Nếu 2 = 4, 3 = 9, 4 = 16 thì 7 = ?', options: ['28', '42', '49', '56'], answer: 2,
    explain: 'Quy luật bình phương: 7² = 49.' },
  { id: 'c2-4', category: '🔀 Mã hoá', d: 2, q: 'Nếu 1 = 3, 2 = 5, 3 = 7 thì 10 = ?', options: ['17', '19', '21', '23'], answer: 2,
    explain: 'Quy luật 2n + 1: 2 × 10 + 1 = 21.' },
  { id: 'c2-5', category: '🔀 Mã hoá', d: 3, q: 'Nếu "GO" = 22 và "CAT" = 24 thì "CODE" = ? (mỗi chữ tính bằng vị trí trong bảng chữ cái)', options: ['24', '27', '30', '33'], answer: 1,
    explain: 'G7+O15 = 22 ✓, C3+A1+T20 = 24 ✓ ⇒ CODE = C3+O15+D4+E5 = 27.' },
  { id: 'c2-6', category: '🔀 Mã hoá', d: 2, q: 'Nếu "123" nghĩa là "tôi thích code" và "345" nghĩa là "code rất vui", thì số nào là "code"?', options: ['1', '2', '3', '5'], answer: 2,
    explain: 'Chỉ số 3 xuất hiện ở cả hai câu, và "code" là từ chung duy nhất ⇒ 3 = code.' },
  { id: 'c2-7', category: '🔀 Mã hoá', d: 2, q: 'Nếu ROSE mã thành 6821, CHAIR thành 73456 thì PREACH mã thành?', options: ['961473', '961472', '961437', '964173'], answer: 0,
    explain: 'Ghép bảng: R=6, O=8, S=2, E=1, C=7, H=3, A=4, I=5. P chưa có ⇒ chọn mã bắt đầu bằng 9 và khớp R6-E1-A4-C7-H3 ⇒ 961473.' },
  { id: 'c2-8', category: '🔀 Mã hoá', d: 1, q: 'Nếu 5 + 3 = 28, 9 + 1 = 810, thì 8 + 2 = ?', options: ['610', '106', '1610', '164'], answer: 0,
    explain: 'Quy luật: (a−b) ghép (a+b). 8−2=6 và 8+2=10 ⇒ "610".' },
  { id: 'c2-9', category: '🔀 Mã hoá', d: 2, q: 'Nếu MONDAY viết là NPOEBZ thì TUESDAY viết là?', options: ['UVFTEBZ', 'UVFTFBZ', 'UWFTEBZ', 'UVETEBZ'], answer: 0,
    explain: 'Mỗi chữ tiến 1 bậc: T→U, U→V, E→F, S→T, D→E, A→B, Y→Z ⇒ UVFTEBZ.' },
  { id: 'c2-10', category: '🔀 Mã hoá', d: 3, q: 'Dãy 1, 11, 21, 1211, 111221, ? (đọc số ở dòng trước)', options: ['312211', '122111', '111222', '221121'], answer: 0,
    explain: 'Dãy "look-and-say": 111221 đọc là "ba số 1, hai số 2, một số 1" ⇒ 312211.' },

  // ---- 🧭 Hình & không gian ----
  { id: 'x2-1', category: '🧭 Hình & không gian', d: 1, q: 'Một khối lập phương có bao nhiêu cạnh?', options: ['6', '8', '12', '16'], answer: 2,
    explain: 'Lập phương có 6 mặt, 8 đỉnh và 12 cạnh.' },
  { id: 'x2-2', category: '🧭 Hình & không gian', d: 2, q: 'Sơn toàn bộ mặt ngoài khối lập phương 3×3×3 rồi cắt thành 27 khối nhỏ. Bao nhiêu khối nhỏ KHÔNG có mặt nào bị sơn?', options: ['0', '1', '6', '8'], answer: 1,
    explain: 'Chỉ đúng khối nằm giữa (lõi 1×1×1) là không chạm mặt ngoài ⇒ 1 khối.' },
  { id: 'x2-3', category: '🧭 Hình & không gian', d: 3, q: 'Vẫn khối 3×3×3 đã sơn: bao nhiêu khối nhỏ có ĐÚNG hai mặt bị sơn?', options: ['6', '8', '12', '18'], answer: 2,
    explain: 'Các khối nằm ở giữa mỗi CẠNH có 2 mặt sơn; lập phương có 12 cạnh ⇒ 12 khối.' },
  { id: 'x2-4', category: '🧭 Hình & không gian', d: 1, q: 'Bạn quay mặt về hướng Bắc rồi quay phải 90°, sau đó quay phải 90° nữa. Bạn đang nhìn hướng nào?', options: ['Đông', 'Tây', 'Nam', 'Bắc'], answer: 2,
    explain: 'Bắc → (phải) Đông → (phải) Nam.' },
  { id: 'x2-5', category: '🧭 Hình & không gian', d: 2, q: 'Đi 3km về hướng Bắc, rồi 4km về hướng Đông. Khoảng cách theo đường chim bay tới điểm xuất phát?', options: ['5 km', '6 km', '7 km', '3.5 km'], answer: 0,
    explain: 'Tam giác vuông 3-4-5: √(3² + 4²) = 5 km.' },
  { id: 'x2-6', category: '🧭 Hình & không gian', d: 2, q: 'Gương phản chiếu đồng hồ chỉ 3 giờ. Trong gương ta thấy mấy giờ?', options: ['3 giờ', '6 giờ', '9 giờ', '12 giờ'], answer: 2,
    explain: 'Ảnh gương lấy đối xứng qua trục 12–6: 12 − 3 = 9 giờ.' },
  { id: 'x2-7', category: '🧭 Hình & không gian', d: 2, q: 'Hình nào có số cạnh nhiều hơn: ngũ giác hay tứ giác, và hơn mấy cạnh?', options: ['Ngũ giác, hơn 1 cạnh', 'Ngũ giác, hơn 2 cạnh', 'Tứ giác, hơn 1 cạnh', 'Bằng nhau về số cạnh'], answer: 0,
    explain: 'Ngũ giác 5 cạnh, tứ giác 4 cạnh ⇒ hơn 1 cạnh.' },
  { id: 'x2-8', category: '🧭 Hình & không gian', d: 3, q: 'Gấp một tờ giấy làm đôi 5 lần liên tiếp rồi mở ra. Tờ giấy bị chia thành bao nhiêu ô?', options: ['10', '16', '25', '32'], answer: 3,
    explain: 'Mỗi lần gấp nhân đôi số ô: 2^5 = 32.' },
  { id: 'x2-9', category: '🧭 Hình & không gian', d: 2, q: 'Một hình chữ nhật dài 8cm rộng 3cm. Hình vuông có CÙNG chu vi sẽ có diện tích?', options: ['24 cm²', '25 cm²', '30.25 cm²', '36 cm²'], answer: 2,
    explain: 'Chu vi 22cm ⇒ cạnh vuông 5.5cm ⇒ diện tích 30.25 cm² (lớn hơn 24 cm² của hình chữ nhật).' },
  { id: 'x2-10', category: '🧭 Hình & không gian', d: 1, q: 'Kim phút quay hết một vòng thì kim giờ quay được bao nhiêu độ?', options: ['5 độ', '15 độ', '30 độ', '60 độ'], answer: 2,
    explain: 'Kim phút một vòng = 1 giờ ⇒ kim giờ đi 1/12 vòng = 30°.' },

  // ---- ⏱️ Chuyển động & công việc ----
  { id: 'w2-1', category: '⏱️ Chuyển động & công việc', d: 1, q: 'Xe chạy 60 km/h thì đi 150km hết bao lâu?', options: ['2 giờ', '2 giờ 30 phút', '3 giờ', '2 giờ 15 phút'], answer: 1,
    explain: '150 / 60 = 2.5 giờ = 2 giờ 30 phút.' },
  { id: 'w2-2', category: '⏱️ Chuyển động & công việc', d: 2, q: 'Vòi A đầy bể trong 4 giờ, vòi B trong 6 giờ. Mở cả hai thì mấy giờ đầy bể?', options: ['2 giờ chẵn', '2 giờ 24 phút', '3 giờ 20 phút', '5 giờ chẵn'], answer: 1,
    explain: 'Năng suất 1/4 + 1/6 = 5/12 bể mỗi giờ ⇒ 12/5 = 2.4 giờ = 2 giờ 24 phút.' },
  { id: 'w2-3', category: '⏱️ Chuyển động & công việc', d: 2, q: 'Hai xe xuất phát cùng lúc, ngược chiều, cách nhau 300km, tốc độ 60 và 40 km/h. Sau bao lâu gặp nhau?', options: ['2 giờ', '3 giờ', '4 giờ', '5 giờ'], answer: 1,
    explain: 'Tốc độ tiếp cận 60 + 40 = 100 km/h ⇒ 300 / 100 = 3 giờ.' },
  { id: 'w2-4', category: '⏱️ Chuyển động & công việc', d: 3, q: 'Đi 60 km/h, về 40 km/h trên cùng quãng đường. Tốc độ TRUNG BÌNH cả chuyến?', options: ['45 km/h', '48 km/h', '50 km/h', '52 km/h'], answer: 1,
    explain: 'Trung bình điều hoà: 2×60×40/(60+40) = 48 km/h — KHÔNG phải 50, vì đi chậm mất nhiều thời gian hơn.' },
  { id: 'w2-5', category: '⏱️ Chuyển động & công việc', d: 2, q: 'Một người làm xong việc trong 12 ngày, làm chung với người thứ hai chỉ mất 8 ngày. Người thứ hai làm một mình mất bao lâu?', options: ['16 ngày', '20 ngày', '24 ngày', '30 ngày'], answer: 2,
    explain: 'Năng suất người 2 = 1/8 − 1/12 = 1/24 ⇒ 24 ngày.' },
  { id: 'w2-6', category: '⏱️ Chuyển động & công việc', d: 1, q: 'Tàu dài 200m chạy 20 m/s qua một cột điện. Mất bao lâu để qua hết cột?', options: ['5 giây', '10 giây', '15 giây', '20 giây'], answer: 1,
    explain: 'Qua cột = đi hết chiều dài tàu: 200 / 20 = 10 giây.' },
  { id: 'w2-7', category: '⏱️ Chuyển động & công việc', d: 3, q: 'Vẫn tàu dài 200m chạy 20 m/s, nay qua CÂY CẦU dài 300m. Mất bao lâu?', options: ['15 giây', '20 giây', '25 giây', '30 giây'], answer: 2,
    explain: 'Phải đi hết cầu + hết thân tàu: (300 + 200) / 20 = 25 giây.' },
  { id: 'w2-8', category: '⏱️ Chuyển động & công việc', d: 2, q: 'Máy chủ xử lý 200 request/giây. Trong 5 phút xử lý được bao nhiêu request?', options: ['1.000', '12.000', '60.000', '120.000'], answer: 2,
    explain: '5 phút = 300 giây ⇒ 200 × 300 = 60.000 request.' },
  { id: 'w2-9', category: '⏱️ Chuyển động & công việc', d: 2, q: 'Một job chạy 40 phút trên 1 máy. Chia đều cho 4 máy song song (không tốn chi phí điều phối) thì bao lâu?', options: ['4 phút', '10 phút', '16 phút', '20 phút'], answer: 1,
    explain: '40 / 4 = 10 phút — chỉ đúng khi công việc chia song song được hoàn toàn (định luật Amdahl).' },
  { id: 'w2-10', category: '⏱️ Chuyển động & công việc', d: 3, q: 'Job có 20% phần BẮT BUỘC chạy tuần tự. Dù có vô hạn máy, tốc độ tối đa nhanh hơn bao nhiêu lần?', options: ['2 lần', '4 lần', '5 lần', '20 lần'], answer: 2,
    explain: 'Định luật Amdahl: giới hạn = 1 / phần tuần tự = 1 / 0.2 = 5 lần.' },

  // ---- 🔢 Dãy số (lô 2, khó hơn) ----
  { id: 's2-41', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 2, 12, 36, 80, ?', options: ['120', '135', '150', '164'], answer: 2,
    explain: 'Dãy n³ + n²: 1+1, 8+4, 27+9, 64+16 ⇒ 125 + 25 = 150.' },
  { id: 's2-42', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 4, 7, 13, 25, 49, ?', options: ['85', '91', '97', '103'], answer: 2,
    explain: 'Quy luật ×2 − 1: 49 × 2 − 1 = 97.' },
  { id: 's2-43', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 1, 3, 4, 7, 11, 18, ?', options: ['25', '27', '29', '31'], answer: 2,
    explain: 'Mỗi số bằng tổng hai số trước (dãy Lucas): 11 + 18 = 29.' },
  { id: 's2-45', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 64, 32, 96, 48, 144, ?', options: ['48', '72', '96', '216'], answer: 1,
    explain: 'Xen kẽ chia 2 rồi nhân 3: 144 ÷ 2 = 72.' },
  { id: 's2-46', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 1, 4, 9, 61, 52, ?', options: ['36', '63', '84', '94'], answer: 1,
    explain: 'Bình phương rồi VIẾT NGƯỢC: 16 → 61, 25 → 52 ⇒ 36 → 63.' },
  { id: 's2-47', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 2, 4, 16, 256, ?', options: ['512', '4096', '32768', '65536'], answer: 3,
    explain: 'Mỗi số là bình phương số trước: 256² = 65536.' },
  { id: 's2-48', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 9, 7, 12, 10, 15, 13, ?', options: ['11', '16', '18', '20'], answer: 2,
    explain: 'Xen kẽ trừ 2 rồi cộng 5: 13 + 5 = 18.' },
  { id: 's2-49', category: '🔢 Dãy số', d: 1, q: 'Số tiếp theo: 5, 25, 125, 625, ?', options: ['1250', '2500', '3125', '5625'], answer: 2,
    explain: 'Mỗi số nhân 5: 625 × 5 = 3125.' },
  { id: 's2-50', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 7, 26, 63, 124, ?', options: ['185', '215', '218', '248'], answer: 1,
    explain: 'Dãy n³ − 1: 8−1, 27−1, 64−1, 125−1 ⇒ 216 − 1 = 215.' },

  // ---- 🧠 Logic (lô 2) ----
  { id: 'g2-26', category: '🧠 Logic', d: 1, q: 'Bạn đang chạy thứ 3 trong cuộc đua và vượt qua người thứ 2. Bạn đang ở vị trí nào?', options: ['Thứ nhất', 'Thứ hai', 'Thứ ba', 'Thứ tư'], answer: 1,
    explain: 'Vượt người thứ 2 là bạn thế chỗ họ ⇒ thứ hai, không phải thứ nhất (bẫy phản xạ).' },
  { id: 'g2-27', category: '🧠 Logic', d: 1, q: 'Trên bàn có 12 quả trứng, bạn lấy đi 5 quả. Bạn ĐANG CÓ mấy quả?', options: ['5 quả', '7 quả', '12 quả', '17 quả'], answer: 0,
    explain: 'Câu hỏi là bạn CÓ bao nhiêu, không phải còn lại trên bàn ⇒ 5 quả bạn vừa lấy.' },
  { id: 'g2-28', category: '🧠 Logic', d: 2, q: 'Chia 100 thành hai số hơn kém nhau 20. Số lớn là?', options: ['50', '55', '60', '65'], answer: 2,
    explain: 'Hai số là x và x−20: 2x − 20 = 100 ⇒ x = 60 (số nhỏ là 40).' },
  { id: 'g2-29', category: '🧠 Logic', d: 3, q: 'Đánh số trang từ 1 tốn đúng 21 chữ số. Cuốn sách có bao nhiêu trang?', options: ['12 trang', '15 trang', '18 trang', '21 trang'], answer: 1,
    explain: 'Trang 1–9 tốn 9 chữ số, còn 12 chữ số cho các trang 2 chữ số ⇒ thêm 6 trang (10–15) ⇒ 15 trang.' },
  { id: 'g2-30', category: '🧠 Logic', d: 2, q: 'Nếu 1/3 của một số là 12 thì 1/4 của số đó là?', options: ['6', '8', '9', '12'], answer: 2,
    explain: 'Số đó là 36 ⇒ 36 / 4 = 9.' },
  { id: 'g2-31', category: '🧠 Logic', d: 2, q: 'Đội 11 người, chọn 1 đội trưởng và 1 đội phó (khác nhau). Có bao nhiêu cách?', options: ['22 cách', '55 cách', '110 cách', '121 cách'], answer: 2,
    explain: 'Có thứ tự: 11 × 10 = 110 (nếu chỉ chọn 2 người không phân vai thì mới là 55).' },
  { id: 'g2-32', category: '🧠 Logic', d: 1, q: 'Xếp 4 người vào 4 ghế khác nhau. Có bao nhiêu cách?', options: ['4 cách', '12 cách', '16 cách', '24 cách'], answer: 3,
    explain: 'Hoán vị 4! = 4 × 3 × 2 × 1 = 24.' },
  { id: 'g2-33', category: '🧠 Logic', d: 3, q: 'Một cái chai và cái nút giá 1.100.000đ. Chai đắt hơn nút đúng 1.000.000đ. Nút giá bao nhiêu?', options: ['50.000đ', '100.000đ', '110.000đ', '150.000đ'], answer: 0,
    explain: 'Nút x, chai x + 1.000.000 ⇒ 2x + 1.000.000 = 1.100.000 ⇒ x = 50.000đ. Đáp án 100.000đ là bẫy trực giác.' },
  { id: 'g2-34', category: '🧠 Logic', d: 3, q: 'Có 2 đồng hồ cát 4 phút và 7 phút. Đo ĐÚNG 9 phút bằng cách nào?', options: ['Chạy bình 7 rồi chạy tiếp bình 4, ước lượng dừng sớm 2 phút', 'Chạy cả hai; phút 7 lật bình 7, phút 8 lật lại bình 7 → hết ở phút 9', 'Chạy bình 4 hai lần rồi đếm nhẩm thêm 1 phút cho đủ 9 phút', 'Không thể đo chính xác 9 phút chỉ bằng hai bình cát này'], answer: 1,
    explain: 'Bắt đầu cả hai. Phút 4: bình 4 hết → lật lại. Phút 7: bình 7 hết → lật bình 7. Phút 8: bình 4 hết lần hai, lúc này bình 7 mới chảy 1 phút → lật ngược nó, 1 phút cát chảy nốt ⇒ đúng 9 phút.' },
  { id: 'g2-35', category: '🧠 Logic', d: 2, q: 'Tất cả Bloop là Razzie, tất cả Razzie là Lazzie. Kết luận nào chắc chắn đúng?', options: ['Tất cả Bloop đều là Lazzie', 'Tất cả Lazzie đều là Bloop', 'Không Bloop nào là Lazzie', 'Một số Lazzie không là Razzie'], answer: 0,
    explain: 'Quan hệ bao hàm có tính bắc cầu: Bloop ⊂ Razzie ⊂ Lazzie ⇒ Bloop ⊂ Lazzie.' },
  { id: 'g2-36', category: '🧠 Logic', d: 3, q: 'Có 25 con ngựa, đường đua 5 làn, không có đồng hồ. Cần ÍT NHẤT bao nhiêu lượt đua để tìm 3 con nhanh nhất?', options: ['6 lượt', '7 lượt', '8 lượt', '10 lượt'], answer: 1,
    explain: '5 lượt chia nhóm + 1 lượt các con nhất mỗi nhóm + 1 lượt chung kết cho các ứng viên còn lại = 7 lượt.' },
  { id: 'g2-37', category: '🧠 Logic', d: 2, q: 'Một lớp có 30 học sinh, ai cũng chơi ít nhất một môn: 18 chơi bóng đá, 20 chơi cầu lông. Bao nhiêu người chơi CẢ HAI?', options: ['2 người', '6 người', '8 người', '12 người'], answer: 2,
    explain: 'Bao hàm–loại trừ: 18 + 20 − 30 = 8 người.' },
  { id: 'g2-38', category: '🧠 Logic', d: 2, q: 'Nếu ngày mai là thứ Bảy thì hôm kia là thứ mấy?', options: ['Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Chủ nhật'], answer: 0,
    explain: 'Mai thứ Bảy ⇒ hôm nay thứ Sáu ⇒ hôm qua thứ Năm ⇒ hôm kia thứ Tư.' },
  { id: 'g2-39', category: '🧠 Logic', d: 3, q: 'Hai người chia nhau một cái bánh sao cho không ai thấy thiệt. Cách công bằng nhất?', options: ['Bốc thăm xem ai được cắt và chia đôi bằng mắt', 'Một người cắt, người kia chọn phần trước', 'Nhờ người thứ ba cắt hộ cho khách quan', 'Cân bằng cân điện tử rồi chia đúng số gam'], answer: 1,
    explain: 'Cơ chế "I cut, you choose": người cắt buộc phải chia đều vì họ nhận phần còn lại — công bằng mà không cần trọng tài.' },
  { id: 'g2-40', category: '🧠 Logic', d: 2, q: 'Một chiếc xe đi được 100km với 8 lít xăng. Đi 250km cần bao nhiêu lít?', options: ['16 lít', '18 lít', '20 lít', '25 lít'], answer: 2,
    explain: 'Tỉ lệ thuận: 8 × 2.5 = 20 lít.' },

  // ---- ➗ Toán nhanh (lô 2) ----
  { id: 'm2-21', category: '➗ Toán nhanh', d: 2, q: 'Một số chia 7 dư 3. Số đó nhân 2 rồi chia 7 dư mấy?', options: ['3', '5', '6', '0'], answer: 2,
    explain: 'Dư nhân đôi: 3 × 2 = 6, vẫn nhỏ hơn 7 ⇒ dư 6.' },
  { id: 'm2-22', category: '➗ Toán nhanh', d: 1, q: '√144 + √81 bằng bao nhiêu?', options: ['19', '20', '21', '23'], answer: 2,
    explain: '12 + 9 = 21.' },
  { id: 'm2-23', category: '➗ Toán nhanh', d: 1, q: 'Nếu 20% của x là 50 thì x bằng?', options: ['100', '150', '250', '500'], answer: 2,
    explain: 'x = 50 / 0.2 = 250.' },
  { id: 'm2-24', category: '➗ Toán nhanh', d: 3, q: 'Giá tăng 50%. Phải giảm bao nhiêu phần trăm để về đúng giá cũ?', options: ['25%', '33%', '50%', '66%'], answer: 1,
    explain: 'Từ 150 về 100 là giảm 50/150 ≈ 33% — không đối xứng với mức tăng 50%.' },
  { id: 'm2-25', category: '➗ Toán nhanh', d: 2, q: 'Hai số theo tỉ lệ 3 : 5, tổng bằng 64. Số lớn là?', options: ['24', '32', '40', '45'], answer: 2,
    explain: 'Tổng 8 phần ⇒ mỗi phần 8 ⇒ số lớn 5 × 8 = 40.' },
  { id: 'm2-26', category: '➗ Toán nhanh', d: 2, q: 'log₂(1024) bằng bao nhiêu?', options: ['8', '10', '12', '16'], answer: 1,
    explain: '2^10 = 1024 ⇒ log₂(1024) = 10 (số lần chia đôi tới 1 — chính là độ sâu binary search).' },
  { id: 'm2-27', category: '➗ Toán nhanh', d: 1, q: '5! (5 giai thừa) bằng bao nhiêu?', options: ['25', '60', '120', '240'], answer: 2,
    explain: '5 × 4 × 3 × 2 × 1 = 120.' },
  { id: 'm2-28', category: '➗ Toán nhanh', d: 1, q: '0.75 viết thành phân số tối giản là?', options: ['3/4', '7/5', '75/10', '2/3'], answer: 0,
    explain: '0.75 = 75/100 = 3/4.' },
  { id: 'm2-29', category: '➗ Toán nhanh', d: 2, q: 'Một đội có 60% là nam và 12 nữ. Đội có bao nhiêu người?', options: ['20 người', '24 người', '30 người', '36 người'], answer: 2,
    explain: 'Nữ chiếm 40% ⇒ 12 / 0.4 = 30 người.' },
  { id: 'm2-30', category: '➗ Toán nhanh', d: 2, q: 'Trung vị của dãy 3, 7, 9, 15, 21 là?', options: ['7', '9', '11', '15'], answer: 1,
    explain: 'Dãy đã sắp xếp, phần tử đứng giữa (thứ 3 trên 5) là 9. Trung bình cộng thì bằng 11 — đừng nhầm.' },

  // ---- ❌ Chọn từ khác loại ----
  { id: 'o2-4', category: '❌ Khác loại', d: 1, q: 'Chọn số KHÁC LOẠI: 2, 3, 5, 9, 11', options: ['2', '3', '9', '11'], answer: 2,
    explain: '9 = 3 × 3 nên không phải số nguyên tố, các số còn lại đều là số nguyên tố.' },
  { id: 'o2-5', category: '❌ Khác loại', d: 1, q: 'Chọn số KHÁC LOẠI: 16, 25, 36, 48', options: ['16', '25', '36', '48'], answer: 3,
    explain: '16 = 4², 25 = 5², 36 = 6² là số chính phương; 48 thì không.' },
  { id: 'o2-10', category: '❌ Khác loại', d: 2, q: 'Chọn số KHÁC LOẠI: 8, 27, 64, 100', options: ['8', '27', '64', '100'], answer: 3,
    explain: '8 = 2³, 27 = 3³, 64 = 4³ là lập phương; 100 chỉ là bình phương của 10.' },

  // ---- 🔀 Mã hoá (lô 2) ----
  { id: 'c2-11', category: '🔀 Mã hoá', d: 3, q: 'Nếu "SUN" = 54 và "MOON" = 57 (cộng vị trí chữ cái) thì "STAR" = ?', options: ['54', '56', '58', '60'], answer: 2,
    explain: 'S19+U21+N14 = 54 ✓, M13+O15+O15+N14 = 57 ✓ ⇒ S19+T20+A1+R18 = 58.' },
  { id: 'c2-12', category: '🔀 Mã hoá', d: 2, q: 'Nếu "FROG" = "COLD" (mỗi chữ lùi 3 bậc) thì "PLUM" = ?', options: ['MIRJ', 'MIRK', 'NIRJ', 'MISJ'], answer: 0,
    explain: 'P→M, L→I, U→R, M→J ⇒ MIRJ.' },
  { id: 'c2-13', category: '🔀 Mã hoá', d: 1, q: 'Nếu 123 = 6 và 234 = 9 thì 456 = ?', options: ['12', '15', '18', '20'], answer: 1,
    explain: 'Quy luật cộng các chữ số: 4 + 5 + 6 = 15.' },
  { id: 'c2-14', category: '🔀 Mã hoá', d: 2, q: 'Nếu AB = 3 và CD = 7 thì EF = ?', options: ['9', '10', '11', '13'], answer: 2,
    explain: 'Cộng vị trí chữ: A1+B2 = 3, C3+D4 = 7 ⇒ E5+F6 = 11.' },
  { id: 'c2-15', category: '🔀 Mã hoá', d: 1, q: 'Số nhị phân 1010 đổi sang thập phân là?', options: ['5', '8', '10', '12'], answer: 2,
    explain: '8 + 0 + 2 + 0 = 10 (bit từ trái: 8, 4, 2, 1).' },

  // ---- 🎲 Xác suất (lô 2) ----
  { id: 'p2-11', category: '🎲 Xác suất', d: 2, q: 'Tung 3 đồng xu, xác suất cả ba CÙNG một mặt là?', options: ['1/8', '1/4', '1/3', '1/2'], answer: 1,
    explain: 'Hai trường hợp tốt (NNN, SSS) trên 8 khả năng ⇒ 2/8 = 1/4.' },
  { id: 'p2-12', category: '🎲 Xác suất', d: 1, q: 'Rút 1 lá từ bộ 52 lá, xác suất được quân Át là?', options: ['1/13', '1/26', '1/4', '4/13'], answer: 0,
    explain: 'Có 4 quân Át trên 52 lá ⇒ 4/52 = 1/13.' },
  { id: 'p2-13', category: '🎲 Xác suất', d: 2, q: 'Xác suất một người bất kỳ sinh vào Chủ nhật là?', options: ['1/5', '1/6', '1/7', '1/12'], answer: 2,
    explain: 'Bảy ngày trong tuần đều khả năng như nhau ⇒ 1/7.' },
  { id: 'p2-14', category: '🎲 Xác suất', d: 2, q: 'Tung 3 đồng xu, xác suất có ÍT NHẤT một mặt ngửa là?', options: ['3/8', '1/2', '5/8', '7/8'], answer: 3,
    explain: 'Lấy phần bù: 1 − P(không ngửa lần nào) = 1 − 1/8 = 7/8.' },
  { id: 'p2-15', category: '🎲 Xác suất', d: 3, q: 'Bài toán Monty Hall: 3 cửa, bạn chọn 1, MC mở một cửa trống rồi mời đổi. Nên làm gì?', options: ['Đổi cửa — xác suất thắng 2/3', 'Giữ cửa — xác suất thắng 2/3', 'Đổi hay giữ đều 1/2 như nhau', 'Giữ cửa vì đổi làm giảm cơ hội'], answer: 0,
    explain: 'Cửa đầu vẫn giữ xác suất 1/3; toàn bộ 2/3 dồn sang cửa còn lại vì MC luôn mở cửa trống ⇒ đổi thì thắng 2/3.' },

  // ---- Lô 3: bổ sung để luyện tư duy dài hơi (2026-08) ----
  { id: 's3-1', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 2, 6, 3, 9, 6, 18, ?', options: ['12', '15', '21', '24'], answer: 1,
    explain: 'Xen kẽ ×3 rồi −3: 6×3=18, 18−3=15.' },
  { id: 's3-2', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 10, 20, 40, 70, 110, ?', options: ['140', '150', '160', '170'], answer: 2,
    explain: 'Khoảng cách tăng đều 10, 20, 30, 40 ⇒ +50: 110 + 50 = 160.' },
  { id: 's3-3', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 2, 5, 11, 20, 32, ?', options: ['44', '45', '47', '50'], answer: 2,
    explain: 'Khoảng cách 3, 6, 9, 12 (tăng đều 3) ⇒ +15: 32 + 15 = 47.' },
  { id: 's3-4', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 1, 2, 3, 6, 11, 20, ?', options: ['31', '35', '37', '40'], answer: 2,
    explain: 'Mỗi số bằng TỔNG ba số liền trước: 6 + 11 + 20 = 37 (dãy Tribonacci).' },
  { id: 's3-5', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 45, 39, 33, 27, ?', options: ['19', '20', '21', '23'], answer: 2,
    explain: 'Trừ đều 6 mỗi bước: 27 − 6 = 21.' },
  { id: 's3-6', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 3, 4, 8, 17, 33, ?', options: ['50', '54', '58', '62'], answer: 2,
    explain: 'Khoảng cách 1, 4, 9, 16 (bình phương) ⇒ +25: 33 + 25 = 58.' },
  { id: 's3-7', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 120, 60, 20, 5, ?', options: ['0.5', '1', '1.5', '2.5'], answer: 1,
    explain: 'Chia dần cho 2, 3, 4 ⇒ chia 5: 5 ÷ 5 = 1.' },
  { id: 's3-8', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 1, 3, 8, 19, 42, ?', options: ['73', '81', '89', '97'], answer: 2,
    explain: 'Quy luật ×2 + n với n = 1, 2, 3, 4, 5: 42 × 2 + 5 = 89.' },
  { id: 's3-9', category: '🔢 Dãy số', d: 1, q: 'Số tiếp theo: 11, 22, 33, 44, ?', options: ['54', '55', '56', '66'], answer: 1,
    explain: 'Cộng đều 11 mỗi bước: 44 + 11 = 55.' },
  { id: 's3-10', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 1, 0, 2, -1, 3, ?', options: ['-3', '-2', '0', '4'], answer: 1,
    explain: 'Hai dãy đan xen: 1, 2, 3 (tăng 1) và 0, −1, −2 (giảm 1) ⇒ số kế thuộc dãy sau: −2.' },

  { id: 'g3-1', category: '🧠 Logic', d: 2, q: 'Một hình vuông bị chia thành 4 phần bằng nhau, mỗi phần lại chia 4. Có tất cả bao nhiêu ô nhỏ nhất?', options: ['8 ô', '12 ô', '16 ô', '20 ô'], answer: 2,
    explain: '4 phần × 4 = 16 ô nhỏ nhất.' },
  { id: 'g3-2', category: '🧠 Logic', d: 2, q: 'Nếu hôm nay là ngày 28 tháng 2 năm 2027 (không nhuận), ngày mai là?', options: ['29 tháng 2', '1 tháng 3', '28 tháng 3', '1 tháng 4'], answer: 1,
    explain: 'Năm 2027 không chia hết cho 4 ⇒ tháng 2 chỉ có 28 ngày ⇒ mai là 1 tháng 3.' },
  { id: 'g3-3', category: '🧠 Logic', d: 3, q: 'Ba công tắc ngoài phòng, một trong số đó bật bóng đèn trong phòng kín. Chỉ được vào phòng MỘT lần. Làm sao biết công tắc nào?', options: ['Bật lần lượt từng công tắc rồi vào phòng xem đúng một lần', 'Bật công tắc 1 một lát rồi tắt, bật công tắc 2 rồi vào sờ đèn', 'Bật cả ba công tắc cùng lúc rồi vào phòng quan sát kỹ', 'Không thể xác định được nếu chỉ vào phòng đúng một lần'], answer: 1,
    explain: 'Dùng thêm dấu hiệu NHIỆT: đèn sáng = công tắc 2, đèn tắt nhưng còn ấm = công tắc 1, tắt và nguội = công tắc 3.' },
  { id: 'g3-4', category: '🧠 Logic', d: 2, q: 'Một lớp xếp hàng, An đứng thứ 10 từ trái và thứ 10 từ phải. Lớp có bao nhiêu người?', options: ['18 người', '19 người', '20 người', '21 người'], answer: 1,
    explain: '10 + 10 − 1 = 19 (An bị đếm hai lần).' },
  { id: 'g3-5', category: '🧠 Logic', d: 3, q: 'Có 100 bóng đèn tắt, đánh số 1–100. Người thứ k bật/tắt mọi bóng có số chia hết cho k, làm với k = 1..100. Cuối cùng bao nhiêu bóng SÁNG?', options: ['7 bóng', '10 bóng', '25 bóng', '50 bóng'], answer: 1,
    explain: 'Một bóng đổi trạng thái theo số ước; chỉ số CHÍNH PHƯƠNG mới có số ước lẻ ⇒ các bóng 1, 4, 9, …, 100 ⇒ 10 bóng sáng.' },
  { id: 'g3-6', category: '🧠 Logic', d: 2, q: 'Nếu "một số người lập trình viên thích cà phê" là đúng, kết luận nào chắc chắn đúng?', options: ['Có ít nhất một lập trình viên thích cà phê', 'Mọi lập trình viên đều thích cà phê', 'Không lập trình viên nào ghét cà phê', 'Đa số lập trình viên thích cà phê'], answer: 0,
    explain: '"Một số" chỉ đảm bảo TỒN TẠI ít nhất một, không nói gì về đa số hay toàn bộ.' },
  { id: 'g3-7', category: '🧠 Logic', d: 2, q: 'Ba hộp: một đựng táo, một đựng cam, một lẫn cả hai — nhưng NHÃN nào cũng sai. Bốc ít nhất mấy quả để biết chắc cả ba hộp?', options: ['1 quả', '2 quả', '3 quả', 'Không thể biết chắc'], answer: 0,
    explain: 'Bốc từ hộp dán "lẫn lộn": vì nhãn sai nên hộp đó thuần một loại ⇒ suy ra hai hộp còn lại.' },
  { id: 'g3-8', category: '🧠 Logic', d: 1, q: 'Có bao nhiêu số có 3 chữ số mà cả ba chữ số đều là 7?', options: ['1 số', '3 số', '7 số', '9 số'], answer: 0,
    explain: 'Chỉ duy nhất số 777.' },
  { id: 'g3-9', category: '🧠 Logic', d: 3, q: 'Hai người chơi lần lượt lấy 1–3 viên sỏi từ đống 10 viên; ai lấy viên CUỐI thì thắng. Người đi trước có chiến lược thắng không?', options: ['Có — lấy 2 viên đầu tiên rồi luôn giữ bội số của 4', 'Có — lấy 3 viên đầu tiên rồi bắt chước đối thủ', 'Không — người đi sau luôn thắng nếu chơi đúng', 'Không — kết quả hoàn toàn phụ thuộc may rủi'], answer: 0,
    explain: 'Để lại bội số của 4 cho đối thủ là thắng: 10 − 2 = 8; sau đó mỗi lượt lấy sao cho tổng hai người bằng 4.' },
  { id: 'g3-10', category: '🧠 Logic', d: 2, q: 'Một người mua con bò 60 triệu, bán 70, mua lại 80, bán 90. Lãi bao nhiêu?', options: ['10 triệu', '20 triệu', '30 triệu', 'Hoà vốn'], answer: 1,
    explain: 'Hai thương vụ riêng biệt: lãi 10 + lãi 10 = 20 triệu.' },
  { id: 'g3-11', category: '🧠 Logic', d: 2, q: 'Nếu 6 người đào 6 cái hố trong 6 giờ thì 3 người đào 3 cái hố trong bao lâu?', options: ['3 giờ', '6 giờ', '9 giờ', '12 giờ'], answer: 1,
    explain: 'Mỗi người đào 1 hố trong 6 giờ ⇒ 3 người đào 3 hố vẫn mất 6 giờ.' },
  { id: 'g3-12', category: '🧠 Logic', d: 3, q: 'Có 3 công tắc và 3 bóng đèn ở hai phòng khác nhau; bạn chỉ được vào phòng đèn một lần. Yếu tố nào giúp giải bài này?', options: ['Nhiệt độ của bóng đèn vừa bật', 'Màu sắc dây điện của công tắc', 'Âm thanh phát ra khi bật công tắc', 'Thứ tự đánh số của các bóng đèn'], answer: 0,
    explain: 'Mẹo kinh điển: bóng vừa tắt vẫn còn ẤM — dùng nhiệt làm "bit nhớ" thứ hai ngoài sáng/tối.' },
  { id: 'g3-13', category: '🧠 Logic', d: 2, q: 'Một cửa hàng giảm 10% rồi tính thuế 10%. So với tính thuế trước rồi giảm 10%, giá cuối cùng thế nào?', options: ['Cách một rẻ hơn', 'Cách hai rẻ hơn', 'Hai cách bằng nhau', 'Tuỳ vào giá gốc'], answer: 2,
    explain: 'Nhân có tính giao hoán: 0.9 × 1.1 = 1.1 × 0.9 ⇒ hai cách cho cùng một giá.' },
  { id: 'g3-14', category: '🧠 Logic', d: 3, q: 'Bạn có 3 lọ: một toàn bi đỏ, một toàn bi xanh, một lẫn. Cả 3 nhãn đều dán SAI. Bốc 1 bi từ lọ nào để suy ra toàn bộ?', options: ['Lọ dán nhãn "đỏ"', 'Lọ dán nhãn "xanh"', 'Lọ dán nhãn "lẫn"', 'Lọ nào cũng được như nhau'], answer: 2,
    explain: 'Lọ dán "lẫn" chắc chắn KHÔNG lẫn (nhãn sai) ⇒ bốc 1 bi là biết nó thuần loại gì, hai lọ kia suy ra ngay.' },
  { id: 'g3-15', category: '🧠 Logic', d: 2, q: 'Nếu tất cả X là Y và một số Y là Z, và biết chắc có ít nhất một X. Kết luận nào ĐÚNG?', options: ['Chắc chắn có ít nhất một Y', 'Chắc chắn có ít nhất một Z', 'Chắc chắn một số X là Z', 'Chắc chắn mọi Z đều là Y'], answer: 0,
    explain: 'Có X ⇒ có Y (vì mọi X đều là Y). Quan hệ X–Z thì không suy ra được.' },

  { id: 'm3-1', category: '➗ Toán nhanh', d: 2, q: 'Một tam giác vuông có hai cạnh góc vuông 6 và 8. Cạnh huyền dài bao nhiêu?', options: ['9', '10', '12', '14'], answer: 1,
    explain: '√(36 + 64) = √100 = 10 (bộ ba Pythagore 6-8-10).' },
  { id: 'm3-2', category: '➗ Toán nhanh', d: 2, q: '2^5 × 2^3 bằng bao nhiêu?', options: ['64', '128', '256', '1024'], answer: 2,
    explain: 'Cộng số mũ: 2^8 = 256.' },
  { id: 'm3-3', category: '➗ Toán nhanh', d: 1, q: '35% của 400 là bao nhiêu?', options: ['120', '135', '140', '150'], answer: 2,
    explain: '10% là 40 ⇒ 30% là 120; 5% là 20 ⇒ tổng 140.' },
  { id: 'm3-4', category: '➗ Toán nhanh', d: 2, q: 'Chia 1 giờ 20 phút cho 4 được bao nhiêu?', options: ['15 phút', '20 phút', '25 phút', '30 phút'], answer: 1,
    explain: '80 phút ÷ 4 = 20 phút.' },
  { id: 'm3-5', category: '➗ Toán nhanh', d: 2, q: 'Một mảnh đất 20m × 15m. Rào quanh hết bao nhiêu mét hàng rào?', options: ['35 m', '60 m', '70 m', '300 m'], answer: 2,
    explain: 'Chu vi = 2 × (20 + 15) = 70 m (300 là diện tích, bẫy quen thuộc).' },
  { id: 'm3-6', category: '➗ Toán nhanh', d: 3, q: 'Xác suất một byte ngẫu nhiên (8 bit) có TẤT CẢ bit bằng 1 là?', options: ['1/8', '1/64', '1/128', '1/256'], answer: 3,
    explain: 'Mỗi bit 1/2 ⇒ 8 bit: (1/2)^8 = 1/256.' },
  { id: 'm3-7', category: '➗ Toán nhanh', d: 2, q: 'Nếu 1 request tốn 40ms, thì trong 1 giây một luồng xử lý tuần tự được bao nhiêu request?', options: ['4', '25', '40', '250'], answer: 1,
    explain: '1000ms ÷ 40ms = 25 request/giây trên một luồng.' },
  { id: 'm3-8', category: '➗ Toán nhanh', d: 3, q: 'Một hệ thống uptime 99.9%/năm thì downtime tối đa khoảng bao nhiêu?', options: ['~8,8 giờ/năm', '~52 phút/năm', '~5,3 phút/năm', '~3,7 ngày/năm'], answer: 0,
    explain: '0.1% của 8760 giờ ≈ 8,76 giờ. (99,99% mới là ~52 phút, 99,999% là ~5 phút.)' },
  { id: 'm3-9', category: '➗ Toán nhanh', d: 2, q: 'Trung bình cộng của 5 số là 20. Thêm số 32 vào thì trung bình mới là?', options: ['21', '22', '24', '26'], answer: 1,
    explain: 'Tổng cũ 100, thêm 32 thành 132, chia 6 = 22.' },
  { id: 'm3-10', category: '➗ Toán nhanh', d: 2, q: 'Một tủ lạnh giá 12 triệu, giảm 25%. Giá sau giảm là?', options: ['8 triệu', '9 triệu', '9,6 triệu', '10 triệu'], answer: 1,
    explain: '25% của 12 là 3 ⇒ còn 9 triệu.' },

  { id: 'x3-1', category: '🧭 Hình & không gian', d: 2, q: 'Một khối lập phương 4×4×4 sơn ngoài rồi cắt thành 64 khối nhỏ. Bao nhiêu khối KHÔNG dính sơn?', options: ['4 khối', '8 khối', '16 khối', '24 khối'], answer: 1,
    explain: 'Lõi bên trong là khối 2×2×2 ⇒ 8 khối không chạm mặt ngoài.' },
  { id: 'x3-2', category: '🧭 Hình & không gian', d: 2, q: 'Bạn quay mặt hướng Nam, quay TRÁI 90° hai lần. Bạn nhìn hướng nào?', options: ['Đông', 'Tây', 'Nam', 'Bắc'], answer: 3,
    explain: 'Nam → (trái) Đông → (trái) Bắc.' },
  { id: 'x3-3', category: '🧭 Hình & không gian', d: 3, q: 'Gấp tờ giấy làm đôi 3 lần rồi bấm 1 lỗ xuyên qua. Mở ra có bao nhiêu lỗ?', options: ['3 lỗ', '4 lỗ', '6 lỗ', '8 lỗ'], answer: 3,
    explain: 'Gấp 3 lần tạo 2³ = 8 lớp giấy chồng nhau ⇒ 8 lỗ.' },
  { id: 'x3-4', category: '🧭 Hình & không gian', d: 2, q: 'Hình tròn bán kính tăng gấp đôi thì diện tích tăng gấp mấy?', options: ['2 lần', '3 lần', '4 lần', '8 lần'], answer: 2,
    explain: 'Diện tích tỉ lệ với r² ⇒ gấp đôi bán kính thì diện tích gấp 4.' },
  { id: 'x3-5', category: '🧭 Hình & không gian', d: 3, q: 'Đồng hồ chỉ 9 giờ 30. Góc giữa hai kim là?', options: ['90 độ', '105 độ', '112,5 độ', '120 độ'], answer: 1,
    explain: 'Kim phút ở 180°. Kim giờ ở 9 × 30 + 30 × 0,5 = 285° ⇒ chênh |285 − 180| = 105°.' },

  { id: 'w3-1', category: '⏱️ Chuyển động & công việc', d: 2, q: 'Hai vòi cùng chảy đầy bể trong 6 giờ. Riêng vòi A mất 10 giờ. Riêng vòi B mất bao lâu?', options: ['12 giờ', '15 giờ', '16 giờ', '20 giờ'], answer: 1,
    explain: '1/6 − 1/10 = 1/15 ⇒ vòi B cần 15 giờ.' },
  { id: 'w3-2', category: '⏱️ Chuyển động & công việc', d: 2, q: 'Xe đi 45 phút với tốc độ 80 km/h thì được bao nhiêu km?', options: ['50 km', '55 km', '60 km', '65 km'], answer: 2,
    explain: '45 phút = 0,75 giờ ⇒ 80 × 0,75 = 60 km.' },
  { id: 'w3-3', category: '⏱️ Chuyển động & công việc', d: 3, q: 'Hai xe cùng chiều cách nhau 30km, xe sau chạy 70 km/h, xe trước 50 km/h. Bao lâu thì đuổi kịp?', options: ['1 giờ', '1,5 giờ', '2 giờ', '3 giờ'], answer: 1,
    explain: 'Tốc độ tiếp cận 70 − 50 = 20 km/h ⇒ 30 / 20 = 1,5 giờ.' },
  { id: 'w3-4', category: '⏱️ Chuyển động & công việc', d: 2, q: 'Một API chịu 500 request/giây. Cần phục vụ 2 triệu request đều trong 1 giờ cao điểm. Có đủ không?', options: ['Đủ, còn dư khoảng một nửa công suất', 'Thiếu — cần khoảng 556 request/giây', 'Thiếu — cần gấp đôi công suất hiện tại', 'Vừa đủ đúng bằng ngưỡng 500 rps'], answer: 1,
    explain: '2.000.000 / 3600 ≈ 556 request/giây, vượt ngưỡng 500 ⇒ thiếu khoảng 11% công suất.' },
  { id: 'w3-5', category: '⏱️ Chuyển động & công việc', d: 2, q: 'Job chạy 2 giờ trên 1 máy, song song hoá được 50% khối lượng. Với vô hạn máy, nhanh nhất còn bao lâu?', options: ['30 phút', '1 giờ', '1 giờ 30 phút', '2 giờ'], answer: 1,
    explain: 'Nửa tuần tự không rút ngắn được ⇒ giới hạn là 1 giờ (định luật Amdahl).' },

  // =========================================================================
  // 🖼️ SUY LUẬN HÌNH — nhìn hình chọn hình (ma trận, xoay, chồng lưới, khác nhóm)
  // =========================================================================

  // ---- Chồng hai lưới 3×3 (đáp án do máy tính ra ⇒ không thể sai) ----
  gOpQ('gx1', 2, '110/010/011', '011/010/110', 'xor', 'Giữ ô chỉ MỘT lưới tô; ô cả hai cùng tô thì bỏ trống.'),
  gOpQ('gx2', 2, '111/000/101', '101/010/101', 'and', 'Chỉ giữ ô mà CẢ HAI lưới cùng tô.'),
  gOpQ('gx3', 2, '100/010/001', '001/010/100', 'or', 'Tô ô nào có mặt ở ít nhất một trong hai lưới.'),
  gOpQ('gx4', 3, '110/101/011', '011/110/101', 'xor', 'Phép XOR: ô trùng nhau triệt tiêu, ô lệch nhau thì giữ.'),
  gOpQ('gx5', 3, '111/101/111', '010/111/010', 'and', 'Giao của hai lưới — chỉ những ô cùng tô ở cả hai hình.'),
  gOpQ('gx6', 2, '100/110/111', '001/011/111', 'xor', 'Hàng cuối trùng khít nên biến mất; chỉ còn phần lệch của hai hàng trên.'),
  gOpQ('gx7', 3, '101/010/101', '010/101/010', 'or', 'Hai lưới bù nhau ⇒ hợp lại phủ kín cả 9 ô.'),
  gOpQ('gx8', 3, '110/011/100', '010/110/001', 'xor', 'Cộng theo modulo 2 từng ô: giống nhau → 0, khác nhau → 1.'),

  // ---- Ma trận 3×3: tìm ô còn thiếu ----
  figQ({
    id: 'mx1', d: 2, q: 'Ô dấu ? trong ma trận là hình nào?',
    fig: figGrid([sCell('c'), sCell('s'), sCell('t'), sCell('s'), sCell('t'), sCell('c'), sCell('t'), sCell('c'), '?']),
    opts: [sCell('s'), sCell('t'), sCell('c'), sCell('d')],
    explain: 'Mỗi hàng và mỗi cột đều có đủ 3 hình tròn – vuông – tam giác, không lặp. Hàng cuối đã có tam giác và tròn ⇒ thiếu hình vuông.',
  }),
  figQ({
    id: 'mx2', d: 2, q: 'Ô dấu ? trong ma trận là hình nào?',
    fig: figGrid([sCell('c', 0), sCell('c', 1), sCell('c', 2), sCell('s', 0), sCell('s', 1), sCell('s', 2), sCell('t', 0), sCell('t', 1), '?']),
    opts: [sCell('t', 2), sCell('t', 0), sCell('s', 2), sCell('c', 2)],
    explain: 'Hàng quyết định HÌNH (tròn → vuông → tam giác), cột quyết định CÁCH TÔ (rỗng → có chấm → tô đặc). Ô cuối: tam giác tô đặc.',
  }),
  figQ({
    id: 'mx3', d: 3, q: 'Ô dấu ? trong ma trận là hình nào?',
    fig: figGrid([
      iqSvg(rot(ELL, 0)), iqSvg(rot(ELL, 90)), iqSvg(rot(ELL, 180)),
      iqSvg(rot(ELL, 90)), iqSvg(rot(ELL, 180)), iqSvg(rot(ELL, 270)),
      iqSvg(rot(ELL, 180)), iqSvg(rot(ELL, 270)), '?']),
    opts: [iqSvg(rot(ELL, 0)), iqSvg(rot(ELL, 90)), iqSvg(rot(ELL, 180)), iqSvg(rot(ELL, 270))],
    explain: 'Mỗi bước sang phải hình xoay thêm 90° thuận chiều kim đồng hồ. Từ 270° xoay tiếp 90° là 360° = về vị trí gốc.',
  }),
  figQ({
    id: 'mx4', d: 2, q: 'Ô dấu ? trong ma trận là hình nào?',
    fig: figGrid([iqSvg(dots(1)), iqSvg(dots(2)), iqSvg(dots(3)), iqSvg(dots(4)), iqSvg(dots(5)), iqSvg(dots(6)), iqSvg(dots(7)), iqSvg(dots(8)), '?']),
    opts: [iqSvg(dots(9)), iqSvg(dots(7)), iqSvg(dots(6)), iqSvg(dots(4))],
    explain: 'Số chấm tăng đều 1 → 2 → 3 … theo thứ tự đọc từ trái sang phải, hết hàng xuống hàng dưới. Ô cuối là 9 chấm.',
  }),
  figQ({
    id: 'mx5', d: 3, q: 'Ô dấu ? trong ma trận là hình nào?',
    fig: figGrid([
      iqSvg(polyShape(3)), iqSvg(polyShape(4)), iqSvg(polyShape(5)),
      iqSvg(polyShape(4)), iqSvg(polyShape(5)), iqSvg(polyShape(6)),
      iqSvg(polyShape(5)), iqSvg(polyShape(6)), '?']),
    opts: [iqSvg(polyShape(7)), iqSvg(polyShape(6)), iqSvg(polyShape(5)), iqSvg(polyShape(4))],
    explain: 'Số cạnh tăng 1 mỗi ô sang phải: hàng cuối là 5 – 6 – 7 cạnh ⇒ ô thiếu là đa giác 7 cạnh.',
  }),
  figQ({
    id: 'mx6', d: 3, q: 'Ô dấu ? trong ma trận là hình nào? (cột 3 = cột 1 chồng lên cột 2)',
    fig: figGrid([
      sCell('c'), sCell('s'), iqSvg(shape('c') + shape('s')),
      sCell('t'), sCell('c'), iqSvg(shape('t') + shape('c')),
      sCell('s'), sCell('t'), '?']),
    opts: [iqSvg(shape('s') + shape('t')), iqSvg(shape('s') + shape('c')), sCell('t'), iqSvg(shape('c') + shape('t'))],
    explain: 'Cột 3 là hai hình của cột 1 và cột 2 vẽ chồng lên nhau ⇒ hàng cuối = vuông chồng tam giác.',
  }),
  figQ({
    id: 'mx7', d: 2, q: 'Ô dấu ? trong ma trận là hình nào?',
    fig: figGrid([
      gSvg('100/000/000'), gSvg('110/000/000'), gSvg('111/000/000'),
      gSvg('100/100/000'), gSvg('110/110/000'), gSvg('111/111/000'),
      gSvg('100/100/100'), gSvg('110/110/110'), '?']),
    opts: [gSvg('111/111/111'), gSvg('111/111/000'), gSvg('110/110/110'), gSvg('011/011/011')],
    explain: 'Sang phải thêm 1 cột, xuống dưới thêm 1 hàng ⇒ ô cuối là lưới tô kín 3×3.',
  }),
  figQ({
    id: 'mx8', d: 3, q: 'Ô dấu ? trong ma trận là hình nào? (mỗi hàng: hình 3 = hình 1 ⊕ hình 2)',
    fig: figGrid([
      gSvg('110/000/011'), gSvg('010/010/010'), gSvg(gOp('110/000/011', '010/010/010', 'xor')),
      gSvg('101/000/101'), gSvg('001/010/100'), gSvg(gOp('101/000/101', '001/010/100', 'xor')),
      gSvg('111/000/000'), gSvg('010/010/010'), '?']),
    opts: [gSvg(gOp('111/000/000', '010/010/010', 'xor')), gSvg(gOp('111/000/000', '010/010/010', 'or')),
      gSvg(gOp('111/000/000', '010/010/010', 'and')), gSvg(gInv(gOp('111/000/000', '010/010/010', 'xor')))],
    explain: 'Quy luật từng hàng là XOR: ô nào chỉ một trong hai lưới tô thì giữ, ô trùng nhau thì bỏ.',
  }),

  // ---- Chuỗi xoay hình ----
  figQ({
    id: 'rt1', d: 1, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([iqSvg(rot(ARROW, 0)), iqSvg(rot(ARROW, 45)), iqSvg(rot(ARROW, 90)), iqSvg(rot(ARROW, 135)), '?']),
    opts: [iqSvg(rot(ARROW, 180)), iqSvg(rot(ARROW, 225)), iqSvg(rot(ARROW, 90)), iqSvg(rot(ARROW, 270))],
    explain: 'Mỗi bước mũi tên xoay thêm 45° thuận chiều kim đồng hồ: 135° + 45° = 180° (mũi tên chúc xuống).',
  }),
  figQ({
    id: 'rt2', d: 2, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([iqSvg(rot(FLAG, 0)), iqSvg(rot(FLAG, 90)), iqSvg(rot(FLAG, 180)), '?']),
    opts: [iqSvg(rot(FLAG, 270)), iqSvg(rot(FLAG, 0)), iqSvg(rot(FLAG, 90)), iqSvg(rot(FLAG, 135))],
    explain: 'Lá cờ xoay 90° mỗi bước theo chiều kim đồng hồ ⇒ sau 180° là 270°.',
  }),
  figQ({
    id: 'rt3', d: 2, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([iqSvg(rot(ELL, 0)), iqSvg(rot(ELL, 270)), iqSvg(rot(ELL, 180)), '?']),
    opts: [iqSvg(rot(ELL, 90)), iqSvg(rot(ELL, 0)), iqSvg(rot(ELL, 180)), iqSvg(rot(ELL, 270))],
    explain: 'Chuỗi xoay NGƯỢC chiều kim đồng hồ 90° mỗi bước: 0° → 270° → 180° → 90°.',
  }),
  figQ({
    id: 'rt4', d: 3, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([gSvg('100/000/000'), gSvg('001/000/000'), gSvg('000/000/001'), '?']),
    opts: [gSvg('000/000/100'), gSvg('100/000/000'), gSvg('000/010/000'), gSvg('001/000/000')],
    explain: 'Ô tô đen chạy vòng quanh 4 góc theo chiều kim đồng hồ: trên-trái → trên-phải → dưới-phải → dưới-trái.',
  }),
  figQ({
    id: 'rt5', d: 3, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([dotAt(0), dotAt(1), dotAt(2), dotAt(5), '?']),
    opts: [dotAt(8), dotAt(4), dotAt(3), dotAt(7)],
    explain: 'Chấm đi men theo viền lưới theo chiều kim đồng hồ, mỗi bước 1 ô: sau ô giữa-phải là ô dưới-phải.',
  }),
  figQ({
    id: 'rt6', d: 3, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([dotAt(8), dotAt(7), dotAt(6), dotAt(3), '?']),
    opts: [dotAt(0), dotAt(4), dotAt(1), dotAt(2)],
    explain: 'Chấm chạy NGƯỢC chiều kim đồng hồ theo viền: dưới-phải → dưới-giữa → dưới-trái → giữa-trái → trên-trái.',
  }),
  figQ({
    id: 'rt7', d: 2, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([dotAt(0), dotAt(2), dotAt(8), '?']),
    opts: [dotAt(6), dotAt(4), dotAt(5), dotAt(1)],
    explain: 'Chấm nhảy 2 ô một theo viền, tức lần lượt qua 4 góc: trên-trái → trên-phải → dưới-phải → dưới-trái.',
  }),

  // ---- Chuỗi số cạnh / số lượng ----
  figQ({
    id: 'sq1', d: 1, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([sCell('t'), sCell('s'), sCell('p'), '?']),
    opts: [sCell('h'), sCell('c'), sCell('p'), sCell('d')],
    explain: 'Số cạnh tăng dần 3 → 4 → 5 ⇒ hình tiếp theo có 6 cạnh (lục giác).',
  }),
  figQ({
    id: 'sq2', d: 3, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([iqSvg(polyShape(3)), iqSvg(polyShape(5)), iqSvg(polyShape(7)), '?']),
    opts: [iqSvg(polyShape(9)), iqSvg(polyShape(8)), iqSvg(polyShape(6)), iqSvg(polyShape(4))],
    explain: 'Số cạnh là dãy số lẻ 3 → 5 → 7 ⇒ tiếp theo là đa giác 9 cạnh.',
  }),
  figQ({
    id: 'sq3', d: 2, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([iqSvg(dots(1)), iqSvg(dots(2)), iqSvg(dots(3)), iqSvg(dots(5)), '?']),
    opts: [iqSvg(dots(8)), iqSvg(dots(6)), iqSvg(dots(7)), iqSvg(dots(9))],
    explain: 'Số chấm theo dãy Fibonacci 1, 2, 3, 5 ⇒ tiếp theo là 3 + 5 = 8 chấm.',
  }),
  figQ({
    id: 'sq4', d: 2, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([gSvg('100/000/000'), gSvg('110/000/000'), gSvg('111/000/000'), gSvg('111/100/000'), '?']),
    opts: [gSvg('111/110/000'), gSvg('111/111/000'), gSvg('111/100/100'), gSvg('110/110/000')],
    explain: 'Mỗi bước tô thêm đúng 1 ô theo thứ tự đọc (trái → phải, hết hàng thì xuống hàng dưới) ⇒ ô thứ 5 nằm ở hàng giữa, cột giữa.',
  }),

  // ---- Gương & xoay lưới ----
  figQ({
    id: 'mr1', d: 2, q: 'Soi hình bên dưới qua GƯƠNG đặt dọc bên phải, ảnh thu được là hình nào?',
    fig: figRow([gSvg('110/011/001')]),
    opts: [gSvg(gFlip('110/011/001')), gSvg('110/011/001'), gSvg(gRot('110/011/001')), gSvg(gInv('110/011/001'))],
    explain: 'Gương dọc lật trái ↔ phải trong từng hàng (thứ tự hàng giữ nguyên).',
  }),
  figQ({
    id: 'mr2', d: 2, q: 'Xoay hình bên dưới 90° THUẬN chiều kim đồng hồ được hình nào?',
    fig: figRow([gSvg('111/010/100')]),
    opts: [gSvg(gRot('111/010/100')), gSvg(gFlip('111/010/100')), gSvg('111/010/100'), gSvg(gRot(gRot('111/010/100')))],
    explain: 'Xoay 90° thuận: hàng trên cùng chuyển thành cột bên phải.',
  }),
  figQ({
    id: 'mr3', d: 3, q: 'Xoay hình bên dưới 180° được hình nào?',
    fig: figRow([gSvg('101/110/010')]),
    opts: [gSvg(gRot(gRot('101/110/010'))), gSvg(gRot('101/110/010')), gSvg(gFlip('101/110/010')), gSvg('101/110/010')],
    explain: 'Xoay 180° = lật cả trên↔dưới và trái↔phải cùng lúc.',
  }),
  figQ({
    id: 'mr4', d: 3, q: 'Lật hình bên dưới theo trục NGANG (trên ↔ dưới) được hình nào?',
    fig: figRow([gSvg('110/010/001')]),
    opts: [gSvg(gFlipV('110/010/001')), gSvg(gFlip('110/010/001')), gSvg(gRot('110/010/001')), gSvg('110/010/001')],
    explain: 'Lật qua trục ngang: hàng trên đổi chỗ với hàng dưới, hàng giữa đứng yên.',
  }),

  // ---- Khác nhóm (nhìn hình) ----
  figQ({
    id: 'od1', d: 2, q: 'Hình nào KHÁC NHÓM?',
    opts: [iqSvg(polyShape(3)), iqSvg(polyShape(4)), iqSvg(polyShape(6)), iqSvg(polyShape(8))],
    explain: 'Ba hình kia có số cạnh CHẴN (4, 6, 8); tam giác 3 cạnh là số lẻ. (Chấm ở đỉnh để đếm cạnh cho nhanh.)',
  }),
  figQ({
    id: 'od2', d: 3, q: 'Hình nào KHÁC NHÓM?',
    opts: [iqSvg(`<g transform="translate(60,0) scale(-1,1)">${ELL}</g>`), iqSvg(rot(ELL, 0)), iqSvg(rot(ELL, 90)), iqSvg(rot(ELL, 180))],
    explain: 'Ba hình kia chỉ khác nhau ở góc XOAY; hình còn lại là ảnh trong GƯƠNG — xoay kiểu gì cũng không trùng được.',
  }),
  figQ({
    id: 'od3', d: 2, q: 'Hình nào KHÁC NHÓM?',
    opts: [gSvg('111/010/010'), gSvg('110/010/010'), gSvg('010/010/011'), gSvg('011/010/010')],
    explain: 'Ba lưới kia đều tô đúng 4 ô; lưới còn lại tô 5 ô.',
  }),
  figQ({
    id: 'od4', d: 2, q: 'Hình nào KHÁC NHÓM?',
    opts: [sCell('c', 1), sCell('s', 0), sCell('t', 0), sCell('h', 0)],
    explain: 'Ba hình kia chỉ có đường viền; hình còn lại có thêm chấm ở giữa.',
  }),
  figQ({
    id: 'od5', d: 3, q: 'Hình nào KHÁC NHÓM?',
    opts: [gSvg(gFlip('100/100/110')), gSvg('100/100/110'), gSvg(gRot('100/100/110')), gSvg(gRot(gRot('100/100/110')))],
    explain: 'Ba lưới kia là cùng một hình chữ L xoay đi; lưới còn lại là ảnh GƯƠNG của nó — xoay kiểu gì cũng không trùng.',
  }),
  figQ({
    id: 'od6', d: 2, q: 'Hình nào KHÁC NHÓM?',
    opts: [sCell('p'), sCell('s', 2), sCell('c', 2), sCell('t', 2)],
    explain: 'Ba hình kia được tô đặc; hình còn lại chỉ có viền rỗng.',
  }),

  // ---- Đếm hình trong hình vẽ (nhìn hình, chọn số) ----
  { id: 'cf1', category: '🖼️ Suy luận hình', d: 2, q: 'Hình vẽ có tất cả bao nhiêu TAM GIÁC?',
    fig: figRow([iqSvg('<g class="so"><rect x="8" y="8" width="44" height="44"/><path d="M8 8 L52 52 M52 8 L8 52"/></g>')], 'lg'),
    options: ['4', '6', '8', '10'], answer: 2,
    explain: 'Hai đường chéo cắt nhau tạo 4 tam giác nhỏ + 4 tam giác lớn (mỗi nửa hình vuông) = 8.' },
  { id: 'cf2', category: '🖼️ Suy luận hình', d: 3, q: 'Hình vẽ có tất cả bao nhiêu TAM GIÁC?',
    fig: figRow([iqSvg('<g class="so"><polygon points="30,6 54,52 6,52"/><path d="M30 6 L22 52 M30 6 L38 52"/></g>')], 'lg'),
    options: ['4', '5', '6', '7'], answer: 2,
    explain: 'Đáy bị chia thành 3 đoạn ⇒ chọn 2 trong 4 điểm chia làm hai đầu đáy: C(4,2) = 6 tam giác.' },
  { id: 'cf3', category: '🖼️ Suy luận hình', d: 1, q: 'Hình vẽ có tất cả bao nhiêu HÌNH VUÔNG?',
    fig: figRow([iqSvg('<g class="so"><rect x="8" y="8" width="44" height="44"/><path d="M30 8 L30 52 M8 30 L52 30"/></g>')], 'lg'),
    options: ['4', '5', '6', '8'], answer: 1,
    explain: '4 hình vuông nhỏ + 1 hình vuông lớn bao ngoài = 5.' },
  { id: 'cf4', category: '🖼️ Suy luận hình', d: 3, q: 'Hình vẽ có tất cả bao nhiêu HÌNH VUÔNG?',
    fig: figRow([iqSvg('<g class="so"><rect x="6" y="6" width="48" height="48"/><path d="M22 6 L22 54 M38 6 L38 54 M6 22 L54 22 M6 38 L54 38"/></g>')], 'lg'),
    options: ['9', '12', '14', '16'], answer: 2,
    explain: 'Lưới 3×3: 9 vuông cạnh 1 + 4 vuông cạnh 2 + 1 vuông cạnh 3 = 14.' },
  { id: 'cf5', category: '🖼️ Suy luận hình', d: 3, q: 'Hình vẽ có tất cả bao nhiêu HÌNH CHỮ NHẬT (tính cả hình vuông)?',
    fig: figRow([iqSvg('<g class="so"><rect x="8" y="8" width="44" height="44"/><path d="M30 8 L30 52 M8 30 L52 30"/></g>')], 'lg'),
    options: ['5', '6', '9', '12'], answer: 2,
    explain: 'Chọn 2 trong 3 đường dọc và 2 trong 3 đường ngang: C(3,2) × C(3,2) = 3 × 3 = 9.' },

  // ---- Ma trận số (nhìn lưới, tìm số thiếu) ----
  { id: 'nm1', category: '🖼️ Suy luận hình', d: 2, q: 'Số ở ô dấu ? là bao nhiêu?',
    fig: figGrid([numCell(2), numCell(3), numCell(5), numCell(4), numCell(5), numCell(9), numCell(6), numCell(7), '?']),
    options: ['11', '12', '13', '14'], answer: 2,
    explain: 'Cột 3 = cột 1 + cột 2. Hàng cuối: 6 + 7 = 13.' },
  { id: 'nm2', category: '🖼️ Suy luận hình', d: 2, q: 'Số ở ô dấu ? là bao nhiêu?',
    fig: figGrid([numCell(3), numCell(4), numCell(12), numCell(5), numCell(2), numCell(10), numCell(6), numCell(7), '?']),
    options: ['13', '36', '42', '48'], answer: 2,
    explain: 'Cột 3 = cột 1 × cột 2. Hàng cuối: 6 × 7 = 42.' },
  { id: 'nm3', category: '🖼️ Suy luận hình', d: 2, q: 'Số ở ô dấu ? là bao nhiêu?',
    fig: figGrid([numCell(8), numCell(4), numCell(2), numCell(12), numCell(3), numCell(4), numCell(20), numCell(5), '?']),
    options: ['3', '4', '5', '15'], answer: 1,
    explain: 'Cột 3 = cột 1 ÷ cột 2. Hàng cuối: 20 ÷ 5 = 4.' },
  { id: 'nm4', category: '🖼️ Suy luận hình', d: 3, q: 'Số ở ô dấu ? là bao nhiêu?',
    fig: figGrid([numCell(2), numCell(3), numCell(13), numCell(3), numCell(4), numCell(25), numCell(4), numCell(5), '?']),
    options: ['31', '38', '41', '45'], answer: 2,
    explain: 'Cột 3 = cột 1² + cột 2². Hàng cuối: 4² + 5² = 16 + 25 = 41.' },
  { id: 'nm5', category: '🖼️ Suy luận hình', d: 2, q: 'Số ở ô dấu ? là bao nhiêu?',
    fig: figGrid([numCell(1), numCell(4), numCell(9), numCell(16), numCell(25), numCell(36), numCell(49), numCell(64), '?']),
    options: ['72', '81', '90', '100'], answer: 1,
    explain: 'Các số chính phương liên tiếp 1², 2², … , 8² ⇒ ô cuối là 9² = 81.' },
  { id: 'nm6', category: '🖼️ Suy luận hình', d: 3, q: 'Số ở ô dấu ? là bao nhiêu?',
    fig: figGrid([numCell(7), numCell(2), numCell(5), numCell(9), numCell(6), numCell(3), numCell(11), numCell(4), '?']),
    options: ['5', '6', '7', '15'], answer: 2,
    explain: 'Cột 3 = cột 1 − cột 2. Hàng cuối: 11 − 4 = 7.' },

  // =========================================================================
  // 🧠 LOGIC SUY DIỄN BỔ SUNG — thay cho nhóm "tương tự chữ" đã bỏ
  // =========================================================================
  { id: 'dl1', category: '🧠 Logic', d: 3, q: 'A, B, C, D xếp hàng. A đứng trước B nhưng sau C. D đứng cuối. Ai đứng đầu?', options: ['A', 'B', 'C', 'D'], answer: 2,
    explain: 'C trước A, A trước B, D cuối ⇒ thứ tự C – A – B – D. Đứng đầu là C.' },
  { id: 'dl2', category: '🧠 Logic', d: 3, q: 'Ba người: một luôn nói thật, một luôn nói dối. X nói "Y nói dối". Y nói "X và tôi cùng loại". Ai nói dối?', options: ['X', 'Y', 'Cả hai', 'Không xác định được'], answer: 1,
    explain: 'Giả sử Y thật ⇒ X cũng thật ⇒ X nói "Y nói dối" là sai ⇒ mâu thuẫn. Vậy Y nói dối (và X nói thật).' },
  { id: 'dl3', category: '🧠 Logic', d: 2, q: 'Mọi lập trình viên đều biết Git. Nam biết Git. Kết luận nào ĐÚNG?', options: ['Nam chắc chắn là lập trình viên', 'Nam chắc chắn không là lập trình viên', 'Chưa thể kết luận gì về Nam', 'Ai biết Git cũng là lập trình viên'], answer: 2,
    explain: 'Đây là lỗi "khẳng định hệ quả": biết Git là điều kiện CẦN chứ không ĐỦ để là lập trình viên.' },
  { id: 'dl4', category: '🧠 Logic', d: 3, q: 'Nếu trời mưa thì đường ướt. Đường KHÔNG ướt. Kết luận đúng?', options: ['Trời mưa', 'Trời không mưa', 'Không kết luận được', 'Đường sắp ướt'], answer: 1,
    explain: 'Phản đảo của "mưa ⇒ ướt" là "không ướt ⇒ không mưa" — luôn đúng.' },
  { id: 'dl5', category: '🧠 Logic', d: 3, q: 'Một số con mèo là vật nuôi. Mọi vật nuôi đều được tiêm phòng. Kết luận nào chắc chắn đúng?', options: ['Mọi con mèo đều được tiêm phòng', 'Một số con mèo được tiêm phòng', 'Không con mèo nào được tiêm phòng', 'Mọi vật được tiêm phòng đều là mèo'], answer: 1,
    explain: 'Phần mèo nằm trong nhóm vật nuôi chắc chắn được tiêm ⇒ "một số con mèo được tiêm phòng".' },
  { id: 'dl6', category: '🧠 Logic', d: 3, q: 'Trong 3 hộp dán nhãn "Táo", "Cam", "Táo+Cam", TẤT CẢ nhãn đều sai. Bốc 1 quả từ hộp nào là đủ biết cả 3 hộp?', options: ['Hộp "Táo"', 'Hộp "Cam"', 'Hộp "Táo+Cam"', 'Phải bốc từ 2 hộp'], answer: 2,
    explain: 'Hộp "Táo+Cam" chắc chắn thuần một loại. Bốc ra táo ⇒ hộp đó là Táo, rồi suy ngược hai hộp còn lại.' },
  { id: 'dl7', category: '🧠 Logic', d: 3, q: '5 đội đá vòng tròn, mỗi cặp gặp nhau đúng 1 lần. Có bao nhiêu trận?', options: ['8', '10', '15', '20'], answer: 1,
    explain: 'C(5,2) = 5 × 4 / 2 = 10 trận.' },
  { id: 'dl8', category: '🧠 Logic', d: 2, q: 'Trong phòng có 4 người, ai cũng bắt tay mỗi người đúng 1 lần. Có bao nhiêu cái bắt tay?', options: ['4', '6', '8', '12'], answer: 1,
    explain: 'C(4,2) = 6 cái bắt tay.' },
  { id: 'dl9', category: '🧠 Logic', d: 3, q: 'Có 8 quả bóng giống hệt nhau, 1 quả nặng hơn. Cần ÍT NHẤT bao nhiêu lần cân (cân thăng bằng) để tìm ra nó?', options: ['1', '2', '3', '4'], answer: 1,
    explain: 'Chia 3-3-2: cân lần 1 hai nhóm 3; lần 2 xử lý nhóm 3 (hoặc nhóm 2) ⇒ 2 lần là đủ.' },
  { id: 'dl10', category: '🧠 Logic', d: 3, q: 'Hai sợi dây, mỗi sợi cháy hết đúng 60 phút nhưng cháy KHÔNG đều. Đo 45 phút thế nào?', options: ['Đốt một sợi ở một đầu rồi gấp đôi sợi còn lại', 'Đốt A hai đầu và B một đầu; A cháy hết thì đốt nốt đầu kia của B', 'Đốt cả hai sợi ở cả hai đầu cùng lúc rồi cộng thời gian cháy lại với nhau', 'Không thể đo được đúng 45 phút với hai sợi dây này'], answer: 1,
    explain: 'A cháy 2 đầu hết sau 30 phút; lúc đó B còn 30 phút, đốt thêm đầu kia ⇒ 15 phút nữa. Tổng 45 phút.' },
  { id: 'dl11', category: '🧠 Logic', d: 2, q: 'Một lớp 30 học sinh: 18 học tiếng Anh, 15 học tiếng Nhật, 5 học cả hai. Bao nhiêu người KHÔNG học thứ tiếng nào?', options: ['0', '2', '3', '5'], answer: 1,
    explain: 'Học ít nhất một thứ tiếng: 18 + 15 − 5 = 28 ⇒ 30 − 28 = 2 người.' },
  { id: 'dl12', category: '🧠 Logic', d: 3, q: 'Ngăn kéo có 10 tất đen và 10 tất trắng lẫn lộn (tối om). Lấy ít nhất mấy chiếc để CHẮC CHẮN có 1 đôi cùng màu?', options: ['2', '3', '4', '11'], answer: 1,
    explain: 'Nguyên lý chuồng bồ câu: 3 chiếc mà chỉ có 2 màu ⇒ chắc chắn có 2 chiếc trùng màu.' },
  { id: 'dl13', category: '🧠 Logic', d: 3, q: 'Vẫn ngăn kéo đó, cần ít nhất mấy chiếc để CHẮC CHẮN có 1 đôi màu ĐEN?', options: ['3', '11', '12', '20'], answer: 2,
    explain: 'Xấu nhất bốc trúng cả 10 chiếc trắng trước, rồi 2 chiếc đen ⇒ 12 chiếc.' },
  { id: 'dl14', category: '🧠 Logic', d: 2, q: 'Một cái ao có bèo, mỗi ngày diện tích bèo tăng gấp đôi và ngày thứ 30 thì phủ kín ao. Ngày nào bèo phủ nửa ao?', options: ['Ngày 15', 'Ngày 20', 'Ngày 29', 'Ngày 28'], answer: 2,
    explain: 'Đi ngược một bước: trước khi kín một ngày thì mới được nửa ao ⇒ ngày 29.' },
  { id: 'dl15', category: '🧠 Logic', d: 3, q: '3 cái máy làm 3 sản phẩm mất 3 phút. 100 máy làm 100 sản phẩm mất bao lâu?', options: ['3 phút', '100 phút', '33 phút', '300 phút'], answer: 0,
    explain: 'Mỗi máy làm 1 sản phẩm trong 3 phút ⇒ 100 máy chạy song song vẫn chỉ mất 3 phút.' },
  { id: 'dl16', category: '🧠 Logic', d: 2, q: 'Cây bút và nắp bút giá tổng 11.000đ. Bút đắt hơn nắp 10.000đ. Nắp giá bao nhiêu?', options: ['500đ', '1.000đ', '1.500đ', '2.000đ'], answer: 0,
    explain: 'Nắp = x, bút = x + 10.000 ⇒ 2x + 10.000 = 11.000 ⇒ x = 500đ.' },
  { id: 'dl17', category: '🧠 Logic', d: 3, q: '5 ngôi nhà xếp liền nhau, đánh số 1→5. Nhà đỏ ở chính giữa. Nhà xanh ở NGAY BÊN TRÁI nhà trắng. Nhà xanh không ở số 1. Nhà xanh ở số mấy?', options: ['Số 2', 'Số 3', 'Số 4', 'Số 5'], answer: 2,
    explain: 'Xanh ở k thì trắng ở k+1, cả hai đều khác 3 (nhà đỏ) ⇒ k ∉ {2, 3}; k ≠ 1 theo đề; k = 5 thì không còn chỗ cho trắng ⇒ k = 4.' },
  { id: 'dl18', category: '🧠 Logic', d: 2, q: 'Nếu hôm nay là thứ Sáu thì 100 ngày nữa là thứ mấy?', options: ['Thứ Hai', 'Thứ Ba', 'Thứ Bảy', 'Chủ Nhật'], answer: 3,
    explain: '100 chia 7 dư 2 ⇒ đếm thêm 2 ngày từ thứ Sáu là Chủ Nhật.' },
  { id: 'dl20', category: '🧠 Logic', d: 3, q: 'Đồng hồ đánh 6 tiếng trong 5 giây (đều nhau). Đánh 12 tiếng mất bao lâu?', options: ['10 giây', '11 giây', '12 giây', '13 giây'], answer: 1,
    explain: '6 tiếng có 5 khoảng ⇒ mỗi khoảng 1 giây. 12 tiếng có 11 khoảng ⇒ 11 giây.' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #1 =====
  gOpQ('gx9', 3, '110/101/010', '011/100/110', 'xor', 'Ô nào chỉ một lưới tô thì giữ; ô cả hai cùng tô thì triệt tiêu.'),
  gOpQ('gx10', 2, '111/100/100', '100/100/111', 'and', 'Giao hai lưới: chỉ giữ ô mà CẢ HAI cùng tô — ở đây là cột trái.'),
  figQ({
    id: 'mx9', d: 3, q: 'Ô dấu ? trong ma trận là hình nào? (số chấm = hàng × cột)',
    fig: figGrid([iqSvg(dots(1)), iqSvg(dots(2)), iqSvg(dots(3)), iqSvg(dots(2)), iqSvg(dots(4)), iqSvg(dots(6)), iqSvg(dots(3)), iqSvg(dots(6)), '?']),
    opts: [iqSvg(dots(9)), iqSvg(dots(8)), iqSvg(dots(7)), iqSvg(dots(5))],
    explain: 'Mỗi ô có số chấm bằng tích chỉ số hàng × cột: hàng 3, cột 3 ⇒ 3 × 3 = 9 chấm.',
  }),
  figQ({
    id: 'rt8', d: 3, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([gSvg('110/010/010'), gSvg(gRot('110/010/010')), gSvg(gRot(gRot('110/010/010'))), '?']),
    opts: [gSvg(gRot(gRot(gRot('110/010/010')))), gSvg('110/010/010'), gSvg(gFlip('110/010/010')), gSvg(gRot('110/010/010'))],
    explain: 'Cả hình xoay 90° thuận chiều kim đồng hồ mỗi bước; bước thứ 4 là 270° so với hình gốc.',
  }),
  figQ({
    id: 'sq5', d: 2, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([gSvg('100/000/000'), gSvg('110/000/000'), gSvg('111/100/000'), '?']),
    opts: [gSvg('111/111/110'), gSvg('111/111/111'), gSvg('111/110/000'), gSvg('111/111/000')],
    explain: 'Số ô được tô nhân đôi mỗi bước: 1 → 2 → 4 → 8 ô (tô theo thứ tự đọc, còn chừa đúng 1 ô cuối).',
  }),
  figQ({
    id: 'od7', d: 3, q: 'Hình nào KHÁC NHÓM?',
    opts: [iqSvg(`<g transform="translate(60,0) scale(-1,1)">${FLAG}</g>`), iqSvg(rot(FLAG, 0)), iqSvg(rot(FLAG, 90)), iqSvg(rot(FLAG, 180))],
    explain: 'Ba lá cờ kia chỉ khác góc xoay; lá còn lại là ảnh trong gương (cán cờ đổi bên mà cờ vẫn ở trên) — xoay kiểu gì cũng không trùng.',
  }),
  { id: 'cf6', category: '🖼️ Suy luận hình', d: 2, q: 'Hình vẽ có tất cả bao nhiêu HÌNH CHỮ NHẬT (tính cả hình vuông)?',
    fig: figRow([iqSvg('<g class="so"><rect x="4" y="20" width="52" height="20"/><path d="M21.3 20 L21.3 40 M38.6 20 L38.6 40"/></g>')], 'lg'),
    options: ['3', '4', '6', '8'], answer: 2,
    explain: 'Dải bị chia 3 ô: chọn 2 trong 4 đường dọc ⇒ C(4,2) = 6 hình chữ nhật.' },
  { id: 'nm7', category: '🖼️ Suy luận hình', d: 3, q: 'Số ở ô dấu ? là bao nhiêu?',
    fig: figGrid([numCell(2), numCell(3), numCell(10), numCell(4), numCell(5), numCell(18), numCell(6), numCell(1), '?']),
    options: ['7', '12', '14', '16'], answer: 2,
    explain: 'Cột 3 = (cột 1 + cột 2) × 2. Hàng cuối: (6 + 1) × 2 = 14.' },
  { id: 'dl21', category: '🧠 Logic', d: 3, q: 'Trong một cuộc thi, bạn vượt qua người đang ở vị trí THỨ HAI. Bạn đang ở vị trí nào?', options: ['Thứ nhất', 'Thứ hai', 'Thứ ba', 'Chưa xác định được'], answer: 1,
    explain: 'Vượt người thứ hai thì bạn CHIẾM vị trí của họ — vẫn còn người thứ nhất phía trước.' },
  { id: 'dl22', category: '🧠 Logic', d: 3, q: 'Một đàn chim đậu trên cây, bắn rơi 1 con. Còn mấy con đậu trên cây?', options: ['0 con — cả đàn bay hết', 'Đúng bằng số ban đầu trừ 1', '1 con', 'Không đủ dữ kiện để biết'], answer: 0,
    explain: 'Câu bẫy quen thuộc trong phỏng vấn: tiếng súng làm cả đàn bay đi, không còn con nào ĐẬU trên cây.' },
  { id: 'dl23', category: '🧠 Logic', d: 2, q: 'Server A xử lý 1 request mất 200ms, chạy 4 luồng song song. Trong 1 giây tối đa bao nhiêu request?', options: ['5', '10', '20', '40'], answer: 2,
    explain: 'Mỗi luồng làm 1000/200 = 5 request mỗi giây; 4 luồng ⇒ 20 request/giây.' },
  { id: 'dl24', category: '🧠 Logic', d: 3, q: 'Ba công tắc ngoài phòng, một cái bật bóng đèn trong phòng kín. Chỉ được vào phòng MỘT lần. Làm sao biết công tắc nào?', options: ['Bật lần lượt từng công tắc rồi vào phòng xem đèn nào sáng lên', 'Bật số 1 vài phút rồi tắt, bật số 2 và vào: sáng = 2, tắt mà nóng = 1', 'Không thể xác định được nếu chỉ được vào phòng đúng một lần', 'Bật cả ba công tắc cùng lúc rồi vào phòng quan sát độ sáng đèn'], answer: 1,
    explain: 'Dùng thêm một dấu hiệu ngoài ánh sáng là NHIỆT của bóng đèn ⇒ phân biệt được 3 trường hợp chỉ với một lần vào.' },
  { id: 'sq3-2', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 4, 9, 19, 39, ?', options: ['59', '69', '79', '89'], answer: 2,
    explain: 'Mỗi bước × 2 + 1: 39 × 2 + 1 = 79.' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #2 =====
  gOpQ('gx11', 2, '100/010/001', '110/000/011', 'or', 'Hợp hai lưới: ô nào có mặt ở ít nhất một hình thì được tô.'),
  figQ({
    id: 'mx10', d: 3, q: 'Ô dấu ? trong ma trận là hình nào? (cột 3 = ô CÓ ở cột 1 mà KHÔNG có ở cột 2)',
    fig: figGrid([
      gSvg('111/010/000'), gSvg('010/010/000'), gSvg(gOp('111/010/000', gInv('010/010/000'), 'and')),
      gSvg('110/011/000'), gSvg('010/001/000'), gSvg(gOp('110/011/000', gInv('010/001/000'), 'and')),
      gSvg('101/111/000'), gSvg('001/010/000'), '?']),
    opts: [gSvg(gOp('101/111/000', gInv('001/010/000'), 'and')), gSvg(gOp('101/111/000', '001/010/000', 'or')),
      gSvg(gFlip(gOp('101/111/000', gInv('001/010/000'), 'and'))), gSvg('001/010/000')],
    explain: 'Phép "trừ": giữ ô của hình trái rồi XOÁ những ô mà hình giữa cũng tô ⇒ 101/111 bỏ ô (0,2) và (1,1).',
  }),
  figQ({
    id: 'rt9', d: 3, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([dotAt(2), dotAt(5), dotAt(8), dotAt(7), '?']),
    opts: [dotAt(6), dotAt(4), dotAt(0), dotAt(3)],
    explain: 'Chấm chạy theo viền cùng chiều kim đồng hồ: trên-phải → giữa-phải → dưới-phải → dưới-giữa → dưới-trái.',
  }),
  figQ({
    id: 'sq6', d: 2, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([iqSvg(polyShape(8)), iqSvg(polyShape(7)), iqSvg(polyShape(6)), '?']),
    opts: [iqSvg(polyShape(5)), iqSvg(polyShape(4)), iqSvg(polyShape(7)), iqSvg(polyShape(3))],
    explain: 'Số cạnh GIẢM dần 8 → 7 → 6 ⇒ hình tiếp theo có 5 cạnh (đếm chấm ở đỉnh cho nhanh).',
  }),
  figQ({
    id: 'mr5', d: 3, q: 'Xoay hình bên dưới 90° NGƯỢC chiều kim đồng hồ được hình nào?',
    fig: figRow([gSvg('100/110/010')]),
    opts: [gSvg(gRot(gRot(gRot('100/110/010')))), gSvg(gRot('100/110/010')),
      gSvg(gRot(gRot('100/110/010'))), gSvg(gFlip('100/110/010'))],
    explain: 'Xoay ngược 90° = xoay thuận 270°: cột bên phải trở thành hàng trên cùng.',
  }),
  figQ({
    id: 'od8', d: 3, q: 'Hình nào KHÁC NHÓM?',
    opts: [gSvg('110/010/000'), gSvg('100/010/001'), gSvg('001/010/100'), gSvg('010/010/010')],
    explain: 'Ba lưới kia ĐỐI XỨNG gương (soi trái ↔ phải vẫn ra chính nó); lưới còn lại thì không.',
  }),
  { id: 'cf7', category: '🖼️ Suy luận hình', d: 3, q: 'Hình vẽ có tất cả bao nhiêu TAM GIÁC?',
    fig: figRow([iqSvg('<g class="so"><polygon points="30,6 54,50 6,50"/><path d="M18,28 L42,28 M18,28 L30,50 M42,28 L30,50"/></g>')], 'lg'),
    options: ['4', '5', '6', '8'], answer: 1,
    explain: 'Nối 3 trung điểm chia tam giác lớn thành 4 tam giác nhỏ; cộng chính tam giác lớn là 5. (Ghép 1 tam giác nhỏ với tam giác giữa chỉ ra hình thang, không phải tam giác.)' },
  { id: 'nm8', category: '🖼️ Suy luận hình', d: 3, q: 'Số ở ô dấu ? là bao nhiêu?',
    fig: figGrid([numCell(3), numCell(2), numCell(7), numCell(5), numCell(4), numCell(21), numCell(6), numCell(10), '?']),
    options: ['16', '26', '30', '36'], answer: 1,
    explain: 'Cột 3 = cột 1² − cột 2. Hàng cuối: 6² − 10 = 36 − 10 = 26.' },
  { id: 'dl25', category: '🧠 Logic', d: 3, q: '4 người qua cầu ban đêm, chung 1 đèn pin, mỗi lượt tối đa 2 người và đi theo người CHẬM hơn. Thời gian lần lượt 1, 2, 5, 10 phút. Nhanh nhất bao lâu?', options: ['15 phút', '17 phút', '19 phút', '21 phút'], answer: 1,
    explain: 'Mẹo: cho 2 người CHẬM đi cùng nhau. 1+2 sang (2), 1 quay lại (1), 5+10 sang (10), 2 quay lại (2), 1+2 sang (2) ⇒ 17 phút.' },
  { id: 'dl26', category: '🧠 Logic', d: 3, q: 'Có 20 viên kẹo, hai người lần lượt bốc 1–3 viên, ai bốc viên CUỐI thì thắng. Người đi trước nên bốc mấy viên để chắc thắng?', options: ['1 viên', '2 viên', '3 viên', 'Đi trước luôn thua'], answer: 2,
    explain: 'Luôn để lại BỘI SỐ CỦA 4 cho đối thủ: bốc 3 còn 16, sau đó đối thủ bốc k thì mình bốc 4 − k ⇒ mình luôn lấy viên thứ 20.' },
  { id: 'dl27', category: '🧠 Logic', d: 2, q: 'Chia 100 thành hai phần sao cho phần lớn gấp 4 lần phần nhỏ. Phần nhỏ bằng bao nhiêu?', options: ['15', '20', '25', '30'], answer: 1,
    explain: 'x + 4x = 100 ⇒ 5x = 100 ⇒ x = 20 (phần lớn là 80).' },
  { id: 'sq3-4', category: '➗ Toán nhanh', d: 2, q: 'Một API trả về trong 250ms. Muốn phục vụ 200 request/giây thì cần chạy song song ít nhất bao nhiêu luồng?', options: ['25 luồng', '40 luồng', '50 luồng', '80 luồng'], answer: 2,
    explain: 'Mỗi luồng làm 1000/250 = 4 request/giây ⇒ cần 200 / 4 = 50 luồng (định luật Little).' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #3 =====
  gOpQ('gx12', 3, '110/111/010', '011/110/011', 'and', 'Giao hai lưới: chỉ ô nào CẢ HAI cùng tô mới được giữ lại.'),
  figQ({
    id: 'mx11', d: 2, q: 'Ô dấu ? trong ma trận là hình nào?',
    fig: figGrid([
      sCell('h', 0), sCell('h', 1), sCell('h', 2),
      sCell('h', 1), sCell('h', 2), sCell('h', 0),
      sCell('h', 2), sCell('h', 0), '?']),
    opts: [sCell('h', 1), sCell('h', 0), sCell('h', 2), sCell('d', 1)],
    explain: 'Mỗi hàng và mỗi cột đều có đủ 3 kiểu tô (rỗng · chấm giữa · tô đặc), không lặp ⇒ ô cuối là lục giác có chấm giữa.',
  }),
  figQ({
    id: 'rt10', d: 2, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([gSvg('100/100/000'), gSvg('010/010/000'), gSvg('001/001/000'), '?']),
    opts: [gSvg('100/100/000'), gSvg('000/000/001'), gSvg('011/011/000'), gSvg('000/100/100')],
    explain: 'Cột được tô chạy dần sang phải; hết cột cuối thì QUAY VÒNG về cột đầu tiên.',
  }),
  figQ({
    id: 'sq7', d: 1, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([iqSvg(dots(9)), iqSvg(dots(7)), iqSvg(dots(5)), '?']),
    opts: [iqSvg(dots(3)), iqSvg(dots(4)), iqSvg(dots(2)), iqSvg(dots(6))],
    explain: 'Số chấm giảm đều 2 mỗi bước: 9 → 7 → 5 → 3.',
  }),
  figQ({
    id: 'od9', d: 2, q: 'Hình nào KHÁC NHÓM?',
    opts: [gSvg('110/010/000'), gSvg('111/000/000'), gSvg('010/010/010'), gSvg('100/010/001')],
    explain: 'Ba lưới kia đều có 3 ô THẲNG HÀNG (ngang, dọc, chéo); lưới còn lại 3 ô gấp khúc thành chữ L.',
  }),
  { id: 'cf8', category: '🖼️ Suy luận hình', d: 3, q: 'Hình vẽ có tất cả bao nhiêu HÌNH VUÔNG?',
    fig: figRow([iqSvg('<g class="so"><rect x="3" y="14" width="54" height="36"/><path d="M21 14 L21 50 M39 14 L39 50 M3 32 L57 32"/></g>')], 'lg'),
    options: ['6', '7', '8', '9'], answer: 2,
    explain: 'Lưới 2×3 ô vuông nhỏ: 6 hình vuông cạnh 1 + 2 hình vuông cạnh 2 = 8.' },
  { id: 'nm9', category: '🖼️ Suy luận hình', d: 3, q: 'Số ở ô dấu ? là bao nhiêu?',
    fig: figGrid([numCell(3), numCell(4), numCell(11), numCell(5), numCell(2), numCell(9), numCell(6), numCell(3), '?']),
    options: ['9', '15', '17', '18'], answer: 2,
    explain: 'Cột 3 = cột 1 × cột 2 − 1. Hàng cuối: 6 × 3 − 1 = 17.' },
  { id: 'dl28', category: '🧠 Logic', d: 3, q: 'Cha 40 tuổi, con 10 tuổi. Bao nhiêu năm nữa tuổi cha gấp ĐÔI tuổi con?', options: ['10 năm', '15 năm', '20 năm', '30 năm'], answer: 2,
    explain: '40 + x = 2(10 + x) ⇒ 40 + x = 20 + 2x ⇒ x = 20 (lúc đó 60 và 30).' },
  { id: 'dl29', category: '🧠 Logic', d: 3, q: 'Có 25 con ngựa, đường đua chỉ 5 làn, không có đồng hồ. Cần ÍT NHẤT bao nhiêu lượt đua để tìm ra 3 con nhanh nhất?', options: ['6 lượt', '7 lượt', '8 lượt', '10 lượt'], answer: 1,
    explain: '5 lượt chia 5 nhóm, 1 lượt đua các con nhất nhóm, rồi 1 lượt cuối cho 5 ứng viên còn khả năng ⇒ 7 lượt.' },
  { id: 'dl30', category: '🧠 Logic', d: 2, q: 'Một cửa hàng giảm 20%, sau đó giảm tiếp 25% trên giá đã giảm. Tổng cộng giảm bao nhiêu phần trăm so với giá gốc?', options: ['40%', '45%', '50%', '55%'], answer: 0,
    explain: '0,8 × 0,75 = 0,6 ⇒ còn 60% giá gốc, tức giảm tổng cộng 40% (không phải cộng 20 + 25).' },
  { id: 'sq3-5', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 2, 3, 5, 9, 17, ?', options: ['25', '31', '33', '34'], answer: 2,
    explain: 'Quy luật × 2 − 1: 17 × 2 − 1 = 33.' },
  { id: 'sq3-6', category: '🎲 Xác suất', d: 2, q: 'Tung hai xúc xắc 6 mặt. Xác suất TỔNG bằng 7 là bao nhiêu?', options: ['1/12', '1/9', '1/6', '1/4'], answer: 2,
    explain: 'Có 6 cặp cho tổng 7 (1-6, 2-5, 3-4 và hoán vị) trên 36 khả năng ⇒ 6/36 = 1/6 — tổng hay gặp nhất.' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #4 =====
  gOpQ('gx13', 3, '011/101/110', '110/011/101', 'xor', 'XOR: ô hai lưới cùng tô thì mất, ô chỉ một bên tô thì giữ.'),
  figQ({
    id: 'mx12', d: 3, q: 'Ô dấu ? trong ma trận là hình nào? (cột 2 = cột 1 soi gương, cột 3 = cột 1 xoay 180°)',
    fig: figGrid([
      gSvg('110/100/000'), gSvg(gFlip('110/100/000')), gSvg(gRot(gRot('110/100/000'))),
      gSvg('100/110/010'), gSvg(gFlip('100/110/010')), gSvg(gRot(gRot('100/110/010'))),
      gSvg('111/010/100'), gSvg(gFlip('111/010/100')), '?']),
    opts: [gSvg(gRot(gRot('111/010/100'))), gSvg(gFlip('111/010/100')),
      gSvg(gRot('111/010/100')), gSvg('111/010/100')],
    explain: 'Xoay 180° = lật trên↔dưới rồi lật trái↔phải: 111/010/100 thành 001/010/111.',
  }),
  figQ({
    id: 'rt11', d: 2, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([sCell('s', 0), sCell('s', 1), sCell('s', 2), sCell('t', 0), '?']),
    opts: [sCell('t', 1), sCell('t', 2), sCell('t', 0), sCell('c', 1)],
    explain: 'Kiểu tô lặp theo chu kỳ rỗng → chấm → đặc; hình đổi sang tam giác từ ô thứ 4 nên ô thứ 5 là tam giác có chấm.',
  }),
  figQ({
    id: 'sq8', d: 3, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([gSvg('100/000/000'), gSvg('110/100/000'), gSvg('111/110/000'), '?']),
    opts: [gSvg('111/111/100'), gSvg('111/111/000'), gSvg('111/111/110'), gSvg('111/111/111')],
    explain: 'Số ô được tô là dãy số LẺ 1 → 3 → 5 → 7 (tô theo thứ tự đọc).',
  }),
  figQ({
    id: 'mr6', d: 3, q: 'Lật hình bên dưới theo trục DỌC rồi xoay tiếp 90° thuận chiều kim đồng hồ được hình nào?',
    fig: figRow([gSvg('110/010/001')]),
    opts: [gSvg(gRot(gFlip('110/010/001'))), gSvg(gFlip('110/010/001')),
      gSvg(gRot('110/010/001')), gSvg(gRot(gRot('110/010/001')))],
    explain: 'Làm hai bước theo đúng thứ tự: lật gương trái↔phải trước, rồi mới xoay 90° hình vừa lật.',
  }),
  figQ({
    id: 'od10', d: 2, q: 'Hình nào KHÁC NHÓM?',
    opts: [gSvg('110/010/001'), gSvg('100/010/001'), gSvg('001/010/100'), gSvg('010/100/001')],
    explain: 'Ba lưới kia có ĐÚNG 1 ô tô ở mỗi hàng; lưới còn lại có một hàng 2 ô và một hàng trống.',
  }),
  { id: 'cf9', category: '🖼️ Suy luận hình', d: 3, q: 'Lưới 4×4 ô vuông nhỏ có tất cả bao nhiêu HÌNH VUÔNG?',
    fig: figRow([iqSvg('<g class="so"><rect x="6" y="6" width="48" height="48"/><path d="M18 6 L18 54 M30 6 L30 54 M42 6 L42 54 M6 18 L54 18 M6 30 L54 30 M6 42 L54 42"/></g>')], 'lg'),
    options: ['16', '20', '25', '30'], answer: 3,
    explain: '16 vuông cạnh 1 + 9 cạnh 2 + 4 cạnh 3 + 1 cạnh 4 = 30 (tổng các số chính phương 1..16).' },
  { id: 'nm10', category: '🖼️ Suy luận hình', d: 3, q: 'Số ở ô dấu ? là bao nhiêu?',
    fig: figGrid([numCell(1), numCell(2), numCell(9), numCell(2), numCell(3), numCell(25), numCell(3), numCell(4), '?']),
    options: ['28', '35', '49', '64'], answer: 2,
    explain: 'Cột 3 = (cột 1 + cột 2)². Hàng cuối: (3 + 4)² = 49.' },
  { id: 'dl31', category: '🎲 Xác suất', d: 3, q: 'Hộp có 3 bi đỏ và 2 bi xanh. Rút 2 bi KHÔNG hoàn lại, xác suất cả hai đều đỏ?', options: ['3/10', '9/25', '2/5', '1/2'], answer: 0,
    explain: '(3/5) × (2/4) = 6/20 = 3/10. Nếu có hoàn lại thì mới là (3/5)² = 9/25.' },
  { id: 'dl32', category: '🧠 Logic', d: 3, q: 'Trong 12 giờ, kim giờ và kim phút trùng nhau bao nhiêu lần?', options: ['10 lần', '11 lần', '12 lần', '13 lần'], answer: 1,
    explain: 'Kim phút chạy nhanh hơn kim giờ đúng 11 vòng trong 12 giờ ⇒ đuổi kịp 11 lần (khoảng 65,45 phút một lần), không phải 12.' },
  { id: 'dl33', category: '➗ Toán nhanh', d: 2, q: 'Cache hit 90% mất 1ms, miss 10% mất 100ms. Thời gian truy cập TRUNG BÌNH là bao nhiêu?', options: ['1,9ms', '10,9ms', '50,5ms', '90,1ms'], answer: 1,
    explain: '0,9 × 1 + 0,1 × 100 = 0,9 + 10 = 10,9ms — 10% miss đã kéo trung bình lên gấp 10 lần.' },
  { id: 'sq4-1', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 0, 1, 1, 2, 4, 7, 13, ?', options: ['20', '22', '24', '26'], answer: 2,
    explain: 'Mỗi số bằng TỔNG BA số trước (Tribonacci): 4 + 7 + 13 = 24.' },
  { id: 'sq4-2', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 64, 32, 16, 8, ?', options: ['2', '4', '6', '0'], answer: 1,
    explain: 'Mỗi số bằng một nửa số trước: 8 / 2 = 4.' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #5 =====
  gOpQ('gx14', 2, '101/000/010', '010/101/000', 'or', 'Hợp hai lưới: gộp tất cả ô được tô của cả hai hình.'),
  figQ({
    id: 'mx13', d: 3, q: 'Ô dấu ? trong ma trận là hình nào? (tổng số chấm mỗi HÀNG đều bằng nhau)',
    fig: figGrid([iqSvg(dots(1)), iqSvg(dots(3)), iqSvg(dots(5)), iqSvg(dots(4)), iqSvg(dots(4)), iqSvg(dots(1)), iqSvg(dots(2)), iqSvg(dots(3)), '?']),
    opts: [iqSvg(dots(4)), iqSvg(dots(5)), iqSvg(dots(3)), iqSvg(dots(6))],
    explain: 'Hai hàng đầu đều có tổng 9 chấm (1+3+5 và 4+4+1) ⇒ hàng cuối cần 9 − 2 − 3 = 4 chấm.',
  }),
  figQ({
    id: 'rt12', d: 3, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([gSvg('100/000/001'), gSvg('010/000/010'), gSvg('001/000/100'), '?']),
    opts: [gSvg('100/000/001'), gSvg('010/000/010'), gSvg('000/010/000'), gSvg('101/000/101')],
    explain: 'Chấm hàng trên chạy sang PHẢI, chấm hàng dưới chạy sang TRÁI; đi hết mép thì quay vòng về đầu.',
  }),
  figQ({
    id: 'sq9', d: 2, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([iqSvg(polyShape(3)), iqSvg(polyShape(3)), iqSvg(polyShape(4)), iqSvg(polyShape(4)), iqSvg(polyShape(5)), '?']),
    opts: [iqSvg(polyShape(5)), iqSvg(polyShape(6)), iqSvg(polyShape(4)), iqSvg(polyShape(7))],
    explain: 'Mỗi số cạnh xuất hiện ĐÚNG HAI LẦN rồi mới tăng: 3, 3, 4, 4, 5, 5.',
  }),
  figQ({
    id: 'od11', d: 3, q: 'Hình nào KHÁC NHÓM?',
    opts: [gSvg('101/000/101'), gSvg('110/110/000'), gSvg('011/011/000'), gSvg('000/110/110')],
    explain: 'Ba lưới kia có 4 ô dính nhau thành khối VUÔNG 2×2; lưới còn lại là 4 ô rời rạc ở bốn góc.',
  }),
  { id: 'cf10', category: '🖼️ Suy luận hình', d: 3, q: 'Đi theo các cạnh của lưới 2×2 từ góc TRÁI–TRÊN xuống góc PHẢI–DƯỚI, chỉ được đi sang phải hoặc xuống dưới. Có bao nhiêu đường đi?',
    fig: figRow([iqSvg('<g class="so"><rect x="10" y="10" width="40" height="40"/><path d="M30 10 L30 50 M10 30 L50 30"/></g><circle class="sf" cx="10" cy="10" r="4"/><circle class="sf" cx="50" cy="50" r="4"/>')], 'lg'),
    options: ['4', '6', '8', '9'], answer: 1,
    explain: 'Mỗi đường gồm đúng 2 bước phải và 2 bước xuống, khác nhau ở THỨ TỰ ⇒ C(4,2) = 6 đường.' },
  { id: 'nm11', category: '🖼️ Suy luận hình', d: 3, q: 'Số ở ô dấu ? là bao nhiêu?',
    fig: figGrid([numCell(3), numCell(1), numCell(10), numCell(4), numCell(2), numCell(18), numCell(5), numCell(3), '?']),
    options: ['22', '25', '28', '30'], answer: 2,
    explain: 'Cột 3 = cột 1² + cột 2. Hàng cuối: 5² + 3 = 28.' },
  { id: 'dl34', category: '🧠 Logic', d: 2, q: 'Trong nhóm 5 người, mỗi người bắt tay đúng 2 người khác. Có tất cả bao nhiêu cái bắt tay?', options: ['5', '7', '10', '20'], answer: 0,
    explain: 'Mỗi cái bắt tay được đếm 2 lần (một lần cho mỗi người) ⇒ 5 × 2 / 2 = 5.' },
  { id: 'dl35', category: '⏱️ Chuyển động & công việc', d: 3, q: 'Tàu dài 200m chạy 20 m/s qua một đường hầm dài 300m. Mất bao lâu để tàu ra khỏi hầm hoàn toàn?', options: ['15 giây', '20 giây', '25 giây', '30 giây'], answer: 2,
    explain: 'Tàu phải đi hết chiều dài hầm CỘNG chiều dài chính nó: (300 + 200) / 20 = 25 giây.' },
  { id: 'dl36', category: '➗ Toán nhanh', d: 1, q: 'Một phần ba của một số là 12. Vậy ba phần tư của số đó là bao nhiêu?', options: ['9', '18', '24', '27'], answer: 3,
    explain: 'Số đó là 12 × 3 = 36; 3/4 của 36 = 27.' },
  { id: 'sq5-1', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 1, 11, 21, 1211, 111221, ?', options: ['122112', '312211', '1112221', '211231'], answer: 1,
    explain: 'Dãy "đọc số" (look-and-say): mỗi số MÔ TẢ số trước. 111221 đọc là "ba số 1, hai số 2, một số 1" ⇒ 312211.' },
  { id: 'sq5-2', category: '🔀 Mã hoá', d: 2, q: 'Nếu CODE được mã hoá là 3-15-4-5 thì BAT là gì?', options: ['2-1-20', '2-1-19', '3-1-20', '2-2-20'], answer: 0,
    explain: 'Mỗi chữ cái đổi thành THỨ TỰ trong bảng chữ cái: B = 2, A = 1, T = 20.' },

  // =========================================================================
  // 🔢 ĐOÁN SỐ — bộ quy luật ĐA DẠNG (nhân/chia biến thiên, đan xen hai dãy,
  // phép luân phiên, theo chữ số, dãy hình học đặc biệt, tìm số Ở GIỮA,
  // số lạc quy luật, tương tự SỐ, kim tự tháp số)
  // =========================================================================
  // ---- Nhân/cộng có hệ số ----
  { id: 'n6-2', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 5, 8, 14, 26, ?', options: ['38', '44', '50', '52'], answer: 2,
    explain: 'Quy luật × 2 − 2: 26 × 2 − 2 = 50.' },
  // ---- Bước nhảy thay đổi ----
  { id: 'n6-6', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 1, 3, 7, 13, 21, ?', options: ['29', '30', '31', '33'], answer: 2,
    explain: 'Khoảng cách tăng đều 2, 4, 6, 8, 10 ⇒ 21 + 10 = 31.' },
  { id: 'n6-7', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 100, 98, 94, 88, 80, ?', options: ['68', '70', '72', '74'], answer: 1,
    explain: 'Trừ dần 2, 4, 6, 8, 10 ⇒ 80 − 10 = 70.' },
  // ---- Theo công thức của n ----
  { id: 'n6-11', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 0, 3, 8, 15, 24, ?', options: ['33', '34', '35', '36'], answer: 2,
    explain: 'Quy luật n² − 1: 6² − 1 = 35.' },
  { id: 'n6-12', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 2, 10, 30, 68, ?', options: ['110', '124', '130', '136'], answer: 2,
    explain: 'Quy luật n³ + n: 5³ + 5 = 130.' },
  { id: 'n6-13', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 6, 12, 20, 30, 42, ?', options: ['52', '54', '56', '58'], answer: 2,
    explain: 'Tích hai số liên tiếp n(n+1): 2·3, 3·4, 4·5, 5·6, 6·7, 7·8 = 56.' },
  { id: 'n6-14', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 1, 5, 14, 30, 55, ?', options: ['80', '85', '91', '96'], answer: 2,
    explain: 'Tổng các bình phương: 55 + 6² = 91.' },
  { id: 'n6-15', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 1, 5, 12, 22, 35, ?', options: ['47', '49', '51', '53'], answer: 2,
    explain: 'Số ngũ giác — khoảng cách tăng 4, 7, 10, 13, 16 ⇒ 35 + 16 = 51.' },
  { id: 'n6-16', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 2, 8, 26, 80, ?', options: ['160', '212', '242', '244'], answer: 2,
    explain: 'Quy luật 3ⁿ − 1: 3⁵ − 1 = 243 − 1 = 242 (cũng là × 3 + 2 mỗi bước).' },
  // ---- Cộng dồn kiểu Fibonacci ----
  { id: 'n6-17', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 2, 2, 4, 6, 10, 16, ?', options: ['22', '24', '26', '32'], answer: 2,
    explain: 'Mỗi số bằng tổng hai số trước: 10 + 16 = 26.' },
  // ---- Hai dãy đan xen ----
  { id: 'n6-19', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 2, 9, 4, 12, 6, 15, 8, ?', options: ['10', '16', '18', '20'], answer: 2,
    explain: 'Hai dãy ĐAN XEN: vị trí lẻ 2, 4, 6, 8 (+2); vị trí chẵn 9, 12, 15, ? (+3) ⇒ 18.' },
  { id: 'n6-20', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 1, 10, 2, 20, 3, 30, 4, ?', options: ['5', '31', '40', '50'], answer: 2,
    explain: 'Đan xen dãy đếm 1, 2, 3, 4 với dãy 10, 20, 30, 40 ⇒ số tiếp theo là 40.' },
  { id: 'n6-21', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 3, 4, 6, 8, 12, 16, 24, ?', options: ['28', '30', '32', '36'], answer: 2,
    explain: 'Đan xen hai dãy nhân đôi: 3, 6, 12, 24 và 4, 8, 16, ? ⇒ 32.' },
  // ---- Phép toán luân phiên ----
  { id: 'n6-22', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 2, 4, 6, 12, 14, 28, ?', options: ['30', '32', '42', '56'], answer: 0,
    explain: 'Luân phiên × 2 rồi + 2: sau bước × 2 (14 → 28) là bước + 2 ⇒ 30.' },
  { id: 'n6-23', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 5, 8, 16, 19, 38, 41, ?', options: ['44', '61', '82', '84'], answer: 2,
    explain: 'Luân phiên + 3 rồi × 2: sau bước + 3 (38 → 41) là bước × 2 ⇒ 82.' },
  // ---- Theo CHỮ SỐ ----
  { id: 'n6-24', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 12, 15, 21, 24, 30, ?', options: ['31', '33', '36', '40'], answer: 1,
    explain: 'Mỗi số cộng thêm TỔNG CÁC CHỮ SỐ của chính nó: 30 + (3 + 0) = 33.' },
  { id: 'n6-25', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 12, 21, 34, 43, 56, ?', options: ['57', '61', '65', '78'], answer: 2,
    explain: 'Cứ một số rồi tới số ĐẢO NGƯỢC chữ số của nó: 56 ⇒ 65.' },
  { id: 'n6-26', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 23, 6, 34, 12, 45, ?', options: ['9', '15', '20', '54'], answer: 2,
    explain: 'Sau mỗi số là TÍCH hai chữ số của nó: 2×3 = 6, 3×4 = 12, 4×5 = 20.' },
  // ---- Số đặc biệt ----
  { id: 'n6-27', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 11, 13, 17, 19, 23, ?', options: ['25', '27', '29', '31'], answer: 2,
    explain: 'Dãy số NGUYÊN TỐ liên tiếp; sau 23 là 29 (25 = 5×5, 27 = 3³ đều không phải nguyên tố).' },
  { id: 'n6-28', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 7, 12, 5, 10, 3, 8, ?', options: ['1', '2', '13', '15'], answer: 0,
    explain: 'Cộng 5 theo kiểu MẶT ĐỒNG HỒ 12 giờ: 8 + 5 = 13 → quay về 1.' },
  { id: 'n6-29', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 5, 1, −3, −7, ?', options: ['−9', '−10', '−11', '−12'], answer: 2,
    explain: 'Trừ đều 4 mỗi bước, đi qua cả số âm: −7 − 4 = −11.' },
  { id: 'n6-30', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 0,5 · 1,5 · 4,5 · 13,5 · ?', options: ['27', '36', '40,5', '54'], answer: 2,
    explain: 'Nhân 3 mỗi bước: 13,5 × 3 = 40,5.' },
  { id: 'n6-31', category: '🔢 Dãy số', d: 2, q: 'Phân số tiếp theo: 1/2, 1/4, 1/8, ?', options: ['1/10', '1/12', '1/16', '2/16'], answer: 2,
    explain: 'Mẫu số nhân đôi mỗi bước (mỗi số bằng một nửa số trước): 1/8 ÷ 2 = 1/16.' },
  // ---- Tìm số Ở GIỮA (không phải số cuối) ----
  { id: 'n6-32', category: '🔢 Dãy số', d: 2, q: 'Số nào thay cho dấu ?: 3, 9, ?, 81, 243', options: ['18', '24', '27', '36'], answer: 2,
    explain: 'Dãy nhân 3: 3, 9, 27, 81, 243 ⇒ chỗ trống là 27.' },
  { id: 'n6-33', category: '🔢 Dãy số', d: 3, q: 'Số nào thay cho dấu ?: 2, 5, ?, 17, 26', options: ['8', '10', '11', '12'], answer: 1,
    explain: 'Dãy n² + 1: 2, 5, 10, 17, 26 ⇒ chỗ trống là 10.' },
  { id: 'n6-34', category: '🔢 Dãy số', d: 3, q: 'Số nào thay cho dấu ?: 4, ?, 16, 32, 64', options: ['6', '8', '10', '12'], answer: 1,
    explain: 'Dãy nhân đôi: mỗi số gấp đôi số trước ⇒ chỗ trống là 8.' },
  // ---- Số LẠC quy luật ----
  { id: 'n6-35', category: '❌ Khác loại', d: 2, q: 'Số nào KHÔNG cùng quy luật: 8, 27, 64, 100, 125', options: ['8', '27', '100', '125'], answer: 2,
    explain: 'Các số kia là lập phương (2³, 3³, 4³, 5³); 100 là bình phương chứ không phải lập phương.' },
  { id: 'n6-36', category: '❌ Khác loại', d: 2, q: 'Số nào KHÔNG cùng quy luật: 3, 5, 7, 9, 11', options: ['3', '7', '9', '11'], answer: 2,
    explain: 'Các số kia đều là số nguyên tố; 9 = 3 × 3 thì không.' },
  { id: 'n6-37', category: '❌ Khác loại', d: 3, q: 'Số nào KHÔNG cùng quy luật: 16, 25, 36, 49, 60', options: ['16', '36', '49', '60'], answer: 3,
    explain: 'Các số kia là số chính phương (4², 5², 6², 7²); 60 thì không.' },
  // ---- Tương tự SỐ (không phải chữ) ----
  { id: 'n6-38', category: '🔢 Dãy số', d: 2, q: 'Nếu 6 → 42 và 7 → 56 thì 8 → ?', options: ['64', '70', '72', '80'], answer: 2,
    explain: 'Quy luật n × (n + 1): 8 × 9 = 72.' },
  { id: 'n6-39', category: '🔢 Dãy số', d: 3, q: 'Nếu 3 → 10 và 5 → 26 thì 7 → ?', options: ['36', '42', '50', '52'], answer: 2,
    explain: 'Quy luật n² + 1: 7² + 1 = 50.' },
  { id: 'n6-40', category: '🔢 Dãy số', d: 3, q: 'Nếu 2 → 6, 3 → 12 và 4 → 20 thì 6 → ?', options: ['30', '36', '42', '48'], answer: 2,
    explain: 'Quy luật n² + n = n(n+1): 6 × 7 = 42.' },
  // ---- Kim tự tháp số (nhìn hình) ----
  { id: 'n6-41', category: '🖼️ Suy luận hình', d: 2, q: 'Mỗi ô bằng TỔNG hai ô ngay dưới nó. Số ở ô dấu ? là bao nhiêu?',
    fig: figRow(['?']) + figRow([numCell(3), numCell(5)]) + figRow([numCell(1), numCell(2), numCell(3)]),
    options: ['6', '8', '9', '15'], answer: 1,
    explain: 'Tầng giữa: 1 + 2 = 3 và 2 + 3 = 5; đỉnh tháp = 3 + 5 = 8.' },
  { id: 'n6-42', category: '🖼️ Suy luận hình', d: 3, q: 'Mỗi ô bằng TỔNG hai ô ngay dưới nó. Số ở ô dấu ? là bao nhiêu?',
    fig: figRow([numCell(20)]) + figRow([numCell(8), '?']) + figRow([numCell(5), numCell(3), numCell(9)]),
    options: ['11', '12', '14', '17'], answer: 1,
    explain: 'Ô phải tầng giữa = 3 + 9 = 12 (kiểm tra: 8 + 12 = 20 đúng bằng đỉnh).' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #6 =====
  gOpQ('gx15', 3, '111/010/111', '110/011/101', 'and', 'Chỉ giữ ô mà CẢ HAI lưới cùng tô — phần còn lại bỏ trống.'),
  figQ({
    id: 'mx14', d: 3, q: 'Ô dấu ? trong ma trận là hình nào? (số chấm cột 3 = cột 1 − cột 2)',
    fig: figGrid([iqSvg(dots(7)), iqSvg(dots(3)), iqSvg(dots(4)), iqSvg(dots(9)), iqSvg(dots(4)), iqSvg(dots(5)), iqSvg(dots(8)), iqSvg(dots(2)), '?']),
    opts: [iqSvg(dots(6)), iqSvg(dots(5)), iqSvg(dots(4)), iqSvg(dots(9))],
    explain: 'Cột 3 = số chấm cột 1 trừ cột 2: hàng cuối 8 − 2 = 6 chấm.',
  }),
  figQ({
    id: 'rt13', d: 2, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([gSvg('111/111/111'), gSvg('011/111/111'), gSvg('011/111/110'), '?']),
    opts: [gSvg('010/111/110'), gSvg('011/111/010'), gSvg('001/111/110'), gSvg('011/011/110')],
    explain: 'Mỗi bước XOÁ thêm một ô ở góc theo chiều kim đồng hồ: trên-trái → dưới-phải → dưới-trái.',
  }),
  figQ({
    id: 'od12', d: 2, q: 'Hình nào KHÁC NHÓM?',
    opts: [gSvg('110/010/000'), gSvg('110/000/000'), gSvg('110/011/000'), gSvg('111/110/010')],
    explain: 'Ba lưới kia tô số ô CHẴN (2, 4, 6); lưới còn lại tô 3 ô — số lẻ.',
  }),
  { id: 'cf11', category: '🖼️ Suy luận hình', d: 3, q: 'Lưới 3×3 ô vuông nhỏ có tất cả bao nhiêu HÌNH CHỮ NHẬT (tính cả hình vuông)?',
    fig: figRow([iqSvg('<g class="so"><rect x="6" y="6" width="48" height="48"/><path d="M22 6 L22 54 M38 6 L38 54 M6 22 L54 22 M6 38 L54 38"/></g>')], 'lg'),
    options: ['14', '24', '30', '36'], answer: 3,
    explain: 'Chọn 2 trong 4 đường dọc và 2 trong 4 đường ngang: C(4,2) × C(4,2) = 6 × 6 = 36.' },
  { id: 'nm12', category: '🖼️ Suy luận hình', d: 3, q: 'Số ở ô dấu ? là bao nhiêu?',
    fig: figGrid([numCell(2), numCell(3), numCell(8), numCell(3), numCell(4), numCell(15), numCell(4), numCell(5), '?']),
    options: ['20', '21', '24', '25'], answer: 2,
    explain: 'Cột 3 = cột 1 × (cột 2 + 1). Hàng cuối: 4 × 6 = 24.' },
  { id: 'dl37', category: '🧠 Logic', d: 2, q: 'Hôm nay là thứ Ba. Ngày thứ 45 kể từ hôm nay là thứ mấy?', options: ['Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'], answer: 1,
    explain: '45 chia 7 dư 3 ⇒ đếm thêm 3 ngày từ thứ Ba: Tư, Năm, Sáu.' },
  { id: 'dl38', category: '➗ Toán nhanh', d: 3, q: 'Bán 2 món cùng giá 120k: món A lãi 20%, món B lỗ 20% (so với giá vốn). Tổng cộng lãi hay lỗ?', options: ['Hoà vốn', 'Lãi 10k', 'Lỗ 10k', 'Lỗ 20k'], answer: 2,
    explain: 'Giá vốn A = 120/1,2 = 100k; giá vốn B = 120/0,8 = 150k. Tổng vốn 250k, thu về 240k ⇒ LỖ 10k (bẫy "lãi lỗ bù nhau").' },
  { id: 'dl39', category: '🎲 Xác suất', d: 2, q: 'Tung đồng xu 3 lần. Xác suất có ÍT NHẤT một mặt ngửa là bao nhiêu?', options: ['1/2', '5/8', '3/4', '7/8'], answer: 3,
    explain: 'Lấy 1 trừ trường hợp không có ngửa nào: 1 − (1/2)³ = 1 − 1/8 = 7/8.' },
  { id: 'n7-1', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 9, 7, 8, 6, 7, 5, ?', options: ['3', '4', '6', '8'], answer: 2,
    explain: 'Luân phiên − 2 rồi + 1: sau bước − 2 (7 → 5) là bước + 1 ⇒ 6.' },
  { id: 'n7-2', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 144, 121, 100, 81, ?', options: ['49', '60', '64', '72'], answer: 2,
    explain: 'Bình phương giảm dần: 12², 11², 10², 9², 8² = 64.' },

  // ---- Bù cho các câu trùng đã gỡ: quy luật MỚI, không đụng dãy nào đang có ----
  { id: 'n8-1', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 6, 13, 27, 55, ?', options: ['82', '105', '110', '111'], answer: 3,
    explain: 'Quy luật × 2 + 1: 55 × 2 + 1 = 111.' },
  { id: 'n8-2', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 3, 6, 18, 72, ?', options: ['144', '216', '288', '360'], answer: 3,
    explain: 'Nhân lần lượt với 2, 3, 4 rồi 5: 72 × 5 = 360.' },
  { id: 'n8-3', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 7, 9, 13, 21, 37, ?', options: ['53', '61', '69', '74'], answer: 2,
    explain: 'Khoảng cách nhân đôi mỗi bước: +2, +4, +8, +16, +32 ⇒ 37 + 32 = 69.' },
  { id: 'n8-4', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 11, 21, 41, 81, ?', options: ['121', '141', '161', '162'], answer: 2,
    explain: 'Quy luật × 2 − 1: 81 × 2 − 1 = 161.' },
  { id: 'n8-5', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 4, 5, 9, 14, 23, ?', options: ['32', '35', '37', '46'], answer: 2,
    explain: 'Mỗi số bằng tổng hai số liền trước: 14 + 23 = 37.' },
  { id: 'n8-6', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 720, 360, 120, 30, ?', options: ['5', '6', '10', '15'], answer: 1,
    explain: 'Chia lần lượt cho 2, 3, 4 rồi 5: 30 ÷ 5 = 6.' },
  { id: 'n8-7', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 1, 6, 15, 28, ?', options: ['40', '43', '45', '50'], answer: 2,
    explain: 'Số lục giác — khoảng cách tăng 5, 9, 13, 17 ⇒ 28 + 17 = 45.' },
  { id: 'n8-8', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 2, 7, 17, 37, ?', options: ['57', '67', '74', '77'], answer: 3,
    explain: 'Quy luật × 2 + 3: 37 × 2 + 3 = 77.' },
  { id: 'n8-9', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 8, 5, 9, 6, 10, 7, ?', options: ['4', '8', '11', '14'], answer: 2,
    explain: 'Luân phiên − 3 rồi + 4: sau bước − 3 (10 → 7) là bước + 4 ⇒ 11.' },
  { id: 'n8-10', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 100, 50, 52, 26, 28, ?', options: ['12', '14', '26', '30'], answer: 1,
    explain: 'Luân phiên ÷ 2 rồi + 2: sau bước + 2 (26 → 28) là bước ÷ 2 ⇒ 14.' },
  { id: 'n8-11', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 13, 26, 24, 48, 46, ?', options: ['44', '69', '92', '94'], answer: 2,
    explain: 'Luân phiên × 2 rồi − 2: sau bước − 2 (48 → 46) là bước × 2 ⇒ 92.' },
  { id: 'n8-12', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 1, 2, 4, 8, 16, 32, ?', options: ['48', '56', '64', '128'], answer: 2,
    explain: 'Luỹ thừa của 2 — mỗi số gấp đôi số trước: 32 × 2 = 64.' },
  { id: 'n8-13', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 3, 12, 27, 48, ?', options: ['60', '69', '75', '81'], answer: 2,
    explain: 'Quy luật 3n²: 3·1, 3·4, 3·9, 3·16, 3·25 = 75.' },
  { id: 'n8-14', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 10, 11, 13, 16, 20, 25, ?', options: ['29', '30', '31', '32'], answer: 2,
    explain: 'Khoảng cách tăng đều 1, 2, 3, 4, 5, 6 ⇒ 25 + 6 = 31.' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #7 =====
  gOpQ('gx16', 2, '100/111/001', '001/010/100', 'or', 'Hợp hai lưới: gộp mọi ô được tô của cả hai hình.'),
  gOpQ('gx17', 3, '011/110/011', '110/011/110', 'xor', 'XOR từng ô: giống nhau thì bỏ trống, khác nhau thì tô.'),
  figQ({
    id: 'mx15', d: 3, q: 'Ô dấu ? trong ma trận là hình nào? (số chấm cột 3 = cột 1 × cột 2)',
    fig: figGrid([iqSvg(dots(1)), iqSvg(dots(2)), iqSvg(dots(2)), iqSvg(dots(2)), iqSvg(dots(3)), iqSvg(dots(6)), iqSvg(dots(3)), iqSvg(dots(3)), '?']),
    opts: [iqSvg(dots(9)), iqSvg(dots(6)), iqSvg(dots(8)), iqSvg(dots(3))],
    explain: 'Cột 3 bằng TÍCH số chấm của hai cột đầu: hàng cuối 3 × 3 = 9 chấm.',
  }),
  figQ({
    id: 'rt14', d: 2, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([gSvg('111/000/000'), gSvg('000/111/000'), gSvg('000/000/111'), '?']),
    opts: [gSvg('111/000/000'), gSvg('000/111/000'), gSvg('111/111/111'), gSvg('000/000/000')],
    explain: 'Hàng được tô trượt xuống mỗi bước một hàng; xuống hết đáy thì QUAY VÒNG lên hàng đầu.',
  }),
  figQ({
    id: 'sq11', d: 2, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([sCell('c', 0), sCell('c', 2), sCell('s', 0), sCell('s', 2), sCell('t', 0), '?']),
    opts: [sCell('t', 2), sCell('t', 0), sCell('c', 2), sCell('d', 2)],
    explain: 'Mỗi hình xuất hiện đúng hai lần: một lần RỖNG rồi một lần TÔ ĐẶC ⇒ sau tam giác rỗng là tam giác đặc.',
  }),
  figQ({
    id: 'od13', d: 3, q: 'Hình nào KHÁC NHÓM?',
    opts: [gSvg('110/010/000'), gSvg('100/010/001'), gSvg('010/111/010'), gSvg('001/010/100')],
    explain: 'Ba lưới kia ĐỐI XỨNG TÂM (xoay 180° vẫn ra chính nó); lưới còn lại thì không.',
  }),
  { id: 'cf12', category: '🖼️ Suy luận hình', d: 2, q: 'Hình vẽ có tất cả bao nhiêu TAM GIÁC?',
    fig: figRow([iqSvg('<g class="so"><polygon points="30,6 54,52 6,52"/><path d="M18,36 L42,36 M12,44 L48,44"/></g>')], 'lg'),
    options: ['1', '2', '3', '4'], answer: 2,
    explain: 'Hai đường song song với đáy cắt ra 2 tam giác nhỏ đồng dạng, cộng tam giác lớn ban đầu = 3.' },
  { id: 'nm13', category: '🖼️ Suy luận hình', d: 3, q: 'Số ở ô dấu ? là bao nhiêu?',
    fig: figGrid([numCell(4), numCell(7), numCell(2), numCell(3), numCell(5), numCell(6), numCell(7), numCell(12), '?']),
    options: ['4', '8', '9', '12'], answer: 1,
    explain: 'Hàng 3 = hàng 1 + hàng 2 theo TỪNG CỘT (4+3=7, 7+5=12) ⇒ cột cuối 2 + 6 = 8.' },
  { id: 'dl40', category: '🧠 Logic', d: 3, q: 'Có 12 đồng xu, 1 đồng GIẢ (chưa biết nặng hay nhẹ hơn). Với cân thăng bằng, cần ít nhất mấy lần cân để tìm ra nó?', options: ['2 lần', '3 lần', '4 lần', '6 lần'], answer: 1,
    explain: 'Mỗi lần cân cho 3 kết quả ⇒ 3 lần phân biệt được tối đa 27 tình huống, đủ cho 24 khả năng (12 đồng × nặng/nhẹ). Chia 4-4-4 là cách kinh điển.' },
  { id: 'dl41', category: '🧠 Logic', d: 2, q: 'Cần ít nhất bao nhiêu người để CHẮC CHẮN có 2 người sinh cùng THÁNG?', options: ['12', '13', '24', '25'], answer: 1,
    explain: 'Nguyên lý chuồng bồ câu: 12 người có thể rơi vào 12 tháng khác nhau; người thứ 13 buộc phải trùng tháng với ai đó.' },
  { id: 'dl42', category: '🧠 Logic', d: 3, q: 'Có đồng hồ cát 4 phút và 7 phút. Đo chính xác 9 phút bằng cách nào?', options: ['Chạy cái 7 trước rồi cái 4, dừng lại lúc đang chảy dở', 'Chạy cả hai, phút 4 lật cái 4, phút 7 lật lại cái 4', 'Chạy cái 4 hai lượt liên tiếp rồi chạy tiếp cái 7', 'Không thể đo đúng 9 phút với hai đồng hồ này'], answer: 1,
    explain: 'Bắt đầu cả hai. Phút 4: lật cái 4. Phút 7: cái 4 đã chạy được 3, lật ngược nó ⇒ nó chạy thêm 3 phút nữa, tổng 7 + 2 = 9 phút.' },
  { id: 'dl43', category: '➗ Toán nhanh', d: 2, q: 'Tải file 2GB với băng thông thực 20MB/s (1GB = 1000MB) mất bao lâu?', options: ['40 giây', '100 giây', '200 giây', '400 giây'], answer: 1,
    explain: '2GB = 2000MB; 2000 / 20 = 100 giây.' },
  { id: 'n9-1', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 1, 121, 12321, ?', options: ['123321', '1232121', '1234321', '12343210'], answer: 2,
    explain: 'Bình phương của 1, 11, 111 ⇒ tiếp theo là 1111² = 1234321 (dãy số "kim tự tháp" đối xứng).' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #8 =====
  gOpQ('gx18', 3, '101/110/011', '011/011/110', 'and', 'Giao hai lưới: chỉ ô nào cả hai cùng tô mới giữ.'),
  figQ({
    id: 'mx16', d: 2, q: 'Ô dấu ? trong ma trận là hình nào? (cột 3 = cột 1 chồng lên cột 2)',
    fig: figGrid([
      gSvg('100/100/000'), gSvg('001/001/000'), gSvg(gOp('100/100/000', '001/001/000', 'or')),
      gSvg('110/000/000'), gSvg('000/000/011'), gSvg(gOp('110/000/000', '000/000/011', 'or')),
      gSvg('010/010/000'), gSvg('000/000/111'), '?']),
    opts: [gSvg(gOp('010/010/000', '000/000/111', 'or')), gSvg('010/010/110'),
      gSvg('000/000/111'), gSvg('111/010/010')],
    explain: 'Chồng hai lưới lên nhau (giữ tất cả ô được tô của cả hai) ⇒ cột dọc giữa cộng thêm cả hàng đáy.',
  }),
  figQ({
    id: 'rt15', d: 3, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([gSvg('110/000/000'), gSvg('011/000/000'), gSvg('000/110/000'), '?']),
    opts: [gSvg('000/011/000'), gSvg('000/000/110'), gSvg('110/000/000'), gSvg('000/110/000')],
    explain: 'Khối 2 ô trượt sang phải; hết hàng thì xuống hàng dưới bắt đầu lại từ trái.',
  }),
  figQ({
    id: 'sq12', d: 2, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([iqSvg(polyShape(4)), iqSvg(polyShape(6)), iqSvg(polyShape(8)), '?']),
    opts: [iqSvg(polyShape(10)), iqSvg(polyShape(9)), iqSvg(polyShape(7)), iqSvg(polyShape(12))],
    explain: 'Số cạnh tăng đều 2: 4 → 6 → 8 → 10 (đếm chấm ở đỉnh cho chắc).',
  }),
  figQ({
    id: 'od14', d: 2, q: 'Hình nào KHÁC NHÓM?',
    opts: [iqSvg(polyShape(4)), iqSvg(polyShape(3)), iqSvg(polyShape(6)), iqSvg(polyShape(9))],
    explain: 'Ba hình kia có số cạnh CHIA HẾT CHO 3 (3, 6, 9); hình vuông 4 cạnh thì không.',
  }),
  figQ({
    id: 'fold1', d: 3, q: 'Gấp đôi tờ giấy theo trục DỌC rồi đục các lỗ như hình. Mở tờ giấy ra sẽ được hình nào?',
    fig: figRow([gSvg('100/010/000')]),
    opts: [gSvg(gOp('100/010/000', gFlip('100/010/000'), 'or')), gSvg(gFlip('100/010/000')),
      gSvg('100/010/000'), gSvg(gInv('100/010/000'))],
    explain: 'Mở ra thì mỗi lỗ có thêm một lỗ ĐỐI XỨNG qua trục gấp ⇒ hình gốc chồng với ảnh gương của nó.',
  }),
  figQ({
    id: 'fold2', d: 3, q: 'Gấp đôi tờ giấy theo trục NGANG rồi đục các lỗ như hình. Mở tờ giấy ra sẽ được hình nào?',
    fig: figRow([gSvg('110/000/000')]),
    opts: [gSvg(gOp('110/000/000', gFlipV('110/000/000'), 'or')), gSvg(gFlipV('110/000/000')),
      gSvg('110/000/000'), gSvg(gFlip('110/000/000'))],
    explain: 'Trục gấp NGANG ⇒ mỗi lỗ được nhân đôi xuống hàng đối xứng bên dưới.',
  }),
  { id: 'nm14', category: '🖼️ Suy luận hình', d: 3, q: 'Số ở ô dấu ? là bao nhiêu?',
    fig: figGrid([numCell(3), numCell(2), numCell(8), numCell(5), numCell(1), numCell(11), numCell(4), numCell(6), '?']),
    options: ['10', '14', '18', '24'], answer: 1,
    explain: 'Cột 3 = cột 1 × 2 + cột 2. Hàng cuối: 4 × 2 + 6 = 14.' },
  { id: 'dl44', category: '🧠 Logic', d: 3, q: 'Một cuốn sách đánh số trang từ 1 đến 200. Cần in tất cả bao nhiêu CHỮ SỐ?', options: ['200', '392', '492', '600'], answer: 2,
    explain: 'Trang 1–9: 9 chữ số; 10–99: 90 × 2 = 180; 100–200: 101 × 3 = 303. Tổng 9 + 180 + 303 = 492.' },
  { id: 'dl45', category: '🧠 Logic', d: 2, q: 'Giải đấu loại trực tiếp 64 đội (thua là bị loại). Cần bao nhiêu trận để tìm ra nhà vô địch?', options: ['32', '63', '64', '127'], answer: 1,
    explain: 'Mỗi trận loại đúng 1 đội; phải loại 63 đội để còn 1 nhà vô địch ⇒ 63 trận.' },
  { id: 'dl46', category: '🧠 Logic', d: 2, q: 'Mọi service đều có log. Không hệ thống nào KHÔNG có log mà được lên production. Kết luận nào chắc chắn đúng?', options: ['Mọi service đều đã được lên production hết', 'Hệ thống không có log thì không lên production', 'Chỉ có service mới ghi log, thứ khác thì không', 'Không suy ra được kết luận chắc chắn nào'], answer: 1,
    explain: 'Phát biểu thứ hai chính là "không có log ⇒ không lên production" — đây là hệ quả trực tiếp, còn chiều ngược lại thì không suy ra được.' },
  { id: 'dl47', category: '➗ Toán nhanh', d: 3, q: 'Cam kết uptime 99,9% mỗi tháng (30 ngày). Thời gian được phép sập tối đa là bao nhiêu?', options: ['4,3 phút', '43 phút', '7,2 giờ', '3 giờ'], answer: 1,
    explain: '30 ngày = 43.200 phút; 0,1% của 43.200 = 43,2 phút (99,99% thì chỉ còn ~4,3 phút).' },
  { id: 'n10-1', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 2, 4, 5, 10, 11, 22, ?', options: ['23', '24', '33', '44'], answer: 0,
    explain: 'Luân phiên × 2 rồi + 1: sau bước × 2 (11 → 22) là bước + 1 ⇒ 23.' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #9 =====
  gOpQ('gx19', 2, '110/001/100', '001/110/010', 'or', 'Hợp hai lưới: giữ mọi ô được tô ở ít nhất một hình.'),
  figQ({
    id: 'fold3', d: 3, q: 'Gấp tờ giấy đôi theo trục DỌC rồi đôi tiếp theo trục NGANG, đục lỗ như hình. Mở hết ra được hình nào?',
    fig: figRow([gSvg('100/000/000')]),
    opts: [gSvg('101/000/101'), gSvg('101/000/000'), gSvg('100/000/100'), gSvg('111/000/111')],
    explain: 'Gấp 2 lần ⇒ lỗ được nhân 4 lần, đối xứng qua CẢ hai trục ⇒ 4 lỗ ở 4 góc.',
  }),
  figQ({
    id: 'mx17', d: 3, q: 'Ô dấu ? trong ma trận là hình nào? (hàng 3 = hàng 1 ⊕ hàng 2 theo từng cột)',
    fig: figGrid([
      gSvg('100/000/000'), gSvg('010/000/000'), gSvg('001/000/000'),
      gSvg('100/100/000'), gSvg('000/010/000'), gSvg('001/001/000'),
      gSvg(gOp('100/000/000', '100/100/000', 'xor')), gSvg(gOp('010/000/000', '000/010/000', 'xor')), '?']),
    opts: [gSvg(gOp('001/000/000', '001/001/000', 'xor')), gSvg('001/001/000'),
      gSvg('001/000/000'), gSvg('000/000/001')],
    explain: 'Mỗi CỘT: hình hàng 3 = hàng 1 XOR hàng 2 ⇒ ô trùng nhau triệt tiêu, chỉ còn ô lệch.',
  }),
  figQ({
    id: 'rt16', d: 2, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([gSvg('100/010/000'), gSvg('001/010/000'), gSvg('000/010/001'), '?']),
    opts: [gSvg('000/010/100'), gSvg('100/010/000'), gSvg('010/010/000'), gSvg('000/010/010')],
    explain: 'Ô giữa đứng yên, ô còn lại chạy quanh 4 góc theo chiều kim đồng hồ ⇒ tới góc dưới-trái.',
  }),
  figQ({
    id: 'sq13', d: 3, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([gSvg('110/000/000'), gSvg('111/000/000'), gSvg('111/110/000'), '?']),
    opts: [gSvg('111/111/100'), gSvg('111/111/110'), gSvg('111/110/100'), gSvg('111/111/000')],
    explain: 'Số ô được tô là dãy NGUYÊN TỐ: 2 → 3 → 5 → 7 ô (tô theo thứ tự đọc).',
  }),
  figQ({
    id: 'od15', d: 3, q: 'Hình nào KHÁC NHÓM?',
    opts: [gSvg('101/010/000'), gSvg('110/010/000'), gSvg(gRot('110/010/000')), gSvg(gRot(gRot('110/010/000')))],
    explain: 'Ba lưới kia là CÙNG một hình chỉ xoay đi (3 ô hình chữ L nhỏ); lưới còn lại là hình khác hẳn.',
  }),
  { id: 'cf13', category: '🖼️ Suy luận hình', d: 2, q: 'Dải 4 ô vuông xếp ngang có tất cả bao nhiêu HÌNH CHỮ NHẬT?',
    fig: figRow([iqSvg('<g class="so"><rect x="3" y="22" width="54" height="16"/><path d="M16.5 22 L16.5 38 M30 22 L30 38 M43.5 22 L43.5 38"/></g>')], 'lg'),
    options: ['4', '8', '10', '16'], answer: 2,
    explain: 'Chọn 2 trong 5 đường dọc làm hai cạnh bên: C(5,2) = 10 hình chữ nhật.' },
  { id: 'nm15', category: '🖼️ Suy luận hình', d: 2, q: 'Số ở ô dấu ? là bao nhiêu?',
    fig: figGrid([numCell(4), numCell(8), numCell(6), numCell(10), numCell(20), numCell(15), numCell(7), numCell(9), '?']),
    options: ['6', '8', '16', '63'], answer: 1,
    explain: 'Cột 3 là TRUNG BÌNH CỘNG của hai cột đầu: (7 + 9) / 2 = 8.' },
  { id: 'dl48', category: '🧠 Logic', d: 3, q: 'Cầu thang 10 bậc, mỗi bước bước 1 hoặc 2 bậc. Có bao nhiêu cách lên hết cầu thang?', options: ['55', '89', '100', '512'], answer: 1,
    explain: 'Số cách của bậc n = cách của (n−1) + cách của (n−2) — chính là Fibonacci: 1, 2, 3, 5, 8, 13, 21, 34, 55, 89.' },
  { id: 'dl49', category: '🧠 Logic', d: 3, q: '60% nhân viên biết Java, 70% biết JavaScript. ÍT NHẤT bao nhiêu phần trăm biết cả hai?', options: ['0%', '30%', '42%', '60%'], answer: 1,
    explain: 'Trường hợp chồng lấn ít nhất: 60 + 70 − 100 = 30%. (Nhiều nhất thì là 60%.)' },
  { id: 'dl50', category: '⏱️ Chuyển động & công việc', d: 3, q: 'Đi bộ lên dốc 1km với 2 km/h rồi xuống đúng đoạn đó với 6 km/h. Tốc độ TRUNG BÌNH cả chặng là bao nhiêu?', options: ['3 km/h', '3,5 km/h', '4 km/h', '4,5 km/h'], answer: 0,
    explain: 'Không phải trung bình cộng! Tổng quãng 2km, tổng thời gian 1/2 + 1/6 = 2/3 giờ ⇒ 2 ÷ (2/3) = 3 km/h.' },
  { id: 'n11-1', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 3, 7, 16, 35, ?', options: ['70', '71', '74', '75'], answer: 2,
    explain: 'Hệ số cộng tăng dần: × 2 + 1, × 2 + 2, × 2 + 3 ⇒ 35 × 2 + 4 = 74.' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #10 =====
  gOpQ('gx20', 3, '111/001/011', '010/111/010', 'xor', 'XOR: ô nào hai lưới cùng tô thì mất, ô lệch nhau thì giữ.'),
  figQ({
    id: 'piece1', d: 2, q: 'Mảnh nào ghép vào hình bên dưới thì lấp ĐẦY cả lưới 3×3 (không chồng ô nào)?',
    fig: figRow([gSvg('110/100/001')]),
    opts: [gSvg(gInv('110/100/001')), gSvg('110/100/001'), gSvg(gFlip(gInv('110/100/001'))), gSvg(gTog(gInv('110/100/001'), 4))],
    explain: 'Mảnh cần tìm phải tô ĐÚNG những ô còn trống — tức là hình "âm bản" của hình đã cho.',
  }),
  figQ({
    id: 'piece2', d: 3, q: 'Mảnh nào ghép vào hình bên dưới thì lấp ĐẦY cả lưới 3×3 (không chồng ô nào)?',
    fig: figRow([gSvg('101/110/010')]),
    opts: [gSvg(gInv('101/110/010')), gSvg(gFlip(gInv('101/110/010'))), gSvg('101/110/010'), gSvg(gRot(gInv('101/110/010')))],
    explain: 'Đếm ô trống rồi đối chiếu vị trí: mảnh ghép chính là ảnh âm bản của hình đã cho.',
  }),
  figQ({
    id: 'rt17', d: 2, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([gSvg('110/110/000'), gSvg('011/011/000'), gSvg('000/011/011'), '?']),
    opts: [gSvg('000/110/110'), gSvg('110/110/000'), gSvg('011/011/000'), gSvg('000/000/110')],
    explain: 'Khối vuông 2×2 chạy quanh lưới theo chiều kim đồng hồ: trên-trái → trên-phải → dưới-phải → dưới-trái.',
  }),
  figQ({
    id: 'sq14', d: 3, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([iqSvg(polyShape(3, 0)), iqSvg(polyShape(4, 2)), iqSvg(polyShape(5, 0)), iqSvg(polyShape(6, 2)), '?']),
    opts: [iqSvg(polyShape(7, 0)), iqSvg(polyShape(7, 2)), iqSvg(polyShape(8, 0)), iqSvg(polyShape(6, 0))],
    explain: 'HAI quy luật cùng lúc: số cạnh tăng 1 mỗi bước, còn cách tô luân phiên rỗng → đặc ⇒ 7 cạnh và RỖNG.',
  }),
  figQ({
    id: 'od16', d: 2, q: 'Hình nào KHÁC NHÓM?',
    opts: [gSvg('110/010/000'), gSvg('101/000/101'), gSvg('010/101/010'), gSvg('111/000/111')],
    explain: 'Ba lưới kia đối xứng qua trục NGANG (lật trên ↔ dưới vẫn ra chính nó); lưới còn lại thì không.',
  }),
  { id: 'cf14', category: '🖼️ Suy luận hình', d: 3, q: 'Lưới 4×2 ô vuông có tất cả bao nhiêu HÌNH CHỮ NHẬT?',
    fig: figRow([iqSvg('<g class="so"><rect x="4" y="16" width="52" height="28"/><path d="M17 16 L17 44 M30 16 L30 44 M43 16 L43 44 M4 30 L56 30"/></g>')], 'lg'),
    options: ['18', '24', '30', '36'], answer: 2,
    explain: 'Chọn 2 trong 5 đường dọc và 2 trong 3 đường ngang: C(5,2) × C(3,2) = 10 × 3 = 30.' },
  { id: 'nm16', category: '🖼️ Suy luận hình', d: 3, q: 'Số ở ô dấu ? là bao nhiêu?',
    fig: figGrid([numCell(9), numCell(4), numCell(10), numCell(7), numCell(3), numCell(8), numCell(6), numCell(2), '?']),
    options: ['4', '8', '12', '16'], answer: 1,
    explain: 'Cột 3 = (cột 1 − cột 2) × 2. Hàng cuối: (6 − 2) × 2 = 8.' },
  { id: 'dl51', category: '🧠 Logic', d: 3, q: 'Mật khẩu gồm 4 chữ số KHÁC NHAU (0–9). Có bao nhiêu mật khẩu như vậy?', options: ['4.096', '5.040', '6.561', '10.000'], answer: 1,
    explain: 'Chọn có thứ tự, không lặp: 10 × 9 × 8 × 7 = 5.040 (nếu cho phép lặp thì mới là 10.000).' },
  { id: 'dl52', category: '🧠 Logic', d: 3, q: 'Mọi người trong phòng bắt tay nhau đúng một lần, tổng cộng 66 cái bắt tay. Có bao nhiêu người?', options: ['11', '12', '22', '33'], answer: 1,
    explain: 'n(n−1)/2 = 66 ⇒ n(n−1) = 132 = 12 × 11 ⇒ 12 người.' },
  { id: 'dl53', category: '➗ Toán nhanh', d: 2, q: 'Một luồng xử lý đều 3.600 request mỗi giờ. Trung bình mỗi request mất bao lâu?', options: ['100ms', '360ms', '600ms', '1.000ms'], answer: 3,
    explain: '3.600 request / 3.600 giây = 1 request mỗi giây ⇒ 1.000ms cho mỗi request.' },
  { id: 'n12-1', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 1, 3, 2, 6, 4, 12, 8, ?', options: ['16', '20', '24', '32'], answer: 2,
    explain: 'Hai dãy đan xen, cùng nhân đôi: 1, 2, 4, 8 và 3, 6, 12, ? ⇒ 24.' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #11 =====
  gOpQ('gx21', 2, '110/110/011', '010/111/001', 'and', 'Giao hai lưới: giữ ô cả hai cùng tô, còn lại bỏ trống.'),
  figQ({
    id: 'mx18', d: 3, q: 'Ô dấu ? trong ma trận là hình nào? (số cạnh cột 3 = số cạnh cột 1 + cột 2)',
    fig: figGrid([
      iqSvg(polyShape(3)), iqSvg(polyShape(4)), iqSvg(polyShape(7)),
      iqSvg(polyShape(3)), iqSvg(polyShape(3)), iqSvg(polyShape(6)),
      iqSvg(polyShape(4)), iqSvg(polyShape(4)), '?']),
    opts: [iqSvg(polyShape(8)), iqSvg(polyShape(7)), iqSvg(polyShape(6)), iqSvg(polyShape(4))],
    explain: 'Cộng số cạnh của hai hình đầu: 4 + 4 = 8 ⇒ hình bát giác (đếm chấm ở đỉnh cho nhanh).',
  }),
  figQ({
    id: 'rt18', d: 2, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([iqSvg(shape('c')), iqSvg(shape('c') + shape('s')), iqSvg(shape('c') + shape('s') + shape('t')), '?']),
    opts: [iqSvg(shape('c') + shape('s') + shape('t') + shape('d')), iqSvg(shape('c') + shape('s')),
      iqSvg(shape('t') + shape('d')), iqSvg(shape('d'))],
    explain: 'Mỗi bước CHỒNG THÊM một hình mới mà vẫn giữ toàn bộ hình cũ ⇒ hình thứ tư có 4 hình lồng nhau.',
  }),
  figQ({
    id: 'sq15', d: 1, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([gSvg('111/111/110'), gSvg('111/111/000'), gSvg('111/100/000'), '?']),
    opts: [gSvg('110/000/000'), gSvg('100/000/000'), gSvg('111/000/000'), gSvg('000/000/000')],
    explain: 'Số ô được tô giảm đều 2 mỗi bước: 8 → 6 → 4 → 2 ô.',
  }),
  figQ({
    id: 'od17', d: 3, q: 'Hình nào KHÁC NHÓM?',
    opts: [iqSvg(polyShape(6)), iqSvg(polyShape(3)), iqSvg(polyShape(5)), iqSvg(polyShape(7))],
    explain: 'Ba hình kia có số cạnh là số NGUYÊN TỐ (3, 5, 7); lục giác 6 cạnh thì không.',
  }),
  { id: 'cf15', category: '🖼️ Suy luận hình', d: 2, q: 'Một ngũ giác (5 đỉnh) có tất cả bao nhiêu ĐƯỜNG CHÉO?',
    fig: figRow([iqSvg(polyShape(5))], 'lg'),
    options: ['4', '5', '8', '10'], answer: 1,
    explain: 'Công thức n(n−3)/2 = 5 × 2 / 2 = 5 đường chéo (mỗi đỉnh nối được với 2 đỉnh không kề).' },
  { id: 'nm17', category: '🖼️ Suy luận hình', d: 3, q: 'Số ở ô dấu ? là bao nhiêu?',
    fig: figGrid([numCell(4), numCell(3), numCell(5), numCell(5), numCell(2), numCell(3), numCell(6), numCell(4), '?']),
    options: ['10', '14', '18', '24'], answer: 1,
    explain: 'Cột 3 = cột 1 × cột 2 − (cột 1 + cột 2). Hàng cuối: 24 − 10 = 14.' },
  { id: 'dl54', category: '🎲 Xác suất', d: 3, q: 'Có 3 cửa, sau 1 cửa là xe hơi. Bạn chọn cửa 1; người dẫn (biết trước) mở cửa 3 thấy dê và mời bạn đổi. Nên làm gì?', options: ['Giữ nguyên cửa 1 vì 50-50', 'Đổi sang cửa 2 vì xác suất thắng là 2/3', 'Đổi hay không đều như nhau', 'Đổi sang cửa 2 vì xác suất thắng là 1/2'], answer: 1,
    explain: 'Bài Monty Hall: cửa bạn chọn giữ nguyên 1/3, toàn bộ 2/3 còn lại dồn vào cửa chưa mở ⇒ đổi thì thắng 2/3.' },
  { id: 'dl55', category: '➗ Toán nhanh', d: 2, q: 'Tổng các số nguyên từ 1 đến 100 bằng bao nhiêu?', options: ['4.950', '5.000', '5.050', '10.100'], answer: 2,
    explain: 'Ghép cặp đầu–cuối: 50 cặp × 101 = 5.050 (công thức n(n+1)/2).' },
  { id: 'dl56', category: '➗ Toán nhanh', d: 2, q: 'Một món hàng giảm 30% còn 7 triệu. Giá gốc là bao nhiêu?', options: ['9,1 triệu', '9,7 triệu', '10 triệu', '10,3 triệu'], answer: 2,
    explain: 'Giá còn lại bằng 70% giá gốc ⇒ 7 / 0,7 = 10 triệu (không phải cộng thêm 30% vào 7 triệu).' },
  { id: 'n13-1', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 2, 3, 5, 8, 12, 17, ?', options: ['20', '22', '23', '25'], answer: 2,
    explain: 'Khoảng cách tăng đều 1, 2, 3, 4, 5, 6 ⇒ 17 + 6 = 23.' },
  { id: 'n13-2', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 4, 9, 25, 49, ?', options: ['64', '81', '100', '121', ], answer: 3,
    explain: 'Bình phương các số NGUYÊN TỐ liên tiếp: 2², 3², 5², 7², 11² = 121.' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #12 =====
  gOpQ('gx22', 3, '011/101/110', '111/010/001', 'xor', 'XOR từng ô: trùng nhau thì bỏ, lệch nhau thì giữ.'),
  figQ({
    id: 'piece3', d: 3, q: 'Mảnh nào ghép vào hình bên dưới thì lấp ĐẦY cả lưới 3×3 (không chồng ô nào)?',
    fig: figRow([gSvg('111/010/010')]),
    opts: [gSvg(gInv('111/010/010')), gSvg(gRot(gInv('111/010/010'))), gSvg('111/010/010'), gSvg(gTog(gInv('111/010/010'), 3))],
    explain: 'Hình đã cho tô 5 ô, mảnh ghép phải tô đúng 4 ô còn trống (hai bên hàng giữa và hai bên hàng cuối).',
  }),
  figQ({
    id: 'mx19', d: 3, q: 'Ô dấu ? trong ma trận là hình nào?',
    fig: figGrid([dotAt(0), dotAt(1), dotAt(2), dotAt(3), dotAt(4), dotAt(5), dotAt(6), dotAt(7), '?']),
    opts: [dotAt(8), dotAt(0), dotAt(4), dotAt(6)],
    explain: 'Chấm trong mỗi ô nằm ĐÚNG vị trí của ô đó trong ma trận ⇒ ô dưới-phải phải có chấm ở góc dưới-phải.',
  }),
  figQ({
    id: 'rt19', d: 3, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([iqSvg(rot(shape('t', 0), 0)), iqSvg(rot(shape('t', 2), 90)), iqSvg(rot(shape('t', 0), 180)), iqSvg(rot(shape('t', 2), 270)), '?']),
    opts: [iqSvg(rot(shape('t', 0), 0)), iqSvg(rot(shape('t', 2), 0)), iqSvg(rot(shape('t', 0), 90)), iqSvg(rot(shape('t', 2), 180))],
    explain: 'HAI quy luật: xoay thêm 90° mỗi bước (270° + 90° = 360° về vị trí gốc) và cách tô luân phiên rỗng ↔ đặc ⇒ tam giác RỖNG hướng lên.',
  }),
  figQ({
    id: 'od18', d: 3, q: 'Hình nào KHÁC NHÓM?',
    opts: [gSvg('110/010/000'), gSvg('111/010/000'), gSvg(gRot('111/010/000')), gSvg(gRot(gRot('111/010/000')))],
    explain: 'Ba lưới kia là hình chữ T xoay đi các hướng (4 ô); lưới còn lại là chữ L chỉ có 3 ô.',
  }),
  { id: 'cf16', category: '🖼️ Suy luận hình', d: 3, q: 'Một lục giác (6 đỉnh) có tất cả bao nhiêu ĐƯỜNG CHÉO?',
    fig: figRow([iqSvg(polyShape(6))], 'lg'),
    options: ['6', '9', '12', '15'], answer: 1,
    explain: 'Công thức n(n−3)/2 = 6 × 3 / 2 = 9 (15 là tổng số đoạn nối mọi cặp đỉnh, trừ 6 cạnh còn 9 đường chéo).' },
  { id: 'nm18', category: '🖼️ Suy luận hình', d: 3, q: 'Số ở ô dấu ? là bao nhiêu?',
    fig: figGrid([numCell(5), numCell(3), numCell(16), numCell(6), numCell(4), numCell(20), numCell(7), numCell(2), '?']),
    options: ['14', '35', '45', '49'], answer: 2,
    explain: 'Cột 3 = cột 1² − cột 2². Hàng cuối: 49 − 4 = 45.' },
  { id: 'dl57', category: '🧠 Logic', d: 3, q: 'Chia 17 con lạc đà cho 3 người theo tỉ lệ 1/2, 1/3, 1/9 (không được xẻ thịt con nào). Người thứ nhất nhận mấy con?', options: ['8', '9', '10', 'Không chia được'], answer: 1,
    explain: 'Mẹo mượn thêm 1 con thành 18: chia 9 + 6 + 2 = 17 rồi trả lại con mượn ⇒ người thứ nhất được 9 con.' },
  { id: 'dl58', category: '⏱️ Chuyển động & công việc', d: 2, q: '6 người xây xong bức tường trong 12 ngày. 8 người (cùng năng suất) xây mất bao lâu?', options: ['8 ngày', '9 ngày', '10 ngày', '16 ngày'], answer: 1,
    explain: 'Tổng công là 6 × 12 = 72 công ⇒ 72 / 8 = 9 ngày (tỉ lệ NGHỊCH với số người).' },
  { id: 'dl59', category: '🎲 Xác suất', d: 3, q: 'Rút 1 lá từ bộ 52 lá. Xác suất được quân Át HOẶC chất Cơ là bao nhiêu?', options: ['4/13', '17/52', '1/4', '13/52'], answer: 0,
    explain: 'Cộng rồi trừ phần đếm hai lần (Át Cơ): 4/52 + 13/52 − 1/52 = 16/52 = 4/13.' },
  { id: 'n14-1', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 1, 2, 6, 42, ?', options: ['84', '210', '1.806', '2.520'], answer: 2,
    explain: 'Mỗi số bằng số trước nhân với (chính nó + 1): 42 × 43 = 1.806.' },
  { id: 'n14-2', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 90, 80, 71, 63, ?', options: ['54', '55', '56', '57'], answer: 2,
    explain: 'Trừ dần 10, 9, 8, 7 ⇒ 63 − 7 = 56.' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #13 =====
  gOpQ('gx23', 2, '100/011/010', '011/100/001', 'or', 'Hợp hai lưới: tô mọi ô có mặt ở ít nhất một hình.'),
  figQ({
    id: 'mx20', d: 3, q: 'Ô dấu ? trong ma trận là hình nào? (hàng 3 = hàng 1 ∩ hàng 2 theo từng cột)',
    fig: figGrid([
      gSvg('110/010/000'), gSvg('011/111/000'), gSvg('101/110/000'),
      gSvg('010/011/000'), gSvg('011/010/010'), gSvg('001/110/010'),
      gSvg(gOp('110/010/000', '010/011/000', 'and')), gSvg(gOp('011/111/000', '011/010/010', 'and')), '?']),
    opts: [gSvg(gOp('101/110/000', '001/110/010', 'and')), gSvg(gOp('101/110/000', '001/110/010', 'or')),
      gSvg(gOp('101/110/000', '001/110/010', 'xor')), gSvg('001/110/010')],
    explain: 'Mỗi CỘT: hình hàng 3 chỉ giữ những ô mà cả hàng 1 và hàng 2 đều tô.',
  }),
  figQ({
    id: 'rt20', d: 3, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([gSvg('100/010/001'), gSvg('010/001/100'), gSvg('001/100/010'), '?']),
    opts: [gSvg('100/010/001'), gSvg('010/001/100'), gSvg('111/000/000'), gSvg('000/111/000')],
    explain: 'Mỗi hàng dịch sang phải 1 ô và QUAY VÒNG; sau 3 bước cả hình trở về trạng thái ban đầu.',
  }),
  figQ({
    id: 'sq17', d: 2, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([iqSvg(shape('c') + shape('s') + shape('t')), iqSvg(shape('c') + shape('s')), iqSvg(shape('c')), '?']),
    opts: [iqSvg('<circle class="sf" cx="30" cy="30" r="4"/>'), iqSvg(shape('s')), iqSvg(shape('c') + shape('s')), iqSvg(shape('t'))],
    explain: 'Mỗi bước BỎ BỚT hình trong cùng: 3 hình → 2 hình → 1 hình → không còn hình nào (chỉ còn dấu chấm ở tâm).',
  }),
  figQ({
    id: 'od19', d: 2, q: 'Hình nào KHÁC NHÓM?',
    opts: [gSvg('100/000/001'), gSvg('110/010/000'), gSvg('011/001/000'), gSvg('000/110/100')],
    explain: 'Ba lưới kia có các ô DÍNH LIỀN nhau thành một khối; lưới còn lại là hai ô rời nhau ở hai góc.',
  }),
  { id: 'cf17', category: '🖼️ Suy luận hình', d: 2, q: 'Nối MỌI cặp trong 5 điểm (không có 3 điểm nào thẳng hàng) thì được bao nhiêu đoạn thẳng?',
    fig: figRow([iqSvg('<g class="so"><polygon points="30,8 51,23 43,48 17,48 9,23"/><path d="M30 8 L43 48 M30 8 L17 48 M51 23 L17 48 M51 23 L9 23 M43 48 L9 23"/></g>')], 'lg'),
    options: ['5', '8', '10', '15'], answer: 2,
    explain: 'Số cặp điểm C(5,2) = 10 — gồm 5 cạnh ngoài và 5 đường chéo bên trong.' },
  { id: 'nm19', category: '🖼️ Suy luận hình', d: 3, q: 'Số ở ô dấu ? là bao nhiêu?',
    fig: figGrid([numCell(2), numCell(3), numCell(5), numCell(4), numCell(1), numCell(10), numCell(3), numCell(2), '?']),
    options: ['5', '10', '15', '18'], answer: 2,
    explain: 'Cột 3 = (cột 1 + cột 2) × SỐ THỨ TỰ HÀNG: hàng 1 ×1, hàng 2 ×2, hàng 3 ×3 ⇒ (3+2) × 3 = 15.' },
  { id: 'dl60', category: '➗ Toán nhanh', d: 3, q: 'Mua con ngựa 60 triệu, bán 70, mua lại 80, bán tiếp 90. Tổng cộng lãi bao nhiêu?', options: ['10 triệu', '20 triệu', '30 triệu', 'Hoà vốn'], answer: 1,
    explain: 'Hai thương vụ độc lập: lãi 10 + lãi 10 = 20 triệu (tổng chi 140, tổng thu 160).' },
  { id: 'dl61', category: '🧠 Logic', d: 2, q: '100 người, 70 thích trà, 80 thích cà phê, ai cũng thích ít nhất một thứ. Bao nhiêu người thích CẢ HAI?', options: ['30', '50', '70', '150'], answer: 1,
    explain: '70 + 80 − 100 = 50 người được đếm hai lần ⇒ thích cả hai.' },
  { id: 'dl62', category: '🧠 Logic', d: 3, q: 'Tìm kiếm nhị phân trên 1 triệu bản ghi đã sắp xếp cần tối đa khoảng bao nhiêu bước?', options: ['10 bước', '20 bước', '100 bước', '1.000 bước'], answer: 1,
    explain: 'Mỗi bước loại một nửa ⇒ log₂(1.000.000) ≈ 20 bước (2²⁰ ≈ 1,05 triệu).' },
  { id: 'n15-1', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 2, 6, 30, 210, ?', options: ['420', '1.680', '2.310', '4.620'], answer: 2,
    explain: 'Tích dồn các số NGUYÊN TỐ: 2, 2·3, 2·3·5, 2·3·5·7 ⇒ nhân tiếp 11 được 2.310.' },
  { id: 'n15-2', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 3, 5, 8, 13, 21, ?', options: ['29', '32', '34', '42'], answer: 2,
    explain: 'Mỗi số bằng tổng hai số liền trước: 13 + 21 = 34.' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #14 =====
  gOpQ('gx24', 3, '111/110/010', '011/111/011', 'and', 'Giao hai lưới: chỉ những ô cả hai cùng tô mới còn lại.'),
  figQ({
    id: 'mx21', d: 3, q: 'Ô dấu ? trong ma trận là hình nào? (tổng số cạnh mỗi HÀNG đều bằng nhau)',
    fig: figGrid([
      iqSvg(polyShape(3)), iqSvg(polyShape(4)), iqSvg(polyShape(5)),
      iqSvg(polyShape(4)), iqSvg(polyShape(5)), iqSvg(polyShape(3)),
      iqSvg(polyShape(5)), iqSvg(polyShape(3)), '?']),
    opts: [iqSvg(polyShape(4)), iqSvg(polyShape(5)), iqSvg(polyShape(3)), iqSvg(polyShape(6))],
    explain: 'Hai hàng đầu đều có tổng 12 cạnh (3+4+5) ⇒ hàng cuối cần 12 − 5 − 3 = 4 cạnh.',
  }),
  figQ({
    id: 'rt21', d: 3, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([gSvg('100/000/000'), gSvg('010/100/000'), gSvg('001/010/100'), '?']),
    opts: [gSvg('000/001/010'), gSvg('000/000/001'), gSvg('100/010/001'), gSvg('000/100/010')],
    explain: 'Cả đường chéo trượt xuống-phải mỗi bước một ô; phần trượt ra ngoài lưới thì biến mất.',
  }),
  figQ({
    id: 'od20', d: 3, q: 'Hình nào KHÁC NHÓM?',
    opts: [gSvg('110/010/001'), gSvg('111/010/010'), gSvg('010/111/010'), gSvg('101/010/101')],
    explain: 'Ba lưới kia đối xứng qua trục DỌC (soi gương trái ↔ phải vẫn ra chính nó); lưới còn lại thì không.',
  }),
  { id: 'cf18', category: '🖼️ Suy luận hình', d: 3, q: 'Đi theo cạnh lưới 3×3 từ góc TRÁI–TRÊN xuống góc PHẢI–DƯỚI, chỉ đi sang phải hoặc xuống dưới. Có bao nhiêu đường đi?',
    fig: figRow([iqSvg('<g class="so"><rect x="8" y="8" width="44" height="44"/><path d="M22.7 8 L22.7 52 M37.3 8 L37.3 52 M8 22.7 L52 22.7 M8 37.3 L52 37.3"/></g><circle class="sf" cx="8" cy="8" r="4"/><circle class="sf" cx="52" cy="52" r="4"/>')], 'lg'),
    options: ['9', '15', '20', '24'], answer: 2,
    explain: 'Mỗi đường gồm 3 bước phải và 3 bước xuống, chỉ khác thứ tự ⇒ C(6,3) = 20 đường.' },
  { id: 'nm20', category: '🖼️ Suy luận hình', d: 2, q: 'Số ở ô dấu ? là bao nhiêu?',
    fig: figGrid([numCell(2), numCell(3), numCell(23), numCell(4), numCell(1), numCell(41), numCell(5), numCell(6), '?']),
    options: ['11', '30', '56', '65'], answer: 2,
    explain: 'Cột 3 GHÉP chữ số của cột 1 và cột 2 (không phải phép tính): 5 và 6 thành 56.' },
  { id: 'dl63', category: '🧠 Logic', d: 3, q: 'A, B, C thi chạy. A không về nhất, B không về nhì, C về sau A. Thứ tự về đích là gì?', options: ['A – B – C', 'B – A – C', 'C – A – B', 'B – C – A'], answer: 1,
    explain: 'A không nhất và C sau A ⇒ A phải về nhì (nếu A ba thì không còn ai sau A). Vậy C về ba, B về nhất (thoả B không nhì).' },
  { id: 'dl64', category: '🎲 Xác suất', d: 3, q: 'Một gia đình có 2 con, biết ÍT NHẤT một đứa là con trai. Xác suất cả hai đều là trai?', options: ['1/4', '1/3', '1/2', '2/3'], answer: 1,
    explain: 'Bốn khả năng ban đầu TT, TG, GT, GG; loại GG còn 3 ⇒ chỉ 1 trong 3 là cả hai trai = 1/3 (không phải 1/2).' },
  { id: 'dl65', category: '➗ Toán nhanh', d: 2, q: 'Server 16GB RAM, hệ điều hành và dịch vụ khác chiếm 4GB, mỗi kết nối tốn 8MB. Tối đa bao nhiêu kết nối? (1GB = 1024MB)', options: ['768', '1.536', '2.048', '3.072'], answer: 1,
    explain: 'Còn 12GB = 12.288MB cho kết nối ⇒ 12.288 / 8 = 1.536 kết nối.' },
  { id: 'n16-1', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 5, 7, 11, 19, 35, ?', options: ['51', '59', '67', '70'], answer: 2,
    explain: 'Khoảng cách nhân đôi: +2, +4, +8, +16, +32 ⇒ 35 + 32 = 67.' },
  { id: 'n16-2', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 100, 97, 91, 82, 70, ?', options: ['52', '55', '58', '60'], answer: 1,
    explain: 'Trừ dần 3, 6, 9, 12, 15 ⇒ 70 − 15 = 55.' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #15 — ưu tiên DẠNG MỚI =====
  gOpQ('gx25', 2, '010/101/010', '110/010/011', 'xor', 'XOR: ô trùng nhau triệt tiêu, ô lệch nhau thì giữ.'),
  // Chỗ trống nằm GIỮA chuỗi (không phải cuối) — phải suy cả hai chiều
  figQ({
    id: 'mid1', d: 3, q: 'Hình nào điền vào chỗ trống GIỮA chuỗi?',
    fig: figRow([gSvg('100/000/000'), gSvg('110/000/000'), '?', gSvg('111/100/000'), gSvg('111/110/000')]),
    opts: [gSvg('111/000/000'), gSvg('110/100/000'), gSvg('111/111/000'), gSvg('100/100/000')],
    explain: 'Mỗi bước tô thêm đúng 1 ô theo thứ tự đọc: 1 → 2 → 3 → 4 → 5 ô ⇒ chỗ trống là lưới tô 3 ô hàng đầu.',
  }),
  figQ({
    id: 'mid2', d: 3, q: 'Hình nào điền vào chỗ trống GIỮA chuỗi?',
    fig: figRow([iqSvg(rot(ARROW, 0)), iqSvg(rot(ARROW, 90)), '?', iqSvg(rot(ARROW, 270))]),
    opts: [iqSvg(rot(ARROW, 180)), iqSvg(rot(ARROW, 45)), iqSvg(rot(ARROW, 0)), iqSvg(rot(ARROW, 90))],
    explain: 'Mũi tên xoay đều 90° mỗi bước: 0° → 90° → 180° → 270° ⇒ chỗ trống là mũi tên chúc xuống.',
  }),
  // Ô "?" nằm GIỮA ma trận thay vì góc dưới-phải
  figQ({
    id: 'mx22', d: 3, q: 'Ô dấu ? ở GIỮA ma trận là hình nào?',
    fig: figGrid([sCell('c', 0), sCell('c', 1), sCell('c', 2), sCell('s', 0), '?', sCell('s', 2), sCell('t', 0), sCell('t', 1), sCell('t', 2)]),
    opts: [sCell('s', 1), sCell('s', 0), sCell('c', 1), sCell('t', 1)],
    explain: 'Hàng quyết định HÌNH (tròn – vuông – tam giác), cột quyết định CÁCH TÔ (rỗng – chấm – đặc) ⇒ ô giữa là hình vuông có chấm.',
  }),
  // Xúc xắc: tổng hai mặt đối diện luôn bằng 7
  figQ({
    id: 'dice1', d: 2, q: 'Trên con xúc xắc, tổng số chấm hai mặt ĐỐI DIỆN luôn bằng 7. Mặt đối diện với mặt dưới đây là mặt nào?',
    fig: figRow([iqSvg(dots(2))]),
    opts: [iqSvg(dots(5)), iqSvg(dots(4)), iqSvg(dots(6)), iqSvg(dots(2))],
    explain: '7 − 2 = 5 ⇒ mặt đối diện có 5 chấm.',
  }),
  { id: 'dice2', category: '🖼️ Suy luận hình', d: 3, q: 'Xúc xắc có tổng hai mặt đối diện bằng 7. Hình bên là mặt TRÊN (2 chấm) và mặt TRƯỚC (3 chấm). Tổng số chấm của mặt DƯỚI và mặt SAU là bao nhiêu?',
    fig: figRow([iqSvg(dots(2)), iqSvg(dots(3))]),
    options: ['5', '7', '9', '11'], answer: 2,
    explain: 'Mặt dưới = 7 − 2 = 5; mặt sau = 7 − 3 = 4 ⇒ tổng 5 + 4 = 9.' },
  // Cân bằng bằng hình (thay số bằng hình)
  { id: 'bal1', category: '🖼️ Suy luận hình', d: 3, q: 'Từ hai đẳng thức bên dưới, MỘT hình tròn bằng bao nhiêu hình tam giác?',
    fig: figRow([sCell('c', 2), sCell('c', 2), numCell('='), sCell('s', 2), sCell('s', 2), sCell('s', 2)]) +
      figRow([sCell('s', 2), numCell('='), sCell('t', 2), sCell('t', 2)]),
    options: ['2 tam giác', '3 tam giác', '4 tam giác', '6 tam giác'], answer: 1,
    explain: '2 tròn = 3 vuông = 3 × 2 tam giác = 6 tam giác ⇒ 1 tròn = 3 tam giác.' },
  { id: 'nm21', category: '🖼️ Suy luận hình', d: 3, q: 'Số ở ô dấu ? (nằm GIỮA ma trận) là bao nhiêu?',
    fig: figGrid([numCell(2), numCell(4), numCell(8), numCell(3), '?', numCell(18), numCell(5), numCell(7), numCell(35)]),
    options: ['5', '6', '9', '15'], answer: 1,
    explain: 'Cột 3 = cột 1 × cột 2 (2×4=8, 5×7=35) ⇒ hàng giữa: 3 × ? = 18 ⇒ ? = 6.' },
  { id: 'dl66', category: '🧠 Logic', d: 2, q: 'Có bao nhiêu cách xếp 3 người vào 3 ghế khác nhau?', options: ['3', '6', '9', '27'], answer: 1,
    explain: 'Hoán vị của 3 phần tử: 3! = 3 × 2 × 1 = 6 cách.' },
  { id: 'dl67', category: '➗ Toán nhanh', d: 2, q: 'Một job chạy mất 45 phút. Tối ưu giúp giảm 40% thời gian. Job còn chạy bao lâu?', options: ['18 phút', '25 phút', '27 phút', '30 phút'], answer: 2,
    explain: 'Còn 60% thời gian cũ: 45 × 0,6 = 27 phút.' },
  { id: 'n17-1', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 2, 5, 9, 14, 20, ?', options: ['25', '26', '27', '28'], answer: 2,
    explain: 'Khoảng cách tăng đều 3, 4, 5, 6, 7 ⇒ 20 + 7 = 27.' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #16 — TƯƠNG TỰ BẰNG HÌNH (A→B thì C→?) =====
  // Dạng analogy nhưng hoàn toàn bằng HÌNH, không dùng chữ.
  figQ({
    id: 'afig1', d: 3, q: 'Hình trên biến đổi theo một quy luật. Áp dụng đúng quy luật đó cho hàng dưới, ô ? là hình nào?',
    fig: figRow([gSvg('110/100/000'), numCell('→'), gSvg(gRot('110/100/000'))]) +
      figRow([gSvg('011/010/010'), numCell('→'), '?']),
    opts: [gSvg(gRot('011/010/010')), gSvg(gFlip('011/010/010')), gSvg(gRot(gRot('011/010/010'))), gSvg(gInv('011/010/010'))],
    explain: 'Quy luật ở hàng trên là XOAY 90° thuận chiều kim đồng hồ ⇒ áp dụng y hệt cho hình hàng dưới.',
  }),
  figQ({
    id: 'afig2', d: 3, q: 'Hình trên biến đổi theo một quy luật. Áp dụng đúng quy luật đó cho hàng dưới, ô ? là hình nào?',
    fig: figRow([gSvg('110/010/000'), numCell('→'), gSvg(gInv('110/010/000'))]) +
      figRow([gSvg('101/010/001'), numCell('→'), '?']),
    opts: [gSvg(gInv('101/010/001')), gSvg(gFlip('101/010/001')), gSvg(gRot('101/010/001')), gSvg('101/010/001')],
    explain: 'Quy luật là ĐẢO NGƯỢC (ô tô thành trống, ô trống thành tô) — không phải xoay hay lật.',
  }),
  figQ({
    id: 'afig3', d: 3, q: 'Hình trên biến đổi theo một quy luật. Áp dụng đúng quy luật đó cho hàng dưới, ô ? là hình nào?',
    fig: figRow([iqSvg(shape('s', 0)), numCell('→'), iqSvg(shape('s', 2))]) +
      figRow([iqSvg(polyShape(5, 0)), numCell('→'), '?']),
    opts: [iqSvg(polyShape(5, 2)), iqSvg(polyShape(6, 2)), iqSvg(polyShape(5, 0)), iqSvg(shape('s', 2))],
    explain: 'Quy luật là TÔ ĐẶC hình (giữ nguyên loại hình) ⇒ ngũ giác rỗng thành ngũ giác đặc.',
  }),
  gOpQ('gx26', 2, '011/010/110', '110/011/010', 'and', 'Giao hai lưới: chỉ giữ ô cả hai cùng tô.'),
  // Ma trận 4×4 — nhiều dữ kiện hơn, phải bắt quy luật theo cả hàng lẫn cột
  { id: 'mx4x4', category: '🖼️ Suy luận hình', d: 3, q: 'Ma trận 4×4: số ở ô dấu ? là bao nhiêu? (mỗi ô = hàng × cột)',
    fig: figGrid([
      numCell(1), numCell(2), numCell(3), numCell(4),
      numCell(2), numCell(4), numCell(6), numCell(8),
      numCell(3), numCell(6), numCell(9), numCell(12),
      numCell(4), numCell(8), '?', numCell(16)], 4),
    options: ['10', '11', '12', '14'], answer: 2,
    explain: 'Đây là bảng cửu chương: ô ở hàng 4 cột 3 = 4 × 3 = 12.' },
  figQ({
    id: 'mx23', d: 3, q: 'Ma trận 4×4: ô dấu ? là hình nào?',
    fig: figGrid([
      iqSvg(rot(ELL, 0)), iqSvg(rot(ELL, 90)), iqSvg(rot(ELL, 180)), iqSvg(rot(ELL, 270)),
      iqSvg(rot(ELL, 90)), iqSvg(rot(ELL, 180)), iqSvg(rot(ELL, 270)), iqSvg(rot(ELL, 0)),
      iqSvg(rot(ELL, 180)), iqSvg(rot(ELL, 270)), iqSvg(rot(ELL, 0)), iqSvg(rot(ELL, 90)),
      iqSvg(rot(ELL, 270)), iqSvg(rot(ELL, 0)), '?', iqSvg(rot(ELL, 180))], 4),
    opts: [iqSvg(rot(ELL, 90)), iqSvg(rot(ELL, 0)), iqSvg(rot(ELL, 180)), iqSvg(rot(ELL, 270))],
    explain: 'Mỗi bước sang phải xoay thêm 90°; hàng cuối bắt đầu từ 270° nên ô thứ ba là 270 + 180 = 90°.',
  }),
  { id: 'dl68', category: '🧠 Logic', d: 3, q: 'Một hồ có 64 lá súng, số lá tăng gấp đôi mỗi ngày và phủ kín hồ sau 6 ngày nữa. Nếu ban đầu chỉ có 32 lá thì phủ kín sau bao lâu?', options: ['5 ngày', '6 ngày', '7 ngày', '12 ngày'], answer: 2,
    explain: 'Ít hơn một nửa nghĩa là chậm hơn đúng MỘT ngày ⇒ 6 + 1 = 7 ngày.' },
  { id: 'dl69', category: '🎲 Xác suất', d: 2, q: 'Tung một xúc xắc 6 mặt. Xác suất được số CHẴN hoặc số lớn hơn 4?', options: ['1/2', '2/3', '3/4', '5/6'], answer: 1,
    explain: 'Chẵn = {2,4,6}, lớn hơn 4 = {5,6}; hợp lại {2,4,5,6} = 4 trường hợp trên 6 ⇒ 2/3.' },
  { id: 'dl70', category: '➗ Toán nhanh', d: 3, q: 'API tốn 200ms, trong đó 150ms là gọi DB. Nếu cache bỏ được 80% lần gọi DB thì thời gian TRUNG BÌNH còn bao nhiêu?', options: ['50ms', '80ms', '110ms', '170ms'], answer: 1,
    explain: '20% số lần vẫn tốn 150ms DB ⇒ trung bình 50 + 0,2 × 150 = 80ms.' },
  { id: 'n18-1', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 1, 2, 4, 7, 12, 20, ?', options: ['28', '31', '33', '35'], answer: 2,
    explain: 'Mỗi số = tổng hai số trước + 1: 12 + 20 + 1 = 33.' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #17 — TÌM HÌNH PHÁ VỠ QUY LUẬT =====
  // Chuỗi có đánh số ở hàng trên; người làm phải chỉ ra hình SAI quy luật.
  { id: 'brk1', category: '🖼️ Suy luận hình', d: 3, q: 'Chuỗi dưới đây lẽ ra tuân theo một quy luật. Hình thứ mấy PHÁ VỠ quy luật đó?',
    fig: figRow([numCell(1), numCell(2), numCell(3), numCell(4), numCell(5)]) +
      figRow([iqSvg(rot(ARROW, 0)), iqSvg(rot(ARROW, 90)), iqSvg(rot(ARROW, 180)), iqSvg(rot(ARROW, 90)), iqSvg(rot(ARROW, 0))]),
    options: ['Hình 2', 'Hình 3', 'Hình 4', 'Hình 5'], answer: 2,
    explain: 'Quy luật là xoay đều 90° mỗi bước: 0° → 90° → 180° → 270° → 0°. Hình thứ 4 quay ngược về 90° thay vì 270°.' },
  { id: 'brk2', category: '🖼️ Suy luận hình', d: 2, q: 'Chuỗi dưới đây lẽ ra tuân theo một quy luật. Hình thứ mấy PHÁ VỠ quy luật đó?',
    fig: figRow([numCell(1), numCell(2), numCell(3), numCell(4), numCell(5)]) +
      figRow([gSvg('100/000/000'), gSvg('110/000/000'), gSvg('111/000/000'), gSvg('111/110/000'), gSvg('111/110/100')]),
    options: ['Hình 2', 'Hình 3', 'Hình 4', 'Hình 5'], answer: 2,
    explain: 'Số ô tô phải tăng đều 1 mỗi bước: 1, 2, 3, 4, 5. Hình thứ 4 tô 5 ô (nhảy 2 ô) nên sai; hình 5 lại chỉ hơn hình 4 đúng 1 ô.' },
  { id: 'brk3', category: '🖼️ Suy luận hình', d: 3, q: 'Chuỗi dưới đây lẽ ra tuân theo một quy luật. Hình thứ mấy PHÁ VỠ quy luật đó?',
    fig: figRow([numCell(1), numCell(2), numCell(3), numCell(4), numCell(5)]) +
      figRow([iqSvg(polyShape(3)), iqSvg(polyShape(4)), iqSvg(polyShape(5)), iqSvg(polyShape(7)), iqSvg(polyShape(7))]),
    options: ['Hình 2', 'Hình 3', 'Hình 4', 'Hình 5'], answer: 2,
    explain: 'Số cạnh phải tăng đều 1: 3, 4, 5, 6, 7. Hình thứ 4 có 7 cạnh thay vì 6 (đếm chấm ở đỉnh để kiểm).' },
  gOpQ('gx27', 3, '101/011/110', '110/101/011', 'or', 'Hợp hai lưới: tô mọi ô xuất hiện ở ít nhất một hình.'),
  figQ({
    id: 'afig4', d: 3, q: 'Hình trên biến đổi theo một quy luật. Áp dụng đúng quy luật đó cho hàng dưới, ô ? là hình nào?',
    fig: figRow([gSvg('110/100/000'), numCell('→'), gSvg(gFlip('110/100/000'))]) +
      figRow([gSvg('100/110/010'), numCell('→'), '?']),
    opts: [gSvg(gFlip('100/110/010')), gSvg(gRot('100/110/010')), gSvg(gInv('100/110/010')), gSvg('100/110/010')],
    explain: 'Quy luật là LẬT GƯƠNG trái ↔ phải (không phải xoay) ⇒ mỗi hàng đảo thứ tự ô của chính nó.',
  }),
  { id: 'nm23', category: '🖼️ Suy luận hình', d: 2, q: 'Ma trận 4×4: số ở ô dấu ? là bao nhiêu? (mỗi ô = hàng + cột)',
    fig: figGrid([
      numCell(2), numCell(3), numCell(4), numCell(5),
      numCell(3), numCell(4), numCell(5), numCell(6),
      numCell(4), numCell(5), '?', numCell(7),
      numCell(5), numCell(6), numCell(7), numCell(8)], 4),
    options: ['5', '6', '7', '9'], answer: 1,
    explain: 'Ô hàng 3 cột 3 = 3 + 3 = 6 (mọi đường chéo phụ đều có giá trị bằng nhau).' },
  { id: 'dl71', category: '➗ Toán nhanh', d: 3, q: 'Sản lượng tăng 10% mỗi ngày, liên tục 5 ngày. Tổng cộng tăng khoảng bao nhiêu phần trăm?', options: ['50%', '55%', '61%', '65%'], answer: 2,
    explain: '1,1⁵ ≈ 1,61 ⇒ tăng khoảng 61% (không phải cộng dồn 5 × 10% = 50% vì có LÃI KÉP).' },
  { id: 'dl72', category: '🎲 Xác suất', d: 3, q: 'Rút 2 lá từ bộ 52 lá (không hoàn lại). Xác suất cả hai đều là Át?', options: ['1/169', '1/221', '1/13', '4/663'], answer: 1,
    explain: '(4/52) × (3/51) = 12/2652 = 1/221.' },
  { id: 'dl73', category: '⏱️ Chuyển động & công việc', d: 2, q: 'Hàng đợi còn 1.000 job, mỗi worker xử lý 5 job/giây, có 4 worker. Bao lâu thì hết hàng đợi?', options: ['25 giây', '50 giây', '100 giây', '200 giây'], answer: 1,
    explain: 'Tổng năng lực 4 × 5 = 20 job/giây ⇒ 1.000 / 20 = 50 giây.' },
  { id: 'n19-1', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 8, 4, 12, 6, 18, 9, ?', options: ['18', '21', '27', '36'], answer: 2,
    explain: 'Luân phiên ÷ 2 rồi × 3: sau bước ÷ 2 (18 → 9) là bước × 3 ⇒ 27.' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #18 =====
  // Chuỗi kiểu "Fibonacci hình": mỗi hình = XOR của HAI hình liền trước
  figQ({
    id: 'fibx1', d: 3, q: 'Mỗi hình được tạo từ HAI hình liền trước theo cùng một quy tắc. Hình tiếp theo là gì?',
    fig: figRow([gSvg('110/000/000'), gSvg('011/000/000'),
      gSvg(gOp('110/000/000', '011/000/000', 'xor')),
      gSvg(gOp('011/000/000', gOp('110/000/000', '011/000/000', 'xor'), 'xor')), '?']),
    opts: (() => {
      const a = '110/000/000', b = '011/000/000';
      const c = gOp(a, b, 'xor'), d = gOp(b, c, 'xor'), e = gOp(c, d, 'xor');
      return [gSvg(e), gSvg(gOp(c, d, 'or')), gSvg(gOp(c, d, 'and')), gSvg(gInv(e))];
    })(),
    explain: 'Quy tắc là XOR hai hình liền trước (ô trùng nhau triệt tiêu) — giống dãy Fibonacci nhưng bằng hình.',
  }),
  figQ({
    id: 'fibx2', d: 3, q: 'Mỗi hình được tạo từ HAI hình liền trước theo cùng một quy tắc. Hình tiếp theo là gì?',
    fig: (() => {
      const a = '100/010/000', b = '010/001/000';
      const c = gOp(a, b, 'xor'), d = gOp(b, c, 'xor');
      return figRow([gSvg(a), gSvg(b), gSvg(c), gSvg(d), '?']);
    })(),
    opts: (() => {
      const a = '100/010/000', b = '010/001/000';
      const c = gOp(a, b, 'xor'), d = gOp(b, c, 'xor'), e = gOp(c, d, 'xor');
      return [gSvg(e), gSvg(gOp(c, d, 'or')), gSvg(d), gSvg(gFlip(e))];
    })(),
    explain: 'Vẫn là XOR hai hình liền trước: ô nào xuất hiện ở CẢ HAI thì mất, ô chỉ có ở một hình thì giữ.',
  }),
  // Điền HAI chỗ trống liên tiếp — phải chọn đúng cả cặp
  figQ({
    id: 'pair1', d: 3, q: 'Hai chỗ trống liên tiếp trong chuỗi là cặp hình nào (theo đúng thứ tự)?',
    fig: figRow([gSvg('100/000/000'), gSvg('110/000/000'), '?', '?', gSvg('111/110/000')]),
    opts: [
      `<span style="display:flex;gap:6px">${gSvg('111/000/000')}${gSvg('111/100/000')}</span>`,
      `<span style="display:flex;gap:6px">${gSvg('111/100/000')}${gSvg('111/000/000')}</span>`,
      `<span style="display:flex;gap:6px">${gSvg('110/100/000')}${gSvg('111/000/000')}</span>`,
      `<span style="display:flex;gap:6px">${gSvg('111/000/000')}${gSvg('111/110/000')}</span>`,
    ],
    explain: 'Mỗi bước tô thêm đúng 1 ô theo thứ tự đọc: 1 → 2 → 3 → 4 → 5 ô, nên hai ô trống là lưới 3 ô rồi lưới 4 ô.',
  }),
  // Chọn hình có CÙNG SỐ Ô với hình mẫu (không cần cùng hình dạng)
  figQ({
    id: 'same1', d: 2, q: 'Hình nào có SỐ Ô ĐƯỢC TÔ bằng đúng hình mẫu bên dưới?',
    fig: figRow([gSvg('110/010/001')]),
    opts: [gSvg('001/101/010'), gSvg('100/010/000'), gSvg('111/110/010'), gSvg('110/010/000')],
    explain: 'Hình mẫu tô 4 ô — chỉ cần ĐẾM, không cần giống hình dạng. Ba lựa chọn còn lại tô 2, 6 và 3 ô.',
  }),
  gOpQ('gx28', 2, '100/110/001', '001/011/100', 'xor', 'XOR: ô chỉ một bên tô thì giữ, ô cả hai cùng tô thì bỏ.'),
  { id: 'nm24', category: '🖼️ Suy luận hình', d: 3, q: 'Số ở ô dấu ? là bao nhiêu?',
    fig: figGrid([numCell(6), numCell(2), numCell(4), numCell(9), numCell(3), numCell(6), numCell(12), numCell(4), '?']),
    options: ['3', '8', '9', '16'], answer: 1,
    explain: 'Cột 3 = cột 1 − cột 2: 6 − 2 = 4, 9 − 3 = 6, 12 − 4 = 8.' },
  { id: 'dl74', category: '🧠 Logic', d: 3, q: 'Có 9 viên bi giống hệt, 1 viên nhẹ hơn. Với cân thăng bằng, cần ÍT NHẤT mấy lần cân để chắc chắn tìm ra?', options: ['2', '3', '4', '8'], answer: 0,
    explain: 'Chia 3 nhóm 3 viên: cân 2 nhóm (lần 1) tìm ra nhóm chứa viên nhẹ; cân 2 viên trong nhóm đó (lần 2) là ra ⇒ 2 lần.' },
  { id: 'dl75', category: '➗ Toán nhanh', d: 2, q: 'Một API tính phí 0,002 USD mỗi request. Chạy 5 triệu request/tháng thì hết bao nhiêu?', options: ['1.000 USD', '5.000 USD', '10.000 USD', '100.000 USD'], answer: 2,
    explain: '5.000.000 × 0,002 = 10.000 USD.' },
  { id: 'dl76', category: '🎲 Xác suất', d: 2, q: 'Tung đồng xu 4 lần. Xác suất được ĐÚNG 2 mặt ngửa là bao nhiêu?', options: ['1/4', '3/8', '1/2', '5/8'], answer: 1,
    explain: 'C(4,2) = 6 cách trên tổng 2⁴ = 16 khả năng ⇒ 6/16 = 3/8.' },
  { id: 'n20-1', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 4, 6, 10, 18, 34, ?', options: ['50', '58', '66', '68'], answer: 2,
    explain: 'Quy luật × 2 − 2: 34 × 2 − 2 = 66.' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #19 =====
  // GHÉP HAI MẢNH: hai mảnh rời không chồng ô nào, ghép lại ra hình nào?
  figQ({
    id: 'merge1', d: 2, q: 'Ghép HAI mảnh bên dưới lại (không xoay, không lật) thì được hình nào?',
    fig: figRow([gSvg('110/000/000'), numCell('+'), gSvg('000/011/000')]),
    opts: [gSvg(gOp('110/000/000', '000/011/000', 'or')), gSvg('110/110/000'),
      gSvg('111/000/000'), gSvg('011/110/000')],
    explain: 'Chồng hai mảnh lên nhau và giữ mọi ô được tô: hàng đầu 2 ô bên trái, hàng giữa 2 ô bên phải.',
  }),
  figQ({
    id: 'merge2', d: 3, q: 'Ghép HAI mảnh bên dưới lại (không xoay, không lật) thì được hình nào?',
    fig: figRow([gSvg('100/010/001'), numCell('+'), gSvg('001/100/010')]),
    opts: [gSvg(gOp('100/010/001', '001/100/010', 'or')), gSvg('101/010/101'),
      gSvg('100/010/001'), gSvg('111/111/111')],
    explain: 'Hai đường chéo ghép lại thành hình chữ X thiếu ô giữa: mỗi hàng có 2 ô được tô.',
  }),
  // Nhận biết TRỤC ĐỐI XỨNG
  figQ({
    id: 'axis1', d: 2, q: 'Hình nào CÓ trục đối xứng (soi gương qua một đường thẳng vẫn ra chính nó)?',
    opts: [gSvg('010/111/010'), gSvg('110/010/001'), gSvg('100/110/001'), gSvg('011/100/010')],
    explain: 'Hình dấu cộng đối xứng qua cả trục dọc lẫn trục ngang; ba hình còn lại lật kiểu nào cũng khác đi.',
  }),
  gOpQ('gx29', 2, '111/001/100', '010/011/110', 'and', 'Giao hai lưới: chỉ ô nào cả hai cùng tô mới giữ lại.'),
  // Ma trận có ô "?" ở HÀNG ĐẦU (thường quen thấy ở hàng cuối)
  figQ({
    id: 'mxtop', d: 3, q: 'Ô dấu ? ở HÀNG ĐẦU của ma trận là hình nào?',
    fig: figGrid(['?', iqSvg(rot(FLAG, 90)), iqSvg(rot(FLAG, 180)),
      iqSvg(rot(FLAG, 90)), iqSvg(rot(FLAG, 180)), iqSvg(rot(FLAG, 270)),
      iqSvg(rot(FLAG, 180)), iqSvg(rot(FLAG, 270)), iqSvg(rot(FLAG, 0))]),
    opts: [iqSvg(rot(FLAG, 0)), iqSvg(rot(FLAG, 90)), iqSvg(rot(FLAG, 180)), iqSvg(rot(FLAG, 270))],
    explain: 'Mỗi bước sang phải (và xuống dưới) xoay thêm 90°; đi ngược từ ô thứ hai của hàng đầu (90°) thì ô đầu là 0°.',
  }),
  { id: 'nm25', category: '🖼️ Suy luận hình', d: 3, q: 'Số ở ô dấu ? (HÀNG ĐẦU) là bao nhiêu?',
    fig: figGrid([numCell(3), numCell(4), '?', numCell(5), numCell(2), numCell(10), numCell(6), numCell(7), numCell(42)]),
    options: ['7', '12', '14', '34'], answer: 1,
    explain: 'Cột 3 = cột 1 × cột 2 (5×2 = 10, 6×7 = 42) ⇒ hàng đầu: 3 × 4 = 12.' },
  { id: 'dl77', category: '🧠 Logic', d: 3, q: 'Ba hộp: một đựng táo, một đựng cam, một đựng cả hai. Bốc 1 quả từ hộp "cả hai" ra quả táo. Hộp đó thực chất đựng gì? (biết mọi nhãn đều SAI)', options: ['Chỉ táo', 'Chỉ cam', 'Cả hai', 'Chưa xác định được'], answer: 0,
    explain: 'Nhãn "cả hai" chắc chắn sai nên hộp đó thuần một loại; bốc ra táo ⇒ hộp đó chỉ đựng táo.' },
  { id: 'dl78', category: '⏱️ Chuyển động & công việc', d: 3, q: 'Hai xe xuất phát cùng lúc từ hai đầu quãng đường 300km, chạy ngược chiều với 60 km/h và 40 km/h. Sau bao lâu thì gặp nhau?', options: ['2 giờ', '3 giờ', '4 giờ', '5 giờ'], answer: 1,
    explain: 'Tốc độ tiếp cận = 60 + 40 = 100 km/h ⇒ 300 / 100 = 3 giờ.' },
  { id: 'dl79', category: '➗ Toán nhanh', d: 2, q: 'Log ghi 2KB mỗi request, hệ thống nhận 100 request/giây. Một ngày sinh ra khoảng bao nhiêu log? (1GB = 1000MB)', options: ['1,7GB', '8,6GB', '17,3GB', '86GB'], answer: 2,
    explain: '2KB × 100 = 200KB/giây × 86.400 giây ≈ 17.280.000KB ≈ 17,3GB mỗi ngày.' },
  { id: 'n21-1', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 1, 4, 9, 18, 35, ?', options: ['52', '60', '68', '70'], answer: 2,
    explain: 'Khoảng cách giữa các số là 3, 5, 9, 17, 33 — mỗi khoảng bằng khoảng trước × 2 − 1 ⇒ 35 + 33 = 68.' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #20 =====
  // "Hình nào KHÔNG thể có được bằng cách xoay hình mẫu?" (đáp án là ảnh gương)
  figQ({
    id: 'notrot1', d: 3, q: 'Hình nào KHÔNG THỂ tạo ra bằng cách XOAY hình mẫu bên dưới?',
    fig: figRow([gSvg('100/100/110')]),
    opts: [gSvg(gFlip('100/100/110')), gSvg(gRot('100/100/110')),
      gSvg(gRot(gRot('100/100/110'))), gSvg(gRot(gRot(gRot('100/100/110'))))],
    explain: 'Ba lựa chọn kia là hình mẫu xoay 90°, 180°, 270°; lựa chọn còn lại là ẢNH GƯƠNG — xoay kiểu gì cũng không ra được.',
  }),
  // Khoảng cách Hamming: hai lưới khác nhau ở mấy ô
  { id: 'comp1', category: '🖼️ Suy luận hình', d: 2, q: 'Hai lưới bên dưới KHÁC NHAU ở bao nhiêu ô?',
    fig: figRow([gSvg('110/010/001'), gSvg('100/011/001')]),
    options: ['1 ô', '2 ô', '3 ô', '4 ô'], answer: 1,
    explain: 'So từng ô: lưới trái tô ô giữa hàng đầu còn lưới phải thì không, ngược lại lưới phải tô thêm ô phải hàng giữa ⇒ đúng 2 ô lệch (bằng số ô của phép XOR).' },
  { id: 'comp2', category: '🖼️ Suy luận hình', d: 3, q: 'Hai lưới bên dưới KHÁC NHAU ở bao nhiêu ô?',
    fig: figRow([gSvg('111/000/111'), gSvg('101/010/011')]),
    options: ['2 ô', '3 ô', '4 ô', '5 ô'], answer: 1,
    explain: 'Đếm số ô mà một bên tô còn bên kia trống (chính là số ô của phép XOR): 3 ô.' },
  // Chuỗi KÉP: vừa xoay vừa thêm ô
  figQ({
    id: 'dual1', d: 3, q: 'Hình tiếp theo của chuỗi là gì? (chuỗi có HAI quy luật cùng lúc)',
    fig: figRow([gSvg('100/000/000'), gSvg('001/001/000'), gSvg('000/000/111'), '?']),
    opts: [gSvg('110/100/100'), gSvg('111/000/000'), gSvg('000/111/000'), gSvg('100/100/110')],
    explain: 'Mỗi bước cả hình XOAY 90° thuận chiều VÀ tô thêm 1 ô: 1 ô → 2 ô → 3 ô → 4 ô.',
  }),
  gOpQ('gx30', 3, '110/101/011', '011/110/101', 'or', 'Hợp hai lưới: gộp toàn bộ ô được tô của cả hai hình.'),
  { id: 'nm26', category: '🖼️ Suy luận hình', d: 3, q: 'Số ở ô dấu ? là bao nhiêu? (tổng mỗi CỘT đều bằng nhau)',
    fig: figGrid([numCell(4), numCell(9), numCell(2), numCell(3), numCell(5), numCell(7), numCell(8), '?', numCell(6)]),
    options: ['1', '2', '4', '6'], answer: 0,
    explain: 'Tổng cột 1 = 4 + 3 + 8 = 15 và cột 3 = 2 + 7 + 6 = 15 ⇒ cột 2 cần 15 − 9 − 5 = 1 (đây chính là ma phương 3×3).' },
  { id: 'dl80', category: '🧠 Logic', d: 3, q: 'Một người cần chuyển con sói, con dê và bó cỏ qua sông; thuyền chỉ chở được một thứ mỗi lượt. Chuyến ĐẦU TIÊN phải chở gì?', options: ['Con sói', 'Con dê', 'Bó cỏ', 'Chở gì cũng được'], answer: 1,
    explain: 'Phải tách sói khỏi dê và dê khỏi cỏ ⇒ chở DÊ trước, vì sói không ăn cỏ nên để lại được.' },
  { id: 'dl81', category: '🎲 Xác suất', d: 3, q: 'Trong hộp có 5 bi đỏ, 3 bi xanh. Rút 1 bi rồi BỎ LẠI, rút tiếp 1 bi. Xác suất được 2 bi cùng màu?', options: ['17/32', '1/2', '15/32', '34/64'], answer: 0,
    explain: 'Có hoàn lại: (5/8)² + (3/8)² = 25/64 + 9/64 = 34/64 = 17/32.' },
  { id: 'dl82', category: '➗ Toán nhanh', d: 3, q: 'Query mất 20ms, nhưng gọi N+1 lần cho 100 bản ghi. Nếu gộp thành 1 query 50ms thì tiết kiệm bao nhiêu thời gian?', options: ['Khoảng 1,9 giây', 'Khoảng 950ms', 'Khoảng 2 giây', 'Khoảng 100ms'], answer: 2,
    explain: 'N+1: 101 × 20ms = 2.020ms. Gộp lại còn 50ms ⇒ tiết kiệm ~1.970ms, tức khoảng 2 giây.' },
  { id: 'n22-1', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 7, 8, 10, 14, 22, ?', options: ['30', '32', '38', '44'], answer: 2,
    explain: 'Khoảng cách nhân đôi: +1, +2, +4, +8, +16 ⇒ 22 + 16 = 38.' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #21 =====
  // Chuỗi TUẦN HOÀN: suy ra hình ở vị trí xa bằng phép chia lấy dư
  figQ({
    id: 'cyc1', d: 3, q: 'Chuỗi dưới đây lặp lại tuần hoàn. Hình thứ 12 sẽ là hình nào?',
    fig: figRow([iqSvg(rot(ARROW, 0)), iqSvg(rot(ARROW, 90)), iqSvg(rot(ARROW, 180)), iqSvg(rot(ARROW, 0)), iqSvg(rot(ARROW, 90)), iqSvg(rot(ARROW, 180))]),
    opts: [iqSvg(rot(ARROW, 180)), iqSvg(rot(ARROW, 0)), iqSvg(rot(ARROW, 90)), iqSvg(rot(ARROW, 270))],
    explain: 'Chu kỳ dài 3 hình. 12 chia 3 dư 0 ⇒ hình thứ 12 trùng hình thứ 3 (mũi tên chúc xuống).',
  }),
  figQ({
    id: 'cyc2', d: 3, q: 'Chuỗi dưới đây lặp lại tuần hoàn. Hình thứ 15 sẽ là hình nào?',
    fig: figRow([sCell('c', 2), sCell('s', 2), sCell('t', 2), sCell('d', 2), sCell('c', 2), sCell('s', 2)]),
    opts: [sCell('t', 2), sCell('c', 2), sCell('s', 2), sCell('d', 2)],
    explain: 'Chu kỳ 4 hình (tròn – vuông – tam giác – thoi). 15 chia 4 dư 3 ⇒ hình thứ 15 là hình thứ 3 trong chu kỳ: tam giác.',
  }),
  // Đếm số ô CHUNG của hai lưới (phép giao)
  { id: 'and1', category: '🖼️ Suy luận hình', d: 2, q: 'Hai lưới bên dưới có bao nhiêu ô CÙNG được tô ở cả hai?',
    fig: figRow([gSvg('110/011/010'), gSvg('010/111/000')]),
    options: ['1 ô', '2 ô', '3 ô', '4 ô'], answer: 2,
    explain: 'Chồng hai lưới và chỉ đếm ô mà CẢ HAI cùng tô (phép giao): 3 ô.' },
  gOpQ('gx31', 2, '011/100/110', '010/101/010', 'and', 'Giao hai lưới: giữ ô cả hai cùng tô, bỏ phần còn lại.'),
  figQ({
    id: 'mid3', d: 3, q: 'Hình nào điền vào chỗ trống (vị trí thứ HAI) của chuỗi?',
    fig: figRow([gSvg('111/111/111'), '?', gSvg('111/000/111'), gSvg('101/000/101')]),
    opts: [gSvg('111/101/111'), gSvg('111/010/111'), gSvg('110/000/011'), gSvg('111/111/000')],
    explain: 'Mỗi bước xoá dần các ô từ giữa ra: 9 ô → 8 ô (mất ô tâm) → 6 ô (mất cả hàng giữa) → 4 ô (mất thêm hai ô giữa trên/dưới).',
  }),
  { id: 'nm27', category: '🖼️ Suy luận hình', d: 3, q: 'Số ở ô dấu ? (CỘT GIỮA) là bao nhiêu?',
    fig: figGrid([numCell(8), numCell(2), numCell(4), numCell(15), '?', numCell(5), numCell(24), numCell(4), numCell(6)]),
    options: ['3', '5', '6', '10'], answer: 0,
    explain: 'Cột 1 ÷ cột 2 = cột 3 (8÷2=4, 24÷4=6) ⇒ hàng giữa: 15 ÷ ? = 5 ⇒ ? = 3.' },
  { id: 'dl83', category: '🧠 Logic', d: 3, q: 'Một chiếc đồng hồ mỗi giờ chạy nhanh 2 phút. Chỉnh đúng lúc 12:00 trưa, thì lúc đồng hồ chỉ 6:00 chiều, giờ thật là mấy giờ?', options: ['5 giờ 48 phút', '5 giờ 49 phút', '6 giờ 12 phút', '5 giờ 50 phút'], answer: 1,
    explain: 'Đồng hồ chạy 62 phút cho mỗi 60 phút thật. Hiện 360 phút trên mặt đồng hồ ⇒ thật = 360 × 60/62 ≈ 348,4 phút ≈ 5 giờ 48,4 phút, làm tròn 5 giờ 49 phút.' },
  { id: 'dl84', category: '🧠 Logic', d: 2, q: 'Một quyển lịch có 12 tháng. Bao nhiêu tháng có ít nhất 28 ngày?', options: ['1', '2', '11', '12'], answer: 3,
    explain: 'Câu bẫy: THÁNG NÀO cũng có ít nhất 28 ngày ⇒ cả 12 tháng.' },
  { id: 'dl85', category: '➗ Toán nhanh', d: 3, q: 'Một dịch vụ xử lý 500 request/giây, mỗi request giữ kết nối 40ms. Trung bình có bao nhiêu request đang chạy đồng thời?', options: ['12,5', '20', '40', '200'], answer: 1,
    explain: 'Định luật Little: L = λ × W = 500 × 0,04 = 20 request đồng thời.' },
  { id: 'n23-1', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 3, 4, 7, 11, 18, 29, ?', options: ['40', '45', '47', '52'], answer: 2,
    explain: 'Mỗi số bằng tổng hai số liền trước: 18 + 29 = 47.' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #22 =====
  // SẮP XẾP hình theo số ô — phải so sánh cả 4 hình chứ không chỉ nhìn 1 hình
  { id: 'ord1', category: '🖼️ Suy luận hình', d: 2, q: 'Sắp xếp 4 hình dưới đây theo SỐ Ô ĐƯỢC TÔ tăng dần. Hình nào đứng thứ BA?',
    fig: figRow([numCell(1), numCell(2), numCell(3), numCell(4)]) +
      figRow([gSvg('111/110/000'), gSvg('100/010/000'), gSvg('111/111/010'), gSvg('110/010/001')]),
    options: ['Hình 1', 'Hình 2', 'Hình 3', 'Hình 4'], answer: 0,
    explain: 'Số ô lần lượt là 5, 2, 7, 4 ⇒ thứ tự tăng dần: hình 2 (2 ô), hình 4 (4 ô), hình 1 (5 ô), hình 3 (7 ô). Đứng thứ ba là hình 1.' },
  { id: 'ord2', category: '🖼️ Suy luận hình', d: 3, q: 'Sắp xếp 4 hình dưới đây theo SỐ CẠNH giảm dần. Hình nào đứng thứ HAI?',
    fig: figRow([numCell(1), numCell(2), numCell(3), numCell(4)]) +
      figRow([iqSvg(polyShape(5)), iqSvg(polyShape(8)), iqSvg(polyShape(3)), iqSvg(polyShape(6))]),
    options: ['Hình 1', 'Hình 2', 'Hình 3', 'Hình 4'], answer: 3,
    explain: 'Số cạnh: 5, 8, 3, 6 ⇒ giảm dần là 8 (hình 2), 6 (hình 4), 5 (hình 1), 3 (hình 3). Đứng thứ hai là hình 4.' },
  // Quy luật theo ĐƯỜNG CHÉO của ma trận
  figQ({
    id: 'diag1', d: 3, q: 'Ô dấu ? là hình nào? (gợi ý: nhìn theo ĐƯỜNG CHÉO)',
    fig: figGrid([
      sCell('c', 2), sCell('s', 0), sCell('t', 0),
      sCell('s', 0), sCell('c', 2), sCell('s', 0),
      sCell('t', 0), sCell('s', 0), '?']),
    opts: [sCell('c', 2), sCell('s', 0), sCell('t', 0), sCell('c', 0)],
    explain: 'Cả đường chéo chính đều là hình TRÒN TÔ ĐẶC (hai ô kia đã là tròn đặc) ⇒ ô góc dưới-phải cũng vậy.',
  }),
  // Chuỗi xen kẽ phép ĐẢO NGƯỢC và phép XOAY
  figQ({
    id: 'notb1', d: 3, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: (() => {
      const p = '110/010/000';
      return figRow([gSvg(p), gSvg(gInv(p)), gSvg(gRot(p)), gSvg(gInv(gRot(p))), '?']);
    })(),
    opts: (() => {
      const p = '110/010/000';
      return [gSvg(gRot(gRot(p))), gSvg(gInv(gRot(gRot(p)))), gSvg(p), gSvg(gRot(p))];
    })(),
    explain: 'Chuỗi đi theo cặp: hình gốc → ảnh đảo ngược → hình gốc XOAY 90° → ảnh đảo ngược của nó → tiếp tục là hình gốc xoay 180°.',
  }),
  gOpQ('gx32', 3, '011/011/100', '110/010/011', 'xor', 'XOR: bỏ ô trùng nhau, giữ ô chỉ một bên tô.'),
  { id: 'nm28', category: '🖼️ Suy luận hình', d: 3, q: 'Số ở ô dấu ? là bao nhiêu? (nhìn theo ĐƯỜNG CHÉO)',
    fig: figGrid([numCell(2), numCell(9), numCell(4), numCell(7), numCell(4), numCell(3), numCell(6), numCell(1), '?']),
    options: ['6', '8', '10', '12'], answer: 1,
    explain: 'Đường chéo chính 2, 4, ? tăng gấp đôi (2 → 4 → 8); các số còn lại chỉ là nhiễu.' },
  { id: 'dl86', category: '🧠 Logic', d: 3, q: 'Có 3 cái hộp, chỉ MỘT hộp đựng quà. Hộp A ghi "Quà ở đây", hộp B ghi "Quà không ở đây", hộp C ghi "Quà không ở hộp A". Chỉ MỘT dòng chữ đúng. Quà ở hộp nào?', options: ['Hộp A', 'Hộp B', 'Hộp C', 'Không xác định được'], answer: 1,
    explain: 'Thử hộp B: A sai, B ("không ở đây") sai, C ("không ở A") đúng ⇒ đúng một dòng. Các trường hợp khác đều cho 2 dòng đúng.' },
  { id: 'dl87', category: '🎲 Xác suất', d: 3, q: 'Một lớp có 4 nam, 6 nữ. Chọn ngẫu nhiên 2 người. Xác suất được 1 nam 1 nữ là bao nhiêu?', options: ['4/15', '8/15', '1/2', '3/5'], answer: 1,
    explain: 'C(4,1) × C(6,1) / C(10,2) = 24 / 45 = 8/15.' },
  { id: 'dl88', category: '➗ Toán nhanh', d: 2, q: 'Bảng giá cloud: 0,10 USD/giờ mỗi máy. Chạy 3 máy suốt 30 ngày hết bao nhiêu?', options: ['72 USD', '216 USD', '270 USD', '720 USD'], answer: 1,
    explain: '30 ngày = 720 giờ ⇒ 720 × 0,10 × 3 máy = 216 USD.' },
  { id: 'n24-1', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 2, 12, 30, 56, ?', options: ['72', '84', '90', '110'], answer: 2,
    explain: 'Tích của hai số tự nhiên liên tiếp theo từng cặp: 1×2, 3×4, 5×6, 7×8, rồi 9×10 = 90.' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #23 =====
  // Quét cả nhóm: hình nào KHÔNG có mặt trong bảng
  figQ({
    id: 'notin1', d: 2, q: 'Hình nào KHÔNG xuất hiện trong bảng bên dưới?',
    fig: figGrid([gSvg('110/000/000'), gSvg('001/010/000'), gSvg('100/100/100'),
      gSvg('010/010/010'), gSvg('111/000/000'), gSvg('000/111/000'),
      gSvg('001/001/001'), gSvg('100/010/001'), gSvg('000/000/111')]),
    opts: [gSvg('101/000/101'), gSvg('111/000/000'), gSvg('100/010/001'), gSvg('010/010/010')],
    explain: 'Ba lựa chọn kia đều nằm trong bảng; chỉ hình bốn góc (101/000/101) là không có mặt.',
  }),
  // Ma trận lưới: tổng số ô mỗi HÀNG bằng nhau
  figQ({
    id: 'rowsum1', d: 3, q: 'Ô dấu ? là hình nào? (tổng SỐ Ô ĐƯỢC TÔ của mỗi hàng đều bằng nhau)',
    fig: figGrid([gSvg('100/000/000'), gSvg('110/000/000'), gSvg('111/000/000'),
      gSvg('110/000/000'), gSvg('110/100/000'), gSvg('100/000/000'),
      gSvg('111/000/000'), gSvg('100/000/000'), '?']),
    opts: [gSvg('110/000/000'), gSvg('111/000/000'), gSvg('100/000/000'), gSvg('111/100/000')],
    explain: 'Hai hàng đầu đều tô tổng 6 ô (1+2+3 và 2+3+1) ⇒ hàng cuối cần 6 − 3 − 1 = 2 ô.',
  }),
  // Chuỗi XEN KẼ số và hình
  figQ({
    id: 'mixnum1', d: 2, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([numCell(3), iqSvg(polyShape(3)), numCell(4), iqSvg(polyShape(4)), numCell(5), '?']),
    opts: [iqSvg(polyShape(5)), iqSvg(polyShape(6)), numCell(6), iqSvg(polyShape(4))],
    explain: 'Chuỗi đi theo cặp "số n rồi hình n cạnh": sau số 5 phải là hình 5 cạnh (ngũ giác).',
  }),
  gOpQ('gx33', 2, '100/011/110', '110/001/010', 'or', 'Hợp hai lưới: gộp mọi ô được tô của cả hai hình.'),
  { id: 'nm29', category: '🖼️ Suy luận hình', d: 3, q: 'Số ở ô dấu ? (CỘT ĐẦU) là bao nhiêu?',
    fig: figGrid([numCell(4), numCell(5), numCell(9), numCell(7), numCell(6), numCell(13), '?', numCell(8), numCell(11)]),
    options: ['3', '4', '5', '19'], answer: 0,
    explain: 'Cột 3 = cột 1 + cột 2 (4+5=9, 7+6=13) ⇒ hàng cuối: ? + 8 = 11 ⇒ ? = 3 (phải suy NGƯỢC).' },
  { id: 'dl89', category: '🧠 Logic', d: 3, q: 'Bạn có 2 sợi dây cháy hết trong 30 phút mỗi sợi (cháy không đều). Đo 15 phút bằng cách nào?', options: ['Đốt một sợi ở một đầu rồi canh nửa chừng', 'Đốt một sợi ở CẢ HAI đầu cùng lúc', 'Đốt cả hai sợi ở một đầu', 'Gấp đôi sợi dây rồi đốt'], answer: 1,
    explain: 'Đốt hai đầu thì tổng thời gian cháy chia đôi ⇒ đúng 15 phút, bất kể dây cháy không đều.' },
  { id: 'dl90', category: '🧠 Logic', d: 2, q: 'Một cầu thang máy đi từ tầng 1 lên tầng 5 mất 8 giây. Với cùng tốc độ đó, từ tầng 1 lên tầng 9 mất bao lâu?', options: ['12 giây', '14 giây', '16 giây', '18 giây'], answer: 2,
    explain: 'Tầng 1→5 là 4 khoảng, mất 8 giây ⇒ 2 giây/khoảng. Tầng 1→9 là 8 khoảng ⇒ 16 giây (không phải nhân đôi số tầng).' },
  { id: 'dl91', category: '➗ Toán nhanh', d: 3, q: 'Bảng có 1 tỉ dòng, index giúp quét còn 0,001% số dòng. Mỗi lần đọc dòng mất 1 micro giây. Truy vấn mất bao lâu?', options: ['1ms', '10ms', '100ms', '1 giây'], answer: 1,
    explain: '0,001% của 1 tỉ = 10.000 dòng ⇒ 10.000 × 1µs = 10.000µs = 10ms.' },
  { id: 'n25-1', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 5, 10, 30, 120, ?', options: ['360', '480', '600', '720'], answer: 2,
    explain: 'Nhân lần lượt với 2, 3, 4 rồi 5: 120 × 5 = 600.' },
  { id: 'n25-2', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 31, 28, 31, 30, 31, ?', options: ['28', '29', '30', '31'], answer: 2,
    explain: 'Đây là SỐ NGÀY các tháng trong năm thường: tháng 1 đến tháng 5 là 31, 28, 31, 30, 31 ⇒ tháng 6 có 30 ngày.' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #24 =====
  // Chuỗi CÓ NHIỄU: một thuộc tính đổi lung tung, chỉ MỘT thuộc tính theo quy luật
  figQ({
    id: 'noise1', d: 3, q: 'Hình tiếp theo của chuỗi là gì? (chú ý: chỉ MỘT thuộc tính tuân theo quy luật)',
    fig: figRow([iqSvg(polyShape(3, 0)), iqSvg(polyShape(4, 2)), iqSvg(polyShape(5, 2)), iqSvg(polyShape(6, 0)), '?']),
    opts: [iqSvg(polyShape(7, 0)), iqSvg(polyShape(6, 2)), iqSvg(polyShape(8, 0)), iqSvg(polyShape(5, 0))],
    explain: 'Kiểu tô thay đổi lung tung (rỗng, đặc, đặc, rỗng) — đó là NHIỄU. Quy luật thật là số cạnh tăng đều 1 ⇒ hình 7 cạnh (chọn hình rỗng vì kiểu tô không quyết định).',
  }),
  // Ma trận hai thuộc tính: HÌNH ngoài + SỐ CHẤM bên trong
  figQ({
    id: 'inside1', d: 3, q: 'Ô dấu ? là hình nào? (chú ý cả hình bao ngoài lẫn số chấm bên trong)',
    fig: figGrid([
      iqSvg(shape('s') + dots(1)), iqSvg(shape('s') + dots(2)), iqSvg(shape('s') + dots(3)),
      iqSvg(shape('c') + dots(1)), iqSvg(shape('c') + dots(2)), iqSvg(shape('c') + dots(3)),
      iqSvg(shape('d') + dots(1)), iqSvg(shape('d') + dots(2)), '?']),
    opts: [iqSvg(shape('d') + dots(3)), iqSvg(shape('d') + dots(2)), iqSvg(shape('c') + dots(3)), iqSvg(shape('s') + dots(3))],
    explain: 'Hàng quyết định HÌNH BAO (vuông – tròn – thoi), cột quyết định SỐ CHẤM (1 – 2 – 3) ⇒ ô cuối là hình thoi với 3 chấm.',
  }),
  gOpQ('gx34', 3, '101/110/011', '011/101/110', 'and', 'Giao hai lưới: chỉ giữ ô mà cả hai cùng tô.'),
  { id: 'cf19', category: '🖼️ Suy luận hình', d: 3, q: 'Chỉ tính các ô ĐƯỢC TÔ, hình bên dưới chứa bao nhiêu HÌNH VUÔNG (mọi kích thước)?',
    fig: figRow([gSvg('110/110/010')], 'lg'),
    options: ['4', '5', '6', '7'], answer: 2,
    explain: '5 hình vuông nhỏ (5 ô được tô) cộng 1 hình vuông 2×2 ở góc trên-trái = 6.' },
  { id: 'nm30', category: '🖼️ Suy luận hình', d: 3, q: 'Số ở ô dấu ? là bao nhiêu?',
    fig: figGrid([numCell(2), numCell(3), numCell(8), numCell(3), numCell(2), numCell(9), numCell(2), numCell(5), '?']),
    options: ['10', '25', '32', '64'], answer: 2,
    explain: 'Cột 3 = cột 1 luỹ thừa cột 2: 2³ = 8, 3² = 9 ⇒ 2⁵ = 32.' },
  { id: 'dl92', category: '🧠 Logic', d: 3, q: 'A nói "B nói dối". B nói "C nói dối". C nói "A và B đều nói dối". Ai nói THẬT?', options: ['Chỉ A', 'Chỉ B', 'Chỉ C', 'Cả ba đều nói dối'], answer: 1,
    explain: 'Giả sử A thật ⇒ B dối ⇒ C thật ⇒ C bảo A dối, mâu thuẫn. Vậy A dối ⇒ B thật ⇒ C dối; kiểm lại: C dối nghĩa là KHÔNG phải cả A và B đều dối — đúng vì B thật. Chỉ B nói thật.' },
  { id: 'dl93', category: '➗ Toán nhanh', d: 2, q: 'Một trang web có 20.000 lượt xem/ngày, tỉ lệ chuyển đổi 2,5%. Mỗi đơn lãi 40.000đ. Lãi mỗi ngày là bao nhiêu?', options: ['8 triệu', '20 triệu', '40 triệu', '80 triệu'], answer: 1,
    explain: '20.000 × 2,5% = 500 đơn ⇒ 500 × 40.000 = 20.000.000đ.' },
  { id: 'dl94', category: '🎲 Xác suất', d: 2, q: 'Xác suất một request lỗi là 1%. Gửi 2 request độc lập, xác suất CẢ HAI đều thành công là bao nhiêu?', options: ['98%', '98,01%', '99%', '99,99%'], answer: 1,
    explain: '0,99 × 0,99 = 0,9801 = 98,01% (không phải trừ thẳng 2%).' },
  { id: 'n26-1', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 2, 3, 7, 16, 32, ?', options: ['48', '57', '64', '73'], answer: 1,
    explain: 'Khoảng cách là 1, 4, 9, 16 (bình phương 1², 2², 3², 4²) ⇒ khoảng tiếp theo 5² = 25 ⇒ 32 + 25 = 57.' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #25 =====
  // Hai điều kiện cùng lúc: đối xứng CẢ trục dọc lẫn trục ngang
  figQ({
    id: 'both1', d: 3, q: 'Hình nào vừa đối xứng qua trục DỌC vừa đối xứng qua trục NGANG?',
    opts: [gSvg('101/000/101'), gSvg('111/010/000'), gSvg('110/110/000'), gSvg('100/010/001')],
    explain: 'Chỉ hình bốn góc mới giữ nguyên khi lật trái↔phải VÀ khi lật trên↔dưới; các hình kia chỉ thoả một chiều hoặc không chiều nào.',
  }),
  // Chuỗi xoay 45° (góc lẻ, khó nhận hơn 90°)
  figQ({
    id: 'rot45', d: 3, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([iqSvg(rot(shape('t'), 0)), iqSvg(rot(shape('t'), 45)), iqSvg(rot(shape('t'), 90)), '?']),
    opts: [iqSvg(rot(shape('t'), 135)), iqSvg(rot(shape('t'), 180)), iqSvg(rot(shape('t'), 0)), iqSvg(rot(shape('t'), 90))],
    explain: 'Tam giác xoay thêm 45° mỗi bước (không phải 90°) ⇒ sau 90° là 135°.',
  }),
  // Nhiễu kiểu khác: VỊ TRÍ ô nhảy lung tung, chỉ SỐ Ô là quy luật
  figQ({
    id: 'noise2', d: 3, q: 'Hình tiếp theo của chuỗi là gì? (vị trí các ô chỉ là nhiễu)',
    fig: figRow([gSvg('100/000/000'), gSvg('000/010/001'), gSvg('001/100/010'), gSvg('110/001/010'), '?']),
    opts: [gSvg('101/010/101'), gSvg('110/010/000'), gSvg('111/111/000'), gSvg('100/000/001')],
    explain: 'Vị trí ô đổi lung tung — chỉ SỐ Ô là quy luật: 1, 2, 3, 4 ⇒ hình tiếp theo phải có 5 ô.',
  }),
  gOpQ('gx35', 2, '111/010/001', '001/110/011', 'or', 'Hợp hai lưới: tô mọi ô có ở ít nhất một hình.'),
  { id: 'nm31', category: '🖼️ Suy luận hình', d: 2, q: 'Số ở ô dấu ? là bao nhiêu?',
    fig: figGrid([numCell(12), numCell(3), numCell(4), numCell(20), numCell(5), numCell(4), numCell(36), numCell(9), '?']),
    options: ['3', '4', '6', '27'], answer: 1,
    explain: 'Cột 3 = cột 1 ÷ cột 2: 12÷3 = 4, 20÷5 = 4, 36÷9 = 4 — cả ba hàng đều ra 4.' },
  { id: 'dl95', category: '🧠 Logic', d: 3, q: 'Có 100 bóng đèn đang tắt, đánh số 1–100. Lần lượt bật/tắt các bóng là bội số của 1, 2, 3… đến 100. Cuối cùng bóng số 9 SÁNG hay TẮT?', options: ['Sáng', 'Tắt', 'Phụ thuộc thứ tự làm', 'Không xác định được'], answer: 0,
    explain: 'Bóng số n bị đảo trạng thái đúng bằng số ước của n. Số 9 có 3 ước (1, 3, 9) — số LẺ lần đảo ⇒ đèn sáng (chỉ số CHÍNH PHƯƠNG mới sáng).' },
  { id: 'dl96', category: '🧠 Logic', d: 2, q: 'Một cái ly đầy nước, đổ ra 1/3 rồi lại đổ thêm vào 1/4 dung tích ly. Ly đang chứa bao nhiêu phần?', options: ['5/12', '7/12', '11/12', '2/3'], answer: 2,
    explain: '1 − 1/3 = 2/3 = 8/12; thêm 1/4 = 3/12 ⇒ 11/12 ly.' },
  { id: 'dl97', category: '➗ Toán nhanh', d: 3, q: 'Deploy mất 12 phút, mỗi ngày deploy 5 lần, đội 4 người đều phải ngồi chờ. Một tháng (22 ngày làm việc) tốn bao nhiêu GIỜ CÔNG chờ?', options: ['22 giờ', '44 giờ', '88 giờ', '176 giờ'], answer: 2,
    explain: '12 phút × 5 lần × 22 ngày = 1.320 phút = 22 giờ; nhân 4 người ⇒ 88 giờ công.' },
  { id: 'n27-1', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 1, 5, 13, 29, 61, ?', options: ['93', '109', '125', '127'], answer: 2,
    explain: 'Quy luật × 2 + 3: 61 × 2 + 3 = 125.' },
  { id: 'n27-2', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 9, 3, 12, 4, 15, 5, ?', options: ['6', '16', '18', '20'], answer: 2,
    explain: 'Hai dãy đan xen: 9, 12, 15, ? (cộng 3) và 3, 4, 5 (số đứng sau bằng một phần ba số trước) ⇒ tiếp theo là 18.' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #26 =====
  // Suy NGƯỢC: hình đứng TRƯỚC hình đầu tiên
  figQ({
    id: 'back1', d: 3, q: 'Nếu chuỗi này kéo dài về phía trước thì hình đứng TRƯỚC hình đầu tiên là gì?',
    fig: figRow([gSvg('111/110/000'), gSvg('111/111/000'), gSvg('111/111/100'), gSvg('111/111/110')]),
    opts: [gSvg('111/100/000'), gSvg('111/000/000'), gSvg('110/100/000'), gSvg('111/111/111')],
    explain: 'Chuỗi tăng đều 1 ô mỗi bước (5, 6, 7, 8 ô) ⇒ hình đứng trước phải có 4 ô: hàng đầu đủ 3 ô cộng 1 ô đầu hàng giữa.',
  }),
  figQ({
    id: 'back2', d: 3, q: 'Nếu chuỗi này kéo dài về phía trước thì hình đứng TRƯỚC hình đầu tiên là gì?',
    fig: figRow([iqSvg(rot(ARROW, 90)), iqSvg(rot(ARROW, 180)), iqSvg(rot(ARROW, 270))]),
    opts: [iqSvg(rot(ARROW, 0)), iqSvg(rot(ARROW, 180)), iqSvg(rot(ARROW, 90)), iqSvg(rot(ARROW, 45))],
    explain: 'Mỗi bước xoay thuận 90°; lùi lại một bước từ 90° là 0° (mũi tên chỉ lên).',
  }),
  // So sánh có ĐIỀU KIỆN SỐ HỌC: nhiều hơn mẫu đúng 2 ô
  { id: 'plus2', category: '🖼️ Suy luận hình', d: 2, q: 'Hình nào có số ô được tô NHIỀU HƠN hình mẫu đúng 2 ô?',
    fig: figRow([gSvg('110/010/000')]) +
      figRow([numCell(1), numCell(2), numCell(3), numCell(4)]) +
      figRow([gSvg('110/010/001'), gSvg('111/110/000'), gSvg('100/010/000'), gSvg('111/111/100')]),
    options: ['Hình 1', 'Hình 2', 'Hình 3', 'Hình 4'], answer: 1,
    explain: 'Hình mẫu tô 3 ô nên cần hình tô 5 ô: hình 1 có 4, hình 2 có 5, hình 3 có 2, hình 4 có 7.' },
  // Bảng 4 cột × 2 hàng
  figQ({
    id: 'grid42', d: 2, q: 'Ô dấu ? trong bảng 4×2 là hình nào?',
    fig: figGrid([iqSvg(dots(1)), iqSvg(dots(2)), iqSvg(dots(3)), iqSvg(dots(4)),
      iqSvg(dots(2)), iqSvg(dots(4)), iqSvg(dots(6)), '?'], 4),
    opts: [iqSvg(dots(8)), iqSvg(dots(5)), iqSvg(dots(7)), iqSvg(dots(9))],
    explain: 'Hàng dưới luôn gấp ĐÔI hàng trên theo từng cột ⇒ ô cuối là 4 × 2 = 8 chấm.',
  }),
  gOpQ('gx36', 3, '110/101/010', '011/010/101', 'xor', 'XOR: giữ ô chỉ một bên tô, bỏ ô cả hai cùng tô.'),
  { id: 'nm32', category: '🖼️ Suy luận hình', d: 2, q: 'Bảng 4×2: số ở ô dấu ? là bao nhiêu?',
    fig: figGrid([numCell(1), numCell(2), numCell(3), numCell(4), numCell(1), numCell(4), numCell(9), '?'], 4),
    options: ['12', '16', '20', '25'], answer: 1,
    explain: 'Hàng dưới là BÌNH PHƯƠNG của hàng trên: 1, 4, 9, rồi 4² = 16.' },
  { id: 'dl98', category: '🧠 Logic', d: 3, q: 'Trong một cuộc thi 20 câu, đúng được +5 điểm, sai bị −2 điểm. Một bạn làm hết 20 câu và được 58 điểm. Bạn đó làm đúng mấy câu?', options: ['12', '13', '14', '15'], answer: 2,
    explain: 'Gọi số câu đúng là x: 5x − 2(20 − x) = 58 ⇒ 7x = 98 ⇒ x = 14.' },
  { id: 'dl99', category: '🎲 Xác suất', d: 3, q: 'Ba người bốc thăm lần lượt từ 3 lá (1 lá trúng, không hoàn lại). Ai có lợi thế nhất?', options: ['Người bốc đầu', 'Người bốc thứ hai', 'Người bốc cuối', 'Cả ba như nhau'], answer: 3,
    explain: 'Xác suất trúng của mỗi người đều là 1/3 — thứ tự bốc KHÔNG ảnh hưởng (người sau bù lại bằng việc số lá còn ít hơn).' },
  { id: 'dl100', category: '➗ Toán nhanh', d: 2, q: 'Một bảng dữ liệu 2 triệu dòng, mỗi dòng 500 byte. Nếu nén còn 40% thì tiết kiệm bao nhiêu dung lượng?', options: ['400MB', '600MB', '1GB', '1,4GB'], answer: 1,
    explain: 'Gốc: 2.000.000 × 500 byte = 1.000MB. Nén còn 40% (400MB) ⇒ tiết kiệm 600MB.' },
  { id: 'n28-1', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 1, 2, 6, 15, 31, ?', options: ['48', '52', '56', '62'], answer: 2,
    explain: 'Khoảng cách là 1, 4, 9, 16 (bình phương) và tiếp theo là 25 ⇒ 31 + 25 = 56.' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #27 =====
  // Đếm ô của KẾT QUẢ phép chồng lưới (không vẽ ra, phải tính trong đầu)
  { id: 'opcount1', category: '🖼️ Suy luận hình', d: 3, q: 'Nếu chồng HAI lưới bên dưới lại (giữ mọi ô được tô) thì hình kết quả có bao nhiêu ô?',
    fig: figRow([gSvg('110/010/001'), gSvg('011/010/100')]),
    options: ['4 ô', '5 ô', '6 ô', '7 ô'], answer: 2,
    explain: 'Hợp từng hàng: 110 ∪ 011 = 111 (3 ô), 010 ∪ 010 = 010 (1 ô), 001 ∪ 100 = 101 (2 ô) ⇒ tổng 6 ô.' },
  { id: 'opcount2', category: '🖼️ Suy luận hình', d: 3, q: 'Có bao nhiêu ô được tô ở lưới TRÁI mà KHÔNG được tô ở lưới PHẢI?',
    fig: figRow([gSvg('111/110/010'), gSvg('101/010/011')]),
    options: ['1 ô', '2 ô', '3 ô', '4 ô'], answer: 1,
    explain: 'Lấy các ô của lưới trái rồi bỏ đi những ô lưới phải cũng tô (phép trừ): còn 2 ô.' },
  // Đối chiếu phép xoay với 4 lựa chọn
  figQ({
    id: 'match180', d: 2, q: 'Xoay hình mẫu 180° thì trùng khớp với hình nào?',
    fig: figRow([gSvg('110/100/000')]),
    opts: [gSvg(gRot(gRot('110/100/000'))), gSvg(gRot('110/100/000')), gSvg('110/100/000'), gSvg(gInv('110/100/000'))],
    explain: 'Xoay 180° = lật cả trên↔dưới và trái↔phải: khối ở góc trên-trái chuyển hẳn xuống góc dưới-phải.',
  }),
  gOpQ('gx37', 2, '010/110/101', '110/011/001', 'and', 'Giao hai lưới: chỉ giữ ô cả hai cùng tô.'),
  figQ({
    id: 'colmx', d: 3, q: 'Ô dấu ? là hình nào? (mỗi CỘT xoay NGƯỢC chiều kim đồng hồ khi đi xuống)',
    fig: figGrid([
      iqSvg(rot(ELL, 0)), iqSvg(rot(ELL, 90)), iqSvg(rot(ELL, 180)),
      iqSvg(rot(ELL, 270)), iqSvg(rot(ELL, 0)), iqSvg(rot(ELL, 90)),
      iqSvg(rot(ELL, 180)), iqSvg(rot(ELL, 270)), '?']),
    opts: [iqSvg(rot(ELL, 0)), iqSvg(rot(ELL, 90)), iqSvg(rot(ELL, 180)), iqSvg(rot(ELL, 270))],
    explain: 'Đi xuống mỗi ô xoay ngược 90° (tức trừ 90°): cột cuối là 180° → 90° → 0°.',
  }),
  { id: 'nm33', category: '🖼️ Suy luận hình', d: 3, q: 'Số ở ô dấu ? là bao nhiêu?',
    fig: figGrid([numCell(6), numCell(10), numCell(8), numCell(4), numCell(12), numCell(8), numCell(9), numCell(15), '?'], 3),
    options: ['10', '11', '12', '13'], answer: 2,
    explain: 'Cột 3 là TRUNG BÌNH CỘNG của hai cột đầu: (6+10)/2 = 8, (4+12)/2 = 8 ⇒ (9+15)/2 = 12.' },
  { id: 'dl101', category: '🧠 Logic', d: 3, q: 'Một cái bể có vòi vào đầy sau 4 giờ, vòi xả cạn sau 6 giờ. Mở CẢ HAI khi bể rỗng thì bao lâu đầy?', options: ['5 giờ', '10 giờ', '12 giờ', 'Không bao giờ đầy'], answer: 2,
    explain: 'Mỗi giờ: 1/4 − 1/6 = 1/12 bể ⇒ cần 12 giờ (vẫn đầy được vì vòi vào mạnh hơn).' },
  { id: 'dl102', category: '🧠 Logic', d: 2, q: 'Hôm nay là ngày 13, thứ Sáu. Ngày 13 tháng sau (tháng có 30 ngày) là thứ mấy?', options: ['Thứ Bảy', 'Chủ Nhật', 'Thứ Hai', 'Thứ Ba'], answer: 1,
    explain: '30 ngày = 4 tuần dư 2 ⇒ đếm thêm 2 ngày từ thứ Sáu là Chủ Nhật.' },
  { id: 'dl103', category: '➗ Toán nhanh', d: 3, q: 'Hệ thống 3 dịch vụ nối tiếp, mỗi dịch vụ uptime 99%. Uptime của cả chuỗi là bao nhiêu?', options: ['97%', '97,03%', '99%', '99,7%'], answer: 1,
    explain: '0,99³ = 0,970299 ≈ 97,03% — càng nhiều mắt xích nối tiếp thì độ tin cậy càng giảm.' },
  { id: 'n29-1', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 2, 4, 10, 28, 82, ?', options: ['164', '226', '244', '246'], answer: 2,
    explain: 'Quy luật × 3 − 2: 82 × 3 − 2 = 244.' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #28 =====
  // Phép LẬT THEO ĐƯỜNG CHÉO (transpose) — phép biến hình mới, khác xoay và lật gương
  figQ({
    id: 'transp1', d: 3, q: 'Lật hình bên dưới qua ĐƯỜNG CHÉO CHÍNH (hàng thành cột) được hình nào?',
    fig: figRow([gSvg('110/010/100')]),
    opts: [gSvg(gFlip(gRot('110/010/100'))), gSvg('110/010/100'), gSvg(gRot('110/010/100')), gSvg(gFlip('110/010/100'))],
    explain: 'Lật qua đường chéo chính: ô ở (hàng r, cột c) đổi sang (hàng c, cột r) — khác hẳn xoay 90° hay lật gương.',
  }),
  // Đếm HÌNH CHỮ NHẬT tạo bởi các ô được tô
  { id: 'rect1', category: '🖼️ Suy luận hình', d: 3, q: 'Các ô được tô bên dưới tạo thành bao nhiêu HÌNH CHỮ NHẬT (mọi kích thước, kể cả hình vuông)?',
    fig: figRow([gSvg('110/110/000')], 'lg'),
    options: ['4', '6', '9', '12'], answer: 2,
    explain: '4 hình 1×1 + 2 hình 1×2 (hai hàng) + 2 hình 2×1 (hai cột) + 1 hình 2×2 = 9.' },
  // Hai chuỗi song song, mỗi chuỗi một quy luật — chọn CẶP ô cuối
  figQ({
    id: 'twoseq', d: 3, q: 'Hai hàng là hai chuỗi ĐỘC LẬP. Cặp hình điền vào hai ô ? (hàng trên trước, hàng dưới sau) là gì?',
    fig: figRow([gSvg('100/000/000'), gSvg('110/000/000'), gSvg('111/000/000'), '?']) +
      figRow([iqSvg(rot(ARROW, 0)), iqSvg(rot(ARROW, 90)), iqSvg(rot(ARROW, 180)), '?']),
    opts: [
      `<span style="display:flex;gap:6px">${gSvg('111/100/000')}${iqSvg(rot(ARROW, 270))}</span>`,
      `<span style="display:flex;gap:6px">${iqSvg(rot(ARROW, 270))}${gSvg('111/100/000')}</span>`,
      `<span style="display:flex;gap:6px">${gSvg('111/110/000')}${iqSvg(rot(ARROW, 270))}</span>`,
      `<span style="display:flex;gap:6px">${gSvg('111/100/000')}${iqSvg(rot(ARROW, 0))}</span>`,
    ],
    explain: 'Hàng trên tô thêm 1 ô mỗi bước (1, 2, 3, 4 ô); hàng dưới xoay 90° mỗi bước (0°, 90°, 180°, 270°). Phải đúng CẢ HAI và đúng thứ tự.',
  }),
  gOpQ('gx38', 2, '011/110/010', '110/010/110', 'or', 'Hợp hai lưới: gộp mọi ô được tô.'),
  { id: 'nm34', category: '🖼️ Suy luận hình', d: 2, q: 'Bảng 3×2: số ở ô dấu ? là bao nhiêu?',
    fig: figGrid([numCell(4), numCell(7), numCell(9), numCell(9), numCell(7), '?'], 3),
    options: ['4', '5', '7', '9'], answer: 0,
    explain: 'Hàng dưới là hàng trên viết ĐẢO NGƯỢC (9, 7, 4) ⇒ ô cuối là 4.' },
  { id: 'dl104', category: '🧠 Logic', d: 3, q: 'Có 5 mắt xích rời, mỗi mắt 3 vòng. Mở 1 vòng tốn 2k, hàn lại tốn 3k. Nối 5 mắt thành 1 dây kín rẻ nhất hết bao nhiêu?', options: ['15k', '20k', '25k', '30k'], answer: 0,
    explain: 'Tháo hẳn 1 mắt (3 vòng) ra làm khớp nối 4 mắt còn lại thành vòng kín: 3 × (2k + 3k) = 15k, rẻ hơn mở 5 vòng riêng lẻ.' },
  { id: 'dl105', category: '🎲 Xác suất', d: 2, q: 'Một hộp có 10 sản phẩm, 2 cái lỗi. Lấy ngẫu nhiên 1 cái, xác suất KHÔNG lỗi là bao nhiêu?', options: ['1/5', '2/5', '3/5', '4/5'], answer: 3,
    explain: '8 sản phẩm tốt trên tổng 10 ⇒ 8/10 = 4/5.' },
  { id: 'dl106', category: '➗ Toán nhanh', d: 3, q: 'Một API p99 = 800ms, p50 = 100ms. Gọi song song 10 request và CHỜ TẤT CẢ, thời gian chờ có xu hướng gần với giá trị nào?', options: ['100ms', '200ms', '800ms', '8 giây'], answer: 2,
    explain: 'Chờ tất cả nghĩa là chờ request CHẬM NHẤT; với 10 request thì khả năng cao có một cái rơi vào đuôi p90–p99 ⇒ gần 800ms.' },
  { id: 'n30-1', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 3, 6, 12, 21, 33, ?', options: ['45', '48', '51', '54'], answer: 1,
    explain: 'Khoảng cách tăng đều 3, 6, 9, 12, 15 ⇒ 33 + 15 = 48.' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #29 =====
  // Nhảy cóc: cho 4 hình đầu, hỏi hình thứ SÁU (phải chạy quy luật thêm 2 bước)
  figQ({
    id: 'skip1', d: 3, q: 'Chuỗi tiếp tục theo cùng quy luật. Hình thứ SÁU sẽ là gì?',
    fig: figRow([iqSvg(rot(FLAG, 0)), iqSvg(rot(FLAG, 90)), iqSvg(rot(FLAG, 180)), iqSvg(rot(FLAG, 270))]),
    opts: [iqSvg(rot(FLAG, 90)), iqSvg(rot(FLAG, 0)), iqSvg(rot(FLAG, 180)), iqSvg(rot(FLAG, 270))],
    explain: 'Xoay 90° mỗi bước: hình 5 là 0° (360°), hình 6 là 90°.',
  }),
  figQ({
    id: 'skip2', d: 3, q: 'Chuỗi tiếp tục theo cùng quy luật. Hình thứ SÁU sẽ là gì?',
    fig: figRow([gSvg('100/000/000'), gSvg('110/000/000'), gSvg('111/000/000'), gSvg('111/100/000')]),
    opts: [gSvg('111/111/000'), gSvg('111/110/000'), gSvg('111/111/100'), gSvg('111/111/110')],
    explain: 'Mỗi bước thêm 1 ô: hình 5 có 5 ô, hình 6 có 6 ô (hai hàng đầu tô kín).',
  }),
  // Chọn CẶP có cùng QUAN HỆ với cặp mẫu (analogy bằng hình, dạng chọn cặp)
  figQ({
    id: 'relpair1', d: 3, q: 'Cặp mẫu bên dưới có một quan hệ biến đổi. Cặp nào dưới đây có QUAN HỆ GIỐNG như vậy?',
    fig: figRow([gSvg('110/100/000'), numCell('→'), gSvg(gInv('110/100/000'))]),
    opts: [
      `<span style="display:flex;gap:6px">${gSvg('110/010/000')}${gSvg(gInv('110/010/000'))}</span>`,
      `<span style="display:flex;gap:6px">${gSvg('110/010/000')}${gSvg(gRot('110/010/000'))}</span>`,
      `<span style="display:flex;gap:6px">${gSvg('110/010/000')}${gSvg(gFlip('110/010/000'))}</span>`,
      `<span style="display:flex;gap:6px">${gSvg('110/010/000')}${gSvg('110/010/000')}</span>`,
    ],
    explain: 'Quan hệ của cặp mẫu là ĐẢO NGƯỢC (ô tô ↔ ô trống). Chỉ một cặp lựa chọn cũng là đảo ngược; các cặp kia là xoay, lật gương hoặc giữ nguyên.',
  }),
  gOpQ('gx39', 3, '101/011/010', '110/101/011', 'and', 'Giao hai lưới: chỉ giữ ô cả hai cùng tô.'),
  // Hai thuộc tính đi NGƯỢC CHIỀU nhau
  figQ({
    id: 'invseq', d: 3, q: 'Hình tiếp theo của chuỗi là gì? (hai thuộc tính biến thiên NGƯỢC CHIỀU)',
    fig: figRow([iqSvg(polyShape(3) + dots(4)), iqSvg(polyShape(4) + dots(3)), iqSvg(polyShape(5) + dots(2)), '?']),
    opts: [iqSvg(polyShape(6) + dots(1)), iqSvg(polyShape(6) + dots(3)), iqSvg(polyShape(5) + dots(1)), iqSvg(polyShape(7) + dots(1))],
    explain: 'Số cạnh TĂNG 1 mỗi bước (3, 4, 5, 6) trong khi số chấm GIẢM 1 (4, 3, 2, 1).',
  }),
  { id: 'nm35', category: '🖼️ Suy luận hình', d: 3, q: 'Số ở ô dấu ? là bao nhiêu?',
    fig: figGrid([numCell(6), numCell(2), numCell(3), '?', numCell(4), numCell(3), numCell(20), numCell(5), numCell(4)], 3),
    options: ['8', '10', '12', '16'], answer: 2,
    explain: 'Cột 1 ÷ cột 2 = cột 3 (6÷2 = 3, 20÷5 = 4) ⇒ hàng giữa: ? ÷ 4 = 3 ⇒ ? = 12.' },
  { id: 'dl107', category: '🧠 Logic', d: 3, q: 'Hai người chơi: lần lượt lấy 1 hoặc 2 que từ đống 15 que, ai lấy que CUỐI CÙNG thì THUA. Người đi trước nên lấy mấy que?', options: ['1 que', '2 que', 'Lấy bao nhiêu cũng thắng', 'Đi trước chắc chắn thua'], answer: 1,
    explain: 'Muốn đối thủ phải lấy que cuối, hãy để lại cho họ 1 que sau lượt của mình ⇒ giữ số que còn lại chia 3 dư 1. 15 − 2 = 13 (13 chia 3 dư 1) ⇒ lấy 2 que.' },
  { id: 'dl108', category: '➗ Toán nhanh', d: 2, q: 'Một trang tải 2,5MB, người dùng dùng 4G tốc độ 10Mbps (megaBIT/giây). Tải xong mất khoảng bao lâu?', options: ['0,25 giây', '1 giây', '2 giây', '20 giây'], answer: 2,
    explain: '2,5MB = 20 megabit (nhân 8) ⇒ 20 / 10 = 2 giây. Nhớ phân biệt MB (byte) với Mb (bit).' },
  { id: 'dl109', category: '🎲 Xác suất', d: 3, q: 'Gieo xúc xắc 2 lần. Xác suất ÍT NHẤT một lần ra mặt 6 là bao nhiêu?', options: ['1/6', '1/3', '11/36', '2/6'], answer: 2,
    explain: '1 − (5/6)² = 1 − 25/36 = 11/36 (không phải cộng 1/6 + 1/6).' },
  { id: 'n31-1', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 4, 7, 12, 19, 28, ?', options: ['37', '38', '39', '40'], answer: 2,
    explain: 'Khoảng cách là các số lẻ tăng dần 3, 5, 7, 9, 11 ⇒ 28 + 11 = 39.' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #30 =====
  { id: 'xorcount', category: '🖼️ Suy luận hình', d: 3, q: 'Nếu chồng hai lưới theo quy tắc ⊕ (chỉ giữ ô mà ĐÚNG MỘT bên tô) thì kết quả có bao nhiêu ô?',
    fig: figRow([gSvg('110/011/010'), gSvg('011/010/110')]),
    options: ['2 ô', '3 ô', '4 ô', '5 ô'], answer: 2,
    explain: 'XOR từng hàng: 110⊕011 = 101 (2 ô), 011⊕010 = 001 (1 ô), 010⊕110 = 100 (1 ô) ⇒ tổng 4 ô.' },
  figQ({
    id: 'cyc3', d: 3, q: 'Chuỗi lặp tuần hoàn với chu kỳ 5 hình. Hình thứ 23 sẽ là hình nào?',
    fig: figRow([sCell('c', 2), sCell('s', 2), sCell('t', 2), sCell('d', 2), sCell('h', 2)]),
    opts: [sCell('t', 2), sCell('c', 2), sCell('s', 2), sCell('h', 2)],
    explain: '23 chia 5 dư 3 ⇒ hình thứ 23 trùng hình thứ 3 trong chu kỳ (tam giác).',
  }),
  { id: 'twomiss', category: '🖼️ Suy luận hình', d: 3, q: 'Chuỗi có hai chỗ trống. TỔNG số ô được tô của hai hình còn thiếu là bao nhiêu?',
    fig: figRow([gSvg('100/000/000'), gSvg('110/000/000'), '?', '?', gSvg('111/110/000')]),
    options: ['5', '7', '9', '11'], answer: 1,
    explain: 'Số ô tăng đều 1: 1, 2, 3, 4, 5 ⇒ hai hình thiếu có 3 và 4 ô, tổng 7.' },
  figQ({
    id: 'rotinv', d: 3, q: 'Xoay hình bên dưới 90° thuận chiều RỒI lật gương trái ↔ phải được hình nào? (thứ tự hai phép rất quan trọng)',
    fig: figRow([gSvg('110/010/001')]),
    opts: [gSvg(gFlip(gRot('110/010/001'))), gSvg(gRot(gFlip('110/010/001'))),
      gSvg(gRot('110/010/001')), gSvg(gFlip('110/010/001'))],
    explain: 'Xoay trước, lật sau. Một mồi nhử chính là làm NGƯỢC thứ tự (lật trước rồi xoay) — cho kết quả khác hẳn vì hai phép này không hoán đổi được.',
  }),
  gOpQ('gx40', 2, '111/100/011', '010/110/010', 'xor', 'XOR: bỏ ô trùng, giữ ô chỉ một bên tô.'),
  { id: 'nm36', category: '🖼️ Suy luận hình', d: 3, q: 'Số ở ô dấu ? (GÓC DƯỚI–TRÁI) là bao nhiêu?',
    fig: figGrid([numCell(3), numCell(5), numCell(15), numCell(4), numCell(6), numCell(24), '?', numCell(7), numCell(14)], 3),
    options: ['2', '3', '5', '7'], answer: 0,
    explain: 'Cột 3 = cột 1 × cột 2 (3×5 = 15, 4×6 = 24) ⇒ ? × 7 = 14 ⇒ ? = 2.' },
  { id: 'dl110', category: '🧠 Logic', d: 3, q: 'Có 8 đồng xu, 1 đồng GIẢ nhẹ hơn. Chỉ được cân 2 lần bằng cân thăng bằng. Lần cân ĐẦU nên chia thế nào?', options: ['4 – 4', '3 – 3 (để riêng 2)', '2 – 2 (để riêng 4)', '1 – 1 (để riêng 6)'], answer: 1,
    explain: 'Chia 3-3-2: nếu hai bên bằng nhau thì đồng giả nằm trong 2 đồng để riêng (cân 1 lần nữa là ra); nếu lệch thì lấy nhóm 3 nhẹ hơn rồi cân 1-1.' },
  { id: 'dl111', category: '➗ Toán nhanh', d: 2, q: 'Một team 5 người, mỗi người review 2 PR/ngày, mỗi PR cần 2 lượt review. Một ngày team duyệt xong tối đa bao nhiêu PR?', options: ['5 PR', '10 PR', '15 PR', '20 PR'], answer: 0,
    explain: 'Tổng lượt review mỗi ngày = 5 × 2 = 10; mỗi PR cần 2 lượt ⇒ 10 / 2 = 5 PR.' },
  { id: 'dl112', category: '🎲 Xác suất', d: 3, q: 'Một bài test có 4 câu trắc nghiệm, mỗi câu 4 lựa chọn. Đoán mò hết, xác suất đúng CẢ 4 là bao nhiêu?', options: ['1/16', '1/64', '1/256', '1/1024'], answer: 2,
    explain: '(1/4)⁴ = 1/256.' },
  { id: 'n32-1', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 6, 11, 21, 41, 81, ?', options: ['121', '141', '161', '162'], answer: 2,
    explain: 'Quy luật × 2 − 1: 81 × 2 − 1 = 161.' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #31 =====
  // Chuỗi XOR với MẶT NẠ CỐ ĐỊNH: mỗi bước chồng cùng một lưới ẩn
  figQ({
    id: 'mask1', d: 3, q: 'Mỗi bước, hình được chồng với CÙNG MỘT lưới ẩn theo quy tắc ⊕. Hình tiếp theo là gì?',
    fig: (() => {
      const m = '010/010/000';
      const a = '110/001/010', b = gOp(a, m, 'xor'), c = gOp(b, m, 'xor'), d = gOp(c, m, 'xor');
      return figRow([gSvg(a), gSvg(b), gSvg(c), gSvg(d), '?']);
    })(),
    opts: (() => {
      const m = '010/010/000';
      const a = '110/001/010', b = gOp(a, m, 'xor'), c = gOp(b, m, 'xor'), d = gOp(c, m, 'xor'), e = gOp(d, m, 'xor');
      return [gSvg(e), gSvg(d), gSvg(gInv(e)), gSvg(gRot(e))];
    })(),
    explain: 'Cùng một mặt nạ được XOR mỗi bước nên chuỗi LẶP LẠI sau 2 bước: hình 1 = hình 3 = hình 5.',
  }),
  { id: 'addto9', category: '🖼️ Suy luận hình', d: 1, q: 'Cần tô thêm bao nhiêu ô nữa thì lưới bên dưới ĐẦY cả 9 ô?',
    fig: figRow([gSvg('110/011/010')], 'lg'),
    options: ['3 ô', '4 ô', '5 ô', '6 ô'], answer: 1,
    explain: 'Lưới đang tô 5 ô ⇒ còn thiếu 9 − 5 = 4 ô.' },
  { id: 'countsym', category: '🖼️ Suy luận hình', d: 3, q: 'Trong 4 hình dưới đây, có bao nhiêu hình ĐỐI XỨNG qua trục dọc?',
    fig: figRow([gSvg('010/111/010'), gSvg('110/010/001'), gSvg('101/010/101'), gSvg('100/110/001')]),
    options: ['1 hình', '2 hình', '3 hình', '4 hình'], answer: 1,
    explain: 'Hình dấu cộng và hình bốn góc + tâm đối xứng qua trục dọc; hai hình còn lại thì không ⇒ 2 hình.' },
  gOpQ('gx41', 2, '011/101/010', '110/011/110', 'or', 'Hợp hai lưới: gộp mọi ô được tô của cả hai hình.'),
  { id: 'nm37', category: '🖼️ Suy luận hình', d: 3, q: 'Số ở ô dấu ? là bao nhiêu?',
    fig: figGrid([numCell(2), numCell(7), numCell(5), numCell(9), '?', numCell(4), numCell(6), numCell(11), numCell(5)], 3),
    options: ['12', '13', '14', '15'], answer: 1,
    explain: 'Cột 2 − cột 1 = cột 3 (7−2 = 5, 11−6 = 5) ⇒ hàng giữa: ? − 9 = 4 ⇒ ? = 13.' },
  { id: 'dl113', category: '🧠 Logic', d: 3, q: 'Một người nói: "Câu tôi đang nói là câu nói dối." Câu này thế nào?', options: ['Chắc chắn là câu nói đúng', 'Chắc chắn là câu nói sai', 'Là NGHỊCH LÝ, không gán được', 'Thiếu dữ kiện để kết luận'], answer: 2,
    explain: 'Nghịch lý người nói dối: nếu đúng thì theo nội dung nó phải sai, nếu sai thì nó lại đúng ⇒ không thể gán đúng/sai.' },
  { id: 'dl114', category: '🧠 Logic', d: 2, q: 'Ba cái máy in cùng in xong 300 trang trong 10 phút. Hỏi 5 máy in như vậy in 500 trang mất bao lâu?', options: ['6 phút', '10 phút', '12 phút', '15 phút'], answer: 1,
    explain: 'Mỗi máy in 10 trang/phút. 5 máy in 50 trang/phút ⇒ 500 / 50 = 10 phút.' },
  { id: 'dl115', category: '➗ Toán nhanh', d: 3, q: 'Chi phí lưu trữ 0,023 USD/GB/tháng. Lưu 5TB trong 1 năm hết khoảng bao nhiêu? (1TB = 1000GB)', options: ['115 USD', '460 USD', '1.380 USD', '13.800 USD'], answer: 2,
    explain: '5TB = 5.000GB ⇒ mỗi tháng 5.000 × 0,023 = 115 USD ⇒ một năm 115 × 12 = 1.380 USD.' },
  { id: 'n33-1', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 5, 6, 9, 14, 21, ?', options: ['28', '29', '30', '31'], answer: 2,
    explain: 'Khoảng cách là các số lẻ 1, 3, 5, 7, 9 ⇒ 21 + 9 = 30.' },
  { id: 'n33-2', category: '🔢 Dãy số', d: 2, q: 'Số tiếp theo: 128, 64, 32, 16, ?', options: ['4', '8', '12', '14'], answer: 1,
    explain: 'Mỗi số bằng một nửa số trước: 16 / 2 = 8.' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #32 =====
  // Ghép KHÔNG CHỒNG ô: chỉ một lựa chọn rời hoàn toàn với hình mẫu
  figQ({
    id: 'nofit1', d: 3, q: 'Đặt chồng lên hình mẫu bên dưới, hình nào KHÔNG đè lên bất kỳ ô nào đã tô?',
    fig: figRow([gSvg('110/100/000')]),
    opts: [gSvg('001/011/000'), gSvg('100/000/001'), gSvg('010/100/010'), gSvg('110/000/000')],
    explain: 'Hình mẫu chiếm ô (0,0), (0,1) và (1,0). Chỉ một lựa chọn nằm hoàn toàn ở các ô còn trống; ba hình kia đều đè lên ít nhất một ô đã tô.',
  }),
  { id: 'count3', category: '🖼️ Suy luận hình', d: 2, q: 'Trong 6 hình dưới đây, có bao nhiêu hình được tô ĐÚNG 3 ô?',
    fig: figRow([gSvg('110/010/000'), gSvg('111/000/000'), gSvg('110/110/000'), gSvg('100/010/001'), gSvg('111/100/000'), gSvg('010/010/000')]),
    options: ['2 hình', '3 hình', '4 hình', '5 hình'], answer: 1,
    explain: 'Đếm từng hình: 3, 3, 4, 3, 4, 2 ô ⇒ có 3 hình đúng 3 ô.' },
  // Lưới "ma phương": tổng số ô mỗi HÀNG và mỗi CỘT đều bằng nhau
  figQ({
    id: 'magicfig', d: 3, q: 'Ô dấu ? là hình nào? (tổng số ô của mỗi HÀNG và mỗi CỘT đều bằng nhau)',
    fig: figGrid([gSvg('100/000/000'), gSvg('110/000/000'), gSvg('111/000/000'),
      gSvg('111/000/000'), gSvg('100/000/000'), gSvg('110/000/000'),
      gSvg('110/000/000'), gSvg('111/000/000'), '?']),
    opts: [gSvg('100/000/000'), gSvg('110/000/000'), gSvg('111/000/000'), gSvg('111/100/000')],
    explain: 'Mỗi hàng và mỗi cột phải có tổng 6 ô (1+2+3). Hàng cuối đã có 2 + 3 = 5 ⇒ ô thiếu là 1 ô; cột cuối cũng khớp: 3 + 2 + 1 = 6.',
  }),
  figQ({
    id: 'sqdown', d: 2, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([gSvg('111/111/111'), gSvg('110/110/000'), gSvg('100/000/000'), '?']),
    opts: [gSvg('000/000/000'), gSvg('100/000/000'), gSvg('110/000/000'), gSvg('111/000/000')],
    explain: 'Số ô là bình phương giảm dần 9, 4, 1 ⇒ tiếp theo là 0 ô (lưới trống).',
  }),
  gOpQ('gx42', 2, '101/110/001', '011/100/101', 'and', 'Giao hai lưới: chỉ giữ ô cả hai cùng tô.'),
  { id: 'nm38', category: '🖼️ Suy luận hình', d: 3, q: 'Số ở ô dấu ? là bao nhiêu? (tổng mỗi hàng và mỗi cột đều bằng 15)',
    fig: figGrid([numCell(8), numCell(1), numCell(6), numCell(3), numCell(5), numCell(7), numCell(4), '?', numCell(2)], 3),
    options: ['6', '8', '9', '10'], answer: 2,
    explain: 'Ma phương 3×3 quen thuộc: hàng cuối 4 + ? + 2 = 15 ⇒ ? = 9 (cột giữa cũng thành 1 + 5 + 9 = 15).' },
  { id: 'dl116', category: '🧠 Logic', d: 3, q: 'Một tù nhân phải chọn 1 trong 2 cửa: một cửa dẫn tới tự do, một cửa tới cái chết. Hai lính gác, một luôn nói thật, một luôn nói dối, bạn chỉ được hỏi MỘT câu. Hỏi gì?', options: ['Hỏi thẳng "cửa nào dẫn tới tự do?" rồi đi cửa đó', 'Hỏi "người kia sẽ chỉ cửa nào?" rồi đi cửa CÒN LẠI', 'Hỏi "anh có phải người nói thật không?"', 'Hỏi "cửa nào dẫn tới cái chết?" rồi đi cửa đó'], answer: 1,
    explain: 'Câu hỏi lồng khiến CẢ HAI lính gác đều chỉ vào cửa chết (một người nói dối về câu trả lời thật, người kia nói thật về câu trả lời dối) ⇒ cứ chọn cửa còn lại.' },
  { id: 'dl117', category: '➗ Toán nhanh', d: 2, q: 'Một hàm chạy 50ms, được gọi 3 lần lồng nhau (tuần tự). Nếu tối ưu còn 30ms mỗi lần thì tiết kiệm bao nhiêu?', options: ['20ms', '40ms', '60ms', '90ms'], answer: 2,
    explain: '3 × 50 = 150ms xuống còn 3 × 30 = 90ms ⇒ tiết kiệm 60ms.' },
  { id: 'dl118', category: '🎲 Xác suất', d: 3, q: 'Một túi có 4 bi trắng, 6 bi đen. Lấy lần lượt 2 bi không hoàn lại. Xác suất bi thứ HAI là trắng bằng bao nhiêu?', options: ['1/5', '2/5', '4/9', '1/2'], answer: 1,
    explain: 'Không cần biết bi đầu là gì — theo tính đối xứng, xác suất bi thứ hai trắng vẫn đúng bằng tỉ lệ ban đầu 4/10 = 2/5.' },
  { id: 'n34-1', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 2, 3, 10, 15, 26, ?', options: ['30', '35', '37', '42'], answer: 1,
    explain: 'Hai dãy đan xen: 2, 10, 26 (khoảng cách 8, 16) và 3, 15, ? (khoảng cách 12, 20) ⇒ 15 + 20 = 35.' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #33 =====
  // Cho 3 phép xoay, tìm phép xoay THỨ TƯ còn thiếu
  figQ({
    id: 'missrot', d: 3, q: 'Ba hình dưới đây là ba phép xoay của cùng một hình. Phép xoay thứ TƯ còn thiếu là hình nào?',
    fig: figRow([gSvg('110/010/000'), gSvg(gRot('110/010/000')), gSvg(gRot(gRot(gRot('110/010/000'))))]),
    opts: [gSvg(gRot(gRot('110/010/000'))), gSvg(gFlip('110/010/000')), gSvg(gInv('110/010/000')), gSvg('110/010/000')],
    explain: 'Bốn phép xoay là 0°, 90°, 180°, 270°. Đề đã cho 0°, 90° và 270° ⇒ thiếu 180°.',
  }),
  // Chuỗi có Ô CỐ ĐỊNH ở tâm, phần còn lại xoay quanh
  figQ({
    id: 'fix1', d: 3, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([gSvg('110/010/000'), gSvg('001/011/000'), gSvg('000/010/011'), '?']),
    opts: [gSvg('000/110/100'), gSvg('110/010/000'), gSvg('001/011/000'), gSvg('010/010/010')],
    explain: 'Ô TÂM luôn được tô; cặp ô còn lại xoay 90° thuận chiều quanh tâm mỗi bước: góc trên-trái → góc trên-phải → góc dưới-phải → góc dưới-trái.',
  }),
  gOpQ('gx43', 3, '011/111/100', '110/010/011', 'xor', 'XOR: bỏ ô trùng nhau, giữ ô chỉ một bên tô.'),
  { id: 'nm39', category: '🖼️ Suy luận hình', d: 3, q: 'Số ở ô dấu ? là bao nhiêu?',
    fig: figGrid([numCell(7), numCell(8), numCell(5), numCell(6), numCell(9), numCell(5), numCell(8), numCell(4), '?'], 3),
    options: ['2', '4', '12', '32'], answer: 0,
    explain: 'Cột 3 = (cột 1 + cột 2) lấy CHỮ SỐ HÀNG ĐƠN VỊ: 7+8 = 15 → 5, 6+9 = 15 → 5 ⇒ 8+4 = 12 → 2.' },
  { id: 'cf20', category: '🖼️ Suy luận hình', d: 2, q: 'Các ô được tô bên dưới tạo thành bao nhiêu HÌNH CHỮ NHẬT (mọi kích thước)?',
    fig: figRow([gSvg('111/111/000')], 'lg'),
    options: ['6', '9', '12', '18'], answer: 3,
    explain: 'Khối 2 hàng × 3 cột: chọn 2 trong 3 đường ngang × chọn 2 trong 4 đường dọc = 3 × 6 = 18.' },
  { id: 'dl119', category: '🧠 Logic', d: 3, q: 'Có 3 công tắc A, B, C và 3 bóng đèn nhưng dây bị lẫn. Bật A trong 10 phút rồi tắt, bật B rồi vào phòng. Bóng NGUỘI và TẮT là của công tắc nào?', options: ['A', 'B', 'C', 'Không xác định được'], answer: 2,
    explain: 'Bóng đang sáng là của B; bóng tắt nhưng còn NÓNG là của A; bóng vừa tắt vừa nguội là của C.' },
  { id: 'dl120', category: '🧠 Logic', d: 2, q: 'Một con ốc sên leo giếng sâu 10m, ban ngày leo 3m, ban đêm tụt 2m. Mấy ngày thì lên tới miệng giếng?', options: ['5 ngày', '8 ngày', '9 ngày', '10 ngày'], answer: 1,
    explain: 'Mỗi ngày đêm chỉ lên thực 1m, nhưng NGÀY THỨ 8 ốc đang ở 7m và leo thêm 3m là chạm miệng giếng — không tụt nữa.' },
  { id: 'dl121', category: '➗ Toán nhanh', d: 3, q: 'Một batch job xử lý 1.000 bản ghi mất 4 phút. Nếu chia thành 4 luồng song song (không có chi phí điều phối) thì mất bao lâu?', options: ['1 phút', '2 phút', '4 phút', '16 phút'], answer: 0,
    explain: 'Chia đều 250 bản ghi mỗi luồng, chạy song song ⇒ 4 / 4 = 1 phút.' },
  { id: 'dl122', category: '🎲 Xác suất', d: 2, q: 'Một hộp có 3 bi đỏ và 5 bi xanh. Lấy 1 bi rồi bỏ lại, lấy tiếp 1 bi. Xác suất cả hai lần đều được bi đỏ?', options: ['3/64', '9/64', '3/28', '9/56'], answer: 1,
    explain: 'Có hoàn lại nên hai lần độc lập: (3/8) × (3/8) = 9/64.' },
  { id: 'n35-1', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 11, 19, 35, 67, ?', options: ['99', '113', '131', '134'], answer: 2,
    explain: 'Quy luật × 2 − 3: 67 × 2 − 3 = 131.' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #34 =====
  // Tìm CẶP hình giống nhau sau khi xoay
  { id: 'samepair', category: '🖼️ Suy luận hình', d: 3, q: 'Hai hình nào dưới đây thực chất là CÙNG MỘT hình (chỉ khác góc xoay)?',
    fig: figRow([numCell(1), numCell(2), numCell(3), numCell(4)]) +
      figRow([gSvg('110/010/000'), gSvg('101/010/000'), gSvg('000/010/011'), gSvg('111/001/000')]),
    options: ['Hình 1 và 2', 'Hình 1 và 3', 'Hình 2 và 4', 'Hình 3 và 4'], answer: 1,
    explain: 'Hình 3 chính là hình 1 xoay 180°; hai hình còn lại khác hẳn về hình dạng.' },
  // Đối xứng QUAY 90°: xoay một phần tư vẫn ra chính nó
  figQ({
    id: 'rot4sym', d: 3, q: 'Hình nào GIỮ NGUYÊN khi xoay 90°?',
    opts: [gSvg('101/000/101'), gSvg('110/010/000'), gSvg('111/000/000'), gSvg('100/110/001')],
    explain: 'Chỉ hình bốn góc là xoay một phần tư vẫn trùng khít chính nó (đối xứng quay bậc 4); các hình kia đổi hướng.',
  }),
  figQ({
    id: 'gapseq', d: 2, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([gSvg('100/000/000'), gSvg('110/000/000'), gSvg('111/100/000'), '?']),
    opts: [gSvg('111/111/100'), gSvg('111/110/000'), gSvg('111/111/000'), gSvg('111/111/110')],
    explain: 'Số ô là 1, 2, 4, 7 — khoảng cách tăng dần 1, 2, 3 ⇒ hình thứ tư có 7 ô.',
  }),
  gOpQ('gx44', 2, '100/111/010', '011/010/110', 'or', 'Hợp hai lưới: gộp mọi ô được tô của cả hai hình.'),
  { id: 'nm40', category: '🖼️ Suy luận hình', d: 2, q: 'Số ở ô dấu ? là bao nhiêu?',
    fig: figGrid([numCell(2), numCell(6), numCell(18), numCell(3), numCell(12), numCell(48), numCell(5), numCell(10), '?'], 3),
    options: ['15', '20', '25', '50'], answer: 1,
    explain: 'Mỗi hàng là cấp số nhân theo tỉ số riêng: 2→6→18 (×3), 3→12→48 (×4), 5→10→? (×2) ⇒ 20.' },
  { id: 'dl123', category: '🧠 Logic', d: 3, q: 'Bốn đội đá vòng tròn (mỗi cặp gặp nhau 1 lần), thắng 3 điểm, hòa 1, thua 0. Tổng điểm CẢ GIẢI nhiều nhất có thể là bao nhiêu?', options: ['12', '15', '18', '24'], answer: 2,
    explain: 'Có C(4,2) = 6 trận; mỗi trận sinh 3 điểm nếu có đội thắng (hòa chỉ sinh 2) ⇒ tối đa 6 × 3 = 18 điểm.' },
  { id: 'dl124', category: '🧠 Logic', d: 2, q: 'Một người có 5 chiếc áo, 4 quần và 2 đôi giày. Có bao nhiêu cách phối đồ khác nhau?', options: ['11', '20', '40', '80'], answer: 2,
    explain: 'Nhân các lựa chọn độc lập: 5 × 4 × 2 = 40 cách.' },
  { id: 'dl125', category: '➗ Toán nhanh', d: 3, q: 'Bảng 10 triệu dòng, mỗi ngày thêm 2%. Sau bao lâu thì kích thước tăng GẤP ĐÔI (xấp xỉ)?', options: ['15 ngày', '25 ngày', '35 ngày', '50 ngày'], answer: 2,
    explain: 'Quy tắc 70: thời gian nhân đôi ≈ 70 / tốc độ tăng (%) = 70 / 2 = 35 ngày.' },
  { id: 'dl126', category: '🎲 Xác suất', d: 3, q: 'Ba người chơi oẳn tù tì (kéo–búa–bao). Xác suất cả ba ra CÙNG một thứ là bao nhiêu?', options: ['1/27', '1/9', '1/3', '3/27'], answer: 1,
    explain: 'Người đầu ra gì cũng được; hai người sau phải trùng: (1/3) × (1/3) = 1/9.' },
  { id: 'n36-1', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 3, 8, 18, 38, 78, ?', options: ['118', '148', '158', '168'], answer: 2,
    explain: 'Quy luật × 2 + 2: 78 × 2 + 2 = 158.' },

  // ===== ĐỢT BỔ SUNG TỰ ĐỘNG #35 =====
  // Hình mẫu sau khi XOÁ ĐÚNG MỘT ô
  figQ({
    id: 'del1', d: 2, q: 'Hình nào là hình mẫu bên dưới sau khi XOÁ ĐÚNG MỘT ô?',
    fig: figRow([gSvg('110/011/010')]),
    opts: [gSvg('110/011/000'), gSvg('110/011/001'), gSvg('111/011/010'), gSvg('100/001/010')],
    explain: 'Hình mẫu tô 5 ô; đáp án phải tô đúng 4 ô và các ô đó đều nằm trong hình mẫu (chỉ bớt đi 1 ô, không thêm, không dời).',
  }),
  // Chuỗi DAO ĐỘNG hai trạng thái nhưng mỗi lần thêm 1 ô
  figQ({
    id: 'osc1', d: 3, q: 'Hình tiếp theo của chuỗi là gì?',
    fig: figRow([gSvg('100/000/000'), gSvg('010/010/000'), gSvg('100/000/101'), '?']),
    opts: [gSvg('010/010/101'), gSvg('100/000/000'), gSvg('111/000/000'), gSvg('010/010/010')],
    explain: 'Cột được tô đổi qua lại giữa cột TRÁI và cột GIỮA, đồng thời mỗi bước thêm 1 ô: 1 → 2 → 3 → 4 ô.',
  }),
  // Xáo trộn thứ tự: hình nào đứng ĐẦU nếu xếp thành chuỗi hợp lý
  { id: 'orderseq', category: '🖼️ Suy luận hình', d: 3, q: 'Bốn hình dưới đây bị xáo trộn. Nếu xếp lại thành một chuỗi hợp lý thì hình nào đứng ĐẦU?',
    fig: figRow([numCell(1), numCell(2), numCell(3), numCell(4)]) +
      figRow([gSvg('111/110/000'), gSvg('100/000/000'), gSvg('111/000/000'), gSvg('110/000/000')]),
    options: ['Hình 1', 'Hình 2', 'Hình 3', 'Hình 4'], answer: 1,
    explain: 'Sắp theo số ô tăng dần 1 → 2 → 3 → 5: hình 2 (1 ô) đứng đầu, rồi hình 4, hình 3, cuối là hình 1.' },
  gOpQ('gx45', 3, '110/101/011', '011/011/101', 'xor', 'XOR: bỏ ô trùng nhau, giữ ô chỉ một bên tô.'),
  { id: 'nm41', category: '🖼️ Suy luận hình', d: 2, q: 'Số ở ô dấu ? là bao nhiêu?',
    fig: figGrid([numCell(2), numCell(5), numCell(9), numCell(4), numCell(8), numCell(13), numCell(6), numCell(11), '?'], 3),
    options: ['15', '16', '17', '18'], answer: 2,
    explain: 'Mỗi CỘT là cấp số cộng: cột 1 tăng 2, cột 2 tăng 3, cột 3 tăng 4 ⇒ 13 + 4 = 17.' },
  { id: 'dl127', category: '🧠 Logic', d: 3, q: 'Bốn người A, B, C, D xếp hàng. D đứng cuối. A đứng NGAY TRƯỚC B. Cả A và B đều không đứng đầu. Ai đứng đầu?', options: ['A', 'B', 'C', 'D'], answer: 2,
    explain: 'D ở vị trí 4. A ngay trước B mà A không được đứng đầu ⇒ A ở 2, B ở 3. Vị trí 1 chỉ còn C.' },
  { id: 'dl128', category: '🧠 Logic', d: 2, q: 'Nếu 2 người thợ xây 2 bức tường trong 2 ngày thì 6 người thợ xây 6 bức tường trong bao lâu?', options: ['2 ngày', '3 ngày', '6 ngày', '18 ngày'], answer: 0,
    explain: 'Mỗi thợ xây 1 bức trong 2 ngày ⇒ 6 thợ xây 6 bức vẫn mất đúng 2 ngày.' },
  { id: 'dl129', category: '➗ Toán nhanh', d: 3, q: 'Một hệ thống nhận 3.000 request/phút, mỗi request ghi 3 dòng log. Log giữ 7 ngày. Tổng số dòng log lưu trữ khoảng bao nhiêu?', options: ['9 triệu', '90 triệu', '900 triệu', '9 tỉ'], answer: 1,
    explain: '3.000 × 3 = 9.000 dòng/phút × 1.440 phút × 7 ngày ≈ 90,7 triệu dòng.' },
  { id: 'dl130', category: '🎲 Xác suất', d: 3, q: 'Rút ngẫu nhiên 1 lá từ bộ 52 lá. Xác suất được lá ĐỎ hoặc lá Hình (J, Q, K) là bao nhiêu?', options: ['8/13', '17/26', '32/52', '5/13'], answer: 0,
    explain: '26 lá đỏ + 12 lá hình − 6 lá vừa đỏ vừa hình = 32 lá ⇒ 32/52 = 8/13.' },
  { id: 'n37-1', category: '🔢 Dãy số', d: 3, q: 'Số tiếp theo: 1, 6, 21, 66, ?', options: ['132', '186', '201', '216'], answer: 2,
    explain: 'Quy luật × 3 + 3: 66 × 3 + 3 = 201.' },
];
