#!/usr/bin/env python3
"""Dựng lại cấu trúc chương/block từ JSONL của tools/ocr_pdf.py.

Bản scan không có font info, nên cỡ chữ được suy ra từ BỀ RỘNG TRUNG BÌNH MỖI KÝ TỰ
(w / số ký tự). Chỉ số này tỉ lệ thuận với cỡ chữ và không phụ thuộc việc dòng có nét
trên/nét dưới hay không — khác hẳn chiều cao bounding box, vốn nhiễu tới mức vô dụng
(thân bài đo được 0,0116–0,0268 trong cùng một trang).

    python3 ocr_blocks.py in.jsonl out_dir --book alex-vol2
"""
import argparse
import hashlib
import json
import re
import statistics
import unicodedata
from pathlib import Path

# Ngưỡng phân loại, tính theo bội số của cỡ chữ thân bài. Kèm độ dài tối thiểu vì
# dòng ngắn luôn bị thổi phồng cw (bounding box có đệm hai bên).
H2, H2_MIN = 1.25, 10
H3, H3_MIN = 1.10, 15
NOISE = 0.78    # nhỏ hơn mức này gần như chắc chắn là nhãn trong sơ đồ
COL_MAX = 0.32  # thân bài nằm trong cột x≈0,10–0,22; xa hơn là chữ trong hình vẽ
BULLETS = '•◦‣·▪-–'

# Trang mở chương có bố cục cố định: số chương đứng riêng một dòng, rồi tới tiêu đề
# cỡ rất lớn. Bám vào vị trí đáng tin hơn nhiều so với chỉ nhìn cỡ chữ — chữ to trong
# sơ đồ ("Watkins", "Redis", "1880") cũng vượt ngưỡng cỡ chữ nhưng không bao giờ
# rơi đúng ô này.
CH_IDX, CH_Y, CH_X, CH_R, CH_ALPHA = 2, (0.12, 0.21), (0.16, 0.27), 1.85, 0.85


def norm(s):
    return ' '.join(s.lower().split())


def key_of(text):
    return hashlib.sha1(norm(text).encode()).hexdigest()[:12]


def slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    s = re.sub(r'[^a-zA-Z0-9]+', '-', s).strip('-').lower()
    return re.sub(r'-+', '-', s)[:60]


def cw(line):
    """Bề rộng trung bình mỗi ký tự — proxy cỡ chữ."""
    n = len(line['t'].strip())
    return line['w'] / n if n else 0.0


def fix_ocr(s):
    """Sửa những nhầm lẫn OCR lặp lại nhiều lần trên bản scan này."""
    # Ngoặc vuông/tròn bị lẫn ở mục tham khảo: "[4)", "(5]", "19)" -> "[4]", "[5]", "[19]"
    s = re.sub(r'[\[(](\d{1,3})[\])]', r'[\1]', s)
    s = re.sub(r'\s+([,.;:])', r'\1', s)
    return ' '.join(s.split())


def load_pages(path):
    for ln in open(path):
        ln = ln.strip()
        if ln:
            yield json.loads(ln)


def chapter_title(lines, base):
    """Nếu trang này mở một chương, trả về tiêu đề; ngược lại None.

    Tiêu đề có thể bị ngắt dòng ("Metrics Monitoring and Alerting Sys-" + "tem"),
    nên gom cả những dòng kế tiếp cùng cỡ chữ lớn.
    """
    for i, l in enumerate(lines[:CH_IDX + 1]):
        t = l['t'].strip()
        n = len(t)
        if n < 5:
            continue
        r = cw(l) / base
        alpha = sum(c.isalpha() or c in ' -' for c in t) / n
        if not (r > CH_R and alpha >= CH_ALPHA
                and CH_Y[0] < l['y'] < CH_Y[1]
                and CH_X[0] < l['x'] < CH_X[1]):
            continue
        title = t
        for nxt in lines[i + 1:i + 3]:   # phần tiêu đề tràn xuống dòng dưới
            nt = nxt['t'].strip()
            if (not nt or cw(nxt) / base <= CH_R or nxt['y'] > l['y'] + 0.08
                    or not any(c.isalpha() for c in nt)):   # số chương kế bên
                break
            title = title[:-1] + nt if title.endswith('-') else f'{title} {nt}'
        return ' '.join(title.split())
    return None


def classify(line, base, right_edge):
    """Trả về (kiểu, có_phải_dòng_cuối_đoạn)."""
    t = line['t'].strip()
    r = cw(line) / base if base else 1.0
    n = len(t)
    # Dòng kết thúc sớm hơn lề phải => hết đoạn. Đây là dấu hiệu đáng tin nhất
    # cho văn bản canh đều hai bên.
    ends_para = (line['x'] + line['w']) < right_edge - 0.045

    if re.match(r'^Figure\s+\d', t):
        return 'figure', True
    if t[:1] in BULLETS and n > 3:
        return 'li', ends_para
    if line['x'] < COL_MAX:          # tiêu đề luôn nằm trong cột thân bài
        if r > H2 and n >= H2_MIN:
            return 'h2', True
        if r > H3 and n >= H3_MIN:
            return 'h3', True
    return 'p', ends_para


def page_blocks(page, base, right_edge):
    """Một trang -> danh sách (kiểu, đã_hết_đoạn, text)."""
    lines = [l for l in page['lines'] if len(l['t'].strip()) > 1]
    if not lines:
        return []
    lines.sort(key=lambda l: (round(l['y'], 3), l['x']))

    out = []
    title = chapter_title(lines, base)
    if title:
        out.append(('h1', True, fix_ocr(title), 0.0))

    for l in lines:
        t = l['t'].strip()
        # Đầu trang/chân trang chạy: sát mép trên/dưới và trông như số trang
        # hoặc tên chương lặp lại.
        if (re.fullmatch(r'[|Il]?\s*\d{1,3}\s*[|Il]?', t)
                or re.match(r'^\d+\s*[|Il]\s*Chapter\b', t)
                or re.match(r'^Chapter\s+\d+\.', t)):
            continue
        r = cw(l) / base
        if r < NOISE:                       # nhãn nhỏ trong sơ đồ
            continue
        if title and r > CH_R:              # chính tiêu đề chương, đã thêm ở trên
            continue
        # Chữ cỡ lớn nằm ngoài cột thân bài = nhãn trong hình vẽ, không phải nội dung
        if r > H2 and l['x'] > COL_MAX and not t.startswith('Figure'):
            continue
        kind, ends = classify(l, base, right_edge)
        out.append((kind, ends, fix_ocr(t), l['x']))
    return out


# Sách này theo lối hỏi–đáp: mỗi lượt thoại luôn mở đầu một block mới, kể cả khi
# dòng trước chạy sát lề phải.
SPEAKER = re.compile(r'^(Candidate|Interviewer)\s*:')


def merge(items):
    """Nối các dòng thành block. items = [(kiểu, hết_đoạn, text, x)]."""
    out = []
    for kind, ends, text, x in items:
        prev = out[-1] if out else None
        # Dòng thân bài thụt vào sâu hơn gạch đầu dòng đang mở = phần nối tiếp của nó
        cont_li = (prev and prev['t'] == 'li' and kind == 'p'
                   and not prev['done'] and x > prev['x'] + 0.005)
        joinable = (prev and not prev['done'] and not SPEAKER.match(text)
                    and (cont_li or (prev['t'] == kind and kind in ('p', 'li'))))
        if joinable:
            a = prev['en']
            if a.endswith('-') and text[:1].islower():
                prev['en'] = a[:-1] + text          # nối từ bị ngắt dòng
            else:
                prev['en'] = a + ' ' + text
            prev['done'] = ends
        else:
            if kind == 'li':
                text = text.lstrip(''.join(BULLETS)).strip()
            out.append({'t': kind, 'en': text, 'done': ends, 'x': x})
    return out


# Sách có nhiều bảng (API, schema). Vision xuất mỗi Ô thành một dòng riêng, nên
# chúng lọt ra thành hàng loạt block 1–2 chữ. Gộp những mảnh ngắn liền nhau lại
# thành một block cho khớp cách các quyển khác hiển thị bảng.
FRAG_MAX = 30


def collapse_fragments(blocks):
    out, run = [], []

    def flush():
        if not run:
            return
        if len(run) >= 3:                       # đúng là một bảng bị vỡ vụn
            out.append({'t': 'p', 'en': ' · '.join(b['en'] for b in run)})
        else:
            out.extend(run)
        run.clear()

    for b in blocks:
        if b['t'] in ('p', 'li') and len(b['en']) <= FRAG_MAX:
            run.append(b)
        else:
            flush()
            out.append(b)
    flush()
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('jsonl')
    ap.add_argument('out_dir')
    ap.add_argument('--book', required=True)
    ap.add_argument('--start', type=int, default=1, help='bỏ qua bìa/mục lục')
    args = ap.parse_args()

    pages = [p for p in load_pages(args.jsonl) if p['page'] >= args.start]

    # Cỡ chữ thân bài = trung vị cw của những dòng đủ dài để cw đáng tin.
    longs = [cw(l) for p in pages for l in p['lines'] if len(l['t'].strip()) >= 50]
    base = statistics.median(longs)
    edges = [l['x'] + l['w'] for p in pages for l in p['lines']
             if len(l['t'].strip()) >= 50]
    right_edge = statistics.median(edges)
    print(f'cỡ chữ thân bài (cw)={base * 1000:.2f}  lề phải={right_edge:.3f}')

    items = []
    for p in pages:
        items.extend(page_blocks(p, base, right_edge))
    blocks = collapse_fragments(merge(items))
    blocks = [b for b in blocks if len(b['en'].strip()) >= 3]

    # Cắt chương tại mỗi h1
    chapters, cur = [], None
    for b in blocks:
        if b['t'] == 'h1':
            cur = {'title': b['en'], 'blocks': []}
            chapters.append(cur)
        elif cur is not None:
            cur['blocks'].append(b)

    out = Path(args.out_dir) / args.book
    out.mkdir(parents=True, exist_ok=True)
    index = []
    for i, ch in enumerate(chapters, 1):
        bl = [{'t': b['t'], 'k': key_of(b['en']), 'en': b['en']}
              for b in ch['blocks'] if b['en'].strip()]
        if len(bl) < 3:
            continue
        num = f'{i:02d}'
        cid = f'{num}-{slug(ch["title"])}'
        doc = {'id': cid, 'title': ch['title'], 'titleKey': key_of(ch['title']),
               'book': args.book, 'blocks': bl}
        (out / f'{cid}.json').write_text(
            json.dumps(doc, ensure_ascii=False, indent=1))
        chars = sum(len(b['en']) for b in bl)
        index.append({'id': cid, 'num': num, 'title': ch['title'],
                      'chars': chars, 'blocks': len(bl)})
        print(f'  {cid}: {len(bl)} block, {chars} ký tự')

    (out / '_index.json').write_text(
        json.dumps(index, ensure_ascii=False, indent=1))
    print(f'\n{len(index)} chương, {sum(c["blocks"] for c in index)} block, '
          f'{sum(c["chars"] for c in index)} ký tự')


if __name__ == '__main__':
    main()
