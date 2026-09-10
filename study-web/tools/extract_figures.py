#!/usr/bin/env python3
"""Cắt SƠ ĐỒ trong sách scan ra ảnh WebP cho tab "Ebook".

    PDF scan (ngoài repo) --> public/img/ebook/<sách>/fig-<n.m>.webp
                          --> data/figures/<sách>.json  (khoá băm block -> tên ảnh)

Sách alex-vol2 là BẢN SCAN: mỗi trang chỉ là một ảnh raster, chữ lấy từ OCR
(data/ocr/<sách>.jsonl.gz). Vì vậy sơ đồ không tồn tại dưới dạng ảnh rời — phải
CẮT VÙNG HÌNH ra khỏi ảnh trang.

Cách xác định vùng hình: trong sách này chú thích luôn nằm DƯỚI hình, nên vùng
hình là dải dọc từ đáy dòng VĂN BẢN THÂN BÀI gần nhất phía trên xuống tới đỉnh
dòng chú thích. Các dòng OCR nằm trong dải đó là nhãn bên trong sơ đồ — chúng
cho luôn biên trái/phải của hình.

Chạy TAY (máy build của GitHub Actions không có PDF); ảnh kết quả được commit.

    python3 tools/extract_figures.py alex-vol2                 # cả sách
    python3 tools/extract_figures.py alex-vol2 06              # 1 chương
    python3 tools/extract_figures.py alex-vol2 --check         # chỉ soát, không ghi

Manifest ghi RIÊNG TỪNG CHƯƠNG (data/figures/<sách>/<chương>.json) để nhiều
người chạy song song các chương khác nhau không ghi đè nhau.

Cắt sai thì KHÔNG sửa code — đặt toạ độ tay vào file đè của chương:

    data/figures/overrides/<sách>/<chương>.json
    { "6.9": { "p": 175, "y0": 0.33, "y1": 0.62, "x0": 0.10, "x1": 0.90 } }

trong đó p là số trang PDF, còn y0/y1/x0/x1 là tỉ lệ 0..1 của trang (gốc trên
trái). Thiếu khoá nào thì lấy giá trị máy tự suy.
"""
import difflib
import gzip
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parent.parent
EN = ROOT / 'data' / 'ebooks-en'
OCR = ROOT / 'data' / 'ocr'
IMG = ROOT / 'public' / 'img' / 'ebook'
MANIFEST = ROOT / 'data' / 'figures'

PDFS = {
    'alex-vol2': '/Users/avada/Downloads/ebooks-system-design/design.interview.alex/'
                 'system-design-interview VOL 2 BUY.pdf',
}

#: Chú thích thật LUÔN có dấu hai chấm ngay sau số hiệu ("Figure 6.17: Duplicate
#: data"). Câu văn thân bài cũng mở đầu bằng số hiệu ("Figure 6.17 shows how...")
#: và có khi bị bộ trích phân loại nhầm thành block figure — dấu hai chấm là thứ
#: phân biệt hai loại, thiếu nó thì bỏ qua, đừng cắt ảnh.
CAPTION = re.compile(r'^(?:Figure|Fiqure|Fígure)\s*(\d+)\s*[.,]\s*(\d+)\s*[:;]')
#: Dòng thân bài: rộng gần hết cột chữ và bắt đầu sát lề trái.
BODY_MIN_W = 0.48
BODY_MAX_X = 0.22
#: Lề an toàn quanh vùng cắt (theo tỉ lệ trang).
PAD_X, PAD_TOP, PAD_BOT = 0.02, 0.017, 0.005
#: Khung in của trang. Nhãn OCR chỉ là CHỮ bên trong hộp vẽ, hộp còn rộng hơn
#: — nên luôn nới vùng cắt ra ít nhất bằng khung in, tránh cắt cụt hộp/mũi tên.
COL_X0, COL_X1 = 0.075, 0.925
#: Dải hình mỏng hơn mức này thì coi như cắt sai (chú thích dính chú thích).
MIN_BAND_H = 0.045
#: Mức giống nhau tối thiểu giữa dòng OCR và chú thích trong corpus để coi là
#: đúng dòng chú thích (lọc câu văn thân bài có nhắc số hiệu hình).
MIN_CAP_SIM = 0.55
OUT_W = 1100          # bề ngang ảnh xuất ra (px), thu nhỏ nếu trang nhỏ hơn
WEBP_Q = 82


def load_ocr(book):
    """page (1-based) -> danh sách dòng OCR {t,x,y,w,h}."""
    pages = {}
    with gzip.open(OCR / f'{book}.jsonl.gz', 'rt') as f:
        for line in f:
            d = json.loads(line)
            pages[d['page']] = d['lines']
    return pages


def fig_no(text):
    m = CAPTION.match(text.strip())
    return f'{m.group(1)}.{m.group(2)}' if m else None


def similar(a, b):
    """Độ giống giữa dòng OCR và chú thích trong corpus (0..1)."""
    norm = lambda t: re.sub(r'\s+', ' ', t).strip().lower()
    return difflib.SequenceMatcher(None, norm(a), norm(b)).ratio()


def caption_pages(pages):
    """'6.10' -> [(trang, dòng chú thích)] theo đúng thứ tự trang."""
    found = {}
    for pno in sorted(pages):
        for ln in pages[pno]:
            n = fig_no(ln['t'])
            if n:
                found.setdefault(n, []).append((pno, ln))
    return found


def band(lines, cap):
    """Dải dọc của hình + biên ngang, suy từ các dòng OCR quanh chú thích."""
    top_limit = cap['y'] - PAD_BOT
    above = [l for l in lines if l['y'] + l['h'] <= top_limit + 0.004]
    body = [l for l in above if l['w'] >= BODY_MIN_W and l['x'] <= BODY_MAX_X]
    # Chú thích của hình TRƯỚC cũng là biên trên (hai hình liền nhau một trang).
    caps = [l for l in above if fig_no(l['t'])]
    edges = [l['y'] + l['h'] for l in body + caps]
    y0 = max(edges) + PAD_TOP if edges else 0.055
    y1 = cap['y'] - PAD_BOT

    inner = [l for l in lines if l['y'] >= y0 - 0.004 and l['y'] + l['h'] <= y1 + 0.004]
    if inner:
        x0 = min(COL_X0, min(l['x'] for l in inner) - PAD_X)
        x1 = max(COL_X1, max(l['x'] + l['w'] for l in inner) + PAD_X)
    else:
        x0, x1 = COL_X0, COL_X1
    return max(0.0, y0), y1, max(0.0, x0), min(1.0, x1)


def crop(page, rect01, out, quiet=False):
    """Cắt vùng (tỉ lệ 0..1) của trang thành WebP."""
    y0, y1, x0, x1 = rect01
    r = page.rect
    clip = fitz.Rect(x0 * r.width, y0 * r.height, x1 * r.width, y1 * r.height)
    zoom = min(4.0, OUT_W / max(1.0, clip.width))
    pix = page.get_pixmap(clip=clip, matrix=fitz.Matrix(zoom, zoom))
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
        pix.save(tmp.name)
        png = tmp.name
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['cwebp', '-quiet', '-q', str(WEBP_Q), png, '-o', str(out)], check=True)
    Path(png).unlink()
    return pix.width, pix.height


def ruler(book, pno, out):
    """Xuất cả trang PDF kèm thước tỉ lệ 0..1 để đọc toạ độ đặt tay."""
    doc = fitz.open(PDFS[book])
    page = doc[pno - 1]
    r = page.rect
    for i in range(1, 20):
        f = i / 20
        y, x = f * r.height, f * r.width
        page.draw_line((0, y), (r.width, y), color=(1, 0, 0), width=0.4)
        page.draw_line((x, 0), (x, r.height), color=(0, 0.5, 1), width=0.3)
        page.insert_text((2, y - 2), f'{f:.2f}', fontsize=6, color=(1, 0, 0))
        page.insert_text((x + 1, 8), f'{f:.2f}', fontsize=5, color=(0, 0.4, 1))
    page.get_pixmap(matrix=fitz.Matrix(2, 2)).save(out)
    print(f'trang {pno} -> {out}  (đỏ = y, xanh = x)')


def main():
    book = sys.argv[1]
    if '--page' in sys.argv:
        pno = int(sys.argv[sys.argv.index('--page') + 1])
        out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv \
            else f'/tmp/page-{pno}.png'
        return ruler(book, pno, out)
    only = [a for a in sys.argv[2:] if not a.startswith('-')]
    check = '--check' in sys.argv

    pages = load_ocr(book)
    caps = caption_pages(pages)
    doc = fitz.open(PDFS[book])

    used, warn, done = {}, [], 0

    for ch_file in sorted((EN / book).glob('*.json')):
        if ch_file.name == 'index.json':
            continue
        if only and not any(ch_file.name.startswith(o) for o in only):
            continue
        ch = json.loads(ch_file.read_text())
        ov_file = MANIFEST / 'overrides' / book / f'{ch["id"]}.json'
        over = json.loads(ov_file.read_text()) if ov_file.exists() else {}
        mf_file = MANIFEST / book / f'{ch["id"]}.json'
        manifest = {}
        for b in ch['blocks']:
            if b['t'] != 'figure':
                continue
            n = fig_no(b['en'])
            if not n:
                continue
            o = over.get(n, {})
            # Số hiệu hình còn xuất hiện trong CÂU VĂN thân bài ("Figure 6.17
            # shows how...") ở trang trước — chọn dòng GIỐNG CHÚ THÍCH THẬT nhất
            # chứ không lấy dòng đầu tiên, nếu không sẽ cắt nhầm trang.
            hits = [h for h in caps.get(n, []) if (n, h[0]) not in used]
            hits.sort(key=lambda h: -similar(h[1]['t'], b['en']))
            if (not hits or similar(hits[0][1]['t'], b['en']) < MIN_CAP_SIM) and 'p' not in o:
                best = f' (giống nhất: "{hits[0][1]["t"][:50]}")' if hits else ''
                warn.append(f'{ch["id"]} Hình {n}: không khớp chú thích trong OCR{best} '
                            f'— cần đặt tay trong {ov_file.relative_to(ROOT)}')
                continue
            pno, cap = hits[0] if hits else (o['p'], None)
            pno = o.get('p', pno)
            used[(n, pno)] = True
            auto = band(pages[pno], cap) if cap else (0.055, 0.9, COL_X0, COL_X1)
            y0, y1, x0, x1 = (o.get('y0', auto[0]), o.get('y1', auto[1]),
                              o.get('x0', auto[2]), o.get('x1', auto[3]))
            if y1 - y0 < MIN_BAND_H:
                warn.append(f'{ch["id"]} Hình {n} (tr.{pno}): dải hình quá mỏng '
                            f'({y1 - y0:.3f}) — cần đặt tay trong '
                            f'{ov_file.relative_to(ROOT)}')
                continue
            name = f'fig-{n}.webp'
            if not check:
                w, h = crop(doc[pno - 1], (y0, y1, x0, x1), IMG / book / name)
                manifest[b['k']] = {'f': name, 'w': w, 'h': h, 'p': pno}
            done += 1

        if not check and manifest:
            mf_file.parent.mkdir(parents=True, exist_ok=True)
            mf_file.write_text(json.dumps(manifest, ensure_ascii=False, indent=1))

    print(f'{book}: {done} hình' + (' (chế độ soát)' if check else ''))
    for w in warn:
        print('  ⚠', w)


if __name__ == '__main__':
    main()
