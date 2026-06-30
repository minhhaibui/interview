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

test('regression: badge oq/dbg lọc theo id còn tồn tại (tránh đếm vượt)', () => {
  const block = APP.slice(APP.indexOf('function computeBadges'), APP.indexOf('function computeBadges') + 1600);
  assert.ok(/oqIds\.has/.test(block), 'oqDoneN chưa lọc id tồn tại');
  assert.ok(/dbgIds\.has/.test(block), 'dbgDoneN chưa lọc id tồn tại');
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
  for (const key of ['prep-oq-done', 'prep-debug-solved', 'prep-api-done', 'prep-sql-done', 'prep-cli-done']) {
    assert.ok(block.includes(key), `computeReadiness chưa tính ${key} vào phần Tư duy`);
  }
  assert.ok(/thinkVals = \[codingPct, iqPct, ivBest, oqPct, dbgPct, apiPct, sqlPct, cliPct\]/.test(block),
    'thinkVals chưa gộp đủ 8 thành phần');
  // dashboard panel Tư duy
  assert.ok(HTML.includes('id="dash-think"'), 'index.html thiếu #dash-think');
  assert.ok(/function renderThinkStats\b/.test(APP), 'thiếu renderThinkStats');
  assert.ok(/renderThinkStats\(\)/.test(APP.slice(APP.indexOf('function renderDashboard'), APP.indexOf('function renderDashboard') + 2500)),
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
  assert.ok(/if \(onboardOpen\(\)\) return;/.test(APP), 'global keydown chưa guard onboardOpen()');
  assert.ok((APP.match(/if \(onboardOpen\(\)\) return;/g) || []).length >= 2,
    'cần guard onboardOpen() ở cả hotkey flashcards lẫn phím tắt tab');
  // CSS có khối onboarding
  const CSS = read('styles.css');
  assert.ok(/#onboard\s*{/.test(CSS), 'styles.css thiếu #onboard');
  assert.ok(/\.onb-card/.test(CSS), 'styles.css thiếu .onb-card');
});

test('script đủ: index.html nạp mọi file dữ liệu trước app.js', () => {
  for (const f of ['coding-problems.js', 'iq-questions.js', 'english-questions.js',
    'situational-questions.js', 'design-drills.js', 'api-quiz.js', 'sql-drill.js', 'cli-quiz.js', 'app.js']) {
    assert.ok(HTML.includes(`src="${f}"`), `index.html thiếu <script src="${f}">`);
  }
  // app.js phải nạp SAU các file dữ liệu
  const idxApp = HTML.indexOf('src="app.js"');
  for (const f of ['design-drills.js', 'coding-problems.js']) {
    assert.ok(HTML.indexOf(`src="${f}"`) < idxApp, `${f} phải nạp trước app.js`);
  }
});
