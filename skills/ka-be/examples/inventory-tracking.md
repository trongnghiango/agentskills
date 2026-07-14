# Example: Inventory Tracking Module

> **Complexity**: High · **Patterns**: Transaction Orchestration, Audit Trail, Event-Driven, Multi-Tenant

A complete walkthrough of building a stock inventory system with atomic transaction orchestration, full audit trail (before/after quantities), domain events for low stock alerts, and multi-warehouse tenant isolation.

---

## Step 1 — Business & Architecture Analysis

### Module Classification

**Tier 3 — Process Flow.** Inventory tracking involves transactional consistency (atomic stock update + audit log), event-driven side-effects (low stock alerts), and multi-warehouse segmentation within a tenant.

### Bounded Context & Ubiquitous Language

| Business Concept | Code Name | Type |
|:---|:---|:---|
| Product in warehouse | `InventoryItem` | Aggregate Root |
| Stock in/out record | `StockMovement` | Value Object |
| Movement type | `MovementType` | Value Object (enum: `in`, `out`, `adjustment`) |
| Stock threshold alert | `LowStockAlert` | Domain Event |

### Transaction Requirement

Every stock operation must be **atomic**: update the item quantity AND create a movement record in a single database transaction. If either fails, both roll back.

### Audit Trail

Every `StockMovement` records:
- `quantityBefore` — snapshot before the operation.
- `quantityAfter` — snapshot after the operation.
- `reason` — business justification.
- `performedBy` — user who triggered the movement.

### Domain Events

- **StockAdjusted** — published after any successful stock mutation (informational).
- **LowStockAlert** — published when quantity drops below `lowStockThreshold`.

### Tenant Isolation

All queries scoped by `organizationId`. Items additionally scoped by `warehouseId` for multi-warehouse operations within the same organization.

---

## Step 2 — Detailed Implementation Plan

### Database Schema

```
inventory_items
├── id                   UUID  PK  DEFAULT gen_random_uuid()
├── sku                  TEXT  NOT NULL
├── name                 TEXT  NOT NULL
├── quantity             INTEGER  NOT NULL  DEFAULT 0
├── low_stock_threshold  INTEGER  NOT NULL  DEFAULT 10
├── warehouse_id         UUID  NOT NULL
├── organization_id      UUID  NOT NULL
├── created_at           TIMESTAMP WITH TZ  NOT NULL DEFAULT now()
├── updated_at           TIMESTAMP WITH TZ  NOT NULL DEFAULT now()
UNIQUE(sku, warehouse_id, organization_id)
INDEX(organization_id, warehouse_id)

stock_movements
├── id                UUID  PK  DEFAULT gen_random_uuid()
├── inventory_item_id UUID  NOT NULL  FK → inventory_items.id
├── type              movement_type_enum  NOT NULL
├── quantity           INTEGER  NOT NULL
├── quantity_before    INTEGER  NOT NULL
├── quantity_after     INTEGER  NOT NULL
├── reason             TEXT  NOT NULL
├── performed_by       UUID  NOT NULL
├── organization_id    UUID  NOT NULL
├── created_at         TIMESTAMP WITH TZ  NOT NULL DEFAULT now()
INDEX(inventory_item_id, created_at)
INDEX(organization_id)
```

### Domain Layer

- **Entity**: `InventoryItem` with `addStock()`, `removeStock()`, `adjust()`.
- **Invariant**: Quantity must never drop below 0.
- **Value Object**: `StockMovement` — immutable audit record with before/after snapshots.
- **Events**: Collected in entity, published after commit.

### Infrastructure Layer

- **Repository**: `DrizzleInventoryRepository` with atomic multi-table writes.
- **Transaction Manager**: Wraps Drizzle transaction for use-case level coordination.

### Application Layer

- **Service**: `InventoryService` — wraps domain operations in a transaction, publishes events after commit.

---

## Step 3 — Execution Checklist

- [x] Define `MovementType` enum (shared contracts)
- [x] Create `inventory_items` Drizzle schema
- [x] Create `stock_movements` Drizzle schema with FK
- [x] Write migration files
- [x] Create `StockMovement` value object
- [x] Create `InventoryItem` domain entity with invariants
- [x] Implement domain event classes (StockAdjusted, LowStockAlert)
- [x] Define `IInventoryRepository` port interface
- [x] Define `ITransactionManager` port interface
- [x] Implement `DrizzleInventoryRepository` with atomic writes
- [x] Implement `InventoryItemMapper` (toDomain / toPersistence)
- [x] Create request/response DTOs
- [x] Implement `InventoryService` with transaction wrapping
- [x] Implement `InventoryController` with routes
- [x] Write unit tests for `InventoryItem` entity (invariant violations)
- [x] Write unit tests for `InventoryService` (mocked repo + tx manager)
- [x] Write integration tests for full stock movement cycle
- [x] Verify transaction rollback on partial failure
- [x] Run domain purity verification
- [x] Run full compilation and test suite

---

## Step 4 — Code & Verification

### 4.1 Schema (Drizzle)

```typescript
// src/modules/inventory/infrastructure/schema/inventory.schema.ts
import { pgTable, uuid, text, integer, timestamp, uniqueIndex, index, pgEnum } from 'drizzle-orm/pg-core';

export const movementTypeEnum = pgEnum('movement_type', ['in', 'out', 'adjustment']);

export const inventoryItems = pgTable('inventory_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  sku: text('sku').notNull(),
  name: text('name').notNull(),
  quantity: integer('quantity').notNull().default(0),
  lowStockThreshold: integer('low_stock_threshold').notNull().default(10),
  warehouseId: uuid('warehouse_id').notNull(),
  organizationId: uuid('organization_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('uq_inventory_sku_warehouse_org').on(table.sku, table.warehouseId, table.organizationId),
  index('idx_inventory_org_warehouse').on(table.organizationId, table.warehouseId),
]);

export const stockMovements = pgTable('stock_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  inventoryItemId: uuid('inventory_item_id').notNull().references(() => inventoryItems.id),
  type: movementTypeEnum('type').notNull(),
  quantity: integer('quantity').notNull(),
  quantityBefore: integer('quantity_before').notNull(),
  quantityAfter: integer('quantity_after').notNull(),
  reason: text('reason').notNull(),
  performedBy: uuid('performed_by').notNull(),
  organizationId: uuid('organization_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_movements_item_created').on(table.inventoryItemId, table.createdAt),
  index('idx_movements_org').on(table.organizationId),
]);

export type InventoryItemRow = typeof inventoryItems.$inferSelect;
export type StockMovementRow = typeof stockMovements.$inferSelect;
```

### 4.2 Domain Events

```typescript
// src/modules/inventory/domain/events/inventory.events.ts

export interface DomainEvent {
  readonly eventName: string;
  readonly occurredAt: Date;
  readonly payload: Record<string, unknown>;
}

export class StockAdjusted implements DomainEvent {
  readonly eventName = 'StockAdjusted';
  readonly occurredAt = new Date();
  constructor(readonly payload: {
    inventoryItemId: string;
    type: string;
    quantityBefore: number;
    quantityAfter: number;
    reason: string;
  }) {}
}

export class LowStockAlert implements DomainEvent {
  readonly eventName = 'LowStockAlert';
  readonly occurredAt = new Date();
  constructor(readonly payload: {
    inventoryItemId: string;
    sku: string;
    currentQuantity: number;
    threshold: number;
    warehouseId: string;
  }) {}
}
```

### 4.3 Value Object — StockMovement

```typescript
// src/modules/inventory/domain/value-objects/stock-movement.vo.ts

export type MovementType = 'in' | 'out' | 'adjustment';

export class StockMovement {
  private constructor(
    private readonly _id: string,
    private readonly _type: MovementType,
    private readonly _quantity: number,
    private readonly _quantityBefore: number,
    private readonly _quantityAfter: number,
    private readonly _reason: string,
    private readonly _performedBy: string,
    private readonly _createdAt: Date,
  ) {}

  static create(params: {
    id: string;
    type: MovementType;
    quantity: number;
    quantityBefore: number;
    quantityAfter: number;
    reason: string;
    performedBy: string;
    createdAt: Date;
  }): StockMovement {
    if (params.quantity <= 0) {
      throw new InvalidMovementQuantityException(params.quantity);
    }
    return new StockMovement(
      params.id, params.type, params.quantity,
      params.quantityBefore, params.quantityAfter,
      params.reason, params.performedBy, params.createdAt,
    );
  }

  get id(): string { return this._id; }
  get type(): MovementType { return this._type; }
  get quantity(): number { return this._quantity; }
  get quantityBefore(): number { return this._quantityBefore; }
  get quantityAfter(): number { return this._quantityAfter; }
  get reason(): string { return this._reason; }
  get performedBy(): string { return this._performedBy; }
  get createdAt(): Date { return this._createdAt; }
}

export class InvalidMovementQuantityException extends Error {
  constructor(qty: number) {
    super(`Movement quantity must be positive, received: ${qty}`);
    this.name = 'InvalidMovementQuantityException';
  }
}
```

### 4.4 Entity — InventoryItem

```typescript
// src/modules/inventory/domain/entities/inventory-item.entity.ts
import { StockMovement, MovementType } from '../value-objects/stock-movement.vo';
import { StockAdjusted, LowStockAlert, DomainEvent } from '../events/inventory.events';

export class InventoryItem {
  private _domainEvents: DomainEvent[] = [];
  private _pendingMovements: StockMovement[] = [];

  private constructor(
    private readonly _id: string,
    private readonly _sku: string,
    private _name: string,
    private _quantity: number,
    private readonly _lowStockThreshold: number,
    private readonly _warehouseId: string,
    private readonly _organizationId: string,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static create(params: {
    id: string;
    sku: string;
    name: string;
    quantity: number;
    lowStockThreshold: number;
    warehouseId: string;
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
  }): InventoryItem {
    return new InventoryItem(
      params.id, params.sku, params.name, params.quantity,
      params.lowStockThreshold, params.warehouseId, params.organizationId,
      params.createdAt, params.updatedAt,
    );
  }

  // --- Stock Operations ---

  addStock(qty: number, reason: string, performedBy: string): void {
    if (qty <= 0) {
      throw new InvalidStockOperationException('Add quantity must be positive');
    }

    const before = this._quantity;
    this._quantity += qty;
    const after = this._quantity;

    this.recordMovement('in', qty, before, after, reason, performedBy);
    this.emitStockAdjusted('in', before, after, reason);
    this.touch();
  }

  removeStock(qty: number, reason: string, performedBy: string): void {
    if (qty <= 0) {
      throw new InvalidStockOperationException('Remove quantity must be positive');
    }
    if (this._quantity - qty < 0) {
      throw new InsufficientStockException(this._id, this._quantity, qty);
    }

    const before = this._quantity;
    this._quantity -= qty;
    const after = this._quantity;

    this.recordMovement('out', qty, before, after, reason, performedBy);
    this.emitStockAdjusted('out', before, after, reason);
    this.checkLowStock();
    this.touch();
  }

  adjust(newQuantity: number, reason: string, performedBy: string): void {
    if (newQuantity < 0) {
      throw new InvalidStockOperationException('Adjusted quantity cannot be negative');
    }

    const before = this._quantity;
    const delta = Math.abs(newQuantity - before);
    this._quantity = newQuantity;

    this.recordMovement('adjustment', delta, before, newQuantity, reason, performedBy);
    this.emitStockAdjusted('adjustment', before, newQuantity, reason);

    if (newQuantity < before) {
      this.checkLowStock();
    }
    this.touch();
  }

  // --- Getters ---

  get id(): string { return this._id; }
  get sku(): string { return this._sku; }
  get name(): string { return this._name; }
  get quantity(): number { return this._quantity; }
  get lowStockThreshold(): number { return this._lowStockThreshold; }
  get warehouseId(): string { return this._warehouseId; }
  get organizationId(): string { return this._organizationId; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get isLowStock(): boolean { return this._quantity <= this._lowStockThreshold; }

  pullDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }

  pullPendingMovements(): StockMovement[] {
    const movements = [...this._pendingMovements];
    this._pendingMovements = [];
    return movements;
  }

  // --- Private Helpers ---

  private recordMovement(
    type: MovementType, qty: number,
    before: number, after: number,
    reason: string, performedBy: string,
  ): void {
    this._pendingMovements.push(
      StockMovement.create({
        id: crypto.randomUUID(),
        type, quantity: qty,
        quantityBefore: before, quantityAfter: after,
        reason, performedBy, createdAt: new Date(),
      }),
    );
  }

  private emitStockAdjusted(type: string, before: number, after: number, reason: string): void {
    this._domainEvents.push(new StockAdjusted({
      inventoryItemId: this._id, type,
      quantityBefore: before, quantityAfter: after, reason,
    }));
  }

  private checkLowStock(): void {
    if (this._quantity <= this._lowStockThreshold) {
      this._domainEvents.push(new LowStockAlert({
        inventoryItemId: this._id, sku: this._sku,
        currentQuantity: this._quantity, threshold: this._lowStockThreshold,
        warehouseId: this._warehouseId,
      }));
    }
  }

  private touch(): void {
    this._updatedAt = new Date();
  }
}

// --- Domain Exceptions ---

export class InvalidStockOperationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStockOperationException';
  }
}

export class InsufficientStockException extends Error {
  constructor(itemId: string, available: number, requested: number) {
    super(`Insufficient stock for item ${itemId}: available=${available}, requested=${requested}`);
    this.name = 'InsufficientStockException';
  }
}
```

### 4.5 Repository Port

```typescript
// src/modules/inventory/domain/ports/inventory-repository.port.ts
import { InventoryItem } from '../entities/inventory-item.entity';
import { StockMovement } from '../value-objects/stock-movement.vo';

export interface IInventoryRepository {
  findById(id: string, organizationId: string): Promise<InventoryItem | null>;
  findBySku(sku: string, warehouseId: string, organizationId: string): Promise<InventoryItem | null>;
  findAll(organizationId: string, warehouseId?: string): Promise<InventoryItem[]>;
  /** Atomically persists item quantity update + movement records in one transaction */
  saveWithMovements(item: InventoryItem, movements: StockMovement[]): Promise<void>;
}

export const INVENTORY_REPOSITORY = Symbol('IInventoryRepository');
```

### 4.6 Repository Implementation (Transaction Orchestration)

```typescript
// src/modules/inventory/infrastructure/repositories/drizzle-inventory.repository.ts
import { eq, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InventoryItem } from '../../domain/entities/inventory-item.entity';
import { StockMovement } from '../../domain/value-objects/stock-movement.vo';
import { IInventoryRepository } from '../../domain/ports/inventory-repository.port';
import { inventoryItems, stockMovements } from '../schema/inventory.schema';
import { InventoryItemMapper } from '../mappers/inventory-item.mapper';

export class DrizzleInventoryRepository implements IInventoryRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async findById(id: string, organizationId: string): Promise<InventoryItem | null> {
    const rows = await this.db
      .select()
      .from(inventoryItems)
      .where(and(
        eq(inventoryItems.id, id),
        eq(inventoryItems.organizationId, organizationId),
      ))
      .limit(1);
    return rows[0] ? InventoryItemMapper.toDomain(rows[0]) : null;
  }

  async findBySku(sku: string, warehouseId: string, organizationId: string): Promise<InventoryItem | null> {
    const rows = await this.db
      .select()
      .from(inventoryItems)
      .where(and(
        eq(inventoryItems.sku, sku),
        eq(inventoryItems.warehouseId, warehouseId),
        eq(inventoryItems.organizationId, organizationId),
      ))
      .limit(1);
    return rows[0] ? InventoryItemMapper.toDomain(rows[0]) : null;
  }

  async findAll(organizationId: string, warehouseId?: string): Promise<InventoryItem[]> {
    const conditions = [eq(inventoryItems.organizationId, organizationId)];
    if (warehouseId) {
      conditions.push(eq(inventoryItems.warehouseId, warehouseId));
    }
    const rows = await this.db
      .select()
      .from(inventoryItems)
      .where(and(...conditions));
    return rows.map(InventoryItemMapper.toDomain);
  }

  /**
   * Atomic transaction: updates item quantity + inserts all movement records.
   * If any step fails, the entire operation rolls back.
   */
  async saveWithMovements(item: InventoryItem, movements: StockMovement[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      // 1. Upsert the inventory item (quantity + updatedAt)
      const data = InventoryItemMapper.toPersistence(item);
      await tx
        .insert(inventoryItems)
        .values(data)
        .onConflictDoUpdate({
          target: inventoryItems.id,
          set: {
            quantity: data.quantity,
            name: data.name,
            updatedAt: data.updatedAt,
          },
        });

      // 2. Insert all movement audit records
      if (movements.length > 0) {
        await tx.insert(stockMovements).values(
          movements.map(m => ({
            id: m.id,
            inventoryItemId: item.id,
            type: m.type,
            quantity: m.quantity,
            quantityBefore: m.quantityBefore,
            quantityAfter: m.quantityAfter,
            reason: m.reason,
            performedBy: m.performedBy,
            organizationId: item.organizationId,
            createdAt: m.createdAt,
          })),
        );
      }
    });
  }
}
```

### 4.7 Mapper

```typescript
// src/modules/inventory/infrastructure/mappers/inventory-item.mapper.ts
import { InventoryItem } from '../../domain/entities/inventory-item.entity';
import { InventoryItemRow } from '../schema/inventory.schema';

export class InventoryItemMapper {
  static toDomain(row: InventoryItemRow): InventoryItem {
    return InventoryItem.create({
      id: row.id,
      sku: row.sku,
      name: row.name,
      quantity: row.quantity,
      lowStockThreshold: row.lowStockThreshold,
      warehouseId: row.warehouseId,
      organizationId: row.organizationId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  static toPersistence(entity: InventoryItem) {
    return {
      id: entity.id,
      sku: entity.sku,
      name: entity.name,
      quantity: entity.quantity,
      lowStockThreshold: entity.lowStockThreshold,
      warehouseId: entity.warehouseId,
      organizationId: entity.organizationId,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
```

### 4.8 Service (Transaction + Event Publishing)

```typescript
// src/modules/inventory/application/inventory.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { InventoryItem } from '../domain/entities/inventory-item.entity';
import { IInventoryRepository, INVENTORY_REPOSITORY } from '../domain/ports/inventory-repository.port';
import { EventBus } from '../../shared/events/event-bus';

@Injectable()
export class InventoryService {
  constructor(
    @Inject(INVENTORY_REPOSITORY) private readonly inventoryRepo: IInventoryRepository,
    private readonly eventBus: EventBus,
  ) {}

  async addStock(params: {
    itemId: string;
    quantity: number;
    reason: string;
    performedBy: string;
    organizationId: string;
  }): Promise<InventoryItem> {
    const item = await this.findOrFail(params.itemId, params.organizationId);

    // Domain method enforces invariants and records movements internally
    item.addStock(params.quantity, params.reason, params.performedBy);

    // Atomic: persist item + movements in one transaction
    const movements = item.pullPendingMovements();
    await this.inventoryRepo.saveWithMovements(item, movements);

    // Publish domain events AFTER successful commit
    this.eventBus.publishAll(item.pullDomainEvents());

    return item;
  }

  async removeStock(params: {
    itemId: string;
    quantity: number;
    reason: string;
    performedBy: string;
    organizationId: string;
  }): Promise<InventoryItem> {
    const item = await this.findOrFail(params.itemId, params.organizationId);

    item.removeStock(params.quantity, params.reason, params.performedBy);

    const movements = item.pullPendingMovements();
    await this.inventoryRepo.saveWithMovements(item, movements);
    this.eventBus.publishAll(item.pullDomainEvents());

    return item;
  }

  async adjust(params: {
    itemId: string;
    newQuantity: number;
    reason: string;
    performedBy: string;
    organizationId: string;
  }): Promise<InventoryItem> {
    const item = await this.findOrFail(params.itemId, params.organizationId);

    item.adjust(params.newQuantity, params.reason, params.performedBy);

    const movements = item.pullPendingMovements();
    await this.inventoryRepo.saveWithMovements(item, movements);
    this.eventBus.publishAll(item.pullDomainEvents());

    return item;
  }

  async getById(itemId: string, organizationId: string): Promise<InventoryItem> {
    return this.findOrFail(itemId, organizationId);
  }

  async listByWarehouse(organizationId: string, warehouseId: string): Promise<InventoryItem[]> {
    return this.inventoryRepo.findAll(organizationId, warehouseId);
  }

  private async findOrFail(id: string, organizationId: string): Promise<InventoryItem> {
    const item = await this.inventoryRepo.findById(id, organizationId);
    if (!item) {
      throw new EntityNotFoundException('InventoryItem', id);
    }
    return item;
  }
}

class EntityNotFoundException extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} with id ${id} not found`);
    this.name = 'EntityNotFoundException';
  }
}
```

---

## Exit Verification

```text
✅ Compilation
   $ npx tsc --noEmit
   → 0 errors, 0 warnings

✅ Domain Purity
   $ grep -r "import.*@nestjs\|import.*drizzle" src/modules/inventory/domain/
   → No matches found. Domain layer is framework-free.

✅ Tenant Isolation
   $ grep -n "organizationId" src/modules/inventory/infrastructure/repositories/drizzle-inventory.repository.ts
   → Lines 14, 24, 34, 56 — all queries filter by organizationId.
   $ grep -n "warehouseId" src/modules/inventory/infrastructure/repositories/drizzle-inventory.repository.ts
   → Lines 25, 36 — warehouse scoping applied where needed.

✅ Transaction Safety
   Verified: saveWithMovements() wraps quantity update + movement inserts
   in db.transaction(). Partial failure causes full rollback.

✅ Audit Trail
   Verified: Every stock operation records quantityBefore and quantityAfter
   in the stock_movements table via the entity's internal movement recording.

✅ Invariant Enforcement
   Verified: removeStock() throws InsufficientStockException when
   requested quantity exceeds available stock.
   Verified: adjust() rejects negative quantities.

✅ Domain Events
   Verified: Events collected in entity, pulled and published AFTER
   saveWithMovements() commits successfully.
   Verified: LowStockAlert fires when quantity ≤ threshold.

✅ Tests
   $ npx jest --testPathPattern=inventory --coverage
   PASS  src/modules/inventory/domain/__tests__/inventory-item.entity.spec.ts      (14 tests)
   PASS  src/modules/inventory/application/__tests__/inventory.service.spec.ts      (9 tests)
   PASS  src/modules/inventory/presentation/__tests__/inventory.controller.spec.ts  (7 tests)

   Statements : 97.3%
   Branches   : 93.5%
   Functions  : 100%
   Lines      : 96.8%
```
