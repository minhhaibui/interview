#!/usr/bin/env python3
"""
Trích nội dung ebook PDF -> JSON block có cấu trúc (heading / đoạn / bullet / code / hình).

Dùng font + cỡ chữ để phân loại, vì text thuần của PDF không phân biệt được
tiêu đề với đoạn văn. Mỗi ebook có một "profile" font riêng.

    python3 tools/extract_pdf.py <profile> <file.pdf> > out.json
"""
import json
import math
import re
import sys
from collections import defaultdict

from pypdf import PdfReader

# Rác giao diện của educative.io lẫn vào mọi trang PDF.
CHROME = {
    'back', 'next', 'mark as completed', 'mark as completed next',
    'report an issue', 'ask a question', 'completed', 'previous',
}
CHROME_RE = re.compile(
    r'^(back)?\s*mark as completed\s*(next)?$'
    r'|^(back|next|hide|show|hint|solution|completed|previous)$'
    r'|^\d+\s*/\s*\d+$'
    r'|^(try it yourself|drag and drop|click to (see|view))', re.I)
# Nút của educative.io bị trích lẫn vào GIỮA câu, phải cắt theo chuỗi con.
UI_PHRASES = ('Ask a Question', 'Report an Issue', 'Mark As Completed')
# Nhãn nhỏ nhưng có nghĩa — giữ lại làm tiêu đề phụ thay vì coi là rác giao diện.
KEEP_SMALL = {"we'll cover the following", 'we will cover the following'}


def mul(m1, m2):
    """Nhân hai ma trận affine 3x2 của PDF ([a b c d e f])."""
    a1, b1, c1, d1, e1, f1 = m1
    a2, b2, c2, d2, e2, f2 = m2
    return [a1 * a2 + b1 * c2, a1 * b2 + b1 * d2,
            c1 * a2 + d1 * c2, c1 * b2 + d1 * d2,
            e1 * a2 + f1 * c2 + e2, e1 * b2 + f1 * d2 + f2]


def runs_of_page(page):
    """Trả về các đoạn chữ kèm toạ độ + font: (y, x, font, size, text).

    Phải nhân tm với cm mới ra toạ độ/cỡ chữ thật: mỗi PDF trong bộ sách dùng
    một hệ toạ độ khác nhau (có file lật trục y, có file để cỡ chữ trong cm).
    """
    out = []

    def visit(text, cm, tm, font_dict, font_size):
        if not text or not text.strip('\n'):
            return
        base = (font_dict or {}).get('/BaseFont', '') or ''
        base = str(base).split('+')[-1]
        m = mul(list(tm), list(cm))
        scale = math.hypot(m[2], m[3]) or 1.0
        size = round((font_size or 1.0) * scale, 1)
        out.append((round(m[5], 1), round(m[4], 1), base, size, text))

    page.extract_text(visitor_text=visit)
    return out


def group_lines(runs, descending=True, scrub=None):
    """Gộp các run cùng dòng (cùng toạ độ y) lại, giữ thứ tự trái→phải."""
    buckets = defaultdict(list)
    for y, x, font, size, text in runs:
        buckets[y].append((x, font, size, text))
    # Gom các baseline lệch nhau < 3 đơn vị về cùng một dòng (bullet lệch so với chữ).
    merged, keys = {}, sorted(buckets, reverse=True)
    anchor = None
    for y in keys:
        if anchor is None or abs(anchor - y) > 3.0:
            anchor = y
            merged[anchor] = []
        merged[anchor].extend(buckets[y])
    buckets = merged
    lines = []
    for y in sorted(buckets, reverse=descending):
        parts = sorted(buckets[y], key=lambda r: r[0])
        text = ''.join(p[3] for p in parts)
        text = re.sub(r'[ \t]+', ' ', text).strip()
        if not text:
            continue
        # Font/cỡ chữ đại diện của dòng = font chiếm nhiều ký tự nhất.
        weight = defaultdict(int)
        for _, font, size, t in parts:
            weight[(font, size)] += len(t.strip())
        font, size = max(weight.items(), key=lambda kv: kv[1])[0]
        # Tiêu đề chạy của trang có khi nằm ĐÚNG baseline một dòng thân bài, bị
        # gộp vào giữa câu. Nhận ra nó bằng font (khác họ với thân bài) và cắt.
        if scrub:
            kept = [pt for pt in parts if not scrub(font, pt[1], pt[2])]
            if kept and kept != parts:
                parts = kept
                text = re.sub(r'[ \t]+', ' ', ''.join(p[3] for p in parts)).strip()
                if not text:
                    continue
        bold = any('Bold' in p[1] for p in parts)
        # Đoạn in đậm mở đầu dòng thường là tên khái niệm ("Rate limiter: ...").
        lead = ''
        for _, f, _, t in parts:
            if 'Bold' in f:
                lead += t
            elif lead:
                break
            elif t.strip():
                break
        lines.append({'y': y, 'text': text, 'font': font, 'size': size,
                      'bold': bold, 'lead': re.sub(r'\s+', ' ', lead).strip()})
    return lines


def strip_running(pages):
    """Bỏ tiêu đề chạy / chân trang: cùng một câu lặp lại ở nhiều trang."""
    if len(pages) < 4:
        return [l for p in pages for l in p]
    seen = {}
    for lines in pages:
        for l in lines[:2] + lines[-4:]:
            seen.setdefault(l['text'], set()).add(id(lines))
    repeated = {t for t, ps in seen.items() if len(ps) >= max(3, len(pages) // 3)}
    # Tiêu đề chạy đôi khi nằm CÙNG baseline với chữ thân bài nên bị gộp vào giữa
    # câu ("we cover Introduction to Modern Systemproblems") — phải cắt cả trong dòng.
    inline = sorted((t for t in repeated if len(t) > 12), key=len, reverse=True)
    out = []
    for lines in pages:
        head, tail = lines[:2], lines[-4:]
        for l in lines:
            if l['text'] in repeated and (l in head or l in tail):
                continue
            for junk in inline:
                if junk in l['text']:
                    l['text'] = re.sub(r'\s{2,}', ' ', l['text'].replace(junk, '')).strip()
            for junk in UI_PHRASES:
                l['text'] = l['text'].replace(junk, '')
            if l['text'].strip():
                out.append(l)
    return out


# ---------------------------------------------------------------- profiles
def scrub_grokking(dom_font, run_font, run_size):
    """Trong dòng thân bài (DroidSerif), chữ NunitoSans cỡ nhỏ là tiêu đề chạy."""
    return dom_font.startswith('DroidSerif') and run_font.startswith('NunitoSans') and run_size < 20


SCRUBS = {'grokking': scrub_grokking}


def classify_grokking(line):
    """educative.io: NunitoSans-Bold = tiêu đề, DroidSerif = thân bài, Menlo = code."""
    font, size, text = line['font'], line['size'], line['text']
    if 'Menlo' in font or 'Mono' in font or 'Courier' in font:
        return 'code'
    if font.startswith('NunitoSans-Bold'):
        if size >= 25:
            return 'h1'
        if size >= 21:
            return 'h2'
        if size >= 14:
            return 'h3'
        return 'h3' if text.lower().strip('.: ') in KEEP_SMALL else 'chrome'
    if font.startswith('DroidSerif'):
        return 'body'
    if font.startswith('NunitoSans'):
        # Phụ đề bài học cỡ 12.8; nhỏ hơn là nút/nhãn giao diện.
        return 'body' if size >= 12.5 else 'chrome'
    if 'KaTeX' in font:
        return 'body'
    if 'Helvetica' in font or 'Arial' in font:
        # Chữ nằm trong hình vẽ SVG — gom riêng làm nhãn hình.
        return 'figure'
    if len(text) > 60:
        return 'body'
    return 'chrome'


def classify_alex(line):
    """Sách Alex Xu: cả sách một font, chỉ khác ở chỗ in đậm và cỡ chữ.

    Phải xét font ĐẠI DIỆN của dòng (font chiếm nhiều ký tự nhất), không xét
    'có chữ đậm nào không' — nếu không thì mọi đoạn có in đậm giữa câu đều
    bị nhận nhầm thành tiêu đề.
    """
    font, size = line['font'], line['size']
    if 'Mono' in font or 'Courier' in font or 'Menlo' in font:
        return 'code'
    if 'Bold' in font:
        if size >= 16:
            return 'h1'
        if size >= 13:
            return 'h2'
        if size >= 10.5:
            return 'h3'
    if 'Italic' in font and size >= 8:
        return 'body'
    if size >= 8:
        return 'body'
    return 'chrome'


def classify_labs(line):
    """Workbook 60 ngày: Helvetica-Bold làm tiêu đề, Charter làm thân bài."""
    font, size, text = line['font'], line['size'], line['text']
    if 'Menlo' in font or 'Mono' in font or 'Courier' in font:
        return 'code'
    if 'Lucida' in font:
        return 'chrome'
    if font.startswith('Helvetica'):
        if size >= 20:
            return 'h1'
        if size >= 12:
            return 'h2'
        # Cỡ nhỏ: nhãn "DAY 05 · SYSTEM DESIGN", "Answer 1 CORRECT ANSWER",
        # và chữ cái đánh dấu phương án A/B/C/D.
        return 'chrome' if len(text.strip()) <= 1 else 'h3'
    if font.startswith('Charter'):
        # Chân trang lặp (cỡ 10) và ghi chú thiếu hình (cỡ 9.4) là rác.
        return 'body' if size >= 10.5 else 'chrome'
    return 'body' if size >= 10 else 'chrome'


PROFILES = {'grokking': classify_grokking, 'alex': classify_alex, 'labs': classify_labs}

BULLET_RE = re.compile(r'^\s*([•▪◦●·]|\d+[.)]|[a-z][.)])\s*')
# Dòng kết thúc "lửng" thì câu còn tiếp ở dòng sau -> nối lại thành một đoạn.
ENDS_SENTENCE = re.compile(r'[.!?:;”"’\')\]]$')


def build_blocks(lines, classify):
    blocks = []
    buf = None

    def flush():
        nonlocal buf
        if buf and buf['text'].strip():
            buf['text'] = re.sub(r'\s+', ' ', buf['text']).strip()
            blocks.append(buf)
        buf = None

    for line in lines:
        kind = classify(line)
        text = line['text'].strip()
        low = text.lower().strip('. ')
        if kind == 'chrome' or low in CHROME or CHROME_RE.match(text):
            continue
        if kind == 'figure':
            # Nhãn trong hình rời rạc, gom lại rồi lọc ở bước sau.
            if buf and buf['type'] == 'figure':
                buf['text'] += ' · ' + text
            else:
                flush()
                buf = {'type': 'figure', 'text': text}
            continue
        if kind in ('h1', 'h2', 'h3'):
            flush()
            # Tiêu đề dài bị xuống dòng ("CHAPTER 1: SCALE FROM ZERO TO MILLIONS OF"
            # / "USERS") -> nối lại thành một tiêu đề.
            if blocks and blocks[-1]['type'] == kind and not ENDS_SENTENCE.search(blocks[-1]['text']):
                blocks[-1]['text'] += ' ' + text
                continue
            blocks.append({'type': kind, 'text': text})
            continue
        if kind == 'code':
            if buf and buf['type'] == 'code':
                buf['text'] += '\n' + text
            else:
                flush()
                buf = {'type': 'code', 'text': text}
            continue

        # body
        lead = line.get('lead', '')
        # "Tên khái niệm: giải thích" — sách trình bày như một mục danh sách.
        if lead and len(lead) < 90 and lead.rstrip().endswith(':') and text.startswith(lead[:8]):
            flush()
            buf = {'type': 'li', 'text': text, 'lead': lead.rstrip(': ').strip()}
            continue
        bullet = BULLET_RE.match(text)
        if bullet:
            flush()
            buf = {'type': 'li', 'text': BULLET_RE.sub('', text)}
            continue
        if buf and buf['type'] in ('p', 'li'):
            # Dòng trước chưa hết câu -> cùng một đoạn.
            if buf['text'].endswith('-'):
                buf['text'] += text
                continue
            if not ENDS_SENTENCE.search(buf['text']) or not text[:1].isupper():
                buf['text'] += ' ' + text
                continue
            flush()
        else:
            flush()
        buf = {'type': 'p', 'text': text}
    flush()
    return blocks


# Vài font trong sách nhúng theo bảng mã Mac Roman, pypdf trả về ký tự Latin
# có dấu thay cho dấu nháy/gạch ngang ("YouTubeÕs" thay vì "YouTube’s").
MACROMAN = {'Õ': '’', 'Ô': '‘', 'Ò': '“', 'Ó': '”', 'Ð': '–', 'Ñ': '—', 'É': '…'}


def fix_quotes(text):
    if not any(c in text for c in MACROMAN):
        return text
    return ''.join(MACROMAN.get(c, c) for c in text)


def clean(blocks, title):
    """Bỏ tiêu đề chạy lặp ở chân trang, hình không có chữ nghĩa, đoạn rác."""
    out = []
    seen_h1 = set()
    headings = {b['text'].strip().lower() for b in blocks if b['type'] in ('h2', 'h3')}
    drop_toc = False
    for b in blocks:
        b['text'] = fix_quotes(b['text'])
        if 'lead' in b:
            b['lead'] = fix_quotes(b['lead'])
        t = b['text'].strip()
        if not t:
            continue
        # Hộp "We'll cover the following" chỉ liệt kê lại đúng các tiêu đề bên dưới.
        if b['type'] == 'h3' and t.lower().strip('.: ') in KEEP_SMALL:
            drop_toc = True
            continue
        if drop_toc:
            if b['type'] == 'li':
                continue
            drop_toc = False
        # Ở vài chương, hộp mục lục đó bị trích thành một đoạn dính liền.
        if b['type'] == 'p' and len(t) < 400:
            hit = sum(1 for h in headings if h and len(h) > 8 and h in t.lower())
            if hit >= 2:
                continue
        if b['type'] == 'figure':
            # Chữ trong sơ đồ SVG bị trích ra thành mớ nhãn rời rạc, dính chữ
            # ("Decision-makerThrottles rulecache") — chỉ giữ chú thích thành câu.
            words = len(t.split())
            glued = len(re.findall(r'[a-z][A-Z]', t))
            if words < 5 or len(t) < 30 or ' · ' in t or glued >= 2:
                continue
        if b['type'] == 'h1':
            key = t.lower()
            if key in seen_h1:
                continue
            seen_h1.add(key)
        # Tiêu đề bài học lặp lại ở chân mỗi trang.
        if b['type'] in ('p', 'figure') and t.lower() == title.lower():
            continue
        if b['type'] == 'p' and len(t) < 3:
            continue
        # Đoạn bị hình vẽ / rác giao diện chen ngang giữa chừng: câu trước còn
        # lửng mà câu sau mở đầu bằng chữ thường -> vẫn là một đoạn.
        prev = out[-1] if out else None
        if (prev and prev['type'] in ('p', 'li') and b['type'] == 'p'
                and not ENDS_SENTENCE.search(prev['text']) and t[:1].islower()):
            prev['text'] += ('' if prev['text'].endswith('-') else ' ') + t
            continue
        out.append(b)
    return out


def main():
    profile, path = sys.argv[1], sys.argv[2]
    classify = PROFILES[profile]
    reader = PdfReader(path)
    scrub = SCRUBS.get(profile)
    pages = [group_lines(runs_of_page(page), scrub=scrub) for page in reader.pages]
    lines = strip_running(pages)
    blocks = build_blocks(lines, classify)
    title = blocks[0]['text'] if blocks and blocks[0]['type'] == 'h1' else ''
    blocks = clean(blocks, title)
    json.dump({'title': title, 'blocks': blocks}, sys.stdout, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
