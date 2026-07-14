# Transaction Orchestration Template

> **Quick Reference**
> | Aspect | Detail |
> |:---|:---|
> | Complexity | High |
> | Layers touched | Application (orchestration) → Infrastructure (transaction manager) |
> | Key patterns | Transaction Manager Abstraction, Publish-After-Commit, Idempotency Key |
> | Critical rules | (1) Events AFTER commit (2) Audit outside transaction (3) Never leak db.Tx |
> | Prerequisites | Transaction manager port defined, event bus in place |

---

## 1. Transaction Manager Abstraction

### Why Not Raw `db.transaction()`?

Using raw database transactions directly in application services:
- ❌ Leaks infrastructure details into the application layer
- ❌ Makes services untestable without a real database
- ❌ Couples business logic to a specific database driver
- ❌ Makes it impossible to swap transaction strategies (e.g., Saga pattern)

### TypeScript Port

```typescript
// shared/application/transaction-manager.port.ts
export interface ITransactionManager {
  /**
   * Execute a function within a transaction.
   * If the function throws, the transaction is rolled back.
   * If the function returns, the transaction is committed.
   */
  runInTransaction<T>(fn: () => Promise<T>): Promise<T>;
}

export const TRANSACTION_MANAGER = Symbol('TRANSACTION_MANAGER');
```

### Go Port

```go
// pkg/application/tx_manager.go
package application

import "context"

type TxManager interface {
    RunInTx(ctx context.Context, fn func(txCtx context.Context) error) error
}
```

### Infrastructure Implementation (TypeScript/Drizzle)

```typescript
// shared/infrastructure/drizzle-transaction-manager.ts
import { DrizzleClient } from './drizzle.client';

export class DrizzleTransactionManager implements ITransactionManager {
  constructor(private readonly db: DrizzleClient) {}

  async runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      // Store tx in AsyncLocalStorage so repositories can use it
      return TransactionContext.run(tx, fn);
    });
  }
}
```

### Infrastructure Implementation (Go/pgx)

```go
// internal/infra/pg_tx_manager.go
package infra

import (
    "context"
    "github.com/jackc/pgx/v5/pgxpool"
)

type PgTxManager struct {
    pool *pgxpool.Pool
}

func NewPgTxManager(pool *pgxpool.Pool) *PgTxManager {
    return &PgTxManager{pool: pool}
}

func (m *PgTxManager) RunInTx(ctx context.Context, fn func(txCtx context.Context) error) error {
    tx, err := m.pool.Begin(ctx)
    if err != nil {
        return fmt.Errorf("begin tx: %w", err)
    }

    // Store tx in context for repositories
    txCtx := context.WithValue(ctx, txKey{}, tx)

    if err := fn(txCtx); err != nil {
        _ = tx.Rollback(ctx)
        return err
    }

    return tx.Commit(ctx)
}
```

---

## 2. Single Aggregate Transaction (Simple Case)

Most CRUD operations modify a single aggregate within one transaction.

```typescript
// application/product.service.ts
export class ProductService {
  constructor(
    private readonly productRepo: IProductRepository,
    @Inject(TRANSACTION_MANAGER) private readonly txManager: ITransactionManager,
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
  ) {}

  async updateProduct(
    id: string,
    organizationId: string,
    params: UpdateProductParams,
  ): Promise<Product> {
    let product: Product;
    let events: IDomainEvent[];

    await this.txManager.runInTransaction(async () => {
      product = await this.productRepo.findById(id, organizationId);
      if (!product) throw new ProductNotFoundException(id);

      product.update(params);
      await this.productRepo.save(product);

      events = product.pullDomainEvents();
    });

    // Events AFTER commit
    await this.eventBus.publish(events);

    return product!;
  }
}
```

---

## 3. Multi-Aggregate Transaction (Complex Case)

When multiple aggregates must be modified atomically.

### TypeScript

```typescript
// application/order.service.ts
export class OrderService {
  constructor(
    private readonly orderRepo: IOrderRepository,
    private readonly inventoryPort: IInventoryPort,
    private readonly paymentPort: IPaymentPort,
    @Inject(TRANSACTION_MANAGER) private readonly txManager: ITransactionManager,
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
    private readonly auditService: IAuditService,
  ) {}

  async approveOrder(
    orderId: string,
    approvedBy: string,
    organizationId: string,
  ): Promise<Order> {
    let order: Order;
    let allEvents: IDomainEvent[] = [];

    // ┌─────────────────────────────────────────────┐
    // │ TRANSACTION BOUNDARY                        │
    // │ All aggregates modified atomically           │
    // └─────────────────────────────────────────────┘
    await this.txManager.runInTransaction(async () => {
      // 1. Load and validate order
      order = await this.orderRepo.findById(orderId, organizationId);
      if (!order) throw new OrderNotFoundException(orderId);

      // 2. Domain method enforces invariants
      order.approve(approvedBy);

      // 3. Reserve inventory (within same transaction)
      await this.inventoryPort.reserve(order.items, organizationId);

      // 4. Persist changes
      await this.orderRepo.save(order);

      // 5. Collect events (but don't publish yet!)
      allEvents = order.pullDomainEvents();
    });

    // ┌─────────────────────────────────────────────┐
    // │ AFTER COMMIT (outside transaction)           │
    // └─────────────────────────────────────────────┘

    // 6. Publish domain events
    await this.eventBus.publish(allEvents);

    // 7. Fire-and-forget audit log
    this.auditService.log({
      action: 'order.approved',
      entityId: orderId,
      userId: approvedBy,
      organizationId,
    }).catch((err) => console.error('[Audit] Failed:', err));

    return order!;
  }
}
```

### Go

```go
// application/order_service.go
func (s *OrderService) ApproveOrder(
    ctx context.Context, orderID, approvedBy, orgID string,
) (*domain.Order, error) {
    var order *domain.Order
    var events []domain.DomainEvent

    // Transaction boundary
    err := s.txManager.RunInTx(ctx, func(txCtx context.Context) error {
        // 1. Load
        o, err := s.orderRepo.FindByID(txCtx, orderID, orgID)
        if err != nil {
            return err
        }

        // 2. Domain logic
        if err := o.Approve(approvedBy); err != nil {
            return err
        }

        // 3. Reserve inventory
        if err := s.inventoryPort.Reserve(txCtx, o.Items(), orgID); err != nil {
            return err
        }

        // 4. Persist
        if err := s.orderRepo.Save(txCtx, o); err != nil {
            return err
        }

        order = o
        events = o.PullDomainEvents()
        return nil
    })
    if err != nil {
        return nil, err
    }

    // After commit
    if pubErr := s.eventBus.Publish(ctx, events); pubErr != nil {
        s.logger.Error("failed to publish events", "error", pubErr)
    }

    // Fire-and-forget audit
    go func() {
        _ = s.auditService.Log(context.Background(), audit.Entry{
            Action:   "order.approved",
            EntityID: orderID,
            UserID:   approvedBy,
            OrgID:    orgID,
        })
    }()

    return order, nil
}
```

---

## 4. Event Publish Timing Rules

```
┌──────────────────────────────────────────────────────────┐
│                    TIMELINE                               │
│                                                          │
│  BEGIN TX ─── mutations ─── COMMIT ─── publish events    │
│     │                          │            │            │
│     │    ❌ No events here     │  ✅ Events  │            │
│     │    ❌ No side effects    │     here    │            │
│     │    ❌ No HTTP calls      │             │            │
│     │    ❌ No email sending   │  ✅ Audit   │            │
│     │                          │     here    │            │
└──────────────────────────────────────────────────────────┘
```

### What Goes INSIDE the Transaction

- ✅ Database reads and writes
- ✅ Domain method calls (validation, state changes)
- ✅ Collecting domain events (but NOT publishing)

### What Goes OUTSIDE the Transaction

- ✅ Publishing domain events
- ✅ Sending notifications (email, push, SMS)
- ✅ Audit logging (fire-and-forget)
- ✅ Cache invalidation
- ✅ External API calls

---

## 5. Audit Log: Fire-and-Forget

Audit logging should **never** cause a transaction failure.

```typescript
// shared/application/audit.service.ts
export interface IAuditService {
  log(entry: AuditEntry): Promise<void>;
}

export interface AuditEntry {
  action: string;
  entityId: string;
  userId: string;
  organizationId: string;
  metadata?: Record<string, unknown>;
}
```

```typescript
// Usage in service (after commit):
// Fire-and-forget — don't await, catch errors
this.auditService.log({
  action: 'order.approved',
  entityId: orderId,
  userId: approvedBy,
  organizationId,
}).catch((err) => console.error('[Audit] Failed:', err));
```

### Rules

- ✅ Audit log runs OUTSIDE the main transaction
- ✅ Audit failures are logged but never propagated
- ✅ Audit entries include: action, entityId, userId, orgId, timestamp
- ❌ Never put audit writes inside the business transaction
- ❌ Never let audit failure cause a 500 error to the user

---

## 6. Rollback Strategy and Compensation

### Automatic Rollback (Within Single DB)

When using `runInTransaction`, any thrown error automatically rolls back:

```typescript
await this.txManager.runInTransaction(async () => {
  await this.orderRepo.save(order);
  await this.inventoryPort.reserve(items, orgId);  // If this throws...
  // ... the order save is also rolled back automatically
});
```

### Compensation Pattern (Cross-Service / External APIs)

When operations span external services that can't participate in a DB transaction:

```typescript
async processPaymentAndShip(orderId: string, orgId: string): Promise<void> {
  let paymentId: string | null = null;

  try {
    // Step 1: Charge payment (external API — can't rollback via DB)
    paymentId = await this.paymentGateway.charge(order.totalAmount);

    // Step 2: Update order in DB
    await this.txManager.runInTransaction(async () => {
      order.markPaid(paymentId);
      await this.orderRepo.save(order);
    });

    // Step 3: Schedule shipment
    await this.shippingService.schedule(order);

  } catch (error) {
    // Compensate: refund the payment if it was charged
    if (paymentId) {
      await this.paymentGateway.refund(paymentId).catch((refundErr) => {
        // Critical: manual intervention needed
        this.alertService.critical('REFUND_FAILED', { paymentId, orderId, error: refundErr });
      });
    }
    throw error;
  }
}
```

### Compensation Rules

- ✅ Define compensating actions for each external call
- ✅ Execute compensations in reverse order (last-in, first-compensated)
- ✅ Alert on compensation failures (they need manual intervention)
- ❌ Never assume compensation will always succeed
- ❌ Never ignore failed compensations

---

## 7. Idempotency Keys for Retry Safety

Prevent duplicate processing when requests are retried.

### TypeScript

```typescript
// shared/infrastructure/idempotency.service.ts
export interface IIdempotencyService {
  /**
   * Check if an operation with this key has already been processed.
   * Returns the cached result if it has.
   */
  checkOrExecute<T>(
    key: string,
    ttlSeconds: number,
    fn: () => Promise<T>,
  ): Promise<T>;
}

export class RedisIdempotencyService implements IIdempotencyService {
  constructor(private readonly redis: RedisClient) {}

  async checkOrExecute<T>(
    key: string,
    ttlSeconds: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    const cacheKey = `idempotency:${key}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached) as T;
    }

    const result = await fn();

    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', ttlSeconds);

    return result;
  }
}
```

### Usage in Service

```typescript
async createOrder(params: CreateOrderParams, idempotencyKey: string): Promise<Order> {
  return this.idempotencyService.checkOrExecute(
    idempotencyKey,
    3600, // 1 hour TTL
    async () => {
      let order: Order;
      let events: IDomainEvent[];

      await this.txManager.runInTransaction(async () => {
        order = Order.create(params);
        await this.orderRepo.save(order);
        events = order.pullDomainEvents();
      });

      await this.eventBus.publish(events);
      return order!;
    },
  );
}
```

### Go

```go
// pkg/infra/idempotency.go
type IdempotencyService interface {
    CheckOrExecute(ctx context.Context, key string, ttl time.Duration, fn func() (interface{}, error)) (interface{}, error)
}

func (s *RedisIdempotencyService) CheckOrExecute(
    ctx context.Context, key string, ttl time.Duration, fn func() (interface{}, error),
) (interface{}, error) {
    cacheKey := "idempotency:" + key
    cached, err := s.redis.Get(ctx, cacheKey).Result()
    if err == nil {
        var result interface{}
        json.Unmarshal([]byte(cached), &result)
        return result, nil
    }

    result, err := fn()
    if err != nil {
        return nil, err
    }

    data, _ := json.Marshal(result)
    s.redis.Set(ctx, cacheKey, data, ttl)

    return result, nil
}
```

### Idempotency Rules

- ✅ Client generates the idempotency key (UUID) and sends it in the request header
- ✅ Key is scoped: `{organizationId}:{operation}:{clientKey}`
- ✅ Cache TTL should match the business use case (e.g., 1 hour for orders)
- ❌ Never generate idempotency keys server-side (defeats the purpose)
- ❌ Never use idempotency for GET requests (they're already idempotent)

---

## 8. Checklist

- [ ] Transaction manager abstraction exists (no raw `db.transaction()` in services)
- [ ] All aggregate mutations happen inside `runInTransaction`
- [ ] Domain events are published AFTER commit, never inside
- [ ] Audit logs are fire-and-forget, outside the transaction
- [ ] Multi-aggregate operations use a single transaction boundary
- [ ] Compensation pattern is implemented for external service calls
- [ ] Failed compensations trigger alerts for manual intervention
- [ ] Idempotency keys are supported for create/mutation endpoints
- [ ] Repositories detect transaction context (AsyncLocalStorage / context.Context)
- [ ] Unit tests mock the transaction manager to verify commit/rollback behavior
