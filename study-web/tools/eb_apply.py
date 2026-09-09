#!/usr/bin/env python3
"""Nhận bản dịch tiếng Việt theo số thứ tự (stdin) và ghi ra data/ebooks-vi/.

Mỗi dòng: "<số>\t<bản dịch>". Số 0 là tiêu đề chương, 1..N là các block theo
đúng thứ tự eb_dump.py in ra. Bản dịch được lưu theo KHOÁ BĂM nội dung gốc nên
trích lại PDF cũng không lệch.

    python3 tools/eb_apply.py grokking 019-... < ban-dich.txt
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EN = ROOT / 'data' / 'ebooks-en'
VI = ROOT / 'data' / 'ebooks-vi'


def main():
    book, chapter = sys.argv[1], sys.argv[2]
    ch = json.loads((EN / book / f'{chapter}.json').read_text())
    keys = [ch['titleKey']] + [b['k'] for b in ch['blocks']]

    out_file = VI / book / f'{chapter}.json'
    out = json.loads(out_file.read_text()) if out_file.exists() else {}
    bad, wrote = [], 0
    for line in sys.stdin:
        line = line.rstrip('\n')
        if not line.strip():
            continue
        num, _, text = line.partition('\t')
        if not num.strip().isdigit() or not text.strip():
            bad.append(line[:60])
            continue
        i = int(num)
        if i >= len(keys):
            bad.append(f'số {i} vượt quá {len(keys) - 1} block')
            continue
        out[keys[i]] = text.strip()
        wrote += 1

    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text(json.dumps(out, ensure_ascii=False, indent=1))
    missing = [i for i, k in enumerate(keys) if k not in out]
    print(f'{book}/{chapter}: ghi {wrote} dòng · tổng {len(out)}/{len(keys)}'
          + (f' · CÒN THIẾU {len(missing)}: {missing[:12]}' if missing else ' · ĐỦ ✓'))
    for b in bad:
        print('  ✗ dòng hỏng:', b)


if __name__ == '__main__':
    main()
