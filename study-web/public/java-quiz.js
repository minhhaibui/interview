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
      'Cả hai đều nằm trên heap, do JVM cấp phát khi tạo object',
      'Biến cục bộ nằm trên stack; object mà nó trỏ tới nằm trên heap',
      'Cả hai đều nằm trên stack của thread đang thực thi method',
      'Biến cục bộ nằm ở metaspace, còn object thì nằm trên stack',
    ], answer: 1,
    explain: 'Mỗi thread có stack riêng chứa các stack frame (biến cục bộ, tham chiếu). Object thật luôn nằm trên HEAP (chia sẻ giữa các thread). Metaspace (Java 8+, thay PermGen) chứa metadata của class, không chứa object thường.',
  },
  {
    id: 'java-mem-2', topic: 'JVM / bộ nhớ',
    q: 'Java 8 thay PermGen bằng gì và khác biệt quan trọng nhất là?',
    options: [
      'Metaspace — nằm ở native memory, không bị giới hạn bởi -Xmx',
      'Young Generation — nằm trong heap nên được GC dọn thường xuyên',
      'Stack của từng thread — giúp nạp class nhanh hơn hẳn PermGen',
      'Không thay gì cả, chỉ đổi tên PermGen cho khớp chuẩn mới',
    ], answer: 0,
    explain: 'PermGen (heap, kích thước cố định, dễ OutOfMemoryError: PermGen space) được thay bằng Metaspace nằm ở NATIVE memory, mặc định tự lớn theo nhu cầu (giới hạn bởi -XX:MaxMetaspaceSize). Giảm hẳn lỗi PermGen khi nạp nhiều class.',
  },
  {
    id: 'java-gc-1', topic: 'Garbage Collection',
    q: 'Vì sao GC của Java chia heap thành Young và Old generation (generational GC)?',
    options: [
      'Để GC dễ chạy đa luồng hơn khi quét các vùng nhớ song song',
      'Vì phần lớn object "chết trẻ" — quét Young thường xuyên & rẻ',
      'Để tách object theo kiểu dữ liệu, mỗi vùng chứa một loại riêng',
      'Để không bao giờ phải nén (compact) lại bộ nhớ sau khi dọn',
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
      'Chỉ để tiết kiệm bộ nhớ, ngoài ra không có lý do nào khác',
      'An toàn thread, cache hashCode, làm key HashMap, dùng String pool',
      'Vì String kế thừa từ StringBuilder nên không tự sửa nội dung',
      'Để String luôn được cấp phát trên stack thay vì trên heap',
    ], answer: 1,
    explain: 'Bất biến giúp: (1) thread-safe không cần đồng bộ; (2) hashCode tính 1 lần rồi cache; (3) dùng làm key Map an toàn (không đổi sau khi put); (4) String pool chia sẻ được literal. Muốn nối nhiều chuỗi trong vòng lặp → dùng StringBuilder để tránh tạo rác.',
  },
  // ---------- equals / hashCode ----------
  {
    id: 'java-eq-1', topic: 'equals / hashCode',
    q: 'Bạn override equals() nhưng QUÊN override hashCode(). Hậu quả nghiêm trọng nhất?',
    options: [
      'Code sẽ không biên dịch được vì compiler bắt override cả hai',
      'Object bằng nhau rơi vào bucket khác nhau ⇒ HashMap tra sai',
      'Chương trình chạy chậm hơn nhưng kết quả trả về vẫn luôn đúng',
      'equals() bị JVM vô hiệu hoá, quay về so sánh theo tham chiếu',
    ], answer: 1,
    explain: 'Hợp đồng: a.equals(b) == true ⇒ a.hashCode() == b.hashCode(). Nếu vi phạm, HashMap đặt 2 object “bằng nhau” vào bucket khác nhau, get() không tìm ra. Luôn override CẢ HAI cùng nhau, dùng cùng tập trường.',
  },
  {
    id: 'java-eq-2', topic: 'equals / hashCode',
    q: 'hashCode() của 2 object khác nhau có bắt buộc phải khác nhau không?',
    options: [
      'Có, hai object khác nhau mà trùng hashCode là một bug nặng',
      'Không — khác nhau VẪN có thể trùng hashCode (collision)',
      'Có, JVM đảm bảo mỗi object một hashCode duy nhất tuyệt đối',
      'Chỉ khác nhau khi lập trình viên tự override hashCode()',
    ], answer: 1,
    explain: 'hashCode không cần duy nhất — va chạm (collision) là hợp lệ và bình thường (HashMap xử lý bằng chuỗi/cây trong bucket). Ràng buộc một chiều: bằng nhau ⇒ cùng hashCode; điều ngược lại KHÔNG bắt buộc.',
  },
  // ---------- Collections ----------
  {
    id: 'java-col-1', topic: 'Collections / HashMap',
    q: 'HashMap trong Java 8+ xử lý bucket có quá nhiều va chạm như thế nào?',
    options: [
      'Luôn giữ danh sách liên kết, chỉ nới rộng bảng khi quá tải',
      'Bucket ≥ 8 phần tử (bảng ≥ 64) thì chuyển sang cây đỏ-đen',
      'Tự động nhân đôi giá trị hashCode để giãn key sang bucket khác',
      'Ném ra HashCollisionException để lập trình viên tự xử lý',
    ], answer: 1,
    explain: 'Java 8 tối ưu: bucket bắt đầu là linked list (get O(n) trong bucket). Khi 1 bucket đạt ≥8 nút và capacity ≥64, nó “treeify” thành red-black tree ⇒ O(log n), chống tấn công collision. Dưới ngưỡng lại chuyển về list.',
  },
  {
    id: 'java-col-2', topic: 'Collections',
    q: 'Khác biệt then chốt giữa ArrayList và LinkedList về hiệu năng?',
    options: [
      'ArrayList get(index) O(1); LinkedList chèn/xoá tại node là O(1)',
      'Cả hai đều O(1) cho mọi thao tác vì đều nằm trong bộ nhớ',
      'LinkedList truy cập ngẫu nhiên nhanh hơn nhờ con trỏ hai chiều',
      'ArrayList không cho phép chèn vào giữa, chỉ thêm được vào cuối',
    ], answer: 0,
    explain: 'ArrayList = mảng động: get(i) O(1), nhưng chèn/xoá giữa phải dịch phần tử O(n). LinkedList = danh sách 2 chiều: get(i) phải duyệt O(n), nhưng chèn/xoá khi ĐÃ có tham chiếu node là O(1). Thực tế ArrayList thường nhanh hơn nhờ cache-locality; LinkedList ít khi là lựa chọn tối ưu.',
  },
  {
    id: 'java-col-3', topic: 'Collections',
    q: 'Fail-fast iterator (vd ArrayList) làm gì khi collection bị sửa trong lúc duyệt?',
    options: [
      'Bỏ qua phần tử vừa thêm rồi duyệt tiếp phần còn lại như thường',
      'Ném ConcurrentModificationException (dựa vào biến modCount)',
      'Tự đồng bộ lại nội dung rồi bắt đầu duyệt lại từ đầu danh sách',
      'Trả về null cho các phần tử tiếp theo cho tới khi duyệt xong',
    ], answer: 1,
    explain: 'Iterator kiểm tra modCount; nếu collection bị sửa cấu trúc (add/remove) ngoài iterator trong lúc duyệt → ném ConcurrentModificationException (fail-fast). Muốn xoá an toàn khi duyệt: dùng iterator.remove() hoặc removeIf().',
  },
  {
    id: 'java-col-4', topic: 'Collections',
    q: 'Comparable và Comparator khác nhau chỗ nào?',
    options: [
      'Giống hệt nhau, chỉ khác tên gọi theo phiên bản Java đang dùng',
      'Comparable: thứ tự tự nhiên TRONG class; Comparator: thứ tự NGOÀI',
      'Comparator được cài đặt ngay trong class cần được so sánh',
      'Comparable dùng cho kiểu số, còn Comparator dùng cho chuỗi',
    ], answer: 1,
    explain: 'Comparable<T>: class tự cài compareTo() → 1 thứ tự tự nhiên (vd String, Integer). Comparator<T>: đối tượng so sánh riêng biệt, tạo nhiều cách sắp xếp khác nhau (theo tên, theo tuổi…), truyền vào sort()/TreeMap mà không sửa class gốc.',
  },
  // ---------- Concurrency ----------
  {
    id: 'java-con-1', topic: 'Concurrency',
    q: 'volatile đảm bảo điều gì và KHÔNG đảm bảo điều gì?',
    options: [
      'Đảm bảo cả visibility lẫn atomicity cho mọi thao tác trên biến',
      'Đảm bảo visibility + cấm sắp xếp lại lệnh; KHÔNG đảm bảo i++',
      'Đảm bảo atomicity nhưng không đảm bảo visibility giữa các thread',
      'Chỉ có tác dụng khi biến được khai báo kèm từ khoá static',
    ], answer: 1,
    explain: 'volatile: mọi thread đọc/ghi thẳng main memory (visibility) và tạo happens-before, chặn reorder. Nhưng i++ (đọc-tăng-ghi) vẫn KHÔNG nguyên tử → cần AtomicInteger hoặc synchronized cho đếm an toàn.',
  },
  {
    id: 'java-con-2', topic: 'Concurrency',
    q: 'synchronized và volatile — chọn cái nào cho biến cờ boolean chỉ đọc/ghi đơn giản giữa các thread?',
    options: [
      'volatile — đủ cho ghi/đọc đơn, nhẹ hơn nhiều so với synchronized',
      'synchronized là bắt buộc, dùng volatile ở đây là hoàn toàn sai',
      'Không cần cái nào vì biến boolean vốn đã nguyên tử trong Java',
      'Phải dùng cả hai cùng lúc mới đảm bảo an toàn tuyệt đối',
    ], answer: 0,
    explain: 'Cờ boolean chỉ set true/false (thao tác đơn, không phụ thuộc giá trị cũ) → volatile đủ để đảm bảo visibility, không cần khoá. synchronized cần khi có vùng tới hạn/nhiều biến/thao tác kép (đọc-sửa-ghi) cần loại trừ lẫn nhau.',
  },
  {
    id: 'java-con-3', topic: 'Concurrency',
    q: 'ConcurrentHashMap khác Collections.synchronizedMap(HashMap) ở điểm cốt lõi nào?',
    options: [
      'Không khác gì nhau, cả hai đều khoá toàn bộ map khi ghi',
      'ConcurrentHashMap khoá từng bucket/CAS; synchronizedMap khoá cả map',
      'synchronizedMap nhanh hơn khi có nhiều thread cùng ghi dữ liệu',
      'ConcurrentHashMap không cho nhiều thread truy cập đồng thời',
    ], answer: 1,
    explain: 'synchronizedMap bọc mọi method bằng 1 khoá chung → nghẽn cổ chai khi nhiều thread. ConcurrentHashMap (Java 8) dùng CAS + khoá theo bucket/node → thông lượng ghi song song cao hơn nhiều. Bẫy hay hỏi: ConcurrentHashMap CẤM null key/value (để không nhập nhằng “không có key” vs “value null” khi đa luồng); còn synchronizedMap(HashMap) VẪN cho null vì chỉ bọc khoá quanh HashMap.',
  },
  {
    id: 'java-con-4', topic: 'Concurrency',
    q: 'ThreadLocal dùng để làm gì?',
    options: [
      'Chia sẻ một biến dùng chung giữa tất cả thread trong cùng pool',
      'Mỗi thread giữ một BẢN SAO riêng — nhớ remove() tránh rò rỉ',
      'Khoá biến lại để tại một thời điểm chỉ một thread được dùng',
      'Tạo thread mới và quản lý vòng đời của thread đó tự động',
    ], answer: 1,
    explain: 'ThreadLocal cấp cho mỗi thread một giá trị riêng, tránh chia sẻ trạng thái (vd giữ user context, transaction, hoặc SimpleDateFormat vốn không thread-safe). Trong thread pool phải gọi remove() sau khi dùng, nếu không dễ rò rỉ bộ nhớ vì thread được tái sử dụng.',
  },
  {
    id: 'java-con-5', topic: 'Concurrency',
    q: 'Vì sao nên dùng ExecutorService thay vì tự new Thread() cho mỗi tác vụ?',
    options: [
      'Vì new Thread() cho mỗi tác vụ chạy nhanh hơn do không qua pool',
      'Tái sử dụng thread qua pool, quản lý hàng đợi & lấy kết quả Future',
      'Vì ExecutorService không cần import thêm thư viện bên ngoài',
      'Không có khác biệt, ExecutorService chỉ là cách viết gọn hơn',
    ], answer: 1,
    explain: 'Tạo thread rất tốn kém; tạo bừa dễ cạn tài nguyên. ExecutorService (thread pool) tái dùng thread, chặn quá tải bằng hàng đợi + giới hạn kích thước, trả Future/CompletableFuture để lấy kết quả, và shutdown gọn gàng. Đây là chuẩn cho code production.',
  },
  // ---------- Generics ----------
  {
    id: 'java-gen-1', topic: 'Generics',
    q: 'Type erasure trong Java generics nghĩa là gì?',
    options: [
      'Kiểu generic được JVM kiểm tra lại một lần nữa lúc runtime',
      'Thông tin generic bị XOÁ sau biên dịch — runtime chỉ còn List',
      'Compiler sinh ra một class riêng cho mỗi kiểu tham số được dùng',
      'Erasure xoá luôn object khỏi bộ nhớ khi hết phạm vi sử dụng',
    ], answer: 1,
    explain: 'Generics chỉ để kiểm tra kiểu lúc biên dịch; sau đó kiểu bị “xoá” (erasure) về raw type + chèn cast. Hệ quả: không new T[], không instanceof List<String>, và List<String>/List<Integer> cùng là List.class lúc runtime.',
  },
  {
    id: 'java-gen-2', topic: 'Generics',
    q: 'Nguyên tắc PECS (Producer Extends, Consumer Super) — dùng ? extends T khi nào?',
    options: [
      'Khi bạn cần GHI phần tử vào collection đó một cách an toàn',
      'Khi chỉ ĐỌC (producer); dùng ? super T khi GHI vào (consumer)',
      'Luôn dùng extends cho mọi trường hợp cho đơn giản và an toàn',
      'extends và super giống nhau, chỉ khác cách đọc cho dễ hiểu',
    ], answer: 1,
    explain: 'PECS: nếu chỉ lấy dữ liệu RA (producer) → List<? extends T> (đọc an toàn thành T). Nếu chỉ bỏ dữ liệu VÀO (consumer) → List<? super T> (ghi T an toàn). Ví dụ Collections.copy(dest super, src extends).',
  },
  // ---------- Exception ----------
  {
    id: 'java-exc-1', topic: 'Exception',
    q: 'Checked exception và unchecked exception (RuntimeException) khác nhau ra sao?',
    options: [
      'Không khác gì nhau, chỉ khác vị trí trong cây kế thừa Throwable',
      'Checked BẮT BUỘC catch/throws lúc biên dịch; unchecked thì không',
      'Unchecked bắt buộc phải catch, còn checked thì tuỳ lập trình viên',
      'Checked xảy ra lúc runtime, còn unchecked xảy ra lúc biên dịch',
    ], answer: 1,
    explain: 'Checked (kế thừa Exception, trừ RuntimeException) — compiler ép xử lý (catch/throws), dùng cho lỗi có thể phục hồi (IO, SQL). Unchecked (RuntimeException: NPE, IllegalArgument…) — lỗi lập trình, không ép khai báo. Error (OOM, StackOverflow) thường không nên bắt.',
  },
  {
    id: 'java-exc-2', topic: 'Exception',
    q: 'try-with-resources (Java 7+) giải quyết vấn đề gì?',
    code: 'try (var in = new FileInputStream("f")) {\n  // dùng in\n}',
    options: [
      'Tự động bắt mọi exception trong khối try mà khỏi cần viết catch',
      'Tự gọi close() trên AutoCloseable khi rời try, kể cả khi có lỗi',
      'Tăng tốc đọc/ghi file nhờ tự động dùng buffer ở phía dưới',
      'Chỉ hoạt động với String và các kiểu dữ liệu nguyên thuỷ',
    ], answer: 1,
    explain: 'Resource khai trong try(...) phải implements AutoCloseable; JVM tự gọi close() theo thứ tự ngược khi rời khối (dù thành công hay ném exception). Thay cho finally { in.close(); } dài dòng và dễ quên, đồng thời xử lý suppressed exception đúng.',
  },
  {
    id: 'java-exc-3', topic: 'Exception',
    q: 'final, finally và finalize khác nhau thế nào?',
    options: [
      'Ba từ khoá đồng nghĩa, chọn cái nào cũng cho kết quả như nhau',
      'final = hằng/không override; finally = luôn chạy; finalize = GC gọi',
      'finally là từ khoá khai báo biến hằng không thể gán lại giá trị',
      'finalize() chạy trước khối try để chuẩn bị tài nguyên cần dùng',
    ], answer: 1,
    explain: 'final: biến bất biến, method không override được, class không kế thừa được. finally: khối chạy dù try thành công hay ném lỗi (dọn tài nguyên). finalize(): method Object được GC gọi trước khi dọn object — không đảm bảo thời điểm, đã deprecated (Java 9+), tránh dùng.',
  },
  // ---------- Java 8+ ----------
  {
    id: 'java-s8-1', topic: 'Java 8+ / Stream',
    q: 'Stream trong Java là “lazy”. Điều đó nghĩa là gì?',
    options: [
      'Stream tự động chạy trên một thread nền để không chặn main',
      'map/filter chỉ chạy KHI có thao tác kết thúc (collect/forEach)',
      'Stream nạp toàn bộ dữ liệu vào bộ nhớ trước rồi mới bắt đầu xử lý',
      'Lazy nghĩa là stream chạy chậm hơn vòng lặp for thông thường',
    ], answer: 1,
    explain: 'Intermediate ops (map, filter, sorted) trả về Stream mới nhưng CHƯA chạy; chỉ khi gặp terminal op (collect, reduce, findFirst…) pipeline mới thực thi. Nhờ lazy, JVM gộp bước, xử lý theo phần tử và short-circuit (findFirst, limit) không duyệt thừa.',
  },
  {
    id: 'java-s8-2', topic: 'Java 8+ / Optional',
    q: 'Cách dùng Optional nào ĐÚNG tinh thần thiết kế?',
    code: 'Optional<User> u = repo.findById(id);',
    options: [
      'Gọi u.get() ngay để lấy giá trị vì Optional luôn có dữ liệu',
      'u.map(User::getName).orElse("(không rõ)") — xử lý cả khi rỗng',
      'Kiểm tra if (u != null) trước vì Optional vẫn có thể là null',
      'Dùng Optional làm field của entity và làm tham số của method',
    ], answer: 1,
    explain: 'Optional để biểu thị “có thể vắng” ở giá trị TRẢ VỀ, buộc caller xử lý rỗng. Nên dùng map/filter/orElse/orElseThrow thay vì get() mù. Tránh: get() không kiểm tra (ném NoSuchElement), dùng Optional cho field/tham số, hay so sánh với null.',
  },
  {
    id: 'java-s8-3', topic: 'Java 8+ / Functional',
    q: 'Functional interface là gì và @FunctionalInterface để làm gì?',
    options: [
      'Là interface có nhiều abstract method để lambda chọn method dùng',
      'Interface có ĐÚNG MỘT abstract method (SAM) — dùng được lambda',
      'Là interface không có method nào, chỉ dùng để đánh dấu kiểu',
      'Là một loại class đặc biệt được Java giới thiệu từ phiên bản 8',
    ], answer: 1,
    explain: 'Functional interface = 1 abstract method duy nhất (Runnable, Comparator, Function, Predicate…), cho phép gán lambda/method reference. @FunctionalInterface không bắt buộc nhưng giúp compiler báo lỗi nếu vô tình thêm abstract method thứ hai. (default/static method không tính.)',
  },
  // ---------- OOP ----------
  {
    id: 'java-oop-1', topic: 'OOP',
    q: 'Overloading và overriding khác nhau chỗ nào?',
    options: [
      'Giống nhau, đều là việc định nghĩa lại một method đã có sẵn',
      'Overloading quyết định lúc COMPILE; overriding lúc RUNTIME',
      'Overriding xảy ra trong cùng một class với tham số khác nhau',
      'Overloading bắt buộc phải có annotation @Override ở phía trên',
    ], answer: 1,
    explain: 'Overloading: cùng tên, khác danh sách tham số, trong cùng class; compiler chọn theo kiểu tĩnh (compile-time). Overriding: lớp con viết lại method của lớp cha cùng chữ ký; JVM chọn theo kiểu THỰC của object lúc runtime (đa hình). @Override chỉ áp cho overriding.',
  },
  {
    id: 'java-oop-2', topic: 'OOP',
    q: 'Khi nào chọn abstract class thay vì interface (Java 8+)?',
    options: [
      'Luôn chọn abstract class vì nó mạnh hơn interface về mọi mặt',
      'Abstract class khi cần state/constructor; interface cho đa hành vi',
      'Interface không được phép có method nên chỉ dùng để đánh dấu',
      'Từ Java 8 hai thứ như nhau nên chọn cái nào cũng được cả',
    ], answer: 1,
    explain: 'Abstract class: có field/constructor/trạng thái, chia sẻ code, nhưng chỉ kế thừa 1. Interface: một class implements NHIỀU interface (đa kế thừa hợp đồng), có default/static method từ Java 8 nhưng không giữ state (chỉ constant). Ưu tiên interface cho tính linh hoạt, abstract class khi cần trạng thái/khởi tạo chung.',
  },
  // ---------- Spring / JPA ----------
  {
    id: 'java-spring-1', topic: 'Spring',
    q: 'Dependency Injection (DI) trong Spring giải quyết vấn đề gì?',
    options: [
      'Tăng tốc độ chạy nhờ khởi tạo sẵn mọi object lúc ứng dụng lên',
      'IoC: container tạo & tiêm dependency → dễ test, giảm coupling',
      'Tự động sinh câu SQL cho tầng repository mà không cần viết tay',
      'Nén file jar lại để ứng dụng khởi động nhanh hơn khi deploy',
    ], answer: 1,
    explain: 'Thay vì đối tượng tự khởi tạo dependency (coupling chặt, khó test), Spring container quản lý vòng đời bean và tiêm dependency (qua constructor/field/setter). Lợi ích: dễ thay/mock khi test, cấu hình tập trung, giảm phụ thuộc cụ thể. Ưu tiên constructor injection.',
  },
  {
    id: 'java-spring-2', topic: 'Spring',
    q: 'Scope mặc định của một Spring bean là gì?',
    options: [
      'prototype — mỗi lần lấy bean là một instance hoàn toàn mới',
      'singleton — một instance dùng chung, nên bean phải stateless',
      'request — mỗi HTTP request được cấp một instance riêng biệt',
      'session — mỗi phiên đăng nhập của user giữ một instance riêng',
    ], answer: 1,
    explain: 'Mặc định bean là singleton: container tạo 1 instance và chia sẻ mọi nơi inject. Vì dùng chung giữa các request/thread nên bean nên STATELESS (không giữ trạng thái mutable). Cần instance mới mỗi lần → scope prototype; theo web request/session → request/session.',
  },
  {
    id: 'java-spring-3', topic: 'Spring / Transaction',
    q: '@Transactional với propagation REQUIRES_NEW khác REQUIRED (mặc định) ra sao?',
    options: [
      'Giống nhau, REQUIRES_NEW chỉ là bí danh cũ của REQUIRED',
      'REQUIRED tham gia transaction đang có; REQUIRES_NEW luôn mở mới',
      'REQUIRES_NEW không bao giờ commit mà chỉ đọc dữ liệu tạm thời',
      'REQUIRED luôn tạo một transaction mới cho mỗi lần gọi method',
    ], answer: 1,
    explain: 'REQUIRED (mặc định): nếu đang có transaction thì dùng chung; chưa có thì tạo. REQUIRES_NEW: luôn treo transaction hiện tại và bắt đầu transaction độc lập — hữu ích khi cần ghi log/audit commit riêng dù transaction cha rollback. Lưu ý @Transactional qua proxy: gọi nội bộ cùng class sẽ không kích hoạt.',
  },
  {
    id: 'java-jpa-1', topic: 'JPA / Hibernate',
    q: 'Vấn đề N+1 query trong JPA là gì và khắc phục thế nào?',
    options: [
      'Query chạy chậm do bảng còn thiếu index cho cột khoá ngoại',
      'Nạp N cha rồi mỗi cha bắn 1 query con; sửa bằng JOIN FETCH',
      'Do mở quá nhiều transaction lồng nhau trong cùng một request',
      'Là tính năng tối ưu của Hibernate để chia nhỏ query quá lớn',
    ], answer: 1,
    explain: 'N+1: lấy danh sách N entity (1 query), sau đó truy cập quan hệ LAZY của từng entity làm Hibernate bắn thêm N query con. Sửa: JOIN FETCH trong JPQL, @EntityGraph, hoặc @BatchSize để gộp. Đây là câu phỏng vấn backend Java kinh điển.',
  },
  {
    id: 'java-jpa-2', topic: 'JPA / Hibernate',
    q: 'Fetch type LAZY và EAGER khác nhau ra sao?',
    options: [
      'LAZY nạp quan hệ ngay lập tức; EAGER chỉ nạp khi thực sự cần',
      'LAZY nạp khi truy cập (proxy); EAGER nạp ngay cùng entity cha',
      'Không có khác biệt hiệu năng, chỉ khác cách viết annotation',
      'EAGER luôn tốt hơn vì tránh được LazyInitializationException',
    ], answer: 1,
    explain: 'LAZY: hoãn nạp quan hệ tới khi truy cập (nhưng coi chừng LazyInitializationException ngoài session). EAGER: nạp ngay, dễ gây nạp thừa/N+1. Mặc định: *ToMany LAZY, *ToOne EAGER. Thực hành tốt: để LAZY và chủ động JOIN FETCH khi cần.',
  },
  // ---------- Concurrency nâng cao ----------
  {
    id: 'java-con-6', topic: 'Concurrency / synchronized',
    q: 'synchronized hoạt động ở tầng dưới (bytecode/JVM) như thế nào?',
    options: [
      'Dùng một biến cờ boolean ẩn bên trong mỗi object để đánh dấu',
      'Dựa trên monitor: biased → lightweight (CAS) → heavyweight',
      'Gọi thẳng mutex của hệ điều hành cho mỗi lần vào khối lệnh',
      'Chỉ là gợi ý cho compiler tối ưu, JVM không đảm bảo gì thêm',
    ], answer: 1,
    explain: 'synchronized biên dịch thành monitorenter/monitorexit (hoặc cờ ACC_SYNCHRONIZED cho method). Mỗi object có monitor; trạng thái khoá lưu ở Mark Word (object header). JVM tối ưu bằng lock escalation: biased lock (1 thread) → lightweight (CAS, ít tranh chấp) → heavyweight (OS mutex, tranh chấp cao). Từ Java 6+ nên synchronized không còn “chậm” như xưa. (Lưu ý cập nhật: biased locking đã bị TẮT mặc định từ Java 15 và GỠ BỎ ở Java 18 — trên JVM mới chuỗi thực tế là lightweight → heavyweight.)',
  },
  {
    id: 'java-con-7', topic: 'Concurrency / Lock',
    q: 'ReentrantLock cho gì mà synchronized không có?',
    options: [
      'Không có gì khác, chỉ là cách viết khác của cùng một cơ chế',
      'tryLock, lockInterruptibly, fair lock, Condition — unlock ở finally',
      'Tự động unlock khi rời khối, còn synchronized thì phải gọi tay',
      'Chỉ cho phép đúng một thread duy nhất dùng trong cả vòng đời',
    ], answer: 1,
    explain: 'ReentrantLock (AQS) linh hoạt hơn: tryLock()/tryLock(timeout) tránh chặn vô hạn, lockInterruptibly() cho phép ngắt khi chờ, fair lock theo thứ tự, và nhiều Condition (await/signal riêng). Đổi lại phải nhớ unlock() trong finally. synchronized đơn giản, tự nhả khi rời block, JVM tối ưu sẵn — dùng khi không cần các tính năng trên.',
  },
  {
    id: 'java-con-8', topic: 'Concurrency / ThreadPool',
    q: 'Khi submit task vào ThreadPoolExecutor, thứ tự xử lý là?',
    options: [
      'Luôn tạo thread mới ngay cho tới khi chạm maximumPoolSize',
      'Đầy core → vào hàng đợi → đầy queue → tăng tới max → reject',
      'Đưa hết task vào hàng đợi trước, hết queue mới tạo core thread',
      'Chọn ngẫu nhiên giữa việc tạo thread mới và xếp vào hàng đợi',
    ], answer: 1,
    explain: 'Luồng: (1) < core → tạo core thread; (2) core đầy → đẩy vào workQueue; (3) queue đầy → tạo thêm thread tới max; (4) max + queue đầy → chạy chính sách từ chối (AbortPolicy ném exception, CallerRunsPolicy chạy ở thread gọi, Discard/DiscardOldest bỏ task). Hiểu 7 tham số + thứ tự này là câu ThreadPool kinh điển. TRÁNH Executors.newFixedThreadPool (queue vô hạn dễ OOM) — tự tạo ThreadPoolExecutor với queue có giới hạn.',
  },
  {
    id: 'java-con-9', topic: 'Concurrency / CAS',
    q: 'CAS (Compare-And-Swap) là gì và gặp vấn đề ABA như thế nào?',
    options: [
      'CAS là một dạng khoá bi quan, thread phải chờ tới lượt của mình',
      'CAS: so khớp rồi cập nhật, không khoá; ABA sửa bằng version/stamp',
      'CAS luôn chặn thread lại cho tới khi giá trị được cập nhật xong',
      'ABA là tên của một thuật toán thu gom rác thế hệ mới trong JVM',
    ], answer: 1,
    explain: 'CAS là lệnh phần cứng nguyên tử, nền tảng của Atomic* và AQS (lock-free, lạc quan). Nhược điểm: (1) ABA — biến bị đổi rồi đổi lại giá trị cũ, CAS không phát hiện → dùng AtomicStampedReference (thêm version); (2) spin lâu tốn CPU khi tranh chấp cao; (3) chỉ đảm bảo 1 biến.',
  },
  {
    id: 'java-con-10', topic: 'Concurrency / Deadlock',
    q: 'Bốn điều kiện cần để xảy ra deadlock (bế tắc) là gì?',
    options: [
      'Chỉ cần có hai thread cùng chạy là đã đủ điều kiện gây deadlock',
      'Mutual exclusion, hold-and-wait, no preemption, circular wait',
      'Chỉ xảy ra khi JVM sắp hết bộ nhớ heap nên các thread phải chờ',
      'Do lập trình viên quên khai báo biến dùng chung là volatile',
    ], answer: 1,
    explain: 'Deadlock cần đồng thời 4 điều kiện Coffman: mutual exclusion, hold-and-wait, no preemption, circular wait. Phá 1 điều kiện là tránh được — phổ biến nhất: luôn lấy khoá theo MỘT THỨ TỰ cố định (phá circular wait), hoặc dùng tryLock có timeout (phá hold-and-wait).',
  },
  // ---------- JVM chuyên sâu ----------
  {
    id: 'java-jvm-1', topic: 'JVM / Class loading',
    q: 'Quá trình nạp một class (class loading) gồm các bước nào theo thứ tự?',
    options: [
      'Chỉ có một bước duy nhất: đọc file .class vào bộ nhớ rồi chạy',
      'Loading → Linking (Verification/Preparation/Resolution) → Initialization',
      'Compile bytecode → Run trên máy ảo → GC dọn khi không dùng nữa',
      'Load class vào metaspace → Delete bản cũ → Reload bản mới hơn',
    ], answer: 1,
    explain: 'Class loading: Loading (tìm & nạp bytecode, tạo Class object) → Linking gồm Verification (kiểm bytecode hợp lệ), Preparation (cấp bộ nhớ cho static, gán giá trị MẶC ĐỊNH 0/null), Resolution (phân giải symbolic reference) → Initialization (thực thi <clinit>: static block + khởi tạo static thật). Class chỉ được init khi lần đầu dùng (lazy).',
  },
  {
    id: 'java-jvm-2', topic: 'JVM / ClassLoader',
    q: 'Mô hình “parent delegation” (song thân uỷ nhiệm) của ClassLoader là gì và để làm gì?',
    options: [
      'ClassLoader con luôn tự nạp trước, cha chỉ nạp khi con thất bại',
      'Uỷ thác LÊN cha trước; bảo vệ class lõi & tránh nạp trùng class',
      'Nạp class song song bằng nhiều thread để rút ngắn thời gian khởi động',
      'Mô hình này chỉ tồn tại trên Android, JVM chuẩn không hề dùng',
    ], answer: 1,
    explain: 'Parent delegation: Application → Extension/Platform → Bootstrap. Loader con hỏi cha trước; cha nạp được thì dùng của cha. Nhờ vậy các class lõi (java.*) luôn do Bootstrap nạp, một class chỉ nạp 1 lần, và người dùng không thể thay java.lang.Object bằng bản giả (an toàn). Tomcat/OSGi phá vỡ mô hình này có chủ đích để cô lập ứng dụng.',
  },
  {
    id: 'java-jvm-3', topic: 'JVM / GC',
    q: 'Ba thuật toán GC nền tảng và nhược điểm chính của mỗi loại?',
    options: [
      'JVM chỉ có duy nhất một thuật toán thu gom rác cho mọi vùng nhớ',
      'Mark-Sweep (phân mảnh), Copying (tốn nửa bộ nhớ), Mark-Compact (chậm)',
      'Reference counting là thuật toán chính mà JVM dùng cho vùng heap',
      'Cả ba thuật toán đều giống nhau, chỉ khác tên gọi theo tài liệu',
    ], answer: 1,
    explain: 'Mark-Sweep: đánh dấu object sống rồi xoá object chết → nhanh nhưng để lại phân mảnh. Copying: chia đôi vùng, chép object sống sang nửa kia → không phân mảnh, phù hợp Young (đa số chết trẻ) nhưng lãng phí 50%. Mark-Compact: đánh dấu rồi dồn object sống về một đầu → không phân mảnh, hợp Old nhưng tốn công di chuyển. JVM dùng generational: Young=Copying, Old=Mark-Compact. Java KHÔNG dùng reference counting (không xử lý được vòng tham chiếu).',
  },
  {
    id: 'java-jvm-4', topic: 'JVM / Reference',
    q: 'Bốn loại tham chiếu (strong/soft/weak/phantom) khác nhau về cách GC xử lý ra sao?',
    options: [
      'Cả bốn loại đều bị GC thu hồi ngay ở lần quét kế tiếp',
      'Strong: không thu; Soft: khi sắp hết RAM; Weak: lần GC sau; Phantom: báo dọn',
      'Chỉ khác nhau về cú pháp khai báo, GC xử lý y hệt như nhau',
      'Weak mạnh hơn Strong nên object weak sống lâu hơn object strong',
    ], answer: 1,
    explain: 'Strong (mặc định): GC không đụng khi còn được trỏ. SoftReference: giữ lại đến khi gần OOM mới thu → cache nhạy bộ nhớ. WeakReference: thu ngay lần GC tới → WeakHashMap, tránh leak. PhantomReference: không lấy được object, dùng cùng ReferenceQueue để làm dọn dẹp thay finalize. Hiểu 4 loại này liên quan trực tiếp tới rò rỉ bộ nhớ.',
  },
  {
    id: 'java-jvm-5', topic: 'JVM / bộ nhớ',
    q: 'Memory leak và memory overflow (OutOfMemoryError) trong Java khác nhau thế nào?',
    options: [
      'Giống nhau hoàn toàn, chỉ khác cách gọi tên trong tài liệu',
      'Leak: còn tham chiếu nên GC không thu; OOM: thật sự hết bộ nhớ',
      'Overflow xảy ra khi CPU quá tải chứ không liên quan tới bộ nhớ',
      'Leak chỉ xảy ra ở C/C++, Java có GC nên không thể bị leak',
    ], answer: 1,
    explain: 'Memory leak: vẫn còn tham chiếu tới object không dùng nữa (static collection phình mãi, ThreadLocal không remove, listener không gỡ…) → GC không thu được, bộ nhớ tăng dần. OOM: JVM không cấp nổi bộ nhớ nữa (java.lang.OutOfMemoryError: Java heap space). Leak tích tụ lâu ngày thường là NGUYÊN NHÂN gây OOM; điều tra bằng heap dump + phân tích (MAT, jmap).',
  },
  // ---------- Design Pattern ----------
  {
    id: 'java-dp-singleton', topic: 'Design Pattern / Singleton',
    q: 'Cách hiện thực Singleton an toàn thread mà đơn giản & chống reflection/serialization tốt nhất?',
    code: 'public enum Config { INSTANCE; ... }',
    options: [
      'Tạo instance mới mỗi lần gọi getInstance() cho an toàn thread',
      'Dùng ENUM — JVM đảm bảo 1 instance, chống reflection & serialization',
      'Biến static gán sẵn là đủ, không cần đồng bộ hay khoá gì thêm',
      'Chỉ double-check locking mới đúng, các cách khác đều có lỗ hổng',
    ], answer: 1,
    explain: 'Các cách: (1) eager static (đơn giản, tạo sớm dù chưa dùng); (2) double-check locking cần biến volatile để tránh half-initialized object do reorder; (3) static inner holder (lazy + thread-safe nhờ class loading); (4) ENUM — Josh Bloch khuyên: ngắn gọn, an toàn thread, chống cả reflection lẫn deserialization tạo instance thứ hai. Double-check thiếu volatile là bug kinh điển.',
  },
  {
    id: 'java-dp-factory', topic: 'Design Pattern / Factory',
    q: 'Factory Method pattern giải quyết vấn đề gì?',
    options: [
      'Tạo và quản lý nhiều thread chạy song song cho cùng một tác vụ',
      'Đóng gói việc KHỞI TẠO sau interface → client khỏi biết class cụ thể',
      'Tự động xoá object khi không còn ai tham chiếu tới nó nữa',
      'Sắp xếp collection theo nhiều tiêu chí khác nhau lúc runtime',
    ], answer: 1,
    explain: 'Factory Method tách logic tạo object khỏi nơi sử dụng: client gọi factory.create(type) thay vì new cụ thể. Thêm loại sản phẩm mới chỉ cần thêm class + nhánh factory, không sửa client (Open/Closed). Ví dụ thực tế: Calendar.getInstance(), LoggerFactory.getLogger(), BeanFactory của Spring. Abstract Factory là bản mở rộng tạo “họ” object liên quan.',
  },
  {
    id: 'java-dp-proxy', topic: 'Design Pattern / Proxy',
    q: 'Dynamic proxy trong Java (nền tảng của Spring AOP) hoạt động thế nào?',
    options: [
      'Sửa trực tiếp bytecode của class lúc biên dịch bằng annotation processor',
      'JDK proxy tạo lúc RUNTIME cho interface; không có interface thì CGLIB',
      'Chỉ hoạt động được với class khai báo final và các method static',
      'Lập trình viên phải tự viết tay từng method uỷ quyền cho proxy',
    ], answer: 1,
    explain: 'Proxy bọc object thật để chèn hành vi (log, transaction, security) trước/sau khi gọi. JDK dynamic proxy: Proxy.newProxyInstance() tạo lớp proxy runtime cho các INTERFACE, mọi lời gọi đi qua InvocationHandler.invoke(). Nếu bean không có interface → Spring dùng CGLIB (sinh lớp con, override method) — vì thế method final/private/ hoặc gọi nội bộ this.method() KHÔNG được AOP proxy chặn. Đây là gốc của @Transactional/@Async self-invocation không hiệu lực.',
  },
  {
    id: 'java-dp-strategy', topic: 'Design Pattern / Strategy',
    q: 'Strategy pattern dùng khi nào?',
    options: [
      'Khi hệ thống chỉ cần đúng một thuật toán cố định không đổi',
      'Nhiều thuật toán thay thế nhau: mỗi cái một class, chọn lúc runtime',
      'Khi cần đảm bảo cả ứng dụng chỉ có một instance duy nhất tồn tại',
      'Khi cần sao chép object mà không phụ thuộc vào class cụ thể',
    ], answer: 1,
    explain: 'Strategy: định nghĩa họ thuật toán cùng interface (vd PaymentStrategy: Momo/VNPay/Card), context giữ 1 strategy và uỷ quyền. Lợi ích: thêm thuật toán mới không sửa context (Open/Closed), loại bỏ chuỗi if/else-switch khổng lồ, dễ test từng chiến lược. Trong Spring hay tiêm Map<String, Strategy> để chọn theo key.',
  },
  {
    id: 'java-dp-template', topic: 'Design Pattern / Template Method',
    q: 'Template Method pattern là gì?',
    options: [
      'Là một dạng generic cho phép truyền kiểu dữ liệu vào trong class',
      'Lớp cha định khung các bước (method final); lớp con override chi tiết',
      'Tạo object từ một chuỗi template có sẵn các chỗ trống cần điền',
      'Sao chép method từ class này sang class khác ngay lúc biên dịch',
    ], answer: 1,
    explain: 'Template Method: method khung (thường final) trong lớp cha gọi các bước theo thứ tự cố định; bước thay đổi được khai abstract/hook cho lớp con hiện thực. Ví dụ: JdbcTemplate, HttpServlet.service() gọi doGet/doPost, khung xử lý request của Spring. Đảo control: “đừng gọi chúng tôi, chúng tôi sẽ gọi bạn” (Hollywood principle).',
  },
  {
    id: 'java-dp-builder', topic: 'Design Pattern / Builder',
    q: 'Builder pattern giải quyết vấn đề gì?',
    code: 'User u = User.builder().name("Hai").age(28).build();',
    options: [
      'Tạo nhiều instance cùng lúc để tiết kiệm chi phí khởi tạo object',
      'Xây object nhiều tham số optional dễ đọc & bất biến, tránh telescoping',
      'Tự động sinh getter/setter cho mọi field trong class dữ liệu',
      'Khoá object lại ngay sau khi tạo để không ai sửa được nữa',
    ], answer: 1,
    explain: 'Builder: chuỗi method .field(value)...build() để dựng object nhiều tham số, đặc biệt khi nhiều tham số tuỳ chọn. Thay cho constructor lồng nhau khó đọc (telescoping) hoặc setter khiến object mutable/không nhất quán. Kết quả thường immutable. Lombok @Builder, StringBuilder, Stream.Builder, HttpRequest.newBuilder() là ví dụ.',
  },
  {
    id: 'java-dp-observer', topic: 'Design Pattern / Observer',
    q: 'Observer pattern (publish-subscribe) dùng để làm gì?',
    options: [
      'Giám sát dung lượng bộ nhớ JVM và cảnh báo khi heap sắp đầy',
      'Subject đổi trạng thái thì tự báo mọi observer — tách bên phát/nhận',
      'Đồng bộ hoá nhiều thread cùng truy cập một tài nguyên dùng chung',
      'Nén dữ liệu trước khi gửi đi để giảm băng thông phải sử dụng',
    ], answer: 1,
    explain: 'Observer: subject giữ danh sách observer; khi state đổi thì gọi update() lên từng observer — loose coupling giữa nơi phát sự kiện và nơi xử lý. Ví dụ: Spring ApplicationEvent/@EventListener, listener UI, message/event bus. Là nền của kiến trúc hướng sự kiện. Lưu ý gỡ đăng ký (unregister) để tránh memory leak.',
  },
  // ---------- Spring chuyên sâu ----------
  {
    id: 'java-spring-4', topic: 'Spring / Bean lifecycle',
    q: 'Vòng đời một Spring bean (singleton) đi qua các giai đoạn chính nào?',
    options: [
      'Chỉ có hai bước: container new object rồi trả về cho nơi cần dùng',
      'Tạo → tiêm dependency → Aware → BeanPostProcessor → init → destroy',
      'Chạy init trước rồi mới tiêm dependency vào các field của bean',
      'Bean tự huỷ ngay sau khi tạo nếu không có ai giữ tham chiếu',
    ], answer: 1,
    explain: 'Vòng đời: instantiate → điền thuộc tính/tiêm dependency → *Aware (BeanNameAware, ApplicationContextAware…) → BeanPostProcessor.postProcessBeforeInitialization → khởi tạo (@PostConstruct → InitializingBean.afterPropertiesSet → init-method) → postProcessAfterInitialization (AOP proxy tạo ở đây) → dùng → khi container tắt: @PreDestroy → DisposableBean.destroy → destroy-method. Hiểu vòng này để biết vì sao AOP proxy hình thành và mở rộng qua BeanPostProcessor.',
  },
  {
    id: 'java-spring-5', topic: 'Spring / Circular dependency',
    q: 'Spring giải quyết circular dependency (A cần B, B cần A) bằng cơ chế nào?',
    options: [
      'Không giải quyết được, Spring luôn báo lỗi khi phát hiện vòng',
      'Tam cấp cache; nhưng CONSTRUCTOR injection vòng tròn thì chịu',
      'Tạo hai instance riêng cho A và B để phá vỡ vòng phụ thuộc đó',
      'Đánh dấu field là volatile để container tiêm được cả hai chiều',
    ], answer: 1,
    explain: 'Spring dùng 3 cấp cache: bean A đang tạo được đưa early reference vào singletonFactories → khi B cần A lấy được reference chưa hoàn chỉnh → B hoàn tất → A hoàn tất. Nhờ vậy field/setter injection vòng tròn OK. Nhưng CONSTRUCTOR injection vòng tròn không cứu được (chưa có instance để expose early) → ném BeanCurrentlyInCreationException. Vì thế constructor injection (khuyến nghị) phát hiện sớm thiết kế vòng tròn xấu.',
  },
  {
    id: 'java-spring-6', topic: 'Spring / @Transactional',
    q: '@Transactional KHÔNG có hiệu lực (thất bại) trong trường hợp nào?',
    code: 'public void outer(){ this.inner(); } @Transactional public void inner(){...}',
    options: [
      'Luôn có hiệu lực miễn là class được đăng ký làm một Spring bean',
      'Method không public; self-invocation; nuốt exception; checked exception',
      'Chỉ thất bại khi database chưa được cấu hình trong application.yml',
      'Thất bại khi class có cài đặt interface vì proxy không tạo được',
    ], answer: 1,
    explain: 'Các bẫy @Transactional thất bại: (1) method không public (proxy CGLIB/JDK không chặn được); (2) SELF-INVOCATION — gọi this.inner() không đi qua proxy nên annotation vô hiệu (giải: tách bean khác, hoặc AopContext.currentProxy()); (3) bắt exception mà không ném lại → không rollback; (4) mặc định chỉ rollback RuntimeException & Error — checked exception phải khai rollbackFor=Exception.class; (5) bean không do Spring quản lý (tự new). Đây là chùm câu hỏi Spring cực hay gặp.',
  },
  {
    id: 'java-spring-7', topic: 'Spring / Injection',
    q: '@Autowired và @Resource khác nhau thế nào?',
    options: [
      'Giống hệt nhau, chỉ khác gói thư viện chứa annotation đó',
      '@Autowired khớp byType trước; @Resource khớp byName trước',
      '@Resource nhanh hơn vì không phải quét toàn bộ application context',
      '@Autowired chỉ dùng được cho field, không dùng cho constructor',
    ], answer: 1,
    explain: '@Autowired: mặc định byType; nếu có nhiều bean cùng kiểu → dùng @Qualifier("tên") hoặc @Primary để phân giải, required=false cho phép null. @Resource (chuẩn Java JSR-250): mặc định byName (theo tên field/tham số) rồi mới fallback byType. Khuyến nghị dùng CONSTRUCTOR injection (bất biến, dễ test, phát hiện vòng tròn sớm) thay vì field injection.',
  },
  {
    id: 'java-spring-8', topic: 'Spring MVC',
    q: 'Luồng xử lý một request trong Spring MVC (DispatcherServlet) đi qua đâu?',
    options: [
      'Request đi thẳng tới Controller rồi trả kết quả về cho client',
      'DispatcherServlet → HandlerMapping → HandlerAdapter → ViewResolver',
      'Controller nhận trước rồi mới chuyển cho DispatcherServlet dựng view',
      'View nhận request trước, sau đó gọi Controller để lấy dữ liệu',
    ], answer: 1,
    explain: 'DispatcherServlet là front controller: nhận request → HandlerMapping tìm handler (controller + method theo URL) → HandlerAdapter thực thi → Controller trả về ModelAndView → ViewResolver ánh xạ tên view → render trả HTML; với REST @ResponseBody/@RestController thì bỏ qua ViewResolver, dùng HttpMessageConverter (Jackson) ghi JSON thẳng vào response. Interceptor chạy trước/sau handler.',
  },
  {
    id: 'java-spring-9', topic: 'Spring Boot',
    q: 'Auto-configuration của Spring Boot hoạt động thế nào?',
    options: [
      'Spring Boot đoán cấu hình ngẫu nhiên rồi thử tới khi chạy được',
      '@EnableAutoConfiguration nạp danh sách + @Conditional lọc theo điều kiện',
      'Vẫn phải khai báo đầy đủ trong file XML như Spring truyền thống',
      'Chỉ tự cấu hình cho database, phần còn lại phải khai báo bằng tay',
    ], answer: 1,
    explain: 'Spring Boot tự cấu hình dựa trên “convention over configuration”: @EnableAutoConfiguration nạp các lớp auto-config (đăng ký trong META-INF/spring/…AutoConfiguration.imports, trước 2.7 là spring.factories). Mỗi lớp gắn @Conditional: @ConditionalOnClass (có thư viện trong classpath), @ConditionalOnMissingBean (bạn chưa tự định nghĩa), @ConditionalOnProperty… → chỉ kích hoạt khi hợp lý. Vì vậy thêm dependency là “chạy được ngay”, và bạn override bằng cách tự khai bean.',
  },
  {
    id: 'java-spring-10', topic: 'Spring / Context',
    q: 'BeanFactory và ApplicationContext khác nhau ra sao?',
    options: [
      'Giống nhau, ApplicationContext chỉ là tên gọi mới của BeanFactory',
      'ApplicationContext mở rộng BeanFactory: i18n, event, eager singleton',
      'BeanFactory mạnh hơn vì hỗ trợ thêm sự kiện và tính quốc tế hoá',
      'ApplicationContext không tạo bean mà chỉ tra cứu bean đã có sẵn',
    ], answer: 1,
    explain: 'BeanFactory: container gốc, tạo bean LAZY (khi getBean). ApplicationContext (thường dùng): kế thừa BeanFactory + tự đăng ký BeanPostProcessor/BeanFactoryPostProcessor, hỗ trợ quốc tế hoá (MessageSource), publish/nghe sự kiện (ApplicationEvent), truy cập resource, và khởi tạo EAGER các singleton lúc container start → lỗi cấu hình lộ ra sớm. Thực tế gần như luôn dùng ApplicationContext.',
  },
  // ---------- Java 8+ / Tính năng mới ----------
  {
    id: 'java-new-record', topic: 'Java mới / record',
    q: '`record` (Java 16) khác class thường ra sao?',
    code: 'public record Point(int x, int y) {}',
    options: [
      'record là một loại interface đặc biệt chỉ chứa hằng số dữ liệu',
      'Lớp dữ liệu BẤT BIẾN: tự sinh constructor, getter, equals/hashCode',
      'record cho phép kế thừa nhiều class cha cùng lúc để gộp dữ liệu',
      'record giống hệt class thường, chỉ đổi từ khoá cho ngắn gọn hơn',
    ], answer: 1,
    explain: 'record là "data carrier" bất biến: compiler tự sinh canonical constructor, accessor (x() thay vì getX()), equals/hashCode/toString dựa trên các component. Field final, không setter. Không kế thừa class khác (đã ngầm final), nhưng implements được interface. Hợp làm DTO, value object, key của Map. Thay cho lớp POJO dài dòng hoặc Lombok @Value.',
  },
  {
    id: 'java-new-sealed', topic: 'Java mới / sealed',
    q: '`sealed` class/interface (Java 17) dùng để làm gì?',
    code: 'public sealed interface Shape permits Circle, Square {}',
    options: [
      'Khoá object lại để không ai sửa được giá trị các field bên trong',
      'GIỚI HẠN class được phép kế thừa (permits) → switch kiểm exhaustive',
      'Làm class chạy nhanh hơn nhờ JIT biết trước là không có lớp con',
      'Mã hoá nội dung file .class để tránh bị dịch ngược mã nguồn',
    ], answer: 1,
    explain: 'sealed cho phép tác giả khai báo CHÍNH XÁC những class con được phép (permits). Lớp con phải là sealed / final / non-sealed. Lợi ích: mô hình hoá "tổng kiểu" (sum type) đóng, và compiler biết đủ mọi nhánh → switch pattern matching kiểm được exhaustive (không cần default). Hợp cho mô hình domain có tập biến thể cố định.',
  },
  {
    id: 'java-new-switch', topic: 'Java mới / switch',
    q: 'Switch expression (Java 14) khác switch statement cũ thế nào?',
    code: 'int n = switch (day) {\n  case MON, TUE -> 1;\n  default -> 0;\n};',
    options: [
      'Không khác gì nhau, chỉ là cách viết ngắn hơn của switch cũ',
      'Trả về GIÁ TRỊ, dùng "->" nên khỏi break, buộc phủ hết nhánh',
      'Chỉ đổi cú pháp còn hành vi fall-through thì vẫn giữ nguyên',
      'Không hỗ trợ enum mà chỉ dùng được với số nguyên và chuỗi',
    ], answer: 1,
    explain: 'Switch expression: là biểu thức TRẢ VỀ giá trị (gán được), dùng "->" nên KHÔNG fall-through (không cần break — nguồn bug kinh điển của switch cũ), gộp nhãn "case A, B ->", dùng yield cho block. Với enum/sealed phải phủ hết nhánh. An toàn & gọn hơn switch statement truyền thống nhiều.',
  },
  {
    id: 'java-new-var', topic: 'Java mới / var',
    q: '`var` (Java 10) — suy luận kiểu — hoạt động thế nào?',
    code: 'var list = new ArrayList<String>();  // list là ArrayList<String>',
    options: [
      'var biến Java thành ngôn ngữ kiểu động như JavaScript hay Python',
      'Suy luận kiểu lúc BIÊN DỊCH, chỉ cho biến cục bộ có khởi tạo rõ',
      'var tương đương Object nên có thể chứa mọi kiểu lúc chạy chương trình',
      'var làm chương trình chậm hơn vì phải kiểm tra kiểu lúc runtime',
    ], answer: 1,
    explain: 'var KHÔNG biến Java thành dynamic typing — compiler suy ra kiểu tĩnh từ vế phải, sau đó kiểu cố định như khai báo tường minh (an toàn kiểu, không phí runtime). Chỉ dùng cho biến CỤC BỘ có khởi tạo. Không dùng: field, tham số, kiểu trả về, hay `var x = null` (không suy được). Lạm dụng làm code khó đọc → chỉ dùng khi kiểu đã hiển nhiên ở vế phải.',
  },
  {
    id: 'java-new-vthread', topic: 'Java mới / Virtual Thread',
    q: 'Virtual thread (Java 21, Project Loom) giải quyết vấn đề gì?',
    options: [
      'Làm mỗi thread chạy nhanh hơn khi xử lý tác vụ nặng về tính toán',
      'Thread siêu nhẹ do JVM quản lý: tạo hàng triệu, block I/O khỏi giữ thread OS',
      'Thay thế hoàn toàn thread thường, từ Java 21 không còn platform thread',
      'Chỉ dùng để đẩy phần tính toán song song xuống GPU thay vì CPU',
    ], answer: 1,
    explain: 'Virtual thread (JEP 444): thread nhẹ do JVM lập lịch trên một số ít "carrier thread" OS. Khi virtual thread block (I/O, sleep), JVM "unmount" nó khỏi carrier để carrier chạy việc khác → có thể có hàng triệu virtual thread. Giải bài toán "một thread OS mỗi request" tốn kém: viết code kiểu blocking/tuần tự đơn giản nhưng đạt thông lượng của mô hình async. Hợp I/O-bound; CPU-bound thì không lợi. Tránh giữ khoá/synchronized dài (gây "pinning").',
  },
  // ---------- MyBatis (SQL mapper, hay hỏi ở backend VN/Á) ----------
  {
    id: 'java-mybatis-hash-dollar', topic: 'MyBatis / #{} vs ${}',
    q: 'Trong MyBatis, khác nhau cốt lõi giữa #{} và ${} là gì (liên quan bảo mật)?',
    options: [
      'Giống hệt nhau, chỉ khác cú pháp gõ theo thói quen từng dự án',
      '#{} sinh placeholder ? (chống injection); ${} nối THẲNG chuỗi vào SQL',
      '${} an toàn hơn vì giá trị được mã hoá trước khi ghép vào câu SQL',
      '#{} chỉ dùng được cho số, còn ${} chỉ dùng được cho kiểu chuỗi',
    ], answer: 1,
    explain: '#{param} → MyBatis thay bằng dấu ? và dùng PreparedStatement.setXxx() → dữ liệu TÁCH khỏi câu lệnh, chống SQL injection, tự xử lý kiểu/escape. ${param} → chèn TRỰC TIẾP giá trị vào chuỗi SQL trước khi biên dịch → dính SQL injection nếu là input người dùng. Chỉ dùng ${} khi bắt buộc động phần KHÔNG thể tham số hoá (tên bảng, tên cột, chiều ASC/DESC) và phải whitelist. Mặc định luôn ưu tiên #{}.',
    code: "SELECT * FROM user WHERE name = #{name}   -- an toàn → ... WHERE name = ?\nORDER BY ${col} ${dir}                     -- nối thẳng → BẮT BUỘC whitelist col, dir",
  },
  {
    id: 'java-mybatis-mapper-proxy', topic: 'MyBatis / Mapper proxy',
    q: 'Interface Mapper của MyBatis không có class cài đặt — khi gọi userMapper.findById(1) thì cái gì thực thi?',
    options: [
      'Trình biên dịch tự sinh ra file .class cài đặt interface lúc build',
      'MyBatis tạo PROXY động lúc chạy (MapperProxy) → ánh xạ MappedStatement',
      'Phải tự viết một class implements Mapper thì lời gọi mới chạy được',
      'Nó gọi một bean Spring khác trùng tên thông qua cơ chế reflection',
    ], answer: 1,
    explain: 'Mapper chỉ là interface, KHÔNG có implementation. MyBatis dùng JDK dynamic proxy sinh MapperProxy lúc runtime. Mỗi lời gọi method → MapperProxy tra MappedStatement theo id = "package.Interface.method" (khớp namespace + id trong XML/annotation) → chọn loại SELECT/INSERT/... → SqlSession thực thi và map kết quả về object. Nhờ đó ta chỉ khai báo interface + SQL, không phải viết code JDBC lặp lại.',
  },
  {
    id: 'java-mybatis-cache-levels', topic: 'MyBatis / Cache',
    q: 'Cache cấp 1 (first-level) và cấp 2 (second-level) của MyBatis khác nhau thế nào?',
    options: [
      'Cả hai đều là cache toàn cục và được bật sẵn giống hệt như nhau',
      'Cấp 1 theo SqlSession (bật sẵn); cấp 2 theo namespace, phải bật tay',
      'Cấp 1 nằm ở Redis còn cấp 2 nằm trong bộ nhớ của tiến trình JVM',
      'MyBatis chỉ có cache cấp 1, hoàn toàn không tồn tại cache cấp 2',
    ], answer: 1,
    explain: 'First-level cache: phạm vi 1 SqlSession, BẬT mặc định — cùng một truy vấn trong cùng session lấy từ cache; mọi INSERT/UPDATE/DELETE (hoặc commit/close) làm sạch cache của session đó. Second-level cache: phạm vi namespace (mapper), chia sẻ across session, phải khai <cache/> + cacheEnabled; commit ở session này mới flush cho session khác. Thực tế cache cấp 2 hay bị TẮT vì dễ đọc dữ liệu cũ (nhiều bảng/nhiều node) → thường dùng Redis ngoài thay thế.',
  },
  {
    id: 'java-mybatis-vs-hibernate', topic: 'MyBatis / vs Hibernate',
    q: 'MyBatis khác Hibernate/JPA ở điểm cốt lõi nào?',
    options: [
      'MyBatis luôn nhanh hơn Hibernate trong mọi tình huống truy vấn',
      'MyBatis: tự viết SQL rồi map kết quả; Hibernate/JPA: ORM tự sinh SQL',
      'MyBatis không cần viết SQL, hoạt động y hệt như JPA repository',
      'Hibernate chỉ chạy được với MySQL còn MyBatis chạy được mọi DB',
    ], answer: 1,
    explain: 'MyBatis: bạn viết SQL (XML/annotation), MyBatis lo map tham số & kết quả ↔ object → kiểm soát SQL tối đa, dễ tối ưu, hợp truy vấn phức tạp/báo cáo. Hibernate/JPA: ORM đầy đủ, sinh SQL tự động từ entity/JPQL, năng suất cao cho CRUD chuẩn nhưng SQL bị "giấu" (dễ dính N+1, khó tinh chỉnh). Chọn: SQL phức tạp/cần hiệu năng → MyBatis; domain chuẩn, muốn đổi DB linh hoạt → JPA. Nhiều dự án dùng cả hai.',
  },
  {
    id: 'java-mybatis-dynamic-where', topic: 'MyBatis / Dynamic SQL',
    q: 'Thẻ <where> trong dynamic SQL của MyBatis giải quyết vấn đề gì so với tự viết "WHERE 1=1"?',
    options: [
      'Không khác gì nhau, chỉ là cách viết cho câu SQL trông đẹp hơn',
      '<where> chỉ chèn WHERE khi có điều kiện và tự cắt AND/OR thừa',
      '<where> tự tạo index phù hợp cho các cột xuất hiện trong điều kiện',
      '<where> thay thế #{} trong việc chống SQL injection cho tham số',
    ], answer: 1,
    explain: 'Khi ghép nhiều <if> để build điều kiện động, tự nối tay dễ sinh SQL sai kiểu "WHERE AND age=..." hoặc thiếu hẳn WHERE. Thẻ <where>: chỉ chèn WHERE khi bên trong có nội dung và tự bỏ "AND"/"OR" dư ở đầu → SQL luôn đúng cú pháp, khỏi cần thủ thuật "WHERE 1=1". Tương tự có <set> cho UPDATE (bỏ dấu phẩy thừa) và <trim> tuỳ biến. Lưu ý: <where> KHÔNG liên quan bảo mật — chống injection vẫn là #{}.',
  },

  // ---------- SOLID (5 nguyên lý thiết kế OOP — khớp bài 06 track nền tảng) ----------
  {
    id: 'java-solid-s', topic: 'SOLID / Single Responsibility',
    q: 'Nguyên lý Single Responsibility (S trong SOLID) nói gì?',
    options: [
      'Một method chỉ được phép nhận đúng một tham số đầu vào',
      'Một class chỉ nên có MỘT lý do để thay đổi — một trách nhiệm',
      'Một class chỉ được phép chứa đúng một method public duy nhất',
      'Cả chương trình chỉ nên có một class chính điều phối mọi thứ',
    ], answer: 1,
    explain: 'Single Responsibility: mỗi class (hay module) chỉ nên có MỘT lý do để thay đổi = một trách nhiệm. Ví dụ tách User (dữ liệu), UserRepository (lưu trữ), EmailService (gửi mail) thay vì nhồi hết vào một class. Lợi ích: sửa phần này không làm hỏng phần kia, dễ test. Đây là lý do Spring tách Controller/Service/Repository. KHÔNG phải "một method" hay "một class" theo nghĩa đen.',
  },
  {
    id: 'java-solid-o', topic: 'SOLID / Open-Closed',
    q: 'Nguyên lý Open/Closed (O) nghĩa là gì?',
    options: [
      'Class phải luôn để field ở dạng public để dễ mở rộng về sau',
      'MỞ để mở rộng, ĐÓNG với sửa đổi — thường đạt bằng đa hình/interface',
      'Phải đóng mọi tài nguyên ngay sau khi mở để tránh rò rỉ bộ nhớ',
      'Chỉ được thêm tính năng mới vào cuối mỗi sprint đã lên kế hoạch',
    ], answer: 1,
    explain: 'Open/Closed: thêm tính năng mới bằng cách VIẾT THÊM code (class mới implement interface), KHÔNG sửa code cũ đang chạy đúng → tránh gây lỗi hồi quy. Ví dụ: thay vì if/else instanceof để tính diện tích từng hình, cho mỗi hình implement Hinh.dienTich(); thêm hình mới chỉ cần viết class mới. Đa hình là công cụ chính để đạt được O.',
  },
  {
    id: 'java-solid-l', topic: 'SOLID / Liskov Substitution',
    q: 'Nguyên lý Liskov Substitution (L) yêu cầu điều gì?',
    options: [
      'Class con phải luôn có nhiều method hơn class cha mà nó kế thừa',
      'Object lớp con THAY THẾ được lớp cha mà chương trình vẫn chạy đúng',
      'Không bao giờ được dùng kế thừa, chỉ được dùng composition',
      'Class cha bắt buộc phải khai báo abstract để con override được',
    ], answer: 1,
    explain: 'Liskov: ở đâu dùng được kiểu cha thì thay bằng object con vẫn phải đúng. Vi phạm kinh điển: HinhVuong extends HinhChuNhat rồi ép dài=rộng → code kỳ vọng setDai(5)+setRong(4) cho diện tích 20 nhưng nhận 16 → sai âm thầm. Bài học: chỉ kế thừa khi con THẬT SỰ giữ đúng hành vi cha mong đợi; nếu không, tách riêng hoặc dùng composition.',
  },
  {
    id: 'java-solid-i', topic: 'SOLID / Interface Segregation',
    q: 'Nguyên lý Interface Segregation (I) khuyên điều gì?',
    options: [
      'Gộp mọi method vào một interface thật lớn cho tiện việc quản lý',
      'Đừng ép class cài method nó KHÔNG dùng — tách interface nhỏ ra',
      'Mỗi interface không được phép có quá mười method trừu tượng',
      'Chỉ dùng abstract class và tuyệt đối không dùng tới interface',
    ], answer: 1,
    explain: 'Interface Segregation: nhiều interface nhỏ, chuyên biệt tốt hơn một interface "béo". Ví dụ interface May{in();scan();fax()} ép MayInGiaRe phải cài scan()/fax() dù không hỗ trợ (đành ném UnsupportedOperationException) → xấu. Tách thành MayIn, MayScan riêng; class chỉ implement đúng cái nó làm được. Client cũng chỉ phụ thuộc method nó cần.',
  },
  {
    id: 'java-solid-d', topic: 'SOLID / Dependency Inversion',
    q: 'Nguyên lý Dependency Inversion (D) nói gì? (nền tảng của DI trong Spring)',
    options: [
      'Module cấp cao nên tự new class cấp thấp để chương trình chạy nhanh',
      'Phụ thuộc vào TRỪU TƯỢNG, không phụ thuộc lớp cụ thể → dễ test',
      'Luôn đảo ngược thứ tự khai báo các biến trong một class lớn',
      'Class con phải phụ thuộc ngược trở lại vào class cha của nó',
    ], answer: 1,
    explain: 'Dependency Inversion: cả module cấp cao lẫn cấp thấp đều phụ thuộc INTERFACE, không dính chặt class cụ thể. Thay vì UserService tự new MySQLDatabase(), nó nhận Database (interface) qua constructor → đổi sang Postgres hay bản giả (mock) để test mà không sửa UserService. Đây chính là nền tảng của Dependency Injection (@Autowired) trong Spring.',
  },

  // ---------- Java cơ bản (nhập môn — on-ramp cho người vừa học track nền tảng) ----------
  {
    id: 'java-basic-intdiv', topic: 'Java cơ bản / chia số nguyên',
    q: 'Trong Java, `int r = 7 / 2;` thì r bằng bao nhiêu?',
    options: [
      '3.5 — Java giữ lại phần thập phân của phép chia',
      '3 — hai số int chia nhau là chia nguyên, bỏ phần dư',
      '4 — kết quả được làm tròn lên số nguyên gần nhất',
      'Báo lỗi biên dịch vì kết quả có thể là số thập phân',
    ], answer: 1,
    explain: '7 và 2 đều là int → phép chia là CHIA NGUYÊN, bỏ phần thập phân (KHÔNG làm tròn) → r = 3. Muốn ra 3.5 phải có ít nhất một số thực: `7.0 / 2` hoặc `(double) 7 / 2`. Đây là bẫy kinh điển của người mới.',
    code: 'int r = 7 / 2;       // 3\ndouble d = 7.0 / 2;  // 3.5',
  },
  {
    id: 'java-basic-new', topic: 'Java cơ bản / tạo object',
    q: 'Từ khoá nào dùng để tạo một object mới từ class?',
    options: ['create', 'new', 'object', 'make'],
    answer: 1,
    explain: '`new` cấp phát object trên heap, gọi constructor và trả về tham chiếu: `SinhVien sv = new SinhVien("Nam", 20);`. Java không có từ khoá create/make/object cho việc này.',
  },
  {
    id: 'java-basic-boolean', topic: 'Java cơ bản / kiểu dữ liệu',
    q: 'Kiểu dữ liệu nào trong Java lưu giá trị true/false?',
    options: ['bool', 'boolean', 'bit', 'int (dùng 0/1)'],
    answer: 1,
    explain: 'Java dùng `boolean` (KHÔNG phải `bool` như C++). Nó chỉ nhận `true`/`false`, và KHÔNG dùng số 0/1 thay cho true/false như C. Ví dụ: `boolean ok = (tuoi >= 18);`',
  },
  {
    id: 'java-basic-constructor', topic: 'Java cơ bản / constructor',
    q: 'Đặc điểm nào ĐÚNG về constructor trong Java?',
    options: [
      'Có thể khai báo trả về kiểu bất kỳ như method thường',
      'Trùng TÊN với class và KHÔNG có kiểu trả về (kể cả void)',
      'Bắt buộc phải khai báo static',
      'Phải được gọi thủ công như một method bình thường',
    ], answer: 1,
    explain: 'Constructor có TÊN TRÙNG class và KHÔNG khai báo kiểu trả về (kể cả void) — điểm khác method thường. Nó chạy TỰ ĐỘNG khi dùng `new`. Nếu bạn không viết constructor nào, Java cấp sẵn một constructor rỗng mặc định.',
  },
  {
    id: 'java-basic-break', topic: 'Java cơ bản / vòng lặp',
    q: 'Trong vòng lặp, lệnh `break` làm gì?',
    options: [
      'Bỏ qua phần còn lại của vòng hiện tại rồi nhảy sang vòng kế',
      'THOÁT hẳn ra khỏi vòng lặp',
      'Tạm dừng toàn bộ chương trình',
      'Quay lại chạy từ đầu vòng lặp',
    ], answer: 1,
    explain: '`break` thoát HẲN khỏi vòng lặp gần nhất. Còn `continue` mới là bỏ qua phần còn lại của vòng hiện tại để nhảy sang vòng kế. Đừng nhầm hai lệnh này.',
  },
  {
    id: 'java-basic-main', topic: 'Java cơ bản / điểm bắt đầu',
    q: 'Chương trình Java bắt đầu chạy từ đâu?',
    options: [
      'Từ dòng code đầu tiên trong file',
      'Từ method `public static void main(String[] args)`',
      'Từ constructor của class đầu tiên trong file',
      'Từ bất kỳ method nào có tên "start"',
    ], answer: 1,
    explain: 'JVM luôn tìm và chạy method `public static void main(String[] args)` đầu tiên — đó là điểm vào (entry point). Java KHÔNG chạy tuần tự từ dòng đầu file như script; mọi code phải nằm trong method, và main là nơi bắt đầu.',
  },

  // ---------- Testing (JUnit 5 / Mockito) — hay bị hỏi khi đi làm ----------
  {
    id: 'java-test-lifecycle', topic: 'Testing / JUnit 5',
    q: 'Khác nhau giữa @BeforeAll và @BeforeEach trong JUnit 5 là gì?',
    options: [
      'Cả hai đều chạy trước mỗi test, chỉ khác nhau ở tên gọi',
      '@BeforeAll chạy MỘT LẦN (phải static); @BeforeEach chạy trước MỖI test',
      '@BeforeAll chạy trước mỗi test; @BeforeEach chỉ chạy đúng một lần',
      '@BeforeAll chỉ chạy khi lớp test được đánh dấu là @Disabled',
    ], answer: 1,
    explain: '@BeforeAll chạy đúng một lần trước toàn bộ test của class — vì đời sống ở mức class nên method phải static (trừ khi đặt @TestInstance(Lifecycle.PER_CLASS)). @BeforeEach chạy lại trước MỖI @Test để dựng lại trạng thái sạch. Cặp dọn dẹp tương ứng là @AfterEach / @AfterAll.',
    code: '@BeforeAll static void initDb() { /* chạy 1 lần */ }\n@BeforeEach void reset() { /* chạy trước mỗi test */ }',
  },
  {
    id: 'java-test-assertthrows', topic: 'Testing / JUnit 5',
    q: 'Cách đúng để kiểm tra một method NÉM đúng exception mong đợi trong JUnit 5?',
    options: [
      'Bọc try/catch rồi gọi fail() nếu không thấy exception nào ném ra',
      'assertThrows(Exception.class, () -> ...) — trả về exception để assert tiếp',
      'Đặt @Test(expected = Exception.class) ngay trên method test đó',
      'Dùng assertEquals(exception, method()) để so sánh hai đối tượng',
    ], answer: 1,
    explain: 'JUnit 5 dùng assertThrows(LoạiException.class, executable) và TRẢ VỀ chính exception đã bắt để bạn assert thêm message/nguyên nhân. Thuộc tính `expected` của @Test là cú pháp JUnit 4 (đã bỏ ở JUnit 5). Cách try/catch + fail() cồng kềnh và dễ quên fail().',
    code: 'var ex = assertThrows(IllegalArgumentException.class,\n    () -> service.withdraw(-1));\nassertEquals("số tiền phải > 0", ex.getMessage());',
  },
  {
    id: 'java-test-mock-vs-spy', topic: 'Testing / Mockito',
    q: 'Khác biệt cốt lõi giữa mock() và spy() trong Mockito?',
    options: [
      'mock() và spy() giống hệt nhau, chỉ khác tên gọi theo thói quen',
      'mock(): object GIẢ trả default; spy(): bọc object THẬT, gọi method thật',
      'spy() không thể stub được bất kỳ method nào của object gốc',
      'mock() gọi method thật còn spy() luôn trả về giá trị mặc định',
    ], answer: 1,
    explain: 'mock() sinh đối tượng giả toàn phần: mọi method chưa stub trả giá trị mặc định (null cho object, 0/false cho nguyên thuỷ, collection rỗng). spy() bọc quanh instance THẬT nên method chưa stub vẫn chạy code thật. Khi stub spy nên dùng doReturn(x).when(spy).foo() để tránh gọi thật đúng lúc stub.',
  },
  {
    id: 'java-test-stub-vs-verify', topic: 'Testing / Mockito',
    q: 'when(...).thenReturn(...) và verify(...) khác vai trò thế nào?',
    options: [
      'Cả hai đều dùng để kiểm tra một method đã được gọi hay chưa',
      'when/thenReturn STUB giá trị trả về; verify KIỂM TRA tương tác đã xảy ra',
      'when/thenReturn kiểm tra số lần gọi; verify đặt giá trị trả về',
      'verify chỉ dùng cho void method, when chỉ cho method có return',
    ], answer: 1,
    explain: 'when(dep.find(id)).thenReturn(user) là STUBBING — dàn dựng để dependency trả kết quả cần cho kịch bản. verify(dep).save(user) là VERIFICATION — khẳng định tương tác đã diễn ra (đúng số lần, đúng tham số). Stub = chuẩn bị trạng thái; verify = kiểm hành vi. Với void method dùng verify (và doThrow/doNothing để stub).',
  },
  {
    id: 'java-test-injectmocks', topic: 'Testing / Mockito',
    q: '@Mock và @InjectMocks phối hợp để làm gì?',
    options: [
      'Cả hai đều tạo mock rỗng và không liên quan gì tới nhau',
      'Mockito tạo mock rồi TIÊM vào instance thật gắn @InjectMocks',
      '@InjectMocks biến chính class thật thành một đối tượng mock',
      '@Mock chỉ dùng được bên trong test gắn @SpringBootTest',
    ], answer: 1,
    explain: '@InjectMocks tạo đối tượng THẬT cần test và tiêm các @Mock dependency vào (ưu tiên constructor injection). Nhờ đó bạn test logic của lớp đó mà cô lập khỏi DB/HTTP thật. Ở JUnit 5 cần @ExtendWith(MockitoExtension.class) (hoặc MockitoAnnotations.openMocks(this) trong @BeforeEach) để annotation có hiệu lực.',
    code: '@ExtendWith(MockitoExtension.class)\nclass OrderServiceTest {\n  @Mock PaymentGateway gateway;\n  @InjectMocks OrderService service; // gateway được tiêm vào\n}',
  },
  {
    id: 'java-test-slice', topic: 'Testing / Spring',
    q: 'Khác nhau giữa @WebMvcTest và @SpringBootTest khi test ứng dụng Spring Boot?',
    options: [
      'Giống nhau, cả hai đều nạp toàn bộ application context lên',
      '@WebMvcTest chỉ nạp tầng web (MockMvc); @SpringBootTest nạp toàn bộ',
      '@SpringBootTest chỉ test được controller chứ không test service',
      '@WebMvcTest khởi động server thật trên một cổng ngẫu nhiên',
    ], answer: 1,
    explain: '@WebMvcTest chỉ dựng tầng MVC (controller, filter, @ControllerAdvice) + cấp sẵn MockMvc, còn service/repository thì bạn @MockBean — nên rất nhanh và tập trung. @SpringBootTest nạp full ApplicationContext (dùng cho integration test đầu-cuối, có thể kèm webEnvironment=RANDOM_PORT + TestRestTemplate). Ưu tiên slice test cho phản hồi nhanh, để integration test cho luồng quan trọng.',
  },
];
