/**
 * Logic đọc tài liệu dùng chung cho cả server động (server.js) và build tĩnh (build.js).
 * Các hàm đều nhận ROOT (thư mục gốc chứa tài liệu) làm tham số → không phụ thuộc nơi gọi.
 */
const fs = require('fs');
const path = require('path');

/** Đổi 'week-05-redis' → 'Tuần 05 · Redis' */
function prettyWeekName(dir) {
  const m = dir.match(/^week-(\d+)-(.+)$/);
  if (!m) return dir;
  const topic = m[2].split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
  return `Tuần ${m[1]} · ${topic}`;
}

/** Quét thư mục tài liệu, dựng cây nội dung cho sidebar */
function buildTree(ROOT) {
  const groups = [];
  const exists = p => fs.existsSync(path.join(ROOT, p));

  groups.push({
    title: '🏠 Tổng quan',
    items: [
      { label: 'Giới thiệu lộ trình', path: 'README.md' },
      exists('capstone-project/README.md') && { label: '⭐ Capstone Project', path: 'capstone-project/README.md' },
      exists('capstone-project/GETTING-STARTED.md') && { label: '🚀 Capstone — Bắt đầu code', path: 'capstone-project/GETTING-STARTED.md' },
      exists('capstone-project/UPGRADE-01-POSTGRES.md') && { label: '↳ Upgrade 1 — Postgres', path: 'capstone-project/UPGRADE-01-POSTGRES.md', sub: true },
      exists('capstone-project/UPGRADE-02-REDIS.md') && { label: '↳ Upgrade 2 — Redis cache', path: 'capstone-project/UPGRADE-02-REDIS.md', sub: true },
      exists('capstone-project/UPGRADE-03-KAFKA.md') && { label: '↳ Upgrade 3 — Kafka outbox', path: 'capstone-project/UPGRADE-03-KAFKA.md', sub: true },
      exists('capstone-project/UPGRADE-04-DOCKER-K8S.md') && { label: '↳ Upgrade 4 — Docker & K8s', path: 'capstone-project/UPGRADE-04-DOCKER-K8S.md', sub: true },
    ].filter(Boolean),
  });

  const weekDirs = fs.readdirSync(ROOT).filter(d => /^week-\d+/.test(d)).sort();
  groups.push({
    title: '📅 Lộ trình 12 tuần',
    items: weekDirs.flatMap(d => {
      const items = [];
      if (exists(`${d}/README.md`)) items.push({ label: prettyWeekName(d), path: `${d}/README.md`, week: d });
      if (exists(`${d}/CO-BAN.md`)) items.push({ label: '↳ 🌱 Nhập môn (dễ, đọc trước)', path: `${d}/CO-BAN.md`, week: d, sub: true });
      if (exists(`${d}/DESIGN-CASES.md`)) items.push({ label: '↳ Design & Cases', path: `${d}/DESIGN-CASES.md`, week: d, sub: true });
      if (exists(`${d}/RAPID-FIRE.md`)) items.push({ label: '↳ ⚡ Rapid-fire', path: `${d}/RAPID-FIRE.md`, week: d, sub: true });
      if (exists(`${d}/DEEP-DIVE.md`)) items.push({ label: '↳ 🔬 Đào sâu', path: `${d}/DEEP-DIVE.md`, week: d, sub: true });
      if (exists(`${d}/lab/LAB.md`)) items.push({ label: '↳ 🧪 Lab (tận tay)', path: `${d}/lab/LAB.md`, week: d, sub: true });
      return items;
    }),
  });

  const dirGroup = (title, dir) => {
    if (!exists(dir)) return null;
    const files = fs.readdirSync(path.join(ROOT, dir)).filter(f => f.endsWith('.md')).sort();
    return {
      title,
      items: files.map(f => ({
        label: f.replace(/^README\.md$/, 'Tổng quan').replace(/\.md$/, '').replace(/^\d+-/, '').replace(/-/g, ' '),
        path: `${dir}/${f}`,
      })),
    };
  };

  const g1 = dirGroup('🧩 System Design Scenarios', 'system-design-scenarios');
  const g2 = dirGroup('🏗️ Design Patterns', 'design-patterns');
  const g3 = dirGroup('🇬🇧 English Track', 'english');
  [g1, g2, g3].forEach(g => g && groups.push(g));

  return groups;
}

/** Tìm toàn văn trong mọi file .md (trừ study-web) */
function searchDocs(ROOT, q) {
  const needle = q.toLowerCase();
  const results = [];
  const MAX = 60;
  const walk = dir => {
    if (results.length >= MAX) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'study-web') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.md')) {
        const lines = fs.readFileSync(full, 'utf8').split('\n');
        for (let i = 0; i < lines.length && results.length < MAX; i++) {
          if (lines[i].toLowerCase().includes(needle)) {
            results.push({ path: path.relative(ROOT, full), line: i + 1, text: lines[i].trim().slice(0, 180) });
          }
        }
      }
      if (results.length >= MAX) return;
    }
  };
  walk(ROOT);
  return results;
}

/**
 * Trích các code block ```js/ts… trong tài liệu làm bài luyện gõ code.
 * Chỉ lấy snippet 3-12 dòng cho vừa một lượt gõ.
 */
function extractSnippets(ROOT) {
  const files = [];
  for (const d of fs.readdirSync(ROOT)) {
    if (/^week-\d+/.test(d) && fs.existsSync(path.join(ROOT, d, 'README.md'))) {
      files.push(`${d}/README.md`);
    }
  }
  for (const dir of ['design-patterns', 'system-design-scenarios', 'capstone-project']) {
    if (!fs.existsSync(path.join(ROOT, dir))) continue;
    for (const f of fs.readdirSync(path.join(ROOT, dir))) {
      if (f.endsWith('.md')) files.push(`${dir}/${f}`);
    }
  }

  const snippets = [];
  for (const rel of files) {
    const lines = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n');
    let heading = '';
    for (let i = 0; i < lines.length; i++) {
      const h = lines[i].match(/^#{1,4}\s+(.+)/);
      if (h) { heading = h[1].replace(/[*`#]/g, '').trim(); continue; }
      const fence = lines[i].match(/^```(js|javascript|ts|typescript|sql|yaml|yml|bash|sh|dockerfile)\s*$/i);
      if (!fence) continue;
      let j = i + 1;
      while (j < lines.length && !lines[j].startsWith('```')) j++;
      const code = lines.slice(i + 1, j).join('\n').replace(/\t/g, '  ').trimEnd();
      i = j;
      const n = code.split('\n').length;
      if (n < 3 || n > 12 || code.length > 700) continue;
      snippets.push({ file: rel, lang: fence[1], title: heading, code });
    }
  }
  return snippets;
}

/** Gom toàn bộ nội dung .md thành { 'relpath': 'content' } — dùng cho bản tĩnh (đọc + tìm kiếm) */
function collectDocs(ROOT) {
  const docs = {};
  const walk = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'study-web') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.md')) docs[path.relative(ROOT, full).split(path.sep).join('/')] = fs.readFileSync(full, 'utf8');
    }
  };
  walk(ROOT);
  return docs;
}

module.exports = { prettyWeekName, buildTree, searchDocs, extractSnippets, collectDocs };
