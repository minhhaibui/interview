#!/usr/bin/env python3
"""
Trích ebook PDF ra corpus tiếng Anh NGUỒN của tab "Ebook".

    PDF gốc (ngoài repo) --> study-web/data/ebooks-en/<sách>/<chương>.json

Chạy TAY, chỉ khi đổi bộ trích xuất hoặc thêm sách — kết quả được commit vào
repo vì máy build của GitHub Actions không có file PDF. Bước ghép với bản dịch
tiếng Việt (data/ebooks-vi/) nằm ở build.js, chạy mỗi lần deploy.

Bản dịch được lưu theo KHOÁ BĂM của câu tiếng Anh chứ không theo số thứ tự — để
chạy lại bộ trích xuất không làm lệch những gì đã dịch.

    python3 tools/build_ebooks.py
"""
import hashlib
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from extract_pdf import PROFILES, SCRUBS, build_blocks, clean, group_lines, runs_of_page, strip_running  # noqa: E402
from pypdf import PdfReader  # noqa: E402

SRC = Path('/Users/avada/Downloads/ebooks-system-design')
HERE = Path(__file__).resolve().parent.parent
OUT = HERE / 'data' / 'ebooks-en'


def key_of(text):
    """Khoá băm của một câu tiếng Anh — dùng để tra bản dịch."""
    norm = re.sub(r'\s+', ' ', text).strip().lower()
    return hashlib.sha1(norm.encode()).hexdigest()[:12]


def extract(profile, path):
    reader = PdfReader(str(path))
    pages = [group_lines(runs_of_page(p), scrub=SCRUBS.get(profile)) for p in reader.pages]
    blocks = build_blocks(strip_running(pages), PROFILES[profile])
    title = blocks[0]['text'] if blocks and blocks[0]['type'] == 'h1' else path.stem
    return clean(blocks, title)


def slug(text, fallback):
    s = re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')[:60]
    return s or fallback


def split_on(blocks, level, keep=None):
    """Cắt danh sách block thành chương mỗi khi gặp tiêu đề cấp `level`."""
    chapters, cur = [], None
    for b in blocks:
        if b['type'] == level and (keep is None or keep(b['text'])):
            cur = {'title': b['text'], 'blocks': []}
            chapters.append(cur)
            continue
        if cur is None:
            cur = {'title': '', 'blocks': []}
            chapters.append(cur)
        cur['blocks'].append(b)
    return chapters


def chars(ch):
    return sum(len(b['text']) for b in ch['blocks'])


# ------------------------------------------------------------------ nguồn sách
def book_grokking():
    chapters = []
    folder = SRC / 'Grokking-Modern-System-Design-Interview-for-Engineers-Managers'
    for path in sorted(folder.glob('*.pdf')):
        num = path.stem.split('-')[0]
        if num == '000':      # mục lục — tab tự sinh mục lục riêng
            continue
        # Mỗi PDF là một chương; tên chương lấy từ tên file (đúng mục lục sách),
        # không lấy h1 đầu tiên — h1 đó là tên BÀI HỌC đầu chương.
        title = path.stem.split('-', 1)[1].replace('_', '/').replace('  ', ' ').strip()
        chapters.append({
            'id': f'{num}-{slug(title, num)}',
            'num': num,
            'title': title,
            'blocks': extract('grokking', path),
        })
    return {
        'id': 'grokking',
        'title': 'Grokking Modern System Design Interview',
        'titleVi': 'Thiết kế hệ thống hiện đại cho phỏng vấn',
        'author': 'educative.io',
        'note': '41 chương: nền tảng → 20 building block → 15 bài thiết kế thực tế.',
        'chapters': chapters,
    }


def book_alex_vol1():
    blocks = extract('alex', SRC / 'design.interview.alex' / 'System Design Interview VOL 1 BUY.pdf')
    is_chapter = re.compile(r'^(CHAPTER\s+\d+|FORWARD)', re.I)
    parts = split_on(blocks, 'h1', keep=lambda t: bool(is_chapter.match(t)))
    chapters = []
    for i, ch in enumerate(parts):
        if chars(ch) < 400:
            continue
        title = ch['title'] or 'Mở đầu'
        chapters.append({
            'id': f'{i:02d}-{slug(title, str(i))}',
            'num': f'{i:02d}',
            'title': title,
            'blocks': ch['blocks'],
        })
    return {
        'id': 'alex-vol1',
        'title': "System Design Interview – An Insider's Guide (Vol 1)",
        'titleVi': 'Phỏng vấn thiết kế hệ thống – Cẩm nang người trong nghề (Tập 1)',
        'author': 'Alex Xu',
        'note': '16 chương kinh điển: từ scale 0 → hàng triệu user tới 13 bài thiết kế.',
        'chapters': chapters,
    }


def book_alex_vol0():
    blocks = extract('alex', SRC / 'design.interview.alex' / 'System Design Interview VOL 0 FREE.pdf')
    parts = split_on(blocks, 'h2')
    chapters = []
    for i, ch in enumerate(parts):
        if chars(ch) < 300 or not ch['title']:
            continue
        n = f'{len(chapters) + 1:02d}'
        chapters.append({
            'id': f'{n}-{slug(ch["title"], n)}',
            'num': n,
            'title': ch['title'],
            'blocks': ch['blocks'],
        })
    return {
        'id': 'alex-vol0',
        'title': 'System Design Interview – Vol 0 (ByteByteGo tuyển tập)',
        'titleVi': 'Phỏng vấn thiết kế hệ thống – Tập 0 (tuyển tập chủ đề ngắn)',
        'author': 'Alex Xu',
        'note': 'Hơn 70 chủ đề ngắn: HTTPS, SSO, Kafka, cache, unique ID, khoá lạc quan…',
        'chapters': chapters,
    }


def book_labs():
    blocks = extract('labs', SRC / 'System-design-labs' / 'system-design-questions.pdf')
    skip = {'60 days of', 'system design', 'questions', 'contents', 'system\xa0design'}
    parts = split_on(blocks, 'h1', keep=lambda t: t.strip().lower() not in skip)
    chapters = []
    for ch in parts:
        if chars(ch) < 500 or not ch['title']:
            continue
        n = f'{len(chapters) + 1:02d}'
        chapters.append({
            'id': f'{n}-{slug(ch["title"], n)}',
            'num': n,
            'title': ch['title'],
            'blocks': ch['blocks'],
        })
    return {
        'id': 'labs',
        'title': '60 Days of System Design Questions',
        'titleVi': '60 ngày câu hỏi thiết kế hệ thống',
        'author': 'Joud Awad',
        'note': 'Mỗi ngày một tình huống, bốn phương án, kèm phân tích vì sao ba cái kia sai.',
        'chapters': chapters,
    }


BOOKS = [book_grokking, book_alex_vol1, book_alex_vol0, book_labs]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    index = {'books': []}
    grand_en = grand_blocks = 0
    for make in BOOKS:
        book = make()
        bdir = OUT / book['id']
        bdir.mkdir(parents=True, exist_ok=True)
        meta_chapters = []
        for ch in book['chapters']:
            out_blocks = []
            for b in ch['blocks']:
                item = {'t': b['type'], 'k': key_of(b['text']), 'en': b['text']}
                if b.get('lead'):
                    item['lead'] = b['lead']
                out_blocks.append(item)
            n_en = sum(len(b['en']) for b in out_blocks)
            (bdir / f'{ch["id"]}.json').write_text(json.dumps(
                {'id': ch['id'], 'title': ch['title'], 'titleKey': key_of(ch['title']),
                 'book': book['id'], 'blocks': out_blocks}, ensure_ascii=False, indent=1))
            meta_chapters.append({'id': ch['id'], 'num': ch['num'], 'title': ch['title'],
                                  'chars': n_en, 'blocks': len(out_blocks)})
            grand_en += n_en
            grand_blocks += len(out_blocks)
        index['books'].append({
            'id': book['id'], 'title': book['title'], 'titleVi': book['titleVi'],
            'author': book['author'], 'note': book['note'], 'chapters': meta_chapters,
        })
        print(f'  ✓ {book["id"]:12} {len(meta_chapters):3d} chương · '
              f'{sum(c["chars"] for c in meta_chapters):8,d} ký tự EN')
    (OUT / 'index.json').write_text(json.dumps(index, ensure_ascii=False, indent=1))
    print(f'  → {grand_en:,} ký tự EN · {grand_blocks:,} block · nguồn ở data/ebooks-en/')


if __name__ == '__main__':
    main()
