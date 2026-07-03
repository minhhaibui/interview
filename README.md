# 🚀 Lộ trình ôn tập phỏng vấn Backend — Node.js + Redis + Kafka + AWS + Docker + K8s + Database

> Lộ trình 12 tuần, từ cơ bản đến nâng cao, kèm bài tập thực hành và bài test cuối tuần.
> Mục tiêu: pass phỏng vấn vị trí **Backend Engineer (Node.js)** từ Middle → Senior.

> 🗺️ **Chưa biết bắt đầu từ đâu? Đọc [`LO-TRINH-HOC.md`](LO-TRINH-HOC.md) TRƯỚC** — lộ trình học hiệu quả nhất: học gì trước/sau, trong mỗi tuần làm theo thứ tự nào, ghép tiếng Anh ra sao, và chiến lược "học 2 lượt" cho người mới.

## 💻 Study Web — học qua giao diện web

```bash
node study-web/server.js
# → mở http://localhost:4321
```

Không cần `npm install` (server viết bằng Node.js core — chính nó là code mẫu cho Tuần 1-2). Tính năng:
- **📚 Tài liệu**: đọc toàn bộ lộ trình với sidebar điều hướng, syntax highlight, link nội bộ, 🔍 tìm kiếm toàn văn
- **🧪 Quiz tự chấm**: vào trang có quiz → bật chế độ quiz → làm bài, chấm từng câu, lưu điểm
- **🃏 Flashcards**: từ vựng tiếng Anh kỹ thuật theo tuần, lật thẻ, SRS có lịch ôn thật (box 1/2/3 → ôn lại sau 1/3/7 ngày), bộ lọc 📬 đến hạn hôm nay và 🔥 từ cứng đầu (sai ≥3 lần)
- **✍️ Luyện viết**: gõ từ mới theo nghĩa tiếng Việt, điền từ vào câu ví dụ thật, nghe (TTS) & gõ lại câu mẫu + câu hỏi phỏng vấn, 🎤 đọc to để máy nghe và chấm phát âm (Speech Recognition, cần Chrome/Edge) — diff từng từ, chuỗi 🔥 streak, chia sẻ SRS với Flashcards
- **🎯 Mock Interview**: bốc ngẫu nhiên từ kho 180 câu Q&A của 12 tuần, đếm giờ từng câu, xem đáp án và tự chấm, lưu lịch sử điểm
- **📊 Tiến độ**: checklist từng tuần, banner từ đến hạn ôn, heatmap hoạt động kiểu GitHub + chuỗi ngày học, lịch sử quiz & mock, 📤📥 xuất/nhập backup toàn bộ dữ liệu học

## 📅 Tổng quan lộ trình

| Tuần | Chủ đề | Thư mục | Trọng tâm |
|------|--------|---------|-----------|
| 1 | Node.js Core | [week-01-nodejs-core](./week-01-nodejs-core/README.md) | Event loop, async, streams, modules |
| 2 | Node.js Advanced | [week-02-nodejs-advanced](./week-02-nodejs-advanced/README.md) | Cluster, worker threads, performance, security |
| 3 | SQL Database | [week-03-sql-database](./week-03-sql-database/README.md) | PostgreSQL/MySQL, index, transaction, tối ưu query |
| 4 | NoSQL & Database Design | [week-04-nosql-database-design](./week-04-nosql-database-design/README.md) | MongoDB, replication, sharding, thiết kế schema |
| 5 | Redis | [week-05-redis](./week-05-redis/README.md) | Caching patterns, data structures, distributed lock |
| 6 | Kafka | [week-06-kafka](./week-06-kafka/README.md) | Partition, consumer group, exactly-once, DLQ |
| 7 | Docker | [week-07-docker](./week-07-docker/README.md) | Image, multi-stage build, compose, networking |
| 8 | Kubernetes | [week-08-kubernetes](./week-08-kubernetes/README.md) | Pod, Deployment, Service, HPA, ConfigMap/Secret |
| 9 | AWS | [week-09-aws](./week-09-aws/README.md) | EC2, S3, RDS, Lambda, SQS/SNS, IAM, VPC, ECS/EKS |
| 10 | System Design | [week-10-system-design](./week-10-system-design/README.md) | Scalability, CAP, load balancing, microservices |
| 11 | Capstone Project | [week-11-capstone](./week-11-capstone/README.md) | Xây dựng hệ thống tích hợp toàn bộ kiến thức |
| 12 | Mock Interview | [week-12-mock-interview](./week-12-mock-interview/README.md) | Tổng ôn, mock interview, behavioral questions |

## 🎯 Capstone Project

**Hệ thống xử lý đơn hàng e-commerce (microservices)** — tích hợp toàn bộ stack:
Node.js services + PostgreSQL + MongoDB + Redis cache + Kafka event streaming + Docker + Kubernetes + deploy AWS.

👉 Xem chi tiết spec tại [capstone-project/README.md](./capstone-project/README.md).
Làm dần theo **5 Upgrade** sau mỗi tuần tương ứng ([bắt đầu ở đây](./capstone-project/GETTING-STARTED.md)):
Postgres (tuần 3) → Redis (5) → Kafka (6) → Docker/K8s (7-8) → AWS SQS+S3 (9) —
mỗi guide có checklist nghiệm thu, tick theo dõi được ở tab 📅 Kế hoạch của study-web.

## 🏗️ Thiết kế hệ thống & Case thực tế theo từng tuần

Mỗi tuần 1-9 có thêm file **`DESIGN-CASES.md`** trong thư mục tuần đó, gồm:
- **3-4 bài mini system design** scoped đúng chủ đề tuần (đề bài có con số cụ thể, lời giải từng bước, trade-offs, follow-up questions)
- **2-3 case thực tế** (sự cố/quyết định kiến trúc trong dự án thật, kèm mục "cách dùng case này khi phỏng vấn")
- **Checklist tự kiểm tra** cuối file

Học sau khi xong phần lý thuyết của tuần, trước khi làm bài test.

## 🧩 System Design Scenarios (bổ trợ tuần 10 & 12)

Bộ tình huống thực tế nhà tuyển dụng hay hỏi, lời giải chi tiết từng bước:

| File | Nội dung |
|------|----------|
| [01-classic-designs-part1.md](./system-design-scenarios/01-classic-designs-part1.md) | News Feed, Chat App, Flash Sale/Ticketing, Autocomplete, Video Streaming |
| [02-classic-designs-part2.md](./system-design-scenarios/02-classic-designs-part2.md) | Payment System, File Storage (Dropbox), Job Scheduler, Leaderboard, Proximity Service + bảng chọn công nghệ nhanh |
| [03-real-world-incidents.md](./system-design-scenarios/03-real-world-incidents.md) | 15 tình huống sự cố production ("Nếu gặp X bạn xử lý thế nào?") + framework trả lời 4 bước |

## 🏗️ Design Patterns (bổ trợ tuần 2 & 10)

GoF patterns + architectural patterns, tất cả triển khai bằng TypeScript/Node.js với use case thực tế:

| File | Nội dung |
|------|----------|
| [01-creational-patterns.md](./design-patterns/01-creational-patterns.md) | Singleton, Factory, Abstract Factory, Builder, Prototype |
| [02-structural-patterns.md](./design-patterns/02-structural-patterns.md) | Adapter, Decorator, Proxy, Facade, Composite, Bridge, Flyweight + đố nhận diện pattern trong code thư viện thật |
| [03-behavioral-patterns.md](./design-patterns/03-behavioral-patterns.md) | Observer/Pub-Sub, Strategy, Command, Chain of Responsibility, Template Method, State, Iterator/Generator, Mediator |
| [04-architectural-backend-patterns.md](./design-patterns/04-architectural-backend-patterns.md) | DI/IoC, Repository/UoW, CQRS, Event Sourcing, Saga, Outbox, Resilience (circuit breaker/retry/bulkhead), API Gateway/BFF, Strangler Fig, Idempotency — **nhóm hỏi nhiều nhất với senior** |

## 🇬🇧 English Track — học song song 30-45 phút/ngày

Tiếng Anh chuyên cho dev: đọc docs, phỏng vấn và giao tiếp công việc. Từ vựng học theo đúng chủ đề kỹ thuật từng tuần (tuần 5 ôn Redis thì học vocab Redis):

| File | Nội dung |
|------|----------|
| [english/README.md](./english/README.md) | Lộ trình 12 tuần song song, daily routine, cách đo tiến bộ |
| [01-technical-vocabulary.md](./english/01-technical-vocabulary.md) | ~25 từ/tuần theo chủ đề kỹ thuật, IPA, lưu ý phát âm, hướng dẫn Anki |
| [02-reading-technical-docs.md](./english/02-reading-technical-docs.md) | Ngữ pháp trong docs, chiến thuật đọc, 8 bài đọc thực hành |
| [03-listening-speaking.md](./english/03-listening-speaking.md) | Nguồn nghe theo trình độ, shadowing, 12 đề nói 2 phút, sửa phát âm |
| [04-interview-english.md](./english/04-interview-english.md) | Self-intro, trả lời kỹ thuật, kể về capstone project, cụm câu cứu nguy |
| [05-workplace-communication.md](./english/05-workplace-communication.md) | Standup, code review, commit/PR/Slack, meeting, email, small talk |

## 📖 Cách sử dụng lộ trình

1. **Mỗi tuần học theo thứ tự**: Lý thuyết → Câu hỏi phỏng vấn → Bài tập → Bài test cuối tuần.
2. **Thời gian gợi ý**: 2–3h/ngày, 6 ngày/tuần (~15h/tuần).
3. **Điều kiện pass tuần** (ghi rõ trong từng tuần):
   - Quiz cuối tuần đạt **≥ 80%** (12/15 câu).
   - Hoàn thành **tất cả bài tập bắt buộc** và bài thực hành chấm điểm.
   - Trả lời trôi chảy (nói thành tiếng!) các câu hỏi phỏng vấn của tuần đó.
4. **Không pass thì không sang tuần mới** — ôn lại phần yếu rồi test lại.
5. Tuần 11 dùng [capstone-project](./capstone-project/README.md) làm bài tập lớn — đây cũng là project để đưa vào CV.

## ✅ Quy tắc vàng khi ôn phỏng vấn

- **Nói thành tiếng** câu trả lời, đừng chỉ đọc hiểu — phỏng vấn là kỹ năng nói.
- Mỗi khái niệm phải trả lời được 3 câu: **Nó là gì? Tại sao dùng? Trade-off là gì?**
- Code bài tập thật, đừng chỉ đọc solution.
- Cuối mỗi tuần, viết tóm tắt 1 trang những gì đã học (active recall).
