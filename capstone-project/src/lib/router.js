/**
 * Router tối giản: match method + path pattern kiểu '/orders/:id'.
 * Handler nhận (req, params) và trả { status, body } — không đụng trực tiếp res.
 */
class Router {
  constructor() {
    this.routes = [];
  }

  add(method, pattern, handler) {
    const keys = [];
    const regex = new RegExp(
      '^' + pattern.replace(/:[^/]+/g, seg => {
        keys.push(seg.slice(1));
        return '([^/]+)';
      }) + '$'
    );
    this.routes.push({ method, regex, keys, handler });
  }

  /** Trả về { handler, params } hoặc null nếu không route nào khớp */
  match(method, pathname) {
    for (const r of this.routes) {
      if (r.method !== method) continue;
      const m = pathname.match(r.regex);
      if (!m) continue;
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      return { handler: r.handler, params };
    }
    return null;
  }
}

module.exports = { Router };
