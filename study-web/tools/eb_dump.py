#!/usr/bin/env python3
"""In một chương ebook ra dạng "số thứ tự <TAB> câu tiếng Anh" để dịch.

Dòng 0 là tiêu đề chương. Dùng cặp với tools/eb_apply.py.

    python3 tools/eb_dump.py grokking 019-rate-limiter        # cả chương
    python3 tools/eb_dump.py grokking 019-rate-limiter 1 160   # chỉ block 1..160
    python3 tools/eb_dump.py --todo                            # chương chưa dịch xong
"""
import json
import sys
from pathlib import Path

EN = Path(__file__).resolve().parent.parent / 'data' / 'ebooks-en'
VI = Path(__file__).resolve().parent.parent / 'data' / 'ebooks-vi'


def todo():
    index = json.loads((EN / 'index.json').read_text())
    for book in index['books']:
        rows = []
        for ch in book['chapters']:
            f = VI / book['id'] / f'{ch["id"]}.json'
            done = len(json.loads(f.read_text())) if f.exists() else 0
            if done < ch['blocks'] + 1:
                rows.append(f'{ch["chars"]:6d}ch {done:4d}/{ch["blocks"]:4d}  {ch["id"]}')
        print(f'== {book["id"]}  ({len(rows)}/{len(book["chapters"])} chương chưa xong)')
        for r in rows:
            print('   ' + r)


def dump(book, chapter, lo=0, hi=None):
    ch = json.loads((EN / book / f'{chapter}.json').read_text())
    if lo <= 0:
        print(f'0\t{ch["title"]}')
    hi = len(ch['blocks']) if hi is None else hi
    for i, b in enumerate(ch['blocks'], 1):
        if max(lo, 1) <= i <= hi:
            print(f'{i}\t[{b["t"]}] {b["en"]}')


if __name__ == '__main__':
    if sys.argv[1] == '--todo':
        todo()
    else:
        lo = int(sys.argv[3]) if len(sys.argv) > 3 else 0
        hi = int(sys.argv[4]) if len(sys.argv) > 4 else None
        dump(sys.argv[1], sys.argv[2], lo, hi)
