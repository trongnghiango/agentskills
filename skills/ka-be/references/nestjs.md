# NestJS + TypeScript + Drizzle Clean Architecture Blueprint

This blueprint describes the specific implementation standards for NestJS projects with TypeScript and Drizzle ORM.

---

## 1. Technical Stack & Patterns

| Element | Tool / Library | Specification |
| :--- | :--- | :--- |
| **Framework** | NestJS | strict mode enabled |
| **Database** | PostgreSQL | Drizzle ORM (SQL-First) |
| **Dependency Injection** | NestJS DI | Using Symbol tokens (e.g., `Symbol('IMyRepository')`) rather than class tokens |
| **Transaction** | `ITransactionManager` | Enforced wrapper utilizing AsyncLocalStorage (ALS) context |
| **Events** | `IEventBus` | Asynchronous Domain Events published *after* transaction commit |
| **Exceptions** | Nest `@Catch` | Map domain exceptions (`EntityNotFoundException`, `BusinessRuleValidationException`) to HTTP exceptions at the controller filter level |
| **Testing** | PGLite | Run in-memory integration tests with `@electric-sql/pglite` |

---

## 2. Standard Code Blueprints

### A. Database Schema Definition (Drizzle)
```typescript
import { pgTable, bigserial, varchar, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { myStatusEnum } from './enums';

export const myEntities = pgTable('my_entities', {
  id:             bigserial('id', { mode: 'number' }).primaryKey(),
  organizationId: bigint('organization_id', { mode: 'number' }).notNull(),
  name:           varchar('name', { length: 255 }).notNull(),
  status:         myStatusEnum('status').notNull().default('ACTIVE'),
  metadata:       text('metadata'),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
  updatedAt:      timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  orgIdx:    uniqueIndex('idx_my_entities_org_name').on(t.organizationId, t.name),
  statusIdx: index('idx_my_entities_status').on(t.organizationId, t.status),
}));
```

### B. pgEnum Definition
```typescript
import { pgEnum } from 'drizzle-orm/pg-core';

export const myStatusEnum = pgEnum('my_status_enum', ['ACTIVE', 'INACTIVE', 'ARCHIVED']);
export type MyStatus = typeof myStatusEnum.enumValues[number];
```

### C. Pure Domain Entity (TypeScript)
```typescript
import { BusinessRuleValidationException } from '@core/shared/exceptions';

export interface MyEntityProps {
  id?: number;
  organizationId: number;
  name: string;
  status: MyStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export class MyEntity {
  private _id?: number;
  private _organizationId: number;
  private _name: string;
  private _status: MyStatus;
  private _createdAt?: Date;
  private _updatedAt?: Date;

  constructor(props: MyEntityProps) {
    this._id = props.id;
    this._organizationId = props.organizationId;
    this._name = props.name;
    this._status = props.status ?? 'ACTIVE';
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  get id() { return this._id; }
  get organizationId() { return this._organizationId; }
  get name() { return this._name; }
  get status() { return this._status; }
  get createdAt() { return this._createdAt; }
  get updatedAt() { return this._updatedAt; }

  archive(): void {
    if (this._status === 'ARCHIVED') {
      throw new BusinessRuleValidationException('Entity has already been archived.');
    }
    this._status = 'ARCHIVED';
    this._updatedAt = new Date();
  }

  rename(newName: string): void {
    if (!newName?.trim()) {
      throw new BusinessRuleValidationException('Name cannot be empty.');
    }
    this._name = newName.trim();
    this._updatedAt = new Date();
  }
}
```

### D. Repository Port (Interface & Symbol)
```typescript
export const IMyEntityRepository = Symbol('IMyEntityRepository');

export interface IMyEntityRepository {
  findById(id: number, orgId: number): Promise<MyEntity | null>;
  findByName(name: string, orgId: number): Promise<MyEntity | null>;
  save(entity: MyEntity, tx?: any): Promise<MyEntity>;
}
```

### E. Infrastructure Mapper
```typescript
import { InferSelectModel } from 'drizzle-orm';
import { myEntities } from './schema';
import { MyEntity } from '../../domain/my-entity';

type MyEntityRecord = InferSelectModel<typeof myEntities>;

export class MyEntityMapper {
  static toDomain(record: MyEntityRecord): MyEntity {
    return new MyEntity({
      id:             record.id,
      organizationId: record.organizationId,
      name:           record.name,
      status:         record.status,
      createdAt:      record.createdAt,
      updatedAt:      record.updatedAt,
    });
  }

  static toPersistence(entity: MyEntity): Omit<MyEntityRecord, 'id' | 'createdAt'> {
    return {
      organizationId: entity.organizationId,
      name:           entity.name,
      status:         entity.status,
      updatedAt:      new Date(),
    };
  }
}
```

### F. Concrete Repository Adapter (Drizzle)
```typescript
import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DrizzleBaseRepository } from '@infrastructure/database/drizzle-base.repository';
import { IMyEntityRepository } from '../../domain/ports/my-entity.repository.port';
import { MyEntity } from '../../domain/my-entity';
import { myEntities } from '../schema';
import { MyEntityMapper } from '../mappers/my-entity.mapper';

@Injectable()
export class DrizzleMyEntityRepository
  extends DrizzleBaseRepository
  implements IMyEntityRepository
{
  async findById(id: number, orgId: number): Promise<MyEntity | null> {
    const db = this.getDb();
    const result = await db
      .select()
      .from(myEntities)
      .where(and(eq(myEntities.id, id), eq(myEntities.organizationId, orgId)))
      .limit(1);
    return result[0] ? MyEntityMapper.toDomain(result[0]) : null;
  }

  async findByName(name: string, orgId: number): Promise<MyEntity | null> {
    const db = this.getDb();
    const result = await db
      .select()
      .from(myEntities)
      .where(and(eq(myEntities.name, name), eq(myEntities.organizationId, orgId)))
      .limit(1);
    return result[0] ? MyEntityMapper.toDomain(result[0]) : null;
  }

  async save(entity: MyEntity, tx?: any): Promise<MyEntity> {
    const db = this.getDb(tx);
    const data = MyEntityMapper.toPersistence(entity);
    if (entity.id) {
      await db
        .update(myEntities)
        .set(this.mapToUpdate(data)) // mapToUpdate excludes immutable fields like 'id' and 'createdAt'
        .where(eq(myEntities.id, entity.id));
      return entity;
    }
    const [inserted] = await db.insert(myEntities).values(data).returning();
    return MyEntityMapper.toDomain(inserted);
  }
}
```

### G. Application Service
```typescript
import { Injectable, Inject } from '@nestjs/common';
import { IMyEntityRepository } from '../ports/my-entity.repository.port';
import { MyEntity } from '../../domain/my-entity';
import { CreateMyEntityDto } from '../dtos/create-my-entity.dto';
import { BusinessRuleValidationException } from '@core/shared/exceptions';

@Injectable()
export class MyEntityService {
  constructor(
    @Inject(IMyEntityRepository) private readonly repo: IMyEntityRepository,
    @Inject('ITransactionManager') private readonly txManager: any,
    @Inject('IEventBus') private readonly eventBus: any,
    @Inject('IAuditLogService') private readonly auditLog: any,
  ) {}

  async create(dto: CreateMyEntityDto, orgId: number): Promise<MyEntity> {
    const existing = await this.repo.findByName(dto.name, orgId);
    if (existing) {
      throw new BusinessRuleValidationException(`Name "${dto.name}" is already taken.`);
    }

    const saved = await this.txManager.runInTransaction(async (tx: any) => {
      const entity = new MyEntity({ organizationId: orgId, name: dto.name, status: 'ACTIVE' });
      return this.repo.save(entity, tx);
    });

    // Audit logs run out-of-transaction (fire-and-forget)
    this.auditLog.log({ action: 'CREATE', entityId: saved.id }).catch(() => {});

    // Domain Event is published after transaction success
    await this.eventBus.publish(new MyEntityCreatedEvent(saved));

    return saved;
  }
}
```

### H. Module Wiring
```typescript
import { Module } from '@nestjs/common';
import { MyEntityController } from './presentation/my-entity.controller';
import { MyEntityService } from './application/my-entity.service';
import { IMyEntityRepository } from './domain/ports/my-entity.repository.port';
import { DrizzleMyEntityRepository } from './infrastructure/repositories/drizzle-my-entity.repository';

@Module({
  controllers: [MyEntityController],
  providers: [
    MyEntityService,
    { provide: IMyEntityRepository, useClass: DrizzleMyEntityRepository },
  ],
  exports: [MyEntityService, IMyEntityRepository],
})
export class MyEntityModule {}
```

---

## 3. NestJS Code Verification Command
Ensure your code is clean by running these audits before completing features:
```bash
# Verify TypeScript compiles
npm run build

# Check for leaky framework imports inside the Domain directory (should yield zero hits)
grep -r "@nestjs\|drizzle-orm" src/modules/{domain_name}/domain/

# Check for HTTP exceptions inside Domain or Application services (should yield zero hits)
grep -r "NotFoundException\|BadRequestException\|ForbiddenException" src/modules/{domain_name}/application/ src/modules/{domain_name}/domain/
```
