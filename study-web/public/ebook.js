/*
 * Tab 📕 Ebook — đọc 3 bộ sách System Design SONG NGỮ Anh–Việt.
 *
 * Dữ liệu do tools/build_ebooks.py sinh từ PDF gốc:
 *   data/ebooks/index.json          — danh mục sách + chương (nhẹ, nạp 1 lần)
 *   data/ebooks/<sách>/<chương>.json — nội dung chương (nạp khi mở, SW cache lại)
 *
 * Mỗi block có { t: kiểu, en: bản gốc, vi: bản dịch }. Chương chưa dịch xong thì
 * vẫn đọc được bản tiếng Anh — không chặn.
 *
 * ⚡ TÓM TẮT NHANH (data/ebooks/summaries.json): các chương "design một hệ thống" dài
 * 20–75k ký tự, đọc thẳng vào thì rất dễ lạc. Nút ⚡ mở một bản tóm tắt cô đọng theo đúng
 * khung trả lời phỏng vấn — làm rõ yêu cầu → thiết kế cao → đi sâu → tổng kết — để mường
 * tượng trước bài toán rồi mới đọc chi tiết. Chương nào chưa có tóm tắt thì KHÔNG hiện nút.
 */

const EB_MODE_KEY = 'prep-ebook-mode';   // 'en' | 'vi' | 'both'
const EB_READ_KEY = 'prep-ebook-read';   // { 'sách/chương': true }
const EB_LAST_KEY = 'prep-ebook-last';   // { book, ch } — mở lại đúng chỗ đang đọc

let ebIndex = null;      // danh mục đã nạp
let ebBookId = null;     // sách đang chọn
let ebChapter = null;    // nội dung chương đang mở
let ebFilter = '';       // ô lọc chương
let ebSums = null;       // kho tóm tắt, nạp một lần khi mở tab
let ebSumOpen = false;   // panel ⚡ đang mở?

const ebRead = () => store.get(EB_READ_KEY, {});
const ebMode = () => store.get(EB_MODE_KEY, 'both');

async function ebLoadIndex() {
  if (ebIndex) return ebIndex;
  ebIndex = await fetch('data/ebooks/index.json').then(r => r.json());
  return ebIndex;
}

const ebBook = id => ebIndex?.books.find(b => b.id === id);
/** Tóm tắt của một chương, chưa có thì trả null (nút ⚡ sẽ không hiện). */
const ebSum = (book, ch) => (ebSums ? ebSums[`${book}/${ch}`] || null : null);

/** Nạp kho tóm tắt — hỏng thì bỏ qua, tab vẫn đọc được sách như thường. */
async function ebLoadSums() {
  if (ebSums) return ebSums;
  try {
    ebSums = await fetch('data/ebooks/summaries.json').then(r => r.json());
  } catch {
    ebSums = {};
  }
  return ebSums;
}

/** Điểm vào của tab (switchView gọi). */
async function renderEbook() {
  const body = document.getElementById('ebook-body');
  if (!body) return;
  if (!ebIndex) {
    body.innerHTML = '<p class="eb-loading">⏳ Đang nạp thư viện…</p>';
    try {
      await Promise.all([ebLoadIndex(), ebLoadSums()]);
    } catch {
      body.innerHTML = '<p class="eb-loading">❌ Không nạp được thư viện ebook. Kiểm tra mạng rồi thử lại.</p>';
      return;
    }
    const last = store.get(EB_LAST_KEY, null);
    if (last && ebBook(last.book)) ebBookId = last.book;
  }
  if (!ebBookId) ebBookId = ebIndex.books[0].id;
  ebDrawShell();
  const last = store.get(EB_LAST_KEY, null);
  if (last && last.book === ebBookId && last.ch && !ebChapter) ebOpen(last.ch);
  else ebDrawReader();
}

/* ---------------------------------------------------------------- khung tab */
function ebDrawShell() {
  const body = document.getElementById('ebook-body');
  const done = ebRead();
  const shelf = ebIndex.books.map(b => {
    const n = b.chapters.filter(c => done[`${b.id}/${c.id}`]).length;
    return `<button class="eb-book ${b.id === ebBookId ? 'active' : ''}" data-book="${b.id}">
      <span class="eb-book-t">${escHtml(b.titleVi)}</span>
      <span class="eb-book-s">${escHtml(b.author)} · ${b.chapters.length} chương · đã đọc ${n}</span>
    </button>`;
  }).join('');

  body.innerHTML = `
    <div class="eb-shelf">${shelf}</div>
    <div class="eb-main">
      <aside class="eb-toc">
        <input id="eb-filter" type="search" placeholder="🔍 Lọc chương…" autocomplete="off" />
        <div id="eb-list"></div>
      </aside>
      <section id="eb-reader" class="eb-reader"></section>
    </div>`;

  body.querySelectorAll('.eb-book').forEach(btn => btn.onclick = () => {
    ebBookId = btn.dataset.book;
    ebChapter = null;
    ebFilter = '';
    store.set(EB_LAST_KEY, { book: ebBookId, ch: null });
    ebDrawShell();
    ebDrawReader();
  });
  const filter = document.getElementById('eb-filter');
  filter.value = ebFilter;
  filter.oninput = () => { ebFilter = filter.value.trim().toLowerCase(); ebDrawList(); };
  ebDrawList();
}

/** Phần tiếng Việt để chú bên cạnh tên chương tiếng Anh.
 *  Vài tên dịch giữ nguyên tên riêng rồi mới chú ("Proximity Service — dịch vụ
 *  tìm quanh") — cắt phần trùng đi cho khỏi lặp lại ngay cạnh tên gốc. */
function ebNoteVi(title, titleVi) {
  if (!titleVi || titleVi === title) return '';
  const m = titleVi.startsWith(title) && /^\s*[—–-]\s*(.+)$/.exec(titleVi.slice(title.length));
  return m ? m[1] : titleVi;
}

function ebDrawList() {
  const book = ebBook(ebBookId);
  const done = ebRead();
  const q = ebFilter;
  const rows = book.chapters.filter(c =>
    !q || c.title.toLowerCase().includes(q) || (c.titleVi || '').toLowerCase().includes(q));
  const el = document.getElementById('eb-list');
  if (!rows.length) { el.innerHTML = '<p class="eb-empty">Không có chương nào khớp.</p>'; return; }
  el.innerHTML = rows.map(c => {
    const key = `${book.id}/${c.id}`;
    const pct = c.blocks ? Math.round(100 * c.vi / c.blocks) : 0;
    return `<button class="eb-ch ${ebChapter?.id === c.id ? 'active' : ''}" data-ch="${c.id}">
      <span class="eb-ch-n">${escHtml(c.num)}</span>
      <span class="eb-ch-b">
        <span class="eb-ch-t" lang="en">${escHtml(c.title)}</span>
        <span class="eb-ch-m">${ebNoteVi(c.title, c.titleVi) ? `<span class="eb-ch-vi">${escHtml(ebNoteVi(c.title, c.titleVi))}</span> · ` : ''}${ebSum(book.id, c.id) ? '<span class="eb-ch-sum">⚡ có tóm tắt</span> · ' : ''}${done[key] ? '✓ đã đọc · ' : ''}${(c.chars / 1000).toFixed(1)}k ký tự${pct < 100 ? ` · dịch ${pct}%` : ''}</span>
      </span>
    </button>`;
  }).join('');
  el.querySelectorAll('.eb-ch').forEach(b => b.onclick = () => ebOpen(b.dataset.ch));
}

/* ------------------------------------------------------------------- đọc bài */
async function ebOpen(chId) {
  const book = ebBook(ebBookId);
  if (!book.chapters.some(c => c.id === chId)) return;
  ebSumOpen = false;                 // đổi chương thì đóng panel ⚡ của chương cũ
  if (!ebSums) await ebLoadSums();   // vào lại tab khi danh mục đã nạp sẵn
  const reader = document.getElementById('eb-reader');
  reader.innerHTML = '<p class="eb-loading">⏳ Đang mở chương…</p>';
  try {
    ebChapter = await fetch(`data/ebooks/${ebBookId}/${chId}.json`).then(r => r.json());
  } catch {
    reader.innerHTML = '<p class="eb-loading">❌ Không mở được chương này.</p>';
    return;
  }
  store.set(EB_LAST_KEY, { book: ebBookId, ch: chId });
  ebDrawList();
  ebDrawReader();
  reader.scrollTop = 0;
}

function ebSetMode(m) {
  store.set(EB_MODE_KEY, m);
  ebDrawReader();
}

const EB_TAG = { h1: 'h2', h2: 'h2', h3: 'h3', p: 'p', li: 'li', code: 'pre', figure: 'p' };

/** In đậm phần "Tên khái niệm:" mở đầu đoạn — sách gốc cũng in đậm chỗ đó. */
function ebLeadHtml(text) {
  const m = /^([^:]{2,80}):\s(.+)$/s.exec(text);
  return m ? `<b>${escHtml(m[1])}:</b> ${escHtml(m[2])}` : escHtml(text);
}

/** Ảnh sơ đồ cắt từ sách gốc — hiện MỘT lần, kể cả ở chế độ song song. */
function ebFigImg(b) {
  if (!b.img) return '';
  return `<img class="eb-fig-img" src="${escHtml(b.img)}" width="${b.iw}" height="${b.ih}"
    alt="${escHtml(b.vi || b.en)}" loading="lazy" decoding="async">`;
}

/** Chuyển 1 block thành HTML theo chế độ đang xem. */
function ebBlockHtml(b, mode) {
  if (b.t === 'code') return `<pre class="eb-code">${escHtml(b.en)}</pre>`; // code không dịch
  const fmt = t => (b.lead ? ebLeadHtml(t) : escHtml(t));
  const tag = EB_TAG[b.t] || 'p';
  const cls = b.t === 'figure' ? 'eb-fig' : '';
  const wrap = (text, lang, extra) =>
    `<${tag} lang="${lang}" class="${[cls, extra].filter(Boolean).join(' ')}">${text}</${tag}>`;

  const img = ebFigImg(b);
  if (mode === 'en') return img + wrap(fmt(b.en), 'en', '');
  if (mode === 'vi') {
    return img + (b.vi ? wrap(fmt(b.vi), 'vi', '') : wrap(fmt(b.en), 'en', 'eb-untranslated'));
  }
  return `${img}<div class="eb-row eb-row-${b.t}">
    <div class="eb-col eb-col-en">${wrap(fmt(b.en), 'en', '')}</div>
    <div class="eb-col eb-col-vi">${b.vi ? wrap(fmt(b.vi), 'vi', '') : '<p class="eb-todo">— chưa dịch —</p>'}</div>
  </div>`;
}

function ebDrawReader() {
  const reader = document.getElementById('eb-reader');
  if (!reader) return;
  const book = ebBook(ebBookId);
  if (!ebChapter || ebChapter.book !== ebBookId) {
    reader.innerHTML = `<div class="eb-intro">
      <h1>${escHtml(book.titleVi)}</h1>
      <p class="eb-intro-en">${escHtml(book.title)} — ${escHtml(book.author)}</p>
      <p>${escHtml(book.note)}</p>
      <p class="eb-hint">Chọn một chương ở danh sách bên trái. Mỗi chương đọc được ở ba chế độ:
        <b>EN</b> (bản gốc), <b>VI</b> (bản dịch), <b>⇄ Song song</b> (đối chiếu từng đoạn).</p>
    </div>`;
    return;
  }

  const mode = ebMode();
  const sum = ebSum(ebBookId, ebChapter.id);
  const key = `${ebBookId}/${ebChapter.id}`;
  const isRead = !!ebRead()[key];
  const chapters = book.chapters;
  const i = chapters.findIndex(c => c.id === ebChapter.id);

  // Gom các <li> liên tiếp vào một <ul> (chế độ song song giữ nguyên dạng hàng).
  const parts = [];
  let inList = false;
  ebChapter.blocks.forEach(b => {
    const isLi = b.t === 'li' && mode !== 'both';
    if (isLi && !inList) { parts.push('<ul class="eb-ul">'); inList = true; }
    if (!isLi && inList) { parts.push('</ul>'); inList = false; }
    parts.push(ebBlockHtml(b, mode));
  });
  if (inList) parts.push('</ul>');

  reader.innerHTML = `
    <div class="eb-bar">
      <div class="eb-bar-t">
        <b lang="en">${escHtml(ebChapter.title)}</b>
        ${ebNoteVi(ebChapter.title, ebChapter.titleVi) ? `<span class="eb-bar-en">${escHtml(ebNoteVi(ebChapter.title, ebChapter.titleVi))}</span>` : ''}
      </div>
      <div class="eb-modes">
        ${sum ? '<button id="eb-sum-btn" class="eb-sum-btn" title="Đọc bản tóm tắt cô đọng trước khi vào chi tiết">⚡ Tóm tắt nhanh</button>' : ''}
        <button class="eb-mode ${mode === 'en' ? 'active' : ''}" data-mode="en">EN</button>
        <button class="eb-mode ${mode === 'vi' ? 'active' : ''}" data-mode="vi">VI</button>
        <button class="eb-mode ${mode === 'both' ? 'active' : ''}" data-mode="both">⇄ Song song</button>
      </div>
    </div>
    ${ebSumOpen && sum ? ebSumHtml(sum) : ''}
    <article class="eb-art eb-art-${mode}">${parts.join('\n')}</article>
    <div class="eb-foot">
      <button id="eb-prev" ${i <= 0 ? 'disabled' : ''}>← Chương trước</button>
      <button id="eb-done" class="${isRead ? 'done' : ''}">${isRead ? '✓ Đã đọc xong' : '☐ Đánh dấu đã đọc'}</button>
      <button id="eb-next" ${i >= chapters.length - 1 ? 'disabled' : ''}>Chương sau →</button>
    </div>`;

  reader.querySelectorAll('.eb-mode').forEach(b => b.onclick = () => ebSetMode(b.dataset.mode));
  const sumBtn = document.getElementById('eb-sum-btn');
  if (sumBtn) sumBtn.onclick = () => ebToggleSum();
  const sumClose = document.getElementById('eb-sum-close');
  if (sumClose) sumClose.onclick = () => ebToggleSum();
  document.getElementById('eb-prev').onclick = () => ebOpen(chapters[i - 1].id);
  document.getElementById('eb-next').onclick = () => ebOpen(chapters[i + 1].id);
  document.getElementById('eb-done').onclick = () => {
    const map = ebRead();
    if (map[key]) delete map[key]; else map[key] = true;
    store.set(EB_READ_KEY, map);
    ebDrawShell();
    ebDrawReader();
  };
}

/* ------------------------------------------------------- ⚡ tóm tắt nhanh */

/** Bật/tắt panel tóm tắt. Mở xong cuộn lên đầu để đọc ngay, không phải tự tìm. */
function ebToggleSum() {
  ebSumOpen = !ebSumOpen;
  ebDrawReader();
  if (ebSumOpen) {
    const reader = document.getElementById('eb-reader');
    if (reader) reader.scrollTop = 0;
  }
}

/** Danh sách hỏi–đáp dùng chung cho phần 1️⃣ làm rõ yêu cầu và 3️⃣ đi sâu. */
function ebSumQa(items) {
  return (items || []).map(x => `<div class="eb-sum-qa">
    <div class="eb-sum-q">${escHtml(x.q)}</div>
    <div class="eb-sum-a">${escHtml(x.a)}</div>
  </div>`).join('');
}

/**
 * Khung 4 bước đúng như cách trả lời một câu system design trên bảng trắng:
 * làm rõ yêu cầu → phác thiết kế cao → đi sâu chỗ giám khảo đào → tổng kết.
 * Mục nào chương không nói tới thì ẩn hẳn, không để tiêu đề rỗng.
 */
function ebSumHtml(s) {
  const sec = (cls, head, body) => (body ? `<section class="eb-sum-sec ${cls}">
    <h3>${head}</h3>${body}</section>` : '');
  return `<div class="eb-sum">
    <div class="eb-sum-head">
      <b>⚡ Tóm tắt nhanh</b>
      <span class="eb-sum-sub">Đọc ~3 phút để mường tượng trước, rồi mới vào chi tiết bên dưới.</span>
      <button id="eb-sum-close" class="eb-sum-close" title="Đóng tóm tắt">✕</button>
    </div>
    ${s.one ? `<p class="eb-sum-one">${escHtml(s.one)}</p>` : ''}
    ${s.scale?.length ? `<div class="eb-sum-chips">${s.scale.map(x =>
      `<span class="eb-sum-chip">${escHtml(x)}</span>`).join('')}</div>` : ''}
    ${sec('s1', '1️⃣ Làm rõ yêu cầu <small>hỏi lại gì trước khi vẽ</small>', ebSumQa(s.clarify))}
    ${sec('s2', '2️⃣ Thiết kế cao <small>sơ đồ khối + luồng chính</small>',
      (s.boxes ? `<div class="eb-sum-boxes">${escHtml(s.boxes)}</div>` : '')
      + (s.flow?.length ? `<ol class="eb-sum-flow">${s.flow.map(x =>
        `<li>${escHtml(x)}</li>`).join('')}</ol>` : ''))}
    ${sec('s3', '3️⃣ Đi sâu <small>chỗ giám khảo hay đào</small>', ebSumQa(s.deep))}
    ${s.traps?.length ? `<section class="eb-sum-sec s4"><h3>⚠️ Bẫy hay bị vặn</h3>
      <ul class="eb-sum-traps">${s.traps.map(x => `<li>${escHtml(x)}</li>`).join('')}</ul></section>` : ''}
    ${s.wrap ? `<section class="eb-sum-sec s5"><h3>4️⃣ Tổng kết</h3>
      <p class="eb-sum-wrap">${escHtml(s.wrap)}</p></section>` : ''}
  </div>`;
}
