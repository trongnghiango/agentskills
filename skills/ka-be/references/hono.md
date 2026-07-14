# Hono + Bun + Drizzle Clean Architecture Blueprint

This blueprint describes the specific implementation standards for Bun-native Hono backend applications.

---

## 1. Technical Stack & Patterns

| Element | Tool / Library | Specification |
| :--- | :--- | :--- |
| **Runtime** | Bun | Native TypeScript runner and bundler |
| **Framework** | Hono | Lightweight Web Framework |
| **Database** | SQLite / Postgres | Drizzle ORM |
| **Validation** | Zod | Enforced request validation via `@hono/zod-validator` |
| **Tenant Context** | AsyncLocalStorage | Dynamic request context propagation for multi-tenancy and authentication |
| **Dependency Injection** | Manual Composition | constructor injection or simple factory orchestration |

---

## 2. Standard Code Blueprints

### A. Database Schema & Dynamic SQLite Bootstrapping
```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const itemsTable = sqliteTable('items', {
  id:             text('id').primaryKey(),
  userId:         text('user_id').notNull(),
  title:          text('title').notNull(),
  description:    text('description'),
  status:         text('status').default('PENDING').notNull(),
  createdAt:      text('created_at').notNull(),
});
```

### B. Pure Domain Entity (TypeScript)
```typescript
import { BusinessRuleValidationException } from '../exceptions';

export interface ItemProps {
  id: string;
  userId: string;
  title: string;
  description?: string;
  status: 'PENDING' | 'COMPLETED';
  createdAt: string;
}

export class Item {
  private props: ItemProps;

  constructor(props: ItemProps) {
    if (!props.title || props.title.trim().length === 0) {
      throw new BusinessRuleValidationException('Title is required.');
    }
    this.props = { ...props };
  }

  get id() { return this.props.id; }
  get userId() { return this.props.userId; }
  get title() { return this.props.title; }
  get description() { return this.props.description; }
  get status() { return this.props.status; }
  get createdAt() { return this.props.createdAt; }

  complete(): void {
    if (this.props.status === 'COMPLETED') {
      throw new BusinessRuleValidationException('Item is already completed.');
    }
    this.props.status = 'COMPLETED';
  }
}
```

### C. Repository Port (Interface)
```typescript
export interface IItemRepository {
  findById(id: string, userId: string): Promise<Item | null>;
  save(item: Item): Promise<Item>;
}
```

### D. User Context Middleware (using AsyncLocalStorage)
```typescript
import { AsyncLocalStorage } from 'node:async_hooks';

export interface UserSession {
  userId: string;
  role: string;
}

export const userLocalStorage = new AsyncLocalStorage<UserSession>();

export const UserContext = {
  getUserId(): string {
    const session = userLocalStorage.getStore();
    if (!session) throw new Error('User context not available.');
    return session.userId;
  },
  getRole(): string {
    const session = userLocalStorage.getStore();
    if (!session) throw new Error('User context not available.');
    return session.role;
  }
};
```

### E. Concrete Repository Adapter (Drizzle & ALS Tenant Isolation)
```typescript
import { eq, and } from 'drizzle-orm';
import { IItemRepository } from '../../domain/ports/item-repository.interface';
import { Item } from '../../domain/entities/item.entity';
import { itemsTable } from '../schema';
import { UserContext } from '../../infrastructure/auth/user-context';

export class DrizzleItemRepository implements IItemRepository {
  constructor(private readonly db: any) {}

  async findById(id: string, userId: string): Promise<Item | null> {
    // Isolated lookup utilizing both user identity and record ID
    const [row] = await this.db
      .select()
      .from(itemsTable)
      .where(and(eq(itemsTable.id, id), eq(itemsTable.userId, userId)));
      
    if (!row) return null;
    return new Item({
      id:          row.id,
      userId:      row.userId,
      title:       row.title,
      description: row.description || undefined,
      status:      row.status as 'PENDING' | 'COMPLETED',
      createdAt:   row.createdAt,
    });
  }

  async save(item: Item): Promise<Item> {
    const data = {
      id:          item.id,
      userId:      item.userId,
      title:       item.title,
      description: item.description || null,
      status:      item.status,
      createdAt:   item.createdAt,
    };

    // Upsert logic
    const existing = await this.findById(item.id, item.userId);
    if (existing) {
      await this.db
        .update(itemsTable)
        .set({ title: data.title, description: data.description, status: data.status })
        .where(eq(itemsTable.id, item.id));
    } else {
      await this.db.insert(itemsTable).values(data);
    }
    return item;
  }
}
```

### F. Hono Presentation Layer (Route Controllers with Zod contracts)
```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { IItemRepository } from '../domain/ports/item-repository.interface';
import { Item } from '../domain/entities/item.entity';
import { BusinessRuleValidationException } from '../exceptions';
import { UserContext } from '../infrastructure/auth/user-context';

const createItemSchema = z.zod({
  title: z.string().min(1),
  description: z.string().optional(),
});

export function createItemsRouter(repo: IItemRepository) {
  const router = new Hono();

  // Create Item endpoint
  router.post('/', zValidator('json', createItemSchema), async (c) => {
    const body = c.req.valid('json');
    
    // Propagate active tenant implicitly from context
    const userId = UserContext.getUserId();
    
    try {
      const newItem = new Item({
        id:          crypto.randomUUID(),
        userId:      userId,
        title:       body.title,
        description: body.description,
        status:      'PENDING',
        createdAt:   new Date().toISOString(),
      });

      const saved = await repo.save(newItem);
      return c.json({ success: true, data: saved }, 201);
    } catch (error) {
      if (error instanceof BusinessRuleValidationException) {
        return c.json({ success: false, error: error.message }, 400);
      }
      return c.json({ success: false, error: 'Internal Server Error' }, 500);
    }
  });

  return router;
}
```

---

## 3. Exit Verification Checklist
Verify purity and build consistency:
```bash
# Verify Hono TypeScript compiler validity
bun run build

# Verify Domain does not leak Hono context or database connections (should yield zero hits)
grep -r "hono\|drizzle-orm" src/domain/
```
