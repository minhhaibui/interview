/**
 * Ngân hàng "🟨 JavaScript" — LÝ THUYẾT CHUYÊN SÂU cho phỏng vấn (không phải đoán output).
 * Scope/closure/TDZ, this & binding, prototype, ép kiểu, tham chiếu, event loop & microtask,
 * Promise, generator/iterator, Proxy/Reflect, WeakMap & GC, module ESM vs CommonJS.
 *
 * Mỗi câu: { id, topic, q, code?, options:[...], answer:idx, explain }
 * `code` (tuỳ chọn) hiện thành khối code JS phía dưới câu hỏi.
 */
window.JS_QUIZ = [
  // ---------- Scope, hoisting, closure ----------
  {
    id: 'js-tdz', topic: 'Scope & hoisting',
    q: 'Nói `let`/`const` "không được hoisting" là SAI ở chỗ nào?',
    options: [
      'Chúng không hề được hoisting: engine chỉ tạo biến khi chạy tới đúng dòng khai báo',
      'Chúng CÓ được hoisting lên đầu block nhưng chưa khởi tạo — vùng TDZ, chạm vào là ReferenceError',
      'Chúng được hoisting lên đầu function như `var`, chỉ khác là giá trị khởi tạo bằng `undefined`',
      'Chúng được hoisting nhưng chỉ trong strict mode, còn sloppy mode thì hoạt động y hệt `var`',
    ], answer: 1,
    explain: 'Cả `var`, `let`, `const`, `class` đều được ghi nhận khi tạo Environment Record của scope. Khác nhau ở KHỞI TẠO: `var` được gán `undefined` ngay nên đọc trước khai báo ra `undefined`; `let`/`const` ở trạng thái "uninitialized" — khoảng từ đầu block tới dòng khai báo gọi là TDZ (Temporal Dead Zone), truy cập trong đó ném `ReferenceError: Cannot access before initialization`. Bằng chứng TDZ có thật: `typeof x` với `var` chưa khai báo trả `"undefined"`, nhưng với `let x` phía dưới thì ném lỗi.',
  },
  {
    id: 'js-hoist-order', topic: 'Scope & hoisting',
    q: 'Trong cùng một scope, `function foo(){}` và `var foo = ...` cùng tên thì cái nào "thắng"?',
    code: 'console.log(typeof foo); // ?\nvar foo = 1;\nfunction foo() {}',
    options: [
      'In ra `number`, vì khai báo `var foo = 1` được hoisting sau function nên ghi đè lên nó ngay từ đầu',
      'Ném SyntaxError vì trong cùng một scope không được khai báo trùng tên giữa function declaration và var',
      'In ra `function`: function declaration được khởi tạo NGAY khi vào scope, `var` cùng tên không ghi đè lúc hoisting',
      'In ra `undefined` vì `var foo` hoisting lên trên và gán `undefined` đè lên function',
    ], answer: 2,
    explain: 'Khi khởi tạo scope: các function declaration được TẠO VÀ GÁN ngay; `var` cùng tên thì bị bỏ qua bước gán `undefined` (đã có binding rồi). Nên tại dòng `console.log`, `foo` là function. Chỉ khi CHẠY tới `foo = 1` giá trị mới đổi thành số. Đây là lý do nhiều codebase cấm trộn `var` với function declaration cùng tên — ESLint `no-func-assign`/`no-redeclare` bắt lỗi này.',
  },
  {
    id: 'js-closure-def', topic: 'Closure',
    q: 'Định nghĩa CHÍNH XÁC của closure là gì?',
    options: [
      'Một function được khai báo bên trong function khác, bất kể có dùng biến ngoài hay không',
      'Cơ chế sao chép giá trị của các biến ngoài vào bên trong function tại thời điểm function được tạo ra',
      'Function cộng với môi trường từ vựng (lexical environment) nơi nó ĐƯỢC ĐỊNH NGHĨA, giữ tham chiếu tới biến ngoài',
      'Kỹ thuật giấu biến khỏi global scope bằng cách bọc toàn bộ code của module trong một IIFE',
    ], answer: 2,
    explain: 'Closure = function + lexical environment của nơi nó được ĐỊNH NGHĨA (không phải nơi được gọi). Hai điểm hay bị hỏi vặn: (1) giữ THAM CHIẾU tới biến, không phải copy giá trị — nên biến đổi sau đó thì closure thấy giá trị mới; (2) scope được quyết định lúc viết code (lexical/static scoping), khác hẳn `this` vốn quyết định lúc gọi (dynamic). IIFE chỉ là một ỨNG DỤNG của closure, không phải định nghĩa.',
  },
  {
    id: 'js-closure-loop', topic: 'Closure',
    q: 'Vì sao vòng lặp dưới in ra `3 3 3` với `var` nhưng `0 1 2` với `let`?',
    code: 'for (var i = 0; i < 3; i++) setTimeout(() => console.log(i));',
    options: [
      '`let` khiến setTimeout chạy đồng bộ ngay trong vòng lặp nên bắt được giá trị lúc đó',
      '`var` có một binding duy nhất cho cả vòng lặp; `let` tạo binding MỚI mỗi lần lặp và copy giá trị vào',
      '`var` bị hoisting lên global còn `let` nằm trong block nên setTimeout không đọc được biến ngoài',
      '`let` tự động bọc callback trong một IIFE nên mỗi callback có bản sao riêng của biến',
    ], answer: 1,
    explain: '`var i` là MỘT biến function-scoped; cả 3 callback closure cùng trỏ vào nó, tới lúc timer chạy (sau khi vòng lặp xong) giá trị đã là 3. Với `let`, spec tạo một binding mới cho MỖI lần lặp (`CreatePerIterationEnvironment`) và copy giá trị cuối vòng trước sang — nên mỗi closure bắt một biến riêng. Cách sửa thời `var`: bọc IIFE `(function(j){ setTimeout(()=>console.log(j)) })(i)` — chính là tạo scope mới thủ công.',
  },
  {
    id: 'js-closure-leak', topic: 'Closure',
    q: 'Closure gây rò rỉ bộ nhớ trong tình huống nào?',
    options: [
      'Bất cứ khi nào dùng closure, vì biến trong closure không bao giờ được GC thu hồi',
      'Chỉ khi closure được khai báo bằng arrow function thay vì function thường',
      'Khi closure còn sống lâu (listener, cache, timer) mà vẫn giữ tham chiếu tới object lớn không còn cần',
      'Khi closure đọc biến global, vì global object không bao giờ bị giải phóng',
    ], answer: 2,
    explain: 'GC của JS dựa trên REACHABILITY: còn đường đi tới object từ root thì không thu hồi. Closure sống lâu (đăng ký `addEventListener`, `setInterval`, để trong Map làm cache, giữ trong biến module) sẽ neo giữ toàn bộ biến nó tham chiếu — kể cả một DOM node hay buffer vài MB không còn dùng. Cách chữa: gỡ listener/`clearInterval` khi xong, gán `null` cho tham chiếu nặng, dùng `WeakMap`/`WeakRef` cho cache theo object.',
  },
  {
    id: 'js-currying', topic: 'Closure',
    q: 'Currying (`f(a)(b)(c)`) khác partial application ở điểm nào?',
    options: [
      'Currying biến hàm n tham số thành chuỗi n hàm 1 tham số; partial chỉ cố định SẴN vài tham số rồi trả hàm nhận phần còn lại',
      'Currying nhanh hơn vì engine tối ưu được, partial application luôn tạo thêm object mới',
      'Hai khái niệm giống hệt nhau, chỉ khác tên gọi giữa cộng đồng FP và cộng đồng OOP',
      'Currying chỉ áp dụng cho hàm thuần, còn partial application dùng được với cả hàm có side effect',
    ], answer: 0,
    explain: 'Curry: `f(a,b,c)` → `f(a)(b)(c)` — chuỗi hàm MỘT tham số. Partial: `g = f.bind(null, a)` → `g(b, c)` — cố định vài tham số, phần còn lại nhận một lượt. Cả hai đều dựa trên closure để nhớ tham số đã nhận. Ứng dụng thực tế: tạo hàm chuyên biệt (`const log = createLogger("order-service")`), hợp thành pipeline, hoặc truyền hàm cấu hình sẵn vào `map`/`filter`.',
  },
  // ---------- this & binding ----------
  {
    id: 'js-this-rules', topic: 'this & binding',
    q: '`this` trong một function THƯỜNG được quyết định bởi cái gì?',
    options: [
      'Nơi function được ĐỊNH NGHĨA trong source code, giống như cách scope biến hoạt động',
      'Prototype của function, tức là giá trị hiện tại của `Function.prototype`',
      'File/module chứa function đó, mỗi module có một `this` riêng cho toàn bộ hàm bên trong',
      'CÁCH GỌI tại thời điểm chạy: `new` > `call/apply/bind` > `obj.f()` > gọi trần (undefined/global)',
    ], answer: 3,
    explain: '`this` là DYNAMIC binding — phụ thuộc call-site, không phải nơi định nghĩa (khác hẳn scope biến vốn lexical). Thứ tự ưu tiên: (1) `new Foo()` → this = object mới; (2) `f.call(o)`/`f.apply(o)`/`f.bind(o)` → this = o; (3) `o.f()` → this = o (implicit binding, dễ MẤT khi tách hàm ra biến: `const g = o.f; g()`); (4) gọi trần → `undefined` ở strict mode / `globalThis` ở sloppy mode.',
  },
  {
    id: 'js-this-arrow', topic: 'this & binding',
    q: 'Arrow function xử lý `this` thế nào?',
    options: [
      'Arrow KHÔNG có `this` riêng — nó tra `this` theo scope từ vựng bên ngoài, `call/bind` không đổi được',
      'Arrow tự động `bind(this)` của object chứa nó ngay tại thời điểm được gọi lần đầu',
      'Arrow luôn có `this` là `globalThis`, nên trong class phải bọc thêm một hàm thường',
      'Arrow có `this` riêng nhưng mặc định trỏ vào object cha, có thể đổi bằng `call`',
    ], answer: 0,
    explain: 'Arrow không tạo binding `this`, `arguments`, `super`, `new.target` — gặp `this` thì tra ngược lên scope ngoài như một biến bình thường. Hệ quả: `fn.call(obj)` với arrow KHÔNG đổi được `this`; arrow không dùng làm constructor (`new` ném TypeError); và đừng dùng arrow cho method của object literal khi cần `this` = object đó. Ngược lại, arrow rất hợp làm callback (`setTimeout(() => this.tick())`) hoặc class field (`handle = () => {...}`) vì giữ đúng `this`.',
  },
  {
    id: 'js-this-lost', topic: 'this & binding',
    q: 'Vì sao `const f = obj.method; f()` lại mất `this`, và cách sửa chuẩn nhất là gì?',
    options: [
      'Vì gán biến tạo bản sao của method — sửa bằng cách gán `f.this = obj` trước khi gọi',
      'Vì `this` gắn với function lúc định nghĩa và bị xoá khi gán — sửa bằng cách chuyển method thành arrow trong object literal',
      'Vì `this` do CALL-SITE quyết định; `f()` là gọi trần nên không có receiver — sửa bằng `obj.method.bind(obj)` hoặc class field arrow',
      'Vì strict mode cấm truyền `this` ngầm qua biến — sửa bằng cách bỏ `"use strict"` khỏi file',
    ], answer: 2,
    explain: 'Implicit binding chỉ tồn tại ở call-site `obj.method()`; gán ra biến rồi gọi `f()` là gọi trần → `this` là `undefined` (strict/module) hoặc global. Đây là bug kinh điển khi truyền method làm callback: `setTimeout(obj.tick, 100)`, `arr.map(this.render)`, hoặc `onClick={this.handleClick}` trong React class. Sửa: `.bind(obj)` trong constructor, arrow class field, hoặc bọc `() => obj.method()`.',
  },
  {
    id: 'js-bind-twice', topic: 'this & binding',
    q: '`f.bind(a).bind(b)()` thì `this` bằng gì?',
    options: [
      '`b`, vì lần bind sau luôn ghi đè lần bind trước cho tới khi hàm được gọi',
      '`a` — bind lần đầu tạo bound function đã "khoá" this, bind tiếp chỉ bọc thêm một lớp vô hiệu',
      '`undefined`, vì bind hai lần làm mất receiver và trở thành gọi trần',
      'Object mới do JS tự tạo, vì bound function được đối xử như constructor',
    ], answer: 1,
    explain: 'Bound function nội bộ gọi target bằng `[[BoundThis]]` cố định — nó KHÔNG dùng `this` mà nó nhận được. Nên bind lần hai chỉ tạo thêm một lớp bọc, `this` vẫn là `a`. Ngoại lệ duy nhất: dùng `new` trên bound function thì `[[BoundThis]]` bị bỏ qua, `this` là object mới (spec cố tình cho phép để `new` vẫn hoạt động qua partial application).',
  },
  {
    id: 'js-new-op', topic: 'this & binding',
    q: 'Toán tử `new Foo(args)` làm những bước gì?',
    options: [
      'Chỉ đơn giản gọi `Foo(args)` như một hàm thường rồi trả về giá trị `return` — không có bước nào đặc biệt',
      'Tạo object rỗng với `[[Prototype]] = Foo.prototype`, gọi `Foo` với `this` là object đó, trả object trừ khi hàm return object khác',
      'Sao chép toàn bộ thuộc tính của `Foo.prototype` vào một object mới rồi trả về bản sao đó',
      'Tạo object mới rồi gán `this = Foo` để hàm truy cập được các static property của constructor',
    ], answer: 1,
    explain: 'Bốn bước: (1) tạo object rỗng; (2) set `[[Prototype]]` = `Foo.prototype` (LIÊN KẾT, không copy — đó là lý do sửa prototype sau đó vẫn ảnh hưởng instance đã tạo); (3) chạy thân hàm với `this` = object mới; (4) return object đó, TRỪ KHI hàm tự `return` một object khác thì cái đó thắng (`return 5` thì bị bỏ qua vì không phải object). Biết bước 4 giải thích được vì sao factory pattern `return {...}` trong constructor lại "ăn" được.',
  },
  // ---------- Prototype & OOP ----------
  {
    id: 'js-proto-chain', topic: 'Prototype & OOP',
    q: 'Khi đọc `obj.x` mà `obj` không có `x`, engine làm gì?',
    options: [
      'Trả về `undefined` ngay lập tức vì thuộc tính không tồn tại trên chính object đó',
      'Tra ngược chuỗi `[[Prototype]]` (`__proto__`) tới khi gặp `x` hoặc tới `null` thì trả `undefined`',
      'Tra trong scope chứa `obj` xem có biến tên `x` không rồi mới trả về giá trị tìm được',
      'Ném `TypeError` để buộc lập trình viên kiểm tra bằng `in` hoặc `hasOwnProperty` trước',
    ], answer: 1,
    explain: 'Property lookup đi theo prototype chain: `obj` → `Object.getPrototypeOf(obj)` → ... → `null`. Vì vậy `[].map` tìm thấy ở `Array.prototype`, `toString` ở `Object.prototype`. Hai hệ quả phỏng vấn hay hỏi: (1) chain càng dài, miss lookup càng chậm (thực tế inline cache của V8 giấu đi gần hết); (2) GHI thì khác ĐỌC — `obj.x = 1` tạo own property ngay trên obj, không sửa prototype (trừ khi prototype có setter). Dùng `Object.hasOwn(obj, "x")` để phân biệt own vs kế thừa.',
  },
  {
    id: 'js-class-sugar', topic: 'Prototype & OOP',
    q: '`class` trong JS khác gì với hàm constructor + prototype thời ES5?',
    options: [
      'Class tạo ra hệ thống kiểu thật với kiểm tra kiểu lúc biên dịch, khác hẳn cơ chế prototype động',
      'Class dùng cơ chế kế thừa dựa trên bản sao (copy) thuộc tính thay vì liên kết prototype như trước',
      'Về cơ chế vẫn là prototype, nhưng class luôn strict mode, không hoisting dùng được, bắt buộc `new`, và có `super`/field riêng',
      'Không khác gì cả — `class` chỉ là cách viết ngắn gọn hơn, mọi hành vi lúc chạy đều y hệt ES5',
    ], answer: 2,
    explain: 'Class vẫn là syntactic sugar trên prototype (`typeof Foo === "function"`, method nằm ở `Foo.prototype`), nhưng KHÔNG chỉ là sugar: thân class luôn strict mode; class có TDZ (gọi trước khai báo là ReferenceError); gọi thiếu `new` ném TypeError; method không enumerable; có `super`, private field `#x`, static block. Nói "chỉ là sugar, không khác gì" là câu trả lời bị vặn ngay.',
  },
  {
    id: 'js-proto-vs-proto', topic: 'Prototype & OOP',
    q: 'Phân biệt `Foo.prototype` với `obj.__proto__`?',
    options: [
      'Hai cái là một, `__proto__` chỉ là tên viết tắt cũ của `prototype` dành cho instance',
      '`Foo.prototype` là object sẽ được gán làm prototype cho instance khi `new`; `obj.__proto__` là prototype THỰC của obj',
      '`Foo.prototype` chứa các static method của Foo, còn `__proto__` chứa các instance method',
      '`__proto__` là bản sao sâu của `Foo.prototype` được tạo riêng cho mỗi instance khi khởi tạo',
    ], answer: 1,
    explain: '`prototype` là thuộc tính CHỈ function-dùng-làm-constructor mới có — nó là "khuôn" gán cho instance. `__proto__` (chuẩn hơn: `Object.getPrototypeOf`) là liên kết thực của một object tới prototype của nó. Quan hệ: `new Foo().__proto__ === Foo.prototype`. Static method nằm trực tiếp trên `Foo`, không nằm trên `Foo.prototype`. Tránh gán `__proto__` lúc runtime — V8 sẽ deoptimize hidden class, dùng `Object.create` từ đầu.',
  },
  {
    id: 'js-instanceof', topic: 'Prototype & OOP',
    q: '`a instanceof B` kiểm tra điều gì, và vì sao nó có thể sai?',
    options: [
      'So sánh `a.constructor.name` với tên của B, sai khi code bị minify đổi tên hàm',
      'Kiểm tra a có đủ mọi thuộc tính mà B định nghĩa không, sai khi object thiếu field optional',
      'Kiểm tra `B.prototype` có nằm trên chuỗi prototype của a không; sai khi qua realm khác (iframe/vm) hoặc prototype bị đổi',
      'So sánh kiểu nội bộ `[[Class]]` của a với B, sai với mọi object do người dùng tự định nghĩa',
    ], answer: 2,
    explain: '`instanceof` duyệt prototype chain của `a` tìm chính object `B.prototype` (có thể tuỳ biến bằng `Symbol.hasInstance`). Hai cái bẫy: (1) CROSS-REALM — mảng từ iframe/`vm` khác có `Array.prototype` khác nên `arr instanceof Array` là false, dùng `Array.isArray()`; (2) prototype bị gán lại sau khi tạo instance. Kiểm tra kiểu chắc tay hơn: `Array.isArray`, `Object.prototype.toString.call(x)`, hoặc duck typing.',
  },
  {
    id: 'js-super', topic: 'Prototype & OOP',
    q: 'Vì sao trong constructor của lớp con phải gọi `super()` TRƯỚC khi dùng `this`?',
    options: [
      'Vì `this` của lớp con chỉ được TẠO bởi constructor lớp cha — trước `super()` nó nằm trong TDZ',
      'Vì `super()` copy các field của lớp cha sang lớp con, không gọi thì object thiếu thuộc tính',
      'Đó chỉ là quy ước dễ đọc do ESLint áp đặt, bỏ `super()` code vẫn chạy bình thường',
      'Vì `super()` đăng ký lớp con vào prototype chain, không gọi thì `instanceof` trả về false',
    ], answer: 0,
    explain: 'Với lớp dẫn xuất, `this` KHÔNG được tạo ở đầu constructor con — chính `super()` mới khởi tạo nó (spec: derived constructor có `[[ConstructorKind]] = derived`, `this` ở trạng thái uninitialized). Chạm `this` trước `super()` ném `ReferenceError`; kết thúc constructor mà chưa gọi `super()` cũng ném lỗi. Đây cũng là lý do class field của lớp con được khởi tạo NGAY SAU `super()` — bẫy hay gặp khi constructor cha gọi method bị lớp con override.',
  },
  {
    id: 'js-private-field', topic: 'Prototype & OOP',
    q: 'Private field `#count` khác quy ước `_count` ở chỗ nào?',
    options: [
      'Không khác gì về mặt kỹ thuật, `#` chỉ là quy ước mới thay cho `_` cho đẹp mã nguồn',
      '`#count` chỉ private khi biên dịch bằng TypeScript, chạy JS thuần vẫn truy cập được',
      '`#count` được ENGINE bảo vệ: ngoài class truy cập là SyntaxError, không lộ qua `Object.keys`/`JSON.stringify`/Proxy',
      '`#count` được mã hoá trong bộ nhớ nên không đọc được kể cả bằng devtools hay debugger',
    ], answer: 2,
    explain: '`_count` chỉ là quy ước — vẫn là property bình thường, đọc/ghi/liệt kê được. `#count` là private thật ở tầng engine: truy cập ngoài thân class là lỗi cú pháp, không xuất hiện trong `Object.keys`, `JSON.stringify`, spread, hay bị Proxy trap. Mẹo hay được hỏi: `#x in obj` là cách chuẩn để "brand check" xem object có phải instance thật của class không. (Devtools vẫn xem được — private ≠ mã hoá.)',
  },
  // ---------- Kiểu & ép kiểu ----------
  {
    id: 'js-eq', topic: 'Kiểu & ép kiểu',
    q: 'Khác biệt cốt lõi giữa `==` và `===`?',
    options: [
      '`==` so sánh giá trị còn `===` so sánh địa chỉ bộ nhớ, kể cả với chuỗi và số',
      '`==` chạy thuật toán ép kiểu trừu tượng trước khi so; `===` khác kiểu là false ngay',
      '`===` chậm hơn vì phải kiểm tra thêm kiểu, nên hot path nên dùng `==`',
      '`==` chỉ dùng được cho primitive, `===` mới so sánh được object với object',
    ], answer: 1,
    explain: '`===` (strict): khác kiểu → false ngay, cùng kiểu thì so giá trị (object so theo tham chiếu). `==` (loose): khác kiểu thì ép theo bảng quy tắc — số ⟷ chuỗi thì chuỗi thành số; boolean thành số; object thành primitive qua `valueOf`/`toString`; `null == undefined` là true nhưng `null == 0` là false. Chuẩn thực hành: luôn `===`, ngoại lệ được chấp nhận là `x == null` để bắt gọn cả `null` lẫn `undefined`.',
  },
  {
    id: 'js-nan', topic: 'Kiểu & ép kiểu',
    q: 'Cách kiểm tra một giá trị có phải NaN đáng tin nhất là gì?',
    options: [
      '`x === NaN` — so sánh trực tiếp với hằng NaN của đối tượng Number',
      '`isNaN(x)` — hàm global có sẵn, kiểm tra được mọi kiểu đầu vào',
      '`typeof x === "number" && x !== x` hoặc `Number.isNaN(x)` / `Object.is(x, NaN)`',
      '`x.toString() === "NaN"` — so khớp biểu diễn chuỗi của giá trị',
    ], answer: 2,
    explain: 'NaN là giá trị DUY NHẤT khác chính nó (`NaN !== NaN`, theo IEEE-754), nên `x === NaN` luôn false. `isNaN()` global ÉP KIỂU trước nên `isNaN("abc")` ra true — sai ý định. Dùng `Number.isNaN(x)` (không ép kiểu) hoặc `Object.is(x, NaN)`. `Object.is` cũng phân biệt được `+0` và `-0` — hai chỗ duy nhất nó khác `===`.',
  },
  {
    id: 'js-float', topic: 'Kiểu & ép kiểu',
    q: 'Vì sao `0.1 + 0.2 !== 0.3`, và xử lý tiền tệ thế nào cho đúng?',
    options: [
      'Do bug làm tròn của V8; các engine khác như JavaScriptCore hay SpiderMonkey cho kết quả chính xác',
      'Do JS lưu số ở dạng chuỗi rồi mới parse sang số, nên mất chữ số ở bước chuyển đổi qua lại',
      'Số JS là IEEE-754 double nhị phân, 0.1/0.2 không biểu diễn hữu hạn — dùng số nguyên đơn vị nhỏ nhất hoặc decimal',
      'Do phép cộng số thực được tối ưu bằng cách ép tạm về 32 bit nên kết quả bị cắt ngắn',
    ], answer: 2,
    explain: 'Mọi `number` trong JS là IEEE-754 binary64. 0.1 trong nhị phân là số vô hạn tuần hoàn nên bị làm tròn; cộng lại ra 0.30000000000000004. So sánh thì dùng sai số: `Math.abs(a-b) < Number.EPSILON`. Với TIỀN: đừng dùng float — lưu số nguyên theo đơn vị nhỏ nhất (xu/đồng), dùng `BigInt`, thư viện decimal (decimal.js), hoặc kiểu `NUMERIC/DECIMAL` ở DB. Đây là câu hỏi bẫy rất hay gặp cho backend làm thanh toán.',
  },
  {
    id: 'js-nullish', topic: 'Kiểu & ép kiểu',
    q: '`a ?? b` khác `a || b` ở đâu?',
    options: [
      '`??` chỉ lấy `b` khi `a` là `null`/`undefined`; `||` lấy `b` với MỌI giá trị falsy (0, "", false, NaN)',
      '`??` kiểm tra kiểu chặt hơn nên `a` phải cùng kiểu với `b`, nếu không sẽ ném TypeError',
      '`??` đánh giá cả hai vế rồi mới chọn, còn `||` short-circuit dừng ở vế trái nếu truthy',
      '`??` chỉ dùng được với object, còn `||` dùng cho primitive — hai toán tử không thay thế nhau',
    ], answer: 0,
    explain: '`||` rơi sang vế phải với mọi falsy — bug kinh điển: `const port = cfg.port || 3000` biến `port: 0` thành 3000, `const name = input || "N/A"` biến chuỗi rỗng hợp lệ thành "N/A". `??` chỉ quan tâm nullish (`null`/`undefined`) nên giữ nguyên `0`, `""`, `false`. Lưu ý cú pháp: không được trộn `??` với `&&`/`||` mà không có ngoặc (SyntaxError cố ý, để tránh nhầm độ ưu tiên).',
  },
  {
    id: 'js-optchain', topic: 'Kiểu & ép kiểu',
    q: 'Optional chaining `a?.b.c` short-circuit tới đâu khi `a` là `null`?',
    options: [
      'Chỉ bỏ qua bước `.b`, sau đó vẫn thử đọc `.c` trên `undefined` nên ném TypeError',
      'Ném TypeError ngay vì `?.` chỉ hợp lệ khi mọi mắt xích phía sau cũng có dấu `?.`',
      'Trả `undefined` và bỏ qua TOÀN BỘ chuỗi truy cập còn lại, kể cả lời gọi hàm phía sau',
      'Trả `null` (giữ nguyên giá trị của a) để phân biệt với trường hợp `b` không tồn tại',
    ], answer: 2,
    explain: 'Khi vế trái `?.` là nullish, cả chuỗi bị short-circuit và biểu thức trả `undefined` (luôn `undefined`, không phải `null`) — nên `a?.b.c.d()` an toàn khi `a` nullish. Nhưng ĐỪNG rải `?.` khắp nơi: nó giấu bug — nếu `a` LẼ RA phải tồn tại thì `?.` biến lỗi rõ ràng thành `undefined` lan truyền, vỡ ở chỗ khác xa hơn. Còn có `?.()` cho gọi hàm và `?.[]` cho index.',
  },
  {
    id: 'js-typeof-null', topic: 'Kiểu & ép kiểu',
    q: '`typeof null === "object"` — vì sao JS lại trả về như vậy?',
    options: [
      'Vì `null` thực sự là một object rỗng đặc biệt được kế thừa từ `Object.prototype`',
      'Là bug lịch sử từ bản JS đầu tiên (tag kiểu 000 trùng với object), giữ lại mãi vì tương thích ngược',
      'Vì `typeof` luôn trả "object" cho mọi giá trị không phải số hoặc chuỗi, kể cả boolean',
      'Vì `null` là instance của `Object`, nên `null instanceof Object` trả về true',
    ], answer: 1,
    explain: 'Trong bản JS đầu tiên, giá trị được lưu kèm tag kiểu; object có tag 000 và `null` là con trỏ NULL (toàn bit 0) nên bị đọc là object. Sửa sẽ phá web cũ nên spec giữ nguyên vĩnh viễn. Kiểm tra đúng: `x !== null && typeof x === "object"`; phân biệt mảng bằng `Array.isArray`; plain object bằng `Object.getPrototypeOf(x) === Object.prototype`. (`null instanceof Object` là false.)',
  },
  {
    id: 'js-coerce-obj', topic: 'Kiểu & ép kiểu',
    q: 'Khi ép một object sang primitive (ví dụ `obj + ""`), engine gọi những gì?',
    options: [
      'Chỉ gọi `JSON.stringify` để lấy biểu diễn chuỗi của toàn bộ object rồi dùng chuỗi đó',
      'Chỉ gọi `toString()`; còn `valueOf()` chỉ được dùng riêng cho phép so sánh `<` và `>`',
      'Gọi `Symbol.toPrimitive` nếu có; không thì theo hint: "number"/"default" thử `valueOf` trước, "string" thử `toString`',
      'Đọc thẳng thuộc tính nội bộ `[[PrimitiveValue]]`, object thường không có nên trả `undefined`',
    ], answer: 2,
    explain: 'Thuật toán `ToPrimitive(input, hint)`: nếu có `obj[Symbol.toPrimitive]` thì gọi nó; không thì với hint "string" (template literal, key của object) thử `toString` → `valueOf`, còn hint "number"/"default" (toán tử số học, `+`, so sánh) thử `valueOf` → `toString`. Vì `{}.valueOf()` trả chính object nên rơi xuống `toString` ra `"[object Object]"`. `Date` là ví dụ đặc biệt: hint "default" của Date ưu tiên chuỗi, nên `date + 1` ra chuỗi còn `date - 1` ra số.',
  },
  // ---------- Object & tham chiếu ----------
  {
    id: 'js-shallow', topic: 'Object & tham chiếu',
    q: '`{...obj}` và `Object.assign({}, obj)` copy ở mức nào?',
    options: [
      'Copy SÂU toàn bộ cây object nhiều tầng, an toàn để sửa mà không ảnh hưởng tới bản gốc',
      'Copy NÔNG một tầng: giá trị lồng nhau vẫn dùng chung tham chiếu, và getter bị đọc thành giá trị tĩnh',
      'Không copy gì cả, chỉ tạo thêm một biến tham chiếu mới trỏ tới đúng object gốc',
      'Copy sâu với object thường nhưng copy nông với mảng, do mảng có index number',
    ], answer: 1,
    explain: 'Spread/`Object.assign` copy NÔNG các own enumerable property (kể cả symbol key own). Object lồng bên trong vẫn chung tham chiếu → sửa `copy.a.b` là đổi cả bản gốc, nguồn bug state trong Redux/React. Chúng cũng ĐỌC getter và lưu kết quả thành data property (mất tính lazy), và không copy prototype. Deep clone: `structuredClone(obj)` (built-in, giữ được Date/Map/Set/vòng lặp tham chiếu nhưng không copy được function/DOM), hoặc lodash `cloneDeep`.',
  },
  {
    id: 'js-freeze', topic: 'Object & tham chiếu',
    q: '`Object.freeze(obj)` bảo vệ tới mức nào?',
    options: [
      'Đóng băng toàn bộ cây object bao gồm cả các object lồng bên trong nhiều tầng',
      'Chỉ chặn thêm/xoá property mới, còn sửa giá trị property đã có thì vẫn được',
      'Chỉ đóng băng MỘT tầng: property lồng nhau vẫn sửa được; ở sloppy mode ghi đè im lặng thất bại',
      'Biến object thành hằng số nên gán lại chính biến đó (`obj = {}`) cũng bị chặn',
    ], answer: 2,
    explain: '`freeze` là NÔNG: chặn thêm/xoá/sửa property của chính object đó và khoá cấu hình, nhưng `frozen.nested.x = 1` vẫn chạy. Muốn sâu thì đệ quy freeze (cẩn thận vòng lặp tham chiếu). Ở sloppy mode phép ghi thất bại IM LẶNG — rất khó debug; strict mode/module ném TypeError. Và freeze khoá OBJECT chứ không khoá BIẾN: `const` mới ngăn gán lại biến. Ba mức liên quan: `preventExtensions` < `seal` < `freeze`.',
  },
  {
    id: 'js-pass', topic: 'Object & tham chiếu',
    q: 'JS truyền tham số theo kiểu gì?',
    options: [
      'Luôn truyền theo GIÁ TRỊ; với object thì giá trị đó là tham chiếu — nên sửa thuộc tính thì thấy, gán lại tham số thì không',
      'Truyền theo tham chiếu với object và mảng, theo giá trị với primitive — đúng nghĩa pass-by-reference',
      'Truyền theo tham chiếu với mọi thứ, kể cả số và chuỗi, nhờ cơ chế boxing tự động',
      'Tuỳ theo chế độ: strict mode truyền theo giá trị, còn sloppy mode truyền theo tham chiếu',
    ], answer: 0,
    explain: 'JS luôn pass-by-value; với object thì "value" chính là con trỏ tới object (gọi là call-by-sharing). Hệ quả: `function f(o){ o.x = 1 }` sửa được object của caller, nhưng `function f(o){ o = {x:1} }` KHÔNG — chỉ đổi biến cục bộ. Pass-by-reference thật (như `&` trong C++) sẽ cho phép gán lại biến của caller — JS không làm được. Cùng nguyên tắc đó giải thích vì sao `arr.push()` sửa được state gốc còn `arr = [...]` thì không.',
  },
  {
    id: 'js-getter', topic: 'Object & tham chiếu',
    q: 'Getter/setter (accessor property) khác data property thế nào?',
    options: [
      'Accessor nhanh hơn vì giá trị trả về được engine cache lại ngay sau lần đọc đầu tiên',
      'Accessor có `[[Get]]`/`[[Set]]` là hàm chạy mỗi lần đọc/ghi; data property có `[[Value]]`/`[[Writable]]` lưu giá trị tĩnh',
      'Accessor chỉ khai báo được bằng `Object.defineProperty`, không viết được trong object literal',
      'Accessor tự động validate kiểu dữ liệu trước khi gán giá trị, còn data property thì không kiểm tra',
    ], answer: 1,
    explain: 'Một property hoặc là DATA (`value` + `writable`) hoặc là ACCESSOR (`get`/`set`) — không thể cả hai. Accessor chạy hàm mỗi lần truy cập nên tính được giá trị dẫn xuất, log, validate, lazy-load. Bẫy: spread/`Object.assign` GỌI getter rồi lưu kết quả thành data property (mất tính động); `JSON.stringify` cũng gọi getter. Xem chi tiết bằng `Object.getOwnPropertyDescriptor`. Vue 2 reactivity dựng trên `defineProperty` accessor, Vue 3 chuyển sang Proxy vì `defineProperty` không bắt được việc THÊM property mới.',
  },
  {
    id: 'js-key-order', topic: 'Object & tham chiếu',
    q: 'Thứ tự lặp key của object thường (`Object.keys`) được quyết định thế nào?',
    options: [
      'Ngẫu nhiên theo hash nội bộ, spec không đảm bảo gì nên tuyệt đối không được dựa vào',
      'Luôn theo thứ tự chèn vào, kể cả khi key là chuỗi số như "2", "10", "1"',
      'Key kiểu "số nguyên" xếp TĂNG DẦN trước, rồi tới key chuỗi theo thứ tự chèn, cuối cùng là symbol',
      'Theo thứ tự bảng chữ cái của tên key, giống như khi in bằng JSON.stringify',
    ], answer: 2,
    explain: 'Từ ES2015 thứ tự đã được chuẩn hoá: (1) integer-like key ("0","1","42") tăng dần theo giá trị số; (2) key chuỗi còn lại theo thứ tự CHÈN; (3) symbol key theo thứ tự chèn. Nên `{b:1, 2:2, a:3, 1:4}` cho keys `["1","2","b","a"]` — bẫy hay gặp khi dùng object làm map với key là id số (thứ tự bị sắp lại ngoài ý muốn). Cần giữ đúng thứ tự chèn cho mọi loại key thì dùng `Map`.',
  },
  {
    id: 'js-map-vs-obj', topic: 'Object & tham chiếu',
    q: 'Khi nào nên dùng `Map` thay cho object thường?',
    options: [
      'Luôn luôn — `Map` nhanh hơn object thường trong mọi tình huống đọc, ghi và duyệt',
      'Khi key không phải chuỗi/symbol, cần giữ đúng thứ tự chèn, thêm-xoá liên tục, hoặc cần `.size`',
      'Chỉ khi cần lưu hơn 1000 phần tử; dưới ngưỡng đó object thường luôn tối ưu hơn',
      'Khi cần serialize sang JSON, vì `JSON.stringify` hỗ trợ Map tốt hơn object',
    ], answer: 1,
    explain: 'Map: key là BẤT KỲ giá trị nào (object, function, NaN), giữ nguyên thứ tự chèn, có `.size`, iterate trực tiếp, thêm/xoá nhiều thì hiệu năng ổn định, không dính key kế thừa từ `Object.prototype` (`{}["toString"]` không phải undefined!). Object: cú pháp gọn, `JSON.stringify` chạy thẳng, struct cố định thì V8 tối ưu tốt hơn (hidden class). Lưu ý ngược lại với đáp án sai: `JSON.stringify(map)` ra `{}` — phải `Object.fromEntries(map)` trước.',
  },
  {
    id: 'js-weakmap', topic: 'Object & tham chiếu',
    q: '`WeakMap` giải quyết vấn đề gì mà `Map` không giải quyết được?',
    options: [
      'WeakMap tra cứu nhanh hơn Map vì bảng băm nhỏ hơn và không phải lưu thứ tự chèn',
      'WeakMap giữ tham chiếu YẾU tới key — key hết reachable thì entry tự bị GC dọn, tránh rò rỉ bộ nhớ',
      'WeakMap cho phép dùng primitive (chuỗi, số) làm key, còn Map thì bắt buộc dùng object',
      'WeakMap tự động xoá entry cũ nhất khi vượt quá giới hạn kích thước, hoạt động như LRU cache',
    ], answer: 1,
    explain: 'Map giữ tham chiếu MẠNH: cache `map.set(domNode, data)` sẽ neo giữ node mãi mãi kể cả khi node đã bị gỡ khỏi DOM → leak. WeakMap giữ tham chiếu yếu, key không còn ai trỏ tới thì cặp key/value bị thu hồi. Đổi lại: key BẮT BUỘC là object (hoặc symbol không đăng ký), không iterate được, không có `.size` — vì làm thế sẽ để lộ thời điểm GC chạy. Dùng để: gắn metadata/private data vào object của bên thứ ba, cache theo instance.',
  },
  {
    id: 'js-proxy', topic: 'Meta-programming',
    q: '`Proxy` cho phép làm gì mà `Object.defineProperty` không làm được?',
    options: [
      'Chặn được cả property CHƯA TỒN TẠI lẫn `delete`/`in`/`Object.keys`, kể cả key thêm vào sau',
      'Chạy nhanh hơn nhờ được engine tối ưu riêng, nên nên thay thế defineProperty ở hot path',
      'Cho phép định nghĩa getter/setter, điều mà defineProperty hoàn toàn không hỗ trợ',
      'Thay đổi được prototype của object mà không cần gọi Object.setPrototypeOf',
    ], answer: 0,
    explain: '`defineProperty` chỉ chặn được property ĐÃ BIẾT tại thời điểm cài (đây là lý do Vue 2 phải có `Vue.set` cho property mới và không bắt được `arr[i] = x`). Proxy đặt trap ở tầng thao tác: `get`, `set`, `has`, `deleteProperty`, `ownKeys`, `apply`, `construct`... nên bắt được cả key thêm sau và thao tác mảng — Vue 3 reactivity dựa trên Proxy. Đánh đổi: Proxy CHẬM hơn truy cập trực tiếp (không inline cache được) và không "trong suốt" hoàn toàn (không trap được private field `#x`, `===` vẫn phân biệt proxy với target). `Reflect` cung cấp hành vi mặc định để gọi lại trong trap.',
  },
  // ---------- Bất đồng bộ & event loop ----------
  {
    id: 'js-eventloop', topic: 'Event loop',
    q: 'Quan hệ giữa call stack, task queue (macrotask) và microtask queue là gì?',
    options: [
      'Cả hai hàng đợi được xử lý xen kẽ 1-1, mỗi vòng lặp lấy một task rồi một microtask',
      'Microtask queue có độ ưu tiên thấp hơn, chỉ chạy khi trình duyệt rảnh rỗi (idle callback)',
      'Sau mỗi macrotask, stack rỗng thì VÉT SẠCH microtask queue (kể cả microtask sinh thêm) rồi mới sang macrotask kế',
      'Cả hai chạy song song trên hai luồng khác nhau nên thứ tự giữa chúng là không xác định',
    ], answer: 2,
    explain: 'Vòng lặp: lấy 1 macrotask (timer, I/O, sự kiện) → chạy tới khi stack rỗng → DRAIN toàn bộ microtask queue (Promise `.then`, `queueMicrotask`, `MutationObserver`; ở Node thêm `process.nextTick` với ưu tiên cao hơn) → render (trình duyệt) → macrotask kế. Vì microtask được vét SẠCH, một chuỗi microtask sinh microtask vô hạn sẽ TREO hẳn ứng dụng — starvation, khác với setTimeout đệ quy vẫn nhường chỗ cho render.',
  },
  {
    id: 'js-micro-order', topic: 'Event loop',
    q: 'Vì sao `Promise.resolve().then(...)` luôn chạy trước `setTimeout(..., 0)` dù viết sau?',
    options: [
      'Vì Promise được thực thi đồng bộ ngay tại chỗ, không qua hàng đợi nào cả',
      'Vì setTimeout luôn bị trình duyệt ép chờ tối thiểu 4ms nên bao giờ cũng chậm hơn',
      'Vì `.then` vào MICROTASK queue — được vét hết ngay sau khi stack rỗng, trước macrotask kế tiếp',
      'Vì Promise chạy trên luồng riêng nên không phải xếp hàng chung với các callback khác',
    ], answer: 2,
    explain: '`.then` xếp callback vào microtask queue, được vét ngay khi call stack rỗng — trước khi event loop lấy macrotask tiếp theo (nơi callback `setTimeout` nằm). Clamp 4ms của setTimeout lồng nhau chỉ là yếu tố phụ: kể cả không clamp thì microtask vẫn thắng. Ứng dụng: cần "chạy sau khi code hiện tại xong nhưng TRƯỚC lần render/timer kế" thì dùng `queueMicrotask` chứ đừng `setTimeout(...,0)`.',
  },
  {
    id: 'js-await-order', topic: 'Bất đồng bộ',
    q: '`await` thực chất làm gì với hàm async?',
    options: [
      'Chặn luồng chính cho tới khi Promise settle, giống như một vòng lặp busy-wait',
      'Chuyển phần code SAU nó thành callback microtask, tạm nhả quyền điều khiển về caller',
      'Tạo một worker thread mới để chạy phần còn lại của hàm mà không chặn UI',
      'Biến Promise thành giá trị đồng bộ bằng cách bỏ qua hàng đợi microtask',
    ], answer: 1,
    explain: 'Hàm async chạy ĐỒNG BỘ tới `await` đầu tiên, rồi return một Promise cho caller; phần sau `await` được đăng ký như một microtask, tiếp tục khi Promise settle. Nên `await` KHÔNG chặn luồng — nó chỉ tạm dừng HÀM ĐÓ. Hệ quả hay bị hỏi: mã đồng bộ nặng đặt trước `await` vẫn treo cả app; và `await` một giá trị thường (`await 5`) vẫn tốn ít nhất một tick microtask.',
  },
  {
    id: 'js-await-loop', topic: 'Bất đồng bộ',
    q: 'Vì sao `arr.forEach(async x => { await save(x) })` không chờ được?',
    options: [
      '`forEach` chỉ hỗ trợ callback đồng bộ nên `await` bên trong bị bỏ qua và không chạy',
      '`forEach` BỎ QUA Promise mà callback trả về nên nó chạy tiếp ngay — dùng `for...of` hoặc `Promise.all(map(...))`',
      'Vì `async` trong arrow function không hợp lệ, phải dùng `async function` đầy đủ mới chờ được',
      'Vì `forEach` chạy song song trên nhiều luồng nên `await` mất tác dụng đồng bộ hoá',
    ], answer: 1,
    explain: '`forEach` gọi callback rồi VỨT giá trị trả về — nó không biết Promise là gì. Kết quả: vòng lặp kết thúc ngay lập tức, `save` chạy nền, lỗi không ai bắt (unhandled rejection). Sửa: `for (const x of arr) await save(x)` để chạy TUẦN TỰ (an toàn cho DB/rate-limit), hoặc `await Promise.all(arr.map(x => save(x)))` để chạy SONG SONG (nhanh nhưng có thể đè tải). Cần vừa song song vừa giới hạn thì dùng p-limit / chia batch.',
  },
  {
    id: 'js-promise-combi', topic: 'Bất đồng bộ',
    q: 'Chọn mô tả đúng cho `Promise.all` / `allSettled` / `race` / `any`?',
    options: [
      '`all` fail-fast khi 1 cái reject; `allSettled` chờ hết và trả trạng thái từng cái; `race` lấy cái settle đầu tiên; `any` lấy fulfill đầu tiên',
      '`all` vẫn chờ tất cả kể cả khi có cái reject; còn `allSettled` thì dừng ngay khi gặp lỗi đầu tiên',
      '`race` lấy cái FULFILL đầu tiên và bỏ qua mọi reject; còn `any` lấy cái settle đầu tiên bất kể thành hay bại',
      '`all` và `allSettled` giống nhau; `race` và `any` cũng giống nhau, chỉ khác tên gọi theo từng phiên bản',
    ], answer: 0,
    explain: '`all`: reject NGAY khi phần tử đầu tiên reject (fail-fast) — nhưng các Promise kia VẪN chạy tiếp, chỉ là kết quả bị bỏ. `allSettled`: không bao giờ reject, trả mảng `{status, value|reason}` — hợp cho fan-out gọi nhiều service mà chấp nhận một phần lỗi. `race`: cái SETTLE đầu tiên thắng, kể cả reject — dùng làm timeout. `any`: cái FULFILL đầu tiên; hết sạch mà đều reject thì ném `AggregateError`.',
  },
  {
    id: 'js-promise-state', topic: 'Bất đồng bộ',
    q: 'Một Promise có thể đổi trạng thái mấy lần?',
    options: [
      'Bao nhiêu lần cũng được, mỗi lần gọi `resolve` sẽ kích hoạt lại toàn bộ handler `.then`',
      'Hai lần: pending → fulfilled → rejected nếu handler `.then` ném lỗi bên trong',
      'ĐÚNG MỘT lần: pending → fulfilled hoặc rejected; các lời gọi resolve/reject sau bị bỏ qua im lặng',
      'Không giới hạn khi ở trạng thái pending, nhưng sau khi settle thì bị đóng băng vĩnh viễn',
    ], answer: 2,
    explain: 'Promise là one-shot: settle rồi thì bất biến, gọi `resolve()` lần nữa không có tác dụng và KHÔNG ném lỗi (im lặng — nguồn bug khó thấy khi bọc callback cũ). `.then` gắn sau khi đã settle vẫn chạy (ở microtask kế). Cần nhiều giá trị theo thời gian thì dùng EventEmitter/AsyncIterator/Observable, không dùng Promise. Lưu ý: `.then` trả về một Promise MỚI, nên `p.then(a)` và `p.then(b)` là hai nhánh song song, khác hẳn chuỗi `p.then(a).then(b)`.',
  },
  {
    id: 'js-unhandled', topic: 'Bất đồng bộ',
    q: 'Điều gì xảy ra khi một Promise reject mà không có handler?',
    options: [
      'Lỗi bị nuốt hoàn toàn và không có cách nào phát hiện được lúc chạy chương trình',
      'Chương trình dừng ngay lập tức tại đúng dòng gây reject, y như một throw đồng bộ',
      'Phát sự kiện `unhandledrejection` (browser) / `unhandledRejection` (Node) — Node ≥15 mặc định CRASH tiến trình',
      '`try/catch` bao ngoài lời gọi hàm async vẫn bắt được, vì Promise sẽ tự ném lại lỗi đó',
    ], answer: 2,
    explain: 'Không có `.catch`/`try-catch` quanh `await` thì reject nổi lên thành unhandled rejection. Trình duyệt bắn `window.onunhandledrejection` và log; Node từ v15 đổi mặc định thành `--unhandled-rejections=throw` → tiến trình CRASH (trước đó chỉ cảnh báo). Đó là lý do backend Node phải `.catch` mọi promise nền và bọc async route handler (Express 4 KHÔNG tự bắt lỗi async — cần wrapper hoặc Express 5).',
  },
  {
    id: 'js-abort', topic: 'Bất đồng bộ',
    q: '`AbortController` dùng để làm gì?',
    options: [
      'Xoá một Promise khỏi microtask queue để callback của nó không bao giờ được thực thi',
      'Bắt buộc GC thu hồi ngay lập tức các object mà Promise đang còn giữ tham chiếu',
      'Truyền tín hiệu HUỶ tới các API hỗ trợ (`fetch`, listener, stream Node) — Promise reject với `AbortError`',
      'Đặt timeout tự động cho mọi promise trong ứng dụng mà không cần sửa code gọi',
    ], answer: 2,
    explain: 'Promise vốn KHÔNG huỷ được — `AbortController` là kênh tín hiệu chuẩn: tạo controller, truyền `controller.signal` vào API (`fetch(url,{signal})`, `addEventListener(...,{signal})`, `fs.readFile(..., {signal})`), gọi `controller.abort()` thì API tự dừng và reject `AbortError`. Dùng nhiều để: huỷ request cũ khi user gõ tiếp (search-as-you-type), cleanup trong `useEffect`, và đặt timeout (`AbortSignal.timeout(5000)`). Lưu ý bắt riêng `AbortError` để khỏi báo lỗi nhầm cho user.',
  },
  {
    id: 'js-settimeout-drift', topic: 'Bất đồng bộ',
    q: '`setTimeout(fn, 100)` đảm bảo điều gì?',
    options: [
      'Chạy chính xác sau đúng 100ms với sai số không quá 1ms trên mọi môi trường',
      'Chạy sau TỐI THIỂU 100ms — thời điểm thực phụ thuộc stack, macrotask đang chờ, và clamp của trình duyệt',
      'Chạy sau 100ms tính từ lúc callback trước đó kết thúc, nên chuỗi setTimeout không bị trôi',
      'Chạy sau 100ms trên một luồng riêng nên không bị ảnh hưởng bởi code đồng bộ đang chạy',
    ], answer: 1,
    explain: 'Timer chỉ ĐẶT LỊCH: hết 100ms callback được xếp vào macrotask queue, còn chạy lúc nào thì tuỳ stack có rỗng chưa và trước nó còn task gì. Code đồng bộ nặng làm trễ tuỳ ý. Thêm: timer lồng nhau quá 5 tầng bị clamp tối thiểu 4ms; tab nền bị throttle mạnh (≥1s). Nên đồng hồ/animation đừng cộng dồn delay — hãy tính theo `Date.now()`/`performance.now()` thực, còn animation thì dùng `requestAnimationFrame`.',
  },
  {
    id: 'js-generator', topic: 'Generator & iterator',
    q: 'Generator (`function*`) khác function thường ở điểm cốt lõi nào?',
    options: [
      'Generator luôn chạy bất đồng bộ trên microtask queue nên không chặn luồng chính',
      'Generator TẠM DỪNG được ở `yield` và tiếp tục sau qua `next()`, giữ nguyên trạng thái giữa các lần gọi',
      'Generator trả về mảng tất cả giá trị `yield` ngay khi được gọi lần đầu tiên',
      'Generator tự động tối ưu bộ nhớ bằng cách giải phóng biến cục bộ sau mỗi lần yield',
    ], answer: 1,
    explain: 'Gọi generator KHÔNG chạy thân hàm — nó trả về một iterator. Mỗi `next(v)` chạy tới `yield` kế và trả `{value, done}`; `v` truyền vào trở thành kết quả của `yield` đang dừng (kênh giao tiếp HAI CHIỀU). Ứng dụng: dãy lười/vô hạn (tiết kiệm bộ nhớ so với tạo mảng), duyệt cây, và nền tảng cho async/await (co/redux-saga dùng generator để tạm dừng chờ Promise). Có thêm `return()` để dọn dẹp và `throw()` để ném lỗi vào trong.',
  },
  {
    id: 'js-iterable', topic: 'Generator & iterator',
    q: 'Điều kiện để một object dùng được với `for...of` và spread `[...obj]`?',
    options: [
      'Object phải có thuộc tính `length` và các key số liên tiếp từ 0 giống mảng',
      'Object phải kế thừa từ `Array.prototype` hoặc là instance của một lớp built-in',
      'Object phải có method `[Symbol.iterator]()` trả về iterator có `next()` cho ra `{value, done}`',
      'Object phải được đánh dấu bằng `Object.defineProperty(obj, "iterable", {value: true})`',
    ], answer: 2,
    explain: 'Đó là ITERABLE PROTOCOL: `for...of`, spread, destructuring mảng, `Promise.all`, `Array.from`, `new Map(...)` đều gọi `obj[Symbol.iterator]()`. Object thường KHÔNG iterable (nên `[...{a:1}]` lỗi, phải qua `Object.entries`). Cách cài nhanh nhất là generator: `*[Symbol.iterator]() { yield* this.items }`. Bản bất đồng bộ là `Symbol.asyncIterator` dùng với `for await...of` — nền tảng để duyệt stream trong Node.',
  },
  // ---------- Module ----------
  {
    id: 'js-esm-cjs', topic: 'Module',
    q: 'Khác biệt CỐT LÕI giữa ES Module và CommonJS?',
    options: [
      'ESM chỉ là cú pháp mới của CommonJS; sau khi biên dịch thì hai loại chạy giống hệt nhau',
      'ESM phân tích TĨNH lúc parse (tree-shaking, live binding, top-level await); CJS `require` chạy động lúc runtime',
      'ESM chỉ chạy được trên trình duyệt, còn CommonJS thì chỉ chạy được trong môi trường Node.js',
      'CommonJS hỗ trợ nạp module bất đồng bộ, còn ESM thì luôn nạp module một cách đồng bộ',
    ], answer: 1,
    explain: 'ESM: `import/export` là cú pháp TĨNH — bundler biết trước đồ thị phụ thuộc nên tree-shake được; import tạo LIVE BINDING (giá trị export đổi thì bên import thấy ngay); nạp bất đồng bộ, hỗ trợ top-level await; luôn strict mode. CJS: `require()` là lời gọi HÀM chạy runtime (gọi trong `if` được), trả về SNAPSHOT của `module.exports` tại thời điểm đó; đồng bộ; có `__dirname`, `require.cache`. Trong Node, ESM `import` được CJS, nhưng CJS `require` ESM chỉ được từ Node 22+ (với module không có top-level await).',
  },
  {
    id: 'js-live-binding', topic: 'Module',
    q: '"Live binding" của ESM nghĩa là gì?',
    options: [
      'Module được tải lại tự động khi file nguồn thay đổi trên đĩa (hot reload)',
      'Biến import là THAM CHIẾU chỉ-đọc tới ô nhớ của module gốc — gốc đổi thì bên import thấy giá trị mới',
      'Mọi biến export đều tự động trở thành observable, gán vào là kích hoạt callback',
      'Module được chia sẻ giữa nhiều tab của cùng một trang thông qua bộ nhớ chung',
    ], answer: 1,
    explain: '`import { count } from "./m.js"` không copy giá trị: nó liên kết tới binding trong module gốc. Gốc chạy `count++` thì bên import đọc ra số mới. Bên import KHÔNG được gán lại (`count = 5` → TypeError, binding là read-only). CJS ngược lại: `const { count } = require("./m")` chụp SNAPSHOT giá trị lúc require, gốc đổi sau thì không thấy — bẫy kinh điển khi mock/reset counter trong test.',
  },
  {
    id: 'js-circular', topic: 'Module',
    q: 'Import vòng (A import B, B import A) xảy ra chuyện gì?',
    options: [
      'Engine luôn ném lỗi "Circular dependency detected" và dừng chương trình ngay',
      'Module bị nạp hai lần, mỗi bên có một bản sao riêng nên state không chia sẻ được',
      'Không crash ngay: module đang nạp dở trả về bản CHƯA hoàn tất — CJS ra `{}`, ESM ném lỗi TDZ',
      'Engine tự sắp xếp lại thứ tự nạp để phá vòng nên hoàn toàn không có vấn đề gì',
    ], answer: 2,
    explain: 'Cả hai hệ thống đều có cache module để không lặp vô hạn — cái giá là bạn nhận được module NỬA CHỪNG. CJS: `require` trả `module.exports` tại thời điểm đó, thường là `{}` → lỗi kiểu "x is not a function" khi gọi ở top-level (nếu chỉ dùng trong hàm, gọi sau này thì thường vẫn ổn). ESM: binding tồn tại nhưng chưa khởi tạo → dùng ngay lúc evaluate là `ReferenceError` (TDZ), dùng bên trong hàm gọi sau thì ổn. Chữa gốc: tách phần dùng chung ra module thứ ba, hoặc dùng dependency injection.',
  },
  // ---------- Mảng, chuỗi, tiện ích ----------
  {
    id: 'js-sort', topic: 'Mảng & chuỗi',
    q: '`[10, 9, 1].sort()` cho kết quả gì và vì sao?',
    options: [
      '`[1, 9, 10]` — sort mặc định so sánh theo giá trị số khi mảng toàn số',
      '`[1, 10, 9]` — sort mặc định ép mọi phần tử về CHUỖI rồi so theo mã UTF-16',
      '`[10, 9, 1]` — sort không có comparator thì giữ nguyên thứ tự ban đầu',
      'Ném TypeError vì thiếu hàm so sánh bắt buộc theo chuẩn ES2019',
    ], answer: 1,
    explain: 'Không có comparator, `sort` ép phần tử về chuỗi rồi so từng ký tự: "1" < "10" < "9". Muốn đúng thì truyền `(a,b) => a-b`. Hai điểm nữa: `sort` SỬA TẠI CHỖ và trả về chính mảng đó (dùng `toSorted()` từ ES2023 để có bản mới); từ ES2019 `sort` được đảm bảo STABLE — phần tử bằng nhau giữ nguyên thứ tự, quan trọng khi sắp xếp nhiều tiêu chí nối tiếp. Comparator phải nhất quán, nếu không kết quả là undefined behavior.',
  },
  {
    id: 'js-holes', topic: 'Mảng & chuỗi',
    q: '`new Array(3).map((_, i) => i)` trả về gì?',
    options: [
      '`[0, 1, 2]` vì `map` duyệt qua đủ 3 vị trí dựa theo thuộc tính length của mảng',
      '`[]` vì mảng chưa có phần tử thật nào nên map không có gì để duyệt và trả mảng rỗng',
      '`[empty × 3]` — map BỎ QUA ô trống (hole) của sparse array nên không phần tử nào được duyệt',
      'Ném TypeError vì không thể gọi map trên mảng chưa khởi tạo phần tử',
    ], answer: 2,
    explain: '`new Array(3)` tạo SPARSE array: length = 3 nhưng không có index nào tồn tại thật. `map`/`forEach`/`filter`/`reduce` bỏ qua hole (chỉ duyệt index đã tồn tại) nên kết quả vẫn là mảng 3 hole. Cách đúng: `Array.from({length:3}, (_, i) => i)` hoặc `new Array(3).fill(0).map(...)` (fill "vật chất hoá" các ô). Ngược lại `[...new Array(3)]` cho `[undefined,undefined,undefined]` vì iterator KHÔNG bỏ qua hole — nguồn nhầm lẫn kinh điển.',
  },
  {
    id: 'js-reduce', topic: 'Mảng & chuỗi',
    q: 'Vì sao nên luôn truyền giá trị khởi tạo cho `reduce`?',
    options: [
      'Vì thiếu nó thì reduce chạy chậm hơn do engine phải suy ra kiểu dữ liệu lúc chạy',
      'Vì mảng RỖNG mà không có initial value sẽ ném TypeError, và phần tử đầu bị dùng làm accumulator gây lệch kiểu',
      'Vì không có nó thì callback chỉ nhận được 2 tham số đầu thay vì đủ cả 4 tham số',
      'Vì initial value là bắt buộc theo chuẩn ES2015, bỏ đi sẽ không chạy trên Node mới',
    ], answer: 1,
    explain: 'Không có initial: accumulator = phần tử [0] và vòng lặp bắt đầu từ [1]; mảng rỗng → `TypeError: Reduce of empty array with no initial value`. Còn khi accumulator lẽ ra phải là object/số 0 mà lại lấy phần tử đầu, kiểu sẽ lệch ngay từ bước đầu. Luôn viết `arr.reduce(fn, 0)` / `, {}` / `, []`. Ngoài ra: reduce lồng spread (`{...acc, [k]:v}`) là O(n²) — với mảng lớn nên mutate accumulator hoặc dùng `Object.fromEntries`.',
  },
  {
    id: 'js-debounce', topic: 'Mảng & chuỗi',
    q: 'Debounce và throttle khác nhau thế nào?',
    options: [
      'Debounce chỉ chạy SAU khi ngừng kích hoạt đủ lâu; throttle chạy đều đặn tối đa 1 lần mỗi khoảng thời gian',
      'Debounce chạy ngay lần đầu rồi bỏ qua phần còn lại; throttle luôn hoãn tới cuối chuỗi sự kiện',
      'Debounce dùng setInterval còn throttle dùng setTimeout, ngoài ra hành vi giống nhau',
      'Debounce chỉ áp dụng cho sự kiện bàn phím, throttle chỉ dùng cho sự kiện cuộn trang',
    ], answer: 0,
    explain: 'Debounce: mỗi lần gọi lại RESET timer, chỉ chạy khi im lặng đủ T — hợp với ô tìm kiếm (chỉ gọi API khi user ngừng gõ), auto-save, validate form. Throttle: đảm bảo tối đa 1 lần / T dù gọi liên tục — hợp với `scroll`, `resize`, `mousemove`, cập nhật tiến trình. Cả hai dựng trên closure giữ `timerId`/`lastRun`; bản dùng thật nên có `cancel()`/`flush()` và biến thể leading/trailing edge.',
  },
  {
    id: 'js-strict', topic: 'Cú pháp & runtime',
    q: '`"use strict"` thay đổi những gì đáng kể nhất?',
    options: [
      'Bật kiểm tra kiểu tĩnh cho mọi biến, gán sai kiểu sẽ báo lỗi ngay khi chạy',
      'Chỉ tắt bớt một số cảnh báo của console, không đổi hành vi thực thi của code',
      'Cấm gán biến chưa khai báo, `this` gọi trần là `undefined`, ghi property lỗi thì ném TypeError',
      'Ép mọi biến `var` thành `let` và bật tính năng block scope cho toàn bộ file',
    ], answer: 2,
    explain: 'Strict mode: gán biến chưa khai báo → ReferenceError (chặn tạo global ngoài ý muốn); `this` khi gọi trần là `undefined` thay vì global; ghi vào property read-only/frozen → TypeError thay vì im lặng; cấm `with`, cấm `delete` biến, cấm tham số trùng tên, cấm số bát phân kiểu `010`. QUAN TRỌNG: ES module và thân `class` LUÔN strict mặc định — không cần khai báo. Strict cũng cho phép engine tối ưu tốt hơn vì loại bỏ nhiều hành vi động.',
  },
  {
    id: 'js-label-json', topic: 'Cú pháp & runtime',
    q: '`JSON.stringify` xử lý `undefined`, function và `Symbol` thế nào?',
    options: [
      'Chuyển hết thành `null` để giữ nguyên cấu trúc và số lượng field của object',
      'Trong object thì BỎ QUA key đó; trong mảng thì thay bằng `null`; gọi trực tiếp thì trả `undefined`',
      'Ném TypeError vì đây là các giá trị không hợp lệ trong đặc tả JSON',
      'Serialize thành chuỗi mô tả như `"[Function]"` hoặc `"Symbol(x)"` để không mất thông tin',
    ], answer: 1,
    explain: 'Quy tắc: giá trị không serialize được (undefined, function, symbol) bị BỎ key khi ở trong object nhưng thành `null` khi ở trong mảng (vì mảng phải giữ đúng index). Thêm các bẫy hay hỏi: `NaN`/`Infinity` → `null`; `Date` → chuỗi ISO (mất kiểu, parse lại vẫn là chuỗi); `Map`/`Set` → `{}`; `BigInt` → ném TypeError; vòng lặp tham chiếu → TypeError; object có `toJSON()` thì hàm đó thắng. Tham số thứ 3 để in đẹp, tham số thứ 2 (replacer) để lọc field nhạy cảm khi log.',
  },
  {
    id: 'js-gc', topic: 'Bộ nhớ',
    q: 'GC của JS quyết định thu hồi object dựa trên gì?',
    options: [
      'Đếm số tham chiếu (reference counting) và giải phóng ngay khi bộ đếm về 0',
      'Thời gian sống: object tạo quá lâu mà không được truy cập sẽ bị dọn theo lịch định kỳ',
      'REACHABILITY: từ tập root không đi tới được thì thu hồi — nên vòng lặp tham chiếu vẫn dọn được',
      'Kích thước heap: khi vượt ngưỡng thì thu hồi các object lớn nhất trước tiên',
    ], answer: 2,
    explain: 'Engine hiện đại dùng mark-and-sweep theo reachability, không phải reference counting — nhờ vậy hai object trỏ vòng vào nhau mà không ai ngoài trỏ tới thì VẪN được dọn. V8 chia generation: Scavenger cho young gen (đa số object chết trẻ, dọn rất nhanh), mark-compact cho old gen. Vì vậy "leak" trong JS thường là REACHABLE ngoài ý muốn: biến global, listener chưa gỡ, `setInterval` chưa clear, Map cache lớn dần, closure giữ object nặng. Không có cách ép GC chạy ở code thường (`--expose-gc` chỉ để debug).',
  },
  // ===== Đợt #2 =====
  {
    id: 'js-symbol', topic: 'Meta-programming',
    q: '`Symbol` sinh ra để giải quyết vấn đề gì?',
    options: [
      'Tạo chuỗi ngắn gọn hơn để tiết kiệm bộ nhớ khi dùng làm key của object lớn',
      'Tạo key DUY NHẤT không bao giờ đụng key khác, và định nghĩa hành vi built-in qua well-known symbol',
      'Đánh dấu biến là hằng số thật sự, không thể gán lại kể cả bên trong object',
      'Mã hoá tên thuộc tính để người khác không đọc được khi xem mã nguồn đã build',
    ], answer: 1,
    explain: 'Mỗi `Symbol("x")` là một giá trị DUY NHẤT — hai symbol cùng mô tả vẫn khác nhau. Hai công dụng: (1) gắn metadata vào object của bên thứ ba mà chắc chắn không đụng key có sẵn (symbol key bị `Object.keys`/`JSON.stringify` bỏ qua, nên "ẩn" khỏi vòng lặp thông thường — nhưng KHÔNG phải private, `Object.getOwnPropertySymbols` vẫn thấy); (2) WELL-KNOWN SYMBOL để tuỳ biến hành vi ngôn ngữ: `Symbol.iterator` (cho `for...of`), `Symbol.asyncIterator`, `Symbol.toPrimitive`, `Symbol.hasInstance` (đổi `instanceof`), `Symbol.toStringTag`. Cần dùng chung symbol giữa các realm thì dùng `Symbol.for("key")` (registry toàn cục).',
  },
  {
    id: 'js-safe-int', topic: 'Kiểu & ép kiểu',
    q: 'Backend trả id `9007199254740993` mà frontend hiển thị sai số cuối — vì sao?',
    options: [
      'Vì JSON không hỗ trợ số nguyên quá 15 chữ số nên tự cắt bớt phần dư ở cuối chuỗi số',
      'Vì `JSON.parse` mặc định làm tròn số về 6 chữ số thập phân theo chuẩn ECMA',
      'Vì `number` là double 64-bit, chỉ chính xác tới 2⁵³−1 — id lớn phải truyền dưới dạng CHUỖI hoặc BigInt',
      'Vì trình duyệt giới hạn độ dài của số ở 16 ký tự để tránh tràn bộ nhớ khi tính toán',
    ], answer: 2,
    explain: 'Double 64-bit chỉ biểu diễn CHÍNH XÁC số nguyên tới 2⁵³−1 = 9007199254740991. Vượt qua đó thì các số bắt đầu "dính" nhau: `9007199254740993` parse ra thành `9007199254740992`. Rất hay gặp với id Snowflake (64-bit), id của Twitter/Discord, hoặc `BIGINT` từ Postgres/MySQL. Cách chuẩn: API trả id dưới dạng CHUỖI (`"id": "9007199254740993"`). Nếu buộc phải tính toán thì dùng `BigInt` (`123n`) — nhưng BigInt không trộn được với number trong cùng phép toán và `JSON.stringify` sẽ ném TypeError. Kiểm tra bằng `Number.isSafeInteger(x)`.',
  },
  {
    id: 'js-regex-backtrack', topic: 'Mảng & chuỗi',
    q: 'ReDoS (catastrophic backtracking) trong biểu thức chính quy là gì?',
    options: [
      'Regex quá dài làm engine hết bộ nhớ khi biên dịch thành máy trạng thái nội bộ',
      'Regex lồng lượng từ (`(a+)+$`) khiến số đường thử tăng theo hàm mũ — một chuỗi ngắn cũng treo CPU hàng phút',
      'Regex có ký tự Unicode làm engine phải quét lại chuỗi nhiều lần từ đầu tới cuối',
      'Regex dùng nhóm bắt `()` quá nhiều khiến engine phải cấp phát thêm mảng kết quả',
    ], answer: 1,
    explain: 'Engine regex kiểu backtracking sẽ THỬ LẠI mọi cách chia khi không khớp. Với mẫu lồng lượng từ như `(a+)+$` hoặc `(\\w+\\s?)*$`, số cách chia tăng theo 2ⁿ — chuỗi 30 ký tự "aaaa...!" đủ treo event loop Node hàng phút, biến một input người dùng thành cuộc tấn công từ chối dịch vụ. Phòng: tránh lồng lượng từ và nhánh chồng lấn, neo mẫu (`^...$`), giới hạn độ dài input TRƯỚC khi match, dùng thư viện an toàn (RE2 không backtracking), và quét regex bằng công cụ như `safe-regex`/`eslint-plugin-redos`.',
  },
  {
    id: 'js-regex-lastindex', topic: 'Mảng & chuỗi',
    q: 'Vì sao `re.test(s)` với regex có cờ `/g` lại lúc true lúc false trên cùng chuỗi?',
    code: 'const re = /a/g;\nconsole.log(re.test("a"), re.test("a"), re.test("a"));',
    options: [
      'Vì cờ `g` khiến regex chạy bất đồng bộ nên kết quả phụ thuộc thứ tự hoàn thành',
      'Vì `test` với `/g` chỉ trả true cho lần khớp ĐẦU TIÊN, các lần sau luôn trả về false',
      'Vì regex có `g` (hoặc `y`) giữ `lastIndex` giữa các lần gọi — hết chuỗi thì reset về 0 rồi lặp lại chu kỳ',
      'Vì engine cache kết quả regex nên lần gọi thứ hai lấy giá trị cũ đã hết hạn cache',
    ], answer: 2,
    explain: 'Regex có cờ `g`/`y` là object CÓ TRẠNG THÁI: `test`/`exec` bắt đầu tìm từ `re.lastIndex` và cập nhật nó sau mỗi lần khớp; không khớp thì reset về 0. Nên ví dụ trên in `true false true` — bẫy chết người khi dùng một regex hằng ở module-level để validate trong vòng lặp hoặc trong middleware (request này pass, request kia fail ngẫu nhiên). Cách chữa: bỏ cờ `g` khi chỉ cần kiểm tra, tạo regex mới mỗi lần dùng, hoặc reset `re.lastIndex = 0` trước khi gọi.',
  },
  {
    id: 'js-array-mutate', topic: 'Mảng & chuỗi',
    q: 'Nhóm nào SỬA TẠI CHỖ mảng gốc (mutate) chứ không trả mảng mới?',
    options: [
      '`push`, `pop`, `splice`, `sort`, `reverse`, `fill` — còn `map`/`filter`/`slice`/`concat` trả mảng mới',
      '`map`, `filter`, `slice`, `concat` — còn `push`/`pop`/`sort` đều trả về một mảng mới',
      'Tất cả method của Array đều mutate, muốn bất biến thì phải tự spread trước khi gọi',
      'Không method nào mutate cả, mảng trong JS vốn là cấu trúc dữ liệu bất biến',
    ], answer: 0,
    explain: 'Mutate: `push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill`, `copyWithin`. Trả mảng mới: `map`, `filter`, `slice`, `concat`, `flat`, `flatMap`. Bẫy hay gặp nhất là `sort`/`reverse` — trông như hàm thuần vì CÓ trả về mảng, nhưng đó chính là mảng gốc đã bị sắp lại; `state.items.sort()` trong React là bug ngay. ES2023 thêm bản bất biến: `toSorted`, `toReversed`, `toSpliced`, `with(i, v)`. Mẹo nhớ: tên ở dạng mệnh lệnh thì mutate, tên có `to` ở đầu thì trả bản mới.',
  },
  {
    id: 'js-destructure-default', topic: 'Cú pháp & runtime',
    q: 'Giá trị mặc định khi destructuring (`const {a = 1} = obj`) áp dụng khi nào?',
    options: [
      'Khi giá trị là falsy: `undefined`, `null`, `0`, chuỗi rỗng hoặc `false` đều lấy mặc định',
      'CHỈ khi giá trị đúng bằng `undefined` — `null`, `0`, `""` vẫn được giữ nguyên như bình thường',
      'Khi key hoàn toàn không tồn tại trong object, còn key tồn tại với giá trị `undefined` thì không',
      'Khi giá trị không cùng kiểu với giá trị mặc định được khai báo trong biểu thức',
    ], answer: 1,
    explain: 'Default chỉ kích hoạt với `undefined` — giống hệt tham số mặc định của hàm. Nên `const {a = 1} = {a: null}` cho `a === null` (không phải 1), và `f(undefined)` thì lấy default còn `f(null)` thì không. Đây là nguồn bug rất hay gặp khi API trả `null` cho field rỗng: bạn tưởng default sẽ đỡ nhưng thực tế nhận `null` rồi nổ ở dòng sau. Cách xử lý: chuẩn hoá `null` về `undefined` ở tầng biên, hoặc dùng `?? giá trị` sau khi destructure. Biểu thức default được đánh giá LƯỜI (chỉ chạy khi cần) nên đặt lời gọi hàm vào đó vẫn an toàn.',
  },
  {
    id: 'js-error-cause', topic: 'Xử lý lỗi',
    q: 'Ném lỗi tuỳ biến trong JS thế nào cho đúng?',
    options: [
      'Ném chuỗi hoặc object thường (`throw "lỗi"`, `throw {code: 500}`) cho gọn và dễ serialize',
      'Luôn ném cùng một `new Error()` chung rồi phân biệt bằng cách đọc nội dung message',
      '`class AppError extends Error` + đặt `name`, giữ nguyên nguyên nhân gốc qua `{cause}`',
      'Trả về object `{ok:false, error}` thay vì throw, vì throw làm mất stack trace của hàm gọi',
    ], answer: 2,
    explain: 'Ném chuỗi/object thường thì MẤT stack trace — thứ quý nhất khi debug production. Kế thừa `Error` để giữ stack, `instanceof` phân loại được, và đặt `this.name` cho log dễ đọc; thêm field nghiệp vụ (`statusCode`, `code`) để tầng trên xử lý. ES2022 có `new Error("không tạo được đơn", { cause: err })` — giữ NGUYÊN NHÂN GỐC thay vì nuốt mất khi bọc lỗi qua nhiều tầng; `console.error` và Node in cả chuỗi cause. Lưu ý khi kế thừa qua transpile xuống ES5 thì `instanceof` có thể hỏng (cần `Object.setPrototypeOf(this, new.target.prototype)`).',
  },
  {
    id: 'js-async-iterator', topic: 'Generator & iterator',
    q: '`for await (const x of src)` khác `for (const x of src)` ở chỗ nào?',
    options: [
      'Nó chạy song song mọi phần tử rồi gom kết quả lại theo đúng thứ tự ban đầu của nguồn',
      'Nó tự động bọc mỗi phần tử vào Promise.resolve trước khi đưa vào thân vòng lặp',
      'Nó dùng `Symbol.asyncIterator` và AWAIT từng phần tử — duyệt được nguồn sinh dữ liệu dần (stream, phân trang API)',
      'Nó chỉ khác về cú pháp, còn cách duyệt và thời điểm lấy phần tử thì hoàn toàn như nhau',
    ], answer: 2,
    explain: '`for await...of` gọi `src[Symbol.asyncIterator]()` (không có thì rơi về iterator đồng bộ và await từng giá trị), chờ mỗi `next()` resolve rồi mới chạy thân vòng — nên xử lý TUẦN TỰ, có backpressure tự nhiên. Ứng dụng backend rất thực tế: duyệt stream Node (`for await (const chunk of fs.createReadStream(f))`), duyệt cursor MongoDB, hoặc gọi API phân trang bằng async generator `async function* pages() { ... yield rows }` — code trông như vòng lặp thường mà không phải nạp hết vào RAM. Muốn chạy SONG SONG thì đây là lựa chọn sai, hãy dùng `Promise.all` (hoặc p-limit để giới hạn).',
  },
];
