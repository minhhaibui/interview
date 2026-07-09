/**
 * Ngân hàng "☕ Java" — trắc nghiệm Java CHUYÊN SÂU cho phỏng vấn Backend (đi làm thật).
 * Bao phủ: JVM & bộ nhớ, GC, String, equals/hashCode, Collections & HashMap nội bộ,
 * Concurrency (thread/volatile/synchronized), Generics, Exception, Java 8+ (stream/Optional),
 * OOP, và Spring/JPA cơ bản hay bị hỏi.
 *
 * Mỗi câu: { id, topic, q, options:[...], answer:idx, explain, code? (snippet Java tuỳ chọn) }
 */
window.JAVA_QUIZ = [
  // ---------- JVM & bộ nhớ ----------
  {
    id: 'java-mem-1', topic: 'JVM / bộ nhớ',
    q: 'Biến cục bộ kiểu nguyên thuỷ (int i = 5) và tham chiếu object được lưu ở đâu?',
    options: [
      'Cả hai đều nằm trên heap',
      'Biến cục bộ nằm trên stack; object mà tham chiếu trỏ tới nằm trên heap',
      'Cả hai đều nằm trên stack',
      'Biến cục bộ nằm ở metaspace; object nằm trên stack',
    ], answer: 1,
    explain: 'Mỗi thread có stack riêng chứa các stack frame (biến cục bộ, tham chiếu). Object thật luôn nằm trên HEAP (chia sẻ giữa các thread). Metaspace (Java 8+, thay PermGen) chứa metadata của class, không chứa object thường.',
  },
  {
    id: 'java-mem-2', topic: 'JVM / bộ nhớ',
    q: 'Java 8 thay PermGen bằng gì và khác biệt quan trọng nhất là?',
    options: [
      'Thay bằng Metaspace, nằm trong native memory (không giới hạn bởi -Xmx), mặc định tự mở rộng',
      'Thay bằng Young Generation, nằm trong heap',
      'Thay bằng Stack, tăng tốc nạp class',
      'Không đổi, chỉ đổi tên',
    ], answer: 0,
    explain: 'PermGen (heap, kích thước cố định, dễ OutOfMemoryError: PermGen space) được thay bằng Metaspace nằm ở NATIVE memory, mặc định tự lớn theo nhu cầu (giới hạn bởi -XX:MaxMetaspaceSize). Giảm hẳn lỗi PermGen khi nạp nhiều class.',
  },
  {
    id: 'java-gc-1', topic: 'Garbage Collection',
    q: 'Vì sao GC của Java chia heap thành Young và Old generation (generational GC)?',
    options: [
      'Để chạy đa luồng dễ hơn',
      'Vì phần lớn object “chết trẻ” (weak generational hypothesis) — quét Young thường xuyên & rẻ, Old ít quét hơn',
      'Để tách object theo kiểu dữ liệu',
      'Để tránh phải nén (compact) bộ nhớ',
    ], answer: 1,
    explain: 'Giả thuyết thế hệ: đa số object sống rất ngắn. Minor GC quét Young (Eden + 2 Survivor) rất nhanh; object sống sót đủ lâu mới được thăng lên Old. Major/Full GC quét Old (đắt hơn) diễn ra thưa. Nhờ đó GC hiệu quả hơn quét cả heap mỗi lần.',
  },
  // ---------- String ----------
  {
    id: 'java-str-1', topic: 'String',
    q: 'Kết quả của đoạn code sau?',
    code: 'String a = "hi";\nString b = "hi";\nString c = new String("hi");\nSystem.out.println((a == b) + " " + (a == c) + " " + a.equals(c));',
    options: ['true true true', 'true false true', 'false false true', 'true false false'], answer: 1,
    explain: 'a, b là literal → cùng trỏ vào String pool ⇒ a==b là true. new String() tạo object MỚI trên heap ⇒ a==c là false (khác tham chiếu). equals() so nội dung ⇒ a.equals(c) true. Bài học: so String bằng equals(), không dùng ==.',
  },
  {
    id: 'java-str-2', topic: 'String',
    q: 'Vì sao String trong Java là immutable (bất biến)?',
    options: [
      'Để tiết kiệm bộ nhớ, không lý do nào khác',
      'An toàn thread, cache hashCode, dùng làm key HashMap an toàn, và cho phép String pool tái sử dụng',
      'Vì String kế thừa từ StringBuilder',
      'Để String luôn nằm trên stack',
    ], answer: 1,
    explain: 'Bất biến giúp: (1) thread-safe không cần đồng bộ; (2) hashCode tính 1 lần rồi cache; (3) dùng làm key Map an toàn (không đổi sau khi put); (4) String pool chia sẻ được literal. Muốn nối nhiều chuỗi trong vòng lặp → dùng StringBuilder để tránh tạo rác.',
  },
  // ---------- equals / hashCode ----------
  {
    id: 'java-eq-1', topic: 'equals / hashCode',
    q: 'Bạn override equals() nhưng QUÊN override hashCode(). Hậu quả nghiêm trọng nhất?',
    options: [
      'Code không biên dịch được',
      'Hai object “bằng nhau” theo equals có thể rơi vào bucket khác nhau ⇒ HashMap/HashSet hoạt động sai (không tìm thấy key)',
      'Chương trình chạy chậm nhưng vẫn đúng',
      'equals() sẽ tự bị vô hiệu hoá',
    ], answer: 1,
    explain: 'Hợp đồng: a.equals(b) == true ⇒ a.hashCode() == b.hashCode(). Nếu vi phạm, HashMap đặt 2 object “bằng nhau” vào bucket khác nhau, get() không tìm ra. Luôn override CẢ HAI cùng nhau, dùng cùng tập trường.',
  },
  {
    id: 'java-eq-2', topic: 'equals / hashCode',
    q: 'hashCode() của 2 object khác nhau có bắt buộc phải khác nhau không?',
    options: [
      'Có, nếu trùng là bug',
      'Không — 2 object khác nhau CÓ THỂ trùng hashCode (collision); chỉ cần object bằng nhau thì hashCode phải bằng',
      'Có, JVM đảm bảo duy nhất',
      'Chỉ khác nhau khi override',
    ], answer: 1,
    explain: 'hashCode không cần duy nhất — va chạm (collision) là hợp lệ và bình thường (HashMap xử lý bằng chuỗi/cây trong bucket). Ràng buộc một chiều: bằng nhau ⇒ cùng hashCode; điều ngược lại KHÔNG bắt buộc.',
  },
  // ---------- Collections ----------
  {
    id: 'java-col-1', topic: 'Collections / HashMap',
    q: 'HashMap trong Java 8+ xử lý bucket có quá nhiều va chạm như thế nào?',
    options: [
      'Luôn dùng danh sách liên kết',
      'Khi số phần tử trong 1 bucket ≥ 8 (và bảng ≥ 64) thì chuyển linked list thành cây đỏ-đen (treeify) để tra cứu O(log n)',
      'Tự động tăng gấp đôi hashCode',
      'Ném ra HashCollisionException',
    ], answer: 1,
    explain: 'Java 8 tối ưu: bucket bắt đầu là linked list (get O(n) trong bucket). Khi 1 bucket đạt ≥8 nút và capacity ≥64, nó “treeify” thành red-black tree ⇒ O(log n), chống tấn công collision. Dưới ngưỡng lại chuyển về list.',
  },
  {
    id: 'java-col-2', topic: 'Collections',
    q: 'Khác biệt then chốt giữa ArrayList và LinkedList về hiệu năng?',
    options: [
      'ArrayList truy cập ngẫu nhiên O(1); LinkedList chèn/xoá ở giữa (khi đã có node) O(1) nhưng get(index) O(n)',
      'Cả hai đều O(1) mọi thao tác',
      'LinkedList truy cập ngẫu nhiên nhanh hơn',
      'ArrayList không cho phép chèn giữa',
    ], answer: 0,
    explain: 'ArrayList = mảng động: get(i) O(1), nhưng chèn/xoá giữa phải dịch phần tử O(n). LinkedList = danh sách 2 chiều: get(i) phải duyệt O(n), nhưng chèn/xoá khi ĐÃ có tham chiếu node là O(1). Thực tế ArrayList thường nhanh hơn nhờ cache-locality; LinkedList ít khi là lựa chọn tối ưu.',
  },
  {
    id: 'java-col-3', topic: 'Collections',
    q: 'Fail-fast iterator (vd ArrayList) làm gì khi collection bị sửa trong lúc duyệt?',
    options: [
      'Bỏ qua phần tử mới',
      'Ném ConcurrentModificationException (kiểm tra modCount) — trừ khi xoá bằng iterator.remove()',
      'Tự đồng bộ lại',
      'Trả về null',
    ], answer: 1,
    explain: 'Iterator kiểm tra modCount; nếu collection bị sửa cấu trúc (add/remove) ngoài iterator trong lúc duyệt → ném ConcurrentModificationException (fail-fast). Muốn xoá an toàn khi duyệt: dùng iterator.remove() hoặc removeIf().',
  },
  {
    id: 'java-col-4', topic: 'Collections',
    q: 'Comparable và Comparator khác nhau chỗ nào?',
    options: [
      'Giống hệt nhau',
      'Comparable (compareTo) định nghĩa thứ tự “tự nhiên” TRONG class; Comparator (compare) là thứ tự NGOÀI, linh hoạt nhiều tiêu chí',
      'Comparator nằm trong class cần so sánh',
      'Comparable dùng cho số, Comparator cho chuỗi',
    ], answer: 1,
    explain: 'Comparable<T>: class tự cài compareTo() → 1 thứ tự tự nhiên (vd String, Integer). Comparator<T>: đối tượng so sánh riêng biệt, tạo nhiều cách sắp xếp khác nhau (theo tên, theo tuổi…), truyền vào sort()/TreeMap mà không sửa class gốc.',
  },
  // ---------- Concurrency ----------
  {
    id: 'java-con-1', topic: 'Concurrency',
    q: 'volatile đảm bảo điều gì và KHÔNG đảm bảo điều gì?',
    options: [
      'Đảm bảo cả visibility và atomicity của mọi thao tác',
      'Đảm bảo visibility (thread luôn đọc giá trị mới nhất, chống caching) + cấm sắp xếp lại lệnh; KHÔNG đảm bảo atomicity của thao tác kép như i++',
      'Đảm bảo atomicity nhưng không visibility',
      'Chỉ có tác dụng với biến static',
    ], answer: 1,
    explain: 'volatile: mọi thread đọc/ghi thẳng main memory (visibility) và tạo happens-before, chặn reorder. Nhưng i++ (đọc-tăng-ghi) vẫn KHÔNG nguyên tử → cần AtomicInteger hoặc synchronized cho đếm an toàn.',
  },
  {
    id: 'java-con-2', topic: 'Concurrency',
    q: 'synchronized và volatile — chọn cái nào cho biến cờ boolean chỉ đọc/ghi đơn giản giữa các thread?',
    options: [
      'volatile — đủ đảm bảo visibility cho ghi/đọc đơn (không phải thao tác kép), nhẹ hơn synchronized',
      'synchronized bắt buộc, volatile sai',
      'Không cái nào cần thiết',
      'Phải dùng cả hai cùng lúc',
    ], answer: 0,
    explain: 'Cờ boolean chỉ set true/false (thao tác đơn, không phụ thuộc giá trị cũ) → volatile đủ để đảm bảo visibility, không cần khoá. synchronized cần khi có vùng tới hạn/nhiều biến/thao tác kép (đọc-sửa-ghi) cần loại trừ lẫn nhau.',
  },
  {
    id: 'java-con-3', topic: 'Concurrency',
    q: 'ConcurrentHashMap khác Collections.synchronizedMap(HashMap) ở điểm cốt lõi nào?',
    options: [
      'Không khác gì',
      'ConcurrentHashMap chỉ khoá một phần (bucket/CAS) nên nhiều thread ghi song song tốt hơn; synchronizedMap khoá TOÀN map mỗi thao tác',
      'synchronizedMap nhanh hơn khi ghi nhiều',
      'ConcurrentHashMap không cho phép nhiều thread',
    ], answer: 1,
    explain: 'synchronizedMap bọc mọi method bằng 1 khoá chung → nghẽn cổ chai khi nhiều thread. ConcurrentHashMap (Java 8) dùng CAS + khoá theo bucket/node → thông lượng ghi song song cao hơn nhiều. Cả hai không cho phép key/value null (khác HashMap).',
  },
  {
    id: 'java-con-4', topic: 'Concurrency',
    q: 'ThreadLocal dùng để làm gì?',
    options: [
      'Chia sẻ biến giữa các thread',
      'Mỗi thread có một BẢN SAO biến riêng — dùng cho context per-request, SimpleDateFormat không thread-safe, v.v. (nhớ remove() để tránh leak)',
      'Khoá biến để chỉ 1 thread dùng',
      'Tạo thread mới',
    ], answer: 1,
    explain: 'ThreadLocal cấp cho mỗi thread một giá trị riêng, tránh chia sẻ trạng thái (vd giữ user context, transaction, hoặc SimpleDateFormat vốn không thread-safe). Trong thread pool phải gọi remove() sau khi dùng, nếu không dễ rò rỉ bộ nhớ vì thread được tái sử dụng.',
  },
  {
    id: 'java-con-5', topic: 'Concurrency',
    q: 'Vì sao nên dùng ExecutorService thay vì tự new Thread() cho mỗi tác vụ?',
    options: [
      'new Thread() nhanh hơn',
      'ExecutorService TÁI SỬ DỤNG thread qua pool (giảm chi phí tạo thread), quản lý hàng đợi, giới hạn số thread, dễ shutdown & lấy kết quả (Future)',
      'ExecutorService không cần import',
      'Không có khác biệt',
    ], answer: 1,
    explain: 'Tạo thread rất tốn kém; tạo bừa dễ cạn tài nguyên. ExecutorService (thread pool) tái dùng thread, chặn quá tải bằng hàng đợi + giới hạn kích thước, trả Future/CompletableFuture để lấy kết quả, và shutdown gọn gàng. Đây là chuẩn cho code production.',
  },
  // ---------- Generics ----------
  {
    id: 'java-gen-1', topic: 'Generics',
    q: 'Type erasure trong Java generics nghĩa là gì?',
    options: [
      'Kiểu generic được kiểm tra lúc runtime',
      'Thông tin kiểu generic bị XOÁ sau khi biên dịch (chỉ tồn tại compile-time); runtime List<String> và List<Integer> đều là List',
      'Generics tạo class mới cho mỗi kiểu',
      'Erasure xoá luôn object',
    ], answer: 1,
    explain: 'Generics chỉ để kiểm tra kiểu lúc biên dịch; sau đó kiểu bị “xoá” (erasure) về raw type + chèn cast. Hệ quả: không new T[], không instanceof List<String>, và List<String>/List<Integer> cùng là List.class lúc runtime.',
  },
  {
    id: 'java-gen-2', topic: 'Generics',
    q: 'Nguyên tắc PECS (Producer Extends, Consumer Super) — dùng ? extends T khi nào?',
    options: [
      'Khi bạn GHI vào collection',
      'Khi bạn chỉ ĐỌC (collection là “producer” cung cấp T ra); dùng ? super T khi bạn GHI vào (consumer)',
      'Luôn dùng extends cho mọi trường hợp',
      'extends và super giống nhau',
    ], answer: 1,
    explain: 'PECS: nếu chỉ lấy dữ liệu RA (producer) → List<? extends T> (đọc an toàn thành T). Nếu chỉ bỏ dữ liệu VÀO (consumer) → List<? super T> (ghi T an toàn). Ví dụ Collections.copy(dest super, src extends).',
  },
  // ---------- Exception ----------
  {
    id: 'java-exc-1', topic: 'Exception',
    q: 'Checked exception và unchecked exception (RuntimeException) khác nhau ra sao?',
    options: [
      'Không khác gì',
      'Checked (vd IOException) BẮT BUỘC catch hoặc khai báo throws lúc biên dịch; unchecked (RuntimeException/Error) thì không bắt buộc',
      'Unchecked phải luôn catch',
      'Checked xảy ra lúc runtime, unchecked lúc compile',
    ], answer: 1,
    explain: 'Checked (kế thừa Exception, trừ RuntimeException) — compiler ép xử lý (catch/throws), dùng cho lỗi có thể phục hồi (IO, SQL). Unchecked (RuntimeException: NPE, IllegalArgument…) — lỗi lập trình, không ép khai báo. Error (OOM, StackOverflow) thường không nên bắt.',
  },
  {
    id: 'java-exc-2', topic: 'Exception',
    q: 'try-with-resources (Java 7+) giải quyết vấn đề gì?',
    code: 'try (var in = new FileInputStream("f")) {\n  // dùng in\n}',
    options: [
      'Tự động bắt mọi exception',
      'Tự động gọi close() trên resource (AutoCloseable) khi rời khối try, kể cả khi có exception — tránh quên đóng/rò rỉ',
      'Tăng tốc đọc file',
      'Chỉ hoạt động với String',
    ], answer: 1,
    explain: 'Resource khai trong try(...) phải implements AutoCloseable; JVM tự gọi close() theo thứ tự ngược khi rời khối (dù thành công hay ném exception). Thay cho finally { in.close(); } dài dòng và dễ quên, đồng thời xử lý suppressed exception đúng.',
  },
  {
    id: 'java-exc-3', topic: 'Exception',
    q: 'final, finally và finalize khác nhau thế nào?',
    options: [
      'Ba từ khoá đồng nghĩa',
      'final = hằng/không cho override/kế thừa; finally = khối luôn chạy sau try/catch; finalize() = method GC gọi trước khi thu hồi (đã deprecated, không nên dùng)',
      'finally là biến hằng',
      'finalize chạy trước try',
    ], answer: 1,
    explain: 'final: biến bất biến, method không override được, class không kế thừa được. finally: khối chạy dù try thành công hay ném lỗi (dọn tài nguyên). finalize(): method Object được GC gọi trước khi dọn object — không đảm bảo thời điểm, đã deprecated (Java 9+), tránh dùng.',
  },
  // ---------- Java 8+ ----------
  {
    id: 'java-s8-1', topic: 'Java 8+ / Stream',
    q: 'Stream trong Java là “lazy”. Điều đó nghĩa là gì?',
    options: [
      'Stream chạy trên thread nền',
      'Các thao tác trung gian (map/filter) chỉ được thực thi KHI có thao tác kết thúc (collect/forEach/count) — cho phép tối ưu & short-circuit',
      'Stream lưu toàn bộ dữ liệu vào bộ nhớ trước',
      'Lazy nghĩa là chạy chậm',
    ], answer: 1,
    explain: 'Intermediate ops (map, filter, sorted) trả về Stream mới nhưng CHƯA chạy; chỉ khi gặp terminal op (collect, reduce, findFirst…) pipeline mới thực thi. Nhờ lazy, JVM gộp bước, xử lý theo phần tử và short-circuit (findFirst, limit) không duyệt thừa.',
  },
  {
    id: 'java-s8-2', topic: 'Java 8+ / Optional',
    q: 'Cách dùng Optional nào ĐÚNG tinh thần thiết kế?',
    code: 'Optional<User> u = repo.findById(id);',
    options: [
      'u.get() ngay mà không kiểm tra',
      'u.map(User::getName).orElse("(không rõ)") — xử lý cả trường hợp rỗng không cần if null',
      'if (u != null) ... vì Optional có thể null',
      'Dùng Optional làm field của entity và tham số method',
    ], answer: 1,
    explain: 'Optional để biểu thị “có thể vắng” ở giá trị TRẢ VỀ, buộc caller xử lý rỗng. Nên dùng map/filter/orElse/orElseThrow thay vì get() mù. Tránh: get() không kiểm tra (ném NoSuchElement), dùng Optional cho field/tham số, hay so sánh với null.',
  },
  {
    id: 'java-s8-3', topic: 'Java 8+ / Functional',
    q: 'Functional interface là gì và @FunctionalInterface để làm gì?',
    options: [
      'Interface có nhiều method trừu tượng',
      'Interface có ĐÚNG MỘT abstract method (SAM) — dùng được với lambda; annotation giúp compiler kiểm tra ràng buộc đó',
      'Interface không có method nào',
      'Class đặc biệt của Java',
    ], answer: 1,
    explain: 'Functional interface = 1 abstract method duy nhất (Runnable, Comparator, Function, Predicate…), cho phép gán lambda/method reference. @FunctionalInterface không bắt buộc nhưng giúp compiler báo lỗi nếu vô tình thêm abstract method thứ hai. (default/static method không tính.)',
  },
  // ---------- OOP ----------
  {
    id: 'java-oop-1', topic: 'OOP',
    q: 'Overloading và overriding khác nhau chỗ nào?',
    options: [
      'Giống nhau',
      'Overloading = cùng tên khác tham số, quyết định lúc COMPILE (static binding); overriding = lớp con định nghĩa lại method cha, quyết định lúc RUNTIME (dynamic dispatch)',
      'Overriding xảy ra trong cùng một class',
      'Overloading cần từ khoá @Override',
    ], answer: 1,
    explain: 'Overloading: cùng tên, khác danh sách tham số, trong cùng class; compiler chọn theo kiểu tĩnh (compile-time). Overriding: lớp con viết lại method của lớp cha cùng chữ ký; JVM chọn theo kiểu THỰC của object lúc runtime (đa hình). @Override chỉ áp cho overriding.',
  },
  {
    id: 'java-oop-2', topic: 'OOP',
    q: 'Khi nào chọn abstract class thay vì interface (Java 8+)?',
    options: [
      'Luôn dùng abstract class',
      'Abstract class khi cần state (field), constructor, hoặc chia sẻ code + quan hệ “is-a” đơn kế thừa; interface khi cần đa kế thừa hành vi/hợp đồng, có thể default method',
      'Interface không được có method',
      'Không có khác biệt từ Java 8',
    ], answer: 1,
    explain: 'Abstract class: có field/constructor/trạng thái, chia sẻ code, nhưng chỉ kế thừa 1. Interface: một class implements NHIỀU interface (đa kế thừa hợp đồng), có default/static method từ Java 8 nhưng không giữ state (chỉ constant). Ưu tiên interface cho tính linh hoạt, abstract class khi cần trạng thái/khởi tạo chung.',
  },
  // ---------- Spring / JPA ----------
  {
    id: 'java-spring-1', topic: 'Spring',
    q: 'Dependency Injection (DI) trong Spring giải quyết vấn đề gì?',
    options: [
      'Tăng tốc độ chạy',
      'Đảo ngược điều khiển (IoC): container tạo & “tiêm” dependency vào bean thay vì bean tự new — dễ test (mock), giảm coupling',
      'Tự động viết SQL',
      'Nén file jar',
    ], answer: 1,
    explain: 'Thay vì đối tượng tự khởi tạo dependency (coupling chặt, khó test), Spring container quản lý vòng đời bean và tiêm dependency (qua constructor/field/setter). Lợi ích: dễ thay/mock khi test, cấu hình tập trung, giảm phụ thuộc cụ thể. Ưu tiên constructor injection.',
  },
  {
    id: 'java-spring-2', topic: 'Spring',
    q: 'Scope mặc định của một Spring bean là gì?',
    options: [
      'prototype (mỗi lần lấy một instance mới)',
      'singleton — MỘT instance duy nhất cho cả container (dùng chung), nên bean phải stateless để an toàn thread',
      'request',
      'session',
    ], answer: 1,
    explain: 'Mặc định bean là singleton: container tạo 1 instance và chia sẻ mọi nơi inject. Vì dùng chung giữa các request/thread nên bean nên STATELESS (không giữ trạng thái mutable). Cần instance mới mỗi lần → scope prototype; theo web request/session → request/session.',
  },
  {
    id: 'java-spring-3', topic: 'Spring / Transaction',
    q: '@Transactional với propagation REQUIRES_NEW khác REQUIRED (mặc định) ra sao?',
    options: [
      'Giống nhau',
      'REQUIRED: tham gia transaction hiện có nếu có, không thì tạo mới. REQUIRES_NEW: LUÔN tạm dừng transaction ngoài và mở transaction MỚI độc lập (commit/rollback riêng)',
      'REQUIRES_NEW không bao giờ commit',
      'REQUIRED luôn tạo transaction mới',
    ], answer: 1,
    explain: 'REQUIRED (mặc định): nếu đang có transaction thì dùng chung; chưa có thì tạo. REQUIRES_NEW: luôn treo transaction hiện tại và bắt đầu transaction độc lập — hữu ích khi cần ghi log/audit commit riêng dù transaction cha rollback. Lưu ý @Transactional qua proxy: gọi nội bộ cùng class sẽ không kích hoạt.',
  },
  {
    id: 'java-jpa-1', topic: 'JPA / Hibernate',
    q: 'Vấn đề N+1 query trong JPA là gì và khắc phục thế nào?',
    options: [
      'Query chạy chậm do thiếu index',
      'Nạp N bản ghi cha rồi mỗi bản ghi lại bắn 1 query lấy quan hệ con ⇒ 1 + N query; khắc phục bằng JOIN FETCH / @EntityGraph / batch fetch',
      'Do dùng quá nhiều transaction',
      'Là tính năng tối ưu của Hibernate',
    ], answer: 1,
    explain: 'N+1: lấy danh sách N entity (1 query), sau đó truy cập quan hệ LAZY của từng entity làm Hibernate bắn thêm N query con. Sửa: JOIN FETCH trong JPQL, @EntityGraph, hoặc @BatchSize để gộp. Đây là câu phỏng vấn backend Java kinh điển.',
  },
  {
    id: 'java-jpa-2', topic: 'JPA / Hibernate',
    q: 'Fetch type LAZY và EAGER khác nhau ra sao?',
    options: [
      'LAZY nạp quan hệ ngay; EAGER nạp khi cần',
      'LAZY chỉ nạp quan hệ KHI truy cập (proxy, tiết kiệm); EAGER nạp NGAY cùng entity cha. Mặc định @OneToMany là LAZY, @ManyToOne là EAGER',
      'Không khác biệt về hiệu năng',
      'EAGER luôn tốt hơn',
    ], answer: 1,
    explain: 'LAZY: hoãn nạp quan hệ tới khi truy cập (nhưng coi chừng LazyInitializationException ngoài session). EAGER: nạp ngay, dễ gây nạp thừa/N+1. Mặc định: *ToMany LAZY, *ToOne EAGER. Thực hành tốt: để LAZY và chủ động JOIN FETCH khi cần.',
  },
  // ---------- Concurrency nâng cao ----------
  {
    id: 'java-con-6', topic: 'Concurrency / synchronized',
    q: 'synchronized hoạt động ở tầng dưới (bytecode/JVM) như thế nào?',
    options: [
      'Dùng cờ boolean trong biến',
      'Dựa trên monitor của object (monitorenter/monitorexit); Mark Word trong object header lưu trạng thái khoá, JVM nâng cấp khoá: không khoá → biased → lightweight (CAS) → heavyweight',
      'Gọi thẳng OS mutex mỗi lần',
      'Chỉ là gợi ý cho compiler',
    ], answer: 1,
    explain: 'synchronized biên dịch thành monitorenter/monitorexit (hoặc cờ ACC_SYNCHRONIZED cho method). Mỗi object có monitor; trạng thái khoá lưu ở Mark Word (object header). JVM tối ưu bằng lock escalation: biased lock (1 thread) → lightweight (CAS, ít tranh chấp) → heavyweight (OS mutex, tranh chấp cao). Từ Java 6+ nên synchronized không còn “chậm” như xưa.',
  },
  {
    id: 'java-con-7', topic: 'Concurrency / Lock',
    q: 'ReentrantLock cho gì mà synchronized không có?',
    options: [
      'Không có gì khác',
      'tryLock (không chặn/timeout), lockInterruptibly (chờ có thể ngắt), khoá công bằng (fair), nhiều Condition; nhưng PHẢI unlock trong finally (synchronized tự nhả)',
      'Tự động unlock, synchronized thì không',
      'Chỉ dùng được 1 thread',
    ], answer: 1,
    explain: 'ReentrantLock (AQS) linh hoạt hơn: tryLock()/tryLock(timeout) tránh chặn vô hạn, lockInterruptibly() cho phép ngắt khi chờ, fair lock theo thứ tự, và nhiều Condition (await/signal riêng). Đổi lại phải nhớ unlock() trong finally. synchronized đơn giản, tự nhả khi rời block, JVM tối ưu sẵn — dùng khi không cần các tính năng trên.',
  },
  {
    id: 'java-con-8', topic: 'Concurrency / ThreadPool',
    q: 'Khi submit task vào ThreadPoolExecutor, thứ tự xử lý là?',
    options: [
      'Luôn tạo thread mới ngay',
      'corePoolSize chưa đầy → tạo core thread; đầy → vào hàng đợi (workQueue); hàng đợi đầy → tạo tới maximumPoolSize; vẫn đầy → RejectedExecutionHandler',
      'Đưa hết vào hàng đợi rồi mới tạo thread',
      'Ngẫu nhiên',
    ], answer: 1,
    explain: 'Luồng: (1) < core → tạo core thread; (2) core đầy → đẩy vào workQueue; (3) queue đầy → tạo thêm thread tới max; (4) max + queue đầy → chạy chính sách từ chối (AbortPolicy ném exception, CallerRunsPolicy chạy ở thread gọi, Discard/DiscardOldest bỏ task). Hiểu 7 tham số + thứ tự này là câu ThreadPool kinh điển. TRÁNH Executors.newFixedThreadPool (queue vô hạn dễ OOM) — tự tạo ThreadPoolExecutor với queue có giới hạn.',
  },
  {
    id: 'java-con-9', topic: 'Concurrency / CAS',
    q: 'CAS (Compare-And-Swap) là gì và gặp vấn đề ABA như thế nào?',
    options: [
      'CAS là một loại khoá bi quan',
      'CAS = so sánh giá trị hiện tại với kỳ vọng, nếu khớp thì cập nhật (nguyên tử, không khoá); vấn đề ABA: giá trị đổi A→B→A khiến CAS tưởng chưa đổi — giải quyết bằng version/stamp (AtomicStampedReference)',
      'CAS luôn chặn thread',
      'ABA là tên một thuật toán GC',
    ], answer: 1,
    explain: 'CAS là lệnh phần cứng nguyên tử, nền tảng của Atomic* và AQS (lock-free, lạc quan). Nhược điểm: (1) ABA — biến bị đổi rồi đổi lại giá trị cũ, CAS không phát hiện → dùng AtomicStampedReference (thêm version); (2) spin lâu tốn CPU khi tranh chấp cao; (3) chỉ đảm bảo 1 biến.',
  },
  {
    id: 'java-con-10', topic: 'Concurrency / Deadlock',
    q: 'Bốn điều kiện cần để xảy ra deadlock (bế tắc) là gì?',
    options: [
      'Chỉ cần 2 thread là deadlock',
      'Loại trừ lẫn nhau (mutual exclusion), giữ và chờ (hold-and-wait), không thể tước đoạt (no preemption), và chờ vòng tròn (circular wait) — phá 1 điều kiện là hết deadlock',
      'Chỉ xảy ra khi thiếu bộ nhớ',
      'Do không dùng volatile',
    ], answer: 1,
    explain: 'Deadlock cần đồng thời 4 điều kiện Coffman: mutual exclusion, hold-and-wait, no preemption, circular wait. Phá 1 điều kiện là tránh được — phổ biến nhất: luôn lấy khoá theo MỘT THỨ TỰ cố định (phá circular wait), hoặc dùng tryLock có timeout (phá hold-and-wait).',
  },
  // ---------- JVM chuyên sâu ----------
  {
    id: 'java-jvm-1', topic: 'JVM / Class loading',
    q: 'Quá trình nạp một class (class loading) gồm các bước nào theo thứ tự?',
    options: [
      'Chỉ có 1 bước: đọc file .class',
      'Loading (nạp bytecode) → Linking (Verification → Preparation: cấp bộ nhớ + giá trị mặc định cho static → Resolution: phân giải tham chiếu) → Initialization (chạy static block + gán giá trị static)',
      'Compile → Run → GC',
      'Load → Delete → Reload',
    ], answer: 1,
    explain: 'Class loading: Loading (tìm & nạp bytecode, tạo Class object) → Linking gồm Verification (kiểm bytecode hợp lệ), Preparation (cấp bộ nhớ cho static, gán giá trị MẶC ĐỊNH 0/null), Resolution (phân giải symbolic reference) → Initialization (thực thi <clinit>: static block + khởi tạo static thật). Class chỉ được init khi lần đầu dùng (lazy).',
  },
  {
    id: 'java-jvm-2', topic: 'JVM / ClassLoader',
    q: 'Mô hình “parent delegation” (song thân uỷ nhiệm) của ClassLoader là gì và để làm gì?',
    options: [
      'ClassLoader con luôn tự nạp trước',
      'Khi nạp class, loader UỶ THÁC LÊN loader cha trước; cha không nạp được mới tới con — bảo vệ class lõi (vd java.lang.String không bị class giả mạo thay thế) & tránh nạp trùng',
      'Nạp song song bằng nhiều thread',
      'Mô hình chỉ có trên Android',
    ], answer: 1,
    explain: 'Parent delegation: Application → Extension/Platform → Bootstrap. Loader con hỏi cha trước; cha nạp được thì dùng của cha. Nhờ vậy các class lõi (java.*) luôn do Bootstrap nạp, một class chỉ nạp 1 lần, và người dùng không thể thay java.lang.Object bằng bản giả (an toàn). Tomcat/OSGi phá vỡ mô hình này có chủ đích để cô lập ứng dụng.',
  },
  {
    id: 'java-jvm-3', topic: 'JVM / GC',
    q: 'Ba thuật toán GC nền tảng và nhược điểm chính của mỗi loại?',
    options: [
      'Chỉ có một thuật toán duy nhất',
      'Mark-Sweep (đánh dấu-xoá: sinh phân mảnh); Copying (sao chép: tốn nửa bộ nhớ nhưng không phân mảnh); Mark-Compact (đánh dấu-nén: không phân mảnh nhưng chậm hơn do di chuyển)',
      'Reference counting là thuật toán chính của JVM',
      'Cả ba đều giống hệt nhau',
    ], answer: 1,
    explain: 'Mark-Sweep: đánh dấu object sống rồi xoá object chết → nhanh nhưng để lại phân mảnh. Copying: chia đôi vùng, chép object sống sang nửa kia → không phân mảnh, phù hợp Young (đa số chết trẻ) nhưng lãng phí 50%. Mark-Compact: đánh dấu rồi dồn object sống về một đầu → không phân mảnh, hợp Old nhưng tốn công di chuyển. JVM dùng generational: Young=Copying, Old=Mark-Compact. Java KHÔNG dùng reference counting (không xử lý được vòng tham chiếu).',
  },
  {
    id: 'java-jvm-4', topic: 'JVM / Reference',
    q: 'Bốn loại tham chiếu (strong/soft/weak/phantom) khác nhau về cách GC xử lý ra sao?',
    options: [
      'Tất cả đều bị thu hồi ngay',
      'Strong: không bao giờ bị thu khi còn tham chiếu (dễ gây leak). Soft: thu khi SẮP hết bộ nhớ (hợp cho cache). Weak: thu ở lần GC KẾ TIẾP (WeakHashMap). Phantom: đã bị thu, dùng để nhận thông báo dọn dẹp',
      'Chỉ khác nhau về cú pháp',
      'Weak mạnh hơn Strong',
    ], answer: 1,
    explain: 'Strong (mặc định): GC không đụng khi còn được trỏ. SoftReference: giữ lại đến khi gần OOM mới thu → cache nhạy bộ nhớ. WeakReference: thu ngay lần GC tới → WeakHashMap, tránh leak. PhantomReference: không lấy được object, dùng cùng ReferenceQueue để làm dọn dẹp thay finalize. Hiểu 4 loại này liên quan trực tiếp tới rò rỉ bộ nhớ.',
  },
  {
    id: 'java-jvm-5', topic: 'JVM / bộ nhớ',
    q: 'Memory leak và memory overflow (OutOfMemoryError) trong Java khác nhau thế nào?',
    options: [
      'Giống nhau hoàn toàn',
      'Leak: object không còn dùng nhưng vẫn bị tham chiếu nên GC không thu (tích tụ dần); Overflow (OOM): bộ nhớ thực sự không đủ để cấp phát — leak kéo dài thường DẪN ĐẾN OOM',
      'Overflow xảy ra khi CPU quá tải',
      'Leak chỉ xảy ra ở C++, không có ở Java',
    ], answer: 1,
    explain: 'Memory leak: vẫn còn tham chiếu tới object không dùng nữa (static collection phình mãi, ThreadLocal không remove, listener không gỡ…) → GC không thu được, bộ nhớ tăng dần. OOM: JVM không cấp nổi bộ nhớ nữa (java.lang.OutOfMemoryError: Java heap space). Leak tích tụ lâu ngày thường là NGUYÊN NHÂN gây OOM; điều tra bằng heap dump + phân tích (MAT, jmap).',
  },
  // ---------- Design Pattern ----------
  {
    id: 'java-dp-singleton', topic: 'Design Pattern / Singleton',
    q: 'Cách hiện thực Singleton an toàn thread mà đơn giản & chống reflection/serialization tốt nhất?',
    code: 'public enum Config { INSTANCE; ... }',
    options: [
      'Tạo mới mỗi lần getInstance()',
      'Dùng ENUM (Effective Java): JVM đảm bảo 1 instance, an toàn thread sẵn, miễn nhiễm reflection & serialization phá singleton',
      'Biến static không cần đồng bộ',
      'Chỉ có double-check locking là đúng',
    ], answer: 1,
    explain: 'Các cách: (1) eager static (đơn giản, tạo sớm dù chưa dùng); (2) double-check locking cần biến volatile để tránh half-initialized object do reorder; (3) static inner holder (lazy + thread-safe nhờ class loading); (4) ENUM — Josh Bloch khuyên: ngắn gọn, an toàn thread, chống cả reflection lẫn deserialization tạo instance thứ hai. Double-check thiếu volatile là bug kinh điển.',
  },
  {
    id: 'java-dp-factory', topic: 'Design Pattern / Factory',
    q: 'Factory Method pattern giải quyết vấn đề gì?',
    options: [
      'Tạo nhiều thread',
      'Đóng gói việc KHỞI TẠO object sau một method/interface → client không cần biết class cụ thể, dễ mở rộng loại mới mà không sửa code gọi (tuân Open/Closed)',
      'Xoá object tự động',
      'Sắp xếp collection',
    ], answer: 1,
    explain: 'Factory Method tách logic tạo object khỏi nơi sử dụng: client gọi factory.create(type) thay vì new cụ thể. Thêm loại sản phẩm mới chỉ cần thêm class + nhánh factory, không sửa client (Open/Closed). Ví dụ thực tế: Calendar.getInstance(), LoggerFactory.getLogger(), BeanFactory của Spring. Abstract Factory là bản mở rộng tạo “họ” object liên quan.',
  },
  {
    id: 'java-dp-proxy', topic: 'Design Pattern / Proxy',
    q: 'Dynamic proxy trong Java (nền tảng của Spring AOP) hoạt động thế nào?',
    options: [
      'Sửa trực tiếp bytecode lúc biên dịch',
      'JDK dynamic proxy tạo proxy lúc RUNTIME cho object implements INTERFACE (java.lang.reflect.Proxy + InvocationHandler); nếu không có interface, Spring dùng CGLIB (kế thừa class)',
      'Chỉ hoạt động với class final',
      'Proxy phải viết tay từng method',
    ], answer: 1,
    explain: 'Proxy bọc object thật để chèn hành vi (log, transaction, security) trước/sau khi gọi. JDK dynamic proxy: Proxy.newProxyInstance() tạo lớp proxy runtime cho các INTERFACE, mọi lời gọi đi qua InvocationHandler.invoke(). Nếu bean không có interface → Spring dùng CGLIB (sinh lớp con, override method) — vì thế method final/private/ hoặc gọi nội bộ this.method() KHÔNG được AOP proxy chặn. Đây là gốc của @Transactional/@Async self-invocation không hiệu lực.',
  },
  {
    id: 'java-dp-strategy', topic: 'Design Pattern / Strategy',
    q: 'Strategy pattern dùng khi nào?',
    options: [
      'Khi cần đúng một thuật toán cố định',
      'Khi có NHIỀU thuật toán/hành vi thay thế nhau: đóng mỗi cái vào một class cùng interface, chọn lúc runtime — thay if/else-switch dài bằng đa hình',
      'Khi cần tạo singleton',
      'Khi cần sao chép object',
    ], answer: 1,
    explain: 'Strategy: định nghĩa họ thuật toán cùng interface (vd PaymentStrategy: Momo/VNPay/Card), context giữ 1 strategy và uỷ quyền. Lợi ích: thêm thuật toán mới không sửa context (Open/Closed), loại bỏ chuỗi if/else-switch khổng lồ, dễ test từng chiến lược. Trong Spring hay tiêm Map<String, Strategy> để chọn theo key.',
  },
  {
    id: 'java-dp-template', topic: 'Design Pattern / Template Method',
    q: 'Template Method pattern là gì?',
    options: [
      'Một loại generic',
      'Lớp cha định nghĩa KHUNG (thứ tự các bước) trong một method final; các bước cụ thể để lớp con override — “khung cố định, chi tiết tuỳ biến”',
      'Tạo object từ template string',
      'Sao chép method giữa class',
    ], answer: 1,
    explain: 'Template Method: method khung (thường final) trong lớp cha gọi các bước theo thứ tự cố định; bước thay đổi được khai abstract/hook cho lớp con hiện thực. Ví dụ: JdbcTemplate, HttpServlet.service() gọi doGet/doPost, khung xử lý request của Spring. Đảo control: “đừng gọi chúng tôi, chúng tôi sẽ gọi bạn” (Hollywood principle).',
  },
  {
    id: 'java-dp-builder', topic: 'Design Pattern / Builder',
    q: 'Builder pattern giải quyết vấn đề gì?',
    code: 'User u = User.builder().name("Hai").age(28).build();',
    options: [
      'Tạo nhiều instance cùng lúc',
      'Xây object có NHIỀU tham số (nhất là optional) một cách dễ đọc & bất biến — tránh “telescoping constructor” và setter làm object mutable',
      'Tự động sinh getter',
      'Khoá object khi tạo',
    ], answer: 1,
    explain: 'Builder: chuỗi method .field(value)...build() để dựng object nhiều tham số, đặc biệt khi nhiều tham số tuỳ chọn. Thay cho constructor lồng nhau khó đọc (telescoping) hoặc setter khiến object mutable/không nhất quán. Kết quả thường immutable. Lombok @Builder, StringBuilder, Stream.Builder, HttpRequest.newBuilder() là ví dụ.',
  },
  {
    id: 'java-dp-observer', topic: 'Design Pattern / Observer',
    q: 'Observer pattern (publish-subscribe) dùng để làm gì?',
    options: [
      'Giám sát bộ nhớ JVM',
      'Khi một object (subject) đổi trạng thái thì TỰ ĐỘNG thông báo mọi observer đã đăng ký — tách rời bên phát và bên nhận (event-driven)',
      'Đồng bộ hoá thread',
      'Nén dữ liệu',
    ], answer: 1,
    explain: 'Observer: subject giữ danh sách observer; khi state đổi thì gọi update() lên từng observer — loose coupling giữa nơi phát sự kiện và nơi xử lý. Ví dụ: Spring ApplicationEvent/@EventListener, listener UI, message/event bus. Là nền của kiến trúc hướng sự kiện. Lưu ý gỡ đăng ký (unregister) để tránh memory leak.',
  },
];
