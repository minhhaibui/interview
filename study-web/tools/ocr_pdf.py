#!/usr/bin/env python3
"""OCR một PDF scan bằng Vision framework của macOS (qua PyObjC).

Xuất JSONL: mỗi dòng là một trang {"page": n, "lines": [{t,x,y,w,h,c}, ...]}.
Toạ độ chuẩn hoá 0..1, y tính từ TRÊN xuống. Chiều cao h thay cho cỡ chữ — bản scan
không có font info, nên tools/ocr_blocks.py dùng h để dựng lại tiêu đề/thân bài.

    python3 ocr_pdf.py in.pdf out.jsonl [từ] [đến]
"""
import json
import sys

import Quartz
import Vision
from Foundation import NSURL

SCALE = 2.0  # đủ cho chữ sách; cao hơn chỉ chậm thêm mà không rõ hơn


def render(page):
    """Render một trang PDF thành CGImage."""
    box = Quartz.CGPDFPageGetBoxRect(page, Quartz.kCGPDFMediaBox)
    w, h = int(box.size.width * SCALE), int(box.size.height * SCALE)
    if w <= 0 or h <= 0:
        return None
    space = Quartz.CGColorSpaceCreateDeviceRGB()
    ctx = Quartz.CGBitmapContextCreate(
        None, w, h, 8, 0, space, Quartz.kCGImageAlphaNoneSkipLast)
    Quartz.CGContextSetRGBFillColor(ctx, 1, 1, 1, 1)
    Quartz.CGContextFillRect(ctx, Quartz.CGRectMake(0, 0, w, h))
    Quartz.CGContextScaleCTM(ctx, SCALE, SCALE)
    Quartz.CGContextTranslateCTM(ctx, -box.origin.x, -box.origin.y)
    Quartz.CGContextDrawPDFPage(ctx, page)
    return Quartz.CGBitmapContextCreateImage(ctx)


def ocr(img):
    """Chạy Vision OCR, trả về danh sách dòng đã chuẩn hoá toạ độ."""
    req = Vision.VNRecognizeTextRequest.alloc().init()
    req.setRecognitionLevel_(Vision.VNRequestTextRecognitionLevelAccurate)
    req.setUsesLanguageCorrection_(True)
    req.setRecognitionLanguages_(["en-US"])
    handler = Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(img, None)
    ok, err = handler.performRequests_error_([req], None)
    if not ok:
        raise RuntimeError(f"Vision lỗi: {err}")
    out = []
    for obs in (req.results() or []):
        cands = obs.topCandidates_(1)
        if not cands:
            continue
        top = cands[0]
        b = obs.boundingBox()  # gốc toạ độ ở GÓC DƯỚI-TRÁI, đã chuẩn hoá
        out.append({
            't': top.string(),
            'x': round(b.origin.x, 5),
            'y': round(1.0 - b.origin.y - b.size.height, 5),  # đổi sang y-từ-trên
            'w': round(b.size.width, 5),
            'h': round(b.size.height, 5),
            'c': round(top.confidence(), 3),
        })
    return out


def main():
    pdf_path, out_path = sys.argv[1], sys.argv[2]
    doc = Quartz.CGPDFDocumentCreateWithURL(
        NSURL.fileURLWithPath_(pdf_path))
    if doc is None:
        sys.exit('không mở được PDF')
    total = Quartz.CGPDFDocumentGetNumberOfPages(doc)
    lo = int(sys.argv[3]) if len(sys.argv) > 3 else 1
    hi = min(int(sys.argv[4]), total) if len(sys.argv) > 4 else total

    with open(out_path, 'w') as f:
        for i in range(lo, hi + 1):  # CGPDFDocument đánh số trang từ 1
            page = Quartz.CGPDFDocumentGetPage(doc, i)
            lines = []
            if page is not None:
                img = render(page)
                if img is not None:
                    try:
                        lines = ocr(img)
                    except Exception as e:  # một trang hỏng không được giết cả lượt chạy
                        print(f'trang {i} lỗi: {e}', file=sys.stderr)
            f.write(json.dumps({'page': i, 'lines': lines}, ensure_ascii=False) + '\n')
            f.flush()
            if i % 10 == 0 or i == hi:
                print(f'... {i}/{hi}', file=sys.stderr, flush=True)


if __name__ == '__main__':
    main()
