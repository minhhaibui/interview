/**
 * Ngân hàng "🐛 Tìm & Sửa Bug" — đoạn code có MỘT lỗi tinh vi, người học sửa
 * rồi chạy test thật (tái dùng runInSandbox như tab Lập trình).
 *
 * Mỗi câu: { id, title, topic, difficulty, fnName, buggy, fixed, tests, bugHint, explain }
 * Bất biến (file test ép): `fixed` PASS hết test; `buggy` FAIL ít nhất 1 test
 * (chứng minh có bug thật để sửa). buggy = code khởi tạo trong editor.
 */
window.DEBUG_CHALLENGES = [
  {
    id: 'db-sum-offbyone', title: 'Tính tổng mảng', topic: 'Off-by-one', difficulty: 'Dễ', fnName: 'sumArray',
    buggy: `function sumArray(arr) {\n  let s = 0;\n  for (let i = 0; i <= arr.length; i++) {\n    s += arr[i];\n  }\n  return s;\n}`,
    fixed: `function sumArray(arr) {\n  let s = 0;\n  for (let i = 0; i < arr.length; i++) {\n    s += arr[i];\n  }\n  return s;\n}`,
    tests: [{ args: [[1, 2, 3]], expected: 6 }, { args: [[5]], expected: 5 }, { args: [[]], expected: 0 }],
    bugHint: 'Để ý điều kiện dừng của vòng for — chỉ số chạy tới đâu?',
    explain: '`i <= arr.length` đọc cả `arr[arr.length]` = undefined → `s += undefined` ra NaN. Phải là `i < arr.length`.',
  },
  {
    id: 'db-max-neg', title: 'Tìm số lớn nhất', topic: 'Khởi tạo sai', difficulty: 'Dễ', fnName: 'maxOf',
    buggy: `function maxOf(arr) {\n  let m = 0;\n  for (const x of arr) {\n    if (x > m) m = x;\n  }\n  return m;\n}`,
    fixed: `function maxOf(arr) {\n  let m = arr[0];\n  for (const x of arr) {\n    if (x > m) m = x;\n  }\n  return m;\n}`,
    tests: [{ args: [[-3, -1, -7]], expected: -1 }, { args: [[2, 9, 4]], expected: 9 }, { args: [[-5]], expected: -5 }],
    bugHint: 'Thử mảng toàn số âm xem kết quả có hợp lý không.',
    explain: 'Khởi tạo `m = 0` sai khi mọi phần tử đều âm (trả về 0 — vốn không có trong mảng). Khởi tạo bằng phần tử đầu `arr[0]`.',
  },
  {
    id: 'db-missing-return', title: 'Nhân đôi từng phần tử', topic: 'Thiếu return', difficulty: 'Dễ', fnName: 'doubleAll',
    buggy: `function doubleAll(arr) {\n  return arr.map(x => { x * 2; });\n}`,
    fixed: `function doubleAll(arr) {\n  return arr.map(x => x * 2);\n}`,
    tests: [{ args: [[1, 2, 3]], expected: [2, 4, 6] }, { args: [[0, -1]], expected: [0, -2] }],
    bugHint: 'Arrow function có dấu ngoặc nhọn `{}` thì thân hàm hoạt động khác arrow rút gọn.',
    explain: 'Arrow `x => { x * 2; }` có block body nhưng KHÔNG `return` → map ra toàn `undefined`. Bỏ ngoặc nhọn (`x => x * 2`) hoặc thêm `return`.',
  },
  {
    id: 'db-eq-coerce', title: 'Đếm phần tử bằng target', topic: '== vs ===', difficulty: 'TB', fnName: 'countTarget',
    buggy: `function countTarget(arr, t) {\n  let c = 0;\n  for (const x of arr) {\n    if (x == t) c++;\n  }\n  return c;\n}`,
    fixed: `function countTarget(arr, t) {\n  let c = 0;\n  for (const x of arr) {\n    if (x === t) c++;\n  }\n  return c;\n}`,
    tests: [{ args: [[1, '1', 2, 1], 1], expected: 2 }, { args: [[0, false, ''], 0], expected: 1 }],
    bugHint: 'So sánh `==` có ép kiểu. Mảng có lẫn số và chuỗi/boolean trông giống nhau.',
    explain: '`==` ép kiểu nên `"1" == 1` và `false == 0` đều true → đếm dư. Dùng `===` để so cả kiểu.',
  },
  {
    id: 'db-avg-trunc', title: 'Tính trung bình', topic: 'Toán tử bitwise', difficulty: 'TB', fnName: 'average',
    buggy: `function average(arr) {\n  let s = 0;\n  for (const x of arr) s += x;\n  return s / arr.length | 0;\n}`,
    fixed: `function average(arr) {\n  let s = 0;\n  for (const x of arr) s += x;\n  return s / arr.length;\n}`,
    tests: [{ args: [[1, 2]], expected: 1.5 }, { args: [[2, 3, 4]], expected: 3 }],
    bugHint: 'Kết quả nên có phần thập phân. Toán tử `| 0` làm gì với số thực?',
    explain: '`s / arr.length | 0` = `(s/arr.length) | 0` — phép `| 0` cắt phần thập phân (1.5 → 1). Bỏ `| 0` đi.',
  },
  {
    id: 'db-filter-cond', title: 'Lọc số chẵn', topic: 'Đảo điều kiện', difficulty: 'Dễ', fnName: 'evens',
    buggy: `function evens(arr) {\n  return arr.filter(x => x % 2);\n}`,
    fixed: `function evens(arr) {\n  return arr.filter(x => x % 2 === 0);\n}`,
    tests: [{ args: [[1, 2, 3, 4]], expected: [2, 4] }, { args: [[5, 7]], expected: [] }],
    bugHint: '`x % 2` cho ra giá trị nào với số chẵn, số lẻ? Giá trị đó truthy hay falsy?',
    explain: '`x % 2` bằng 1 (truthy) với số LẺ, bằng 0 (falsy) với số chẵn → filter giữ số lẻ. Phải là `x % 2 === 0`.',
  },
  {
    id: 'db-sum-strings', title: 'Cộng các chuỗi số', topic: 'Ép kiểu chuỗi', difficulty: 'TB', fnName: 'sumStrings',
    buggy: `function sumStrings(arr) {\n  let s = 0;\n  for (const x of arr) s += x;\n  return s;\n}`,
    fixed: `function sumStrings(arr) {\n  let s = 0;\n  for (const x of arr) s += Number(x);\n  return s;\n}`,
    tests: [{ args: [['1', '2', '3']], expected: 6 }, { args: [['10', '5']], expected: 15 }],
    bugHint: 'Phần tử mảng là chuỗi. `0 + "1"` ra gì?',
    explain: '`s` là số nhưng `x` là chuỗi → `+` nối chuỗi: 0+"1"="01"+"2"="012"... Phải ép số: `Number(x)` (hoặc `+x`).',
  },
  {
    id: 'db-indexof-zero', title: 'Kiểm tra phần tử tồn tại', topic: 'indexOf 0 falsy', difficulty: 'TB', fnName: 'has',
    buggy: `function has(arr, t) {\n  return arr.indexOf(t) ? true : false;\n}`,
    fixed: `function has(arr, t) {\n  return arr.indexOf(t) >= 0;\n}`,
    tests: [{ args: [[5, 6, 7], 5], expected: true }, { args: [[5, 6, 7], 9], expected: false }],
    bugHint: 'Phần tử nằm ở vị trí ĐẦU tiên thì indexOf trả về gì? Giá trị đó truthy không?',
    explain: '`indexOf` trả về 0 khi phần tử ở đầu → 0 là falsy → trả về false sai. So sánh `>= 0` (hoặc dùng `includes`).',
  },
  {
    id: 'db-factorial-base', title: 'Giai thừa (đệ quy)', topic: 'Base case sai', difficulty: 'TB', fnName: 'factorial',
    buggy: `function factorial(n) {\n  if (n === 0) return 0;\n  return n * factorial(n - 1);\n}`,
    fixed: `function factorial(n) {\n  if (n === 0) return 1;\n  return n * factorial(n - 1);\n}`,
    tests: [{ args: [5], expected: 120 }, { args: [0], expected: 1 }, { args: [3], expected: 6 }],
    bugHint: 'Trường hợp cơ sở trả về giá trị nào thì cả tích nhân lên mới đúng?',
    explain: '`0! = 1`, không phải 0. Base case trả về 0 làm toàn bộ tích = 0. Sửa thành `return 1`.',
  },
  {
    id: 'db-reverse-str', title: 'Đảo ngược chuỗi', topic: 'Logic vòng lặp', difficulty: 'Dễ', fnName: 'reverse',
    buggy: `function reverse(s) {\n  let r = '';\n  for (let i = 0; i < s.length; i++) {\n    r = r + s[i];\n  }\n  return r;\n}`,
    fixed: `function reverse(s) {\n  let r = '';\n  for (let i = 0; i < s.length; i++) {\n    r = s[i] + r;\n  }\n  return r;\n}`,
    tests: [{ args: ['abc'], expected: 'cba' }, { args: ['hello'], expected: 'olleh' }],
    bugHint: 'Ghép ký tự mới vào ĐẦU hay CUỐI chuỗi kết quả?',
    explain: '`r = r + s[i]` ghép vào cuối → giữ nguyên thứ tự. Đảo ngược thì ghép ký tự mới vào ĐẦU: `r = s[i] + r`.',
  },
  {
    id: 'db-count-vowels', title: 'Đếm nguyên âm', topic: 'Bỏ sót hoa/thường', difficulty: 'TB', fnName: 'countVowels',
    buggy: `function countVowels(s) {\n  let c = 0;\n  for (const ch of s) {\n    if ('aeiou'.includes(ch)) c++;\n  }\n  return c;\n}`,
    fixed: `function countVowels(s) {\n  let c = 0;\n  for (const ch of s) {\n    if ('aeiou'.includes(ch.toLowerCase())) c++;\n  }\n  return c;\n}`,
    tests: [{ args: ['Apple'], expected: 2 }, { args: ['AEIOU'], expected: 5 }, { args: ['xyz'], expected: 0 }],
    bugHint: 'Thử chuỗi có nguyên âm VIẾT HOA.',
    explain: '`"aeiou".includes(ch)` chỉ khớp nguyên âm thường → bỏ sót A, E, I, O, U hoa. Chuẩn hóa `ch.toLowerCase()` trước khi kiểm.',
  },
];
