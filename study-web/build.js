/**
 * Build bản TĨNH của Study Web để chạy trên GitHub Pages (không có Node backend).
 * Sinh sẵn dữ liệu mà các API động vẫn trả về, đặt vào public/data/*.json:
 *   - tree.json     : cây sidebar (thay /api/tree)
 *   - snippets.json : snippet luyện gõ code (thay /api/snippets)
 *   - docs.json     : { 'relpath': 'nội dung md' } — frontend dùng cho đọc file + tìm kiếm
 *
 * Chạy:  node study-web/build.js
 */
const fs = require('fs');
const path = require('path');
const { buildTree, extractSnippets, collectDocs } = require('./lib');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'public', 'data');

fs.mkdirSync(OUT, { recursive: true });

const write = (name, data) => {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, JSON.stringify(data));
  const kb = (fs.statSync(file).size / 1024).toFixed(0);
  console.log(`  ✓ ${name.padEnd(14)} ${kb} KB`);
};

console.log('Building static data → public/data/');
write('tree.json', buildTree(ROOT));
write('snippets.json', extractSnippets(ROOT));
const docs = collectDocs(ROOT);
write('docs.json', docs);
console.log(`Done. ${Object.keys(docs).length} tài liệu .md đã gói tĩnh.`);
