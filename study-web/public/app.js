/**
 * Study Web — frontend SPA (vanilla JS, không framework).
 * Tính năng: đọc tài liệu markdown, quiz tự chấm, flashcards từ vựng, dashboard tiến độ.
 * Toàn bộ tiến độ lưu trong localStorage của trình duyệt.
 */

// ---------- State & storage helpers ----------
let onStoreWrite = null; // hook đồng bộ Firebase gắn vào — gọi sau mỗi lần ghi 'prep-*'
const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
    if (onStoreWrite) try { onStoreWrite(key); } catch {}
  },
};

let TREE = [];
let currentDoc = null;

// ---------- API: chạy được cả với backend động (server.js) lẫn bản tĩnh (GitHub Pages) ----------
// STATIC_MODE bật khi không gọi được /api (ví dụ trên GitHub Pages) — khi đó dùng data/*.json.
let STATIC_MODE = false;
let _docsPromise = null;
/** Tải gói nội dung md tĩnh một lần, cache lại (dùng cho đọc file + tìm kiếm) */
function loadDocsStatic() {
  return _docsPromise ??= fetch('data/docs.json').then(r => r.json());
}

/** Đọc 1 file md (raw text) — null nếu không có */
async function apiFile(relPath) {
  if (STATIC_MODE) { const docs = await loadDocsStatic(); return docs[relPath] ?? null; }
  const r = await fetch('/api/file?path=' + encodeURIComponent(relPath)).catch(() => null);
  return r && r.ok ? r.text() : null;
}

/** Danh sách snippet luyện gõ code */
function apiSnippets() {
  return (STATIC_MODE ? fetch('data/snippets.json') : fetch('/api/snippets')).then(r => r.json());
}

/** Tìm toàn văn — bản tĩnh duyệt docs.json client-side, giữ nguyên định dạng kết quả của server */
async function apiSearch(q) {
  if (!STATIC_MODE) return fetch('/api/search?q=' + encodeURIComponent(q)).then(r => r.json()).catch(() => []);
  const docs = await loadDocsStatic();
  const needle = q.toLowerCase();
  const results = [];
  const MAX = 60;
  for (const [p, content] of Object.entries(docs)) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length && results.length < MAX; i++) {
      if (lines[i].toLowerCase().includes(needle)) {
        results.push({ path: p, line: i + 1, text: lines[i].trim().slice(0, 180) });
      }
    }
    if (results.length >= MAX) break;
  }
  return results;
}

// ---------- SRS + thống kê dùng chung ----------
const SRS_INTERVALS = [0, 1, 3, 7, 14, 30]; // số ngày chờ trước khi ôn lại, theo box 0→5
const LEECH_THRESHOLD = 3;          // sai từ này trở lên → "từ cứng đầu"

const dayKey = d =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Thời điểm thẻ đến hạn ôn lại */
function srsDue(entry) {
  return entry.at + SRS_INTERVALS[entry.box || 0] * 864e5;
}

/** Lọc deck theo lựa chọn tuần / đến hạn / từ cứng đầu / kỹ thuật / giao tiếp */
function filterDeck(week) {
  if (week === '__due__') {
    const srs = store.get('prep-srs', {});
    return DECK.filter(c => srs[c.id] && srsDue(srs[c.id]) <= Date.now());
  }
  if (week === '__leech__') {
    const fails = store.get('prep-fails', {});
    return DECK.filter(c => (fails[c.id] || 0) >= LEECH_THRESHOLD);
  }
  if (week === '__tech__') return DECK.filter(c => !c.daily);
  if (week === '__daily__') return DECK.filter(c => c.daily);
  return week ? DECK.filter(c => c.week === week) : [...DECK];
}

/** Ghi nhận một lượt học vào heatmap hoạt động */
function logActivity(n = 1) {
  const acts = store.get('prep-activity', {});
  const key = dayKey(new Date());
  acts[key] = (acts[key] || 0) + n;
  store.set('prep-activity', acts);
}

/** Cập nhật SRS + đếm lỗi: dùng chung cho flashcards và luyện viết */
function bumpSrs(card, known) {
  if (!card) return;
  const srs = store.get('prep-srs', {});
  const cur = srs[card.id]?.box || 0;
  srs[card.id] = { box: known ? Math.min(cur + 1, SRS_INTERVALS.length - 1) : 0, at: Date.now() };
  store.set('prep-srs', srs);
  if (!known) {
    const fails = store.get('prep-fails', {});
    fails[card.id] = (fails[card.id] || 0) + 1;
    store.set('prep-fails', fails);
  }
}

// ---------- Tabs / views ----------
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

// Các tab có LƯU TIẾN ĐỘ → cần đăng nhập (chỉ áp dụng khi đã cấu hình Firebase).
// Tab 📚 Tài liệu để mở tự do cho người chưa đăng nhập còn đọc nội dung.
const GATED_VIEWS = new Set(['flashcards', 'writing', 'code', 'coding', 'mock', 'plan', 'dashboard']);
let authResolved = false; // true sau lần onAuthStateChanged đầu tiên
const viewGated = name => syncReady && GATED_VIEWS.has(name);

function switchView(name) {
  if (typeof iqTimerId !== 'undefined') clearInterval(iqTimerId); // rời tab → dừng bài test IQ đang chạy
  store.set('prep-last-view', name); // nhớ tab đang mở cho lần reload sau
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
  // Chặn tab cần đăng nhập khi chưa login
  if (viewGated(name) && !fbUser) {
    showLoginGate(!authResolved);
    return; // không init/vẽ nội dung tab khi đang khóa
  }
  hideLoginGate();
  if (name === 'flashcards') initFlashcards().then(() => fcLoaded && fillFcWeekSelect());
  if (name === 'writing') initWriting().then(() => wrInit && WR_SENTENCES && fillWrWeekSelect());
  if (name === 'code') initCodeTyping();
  if (name === 'coding') initThink();
  if (name === 'mock') initMock().then(() => mkInit && fillMockWeekSelect());
  if (name === 'plan') renderPlan();
  if (name === 'dashboard') renderDashboard();
}

/** Lớp phủ khóa tab khi chưa đăng nhập. checking=true khi đang chờ Firebase xác định phiên. */
function showLoginGate(checking) {
  let el = document.getElementById('login-gate');
  if (!el) { el = document.createElement('div'); el.id = 'login-gate'; document.body.appendChild(el); }
  el.hidden = false;
  if (checking) {
    el.innerHTML = '<div class="lg-box"><div class="lg-ico">⏳</div><p>Đang kiểm tra đăng nhập…</p></div>';
    return;
  }
  el.innerHTML = `
    <div class="lg-box">
      <div class="lg-ico">🔒</div>
      <h2>Cần đăng nhập</h2>
      <p>Tab này lưu tiến độ học của bạn lên cloud (Firestore) nên cần đăng nhập bằng Google để tiếp tục — nhờ vậy dữ liệu được đồng bộ trên mọi thiết bị.</p>
      <button id="lg-in" class="lg-btn">🔐 Đăng nhập với Google</button>
      <button id="lg-docs" class="lg-link">← Về 📚 Tài liệu (xem tự do, không cần đăng nhập)</button>
    </div>`;
  document.getElementById('lg-in').onclick = () => signInSync();
  document.getElementById('lg-docs').onclick = () => switchView('docs');
}
function hideLoginGate() { const el = document.getElementById('login-gate'); if (el) el.hidden = true; }

/** Vẽ lại tab hiện tại (gọi sau khi trạng thái đăng nhập thay đổi). */
function reapplyView() { switchView(store.get('prep-last-view', 'docs')); }

// ---------- Pomodoro ----------
const POMO_FOCUS = 25 * 60, POMO_BREAK = 5 * 60;
let pomoMode = 'idle'; // idle | focus | break
let pomoLeft = POMO_FOCUS, pomoRunning = false, pomoTimerId = null;
let pomoEndAt = 0; // deadline thật — không trừ dần để khỏi lệch khi tab bị throttle
const BASE_TITLE = document.title;

function pomoBeep(times = 3) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.4 + 0.3);
      osc.start(ctx.currentTime + i * 0.4);
      osc.stop(ctx.currentTime + i * 0.4 + 0.32);
    }
  } catch {}
}

function pomoTodayCount() {
  return store.get('prep-pomo', {})[dayKey(new Date())] || 0;
}

/** Báo qua Notification API — hữu ích khi đang ở tab/app khác lúc hết giờ */
function pomoNotify(title, body) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  } catch {}
}

function pomoRender() {
  const btn = document.getElementById('pomo-btn');
  const mm = String(Math.floor(pomoLeft / 60)).padStart(2, '0');
  const ss = String(pomoLeft % 60).padStart(2, '0');
  const icon = pomoMode === 'break' ? '☕' : '🍅';
  const count = pomoTodayCount();
  btn.textContent = `${icon} ${mm}:${ss}${count ? ` ×${count}` : ''}`;
  btn.className = pomoRunning ? (pomoMode === 'break' ? 'break running' : 'running')
    : (pomoMode !== 'idle' ? 'paused' : '');
  document.getElementById('pomo-reset').hidden = pomoMode === 'idle';
  document.title = pomoRunning ? `${icon} ${mm}:${ss} · Study Web` : BASE_TITLE;
}

function pomoTick() {
  pomoLeft = Math.max(0, Math.round((pomoEndAt - Date.now()) / 1000));
  if (pomoLeft > 0) return pomoRender();
  pomoBeep();
  if (pomoMode === 'focus') {
    // Xong 1 pomodoro → cộng vào bộ đếm hôm nay rồi tự chuyển sang giải lao
    const pomo = store.get('prep-pomo', {});
    const key = dayKey(new Date());
    pomo[key] = (pomo[key] || 0) + 1;
    store.set('prep-pomo', pomo);
    pomoNotify('🍅 Xong phiên tập trung 25 phút!', `Pomodoro thứ ${pomo[key]} hôm nay — nghỉ 5 phút nhé ☕`);
    pomoMode = 'break';
    pomoLeft = POMO_BREAK;
    pomoEndAt = Date.now() + POMO_BREAK * 1000;
  } else {
    pomoNotify('☕ Hết giờ nghỉ', 'Vào phiên tập trung tiếp nào! 🍅');
    pomoStop();
  }
  pomoRender();
}

function pomoStop() {
  clearInterval(pomoTimerId);
  pomoTimerId = null;
  pomoRunning = false;
  pomoMode = 'idle';
  pomoLeft = POMO_FOCUS;
}

function initPomodoro() {
  document.getElementById('pomo-btn').addEventListener('click', () => {
    if (pomoRunning) {
      clearInterval(pomoTimerId);
      pomoTimerId = null;
      pomoRunning = false;
      pomoLeft = Math.max(0, Math.round((pomoEndAt - Date.now()) / 1000));
    } else {
      if (pomoMode === 'idle') {
        pomoMode = 'focus';
        pomoLeft = POMO_FOCUS;
        // Xin quyền notification ở lần bấm đầu (cần user gesture)
        try {
          if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
        } catch {}
      }
      pomoRunning = true;
      pomoEndAt = Date.now() + pomoLeft * 1000;
      pomoTimerId = setInterval(pomoTick, 1000);
    }
    pomoRender();
  });
  document.getElementById('pomo-reset').addEventListener('click', () => { pomoStop(); pomoRender(); });
  pomoRender();
}

// ---------- Sidebar toggle (mobile) ----------
function initSidebarToggle() {
  const sidebar = document.getElementById('sidebar');
  document.getElementById('sb-toggle').addEventListener('click', () => {
    switchView('docs');
    sidebar.classList.toggle('open');
  });
  document.getElementById('sb-backdrop').addEventListener('click', () =>
    sidebar.classList.remove('open'));
}

// ---------- Trang Home "Hôm nay học gì" ----------
// Hiện khi chưa mở tài liệu nào, hoặc bấm vào logo trên topbar.
async function renderHome(pushHash = true) {
  switchView('docs');
  currentDoc = null;
  if (pushHash) history.replaceState(null, '', location.pathname);
  document.querySelectorAll('.sb-item').forEach(b => b.classList.remove('active'));

  const h = new Date().getHours();
  const greet = h < 12 ? 'Chào buổi sáng' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';

  const acts = store.get('prep-activity', {});
  const todayN = acts[dayKey(new Date())] || 0;
  let streak = 0;
  const d = new Date();
  if (!acts[dayKey(d)]) d.setDate(d.getDate() - 1);
  while (acts[dayKey(d)] > 0) { streak++; d.setDate(d.getDate() - 1); }

  // Tuần đầu tiên còn mục checklist chưa xong → gợi ý học tiếp
  const progress = store.get('prep-progress', {});
  const weeksGroup = TREE.find(g => g.title.includes('12 tuần'));
  const weeks = [...new Set((weeksGroup?.items || []).map(i => i.week).filter(Boolean))];
  const nextWeek = weeks.find(wk => WEEK_TASKS.some(([k]) => !(progress[wk] || {})[k]));

  await loadDeck();
  const due = filterDeck('__due__').length;
  const leech = filterDeck('__leech__').length;
  const last = store.get('prep-last-doc', null);

  const cards = [];
  cards.push({ id: 'hc-quick', title: '⚡ Ôn nhanh ~10 câu', sub: 'Mix từ đến hạn + điền từ + dịch câu — 10 phút mỗi ngày' });
  if (last) cards.push({ id: 'hc-continue', title: '▶️ Đọc tiếp', sub: last });
  if (nextWeek) cards.push({ id: 'hc-week', title: `📅 ${prettyWeek(nextWeek)}`, sub: 'Tuần đang học — vào lý thuyết tuần này' });
  if (due) cards.push({ id: 'hc-due', title: `📬 ${due} từ đến hạn ôn`, sub: 'Ôn flashcards theo lịch SRS hôm nay' });
  if (leech) cards.push({ id: 'hc-leech', title: `🔥 ${leech} từ cứng đầu`, sub: 'Sai nhiều lần — luyện riêng cho nhớ' });
  cards.push({ id: 'hc-code', title: '⌨️ Gõ một snippet code', sub: 'Khởi động ngón tay 2 phút' });
  cards.push({ id: 'hc-mock', title: '🎯 Mock interview nhanh', sub: '5-10 câu hỏi ngẫu nhiên từ 12 tuần' });
  const wrongN = getMockWrong().length;
  if (wrongN) cards.push({ id: 'hc-wrong', title: `🚩 ${wrongN} câu mock đã sai`, sub: 'Ôn lại riêng những câu từng trả lời chưa tốt' });

  document.getElementById('content').innerHTML = `
    <div class="home">
      <h1>${greet}! 👋</h1>
      <p class="home-stats">
        ${todayN ? `Hôm nay đã học <b>${todayN} lượt</b>` : 'Hôm nay chưa học lượt nào'}
        ${streak ? ` · 🔥 chuỗi <b>${streak} ngày</b>` : ''}
        ${pomoTodayCount() ? ` · 🍅 <b>${pomoTodayCount()} pomodoro</b>` : ''}
      </p>
      <div class="home-cards">
        ${cards.map(c => `<button class="home-card" id="${c.id}">
          <span class="hc-title">${escHtml(c.title)}</span>
          <span class="hc-sub">${escHtml(c.sub)}</span>
        </button>`).join('')}
      </div>
      <p class="home-tip">Mẹo: phím <kbd>1</kbd>–<kbd>7</kbd> chuyển tab nhanh, <kbd>/</kbd> để tìm kiếm tài liệu.</p>
    </div>`;

  const goFlash = filter => {
    switchView('flashcards');
    initFlashcards().then(() => {
      fillFcWeekSelect();
      const sel = document.getElementById('fc-week');
      sel.value = filter;
      sel.dispatchEvent(new Event('change'));
    });
  };
  document.getElementById('hc-quick')?.addEventListener('click', async () => {
    switchView('writing');
    await initWriting();
    // initWriting return sớm nếu đã init dở — chờ dữ liệu thật sự sẵn sàng
    await Promise.all([loadDeck(), loadSentences()]);
    document.querySelector('.wr-mode[data-mode="mix"]').click();
  });
  document.getElementById('hc-continue')?.addEventListener('click', () => openDoc(last));
  document.getElementById('hc-week')?.addEventListener('click', () => openDoc(`${nextWeek}/README.md`));
  document.getElementById('hc-due')?.addEventListener('click', () => goFlash('__due__'));
  document.getElementById('hc-leech')?.addEventListener('click', () => goFlash('__leech__'));
  document.getElementById('hc-code')?.addEventListener('click', () => switchView('code'));
  document.getElementById('hc-mock')?.addEventListener('click', () => switchView('mock'));
  document.getElementById('hc-wrong')?.addEventListener('click', () => {
    switchView('mock');
    initMock().then(() => {
      fillMockWeekSelect();
      const sel = document.getElementById('mk-week');
      sel.value = '__wrong__';
    });
  });
}

// ---------- Sidebar ----------
async function loadTree() {
  // Thử backend động trước; nếu hỏng (vd GitHub Pages tĩnh) thì chuyển sang data/tree.json
  try {
    const r = await fetch('/api/tree');
    if (!r.ok) throw new Error('no api');
    TREE = await r.json();
  } catch {
    STATIC_MODE = true;
    TREE = await fetch('data/tree.json').then(r => r.json());
  }
  const sb = document.getElementById('sb-tree');
  sb.innerHTML = '';
  TREE.forEach(group => {
    const g = document.createElement('div');
    g.className = 'sb-group';
    const title = document.createElement('button');
    title.className = 'sb-title';
    title.textContent = group.title;
    title.addEventListener('click', () => g.classList.toggle('collapsed'));
    g.appendChild(title);
    const items = document.createElement('div');
    items.className = 'sb-items';
    group.items.forEach(item => {
      const b = document.createElement('button');
      b.className = 'sb-item' + (item.sub ? ' sub' : '');
      b.textContent = item.label;
      b.dataset.path = item.path;
      b.addEventListener('click', () => openDoc(item.path));
      items.appendChild(b);
    });
    g.appendChild(items);
    sb.appendChild(g);
  });
}

// ---------- Tìm kiếm toàn văn ----------
let searchTimer = null;
function initSearch() {
  const input = document.getElementById('sb-search');
  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = input.value.trim();
    if (q.length < 2) return renderSearchResults(null);
    searchTimer = setTimeout(async () => {
      const res = await apiSearch(q);
      renderSearchResults(res, q);
    }, 250);
  });
  input.addEventListener('keydown', e => { if (e.key === 'Escape') { input.value = ''; renderSearchResults(null); } });
}

function renderSearchResults(res, q) {
  const box = document.getElementById('sb-results');
  const tree = document.getElementById('sb-tree');
  if (!res) { box.hidden = true; tree.style.display = ''; return; }
  tree.style.display = 'none';
  box.hidden = false;
  box.innerHTML = '';
  if (!res.length) {
    box.innerHTML = '<p class="sb-empty">Không tìm thấy 😕</p>';
    return;
  }
  const mark = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
  const byFile = {};
  res.forEach(r => (byFile[r.path] ??= []).push(r));
  for (const [p, hits] of Object.entries(byFile)) {
    const g = document.createElement('div');
    g.className = 'sb-result-group';
    const head = document.createElement('button');
    head.className = 'sb-result-file';
    head.textContent = `📄 ${p} (${hits.length})`;
    head.addEventListener('click', () => openDoc(p));
    g.appendChild(head);
    hits.slice(0, 4).forEach(h => {
      const item = document.createElement('button');
      item.className = 'sb-result-hit';
      item.innerHTML = h.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(mark, '<mark>$1</mark>');
      item.addEventListener('click', () => openDoc(p));
      g.appendChild(item);
    });
    box.appendChild(g);
  }
}

// ---------- Doc rendering ----------
async function openDoc(relPath, pushHash = true) {
  const md = await apiFile(relPath);

  const content = document.getElementById('content');
  if (md === null) {
    content.innerHTML = '<div class="welcome"><h1>😕 Không tải được tài liệu</h1></div>';
    return;
  }

  currentDoc = relPath;
  if (pushHash) location.hash = `doc=${encodeURIComponent(relPath)}`;
  store.set('prep-last-doc', relPath);

  const html = window.marked ? marked.parse(md) : `<pre>${md.replace(/</g, '&lt;')}</pre>`;
  content.innerHTML = `<div class="md">${html}</div>`;
  content.scrollTop = 0;

  // Syntax highlight
  if (window.hljs) content.querySelectorAll('pre code').forEach(el => { try { hljs.highlightElement(el); } catch {} });

  // Link nội bộ .md → mở trong app thay vì điều hướng trang
  content.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href');
    if (href.startsWith('http')) { a.target = '_blank'; return; }
    if (href.endsWith('.md') || href.includes('.md#')) {
      a.addEventListener('click', e => {
        e.preventDefault();
        const target = resolveRelative(relPath, href.split('#')[0]);
        openDoc(target);
      });
    }
  });

  // Task list "- [ ]" trong markdown → checkbox tick được, lưu tiến độ theo từng file
  attachTaskLists(content, relPath);

  // Nếu trang có <details> (đáp án quiz) → gắn chế độ quiz tự chấm
  const detailsCount = content.querySelectorAll('details').length;
  if (detailsCount > 0) attachQuizMode(content.querySelector('.md'), relPath, detailsCount);

  // Đánh dấu item active trong sidebar
  document.querySelectorAll('.sb-item').forEach(b =>
    b.classList.toggle('active', b.dataset.path === relPath));

  // Mobile: chọn xong tài liệu thì đóng sidebar lại
  document.getElementById('sidebar').classList.remove('open');
}

/** Cho phép tick checkbox task list trong tài liệu, trạng thái lưu theo path + thứ tự */
function attachTaskLists(content, docPath) {
  const boxes = content.querySelectorAll('.md input[type="checkbox"]');
  if (!boxes.length) return;
  const saved = store.get('prep-doc-checks', {})[docPath] || {};
  boxes.forEach((cb, i) => {
    cb.disabled = false;
    cb.checked = !!saved[i];
    cb.closest('li')?.classList.toggle('task-done', cb.checked);
    cb.addEventListener('change', () => {
      const all = store.get('prep-doc-checks', {});
      (all[docPath] ??= {})[i] = cb.checked;
      store.set('prep-doc-checks', all);
      cb.closest('li')?.classList.toggle('task-done', cb.checked);
      if (cb.checked) logActivity(); // tick xong một mục = một lượt học
    });
  });
}

/** Resolve đường dẫn tương đối kiểu '../capstone-project/README.md' */
function resolveRelative(fromPath, href) {
  const baseParts = fromPath.split('/').slice(0, -1);
  const parts = href.split('/');
  for (const p of parts) {
    if (p === '..') baseParts.pop();
    else if (p !== '.' && p !== '') baseParts.push(p);
  }
  return baseParts.join('/');
}

// ---------- Quiz tự chấm ----------
function attachQuizMode(mdEl, docPath, total) {
  const bar = document.createElement('div');
  bar.className = 'quiz-toolbar';
  bar.innerHTML = `
    <button class="qm-toggle">🧪 Chế độ quiz tự chấm</button>
    <span class="score" style="display:none"></span>
    <button class="qm-save" style="display:none">💾 Lưu điểm</button>
    <button class="qm-manual">✍️ Nhập điểm thủ công</button>`;

  // Nhập điểm tay — dùng khi quiz gom hết đáp án vào 1 thẻ details
  bar.querySelector('.qm-manual').addEventListener('click', () => {
    const input = prompt('Nhập điểm dạng "đúng/tổng" (ví dụ: 13/15):');
    const m = (input || '').match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
    if (!m) return;
    const scores = store.get('prep-quiz-scores', {});
    scores[docPath] = { correct: +m[1], total: +m[2], date: new Date().toISOString().slice(0, 10) };
    store.set('prep-quiz-scores', scores);
    logActivity(+m[2]);
    alert(`✅ Đã lưu ${m[1]}/${m[2]} cho trang này. Xem ở tab 📊 Tiến độ.`);
  });
  mdEl.prepend(bar);

  const toggleBtn = bar.querySelector('.qm-toggle');
  const scoreEl = bar.querySelector('.score');
  const saveBtn = bar.querySelector('.qm-save');
  let active = false;

  function updateScore() {
    const correct = mdEl.querySelectorAll('.quiz-judge .jc.picked').length;
    const judged = mdEl.querySelectorAll('.quiz-judge button.picked').length;
    scoreEl.textContent = `Điểm: ${correct}/${judged} (đã chấm ${judged} câu)`;
    return { correct, judged };
  }

  toggleBtn.addEventListener('click', () => {
    active = !active;
    toggleBtn.textContent = active ? '✋ Thoát chế độ quiz' : '🧪 Chế độ quiz tự chấm';
    scoreEl.style.display = saveBtn.style.display = active ? '' : 'none';

    mdEl.querySelectorAll('details').forEach(d => {
      d.open = false;
      let judge = d.nextElementSibling?.classList?.contains('quiz-judge') ? d.nextElementSibling : null;
      if (active && !judge) {
        judge = document.createElement('div');
        judge.className = 'quiz-judge';
        judge.innerHTML = `<button class="jc">✓ Tôi trả lời đúng</button><button class="jw">✗ Tôi trả lời sai</button>`;
        judge.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
          judge.querySelectorAll('button').forEach(x => x.classList.remove('picked'));
          b.classList.add('picked');
          updateScore();
        }));
        d.after(judge);
      }
      if (judge) judge.style.display = active ? '' : 'none';
    });
    if (active) updateScore();
  });

  saveBtn.addEventListener('click', () => {
    const { correct, judged } = updateScore();
    if (!judged) return alert('Bạn chưa chấm câu nào!');
    const scores = store.get('prep-quiz-scores', {});
    scores[docPath] = { correct, total: judged, date: new Date().toISOString().slice(0, 10) };
    store.set('prep-quiz-scores', scores);
    logActivity(judged);
    saveBtn.textContent = '✅ Đã lưu!';
    setTimeout(() => (saveBtn.textContent = '💾 Lưu điểm'), 1800);
  });
}

// ---------- Flashcards ----------
let DECK = [];       // toàn bộ card
let fcQueue = [];    // hàng đợi phiên học hiện tại
let fcIndex = 0;
let fcLoaded = false;
let fcReverse = store.get('prep-fc-dir', false); // false: Anh→Việt, true: Việt→Anh
let fcAuto = store.get('prep-fc-auto', false);   // tự đọc to khi hiện/lật thẻ

/** Tải file markdown thô (dùng chung cho flashcards + luyện viết) */
function fetchMd(relPath) {
  return apiFile(relPath);
}

let deckPromise = null;
/** Tải + parse bộ từ vựng một lần duy nhất, dùng chung mọi tab */
function loadDeck() {
  deckPromise ??= Promise.all([
    fetchMd('english/01-technical-vocabulary.md'),
    fetchMd('english/06-daily-life-vocabulary.md'),
    fetchMd('english/11-tu-vung-co-ban-pho-bien.md'),
  ]).then(([tech, daily, basic]) => {
    DECK = [
      ...(tech ? parseVocab(tech) : []),
      ...(daily ? parseVocab(daily, true) : []),  // file giao tiếp: mọi heading là một chủ đề
      ...(basic ? parseVocab(basic, true) : []),  // ~640 từ cơ bản phổ biến: mỗi heading là một chủ đề
    ];
    return DECK;
  });
  return deckPromise;
}

async function initFlashcards() {
  if (fcLoaded) return;
  const deck = await loadDeck();
  if (!deck.length) {
    document.querySelector('.fc-front').innerHTML = '<p>Không tải được file từ vựng 😕</p>';
    return;
  }
  fcLoaded = true;

  fillFcWeekSelect();
  updateFcDirLabel();
  document.getElementById('fc-week').addEventListener('change', startSession);
  document.getElementById('fc-shuffle').addEventListener('click', startSession);
  document.getElementById('fc-dir').addEventListener('click', () => {
    fcReverse = !fcReverse;
    store.set('prep-fc-dir', fcReverse);
    updateFcDirLabel();
    showCard();
  });
  document.getElementById('fc-speak').addEventListener('click', () =>
    speakCard(document.getElementById('fc-card').classList.contains('flipped')));
  document.getElementById('fc-auto').addEventListener('click', () => {
    fcAuto = !fcAuto;
    store.set('prep-fc-auto', fcAuto);
    updateFcAutoLabel();
    if (fcAuto) speakCard(false);
  });
  updateFcAutoLabel();
  initFcHotkeys();
  document.getElementById('fc-card').addEventListener('click', () => {
    const el = document.getElementById('fc-card');
    el.classList.toggle('flipped');
    // Vừa lật ra đáp án + đang bật tự đọc → đọc từ kèm câu ví dụ
    if (fcAuto && el.classList.contains('flipped')) speakCard(true);
  });
  document.getElementById('fc-again').addEventListener('click', () => gradeCard(false));
  document.getElementById('fc-good').addEventListener('click', () => gradeCard(true));
  startSession();
}

/** Parse bảng markdown |Từ|IPA|Nghĩa|Ví dụ| theo từng heading.
 *  everyHeading=false: chỉ nhận heading có "Week/Tuần" (file kỹ thuật);
 *  everyHeading=true: mọi heading là một chủ đề (file giao tiếp). */
function parseVocab(md, everyHeading = false) {
  const cards = [];
  let week = everyHeading ? '🗣️ Khác' : 'Khác';
  for (const line of md.split('\n')) {
    const h = line.match(/^#{2,3}\s+(.*)/);
    if (h) {
      const t = h[1].trim();
      if (everyHeading || /week|tuần/i.test(t)) week = t.replace(/[*_`]/g, '');
      continue;
    }
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').map(c => c.trim()).filter((c, i, a) => !(i === 0 && c === '') && !(i === a.length - 1 && c === ''));
    if (cells.length < 3) continue;
    if (/^[-:\s]+$/.test(cells[0])) continue;               // dòng kẻ bảng
    if (/từ|word|ipa/i.test(cells[0] + cells[1])) continue;  // dòng header
    cards.push({
      id: cells[0].replace(/[*`⚠️]/g, '').trim(),
      front: cells[0].replace(/[*`]/g, '').trim(),
      ipa: cells[1] || '',
      meaning: cells[2] || '',
      example: cells[3] || '',
      week,
      daily: everyHeading,
    });
  }
  return cards;
}

/** Dựng option tuần + 📬 đến hạn + 🔥 từ cứng đầu (đếm lại mỗi lần mở tab) */
function fillFcWeekSelect() {
  const sel = document.getElementById('fc-week');
  const prev = sel.value;
  const weeks = [...new Set(DECK.map(c => c.week))];
  sel.innerHTML = '<option value="">— Tất cả các tuần —</option>' +
    `<option value="__due__">📬 Đến hạn ôn hôm nay (${filterDeck('__due__').length})</option>` +
    `<option value="__leech__">🔥 Từ cứng đầu — sai ≥${LEECH_THRESHOLD} lần (${filterDeck('__leech__').length})</option>` +
    `<option value="__tech__">💻 Toàn bộ từ kỹ thuật (${filterDeck('__tech__').length})</option>` +
    `<option value="__daily__">🗣️ Toàn bộ từ giao tiếp (${filterDeck('__daily__').length})</option>` +
    weeks.map(w => `<option value="${w}">${w} (${DECK.filter(c => c.week === w).length} từ)</option>`).join('');
  if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
}

function startSession() {
  const week = document.getElementById('fc-week').value;
  const srs = store.get('prep-srs', {});
  let cards = filterDeck(week);
  // Ưu tiên từ chưa thuộc (box thấp lên trước), trong cùng box thì xáo ngẫu nhiên
  cards.sort((a, b) => ((srs[a.id]?.box || 0) - (srs[b.id]?.box || 0)) || Math.random() - 0.5);
  fcQueue = cards;
  fcIndex = 0;
  showCard();
}

function showCard() {
  const card = fcQueue[fcIndex];
  const el = document.getElementById('fc-card');
  el.classList.remove('flipped');
  const front = el.querySelector('.fc-front');
  const back = el.querySelector('.fc-back');
  if (!card) {
    front.innerHTML = '<p>🎉 Hết thẻ trong phiên này! Bấm 🔀 Xáo bài để học lại.</p>';
    back.innerHTML = '';
    updateFcStats();
    return;
  }
  const wordSide = `
    <span class="fc-week-tag">${card.week}</span>
    <div class="fc-word">${card.front}</div>
    <div class="fc-ipa">${card.ipa}</div>`;
  const meaningSide = `
    <span class="fc-week-tag">${card.week}</span>
    <div class="fc-meaning">${card.meaning}</div>`;
  front.innerHTML = fcReverse ? meaningSide : wordSide;
  back.innerHTML = fcReverse
    ? `<div class="fc-word">${card.front}</div>
       <div class="fc-ipa">${card.ipa}</div>
       <div class="fc-example">${card.example}</div>`
    : `<div class="fc-meaning">${card.meaning}</div>
       <div class="fc-example">${card.example}</div>`;
  // Tự đọc khi hiện thẻ mới — chỉ ở chiều Anh→Việt (chiều Việt→Anh đọc từ là lộ đáp án)
  if (fcAuto && !fcReverse) speakCard(false);
  updateFcStats();
}

function updateFcDirLabel() {
  document.getElementById('fc-dir').textContent = fcReverse ? '🔄 Việt→Anh' : '🔄 Anh→Việt';
}

function updateFcAutoLabel() {
  document.getElementById('fc-auto').textContent = fcAuto ? '🔁 Tự đọc: BẬT' : '🔁 Tự đọc: TẮT';
}

/** Đọc to thẻ hiện tại; withExample=true thì kèm câu ví dụ (bỏ phần chú thích "— ⚠️…") */
function speakCard(withExample) {
  const card = fcQueue[fcIndex];
  if (!card) return;
  const word = cleanTarget(card.front);
  const example = (card.example || '').replace(/[`*]/g, '').replace(/—.*$/, '').trim();
  speak(withExample && example ? `${word}. ${example}` : word);
}

/** Phím tắt riêng cho tab flashcards: Space lật, ← chưa nhớ, → nhớ rồi, S nghe */
function initFcHotkeys() {
  document.addEventListener('keydown', e => {
    if (!document.getElementById('view-flashcards').classList.contains('active')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    const el = document.getElementById('fc-card');
    if (e.key === ' ') {
      e.preventDefault(); // chặn cuộn trang
      el.classList.toggle('flipped');
      if (fcAuto && el.classList.contains('flipped')) speakCard(true);
    } else if (e.key === 'ArrowRight') {
      gradeCard(true);
    } else if (e.key === 'ArrowLeft') {
      gradeCard(false);
    } else if (e.key === 's' || e.key === 'S') {
      speakCard(el.classList.contains('flipped'));
    }
  });
}

function gradeCard(known) {
  const card = fcQueue[fcIndex];
  if (!card) return;
  bumpSrs(card, known);
  logActivity();
  if (!known) fcQueue.push(card); // chưa nhớ → quay lại cuối hàng đợi
  fcIndex++;
  showCard();
}

function updateFcStats() {
  const srs = store.get('prep-srs', {});
  const week = document.getElementById('fc-week').value;
  const cards = filterDeck(week);
  const known = cards.filter(c => (srs[c.id]?.box || 0) >= 2).length;
  document.getElementById('fc-stats').textContent = `Đã thuộc ${known}/${cards.length} từ`;
  document.getElementById('fc-progress').textContent =
    fcQueue[fcIndex] ? `Thẻ ${Math.min(fcIndex + 1, fcQueue.length)}/${fcQueue.length}` : '';
}

// ---------- Luyện viết (typing practice) ----------
// 3 chế độ: word (nghĩa Việt → gõ từ Anh), cloze (điền từ vào câu ví dụ),
// sentence (nghe TTS / đọc bản dịch → gõ lại cả câu).
let wrInit = false;
let wrMode = 'word';
let wrQueue = [];
let wrIndex = 0;
let wrState = 'answering'; // answering | done | finished
let wrHintLevel = 0;
let wrStreak = 0;
let wrCorrect = 0;
let wrTotalAnswered = 0;
let WR_SENTENCES = null; // { pairs: [{en, vi, week}], questions: [{en}] }

function speak(text) {
  if (!('speechSynthesis' in window) || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = 0.92;
  const voice = speechSynthesis.getVoices().find(v => v.lang && v.lang.startsWith('en'));
  if (voice) u.voice = voice;
  speechSynthesis.speak(u);
}

// ---------- Speech Recognition (chế độ 🎤 Đọc to) ----------
let wrRecog = null;
function startListening() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const fb = document.getElementById('wr-feedback');
  const mic = document.getElementById('wr-mic');
  if (!SR) {
    fb.innerHTML = '<div class="wr-wrong">Trình duyệt này chưa hỗ trợ nhận diện giọng nói — hãy dùng Chrome/Edge nhé.</div>';
    return;
  }
  if (wrRecog) { wrRecog.abort(); wrRecog = null; mic.classList.remove('listening'); return; }

  wrRecog = new SR();
  wrRecog.lang = 'en-US';
  wrRecog.interimResults = false;
  wrRecog.maxAlternatives = 1;
  mic.classList.add('listening');
  fb.innerHTML = '<div class="wr-hint">🎙️ Đang nghe… đọc to câu trên rồi ngừng nói để máy chấm.</div>';

  wrRecog.onresult = e => {
    const transcript = e.results[0][0].transcript;
    document.getElementById('wr-input').value = transcript;
    if (wrState === 'answering') checkWr();
  };
  wrRecog.onerror = e => {
    fb.innerHTML = `<div class="wr-wrong">Không nghe được (${e.error}) — kiểm tra quyền micro rồi thử lại.</div>`;
  };
  wrRecog.onend = () => {
    mic.classList.remove('listening');
    wrRecog = null;
  };
  wrRecog.start();
}

/** Chuẩn hóa để so sánh: thường hóa, bỏ dấu câu, gạch nối → khoảng trắng */
function normAnswer(s) {
  return s.toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[-–—/]/g, ' ')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const wrTokens = s => normAnswer(s).split(' ').filter(Boolean);

/** LCS: trả về tập index của `a` khớp được với `b` (để tô màu diff từng từ) */
function lcsMatch(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const matched = new Set();
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { matched.add(i); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return matched;
}

/** 'event loop' → 'e···· l···' — gợi ý chữ cái đầu */
function maskWords(s) {
  return s.split(/\s+/).map(w => w[0] + '·'.repeat(Math.max(w.length - 1, 0))).join(' ');
}

const escHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Từ cần gõ: bỏ ⚠️ và phần chú thích trong ngoặc */
function cleanTarget(front) {
  return front.replace(/⚠️/g, '').replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();
}

/** Parse các câu "Luyện nói cuối tuần": `1. *EN*` rồi dòng `→ VN` */
function parseSentencePairs(md) {
  const pairs = [];
  let week = '';
  const lines = md.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^##\s+(.+)/);
    if (h) { week = h[1].trim(); continue; }
    const m = lines[i].match(/^\d+\.\s+\*(.+)\*\s*$/);
    if (!m) continue;
    const next = (lines[i + 1] || '').trim();
    const vi = next.match(/^→\s*(.+)/);
    pairs.push({
      en: m[1].replace(/[`*]/g, '').trim(),
      vi: vi ? vi[1].replace(/[`*]/g, '').trim() : '',
      week,
    });
  }
  return pairs;
}

/** Parse 10 câu hỏi phỏng vấn: `#### Q1. "..."` trong 04-interview-english.md */
function parseInterviewQuestions(md) {
  const out = [];
  for (const line of md.split('\n')) {
    const m = line.match(/^####\s*Q\d+\.\s*"(.+)"\s*$/);
    if (!m) continue;
    // Bỏ phương án sau " / " và chú thích trong ngoặc cho dễ gõ
    const en = m[1].split(' / ')[0].replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
    out.push({ en });
  }
  return out;
}

async function loadSentences() {
  if (WR_SENTENCES) return WR_SENTENCES;
  const [vocabMd, ivMd, dailyMd] = await Promise.all([
    fetchMd('english/01-technical-vocabulary.md'),
    fetchMd('english/04-interview-english.md'),
    fetchMd('english/06-daily-life-vocabulary.md'),
  ]);
  WR_SENTENCES = {
    pairs: [
      ...(vocabMd ? parseSentencePairs(vocabMd) : []),
      ...(dailyMd ? parseSentencePairs(dailyMd) : []),
    ],
    questions: ivMd ? parseInterviewQuestions(ivMd) : [],
  };
  return WR_SENTENCES;
}

async function initWriting() {
  if (wrInit) return;
  wrInit = true;
  await Promise.all([loadDeck(), loadSentences()]);

  document.querySelectorAll('.wr-mode').forEach(b => b.addEventListener('click', () => {
    wrMode = b.dataset.mode;
    document.querySelectorAll('.wr-mode').forEach(x => x.classList.toggle('active', x === b));
    document.getElementById('wr-mic').hidden = wrMode !== 'speak';
    document.getElementById('wr-input').placeholder = wrMode === 'speak'
      ? 'Bấm 🎤 và đọc to — máy sẽ ghi lại những gì nghe được…'
      : 'Gõ tiếng Anh rồi nhấn Enter…';
    fillWrWeekSelect();
    startWrSession();
  }));
  document.getElementById('wr-mic').addEventListener('click', startListening);
  document.getElementById('wr-week').addEventListener('change', startWrSession);
  document.getElementById('wr-input').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    wrState === 'answering' ? checkWr() : nextWr();
  });
  document.getElementById('wr-check').addEventListener('click', () =>
    wrState === 'answering' ? checkWr() : nextWr());
  document.getElementById('wr-hint').addEventListener('click', showWrHint);
  document.getElementById('wr-skip').addEventListener('click', skipWr);
  document.getElementById('wr-speak').addEventListener('click', () => {
    const it = wrQueue[wrIndex];
    if (it) speak(it.say);
  });
  // Một số trình duyệt nạp danh sách giọng đọc bất đồng bộ
  if ('speechSynthesis' in window) speechSynthesis.getVoices();

  fillWrWeekSelect();
  startWrSession();
}

function fillWrWeekSelect() {
  const sel = document.getElementById('wr-week');
  const prev = sel.value;
  if (wrMode === 'mix') {
    sel.innerHTML = `<option value="">⚡ Mix tự chọn: ${filterDeck('__due__').length} từ đến hạn + cloze + câu nói</option>`;
    return;
  }
  if (wrMode === 'sentence' || wrMode === 'speak' || wrMode === 'listen') {
    const weeks = [...new Set(WR_SENTENCES.pairs.map(p => p.week))];
    sel.innerHTML = '<option value="">— Tất cả (câu mẫu + câu hỏi PV) —</option>' +
      '<option value="__iv__">🎤 Chỉ câu hỏi phỏng vấn</option>' +
      weeks.map(w => `<option value="${escHtml(w)}">${escHtml(w)}</option>`).join('');
  } else {
    const weeks = [...new Set(DECK.map(c => c.week))];
    sel.innerHTML = '<option value="">— Tất cả các tuần —</option>' +
      `<option value="__due__">📬 Đến hạn ôn hôm nay (${filterDeck('__due__').length})</option>` +
      `<option value="__leech__">🔥 Từ cứng đầu — sai ≥${LEECH_THRESHOLD} lần (${filterDeck('__leech__').length})</option>` +
      `<option value="__tech__">💻 Toàn bộ từ kỹ thuật (${filterDeck('__tech__').length})</option>` +
      `<option value="__daily__">🗣️ Toàn bộ từ giao tiếp (${filterDeck('__daily__').length})</option>` +
      weeks.map(w => `<option value="${escHtml(w)}">${escHtml(w)} (${DECK.filter(c => c.week === w).length} từ)</option>`).join('');
  }
  if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
}

/** Item "gõ từ Anh theo nghĩa Việt" từ một card */
function wrWordItem(c) {
  const target = cleanTarget(c.front);
  return target && {
    type: 'word',
    prompt: `<div class="wr-vi">${escHtml(c.meaning)}</div><div class="wr-sub">${escHtml(c.week)}</div>`,
    answer: target,
    say: target,
    hint1: `IPA: ${escHtml(c.ipa || '—')} · ${maskWords(target)}`,
    card: c,
  };
}

/** Item "điền từ vào câu ví dụ" — null nếu ví dụ không chứa từ */
function wrClozeItem(c) {
  // Cụm có nhiều phương án ('egress / ingress') → lấy phương án đầu
  const target = cleanTarget(c.front).split('/')[0].trim();
  const example = (c.example || '').replace(/[`*]/g, '');
  if (!target || !example) return null;
  // Cho phép hậu tố (execute → executes) và gạch nối/khoảng trắng giữa các từ
  const re = new RegExp('\\b' + target.split(/\s+/).map(escRe).join('[\\s-]+') + '\\w*', 'i');
  const m = example.match(re);
  if (!m) return null;
  return {
    type: 'cloze',
    prompt: `<div class="wr-en">${escHtml(example.replace(re, '⟨…⟩')).replace('⟨…⟩', '<span class="wr-blank">_____</span>')}</div>
             <div class="wr-sub">nghĩa của từ cần điền: <b>${escHtml(c.meaning)}</b> · ${escHtml(c.week)}</div>`,
    answer: m[0],
    altAnswer: target, // chấp nhận cả dạng gốc của từ
    say: example,
    hint1: maskWords(m[0]),
    card: c,
  };
}

// Từ phổ biến không đáng làm từ khuyết trong chế độ nghe điền từ
const LISTEN_STOP = new Set(['the', 'this', 'that', 'with', 'from', 'your', 'have', 'will',
  'been', 'they', 'them', 'than', 'then', 'when', 'what', 'where', 'which', 'about', 'into',
  'over', 'under', 'after', 'before', 'because', 'their', 'there', 'these', 'those', 'would',
  'could', 'should', 'until', 'while', 'does', 'don\'t', 'doesn\'t']);

/** Item "nghe và điền từ khuyết": khoét tối đa 3 từ nội dung dài ≥4 ký tự */
function listenItem(p) {
  const words = p.en.split(/\s+/);
  const candidates = words
    .map((w, i) => ({ clean: w.replace(/[^a-zA-Z']/g, ''), i }))
    .filter(x => x.clean.length >= 4 && !LISTEN_STOP.has(x.clean.toLowerCase()));
  // Câu quá ngắn thì đừng khoét — sẽ trống gần hết, không còn ngữ cảnh để đoán
  if (candidates.length < 2 || words.length < 5) return null;
  // Rải đều các từ khuyết trên câu thay vì dồn về đầu
  const step = Math.max(1, Math.floor(candidates.length / 3));
  const chosen = [];
  for (let k = 0; k < candidates.length && chosen.length < 3; k += step) chosen.push(candidates[k]);
  const blanks = new Set(chosen.map(c => c.i));
  const display = words
    .map((w, i) => (blanks.has(i) ? '<span class="wr-blank">_____</span>' : escHtml(w)))
    .join(' ');
  const answer = chosen.map(c => c.clean).join(' ');
  return {
    type: 'sentence',
    prompt: `<div class="wr-label">👂 Nghe (tự phát, bấm 🔊 nghe lại) rồi gõ ${chosen.length} từ còn thiếu, cách nhau bằng dấu cách:</div>
             <div class="wr-en">${display}</div>
             <div class="wr-sub">${escHtml(p.vi || '')}${p.vi ? ' · ' : ''}${escHtml(p.week)}</div>`,
    answer,
    say: p.en,
    hint1: maskWords(answer),
    autoplay: true,
  };
}

/** Dựng hàng đợi câu hỏi cho phiên hiện tại theo mode + tuần đã chọn */
function buildWrQueue() {
  const week = document.getElementById('wr-week').value;
  const srs = store.get('prep-srs', {});

  if (wrMode === 'word') {
    let cards = filterDeck(week);
    cards.sort((a, b) => ((srs[a.id]?.box || 0) - (srs[b.id]?.box || 0)) || Math.random() - 0.5);
    return cards.map(wrWordItem).filter(Boolean);
  }

  if (wrMode === 'cloze') {
    const items = filterDeck(week).map(wrClozeItem).filter(Boolean);
    items.sort((a, b) => ((srs[a.card.id]?.box || 0) - (srs[b.card.id]?.box || 0)) || Math.random() - 0.5);
    return items;
  }

  // mix: phiên ôn nhanh ~10 câu — 5 từ (ưu tiên đến hạn) + 3 cloze + 2 câu nói
  if (wrMode === 'mix') {
    const due = filterDeck('__due__');
    const pool = due.length >= 8
      ? [...due]
      : [...due, ...filterDeck('').filter(c => !due.includes(c))];
    pool.sort((a, b) => ((srs[a.id]?.box || 0) - (srs[b.id]?.box || 0)) || Math.random() - 0.5);
    const words = pool.slice(0, 5).map(wrWordItem).filter(Boolean);
    const cloze = pool.slice(5).map(wrClozeItem).filter(Boolean).slice(0, 3);
    const sents = [...WR_SENTENCES.pairs].sort(() => Math.random() - 0.5).slice(0, 2).map(p => ({
      type: 'sentence',
      prompt: `<div class="wr-label">📝 Dịch sang tiếng Anh (bấm 🔊 để nghe):</div><div class="wr-vi">${escHtml(p.vi)}</div><div class="wr-sub">${escHtml(p.week)}</div>`,
      answer: p.en,
      say: p.en,
      hint1: maskWords(p.en),
    }));
    return [...words, ...cloze, ...sents].sort(() => Math.random() - 0.5);
  }

  // listen mode: nghe câu, nhìn câu khuyết 2-3 từ khóa, chỉ gõ từ còn thiếu
  if (wrMode === 'listen') {
    let pool = week && week !== '__iv__'
      ? WR_SENTENCES.pairs.filter(p => p.week === week)
      : (week === '__iv__' ? [] : [...WR_SENTENCES.pairs]);
    if (!week || week === '__iv__') {
      pool = pool.concat(WR_SENTENCES.questions.map(q => ({ en: q.en, vi: '', week: 'Câu hỏi phỏng vấn' })));
    }
    const items = [];
    for (const p of pool) {
      const it = listenItem(p);
      if (it) items.push(it);
    }
    return items.sort(() => Math.random() - 0.5);
  }

  // speak mode: hiện câu tiếng Anh, đọc to, máy nghe và chấm từng từ
  if (wrMode === 'speak') {
    const pairs = week && week !== '__iv__'
      ? WR_SENTENCES.pairs.filter(p => p.week === week)
      : (week === '__iv__' ? [] : WR_SENTENCES.pairs);
    const items = pairs.map(p => ({
      type: 'speak',
      prompt: `<div class="wr-label">🎤 Bấm mic và đọc to câu này:</div>
               <div class="wr-en">${escHtml(p.en)}</div>
               <div class="wr-sub">${escHtml(p.vi)} · ${escHtml(p.week)}</div>`,
      answer: p.en,
      say: p.en,
      hint1: 'Bấm 🔊 nghe giọng mẫu rồi đọc theo, chú ý trọng âm',
    }));
    if (!week || week === '__iv__') {
      items.push(...WR_SENTENCES.questions.map((q, i) => ({
        type: 'speak',
        prompt: `<div class="wr-label">🎤 Đọc to câu hỏi phỏng vấn #${i + 1}:</div>
                 <div class="wr-en">${escHtml(q.en)}</div>
                 <div class="wr-sub">Đây là câu bạn sẽ NGHE trong phỏng vấn — đọc được thì nghe sẽ ra.</div>`,
        answer: q.en,
        say: q.en,
        hint1: 'Bấm 🔊 nghe giọng mẫu rồi đọc theo, chú ý trọng âm',
      })));
    }
    return items.sort(() => Math.random() - 0.5);
  }

  // sentence mode
  let items = [];
  const pairs = week && week !== '__iv__'
    ? WR_SENTENCES.pairs.filter(p => p.week === week)
    : (week === '__iv__' ? [] : WR_SENTENCES.pairs);
  items.push(...pairs.map(p => ({
    type: 'sentence',
    prompt: `<div class="wr-label">📝 Dịch sang tiếng Anh (bấm 🔊 để nghe):</div><div class="wr-vi">${escHtml(p.vi)}</div><div class="wr-sub">${escHtml(p.week)}</div>`,
    answer: p.en,
    say: p.en,
    hint1: maskWords(p.en),
  })));
  if (!week || week === '__iv__') {
    items.push(...WR_SENTENCES.questions.map((q, i) => ({
      type: 'sentence',
      prompt: `<div class="wr-label">🎧 Câu hỏi phỏng vấn #${i + 1} — bấm 🔊 nghe rồi gõ lại:</div><div class="wr-sub">Mẹo: nghe được bao nhiêu gõ bấy nhiêu, sai sẽ thấy diff từng từ.</div>`,
      answer: q.en,
      say: q.en,
      hint1: maskWords(q.en),
      autoplay: true,
    })));
  }
  return items.sort(() => Math.random() - 0.5);
}

function startWrSession() {
  wrQueue = buildWrQueue();
  wrIndex = 0;
  wrCorrect = 0;
  wrTotalAnswered = 0;
  wrStreak = 0;
  showWr();
}

function showWr() {
  const it = wrQueue[wrIndex];
  const promptEl = document.getElementById('wr-prompt');
  const input = document.getElementById('wr-input');
  const fb = document.getElementById('wr-feedback');
  fb.innerHTML = '';
  input.value = '';
  wrHintLevel = 0;
  wrState = 'answering';

  if (!it) {
    wrState = 'finished';
    const total = wrTotalAnswered || 1;
    promptEl.innerHTML = `<div class="wr-vi">🎉 Hết câu trong phiên này!</div>
      <div class="wr-sub">Đúng ${wrCorrect}/${wrTotalAnswered} câu (${Math.round(wrCorrect / total * 100)}%). Nhấn Enter để học lại.</div>`;
    updateWrStats();
    return;
  }

  promptEl.innerHTML = it.prompt;
  if (it.autoplay) speak(it.say);
  input.focus();
  updateWrStats();
}

function updateWrStats() {
  const best = store.get('prep-typing-best', 0);
  document.getElementById('wr-stats').textContent =
    `✅ ${wrCorrect} đúng · 🔥 chuỗi ${wrStreak} (kỷ lục ${best})`;
  document.getElementById('wr-progress').textContent =
    wrQueue[wrIndex] ? `Câu ${wrIndex + 1}/${wrQueue.length}` : '';
}

function checkWr() {
  const it = wrQueue[wrIndex];
  if (!it) return;
  const input = document.getElementById('wr-input');
  const fb = document.getElementById('wr-feedback');
  const user = input.value.trim();
  if (!user) { input.focus(); return; }

  let ok;
  if (it.type === 'sentence' || it.type === 'speak') {
    const exp = wrTokens(it.answer);
    const got = wrTokens(user);
    const matched = lcsMatch(exp, got);
    const pct = Math.round((matched.size / exp.length) * 100);
    // Đọc to: máy nghe không tuyệt đối nên khớp ≥90% là đạt; gõ thì phải đúng 100%
    ok = it.type === 'speak'
      ? pct >= 90
      : matched.size === exp.length && got.length === exp.length;
    if (!ok) {
      // Tô màu theo token đã chuẩn hóa để chỉ số luôn khớp với tập matched
      const colored = exp.map((w, i) =>
        `<span class="${matched.has(i) ? 'wr-ok' : 'wr-miss'}">${escHtml(w)}</span>`).join(' ');
      fb.innerHTML = it.type === 'speak'
        ? `<div class="wr-wrong">✗ Máy nghe khớp ${pct}% — từ <span class="wr-miss">đỏ</span> là từ phát âm chưa rõ, bấm 🎤 đọc lại:</div>
           <div class="wr-answer">${colored}</div>
           <div class="wr-sub">Máy nghe ra: “${escHtml(user)}”</div>`
        : `<div class="wr-wrong">✗ Khớp ${pct}% — từ <span class="wr-miss">đỏ</span> là chỗ sai/thiếu, sửa rồi Enter thử lại:</div>
           <div class="wr-answer">${colored}</div>`;
      wrStreak = 0;
      updateWrStats();
      if (it.type !== 'speak') input.focus();
      return;
    }
  } else {
    ok = normAnswer(user) === normAnswer(it.answer) ||
         (it.altAnswer && normAnswer(user) === normAnswer(it.altAnswer));
    if (!ok) {
      fb.innerHTML = `<div class="wr-wrong">✗ Chưa đúng — gợi ý: <b>${escHtml(maskWords(it.answer))}</b> (${it.answer.length} ký tự). Sửa rồi Enter thử lại, hoặc ⏭️ xem đáp án.</div>`;
      wrStreak = 0;
      if (!it.retried) { it.retried = true; bumpSrs(it.card, false); }
      updateWrStats();
      input.select();
      return;
    }
  }

  // Đúng!
  wrTotalAnswered++;
  wrCorrect++;
  wrStreak++;
  logActivity();
  const best = store.get('prep-typing-best', 0);
  if (wrStreak > best) store.set('prep-typing-best', wrStreak);
  if (!it.retried) bumpSrs(it.card, true);
  const cheer = wrStreak >= 5 ? ` 🔥 Chuỗi ${wrStreak}!` : '';
  fb.innerHTML = `<div class="wr-right">✅ Chính xác!${cheer}</div>
    <div class="wr-answer">${escHtml(it.answer)}</div>`;
  if (it.type !== 'sentence') speak(it.say);
  wrState = 'done';
  document.getElementById('wr-input').blur();
  updateWrStats();
}

function showWrHint() {
  const it = wrQueue[wrIndex];
  if (!it || wrState !== 'answering') return;
  const fb = document.getElementById('wr-feedback');
  wrHintLevel++;
  if (wrHintLevel === 1) {
    fb.innerHTML = `<div class="wr-hint">💡 ${escHtml(it.hint1)}</div>`;
  } else {
    fb.innerHTML = `<div class="wr-hint">💡 Đáp án: <b>${escHtml(it.answer)}</b> — gõ lại để nhớ tay nhé!</div>`;
  }
  document.getElementById('wr-input').focus();
}

function skipWr() {
  const it = wrQueue[wrIndex];
  if (!it) return;
  if (wrState === 'answering') {
    wrTotalAnswered++;
    wrStreak = 0;
    logActivity();
    bumpSrs(it.card, false);
    // Học lại từ này ở cuối phiên
    if (!it.requeued) wrQueue.push({ ...it, requeued: true, retried: false });
    document.getElementById('wr-feedback').innerHTML =
      `<div class="wr-hint">Đáp án: <b>${escHtml(it.answer)}</b> — sẽ gặp lại ở cuối phiên. Enter để tiếp tục.</div>`;
    speak(it.say);
    wrState = 'done';
    updateWrStats();
    return;
  }
  nextWr();
}

function nextWr() {
  if (wrState === 'finished') return startWrSession();
  wrIndex++;
  showWr();
}

// ---------- Luyện gõ code ----------
// Snippet lấy từ /api/snippets (code block trong README tuần + design-patterns).
// Chỉ ký tự đúng mới đi tiếp; thụt đầu dòng được nhảy qua tự động như typing.io.
let ctInit = false;
let CT_SNIPPETS = [];
let ctCur = null;       // snippet đang gõ
let ctPos = 0;          // vị trí ký tự hiện tại
let ctTyped = 0;        // tổng phím đã gõ (kể cả sai)
let ctErrors = 0;
let ctStartAt = 0;      // bắt đầu tính giờ từ phím đầu tiên
let ctDone = false;

async function initCodeTyping() {
  if (ctInit) return;
  ctInit = true;
  document.getElementById('ct-meta').textContent = 'Đang tải snippet…';
  CT_SNIPPETS = await apiSnippets().catch(() => []);
  if (!CT_SNIPPETS.length) {
    document.getElementById('ct-meta').textContent = 'Không tải được snippet 😕';
    return;
  }

  const sel = document.getElementById('ct-source');
  const files = [...new Set(CT_SNIPPETS.map(s => s.file))];
  sel.innerHTML = `<option value="">— Tất cả nguồn (${CT_SNIPPETS.length} snippet) —</option>` +
    files.map(f => `<option value="${escHtml(f)}">${escHtml(f)} (${CT_SNIPPETS.filter(s => s.file === f).length})</option>`).join('');
  sel.addEventListener('change', nextCtSnippet);
  document.getElementById('ct-next').addEventListener('click', nextCtSnippet);
  document.getElementById('ct-code').addEventListener('keydown', ctKeydown);
  nextCtSnippet();
}

function nextCtSnippet() {
  const file = document.getElementById('ct-source').value;
  const pool = file ? CT_SNIPPETS.filter(s => s.file === file) : CT_SNIPPETS;
  ctCur = pool[Math.floor(Math.random() * pool.length)];
  if (!ctCur) return;

  document.getElementById('ct-meta').textContent =
    `${ctCur.title || 'Snippet'} · ${ctCur.file} · ${ctCur.lang}`;
  document.getElementById('ct-result').innerHTML = '';

  const pre = document.getElementById('ct-code');
  pre.innerHTML = '';
  [...ctCur.code].forEach(ch => {
    const s = document.createElement('span');
    s.textContent = ch === '\n' ? '⏎\n' : ch;
    pre.appendChild(s);
  });

  ctPos = 0; ctTyped = 0; ctErrors = 0; ctStartAt = 0; ctDone = false;
  ctMarkCursor();
  updateCtStats();
  pre.focus();
}

function ctSpans() { return document.getElementById('ct-code').children; }

function ctMarkCursor() {
  const spans = ctSpans();
  for (const s of spans) s.classList.remove('cur', 'bad');
  if (spans[ctPos]) spans[ctPos].classList.add('cur');
}

function updateCtStats() {
  const best = store.get('prep-code-best', null);
  const acc = ctTyped ? Math.round(((ctTyped - ctErrors) / ctTyped) * 100) : 100;
  document.getElementById('ct-stats').textContent =
    `${ctPos}/${ctCur ? ctCur.code.length : 0} ký tự · ${ctErrors} lỗi (${acc}%)` +
    (best ? ` · 🏆 kỷ lục ${best.wpm} WPM` : '');
}

function ctKeydown(e) {
  if (!ctCur) return;
  if (ctDone) {
    if (e.key === 'Enter') { e.preventDefault(); nextCtSnippet(); }
    return;
  }

  const code = ctCur.code;
  const expect = code[ctPos];
  let match;
  if (e.key === 'Enter') match = expect === '\n';
  else if (e.key === 'Tab') match = expect === '\t' || expect === ' ';
  else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) match = e.key === expect;
  else return; // bỏ qua phím điều khiển (Shift, mũi tên, F5…)

  e.preventDefault();
  if (!ctStartAt) ctStartAt = Date.now();
  ctTyped++;

  const spans = ctSpans();
  if (!match) {
    ctErrors++;
    spans[ctPos]?.classList.add('bad');
    updateCtStats();
    return;
  }

  spans[ctPos]?.classList.add('ok');
  ctPos++;
  // Xuống dòng xong → nhảy qua thụt đầu dòng cho đỡ mỏi tay
  if (expect === '\n') {
    while (code[ctPos] === ' ' || code[ctPos] === '\t') {
      spans[ctPos]?.classList.add('ok');
      ctPos++;
    }
  }

  if (ctPos >= code.length) return finishCt();
  ctMarkCursor();
  updateCtStats();
}

function finishCt() {
  ctDone = true;
  ctMarkCursor();
  logActivity();

  const minutes = Math.max((Date.now() - ctStartAt) / 60000, 1 / 60);
  const wpm = Math.round(ctCur.code.length / 5 / minutes);
  const acc = Math.round(((ctTyped - ctErrors) / ctTyped) * 100);

  const best = store.get('prep-code-best', null);
  const isRecord = !best || wpm > best.wpm;
  if (isRecord) store.set('prep-code-best', { wpm, acc });

  // Lưu lịch sử để vẽ đồ thị tiến bộ ở dashboard (giữ 100 lượt gần nhất)
  const history = store.get('prep-code-history', []);
  history.push({ date: dayKey(new Date()), wpm, acc });
  store.set('prep-code-history', history.slice(-100));

  document.getElementById('ct-result').innerHTML =
    `<span class="big">🎉 ${wpm} WPM</span> · chính xác ${acc}% · ${ctErrors} lỗi` +
    (isRecord ? ' · 🏆 KỶ LỤC MỚI!' : ` · kỷ lục ${best.wpm} WPM`) +
    '<br><span style="color:var(--muted)">Nhấn Enter để gõ snippet tiếp theo.</span>';
  updateCtStats();
}

// ---------- Mock Interview ----------
// Bốc ngẫu nhiên câu hỏi từ 180 câu Q&A của 12 tuần, đếm giờ, tự chấm, lưu lịch sử.
let mkInit = false;
let MK_POOL = null; // [{q, a, week, weekLabel}]
let mkQueue = [], mkIndex = 0, mkRight = 0, mkTimerId = null, mkPerQ = 120;
let mkWrong = [];        // câu trả lời sai trong phiên hiện tại
let mkReviewMode = false; // phiên đang ôn lại "câu đã sai" → trả lời đúng sẽ gỡ khỏi kho

/** Khoá định danh một câu hỏi để khử trùng kho câu sai (câu hỏi là duy nhất) */
const mkKey = it => it.q;

/** Kho câu đã trả lời sai, để ôn lại sau — lưu {q,a,week,weekLabel} */
function getMockWrong() { return store.get('prep-mock-wrong', []); }
function addMockWrong(items) {
  const wrong = getMockWrong();
  const seen = new Set(wrong.map(mkKey));
  items.forEach(it => {
    if (!seen.has(mkKey(it))) { wrong.push({ q: it.q, a: it.a, week: it.week, weekLabel: it.weekLabel }); seen.add(mkKey(it)); }
  });
  store.set('prep-mock-wrong', wrong);
}
function removeMockWrong(it) {
  store.set('prep-mock-wrong', getMockWrong().filter(w => mkKey(w) !== mkKey(it)));
}

/** Parse '**Q1: ...**' + '**A:** ...' từ README tuần */
function parseQA(md, week, weekLabel) {
  const out = [];
  const re = /\*\*Q(\d+):\s*([\s\S]*?)\*\*\s*\n\*\*A:\*\*\s*([\s\S]*?)(?=\n\s*\n\s*\*\*Q\d+:|\n#{1,4}\s|$)/g;
  let m;
  while ((m = re.exec(md))) out.push({ q: m[2].trim(), a: m[3].trim(), week, weekLabel });
  return out;
}

async function loadMockPool() {
  if (MK_POOL) return MK_POOL;
  const weeksGroup = TREE.find(g => g.title.includes('12 tuần'));
  const weekItems = (weeksGroup?.items || []).filter(i => i.week && !i.sub);
  const all = await Promise.all(weekItems.map(async it => {
    const md = await fetchMd(it.path);
    return md ? parseQA(md, it.week, it.label) : [];
  }));
  // Bộ ⚡ rapid-fire 40 câu trả lời nhanh — phạm vi riêng trong dropdown
  const rapid = await fetchMd('week-12-mock-interview/RAPID-FIRE.md');
  if (rapid) all.push(parseQA(rapid, '__rapid__', '⚡ Rapid-fire — trả lời nhanh 30s/câu'));
  MK_POOL = all.flat();
  return MK_POOL;
}

async function initMock() {
  if (mkInit) return;
  mkInit = true;
  document.getElementById('mk-question').textContent = 'Đang tải kho câu hỏi…';
  await loadMockPool();

  fillMockWeekSelect();
  document.getElementById('mk-start').addEventListener('click', startMock);
  document.getElementById('mk-reveal').addEventListener('click', revealMock);
  document.getElementById('mk-right').addEventListener('click', () => gradeMock(true));
  document.getElementById('mk-wrong').addEventListener('click', () => gradeMock(false));
  document.getElementById('mk-quit').addEventListener('click', finishMock);
  document.getElementById('mk-question').textContent = '';
  initAiInterview();
}

/** Dựng lại dropdown phạm vi — gồm cả mục "🚩 câu đã sai" với số đếm cập nhật */
function fillMockWeekSelect() {
  const weekSel = document.getElementById('mk-week');
  if (!MK_POOL) return;
  const prev = weekSel.value;
  const weeks = [...new Map(MK_POOL.map(q => [q.week, q.weekLabel])).entries()];
  const wrongN = getMockWrong().length;
  weekSel.innerHTML = `<option value="">— Tất cả 12 tuần (${MK_POOL.length} câu) —</option>` +
    (wrongN ? `<option value="__wrong__">🚩 Câu đã trả lời sai (${wrongN})</option>` : '') +
    weeks.map(([w, label]) => `<option value="${w}">${escHtml(label)}</option>`).join('');
  if ([...weekSel.options].some(o => o.value === prev)) weekSel.value = prev;
}

function startMock() {
  const week = document.getElementById('mk-week').value;
  const count = +document.getElementById('mk-count').value;
  mkPerQ = +document.getElementById('mk-time').value * 60;
  mkReviewMode = week === '__wrong__';
  const pool = mkReviewMode ? getMockWrong()
    : week ? MK_POOL.filter(q => q.week === week) : [...MK_POOL];
  // Chế độ ôn câu sai: lấy hết (đến count) để xử lý cho cạn kho; còn lại bốc ngẫu nhiên
  mkQueue = pool.sort(() => Math.random() - 0.5).slice(0, count);
  mkIndex = 0;
  mkRight = 0;
  mkWrong = [];
  document.getElementById('mk-setup').hidden = true;
  document.getElementById('mk-result').hidden = true;
  document.getElementById('mk-session').hidden = false;
  showMockQ();
}

function showMockQ() {
  const it = mkQueue[mkIndex];
  if (!it) return finishMock();
  document.getElementById('mk-progress').textContent =
    `Câu ${mkIndex + 1}/${mkQueue.length} · ${it.weekLabel} · ✓ ${mkRight}`;
  document.getElementById('mk-question').innerHTML =
    window.marked ? marked.parse('**' + it.q + '**') : escHtml(it.q);
  const ansEl = document.getElementById('mk-answer');
  ansEl.hidden = true;
  ansEl.innerHTML = '';
  document.getElementById('mk-reveal').hidden = false;
  document.getElementById('mk-right').hidden = true;
  document.getElementById('mk-wrong').hidden = true;
  startMockTimer();
}

function startMockTimer() {
  clearInterval(mkTimerId);
  let left = mkPerQ;
  const el = document.getElementById('mk-timer');
  const tick = () => {
    el.textContent = `⏱ ${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
    el.classList.toggle('late', left <= 10);
    if (left <= 0) { clearInterval(mkTimerId); el.textContent = '⏱ HẾT GIỜ'; }
    left--;
  };
  tick();
  mkTimerId = setInterval(tick, 1000);
}

function revealMock() {
  clearInterval(mkTimerId);
  const it = mkQueue[mkIndex];
  const ansEl = document.getElementById('mk-answer');
  ansEl.innerHTML = window.marked ? marked.parse(it.a) : escHtml(it.a);
  ansEl.hidden = false;
  document.getElementById('mk-reveal').hidden = true;
  document.getElementById('mk-right').hidden = false;
  document.getElementById('mk-wrong').hidden = false;
}

function gradeMock(ok) {
  const it = mkQueue[mkIndex];
  if (ok) {
    mkRight++;
    if (mkReviewMode && it) removeMockWrong(it); // ôn lại đúng → coi như đã nắm, gỡ khỏi kho
  } else if (it) {
    mkWrong.push(it); // gom để cuối phiên lưu vào kho câu sai
  }
  logActivity();
  mkIndex++;
  showMockQ();
}

function finishMock() {
  clearInterval(mkTimerId);
  document.getElementById('mk-session').hidden = true;
  document.getElementById('mk-setup').hidden = false;
  const done = mkIndex;
  if (done > 0) {
    const history = store.get('prep-mock-history', []);
    history.push({
      date: new Date().toISOString().slice(0, 10),
      correct: mkRight,
      total: done,
      week: document.getElementById('mk-week').value || 'all',
    });
    store.set('prep-mock-history', history);
    // Lưu câu trả lời sai vào kho để ôn lại sau (khử trùng theo nội dung câu)
    if (mkWrong.length) addMockWrong(mkWrong);
    const pct = Math.round((mkRight / done) * 100);
    const verdict = pct >= 80 ? 'PASS ✅ — phong độ tốt, giữ vững!' :
                    pct >= 60 ? 'Gần đạt — xem lại các câu ✗ rồi chiến lại nhé.' :
                    'Chưa đạt — quay lại tài liệu tuần tương ứng ôn thêm đã.';
    const result = document.getElementById('mk-result');
    const wrongList = mkWrong.length ? `
      <details class="mk-wrong-list" open>
        <summary>🚩 ${mkWrong.length} câu cần ôn lại (đã lưu — chọn phạm vi “Câu đã trả lời sai” để luyện riêng)</summary>
        ${mkWrong.map(it => `
          <div class="mk-wrong-item">
            <div class="mk-wrong-q">${window.marked ? marked.parse('**' + it.q + '**') : escHtml(it.q)}</div>
            <details class="mk-wrong-a"><summary>Xem đáp án</summary>${window.marked ? marked.parse(it.a) : escHtml(it.a)}</details>
          </div>`).join('')}
      </details>` : '';
    const reviewNote = mkReviewMode
      ? `<p class="mk-review-note">Còn <b>${getMockWrong().length}</b> câu trong kho ôn lại.</p>` : '';
    result.innerHTML = `<h2>Kết quả: ${mkRight}/${done} (${pct}%)</h2><p>${verdict}</p>${reviewNote}${wrongList}`;
    result.hidden = false;
  }
  fillMockWeekSelect(); // cập nhật lại số đếm "câu đã sai" trên dropdown
  mkQueue = [];
  mkIndex = 0;
  mkWrong = [];
  mkReviewMode = false;
}

// ---------- Phỏng vấn AI (Claude đóng vai người phỏng vấn) ----------
// BYOK: người dùng dán API key Anthropic của họ, gọi thẳng api.anthropic.com từ trình duyệt
// (header anthropic-dangerous-direct-browser-access). Streaming SSE. Key lưu localStorage tuỳ chọn.
let aiInit = false;
let aiMessages = [];       // lịch sử hội thoại [{role, content}]
let aiBusy = false;
let aiFinished = false;
let aiRecog = null;
let aiCfg = { lang: 'vi', model: 'claude-opus-4-8', level: 'Mid-level', topic: '', tts: true };

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

/** Đọc to bằng giọng phù hợp ngôn ngữ phỏng vấn */
function aiSpeak(text) {
  if (!aiCfg.tts || !('speechSynthesis' in window) || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[*`#>_]/g, '').slice(0, 600));
  const wantVi = aiCfg.lang === 'vi';
  u.lang = wantVi ? 'vi-VN' : 'en-US';
  u.rate = 0.97;
  const voices = speechSynthesis.getVoices();
  const v = voices.find(x => x.lang && x.lang.toLowerCase().startsWith(wantVi ? 'vi' : 'en'));
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}

/** Gọi Claude với streaming, gọi onText cho mỗi đoạn token; trả về full text */
async function callClaudeStream({ apiKey, model, system, messages, maxTokens = 1024, onText }) {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, stream: true, messages }),
  });
  if (!res.ok || !res.body) {
    let msg = `HTTP ${res.status}`;
    try { const e = await res.json(); msg = e?.error?.message || msg; } catch {}
    if (res.status === 401) msg = 'API key không hợp lệ (401). Kiểm tra lại key.';
    else if (res.status === 429) msg = 'Quá nhiều yêu cầu hoặc hết hạn mức (429). Thử lại sau.';
    else if (res.status === 400 && /credit|balance/i.test(msg)) msg = 'Tài khoản API chưa có credit. Nạp tại console.anthropic.com.';
    throw new Error(msg);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '', full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      let ev; try { ev = JSON.parse(data); } catch { continue; }
      if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
        full += ev.delta.text;
        onText?.(full);
      } else if (ev.type === 'error') {
        throw new Error(ev.error?.message || 'Lỗi stream từ API');
      }
    }
  }
  return full;
}

function aiSystemPrompt() {
  const langInstr = aiCfg.lang === 'en'
    ? 'Conduct the entire interview in ENGLISH.'
    : aiCfg.lang === 'mix'
      ? 'Hỏi bằng tiếng Anh; có thể giải thích thêm ngắn gọn bằng tiếng Việt khi ứng viên có vẻ chưa rõ.'
      : 'Phỏng vấn bằng TIẾNG VIỆT, giữ nguyên thuật ngữ kỹ thuật bằng tiếng Anh.';
  return `Bạn là một interviewer kỹ thuật giàu kinh nghiệm, đang phỏng vấn ứng viên cho vị trí Backend Engineer (Node.js) cấp độ ${aiCfg.level}. Chủ đề trọng tâm: ${aiCfg.topic || 'tổng hợp backend'}.
${langInstr}

Quy tắc tiến hành:
- Hỏi MỘT câu mỗi lượt, như phỏng vấn thật. TUYỆT ĐỐI không tự trả lời thay ứng viên.
- Mở đầu: chào ngắn gọn (1 câu) rồi hỏi câu đầu tiên.
- Sau mỗi câu trả lời của ứng viên: nhận xét RẤT ngắn (tối đa 1 câu), rồi hoặc đào sâu bằng follow-up, hoặc chuyển câu hỏi mới. Thỉnh thoảng đưa tình huống thực tế (production/scaling).
- Nếu trả lời sai/thiếu: gợi mở để họ tự nhận ra, đừng giảng giải dài dòng.
- Giọng chuyên nghiệp, thân thiện. Mỗi lượt của bạn tối đa ~120 từ. Không dùng markdown nặng.
- Khi nhận message bắt đầu bằng "[ĐÁNH GIÁ]": DỪNG hỏi và viết tổng kết buổi phỏng vấn theo ĐÚNG thứ tự sau:
  1. **Điểm: X/10**
  2. **Tỷ lệ đỗ phỏng vấn ước tính: Y%** — ước lượng khả năng PASS vòng phỏng vấn này cho vị trí Backend Node.js cấp ${aiCfg.level}, kèm 1 câu lý do ngắn. Ghi rõ đây là ước tính tham khảo, không phải con số chính thức.
  3. ✅ Điểm mạnh
  4. ⚠️ Điểm cần cải thiện
  5. 💡 2-3 lời khuyên ôn tập cụ thể (gợi ý tuần/chủ đề nên xem lại).`;
}

function initAiInterview() {
  if (aiInit) return;
  aiInit = true;

  // mode switch self/ai
  document.querySelectorAll('.mkm').forEach(b => b.addEventListener('click', () => {
    const ai = b.dataset.mkmode === 'ai';
    document.querySelectorAll('.mkm').forEach(x => x.classList.toggle('active', x === b));
    document.getElementById('mk-ai').hidden = !ai;
    document.getElementById('mk-self').hidden = ai;
    if (ai) fillAiTopics();
  }));

  // nạp cài đặt + key đã lưu
  const saved = store.get('prep-ai-settings', null);
  if (saved) {
    aiCfg = { ...aiCfg, ...saved };
    document.getElementById('ai-model').value = aiCfg.model;
    document.getElementById('ai-lang').value = aiCfg.lang;
    document.getElementById('ai-level').value = aiCfg.level;
    document.getElementById('ai-tts').checked = aiCfg.tts;
  }
  const savedKey = store.get('prep-ai-key', '');
  if (savedKey) { document.getElementById('ai-key').value = savedKey; document.getElementById('ai-remember').checked = true; }

  document.getElementById('ai-start').addEventListener('click', aiStart);
  document.getElementById('ai-send').addEventListener('click', aiSend);
  document.getElementById('ai-end').addEventListener('click', aiEnd);
  document.getElementById('ai-quit').addEventListener('click', aiQuit);
  document.getElementById('ai-mic').addEventListener('click', aiListen);
  document.getElementById('ai-tts-toggle').addEventListener('click', () => {
    aiCfg.tts = !aiCfg.tts;
    document.getElementById('ai-tts-toggle').style.opacity = aiCfg.tts ? '1' : '.4';
    if (!aiCfg.tts && 'speechSynthesis' in window) speechSynthesis.cancel();
  });
  document.getElementById('ai-answer').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); aiSend(); }
  });
  if ('speechSynthesis' in window) speechSynthesis.getVoices();
  renderAiRecent();
}

/** Đổ chủ đề từ các tuần đã có trong kho mock */
function fillAiTopics() {
  const sel = document.getElementById('ai-topic');
  if (sel.options.length) return;
  let opts = '<option value="">— Tổng hợp 12 tuần —</option>';
  if (MK_POOL) {
    const weeks = [...new Map(MK_POOL.filter(q => q.week !== '__rapid__').map(q => [q.week, q.weekLabel])).entries()];
    opts += weeks.map(([w, label]) => `<option value="${escHtml(label)}">${escHtml(label)}</option>`).join('');
  }
  sel.innerHTML = opts;
}

function aiReadCfg() {
  aiCfg.model = document.getElementById('ai-model').value;
  aiCfg.lang = document.getElementById('ai-lang').value;
  aiCfg.level = document.getElementById('ai-level').value;
  aiCfg.topic = document.getElementById('ai-topic').value;
  aiCfg.tts = document.getElementById('ai-tts').checked;
  store.set('prep-ai-settings', { model: aiCfg.model, lang: aiCfg.lang, level: aiCfg.level, tts: aiCfg.tts });
}

function aiKey() { return document.getElementById('ai-key').value.trim(); }

async function aiStart() {
  const key = aiKey();
  if (!key) { alert('Hãy dán API key Anthropic của bạn trước.'); document.getElementById('ai-key').focus(); return; }
  aiReadCfg();
  // ghi nhớ key tuỳ chọn
  if (document.getElementById('ai-remember').checked) store.set('prep-ai-key', key);
  else localStorage.removeItem('prep-ai-key');

  aiMessages = [];
  aiFinished = false;
  document.getElementById('ai-setup').hidden = true;
  document.getElementById('ai-session').hidden = false;
  document.getElementById('ai-chat').innerHTML = '';
  document.getElementById('ai-meta').textContent =
    `${aiCfg.model.replace('claude-', '')} · ${aiCfg.level} · ${aiCfg.topic || 'Tổng hợp'}`;
  document.getElementById('ai-tts-toggle').style.opacity = aiCfg.tts ? '1' : '.4';
  // lượt đầu: nhờ interviewer chào + hỏi câu đầu
  aiMessages.push({ role: 'user', content: 'Xin chào, tôi đã sẵn sàng. Hãy bắt đầu buổi phỏng vấn.' });
  await aiTurn();
}

/** Gửi 1 lượt: stream phản hồi interviewer vào một bong bóng mới */
async function aiTurn() {
  if (aiBusy) return;
  aiBusy = true;
  setAiInputDisabled(true);
  const bubble = addAiBubble('assistant', '');
  const streamEl = bubble.querySelector('.ai-bubble-body');
  streamEl.textContent = '…';
  try {
    const full = await callClaudeStream({
      apiKey: aiKey(),
      model: aiCfg.model,
      system: aiSystemPrompt(),
      messages: aiMessages,
      maxTokens: aiFinished ? 1200 : 700,
      onText: t => { streamEl.textContent = t; scrollAiChat(); },
    });
    aiMessages.push({ role: 'assistant', content: full });
    // render markdown + đọc to
    streamEl.innerHTML = window.marked ? marked.parse(full) : escHtml(full);
    if (window.hljs) streamEl.querySelectorAll('pre code').forEach(el => { try { hljs.highlightElement(el); } catch {} });
    scrollAiChat();
    aiSpeak(full);
    logActivity();
    if (aiFinished) saveAiEvaluation(full);
  } catch (err) {
    streamEl.innerHTML = `<span class="ai-err">⚠️ ${escHtml(err.message)}</span>`;
  } finally {
    aiBusy = false;
    setAiInputDisabled(false);
    if (!aiFinished) document.getElementById('ai-answer').focus();
  }
}

async function aiSend() {
  if (aiBusy || aiFinished) return;
  const ta = document.getElementById('ai-answer');
  const text = ta.value.trim();
  if (!text) return;
  ta.value = '';
  addAiBubble('user', text);
  aiMessages.push({ role: 'user', content: text });
  scrollAiChat();
  await aiTurn();
}

async function aiEnd() {
  if (aiBusy || aiFinished) return;
  if (!aiMessages.some(m => m.role === 'assistant')) { aiQuit(); return; }
  aiFinished = true;
  document.getElementById('ai-end').disabled = true;
  addAiBubble('user', '🏁 Kết thúc — xin nhận xét & chấm điểm.');
  aiMessages.push({ role: 'user', content: '[ĐÁNH GIÁ] Buổi phỏng vấn kết thúc. Hãy tổng kết và chấm điểm theo đúng định dạng đã yêu cầu.' });
  await aiTurn();
}

function aiQuit() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  if (aiRecog) { try { aiRecog.abort(); } catch {} aiRecog = null; }
  document.getElementById('ai-session').hidden = true;
  document.getElementById('ai-setup').hidden = false;
  document.getElementById('ai-end').disabled = false;
  renderAiRecent();
}

/** Nghe câu trả lời bằng giọng nói */
function aiListen() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const mic = document.getElementById('ai-mic');
  if (!SR) { alert('Trình duyệt chưa hỗ trợ nhận diện giọng nói — dùng Chrome/Edge nhé.'); return; }
  if (aiRecog) { aiRecog.abort(); aiRecog = null; mic.classList.remove('listening'); return; }
  aiRecog = new SR();
  aiRecog.lang = aiCfg.lang === 'vi' ? 'vi-VN' : 'en-US';
  aiRecog.interimResults = true;
  aiRecog.continuous = true;
  mic.classList.add('listening');
  const ta = document.getElementById('ai-answer');
  let baseline = ta.value;
  aiRecog.onresult = e => {
    let txt = '';
    for (let i = e.resultIndex; i < e.results.length; i++) txt += e.results[i][0].transcript;
    ta.value = (baseline + ' ' + txt).trim();
  };
  aiRecog.onerror = () => { mic.classList.remove('listening'); aiRecog = null; };
  aiRecog.onend = () => { mic.classList.remove('listening'); aiRecog = null; };
  aiRecog.start();
}

function addAiBubble(role, text) {
  const chat = document.getElementById('ai-chat');
  const wrap = document.createElement('div');
  wrap.className = 'ai-bubble ' + role;
  wrap.innerHTML = `<span class="ai-who">${role === 'user' ? '🙋 Bạn' : '🧑‍💼 Interviewer'}</span>
    <div class="ai-bubble-body">${role === 'user' ? escHtml(text).replace(/\n/g, '<br>') : ''}</div>`;
  chat.appendChild(wrap);
  scrollAiChat();
  return wrap;
}

function scrollAiChat() { const c = document.getElementById('ai-chat'); c.scrollTop = c.scrollHeight; }

function setAiInputDisabled(d) {
  ['ai-answer', 'ai-send', 'ai-mic', 'ai-end'].forEach(id => { const el = document.getElementById(id); if (el && !(id === 'ai-end' && aiFinished)) el.disabled = d; });
}

/** Lưu lịch sử đánh giá AI (parse điểm /10 nếu có) */
function saveAiEvaluation(text) {
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*\/\s*10/);
  // Bắt "tỷ lệ đỗ ... Y%" (ưu tiên dòng có chữ "đỗ/đậu/pass"), nếu không có thì lấy % đầu tiên
  const passM = text.match(/(?:đỗ|đậu|pass)[^%\d]*?(\d{1,3})\s*%/i) || text.match(/(\d{1,3})\s*%/);
  const hist = store.get('prep-ai-history', []);
  hist.push({
    date: new Date().toISOString().slice(0, 10),
    topic: aiCfg.topic || 'Tổng hợp', level: aiCfg.level, model: aiCfg.model,
    score: m ? parseFloat(m[1].replace(',', '.')) : null,
    pass: passM ? Math.min(+passM[1], 100) : null,
  });
  store.set('prep-ai-history', hist.slice(-50));
}

function renderAiRecent() {
  const el = document.getElementById('ai-recent');
  if (!el) return;
  const hist = store.get('prep-ai-history', []);
  if (!hist.length) { el.innerHTML = ''; return; }
  el.innerHTML = '<h3>🗂️ Buổi phỏng vấn AI gần đây</h3>' +
    hist.slice(-6).reverse().map(h => {
      const passTxt = h.pass != null ? ` · 🎯 đỗ ~${h.pass}%` : '';
      return `<div class="score-row"><span>${h.date} · ${escHtml(h.topic)} · ${escHtml(h.level)}</span>
       <span class="${h.score != null && h.score >= 7 ? 'pass' : 'fail'}">${h.score != null ? h.score + '/10' : '—'}${passTxt}</span></div>`;
    }).join('');
}

// ---------- Dashboard ----------
const PREP_KEYS = ['prep-progress', 'prep-quiz-scores', 'prep-srs', 'prep-last-doc',
  'prep-typing-best', 'prep-fails', 'prep-activity', 'prep-mock-history',
  'prep-pomo', 'prep-code-best', 'prep-fc-dir', 'prep-fc-auto', 'prep-code-history', 'prep-theme',
  'prep-last-view', 'prep-doc-checks', 'prep-mock-wrong', 'prep-ai-history', 'prep-ai-settings', 'prep-plan',
  'prep-coding-solved', 'prep-coding-code', 'prep-iq-best', 'prep-iq-test-history'];
// Lưu ý: KHÔNG đưa 'prep-ai-key' vào PREP_KEYS — không xuất/nhập key API ra file backup.

/** Banner "X từ đến hạn ôn hôm nay" — cần deck nên load lazy */
async function renderDueBanner() {
  await loadDeck();
  const el = document.getElementById('dash-due');
  const due = filterDeck('__due__').length;
  const leech = filterDeck('__leech__').length;
  el.innerHTML = due || leech
    ? `📬 Hôm nay có <b>${due} từ đến hạn ôn</b>${leech ? ` · 🔥 <b>${leech} từ cứng đầu</b> cần luyện thêm` : ''} — vào tab 🃏 Flashcards hoặc ✍️ Luyện viết, chọn bộ lọc tương ứng.`
    : '✨ Không có từ nào đến hạn ôn — học từ mới thôi!';
}

/** Thanh phân bố từ vựng theo hộp SRS 0-5 + chưa học */
async function renderSrsDist() {
  await loadDeck();
  const srs = store.get('prep-srs', {});
  const counts = new Array(SRS_INTERVALS.length).fill(0);
  let unseen = 0;
  DECK.forEach(c => {
    const e = srs[c.id];
    if (!e) unseen++;
    else counts[Math.min(e.box || 0, SRS_INTERVALS.length - 1)]++;
  });
  const seg = (n, cls, label) =>
    n ? `<div class="srs-seg ${cls}" style="flex:${n}" title="${label}: ${n} từ"></div>` : '';
  const learned = counts.slice(2).reduce((a, b) => a + b, 0); // hộp ≥2 coi như đã thuộc
  document.getElementById('dash-srs').innerHTML = `
    <div class="srs-bar">
      ${seg(unseen, 's-none', 'Chưa học')}
      ${counts.map((n, i) => seg(n, 's' + i, `Hộp ${i} — ôn lại sau ${SRS_INTERVALS[i]} ngày`)).join('')}
    </div>
    <div class="srs-legend">
      Đã thuộc (hộp ≥2): <b>${learned}/${DECK.length}</b> ·
      chưa học ${unseen} · ${counts.map((n, i) => `hộp ${i}: ${n}`).join(' · ')}
    </div>`;
}

/** Heatmap hoạt động kiểu GitHub: ~18 tuần gần nhất */
function renderHeatmap() {
  const acts = store.get('prep-activity', {});
  const wrap = document.getElementById('dash-heatmap');
  wrap.innerHTML = '';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - 119 - today.getDay()); // lùi ~17 tuần, neo về Chủ nhật
  for (let w = 0; w < 18; w++) {
    const col = document.createElement('div');
    col.className = 'hm-col';
    for (let d = 0; d < 7; d++) {
      const day = new Date(start);
      day.setDate(start.getDate() + w * 7 + d);
      if (day > today) break;
      const n = acts[dayKey(day)] || 0;
      const cell = document.createElement('div');
      cell.className = 'hm-cell ' + (n === 0 ? 'l0' : n < 10 ? 'l1' : n < 30 ? 'l2' : 'l3');
      cell.title = `${dayKey(day)}: ${n} lượt học`;
      col.appendChild(cell);
    }
    wrap.appendChild(col);
  }
  // Chuỗi ngày học liên tiếp (hôm nay chưa học thì tính đến hôm qua)
  let streak = 0;
  const d = new Date();
  if (!acts[dayKey(d)]) d.setDate(d.getDate() - 1);
  while (acts[dayKey(d)] > 0) { streak++; d.setDate(d.getDate() - 1); }
  const streakMsg = streak
    ? `🔥 Đang giữ chuỗi <b>${streak} ngày</b> học liên tiếp${acts[dayKey(new Date())] ? '' : ' — hôm nay chưa học, đừng để đứt!'}`
    : 'Chưa có chuỗi ngày học nào — bắt đầu hôm nay nhé!';
  const pomoToday = pomoTodayCount();
  const codeBest = store.get('prep-code-best', null);
  document.getElementById('dash-streak').innerHTML = streakMsg +
    (pomoToday ? ` · 🍅 <b>${pomoToday} pomodoro</b> hôm nay` : '') +
    (codeBest ? ` · ⌨️ kỷ lục gõ code <b>${codeBest.wpm} WPM</b>` : '');
}

/** Các đồ thị cột thuần CSS: hoạt động 14 ngày, % mock, WPM gõ code */
function renderCharts() {
  // Lượt học 14 ngày
  const acts = store.get('prep-activity', {});
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ key: dayKey(d), n: acts[dayKey(d)] || 0 });
  }
  const maxAct = Math.max(...days.map(d => d.n), 1);
  document.getElementById('dash-chart-activity').innerHTML = days.map(d => `
    <div class="bar-col" title="${d.key}: ${d.n} lượt học">
      <div class="bar-v" style="height:${Math.max(Math.round(d.n / maxAct * 100), d.n ? 4 : 0)}%"></div>
      <span class="bar-label">${+d.key.slice(8)}</span>
    </div>`).join('');

  // % đúng các buổi mock gần nhất
  const hist = store.get('prep-mock-history', []).slice(-15);
  document.getElementById('dash-chart-mock').innerHTML = hist.length
    ? hist.map(h => {
        const pct = Math.round((h.correct / h.total) * 100);
        return `<div class="bar-col" title="${h.date}: ${h.correct}/${h.total} (${pct}%)">
          <div class="bar-v ${pct >= 80 ? 'ok' : 'low'}" style="height:${Math.max(pct, 4)}%"></div>
          <span class="bar-label">${pct}</span>
        </div>`;
      }).join('')
    : '<p class="chart-empty">Chưa có buổi mock nào — đồ thị sẽ hiện khi bạn làm mock đầu tiên.</p>';

  // WPM các lượt gõ code gần nhất
  const wpms = store.get('prep-code-history', []).slice(-20);
  const maxWpm = Math.max(...wpms.map(w => w.wpm), 1);
  document.getElementById('dash-chart-wpm').innerHTML = wpms.length
    ? wpms.map(w => `
        <div class="bar-col" title="${w.date}: ${w.wpm} WPM · ${w.acc}% chính xác">
          <div class="bar-v ${w.acc >= 95 ? 'ok' : ''}" style="height:${Math.max(Math.round(w.wpm / maxWpm * 100), 4)}%"></div>
          <span class="bar-label">${w.wpm}</span>
        </div>`).join('')
    : '<p class="chart-empty">Chưa có lượt gõ nào — vào tab ⌨️ Gõ code làm một snippet nhé.</p>';
}

function renderMockHistory() {
  const history = store.get('prep-mock-history', []);
  const wrap = document.getElementById('dash-mock');
  wrap.innerHTML = history.length ? '' :
    '<p style="color:var(--muted)">Chưa có buổi mock nào — vào tab 🎯 Mock PV làm thử một buổi 10 câu.</p>';
  history.slice(-10).reverse().forEach(h => {
    const pass = h.correct / h.total >= 0.8;
    const row = document.createElement('div');
    row.className = 'score-row';
    row.innerHTML = `<span>${h.date} · ${h.week === 'all' ? 'Tất cả các tuần' : h.week}</span>
      <span class="${pass ? 'pass' : 'fail'}">${h.correct}/${h.total} ${pass ? 'PASS ✅' : 'CHƯA PASS'}</span>`;
    wrap.appendChild(row);
  });
}

/** Panel kho câu mock trả lời sai: xem, gỡ từng câu đã nắm, hoặc vào ôn ngay */
function renderMockWrong() {
  const wrap = document.getElementById('dash-mock-wrong');
  const wrong = getMockWrong();
  if (!wrong.length) {
    wrap.innerHTML = '<p style="color:var(--muted)">Chưa có câu nào trong kho — khi làm Mock và tự chấm "✗ Chưa tốt", câu đó sẽ vào đây để ôn lại.</p>';
    return;
  }
  wrap.innerHTML =
    `<div class="mw-head">
       <span>Có <b>${wrong.length}</b> câu cần ôn lại</span>
       <button id="mw-review" class="mw-review">🎯 Ôn lại ngay</button>
     </div>` +
    wrong.map((w, i) => `
      <div class="mk-wrong-item" data-i="${i}">
        <div class="mk-wrong-q">${window.marked ? marked.parse('**' + w.q + '**') : escHtml(w.q)}</div>
        <div class="mw-row">
          <span class="mw-week">${escHtml(w.weekLabel || '')}</span>
          <details class="mk-wrong-a"><summary>Xem đáp án</summary>${window.marked ? marked.parse(w.a) : escHtml(w.a)}</details>
          <button class="mw-done" data-i="${i}" title="Đã nắm câu này — gỡ khỏi kho">✓ Đã nắm</button>
        </div>
      </div>`).join('');

  wrap.querySelectorAll('.mw-done').forEach(btn => btn.addEventListener('click', () => {
    removeMockWrong(wrong[+btn.dataset.i]);
    renderMockWrong(); // vẽ lại với index mới
  }));
  document.getElementById('mw-review')?.addEventListener('click', () => {
    switchView('mock');
    initMock().then(() => {
      fillMockWeekSelect();
      document.getElementById('mk-week').value = '__wrong__';
    });
  });
}

function exportData() {
  const data = {};
  PREP_KEYS.forEach(k => {
    const v = localStorage.getItem(k);
    if (v != null) data[k] = JSON.parse(v);
  });
  const blob = new Blob(
    [JSON.stringify({ app: 'prep-study-web', exportedAt: new Date().toISOString(), data }, null, 2)],
    { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `prep-backup-${dayKey(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const data = parsed.data;
      if (parsed.app !== 'prep-study-web' || !data) throw new Error('không phải file backup của app này');
      if (!confirm('Ghi đè tiến độ hiện tại bằng dữ liệu trong file backup?')) return;
      PREP_KEYS.forEach(k => { if (k in data) store.set(k, data[k]); });
      alert('✅ Đã khôi phục dữ liệu!');
      renderDashboard();
    } catch (err) {
      alert('❌ File không hợp lệ: ' + err.message);
    }
  };
  reader.readAsText(file);
}

const WEEK_TASKS = [
  ['theory', '📚 Lý thuyết'],
  ['exercises', '💪 Bài tập'],
  ['cases', '🏗️ Design & Cases'],
  ['test', '📝 Test cuối tuần'],
  ['english', '🇬🇧 English tuần này'],
];

function renderDashboard() {
  const progress = store.get('prep-progress', {});
  const weeksGroup = TREE.find(g => g.title.includes('12 tuần'));
  const weeks = [...new Set((weeksGroup?.items || []).map(i => i.week).filter(Boolean))];
  const wrap = document.getElementById('dash-weeks');
  wrap.innerHTML = '';

  let done = 0, totalTasks = weeks.length * WEEK_TASKS.length;
  weeks.forEach(wk => {
    const p = progress[wk] || {};
    const row = document.createElement('div');
    row.className = 'dash-week';
    const name = document.createElement('span');
    name.className = 'wk-name';
    name.textContent = prettyWeek(wk);
    row.appendChild(name);
    let wkDone = 0;
    WEEK_TASKS.forEach(([key, label]) => {
      const lb = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!p[key];
      if (cb.checked) { done++; wkDone++; }
      cb.addEventListener('change', () => {
        const prog = store.get('prep-progress', {});
        prog[wk] = { ...(prog[wk] || {}), [key]: cb.checked };
        store.set('prep-progress', prog);
        renderDashboard();
      });
      lb.append(cb, label);
      row.appendChild(lb);
    });
    if (wkDone === WEEK_TASKS.length) row.classList.add('complete');
    wrap.appendChild(row);
  });

  const pct = totalTasks ? Math.round((done / totalTasks) * 100) : 0;
  document.getElementById('dash-bar-fill').style.width = pct + '%';
  document.getElementById('dash-percent').textContent = pct + '%';

  // Điểm quiz đã lưu
  const scores = store.get('prep-quiz-scores', {});
  const scoreWrap = document.getElementById('dash-scores');
  const entries = Object.entries(scores);
  scoreWrap.innerHTML = entries.length ? '' : '<p style="color:var(--muted)">Chưa có điểm nào — vào một trang có quiz và bật 🧪 chế độ tự chấm nhé.</p>';
  entries.forEach(([doc, s]) => {
    const pass = s.correct / s.total >= 0.8;
    const row = document.createElement('div');
    row.className = 'score-row';
    row.innerHTML = `<span>${doc}</span>
      <span>${s.date} — <span class="${pass ? 'pass' : 'fail'}">${s.correct}/${s.total} ${pass ? 'PASS ✅' : 'CHƯA PASS'}</span></span>`;
    scoreWrap.appendChild(row);
  });

  renderDueBanner();
  renderSrsDist();
  renderHeatmap();
  renderCharts();
  renderMockHistory();
  renderMockWrong();

  document.getElementById('dash-export').onclick = exportData;
  const fileInput = document.getElementById('dash-import-file');
  document.getElementById('dash-import').onclick = () => fileInput.click();
  fileInput.onchange = () => {
    if (fileInput.files[0]) importData(fileInput.files[0]);
    fileInput.value = '';
  };
  document.getElementById('dash-reset').onclick = () => {
    if (confirm('Xoá toàn bộ tiến độ, điểm quiz, SRS, heatmap và lịch sử mock? (Nên 📤 Xuất backup trước!)')) {
      PREP_KEYS.forEach(k => localStorage.removeItem(k));
      renderDashboard();
    }
  };
}

function prettyWeek(dir) {
  const m = dir.match(/^week-(\d+)-(.+)$/);
  return m ? `Tuần ${m[1]} · ${m[2].split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}` : dir;
}

// ---------- Theme sáng / tối ----------
function initTheme() {
  const btn = document.getElementById('theme-btn');
  const apply = () => {
    const light = store.get('prep-theme', 'dark') === 'light';
    document.body.classList.toggle('light', light);
    btn.textContent = light ? '☀️' : '🌙';
    // Đổi luôn theme syntax highlight cho khớp nền code
    document.getElementById('hljs-css').href = light
      ? 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/styles/github.min.css'
      : 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/styles/github-dark.min.css';
  };
  btn.addEventListener('click', () => {
    store.set('prep-theme', store.get('prep-theme', 'dark') === 'light' ? 'dark' : 'light');
    apply();
  });
  apply();
}

// ---------- Kế hoạch & nhịp độ ôn ----------
/**
 * Tính "Điểm sẵn sàng phỏng vấn" 0–100 từ toàn bộ dữ liệu học tập đã có.
 * Mỗi thành phần được nhân hệ số "độ phủ" (coverage) để vài lượt lẻ không thổi điểm lên 100.
 */
function computeReadiness() {
  const clamp = v => Math.max(0, Math.min(100, Math.round(v)));

  // 1) Kiến thức — % task tuần đã tick (prep-progress)
  const progress = store.get('prep-progress', {});
  const weeksGroup = TREE.find(g => g.title.includes('12 tuần'));
  const weeks = [...new Set((weeksGroup?.items || []).map(i => i.week).filter(Boolean))];
  const totalTasks = Math.max(1, weeks.length * WEEK_TASKS.length);
  let done = 0;
  weeks.forEach(wk => { const p = progress[wk] || {}; WEEK_TASKS.forEach(([k]) => { if (p[k]) done++; }); });
  const know = done / totalTasks * 100;

  // 2) Trí nhớ — mức thuộc flashcards (box SRS), nhân độ phủ số thẻ đã học
  const srs = store.get('prep-srs', {});
  const ids = Object.keys(srs);
  const maxBox = SRS_INTERVALS.length - 1;
  const avgBox = ids.length ? ids.reduce((s, id) => s + Math.min(srs[id].box || 0, maxBox), 0) / (ids.length * maxBox) : 0;
  const mem = avgBox * 100 * Math.min(ids.length / 150, 1);

  // 3) Phỏng vấn thử — mock tự chấm + mock AI (mỗi cái 10 lượt gần nhất)
  const mh = store.get('prep-mock-history', []).slice(-10);
  const selfPct = mh.length ? mh.reduce((s, h) => s + (h.total ? h.correct / h.total * 100 : 0), 0) / mh.length : null;
  const ah = store.get('prep-ai-history', []).filter(h => h.score != null).slice(-10);
  const aiPct = ah.length ? ah.reduce((s, h) => s + h.score * 10, 0) / ah.length : null;
  let mockBase = (selfPct != null && aiPct != null) ? (selfPct + aiPct) / 2
    : selfPct != null ? selfPct : aiPct != null ? aiPct : 0;
  const mock = mockBase * Math.min((mh.length + ah.length) / 5, 1);

  // 4) Phản xạ gõ code — độ chính xác trung bình (prep-code-history)
  const ch = store.get('prep-code-history', []).slice(-10);
  const codeAcc = ch.length ? ch.reduce((s, h) => s + (h.acc || 0), 0) / ch.length : 0;
  const code = codeAcc * Math.min(ch.length / 3, 1);

  // 5) Đều đặn — số ngày có học trong 14 ngày gần nhất
  const acts = store.get('prep-activity', {});
  let activeDays = 0;
  for (let i = 0; i < 14; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    if ((acts[dayKey(d)] || 0) > 0) activeDays++;
  }
  const consistency = activeDays / 14 * 100;

  const parts = [
    { key: 'know', label: '📚 Kiến thức', pct: clamp(know), weight: 0.30, view: 'dashboard',
      tip: 'Tick các mục đã học ở tab 📊 Tiến độ để tăng phần này.' },
    { key: 'mem', label: '🃏 Trí nhớ (flashcards)', pct: clamp(mem), weight: 0.20, view: 'flashcards',
      tip: 'Ôn flashcards đều để đẩy thẻ lên hộp SRS cao hơn.' },
    { key: 'mock', label: '🎯 Phỏng vấn thử', pct: clamp(mock), weight: 0.30, view: 'mock',
      tip: 'Làm thêm Mock (tự chấm hoặc AI) — đây là phần nặng ký nhất.' },
    { key: 'code', label: '⌨️ Phản xạ gõ code', pct: clamp(code), weight: 0.10, view: 'code',
      tip: 'Luyện gõ code để tăng độ chính xác & tốc độ.' },
    { key: 'streak', label: '🔥 Đều đặn (14 ngày)', pct: clamp(consistency), weight: 0.10, view: 'plan',
      tip: 'Học mỗi ngày một chút — đều đặn quan trọng hơn dồn cục.' },
  ];
  const score = clamp(parts.reduce((s, p) => s + p.pct * p.weight, 0));
  return { score, parts };
}

/** HTML vòng đo sẵn sàng + breakdown; trả {html, weak} để gắn nút CTA. */
function readinessHtml() {
  const { score, parts } = computeReadiness();
  const tier = score >= 80 ? { t: 'Sẵn sàng phỏng vấn 🚀', c: 'ok' }
    : score >= 60 ? { t: 'Khá ổn — sắp tới rồi 💪', c: 'good' }
    : score >= 40 ? { t: 'Đang lên — cố thêm 📈', c: 'mid' }
    : { t: 'Mới bắt đầu — kiên trì nhé 🌱', c: 'low' };
  // Điểm yếu nhất = thành phần kéo tụt điểm nhiều nhất (khoảng trống × hệ số)
  const weak = [...parts].sort((a, b) => (100 - b.pct) * b.weight - (100 - a.pct) * a.weight)[0];
  const bars = parts.map(p => `
    <div class="rd-part">
      <span class="rd-plabel">${p.label}</span>
      <div class="rd-track"><div class="rd-fill" style="width:${p.pct}%"></div></div>
      <b class="rd-pval">${p.pct}</b>
    </div>`).join('');
  const html = `
    <div class="readiness ${tier.c}">
      <div class="rd-ring" style="--p:${score}">
        <div class="rd-center"><b>${score}</b><small>/100</small></div>
      </div>
      <div class="rd-info">
        <h2>🎯 Điểm sẵn sàng phỏng vấn</h2>
        <p class="rd-tier">${tier.t}</p>
        <div class="rd-parts">${bars}</div>
        <p class="rd-weak">🔧 Cần cải thiện nhất: <b>${weak.label}</b> — ${weak.tip}
          <button class="pl-go rd-cta" data-view="${weak.view}">Cải thiện ngay →</button></p>
      </div>
    </div>`;
  return html;
}

function renderPlan() {
  const body = document.getElementById('plan-body');
  if (!body) return;

  const weeksGroup = TREE.find(g => g.title.includes('12 tuần'));
  const items = weeksGroup?.items || [];
  const weeks = [...new Set(items.map(i => i.week).filter(Boolean))];
  if (!weeks.length) { body.innerHTML = '<p style="color:var(--muted)">Chưa nạp được lộ trình tuần.</p>'; return; }

  const parse = s => { const [y, m, dd] = s.split('-').map(Number); return new Date(y, m - 1, dd); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const diffDays = (a, b) => Math.round((b - a) / 86400000);
  const fmt = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

  const today = parse(dayKey(new Date())); // hôm nay lúc 00:00 (giờ địa phương)

  // Cấu hình kế hoạch — mặc định: bắt đầu hôm nay, phỏng vấn sau 12 tuần
  let plan = store.get('prep-plan', null);
  if (!plan || !plan.start || !plan.exam) {
    plan = { start: dayKey(today), exam: dayKey(addDays(today, weeks.length * 7)) };
    store.set('prep-plan', plan);
  }
  const start = parse(plan.start);
  let exam = parse(plan.exam);
  if (exam <= start) exam = addDays(start, weeks.length * 7); // chống cấu hình ngược

  const progress = store.get('prep-progress', {});
  const tasksPerWeek = WEEK_TASKS.length;
  const totalTasks = weeks.length * tasksPerWeek;
  let doneTasks = 0;
  weeks.forEach(wk => { const p = progress[wk] || {}; WEEK_TASKS.forEach(([k]) => { if (p[k]) doneTasks++; }); });

  // Nhịp độ: % thời gian đã trôi (theo lịch) so với % công việc đã xong
  const totalSpan = Math.max(1, diffDays(start, exam));
  const elapsed = diffDays(start, today);
  const expectedPct = Math.max(0, Math.min(100, Math.round(elapsed / totalSpan * 100)));
  const actualPct = Math.round(doneTasks / totalTasks * 100);
  const daysToExam = diffDays(today, exam);

  // Tuần "nên đang ở" — mỗi tuần là 1 block 7 ngày kể từ ngày bắt đầu
  const curIdx = today < start ? -1 : Math.min(weeks.length - 1, Math.floor(elapsed / 7));

  const countdownTxt = daysToExam > 0
    ? `Còn <b>${daysToExam}</b> ngày đến ngày phỏng vấn (${fmt(exam)})`
    : daysToExam === 0 ? '🔥 <b>Hôm nay</b> là ngày phỏng vấn — chúc bạn may mắn!'
    : `Ngày phỏng vấn đã qua <b>${-daysToExam}</b> ngày — chỉnh lại bên dưới nếu cần.`;

  let paceClass, paceTxt;
  if (curIdx < 0) { paceClass = 'soon'; paceTxt = `Kế hoạch bắt đầu ${fmt(start)} — chưa tới ngày bắt đầu.`; }
  else if (actualPct + 5 >= expectedPct) { paceClass = 'ok'; paceTxt = `✅ Đúng nhịp! Đã xong ${actualPct}% trong khi lịch mới tới ${expectedPct}%.`; }
  else { paceClass = 'behind'; paceTxt = `⚠️ Hơi chậm: mới xong ${actualPct}% nhưng theo lịch nên ~${expectedPct}%. Ưu tiên dứt điểm tuần dưới đây.`; }

  // Tuần hiện tại + việc còn thiếu
  const focusWk = weeks[Math.max(0, curIdx)];
  const focusItem = items.find(i => i.week === focusWk && !i.sub) || items.find(i => i.week === focusWk);
  const fp = progress[focusWk] || {};
  const focusUndone = WEEK_TASKS.filter(([k]) => !fp[k]);

  const rows = weeks.map((wk, i) => {
    const wkStart = addDays(start, i * 7), wkEnd = addDays(wkStart, 6);
    const p = progress[wk] || {};
    const n = WEEK_TASKS.filter(([k]) => p[k]).length;
    let chip;
    if (n === tasksPerWeek) chip = '<span class="pl-chip done">✅ Hoàn thành</span>';
    else if (curIdx >= 0 && i < curIdx) chip = '<span class="pl-chip late">⚠️ Trễ lịch</span>';
    else if (i === curIdx) chip = '<span class="pl-chip now">🔜 Tuần này</span>';
    else chip = '<span class="pl-chip soon">⏳ Sắp tới</span>';
    return `<div class="pl-row${i === curIdx ? ' current' : ''}" data-week="${escHtml(wk)}">
      <span class="pl-wk">${escHtml(prettyWeek(wk))}</span>
      <span class="pl-dates">${fmt(wkStart)}–${fmt(wkEnd)}</span>
      <span class="pl-prog">${n}/${tasksPerWeek}</span>
      ${chip}
    </div>`;
  }).join('');

  body.innerHTML = `
    ${readinessHtml()}

    <div class="plan-countdown ${daysToExam < 0 ? 'over' : ''}">${countdownTxt}</div>

    <div class="plan-config">
      <label>📌 Bắt đầu <input type="date" id="plan-start" value="${plan.start}"></label>
      <label>🎯 Ngày phỏng vấn <input type="date" id="plan-exam" value="${plan.exam}"></label>
    </div>

    <div class="plan-pace ${paceClass}">
      <div class="pace-line"><span>Lịch trình</span><div class="pace-track"><div class="pace-fill expected" style="width:${expectedPct}%"></div></div><b>${expectedPct}%</b></div>
      <div class="pace-line"><span>Bạn đã xong</span><div class="pace-track"><div class="pace-fill actual" style="width:${actualPct}%"></div></div><b>${actualPct}%</b></div>
      <p class="pace-verdict">${paceTxt}</p>
    </div>

    <div class="plan-focus">
      <h2>🔜 ${escHtml(prettyWeek(focusWk))} — việc nên làm</h2>
      ${focusUndone.length
        ? `<ul class="focus-tasks">${focusUndone.map(([, label]) => `<li>${escHtml(label)}</li>`).join('')}</ul>`
        : `<p class="focus-alldone">🎉 Tuần này bạn đã tick đủ ${tasksPerWeek} mục. Tuyệt!</p>`}
      <div class="focus-actions">
        ${focusItem ? `<button class="pl-go" data-doc="${escHtml(focusItem.path)}">📖 Mở tài liệu tuần này</button>` : ''}
        <button class="pl-go" data-view="flashcards">🃏 Ôn flashcards</button>
        <button class="pl-go" data-view="mock">🎯 Mock tuần này</button>
      </div>
    </div>

    <h2>🗺️ Lộ trình 12 tuần theo lịch</h2>
    <p class="plan-hint" style="color:var(--muted)">Bấm một tuần để mở tài liệu. Tick mục hoàn thành ở tab 📊 Tiến độ.</p>
    <div class="plan-timeline">${rows}</div>
  `;

  const save = () => {
    const s = document.getElementById('plan-start').value;
    const e = document.getElementById('plan-exam').value;
    if (s && e) { store.set('prep-plan', { start: s, exam: e }); renderPlan(); }
  };
  document.getElementById('plan-start').addEventListener('change', save);
  document.getElementById('plan-exam').addEventListener('change', save);

  body.querySelectorAll('.pl-go').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.doc) { switchView('docs'); openDoc(b.dataset.doc); }
    else if (b.dataset.view) switchView(b.dataset.view);
  }));
  body.querySelectorAll('.pl-row').forEach(r => r.addEventListener('click', () => {
    const it = items.find(i => i.week === r.dataset.week && !i.sub) || items.find(i => i.week === r.dataset.week);
    if (it) { switchView('docs'); openDoc(it.path); }
  }));
}

// ========== LUYỆN TƯ DUY: Lập trình + IQ ==========
let thinkInit = false, thinkMode = 'code';

function initThink() {
  document.querySelectorAll('.think-mode').forEach(b => { b.onclick = () => setThinkMode(b.dataset.mode); });
  setThinkMode(thinkMode);
  if (!thinkInit) { renderCodingFilters(); renderCodingList(); renderIQ(); thinkInit = true; }
}

function setThinkMode(m) {
  thinkMode = m;
  if (m !== 'iq' && typeof iqTimerId !== 'undefined') clearInterval(iqTimerId); // rời chế độ IQ → dừng timer
  document.querySelectorAll('.think-mode').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
  document.getElementById('think-code').hidden = m !== 'code';
  document.getElementById('think-iq').hidden = m !== 'iq';
}

// ----- Chế độ Lập trình -----
const codingFilter = { topic: 'all', diff: 'all' };
const diffClass = d => d === 'Dễ' ? 'easy' : d === 'Khó' ? 'hard' : 'med';

function renderCodingFilters() {
  const probs = window.CODING_PROBLEMS || [];
  const topics = ['all', ...new Set(probs.map(p => p.topic))];
  const diffs = ['all', 'Dễ', 'Trung bình', 'Khó'];
  const el = document.getElementById('coding-filters');
  if (!el) return;
  el.innerHTML = `
    <select id="cf-topic">${topics.map(t => `<option value="${escHtml(t)}">${t === 'all' ? 'Tất cả chủ đề' : escHtml(t)}</option>`).join('')}</select>
    <select id="cf-diff">${diffs.map(d => `<option value="${escHtml(d)}">${d === 'all' ? 'Mọi độ khó' : escHtml(d)}</option>`).join('')}</select>
    <span id="cf-count" class="cf-count"></span>`;
  el.querySelector('#cf-topic').onchange = e => { codingFilter.topic = e.target.value; renderCodingList(); };
  el.querySelector('#cf-diff').onchange = e => { codingFilter.diff = e.target.value; renderCodingList(); };
}

function renderCodingList() {
  const probs = window.CODING_PROBLEMS || [];
  const solved = store.get('prep-coding-solved', {});
  const list = probs.filter(p =>
    (codingFilter.topic === 'all' || p.topic === codingFilter.topic) &&
    (codingFilter.diff === 'all' || p.difficulty === codingFilter.diff));
  const el = document.getElementById('coding-list');
  if (!el) return;
  const cnt = document.getElementById('cf-count');
  if (cnt) cnt.textContent = `Đã giải ${probs.filter(p => solved[p.id]).length}/${probs.length}`;
  el.innerHTML = list.map(p => `
    <button class="coding-item${solved[p.id] ? ' solved' : ''}" data-id="${escHtml(p.id)}">
      <span class="ci-check">${solved[p.id] ? '✅' : '○'}</span>
      <span class="ci-title">${escHtml(p.title)}</span>
      <span class="ci-tags"><span class="ci-diff d-${diffClass(p.difficulty)}">${escHtml(p.difficulty)}</span><span class="ci-topic">${escHtml(p.topic)}</span></span>
    </button>`).join('') || '<p style="color:var(--muted)">Không có bài nào khớp bộ lọc.</p>';
  el.querySelectorAll('.coding-item').forEach(b => b.onclick = () => openCodingProblem(b.dataset.id));
}

function openCodingProblem(id) {
  const p = (window.CODING_PROBLEMS || []).find(x => x.id === id);
  if (!p) return;
  let hintLevel = 0;
  const saved = store.get('prep-coding-code', {})[id];
  const detail = document.getElementById('coding-detail');
  const listPane = document.getElementById('coding-list-pane');
  listPane.hidden = true; detail.hidden = false;
  detail.innerHTML = `
    <button class="coding-back">← Danh sách bài</button>
    <h2>${escHtml(p.title)}</h2>
    <div class="cd-tags"><span class="ci-diff d-${diffClass(p.difficulty)}">${escHtml(p.difficulty)}</span><span class="ci-topic">${escHtml(p.topic)}</span></div>
    <div class="cd-prompt md">${marked.parse(p.prompt)}</div>
    <textarea id="cd-code" class="cd-code" spellcheck="false"></textarea>
    <div class="cd-actions">
      <button id="cd-run" class="cd-run">▶ Chạy test</button>
      <button id="cd-hint">💡 Gợi ý</button>
      <button id="cd-sol">👁 Lời giải</button>
      <button id="cd-reset" class="cd-reset" title="Khôi phục code mẫu ban đầu">↺ Reset</button>
    </div>
    <div id="cd-hints" class="cd-hints"></div>
    <div id="cd-result" class="cd-result"></div>
    <div id="cd-solution" class="cd-solution" hidden></div>`;
  const ta = document.getElementById('cd-code');
  ta.value = saved || p.starter;
  detail.querySelector('.coding-back').onclick = () => { detail.hidden = true; listPane.hidden = false; renderCodingList(); };
  ta.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = ta.selectionStart, en = ta.selectionEnd;
      ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(en);
      ta.selectionStart = ta.selectionEnd = s + 2;
    }
  });
  ta.addEventListener('input', () => { const all = store.get('prep-coding-code', {}); all[id] = ta.value; store.set('prep-coding-code', all); });
  document.getElementById('cd-run').onclick = () => runCoding(p, ta.value);
  const hintBtn = document.getElementById('cd-hint');
  hintBtn.onclick = () => {
    if (hintLevel >= p.hints.length) return;
    hintLevel++;
    document.getElementById('cd-hints').innerHTML = p.hints.slice(0, hintLevel)
      .map((h, i) => `<div class="cd-hint">💡 Gợi ý ${i + 1}: ${escHtml(h)}</div>`).join('');
    if (hintLevel >= p.hints.length) { hintBtn.disabled = true; hintBtn.textContent = '💡 Hết gợi ý'; }
  };
  document.getElementById('cd-sol').onclick = () => {
    const box = document.getElementById('cd-solution');
    box.hidden = !box.hidden;
    if (!box.dataset.filled) {
      box.innerHTML = `<h3>Lời giải tham khảo</h3><pre><code class="language-js">${escHtml(p.solution)}</code></pre><p class="cd-explain">📝 ${escHtml(p.explain)}</p>`;
      if (window.hljs) box.querySelectorAll('pre code').forEach(c => hljs.highlightElement(c));
      box.dataset.filled = '1';
    }
  };
  document.getElementById('cd-reset').onclick = () => {
    ta.value = p.starter;
    const all = store.get('prep-coding-code', {}); delete all[id]; store.set('prep-coding-code', all);
  };
}

function runCoding(p, code) {
  const res = document.getElementById('cd-result');
  res.innerHTML = '<div class="cd-running">⏳ Đang chạy test…</div>';
  runInSandbox(code, p.fnName, p.tests, data => {
    if (data.error) { res.innerHTML = `<div class="cd-err">❌ ${escHtml(data.error)}</div>`; return; }
    const rows = data.results.map((r, i) => {
      const got = r.error ? `lỗi: ${r.error}` : JSON.stringify(r.got);
      const argTxt = r.args.map(a => JSON.stringify(a)).join(', ');
      return `<div class="cd-case ${r.pass ? 'pass' : 'fail'}">
        <span class="cc-h">${r.pass ? '✅' : '❌'} Test ${i + 1}</span>
        <code class="cc-in">${escHtml(p.fnName)}(${escHtml(argTxt)})</code>
        <span class="cc-exp">→ mong đợi <b>${escHtml(JSON.stringify(r.expected))}</b>${r.pass ? '' : `, nhận <b>${escHtml(got)}</b>`}</span>
      </div>`;
    }).join('');
    const passed = data.results.filter(r => r.pass).length;
    const all = passed === data.results.length;
    res.innerHTML = `<div class="cd-summary ${all ? 'ok' : 'no'}">${all ? '🎉' : '⚠️'} ${passed}/${data.results.length} test đúng</div>${rows}`;
    if (all) markCodingSolved(p.id);
  });
}

function markCodingSolved(id) {
  const solved = store.get('prep-coding-solved', {});
  if (!solved[id]) { solved[id] = true; store.set('prep-coding-solved', solved); logActivity(); }
}

/**
 * Chạy code người dùng trong Web Worker (sandbox + chống treo bằng timeout).
 * Fallback chạy trực tiếp nếu môi trường không cho tạo Worker.
 */
function runInSandbox(code, fnName, tests, cb) {
  const src = 'self.onmessage=function(e){var d=e.data,fn;'
    + 'try{fn=new Function(d.code+"\\n;return typeof "+d.fnName+"===\\"function\\"?"+d.fnName+":undefined;")();}'
    + 'catch(err){self.postMessage({error:"Lỗi cú pháp: "+err.message});return;}'
    + 'if(typeof fn!=="function"){self.postMessage({error:"Không tìm thấy hàm "+d.fnName+"(...). Bạn đã đặt đúng tên hàm chưa?"});return;}'
    + 'var out=[];for(var i=0;i<d.tests.length;i++){var t=d.tests[i];'
    + 'try{var g=fn.apply(null,JSON.parse(JSON.stringify(t.args)));'
    + 'out.push({args:t.args,expected:t.expected,got:g,pass:JSON.stringify(g)===JSON.stringify(t.expected)});}'
    + 'catch(err){out.push({args:t.args,expected:t.expected,error:String(err&&err.message||err),pass:false});}}'
    + 'self.postMessage({results:out});};';
  let url;
  try {
    url = URL.createObjectURL(new Blob([src], { type: 'application/javascript' }));
    const w = new Worker(url);
    const done = (data) => { clearTimeout(timer); w.terminate(); URL.revokeObjectURL(url); cb(data); };
    const timer = setTimeout(() => done({ error: '⏱ Quá 2 giây — có thể vòng lặp vô tận. Kiểm tra điều kiện dừng của vòng lặp.' }), 2000);
    w.onmessage = ev => done(ev.data);
    w.onerror = ev => done({ error: 'Lỗi thực thi: ' + (ev.message || 'không rõ') });
    w.postMessage({ code, fnName, tests });
  } catch (_) {
    if (url) URL.revokeObjectURL(url);
    cb(runDirect(code, fnName, tests)); // môi trường không hỗ trợ Worker
  }
}

function runDirect(code, fnName, tests) {
  let fn;
  try { fn = new Function(code + '\n;return typeof ' + fnName + '==="function"?' + fnName + ':undefined;')(); }
  catch (err) { return { error: 'Lỗi cú pháp: ' + err.message }; }
  if (typeof fn !== 'function') return { error: 'Không tìm thấy hàm ' + fnName + '(...)' };
  return {
    results: tests.map(t => {
      try { const g = fn.apply(null, JSON.parse(JSON.stringify(t.args))); return { args: t.args, expected: t.expected, got: g, pass: JSON.stringify(g) === JSON.stringify(t.expected) }; }
      catch (err) { return { args: t.args, expected: t.expected, error: String(err && err.message || err), pass: false }; }
    }),
  };
}

// ----- Chế độ IQ / Logic -----
let iqState = null;
const shuffleArr = a => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };

const IQ_TEST_N = 30, IQ_TEST_SEC = 20 * 60; // 30 câu trong 20 phút
let iqTimerId = null;
const qDiff = q => q.d || 2; // câu chưa gắn độ khó coi như trung bình (2)

/** Xấp xỉ hàm phân vị chuẩn (probit) — Acklam. Dùng dựng đường cong IQ giống phân bố thật. */
function invNorm(p) {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const plow = 0.02425, phigh = 1 - plow;
  let q, r;
  if (p < plow) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p <= phigh) { q = p - 0.5; r = q * q; return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
  q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

/** Chọn N câu cho bài test, phối trộn độ khó ~40% dễ / 45% TB / 15% khó. */
function pickIQTest(bank, N) {
  const byD = { 1: [], 2: [], 3: [] };
  bank.forEach(q => byD[qDiff(q)].push(q));
  [1, 2, 3].forEach(d => byD[d] = shuffleArr(byD[d]));
  const want = { 1: Math.round(N * 0.4), 3: Math.round(N * 0.15) };
  want[2] = N - want[1] - want[3];
  let picked = [].concat(byD[1].slice(0, want[1]), byD[2].slice(0, want[2]), byD[3].slice(0, want[3]));
  if (picked.length < N) { // thiếu ở mức nào đó → bù từ phần còn lại
    const used = new Set(picked.map(q => q.id));
    picked = picked.concat(shuffleArr(bank.filter(q => !used.has(q.id))).slice(0, N - picked.length));
  }
  return shuffleArr(picked).slice(0, N);
}

/** Xếp loại IQ (mang tính tham khảo, theo phân bố chuẩn IQ phổ biến). */
function iqBand(iq) {
  if (iq >= 130) return { label: 'Rất cao 🌟', desc: 'Nhóm ~2% dân số (thiên tài/xuất chúng).' };
  if (iq >= 120) return { label: 'Cao 👏', desc: 'Trên hẳn mức trung bình (~khoảng 10% trên cùng).' };
  if (iq >= 110) return { label: 'Trên trung bình 🙂', desc: 'Khá tốt, cao hơn phần lớn mọi người.' };
  if (iq >= 90) return { label: 'Trung bình', desc: 'Mức phổ biến nhất (khoảng 50% dân số).' };
  if (iq >= 80) return { label: 'Dưới trung bình', desc: 'Luyện thêm dạng dãy số & logic sẽ tiến bộ nhanh.' };
  return { label: 'Cần luyện nhiều 💪', desc: 'Đừng nản — làm nhiều bài là điểm sẽ lên.' };
}
const fmtMMSS = sec => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

function renderIQ() {
  clearInterval(iqTimerId);
  const qs = window.IQ_QUESTIONS || [];
  const body = document.getElementById('iq-body');
  if (!body) return;
  if (!qs.length) { body.innerHTML = '<p style="color:var(--muted)">Chưa nạp được câu hỏi IQ.</p>'; return; }
  const hist = store.get('prep-iq-test-history', []);
  const bestIq = hist.length ? Math.max(...hist.map(h => h.iq)) : null;
  const testN = Math.min(IQ_TEST_N, qs.length);

  const histHtml = hist.length
    ? `<h3>🗂️ Lịch sử bài test (${hist.length})</h3>
       <div class="iq-hist">${hist.slice().reverse().slice(0, 12).map(h => `
         <div class="iq-hrow">
           <span class="iq-hdate">${escHtml(h.date)}</span>
           <span class="iq-hiq">IQ ${h.iq}</span>
           <span class="iq-hband">${escHtml(h.band || '')}</span>
           <span class="iq-hsc">${h.correct}/${h.total} · ⏱ ${fmtMMSS(h.timeSec || 0)}</span>
         </div>`).join('')}</div>
       <p class="iq-note">☁️ Lịch sử được lưu và đồng bộ lên cloud (Firestore) theo tài khoản của bạn.</p>`
    : '<p class="iq-note">Chưa có bài test nào. Làm bài đầu tiên để biết IQ ước lượng của bạn nhé!</p>';

  body.innerHTML = `
    <div class="iq-start">
      <div class="iq-stat">
        <div><b>${bestIq != null ? bestIq : '—'}</b><small>IQ cao nhất</small></div>
        <div><b>${hist.length}</b><small>lần test</small></div>
        <div><b>${qs.length}</b><small>câu trong kho</small></div>
      </div>
      <div class="iq-modes">
        <button id="iq-test-btn" class="iq-start-btn">📝 Làm bài Test IQ<small>${testN} câu · ${IQ_TEST_SEC / 60} phút · có chấm điểm</small></button>
        <button id="iq-prac-btn" class="iq-mini">🎮 Luyện tập tự do<small>cả ${qs.length} câu · xem giải thích ngay</small></button>
      </div>
    </div>
    ${histHtml}`;
  document.getElementById('iq-test-btn').onclick = () => startIQTest();
  document.getElementById('iq-prac-btn').onclick = () => startIQ(true);
}

// ===== Bài Test IQ chính thức (đếm giờ, không hiện đáp án giữa chừng) =====
function startIQTest() {
  const all = window.IQ_QUESTIONS || [];
  const qs = pickIQTest(all, Math.min(IQ_TEST_N, all.length));
  iqState = { mode: 'test', qs, idx: 0, correct: 0, log: [], startMs: Date.now(), endSec: IQ_TEST_SEC };
  clearInterval(iqTimerId);
  iqTimerId = setInterval(tickIQTest, 1000);
  showIQTest();
}

function tickIQTest() {
  const el = document.getElementById('iqt-timer');
  if (!el || !iqState || iqState.mode !== 'test') { clearInterval(iqTimerId); return; }
  const left = iqState.endSec - Math.floor((Date.now() - iqState.startMs) / 1000);
  if (left <= 0) { el.textContent = '00:00'; finishIQTest(true); return; }
  el.textContent = fmtMMSS(left);
  el.classList.toggle('low', left <= 60);
}

function showIQTest() {
  const s = iqState, body = document.getElementById('iq-body');
  if (!body) { clearInterval(iqTimerId); return; }
  if (s.idx >= s.qs.length) return finishIQTest(false);
  const q = s.qs[s.idx];
  body.innerHTML = `
    <div class="iqt-bar">
      <span class="iqt-count">Câu ${s.idx + 1}/${s.qs.length}</span>
      <span id="iqt-timer" class="iqt-timer">${fmtMMSS(s.endSec)}</span>
      <button id="iqt-quit" class="iqt-quit" title="Dừng bài test">✕ Thoát</button>
    </div>
    <div class="iq-track"><div class="iq-fill" style="width:${s.idx / s.qs.length * 100}%"></div></div>
    <div class="iq-cat" style="margin-bottom:6px">${escHtml(q.category)}</div>
    <div class="iq-q">${escHtml(q.q)}</div>
    <div class="iq-opts">${q.options.map((o, i) => `<button class="iq-opt" data-i="${i}">${escHtml(o)}</button>`).join('')}</div>
    <p class="iq-note">Bài test không hiện đáp án ngay — kết quả & giải thích sẽ có ở cuối.</p>`;
  body.querySelectorAll('.iq-opt').forEach(b => b.onclick = () => answerIQTest(+b.dataset.i));
  document.getElementById('iqt-quit').onclick = () => { if (confirm('Thoát bài test? Kết quả sẽ không được lưu.')) { clearInterval(iqTimerId); renderIQ(); } };
}

function answerIQTest(i) {
  const s = iqState, q = s.qs[s.idx];
  const ok = i === q.answer;
  if (ok) s.correct++;
  s.log.push({ q: q.q, chosen: q.options[i], correct: q.options[q.answer], ok, explain: q.explain, d: qDiff(q) });
  s.idx++;
  showIQTest();
}

function finishIQTest(timeout) {
  clearInterval(iqTimerId);
  const s = iqState;
  const answered = s.log.length;
  const total = s.qs.length;
  const pctRaw = Math.round(s.correct / total * 100);

  // (2) Trọng số theo độ khó: câu khó đúng ăn nhiều điểm hơn (dễ=1, TB=2, khó=3)
  const wMax = s.qs.reduce((a, q) => a + qDiff(q), 0);
  const wGot = s.log.reduce((a, l) => a + (l.ok ? l.d : 0), 0);
  const wPct = wMax ? wGot / wMax * 100 : 0;

  // (3) Đường cong chuẩn (probit): 50% điểm trọng số → IQ 100, nén ở hai đầu
  const f = Math.max(0.03, Math.min(0.97, wPct / 100));
  let iq = 100 + 15 * invNorm(f);

  // (1) Thưởng/phạt thời gian: nhanh + đúng nhiều → cộng (tối đa +8); chậm/hết giờ → trừ (tối đa −8)
  const timeSec = Math.min(IQ_TEST_SEC, Math.round((Date.now() - s.startMs) / 1000));
  const tr = Math.max(0, Math.min(1, timeSec / IQ_TEST_SEC));
  let timeAdj = 8 * (1 - 2 * tr);
  if (timeAdj > 0) timeAdj *= wPct / 100; // chỉ thưởng tốc độ khi làm đúng nhiều
  timeAdj = Math.round(Math.max(-8, Math.min(8, timeAdj)));

  iq = Math.max(55, Math.min(160, Math.round(iq + timeAdj)));
  const band = iqBand(iq);
  const rec = { date: dayKey(new Date()), ts: Date.now(), iq, correct: s.correct, total, timeSec, band: band.label, wpct: Math.round(wPct), timeAdj };
  const hist = store.get('prep-iq-test-history', []);
  hist.push(rec);
  store.set('prep-iq-test-history', hist.slice(-100)); // → tự đẩy lên Firestore qua schedulePush
  const best = store.get('prep-iq-best', null);
  if (!best || iq > best.iq) store.set('prep-iq-best', { iq, correct: s.correct, total, date: rec.date });
  logActivity();

  const review = s.log.filter(l => !l.ok).map(l =>
    `<div class="iq-rv"><div class="iq-rvq">❌ ${escHtml(l.q)}</div>
      <div class="iq-rva">Đáp án đúng: <b>${escHtml(l.correct)}</b> — ${escHtml(l.explain)}</div></div>`).join('');
  const adjTxt = timeAdj === 0 ? '±0' : timeAdj > 0 ? `+${timeAdj}` : `${timeAdj}`;

  document.getElementById('iq-body').innerHTML = `
    <div class="iq-done">
      ${timeout ? '<div class="iq-timeout">⏱ Hết giờ — bài được nộp tự động.</div>' : ''}
      <div class="iq-score-ring" style="--p:${Math.round(wPct)}"><div class="rd-center"><b>${iq}</b><small>IQ ước lượng</small></div></div>
      <h2>${band.label}</h2>
      <p class="iq-band-desc">${band.desc}</p>
      <div class="iq-break">
        <div class="iq-brow"><span>✅ Số câu đúng</span><b>${s.correct}/${total} (${pctRaw}%)</b></div>
        <div class="iq-brow"><span>⚖️ Điểm có trọng số độ khó</span><b>${Math.round(wPct)}%</b></div>
        <div class="iq-brow"><span>⏱ Thời gian làm</span><b>${fmtMMSS(timeSec)}</b></div>
        <div class="iq-brow"><span>🚀 Thưởng/phạt tốc độ</span><b>${adjTxt} điểm IQ</b></div>
        ${answered < total ? `<div class="iq-brow"><span>⚠️ Bỏ trống</span><b>${total - answered} câu</b></div>` : ''}
      </div>
      <p class="iq-note">IQ = đường cong chuẩn theo điểm trọng số (50%→100), cộng/trừ tốc độ. Là ước lượng để theo dõi tiến bộ, KHÔNG thay bài test IQ chuẩn hóa.</p>
      <div class="iq-start-actions"><button id="iq-again" class="iq-start-btn">🔁 Làm bài test khác</button></div>
      ${review ? `<details class="iq-review"><summary>Xem lại ${s.log.filter(l => !l.ok).length} câu sai</summary>${review}</details>` : '<p class="iq-allright">🎉 Bạn trả lời đúng tất cả!</p>'}
    </div>`;
  document.getElementById('iq-again').onclick = () => renderIQ();
}

function startIQ(shuffle) {
  let qs = [...(window.IQ_QUESTIONS || [])];
  if (shuffle) qs = shuffleArr(qs);
  iqState = { qs, idx: 0, correct: 0, answered: false };
  showIQ();
}

function showIQ() {
  const s = iqState, body = document.getElementById('iq-body');
  if (s.idx >= s.qs.length) return finishIQ();
  const q = s.qs[s.idx];
  body.innerHTML = `
    <div class="iq-prog">Câu ${s.idx + 1}/${s.qs.length} · <span class="iq-cat">${escHtml(q.category)}</span> · ✅ ${s.correct} đúng</div>
    <div class="iq-track"><div class="iq-fill" style="width:${s.idx / s.qs.length * 100}%"></div></div>
    <div class="iq-q">${escHtml(q.q)}</div>
    <div class="iq-opts">${q.options.map((o, i) => `<button class="iq-opt" data-i="${i}">${escHtml(o)}</button>`).join('')}</div>
    <div id="iq-fb" class="iq-fb"></div>
    <button id="iq-next" class="iq-next" hidden></button>`;
  body.querySelectorAll('.iq-opt').forEach(b => b.onclick = () => answerIQ(+b.dataset.i));
}

function answerIQ(i) {
  const s = iqState;
  if (s.answered) return;
  s.answered = true;
  const q = s.qs[s.idx];
  document.querySelectorAll('.iq-opt').forEach((b, idx) => {
    b.disabled = true;
    if (idx === q.answer) b.classList.add('correct');
    else if (idx === i) b.classList.add('wrong');
  });
  const ok = i === q.answer;
  if (ok) s.correct++;
  document.getElementById('iq-fb').innerHTML = `<div class="${ok ? 'iq-ok' : 'iq-no'}">${ok ? '✅ Chính xác! ' : '❌ Chưa đúng. '}${escHtml(q.explain)}</div>`;
  const next = document.getElementById('iq-next');
  next.hidden = false;
  next.textContent = s.idx + 1 >= s.qs.length ? 'Xem kết quả →' : 'Câu tiếp →';
  next.onclick = () => { s.idx++; s.answered = false; showIQ(); };
  logActivity();
}

function finishIQ() {
  const s = iqState;
  const pct = Math.round(s.correct / s.qs.length * 100);
  const iq = Math.round(85 + pct * 0.6); // ước lượng vui: 85..145
  const best = store.get('prep-iq-best', null);
  if (!best || iq > best.iq) store.set('prep-iq-best', { iq, correct: s.correct, total: s.qs.length, date: dayKey(new Date()) });
  const tier = pct >= 90 ? 'Xuất sắc 🌟' : pct >= 70 ? 'Tốt 👏' : pct >= 50 ? 'Khá 🙂' : 'Cần luyện thêm 💪';
  document.getElementById('iq-body').innerHTML = `
    <div class="iq-done">
      <div class="iq-score-ring" style="--p:${pct}"><div class="rd-center"><b>${iq}</b><small>IQ ước lượng</small></div></div>
      <h2>${tier}</h2>
      <p>Bạn trả lời đúng <b>${s.correct}/${s.qs.length}</b> câu (${pct}%).</p>
      <p class="iq-note">⚠️ Điểm IQ ở đây chỉ để rèn tư duy cho vui, KHÔNG phải bài test IQ chuẩn hóa.</p>
      <button id="iq-again" class="iq-start-btn">🔁 Làm lại</button>
    </div>`;
  document.getElementById('iq-again').onclick = () => renderIQ();
}

// ---------- Phím tắt ----------
function initShortcuts() {
  const order = ['docs', 'flashcards', 'writing', 'code', 'coding', 'mock', 'plan', 'dashboard'];
  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // Đang gõ trong ô nhập / vùng gõ code thì không cướp phím
    if (e.target.closest?.('input, textarea, select, #ct-code, [contenteditable]')) return;
    if (e.key >= '1' && e.key <= '8') switchView(order[+e.key - 1]);
    else if (e.key === '/') {
      e.preventDefault();
      switchView('docs');
      document.getElementById('sb-search').focus();
    }
  });
}

// ---------- Đồng bộ Firebase (Auth Google + Firestore) ----------
// Giữ localStorage làm nguồn chính; khi đăng nhập thì đẩy lên / kéo về Firestore.
// Chiến lược: last-write-wins theo CẢ GÓI (so sánh updatedAt). Đủ cho 1 người dùng nhiều máy;
// nếu sửa ở 2 máy mà chưa đồng bộ thì máy có mốc thời gian cũ hơn sẽ bị ghi đè.
let fbAuth = null, fbDb = null, fbUser = null, syncReady = false, pushTimer = null;

function syncConfigured() {
  const c = window.FIREBASE_CONFIG;
  return !!(c && c.apiKey && !/DÁN_VÀO|YOUR_/.test(c.apiKey));
}

function gatherPrepData() {
  const data = {};
  PREP_KEYS.forEach(k => {
    const v = localStorage.getItem(k);
    if (v != null) { try { data[k] = JSON.parse(v); } catch {} }
  });
  return data;
}
function applyPrepData(data) {
  if (!data) return;
  PREP_KEYS.forEach(k => { if (k in data) localStorage.setItem(k, JSON.stringify(data[k])); });
}
function localUpdatedAt() { return store.get('prep-sync-meta', { updatedAt: 0 }).updatedAt || 0; }
function setLocalUpdatedAt(at) {
  const m = store.get('prep-sync-meta', {});
  m.updatedAt = at;
  localStorage.setItem('prep-sync-meta', JSON.stringify(m)); // ghi thẳng để khỏi kích lại onStoreWrite
}

function initSync() {
  const btn = document.getElementById('sync-btn');
  if (!btn) return;
  if (typeof firebase === 'undefined' || !syncConfigured()) {
    btn.onclick = () => alert('Chưa cấu hình Firebase.\n\nMở file study-web/public/firebase-config.js, làm theo hướng dẫn trong đó (tạo project + dán config), rồi tải lại trang.');
    return;
  }
  try {
    firebase.initializeApp(window.FIREBASE_CONFIG);
    fbAuth = firebase.auth();
    fbDb = firebase.firestore();
  } catch (e) {
    btn.textContent = '☁️ Lỗi';
    btn.onclick = () => alert('Khởi tạo Firebase lỗi: ' + e.message);
    return;
  }
  syncReady = true;
  onStoreWrite = key => { if (key !== 'prep-sync-meta') schedulePush(); };

  fbAuth.onAuthStateChanged(async user => {
    fbUser = user;
    authResolved = true;
    renderSyncBtn();
    renderLoginHint();
    if (user) await onSignedIn();
    reapplyView(); // mở khóa / khóa lại tab theo trạng thái đăng nhập mới
  });

  btn.onclick = () => (fbUser ? toggleSyncPanel() : signInSync());
}

function renderSyncBtn() {
  const btn = document.getElementById('sync-btn');
  if (!btn) return;
  btn.textContent = fbUser ? `☁️ ${(fbUser.email || 'đã đăng nhập').split('@')[0]}` : '☁️ Đăng nhập';
}

/** Banner nhắc đăng nhập khi đã cấu hình Firebase mà người dùng chưa đăng nhập. */
function renderLoginHint() {
  const dismissed = localStorage.getItem('login-hint-off') === '1';
  const show = syncReady && !fbUser && !dismissed;
  let el = document.getElementById('login-hint');
  if (!show) { el?.remove(); return; }
  if (el) return; // đã hiện rồi, khỏi tạo lại
  el = document.createElement('div');
  el.id = 'login-hint';
  el.innerHTML = `
    <span class="lh-text">☁️ Đăng nhập để lưu và đồng bộ tiến độ</span>
    <button class="lh-in">Đăng nhập</button>
    <button class="lh-x" title="Ẩn nhắc nhở này" aria-label="Ẩn">×</button>`;
  document.body.appendChild(el);
  el.querySelector('.lh-in').onclick = () => signInSync();
  el.querySelector('.lh-x').onclick = () => { localStorage.setItem('login-hint-off', '1'); el.remove(); };
}

async function signInSync() {
  try {
    await fbAuth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
  } catch (e) {
    alert('Đăng nhập thất bại: ' + (e.message || e.code));
  }
}

/** Sau khi đăng nhập: hoà dữ liệu local <-> cloud theo updatedAt */
async function onSignedIn() {
  let snap;
  try { snap = await fbDb.collection('users').doc(fbUser.uid).get(); }
  catch (e) { console.warn('sync get lỗi', e); toast('⚠️ Không đọc được cloud'); return; }

  const remote = snap.exists ? snap.data() : null;
  const localAt = localUpdatedAt();

  if (!remote) {
    await pushRemote();                       // cloud trống → đẩy local lên lần đầu
    toast('☁️ Đã tạo bản sao trên cloud');
  } else if ((remote.updatedAt || 0) > localAt) {
    const localHasData = Object.keys(gatherPrepData()).length > 0;
    if (!localHasData || confirm('☁️ Cloud có tiến độ mới hơn máy này.\nKéo về (ghi đè dữ liệu hiện tại trên máy)?')) {
      pullApply(remote);
    }
  } else if (localAt > (remote.updatedAt || 0)) {
    await pushRemote();                       // local mới hơn → đẩy lên
    toast('☁️ Đã đồng bộ');
  } else {
    toast('☁️ Đã đồng bộ');
  }
}

function pullApply(remote) {
  try {
    applyPrepData(JSON.parse(remote.blob || '{}'));
    setLocalUpdatedAt(remote.updatedAt || Date.now());
    switchView(store.get('prep-last-view', 'docs')); // vẽ lại view đang mở
    toast('⬇️ Đã kéo dữ liệu từ cloud');
  } catch (e) { alert('Kéo dữ liệu lỗi: ' + e.message); }
}

async function pushRemote() {
  if (!syncReady || !fbUser) return;
  const at = Date.now();
  setLocalUpdatedAt(at);
  try {
    await fbDb.collection('users').doc(fbUser.uid).set({
      blob: JSON.stringify(gatherPrepData()),
      updatedAt: at,
      email: fbUser.email || '',
    });
  } catch (e) { console.warn('push lỗi', e); }
}

function schedulePush() {
  if (!syncReady || !fbUser) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushRemote, 2500); // gộp nhiều thay đổi liên tiếp thành 1 lần ghi
}

function toggleSyncPanel() {
  const existing = document.getElementById('sync-panel');
  if (existing) { existing.remove(); return; }
  const p = document.createElement('div');
  p.id = 'sync-panel';
  const at = localUpdatedAt();
  p.innerHTML = `
    <div class="sp-email">${escHtml(fbUser.email || '')}</div>
    <div class="sp-when">Đồng bộ lần cuối: ${at ? new Date(at).toLocaleString('vi-VN') : '—'}</div>
    <button class="sp-act" data-act="push">⬆️ Đẩy lên cloud</button>
    <button class="sp-act" data-act="pull">⬇️ Kéo về từ cloud</button>
    <button class="sp-act" data-act="out">🚪 Đăng xuất</button>`;
  document.body.appendChild(p);
  const r = document.getElementById('sync-btn').getBoundingClientRect();
  p.style.top = (r.bottom + 6) + 'px';
  p.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
  p.querySelectorAll('.sp-act').forEach(b => b.onclick = async () => {
    const act = b.dataset.act;
    p.remove();
    if (act === 'push') { await pushRemote(); toast('⬆️ Đã đẩy lên cloud'); }
    else if (act === 'pull') {
      const snap = await fbDb.collection('users').doc(fbUser.uid).get();
      if (snap.exists) pullApply(snap.data()); else toast('Cloud chưa có dữ liệu');
    } else if (act === 'out') { await fbAuth.signOut(); toast('Đã đăng xuất'); }
  });
  setTimeout(() => {
    const close = e => {
      if (!e.target.closest('#sync-panel, #sync-btn')) {
        document.getElementById('sync-panel')?.remove();
        document.removeEventListener('click', close);
      }
    };
    document.addEventListener('click', close);
  }, 0);
}

let toastTimer = null;
function toast(msg) {
  let t = document.getElementById('app-toast');
  if (!t) { t = document.createElement('div'); t.id = 'app-toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---------- Khởi động ----------
(async function init() {
  initSearch();
  initTheme();
  initPomodoro();
  initSidebarToggle();
  initShortcuts();
  initSync();
  document.querySelector('.brand').addEventListener('click', () => renderHome());
  const lastView = store.get('prep-last-view', 'docs'); // đọc trước khi renderHome ghi đè
  await loadTree();
  const hashDoc = location.hash.match(/doc=([^&]+)/);
  const start = hashDoc ? decodeURIComponent(hashDoc[1]) : store.get('prep-last-doc', null);
  if (start) openDoc(start, false);
  else renderHome(false);
  // Quay lại đúng tab đang dùng trước khi reload (trừ khi mở bằng link #doc=…)
  if (!hashDoc && lastView !== 'docs') switchView(lastView);
})();
