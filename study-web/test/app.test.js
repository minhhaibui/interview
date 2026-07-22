/**
 * Test toàn vẹn dữ liệu + wiring tĩnh cho Study Web (zero-dep, chạy bằng node:test).
 *
 *   node --test study-web/test/
 *
 * KHÔNG cần trình duyệt: nạp các file dữ liệu (window.*) trong sandbox vm,
 * và phân tích app.js/index.html ở dạng văn bản để bắt lỗi wiring (typo id,
 * tab↔view↔switchView lệch, PREP_KEYS trùng, lời giải coding sai...).
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const PUB = path.resolve(__dirname, '..', 'public');
const read = f => fs.readFileSync(path.join(PUB, f), 'utf8');

/** Nạp một file `window.X = [...]` TRONG CÙNG REALM (để deepStrictEqual so sánh
 * được mảng/object — vm tạo realm khác làm prototype lệch). */
function loadWindow(file) {
  const w = {};
  new Function('window', read(file))(w);
  return w;
}

const APP = read('app.js');
const HTML = read('index.html');
const SW = read('sw.js');

// ---------------------------------------------------------------------------
// A. TOÀN VẸN DỮ LIỆU
// ---------------------------------------------------------------------------
test('coding-problems: id duy nhất, đủ field, LỜI GIẢI chạy đúng test', () => {
  const probs = loadWindow('coding-problems.js').CODING_PROBLEMS;
  assert.ok(Array.isArray(probs) && probs.length, 'phải có mảng bài');
  const ids = probs.map(p => p.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'id coding trùng: ' +
    ids.filter((x, i) => ids.indexOf(x) !== i));
  for (const p of probs) {
    assert.ok(p.title && p.fnName && p.solution && Array.isArray(p.tests) && p.tests.length,
      `bài ${p.id} thiếu field`);
    // chạy thật lời giải mẫu trong sandbox, so với expected
    let fn;
    try {
      // dựng hàm trong CÙNG realm (không dùng vm) để Array/Object so sánh được bằng deepStrictEqual
      fn = new Function(`return (${p.solution})`)();
    } catch (e) {
      assert.fail(`bài ${p.id}: solution không parse được — ${e.message}`);
    }
    assert.strictEqual(typeof fn, 'function', `bài ${p.id}: solution không phải hàm`);
    for (const t of p.tests) {
      const got = fn(...JSON.parse(JSON.stringify(t.args)));
      assert.deepStrictEqual(got, t.expected,
        `bài ${p.id}: f(${JSON.stringify(t.args)}) = ${JSON.stringify(got)} ≠ ${JSON.stringify(t.expected)}`);
    }
  }
});

test('iq-questions: id duy nhất, answer hợp lệ, options ≥ 2, d ∈ 1..3', () => {
  const qs = loadWindow('iq-questions.js').IQ_QUESTIONS;
  assert.ok(Array.isArray(qs) && qs.length);
  const ids = qs.map(q => q.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'id IQ trùng: ' +
    ids.filter((x, i) => ids.indexOf(x) !== i));
  for (const q of qs) {
    assert.ok(Array.isArray(q.options) && q.options.length >= 2, `IQ ${q.id}: <2 lựa chọn`);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length,
      `IQ ${q.id}: answer ngoài range`);
    if (q.d != null) assert.ok([1, 2, 3].includes(q.d), `IQ ${q.id}: d không hợp lệ`);
  }
});

test('english-questions: id duy nhất, answer hợp lệ', () => {
  const qs = loadWindow('english-questions.js').ENGLISH_QUESTIONS;
  assert.ok(Array.isArray(qs) && qs.length);
  const ids = qs.map(q => q.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'id English trùng');
  for (const q of qs) {
    assert.ok(Array.isArray(q.options) && q.options.length >= 2, `EN ${q.id}: <2 lựa chọn`);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length,
      `EN ${q.id}: answer ngoài range`);
  }
});

test('situational-questions: id duy nhất, answer hợp lệ', () => {
  const qs = loadWindow('situational-questions.js').SITUATIONAL_QUESTIONS;
  assert.ok(Array.isArray(qs) && qs.length);
  const ids = qs.map(q => q.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'id tình huống trùng');
  for (const q of qs) {
    assert.ok(Array.isArray(q.options) && q.options.length >= 2, `SIT ${q.id}: <2 lựa chọn`);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length,
      `SIT ${q.id}: answer ngoài range`);
  }
});

test('design-drills: id duy nhất, rubric key duy nhất + tổng trọng số = 100, keyPoints đủ', () => {
  const ds = loadWindow('design-drills.js').DESIGN_DRILLS;
  assert.ok(Array.isArray(ds) && ds.length);
  const ids = ds.map(d => d.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'id drill trùng');
  for (const d of ds) {
    assert.ok(d.title && d.scenario && Array.isArray(d.focus) && d.focus.length, `drill ${d.id} thiếu field`);
    assert.ok(['Dễ', 'TB', 'Khó'].includes(d.difficulty), `drill ${d.id}: difficulty lạ`);
    assert.ok(Array.isArray(d.keyPoints) && d.keyPoints.length >= 3, `drill ${d.id}: keyPoints < 3`);
    const ks = d.rubric.map(r => r.k);
    assert.strictEqual(new Set(ks).size, ks.length, `drill ${d.id}: rubric key trùng`);
    for (const r of d.rubric) {
      assert.ok(r.label && r.hint && typeof r.w === 'number', `drill ${d.id}/${r.k}: thiếu field`);
    }
    const sum = d.rubric.reduce((s, r) => s + r.w, 0);
    assert.strictEqual(sum, 100, `drill ${d.id}: tổng trọng số = ${sum} ≠ 100`);
  }
});

// ---------------------------------------------------------------------------
// B. WIRING TĨNH (phân tích văn bản app.js + index.html)
// ---------------------------------------------------------------------------

/** Gom mọi id "có sẵn": id="x" trong HTML + trong template app.js + el.id='x'. */
function availableIds() {
  const ids = new Set();
  const collect = (src, re) => { let m; while ((m = re.exec(src))) ids.add(m[1]); };
  collect(HTML, /\bid=["']([\w-]+)["']/g);
  collect(APP, /\bid=["'`]([\w-]+)["'`]/g);          // id="x" trong innerHTML template
  collect(APP, /\.id\s*=\s*['"]([\w-]+)['"]/g);      // el.id = 'x'
  collect(APP, /\bid:\s*['"]([\w-]+)['"]/g);         // {id:'x'} → render qua id="${c.id}"
  return ids;
}

test('wiring: mọi getElementById("x") literal đều có id tồn tại (bắt typo)', () => {
  const ids = availableIds();
  const miss = [];
  const re = /getElementById\(\s*['"]([\w-]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(APP))) if (!ids.has(m[1])) miss.push(m[1]);
  assert.deepStrictEqual([...new Set(miss)], [], 'getElementById trỏ id không tồn tại');
});

test('wiring: mỗi tab data-view có <div id="view-X"> + nhánh trong switchView', () => {
  const tabViews = [...HTML.matchAll(/class="tab[^"]*"\s+data-view="([\w-]+)"/g)].map(m => m[1]);
  assert.ok(tabViews.length >= 10, 'phải có ≥10 tab');
  for (const v of tabViews) {
    assert.ok(HTML.includes(`id="view-${v}"`), `thiếu <div id="view-${v}">`);
    assert.ok(new RegExp(`name === '${v}'`).test(APP) || v === 'docs',
      `switchView thiếu nhánh cho '${v}'`);
  }
});

test('wiring: order phím tắt khớp đúng tập tab', () => {
  const tabViews = [...HTML.matchAll(/class="tab[^"]*"\s+data-view="([\w-]+)"/g)].map(m => m[1]);
  const om = APP.match(/const order = \[([^\]]+)\]/);
  assert.ok(om, 'không tìm thấy mảng order');
  const order = om[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
  assert.deepStrictEqual(order, tabViews, 'order phím tắt lệch với thứ tự tab');
});

test('wiring: GATED_VIEWS ⊆ tập tab (trừ docs), không khóa tab không tồn tại', () => {
  const tabViews = new Set([...HTML.matchAll(/data-view="([\w-]+)"/g)].map(m => m[1]));
  const gm = APP.match(/GATED_VIEWS = new Set\(\[([^\]]+)\]\)/);
  assert.ok(gm, 'không tìm thấy GATED_VIEWS');
  const gated = gm[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
  for (const g of gated) assert.ok(tabViews.has(g), `GATED_VIEWS có '${g}' không phải tab`);
  assert.ok(!gated.includes('docs'), 'docs không được khóa (đọc tự do)');
});

test('PREP_KEYS: không trùng + có các key quan trọng', () => {
  const m = APP.match(/const PREP_KEYS = \[([\s\S]*?)\]/);
  assert.ok(m, 'không tìm thấy PREP_KEYS');
  const keys = m[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
  assert.strictEqual(new Set(keys).size, keys.length, 'PREP_KEYS trùng: ' +
    keys.filter((x, i) => keys.indexOf(x) !== i));
  for (const k of ['prep-progress', 'prep-srs', 'prep-design-history']) {
    assert.ok(keys.includes(k), `PREP_KEYS thiếu ${k}`);
  }
  assert.ok(!keys.includes('prep-ai-key'), 'prep-ai-key KHÔNG được nằm trong PREP_KEYS (không xuất key)');
});

test('regression: escHtml escape đủ & < > " (chống vỡ thuộc tính HTML)', () => {
  const m = APP.match(/const escHtml = (s => .+);/);
  assert.ok(m, 'không tìm thấy escHtml');
  const escHtml = new Function('return (' + m[1] + ')')();
  assert.strictEqual(escHtml('<a b="c">&'), '&lt;a b=&quot;c&quot;&gt;&amp;');
  assert.strictEqual(escHtml(null), ''); // không ném khi null/undefined
});

test('regression: không còn marked.parse() thiếu guard window.marked (vỡ khi offline)', () => {
  const lines = APP.split('\n');
  const bad = lines
    .map((l, i) => ({ l, i: i + 1 }))
    .filter(({ l }) => /marked\.parse\(/.test(l) && !/window\.marked/.test(l))
    .map(({ i }) => i);
  assert.deepStrictEqual(bad, [], 'marked.parse thiếu guard ở dòng');
});

test('output-quiz: id duy nhất, answer hợp lệ, options ≥ 2', () => {
  const qs = loadWindow('output-quiz.js').OUTPUT_QUIZ;
  assert.ok(Array.isArray(qs) && qs.length);
  const ids = qs.map(q => q.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'id output-quiz trùng');
  for (const q of qs) {
    assert.ok(q.code && q.explain && q.topic, `OQ ${q.id} thiếu field`);
    assert.ok(Array.isArray(q.options) && q.options.length >= 2, `OQ ${q.id}: <2 lựa chọn`);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length,
      `OQ ${q.id}: answer ngoài range`);
  }
});

test('output-quiz: CHẠY THẬT mỗi snippet → output đúng = options[answer], và đáp án duy nhất', async () => {
  const qs = loadWindow('output-quiz.js').OUTPUT_QUIZ;
  for (const q of qs) {
    const logs = [];
    const fakeConsole = { log: (...a) => logs.push(a.map(String).join(' ')) };
    new Function('console', q.code)(fakeConsole);
    await new Promise(r => setTimeout(r, 60)); // xả micro/macrotask (Promise, setTimeout 0)
    const out = logs.join('\n');
    assert.strictEqual(out, q.options[q.answer],
      `OQ ${q.id}: output thật ${JSON.stringify(out)} ≠ đáp án ${JSON.stringify(q.options[q.answer])}`);
    assert.strictEqual(q.options.filter(o => o === out).length, 1,
      `OQ ${q.id}: có >1 option khớp output (đáp án không duy nhất)`);
  }
});

test('debug-challenges: id duy nhất, fnName đủ, BẤT BIẾN fixed pass hết & buggy fail ≥1', () => {
  const cs = loadWindow('debug-challenges.js').DEBUG_CHALLENGES;
  assert.ok(Array.isArray(cs) && cs.length);
  const ids = cs.map(c => c.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'id debug trùng');
  const run = (code, fnName, tests) => {
    const fn = new Function(`${code}\n;return typeof ${fnName}==="function"?${fnName}:undefined;`)();
    assert.strictEqual(typeof fn, 'function', `${fnName} không phải hàm`);
    return tests.map(t => {
      try { return JSON.stringify(fn(...JSON.parse(JSON.stringify(t.args)))) === JSON.stringify(t.expected); }
      catch { return false; }
    });
  };
  for (const c of cs) {
    assert.ok(c.title && c.fnName && c.buggy && c.fixed && c.bugHint && c.explain, `debug ${c.id} thiếu field`);
    assert.ok(Array.isArray(c.tests) && c.tests.length, `debug ${c.id} thiếu test`);
    const fixed = run(c.fixed, c.fnName, c.tests);
    assert.ok(fixed.every(Boolean), `debug ${c.id}: bản FIXED không pass hết test`);
    const buggy = run(c.buggy, c.fnName, c.tests);
    assert.ok(buggy.some(r => !r), `debug ${c.id}: bản BUGGY pass hết → không có bug thật để sửa`);
  }
});

test('api-quiz: id duy nhất, answer hợp lệ, options ≥ 2, đủ field', () => {
  const qs = loadWindow('api-quiz.js').API_QUIZ;
  assert.ok(Array.isArray(qs) && qs.length >= 10);
  const ids = qs.map(q => q.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'id api-quiz trùng');
  for (const q of qs) {
    assert.ok(q.q && q.explain && q.topic, `API ${q.id} thiếu field`);
    assert.ok(Array.isArray(q.options) && q.options.length >= 2, `API ${q.id}: <2 lựa chọn`);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length,
      `API ${q.id}: answer ngoài range`);
  }
});

test('wiring: chế độ API/HTTP có đủ id + mode button + script + engine', () => {
  assert.ok(HTML.includes('id="think-api"'), 'thiếu #think-api');
  assert.ok(HTML.includes('id="api-body"'), 'thiếu #api-body');
  assert.ok(HTML.includes('data-mode="api"'), 'thiếu nút mode api');
  assert.ok(HTML.includes('src="api-quiz.js"'), 'index.html thiếu script api-quiz.js');
  assert.ok(HTML.indexOf('src="api-quiz.js"') < HTML.indexOf('src="app.js"'), 'api-quiz.js phải nạp trước app.js');
  assert.ok(/function makeQuiz\b/.test(APP), 'thiếu engine makeQuiz');
  assert.ok(/renderApiQuiz\(\)/.test(APP), 'initThink chưa gọi renderApiQuiz');
  assert.ok(/document\.getElementById\('think-api'\)\.hidden/.test(APP), 'setThinkMode chưa toggle think-api');
});

test('sql-drill: id duy nhất, answer hợp lệ, options ≥ 2, đủ field', () => {
  const qs = loadWindow('sql-drill.js').SQL_DRILL;
  assert.ok(Array.isArray(qs) && qs.length >= 10);
  const ids = qs.map(q => q.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'id sql-drill trùng');
  for (const q of qs) {
    assert.ok(q.q && q.explain && q.topic, `SQL ${q.id} thiếu field`);
    assert.ok(Array.isArray(q.options) && q.options.length >= 2, `SQL ${q.id}: <2 lựa chọn`);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length,
      `SQL ${q.id}: answer ngoài range`);
    if ('sql' in q) assert.ok(typeof q.sql === 'string' && q.sql.length, `SQL ${q.id}: trường sql rỗng`);
  }
});

test('wiring: chế độ SQL Drill có đủ id + mode button + script + engine', () => {
  assert.ok(HTML.includes('id="think-sql"'), 'thiếu #think-sql');
  assert.ok(HTML.includes('id="sql-body"'), 'thiếu #sql-body');
  assert.ok(HTML.includes('data-mode="sql"'), 'thiếu nút mode sql');
  assert.ok(HTML.includes('src="sql-drill.js"'), 'index.html thiếu script sql-drill.js');
  assert.ok(HTML.indexOf('src="sql-drill.js"') < HTML.indexOf('src="app.js"'), 'sql-drill.js phải nạp trước app.js');
  assert.ok(/renderSqlQuiz\(\)/.test(APP), 'initThink chưa gọi renderSqlQuiz');
  assert.ok(/document\.getElementById\('think-sql'\)\.hidden/.test(APP), 'setThinkMode chưa toggle think-sql');
  assert.ok(/window\.SQL_DRILL/.test(APP), 'sqlQuiz chưa trỏ tới window.SQL_DRILL');
});

test('cli-quiz: id duy nhất, answer hợp lệ, options ≥ 2, đủ field', () => {
  const qs = loadWindow('cli-quiz.js').CLI_QUIZ;
  assert.ok(Array.isArray(qs) && qs.length >= 10);
  const ids = qs.map(q => q.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'id cli-quiz trùng');
  for (const q of qs) {
    assert.ok(q.q && q.explain && q.topic, `CLI ${q.id} thiếu field`);
    assert.ok(Array.isArray(q.options) && q.options.length >= 2, `CLI ${q.id}: <2 lựa chọn`);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length,
      `CLI ${q.id}: answer ngoài range`);
    if ('cmd' in q) assert.ok(typeof q.cmd === 'string' && q.cmd.length, `CLI ${q.id}: trường cmd rỗng`);
  }
});

test('wiring: chế độ CLI Quiz có đủ id + mode button + script + engine', () => {
  assert.ok(HTML.includes('id="think-cli"'), 'thiếu #think-cli');
  assert.ok(HTML.includes('id="cli-body"'), 'thiếu #cli-body');
  assert.ok(HTML.includes('data-mode="cli"'), 'thiếu nút mode cli');
  assert.ok(HTML.includes('src="cli-quiz.js"'), 'index.html thiếu script cli-quiz.js');
  assert.ok(HTML.indexOf('src="cli-quiz.js"') < HTML.indexOf('src="app.js"'), 'cli-quiz.js phải nạp trước app.js');
  assert.ok(/renderCliQuiz\(\)/.test(APP), 'initThink chưa gọi renderCliQuiz');
  assert.ok(/document\.getElementById\('think-cli'\)\.hidden/.test(APP), 'setThinkMode chưa toggle think-cli');
  assert.ok(/window\.CLI_QUIZ/.test(APP), 'cliQuiz chưa trỏ tới window.CLI_QUIZ');
});

test('java-quiz: id duy nhất, answer hợp lệ, options ≥ 2, đủ field', () => {
  const qs = loadWindow('java-quiz.js').JAVA_QUIZ;
  assert.ok(Array.isArray(qs) && qs.length >= 20, 'JAVA_QUIZ phải ≥20 câu');
  const ids = qs.map(q => q.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'id java-quiz trùng');
  for (const q of qs) {
    assert.ok(q.q && q.explain && q.topic, `JAVA ${q.id} thiếu field`);
    assert.ok(q.id.startsWith('java-'), `JAVA ${q.id} thiếu prefix java-`);
    assert.ok(Array.isArray(q.options) && q.options.length >= 2, `JAVA ${q.id}: <2 lựa chọn`);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length,
      `JAVA ${q.id}: answer ngoài range`);
    if ('code' in q) assert.ok(typeof q.code === 'string' && q.code.length, `JAVA ${q.id}: trường code rỗng`);
  }
  // đáp án đúng không trùng với lựa chọn khác trong cùng câu (tránh 2 đáp án)
  for (const q of qs) assert.strictEqual(new Set(q.options).size, q.options.length, `JAVA ${q.id}: options trùng nhau`);
  // chủ đề Testing (JUnit/Mockito) — chốt để không bị xoá nhầm
  assert.ok(qs.some(q => /Testing/.test(q.topic)), 'java-quiz thiếu nhóm Testing (JUnit/Mockito)');
  // nhóm Java 8+ và Java mới (record/sealed/var/virtual thread) — có bài java/12 dạy, chốt không xoá nhầm
  assert.ok(qs.some(q => /^Java 8\+/.test(q.topic)), 'java-quiz thiếu nhóm Java 8+ (Stream/Optional)');
  assert.ok(qs.some(q => /^Java mới/.test(q.topic)), 'java-quiz thiếu nhóm Java mới (record/sealed/vthread)');
});

test('wiring: 📋 nút copy trên code block tài liệu (renderDoc gắn .pre-copy + copyText, CSS hover)', () => {
  const seg = APP.slice(APP.indexOf("querySelectorAll('.md pre')"), APP.indexOf("querySelectorAll('.md pre')") + 600);
  assert.ok(seg.includes("className = 'pre-copy'") && seg.includes('copyText('), 'renderDoc chưa gắn nút .pre-copy gọi copyText');
  const CSS = read('styles.css');
  assert.ok(CSS.includes('.md pre .pre-copy') && CSS.includes('.md pre:hover .pre-copy'), 'styles.css thiếu style .pre-copy');
});

test('wiring: 🔄 banner "có bản mới" khi SW mới activate giữa phiên', () => {
  // LUÔN nghe controllerchange; lần bắn đầu của phiên khởi đầu uncontrolled (cài đầu/hard-refresh)
  // chỉ là "SW nhận trang" — phải bỏ qua rồi mới coi các lần sau là update thật
  const seg = APP.slice(APP.indexOf('function initPwa'), APP.indexOf('function initPwa') + 1900);
  assert.ok(/let swWasControlled = !!navigator\.serviceWorker\.controller;[\s\S]{0,220}controllerchange[\s\S]{0,220}if \(!swWasControlled\) \{ swWasControlled = true; return; \}[\s\S]{0,80}showUpdateBanner\(\)/.test(seg),
    'initPwa phải luôn gắn listener controllerchange và chỉ bỏ qua lần bắn đầu của phiên uncontrolled');
  assert.ok(seg.includes('reg.update()'), 'thiếu check update định kỳ cho tab mở lâu');
  assert.ok(/function showUpdateBanner[\s\S]{0,400}update-reload[\s\S]{0,200}location\.reload\(\)/.test(APP),
    'showUpdateBanner phải có nút Tải lại gọi location.reload');
  const CSS = read('styles.css');
  assert.ok(CSS.includes('#update-banner'), 'styles.css thiếu #update-banner');
});

test('wiring: apiFile tự nạp lại docs.json khi thiếu bài (deploy mới) + SW nhả request no-store', () => {
  const seg = APP.slice(APP.indexOf('async function apiFile'), APP.indexOf('async function apiFile') + 900);
  assert.ok(seg.includes('_docsRefreshed') && seg.includes("cache: 'no-store'"),
    'apiFile thiếu retry nạp lại docs.json no-store (1 lần/phiên)');
  assert.ok(SW.includes("req.cache === 'no-store'"),
    'sw.js phải bỏ qua request no-store — không thì retry vẫn dính stale-while-revalidate');
});

test('wiring: 📖 Gần đây trong sidebar — openDoc ghi prep-recent-docs (dedupe, cap 8) + render nhóm đầu tree', () => {
  assert.ok(/prep-recent-docs'\)?, \[\]\)\.filter\(p => p !== relPath\)/.test(APP) || APP.includes("store.get('prep-recent-docs', []).filter(p => p !== relPath)"),
    'openDoc phải dedupe rồi unshift vào prep-recent-docs');
  assert.ok(APP.includes('recent.slice(0, 8)'), 'prep-recent-docs phải cap 8');
  const seg = APP.slice(APP.indexOf('function renderRecentDocs'), APP.indexOf('function renderRecentDocs') + 1400);
  assert.ok(seg.includes("'sb-recent'") && seg.includes('sb.prepend(g)') && seg.includes('p !== currentDoc'),
    'renderRecentDocs phải prepend nhóm sb-recent và ẩn bài đang mở');
  assert.ok(/function loadTree[\s\S]{0,1600}renderRecentDocs\(\);/.test(APP), 'loadTree phải gọi renderRecentDocs sau khi dựng tree');
  assert.ok(/PREP_KEYS = \[[^\]]*'prep-recent-docs'/.test(APP), 'PREP_KEYS thiếu prep-recent-docs (export/sync/reset)');
  // entry chết tự gỡ khi mở fail + sync/import từ máy khác phải vẽ lại nhóm
  assert.ok(/if \(md === null\) \{[\s\S]{0,800}rec\.filter\(p => p !== relPath\)[\s\S]{0,120}renderRecentDocs\(\)/.test(APP),
    'openDoc fail phải gỡ entry chết khỏi prep-recent-docs');
  // token chống race: nhiều lượt mở song song → chỉ lượt mới nhất render
  assert.ok(/const seq = openDoc\._seq = \(openDoc\._seq \|\| 0\) \+ 1;[\s\S]{0,700}await apiFile\(relPath\);[\s\S]{0,120}if \(seq !== openDoc\._seq\) return;/.test(APP),
    'openDoc thiếu sequence token chống race');
  assert.ok(/function applyPrepData[\s\S]{0,300}renderRecentDocs\(\)/.test(APP),
    'applyPrepData phải vẽ lại 📖 Gần đây (sidebar ngoài view, reapplyView không đụng)');
  // task 📖 Đọc tiếp ở tab Hôm nay: bài dở → mở lại; đã đọc xong → gợi ý bài KẾ TIẾP chưa đọc
  assert.ok(/Đọc tiếp: \$\{docLabelOf\(lastDoc\)\}/.test(APP), 'td-read thiếu nhánh đọc tiếp bài dở');
  assert.ok(/if \(readMap\[lastDoc\]\)[\s\S]{0,420}flat\.slice\(at \+ 1\)\.find\(i => !readMap\[i\.path\]\)[\s\S]{0,120}Bài tiếp theo/.test(APP),
    'td-read thiếu nhánh học tuần tự bài kế chưa đọc');
  assert.ok(/id: 'td-read'[\s\S]{0,120}openDoc\(target\)/.test(APP), 'td-read phải mở target');
  assert.ok(/function docLabelOf/.test(APP), 'thiếu helper docLabelOf dùng chung');
});

test('wiring: 📗 đánh dấu bài đã đọc — cuộn ≥90% hoặc bài ngắn, ✓ sidebar, sync đủ', () => {
  assert.ok(/function markDocRead/.test(APP) && /function refreshReadMarks/.test(APP), 'thiếu markDocRead/refreshReadMarks');
  assert.ok(/if \(read\[p\]\) return;[\s\S]{0,220}logActivity\(\)/.test(APP),
    'đọc trọn bài lần đầu phải logActivity (streak/heatmap) — sau guard chống đếm trùng');
  // clientHeight > 0 BẮT BUỘC ở cả 2 nhánh: openDoc chạy lúc #content display:none (init đậu tab khác)
  // thì scrollHeight=clientHeight=0 → không guard là bài dài bị mark oan mỗi lần reload (bug HIGH QA 17/07)
  assert.ok(/currentDoc && content\.clientHeight > 0 &&[\s\S]{0,90}content\.scrollTop \+ content\.clientHeight >= content\.scrollHeight - 40/.test(APP),
    'listener cuộn phải guard clientHeight>0 và đo chạm đáy (chừa 40px)');
  assert.ok(/function checkShortDocRead[\s\S]{0,320}clientHeight > 0[\s\S]{0,120}scrollHeight <= content\.clientHeight \+ 40/.test(APP),
    'checkShortDocRead phải guard clientHeight>0');
  assert.ok(/if \(name === 'docs'\) \{ restoreDocScroll\(\); checkShortDocRead\(\); \}/.test(APP),
    'switchView(docs) phải re-check bài ngắn + restore (QA vòng 3+4)');
  // fail path phải vô hiệu currentDoc + dọn prep-last-doc chết (chặn mark oan bài dở + task Đọc tiếp lỗi mãi)
  assert.ok(/if \(md === null\) \{[\s\S]{0,320}currentDoc = null;[\s\S]{0,320}store\.set\('prep-last-doc', null\)/.test(APP),
    'openDoc fail phải set currentDoc=null và dọn prep-last-doc chết');
  // Dashboard chỉ đếm bài còn sống trong tree (khớp badge sidebar)
  assert.ok(/livePaths[\s\S]{0,220}filter\(p => livePaths\.has\(p\)\)/.test(APP),
    'dash-docs-read phải lọc path chết bằng livePaths');
  assert.ok(/PREP_KEYS = \[[^\]]*'prep-docs-read'/.test(APP), 'PREP_KEYS thiếu prep-docs-read');
  assert.ok(/function applyPrepData[\s\S]{0,400}refreshReadMarks\(\)/.test(APP), 'applyPrepData phải refresh ✓ đã đọc');
  const CSS = read('styles.css');
  assert.ok(CSS.includes('.sb-item.read'), 'styles.css thiếu .sb-item.read');
  // đếm x/y đã đọc theo nhóm (bỏ nhóm ảo Gần đây), đủ 100% đổi màu
  const seg = APP.slice(APP.indexOf('function refreshReadMarks'), APP.indexOf('function refreshReadMarks') + 1200);
  assert.ok(seg.includes("g.id === 'sb-recent'") && seg.includes("'sb-count'") && seg.includes('sb-count-full'),
    'refreshReadMarks thiếu badge x/y theo nhóm sidebar');
  assert.ok(CSS.includes('.sb-count'), 'styles.css thiếu .sb-count');
  // thanh tiến độ đọc ở Dashboard
  assert.ok(HTML.includes('id="dash-docs-read"'), 'index.html thiếu #dash-docs-read');
  assert.ok(/dash-docs-read[\s\S]{0,600}prep-docs-read[\s\S]{0,1400}dash-read-open/.test(APP),
    'renderDashboard thiếu thanh 📗 Tài liệu đã đọc');
  assert.ok(/#dash-capstone, #dash-docs-read \{ display: flex/.test(read('styles.css')),
    'thanh docs-read phải dùng chung layout flex 1 dòng với capstone (từng vỡ 3 dòng)');
});

test('wiring: 📑 mục lục bài — ≥3 h2 gắn details.doc-toc, click scrollIntoView + tự đóng', () => {
  const seg = APP.slice(APP.indexOf("toc.className = 'doc-toc'") - 300, APP.indexOf("toc.className = 'doc-toc'") + 800);
  assert.ok(seg.includes('heads.length >= 3') && seg.includes("h.scrollIntoView({ block: 'start' })") &&
    seg.includes('toc.open = false') && seg.includes('b.textContent = h.textContent'),
    'doc-toc thiếu wiring (ngưỡng 3 h2 / scroll / tự đóng / textContent chống XSS)');
  assert.ok(read('styles.css').includes('.doc-toc'), 'styles.css thiếu .doc-toc');
});

test('wiring: 🔖 nhớ vị trí đọc dở từng bài — lưu idle 400ms localStorage thẳng (không sync), mở lại nhảy đúng chỗ', () => {
  assert.ok(/openDoc\._posT = setTimeout[\s\S]{0,320}pos\[currentDoc\] = content\.scrollTop[\s\S]{0,120}localStorage\.setItem\('prep-doc-scroll'/.test(APP),
    'thiếu lưu vị trí cuộn debounce vào prep-doc-scroll (localStorage thẳng, không qua store.set)');
  assert.ok(/function restoreDocScroll[\s\S]{0,420}content\.scrollTop = Math\.min\(saved, content\.scrollHeight\)/.test(APP),
    'restoreDocScroll phải clamp scrollHeight');
  assert.ok(/if \(name === 'docs'\) \{ restoreDocScroll\(\); checkShortDocRead\(\); \}/.test(APP),
    'switchView(docs) phải restore bookmark (bài mở nền lúc init không đo được — QA4)');
  assert.ok(/function docScrollMap[\s\S]{0,180}catch \{ return \{\}; \}/.test(APP),
    'docScrollMap phải parse an toàn (key hỏng → rỗng)');
  assert.ok(/Chốt bookmark bài ĐANG mở[\s\S]{0,420}localStorage\.setItem\('prep-doc-scroll'/.test(APP),
    'openDoc phải flush bookmark bài cũ trước khi chuyển (debounce chưa nổ)');
  // 📑 doc-toc + 📝 doc-note cũng là <details> — chế độ quiz phải loại cả hai khỏi đếm & gắn judge
  assert.ok(/querySelectorAll\('details:not\(\.doc-toc\):not\(\.doc-note\)'\)\.length/.test(APP) &&
    /mdEl\.querySelectorAll\('details:not\(\.doc-toc\):not\(\.doc-note\)'\)/.test(APP),
    'attachQuizMode/detailsCount phải dùng details:not(.doc-toc):not(.doc-note)');
});

test('wiring: 📝 ghi chú cá nhân theo bài — textarea tự lưu prep-doc-notes, flush khi chuyển bài, sync cloud', () => {
  const seg = APP.slice(APP.indexOf("noteBox.className = 'doc-note'") - 300, APP.indexOf("noteBox.className = 'doc-note'") + 1400);
  assert.ok(seg.includes("store.get('prep-doc-notes', {})[relPath]") &&
    seg.includes("store.set('prep-doc-notes', all)") &&
    seg.includes('delete all[relPath]'), 'doc-note thiếu wiring lưu/xoá note theo path');
  assert.ok(seg.includes('setTimeout(saveNote, 600)'), 'note phải autosave debounce');
  assert.ok(/openDoc\._noteFlush = \(\) => \{ if \(ta\._t\) saveNote\(\); \}/.test(APP) &&
    /openDoc\._noteFlush\?\.\(\);/.test(APP),
    'openDoc phải flush note đang gõ dở của bài cũ trước khi chuyển bài');
  // Các fix QA 22/07: sync cloud không đè note đang gõ, pagehide flush, chống kiểu dữ liệu hỏng
  assert.ok(/openDoc\._noteSync = \(\) => \{[\s\S]{0,220}document\.activeElement === ta/.test(APP) &&
    /openDoc\._noteSync\?\.\(\);/.test(APP.slice(APP.indexOf('function applyPrepData'))),
    'applyPrepData phải gọi openDoc._noteSync (guard đang gõ) — kẻo save đè bản mới máy khác (QA H1)');
  assert.ok(/pagehide.*openDoc\._noteFlush/.test(APP), 'phải flush note khi pagehide (QA M2)');
  assert.ok(seg.includes("String(store.get('prep-doc-notes', {})[relPath] ?? '')"),
    'giá trị note phải qua String() — blob hỏng kiểu không được làm .trim() throw (QA L1)');
  assert.ok(/'prep-doc-notes'\]/.test(APP) || /'prep-doc-notes'/.test(APP.slice(APP.indexOf('PREP_KEYS'))),
    'prep-doc-notes phải nằm trong PREP_KEYS để export/sync cloud');
  assert.ok(read('styles.css').includes('.doc-note-ta'), 'styles.css thiếu .doc-note-ta');
});

test('wiring: 📝 panel ghi chú Dashboard + chấm noted trên sidebar', () => {
  assert.ok(read('index.html').includes('id="dash-notes"'), 'index.html thiếu #dash-notes');
  const seg = APP.slice(APP.indexOf('function renderNotes'), APP.indexOf('function renderDashboard'));
  assert.ok(seg.includes("getElementById('dash-notes')") &&
    seg.includes('escHtml(docLabelOf(p))') && seg.includes('escHtml(snip.slice(0, 140))'),
    'renderNotes phải escape label + snippet (chống XSS từ nội dung note)');
  assert.ok(seg.includes('delete all[b.dataset.path]') && seg.includes('refreshReadMarks()'),
    'renderNotes thiếu xoá note / cập nhật chấm sidebar');
  assert.ok(/renderMockWrong\(\);\s*\n\s*renderNotes\(\);/.test(APP), 'renderDashboard phải gọi renderNotes');
  assert.ok(/b\.classList\.toggle\('noted', !!\(notes\[b\.dataset\.path\] \|\| ''\)\.trim\(\)\)/.test(APP),
    'refreshReadMarks phải toggle class noted theo prep-doc-notes');
  assert.ok(read('styles.css').includes('.sb-item.noted::before') && read('styles.css').includes('.note-row'),
    'styles.css thiếu .sb-item.noted / .note-row');
});

test('wiring: 📝 ghi chú vào tìm kiếm toàn cục — tính live, không cache vào gsIndex', () => {
  const seg = APP.slice(APP.indexOf('gsHits = gsSearch(qstr)'), APP.indexOf('gsHits = gsSearch(qstr)') + 900);
  assert.ok(seg.includes("store.get('prep-doc-notes', {})") &&
    seg.includes("badge: '📝 Ghi chú'") &&
    seg.includes('nTerms.every(t => gsNorm(v + \' \' + docLabelOf(p)).includes(t))'),
    'renderGsResults phải khớp note theo AND mọi từ khoá đã bỏ dấu');
  assert.ok(seg.includes('gsHits = noteHits.concat(gsHits).slice(0, 30)'),
    'note hits phải xếp trước và tôn trọng trần 30 kết quả');
  const bgi = APP.slice(APP.indexOf('function buildGsIndex'), APP.indexOf('function gsSearch'));
  assert.ok(bgi.length > 0 && !bgi.includes('prep-doc-notes'),
    'KHÔNG được đưa note vào gsIndex cache (note đổi liên tục, index build 1 lần)');
});

test('wiring: 📤 xuất ghi chú ra markdown từ panel Dashboard', () => {
  const seg = APP.slice(APP.indexOf('function renderNotes'), APP.indexOf('function renderDashboard'));
  assert.ok(seg.includes('id="notes-export"') && seg.includes("getElementById('notes-export')"),
    'panel notes thiếu nút 📤 Xuất .md');
  assert.ok(seg.includes("type: 'text/markdown'") &&
    seg.includes('`## ${docLabelOf(p)}') &&
    seg.includes('ghi-chu-${dayKey(new Date())}.md'),
    'export phải sinh markdown theo H2 từng bài + tên file có ngày');
  assert.ok(seg.includes("replace(/^(#+)/gm, '\\\\$1')"),
    'nội dung note phải escape dòng bắt đầu # khi export (QA N2)');
  assert.ok(seg.includes('URL.revokeObjectURL(a.href)'), 'export phải revoke blob URL');
});

test('wiring: ⏱️ đo thời gian học thực tế — visible + không AFK mới tính, localStorage thẳng', () => {
  const seg = APP.slice(APP.indexOf('function initStudyTimer'), APP.indexOf('/** Ghi nhận một lượt học'));
  assert.ok(seg.includes("document.visibilityState !== 'visible'") &&
    seg.includes('Date.now() - lastActive > 120000'),
    'timer phải bỏ qua tab nền và AFK >2 phút');
  assert.ok(seg.includes("localStorage.setItem('prep-study-time'") && !seg.includes('store.set'),
    'prep-study-time phải ghi localStorage THẲNG (không store.set — kẻo push cloud mỗi phút)');
  assert.ok(seg.includes('while (keys.length > 60)'), 'phải cắt còn 60 ngày');
  assert.ok(!APP.includes("'prep-study-time',") || !APP.slice(APP.indexOf('const PREP_KEYS')).slice(0, 2000).includes('prep-study-time'),
    'prep-study-time KHÔNG được nằm trong PREP_KEYS');
  assert.ok(/initStudyTimer\(\);/.test(APP), 'init phải gọi initStudyTimer');
  assert.ok(APP.includes('fmtStudyTime(studyMinutesToday())'), 'Today/Dashboard phải hiển thị ⏱ thời gian hôm nay');
});

test('wiring: ⏱ đồ thị phút học 14 ngày ở Dashboard', () => {
  assert.ok(read('index.html').includes('id="dash-chart-time"'), 'index.html thiếu #dash-chart-time');
  const seg = APP.slice(APP.indexOf('function renderCharts'), APP.indexOf('function renderCharts') + 2400);
  assert.ok(seg.includes("barChart('dash-chart-time'") &&
    seg.includes('const tmap = studyTimeMap()') &&
    seg.includes('fmtStudyTime(d.m)'),
    'renderCharts phải vẽ chart phút học từ prep-study-time cùng khung 14 ngày với chart lượt học');
});

test('wiring: 🔔 nhắc giờ học hằng ngày — input time tab Hôm nay, chống nhắc trùng trong ngày', () => {
  const seg = APP.slice(APP.indexOf('function initStudyReminder'), APP.indexOf('/** Ghi nhận một lượt học'));
  assert.ok(seg.includes("store.get('prep-remind-time', '')") &&
    seg.includes("localStorage.getItem('prep-remind-last') === k") &&
    seg.includes('pomoNotify('),
    'initStudyReminder thiếu đọc giờ / guard đã-nhắc-hôm-nay / Notification');
  assert.ok(seg.includes('if (cur < t) return;') && !seg.includes('cur !== t'),
    'reminder phải so "đã qua giờ" (cur < t) — máy ngủ nhảy qua phút hẹn vẫn nhắc bù (QA M1)');
  assert.ok(/initStudyReminder\(\);/.test(APP), 'init phải gọi initStudyReminder');
  assert.ok(APP.includes('id="td-remind"') && APP.includes("getElementById('td-remind')"),
    'tab Hôm nay thiếu input 🔔 td-remind');
  assert.ok(APP.includes("Notification.permission === 'default')\n      Notification.requestPermission()"),
    'đặt giờ nhắc phải xin quyền Notification nếu chưa hỏi');
  assert.ok(APP.slice(APP.indexOf('const PREP_KEYS')).slice(0, 2200).includes('prep-remind-time'),
    'prep-remind-time phải trong PREP_KEYS (sync cloud, đổi hiếm)');
});

test('wiring: ❓ câu hỏi hôm nay — deterministic theo ngày, không chặn render, đếm 1 lượt học', () => {
  const seg = APP.slice(APP.indexOf('async function renderQotd'), APP.indexOf('async function renderToday'));
  assert.ok(seg.includes('await loadMockPool()') && seg.includes('h % pool.length') &&
    seg.includes("(h * 31 + c.charCodeAt(0)) >>> 0"),
    'renderQotd phải hash dayKey → index ổn định trong ngày');
  assert.ok(/const el = document\.getElementById\(elId\)/.test(seg) && seg.includes('!el) return'),
    'phải query lại element SAU await — user rời tab thì bỏ');
  assert.ok(seg.includes('removeEventListener') && seg.includes('logActivity()'),
    'mở đáp án = 1 lượt học, chỉ đếm 1 lần');
  assert.ok(seg.includes("localStorage.getItem('prep-qotd-seen') !== dayKey(new Date())"),
    '1 câu/ngày chỉ 1 lượt dù mở cả Home lẫn Hôm nay (QA4 L)');
  assert.ok(seg.includes("el.querySelector('.qotd-next').onclick = () => draw(pool[Math.floor(Math.random() * pool.length)], true)") &&
    seg.includes('draw(pool[h % pool.length], false)'),
    'nút 🎲 Câu khác phải re-draw ngẫu nhiên, câu mặc định vẫn deterministic');
  assert.ok(read('styles.css').includes('.qotd-next'), 'styles.css thiếu .qotd-next');
  assert.ok(APP.includes('<div id="td-qotd"></div>') && /renderQotd\(\);/.test(APP),
    'renderToday phải chứa placeholder + gọi renderQotd không await');
  assert.ok(APP.includes('<div id="home-qotd"></div>') && APP.includes("renderQotd('home-qotd')") &&
    APP.includes("async function renderQotd(elId = 'td-qotd')"),
    'Home (công khai) cũng phải có card QOTD — renderQotd nhận elId, không trùng id giữa 2 view');
  assert.ok(read('styles.css').includes('.td-qotd'), 'styles.css thiếu .td-qotd');
});

test('wiring: 📊 tổng kết 7 ngày qua vs 7 ngày trước ở Dashboard', () => {
  assert.ok(read('index.html').includes('id="dash-week"'), 'index.html thiếu #dash-week');
  const seg = APP.slice(APP.indexOf('function renderWeekSummary'), APP.indexOf('function logReadiness'));
  assert.ok(seg.includes('sumRange(acts, 0, 7)') && seg.includes('sumRange(acts, 7, 14)') &&
    seg.includes('readIn(0, 7)') && seg.includes('readIn(7, 14)'),
    'phải so đủ 3 chỉ số cùng khung [0,7) vs [7,14) ngày');
  assert.ok(seg.includes("el.innerHTML = ''; return;"), 'chưa có dữ liệu thì ẩn hẳn dòng tổng kết');
  assert.ok(seg.includes("p === 0 ? (n ? '<span class=\"wk-up\">mới ↑</span>' : '')"),
    'tuần trước 0 không được chia cho 0 — hiện "mới ↑"');
  assert.ok(/renderHeatmap\(\);\s*\n\s*renderWeekSummary\(\);/.test(APP), 'renderDashboard phải gọi renderWeekSummary');
  // QA2 H1: .dash-week đã là hàng checklist kế hoạch tuần (flex+border) — tổng kết tuần phải dùng class RIÊNG
  assert.ok(read('index.html').includes('class="dash-wk7"') && read('styles.css').includes('.dash-wk7'),
    'tổng kết tuần phải dùng class .dash-wk7, không trùng .dash-week cũ');
  assert.ok(seg.includes('readByDay') && seg.includes('sumRange(readByDay, from, to)'),
    'bài đọc phải quy về dayKey dùng chung định nghĩa 7 ngày lịch (QA2 L2)');
  assert.ok(seg.includes('Math.min(999,'), 'trend ↑ phải cap 999% (QA2 N1)');
});

test('wiring: các fix QA vòng 2 — nhắc trễ khi đặt giờ quá khứ, note không sống lại, pool rỗng không cache', () => {
  assert.ok(/if \(e\.target\.value && e\.target\.value <= cur\) localStorage\.setItem\('prep-remind-last'/.test(APP),
    'đặt giờ đã qua hôm nay phải đánh dấu đã-nhắc kẻo bị nhắc liền sau 30s (QA2 M1)');
  const del = APP.slice(APP.indexOf(".note-del')"), APP.indexOf('function renderDashboard'));
  assert.ok(del.includes('openDoc._noteSync?.();'),
    'xoá note từ Dashboard phải _noteSync làm trống textarea bài đang mở (QA2 M2)');
  assert.ok(/if \(!pool\.length\) \{ mockPoolPromise = null; return \[\]; \}/.test(APP),
    'doLoadMockPool không được cache mảng rỗng cả phiên khi offline (QA2 L1)');
});

test('wiring: 📁 nhớ nhóm sidebar thu gọn qua reload', () => {
  assert.ok(APP.includes('g.dataset.gtitle = group.title') && APP.includes("g.dataset.gtitle = '📖 Gần đây'"),
    'mọi sb-group phải gắn data-gtitle để nhận diện');
  assert.ok((APP.match(/g\.classList\.toggle\('collapsed'\); saveSbCollapsed\(\);/g) || []).length === 2,
    'cả 2 chỗ toggle collapse phải save trạng thái');
  assert.ok(APP.includes("localStorage.setItem('prep-sb-collapsed'") &&
    /function restoreSbCollapsed[\s\S]{0,320}catch \{ closed = new Set\(\); \}/.test(APP),
    'save/restore prep-sb-collapsed phải là localStorage thẳng + parse an toàn');
  assert.ok(/restoreSbCollapsed\(\); \/\/ nhớ nhóm/.test(APP) && /sb\.prepend\(g\);\s*\n\s*restoreSbCollapsed/.test(APP),
    'restore phải chạy sau buildTree VÀ sau khi dựng lại nhóm Gần đây');
});

test('wiring: 🔠 A−/A+ cỡ chữ bài đọc — clamp 13..22, lưu localStorage, áp qua CSS var', () => {
  const seg = APP.slice(APP.indexOf('const DOC_FONT_MIN'), APP.indexOf('// ---------- Nhớ nhóm sidebar'));
  assert.ok(seg.includes('DOC_FONT_MIN = 13, DOC_FONT_MAX = 22') &&
    seg.includes("localStorage.getItem('prep-doc-font')") &&
    seg.includes("setProperty('--doc-fs', docFontPx() + 'px')"),
    'docFontPx/applyDocFont thiếu clamp hoặc CSS var');
  assert.ok(seg.includes('Math.min(DOC_FONT_MAX, Math.max(DOC_FONT_MIN, docFontPx() + delta))'),
    'giá trị lưu phải clamp ngay khi bấm, không chỉ khi đọc');
  assert.ok(/initDocFont\(\);/.test(APP), 'init phải gọi initDocFont');
  assert.ok(read('styles.css').includes('font-size: var(--doc-fs, 16px)') && read('styles.css').includes('#doc-font'),
    'styles.css: .md phải ăn --doc-fs và có cụm nút #doc-font');
  assert.ok(/QA3 N1[\s\S]{0,240}#doc-font \{ right: 12px; bottom: 56px/.test(read('styles.css')),
    'media query mobile phải thu nhỏ cụm nút nổi (QA3 N1)');
});

test('wiring: 📏 thanh tiến độ đọc theo % cuộn', () => {
  const seg = APP.slice(APP.indexOf('function initReadProgress'), APP.indexOf('// ---------- Nhớ nhóm sidebar'));
  assert.ok(seg.includes("bar.id = 'doc-progress'") &&
    seg.includes('content.parentElement.insertBefore(bar, content)') &&
    seg.includes('content.scrollHeight - content.clientHeight'),
    'bar phải nằm NGOÀI #content (innerHTML đổi bài không vứt) và tính theo scroll max');
  assert.ok(/initReadProgress\(\);/.test(APP), 'init phải gọi initReadProgress');
  assert.ok(read('styles.css').includes('#doc-progress') && read('styles.css').includes('pointer-events: none'),
    'styles.css thiếu #doc-progress (phải pointer-events none)');
});

test('wiring: 🔊 đọc to bài bằng TTS — đọc theo khối, bỏ code/toc/note, dừng khi chuyển bài', () => {
  const seg = APP.slice(APP.indexOf('let docSpeaking'), APP.indexOf('// ---------- 🔠'));
  assert.ok(seg.includes("!el.closest('pre') && !el.closest('.doc-toc') && !el.closest('.doc-note')"),
    'phải bỏ code block + doc-toc + doc-note khỏi nội dung đọc');
  // đọc từ vị trí đang cuộn + highlight khối đang đọc
  assert.ok(seg.includes('x.el.getBoundingClientRect().bottom > cTop') && seg.includes('if (i < 0) i = 0'),
    'phải bắt đầu từ khối đầu tiên trong viewport (getBoundingClientRect, fallback 0)');
  assert.ok(seg.includes("cur.el.classList.add('tts-now')") &&
    /function stopDocSpeak[\s\S]{0,260}tts-now/.test(APP) &&
    read('styles.css').includes('.md .tts-now'),
    'khối đang đọc phải highlight .tts-now và gỡ khi dừng');
  assert.ok(seg.includes("u.lang = 'vi-VN'") && seg.includes('u.onend = next') && seg.includes('u.onerror = () => next()'),
    'đọc tuần tự từng khối, lỗi 1 khối phải đọc tiếp');
  assert.ok(seg.includes('speechSynthesis.cancel()'), 'stopDocSpeak phải cancel TTS');
  assert.ok(/openDoc\._noteFlush\?\.\(\);\s*\n\s*stopDocSpeak\(\);/.test(APP),
    'openDoc phải dừng đọc bài cũ khi chuyển bài');
  // QA3: H1 switchView phải stopDocSpeak TRƯỚC cancel() thô; M1 chống đọc trùng li lồng / <li><p>
  assert.ok(/stopDocSpeak\(\); \/\/ PHẢI reset docSpeaking TRƯỚC cancel/.test(APP),
    'switchView phải stopDocSpeak — cancel() thô làm chuỗi đọc hồi sinh trong view mới (QA3 H1)');
  assert.ok(APP.includes("!(el.tagName === 'P' && el.closest('li'))") &&
    APP.includes("/^(UL|OL)$/.test(n.tagName)"),
    'TTS phải bỏ p-trong-li và text list con của li (QA3 M1 — chống đọc trùng)');
  assert.ok(APP.includes("speak.id = 'doc-speak-btn'") && APP.includes('speak.onclick = toggleDocSpeak'),
    'nút 🔊 phải nằm trong cụm #doc-font');
  // ⏩ tốc độ đọc: chỉ nhận giá trị trong TTS_RATES (chống localStorage rác), áp mỗi utterance
  assert.ok(APP.includes('TTS_RATES.includes(v) ? v : 1') && APP.includes('u.rate = ttsRate()'),
    'ttsRate phải validate whitelist + áp vào từng utterance');
  assert.ok(APP.includes("rate.id = 'doc-rate-btn'") &&
    APP.includes('TTS_RATES[(TTS_RATES.indexOf(ttsRate()) + 1) % TTS_RATES.length]'),
    'nút tốc độ phải xoay vòng TTS_RATES');
  // phím S đọc bài — CHỈ khi view-docs active (S của flashcards là handler riêng theo view)
  assert.ok(/e\.key === 's' \|\| e\.key === 'S'[\s\S]{0,260}view-docs[\s\S]{0,160}toggleDocSpeak\(\)/.test(APP),
    'phím S phải guard view-docs active rồi mới toggleDocSpeak');
  assert.ok(/keys: \['S'\], desc: '🔊 Đọc to/.test(APP), 'bảng phím tắt phải có dòng S');
  assert.ok(/cell\.title = `\$\{dayKey\(day\)\}: \$\{n\} lượt học\$\{mins \?/.test(APP),
    'heatmap tooltip phải kèm ⏱ phút học khi có');
});

test('wiring: 🔮 dự báo ngày đọc xong theo pace 14 ngày', () => {
  const seg = APP.slice(APP.indexOf('const recent14'), APP.indexOf('id="dash-read-open"'));
  assert.ok(seg.includes('+ts > Date.now() - 14 * DAY') && seg.includes('livePaths.has(p)'),
    'pace phải tính từ bài CÒN SỐNG đọc trong 14 ngày');
  assert.ok(seg.includes('left > 0 && recent14 > 0') && seg.includes('Math.ceil(left / (recent14 / 14))'),
    'chỉ dự báo khi còn bài + có pace (không chia 0), công thức days đúng');
  assert.ok(seg.includes('🎉 đã đọc hết'), 'đọc hết phải hiện 🎉 thay vì dự báo');
  assert.ok(seg.includes("d.getFullYear() !== new Date().getFullYear() ? `/${d.getFullYear()}` : ''"),
    'dự báo rơi sang năm khác phải hiện năm (QA4 M)');
  assert.ok(read('styles.css').includes('.dc-fc'), 'styles.css thiếu .dc-fc');
});

test('wiring: SW networkFirst phải né HTTP cache của trình duyệt (GH Pages max-age=600)', () => {
  const sw = read('sw.js');
  assert.ok(sw.includes("fetch(fresh ? new Request(req.url, { cache: 'no-cache' }) : req)") &&
    sw.includes("req.mode === 'navigate' || /\\/(app\\.js|styles\\.css)$/"),
    "networkFirst: no-cache CHỈ cho navigate + app.js/styles.css — bank .js bất biến giữ fetch thường (QA3 M2)");
});

test('wiring: ↑ nút nổi lên đầu bài — hiện khi cuộn >600px, nằm trong view-docs, reset khi mở bài mới', () => {
  const seg = APP.slice(APP.indexOf("tb.id = 'doc-top'") - 200, APP.indexOf("tb.id = 'doc-top'") + 900);
  assert.ok(seg.includes("appendChild(tb)") && seg.includes('content.scrollTop < 600') &&
    seg.includes('content.scrollTop = 0; tb.hidden = true'), 'doc-top thiếu wiring scroll/click');
  assert.ok(/openDoc\._topBtn\.hidden = true/.test(APP), 'mở bài mới phải ẩn lại nút doc-top');
  assert.ok(read('styles.css').includes('#doc-top'), 'styles.css thiếu #doc-top');
});

test('wiring: ◀▶ điều hướng bài trước/tiếp cuối mỗi bài docs theo thứ tự TREE', () => {
  const seg = APP.slice(APP.indexOf("nav.className = 'doc-nav'") - 400, APP.indexOf("nav.className = 'doc-nav'") + 800);
  assert.ok(seg.includes('flat.findIndex(i => i.path === relPath)') && seg.includes('flat[at - 1]') && seg.includes('flat[at + 1]'),
    'doc-nav phải tra prev/next từ TREE phẳng theo path');
  assert.ok(seg.includes('escHtml(prev.label.trim())') && seg.includes('openDoc(item.path)'),
    'nút doc-nav phải escape label và mở đúng path');
  const CSS = read('styles.css');
  assert.ok(CSS.includes('.doc-nav') && CSS.includes('.doc-nav-btn'), 'styles.css thiếu .doc-nav');
  // phím ←/→ chỉ hoạt động khi view Học active (tránh bấm nhầm nút doc-nav đang ẩn từ view khác)
  assert.ok(/ArrowLeft' \|\| e\.key === 'ArrowRight'[\s\S]{0,320}if \(e\.shiftKey\) return;[\s\S]{0,260}view-docs'\)\?\.classList\.contains\('active'\)[\s\S]{0,220}doc-nav-btn/.test(APP),
    'initShortcuts thiếu ←/→ (guard shiftKey + view-docs active)');
  assert.ok(/desc: 'Bài trước \/ bài tiếp/.test(APP), 'bảng phím tắt thiếu dòng ←/→ doc-nav');
});

test('wiring: 🎓 thi thử theo 1 mảng — select exam-mode + buildExamQueue(onlyMode); nước rút giữ mọi mảng', () => {
  assert.ok(/id="exam-mode"/.test(APP), 'renderExam thiếu select #exam-mode');
  assert.ok(/function buildExamQueue\(n, onlyMode\)[\s\S]{0,220}!onlyMode \|\| mode === onlyMode/.test(APP),
    'buildExamQueue phải lọc theo onlyMode');
  assert.ok(/exam-go-20'\)\.onclick = \(\) => startExam\(20, 15, false, scopeOf\(\)\)/.test(APP),
    'nút thi 20 câu phải truyền scope');
  assert.ok(/exam-go-sprint'\)\.onclick = \(\) => startExam\(15, 10, true\)/.test(APP),
    'nước rút KHÔNG nhận scope (luôn trộn theo độ yếu)');
  // scope ghi vào lịch sử + state bài dở + giữ lựa chọn giữa các lượt renderExam
  assert.ok(/sprint: examSprint, scope: examScope, modes: byMode/.test(APP), 'history entry thiếu scope');
  assert.ok(/scope: examScope, idx: examIdx/.test(APP) && /examScope = s\.scope \|\| ''/.test(APP),
    'saveExamState/restore thiếu scope');
  assert.ok(/sel\.value = examScopeSel/.test(APP) && /if \(!sprint\) examScopeSel = examScope/.test(APP),
    'renderExam khôi phục lựa chọn qua examScopeSel (sprint không xoá)');
  const CSS = read('styles.css');
  assert.ok(CSS.includes('.exam-scope'), 'styles.css thiếu .exam-scope');
});

test('quality: không view nào tự set display ở selector ID — sẽ đè .view{display:none} và chồng dưới view khác', () => {
  const CSS = read('styles.css');
  for (const m of CSS.matchAll(/#view-[a-z-]+(?:\s*,\s*#view-[a-z-]+)*\s*\{([^}]*)\}/g)) {
    assert.ok(!/display\s*:/.test(m[1]), `rule "${m[0].slice(0, 60)}…" set display — dùng .view.active thay vì ID`);
  }
});

test('quality: không sót ký tự Trung trong bank/app (trừ zh-vocab.js — bank tiếng Trung hợp lệ)', () => {
  // Đề nhập từ nguồn Trung (JavaGuide...) từng lọt 穿透/回表/新特性... ra UI — đã dọn 17/07, chốt không tái phạm.
  const files = fs.readdirSync(PUB).filter(f => f.endsWith('.js') && f !== 'zh-vocab.js');
  for (const f of files) {
    const m = read(f).match(/[\u3000-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff01-\uff60]+/);
    assert.strictEqual(m, null, `${f} còn ký tự Trung sót: "${m && m[0]}"`);
  }
  // track java/ (nguồn nhập chính) cũng phải sạch
  const JAVA = path.resolve(PUB, '..', '..', 'java');
  for (const f of fs.readdirSync(JAVA).filter(f => f.endsWith('.md'))) {
    const m = fs.readFileSync(path.join(JAVA, f), 'utf8').match(/[\u3000-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff01-\uff60]+/);
    assert.strictEqual(m, null, `java/${f} còn ký tự Trung sót: "${m && m[0]}"`);
  }
});

test('wiring: chế độ ☕ Java có đủ id + mode button + script + engine + QUIZ_MODES', () => {
  assert.ok(HTML.includes('id="think-java"'), 'thiếu #think-java');
  assert.ok(HTML.includes('id="java-body"'), 'thiếu #java-body');
  assert.ok(HTML.includes('data-mode="java"'), 'thiếu nút mode java');
  assert.ok(HTML.includes('data-cov="java"'), 'thiếu badge độ phủ java');
  assert.ok(HTML.includes('src="java-quiz.js"'), 'index.html thiếu script java-quiz.js');
  assert.ok(HTML.indexOf('src="java-quiz.js"') < HTML.indexOf('src="app.js"'), 'java-quiz.js phải nạp trước app.js');
  assert.ok(/renderJavaQuiz\(\)/.test(APP), 'initThink chưa gọi renderJavaQuiz');
  assert.ok(/document\.getElementById\('think-java'\)\.hidden = m !== 'java'/.test(APP), 'setThinkMode chưa toggle think-java');
  assert.ok(/window\.JAVA_QUIZ/.test(APP), 'javaQuiz chưa trỏ tới window.JAVA_QUIZ');
  // java phải là 1 mode trong QUIZ_MODES → tự vào 🔁 ôn câu sai + 🎓 thi thử + độ phủ
  assert.ok(/java: \{[\s\S]*?doneKey: 'prep-java-done'/.test(APP), 'QUIZ_MODES thiếu entry java');
  const keys = APP.slice(APP.indexOf('const PREP_KEYS'), APP.indexOf('const PREP_KEYS') + 2200);
  assert.ok(/'prep-java-done'/.test(keys) && /'prep-java-best'/.test(keys), 'PREP_KEYS thiếu prep-java-done/best');
  const sw = read('sw.js');
  assert.ok(sw.includes("'java-quiz.js'"), 'sw.js PRECACHE thiếu java-quiz.js');
});

test('redis-quiz: id duy nhất, answer hợp lệ, options ≥ 2, đủ field', () => {
  const qs = loadWindow('redis-quiz.js').REDIS_QUIZ;
  assert.ok(Array.isArray(qs) && qs.length >= 10, 'REDIS_QUIZ phải ≥10 câu');
  const ids = qs.map(q => q.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'id redis-quiz trùng');
  for (const q of qs) {
    assert.ok(q.q && q.explain && q.topic, `REDIS ${q.id} thiếu field`);
    assert.ok(q.id.startsWith('redis-'), `REDIS ${q.id} thiếu prefix redis-`);
    assert.ok(Array.isArray(q.options) && q.options.length >= 2, `REDIS ${q.id}: <2 lựa chọn`);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, `REDIS ${q.id}: answer ngoài range`);
    assert.strictEqual(new Set(q.options).size, q.options.length, `REDIS ${q.id}: options trùng nhau`);
    if ('cmd' in q) assert.ok(typeof q.cmd === 'string' && q.cmd.length, `REDIS ${q.id}: trường cmd rỗng`);
  }
});

test('wiring: chế độ ☁️ Redis có đủ id + mode button + script + engine + QUIZ_MODES', () => {
  assert.ok(HTML.includes('id="think-redis"'), 'thiếu #think-redis');
  assert.ok(HTML.includes('id="redis-body"'), 'thiếu #redis-body');
  assert.ok(HTML.includes('data-mode="redis"'), 'thiếu nút mode redis');
  assert.ok(HTML.includes('data-cov="redis"'), 'thiếu badge độ phủ redis');
  assert.ok(HTML.includes('src="redis-quiz.js"'), 'index.html thiếu script redis-quiz.js');
  assert.ok(HTML.indexOf('src="redis-quiz.js"') < HTML.indexOf('src="app.js"'), 'redis-quiz.js phải nạp trước app.js');
  assert.ok(/renderRedisQuiz\(\)/.test(APP), 'initThink chưa gọi renderRedisQuiz');
  assert.ok(/document\.getElementById\('think-redis'\)\.hidden = m !== 'redis'/.test(APP), 'setThinkMode chưa toggle think-redis');
  assert.ok(/window\.REDIS_QUIZ/.test(APP), 'redisQuiz chưa trỏ tới window.REDIS_QUIZ');
  assert.ok(/redis: \{[\s\S]*?doneKey: 'prep-redis-done'/.test(APP), 'QUIZ_MODES thiếu entry redis');
  const keys = APP.slice(APP.indexOf('const PREP_KEYS'), APP.indexOf('const PREP_KEYS') + 2200);
  assert.ok(/'prep-redis-done'/.test(keys) && /'prep-redis-best'/.test(keys), 'PREP_KEYS thiếu prep-redis-done/best');
  const sw = read('sw.js');
  assert.ok(sw.includes("'redis-quiz.js'"), 'sw.js PRECACHE thiếu redis-quiz.js');
});

test('dist-quiz: id duy nhất, answer hợp lệ, options ≥ 2, đủ field', () => {
  const qs = loadWindow('dist-quiz.js').DIST_QUIZ;
  assert.ok(Array.isArray(qs) && qs.length >= 10, 'DIST_QUIZ phải ≥10 câu');
  const ids = qs.map(q => q.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'id dist-quiz trùng');
  for (const q of qs) {
    assert.ok(q.q && q.explain && q.topic, `DIST ${q.id} thiếu field`);
    assert.ok(q.id.startsWith('dist-'), `DIST ${q.id} thiếu prefix dist-`);
    assert.ok(Array.isArray(q.options) && q.options.length >= 2, `DIST ${q.id}: <2 lựa chọn`);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, `DIST ${q.id}: answer ngoài range`);
    assert.strictEqual(new Set(q.options).size, q.options.length, `DIST ${q.id}: options trùng nhau`);
  }
});

test('wiring: chế độ 🏗️ Phân tán có đủ id + mode button + script + engine + QUIZ_MODES', () => {
  assert.ok(HTML.includes('id="think-dist"'), 'thiếu #think-dist');
  assert.ok(HTML.includes('id="dist-body"'), 'thiếu #dist-body');
  assert.ok(HTML.includes('data-mode="dist"'), 'thiếu nút mode dist');
  assert.ok(HTML.includes('data-cov="dist"'), 'thiếu badge độ phủ dist');
  assert.ok(HTML.includes('src="dist-quiz.js"'), 'index.html thiếu script dist-quiz.js');
  assert.ok(HTML.indexOf('src="dist-quiz.js"') < HTML.indexOf('src="app.js"'), 'dist-quiz.js phải nạp trước app.js');
  assert.ok(/renderDistQuiz\(\)/.test(APP), 'initThink chưa gọi renderDistQuiz');
  assert.ok(/document\.getElementById\('think-dist'\)\.hidden = m !== 'dist'/.test(APP), 'setThinkMode chưa toggle think-dist');
  assert.ok(/window\.DIST_QUIZ/.test(APP), 'distQuiz chưa trỏ tới window.DIST_QUIZ');
  assert.ok(/dist: \{[\s\S]*?doneKey: 'prep-dist-done'/.test(APP), 'QUIZ_MODES thiếu entry dist');
  const keys = APP.slice(APP.indexOf('const PREP_KEYS'), APP.indexOf('const PREP_KEYS') + 2300);
  assert.ok(/'prep-dist-done'/.test(keys) && /'prep-dist-best'/.test(keys), 'PREP_KEYS thiếu prep-dist-done/best');
  const sw = read('sw.js');
  assert.ok(sw.includes("'dist-quiz.js'"), 'sw.js PRECACHE thiếu dist-quiz.js');
});

test('devops-quiz: id duy nhất, answer hợp lệ, options ≥ 2, đủ field', () => {
  const qs = loadWindow('devops-quiz.js').DEVOPS_QUIZ;
  assert.ok(Array.isArray(qs) && qs.length >= 10, 'DEVOPS_QUIZ phải ≥10 câu');
  const ids = qs.map(q => q.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'id devops-quiz trùng');
  for (const q of qs) {
    assert.ok(q.q && q.explain && q.topic, `DEVOPS ${q.id} thiếu field`);
    assert.ok(q.id.startsWith('devops-'), `DEVOPS ${q.id} thiếu prefix devops-`);
    assert.ok(Array.isArray(q.options) && q.options.length >= 2, `DEVOPS ${q.id}: <2 lựa chọn`);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, `DEVOPS ${q.id}: answer ngoài range`);
    assert.strictEqual(new Set(q.options).size, q.options.length, `DEVOPS ${q.id}: options trùng nhau`);
  }
});

test('wiring: chế độ 🐳 DevOps có đủ id + mode button + script + engine + QUIZ_MODES', () => {
  assert.ok(HTML.includes('id="think-devops"'), 'thiếu #think-devops');
  assert.ok(HTML.includes('id="devops-body"'), 'thiếu #devops-body');
  assert.ok(HTML.includes('data-mode="devops"'), 'thiếu nút mode devops');
  assert.ok(HTML.includes('data-cov="devops"'), 'thiếu badge độ phủ devops');
  assert.ok(HTML.includes('src="devops-quiz.js"'), 'index.html thiếu script devops-quiz.js');
  assert.ok(HTML.indexOf('src="devops-quiz.js"') < HTML.indexOf('src="app.js"'), 'devops-quiz.js phải nạp trước app.js');
  assert.ok(/renderDevopsQuiz\(\)/.test(APP), 'initThink chưa gọi renderDevopsQuiz');
  assert.ok(/document\.getElementById\('think-devops'\)\.hidden = m !== 'devops'/.test(APP), 'setThinkMode chưa toggle think-devops');
  assert.ok(/window\.DEVOPS_QUIZ/.test(APP), 'devopsQuiz chưa trỏ tới window.DEVOPS_QUIZ');
  assert.ok(/devops: \{[\s\S]*?doneKey: 'prep-devops-done'/.test(APP), 'QUIZ_MODES thiếu entry devops');
  const keys = APP.slice(APP.indexOf('const PREP_KEYS'), APP.indexOf('const PREP_KEYS') + 2400);
  assert.ok(/'prep-devops-done'/.test(keys) && /'prep-devops-best'/.test(keys), 'PREP_KEYS thiếu prep-devops-done/best');
  const sw = read('sw.js');
  assert.ok(sw.includes("'devops-quiz.js'"), 'sw.js PRECACHE thiếu devops-quiz.js');
});

test('wiring: chế độ 🔁 Ôn câu sai đủ HTML + toggle + badge + render', () => {
  assert.ok(HTML.includes('id="think-review"'), 'thiếu #think-review');
  assert.ok(HTML.includes('id="review-body"'), 'thiếu #review-body');
  assert.ok(HTML.includes('id="review-count"'), 'thiếu badge #review-count');
  assert.ok(HTML.includes('data-mode="review"'), 'thiếu nút mode review');
  assert.ok(/document\.getElementById\('think-review'\)\.hidden = m !== 'review'/.test(APP),
    'setThinkMode chưa toggle think-review');
  assert.ok(/if \(m === 'review'\) renderReview\(\)/.test(APP), 'setThinkMode chưa gọi renderReview khi vào mode');
  assert.ok(/function renderReview\b/.test(APP) && /function startReview\b/.test(APP) &&
    /function answerReview\b/.test(APP) && /function finishReview\b/.test(APP), 'thiếu hàm engine review');
  assert.ok(/function goToQuizReview\b/.test(APP), 'thiếu goToQuizReview để mở từ tab Hôm nay');
  // warm-up trộn nhanh: dùng chung engine review
  assert.ok(/function buildMixedQueue\b/.test(APP) && /function startMixed\b/.test(APP),
    'thiếu buildMixedQueue/startMixed cho phiên trộn nhanh');
  assert.ok(/id="review-mix"/.test(APP), 'thiếu nút review-mix trong renderReview');
  assert.ok(/startMixed\(10\)/.test(APP), 'nút trộn nhanh chưa gọi startMixed(10)');
});

test('wiring: chế độ 🎓 Thi thử đủ HTML + toggle + engine + dọn timer + PREP_KEYS', () => {
  assert.ok(HTML.includes('id="think-exam"'), 'thiếu #think-exam');
  assert.ok(HTML.includes('id="exam-body"'), 'thiếu #exam-body');
  assert.ok(HTML.includes('data-mode="exam"'), 'thiếu nút mode exam');
  assert.ok(/document\.getElementById\('think-exam'\)\.hidden = m !== 'exam'/.test(APP),
    'setThinkMode chưa toggle think-exam');
  assert.ok(/if \(m === 'exam'\) renderExam\(\)/.test(APP), 'setThinkMode chưa gọi renderExam khi vào mode');
  assert.ok(/function buildExamQueue\b/.test(APP) && /function renderExam\b/.test(APP) &&
    /function startExam\b/.test(APP) && /function answerExam\b/.test(APP) && /function finishExam\b/.test(APP),
    'thiếu hàm engine thi thử');
  // Rời tab / đổi mode phải dừng ticker (bài dở giữ nguyên, đồng hồ tính theo deadline examEndMs)
  const clears = APP.match(/clearInterval\(examTimerId\)/g) || [];
  assert.ok(clears.length >= 3, 'switchView/setThinkMode/showExamQ chưa dọn examTimerId đủ chỗ');
  // Câu sai của bài thi phải đổ về hàng đợi 🔁 và câu đúng tính độ phủ (doneKey)
  const fin = APP.slice(APP.indexOf('function finishExam'));
  assert.ok(/recordWrong\(item\.mode, item\.q\.id\)/.test(fin), 'finishExam chưa recordWrong câu sai');
  assert.ok(/clearWrong\(item\.mode, item\.q\.id\)/.test(fin), 'finishExam chưa clearWrong câu đúng');
  const keys = APP.slice(APP.indexOf('const PREP_KEYS'), APP.indexOf('const PREP_KEYS') + 2000);
  assert.ok(/'prep-exam-history'/.test(keys), 'PREP_KEYS thiếu prep-exam-history (sync/export/reset sẽ bỏ sót)');
  // Tích hợp: đồ thị Dashboard + task gợi ý ở tab Hôm nay
  assert.ok(HTML.includes('id="dash-chart-exam"'), 'Dashboard thiếu #dash-chart-exam');
  assert.ok(/barChart\('dash-chart-exam'/.test(APP), 'renderCharts chưa vẽ dash-chart-exam');
  assert.ok(/id: 'td-exam'/.test(APP) && /function goToExam\b/.test(APP), 'tab Hôm nay thiếu task td-exam/goToExam');
  // 3 fix từ vòng QA 08/07: double-click xuyên câu, snapshot vẽ đè giữa bài, câu chưa hiển thị đổ vào 🔁
  assert.ok(/examShownAt/.test(APP) && /Date\.now\(\) - examShownAt < 300/.test(APP),
    'answerExam thiếu guard 300ms chống double-click trả lời chui câu kế');
  assert.ok(/if \(examRunning\(\)\) return true/.test(APP), 'isEditingNow chưa coi đang-thi là đang-soạn (reapplyView sẽ vẽ đè)');
  assert.ok(/if \(idx <= examIdx\) \{ recordWrong/.test(APP), 'finishExam vẫn recordWrong cả câu chưa từng hiển thị');
  // 🔥 đề nước rút ưu tiên mảng yếu
  assert.ok(/function buildSprintExamQueue\b/.test(APP), 'thiếu buildSprintExamQueue');
  assert.ok(/id="exam-go-sprint"/.test(APP) && /startExam\(15, 10, true\)/.test(APP), 'màn bắt đầu thiếu nút 🔥 nước rút');
  assert.ok(/sprint: examSprint/.test(APP), 'lịch sử thi chưa ghi cờ sprint');
  // 💾 bài thi dở sống qua reload (F5 không thoát án hết giờ)
  assert.ok(/function saveExamState\b/.test(APP) && /function restoreExamState\b/.test(APP), 'thiếu save/restoreExamState');
  const keys2 = APP.slice(APP.indexOf('const PREP_KEYS'), APP.indexOf('const PREP_KEYS') + 2000);
  assert.ok(!/'prep-exam-state'/.test(keys2), 'prep-exam-state KHÔNG được vào PREP_KEYS (bài dở là của riêng thiết bị)');
  const resetBlock = APP.slice(APP.indexOf("dash-reset"), APP.indexOf("dash-reset") + 900);
  assert.ok(/clearExamState\(\)/.test(resetBlock), 'reset dữ liệu chưa xoá kèm bài thi dở');
  // Reset khi đang đăng nhập phải đẩy trạng thái rỗng lên cloud (khỏi bị kéo lại lúc reload/đăng nhập máy khác).
  assert.ok(/if \(syncReady && fbUser\) pushRemote\(\)/.test(resetBlock),
    'reset chưa đẩy trạng thái rỗng lên cloud → bản cloud bị kẹt, reload sẽ kéo dữ liệu về');
  const finBlock = APP.slice(APP.indexOf('function finishExam'), APP.indexOf('function finishExam') + 800);
  assert.ok(/clearExamState\(\)/.test(finBlock), 'finishExam chưa xoá bài dở đã lưu');
  assert.ok(/key !== EXAM_STATE_KEY[^)]*\) schedulePush/.test(APP),
    'onStoreWrite chưa loại prep-exam-state — mỗi câu trả lời sẽ đẩy blob không đổi lên Firestore');
  // Ping-pong fix: prep-last-view (sở thích tab cục bộ) KHÔNG được kích push, và KHÔNG nằm trong PREP_KEYS.
  assert.ok(/key !== 'prep-last-view'\) schedulePush/.test(APP),
    'onStoreWrite chưa loại prep-last-view — 2 thiết bị idle sẽ ping-pong Firestore vô hạn');
  assert.ok(!new RegExp("PREP_KEYS[\\s\\S]*?'prep-last-view'[\\s\\S]*?\\];").test(APP.slice(APP.indexOf('const PREP_KEYS'), APP.indexOf('const PREP_KEYS') + 1500)),
    'prep-last-view KHÔNG nên nằm trong PREP_KEYS (sở thích cục bộ, đồng bộ sẽ nhảy tab + góp ping-pong)');
  // 📋 copy kết quả + phân bố theo mảng trong lịch sử
  assert.ok(/modes: byMode/.test(APP), 'lịch sử thi chưa lưu phân bố modes (nguồn trend chart)');
  assert.ok(/function copyText\b/.test(APP) && /function examResultText\b/.test(APP), 'thiếu copyText/examResultText');
  assert.ok(/id="exam-copy"/.test(APP) && /examResultText\(entry\)/.test(APP), 'màn kết quả thiếu nút 📋 copy');
  // Fix QA đợt 2 (08/07): rò bài dở giữa 2 tài khoản, bài quên nhiều ngày nổ chậm, id sai mồ côi thổi trọng số
  const restoreB = APP.slice(APP.indexOf('function restoreExamState'), APP.indexOf('function restoreExamState') + 1600);
  assert.ok(/uid:/.test(APP.slice(APP.indexOf('function saveExamState'), APP.indexOf('function saveExamState') + 700)),
    'saveExamState chưa lưu uid (chống rò bài dở giữa 2 tài khoản cùng máy)');
  assert.ok(/s\.uid \?\? null/.test(restoreB), 'restoreExamState chưa so uid');
  assert.ok(/s\.endMs \+ 36e5/.test(restoreB), 'restoreExamState chưa bỏ bài quá deadline >1h (nổ chậm rác điểm)');
  assert.ok(/bankIds\.has\(id\)/.test(APP.slice(APP.indexOf('function buildSprintExamQueue'), APP.indexOf('function buildSprintExamQueue') + 1200)),
    'buildSprintExamQueue chưa lọc id sai mồ côi khỏi trọng số');
  // 📈 mũi tên xu hướng theo mảng (so với lần thi trước có modes)
  assert.ok(/ex-tr-up/.test(APP) && /ex-tr-down/.test(APP) && /h\.modes\)/.test(APP),
    'màn kết quả thiếu mũi tên xu hướng theo mảng');
  const css = read('styles.css');
  assert.ok(css.includes('.ex-tr-up') && css.includes('.ex-tr-down'), 'styles.css thiếu .ex-tr-up/.ex-tr-down');
});

// ---------- 🌏 Từ vựng Hàn/Trung + flashcards đa ngôn ngữ ----------
for (const [file, key, prefix] of [['ko-vocab.js', 'KO_VOCAB', 'ko-'], ['zh-vocab.js', 'ZH_VOCAB', 'zh-']]) {
  test(`${file}: id duy nhất prefix ${prefix}, đủ trường w/r/m/ex/exv/t, từ không trùng trong cùng chủ đề`, () => {
    const bank = loadWindow(file)[key];
    assert.ok(Array.isArray(bank) && bank.length >= 60, `${key} phải ≥60 mục`);
    const ids = bank.map(v => v.id);
    assert.strictEqual(new Set(ids).size, ids.length, `id ${key} trùng`);
    const seenWord = new Set();
    for (const v of bank) {
      assert.ok(v.id.startsWith(prefix), `id ${v.id} thiếu prefix ${prefix} (SRS dùng chung store với thẻ Anh)`);
      for (const f of ['w', 'r', 'm', 'ex', 'exv', 't']) assert.ok(v[f] && String(v[f]).trim(), `${v.id} thiếu trường ${f}`);
      const wk = v.t + '|' + v.w;
      assert.ok(!seenWord.has(wk), `từ trùng trong cùng chủ đề: ${wk}`);
      seenWord.add(wk);
      assert.ok(v.ex.includes(v.w.replace(/\(.*\)/, '').trim().split(' ')[0]) || v.ex.length > 0, `${v.id} ví dụ rỗng`);
    }
  });

  // Chặn hồi quy các lỗ hổng đã phát hiện qua audit (V18-V21):
  test(`${file}: KHÔNG đồng âm khác nghĩa / KHÔNG trùng nghĩa Việt / KHÔNG trùng ví dụ / số đếm đủ 1-10`, () => {
    const bank = loadWindow(file)[key];
    // 1. Cùng chữ gốc (w) mà KHÁC nghĩa → flashcard/quiz mơ hồ (vd ko 눈 tuyết vs mắt đã sửa)
    const byWord = new Map();
    for (const v of bank) {
      if (byWord.has(v.w) && byWord.get(v.w) !== v.m)
        assert.fail(`đồng âm khác nghĩa: "${v.w}" = "${byWord.get(v.w)}" và "${v.m}" (flashcard sẽ mơ hồ)`);
      byWord.set(v.w, v.m);
    }
    // 2. Nghĩa Việt trùng → quiz chọn nghĩa có thể có 2 đáp án đúng
    const meanings = bank.map(v => v.m);
    const dupM = meanings.filter((m, i) => meanings.indexOf(m) !== i);
    assert.strictEqual(dupM.length, 0, `nghĩa Việt trùng (quiz 2 đáp án đúng): ${[...new Set(dupM)].join(', ')}`);
    // 3. Câu ví dụ trùng y hệt giữa 2 thẻ → nên đa dạng hoá
    const exs = bank.map(v => v.ex);
    const dupEx = exs.filter((e, i) => exs.indexOf(e) !== i);
    assert.strictEqual(dupEx.length, 0, `câu ví dụ trùng: ${[...new Set(dupEx)].join(' / ')}`);
    // 4. Chủ đề Số đếm phải đủ 1..10 (đã từng thiếu 8,9)
    const nums = bank.filter(v => v.t.includes('Số đếm')).map(v => (v.m.match(/\((\d+)\)/) || [])[1]).filter(Boolean).map(Number);
    for (let n = 1; n <= 10; n++) assert.ok(nums.includes(n), `Số đếm thiếu số ${n}`);
  });
}

test('wiring: flashcards đa ngôn ngữ — select, FC_LANGS, fcDeck, TTS lang, script + precache', () => {
  assert.ok(HTML.includes('id="fc-lang"'), 'thiếu select #fc-lang');
  assert.ok(HTML.includes('src="ko-vocab.js"') && HTML.includes('src="zh-vocab.js"'), 'index.html thiếu script bank Hàn/Trung');
  assert.ok(HTML.indexOf('src="ko-vocab.js"') < HTML.indexOf('src="app.js"'), 'bank phải nạp trước app.js');
  assert.ok(/const FC_LANGS = \{/.test(APP) && /function fcDeck\b/.test(APP) && /function setFcLang\b/.test(APP), 'thiếu FC_LANGS/fcDeck/setFcLang');
  assert.ok(/function filterDeck\(week, deck = DECK\)/.test(APP), 'filterDeck chưa nhận deck tham số');
  assert.ok(/speakList\(texts, lang = 'en-US'\)/.test(APP), 'speakList chưa nhận lang');
  assert.ok(/card\.lang \|\| 'en-US'/.test(APP), 'speakCard chưa đọc theo lang của thẻ');
  const keys = APP.slice(APP.indexOf('const PREP_KEYS'), APP.indexOf('const PREP_KEYS') + 2000);
  assert.ok(/'prep-fc-lang'/.test(keys), 'PREP_KEYS thiếu prep-fc-lang');
  const sw = read('sw.js');
  assert.ok(sw.includes("'ko-vocab.js'") && sw.includes("'zh-vocab.js'"), 'sw.js PRECACHE thiếu bank Hàn/Trung');
});

test('wiring: 🎯 Quiz chọn nghĩa (Flashcards) — nút + hàm + distractor + chấm SRS', () => {
  assert.ok(HTML.includes('id="fc-quiz-btn"'), 'thiếu nút #fc-quiz-btn');
  assert.ok(/fc-quiz-btn'\)\.addEventListener\('click', fqStart\)/.test(APP), 'initFlashcards chưa wire nút Quiz nghĩa');
  for (const fn of ['function fqStart', 'function fqBegin', 'function fqShow', 'function fqAnswer', 'function fqFinish']) {
    assert.ok(APP.includes(fn), `thiếu ${fn}`);
  }
  const beg = APP.slice(APP.indexOf('function fqBegin'), APP.indexOf('function fqShow'));
  assert.ok(/allVals\.filter\(v => v !== correct\)/.test(beg), 'distractor chưa loại đáp án đúng');
  assert.ok(/options\.indexOf\(correct\)/.test(beg), 'answer chưa trỏ đúng vị trí đáp án sau khi trộn');
  const ans = APP.slice(APP.indexOf('function fqAnswer'), APP.indexOf('function fqFinish'));
  assert.ok(/bumpSrs\(it\.card, correct\)/.test(ans), 'fqAnswer chưa cập nhật SRS theo đúng/sai');
  assert.ok(/if \(it\.picked != null\) return/.test(ans), 'fqAnswer chưa chặn chấm 2 lần');
  const css = read('styles.css');
  assert.ok(css.includes('.fq-opt') && css.includes('.fq-word'), 'styles.css thiếu .fq-opt/.fq-word');
  // Quiz 2 chiều: field theo fqReverse (front↔meaning), nút đổi chiều, options ngoại ngữ khi chiều ngược
  assert.ok(/let fqReverse = false/.test(APP) && /const field = rev \? 'front' : 'meaning'/.test(beg), 'thiếu chiều Nghĩa→Từ (fqReverse/field)');
  assert.ok(/id="fq-dir"/.test(APP) && /fqReverse = !fqReverse/.test(APP), 'thiếu nút đổi chiều fq-dir');
  assert.ok(css.includes('.fq-opt-script'), 'styles.css thiếu .fq-opt-script (lựa chọn chữ ngoại ngữ)');
});

test('wiring: tab Hôm nay nhắc ôn ngoại ngữ Hàn/Trung đến hạn', () => {
  assert.ok(/function langDueCount\b/.test(APP), 'thiếu langDueCount');
  assert.ok(/function goToFlashLang\b/.test(APP), 'thiếu goToFlashLang');
  assert.ok(/function langDeck\b/.test(APP), 'thiếu langDeck (refactor từ fcDeck)');
  assert.ok(/id: `td-due-\$\{lang\}`/.test(APP), 'renderToday chưa thêm task ôn ngoại ngữ đến hạn');
  assert.ok(/\['ko', '🇰🇷'\], \['zh', '🇨🇳'\]/.test(APP), 'chưa lặp ko/zh cho task nhắc ôn');
  // goToFlashLang mở đúng ngôn ngữ + filter qua setFcLang(lang, filter)
  const g = APP.slice(APP.indexOf('function goToFlashLang'), APP.indexOf('function goToFlashLang') + 300);
  assert.ok(/setFcLang\(lang, filter/.test(g), 'goToFlashLang chưa setFcLang(lang, filter)');
  // goToFlash (đường tiếng Anh) PHẢI reset về 'en' — task Hôm nay đếm theo DECK tiếng Anh
  const gf = APP.slice(APP.indexOf('function goToFlash('), APP.indexOf('function goToFlash(') + 300);
  assert.ok(/setFcLang\('en', filter\)/.test(gf), 'goToFlash chưa reset về tiếng Anh (mở nhầm deck ngoại ngữ)');
  // setFcLang nhận weekFilter để startSession 1 lần
  assert.ok(/function setFcLang\(v, weekFilter\)/.test(APP), 'setFcLang chưa nhận weekFilter');
});

test('wiring: 🌏 Tiến độ học ngoại ngữ ở Dashboard', () => {
  assert.ok(HTML.includes('id="dash-langs"'), 'Dashboard thiếu #dash-langs');
  assert.ok(/function langProgress\b/.test(APP) && /function renderLangProgress\b/.test(APP), 'thiếu langProgress/renderLangProgress');
  assert.ok(/renderLangProgress\(\)/.test(APP.slice(APP.indexOf('function renderDashboard'), APP.indexOf('function renderDashboard') + 200)),
    'renderDashboard chưa gọi renderLangProgress');
  // chỉ hiện khi ≥2 ngôn ngữ đã bắt đầu học (r.started > 0)
  const r = APP.slice(APP.indexOf('function renderLangProgress'), APP.indexOf('function renderLangProgress') + 900);
  assert.ok(/rows\.length < 2/.test(r) && /r\.started > 0/.test(r), 'renderLangProgress chưa lọc theo ngôn ngữ đã học/≥2');
  assert.ok(/\(e\.box \|\| 0\) >= 2/.test(APP.slice(APP.indexOf('function langProgress'), APP.indexOf('function langProgress') + 400)),
    'langProgress chưa đếm "đã thuộc" theo box≥2');
  const css = read('styles.css');
  assert.ok(css.includes('.lang-prog') && css.includes('.lp-fill'), 'styles.css thiếu .lang-prog/.lp-fill');
});

test('wiring: huy hiệu học ngoại ngữ trong computeBadges', () => {
  const b = APP.slice(APP.indexOf('function computeBadges'), APP.indexOf('function goalRing'));
  for (const id of ['lang_start', 'ko20', 'zh20', 'polyglot']) {
    assert.ok(new RegExp(`B\\('${id}'`).test(b), `thiếu huy hiệu ${id}`);
  }
  assert.ok(/const koM = langProgress\('ko'\)\.mastered/.test(b), 'chưa tính koM từ langProgress');
  assert.ok(/koM \+ zhM >= 50/.test(b), 'điều kiện polyglot (Hàn+Trung ≥50) sai/thiếu');
});

test('đếm ngược PV: daysUntil tính đúng + card render + PREP_KEYS', () => {
  const fnM = APP.match(/function daysUntil\(dateStr, now = Date\.now\(\)\) \{[\s\S]*?\n}/);
  assert.ok(fnM, 'thiếu hàm daysUntil');
  const daysUntil = new Function(`${fnM[0]}\nreturn daysUntil;`)();
  const now = new Date('2026-07-01T00:00:00').getTime();
  assert.strictEqual(daysUntil('2026-07-10', now), 9, 'còn 9 ngày');
  assert.strictEqual(daysUntil('2026-07-01', now), 0, 'cùng ngày = 0');
  assert.strictEqual(daysUntil('2026-06-28', now), -3, 'đã qua = âm');
  assert.strictEqual(daysUntil('', now), null, 'rỗng → null');
  assert.strictEqual(daysUntil('không-phải-ngày', now), null, 'ngày sai → null');
  // render + wiring
  assert.ok(/function interviewCountdownHtml\b/.test(APP), 'thiếu interviewCountdownHtml');
  assert.ok(/\$\{interviewCountdownHtml\(\)\}/.test(APP), 'renderToday chưa chèn card đếm ngược');
  assert.ok(/getElementById\('td-cd-save'\)/.test(APP) && /getElementById\('td-cd-clear'\)/.test(APP),
    'chưa wire nút đặt/xoá ngày');
  assert.ok(/prep-interview-date/.test(APP), 'chưa dùng key prep-interview-date');
  const pk = APP.match(/const PREP_KEYS = \[([\s\S]*?)\]/);
  assert.ok(pk && pk[1].includes('prep-interview-date'), 'PREP_KEYS thiếu prep-interview-date');
});

test('wiring: phím số 1–9 chọn đáp án quiz khi đang làm, ngược lại chuyển tab', () => {
  assert.ok(/function quizVisibleOptions\b/.test(APP), 'thiếu helper quizVisibleOptions');
  // helper phải ràng buộc theo view-coding active + loại option trong mode ẩn
  const m = APP.match(/function quizVisibleOptions[\s\S]*?\n}/);
  assert.ok(m && /view-coding/.test(m[0]) && /classList\.contains\('active'\)/.test(m[0]),
    'quizVisibleOptions phải kiểm view-coding active');
  assert.ok(/\[hidden\]/.test(m[0]), 'quizVisibleOptions phải loại option trong mode ẩn ([hidden])');
  // handler global: nếu có option hiện thì click, else switchView
  assert.ok(/const opts = quizVisibleOptions\(\);[\s\S]*?opts\[n - 1\]\.click\(\);[\s\S]*?switchView\(order\[n - 1\]\)/.test(APP),
    'handler phím số chưa ưu tiên chọn đáp án trước khi chuyển tab');
  // Enter → sang câu tiếp
  assert.ok(/function quizNextButton\b/.test(APP), 'thiếu helper quizNextButton');
  assert.ok(/e\.key === 'Enter'[\s\S]*?quizNextButton\(\)[\s\S]*?next\.click\(\)/.test(APP),
    'handler chưa bind Enter → nút Câu tiếp');
});

test('wiring: Dashboard (renderThinkStats) surface số câu sai + CTA ôn ngay', () => {
  const m = APP.match(/function renderThinkStats\([\s\S]*?\n}/);
  assert.ok(m, 'không tìm thấy renderThinkStats');
  const fn = m[0];
  assert.ok(/wrongTotal\(\)/.test(fn), 'renderThinkStats chưa đọc wrongTotal()');
  assert.ok(/id="tk-review-go"/.test(fn), 'thiếu nút CTA tk-review-go');
  assert.ok(/goToQuizReview/.test(fn), 'CTA chưa nối goToQuizReview');
});

test('wiring: badge độ phủ (đã đúng/tổng) trên nút mode quiz', () => {
  for (const mode of ['output', 'api', 'sql', 'cli']) {
    assert.ok(new RegExp(`data-cov="${mode}"`).test(HTML), `thiếu badge độ phủ cho ${mode}`);
  }
  assert.ok(/function coverageOf\b/.test(APP) && /function refreshCoverageBadges\b/.test(APP),
    'thiếu coverageOf/refreshCoverageBadges');
  assert.ok(/function refreshThinkBadges\b/.test(APP), 'thiếu refreshThinkBadges gộp badge');
  // phải cập nhật realtime khi chấm ở engine + review + đổi mode
  assert.ok((APP.match(/refreshThinkBadges\(\)/g) || []).length >= 4,
    'refreshThinkBadges chưa được gọi đủ chỗ (initThink/setThinkMode/makeQuiz/output/review)');
});

test('review: QUIZ_MODES gồm đúng 6 mode, doneKey & bank khớp thực tế', () => {
  const m = APP.match(/const QUIZ_MODES = \{([\s\S]*?)\n\};/);
  assert.ok(m, 'không tìm thấy QUIZ_MODES');
  const block = m[1];
  const expect = {
    output: { doneKey: 'prep-oq-done', global: 'OUTPUT_QUIZ', file: 'output-quiz.js' },
    api: { doneKey: 'prep-api-done', global: 'API_QUIZ', file: 'api-quiz.js' },
    sql: { doneKey: 'prep-sql-done', global: 'SQL_DRILL', file: 'sql-drill.js' },
    cli: { doneKey: 'prep-cli-done', global: 'CLI_QUIZ', file: 'cli-quiz.js' },
    english: { doneKey: 'prep-en-done', global: 'ENGLISH_QUESTIONS', file: 'english-questions.js' },
    situational: { doneKey: 'prep-sit-done', global: 'SITUATIONAL_QUESTIONS', file: 'situational-questions.js' },
  };
  for (const [mode, e] of Object.entries(expect)) {
    assert.ok(new RegExp(`\\b${mode}:\\s*\\{`).test(block), `QUIZ_MODES thiếu mode ${mode}`);
    assert.ok(block.includes(`'${e.doneKey}'`), `QUIZ_MODES.${mode} thiếu doneKey ${e.doneKey}`);
    assert.ok(block.includes(`window.${e.global}`), `QUIZ_MODES.${mode} chưa trỏ window.${e.global}`);
    // bank thật load được để phiên ôn render đúng shape
    const qs = loadWindow(e.file)[e.global];
    assert.ok(Array.isArray(qs) && qs.length, `bank ${e.global} rỗng`);
    for (const q of qs) assert.ok('id' in q && Array.isArray(q.options) &&
      Number.isInteger(q.answer) && q.explain, `${e.global} ${q.id}: thiếu field cho review`);
  }
});

test('review: hook ghi/xoá câu sai gắn đúng vào engine quiz + PREP_KEYS', () => {
  // makeQuiz: đúng → clearWrong, sai → recordWrong
  assert.ok(/store\.set\(cfg\.doneKey, d\); clearWrong\(cfg\.mode, q\.id\);/.test(APP),
    'makeQuiz chưa clearWrong khi đúng');
  assert.ok(/else recordWrong\(cfg\.mode, q\.id\);/.test(APP), 'makeQuiz chưa recordWrong khi sai');
  // 3 mode makeQuiz phải khai báo mode
  for (const mode of ['api', 'sql', 'cli']) {
    assert.ok(new RegExp(`mode: '${mode}',\\s*\\n\\s*bodyId: '${mode}-body'`).test(APP),
      `makeQuiz ${mode} thiếu khai báo mode`);
  }
  // Đoán output cũng ghi/xoá
  assert.ok(/clearWrong\('output', q\.id\)/.test(APP) && /recordWrong\('output', q\.id\)/.test(APP),
    'answerOutputQuiz chưa ghi/xoá câu sai');
  // Vòng MCQ Phỏng vấn tổng hợp (english/situational) ghi/xoá qua modeKey
  assert.ok(/modeKey: r\.key/.test(APP), 'startMcqRound chưa lưu modeKey');
  assert.ok(/clearWrong\(m\.modeKey, q\.id\)/.test(APP) && /recordWrong\(m\.modeKey, q\.id\)/.test(APP),
    'answerMcq chưa ghi/xoá câu sai theo modeKey');
  // PREP_KEYS gồm prep-quiz-wrong để export/sync/reset
  const pk = APP.match(/const PREP_KEYS = \[([\s\S]*?)\]/);
  assert.ok(pk && pk[1].includes('prep-quiz-wrong'), 'PREP_KEYS thiếu prep-quiz-wrong');
});

test('star-questions: id duy nhất, đủ competency/q + 4 hints S/T/A/R', () => {
  const qs = loadWindow('star-questions.js').STAR_QUESTIONS;
  assert.ok(Array.isArray(qs) && qs.length >= 10, 'phải có ≥10 câu behavioral');
  const ids = qs.map(q => q.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'id star trùng');
  for (const q of qs) {
    assert.ok(q.competency && q.q, `STAR ${q.id} thiếu competency/q`);
    assert.ok(q.hints && q.hints.s && q.hints.t && q.hints.a && q.hints.r,
      `STAR ${q.id} thiếu hint S/T/A/R`);
  }
});

test('wiring: tab STAR Builder có đủ tab/view/switchView/script + helper tự chấm', () => {
  assert.ok(HTML.includes('data-view="star"'), 'thiếu nút tab star');
  assert.ok(HTML.includes('id="view-star"'), 'thiếu #view-star');
  assert.ok(HTML.includes('id="star-body"'), 'thiếu #star-body');
  assert.ok(HTML.includes('src="star-questions.js"'), 'index.html thiếu script star-questions.js');
  assert.ok(HTML.indexOf('src="star-questions.js"') < HTML.indexOf('src="app.js"'), 'star-questions.js phải nạp trước app.js');
  assert.ok(/name === 'star'/.test(APP) && /renderStar\(\)/.test(APP), 'switchView thiếu nhánh renderStar');
  assert.ok(/function starEvalDraft\b/.test(APP), 'thiếu hàm tự chấm starEvalDraft');
  assert.ok(/window\.STAR_QUESTIONS/.test(APP), 'app.js chưa đọc window.STAR_QUESTIONS');
  // PREP_KEYS phải gồm key nháp + lịch sử để export/sync
  const m = APP.match(/const PREP_KEYS = \[([\s\S]*?)\]/);
  assert.ok(m && m[1].includes('prep-star-drafts') && m[1].includes('prep-star-history'),
    'PREP_KEYS thiếu key STAR');
});

test('regression: STAR chống mất nháp + AI chấm nội dung tươi', () => {
  const block = APP.slice(APP.indexOf('function renderStarSession'), APP.indexOf('function renderStarCheck'));
  // read() phải trả null khi không còn .star-ta (tránh ghi đè nháp bằng {} sau khi rời session)
  assert.ok(/if \(!tas\.length\) return null/.test(block), 'read() chưa guard DOM trống');
  // nút back phải clearTimeout debounce trước khi rời session
  assert.ok(/star-back'\)\.onclick = \(\) => \{ clearTimeout\(saveT\)/.test(block),
    'star-back chưa clearTimeout(saveT) → orphan timer ghi đè nháp');
  // panel AI nhận HÀM getDraft (đọc tươi), không đóng băng draft
  const aiBlock = APP.slice(APP.indexOf('function starRenderAiPanel'), APP.indexOf('function starAiGrade'));
  assert.ok(/getDraft\(\)/.test(aiBlock), 'starRenderAiPanel chưa đọc nháp tươi qua getDraft()');
});

test('wiring: chế độ Sửa bug có đủ id + mode button + script + render', () => {
  assert.ok(HTML.includes('id="think-debug"'), 'thiếu #think-debug');
  assert.ok(HTML.includes('id="debug-list"'), 'thiếu #debug-list');
  assert.ok(HTML.includes('data-mode="debug"'), 'thiếu nút mode debug');
  assert.ok(HTML.includes('src="debug-challenges.js"'), 'index.html thiếu script debug-challenges.js');
  assert.ok(HTML.indexOf('src="debug-challenges.js"') < HTML.indexOf('src="app.js"'), 'debug-challenges.js phải nạp trước app.js');
  assert.ok(/renderDebugList\(\)/.test(APP), 'initThink chưa gọi renderDebugList');
});

test('wiring: chế độ Đoán output có đủ id + mode button + script + render', () => {
  assert.ok(HTML.includes('id="think-output"'), 'thiếu #think-output');
  assert.ok(HTML.includes('id="oq-body"'), 'thiếu #oq-body');
  assert.ok(HTML.includes('data-mode="output"'), 'thiếu nút mode output');
  assert.ok(HTML.includes('src="output-quiz.js"'), 'index.html thiếu script output-quiz.js');
  assert.ok(HTML.indexOf('src="output-quiz.js"') < HTML.indexOf('src="app.js"'), 'output-quiz.js phải nạp trước app.js');
  assert.ok(/renderOutputQuiz\(\)/.test(APP), 'initThink chưa gọi renderOutputQuiz');
});

test('AI chấm câu lẻ: regex bắt điểm "ĐIỂM: N/10" (gồm số thập phân)', () => {
  const re = /ĐIỂM:\s*(\d+(?:\.\d+)?)\s*\/\s*10/i;
  assert.strictEqual('nhận xét…\nĐIỂM: 7/10'.match(re)[1], '7');
  assert.strictEqual('điểm: 8.5 / 10'.match(re)[1], '8.5');
  assert.strictEqual('chưa chấm'.match(re), null);
});

test('wiring: tính năng AI chấm Mock có đủ id + helper + wiring', () => {
  for (const id of ['mk-uans', 'mk-aikey', 'mk-aigrade', 'mk-aiout']) {
    assert.ok(HTML.includes(`id="${id}"`), `index.html thiếu #${id}`);
  }
  assert.ok(/function aiGradeSingle\b/.test(APP), 'thiếu aiGradeSingle');
  assert.ok(/function mkAiGrade\b/.test(APP), 'thiếu mkAiGrade');
  assert.ok(/getElementById\('mk-aigrade'\)\.addEventListener/.test(APP), 'mk-aigrade chưa wire click');
});

test('regression: switchView tắt mic (wrRecog/aiRecog) + TTS khi rời tab', () => {
  const block = APP.slice(APP.indexOf('function switchView'), APP.indexOf('function switchView') + 1400);
  assert.ok(/speechSynthesis\.cancel\(\)/.test(block), 'switchView chưa cancel TTS');
  assert.ok(/wrRecog\.abort\(\)/.test(block), 'switchView chưa abort mic Luyện viết');
  assert.ok(/aiRecog\.abort\(\)/.test(block), 'switchView chưa abort mic Phỏng vấn AI');
});

test('regression: aiTurn có session guard chống stream cũ ghi vào phiên mới', () => {
  assert.ok(/const sid = aiSessionId/.test(APP), 'aiTurn chưa chụp aiSessionId');
  assert.ok(/sid !== aiSessionId/.test(APP), 'aiTurn chưa kiểm sid sau await');
  assert.ok(/aiSessionId\+\+/.test(APP), 'chưa tăng aiSessionId khi start/quit');
});

test('regression: loadMockPool gộp lời gọi đồng thời + helper thứ cấp dùng loadMockPool', () => {
  assert.ok(/let mockPoolPromise = null/.test(APP), 'chưa memo hoá loadMockPool');
  // helper điều hướng (gọi sau khi switchView đã kích initMock) phải chờ loadMockPool, không initMock lần 2
  const gw = APP.slice(APP.indexOf('function goToMockWrong'), APP.indexOf('function goToMockWrong') + 320);
  assert.ok(/loadMockPool\(\)\.then/.test(gw) && !/initMock\(\)\.then/.test(gw),
    'goToMockWrong nên dùng loadMockPool().then');
  // initMock().then chỉ còn đúng 1 chỗ canonical (trong switchView)
  const cnt = (APP.match(/initMock\(\)\.then/g) || []).length;
  assert.strictEqual(cnt, 1, `initMock().then chỉ nên còn 1 (canonical trong switchView), thấy ${cnt}`);
});

test('sw: app shell (HTML/.js/.css) dùng network-first để không phục vụ code cũ sau deploy', () => {
  const SW = read('sw.js');
  assert.ok(/function networkFirst/.test(SW), 'sw.js thiếu helper networkFirst');
  // điều hướng + file .js/.css phải đi qua networkFirst (cùng một nhánh route)
  const route = SW.slice(SW.indexOf("self.addEventListener('fetch'"), SW.indexOf('async function networkFirst'));
  assert.ok(/req\.mode === 'navigate'[\s\S]*?networkFirst\(req\)/.test(route), 'navigation chưa route qua networkFirst');
  assert.ok(/js\|css/.test(route), 'chưa route .js/.css qua networkFirst');
  assert.ok(SW.indexOf('networkFirst(req)') < SW.indexOf('staleWhileRevalidate(req)'),
    'shell phải kiểm networkFirst TRƯỚC khi rơi về staleWhileRevalidate');
  // offline vẫn fallback: networkFirst phải match cache khi fetch lỗi
  const nf = SW.slice(SW.indexOf('async function networkFirst'), SW.indexOf('async function cacheFirst'));
  assert.ok(/cache\.match\(req\)/.test(nf) && /navigate/.test(nf), 'networkFirst chưa fallback cache/offline');
});

test('wiring: 📝 Test gõ từ (Flashcards) đủ nút + container + hàm + SRS + chấm', () => {
  assert.ok(HTML.includes('id="fc-test-btn"'), 'thiếu nút #fc-test-btn');
  assert.ok(HTML.includes('id="fc-test"'), 'thiếu container #fc-test');
  for (const fn of ['function ftStart', 'function ftBegin', 'function ftShow', 'function ftSubmit', 'function ftFinish', 'const ftNorm']) {
    assert.ok(APP.includes(fn), `thiếu ${fn}`);
  }
  assert.ok(/fc-test-btn'\)\.addEventListener\('click', ftStart\)/.test(APP), 'initFlashcards chưa wire nút Test gõ');
  // chấm đúng: so khớp chuẩn hoá front; SRS: học tiếp = bumpSrs(...,false), thuộc rồi = bumpSrs(...,true)
  const fin = APP.slice(APP.indexOf('function ftFinish'), APP.indexOf('function ftMarkRow'));
  assert.ok(/bumpSrs\(ftQueue\[\+b\.dataset\.i\]\.card, false\)/.test(fin), 'nút Học tiếp chưa gọi bumpSrs(...,false)');
  assert.ok(/bumpSrs\(ftQueue\[\+b\.dataset\.i\]\.card, true\)/.test(fin), 'nút Thuộc rồi chưa gọi bumpSrs(...,true)');
  const sub = APP.slice(APP.indexOf('function ftSubmit'), APP.indexOf('function ftFinish'));
  assert.ok(/ftNorm\(it\.answer\) === ftNorm\(ftTarget\(it\.card\)\)/.test(sub), 'ftSubmit chưa so khớp chuẩn hoá theo ftTarget');
  assert.ok(/const PREP_KEYS = \[[\s\S]*?prep-ft-size[\s\S]*?\]/.test(APP), 'PREP_KEYS thiếu prep-ft-size');
  // Test gõ đa ngôn ngữ: Hàn/Trung gõ phiên âm (ipa), chấm bỏ dấu thanh điệu
  assert.ok(/const ftTarget = c => ftForeign\(c\) \? c\.ipa : c\.front/.test(APP), 'ftTarget chưa gõ phiên âm cho Hàn/Trung');
  assert.ok(/normalize\('NFD'\)[\s\S]{0,80}\\u0300-\\u036f|\.replace\(\/[̀-ͯ]/.test(APP) || /ftNorm = s =>[\s\S]{0,200}NFD/.test(APP),
    'ftNorm chưa bỏ dấu thanh điệu (pinyin)');
});

test('sync realtime: onSnapshot + chống echo + không ghi đè ngược + ngắt khi đăng xuất', () => {
  assert.ok(/function attachLiveSync/.test(APP), 'thiếu attachLiveSync');
  assert.ok(/function handleRemoteSnapshot/.test(APP), 'thiếu handleRemoteSnapshot');
  assert.ok(/\.onSnapshot\(handleRemoteSnapshot/.test(APP), 'attachLiveSync chưa đăng ký onSnapshot');
  const h = APP.slice(APP.indexOf('function handleRemoteSnapshot'), APP.indexOf('function isEditingNow'));
  assert.ok(/hasPendingWrites/.test(h), 'handleRemoteSnapshot chưa bỏ echo (hasPendingWrites)');
  assert.ok(/<= localUpdatedAt\(\)/.test(h), 'chưa chặn ghi đè ngược (updatedAt phải mới hơn)');
  assert.ok(/applyPrepData\(/.test(h), 'chưa áp dữ liệu remote qua applyPrepData');
  // onSignedIn phải bật live sync; đăng xuất phải ngắt listener
  assert.ok(/attachLiveSync\(\);/.test(APP.slice(APP.indexOf('async function onSignedIn'), APP.indexOf('function attachLiveSync'))),
    'onSignedIn chưa gọi attachLiveSync');
  assert.ok(/snapUnsub\(\); snapUnsub = null;/.test(APP), 'chưa ngắt listener khi đăng xuất');
});

test('nav gom nhóm: 4 menu xổ + Hôm nay riêng, mọi view nằm trong nav, có hàm điều khiển', () => {
  // 4 nhóm
  const groups = [...HTML.matchAll(/class="navgroup"\s+data-group="([\w-]+)"/g)].map(m => m[1]);
  assert.deepStrictEqual(groups.sort(), ['hoc', 'luyen', 'pv', 'theodoi'], 'thiếu/sai nhóm nav');
  assert.strictEqual((HTML.match(/class="navgroup-btn"/g) || []).length, 4, 'phải có 4 nút nhóm');
  // Hôm nay đứng riêng (tab-home)
  assert.ok(/class="tab tab-home"\s+data-view="today"/.test(HTML), 'thiếu nút Hôm nay đứng riêng');
  // Mọi view (trừ today) phải nằm trong một .navgroup-menu
  const inMenus = [...HTML.matchAll(/navgroup-menu[\s\S]*?<\/div>/g)].map(m => m[0]).join('');
  const tabViews = [...HTML.matchAll(/class="tab[^"]*"\s+data-view="([\w-]+)"/g)].map(m => m[1]);
  for (const v of tabViews) {
    if (v === 'today') continue;
    assert.ok(inMenus.includes(`data-view="${v}"`), `view '${v}' chưa được gom vào menu nhóm nào`);
  }
  // JS điều khiển
  assert.ok(/function updateNavActive/.test(APP), 'thiếu updateNavActive');
  assert.ok(/function closeNavGroups/.test(APP), 'thiếu closeNavGroups');
  assert.ok(/updateNavActive\(name\)/.test(APP), 'switchView chưa gọi updateNavActive');
});

test('regression: đếm độ phủ bank lọc theo id còn tồn tại, cùng 1 nguồn bankCoverage', () => {
  // helper chung phải lọc id còn tồn tại trong bank (tránh đếm vượt khi bank xoá câu)
  const bc = APP.slice(APP.indexOf('function bankCoverage'), APP.indexOf('function bankCoverage') + 400);
  assert.ok(/ids\.has\(String\(id\)\)/.test(bc), 'bankCoverage chưa lọc id tồn tại');
  // 4 nơi tiêu thụ đều đi qua coverageOf/bankCoverage — không tự đếm tay nữa
  const badgeBlock = APP.slice(APP.indexOf('function computeBadges'), APP.indexOf('function goalRing'));
  assert.ok(/coverageOf\('output'\)/.test(badgeBlock) && /bankCoverage\(window\.DEBUG_CHALLENGES/.test(badgeBlock),
    'computeBadges phải dùng coverageOf/bankCoverage');
  const statsBlock = APP.slice(APP.indexOf('function renderThinkStats'), APP.indexOf('function computeReadiness'));
  assert.ok(/coverageOf\(mode\)/.test(statsBlock), 'renderThinkStats phải dùng coverageOf (dạng tham số hoá theo mode)');
  const readyBlock = APP.slice(APP.indexOf('function computeReadiness'), APP.indexOf('function readinessHtml'));
  assert.ok(/covPct\(coverageOf\('output'\)\)/.test(readyBlock), 'computeReadiness phải dùng coverageOf');
  const covOf = APP.slice(APP.indexOf('function coverageOf'), APP.indexOf('function coverageOf') + 300);
  assert.ok(/bankCoverage\(m\.data\(\), m\.doneKey\)/.test(covOf), 'coverageOf phải uỷ quyền bankCoverage');
});

test('dashboard: panel Tư duy phủ ĐỦ mode trắc nghiệm kỹ thuật (kể cả java/redis/dist/devops)', () => {
  const statsBlock = APP.slice(APP.indexOf('function renderThinkStats'), APP.indexOf('function computeReadiness'));
  // Panel + các gợi ý dùng CHUNG danh sách TECH_QUIZ_MODES — mọi mode kỹ thuật phải có mặt.
  const listM = APP.match(/TECH_QUIZ_MODES\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(listM, 'thiếu hằng TECH_QUIZ_MODES (nguồn dùng chung');
  const modesBlock = APP.slice(APP.indexOf('const QUIZ_MODES = {'), APP.indexOf('const QUIZ_MODES = {') + 3000);
  for (const mode of ['output', 'api', 'sql', 'cli', 'java', 'redis', 'dist', 'devops']) {
    assert.ok(new RegExp(`'${mode}'`).test(listM[1]), `TECH_QUIZ_MODES chưa liệt kê mode '${mode}'`);
    assert.ok(new RegExp(`\\n  ${mode}: \\{`).test(modesBlock), `mode '${mode}' không tồn tại trong QUIZ_MODES`);
  }
  // english/situational KHÔNG thuộc panel kỹ thuật (thuộc trục ngôn ngữ/hành vi).
  assert.ok(!/'english'|'situational'/.test(listM[1]), 'TECH_QUIZ_MODES không nên gồm english/situational');
  // Panel sinh hàng từ TECH_QUIZ_MODES, nhãn lấy trực tiếp từ QUIZ_MODES (không hardcode).
  assert.ok(/TECH_QUIZ_MODES\.map/.test(statsBlock), 'panel Tư duy phải sinh hàng từ TECH_QUIZ_MODES');
  assert.ok(/QUIZ_MODES\[mode\]\.label/.test(statsBlock), 'panel Tư duy nên lấy nhãn từ QUIZ_MODES[mode].label');
  // Mỗi hàng là nút bấm → nhảy vào luyện mode đó (click điểm yếu để luyện ngay).
  assert.ok(/data-tk-mode=/.test(statsBlock), 'hàng panel Tư duy phải mang data-tk-mode để bấm vào luyện');
  assert.ok(/switchView\('coding'\); setThinkMode\(b\.dataset\.tkMode\)/.test(statsBlock),
    'panel Tư duy chưa wiring click → switchView(coding)+setThinkMode');
  // Đánh dấu 🎯 mảng yếu nhất — CÙNG suggestedWeakMode với tab Hôm nay (luôn khớp).
  assert.ok(/suggestedWeakMode\(\)/.test(statsBlock), 'panel Tư duy nên đánh dấu mảng yếu nhất qua suggestedWeakMode');
  assert.ok(/tk-weak/.test(APP) && /\.tk-weak/.test(read('styles.css')),
    'thiếu class tk-weak (đánh dấu) trong app.js hoặc CSS');
});

test('exam: banner "vào hàng đợi" đếm ĐÚNG số câu thực sự queue, "bỏ qua" strict === null', () => {
  const fn = APP.slice(APP.indexOf('let right = 0, skipped = 0'), APP.indexOf('let right = 0, skipped = 0') + 5000);
  assert.ok(fn, 'không tìm thấy thân finishExam');
  // Bug cũ: picked == null gộp cả undefined (câu chưa làm tới) vào "bỏ qua". Phải strict.
  assert.ok(/if \(picked === null\) skipped\+\+/.test(fn), 'skipped phải đếm strict === null (không gộp undefined)');
  // Đếm riêng số câu THỰC SỰ vào hàng đợi (idx <= examIdx), không dùng wrongItems.length.
  assert.ok(/queuedWrong\+\+/.test(fn) && /recordWrong\(item\.mode, item\.q\.id\); queuedWrong\+\+/.test(fn),
    'phải tăng queuedWrong đúng chỗ recordWrong (idx <= examIdx)');
  assert.ok(/\$\{queuedWrong\}<\/b> câu sai đã vào hàng đợi/.test(fn),
    'banner phải hiển thị queuedWrong, KHÔNG phải wrongItems.length');
  assert.ok(/\$\{queuedWrong \? '<button id="exam-review"/.test(fn),
    'nút Ôn ngay câu sai chỉ hiện khi có câu thực sự vào hàng đợi');
});

test('mock: prep-mock-history bị cắt .slice để không phình vô hạn (đồng bộ Firestore)', () => {
  assert.ok(/store\.set\('prep-mock-history', history\.slice\(-\d+\)\)/.test(APP),
    'prep-mock-history phải slice khi lưu (như code/ai/design/exam history)');
});

test('sw: offline cache được response OPAQUE của thư viện CDN (không hỏng khi offline)', () => {
  // Bug cũ: chỉ cache khi res.ok → response opaque (CDN no-cors, status 0) KHÔNG BAO GIỜ được
  // cache → offline mất hljs/marked/CSS. Phải cache cả opaque.
  assert.ok(/res\.ok\s*\|\|\s*res\.type === 'opaque'/.test(SW),
    'cacheFirst phải cache cả res.type opaque, không chỉ res.ok');
  // Precache CDN: fetch no-cors + cache.put thủ công (cache.add từ chối opaque).
  assert.ok(/CDN_PRECACHE/.test(SW), 'sw thiếu danh sách CDN_PRECACHE nạp sẵn thư viện');
  assert.ok(/mode: 'no-cors'[\s\S]*cache\.put/.test(SW), 'CDN_PRECACHE phải fetch no-cors rồi cache.put');
  // Nạp sẵn CẢ 2 theme hljs (app đổi href sáng/tối) — thiếu 1 cái thì theme kia mất màu offline.
  for (const asset of ['highlight.min.js', 'marked@12', 'github-dark.min.css', 'styles/github.min.css']) {
    assert.ok(SW.includes(asset), `CDN_PRECACHE thiếu ${asset}`);
  }
  // Cả HTML dùng đúng theme hljs đang precache (khớp URL để cache hit khi offline).
  assert.ok(HTML.includes('github-dark.min.css'), 'index.html không dùng đúng URL hljs theme đã precache');
  // Mọi <script src> cùng origin trong index.html phải nằm trong PRECACHE (offline không lỗi tải).
  const preBlock = SW.slice(SW.indexOf('const PRECACHE'), SW.indexOf('];', SW.indexOf('const PRECACHE')));
  const localScripts = [...HTML.matchAll(/<script src="(?!https?:)([^"]+)"/g)].map(m => m[1]);
  for (const s of localScripts) {
    assert.ok(preBlock.includes(`'${s}'`), `PRECACHE thiếu script cùng origin '${s}' (offline sẽ lỗi tải)`);
  }
  // Firebase (index.html luôn nạp) cũng precache để app shell mở trọn vẹn offline.
  assert.ok(/firebasejs\/[\d.]+\/firebase-app-compat\.js/.test(SW), 'CDN_PRECACHE thiếu firebase-app');
});

test('today: gợi ý 🎯 mảng yếu nhất dùng weakestTechMode + nhảy đúng mode', () => {
  const wk = APP.slice(APP.indexOf('function weakestTechMode'), APP.indexOf('function weakestTechMode') + 700);
  assert.ok(wk, 'thiếu weakestTechMode');
  assert.ok(/for \(const mode of TECH_QUIZ_MODES\)/.test(wk), 'weakestTechMode phải duyệt TECH_QUIZ_MODES');
  assert.ok(/done >= total/.test(wk), 'weakestTechMode phải bỏ mode đã phủ 100%');
  assert.ok(/ratio < best\.ratio/.test(wk), 'weakestTechMode phải so tỉ lệ độ phủ để chọn yếu nhất');
  // Task Hôm nay bấm vào là vào đúng mode yếu (setThinkMode theo weak.mode)
  const today = APP.slice(APP.indexOf('async function renderToday'), APP.indexOf('async function renderToday') + 6000);
  assert.ok(/id: 'td-weak'/.test(today), 'renderToday thiếu task td-weak');
  assert.ok(/setThinkMode\(weak\.mode\)/.test(today), 'task td-weak chưa nhảy vào đúng mode yếu');
  // Cùng nguồn suggestedWeakMode → Dashboard 🎯 và task Hôm nay LUÔN khớp (ngưỡng còn ≥ N câu).
  assert.ok(/const weak = suggestedWeakMode\(\)/.test(today), 'renderToday phải dùng suggestedWeakMode (cùng nguồn Dashboard)');
  const sw = APP.slice(APP.indexOf('function suggestedWeakMode'), APP.indexOf('function suggestedWeakMode') + 260);
  assert.ok(/WEAK_MODE_MIN_REMAINING/.test(sw), 'suggestedWeakMode phải áp ngưỡng còn tối thiểu N câu');
});

test('ai-mic: đoạn isFinal cộng dồn vào baseline (không mất câu khi nói nhiều câu)', () => {
  const block = APP.slice(APP.indexOf('aiRecog.onresult'), APP.indexOf('aiRecog.onresult') + 500);
  // Bug cũ: ghi đè ta.value từ baseline cố định + chỉ dùng resultIndex → đoạn đã chốt bị mất.
  assert.ok(/r\.isFinal/.test(block), 'onresult phải phân biệt đoạn isFinal để cộng dồn');
  assert.ok(/baseline = \(baseline \+ ' ' \+ r\[0\]\.transcript\)/.test(block),
    'đoạn đã chốt phải CỘNG DỒN vào baseline, không ghi đè');
  // Mô phỏng thuật toán: 2 event, event1 chốt "one", event2 chốt "two" (resultIndex nhảy) → phải còn cả 2.
  let baseline = '';
  const apply = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) baseline = (baseline + ' ' + r[0].transcript).trim(); else interim += r[0].transcript;
    }
    return (baseline + (interim ? ' ' + interim : '')).trim();
  };
  const mk = (arr, idx) => ({ resultIndex: idx, results: arr.map(([t, f]) => ({ 0: { transcript: t }, isFinal: f })) });
  apply(mk([['one', true]], 0));                          // chốt "one"
  const out = apply(mk([['one', true], ['two', true]], 1)); // resultIndex=1 → chỉ thấy "two", nhưng "one" đã ở baseline
  assert.strictEqual(out, 'one two', 'câu nhiều đoạn phải giữ đủ, không chỉ còn đoạn cuối');
});

test('readiness: iqPct được CLAMP [0,100] (IQ thấp không kéo âm điểm Tư duy)', () => {
  const block = APP.slice(APP.indexOf('function computeReadiness'), APP.indexOf('function readinessHtml'));
  // iqBest bị chặn [55,160] → (iqBest-80)/50*100 có thể âm/quá 100; phải clamp trước khi vào thinkVals.
  assert.ok(/const iqPct = iqBest \? Math\.min\(100, Math\.max\(0,/.test(block),
    'iqPct chưa clamp [0,100] → 1 lần IQ thấp làm TỤT điểm sẵn sàng');
});

test('ai-grade: regex /10 KHÔNG khớp nhầm "N/100" + score chốt trần 10', () => {
  const block = APP.slice(APP.indexOf('function saveAiEvaluation'), APP.indexOf('function saveAiEvaluation') + 900);
  assert.ok(block.includes('10(?!\\d)'), 'regex điểm /10 phải có (?!\\d) để loại "N/100"');
  assert.ok(block.includes('Math.min(parseFloat(m[1].replace(\',\', \'.\')), 10)'), 'score phải chốt trần 10');
  // Kiểm tra thực regex trên chuỗi bẫy "75/100" (không khớp) và "8/10" (khớp =8)
  const re = /(\d+(?:[.,]\d+)?)\s*\/\s*10(?!\d)/;
  assert.strictEqual('bạn đạt 75/100 điểm'.match(re), null, '"75/100" KHÔNG được khớp thành /10');
  assert.strictEqual('điểm 8/10'.match(re)[1], '8', '"8/10" phải khớp đúng =8');
});

test('readiness: tổng trọng số 7 phần = 1.0 (điểm không lệch thang)', () => {
  // trích các weight trong computeReadiness (đứng liền trong mảng parts)
  const block = APP.slice(APP.indexOf('function computeReadiness'), APP.indexOf('function readinessHtml'));
  const weights = [...block.matchAll(/weight:\s*(0?\.\d+)/g)].map(m => +m[1]);
  assert.ok(weights.length >= 6, 'không trích đủ weight');
  const sum = weights.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `tổng trọng số = ${sum} ≠ 1.0`);
});

test('readiness: phần Tư duy gồm cả 5 quiz mới (output/debug/api/sql/cli) + dashboard panel', () => {
  const block = APP.slice(APP.indexOf('function computeReadiness'), APP.indexOf('function readinessHtml'));
  // 5 bank quiz đi qua coverageOf/bankCoverage (doneKey nằm trong QUIZ_MODES — test registry riêng đã phủ)
  for (const call of ["coverageOf('output')", "bankCoverage(window.DEBUG_CHALLENGES, 'prep-debug-solved')",
    "coverageOf('api')", "coverageOf('sql')", "coverageOf('cli')"]) {
    assert.ok(block.includes(call), `computeReadiness chưa tính ${call} vào phần Tư duy`);
  }
  assert.ok(/thinkVals = \[codingPct, iqPct, ivBest, oqPct, dbgPct, apiPct, sqlPct, cliPct\]/.test(block),
    'thinkVals chưa gộp đủ 8 thành phần');
  // dashboard panel Tư duy
  assert.ok(HTML.includes('id="dash-think"'), 'index.html thiếu #dash-think');
  assert.ok(/function renderThinkStats\b/.test(APP), 'thiếu renderThinkStats');
  // cắt đúng thân renderDashboard (tới function kế tiếp) thay vì cửa sổ ký tự cứng
  const rdStart = APP.indexOf('function renderDashboard');
  const rdEnd = APP.indexOf('\nfunction ', rdStart + 1);
  assert.ok(/renderThinkStats\(\)/.test(APP.slice(rdStart, rdEnd)),
    'renderDashboard chưa gọi renderThinkStats');
});

test('wiring: mọi switchView("x") literal trỏ tới view tồn tại', () => {
  const tabViews = new Set([...HTML.matchAll(/data-view="([\w-]+)"/g)].map(m => m[1]));
  const bad = [];
  const re = /switchView\(\s*'([\w-]+)'\s*\)/g;
  let m;
  while ((m = re.exec(APP))) if (!tabViews.has(m[1])) bad.push(m[1]);
  assert.deepStrictEqual([...new Set(bad)], [], 'switchView trỏ view không tồn tại');
});

test('AI chấm: regex bắt điểm "ĐIỂM: NN/100" đúng', () => {
  const re = /ĐIỂM:\s*(\d+)\s*\/\s*100/i;
  assert.strictEqual('… nhận xét.\nĐIỂM: 82/100'.match(re)[1], '82');
  assert.strictEqual('điểm: 100 / 100'.match(re)[1], '100');
  assert.strictEqual('không có điểm'.match(re), null);
});

test('onboarding: đủ slide, hàm điều khiển, nút ❓, hookup init + lưu cờ', () => {
  // có mảng slide với ≥4 bước, mỗi slide đủ ico/title/body
  const m = APP.match(/const ONBOARD_SLIDES = \[([\s\S]*?)\];/);
  assert.ok(m, 'thiếu mảng ONBOARD_SLIDES');
  const nSlides = (m[1].match(/ico:/g) || []).length;
  assert.ok(nSlides >= 4, `phải có ≥4 slide onboarding (đang ${nSlides})`);
  assert.strictEqual((m[1].match(/title:/g) || []).length, nSlides, 'mỗi slide phải có title');
  assert.strictEqual((m[1].match(/body:/g) || []).length, nSlides, 'mỗi slide phải có body');
  // các hàm cốt lõi
  for (const fn of ['function openOnboard', 'function closeOnboard', 'function renderOnboard',
    'function initOnboarding', 'function onbKey']) {
    assert.ok(APP.includes(fn), `thiếu ${fn}`);
  }
  // init() gọi initOnboarding
  assert.ok(/initOnboarding\(\);/.test(APP), 'init() chưa gọi initOnboarding()');
  // đóng onboarding ghi cờ để không hiện lại; mở lần đầu khi chưa có cờ
  assert.ok(/store\.set\('prep-onboarded', 1\)/.test(APP), 'closeOnboard chưa lưu cờ prep-onboarded');
  assert.ok(/store\.get\('prep-onboarded', 0\)/.test(APP), 'initOnboarding chưa kiểm tra cờ trước khi tự mở');
  // nút ❓ help được tạo
  assert.ok(/help\.id = 'help-btn'/.test(APP), 'thiếu nút ❓ help-btn');
  // hai global keydown nhường phím khi onboarding mở (chống lọt xuống view dưới)
  assert.ok(/if \(onboardOpen\(\)/.test(APP), 'global keydown chưa guard onboardOpen()');
  assert.ok((APP.match(/if \(onboardOpen\(\)/g) || []).length >= 2,
    'cần guard onboardOpen() ở cả hotkey flashcards lẫn phím tắt tab');
  // CSS có khối onboarding
  const CSS = read('styles.css');
  assert.ok(/#onboard\s*{/.test(CSS), 'styles.css thiếu #onboard');
  assert.ok(/\.onb-card/.test(CSS), 'styles.css thiếu .onb-card');
});

test('phím tắt: bảng ⌨️ mở bằng ?, đủ hàm + guard + CSS', () => {
  // dữ liệu SHORTCUTS ≥2 nhóm, mỗi mục có keys + desc
  const m = APP.match(/const SHORTCUTS = \[([\s\S]*?)\];/);
  assert.ok(m, 'thiếu mảng SHORTCUTS');
  assert.ok((m[1].match(/group:/g) || []).length >= 2, 'cần ≥2 nhóm phím tắt');
  assert.ok((m[1].match(/keys:/g) || []).length >= 5, 'cần ≥5 dòng phím tắt');
  assert.strictEqual((m[1].match(/keys:/g) || []).length, (m[1].match(/desc:/g) || []).length,
    'mỗi phím tắt phải có mô tả');
  // hàm cốt lõi
  for (const fn of ['function openShortcuts', 'function closeShortcuts', 'function toggleShortcuts', 'function scKey']) {
    assert.ok(APP.includes(fn), `thiếu ${fn}`);
  }
  // bind phím ? trong initShortcuts — cắt theo RANH GIỚI HÀM, không dùng cửa sổ ký tự cố định
  // (bài học 03/07 + 06/07: thêm code vào giữa hàm làm mục tiêu trôi khỏi cửa sổ → test đỏ oan)
  const scStart = APP.indexOf('function initShortcuts');
  const scEnd = APP.indexOf('\nfunction ', scStart + 1);
  const block = APP.slice(scStart, scEnd > scStart ? scEnd : scStart + 3000);
  assert.ok(/e\.key === '\?'/.test(block) && /toggleShortcuts\(\)/.test(block), "initShortcuts chưa bind phím '?'");
  // hai global keydown guard shortcutsOpen() (chống lọt phím xuống view dưới)
  assert.ok((APP.match(/onboardOpen\(\) \|\| shortcutsOpen\(\)/g) || []).length >= 2,
    'cần guard onboardOpen()||shortcutsOpen() ở cả hotkey flashcards lẫn phím tắt tab');
  // CSS
  const CSS = read('styles.css');
  assert.ok(/#shortcuts\s*{/.test(CSS), 'styles.css thiếu #shortcuts');
  assert.ok(/\.sc-card/.test(CSS), 'styles.css thiếu .sc-card');
});

test('mẹo hôm nay: kho tip + pickTip xoay vòng đúng, render vào Today', () => {
  // trích mảng STUDY_TIPS + hàm pickTip để chạy thật (thuần, không cần DOM)
  const m = APP.match(/const STUDY_TIPS = \[([\s\S]*?)\];/);
  assert.ok(m, 'thiếu mảng STUDY_TIPS');
  const fnM = APP.match(/function pickTip\(dayNum\) \{[^}]*\}/);
  assert.ok(fnM, 'thiếu hàm pickTip');
  const { STUDY_TIPS, pickTip } = new Function(
    `${m[0]}\n${fnM[0]}\nreturn { STUDY_TIPS, pickTip };`)();
  assert.ok(STUDY_TIPS.length >= 10, `cần ≥10 mẹo (đang ${STUDY_TIPS.length})`);
  assert.strictEqual(new Set(STUDY_TIPS).size, STUDY_TIPS.length, 'có mẹo trùng');
  // xoay vòng theo ngày: cùng ngày → cùng mẹo; quanh vòng → khớp; số âm không crash
  assert.strictEqual(pickTip(0), STUDY_TIPS[0]);
  assert.strictEqual(pickTip(STUDY_TIPS.length), STUDY_TIPS[0], 'phải lặp vòng');
  assert.strictEqual(pickTip(3), pickTip(3), 'cùng ngày cùng mẹo');
  assert.ok(typeof pickTip(-1) === 'string', 'số âm vẫn trả mẹo hợp lệ');
  assert.strictEqual(pickTip(-1), STUDY_TIPS[STUDY_TIPS.length - 1], 'modulo âm xử lý đúng');
  // render: có tipOfDay + chèn .td-tip vào renderToday
  assert.ok(/function tipOfDay\(\)/.test(APP), 'thiếu tipOfDay');
  assert.ok(/class="td-tip"/.test(APP), 'renderToday chưa chèn card .td-tip');
  assert.ok(/escHtml\(tipOfDay\(\)\)/.test(APP), 'mẹo phải qua escHtml (an toàn HTML)');
  assert.ok(/\.td-tip\s*{/.test(read('styles.css')), 'styles.css thiếu .td-tip');
  // nút 🔄 xoay mẹo: helper index hôm nay + cập nhật text qua textContent (an toàn)
  assert.ok(/function todayTipIdx\(\)/.test(APP), 'thiếu todayTipIdx');
  assert.ok(/id="td-tip-next"/.test(APP), 'thiếu nút 🔄 #td-tip-next');
  assert.ok(/tipIdx = \(tipIdx \+ 1\) % STUDY_TIPS\.length/.test(APP), 'nút 🔄 chưa xoay vòng qua mẹo kế');
  assert.ok(/getElementById\('td-tip-text'\)\.textContent = STUDY_TIPS\[tipIdx\]/.test(APP),
    'phải cập nhật mẹo bằng textContent (an toàn HTML)');
});

test('a11y + empty-state: reduced-motion, dashboard empty-state có CTA', () => {
  const CSS = read('styles.css');
  // tôn trọng prefers-reduced-motion
  assert.ok(/@media \(prefers-reduced-motion: reduce\)/.test(CSS), 'thiếu @media prefers-reduced-motion');
  // focus-visible (đã có từ trước) vẫn còn
  assert.ok(/:focus-visible/.test(CSS), 'mất quy tắc focus-visible');
  // empty-state dashboard: logic + CTA + style
  assert.ok(/const isNew = done === 0 && !anyActivity && entries\.length === 0/.test(APP),
    'renderDashboard thiếu điều kiện isNew (người mới)');
  assert.ok(/id="dash-empty"|empty\.id = 'dash-empty'/.test(APP), 'thiếu node #dash-empty');
  assert.ok(/getElementById\('de-today'\)\.onclick = \(\) => switchView\('today'\)/.test(APP),
    'CTA #de-today chưa nhảy sang Hôm nay');
  assert.ok(/getElementById\('de-docs'\)\.onclick = \(\) => switchView\('docs'\)/.test(APP),
    'CTA #de-docs chưa nhảy sang Tài liệu');
  assert.ok(/\.dash-empty\s*{/.test(CSS), 'styles.css thiếu .dash-empty');
  // idempotent: ẩn lại khi đã có dữ liệu
  assert.ok(/} else if \(empty\) \{\s*empty\.hidden = true;/.test(APP),
    'empty-state chưa ẩn khi người dùng đã có dữ liệu');
});

test('reverse-questions: nhóm có id/group/icon + mỗi item đủ q & why', () => {
  const groups = loadWindow('reverse-questions.js').REVERSE_QUESTIONS;
  assert.ok(Array.isArray(groups) && groups.length >= 4, 'phải có ≥4 nhóm câu hỏi ngược');
  const ids = groups.map(g => g.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'id nhóm trùng');
  for (const g of groups) {
    assert.ok(g.id && g.group && g.icon, `nhóm ${g.id} thiếu field`);
    assert.ok(Array.isArray(g.items) && g.items.length >= 2, `nhóm ${g.id}: <2 câu`);
    for (const it of g.items) assert.ok(it.q && it.why, `nhóm ${g.id}: item thiếu q/why`);
  }
});

test('capstone-tracker: 5 upgrade đủ field, doc có thật trong docs.json', () => {
  const ups = loadWindow('capstone-tracker.js').CAPSTONE_UPGRADES;
  assert.ok(Array.isArray(ups) && ups.length === 5, 'phải có đúng 5 upgrade');
  const ids = ups.map(u => u.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'id upgrade trùng');
  // Đối chiếu file .md nguồn ở repo (KHÔNG dùng data/docs.json — gitignored, CI test chạy TRƯỚC build)
  const ROOT = path.resolve(__dirname, '..', '..');
  for (const u of ups) {
    assert.ok(u.id && u.icon && u.label && u.doc && u.week, `upgrade ${u.id} thiếu field`);
    const mdPath = path.join(ROOT, u.doc);
    assert.ok(fs.existsSync(mdPath), `upgrade ${u.id}: doc ${u.doc} không tồn tại trong repo`);
    // Chống drift: số mục tracker phải bằng số "- [ ]" trong section Checklist nghiệm thu của guide
    const md = fs.readFileSync(mdPath, 'utf8');
    const sec = md.split(/Checklist nghiệm thu/)[1]?.split(/\n## /)[0] || '';
    const boxes = (sec.match(/^- \[ \]/gm) || []).length;
    assert.strictEqual(u.items.length, boxes,
      `upgrade ${u.id}: tracker có ${u.items.length} mục nhưng ${u.doc} có ${boxes} ô checklist — sửa guide thì cập nhật capstone-tracker.js`);
    assert.ok(Array.isArray(u.items) && u.items.length >= 4, `upgrade ${u.id}: <4 mục nghiệm thu`);
    for (const it of u.items) assert.ok(typeof it === 'string' && it.length > 10, `upgrade ${u.id}: mục rỗng/quá ngắn`);
  }
  const weeks = ups.map(u => u.week);
  assert.deepStrictEqual([...weeks].sort((a, b) => a - b), weeks, 'upgrade phải xếp theo tuần tăng dần');
});

test('wiring: capstone tracker trong tab Kế hoạch', () => {
  assert.ok(HTML.includes('src="capstone-tracker.js"'), 'index.html thiếu script capstone-tracker.js');
  assert.ok(HTML.indexOf('src="capstone-tracker.js"') < HTML.indexOf('src="app.js"'),
    'capstone-tracker.js phải nạp trước app.js');
  assert.ok(/function capstoneHtml\b/.test(APP), 'thiếu hàm capstoneHtml');
  assert.ok(/function bindCapstone\b/.test(APP), 'thiếu hàm bindCapstone');
  assert.ok(/\$\{capstoneHtml\(\)\}/.test(APP), 'renderPlan chưa chèn capstoneHtml()');
  assert.ok((APP.match(/bindCapstone\(body\)/g) || []).length >= 2,
    'renderPlan chưa gọi bindCapstone (chỉ thấy dòng khai báo hàm)');
  const pk = APP.match(/const PREP_KEYS = \[([\s\S]*?)\]/);
  assert.ok(pk && pk[1].includes('prep-capstone'), 'PREP_KEYS thiếu prep-capstone (mất sync/export)');
  const SW = read('sw.js');
  assert.ok(/capstone-tracker\.js/.test(SW), 'sw.js PRECACHE thiếu capstone-tracker.js');
  // Task nhắc capstone ở tab Hôm nay: chỉ hiện khi tuần kế hoạch đã tới upgrade chưa tick đủ
  assert.ok(/id: 'td-capstone'/.test(APP), 'tab Hôm nay thiếu task td-capstone');
  assert.ok(/u\.week <= wk && u\.items\.some/.test(APP), 'td-capstone thiếu điều kiện tuần + chưa tick đủ');
  // Dòng tiến độ capstone ở Dashboard
  assert.ok(HTML.includes('id="dash-capstone"'), 'index.html thiếu #dash-capstone');
  assert.ok(/dash-cap-open/.test(APP), 'renderDashboard chưa render tiến độ capstone');
  // 2 huy hiệu capstone
  assert.ok(/B\('cap1'/.test(APP) && /B\('capAll'/.test(APP), 'computeBadges thiếu huy hiệu cap1/capAll');
  assert.ok(/u\.items\.every\(\(_, i\) => \(capB\[u\.id\] \|\| \{\}\)\[i\]\)/.test(APP),
    'điều kiện nghiệm thu đủ upgrade sai/thiếu');
});

test('wiring: câu hỏi ngược render trong tab Phỏng vấn tổng hợp', () => {
  assert.ok(HTML.includes('src="reverse-questions.js"'), 'index.html thiếu script reverse-questions.js');
  assert.ok(HTML.indexOf('src="reverse-questions.js"') < HTML.indexOf('src="app.js"'),
    'reverse-questions.js phải nạp trước app.js');
  assert.ok(/function reverseQuestionsHtml\b/.test(APP), 'thiếu hàm reverseQuestionsHtml');
  assert.ok(/window\.REVERSE_QUESTIONS/.test(APP), 'app.js chưa đọc window.REVERSE_QUESTIONS');
  assert.ok(/\$\{reverseQuestionsHtml\(\)\}/.test(APP), 'renderCompany chưa chèn reverseQuestionsHtml()');
});

test('english-phrases: nhóm có id/group/icon + mỗi item đủ en & vi', () => {
  const groups = loadWindow('english-phrases.js').ENGLISH_PHRASES;
  assert.ok(Array.isArray(groups) && groups.length >= 4, 'phải có ≥4 nhóm mẫu câu');
  const ids = groups.map(g => g.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'id nhóm trùng');
  for (const g of groups) {
    assert.ok(g.id && g.group && g.icon, `nhóm ${g.id} thiếu field`);
    assert.ok(Array.isArray(g.items) && g.items.length >= 2, `nhóm ${g.id}: <2 câu`);
    for (const it of g.items) assert.ok(it.en && it.vi, `nhóm ${g.id}: item thiếu en/vi`);
  }
});

test('wiring: mẫu câu tiếng Anh render trong tab STAR', () => {
  assert.ok(HTML.includes('src="english-phrases.js"'), 'index.html thiếu script english-phrases.js');
  assert.ok(HTML.indexOf('src="english-phrases.js"') < HTML.indexOf('src="app.js"'),
    'english-phrases.js phải nạp trước app.js');
  assert.ok(/function englishPhrasesHtml\b/.test(APP), 'thiếu hàm englishPhrasesHtml');
  assert.ok(/window\.ENGLISH_PHRASES/.test(APP), 'app.js chưa đọc window.ENGLISH_PHRASES');
  assert.ok(/\$\{englishPhrasesHtml\(\)\}/.test(APP), 'renderStarList chưa chèn englishPhrasesHtml()');
});

test('english phrases: có TTS — nút 🔊 từng câu + ▶️ nghe cả nhóm', () => {
  assert.ok(/function speakList\b/.test(APP), 'thiếu hàm speakList (đọc xếp hàng nhiều câu)');
  assert.ok(/class="ep-say"/.test(APP), 'englishPhrasesHtml thiếu nút 🔊 từng câu (.ep-say)');
  assert.ok(/class="ep-sayall"/.test(APP), 'englishPhrasesHtml thiếu nút nghe cả nhóm (.ep-sayall)');
  assert.ok(/function bindEnglishPhraseAudio\b/.test(APP), 'thiếu hàm bindEnglishPhraseAudio');
  assert.ok(/bindEnglishPhraseAudio\(el\)/.test(APP), 'renderStarList chưa gọi bindEnglishPhraseAudio');
  const CSS = read('styles.css');
  assert.ok(CSS.includes('.ep-say') && CSS.includes('.ep-sayall'), 'styles.css thiếu style nút nghe');
});

test('today: panel 🏁 Ưu tiên nước rút wiring đủ', () => {
  assert.ok(/function sprintPanelHtml\b/.test(APP), 'thiếu hàm sprintPanelHtml');
  assert.ok(/\$\{sprintPanelHtml\(\)\}/.test(APP), 'renderToday chưa chèn sprintPanelHtml()');
  assert.ok(/\.td-sprint-row'\)\.forEach/.test(APP), 'chưa bind click .td-sprint-row');
  const CSS = read('styles.css');
  assert.ok(CSS.includes('.td-sprint-row'), 'styles.css thiếu .td-sprint-row');
});

test('dashboard: 🖨️ Bản in ôn nhanh wiring đủ', () => {
  assert.ok(/async function buildPrintSheetHtml\b/.test(APP), 'thiếu hàm buildPrintSheetHtml');
  assert.ok(/async function printSheet\b/.test(APP), 'thiếu hàm printSheet');
  assert.ok(/window\.print\(\)/.test(APP), 'printSheet chưa gọi window.print()');
  assert.ok(/dash-print'\)\.onclick = printSheet/.test(APP), 'renderDashboard chưa bind dash-print');
  assert.ok(HTML.includes('id="dash-print"'), 'index.html thiếu nút dash-print');
  const CSS = read('styles.css');
  assert.ok(CSS.includes('#print-sheet') && CSS.includes('@media print'), 'styles.css thiếu CSS in');
});

test('design: nút 🎲 bốc đề ngẫu nhiên wiring đủ', () => {
  assert.ok(/id="dg-random"/.test(APP), 'renderDgList thiếu nút dg-random');
  assert.ok(/dg-random'\)\.onclick/.test(APP), 'chưa bind click dg-random');
  assert.ok(/list\.filter\(d => !done\.has\(d\.id\)\)/.test(APP), 'bốc ngẫu nhiên chưa ưu tiên đề chưa làm');
  // nút lọc độ khó chỉ bind cho nút có data-diff (không đè lên dg-random)
  assert.ok(/\.dg-fbtn\[data-diff\]/.test(APP), 'selector filter phải là .dg-fbtn[data-diff]');
});

test('quiz: đáp án shuffle hiển thị — mọi engine chấm theo dataset.i, không theo vị trí DOM', () => {
  assert.ok(/function shuffledOptsHtml\b/.test(APP), 'thiếu helper shuffledOptsHtml');
  const renders = (APP.match(/shuffledOptsHtml\(q/g) || []).length;
  assert.ok(renders >= 7, `phải ≥7 chỗ render dùng shuffledOptsHtml (được ${renders})`);
  // Không còn render option theo thứ tự gốc hay chấm theo vị trí DOM
  assert.ok(!/options\.map\(\(o, i\)/.test(APP), 'còn chỗ render options.map((o, i) chưa shuffle');
  assert.ok(!/forEach\(\(b, (j|idx)\) =>/.test(APP), 'còn hàm chấm dùng index vị trí DOM (b, j|idx)');
});

test('today: task 🖨️ in bản ôn hiện khi còn ≤3 ngày đến PV', () => {
  assert.ok(/id: 'td-print'/.test(APP), 'renderToday thiếu task td-print');
  assert.ok(/cdDays >= 0 && cdDays <= 3/.test(APP), 'điều kiện ≤3 ngày chưa đúng');
  assert.ok(/go: printSheet/.test(APP), 'task td-print chưa trỏ printSheet');
});

test('dashboard: đồ thị 🎯 điểm sẵn sàng theo ngày wiring đủ', () => {
  assert.ok(HTML.includes('id="dash-chart-readiness"'), 'index.html thiếu dash-chart-readiness');
  assert.ok(/prep-readiness-log/.test(APP), 'app.js chưa dùng prep-readiness-log');
  assert.ok(/barChart\('dash-chart-readiness'/.test(APP), 'renderCharts chưa render đồ thị readiness');
  const pk = APP.match(/const PREP_KEYS = \[([\s\S]*?)\]/);
  assert.ok(pk && pk[1].includes('prep-readiness-log'), 'PREP_KEYS thiếu prep-readiness-log');
});

test('🎙️ nói-để-điền: helper + wiring Mock/STAR + dọn dẹp + PREP_KEYS + CSS', () => {
  // helper dùng chung
  assert.ok(/function bindDictation\b/.test(APP), 'thiếu hàm bindDictation');
  assert.ok(/function stopDictation\b/.test(APP), 'thiếu hàm stopDictation');
  assert.ok(/function bindDictLang\b/.test(APP), 'thiếu hàm bindDictLang (đổi VI/EN)');
  assert.ok(/dispatchEvent\(new Event\('input', \{ bubbles: true \}\)\)/.test(APP),
    'transcript phải bắn event input (autosave STAR/checklist lắng nghe input)');
  // Mock: nút trong index.html + bind ở initMock
  assert.ok(HTML.includes('id="mk-dict"') && HTML.includes('id="mk-dict-lang"'), 'index.html thiếu nút mk-dict / mk-dict-lang');
  assert.ok(/bindDictation\(document\.getElementById\('mk-dict'\), document\.getElementById\('mk-uans'\)\)/.test(APP),
    'initMock chưa bind 🎙️ vào #mk-uans');
  // STAR: nút từng ô + bind theo data-k + lang toggle trong session
  assert.ok(/class="dict-btn star-dict" data-k="\$\{k\}"/.test(APP), 'field STAR thiếu nút .star-dict');
  assert.ok(/\.star-ta\[data-k="\$\{b\.dataset\.k\}"\]/.test(APP), 'renderStarSession chưa nối nút mic với textarea cùng data-k');
  assert.ok(/id="star-dict-lang"/.test(APP), 'session STAR thiếu nút đổi ngôn ngữ');
  // Design drill: nút trong template session + bind vào #dg-answer
  assert.ok(/id="dg-dict"/.test(APP) && /id="dg-dict-lang"/.test(APP), 'session design thiếu nút dg-dict / dg-dict-lang');
  assert.ok(/bindDictation\(document\.getElementById\('dg-dict'\), ta\)/.test(APP), 'renderDgSession chưa bind 🎙️ vào #dg-answer');
  // dọn dẹp: mọi lối ra khỏi ô đang nghe đều tắt micro (QA 06/07: finishMock + đổi chế độ .mkm + mkAiGrade từng bị sót)
  const cleanups = APP.match(/stopDictation\(\);/g) || [];
  assert.ok(cleanups.length >= 8, `cần ≥8 điểm gọi stopDictation() (switchView/showMockQ/openStar/star-back/dg-back/finishMock/.mkm/mkAiGrade), thấy ${cleanups.length}`);
  // cờ VI/EN ở Mock repaint mỗi câu (prep-dict-lang dùng chung với STAR/Design — từng bị stale)
  assert.ok(/bindDictLang\(document\.getElementById\('mk-dict-lang'\), dictationSupported\(\)\)/.test(APP),
    'showMockQ chưa repaint cờ VI/EN');
  // đang đọc chính tả = đang soạn — live sync không được re-render giết mic giữa câu
  assert.ok(/if \(dictState\) return true;/.test(APP), 'isEditingNow chưa coi dictState là đang soạn');
  // ngôn ngữ lưu lại + xuất/nhập backup
  const pk = APP.match(/const PREP_KEYS = \[([\s\S]*?)\]/);
  assert.ok(pk && pk[1].includes('prep-dict-lang'), 'PREP_KEYS thiếu prep-dict-lang');
  const CSS = read('styles.css');
  assert.ok(CSS.includes('.dict-btn') && CSS.includes('.dict-on') && CSS.includes('.dict-lang'), 'styles.css thiếu style nút 🎙️');
});

test('📌 ghim câu hỏi: helper + nút ở 4 engine chấm + phiên ôn + bản in + PREP_KEYS + CSS', () => {
  // helper
  for (const fn of ['togglePin', 'isPinned', 'pinnedIds', 'pinnedTotal', 'buildPinnedQueue', 'startPinned', 'pinBtnHtml', 'bindPinBtns']) {
    assert.ok(new RegExp(`function ${fn}\\b`).test(APP), `thiếu hàm ${fn}`);
  }
  const pk = APP.match(/const PREP_KEYS = \[([\s\S]*?)\]/);
  assert.ok(pk && pk[1].includes('prep-quiz-pinned'), 'PREP_KEYS thiếu prep-quiz-pinned');
  // nút 📌 ở cả 4 chỗ chấm: makeQuiz (api/sql/cli), output, review session, vòng MCQ phỏng vấn
  assert.ok(/pinBtnHtml\(cfg\.mode, q\.id\)/.test(APP), 'makeQuiz answer() thiếu nút ghim');
  assert.ok(/pinBtnHtml\('output', q\.id\)/.test(APP), 'answerOutputQuiz thiếu nút ghim');
  assert.ok(/pinBtnHtml\(item\.mode, q\.id\)/.test(APP), 'answerReview thiếu nút ghim');
  assert.ok(/pinBtnHtml\(m\.modeKey, q\.id\)/.test(APP), 'answerMcq (vòng english/tình huống) thiếu nút ghim');
  const binds = APP.match(/bindPinBtns\(/g) || [];
  assert.ok(binds.length >= 5, `cần ≥5 lời gọi bindPinBtns (4 engine + khai báo), thấy ${binds.length}`);
  // phiên ôn câu ghim trong view 🔁 + bản in có khối 📌 (loại trùng với khối đang-sai)
  assert.ok(/id="review-pinned"/.test(APP), 'renderReview thiếu nút 📌 Ôn câu đã ghim');
  assert.ok(/pinnedHtml/.test(APP) && /wrongKeys\.has/.test(APP), 'printSheet thiếu khối 📌 hoặc chưa loại trùng câu đang-sai');
  // chấm đúng KHÔNG được tự gỡ ghim — không tồn tại lời gọi gỡ ghim theo kết quả chấm
  assert.ok(!/clearPin|unpinOnCorrect/.test(APP), 'ghim chỉ gỡ thủ công qua togglePin');
  // QA 06/07: lời chấm/kết thúc phiên theo loại (wrong/mixed/pinned) + Enter không cướp nút 📌 đang focus
  assert.ok(/reviewKind = 'pinned'/.test(APP) && /reviewKind = 'mixed'/.test(APP), 'start* chưa set reviewKind');
  assert.ok(/classList\?\.contains\('oq-pin'\)/.test(APP), 'handler Enter chưa nhường nút 📌 đang focus');
  const CSS = read('styles.css');
  assert.ok(CSS.includes('.oq-pin') && CSS.includes('.oq-fb-actions'), 'styles.css thiếu style nút 📌');
});

test('today 📌 + dashboard 📬: task câu ghim + đồ thị SRS đến hạn 7 ngày', () => {
  // task 📌 ở tab Hôm nay khi có câu ghim, đi thẳng vào phiên ôn ghim
  assert.ok(/id: 'td-pinned'/.test(APP), 'renderToday thiếu task td-pinned');
  assert.ok(/function goToPinnedReview\b/.test(APP), 'thiếu goToPinnedReview');
  const gp = APP.slice(APP.indexOf('function goToPinnedReview'), APP.indexOf('function goToPinnedReview') + 200);
  assert.ok(gp.includes("setThinkMode('review')") && gp.includes('startPinned()'), 'goToPinnedReview phải mở mode review rồi startPinned');
  // đồ thị đến hạn: container + render + dồn quá hạn vào cột Nay
  assert.ok(HTML.includes('id="dash-chart-due"'), 'index.html thiếu dash-chart-due');
  // guard null giờ nằm chung trong barChart (if (!el) return) — vẫn phải tồn tại
  assert.ok(/barChart\('dash-chart-due'/.test(APP), 'renderCharts chưa render đồ thị đến hạn qua barChart');
  const bcBlock = APP.slice(APP.indexOf('function barChart'), APP.indexOf('function barChart') + 400);
  assert.ok(/if \(!el\) return;/.test(bcBlock), 'barChart phải guard null container (HTML cũ do SW cache)');
  assert.ok(/Math\.max\(0, diff\)/.test(APP), 'quá hạn phải dồn vào cột hôm nay (Math.max(0, diff))');
  // bucket dùng srsDue thật (không tự cộng interval lần nữa)
  assert.ok(/srsDue\(e\) - t0\.getTime\(\)/.test(APP), 'bucket phải tính từ srsDue(entry)');
});

test('script đủ: index.html nạp mọi file dữ liệu trước app.js', () => {
  for (const f of ['coding-problems.js', 'iq-questions.js', 'english-questions.js',
    'situational-questions.js', 'design-drills.js', 'api-quiz.js', 'sql-drill.js', 'cli-quiz.js',
    'reverse-questions.js', 'english-phrases.js', 'app.js']) {
    assert.ok(HTML.includes(`src="${f}"`), `index.html thiếu <script src="${f}">`);
  }
  // app.js phải nạp SAU các file dữ liệu
  const idxApp = HTML.indexOf('src="app.js"');
  for (const f of ['design-drills.js', 'coding-problems.js']) {
    assert.ok(HTML.indexOf(`src="${f}"`) < idxApp, `${f} phải nạp trước app.js`);
  }
});

test('wiring: 🔎 tìm kiếm toàn cục — nút topbar, hotkey /, index đủ nguồn, điều hướng đúng', () => {
  // nút topbar + khởi tạo + overlay
  assert.ok(HTML.includes('id="gsearch-btn"'), 'index.html thiếu nút 🔎 gsearch-btn');
  assert.ok(/function initGSearch\b/.test(APP) && /initGSearch\(\);/.test(APP), 'initGSearch chưa được gọi trong init()');
  assert.ok(/function openGSearch\b/.test(APP) && /gsearchOpen\(\)/.test(APP), 'thiếu openGSearch/gsearchOpen (guard phím tắt)');
  // phím / giờ mở tìm kiếm toàn cục (không còn nhảy thẳng vào docs)
  const slash = APP.slice(APP.indexOf("e.key === '/'"), APP.indexOf("e.key === '/'") + 160);
  assert.ok(slash.includes('openGSearch()'), 'phím / phải mở openGSearch');
  // index phủ đủ: 6 mode QUIZ_MODES + 4 bank ngoài + lối tắt tìm docs
  const gs = APP.slice(APP.indexOf('function buildGsIndex'), APP.indexOf('function gsSearch'));
  for (const src of ['QUIZ_MODES', 'CODING_PROBLEMS', 'DEBUG_CHALLENGES', 'DESIGN_DRILLS', 'STAR_QUESTIONS',
    'REVERSE_QUESTIONS', 'ENGLISH_PHRASES']) {
    assert.ok(gs.includes(src), `buildGsIndex thiếu nguồn ${src}`);
  }
  // 2 bank tham khảo nhảy tới accordion đúng nhóm (mở details theo index group)
  assert.ok(/details\.rq-group`\)\[gi\]/.test(gs) && /d\.open = true/.test(gs),
    'openRefGroup phải mở đúng details.rq-group theo index nhóm');
  assert.ok(/function gsToDocs\b/.test(APP) && /dispatchEvent\(new Event\('input'\)\)/.test(APP), 'thiếu lối tắt tìm tiếp trong tài liệu');
  // kết quả trắc nghiệm luyện ngay 1 câu qua engine review (chấm như phiên 🎲 mixed: đúng ghi doneKey, sai vào hàng đợi 🔁)
  const gp = APP.slice(APP.indexOf('function gsPractice'), APP.indexOf('function gsPractice') + 500);
  assert.ok(gp.includes("setThinkMode('review')") && gp.includes("reviewKind = 'mixed'") && gp.includes('showReview()'),
    'gsPractice phải mượn engine review với reviewKind mixed');
  const CSS = read('styles.css');
  assert.ok(CSS.includes('#gsearch') && CSS.includes('.gs-row'), 'styles.css thiếu style modal 🔎');
});

test('gsNorm: bỏ dấu tiếng Việt + thường hoá để tìm không dấu', () => {
  const m = APP.match(/const gsNorm = (s => .+);/);
  assert.ok(m, 'không tìm thấy gsNorm');
  const gsNorm = new Function('return (' + m[1] + ')')();
  assert.strictEqual(gsNorm('Tình Huống'), 'tinh huong');
  assert.strictEqual(gsNorm('Điều Độ ĐÚNG'), 'dieu do dung');
  assert.strictEqual(gsNorm(null), '');
  assert.strictEqual(gsNorm('Event Loop'), 'event loop');
});

test('wiring: 📉 ôn câu sai theo chủ đề — chip topic + filter queue + guard MouseEvent', () => {
  assert.ok(/const reviewTopicOf = it => it\.q\.topic \|\| QUIZ_MODES\[it\.mode\]\.label/.test(APP),
    'thiếu reviewTopicOf (bank không topic gom theo label mode)');
  assert.ok(/function buildReviewQueue\(topicFilter\)/.test(APP), 'buildReviewQueue chưa nhận topicFilter');
  assert.ok(/topicFilter \? out\.filter\(it => reviewTopicOf\(it\) === topicFilter\) : out/.test(APP),
    'buildReviewQueue chưa lọc theo chủ đề');
  // renderReview: chip topic chỉ hiện khi ≥2 chủ đề, bind mở phiên lọc
  assert.ok(/topics\.length >= 2/.test(APP), 'chip topic phải ẩn khi chỉ có 1 chủ đề (không có gì để lọc riêng)');
  assert.ok(/\.rt-chip'\)\.forEach\(b => b\.onclick = \(\) => startReview\(b\.dataset\.topic\)\)/.test(APP),
    'chip topic chưa bind startReview(topic)');
  // startReview nhận cả MouseEvent (nút Ôn ngay gắn thẳng handler) lẫn string (chip)
  assert.ok(/typeof topic === 'string' \? topic : undefined/.test(APP),
    'startReview phải phân biệt string topic vs MouseEvent');
  const CSS = read('styles.css');
  assert.ok(CSS.includes('.rt-chip'), 'styles.css thiếu style chip chủ đề');
});
