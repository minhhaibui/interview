/**
 * 🧠 CÁCH DÙNG 500 TỪ LÕI — mẫu đi kèm + 3 câu ngữ cảnh cho TỪNG từ
 *
 * Vì sao có file này: học từ LẺ (nhìn nghĩa Việt → gõ 1 từ tiếng Anh) thì nhớ được mặt chữ
 * nhưng tới lúc nói/viết vẫn tắc, vì não không có sẵn "từ này đi với từ nào, đứng ở đâu
 * trong câu". Nên mỗi từ ở đây kèm:
 *   - pat : MẪU đi kèm hay gặp nhất (collocation / cấu trúc), viết ngắn để đọc lướt được
 *   - ex  : đúng 3 câu ví dụ ở 3 NGỮ CẢNH khác nhau, cùng một từ nhưng dùng khác kiểu
 *             🏠 đời thường · 💼 đi làm, văn phòng · 🛠️ kỹ thuật, hỗ trợ khách
 *
 * Ba câu này KHÔNG chỉ để đọc: tab 🔤 Tiếng Anh Core lấy chúng ra làm bước "🧠 Đặt câu"
 * (nhìn tiếng Việt + tên từ → tự viết cả câu tiếng Anh), nên câu phải:
 *   - ngắn, A1–A2, KHÔNG viết tắt (viết "do not" chứ không "don't") cho khớp bộ chấm
 *   - `vi` phải đủ rõ để bật ra đúng câu đó; chỗ nào tiếng Việt dịch được hai kiểu thì
 *     thêm `alt` để không bắt lỗi oan
 *
 * Khoá của object = id từ trong EN_CORE_VOCAB (w001…w500). Test sẽ kiểm đủ 500 khoá.
 */
window.EN_CORE_USAGE = {
  // ---------- Chặng 1 · 25 từ dùng nhiều nhất ----------
  w001: { pat: 'the + thứ cả hai đều biết · the + thứ duy nhất: the sun, the internet', ex: [
    { t: '🏠', en: 'Please close the door.', vi: 'Làm ơn đóng cửa lại.' },
    { t: '💼', en: 'The meeting starts at nine.', vi: 'Cuộc họp bắt đầu lúc chín giờ.' },
    { t: '🛠️', en: 'The server is down again.', vi: 'Máy chủ lại sập rồi.' }] },
  w002: { pat: 'be + tính từ (I am tired) · be + nghề nghiệp (She is a nurse)', ex: [
    { t: '🏠', en: 'I am very tired today.', vi: 'Hôm nay tôi rất mệt.' },
    { t: '💼', en: 'She is our new manager.', vi: 'Cô ấy là quản lý mới của chúng tôi.' },
    { t: '🛠️', en: 'The site is slow this morning.', vi: 'Sáng nay trang web chậm.' }] },
  w003: { pat: 'A and B · nối hai việc: come and see', ex: [
    { t: '🏠', en: 'I want tea and bread.', vi: 'Tôi muốn trà và bánh mì.' },
    { t: '💼', en: 'Please read and sign this.', vi: 'Làm ơn đọc và ký cái này.' },
    { t: '🛠️', en: 'Save the file and restart the app.', vi: 'Lưu tệp lại và khởi động lại ứng dụng.' }] },
  w004: { pat: 'a cup of tea · the name of the file · one of them', ex: [
    { t: '🏠', en: 'I drink a cup of tea every night.', vi: 'Tối nào tôi cũng uống một tách trà.' },
    { t: '💼', en: 'What is the name of your company?', vi: 'Tên công ty của bạn là gì?' },
    { t: '🛠️', en: 'This is one of our old servers.', vi: 'Đây là một trong những máy chủ cũ của chúng tôi.' }] },
  w005: { pat: 'a + danh từ đếm được số ít, nhắc lần đầu · an trước nguyên âm: an hour', ex: [
    { t: '🏠', en: 'I have a small dog.', vi: 'Tôi có một con chó nhỏ.' },
    { t: '💼', en: 'I need a day off.', vi: 'Tôi cần một ngày nghỉ.' },
    { t: '🛠️', en: 'I found a bug in the code.', vi: 'Tôi tìm thấy một lỗi trong mã nguồn.' }] },
  w006: { pat: 'in + phòng/thành phố/nước · in the morning · in ten minutes', ex: [
    { t: '🏠', en: 'My family lives in Hanoi.', vi: 'Gia đình tôi sống ở Hà Nội.' },
    { t: '💼', en: 'The report is in this folder.', vi: 'Bản báo cáo nằm trong thư mục này.' },
    { t: '🛠️', en: 'The fix goes live in ten minutes.', vi: 'Bản sửa sẽ chạy thật sau mười phút.' }] },
  w007: { pat: 'go to + nơi chốn · give it to me · want to + động từ', ex: [
    { t: '🏠', en: 'I go to the market on Sunday.', vi: 'Tôi đi chợ vào chủ nhật.' },
    { t: '💼', en: 'Please send this to my manager.', vi: 'Làm ơn gửi cái này cho quản lý của tôi.' },
    { t: '🛠️', en: 'I want to check the log first.', vi: 'Tôi muốn kiểm tra bản ghi trước đã.' }] },
  w008: { pat: 'have + đồ vật/người · have breakfast · have a meeting', ex: [
    { t: '🏠', en: 'We have two children.', vi: 'Chúng tôi có hai đứa con.' },
    { t: '💼', en: 'I have a meeting at ten.', vi: 'Tôi có một cuộc họp lúc mười giờ.' },
    { t: '🛠️', en: 'We have a problem with the payment.', vi: 'Chúng tôi gặp vấn đề với phần thanh toán.' }] },
  w009: { pat: 'it = đồ vật/con vật · it is hot (thời tiết, giờ giấc)', ex: [
    { t: '🏠', en: 'It is very hot today.', vi: 'Hôm nay trời rất nóng.' },
    { t: '💼', en: 'It is a good idea.', vi: 'Đó là một ý tưởng hay.' },
    { t: '🛠️', en: 'It does not work on my phone.', vi: 'Nó không chạy được trên điện thoại của tôi.' }] },
  w010: { pat: 'I + động từ nguyên mẫu · I am / I have · luôn viết hoa chữ I', ex: [
    { t: '🏠', en: 'I live with my parents.', vi: 'Tôi sống cùng bố mẹ.' },
    { t: '💼', en: 'I work at a software company.', vi: 'Tôi làm việc ở một công ty phần mềm.' },
    { t: '🛠️', en: 'I will look into this issue.', vi: 'Tôi sẽ xem xét vấn đề này.' }] },
  w011: { pat: 'that + danh từ ở xa · I think that… (that có thể bỏ)', ex: [
    { t: '🏠', en: 'That house is very old.', vi: 'Ngôi nhà kia rất cũ.' },
    { t: '💼', en: 'I think that is a fair price.', vi: 'Tôi nghĩ đó là một mức giá hợp lý.' },
    { t: '🛠️', en: 'That error comes from the old code.', vi: 'Lỗi đó đến từ phần mã cũ.' }] },
  w012: { pat: 'for + người nhận · wait for · for two hours (khoảng thời gian)', ex: [
    { t: '🏠', en: 'This gift is for you.', vi: 'Món quà này dành cho bạn.' },
    { t: '💼', en: 'I work for a big company.', vi: 'Tôi làm cho một công ty lớn.' },
    { t: '🛠️', en: 'The site was down for two hours.', vi: 'Trang web sập trong hai tiếng.' }] },
  w013: { pat: 'you = bạn / các bạn · thank you · you are welcome', ex: [
    { t: '🏠', en: 'You are very kind.', vi: 'Bạn thật tử tế.' },
    { t: '💼', en: 'Can you join the meeting?', vi: 'Bạn tham gia cuộc họp được không?' },
    { t: '🛠️', en: 'You can reset your password here.', vi: 'Bạn có thể đặt lại mật khẩu ở đây.' }] },
  w014: { pat: 'he + động từ thêm -s (he works) · he is / he has', ex: [
    { t: '🏠', en: 'He is my older brother.', vi: 'Anh ấy là anh trai tôi.' },
    { t: '💼', en: 'He works from home on Friday.', vi: 'Anh ấy làm việc ở nhà vào thứ Sáu.' },
    { t: '🛠️', en: 'He is fixing the bug now.', vi: 'Anh ấy đang sửa lỗi đó bây giờ.' }] },
  w015: { pat: 'come with me · talk with · with + công cụ (write with a pen)', ex: [
    { t: '🏠', en: 'Come with me, please.', vi: 'Đi cùng tôi nhé.' },
    { t: '💼', en: 'I will talk with the customer.', vi: 'Tôi sẽ nói chuyện với khách hàng.' },
    { t: '🛠️', en: 'We have a problem with the database.', vi: 'Chúng tôi gặp vấn đề với cơ sở dữ liệu.' }] },
  w016: { pat: 'on the table (bề mặt) · on Monday (thứ) · on the phone', ex: [
    { t: '🏠', en: 'Your keys are on the table.', vi: 'Chìa khoá của bạn ở trên bàn.' },
    { t: '💼', en: 'The report is due on Monday.', vi: 'Bản báo cáo đến hạn vào thứ Hai.' },
    { t: '🛠️', en: 'The app crashes on old phones.', vi: 'Ứng dụng sập trên các điện thoại cũ.' }] },
  w017: { pat: 'do homework / do the dishes · trợ động từ: do you…? I do not…', ex: [
    { t: '🏠', en: 'I do the dishes every evening.', vi: 'Tối nào tôi cũng rửa bát.' },
    { t: '💼', en: 'What do you do for a living?', vi: 'Bạn làm nghề gì để sống?' },
    { t: '🛠️', en: 'Do not close this window.', vi: 'Đừng đóng cửa sổ này.' }] },
  w018: { pat: 'say something · say sorry · say that… (KHÔNG say me)', ex: [
    { t: '🏠', en: 'Please say it again.', vi: 'Làm ơn nói lại lần nữa.' },
    { t: '💼', en: 'My manager says the plan is fine.', vi: 'Quản lý của tôi nói kế hoạch ổn.' },
    { t: '🛠️', en: 'The error message says the file is too big.', vi: 'Thông báo lỗi nói rằng tệp quá lớn.' }] },
  w019: { pat: 'this + danh từ gần · this morning · this is… (giới thiệu)', ex: [
    { t: '🏠', en: 'This soup is very good.', vi: 'Món súp này rất ngon.' },
    { t: '💼', en: 'This is my first day here.', vi: 'Đây là ngày đầu tiên của tôi ở đây.' },
    { t: '🛠️', en: 'This bug happens every morning.', vi: 'Lỗi này xảy ra mỗi buổi sáng.' }] },
  w020: { pat: 'they + động từ nguyên mẫu · they are · thay cho nhóm người/vật', ex: [
    { t: '🏠', en: 'They live near my house.', vi: 'Họ sống gần nhà tôi.' },
    { t: '💼', en: 'They are late for the meeting.', vi: 'Họ đến muộn cuộc họp.' },
    { t: '🛠️', en: 'They cannot log in this morning.', vi: 'Sáng nay họ không đăng nhập được.' }] },
  w021: { pat: 'at home · at nine o clock (giờ) · look at · at work', ex: [
    { t: '🏠', en: 'I am at home now.', vi: 'Bây giờ tôi đang ở nhà.' },
    { t: '💼', en: 'The call starts at three.', vi: 'Cuộc gọi bắt đầu lúc ba giờ.' },
    { t: '🛠️', en: 'Look at this error message.', vi: 'Nhìn thông báo lỗi này đi.' }] },
  w022: { pat: 'A but B (hai vế trái nhau) · sorry, but…', ex: [
    { t: '🏠', en: 'The room is small but nice.', vi: 'Căn phòng nhỏ nhưng dễ chịu.' },
    { t: '💼', en: 'I am busy today but free tomorrow.', vi: 'Hôm nay tôi bận nhưng mai thì rảnh.' },
    { t: '🛠️', en: 'The app opens but the data is missing.', vi: 'Ứng dụng mở được nhưng dữ liệu bị thiếu.' }] },
  w023: { pat: 'we + động từ nguyên mẫu · we are · let us (rủ rê)', ex: [
    { t: '🏠', en: 'We are good friends.', vi: 'Chúng tôi là bạn tốt.' },
    { t: '💼', en: 'We have a meeting every Monday.', vi: 'Chúng tôi họp vào mỗi thứ Hai.' },
    { t: '🛠️', en: 'We are working on a fix.', vi: 'Chúng tôi đang làm bản sửa.' }] },
  w024: { pat: 'his + danh từ (his car) · KHÔNG cần thêm of', ex: [
    { t: '🏠', en: 'His dog is very big.', vi: 'Con chó của anh ấy rất to.' },
    { t: '💼', en: 'I read his report yesterday.', vi: 'Hôm qua tôi đã đọc báo cáo của anh ấy.' },
    { t: '🛠️', en: 'His account is locked.', vi: 'Tài khoản của anh ấy bị khoá.' }] },
  w025: { pat: 'from A to B · come from (quê quán) · far from', ex: [
    { t: '🏠', en: 'I am from Vietnam.', vi: 'Tôi đến từ Việt Nam.' },
    { t: '💼', en: 'I got an email from the customer.', vi: 'Tôi nhận được một email từ khách hàng.' },
    { t: '🛠️', en: 'The data comes from the old system.', vi: 'Dữ liệu đến từ hệ thống cũ.' }] },

  // ---------- Chặng 2 · từ 26–50 ----------
  w026: { pat: 'do not / does not + động từ · is not · not yet', ex: [
    { t: '🏠', en: 'I do not eat meat.', vi: 'Tôi không ăn thịt.' },
    { t: '💼', en: 'He is not in the office today.', vi: 'Hôm nay anh ấy không có ở văn phòng.' },
    { t: '🛠️', en: 'The problem is not fixed yet.', vi: 'Vấn đề vẫn chưa được sửa.' }] },
  w027: { pat: 'by bus / by car (không có mạo từ) · by Friday (hạn) · made by', ex: [
    { t: '🏠', en: 'I go to school by bus.', vi: 'Tôi đi học bằng xe buýt.' },
    { t: '💼', en: 'Please send it by Friday.', vi: 'Làm ơn gửi nó trước thứ Sáu.' },
    { t: '🛠️', en: 'This file was made by the old tool.', vi: 'Tệp này được tạo bởi công cụ cũ.' }] },
  w028: { pat: 'she + động từ thêm -s · she is / she has', ex: [
    { t: '🏠', en: 'She cooks dinner every day.', vi: 'Ngày nào cô ấy cũng nấu bữa tối.' },
    { t: '💼', en: 'She leads the design team.', vi: 'Cô ấy dẫn dắt nhóm thiết kế.' },
    { t: '🛠️', en: 'She cannot open the file.', vi: 'Cô ấy không mở được tệp.' }] },
  w029: { pat: 'A or B · either… or… · câu hỏi chọn: tea or coffee?', ex: [
    { t: '🏠', en: 'Do you want tea or coffee?', vi: 'Bạn muốn trà hay cà phê?' },
    { t: '💼', en: 'We can meet today or tomorrow.', vi: 'Chúng ta có thể gặp hôm nay hoặc ngày mai.' },
    { t: '🛠️', en: 'Use Chrome or Firefox for this page.', vi: 'Dùng Chrome hoặc Firefox cho trang này.' }] },
  w030: { pat: 'as + nghề/vai trò (work as) · as soon as · do as I say', ex: [
    { t: '🏠', en: 'Do as I say, please.', vi: 'Làm như tôi nói nhé.' },
    { t: '💼', en: 'I work as a developer.', vi: 'Tôi làm việc với vai trò lập trình viên.' },
    { t: '🛠️', en: 'I will call you as soon as possible.', vi: 'Tôi sẽ gọi bạn sớm nhất có thể.' }] },
  w031: { pat: 'what is…? · what time · what kind of', ex: [
    { t: '🏠', en: 'What is your name?', vi: 'Tên bạn là gì?' },
    { t: '💼', en: 'What time does the meeting start?', vi: 'Cuộc họp bắt đầu lúc mấy giờ?' },
    { t: '🛠️', en: 'What does this error mean?', vi: 'Lỗi này nghĩa là gì?' }] },
  w032: { pat: 'go to + nơi · go home (không có to) · go out · go wrong', ex: [
    { t: '🏠', en: 'I go home at six.', vi: 'Tôi về nhà lúc sáu giờ.' },
    { t: '💼', en: 'I go to the office twice a week.', vi: 'Tôi đến văn phòng hai lần một tuần.' },
    { t: '🛠️', en: 'Something went wrong with the update.', vi: 'Có gì đó sai với bản cập nhật.' }] },
  w033: { pat: 'their + danh từ · đừng lẫn với there (ở đó)', ex: [
    { t: '🏠', en: 'Their children go to my school.', vi: 'Con của họ học ở trường tôi.' },
    { t: '💼', en: 'I read their proposal last night.', vi: 'Tối qua tôi đã đọc đề xuất của họ.' },
    { t: '🛠️', en: 'Their data is still missing.', vi: 'Dữ liệu của họ vẫn còn thiếu.' }] },
  w034: { pat: 'can + động từ nguyên mẫu · cannot · can you…? (nhờ vả)', ex: [
    { t: '🏠', en: 'I can swim very well.', vi: 'Tôi bơi rất giỏi.' },
    { t: '💼', en: 'Can you send me the file?', vi: 'Bạn gửi tệp cho tôi được không?' },
    { t: '🛠️', en: 'I cannot log in to my account.', vi: 'Tôi không đăng nhập được vào tài khoản của mình.' }] },
  w035: { pat: 'who is…? · người mà: the man who called', ex: [
    { t: '🏠', en: 'Who is that woman?', vi: 'Người phụ nữ kia là ai?' },
    { t: '💼', en: 'Who is in charge of this project?', vi: 'Ai phụ trách dự án này?' },
    { t: '🛠️', en: 'Who changed this setting?', vi: 'Ai đã đổi thiết lập này?' }] },
  w036: { pat: 'get a gift · get home · get an email · get better', ex: [
    { t: '🏠', en: 'I get home at seven.', vi: 'Tôi về đến nhà lúc bảy giờ.' },
    { t: '💼', en: 'I get many emails every day.', vi: 'Ngày nào tôi cũng nhận rất nhiều email.' },
    { t: '🛠️', en: 'I get an error when I click save.', vi: 'Tôi gặp lỗi khi bấm lưu.' }] },
  w037: { pat: 'if + hiện tại đơn, will + động từ · if you need help', ex: [
    { t: '🏠', en: 'If it rains, we stay home.', vi: 'Nếu trời mưa, chúng tôi ở nhà.' },
    { t: '💼', en: 'Call me if you need help.', vi: 'Gọi cho tôi nếu bạn cần giúp.' },
    { t: '🛠️', en: 'If the error comes back, send me a screenshot.', vi: 'Nếu lỗi quay lại, gửi cho tôi một ảnh chụp màn hình.' }] },
  w038: { pat: 'would you…? (lịch sự) · I would like… · would be', ex: [
    { t: '🏠', en: 'I would like a glass of water.', vi: 'Tôi muốn một ly nước.' },
    { t: '💼', en: 'Would you join our call at two?', vi: 'Bạn tham gia cuộc gọi lúc hai giờ nhé?' },
    { t: '🛠️', en: 'That would fix the problem.', vi: 'Cách đó sẽ sửa được vấn đề.' }] },
  w039: { pat: 'her + danh từ (her bag) · và cũng là tân ngữ: I know her', ex: [
    { t: '🏠', en: 'Her house is near the market.', vi: 'Nhà cô ấy gần chợ.' },
    { t: '💼', en: 'I sent her the report.', vi: 'Tôi đã gửi cho cô ấy bản báo cáo.' },
    { t: '🛠️', en: 'Her account needs a new password.', vi: 'Tài khoản của cô ấy cần một mật khẩu mới.' }] },
  w040: { pat: 'all the + danh từ số nhiều · all day · that is all', ex: [
    { t: '🏠', en: 'I slept all day.', vi: 'Tôi ngủ cả ngày.' },
    { t: '💼', en: 'All the team members are here.', vi: 'Tất cả thành viên trong nhóm đều có mặt.' },
    { t: '🛠️', en: 'All the tests passed.', vi: 'Tất cả các bài kiểm thử đều đạt.' }] },
  w041: { pat: 'my + danh từ · my name is… · đứng trước danh từ, không đứng một mình', ex: [
    { t: '🏠', en: 'My dog sleeps on my bed.', vi: 'Con chó của tôi ngủ trên giường tôi.' },
    { t: '💼', en: 'My manager is on leave this week.', vi: 'Quản lý của tôi nghỉ phép tuần này.' },
    { t: '🛠️', en: 'My screen is black.', vi: 'Màn hình của tôi đen thui.' }] },
  w042: { pat: 'make tea/dinner · make a mistake · make a decision', ex: [
    { t: '🏠', en: 'I make breakfast every morning.', vi: 'Sáng nào tôi cũng làm bữa sáng.' },
    { t: '💼', en: 'We need to make a decision today.', vi: 'Hôm nay chúng ta cần đưa ra một quyết định.' },
    { t: '🛠️', en: 'I made a mistake in the config.', vi: 'Tôi đã mắc một lỗi trong phần cấu hình.' }] },
  w043: { pat: 'talk about · think about · what about…? · about ten (khoảng)', ex: [
    { t: '🏠', en: 'We talked about our holiday.', vi: 'Chúng tôi đã nói về kỳ nghỉ của mình.' },
    { t: '💼', en: 'What about Friday morning?', vi: 'Sáng thứ Sáu thì sao?' },
    { t: '🛠️', en: 'The page takes about ten seconds to load.', vi: 'Trang mất khoảng mười giây để tải.' }] },
  w044: { pat: 'know somebody · know about · I do not know · you know', ex: [
    { t: '🏠', en: 'I know his sister.', vi: 'Tôi biết chị gái anh ấy.' },
    { t: '💼', en: 'I do not know the answer yet.', vi: 'Tôi vẫn chưa biết câu trả lời.' },
    { t: '🛠️', en: 'Do you know your account email?', vi: 'Bạn có biết email tài khoản của mình không?' }] },
  w045: { pat: 'will + động từ nguyên mẫu · I will call you · will not', ex: [
    { t: '🏠', en: 'I will call you tonight.', vi: 'Tối nay tôi sẽ gọi cho bạn.' },
    { t: '💼', en: 'We will send the invoice tomorrow.', vi: 'Ngày mai chúng tôi sẽ gửi hoá đơn.' },
    { t: '🛠️', en: 'I will get back to you today.', vi: 'Tôi sẽ trả lời lại bạn trong hôm nay.' }] },
  w046: { pat: 'stand up · wake up · up to ten · set up', ex: [
    { t: '🏠', en: 'I wake up at six every day.', vi: 'Ngày nào tôi cũng thức dậy lúc sáu giờ.' },
    { t: '💼', en: 'Please stand up and introduce yourself.', vi: 'Làm ơn đứng lên và giới thiệu bản thân.' },
    { t: '🛠️', en: 'The server is up again.', vi: 'Máy chủ đã chạy lại rồi.' }] },
  w047: { pat: 'one + danh từ số ít · one of them · one more', ex: [
    { t: '🏠', en: 'I have one cat.', vi: 'Tôi có một con mèo.' },
    { t: '💼', en: 'I need one more day.', vi: 'Tôi cần thêm một ngày nữa.' },
    { t: '🛠️', en: 'Only one user reported this.', vi: 'Chỉ một người dùng báo chuyện này.' }] },
  w048: { pat: 'have time · on time · all the time · this time', ex: [
    { t: '🏠', en: 'I have no time today.', vi: 'Hôm nay tôi không có thời gian.' },
    { t: '💼', en: 'Please come on time.', vi: 'Làm ơn đến đúng giờ.' },
    { t: '🛠️', en: 'The app is slow all the time.', vi: 'Ứng dụng lúc nào cũng chậm.' }] },
  w049: { pat: 'over there · there is / there are (có cái gì)', ex: [
    { t: '🏠', en: 'Put your bag there.', vi: 'Để túi của bạn ở đó.' },
    { t: '💼', en: 'There are five people in my team.', vi: 'Có năm người trong nhóm của tôi.' },
    { t: '🛠️', en: 'There is a problem with the payment.', vi: 'Có một vấn đề với phần thanh toán.' }] },
  w050: { pat: 'last year · next year · every year · a year ago', ex: [
    { t: '🏠', en: 'Happy new year!', vi: 'Chúc mừng năm mới!' },
    { t: '💼', en: 'I joined this company last year.', vi: 'Tôi vào công ty này năm ngoái.' },
    { t: '🛠️', en: 'We update the system every year.', vi: 'Chúng tôi cập nhật hệ thống mỗi năm.' }] },

  // ---------- Chặng 3 · từ 51–75 ----------
  w051: { pat: 'so + kết quả (I am tired, so I rest) · so good (rất)', ex: [
    { t: '🏠', en: 'I am tired, so I go to bed early.', vi: 'Tôi mệt nên tôi đi ngủ sớm.' },
    { t: '💼', en: 'The client is waiting, so please hurry.', vi: 'Khách đang đợi nên làm ơn nhanh lên.' },
    { t: '🛠️', en: 'The disk is full, so the app cannot save.', vi: 'Ổ đĩa đầy nên ứng dụng không lưu được.' }] },
  w052: { pat: 'think about · think that… · I think so · do not think', ex: [
    { t: '🏠', en: 'I think about my family every day.', vi: 'Ngày nào tôi cũng nghĩ về gia đình mình.' },
    { t: '💼', en: 'I think this plan is good.', vi: 'Tôi nghĩ kế hoạch này tốt.' },
    { t: '🛠️', en: 'I think the cache is the problem.', vi: 'Tôi nghĩ bộ nhớ đệm là vấn đề.' }] },
  w053: { pat: 'when + mệnh đề (call me when you arrive) · when is…?', ex: [
    { t: '🏠', en: 'When do you eat dinner?', vi: 'Bạn ăn tối lúc nào?' },
    { t: '💼', en: 'Call me when you arrive.', vi: 'Gọi cho tôi khi bạn đến nơi.' },
    { t: '🛠️', en: 'The error appears when I click save.', vi: 'Lỗi hiện ra khi tôi bấm lưu.' }] },
  w054: { pat: 'which one? · which + danh từ (khi có lựa chọn hẹp)', ex: [
    { t: '🏠', en: 'Which bag is yours?', vi: 'Cái túi nào là của bạn?' },
    { t: '💼', en: 'Which day works for you?', vi: 'Ngày nào tiện cho bạn?' },
    { t: '🛠️', en: 'Which browser do you use?', vi: 'Bạn dùng trình duyệt nào?' }] },
  w055: { pat: 'them = tân ngữ của they · tell them · both of them', ex: [
    { t: '🏠', en: 'I like them very much.', vi: 'Tôi rất thích họ.' },
    { t: '💼', en: 'Please tell them about the change.', vi: 'Làm ơn báo cho họ về thay đổi này.' },
    { t: '🛠️', en: 'I sent them the log file.', vi: 'Tôi đã gửi cho họ tệp nhật ký.' }] },
  w056: { pat: 'some + danh từ (câu khẳng định) · some of them · some day', ex: [
    { t: '🏠', en: 'I need some water.', vi: 'Tôi cần một ít nước.' },
    { t: '💼', en: 'I have some questions about the plan.', vi: 'Tôi có vài câu hỏi về kế hoạch.' },
    { t: '🛠️', en: 'Some users cannot log in.', vi: 'Một số người dùng không đăng nhập được.' }] },
  w057: { pat: 'help me · tell me · give it to me · for me', ex: [
    { t: '🏠', en: 'Please help me with this bag.', vi: 'Làm ơn giúp tôi cái túi này.' },
    { t: '💼', en: 'Send me the file, please.', vi: 'Làm ơn gửi tệp cho tôi.' },
    { t: '🛠️', en: 'Show me the error message.', vi: 'Cho tôi xem thông báo lỗi.' }] },
  w058: { pat: 'many people · people are (luôn số nhiều, KHÔNG có peoples)', ex: [
    { t: '🏠', en: 'Many people are waiting outside.', vi: 'Nhiều người đang đợi bên ngoài.' },
    { t: '💼', en: 'Five people joined the meeting.', vi: 'Năm người đã tham gia cuộc họp.' },
    { t: '🛠️', en: 'A lot of people report the same bug.', vi: 'Rất nhiều người báo cùng một lỗi.' }] },
  w059: { pat: 'take a look at · take care of · take time · take a bus', ex: [
    { t: '🏠', en: 'I take the bus to work.', vi: 'Tôi đi làm bằng xe buýt.' },
    { t: '💼', en: 'I will take care of this task.', vi: 'Tôi sẽ lo đầu việc này.' },
    { t: '🛠️', en: 'Please take a look at this error.', vi: 'Làm ơn xem qua lỗi này.' }] },
  w060: { pat: 'go out · find out · run out of · out of order', ex: [
    { t: '🏠', en: 'Let us go out tonight.', vi: 'Tối nay chúng ta đi chơi đi.' },
    { t: '💼', en: 'He is out of the office today.', vi: 'Hôm nay anh ấy không ở văn phòng.' },
    { t: '🛠️', en: 'We ran out of disk space.', vi: 'Chúng tôi hết dung lượng ổ đĩa.' }] },
  w061: { pat: 'go into the room · look into (xem xét) · turn into', ex: [
    { t: '🏠', en: 'Please come into the kitchen.', vi: 'Vào bếp đi.' },
    { t: '💼', en: 'She walked into the meeting room.', vi: 'Cô ấy bước vào phòng họp.' },
    { t: '🛠️', en: 'I am looking into this issue now.', vi: 'Tôi đang xem xét vấn đề này.' }] },
  w062: { pat: 'just arrived (vừa mới) · just one (chỉ) · just a moment', ex: [
    { t: '🏠', en: 'I just arrived home.', vi: 'Tôi vừa mới về đến nhà.' },
    { t: '💼', en: 'Just a moment, please.', vi: 'Xin chờ một lát.' },
    { t: '🛠️', en: 'I just restarted the server.', vi: 'Tôi vừa khởi động lại máy chủ.' }] },
  w063: { pat: 'see you later · I see (hiểu rồi) · see a doctor', ex: [
    { t: '🏠', en: 'See you tomorrow!', vi: 'Hẹn gặp bạn ngày mai!' },
    { t: '💼', en: 'I will see the client at three.', vi: 'Tôi sẽ gặp khách hàng lúc ba giờ.' },
    { t: '🛠️', en: 'I do not see the button on my screen.', vi: 'Tôi không thấy cái nút trên màn hình của mình.' }] },
  w064: { pat: 'him = tân ngữ của he · tell him · with him', ex: [
    { t: '🏠', en: 'I saw him at the market.', vi: 'Tôi thấy anh ấy ở chợ.' },
    { t: '💼', en: 'Please ask him about the budget.', vi: 'Làm ơn hỏi anh ấy về ngân sách.' },
    { t: '🛠️', en: 'I sent him the new password.', vi: 'Tôi đã gửi cho anh ấy mật khẩu mới.' }] },
  w065: { pat: 'your + danh từ · đừng lẫn với you are', ex: [
    { t: '🏠', en: 'Is this your bag?', vi: 'Đây có phải túi của bạn không?' },
    { t: '💼', en: 'I read your email this morning.', vi: 'Sáng nay tôi đã đọc email của bạn.' },
    { t: '🛠️', en: 'Please check your internet connection.', vi: 'Làm ơn kiểm tra kết nối internet của bạn.' }] },
  w066: { pat: 'come here · come back · come from · come in', ex: [
    { t: '🏠', en: 'Come here, please.', vi: 'Lại đây nào.' },
    { t: '💼', en: 'She comes to the office at eight.', vi: 'Cô ấy đến văn phòng lúc tám giờ.' },
    { t: '🛠️', en: 'The error came back after the update.', vi: 'Lỗi quay lại sau bản cập nhật.' }] },
  w067: { pat: 'could you…? (nhờ lịch sự) · could not · quá khứ của can', ex: [
    { t: '🏠', en: 'Could you open the window?', vi: 'Bạn mở cửa sổ giúp được không?' },
    { t: '💼', en: 'Could you wait a minute?', vi: 'Bạn đợi một phút được không?' },
    { t: '🛠️', en: 'I could not open the file yesterday.', vi: 'Hôm qua tôi không mở được tệp.' }] },
  w068: { pat: 'right now · do it now · from now on · now that', ex: [
    { t: '🏠', en: 'I am cooking now.', vi: 'Bây giờ tôi đang nấu ăn.' },
    { t: '💼', en: 'Please do it now.', vi: 'Làm ơn làm ngay bây giờ.' },
    { t: '🛠️', en: 'The site works now.', vi: 'Bây giờ trang web chạy được rồi.' }] },
  w069: { pat: 'tính từ ngắn + er + than · more + tính từ dài + than', ex: [
    { t: '🏠', en: 'She is taller than me.', vi: 'Cô ấy cao hơn tôi.' },
    { t: '💼', en: 'This plan is better than the old one.', vi: 'Kế hoạch này tốt hơn kế hoạch cũ.' },
    { t: '🛠️', en: 'The new server is faster than the old server.', vi: 'Máy chủ mới nhanh hơn máy chủ cũ.' }] },
  w070: { pat: 'like + danh từ · like + V-ing · would like (muốn)', ex: [
    { t: '🏠', en: 'I like hot tea.', vi: 'Tôi thích trà nóng.' },
    { t: '💼', en: 'He likes his new job.', vi: 'Anh ấy thích công việc mới của mình.' },
    { t: '🛠️', en: 'Our users like the new design.', vi: 'Người dùng của chúng tôi thích thiết kế mới.' }] },
  w071: { pat: 'the other one · other people · each other', ex: [
    { t: '🏠', en: 'I want the other one.', vi: 'Tôi muốn cái còn lại.' },
    { t: '💼', en: 'Other teams use the same tool.', vi: 'Các nhóm khác dùng cùng công cụ đó.' },
    { t: '🛠️', en: 'Try the other browser.', vi: 'Thử trình duyệt còn lại xem.' }] },
  w072: { pat: 'how are you? · how much / how many · how long · how to', ex: [
    { t: '🏠', en: 'How are you today?', vi: 'Hôm nay bạn thế nào?' },
    { t: '💼', en: 'How long does the meeting take?', vi: 'Cuộc họp kéo dài bao lâu?' },
    { t: '🛠️', en: 'How do I reset my password?', vi: 'Tôi đặt lại mật khẩu bằng cách nào?' }] },
  w073: { pat: 'first…, then… · and then · back then', ex: [
    { t: '🏠', en: 'I eat dinner, then I watch TV.', vi: 'Tôi ăn tối rồi sau đó xem tivi.' },
    { t: '💼', en: 'Read the report, then send me your notes.', vi: 'Đọc báo cáo rồi gửi tôi ghi chú của bạn.' },
    { t: '🛠️', en: 'Save the file, then restart the app.', vi: 'Lưu tệp rồi khởi động lại ứng dụng.' }] },
  w074: { pat: 'its + danh từ (của nó) · KHÔNG phải it is', ex: [
    { t: '🏠', en: 'The cat licks its paw.', vi: 'Con mèo liếm bàn chân của nó.' },
    { t: '💼', en: 'The company changed its name.', vi: 'Công ty đã đổi tên của nó.' },
    { t: '🛠️', en: 'The app lost its data.', vi: 'Ứng dụng mất dữ liệu của nó.' }] },
  w075: { pat: 'our + danh từ · ours (đứng một mình)', ex: [
    { t: '🏠', en: 'Our house is very small.', vi: 'Nhà chúng tôi rất nhỏ.' },
    { t: '💼', en: 'Our team has five members.', vi: 'Nhóm của chúng tôi có năm thành viên.' },
    { t: '🛠️', en: 'Our server restarts every night.', vi: 'Máy chủ của chúng tôi khởi động lại mỗi đêm.' }] },

  // ---------- Chặng 4 · từ 76–100 ----------
  w076: { pat: 'two + danh từ số nhiều · two of them · in two days', ex: [
    { t: '🏠', en: 'She has two dogs.', vi: 'Cô ấy có hai con chó.' },
    { t: '💼', en: 'The project needs two more weeks.', vi: 'Dự án cần thêm hai tuần nữa.' },
    { t: '🛠️', en: 'Two users reported the same error.', vi: 'Hai người dùng đã báo cùng một lỗi.' }] },
  w077: { pat: 'more + danh từ · more than (hơn) · any more', ex: [
    { t: '🏠', en: 'I need more time.', vi: 'Tôi cần thêm thời gian.' },
    { t: '💼', en: 'We need more people on this project.', vi: 'Chúng ta cần thêm người cho dự án này.' },
    { t: '🛠️', en: 'The page takes more than ten seconds.', vi: 'Trang mất hơn mười giây.' }] },
  w078: { pat: 'these + danh từ số nhiều (gần) · these days', ex: [
    { t: '🏠', en: 'Please buy these apples.', vi: 'Làm ơn mua mấy quả táo này.' },
    { t: '💼', en: 'These numbers are wrong.', vi: 'Mấy con số này sai rồi.' },
    { t: '🛠️', en: 'These errors started yesterday.', vi: 'Mấy lỗi này bắt đầu từ hôm qua.' }] },
  w079: { pat: 'want + danh từ · want to + động từ · do you want…?', ex: [
    { t: '🏠', en: 'I want a cup of coffee.', vi: 'Tôi muốn một tách cà phê.' },
    { t: '💼', en: 'I want to join this project.', vi: 'Tôi muốn tham gia dự án này.' },
    { t: '🛠️', en: 'Do you want me to check the log?', vi: 'Bạn có muốn tôi kiểm tra bản ghi không?' }] },
  w080: { pat: 'this way (lối này) · the best way to · by the way', ex: [
    { t: '🏠', en: 'This is the way to the market.', vi: 'Đây là đường ra chợ.' },
    { t: '💼', en: 'This is the fastest way to finish.', vi: 'Đây là cách nhanh nhất để làm xong.' },
    { t: '🛠️', en: 'There is another way to fix this.', vi: 'Có một cách khác để sửa việc này.' }] },
  w081: { pat: 'look at · look for (tìm) · look into · look like', ex: [
    { t: '🏠', en: 'Look at this photo.', vi: 'Nhìn tấm ảnh này đi.' },
    { t: '💼', en: 'We are looking for a new manager.', vi: 'Chúng tôi đang tìm một quản lý mới.' },
    { t: '🛠️', en: 'I will look into the problem today.', vi: 'Hôm nay tôi sẽ xem xét vấn đề đó.' }] },
  w082: { pat: 'the first time · first of all · at first', ex: [
    { t: '🏠', en: 'This is my first time here.', vi: 'Đây là lần đầu tiên tôi đến đây.' },
    { t: '💼', en: 'First of all, thank you for waiting.', vi: 'Trước hết, cảm ơn bạn đã chờ.' },
    { t: '🛠️', en: 'Please try the first option.', vi: 'Làm ơn thử lựa chọn đầu tiên.' }] },
  w083: { pat: 'also đứng TRƯỚC động từ chính, SAU động từ be', ex: [
    { t: '🏠', en: 'I also like green tea.', vi: 'Tôi cũng thích trà xanh.' },
    { t: '💼', en: 'She is also on the call.', vi: 'Cô ấy cũng có trong cuộc gọi.' },
    { t: '🛠️', en: 'The app also works on tablets.', vi: 'Ứng dụng cũng chạy trên máy tính bảng.' }] },
  w084: { pat: 'a new + danh từ · brand new · what is new?', ex: [
    { t: '🏠', en: 'I bought a new phone.', vi: 'Tôi đã mua một cái điện thoại mới.' },
    { t: '💼', en: 'We have a new customer.', vi: 'Chúng tôi có một khách hàng mới.' },
    { t: '🛠️', en: 'Please install the new version.', vi: 'Làm ơn cài bản mới.' }] },
  w085: { pat: 'because + cả mệnh đề (vì… nên) · because of + danh từ', ex: [
    { t: '🏠', en: 'I stayed home because I was sick.', vi: 'Tôi ở nhà vì tôi bị ốm.' },
    { t: '💼', en: 'The meeting is late because the room is busy.', vi: 'Cuộc họp muộn vì phòng đang bận.' },
    { t: '🛠️', en: 'The app crashed because the file is too big.', vi: 'Ứng dụng sập vì tệp quá lớn.' }] },
  w086: { pat: 'every day · all day · one day · these days', ex: [
    { t: '🏠', en: 'I walk my dog every day.', vi: 'Ngày nào tôi cũng dắt chó đi dạo.' },
    { t: '💼', en: 'I need one more day.', vi: 'Tôi cần thêm một ngày nữa.' },
    { t: '🛠️', en: 'The backup runs every day at midnight.', vi: 'Bản sao lưu chạy mỗi ngày lúc nửa đêm.' }] },
  w087: { pat: 'use something · use it to + động từ · easy to use', ex: [
    { t: '🏠', en: 'I use my phone to read news.', vi: 'Tôi dùng điện thoại để đọc tin tức.' },
    { t: '💼', en: 'We use this tool every day.', vi: 'Chúng tôi dùng công cụ này hằng ngày.' },
    { t: '🛠️', en: 'Do not use the old password.', vi: 'Đừng dùng mật khẩu cũ.' }] },
  w088: { pat: 'no + danh từ (I have no time) · no problem · say no', ex: [
    { t: '🏠', en: 'I have no money today.', vi: 'Hôm nay tôi không có tiền.' },
    { t: '💼', en: 'No problem, I can do it.', vi: 'Không vấn đề gì, tôi làm được.' },
    { t: '🛠️', en: 'There is no internet connection.', vi: 'Không có kết nối internet.' }] },
  w089: { pat: 'a man · men (số nhiều) · the man who…', ex: [
    { t: '🏠', en: 'A man is waiting at the door.', vi: 'Có một người đàn ông đang đợi ở cửa.' },
    { t: '💼', en: 'The man from the bank called you.', vi: 'Người đàn ông ở ngân hàng đã gọi cho bạn.' },
    { t: '🛠️', en: 'The man could not open his account.', vi: 'Người đàn ông đó không mở được tài khoản của mình.' }] },
  w090: { pat: 'find something · find out (phát hiện) · hard to find', ex: [
    { t: '🏠', en: 'I cannot find my keys.', vi: 'Tôi không tìm thấy chìa khoá của mình.' },
    { t: '💼', en: 'We need to find a better price.', vi: 'Chúng ta cần tìm một mức giá tốt hơn.' },
    { t: '🛠️', en: 'I found the bug in the old code.', vi: 'Tôi đã tìm thấy lỗi trong phần mã cũ.' }] },
  w091: { pat: 'come here · here you are · here is / here are', ex: [
    { t: '🏠', en: 'My house is here.', vi: 'Nhà tôi ở đây.' },
    { t: '💼', en: 'Here is the report you asked for.', vi: 'Đây là bản báo cáo bạn yêu cầu.' },
    { t: '🛠️', en: 'Click here to reset your password.', vi: 'Bấm vào đây để đặt lại mật khẩu.' }] },
  w092: { pat: 'one thing · the same thing · things (đồ đạc, tình hình)', ex: [
    { t: '🏠', en: 'I need one more thing.', vi: 'Tôi cần thêm một thứ nữa.' },
    { t: '💼', en: 'One thing is still not clear.', vi: 'Có một điều vẫn chưa rõ.' },
    { t: '🛠️', en: 'The same thing happened last week.', vi: 'Chuyện tương tự đã xảy ra tuần trước.' }] },
  w093: { pat: 'give somebody something · give it to me · give up', ex: [
    { t: '🏠', en: 'Please give me a glass of water.', vi: 'Làm ơn cho tôi một ly nước.' },
    { t: '💼', en: 'Give me five minutes, please.', vi: 'Cho tôi năm phút nhé.' },
    { t: '🛠️', en: 'The app gives me an error every time.', vi: 'Lần nào ứng dụng cũng báo lỗi cho tôi.' }] },
  w094: { pat: 'many + danh từ ĐẾM ĐƯỢC số nhiều · how many · too many', ex: [
    { t: '🏠', en: 'I have many friends here.', vi: 'Tôi có nhiều bạn ở đây.' },
    { t: '💼', en: 'How many people are coming?', vi: 'Có bao nhiêu người sẽ đến?' },
    { t: '🛠️', en: 'Too many users are online now.', vi: 'Hiện có quá nhiều người dùng trực tuyến.' }] },
  w095: { pat: 'do something well · very well · as well (cũng)', ex: [
    { t: '🏠', en: 'She cooks very well.', vi: 'Cô ấy nấu ăn rất giỏi.' },
    { t: '💼', en: 'He speaks English well.', vi: 'Anh ấy nói tiếng Anh giỏi.' },
    { t: '🛠️', en: 'The new version works well.', vi: 'Bản mới chạy tốt.' }] },
  w096: { pat: 'only + danh từ/số · the only one · I only want…', ex: [
    { t: '🏠', en: 'I only want a small cup.', vi: 'Tôi chỉ muốn một tách nhỏ thôi.' },
    { t: '💼', en: 'Only two people came to the meeting.', vi: 'Chỉ hai người đến cuộc họp.' },
    { t: '🛠️', en: 'This is the only server we have.', vi: 'Đây là máy chủ duy nhất chúng tôi có.' }] },
  w097: { pat: 'those + danh từ số nhiều (ở xa) · those who…', ex: [
    { t: '🏠', en: 'Those shoes are too small.', vi: 'Đôi giày kia nhỏ quá.' },
    { t: '💼', en: 'Those numbers come from last month.', vi: 'Mấy con số kia là của tháng trước.' },
    { t: '🛠️', en: 'Those files are too old.', vi: 'Mấy tệp kia quá cũ rồi.' }] },
  w098: { pat: 'tell somebody something · tell me about · tell the truth', ex: [
    { t: '🏠', en: 'Tell me about your day.', vi: 'Kể cho tôi nghe về ngày của bạn đi.' },
    { t: '💼', en: 'Please tell the team about the change.', vi: 'Làm ơn báo cho cả nhóm về thay đổi này.' },
    { t: '🛠️', en: 'Tell me what the screen says.', vi: 'Nói cho tôi biết màn hình hiện gì.' }] },
  w099: { pat: 'very + tính từ/trạng từ · KHÔNG dùng very với động từ', ex: [
    { t: '🏠', en: 'This soup is very hot.', vi: 'Món súp này rất nóng.' },
    { t: '💼', en: 'The customer is very happy.', vi: 'Khách hàng rất hài lòng.' },
    { t: '🛠️', en: 'The site is very slow today.', vi: 'Hôm nay trang web rất chậm.' }] },
  w100: { pat: 'even + bất ngờ (even my boss) · even better · not even', ex: [
    { t: '🏠', en: 'Even my dog does not like it.', vi: 'Đến con chó của tôi cũng không thích nó.' },
    { t: '💼', en: 'Even the manager works on Saturday.', vi: 'Đến quản lý cũng làm việc thứ Bảy.' },
    { t: '🛠️', en: 'It does not work even on a new phone.', vi: 'Nó không chạy được kể cả trên điện thoại mới.' }] },

  // ---------- Chặng 5 · từ 101–125 ----------
  w101: { pat: 'my back hurts · come back · go back to · back up (sao lưu)', ex: [
    { t: '🏠', en: 'My back hurts today.', vi: 'Hôm nay lưng tôi đau.' },
    { t: '💼', en: 'I will be back in ten minutes.', vi: 'Tôi sẽ quay lại sau mười phút.' },
    { t: '🛠️', en: 'Please back up your data first.', vi: 'Làm ơn sao lưu dữ liệu của bạn trước.' }] },
  w102: { pat: 'any + danh từ (câu hỏi/phủ định) · any time · any other', ex: [
    { t: '🏠', en: 'Do you have any bread?', vi: 'Bạn có cái bánh mì nào không?' },
    { t: '💼', en: 'Do you have any questions?', vi: 'Bạn có câu hỏi nào không?' },
    { t: '🛠️', en: 'I do not see any errors in the log.', vi: 'Tôi không thấy lỗi nào trong bản ghi.' }] },
  w103: { pat: 'be good at + V-ing · a good idea · good morning · look good', ex: [
    { t: '🏠', en: 'This restaurant is very good.', vi: 'Nhà hàng này rất ngon.' },
    { t: '💼', en: 'She is good at solving problems.', vi: 'Cô ấy giỏi giải quyết vấn đề.' },
    { t: '🛠️', en: 'The new server is good enough for now.', vi: 'Máy chủ mới tạm đủ tốt cho lúc này.' }] },
  w104: { pat: 'a woman · women (số nhiều, đọc khác) · the woman who…', ex: [
    { t: '🏠', en: 'That woman is my neighbour.', vi: 'Người phụ nữ đó là hàng xóm của tôi.' },
    { t: '💼', en: 'The woman from the bank is waiting.', vi: 'Người phụ nữ ở ngân hàng đang đợi.' },
    { t: '🛠️', en: 'The woman cannot reset her password.', vi: 'Người phụ nữ đó không đặt lại được mật khẩu.' }] },
  w105: { pat: 'walk through the park · go through (trải qua, xem qua)', ex: [
    { t: '🏠', en: 'We walked through the park.', vi: 'Chúng tôi đi bộ xuyên qua công viên.' },
    { t: '💼', en: 'Let us go through the plan again.', vi: 'Chúng ta cùng xem lại kế hoạch một lần nữa nhé.' },
    { t: '🛠️', en: 'The data goes through this server.', vi: 'Dữ liệu đi qua máy chủ này.' }] },
  w106: { pat: 'us = tân ngữ của we · tell us · with us · let us', ex: [
    { t: '🏠', en: 'Come with us tonight.', vi: 'Tối nay đi cùng chúng tôi đi.' },
    { t: '💼', en: 'Please tell us your decision.', vi: 'Làm ơn cho chúng tôi biết quyết định của bạn.' },
    { t: '🛠️', en: 'Send us the error message, please.', vi: 'Làm ơn gửi cho chúng tôi thông báo lỗi.' }] },
  w107: { pat: 'my life · all my life · real life · lives (số nhiều)', ex: [
    { t: '🏠', en: 'Life is short.', vi: 'Cuộc sống ngắn lắm.' },
    { t: '💼', en: 'I want a better work life balance.', vi: 'Tôi muốn cân bằng công việc và cuộc sống tốt hơn.' },
    { t: '🛠️', en: 'This tool makes my life easier.', vi: 'Công cụ này làm cuộc sống của tôi dễ hơn.' }] },
  w108: { pat: 'a child · children (số nhiều bất quy tắc)', ex: [
    { t: '🏠', en: 'Their child is only two years old.', vi: 'Con của họ mới hai tuổi.' },
    { t: '💼', en: 'I leave early because my child is sick.', vi: 'Tôi về sớm vì con tôi bị ốm.' },
    { t: '🛠️', en: 'This app is safe for children.', vi: 'Ứng dụng này an toàn cho trẻ em.' }] },
  w109: { pat: 'work at/for + công ty · work on + việc · go to work · it works', ex: [
    { t: '🏠', en: 'I go to work by bus.', vi: 'Tôi đi làm bằng xe buýt.' },
    { t: '💼', en: 'I work at a software company.', vi: 'Tôi làm việc ở một công ty phần mềm.' },
    { t: '🛠️', en: 'The button does not work.', vi: 'Cái nút không hoạt động.' }] },
  w110: { pat: 'sit down · write down · the server is down · down the street', ex: [
    { t: '🏠', en: 'Please sit down.', vi: 'Mời ngồi.' },
    { t: '💼', en: 'Write down the address, please.', vi: 'Làm ơn ghi lại địa chỉ.' },
    { t: '🛠️', en: 'The payment service is down.', vi: 'Dịch vụ thanh toán đang sập.' }] },
  w111: { pat: 'may + động từ nguyên mẫu · may I…? (xin phép lịch sự)', ex: [
    { t: '🏠', en: 'It may rain this evening.', vi: 'Chiều tối nay trời có thể mưa.' },
    { t: '💼', en: 'May I ask a question?', vi: 'Tôi hỏi một câu được không?' },
    { t: '🛠️', en: 'The fix may take two days.', vi: 'Bản sửa có thể mất hai ngày.' }] },
  w112: { pat: 'after + danh từ/V-ing · after that · after work', ex: [
    { t: '🏠', en: 'I read after dinner.', vi: 'Tôi đọc sách sau bữa tối.' },
    { t: '💼', en: 'Let us talk after the meeting.', vi: 'Chúng ta nói chuyện sau cuộc họp nhé.' },
    { t: '🛠️', en: 'The error started after the update.', vi: 'Lỗi bắt đầu sau bản cập nhật.' }] },
  w113: { pat: 'should + động từ nguyên mẫu · you should not · should I…?', ex: [
    { t: '🏠', en: 'You should sleep early.', vi: 'Bạn nên ngủ sớm.' },
    { t: '💼', en: 'We should finish this today.', vi: 'Chúng ta nên làm xong việc này hôm nay.' },
    { t: '🛠️', en: 'You should update the app first.', vi: 'Bạn nên cập nhật ứng dụng trước.' }] },
  w114: { pat: 'call somebody (KHÔNG có to) · call back · a phone call', ex: [
    { t: '🏠', en: 'I will call my mother tonight.', vi: 'Tối nay tôi sẽ gọi cho mẹ tôi.' },
    { t: '💼', en: 'Please call the customer today.', vi: 'Làm ơn gọi cho khách hàng hôm nay.' },
    { t: '🛠️', en: 'I will call you back after the fix.', vi: 'Tôi sẽ gọi lại cho bạn sau khi sửa xong.' }] },
  w115: { pat: 'around the world · the best in the world', ex: [
    { t: '🏠', en: 'I want to travel around the world.', vi: 'Tôi muốn đi vòng quanh thế giới.' },
    { t: '💼', en: 'Our customers are around the world.', vi: 'Khách hàng của chúng tôi ở khắp thế giới.' },
    { t: '🛠️', en: 'This app has users all over the world.', vi: 'Ứng dụng này có người dùng khắp thế giới.' }] },
  w116: { pat: 'over the table · over ten (hơn) · over the weekend · it is over', ex: [
    { t: '🏠', en: 'The lamp is over the table.', vi: 'Cái đèn ở phía trên bàn.' },
    { t: '💼', en: 'We have over twenty customers.', vi: 'Chúng tôi có hơn hai mươi khách hàng.' },
    { t: '🛠️', en: 'The update is over now.', vi: 'Bản cập nhật đã xong rồi.' }] },
  w117: { pat: 'go to school (không mạo từ) · at school · a new school', ex: [
    { t: '🏠', en: 'My son goes to school at seven.', vi: 'Con trai tôi đi học lúc bảy giờ.' },
    { t: '💼', en: 'She teaches English at a school.', vi: 'Cô ấy dạy tiếng Anh ở một trường học.' },
    { t: '🛠️', en: 'The school uses our software.', vi: 'Trường học đó dùng phần mềm của chúng tôi.' }] },
  w118: { pat: 'still + động từ (vẫn còn) · is still · still not', ex: [
    { t: '🏠', en: 'I am still hungry.', vi: 'Tôi vẫn còn đói.' },
    { t: '💼', en: 'He is still in a meeting.', vi: 'Anh ấy vẫn đang họp.' },
    { t: '🛠️', en: 'The error is still there.', vi: 'Lỗi vẫn còn đó.' }] },
  w119: { pat: 'try to + động từ (cố gắng) · try + V-ing (thử) · try again', ex: [
    { t: '🏠', en: 'I try to sleep early.', vi: 'Tôi cố gắng ngủ sớm.' },
    { t: '💼', en: 'We will try to finish by Friday.', vi: 'Chúng tôi sẽ cố gắng xong trước thứ Sáu.' },
    { t: '🛠️', en: 'Please try again in five minutes.', vi: 'Làm ơn thử lại sau năm phút.' }] },
  w120: { pat: 'last week/month/year (vừa qua) · the last one (cuối cùng)', ex: [
    { t: '🏠', en: 'I visited my parents last week.', vi: 'Tuần trước tôi đã về thăm bố mẹ.' },
    { t: '💼', en: 'This is the last task for today.', vi: 'Đây là đầu việc cuối cùng cho hôm nay.' },
    { t: '🛠️', en: 'The last update broke the login page.', vi: 'Bản cập nhật vừa rồi làm hỏng trang đăng nhập.' }] },
  w121: { pat: 'ask somebody · ask about · ask for (xin) · ask a question', ex: [
    { t: '🏠', en: 'Ask your mother first.', vi: 'Hỏi mẹ bạn trước đã.' },
    { t: '💼', en: 'May I ask a question?', vi: 'Tôi hỏi một câu được không?' },
    { t: '🛠️', en: 'The customer asked for a refund.', vi: 'Khách hàng đã yêu cầu hoàn tiền.' }] },
  w122: { pat: 'need + danh từ · need to + động từ · do you need…?', ex: [
    { t: '🏠', en: 'I need some rest.', vi: 'Tôi cần nghỉ một chút.' },
    { t: '💼', en: 'We need to talk about the budget.', vi: 'Chúng ta cần nói về ngân sách.' },
    { t: '🛠️', en: 'You need a new password.', vi: 'Bạn cần một mật khẩu mới.' }] },
  w123: { pat: 'too + tính từ (quá mức) · me too · too much / too many', ex: [
    { t: '🏠', en: 'This coffee is too hot.', vi: 'Cà phê này nóng quá.' },
    { t: '💼', en: 'The price is too high for us.', vi: 'Giá quá cao với chúng tôi.' },
    { t: '🛠️', en: 'The file is too big to send.', vi: 'Tệp quá lớn để gửi.' }] },
  w124: { pat: 'feel + tính từ (feel tired) · feel like · how do you feel?', ex: [
    { t: '🏠', en: 'I feel tired today.', vi: 'Hôm nay tôi thấy mệt.' },
    { t: '💼', en: 'I feel good about this plan.', vi: 'Tôi thấy ổn với kế hoạch này.' },
    { t: '🛠️', en: 'The app feels slow after the update.', vi: 'Ứng dụng thấy chậm hẳn sau bản cập nhật.' }] },
  w125: { pat: 'three + danh từ số nhiều · in three days · three times', ex: [
    { t: '🏠', en: 'I have three brothers.', vi: 'Tôi có ba anh em trai.' },
    { t: '💼', en: 'The report needs three more days.', vi: 'Bản báo cáo cần thêm ba ngày nữa.' },
    { t: '🛠️', en: 'I tried three times and it failed.', vi: 'Tôi đã thử ba lần và nó thất bại.' }] },

  // ---------- Chặng 6 · từ 126–150 ----------
  w126: { pat: 'never + động từ (không thêm not) · I have never…', ex: [
    { t: '🏠', en: 'I never drink coffee at night.', vi: 'Tôi không bao giờ uống cà phê vào ban đêm.' },
    { t: '💼', en: 'He is never late for a meeting.', vi: 'Anh ấy không bao giờ đến muộn cuộc họp.' },
    { t: '🛠️', en: 'This error never happened before.', vi: 'Lỗi này chưa bao giờ xảy ra trước đây.' }] },
  w127: { pat: 'become + tính từ/danh từ · became (quá khứ)', ex: [
    { t: '🏠', en: 'The weather became cold.', vi: 'Thời tiết trở nên lạnh.' },
    { t: '💼', en: 'She became our team leader last year.', vi: 'Cô ấy trở thành trưởng nhóm của chúng tôi năm ngoái.' },
    { t: '🛠️', en: 'The system became slow after ten users.', vi: 'Hệ thống trở nên chậm sau mười người dùng.' }] },
  w128: { pat: 'between A and B (đúng hai thứ) · between ten and twelve', ex: [
    { t: '🏠', en: 'The shop is between the bank and the market.', vi: 'Cửa hàng nằm giữa ngân hàng và chợ.' },
    { t: '💼', en: 'Please call me between two and four.', vi: 'Làm ơn gọi cho tôi trong khoảng hai đến bốn giờ.' },
    { t: '🛠️', en: 'The data moves between two servers.', vi: 'Dữ liệu di chuyển giữa hai máy chủ.' }] },
  w129: { pat: 'a high price · high quality · high level · trái nghĩa: low', ex: [
    { t: '🏠', en: 'The mountain is very high.', vi: 'Ngọn núi rất cao.' },
    { t: '💼', en: 'This task has high priority.', vi: 'Đầu việc này có mức ưu tiên cao.' },
    { t: '🛠️', en: 'The server has high memory usage.', vi: 'Máy chủ đang dùng bộ nhớ ở mức cao.' }] },
  w130: { pat: 'really + tính từ (rất) · I really need · really? (thật à)', ex: [
    { t: '🏠', en: 'This cake is really good.', vi: 'Cái bánh này thật sự ngon.' },
    { t: '💼', en: 'I really need your answer today.', vi: 'Tôi thật sự cần câu trả lời của bạn hôm nay.' },
    { t: '🛠️', en: 'The problem is really in the old code.', vi: 'Vấn đề thật sự nằm ở phần mã cũ.' }] },
  w131: { pat: 'something + tính từ (something new) · something to eat', ex: [
    { t: '🏠', en: 'I want something to eat.', vi: 'Tôi muốn một cái gì đó để ăn.' },
    { t: '💼', en: 'I have something to tell you.', vi: 'Tôi có chuyện muốn nói với bạn.' },
    { t: '🛠️', en: 'Something is wrong with the payment.', vi: 'Có gì đó không ổn với phần thanh toán.' }] },
  w132: { pat: 'most + danh từ số nhiều · the most + tính từ dài (nhất)', ex: [
    { t: '🏠', en: 'Most of my friends live here.', vi: 'Hầu hết bạn bè tôi sống ở đây.' },
    { t: '💼', en: 'This is the most important task.', vi: 'Đây là đầu việc quan trọng nhất.' },
    { t: '🛠️', en: 'Most users are on mobile phones.', vi: 'Hầu hết người dùng đang dùng điện thoại.' }] },
  w133: { pat: 'another + danh từ SỐ ÍT · another one · another ten minutes', ex: [
    { t: '🏠', en: 'I want another cup of tea.', vi: 'Tôi muốn thêm một tách trà nữa.' },
    { t: '💼', en: 'We need another meeting next week.', vi: 'Chúng ta cần thêm một cuộc họp nữa tuần sau.' },
    { t: '🛠️', en: 'Please wait another five minutes.', vi: 'Làm ơn đợi thêm năm phút nữa.' }] },
  w134: { pat: 'much + danh từ KHÔNG đếm được · how much · too much', ex: [
    { t: '🏠', en: 'I do not drink much water.', vi: 'Tôi không uống nhiều nước.' },
    { t: '💼', en: 'How much does it cost?', vi: 'Cái đó giá bao nhiêu?' },
    { t: '🛠️', en: 'The app uses too much memory.', vi: 'Ứng dụng dùng quá nhiều bộ nhớ.' }] },
  w135: { pat: 'my family (số ít) · a family of four · family name', ex: [
    { t: '🏠', en: 'My family lives in Hue.', vi: 'Gia đình tôi sống ở Huế.' },
    { t: '💼', en: 'I need a day off for a family event.', vi: 'Tôi cần một ngày nghỉ vì có việc gia đình.' },
    { t: '🛠️', en: 'This plan is for one family only.', vi: 'Gói này chỉ dành cho một gia đình.' }] },
  w136: { pat: 'my own + danh từ · on my own (tự mình) · own a car (sở hữu)', ex: [
    { t: '🏠', en: 'I have my own room.', vi: 'Tôi có phòng riêng của mình.' },
    { t: '💼', en: 'She finished the task on her own.', vi: 'Cô ấy tự làm xong đầu việc đó một mình.' },
    { t: '🛠️', en: 'Each user has their own account.', vi: 'Mỗi người dùng có tài khoản riêng của mình.' }] },
  w137: { pat: 'leave + nơi chốn (rời) · leave a message · left (quá khứ)', ex: [
    { t: '🏠', en: 'I leave home at seven.', vi: 'Tôi rời nhà lúc bảy giờ.' },
    { t: '💼', en: 'He left the office an hour ago.', vi: 'Anh ấy rời văn phòng cách đây một tiếng.' },
    { t: '🛠️', en: 'Please leave the app open.', vi: 'Làm ơn để ứng dụng mở.' }] },
  w138: { pat: 'put something + nơi chốn · put on (mặc vào) · put off', ex: [
    { t: '🏠', en: 'Put the milk in the fridge.', vi: 'Để sữa vào tủ lạnh.' },
    { t: '💼', en: 'Please put your name on the list.', vi: 'Làm ơn ghi tên bạn vào danh sách.' },
    { t: '🛠️', en: 'Put the file in this folder.', vi: 'Để tệp vào thư mục này.' }] },
  w139: { pat: 'an old car (cũ) · an old man (già) · how old are you?', ex: [
    { t: '🏠', en: 'My car is very old.', vi: 'Xe của tôi rất cũ.' },
    { t: '💼', en: 'We still use the old process.', vi: 'Chúng tôi vẫn dùng quy trình cũ.' },
    { t: '🛠️', en: 'The bug is in the old version.', vi: 'Lỗi nằm ở bản cũ.' }] },
  w140: { pat: 'while + mệnh đề (trong khi) · for a while (một lúc)', ex: [
    { t: '🏠', en: 'I read while my son sleeps.', vi: 'Tôi đọc sách trong khi con trai tôi ngủ.' },
    { t: '💼', en: 'Please wait here for a while.', vi: 'Làm ơn đợi ở đây một lúc.' },
    { t: '🛠️', en: 'The app crashed while I was saving.', vi: 'Ứng dụng sập trong khi tôi đang lưu.' }] },
  w141: { pat: 'what does it mean? · I mean… · mean to do', ex: [
    { t: '🏠', en: 'What does this word mean?', vi: 'Từ này nghĩa là gì?' },
    { t: '💼', en: 'I mean next Monday, not this Monday.', vi: 'Ý tôi là thứ Hai tuần sau, không phải thứ Hai này.' },
    { t: '🛠️', en: 'This error means the file is missing.', vi: 'Lỗi này nghĩa là tệp bị thiếu.' }] },
  w142: { pat: 'keep + danh từ · keep + V-ing (cứ tiếp tục) · keep in mind', ex: [
    { t: '🏠', en: 'Keep the milk in the fridge.', vi: 'Giữ sữa trong tủ lạnh.' },
    { t: '💼', en: 'Please keep me updated.', vi: 'Làm ơn cập nhật cho tôi liên tục.' },
    { t: '🛠️', en: 'The page keeps loading forever.', vi: 'Trang cứ tải mãi không xong.' }] },
  w143: { pat: 'a student · students · a student of… · study as a student', ex: [
    { t: '🏠', en: 'My sister is a student.', vi: 'Chị tôi là sinh viên.' },
    { t: '💼', en: 'We hire two students every summer.', vi: 'Mùa hè nào chúng tôi cũng tuyển hai sinh viên.' },
    { t: '🛠️', en: 'Students get a free account.', vi: 'Sinh viên được một tài khoản miễn phí.' }] },
  w144: { pat: 'why…? · that is why · why not? · because (câu trả lời)', ex: [
    { t: '🏠', en: 'Why are you late?', vi: 'Sao bạn đến muộn vậy?' },
    { t: '💼', en: 'Why did the client cancel?', vi: 'Sao khách hàng lại huỷ?' },
    { t: '🛠️', en: 'That is why the page is slow.', vi: 'Đó là lý do trang bị chậm.' }] },
  w145: { pat: 'let me + động từ nguyên mẫu · let us go · let somebody know', ex: [
    { t: '🏠', en: 'Let me help you.', vi: 'Để tôi giúp bạn.' },
    { t: '💼', en: 'Let me know your decision.', vi: 'Cho tôi biết quyết định của bạn nhé.' },
    { t: '🛠️', en: 'Let me check the log first.', vi: 'Để tôi kiểm tra bản ghi trước.' }] },
  w146: { pat: 'that is great · a great idea · great job · trang trọng hơn good', ex: [
    { t: '🏠', en: 'The food was great.', vi: 'Đồ ăn rất tuyệt.' },
    { t: '💼', en: 'That is a great idea.', vi: 'Đó là một ý tưởng tuyệt vời.' },
    { t: '🛠️', en: 'Great, the fix works now.', vi: 'Tuyệt, bản sửa chạy được rồi.' }] },
  w147: { pat: 'the same + danh từ · the same as · at the same time', ex: [
    { t: '🏠', en: 'We live in the same building.', vi: 'Chúng tôi sống trong cùng một toà nhà.' },
    { t: '💼', en: 'We have the same problem every month.', vi: 'Tháng nào chúng tôi cũng gặp cùng một vấn đề.' },
    { t: '🛠️', en: 'The error is the same as yesterday.', vi: 'Lỗi giống hệt hôm qua.' }] },
  w148: { pat: 'a big house · a big problem · big enough', ex: [
    { t: '🏠', en: 'They have a big garden.', vi: 'Họ có một khu vườn lớn.' },
    { t: '💼', en: 'This is a big customer for us.', vi: 'Đây là một khách hàng lớn với chúng tôi.' },
    { t: '🛠️', en: 'We have a big problem with the data.', vi: 'Chúng tôi gặp vấn đề lớn với dữ liệu.' }] },
  w149: { pat: 'a group of + danh từ số nhiều · in groups · work in a group', ex: [
    { t: '🏠', en: 'A group of children is playing outside.', vi: 'Một nhóm trẻ con đang chơi bên ngoài.' },
    { t: '💼', en: 'Our group meets every Tuesday.', vi: 'Nhóm chúng tôi họp vào mỗi thứ Ba.' },
    { t: '🛠️', en: 'A small group of users sees this error.', vi: 'Một nhóm nhỏ người dùng thấy lỗi này.' }] },
  w150: { pat: 'begin + to + động từ · begin with · trang trọng hơn start', ex: [
    { t: '🏠', en: 'The film begins at eight.', vi: 'Bộ phim bắt đầu lúc tám giờ.' },
    { t: '💼', en: 'Let us begin the meeting.', vi: 'Chúng ta bắt đầu cuộc họp nhé.' },
    { t: '🛠️', en: 'The problem began after the update.', vi: 'Vấn đề bắt đầu sau bản cập nhật.' }] },

  // ---------- Chặng 7 · từ 151–175 ----------
  w151: { pat: 'seem + tính từ · it seems that… · seem to be', ex: [
    { t: '🏠', en: 'You seem tired today.', vi: 'Hôm nay trông bạn có vẻ mệt.' },
    { t: '💼', en: 'The customer seems happy with the price.', vi: 'Khách hàng có vẻ hài lòng với giá.' },
    { t: '🛠️', en: 'It seems the server is down.', vi: 'Có vẻ như máy chủ đang sập.' }] },
  w152: { pat: 'my country · in this country · countries (số nhiều)', ex: [
    { t: '🏠', en: 'I love my country.', vi: 'Tôi yêu đất nước của mình.' },
    { t: '💼', en: 'We sell in three countries.', vi: 'Chúng tôi bán ở ba quốc gia.' },
    { t: '🛠️', en: 'The app is slow in some countries.', vi: 'Ứng dụng chậm ở một số quốc gia.' }] },
  w153: { pat: 'help somebody · help somebody with · help to + động từ', ex: [
    { t: '🏠', en: 'Can you help me, please?', vi: 'Bạn giúp tôi được không?' },
    { t: '💼', en: 'I can help you with the report.', vi: 'Tôi có thể giúp bạn phần báo cáo.' },
    { t: '🛠️', en: 'This guide helps new users.', vi: 'Hướng dẫn này giúp người dùng mới.' }] },
  w154: { pat: 'talk to / talk with somebody · talk about something', ex: [
    { t: '🏠', en: 'I talk to my mother every Sunday.', vi: 'Chủ nhật nào tôi cũng nói chuyện với mẹ.' },
    { t: '💼', en: 'I need to talk about the deadline.', vi: 'Tôi cần nói về hạn chót.' },
    { t: '🛠️', en: 'I will talk to the developer today.', vi: 'Hôm nay tôi sẽ nói chuyện với lập trình viên.' }] },
  w155: { pat: 'where is…? · where do you…? · the place where…', ex: [
    { t: '🏠', en: 'Where do you live?', vi: 'Bạn sống ở đâu?' },
    { t: '💼', en: 'Where is the meeting room?', vi: 'Phòng họp ở đâu?' },
    { t: '🛠️', en: 'Where do you see the error?', vi: 'Bạn thấy lỗi ở chỗ nào?' }] },
  w156: { pat: 'turn left/right · turn on / turn off · turn into', ex: [
    { t: '🏠', en: 'Turn left at the market.', vi: 'Rẽ trái ở chỗ chợ.' },
    { t: '💼', en: 'Please turn off your phone in the meeting.', vi: 'Làm ơn tắt điện thoại trong cuộc họp.' },
    { t: '🛠️', en: 'Turn on the new setting and try again.', vi: 'Bật thiết lập mới lên rồi thử lại.' }] },
  w157: { pat: 'have a problem with · no problem · solve a problem', ex: [
    { t: '🏠', en: 'I have a problem with my car.', vi: 'Tôi gặp vấn đề với xe của mình.' },
    { t: '💼', en: 'No problem, I can do it today.', vi: 'Không sao, hôm nay tôi làm được.' },
    { t: '🛠️', en: 'We are working on the problem now.', vi: 'Chúng tôi đang xử lý vấn đề đó.' }] },
  w158: { pat: 'every + danh từ SỐ ÍT · every day · every two weeks', ex: [
    { t: '🏠', en: 'I cook every evening.', vi: 'Tối nào tôi cũng nấu ăn.' },
    { t: '💼', en: 'We meet every Monday.', vi: 'Chúng tôi họp vào mỗi thứ Hai.' },
    { t: '🛠️', en: 'The backup runs every two hours.', vi: 'Bản sao lưu chạy mỗi hai tiếng.' }] },
  w159: { pat: 'start + V-ing / to + động từ · start work · start over', ex: [
    { t: '🏠', en: 'I start work at eight.', vi: 'Tôi bắt đầu làm việc lúc tám giờ.' },
    { t: '💼', en: 'When do we start the new project?', vi: 'Khi nào chúng ta bắt đầu dự án mới?' },
    { t: '🛠️', en: 'The app does not start on my phone.', vi: 'Ứng dụng không khởi động được trên điện thoại của tôi.' }] },
  w160: { pat: 'in my hand · hands (số nhiều) · give me a hand (giúp)', ex: [
    { t: '🏠', en: 'Please wash your hands.', vi: 'Làm ơn rửa tay đi.' },
    { t: '💼', en: 'Can you give me a hand?', vi: 'Bạn giúp tôi một tay được không?' },
    { t: '🛠️', en: 'The report is in his hands now.', vi: 'Bản báo cáo giờ đang ở chỗ anh ấy.' }] },
  w161: { pat: 'might + động từ nguyên mẫu (ít chắc hơn may)', ex: [
    { t: '🏠', en: 'It might rain tomorrow.', vi: 'Ngày mai có lẽ trời mưa.' },
    { t: '💼', en: 'She might join the call later.', vi: 'Có lẽ lát nữa cô ấy sẽ vào cuộc gọi.' },
    { t: '🛠️', en: 'The error might come from the cache.', vi: 'Lỗi có lẽ đến từ bộ nhớ đệm.' }] },
  w162: { pat: 'show somebody something · show me · show up (xuất hiện)', ex: [
    { t: '🏠', en: 'Show me your new phone.', vi: 'Cho tôi xem điện thoại mới của bạn đi.' },
    { t: '💼', en: 'The numbers show a good month.', vi: 'Các con số cho thấy một tháng tốt.' },
    { t: '🛠️', en: 'The page shows an error message.', vi: 'Trang hiện ra một thông báo lỗi.' }] },
  w163: { pat: 'a part of · take part in · the best part', ex: [
    { t: '🏠', en: 'This is my favourite part of the city.', vi: 'Đây là phần tôi thích nhất của thành phố.' },
    { t: '💼', en: 'I take part in the weekly meeting.', vi: 'Tôi tham gia cuộc họp hằng tuần.' },
    { t: '🛠️', en: 'Only one part of the page is broken.', vi: 'Chỉ một phần của trang bị hỏng.' }] },
  w164: { pat: 'against the wall · be against (phản đối) · play against', ex: [
    { t: '🏠', en: 'Put the table against the wall.', vi: 'Kê cái bàn sát vào tường.' },
    { t: '💼', en: 'I am against this plan.', vi: 'Tôi phản đối kế hoạch này.' },
    { t: '🛠️', en: 'This rule protects us against bad data.', vi: 'Quy tắc này bảo vệ chúng ta khỏi dữ liệu xấu.' }] },
  w165: { pat: 'a nice place · in this place · take place (diễn ra)', ex: [
    { t: '🏠', en: 'This is a nice place to eat.', vi: 'Đây là một chỗ ăn dễ chịu.' },
    { t: '💼', en: 'The meeting takes place at ten.', vi: 'Cuộc họp diễn ra lúc mười giờ.' },
    { t: '🛠️', en: 'Put the file in a safe place.', vi: 'Để tệp ở một nơi an toàn.' }] },
  w166: { pat: 'such a + tính từ + danh từ · such as (ví dụ như)', ex: [
    { t: '🏠', en: 'It is such a nice day.', vi: 'Hôm nay đẹp trời quá.' },
    { t: '💼', en: 'We sell tools such as this one.', vi: 'Chúng tôi bán các công cụ như cái này.' },
    { t: '🛠️', en: 'Such errors are hard to find.', vi: 'Những lỗi như vậy rất khó tìm.' }] },
  w167: { pat: 'try again · again and again · say that again', ex: [
    { t: '🏠', en: 'Please say that again.', vi: 'Làm ơn nói lại câu đó.' },
    { t: '💼', en: 'He is late again.', vi: 'Anh ấy lại muộn nữa rồi.' },
    { t: '🛠️', en: 'Please try again later.', vi: 'Làm ơn thử lại sau.' }] },
  w168: { pat: 'a few + danh từ đếm được (một vài) · few (rất ít, ý tiêu cực)', ex: [
    { t: '🏠', en: 'I have a few friends here.', vi: 'Tôi có vài người bạn ở đây.' },
    { t: '💼', en: 'I need a few more minutes.', vi: 'Tôi cần thêm vài phút nữa.' },
    { t: '🛠️', en: 'Only a few users see this bug.', vi: 'Chỉ vài người dùng thấy lỗi này.' }] },
  w169: { pat: 'in this case · in any case · a special case', ex: [
    { t: '🏠', en: 'In that case, I stay home.', vi: 'Trong trường hợp đó, tôi ở nhà.' },
    { t: '💼', en: 'This is a special case for our client.', vi: 'Đây là trường hợp đặc biệt cho khách của chúng tôi.' },
    { t: '🛠️', en: 'In this case the app shows no data.', vi: 'Trong trường hợp này ứng dụng không hiện dữ liệu.' }] },
  w170: { pat: 'this week · last week · next week · twice a week', ex: [
    { t: '🏠', en: 'I go to the gym twice a week.', vi: 'Tôi đến phòng tập hai lần một tuần.' },
    { t: '💼', en: 'The report is due next week.', vi: 'Bản báo cáo đến hạn tuần sau.' },
    { t: '🛠️', en: 'The bug started this week.', vi: 'Lỗi bắt đầu từ tuần này.' }] },
  w171: { pat: 'work at/for a company · a software company · the company is', ex: [
    { t: '🏠', en: 'My brother works at a big company.', vi: 'Anh trai tôi làm ở một công ty lớn.' },
    { t: '💼', en: 'Our company has fifty people.', vi: 'Công ty chúng tôi có năm mươi người.' },
    { t: '🛠️', en: 'The company uses our software.', vi: 'Công ty đó dùng phần mềm của chúng tôi.' }] },
  w172: { pat: 'the system is · a new system · system error', ex: [
    { t: '🏠', en: 'The bus system here is very good.', vi: 'Hệ thống xe buýt ở đây rất tốt.' },
    { t: '💼', en: 'We have a new system for reports.', vi: 'Chúng tôi có hệ thống mới cho báo cáo.' },
    { t: '🛠️', en: 'The system is down for maintenance.', vi: 'Hệ thống đang ngừng để bảo trì.' }] },
  w173: { pat: 'each + danh từ SỐ ÍT · each of them · each other', ex: [
    { t: '🏠', en: 'Each child has a small gift.', vi: 'Mỗi đứa trẻ có một món quà nhỏ.' },
    { t: '💼', en: 'Each member writes a short report.', vi: 'Mỗi thành viên viết một báo cáo ngắn.' },
    { t: '🛠️', en: 'Each user has one account.', vi: 'Mỗi người dùng có một tài khoản.' }] },
  w174: { pat: 'that is right (đúng) · turn right (bên phải) · right now', ex: [
    { t: '🏠', en: 'Turn right at the bank.', vi: 'Rẽ phải ở chỗ ngân hàng.' },
    { t: '💼', en: 'That is right, the meeting is at two.', vi: 'Đúng rồi, cuộc họp lúc hai giờ.' },
    { t: '🛠️', en: 'I am looking at it right now.', vi: 'Tôi đang xem nó ngay bây giờ.' }] },
  w175: { pat: 'hear somebody · hear about · hear from · I cannot hear you', ex: [
    { t: '🏠', en: 'I hear a strange noise.', vi: 'Tôi nghe thấy một tiếng động lạ.' },
    { t: '💼', en: 'I heard about the new project.', vi: 'Tôi đã nghe về dự án mới.' },
    { t: '🛠️', en: 'I cannot hear you on the call.', vi: 'Tôi không nghe thấy bạn trong cuộc gọi.' }] },

  // ---------- Chặng 8 · từ 176–200 ----------
  w176: { pat: 'ask a question · answer a question · a question about', ex: [
    { t: '🏠', en: 'I have a question for you.', vi: 'Tôi có một câu hỏi cho bạn.' },
    { t: '💼', en: 'Please answer my question by Friday.', vi: 'Làm ơn trả lời câu hỏi của tôi trước thứ Sáu.' },
    { t: '🛠️', en: 'I do not understand the question.', vi: 'Tôi không hiểu câu hỏi.' }] },
  w177: { pat: 'during + danh từ (during the meeting) · KHÔNG dùng during + mệnh đề', ex: [
    { t: '🏠', en: 'I sleep during the afternoon.', vi: 'Tôi ngủ vào buổi chiều.' },
    { t: '💼', en: 'Please do not call during the meeting.', vi: 'Làm ơn đừng gọi trong lúc họp.' },
    { t: '🛠️', en: 'The app crashed during the update.', vi: 'Ứng dụng sập trong lúc cập nhật.' }] },
  w178: { pat: 'play football · play the piano · play a game', ex: [
    { t: '🏠', en: 'My son plays football every Sunday.', vi: 'Con trai tôi chơi bóng đá mỗi chủ nhật.' },
    { t: '💼', en: 'She plays an important role in the team.', vi: 'Cô ấy đóng vai trò quan trọng trong nhóm.' },
    { t: '🛠️', en: 'The video does not play on my phone.', vi: 'Video không chạy được trên điện thoại của tôi.' }] },
  w179: { pat: 'run fast · run a company · the app runs · run out of', ex: [
    { t: '🏠', en: 'I run in the park every morning.', vi: 'Sáng nào tôi cũng chạy bộ trong công viên.' },
    { t: '💼', en: 'She runs a small shop.', vi: 'Cô ấy điều hành một cửa hàng nhỏ.' },
    { t: '🛠️', en: 'The test runs every night.', vi: 'Bài kiểm thử chạy mỗi đêm.' }] },
  w180: { pat: 'a small house · a small problem · small enough', ex: [
    { t: '🏠', en: 'My room is very small.', vi: 'Phòng của tôi rất nhỏ.' },
    { t: '💼', en: 'We are a small team.', vi: 'Chúng tôi là một nhóm nhỏ.' },
    { t: '🛠️', en: 'This is only a small bug.', vi: 'Đây chỉ là một lỗi nhỏ.' }] },
  w181: { pat: 'a large number of · phone number · number of users', ex: [
    { t: '🏠', en: 'What is your phone number?', vi: 'Số điện thoại của bạn là gì?' },
    { t: '💼', en: 'The number of orders is going up.', vi: 'Số lượng đơn hàng đang tăng lên.' },
    { t: '🛠️', en: 'The error number is four zero four.', vi: 'Mã lỗi là bốn không bốn.' }] },
  w182: { pat: 'turn off · take off · day off · off the list', ex: [
    { t: '🏠', en: 'Please turn off the light.', vi: 'Làm ơn tắt đèn.' },
    { t: '💼', en: 'I take Friday off next week.', vi: 'Tuần sau tôi nghỉ ngày thứ Sáu.' },
    { t: '🛠️', en: 'The feature is off by default.', vi: 'Tính năng này mặc định bị tắt.' }] },
  w183: { pat: 'always đứng TRƯỚC động từ chính, SAU be', ex: [
    { t: '🏠', en: 'I always drink tea in the morning.', vi: 'Sáng nào tôi cũng uống trà.' },
    { t: '💼', en: 'She is always on time.', vi: 'Cô ấy luôn đúng giờ.' },
    { t: '🛠️', en: 'Always save your work first.', vi: 'Luôn lưu bài của bạn trước đã.' }] },
  w184: { pat: 'move to + nơi mới · move the file · move on', ex: [
    { t: '🏠', en: 'We moved to a new house last year.', vi: 'Năm ngoái chúng tôi chuyển đến nhà mới.' },
    { t: '💼', en: 'Let us move the meeting to Friday.', vi: 'Chúng ta dời cuộc họp sang thứ Sáu nhé.' },
    { t: '🛠️', en: 'Please move the file to this folder.', vi: 'Làm ơn chuyển tệp sang thư mục này.' }] },
  w185: { pat: 'at night (không phải in the night) · last night · tonight', ex: [
    { t: '🏠', en: 'I read at night.', vi: 'Tôi đọc sách vào ban đêm.' },
    { t: '💼', en: 'He worked late last night.', vi: 'Tối qua anh ấy làm muộn.' },
    { t: '🛠️', en: 'The backup runs at night.', vi: 'Bản sao lưu chạy vào ban đêm.' }] },
  w186: { pat: 'a good point · the point is… · at this point', ex: [
    { t: '🏠', en: 'I do not see your point.', vi: 'Tôi không hiểu ý bạn.' },
    { t: '💼', en: 'That is a good point.', vi: 'Đó là một ý hay.' },
    { t: '🛠️', en: 'At this point the app stops.', vi: 'Đến chỗ này thì ứng dụng dừng lại.' }] },
  w187: { pat: 'believe somebody · believe in · I do not believe it', ex: [
    { t: '🏠', en: 'I believe you.', vi: 'Tôi tin bạn.' },
    { t: '💼', en: 'I believe this plan will work.', vi: 'Tôi tin kế hoạch này sẽ hiệu quả.' },
    { t: '🛠️', en: 'I believe the cache is the problem.', vi: 'Tôi tin bộ nhớ đệm là vấn đề.' }] },
  w188: { pat: 'hold something · hold on (chờ máy) · hold a meeting', ex: [
    { t: '🏠', en: 'Please hold my bag.', vi: 'Làm ơn cầm giúp tôi cái túi.' },
    { t: '💼', en: 'We hold a meeting every Monday.', vi: 'Chúng tôi tổ chức họp vào mỗi thứ Hai.' },
    { t: '🛠️', en: 'Please hold on, I am checking.', vi: 'Làm ơn giữ máy, tôi đang kiểm tra.' }] },
  w189: { pat: 'today (KHÔNG có in/on) · today is · by today', ex: [
    { t: '🏠', en: 'Today is my birthday.', vi: 'Hôm nay là sinh nhật tôi.' },
    { t: '💼', en: 'I am very busy today.', vi: 'Hôm nay tôi rất bận.' },
    { t: '🛠️', en: 'We will send the fix today.', vi: 'Chúng tôi sẽ gửi bản sửa hôm nay.' }] },
  w190: { pat: 'bring something to somebody · bring it here (mang ĐẾN)', ex: [
    { t: '🏠', en: 'Please bring me a glass of water.', vi: 'Làm ơn mang cho tôi một ly nước.' },
    { t: '💼', en: 'Bring your laptop to the meeting.', vi: 'Mang máy tính xách tay của bạn đến cuộc họp.' },
    { t: '🛠️', en: 'The update brings a new design.', vi: 'Bản cập nhật mang đến một thiết kế mới.' }] },
  w191: { pat: 'what happened? · happen to somebody · it happens', ex: [
    { t: '🏠', en: 'What happened to your phone?', vi: 'Điện thoại của bạn bị sao vậy?' },
    { t: '💼', en: 'Nothing happened at the meeting.', vi: 'Chẳng có gì xảy ra ở cuộc họp cả.' },
    { t: '🛠️', en: 'This error happens every morning.', vi: 'Lỗi này xảy ra mỗi buổi sáng.' }] },
  w192: { pat: 'next week/month · next to (bên cạnh) · what is next?', ex: [
    { t: '🏠', en: 'The shop is next to my house.', vi: 'Cửa hàng ở ngay cạnh nhà tôi.' },
    { t: '💼', en: 'We start the project next month.', vi: 'Chúng tôi bắt đầu dự án vào tháng sau.' },
    { t: '🛠️', en: 'What is the next step?', vi: 'Bước tiếp theo là gì?' }] },
  w193: { pat: 'without + danh từ / V-ing · do without · without help', ex: [
    { t: '🏠', en: 'I cannot live without coffee.', vi: 'Tôi không sống nổi mà thiếu cà phê.' },
    { t: '💼', en: 'He finished it without help.', vi: 'Anh ấy làm xong mà không cần giúp đỡ.' },
    { t: '🛠️', en: 'The app does not work without internet.', vi: 'Ứng dụng không chạy nếu không có internet.' }] },
  w194: { pat: 'before + danh từ/mệnh đề · before that · the day before', ex: [
    { t: '🏠', en: 'I wash my hands before dinner.', vi: 'Tôi rửa tay trước bữa tối.' },
    { t: '💼', en: 'Please read this before the meeting.', vi: 'Làm ơn đọc cái này trước cuộc họp.' },
    { t: '🛠️', en: 'Save your work before you close the app.', vi: 'Lưu bài của bạn trước khi đóng ứng dụng.' }] },
  w195: { pat: 'a large room · a large number of · trang trọng hơn big', ex: [
    { t: '🏠', en: 'They live in a large house.', vi: 'Họ sống trong một ngôi nhà lớn.' },
    { t: '💼', en: 'We have a large team in Hanoi.', vi: 'Chúng tôi có một nhóm lớn ở Hà Nội.' },
    { t: '🛠️', en: 'The file is too large to upload.', vi: 'Tệp quá lớn để tải lên.' }] },
  w196: { pat: 'must + động từ nguyên mẫu (bắt buộc) · must not (cấm)', ex: [
    { t: '🏠', en: 'I must go home now.', vi: 'Bây giờ tôi phải về nhà.' },
    { t: '💼', en: 'We must finish before Friday.', vi: 'Chúng ta phải xong trước thứ Sáu.' },
    { t: '🛠️', en: 'You must not share your password.', vi: 'Bạn không được chia sẻ mật khẩu của mình.' }] },
  w197: { pat: 'go home (KHÔNG có to) · at home · work from home', ex: [
    { t: '🏠', en: 'I am at home now.', vi: 'Bây giờ tôi đang ở nhà.' },
    { t: '💼', en: 'We work from home on Friday.', vi: 'Chúng tôi làm việc ở nhà vào thứ Sáu.' },
    { t: '🛠️', en: 'The app works at home but not at the office.', vi: 'Ứng dụng chạy ở nhà nhưng không chạy ở văn phòng.' }] },
  w198: { pat: 'under the table · under ten (dưới) · under control', ex: [
    { t: '🏠', en: 'The cat is under the table.', vi: 'Con mèo ở dưới gầm bàn.' },
    { t: '💼', en: 'The price is under one million.', vi: 'Giá dưới một triệu.' },
    { t: '🛠️', en: 'The problem is under control now.', vi: 'Vấn đề giờ đã trong tầm kiểm soát.' }] },
  w199: { pat: 'a glass of water · drink water · hot water (không đếm được)', ex: [
    { t: '🏠', en: 'I drink a lot of water.', vi: 'Tôi uống rất nhiều nước.' },
    { t: '💼', en: 'There is water in the meeting room.', vi: 'Có nước trong phòng họp.' },
    { t: '🛠️', en: 'Water damaged the old computer.', vi: 'Nước đã làm hỏng cái máy tính cũ.' }] },
  w200: { pat: 'in the room · a meeting room · make room for', ex: [
    { t: '🏠', en: 'My room is very small.', vi: 'Phòng của tôi rất nhỏ.' },
    { t: '💼', en: 'The meeting room is busy until three.', vi: 'Phòng họp bận đến ba giờ.' },
    { t: '🛠️', en: 'There is no room on the disk.', vi: 'Ổ đĩa không còn chỗ trống.' }] },

  // ---------- Chặng 9 · từ 201–225 ----------
  w201: { pat: 'write to somebody · write down · write a report', ex: [
    { t: '🏠', en: 'I write to my friend every month.', vi: 'Tháng nào tôi cũng viết thư cho bạn tôi.' },
    { t: '💼', en: 'Please write a short report.', vi: 'Làm ơn viết một báo cáo ngắn.' },
    { t: '🛠️', en: 'Write down the error message, please.', vi: 'Làm ơn ghi lại thông báo lỗi.' }] },
  w202: { pat: 'my mother · mother tongue · viết hoa khi gọi: Mother', ex: [
    { t: '🏠', en: 'My mother cooks very well.', vi: 'Mẹ tôi nấu ăn rất giỏi.' },
    { t: '💼', en: 'I am late because my mother is sick.', vi: 'Tôi muộn vì mẹ tôi bị ốm.' },
    { t: '🛠️', en: 'My mother cannot use this app.', vi: 'Mẹ tôi không dùng được ứng dụng này.' }] },
  w203: { pat: 'make money · spend money on · money is (không đếm được)', ex: [
    { t: '🏠', en: 'I do not have much money today.', vi: 'Hôm nay tôi không có nhiều tiền.' },
    { t: '💼', en: 'The company makes money from ads.', vi: 'Công ty kiếm tiền từ quảng cáo.' },
    { t: '🛠️', en: 'The customer wants his money back.', vi: 'Khách hàng muốn lấy lại tiền của mình.' }] },
  w204: { pat: 'tell a story · a long story · the same story', ex: [
    { t: '🏠', en: 'My father tells good stories.', vi: 'Bố tôi kể chuyện hay.' },
    { t: '💼', en: 'The numbers tell a different story.', vi: 'Các con số kể một câu chuyện khác.' },
    { t: '🛠️', en: 'Every user tells the same story.', vi: 'Người dùng nào cũng kể cùng một câu chuyện.' }] },
  w205: { pat: 'a young man · young people · younger than', ex: [
    { t: '🏠', en: 'My sister is very young.', vi: 'Em gái tôi còn rất trẻ.' },
    { t: '💼', en: 'We have a young team.', vi: 'Chúng tôi có một đội ngũ trẻ.' },
    { t: '🛠️', en: 'Young users like the new design.', vi: 'Người dùng trẻ thích thiết kế mới.' }] },
  w206: { pat: 'in fact · the fact is… · facts (số liệu, sự việc)', ex: [
    { t: '🏠', en: 'In fact, I do not like coffee.', vi: 'Thật ra tôi không thích cà phê.' },
    { t: '💼', en: 'The fact is we need more time.', vi: 'Sự thật là chúng ta cần thêm thời gian.' },
    { t: '🛠️', en: 'In fact the error started last week.', vi: 'Thực tế lỗi bắt đầu từ tuần trước.' }] },
  w207: { pat: 'this month · last month · once a month · in May', ex: [
    { t: '🏠', en: 'I visit my parents every month.', vi: 'Tháng nào tôi cũng thăm bố mẹ.' },
    { t: '💼', en: 'Sales went up this month.', vi: 'Doanh số tháng này đã tăng.' },
    { t: '🛠️', en: 'We update the server once a month.', vi: 'Chúng tôi cập nhật máy chủ mỗi tháng một lần.' }] },
  w208: { pat: 'different from · a different way · something different', ex: [
    { t: '🏠', en: 'My brother is very different from me.', vi: 'Anh trai tôi rất khác tôi.' },
    { t: '💼', en: 'We need a different plan.', vi: 'Chúng ta cần một kế hoạch khác.' },
    { t: '🛠️', en: 'The result is different on my computer.', vi: 'Kết quả khác trên máy tính của tôi.' }] },
  w209: { pat: 'a lot of + danh từ (đếm được hay không đều được) · a lot (nhiều)', ex: [
    { t: '🏠', en: 'I have a lot of work at home.', vi: 'Tôi có rất nhiều việc ở nhà.' },
    { t: '💼', en: 'A lot of people joined the call.', vi: 'Rất nhiều người đã tham gia cuộc gọi.' },
    { t: '🛠️', en: 'The app uses a lot of memory.', vi: 'Ứng dụng dùng rất nhiều bộ nhớ.' }] },
  w210: { pat: 'study English · study for a test · study hard', ex: [
    { t: '🏠', en: 'I study English every evening.', vi: 'Tối nào tôi cũng học tiếng Anh.' },
    { t: '💼', en: 'We study the market before we start.', vi: 'Chúng tôi nghiên cứu thị trường trước khi bắt đầu.' },
    { t: '🛠️', en: 'I need to study this error first.', vi: 'Tôi cần nghiên cứu lỗi này trước đã.' }] },
  w211: { pat: 'read a book · a book about · book a room (đặt chỗ)', ex: [
    { t: '🏠', en: 'I read a book before bed.', vi: 'Tôi đọc một quyển sách trước khi ngủ.' },
    { t: '💼', en: 'Please book a meeting room.', vi: 'Làm ơn đặt một phòng họp.' },
    { t: '🛠️', en: 'This book explains the system well.', vi: 'Quyển sách này giải thích hệ thống rất rõ.' }] },
  w212: { pat: 'my eyes · keep an eye on (để mắt tới)', ex: [
    { t: '🏠', en: 'My eyes are tired.', vi: 'Mắt tôi mỏi rồi.' },
    { t: '💼', en: 'Please keep an eye on the budget.', vi: 'Làm ơn để mắt tới ngân sách.' },
    { t: '🛠️', en: 'Keep an eye on the server tonight.', vi: 'Tối nay để mắt tới máy chủ nhé.' }] },
  w213: { pat: 'a good job · do a job · job interview · get a job', ex: [
    { t: '🏠', en: 'He likes his job.', vi: 'Anh ấy thích công việc của mình.' },
    { t: '💼', en: 'I have a job interview tomorrow.', vi: 'Ngày mai tôi có một buổi phỏng vấn.' },
    { t: '🛠️', en: 'The backup job failed last night.', vi: 'Tác vụ sao lưu đã hỏng tối qua.' }] },
  w214: { pat: 'in other words · a word for · word by word', ex: [
    { t: '🏠', en: 'What does this word mean?', vi: 'Từ này nghĩa là gì?' },
    { t: '💼', en: 'In other words, we need more time.', vi: 'Nói cách khác, chúng ta cần thêm thời gian.' },
    { t: '🛠️', en: 'The password needs one more word.', vi: 'Mật khẩu cần thêm một từ nữa.' }] },
  w215: { pat: 'though đứng CUỐI câu (nói) · even though + mệnh đề', ex: [
    { t: '🏠', en: 'It is cold. I like it though.', vi: 'Trời lạnh. Nhưng tôi thích thế.' },
    { t: '💼', en: 'Even though he is new, he works fast.', vi: 'Mặc dù anh ấy mới, anh ấy làm nhanh.' },
    { t: '🛠️', en: 'The fix works, though it is slow.', vi: 'Bản sửa chạy được, mặc dù nó chậm.' }] },
  w216: { pat: 'do business with · a business trip · business hours', ex: [
    { t: '🏠', en: 'My father has a small business.', vi: 'Bố tôi có một cơ sở kinh doanh nhỏ.' },
    { t: '💼', en: 'We do business with three countries.', vi: 'Chúng tôi làm ăn với ba quốc gia.' },
    { t: '🛠️', en: 'Support is open during business hours.', vi: 'Bộ phận hỗ trợ mở trong giờ làm việc.' }] },
  w217: { pat: 'an issue with · fix an issue · report an issue', ex: [
    { t: '🏠', en: 'I have an issue with my phone.', vi: 'Tôi gặp một vấn đề với điện thoại của mình.' },
    { t: '💼', en: 'Please report the issue to your manager.', vi: 'Làm ơn báo vấn đề này cho quản lý của bạn.' },
    { t: '🛠️', en: 'We are fixing this issue now.', vi: 'Chúng tôi đang sửa vấn đề này.' }] },
  w218: { pat: 'on the other side · side by side · on my side', ex: [
    { t: '🏠', en: 'The shop is on the other side.', vi: 'Cửa hàng ở phía bên kia.' },
    { t: '💼', en: 'I am on your side in this meeting.', vi: 'Tôi đứng về phía bạn trong cuộc họp này.' },
    { t: '🛠️', en: 'The problem is on our side, not yours.', vi: 'Vấn đề nằm ở phía chúng tôi, không phải phía bạn.' }] },
  w219: { pat: 'what kind of…? · a kind of · be kind to (tử tế)', ex: [
    { t: '🏠', en: 'What kind of food do you like?', vi: 'Bạn thích loại đồ ăn nào?' },
    { t: '💼', en: 'What kind of report do you need?', vi: 'Bạn cần loại báo cáo nào?' },
    { t: '🛠️', en: 'What kind of phone do you use?', vi: 'Bạn dùng loại điện thoại nào?' }] },
  w220: { pat: 'my head hurts · head of the team · head to (đi tới)', ex: [
    { t: '🏠', en: 'My head hurts a little.', vi: 'Đầu tôi hơi đau.' },
    { t: '💼', en: 'She is the head of our team.', vi: 'Cô ấy là trưởng nhóm của chúng tôi.' },
    { t: '🛠️', en: 'The error is at the head of the file.', vi: 'Lỗi nằm ở đầu tệp.' }] },
  w221: { pat: 'how far…? · far from · so far (cho tới giờ)', ex: [
    { t: '🏠', en: 'My house is far from the market.', vi: 'Nhà tôi xa chợ.' },
    { t: '💼', en: 'How far is the office from here?', vi: 'Văn phòng cách đây bao xa?' },
    { t: '🛠️', en: 'So far only two users complained.', vi: 'Cho tới giờ chỉ có hai người dùng phàn nàn.' }] },
  w222: { pat: 'black coffee · in black and white · a black screen', ex: [
    { t: '🏠', en: 'I drink black coffee.', vi: 'Tôi uống cà phê đen.' },
    { t: '💼', en: 'Please print it in black and white.', vi: 'Làm ơn in nó đen trắng.' },
    { t: '🛠️', en: 'My screen is black after the update.', vi: 'Màn hình của tôi đen sau bản cập nhật.' }] },
  w223: { pat: 'a long time · how long…? · long hair · as long as', ex: [
    { t: '🏠', en: 'She has long hair.', vi: 'Cô ấy có mái tóc dài.' },
    { t: '💼', en: 'How long does the project take?', vi: 'Dự án kéo dài bao lâu?' },
    { t: '🛠️', en: 'The page takes a long time to load.', vi: 'Trang mất rất lâu để tải.' }] },
  w224: { pat: 'both + danh từ số nhiều · both of them · both… and…', ex: [
    { t: '🏠', en: 'Both of my children go to school.', vi: 'Cả hai đứa con tôi đều đi học.' },
    { t: '💼', en: 'Both plans are good.', vi: 'Cả hai kế hoạch đều tốt.' },
    { t: '🛠️', en: 'Both servers are down.', vi: 'Cả hai máy chủ đều sập.' }] },
  w225: { pat: 'a little + danh từ không đếm được · a little tired · little (rất ít)', ex: [
    { t: '🏠', en: 'I want a little sugar.', vi: 'Tôi muốn một chút đường.' },
    { t: '💼', en: 'I need a little more time.', vi: 'Tôi cần thêm một chút thời gian.' },
    { t: '🛠️', en: 'The app is a little slow today.', vi: 'Hôm nay ứng dụng hơi chậm một chút.' }] },

  // ---------- Chặng 10 · từ 226–250 ----------
  w226: { pat: 'a big house · at my house · houses (số nhiều)', ex: [
    { t: '🏠', en: 'Their house is near the river.', vi: 'Nhà của họ ở gần sông.' },
    { t: '💼', en: 'We had the party at my house.', vi: 'Chúng tôi tổ chức bữa tiệc ở nhà tôi.' },
    { t: '🛠️', en: 'The internet in this house is slow.', vi: 'Internet trong ngôi nhà này chậm.' }] },
  w227: { pat: 'yes, I do · yes, of course · say yes to', ex: [
    { t: '🏠', en: 'Yes, I want more rice.', vi: 'Vâng, tôi muốn thêm cơm.' },
    { t: '💼', en: 'Yes, I can join the meeting.', vi: 'Vâng, tôi có thể tham gia cuộc họp.' },
    { t: '🛠️', en: 'Yes, the problem is fixed.', vi: 'Vâng, vấn đề đã được sửa.' }] },
  w228: { pat: 'behind the house · behind schedule (trễ tiến độ)', ex: [
    { t: '🏠', en: 'The garden is behind the house.', vi: 'Khu vườn ở phía sau nhà.' },
    { t: '💼', en: 'We are behind schedule this week.', vi: 'Tuần này chúng tôi bị chậm tiến độ.' },
    { t: '🛠️', en: 'The real problem is behind this error.', vi: 'Vấn đề thật nằm phía sau lỗi này.' }] },
  w229: { pat: 'since + mốc thời gian (since 2020) · since then · đi với hiện tại hoàn thành', ex: [
    { t: '🏠', en: 'I have lived here since 2020.', vi: 'Tôi đã sống ở đây từ năm 2020.' },
    { t: '💼', en: 'She has worked here since May.', vi: 'Cô ấy làm ở đây từ tháng Năm.' },
    { t: '🛠️', en: 'The error has been there since the update.', vi: 'Lỗi đã ở đó từ lúc cập nhật.' }] },
  w230: { pat: 'provide something · provide somebody with · provide support', ex: [
    { t: '🏠', en: 'The hotel provides free breakfast.', vi: 'Khách sạn cung cấp bữa sáng miễn phí.' },
    { t: '💼', en: 'We provide support 24/7.', vi: 'Chúng tôi cung cấp hỗ trợ 24/7.' },
    { t: '🛠️', en: 'Please provide the error message.', vi: 'Làm ơn cung cấp thông báo lỗi.' }] },
  w231: { pat: 'customer service · a good service · use a service', ex: [
    { t: '🏠', en: 'The service in this restaurant is slow.', vi: 'Dịch vụ ở nhà hàng này chậm.' },
    { t: '💼', en: 'We offer customer service in two languages.', vi: 'Chúng tôi hỗ trợ khách hàng bằng hai ngôn ngữ.' },
    { t: '🛠️', en: 'The payment service is down again.', vi: 'Dịch vụ thanh toán lại sập rồi.' }] },
  w232: { pat: 'around the corner · around ten (khoảng) · look around', ex: [
    { t: '🏠', en: 'The shop is just around the corner.', vi: 'Cửa hàng ngay góc phố kia thôi.' },
    { t: '💼', en: 'The meeting starts around ten.', vi: 'Cuộc họp bắt đầu khoảng mười giờ.' },
    { t: '🛠️', en: 'Around fifty users saw this error.', vi: 'Khoảng năm mươi người dùng đã thấy lỗi này.' }] },
  w233: { pat: 'a close friend · make friends · be friends with', ex: [
    { t: '🏠', en: 'He is my best friend.', vi: 'Anh ấy là bạn thân nhất của tôi.' },
    { t: '💼', en: 'A friend told me about this job.', vi: 'Một người bạn đã kể tôi nghe về công việc này.' },
    { t: '🛠️', en: 'My friend has the same problem.', vi: 'Bạn tôi cũng gặp vấn đề tương tự.' }] },
  w234: { pat: 'it is important to + động từ · important for · very important', ex: [
    { t: '🏠', en: 'Family is important to me.', vi: 'Gia đình rất quan trọng với tôi.' },
    { t: '💼', en: 'This is an important customer.', vi: 'Đây là một khách hàng quan trọng.' },
    { t: '🛠️', en: 'It is important to save your work.', vi: 'Việc lưu bài của bạn là quan trọng.' }] },
  w235: { pat: 'my father · fathers · viết hoa khi gọi: Father', ex: [
    { t: '🏠', en: 'My father drives a taxi.', vi: 'Bố tôi lái taxi.' },
    { t: '💼', en: 'I learned this job from my father.', vi: 'Tôi học nghề này từ bố tôi.' },
    { t: '🛠️', en: 'My father cannot open his email.', vi: 'Bố tôi không mở được email của ông.' }] },
  w236: { pat: 'sit down · sit on a chair · sit next to', ex: [
    { t: '🏠', en: 'Please sit here.', vi: 'Mời ngồi đây.' },
    { t: '💼', en: 'She sits next to my desk.', vi: 'Cô ấy ngồi cạnh bàn tôi.' },
    { t: '🛠️', en: 'I sat and waited for the page to load.', vi: 'Tôi ngồi đợi trang tải xong.' }] },
  w237: { pat: 'go away · right away (ngay lập tức) · far away', ex: [
    { t: '🏠', en: 'My family lives far away.', vi: 'Gia đình tôi sống ở rất xa.' },
    { t: '💼', en: 'I will do it right away.', vi: 'Tôi sẽ làm ngay lập tức.' },
    { t: '🛠️', en: 'The error does not go away.', vi: 'Lỗi không chịu biến mất.' }] },
  w238: { pat: 'until + mốc thời gian · wait until · not until', ex: [
    { t: '🏠', en: 'I sleep until seven on Sunday.', vi: 'Chủ nhật tôi ngủ đến bảy giờ.' },
    { t: '💼', en: 'Please wait until Monday.', vi: 'Làm ơn đợi đến thứ Hai.' },
    { t: '🛠️', en: 'The server is down until noon.', vi: 'Máy chủ ngừng hoạt động đến trưa.' }] },
  w239: { pat: 'the power is off · power cut · have the power to', ex: [
    { t: '🏠', en: 'The power is off in my street.', vi: 'Phố nhà tôi bị mất điện.' },
    { t: '💼', en: 'He has the power to approve this.', vi: 'Anh ấy có quyền phê duyệt việc này.' },
    { t: '🛠️', en: 'The server lost power last night.', vi: 'Máy chủ mất điện tối qua.' }] },
  w240: { pat: 'an hour (dùng AN) · in an hour · office hours · per hour', ex: [
    { t: '🏠', en: 'I sleep eight hours every night.', vi: 'Đêm nào tôi cũng ngủ tám tiếng.' },
    { t: '💼', en: 'The meeting takes one hour.', vi: 'Cuộc họp kéo dài một tiếng.' },
    { t: '🛠️', en: 'The site was down for two hours.', vi: 'Trang web sập trong hai tiếng.' }] },
  w241: { pat: 'play a game · a football game · game over', ex: [
    { t: '🏠', en: 'My son plays this game every day.', vi: 'Ngày nào con trai tôi cũng chơi trò này.' },
    { t: '💼', en: 'We watched the game after work.', vi: 'Chúng tôi xem trận đấu sau giờ làm.' },
    { t: '🛠️', en: 'The game does not open on my phone.', vi: 'Trò chơi không mở được trên điện thoại của tôi.' }] },
  w242: { pat: 'often đứng TRƯỚC động từ chính · how often…?', ex: [
    { t: '🏠', en: 'I often walk to the market.', vi: 'Tôi thường đi bộ ra chợ.' },
    { t: '💼', en: 'How often do you meet the client?', vi: 'Bạn gặp khách hàng bao lâu một lần?' },
    { t: '🛠️', en: 'This error happens quite often.', vi: 'Lỗi này xảy ra khá thường xuyên.' }] },
  w243: { pat: 'not yet (chưa) · yet đứng CUỐI câu phủ định/câu hỏi', ex: [
    { t: '🏠', en: 'I have not eaten yet.', vi: 'Tôi chưa ăn.' },
    { t: '💼', en: 'The report is not ready yet.', vi: 'Bản báo cáo vẫn chưa xong.' },
    { t: '🛠️', en: 'Have you tried the new version yet?', vi: 'Bạn đã thử bản mới chưa?' }] },
  w244: { pat: 'in line (xếp hàng) · a line of text · on the line', ex: [
    { t: '🏠', en: 'There is a long line at the bank.', vi: 'Có một hàng dài ở ngân hàng.' },
    { t: '💼', en: 'Please sign on this line.', vi: 'Làm ơn ký vào dòng này.' },
    { t: '🛠️', en: 'The error is on line twenty.', vi: 'Lỗi nằm ở dòng hai mươi.' }] },
  w245: { pat: 'at the end of · in the end · end a call · the end', ex: [
    { t: '🏠', en: 'The shop is at the end of the street.', vi: 'Cửa hàng ở cuối con phố.' },
    { t: '💼', en: 'The project ends at the end of May.', vi: 'Dự án kết thúc vào cuối tháng Năm.' },
    { t: '🛠️', en: 'The log ends with this error.', vi: 'Bản ghi kết thúc bằng lỗi này.' }] },
  w246: { pat: 'among + nhiều thứ (từ ba trở lên) · among them', ex: [
    { t: '🏠', en: 'He is the tallest among my friends.', vi: 'Anh ấy cao nhất trong đám bạn tôi.' },
    { t: '💼', en: 'This tool is popular among our teams.', vi: 'Công cụ này phổ biến trong các nhóm của chúng tôi.' },
    { t: '🛠️', en: 'The bug is common among old phones.', vi: 'Lỗi này hay gặp ở các điện thoại cũ.' }] },
  w247: { pat: 'have you ever…? · the best ever · ever since', ex: [
    { t: '🏠', en: 'Have you ever been to Japan?', vi: 'Bạn đã từng đến Nhật Bản chưa?' },
    { t: '💼', en: 'This is the best month we have ever had.', vi: 'Đây là tháng tốt nhất chúng tôi từng có.' },
    { t: '🛠️', en: 'Have you ever seen this error before?', vi: 'Bạn đã từng thấy lỗi này trước đây chưa?' }] },
  w248: { pat: 'stand up · stand in line · I cannot stand it (chịu không nổi)', ex: [
    { t: '🏠', en: 'I stand in line every morning.', vi: 'Sáng nào tôi cũng xếp hàng.' },
    { t: '💼', en: 'Please stand up and say your name.', vi: 'Làm ơn đứng lên và nói tên của bạn.' },
    { t: '🛠️', en: 'The old server still stands in the office.', vi: 'Máy chủ cũ vẫn còn đứng đó trong văn phòng.' }] },
  w249: { pat: 'a bad idea · feel bad · not bad · worse than', ex: [
    { t: '🏠', en: 'The weather is bad today.', vi: 'Hôm nay thời tiết xấu.' },
    { t: '💼', en: 'That is bad news for the team.', vi: 'Đó là tin xấu cho cả nhóm.' },
    { t: '🛠️', en: 'The connection is very bad here.', vi: 'Kết nối ở đây rất tệ.' }] },
  w250: { pat: 'lose a key · lose money · lose a game · lost (quá khứ)', ex: [
    { t: '🏠', en: 'I lost my keys this morning.', vi: 'Sáng nay tôi làm mất chìa khoá.' },
    { t: '💼', en: 'We lost a big customer last month.', vi: 'Tháng trước chúng tôi mất một khách hàng lớn.' },
    { t: '🛠️', en: 'I lost all my data after the update.', vi: 'Tôi mất hết dữ liệu sau bản cập nhật.' }] },

  // ---------- Chặng 11 · từ 251–275 ----------
  w251: { pat: 'however + dấu phẩy, đầu câu (tuy nhiên) · trang trọng hơn but', ex: [
    { t: '🏠', en: 'It is cold. However, I want to go out.', vi: 'Trời lạnh. Tuy nhiên, tôi vẫn muốn ra ngoài.' },
    { t: '💼', en: 'The plan is good. However, it costs too much.', vi: 'Kế hoạch tốt. Tuy nhiên, nó tốn quá nhiều.' },
    { t: '🛠️', en: 'The fix works. However, the page is still slow.', vi: 'Bản sửa chạy được. Tuy nhiên, trang vẫn chậm.' }] },
  w252: { pat: 'a member of · team member · become a member', ex: [
    { t: '🏠', en: 'I am a member of a running club.', vi: 'Tôi là thành viên của một câu lạc bộ chạy bộ.' },
    { t: '💼', en: 'Every team member writes a report.', vi: 'Mỗi thành viên trong nhóm viết một báo cáo.' },
    { t: '🛠️', en: 'Only members can open this page.', vi: 'Chỉ thành viên mới mở được trang này.' }] },
  w253: { pat: 'pay for something · pay somebody · pay by card', ex: [
    { t: '🏠', en: 'I pay for the coffee.', vi: 'Tôi trả tiền cà phê.' },
    { t: '💼', en: 'The company pays me every month.', vi: 'Công ty trả lương cho tôi hằng tháng.' },
    { t: '🛠️', en: 'The customer cannot pay by card.', vi: 'Khách hàng không thanh toán được bằng thẻ.' }] },
  w254: { pat: 'the law says · against the law · a new law', ex: [
    { t: '🏠', en: 'My sister studies law.', vi: 'Chị tôi học luật.' },
    { t: '💼', en: 'The new law starts in June.', vi: 'Luật mới có hiệu lực từ tháng Sáu.' },
    { t: '🛠️', en: 'We must keep user data by law.', vi: 'Theo luật, chúng tôi phải lưu giữ dữ liệu người dùng.' }] },
  w255: { pat: 'meet somebody (KHÔNG có with khi gặp mặt) · nice to meet you', ex: [
    { t: '🏠', en: 'Nice to meet you.', vi: 'Rất vui được gặp bạn.' },
    { t: '💼', en: 'I will meet the client at three.', vi: 'Tôi sẽ gặp khách hàng lúc ba giờ.' },
    { t: '🛠️', en: 'We did not meet the deadline.', vi: 'Chúng tôi đã không kịp hạn chót.' }] },
  w256: { pat: 'by car (không mạo từ) · drive a car · in the car', ex: [
    { t: '🏠', en: 'My car is very old.', vi: 'Xe của tôi rất cũ.' },
    { t: '💼', en: 'I go to the office by car.', vi: 'Tôi đến văn phòng bằng ô tô.' },
    { t: '🛠️', en: 'The app does not work in the car.', vi: 'Ứng dụng không chạy được trong xe.' }] },
  w257: { pat: 'in the city · a big city · city centre', ex: [
    { t: '🏠', en: 'I live in a big city.', vi: 'Tôi sống ở một thành phố lớn.' },
    { t: '💼', en: 'Our office is in the city centre.', vi: 'Văn phòng của chúng tôi ở trung tâm thành phố.' },
    { t: '🛠️', en: 'We have users in every city.', vi: 'Chúng tôi có người dùng ở mọi thành phố.' }] },
  w258: { pat: 'almost + tính từ/số · almost always · almost done', ex: [
    { t: '🏠', en: 'I am almost ready.', vi: 'Tôi gần sẵn sàng rồi.' },
    { t: '💼', en: 'The report is almost done.', vi: 'Bản báo cáo gần xong rồi.' },
    { t: '🛠️', en: 'Almost all users are on mobile.', vi: 'Gần như tất cả người dùng đều dùng di động.' }] },
  w259: { pat: 'include something · including (bao gồm cả) · price includes', ex: [
    { t: '🏠', en: 'The price includes breakfast.', vi: 'Giá đã bao gồm bữa sáng.' },
    { t: '💼', en: 'Please include me in the meeting.', vi: 'Làm ơn cho tôi vào cuộc họp với.' },
    { t: '🛠️', en: 'The report includes all the errors.', vi: 'Bản báo cáo bao gồm tất cả các lỗi.' }] },
  w260: { pat: 'continue + V-ing / to + động từ · continue with', ex: [
    { t: '🏠', en: 'I continue to study every evening.', vi: 'Tôi tiếp tục học mỗi tối.' },
    { t: '💼', en: 'Let us continue after lunch.', vi: 'Chúng ta tiếp tục sau bữa trưa nhé.' },
    { t: '🛠️', en: 'The error continues after the restart.', vi: 'Lỗi vẫn tiếp tục sau khi khởi động lại.' }] },
  w261: { pat: 'set a date · set up (cài đặt) · a set of · settings', ex: [
    { t: '🏠', en: 'Please set the table.', vi: 'Làm ơn dọn bàn ăn.' },
    { t: '💼', en: 'Let us set a date for the meeting.', vi: 'Chúng ta chốt một ngày cho cuộc họp nhé.' },
    { t: '🛠️', en: 'I set up the new server yesterday.', vi: 'Hôm qua tôi đã cài đặt máy chủ mới.' }] },
  w262: { pat: 'see you later · later today · sooner or later', ex: [
    { t: '🏠', en: 'See you later!', vi: 'Gặp lại sau nhé!' },
    { t: '💼', en: 'I will send the file later today.', vi: 'Tôi sẽ gửi tệp trong hôm nay, muộn hơn một chút.' },
    { t: '🛠️', en: 'Please try again later.', vi: 'Làm ơn thử lại sau.' }] },
  w263: { pat: 'the local community · a community of · community support', ex: [
    { t: '🏠', en: 'Our community is very friendly.', vi: 'Cộng đồng của chúng tôi rất thân thiện.' },
    { t: '💼', en: 'We support the local community.', vi: 'Chúng tôi hỗ trợ cộng đồng địa phương.' },
    { t: '🛠️', en: 'The community found this bug first.', vi: 'Cộng đồng đã tìm ra lỗi này trước.' }] },
  w264: { pat: 'my name is · the name of · in the name of · first name', ex: [
    { t: '🏠', en: 'My name is Linh.', vi: 'Tên tôi là Linh.' },
    { t: '💼', en: 'What is the name of your company?', vi: 'Tên công ty của bạn là gì?' },
    { t: '🛠️', en: 'Please check the file name.', vi: 'Làm ơn kiểm tra tên tệp.' }] },
  w265: { pat: 'five + danh từ số nhiều · five minutes · at five', ex: [
    { t: '🏠', en: 'I have five brothers and sisters.', vi: 'Tôi có năm anh chị em.' },
    { t: '💼', en: 'My team has five people.', vi: 'Nhóm của tôi có năm người.' },
    { t: '🛠️', en: 'Please wait five minutes.', vi: 'Làm ơn đợi năm phút.' }] },
  w266: { pat: 'once a week · at once (ngay) · once upon a time', ex: [
    { t: '🏠', en: 'I go to the market once a week.', vi: 'Tôi đi chợ một tuần một lần.' },
    { t: '💼', en: 'We meet the client once a month.', vi: 'Chúng tôi gặp khách hàng mỗi tháng một lần.' },
    { t: '🛠️', en: 'The error happened only once.', vi: 'Lỗi chỉ xảy ra một lần thôi.' }] },
  w267: { pat: 'a white shirt · white rice · black and white', ex: [
    { t: '🏠', en: 'I want a white shirt.', vi: 'Tôi muốn một cái áo sơ mi trắng.' },
    { t: '💼', en: 'Please print it on white paper.', vi: 'Làm ơn in nó trên giấy trắng.' },
    { t: '🛠️', en: 'The screen is white and empty.', vi: 'Màn hình trắng trơn và trống rỗng.' }] },
  w268: { pat: 'at least + số · the least · at least one', ex: [
    { t: '🏠', en: 'I sleep at least seven hours.', vi: 'Tôi ngủ ít nhất bảy tiếng.' },
    { t: '💼', en: 'We need at least three people.', vi: 'Chúng ta cần ít nhất ba người.' },
    { t: '🛠️', en: 'The password needs at least eight letters.', vi: 'Mật khẩu cần ít nhất tám ký tự.' }] },
  w269: { pat: 'learn + kỹ năng · learn about · learn from · learn to', ex: [
    { t: '🏠', en: 'I want to learn to cook.', vi: 'Tôi muốn học nấu ăn.' },
    { t: '💼', en: 'I learned a lot from this project.', vi: 'Tôi đã học được nhiều từ dự án này.' },
    { t: '🛠️', en: 'New users learn the app very fast.', vi: 'Người dùng mới học ứng dụng rất nhanh.' }] },
  w270: { pat: 'a real problem · in real life · is that real?', ex: [
    { t: '🏠', en: 'Is this a real gold ring?', vi: 'Đây có phải nhẫn vàng thật không?' },
    { t: '💼', en: 'This is a real chance for us.', vi: 'Đây là một cơ hội thật sự cho chúng ta.' },
    { t: '🛠️', en: 'The real problem is the old code.', vi: 'Vấn đề thật sự là phần mã cũ.' }] },
  w271: { pat: 'change something · change your mind · a big change', ex: [
    { t: '🏠', en: 'I want to change my phone.', vi: 'Tôi muốn đổi điện thoại.' },
    { t: '💼', en: 'We changed the plan yesterday.', vi: 'Hôm qua chúng tôi đã đổi kế hoạch.' },
    { t: '🛠️', en: 'Please change your password now.', vi: 'Làm ơn đổi mật khẩu của bạn ngay bây giờ.' }] },
  w272: { pat: 'my team (số ít) · a team of · join a team · team member', ex: [
    { t: '🏠', en: 'My team won the game.', vi: 'Đội của tôi đã thắng trận.' },
    { t: '💼', en: 'My team has five people.', vi: 'Nhóm của tôi có năm người.' },
    { t: '🛠️', en: 'The team is fixing the bug now.', vi: 'Nhóm đang sửa lỗi đó bây giờ.' }] },
  w273: { pat: 'in five minutes · a minute · wait a minute · last minute', ex: [
    { t: '🏠', en: 'Wait a minute, please.', vi: 'Đợi một phút nhé.' },
    { t: '💼', en: 'The call takes twenty minutes.', vi: 'Cuộc gọi kéo dài hai mươi phút.' },
    { t: '🛠️', en: 'The page loads in one minute.', vi: 'Trang tải xong trong một phút.' }] },
  w274: { pat: 'the best + danh từ · do your best · best of all', ex: [
    { t: '🏠', en: 'This is the best coffee in town.', vi: 'Đây là cà phê ngon nhất thị trấn.' },
    { t: '💼', en: 'She is the best person for this job.', vi: 'Cô ấy là người phù hợp nhất cho công việc này.' },
    { t: '🛠️', en: 'The best way is to restart the app.', vi: 'Cách tốt nhất là khởi động lại ứng dụng.' }] },
  w275: { pat: 'a good idea · have an idea · no idea (không biết)', ex: [
    { t: '🏠', en: 'I have no idea where my keys are.', vi: 'Tôi không biết chìa khoá của tôi ở đâu.' },
    { t: '💼', en: 'That is a good idea.', vi: 'Đó là một ý tưởng hay.' },
    { t: '🛠️', en: 'I have an idea about this bug.', vi: 'Tôi có một ý về lỗi này.' }] },

  // ---------- Chặng 12 · từ 276–300 ----------
  w276: { pat: 'my kid · kids (thân mật, thay cho children)', ex: [
    { t: '🏠', en: 'My kids are at school now.', vi: 'Mấy đứa nhỏ nhà tôi đang ở trường.' },
    { t: '💼', en: 'I leave early to pick up my kid.', vi: 'Tôi về sớm để đón con.' },
    { t: '🛠️', en: 'This app is safe for kids.', vi: 'Ứng dụng này an toàn cho trẻ nhỏ.' }] },
  w277: { pat: 'my whole body · body language · the body of the email', ex: [
    { t: '🏠', en: 'My whole body hurts today.', vi: 'Hôm nay cả người tôi đau ê ẩm.' },
    { t: '💼', en: 'Body language is important in a meeting.', vi: 'Ngôn ngữ cơ thể rất quan trọng trong cuộc họp.' },
    { t: '🛠️', en: 'The body of the email is empty.', vi: 'Phần thân email trống rỗng.' }] },
  w278: { pat: 'information là KHÔNG đếm được: much information, KHÔNG có informations', ex: [
    { t: '🏠', en: 'I need more information about the trip.', vi: 'Tôi cần thêm thông tin về chuyến đi.' },
    { t: '💼', en: 'Thank you for the information.', vi: 'Cảm ơn bạn vì thông tin.' },
    { t: '🛠️', en: 'The page shows no information.', vi: 'Trang không hiện thông tin nào.' }] },
  w279: { pat: 'nothing happened · nothing to do · for nothing', ex: [
    { t: '🏠', en: 'There is nothing in the fridge.', vi: 'Trong tủ lạnh chẳng có gì cả.' },
    { t: '💼', en: 'Nothing changed since last week.', vi: 'Chẳng có gì thay đổi từ tuần trước.' },
    { t: '🛠️', en: 'Nothing happens when I click the button.', vi: 'Chẳng có gì xảy ra khi tôi bấm nút.' }] },
  w280: { pat: 'my parents (thường số nhiều) · a parent · parent company', ex: [
    { t: '🏠', en: 'I live with my parents.', vi: 'Tôi sống cùng bố mẹ.' },
    { t: '💼', en: 'Every parent gets a free ticket.', vi: 'Mỗi phụ huynh được một vé miễn phí.' },
    { t: '🛠️', en: 'Parents can lock this app.', vi: 'Phụ huynh có thể khoá ứng dụng này.' }] },
  w281: { pat: 'wash your face · face to face · face a problem', ex: [
    { t: '🏠', en: 'I wash my face every morning.', vi: 'Sáng nào tôi cũng rửa mặt.' },
    { t: '💼', en: 'Let us talk face to face.', vi: 'Chúng ta nói chuyện trực tiếp đi.' },
    { t: '🛠️', en: 'We face the same problem every month.', vi: 'Tháng nào chúng tôi cũng đối mặt cùng vấn đề đó.' }] },
  w282: { pat: 'others = những người/cái khác · some… others… · the others', ex: [
    { t: '🏠', en: 'Some like tea, others like coffee.', vi: 'Một số người thích trà, số khác thích cà phê.' },
    { t: '💼', en: 'The others are still in the meeting.', vi: 'Những người còn lại vẫn đang họp.' },
    { t: '🛠️', en: 'One server is fine, the others are down.', vi: 'Một máy chủ vẫn ổn, mấy cái còn lại thì sập.' }] },
  w283: { pat: 'a high level · at this level · level up · sea level', ex: [
    { t: '🏠', en: 'My English level is still low.', vi: 'Trình độ tiếng Anh của tôi vẫn còn thấp.' },
    { t: '💼', en: 'This task needs a higher level of care.', vi: 'Đầu việc này cần mức độ cẩn thận cao hơn.' },
    { t: '🛠️', en: 'The battery level is very low.', vi: 'Mức pin rất thấp.' }] },
  w284: { pat: 'at the office · go to the office · office hours', ex: [
    { t: '🏠', en: 'My office is near my house.', vi: 'Văn phòng của tôi gần nhà tôi.' },
    { t: '💼', en: 'I am at the office until six.', vi: 'Tôi ở văn phòng đến sáu giờ.' },
    { t: '🛠️', en: 'The internet at the office is down.', vi: 'Internet ở văn phòng đang hỏng.' }] },
  w285: { pat: 'open the door · close the door · next door · at the door', ex: [
    { t: '🏠', en: 'Please close the door.', vi: 'Làm ơn đóng cửa lại.' },
    { t: '💼', en: 'The meeting room is the second door.', vi: 'Phòng họp là cánh cửa thứ hai.' },
    { t: '🛠️', en: 'Someone is at the door.', vi: 'Có ai đó ở cửa.' }] },
  w286: { pat: 'good health · health care · in bad health (không đếm được)', ex: [
    { t: '🏠', en: 'My father is in good health.', vi: 'Bố tôi có sức khoẻ tốt.' },
    { t: '💼', en: 'The company pays for health care.', vi: 'Công ty chi trả cho chăm sóc sức khoẻ.' },
    { t: '🛠️', en: 'This page shows the health of the server.', vi: 'Trang này hiện tình trạng của máy chủ.' }] },
  w287: { pat: 'a person · people (số nhiều thường dùng) · in person (trực tiếp)', ex: [
    { t: '🏠', en: 'He is a very kind person.', vi: 'Anh ấy là một người rất tử tế.' },
    { t: '💼', en: 'I want to meet you in person.', vi: 'Tôi muốn gặp bạn trực tiếp.' },
    { t: '🛠️', en: 'Only one person can edit this file.', vi: 'Chỉ một người có thể sửa tệp này.' }] },
  w288: { pat: 'art class · a work of art · modern art (không đếm được)', ex: [
    { t: '🏠', en: 'My daughter loves art.', vi: 'Con gái tôi rất thích nghệ thuật.' },
    { t: '💼', en: 'We need art for the new website.', vi: 'Chúng tôi cần phần hình ảnh cho trang web mới.' },
    { t: '🛠️', en: 'The art on this page does not load.', vi: 'Phần hình trên trang này không tải được.' }] },
  w289: { pat: 'go to war · after the war · a price war', ex: [
    { t: '🏠', en: 'My grandfather talks about the war.', vi: 'Ông tôi hay kể về chiến tranh.' },
    { t: '💼', en: 'There is a price war in this market.', vi: 'Có một cuộc chiến giá trong thị trường này.' },
    { t: '🛠️', en: 'The old system was built after the war.', vi: 'Hệ thống cũ được xây sau chiến tranh.' }] },
  w290: { pat: 'study history · in history · the history of · order history', ex: [
    { t: '🏠', en: 'I like reading history.', vi: 'Tôi thích đọc lịch sử.' },
    { t: '💼', en: 'This is the best year in our history.', vi: 'Đây là năm tốt nhất trong lịch sử của chúng tôi.' },
    { t: '🛠️', en: 'Please check your order history.', vi: 'Làm ơn kiểm tra lịch sử đơn hàng của bạn.' }] },
  w291: { pat: 'a birthday party · go to a party · have a party', ex: [
    { t: '🏠', en: 'We had a party at my house.', vi: 'Chúng tôi đã tổ chức tiệc ở nhà tôi.' },
    { t: '💼', en: 'The company party is on Friday.', vi: 'Bữa tiệc công ty vào thứ Sáu.' },
    { t: '🛠️', en: 'We send the data to a third party.', vi: 'Chúng tôi gửi dữ liệu cho một bên thứ ba.' }] },
  w292: { pat: 'as a result · the result of · get results · test result', ex: [
    { t: '🏠', en: 'I am waiting for my test result.', vi: 'Tôi đang đợi kết quả xét nghiệm.' },
    { t: '💼', en: 'The result of the meeting was good.', vi: 'Kết quả cuộc họp rất tốt.' },
    { t: '🛠️', en: 'The search shows no results.', vi: 'Phần tìm kiếm không hiện kết quả nào.' }] },
  w293: { pat: 'open the door · the shop opens at · be open (đang mở cửa)', ex: [
    { t: '🏠', en: 'The shop opens at eight.', vi: 'Cửa hàng mở cửa lúc tám giờ.' },
    { t: '💼', en: 'I am open to your ideas.', vi: 'Tôi sẵn sàng đón nhận ý tưởng của bạn.' },
    { t: '🛠️', en: 'Please open the file again.', vi: 'Làm ơn mở lại tệp.' }] },
  w294: { pat: 'in the morning · this morning · every morning · good morning', ex: [
    { t: '🏠', en: 'I drink tea in the morning.', vi: 'Tôi uống trà vào buổi sáng.' },
    { t: '💼', en: 'The meeting is tomorrow morning.', vi: 'Cuộc họp vào sáng mai.' },
    { t: '🛠️', en: 'The error happens every morning.', vi: 'Lỗi xảy ra mỗi buổi sáng.' }] },
  w295: { pat: 'walk to + nơi · go for a walk · walk the dog', ex: [
    { t: '🏠', en: 'I walk my dog every evening.', vi: 'Tối nào tôi cũng dắt chó đi dạo.' },
    { t: '💼', en: 'I walk to the office every day.', vi: 'Ngày nào tôi cũng đi bộ đến văn phòng.' },
    { t: '🛠️', en: 'Let me walk you through the steps.', vi: 'Để tôi dẫn bạn qua từng bước.' }] },
  w296: { pat: 'the reason for · the reason why · for this reason', ex: [
    { t: '🏠', en: 'What is the reason for your trip?', vi: 'Lý do cho chuyến đi của bạn là gì?' },
    { t: '💼', en: 'That is the reason why I called you.', vi: 'Đó là lý do vì sao tôi gọi bạn.' },
    { t: '🛠️', en: 'The reason for the error is a missing file.', vi: 'Lý do của lỗi là một tệp bị thiếu.' }] },
  w297: { pat: 'a low price · low battery · low level · trái nghĩa: high', ex: [
    { t: '🏠', en: 'My phone battery is low.', vi: 'Pin điện thoại của tôi yếu rồi.' },
    { t: '💼', en: 'Sales are low this month.', vi: 'Doanh số tháng này thấp.' },
    { t: '🛠️', en: 'The disk space is very low.', vi: 'Dung lượng ổ đĩa rất thấp.' }] },
  w298: { pat: 'win a game · win a prize · won (quá khứ) · KHÔNG win somebody', ex: [
    { t: '🏠', en: 'My team won the game.', vi: 'Đội của tôi đã thắng trận.' },
    { t: '💼', en: 'We won a new customer this week.', vi: 'Tuần này chúng tôi giành được một khách hàng mới.' },
    { t: '🛠️', en: 'The old system cannot win on speed.', vi: 'Hệ thống cũ không thể thắng về tốc độ.' }] },
  w299: { pat: 'do research on · market research (không đếm được)', ex: [
    { t: '🏠', en: 'I did some research before I bought it.', vi: 'Tôi đã tìm hiểu một chút trước khi mua nó.' },
    { t: '💼', en: 'We need market research first.', vi: 'Chúng ta cần nghiên cứu thị trường trước.' },
    { t: '🛠️', en: 'My research shows the cache is the problem.', vi: 'Nghiên cứu của tôi cho thấy bộ nhớ đệm là vấn đề.' }] },
  w300: { pat: 'a young girl · girls · my little girl', ex: [
    { t: '🏠', en: 'The girl next door is my friend.', vi: 'Cô bé nhà bên là bạn tôi.' },
    { t: '💼', en: 'A girl from the school called us.', vi: 'Một cô bé từ trường học đã gọi cho chúng tôi.' },
    { t: '🛠️', en: 'The girl cannot open the app.', vi: 'Cô bé không mở được ứng dụng.' }] },

  // ---------- Chặng 13 · từ 301–325 ----------
  w301: { pat: 'a nice guy · you guys (các bạn, thân mật)', ex: [
    { t: '🏠', en: 'He is a nice guy.', vi: 'Anh ấy là một người dễ chịu.' },
    { t: '💼', en: 'The guy from sales called you.', vi: 'Anh chàng bên kinh doanh đã gọi cho bạn.' },
    { t: '🛠️', en: 'The guy on the phone has the same error.', vi: 'Anh chàng đang gọi điện gặp cùng lỗi đó.' }] },
  w302: { pat: 'early in the morning · get up early · an early start', ex: [
    { t: '🏠', en: 'I get up early every day.', vi: 'Ngày nào tôi cũng dậy sớm.' },
    { t: '💼', en: 'I leave the office early on Friday.', vi: 'Thứ Sáu tôi rời văn phòng sớm.' },
    { t: '🛠️', en: 'The backup starts early in the morning.', vi: 'Bản sao lưu bắt đầu vào sáng sớm.' }] },
  w303: { pat: 'food is (không đếm được) · fast food · cook food', ex: [
    { t: '🏠', en: 'The food here is very good.', vi: 'Đồ ăn ở đây rất ngon.' },
    { t: '💼', en: 'The company pays for our food.', vi: 'Công ty trả tiền ăn cho chúng tôi.' },
    { t: '🛠️', en: 'This app finds food near you.', vi: 'Ứng dụng này tìm đồ ăn gần bạn.' }] },
  w304: { pat: 'at the moment · one moment please · in a moment', ex: [
    { t: '🏠', en: 'One moment, please.', vi: 'Xin chờ một lát.' },
    { t: '💼', en: 'He is busy at the moment.', vi: 'Lúc này anh ấy đang bận.' },
    { t: '🛠️', en: 'The site is down at the moment.', vi: 'Hiện tại trang web đang sập.' }] },
  w305: { pat: 'he did it himself · by himself (một mình)', ex: [
    { t: '🏠', en: 'He cooked dinner himself.', vi: 'Anh ấy tự nấu bữa tối.' },
    { t: '💼', en: 'The manager wrote the report himself.', vi: 'Quản lý tự viết bản báo cáo.' },
    { t: '🛠️', en: 'He fixed the bug by himself.', vi: 'Anh ấy tự sửa lỗi một mình.' }] },
  w306: { pat: 'fresh air · air conditioner · by air (đường hàng không)', ex: [
    { t: '🏠', en: 'I need some fresh air.', vi: 'Tôi cần một chút không khí trong lành.' },
    { t: '💼', en: 'The air in this room is too cold.', vi: 'Không khí trong phòng này lạnh quá.' },
    { t: '🛠️', en: 'We send the parts by air.', vi: 'Chúng tôi gửi linh kiện bằng đường hàng không.' }] },
  w307: { pat: 'an English teacher · teachers · my teacher says', ex: [
    { t: '🏠', en: 'My teacher is very kind.', vi: 'Giáo viên của tôi rất tử tế.' },
    { t: '💼', en: 'We sell this tool to teachers.', vi: 'Chúng tôi bán công cụ này cho giáo viên.' },
    { t: '🛠️', en: 'Teachers cannot log in this morning.', vi: 'Sáng nay giáo viên không đăng nhập được.' }] },
  w308: { pat: 'force somebody to + động từ · by force · the force of', ex: [
    { t: '🏠', en: 'Do not force the door.', vi: 'Đừng cạy cửa.' },
    { t: '💼', en: 'Nobody can force you to work late.', vi: 'Không ai có thể ép bạn làm muộn.' },
    { t: '🛠️', en: 'You can force the app to restart.', vi: 'Bạn có thể ép ứng dụng khởi động lại.' }] },
  w309: { pat: 'offer somebody something · a special offer · offer to help', ex: [
    { t: '🏠', en: 'They offered me a cup of tea.', vi: 'Họ mời tôi một tách trà.' },
    { t: '💼', en: 'We offer support in two languages.', vi: 'Chúng tôi cung cấp hỗ trợ bằng hai ngôn ngữ.' },
    { t: '🛠️', en: 'Can I offer you another option?', vi: 'Tôi đề xuất bạn một lựa chọn khác nhé?' }] },
  w310: { pat: 'enough + danh từ · tính từ + enough (good enough) · enough to', ex: [
    { t: '🏠', en: 'I do not have enough money.', vi: 'Tôi không có đủ tiền.' },
    { t: '💼', en: 'We do not have enough time.', vi: 'Chúng ta không có đủ thời gian.' },
    { t: '🛠️', en: 'The server is fast enough for now.', vi: 'Máy chủ hiện tại đủ nhanh.' }] },
  w311: { pat: 'higher education · education is (không đếm được)', ex: [
    { t: '🏠', en: 'Education is important for my children.', vi: 'Giáo dục rất quan trọng với con tôi.' },
    { t: '💼', en: 'We sell to the education market.', vi: 'Chúng tôi bán cho thị trường giáo dục.' },
    { t: '🛠️', en: 'Education accounts get a free plan.', vi: 'Tài khoản giáo dục được gói miễn phí.' }] },
  w312: { pat: 'across the street · walk across · across the country', ex: [
    { t: '🏠', en: 'The bank is across the street.', vi: 'Ngân hàng ở bên kia đường.' },
    { t: '💼', en: 'We have offices across the country.', vi: 'Chúng tôi có văn phòng khắp cả nước.' },
    { t: '🛠️', en: 'The error appears across all browsers.', vi: 'Lỗi xuất hiện trên mọi trình duyệt.' }] },
  w313: { pat: 'although + mệnh đề, đầu câu · trang trọng hơn even though', ex: [
    { t: '🏠', en: 'Although it is cold, I go out.', vi: 'Mặc dù trời lạnh, tôi vẫn ra ngoài.' },
    { t: '💼', en: 'Although he is new, he works very well.', vi: 'Mặc dù anh ấy mới, anh ấy làm rất tốt.' },
    { t: '🛠️', en: 'Although we fixed it, the page is still slow.', vi: 'Mặc dù đã sửa, trang vẫn chậm.' }] },
  w314: { pat: 'remember to + động từ (nhớ làm) · remember + V-ing (nhớ đã làm)', ex: [
    { t: '🏠', en: 'Remember to lock the door.', vi: 'Nhớ khoá cửa nhé.' },
    { t: '💼', en: 'I remember his name now.', vi: 'Bây giờ tôi nhớ tên anh ấy rồi.' },
    { t: '🛠️', en: 'Remember to save your work first.', vi: 'Nhớ lưu bài của bạn trước đã.' }] },
  w315: { pat: 'my foot · feet (số nhiều bất quy tắc) · on foot (đi bộ)', ex: [
    { t: '🏠', en: 'My foot hurts.', vi: 'Chân tôi đau.' },
    { t: '💼', en: 'I go to the office on foot.', vi: 'Tôi đến văn phòng bằng cách đi bộ.' },
    { t: '🛠️', en: 'The box is two feet wide.', vi: 'Cái hộp rộng hai foot.' }] },
  w316: { pat: 'the second one · in a second (một giây) · second floor', ex: [
    { t: '🏠', en: 'This is my second cup of tea.', vi: 'Đây là tách trà thứ hai của tôi.' },
    { t: '💼', en: 'Our office is on the second floor.', vi: 'Văn phòng chúng tôi ở tầng hai.' },
    { t: '🛠️', en: 'The page loads in two seconds.', vi: 'Trang tải xong trong hai giây.' }] },
  w317: { pat: 'a young boy · boys · my little boy', ex: [
    { t: '🏠', en: 'The boy next door plays football.', vi: 'Cậu bé nhà bên chơi bóng đá.' },
    { t: '💼', en: 'A boy from the school called us.', vi: 'Một cậu bé từ trường học đã gọi cho chúng tôi.' },
    { t: '🛠️', en: 'The boy forgot his password.', vi: 'Cậu bé quên mật khẩu của mình.' }] },
  w318: { pat: 'maybe đứng ĐẦU câu · maybe not · maybe later', ex: [
    { t: '🏠', en: 'Maybe I will go tomorrow.', vi: 'Có lẽ ngày mai tôi sẽ đi.' },
    { t: '💼', en: 'Maybe we should ask the manager.', vi: 'Có lẽ chúng ta nên hỏi quản lý.' },
    { t: '🛠️', en: 'Maybe the cache is the problem.', vi: 'Có lẽ bộ nhớ đệm là vấn đề.' }] },
  w319: { pat: 'walk toward · toward the end of · toward a goal', ex: [
    { t: '🏠', en: 'He walked toward the door.', vi: 'Anh ấy đi về phía cửa.' },
    { t: '💼', en: 'We are working toward a new plan.', vi: 'Chúng tôi đang hướng tới một kế hoạch mới.' },
    { t: '🛠️', en: 'The numbers move toward zero.', vi: 'Các con số đang tiến về không.' }] },
  w320: { pat: 'be able to + động từ (thay cho can ở các thì khác)', ex: [
    { t: '🏠', en: 'I am able to cook now.', vi: 'Bây giờ tôi có thể nấu ăn rồi.' },
    { t: '💼', en: 'She was able to finish on time.', vi: 'Cô ấy đã có thể hoàn thành đúng hạn.' },
    { t: '🛠️', en: 'I am not able to log in.', vi: 'Tôi không thể đăng nhập được.' }] },
  w321: { pat: 'how old are you? · at the age of · ten years of age', ex: [
    { t: '🏠', en: 'My son is five years of age.', vi: 'Con trai tôi năm tuổi.' },
    { t: '💼', en: 'She started work at the age of twenty.', vi: 'Cô ấy bắt đầu đi làm năm hai mươi tuổi.' },
    { t: '🛠️', en: 'Users must be over the age of thirteen.', vi: 'Người dùng phải trên mười ba tuổi.' }] },
  w322: { pat: 'company policy · a new policy · privacy policy', ex: [
    { t: '🏠', en: 'My insurance policy ends in May.', vi: 'Hợp đồng bảo hiểm của tôi hết hạn vào tháng Năm.' },
    { t: '💼', en: 'This is our company policy.', vi: 'Đây là chính sách của công ty chúng tôi.' },
    { t: '🛠️', en: 'Please read the privacy policy first.', vi: 'Làm ơn đọc chính sách quyền riêng tư trước.' }] },
  w323: { pat: 'everything is (số ít) · everything about · that is everything', ex: [
    { t: '🏠', en: 'Everything is ready for dinner.', vi: 'Mọi thứ đã sẵn sàng cho bữa tối.' },
    { t: '💼', en: 'Everything is on time this week.', vi: 'Mọi thứ đều đúng hạn trong tuần này.' },
    { t: '🛠️', en: 'Everything works on my computer.', vi: 'Mọi thứ đều chạy trên máy tính của tôi.' }] },
  w324: { pat: 'love somebody · love + V-ing · I would love to', ex: [
    { t: '🏠', en: 'I love my family.', vi: 'Tôi yêu gia đình mình.' },
    { t: '💼', en: 'I love working with this team.', vi: 'Tôi rất thích làm việc với nhóm này.' },
    { t: '🛠️', en: 'Our users love the new design.', vi: 'Người dùng của chúng tôi rất thích thiết kế mới.' }] },
  w325: { pat: 'a long process · the process of · process an order (xử lý)', ex: [
    { t: '🏠', en: 'Learning English is a slow process.', vi: 'Học tiếng Anh là một quá trình chậm.' },
    { t: '💼', en: 'We have a new process for reports.', vi: 'Chúng tôi có quy trình mới cho báo cáo.' },
    { t: '🛠️', en: 'The system cannot process this order.', vi: 'Hệ thống không xử lý được đơn hàng này.' }] },

  // ---------- Chặng 14 · từ 326–350 ----------
  w326: { pat: 'listen to music · play music · music is (không đếm được)', ex: [
    { t: '🏠', en: 'I listen to music every evening.', vi: 'Tối nào tôi cũng nghe nhạc.' },
    { t: '💼', en: 'The music in the office is too loud.', vi: 'Nhạc trong văn phòng to quá.' },
    { t: '🛠️', en: 'The music does not play on my phone.', vi: 'Nhạc không phát được trên điện thoại của tôi.' }] },
  w327: { pat: 'go to the market · the market for · market share', ex: [
    { t: '🏠', en: 'I go to the market every morning.', vi: 'Sáng nào tôi cũng đi chợ.' },
    { t: '💼', en: 'The market is very hard this year.', vi: 'Thị trường năm nay rất khó.' },
    { t: '🛠️', en: 'There is a market for this app in Japan.', vi: 'Có thị trường cho ứng dụng này ở Nhật.' }] },
  w328: { pat: 'send somebody something · send it to · send an email', ex: [
    { t: '🏠', en: 'I send my mother a photo every week.', vi: 'Tuần nào tôi cũng gửi mẹ một tấm ảnh.' },
    { t: '💼', en: 'Please send me the report.', vi: 'Làm ơn gửi cho tôi bản báo cáo.' },
    { t: '🛠️', en: 'Send us the error message, please.', vi: 'Làm ơn gửi cho chúng tôi thông báo lỗi.' }] },
  w329: { pat: 'expect somebody to + động từ · as expected · expect a call', ex: [
    { t: '🏠', en: 'I expect my friend at six.', vi: 'Tôi đợi bạn tôi đến lúc sáu giờ.' },
    { t: '💼', en: 'We expect an answer this week.', vi: 'Chúng tôi mong có câu trả lời trong tuần này.' },
    { t: '🛠️', en: 'The result is not what I expected.', vi: 'Kết quả không như tôi mong đợi.' }] },
  w330: { pat: 'an office building · a tall building · in this building', ex: [
    { t: '🏠', en: 'I live in this building.', vi: 'Tôi sống trong toà nhà này.' },
    { t: '💼', en: 'Our office is in the next building.', vi: 'Văn phòng chúng tôi ở toà nhà kế bên.' },
    { t: '🛠️', en: 'The internet in this building is slow.', vi: 'Internet trong toà nhà này chậm.' }] },
  w331: { pat: 'be sure about/that · make sure (bảo đảm) · for sure', ex: [
    { t: '🏠', en: 'I am not sure about the time.', vi: 'Tôi không chắc về giờ giấc.' },
    { t: '💼', en: 'Please make sure the room is free.', vi: 'Làm ơn bảo đảm là phòng còn trống.' },
    { t: '🛠️', en: 'Make sure you save the file first.', vi: 'Hãy chắc chắn bạn lưu tệp trước.' }] },
  w332: { pat: 'a dog · walk the dog · dogs (số nhiều)', ex: [
    { t: '🏠', en: 'My dog sleeps all day.', vi: 'Con chó của tôi ngủ cả ngày.' },
    { t: '💼', en: 'My dog is sick, so I work from home.', vi: 'Chó của tôi bị ốm nên tôi làm ở nhà.' },
    { t: '🛠️', en: 'This app finds a doctor for your dog.', vi: 'Ứng dụng này tìm bác sĩ cho chó của bạn.' }] },
  w333: { pat: 'never mind · keep in mind · change your mind · do you mind?', ex: [
    { t: '🏠', en: 'Never mind, it is not important.', vi: 'Không sao đâu, không quan trọng.' },
    { t: '💼', en: 'She changed her mind about the plan.', vi: 'Cô ấy đã đổi ý về kế hoạch.' },
    { t: '🛠️', en: 'Keep in mind that the server is slow.', vi: 'Nhớ là máy chủ đang chậm nhé.' }] },
  w334: { pat: 'in the south · south of · the south side', ex: [
    { t: '🏠', en: 'My family lives in the south.', vi: 'Gia đình tôi sống ở miền Nam.' },
    { t: '💼', en: 'We opened an office in the south.', vi: 'Chúng tôi mở một văn phòng ở miền Nam.' },
    { t: '🛠️', en: 'The server in the south is down.', vi: 'Máy chủ ở miền Nam đang sập.' }] },
  w335: { pat: 'go to court · a tennis court · in court', ex: [
    { t: '🏠', en: 'We play on the tennis court.', vi: 'Chúng tôi chơi trên sân tennis.' },
    { t: '💼', en: 'The case goes to court next month.', vi: 'Vụ việc ra toà vào tháng sau.' },
    { t: '🛠️', en: 'We keep the data for court cases.', vi: 'Chúng tôi lưu dữ liệu cho các vụ kiện.' }] },
  w336: { pat: 'a plan for · plan to + động từ · make a plan · change the plan', ex: [
    { t: '🏠', en: 'I plan to visit my parents.', vi: 'Tôi dự định về thăm bố mẹ.' },
    { t: '💼', en: 'What is the plan for next week?', vi: 'Kế hoạch cho tuần sau là gì?' },
    { t: '🛠️', en: 'Our plan is to fix it today.', vi: 'Kế hoạch của chúng tôi là sửa nó hôm nay.' }] },
  w337: { pat: 'it is possible to + động từ · as soon as possible · if possible', ex: [
    { t: '🏠', en: 'Is it possible to come later?', vi: 'Có thể đến muộn hơn được không?' },
    { t: '💼', en: 'Please answer as soon as possible.', vi: 'Làm ơn trả lời sớm nhất có thể.' },
    { t: '🛠️', en: 'It is possible that the file is too big.', vi: 'Có khả năng là tệp quá lớn.' }] },
  w338: { pat: 'a piece of cake/paper · piece by piece', ex: [
    { t: '🏠', en: 'I want a piece of cake.', vi: 'Tôi muốn một miếng bánh.' },
    { t: '💼', en: 'Give me a piece of paper, please.', vi: 'Làm ơn cho tôi một tờ giấy.' },
    { t: '🛠️', en: 'One piece of data is missing.', vi: 'Một mẩu dữ liệu bị thiếu.' }] },
  w339: { pat: 'a nice view · in my view (theo tôi) · point of view', ex: [
    { t: '🏠', en: 'The room has a nice view.', vi: 'Căn phòng có quang cảnh đẹp.' },
    { t: '💼', en: 'In my view, the price is too high.', vi: 'Theo quan điểm của tôi, giá quá cao.' },
    { t: '🛠️', en: 'This page has many views today.', vi: 'Trang này hôm nay có nhiều lượt xem.' }] },
  w340: { pat: 'probably đứng TRƯỚC động từ chính · khả năng cao hơn maybe', ex: [
    { t: '🏠', en: 'I will probably stay home.', vi: 'Chắc là tôi sẽ ở nhà.' },
    { t: '💼', en: 'The meeting will probably be short.', vi: 'Cuộc họp chắc sẽ ngắn thôi.' },
    { t: '🛠️', en: 'The problem is probably in the old code.', vi: 'Vấn đề chắc là nằm ở phần mã cũ.' }] },
  w341: { pat: 'understand somebody/something · I do not understand', ex: [
    { t: '🏠', en: 'I understand you now.', vi: 'Bây giờ tôi hiểu bạn rồi.' },
    { t: '💼', en: 'I understand your problem.', vi: 'Tôi hiểu vấn đề của bạn.' },
    { t: '🛠️', en: 'I do not understand this error message.', vi: 'Tôi không hiểu thông báo lỗi này.' }] },
  w342: { pat: 'watch TV · watch a film · watch out (cẩn thận)', ex: [
    { t: '🏠', en: 'I watch TV after dinner.', vi: 'Tôi xem tivi sau bữa tối.' },
    { t: '💼', en: 'Please watch the numbers this week.', vi: 'Làm ơn theo dõi các con số trong tuần này.' },
    { t: '🛠️', en: 'We watch the server all night.', vi: 'Chúng tôi theo dõi máy chủ suốt đêm.' }] },
  w343: { pat: 'work together · get together · put together', ex: [
    { t: '🏠', en: 'We eat dinner together every night.', vi: 'Tối nào chúng tôi cũng ăn tối cùng nhau.' },
    { t: '💼', en: 'Let us work on this together.', vi: 'Chúng ta cùng làm việc này nhé.' },
    { t: '🛠️', en: 'The two errors happen together.', vi: 'Hai lỗi này xảy ra cùng nhau.' }] },
  w344: { pat: 'follow somebody · follow the rules · follow up (theo dõi tiếp)', ex: [
    { t: '🏠', en: 'The dog follows me everywhere.', vi: 'Con chó theo tôi khắp nơi.' },
    { t: '💼', en: 'I will follow up with the client.', vi: 'Tôi sẽ theo dõi tiếp với khách hàng.' },
    { t: '🛠️', en: 'Please follow these three steps.', vi: 'Làm ơn làm theo ba bước này.' }] },
  w345: { pat: 'anything else? · not anything (= nothing) · anything but', ex: [
    { t: '🏠', en: 'Do you want anything else?', vi: 'Bạn có muốn gì nữa không?' },
    { t: '💼', en: 'Tell me if you need anything.', vi: 'Nói tôi biết nếu bạn cần gì.' },
    { t: '🛠️', en: 'I cannot see anything on the screen.', vi: 'Tôi không thấy gì trên màn hình cả.' }] },
  w346: { pat: 'create something new · create an account · create a file', ex: [
    { t: '🏠', en: 'My daughter creates nice drawings.', vi: 'Con gái tôi vẽ ra những bức tranh đẹp.' },
    { t: '💼', en: 'We created a new team this month.', vi: 'Tháng này chúng tôi đã lập một nhóm mới.' },
    { t: '🛠️', en: 'Please create a new account.', vi: 'Làm ơn tạo một tài khoản mới.' }] },
  w347: { pat: 'speak English · speak to somebody · speak up', ex: [
    { t: '🏠', en: 'Do you speak English?', vi: 'Bạn có nói được tiếng Anh không?' },
    { t: '💼', en: 'May I speak to your manager?', vi: 'Tôi nói chuyện với quản lý của bạn được không?' },
    { t: '🛠️', en: 'I will speak to the developer today.', vi: 'Hôm nay tôi sẽ nói chuyện với lập trình viên.' }] },
  w348: { pat: 'read a book · read about · read (quá khứ viết giống nhau)', ex: [
    { t: '🏠', en: 'I read before bed every night.', vi: 'Tối nào tôi cũng đọc sách trước khi ngủ.' },
    { t: '💼', en: 'Please read my email carefully.', vi: 'Làm ơn đọc email của tôi cẩn thận.' },
    { t: '🛠️', en: 'The app cannot read this file.', vi: 'Ứng dụng không đọc được tệp này.' }] },
  w349: { pat: 'allow somebody to + động từ · be allowed to · not allowed', ex: [
    { t: '🏠', en: 'My parents allow me to go out.', vi: 'Bố mẹ cho phép tôi ra ngoài.' },
    { t: '💼', en: 'We allow two days off per month.', vi: 'Chúng tôi cho phép nghỉ hai ngày mỗi tháng.' },
    { t: '🛠️', en: 'The system does not allow this password.', vi: 'Hệ thống không cho phép mật khẩu này.' }] },
  w350: { pat: 'add something to · add up · in addition', ex: [
    { t: '🏠', en: 'Please add some sugar to my tea.', vi: 'Làm ơn thêm chút đường vào trà của tôi.' },
    { t: '💼', en: 'Please add me to the meeting.', vi: 'Làm ơn thêm tôi vào cuộc họp.' },
    { t: '🛠️', en: 'Add your email to the account.', vi: 'Thêm email của bạn vào tài khoản.' }] },

  // ---------- Chặng 15 · động từ hay dùng (1) ----------
  w351: { pat: 'spend money on · spend time + V-ing · spent (quá khứ)', ex: [
    { t: '🏠', en: 'I spend a lot of time with my family.', vi: 'Tôi dành nhiều thời gian cho gia đình.' },
    { t: '💼', en: 'We spend too much money on ads.', vi: 'Chúng tôi tiêu quá nhiều tiền cho quảng cáo.' },
    { t: '🛠️', en: 'I spent two hours on this bug.', vi: 'Tôi đã mất hai tiếng cho lỗi này.' }] },
  w352: { pat: 'grow up (lớn lên) · grow vegetables · grow fast', ex: [
    { t: '🏠', en: 'My son grows very fast.', vi: 'Con trai tôi lớn rất nhanh.' },
    { t: '💼', en: 'Our company grew last year.', vi: 'Công ty chúng tôi đã lớn mạnh năm ngoái.' },
    { t: '🛠️', en: 'The log file grows every hour.', vi: 'Tệp nhật ký lớn dần mỗi giờ.' }] },
  w353: { pat: 'someone + động từ số ít · someone else · ask someone', ex: [
    { t: '🏠', en: 'Someone is at the door.', vi: 'Có ai đó ở cửa.' },
    { t: '💼', en: 'Someone must write the report.', vi: 'Ai đó phải viết bản báo cáo.' },
    { t: '🛠️', en: 'Someone changed this setting.', vi: 'Ai đó đã đổi thiết lập này.' }] },
  w354: { pat: 'everyone + động từ SỐ ÍT · everyone else · hi everyone', ex: [
    { t: '🏠', en: 'Everyone is hungry.', vi: 'Mọi người đều đói.' },
    { t: '💼', en: 'Everyone has to join the meeting.', vi: 'Mọi người đều phải tham gia cuộc họp.' },
    { t: '🛠️', en: 'Everyone sees the same error.', vi: 'Mọi người đều thấy cùng một lỗi.' }] },
  w355: { pat: 'khoảng thời gian + ago, luôn đi với QUÁ KHỨ ĐƠN', ex: [
    { t: '🏠', en: 'I moved here two years ago.', vi: 'Tôi chuyển đến đây cách đây hai năm.' },
    { t: '💼', en: 'He left the office an hour ago.', vi: 'Anh ấy rời văn phòng cách đây một tiếng.' },
    { t: '🛠️', en: 'The error started ten minutes ago.', vi: 'Lỗi bắt đầu cách đây mười phút.' }] },
  w356: { pat: 'teach somebody something · teach at a school · taught (quá khứ)', ex: [
    { t: '🏠', en: 'My mother taught me to cook.', vi: 'Mẹ tôi đã dạy tôi nấu ăn.' },
    { t: '💼', en: 'She teaches English at a school.', vi: 'Cô ấy dạy tiếng Anh ở một trường học.' },
    { t: '🛠️', en: 'Let me teach you this shortcut.', vi: 'Để tôi chỉ bạn phím tắt này.' }] },
  w357: { pat: 'enjoy + V-ing (KHÔNG enjoy to) · enjoy your meal', ex: [
    { t: '🏠', en: 'I enjoy cooking at the weekend.', vi: 'Tôi thích nấu ăn vào cuối tuần.' },
    { t: '💼', en: 'I enjoy working with this team.', vi: 'Tôi thích làm việc với nhóm này.' },
    { t: '🛠️', en: 'Users enjoy the new design.', vi: 'Người dùng thích thiết kế mới.' }] },
  w358: { pat: 'remain + tính từ (vẫn ở trạng thái) · remains (phần còn lại)', ex: [
    { t: '🏠', en: 'Please remain calm.', vi: 'Làm ơn giữ bình tĩnh.' },
    { t: '💼', en: 'Two tasks remain for today.', vi: 'Còn hai đầu việc cho hôm nay.' },
    { t: '🛠️', en: 'The problem remains after the restart.', vi: 'Vấn đề vẫn còn sau khi khởi động lại.' }] },
  w359: { pat: 'write a report · a report on/about · report a problem', ex: [
    { t: '🏠', en: 'I read a report about the weather.', vi: 'Tôi đã đọc một báo cáo về thời tiết.' },
    { t: '💼', en: 'The report is due on Monday.', vi: 'Bản báo cáo đến hạn vào thứ Hai.' },
    { t: '🛠️', en: 'Please report this problem to support.', vi: 'Làm ơn báo vấn đề này cho bộ phận hỗ trợ.' }] },
  w360: { pat: 'decide to + động từ · decide on · make a decision', ex: [
    { t: '🏠', en: 'We decided to stay home.', vi: 'Chúng tôi đã quyết định ở nhà.' },
    { t: '💼', en: 'The team decided to change the plan.', vi: 'Nhóm đã quyết định đổi kế hoạch.' },
    { t: '🛠️', en: 'We decided to restart the server.', vi: 'Chúng tôi đã quyết định khởi động lại máy chủ.' }] },
  w361: { pat: 'pull the door · pull out · trái nghĩa: push', ex: [
    { t: '🏠', en: 'Pull the door, do not push it.', vi: 'Kéo cửa ra, đừng đẩy.' },
    { t: '💼', en: 'We pulled the product from the market.', vi: 'Chúng tôi đã rút sản phẩm khỏi thị trường.' },
    { t: '🛠️', en: 'The app pulls data from the server.', vi: 'Ứng dụng kéo dữ liệu từ máy chủ.' }] },
  w362: { pat: 'push the button · push hard · trái nghĩa: pull', ex: [
    { t: '🏠', en: 'Push the door to open it.', vi: 'Đẩy cửa để mở nó ra.' },
    { t: '💼', en: 'Do not push the team too hard.', vi: 'Đừng thúc ép nhóm quá.' },
    { t: '🛠️', en: 'Push the red button to stop.', vi: 'Nhấn nút đỏ để dừng lại.' }] },
  w363: { pat: 'return to + nơi · return something · in return', ex: [
    { t: '🏠', en: 'I return home at six.', vi: 'Tôi về đến nhà lúc sáu giờ.' },
    { t: '💼', en: 'Please return the book tomorrow.', vi: 'Làm ơn trả lại quyển sách vào ngày mai.' },
    { t: '🛠️', en: 'The customer wants to return the item.', vi: 'Khách hàng muốn trả lại món hàng.' }] },
  w364: { pat: 'explain something to somebody (KHÔNG explain me)', ex: [
    { t: '🏠', en: 'Please explain the rules to me.', vi: 'Làm ơn giải thích luật cho tôi.' },
    { t: '💼', en: 'Can you explain the price to the client?', vi: 'Bạn giải thích giá cho khách được không?' },
    { t: '🛠️', en: 'Let me explain this error to you.', vi: 'Để tôi giải thích lỗi này cho bạn.' }] },
  w365: { pat: 'hope to + động từ · hope that… · I hope so', ex: [
    { t: '🏠', en: 'I hope to see you soon.', vi: 'Tôi hy vọng sớm gặp lại bạn.' },
    { t: '💼', en: 'I hope the client says yes.', vi: 'Tôi hy vọng khách hàng đồng ý.' },
    { t: '🛠️', en: 'I hope this fixes the problem.', vi: 'Tôi hy vọng cái này sửa được vấn đề.' }] },
  w366: { pat: 'develop a product · develop a skill · developer', ex: [
    { t: '🏠', en: 'I want to develop a new skill.', vi: 'Tôi muốn phát triển một kỹ năng mới.' },
    { t: '💼', en: 'We develop software for schools.', vi: 'Chúng tôi phát triển phần mềm cho trường học.' },
    { t: '🛠️', en: 'The team developed a fix last night.', vi: 'Nhóm đã làm ra một bản sửa tối qua.' }] },
  w367: { pat: 'carry a bag · carry out (thực hiện) · carry on', ex: [
    { t: '🏠', en: 'Can you carry this bag for me?', vi: 'Bạn xách giúp tôi cái túi này được không?' },
    { t: '💼', en: 'We carry out this check every month.', vi: 'Chúng tôi thực hiện kiểm tra này hằng tháng.' },
    { t: '🛠️', en: 'This cable carries the data.', vi: 'Sợi cáp này mang dữ liệu đi.' }] },
  w368: { pat: 'break something · take a break · broke (quá khứ) · break down', ex: [
    { t: '🏠', en: 'I broke a glass this morning.', vi: 'Sáng nay tôi làm vỡ một cái ly.' },
    { t: '💼', en: 'Let us take a short break.', vi: 'Chúng ta nghỉ giải lao một chút nhé.' },
    { t: '🛠️', en: 'The update broke the login page.', vi: 'Bản cập nhật làm hỏng trang đăng nhập.' }] },
  w369: { pat: 'receive something from · trang trọng hơn get', ex: [
    { t: '🏠', en: 'I received a gift from my sister.', vi: 'Tôi nhận được một món quà từ chị tôi.' },
    { t: '💼', en: 'We received your email this morning.', vi: 'Chúng tôi đã nhận được email của bạn sáng nay.' },
    { t: '🛠️', en: 'The server received no data.', vi: 'Máy chủ không nhận được dữ liệu nào.' }] },
  w370: { pat: 'agree with somebody · agree on something · I agree', ex: [
    { t: '🏠', en: 'I agree with you.', vi: 'Tôi đồng ý với bạn.' },
    { t: '💼', en: 'We agreed on a new price.', vi: 'Chúng tôi đã thống nhất một mức giá mới.' },
    { t: '🛠️', en: 'Everyone agrees the old system is slow.', vi: 'Mọi người đều đồng ý hệ thống cũ chậm.' }] },
  w371: { pat: 'support somebody · customer support · support a plan', ex: [
    { t: '🏠', en: 'My family supports me.', vi: 'Gia đình ủng hộ tôi.' },
    { t: '💼', en: 'I support this plan.', vi: 'Tôi ủng hộ kế hoạch này.' },
    { t: '🛠️', en: 'Please contact support for help.', vi: 'Làm ơn liên hệ bộ phận hỗ trợ để được giúp.' }] },
  w372: { pat: 'hit somebody/something · hit (quá khứ giống nhau) · a big hit', ex: [
    { t: '🏠', en: 'The ball hit the window.', vi: 'Quả bóng đập vào cửa sổ.' },
    { t: '💼', en: 'Sales hit a new record.', vi: 'Doanh số đạt một kỷ lục mới.' },
    { t: '🛠️', en: 'The server hit its memory limit.', vi: 'Máy chủ chạm giới hạn bộ nhớ.' }] },
  w373: { pat: 'produce goods · produce a result · trang trọng hơn make', ex: [
    { t: '🏠', en: 'This farm produces rice.', vi: 'Nông trại này sản xuất gạo.' },
    { t: '💼', en: 'Our factory produces two thousand units.', vi: 'Nhà máy chúng tôi sản xuất hai nghìn sản phẩm.' },
    { t: '🛠️', en: 'This query produces the wrong result.', vi: 'Truy vấn này cho ra kết quả sai.' }] },
  w374: { pat: 'eat breakfast/lunch/dinner (không mạo từ) · eat out', ex: [
    { t: '🏠', en: 'I eat breakfast at seven.', vi: 'Tôi ăn sáng lúc bảy giờ.' },
    { t: '💼', en: 'We eat lunch at the office.', vi: 'Chúng tôi ăn trưa ở văn phòng.' },
    { t: '🛠️', en: 'I could not eat because of the alert.', vi: 'Tôi không ăn được vì cái cảnh báo.' }] },
  w375: { pat: 'cover something · cover the cost · be covered by', ex: [
    { t: '🏠', en: 'Please cover the food.', vi: 'Làm ơn đậy thức ăn lại.' },
    { t: '💼', en: 'The company covers the travel cost.', vi: 'Công ty chi trả chi phí đi lại.' },
    { t: '🛠️', en: 'These tests cover the login page.', vi: 'Các bài kiểm thử này bao quát trang đăng nhập.' }] },

  // ---------- Chặng 16 · động từ hay dùng (2) ----------
  w376: { pat: 'catch a bus · catch a cold · caught (quá khứ)', ex: [
    { t: '🏠', en: 'I catch the bus at seven.', vi: 'Tôi bắt xe buýt lúc bảy giờ.' },
    { t: '💼', en: 'I will catch you after the meeting.', vi: 'Tôi sẽ gặp bạn sau cuộc họp.' },
    { t: '🛠️', en: 'These tests catch most errors.', vi: 'Các bài kiểm thử này bắt được hầu hết lỗi.' }] },
  w377: { pat: 'draw a picture · draw a line · drew (quá khứ)', ex: [
    { t: '🏠', en: 'My daughter draws every day.', vi: 'Ngày nào con gái tôi cũng vẽ.' },
    { t: '💼', en: 'Please draw a simple chart.', vi: 'Làm ơn vẽ một biểu đồ đơn giản.' },
    { t: '🛠️', en: 'The app draws the chart too slowly.', vi: 'Ứng dụng vẽ biểu đồ quá chậm.' }] },
  w378: { pat: 'choose between A and B · choose to + động từ · chose (quá khứ)', ex: [
    { t: '🏠', en: 'Please choose a colour.', vi: 'Làm ơn chọn một màu.' },
    { t: '💼', en: 'We chose the cheaper plan.', vi: 'Chúng tôi đã chọn gói rẻ hơn.' },
    { t: '🛠️', en: 'Choose the file and click open.', vi: 'Chọn tệp rồi bấm mở.' }] },
  w379: { pat: 'drive a car · drive to work · drove (quá khứ)', ex: [
    { t: '🏠', en: 'I drive to the market every Sunday.', vi: 'Chủ nhật nào tôi cũng lái xe đi chợ.' },
    { t: '💼', en: 'He drives to the office every day.', vi: 'Ngày nào anh ấy cũng lái xe tới văn phòng.' },
    { t: '🛠️', en: 'He is driving, so he cannot answer.', vi: 'Anh ấy đang lái xe nên không trả lời được.' }] },
  w380: { pat: 'buy something for somebody · buy from · bought (quá khứ)', ex: [
    { t: '🏠', en: 'I buy rice every week.', vi: 'Tuần nào tôi cũng mua gạo.' },
    { t: '💼', en: 'We bought a new printer.', vi: 'Chúng tôi đã mua một cái máy in mới.' },
    { t: '🛠️', en: 'The customer bought the wrong plan.', vi: 'Khách hàng đã mua nhầm gói.' }] },
  w381: { pat: 'wait for somebody (luôn có FOR) · wait a minute · cannot wait', ex: [
    { t: '🏠', en: 'I am waiting for my friend.', vi: 'Tôi đang đợi bạn tôi.' },
    { t: '💼', en: 'We are waiting for your answer.', vi: 'Chúng tôi đang đợi câu trả lời của bạn.' },
    { t: '🛠️', en: 'Please wait for the update to finish.', vi: 'Làm ơn đợi bản cập nhật chạy xong.' }] },
  w382: { pat: 'sell something to somebody · sell out · sold (quá khứ)', ex: [
    { t: '🏠', en: 'I sold my old phone.', vi: 'Tôi đã bán cái điện thoại cũ.' },
    { t: '💼', en: 'We sell this service to schools.', vi: 'Chúng tôi bán dịch vụ này cho các trường học.' },
    { t: '🛠️', en: 'The tickets sold out in one minute.', vi: 'Vé bán hết trong một phút.' }] },
  w383: { pat: 'pass a test · pass the salt · pass by', ex: [
    { t: '🏠', en: 'Please pass me the salt.', vi: 'Làm ơn đưa tôi lọ muối.' },
    { t: '💼', en: 'She passed the interview.', vi: 'Cô ấy đã qua vòng phỏng vấn.' },
    { t: '🛠️', en: 'All the tests passed this morning.', vi: 'Sáng nay tất cả bài kiểm thử đều đạt.' }] },
  w384: { pat: 'drink water/tea · a drink · drank (quá khứ)', ex: [
    { t: '🏠', en: 'I drink tea every morning.', vi: 'Sáng nào tôi cũng uống trà.' },
    { t: '💼', en: 'He does not drink coffee.', vi: 'Anh ấy không uống cà phê.' },
    { t: '🛠️', en: 'Do not drink near the computer.', vi: 'Đừng uống nước gần máy tính.' }] },
  w385: { pat: 'sleep well · go to sleep · slept (quá khứ) · sleep mode', ex: [
    { t: '🏠', en: 'I sleep eight hours every night.', vi: 'Đêm nào tôi cũng ngủ tám tiếng.' },
    { t: '💼', en: 'I did not sleep before the meeting.', vi: 'Tôi đã không ngủ trước cuộc họp.' },
    { t: '🛠️', en: 'The computer goes to sleep after ten minutes.', vi: 'Máy tính vào chế độ ngủ sau mười phút.' }] },
  w386: { pat: 'wear clothes · wear glasses · wore (quá khứ)', ex: [
    { t: '🏠', en: 'I wear a jacket in winter.', vi: 'Mùa đông tôi mặc áo khoác.' },
    { t: '💼', en: 'We wear a shirt at the office.', vi: 'Ở văn phòng chúng tôi mặc áo sơ mi.' },
    { t: '🛠️', en: 'Please wear your badge in the server room.', vi: 'Làm ơn đeo thẻ trong phòng máy chủ.' }] },
  w387: { pat: 'listen to (luôn có TO) · listen carefully', ex: [
    { t: '🏠', en: 'I listen to music every evening.', vi: 'Tối nào tôi cũng nghe nhạc.' },
    { t: '💼', en: 'Please listen to the customer first.', vi: 'Làm ơn lắng nghe khách hàng trước.' },
    { t: '🛠️', en: 'Listen to this strange noise from the server.', vi: 'Nghe tiếng động lạ này từ máy chủ đi.' }] },
  w388: { pat: 'stop + V-ing (dừng hẳn) · stop to + động từ (dừng để làm)', ex: [
    { t: '🏠', en: 'Please stop talking.', vi: 'Làm ơn đừng nói nữa.' },
    { t: '💼', en: 'We stopped the project last month.', vi: 'Tháng trước chúng tôi đã dừng dự án.' },
    { t: '🛠️', en: 'The app stops after ten seconds.', vi: 'Ứng dụng dừng lại sau mười giây.' }] },
  w389: { pat: 'answer a question · answer the phone · KHÔNG answer to', ex: [
    { t: '🏠', en: 'Please answer the phone.', vi: 'Làm ơn nghe điện thoại.' },
    { t: '💼', en: 'My manager answers emails very quickly.', vi: 'Quản lý của tôi trả lời email rất nhanh.' },
    { t: '🛠️', en: 'The server does not answer.', vi: 'Máy chủ không phản hồi.' }] },
  w390: { pat: 'close the door · close to (gần) · a close friend', ex: [
    { t: '🏠', en: 'Please close the window.', vi: 'Làm ơn đóng cửa sổ.' },
    { t: '💼', en: 'The shop closes at nine.', vi: 'Cửa hàng đóng cửa lúc chín giờ.' },
    { t: '🛠️', en: 'Do not close the app during the update.', vi: 'Đừng đóng ứng dụng trong lúc cập nhật.' }] },
  w391: { pat: 'clean the house · a clean shirt · clean up', ex: [
    { t: '🏠', en: 'I clean my room every Sunday.', vi: 'Chủ nhật nào tôi cũng dọn phòng.' },
    { t: '💼', en: 'Please keep the meeting room clean.', vi: 'Làm ơn giữ phòng họp sạch sẽ.' },
    { t: '🛠️', en: 'We need clean data for this report.', vi: 'Chúng ta cần dữ liệu sạch cho báo cáo này.' }] },
  w392: { pat: 'cook dinner (không mạo từ) · a good cook · cook for', ex: [
    { t: '🏠', en: 'She cooks dinner every day.', vi: 'Ngày nào cô ấy cũng nấu bữa tối.' },
    { t: '💼', en: 'I cook lunch for the team on Friday.', vi: 'Thứ Sáu tôi nấu bữa trưa cho cả nhóm.' },
    { t: '🛠️', en: 'This app teaches you to cook.', vi: 'Ứng dụng này dạy bạn nấu ăn.' }] },
  w393: { pat: 'worry about · do not worry · be worried', ex: [
    { t: '🏠', en: 'Do not worry about me.', vi: 'Đừng lo cho tôi.' },
    { t: '💼', en: 'I worry about the deadline.', vi: 'Tôi lo về hạn chót.' },
    { t: '🛠️', en: 'Do not worry, your data is safe.', vi: 'Đừng lo, dữ liệu của bạn vẫn an toàn.' }] },
  w394: { pat: 'travel to + nơi · travel by bus · travel is (không đếm được)', ex: [
    { t: '🏠', en: 'I want to travel to Japan.', vi: 'Tôi muốn đi du lịch Nhật Bản.' },
    { t: '💼', en: 'I travel for work twice a year.', vi: 'Tôi đi công tác hai lần một năm.' },
    { t: '🛠️', en: 'The data travels through this cable.', vi: 'Dữ liệu đi qua sợi cáp này.' }] },
  w395: { pat: 'visit somebody/a place · a visit · pay a visit', ex: [
    { t: '🏠', en: 'I visit my parents every month.', vi: 'Tháng nào tôi cũng về thăm bố mẹ.' },
    { t: '💼', en: 'The client visits our office tomorrow.', vi: 'Ngày mai khách hàng đến thăm văn phòng chúng tôi.' },
    { t: '🛠️', en: 'Many users visit this page every day.', vi: 'Rất nhiều người dùng vào trang này mỗi ngày.' }] },
  w396: { pat: 'arrive at (chỗ nhỏ) · arrive in (thành phố) · KHÔNG arrive to', ex: [
    { t: '🏠', en: 'I arrive home at six.', vi: 'Tôi về đến nhà lúc sáu giờ.' },
    { t: '💼', en: 'She arrived at the office late.', vi: 'Cô ấy đến văn phòng muộn.' },
    { t: '🛠️', en: 'The data arrives every ten minutes.', vi: 'Dữ liệu về mỗi mười phút.' }] },
  w397: { pat: 'finish + V-ing · finish work · be finished', ex: [
    { t: '🏠', en: 'I finish cooking at seven.', vi: 'Tôi nấu xong lúc bảy giờ.' },
    { t: '💼', en: 'We will finish the report today.', vi: 'Hôm nay chúng tôi sẽ làm xong bản báo cáo.' },
    { t: '🛠️', en: 'The update finished ten minutes ago.', vi: 'Bản cập nhật đã xong mười phút trước.' }] },
  w398: { pat: 'check something · check on · double check · check in', ex: [
    { t: '🏠', en: 'I check the door before bed.', vi: 'Tôi kiểm tra cửa trước khi ngủ.' },
    { t: '💼', en: 'I check my email in the morning.', vi: 'Tôi kiểm tra email vào buổi sáng.' },
    { t: '🛠️', en: 'Please check your internet connection.', vi: 'Làm ơn kiểm tra kết nối internet của bạn.' }] },
  w399: { pat: 'fix a problem · fix a car · a quick fix', ex: [
    { t: '🏠', en: 'I need to fix my bike.', vi: 'Tôi cần sửa cái xe đạp.' },
    { t: '💼', en: 'We will fix this by Friday.', vi: 'Chúng tôi sẽ sửa xong trước thứ Sáu.' },
    { t: '🛠️', en: 'We are fixing this issue now.', vi: 'Chúng tôi đang sửa vấn đề này.' }] },
  w400: { pat: 'forget to + động từ · forget about · forgot (quá khứ)', ex: [
    { t: '🏠', en: 'I forgot my keys at home.', vi: 'Tôi để quên chìa khoá ở nhà.' },
    { t: '💼', en: 'Do not forget the meeting at two.', vi: 'Đừng quên cuộc họp lúc hai giờ.' },
    { t: '🛠️', en: 'I forgot my password again.', vi: 'Tôi lại quên mật khẩu rồi.' }] },

  // ---------- Chặng 17 · tính từ hay dùng ----------
  w401: { pat: 'be happy about/with · happy to + động từ · happy birthday', ex: [
    { t: '🏠', en: 'I am very happy today.', vi: 'Hôm nay tôi rất vui.' },
    { t: '💼', en: 'The customer is happy with the price.', vi: 'Khách hàng hài lòng với giá.' },
    { t: '🛠️', en: 'I am happy to help you with this.', vi: 'Tôi rất sẵn lòng giúp bạn việc này.' }] },
  w402: { pat: 'be sad about · a sad story · feel sad', ex: [
    { t: '🏠', en: 'I feel sad today.', vi: 'Hôm nay tôi thấy buồn.' },
    { t: '💼', en: 'We are sad to lose this customer.', vi: 'Chúng tôi buồn vì mất khách hàng này.' },
    { t: '🛠️', en: 'It is sad that the old app stops working.', vi: 'Thật buồn là ứng dụng cũ ngừng hoạt động.' }] },
  w403: { pat: 'be tired of (chán) · feel tired · too tired to', ex: [
    { t: '🏠', en: 'I am very tired today.', vi: 'Hôm nay tôi rất mệt.' },
    { t: '💼', en: 'She is tired after the long meeting.', vi: 'Cô ấy mệt sau cuộc họp dài.' },
    { t: '🛠️', en: 'I am tired of this error.', vi: 'Tôi chán cái lỗi này rồi.' }] },
  w404: { pat: 'be hungry · get hungry · I am hungry (KHÔNG I have hunger)', ex: [
    { t: '🏠', en: 'I am hungry now.', vi: 'Bây giờ tôi đói.' },
    { t: '💼', en: 'We are hungry, let us have lunch.', vi: 'Chúng ta đói rồi, đi ăn trưa thôi.' },
    { t: '🛠️', en: 'I skipped lunch and now I am hungry.', vi: 'Tôi bỏ bữa trưa và giờ tôi đói.' }] },
  w405: { pat: 'be thirsty · get thirsty · I am thirsty', ex: [
    { t: '🏠', en: 'I am thirsty, I want water.', vi: 'Tôi khát, tôi muốn uống nước.' },
    { t: '💼', en: 'Are you thirsty? There is tea here.', vi: 'Bạn khát không? Có trà ở đây này.' },
    { t: '🛠️', en: 'After the long call I was thirsty.', vi: 'Sau cuộc gọi dài tôi thấy khát.' }] },
  w406: { pat: 'be angry with somebody · angry about something', ex: [
    { t: '🏠', en: 'My mother is angry with me.', vi: 'Mẹ tôi đang giận tôi.' },
    { t: '💼', en: 'The client is angry about the delay.', vi: 'Khách hàng đang bực về việc chậm trễ.' },
    { t: '🛠️', en: 'Users are angry about the new design.', vi: 'Người dùng đang bực về thiết kế mới.' }] },
  w407: { pat: 'be busy with · be busy + V-ing · a busy day', ex: [
    { t: '🏠', en: 'I am busy this evening.', vi: 'Tối nay tôi bận.' },
    { t: '💼', en: 'He is busy at the moment.', vi: 'Lúc này anh ấy đang bận.' },
    { t: '🛠️', en: 'The server is busy right now.', vi: 'Máy chủ hiện đang bận.' }] },
  w408: { pat: 'be free (rảnh) · for free (miễn phí) · free time', ex: [
    { t: '🏠', en: 'I am free on Sunday.', vi: 'Chủ nhật tôi rảnh.' },
    { t: '💼', en: 'Are you free at three?', vi: 'Ba giờ bạn rảnh không?' },
    { t: '🛠️', en: 'The basic plan is free.', vi: 'Gói cơ bản là miễn phí.' }] },
  w409: { pat: 'easy to + động từ · an easy job · take it easy', ex: [
    { t: '🏠', en: 'This recipe is very easy.', vi: 'Công thức này rất dễ.' },
    { t: '💼', en: 'The task is easy but it takes time.', vi: 'Đầu việc dễ nhưng mất thời gian.' },
    { t: '🛠️', en: 'The app is easy to use.', vi: 'Ứng dụng này dễ dùng.' }] },
  w410: { pat: 'hard to + động từ · work hard (chăm chỉ) · a hard day', ex: [
    { t: '🏠', en: 'This question is too hard for me.', vi: 'Câu hỏi này quá khó với tôi.' },
    { t: '💼', en: 'She works very hard.', vi: 'Cô ấy làm việc rất chăm chỉ.' },
    { t: '🛠️', en: 'This bug is hard to find.', vi: 'Lỗi này khó tìm.' }] },
  w411: { pat: 'a fast car · run fast (vừa là tính từ vừa là trạng từ)', ex: [
    { t: '🏠', en: 'He walks very fast.', vi: 'Anh ấy đi bộ rất nhanh.' },
    { t: '💼', en: 'We need a fast answer.', vi: 'Chúng tôi cần một câu trả lời nhanh.' },
    { t: '🛠️', en: 'The new server is very fast.', vi: 'Máy chủ mới rất nhanh.' }] },
  w412: { pat: 'a slow car · slowly (trạng từ) · slow down', ex: [
    { t: '🏠', en: 'The bus is very slow today.', vi: 'Hôm nay xe buýt rất chậm.' },
    { t: '💼', en: 'This month is slow for sales.', vi: 'Tháng này doanh số chậm.' },
    { t: '🛠️', en: 'The website is slow this morning.', vi: 'Sáng nay trang web chậm.' }] },
  w413: { pat: 'it is hot (thời tiết) · hot water · hot coffee', ex: [
    { t: '🏠', en: 'It is very hot today.', vi: 'Hôm nay trời rất nóng.' },
    { t: '💼', en: 'The office is too hot.', vi: 'Văn phòng nóng quá.' },
    { t: '🛠️', en: 'The laptop is very hot.', vi: 'Máy tính xách tay nóng ran.' }] },
  w414: { pat: 'it is cold · catch a cold · cold water', ex: [
    { t: '🏠', en: 'The water is too cold.', vi: 'Nước lạnh quá.' },
    { t: '💼', en: 'The meeting room is cold.', vi: 'Phòng họp lạnh.' },
    { t: '🛠️', en: 'The server room is always cold.', vi: 'Phòng máy chủ lúc nào cũng lạnh.' }] },
  w415: { pat: 'be clear about · make it clear · clear water', ex: [
    { t: '🏠', en: 'The sky is clear today.', vi: 'Hôm nay trời quang.' },
    { t: '💼', en: 'Your message is very clear.', vi: 'Tin nhắn của bạn rất rõ ràng.' },
    { t: '🛠️', en: 'Please clear the cache and try again.', vi: 'Làm ơn xoá bộ nhớ đệm rồi thử lại.' }] },
  w416: { pat: 'be ready for · be ready to + động từ · get ready', ex: [
    { t: '🏠', en: 'Dinner is ready.', vi: 'Bữa tối sẵn sàng rồi.' },
    { t: '💼', en: 'The report is not ready yet.', vi: 'Bản báo cáo vẫn chưa xong.' },
    { t: '🛠️', en: 'The new version is ready to test.', vi: 'Bản mới đã sẵn sàng để kiểm thử.' }] },
  w417: { pat: 'be sorry for/about · I am sorry to hear that · sorry, but…', ex: [
    { t: '🏠', en: 'I am sorry, I am late.', vi: 'Tôi xin lỗi, tôi đến muộn.' },
    { t: '💼', en: 'I am sorry about the delay.', vi: 'Tôi xin lỗi vì sự chậm trễ.' },
    { t: '🛠️', en: 'I am sorry to hear about this problem.', vi: 'Tôi rất tiếc khi nghe về vấn đề này.' }] },
  w418: { pat: 'be nice to somebody · a nice day · nice to meet you', ex: [
    { t: '🏠', en: 'It is a nice day today.', vi: 'Hôm nay là một ngày đẹp trời.' },
    { t: '💼', en: 'Nice to meet you.', vi: 'Rất vui được gặp bạn.' },
    { t: '🛠️', en: 'The new design is very nice.', vi: 'Thiết kế mới rất đẹp.' }] },
  w419: { pat: 'a beautiful place · beautiful weather · trang trọng hơn nice', ex: [
    { t: '🏠', en: 'Your garden is beautiful.', vi: 'Khu vườn của bạn thật đẹp.' },
    { t: '💼', en: 'The new office is beautiful.', vi: 'Văn phòng mới thật đẹp.' },
    { t: '🛠️', en: 'The new home page looks beautiful.', vi: 'Trang chủ mới trông thật đẹp.' }] },
  w420: { pat: 'be strong · a strong password · get stronger', ex: [
    { t: '🏠', en: 'My father is very strong.', vi: 'Bố tôi rất khoẻ.' },
    { t: '💼', en: 'We have a strong team.', vi: 'Chúng tôi có một đội ngũ mạnh.' },
    { t: '🛠️', en: 'Please use a strong password.', vi: 'Làm ơn dùng một mật khẩu mạnh.' }] },
  w421: { pat: 'be weak · a weak signal · weak point', ex: [
    { t: '🏠', en: 'I feel weak after the flu.', vi: 'Tôi thấy yếu sau trận cúm.' },
    { t: '💼', en: 'This is the weak point of our plan.', vi: 'Đây là điểm yếu của kế hoạch chúng ta.' },
    { t: '🛠️', en: 'The wifi signal is very weak here.', vi: 'Sóng wifi ở đây rất yếu.' }] },
  w422: { pat: 'be safe · keep something safe · a safe place', ex: [
    { t: '🏠', en: 'The children are safe at home.', vi: 'Bọn trẻ vẫn an toàn ở nhà.' },
    { t: '💼', en: 'Keep these papers in a safe place.', vi: 'Giữ mấy tờ giấy này ở nơi an toàn.' },
    { t: '🛠️', en: 'Your data is safe with us.', vi: 'Dữ liệu của bạn an toàn với chúng tôi.' }] },
  w423: { pat: 'it is dangerous to + động từ · a dangerous road', ex: [
    { t: '🏠', en: 'This road is dangerous at night.', vi: 'Con đường này nguy hiểm vào ban đêm.' },
    { t: '💼', en: 'It is dangerous to sign without reading.', vi: 'Ký mà không đọc thì nguy hiểm.' },
    { t: '🛠️', en: 'It is dangerous to share your password.', vi: 'Chia sẻ mật khẩu của bạn là nguy hiểm.' }] },
  w424: { pat: 'be expensive · too expensive · trái nghĩa: cheap', ex: [
    { t: '🏠', en: 'This restaurant is expensive.', vi: 'Nhà hàng này đắt.' },
    { t: '💼', en: 'The new plan is too expensive for us.', vi: 'Gói mới quá đắt với chúng tôi.' },
    { t: '🛠️', en: 'A bigger server is expensive.', vi: 'Một máy chủ lớn hơn thì đắt.' }] },
  w425: { pat: 'be cheap · a cheap ticket · cheaper than', ex: [
    { t: '🏠', en: 'The rice here is cheap.', vi: 'Gạo ở đây rẻ.' },
    { t: '💼', en: 'We found a cheaper option.', vi: 'Chúng tôi đã tìm được lựa chọn rẻ hơn.' },
    { t: '🛠️', en: 'This plan is cheap but slow.', vi: 'Gói này rẻ nhưng chậm.' }] },

  // ---------- Chặng 18 · trạng từ & thời gian ----------
  w426: { pat: 'suddenly đứng đầu câu hoặc trước động từ · all of a sudden', ex: [
    { t: '🏠', en: 'Suddenly it started to rain.', vi: 'Đột nhiên trời bắt đầu mưa.' },
    { t: '💼', en: 'The client suddenly changed the plan.', vi: 'Khách hàng đột nhiên đổi kế hoạch.' },
    { t: '🛠️', en: 'The app suddenly stopped working.', vi: 'Ứng dụng đột nhiên ngừng hoạt động.' }] },
  w427: { pat: 'usually đứng TRƯỚC động từ chính, SAU be', ex: [
    { t: '🏠', en: 'I usually have breakfast at seven.', vi: 'Tôi thường ăn sáng lúc bảy giờ.' },
    { t: '💼', en: 'The meeting usually takes one hour.', vi: 'Cuộc họp thường kéo dài một tiếng.' },
    { t: '🛠️', en: 'The backup usually finishes at midnight.', vi: 'Bản sao lưu thường xong lúc nửa đêm.' }] },
  w428: { pat: 'sometimes đứng đầu câu hoặc trước động từ chính', ex: [
    { t: '🏠', en: 'Sometimes I cook at the weekend.', vi: 'Thỉnh thoảng tôi nấu ăn vào cuối tuần.' },
    { t: '💼', en: 'She is sometimes late for the meeting.', vi: 'Thỉnh thoảng cô ấy đến muộn cuộc họp.' },
    { t: '🛠️', en: 'Sometimes the page does not load.', vi: 'Thỉnh thoảng trang không tải được.' }] },
  w429: { pat: 'rarely đã mang nghĩa phủ định — KHÔNG thêm not', ex: [
    { t: '🏠', en: 'I rarely drink coffee.', vi: 'Tôi hiếm khi uống cà phê.' },
    { t: '💼', en: 'He rarely arrives late.', vi: 'Anh ấy hiếm khi đến muộn.' },
    { t: '🛠️', en: 'This error rarely happens.', vi: 'Lỗi này hiếm khi xảy ra.' }] },
  w430: { pat: 'yesterday đi với QUÁ KHỨ ĐƠN · yesterday morning · the day before yesterday', ex: [
    { t: '🏠', en: 'I visited my parents yesterday.', vi: 'Hôm qua tôi đã về thăm bố mẹ.' },
    { t: '💼', en: 'We sent the report yesterday.', vi: 'Hôm qua chúng tôi đã gửi báo cáo.' },
    { t: '🛠️', en: 'The server went down yesterday.', vi: 'Máy chủ đã sập hôm qua.' }] },
  w431: { pat: 'tomorrow đi với WILL · tomorrow morning · the day after tomorrow', ex: [
    { t: '🏠', en: 'I will cook fish tomorrow.', vi: 'Ngày mai tôi sẽ nấu cá.' },
    { t: '💼', en: 'The meeting is tomorrow morning.', vi: 'Cuộc họp vào sáng mai.' },
    { t: '🛠️', en: 'We will send the fix tomorrow.', vi: 'Ngày mai chúng tôi sẽ gửi bản sửa.' }] },
  w432: { pat: 'tonight (KHÔNG có in/on) · see you tonight', ex: [
    { t: '🏠', en: 'I will call you tonight.', vi: 'Tối nay tôi sẽ gọi cho bạn.' },
    { t: '💼', en: 'I work late tonight.', vi: 'Tối nay tôi làm muộn.' },
    { t: '🛠️', en: 'The update runs tonight.', vi: 'Bản cập nhật chạy tối nay.' }] },
  w433: { pat: 'see you soon · as soon as possible · soon after', ex: [
    { t: '🏠', en: 'I will be home soon.', vi: 'Tôi sẽ về nhà sớm thôi.' },
    { t: '💼', en: 'We will answer you soon.', vi: 'Chúng tôi sẽ trả lời bạn sớm.' },
    { t: '🛠️', en: 'The fix will be ready soon.', vi: 'Bản sửa sẽ sẵn sàng sớm thôi.' }] },
  w434: { pat: 'already đứng giữa trợ động từ và động từ chính · đi với hiện tại hoàn thành', ex: [
    { t: '🏠', en: 'I have already eaten.', vi: 'Tôi đã ăn rồi.' },
    { t: '💼', en: 'She has already sent the report.', vi: 'Cô ấy đã gửi báo cáo rồi.' },
    { t: '🛠️', en: 'We have already fixed this bug.', vi: 'Chúng tôi đã sửa lỗi này rồi.' }] },
  w435: { pat: 'recently + hiện tại hoàn thành hoặc quá khứ đơn', ex: [
    { t: '🏠', en: 'I recently moved to a new house.', vi: 'Gần đây tôi chuyển đến nhà mới.' },
    { t: '💼', en: 'We recently hired two people.', vi: 'Gần đây chúng tôi đã tuyển hai người.' },
    { t: '🛠️', en: 'This error started recently.', vi: 'Lỗi này mới bắt đầu gần đây.' }] },
  w436: { pat: 'everywhere đứng CUỐI câu · almost everywhere', ex: [
    { t: '🏠', en: 'I looked everywhere for my keys.', vi: 'Tôi đã tìm chìa khoá khắp mọi nơi.' },
    { t: '💼', en: 'Our products are sold everywhere.', vi: 'Sản phẩm của chúng tôi được bán khắp nơi.' },
    { t: '🛠️', en: 'This error appears everywhere.', vi: 'Lỗi này xuất hiện ở khắp nơi.' }] },
  w437: { pat: 'unfortunately + dấu phẩy, đầu câu (báo tin xấu lịch sự)', ex: [
    { t: '🏠', en: 'Unfortunately, I cannot come tonight.', vi: 'Không may là tối nay tôi không đến được.' },
    { t: '💼', en: 'Unfortunately, the price went up.', vi: 'Không may là giá đã tăng.' },
    { t: '🛠️', en: 'Unfortunately, the data is gone.', vi: 'Không may là dữ liệu đã mất.' }] },
  w438: { pat: 'quickly bổ nghĩa cho ĐỘNG TỪ, đứng sau động từ hoặc cuối câu', ex: [
    { t: '🏠', en: 'I ate my breakfast quickly.', vi: 'Tôi ăn sáng thật nhanh.' },
    { t: '💼', en: 'My manager answers emails very quickly.', vi: 'Quản lý của tôi trả lời email rất nhanh.' },
    { t: '🛠️', en: 'Please fix this quickly.', vi: 'Làm ơn sửa việc này nhanh lên.' }] },
  w439: { pat: 'slowly bổ nghĩa cho ĐỘNG TỪ (KHÔNG dùng slow ở đây)', ex: [
    { t: '🏠', en: 'Please speak slowly.', vi: 'Làm ơn nói chậm lại.' },
    { t: '💼', en: 'Sales are growing slowly.', vi: 'Doanh số đang tăng chậm.' },
    { t: '🛠️', en: 'My computer starts slowly.', vi: 'Máy tính của tôi khởi động chậm.' }] },
  w440: { pat: 'do something carefully · read carefully · listen carefully', ex: [
    { t: '🏠', en: 'Please drive carefully.', vi: 'Làm ơn lái xe cẩn thận.' },
    { t: '💼', en: 'Please read the contract carefully.', vi: 'Làm ơn đọc hợp đồng cẩn thận.' },
    { t: '🛠️', en: 'Check the log carefully.', vi: 'Kiểm tra bản ghi cẩn thận.' }] },
  w441: { pat: 'finally + dấu phẩy, đầu câu (cuối cùng thì) · finally arrived', ex: [
    { t: '🏠', en: 'Finally, the bus arrived.', vi: 'Cuối cùng thì xe buýt cũng đến.' },
    { t: '💼', en: 'Finally, we agreed on a price.', vi: 'Cuối cùng chúng tôi cũng thống nhất được giá.' },
    { t: '🛠️', en: 'The update finally finished.', vi: 'Bản cập nhật cuối cùng cũng xong.' }] },
  w442: { pat: 'do something immediately · trang trọng hơn right away', ex: [
    { t: '🏠', en: 'Please come home immediately.', vi: 'Làm ơn về nhà ngay lập tức.' },
    { t: '💼', en: 'I will send it immediately.', vi: 'Tôi sẽ gửi nó ngay lập tức.' },
    { t: '🛠️', en: 'Please stop the server immediately.', vi: 'Làm ơn dừng máy chủ ngay lập tức.' }] },
  w443: { pat: 'perhaps đứng đầu câu · trang trọng hơn maybe', ex: [
    { t: '🏠', en: 'Perhaps we should stay home.', vi: 'Có lẽ chúng ta nên ở nhà.' },
    { t: '💼', en: 'Perhaps we can meet on Friday.', vi: 'Có lẽ chúng ta có thể gặp vào thứ Sáu.' },
    { t: '🛠️', en: 'Perhaps the file is too big.', vi: 'Có lẽ tệp quá lớn.' }] },
  w444: { pat: 'instead đứng cuối câu · instead of + danh từ/V-ing', ex: [
    { t: '🏠', en: 'I drank tea instead of coffee.', vi: 'Tôi uống trà thay vì cà phê.' },
    { t: '💼', en: 'Let us meet on Friday instead.', vi: 'Thay vào đó chúng ta gặp vào thứ Sáu nhé.' },
    { t: '🛠️', en: 'Use the new tool instead of the old one.', vi: 'Dùng công cụ mới thay cho cái cũ.' }] },
  w445: { pat: 'besides + danh từ/V-ing · besides, … (ngoài ra)', ex: [
    { t: '🏠', en: 'Besides tea, I drink water.', vi: 'Ngoài trà ra, tôi uống nước.' },
    { t: '💼', en: 'Besides the report, I have two calls.', vi: 'Ngoài bản báo cáo, tôi còn hai cuộc gọi.' },
    { t: '🛠️', en: 'Besides this bug, everything works.', vi: 'Ngoài lỗi này ra, mọi thứ đều chạy.' }] },
  w446: { pat: 'therefore + dấu phẩy, đầu câu · trang trọng hơn so', ex: [
    { t: '🏠', en: 'It is raining. Therefore, I stay home.', vi: 'Trời đang mưa. Do đó, tôi ở nhà.' },
    { t: '💼', en: 'The cost is high. Therefore, we say no.', vi: 'Chi phí cao. Do đó, chúng tôi từ chối.' },
    { t: '🛠️', en: 'The disk is full. Therefore, the app fails.', vi: 'Ổ đĩa đầy. Do đó, ứng dụng lỗi.' }] },
  w447: { pat: 'anyway đứng đầu hoặc cuối câu (chuyển chủ đề, hoặc dù sao)', ex: [
    { t: '🏠', en: 'It is late. Anyway, thank you.', vi: 'Muộn rồi. Dù sao cũng cảm ơn bạn.' },
    { t: '💼', en: 'Anyway, let us start the meeting.', vi: 'Dù sao thì, chúng ta bắt đầu cuộc họp thôi.' },
    { t: '🛠️', en: 'It is slow, but it works anyway.', vi: 'Nó chậm, nhưng dù sao vẫn chạy.' }] },
  w448: { pat: 'actually (thật ra, sửa lại thông tin) · KHÔNG nghĩa là hiện tại', ex: [
    { t: '🏠', en: 'Actually, I do not like coffee.', vi: 'Thật ra tôi không thích cà phê.' },
    { t: '💼', en: 'Actually, the meeting is at three.', vi: 'Thật ra cuộc họp lúc ba giờ.' },
    { t: '🛠️', en: 'Actually, the problem is on our side.', vi: 'Thật ra vấn đề nằm ở phía chúng tôi.' }] },
  w449: { pat: 'especially + danh từ (đặc biệt là) · especially when', ex: [
    { t: '🏠', en: 'I like fruit, especially mango.', vi: 'Tôi thích trái cây, đặc biệt là xoài.' },
    { t: '💼', en: 'Friday is busy, especially in the morning.', vi: 'Thứ Sáu bận, đặc biệt là buổi sáng.' },
    { t: '🛠️', en: 'The app is slow, especially on old phones.', vi: 'Ứng dụng chậm, đặc biệt trên điện thoại cũ.' }] },
  w450: { pat: 'exactly + số/thời gian · that is exactly right · not exactly', ex: [
    { t: '🏠', en: 'The bus leaves at exactly six.', vi: 'Xe buýt chạy đúng sáu giờ.' },
    { t: '💼', en: 'That is exactly what I need.', vi: 'Đó chính xác là thứ tôi cần.' },
    { t: '🛠️', en: 'Tell me exactly what the screen says.', vi: 'Nói chính xác cho tôi màn hình hiện gì.' }] },

  // ---------- Chặng 19 · đời sống hằng ngày ----------
  w451: { pat: 'happy birthday · a birthday party · on my birthday', ex: [
    { t: '🏠', en: 'Today is my birthday.', vi: 'Hôm nay là sinh nhật tôi.' },
    { t: '💼', en: 'We have a cake for her birthday.', vi: 'Chúng tôi có một cái bánh cho sinh nhật cô ấy.' },
    { t: '🛠️', en: 'The app asks for your birthday.', vi: 'Ứng dụng hỏi ngày sinh của bạn.' }] },
  w452: { pat: 'at the weekend · this weekend · have a nice weekend', ex: [
    { t: '🏠', en: 'I cook at the weekend.', vi: 'Tôi nấu ăn vào cuối tuần.' },
    { t: '💼', en: 'We do not work at the weekend.', vi: 'Chúng tôi không làm việc vào cuối tuần.' },
    { t: '🛠️', en: 'The update runs this weekend.', vi: 'Bản cập nhật chạy vào cuối tuần này.' }] },
  w453: { pat: 'go on holiday · a public holiday · holiday season', ex: [
    { t: '🏠', en: 'We go on holiday in June.', vi: 'Chúng tôi đi nghỉ vào tháng Sáu.' },
    { t: '💼', en: 'Monday is a public holiday.', vi: 'Thứ Hai là ngày lễ.' },
    { t: '🛠️', en: 'Support is closed on holidays.', vi: 'Bộ phận hỗ trợ đóng cửa vào ngày lễ.' }] },
  w454: { pat: 'have breakfast (KHÔNG có mạo từ) · for breakfast', ex: [
    { t: '🏠', en: 'I have breakfast at seven.', vi: 'Tôi ăn sáng lúc bảy giờ.' },
    { t: '💼', en: 'The hotel gives us free breakfast.', vi: 'Khách sạn cho chúng tôi bữa sáng miễn phí.' },
    { t: '🛠️', en: 'I fixed the bug before breakfast.', vi: 'Tôi đã sửa lỗi trước bữa sáng.' }] },
  w455: { pat: 'have lunch · lunch break · for lunch', ex: [
    { t: '🏠', en: 'I eat lunch at home.', vi: 'Tôi ăn trưa ở nhà.' },
    { t: '💼', en: 'Let us talk after lunch.', vi: 'Chúng ta nói chuyện sau bữa trưa nhé.' },
    { t: '🛠️', en: 'The server restarted during lunch.', vi: 'Máy chủ khởi động lại trong giờ trưa.' }] },
  w456: { pat: 'have dinner · cook dinner · for dinner', ex: [
    { t: '🏠', en: 'She is cooking dinner.', vi: 'Cô ấy đang nấu bữa tối.' },
    { t: '💼', en: 'We had dinner with the client.', vi: 'Chúng tôi đã ăn tối với khách hàng.' },
    { t: '🛠️', en: 'I worked until dinner last night.', vi: 'Tối qua tôi làm đến tận bữa tối.' }] },
  w457: { pat: 'a cup of coffee · black coffee · make coffee', ex: [
    { t: '🏠', en: 'I drink a cup of coffee every morning.', vi: 'Sáng nào tôi cũng uống một tách cà phê.' },
    { t: '💼', en: 'Let us talk over coffee.', vi: 'Chúng ta vừa uống cà phê vừa nói chuyện nhé.' },
    { t: '🛠️', en: 'I need coffee before I read this log.', vi: 'Tôi cần cà phê trước khi đọc bản ghi này.' }] },
  w458: { pat: 'a cup of tea · green tea · make tea', ex: [
    { t: '🏠', en: 'I make tea every evening.', vi: 'Tối nào tôi cũng pha trà.' },
    { t: '💼', en: 'Would you like tea or coffee?', vi: 'Bạn muốn trà hay cà phê?' },
    { t: '🛠️', en: 'There is tea in the server room.', vi: 'Có trà trong phòng máy chủ.' }] },
  w459: { pat: 'eat rice · a bowl of rice · rice is (không đếm được)', ex: [
    { t: '🏠', en: 'We eat rice every day.', vi: 'Ngày nào chúng tôi cũng ăn cơm.' },
    { t: '💼', en: 'The canteen has rice and soup.', vi: 'Căng tin có cơm và canh.' },
    { t: '🛠️', en: 'This farm app counts rice fields.', vi: 'Ứng dụng nông nghiệp này đếm các thửa ruộng.' }] },
  w460: { pat: 'a piece of bread · a loaf of bread (không đếm được)', ex: [
    { t: '🏠', en: 'I buy bread every morning.', vi: 'Sáng nào tôi cũng mua bánh mì.' },
    { t: '💼', en: 'There is bread in the kitchen.', vi: 'Có bánh mì trong bếp.' },
    { t: '🛠️', en: 'I ate bread while the test ran.', vi: 'Tôi ăn bánh mì trong lúc bài kiểm thử chạy.' }] },
  w461: { pat: 'fresh fruit · a piece of fruit (thường không đếm được)', ex: [
    { t: '🏠', en: 'I eat fruit every day.', vi: 'Ngày nào tôi cũng ăn trái cây.' },
    { t: '💼', en: 'The office has free fruit.', vi: 'Văn phòng có trái cây miễn phí.' },
    { t: '🛠️', en: 'This app sells fruit online.', vi: 'Ứng dụng này bán trái cây trực tuyến.' }] },
  w462: { pat: 'một củ/quả là a vegetable, nhưng nói chung luôn dùng số nhiều: eat vegetables', ex: [
    { t: '🏠', en: 'I buy vegetables at the market.', vi: 'Tôi mua rau ở chợ.' },
    { t: '💼', en: 'The canteen has fresh vegetables.', vi: 'Căng tin có rau tươi.' },
    { t: '🛠️', en: 'The farm sends vegetable data every day.', vi: 'Nông trại gửi dữ liệu rau củ mỗi ngày.' }] },
  w463: { pat: 'on the street · in the street · street name', ex: [
    { t: '🏠', en: 'My house is on this street.', vi: 'Nhà tôi ở trên con phố này.' },
    { t: '💼', en: 'Our office is on the next street.', vi: 'Văn phòng chúng tôi ở phố kế bên.' },
    { t: '🛠️', en: 'Please check the street name in your address.', vi: 'Làm ơn kiểm tra tên phố trong địa chỉ của bạn.' }] },
  w464: { pat: 'by bus (không mạo từ) · take the bus · catch the bus', ex: [
    { t: '🏠', en: 'I go to the market by bus.', vi: 'Tôi đi chợ bằng xe buýt.' },
    { t: '💼', en: 'I take the bus to the office.', vi: 'Tôi bắt xe buýt đến văn phòng.' },
    { t: '🛠️', en: 'This app shows the next bus.', vi: 'Ứng dụng này hiện chuyến xe buýt kế tiếp.' }] },
  w465: { pat: 'by train · take the train · train station', ex: [
    { t: '🏠', en: 'We go to Hue by train.', vi: 'Chúng tôi đi Huế bằng tàu hoả.' },
    { t: '💼', en: 'I take the train to the client office.', vi: 'Tôi đi tàu đến văn phòng khách hàng.' },
    { t: '🛠️', en: 'The train app cannot find my ticket.', vi: 'Ứng dụng tàu hoả không tìm thấy vé của tôi.' }] },
  w466: { pat: 'at the airport · go to the airport · airport code', ex: [
    { t: '🏠', en: 'My flight leaves from this airport.', vi: 'Chuyến bay của tôi khởi hành từ sân bay này.' },
    { t: '💼', en: 'I will meet the client at the airport.', vi: 'Tôi sẽ gặp khách hàng ở sân bay.' },
    { t: '🛠️', en: 'The airport wifi is very slow.', vi: 'Wifi sân bay rất chậm.' }] },
  w467: { pat: 'buy a ticket · a ticket to/for · support ticket', ex: [
    { t: '🏠', en: 'I bought two tickets for the film.', vi: 'Tôi đã mua hai vé xem phim.' },
    { t: '💼', en: 'The company pays for my ticket.', vi: 'Công ty trả tiền vé cho tôi.' },
    { t: '🛠️', en: 'Please open a support ticket.', vi: 'Làm ơn mở một phiếu hỗ trợ.' }] },
  w468: { pat: 'stay at a hotel · book a hotel · hotel room', ex: [
    { t: '🏠', en: 'We stayed at a small hotel.', vi: 'Chúng tôi đã ở một khách sạn nhỏ.' },
    { t: '💼', en: 'Please book a hotel for the trip.', vi: 'Làm ơn đặt khách sạn cho chuyến đi.' },
    { t: '🛠️', en: 'The hotel wifi does not work.', vi: 'Wifi khách sạn không chạy.' }] },
  w469: { pat: 'go to hospital · in hospital · a hospital bed', ex: [
    { t: '🏠', en: 'My mother is in hospital.', vi: 'Mẹ tôi đang nằm viện.' },
    { t: '💼', en: 'I need a day off to go to the hospital.', vi: 'Tôi cần một ngày nghỉ để đi bệnh viện.' },
    { t: '🛠️', en: 'The hospital uses our software.', vi: 'Bệnh viện đó dùng phần mềm của chúng tôi.' }] },
  w470: { pat: 'go to the bank · a bank account · bank card', ex: [
    { t: '🏠', en: 'The bank is across the street.', vi: 'Ngân hàng ở bên kia đường.' },
    { t: '💼', en: 'The company pays into my bank account.', vi: 'Công ty trả vào tài khoản ngân hàng của tôi.' },
    { t: '🛠️', en: 'The bank card payment failed.', vi: 'Thanh toán bằng thẻ ngân hàng thất bại.' }] },
  w471: { pat: 'go to the shop · a coffee shop · shop online', ex: [
    { t: '🏠', en: 'The shop opens at eight.', vi: 'Cửa hàng mở cửa lúc tám giờ.' },
    { t: '💼', en: 'We opened a new shop in the city.', vi: 'Chúng tôi mở một cửa hàng mới trong thành phố.' },
    { t: '🛠️', en: 'The online shop is down right now.', vi: 'Cửa hàng trực tuyến hiện đang sập.' }] },
  w472: { pat: 'at a restaurant · book a restaurant · a good restaurant', ex: [
    { t: '🏠', en: 'This restaurant is very good.', vi: 'Nhà hàng này rất ngon.' },
    { t: '💼', en: 'We had lunch at a restaurant near the office.', vi: 'Chúng tôi ăn trưa ở một nhà hàng gần văn phòng.' },
    { t: '🛠️', en: 'Restaurants use this app for orders.', vi: 'Các nhà hàng dùng ứng dụng này để nhận đơn.' }] },
  w473: { pat: 'the price of · a high price · price list', ex: [
    { t: '🏠', en: 'The price of rice went up.', vi: 'Giá gạo đã tăng.' },
    { t: '💼', en: 'The price is too high for us.', vi: 'Giá quá cao với chúng tôi.' },
    { t: '🛠️', en: 'The app shows the wrong price.', vi: 'Ứng dụng hiện sai giá.' }] },
  w474: { pat: 'my address · email address · change the address', ex: [
    { t: '🏠', en: 'What is your address?', vi: 'Địa chỉ của bạn là gì?' },
    { t: '💼', en: 'Please send it to our office address.', vi: 'Làm ơn gửi đến địa chỉ văn phòng của chúng tôi.' },
    { t: '🛠️', en: 'Please check your email address.', vi: 'Làm ơn kiểm tra địa chỉ email của bạn.' }] },
  w475: { pat: 'on the phone · a phone call · answer the phone', ex: [
    { t: '🏠', en: 'My phone is very old.', vi: 'Điện thoại của tôi rất cũ.' },
    { t: '💼', en: 'He is on the phone with a customer.', vi: 'Anh ấy đang nói điện thoại với khách hàng.' },
    { t: '🛠️', en: 'The app crashes on my phone.', vi: 'Ứng dụng sập trên điện thoại của tôi.' }] },

  // ---------- Chặng 20 · đi làm & công nghệ ----------
  w476: { pat: 'send an email · an email to somebody · check my email', ex: [
    { t: '🏠', en: 'I send my sister an email every week.', vi: 'Tuần nào tôi cũng gửi email cho chị tôi.' },
    { t: '💼', en: 'I check my email in the morning.', vi: 'Tôi kiểm tra email vào buổi sáng.' },
    { t: '🛠️', en: 'The email did not arrive.', vi: 'Email đã không đến nơi.' }] },
  w477: { pat: 'have a meeting · a meeting with · join a meeting · meeting room', ex: [
    { t: '🏠', en: 'I have a meeting at my child school.', vi: 'Tôi có một buổi họp ở trường của con.' },
    { t: '💼', en: 'We have a meeting every Monday.', vi: 'Chúng tôi họp vào mỗi thứ Hai.' },
    { t: '🛠️', en: 'The meeting app does not open.', vi: 'Ứng dụng họp không mở được.' }] },
  w478: { pat: 'work on a project · a new project · project manager', ex: [
    { t: '🏠', en: 'I have a small project at home.', vi: 'Tôi có một dự án nhỏ ở nhà.' },
    { t: '💼', en: 'My team is working on a new project.', vi: 'Nhóm của tôi đang làm một dự án mới.' },
    { t: '🛠️', en: 'This project needs a new server.', vi: 'Dự án này cần một máy chủ mới.' }] },
  w479: { pat: 'meet a deadline · miss a deadline · the deadline is', ex: [
    { t: '🏠', en: 'I have a deadline for my English class.', vi: 'Tôi có hạn chót cho lớp tiếng Anh.' },
    { t: '💼', en: 'The deadline is next Friday.', vi: 'Hạn chót là thứ Sáu tuần sau.' },
    { t: '🛠️', en: 'We missed the deadline because of this bug.', vi: 'Chúng tôi trễ hạn vì lỗi này.' }] },
  w480: { pat: 'do a task · a small task · task list', ex: [
    { t: '🏠', en: 'Cleaning the house is a big task.', vi: 'Dọn nhà là một việc lớn.' },
    { t: '💼', en: 'I have three tasks for today.', vi: 'Hôm nay tôi có ba đầu việc.' },
    { t: '🛠️', en: 'This task runs every night.', vi: 'Tác vụ này chạy mỗi đêm.' }] },
  w481: { pat: 'my manager · a project manager · talk to the manager', ex: [
    { t: '🏠', en: 'My brother is a shop manager.', vi: 'Anh trai tôi là quản lý cửa hàng.' },
    { t: '💼', en: 'My manager is on leave this week.', vi: 'Quản lý của tôi nghỉ phép tuần này.' },
    { t: '🛠️', en: 'May I speak to your manager?', vi: 'Tôi nói chuyện với quản lý của bạn được không?' }] },
  w482: { pat: 'a customer · customer service · talk to a customer', ex: [
    { t: '🏠', en: 'The shop has many customers today.', vi: 'Hôm nay cửa hàng có nhiều khách.' },
    { t: '💼', en: 'This is an important customer.', vi: 'Đây là một khách hàng quan trọng.' },
    { t: '🛠️', en: 'The customer cannot log in.', vi: 'Khách hàng không đăng nhập được.' }] },
  w483: { pat: 'a user · user name · new users · user data', ex: [
    { t: '🏠', en: 'My father is a new user of this app.', vi: 'Bố tôi là người dùng mới của ứng dụng này.' },
    { t: '💼', en: 'We have two thousand users.', vi: 'Chúng tôi có hai nghìn người dùng.' },
    { t: '🛠️', en: 'Some users cannot open the page.', vi: 'Một số người dùng không mở được trang.' }] },
  w484: { pat: 'on my computer · a new computer · computer screen', ex: [
    { t: '🏠', en: 'My computer is very old.', vi: 'Máy tính của tôi rất cũ.' },
    { t: '💼', en: 'The company gave me a new computer.', vi: 'Công ty đã cấp cho tôi một máy tính mới.' },
    { t: '🛠️', en: 'The app does not work on my computer.', vi: 'Ứng dụng không chạy trên máy tính của tôi.' }] },
  w485: { pat: 'open a file · save a file · file name · a large file', ex: [
    { t: '🏠', en: 'I keep my photos in one file.', vi: 'Tôi giữ ảnh của mình trong một tệp.' },
    { t: '💼', en: 'Please send me the file.', vi: 'Làm ơn gửi tệp cho tôi.' },
    { t: '🛠️', en: 'The file is too big to upload.', vi: 'Tệp quá lớn để tải lên.' }] },
  w486: { pat: 'change your password · forget a password · a strong password', ex: [
    { t: '🏠', en: 'I wrote my password on paper.', vi: 'Tôi đã viết mật khẩu ra giấy.' },
    { t: '💼', en: 'Do not share your password with anyone.', vi: 'Đừng chia sẻ mật khẩu của bạn với ai.' },
    { t: '🛠️', en: 'He does not know the password.', vi: 'Anh ấy không biết mật khẩu.' }] },
  w487: { pat: 'create an account · a bank account · log in to your account', ex: [
    { t: '🏠', en: 'I opened a bank account yesterday.', vi: 'Hôm qua tôi đã mở một tài khoản ngân hàng.' },
    { t: '💼', en: 'Every employee has a company account.', vi: 'Mỗi nhân viên có một tài khoản công ty.' },
    { t: '🛠️', en: 'Your account is locked.', vi: 'Tài khoản của bạn bị khoá.' }] },
  w488: { pat: 'on the internet · internet connection · the internet (có THE)', ex: [
    { t: '🏠', en: 'The internet at home is slow.', vi: 'Internet ở nhà chậm.' },
    { t: '💼', en: 'We read the news on the internet.', vi: 'Chúng tôi đọc tin tức trên internet.' },
    { t: '🛠️', en: 'Please check your internet connection.', vi: 'Làm ơn kiểm tra kết nối internet của bạn.' }] },
  w489: { pat: 'visit a website · on our website · a slow website', ex: [
    { t: '🏠', en: 'I read this website every morning.', vi: 'Sáng nào tôi cũng đọc trang web này.' },
    { t: '💼', en: 'Our website has a new design.', vi: 'Trang web của chúng tôi có thiết kế mới.' },
    { t: '🛠️', en: 'The website is down right now.', vi: 'Trang web hiện đang sập.' }] },
  w490: { pat: 'send a message · get a message · an error message', ex: [
    { t: '🏠', en: 'I sent my mother a message.', vi: 'Tôi đã gửi mẹ tôi một tin nhắn.' },
    { t: '💼', en: 'Please leave a message for the manager.', vi: 'Làm ơn để lại lời nhắn cho quản lý.' },
    { t: '🛠️', en: 'What does the error message say?', vi: 'Thông báo lỗi nói gì?' }] },
  w491: { pat: 'update the app · an update · keep me updated', ex: [
    { t: '🏠', en: 'My phone is updating now.', vi: 'Điện thoại của tôi đang cập nhật.' },
    { t: '💼', en: 'Please keep me updated.', vi: 'Làm ơn cập nhật cho tôi liên tục.' },
    { t: '🛠️', en: 'The update broke the login page.', vi: 'Bản cập nhật làm hỏng trang đăng nhập.' }] },
  w492: { pat: 'data là KHÔNG đếm được: much data, KHÔNG có datas', ex: [
    { t: '🏠', en: 'I lost all my photo data.', vi: 'Tôi mất hết dữ liệu ảnh của mình.' },
    { t: '💼', en: 'We are checking the sales data.', vi: 'Chúng tôi đang kiểm tra dữ liệu bán hàng.' },
    { t: '🛠️', en: 'The data is still missing.', vi: 'Dữ liệu vẫn còn thiếu.' }] },
  w493: { pat: 'write code · a line of code · the old code · code review', ex: [
    { t: '🏠', en: 'My son is learning to write code.', vi: 'Con trai tôi đang học viết mã.' },
    { t: '💼', en: 'Please review my code today.', vi: 'Làm ơn xem lại mã của tôi hôm nay.' },
    { t: '🛠️', en: 'The bug is in the old code.', vi: 'Lỗi nằm ở phần mã cũ.' }] },
  w494: { pat: 'take a test · pass a test · test something · run a test', ex: [
    { t: '🏠', en: 'My daughter has a test tomorrow.', vi: 'Ngày mai con gái tôi có bài kiểm tra.' },
    { t: '💼', en: 'Please test the new plan first.', vi: 'Làm ơn thử nghiệm kế hoạch mới trước.' },
    { t: '🛠️', en: 'All the tests passed this morning.', vi: 'Sáng nay tất cả bài kiểm thử đều đạt.' }] },
  w495: { pat: 'get an error · an error message · fix an error', ex: [
    { t: '🏠', en: 'I made an error on the form.', vi: 'Tôi đã điền sai trên tờ khai.' },
    { t: '💼', en: 'There is an error in the report.', vi: 'Có một lỗi trong bản báo cáo.' },
    { t: '🛠️', en: 'I get an error when I click save.', vi: 'Tôi gặp lỗi khi bấm lưu.' }] },
  w496: { pat: 'on the screen · a black screen · screen size', ex: [
    { t: '🏠', en: 'My phone screen is broken.', vi: 'Màn hình điện thoại của tôi bị vỡ.' },
    { t: '💼', en: 'Please share your screen.', vi: 'Làm ơn chia sẻ màn hình của bạn.' },
    { t: '🛠️', en: 'The screen is black after the update.', vi: 'Màn hình đen sau bản cập nhật.' }] },
  w497: { pat: 'click on · click the button · double click', ex: [
    { t: '🏠', en: 'Click here to see the photos.', vi: 'Bấm vào đây để xem ảnh.' },
    { t: '💼', en: 'Click on the link in my email.', vi: 'Bấm vào đường dẫn trong email của tôi.' },
    { t: '🛠️', en: 'Nothing happens when I click save.', vi: 'Chẳng có gì xảy ra khi tôi bấm lưu.' }] },
  w498: { pat: 'download a file · download from · a slow download', ex: [
    { t: '🏠', en: 'I download films at night.', vi: 'Tôi tải phim vào ban đêm.' },
    { t: '💼', en: 'Please download the report first.', vi: 'Làm ơn tải bản báo cáo về trước.' },
    { t: '🛠️', en: 'The download stops at fifty percent.', vi: 'Việc tải xuống dừng ở năm mươi phần trăm.' }] },
  w499: { pat: 'save a file · save money · save time · save your work', ex: [
    { t: '🏠', en: 'I save money every month.', vi: 'Tháng nào tôi cũng để dành tiền.' },
    { t: '💼', en: 'This tool saves us a lot of time.', vi: 'Công cụ này tiết kiệm cho chúng tôi rất nhiều thời gian.' },
    { t: '🛠️', en: 'Please save your work before you close it.', vi: 'Làm ơn lưu bài của bạn trước khi đóng.' }] },
  w500: { pat: 'share something with somebody · share a file · share a room', ex: [
    { t: '🏠', en: 'I share a room with my brother.', vi: 'Tôi ở chung phòng với anh trai.' },
    { t: '💼', en: 'Please share the file with the team.', vi: 'Làm ơn chia sẻ tệp với cả nhóm.' },
    { t: '🛠️', en: 'Do not share your password with anyone.', vi: 'Đừng chia sẻ mật khẩu của bạn với ai.' }] },
};
