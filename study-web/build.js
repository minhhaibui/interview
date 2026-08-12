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
const PUBLIC = path.join(__dirname, 'public');

// Nạp study-web/.env nếu có (chạy local). Trên CI dùng biến môi trường từ GitHub Secrets.
try { process.loadEnvFile(path.join(__dirname, '.env')); } catch { /* không có .env → bỏ qua */ }

fs.mkdirSync(OUT, { recursive: true });

const write = (name, data) => {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, JSON.stringify(data));
  const kb = (fs.statSync(file).size / 1024).toFixed(0);
  console.log(`  ✓ ${name.padEnd(14)} ${kb} KB`);
};

// Sinh public/firebase-config.js từ biến môi trường (không commit config vào repo).
// Hai cách khai báo, ưu tiên cách 1 vì trên GitHub chỉ phải tạo MỘT secret:
//   1. FIREBASE_CONFIG = nguyên khối JSON copy từ Firebase Console
//   2. FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, … (7 biến rời)
// Lưu ý: đây KHÔNG phải secret — config web Firebase vốn công khai; bảo mật nằm ở Firestore Rules.
function buildFirebaseConfig() {
  const e = process.env;
  let cfg = null;
  if (e.FIREBASE_CONFIG && e.FIREBASE_CONFIG.trim()) {
    try {
      cfg = JSON.parse(e.FIREBASE_CONFIG);
    } catch (err) {
      // Sai JSON mà im lặng thì site deploy xong mới lòi ra "Chưa cấu hình Firebase" → chặn build luôn.
      console.error(`  ✗ FIREBASE_CONFIG không phải JSON hợp lệ: ${err.message}`);
      process.exit(1);
    }
  } else {
    cfg = {
      apiKey: e.FIREBASE_API_KEY,
      authDomain: e.FIREBASE_AUTH_DOMAIN,
      projectId: e.FIREBASE_PROJECT_ID,
      storageBucket: e.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: e.FIREBASE_MESSAGING_SENDER_ID,
      appId: e.FIREBASE_APP_ID,
      measurementId: e.FIREBASE_MEASUREMENT_ID,
    };
  }
  const file = path.join(PUBLIC, 'firebase-config.js');
  if (!cfg.apiKey) {
    // Không có env: giữ nguyên file sẵn có (nếu có) để dev local không bị mất config.
    const note = fs.existsSync(file) ? '(giữ file local sẵn có)' : '(THIẾU — đăng nhập sẽ không chạy)';
    console.log(`  ⚠ firebase-config.js: chưa có FIREBASE_CONFIG hay biến FIREBASE_* ${note}`);
    return;
  }
  const banner = '/* TỰ ĐỘNG SINH từ env bởi build.js — KHÔNG sửa tay, KHÔNG commit. */\n';
  fs.writeFileSync(file, `${banner}window.FIREBASE_CONFIG = ${JSON.stringify(cfg, null, 2)};\n`);
  console.log('  ✓ firebase-config.js  (sinh từ env)');
}

console.log('Building static data → public/data/');
write('tree.json', buildTree(ROOT));
write('snippets.json', extractSnippets(ROOT));
const docs = collectDocs(ROOT);
write('docs.json', docs);
buildFirebaseConfig();
console.log(`Done. ${Object.keys(docs).length} tài liệu .md đã gói tĩnh.`);
