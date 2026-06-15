# Design Patterns — Phần 1: Creational Patterns (Nhóm khởi tạo)

> Tài liệu ôn phỏng vấn Backend Node.js — viết theo hướng thực chiến, không lý thuyết suông.

## Design Pattern là gì?

**Design pattern** là giải pháp **đã được kiểm chứng** cho các vấn đề thiết kế phần mềm lặp đi lặp lại. Nó không phải code copy-paste được, mà là một **template tư duy**: "khi gặp vấn đề dạng X, cộng đồng đã đúc kết cách giải Y". Nguồn gốc từ cuốn *Design Patterns: Elements of Reusable Object-Oriented Software* (1994) của "Gang of Four" (GoF).

GoF chia 23 pattern thành **3 nhóm**:

| Nhóm | Mục đích | Ví dụ |
|---|---|---|
| **Creational** (khởi tạo) | Kiểm soát **cách tạo object** — tách logic khởi tạo khỏi logic sử dụng | Singleton, Factory, Builder, Prototype |
| **Structural** (cấu trúc) | Tổ chức **quan hệ giữa các object/class** | Adapter, Decorator, Proxy, Facade |
| **Behavioral** (hành vi) | Quản lý **giao tiếp và phân chia trách nhiệm** giữa các object | Observer, Strategy, Iterator, Command |

### ⚡ Lưu ý CỰC KỲ quan trọng khi phỏng vấn JS/Node.js

Sách GoF viết cho **Java/C++** — ngôn ngữ class-based, static typing, không có first-class functions. **JavaScript khác hẳn**, nên nhiều pattern GoF trong JS trở nên **đơn giản hơn rất nhiều, hoặc thậm chí thừa**:

- **First-class functions + closures** → Strategy, Command, Factory nhiều khi chỉ là... một function hoặc một object literal chứa functions. Không cần interface + class hierarchy.
- **Module system (CommonJS/ESM) có caching** → Singleton là hành vi **mặc định** của module, không cần viết class với `getInstance()`.
- **Object literal + dynamic typing** → Builder nhiều khi thay được bằng một options object với default params.
- **Prototype chain** → Prototype pattern gần như là... bản chất của ngôn ngữ.

**Interviewer senior đánh giá rất cao** ứng viên nói được: *"Pattern này trong Java cần 4 class, nhưng trong Node.js tôi chỉ cần một factory function vì JS có closures"* — nó chứng tỏ bạn hiểu **bản chất vấn đề** chứ không học vẹt UML. Ngược lại, viết Singleton kiểu Java (`private constructor` + `static getInstance()`) trong Node.js mà không nhắc đến module caching là một red flag.

---

## 1. Singleton

### Vấn đề nó giải quyết

Có những resource mà toàn bộ application **chỉ nên có đúng MỘT instance** và mọi nơi đều truy cập cùng instance đó:

- **Database connection pool**: nếu mỗi service tự `new Pool()` thì app sẽ mở hàng trăm connection, DB chết vì `too many connections`.
- **Config loader**: đọc env/file config một lần lúc boot, sau đó mọi nơi dùng chung — không đọc lại file mỗi lần.
- **Logger**: cần một điểm cấu hình tập trung (level, transport, format), mọi module ghi log qua nó.

Vấn đề thật sự là: **chia sẻ state + kiểm soát lifecycle của resource đắt đỏ**, chứ không phải "cấm new 2 lần" một cách máy móc.

### Cách triển khai trong Node.js/TypeScript

**Cách 1 — Module caching (idiomatic nhất trong Node.js):**

Node.js cache module sau lần `require`/`import` đầu tiên. Mọi nơi import cùng một path sẽ nhận **cùng một object** → singleton tự nhiên, không cần viết gì thêm.

```typescript
// db.ts — singleton qua module caching
import { Pool } from 'pg';

// Code này chỉ chạy MỘT LẦN duy nhất, dù file được import ở 100 chỗ.
// Node.js (cả CJS lẫn ESM) cache module evaluation theo resolved path.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // tối đa 20 connection trong pool
});

// usage ở bất kỳ đâu:
// import { pool } from './db';  ← luôn là CÙNG một pool
```

**Cách 2 — Lazy initialization (chỉ tạo khi dùng lần đầu):**

```typescript
// config.ts — lazy singleton bằng closure, không cần class
import { readFileSync } from 'node:fs';

interface AppConfig {
  port: number;
  dbUrl: string;
  redisUrl: string;
}

let cached: AppConfig | null = null;

export function getConfig(): AppConfig {
  // Lần gọi đầu: parse và validate. Các lần sau: trả cache.
  if (cached === null) {
    const raw = JSON.parse(readFileSync('./config.json', 'utf-8'));
    if (!raw.dbUrl) throw new Error('Missing dbUrl in config'); // fail-fast
    cached = {
      port: Number(process.env.PORT ?? raw.port ?? 3000),
      dbUrl: raw.dbUrl,
      redisUrl: raw.redisUrl,
    };
  }
  return cached;
}

// Hữu ích cho testing: cho phép reset cache
export function resetConfigForTest(): void {
  cached = null;
}
```

**Cách 3 — Class với static instance (kiểu "cổ điển", ít idiomatic hơn nhưng hay bị hỏi):**

```typescript
// logger.ts
class Logger {
  private static instance: Logger | null = null;
  private level: 'debug' | 'info' | 'error' = 'info';

  // private constructor: chặn `new Logger()` từ bên ngoài (TS enforce lúc compile)
  private constructor() {}

  static getInstance(): Logger {
    // Lưu ý: Node.js single-threaded trong 1 event loop
    // → KHÔNG cần lock/double-checked locking như Java.
    if (Logger.instance === null) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLevel(level: 'debug' | 'info' | 'error') {
    this.level = level;
  }

  info(msg: string, meta?: Record<string, unknown>) {
    if (this.level === 'error') return;
    console.log(JSON.stringify({ level: 'info', msg, ...meta, ts: Date.now() }));
  }
}

export const logger = Logger.getInstance();
```

### Use case thực tế trong backend

1. **Mongoose**: `import mongoose from 'mongoose'` — bản thân package export một singleton instance; `mongoose.connect()` ở `main.ts` rồi mọi model dùng chung connection. Đây là module-caching singleton điển hình.
2. **Prisma**: docs chính thức khuyến nghị tạo **một** `PrismaClient` và export từ một module (`lib/prisma.ts`) — vì mỗi `new PrismaClient()` mở thêm connection pool riêng.
3. **NestJS**: mặc định mọi provider có scope `Singleton` — DI container đảm bảo mỗi class chỉ có một instance trong toàn app. Đây là singleton "có quản lý" (managed singleton), không phải singleton tự chế.
4. Trong dự án thực: config service, logger (pino/winston instance), Redis client, Kafka producer.

### Biến thể & cách triển khai khác

| Cách | Ưu | Nhược |
|---|---|---|
| **Module caching** | Zero code, idiomatic Node.js | Cache theo *resolved path* — symlink, monorepo có 2 bản package, hoặc lẫn lộn CJS/ESM của cùng file có thể tạo **2 instance** (bẫy thật ngoài đời với `node_modules` trùng lặp!) |
| **Class static instance** | Quen thuộc với người từ Java/C# | Verbose, vẫn test khó như nhau |
| **Closure + lazy init** | Kiểm soát thời điểm khởi tạo, dễ thêm `reset()` cho test | Phải tự viết |
| **DI container (NestJS, Awilix, tsyringe)** | **Tốt nhất cho app lớn**: testable, lifecycle rõ ràng, có thể đổi scope (singleton/request-scoped) | Cần framework/library |

**Tại sao DI tốt hơn singleton tự chế?** Singleton "cứng" (import trực tiếp) tạo **hidden dependency**: nhìn signature của function không biết nó phụ thuộc gì, và **không thể thay thế khi test**. Với DI, dependency được *tiêm vào* qua constructor → unit test chỉ cần truyền mock:

```typescript
// ❌ Khó test: phụ thuộc ngầm vào singleton
import { pool } from './db';
export async function getUser(id: string) {
  return pool.query('SELECT * FROM users WHERE id = $1', [id]);
}

// ✅ Dễ test: dependency tường minh, singleton-ness do composition root quyết định
export class UserRepo {
  constructor(private readonly pool: Pool) {} // test: truyền fake pool
  async getUser(id: string) {
    return this.pool.query('SELECT * FROM users WHERE id = $1', [id]);
  }
}
```

> Ý quan trọng để "ghi điểm": **singleton là chuyện lifecycle, DI là chuyện wiring**. Bạn vẫn muốn 1 instance pool — nhưng để DI container/composition root quản lý việc đó, thay vì để class tự quản.

### ⚠️ Khi nào KHÔNG nên dùng / anti-pattern

- **Singleton chứa mutable state dùng chung** = biến global trá hình → bug khó trace, test phụ thuộc thứ tự chạy (test A làm bẩn state, test B fail). Đây là lý do Singleton hay bị gọi là anti-pattern.
- **Bẫy kinh điển — cluster/multi-process**: Node.js scale bằng `cluster`/PM2/Kubernetes pods → **mỗi process có một instance riêng**, singleton chỉ "đơn nhất" trong phạm vi 1 process! Ví dụ tai nạn thật: làm **in-memory rate limiter** hoặc **in-memory cache** dạng singleton, chạy 4 worker → mỗi worker đếm riêng, limit 100 req/min thành 400 req/min. Cần state thật sự toàn cục thì phải dùng **Redis/DB**, không phải singleton.
- **Serverless (Lambda)**: singleton sống theo warm container — vừa là kỹ thuật tối ưu (reuse DB connection giữa các invocation) vừa là bẫy (state "rò rỉ" giữa các request của user khác nhau).
- Đừng biến mọi thứ thành singleton "cho tiện" — stateless service/helper thì cứ là pure function.

### 💬 Câu hỏi phỏng vấn liên quan

**Q1: Node.js có cần viết Singleton class kiểu Java không?**
A: Hầu như không. Module caching của Node.js đã là singleton: module chỉ được evaluate một lần theo resolved path, mọi `import` sau đó nhận cùng exports object. Chỉ cần `export const pool = new Pool(...)`. Class + `getInstance()` chỉ đáng cân nhắc khi cần lazy init phức tạp — mà lúc đó closure cũng đủ.

**Q2: Singleton hoạt động thế nào khi app chạy cluster mode / nhiều pod?**
A: Mỗi process có heap riêng → mỗi process một instance. Singleton KHÔNG chia sẻ state qua process. Cần shared state (rate limit, cache, lock) thì phải externalize ra Redis/DB. Đây là bug rất hay gặp khi scale từ 1 instance lên nhiều instance.

**Q3: Tại sao Singleton gây khó khăn cho unit testing? Giải pháp?**
A: (1) Hidden dependency — không mock được vì code import trực tiếp; (2) state tồn tại xuyên suốt các test → test không độc lập. Giải pháp: dependency injection (truyền dependency qua constructor/param), hoặc tối thiểu là expose hàm `reset()` cho test, hoặc dùng module mocking (`vi.mock`/`jest.mock`) — nhưng DI là giải pháp sạch nhất.

---

## 2. Factory Method & Simple Factory

### Vấn đề nó giải quyết

Code nghiệp vụ phải quyết định **tạo object loại nào lúc runtime**, và bạn không muốn rải `if/else + new XxxService()` khắp nơi:

- Checkout service cần payment provider theo lựa chọn của user: Stripe, MoMo, ZaloPay — mỗi cái config, SDK, khởi tạo khác nhau.
- Logger theo môi trường: dev in màu ra console, production ghi JSON, test thì silent.
- Notification channel theo user preference: email / SMS / push.

Nếu logic khởi tạo nằm lẫn trong business code: thêm provider mới phải sửa N chỗ, business code phải biết chi tiết constructor của từng SDK. **Factory tách "tạo cái gì, tạo thế nào" ra một chỗ duy nhất**, business code chỉ làm việc với interface.

### Cách triển khai trong Node.js/TypeScript

```typescript
// payment.ts

// 1. Interface chung — business code chỉ biết cái này
export interface PaymentProvider {
  charge(amount: number, currency: string, token: string): Promise<{ txId: string }>;
  refund(txId: string): Promise<void>;
}

// 2. Các implementation cụ thể
class StripeProvider implements PaymentProvider {
  constructor(private readonly apiKey: string) {}
  async charge(amount: number, currency: string, token: string) {
    // gọi Stripe SDK... (Stripe tính theo cent)
    return { txId: `stripe_${Date.now()}` };
  }
  async refund(txId: string) { /* stripe.refunds.create(...) */ }
}

class MomoProvider implements PaymentProvider {
  constructor(private readonly partnerCode: string, private readonly secretKey: string) {}
  async charge(amount: number, currency: string, token: string) {
    if (currency !== 'VND') throw new Error('MoMo only supports VND');
    return { txId: `momo_${Date.now()}` };
  }
  async refund(txId: string) { /* gọi MoMo refund API */ }
}

class ZaloPayProvider implements PaymentProvider {
  constructor(private readonly appId: string, private readonly key1: string) {}
  async charge(amount: number, currency: string, token: string) {
    return { txId: `zlp_${Date.now()}` };
  }
  async refund(txId: string) { /* ... */ }
}

// 3. Simple Factory — MỘT chỗ duy nhất biết cách khởi tạo từng provider
export type PaymentMethod = 'stripe' | 'momo' | 'zalopay';

export function createPaymentProvider(method: PaymentMethod): PaymentProvider {
  switch (method) {
    case 'stripe':
      return new StripeProvider(process.env.STRIPE_KEY!);
    case 'momo':
      return new MomoProvider(process.env.MOMO_PARTNER!, process.env.MOMO_SECRET!);
    case 'zalopay':
      return new ZaloPayProvider(process.env.ZLP_APP_ID!, process.env.ZLP_KEY1!);
    default: {
      // exhaustiveness check: thêm method mới mà quên case → TS báo lỗi compile
      const _never: never = method;
      throw new Error(`Unsupported payment method: ${method}`);
    }
  }
}

// 4. Business code: sạch, không biết gì về SDK cụ thể
// const provider = createPaymentProvider(order.paymentMethod);
// await provider.charge(order.total, order.currency, req.body.token);
```

**Phiên bản registry (Open/Closed hơn — thêm provider không sửa factory):**

```typescript
const registry = new Map<PaymentMethod, () => PaymentProvider>();

export function registerProvider(method: PaymentMethod, factory: () => PaymentProvider) {
  registry.set(method, factory);
}

export function createProvider(method: PaymentMethod): PaymentProvider {
  const factory = registry.get(method);
  if (!factory) throw new Error(`No provider registered for ${method}`);
  return factory(); // lazy: chỉ khởi tạo khi cần
}

// Mỗi provider tự đăng ký ở module của nó:
registerProvider('stripe', () => new StripeProvider(process.env.STRIPE_KEY!));
```

> **Phân biệt khi bị hỏi sâu**: *Simple Factory* (như trên) chỉ là một function chứa switch — không phải pattern GoF "chính thống" nhưng là cái dùng nhiều nhất thực tế. *Factory Method* theo GoF là subclass override một method tạo object (ví dụ: `class Framework { createHandler() }` cho subclass quyết định). Trong JS, vì function là first-class, **factory function thay thế được phần lớn cả hai** — không cần hierarchy class chỉ để chọn cái gì được `new`.

### Use case thực tế trong backend

1. **`http.createServer()`, `express()`** — chính Node.js core và Express đều expose factory function thay vì bắt bạn `new Server()`. Đây là phong cách API phổ biến nhất của hệ sinh thái Node.
2. **Winston `createLogger()` / Pino `pino()`** — factory nhận config, trả về logger đã wire đủ transport/format. Bạn áp dụng y hệt: `createLogger(env)` trả console logger cho dev, JSON logger cho prod.
3. **Knex**: `knex({ client: 'pg' | 'mysql2' | 'sqlite3', ... })` — một factory nhận config và lắp dialect tương ứng phía sau.
4. Trong dự án thật: factory cho storage driver (S3 vs local disk theo env), cho queue (BullMQ vs in-memory cho test), cho notification channel.

### Biến thể & cách triển khai khác

- **Factory function vs Factory class**: trong JS, ưu tiên function. Chỉ dùng class khi factory tự nó có state/config cần giữ (lúc đó vẫn có thể là closure).
- **Object literal làm registry tĩnh** — gọn nhất khi danh sách cố định:

```typescript
const factories: Record<PaymentMethod, () => PaymentProvider> = {
  stripe: () => new StripeProvider(process.env.STRIPE_KEY!),
  momo: () => new MomoProvider(process.env.MOMO_PARTNER!, process.env.MOMO_SECRET!),
  zalopay: () => new ZaloPayProvider(process.env.ZLP_APP_ID!, process.env.ZLP_KEY1!),
};
// Record<PaymentMethod, ...> còn ép compile-time phải đủ key — hay hơn switch.
```

- **Async factory**: constructor không thể `await`, nên khi khởi tạo cần I/O (handshake, đọc secret) thì factory function async là lời giải chuẩn trong Node: `static async create(): Promise<Db> { ... }`. Đây là lý do *thực dụng* khiến factory phổ biến trong Node hơn cả lý do "design".
- **DI container**: NestJS `useFactory` provider chính là factory pattern được container hoá.

### ⚠️ Khi nào KHÔNG nên dùng / anti-pattern

- **Chỉ có MỘT implementation và không có dấu hiệu sẽ có thêm** → factory là abstraction thừa (YAGNI). `new UserService()` thẳng là đủ.
- Factory mà **vẫn để caller truyền config chi tiết của từng loại** → leaky abstraction, mất luôn ý nghĩa.
- Switch/if theo type rải ở **nhiều factory khác nhau** cho cùng một type → dấu hiệu nên gom về registry hoặc dùng polymorphism.
- Đặt tên `XxxFactoryFactory`, factory lồng factory → over-engineering kiểu Java enterprise, interviewer Node.js sẽ nhăn mặt.

### 💬 Câu hỏi phỏng vấn liên quan

**Q1: Khác nhau giữa Simple Factory và Factory Method?**
A: Simple Factory là một function/method chứa logic chọn-và-tạo (switch theo type) — không phải pattern GoF chính thức nhưng phổ biến nhất. Factory Method (GoF) là base class khai báo method tạo object và để subclass override quyết định tạo concrete nào. Trong JS, do function là first-class, ta thường truyền thẳng factory function làm tham số thay vì kế thừa — đơn giản hơn mà đạt cùng mục đích.

**Q2: Tại sao trong Node.js hay thấy factory function thay vì `new`? (express(), pino()...)**
A: (1) Ẩn được chi tiết khởi tạo và cho phép trả về các shape khác nhau; (2) hỗ trợ async initialization mà constructor không làm được; (3) closure giữ private state mà không cần class; (4) caller không cần biết/lo về `new` và `this`. Đó là phong cách API idiomatic của hệ sinh thái Node.

**Q3: Factory có giúp gì cho testing?**
A: Có — test có thể inject factory giả hoặc đăng ký mock vào registry (`registerProvider('stripe', () => fakeStripe)`), nhờ đó business code chạy với mock mà không cần monkey-patch module. Factory chính là "seam" để thay thế dependency.

---

## 3. Abstract Factory

### Vấn đề nó giải quyết

Factory thường tạo **một** loại object. Nhưng có lúc bạn cần tạo **một HỌ object liên quan, phải đi cùng nhau và tương thích với nhau**:

Tình huống thật: app hỗ trợ deploy lên **AWS hoặc GCP** (khách enterprise yêu cầu). Trên AWS bạn dùng S3 + SQS + Secrets Manager; trên GCP là Cloud Storage + Pub/Sub + Secret Manager. **Không được trộn lẫn**: đã chọn AWS thì cả 3 service phải là AWS (chung credentials, region, SDK client). Nếu để từng nơi tự chọn, sẽ có ngày storage là S3 mà queue lại là Pub/Sub vì ai đó config nhầm.

Abstract Factory = **một factory tạo ra trọn bộ sản phẩm cùng "hệ"**, đảm bảo tính nhất quán của cả họ.

### Cách triển khai trong Node.js/TypeScript

```typescript
// cloud.ts

// ===== 1. Các interface "sản phẩm" =====
export interface ObjectStorage {
  upload(key: string, body: Buffer): Promise<string>; // trả về URL
  download(key: string): Promise<Buffer>;
}

export interface MessageQueue {
  publish(topic: string, message: object): Promise<void>;
  subscribe(topic: string, handler: (msg: object) => Promise<void>): void;
}

export interface SecretStore {
  get(name: string): Promise<string>;
}

// ===== 2. Abstract Factory: một interface trả về CẢ HỌ =====
export interface CloudProvider {
  createStorage(): ObjectStorage;
  createQueue(): MessageQueue;
  createSecrets(): SecretStore;
}

// ===== 3. Concrete factory cho AWS — cả họ dùng chung credentials/region =====
class AwsProvider implements CloudProvider {
  constructor(private readonly region: string) {}

  createStorage(): ObjectStorage {
    return {
      async upload(key, body) {
        // s3.send(new PutObjectCommand(...))
        return `https://bucket.s3.${this.region}.amazonaws.com/${key}`;
      },
      async download(key) { return Buffer.from('...'); },
    } as ObjectStorage;
  }

  createQueue(): MessageQueue {
    return {
      async publish(topic, message) { /* sqs.send(new SendMessageCommand(...)) */ },
      subscribe(topic, handler) { /* long-poll SQS */ },
    };
  }

  createSecrets(): SecretStore {
    return {
      async get(name) { /* secretsManager.getSecretValue(...) */ return 'secret'; },
    };
  }
}

// ===== 4. Concrete factory cho GCP =====
class GcpProvider implements CloudProvider {
  constructor(private readonly projectId: string) {}

  createStorage(): ObjectStorage {
    return {
      async upload(key, body) { return `https://storage.googleapis.com/bucket/${key}`; },
      async download(key) { return Buffer.from('...'); },
    };
  }
  createQueue(): MessageQueue {
    return {
      async publish(topic, message) { /* pubsub.topic(topic).publishMessage(...) */ },
      subscribe(topic, handler) { /* pubsub subscription */ },
    };
  }
  createSecrets(): SecretStore {
    return {
      async get(name) { /* secretManagerClient.accessSecretVersion(...) */ return 'secret'; },
    };
  }
}

// ===== 5. Chọn factory MỘT LẦN ở composition root (main.ts) =====
export function createCloudProvider(): CloudProvider {
  switch (process.env.CLOUD) {
    case 'gcp': return new GcpProvider(process.env.GCP_PROJECT!);
    case 'aws':
    default:    return new AwsProvider(process.env.AWS_REGION ?? 'ap-southeast-1');
  }
}

// main.ts:
// const cloud = createCloudProvider();
// const storage = cloud.createStorage();
// const queue = cloud.createQueue();
// → KHÔNG THỂ vô tình trộn S3 với Pub/Sub: tất cả ra từ cùng một factory.
```

**Biến thể idiomatic JS — object literal thay vì class hierarchy:**

```typescript
// Trong JS, "abstract factory" có thể chỉ là một object chứa các factory function
const awsProvider: CloudProvider = {
  createStorage: () => makeS3Storage(awsConfig),
  createQueue: () => makeSqsQueue(awsConfig),
  createSecrets: () => makeAwsSecrets(awsConfig),
};
// Không cần abstract class — duck typing + interface của TS là đủ.
```

### Use case thực tế trong backend

1. **Database driver layer**: Knex/TypeORM bên trong chọn "dialect" — mỗi dialect là một họ object đi cùng nhau (query compiler + connection handler + schema builder cho Postgres phải cùng hệ Postgres). Đây chính là abstract factory trong thực tế.
2. **Multi-cloud / on-premise deployment**: sản phẩm bán cho enterprise phải chạy được trên AWS, GCP, hoặc hạ tầng riêng của khách → một `Provider` factory cho mỗi môi trường (storage + queue + secrets + email đi cùng nhau).
3. **Test environment**: một `TestProvider` trả về in-memory storage + in-memory queue + fake secrets — integration test chạy không cần hạ tầng thật, và đảm bảo tất cả fake đều "cùng hệ" (chia sẻ cùng in-memory state).

### Biến thể & cách triển khai khác

- **Object literal of factories** (như trên) — cách idiomatic nhất trong JS, không cần class.
- **Module-per-provider**: mỗi provider là một module (`providers/aws.ts`, `providers/gcp.ts`) export cùng một interface; chọn provider = dynamic `import()` theo env. Module chính là "factory object".
- **DI container module**: NestJS dynamic module (`CloudModule.forRoot({ provider: 'aws' })`) bind cả họ provider một lần — abstract factory được container hoá.

### ⚠️ Khi nào KHÔNG nên dùng / anti-pattern

- **Chỉ có 1-2 "sản phẩm" hoặc chúng không thật sự ràng buộc nhau** → chỉ cần các factory độc lập. Abstract Factory chỉ đáng giá khi tính "cùng họ" là ràng buộc thật.
- **Chỉ có một họ và không có kế hoạch thêm họ thứ hai** → YAGNI, đây là pattern hay bị over-engineer nhất trong Node.js. Thành thật với interviewer: *"Đa số dự án Node.js không cần Abstract Factory; tôi chỉ dùng khi có yêu cầu multi-provider thật sự như multi-cloud."* — câu này ghi điểm.
- Thêm một sản phẩm mới vào họ (vd thêm `createEmailService()`) buộc sửa **mọi** concrete factory — nếu họ sản phẩm thay đổi thường xuyên, pattern này gây đau.

### 💬 Câu hỏi phỏng vấn liên quan

**Q1: Khác nhau giữa Factory Method và Abstract Factory?**
A: Factory Method tạo MỘT loại sản phẩm (một method, chọn concrete nào). Abstract Factory là một object/interface gom NHIỀU factory method để tạo cả HỌ sản phẩm liên quan, đảm bảo chúng tương thích nhau (đã AWS thì storage + queue + secrets đều AWS). Abstract Factory thường được implement bằng nhiều Factory Method bên trong.

**Q2: Trong Node.js, anh/chị đã dùng Abstract Factory ở đâu, hay nó là over-engineering?**
A: Phần lớn dự án không cần. Nó hợp lý khi: multi-cloud/multi-tenant infrastructure, database dialect layer (như Knex làm), hoặc tạo bộ fake services đồng bộ cho testing. Trong JS nó thường gọn thành một object literal chứa các factory function cho mỗi provider, không cần class hierarchy.

**Q3: Làm sao đảm bảo không trộn lẫn sản phẩm của hai họ?**
A: Chọn factory đúng MỘT lần tại composition root (main.ts / DI module), rồi inject các sản phẩm xuống — business code không bao giờ tự gọi concrete factory. TypeScript interface + việc mọi sản phẩm sinh ra từ cùng một factory instance đảm bảo tính nhất quán.

---

## 4. Builder

### Vấn đề nó giải quyết

Tạo object **phức tạp, nhiều bước, nhiều tuỳ chọn, một số phần optional và thứ tự linh hoạt**. Triệu chứng khi thiếu builder:

- Constructor 8 tham số: `new Query(table, where, joins, orderBy, limit, offset, groupBy, having)` — gọi sai thứ tự không ai phát hiện.
- Object cần **xây dần qua nhiều bước logic** (thêm điều kiện where theo từng filter user gửi lên) — không thể viết một literal duy nhất.
- Trong test: dựng một `Order` hợp lệ cần 15 field, mỗi test chỉ quan tâm 1-2 field → copy-paste setup khổng lồ.

Builder tách quá trình **xây** (từng bước, chainable) khỏi **kết quả cuối** (`build()`/`execute()` trả về object hoàn chỉnh đã validate).

### Cách triển khai trong Node.js/TypeScript

**Ví dụ 1 — Query Builder (mô phỏng cách Knex hoạt động):**

```typescript
// query-builder.ts
type Op = '=' | '>' | '<' | 'LIKE';

export class QueryBuilder {
  private wheres: { col: string; op: Op; val: unknown }[] = [];
  private orderBys: { col: string; dir: 'ASC' | 'DESC' }[] = [];
  private limitN?: number;

  constructor(private readonly table: string) {}

  // Mỗi method mutate state nội bộ rồi `return this` → method chaining
  where(col: string, op: Op, val: unknown): this {
    this.wheres.push({ col, op, val });
    return this;
  }

  orderBy(col: string, dir: 'ASC' | 'DESC' = 'ASC'): this {
    this.orderBys.push({ col, dir });
    return this;
  }

  limit(n: number): this {
    this.limitN = n;
    return this;
  }

  // build(): thời điểm DUY NHẤT tạo ra kết quả cuối — kèm parameterized values
  build(): { sql: string; params: unknown[] } {
    const params: unknown[] = [];
    let sql = `SELECT * FROM ${this.table}`;
    if (this.wheres.length > 0) {
      const conds = this.wheres.map((w) => {
        params.push(w.val);
        return `${w.col} ${w.op} $${params.length}`; // $1, $2... chống SQL injection
      });
      sql += ` WHERE ${conds.join(' AND ')}`;
    }
    if (this.orderBys.length > 0) {
      sql += ` ORDER BY ${this.orderBys.map((o) => `${o.col} ${o.dir}`).join(', ')}`;
    }
    if (this.limitN !== undefined) sql += ` LIMIT ${this.limitN}`;
    return { sql, params };
  }
}

// Sức mạnh thật sự: XÂY DẦN THEO ĐIỀU KIỆN — object literal không làm được
const qb = new QueryBuilder('orders').where('status', '=', 'paid');
if (req.query.minTotal) qb.where('total', '>', Number(req.query.minTotal));
if (req.query.sort) qb.orderBy(String(req.query.sort), 'DESC');
const { sql, params } = qb.limit(20).build();
// → SELECT * FROM orders WHERE status = $1 AND total > $2 ORDER BY ... LIMIT 20
```

**Ví dụ 2 — Test Data Builder (cực kỳ thực dụng cho unit test):**

```typescript
// order.builder.ts — dùng trong test
interface Order {
  id: string;
  userId: string;
  items: { sku: string; qty: number; price: number }[];
  status: 'pending' | 'paid' | 'shipped';
  total: number;
  createdAt: Date;
}

export class OrderBuilder {
  // default hợp lệ — mỗi test CHỈ override field nó quan tâm
  private order: Order = {
    id: 'order-1',
    userId: 'user-1',
    items: [{ sku: 'SKU-1', qty: 1, price: 100_000 }],
    status: 'pending',
    total: 100_000,
    createdAt: new Date('2026-01-01'),
  };

  withStatus(status: Order['status']): this {
    this.order.status = status;
    return this;
  }

  withItems(items: Order['items']): this {
    this.order.items = items;
    this.order.total = items.reduce((s, i) => s + i.qty * i.price, 0); // giữ invariant!
    return this;
  }

  build(): Order {
    return structuredClone(this.order); // mỗi build một bản copy độc lập
  }
}

// Trong test — đọc lên hiểu ngay test quan tâm cái gì:
// const paidOrder = new OrderBuilder().withStatus('paid').build();
// const bigOrder = new OrderBuilder()
//   .withItems([{ sku: 'X', qty: 100, price: 50_000 }])
//   .build();
```

### Use case thực tế trong backend

1. **Knex.js** — query builder nổi tiếng nhất hệ Node: `knex('users').where('age', '>', 18).orderBy('name').limit(10)` — mỗi call trả về builder, query chỉ thực thi khi `await` (thenable). Prisma/TypeORM query API cũng cùng tinh thần.
2. **Superagent/Supertest**: `request(app).post('/api/users').set('Authorization', token).send(payload).expect(201)` — HTTP request builder, gần như mọi integration test Node.js đều dùng.
3. **Test data builder / factory** — thư viện `fishery`, `@faker-js/faker` kết hợp builder để dựng fixture; trong dự án lớn đây là nơi builder pattern đáng giá nhất.

### Biến thể & cách triển khai khác

- **Immutable builder**: mỗi method trả về builder **mới** thay vì mutate (`return new QueryBuilder({...this.state, limit: n})`) — an toàn khi reuse builder gốc cho nhiều biến thể, đổi lại tốn allocation.
- **Staged/typestate builder**: dùng type system ép thứ tự bước — `createUser().withEmail(...)` trả về type mới mới có method `.save()` → quên bước bắt buộc là lỗi compile. Nâng cao, ghi điểm với interviewer thích TypeScript.
- **Director (GoF)**: class điều phối thứ tự gọi builder — trong JS gần như không ai dùng, một function nhận builder là đủ.

**So sánh với object literal + default params — khi nào builder là THỪA trong JS:**

```typescript
// Java cần builder vì không có named/optional params. JS thì CÓ:
function createServer({ port = 3000, host = '0.0.0.0', timeout = 30_000 } = {}) {
  /* ... */
}
createServer({ port: 8080 }); // rõ ràng, không cần builder!
```

Quy tắc thực dụng: **options object trước, builder sau**. Chỉ chuyển sang builder khi: (1) xây dần theo điều kiện runtime qua nhiều bước; (2) có invariant cần giữ giữa các field (như `total` theo `items`); (3) cần lazy execution (như Knex — build xong mới chạy); (4) cần API fluent cho DX (test, query). Nói được điều này trong phỏng vấn chứng tỏ bạn không áp pattern máy móc.

### ⚠️ Khi nào KHÔNG nên dùng / anti-pattern

- Object chỉ có vài field, không invariant, tạo một phát xong → dùng object literal + TS interface. Builder lúc này là boilerplate thuần.
- Builder mutable bị **reuse giữa các request** (vd cache builder làm "template") → các request làm bẩn state của nhau. Builder nên ngắn đời: tạo → build → vứt.
- Builder mà `build()` không validate gì → mất một nửa giá trị; `build()` là chốt chặn để đảm bảo object ra lò luôn hợp lệ.
- Nhầm builder với fluent interface nói chung: chainable setter không tự động là Builder; Builder có khái niệm **sản phẩm cuối** tách khỏi quá trình xây.

### 💬 Câu hỏi phỏng vấn liên quan

**Q1: JS có named parameters qua object destructuring — vậy Builder còn cần thiết không?**
A: Với object "phẳng" tạo một lần thì không — options object + defaults là đủ và idiomatic hơn. Builder vẫn đáng dùng khi: xây dần theo điều kiện runtime (query theo filter), cần giữ invariant giữa các field, cần lazy execution, hoặc làm test data builder. Knex là minh chứng: không thể viết query động bằng một object literal.

**Q2: Knex query builder hoạt động thế nào về mặt pattern?**
A: Mỗi method (`where`, `join`, `orderBy`) tích luỹ state vào builder và `return this` để chain. Query chỉ được compile thành SQL và thực thi khi builder bị `await` — Knex builder là thenable (có method `then`), nên `await` chính là bước "build + execute". Đây là Builder kết hợp lazy evaluation.

**Q3: Method chaining có nhược điểm gì?**
A: (1) Khó debug — cả chain là một expression, khó đặt breakpoint giữa chừng; (2) builder mutable chia sẻ nhầm sẽ gây side effect; (3) stack trace khó đọc hơn. Khắc phục: tách chain ra biến trung gian khi cần debug, hoặc dùng immutable builder.

---

## 5. Prototype

### Vấn đề nó giải quyết

Cần object mới **giống một object có sẵn** (clone) thay vì dựng lại từ đầu:

- Có một **config template** chuẩn, mỗi tenant/job cần một bản copy để chỉnh vài field — không được đụng vào bản gốc.
- Object **đắt để khởi tạo** (parse file lớn, tính toán nặng) → tạo một lần, các lần sau clone.
- Trong test: clone một fixture gốc cho mỗi test case để tránh test này làm bẩn data của test kia.

Điểm thú vị nhất khi phỏng vấn JS: **JavaScript bản chất LÀ ngôn ngữ prototype-based** — pattern này gần như "built-in".

### Cách triển khai trong Node.js/TypeScript

**Bản chất prototype chain của JS:**

```typescript
// JS không có class "thật" — `class` chỉ là syntax sugar trên prototype chain.
// Mỗi object có internal slot [[Prototype]] (truy cập qua Object.getPrototypeOf).
// Khi đọc obj.foo: tìm trên obj → không thấy → tìm lên [[Prototype]] → ... → null.

const baseHandler = {
  log(msg: string) { console.log(`[${(this as any).name}] ${msg}`); },
};

// Object.create: tạo object MỚI với [[Prototype]] trỏ tới baseHandler
const userHandler = Object.create(baseHandler);
userHandler.name = 'user';
userHandler.log('hello'); // "[user] hello" — log() được "thừa kế" qua prototype chain

// Đây chính là Prototype pattern theo nghĩa gốc: object mới sinh ra TỪ object mẫu,
// delegate hành vi về mẫu thay vì copy. class/extends của ES6 cũng chỉ là cái này.
```

**Clone trong thực tế — 3 cách và các bẫy (câu hỏi phỏng vấn rất hay gặp):**

```typescript
const original = {
  name: 'job-template',
  retry: { max: 3, backoffMs: 1000 },   // nested object
  tags: ['etl'],
  createdAt: new Date('2026-01-01'),
  run: () => console.log('running'),     // function
};

// ===== 1. Spread / Object.assign — SHALLOW clone =====
const shallow = { ...original };
shallow.retry.max = 99;
console.log(original.retry.max); // 99 — BẪY! nested object vẫn SHARE reference.
// Chỉ level 1 được copy; retry, tags là chung giữa 2 object.

// ===== 2. JSON.parse(JSON.stringify(...)) — deep nhưng ĐẦY BẪY =====
const jsonClone = JSON.parse(JSON.stringify(original));
// Bẫy: - Date → string ("2026-01-01T00:00:00.000Z"), KHÔNG còn là Date
//      - function, undefined, Symbol → BIẾN MẤT (jsonClone.run === undefined)
//      - Map/Set → {} rỗng;  BigInt → throw;  NaN/Infinity → null
//      - circular reference → throw "Converting circular structure to JSON"
//      - chậm (serialize + parse toàn bộ)

// ===== 3. structuredClone — deep clone CHUẨN (Node 17+) =====
const deep = structuredClone(original); // ❌ thực ra dòng này THROW!
// structuredClone xử lý đúng: Date, Map, Set, RegExp, ArrayBuffer, Buffer (TypedArray),
// circular reference. NHƯNG không clone được: function, class instance sẽ mất
// prototype/method (chỉ giữ own data properties), DOM nodes.
// → original có field `run` là function nên throw DataCloneError.

const { run, ...cloneable } = original;
const deepOk = structuredClone(cloneable); // OK
deepOk.retry.max = 99;
console.log(original.retry.max);  // 3 — độc lập thật sự
console.log(deepOk.createdAt instanceof Date); // true — Date được giữ đúng
```

**Prototype pattern "đúng bài" với method clone():**

```typescript
// Khi object có cả behavior + state, để chính nó biết cách tự clone
class JobConfig {
  constructor(
    public name: string,
    public retry: { max: number; backoffMs: number },
    public env: Map<string, string>,
  ) {}

  clone(overrides?: Partial<Pick<JobConfig, 'name'>>): JobConfig {
    return new JobConfig(
      overrides?.name ?? this.name,
      structuredClone(this.retry),  // deep copy phần data
      new Map(this.env),             // Map cần copy thủ công nếu muốn kiểm soát
    );
  }
}

const template = new JobConfig('base', { max: 3, backoffMs: 1000 }, new Map([['NODE_ENV', 'prod']]));
const emailJob = template.clone({ name: 'send-email' });
emailJob.retry.max = 5; // không ảnh hưởng template
// Ưu điểm clone() method so với structuredClone trực tiếp: GIỮ ĐƯỢC class methods,
// vì ta new lại instance thật — structuredClone trả về plain object mất prototype.
```

### Use case thực tế trong backend

1. **Config/job template**: hệ thống cron/worker có một config mẫu (retry policy, timeout, alert) — mỗi job clone từ template rồi override. BullMQ `defaultJobOptions` về tinh thần chính là prototype cho job options.
2. **Request context an toàn**: middleware clone default context cho mỗi request thay vì share object — tránh bug request A ghi đè data của request B (bug thật, rất khó trace).
3. **Object pool**: pool giữ một object "mẫu" đã khởi tạo đắt đỏ (vd parsed schema, compiled validator); khi cần instance mới thì clone nhanh từ mẫu thay vì parse lại.
4. **Test fixtures**: `structuredClone(baseFixture)` cho mỗi test case — chuẩn mực để test độc lập nhau.

### Biến thể & cách triển khai khác

| Cách | Loại | Khi dùng |
|---|---|---|
| `{ ...obj }` / `Object.assign({}, obj)` | Shallow | Object phẳng, hoặc cố ý share nested ref |
| `structuredClone(obj)` | Deep, chuẩn | Mặc định cho deep clone data (Node ≥17) |
| `JSON.parse(JSON.stringify(obj))` | Deep, lossy | Legacy; chỉ khi chắc chắn data là JSON thuần — nên tránh |
| `Object.create(proto)` | Delegation, không copy | Muốn "thừa kế" hành vi từ mẫu, không cần bản sao độc lập |
| Method `clone()` tự viết | Tuỳ chỉnh | Class instance cần giữ methods/prototype, hoặc cần copy chọn lọc (vd không copy connection) |
| `lodash.cloneDeep` | Deep | Cần clone cả khi có function/class instance phức tạp |

- Lưu ý hiệu năng: deep clone object lớn trong hot path là tốn kém — cân nhắc immutable data (chỉ tạo phần thay đổi, share phần còn lại — cách của Immer/Redux) thay vì clone toàn bộ.

### ⚠️ Khi nào KHÔNG nên dùng / anti-pattern

- **Dùng shallow clone khi cần deep** — nguồn bug số 1: `{ ...config }` rồi sửa `config.retry.max` làm hỏng template gốc, lỗi chỉ lộ ra ở... chỗ khác, lúc khác.
- **`JSON.parse(JSON.stringify())` cho object có Date/Map/function** — mất data âm thầm, không có lỗi nào báo. Từ Node 17 hãy mặc định `structuredClone`.
- **structuredClone cho class instance** — trả về plain object mất hết method (`clone instanceof MyClass === false`); với class hãy viết `clone()` riêng.
- **Sửa prototype của built-in** (`Array.prototype.myMethod = ...`) — monkey-patching toàn cục, xung đột thư viện. Liên quan: **prototype pollution** — lỗ hổng bảo mật khi merge user input vào object cho phép ghi đè `__proto__` (đã xảy ra với lodash.merge các bản cũ); luôn validate/chặn key `__proto__`, `constructor`, `prototype` khi deep merge input.
- Clone khi thực ra nên dùng factory: nếu "bản mẫu" chẳng có gì đắt đỏ, `createConfig()` mới mỗi lần rõ ràng hơn clone.

### 💬 Câu hỏi phỏng vấn liên quan

**Q1: So sánh spread operator, JSON.parse/stringify và structuredClone để clone object?**
A: Spread là shallow — chỉ copy level 1, nested object share reference. JSON roundtrip là deep nhưng lossy: mất function/undefined/Symbol, Date thành string, Map/Set thành `{}`, throw với circular ref và BigInt. `structuredClone` (Node 17+) là deep clone chuẩn: giữ Date/Map/Set/Buffer/circular ref, nhưng throw với function và làm mất prototype của class instance. Mặc định hiện đại: `structuredClone` cho data, `clone()` method tự viết cho class instance.

**Q2: Prototype chain trong JS bản chất là gì? Liên quan gì đến Prototype pattern?**
A: Mỗi object có slot `[[Prototype]]` trỏ tới object khác; khi truy cập property không có trên object, engine tìm ngược lên chain tới khi gặp `null`. `class`/`extends` chỉ là syntax sugar — method nằm trên `MyClass.prototype` và instance delegate tới đó. Tức là JS hiện thực "kế thừa" bằng chính cơ chế delegation của Prototype pattern: object mới (`Object.create(mẫu)`) dùng object mẫu làm nguồn hành vi, thay vì copy từ class blueprint như Java.

**Q3: Prototype pollution là gì và phòng tránh thế nào?**
A: Là lỗ hổng khi code deep-merge dữ liệu user-controlled vào object: payload chứa key `__proto__` (vd `{"__proto__": {"isAdmin": true}}`) sẽ ghi lên `Object.prototype`, ảnh hưởng MỌI object trong app → bypass auth, DoS, có thể RCE. Phòng tránh: chặn các key `__proto__`/`constructor`/`prototype` khi merge, dùng `Object.create(null)` cho dictionary, update các lib merge (lodash cũ từng dính), hoặc `Object.freeze(Object.prototype)`.

---

## 📋 Bảng tóm tắt

| Pattern | Vấn đề giải quyết (1 dòng) | Triển khai JS idiomatic (1 dòng) |
|---|---|---|
| **Singleton** | Toàn app chỉ cần đúng 1 instance của resource đắt đỏ/chia sẻ (DB pool, config, logger) | `export const x = new X()` — module caching của Node.js là singleton sẵn có; app lớn thì để DI container quản lifecycle; nhớ: mỗi process/pod là một instance riêng |
| **Factory Method / Simple Factory** | Tách logic "tạo cái gì lúc runtime" khỏi business code (payment provider theo loại) | Factory function + `Record<Type, () => Impl>` registry; cũng là lời giải cho async initialization mà constructor không làm được |
| **Abstract Factory** | Tạo trọn HỌ object liên quan, đảm bảo không trộn hệ (AWS: S3+SQS+Secrets đi cùng nhau) | Object literal chứa các factory function cho mỗi provider, chọn 1 lần ở composition root; đa số dự án Node không cần — đừng over-engineer |
| **Builder** | Xây object phức tạp từng bước, theo điều kiện runtime, có invariant (query động, test fixture) | Class với method `return this` (chaining) + `build()` validate; object phẳng thì options object + default params là đủ, builder là thừa |
| **Prototype** | Tạo object mới từ object mẫu thay vì dựng lại từ đầu (config template, test fixture) | `structuredClone()` cho data, `clone()` method cho class instance, `Object.create()` khi muốn delegation; cảnh giác shallow-vs-deep và prototype pollution |

---

> **Phần tiếp theo**: `02-structural-patterns.md` — Adapter, Decorator, Proxy, Facade, Composite trong Node.js (middleware chính là Decorator/Chain, ORM lazy loading chính là Proxy...).
