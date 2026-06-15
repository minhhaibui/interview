# Design Patterns — Phần 2: Structural Patterns (Nhóm cấu trúc)

> **Structural patterns** trả lời câu hỏi: *"Làm sao để lắp ghép các object/class lại với nhau thành cấu trúc lớn hơn mà vẫn giữ tính linh hoạt?"*
>
> Trong Node.js, nhóm này xuất hiện **dày đặc nhất** trong code thực tế: middleware, ORM, SDK client, service layer... đều là structural patterns. Đây cũng là nhóm hay bị hỏi nhất trong phỏng vấn senior vì dễ gắn với kinh nghiệm dự án thật.

---

## Mục lục

1. [Adapter](#1-adapter)
2. [Decorator](#2-decorator)
3. [Proxy](#3-proxy)
4. [Facade](#4-facade)
5. [Composite](#5-composite)
6. [Bridge](#6-bridge)
7. [Flyweight](#7-flyweight)
8. [📋 Bảng tóm tắt](#-bảng-tóm-tắt)
9. [🔍 Nhận diện pattern trong code có sẵn](#-nhận-diện-pattern-trong-code-có-sẵn)

---

## 1. Adapter

### Vấn đề nó giải quyết

Tình huống kinh điển: dự án của bạn đang dùng Stripe để thanh toán. Sếp yêu cầu thêm PayPal cho thị trường mới. Hai SDK này có API **hoàn toàn khác nhau**:

- Stripe: `stripe.paymentIntents.create({ amount, currency })` — amount tính bằng **cent**.
- PayPal: `ordersController.ordersCreate({ body: { purchase_units: [...] } })` — amount là **string thập phân**.

Nếu bạn rải `if (provider === 'stripe')` khắp service layer, thì khi thêm gateway thứ 3 (VNPay, MoMo...) bạn phải sửa N chỗ. Adapter giải quyết bằng cách: **định nghĩa 1 interface chung do bạn sở hữu**, rồi viết mỗi adapter "dịch" interface đó sang API của từng SDK.

Tình huống thứ hai rất hay gặp: **migrate thư viện**. Ví dụ đổi từ `request` (deprecated) sang `axios`/`fetch`, hoặc từ `moment` sang `dayjs`. Nếu code gọi thư viện qua một adapter của riêng bạn, việc migrate chỉ là viết 1 adapter mới — không phải sửa 200 file.

### Cách triển khai trong Node.js/TypeScript

```typescript
// payment/types.ts — interface chung DO BẠN SỞ HỮU (đây là điểm mấu chốt)
export interface PaymentResult {
  transactionId: string;
  status: 'succeeded' | 'pending' | 'failed';
  raw?: unknown; // giữ response gốc để debug
}

export interface PaymentGateway {
  charge(amountInCents: number, currency: string, customerId: string): Promise<PaymentResult>;
  refund(transactionId: string, amountInCents?: number): Promise<PaymentResult>;
}

// payment/stripe.adapter.ts
import Stripe from 'stripe';
import { PaymentGateway, PaymentResult } from './types';

export class StripeAdapter implements PaymentGateway {
  private stripe: Stripe;

  constructor(apiKey: string) {
    this.stripe = new Stripe(apiKey);
  }

  async charge(amountInCents: number, currency: string, customerId: string): Promise<PaymentResult> {
    // Stripe nhận amount bằng cent — khớp luôn với interface của ta
    const intent = await this.stripe.paymentIntents.create({
      amount: amountInCents,
      currency,
      customer: customerId,
      confirm: true,
    });
    return {
      transactionId: intent.id,
      // "Dịch" status của Stripe sang status chung
      status: intent.status === 'succeeded' ? 'succeeded'
            : intent.status === 'processing' ? 'pending'
            : 'failed',
      raw: intent,
    };
  }

  async refund(transactionId: string, amountInCents?: number): Promise<PaymentResult> {
    const refund = await this.stripe.refunds.create({
      payment_intent: transactionId,
      amount: amountInCents,
    });
    return { transactionId: refund.id, status: refund.status === 'succeeded' ? 'succeeded' : 'pending', raw: refund };
  }
}

// payment/paypal.adapter.ts
import { PaymentGateway, PaymentResult } from './types';

// Giả lập SDK PayPal (API thật phức tạp hơn nhưng cùng tinh thần)
interface PayPalClient {
  createOrder(body: { amount: string; currencyCode: string }): Promise<{ id: string; status: string }>;
  refundCapture(captureId: string, amount?: string): Promise<{ id: string; status: string }>;
}

export class PayPalAdapter implements PaymentGateway {
  constructor(private client: PayPalClient) {}

  async charge(amountInCents: number, currency: string, _customerId: string): Promise<PaymentResult> {
    // ĐÂY là việc của adapter: chuyển đổi đơn vị/format giữa 2 thế giới
    const order = await this.client.createOrder({
      amount: (amountInCents / 100).toFixed(2), // cent -> string "10.00"
      currencyCode: currency.toUpperCase(),
    });
    return {
      transactionId: order.id,
      status: order.status === 'COMPLETED' ? 'succeeded' : 'pending',
      raw: order,
    };
  }

  async refund(transactionId: string, amountInCents?: number): Promise<PaymentResult> {
    const r = await this.client.refundCapture(
      transactionId,
      amountInCents ? (amountInCents / 100).toFixed(2) : undefined,
    );
    return { transactionId: r.id, status: r.status === 'COMPLETED' ? 'succeeded' : 'pending', raw: r };
  }
}

// checkout.service.ts — KHÔNG biết gì về Stripe hay PayPal
export class CheckoutService {
  constructor(private gateway: PaymentGateway) {} // inject adapter qua constructor

  async pay(orderId: string, amountInCents: number, customerId: string) {
    const result = await this.gateway.charge(amountInCents, 'usd', customerId);
    if (result.status === 'failed') {
      throw new Error(`Payment failed for order ${orderId}`);
    }
    return result;
  }
}

// Composition root — quyết định adapter nào ở 1 chỗ duy nhất
const gateway: PaymentGateway =
  process.env.PAYMENT_PROVIDER === 'paypal'
    ? new PayPalAdapter(paypalClient)
    : new StripeAdapter(process.env.STRIPE_KEY!);

const checkout = new CheckoutService(gateway);
```

Một ví dụ adapter dạng **function** (idiomatic JS hơn) cho logging — wrap `pino` và `winston` về cùng 1 interface:

```typescript
interface Logger {
  info(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

// pino: log.info(meta, msg) — meta đứng TRƯỚC
const pinoAdapter = (pino: import('pino').Logger): Logger => ({
  info: (msg, meta) => pino.info(meta ?? {}, msg),
  error: (msg, meta) => pino.error(meta ?? {}, msg),
});

// winston: log.info(msg, meta) — meta đứng SAU
const winstonAdapter = (winston: import('winston').Logger): Logger => ({
  info: (msg, meta) => winston.info(msg, meta),
  error: (msg, meta) => winston.error(msg, meta),
});
```

### Use case thực tế trong backend

1. **ORM/Query builder**: Knex, TypeORM, Sequelize đều có "dialect/driver adapters" — cùng 1 API `knex('users').where(...)` nhưng bên dưới là adapter cho `pg`, `mysql2`, `sqlite3`, mỗi driver có API hoàn toàn khác nhau.
2. **Multi-provider integration**: payment (Stripe/PayPal/VNPay), SMS (Twilio/SNS/eSMS), storage (S3/GCS/local disk — thư viện `flydrive`, hay `multer` storage engines chính là adapter), email (SES/SendGrid/Mailgun — `nodemailer` transports).
3. **Migrate thư viện an toàn**: team lớn thường wrap HTTP client (`axios` → `undici`/`fetch`) sau 1 interface `HttpClient` riêng. Khi `request` bị deprecated năm 2020, các codebase có adapter chỉ sửa 1 file; codebase gọi trực tiếp phải sửa hàng trăm chỗ.

### Biến thể & cách triển khai khác

- **Object adapter (composition)** — như ví dụ trên, adapter *chứa* adaptee. Đây là cách chuẩn trong JS/TS.
- **Class adapter (inheritance)** — adapter *kế thừa* adaptee. Hiếm dùng trong JS vì single inheritance và vì composition luôn linh hoạt hơn.
- **Function adapter** — trong JS, một adapter có thể chỉ là 1 hàm hoặc object literal (như ví dụ logger). Không cần class.
- **Two-way adapter** — adapter implement cả 2 interface, dùng trong giai đoạn chuyển tiếp khi 2 hệ thống còn gọi lẫn nhau.

### ⚠️ Khi nào KHÔNG nên dùng / anti-pattern

- **Chỉ có 1 implementation và không có kế hoạch thêm cái thứ 2**: viết adapter "cho tương lai" là YAGNI. Interface chung đoán trước thường đoán sai — đợi đến khi có provider thứ 2 rồi mới trừu tượng hóa.
- **Interface chung bị "leak" chi tiết của 1 provider**: nếu `PaymentGateway` có field `stripeCustomerId` thì adapter vô nghĩa — bạn vẫn bị lock-in.
- **Adapter chồng adapter**: wrap 3-4 tầng làm stack trace khó đọc, debug khổ. Nếu thấy `XAdapterWrapper` wrap `XAdapter` wrap `XClient`, hãy gộp lại.
- Đừng adapter hóa **mọi** dependency — `lodash` hay `zod` thì gọi trực tiếp, chỉ adapter hóa dependency ở **boundary** (I/O, external service).

### 💬 Câu hỏi phỏng vấn liên quan

**Q: Adapter khác Facade thế nào? Cả hai đều "wrap" thứ khác mà?**
A: Khác về *mục đích*. Adapter chuyển interface **có sẵn** này sang interface **được mong đợi** khác (thường để 2 thứ không tương thích làm việc được với nhau, interface đích đã được định trước). Facade tạo interface **mới, đơn giản hơn** che một hệ thống con phức tạp — không có yêu cầu "phải khớp interface nào". Adapter = dịch thuật; Facade = đơn giản hóa.

**Q: Trong dự án thật, khi tích hợp payment gateway thứ 2, anh/chị thiết kế thế nào?**
A: Định nghĩa interface `PaymentGateway` thuộc sở hữu của domain mình (không copy shape của Stripe), viết adapter cho từng provider, inject qua DI/factory dựa trên config. Quan trọng nhất: chuẩn hóa đơn vị tiền (cent vs decimal), error/status mapping, và idempotency key — đó là chỗ adapter thật sự "kiếm cơm".

**Q: Adapter có làm giảm performance không?**
A: Một lớp gọi hàm gián tiếp là không đáng kể (nanoseconds) so với I/O network (milliseconds). Cái cần cân nhắc không phải perf mà là độ phức tạp nhận thức — đừng wrap khi không cần.

---

## 2. Decorator

### Vấn đề nó giải quyết

Bạn có hàm `getUserById(id)` gọi DB. Giờ cần thêm: caching, logging thời gian thực thi, retry khi lỗi mạng. Cách dở: nhét tất cả vào trong hàm → hàm 100 dòng, logic nghiệp vụ chìm trong boilerplate, không tái sử dụng được cho hàm khác. Cách dở khác: kế thừa (`CachedUserService extends UserService`) → muốn cache + retry + log thì phải tạo `CachedRetriedLoggedUserService`? Class explosion.

Decorator giải quyết: **wrap object/function bằng một lớp vỏ cùng interface, thêm behavior trước/sau khi delegate xuống bản gốc**. Các lớp vỏ stack lên nhau tùy ý, code gốc không đổi 1 dòng.

Điểm đặc biệt trong JS: vì function là first-class citizen, **higher-order function (HOF) chính là decorator pattern** — không cần class.

### Cách triển khai trong Node.js/TypeScript

**Cách 1 — Higher-order function (idiomatic nhất trong Node.js):**

```typescript
type AsyncFn<A extends unknown[], R> = (...args: A) => Promise<R>;

// Decorator 1: logging + đo thời gian
function withTiming<A extends unknown[], R>(name: string, fn: AsyncFn<A, R>): AsyncFn<A, R> {
  return async (...args) => {
    const start = performance.now();
    try {
      return await fn(...args); // delegate xuống hàm gốc
    } finally {
      console.log(`[${name}] took ${(performance.now() - start).toFixed(1)}ms`);
    }
  };
}

// Decorator 2: retry với exponential backoff
function withRetry<A extends unknown[], R>(
  fn: AsyncFn<A, R>,
  { retries = 3, baseDelayMs = 100 } = {},
): AsyncFn<A, R> {
  return async (...args) => {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn(...args);
      } catch (err) {
        lastErr = err;
        if (attempt < retries) {
          // backoff: 100ms, 200ms, 400ms...
          await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt));
        }
      }
    }
    throw lastErr;
  };
}

// Decorator 3: cache in-memory với TTL
function withCache<A extends unknown[], R>(
  fn: AsyncFn<A, R>,
  { ttlMs = 60_000, keyFn = (...args: A) => JSON.stringify(args) } = {},
): AsyncFn<A, R> {
  const cache = new Map<string, { value: R; expiresAt: number }>();
  return async (...args) => {
    const key = keyFn(...args);
    const hit = cache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value;
    const value = await fn(...args);
    cache.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  };
}

// --- Sử dụng: stack các decorator lên nhau, hàm gốc không đổi ---
async function getUserById(id: string): Promise<{ id: string; name: string }> {
  // gọi DB thật ở đây
  return { id, name: 'Linh' };
}

// Thứ tự wrap QUAN TRỌNG: cache ngoài cùng -> cache hit thì không retry, không log DB call
const getUser = withCache(withTiming('getUserById', withRetry(getUserById)));

await getUser('42'); // miss -> retry-able DB call, có log timing
await getUser('42'); // hit  -> trả từ cache ngay
```

**Cách 2 — Class-based decorator (GoF cổ điển), hữu ích khi decorate cả object nhiều method:**

```typescript
interface UserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

class PostgresUserRepository implements UserRepository {
  async findById(id: string) { /* SELECT ... */ return null; }
  async save(user: User) { /* INSERT ... */ }
}

// Decorator: cùng interface, chứa 1 instance bên trong (composition)
class LoggedUserRepository implements UserRepository {
  constructor(private inner: UserRepository, private logger: Logger) {}

  async findById(id: string) {
    this.logger.info('findById called', { id });
    return this.inner.findById(id); // delegate
  }

  async save(user: User) {
    this.logger.info('save called', { id: user.id });
    return this.inner.save(user);
  }
}

// Stack: repo có cả cache lẫn log, PostgresUserRepository không biết gì
const repo: UserRepository = new LoggedUserRepository(
  new CachedUserRepository(new PostgresUserRepository(), redis),
  logger,
);
```

**Cách 3 — TypeScript method decorator (syntax `@`):**

```typescript
// Method decorator chuẩn TC39 (TS 5.x, không cần experimentalDecorators)
function measure<This, Args extends unknown[], Return>(
  target: (this: This, ...args: Args) => Promise<Return>,
  context: ClassMethodDecoratorContext<This>,
) {
  const methodName = String(context.name);
  // Trả về hàm MỚI thay thế method gốc — bản chất vẫn là wrap function
  return async function (this: This, ...args: Args): Promise<Return> {
    const start = performance.now();
    try {
      return await target.call(this, ...args);
    } finally {
      console.log(`${methodName}: ${(performance.now() - start).toFixed(1)}ms`);
    }
  };
}

class ReportService {
  @measure
  async generateMonthlyReport(month: string) {
    // logic nặng...
    return { month, rows: 1000 };
  }
}
```

**Phân biệt quan trọng (hay bị hỏi):** *Decorator pattern* (GoF) và *TypeScript decorator syntax* không đồng nhất:

- **Decorator pattern**: wrap object **lúc runtime**, cùng interface, stack tự do, áp lên *instance*.
- **TS `@decorator`**: là **metaprogramming syntax** chạy **lúc class được define**, có thể làm decorator pattern (wrap method như trên) nhưng cũng có thể làm việc hoàn toàn khác — gắn **metadata**. `@Injectable()`, `@Get('/users')` của NestJS **không wrap behavior gì cả**: chúng ghi metadata (qua `reflect-metadata` / `Reflect.defineMetadata`) lên class/method, để lúc bootstrap NestJS đọc metadata đó và xây routing table + DI container. Đó là *annotation*, không phải decorator pattern.

### Use case thực tế trong backend

1. **Express/Koa middleware** về bản chất là chuỗi decorator quanh request handler: mỗi middleware thêm behavior (auth, logging, body parsing) rồi `next()` xuống tầng trong.
2. **Thư viện resilience**: `cockatiel`, `opossum` (circuit breaker) — bạn đưa hàm vào, nhận về hàm đã được wrap với retry/timeout/circuit-breaker. `p-retry`, `p-memoize`, `p-throttle` của Sindre Sorhus đều là function decorator thuần.
3. **NestJS Interceptors** (`@UseInterceptors(CacheInterceptor)`) — đúng decorator pattern runtime: wrap handler, thêm caching/logging/transform response.
4. Trong dự án: wrap repository với cache layer, wrap external API client với rate-limiter, wrap event handler với dead-letter logic.

### Biến thể & cách triển khai khác

- **HOF** — mặc định trong Node.js, dùng cho function đơn lẻ.
- **Class decorator (composition + delegate)** — khi decorate object nhiều method, nhược điểm là phải delegate mọi method (boilerplate). Có thể giảm boilerplate bằng `Proxy` (xem pattern 3).
- **TS `@decorator`** — đẹp cho cross-cutting concern theo style framework (NestJS), nhưng gắn cứng vào class definition, khó bật/tắt per-instance.
- **Monkey-patching** (`obj.method = wrap(obj.method)`) — kỹ thuật của APM agents (Datadog `dd-trace`, New Relic patch `http`, `pg`, `express` lúc runtime). Hiệu quả nhưng nguy hiểm nếu tự làm bừa — chỉ nên để instrumentation library làm.

### ⚠️ Khi nào KHÔNG nên dùng / anti-pattern

- **Stack quá sâu**: 5-6 lớp decorator làm stack trace dài, debug "behavior này từ lớp nào ra?" rất mệt. Cân nhắc gộp hoặc dùng pipeline tường minh.
- **Decorator có thứ tự ngầm phụ thuộc nhau** (cache phải ngoài retry, auth phải trước log PII...) mà không document — bom nổ chậm cho người sau.
- **Decorator thay đổi contract**: decorator phải **giữ nguyên interface và semantics**. Nếu lớp wrap nuốt error hoặc đổi shape kết quả, đó không còn là decorator mà là bug machine.
- Cẩn thận decorator stateful (cache trong closure như `withCache` ở trên): mỗi lần gọi `withCache(fn)` tạo cache **mới** — gọi nhầm trong request handler là cache vô dụng + memory leak.

### 💬 Câu hỏi phỏng vấn liên quan

**Q: `@Injectable()` của NestJS có phải decorator pattern không?**
A: Không. Nó dùng *decorator syntax* của TS nhưng mục đích là gắn metadata cho DI container đọc lúc bootstrap (annotation/metaprogramming). Decorator pattern đúng nghĩa trong NestJS là Interceptor — wrap handler lúc runtime để thêm behavior. Phân biệt được 2 cái này là điểm cộng lớn.

**Q: Decorator khác Proxy pattern thế nào?**
A: Cấu trúc gần giống nhau (wrap + cùng interface), khác *ý đồ*: Decorator để **thêm/cộng dồn behavior** và thường stack nhiều lớp do client chủ động lắp; Proxy để **kiểm soát truy cập** (lazy, cache, permission) và thường giấu kín — client tưởng đang làm việc với object thật.

**Q: Thứ tự decorator có quan trọng không? Cho ví dụ.**
A: Rất quan trọng. `withCache(withRetry(fn))`: cache hit thì không tốn retry. Ngược lại `withRetry(withCache(fn))`: nếu cache layer lỗi (Redis down) thì retry cả cache. Tương tự middleware: auth phải đứng trước handler ghi log dữ liệu nhạy cảm.

---

## 3. Proxy

### Vấn đề nó giải quyết

Bạn muốn **đứng chắn giữa client và object thật** để kiểm soát việc truy cập: chặn lại kiểm tra quyền, trả từ cache thay vì gọi DB, trì hoãn việc khởi tạo object đắt đỏ đến khi thật sự cần, hay đơn giản là ghi log mọi truy cập. Client **không cần biết** nó đang nói chuyện với proxy — interface y hệt object thật.

Ví dụ cụ thể: repository gọi PostgreSQL. 80% request đọc cùng 1 nhóm dữ liệu nóng. Thay vì sửa repository (vi phạm single responsibility), bạn đặt một **caching proxy** trước nó: check Redis trước, miss mới gọi DB.

JavaScript có vũ khí riêng: **`Proxy` object built-in** cho phép trap mọi thao tác (`get`, `set`, `has`, `deleteProperty`, `apply`...) — biến việc viết proxy generic thành vài chục dòng thay vì delegate thủ công từng method.

### Cách triển khai trong Node.js/TypeScript

**Cách 1 — Caching proxy cho repository (class, tường minh):**

```typescript
interface ProductRepository {
  findById(id: string): Promise<Product | null>;
  update(id: string, data: Partial<Product>): Promise<void>;
}

class CachingProductRepository implements ProductRepository {
  constructor(
    private real: ProductRepository,   // object thật
    private redis: RedisLike,          // cache store
    private ttlSeconds = 300,
  ) {}

  async findById(id: string): Promise<Product | null> {
    const key = `product:${id}`;
    // 1. Check cache trước
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached) as Product;

    // 2. Miss -> gọi object thật
    const product = await this.real.findById(id);

    // 3. Ghi cache (chỉ cache khi có dữ liệu, tránh cache null vĩnh viễn)
    if (product) await this.redis.set(key, JSON.stringify(product), 'EX', this.ttlSeconds);
    return product;
  }

  async update(id: string, data: Partial<Product>): Promise<void> {
    await this.real.update(id, data);
    // Invalidate cache khi ghi — phần khó nhất của caching proxy
    await this.redis.del(`product:${id}`);
  }
}

// Wiring — service layer không biết có cache
const repo: ProductRepository = new CachingProductRepository(new PgProductRepository(pool), redis);
```

**Cách 2 — JS `Proxy` object, viết proxy GENERIC (trap `get`):**

```typescript
// Logging proxy cho BẤT KỲ object nào — không cần delegate thủ công từng method
function withCallLogging<T extends object>(target: T, name: string): T {
  return new Proxy(target, {
    get(obj, prop, receiver) {
      const value = Reflect.get(obj, prop, receiver);
      if (typeof value !== 'function') return value;
      // Trả về hàm wrap — trap "get" bắt được MỌI lần truy cập property
      return (...args: unknown[]) => {
        console.log(`${name}.${String(prop)}(${JSON.stringify(args)})`);
        return value.apply(obj, args);
      };
    },
  });
}

// Validation proxy: chặn set giá trị không hợp lệ
function validated<T extends object>(target: T, rules: Partial<Record<keyof T, (v: unknown) => boolean>>): T {
  return new Proxy(target, {
    set(obj, prop, value, receiver) {
      const rule = rules[prop as keyof T];
      if (rule && !rule(value)) {
        throw new TypeError(`Invalid value for "${String(prop)}": ${JSON.stringify(value)}`);
      }
      return Reflect.set(obj, prop, value, receiver);
    },
  });
}

const order = validated({ quantity: 1, email: '' }, {
  quantity: (v) => typeof v === 'number' && v > 0,
  email: (v) => typeof v === 'string' && v.includes('@'),
});

order.quantity = 5;    // OK
// order.quantity = -1; // TypeError: Invalid value for "quantity": -1
```

**Cách 3 — Lazy initialization (virtual proxy):**

```typescript
// Object đắt đỏ (mở connection, load model ML...) chỉ được tạo khi đụng tới lần đầu
function lazy<T extends object>(factory: () => T): T {
  let instance: T | undefined;
  return new Proxy({} as T, {
    get(_, prop, receiver) {
      instance ??= factory(); // khởi tạo đúng 1 lần, đúng lúc cần
      return Reflect.get(instance, prop, receiver);
    },
  });
}

const heavyClient = lazy(() => {
  console.log('Expensive init runs NOW');
  return new BigQueryClient({ keyFilename: '...' });
});
// Chưa init gì cả... đến dòng dưới mới chạy factory:
// await heavyClient.query('SELECT 1');
```

### Use case thực tế trong backend

1. **ORM lazy relations**: Sequelize/TypeORM/MikroORM trả về entity mà relation (`user.posts`) chưa load — MikroORM dùng đúng cơ chế proxy/reference: chạm vào relation mới phát query (virtual proxy). Mongoose document cũng dùng getter/setter tracking để biết field nào dirty.
2. **`http-proxy-middleware` / API Gateway / Nginx reverse proxy**: proxy pattern ở tầng kiến trúc — client gọi gateway như gọi service thật, gateway chặn lại để làm auth, rate-limit, routing, caching. Khi phỏng vấn system design, nói được "API Gateway là Proxy pattern ở architecture level" là điểm cộng.
3. **Vue 3 reactivity / MobX**: dùng `Proxy` trap get/set để track dependency — không phải backend nhưng là ví dụ nổi tiếng nhất của JS `Proxy`.
4. Trong dự án: caching proxy trước repository, ACL proxy (`if (!user.can('read')) throw Forbidden`) trước service, mock/stub trong test (sinon stub về bản chất là proxy).

### Biến thể & cách triển khai khác

- **Virtual proxy** — lazy init object đắt đỏ (Cách 3).
- **Protection proxy** — kiểm tra quyền trước khi delegate.
- **Caching proxy** — Cách 1.
- **Remote proxy** — object local đại diện cho service ở xa: gRPC client stub là remote proxy chuẩn sách giáo khoa (gọi `client.getUser()` như hàm local, bên dưới là network call).
- Triển khai bằng: class delegate thủ công (tường minh, type-safe tốt) vs JS `Proxy` (generic, mạnh, nhưng khó type chính xác và khó debug hơn). Lưu ý JS `Proxy` có overhead per-access — không đặt trong hot path triệu ops/giây.

### ⚠️ Khi nào KHÔNG nên dùng / anti-pattern

- **JS `Proxy` trong hot path**: mỗi property access đều đi qua trap → chậm hơn truy cập thường đáng kể. Đo trước khi dùng trong code chạy hàng triệu lần/giây.
- **Proxy "ma thuật" quá mức**: trap `get` để tự sinh method (`db.findUserByEmailAndStatus(...)` kiểu magic) làm code không thể grep, không thể autocomplete, đồng nghiệp mới đọc không hiểu. Magic phải có giới hạn.
- **Caching proxy không có chiến lược invalidation**: cache mà không invalidate khi write là nguồn bug "dữ liệu cũ" kinh điển. Nếu chưa trả lời được câu "khi nào cache sai?", đừng thêm caching proxy.
- Proxy che giấu I/O (lazy relation của ORM) dễ gây **N+1 query** — vòng lặp chạm `user.posts` cho 100 user = 100 query mà code nhìn vô hại.

### 💬 Câu hỏi phỏng vấn liên quan

**Q: JS `Proxy` object và Proxy pattern có phải là một không?**
A: `Proxy` object là *công cụ ngôn ngữ* (meta-programming, trap operations); Proxy pattern là *ý đồ thiết kế* (kiểm soát truy cập object thật qua một đại diện cùng interface). Dùng `Proxy` object là một cách triển khai Proxy pattern rất gọn, nhưng cũng có thể triển khai pattern bằng class thường; ngược lại `Proxy` object còn dùng cho việc khác (reactivity, mocking).

**Q: Lazy relation của ORM dùng proxy — lợi và hại?**
A: Lợi: không load cả object graph, tiết kiệm memory/query khi không cần. Hại: I/O bị giấu — gây N+1 query, và lỗi "tried to access relation outside of transaction/context". Thực chiến: với list endpoint, luôn eager-load (`join`/`populate`) các relation chắc chắn dùng.

**Q: Decorator và Proxy nhìn code giống hệt nhau, phân biệt sao trong code review?**
A: Nhìn ý đồ và cách lắp: Decorator do client lắp công khai, có thể stack nhiều lớp, mục đích *thêm* tính năng. Proxy thường lắp ở composition root/framework, một lớp, mục đích *kiểm soát* (access, lifecycle, vị trí của object thật), client không biết sự tồn tại của nó.

---

## 4. Facade

### Vấn đề nó giải quyết

Đặt hàng e-commerce thật sự gồm: validate giỏ hàng, check tồn kho, tính giá + khuyến mãi, charge payment, tạo order record, trừ kho, gửi email, bắn event analytics. Nếu controller phải gọi đủ 8 bước này thì: controller phình to, mọi nơi khác cần "đặt hàng" (admin panel, API mobile, cronjob retry) phải copy 8 bước, và sửa flow là sửa N chỗ.

Facade giải quyết: tạo **một interface đơn giản** (`placeOrder(cart, userId)`) che toàn bộ sự phức tạp của các subsystem. Client chỉ cần biết 1 method; chi tiết điều phối nằm sau facade.

Trong backend Node.js, **service layer chính là facade** — đây là pattern bạn gần như chắc chắn đã dùng dù không gọi tên nó.

### Cách triển khai trong Node.js/TypeScript

```typescript
// --- Các subsystem phức tạp, mỗi cái 1 trách nhiệm ---
class InventoryService {
  async reserve(items: CartItem[]): Promise<ReservationId> { /* ... */ return 'rsv_1'; }
  async release(reservationId: ReservationId): Promise<void> { /* ... */ }
}

class PricingService {
  async calculate(items: CartItem[], couponCode?: string): Promise<{ totalCents: number }> {
    /* tính giá, áp coupon, thuế... */ return { totalCents: 50_000 };
  }
}

class OrderRepository {
  async create(data: { userId: string; items: CartItem[]; totalCents: number }): Promise<Order> {
    /* INSERT ... */ return { id: 'ord_1', ...data, status: 'paid' };
  }
}

class NotificationService {
  async sendOrderConfirmation(userId: string, order: Order): Promise<void> { /* ... */ }
}

// --- FACADE: một cửa duy nhất cho use case "đặt hàng" ---
export class CheckoutFacade {
  constructor(
    private inventory: InventoryService,
    private pricing: PricingService,
    private payment: PaymentGateway,      // tái dùng adapter từ pattern 1!
    private orders: OrderRepository,
    private notifications: NotificationService,
  ) {}

  /** Toàn bộ flow đặt hàng sau MỘT method. Controller không biết gì về subsystem. */
  async placeOrder(userId: string, items: CartItem[], couponCode?: string): Promise<Order> {
    // 1. Giữ hàng trong kho
    const reservationId = await this.inventory.reserve(items);

    try {
      // 2. Tính tiền
      const { totalCents } = await this.pricing.calculate(items, couponCode);

      // 3. Thanh toán
      const payment = await this.payment.charge(totalCents, 'usd', userId);
      if (payment.status === 'failed') throw new Error('Payment declined');

      // 4. Ghi order
      const order = await this.orders.create({ userId, items, totalCents });

      // 5. Side effects — không chặn response, lỗi không làm fail order
      this.notifications.sendOrderConfirmation(userId, order).catch((err) =>
        console.error('confirmation email failed', err),
      );

      return order;
    } catch (err) {
      // Compensation: nhả hàng đã giữ — facade là nơi điều phối rollback
      await this.inventory.release(reservationId);
      throw err;
    }
  }
}

// --- Controller giờ mỏng dính ---
app.post('/checkout', async (req, res) => {
  const order = await checkoutFacade.placeOrder(req.user.id, req.body.items, req.body.coupon);
  res.status(201).json(order);
});
```

Lưu ý quan trọng: **facade không độc quyền** — client vẫn được phép gọi thẳng subsystem khi cần thao tác chi tiết (vd: admin gọi `inventory.release` trực tiếp). Facade là "lối đi thuận tiện", không phải bức tường.

### Use case thực tế trong backend

1. **SDK clients**: `stripe-node`, `@aws-sdk/client-s3`, `octokit` — bạn gọi `s3.send(new PutObjectCommand(...))` mà không cần biết signing request (SigV4), retry, pagination, serialization. Cả SDK là facade khổng lồ che REST API.
2. **Mongoose/Prisma ở mặt tiền**: `mongoose.connect(uri)` che connection pool, topology monitoring, auth handshake của MongoDB driver. `prisma.user.findMany()` che query engine, connection management.
3. Trong dự án: **service layer** (như `CheckoutFacade` trên) là facade chuẩn; ngoài ra hay gặp facade gom "external world" — ví dụ `class ShopifyGateway` gom 5-6 REST call lẻ tẻ (get product, get inventory, update price) thành các method theo ngôn ngữ domain.

### Biến thể & cách triển khai khác

- **Module-as-facade** — idiomatic Node.js: một file `checkout/index.ts` chỉ export `placeOrder`, các file con (`inventory.ts`, `pricing.ts`) không được import từ ngoài module. ESM module boundary chính là facade không cần class.
- **Facade per use-case** thay vì facade khổng lồ: `CheckoutFacade`, `RefundFacade` — mỗi cái vài method, thay vì `OrderFacade` 30 method.
- **BFF (Backend-for-Frontend)** — facade ở tầng kiến trúc: một service đứng trước nhiều microservice, gom dữ liệu thành response vừa khít cho 1 loại client.

### ⚠️ Khi nào KHÔNG nên dùng / anti-pattern

- **Facade biến thành God Object** — ranh giới quan trọng nhất: facade chỉ **điều phối** (orchestrate), không **chứa** business logic của subsystem. Dấu hiệu vượt ranh: facade tự tính giá thay vì gọi `PricingService`, file > 500 dòng, 20+ dependency trong constructor, mọi feature mới đều "nhét vào facade cho tiện". Lúc đó hãy tách theo use case.
- **Facade cho thứ vốn đã đơn giản**: wrap 1 repository có 2 method bằng 1 service chỉ forward call (pass-through layer) là lớp vô nghĩa — "lasagna code".
- **Facade che giấu chi phí**: nếu `placeOrder` chạy 15 query + 3 external call mà tên gọi nghe "nhẹ", người gọi sẽ vô tư gọi trong vòng lặp. Document chi phí hoặc thiết kế batch API.

### 💬 Câu hỏi phỏng vấn liên quan

**Q: Service layer có phải Facade không? Khác gì God Object?**
A: Service layer điều phối nhiều repository/external service sau 1 interface đơn giản — đúng tinh thần facade. Khác God Object ở chỗ: facade *delegate*, không *own* logic; mỗi subsystem vẫn độc lập, test riêng được, và dùng trực tiếp được khi cần. God Object thì hút hết logic vào mình, subsystem rỗng ruột.

**Q: Facade vs Adapter vs Mediator?**
A: Adapter đổi interface có sẵn cho khớp interface mong đợi (1-1, bị động). Facade tạo interface mới đơn giản hóa cả nhóm subsystem (1-nhiều, một chiều: client → facade → subsystems). Mediator điều phối giao tiếp *giữa các* component với nhau (nhiều-nhiều, các component nói chuyện qua mediator).

**Q: Khi nào anh/chị quyết định thêm 1 facade vào codebase?**
A: Khi thấy cùng một chuỗi gọi 3+ subsystem lặp lại ở 2+ nơi, hoặc khi controller bắt đầu chứa logic điều phối (transaction, compensation). Rule of thumb: facade sinh ra từ duplication có thật, không phải từ "kiến trúc đẹp" tưởng tượng.

---

## 5. Composite

### Vấn đề nó giải quyết

Bạn cần xử lý cấu trúc **cây part-whole** — nơi "một nhóm" và "một phần tử" cần được đối xử **giống hệt nhau**:

- Hệ thống permission: `admin` role chứa `editor` role, `editor` chứa permission `post:write`. Câu hỏi `user có quyền X không?` phải đúng dù quyền nằm trực tiếp hay sâu 3 cấp trong cây role.
- Validation rule: `(age >= 18 AND country == 'VN') OR isVerified` — điều kiện đơn và nhóm điều kiện AND/OR đều cần gọi được `.evaluate(data)`.
- File system: tính tổng dung lượng folder = đệ quy con (file trả size, folder trả tổng size con).

Không có Composite, bạn sẽ viết `if (isGroup) {...} else {...}` ở mọi nơi xử lý. Composite giải quyết: **leaf và composite cùng implement 1 interface**, composite chứa danh sách con và delegate đệ quy. Client gọi 1 method, không cần biết đang đứng trước lá hay cả cây.

### Cách triển khai trong Node.js/TypeScript

**Ví dụ 1 — Validation rule lồng nhau (AND/OR), phong cách functional + class:**

```typescript
// Component interface: lá và nhánh đều là Rule
interface Rule<T> {
  evaluate(data: T): boolean;
  describe(): string; // hữu ích để trả error message
}

// --- LEAF: điều kiện đơn ---
class FieldRule<T> implements Rule<T> {
  constructor(
    private name: string,
    private predicate: (data: T) => boolean,
  ) {}
  evaluate(data: T) { return this.predicate(data); }
  describe() { return this.name; }
}

// --- COMPOSITE: nhóm AND ---
class AllOf<T> implements Rule<T> {
  constructor(private children: Rule<T>[]) {}
  evaluate(data: T) { return this.children.every((c) => c.evaluate(data)); } // đệ quy ngầm
  describe() { return `(${this.children.map((c) => c.describe()).join(' AND ')})`; }
}

// --- COMPOSITE: nhóm OR ---
class AnyOf<T> implements Rule<T> {
  constructor(private children: Rule<T>[]) {}
  evaluate(data: T) { return this.children.some((c) => c.evaluate(data)); }
  describe() { return `(${this.children.map((c) => c.describe()).join(' OR ')})`; }
}

// --- Sử dụng: build cây rule, client chỉ gọi evaluate() ---
interface Applicant { age: number; country: string; isVerified: boolean }

const eligibility: Rule<Applicant> = new AnyOf([
  new AllOf([
    new FieldRule<Applicant>('age >= 18', (d) => d.age >= 18),
    new FieldRule<Applicant>("country == 'VN'", (d) => d.country === 'VN'),
  ]),
  new FieldRule<Applicant>('isVerified', (d) => d.isVerified),
]);

eligibility.evaluate({ age: 20, country: 'VN', isVerified: false }); // true
eligibility.describe(); // "((age >= 18 AND country == 'VN') OR isVerified)"
// Nhận xét: cây này lồng sâu bao nhiêu cũng được — AnyOf chứa AllOf chứa AnyOf...
```

**Ví dụ 2 — Permission tree (role chứa role), duyệt đệ quy + chống vòng lặp:**

```typescript
interface Grantable {
  /** Trả về tập permission "phẳng" sau khi duyệt hết cây */
  collect(seen?: Set<Grantable>): Set<string>;
}

// LEAF
class Permission implements Grantable {
  constructor(private key: string) {} // vd: "post:write"
  collect(): Set<string> { return new Set([this.key]); }
}

// COMPOSITE
class Role implements Grantable {
  private children: Grantable[] = [];
  constructor(public name: string) {}

  add(child: Grantable): this {
    this.children.push(child);
    return this;
  }

  collect(seen = new Set<Grantable>()): Set<string> {
    // QUAN TRỌNG: role có thể bị gán vòng (A chứa B, B chứa A) do data bẩn
    // -> track visited node, nếu không sẽ stack overflow
    if (seen.has(this)) return new Set();
    seen.add(this);

    const result = new Set<string>();
    for (const child of this.children) {
      for (const p of child.collect(seen)) result.add(p);
    }
    return result;
  }
}

// Build cây
const editor = new Role('editor')
  .add(new Permission('post:read'))
  .add(new Permission('post:write'));

const admin = new Role('admin')
  .add(editor)                          // role chứa role
  .add(new Permission('user:manage'));

const can = (role: Role, perm: string) => role.collect().has(perm);
can(admin, 'post:write'); // true — thừa kế xuyên cây từ editor
```

### Use case thực tế trong backend

1. **Validation/query DSL**: `zod` (`z.union`, `z.intersection` — schema chứa schema), `joi` (`Joi.alternatives()`), MongoDB query object (`{ $or: [{ $and: [...] }] }`), Knex query builder với nested `where(function() {...})` — tất cả là composite của điều kiện.
2. **RBAC/permission systems**: CASL, hay các hệ thống role-inherits-role tự xây (như ví dụ 2); AWS IAM policy với statement lồng nhau cũng cùng tư duy.
3. **Khác**: cấu trúc thư mục (xử lý upload theo folder), category tree trong e-commerce (tính tổng sản phẩm trong category cha = đệ quy con), AST của Babel/ESLint/TypeScript compiler (node chứa node — mọi tooling JS đứng trên một composite khổng lồ), React component tree.

### Biến thể & cách triển khai khác

- **Plain object + hàm đệ quy** — idiomatic JS: thay vì class, cây chỉ là JSON (`{ type: 'and', children: [...] }`) và một hàm `evaluate(node, data)` switch theo `type`. Dễ serialize vào DB (lưu rule engine cấu hình được!), đó là cách các rule engine thực tế (json-rules-engine) làm.
- **Transparent vs Safe composite**: transparent — `add/remove` nằm trên interface chung (lá cũng có `add` nhưng throw); safe — `add/remove` chỉ có trên composite (như ví dụ trên, type-safe hơn, khuyến nghị trong TS).
- **Kết hợp Visitor**: khi cần nhiều thao tác khác nhau trên cùng cây (evaluate, describe, optimize, serialize), tách thao tác ra visitor để khỏi phình interface.

### ⚠️ Khi nào KHÔNG nên dùng / anti-pattern

- **Cấu trúc thực tế là phẳng**: danh sách permission không lồng nhau thì 1 cái `Set<string>` là đủ — đừng dựng cây cho oai.
- **Cây từ data người dùng mà không chống cycle/depth**: đệ quy không giới hạn trên data bẩn = stack overflow / DoS. Luôn có `seen` set hoặc max depth.
- **Đệ quy đồng bộ trên cây rất lớn trong request handler**: block event loop. Cây > vài chục nghìn node thì cân nhắc duyệt iterative + chia batch, hoặc tính trước (materialized path/closure table trong DB thay vì load cả cây lên memory).
- Interface chung bị phình vì cố nhét thao tác chỉ có nghĩa với composite (vd: `getChildren()` trên lá) — dùng safe composite.

### 💬 Câu hỏi phỏng vấn liên quan

**Q: Lưu permission tree (role chứa role) trong PostgreSQL thế nào và resolve quyền ra sao?**
A: Bảng `role_inherits(parent_id, child_id)` + recursive CTE (`WITH RECURSIVE`) để flatten lúc query, hoặc denormalize (precompute bảng quyền phẳng, invalidate khi cây đổi) nếu đọc nhiều ghi ít. Trên app layer, cấu trúc resolve chính là Composite — và phải chống cycle.

**Q: Composite khác Decorator? Cả hai đều "object chứa object cùng interface".**
A: Decorator chứa đúng **một** con và mục đích là *thêm behavior*; Composite chứa **nhiều** con và mục đích là *biểu diễn cây part-whole*, gọi đệ quy xuống tất cả con. Decorator là chuỗi, Composite là cây.

**Q: Khi nào dùng class-based composite, khi nào dùng plain JSON + hàm đệ quy?**
A: JSON + hàm khi cây cần serialize (lưu DB, gửi qua API, cho user cấu hình rule) — đây là đa số case backend. Class khi behavior phức tạp, nhiều method trên node và cây chỉ sống trong memory (vd: AST của compiler).

---

## 6. Bridge

### Vấn đề nó giải quyết

Hệ thống notification: 3 **kênh** gửi (Email, SMS, Push) × 2 **loại** nội dung (Transactional — OTP, hóa đơn; Marketing — campaign, có unsubscribe footer, check opt-in). Nếu dùng kế thừa, bạn nhận **class explosion**: `TransactionalEmailNotification`, `MarketingEmailNotification`, `TransactionalSmsNotification`... 3×2 = 6 class, thêm kênh Zalo và loại "Alert" → 4×3 = 12 class. Mỗi chiều mới nhân lên chứ không cộng vào.

Bridge giải quyết: **tách 2 chiều biến đổi thành 2 hierarchy độc lập** — *abstraction* (loại notification, chứa logic nghiệp vụ) **chứa một reference** đến *implementation* (kênh gửi, lo việc vận chuyển). Hai chiều phát triển độc lập: thêm kênh không đụng loại, thêm loại không đụng kênh. 4 kênh + 3 loại = 7 class, không phải 12.

### Cách triển khai trong Node.js/TypeScript

```typescript
// ========== IMPLEMENTATION SIDE: kênh gửi (low-level, "làm sao gửi") ==========
interface MessageChannel {
  send(to: string, subject: string, body: string): Promise<void>;
  /** Kênh có hỗ trợ rich content không — abstraction có thể hỏi để điều chỉnh */
  supportsHtml(): boolean;
}

class EmailChannel implements MessageChannel {
  constructor(private smtp: SmtpClient) {}
  async send(to: string, subject: string, body: string) {
    await this.smtp.sendMail({ to, subject, html: body });
  }
  supportsHtml() { return true; }
}

class SmsChannel implements MessageChannel {
  constructor(private twilio: TwilioClient) {}
  async send(to: string, _subject: string, body: string) {
    // SMS không có subject; giới hạn ký tự là chuyện của channel
    await this.twilio.messages.create({ to, body: body.slice(0, 160) });
  }
  supportsHtml() { return false; }
}

class PushChannel implements MessageChannel {
  constructor(private fcm: FcmClient) {}
  async send(to: string, subject: string, body: string) {
    await this.fcm.send({ token: to, notification: { title: subject, body } });
  }
  supportsHtml() { return false; }
}

// ========== ABSTRACTION SIDE: loại notification (high-level, "gửi cái gì, theo luật nào") ==========
abstract class Notification {
  // *** Cây cầu (bridge): abstraction CHỨA implementation, không kế thừa nó ***
  constructor(protected channel: MessageChannel) {}
  abstract notify(recipient: Recipient, payload: Record<string, string>): Promise<void>;
}

class TransactionalNotification extends Notification {
  // Transactional: gửi NGAY, không check opt-in (OTP, reset password là bắt buộc)
  async notify(recipient: Recipient, payload: Record<string, string>) {
    const body = this.channel.supportsHtml()
      ? `<p>Your OTP code: <b>${payload.code}</b></p>`
      : `Your OTP code: ${payload.code}`;
    await this.channel.send(recipient.address, 'Verification code', body);
  }
}

class MarketingNotification extends Notification {
  constructor(channel: MessageChannel, private optIns: OptInService) {
    super(channel);
  }

  // Marketing: phải check opt-in, kèm unsubscribe — LUẬT này độc lập với kênh
  async notify(recipient: Recipient, payload: Record<string, string>) {
    if (!(await this.optIns.hasOptedIn(recipient.userId))) return; // luật pháp yêu cầu!
    const unsubscribe = `Unsubscribe: https://ex.com/u/${recipient.userId}`;
    await this.channel.send(
      recipient.address,
      payload.subject,
      `${payload.content}\n\n${unsubscribe}`,
    );
  }
}

// ========== Sử dụng: mix tự do 2 chiều lúc RUNTIME ==========
const otpViaSms    = new TransactionalNotification(new SmsChannel(twilio));
const otpViaEmail  = new TransactionalNotification(new EmailChannel(smtp));
const promoViaPush = new MarketingNotification(new PushChannel(fcm), optIns);

// Thêm ZaloChannel? Chỉ viết 1 class channel mới — KHÔNG sửa notification nào.
// Thêm AlertNotification? Chỉ viết 1 class notification — KHÔNG sửa channel nào.
```

### Use case thực tế trong backend

1. **Database driver layers**: Knex tách query-building (abstraction: `knex('users').where(...)`) khỏi dialect/driver (implementation: pg/mysql/sqlite). Bạn có thể nâng cấp query builder mà không đổi driver và ngược lại — 2 hierarchy tiến hóa độc lập, đúng tinh thần Bridge (nhìn từ phía adapter từng driver thì là Adapter — 2 pattern này hay chồng lên nhau).
2. **Logging**: winston tách `Logger` (level, format, luật log) khỏi `Transport` (Console, File, HTTP, CloudWatch) — thêm transport mới không đụng logic logger.
3. Trong dự án: notification system như trên (rất hay được hỏi trong system design interview); report generator (loại report × định dạng xuất PDF/Excel/CSV); webhook dispatcher (loại event × cách deliver HTTP/queue).

### Biến thể & cách triển khai khác

Trong JS/TS hiện đại, **Bridge thường "tan" vào composition + dependency injection** — và đó là điều nên nói trong phỏng vấn:

```typescript
// Bridge tối giản kiểu functional: implementation là 1 hàm được inject
type SendFn = (to: string, subject: string, body: string) => Promise<void>;

const makeTransactionalNotifier = (send: SendFn) =>
  (to: string, code: string) => send(to, 'Verification code', `Your OTP: ${code}`);

const otpViaSms = makeTransactionalNotifier(smsSend);
```

- Khi mỗi bên chỉ có 1 method, "hierarchy" suy biến thành function — Bridge chỉ còn là "inject hàm". Đây là lý do Bridge ít được gọi tên trong JS: nó hiện diện khắp nơi dưới dạng DI.
- **Strategy vs Bridge**: cấu trúc giống nhau (chứa reference đến interface có thể thay). Khác ở ý đồ và quy mô: Strategy thay 1 *thuật toán* trong 1 class; Bridge tách *cả 2 hierarchy* cùng phát triển độc lập (cả abstraction lẫn implementation đều có nhiều biến thể, có thể đều có subclass).

### ⚠️ Khi nào KHÔNG nên dùng / anti-pattern

- **Chỉ có 1 chiều biến đổi**: chỉ nhiều kênh, chỉ 1 loại notification → đó là Strategy/DI đơn giản, đừng dựng 2 hierarchy.
- **Dựng đủ 2 abstract hierarchy "cho đúng sách"** khi mỗi bên mới có 1 implementation: over-engineering kinh điển. Bắt đầu bằng composition đơn giản, tách hierarchy khi chiều thứ 2 *thực sự* xuất hiện.
- **Interface implementation bị leak chi tiết 1 kênh** (vd: `MessageChannel.send` nhận `htmlTemplate` — SMS làm gì với nó?): khi đó abstraction phải `if (channel instanceof ...)` — cây cầu sập. Thiết kế interface theo mẫu số chung + capability flags (`supportsHtml()`).

### 💬 Câu hỏi phỏng vấn liên quan

**Q: Bridge khác Adapter thế nào?**
A: Thời điểm và ý đồ. Adapter là **chữa cháy sau khi code đã tồn tại** — làm 2 interface không tương thích khớp nhau. Bridge là **thiết kế từ trước** — chủ động tách 2 chiều biến đổi để chúng phát triển độc lập. Adapter làm việc với cái có sẵn, Bridge định hình cái sắp xây.

**Q: Thiết kế notification system đa kênh — anh/chị tránh class explosion thế nào?**
A: Tách 2 chiều: channel (transport) và notification type (business rules) thành 2 interface độc lập, type *chứa* channel qua constructor injection (Bridge). Mỗi chiều mới chỉ thêm 1 class. Thực tế còn thêm 1 dispatcher chọn channel theo user preference + fallback (SMS fail → email) — fallback logic nằm phía abstraction, không nhiễm vào channel.

**Q: Trong JS có thật sự cần Bridge không khi đã có DI?**
A: Về cơ chế thì DI + composition đã là Bridge tối giản. Giá trị còn lại của việc "gọi tên" Bridge là tư duy thiết kế: nhận diện *hai chiều biến đổi độc lập* và kỷ luật không cho chúng dính vào nhau — cái đó không tự đến chỉ vì dùng DI container.

---

## 7. Flyweight

### Vấn đề nó giải quyết

Bạn có **rất nhiều object giống nhau một phần**, và phần giống nhau đó đang bị **nhân bản lãng phí trong memory**. Ví dụ thật: server xử lý 200k đơn hàng trong memory để export report; mỗi đơn có object `currency` (`{ code: 'VND', symbol: '₫', decimals: 0, ... }`). 200k đơn → 200k object currency, trong khi thực tế chỉ có ~10 currency khác nhau. Heap phình, GC pressure tăng, có thể OOM container.

Flyweight giải quyết: tách state thành **intrinsic** (phần dùng chung, immutable — thông tin currency) và **extrinsic** (phần riêng từng object — amount, orderId). Phần intrinsic chỉ tạo **một instance duy nhất mỗi loại**, cache trong factory, mọi object dùng chung qua reference. 200k reference (8 byte/cái) thay vì 200k object (hàng trăm byte/cái).

### Cách triển khai trong Node.js/TypeScript

```typescript
// ===== FLYWEIGHT: intrinsic state — dùng chung, BẮT BUỘC immutable =====
interface CurrencyInfo {
  readonly code: string;
  readonly symbol: string;
  readonly decimals: number;
  readonly displayName: string;
}

// ===== FLYWEIGHT FACTORY: cache + trả về instance dùng chung =====
class CurrencyRegistry {
  private static pool = new Map<string, CurrencyInfo>();

  static get(code: string): CurrencyInfo {
    let info = this.pool.get(code);
    if (!info) {
      // Trong thực tế load từ config/DB; freeze để không ai sửa shared state
      info = Object.freeze(this.lookup(code));
      this.pool.set(code, info);
    }
    return info; // mọi caller cùng code nhận CÙNG MỘT reference
  }

  private static lookup(code: string): CurrencyInfo {
    const table: Record<string, Omit<CurrencyInfo, 'code'>> = {
      VND: { symbol: '₫', decimals: 0, displayName: 'Vietnamese Dong' },
      USD: { symbol: '$', decimals: 2, displayName: 'US Dollar' },
    };
    const found = table[code];
    if (!found) throw new Error(`Unknown currency: ${code}`);
    return { code, ...found };
  }
}

// ===== CONTEXT: extrinsic state — riêng từng object, nhẹ =====
class OrderLine {
  constructor(
    public readonly orderId: string,    // extrinsic
    public readonly amount: number,     // extrinsic
    public readonly currency: CurrencyInfo, // reference đến flyweight dùng chung
  ) {}

  format(): string {
    return `${this.amount.toFixed(this.currency.decimals)} ${this.currency.symbol}`;
  }
}

// 200k order lines nhưng chỉ 2 object CurrencyInfo tồn tại trong heap
const lines = rawRows.map(
  (r) => new OrderLine(r.orderId, r.amount, CurrencyRegistry.get(r.currencyCode)),
);

console.log(CurrencyRegistry.get('VND') === CurrencyRegistry.get('VND')); // true — cùng reference
```

Đo nhanh sự khác biệt (kỹ thuật hay dùng khi nghi ngờ memory):

```typescript
// node --expose-gc bench.ts
function heapUsedMB() {
  global.gc?.();
  return (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
}

const before = heapUsedMB();
const data = Array.from({ length: 500_000 }, (_, i) =>
  new OrderLine(`o${i}`, i, CurrencyRegistry.get(i % 2 ? 'VND' : 'USD')),
);
console.log(`with flyweight: ${heapUsedMB()} MB (before: ${before})`);
// So với version mỗi line tự tạo { code, symbol, decimals, displayName } riêng:
// chênh lệch hàng chục MB ở quy mô này.
```

### Use case thực tế trong backend

1. **String interning của V8**: V8 tự dedupe nhiều string giống nhau (internalized strings); `JSON.parse` các key lặp lại của 1 triệu record không tạo 1 triệu bản copy key. Đây là flyweight mà bạn hưởng miễn phí — và là lý do nên đo trước khi tự tối ưu string.
2. **`moment` locale objects / `Intl` instances**: mỗi locale chỉ có 1 object cấu hình dùng chung cho mọi instance moment. Tương tự, `new Intl.NumberFormat('vi-VN')` rất đắt — pattern chuẩn là tạo 1 lần, cache theo locale, dùng chung (đây là flyweight bạn nên *chủ động* làm; tạo Intl instance trong vòng lặp là lỗi perf kinh điển).
3. **Connection pool** (`pg.Pool`, `generic-pool`): *họ hàng* của flyweight — chia sẻ tài nguyên đắt đỏ giữa nhiều consumer thay vì mỗi request 1 connection. Khác biệt: pooled connection là mutable và được *mượn—trả độc quyền*, còn flyweight đúng nghĩa là immutable và dùng chung *đồng thời*. Nói được sự khác biệt này trong phỏng vấn là điểm cộng.
4. Trong dự án: bảng tra cứu (country, currency, tax rate, feature flag config) load 1 lần dùng chung; compiled regex/schema (`zod` schema, `ajv` compiled validator — compile 1 lần ở module scope, mọi request dùng chung thay vì compile per-request).

### Biến thể & cách triển khai khác

- **Module-level cache** — idiomatic Node.js: `const FORMATTERS = new Map<string, Intl.NumberFormat>()` + hàm `getFormatter(locale)`. Không cần class, tận dụng module caching của Node (mỗi module chỉ evaluate 1 lần — bản thân module system là flyweight).
- **Memoized factory**: `p-memoize`/`lodash.memoize` quanh hàm tạo object = flyweight factory generic.
- **`Object.freeze` + `as const`**: ép immutability cho shared state — không freeze thì một chỗ sửa, mọi nơi dính.
- **WeakMap/WeakRef-based cache** khi key là object và bạn muốn GC thu hồi flyweight không còn ai dùng (cache không bị giữ sống vĩnh viễn).

### ⚠️ Khi nào KHÔNG nên dùng / anti-pattern

- **Tối ưu khi chưa đo**: vài nghìn object nhỏ là chuyện vặt với V8. Chỉ quan tâm flyweight khi heap snapshot (Chrome DevTools / `--inspect`) chỉ ra hàng trăm nghìn object trùng lặp, hoặc container hay chạm memory limit. Premature optimization làm code khó đọc vô ích.
- **Flyweight mutable** — anti-pattern nguy hiểm nhất: một request sửa shared object → mọi request khác thấy dữ liệu sai, bug heisenbug cực khó trace (đặc biệt trong Node vì mọi request chung 1 process). Luôn `Object.freeze` / `readonly`.
- **Cache không có eviction**: flyweight pool với key không bị chặn (vd: cache theo userId thay vì theo locale) = memory leak trá hình. Flyweight chỉ hợp lệ khi số lượng intrinsic state **nhỏ và hữu hạn**.
- Nhầm flyweight với caching kết quả: flyweight chia sẻ *object đại diện state*, không phải cache *kết quả tính toán* (đó là memoization — họ hàng nhưng khác ý đồ).

### 💬 Câu hỏi phỏng vấn liên quan

**Q: Khi nào trong Node.js anh/chị thực sự phải nghĩ đến Flyweight?**
A: Khi xử lý dataset lớn in-memory (export, ETL, cache warm-up) và heap snapshot cho thấy object metadata trùng lặp hàng loạt; hoặc khi tạo object đắt (Intl, compiled regex/ajv validator) trong hot path. Cách làm: factory + module-level Map, freeze shared object. Còn bình thường, V8 string interning + hidden class đã tối ưu sẵn rất nhiều.

**Q: Connection pool có phải Flyweight không?**
A: Cùng triết lý "chia sẻ tài nguyên đắt thay vì nhân bản", nhưng không phải flyweight thuần: connection là mutable, được checkout độc quyền rồi trả lại (Object Pool pattern). Flyweight là immutable, nhiều client dùng chung *cùng lúc*. Hai pattern anh em, khác cơ chế chia sẻ.

**Q: Shared object trong Node.js có cần lo race condition không?**
A: Trong 1 process, JS single-threaded nên không có data race ở mức instruction; nhưng vẫn có *logical race* giữa các async step nếu shared object mutable (request A đọc giữa lúc request B đang sửa qua nhiều `await`). Giải pháp đúng cho flyweight: immutable ngay từ đầu — không sửa thì không race.

---

## 📋 Bảng tóm tắt

| Pattern | Vấn đề (1 dòng) | Triển khai JS idiomatic (1 dòng) |
|---|---|---|
| **Adapter** | Hai interface không khớp nhau (đa provider, migrate thư viện) | Object literal/class implement interface của bạn, "dịch" call sang SDK bên thứ ba |
| **Decorator** | Thêm behavior (cache/retry/log) mà không sửa code gốc, không kế thừa | Higher-order function wrap function: `withCache(withRetry(fn))` |
| **Proxy** | Kiểm soát truy cập: lazy init, cache trước DB, chặn quyền, validate | Class delegate hoặc `new Proxy(target, { get, set })` trap mọi truy cập |
| **Facade** | Che chuỗi gọi nhiều subsystem phức tạp sau 1 method đơn giản | Service layer / module `index.ts` chỉ export hàm cấp cao, điều phối bên trong |
| **Composite** | Cây part-whole: nhóm và phần tử cần đối xử như nhau (rule AND/OR, role tree) | Plain JSON node `{ type, children }` + hàm evaluate đệ quy (serialize được) |
| **Bridge** | Hai chiều biến đổi độc lập (kênh × loại) gây class explosion nếu kế thừa | Composition + DI: abstraction nhận implementation (interface/function) qua constructor |
| **Flyweight** | Hàng trăm nghìn object trùng phần state chung làm phình heap | Factory + module-level `Map` cache, `Object.freeze` shared instance |

**Mẹo phân biệt nhanh khi bị hỏi "wrap thì pattern nào?":** nhìn ý đồ — đổi interface = **Adapter**; cộng thêm behavior, stack được = **Decorator**; kiểm soát truy cập, client không biết = **Proxy**; đơn giản hóa cả cụm subsystem = **Facade**.

---

## 🔍 Nhận diện pattern trong code có sẵn

Đọc 5 đoạn code (rút gọn) từ thư viện thật, đoán xem mỗi đoạn là pattern nào trước khi mở đáp án.

### Đoạn 1 — multer (storage engines)

```typescript
// Bạn viết custom storage cho multer bằng cách implement interface này:
interface StorageEngine {
  _handleFile(req: Request, file: File, cb: (err?: any, info?: object) => void): void;
  _removeFile(req: Request, file: File, cb: (err: Error) => void): void;
}

// multer-s3 implement nó, bên trong gọi AWS SDK (API hoàn toàn khác):
class S3Storage implements StorageEngine {
  _handleFile(req, file, cb) {
    const upload = new Upload({ client: this.s3, params: { Bucket, Key, Body: file.stream } });
    upload.done().then((result) => cb(null, { location: result.Location }), cb);
  }
  _removeFile(req, file, cb) {
    this.s3.send(new DeleteObjectCommand({ Bucket, Key: file.key }), cb);
  }
}
```

<details>
<summary>Đáp án</summary>

**Adapter.** `multer` định nghĩa interface `StorageEngine` mà nó mong đợi; `multer-s3` "dịch" interface đó sang API của AWS SDK (`Upload`, `DeleteObjectCommand`). Mỗi storage package (disk, memory, S3, GCS) là một adapter cho cùng interface đích. Có thể tranh luận thêm chút hơi hướng Bridge (multer tách logic upload khỏi storage để 2 bên tiến hóa độc lập) — nhưng nhìn từ phía package `multer-s3` thì rõ ràng là Adapter: làm API có sẵn của AWS khớp với interface multer yêu cầu.
</details>

### Đoạn 2 — NestJS (CacheInterceptor)

```typescript
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const key = this.trackBy(context);
    const cached = await this.cacheManager.get(key);
    if (cached !== undefined) {
      return of(cached);                  // có cache -> KHÔNG gọi handler thật
    }
    return next.handle().pipe(            // không có -> gọi handler thật
      tap((response) => this.cacheManager.set(key, response, ttl)),
    );
  }
}
```

<details>
<summary>Đáp án</summary>

**Proxy** (caching proxy) — và cơ chế interceptor nói chung là **Decorator**. `CacheInterceptor` đứng chắn trước handler thật, quyết định *có cho lời gọi đi tiếp hay không* (cache hit thì chặn hẳn, không gọi `next.handle()`) — đó là dấu hiệu Proxy: kiểm soát truy cập. Nếu interceptor luôn gọi handler và chỉ thêm behavior trước/sau (logging interceptor), nó nghiêng về Decorator. Trả lời được "tùy interceptor làm gì: chặn = Proxy, cộng thêm = Decorator" là câu trả lời senior.
</details>

### Đoạn 3 — Knex (nested where)

```typescript
knex('users')
  .where('active', true)
  .andWhere(function () {
    this.where('role', 'admin').orWhere(function () {
      this.where('role', 'editor').andWhere('verified', true);
    });
  });
// SQL: WHERE active = true AND (role = 'admin' OR (role = 'editor' AND verified = true))
```

<details>
<summary>Đáp án</summary>

**Composite.** Mỗi nhóm `where(function() {...})` là một node nhóm (AND/OR) có thể chứa điều kiện đơn (lá) hoặc nhóm con khác — lồng sâu tùy ý. Khi build SQL, Knex duyệt đệ quy cây điều kiện này và sinh ngoặc tương ứng. Điều kiện đơn và nhóm điều kiện được đối xử như nhau trong chuỗi builder — đúng định nghĩa Composite. (Toàn bộ knex instance còn là Facade + Builder, nhưng phần nested where là Composite.)
</details>

### Đoạn 4 — Mongoose (`mongoose.connect` và model API)

```typescript
import mongoose from 'mongoose';

await mongoose.connect('mongodb://localhost/shop');
// Sau 1 dòng trên: driver MongoDB đã dựng connection pool, topology monitor,
// server discovery, auth handshake, retry logic...

const Product = mongoose.model('Product', productSchema);
await Product.findById(id); // che: BSON serialize, cursor, readPreference, casting...
```

<details>
<summary>Đáp án</summary>

**Facade.** `mongoose.connect()` và model API là interface đơn giản che cả hệ thống phức tạp bên dưới (MongoDB driver: pool, topology, BSON, cursors). Bạn vẫn có thể "lách qua facade" khi cần: `mongoose.connection.db` cho truy cập driver gốc — đúng tính chất facade không độc quyền. (Document của Mongoose còn dùng getter/setter để track thay đổi — chấm điểm cộng nếu nhận ra thêm hơi hướng Proxy ở tầng document.)
</details>

### Đoạn 5 — winston (Logger + Transports)

```typescript
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.Http({ host: 'log-collector.internal' }),
  ],
});

logger.error('payment failed', { orderId }); // 1 lời gọi -> đi qua mọi transport phù hợp
```

<details>
<summary>Đáp án</summary>

**Bridge.** Hai hierarchy độc lập: phía abstraction là `Logger` (level, format, luật lọc — "log cái gì"); phía implementation là `Transport` (Console/File/Http/CloudWatch — "ghi đi đâu, ghi thế nào"). Logger *chứa* danh sách transport qua composition, hai bên phát triển độc lập: cộng đồng viết transport mới (Datadog, Loki...) không cần sửa Logger; winston nâng cấp format/level không đụng transport. Đây cũng là ví dụ tốt cho câu "Bridge trong JS = composition + injection".
</details>

---

> **Phần tiếp theo:** Phần 3 — Behavioral Patterns (Strategy, Observer, Chain of Responsibility, Command, Iterator, Template Method, State) — nhóm pattern gắn chặt với EventEmitter, middleware chain và stream của Node.js.
