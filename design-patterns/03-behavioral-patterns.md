# Design Patterns — Phần 3: Behavioral Patterns (Nhóm hành vi)

> Behavioral patterns trả lời câu hỏi: **các object giao tiếp và phân chia trách nhiệm với nhau như thế nào?** Trong Node.js, đây là nhóm pattern "thực chiến" nhất — bạn đang dùng chúng hàng ngày mà có thể không gọi tên: Express middleware là Chain of Responsibility, EventEmitter là Observer, BullMQ job là Command, passport strategy là Strategy. Phỏng vấn senior rất hay xoáy vào việc **nhận diện pattern trong code thật** chứ không phải thuộc lòng định nghĩa GoF.

---

## 1. Observer / Pub-Sub

### Vấn đề nó giải quyết

Tình huống kinh điển: khi user đăng ký tài khoản, bạn cần (1) gửi email welcome, (2) tạo bản ghi analytics, (3) đẩy thông báo cho team sales, (4) khởi tạo free trial. Cách viết naive:

```ts
async function registerUser(dto: RegisterDto) {
  const user = await userRepo.create(dto);
  await emailService.sendWelcome(user);      // coupling 1
  await analyticsService.track(user);        // coupling 2
  await salesNotifier.notify(user);          // coupling 3
  await trialService.start(user);            // coupling 4
  return user;
}
```

`registerUser` giờ biết quá nhiều: nó phải import 4 service, mỗi lần thêm side-effect mới phải sửa hàm này (vi phạm Open/Closed), và nếu `analyticsService` lỗi thì cả flow đăng ký fail theo. Observer pattern đảo ngược sự phụ thuộc: **người phát sự kiện không cần biết ai đang nghe**.

### Cách triển khai trong Node.js/TypeScript

Node.js có sẵn Observer trong core: `EventEmitter`. Bản typed hiện đại:

```ts
import { EventEmitter } from 'node:events';

// ----- 1. Định nghĩa contract cho events (type-safe) -----
interface User {
  id: string;
  email: string;
  name: string;
}

interface DomainEvents {
  'user.created': [user: User];
  'user.deleted': [userId: string];
  'order.paid': [orderId: string, amount: number];
}

// Node >= 19 hỗ trợ generic EventEmitter<T> — events sai tên/sai payload sẽ bị TS bắt
class DomainEventBus extends EventEmitter<DomainEvents> {}

export const eventBus = new DomainEventBus();

// ----- 2. Publisher: chỉ phát sự kiện, không biết ai nghe -----
async function registerUser(dto: { email: string; name: string }): Promise<User> {
  const user: User = { id: crypto.randomUUID(), ...dto };
  // ... lưu DB ...
  eventBus.emit('user.created', user); // fire-and-forget
  return user;
}

// ----- 3. Subscribers: mỗi module tự đăng ký, độc lập với nhau -----
// modules/email/listeners.ts
eventBus.on('user.created', async (user) => {
  try {
    await sendWelcomeEmail(user.email);
  } catch (err) {
    // QUAN TRỌNG: tự catch — lỗi trong listener async không được EventEmitter xử lý
    logger.error({ err, userId: user.id }, 'send welcome email failed');
  }
});

// modules/analytics/listeners.ts
eventBus.on('user.created', (user) => analytics.track('signup', { userId: user.id }));

// Listener chỉ chạy 1 lần
eventBus.once('user.created', (user) => console.log('First user ever:', user.id));

declare function sendWelcomeEmail(email: string): Promise<void>;
declare const logger: { error: (obj: object, msg: string) => void };
declare const analytics: { track: (e: string, p: object) => void };
```

**Ba pitfall của EventEmitter mà interviewer rất thích hỏi:**

```ts
// PITFALL 1: Memory leak listener
// Nếu bạn .on() bên trong request handler, mỗi request thêm 1 listener mới
app.get('/orders', (req, res) => {
  eventBus.on('order.paid', handler); // LEAK! Listener tích lũy vô hạn
});
// Node cảnh báo "MaxListenersExceededWarning" khi > 10 listeners.
// Fix: đăng ký listener 1 lần lúc bootstrap, hoặc dùng .once(), hoặc .off() khi xong.

// PITFALL 2: 'error' event đặc biệt
// emit('error') mà KHÔNG có listener nào => Node THROW và crash process
emitter.emit('error', new Error('boom')); // Uncaught exception nếu chưa .on('error')
// Luôn có: emitter.on('error', (err) => logger.error(err));

// PITFALL 3: emit() là SYNCHRONOUS
// Tất cả listener chạy đồng bộ, tuần tự, ngay tại dòng emit().
// Listener nặng CPU sẽ block luôn publisher. Listener async thì promise bị "trôi"
// (unhandled rejection nếu không tự catch). Muốn async thật sự:
eventBus.on('user.created', (user) => {
  setImmediate(() => doHeavyWork(user)); // đẩy sang tick sau
});
declare function doHeavyWork(u: User): void;
declare const emitter: EventEmitter;
declare const app: any;
declare function handler(): void;
```

**Observer vs Pub/Sub — phân biệt chuẩn khi phỏng vấn:**

| | Observer | Pub/Sub |
|---|---|---|
| Kết nối | Subject giữ danh sách observer trực tiếp | Có **broker trung gian** (channel/topic) |
| Coupling | Subject biết interface của observer | Publisher và subscriber hoàn toàn không biết nhau |
| Phạm vi | Trong cùng process | Có thể cross-process / cross-service |
| Ví dụ | `EventEmitter`, RxJS Subject | Redis Pub/Sub, Kafka, RabbitMQ, NATS |

`EventEmitter` về bản chất là **observer** (emitter giữ trực tiếp mảng listener). Khi bạn cần sự kiện vượt ra ngoài 1 process (nhiều instance sau load balancer, microservices), bạn nâng cấp lên **distributed pub/sub**:

```ts
// Pub/Sub distributed với Redis — cùng ý tưởng, khác transport
import { createClient } from 'redis';

const pub = createClient();
const sub = pub.duplicate(); // Redis: connection đang subscribe không publish được
await Promise.all([pub.connect(), sub.connect()]);

// Service A (publisher) — không biết gì về subscriber
await pub.publish('user.created', JSON.stringify({ id: 'u1', email: 'a@b.c' }));

// Service B (subscriber) — có thể ở máy khác, ngôn ngữ khác
await sub.subscribe('user.created', (message) => {
  const user = JSON.parse(message);
  console.log('received in another process:', user);
});
// Lưu ý: Redis Pub/Sub là fire-and-forget (subscriber offline = mất message).
// Cần durability thì dùng Redis Streams / Kafka.
```

### Use case thực tế trong backend

- **Node.js core dùng khắp nơi**: `http.Server` (`request`, `close`), `Stream` (`data`, `end`, `error`), `process` (`uncaughtException`, `SIGTERM`) — tất cả đều extend `EventEmitter`.
- **Domain events trong monolith**: NestJS có `@nestjs/event-emitter` (`@OnEvent('user.created')`) để decouple module — order module phát `order.paid`, inventory module tự nghe để trừ kho.
- **Mongoose/TypeORM hooks**: `schema.post('save', ...)` chính là observer trên lifecycle của document.
- **Socket.IO**: server emit event tới các client đang subscribe room — pub/sub qua WebSocket.

### Biến thể & cách triển khai khác

- **`EventTarget`** (chuẩn WHATWG, có trong Node 15+): API giống browser (`addEventListener`), thay thế dần EventEmitter cho code isomorphic.
- **RxJS Observable**: observer + toán tử stream (debounce, retry, merge) — mạnh khi cần compose event phức tạp, nhưng learning curve cao.
- **Typed event bus tự viết** với `Map<string, Set<Handler>>` khi muốn kiểm soát hoàn toàn (async handler, error isolation, middleware cho event).
- **Transactional Outbox**: biến thể production-grade của domain event — ghi event vào DB cùng transaction với business data, worker đọc và publish sau, tránh mất event khi crash giữa chừng.

### ⚠️ Khi nào KHÔNG nên dùng / anti-pattern

- **Flow nghiệp vụ chính** không nên giấu trong event: nếu "tạo order PHẢI trừ kho, fail thì rollback" — đó là transaction, dùng lời gọi tường minh, không emit event rồi cầu nguyện.
- **Event chaining hell**: listener của event A lại emit event B, B emit C... debug như mò kim đáy bể, không trace được flow. Quá 2 tầng event là red flag.
- **Dựa vào thứ tự listener**: EventEmitter chạy theo thứ tự đăng ký, nhưng code phụ thuộc vào điều đó là implicit coupling — refactor là vỡ.
- Cần **delivery guarantee** (at-least-once, retry, DLQ) thì in-memory EventEmitter không đủ — process restart là mất hết, phải dùng message queue.

### 💬 Câu hỏi phỏng vấn liên quan

**Q: EventEmitter có phải pub/sub không?**
A: Về tinh thần thì giống (loose coupling qua event), nhưng chính xác là Observer: emitter giữ trực tiếp danh sách listener, không có broker, chỉ hoạt động trong 1 process, và `emit()` chạy đồng bộ. Pub/sub đúng nghĩa có broker trung gian (Redis, Kafka) và publisher/subscriber tách rời hoàn toàn về process lẫn thời gian.

**Q: Listener async throw error thì chuyện gì xảy ra?**
A: `emit()` không await listener, nên rejected promise trở thành unhandled rejection — Node mặc định sẽ crash process (từ Node 15). Phải tự try/catch trong listener, hoặc dùng wrapper bus có error handling, hoặc `events.captureRejections = true` kết hợp `[Symbol.for('nodejs.rejection')]`.

**Q: Vì sao Node cảnh báo MaxListenersExceededWarning, fix thế nào?**
A: Mặc định 1 emitter cho phép 10 listener/event để phát hiện leak (thường do `.on()` trong request handler hoặc loop). Fix đúng là tìm chỗ đăng ký lặp và chuyển ra bootstrap hoặc dùng `.once()`/`.off()`. `setMaxListeners(0)` chỉ tắt cảnh báo, không fix leak.

---

## 2. Strategy

### Vấn đề nó giải quyết

Hàm tính giá có 3 loại khách hàng, viết if/else:

```ts
function calcPrice(order: Order, customerType: string) {
  if (customerType === 'normal') return order.total;
  else if (customerType === 'sale') return order.total * 0.9;
  else if (customerType === 'vip') return Math.max(order.total * 0.8 - 50_000, 0);
  // 3 tháng sau: 'partner', 'flash-sale', 'employee'... hàm phình vô hạn
}
```

Mỗi nghiệp vụ mới = sửa hàm cũ = risk regression + merge conflict. Strategy tách **mỗi thuật toán thành một đơn vị hoán đổi được lúc runtime**, code gọi chỉ biết interface chung.

### Cách triển khai trong Node.js/TypeScript

Trong JS, function là first-class citizen nên **một map của functions** thường là đủ — so sánh trực tiếp 2 cách:

```ts
interface Order {
  total: number;
  items: number;
  region: 'urban' | 'suburban' | 'remote';
}

// ============ Cách 1: Class-based (kiểu GoF truyền thống) ============
// Dùng khi strategy CÓ STATE hoặc cần dependency injection
interface PricingStrategy {
  calculate(order: Order): number;
}

class NormalPricing implements PricingStrategy {
  calculate(order: Order) { return order.total; }
}

class SalePricing implements PricingStrategy {
  constructor(private discountRate: number) {} // strategy có config riêng
  calculate(order: Order) { return order.total * (1 - this.discountRate); }
}

class VipPricing implements PricingStrategy {
  constructor(private loyaltyService: { getBonus(): number }) {} // có dependency
  calculate(order: Order) {
    return Math.max(order.total * 0.8 - this.loyaltyService.getBonus(), 0);
  }
}

class Checkout {
  constructor(private strategy: PricingStrategy) {}
  setStrategy(s: PricingStrategy) { this.strategy = s; } // hoán đổi runtime
  pay(order: Order) { return this.strategy.calculate(order); }
}

// ============ Cách 2: Function map (idiomatic JS) ============
// 90% trường hợp trong Node.js chỉ cần thế này
type CustomerType = 'normal' | 'sale' | 'vip';

const pricingStrategies: Record<CustomerType, (order: Order) => number> = {
  normal: (o) => o.total,
  sale:   (o) => o.total * 0.9,
  vip:    (o) => Math.max(o.total * 0.8 - 50_000, 0),
};

function calcPrice(order: Order, type: CustomerType): number {
  const strategy = pricingStrategies[type];
  if (!strategy) throw new Error(`Unknown customer type: ${type}`); // fail fast
  return strategy(order);
}

// Thêm loại khách mới = thêm 1 entry, KHÔNG sửa calcPrice (Open/Closed đạt được)

// ============ Ví dụ 2: Shipping fee theo vùng ============
const shippingStrategies: Record<Order['region'], (o: Order) => number> = {
  urban:    (o) => (o.total > 500_000 ? 0 : 20_000),
  suburban: (o) => 35_000 + o.items * 2_000,
  remote:   (o) => 60_000 + o.items * 5_000,
};

// ============ Ví dụ 3: Retry strategy (strategy trả về behavior) ============
type BackoffStrategy = (attempt: number) => number; // ms cần chờ

const backoffs: Record<string, BackoffStrategy> = {
  fixed:       () => 1_000,
  linear:      (n) => n * 1_000,
  exponential: (n) => Math.min(2 ** n * 1_000, 30_000),
  // jitter tránh thundering herd khi nhiều client retry cùng lúc
  exponentialJitter: (n) => Math.random() * Math.min(2 ** n * 1_000, 30_000),
};

async function withRetry<T>(
  fn: () => Promise<T>,
  { retries = 3, backoff = backoffs.exponentialJitter }: { retries?: number; backoff?: BackoffStrategy } = {},
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, backoff(attempt)));
    }
  }
}
```

**Khi nào chọn class, khi nào chọn function map?**
- Function map: strategy là pure computation, không state, không dependency → ngắn gọn, dễ test.
- Class: strategy cần inject dependency (DB, API client), giữ state nội bộ, hoặc dùng trong framework DI như NestJS.

### Use case thực tế trong backend

- **Passport.js** — ví dụ Strategy nổi tiếng nhất hệ sinh thái Node: `passport.use(new LocalStrategy(...))`, `new JwtStrategy(...)`, `new GoogleStrategy(...)`. Mỗi cách authenticate là 1 strategy cùng interface, route handler chỉ gọi `passport.authenticate('jwt')` mà không biết chi tiết.
- **multer storage engines**: `diskStorage` vs `memoryStorage` vs `multer-s3` — hoán đổi nơi lưu file upload.
- **Payment gateway**: cùng interface `charge(amount)`, runtime chọn Stripe/PayPal/Momo/VNPay theo lựa chọn user hoặc theo quốc gia.
- **express-rate-limit stores**: memory store vs Redis store — strategy cho việc đếm request.

### Biến thể & cách triển khai khác

- **Strategy registry + plugin**: cho phép đăng ký strategy động (`registry.register('momo', momoStrategy)`) — nền tảng của kiến trúc plugin (webpack loaders về tinh thần cũng vậy).
- **Strategy chọn theo config/feature flag**: đọc từ env hoặc LaunchDarkly để A/B test 2 thuật toán pricing.
- **Default + override**: `{ ...defaultStrategies, ...customStrategies }`.
- Strategy chỉ có **một method và không state** thì chính là... một function. Đừng tạo class `IStrategy` cho nó.

### ⚠️ Khi nào KHÔNG nên dùng / anti-pattern

- Chỉ có **2 nhánh và sẽ mãi là 2 nhánh** → if/else là đủ, đừng over-engineer.
- **Strategy biết về nhau** hoặc client phải biết chi tiết từng strategy để chọn → leaky abstraction, mất hết lợi ích.
- Các "strategy" thực chất **khác nhau cả về input/output** → đó không phải strategy, đừng ép chung interface rồi nhét `options: any`.
- Anti-pattern phổ biến: tạo `StrategyFactory` + `AbstractStrategy` + `StrategyContext` cho thứ mà 1 object literal 5 dòng giải quyết được — "Java in JavaScript".

### 💬 Câu hỏi phỏng vấn liên quan

**Q: Strategy khác gì State pattern? Code nhìn giống hệt nhau.**
A: Cấu trúc giống nhau (context delegate sang object hoán đổi được) nhưng intent khác: Strategy do **client chọn** và các strategy độc lập, không biết nhau; State do **chính object tự chuyển** giữa các state, và state này biết state kế tiếp là gì (transition).

**Q: Trong JS có cần class cho Strategy không?**
A: Thường không — function map là idiomatic và đủ cho strategy stateless. Dùng class khi strategy cần dependency injection, giữ state, hoặc framework yêu cầu (NestJS provider, Passport strategy đều là class vì cần config + lifecycle).

**Q: Passport.js dùng Strategy thế nào?**
A: Mỗi cơ chế auth (local, JWT, OAuth Google...) là 1 class strategy có chung contract `authenticate(req)` và callback `verify`. App đăng ký strategy bằng `passport.use()` vào một registry, middleware `passport.authenticate('ten-strategy')` lookup và delegate — thêm cách login mới không đụng vào route code.

---

## 3. Command

### Vấn đề nó giải quyết

Bạn muốn làm những việc sau với một "hành động":
- **Hoãn thực thi** (đẩy vào queue, chạy bởi worker khác, lúc khác)
- **Retry / log / audit** hành động đó
- **Undo** hành động đó
- Tách nơi **phát sinh yêu cầu** khỏi nơi **thực thi**

Một function call thì "bốc hơi" ngay khi gọi — không serialize được, không lưu được, không gửi qua mạng được. Command pattern **đóng gói request thành một object dữ liệu** (`{ type, payload }`), nhờ đó hành động trở thành thứ có thể lưu, xếp hàng, gửi đi, phát lại.

### Cách triển khai trong Node.js/TypeScript

```ts
// ============ 1. Command cơ bản: action trở thành data ============
interface Command<TPayload = unknown> {
  readonly type: string;
  readonly payload: TPayload;
  readonly metadata: { id: string; issuedAt: Date; userId?: string };
}

function createCommand<T>(type: string, payload: T, userId?: string): Command<T> {
  return {
    type,
    payload,
    metadata: { id: crypto.randomUUID(), issuedAt: new Date(), userId },
  };
}

// ============ 2. Handler tách khỏi command (CQRS style) ============
interface CommandHandler<C extends Command> {
  execute(command: C): Promise<void>;
}

type CreateOrderCmd = Command<{ customerId: string; items: { sku: string; qty: number }[] }>;

class CreateOrderHandler implements CommandHandler<CreateOrderCmd> {
  constructor(
    private orderRepo: { save(o: object): Promise<void> },
    private inventory: { reserve(items: object[]): Promise<void> },
  ) {}

  async execute(cmd: CreateOrderCmd): Promise<void> {
    await this.inventory.reserve(cmd.payload.items);
    await this.orderRepo.save({ id: cmd.metadata.id, ...cmd.payload, status: 'pending' });
  }
}

// ============ 3. Command Bus: route command -> handler ============
class CommandBus {
  private handlers = new Map<string, CommandHandler<any>>();

  register(type: string, handler: CommandHandler<any>) {
    if (this.handlers.has(type)) throw new Error(`Duplicate handler for ${type}`);
    this.handlers.set(type, handler);
  }

  async dispatch(cmd: Command): Promise<void> {
    const handler = this.handlers.get(cmd.type);
    if (!handler) throw new Error(`No handler for ${cmd.type}`);
    // Cross-cutting concerns ở 1 chỗ duy nhất: logging, metrics, tracing, auth
    console.log(`[cmd] ${cmd.type} (${cmd.metadata.id})`);
    await handler.execute(cmd);
  }
}

// ============ 4. Command + Queue = xử lý async (chính là BullMQ) ============
// Command là object thuần data => serialize JSON => gửi qua Redis cho worker
import { Queue, Worker } from 'bullmq';

const orderQueue = new Queue('orders', { connection: { host: 'localhost', port: 6379 } });

// API process: chỉ ENQUEUE command rồi trả response ngay (202 Accepted)
async function enqueueCreateOrder(payload: CreateOrderCmd['payload']) {
  // job.name = command type, job.data = command payload — BullMQ job CHÍNH LÀ command object
  await orderQueue.add('create-order', payload, {
    attempts: 3,                                        // retry — có được vì command là data
    backoff: { type: 'exponential', delay: 1_000 },
  });
}

// Worker process (máy khác, scale riêng): nhận command và execute
const worker = new Worker('orders', async (job) => {
  switch (job.name) {
    case 'create-order':
      await new CreateOrderHandler(orderRepo, inventory)
        .execute(createCommand('create-order', job.data));
      break;
  }
}, { connection: { host: 'localhost', port: 6379 } });

// ============ 5. Undo/Redo: command kèm thao tác đảo ngược ============
interface UndoableCommand {
  execute(): Promise<void>;
  undo(): Promise<void>;
}

class AdjustStockCommand implements UndoableCommand {
  constructor(private db: { incr(sku: string, n: number): Promise<void> },
              private sku: string, private delta: number) {}
  async execute() { await this.db.incr(this.sku, this.delta); }
  async undo()    { await this.db.incr(this.sku, -this.delta); } // compensating action
}

class CommandHistory {
  private done: UndoableCommand[] = [];
  async run(cmd: UndoableCommand) { await cmd.execute(); this.done.push(cmd); }
  async undoLast() { await this.done.pop()?.undo(); }
}

declare const orderRepo: { save(o: object): Promise<void> };
declare const inventory: { reserve(i: object[]): Promise<void> };
```

Điểm mấu chốt để nói trong phỏng vấn: **command là data nên serialize được** → đẩy qua Redis/Kafka, lưu vào DB (audit log), retry, schedule chạy sau — tất cả khả năng đó đến từ việc "hành động" không còn là function call nữa.

### Use case thực tế trong backend

- **BullMQ / bee-queue / agenda**: mỗi job là một command (`name` + `data` JSON) được serialize vào Redis, worker deserialize và execute — kèm retry, delay, priority. Đây là Command + Queue điển hình nhất trong Node.js.
- **NestJS CQRS** (`@nestjs/cqrs`): `commandBus.execute(new CreateOrderCommand(...))` route tới `@CommandHandler(CreateOrderCommand)` — tách write side, mỗi use case 1 handler dễ test.
- **Database migration** (Knex/TypeORM migrations): mỗi migration là command có `up()` (execute) và `down()` (undo) — đúng nghĩa undoable command.
- **Saga compensating transactions**: mỗi bước của saga là command + compensating command để rollback phân tán.

### Biến thể & cách triển khai khác

- **Closure-based command**: trong JS, một command đơn giản chỉ là `() => doSomething(args)` — closure đã "đóng gói request" sẵn. Đủ cho task queue in-memory (`p-queue` nhận array of async functions). Nhược điểm: không serialize được, không gửi qua mạng được.
- **Event Sourcing**: đẩy ý tưởng xa hơn — không lưu state mà lưu chuỗi event (kết quả của command); replay event để dựng lại state.
- **Macro command**: 1 command chứa danh sách command con, execute tuần tự — script hóa nghiệp vụ.
- **Command + idempotency key**: `metadata.id` dùng làm idempotency key để worker xử lý at-least-once không gây duplicate.

### ⚠️ Khi nào KHÔNG nên dùng / anti-pattern

- **CRUD đơn giản chạy sync**: bọc `userService.update()` thành `UpdateUserCommand` + bus + handler khi không cần queue/audit/undo là ceremony vô nghĩa — 3 file thay vì 1 dòng.
- **Command trả về data để render response**: command nên là "ra lệnh", fire-and-forget hoặc trả tối thiểu (id). Nếu bạn cần query data, đó là Query — trộn lẫn làm hỏng CQRS.
- **Fat command**: nhét cả business logic vào command object thay vì handler — command nên là DTO thuần.
- Undo bằng cách lưu "state trước đó" cho dữ liệu lớn → cân nhắc Memento hoặc event sourcing thay vì copy toàn bộ.

### 💬 Câu hỏi phỏng vấn liên quan

**Q: Vì sao nói BullMQ job là Command pattern?**
A: Job = `{ name, data, opts }` — một request được đóng gói thành object thuần data, serialize vào Redis, decouple hoàn toàn nơi tạo (API) và nơi thực thi (worker), kèm các khả năng chỉ có được khi action là data: retry, delay, priority, persist qua restart.

**Q: Command khác Event chỗ nào?**
A: Command là **mệnh lệnh hướng tới 1 handler**, đặt tên kiểu imperative (`CreateOrder`), có thể bị reject, thường xử lý đúng 1 nơi. Event là **thông báo chuyện đã xảy ra** (`OrderCreated`), quá khứ, không reject được, 0-n subscriber tùy ý nghe.

**Q: Làm undo cho thao tác đã ghi DB thế nào?**
A: Không "revert" theo nghĩa đen mà thực thi **compensating command** (trừ kho 5 → undo là cộng lại 5), giống `down()` của migration hay compensating transaction trong saga. Yêu cầu: mỗi command định nghĩa sẵn thao tác đảo ngược và phải tính tới việc state đã bị thay đổi bởi command khác xen giữa.

---

## 4. Chain of Responsibility

### Vấn đề nó giải quyết

Một HTTP request trước khi tới business logic phải đi qua: parse body → log → check JWT → check quyền → validate input → rate limit. Viết tất cả vào handler thì handler nào cũng lặp lại 6 bước; viết thành 1 hàm khổng lồ thì không tái sử dụng từng phần được. Chain of Responsibility xếp các bước thành **chuỗi handler, mỗi handler xử lý phần của mình rồi quyết định: chuyển tiếp cho thằng sau, hay dừng chuỗi tại đây** (trả 401, 429...).

**Express/Koa middleware chính là pattern này** — `next()` là cơ chế "chuyển cho handler kế tiếp".

### Cách triển khai trong Node.js/TypeScript

Tự viết middleware chain từ đầu để hiểu cơ chế `next()`:

```ts
// ============ Express-style middleware engine tự viết ============
interface Context {
  path: string;
  user?: { id: string; role: string };
  body?: unknown;
  status?: number;
  response?: unknown;
}

type Next = () => Promise<void>;
type Middleware = (ctx: Context, next: Next) => Promise<void> | void;

function compose(middlewares: Middleware[]) {
  return async function run(ctx: Context): Promise<void> {
    let lastIndex = -1;

    // dispatch(i) tạo hàm next cho middleware thứ i
    async function dispatch(i: number): Promise<void> {
      if (i <= lastIndex) throw new Error('next() called multiple times'); // guard như Koa
      lastIndex = i;
      const mw = middlewares[i];
      if (!mw) return; // hết chuỗi
      // QUAN TRỌNG: next chính là "dispatch middleware kế tiếp"
      await mw(ctx, () => dispatch(i + 1));
    }

    await dispatch(0);
  };
}

// ============ Các middleware — mỗi cái 1 trách nhiệm ============
const logger: Middleware = async (ctx, next) => {
  const start = Date.now();
  await next(); // chờ TOÀN BỘ phần còn lại của chuỗi chạy xong (mô hình "onion" của Koa)
  console.log(`${ctx.path} -> ${ctx.status} (${Date.now() - start}ms)`);
};

const authenticate: Middleware = async (ctx, next) => {
  const token = (ctx.body as any)?.token;
  if (!token) {
    ctx.status = 401;
    ctx.response = { error: 'Unauthorized' };
    return; // KHÔNG gọi next() => DỪNG CHUỖI — bản chất của CoR
  }
  ctx.user = { id: 'u1', role: 'admin' }; // verify token thật ở đây
  await next();
};

const authorize = (role: string): Middleware => async (ctx, next) => {
  if (ctx.user?.role !== role) {
    ctx.status = 403;
    ctx.response = { error: 'Forbidden' };
    return;
  }
  await next();
};

const handler: Middleware = async (ctx) => {
  ctx.status = 200;
  ctx.response = { data: `Hello ${ctx.user!.id}` };
};

// ============ Chạy ============
const app = compose([logger, authenticate, authorize('admin'), handler]);
await app({ path: '/admin/users', body: { token: 'abc' } });
```

Giải thích cơ chế `next()` (câu hỏi phỏng vấn rất hay gặp): mỗi middleware nhận một hàm `next` — thực chất là closure gọi middleware kế tiếp trong mảng. Không gọi `next()` = chuỗi dừng. `await next()` rồi chạy code phía sau = chạy **sau khi** toàn bộ downstream xong (Koa gọi là onion model — request đi vào qua từng lớp, response đi ra ngược lại qua đúng các lớp đó). Express thì `next()` không trả promise, nên middleware "after response" phải hook vào `res.on('finish')` thay vì code sau `next()`.

```ts
// ============ Ví dụ 2: Validation pipeline (chain trả lỗi tích lũy) ============
type Validator<T> = (input: T, errors: string[]) => void;

const validateOrder: Validator<{ items: unknown[]; total: number }>[] = [
  (o, errs) => { if (!Array.isArray(o.items) || o.items.length === 0) errs.push('items empty'); },
  (o, errs) => { if (o.total <= 0) errs.push('total must be > 0'); },
  (o, errs) => { if (o.total > 100_000_000) errs.push('total exceeds limit'); },
];

function runValidators<T>(input: T, validators: Validator<T>[]): string[] {
  const errors: string[] = [];
  for (const v of validators) v(input, errors);
  return errors;
}

// ============ Ví dụ 3: Approval workflow — handler "có thẩm quyền" thì xử lý ============
interface Approver {
  setNext(a: Approver): Approver;
  approve(amount: number): string;
}

abstract class BaseApprover implements Approver {
  private next?: Approver;
  constructor(protected limit: number, protected title: string) {}
  setNext(a: Approver) { this.next = a; return a; }
  approve(amount: number): string {
    if (amount <= this.limit) return `${this.title} approved ${amount}`;
    if (this.next) return this.next.approve(amount); // đẩy lên cấp cao hơn
    return `Rejected: ${amount} exceeds all limits`;
  }
}
class TeamLead extends BaseApprover { constructor() { super(5_000_000, 'TeamLead'); } }
class Manager  extends BaseApprover { constructor() { super(50_000_000, 'Manager'); } }
class Director extends BaseApprover { constructor() { super(500_000_000, 'Director'); } }

const chain = new TeamLead();
chain.setNext(new Manager()).setNext(new Director());
chain.approve(30_000_000); // "Manager approved 30000000"
```

### Use case thực tế trong backend

- **Express/Koa/Fastify middleware & hooks**: `app.use(helmet())`, `app.use(cors())`, `app.use(authenticate)` — chuỗi xử lý request nổi tiếng nhất. Fastify còn chia nhỏ thành lifecycle hooks (`onRequest` → `preValidation` → `preHandler`...) — vẫn là chain.
- **NestJS request pipeline**: Guards → Interceptors → Pipes → Handler → Interceptors (chiều ra) → Exception filters — một chain nhiều tầng được formalize.
- **Axios interceptors**: `axios.interceptors.request.use(...)` xếp chuỗi biến đổi request/response (gắn token, refresh token khi 401, retry).
- **GraphQL middleware / resolver chain** (graphql-middleware, envelop plugins).

### Biến thể & cách triển khai khác

- **Pipeline thuần (compose/pipe)**: khi mọi bước **luôn chạy hết** và biến đổi data tuần tự (`pipe(parse, normalize, enrich)`), đó là Pipeline — biến thể không có quyền "dừng chuỗi" như CoR đầy đủ.
- **Onion model (Koa)** vs **linear model (Express)**: Koa cho phép code after-`await next()` chạy chiều response; Express thì không.
- **CoR kiểu GoF cổ điển** (linked list `setNext`): hợp với workflow nghiệp vụ (approval), ít gặp hơn dạng array-of-functions trong JS.
- **Error-handling chain riêng**: Express middleware 4 tham số `(err, req, res, next)` — một chain song song chỉ kích hoạt khi có lỗi.

### ⚠️ Khi nào KHÔNG nên dùng / anti-pattern

- **Logic nghiệp vụ cốt lõi giấu trong middleware**: middleware nên là cross-cutting concern (auth, log, parse). Tính tiền trong middleware là nơi không ai tìm ra.
- **Chuỗi phụ thuộc thứ tự ngầm**: middleware B đọc `req.user` do A gắn — đổi thứ tự đăng ký là vỡ runtime, không có compile error. Cần document/encode thứ tự rõ ràng.
- **Quên gọi `next()`** (Express treo request mãi mãi) hoặc **gọi `next()` 2 lần** ("Cannot set headers after they are sent") — 2 bug kinh điển.
- Chuỗi quá dài (20+ middleware) cho mọi route → mỗi request trả phí toàn bộ chain; gắn middleware theo route/group thay vì global.

### 💬 Câu hỏi phỏng vấn liên quan

**Q: Express middleware là pattern gì? Giải thích next() hoạt động ra sao?**
A: Chain of Responsibility. Express giữ một mảng layer; `next()` là closure mà framework truyền vào, gọi nó nghĩa là "dispatch layer kế tiếp khớp route". Không gọi `next()` và không kết thúc response → request treo. Gọi `next(err)` → nhảy thẳng tới error-handling middleware (4 tham số), bỏ qua middleware thường.

**Q: Khác nhau giữa middleware Express và Koa?**
A: Koa middleware là async function và `next()` trả Promise → `await next()` cho phép viết code chạy ở "chiều ra" (onion model), ví dụ đo response time trong 1 middleware duy nhất. Express callback-based, code sau `next()` chạy ngay không chờ downstream, muốn hook chiều ra phải nghe `res.on('finish')`.

**Q: Chain of Responsibility khác Decorator chỗ nào? Cả hai đều bọc nhau.**
A: Decorator luôn **gọi xuyên qua** đối tượng bị bọc và thêm behavior — không có quyền chặn theo nghiệp vụ; mục đích là mở rộng. CoR thì mỗi handler **có quyền dừng chuỗi** (short-circuit) — mục đích là tìm/quyết định ai xử lý request.

---

## 5. Template Method

### Vấn đề nó giải quyết

Bạn có 5 repository (User, Order, Product...) — flow CRUD giống hệt nhau 90%: validate → query → map kết quả → log; chỉ khác table name, cách validate, cách map. Copy-paste 5 lần thì sửa 1 chỗ phải sửa 5 chỗ. Template Method **cố định khung thuật toán ở lớp cha, chừa các "lỗ hổng" (hooks/abstract methods) cho lớp con điền chi tiết** — invariant nằm 1 chỗ, variant nằm ở subclass.

### Cách triển khai trong Node.js/TypeScript

```ts
// ============ Ví dụ 1: Base Repository — class-based template ============
abstract class BaseRepository<T extends { id: string }> {
  constructor(protected db: Db, protected tableName: string) {}

  // ===== TEMPLATE METHOD: khung cố định, KHÔNG cho override =====
  async create(input: unknown): Promise<T> {
    const data = this.validate(input);          // bước bắt buộc — subclass định nghĩa
    await this.beforeCreate(data);              // hook tùy chọn — mặc định no-op
    const row = await this.db.insert(this.tableName, data as object);
    const entity = this.mapRow(row);            // bước bắt buộc
    await this.afterCreate(entity);             // hook tùy chọn
    return entity;
  }

  async findById(id: string): Promise<T | null> {
    const row = await this.db.selectOne(this.tableName, { id });
    return row ? this.mapRow(row) : null;
  }

  // ===== Primitive operations: subclass BẮT BUỘC implement =====
  protected abstract validate(input: unknown): Omit<T, 'id'>;
  protected abstract mapRow(row: Record<string, unknown>): T;

  // ===== Hooks: subclass override KHI CẦN (mặc định rỗng) =====
  protected async beforeCreate(_data: Omit<T, 'id'>): Promise<void> {}
  protected async afterCreate(_entity: T): Promise<void> {}
}

// ----- Subclass chỉ điền phần khác biệt -----
interface User { id: string; email: string; passwordHash: string }

class UserRepository extends BaseRepository<User> {
  constructor(db: Db) { super(db, 'users'); }

  protected validate(input: unknown): Omit<User, 'id'> {
    const i = input as Partial<User>;
    if (!i.email?.includes('@')) throw new Error('Invalid email');
    return { email: i.email.toLowerCase(), passwordHash: i.passwordHash! };
  }

  protected mapRow(row: Record<string, unknown>): User {
    return { id: String(row.id), email: String(row.email), passwordHash: String(row.password_hash) };
  }

  protected override async afterCreate(user: User): Promise<void> {
    eventBus.emit('user.created', user as any); // hook nối với Observer
  }
}

interface Db {
  insert(table: string, data: object): Promise<Record<string, unknown>>;
  selectOne(table: string, where: object): Promise<Record<string, unknown> | null>;
}
declare const eventBus: import('node:events').EventEmitter;

// ============ Ví dụ 2: ETL pipeline base class ============
abstract class EtlJob<TRaw, TClean> {
  // Template method: extract -> transform -> load, kèm error handling & metrics chung
  async run(): Promise<void> {
    const started = Date.now();
    try {
      const raw = await this.extract();
      const clean = raw.map((r) => this.transform(r)).filter((r): r is TClean => r !== null);
      await this.load(clean);
      console.log(`[etl] ${this.constructor.name} ok: ${clean.length} rows, ${Date.now() - started}ms`);
    } catch (err) {
      await this.onError(err); // hook
      throw err;
    }
  }
  protected abstract extract(): Promise<TRaw[]>;
  protected abstract transform(raw: TRaw): TClean | null; // null = skip row
  protected abstract load(rows: TClean[]): Promise<void>;
  protected async onError(err: unknown): Promise<void> { console.error(err); }
}

// ============ Idiomatic JS: thay inheritance bằng higher-order function ============
// Cùng ý tưởng "khung cố định + lỗ hổng", nhưng lỗ hổng là callbacks — không cần class
interface EtlSteps<TRaw, TClean> {
  extract: () => Promise<TRaw[]>;
  transform: (raw: TRaw) => TClean | null;
  load: (rows: TClean[]) => Promise<void>;
  onError?: (err: unknown) => Promise<void>;
}

function createEtlJob<TRaw, TClean>(steps: EtlSteps<TRaw, TClean>) {
  return async function run(): Promise<void> {  // <- chính là template method
    try {
      const raw = await steps.extract();
      const clean = raw.map(steps.transform).filter((r): r is TClean => r !== null);
      await steps.load(clean);
    } catch (err) {
      await steps.onError?.(err);
      throw err;
    }
  };
}

// Dùng: truyền object các bước — linh hoạt hơn, compose được, dễ test từng step
const syncProducts = createEtlJob({
  extract: async () => fetchFromLegacyApi(),
  transform: (p: { sku: string; price: string }) =>
    Number(p.price) > 0 ? { sku: p.sku, price: Number(p.price) } : null,
  load: async (rows) => bulkInsert('products', rows),
});
await syncProducts();

declare function fetchFromLegacyApi(): Promise<{ sku: string; price: string }[]>;
declare function bulkInsert(t: string, r: object[]): Promise<void>;
```

### Use case thực tế trong backend

- **Test frameworks**: `beforeEach`/`afterEach`/`beforeAll` của Jest/Vitest/Mocha — framework cố định khung chạy test (setup → test → teardown), bạn điền hooks. Đây là Template Method dạng callback.
- **Mongoose/Sequelize/TypeORM lifecycle hooks**: `pre('save')`, `@BeforeInsert()` — ORM cố định flow persist, bạn chèn logic vào hook points.
- **React (tham khảo full-stack)**: lifecycle methods/useEffect — framework giữ khung render.
- **Base service/repository trong dự án NestJS**: rất phổ biến — `BaseCrudService<T>` chứa pagination, soft-delete, audit fields chung; service con override `validate`, `toDto`.

### Biến thể & cách triển khai khác

- **Higher-order function (như trên)** — biến thể chủ đạo trong JS hiện đại; "subclass điền chi tiết" trở thành "truyền callbacks". Còn gọi là dấu hiệu của **Hollywood Principle**: "don't call us, we'll call you".
- **Hooks object với default**: `{ ...defaultHooks, ...userHooks }` — kiểu Fastify/Vite plugin options.
- **Template Method vs Strategy**: Template Method thay đổi **từng bước** của thuật toán qua inheritance/callback tại các điểm cố định; Strategy thay **toàn bộ** thuật toán qua composition. Khi các biến thể khác nhau quá nhiều bước → chuyển sang Strategy.

### ⚠️ Khi nào KHÔNG nên dùng / anti-pattern

- **Base class trở thành "God base"**: 15 hooks, subclass phải hiểu toàn bộ flow cha mới dám override — fragile base class problem. Quá 3-4 hook points là nên xem lại.
- **Deep inheritance**: `BaseRepo → AuditableRepo → SoftDeletableRepo → UserRepo` — mỗi tầng một ít magic, debug phải nhảy 4 file. JS/TS ưu tiên composition.
- **Override template method** (chứ không phải hook) ở subclass → phá vỡ invariant, mất hết ý nghĩa pattern. Đánh dấu rõ method nào là khung (không override) — TS không có `final`, dùng convention/comment.
- Khi chỉ có **1 implementation** và "tương lai có thể cần" → YAGNI, viết thẳng.

### 💬 Câu hỏi phỏng vấn liên quan

**Q: Template Method khác Strategy thế nào?**
A: Template Method dùng inheritance (hoặc callbacks), cố định khung và cho biến đổi **một số bước**; quan hệ là static, chọn lúc viết code. Strategy dùng composition, thay **cả thuật toán**, hoán đổi lúc runtime. Rule of thumb: chung khung khác chi tiết → Template Method; khác hoàn toàn cách làm → Strategy.

**Q: Trong JS thuần function, Template Method trông như thế nào?**
A: Là higher-order function nhận object callbacks: khung thuật toán là closure, các "abstract method" thành các function bắt buộc truyền vào, hooks thành optional callbacks có default. Jest `beforeEach/afterEach` chính là dạng này — framework giữ khung, dev điền lỗ hổng.

**Q: beforeEach của Jest là pattern gì? Sao không phải Observer?**
A: Là Template Method (dạng inversion of control bằng callback): Jest sở hữu **khung thuật toán cố định** (setup → run test → teardown) và gọi callback của bạn tại các điểm định sẵn theo thứ tự nghiêm ngặt. Observer thì ngược lại — số lượng listener tùy ý, không có khung thuật toán, subject không quan tâm ai nghe.

---

## 6. State

### Vấn đề nó giải quyết

Order có các trạng thái `pending → confirmed → shipped → delivered` (+ `cancelled`). Code if/else:

```ts
function shipOrder(order: Order) {
  if (order.status === 'pending') throw new Error('Not confirmed yet');
  if (order.status === 'cancelled') throw new Error('Order cancelled');
  if (order.status === 'shipped' || order.status === 'delivered') throw new Error('Already shipped');
  order.status = 'shipped';
}
```

Mỗi action phải liệt kê **tất cả** trạng thái không hợp lệ. Có 6 status × 5 action = 30 tổ hợp phải nhớ, thêm 1 status mới phải rà soát mọi hàm — **đây là lý do if/else state là bug factory**: quên 1 nhánh là order delivered vẫn cancel được, tiền refund bay màu. State pattern lật ngược: **định nghĩa tường minh các transition hợp lệ**, mọi thứ khác mặc định bị cấm.

### Cách triển khai trong Node.js/TypeScript

```ts
// ============ Ví dụ 1: Order state machine — transition table ============
type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
type OrderEvent  = 'confirm' | 'ship' | 'deliver' | 'cancel';

// Toàn bộ "luật" nằm ở MỘT chỗ — nhìn bảng này là thấy hết nghiệp vụ
const orderTransitions: Record<OrderStatus, Partial<Record<OrderEvent, OrderStatus>>> = {
  pending:   { confirm: 'confirmed', cancel: 'cancelled' },
  confirmed: { ship: 'shipped',      cancel: 'cancelled' },
  shipped:   { deliver: 'delivered' },                      // shipped thì KHÔNG cancel được
  delivered: {},                                            // terminal state
  cancelled: {},                                            // terminal state
};

class OrderStateMachine {
  constructor(private status: OrderStatus = 'pending') {}

  get current() { return this.status; }

  can(event: OrderEvent): boolean {
    return orderTransitions[this.status][event] !== undefined;
  }

  transition(event: OrderEvent): OrderStatus {
    const next = orderTransitions[this.status][event];
    if (!next) {
      // Mặc định CẤM — chỉ transition khai báo tường minh mới được phép
      throw new InvalidTransitionError(this.status, event);
    }
    this.status = next;
    return next;
  }
}

class InvalidTransitionError extends Error {
  constructor(from: OrderStatus, event: OrderEvent) {
    super(`Cannot "${event}" when order is "${from}"`);
  }
}

const order = new OrderStateMachine();
order.transition('confirm'); // pending -> confirmed
order.transition('ship');    // confirmed -> shipped
// order.transition('cancel'); // THROW: Cannot "cancel" when order is "shipped"

// ============ Ví dụ 2: Circuit Breaker — state machine đầy đủ với behavior ============
// 3 state: CLOSED (bình thường) / OPEN (chặn call) / HALF_OPEN (thử nghiệm hồi phục)
type BreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface BreakerOptions {
  failureThreshold: number;  // bao nhiêu lỗi liên tiếp thì mở (vd 5)
  resetTimeoutMs: number;    // OPEN bao lâu thì chuyển HALF_OPEN (vd 30s)
  halfOpenSuccesses: number; // HALF_OPEN cần mấy lần ok để đóng lại (vd 2)
}

class CircuitBreaker {
  private state: BreakerState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private openedAt = 0;

  constructor(private opts: BreakerOptions) {}

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    // BEHAVIOR PHỤ THUỘC STATE — cốt lõi của State pattern
    if (this.state === 'OPEN') {
      if (Date.now() - this.openedAt >= this.opts.resetTimeoutMs) {
        this.to('HALF_OPEN'); // hết thời gian phạt -> cho thử lại dè dặt
      } else {
        throw new Error('CircuitBreaker: OPEN — failing fast'); // chặn ngay, không gọi downstream
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.opts.halfOpenSuccesses) this.to('CLOSED'); // hồi phục
    } else {
      this.failures = 0; // CLOSED: reset đếm lỗi
    }
  }

  private onFailure() {
    if (this.state === 'HALF_OPEN') {
      this.to('OPEN'); // thử mà vẫn fail -> mở lại ngay
    } else {
      this.failures++;
      if (this.failures >= this.opts.failureThreshold) this.to('OPEN');
    }
  }

  private to(next: BreakerState) {
    console.log(`[breaker] ${this.state} -> ${next}`);
    this.state = next;
    this.failures = 0;
    this.successes = 0;
    if (next === 'OPEN') this.openedAt = Date.now();
  }
}

// Dùng để bảo vệ external API: downstream chết thì fail-fast thay vì timeout dồn ứ
const paymentBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  halfOpenSuccesses: 2,
});
// await paymentBreaker.exec(() => fetch('https://payment-gateway/charge', {...}));
```

Biến thể GoF cổ điển (mỗi state là một class implement chung interface, context delegate) phù hợp khi **mỗi state có nhiều behavior phức tạp riêng**; với backend Node.js, transition table như trên thường gọn và dễ review hơn.

### Use case thực tế trong backend

- **xstate**: thư viện state machine/statechart chuẩn công nghiệp trong JS — định nghĩa machine declarative (states, events, guards, actions), visualize được bằng Stately editor; dùng cho order flow, booking flow, multi-step form, saga.
- **opossum**: circuit breaker library phổ biến cho Node.js — đúng 3 state closed/open/half-open như code trên; Netflix Hystrix là tổ tiên của ý tưởng này.
- **BullMQ job states**: `waiting → active → completed/failed → delayed (retry)` — job lifecycle là state machine.
- **Order/Payment/KYC workflow** trong mọi hệ e-commerce/fintech: trạng thái đơn hàng, trạng thái giao dịch (initiated → authorized → captured → refunded) — nơi invalid transition = mất tiền thật.

### Biến thể & cách triển khai khác

- **GoF class-per-state**: `class PendingState implements OrderState { ship() { throw } confirm() {...} }` — mỗi state tự biết các transition; tốt khi behavior mỗi state đồ sộ, nhưng nhiều boilerplate.
- **Statechart (xstate)**: state machine mở rộng — nested states, parallel states, guards (`cond`), actions, delay — cho workflow thật sự phức tạp.
- **State lưu trong DB + check transition trong service**: thực tế production, status nằm ở row DB; transition table dùng để validate trước khi `UPDATE ... WHERE status = 'confirmed'` (optimistic check trong câu UPDATE để chống race condition giữa 2 request đồng thời).
- **Enum + switch exhaustiveness**: TS `never` check giúp compiler bắt thiếu case khi thêm state mới.

### ⚠️ Khi nào KHÔNG nên dùng / anti-pattern

- **Chỉ có 2 trạng thái kiểu boolean** (`isActive`) và không có luật transition → một field boolean là đủ.
- **State pattern nhưng vẫn để code ngoài tự ý gán `order.status = 'delivered'`** → máy trạng thái bị bypass, vô dụng. Status phải private, chỉ đổi qua `transition()`.
- **Quên concurrency**: 2 request cùng cancel + ship một order — state machine in-memory không cứu được; cần lock hoặc conditional UPDATE ở tầng DB.
- Anti-pattern gốc cần thuộc: **if/else theo status rải rác khắp service** — luật nghiệp vụ phân mảnh, thêm state mới phải grep cả codebase, và "transition mặc định được phép" thay vì "mặc định bị cấm".

### 💬 Câu hỏi phỏng vấn liên quan

**Q: Vì sao quản lý status bằng if/else là bug factory? Fix bằng gì?**
A: Vì luật transition bị phân tán ở mọi hàm và logic là "liệt kê cái bị cấm" — quên 1 nhánh là lọt transition sai (delivered vẫn cancel được). Fix: transition table/state machine tập trung, mặc định cấm, chỉ cho phép cái khai báo tường minh; thêm state mới chỉ sửa 1 chỗ và TS bắt thiếu case.

**Q: Giải thích 3 trạng thái của circuit breaker và vì sao cần HALF_OPEN?**
A: CLOSED — gọi bình thường, đếm lỗi; đủ ngưỡng lỗi → OPEN — fail-fast không gọi downstream, cho hệ thống kia thở; hết reset timeout → HALF_OPEN — cho qua số ít request thăm dò: thành công đủ thì về CLOSED, fail thì về OPEN ngay. Không có HALF_OPEN thì lúc đóng lại toàn bộ traffic ập vào downstream vừa hồi phục và đánh sập nó lần nữa (thundering herd).

**Q: State khác Strategy chỗ nào?**
A: Cấu trúc giống nhau nhưng: Strategy do client chọn 1 lần, các strategy không biết nhau; State tự chuyển bên trong object theo event, các state biết/định nghĩa transition sang state khác, và object thể hiện behavior khác nhau theo thời gian với cùng một lời gọi.

---

## 7. Iterator & Generator

### Vấn đề nó giải quyết

Bạn cần duyệt qua: 10 triệu dòng của file log 2GB, toàn bộ user từ API phân trang 100 record/lần, hay rows từ DB cursor. Load tất cả vào array là OOM (out of memory). Iterator pattern cho phép **duyệt tuần tự một collection mà không cần biết cấu trúc bên trong, và không cần materialize toàn bộ dữ liệu** — lấy đến đâu sinh ra đến đó (lazy).

JS có pattern này **built-in ở mức ngôn ngữ**: iterator protocol (`Symbol.iterator`, `next()`), generator (`function*`/`yield`), async iterator (`Symbol.asyncIterator`, `for await...of`).

### Cách triển khai trong Node.js/TypeScript

```ts
// ============ 1. Iterator protocol — thứ for...of dùng ngầm bên dưới ============
const customIterable: Iterable<number> = {
  [Symbol.iterator](): Iterator<number> {
    let n = 0;
    return { next: () => (n < 3 ? { value: n++, done: false } : { value: undefined, done: true }) };
  },
};
for (const x of customIterable) console.log(x); // 0 1 2 — for...of chỉ là syntax sugar gọi next()

// ============ 2. Generator — viết iterator không cần boilerplate ============
function* take<T>(iterable: Iterable<T>, count: number): Generator<T> {
  let i = 0;
  for (const item of iterable) {
    if (i++ >= count) return;
    yield item; // pause tại đây, resume khi consumer gọi next() — LAZY
  }
}

function* naturalNumbers(): Generator<number> {
  for (let n = 1; ; n++) yield n; // dãy VÔ HẠN nhưng không tốn memory — chỉ sinh khi được hỏi
}
console.log([...take(naturalNumbers(), 5)]); // [1, 2, 3, 4, 5]

// ============ 3. Async generator: PHÂN TRANG API TỰ ĐỘNG ============
// Consumer chỉ thấy "một dòng chảy user", không biết gì về page/cursor
interface Page<T> { data: T[]; nextCursor: string | null }

async function* fetchAllUsers(baseUrl: string): AsyncGenerator<{ id: string; email: string }> {
  let cursor: string | null = null;
  do {
    const url = `${baseUrl}/users?limit=100${cursor ? `&cursor=${cursor}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const page: Page<{ id: string; email: string }> = await res.json();

    yield* page.data;        // yield* = yield từng phần tử của iterable
    cursor = page.nextCursor;
  } while (cursor);          // tự fetch trang kế khi consumer cần — backpressure tự nhiên
}

// Dùng: như duyệt một array bình thường, dù phía sau là N lần HTTP call
for await (const user of fetchAllUsers('https://api.example.com')) {
  await syncToCrm(user);
  // break giữa chừng? Generator dừng luôn, KHÔNG fetch các trang còn lại — lazy đúng nghĩa
}

// ============ 4. Đọc file lớn theo dòng — không load cả file ============
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

async function* readLines(filePath: string): AsyncGenerator<string> {
  const rl = createInterface({
    input: createReadStream(filePath),     // stream đọc theo chunk (default 64KB)
    crlfDelay: Infinity,
  });
  yield* rl; // readline interface là async iterable sẵn
}

let errorCount = 0;
for await (const line of readLines('/var/log/app.log')) { // file 2GB, RAM vài chục MB
  if (line.includes('ERROR')) errorCount++;
}

// ============ 5. Stream chính là async iterator ============
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

// Mọi Readable stream đều có Symbol.asyncIterator
const res = await fetch('https://example.com/huge.csv');
for await (const chunk of Readable.fromWeb(res.body as any)) {
  process(chunk as Buffer); // xử lý từng chunk, có backpressure
}

// Ngược lại: async generator -> stream
const numberStream = Readable.from(naturalNumbers()); // Readable.from nhận mọi (async) iterable

// pipeline + async generator làm transform — cực kỳ gọn cho ETL
await pipeline(
  createReadStream('input.csv'),
  async function* (source) {                 // transform stage là async generator
    for await (const chunk of source) {
      yield chunk.toString().toUpperCase();
    }
  },
  process.stdout as any,
);

declare function syncToCrm(u: object): Promise<void>;
declare function process(c: Buffer): void;
```

Điểm ăn tiền khi phỏng vấn: **lazy + backpressure**. Generator chỉ chạy tới `yield` kế tiếp khi consumer gọi `next()` — consumer chậm thì producer tự chậm theo, không cần buffer thủ công. Đó cũng là lý do Node stream và async iterator hợp nhất được với nhau.

### Use case thực tế trong backend

- **Node.js streams**: mọi `Readable` là async iterable từ Node 10 — `for await (const chunk of req)` đọc request body, `pipeline()` nhận async generator làm transform.
- **Database cursors**: Mongoose `Model.find().cursor()` và pg `pg-query-stream` trả async iterable — export hàng triệu row ra CSV mà không OOM.
- **AWS SDK v3 paginators**: `paginateListObjectsV2(...)` trả async generator — đúng pattern "phân trang tự động" ở trên, dùng trong production hàng ngày.
- **Kafka consumer (kafkajs)** và **readline** đều expose dữ liệu dạng async iterable để `for await`.

### Biến thể & cách triển khai khác

- **Generator delegation (`yield*`)**: compose nhiều generator thành pipeline (`yield* parse(yield* readLines(f))`).
- **Two-way generator**: `const x = yield value` — consumer truyền data ngược vào qua `next(data)`; nền tảng của co (thư viện chạy generator như async/await trước khi async/await ra đời) và redux-saga.
- **Web Streams API** (`ReadableStream`) — chuẩn WHATWG, có trong Node 18+, cũng async iterable; tương lai của streaming cross-platform.
- **IxJS / iter-tools**: toolbox toán tử (map/filter/batch/buffer) cho (async) iterable khi cần xử lý dạng LINQ.
- `events.on(emitter, 'event')` biến EventEmitter thành async iterator — cầu nối Observer → Iterator.

### ⚠️ Khi nào KHÔNG nên dùng / anti-pattern

- **Dataset nhỏ, đã nằm sẵn trong memory** → `array.map/filter` rõ ràng và nhanh hơn; generator thêm indirection vô ích.
- **Cần random access hoặc biết length trước** → iterator chỉ đi tới, không index được.
- **Xử lý tuần tự từng item khi có thể batch**: `for await` từng row rồi `INSERT` từng dòng = chậm thảm; gom batch 500-1000 rồi bulk insert (generator vẫn dùng được — viết generator `batch(source, 500)`).
- **Quên cleanup**: `break` khỏi `for await` sẽ gọi `return()` của generator — nhưng nếu bạn tự gọi `next()` thủ công rồi bỏ ngang, connection/file handle trong generator có thể leak; dùng `try/finally` trong generator để release resource.

### 💬 Câu hỏi phỏng vấn liên quan

**Q: for await...of hoạt động với những gì? Stream có dùng được không?**
A: Với mọi object có `Symbol.asyncIterator` (và cả sync iterable). Node `Readable` stream implement sẵn nên `for await (const chunk of stream)` hoạt động trực tiếp, có backpressure: vòng lặp xử lý xong chunk này stream mới đọc tiếp chunk sau.

**Q: Generator giúp gì cho bài toán đọc/ghi dữ liệu lớn?**
A: Lazy evaluation — dữ liệu sinh ra theo nhu cầu consumer, memory footprint là 1 item/chunk thay vì cả dataset; backpressure tự nhiên; và early termination — `break` là dừng fetch/đọc phần còn lại. Ví dụ: async generator phân trang API, đọc file 2GB theo dòng, DB cursor export CSV.

**Q: Khác nhau giữa `return` và `yield` trong generator? `yield*` là gì?**
A: `yield` pause function và trả ra 1 giá trị, lần `next()` sau chạy tiếp từ đó; `return` kết thúc generator (`done: true`). `yield*` delegate sang một iterable khác — yield lần lượt mọi phần tử của nó, dùng để compose generators.

---

## 8. Mediator

### Vấn đề nó giải quyết

Checkout flow cần phối hợp: OrderService, PaymentService, InventoryService, ShippingService, NotificationService. Nếu để chúng gọi nhau trực tiếp: Order gọi Payment, Payment xong gọi ngược Order rồi gọi Inventory, Inventory gọi Shipping... → **đồ thị phụ thuộc chằng chịt n×n**, không service nào tái sử dụng được vì kéo theo cả cụm, và "flow checkout là gì" không đọc được ở bất kỳ đâu — nó rải trong 5 service.

Mediator đưa toàn bộ **logic điều phối vào một chỗ trung tâm**; các thành phần chỉ nói chuyện với mediator, không biết nhau. Số kết nối từ n×n về n.

### Cách triển khai trong Node.js/TypeScript

```ts
// ============ Saga Orchestrator — mediator điển hình nhất trong backend ============
// Orchestrator biết FLOW; các service không biết nhau, không biết cả flow

// ----- Các service: hoàn toàn độc lập, chỉ expose nghiệp vụ của mình -----
interface PaymentService {
  charge(orderId: string, amount: number): Promise<{ txId: string }>;
  refund(txId: string): Promise<void>;
}
interface InventoryService {
  reserve(orderId: string, items: string[]): Promise<void>;
  release(orderId: string): Promise<void>;
}
interface ShippingService {
  schedule(orderId: string): Promise<{ trackingId: string }>;
}
interface NotificationService {
  send(userId: string, message: string): Promise<void>;
}

// ----- Mediator: NƠI DUY NHẤT chứa flow + thứ tự + compensation -----
class CheckoutOrchestrator {
  constructor(
    private payment: PaymentService,
    private inventory: InventoryService,
    private shipping: ShippingService,
    private notification: NotificationService,
  ) {}

  async checkout(order: { id: string; userId: string; amount: number; items: string[] }) {
    // Đọc method này = đọc được TOÀN BỘ flow checkout — đây là giá trị lớn nhất
    const compensations: (() => Promise<void>)[] = [];

    try {
      await this.inventory.reserve(order.id, order.items);
      compensations.push(() => this.inventory.release(order.id));

      const { txId } = await this.payment.charge(order.id, order.amount);
      compensations.push(() => this.payment.refund(txId));

      const { trackingId } = await this.shipping.schedule(order.id);

      await this.notification.send(order.userId, `Order shipped: ${trackingId}`);
      return { status: 'completed' as const, trackingId };
    } catch (err) {
      // Saga compensation: rollback NGƯỢC thứ tự các bước đã làm
      for (const undo of compensations.reverse()) {
        await undo().catch((e) => console.error('compensation failed', e)); // log + alert, không throw đè
      }
      await this.notification.send(order.userId, 'Order failed, refund issued');
      return { status: 'failed' as const, reason: (err as Error).message };
    }
  }
}

// ============ Mediator dạng message-based (kiểu MediatR/.NET, NestJS CQRS) ============
// request -> mediator route tới đúng 1 handler; sender và handler không biết nhau
type RequestHandler<TReq, TRes> = (req: TReq) => Promise<TRes>;

class Mediator {
  private handlers = new Map<string, RequestHandler<any, any>>();

  register<TReq, TRes>(type: string, handler: RequestHandler<TReq, TRes>) {
    this.handlers.set(type, handler);
  }

  async send<TRes>(type: string, payload: unknown): Promise<TRes> {
    const handler = this.handlers.get(type);
    if (!handler) throw new Error(`No handler for ${type}`);
    return handler(payload); // controller chỉ biết mediator, không import service nào
  }
}

const mediator = new Mediator();
mediator.register('GetUserById', async (id: string) => ({ id, email: 'a@b.c' }));

// Controller mỏng dính — không phụ thuộc service cụ thể
async function getUserController(id: string) {
  return mediator.send('GetUserById', id);
}
```

**Mediator vs Observer — câu phân biệt kinh điển:**
- **Observer**: subject phát event, **không biết và không quan tâm** ai nghe, ai làm gì, thứ tự nào — choreography, decentralized.
- **Mediator**: trung tâm **chủ động biết flow** — gọi ai, theo thứ tự nào, fail thì làm gì — orchestration, centralized.
- Trong microservices: **saga choreography** (mỗi service nghe event của service khác, không có chỉ huy) = Observer style; **saga orchestration** (1 orchestrator điều phối) = Mediator style. Choreography giảm coupling nhưng flow vô hình; orchestration flow tường minh nhưng orchestrator thành điểm tập trung.

### Use case thực tế trong backend

- **NestJS CQRS module**: `CommandBus`/`QueryBus`/`EventBus` chính là mediator — controller `send()` vào bus, bus route tới handler; controller và handler không import nhau. Tương tự MediatR bên .NET.
- **Saga orchestrator**: Temporal.io workflow, AWS Step Functions, hoặc orchestrator tự viết như trên — điều phối distributed transaction giữa các microservice.
- **Message broker (RabbitMQ/Kafka) ở vai trò kiến trúc**: services chỉ nói chuyện với broker, không gọi nhau trực tiếp — broker là mediator của cả hệ thống (kèm routing logic: exchange, routing key).
- **Socket.IO server với rooms**: client không gửi message cho nhau trực tiếp; server nhận, quyết định broadcast cho ai — chat server là ví dụ mediator giáo khoa nhưng có thật.

### Biến thể & cách triển khai khác

- **Orchestrator có state (saga đúng nghĩa)**: persist trạng thái từng bước vào DB để crash giữa chừng còn resume/compensate được — Temporal làm sẵn việc này.
- **In-process mediator (command/query bus)** vs **distributed mediator (broker, step functions)** — cùng pattern, khác phạm vi.
- **Mediator + pipeline behaviors**: bus cho phép gắn middleware quanh handler (logging, validation, transaction) — kết hợp với Chain of Responsibility.
- Form/UI mediator (GoF gốc): ít liên quan backend, nhưng nên biết xuất xứ — dialog điều phối các widget.

### ⚠️ Khi nào KHÔNG nên dùng / anti-pattern

- **God Object**: mediator phình to ôm cả business logic của các thành phần thay vì chỉ điều phối → đổi tên thành "ServiceManager" 3000 dòng mà ai cũng sợ đụng vào. Mediator chỉ nên chứa **flow**, logic nghiệp vụ vẫn ở từng service.
- **Chỉ có 2 thành phần nói chuyện với nhau** → gọi trực tiếp, mediator là bureaucracy.
- **Mediator cho mọi thứ**: route cả những call CRUD đơn giản qua bus làm code khó trace ("ai handle command này?" phải đi tìm registry) — IDE không jump-to-definition được với string-based routing.
- Orchestrator distributed mà **không persist state** → crash giữa saga là tiền đã trừ, kho chưa trả, không ai compensate.

### 💬 Câu hỏi phỏng vấn liên quan

**Q: Mediator khác Observer thế nào? Khi nào chọn cái nào?**
A: Observer là choreography — publisher không biết ai nghe, flow hình thành ngầm từ các subscription, thêm reaction mới không sửa code cũ. Mediator là orchestration — trung tâm biết và điều khiển flow tường minh, fail-handling/compensation tập trung. Side-effect độc lập (gửi email khi user.created) → Observer; flow nhiều bước có thứ tự + rollback (checkout) → Mediator.

**Q: Saga orchestration vs choreography — trade-off?**
A: Orchestration: flow đọc được ở 1 chỗ, dễ debug/compensate, nhưng orchestrator là single point cần HA và dễ phình to. Choreography: loose coupling tối đa, không single point, nhưng flow vô hình (phải vẽ lại từ event subscriptions), khó trace, dễ tạo event cycle. Hệ ít service + flow phức tạp → orchestration; nhiều team tự trị + flow đơn giản → choreography.

**Q: CommandBus của NestJS CQRS là Mediator hay Command pattern?**
A: Cả hai phối hợp: mỗi command object là Command pattern (request đóng gói thành data); còn bus đứng giữa controller và handler, route theo type để 2 bên không biết nhau — vai trò đó là Mediator.

---

## 📋 Bảng tóm tắt

| Pattern | Vấn đề giải quyết (1 dòng) | Triển khai JS idiomatic |
|---|---|---|
| **Observer / Pub-Sub** | Một sự kiện xảy ra, nhiều nơi cần phản ứng mà publisher không muốn biết họ | `EventEmitter` / typed event bus; distributed thì Redis Pub/Sub, Kafka |
| **Strategy** | Hoán đổi thuật toán lúc runtime, tránh if/else phình to | `Record<string, (input) => output>` — map của functions; class khi cần DI/state |
| **Command** | Biến action thành data để queue, retry, log, undo | Object `{ type, payload }` + handler; BullMQ job; closure cho in-memory |
| **Chain of Responsibility** | Chuỗi bước xử lý, mỗi bước có quyền dừng hoặc chuyển tiếp | Array of `(ctx, next) => {}` + hàm `compose` — Express/Koa middleware |
| **Template Method** | Khung thuật toán cố định, chi tiết thay đổi theo từng case | Higher-order function nhận object callbacks (hooks); abstract class khi dùng NestJS |
| **State** | Behavior đổi theo trạng thái, transition phải hợp lệ | Transition table `Record<State, Partial<Record<Event, State>>>`; xstate cho flow phức tạp |
| **Iterator & Generator** | Duyệt dữ liệu lớn/vô hạn lazy, không load hết vào RAM | `function*`, `async function*`, `for await...of`; stream là async iterable |
| **Mediator** | n thành phần phối hợp mà không gọi chéo nhau n×n | Orchestrator class chứa flow; command/query bus; message broker |

---

## 💬 Câu hỏi tổng hợp hay gặp

**Q1: Pattern nào bạn dùng nhiều nhất trong dự án thật?**
A: Trả lời theo thực tế Node.js, kèm dẫn chứng cụ thể: Chain of Responsibility (mỗi ngày — middleware Express/NestJS guards-pipes-interceptors), Observer (domain events tách side-effect: `order.paid` → email, loyalty points), Strategy (payment gateway theo region, function map cho fee calculation), Command (mọi tác vụ chậm đẩy qua BullMQ). Điểm cộng lớn: nói thêm "tôi thường không chủ đích 'áp pattern' từ đầu — tôi nhận ra code đang cần nó khi if/else thứ ba xuất hiện, rồi refactor về pattern".

**Q2: Express middleware là pattern gì?**
A: Chain of Responsibility. Express giữ mảng các handler `(req, res, next)`; `next()` là closure dispatch handler kế tiếp khớp route; handler có quyền dừng chuỗi bằng cách kết thúc response thay vì gọi `next()`, hoặc rẽ nhánh sang error chain bằng `next(err)`. Koa cùng pattern nhưng async/onion model — `await next()` cho phép xử lý cả chiều response.

**Q3: EventEmitter có phải pub/sub không?**
A: Nói chính xác là Observer chứ không phải pub/sub đầy đủ: không có broker trung gian (emitter giữ trực tiếp listeners), chỉ trong 1 process, `emit()` đồng bộ, không có delivery guarantee. Pub/sub đúng nghĩa (Redis, Kafka, RabbitMQ) có broker decouple publisher/subscriber cả về process lẫn thời gian. Câu trả lời ăn điểm: "EventEmitter là observer in-process; khi cần scale ra nhiều instance thì cùng ý tưởng đó được nâng cấp thành distributed pub/sub qua broker".

**Q4: Trong JS, khi nào dùng class khi nào dùng function để triển khai pattern?**
A: Function (map/closure/HOF) khi: stateless, 1 method, không dependency — Strategy, Command đơn giản, Template Method dạng callbacks. Class khi: cần giữ state qua nhiều lần gọi (State machine, CircuitBreaker), cần nhiều method liên quan trên cùng state, cần DI container của framework (NestJS provider, Passport strategy), hoặc cần `extends` có chủ đích (BaseRepository). Nguyên tắc: bắt đầu bằng function, nâng lên class khi function bắt đầu phải "giả lập" state bằng closure rối rắm — đừng làm ngược lại.

**Q5: Kể 1 lần bạn refactor code dùng pattern?**
A: Cấu trúc trả lời chuẩn STAR, ví dụ mẫu: *(Situation)* Hàm xử lý webhook payment có chuỗi if/else theo `provider` (Stripe/Momo/VNPay) dài 400 dòng, mỗi lần thêm provider phải sửa hàm core và đã 2 lần gây bug regression cho provider cũ. *(Task)* Thêm ZaloPay mà không đụng code cũ. *(Action)* Refactor về Strategy: interface `WebhookHandler { verifySignature, parseEvent }`, mỗi provider 1 file, registry map `provider → handler`, hàm core chỉ còn lookup + dispatch ~30 dòng; viết test riêng từng handler. *(Result)* Thêm ZaloPay = 1 file mới + 1 dòng đăng ký, zero thay đổi code cũ, test coverage từng provider độc lập. Lưu ý khi kể: nêu rõ **trigger** khiến bạn refactor (nhánh if thứ 3, bug regression) — interviewer đánh giá khả năng nhận biết thời điểm, không phải khả năng thuộc pattern.
