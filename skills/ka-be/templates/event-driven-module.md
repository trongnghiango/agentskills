# Event-Driven Module Template

> **Quick Reference**
> | Aspect | Detail |
> |:---|:---|
> | Complexity | High |
> | Layers touched | Domain (event definition) → Application (publish orchestration) → Infrastructure (bus implementation) |
> | Key patterns | Domain Event, Event Bus Port, Publish-After-Commit, Dead Letter |
> | Critical rule | Events are published AFTER transaction commit, NEVER inside the transaction |
> | Prerequisites | Transaction manager abstraction in place |

---

## 1. Domain Event Interface

A Domain Event is a record of something that **already happened** in the domain.

### TypeScript

```typescript
// shared/domain/domain-event.ts
export interface IDomainEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly occurredAt: Date;
  readonly payload: Record<string, unknown>;
  readonly metadata?: {
    userId?: string;
    organizationId?: string;
    correlationId?: string;
  };
}
```

### Go

```go
// pkg/domain/event.go
package domain

import "time"

type DomainEvent struct {
    EventID       string                 `json:"eventId"`
    EventType     string                 `json:"eventType"`
    AggregateID   string                 `json:"aggregateId"`
    AggregateType string                 `json:"aggregateType"`
    OccurredAt    time.Time              `json:"occurredAt"`
    Payload       map[string]interface{} `json:"payload"`
    Metadata      *EventMetadata         `json:"metadata,omitempty"`
}

type EventMetadata struct {
    UserID         string `json:"userId,omitempty"`
    OrganizationID string `json:"organizationId,omitempty"`
    CorrelationID  string `json:"correlationId,omitempty"`
}
```

---

## 2. Defining a Concrete Event

Each event should be a **typed, serializable** value object.

### TypeScript

```typescript
// modules/order/domain/events/order-created.event.ts
import { IDomainEvent } from '@shared/domain/domain-event';

export class OrderCreatedEvent implements IDomainEvent {
  readonly eventType = 'order.created';
  readonly aggregateType = 'Order';

  constructor(
    readonly eventId: string,
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly payload: {
      customerId: string;
      organizationId: string;
      totalAmount: number;
      items: Array<{ productId: string; quantity: number }>;
    },
    readonly metadata?: { userId?: string; organizationId?: string; correlationId?: string },
  ) {}
}
```

### Rules for Event Payloads

- ✅ Include only the data consumers need (not the entire aggregate)
- ✅ Use primitive/serializable types (strings, numbers, arrays of primitives)
- ✅ Include `aggregateId` so consumers can look up full state if needed
- ❌ Never embed the full Entity or other aggregates in the payload
- ❌ Never include sensitive data (passwords, tokens) in events

---

## 3. When to Create vs Publish Events

Events are **created** inside domain methods but **published** by the application layer.

### The Aggregate Collects Events Pattern

```typescript
// shared/domain/aggregate-root.ts
export abstract class AggregateRoot {
  private _domainEvents: IDomainEvent[] = [];

  protected addDomainEvent(event: IDomainEvent): void {
    this._domainEvents.push(event);
  }

  pullDomainEvents(): IDomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }
}
```

```typescript
// modules/order/domain/order.entity.ts
export class Order extends AggregateRoot {
  static create(params: CreateOrderParams): Order {
    const order = new Order(/* ... */);

    // Event is CREATED here, not published
    order.addDomainEvent(new OrderCreatedEvent(
      crypto.randomUUID(),
      order.id,
      new Date(),
      {
        customerId: params.customerId,
        organizationId: params.organizationId,
        totalAmount: order.totalAmount,
        items: params.items,
      },
    ));

    return order;
  }
}
```

---

## 4. Event Bus Port

### TypeScript

```typescript
// shared/domain/event-bus.port.ts
export interface IEventBus {
  publish(events: IDomainEvent[]): Promise<void>;
  subscribe(eventType: string, handler: IEventHandler): void;
}

export interface IEventHandler<T extends IDomainEvent = IDomainEvent> {
  handle(event: T): Promise<void>;
}

// DI Token
export const EVENT_BUS = Symbol('EVENT_BUS');
```

### Go

```go
// pkg/domain/event_bus.go
package domain

type EventBus interface {
    Publish(ctx context.Context, events []DomainEvent) error
    Subscribe(eventType string, handler EventHandler)
}

type EventHandler interface {
    Handle(ctx context.Context, event DomainEvent) error
}
```

---

## 5. Publish AFTER Transaction Commit (Critical Rule)

> 🚨 **This is the single most important rule in event-driven architecture.**

```
❌ WRONG: Publish inside transaction
┌──────────────────────────┐
│ BEGIN TRANSACTION        │
│   save(order)            │
│   eventBus.publish(...)  │  ← If publish succeeds but commit fails,
│ COMMIT                   │    consumers act on non-existent data!
└──────────────────────────┘

✅ CORRECT: Publish after commit
┌──────────────────────────┐
│ BEGIN TRANSACTION        │
│   save(order)            │
│ COMMIT                   │
│                          │
│ eventBus.publish(...)    │  ← Only after commit succeeds
└──────────────────────────┘
```

### TypeScript Implementation

```typescript
// application/order.service.ts
export class OrderService {
  constructor(
    private readonly orderRepo: IOrderRepository,
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
    private readonly txManager: ITransactionManager,
  ) {}

  async createOrder(params: CreateOrderParams): Promise<Order> {
    let order: Order;
    let domainEvents: IDomainEvent[];

    // Step 1: Execute domain logic inside transaction
    await this.txManager.runInTransaction(async () => {
      order = Order.create(params);
      await this.orderRepo.save(order);
      domainEvents = order.pullDomainEvents();
    });

    // Step 2: Publish events AFTER transaction committed
    if (domainEvents.length > 0) {
      await this.eventBus.publish(domainEvents);
    }

    return order!;
  }
}
```

### Go Implementation

```go
// application/order_service.go
func (s *OrderService) CreateOrder(ctx context.Context, params CreateOrderParams) (*Order, error) {
    var order *Order
    var events []domain.DomainEvent

    // Step 1: Transaction
    err := s.txManager.RunInTx(ctx, func(txCtx context.Context) error {
        o, err := domain.NewOrder(params)
        if err != nil {
            return err
        }
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

    // Step 2: Publish after commit
    if len(events) > 0 {
        if err := s.eventBus.Publish(ctx, events); err != nil {
            // Log error but don't fail the request — event is already persisted
            s.logger.Error("failed to publish events", "error", err)
        }
    }

    return order, nil
}
```

---

## 6. Event Handler / Subscriber

### TypeScript

```typescript
// modules/notification/application/handlers/on-order-created.handler.ts
import { IEventHandler } from '@shared/domain/event-bus.port';
import { OrderCreatedEvent } from '@modules/order/domain/events/order-created.event';

export class OnOrderCreatedSendNotification implements IEventHandler<OrderCreatedEvent> {
  constructor(private readonly notificationService: INotificationService) {}

  async handle(event: OrderCreatedEvent): Promise<void> {
    await this.notificationService.send({
      to: event.payload.customerId,
      template: 'order-confirmation',
      data: {
        orderId: event.aggregateId,
        totalAmount: event.payload.totalAmount,
      },
    });
  }
}
```

### Registration

```typescript
// modules/notification/notification.module.ts
eventBus.subscribe('order.created', new OnOrderCreatedSendNotification(notificationService));
```

---

## 7. Error Handling in Event Handlers (Dead Letter)

Event handlers must **never crash** the publisher. Failed events should be captured for retry.

```typescript
// infrastructure/event-bus/in-memory-event-bus.ts
export class InMemoryEventBus implements IEventBus {
  private handlers = new Map<string, IEventHandler[]>();
  private deadLetterQueue: Array<{ event: IDomainEvent; error: Error; attemptedAt: Date }> = [];

  async publish(events: IDomainEvent[]): Promise<void> {
    for (const event of events) {
      const handlers = this.handlers.get(event.eventType) ?? [];
      for (const handler of handlers) {
        try {
          await handler.handle(event);
        } catch (error) {
          // Capture failed event — never throw
          this.deadLetterQueue.push({
            event,
            error: error as Error,
            attemptedAt: new Date(),
          });
          // Log for observability
          console.error(`[EventBus] Handler failed for ${event.eventType}:`, error);
        }
      }
    }
  }

  subscribe(eventType: string, handler: IEventHandler): void {
    const existing = this.handlers.get(eventType) ?? [];
    existing.push(handler);
    this.handlers.set(eventType, existing);
  }
}
```

### Dead Letter Rules

- ✅ Log every failed event with full context (eventId, eventType, error message)
- ✅ Store failed events for manual inspection or automated retry
- ✅ Set a maximum retry count (e.g., 3 attempts with exponential backoff)
- ❌ Never let a handler failure propagate back to the publisher
- ❌ Never silently swallow errors — always log them

---

## 8. Audit Trail via Domain Events

Domain events naturally form an audit log:

```typescript
// infrastructure/audit/event-audit-logger.ts
export class EventAuditLogger implements IEventHandler {
  constructor(private readonly auditRepo: IAuditLogRepository) {}

  async handle(event: IDomainEvent): Promise<void> {
    await this.auditRepo.save({
      eventId: event.eventId,
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      occurredAt: event.occurredAt,
      userId: event.metadata?.userId,
      organizationId: event.metadata?.organizationId,
      payload: JSON.stringify(event.payload),
    });
  }
}

// Register as a wildcard subscriber for all events
eventBus.subscribe('*', new EventAuditLogger(auditRepo));
```

---

## 9. Checklist

- [ ] Domain events implement `IDomainEvent` interface with all required fields
- [ ] Event payloads are serializable (no circular references, no entity objects)
- [ ] Aggregate root collects events via `addDomainEvent()` / `pullDomainEvents()`
- [ ] Events are published AFTER transaction commit, never inside
- [ ] Event handlers are registered in module initialization
- [ ] Event handlers catch their own errors (dead letter pattern)
- [ ] Audit logger is subscribed to capture all domain events
- [ ] Each event includes `correlationId` for distributed tracing
- [ ] Event types follow dot-notation: `{aggregate}.{past-tense-verb}` (e.g., `order.created`)
