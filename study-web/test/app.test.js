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
  const block = APP.slice(APP.indexOf('function switchView'), APP.indexOf('function switchView') + 900);
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
  const nf = SW.slice(SW.indexOf('async function networkFirst'), SW.indexOf('async function networkFirst') + 400);
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
  assert.ok(/ftNorm\(it\.answer\) === ftNorm\(it\.card\.front\)/.test(sub), 'ftSubmit chưa so khớp chuẩn hoá');
  assert.ok(/const PREP_KEYS = \[[\s\S]*?prep-ft-size[\s\S]*?\]/.test(APP), 'PREP_KEYS thiếu prep-ft-size');
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
  assert.ok(/coverageOf\('output'\)/.test(statsBlock), 'renderThinkStats phải dùng coverageOf');
  const readyBlock = APP.slice(APP.indexOf('function computeReadiness'), APP.indexOf('function readinessHtml'));
  assert.ok(/covPct\(coverageOf\('output'\)\)/.test(readyBlock), 'computeReadiness phải dùng coverageOf');
  const covOf = APP.slice(APP.indexOf('function coverageOf'), APP.indexOf('function coverageOf') + 300);
  assert.ok(/bankCoverage\(m\.data\(\), m\.doneKey\)/.test(covOf), 'coverageOf phải uỷ quyền bankCoverage');
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
  assert.ok(/dash-chart-readiness'\)\.innerHTML/.test(APP), 'renderCharts chưa render đồ thị readiness');
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
  assert.ok(/if \(dueEl\) dueEl\.innerHTML/.test(APP), 'renderCharts phải render đồ thị đến hạn CÓ guard null (HTML cũ do SW cache)');
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
  for (const src of ['QUIZ_MODES', 'CODING_PROBLEMS', 'DEBUG_CHALLENGES', 'DESIGN_DRILLS', 'STAR_QUESTIONS']) {
    assert.ok(gs.includes(src), `buildGsIndex thiếu nguồn ${src}`);
  }
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
