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

test('readiness: tổng trọng số 7 phần = 1.0 (điểm không lệch thang)', () => {
  // trích các weight trong computeReadiness (đứng liền trong mảng parts)
  const block = APP.slice(APP.indexOf('function computeReadiness'), APP.indexOf('function readinessHtml'));
  const weights = [...block.matchAll(/weight:\s*(0?\.\d+)/g)].map(m => +m[1]);
  assert.ok(weights.length >= 6, 'không trích đủ weight');
  const sum = weights.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `tổng trọng số = ${sum} ≠ 1.0`);
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

test('script đủ: index.html nạp mọi file dữ liệu trước app.js', () => {
  for (const f of ['coding-problems.js', 'iq-questions.js', 'english-questions.js',
    'situational-questions.js', 'design-drills.js', 'app.js']) {
    assert.ok(HTML.includes(`src="${f}"`), `index.html thiếu <script src="${f}">`);
  }
  // app.js phải nạp SAU các file dữ liệu
  const idxApp = HTML.indexOf('src="app.js"');
  for (const f of ['design-drills.js', 'coding-problems.js']) {
    assert.ok(HTML.indexOf(`src="${f}"`) < idxApp, `${f} phải nạp trước app.js`);
  }
});
