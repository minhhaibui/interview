# Design Patterns — Phần 4: Architectural & Backend Patterns (quan trọng nhất khi phỏng vấn senior)

> ⭐ **Lưu ý quan trọng trước khi đọc:** Đây là nhóm pattern được hỏi **NHIỀU NHẤT** khi phỏng vấn backend engineer ở level senior trở lên. GoF patterns (Phần 1-3) được dùng để đánh giá **nền tảng** — bạn có hiểu OOP, composition, abstraction không. Còn nhóm pattern này đánh giá **kinh nghiệm thực chiến**: bạn đã từng xử lý distributed transaction chưa, đã từng bị dual-write làm mất event chưa, đã từng thiết kế hệ thống chịu lỗi khi downstream service chết chưa. Interviewer kỳ vọng bạn không chỉ nói được định nghĩa mà còn nói được **trade-off, khi nào KHÔNG dùng, và đã áp dụng ở đâu trong dự án thật**.

---

## 1. Dependency Injection & IoC Container

### Vấn đề nó giải quyết

- Code kiểu `new PostgresUserRepo()` ngay trong service → service **bị khóa chặt** vào implementation cụ thể, không test được nếu không có Postgres thật, không swap được sang implementation khác.
- Vi phạm **Dependency Inversion Principle (chữ D trong SOLID)**: high-level module (business logic) không nên phụ thuộc low-level module (DB driver), cả hai nên phụ thuộc vào abstraction (interface).
- **Inversion of Control (IoC)**: thay vì class tự tạo dependency của nó, dependency được "tiêm" từ bên ngoài vào — quyền kiểm soát bị đảo ngược, chuyển lên tầng composition root.

### Cách triển khai trong Node.js/TypeScript

**1) Constructor injection thuần — không cần framework (cách được khuyên dùng nhất):**

```typescript
// domain/user-repository.ts — abstraction (port)
export interface UserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

export interface EmailSender {
  send(to: string, subject: string, body: string): Promise<void>;
}

// application/user-service.ts — chỉ phụ thuộc interface
export class UserService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly emailSender: EmailSender,
  ) {}

  async register(email: string, name: string): Promise<User> {
    const user = new User(crypto.randomUUID(), email, name);
    await this.userRepo.save(user);
    await this.emailSender.send(email, 'Welcome!', `Hi ${name}`);
    return user;
  }
}

// main.ts — COMPOSITION ROOT: nơi DUY NHẤT biết về implementation cụ thể
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const userRepo = new PostgresUserRepository(pool);
const emailSender = new SesEmailSender(sesClient);
const userService = new UserService(userRepo, emailSender);
```

**2) Lợi ích cho testing — inject mock, không cần Postgres/SES thật:**

```typescript
// user-service.test.ts
it('gửi welcome email sau khi register', async () => {
  const fakeRepo: UserRepository = {
    findById: async () => null,
    save: vi.fn(async () => {}),
  };
  const fakeEmail: EmailSender = { send: vi.fn(async () => {}) };

  const service = new UserService(fakeRepo, fakeEmail);
  await service.register('a@b.com', 'Linh');

  expect(fakeRepo.save).toHaveBeenCalledOnce();
  expect(fakeEmail.send).toHaveBeenCalledWith('a@b.com', 'Welcome!', expect.any(String));
});
```

**3) DI container hoạt động thế nào (NestJS / tsyringe / awilix):**

Cơ chế chung: **decorator + metadata reflection**.

- TypeScript với `emitDecoratorMetadata: true` sẽ emit type của constructor params vào metadata (`design:paramtypes`) thông qua `reflect-metadata`.
- Decorator `@Injectable()` đánh dấu class để container đọc metadata đó.
- Khi resolve, container đọc danh sách param types → resolve đệ quy từng dependency → cache theo scope (singleton/request/transient) → gọi `new` với các instance đã resolve.

```typescript
// tsyringe
import 'reflect-metadata';
import { injectable, inject, container } from 'tsyringe';

@injectable()
class UserService {
  constructor(
    @inject('UserRepository') private repo: UserRepository, // interface bị xóa lúc runtime → cần token
    private logger: Logger, // class cụ thể → tự resolve qua design:paramtypes
  ) {}
}

container.register('UserRepository', { useClass: PostgresUserRepository });
const service = container.resolve(UserService);
```

Điểm cần nói trong phỏng vấn: **interface TypeScript không tồn tại lúc runtime** (bị erase khi compile), nên container không thể tự resolve `UserRepository` — phải dùng **token** (string/Symbol/abstract class). NestJS giải quyết bằng `@Inject(TOKEN)` hoặc dùng abstract class làm token.

```typescript
// NestJS — module khai báo provider mapping
@Module({
  providers: [
    UserService,
    { provide: USER_REPOSITORY, useClass: PostgresUserRepository },
    { provide: EMAIL_SENDER, useFactory: (cfg: ConfigService) => new SesEmailSender(cfg.get('SES_KEY')), inject: [ConfigService] },
  ],
})
export class UserModule {}
```

**4) DI vs Service Locator (anti-pattern):**

```typescript
// ❌ Service Locator — dependency BỊ GIẤU bên trong, không nhìn signature mà biết được
class UserService {
  async register(email: string) {
    const repo = Container.get('UserRepository'); // gọi ra global container
    await repo.save(...);
  }
}
```

Tại sao là anti-pattern: dependency **ẩn** (đọc constructor không biết class cần gì), test phải setup global container, mọi class phụ thuộc vào chính container (coupling vào infrastructure). DI thì dependency **tường minh** trong constructor — compiler ép bạn cung cấp đủ.

### Use case thực tế & thư viện hỗ trợ

- **NestJS** — DI container full-featured, module system, request-scoped providers. Chuẩn de-facto cho enterprise Node.
- **tsyringe** (Microsoft) — nhẹ, decorator-based, hợp khi không muốn cả framework.
- **awilix** — KHÔNG cần decorator/reflect-metadata, resolve theo tên param hoặc khai báo tường minh, hỗ trợ `asClass/asFunction/asValue` + lifetime (`SINGLETON/SCOPED/TRANSIENT`). Hợp với Express/Fastify thuần.
- **InversifyJS** — lâu đời, mạnh nhưng verbose.
- Thực tế nhiều team chỉ cần **manual constructor injection + composition root** — đặc biệt khi service nhỏ (< ~30 class).

### ⚠️ Trade-offs / khi nào không nên dùng

- DI container thêm **magic**: lỗi resolve chỉ lộ lúc runtime (`Nest can't resolve dependencies of...`), circular dependency khó debug (`forwardRef` của NestJS là code smell).
- `reflect-metadata` + decorator gắn bạn vào cấu hình compiler cụ thể (vấn đề với esbuild/SWC vì chúng không emit `design:paramtypes` đầy đủ — phải dùng plugin).
- Microservice nhỏ / lambda function: container là overkill — startup cost, cognitive cost. Wire tay 10 dòng là đủ.
- Đừng nhầm "dùng DI" = "phải có container". DI là **nguyên tắc thiết kế**; container chỉ là tiện ích lắp ráp.

### 💬 Câu hỏi phỏng vấn liên quan

**Q: DI khác gì Service Locator? Tại sao Service Locator bị coi là anti-pattern?**
A: Cả hai đều tách việc tạo dependency khỏi việc dùng, nhưng DI tiêm dependency từ ngoài vào (tường minh trong constructor), còn Service Locator để class tự gọi container lấy dependency (ẩn). Service Locator làm dependency vô hình với người đọc code, mọi class coupling vào container, test phải mock global state — vi phạm explicit dependencies principle.

**Q: NestJS resolve dependency bằng cách nào khi TypeScript interface không tồn tại lúc runtime?**
A: Nhờ `reflect-metadata` + `emitDecoratorMetadata`, Nest đọc `design:paramtypes` để biết class types của constructor params. Với interface (bị erase), phải dùng injection token (`@Inject(TOKEN)` + provider `{ provide: TOKEN, useClass: ... }`) hoặc dùng abstract class làm cả token lẫn type.

**Q: Khi nào bạn KHÔNG dùng DI container?**
A: Service nhỏ, lambda, CLI tool — manual wiring ở composition root đơn giản hơn, lỗi lộ ở compile-time thay vì runtime, không phụ thuộc reflect-metadata. Container đáng giá khi graph dependency lớn, cần scope per-request, hoặc team đã chuẩn hóa trên NestJS.

---

## 2. Repository & Unit of Work

### Vấn đề nó giải quyết

- **Repository**: business logic lẫn lộn SQL/ORM calls → khó test, khó đổi storage, query trùng lặp khắp nơi. Repository tạo một **collection-like interface** che giấu chi tiết persistence: service chỉ thấy `orderRepo.findById()`, không thấy `SELECT ... JOIN ...`.
- **Unit of Work (UoW)**: một use case nghiệp vụ chạm vào **nhiều repository** (trừ tiền ví + tạo order + ghi outbox) phải **atomic** — tất cả cùng commit hoặc cùng rollback. UoW gom các thao tác đó vào một transaction duy nhất.

### Cách triển khai trong Node.js/TypeScript

**Repository interface + 2 implementation (Postgres cho prod, in-memory cho test):**

```typescript
// domain/order.ts
export interface Order {
  id: string;
  userId: string;
  totalCents: number;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
}

// domain/order-repository.ts
export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  save(order: Order): Promise<void>;
}

// infra/postgres-order-repository.ts
import { Pool, PoolClient } from 'pg';

type Queryable = Pool | PoolClient; // chấp nhận cả pool lẫn client trong transaction

export class PostgresOrderRepository implements OrderRepository {
  constructor(private readonly db: Queryable) {}

  async findById(id: string): Promise<Order | null> {
    const { rows } = await this.db.query(
      'SELECT id, user_id, total_cents, status FROM orders WHERE id = $1', [id],
    );
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async save(order: Order): Promise<void> {
    await this.db.query(
      `INSERT INTO orders (id, user_id, total_cents, status) VALUES ($1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, total_cents = EXCLUDED.total_cents`,
      [order.id, order.userId, order.totalCents, order.status],
    );
  }

  private toDomain(r: any): Order {
    return { id: r.id, userId: r.user_id, totalCents: Number(r.total_cents), status: r.status };
  }
}

// test/in-memory-order-repository.ts — test không cần DB
export class InMemoryOrderRepository implements OrderRepository {
  private store = new Map<string, Order>();
  async findById(id: string) { return this.store.get(id) ?? null; }
  async save(order: Order) { this.store.set(order.id, { ...order }); }
}
```

**Unit of Work — cách 1: truyền transaction qua tham số (tường minh):**

```typescript
// infra/unit-of-work.ts
export interface UnitOfWork {
  run<T>(work: (repos: TransactionalRepos) => Promise<T>): Promise<T>;
}

export interface TransactionalRepos {
  orders: OrderRepository;
  wallets: WalletRepository;
  outbox: OutboxRepository;
}

export class PgUnitOfWork implements UnitOfWork {
  constructor(private readonly pool: Pool) {}

  async run<T>(work: (repos: TransactionalRepos) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const repos: TransactionalRepos = {
        orders: new PostgresOrderRepository(client),   // cùng 1 client
        wallets: new PostgresWalletRepository(client), // → cùng 1 transaction
        outbox: new PostgresOutboxRepository(client),
      };
      const result = await work(repos);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

// application/place-order.ts — business logic không biết gì về BEGIN/COMMIT
export class PlaceOrderUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(cmd: PlaceOrderCommand): Promise<Order> {
    return this.uow.run(async ({ orders, wallets, outbox }) => {
      const wallet = await wallets.findByUserId(cmd.userId);
      wallet.debit(cmd.totalCents); // throw nếu không đủ tiền → tự rollback
      await wallets.save(wallet);

      const order: Order = { id: crypto.randomUUID(), userId: cmd.userId, totalCents: cmd.totalCents, status: 'PENDING' };
      await orders.save(order);
      await outbox.add({ type: 'OrderPlaced', payload: order }); // xem pattern #6
      return order;
    });
  }
}
```

**Unit of Work — cách 2: AsyncLocalStorage (ngầm, repository không cần biết transaction):**

```typescript
import { AsyncLocalStorage } from 'node:async_hooks';

const txStorage = new AsyncLocalStorage<PoolClient>();

export class TransactionManager {
  constructor(private readonly pool: Pool) {}

  async transactional<T>(fn: () => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // mọi async call bên trong fn() đều thấy client này qua ALS
      const result = await txStorage.run(client, fn);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

// Repository tự lấy client hiện hành: trong transaction thì dùng client, không thì dùng pool
export class PostgresOrderRepository implements OrderRepository {
  constructor(private readonly pool: Pool) {}
  private get db(): Queryable { return txStorage.getStore() ?? this.pool; }

  async save(order: Order) { await this.db.query(/* ... */); }
}

// Usage — service gọi gọn:
await txManager.transactional(async () => {
  await walletRepo.save(wallet);
  await orderRepo.save(order);
});
```

So sánh nhanh: cách 1 tường minh, dễ trace, không magic; cách 2 sạch hơn ở call site, nhưng "vô hình" — dev mới dễ quên đang trong/ngoài transaction. Đây chính là cách `typeorm-transactional`, MikroORM `RequestContext` và Prisma interactive transactions (ở mức ý tưởng) hoạt động.

### Use case thực tế & thư viện hỗ trợ

- ORM/query builder đã có sẵn khái niệm tương đương: **TypeORM** (`EntityManager` + `queryRunner` = UoW), **MikroORM** (UoW thật sự — track dirty entities, flush một lần), **Prisma** (`prisma.$transaction(async tx => ...)`), **Knex** (`knex.transaction()`), **Drizzle** (`db.transaction()`).
- Repository pattern toả sáng nhất trong **hexagonal/clean architecture**: domain layer định nghĩa port, infra layer implement adapter.
- In-memory repo giúp test use case chạy **hàng nghìn test trong vài giây**, không cần testcontainers.

**Tranh luận kinh điển: "Đã dùng ORM rồi thì Repository có thừa không?"** — nên trình bày được CẢ HAI chiều:

- *Phía "thừa"*: ORM repository/model (vd `prisma.order`) đã là repository rồi; wrap thêm một lớp `findById` gọi `prisma.order.findUnique` là abstraction rỗng, tốn code, che mất tính năng mạnh của ORM (include, select tối ưu). Nếu cả đời không đổi DB thì lớp trừu tượng đó không bao giờ được "dùng đến".
- *Phía "không thừa"*: repository không phải để "đổi DB" mà để (1) **test nhanh không cần DB**, (2) gom query phức tạp một chỗ thay vì rải rác, (3) ngăn ORM entity (kèm lazy loading, decorator) rò rỉ vào domain, (4) interface là hợp đồng nghiệp vụ (`findOverdueOrders()`) chứ không phải hợp đồng CRUD.
- *Câu trả lời senior*: tùy độ phức tạp domain. CRUD app → dùng thẳng Prisma/Drizzle trong service mỏng. Domain phức tạp, nhiều business rule, cần test dày → repository quanh aggregate root là đáng giá.

### ⚠️ Trade-offs / khi nào không nên dùng

- **Generic repository** (`Repository<T>` với đủ CRUD) là anti-pattern phổ biến: leak hết khả năng query ra ngoài, interface phình theo mọi nhu cầu. Repository nên theo **aggregate** và có method theo nghiệp vụ.
- Repository che mất khả năng tối ưu query (join, partial select) → dễ sinh N+1 khi cứng nhắc "một repo một aggregate".
- UoW qua ALS: cẩn thận với connection pool exhaustion (giữ client lâu trong transaction), và những thư viện làm mất async context (hiếm, nhưng có).
- App nhỏ, đội nhỏ: thêm 2 lớp trừu tượng cho mỗi bảng = boilerplate thuần túy.

### 💬 Câu hỏi phỏng vấn liên quan

**Q: Làm sao để 2 repository khác nhau tham gia cùng 1 transaction trong Node + pg?**
A: Cả hai phải dùng chung một `PoolClient` đã `BEGIN`. Hai cách phổ biến: Unit of Work tạo client rồi khởi tạo repos với client đó và truyền vào callback; hoặc dùng `AsyncLocalStorage` lưu client cho cả async call chain, repository tự lấy `txStorage.getStore() ?? pool`.

**Q: Dùng Prisma rồi có cần Repository pattern không?**
A: Trình bày 2 chiều (như trên) rồi chốt theo ngữ cảnh: CRUD đơn giản thì không — Prisma client đã đủ trừu tượng; domain phức tạp cần unit test nhanh và muốn domain không phụ thuộc Prisma types thì có — repository theo aggregate, method đặt tên theo nghiệp vụ.

**Q: Unit of Work khác gì transaction thường?**
A: Transaction là cơ chế của DB; UoW là pattern ở tầng application: gom các thay đổi của một business operation, đảm bảo chúng commit/rollback cùng nhau, và che giấu chi tiết transaction khỏi business logic. UoW "đúng nghĩa" (như MikroORM/Hibernate) còn track dirty entities và flush một lần ở cuối.

---

## 3. CQRS (Command Query Responsibility Segregation)

### Vấn đề nó giải quyết

- Một model duy nhất phục vụ cả ghi lẫn đọc sẽ **kéo nhau xuống**: model ghi cần normalize, invariant, lock; model đọc cần denormalize, join sẵn, phục vụ list/filter/dashboard. Ép chung một model → query 7 join chậm chạp, hoặc write model bị làm bẩn bởi field chỉ-để-hiển-thị.
- Read và write thường **lệch tải khủng khiếp** (đọc gấp 100-1000 lần ghi) → cần scale độc lập.
- CQRS: tách **Command** (thay đổi state, không trả data — hoặc chỉ trả id) và **Query** (trả data, không thay đổi state) thành 2 đường đi, 2 model riêng.

### Cách triển khai trong Node.js/TypeScript

**Các mức độ áp dụng (rất nên nói rõ trong phỏng vấn — CQRS không phải all-or-nothing):**

| Mức | Mô tả | Độ phức tạp |
|---|---|---|
| 0 | Tách class: `OrderService` → `OrderCommandService` + `OrderQueryService`, cùng DB cùng bảng | Gần như free |
| 1 | Cùng DB, query đọc thẳng SQL/view denormalized, bỏ qua domain model | Thấp |
| 2 | Cùng DB engine nhưng read replica — write vào primary, query vào replica | Trung bình (replication lag) |
| 3 | Khác DB hoàn toàn (Postgres write + Elasticsearch/Mongo read), sync qua events | Cao (eventual consistency, sync pipeline) |

**Code minh họa Command handler + Query handler (mức 1-3):**

```typescript
// ---------- WRITE SIDE: command + handler, đi qua domain model ----------
export interface PlaceOrderCommand {
  userId: string;
  items: { productId: string; qty: number }[];
}

export class PlaceOrderHandler {
  constructor(private readonly uow: UnitOfWork, private readonly eventBus: EventBus) {}

  async handle(cmd: PlaceOrderCommand): Promise<{ orderId: string }> {
    const order = await this.uow.run(async ({ orders, products }) => {
      const order = Order.place(cmd.userId, cmd.items); // domain logic, invariants
      await orders.save(order);
      return order;
    });
    await this.eventBus.publish('order.placed', order.toEvent()); // thực tế: qua outbox
    return { orderId: order.id }; // command trả tối thiểu
  }
}

// ---------- READ SIDE: query handler đọc thẳng read model, KHÔNG qua domain ----------
export interface OrderHistoryItem { // DTO denormalized, đúng hình dạng UI cần
  orderId: string;
  placedAt: string;
  totalCents: number;
  status: string;
  itemCount: number;
  firstProductName: string;
}

export class GetOrderHistoryHandler {
  constructor(private readonly readDb: Pool) {} // có thể trỏ vào read replica

  async handle(q: { userId: string; page: number }): Promise<OrderHistoryItem[]> {
    const { rows } = await this.readDb.query(
      `SELECT order_id, placed_at, total_cents, status, item_count, first_product_name
       FROM order_history_view          -- materialized view hoặc bảng projection
       WHERE user_id = $1
       ORDER BY placed_at DESC LIMIT 20 OFFSET $2`,
      [q.userId, q.page * 20],
    );
    return rows.map(toDto);
  }
}

// ---------- Mức 3: projector cập nhật read model từ event ----------
export class OrderHistoryProjector {
  constructor(private readonly readDb: Pool) {}

  async onOrderPlaced(evt: OrderPlacedEvent): Promise<void> {
    await this.readDb.query(
      `INSERT INTO order_history_view (order_id, user_id, placed_at, total_cents, status, item_count, first_product_name)
       VALUES ($1,$2,$3,$4,'PENDING',$5,$6)
       ON CONFLICT (order_id) DO NOTHING`, // idempotent — event có thể được deliver lại
      [evt.orderId, evt.userId, evt.placedAt, evt.totalCents, evt.items.length, evt.items[0].name],
    );
  }
}
```

**Liên hệ read replica:** Postgres read replica chính là CQRS "mức 2" mà nhiều team đang dùng mà không gọi tên: write vào primary, read vào replica — đã chấp nhận **replication lag** (eventual consistency vài ms-giây). Hệ quả thực chiến: **read-your-own-writes** có thể fail (user vừa đặt hàng, F5 trang lịch sử chưa thấy đơn) → giải pháp: đọc primary trong N giây sau khi user vừa ghi (sticky), hoặc trả data từ response của command, hoặc dùng `pg` LSN-based wait.

### Use case thực tế & thư viện hỗ trợ

- **NestJS CQRS module** (`@nestjs/cqrs`): `CommandBus`, `QueryBus`, `EventBus`, sagas — phổ biến nhất trong hệ Node.
- E-commerce: write model normalize (orders, order_items), read model là bảng/materialized view phẳng cho trang "lịch sử đơn hàng", hoặc Elasticsearch cho search sản phẩm.
- Dashboard/analytics: ghi vào Postgres, project sang ClickHouse.
- Đi cùng Event Sourcing rất tự nhiên (event store là write model, projection là read model) — nhưng **CQRS không bắt buộc Event Sourcing** và ngược lại.

### ⚠️ Trade-offs / khi nào không nên dùng

- **Overkill cho CRUD app** — 80% hệ thống chỉ cần mức 0-1. Nói "tôi sẽ dùng full CQRS + 2 database" cho một admin panel là red flag trong phỏng vấn.
- Mức 3 mang theo: eventual consistency (UI phải design cho "đơn hàng sẽ xuất hiện sau vài giây"), pipeline sync phải monitor (lag, dead letter), projection phải idempotent + rebuild được.
- Code tăng gấp đôi số "đường đi" — cần kỷ luật team, naming convention rõ.
- Dùng khi: tỉ lệ read/write lệch lớn, hình dạng dữ liệu đọc khác hẳn ghi, cần scale đọc độc lập, hoặc nghiệp vụ ghi phức tạp cần domain model thuần.

### 💬 Câu hỏi phỏng vấn liên quan

**Q: CQRS có bắt buộc 2 database không?**
A: Không. CQRS chỉ yêu cầu tách model/đường đi của read và write. Mức nhẹ nhất là tách class trong cùng codebase, cùng bảng. 2 database + sync qua event là mức nặng nhất, chỉ dùng khi nhu cầu scale/hình dạng dữ liệu thật sự đòi hỏi.

**Q: Dùng read replica thì xử lý read-your-own-writes thế nào?**
A: Các cách: (1) route read của user vừa ghi về primary trong khoảng thời gian ngắn (session stickiness), (2) trả luôn dữ liệu mới trong response của command để UI render mà không cần query lại, (3) chờ replica đuổi kịp LSN của write trước khi đọc. Chọn cách nào tùy mức độ yêu cầu consistency của màn hình đó.

**Q: CQRS và Event Sourcing có phải luôn đi cùng nhau?**
A: Không. CQRS dùng được với state-based storage bình thường (update bảng + project sang view). Event Sourcing gần như luôn cần CQRS (vì query trực tiếp event log rất bất tiện), nhưng chiều ngược lại thì không.

---

## 4. Event Sourcing

### Vấn đề nó giải quyết

- Storage truyền thống chỉ lưu **state hiện tại** — `UPDATE accounts SET balance = 70` xóa mất lịch sử "tại sao balance là 70". Audit log gắn thêm thường thiếu, lệch, hoặc bị quên.
- Event Sourcing: **nguồn sự thật là chuỗi event bất biến** (`MoneyDeposited`, `MoneyWithdrawn`), state hiện tại chỉ là **kết quả derive** bằng cách replay events. Được: audit trail hoàn hảo, time-travel debugging, xây read model mới từ lịch sử cũ, phân tích hành vi.

### Cách triển khai trong Node.js/TypeScript

**Event store schema (Postgres làm event store là lựa chọn thực dụng):**

```sql
CREATE TABLE events (
  global_position BIGSERIAL PRIMARY KEY,       -- thứ tự toàn cục, cho projection đọc tuần tự
  stream_id       TEXT NOT NULL,               -- vd: 'account-123'
  version         INT  NOT NULL,               -- thứ tự trong stream, cho optimistic concurrency
  type            TEXT NOT NULL,               -- 'MoneyDeposited'
  payload         JSONB NOT NULL,
  metadata        JSONB NOT NULL DEFAULT '{}', -- correlationId, causationId, userId
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (stream_id, version)                  -- ⭐ chốt chặn concurrency conflict
);

CREATE TABLE snapshots (
  stream_id TEXT PRIMARY KEY,
  version   INT NOT NULL,
  state     JSONB NOT NULL
);
```

**Aggregate tài khoản — deposit/withdraw qua events:**

```typescript
type AccountEvent =
  | { type: 'AccountOpened'; payload: { accountId: string; ownerId: string } }
  | { type: 'MoneyDeposited'; payload: { amountCents: number } }
  | { type: 'MoneyWithdrawn'; payload: { amountCents: number } };

export class Account {
  private constructor(
    public readonly id: string,
    private balanceCents = 0,
    public version = 0,                       // version đã persist (cho optimistic lock)
    private pending: AccountEvent[] = [],     // events mới, chưa persist
  ) {}

  // ---- Rehydrate: dựng state bằng replay ----
  static fromHistory(id: string, events: AccountEvent[], fromSnapshot?: { state: any; version: number }): Account {
    const acc = fromSnapshot
      ? new Account(id, fromSnapshot.state.balanceCents, fromSnapshot.version)
      : new Account(id);
    for (const e of events) { acc.apply(e); acc.version++; }
    return acc;
  }

  // ---- Command methods: validate invariant → emit event (KHÔNG mutate trực tiếp) ----
  deposit(amountCents: number): void {
    if (amountCents <= 0) throw new Error('Amount must be positive');
    this.raise({ type: 'MoneyDeposited', payload: { amountCents } });
  }

  withdraw(amountCents: number): void {
    if (amountCents <= 0) throw new Error('Amount must be positive');
    if (this.balanceCents < amountCents) throw new Error('Insufficient funds'); // invariant
    this.raise({ type: 'MoneyWithdrawn', payload: { amountCents } });
  }

  // ---- Apply: cách DUY NHẤT state thay đổi — dùng cho cả replay lẫn event mới ----
  private apply(e: AccountEvent): void {
    switch (e.type) {
      case 'MoneyDeposited': this.balanceCents += e.payload.amountCents; break;
      case 'MoneyWithdrawn': this.balanceCents -= e.payload.amountCents; break;
    }
  }

  private raise(e: AccountEvent): void { this.apply(e); this.pending.push(e); }
  pullPendingEvents(): AccountEvent[] { const p = this.pending; this.pending = []; return p; }
}
```

**Repository: load (snapshot + replay) và save (append với optimistic concurrency):**

```typescript
export class EventSourcedAccountRepository {
  constructor(private readonly db: Pool) {}

  async load(accountId: string): Promise<Account> {
    const streamId = `account-${accountId}`;
    const snap = (await this.db.query('SELECT state, version FROM snapshots WHERE stream_id=$1', [streamId])).rows[0];
    const { rows: events } = await this.db.query(
      'SELECT type, payload FROM events WHERE stream_id=$1 AND version > $2 ORDER BY version',
      [streamId, snap?.version ?? 0],
    );
    return Account.fromHistory(accountId, events, snap);
  }

  async save(account: Account): Promise<void> {
    const events = account.pullPendingEvents();
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      let version = account.version;
      for (const e of events) {
        version++;
        // UNIQUE(stream_id, version) → nếu writer khác đã chen vào, INSERT fail → retry command
        await client.query(
          'INSERT INTO events (stream_id, version, type, payload) VALUES ($1,$2,$3,$4)',
          [`account-${account.id}`, version, e.type, e.payload],
        );
      }
      // Snapshot mỗi 100 events để load nhanh (tránh replay hàng triệu event)
      if (version % 100 < events.length) {
        await client.query(
          `INSERT INTO snapshots (stream_id, version, state) VALUES ($1,$2,$3)
           ON CONFLICT (stream_id) DO UPDATE SET version=$2, state=$3`,
          [`account-${account.id}`, version, account.toSnapshot()],
        );
      }
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  }
}
```

**Projection xây read model (đọc tuần tự theo `global_position`, lưu checkpoint):**

```typescript
export class BalanceProjection {
  // chạy như worker: poll events mới hơn checkpoint, apply, lưu checkpoint
  async catchUp(db: Pool): Promise<void> {
    const checkpoint = await this.getCheckpoint(db); // SELECT position FROM projection_checkpoints ...
    const { rows } = await db.query(
      'SELECT global_position, stream_id, type, payload FROM events WHERE global_position > $1 ORDER BY global_position LIMIT 500',
      [checkpoint],
    );
    for (const e of rows) {
      if (e.type === 'MoneyDeposited')
        await db.query('UPDATE account_balances SET balance_cents = balance_cents + $1 WHERE stream_id=$2', [e.payload.amountCents, e.stream_id]);
      if (e.type === 'MoneyWithdrawn')
        await db.query('UPDATE account_balances SET balance_cents = balance_cents - $1 WHERE stream_id=$2', [e.payload.amountCents, e.stream_id]);
      await this.saveCheckpoint(db, e.global_position);
    }
  }
}
```

### Use case thực tế & thư viện hỗ trợ

- **Khi nào dùng**: domain cần **audit nghiêm ngặt** — tài chính/ngân hàng (sổ cái, ví điện tử), kế toán, healthcare, hệ thống pháp lý; hoặc domain mà "chuyện gì đã xảy ra" chính là nghiệp vụ (booking, trading). Ledger ngân hàng bản chất đã là event sourcing từ trăm năm nay.
- Thư viện/công cụ: **EventStoreDB** (KurrentDB — purpose-built), **Marten** (.NET, để tham khảo concept), trong hệ Node có **Emmett**, `@event-driven-io`, hoặc tự build trên Postgres như trên (rất phổ biến). Kafka **không phải** event store lý tưởng (khó đọc per-stream, không optimistic concurrency per-aggregate).

### ⚠️ Trade-offs / khi nào không nên dùng

- **Complexity là trade-off lớn nhất**: mọi query đều phải qua projection; debug cần hiểu replay; onboarding dev mới chậm. Đây là một trong những pattern bị "dùng nhầm" gây hối hận nhiều nhất.
- **Eventual consistency**: read model luôn trễ hơn write một nhịp → UI/UX và nghiệp vụ phải chấp nhận.
- **Schema evolution của event** là bài toán khó nhất về lâu dài: event đã ghi là bất biến, nhưng code đọc thì tiến hóa → cần versioning (`MoneyDeposited.v2`), upcaster (transform event cũ → format mới lúc đọc), weak schema (tolerant reader). Không bao giờ được "sửa event cũ trong DB".
- Xóa dữ liệu (GDPR right-to-erasure) khó: event bất biến → giải bằng crypto-shredding (mã hóa PII bằng key per-user, xóa key) hoặc tách PII ra ngoài event.
- **Không dùng** cho CRUD đơn giản, domain ít quan tâm lịch sử, team chưa từng vận hành event-driven system.

### 💬 Câu hỏi phỏng vấn liên quan

**Q: Replay hàng triệu event mỗi lần load aggregate thì chậm — giải quyết sao?**
A: Snapshot: định kỳ (vd mỗi 100 events) lưu state đã tính kèm version; lúc load lấy snapshot rồi chỉ replay events sau đó. Snapshot là optimization thuần túy — xóa đi vẫn rebuild được từ events.

**Q: Hai request cùng withdraw trên một account đồng thời thì sao?**
A: Optimistic concurrency qua `UNIQUE(stream_id, version)`: cả hai load ở version N, cùng cố append version N+1, một bên fail unique constraint → retry command (load lại state mới, re-validate invariant). Không cần pessimistic lock.

**Q: Event đã ghi 3 năm trước nhưng code mới đổi cấu trúc payload — xử lý thế nào?**
A: Không sửa event cũ. Dùng upcasting (hàm transform v1→v2 chạy lúc đọc), versioned event types, hoặc tolerant reader (field mới optional có default). Trường hợp nặng mới copy-transform sang stream mới (migration có chủ đích).

---

## 5. Saga Pattern (Orchestration vs Choreography)

### Vấn đề nó giải quyết

- Microservices: một nghiệp vụ trải qua nhiều service với **database riêng** (order → payment → inventory → shipping). Không thể dùng local transaction; **2PC/XA** thì gần như không khả thi trong thực tế hiện đại (blocking, coordinator là SPOF, Kafka/HTTP/NoSQL không hỗ trợ).
- Saga: chuỗi **local transaction**, mỗi bước commit xong mới sang bước sau; nếu một bước fail → chạy **compensation** (giao dịch bù) đảo ngược các bước đã commit theo thứ tự ngược. Đổi atomicity lấy availability — chấp nhận trạng thái trung gian.

### Cách triển khai trong Node.js/TypeScript

**Kiểu 1 — Orchestration: một orchestrator điều khiển step-by-step:**

```typescript
interface SagaStep<TCtx> {
  name: string;
  invoke(ctx: TCtx): Promise<void>;
  compensate(ctx: TCtx): Promise<void>; // PHẢI idempotent + không được fail vĩnh viễn
}

export class SagaOrchestrator<TCtx> {
  constructor(private readonly steps: SagaStep<TCtx>[], private readonly log: SagaLogRepository) {}

  async execute(sagaId: string, ctx: TCtx): Promise<void> {
    const done: SagaStep<TCtx>[] = [];
    for (const step of this.steps) {
      try {
        await this.log.record(sagaId, step.name, 'STARTED'); // persist state để recover sau crash
        await step.invoke(ctx);
        await this.log.record(sagaId, step.name, 'DONE');
        done.push(step);
      } catch (err) {
        await this.log.record(sagaId, step.name, 'FAILED');
        // Compensate theo thứ tự NGƯỢC các bước đã xong
        for (const s of done.reverse()) {
          try {
            await s.compensate(ctx);
            await this.log.record(sagaId, s.name, 'COMPENSATED');
          } catch (cErr) {
            await this.log.record(sagaId, s.name, 'COMPENSATION_FAILED'); // → retry bởi recovery worker / alert con người
          }
        }
        throw new SagaFailedError(sagaId, step.name, err);
      }
    }
  }
}

// ---- Luồng đặt hàng ----
interface OrderSagaCtx { orderId: string; userId: string; items: Item[]; amountCents: number; paymentId?: string; reservationId?: string; }

const placeOrderSaga = new SagaOrchestrator<OrderSagaCtx>([
  {
    name: 'reserve-inventory',
    invoke: async (ctx) => { ctx.reservationId = await inventoryClient.reserve(ctx.orderId, ctx.items); },
    compensate: async (ctx) => { if (ctx.reservationId) await inventoryClient.release(ctx.reservationId); },
  },
  {
    name: 'charge-payment',
    invoke: async (ctx) => { ctx.paymentId = await paymentClient.charge(ctx.userId, ctx.amountCents, ctx.orderId /* idempotency key */); },
    compensate: async (ctx) => { if (ctx.paymentId) await paymentClient.refund(ctx.paymentId); },
  },
  {
    name: 'confirm-order',
    invoke: async (ctx) => { await orderRepo.updateStatus(ctx.orderId, 'CONFIRMED'); },
    compensate: async (ctx) => { await orderRepo.updateStatus(ctx.orderId, 'CANCELLED'); },
  },
], sagaLogRepo);
```

**Kiểu 2 — Choreography: không có chỉ huy, service phản ứng theo event của nhau (Kafka):**

```typescript
// Order Service: tạo order PENDING, phát event (qua outbox — pattern #6)
async function placeOrder(cmd: PlaceOrderCommand) {
  await uow.run(async ({ orders, outbox }) => {
    await orders.save({ ...order, status: 'PENDING' });
    await outbox.add({ topic: 'order.events', type: 'OrderPlaced', payload: order });
  });
}

// Inventory Service: nghe OrderPlaced → reserve → phát kết quả
consumer.on('OrderPlaced', async (evt) => {
  try {
    await reserveStock(evt.orderId, evt.items);
    await publish('inventory.events', { type: 'StockReserved', orderId: evt.orderId });
  } catch {
    await publish('inventory.events', { type: 'StockReservationFailed', orderId: evt.orderId });
  }
});

// Payment Service: nghe StockReserved → charge → phát kết quả
consumer.on('StockReserved', async (evt) => {
  try {
    const paymentId = await charge(evt.orderId);
    await publish('payment.events', { type: 'PaymentCompleted', orderId: evt.orderId, paymentId });
  } catch {
    await publish('payment.events', { type: 'PaymentFailed', orderId: evt.orderId });
  }
});

// Order Service: nghe kết quả để chốt
consumer.on('PaymentCompleted', (evt) => orderRepo.updateStatus(evt.orderId, 'CONFIRMED'));
consumer.on('PaymentFailed',    (evt) => orderRepo.updateStatus(evt.orderId, 'CANCELLED'));
// Inventory Service cũng nghe PaymentFailed để release stock (compensation phân tán)
consumer.on('PaymentFailed',    (evt) => releaseStock(evt.orderId));
```

**Bảng so sánh — khi nào dùng kiểu nào:**

| Tiêu chí | Orchestration | Choreography |
|---|---|---|
| Luồng nghiệp vụ nằm ở đâu | Tập trung 1 chỗ — đọc orchestrator là hiểu toàn bộ flow | Rải rác khắp các consumer — phải ghép nhiều repo mới hiểu |
| Coupling | Orchestrator biết mọi service (coupling hướng tâm) | Service chỉ biết event, không biết nhau (loose coupling) |
| Thêm bước mới | Sửa orchestrator | Thêm consumer mới, không sửa code cũ |
| Debug / trace | Dễ (saga log tập trung) | Khó (cần distributed tracing, correlation id) |
| Rủi ro đặc trưng | Orchestrator phình thành "god service", SPOF logic | Cyclic dependency giữa events, flow ngầm không ai nắm |
| Hợp với | Flow dài (≥3-4 bước), nhiều rẽ nhánh, cần SLA/timeout per step | Flow ngắn (2-3 bước), các domain thật sự độc lập |

**Thiết kế compensation action — các nguyên tắc senior cần nói:**
- Compensation là **semantic rollback**, không phải undo kỹ thuật: refund ≠ "chưa từng charge" (email đã gửi, sao kê đã hiện) — nghiệp vụ phải chấp nhận.
- Compensation phải **idempotent** (có thể bị gọi lại khi retry) và **commutative-safe** với retry của invoke (charge đang bay + refund tới trước → cần idempotency key phía provider).
- Có những bước **không bù được** (đã gửi hàng, đã bắn tiền liên ngân hàng) → xếp **pivot transaction** (bước không thể quay đầu) **cuối cùng**; các bước trước pivot là compensatable, sau pivot là retryable (chỉ tiến, retry tới khi thành công).
- Saga state phải **persist** (saga log) để process crash giữa chừng vẫn recover/tiếp tục compensate.

### Use case thực tế & thư viện hỗ trợ

- **Temporal** (rất đáng nhắc trong phỏng vấn 2024+): durable execution — viết orchestrator như code tuần tự, framework lo persist state, retry, timeout. Saga = try/catch + compensations list trong workflow. Có SDK TypeScript chính thức.
- **AWS Step Functions** — orchestration managed, định nghĩa state machine JSON.
- **NestJS Sagas** (`@nestjs/cqrs`) — choreography nhẹ trong-process.
- BullMQ flows, Kafka + tự viết — phổ biến ở các team Việt Nam.
- Use case: đặt hàng e-commerce, booking vé (giữ chỗ → thanh toán → xuất vé), mở tài khoản ngân hàng (KYC → tạo account → phát hành thẻ), chuyển tiền liên ví.

### ⚠️ Trade-offs / khi nào không nên dùng

- Mất **isolation** (chữ I của ACID): trạng thái trung gian lộ ra ngoài (đơn PENDING, tiền đã trừ nhưng hàng chưa giữ) → cần semantic lock (đánh dấu record "đang trong saga"), hoặc thiết kế nghiệp vụ chịu được.
- Độ phức tạp vận hành cao: saga kẹt giữa chừng, compensation fail liên tục → cần dashboard, alert, quy trình can thiệp tay.
- **Nếu các bước cùng một database → đừng dùng saga, dùng local transaction.** Câu này nói ra trong phỏng vấn được điểm to: sai lầm phổ biến là chia microservice quá nhỏ rồi phải gánh saga cho thứ đáng lẽ là 1 transaction.
- Choreography quá 4-5 bước → flow trở thành "spaghetti event" không ai vẽ lại được.

### 💬 Câu hỏi phỏng vấn liên quan

**Q: Tại sao không dùng 2PC cho distributed transaction giữa các microservice?**
A: 2PC blocking (giữ lock chờ coordinator), coordinator là SPOF, giảm availability của toàn chuỗi xuống tích availability các bên, và hầu hết hạ tầng hiện đại (HTTP API, Kafka, nhiều NoSQL) không hỗ trợ XA. Saga đổi atomicity tức thời lấy availability + eventual consistency, hợp với CAP của hệ phân tán.

**Q: Compensation fail thì sao?**
A: Compensation phải được retry tới khi thành công (thiết kế idempotent), có saga log persist để recovery worker tiếp tục sau crash; nếu fail vĩnh viễn (bug, data hỏng) → đẩy vào dead letter + alert con người. Đồng thời xếp các bước không thể bù (pivot) về cuối saga để giảm xác suất phải bù thứ khó bù.

**Q: Khi nào chọn choreography thay vì orchestration?**
A: Flow ngắn 2-3 bước, các service thuộc domain độc lập, muốn thêm reaction mới không đụng code cũ → choreography. Flow dài, nhiều nhánh điều kiện, cần nhìn thấy/giám sát toàn bộ tiến trình, cần timeout per-step → orchestration (hoặc Temporal). Thực tế nhiều hệ dùng lai: orchestration trong bounded context, choreography giữa các context.

---

## 6. Outbox Pattern & Transactional Messaging

### Vấn đề nó giải quyết

**Dual write problem** — bug kinh điển nhất của event-driven system:

```typescript
// ❌ HAI hệ thống, KHÔNG có transaction chung
await orderRepo.save(order);                  // ghi Postgres — OK
await kafka.send({ topic: 'order.placed' }); // crash/timeout ở đây → DB có order, Kafka KHÔNG có event
// (đảo thứ tự cũng tệ: event đã bay nhưng DB rollback → event "ma")
```

Hệ quả: downstream (inventory, email, search index) **lệch dữ liệu vĩnh viễn** và rất khó truy. Outbox pattern giải quyết bằng cách ghi event vào **bảng outbox trong CÙNG transaction với business data** — DB transaction lo atomicity; một tiến trình riêng (relay) chuyển event từ outbox sang broker sau đó.

### Cách triển khai trong Node.js/TypeScript

**Schema:**

```sql
CREATE TABLE outbox (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type TEXT NOT NULL,         -- 'order'
  aggregate_id   TEXT NOT NULL,         -- dùng làm Kafka partition key → giữ ordering per-aggregate
  type           TEXT NOT NULL,         -- 'OrderPlaced'
  payload        JSONB NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at   TIMESTAMPTZ            -- NULL = chưa gửi
);
CREATE INDEX idx_outbox_unpublished ON outbox (created_at) WHERE published_at IS NULL;

-- Phía CONSUMER: bảng dedup cho idempotent consumer
CREATE TABLE processed_messages (
  consumer_group TEXT NOT NULL,
  message_id     UUID NOT NULL,
  processed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer_group, message_id)
);
```

**1) Ghi order + outbox trong cùng transaction:**

```typescript
export class PlaceOrderUseCase {
  constructor(private readonly pool: Pool) {}

  async execute(cmd: PlaceOrderCommand): Promise<string> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const orderId = crypto.randomUUID();
      await client.query(
        'INSERT INTO orders (id, user_id, total_cents, status) VALUES ($1,$2,$3,$4)',
        [orderId, cmd.userId, cmd.totalCents, 'PENDING'],
      );

      // ⭐ CÙNG transaction — hoặc cả hai cùng commit, hoặc cả hai cùng biến mất
      await client.query(
        `INSERT INTO outbox (aggregate_type, aggregate_id, type, payload) VALUES ('order', $1, 'OrderPlaced', $2)`,
        [orderId, JSON.stringify({ orderId, userId: cmd.userId, totalCents: cmd.totalCents, placedAt: new Date().toISOString() })],
      );

      await client.query('COMMIT');
      return orderId;
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  }
}
```

**2) Relay worker — polling publisher (đọc outbox → publish Kafka → đánh dấu):**

```typescript
export class OutboxRelay {
  constructor(private readonly pool: Pool, private readonly producer: KafkaProducer) {}

  async start(intervalMs = 500): Promise<void> {
    while (true) {
      const sent = await this.relayBatch();
      if (sent === 0) await sleep(intervalMs); // không có việc thì nghỉ; có việc thì poll tiếp ngay
    }
  }

  private async relayBatch(): Promise<number> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // FOR UPDATE SKIP LOCKED → chạy được NHIỀU relay instance song song không giẫm nhau
      const { rows } = await client.query(
        `SELECT id, aggregate_id, type, payload FROM outbox
         WHERE published_at IS NULL
         ORDER BY created_at
         LIMIT 100
         FOR UPDATE SKIP LOCKED`,
      );
      if (rows.length === 0) { await client.query('COMMIT'); return 0; }

      await this.producer.sendBatch({
        topicMessages: [{
          topic: 'order.events',
          messages: rows.map((r) => ({
            key: r.aggregate_id,                 // partition theo aggregate → ordering per-order
            value: JSON.stringify({ id: r.id, type: r.type, ...r.payload }), // mang theo outbox id làm message id
            headers: { 'message-id': r.id, 'event-type': r.type },
          })),
        }],
      });

      await client.query(
        'UPDATE outbox SET published_at = now() WHERE id = ANY($1)',
        [rows.map((r) => r.id)],
      );
      await client.query('COMMIT');
      return rows.length;
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  }
}
```

Lưu ý quan trọng để nói trong phỏng vấn: nếu relay crash **sau khi publish, trước khi UPDATE** → event sẽ được gửi lại → outbox cho ta **at-least-once**, KHÔNG phải exactly-once. Vì vậy **bắt buộc đi kèm idempotent consumer**.

**3) Idempotent consumer phía nhận (bảng `processed_messages`):**

```typescript
consumer.run({
  eachMessage: async ({ message }) => {
    const messageId = message.headers!['message-id']!.toString();
    const evt = JSON.parse(message.value!.toString());

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Insert dedup record TRƯỚC — unique constraint là chốt chặn
      const res = await client.query(
        `INSERT INTO processed_messages (consumer_group, message_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        ['inventory-service', messageId],
      );
      if (res.rowCount === 0) { await client.query('COMMIT'); return; } // đã xử lý rồi → bỏ qua

      // Side effect nghiệp vụ — CÙNG transaction với dedup record
      await reserveStock(client, evt.orderId, evt.items);

      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; } // throw → Kafka không commit offset → retry
    finally { client.release(); }
  },
});
```

**4) CDC thay vì polling — Debezium (khái niệm):** Debezium đọc **WAL/binlog** của Postgres/MySQL (logical replication), thấy INSERT vào bảng `outbox` → tự publish sang Kafka (có SMT `EventRouter` chuyên cho outbox). Ưu: latency thấp (ms), không tốn query polling, không đụng code app. Nhược: thêm hạ tầng (Kafka Connect cluster), vận hành replication slot (slot đầy → WAL phình → nguy hiểm disk). Polling đơn giản hơn nhiều và đủ tốt cho đa số hệ thống có latency yêu cầu ~giây.

### Use case thực tế & thư viện hỗ trợ

- Bất kỳ chỗ nào "ghi DB xong phải báo cho hệ khác": order placed → email/inventory/search-index; user registered → CRM; payment captured → ledger.
- Thư viện: **Debezium** (CDC), MikroORM/TypeORM + tự viết relay (phổ biến nhất trong Node), **pg-transactional-outbox** (npm), NestJS + BullMQ làm relay. Trong hệ .NET có CAP/MassTransit — nhắc để thể hiện hiểu biết ecosystem.
- Outbox là **nền móng của saga choreography** (pattern #5) và event sourcing projection — mọi event công bố ra ngoài đều nên đi qua outbox.

### ⚠️ Trade-offs / khi nào không nên dùng

- Latency: event tới broker trễ hơn (polling interval). Cần realtime ms → CDC.
- Bảng outbox phình → cần job dọn (`DELETE WHERE published_at < now() - interval '7 days'`) hoặc partition theo ngày.
- Chỉ cho **at-least-once** → toàn bộ downstream phải idempotent (không né được, nhưng đằng nào hệ event-driven cũng phải thế).
- Không cần outbox khi: event chỉ là cache invalidation/notification "mất cũng không sao", hoặc nguồn sự thật là chính message (khi đó publish trước, consumer ghi DB).

### 💬 Câu hỏi phỏng vấn liên quan

**Q: Tại sao không publish Kafka trước rồi ghi DB sau (hoặc ngược lại) mà phải cần outbox?**
A: Hai hệ thống không có transaction chung — crash giữa hai thao tác tạo ra trạng thái lệch không thể tự phát hiện (DB có data nhưng event mất, hoặc event "ma" cho transaction đã rollback). Outbox đưa cả hai thao tác ghi vào MỘT transaction DB; việc chuyển sang broker được tách thành quá trình async có retry.

**Q: Outbox cho exactly-once delivery không?**
A: Không — at-least-once: relay có thể crash sau publish trước khi đánh dấu, dẫn tới gửi trùng. Exactly-once delivery thuần túy là bất khả thi trong hệ phân tán; ta đạt "exactly-once processing" về mặt nghiệp vụ bằng idempotent consumer (dedup theo message id với unique constraint, cùng transaction với side effect).

**Q: Polling relay vs Debezium CDC — chọn gì?**
A: Polling: đơn giản, không thêm hạ tầng, latency ~poll interval, tốn query — đủ cho đa số. CDC/Debezium: latency ms, không ảnh hưởng app, nhưng phải vận hành Kafka Connect + replication slot. Bắt đầu bằng polling, chuyển CDC khi scale/latency đòi hỏi.

---

## 7. Circuit Breaker, Retry, Bulkhead, Timeout (Resilience patterns)

### Vấn đề nó giải quyết

- Trong microservices, **lỗi lan truyền (cascading failure)**: payment service chậm → các request của order service treo chờ → event loop/connection pool của order service cạn → order service chết theo → cả hệ sập vì một dependency.
- Nhóm pattern này không ngăn lỗi xảy ra mà **ngăn lỗi lan**: Timeout chặn chờ vô hạn; Retry vượt qua lỗi thoáng qua; Circuit Breaker ngừng gọi dependency đang chết (fail fast + cho nó thời gian hồi); Bulkhead cô lập tài nguyên để một dependency hỏng không nuốt hết tài nguyên dùng chung.

### Cách triển khai trong Node.js/TypeScript

**1) Circuit Breaker class đầy đủ — 3 trạng thái CLOSED / OPEN / HALF_OPEN:**

```typescript
type BreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreakerOpenError extends Error {
  constructor(public readonly breakerName: string) { super(`Circuit breaker [${breakerName}] is OPEN`); }
}

export interface CircuitBreakerOptions {
  failureThreshold: number;   // số failure liên tiếp (hoặc % trong window) để mở mạch
  resetTimeoutMs: number;     // OPEN bao lâu thì cho thử lại (HALF_OPEN)
  halfOpenMaxCalls: number;   // số call thử trong HALF_OPEN
  callTimeoutMs: number;      // timeout mỗi call — timeout cũng tính là failure
}

export class CircuitBreaker {
  private state: BreakerState = 'CLOSED';
  private consecutiveFailures = 0;
  private openedAt = 0;
  private halfOpenInFlight = 0;
  private halfOpenSuccesses = 0;

  constructor(private readonly name: string, private readonly opts: CircuitBreakerOptions) {}

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.openedAt >= this.opts.resetTimeoutMs) {
        this.transition('HALF_OPEN'); // hết thời gian phạt → cho thử
      } else {
        throw new CircuitBreakerOpenError(this.name); // ⭐ fail fast, không tốn 1ms chờ
      }
    }

    if (this.state === 'HALF_OPEN' && this.halfOpenInFlight >= this.opts.halfOpenMaxCalls) {
      throw new CircuitBreakerOpenError(this.name); // HALF_OPEN chỉ cho lọt vài call thăm dò
    }

    this.halfOpenInFlight++;
    try {
      const result = await this.withTimeout(fn);
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    } finally {
      this.halfOpenInFlight--;
    }
  }

  private async withTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error(`[${this.name}] timed out after ${this.opts.callTimeoutMs}ms`)), this.opts.callTimeoutMs).unref(),
      ),
    ]);
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.halfOpenSuccesses++;
      if (this.halfOpenSuccesses >= this.opts.halfOpenMaxCalls) this.transition('CLOSED'); // hồi phục
    } else {
      this.consecutiveFailures = 0;
    }
  }

  private onFailure(): void {
    if (this.state === 'HALF_OPEN') { this.transition('OPEN'); return; } // thử mà fail → đóng cửa tiếp
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.opts.failureThreshold) this.transition('OPEN');
  }

  private transition(to: BreakerState): void {
    this.state = to;
    if (to === 'OPEN') this.openedAt = Date.now();
    if (to === 'HALF_OPEN' || to === 'CLOSED') { this.halfOpenInFlight = 0; this.halfOpenSuccesses = 0; this.consecutiveFailures = 0; }
    metrics.gauge(`breaker.${this.name}.state`, to); // ⭐ state change PHẢI có metric/alert
  }
}

// Usage
const paymentBreaker = new CircuitBreaker('payment-service', {
  failureThreshold: 5, resetTimeoutMs: 30_000, halfOpenMaxCalls: 2, callTimeoutMs: 2_000,
});
const result = await paymentBreaker.exec(() => paymentClient.charge(req));
```

(Phiên bản production nên đếm theo **rolling window + tỉ lệ lỗi** — vd "≥50% lỗi trong 10s với tối thiểu 20 request" — thay vì consecutive count; opossum làm sẵn việc này.)

**2) Retry với exponential backoff + full jitter:**

```typescript
export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  isRetryable?: (err: unknown) => boolean; // ⭐ chỉ retry lỗi đáng retry
}

export async function retry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const retryable = opts.isRetryable?.(err) ?? true;
      if (!retryable || attempt === opts.maxAttempts) throw err;

      // Exponential: base * 2^(attempt-1), chặn trần maxDelay
      const expDelay = Math.min(opts.baseDelayMs * 2 ** (attempt - 1), opts.maxDelayMs);
      // ⭐ FULL JITTER: random(0, expDelay) — phá "retry storm" khi nghìn client cùng retry nhịp nhàng
      const delay = Math.random() * expDelay;
      await sleep(delay);
    }
  }
  throw lastErr;
}

// Usage: chỉ retry lỗi transient (network, 5xx, 429) — KHÔNG retry 400/422 (retry cũng vẫn fail)
await retry(() => paymentClient.charge(req), {
  maxAttempts: 3, baseDelayMs: 200, maxDelayMs: 5_000,
  isRetryable: (e) => e instanceof NetworkError || (e instanceof HttpError && (e.status >= 500 || e.status === 429)),
});
```

**Retry budget** (khái niệm nên nhắc): giới hạn **tổng** retry toàn service, vd "retry ≤ 10% tổng request" — vì khi downstream suy yếu, retry per-request × N client = nhân tải lên hệ đang hấp hối (retry storm tự giết mình). Cài đặt: token bucket cho retry; hết budget thì fail luôn không retry. Linkerd/Envoy có sẵn cơ chế này.

**3) Bulkhead — semaphore giới hạn concurrent calls per dependency:**

```typescript
export class Bulkhead {
  private inFlight = 0;
  private queue: { resolve: () => void; reject: (e: Error) => void }[] = [];

  constructor(
    private readonly name: string,
    private readonly maxConcurrent: number, // số call đồng thời tối đa tới dependency này
    private readonly maxQueue: number,      // hàng đợi tối đa — quá thì reject ngay (load shedding)
  ) {}

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    if (this.inFlight >= this.maxConcurrent) {
      if (this.queue.length >= this.maxQueue) {
        throw new Error(`Bulkhead [${this.name}] full — rejecting`); // ⭐ fail fast thay vì xếp hàng vô hạn
      }
      await new Promise<void>((resolve, reject) => this.queue.push({ resolve, reject }));
    }
    this.inFlight++;
    try {
      return await fn();
    } finally {
      this.inFlight--;
      this.queue.shift()?.resolve(); // nhả slot cho thằng xếp hàng kế tiếp
    }
  }
}

// Mỗi dependency một khoang riêng — payment sập cũng chỉ nuốt tối đa 20 "slot", không lây sang inventory
const paymentBulkhead = new Bulkhead('payment', 20, 50);
const inventoryBulkhead = new Bulkhead('inventory', 50, 100);
```

**4) Phối hợp các pattern — đúng thứ tự từ ngoài vào trong:**

| Thứ tự (ngoài → trong) | Pattern | Lý do đặt ở vị trí này |
|---|---|---|
| 1 | **Bulkhead** | Chặn từ cửa: không cho 1 dependency chiếm hết tài nguyên, kể cả tài nguyên để... retry |
| 2 | **Retry** (+ budget) | Retry bọc NGOÀI breaker: lần retry sau có thể trúng lúc breaker đã cho qua / instance khác |
| 3 | **Circuit Breaker** | Đếm failure sau cùng (gồm cả timeout), fail fast khi downstream chết — retry sẽ thấy `BreakerOpenError` (non-retryable hoặc fallback luôn) |
| 4 | **Timeout** | Trong cùng, sát call thật — mỗi attempt có deadline riêng; timeout là input cho breaker |
| (bao trùm) | **Fallback** | Hết tất cả → trả degraded response (cache cũ, default, queue lại xử lý sau) |

```typescript
// Tổng hợp: bulkhead( retry( breaker( timeout( call )))) + fallback
async function chargePayment(req: ChargeRequest): Promise<ChargeResult> {
  try {
    return await paymentBulkhead.exec(() =>
      retry(() => paymentBreaker.exec(() => paymentClient.charge(req)), // breaker đã có timeout bên trong
        { maxAttempts: 3, baseDelayMs: 200, maxDelayMs: 2_000, isRetryable: (e) => !(e instanceof CircuitBreakerOpenError) && isTransient(e) },
      ));
  } catch (e) {
    // Fallback: ghi nhận pending, xử lý async sau — đừng để user thấy 500 nếu nghiệp vụ cho phép
    await paymentRetryQueue.add({ req });
    return { status: 'PENDING_RETRY' };
  }
}
```

### Use case thực tế & thư viện hỗ trợ

- **opossum** — circuit breaker chuẩn nhất hệ Node (rolling window %, fallback, events, metrics Prometheus).
- **cockatiel** — "Polly của Node": retry, breaker, timeout, bulkhead, fallback + `Policy.wrap()` compose đúng thứ tự. Rất đáng dùng thay vì tự viết.
- **p-retry, p-limit, p-queue** — building block nhỏ gọn.
- Tầng hạ tầng: **Envoy/Istio/Linkerd** (retry budget, outlier detection), Nginx, AWS ALB — phỏng vấn nên nói được "resilience có thể đặt ở service mesh thay vì code".
- Mọi outbound call (HTTP, gRPC, Redis, DB) trong hệ microservices đều nên có ít nhất **timeout**; call sang third-party (payment gateway, SMS) bắt buộc đủ bộ.

### ⚠️ Trade-offs / khi nào không nên dùng

- **Retry lên operation không idempotent = thảm họa** (charge tiền 2 lần). Chỉ retry khi có idempotency key (pattern #10) hoặc operation tự nhiên idempotent.
- Breaker per-instance (in-memory) → mỗi pod có view riêng, mở/đóng lệch nhau; cần nhất quán toàn cluster thì để mesh/proxy làm hoặc share state (hiếm khi đáng).
- Tham số sai còn tệ hơn không có: threshold quá nhạy → breaker chập chờn (flapping); timeout dài hơn timeout của caller phía trên → vô nghĩa (deadline phải **giảm dần** từ ngoài vào trong — deadline propagation).
- Đừng bọc resilience cho call nội bộ in-process hoặc DB chính của service (DB chết thì service chết là đúng — fail fast lên health check để orchestrator xử lý).

### 💬 Câu hỏi phỏng vấn liên quan

**Q: Mô tả 3 trạng thái của circuit breaker và điều kiện chuyển trạng thái.**
A: CLOSED — cho call qua, đếm failure; vượt threshold (số/tỉ lệ lỗi trong window) → OPEN. OPEN — chặn mọi call, fail fast ngay; hết resetTimeout → HALF_OPEN. HALF_OPEN — cho lọt vài call thăm dò; thành công đủ → CLOSED, fail → OPEN lại. Mục đích kép: bảo vệ caller (không treo) và cho downstream thời gian hồi phục (không bị retry dồn dập).

**Q: Tại sao retry cần jitter?**
A: Không có jitter, hàng nghìn client fail cùng lúc sẽ retry đồng nhịp (200ms, 400ms, 800ms...) tạo các "đợt sóng" tải dồn vào downstream đang yếu — thundering herd/retry storm. Full jitter (random 0→expDelay) trải đều retry theo thời gian. Kèm theo nên có retry budget để tổng lượng retry không khuếch đại tải.

**Q: Bulkhead khác gì rate limiting?**
A: Rate limit giới hạn theo *tốc độ request vào* (requests/giây, thường per-client, mục đích công bằng/chống abuse). Bulkhead giới hạn theo *concurrency ra* (số call đồng thời tới một dependency, mục đích cô lập tài nguyên) — tên lấy từ vách ngăn khoang tàu: thủng một khoang không chìm cả tàu. Một dependency chậm sẽ tự nhiên chiếm hết concurrency slot của nó và bị chặn, không lan sang dependency khác.

---

## 8. API Gateway & BFF (Backend for Frontend)

### Vấn đề nó giải quyết

- Client gọi thẳng N microservices → client phải biết topology nội bộ, N round-trip qua internet, auth/rate-limit/CORS lặp lại ở mọi service, không có chỗ đặt cross-cutting concern.
- **API Gateway** = single entry point: routing, authentication/authorization, rate limiting, TLS termination, request/response transform, caching, **aggregation** (gom nhiều call nội bộ thành 1 response), observability tập trung.
- **BFF**: một gateway chung cho mọi client lại sinh vấn đề khác — web cần payload đầy đủ, mobile cần payload gọn + ít round-trip (mạng yếu, pin), partner API cần versioning chặt. BFF = **mỗi loại frontend một backend riêng**, do chính team frontend đó own, trả về đúng hình dạng dữ liệu UI cần.

### Cách triển khai trong Node.js/TypeScript

**Aggregation endpoint trong BFF (Fastify) — gom 3 service thành 1 response, degrade từng phần:**

```typescript
// bff-mobile: màn hình "Order detail" của app mobile cần data từ 3 service
app.get('/mobile/orders/:id', { preHandler: [authenticate] }, async (req, reply) => {
  const { id } = req.params as { id: string };
  const userId = req.user.id;

  // ⭐ Gọi song song, KHÔNG tuần tự — và mỗi call đều có timeout + breaker (pattern #7)
  const [order, shipment, recommendations] = await Promise.allSettled([
    orderClient.getOrder(id, userId),                  // bắt buộc
    shippingClient.getShipment(id),                    // optional — fail thì degrade
    recoClient.getRecommendations(userId, { limit: 5 }) // optional
  ]);

  if (order.status === 'rejected') {
    return reply.code(502).send({ error: 'ORDER_SERVICE_UNAVAILABLE' }); // core data fail → fail cả
  }

  // ⭐ Trả về ĐÚNG hình dạng UI mobile cần: gọn, phẳng, đã format — không bắt app tự ghép
  return {
    order: {
      id: order.value.id,
      statusLabel: localizeStatus(order.value.status, req.headers['accept-language']),
      totalDisplay: formatMoney(order.value.totalCents, order.value.currency),
      items: order.value.items.map((i) => ({ name: i.name, qty: i.qty, thumb: cdnUrl(i.imageId, 'w=120') })),
    },
    tracking: shipment.status === 'fulfilled'
      ? { carrier: shipment.value.carrier, eta: shipment.value.eta, lastLocation: shipment.value.lastLocation }
      : null, // ⭐ graceful degradation — app render được dù shipping service chết
    suggestions: recommendations.status === 'fulfilled' ? recommendations.value : [],
  };
});
```

**Gateway tự viết tối giản bằng Node (routing + auth + rate limit + proxy):**

```typescript
import Fastify from 'fastify';
import proxy from '@fastify/http-proxy';
import rateLimit from '@fastify/rate-limit';

const gateway = Fastify({ logger: true });

await gateway.register(rateLimit, {
  max: 100, timeWindow: '1 minute',
  keyGenerator: (req) => req.user?.id ?? req.ip,    // per-user, fallback per-IP
  redis: redisClient,                                // ⭐ shared store — vì gateway chạy nhiều instance
});

gateway.addHook('onRequest', async (req, reply) => {
  if (isPublicRoute(req.url)) return;
  const token = req.headers.authorization?.replace('Bearer ', '');
  try {
    req.user = await verifyJwt(token); // verify TẠI gateway 1 lần
    // ⭐ truyền identity xuống service nội bộ qua header đã ký / network tin cậy
    req.headers['x-user-id'] = req.user.id;
    req.headers['x-user-roles'] = req.user.roles.join(',');
  } catch { return reply.code(401).send({ error: 'UNAUTHORIZED' }); }
});

// Routing theo prefix → từng upstream
await gateway.register(proxy, { upstream: 'http://order-service:3000', prefix: '/api/orders', rewritePrefix: '/orders' });
await gateway.register(proxy, { upstream: 'http://catalog-service:3000', prefix: '/api/products', rewritePrefix: '/products' });
```

**Tự viết bằng Node vs Kong/nginx/managed — bảng cân nhắc:**

| | Tự viết (Node/Fastify) | Kong / nginx / Envoy / AWS API GW |
|---|---|---|
| Logic custom (aggregation, A/B, business-aware routing) | Tự do tuyệt đối | Plugin/Lua/Wasm — gò bó hơn |
| Hiệu năng raw proxy | Tốt nhưng thua nginx/Envoy | Rất cao, battle-tested |
| Tính năng chuẩn (rate limit, auth, mTLS, retry) | Tự code/tự vá | Có sẵn, declarative config |
| Vận hành | Là một service mình phải own (deploy, scale, on-call) | Managed hoặc config-driven |
| Kết luận thực dụng | Hợp cho **BFF** (vốn nhiều logic) | Hợp cho **edge gateway** (cross-cutting thuần) |

Mô hình phổ biến: **edge gateway (Kong/ALB/nginx) lo TLS, WAF, rate limit thô → BFF bằng Node lo aggregation + shaping cho từng client**.

### Use case thực tế & thư viện hỗ trợ

- Netflix là cha đẻ khái niệm BFF (mỗi loại device một API layer riêng); Spotify, SoundCloud phổ biến hóa.
- **GraphQL như một dạng BFF**: Apollo Server/GraphQL federation cho client tự chọn field — giải quyết over/under-fetching mà không cần viết N BFF; trade-off là caching khó, complexity attack (query depth), N+1 (cần DataLoader).
- Thư viện Node: `@fastify/http-proxy`, `http-proxy-middleware` (Express), **Apollo Gateway/Router**, tRPC (BFF type-safe cho TypeScript monorepo).
- Managed: AWS API Gateway, Kong, Tyk, Apigee, Cloudflare Workers (BFF ở edge).

### ⚠️ Trade-offs / khi nào không nên dùng

- **Gateway thành monolith mới** — anti-pattern số 1: nhồi business logic vào gateway → mọi team cùng deploy chung một chỗ, gateway phải release theo nhịp của tất cả. Quy tắc: gateway chỉ chứa **cross-cutting concern + shaping**, business rule ở service. Nếu một route handler trong gateway bắt đầu gọi DB nghiệp vụ → sai rồi.
- Gateway là **SPOF + thêm 1 hop latency** → phải HA nhiều instance, và mọi resilience pattern (#7) áp dụng cho chính nó.
- BFF nhân số codebase: 3 loại client = 3 BFF — cần ROI rõ (khác biệt thực sự giữa các client) trước khi tách; 1 client duy nhất thì 1 BFF (hoặc chẳng cần) là đủ.
- Hệ chỉ có 2-3 service nội bộ + 1 web client → gateway riêng là over-engineering; nginx reverse proxy là đủ.

### 💬 Câu hỏi phỏng vấn liên quan

**Q: API Gateway khác gì BFF?**
A: Gateway là single entry point chung, tập trung cross-cutting concern (auth, rate limit, routing) — generic, không biết UI. BFF là gateway chuyên biệt per-frontend, own bởi team frontend đó, chứa presentation logic (aggregation, shaping, format) cho đúng một loại client. Thường dùng cả hai: edge gateway đứng trước, các BFF đứng sau.

**Q: Làm sao tránh gateway trở thành monolith mới?**
A: Kỷ luật ranh giới: gateway chỉ làm cross-cutting + aggregation/shaping, cấm business rule và cấm gọi thẳng database nghiệp vụ; tách BFF per-client để mỗi team own phần của mình thay vì chen chung; review định kỳ — handler nào "biết quá nhiều nghiệp vụ" thì đẩy xuống service.

**Q: Auth nên đặt ở gateway hay từng service?**
A: Authentication (verify token) đặt ở gateway — một lần, nhất quán; identity truyền xuống qua header tin cậy/JWT nội bộ. Authorization chi tiết (user này được sửa order kia không) phải ở service vì cần ngữ cảnh nghiệp vụ. Zero-trust thì service vẫn verify lại JWT nội bộ thay vì tin header trần.

---

## 9. Strangler Fig & Anti-corruption Layer

### Vấn đề nó giải quyết

- **Big-bang rewrite** monolith → microservices gần như luôn thất bại: 1-2 năm không ship feature, hệ mới chưa xong thì requirement đã đổi, ngày cutover rủi ro khổng lồ.
- **Strangler Fig** (Martin Fowler, đặt theo cây đa bóp nghẹt): dựng hệ mới **bao quanh** hệ cũ, route **từng phần** traffic sang service mới, dần dần hệ cũ teo lại rồi tắt hẳn. Mỗi bước nhỏ, đảo ngược được, vẫn ship feature song song.
- **Anti-corruption Layer (ACL)** (DDD — Eric Evans): khi hệ mới phải nói chuyện với hệ cũ, model bẩn/legacy của hệ cũ sẽ **rò rỉ** vào domain model mới. ACL là lớp dịch (adapter + translator) đứng giữa, giữ cho domain mới sạch.

### Cách triển khai trong Node.js/TypeScript

**1) Routing facade — chuyển dần traffic theo route + feature flag + % rollout:**

```typescript
// strangler-proxy.ts — đứng trước cả monolith lẫn service mới (thường chính là gateway)
const MIGRATED_ROUTES: { pattern: RegExp; upstream: string; flag: string }[] = [
  { pattern: /^\/api\/orders/,  upstream: 'http://order-service:3000',  flag: 'route-orders-to-new-service' },
  { pattern: /^\/api\/catalog/, upstream: 'http://catalog-service:3000', flag: 'route-catalog-to-new-service' },
  // các route còn lại → monolith
];

gateway.addHook('onRequest', async (req) => {
  const migrated = MIGRATED_ROUTES.find((r) => r.pattern.test(req.url));
  if (!migrated) { req.upstream = MONOLITH_URL; return; }

  // ⭐ Feature flag + % rollout + sticky theo user (một user không nhảy qua lại giữa 2 hệ trong 1 session)
  const enabled = await flags.isEnabled(migrated.flag, {
    userId: req.user?.id,
    percentage: await flags.getRolloutPercent(migrated.flag), // 1% → 10% → 50% → 100%
  });
  req.upstream = enabled ? migrated.upstream : MONOLITH_URL;
});
```

Feature flag ở đây là **van an toàn**: metric lỗi tăng → gạt flag về 0% trong vài giây, không cần deploy. Đi kèm 2 kỹ thuật nên nhắc:
- **Shadow traffic / dark launch**: route bản sao request sang service mới, so sánh response với monolith, KHÔNG trả cho user — verify trước khi nhận traffic thật.
- **Migration dữ liệu**: dual-write giai đoạn chuyển tiếp hoặc CDC từ DB monolith sang DB service mới; chốt bằng so khớp + cutover read.

**2) Anti-corruption Layer — adapter dịch model legacy ↔ domain mới:**

```typescript
// ---- Hệ CŨ (SOAP/DB cũ): model bẩn, khó hiểu, tiền là string, status là số magic ----
interface LegacyCustomerRecord {
  CUST_ID: string;
  CUST_NM: string;            // "NGUYEN VAN A  " (đệm space, uppercase)
  CUST_STS: '1' | '2' | '9';  // 1=active, 2=suspended, 9=deleted (tri thức bộ lạc)
  CRDT_LMT_AMT: string;       // "1500000.00" — string!
  ADDR_LN_1: string; ADDR_LN_2: string; ADDR_CTY: string;
}

// ---- Domain MỚI: model sạch theo ubiquitous language ----
interface Customer {
  id: string;
  fullName: string;
  status: 'ACTIVE' | 'SUSPENDED';
  creditLimitCents: number;
  address: { lines: string[]; city: string };
}

// ---- ACL: port (interface theo NGÔN NGỮ MỚI) + adapter (chứa toàn bộ sự bẩn) ----
export interface CustomerProvider { // domain mới chỉ biết interface này
  getActiveCustomer(id: string): Promise<Customer | null>;
}

export class LegacyCrmAntiCorruptionLayer implements CustomerProvider {
  constructor(private readonly legacyClient: LegacySoapClient) {}

  async getActiveCustomer(id: string): Promise<Customer | null> {
    const rec: LegacyCustomerRecord = await this.legacyClient.call('GetCustRec', { CUST_ID: id });
    if (!rec || rec.CUST_STS === '9') return null; // "9 = deleted" — tri thức legacy bị NHỐT ở đây

    return {
      id: rec.CUST_ID,
      fullName: titleCase(rec.CUST_NM.trim()),
      status: rec.CUST_STS === '1' ? 'ACTIVE' : 'SUSPENDED', // dịch magic number → ngôn ngữ domain
      creditLimitCents: Math.round(parseFloat(rec.CRDT_LMT_AMT) * 100), // string tiền → integer cents
      address: { lines: [rec.ADDR_LN_1, rec.ADDR_LN_2].filter(Boolean), city: rec.ADDR_CTY },
    };
  }
}
```

Điểm mấu chốt: mọi quirk của hệ cũ (`'9' = deleted`, tiền dạng string, tên uppercase) bị **cách ly trong một file**. Khi monolith chết hẳn, xóa ACL, thay bằng adapter gọi service mới — domain model **không đổi một dòng**. ACL hai chiều thì có thêm translator chiều ngược (domain mới → format legacy) khi phải ghi về hệ cũ.

### Use case thực tế & thư viện hỗ trợ

- Mọi cuộc migration lớn: monolith PHP/Java/Rails → Node/Go microservices; on-prem → cloud; mua lại công ty phải tích hợp hệ thống của họ (ACL là bắt buộc).
- Feature flag platform: **LaunchDarkly, Unleash (self-host, có Node SDK), Flagsmith, ConfigCat**; route-level thì dùng chính gateway (Kong route weight, ALB weighted target groups, Istio VirtualService traffic split).
- Shadow traffic: Envoy `request_mirror_policy`, hoặc tự viết ở gateway Node.
- **Branch by Abstraction** — họ hàng cùng nhà cho migration *bên trong* một codebase: tạo interface, cho code cũ/mới cùng implement, gạt flag chuyển dần — chính là Repository + DI (pattern #1, #2) phục vụ migration.

### ⚠️ Trade-offs / khi nào không nên dùng

- Giai đoạn chuyển tiếp **chạy song song 2 hệ**: chi phí đôi (infra, on-call, bug ở cả hai), dữ liệu phải sync 2 chiều — đây là phần đau nhất, nhiều cuộc migration "kẹt vĩnh viễn ở 70%" vì hết quyết tâm. Cần exit criteria rõ + cam kết của management.
- ACL là code thuần boilerplate dịch qua lại — tốn công viết và test; nhưng bỏ ACL để "dùng tạm model cũ" là khoản nợ lãi kép: model bẩn lan ra, sau này gỡ không nổi.
- Strangler cần một **điểm chặn traffic được** (HTTP gateway, message bus). Monolith mà các module gọi nhau bằng function call nội bộ + chung một DB schema chằng chịt thì phải làm Branch by Abstraction + tách data trước, chưa strangle ngay được.
- Không đáng làm khi monolith còn nhỏ/ổn: "monolith trước, microservices khi đau thật" — đừng migrate vì hype.

### 💬 Câu hỏi phỏng vấn liên quan

**Q: (Câu kinh điển) Công ty bạn migrate monolith sang microservices thế nào? / Bạn sẽ migrate ra sao?**
A: Khung trả lời ăn điểm: (1) đặt gateway/proxy trước monolith làm điểm chặn; (2) chọn bounded context **ít phụ thuộc + giá trị cao hoặc đau nhất** tách trước (vd notification, search); (3) xây service mới, sync data (dual-write/CDC); (4) shadow traffic so sánh kết quả; (5) feature flag rollout 1%→100%, sticky per user, có nút rollback tức thì; (6) route ổn định thì xóa code cũ trong monolith — *xóa thật, không để zombie code*; (7) lặp lại. ACL bảo vệ service mới khỏi model cũ trong suốt quá trình. Nhấn mạnh: ship feature vẫn chạy song song, mỗi bước đảo ngược được.

**Q: Anti-corruption Layer khác gì một adapter bình thường?**
A: Về cơ chế là adapter + translator, nhưng khác về **ý đồ DDD**: adapter thường chuyển interface cho tương thích; ACL tồn tại để **bảo vệ ubiquitous language của bounded context mới** khỏi bị ô nhiễm bởi model của hệ khác — nó dịch cả khái niệm nghiệp vụ (magic number → enum domain, cấu trúc legacy → aggregate sạch), không chỉ chữ ký hàm.

**Q: Làm sao biết migration đang an toàn khi rollout?**
A: So sánh metric song song giữa 2 đường (error rate, latency, business metric như conversion); shadow traffic diff response trước khi nhận traffic thật; rollout theo % với sticky session; alert gắn với flag để auto-rollback; và data reconciliation job so khớp DB cũ/mới hàng ngày trong giai đoạn dual-write.

---

## 10. Idempotency Patterns

### Vấn đề nó giải quyết

- Mạng không tin được: client gửi `POST /payments`, timeout, **không biết server đã xử lý chưa** → retry → nguy cơ **charge 2 lần**. Tương tự: Kafka/SQS deliver at-least-once → consumer nhận message trùng.
- Idempotency: gọi N lần **hiệu ứng nghiệp vụ như gọi 1 lần**. Đây là điều kiện tiên quyết để được phép retry (pattern #7) và để outbox/saga (pattern #5, #6) hoạt động an toàn — 3 pattern kia **vô dụng nếu thiếu pattern này**.

### Cách triển khai trong Node.js/TypeScript

**1) Natural idempotency — thiết kế API tự nhiên idempotent trước đã:**

- `GET/PUT/DELETE` idempotent theo chuẩn HTTP; `POST` thì không.
- `PUT /orders/:id` với **id do client sinh** (UUID) thay vì `POST /orders` để server sinh id → gọi lại chỉ ghi đè chính nó.
- State machine một chiều: `UPDATE orders SET status='PAID' WHERE id=$1 AND status='PENDING'` — chạy lần 2 affect 0 rows, vô hại.
- Phép toán tuyệt đối thay vì tương đối: `SET balance = 70` idempotent, `SET balance = balance - 30` thì không.

**2) Idempotency key — middleware Express đầy đủ (kiểu Stripe):**

```typescript
import { Redis } from 'ioredis';
import { createHash } from 'node:crypto';

const redis = new Redis(process.env.REDIS_URL!);
const TTL_SECONDS = 24 * 3600; // giữ kết quả 24h như Stripe

interface StoredRecord {
  status: 'IN_PROGRESS' | 'DONE';
  requestHash: string;
  response?: { statusCode: number; body: unknown };
}

export function idempotency() {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'POST') return next(); // GET/PUT/DELETE đã idempotent sẵn

    const key = req.header('Idempotency-Key');
    if (!key) return res.status(400).json({ error: 'Idempotency-Key header required' });

    const redisKey = `idem:${req.user.id}:${req.method}:${req.path}:${key}`; // ⭐ scope theo user + endpoint
    const requestHash = createHash('sha256').update(JSON.stringify(req.body)).digest('hex');

    // ⭐ Bước 1 — LOCK bằng atomic SET NX: chỉ MỘT request thắng, kể cả 2 request đến cùng lúc
    const acquired = await redis.set(
      redisKey,
      JSON.stringify({ status: 'IN_PROGRESS', requestHash } satisfies StoredRecord),
      'EX', TTL_SECONDS, 'NX',
    );

    if (!acquired) {
      // Đã có record → 3 nhánh
      const stored: StoredRecord = JSON.parse((await redis.get(redisKey))!);

      if (stored.requestHash !== requestHash) {
        // Cùng key nhưng body KHÁC → client dùng sai key → từ chối (chuẩn Stripe: 422)
        return res.status(422).json({ error: 'Idempotency-Key reused with different request body' });
      }
      if (stored.status === 'IN_PROGRESS') {
        // Request gốc đang chạy → đừng chạy song song bản sao → bảo client đợi
        return res.status(409).json({ error: 'A request with this Idempotency-Key is still processing' });
      }
      // DONE → ⭐ REPLAY response đã lưu, KHÔNG chạy lại handler
      return res.status(stored.response!.statusCode).json(stored.response!.body);
    }

    // Bước 2 — thắng lock: chạy handler thật, hook res.json để lưu response trước khi trả
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      const record: StoredRecord = { status: 'DONE', requestHash, response: { statusCode: res.statusCode, body } };
      // Lỗi 5xx thì XÓA key cho client retry "tươi"; 2xx/4xx thì lưu để replay
      const persist = res.statusCode < 500
        ? redis.set(redisKey, JSON.stringify(record), 'EX', TTL_SECONDS)
        : redis.del(redisKey);
      persist.catch((e) => logger.error({ e }, 'failed to persist idempotency record'));
      return originalJson(body);
    };

    // Bảo hiểm: handler crash không qua res.json → xóa key, tránh kẹt IN_PROGRESS đến hết TTL
    res.on('close', () => {
      if (!res.writableFinished) redis.del(redisKey).catch(() => {});
    });

    next();
  };
}

// Usage
app.post('/payments', idempotency(), async (req, res) => {
  const payment = await paymentService.charge(req.body); // chỉ chạy đúng 1 lần per key
  res.status(201).json(payment);
});
```

Các điểm senior cần nói được về middleware này: (1) `SET NX` để check-and-lock **atomic** — check rồi mới set là race condition; (2) hash body để bắt lỗi **reuse key cho request khác**; (3) trạng thái `IN_PROGRESS` chống chạy song song; (4) replay đúng status code + body; (5) yêu cầu cao hơn nữa thì lưu record trong **Postgres cùng transaction với side effect** (Redis và DB vẫn là 2 hệ — vẫn có khe hở dual-write nhỏ).

**3) Idempotent consumer cho Kafka/SQS — dedup theo message id + unique constraint:**

(Code đầy đủ ở pattern #6 mục 3 — nhắc lại phần cốt lõi:)

```typescript
// Chốt chặn cuối cùng là UNIQUE constraint trong DB, KHÔNG phải check-then-act trong code
const res = await client.query(
  `INSERT INTO processed_messages (consumer_group, message_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
  [group, messageId],
);
if (res.rowCount === 0) return; // duplicate → skip
await applyBusinessSideEffect(client, evt); // ⭐ CÙNG transaction với insert dedup
await client.query('COMMIT');
```

- Vì sao cùng transaction: nếu dedup ghi Redis còn side effect ghi Postgres → crash giữa chừng lại tạo ra dual-write mini. Cùng một DB transaction thì "đã ghi dedup" ⟺ "đã có side effect", atomic.
- SQS: dedup theo `MessageId` (hoặc `MessageDeduplicationId` của FIFO queue — nhưng dedup window của SQS FIFO chỉ 5 phút, vẫn nên có bảng dedup phía mình).
- Kafka: message id lấy từ header (chính là outbox id — pattern #6), hoặc business key (`orderId + eventType`).
- Dọn bảng dedup theo TTL (vd 7-30 ngày) — đủ dài hơn maximum redelivery window của broker.

**4) "Exactly-once" về mặt nghiệp vụ là gì:**

- **Exactly-once *delivery* là bất khả thi** trong hệ phân tán (Two Generals Problem) — broker chỉ cho at-most-once hoặc at-least-once (Kafka "exactly-once semantics" chỉ áp dụng trong phạm vi Kafka→Kafka transaction, không cover side effect ra ngoài như ghi Postgres hay gọi API).
- Cái ta đạt được và là cái nghiệp vụ cần: **at-least-once delivery + idempotent processing = effectively exactly-once** — message có thể tới N lần, nhưng tiền chỉ bị trừ 1 lần, email chỉ gửi 1 lần, stock chỉ giảm 1 lần. Câu này nói đúng trong phỏng vấn là điểm cộng lớn.

### Use case thực tế & thư viện hỗ trợ

- **Stripe** là chuẩn vàng tham khảo (`Idempotency-Key` header, lưu 24h, 409 khi đang xử lý, 422 khi key reuse khác payload); PayPal, Square, Adyen tương tự. Chuẩn IETF draft `Idempotency-Key` HTTP header đang hình thành.
- Mọi API tạo side effect quan trọng: payment, đặt hàng, chuyển tiền, gửi tin, provisioning resource.
- Thư viện: `express-idempotency`, các module idempotency của NestJS — nhưng tự viết như trên thường tốt hơn vì cần kiểm soát chi tiết (scope key, xử lý 5xx, storage).
- BullMQ: `jobId` tự dedup job trùng; SQS FIFO: `MessageDeduplicationId`; Kafka: `enable.idempotence=true` phía producer (chống duplicate do producer retry — vẫn không thay được consumer dedup).

### ⚠️ Trade-offs / khi nào không nên dùng

- Thêm 1-2 round-trip Redis/DB mỗi request + storage cho response → đừng áp cho endpoint read hoặc endpoint mà duplicate vô hại (log, analytics fire-and-forget).
- TTL là quyết định nghiệp vụ: 24h nghĩa là retry sau 25h sẽ **chạy lại thật** — với payment có thể cần dedup tầng hai theo business key (`userId + orderId + amount`) vĩnh viễn trong DB.
- Replay response có thể trả data đã cũ (order đã sang trạng thái khác từ lâu) — chấp nhận được vì đúng ngữ nghĩa "kết quả của lần gọi đó".
- Idempotency key dựa client → client phải sinh và giữ key đúng cách (sinh mới mỗi *intent*, giữ nguyên khi *retry*); client làm sai thì server không cứu được — cần document rõ.

### 💬 Câu hỏi phỏng vấn liên quan

**Q: Thiết kế endpoint POST /payments an toàn khi client retry?**
A: Bắt buộc header `Idempotency-Key` (client sinh UUID mỗi intent thanh toán). Server `SET NX` vào Redis kèm hash body: thắng lock thì xử lý rồi lưu response; thua lock thì — đang chạy trả 409, xong rồi replay response cũ, key trùng nhưng body khác trả 422. Đồng thời truyền key này xuống payment provider (Stripe cũng nhận idempotency key) để chống trùng end-to-end.

**Q: Exactly-once delivery có tồn tại không?**
A: Không, về mặt lý thuyết (Two Generals) lẫn thực hành — broker cho at-least-once là tốt nhất. Kafka EOS chỉ cover transaction nội bộ Kafka. Điều hệ thống thật cần là *effectively exactly-once*: at-least-once delivery + idempotent consumer (dedup bằng unique constraint, cùng transaction với side effect) → side effect nghiệp vụ xảy ra đúng một lần.

**Q: Tại sao dedup phải bằng unique constraint trong DB mà không phải check `if exists` trong code?**
A: Check-then-act trong code có race condition: 2 consumer (hoặc 2 lần deliver gần nhau) cùng check "chưa tồn tại" rồi cùng xử lý. Unique constraint đẩy quyết định xuống DB — atomic, kể cả nhiều instance song song; `ON CONFLICT DO NOTHING` + kiểm tra `rowCount` là idiom chuẩn trong Postgres.

---

## 📋 Bảng tóm tắt: pattern nào cho vấn đề nào

| Vấn đề bạn gặp | Pattern | Ghi nhớ 1 câu |
|---|---|---|
| Class tự `new` dependency, không test được | **DI / IoC** | Tiêm từ ngoài vào qua constructor; container chỉ là tiện ích lắp ráp |
| SQL lẫn vào business logic, test phải có DB | **Repository** | Interface theo aggregate + nghiệp vụ; in-memory impl cho test |
| Một use case ghi nhiều bảng phải atomic | **Unit of Work** | Một client/transaction xuyên suốt — truyền tham số hoặc AsyncLocalStorage |
| Trang đọc cần data khác hẳn model ghi; read/write lệch tải | **CQRS** | Tách model đọc/ghi — áp dụng theo MỨC, không all-or-nothing |
| Cần audit trail tuyệt đối, "tại sao state thành thế này" | **Event Sourcing** | Lưu event bất biến, state = replay; trả giá bằng complexity + schema evolution |
| Transaction trải qua nhiều service, nhiều DB | **Saga** | Chuỗi local transaction + compensation; orchestration cho flow dài, choreography cho flow ngắn |
| Ghi DB + publish event không atomic (dual write) | **Outbox** | Event vào bảng outbox cùng transaction; relay/CDC đẩy sang broker; at-least-once |
| Downstream chậm/chết kéo sập cả hệ | **Circuit Breaker / Retry / Bulkhead / Timeout** | bulkhead(retry(breaker(timeout(call)))) + fallback; retry cần jitter + budget |
| Client phải biết N service; auth/rate-limit lặp khắp nơi | **API Gateway / BFF** | Gateway = cross-cutting; BFF = shaping per-client; cấm business logic |
| Monolith cũ cần tách dần, không big-bang | **Strangler Fig + ACL** | Route từng phần qua flag/%; ACL nhốt model bẩn của hệ cũ |
| Retry/redelivery gây xử lý trùng (charge 2 lần) | **Idempotency** | Idempotency key + SET NX + replay; consumer dedup bằng unique constraint |

---

## 🗺️ Các pattern phối hợp trong 1 hệ thống order thực tế

Luồng đặt hàng e-commerce (khớp capstone project ở `../capstone-project/`) — mỗi pattern đứng đúng chỗ của nó, không pattern nào sống một mình:

1. Mobile app gửi `POST /orders` kèm `Idempotency-Key` → **API Gateway/BFF** (#8) verify JWT, rate limit, route vào Order Service.
2. Middleware **Idempotency** (#10) check Redis — duplicate thì replay response, không chạy lại.
3. Trong Order Service, handler được lắp ráp bằng **DI** (#1) — use case nhận `UnitOfWork`, repos, clients qua constructor (test inject in-memory).
4. **Repository + UoW** (#2) mở MỘT transaction Postgres: ghi `orders`, `order_items` và **Outbox** (#6) — bản ghi `OrderPlaced` nằm cùng transaction, không bao giờ lệch.
5. Outbox Relay đọc bảng outbox (`FOR UPDATE SKIP LOCKED`) publish Kafka → khởi động **Saga** (#5): Inventory reserve → Payment charge → confirm; bước nào fail thì compensation chạy ngược (release stock, refund).
6. Mỗi consumer trong saga là **Idempotent Consumer** (#10/#6): dedup theo message id với unique constraint, cùng transaction với side effect — Kafka redeliver thoải mái, stock chỉ trừ một lần.
7. Khi Payment Service gọi ra cổng thanh toán bên ngoài: **Timeout → Circuit Breaker → Retry (jitter) → Bulkhead** (#7); breaker mở thì order treo ở `PENDING_PAYMENT`, saga retry sau hoặc compensate.
8. Trang "Lịch sử đơn hàng" không đụng write model: projector consume events, ghi bảng `order_history_view` phẳng — **CQRS** (#3); query handler đọc từ read replica.
9. (Nếu công ty đang migrate từ monolith cũ: toàn bộ Order Service mới này nhận traffic dần qua **Strangler Fig** ở gateway, và nói chuyện với CRM legacy qua **ACL** (#9).)

```
                ┌──────────────────────────────────────────────────────────────────────┐
                │  Mobile / Web client                                                 │
                │  POST /orders  (Idempotency-Key: 7f3a...)                            │
                └───────────────┬──────────────────────────────────────────────────────┘
                                ▼
              ┌─────────────────────────────────────┐
              │  API GATEWAY / BFF            (#8)  │  auth · rate limit · routing
              │  [Strangler Fig: % → new svc] (#9)  │  aggregation cho mobile
              └───────────────┬─────────────────────┘
                              ▼
   ┌──────────────────────────────────────────────────────────┐
   │  ORDER SERVICE                                           │
   │  ┌────────────────────────────────────────────────────┐  │
   │  │ Idempotency middleware (#10)  Redis SET NX/replay  │  │
   │  └───────────────────┬────────────────────────────────┘  │
   │                      ▼                                   │
   │  PlaceOrderUseCase  ← lắp ráp qua DI (#1)                │
   │                      │                                   │
   │  ╔═══════════════════▼════════ 1 PG TRANSACTION ═══════╗ │
   │  ║  Repository + Unit of Work (#2)                     ║ │
   │  ║   INSERT orders / order_items                       ║ │
   │  ║   INSERT outbox('OrderPlaced')          (#6)        ║ │
   │  ╚═══════════════════╤═════════════════════════════════╝ │
   └──────────────────────┼───────────────────────────────────┘
                          │ Outbox Relay (poll, SKIP LOCKED)
                          ▼
                ┌──────────────────┐
                │      KAFKA       │  order.events (key = orderId)
                └──┬────────────┬──┘
        OrderPlaced│            │events → projector
                   ▼            ▼
   ┌────────────────────┐   ┌─────────────────────────────────┐
   │  SAGA (#5)         │   │  CQRS READ SIDE (#3)            │
   │  Inventory reserve │   │  projector → order_history_view │
   │   │ idempotent     │   │  GET /orders/history            │
   │   ▼ consumer (#10) │   │  → query read replica           │
   │  Payment charge ───┼─┐ └─────────────────────────────────┘
   │   │                │ │
   │   ▼                │ │  gọi cổng thanh toán ngoài:
   │  Confirm order     │ └─► bulkhead(retry(breaker(timeout(call)))) (#7)
   │                    │        │ fail
   │  fail? COMPENSATE: │        ▼
   │  release stock,    │     fallback: PENDING_RETRY / compensate
   │  refund, CANCELLED │
   └────────────────────┘
        (nói chuyện hệ CRM legacy qua Anti-corruption Layer (#9))
```

**Cách dùng sơ đồ này khi phỏng vấn system design:** đừng liệt kê pattern như học thuộc — hãy kể theo *luồng của một request* ("request vào gateway... vào service thì transaction gồm cả outbox... event ra Kafka thì saga..."), và ở mỗi chặng chủ động nói **failure mode** mà pattern ở đó đang đỡ: gateway chết thì sao, relay crash giữa chừng thì sao, payment timeout thì sao, consumer nhận trùng thì sao. Đó chính là thứ phân biệt senior với người mới đọc xong bài blog.
