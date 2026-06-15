# 📚 Study Web

Web ôn phỏng vấn: đọc tài liệu, flashcards (SRS), luyện viết/nghe/nói tiếng Anh,
luyện gõ code, mock interview, dashboard tiến độ. Tiến độ lưu trong `localStorage`.

## Chạy local (đầy đủ, có backend đọc file)

```bash
node study-web/server.js     # → http://localhost:4321
```

## Bản online (GitHub Pages — tĩnh)

GitHub Pages chỉ phục vụ file tĩnh nên không chạy được `server.js`. Thay vào đó
`study-web/build.js` gói sẵn dữ liệu thành `public/data/*.json`:

- `tree.json` — cây mục lục (thay `/api/tree`)
- `snippets.json` — snippet luyện gõ code (thay `/api/snippets`)
- `docs.json` — toàn bộ nội dung markdown để đọc + tìm kiếm (thay `/api/file`, `/api/search`)

Frontend (`app.js`) tự dò: gọi được `/api` thì dùng backend động, không thì tự chuyển
sang đọc `data/*.json`. GitHub Actions (`.github/workflows/pages.yml`) tự build và deploy
mỗi khi push lên `main`.

> Tự build thử bản tĩnh: `node study-web/build.js` rồi mở `public/` bằng web server tĩnh bất kỳ.
