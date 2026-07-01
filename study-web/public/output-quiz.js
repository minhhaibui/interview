/**
 * Ngân hàng "🔍 Đoán Output" — đoán kết quả console.log của snippet JS.
 * Sát phỏng vấn Node.js: event loop, closure, hoisting/TDZ, async/await, this,
 * type coercion, tham chiếu vs giá trị.
 *
 * Mỗi câu: { id, topic, code, options:[chuỗi output], answer:idx, explain }
 * `options[answer]` PHẢI bằng ĐÚNG output thật (mỗi lần console.log là 1 dòng,
 * nhiều tham số nối bằng dấu cách). File test chạy thật từng snippet để kiểm.
 * App KHÔNG eval code — chỉ hiển thị; người dùng chọn đáp án rồi xem giải thích.
 */
window.OUTPUT_QUIZ = [
  {
    id: 'oq-var-loop', topic: 'Closure / var',
    code: `for (var i = 0; i < 3; i++) {\n  setTimeout(() => console.log(i), 0);\n}`,
    options: ['0\n1\n2', '3\n3\n3', '0\n0\n0', '1\n2\n3'], answer: 1,
    explain: '`var` không có block scope — chỉ một biến `i` duy nhất. Khi các callback setTimeout chạy (sau khi vòng lặp kết thúc), `i` đã = 3. Dùng `let` sẽ ra 0 1 2.',
  },
  {
    id: 'oq-let-loop', topic: 'Closure / let',
    code: `for (let i = 0; i < 3; i++) {\n  setTimeout(() => console.log(i), 0);\n}`,
    options: ['3\n3\n3', '0\n1\n2', '0\n0\n0', 'undefined'], answer: 1,
    explain: '`let` tạo binding MỚI cho mỗi vòng lặp → mỗi callback giữ giá trị `i` riêng tại thời điểm đó: 0, 1, 2.',
  },
  {
    id: 'oq-eventloop', topic: 'Event loop',
    code: `console.log('A');\nsetTimeout(() => console.log('B'), 0);\nPromise.resolve().then(() => console.log('C'));\nconsole.log('D');`,
    options: ['A\nB\nC\nD', 'A\nD\nB\nC', 'A\nD\nC\nB', 'A\nC\nD\nB'], answer: 2,
    explain: 'Đồng bộ chạy trước: A, D. Hết đồng bộ → microtask (Promise.then): C. Cuối cùng macrotask (setTimeout): B. → A D C B.',
  },
  {
    id: 'oq-async-order', topic: 'async/await',
    code: `async function f() {\n  console.log(1);\n  await null;\n  console.log(2);\n}\nconsole.log(0);\nf();\nconsole.log(3);`,
    options: ['0\n1\n2\n3', '0\n1\n3\n2', '0\n3\n1\n2', '1\n2\n0\n3'], answer: 1,
    explain: '`f()` chạy đồng bộ tới `await` → in 1. Phần sau `await` thành microtask. Code đồng bộ còn lại in 3. Rồi microtask in 2. → 0 1 3 2.',
  },
  {
    id: 'oq-micro-macro', topic: 'Event loop',
    code: `setTimeout(() => console.log('t'), 0);\nqueueMicrotask(() => console.log('m'));\nconsole.log('s');`,
    options: ['s\nm\nt', 's\nt\nm', 't\nm\ns', 'm\ns\nt'], answer: 0,
    explain: 'Đồng bộ: s. Microtask chạy trước macrotask: m. Cuối là setTimeout (macrotask): t. → s m t.',
  },
  {
    id: 'oq-coerce-1', topic: 'Type coercion',
    code: `console.log(1 + 2 + '3');\nconsole.log('1' + 2 + 3);`,
    options: ['33\n123', '123\n33', '6\n6', '15\n15'], answer: 0,
    explain: '`1 + 2` (số) = 3 rồi `+ "3"` (chuỗi) = "33". Còn `"1" + 2` = "12" rồi `+ 3` = "123". Phép `+` tính trái sang phải.',
  },
  {
    id: 'oq-coerce-2', topic: 'Type coercion',
    code: `console.log('5' - 2);\nconsole.log('5' + 2);\nconsole.log(0.1 + 0.2);`,
    options: ['3\n52\n0.3', '3\n52\n0.30000000000000004', '52\n3\n0.3', '7\n7\n0.3'], answer: 1,
    explain: '`-` ép về số: "5"-2=3. `+` với chuỗi thì nối: "5"+2="52". Số thực nhị phân (IEEE 754): 0.1+0.2 = 0.30000000000000004.',
  },
  {
    id: 'oq-eq-null', topic: 'Equality',
    code: `console.log(null == undefined, null === undefined);`,
    options: ['true true', 'false false', 'true false', 'false true'], answer: 2,
    explain: '`==` coi null và undefined bằng nhau (true). `===` so cả kiểu → khác kiểu nên false.',
  },
  {
    id: 'oq-nan', topic: 'NaN',
    code: `console.log(NaN === NaN, typeof NaN);`,
    options: ['true number', 'false number', 'false NaN', 'true NaN'], answer: 1,
    explain: 'NaN là giá trị duy nhất KHÔNG bằng chính nó (NaN===NaN là false) — dùng Number.isNaN() để kiểm. `typeof NaN` là "number".',
  },
  {
    id: 'oq-hoist', topic: 'Hoisting',
    code: `console.log(typeof foo, typeof bar);\nfunction foo() {}\nvar bar = function () {};`,
    options: ['function function', 'undefined undefined', 'function undefined', 'undefined function'], answer: 2,
    explain: 'Khai báo `function foo(){}` được hoist cả thân → typeof foo = "function". `var bar` chỉ hoist tên (= undefined) tại thời điểm log → typeof bar = "undefined".',
  },
  {
    id: 'oq-closure-counter', topic: 'Closure',
    code: `function counter() {\n  let c = 0;\n  return () => ++c;\n}\nconst f = counter();\nconsole.log(f(), f(), f());`,
    options: ['1 1 1', '1 2 3', '0 1 2', '3 3 3'], answer: 1,
    explain: 'Closure giữ biến `c` riêng cho mỗi lần gọi counter(). `++c` tăng trước rồi trả về: 1, 2, 3. console.log nối bằng dấu cách.',
  },
  {
    id: 'oq-ref', topic: 'Reference vs value',
    code: `const a = [1, 2, 3];\nconst b = a;\nb.push(4);\nconsole.log(a.length, a === b);`,
    options: ['3 false', '4 false', '4 true', '3 true'], answer: 2,
    explain: 'Object/array gán theo THAM CHIẾU: `b` và `a` cùng trỏ một mảng. push qua b cũng đổi a → length 4, và a===b là true.',
  },
  {
    id: 'oq-incr', topic: 'Toán tử',
    code: `let x = 5;\nconsole.log(x++, ++x);`,
    options: ['5 7', '6 7', '5 6', '6 6'], answer: 0,
    explain: '`x++` (hậu tố) trả về 5 rồi x thành 6. `++x` (tiền tố) tăng x lên 7 rồi trả về 7. → 5 7.',
  },
  {
    id: 'oq-json', topic: 'JSON',
    code: `console.log(JSON.stringify({ a: undefined, b: null, c: 1 }));`,
    options: ['{"a":undefined,"b":null,"c":1}', '{"b":null,"c":1}', '{"a":null,"b":null,"c":1}', '{"c":1}'], answer: 1,
    explain: 'JSON.stringify BỎ QUA thuộc tính có giá trị `undefined` (và function). `null` thì giữ lại. → {"b":null,"c":1}.',
  },
  {
    id: 'oq-falsy', topic: 'Truthy / Falsy',
    code: `console.log(Boolean(''), Boolean('0'), Boolean(0), Boolean([]));`,
    options: ['false false false false', 'false true false true', 'true true true true', 'false true false false'], answer: 1,
    explain: 'Falsy: "" (chuỗi rỗng) và 0 → false. Nhưng "0" là chuỗi KHÔNG rỗng → true; và MỌI object (kể cả mảng rỗng []) → true.',
  },
  {
    id: 'oq-promise-chain', topic: 'Promise',
    code: `Promise.resolve(1)\n  .then(x => x + 1)\n  .then(x => { console.log(x); return x * 2; })\n  .then(x => console.log(x));`,
    options: ['1\n2', '2\n4', '2\n2', '1\n4'], answer: 1,
    explain: 'Mỗi `.then` nhận giá trị TRẢ VỀ của then trước. 1→(+1)=2 → in 2, trả 2*2=4 → in 4. → 2, 4.',
  },
  {
    id: 'oq-rest', topic: 'Destructuring',
    code: `const [a, ...rest] = [1, 2, 3, 4];\nconsole.log(a, rest.length, rest[0]);`,
    options: ['1 4 1', '1 3 2', '1 3 1', '2 3 2'], answer: 1,
    explain: '`a` lấy phần tử đầu = 1. `...rest` gom phần còn lại [2,3,4] → length 3, rest[0] = 2. → 1 3 2.',
  },
  {
    id: 'oq-this-arrow', topic: 'this binding',
    code: `const obj = {\n  v: 10,\n  reg() { return this.v; },\n  arr: () => (typeof this === 'undefined' ? 'undef' : 'obj'),\n};\nconsole.log(obj.reg());`,
    options: ['undefined', '10', 'obj', 'TypeError'], answer: 1,
    explain: 'Hàm thường `reg()` gọi qua `obj.reg()` → `this` là obj → this.v = 10. (Arrow function thì KHÔNG có this riêng — lấy this ngoài scope.)',
  },
  {
    id: 'oq-sort-default', topic: 'Array.sort',
    code: `console.log([1, 10, 2, 21].sort());`,
    options: ['1,10,2,21', '1,2,10,21', '21,10,2,1', '1,2,21,10'], answer: 0,
    explain: 'sort() mặc định so sánh theo CHUỖI: "1" < "10" < "2" < "21" → [1,10,2,21]. Muốn sort số phải truyền comparator: .sort((a,b) => a - b).',
  },
  {
    id: 'oq-plus-coerce', topic: 'Type coercion',
    code: `console.log(1 + '2' + 3);\nconsole.log(1 + 2 + '3');`,
    options: ['123\n33', '63\n33', '123\n6', '15\n33'], answer: 0,
    explain: 'Phép + tính TRÁI sang PHẢI. Dòng 1: 1 + "2" → "12" (gặp chuỗi → nối), rồi "12" + 3 → "123". Dòng 2: 1 + 2 = 3 (số), rồi 3 + "3" → "33".',
  },
  {
    id: 'oq-typeof-nan', topic: 'NaN',
    code: `console.log(typeof NaN, NaN === NaN);`,
    options: ['number false', 'number true', 'NaN false', 'undefined false'], answer: 0,
    explain: 'typeof NaN là "number" (NaN vẫn thuộc kiểu number). NaN KHÔNG bằng chính nó (NaN === NaN là false) — đó là lý do dùng Number.isNaN() để kiểm tra.',
  },
  {
    id: 'oq-obj-key-coerce', topic: 'Object key',
    code: `const o = {};\no[1] = 'a';\no['1'] = 'b';\nconsole.log(o[1]);`,
    options: ['a', 'b', 'undefined', '1'], answer: 1,
    explain: 'Key của object thường luôn là CHUỖI: o[1] và o["1"] cùng trỏ tới key "1". Phép gán thứ hai ghi đè → o[1] đọc ra "b". (Map mới phân biệt được key số và chuỗi.)',
  },
  {
    id: 'oq-nullish-or', topic: '?? vs ||',
    code: `console.log(0 ?? 'a');\nconsole.log(0 || 'a');`,
    options: ['0\na', 'a\na', '0\n0', 'a\n0'], answer: 0,
    explain: '?? (nullish) chỉ thay thế khi vế trái là null/undefined → 0 giữ nguyên 0. || thay thế khi vế trái FALSY (0, "", false, NaN…) → 0 bị thay bằng "a". Khác biệt rất hay bị nhầm khi xử lý giá trị 0/"" hợp lệ.',
  },
  {
    id: 'oq-map-parseint', topic: 'map + parseInt',
    code: `console.log(['1', '2', '3'].map(parseInt));`,
    options: ['1,2,3', '1,NaN,NaN', 'NaN,NaN,NaN', '1,2,NaN'], answer: 1,
    explain: 'map gọi callback với (value, index): parseInt("1", 0) → radix 0 ⇒ coi như 10 → 1; parseInt("2", 1) → radix 1 không hợp lệ → NaN; parseInt("3", 2) → "3" không hợp lệ trong cơ số 2 → NaN. Bẫy kinh điển: đừng truyền thẳng parseInt vào map, hãy dùng Number hoặc (x) => parseInt(x, 10).',
  },
  {
    id: 'oq-timer-order', topic: 'Event loop / timer',
    code: `setTimeout(() => console.log('a'), 20);\nsetTimeout(() => console.log('b'), 10);\nconsole.log('c');`,
    options: ['c\nb\na', 'c\na\nb', 'a\nb\nc', 'b\na\nc'], answer: 0,
    explain: 'Đồng bộ chạy trước → in "c". Hai setTimeout xếp theo THỜI GIAN chờ, không theo thứ tự viết: 10ms (b) tới trước 20ms (a). → c b a.',
  },
  {
    id: 'oq-this-unbound', topic: 'this / mất ngữ cảnh',
    code: `const obj = {\n  val: 42,\n  getVal() { return this.val; },\n};\nconst fn = obj.getVal;\nconsole.log(fn());`,
    options: ['42', 'undefined', 'NaN', 'sẽ ném lỗi'], answer: 1,
    explain: 'Gán `obj.getVal` vào biến rồi gọi `fn()` là gọi HÀM THƯỜNG → `this` không còn là `obj` (ở sloppy mode là global) nên `this.val` = undefined. Muốn giữ ngữ cảnh: `obj.getVal()` hoặc `obj.getVal.bind(obj)`.',
  },
  {
    id: 'oq-obj-plus', topic: 'Ép kiểu object',
    code: `console.log([] + {});`,
    options: ['[object Object]', '0', '{}', 'undefined'], answer: 0,
    explain: 'Toán tử `+` ép cả hai về primitive/string: `[]` → "" và `{}` → "[object Object]" → nối lại thành "[object Object]". Bẫy coercion kinh điển của JS.',
  },
  {
    id: 'oq-await-microtask', topic: 'async/await + microtask',
    code: `async function f() {\n  console.log('a');\n  await Promise.resolve();\n  console.log('b');\n}\nf();\nPromise.resolve().then(() => console.log('c'));`,
    options: ['a\nb\nc', 'a\nc\nb', 'c\na\nb', 'b\na\nc'], answer: 0,
    explain: '`f()` in "a" rồi gặp `await` → phần sau (in "b") thành microtask ĐẦU TIÊN. Sau đó dòng `.then(c)` xếp microtask THỨ HAI. Hàng microtask chạy theo thứ tự xếp → b trước c. → a b c.',
  },
  {
    id: 'oq-optional-chain', topic: 'Optional chaining + ??',
    code: `const user = { profile: null };\nconsole.log(user.profile?.name ?? 'guest');`,
    options: ['guest', 'null', 'undefined', 'sẽ ném lỗi'], answer: 0,
    explain: '`user.profile` là null → `?.name` ngắn mạch trả về undefined (không ném lỗi). `undefined ?? "guest"` → "guest". Kết hợp `?.` và `??` để đọc an toàn dữ liệu lồng nhau.',
  },
  {
    id: 'oq-typeof-typeof', topic: 'typeof',
    code: `console.log(typeof typeof 1);`,
    options: ['number', 'string', 'undefined', 'object'], answer: 1,
    explain: '`typeof` luôn trả về một CHUỖI. `typeof 1` → "number"; rồi `typeof "number"` → "string". Vì vậy `typeof typeof <bất kỳ>` luôn là "string".',
  },
];
