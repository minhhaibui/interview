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
  return _docsPromise ??= fetch('data/docs.json')
    .then(r => { if (!r.ok) throw new Error('docs.json ' + r.status); return r.json(); })
    .catch(() => { _docsPromise = null; return {}; }); // lỗi tải → coi như rỗng, cho phép thử lại lần sau
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

// Xáo trộn Fisher-Yates (trả về bản sao) — dùng chung mọi chỗ cần ngẫu nhiên đều
const shuffleArr = a => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };

// Cache Set id theo MẢNG bank (bank tĩnh, window.X giữ nguyên reference) — badge/coverage
// được tính lại sau MỖI câu trả lời nên không dựng lại Set ~200 phần tử mỗi lần.
const bankIdCache = new WeakMap();
function bankIds(bank) {
  const arr = bank || [];
  let ids = bankIdCache.get(arr);
  if (!ids) { ids = new Set(arr.map(x => String(x.id))); if (arr.length) bankIdCache.set(arr, ids); }
  return ids;
}

/** Độ phủ một bank câu hỏi bất kỳ: {done, total} — chỉ đếm id đã làm CÒN tồn tại trong bank.
 *  Nguồn sự thật duy nhất cho badge / readiness / think-stats / coverage tab Tư duy. */
function bankCoverage(bank, doneKey) {
  const ids = bankIds(bank);
  const done = Object.keys(store.get(doneKey, {})).filter(id => ids.has(String(id))).length;
  return { done, total: ids.size };
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

// ---------- Ôn câu trắc nghiệm đã làm sai (xuyên các mode) ----------
// Lưu prep-quiz-wrong = { [mode]: { [id]: timestamp } }. Chọn sai → ghi; ôn lại đúng → xoá.
const WRONG_KEY = 'prep-quiz-wrong';
function getWrong() { return store.get(WRONG_KEY, {}); }
function recordWrong(mode, id) {
  if (!mode || id == null) return;
  const w = getWrong();
  (w[mode] = w[mode] || {})[id] = Date.now();
  store.set(WRONG_KEY, w);
}
function clearWrong(mode, id) {
  if (!mode || id == null) return;
  const w = getWrong();
  if (w[mode] && w[mode][id] != null) {
    delete w[mode][id];
    if (!Object.keys(w[mode]).length) delete w[mode];
    store.set(WRONG_KEY, w);
  }
}
function wrongIds(mode) { return Object.keys(getWrong()[mode] || {}); }
/** Tổng số câu sai còn tồn tại trong ngân hàng (loại id đã bị gỡ khỏi data). */
function wrongTotal() {
  const w = getWrong();
  return Object.keys(w).reduce((sum, mode) => {
    const live = QUIZ_MODES[mode];
    if (!live) return sum;
    const ids = bankIds(live.data());
    return sum + Object.keys(w[mode]).filter(id => ids.has(String(id))).length;
  }, 0);
}

// ---------- 📌 Ghim câu hỏi (bookmark thủ công, khác hàng đợi câu sai tự động) ----------
// Cùng cấu trúc {mode: {id: timestamp}} như prep-quiz-wrong; chỉ user gỡ ghim, chấm đúng KHÔNG tự gỡ.
const PIN_KEY = 'prep-quiz-pinned';
function getPinned() { return store.get(PIN_KEY, {}); }
function isPinned(mode, id) { const p = getPinned(); return !!(p[mode] && p[mode][id] != null); }
/** Đảo trạng thái ghim, trả về trạng thái MỚI (true = vừa ghim). */
function togglePin(mode, id) {
  if (!mode || id == null) return false;
  const p = getPinned();
  if (p[mode] && p[mode][id] != null) {
    delete p[mode][id];
    if (!Object.keys(p[mode]).length) delete p[mode];
    store.set(PIN_KEY, p);
    return false;
  }
  (p[mode] = p[mode] || {})[id] = Date.now();
  store.set(PIN_KEY, p);
  return true;
}
function pinnedIds(mode) { return Object.keys(getPinned()[mode] || {}); }
/** Tổng số câu ghim còn tồn tại trong ngân hàng (loại id đã bị gỡ khỏi data). */
function pinnedTotal() {
  const p = getPinned();
  return Object.keys(p).reduce((sum, mode) => {
    const live = QUIZ_MODES[mode];
    if (!live) return sum;
    const ids = bankIds(live.data());
    return sum + Object.keys(p[mode]).filter(id => ids.has(String(id))).length;
  }, 0);
}
/** Nút 📌 cho ô feedback sau khi chấm — dùng chung mọi engine trắc nghiệm. */
function pinBtnHtml(mode, id) {
  if (!mode || id == null || !QUIZ_MODES[mode]) return '';
  const on = isPinned(mode, id);
  return `<button class="oq-pin${on ? ' pinned' : ''}" data-mode="${mode}" data-qid="${escHtml(String(id))}" type="button"
    title="Ghim để ôn lại trước phỏng vấn (gỡ ghim thủ công, chấm đúng không tự gỡ)">${on ? '📌 Đã ghim' : '📌 Ghim câu này'}</button>`;
}
function bindPinBtns(scope) {
  scope.querySelectorAll('.oq-pin').forEach(b => b.onclick = (ev) => {
    const on = togglePin(b.dataset.mode, b.dataset.qid);
    b.classList.toggle('pinned', on);
    b.textContent = on ? '📌 Đã ghim' : '📌 Ghim câu này';
    // Click CHUỘT thì nhả focus: Enter ngay sau đó phải là "sang câu tiếp" chứ không toggle lại ghim.
    // Kích hoạt bằng bàn phím (detail=0) giữ focus để người dùng phím thao tác tiếp.
    if (ev && ev.detail) b.blur();
  });
}

// ---------- Tabs / views ----------
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

// ----- Menu xổ điều hướng (gom nhóm tab) -----
function closeNavGroups() { document.querySelectorAll('.navgroup.open').forEach(g => g.classList.remove('open')); }
document.querySelectorAll('.navgroup-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const grp = btn.closest('.navgroup');
    const willOpen = !grp.classList.contains('open');
    closeNavGroups();
    if (willOpen) grp.classList.add('open');
  });
});
// chọn 1 mục con hoặc bấm ra ngoài → đóng menu
document.querySelectorAll('.navgroup-menu .tab').forEach(t => t.addEventListener('click', closeNavGroups));
document.addEventListener('click', closeNavGroups);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeNavGroups(); });

/** Tô đậm nút NHÓM chứa view đang mở (vì .tab con nằm trong menu ẩn). */
function updateNavActive(name) {
  document.querySelectorAll('.navgroup').forEach(g => {
    const has = !!g.querySelector(`.tab[data-view="${name}"]`);
    g.querySelector('.navgroup-btn')?.classList.toggle('active', has);
  });
}

// Các tab có LƯU TIẾN ĐỘ → cần đăng nhập (chỉ áp dụng khi đã cấu hình Firebase).
// Tab 📚 Tài liệu để mở tự do cho người chưa đăng nhập còn đọc nội dung.
const GATED_VIEWS = new Set(['today', 'flashcards', 'writing', 'code', 'coding', 'mock', 'company', 'star', 'design', 'plan', 'dashboard']);
let authResolved = false; // true sau lần onAuthStateChanged đầu tiên
const viewGated = name => syncReady && GATED_VIEWS.has(name);

function switchView(name) {
  if (typeof iqTimerId !== 'undefined') clearInterval(iqTimerId); // rời tab → dừng bài test IQ đang chạy
  if (typeof dgTimerId !== 'undefined' && dgTimerId) { clearInterval(dgTimerId); dgTimerId = null; } // dừng đồng hồ drill thiết kế
  if (typeof mkTimerId !== 'undefined') clearInterval(mkTimerId); // dừng đồng hồ Mock đang chạy ngầm
  if (typeof examTimerId !== 'undefined' && examTimerId) { clearInterval(examTimerId); examTimerId = null; } // dừng ticker Thi thử (bài dở vẫn giữ, quay lại chạy tiếp theo deadline)
  try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch { /* trình duyệt không hỗ trợ */ } // tắt TTS đang đọc
  try { if (wrRecog) { wrRecog.abort(); wrRecog = null; } } catch { /* noop */ } // tắt mic Luyện viết khi rời tab
  stopDictation(); // tắt micro 🎙️ nói-để-điền (Mock/STAR) khi rời tab
  try { if (aiRecog) { aiRecog.abort(); aiRecog = null; } } catch { /* noop */ } // tắt mic Phỏng vấn AI khi rời tab
  document.querySelectorAll('.listening').forEach(el => el.classList.remove('listening')); // gỡ trạng thái mic đang nghe
  store.set('prep-last-view', name); // nhớ tab đang mở cho lần reload sau
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  updateNavActive(name); // tô đậm nút nhóm chứa view đang mở
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
  // Chặn tab cần đăng nhập khi chưa login
  if (viewGated(name) && !fbUser) {
    showLoginGate(!authResolved);
    return; // không init/vẽ nội dung tab khi đang khóa
  }
  hideLoginGate();
  if (name === 'today') renderToday();
  if (name === 'flashcards') initFlashcards().then(() => fcLoaded && fillFcWeekSelect());
  if (name === 'writing') initWriting().then(() => wrInit && WR_SENTENCES && fillWrWeekSelect());
  if (name === 'code') initCodeTyping();
  if (name === 'coding') initThink();
  if (name === 'mock') initMock().then(() => mkInit && fillMockWeekSelect());
  if (name === 'company') renderCompany();
  if (name === 'star') renderStar();
  if (name === 'design') renderDesign();
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
      <p class="home-tip">Mẹo: phím <kbd>1</kbd>–<kbd>9</kbd> chuyển tab nhanh, <kbd>/</kbd> để tìm kiếm tài liệu. Bấm <kbd>2</kbd> để mở 🔥 <b>Hôm nay</b>.</p>
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
    document.querySelector('.wr-mode[data-mode="mix"]')?.click();
  });
  document.getElementById('hc-continue')?.addEventListener('click', () => openDoc(last));
  document.getElementById('hc-week')?.addEventListener('click', () => openDoc(`${nextWeek}/README.md`));
  document.getElementById('hc-due')?.addEventListener('click', () => goFlash('__due__'));
  document.getElementById('hc-leech')?.addEventListener('click', () => goFlash('__leech__'));
  document.getElementById('hc-code')?.addEventListener('click', () => switchView('code'));
  document.getElementById('hc-mock')?.addEventListener('click', () => switchView('mock'));
  document.getElementById('hc-wrong')?.addEventListener('click', () => {
    switchView('mock');
    loadMockPool().then(() => {
      fillMockWeekSelect();
      const sel = document.getElementById('mk-week');
      if (sel) sel.value = '__wrong__';
    });
  });
}

// ---------- Tab "Hôm nay": ôn tập trong ngày + mục tiêu + huy hiệu ----------
const DAILY_GOAL_DEFAULT = 20;

/** Đếm chuỗi ngày học liên tiếp (hôm nay chưa học vẫn tính tới hôm qua). */
function currentStreak() {
  const acts = store.get('prep-activity', {});
  let streak = 0;
  const d = new Date();
  if (!acts[dayKey(d)]) d.setDate(d.getDate() - 1);
  while (acts[dayKey(d)] > 0) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}

/** Tính danh sách huy hiệu thành tích từ dữ liệu đã có. */
function computeBadges() {
  const acts = store.get('prep-activity', {});
  const streak = currentStreak();
  const srs = store.get('prep-srs', {});
  const learned = Object.values(srs).filter(e => (e.box || 0) >= 2).length;
  const solved = Object.keys(store.get('prep-coding-solved', {})).length;
  const codingTotal = (window.CODING_PROBLEMS || []).length;
  const iqBest = store.get('prep-iq-best', {}).iq || 0;
  const mockCount = store.get('prep-mock-history', []).length;
  const ivPass = store.get('prep-interview-history', []).some(r => (r.overall || 0) >= 70);
  const wpm = store.get('prep-code-best', {}).wpm || 0;
  const pomoTotal = Object.values(store.get('prep-pomo', {})).reduce((a, b) => a + b, 0);
  const designDrills = new Set(store.get('prep-design-history', []).map(h => h.id)).size;
  // Độ phủ 4 quiz + sửa bug — cùng nguồn bankCoverage với readiness/think-stats
  const oqCov = coverageOf('output'), apiCov = coverageOf('api'), sqlCov = coverageOf('sql'), cliCov = coverageOf('cli');
  const dbgCov = bankCoverage(window.DEBUG_CHALLENGES, 'prep-debug-solved');
  const starIds = new Set((window.STAR_QUESTIONS || []).map(q => q.id));
  const starDraftsB = store.get('prep-star-drafts', {});
  const starBuiltN = [...starIds].filter(id => { const d = starDraftsB[id] || {}; return d.s && d.t && d.a && d.r && (d.s + d.t + d.a + d.r).trim().length >= 80; }).length;
  // Capstone: upgrade đã nghiệm thu đủ mọi mục
  const capB = store.get('prep-capstone', {});
  const capUps = window.CAPSTONE_UPGRADES || [];
  const capUpsDone = capUps.filter(u => u.items.every((_, i) => (capB[u.id] || {})[i])).length;
  // Tuần hoàn thành (đủ mọi mục checklist)
  const progress = store.get('prep-progress', {});
  const weeksGroup = TREE.find(g => g.title.includes('12 tuần'));
  const weeks = [...new Set((weeksGroup?.items || []).map(i => i.week).filter(Boolean))];
  const weeksDone = weeks.filter(wk => WEEK_TASKS.every(([k]) => (progress[wk] || {})[k])).length;

  const B = (id, icon, name, earned, hint) => ({ id, icon, name, earned, hint });
  return [
    B('streak3', '🔥', 'Khởi động · chuỗi 3 ngày', streak >= 3, `Học liên tục 3 ngày (đang ${streak})`),
    B('streak7', '🔥', 'Bền bỉ · chuỗi 7 ngày', streak >= 7, `Học liên tục 7 ngày (đang ${streak})`),
    B('streak14', '🔥', 'Kỷ luật · chuỗi 14 ngày', streak >= 14, `Học liên tục 14 ngày (đang ${streak})`),
    B('streak30', '🔥', 'Thép đã tôi · chuỗi 30 ngày', streak >= 30, `Học liên tục 30 ngày (đang ${streak})`),
    B('vocab25', '📚', 'Thuộc 25 từ', learned >= 25, `Thuộc ${learned}/25 từ (hộp SRS ≥2)`),
    B('vocab100', '📚', 'Thuộc 100 từ', learned >= 100, `Thuộc ${learned}/100 từ`),
    B('vocab250', '📚', 'Kho từ vựng · 250 từ', learned >= 250, `Thuộc ${learned}/250 từ`),
    B('code1', '💻', 'Giải bài code đầu tiên', solved >= 1, `Giải ${solved} bài`),
    B('code5', '💻', 'Giải 5 bài code', solved >= 5, `Giải ${solved}/5 bài`),
    B('codeAll', '💻', 'Giải hết bài code', codingTotal > 0 && solved >= codingTotal, `Giải ${solved}/${codingTotal} bài`),
    B('iq110', '🧩', 'IQ ước lượng ≥ 110', iqBest >= 110, `Kỷ lục IQ ${iqBest || '—'}`),
    B('iq125', '🧩', 'IQ ước lượng ≥ 125', iqBest >= 125, `Kỷ lục IQ ${iqBest || '—'}`),
    B('mock1', '🎯', 'Buổi mock đầu tiên', mockCount >= 1, `${mockCount} buổi mock`),
    B('mock10', '🎯', '10 buổi mock', mockCount >= 10, `${mockCount}/10 buổi mock`),
    B('ivpass', '🏢', 'Pass phỏng vấn tổng hợp', ivPass, 'Đạt ≥70 điểm một buổi phỏng vấn 4 vòng'),
    B('design1', '🏛️', 'Đề thiết kế đầu tiên', designDrills >= 1, `Đã luyện ${designDrills} đề System Design`),
    B('design5', '🏛️', 'Kiến trúc sư · 5 đề', designDrills >= 5, `Đã luyện ${designDrills}/5 đề System Design`),
    B('oq5', '🔍', 'Đoán đúng 5 output', oqCov.done >= 5, `Đoán đúng ${oqCov.done} snippet`),
    B('oqall', '🔍', 'Bậc thầy bẫy JS', oqCov.total > 0 && oqCov.done >= oqCov.total, `Đoán đúng ${oqCov.done}/${oqCov.total} snippet`),
    B('debug1', '🐛', 'Sửa bug đầu tiên', dbgCov.done >= 1, `Đã sửa ${dbgCov.done} bug`),
    B('debugall', '🐛', 'Thợ săn bug', dbgCov.total > 0 && dbgCov.done >= dbgCov.total, `Đã sửa ${dbgCov.done}/${dbgCov.total} bug`),
    B('api5', '📡', 'Trả lời đúng 5 câu API/HTTP', apiCov.done >= 5, `Đúng ${apiCov.done} câu API/HTTP`),
    B('apiall', '📡', 'Thạo HTTP/REST', apiCov.total > 0 && apiCov.done >= apiCov.total, `Đúng ${apiCov.done}/${apiCov.total} câu API/HTTP`),
    B('sql5', '🗄️', 'Trả lời đúng 5 câu SQL', sqlCov.done >= 5, `Đúng ${sqlCov.done} câu SQL`),
    B('sqlall', '🗄️', 'Bậc thầy SQL', sqlCov.total > 0 && sqlCov.done >= sqlCov.total, `Đúng ${sqlCov.done}/${sqlCov.total} câu SQL`),
    B('cli5', '🖥️', 'Trả lời đúng 5 câu CLI', cliCov.done >= 5, `Đúng ${cliCov.done} câu CLI`),
    B('cliall', '🖥️', 'Thạo dòng lệnh', cliCov.total > 0 && cliCov.done >= cliCov.total, `Đúng ${cliCov.done}/${cliCov.total} câu CLI`),
    B('star1', '🌟', 'Soạn câu chuyện STAR đầu tiên', starBuiltN >= 1, `Đã soạn ${starBuiltN} câu chuyện behavioral`),
    B('star5', '🌟', 'Kho chuyện · 5 câu STAR', starBuiltN >= 5, `Đã soạn ${starBuiltN}/5 câu chuyện behavioral`),
    B('wpm40', '⌨️', 'Gõ code 40 WPM', wpm >= 40, `Kỷ lục ${wpm || 0} WPM`),
    B('wpm60', '⌨️', 'Gõ code 60 WPM', wpm >= 60, `Kỷ lục ${wpm || 0} WPM`),
    B('pomo10', '🍅', '10 pomodoro', pomoTotal >= 10, `${pomoTotal}/10 pomodoro`),
    B('pomo50', '🍅', '50 pomodoro', pomoTotal >= 50, `${pomoTotal}/50 pomodoro`),
    B('cap1', '🧪', 'Thực chiến · nghiệm thu 1 upgrade', capUpsDone >= 1, `${capUpsDone}/${capUps.length || 5} upgrade capstone xong`),
    B('capAll', '🏗️', 'Full-stack sẹo · đủ 5 upgrade', capUps.length > 0 && capUpsDone >= capUps.length, `${capUpsDone}/${capUps.length || 5} upgrade capstone xong`),
    B('week1', '✅', 'Hoàn thành 1 tuần', weeksDone >= 1, `${weeksDone}/${weeks.length || 12} tuần xong`),
    B('weekAll', '🏁', 'Hoàn thành 12 tuần', weeks.length > 0 && weeksDone >= weeks.length, `${weeksDone}/${weeks.length || 12} tuần xong`),
  ];
}

/** Vòng tròn tiến độ mục tiêu (SVG thuần). */
function goalRing(pct) {
  const r = 52, c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, pct / 100)));
  return `<svg class="goal-ring" viewBox="0 0 120 120" width="120" height="120">
    <circle cx="60" cy="60" r="${r}" class="gr-track"/>
    <circle cx="60" cy="60" r="${r}" class="gr-fill" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
  </svg>`;
}

// Mẹo phỏng vấn/ôn tập — xoay vòng MỖI NGÀY (deterministic theo số thứ tự ngày).
const STUDY_TIPS = [
  'Trả lời câu hỏi hành vi theo cấu trúc STAR (Tình huống → Nhiệm vụ → Hành động → Kết quả) — nhớ nêu kết quả định lượng.',
  'Khi bí một bài coding, hãy nói to suy nghĩ của bạn — interviewer chấm cả cách tư duy, không chỉ đáp án cuối.',
  'Ôn theo spaced repetition: gặp lại đúng lúc sắp quên giúp nhớ lâu gấp nhiều lần so với học dồn một lúc.',
  'Trước bài system design, luôn hỏi rõ yêu cầu & ước lượng quy mô (QPS, dung lượng) TRƯỚC khi vẽ kiến trúc.',
  'Giải thích được trade-off quan trọng hơn thuộc lòng định nghĩa — ví dụ SQL vs NoSQL tuỳ pattern truy vấn.',
  'Luyện nói đáp án thành tiếng, đừng chỉ đọc thầm — phỏng vấn là kỹ năng trình bày, không chỉ kiến thức.',
  'Nắm rõ event loop của Node.js: phân biệt macrotask (setTimeout) và microtask (Promise) — câu rất hay gặp.',
  'Index tăng tốc đọc nhưng làm chậm ghi và tốn bộ nhớ — biết khi nào KHÔNG nên đánh index cũng quan trọng.',
  'Idempotency key giúp API an toàn khi client retry — nhớ nêu khi thiết kế thanh toán hoặc đặt hàng.',
  'Khi nói về cache, luôn nhắc 3 vấn đề kinh điển: cache penetration, cache breakdown, cache avalanche.',
  'Học 2 lượt: lượt 1 để HIỂU (đọc + lab), lượt 2 để NHỚ (rapid-fire + mock) ngay trước phỏng vấn.',
  'Chuẩn bị sẵn 3–4 câu chuyện dự án mạnh — mỗi câu xoay được cho nhiều câu hỏi hành vi khác nhau.',
  'Nghỉ ngắn kiểu Pomodoro (25 phút tập trung / 5 phút nghỉ) giúp giữ năng suất lâu hơn học liền tù tì.',
  'Kafka đảm bảo thứ tự TRONG một partition, không phải toàn topic — chọn message key cho đúng.',
  'Đừng giấu khi chưa biết — hãy nói cách bạn sẽ tìm ra câu trả lời; interviewer đánh giá cao sự trung thực.',
  'Ôn tiếng Anh giao tiếp mỗi ngày một chút — phỏng vấn tốt cần cả kiến thức lẫn khả năng diễn đạt trôi chảy.',
  'Mỗi tuần làm một bài 🎓 Thi thử có tính giờ — áp lực đồng hồ khi luyện giúp bạn bình tĩnh hơn ở bài test thật.',
  'Điểm thi thử thấp ở mảng nào? Đề 🔥 nước rút (trong 🎓 Thi thử) sẽ tự dồn câu vào đúng mảng yếu đó cho bạn.',
];
/** Chọn mẹo theo số thứ tự ngày (tách riêng để test thuần). */
function pickTip(dayNum) { return STUDY_TIPS[((dayNum % STUDY_TIPS.length) + STUDY_TIPS.length) % STUDY_TIPS.length]; }
function todayTipIdx() {
  const d = new Date();
  const dayNum = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  return ((dayNum % STUDY_TIPS.length) + STUDY_TIPS.length) % STUDY_TIPS.length;
}
function tipOfDay() { return STUDY_TIPS[todayTipIdx()]; }
let tipIdx = 0; // mẹo đang hiển thị (nút 🔄 xoay qua mẹo kế)

/** Số ngày còn lại tới dateStr ('YYYY-MM-DD') tính theo mốc nửa đêm địa phương. Pure → dễ test. */
function daysUntil(dateStr, now = Date.now()) {
  if (!dateStr) return null;
  const t = new Date(dateStr + 'T00:00:00');
  if (isNaN(t.getTime())) return null;
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - today.getTime()) / 86400000);
}

/** Card đếm ngược ngày phỏng vấn cho tab Hôm nay (đặt/đổi/xoá ngày). */
function interviewCountdownHtml() {
  const date = store.get('prep-interview-date', '');
  const d = daysUntil(date);
  if (!date || d == null) {
    return `<div class="td-countdown td-cd-empty">
      <span class="td-cd-ic">🎯</span>
      <div class="td-cd-body"><b>Sắp có buổi phỏng vấn?</b> Đặt ngày để đếm ngược & giữ động lực nước rút.
        <div class="td-cd-set"><input type="date" id="td-cd-input" aria-label="Ngày phỏng vấn"><button id="td-cd-save" class="dg-go dg-link">Đặt ngày</button></div>
      </div></div>`;
  }
  let msg, cls;
  if (d > 7) { msg = `Còn <b>${d}</b> ngày đến buổi phỏng vấn — cứ ôn đều mỗi ngày là ổn.`; cls = ''; }
  else if (d > 1) { msg = `⏰ Chỉ còn <b>${d}</b> ngày — vào chế độ nước rút: 🔁 ôn câu sai + 🎓 thi thử đề 🔥 mảng yếu + 🎯 mock mỗi ngày!`; cls = 'td-cd-soon'; }
  else if (d === 1) { msg = `🔥 <b>Ngày mai</b> phỏng vấn! Ôn nhẹ điểm yếu, chuẩn bị câu hỏi ngược, ngủ đủ giấc.`; cls = 'td-cd-soon'; }
  else if (d === 0) { msg = `💪 <b>Hôm nay</b> là ngày phỏng vấn! Hít thở sâu, tự tin — bạn chuẩn bị kỹ rồi!`; cls = 'td-cd-today'; }
  else { msg = `Buổi phỏng vấn đặt ngày <b>${escHtml(date)}</b> đã qua. Chúc bạn kết quả tốt! 🍀`; cls = 'td-cd-past'; }
  return `<div class="td-countdown ${cls}">
    <span class="td-cd-ic">🎯</span>
    <div class="td-cd-body">${msg}</div>
    <button id="td-cd-clear" class="td-cd-clear" title="Đổi / xoá ngày">✕</button>
  </div>`;
}

/** Panel "🏁 Ưu tiên nước rút" ở tab Hôm nay: 3 mảng Readiness kéo điểm nhiều nhất, chỉ hiện khi còn ≤14 ngày đến buổi phỏng vấn. */
function sprintPanelHtml() {
  const d = daysUntil(store.get('prep-interview-date', ''));
  if (d == null || d < 0 || d > 14) return '';
  const top = [...computeReadiness().parts]
    .sort((a, b) => (100 - b.pct) * b.weight - (100 - a.pct) * a.weight)
    .slice(0, 3);
  const rows = top.map(p => `
    <button class="td-sprint-row" data-view="${p.view}" title="${escHtml(p.tip)}">
      <span class="td-sprint-label">${p.label}</span>
      <span class="td-sprint-track"><span class="td-sprint-fill" style="width:${p.pct}%"></span></span>
      <b class="td-sprint-val">${p.pct}</b>
      <span class="td-go">▶</span>
    </button>`).join('');
  return `<div class="td-sprint">
    <h2 class="td-h2">🏁 Ưu tiên nước rút — 3 mảng đang kéo điểm sẵn sàng nhiều nhất</h2>
    <div class="td-sprint-rows">${rows}</div>
  </div>`;
}

async function renderToday() {
  const body = document.getElementById('today-body');
  body.innerHTML = '<p style="color:var(--muted)">Đang tải buổi ôn hôm nay…</p>';
  await loadDeck();

  const acts = store.get('prep-activity', {});
  const todayN = acts[dayKey(new Date())] || 0;
  const streak = currentStreak();
  const goal = store.get('prep-daily-goal', DAILY_GOAL_DEFAULT);
  const pct = goal ? Math.min(100, Math.round(todayN / goal * 100)) : 0;
  const h = new Date().getHours();
  const greet = h < 12 ? 'Chào buổi sáng' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';

  const due = filterDeck('__due__').length;
  const leech = filterDeck('__leech__').length;
  const wrongN = getMockWrong().length;
  const quizWrongN = wrongTotal();

  // Danh sách việc ôn gợi ý hôm nay
  const tasks = [];
  // Sát ngày phỏng vấn (≤3 ngày) → gợi ý in cheat sheet lên ĐẦU danh sách
  const cdDays = daysUntil(store.get('prep-interview-date', ''));
  if (cdDays != null && cdDays >= 0 && cdDays <= 3) {
    tasks.push({ id: 'td-print', ic: '🖨️', t: 'In bản ôn nhanh trước giờ G', s: 'Từ hay quên · câu đang sai · ý chính design · chuyện STAR', go: printSheet });
  }
  if (due) tasks.push({ id: 'td-due', ic: '📬', t: `Ôn ${due} từ đến hạn`, s: 'Flashcards theo lịch SRS', go: () => goToFlash('__due__') });
  if (leech) tasks.push({ id: 'td-leech', ic: '🔥', t: `Luyện ${leech} từ cứng đầu`, s: 'Những từ sai nhiều lần', go: () => goToFlash('__leech__') });
  tasks.push({ id: 'td-mix', ic: '⚡', t: 'Ôn nhanh ~10 câu (mix)', s: 'Trộn dịch từ + điền câu + nghe', go: goToWritingMix });
  tasks.push({ id: 'td-fttest', ic: '📝', t: 'Test gõ từ vựng', s: 'Hiện nghĩa Việt → gõ tiếng Anh, chấm điểm', go: goToVocabTest });
  if (wrongN) tasks.push({ id: 'td-wrong', ic: '🚩', t: `Ôn ${wrongN} câu mock đã sai`, s: 'Trả lời lại cho nhớ', go: goToMockWrong });
  if (quizWrongN) tasks.push({ id: 'td-quiz-wrong', ic: '🔁', t: `Ôn ${quizWrongN} câu trắc nghiệm đã sai`, s: 'Output · API · SQL · CLI · Anh · Tình huống — gom về một phiên', go: goToQuizReview });
  const pinnedN = pinnedTotal();
  if (pinnedN) tasks.push({ id: 'td-pinned', ic: '📌', t: `Ôn ${pinnedN} câu đã ghim`, s: 'Câu bạn tự đánh dấu để xem lại trước giờ G', go: goToPinnedReview });
  // 🎓 Chưa thi thử bao giờ, hoặc lần gần nhất đã quá 7 ngày → nhắc đo phong độ định kỳ
  const exams = store.get('prep-exam-history', []);
  const lastExam = exams.length ? exams[exams.length - 1].d : 0;
  if (!exams.length || Date.now() - lastExam > 7 * 864e5) {
    tasks.push({ id: 'td-exam', ic: '🎓', t: exams.length ? 'Thi thử — hơn 1 tuần chưa đo phong độ' : 'Làm bài thi thử đầu tiên', s: 'Đề trộn 6 mảng, có tính giờ, chấm như thi thật', go: goToExam });
  }
  // 🧪 Capstone: theo tuần kế hoạch đã tới upgrade nào mà chưa tick đủ nghiệm thu → nhắc làm
  const capUp = (() => {
    const ups = window.CAPSTONE_UPGRADES || [];
    const plan = store.get('prep-plan', null);
    if (!ups.length || !plan || !plan.start) return null;
    const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
    const wk = Math.floor((parse(dayKey(new Date())) - parse(plan.start)) / (7 * 86400000)) + 1;
    if (wk < 1) return null;
    const cap = store.get('prep-capstone', {});
    return ups.find(u => u.week <= wk && u.items.some((_, i) => !(cap[u.id] || {})[i])) || null;
  })();
  if (capUp) tasks.push({ id: 'td-capstone', ic: '🧪', t: `Capstone: ${capUp.label}`, s: 'Làm tận tay rồi tick nghiệm thu ở tab Kế hoạch', go: () => switchView('plan') });
  tasks.push({ id: 'td-think', ic: '🧠', t: 'Giải 1 bài luyện tư duy', s: 'Coding hoặc IQ', go: () => switchView('coding') });
  tasks.push({ id: 'td-mock', ic: '🎯', t: 'Mock interview nhanh', s: '5–10 câu ngẫu nhiên', go: () => switchView('mock') });
  tasks.push({ id: 'td-design', ic: '🏛️', t: 'Luyện 1 đề System Design', s: 'Tự chấm rubric hoặc nhờ AI chấm', go: () => switchView('design') });
  tasks.push({ id: 'td-star', ic: '🌟', t: 'Soạn 1 câu chuyện STAR', s: 'Câu hỏi phỏng vấn hành vi', go: () => switchView('star') });

  // Huy hiệu + đánh dấu cái MỚI đạt
  const badges = computeBadges();
  const earnedIds = badges.filter(b => b.earned).map(b => b.id);
  const seen = store.get('prep-badges-seen', []);
  const fresh = earnedIds.filter(id => !seen.includes(id));
  if (fresh.length) store.set('prep-badges-seen', [...seen, ...fresh]);
  const earnedN = earnedIds.length;

  body.innerHTML = `
    <div class="td-hero">
      <div class="td-hero-text">
        <h1>${greet}! 🔥</h1>
        <p class="td-streak">${streak
          ? `Đang giữ chuỗi <b>${streak} ngày</b> liên tiếp${todayN ? '' : ' — hôm nay chưa học, đừng để đứt!'}`
          : 'Chưa có chuỗi — học một chút hôm nay để bắt đầu!'}</p>
        <p class="td-sub">Hôm nay: <b>${todayN}</b> lượt · 🏅 <b>${earnedN}/${badges.length}</b> huy hiệu${pomoTodayCount() ? ` · 🍅 <b>${pomoTodayCount()}</b>` : ''}</p>
      </div>
      <div class="td-goal">
        <div class="td-ring-wrap">${goalRing(pct)}<span class="td-ring-label"><b>${todayN}</b><small>/ ${goal}</small></span></div>
        <div class="td-goal-ctl">
          <span>Mục tiêu/ngày</span>
          <select id="td-goal-sel">
            ${[10, 20, 30, 50, 80].map(g => `<option value="${g}" ${g === goal ? 'selected' : ''}>${g} lượt</option>`).join('')}
          </select>
        </div>
      </div>
    </div>

    ${interviewCountdownHtml()}
    ${sprintPanelHtml()}

    <div class="td-tip"><span class="td-tip-ic">💡</span><span class="td-tip-msg"><b>Mẹo hôm nay:</b> <span id="td-tip-text">${escHtml(tipOfDay())}</span></span><button id="td-tip-next" class="td-tip-next" title="Xem mẹo khác">🔄</button></div>

    <h2 class="td-h2">📋 Buổi ôn hôm nay</h2>
    <div class="td-tasks">
      ${tasks.map(t => `<button class="td-task" id="${t.id}">
        <span class="td-ic">${t.ic}</span>
        <span class="td-task-txt"><b>${escHtml(t.t)}</b><small>${escHtml(t.s)}</small></span>
        <span class="td-go">▶</span>
      </button>`).join('')}
    </div>

    <h2 class="td-h2">🏅 Huy hiệu thành tích${fresh.length ? ` <span class="td-new">+${fresh.length} mới!</span>` : ''}</h2>
    <div class="td-badges">
      ${badges.map(b => `<div class="td-badge ${b.earned ? 'earned' : 'locked'} ${fresh.includes(b.id) ? 'fresh' : ''}" title="${escHtml(b.hint)}">
        <span class="tb-ic">${b.earned ? b.icon : '🔒'}</span>
        <span class="tb-name">${escHtml(b.name)}</span>
        ${fresh.includes(b.id) ? '<span class="tb-new">MỚI</span>' : ''}
      </div>`).join('')}
    </div>`;

  document.getElementById('td-goal-sel').onchange = (e) => {
    const newGoal = +e.target.value;
    store.set('prep-daily-goal', newGoal);
    // Đổi mục tiêu chỉ ảnh hưởng vòng ring + nhãn — thay tại chỗ, khỏi dựng lại cả tab
    // (renderToday đầy đủ sẽ await loadDeck + computeBadges 37 huy hiệu mỗi lần đổi select)
    const newPct = newGoal ? Math.min(100, Math.round(todayN / newGoal * 100)) : 0;
    document.querySelector('.td-ring-wrap').innerHTML =
      `${goalRing(newPct)}<span class="td-ring-label"><b>${todayN}</b><small>/ ${newGoal}</small></span>`;
  };
  tasks.forEach(t => document.getElementById(t.id)?.addEventListener('click', t.go));
  body.querySelectorAll('.td-sprint-row').forEach(b =>
    b.addEventListener('click', () => switchView(b.dataset.view)));

  // Đếm ngược ngày phỏng vấn: đặt / xoá
  document.getElementById('td-cd-save')?.addEventListener('click', () => {
    const v = document.getElementById('td-cd-input')?.value;
    if (v) { store.set('prep-interview-date', v); renderToday(); }
  });
  document.getElementById('td-cd-clear')?.addEventListener('click', () => {
    store.set('prep-interview-date', ''); renderToday();
  });

  // Nút 🔄 xoay qua mẹo kế tiếp (đọc hết kho mẹo, không chỉ mẹo của hôm nay)
  tipIdx = todayTipIdx();
  document.getElementById('td-tip-next')?.addEventListener('click', () => {
    tipIdx = (tipIdx + 1) % STUDY_TIPS.length;
    document.getElementById('td-tip-text').textContent = STUDY_TIPS[tipIdx];
  });
}

// Bộ điều hướng dùng chung cho tab Hôm nay (mở tab tương ứng + đặt sẵn bộ lọc).
function goToFlash(filter) {
  switchView('flashcards');
  loadDeck().then(() => { // chờ deck sẵn sàng (initFlashcards lần 2 trả về sớm vì fcLoaded đã true)
    fillFcWeekSelect();
    const sel = document.getElementById('fc-week');
    if (sel) { sel.value = filter; sel.dispatchEvent(new Event('change')); }
  });
}
function goToVocabTest() {
  switchView('flashcards');
  loadDeck().then(() => { fillFcWeekSelect(); ftStart(); }); // mở thẳng màn Test gõ
}
async function goToWritingMix() {
  switchView('writing');
  await initWriting();
  await Promise.all([loadDeck(), loadSentences()]);
  document.querySelector('.wr-mode[data-mode="mix"]')?.click();
}
function goToMockWrong() {
  switchView('mock');
  loadMockPool().then(() => { // chờ pool THẬT SỰ sẵn sàng (initMock lần 2 trả về sớm vì mkInit đã true)
    fillMockWeekSelect();
    const sel = document.getElementById('mk-week');
    if (sel) sel.value = '__wrong__';
  });
}

/** Mở tab Tư duy ở chế độ 🔁 Ôn câu sai và bắt đầu phiên ngay. */
function goToQuizReview() {
  switchView('coding');
  setThinkMode('review');
  startReview();
}

function goToExam() {
  switchView('coding');
  if (viewGated('coding') && !fbUser) return; // gate đang hiện — đừng đổi mode sau lưng nó
  setThinkMode('exam');
}

function goToPinnedReview() {
  switchView('coding');
  setThinkMode('review');
  startPinned();
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
  fcLoaded = true; // đặt ĐỒNG BỘ ngay để chặn double-bind khi initFlashcards() bị gọi 2 lần cùng tick (switchView + shortcut)
  const deck = await loadDeck();
  if (!deck.length) {
    fcLoaded = false; // tải hỏng → cho phép thử lại lần sau
    document.querySelector('.fc-front').innerHTML = '<p>Không tải được file từ vựng 😕</p>';
    return;
  }

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
  document.getElementById('fc-test-btn').addEventListener('click', ftStart);
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
  cards = shuffleArr(cards).sort((a, b) => (srs[a.id]?.box || 0) - (srs[b.id]?.box || 0));
  fcQueue = cards;
  fcIndex = 0;
  showCard();
}

// ===== 📝 Test gõ từ: hiện nghĩa tiếng Việt → gõ tiếng Anh, Enter sang câu kế, cuối bài chấm + chọn SRS =====
let ftQueue = [], ftIdx = 0;
let ftSize = store.get('prep-ft-size', 20); // số từ mỗi lượt (0 = tất cả)
const ftNorm = s => (s || '').toLowerCase().normalize('NFC')
  .replace(/\(.*?\)/g, ' ')                    // bỏ chú thích trong ngoặc
  .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')         // bỏ ký tự đặc biệt, giữ chữ/số/'/-
  .replace(/\s+/g, ' ').trim();

/** Ẩn UI flashcard lật thường khi đang test (on=true), hiện lại khi xong. */
function ftToggle(on) {
  const card = document.getElementById('fc-card'); if (card) card.hidden = on;
  const prog = document.getElementById('fc-progress'); if (prog) prog.hidden = on;
  document.querySelectorAll('#view-flashcards .fc-hint, #view-flashcards .fc-actions')
    .forEach(e => { e.hidden = on; });
  const t = document.getElementById('fc-test'); if (t) t.hidden = !on;
}

/** Màn bắt đầu: chọn số từ + xem phạm vi (theo bộ lọc #fc-week hiện tại). */
function ftStart() {
  ftToggle(true);
  const sel = document.getElementById('fc-week');
  const pool = filterDeck(sel.value);
  const scope = sel.selectedOptions[0]?.textContent || 'Tất cả';
  const sizeBtn = n => `<button class="ft-size${ftSize === n ? ' active' : ''}" data-n="${n}">${n === 0 ? 'Tất cả' : n}</button>`;
  document.getElementById('fc-test').innerHTML = `
    <div class="ft-start">
      <h2>📝 Test gõ từ</h2>
      <p>Hiện <b>nghĩa tiếng Việt</b> — bạn gõ <b>từ tiếng Anh</b> rồi <kbd>Enter</kbd> sang câu kế. Cuối bài chấm điểm và bạn chọn từng từ <b>học tiếp</b> hay <b>thuộc rồi</b>.</p>
      <p class="ft-scope">Phạm vi (đổi ở ô chọn phía trên): <b>${escHtml(scope)}</b> — <b>${pool.length}</b> từ. Số từ mỗi lượt:</p>
      <div class="ft-sizes">${[10, 20, 0].map(sizeBtn).join('')}</div>
      <button id="ft-go" class="dg-go"${pool.length ? '' : ' disabled'}>▶ Bắt đầu</button>
      <button id="ft-cancel" class="dg-link">← Quay lại lật thẻ</button>
    </div>`;
  document.querySelectorAll('.ft-size').forEach(b => b.onclick = () => { ftSize = +b.dataset.n; store.set('prep-ft-size', ftSize); ftStart(); });
  document.getElementById('ft-go').onclick = ftBegin;
  document.getElementById('ft-cancel').onclick = () => ftToggle(false);
}

function ftBegin() {
  let pool = filterDeck(document.getElementById('fc-week').value).filter(c => c.front && c.meaning);
  pool = shuffleArr(pool);
  if (ftSize > 0) pool = pool.slice(0, ftSize);
  ftQueue = pool.map(c => ({ card: c, answer: '', correct: false }));
  ftIdx = 0;
  if (!ftQueue.length) { ftToggle(false); return; }
  ftShow();
}

function ftShow() {
  const it = ftQueue[ftIdx];
  if (!it) return ftFinish();
  const c = it.card;
  document.getElementById('fc-test').innerHTML = `
    <div class="ft-sess">
      <div class="ft-bar"><span>Câu ${ftIdx + 1}/${ftQueue.length}</span><span class="ft-topic">${escHtml(c.week)}</span></div>
      <div class="ft-mean">${escHtml(c.meaning)}</div>
      <input id="ft-input" class="ft-input" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="Gõ từ tiếng Anh rồi Enter…" />
      <div class="ft-actions"><button id="ft-next" class="dg-go">${ftIdx + 1 < ftQueue.length ? 'Câu kế →' : 'Xem kết quả ✓'}</button><button id="ft-quit" class="dg-link">Dừng</button></div>
      <p class="ft-tip">↵ <kbd>Enter</kbd> để sang câu kế · đáp án ẩn tới cuối bài</p>
    </div>`;
  const inp = document.getElementById('ft-input');
  inp.value = it.answer;
  inp.focus();
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ftSubmit(); } });
  document.getElementById('ft-next').onclick = ftSubmit;
  document.getElementById('ft-quit').onclick = () => { if (confirm('Dừng bài test? Tiến độ lượt này sẽ bỏ.')) ftToggle(false); };
}

function ftSubmit() {
  const it = ftQueue[ftIdx];
  it.answer = (document.getElementById('ft-input').value || '').trim();
  it.correct = it.answer !== '' && ftNorm(it.answer) === ftNorm(it.card.front);
  ftIdx++;
  ftShow();
}

function ftFinish() {
  const right = ftQueue.filter(x => x.correct).length, n = ftQueue.length;
  const pct = n ? Math.round(right / n * 100) : 0;
  logActivity();
  const rows = ftQueue.map((x, i) => `
    <li class="ft-row ${x.correct ? 'ft-ok' : 'ft-no'}">
      <div class="ft-row-top">
        <span class="ft-verd">${x.correct ? '✅' : '❌'}</span>
        <span class="ft-word"><b>${escHtml(x.card.front)}</b> — ${escHtml(x.card.meaning)}</span>
        <button class="ep-say ft-say" data-i="${i}" title="Nghe phát âm" aria-label="Nghe phát âm">🔊</button>
      </div>
      ${x.correct ? '' : `<div class="ft-yours">Bạn gõ: <i>${escHtml(x.answer || '(bỏ trống)')}</i></div>`}
      <div class="ft-srs">
        <button class="ft-learn" data-i="${i}">📚 Học tiếp</button>
        <button class="ft-known" data-i="${i}">✅ Thuộc rồi</button>
      </div>
    </li>`).join('');
  const el = document.getElementById('fc-test');
  el.innerHTML = `
    <div class="ft-result">
      <h2>${pct >= 80 ? '🌟' : pct >= 50 ? '👍' : '📚'} Đúng ${right}/${n} (${pct}%)</h2>
      <p>Chọn cho từng từ: <b>📚 Học tiếp</b> (đưa về ôn lại sớm) hay <b>✅ Thuộc rồi</b> (giãn lịch ôn).</p>
      <ul class="ft-list">${rows}</ul>
      <div class="ft-end"><button id="ft-again" class="dg-go">↻ Test lượt mới</button><button id="ft-done" class="dg-link">← Về lật thẻ</button></div>
    </div>`;
  el.querySelectorAll('.ft-learn').forEach(b => b.onclick = () => { bumpSrs(ftQueue[+b.dataset.i].card, false); ftMarkRow(b, 'học tiếp'); });
  el.querySelectorAll('.ft-known').forEach(b => b.onclick = () => { bumpSrs(ftQueue[+b.dataset.i].card, true); ftMarkRow(b, 'thuộc rồi'); });
  el.querySelectorAll('.ft-say').forEach(b => b.onclick = () => {
    const c = ftQueue[+b.dataset.i].card;
    // Sanitize như speakCard: bỏ ⚠️/ngoặc ở từ, bỏ backtick + chú thích "— ⚠️…" tiếng Việt ở ví dụ
    const ex = (c.example || '').replace(/[`*]/g, '').replace(/—.*$/, '').trim();
    speak(ex ? `${cleanTarget(c.front)}. ${ex}` : cleanTarget(c.front));
  });
  document.getElementById('ft-again').onclick = ftStart;
  document.getElementById('ft-done').onclick = () => { ftToggle(false); fillFcWeekSelect(); startSession(); };
}

function ftMarkRow(btn, label) {
  btn.closest('.ft-row').querySelector('.ft-srs').innerHTML = `<span class="ft-chosen">✔ Đã đánh dấu: ${label}</span>`;
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
    if (onboardOpen() || shortcutsOpen()) return; // hộp thoại đang mở → nhường phím
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
  if (text) speakList([text]);
}

/** Đọc lần lượt nhiều câu tiếng Anh: cancel một lần rồi xếp hàng utterance. */
function speakList(texts) {
  if (!('speechSynthesis' in window) || !texts.length) return;
  speechSynthesis.cancel();
  const voice = speechSynthesis.getVoices().find(v => v.lang && v.lang.startsWith('en'));
  for (const t of texts) {
    const u = new SpeechSynthesisUtterance(t);
    u.lang = 'en-US';
    u.rate = 0.92;
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  }
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

// ---------- 🎙️ Nói để điền (dictation vào ô trả lời) ----------
// Đối xứng với speak(): TTS đọc cho nghe, phần này nghe user NÓI và điền vào textarea.
// Khác 🎤 Đọc to (wrRecog — 1 câu tiếng Anh, chấm phát âm): đây là đọc chính tả
// liên tục để soạn câu trả lời dài (Mock, STAR), chọn được VI/EN.
let dictState = null; // { rec, btn, label } — chỉ 1 phiên nghe tại một thời điểm

const dictLang = () => store.get('prep-dict-lang', 'vi-VN');
const dictationSupported = () => !!(window.SpeechRecognition || window.webkitSpeechRecognition);

function stopDictation() {
  if (!dictState) return;
  const { rec, btn, label } = dictState;
  dictState = null;
  rec.onresult = rec.onerror = rec.onend = null;
  try { rec.abort(); } catch { /* đã dừng sẵn */ }
  btn.classList.remove('dict-on');
  btn.setAttribute('aria-pressed', 'false');
  btn.textContent = label;
}

/** Gắn nút 🎙️ nói-để-điền cho 1 textarea. Trả false + ẩn nút nếu trình duyệt không hỗ trợ. */
function bindDictation(btn, ta) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR || !btn || !ta) { if (btn) btn.hidden = true; return false; }
  btn.hidden = false;
  btn.setAttribute('aria-pressed', 'false');
  const label = btn.textContent;
  btn.onclick = () => {
    if (dictState && dictState.btn === btn) return stopDictation(); // đang nghe ô này → dừng
    stopDictation(); // đang nghe ô khác → chuyển micro sang ô này
    const rec = new SR();
    rec.lang = dictLang();
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = e => {
      let text = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) text += e.results[i][0].transcript;
      }
      text = text.trim();
      if (!text) return;
      ta.value = (ta.value.trim() ? ta.value.replace(/\s+$/, '') + ' ' : '') + text;
      ta.dispatchEvent(new Event('input', { bubbles: true })); // STAR autosave lắng nghe 'input'
    };
    rec.onerror = ev => {
      stopDictation();
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed')
        alert('Trình duyệt đang chặn micro — cấp quyền micro cho trang này rồi bấm 🎙️ lại nhé.');
    };
    rec.onend = () => stopDictation(); // trình duyệt tự ngắt (im lặng lâu) → trả nút về bình thường
    try { rec.start(); } catch { toast('🎙️ Micro đang bận — đợi 1 giây rồi bấm lại nhé'); return; } // start() ném nếu phiên cũ chưa nhả
    dictState = { rec, btn, label };
    btn.classList.add('dict-on');
    btn.setAttribute('aria-pressed', 'true');
    btn.textContent = btn.dataset.rec || '🔴 Đang nghe… (bấm để dừng)'; // nút nhỏ (STAR) tự khai nhãn ngắn qua data-rec
  };
  return true;
}

/** Nút 🇻🇳/🇬🇧 cạnh nút 🎙️ — đổi ngôn ngữ nhận giọng nói, lưu prep-dict-lang. */
function bindDictLang(btn, supported) {
  if (!btn) return;
  btn.hidden = !supported;
  if (!supported) return;
  const paint = () => { btn.textContent = dictLang() === 'vi-VN' ? '🇻🇳 VI' : '🇬🇧 EN'; };
  btn.onclick = () => {
    store.set('prep-dict-lang', dictLang() === 'vi-VN' ? 'en-US' : 'vi-VN');
    stopDictation(); // phiên đang chạy vẫn dùng lang cũ — dừng để lần bấm sau nhận lang mới
    paint();
  };
  paint();
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

const escHtml = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
    cards = shuffleArr(cards).sort((a, b) => (srs[a.id]?.box || 0) - (srs[b.id]?.box || 0));
    return cards.map(wrWordItem).filter(Boolean);
  }

  if (wrMode === 'cloze') {
    const items = filterDeck(week).map(wrClozeItem).filter(Boolean);
    return shuffleArr(items).sort((a, b) => (srs[a.card.id]?.box || 0) - (srs[b.card.id]?.box || 0));
  }

  // mix: phiên ôn nhanh ~10 câu — 5 từ (ưu tiên đến hạn) + 3 cloze + 2 câu nói
  if (wrMode === 'mix') {
    const due = filterDeck('__due__');
    const pool = due.length >= 8
      ? [...due]
      : [...due, ...filterDeck('').filter(c => !due.includes(c))];
    const ordered = shuffleArr(pool).sort((a, b) => (srs[a.id]?.box || 0) - (srs[b.id]?.box || 0));
    const words = ordered.slice(0, 5).map(wrWordItem).filter(Boolean);
    const cloze = ordered.slice(5).map(wrClozeItem).filter(Boolean).slice(0, 3);
    const sents = shuffleArr(WR_SENTENCES.pairs).slice(0, 2).map(p => ({
      type: 'sentence',
      prompt: `<div class="wr-label">📝 Dịch sang tiếng Anh (bấm 🔊 để nghe):</div><div class="wr-vi">${escHtml(p.vi)}</div><div class="wr-sub">${escHtml(p.week)}</div>`,
      answer: p.en,
      say: p.en,
      hint1: maskWords(p.en),
    }));
    return shuffleArr([...words, ...cloze, ...sents]);
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
    return shuffleArr(items);
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
    return shuffleArr(items);
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
  return shuffleArr(items);
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

let mockPoolPromise = null;
async function loadMockPool() {
  if (MK_POOL) return MK_POOL;
  if (mockPoolPromise) return mockPoolPromise; // gộp các lời gọi đồng thời → tải 1 lần
  mockPoolPromise = doLoadMockPool();
  return mockPoolPromise;
}
async function doLoadMockPool() {
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
  document.getElementById('mk-aigrade').addEventListener('click', mkAiGrade);
  const dictOk = bindDictation(document.getElementById('mk-dict'), document.getElementById('mk-uans'));
  bindDictLang(document.getElementById('mk-dict-lang'), dictOk);
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
  mkQueue = shuffleArr(pool).slice(0, count);
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
  // reset khu AI chấm cho câu mới
  stopDictation(); // đang đọc dở câu trước mà sang câu mới thì tắt micro — tránh điền nhầm
  bindDictLang(document.getElementById('mk-dict-lang'), dictationSupported()); // repaint cờ VI/EN — STAR/Design có thể đã đổi prep-dict-lang dùng chung
  const ua = document.getElementById('mk-uans'); if (ua) ua.value = '';
  const aout = document.getElementById('mk-aiout'); if (aout) { aout.hidden = true; aout.textContent = ''; }
  const akey = document.getElementById('mk-aikey'); if (akey && !akey.value) akey.value = store.get('prep-ai-key', '');
  const ag = document.getElementById('mk-aigrade'); if (ag) { ag.disabled = false; ag.textContent = 'Chấm câu này'; } // tránh kẹt "Đang chấm…" nếu đổi câu giữa lúc stream
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
  stopDictation(); // câu cuối/⏹ Dừng: session sắp ẩn — không để micro chạy ngầm vô hình
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
let aiSessionId = 0; // tăng mỗi khi bắt đầu/thoát phiên — chống stream cũ ghi vào phiên mới
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
    stopDictation(); // đổi chế độ Tự chấm ↔ Phỏng vấn AI: khu đang nghe sắp ẩn (mic ẩn sẽ chép cả TTS của AI)
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
  aiBusy = false;        // phòng khi phiên trước thoát giữa stream
  aiSessionId++;         // đánh dấu phiên mới → stream cũ (nếu còn) sẽ bị bỏ qua
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
  const sid = aiSessionId; // chụp phiên hiện tại
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
      onText: t => { if (sid === aiSessionId) { streamEl.textContent = t; scrollAiChat(); } },
    });
    if (sid !== aiSessionId) return; // đã thoát/bắt đầu phiên khác giữa chừng → bỏ kết quả cũ
    aiMessages.push({ role: 'assistant', content: full });
    // render markdown + đọc to
    streamEl.innerHTML = window.marked ? marked.parse(full) : escHtml(full);
    if (window.hljs) streamEl.querySelectorAll('pre code').forEach(el => { try { hljs.highlightElement(el); } catch {} });
    scrollAiChat();
    aiSpeak(full);
    logActivity();
    if (aiFinished) saveAiEvaluation(full);
  } catch (err) {
    if (sid === aiSessionId) streamEl.innerHTML = `<span class="ai-err">⚠️ ${escHtml(err.message)}</span>`;
  } finally {
    if (sid === aiSessionId) { // chỉ dọn dẹp nếu vẫn đúng phiên (tránh reset aiBusy của phiên mới)
      aiBusy = false;
      setAiInputDisabled(false);
      if (!aiFinished) document.getElementById('ai-answer').focus();
    }
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
  aiBusy = false; // thoát giữa lúc stream → mở khoá để Bắt đầu lại không bị aiTurn return sớm
  aiSessionId++;  // vô hiệu hoá stream đang dang dở (nếu có)
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
// ======================================================================
// 🏛️ SYSTEM DESIGN DRILL — luyện trả lời bài thiết kế theo khung 5 bước,
// tự chấm theo rubric, hoặc nhờ Claude chấm (BYOK, tái dùng callClaudeStream).
// ======================================================================
const DG_MINUTES = 35;            // thời lượng khuyến nghị mỗi bài
let dgTimerId = null;             // đồng hồ đếm ngược
let dgState = null;               // { drill, endAt, remain, started }
const dgDrills = () => window.DESIGN_DRILLS || [];

function dgHistory() { return store.get('prep-design-history', []); }
function dgBestCoverage(id) {
  const hs = dgHistory().filter(h => h.id === id && typeof h.coverage === 'number');
  return hs.length ? Math.max(...hs.map(h => h.coverage)) : null;
}
function dgDraft(id, val) {
  const all = store.get('prep-design-draft', {});
  if (val === undefined) return all[id] || '';
  all[id] = val; store.set('prep-design-draft', all);
}

/** Màn chính: đang làm bài thì hiện phiên, không thì hiện danh sách. */
function renderDesign() {
  if (dgState) renderDgSession(); else renderDgList();
}

function renderDgList() {
  if (dgTimerId) { clearInterval(dgTimerId); dgTimerId = null; }
  const drills = dgDrills();
  const el = document.getElementById('design-body');
  if (!drills.length) { el.innerHTML = '<p>Chưa nạp được ngân hàng đề thiết kế.</p>'; return; }
  const diffOrder = { 'Dễ': 0, 'TB': 1, 'Khó': 2 };
  const sel = renderDgList._diff || 'all';
  const list = drills
    .filter(d => sel === 'all' || d.difficulty === sel)
    .sort((a, b) => (diffOrder[a.difficulty] - diffOrder[b.difficulty]));
  const filterBtn = (val, label) =>
    `<button class="dg-fbtn${sel === val ? ' active' : ''}" data-diff="${val}">${label}</button>`;
  const done = new Set(dgHistory().map(h => h.id));
  const cards = list.map(d => {
    const best = dgBestCoverage(d.id);
    const badge = done.has(d.id) ? `<span class="dg-done">✓ đã làm${best != null ? ` · tốt nhất ${best}%` : ''}</span>` : '';
    return `<button class="dg-card" data-id="${d.id}">
      <div class="dg-card-top"><span class="dg-diff dg-diff-${diffOrder[d.difficulty]}">${d.difficulty}</span>${badge}</div>
      <h3>${escHtml(d.title)}</h3>
      <div class="dg-company">${escHtml(d.company)}</div>
      <p class="dg-scen">${escHtml(d.scenario)}</p>
    </button>`;
  }).join('');
  const hist = dgHistory().slice(-6).reverse().map(h => {
    const d = drills.find(x => x.id === h.id);
    const score = h.mode === 'ai'
      ? (typeof h.aiScore === 'number' ? `🤖 ${h.aiScore}/100` : '🤖 —')
      : `📋 ${h.coverage}%`;
    return `<li><b>${escHtml(d ? d.title : h.id)}</b> — ${score} · ⏱ ${fmtMMSS(h.timeSec || 0)} · ${escHtml(h.date || '')}</li>`;
  }).join('');
  el.innerHTML = `
    <h1>🏛️ Luyện thiết kế hệ thống</h1>
    <p class="dg-intro">Chọn một đề, bấm <b>Bắt đầu</b> để chạy đồng hồ ${DG_MINUTES} phút, rồi viết lời giải theo <b>khung 5 bước</b> (làm rõ yêu cầu → ước lượng → API → data model → high-level → đào sâu → trade-offs). Xong thì <b>tự chấm theo rubric</b> hoặc nhờ <b>Claude chấm</b> (cần API key của bạn).</p>
    <div class="dg-filters">
      ${filterBtn('all', 'Tất cả')}${filterBtn('Dễ', 'Dễ')}${filterBtn('TB', 'Trung bình')}${filterBtn('Khó', 'Khó')}
      <button id="dg-random" class="dg-fbtn dg-random" title="Ưu tiên đề chưa làm trong bộ lọc hiện tại">🎲 Bốc đề ngẫu nhiên</button>
    </div>
    <div class="dg-grid">${cards}</div>
    ${hist ? `<div class="dg-hist"><h2>🕒 Lần luyện gần đây</h2><ul>${hist}</ul></div>` : ''}`;
  el.querySelectorAll('.dg-fbtn[data-diff]').forEach(b => b.onclick = () => { renderDgList._diff = b.dataset.diff; renderDgList(); });
  el.querySelectorAll('.dg-card').forEach(b => b.onclick = () => openDrill(b.dataset.id));
  // 🎲 Bốc ngẫu nhiên trong bộ lọc hiện tại, ưu tiên đề CHƯA làm cho phủ hết bank
  document.getElementById('dg-random').onclick = () => {
    const pool = list.filter(d => !done.has(d.id));
    const from = pool.length ? pool : list;
    if (from.length) openDrill(from[Math.floor(Math.random() * from.length)].id);
  };
}

function openDrill(id) {
  const drill = dgDrills().find(d => d.id === id);
  if (!drill) return;
  dgState = { drill, remain: DG_MINUTES * 60, started: false, endAt: 0 };
  renderDgSession();
}

function renderDgSession() {
  const { drill } = dgState;
  const el = document.getElementById('design-body');
  const focus = drill.focus.map(f => `<li>${escHtml(f)}</li>`).join('');
  const rubric = drill.rubric.map(r =>
    `<label class="dg-crit"><input type="checkbox" class="dg-ck" data-k="${r.k}" data-w="${r.w}">
       <span class="dg-crit-main">${escHtml(r.label)}</span>
       <span class="dg-crit-hint">💡 ${escHtml(r.hint)}</span></label>`).join('');
  el.innerHTML = `
    <div class="dg-sess">
      <div class="dg-bar">
        <button id="dg-back" class="dg-link">← Danh sách</button>
        <span class="dg-diff dg-diff-${{ 'Dễ': 0, 'TB': 1, 'Khó': 2 }[drill.difficulty]}">${drill.difficulty}</span>
        <span id="dg-timer" class="dg-timer">${fmtMMSS(dgState.remain)}</span>
        <button id="dg-start" class="dg-go">▶ Bắt đầu</button>
      </div>
      <h1>${escHtml(drill.title)}</h1>
      <div class="dg-scenario"><b>📋 Đề bài:</b> ${escHtml(drill.scenario)}</div>
      <details class="dg-focus" open><summary>🧭 Gợi ý cần làm rõ / trọng tâm</summary><ul>${focus}</ul></details>

      <h2>✍️ Lời giải của bạn</h2>
      <p class="dg-tip">Viết theo khung: <b>1)</b> Làm rõ yêu cầu · <b>2)</b> Ước lượng · <b>3)</b> API · <b>4)</b> Data model · <b>5)</b> High-level · <b>6)</b> Đào sâu bottleneck · <b>7)</b> Trade-offs.</p>
      <div class="dict-row">
        <button id="dg-dict" class="dict-btn" type="button" hidden>🎙️ Nói để điền</button>
        <button id="dg-dict-lang" class="dict-lang" type="button" title="Ngôn ngữ nói-để-điền" hidden></button>
      </div>
      <textarea id="dg-answer" class="dg-answer" placeholder="Gõ dàn ý / lời giải của bạn ở đây… (tự lưu nháp)"></textarea>

      <h2>📋 Tự chấm theo rubric</h2>
      <p class="dg-tip">Tick những phần bạn đã trình bày được. Điểm = tổng trọng số phần đã tick.</p>
      <div class="dg-rubric">${rubric}</div>
      <div class="dg-actions">
        <button id="dg-score" class="dg-go">✅ Chấm rubric &amp; lưu</button>
        <button id="dg-ai-toggle" class="dg-go dg-go-ai">🤖 Nhờ Claude chấm</button>
        <button id="dg-ref" class="dg-link">👁 Xem gợi ý đáp án</button>
      </div>
      <div id="dg-result" class="dg-result" hidden></div>
      <div id="dg-ref-box" class="dg-ref-box" hidden></div>
      <div id="dg-ai" class="dg-ai" hidden></div>
    </div>`;

  // nạp nháp đã lưu
  const ta = document.getElementById('dg-answer');
  ta.value = dgDraft(drill.id);
  let saveT;
  ta.addEventListener('input', () => { clearTimeout(saveT); saveT = setTimeout(() => dgDraft(drill.id, ta.value), 500); });
  // 🎙️ nói-để-điền dàn ý — transcript bắn 'input' nên nháp tự lưu như gõ tay
  bindDictLang(document.getElementById('dg-dict-lang'),
    bindDictation(document.getElementById('dg-dict'), ta));

  document.getElementById('dg-back').onclick = () => {
    if (dgTimerId) { clearInterval(dgTimerId); dgTimerId = null; }
    stopDictation(); // ô dàn ý sắp rời DOM
    dgDraft(drill.id, ta.value);
    dgState = null; renderDgList();
  };
  document.getElementById('dg-start').onclick = dgStartTimer;
  document.getElementById('dg-score').onclick = dgScoreRubric;
  document.getElementById('dg-ref').onclick = dgShowRef;
  document.getElementById('dg-ai-toggle').onclick = dgRenderAiPanel;

  // Nếu đã bấm Bắt đầu trước đó rồi rời tab và quay lại: tiếp tục đồng hồ
  // (switchView đã clear interval; dgState.started vẫn true → nút bị chặn, cần khôi phục).
  if (dgState.started) {
    const sb = document.getElementById('dg-start');
    if (sb) { sb.textContent = '⏳ Đang chạy'; sb.disabled = true; }
    if (dgState.remain > 0) {
      dgState.endAt = Date.now() + dgState.remain * 1000;
      if (dgTimerId) clearInterval(dgTimerId);
      dgTick();
      dgTimerId = setInterval(dgTick, 1000);
    } else {
      const t = document.getElementById('dg-timer');
      if (t) { t.textContent = 'Hết giờ ⏰'; t.classList.add('dg-timeup'); }
    }
  }
}

function dgStartTimer() {
  if (dgState.started) return;
  dgState.started = true;
  dgState.endAt = Date.now() + dgState.remain * 1000;
  const btn = document.getElementById('dg-start');
  if (btn) { btn.textContent = '⏳ Đang chạy'; btn.disabled = true; }
  dgTick();
  dgTimerId = setInterval(dgTick, 1000);
}
function dgTick() {
  if (!dgState) return;
  const left = Math.round((dgState.endAt - Date.now()) / 1000);
  dgState.remain = left;
  const el = document.getElementById('dg-timer');
  if (!el) return;
  if (left <= 0) {
    el.textContent = 'Hết giờ ⏰';
    el.classList.add('dg-timeup');
    clearInterval(dgTimerId); dgTimerId = null;
  } else {
    el.textContent = fmtMMSS(left);
    el.classList.toggle('dg-warn', left <= 5 * 60);
  }
}
function dgElapsedSec() {
  return dgState.started ? Math.max(0, DG_MINUTES * 60 - Math.max(0, dgState.remain)) : 0;
}

function dgScoreRubric() {
  const { drill } = dgState;
  const cks = [...document.querySelectorAll('.dg-ck')];
  const totalW = drill.rubric.reduce((s, r) => s + r.w, 0);
  const gotW = cks.filter(c => c.checked).reduce((s, c) => s + (+c.dataset.w || 0), 0);
  const coverage = Math.round((gotW / totalW) * 100);
  const missing = drill.rubric.filter(r => !cks.find(c => c.dataset.k === r.k && c.checked));
  const timeSec = dgElapsedSec();
  // lưu lịch sử
  const hist = dgHistory();
  hist.push({ id: drill.id, date: new Date().toISOString().slice(0, 10), ts: Date.now(), coverage, timeSec, mode: 'self' });
  store.set('prep-design-history', hist.slice(-100));
  logActivity();
  const band = coverage >= 85 ? ['🌟 Xuất sắc', '#3fb950'] : coverage >= 65 ? ['👍 Khá', '#58a6ff'] : coverage >= 45 ? ['🟡 Tạm được', '#d29922'] : ['🔴 Cần luyện thêm', '#f85149'];
  const box = document.getElementById('dg-result');
  box.hidden = false;
  box.innerHTML = `
    <div class="dg-score-ring" style="--c:${band[1]};--p:${coverage}">
      <div class="dg-score-num">${coverage}%</div>
    </div>
    <div class="dg-score-side">
      <div class="dg-band" style="color:${band[1]}">${band[0]}</div>
      <div class="dg-score-meta">⏱ ${fmtMMSS(timeSec)} · đã tick ${cks.filter(c => c.checked).length}/${drill.rubric.length} tiêu chí</div>
      ${missing.length ? `<div class="dg-miss"><b>Còn thiếu / nên bổ sung:</b><ul>${missing.map(m => `<li>${escHtml(m.label)}</li>`).join('')}</ul></div>` : '<div class="dg-miss">Bạn đã phủ hết rubric. Thử nhờ Claude chấm để soi sâu hơn 👇</div>'}
    </div>`;
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function dgShowRef() {
  const { drill } = dgState;
  const box = document.getElementById('dg-ref-box');
  if (!box.hidden) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = `<h3>👁 Gợi ý các điểm chính (đối chiếu sau khi tự làm)</h3>
    <ul>${drill.keyPoints.map(k => `<li>${escHtml(k)}</li>`).join('')}</ul>`;
}

// ---------- AI chấm (BYOK, tái dùng callClaudeStream) ----------
function dgRenderAiPanel() {
  const box = document.getElementById('dg-ai');
  if (!box.hidden) { box.hidden = true; return; }
  box.hidden = false;
  const savedKey = store.get('prep-ai-key', '');
  const model = (typeof aiCfg !== 'undefined' && aiCfg.model) || 'claude-opus-4-8';
  const opt = (v, l) => `<option value="${v}"${model === v ? ' selected' : ''}>${l}</option>`;
  box.innerHTML = `
    <h3>🤖 Nhờ Claude chấm lời giải</h3>
    <p class="dg-tip">Claude sẽ chấm theo rubric của đề, cho điểm từng tiêu chí + nhận xét + gợi ý cải thiện. Cần API key Anthropic của bạn (lưu cục bộ, không gửi đi đâu khác).</p>
    <div class="dg-ai-cfg">
      <input id="dg-key" type="password" placeholder="sk-ant-..." value="${escHtml(savedKey)}" autocomplete="off">
      <select id="dg-model">
        ${opt('claude-opus-4-8', 'Opus 4.8 (sâu nhất)')}
        ${opt('claude-sonnet-4-6', 'Sonnet 4.6 (cân bằng)')}
        ${opt('claude-haiku-4-5-20251001', 'Haiku 4.5 (rẻ/nhanh)')}
      </select>
      <button id="dg-ai-go" class="dg-go dg-go-ai">Chấm ngay</button>
    </div>
    <div id="dg-ai-out" class="dg-ai-out" hidden></div>`;
  document.getElementById('dg-ai-go').onclick = dgAiGrade;
}

async function dgAiGrade() {
  const { drill } = dgState;
  const key = document.getElementById('dg-key').value.trim();
  const model = document.getElementById('dg-model').value;
  const answer = document.getElementById('dg-answer').value.trim();
  if (!key) { alert('Hãy dán API key Anthropic của bạn.'); document.getElementById('dg-key').focus(); return; }
  if (answer.length < 30) { alert('Hãy viết lời giải dài hơn một chút trước khi nhờ chấm.'); return; }
  store.set('prep-ai-key', key); // dùng chung với Mock AI
  const btn = document.getElementById('dg-ai-go');
  btn.disabled = true; btn.textContent = '⏳ Đang chấm…';
  const out = document.getElementById('dg-ai-out');
  out.hidden = false; out.textContent = '…';

  const rubricList = drill.rubric.map((r, i) => `${i + 1}. [${r.k}] ${r.label} (trọng số ${r.w})`).join('\n');
  const keyList = drill.keyPoints.map((k, i) => `- ${k}`).join('\n');
  const system = `Bạn là interviewer kỹ thuật cấp cao đang chấm phần System Design của ứng viên Backend. Chấm NGHIÊM nhưng công bằng, mang tính xây dựng. Trả lời bằng TIẾNG VIỆT, thuật ngữ giữ tiếng Anh. Không markdown nặng (không bảng).`;
  const user = `ĐỀ BÀI: ${drill.title}
${drill.scenario}

RUBRIC (các tiêu chí cần chấm):
${rubricList}

CÁC ĐIỂM CHÍNH MONG ĐỢI (để bạn tham chiếu, ứng viên không nhất thiết phải khớp y hệt):
${keyList}

LỜI GIẢI CỦA ỨNG VIÊN:
"""
${answer}
"""

Hãy chấm như sau:
1. Với TỪNG tiêu chí trong rubric: cho điểm 0/1/2 (0=thiếu, 1=có nhắc nhưng sơ sài, 2=trình bày tốt) kèm 1 câu nhận xét ngắn.
2. Nêu 2-3 điểm MẠNH và 2-3 điểm cần CẢI THIỆN cụ thể (chỉ ra phần còn thiếu so với rubric/điểm chính).
3. Một gợi ý "nếu là tôi, tôi sẽ nói thêm…" cho phần quan trọng nhất bị bỏ sót.
4. KẾT THÚC bằng đúng một dòng theo định dạng: ĐIỂM: NN/100 (NN là tổng điểm quy đổi trên thang 100).`;

  try {
    const full = await callClaudeStream({
      apiKey: key, model,
      system,
      messages: [{ role: 'user', content: user }],
      maxTokens: 1400,
      onText: t => { out.textContent = t; },
    });
    const m = full.match(/ĐIỂM:\s*(\d+)\s*\/\s*100/i);
    const aiScore = m ? Math.min(100, +m[1]) : null;
    const hist = dgHistory();
    hist.push({ id: drill.id, date: new Date().toISOString().slice(0, 10), ts: Date.now(), aiScore, timeSec: dgElapsedSec(), mode: 'ai' });
    store.set('prep-design-history', hist.slice(-100));
    logActivity();
    if (aiScore != null) {
      const badge = document.createElement('div');
      badge.className = 'dg-ai-badge';
      badge.textContent = `🤖 Điểm Claude: ${aiScore}/100 (đã lưu vào lịch sử)`;
      out.appendChild(badge);
    }
  } catch (e) {
    out.textContent = '⚠️ ' + (e.message || 'Lỗi gọi API');
  } finally {
    btn.disabled = false; btn.textContent = 'Chấm ngay';
  }
}

// ---------- AI chấm MỘT câu trả lời lẻ (tái dùng cho Mock; BYOK) ----------
/** Gọi Claude chấm 1 câu trả lời, đối chiếu đáp án tham chiếu. Trả về full text (kết bằng "ĐIỂM: N/10"). */
function aiGradeSingle({ question, reference, userAnswer, key, model, onText }) {
  const system = 'Bạn là interviewer kỹ thuật Backend (Node.js) dày dạn, đang chấm câu trả lời của ứng viên cho MỘT câu hỏi phỏng vấn. Chấm công bằng, mang tính xây dựng, NGẮN GỌN. Trả lời TIẾNG VIỆT, thuật ngữ giữ tiếng Anh, không markdown nặng.';
  const user = `CÂU HỎI: ${question}

ĐÁP ÁN THAM CHIẾU (chuẩn mong đợi, ứng viên không nhất thiết khớp y hệt):
"""${reference}"""

CÂU TRẢ LỜI CỦA ỨNG VIÊN:
"""${userAnswer}"""

Hãy: (1) nêu ngắn gọn ứng viên đã ĐÚNG/đủ gì; (2) chỉ ra điểm THIẾU hoặc SAI so với đáp án tham chiếu; (3) một gợi ý để trả lời tốt hơn. KẾT THÚC bằng đúng một dòng theo định dạng: ĐIỂM: N/10`;
  return callClaudeStream({ apiKey: key, model, system, messages: [{ role: 'user', content: user }], maxTokens: 900, onText });
}

async function mkAiGrade() {
  const it = mkQueue[mkIndex];
  if (!it) return;
  stopDictation(); // chốt bài trước khi chấm — mic còn chạy sẽ điền thêm sau khi đã gửi đi
  const key = document.getElementById('mk-aikey').value.trim();
  const userAnswer = document.getElementById('mk-uans').value.trim();
  if (!key) { alert('Hãy dán API key Anthropic của bạn (dùng chung với Phỏng vấn AI).'); document.getElementById('mk-aikey').focus(); return; }
  if (userAnswer.length < 10) { alert('Hãy gõ câu trả lời của bạn trước khi nhờ chấm.'); return; }
  store.set('prep-ai-key', key); // dùng chung với Mock AI / Design AI
  const model = (typeof aiCfg !== 'undefined' && aiCfg.model) || 'claude-opus-4-8';
  const btn = document.getElementById('mk-aigrade');
  btn.disabled = true; btn.textContent = '⏳ Đang chấm…';
  const out = document.getElementById('mk-aiout');
  out.hidden = false; out.textContent = '…';
  try {
    const full = await aiGradeSingle({
      question: it.q, reference: it.a, userAnswer, key, model,
      onText: t => { if (mkQueue[mkIndex] === it) out.textContent = t; }, // bỏ qua delta nếu đã đổi câu
    });
    if (mkQueue[mkIndex] !== it) return; // đã chuyển câu khác giữa lúc stream → không ghi kết quả lệch câu
    const m = full.match(/ĐIỂM:\s*(\d+(?:\.\d+)?)\s*\/\s*10/i);
    if (m) {
      const badge = document.createElement('div');
      badge.className = 'dg-ai-badge';
      badge.textContent = `🤖 Điểm Claude cho câu này: ${m[1]}/10`;
      out.appendChild(badge);
    }
    logActivity();
  } catch (e) {
    out.textContent = '⚠️ ' + (e.message || 'Lỗi gọi API');
  } finally {
    btn.disabled = false; btn.textContent = 'Chấm câu này';
  }
}

const PREP_KEYS = ['prep-progress', 'prep-quiz-scores', 'prep-srs', 'prep-last-doc',
  'prep-typing-best', 'prep-fails', 'prep-activity', 'prep-mock-history',
  'prep-pomo', 'prep-code-best', 'prep-fc-dir', 'prep-fc-auto', 'prep-code-history', 'prep-theme',
  'prep-last-view', 'prep-doc-checks', 'prep-mock-wrong', 'prep-ai-history', 'prep-ai-settings', 'prep-plan',
  'prep-coding-solved', 'prep-coding-code', 'prep-iq-best', 'prep-iq-test-history', 'prep-interview-history',
  'prep-daily-goal', 'prep-badges-seen', 'prep-design-history', 'prep-design-draft',
  'prep-oq-done', 'prep-oq-best', 'prep-debug-solved', 'prep-debug-code',
  'prep-api-done', 'prep-api-best', 'prep-sql-done', 'prep-sql-best', 'prep-cli-done', 'prep-cli-best',
  'prep-en-done', 'prep-sit-done', 'prep-readiness-log',
  'prep-star-drafts', 'prep-star-history', 'prep-ft-size', 'prep-quiz-wrong', 'prep-interview-date',
  'prep-capstone', 'prep-dict-lang', 'prep-quiz-pinned', 'prep-exam-history'];
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

/** Ghi điểm sẵn sàng hôm nay vào nhật ký (mỗi ngày một giá trị, theo lần tính mới nhất). */
function logReadiness(score) {
  const rdLog = store.get('prep-readiness-log', {});
  const k = dayKey(new Date());
  if (rdLog[k] !== score) { rdLog[k] = score; store.set('prep-readiness-log', rdLog); }
}

/** Vẽ 1 đồ thị cột CSS thuần vào #id: cols = [{title, hPct (0-100 đã tính), cls?, label}].
 *  cols rỗng → hiện emptyMsg. Guard null: HTML cũ (SW rơi về cache lúc mạng chập chờn)
 *  chưa có container — bỏ qua để các render phía sau vẫn chạy. */
function barChart(id, cols, emptyMsg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = cols.length
    ? cols.map(c => `
      <div class="bar-col" title="${escHtml(c.title)}">
        <div class="bar-v ${c.cls || ''}" style="height:${c.hPct}%"></div>
        <span class="bar-label">${escHtml(c.label)}</span>
      </div>`).join('')
    : `<p class="chart-empty">${emptyMsg}</p>`;
}

/** Các đồ thị cột thuần CSS: hoạt động 14 ngày, % mock, WPM gõ code, readiness, SRS đến hạn */
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
  barChart('dash-chart-activity', days.map(d => ({
    title: `${d.key}: ${d.n} lượt học`,
    hPct: Math.max(Math.round(d.n / maxAct * 100), d.n ? 4 : 0),
    label: +d.key.slice(8),
  })), 'Chưa có hoạt động nào.');

  // % đúng các buổi mock gần nhất
  const hist = store.get('prep-mock-history', []).slice(-15);
  barChart('dash-chart-mock', hist.map(h => {
    const pct = Math.round((h.correct / h.total) * 100);
    return { title: `${h.date}: ${h.correct}/${h.total} (${pct}%)`, hPct: Math.max(pct, 4), cls: pct >= 80 ? 'ok' : 'low', label: pct };
  }), 'Chưa có buổi mock nào — đồ thị sẽ hiện khi bạn làm mock đầu tiên.');

  // 🎓 Điểm các lần thi thử gần nhất
  const exams = store.get('prep-exam-history', []).slice(-15);
  barChart('dash-chart-exam', exams.map(h => ({
    title: `${new Date(h.d).toLocaleDateString('vi-VN')}: ${h.sprint ? '🔥 nước rút · ' : ''}${h.right}/${h.n} (${h.pct}%) · ${fmtClock(h.secs)}${h.timeout ? ' · ⏰ hết giờ' : ''}`,
    hPct: Math.max(h.pct, 4),
    cls: h.pct >= 80 ? 'ok' : h.pct < 50 ? 'low' : '',
    label: h.pct,
  })), 'Chưa thi thử lần nào — vào 🧠 Tư duy → 🎓 Thi thử làm một đề đo phong độ.');

  // WPM các lượt gõ code gần nhất
  const wpms = store.get('prep-code-history', []).slice(-20);
  const maxWpm = Math.max(...wpms.map(w => w.wpm), 1);
  barChart('dash-chart-wpm', wpms.map(w => ({
    title: `${w.date}: ${w.wpm} WPM · ${w.acc}% chính xác`,
    hPct: Math.max(Math.round(w.wpm / maxWpm * 100), 4),
    cls: w.acc >= 95 ? 'ok' : '',
    label: w.wpm,
  })), 'Chưa có lượt gõ nào — vào tab ⌨️ Gõ code làm một snippet nhé.');

  // 🎯 Điểm sẵn sàng theo ngày — ghi nhật ký NGAY TẠI ĐÂY để mở Dashboard là có dữ liệu
  // (trước đây chỉ ghi ở readinessHtml vốn nằm trong tab Kế hoạch — chart trống vĩnh viễn)
  logReadiness(computeReadiness().score);
  const rdLog = store.get('prep-readiness-log', {});
  const rdDays = Object.keys(rdLog).sort().slice(-20);
  barChart('dash-chart-readiness', rdDays.length < 2 ? [] : rdDays.map(k => ({
    title: `${k}: ${rdLog[k]}/100`, hPct: Math.max(rdLog[k], 4), cls: rdLog[k] >= 80 ? 'ok' : '', label: rdLog[k],
  })), 'Cần ít nhất 2 ngày dữ liệu — mở Dashboard mỗi ngày để thấy đường tiến bộ.');

  // 📬 dự báo từ vựng đến hạn 7 ngày tới — quá hạn dồn vào cột "Nay" để thấy nợ ôn tập
  const srs = store.get('prep-srs', {});
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const dueBuckets = Array(7).fill(0);
  Object.values(srs).forEach(e => {
    const diff = Math.floor((srsDue(e) - t0.getTime()) / 864e5);
    const i = Math.max(0, diff);
    if (i < 7) dueBuckets[i]++;
  });
  const maxDue = Math.max(...dueBuckets, 1);
  const dueTotal = dueBuckets.reduce((a, b) => a + b, 0);
  barChart('dash-chart-due', !dueTotal ? [] : dueBuckets.map((n, i) => ({
    title: `${i === 0 ? 'Hôm nay (gồm quá hạn)' : `+${i} ngày nữa`}: ${n} từ`,
    hPct: Math.max(Math.round(n / maxDue * 100), n ? 4 : 0),
    cls: i === 0 && n ? 'low' : '',
    label: i === 0 ? 'Nay' : '+' + i,
  })), 'Chưa có thẻ nào tới hạn trong 7 ngày — học flashcards để xây lịch ôn SRS.');
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
    loadMockPool().then(() => {
      fillMockWeekSelect();
      const sel = document.getElementById('mk-week');
      if (sel) sel.value = '__wrong__';
    });
  });
}

function exportData() {
  const data = {};
  PREP_KEYS.forEach(k => {
    const v = localStorage.getItem(k);
    if (v != null) { try { data[k] = JSON.parse(v); } catch { /* bỏ key hỏng, không phá cả backup */ } }
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

// ---------- 🖨️ Bản in ôn nhanh (cheat sheet trước giờ phỏng vấn) ----------
/** Gom những thứ yếu nhất thành HTML trang in: từ cứng đầu, câu đang sai (kèm đáp án),
 *  keyPoints các đề design yếu, câu hỏi ngược & mẫu câu tiếng Anh cứu nguy. */
async function buildPrintSheetHtml() {
  await loadDeck();
  const date = store.get('prep-interview-date', '');
  const d = daysUntil(date);
  const head = date && d != null && d >= 0
    ? `Phỏng vấn ${d === 0 ? 'HÔM NAY' : `sau ${d} ngày (${escHtml(date)})`}`
    : `In ngày ${dayKey(new Date())}`;

  const leech = filterDeck('__leech__').slice(0, 20);
  const leechHtml = leech.length ? `<h2>🔥 Từ hay quên (${leech.length})</h2><ul class="ps-2col">${leech.map(c =>
    `<li><b>${escHtml(c.front)}</b> — ${escHtml(c.meaning)}</li>`).join('')}</ul>` : '';

  const psQHtml = ({ mode, q }) => {
    const cfg = QUIZ_MODES[mode];
    const body = q.q ? escHtml(q.q) : (cfg ? escHtml(cfg.ask) : 'Đoán output:');
    const snip = q.sql || q.cmd || q.code;
    return `<div class="ps-q"><span class="ps-mode">${cfg ? cfg.label : mode}</span> ${body}
      ${snip ? `<pre>${escHtml(snip)}</pre>` : ''}
      <div class="ps-a">✅ ${escHtml(q.options[q.answer])}</div>
      <div class="ps-why">${escHtml(q.explain || '')}</div></div>`;
  };
  const wrong = buildReviewQueue().slice(0, 12);
  const wrongHtml = wrong.length ? `<h2>🔁 Câu bạn đang sai (${wrong.length} câu gần nhất)</h2>${wrong.map(psQHtml).join('')}` : '';
  // Câu 📌 tự ghim — đúng mục đích "xem lại trước giờ G"; loại câu đã nằm ở khối đang-sai cho khỏi in trùng
  const wrongKeys = new Set(wrong.map(it => `${it.mode}:${it.q.id}`));
  const pinned = buildPinnedQueue().filter(it => !wrongKeys.has(`${it.mode}:${it.q.id}`)).slice(0, 12);
  const pinnedHtml = pinned.length ? `<h2>📌 Câu bạn đã ghim (${pinned.length})</h2>${pinned.map(psQHtml).join('')}` : '';

  const scored = dgDrills().map(x => ({ x, best: dgBestCoverage(x.id) }));
  const weakDrills = [...scored.filter(s => s.best == null), ...scored.filter(s => s.best != null).sort((a, b) => a.best - b.best)]
    .slice(0, 3);
  const designHtml = weakDrills.length ? `<h2>🏛️ Ý chính 3 đề thiết kế cần xem lại</h2>${weakDrills.map(({ x, best }) =>
    `<div class="ps-drill"><b>${escHtml(x.title)}</b> <small>${best == null ? 'chưa luyện' : `tốt nhất ${best}%`}</small>
     <ul>${x.keyPoints.slice(0, 4).map(k => `<li>${escHtml(k)}</li>`).join('')}</ul></div>`).join('')}` : '';

  // Chuyện STAR đã soạn HOÀN CHỈNH (đủ 4 ô) — nội dung tự viết là thứ đáng đọc lại nhất
  const drafts = starDraftsAll();
  const stories = starQs()
    .map(q => ({ q, d: drafts[q.id] }))
    .filter(x => x.d && x.d.s.trim() && x.d.t.trim() && x.d.a.trim() && x.d.r.trim())
    .slice(0, 8);
  const starHtml = stories.length ? `<h2>🌟 Chuyện STAR bạn đã soạn (${stories.length})</h2>${stories.map(({ q, d }) =>
    `<div class="ps-star"><b>${escHtml(q.q)}</b>
     <p><b>S:</b> ${escHtml(d.s)}</p><p><b>T:</b> ${escHtml(d.t)}</p>
     <p><b>A:</b> ${escHtml(d.a)}</p><p><b>R:</b> ${escHtml(d.r)}</p></div>`).join('')}` : '';

  const rq = (window.REVERSE_QUESTIONS || []).flatMap(g => g.items).slice(0, 5);
  const rqHtml = rq.length ? `<h2>💬 5 câu hỏi ngược nên hỏi</h2><ul>${rq.map(i => `<li>${escHtml(i.q)}</li>`).join('')}</ul>` : '';

  const eps = (window.ENGLISH_PHRASES || []).filter(g => ['ep-buytime', 'ep-close'].includes(g.id));
  const epHtml = eps.length ? `<h2>🇬🇧 Mẫu câu cứu nguy & chốt buổi</h2><ul>${eps.flatMap(g => g.items).map(i =>
    `<li><i>${escHtml(i.en)}</i></li>`).join('')}</ul>` : '';

  return `<div class="ps-head"><h1>🏁 Ôn nhanh trước phỏng vấn</h1><p>${head} · minhhaibui.github.io/interview</p></div>
    ${leechHtml}${wrongHtml}${pinnedHtml}${designHtml}${starHtml}${rqHtml}${epHtml}
    <p class="ps-foot">Hít thở sâu — bạn chuẩn bị kỹ rồi. Chúc may mắn! 💪</p>`;
}

/** Đổ cheat sheet vào #print-sheet rồi mở hộp thoại in (CSS @media print chỉ hiện phần này). */
async function printSheet() {
  let el = document.getElementById('print-sheet');
  if (!el) { el = document.createElement('div'); el.id = 'print-sheet'; document.body.appendChild(el); }
  el.innerHTML = await buildPrintSheetHtml();
  window.print();
}

const WEEK_TASKS = [
  ['theory', '📚 Lý thuyết'],
  ['exercises', '💪 Bài tập'],
  ['cases', '🏗️ Design & Cases'],
  ['test', '📝 Test cuối tuần'],
  ['english', '🇬🇧 English tuần này'],
];

/** Checklist 12 tuần + thanh % + empty-state người mới — phần duy nhất phụ thuộc tick ô tuần.
 *  Tách khỏi renderDashboard để mỗi lần tick không dựng lại heatmap/danh sách mock/SRS. */
function renderWeekChecklist() {
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
        // Tick chỉ đổi checklist + điểm sẵn sàng (phần Kiến thức) — vẽ lại đúng 2 thứ đó,
        // không dựng lại heatmap/danh sách mock/SRS như renderDashboard() đầy đủ trước đây.
        renderWeekChecklist();
        renderCharts();
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

  // Empty-state: người mới chưa có dữ liệu gì → hướng dẫn bắt đầu thay vì biểu đồ trống khó hiểu
  const entries = Object.entries(store.get('prep-quiz-scores', {}));
  const acts = store.get('prep-activity', {});
  const anyActivity = Object.values(acts).some(n => n > 0);
  const isNew = done === 0 && !anyActivity && entries.length === 0;
  const dashWrap = document.querySelector('.dash-wrap');
  let empty = document.getElementById('dash-empty');
  if (isNew) {
    if (!empty) {
      empty = document.createElement('div');
      empty.id = 'dash-empty';
      empty.className = 'dash-empty';
      const h1 = dashWrap.querySelector('h1');
      dashWrap.insertBefore(empty, h1.nextSibling);
    }
    empty.hidden = false;
    empty.innerHTML = `<span class="de-ic">📭</span>
      <h2>Chưa có dữ liệu tiến độ</h2>
      <p>Bắt đầu học hôm nay để chuỗi ngày, biểu đồ và điểm sẵn sàng hiện ra ở đây.</p>
      <div class="de-cta">
        <button id="de-today" class="onb-cta">🔥 Mở Hôm nay</button>
        <button id="de-docs" class="onb-back">📖 Đọc tài liệu</button>
      </div>`;
    document.getElementById('de-today').onclick = () => switchView('today');
    document.getElementById('de-docs').onclick = () => switchView('docs');
  } else if (empty) {
    empty.hidden = true;
  }
}

function renderDashboard() {
  renderWeekChecklist();

  // 🧪 Capstone: tiến độ nghiệm thu Upgrade 1→5 (tick ở tab Kế hoạch)
  const capEl = document.getElementById('dash-capstone');
  if (capEl) {
    const ups = window.CAPSTONE_UPGRADES || [];
    const cap = store.get('prep-capstone', {});
    const capTotal = ups.reduce((s, u) => s + u.items.length, 0);
    const capDone = ups.reduce((s, u) => s + u.items.filter((_, i) => (cap[u.id] || {})[i]).length, 0);
    capEl.innerHTML = ups.length ? `
      <span class="dc-label">🧪 Capstone Upgrade 1→5</span>
      <div class="bar"><div class="bar-fill" style="width:${capTotal ? Math.round(capDone / capTotal * 100) : 0}%"></div></div>
      <span>${capDone}/${capTotal}</span>
      <button type="button" id="dash-cap-open">📅 Kế hoạch</button>` : '';
    document.getElementById('dash-cap-open')?.addEventListener('click', () => switchView('plan'));
  }

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
  renderThinkStats();
  renderCharts();
  renderMockHistory();
  renderMockWrong();

  document.getElementById('dash-export').onclick = exportData;
  document.getElementById('dash-print').onclick = printSheet;
  const fileInput = document.getElementById('dash-import-file');
  document.getElementById('dash-import').onclick = () => fileInput.click();
  fileInput.onchange = () => {
    if (fileInput.files[0]) importData(fileInput.files[0]);
    fileInput.value = '';
  };
  document.getElementById('dash-reset').onclick = () => {
    if (confirm('Xoá toàn bộ tiến độ, điểm quiz, SRS, heatmap và lịch sử mock? (Nên 📤 Xuất backup trước!)')) {
      PREP_KEYS.forEach(k => localStorage.removeItem(k));
      clearExamState(); // bài thi dở nằm ngoài PREP_KEYS (không sync) nhưng reset thì phải sạch
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
/** Panel tiến độ các mode tab Tư duy trong Dashboard. */
function renderThinkStats() {
  const el = document.getElementById('dash-think');
  if (!el) return;
  const coding = bankCoverage(window.CODING_PROBLEMS, 'prep-coding-solved');
  const oq = coverageOf('output');
  const dbg = bankCoverage(window.DEBUG_CHALLENGES, 'prep-debug-solved');
  const api = coverageOf('api');
  const sql = coverageOf('sql');
  const cli = coverageOf('cli');
  const iqBest = (store.get('prep-iq-best', {}) || {}).iq || 0;
  const oqBest = store.get('prep-oq-best', null);
  const apiBest = store.get('prep-api-best', null);
  const sqlBest = store.get('prep-sql-best', null);
  const cliBest = store.get('prep-cli-best', null);
  const bar = (label, done, total, extra = '') => {
    const pct = total ? Math.round(done / total * 100) : 0;
    return `<div class="tk-row"><span class="tk-label">${label}</span>
      <div class="tk-track"><div class="tk-fill" style="width:${pct}%"></div></div>
      <span class="tk-val">${done}/${total}${extra}</span></div>`;
  };
  const iqPctBar = iqBest ? Math.min(100, Math.max(0, (iqBest - 80) / (130 - 80) * 100)) : 0;
  el.innerHTML =
    bar('💻 Lập trình', coding.done, coding.total) +
    bar('🔍 Đoán output', oq.done, oq.total, oqBest ? ` · KL ${oqBest.score}/${oqBest.total}` : '') +
    bar('🐛 Sửa bug', dbg.done, dbg.total) +
    bar('📡 API/HTTP', api.done, api.total, apiBest ? ` · KL ${apiBest.score}/${apiBest.total}` : '') +
    bar('🗄️ SQL Drill', sql.done, sql.total, sqlBest ? ` · KL ${sqlBest.score}/${sqlBest.total}` : '') +
    bar('🖥️ CLI Quiz', cli.done, cli.total, cliBest ? ` · KL ${cliBest.score}/${cliBest.total}` : '') +
    `<div class="tk-row"><span class="tk-label">🧩 IQ ước lượng</span>
      <div class="tk-track"><div class="tk-fill" style="width:${iqPctBar}%"></div></div>
      <span class="tk-val">${iqBest || '—'}</span></div>`;
  // Câu trắc nghiệm đã chọn sai (gom từ output/API/SQL/CLI) → CTA ôn lại
  const wrongN = wrongTotal();
  const cta = document.createElement('div');
  cta.className = 'tk-review';
  cta.innerHTML = wrongN
    ? `<span>🔁 <b>${wrongN}</b> câu trắc nghiệm cần ôn lại</span>
       <button id="tk-review-go" class="dg-go dg-link">Ôn ngay →</button>`
    : `<span class="tk-review-ok">✅ Không còn câu trắc nghiệm nào đang sai — giỏi lắm!</span>`;
  el.appendChild(cta);
  const goBtn = document.getElementById('tk-review-go');
  if (goBtn) goBtn.onclick = goToQuizReview;
}

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

  // 6) Tư duy — bài code đã giải + IQ + phỏng vấn tổng hợp + 5 quiz mới (đoán output/sửa bug/API/SQL/CLI)
  // % theo id còn tồn tại (giống cách tính badge), lấy TB các phần đã có dữ liệu.
  const covPct = c => (c.total ? c.done / c.total * 100 : null);
  const codingTotal = (window.CODING_PROBLEMS || []).length;
  const solvedN = Object.keys(store.get('prep-coding-solved', {})).length;
  const codingPct = codingTotal ? solvedN / codingTotal * 100 : null;
  const iqBest = (store.get('prep-iq-best', {}) || {}).iq || 0;
  const iqPct = iqBest ? (iqBest - 80) / (130 - 80) * 100 : null; // 80→0, 130→100
  const ivHist = store.get('prep-interview-history', []);
  const ivBest = ivHist.length ? Math.max(...ivHist.map(r => r.overall || 0)) : null;
  const oqPct = covPct(coverageOf('output'));
  const dbgPct = covPct(bankCoverage(window.DEBUG_CHALLENGES, 'prep-debug-solved'));
  const apiPct = covPct(coverageOf('api'));
  const sqlPct = covPct(coverageOf('sql'));
  const cliPct = covPct(coverageOf('cli'));
  const thinkVals = [codingPct, iqPct, ivBest, oqPct, dbgPct, apiPct, sqlPct, cliPct].filter(v => v != null);
  const think = thinkVals.length ? thinkVals.reduce((a, b) => a + b, 0) / thinkVals.length : 0;

  // 7) Thiết kế hệ thống — coverage rubric tốt nhất + điểm AI tốt nhất (TB phần đã có), nhân độ phủ số lần luyện
  const dh = store.get('prep-design-history', []);
  const dSelf = dh.filter(h => typeof h.coverage === 'number').map(h => h.coverage);
  const dAi = dh.filter(h => typeof h.aiScore === 'number').map(h => h.aiScore);
  const dVals = [dSelf.length ? Math.max(...dSelf) : null, dAi.length ? Math.max(...dAi) : null].filter(v => v != null);
  const designBase = dVals.length ? dVals.reduce((a, b) => a + b, 0) / dVals.length : 0;
  const design = designBase * Math.min(dh.length / 3, 1);

  const parts = [
    { key: 'know', label: '📚 Kiến thức', pct: clamp(know), weight: 0.22, view: 'dashboard',
      tip: 'Tick các mục đã học ở tab 📊 Tiến độ để tăng phần này.' },
    { key: 'mem', label: '🃏 Trí nhớ (flashcards)', pct: clamp(mem), weight: 0.13, view: 'flashcards',
      tip: 'Ôn flashcards đều để đẩy thẻ lên hộp SRS cao hơn.' },
    { key: 'mock', label: '🎯 Phỏng vấn thử', pct: clamp(mock), weight: 0.22, view: 'mock',
      tip: 'Làm thêm Mock (tự chấm hoặc AI) — đây là phần nặng ký nhất.' },
    { key: 'think', label: '🧠 Tư duy (code + IQ)', pct: clamp(think), weight: 0.13, view: 'coding',
      tip: 'Giải bài Lập trình, làm Test IQ và Phỏng vấn tổng hợp để tăng phần này.' },
    { key: 'design', label: '🏛️ Thiết kế hệ thống', pct: clamp(design), weight: 0.10, view: 'design',
      tip: 'Luyện đề System Design ở tab 🏛️ Thiết kế HT — tự chấm rubric hoặc nhờ AI chấm.' },
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
  logReadiness(score);
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

/** Section 🧪 Capstone trong tab Kế hoạch: checklist nghiệm thu Upgrade 1→5 (prep-capstone). */
function capstoneHtml() {
  const ups = window.CAPSTONE_UPGRADES || [];
  if (!ups.length) return '';
  const cap = store.get('prep-capstone', {});
  const total = ups.reduce((s, u) => s + u.items.length, 0);
  const done = ups.reduce((s, u) => s + u.items.filter((_, i) => (cap[u.id] || {})[i]).length, 0);
  const rows = ups.map(u => {
    const c = cap[u.id] || {};
    const n = u.items.filter((_, i) => c[i]).length;
    const full = n === u.items.length;
    return `<details class="rq-group cap-up${full ? ' done' : ''}" data-up="${u.id}">
      <summary>${u.icon} ${escHtml(u.label)}
        <button type="button" class="cap-open" data-doc="${escHtml(u.doc)}">📖 guide</button>
        <span class="rq-n cap-n">${full ? '✅ ' : ''}${n}/${u.items.length}</span>
      </summary>
      <ul class="cap-list">${u.items.map((it, i) =>
        `<li><label><input type="checkbox" data-up="${u.id}" data-i="${i}"${c[i] ? ' checked' : ''}> <span>${escHtml(it)}</span></label></li>`).join('')}
      </ul>
    </details>`;
  }).join('');
  return `<div class="plan-capstone">
    <h2>🧪 Capstone — nghiệm thu Upgrade 1→5</h2>
    <p class="plan-hint" style="color:var(--muted)">Tick khi đã TẬN TAY làm và chứng kiến từng mục — đây là phần kể được "bằng sẹo" khi phỏng vấn. Đã xong <b id="cap-total">${done}</b>/${total} mục.</p>
    ${rows}
  </div>`;
}

/** Cập nhật tick capstone tại chỗ (không re-render để accordion không bị đóng). */
function bindCapstone(body) {
  const ups = window.CAPSTONE_UPGRADES || [];
  body.querySelectorAll('.cap-open').forEach(b => b.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation(); // đừng toggle <details>
    switchView('docs'); openDoc(b.dataset.doc);
  }));
  body.querySelectorAll('.cap-list input[type="checkbox"]').forEach(cb => cb.addEventListener('change', () => {
    const cap = store.get('prep-capstone', {});
    const o = cap[cb.dataset.up] || (cap[cb.dataset.up] = {});
    if (cb.checked) o[cb.dataset.i] = true; else delete o[cb.dataset.i];
    store.set('prep-capstone', cap);
    const det = cb.closest('.cap-up');
    const u = ups.find(x => x.id === cb.dataset.up);
    const n = u.items.filter((_, i) => o[i]).length;
    const full = n === u.items.length;
    det.classList.toggle('done', full);
    det.querySelector('.cap-n').textContent = `${full ? '✅ ' : ''}${n}/${u.items.length}`;
    const totalEl = document.getElementById('cap-total');
    if (totalEl) totalEl.textContent = ups.reduce((s, x) => s + x.items.filter((_, i) => (cap[x.id] || {})[i]).length, 0);
    logActivity();
  }));
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

    ${capstoneHtml()}

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
  bindCapstone(body);
}

// ========== LUYỆN TƯ DUY: Lập trình + IQ ==========
let thinkInit = false, thinkMode = 'code';

function initThink() {
  document.querySelectorAll('.think-mode').forEach(b => { b.onclick = () => setThinkMode(b.dataset.mode); });
  setThinkMode(thinkMode);
  if (!thinkInit) { renderCodingFilters(); renderCodingList(); renderIQ(); renderOutputQuiz(); renderDebugList(); renderApiQuiz(); renderSqlQuiz(); renderCliQuiz(); thinkInit = true; }
  refreshThinkBadges();
}

function setThinkMode(m) {
  thinkMode = m;
  if (m !== 'iq' && typeof iqTimerId !== 'undefined') clearInterval(iqTimerId); // rời chế độ IQ → dừng timer
  document.querySelectorAll('.think-mode').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
  document.getElementById('think-code').hidden = m !== 'code';
  document.getElementById('think-iq').hidden = m !== 'iq';
  document.getElementById('think-output').hidden = m !== 'output';
  document.getElementById('think-debug').hidden = m !== 'debug';
  document.getElementById('think-api').hidden = m !== 'api';
  document.getElementById('think-sql').hidden = m !== 'sql';
  document.getElementById('think-cli').hidden = m !== 'cli';
  document.getElementById('think-review').hidden = m !== 'review';
  document.getElementById('think-exam').hidden = m !== 'exam';
  if (m === 'review') renderReview();
  // Rời/vào mode Thi thử: ticker dừng khi rời, vào lại thì renderExam tự nối tiếp bài đang dở
  // (đồng hồ tính theo deadline examEndMs nên tạm rời không "câu giờ" được; hết hạn thì tự nộp).
  if (m !== 'exam' && examTimerId) { clearInterval(examTimerId); examTimerId = null; }
  if (m === 'exam') renderExam();
  refreshThinkBadges();
  // Quay lại mode IQ khi đang dở Bài Test (có tính giờ) → khởi động lại đồng hồ
  // (switchView/đổi mode đã clearInterval; tickIQTest tính theo startMs nên không lệch, và tự nộp nếu hết giờ).
  if (m === 'iq' && iqState && iqState.mode === 'test') {
    clearInterval(iqTimerId);
    tickIQTest();
    iqTimerId = setInterval(tickIQTest, 1000);
  }
}

// ----- Chế độ 🔍 Đoán Output (quiz đoán console.log) -----
let oqOrder = [], oqIdx = 0, oqRight = 0;
const oqAll = () => window.OUTPUT_QUIZ || [];
const oqDone = () => store.get('prep-oq-done', {});

function renderOutputQuiz() {
  const all = oqAll();
  const body = document.getElementById('oq-body');
  if (!body) return;
  if (!all.length) { body.innerHTML = '<p>Chưa nạp được ngân hàng câu đoán output.</p>'; return; }
  const ids = new Set(all.map(q => q.id));
  const done = Object.keys(oqDone()).filter(id => ids.has(id)).length; // chỉ đếm id còn tồn tại

  const best = store.get('prep-oq-best', null);
  body.innerHTML = `
    <div class="oq-start">
      <p>Có <b>${all.length}</b> snippet. Đã làm đúng: <b>${done}/${all.length}</b>${best ? ` · kỷ lục: <b>${best.score}/${best.total}</b>` : ''}.</p>
      <button id="oq-go" class="dg-go">▶ Bắt đầu (${all.length} câu, trộn thứ tự)</button>
    </div>`;
  document.getElementById('oq-go').onclick = startOutputQuiz;
}

function startOutputQuiz() {
  const n = oqAll().length;
  oqOrder = shuffleArr([...Array(n).keys()]);
  oqIdx = 0; oqRight = 0;
  showOutputQuiz();
}

function showOutputQuiz() {
  const all = oqAll();
  const q = all[oqOrder[oqIdx]];
  if (!q) return finishOutputQuiz();
  const body = document.getElementById('oq-body');
  const opts = shuffledOptsHtml(q, o => `<pre>${escHtml(o)}</pre>`);
  body.innerHTML = `
    <div class="oq-quiz">
      <div class="oq-bar"><span>Câu ${oqIdx + 1}/${all.length} · ✓ ${oqRight}</span><span class="oq-topic">${escHtml(q.topic)}</span></div>
      <p class="oq-ask">Đoán xem đoạn code in ra gì?</p>
      <pre class="oq-code"><code class="language-js">${escHtml(q.code)}</code></pre>
      <div class="oq-opts">${opts}</div>
      <div id="oq-fb" class="oq-fb" hidden></div>
    </div>`;
  if (window.hljs) body.querySelectorAll('pre code').forEach(el => { try { hljs.highlightElement(el); } catch { /* bỏ qua */ } });
  body.querySelectorAll('.oq-opt').forEach(b => b.onclick = () => answerOutputQuiz(+b.dataset.i));
}

function answerOutputQuiz(i) {
  const all = oqAll();
  const q = all[oqOrder[oqIdx]];
  const body = document.getElementById('oq-body');
  const correct = i === q.answer;
  body.querySelectorAll('.oq-opt').forEach(b => {
    b.disabled = true;
    const oi = +b.dataset.i; // chỉ số GỐC (thứ tự hiển thị đã shuffle)
    if (oi === q.answer) b.classList.add('right');
    else if (oi === i) b.classList.add('wrong');
  });
  if (correct) {
    oqRight++;
    const done = oqDone(); done[q.id] = true; store.set('prep-oq-done', done);
    clearWrong('output', q.id);
  } else {
    recordWrong('output', q.id);
  }
  logActivity();
  refreshThinkBadges();
  const fb = document.getElementById('oq-fb');
  fb.hidden = false;
  fb.innerHTML = `<div class="oq-verdict ${correct ? 'ok' : 'no'}">${correct ? '✅ Chính xác!' : '❌ Chưa đúng'}</div>
    <p class="oq-explain">${escHtml(q.explain)}</p>
    <div class="oq-fb-actions">${pinBtnHtml('output', q.id)}
    <button id="oq-next" class="dg-go">${oqIdx + 1 < all.length ? 'Câu tiếp →' : 'Xem kết quả'}</button></div>`;
  bindPinBtns(fb);
  document.getElementById('oq-next').onclick = () => { oqIdx++; showOutputQuiz(); };
  fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function finishOutputQuiz() {
  const total = oqAll().length;
  const best = store.get('prep-oq-best', null);
  if (!best || oqRight > best.score) store.set('prep-oq-best', { score: oqRight, total });
  const pct = total ? Math.round(oqRight / total * 100) : 0;
  const body = document.getElementById('oq-body');
  body.innerHTML = `
    <div class="oq-result">
      <h2>${pct >= 80 ? '🌟' : pct >= 50 ? '👍' : '📚'} Bạn đúng ${oqRight}/${total} (${pct}%)</h2>
      <p>${pct >= 80 ? 'Nắm rất chắc các bẫy JS!' : pct >= 50 ? 'Khá ổn — ôn lại vài chỗ nữa.' : 'Mấy bẫy này hay gặp khi phỏng vấn — đọc kỹ giải thích nhé.'}</p>
      <button id="oq-again" class="dg-go">↻ Làm lại</button>
    </div>`;
  document.getElementById('oq-again').onclick = startOutputQuiz;
}

// ----- Engine quiz trắc nghiệm dùng chung (tái dùng cho 📡 API/HTTP, và quiz tương lai) -----
// cfg: { bodyId, data:()=>[], doneKey, bestKey, ask, optionHtml(o), questionHtml(q), highlight, resultMsg(pct) }
function makeQuiz(cfg) {
  let order = [], idx = 0, right = 0;
  const data = () => cfg.data() || [];
  const doneSet = () => store.get(cfg.doneKey, {});
  const body = () => document.getElementById(cfg.bodyId);
  function render() {
    const all = data(), el = body();
    if (!el) return;
    if (!all.length) { el.innerHTML = '<p>Chưa nạp được ngân hàng câu hỏi.</p>'; return; }
    const ids = new Set(all.map(q => q.id));
    const done = Object.keys(doneSet()).filter(id => ids.has(id)).length;
    const best = store.get(cfg.bestKey, null);
    el.innerHTML = `
      <div class="oq-start">
        <p>Có <b>${all.length}</b> câu. Đã làm đúng: <b>${done}/${all.length}</b>${best ? ` · kỷ lục: <b>${best.score}/${best.total}</b>` : ''}.</p>
        <button class="dg-go oq-go-btn">▶ Bắt đầu (${all.length} câu, trộn thứ tự)</button>
      </div>`;
    el.querySelector('.oq-go-btn').onclick = start;
  }
  function start() { const n = data().length; order = shuffleArr([...Array(n).keys()]); idx = 0; right = 0; show(); }
  function show() {
    const all = data(), q = all[order[idx]];
    if (!q) return finish();
    const el = body();
    const opts = shuffledOptsHtml(q, cfg.optionHtml);
    el.innerHTML = `
      <div class="oq-quiz">
        <div class="oq-bar"><span>Câu ${idx + 1}/${all.length} · ✓ ${right}</span><span class="oq-topic">${escHtml(q.topic)}</span></div>
        <div class="oq-ask">${cfg.ask}</div>
        ${cfg.questionHtml(q)}
        <div class="oq-opts">${opts}</div>
        <div class="oq-fb-box oq-fb" hidden></div>
      </div>`;
    if (cfg.highlight && window.hljs) el.querySelectorAll('pre code').forEach(c => { try { hljs.highlightElement(c); } catch { /* bỏ qua */ } });
    el.querySelectorAll('.oq-opt').forEach(b => b.onclick = () => answer(+b.dataset.i));
  }
  function answer(i) {
    const all = data(), q = all[order[idx]], el = body();
    const correct = i === q.answer;
    el.querySelectorAll('.oq-opt').forEach(b => { b.disabled = true; const oi = +b.dataset.i; if (oi === q.answer) b.classList.add('right'); else if (oi === i) b.classList.add('wrong'); });
    if (correct) { right++; const d = doneSet(); d[q.id] = true; store.set(cfg.doneKey, d); clearWrong(cfg.mode, q.id); }
    else recordWrong(cfg.mode, q.id);
    logActivity();
    refreshThinkBadges();
    const fb = el.querySelector('.oq-fb-box');
    fb.hidden = false;
    fb.innerHTML = `<div class="oq-verdict ${correct ? 'ok' : 'no'}">${correct ? '✅ Chính xác!' : '❌ Chưa đúng'}</div>
      <p class="oq-explain">${escHtml(q.explain)}</p>
      <div class="oq-fb-actions">${pinBtnHtml(cfg.mode, q.id)}
      <button class="dg-go oq-next-btn">${idx + 1 < all.length ? 'Câu tiếp →' : 'Xem kết quả'}</button></div>`;
    bindPinBtns(fb);
    fb.querySelector('.oq-next-btn').onclick = () => { idx++; show(); };
    fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function finish() {
    const total = data().length, best = store.get(cfg.bestKey, null);
    if (!best || right > best.score) store.set(cfg.bestKey, { score: right, total });
    const pct = total ? Math.round(right / total * 100) : 0;
    body().innerHTML = `
      <div class="oq-result">
        <h2>${pct >= 80 ? '🌟' : pct >= 50 ? '👍' : '📚'} Bạn đúng ${right}/${total} (${pct}%)</h2>
        <p>${cfg.resultMsg(pct)}</p>
        <button class="dg-go oq-again-btn">↻ Làm lại</button>
      </div>`;
    body().querySelector('.oq-again-btn').onclick = start;
  }
  return { render, start };
}

// Registry mô tả cách render mỗi mode trắc nghiệm — NGUỒN DUY NHẤT cho engine makeQuiz
// (spread làm cfg nền), phiên ôn 🔁/🎲/📌, đếm badge độ phủ và 🔎 tìm kiếm toàn cục.
const QUIZ_MODES = {
  output: {
    label: '🔍 Đoán output', doneKey: 'prep-oq-done', data: () => window.OUTPUT_QUIZ || [],
    ask: 'Đoán xem đoạn code in ra gì?',
    optionHtml: o => `<pre>${escHtml(o)}</pre>`,
    questionHtml: q => `<pre class="oq-code"><code class="language-js">${escHtml(q.code)}</code></pre>`,
    highlight: true,
  },
  api: {
    label: '📡 API & HTTP', doneKey: 'prep-api-done', data: () => window.API_QUIZ || [],
    ask: 'Chọn đáp án đúng:',
    optionHtml: o => `<span class="oq-otext">${escHtml(o)}</span>`,
    questionHtml: q => `<p class="oq-question">${escHtml(q.q)}</p>`,
    highlight: false,
  },
  sql: {
    label: '🗄️ SQL', doneKey: 'prep-sql-done', data: () => window.SQL_DRILL || [],
    ask: 'Chọn đáp án đúng:',
    optionHtml: o => `<span class="oq-otext">${escHtml(o)}</span>`,
    questionHtml: q => `<p class="oq-question">${escHtml(q.q)}</p>` +
      (q.sql ? `<pre><code class="language-sql">${escHtml(q.sql)}</code></pre>` : ''),
    highlight: true,
  },
  cli: {
    label: '🖥️ CLI', doneKey: 'prep-cli-done', data: () => window.CLI_QUIZ || [],
    ask: 'Chọn đáp án đúng:',
    optionHtml: o => `<span class="oq-otext">${escHtml(o)}</span>`,
    questionHtml: q => `<p class="oq-question">${escHtml(q.q)}</p>` +
      (q.cmd ? `<pre><code class="language-bash">${escHtml(q.cmd)}</code></pre>` : ''),
    highlight: true,
  },
  // 2 vòng trắc nghiệm của Phỏng vấn tổng hợp cũng đổ câu sai về đây (ghi ở answerMcq).
  english: {
    label: '🇬🇧 Tiếng Anh', doneKey: 'prep-en-done', data: () => window.ENGLISH_QUESTIONS || [],
    ask: 'Chọn đáp án đúng:',
    optionHtml: o => `<span class="oq-otext">${escHtml(o)}</span>`,
    questionHtml: q => `<p class="oq-question">${escHtml(q.q)}</p>`,
    highlight: false,
  },
  situational: {
    label: '🎭 Xử lý tình huống', doneKey: 'prep-sit-done', data: () => window.SITUATIONAL_QUESTIONS || [],
    ask: 'Chọn cách xử lý tốt nhất:',
    optionHtml: o => `<span class="oq-otext">${escHtml(o)}</span>`,
    questionHtml: q => `<p class="oq-question">${escHtml(q.q)}</p>`,
    highlight: false,
  },
};

// ----- Chế độ 📡 API & HTTP (dùng engine makeQuiz) -----
const apiQuiz = makeQuiz({
  ...QUIZ_MODES.api, // data/doneKey/ask/optionHtml/questionHtml/highlight
  mode: 'api',
  bodyId: 'api-body',
  bestKey: 'prep-api-best',
  resultMsg: pct => pct >= 80 ? 'Nắm rất chắc HTTP/REST!' : pct >= 50 ? 'Khá ổn — ôn thêm vài status code & quy tắc.' : 'HTTP/API là phần hay bị hỏi — đọc kỹ giải thích nhé.',
});
function renderApiQuiz() { apiQuiz.render(); }

// ----- Chế độ 🗄️ SQL Drill (dùng engine makeQuiz) -----
const sqlQuiz = makeQuiz({
  ...QUIZ_MODES.sql, // kèm snippet SQL trong questionHtml + hljs
  mode: 'sql',
  bodyId: 'sql-body',
  bestKey: 'prep-sql-best',
  resultMsg: pct => pct >= 80 ? 'Rất chắc SQL — sẵn sàng cho vòng database!' : pct >= 50 ? 'Khá ổn — ôn thêm NULL, JOIN và isolation level.' : 'SQL là phần lõi khi phỏng vấn Backend — đọc kỹ giải thích từng câu nhé.',
});
function renderSqlQuiz() { sqlQuiz.render(); }

// ----- Chế độ 🖥️ CLI Quiz (dùng engine makeQuiz) -----
const cliQuiz = makeQuiz({
  ...QUIZ_MODES.cli, // kèm lệnh shell trong questionHtml + hljs
  mode: 'cli',
  bodyId: 'cli-body',
  bestKey: 'prep-cli-best',
  resultMsg: pct => pct >= 80 ? 'Thạo dòng lệnh — tự tin demo thao tác khi phỏng vấn!' : pct >= 50 ? 'Khá ổn — ôn thêm git reset/revert, kubectl rollout, SCAN vs KEYS.' : 'Lệnh CLI hay bị hỏi thực hành — đọc kỹ giải thích từng câu nhé.',
});
function renderCliQuiz() { cliQuiz.render(); }

/** Render nút đáp án theo thứ tự hiển thị NGẪU NHIÊN (chống học vẹt vị trí);
 *  data-i giữ CHỈ SỐ GỐC nên mọi hàm chấm phải so theo dataset.i, không theo vị trí DOM. */
function shuffledOptsHtml(q, inner, cls = 'oq-opt') {
  // Fisher–Yates: sort(random-0.5) lệch mạnh ở n≥3 (option hay ở lại vị trí cũ ~39% thay vì 25%)
  const k = [...q.options.keys()];
  for (let j = k.length - 1; j > 0; j--) { const r = Math.floor(Math.random() * (j + 1)); [k[j], k[r]] = [k[r], k[j]]; }
  return k.map(i => `<button class="${cls}" data-i="${i}">${inner(q.options[i])}</button>`).join('');
}

// ============ 🔁 ÔN CÂU SAI (gom câu trắc nghiệm chọn sai qua mọi mode) ============

/** Chủ đề của một câu trong hàng đợi ôn — bank không gắn topic (Anh/Tình huống) gom theo label mode. */
const reviewTopicOf = it => it.q.topic || QUIZ_MODES[it.mode].label;

/** Gom mọi câu sai còn tồn tại thành hàng đợi [{mode, q}] đã trộn thứ tự.
 *  topicFilter (tuỳ chọn): chỉ lấy câu thuộc chủ đề đó — phiên ôn tập trung chủ đề yếu. */
function buildReviewQueue(topicFilter) {
  const out = [];
  Object.keys(QUIZ_MODES).forEach(mode => {
    const byId = new Map((QUIZ_MODES[mode].data() || []).map(q => [String(q.id), q]));
    wrongIds(mode).forEach(id => { const q = byId.get(String(id)); if (q) out.push({ mode, q }); });
  });
  return shuffleArr(topicFilter ? out.filter(it => reviewTopicOf(it) === topicFilter) : out);
}

/** Gom mọi câu 📌 đã ghim còn tồn tại thành hàng đợi [{mode, q}] đã trộn thứ tự. */
function buildPinnedQueue() {
  const out = [];
  Object.keys(QUIZ_MODES).forEach(mode => {
    const byId = new Map((QUIZ_MODES[mode].data() || []).map(q => [String(q.id), q]));
    pinnedIds(mode).forEach(id => { const q = byId.get(String(id)); if (q) out.push({ mode, q }); });
  });
  return shuffleArr(out);
}

/** Bốc ngẫu nhiên tối đa n câu bất kỳ trên mọi mode trong QUIZ_MODES → phiên warm-up trộn. */
function buildMixedQueue(n) {
  const all = [];
  Object.keys(QUIZ_MODES).forEach(mode => {
    (QUIZ_MODES[mode].data() || []).forEach(q => all.push({ mode, q }));
  });
  return shuffleArr(all).slice(0, Math.max(1, n));
}

let reviewQueue = [], reviewIdx = 0, reviewRight = 0;
let reviewKind = 'wrong'; // 'wrong' | 'mixed' | 'pinned' — chỉnh lời chấm/kết thúc cho đúng ngữ cảnh phiên

/** Cập nhật badge số câu sai trên nút mode (gọi sau mỗi lần chấm). */
function refreshReviewBadge() {
  const el = document.getElementById('review-count');
  if (!el) return;
  const n = wrongTotal();
  el.hidden = n === 0;
  el.textContent = n ? String(n) : '';
}

/** Độ phủ của một mode quiz trong QUIZ_MODES: {done, total} (uỷ quyền bankCoverage). */
function coverageOf(mode) {
  const m = QUIZ_MODES[mode];
  return m ? bankCoverage(m.data(), m.doneKey) : { done: 0, total: 0 };
}

/** Hiện "đã đúng/tổng" trên nút mỗi mode trắc nghiệm; đầy đủ thì thêm ✓. */
function refreshCoverageBadges() {
  document.querySelectorAll('.think-cov[data-cov]').forEach(el => {
    const { done, total } = coverageOf(el.dataset.cov);
    el.hidden = total === 0;
    if (!total) return;
    el.textContent = done >= total ? `✓${done}/${total}` : `${done}/${total}`;
    el.classList.toggle('cov-full', done >= total);
  });
}

/** Gộp cập nhật mọi badge của tab Tư duy (câu sai + độ phủ). */
function refreshThinkBadges() { refreshReviewBadge(); refreshCoverageBadges(); }

function renderReview() {
  refreshReviewBadge();
  const el = document.getElementById('review-body');
  if (!el) return;
  // Nút warm-up trộn ngẫu nhiên — luôn hiện để mode này hữu ích cả khi chưa có câu sai.
  const mixBtn = '<button id="review-mix" class="dg-go dg-link">🎲 Ôn trộn nhanh 10 câu (mọi mode)</button>';
  // Nút ôn câu 📌 đã ghim — chỉ hiện khi có ghim (ghim ở ô giải thích sau khi chấm bất kỳ quiz nào).
  const pinN = pinnedTotal();
  const pinBtn = pinN ? `<button id="review-pinned" class="dg-go dg-link">📌 Ôn câu đã ghim (${pinN})</button>` : '';
  const bindExtra = () => {
    document.getElementById('review-mix').onclick = () => startMixed(10);
    const pb = document.getElementById('review-pinned');
    if (pb) pb.onclick = startPinned;
  };
  const q = buildReviewQueue();
  if (!q.length) {
    el.innerHTML = `<div class="oq-start review-empty">
      <p>🎉 Chưa có câu trắc nghiệm nào đang sai. Làm các quiz <b>Đoán output · API · SQL · CLI</b> hoặc vòng <b>Tiếng Anh · Tình huống</b> trong Phỏng vấn tổng hợp — câu nào chọn sai sẽ được gom về đây để ôn lại cho nhớ. Thấy câu nào đáng xem lại thì bấm <b>📌 Ghim</b> ở phần giải thích.</p>
      <div class="review-actions">${pinBtn}${mixBtn}</div>
    </div>`;
    bindExtra();
    return;
  }
  // đếm theo mode để hiện phân bố
  const byMode = {};
  q.forEach(it => { byMode[it.mode] = (byMode[it.mode] || 0) + 1; });
  const chips = Object.keys(byMode).map(m => `<span class="review-chip">${QUIZ_MODES[m].label}: <b>${byMode[m]}</b></span>`).join('');
  // 📉 đếm theo chủ đề: câu sai dồn cụm ở đâu → bấm chip để ôn RIÊNG chủ đề đó
  const byTopic = {};
  q.forEach(it => { const t = reviewTopicOf(it); byTopic[t] = (byTopic[t] || 0) + 1; });
  const topics = Object.entries(byTopic).sort((a, b) => b[1] - a[1]);
  const topicChips = topics.length >= 2
    ? `<div class="review-topics"><span class="rt-label">📉 Ôn riêng chủ đề yếu:</span>${topics.slice(0, 8).map(([t, n]) =>
        `<button class="review-chip rt-chip" data-topic="${escHtml(t)}">${escHtml(t)} <b>×${n}</b></button>`).join('')}</div>`
    : '';
  el.innerHTML = `
    <div class="oq-start">
      <p>Đang có <b>${q.length}</b> câu cần ôn lại.</p>
      <div class="review-chips">${chips}</div>
      ${topicChips}
      <div class="review-actions">
        <button id="review-go" class="dg-go">▶ Ôn ngay (${q.length} câu, trộn thứ tự)</button>
        ${pinBtn}${mixBtn}
      </div>
    </div>`;
  document.getElementById('review-go').onclick = startReview;
  el.querySelectorAll('.rt-chip').forEach(b => b.onclick = () => startReview(b.dataset.topic));
  bindExtra();
}

function startReview(topic) {
  // Chip chủ đề truyền string; nút "Ôn ngay"/"Ôn tiếp" gắn thẳng handler nên arg là MouseEvent — bỏ qua.
  const topicFilter = typeof topic === 'string' ? topic : undefined;
  reviewQueue = buildReviewQueue(topicFilter);
  reviewIdx = 0; reviewRight = 0; reviewKind = 'wrong';
  if (!reviewQueue.length) return renderReview();
  showReview();
}

/** Phiên warm-up: n câu bất kỳ trộn mọi mode (dùng chung engine review). */
function startMixed(n) {
  reviewQueue = buildMixedQueue(n);
  reviewIdx = 0; reviewRight = 0; reviewKind = 'mixed';
  if (!reviewQueue.length) return renderReview();
  showReview();
}

/** Phiên ôn câu 📌 đã ghim (dùng chung engine review; chấm đúng KHÔNG gỡ ghim). */
function startPinned() {
  reviewQueue = buildPinnedQueue();
  reviewIdx = 0; reviewRight = 0; reviewKind = 'pinned';
  if (!reviewQueue.length) return renderReview();
  showReview();
}

function showReview() {
  const item = reviewQueue[reviewIdx];
  const el = document.getElementById('review-body');
  if (!el) return;
  if (!item) return finishReview();
  const cfg = QUIZ_MODES[item.mode], q = item.q;
  const opts = shuffledOptsHtml(q, cfg.optionHtml);
  el.innerHTML = `
    <div class="oq-quiz">
      <div class="oq-bar"><span>Câu ${reviewIdx + 1}/${reviewQueue.length} · ✓ ${reviewRight}</span><span class="oq-topic">${cfg.label}${q.topic ? ' · ' + escHtml(q.topic) : ''}</span></div>
      <div class="oq-ask">${cfg.ask}</div>
      ${cfg.questionHtml(q)}
      <div class="oq-opts">${opts}</div>
      <div id="review-fb" class="oq-fb" hidden></div>
    </div>`;
  if (cfg.highlight && window.hljs) el.querySelectorAll('pre code').forEach(c => { try { hljs.highlightElement(c); } catch { /* bỏ qua */ } });
  el.querySelectorAll('.oq-opt').forEach(b => b.onclick = () => answerReview(+b.dataset.i));
}

function answerReview(i) {
  const item = reviewQueue[reviewIdx];
  const cfg = QUIZ_MODES[item.mode], q = item.q;
  const el = document.getElementById('review-body');
  const correct = i === q.answer;
  el.querySelectorAll('.oq-opt').forEach(b => { b.disabled = true; const oi = +b.dataset.i; if (oi === q.answer) b.classList.add('right'); else if (oi === i) b.classList.add('wrong'); });
  if (correct) {
    reviewRight++;
    clearWrong(item.mode, q.id);            // đã nhớ → rời hàng đợi
    const d = store.get(cfg.doneKey, {}); d[q.id] = true; store.set(cfg.doneKey, d);
  } else {
    recordWrong(item.mode, q.id);           // vẫn sai → giữ lại (làm mới timestamp)
  }
  logActivity();
  refreshThinkBadges();
  const fb = document.getElementById('review-fb');
  fb.hidden = false;
  // Lời chấm theo loại phiên: chỉ phiên câu-sai mới nói chuyện "rời/giữ hàng đợi";
  // phiên 🎲/📌 câu sai vẫn recordWrong nên nhắc là đã đưa vào 🔁.
  const okText = reviewKind === 'wrong' ? '✅ Chính xác! Câu này rời hàng đợi.' : '✅ Chính xác!';
  const noText = reviewKind === 'wrong' ? '❌ Chưa đúng — giữ lại ôn tiếp.' : '❌ Chưa đúng — đã đưa vào hàng đợi 🔁 ôn lại.';
  fb.innerHTML = `<div class="oq-verdict ${correct ? 'ok' : 'no'}">${correct ? okText : noText}</div>
    <p class="oq-explain">${escHtml(q.explain)}</p>
    <div class="oq-fb-actions">${pinBtnHtml(item.mode, q.id)}
    <button id="review-next" class="dg-go">${reviewIdx + 1 < reviewQueue.length ? 'Câu tiếp →' : 'Xem kết quả'}</button></div>`;
  bindPinBtns(fb);
  document.getElementById('review-next').onclick = () => { reviewIdx++; showReview(); };
  fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function finishReview() {
  const total = reviewQueue.length;
  const pct = total ? Math.round(reviewRight / total * 100) : 0;
  const left = wrongTotal();
  const el = document.getElementById('review-body');
  // Câu chốt + nút "làm nữa" theo loại phiên — phiên 📌/🎲 không nói chuyện "sạch hàng đợi sai"
  const leftNote = left ? `Câu chưa đúng đã nằm trong hàng đợi 🔁 (<b>${left}</b> câu).` : '';
  const kinds = {
    wrong: {
      p: left === 0 ? '🎉 Sạch hàng đợi — không còn câu nào sai!' : `Còn <b>${left}</b> câu cần ôn tiếp. Cứ ôn lại cho tới khi nhớ hẳn nhé.`,
      btn: left ? '↻ Ôn tiếp câu còn sai' : '↻ Ôn lại', act: () => (left ? startReview() : renderReview()),
    },
    pinned: {
      p: `📌 Ghim vẫn giữ nguyên — muốn gỡ thì bấm nút 📌 ở phần giải thích. ${leftNote}`,
      btn: '↻ Ôn câu ghim lại', act: startPinned,
    },
    mixed: {
      p: leftNote || 'Không phát sinh câu sai nào — quá ổn!',
      btn: '🎲 Trộn 10 câu khác', act: () => startMixed(10),
    },
  };
  const k = kinds[reviewKind] || kinds.wrong;
  el.innerHTML = `
    <div class="oq-result">
      <h2>${pct >= 80 ? '🌟' : pct >= 50 ? '👍' : '📚'} Ôn xong: đúng ${reviewRight}/${total} (${pct}%)</h2>
      <p>${k.p}</p>
      <button id="review-again" class="dg-go">${k.btn}</button>
    </div>`;
  document.getElementById('review-again').onclick = k.act;
}

// ============ 🎓 THI THỬ (bài kiểm tra tổng hợp có tính giờ) ============
// Khác các quiz luyện: không hiện đúng/sai giữa chừng, nộp xong mới chấm — mô phỏng screening test.
// Đồng hồ tính theo DEADLINE (examEndMs) chứ không đếm tick, nên rời tab/đổi mode không câu giờ được.

let examQueue = [], examIdx = 0, examAnswers = [];
let examEndMs = 0, examDurSec = 0, examTimerId = null;
let examShownAt = 0; // lúc render câu hiện tại — chặn double-click/gõ phím kép "trả lời chui" câu kế

const examHistory = () => store.get('prep-exam-history', []);
const examRunning = () => examEndMs > 0 && examIdx < examQueue.length;

// Bài thi DỞ sống sót qua reload — F5 không còn là lối thoát án hết giờ (deadline giữ nguyên).
// CHỦ Ý ngoài PREP_KEYS: bài đang thi là của riêng thiết bị, không sync/export/import;
// nhưng reset dữ liệu thì phải xoá kèm (xem dash-reset).
const EXAM_STATE_KEY = 'prep-exam-state';

function saveExamState() {
  if (!examEndMs) return;
  store.set(EXAM_STATE_KEY, {
    endMs: examEndMs, durSec: examDurSec, sprint: examSprint, idx: examIdx,
    answers: examAnswers, // chỉ chứa các câu đã qua (đáp án hoặc null-bỏ-qua) → JSON không phá undefined
    items: examQueue.map(it => ({ m: it.mode, id: it.q.id })),
  });
}
const clearExamState = () => localStorage.removeItem(EXAM_STATE_KEY);

/** Copy văn bản vào clipboard; fallback textarea+execCommand cho trình duyệt cũ. true nếu thành công. */
async function copyText(txt) {
  try { await navigator.clipboard.writeText(txt); return true; } catch { /* thử fallback */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch { return false; }
}

/** Tóm tắt một lần thi thành văn bản chia sẻ được (pure — dễ test). h cần {d,n,right,pct,secs,timeout,sprint,modes}. */
function examResultText(h) {
  const parts = Object.keys(h.modes || {}).map(m =>
    `${QUIZ_MODES[m] ? QUIZ_MODES[m].label : m}: ${h.modes[m].right}/${h.modes[m].total}`);
  return `🎓 Thi thử Backend Interview${h.sprint ? ' (🔥 nước rút)' : ''} — ${new Date(h.d).toLocaleDateString('vi-VN')}\n` +
    `Kết quả: ${h.right}/${h.n} (${h.pct}%) · ⏱ ${fmtClock(h.secs)}${h.timeout ? ' · hết giờ' : ''}\n` +
    parts.join(' · ');
}

/** Dựng lại bài dở từ localStorage (sau reload). true nếu khôi phục được. */
function restoreExamState() {
  const s = store.get(EXAM_STATE_KEY, null);
  if (!s || !s.endMs || !Array.isArray(s.items) || !s.items.length) return false;
  const q = [];
  for (const it of s.items) {
    const cfg = QUIZ_MODES[it.m];
    const found = cfg && (cfg.data() || []).find(x => String(x.id) === String(it.id));
    if (!found) { clearExamState(); return false; } // bank đổi sau deploy → bỏ bài dở, không chấm lệch đề
    q.push({ mode: it.m, q: found });
  }
  examQueue = q;
  examIdx = Math.min(s.idx || 0, q.length);
  examAnswers = Array.isArray(s.answers) ? s.answers : [];
  examDurSec = s.durSec || 0;
  examEndMs = s.endMs;
  examSprint = !!s.sprint;
  return true; // quá hạn thì showExamQ → tickExam tự nộp ngay như bài bỏ dở thường
}

/** Bốc n câu XEN KẼ ĐỀU mọi mode trong QUIZ_MODES (mỗi bank đã trộn) → đề phủ rộng, không dồn một mảng. */
function buildExamQueue(n) {
  const banks = shuffleArr(Object.keys(QUIZ_MODES))
    .map(mode => ({ mode, qs: shuffleArr(QUIZ_MODES[mode].data() || []) }))
    .filter(b => b.qs.length);
  const out = [];
  for (let round = 0; out.length < n && banks.some(b => round < b.qs.length); round++) {
    for (const b of banks) {
      if (out.length >= n) break;
      if (round < b.qs.length) out.push({ mode: b.mode, q: b.qs[round] });
    }
  }
  return shuffleArr(out);
}

/** Đề 🔥 nước rút: chia n câu theo ĐỘ YẾU từng mảng (độ phủ thấp + nhiều câu đang sai);
 *  trong mỗi mảng ưu tiên câu đang sai → chưa từng đúng → còn lại. Điền slot kiểu
 *  chia ghế theo trọng số: mỗi vòng lấy từ mảng có chi phí (đã lấy + 1)/độ yếu nhỏ nhất. */
function buildSprintExamQueue(n) {
  const banks = Object.keys(QUIZ_MODES).map(mode => {
    const cfg = QUIZ_MODES[mode];
    const data = cfg.data() || [];
    if (!data.length) return null;
    const done = store.get(cfg.doneKey, {});
    const wrongSet = new Set(wrongIds(mode).map(String));
    const qs = [
      ...shuffleArr(data.filter(q => wrongSet.has(String(q.id)))),
      ...shuffleArr(data.filter(q => !wrongSet.has(String(q.id)) && !done[q.id])),
      ...shuffleArr(data.filter(q => !wrongSet.has(String(q.id)) && done[q.id])),
    ];
    const cov = bankCoverage(data, cfg.doneKey);
    // 0.1 nền để mảng đã vững vẫn thi thoảng góp mặt (không bao giờ chia cho 0)
    const weak = 0.1 + (1 - cov.done / cov.total) + wrongSet.size / cov.total;
    return { mode, qs, weak };
  }).filter(Boolean);
  const out = [], taken = new Map(banks.map(b => [b.mode, 0]));
  while (out.length < n) {
    const avail = banks.filter(b => taken.get(b.mode) < b.qs.length);
    if (!avail.length) break;
    const b = avail.reduce((best, cur) =>
      (taken.get(cur.mode) + 1) / cur.weak < (taken.get(best.mode) + 1) / best.weak ? cur : best);
    out.push({ mode: b.mode, q: b.qs[taken.get(b.mode)] });
    taken.set(b.mode, taken.get(b.mode) + 1);
  }
  return shuffleArr(out);
}

function renderExam() {
  const el = document.getElementById('exam-body');
  if (!el) return;
  if (!examRunning()) restoreExamState(); // sau reload: dựng lại bài dở đã lưu (nếu có)
  if (examRunning()) return showExamQ(); // đang dở bài (vd vừa quay lại tab) → hiện tiếp câu hiện tại
  const hist = examHistory();
  const best = hist.length ? Math.max(...hist.map(h => h.pct)) : 0;
  const rows = hist.slice(-5).reverse().map(h =>
    `<li>${h.pct >= 80 ? '🌟' : h.pct >= 50 ? '👍' : '📚'} ${h.sprint ? '🔥 ' : ''}<b>${h.right}/${h.n}</b> (${h.pct}%) · ${fmtClock(h.secs)}${h.timeout ? ' · ⏰ hết giờ' : ''}</li>`).join('');
  el.innerHTML = `
    <div class="oq-start">
      ${hist.length ? `<p>Đã thi <b>${hist.length}</b> lần · điểm cao nhất <b>${best}%</b>.</p><ul class="exam-hist">${rows}</ul>` : '<p>Chưa thi lần nào — làm một đề để biết mình đang ở đâu nhé.</p>'}
      <div class="review-actions">
        <button id="exam-go-20" class="dg-go">🎓 Thi 20 câu · 15 phút</button>
        <button id="exam-go-10" class="dg-go dg-link">⚡ Thi nhanh 10 câu · 7 phút</button>
        <button id="exam-go-sprint" class="dg-go dg-link" title="Chia câu theo độ yếu từng mảng: độ phủ thấp + đang sai nhiều được hỏi nhiều hơn; ưu tiên câu đang sai và câu chưa từng làm đúng">🔥 Nước rút 15 câu · 10 phút — dồn vào mảng yếu</button>
      </div>
    </div>`;
  document.getElementById('exam-go-20').onclick = () => startExam(20, 15);
  document.getElementById('exam-go-10').onclick = () => startExam(10, 7);
  document.getElementById('exam-go-sprint').onclick = () => startExam(15, 10, true);
}

let examSprint = false; // đề đang thi có phải nước rút không (ghi vào lịch sử lúc nộp)
function startExam(n, mins, sprint) {
  examSprint = !!sprint;
  examQueue = sprint ? buildSprintExamQueue(n) : buildExamQueue(n);
  if (!examQueue.length) { renderExam(); return; }
  examIdx = 0; examAnswers = [];
  examDurSec = mins * 60;
  examEndMs = Date.now() + examDurSec * 1000;
  saveExamState();
  showExamQ();
}

const fmtClock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function tickExam() {
  const left = Math.max(0, Math.round((examEndMs - Date.now()) / 1000));
  const el = document.getElementById('exam-clock');
  if (el) { el.textContent = `⏱ ${fmtClock(left)}`; el.classList.toggle('low', left <= 60); }
  if (left <= 0) finishExam(true);
}

function showExamQ() {
  const el = document.getElementById('exam-body');
  if (!el) return;
  const item = examQueue[examIdx];
  if (!item) return finishExam(false);
  const cfg = QUIZ_MODES[item.mode], q = item.q;
  el.innerHTML = `
    <div class="oq-quiz">
      <div class="oq-bar"><span>Câu ${examIdx + 1}/${examQueue.length}</span><span id="exam-clock" class="iqt-timer">⏱ …</span><span class="oq-topic">${cfg.label}</span></div>
      <div class="oq-ask">${cfg.ask}</div>
      ${cfg.questionHtml(q)}
      <div class="oq-opts">${shuffledOptsHtml(q, cfg.optionHtml)}</div>
      <p class="exam-note">Chọn đáp án là <b>qua câu luôn</b> (không hiện đúng/sai — như thi thật). <button id="exam-skip" class="exam-skip" type="button">⏭ Bỏ qua câu này</button></p>
    </div>`;
  if (cfg.highlight && window.hljs) el.querySelectorAll('pre code').forEach(c => { try { hljs.highlightElement(c); } catch { /* bỏ qua */ } });
  el.querySelectorAll('.oq-opt').forEach(b => b.onclick = () => answerExam(+b.dataset.i));
  document.getElementById('exam-skip').onclick = () => answerExam(null);
  examShownAt = Date.now();
  clearInterval(examTimerId);
  tickExam();
  if (examRunning()) examTimerId = setInterval(tickExam, 1000);
}

function answerExam(i) {
  // Exam là chỗ duy nhất "chọn là qua câu luôn": cú click thứ 2 của double-click (hoặc gõ phím kép)
  // sẽ rơi trúng nút CÙNG VỊ TRÍ của câu vừa render → trả lời câu chưa kịp đọc. Nuốt input quá sớm.
  if (Date.now() - examShownAt < 300) return;
  examAnswers[examIdx] = i;
  examIdx++;
  if (examIdx >= examQueue.length) { finishExam(false); return; }
  saveExamState();
  showExamQ();
}

function finishExam(timedOut) {
  clearInterval(examTimerId); examTimerId = null;
  const total = examQueue.length;
  if (!total || !examEndMs) { examEndMs = 0; return; } // gọi trùng (tick + answer) → chỉ chấm 1 lần
  const secs = Math.min(examDurSec, Math.max(0, examDurSec - Math.round((examEndMs - Date.now()) / 1000)));
  examEndMs = 0;
  clearExamState(); // bài đã nộp — không còn gì để khôi phục sau reload
  // Chấm cả bài: đúng → tính độ phủ + rời hàng đợi sai; sai/bỏ qua/chưa tới → vào hàng đợi 🔁
  let right = 0, skipped = 0;
  const wrongItems = [];
  const byMode = {};
  examQueue.forEach((item, idx) => {
    const picked = examAnswers[idx];
    const ok = picked === item.q.answer;
    byMode[item.mode] = byMode[item.mode] || { right: 0, total: 0 };
    byMode[item.mode].total++;
    if (ok) {
      right++; byMode[item.mode].right++;
      clearWrong(item.mode, item.q.id);
      const d = store.get(QUIZ_MODES[item.mode].doneKey, {}); d[item.q.id] = true; store.set(QUIZ_MODES[item.mode].doneKey, d);
    } else {
      if (picked == null) skipped++;
      // Bài bỏ dở quá hạn: câu CHƯA TỪNG HIỂN THỊ (idx > examIdx) chỉ trượt điểm,
      // không đổ vào hàng đợi 🔁 — "sai" một câu chưa nhìn thấy là dữ liệu ôn tập giả.
      if (idx <= examIdx) recordWrong(item.mode, item.q.id);
      wrongItems.push({ item, picked });
    }
  });
  const pct = Math.round(right / total * 100);
  const hist = examHistory();
  // modes: phân bố đúng/tổng theo mảng — nguồn cho đồ thị trend từng mảng & nút copy chia sẻ
  const entry = { d: Date.now(), n: total, right, pct, secs, timeout: !!timedOut, sprint: examSprint, modes: byMode };
  hist.push(entry);
  store.set('prep-exam-history', hist.slice(-30));
  logActivity();
  refreshThinkBadges();
  const el = document.getElementById('exam-body');
  if (!el) return; // nộp ngầm khi đang ở tab khác (hết giờ) → điểm đã lưu, quay lại thấy màn hình bắt đầu
  const chips = Object.keys(byMode).map(m => `<span class="review-chip">${QUIZ_MODES[m].label}: <b>${byMode[m].right}/${byMode[m].total}</b></span>`).join('');
  const wrongHtml = wrongItems.map(({ item, picked }) => {
    const cfg = QUIZ_MODES[item.mode], q = item.q;
    return `<div class="exam-wrong">
      <div class="oq-topic">${cfg.label}${q.topic ? ' · ' + escHtml(q.topic) : ''}${picked === null ? ' · ⏭ đã bỏ qua' : picked === undefined ? ' · ⏳ chưa làm tới' : ''}</div>
      ${cfg.questionHtml(q)}
      ${picked != null ? `<div class="exam-picked">❌ Bạn chọn: ${cfg.optionHtml(q.options[picked])}</div>` : ''}
      <div class="exam-right">✅ Đáp án đúng: ${cfg.optionHtml(q.options[q.answer])}</div>
      <p class="oq-explain">${escHtml(q.explain)}</p>
      <div class="oq-fb-actions">${pinBtnHtml(item.mode, q.id)}</div>
    </div>`;
  }).join('');
  el.innerHTML = `
    <div class="oq-result">
      <h2>${pct >= 80 ? '🌟' : pct >= 50 ? '👍' : '📚'} ${timedOut ? '⏰ Hết giờ! ' : ''}${examSprint ? '🔥 Nước rút — ' : ''}Kết quả: đúng ${right}/${total} (${pct}%)</h2>
      <p>Thời gian: <b>${fmtClock(secs)}</b>/${fmtClock(examDurSec)}${skipped ? ` · bỏ qua <b>${skipped}</b> câu` : ''}${wrongItems.length ? ` · <b>${wrongItems.length}</b> câu chưa đúng đã vào hàng đợi 🔁 Ôn câu sai.` : ' · Không sai câu nào — quá đỉnh! 🎉'}</p>
      <div class="review-chips">${chips}</div>
      <div class="review-actions">
        <button id="exam-again" class="dg-go">↻ Thi đề khác</button>
        ${wrongItems.length ? '<button id="exam-review" class="dg-go dg-link">🔁 Ôn ngay câu sai</button>' : ''}
        <button id="exam-copy" class="dg-go dg-link" title="Copy tóm tắt điểm + phân bố theo mảng để chia sẻ">📋 Copy kết quả</button>
      </div>
      ${wrongItems.length ? `<h3 class="exam-wrong-h">Xem lại ${wrongItems.length} câu chưa đúng</h3>${wrongHtml}` : ''}
    </div>`;
  if (window.hljs) el.querySelectorAll('.exam-wrong pre code').forEach(c => { try { hljs.highlightElement(c); } catch { /* bỏ qua */ } });
  bindPinBtns(el);
  document.getElementById('exam-again').onclick = renderExam;
  const rv = document.getElementById('exam-review');
  if (rv) rv.onclick = () => setThinkMode('review');
  const cp = document.getElementById('exam-copy');
  cp.onclick = () => copyText(examResultText(entry)).then(ok => { cp.textContent = ok ? '✅ Đã copy' : '❌ Không copy được'; });
}

// ============ 🌟 STAR BUILDER (soạn câu trả lời phỏng vấn hành vi) ============
// Khung STAR: Situation · Task · Action · Result. Công cụ soạn + tự chấm checklist + AI góp ý.
let starState = null; // { q } khi đang mở một câu để soạn
const starQs = () => window.STAR_QUESTIONS || [];
const starDraftsAll = () => store.get('prep-star-drafts', {});
/** get/set nháp {s,t,a,r} theo id câu hỏi. */
function starDraft(id, val) {
  const all = starDraftsAll();
  if (val === undefined) return all[id] || { s: '', t: '', a: '', r: '' };
  all[id] = val; store.set('prep-star-drafts', all);
}
const starHistory = () => store.get('prep-star-history', []);
const starHasStory = d => { const v = (d.s || '') + (d.t || '') + (d.a || '') + (d.r || ''); return v.trim().length > 0; };
const starDone = d => !!(d.s && d.t && d.a && d.r && (d.s + d.t + d.a + d.r).trim().length >= 80);

/** Đánh giá nháp STAR bằng checklist tất định (KHÔNG cần AI). Pure → dễ test. */
function starEvalDraft(d) {
  const s = (d.s || '').trim(), t = (d.t || '').trim(), a = (d.a || '').trim(), r = (d.r || '').trim();
  const total = s.length + t.length + a.length + r.length;
  const items = [
    { k: 'context', label: 'Bối cảnh rõ ràng (Situation + Task)', ok: s.length >= 15 && t.length >= 15 },
    { k: 'action', label: 'Hành động cụ thể, đủ chi tiết (Action)', ok: a.length >= 40 },
    { k: 'result', label: 'Có nêu kết quả (Result)', ok: r.length >= 15 },
    { k: 'metric', label: 'Kết quả ĐỊNH LƯỢNG (có con số đo được)', ok: /\d/.test(r) },
    { k: 'personal', label: 'Dùng "tôi/mình" — nêu rõ vai trò CÁ NHÂN', ok: /(tôi|mình)/i.test(a) },
    { k: 'concise', label: 'Gọn gàng, không lan man (≤ ~1600 ký tự)', ok: total > 0 && total <= 1600 },
  ];
  const coverage = Math.round(items.filter(i => i.ok).length / items.length * 100);
  return { items, coverage, total };
}

function renderStar() {
  if (starState) renderStarSession(); else renderStarList();
}

function renderStarList() {
  const qs = starQs();
  const el = document.getElementById('star-body');
  if (!el) return;
  if (!qs.length) { el.innerHTML = '<p>Chưa nạp được ngân hàng câu hỏi hành vi.</p>'; return; }
  const drafts = starDraftsAll();
  const builtN = qs.filter(q => starDone(drafts[q.id] || {})).length;
  // nhóm theo competency
  const groups = {};
  qs.forEach(q => { (groups[q.competency] = groups[q.competency] || []).push(q); });
  const cards = Object.keys(groups).map(comp => {
    const items = groups[comp].map(q => {
      const d = drafts[q.id] || {};
      const badge = starDone(d) ? '<span class="star-done">✓ đã soạn</span>'
        : starHasStory(d) ? '<span class="star-draft">✎ nháp dở</span>' : '';
      return `<button class="star-q" data-id="${escHtml(q.id)}">
        <span class="star-q-text">${escHtml(q.q)}</span>${badge}</button>`;
    }).join('');
    return `<div class="star-group"><h3>${escHtml(comp)}</h3>${items}</div>`;
  }).join('');
  el.innerHTML = `
    <h1>🌟 STAR Builder — luyện câu trả lời phỏng vấn hành vi</h1>
    <p class="coding-intro">Câu hỏi behavioral ("Kể về một lần…") hầu như buổi phỏng vấn nào cũng có. Soạn sẵn câu trả lời theo khung <b>STAR</b>: <b>S</b>ituation (bối cảnh) · <b>T</b>ask (nhiệm vụ) · <b>A</b>ction (hành động của BẠN) · <b>R</b>esult (kết quả, nên có số). Soạn rồi <b>tự chấm theo checklist</b> hoặc nhờ <b>Claude góp ý</b> (cần API key). Nháp tự lưu để bạn xây dần "kho chuyện" của mình.</p>
    <p class="star-count">📚 Đã soạn hoàn chỉnh: <b>${builtN}/${qs.length}</b> câu chuyện.</p>
    ${cards}
    ${englishPhrasesHtml()}`;
  el.querySelectorAll('.star-q').forEach(b => b.onclick = () => openStar(b.dataset.id));
  bindEnglishPhraseAudio(el);
  // Warm danh sách voice sớm (Chrome trả [] cho getVoices() lần gọi đầu) để click 🔊 đầu tiên đã có voice en.
  try { if (window.speechSynthesis) speechSynthesis.getVoices(); } catch { /* không hỗ trợ TTS */ }
}

/** Gắn nút 🔊 nghe từng câu + ▶️ nghe cả nhóm cho accordion mẫu câu tiếng Anh. */
function bindEnglishPhraseAudio(root) {
  const groups = window.ENGLISH_PHRASES || [];
  root.querySelectorAll('.ep-say').forEach(b => b.onclick = () => {
    const it = (groups[+b.dataset.g] || { items: [] }).items[+b.dataset.i];
    if (it) speak(it.en);
  });
  root.querySelectorAll('.ep-sayall').forEach(b => b.onclick = () => {
    const g = groups[+b.dataset.g];
    if (g) speakList(g.items.map(it => it.en));
  });
}

/** Accordion "Mẫu câu tiếng Anh khi phỏng vấn" — tham khảo, hiển thị cuối danh sách STAR. */
function englishPhrasesHtml() {
  const groups = window.ENGLISH_PHRASES || [];
  if (!groups.length) return '';
  const cards = groups.map((g, gi) => {
    const items = g.items.map((it, ii) =>
      `<li><span class="ep-en">${escHtml(it.en)}<button class="ep-say" data-g="${gi}" data-i="${ii}" title="Nghe câu này" aria-label="Nghe câu này">🔊</button></span><span class="ep-vi">🇻🇳 ${escHtml(it.vi)}</span></li>`).join('');
    return `<details class="rq-group">
      <summary>${g.icon} ${escHtml(g.group)} <span class="rq-n">${g.items.length}</span></summary>
      <button class="ep-sayall" data-g="${gi}">▶️ Nghe cả nhóm — nghe rồi nhắc lại (shadowing)</button>
      <ul class="rq-list ep-list">${items}</ul>
    </details>`;
  }).join('');
  return `<div class="rq-wrap ep-wrap">
    <h3>🇬🇧 Mẫu câu tiếng Anh khi phỏng vấn</h3>
    <p class="iq-note">Nếu phỏng vấn (một phần) bằng tiếng Anh: các mẫu câu tự nhiên để giới thiệu bản thân, kể chuyện STAR, mua thời gian suy nghĩ, làm rõ yêu cầu và kết thúc. Bấm từng nhóm để mở.</p>
    ${cards}
  </div>`;
}

function openStar(id) {
  const q = starQs().find(x => x.id === id);
  if (!q) return;
  // Đang phát "nghe cả nhóm" mà mở phiên soạn STAR thì dừng đọc — audio không còn ngữ cảnh.
  try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch { /* không hỗ trợ TTS */ }
  stopDictation(); // micro đang gắn vào ô của câu cũ — DOM sắp bị thay
  starState = { q };
  renderStarSession();
}

function renderStarSession() {
  const { q } = starState;
  const el = document.getElementById('star-body');
  const d = starDraft(q.id);
  const field = (k, label, hint) => `
    <div class="star-field">
      <span class="star-flabel">${label} <span class="star-fhint">${escHtml(hint)}</span>
        <button class="dict-btn star-dict" data-k="${k}" data-rec="🔴 Dừng" type="button" title="Nói để điền ô này" hidden>🎙️</button></span>
      <textarea class="star-ta" data-k="${k}" rows="3" placeholder="${escHtml(hint)}">${escHtml(d[k] || '')}</textarea>
    </div>`;
  el.innerHTML = `
    <div class="star-sess">
      <button id="star-back" class="dg-link">← Danh sách câu hỏi</button>
      <div class="star-comp">${escHtml(q.competency)}</div>
      <h1>${escHtml(q.q)}</h1>
      ${q.watchout ? `<div class="star-watch">⚠️ <b>Lưu ý:</b> ${escHtml(q.watchout)}</div>` : ''}
      ${field('s', 'S — Situation (bối cảnh)', q.hints.s)}
      ${field('t', 'T — Task (nhiệm vụ)', q.hints.t)}
      ${field('a', 'A — Action (hành động của BẠN)', q.hints.a)}
      ${field('r', 'R — Result (kết quả)', q.hints.r)}
      <div class="dg-actions">
        <button id="star-score" class="dg-go">✅ Tự chấm checklist</button>
        <button id="star-ai-toggle" class="dg-go dg-go-ai">🤖 Nhờ Claude góp ý</button>
        <button id="star-dict-lang" class="dict-lang" type="button" title="Ngôn ngữ nói-để-điền" hidden></button>
      </div>
      <div id="star-check" class="star-check"></div>
      <div id="star-ai" class="dg-ai" hidden></div>
    </div>`;

  // read() trả null nếu các ô đã bị gỡ khỏi DOM (đã rời session) — tránh ghi đè nháp bằng {} rỗng.
  const read = () => {
    const tas = el.querySelectorAll('.star-ta');
    if (!tas.length) return null;
    const v = {};
    tas.forEach(ta => { v[ta.dataset.k] = ta.value; });
    return v;
  };
  const save = () => { const v = read(); if (v) starDraft(q.id, v); };
  let saveT;
  el.querySelectorAll('.star-ta').forEach(ta => ta.addEventListener('input', () => {
    clearTimeout(saveT); saveT = setTimeout(save, 500);
    renderStarCheck(read() || d, false); // cập nhật checklist trực tiếp (không lưu history)
  }));
  // 🎙️ nói-để-điền từng ô S/T/A/R — transcript bắn event 'input' nên autosave/checklist chạy như gõ tay
  let starDictOk = false;
  el.querySelectorAll('.star-dict').forEach(b => {
    starDictOk = bindDictation(b, el.querySelector(`.star-ta[data-k="${b.dataset.k}"]`)) || starDictOk;
  });
  bindDictLang(document.getElementById('star-dict-lang'), starDictOk);
  // clearTimeout khi rời session: nếu không, debounce treo sẽ fire sau renderStarList → read()=null nhưng vẫn an toàn nhờ guard.
  document.getElementById('star-back').onclick = () => { clearTimeout(saveT); save(); stopDictation(); starState = null; renderStarList(); };
  document.getElementById('star-score').onclick = () => { save(); renderStarCheck(read() || d, true); };
  document.getElementById('star-ai-toggle').onclick = () => starRenderAiPanel(q, read);
  renderStarCheck(d, false);
}

/** Vẽ checklist; save=true thì ghi lịch sử + logActivity. */
function renderStarCheck(draft, save) {
  const box = document.getElementById('star-check');
  if (!box) return;
  const { items, coverage } = starEvalDraft(draft);
  const rows = items.map(i => `<li class="${i.ok ? 'star-ok' : 'star-no'}">${i.ok ? '✅' : '⬜'} ${escHtml(i.label)}</li>`).join('');
  const band = coverage >= 80 ? '🌟 Rất chắc' : coverage >= 50 ? '👍 Khá ổn' : '📝 Cần bổ sung';
  box.innerHTML = `<div class="star-cov">Độ đầy đủ: <b>${coverage}%</b> · ${band}</div><ul class="star-list">${rows}</ul>`;
  if (save) {
    const q = starState && starState.q;
    if (q) {
      const hist = starHistory();
      hist.push({ id: q.id, date: new Date().toISOString().slice(0, 10), ts: Date.now(), coverage });
      store.set('prep-star-history', hist.slice(-100));
    }
    logActivity();
  }
}

/** Panel AI góp ý — tái dùng aiGradeSingle (chung key prep-ai-key với Mock/Design).
 * getDraft là HÀM đọc nháp tươi từ DOM lúc bấm chấm (không đóng băng lúc mở panel). */
function starRenderAiPanel(q, getDraft) {
  const box = document.getElementById('star-ai');
  if (!box) return;
  if (!box.hidden) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = `
    <div class="dg-ai-cfg">
      <input id="star-aikey" type="password" class="ai-key-input" placeholder="Anthropic API key (sk-ant-…)" />
      <select id="star-aimodel" class="ai-model-sel">
        <option value="claude-opus-4-8">Opus 4.8 (kỹ nhất)</option>
        <option value="claude-sonnet-4-6">Sonnet 4.6 (cân bằng)</option>
        <option value="claude-haiku-4-5-20251001">Haiku 4.5 (nhanh/rẻ)</option>
      </select>
      <button id="star-aigo" class="dg-go">Gửi chấm</button>
    </div>
    <div id="star-aiout" class="dg-ai-out"></div>`;
  const keyEl = document.getElementById('star-aikey');
  keyEl.value = store.get('prep-ai-key', '');
  document.getElementById('star-aigo').onclick = () =>
    starAiGrade(q, getDraft() || starDraft(q.id), keyEl.value, document.getElementById('star-aimodel').value);
}

function starAiGrade(q, draft, key, model) {
  const out = document.getElementById('star-aiout');
  if (!key) { out.innerHTML = '<p class="ai-err">Cần nhập API key để chấm.</p>'; return; }
  store.set('prep-ai-key', key);
  const answer = `S (bối cảnh): ${draft.s || '(trống)'}\nT (nhiệm vụ): ${draft.t || '(trống)'}\nA (hành động): ${draft.a || '(trống)'}\nR (kết quả): ${draft.r || '(trống)'}`;
  const reference = `Một câu trả lời tốt theo khung STAR phải: (1) nêu Bối cảnh + Nhiệm vụ ngắn gọn; (2) Hành động tập trung vào ĐÓNG GÓP CÁ NHÂN của ứng viên (dùng "tôi"); (3) Kết quả có SỐ LIỆU/tác động đo được; (4) bám đúng năng lực được hỏi: "${q.competency}". Tránh lan man, tránh đổ lỗi, tránh chỉ nói "chúng tôi".`;
  out.innerHTML = '<p class="ai-loading">⏳ Claude đang đọc câu trả lời…</p>';
  let acc = '';
  aiGradeSingle({
    question: q.q, reference, userAnswer: answer, key, model,
    onText: t => { acc += t; out.innerHTML = `<div class="dg-ai-text">${escHtml(acc)}</div>`; },
  }).then(() => { logActivity(); }).catch(e => { out.innerHTML = `<p class="ai-err">Lỗi: ${escHtml(e.message || String(e))}</p>`; });
}

// ----- Chế độ 🐛 Tìm & Sửa Bug (tái dùng runInSandbox) -----
const dbgAll = () => window.DEBUG_CHALLENGES || [];
const dbgSolved = () => store.get('prep-debug-solved', {});

function renderDebugList() {
  const all = dbgAll();
  const pane = document.getElementById('debug-list');
  if (!pane) return;
  if (!all.length) { pane.innerHTML = '<p>Chưa nạp được ngân hàng bài sửa bug.</p>'; return; }
  const solved = dbgSolved();
  pane.innerHTML = all.map(c => `
    <button class="coding-item${solved[c.id] ? ' solved' : ''}" data-id="${escHtml(c.id)}">
      <span class="ci-check">${solved[c.id] ? '✅' : '○'}</span>
      <span class="ci-title">${escHtml(c.title)}</span>
      <span class="ci-tags"><span class="ci-diff d-${diffClass(c.difficulty)}">${escHtml(c.difficulty)}</span><span class="ci-topic">${escHtml(c.topic)}</span></span>
    </button>`).join('');
  pane.querySelectorAll('.coding-item').forEach(b => b.onclick = () => openDebug(b.dataset.id));
}

function openDebug(id) {
  const c = dbgAll().find(x => x.id === id);
  if (!c) return;
  const saved = store.get('prep-debug-code', {})[id];
  const detail = document.getElementById('debug-detail');
  const listPane = document.getElementById('debug-list-pane');
  listPane.hidden = true; detail.hidden = false;
  detail.innerHTML = `
    <button class="coding-back">← Danh sách bài</button>
    <h2>🐛 ${escHtml(c.title)}</h2>
    <div class="cd-tags"><span class="ci-diff d-${diffClass(c.difficulty)}">${escHtml(c.difficulty)}</span><span class="ci-topic">${escHtml(c.topic)}</span></div>
    <p class="cd-explain">Đoạn code dưới có <b>một bug</b>. Tìm và sửa cho <b>chạy đúng mọi test</b>.</p>
    <textarea id="dbg-code" class="cd-code" spellcheck="false"></textarea>
    <div class="cd-actions">
      <button id="dbg-run" class="cd-run">▶ Chạy test</button>
      <button id="dbg-hint">💡 Gợi ý</button>
      <button id="dbg-sol">👁 Đáp án + giải thích</button>
      <button id="dbg-reset" class="cd-reset" title="Khôi phục code lỗi ban đầu">↺ Reset</button>
    </div>
    <div id="dbg-hints" class="cd-hints"></div>
    <div id="dbg-result" class="cd-result"></div>
    <div id="dbg-solution" class="cd-solution" hidden></div>`;
  const ta = document.getElementById('dbg-code');
  ta.value = saved || c.buggy;
  detail.querySelector('.coding-back').onclick = () => { detail.hidden = true; listPane.hidden = false; renderDebugList(); };
  ta.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = ta.selectionStart, en = ta.selectionEnd;
      ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(en);
      ta.selectionStart = ta.selectionEnd = s + 2;
    }
  });
  ta.addEventListener('input', () => { const all = store.get('prep-debug-code', {}); all[id] = ta.value; store.set('prep-debug-code', all); });
  document.getElementById('dbg-run').onclick = () => runDebug(c, ta.value);
  document.getElementById('dbg-hint').onclick = () => {
    document.getElementById('dbg-hints').innerHTML = `<div class="cd-hint">💡 ${escHtml(c.bugHint)}</div>`;
  };
  document.getElementById('dbg-sol').onclick = () => {
    const box = document.getElementById('dbg-solution');
    box.hidden = !box.hidden;
    if (!box.dataset.filled) {
      box.innerHTML = `<h3>Bản đã sửa</h3><pre><code class="language-js">${escHtml(c.fixed)}</code></pre><p class="cd-explain">📝 ${escHtml(c.explain)}</p>`;
      if (window.hljs) box.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
      box.dataset.filled = '1';
    }
  };
  document.getElementById('dbg-reset').onclick = () => {
    ta.value = c.buggy;
    const all = store.get('prep-debug-code', {}); delete all[id]; store.set('prep-debug-code', all);
  };
}

function runDebug(c, code) {
  const res = document.getElementById('dbg-result');
  res.innerHTML = '<div class="cd-running">⏳ Đang chạy test…</div>';
  runInSandbox(code, c.fnName, c.tests, data => {
    if (data.error) { res.innerHTML = `<div class="cd-err">❌ ${escHtml(data.error)}</div>`; return; }
    const rows = data.results.map((r, i) => {
      const got = r.error ? `lỗi: ${r.error}` : JSON.stringify(r.got);
      const argTxt = r.args.map(a => JSON.stringify(a)).join(', ');
      return `<div class="cd-case ${r.pass ? 'pass' : 'fail'}">
        <span class="cc-h">${r.pass ? '✅' : '❌'} Test ${i + 1}</span>
        <code class="cc-in">${escHtml(c.fnName)}(${escHtml(argTxt)})</code>
        <span class="cc-exp">→ mong đợi <b>${escHtml(JSON.stringify(r.expected))}</b>${r.pass ? '' : `, nhận <b>${escHtml(got)}</b>`}</span>
      </div>`;
    }).join('');
    const passed = data.results.filter(r => r.pass).length;
    const all = passed === data.results.length;
    res.innerHTML = `<div class="cd-summary ${all ? 'ok' : 'no'}">${all ? '🎉 Đã sửa xong bug!' : '⚠️'} ${passed}/${data.results.length} test đúng</div>${rows}`;
    if (all) {
      const solved = dbgSolved();
      if (!solved[c.id]) { solved[c.id] = true; store.set('prep-debug-solved', solved); logActivity(); }
    }
  });
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
    <div class="cd-prompt md">${window.marked ? marked.parse(p.prompt) : escHtml(p.prompt)}</div>
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
    <div class="iq-opts">${shuffledOptsHtml(q, escHtml, 'iq-opt')}</div>
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
    <div class="iq-opts">${shuffledOptsHtml(q, escHtml, 'iq-opt')}</div>
    <div id="iq-fb" class="iq-fb"></div>
    <button id="iq-next" class="iq-next" hidden></button>`;
  body.querySelectorAll('.iq-opt').forEach(b => b.onclick = () => answerIQ(+b.dataset.i));
}

function answerIQ(i) {
  const s = iqState;
  if (s.answered) return;
  s.answered = true;
  const q = s.qs[s.idx];
  // Scoped vào #iq-body: tránh dính class chấm sang .iq-opt của view khác còn trong DOM
  document.getElementById('iq-body').querySelectorAll('.iq-opt').forEach(b => {
    b.disabled = true;
    const oi = +b.dataset.i;
    if (oi === q.answer) b.classList.add('correct');
    else if (oi === i) b.classList.add('wrong');
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

// ========== PHỎNG VẤN TỔNG HỢP (Tiếng Anh + IQ + Code + Tình huống) ==========
let ivState = null;
const IV_ROUNDS = [
  { key: 'english', label: '🇬🇧 Tiếng Anh', n: 8, desc: 'Ngữ pháp, từ vựng, giao tiếp công sở.' },
  { key: 'iq', label: '🧩 IQ / Tư duy', n: 10, desc: 'Dãy số, logic, toán nhanh — có tính giờ.' },
  { key: 'code', label: '⌨️ Lập trình', n: 1, desc: 'Giải 1 bài, chạy test thật trong trình duyệt.' },
  { key: 'situational', label: '🎭 Xử lý tình huống', n: 8, desc: 'Tình huống công việc & case sự cố production.' },
];
const verdClass = o => o >= 80 ? 'ok' : o >= 65 ? 'good' : o >= 50 ? 'mid' : 'low';
const verdictText = o => o >= 80 ? 'Đậu xuất sắc 🌟' : o >= 65 ? 'Đậu ✅' : o >= 50 ? 'Cân nhắc — có thể vào vòng sau 🤔' : 'Chưa đạt 💪';

function renderCompany() {
  const body = document.getElementById('iv-body');
  if (!body) return;
  clearInterval(iqTimerId);
  const hist = store.get('prep-interview-history', []);
  const best = hist.length ? Math.max(...hist.map(h => h.overall || 0)) : null;
  const histHtml = hist.length
    ? `<h3>🗂️ Lịch sử phỏng vấn (${hist.length})</h3>
       <div class="iv-hist">${hist.slice().reverse().slice(0, 8).map(h => {
         const sc = h.scores || {};
         return `
         <div class="iv-hrow">
           <span class="iv-hdate">${escHtml(h.date)}</span>
           <span class="iv-hov">${h.overall ?? '—'}/100</span>
           <span class="iv-hverd ${verdClass(h.overall || 0)}">${escHtml(h.verdict || '')}</span>
           <span class="iv-hbk">🇬🇧${sc.english ?? '—'} 🧩${sc.iq ?? '—'} ⌨️${sc.code ?? '—'} 🎭${sc.situational ?? '—'}</span>
         </div>`;
       }).join('')}</div>
       <p class="iq-note">☁️ Lịch sử được lưu & đồng bộ lên cloud theo tài khoản của bạn.</p>`
    : '<p class="iq-note">Chưa có buổi phỏng vấn nào — hãy thử buổi đầu tiên!</p>';
  body.innerHTML = `
    <div class="iv-intro">
      <h1>🏢 Phỏng vấn tổng hợp</h1>
      <p class="coding-intro">Mô phỏng quy trình tuyển dụng thực tế gồm <b>4 vòng liên tiếp</b>. Cuối buổi có điểm từng vòng + kết luận <b>Đậu / Cân nhắc / Chưa đạt</b>.</p>
      <div class="iv-rounds">${IV_ROUNDS.map((r, i) => `<div class="iv-rcard"><span class="iv-rnum">${i + 1}</span><div><b>${r.label}</b><small>${escHtml(r.desc)}</small></div></div>`).join('')}</div>
      <div class="iq-stat">${best != null ? `<div><b>${best}</b><small>điểm cao nhất</small></div>` : ''}<div><b>${hist.length}</b><small>lần phỏng vấn</small></div></div>
      <button id="iv-start" class="iq-start-btn">🚀 Bắt đầu phỏng vấn</button>
    </div>
    ${reverseQuestionsHtml()}
    ${histHtml}`;
  document.getElementById('iv-start').onclick = () => startInterview();
}

/** Accordion "Câu hỏi nên hỏi nhà tuyển dụng" — nội dung tham khảo cuối buổi phỏng vấn. */
function reverseQuestionsHtml() {
  const groups = window.REVERSE_QUESTIONS || [];
  if (!groups.length) return '';
  const cards = groups.map(g => {
    const items = g.items.map(it =>
      `<li><b>${escHtml(it.q)}</b><span class="rq-why">💡 ${escHtml(it.why)}</span></li>`).join('');
    return `<details class="rq-group">
      <summary>${g.icon} ${escHtml(g.group)} <span class="rq-n">${g.items.length}</span></summary>
      ${g.note ? `<p class="rq-note">${escHtml(g.note)}</p>` : ''}
      <ul class="rq-list">${items}</ul>
    </details>`;
  }).join('');
  return `<div class="rq-wrap">
    <h3>💬 Câu hỏi nên hỏi lại nhà tuyển dụng</h3>
    <p class="iq-note">Cuối buổi thường có “Bạn có câu hỏi gì không?” — hỏi câu hay giúp bạn ghi điểm và đánh giá ngược công ty. Bấm từng nhóm để mở.</p>
    ${cards}
  </div>`;
}

function startInterview() { ivState = { idx: 0, scores: {}, startMs: Date.now() }; runRound(); }

function runRound() {
  const r = IV_ROUNDS[ivState.idx];
  if (!r) return finishInterview();
  if (r.key === 'english') startMcqRound(window.ENGLISH_QUESTIONS || [], r);
  else if (r.key === 'situational') startMcqRound(window.SITUATIONAL_QUESTIONS || [], r);
  else if (r.key === 'iq') startIvIq(r);
  else if (r.key === 'code') startIvCode(r);
}

function roundDone(scorePct) {
  const r = IV_ROUNDS[ivState.idx];
  ivState.scores[r.key] = Math.round(scorePct);
  logActivity();
  ivState.idx++;
  const next = IV_ROUNDS[ivState.idx];
  document.getElementById('iv-body').innerHTML = `
    <div class="iv-inter">
      <div class="iv-check">✅</div>
      <h2>Xong vòng ${ivState.idx}/${IV_ROUNDS.length}: ${escHtml(r.label)}</h2>
      <p>Điểm vòng này: <b>${ivState.scores[r.key]}/100</b></p>
      ${next
        ? `<p class="iq-note">Tiếp theo: <b>${escHtml(next.label)}</b> — ${escHtml(next.desc)}</p><button id="iv-next" class="iq-start-btn">Vào vòng ${ivState.idx + 1} →</button>`
        : '<button id="iv-next" class="iq-start-btn">Xem kết quả tổng →</button>'}
    </div>`;
  document.getElementById('iv-next').onclick = () => (next ? runRound() : finishInterview());
}

// --- Vòng trắc nghiệm (Tiếng Anh / Tình huống), có giải thích sau mỗi câu ---
function startMcqRound(bank, r) {
  ivState.mcq = { qs: shuffleArr(bank).slice(0, Math.min(r.n, bank.length)), idx: 0, correct: 0, answered: false, label: r.label, modeKey: r.key };
  showMcq();
}
function showMcq() {
  const m = ivState.mcq, body = document.getElementById('iv-body');
  if (m.idx >= m.qs.length) return roundDone(m.qs.length ? m.correct / m.qs.length * 100 : 0);
  const q = m.qs[m.idx];
  body.innerHTML = `
    <div class="iv-roundhead">${escHtml(m.label)} · Câu ${m.idx + 1}/${m.qs.length}</div>
    <div class="iq-track"><div class="iq-fill" style="width:${m.idx / m.qs.length * 100}%"></div></div>
    <div class="iq-q">${escHtml(q.q)}</div>
    <div class="iq-opts">${shuffledOptsHtml(q, escHtml, 'iq-opt')}</div>
    <div id="iv-fb" class="iq-fb"></div>
    <button id="iv-mnext" class="iq-next" hidden></button>`;
  body.querySelectorAll('.iq-opt').forEach(b => b.onclick = () => answerMcq(+b.dataset.i));
}
function answerMcq(i) {
  const m = ivState.mcq;
  if (m.answered) return;
  m.answered = true;
  const q = m.qs[m.idx];
  document.getElementById('iv-body').querySelectorAll('.iq-opt').forEach(b => { b.disabled = true; const oi = +b.dataset.i; if (oi === q.answer) b.classList.add('correct'); else if (oi === i) b.classList.add('wrong'); });
  const ok = i === q.answer;
  if (ok) m.correct++;
  // Đổ câu sai về hệ 🔁 Ôn câu sai (mode english/situational trong QUIZ_MODES)
  const cfg = QUIZ_MODES[m.modeKey];
  if (cfg) {
    if (ok) {
      clearWrong(m.modeKey, q.id);
      const d = store.get(cfg.doneKey, {}); d[q.id] = true; store.set(cfg.doneKey, d);
    } else recordWrong(m.modeKey, q.id);
  }
  const ivFb = document.getElementById('iv-fb');
  const pin = pinBtnHtml(m.modeKey, q.id);
  ivFb.innerHTML = `<div class="${ok ? 'iq-ok' : 'iq-no'}">${ok ? '✅ Đúng! ' : '❌ Chưa đúng. '}${escHtml(q.explain)}</div>${pin ? `<div class="oq-fb-actions">${pin}</div>` : ''}`;
  bindPinBtns(ivFb);
  const nx = document.getElementById('iv-mnext');
  nx.hidden = false;
  nx.textContent = m.idx + 1 >= m.qs.length ? 'Hoàn tất vòng →' : 'Câu tiếp →';
  nx.onclick = () => { m.idx++; m.answered = false; showMcq(); };
}

// --- Vòng IQ (tính giờ, không hiện đáp án, chấm theo trọng số độ khó) ---
function startIvIq(r) {
  const qs = pickIQTest(window.IQ_QUESTIONS || [], Math.min(r.n, (window.IQ_QUESTIONS || []).length));
  ivState.iq = { qs, idx: 0, wGot: 0, wMax: qs.reduce((a, q) => a + qDiff(q), 0), startMs: Date.now(), sec: r.n * 30 };
  clearInterval(iqTimerId);
  iqTimerId = setInterval(tickIvIq, 1000);
  showIvIq();
}
function tickIvIq() {
  const el = document.getElementById('ivq-timer');
  if (!el || !ivState || !ivState.iq) { clearInterval(iqTimerId); return; }
  const left = ivState.iq.sec - Math.floor((Date.now() - ivState.iq.startMs) / 1000);
  if (left <= 0) { el.textContent = '00:00'; finishIvIq(); return; }
  el.textContent = fmtMMSS(left);
  el.classList.toggle('low', left <= 30);
}
function showIvIq() {
  const s = ivState.iq, body = document.getElementById('iv-body');
  if (!body) { clearInterval(iqTimerId); return; }
  if (s.idx >= s.qs.length) return finishIvIq();
  const q = s.qs[s.idx];
  body.innerHTML = `
    <div class="iqt-bar"><span class="iqt-count">🧩 IQ · Câu ${s.idx + 1}/${s.qs.length}</span><span id="ivq-timer" class="iqt-timer">${fmtMMSS(s.sec)}</span></div>
    <div class="iq-track"><div class="iq-fill" style="width:${s.idx / s.qs.length * 100}%"></div></div>
    <div class="iq-cat" style="margin-bottom:6px">${escHtml(q.category)}</div>
    <div class="iq-q">${escHtml(q.q)}</div>
    <div class="iq-opts">${shuffledOptsHtml(q, escHtml, 'iq-opt')}</div>`;
  body.querySelectorAll('.iq-opt').forEach(b => b.onclick = () => { if (+b.dataset.i === q.answer) s.wGot += qDiff(q); s.idx++; showIvIq(); });
}
function finishIvIq() {
  clearInterval(iqTimerId);
  const s = ivState.iq;
  roundDone(s.wMax ? s.wGot / s.wMax * 100 : 0);
}

// --- Vòng Lập trình (1 bài, chạy test thật) ---
function startIvCode(r) {
  const easy = (window.CODING_PROBLEMS || []).filter(p => p.difficulty !== 'Khó');
  const p = shuffleArr(easy.length ? easy : (window.CODING_PROBLEMS || []))[0];
  if (!p) return roundDone(0);
  ivState.code = { p, passed: 0, total: p.tests.length, ran: false };
  document.getElementById('iv-body').innerHTML = `
    <div class="iv-roundhead">⌨️ Lập trình · giải bài rồi chạy test</div>
    <h2>${escHtml(p.title)}</h2>
    <div class="cd-tags"><span class="ci-topic">${escHtml(p.topic)}</span></div>
    <div class="cd-prompt md">${window.marked ? marked.parse(p.prompt) : escHtml(p.prompt)}</div>
    <textarea id="iv-code" class="cd-code" spellcheck="false"></textarea>
    <div class="cd-actions">
      <button id="iv-run" class="cd-run">▶ Chạy test</button>
      <button id="iv-submit">Nộp &amp; sang vòng sau →</button>
    </div>
    <div id="iv-cres" class="cd-result"></div>`;
  const ta = document.getElementById('iv-code');
  ta.value = p.starter;
  ta.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); const a = ta.selectionStart, b = ta.selectionEnd; ta.value = ta.value.slice(0, a) + '  ' + ta.value.slice(b); ta.selectionStart = ta.selectionEnd = a + 2; } });
  document.getElementById('iv-run').onclick = () => ivRunCode(p, ta.value);
  document.getElementById('iv-submit').onclick = () => {
    if (!ivState.code.ran && !confirm('Bạn chưa chạy test lần nào — nộp với 0 điểm vòng này?')) return;
    roundDone(ivState.code.total ? ivState.code.passed / ivState.code.total * 100 : 0);
  };
}
function ivRunCode(p, code) {
  const res = document.getElementById('iv-cres');
  res.innerHTML = '<div class="cd-running">⏳ Đang chạy test…</div>';
  runInSandbox(code, p.fnName, p.tests, data => {
    if (data.error) { res.innerHTML = `<div class="cd-err">❌ ${escHtml(data.error)}</div>`; ivState.code.passed = 0; ivState.code.ran = true; return; }
    const passed = data.results.filter(r => r.pass).length;
    ivState.code.passed = passed; ivState.code.ran = true;
    const all = passed === data.results.length;
    res.innerHTML = `<div class="cd-summary ${all ? 'ok' : 'no'}">${all ? '🎉' : '⚠️'} ${passed}/${data.results.length} test đúng</div>`
      + data.results.map((r, i) => `<div class="cd-case ${r.pass ? 'pass' : 'fail'}"><span class="cc-h">${r.pass ? '✅' : '❌'} Test ${i + 1}</span></div>`).join('');
  });
}

function finishInterview() {
  const sc = ivState.scores;
  const v = k => sc[k] || 0;
  const overall = Math.round((v('english') + v('iq') + v('code') + v('situational')) / 4);
  const verdict = verdictText(overall);
  const timeSec = Math.round((Date.now() - ivState.startMs) / 1000);
  const rec = { date: dayKey(new Date()), ts: Date.now(), scores: sc, overall, verdict, timeSec };
  const hist = store.get('prep-interview-history', []);
  hist.push(rec);
  store.set('prep-interview-history', hist.slice(-50)); // → tự lên Firestore
  logActivity();

  const rounds = [['english', '🇬🇧 Tiếng Anh'], ['iq', '🧩 IQ / Tư duy'], ['code', '⌨️ Lập trình'], ['situational', '🎭 Xử lý tình huống']];
  const weak = rounds.slice().sort((a, b) => sc[a[0]] - sc[b[0]])[0];
  const bars = rounds.map(([k, lab]) => `<div class="rd-part"><span class="rd-plabel">${lab}</span><div class="rd-track"><div class="rd-fill" style="width:${sc[k]}%"></div></div><b class="rd-pval">${sc[k]}</b></div>`).join('');
  document.getElementById('iv-body').innerHTML = `
    <div class="iv-result">
      <div class="iq-score-ring ring-${verdClass(overall)}" style="--p:${overall}"><div class="rd-center"><b>${overall}</b><small>/100</small></div></div>
      <h2 class="iv-verdict ${verdClass(overall)}">${verdict}</h2>
      <p>Tổng thời gian phỏng vấn: <b>${fmtMMSS(timeSec)}</b></p>
      <div class="rd-parts" style="max-width:460px;margin:14px auto">${bars}</div>
      <p class="rd-weak">🔧 Cần cải thiện nhất: <b>${escHtml(weak[1])}</b> (${sc[weak[0]]}/100). Luyện thêm ở tab tương ứng nhé!</p>
      <p class="iq-note">Điểm tổng = trung bình 4 vòng. Đã lưu vào lịch sử và đồng bộ cloud.</p>
      <button id="iv-again" class="iq-start-btn">🔁 Phỏng vấn lại</button>
    </div>`;
  document.getElementById('iv-again').onclick = () => renderCompany();
}

// ---------- Phím tắt ----------
/** Các nút đáp án quiz đang HIỂN THỊ & bấm được (tab Tư duy active, không ở mode ẩn). */
function quizVisibleOptions() {
  const coding = document.getElementById('view-coding');
  if (!coding || !coding.classList.contains('active')) return [];
  return [...coding.querySelectorAll('.oq-opt:not(:disabled)')].filter(b => !b.closest('[hidden]'));
}

/** Nút "Câu tiếp / Xem kết quả" đang hiện của quiz (để bấm Enter sang câu). */
function quizNextButton() {
  const coding = document.getElementById('view-coding');
  if (!coding || !coding.classList.contains('active')) return null;
  return [...coding.querySelectorAll('#oq-next, .oq-next-btn, #review-next')]
    .find(b => !b.closest('[hidden]')) || null;
}

function initShortcuts() {
  const order = ['today', 'docs', 'flashcards', 'writing', 'code', 'coding', 'design', 'mock', 'company', 'star', 'plan', 'dashboard'];
  document.addEventListener('keydown', e => {
    if (onboardOpen() || shortcutsOpen() || gsearchOpen()) return; // hộp thoại đang mở → không nhảy tab phía sau
    if (e.repeat) return; // giữ phím (key-repeat) không spam chuyển tab / nhấp nháy bảng phím tắt
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // Đang gõ trong ô nhập / vùng gõ code thì không cướp phím
    if (e.target.closest?.('input, textarea, select, #ct-code, [contenteditable]')) return;
    if (e.key >= '1' && e.key <= '9') {
      // Đang làm quiz (tab Tư duy active & có nút .oq-opt bật, không nằm trong mode ẩn)
      // → phím số chọn đáp án thay vì chuyển tab.
      const opts = quizVisibleOptions();
      const n = +e.key;
      if (opts.length && n <= opts.length) { e.preventDefault(); opts[n - 1].click(); return; }
      switchView(order[n - 1]);
    } else if (e.key === '/') {
      e.preventDefault();
      openGSearch(); // tìm kiếm toàn cục (trong modal có lối tắt tìm tiếp trong tài liệu)
    } else if (e.key === 'Enter') {
      // Nút 📌 đang focus (điều hướng bằng Tab) → để Enter kích hoạt ghim như nút thường
      if (document.activeElement?.classList?.contains('oq-pin')) return;
      // Sau khi đã chấm một câu quiz → Enter sang câu tiếp (điều khiển quiz hoàn toàn bằng phím)
      const next = quizNextButton();
      if (next) { e.preventDefault(); next.click(); }
    } else if (e.key === '?') { e.preventDefault(); toggleShortcuts(); } // bảng phím tắt
  });
}

// ============ 🔎 TÌM KIẾM TOÀN CỤC (khắp mọi ngân hàng câu hỏi) ============
// Mở bằng nút 🔎 topbar hoặc phím /. Gõ không dấu vẫn khớp ("tinh huong" ra "tình huống").
// Chọn kết quả trắc nghiệm → luyện ngay 1 câu qua engine review; loại khác → mở đúng bài.

/** Chuẩn hoá chuỗi để so khớp: thường hoá + bỏ dấu tiếng Việt. */
const gsNorm = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');

let gsIndex = null; // build lười ở lần tìm đầu (bank tĩnh nên chỉ cần 1 lần)
let gsSel = 0;      // hàng đang chọn bằng phím ↑↓

/** Luyện ngay 1 câu trắc nghiệm từ kết quả tìm kiếm (mượn engine phiên review). */
function gsPractice(mode, q) {
  switchView('coding');
  // Tab đang khoá login → gate đã hiện; đừng set queue kẻo sau khi login renderReview vẽ đè mất câu
  if (viewGated('coding') && !fbUser) return;
  setThinkMode('review');
  reviewQueue = [{ mode, q }];
  reviewIdx = 0; reviewRight = 0; reviewKind = 'mixed';
  showReview();
}

/** Gom mọi bank thành index phẳng [{badge, title, sub, hay, thay, go}]. */
function buildGsIndex() {
  const out = [];
  const add = (badge, title, sub, hayParts, go) =>
    out.push({ badge, title, sub, hay: gsNorm(hayParts.filter(Boolean).join(' ')), thay: gsNorm(title), go });
  Object.keys(QUIZ_MODES).forEach(mode => {
    const cfg = QUIZ_MODES[mode];
    (cfg.data() || []).forEach(q => {
      const title = q.q || String(q.code || '').split('\n').find(l => l.trim()) || String(q.id);
      add(cfg.label, title, q.topic || '', [q.q, q.code, q.cmd, q.sql, q.topic, q.explain, ...(q.options || [])], () => gsPractice(mode, q));
    });
  });
  (window.CODING_PROBLEMS || []).forEach(p =>
    add('💻 Lập trình', p.title, p.topic || '', [p.title, p.topic, p.prompt], () => { switchView('coding'); setThinkMode('code'); openCodingProblem(p.id); }));
  (window.DEBUG_CHALLENGES || []).forEach(c =>
    add('🐛 Sửa bug', c.title, c.topic || '', [c.title, c.topic, c.bugHint, c.explain], () => { switchView('coding'); setThinkMode('debug'); openDebug(c.id); }));
  (window.DESIGN_DRILLS || []).forEach(d =>
    add('🏛️ Thiết kế', d.title, d.company || '', [d.title, d.company, d.scenario, ...(d.focus || []), ...(d.keyPoints || [])], () => { switchView('design'); openDrill(d.id); }));
  (window.STAR_QUESTIONS || []).forEach(s =>
    add('🌟 STAR', s.q, s.competency || '', [s.q, s.competency], () => { switchView('star'); openStar(s.id); }));
  // 2 bank tham khảo (accordion .rq-group render theo đúng thứ tự group) — mở đúng nhóm chứa kết quả
  const openRefGroup = (view, gi) => {
    switchView(view);
    const d = document.querySelectorAll(`#view-${view} details.rq-group`)[gi];
    if (d) { d.open = true; d.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  };
  (window.REVERSE_QUESTIONS || []).forEach((g, gi) => (g.items || []).forEach(it =>
    add('💬 Hỏi ngược', it.q, g.group, [it.q, it.why, g.group], () => openRefGroup('company', gi))));
  (window.ENGLISH_PHRASES || []).forEach((g, gi) => (g.items || []).forEach(it =>
    add('🇬🇧 Mẫu câu', it.en, g.group, [it.en, it.vi, g.group], () => openRefGroup('star', gi))));
  return out;
}

/** Tìm theo AND mọi từ khoá; khớp ngay tiêu đề xếp trước; tối đa 30 kết quả. */
function gsSearch(qstr) {
  const terms = gsNorm(qstr).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  if (!gsIndex) gsIndex = buildGsIndex();
  const hits = [];
  for (const it of gsIndex) {
    if (!terms.every(t => it.hay.includes(t))) continue;
    hits.push({ it, score: terms.every(t => it.thay.includes(t)) ? 0 : 1 });
  }
  hits.sort((a, b) => a.score - b.score);
  return hits.slice(0, 30).map(h => h.it);
}

let gsHits = [];

function renderGsResults() {
  const box = document.getElementById('gs-results');
  const qstr = document.getElementById('gs-input').value.trim();
  if (qstr.length < 2) {
    gsHits = [];
    box.innerHTML = '<div class="gs-empty">Gõ ≥ 2 ký tự — tìm khắp quiz trắc nghiệm · 💻 lập trình · 🐛 sửa bug · 🏛️ thiết kế · 🌟 STAR · 💬 hỏi ngược · 🇬🇧 mẫu câu. Không cần gõ dấu.</div>';
    return;
  }
  gsHits = gsSearch(qstr);
  const rows = gsHits.map((it, i) => `<button class="gs-row" data-n="${i}">
      <span class="gs-badge">${it.badge}</span>
      <span class="gs-title">${escHtml(it.title)}</span>
      ${it.sub ? `<span class="gs-sub">${escHtml(it.sub)}</span>` : ''}
    </button>`).join('');
  // Lối tắt tìm tiếp trong tài liệu markdown (search docs sẵn có ở tab Tài liệu)
  const docsBtn = `<button class="gs-row gs-docs"><span class="gs-badge">📖 Tài liệu</span><span class="gs-title">Tìm “${escHtml(qstr)}” trong toàn bộ tài liệu →</span></button>`;
  box.innerHTML = (rows || '<div class="gs-empty">Không thấy câu hỏi nào khớp — thử từ khoá ngắn hơn hoặc ít từ hơn.</div>') + docsBtn;
  box.querySelectorAll('.gs-row').forEach(b =>
    b.onclick = () => (b.classList.contains('gs-docs') ? gsToDocs(qstr) : gsGo(+b.dataset.n)));
  gsSel = 0;
  gsMove(0);
}

function gsGo(n) { const it = gsHits[n]; if (!it) return; closeGSearch(); it.go(); }

function gsToDocs(qstr) {
  closeGSearch();
  switchView('docs');
  document.getElementById('sidebar')?.classList.add('open'); // mobile: sidebar off-canvas phải mở mới thấy ô tìm
  const inp = document.getElementById('sb-search');
  inp.value = qstr;
  inp.focus();
  inp.dispatchEvent(new Event('input')); // kích search docs sẵn có
}

/** Di chuyển vệt chọn bằng ↑↓ (d = ±1; d = 0 chỉ tô lại hàng đầu). */
function gsMove(d) {
  const rows = [...document.querySelectorAll('#gs-results .gs-row')];
  if (!rows.length) return;
  gsSel = (gsSel + d + rows.length) % rows.length;
  rows.forEach((r, i) => r.classList.toggle('sel', i === gsSel));
  rows[gsSel].scrollIntoView({ block: 'nearest' });
}

const gsearchOpen = () => { const o = document.getElementById('gsearch'); return !!o && !o.hidden; };
function gsKey(e) { if (e.key === 'Escape') { e.preventDefault(); closeGSearch(); } }
function closeGSearch() {
  const o = document.getElementById('gsearch');
  if (o) o.hidden = true;
  document.removeEventListener('keydown', gsKey);
}

function openGSearch() {
  let ov = document.getElementById('gsearch');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'gsearch';
    ov.innerHTML = `<div class="sc-card gs-card" role="dialog" aria-modal="true" aria-label="Tìm kiếm câu hỏi toàn cục">
      <div class="gs-inputrow"><span>🔎</span><input id="gs-input" type="search" placeholder="Tìm câu hỏi: index, docker, deadlock, event loop…" autocomplete="off"><kbd>Esc</kbd></div>
      <div id="gs-results" class="gs-results"></div>
    </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) closeGSearch(); });
    const inp = document.getElementById('gs-input');
    inp.addEventListener('input', renderGsResults);
    inp.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); gsMove(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); gsMove(-1); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const rows = document.querySelectorAll('#gs-results .gs-row');
        (rows[gsSel] || rows[0])?.click();
      }
    });
  }
  ov.hidden = false;
  document.addEventListener('keydown', gsKey); // Esc đóng được cả khi focus đã rời modal (mẫu scKey)
  renderGsResults();
  const inp = document.getElementById('gs-input');
  inp.focus();
  inp.select();
}

function initGSearch() {
  const btn = document.getElementById('gsearch-btn');
  if (btn) btn.onclick = openGSearch;
}

// ---------- Đồng bộ Firebase (Auth Google + Firestore) ----------
// Giữ localStorage làm nguồn chính; khi đăng nhập thì đẩy lên / kéo về Firestore.
// Chiến lược: last-write-wins theo CẢ GÓI (so sánh updatedAt). Đủ cho 1 người dùng nhiều máy;
// nếu sửa ở 2 máy mà chưa đồng bộ thì máy có mốc thời gian cũ hơn sẽ bị ghi đè.
let fbAuth = null, fbDb = null, fbUser = null, syncReady = false, pushTimer = null, snapUnsub = null;

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
  // prep-readiness-log ghi tự động trong render (kể cả render do snapshot remote kích) —
  // nếu để nó trigger push sẽ ping-pong giữa 2 thiết bị lệch điểm; giá trị vẫn được sync
  // kèm theo mọi lần push khác (push là whole-blob theo PREP_KEYS).
  // prep-exam-state ghi SAU MỖI CÂU thi thử nhưng nằm ngoài PREP_KEYS (không sync) —
  // để nó trigger là mỗi câu trả lời đẩy nguyên blob không đổi lên Firestore, noise thuần.
  onStoreWrite = key => { if (key !== 'prep-sync-meta' && key !== 'prep-readiness-log' && key !== EXAM_STATE_KEY) schedulePush(); };

  fbAuth.onAuthStateChanged(async user => {
    fbUser = user;
    authResolved = true;
    renderSyncBtn();
    renderLoginHint();
    if (user) await onSignedIn();
    else if (snapUnsub) { snapUnsub(); snapUnsub = null; } // đăng xuất → ngắt lắng nghe realtime
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
  attachLiveSync(); // sau khi hoà lần đầu → lắng nghe thay đổi realtime từ thiết bị/tab khác
}

/** Lắng nghe doc của user theo thời gian thực: thiết bị/tab khác sửa → máy này tự cập nhật. */
function attachLiveSync() {
  if (!syncReady || !fbUser) return;
  if (snapUnsub) { snapUnsub(); snapUnsub = null; } // tránh gắn trùng (onAuthStateChanged có thể bắn lại)
  snapUnsub = fbDb.collection('users').doc(fbUser.uid)
    .onSnapshot(handleRemoteSnapshot, err => console.warn('live sync lỗi', err));
}

function handleRemoteSnapshot(snap) {
  if (!snap || !snap.exists) return;
  // Bỏ qua bản echo của CHÍNH MÌNH: ghi cục bộ chưa được server xác nhận (latency compensation).
  if (snap.metadata && snap.metadata.hasPendingWrites) return;
  const remote = snap.data();
  // Chỉ áp dụng khi cloud THỰC SỰ mới hơn bản local (chống cả echo lẫn ghi đè ngược).
  if (!remote || (remote.updatedAt || 0) <= localUpdatedAt()) return;
  try {
    applyPrepData(JSON.parse(remote.blob || '{}')); // dùng localStorage.setItem thẳng → KHÔNG kích push
    setLocalUpdatedAt(remote.updatedAt || Date.now());
  } catch (e) { console.warn('áp remote realtime lỗi', e); return; }
  // Vẽ lại view hiện tại để thấy dữ liệu mới — nhưng đừng phá khi người dùng đang gõ giữa chừng.
  if (!isEditingNow()) reapplyView();
  toast('⬇️ Cập nhật từ thiết bị khác');
}

/** Có đang gõ trong ô nhập/textarea không (để khỏi re-render phá thao tác đang dở). */
function isEditingNow() {
  // Đang đọc chính tả cũng là đang soạn: focus nằm ở NÚT 🎙️ chứ không phải textarea,
  // nhưng re-render lúc này sẽ tắt mic giữa câu + đè đoạn chưa kịp autosave (debounce 500ms).
  if (dictState) return true;
  // Đang GIỮA BÀI THI có đồng hồ: reapplyView sẽ vẽ lại câu hỏi với thứ tự đáp án trộn MỚI
  // ngay lúc user sắp bấm → click nhầm theo vị trí cũ. Điểm/deadline không đổi nên cứ hoãn re-render.
  if (examRunning()) return true;
  const a = document.activeElement;
  return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable);
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
// ---------- PWA: service worker + nút "Cài app" ----------
function initPwa() {
  // Đăng ký service worker để chạy offline (bỏ qua khi mở bằng file:// — SW cần http/https).
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {/* không sao, vẫn chạy online */});
    });
  }
  // Bắt sự kiện cài đặt: hiện nút 📲 trên thanh công cụ khi trình duyệt cho phép cài.
  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    let btn = document.getElementById('install-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'install-btn';
      btn.title = 'Cài app vào máy để học offline';
      btn.textContent = '📲 Cài app';
      document.querySelector('.pomo')?.prepend(btn);
    }
    btn.hidden = false;
    btn.onclick = async () => {
      btn.hidden = true;
      deferred.prompt();
      try { await deferred.userChoice; } catch {}
      deferred = null;
    };
  });
  window.addEventListener('appinstalled', () => {
    const btn = document.getElementById('install-btn');
    if (btn) btn.hidden = true;
  });
}

// ---------- Onboarding: hướng dẫn lần đầu + nút ❓ mở lại bất cứ lúc nào ----------
const ONBOARD_SLIDES = [
  {
    ico: '🚀',
    title: 'Chào mừng đến Backend Interview Prep!',
    body: 'Bộ công cụ ôn phỏng vấn <b>Backend Node.js</b> theo lộ trình <b>12 tuần</b> — tài liệu, flashcards, luyện tư duy, mock phỏng vấn… gói gọn trong một trang và <b>học được cả khi offline</b>.',
  },
  {
    ico: '🧭',
    title: '5 nhóm trên thanh menu',
    body: `<ul class="onb-list">
      <li><b>🔥 Hôm nay</b> — việc cần ôn mỗi ngày + mục tiêu &amp; chuỗi streak</li>
      <li><b>📚 Học</b> — tài liệu, flashcards, luyện viết, gõ code</li>
      <li><b>🧠 Luyện tập</b> — tư duy (code · IQ · quiz · 🎓 thi thử) &amp; thiết kế hệ thống</li>
      <li><b>🎯 Phỏng vấn</b> — mock, Q&amp;A tổng hợp, STAR kể chuyện</li>
      <li><b>📊 Theo dõi</b> — kế hoạch 12 tuần &amp; điểm sẵn sàng</li>
    </ul>`,
  },
  {
    ico: '⏱️',
    title: 'Nhịp học mỗi ngày 30–45 phút',
    body: '1️⃣ Mở <b>🔥 Hôm nay</b> xem việc cần ôn → 2️⃣ ôn <b>flashcards</b> tới hạn → 3️⃣ giải <b>1 bài tư duy</b> → 4️⃣ thỉnh thoảng làm <b>🎯 Mock</b>. Bật <b>🍅 Pomodoro</b> trên thanh công cụ để tập trung theo phiên 25 phút.',
  },
  {
    ico: '☁️',
    title: 'Tiến độ được lưu &amp; đồng bộ',
    body: 'Mọi điểm số lưu ngay trên máy này. Bấm <b>☁️ Đồng bộ</b> để đăng nhập Google → dữ liệu theo bạn qua <b>mọi thiết bị</b>, cập nhật thời gian thực. Có thể bấm <b>📲 Cài app</b> để học offline như một ứng dụng.',
  },
  {
    ico: '🎯',
    title: 'Sẵn sàng chưa?',
    body: 'Bắt đầu từ <b>🔥 Hôm nay</b> nhé. Cần xem lại hướng dẫn này bất cứ lúc nào? Bấm nút <b>❓</b> trên thanh công cụ. Mẹo: bấm phím <b>?</b> để xem mọi phím tắt.',
  },
];
let onbIdx = 0;
const onboardOpen = () => { const o = document.getElementById('onboard'); return !!o && !o.hidden; };

function renderOnboard() {
  const s = ONBOARD_SLIDES[onbIdx];
  const last = onbIdx === ONBOARD_SLIDES.length - 1;
  document.querySelector('#onboard .onb-card').innerHTML = `
    <button class="onb-x" id="onb-skip" title="Bỏ qua">✕</button>
    <div class="onb-ico">${s.ico}</div>
    <h2>${s.title}</h2>
    <div class="onb-body">${s.body}</div>
    <div class="onb-dots">${ONBOARD_SLIDES.map((_, i) =>
      `<span class="${i === onbIdx ? 'on' : ''}"></span>`).join('')}</div>
    <div class="onb-nav">
      <button id="onb-prev" class="onb-back"${onbIdx === 0 ? ' hidden' : ''}>← Trước</button>
      <span class="onb-step">${onbIdx + 1}/${ONBOARD_SLIDES.length}</span>
      <button id="onb-next" class="onb-cta">${last ? '🔥 Bắt đầu ngay' : 'Tiếp →'}</button>
    </div>`;
  document.getElementById('onb-skip').onclick = closeOnboard;
  document.getElementById('onb-prev').onclick = () => { onbIdx = Math.max(0, onbIdx - 1); renderOnboard(); };
  document.getElementById('onb-next').onclick = () => {
    if (last) { closeOnboard(); switchView('today'); }
    else { onbIdx++; renderOnboard(); }
  };
}

function openOnboard() {
  onbIdx = 0;
  let ov = document.getElementById('onboard');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'onboard';
    ov.innerHTML = '<div class="onb-card" role="dialog" aria-modal="true"></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) closeOnboard(); }); // bấm nền tối để đóng
  }
  ov.hidden = false;
  renderOnboard();
  document.addEventListener('keydown', onbKey);
}

function closeOnboard() {
  const ov = document.getElementById('onboard');
  if (ov) ov.hidden = true;
  store.set('prep-onboarded', 1);
  document.removeEventListener('keydown', onbKey);
}

function onbKey(e) {
  if (e.repeat) return; // giữ phím không nhảy slide liên tục
  if (e.key === 'Escape') { e.preventDefault(); closeOnboard(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); document.getElementById('onb-next')?.click(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); document.getElementById('onb-prev')?.click(); }
}

function initOnboarding() {
  // Nút ❓ cạnh nút đổi giao diện → mở lại hướng dẫn lúc nào cũng được
  const help = document.createElement('button');
  help.id = 'help-btn';
  help.title = 'Xem lại hướng dẫn sử dụng';
  help.textContent = '❓';
  help.addEventListener('click', openOnboard);
  document.getElementById('theme-btn')?.insertAdjacentElement('beforebegin', help);
  if (!store.get('prep-onboarded', 0)) openOnboard(); // lần đầu mở app → tự hiện
}

// ---------- Bảng phím tắt (bấm ? để mở) ----------
const SHORTCUTS = [
  { group: '🧭 Điều hướng', items: [
    { keys: ['1', '…', '9'], desc: 'Chuyển nhanh giữa các tab' },
    { keys: ['/'], desc: 'Tìm kiếm câu hỏi toàn cục (mọi bank + tài liệu)' },
    { keys: ['?'], desc: 'Mở bảng phím tắt này' },
    { keys: ['Esc'], desc: 'Đóng hộp thoại / menu đang mở' },
  ] },
  { group: '🃏 Flashcards', items: [
    { keys: ['Space'], desc: 'Lật thẻ' },
    { keys: ['→'], desc: 'Nhớ rồi' },
    { keys: ['←'], desc: 'Chưa nhớ' },
    { keys: ['S'], desc: 'Nghe phát âm' },
  ] },
  { group: '📝 Trắc nghiệm (Tư duy)', items: [
    { keys: ['1', '…', '4'], desc: 'Chọn đáp án A–D khi đang có câu hỏi (thay cho chuyển tab)' },
    { keys: ['Enter'], desc: 'Sang câu tiếp sau khi đã chấm' },
  ] },
  { group: '💡 Khác', items: [
    { keys: ['❓'], desc: 'Nút trên thanh công cụ — mở lại hướng dẫn' },
  ] },
];
const shortcutsOpen = () => { const o = document.getElementById('shortcuts'); return !!o && !o.hidden; };

function closeShortcuts() {
  const o = document.getElementById('shortcuts');
  if (o) o.hidden = true;
  document.removeEventListener('keydown', scKey);
}
function scKey(e) { if (e.key === 'Escape' || e.key === '?') { e.preventDefault(); closeShortcuts(); } }

function openShortcuts() {
  let ov = document.getElementById('shortcuts');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'shortcuts';
    ov.innerHTML = `<div class="sc-card" role="dialog" aria-modal="true">
      <button class="onb-x" id="sc-x" title="Đóng">✕</button>
      <h2>⌨️ Phím tắt</h2>
      <div class="sc-groups">${SHORTCUTS.map(g => `
        <div class="sc-grp"><h3>${g.group}</h3>${g.items.map(it =>
          `<div class="sc-row"><span class="sc-keys">${it.keys.map(k =>
            `<kbd>${k}</kbd>`).join('')}</span><span class="sc-desc">${it.desc}</span></div>`).join('')}</div>`).join('')}</div>
      <p class="sc-foot">Bấm <kbd>?</kbd> hoặc <kbd>Esc</kbd> để đóng</p>
    </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) closeShortcuts(); });
    document.getElementById('sc-x').onclick = closeShortcuts;
  }
  ov.hidden = false;
  document.addEventListener('keydown', scKey);
}
function toggleShortcuts() { shortcutsOpen() ? closeShortcuts() : openShortcuts(); }

(async function init() {
  initSearch();
  initTheme();
  initPomodoro();
  initSidebarToggle();
  initShortcuts();
  initGSearch();
  initOnboarding();
  initPwa();
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
