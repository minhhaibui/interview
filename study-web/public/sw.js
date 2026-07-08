/*
 * Service Worker — cho phép cài app (PWA) và học OFFLINE.
 * Chiến lược:
 *   - App shell (cùng origin): stale-while-revalidate — trả cache ngay cho nhanh,
 *     đồng thời tải bản mới ở nền để lần sau cập nhật.
 *   - Thư viện CDN (jsdelivr/gstatic): cache-first — URL có version nên bất biến.
 *   - /api/* và các request cross-origin khác (Firebase, Anthropic): không can thiệp.
 * Đổi VERSION mỗi khi muốn ép xoá cache cũ.
 */
const VERSION = 'v104';
const CACHE = `prep-${VERSION}`;
const CDN_HOSTS = ['cdn.jsdelivr.net', 'www.gstatic.com'];

// Tài nguyên cốt lõi nạp sẵn để mở được app khi không có mạng.
const PRECACHE = [
  './', 'index.html', 'styles.css', 'app.js',
  'coding-problems.js', 'iq-questions.js', 'english-questions.js', 'situational-questions.js',
  'design-drills.js', 'output-quiz.js', 'debug-challenges.js', 'api-quiz.js', 'sql-drill.js', 'cli-quiz.js',
  'star-questions.js', 'reverse-questions.js', 'english-phrases.js', 'capstone-tracker.js',
  'ko-vocab.js', 'zh-vocab.js',
  'icon.svg', 'manifest.webmanifest',
  'data/tree.json', 'data/snippets.json', 'data/docs.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Nạp từng cái, lỗi cái nào bỏ qua cái đó (vd firebase-config.js có thể chưa có).
    await Promise.allSettled(PRECACHE.map((u) => cache.add(new Request(u, { cache: 'reload' }))));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // chỉ xử lý GET
  const url = new URL(req.url);

  // Không động vào API động (chỉ có khi chạy server.js) — luôn lấy bản mới.
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;

  // Thư viện CDN đã version hoá → cache-first.
  if (CDN_HOSTS.includes(url.hostname)) {
    e.respondWith(cacheFirst(req));
    return;
  }

  if (url.origin === self.location.origin) {
    // App shell (trang HTML + code .js/.css) → NETWORK-FIRST: luôn lấy bản mới khi online,
    // fallback cache khi offline. Tránh tình trạng phục vụ code CŨ một lượt sau mỗi lần deploy
    // (stale-while-revalidate khiến người dùng thấy bản trước đó tới tận lần tải kế tiếp).
    if (req.mode === 'navigate' || /\.(?:js|css)(?:\?|$)/.test(url.pathname)) {
      e.respondWith(networkFirst(req));
      return;
    }
    // Dữ liệu tĩnh khác (data/*.json, icon, manifest…) → stale-while-revalidate cho nhanh.
    e.respondWith(staleWhileRevalidate(req));
  }
  // Còn lại (Firebase, Anthropic…) để trình duyệt tự xử lý.
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req);
    if (hit) return hit;
    if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
    return Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return hit || Response.error();
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const fetching = fetch(req)
    .then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; })
    .catch(() => null);
  // Có cache thì trả ngay; chưa có thì chờ mạng; mạng hỏng + là điều hướng thì rơi về index.html.
  if (hit) return hit;
  const net = await fetching;
  if (net) return net;
  if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
  return Response.error();
}
