/*
 * Tab 📕 Ebook — đọc 3 bộ sách System Design SONG NGỮ Anh–Việt.
 *
 * Dữ liệu do tools/build_ebooks.py sinh từ PDF gốc:
 *   data/ebooks/index.json          — danh mục sách + chương (nhẹ, nạp 1 lần)
 *   data/ebooks/<sách>/<chương>.json — nội dung chương (nạp khi mở, SW cache lại)
 *
 * Mỗi block có { t: kiểu, en: bản gốc, vi: bản dịch }. Chương chưa dịch xong thì
 * vẫn đọc được bản tiếng Anh — không chặn.
 */

const EB_MODE_KEY = 'prep-ebook-mode';   // 'en' | 'vi' | 'both'
const EB_READ_KEY = 'prep-ebook-read';   // { 'sách/chương': true }
const EB_LAST_KEY = 'prep-ebook-last';   // { book, ch } — mở lại đúng chỗ đang đọc

let ebIndex = null;      // danh mục đã nạp
let ebBookId = null;     // sách đang chọn
let ebChapter = null;    // nội dung chương đang mở
let ebFilter = '';       // ô lọc chương

const ebRead = () => store.get(EB_READ_KEY, {});
const ebMode = () => store.get(EB_MODE_KEY, 'both');

async function ebLoadIndex() {
  if (ebIndex) return ebIndex;
  ebIndex = await fetch('data/ebooks/index.json').then(r => r.json());
  return ebIndex;
}

const ebBook = id => ebIndex?.books.find(b => b.id === id);

/** Điểm vào của tab (switchView gọi). */
async function renderEbook() {
  const body = document.getElementById('ebook-body');
  if (!body) return;
  if (!ebIndex) {
    body.innerHTML = '<p class="eb-loading">⏳ Đang nạp thư viện…</p>';
    try {
      await ebLoadIndex();
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
        <span class="eb-ch-t">${escHtml(c.titleVi || c.title)}</span>
        <span class="eb-ch-m">${done[key] ? '✓ đã đọc · ' : ''}${(c.chars / 1000).toFixed(1)}k ký tự${pct < 100 ? ` · dịch ${pct}%` : ''}</span>
      </span>
    </button>`;
  }).join('');
  el.querySelectorAll('.eb-ch').forEach(b => b.onclick = () => ebOpen(b.dataset.ch));
}

/* ------------------------------------------------------------------- đọc bài */
async function ebOpen(chId) {
  const book = ebBook(ebBookId);
  if (!book.chapters.some(c => c.id === chId)) return;
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

/** Chuyển 1 block thành HTML theo chế độ đang xem. */
function ebBlockHtml(b, mode) {
  if (b.t === 'code') return `<pre class="eb-code">${escHtml(b.en)}</pre>`; // code không dịch
  const fmt = t => (b.lead ? ebLeadHtml(t) : escHtml(t));
  const tag = EB_TAG[b.t] || 'p';
  const cls = b.t === 'figure' ? 'eb-fig' : '';
  const wrap = (text, lang, extra) =>
    `<${tag} lang="${lang}" class="${[cls, extra].filter(Boolean).join(' ')}">${text}</${tag}>`;

  if (mode === 'en') return wrap(fmt(b.en), 'en', '');
  if (mode === 'vi') {
    return b.vi ? wrap(fmt(b.vi), 'vi', '') : wrap(fmt(b.en), 'en', 'eb-untranslated');
  }
  return `<div class="eb-row eb-row-${b.t}">
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
        <b>${escHtml(ebChapter.titleVi || ebChapter.title)}</b>
        ${ebChapter.titleVi ? `<span class="eb-bar-en">${escHtml(ebChapter.title)}</span>` : ''}
      </div>
      <div class="eb-modes">
        <button class="eb-mode ${mode === 'en' ? 'active' : ''}" data-mode="en">EN</button>
        <button class="eb-mode ${mode === 'vi' ? 'active' : ''}" data-mode="vi">VI</button>
        <button class="eb-mode ${mode === 'both' ? 'active' : ''}" data-mode="both">⇄ Song song</button>
      </div>
    </div>
    <article class="eb-art eb-art-${mode}">${parts.join('\n')}</article>
    <div class="eb-foot">
      <button id="eb-prev" ${i <= 0 ? 'disabled' : ''}>← Chương trước</button>
      <button id="eb-done" class="${isRead ? 'done' : ''}">${isRead ? '✓ Đã đọc xong' : '☐ Đánh dấu đã đọc'}</button>
      <button id="eb-next" ${i >= chapters.length - 1 ? 'disabled' : ''}>Chương sau →</button>
    </div>`;

  reader.querySelectorAll('.eb-mode').forEach(b => b.onclick = () => ebSetMode(b.dataset.mode));
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
