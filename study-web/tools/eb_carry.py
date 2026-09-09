#!/usr/bin/env python3
"""Chuyển bản dịch sang những block TRÙNG NỘI DUNG ở chương khác.

Vài PDF trong bộ Grokking chồng lấn nhau (bản xuất PDF của educative kèm luôn
mấy trang của chương sau), nhưng cách tách đoạn lệch chút xíu nên khoá băm khác
nhau. Công cụ này khớp theo độ tương đồng văn bản để khỏi phải dịch lại.

    python3 tools/eb_carry.py <sách> <chương-đích>

CHỈ chuyển khi câu tiếng Anh TRÙNG Y NGUYÊN (sau khi chuẩn hoá hoa/thường và
dấu câu). Khớp gần đúng đã bị bỏ vì nó dịch sai con số.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EN = ROOT / 'data' / 'ebooks-en'
VI = ROOT / 'data' / 'ebooks-vi'

norm = lambda s: re.sub(r'[^a-z0-9 ]+', '', re.sub(r'\s+', ' ', s.lower())).strip()


def main():
    book, chapter = sys.argv[1], sys.argv[2]

    # Gom mọi câu tiếng Anh ĐÃ có bản dịch trong cùng bộ sách.
    pool = {}
    for en_file in sorted((EN / book).glob('*.json')):
        vi_file = VI / book / en_file.name
        if not vi_file.exists():
            continue
        vi = json.loads(vi_file.read_text())
        data = json.loads(en_file.read_text())
        for b in data['blocks']:
            if b['k'] in vi:
                pool.setdefault(norm(b['en']), vi[b['k']])

    data = json.loads((EN / book / f'{chapter}.json').read_text())
    out_file = VI / book / f'{chapter}.json'
    out = json.loads(out_file.read_text()) if out_file.exists() else {}
    keys = [(data['titleKey'], data['title'])] + [(b['k'], b['en']) for b in data['blocks']]

    exact = fuzzy = 0
    for k, en in keys:
        if k in out:
            continue
        n = norm(en)
        if n in pool:
            out[k] = pool[n]
            exact += 1
            continue
        # CỐ Ý KHÔNG khớp mờ: đã thử và nó dịch sai số liệu — "100 million
        # Daily Active Users" khớp nhầm sang câu "500 triệu…" chỉ vì hai câu
        # giống nhau 93%. Với tài liệu kỹ thuật, chỉ khớp y nguyên mới an toàn.

    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text(json.dumps(out, ensure_ascii=False, indent=1))
    missing = [i for i, (k, _) in enumerate(keys) if k not in out]
    print(f'{book}/{chapter}: khớp chính xác {exact}, khớp mờ {fuzzy} · '
          f'còn thiếu {len(missing)}/{len(keys)}')
    if missing:
        print('  thiếu:', missing[:40])


if __name__ == '__main__':
    main()
