/**
 * Ngân hàng "⚛️ React" — LÝ THUYẾT CHUYÊN SÂU cho phỏng vấn Frontend/Fullstack.
 * JSX & render, reconciliation & key, state/props, hooks (rules, deps, cleanup),
 * hiệu năng (memo/useMemo/useCallback), context, form, React 18/19 (concurrent, Suspense, RSC).
 *
 * Mỗi câu: { id, topic, q, code?, options:[...], answer:idx, explain }
 */
window.REACT_QUIZ = [
  // ---------- Render & reconciliation ----------
  {
    id: 'react-vdom', topic: 'Render & reconciliation',
    q: 'Virtual DOM giúp React nhanh hơn theo nghĩa nào?',
    options: [
      'Vì thao tác trên virtual DOM nhanh hơn thao tác trên DOM thật khoảng chừng một trăm lần',
      'Vì virtual DOM được chạy trong Web Worker nên không chiếm luồng chính của trình duyệt',
      'Nó không nhanh hơn DOM thủ công tối ưu — lợi ích là DIFF để gom về số thao tác DOM tối thiểu',
      'Vì React lưu toàn bộ cây DOM trong bộ nhớ nên không cần đọc lại thuộc tính từ trình duyệt',
    ], answer: 2,
    explain: 'Virtual DOM là cây object JS mô tả UI. Mỗi lần render, React so cây mới với cây cũ (diff/reconciliation) rồi CHỈ áp các thay đổi cần thiết lên DOM thật. Điểm hay bị hỏi vặn: nó KHÔNG nhanh hơn code DOM thủ công đã tối ưu — thậm chí tốn thêm bộ nhớ và CPU cho việc diff. Giá trị thật nằm ở chỗ bạn viết UI THEO KIỂU KHAI BÁO ("state này thì giao diện trông thế này") mà vẫn có hiệu năng đủ tốt, và mô hình đó chạy được cả trên native (React Native) lẫn server.',
  },
  {
    id: 'react-key', topic: 'Render & reconciliation',
    q: 'Vì sao dùng index của mảng làm `key` lại nguy hiểm?',
    options: [
      'Vì index là số nên React phải ép sang chuỗi mỗi lần render, gây tốn hiệu năng',
      'Vì React cấm dùng key trùng lặp, mà index thì luôn bị lặp lại giữa các lần render khác nhau',
      'Vì key dùng để KHỚP phần tử giữa hai lần render — chèn/xoá làm index lệch, state dính nhầm phần tử',
      'Vì index chỉ hoạt động được với mảng tĩnh, còn mảng động sẽ khiến React ném cảnh báo đỏ',
    ], answer: 2,
    explain: 'Key là DANH TÍNH của phần tử qua các lần render. Với `key={index}`, khi xoá phần tử đầu danh sách thì phần tử thứ 2 "trở thành" index 0 → React tưởng đó vẫn là component cũ, giữ nguyên state nội bộ, giá trị input, vị trí focus, hiệu ứng — nội dung hiển thị nhảy lệch một ô. Dùng ID ỔN ĐỊNH từ dữ liệu. Index chỉ chấp nhận được khi danh sách tĩnh, không sắp xếp, không thêm/xoá và phần tử không có state riêng. Mẹo ngược lại: cố tình ĐỔI key là cách chuẩn để RESET state của một component.',
  },
  {
    id: 'react-recon-type', topic: 'Render & reconciliation',
    q: 'Khi diff, React quyết định giữ hay huỷ một component dựa vào gì?',
    options: [
      'So sánh sâu toàn bộ props để biết component có thay đổi thực sự hay không',
      'Cùng vị trí + cùng TYPE (và cùng key) thì giữ instance & state; khác type thì unmount cả cây con rồi mount lại',
      'Dựa vào việc component có được bọc trong `React.memo` hay không để quyết định giữ lại',
      'Dựa vào số lượng con: nếu số con không đổi thì giữ nguyên, đổi thì dựng lại từ đầu',
    ], answer: 1,
    explain: 'Heuristic O(n) của React: so theo VỊ TRÍ trong cây, cùng type (`div` vs `div`, `Foo` vs `Foo`) và cùng key → cập nhật props, GIỮ state; khác type → huỷ toàn bộ cây con (state, effect cleanup) rồi dựng mới. Hệ quả rất hay gặp: định nghĩa component BÊN TRONG một component khác tạo type MỚI mỗi lần render → cây con bị remount liên tục, state và focus mất sạch. Tương tự, `cond ? <Input/> : <div><Input/></div>` cũng làm mất state vì vị trí thay đổi.',
  },
  {
    id: 'react-pure', topic: 'Render & reconciliation',
    q: 'Vì sao hàm component phải "thuần" (pure) trong lúc render?',
    options: [
      'Vì React chạy render trong một sandbox nên mọi side effect đều bị chặn lại và ném lỗi',
      'Vì hàm thuần được trình duyệt biên dịch sang mã máy nhanh hơn nhiều so với hàm có side effect',
      'Vì React có thể gọi render nhiều lần, bỏ dở hoặc chạy lại — side effect trong render sẽ lặp lại hoặc sai',
      'Vì chỉ hàm thuần mới được phép dùng hooks, hàm có side effect sẽ bị lỗi thứ tự hook',
    ], answer: 2,
    explain: 'Hợp đồng: cùng props/state/context thì render phải trả cùng JSX và KHÔNG đổi gì bên ngoài (không sửa biến ngoài, không gọi API, không set state của component khác, không đụng DOM). Lý do là React ở chế độ concurrent có thể gọi render nhiều lần, tạm dừng rồi bỏ đi kết quả — StrictMode dev cố tình gọi render 2 lần để phơi bày lỗi này. Nơi đúng cho side effect: event handler (phản ứng với hành động người dùng) hoặc `useEffect` (đồng bộ với hệ thống bên ngoài).',
  },
  {
    id: 'react-rerender-why', topic: 'Render & reconciliation',
    q: 'Component render lại khi nào?',
    options: [
      'Chỉ khi props của chính nó thay đổi giá trị so với lần render trước đó',
      'Khi state/context của nó đổi, hoặc khi component CHA render lại (kể cả props không đổi)',
      'Mỗi khi có bất kỳ state nào trong toàn ứng dụng thay đổi giá trị',
      'Chỉ khi DOM thật của nó cần thay đổi, React kiểm tra trước rồi mới gọi hàm render',
    ], answer: 1,
    explain: 'Ba nguyên nhân: (1) gọi setState của chính nó; (2) context nó đang subscribe đổi giá trị; (3) CHA render lại — mặc định React render lại toàn bộ cây con, bất kể props có đổi hay không. Điểm quan trọng: "render lại" ≠ "cập nhật DOM" — nếu output giống hệt thì React không đụng vào DOM, nên phần lớn re-render là RẺ và tối ưu sớm là phản tác dụng. Chỉ khi đo được vấn đề mới cắt bằng `React.memo`, đưa state xuống thấp hơn, hoặc truyền JSX qua `children`.',
  },
  // ---------- State & props ----------
  {
    id: 'react-setstate-async', topic: 'State & props',
    q: 'Vì sao đọc state ngay sau `setCount(count+1)` vẫn ra giá trị cũ?',
    options: [
      'Vì `setState` là hàm bất đồng bộ trả về Promise, phải `await` mới có giá trị mới',
      'Vì biến `count` là hằng số của LẦN RENDER hiện tại; setState chỉ lên lịch render mới với giá trị mới',
      'Vì React lưu state trong bộ nhớ đệm và chỉ đồng bộ lại sau khi DOM được vẽ xong',
      'Vì cần dùng `setCount(count+1, callback)` mới đọc được giá trị vừa cập nhật',
    ], answer: 1,
    explain: 'Mỗi lần render là một "ảnh chụp": biến state, props và các hàm trong đó đều là hằng của lần render ĐÓ (closure). `setCount` không sửa biến `count` hiện tại — nó lên lịch cho một lần render mới, nơi `count` được tính lại. Vì vậy `setCount(c+1)` ba lần liên tiếp chỉ tăng 1; muốn cộng dồn phải dùng bản UPDATER: `setCount(c => c+1)` — React đưa vào hàng đợi và áp lần lượt.',
  },
  {
    id: 'react-batching', topic: 'State & props',
    q: 'Automatic batching trong React 18 nghĩa là gì?',
    options: [
      'React gom nhiều component có cùng cha lại với nhau để render chúng trong một lần duy nhất',
      'React gộp nhiều setState trong CÙNG một tick thành MỘT lần re-render — từ 18 áp dụng cả trong promise/setTimeout',
      'React tự động gom mọi request mạng phát sinh trong cùng một lần render lại thành một batch duy nhất',
      'React trì hoãn mọi cập nhật state lại tới khi trình duyệt rảnh rỗi để ưu tiên cho các hoạt ảnh',
    ], answer: 1,
    explain: 'Batching = gộp nhiều setState thành một lần render để tránh render thừa và tránh UI "nhấp nháy" trạng thái trung gian. Trước 18, batching CHỈ có trong event handler của React; gọi 2 lần setState trong `setTimeout`/`.then` sẽ render 2 lần. React 18 (với `createRoot`) batch ở mọi nơi. Cần thoát khỏi batching để đọc DOM giữa chừng thì dùng `flushSync` — nhưng dùng dè, vì nó ép render đồng bộ và mất lợi ích hiệu năng.',
  },
  {
    id: 'react-immutable', topic: 'State & props',
    q: 'Vì sao không được `state.items.push(x)` rồi `setItems(state.items)`?',
    options: [
      'Vì `push` là hàm bất đồng bộ nên phần tử chưa kịp thêm vào lúc setState chạy',
      'Vì React so sánh state cũ/mới bằng `Object.is` — cùng tham chiếu thì coi như KHÔNG đổi, bỏ qua re-render',
      'Vì mảng state được đóng băng bằng `Object.freeze` nên `push` sẽ ném lỗi ở strict mode',
      'Vì React chỉ chấp nhận state là kiểu nguyên thuỷ, mảng phải bọc trong object trước',
    ], answer: 1,
    explain: 'React dùng so sánh NÔNG theo tham chiếu (`Object.is`) để biết state có đổi không. Mutate rồi set lại chính mảng đó → tham chiếu y hệt → React bỏ qua (và `React.memo`/`useMemo` phía dưới cũng không cập nhật). Luôn tạo giá trị MỚI: `setItems([...items, x])`, `setItems(items.filter(...))`, `setUser({...user, name})`. Với state lồng sâu thì dùng `useReducer`, hoặc Immer (`produce`) để viết code trông như mutate mà vẫn ra object mới. Bonus ES2023: `toSorted`/`toSpliced`/`with` trả mảng mới sẵn.',
  },
  {
    id: 'react-derived', topic: 'State & props',
    q: 'Có `items` trong state, cần hiển thị số item đã hoàn thành. Cách nào đúng?',
    options: [
      'Thêm state `doneCount` và dùng `useEffect` để đồng bộ lại mỗi khi `items` đổi',
      'TÍNH THẲNG trong lúc render: `const done = items.filter(i => i.done).length` — không tạo state mới',
      'Lưu `doneCount` vào `useRef` rồi cập nhật thủ công ở mọi nơi có sửa `items`',
      'Đưa `doneCount` lên context để mọi component con đều đọc được giá trị mới nhất',
    ], answer: 1,
    explain: 'Nguyên tắc: giá trị TÍNH ĐƯỢC từ state khác thì đừng biến thành state. State song song phải đồng bộ bằng effect sẽ gây: render thừa (một lần cho items, một lần cho count), và cửa sổ thời gian mà hai giá trị lệch nhau — nguồn bug kinh điển. Chỉ khi phép tính THỰC SỰ nặng (đo được) mới bọc `useMemo`. Cùng nguyên tắc này áp cho việc "copy props vào state" — chỉ làm khi cố ý muốn giá trị khởi tạo rồi độc lập.',
  },
  {
    id: 'react-lift', topic: 'State & props',
    q: 'Nguyên tắc đặt state ở đâu trong cây component?',
    options: [
      'Đặt hết ở component gốc để mọi nơi đều lấy được, tránh phải truyền props nhiều tầng',
      'Đặt ở tổ tiên chung GẦN NHẤT của những component thực sự cần nó — gần lá nhất có thể',
      'Đặt trong một store toàn cục (Redux/Zustand) cho mọi loại state để nhất quán toàn app',
      'Đặt ở component nào render đầu tiên trong cây, vì nó khởi tạo sớm nhất khi app chạy',
    ], answer: 1,
    explain: 'Colocation: state càng gần nơi dùng thì phạm vi re-render càng nhỏ, code càng dễ hiểu và dễ xoá. Cần chia sẻ giữa hai anh em thì LIFT lên cha chung gần nhất. Chỉ đẩy lên context/store toàn cục khi thực sự nhiều nơi xa nhau cần. Đưa hết lên gốc là phản mẫu: mỗi lần gõ phím là re-render cả cây. Cũng nên phân biệt server state (dữ liệu từ API — dùng React Query/SWR với cache, retry, invalidate) và client state (UI state) — trộn hai thứ vào một store là nguồn phức tạp không cần thiết.',
  },
  {
    id: 'react-key-reset', topic: 'State & props',
    q: 'Cách gọn nhất để RESET toàn bộ state nội bộ của một component khi đổi user?',
    options: [
      'Dùng `useEffect` theo dõi `userId` rồi gọi lần lượt mọi hàm setState về giá trị ban đầu',
      'Truyền `key={userId}` cho component đó — key đổi thì React unmount cái cũ, mount cái mới sạch state',
      'Gọi `component.forceUpdate()` mỗi khi phát hiện `userId` thay đổi giá trị',
      'Bọc component trong `React.memo` với hàm so sánh trả về false khi `userId` đổi',
    ], answer: 1,
    explain: 'Key đổi = danh tính đổi → React huỷ instance cũ (chạy cleanup effect) và mount instance mới với state khởi tạo. Một dòng thay cho cả loạt `setX(initial)` trong effect — vốn dễ sót field, gây render thừa và có một khoảnh khắc hiển thị dữ liệu người dùng cũ. Đây là mẹo được chính docs React khuyến nghị cho form theo item, và cũng dùng để reset animation hay ép remount một widget bên thứ ba.',
  },
  // ---------- Hooks ----------
  {
    id: 'react-hook-rules', topic: 'Hooks',
    q: 'Vì sao không được gọi hook trong `if`, vòng lặp hay hàm lồng?',
    options: [
      'Vì hook dùng biến toàn cục nên gọi lồng nhau sẽ gây tranh chấp giữa các component với nhau',
      'Vì React khớp hook theo THỨ TỰ GỌI mỗi lần render — gọi có điều kiện làm lệch thứ tự, state nhảy lung tung',
      'Vì hook được biên dịch tĩnh thành class method nên phải nằm ở cấp cao nhất của hàm',
      'Vì eslint quy định như vậy để code dễ đọc, còn về mặt runtime thì hoàn toàn an toàn',
    ], answer: 1,
    explain: 'React KHÔNG biết tên hook — mỗi component giữ một danh sách hook theo thứ tự, mỗi lần render nó đọc lần lượt phần tử 1, 2, 3... Nếu lần render này bỏ qua `useState` đầu vì `if` không thoả, mọi hook phía sau bị lệch một bậc: state của hook A rơi vào hook B, hoặc lỗi "Rendered fewer hooks than expected". Vì thế: luôn gọi hook ở CẤP CAO NHẤT, và đặt điều kiện BÊN TRONG hook (`useEffect(() => { if (!on) return; ... })`). Plugin `eslint-plugin-react-hooks` bắt lỗi này.',
  },
  {
    id: 'react-usestate-lazy', topic: 'Hooks',
    q: '`useState(expensiveInit())` và `useState(() => expensiveInit())` khác gì nhau?',
    options: [
      'Không khác gì, React nhận ra hàm khởi tạo và tự động chỉ gọi nó ở lần render đầu',
      'Cách 2 là "lazy initializer": hàm chỉ chạy ở lần render ĐẦU; cách 1 gọi lại mỗi lần render rồi vứt kết quả',
      'Cách 2 khiến state được khởi tạo bất đồng bộ nên lần render đầu nhận `undefined`',
      'Cách 1 lưu state ngoài component còn cách 2 lưu bên trong closure của lần render đó',
    ], answer: 1,
    explain: '`useState(x)` là lời gọi HÀM bình thường — biểu thức `expensiveInit()` được tính ở MỌI lần render, chỉ là từ lần 2 trở đi React bỏ qua giá trị. Với việc nặng (đọc localStorage, parse JSON lớn, tạo mảng lớn) thì lãng phí rõ rệt. Truyền HÀM vào thì React chỉ gọi khi khởi tạo. Cùng ý tưởng đó với `useRef(create())` — nếu tốn kém thì phải tự lười hoá (`if (ref.current === null) ref.current = create()`).',
  },
  {
    id: 'react-effect-deps', topic: 'Hooks',
    q: 'Mảng dependency của `useEffect` có ý nghĩa gì?',
    options: [
      'Danh sách biến mà effect được phép truy cập, biến ngoài danh sách sẽ là `undefined`',
      'Thứ tự ưu tiên chạy các effect, effect có nhiều dependency hơn sẽ được chạy trước',
      'React so sánh NÔNG từng phần tử với lần trước; khác thì cleanup effect cũ rồi chạy lại effect',
      'Danh sách state sẽ được cập nhật tự động sau khi effect chạy xong một lượt',
    ], answer: 2,
    explain: 'So sánh bằng `Object.is` từng phần tử. `[]` = chỉ chạy sau lần mount (và cleanup khi unmount); bỏ hẳn mảng = chạy sau MỌI lần render. Bẫy phổ biến nhất: để object/mảng/hàm tạo mới mỗi render vào deps → luôn khác → effect chạy vô hạn (thường kèm setState bên trong). Cách chữa: đưa giá trị nguyên thuỷ vào deps (`user.id` thay vì `user`), `useCallback`/`useMemo` cho hàm/object, hoặc chuyển logic ra ngoài effect. Đừng nói dối deps để "cho hết vòng lặp" — sẽ thành stale closure.',
  },
  {
    id: 'react-effect-cleanup', topic: 'Hooks',
    q: 'Hàm trả về từ `useEffect` (cleanup) chạy lúc nào?',
    options: [
      'Chỉ chạy đúng một lần khi component bị unmount khỏi cây component',
      'Chạy TRƯỚC mỗi lần effect chạy lại (khi deps đổi) và một lần cuối khi unmount',
      'Chạy ngay sau khi effect chính thực thi xong, trong cùng một lần render',
      'Chạy khi có lỗi xảy ra bên trong effect, đóng vai trò như một khối catch',
    ], answer: 1,
    explain: 'Cleanup chạy trước mỗi lần chạy lại effect VÀ khi unmount — vì thế "mỗi effect phải tự dọn đúng thứ nó tạo ra": `clearInterval`, `removeEventListener`, `socket.close()`, `controller.abort()`, huỷ subscription. Ứng dụng quan trọng nhất là chống RACE CONDITION khi fetch: dùng cờ `ignore` hoặc `AbortController` để phản hồi của request cũ không ghi đè kết quả mới. StrictMode dev cố tình mount → unmount → mount lại để phơi bày effect thiếu cleanup.',
  },
  {
    id: 'react-effect-abuse', topic: 'Hooks',
    q: 'Trường hợp nào KHÔNG nên dùng `useEffect`?',
    options: [
      'Đăng ký subscription tới một store bên ngoài React và huỷ khi component unmount',
      'Đồng bộ tiêu đề trang (`document.title`) theo state hiện tại của component',
      'Biến đổi dữ liệu để hiển thị, và xử lý sự kiện do NGƯỜI DÙNG gây ra (submit, click)',
      'Kết nối tới một WebSocket khi component xuất hiện và đóng nó khi rời đi',
    ], answer: 2,
    explain: '`useEffect` dành cho việc ĐỒNG BỘ với hệ thống BÊN NGOÀI React (DOM, timer, network, thư viện ngoài). Hai lạm dụng phổ biến: (1) biến đổi dữ liệu để hiển thị — hãy tính thẳng khi render (hoặc `useMemo` nếu nặng); (2) chạy logic phản ứng với hành động người dùng — hãy đặt trong EVENT HANDLER, vì ở đó bạn biết chính xác chuyện gì vừa xảy ra, còn effect thì không. Đọc "You Might Not Need an Effect" trong docs React — chủ đề được hỏi rất nhiều.',
  },
  {
    id: 'react-uselayouteffect', topic: 'Hooks',
    q: '`useLayoutEffect` khác `useEffect` thế nào?',
    options: [
      '`useLayoutEffect` chạy ĐỒNG BỘ sau khi DOM cập nhật nhưng TRƯỚC khi trình duyệt vẽ — tránh nhấp nháy',
      '`useLayoutEffect` chỉ chạy lại mỗi khi kích thước cửa sổ của trình duyệt thay đổi',
      '`useLayoutEffect` chạy trước khi component render, dùng để chuẩn bị dữ liệu cho render',
      'Hai hook giống hệt nhau, `useLayoutEffect` chỉ là tên cũ được giữ lại cho tương thích ngược',
    ], answer: 0,
    explain: 'Thứ tự: React cập nhật DOM → chạy `useLayoutEffect` (đồng bộ, chặn paint) → trình duyệt vẽ → chạy `useEffect` (bất đồng bộ). Dùng `useLayoutEffect` khi cần ĐO DOM (`getBoundingClientRect`) rồi chỉnh ngay vị trí (tooltip, popover, scroll) — nếu làm trong `useEffect` người dùng sẽ thấy một khung hình sai rồi mới nhảy. Cái giá: chặn paint nên tránh việc nặng; và nó không chạy khi SSR (cảnh báo trên server) — cần thì dùng `useIsomorphicLayoutEffect`. Mặc định luôn ưu tiên `useEffect`.',
  },
  {
    id: 'react-useref', topic: 'Hooks',
    q: '`useRef` khác `useState` ở điểm cốt lõi nào?',
    options: [
      '`useRef` chỉ chứa được tham chiếu tới DOM node, không lưu được giá trị JS thường',
      '`useRef` giữ giá trị qua các lần render nhưng SỬA nó KHÔNG gây re-render, và đọc được giá trị mới nhất ngay',
      '`useRef` lưu giá trị bên ngoài component nên mọi instance của component đều dùng chung',
      '`useRef` được reset về giá trị khởi tạo sau mỗi lần component render lại',
    ], answer: 1,
    explain: '`useRef` là một "ô nhớ" (`{current}`) sống suốt vòng đời instance; gán `ref.current = x` là mutate, KHÔNG lên lịch render. Dùng cho: tham chiếu DOM, lưu id của timer/interval, giữ giá trị trước đó, cờ "đã mount", hoặc giá trị mới nhất để tránh stale closure. Quy tắc: cái gì HIỂN THỊ ra UI thì phải là state; cái gì chỉ là ghi chú nội bộ thì dùng ref. Không được đọc/ghi `ref.current` TRONG lúc render (vi phạm tính thuần) — chỉ làm trong effect hoặc event handler.',
  },
  {
    id: 'react-stale-closure', topic: 'Hooks',
    q: '"Stale closure" trong hooks là hiện tượng gì?',
    options: [
      'Component giữ lại DOM node cũ sau khi bị unmount, gây rò rỉ bộ nhớ dần theo thời gian',
      'React cache lại kết quả render cũ và trả về nhầm khi props quay lại đúng giá trị trước đó',
      'Callback (trong effect/timer/listener) bắt giữ state của LẦN RENDER cũ và cứ đọc giá trị lỗi thời đó',
      'Hook bị gọi sai thứ tự khiến state của component này lẫn sang component khác',
    ], answer: 2,
    explain: 'Ví dụ kinh điển: `useEffect(() => { const id = setInterval(() => setCount(count+1), 1000); return () => clearInterval(id) }, [])` — callback đóng gói `count` của lần render đầu (0) nên mãi mãi set về 1. Ba cách chữa: (1) dùng updater `setCount(c => c+1)` để không cần đọc state; (2) khai báo đủ deps (chấp nhận effect chạy lại); (3) giữ giá trị mới nhất trong `useRef`. Cùng bệnh đó xảy ra với event listener đăng ký một lần và với `useCallback` khai thiếu deps.',
  },
  {
    id: 'react-usereducer', topic: 'Hooks',
    q: 'Khi nào nên dùng `useReducer` thay `useState`?',
    options: [
      'Khi state chỉ là số hoặc chuỗi đơn giản, vì reducer xử lý kiểu nguyên thuỷ hiệu quả hơn hẳn',
      'Khi cần chia sẻ state giữa nhiều component nằm ở các nhánh khác nhau của cây component',
      'Khi state phức tạp, nhiều field ràng buộc nhau — gom mọi cách chuyển trạng thái vào một hàm thuần dễ test',
      'Khi muốn state được lưu tự động vào localStorage sau mỗi lần dispatch action',
    ], answer: 2,
    explain: '`useReducer` gom mọi cách chuyển trạng thái vào MỘT hàm thuần `(state, action) => newState` — dễ test (không cần render), dễ đọc lịch sử thay đổi, tránh cảnh 6 lời gọi setState rải rác phải gọi đúng thứ tự. Rất hợp cho form nhiều bước, state kiểu máy trạng thái (idle/loading/success/error), undo-redo. Nó KHÔNG giải quyết việc chia sẻ state — muốn chia sẻ vẫn phải kết hợp Context hoặc store. `dispatch` có danh tính ổn định nên truyền xuống con mà không phá `React.memo`.',
  },
  {
    id: 'react-custom-hook', topic: 'Hooks',
    q: 'Hai component cùng dùng `useCounter()` thì chúng chia sẻ state không?',
    options: [
      'Có, custom hook tạo một state dùng chung cho mọi component gọi nó',
      'KHÔNG — custom hook chia sẻ LOGIC chứ không chia sẻ state; mỗi lần gọi tạo state độc lập',
      'Có, nhưng chỉ khi hai component nằm trong cùng một cây con của một provider',
      'Tuỳ chọn, nếu khai báo hook bằng `useSharedState` thì mới dùng chung state',
    ], answer: 1,
    explain: 'Custom hook chỉ là một hàm gọi các hook khác — mỗi lần gọi là một bộ state riêng, y như gọi `useState` hai lần ở hai component. Đây là điểm khác biệt với mixin/HOC thời trước và là câu hỏi rất hay dùng để kiểm tra hiểu bản chất. Muốn CHIA SẺ state thật thì phải nâng lên: Context, store bên ngoài (Zustand/Redux) hoặc `useSyncExternalStore`. Quy ước tên phải bắt đầu bằng `use` để lint kiểm tra được quy tắc hook.',
  },
  // ---------- Hiệu năng ----------
  {
    id: 'react-memo', topic: 'Hiệu năng',
    q: '`React.memo(Component)` làm gì và khi nào nó VÔ DỤNG?',
    options: [
      'Cache kết quả render theo state nội bộ; vô dụng khi component không có state riêng',
      'So sánh NÔNG props để bỏ qua re-render; vô dụng khi cha truyền object/hàm/JSX tạo mới mỗi lần render',
      'Ghi nhớ giá trị trả về của mọi hàm bên trong component; vô dụng khi component chỉ render JSX tĩnh',
      'Trì hoãn render tới khi trình duyệt rảnh; vô dụng khi ứng dụng đang có hoạt ảnh chạy nền',
    ], answer: 1,
    explain: '`memo` so sánh nông từng prop; giống hết thì bỏ qua render cây con. Nó THẤT BẠI khi cha truyền `style={{...}}`, `onClick={() => ...}`, `items={data.filter(...)}` hay `children` là JSX inline — mỗi render một tham chiếu mới nên so sánh luôn khác. Muốn có tác dụng phải kết hợp `useMemo`/`useCallback` ở cha, khiến code rườm rà. Thường giải pháp tốt hơn là cấu trúc lại: đưa state xuống gần chỗ dùng, hoặc truyền JSX qua `children` để phần đó không bị render lại. (React Compiler ra đời chính để tự động hoá việc này.)',
  },
  {
    id: 'react-usememo', topic: 'Hiệu năng',
    q: '`useMemo` nên dùng khi nào?',
    options: [
      'Bọc mọi phép tính trong component để chắc chắn không có gì bị tính lại thừa',
      'Chỉ khi phép tính THỰC SỰ tốn kém (đo được), hoặc cần giữ ỔN ĐỊNH tham chiếu cho deps/`memo`',
      'Bất cứ khi nào một giá trị được dùng ở nhiều chỗ trong cùng một component',
      'Khi cần lưu kết quả qua nhiều lần mount/unmount của component để tránh tính lại',
    ], answer: 1,
    explain: 'Hai lý do chính đáng: (1) phép tính nặng thật (lọc/sắp xếp mảng lớn, tính toán phức tạp) — đo trước bằng Profiler; (2) cần tham chiếu ổn định vì giá trị đó đi vào deps của effect hoặc props của một component `memo`. Ngoài hai lý do đó, `useMemo` là chi phí ròng: nó vẫn phải chạy hàm so sánh deps, tốn bộ nhớ, và làm code khó đọc. Lưu ý `useMemo` KHÔNG đảm bảo cache sống mãi — React có quyền bỏ cache; đừng dùng nó cho logic bắt buộc phải giữ.',
  },
  {
    id: 'react-usecallback', topic: 'Hiệu năng',
    q: '`useCallback(fn, deps)` tương đương với gì?',
    options: [
      '`useMemo(() => fn, deps)` — ghi nhớ chính HÀM đó để danh tính không đổi giữa các lần render',
      '`useRef(fn)` — lưu hàm vào ô nhớ và không bao giờ tạo lại nó nữa',
      '`useEffect(() => fn, deps)` — chạy lại hàm mỗi khi dependency thay đổi giá trị',
      '`useMemo(() => fn(), deps)` — ghi nhớ KẾT QUẢ của việc gọi hàm đó',
    ], answer: 0,
    explain: '`useCallback(fn, deps)` chỉ là đường tắt của `useMemo(() => fn, deps)`. Nó ghi nhớ chính hàm, KHÔNG gọi hàm. Mục đích duy nhất là giữ DANH TÍNH ổn định — có ý nghĩa khi hàm được truyền cho component bọc `memo`, đưa vào deps của `useEffect`, hoặc dùng làm key trong một cache. Bọc `useCallback` cho một hàm chỉ dùng nội bộ hoặc truyền cho `<button onClick>` là vô ích, thậm chí tốn thêm. Nhớ: `useCallback` chỉ phát huy khi PHÍA NHẬN có memo hoá.',
  },
  {
    id: 'react-context-rerender', topic: 'Hiệu năng',
    q: 'Vì sao Context hay gây re-render hàng loạt và chữa thế nào?',
    options: [
      'Vì context ghi giá trị vào global scope nên mọi component đều phải kiểm tra lại giá trị mới nhất',
      'Vì `React.memo` không có tác dụng gì với context; chữa bằng cách bỏ memo và dùng shouldComponentUpdate',
      'Vì mọi consumer render lại khi `value` đổi THAM CHIẾU; chữa bằng memo hoá value hoặc tách nhỏ context ra',
      'Vì context không hỗ trợ so sánh nông nên React phải so sánh sâu toàn bộ object mỗi lần',
    ], answer: 2,
    explain: 'Mọi component `useContext` sẽ render lại khi `value` thay đổi tham chiếu — kể cả khi nó chỉ dùng một field không đổi, và `React.memo` KHÔNG chặn được (context bỏ qua memo). Ba cách chữa: (1) `value={useMemo(() => ({a,b}), [a,b])}`; (2) TÁCH context theo nhịp thay đổi — ví dụ `UserContext` (ít đổi) riêng với `ThemeContext`, và tách context chứa `dispatch` (ổn định) khỏi context chứa state; (3) với state đổi liên tục thì dùng store ngoài (Zustand/Redux) có cơ chế selector chỉ đánh thức component thật sự quan tâm.',
  },
  {
    id: 'react-virtual', topic: 'Hiệu năng',
    q: 'Render danh sách 10.000 dòng bị giật — hướng xử lý đúng nhất?',
    options: [
      'Bọc mỗi dòng trong `React.memo` để những dòng không đổi thì không phải render lại nữa',
      'Dùng VIRTUALIZATION: chỉ render các dòng đang nằm trong khung nhìn, kèm phân trang hoặc cuộn vô hạn',
      'Chuyển sang `useReducer` để gom hết các cập nhật của danh sách vào trong một lần dispatch',
      'Đổi `key` sang một giá trị ngẫu nhiên để React nhận biết được dòng nào cần cập nhật lại',
    ], answer: 1,
    explain: 'Vấn đề gốc là SỐ LƯỢNG DOM NODE (10.000 dòng × nhiều phần tử con) — trình duyệt tốn bộ nhớ và thời gian layout/paint, `memo` không cứu được vì lần render ĐẦU vẫn phải tạo đủ. Virtualization chỉ dựng ~20–30 dòng nhìn thấy và tái sử dụng khi cuộn. Kết hợp: phân trang/cuộn vô hạn ở tầng API, `content-visibility: auto` cho phần ngoài màn hình, và giảm độ phức tạp của mỗi dòng. (Lưu ý: key ngẫu nhiên là PHẢN mẫu — nó ép remount toàn bộ mỗi lần render.)',
  },
  {
    id: 'react-transition', topic: 'Hiệu năng',
    q: '`useTransition` / `useDeferredValue` dùng để làm gì?',
    options: [
      'Tạo hiệu ứng chuyển cảnh CSS mượt mà mỗi khi component xuất hiện hoặc biến mất khỏi trang',
      'Đánh dấu cập nhật là KHÔNG khẩn cấp để React ưu tiên tương tác gấp và bỏ dở được việc render nặng',
      'Trì hoãn việc gọi API lại cho tới khi người dùng ngừng thao tác, y hệt như cơ chế debounce',
      'Chuyển việc render sang Web Worker để không chiếm luồng chính của trình duyệt',
    ], answer: 1,
    explain: 'React 18 phân biệt cập nhật KHẨN (gõ phím, click — phải phản hồi tức thì) và KHÔNG khẩn (lọc danh sách lớn, chuyển tab nặng). `startTransition(() => setQuery(v))` đánh dấu loại sau: React vẫn cập nhật ô input ngay, còn phần nặng được render ở mức ưu tiên thấp, có thể BỎ DỞ nếu người dùng gõ tiếp — điều mà debounce không làm được (debounce chỉ trì hoãn). `isPending` để hiện trạng thái mờ. `useDeferredValue(value)` là biến thể khi bạn chỉ nhận được giá trị chứ không kiểm soát chỗ setState.',
  },
  // ---------- Form, sự kiện, lỗi ----------
  {
    id: 'react-controlled', topic: 'Form & sự kiện',
    q: 'Controlled và uncontrolled input khác nhau thế nào?',
    options: [
      'Controlled dùng cho form đăng nhập, uncontrolled dùng cho form tìm kiếm theo quy ước chung',
      'Controlled: React state là nguồn sự thật (`value` + `onChange`); uncontrolled: DOM giữ giá trị, đọc qua `ref`/`defaultValue`',
      'Controlled tự động validate dữ liệu trước khi submit, uncontrolled thì phải validate thủ công',
      'Controlled chỉ dùng được trong component class, uncontrolled dành cho function component',
    ], answer: 1,
    explain: 'Controlled: `value={state} onChange={e => setState(e.target.value)}` — mọi phím gõ đi qua React nên dễ validate/format/điều khiển ngay lúc gõ, đổi lại là re-render mỗi ký tự (form lớn cần tách component). Uncontrolled: `defaultValue` + `ref.current.value` lúc submit — ít render, gần với form HTML thuần, hợp với file input (vốn BẮT BUỘC uncontrolled). Lỗi kinh điển: truyền `value={undefined}` rồi sau đó truyền giá trị → React cảnh báo "đổi từ uncontrolled sang controlled"; luôn khởi tạo bằng `""`.',
  },
  {
    id: 'react-synthetic', topic: 'Form & sự kiện',
    q: 'Synthetic event của React là gì?',
    options: [
      'Sự kiện do React tự tạo ra, hoàn toàn không liên quan gì tới sự kiện gốc của trình duyệt',
      'Lớp bọc chuẩn hoá sự kiện DOM giữa các trình duyệt; React gắn listener ở gốc rồi tự phân phối xuống',
      'Cơ chế cho phép gửi sự kiện tuỳ ý giữa hai component không có quan hệ cha con',
      'Sự kiện chỉ chạy trong môi trường test, còn khi build production thì dùng sự kiện DOM thật',
    ], answer: 1,
    explain: 'React không gắn listener lên từng node; nó gắn ở CONTAINER GỐC (từ React 17 là root container, trước đó là `document`) và tự phân phối theo cây component — tiết kiệm bộ nhớ và cho phép batching. `SyntheticEvent` chuẩn hoá thuộc tính giữa các trình duyệt, có `e.nativeEvent` nếu cần bản gốc. Hệ quả phải nhớ: `e.stopPropagation()` của React chỉ chặn trong cây React, không chặn listener native gắn ngoài; và thứ tự giữa handler React với `addEventListener` thủ công có thể ngược với trực giác.',
  },
  {
    id: 'react-error-boundary', topic: 'Xử lý lỗi',
    q: 'Error boundary bắt được loại lỗi nào?',
    options: [
      'Mọi lỗi trong ứng dụng, kể cả lỗi trong event handler lẫn lỗi trong code bất đồng bộ',
      'Lỗi khi render, trong lifecycle và constructor của cây con — KHÔNG bắt lỗi trong event handler hay code async',
      'Chỉ bắt được lỗi mạng khi gọi API thất bại, còn các lỗi khác thì phải tự dùng try/catch',
      'Chỉ bắt được lỗi trong chính component khai báo nó, không bắt được lỗi của component con',
    ], answer: 1,
    explain: 'Error boundary (component class cài `static getDerivedStateFromError` và/hoặc `componentDidCatch`, hoặc dùng `react-error-boundary`) bắt lỗi xảy ra TRONG quá trình render/lifecycle của cây con và hiển thị UI dự phòng thay vì làm trắng cả trang. Nó KHÔNG bắt: lỗi trong event handler (dùng `try/catch` bình thường), lỗi trong `setTimeout`/promise, lỗi trong chính error boundary đó, và lỗi SSR. Thực tế nên đặt nhiều boundary theo từng vùng (mỗi widget/route) để một phần hỏng không kéo sập cả trang.',
  },
  {
    id: 'react-strictmode', topic: 'Công cụ & môi trường',
    q: '`<StrictMode>` làm gì trong môi trường development?',
    options: [
      'Bật kiểm tra kiểu chặt chẽ cho props, thiếu khai báo propTypes sẽ báo lỗi ngay khi build',
      'Chạy render và effect HAI LẦN (mount → unmount → mount) để phơi bày side effect và effect thiếu cleanup',
      'Chặn mọi API đã bị deprecated, dùng tới sẽ khiến ứng dụng dừng chạy lại ngay lập tức',
      'Bật chế độ concurrent rendering cho toàn bộ ứng dụng thay vì render đồng bộ như cũ',
    ], answer: 1,
    explain: 'StrictMode CHỈ hoạt động ở dev, không có tác dụng khi build production. Nó cố tình gọi component/initializer/updater hai lần để lộ ra render không thuần, và mount-unmount-mount để lộ ra effect không cleanup (nguồn gốc của double-fetch, listener nhân đôi, kết nối rò rỉ). Nếu code "hỏng vì StrictMode" thì thực ra code đã có lỗi sẵn — đặc biệt sẽ lộ ra khi React tái sử dụng state ở các tính năng tương lai. Nó cũng cảnh báo API cũ (`findDOMNode`, legacy context, string ref).',
  },
  // ---------- React hiện đại ----------
  {
    id: 'react-suspense', topic: 'React hiện đại',
    q: '`Suspense` giải quyết vấn đề gì?',
    options: [
      'Tạm dừng toàn bộ ứng dụng lại khi mạng chậm để tránh hiển thị dữ liệu chưa đầy đủ',
      'Bắt lỗi trong cây con và hiển thị giao diện dự phòng, thay thế cho error boundary',
      'Cho phép component "chờ" (code split qua `lazy`, hoặc dữ liệu) rồi hiện `fallback` một cách khai báo',
      'Cache kết quả gọi API lại để lần sau vào cùng trang thì không phải tải lại dữ liệu',
    ], answer: 2,
    explain: '`<Suspense fallback={<Skeleton/>}>` khai báo "trong khi phần này chưa sẵn sàng thì hiện cái kia" — thay cho việc rải `if (isLoading)` khắp component. Dùng phổ biến nhất với `React.lazy` để tách bundle theo route. Với DỮ LIỆU thì cần nguồn tương thích Suspense (React Query, Relay, framework như Next.js, hoặc `use()` trong RSC) chứ `fetch` trần không tự chạy. Suspense còn cho phép SSR streaming: server gửi HTML từng phần thay vì chờ toàn bộ dữ liệu. Nó KHÔNG bắt lỗi — lỗi vẫn cần error boundary bọc cùng.',
  },
  {
    id: 'react-lazy', topic: 'React hiện đại',
    q: '`React.lazy(() => import("./Chart"))` mang lại lợi ích gì?',
    options: [
      'Trì hoãn việc render component lại tới khi người dùng cuộn tới đúng vị trí của nó trên trang',
      'CODE SPLITTING: bundler tách component thành chunk riêng, chỉ tải khi thực sự cần tới',
      'Giảm số lần re-render bằng cách chỉ dựng lại component mỗi khi props của nó thay đổi',
      'Nạp component ở chế độ nền ngay khi trang khởi động để lần dùng đầu không phải chờ',
    ], answer: 1,
    explain: 'Dynamic `import()` cho bundler tín hiệu tách chunk. Component chỉ được tải qua mạng khi lần đầu render → giảm JS phải parse/execute lúc khởi động, cải thiện LCP/TTI. Ranh giới tách hợp lý: theo route, theo modal/tab nặng, theo thư viện lớn (biểu đồ, editor, bản đồ). Bắt buộc bọc trong `<Suspense>` để có fallback, và nên bọc error boundary vì tải chunk có thể thất bại (mạng lỗi, deploy mới làm chunk cũ biến mất). Muốn mượt hơn thì preload chunk khi người dùng hover vào link.',
  },
  {
    id: 'react-usesyncexternal', topic: 'React hiện đại',
    q: '`useSyncExternalStore` sinh ra để làm gì?',
    options: [
      'Đồng bộ state của React lên phía server theo thời gian thực thông qua WebSocket',
      'Đăng ký vào store NGOÀI React (Redux, `matchMedia`…) an toàn với concurrent rendering — tránh tearing',
      'Thay thế cho `useEffect` ở mọi trường hợp cần đọc dữ liệu bất đồng bộ từ bên ngoài',
      'Chia sẻ state giữa nhiều tab trình duyệt khác nhau của cùng một ứng dụng web',
    ], answer: 1,
    explain: 'Concurrent rendering có thể tạm dừng và tiếp tục render; nếu store ngoài đổi giữa chừng, các phần của cây có thể đọc ra hai giá trị KHÁC NHAU trong cùng một khung hình — hiện tượng "tearing". `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` cho React kiểm soát việc đọc để đảm bảo nhất quán. Các thư viện state hiện đại đều dùng nó bên trong. Bạn cũng dùng trực tiếp được cho `window.matchMedia`, `navigator.onLine`, kích thước cửa sổ — sạch hơn cách `useState` + `useEffect` truyền thống và đúng cả khi SSR (nhờ `getServerSnapshot`).',
  },
  {
    id: 'react-rsc', topic: 'React hiện đại',
    q: 'React Server Component (RSC) khác Client Component ở chỗ nào?',
    options: [
      'RSC chạy trên server, không gửi JS xuống client, truy vấn DB trực tiếp — nhưng KHÔNG có state hay effect',
      'RSC chỉ là tên gọi mới của SSR truyền thống: vẫn render HTML rồi hydrate lại toàn bộ ở client',
      'RSC chạy ở client nhưng dữ liệu được lấy sẵn từ server nên hiển thị nhanh hơn',
      'RSC chỉ khác ở chỗ được cache sẵn trên CDN, còn khả năng dùng hooks thì vẫn hoàn toàn như nhau',
    ], answer: 0,
    explain: 'RSC render trên server và gửi xuống một mô tả UI đã dựng sẵn; code của nó KHÔNG nằm trong bundle client → giảm mạnh JS (ví dụ thư viện markdown, SDK DB). Đổi lại RSC không có tương tác: không `useState`, `useEffect`, `onClick`. Phần cần tương tác đánh dấu `"use client"`. Khác SSR truyền thống: SSR render HTML rồi vẫn phải gửi JS xuống hydrate toàn bộ cây; RSC chỉ hydrate các đảo client. Mô hình thực dụng: RSC lo lấy dữ liệu và bố cục, client component lo tương tác — ranh giới đặt càng sâu càng tốt.',
  },
  {
    id: 'react-hydration', topic: 'React hiện đại',
    q: 'Lỗi "Hydration failed: text content does not match" xảy ra vì sao?',
    options: [
      'Vì server phản hồi chậm hơn thời gian chờ mặc định nên client bỏ qua phần HTML nhận được',
      'Vì HTML server render KHÁC cây React client dựng ở lần đầu — do `Date.now()`, `localStorage` hay HTML lồng sai',
      'Vì bundle JS phía client cũ hơn phiên bản đang chạy trên server nên hai bên không khớp nhau',
      'Vì component dùng CSS-in-JS mà style chưa được chèn vào trang trước lúc hydrate',
    ], answer: 1,
    explain: 'Hydration là việc React gắn event listener và state vào HTML sẵn có từ server — nó GIẢ ĐỊNH cây render đầu ở client giống hệt HTML server. Khác nhau thì React cảnh báo (và trước 18 thì sửa im lặng, gây bug khó tìm). Thủ phạm quen mặt: giá trị phụ thuộc thời gian/ngẫu nhiên, API chỉ có ở trình duyệt (`window`, `localStorage`, `navigator`), định dạng ngày/số theo locale máy, và HTML không hợp lệ (`<div>` trong `<p>`) khiến trình duyệt tự sửa cấu trúc. Cách chữa: render giá trị đó sau khi mount (`useEffect` + cờ), hoặc `suppressHydrationWarning` cho trường hợp cố ý.',
  },
  {
    id: 'react-portal', topic: 'React hiện đại',
    q: '`createPortal` render con ra ngoài cây DOM cha — sự kiện thì sao?',
    options: [
      'Sự kiện nổi bọt theo cây DOM THẬT, nên component cha trong React không nhận được',
      'Sự kiện nổi bọt theo cây REACT: cha vẫn bắt được, dù DOM node nằm ở nơi khác',
      'Sự kiện bị chặn hoàn toàn ở ranh giới portal, phải tự chuyển tiếp bằng callback',
      'Sự kiện chỉ nổi bọt được khi portal render vào trong cùng một phần tử cha gốc',
    ], answer: 1,
    explain: 'Portal đổi vị trí trong DOM (thường là `document.body` để thoát khỏi `overflow: hidden`, `z-index`, `transform` của cha — dùng cho modal, tooltip, dropdown) nhưng GIỮ NGUYÊN vị trí trong cây React: context vẫn kế thừa, và sự kiện vẫn nổi bọt lên component cha theo cây React. Điều này rất tiện (modal vẫn đọc được context theme) nhưng cũng là bẫy: click trong modal có thể kích hoạt `onClick` của cha logic — nhớ `stopPropagation` khi cần. Modal còn phải tự lo focus trap, `Esc`, và `aria-modal` cho accessibility.',
  },
  {
    id: 'react-fragment', topic: 'React hiện đại',
    q: 'Vì sao cần Fragment (`<>...</>`)?',
    options: [
      'Để nhóm nhiều phần tử con mà KHÔNG thêm DOM node thừa — tránh phá layout flex/grid và bảng',
      'Để React biết nhóm phần tử này cần được render trước các phần tử khác trong cây',
      'Để bọc các phần tử cần chia sẻ chung một context mà không phải tạo provider mới',
      'Để đánh dấu vùng có thể được cập nhật độc lập, giúp React tối ưu quá trình diff',
    ], answer: 0,
    explain: 'Component phải trả về MỘT node gốc. Trước đây phải bọc `<div>` thừa — làm hỏng layout của `display:flex`/`grid` (con trực tiếp bị đổi), phá cấu trúc HTML hợp lệ (`<tr>` phải là con trực tiếp của `<tbody>`), và làm cây DOM phình ra. Fragment nhóm về mặt logic mà không sinh phần tử. Khi render danh sách fragment cần key thì phải viết dạng đầy đủ `<React.Fragment key={id}>` — cú pháp ngắn `<>` không nhận prop.',
  },
  {
    id: 'react-ref-forward', topic: 'React hiện đại',
    q: 'Muốn component cha lấy được DOM node bên trong component con thì làm sao?',
    options: [
      'Truyền prop tên `ref` như bình thường — mọi component React đều tự chuyển tiếp ref đó xuống DOM node',
      'Dùng `forwardRef` (React ≤18) hoặc nhận `ref` như prop thường (React 19); cần API tuỳ biến thì `useImperativeHandle`',
      'Dùng `document.querySelector` bên trong `useEffect` để tìm node theo class hoặc id của nó',
      'Không có cách nào cả, ranh giới component luôn cô lập hoàn toàn mọi DOM node bên trong',
    ], answer: 1,
    explain: '`ref` không phải prop thường ở React ≤18 — truyền thẳng sẽ bị cảnh báo và nhận `null`; phải bọc `forwardRef((props, ref) => ...)`. React 19 đơn giản hoá: function component nhận `ref` như prop bình thường, `forwardRef` không còn cần. Khi không muốn lộ nguyên DOM node, dùng `useImperativeHandle(ref, () => ({ focus, scrollToTop }))` để chỉ lộ đúng API cần thiết. Nhớ nguyên tắc: ref là "cửa thoát hiểm" — ưu tiên props/state khai báo, chỉ dùng ref cho focus, đo đạc, cuộn, và tích hợp thư viện ngoài.',
  },
  {
    id: 'react-optimistic', topic: 'React hiện đại',
    q: 'Cập nhật lạc quan (optimistic update) trong UI nghĩa là gì?',
    options: [
      'Gửi request nhiều lần cho tới khi thành công để đảm bảo thao tác không bị mất',
      'Cập nhật UI NGAY như thể thao tác đã thành công, rồi hoàn tác nếu server trả về lỗi',
      'Tải trước dữ liệu của trang kế tiếp để chuyển trang diễn ra tức thời',
      'Bỏ qua trạng thái loading và chỉ hiển thị kết quả khi server đã xác nhận xong',
    ], answer: 1,
    explain: 'Thay vì "bấm like → xoay vòng → 300ms sau mới đổi màu", UI đổi ngay và ĐỒNG BỘ lại nếu server báo lỗi (hoàn tác + báo lỗi). Cảm giác tức thì, rất hợp cho like, thêm todo, gửi tin nhắn. Điều kiện: thao tác có xác suất thành công cao và hoàn tác được — đừng dùng cho thanh toán hay thao tác không thể đảo. React 19 có `useOptimistic` cho việc này; React Query có `onMutate` + rollback. Nhớ khoá chống bấm nhiều lần và đảm bảo API idempotent.',
  },
  {
    id: 'react-key-vs-state', topic: 'Render & reconciliation',
    q: 'Vì sao KHÔNG nên định nghĩa component con bên trong hàm component cha?',
    options: [
      'Vì component con sẽ không truy cập được props của chính nó do bị đóng gói trong một closure',
      'Vì mỗi lần cha render lại tạo một hàm component MỚI → React coi là type khác → remount, mất sạch state',
      'Vì ESLint cấm khai báo hàm lồng nhau nên dự án sẽ không build được ở chế độ production',
      'Vì component con sẽ không dùng được hooks khi được khai báo bên trong một hàm khác',
    ], answer: 1,
    explain: 'React so type bằng tham chiếu hàm. `function Parent(){ function Child(){...}; return <Child/> }` tạo `Child` mới mỗi lần render → type khác → toàn bộ cây con bị huỷ và dựng lại: state mất, input mất focus, effect chạy lại, animation nháy, và hiệu năng tệ. Sửa: đưa `Child` ra NGOÀI, truyền dữ liệu qua props. Bẫy tương tự với HOC gọi trong render (`withX(Comp)` mỗi lần render) và với `React.memo(...)` tạo inline trong thân component.',
  },
  {
    id: 'react-state-machine', topic: 'State & props',
    q: 'Dùng 3 boolean `isLoading`, `isError`, `isSuccess` cho một lời gọi API có vấn đề gì?',
    options: [
      'Tốn bộ nhớ hơn do phải lưu tới ba giá trị thay vì một, và làm chậm quá trình render lại',
      'Cho phép các tổ hợp KHÔNG HỢP LỆ (vừa loading vừa error) — nên gom về một state "idle|loading|success|error"',
      'React không cho phép khai báo quá hai state boolean trong cùng một component function',
      'Ba boolean sẽ gây ra ba lần re-render riêng biệt vì React không gộp chúng lại được',
    ], answer: 1,
    explain: '3 boolean = 8 tổ hợp, trong đó phần lớn là trạng thái vô nghĩa mà code vẫn phải phòng thủ; quên reset một cờ là UI kẹt ở trạng thái lạ. Gom thành MỘT state (`status`) khiến các trạng thái loại trừ nhau theo thiết kế — "làm cho trạng thái không hợp lệ trở nên không biểu diễn được". Đi xa hơn thì dùng discriminated union kèm dữ liệu: `{status:"success", data}` / `{status:"error", error}` — TypeScript sẽ ép bạn xử lý đủ nhánh. Thực tế, React Query đã đóng gói sẵn mô hình này.',
  },
];
