/**
 * Study Web — server tĩnh + API đọc tài liệu markdown của lộ trình.
 *
 * Viết bằng Node.js core (http, fs, path) — KHÔNG cần npm install.
 * Đây cũng là code mẫu cho Tuần 1: HTTP server, streams, path traversal security.
 *
 * Chạy:  node study-web/server.js   →  http://localhost:4321
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { buildTree, searchDocs, extractSnippets } = require('./lib');

const ROOT = path.resolve(__dirname, '..');     // thư mục gốc chứa tài liệu
const PUBLIC = path.join(__dirname, 'public');  // frontend
const PORT = process.env.PORT || 4321;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

// Cache snippet vì tài liệu ít thay đổi trong một lần chạy server
let snippetsCache = null;
const getSnippets = () => (snippetsCache ??= extractSnippets(ROOT));

/** Chống path traversal: chỉ cho đọc file .md nằm trong ROOT */
function safeMdPath(rel) {
  const abs = path.resolve(ROOT, rel);
  if (!abs.startsWith(ROOT + path.sep) || !abs.endsWith('.md')) return null;
  return fs.existsSync(abs) ? abs : null;
}

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // --- API ---
  if (url.pathname === '/api/tree') {
    try { return sendJSON(res, 200, buildTree(ROOT)); }
    catch (err) { return sendJSON(res, 500, { error: err.message }); }
  }

  if (url.pathname === '/api/search') {
    const q = (url.searchParams.get('q') || '').trim();
    if (q.length < 2) return sendJSON(res, 200, []);
    try { return sendJSON(res, 200, searchDocs(ROOT, q)); }
    catch (err) { return sendJSON(res, 500, { error: err.message }); }
  }

  if (url.pathname === '/api/snippets') {
    try { return sendJSON(res, 200, getSnippets()); }
    catch (err) { return sendJSON(res, 500, { error: err.message }); }
  }

  if (url.pathname === '/api/file') {
    const abs = safeMdPath(url.searchParams.get('path') || '');
    if (!abs) return sendJSON(res, 404, { error: 'File không tồn tại hoặc không hợp lệ' });
    res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8' });
    // Stream thay vì readFile: không buffer cả file vào memory (bài học Tuần 1!)
    return fs.createReadStream(abs).on('error', () => res.end()).pipe(res);
  }

  // --- Static files ---
  let file = path.join(PUBLIC, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n  📚 Study Web đang chạy: http://localhost:${PORT}\n`);
  console.log('  Nhấn Ctrl+C để dừng.\n');
});

// Graceful shutdown — đúng pattern Tuần 2
process.on('SIGINT', () => {
  console.log('\n  Đang tắt server...');
  server.close(() => process.exit(0));
});
