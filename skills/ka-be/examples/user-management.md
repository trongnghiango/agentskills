# Example: User Management Module

> **Complexity**: Medium · **Patterns**: CRUD, Role-based Access, Tenant Isolation, Soft Delete

A complete walkthrough of building a multi-tenant User Management module using the enforced 4-Step Workflow. Users belong to an organization, have roles (admin/manager/member), and can be soft-deleted.

---

## Step 1 — Business & Architecture Analysis

### Module Classification

**Tier 2 — Domain Core.** User management enforces identity, role-based access, and tenant boundaries. Nearly every other module depends on user context.

### Bounded Context & Ubiquitous Language

| Business Concept | Code Name | Type |
|:---|:---|:---|
| User account | `User` | Aggregate Root |
| Access level | `UserRole` | Value Object (enum) |
| Account state | `UserStatus` | Value Object (enum) |
| Organization scope | `organizationId` | Tenant discriminator |

### API Contracts

| Method | Endpoint | Permission | Description |
|:---|:---|:---|:---|
| POST | `/users` | `admin` | Create a new user |
| GET | `/users` | `admin`, `manager` | List users in organization |
| GET | `/users/:id` | `authenticated` | Get user by ID |
| PATCH | `/users/:id` | `admin` | Update user profile or role |
| DELETE | `/users/:id` | `admin` | Soft-delete user |

### Domain Events

- **UserCreated** — published after a new user is persisted.
- **UserDeactivated** — published when a user is soft-deleted or suspended.

### Tenant Isolation

All queries are filtered by `organizationId` extracted from the authenticated session context. No endpoint accepts `organizationId` as a query parameter.

---

## Step 2 — Detailed Implementation Plan

### Database Schema

```
users
├── id            UUID   PK  DEFAULT gen_random_uuid()
├── email         TEXT   NOT NULL
├── display_name  TEXT   NOT NULL
├── role          user_role_enum   NOT NULL DEFAULT 'member'
├── status        user_status_enum NOT NULL DEFAULT 'active'
├── organization_id  UUID  NOT NULL  FK → organizations.id
├── created_at    TIMESTAMP WITH TZ  NOT NULL DEFAULT now()
├── updated_at    TIMESTAMP WITH TZ  NOT NULL DEFAULT now()
└── deleted_at    TIMESTAMP WITH TZ  NULL
UNIQUE(email, organization_id)
INDEX(organization_id, status)
```

### Domain Layer

- **Entity**: `User` — rich model with `activate()`, `deactivate()`, `changeRole()`, `updateProfile()`.
- **Invariants**: Cannot deactivate an already inactive user. Email must be non-empty. Role changes require the user to be active.
- **Exceptions**: `UserAlreadyInactiveException`, `InvalidEmailException`.

### Infrastructure Layer

- **Repository**: `DrizzleUserRepository` implements `IUserRepository`.
- **Mapper**: `UserMapper` converts between DB rows and domain entities.

### Application Layer

- **Service**: `UserService` — orchestrates CRUD. Calls domain methods on the entity, then persists via repository.

### Presentation Layer

- **Controller**: `UserController` with `@Roles()` guards and Zod input validation.

---

## Step 3 — Execution Checklist

- [x] Define `UserRole` and `UserStatus` enums (shared contracts)
- [x] Create `users` Drizzle schema with indexes
- [x] Write migration file
- [x] Create `User` domain entity with business methods
- [x] Create domain exceptions (`UserAlreadyInactiveException`)
- [x] Define `IUserRepository` port interface
- [x] Implement `DrizzleUserRepository`
- [x] Implement `UserMapper` (toDomain / toPersistence)
- [x] Create `CreateUserDto` and `UpdateUserDto` Zod schemas
- [x] Implement `UserService` (create, update, deactivate, list, getById)
- [x] Implement `UserController` with route handlers
- [x] Add `@Roles()` decorators for RBAC
- [x] Add tenant context extraction middleware
- [x] Write unit tests for `User` entity
- [x] Write unit tests for `UserService` (mocked repository)
- [x] Write integration tests for `UserController`
- [x] Run domain purity verification
- [x] Run full compilation and test suite

---

## Step 4 — Code & Verification

### 4.1 Schema (Drizzle)

```typescript
// src/modules/user/infrastructure/schema/user.schema.ts
import { pgTable, uuid, text, timestamp, uniqueIndex, index, pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['admin', 'manager', 'member']);
export const userStatusEnum = pgEnum('user_status', ['active', 'inactive', 'suspended']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  role: userRoleEnum('role').notNull().default('member'),
  status: userStatusEnum('status').notNull().default('active'),
  organizationId: uuid('organization_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('uq_users_email_org').on(table.email, table.organizationId),
  index('idx_users_org_status').on(table.organizationId, table.status),
]);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
```

### 4.2 Entity (Rich Domain Model)

```typescript
// src/modules/user/domain/entities/user.entity.ts

export type UserRole = 'admin' | 'manager' | 'member';
export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface DomainEvent {
  readonly eventName: string;
  readonly occurredAt: Date;
  readonly payload: Record<string, unknown>;
}

export class User {
  private _domainEvents: DomainEvent[] = [];

  private constructor(
    private readonly _id: string,
    private _email: string,
    private _displayName: string,
    private _role: UserRole,
    private _status: UserStatus,
    private readonly _organizationId: string,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
    private _deletedAt: Date | null,
  ) {}

  // --- Factory ---
  static create(params: {
    id: string;
    email: string;
    displayName: string;
    role: UserRole;
    status: UserStatus;
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }): User {
    if (!params.email || !params.email.includes('@')) {
      throw new InvalidEmailException(params.email);
    }
    return new User(
      params.id,
      params.email,
      params.displayName,
      params.role,
      params.status,
      params.organizationId,
      params.createdAt,
      params.updatedAt,
      params.deletedAt,
    );
  }

  static createNew(params: {
    id: string;
    email: string;
    displayName: string;
    role: UserRole;
    organizationId: string;
  }): User {
    const now = new Date();
    const user = User.create({
      ...params,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    user.addEvent('UserCreated', { userId: user.id, email: user.email });
    return user;
  }

  // --- Business Methods ---
  activate(): void {
    if (this._status === 'active') return;
    this._status = 'active';
    this._deletedAt = null;
    this.touch();
  }

  deactivate(): void {
    if (this._status === 'inactive') {
      throw new UserAlreadyInactiveException(this._id);
    }
    this._status = 'inactive';
    this._deletedAt = new Date();
    this.touch();
    this.addEvent('UserDeactivated', { userId: this._id });
  }

  changeRole(newRole: UserRole): void {
    if (this._status !== 'active') {
      throw new UserNotActiveException(this._id);
    }
    if (this._role === newRole) return;
    this._role = newRole;
    this.touch();
  }

  updateProfile(params: { displayName?: string; email?: string }): void {
    if (params.email !== undefined) {
      if (!params.email || !params.email.includes('@')) {
        throw new InvalidEmailException(params.email);
      }
      this._email = params.email;
    }
    if (params.displayName !== undefined) {
      this._displayName = params.displayName;
    }
    this.touch();
  }

  // --- Getters ---
  get id(): string { return this._id; }
  get email(): string { return this._email; }
  get displayName(): string { return this._displayName; }
  get role(): UserRole { return this._role; }
  get status(): UserStatus { return this._status; }
  get organizationId(): string { return this._organizationId; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get deletedAt(): Date | null { return this._deletedAt; }
  get isActive(): boolean { return this._status === 'active'; }

  pullDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }

  // --- Private Helpers ---
  private touch(): void {
    this._updatedAt = new Date();
  }

  private addEvent(name: string, payload: Record<string, unknown>): void {
    this._domainEvents.push({ eventName: name, occurredAt: new Date(), payload });
  }
}

// --- Domain Exceptions ---
export class InvalidEmailException extends Error {
  constructor(email: string) {
    super(`Invalid email address: "${email}"`);
    this.name = 'InvalidEmailException';
  }
}

export class UserAlreadyInactiveException extends Error {
  constructor(userId: string) {
    super(`User ${userId} is already inactive`);
    this.name = 'UserAlreadyInactiveException';
  }
}

export class UserNotActiveException extends Error {
  constructor(userId: string) {
    super(`User ${userId} must be active to perform this operation`);
    this.name = 'UserNotActiveException';
  }
}
```

### 4.3 Repository Port

```typescript
// src/modules/user/domain/ports/user-repository.port.ts
import { User } from '../entities/user.entity';

export interface IUserRepository {
  findById(id: string, organizationId: string): Promise<User | null>;
  findByEmail(email: string, organizationId: string): Promise<User | null>;
  findAll(organizationId: string, filters?: { status?: string }): Promise<User[]>;
  save(user: User): Promise<void>;
  softDelete(id: string, organizationId: string): Promise<void>;
}

export const USER_REPOSITORY = Symbol('IUserRepository');
```

### 4.4 Mapper

```typescript
// src/modules/user/infrastructure/mappers/user.mapper.ts
import { User, UserRole, UserStatus } from '../../domain/entities/user.entity';
import { UserRow, NewUserRow } from '../schema/user.schema';

export class UserMapper {
  static toDomain(row: UserRow): User {
    return User.create({
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      role: row.role as UserRole,
      status: row.status as UserStatus,
      organizationId: row.organizationId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    });
  }

  static toPersistence(entity: User): NewUserRow {
    return {
      id: entity.id,
      email: entity.email,
      displayName: entity.displayName,
      role: entity.role,
      status: entity.status,
      organizationId: entity.organizationId,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      deletedAt: entity.deletedAt,
    };
  }
}
```

### 4.5 Repository Implementation

```typescript
// src/modules/user/infrastructure/repositories/drizzle-user.repository.ts
import { eq, and, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { User } from '../../domain/entities/user.entity';
import { IUserRepository } from '../../domain/ports/user-repository.port';
import { users } from '../schema/user.schema';
import { UserMapper } from '../mappers/user.mapper';

export class DrizzleUserRepository implements IUserRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async findById(id: string, organizationId: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(and(
        eq(users.id, id),
        eq(users.organizationId, organizationId),
        isNull(users.deletedAt),
      ))
      .limit(1);
    return rows[0] ? UserMapper.toDomain(rows[0]) : null;
  }

  async findByEmail(email: string, organizationId: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(and(
        eq(users.email, email),
        eq(users.organizationId, organizationId),
        isNull(users.deletedAt),
      ))
      .limit(1);
    return rows[0] ? UserMapper.toDomain(rows[0]) : null;
  }

  async findAll(organizationId: string): Promise<User[]> {
    const rows = await this.db
      .select()
      .from(users)
      .where(and(
        eq(users.organizationId, organizationId),
        isNull(users.deletedAt),
      ));
    return rows.map(UserMapper.toDomain);
  }

  async save(user: User): Promise<void> {
    const data = UserMapper.toPersistence(user);
    await this.db
      .insert(users)
      .values(data)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: data.email,
          displayName: data.displayName,
          role: data.role,
          status: data.status,
          updatedAt: data.updatedAt,
          deletedAt: data.deletedAt,
        },
      });
  }

  async softDelete(id: string, organizationId: string): Promise<void> {
    await this.db
      .update(users)
      .set({ deletedAt: new Date(), status: 'inactive', updatedAt: new Date() })
      .where(and(
        eq(users.id, id),
        eq(users.organizationId, organizationId),
      ));
  }
}
```

### 4.6 Service

```typescript
// src/modules/user/application/user.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { User, UserRole } from '../domain/entities/user.entity';
import { IUserRepository, USER_REPOSITORY } from '../domain/ports/user-repository.port';
import { EventBus } from '../../shared/events/event-bus';

@Injectable()
export class UserService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    private readonly eventBus: EventBus,
  ) {}

  async create(params: {
    email: string;
    displayName: string;
    role: UserRole;
    organizationId: string;
  }): Promise<User> {
    const existing = await this.userRepo.findByEmail(params.email, params.organizationId);
    if (existing) {
      throw new Error(`User with email ${params.email} already exists in this organization`);
    }

    const user = User.createNew({
      id: crypto.randomUUID(),
      email: params.email,
      displayName: params.displayName,
      role: params.role,
      organizationId: params.organizationId,
    });

    await this.userRepo.save(user);
    this.eventBus.publishAll(user.pullDomainEvents());
    return user;
  }

  async update(id: string, organizationId: string, params: {
    displayName?: string;
    email?: string;
    role?: UserRole;
  }): Promise<User> {
    const user = await this.findOrFail(id, organizationId);

    if (params.displayName || params.email) {
      user.updateProfile({ displayName: params.displayName, email: params.email });
    }
    if (params.role) {
      user.changeRole(params.role);
    }

    await this.userRepo.save(user);
    this.eventBus.publishAll(user.pullDomainEvents());
    return user;
  }

  async deactivate(id: string, organizationId: string): Promise<void> {
    const user = await this.findOrFail(id, organizationId);
    user.deactivate();
    await this.userRepo.save(user);
    this.eventBus.publishAll(user.pullDomainEvents());
  }

  async getById(id: string, organizationId: string): Promise<User> {
    return this.findOrFail(id, organizationId);
  }

  async list(organizationId: string): Promise<User[]> {
    return this.userRepo.findAll(organizationId);
  }

  private async findOrFail(id: string, organizationId: string): Promise<User> {
    const user = await this.userRepo.findById(id, organizationId);
    if (!user) {
      throw new EntityNotFoundException('User', id);
    }
    return user;
  }
}

class EntityNotFoundException extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} with id ${id} not found`);
    this.name = 'EntityNotFoundException';
  }
}
```

### 4.7 Controller (Brief)

```typescript
// src/modules/user/presentation/user.controller.ts
import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { UserService } from '../application/user.service';
import { Roles } from '../../shared/decorators/roles.decorator';
import { AuthGuard } from '../../shared/guards/auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { TenantContext } from '../../shared/decorators/tenant.decorator';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { UserResponseMapper } from './mappers/user-response.mapper';

@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @Roles('admin')
  async create(@Body() dto: CreateUserDto, @TenantContext() orgId: string) {
    const user = await this.userService.create({ ...dto, organizationId: orgId });
    return UserResponseMapper.toResponse(user);
  }

  @Get()
  @Roles('admin', 'manager')
  async list(@TenantContext() orgId: string) {
    const users = await this.userService.list(orgId);
    return users.map(UserResponseMapper.toResponse);
  }

  @Get(':id')
  async getById(@Param('id') id: string, @TenantContext() orgId: string) {
    const user = await this.userService.getById(id, orgId);
    return UserResponseMapper.toResponse(user);
  }

  @Patch(':id')
  @Roles('admin')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto, @TenantContext() orgId: string) {
    const user = await this.userService.update(id, orgId, dto);
    return UserResponseMapper.toResponse(user);
  }

  @Delete(':id')
  @Roles('admin')
  async remove(@Param('id') id: string, @TenantContext() orgId: string) {
    await this.userService.deactivate(id, orgId);
    return { success: true };
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
   $ grep -r "import.*@nestjs\|import.*drizzle" src/modules/user/domain/
   → No matches found. Domain layer is framework-free.

✅ Tenant Isolation
   $ grep -n "organizationId" src/modules/user/infrastructure/repositories/drizzle-user.repository.ts
   → Lines 16, 26, 37, 55, 62 — all queries filter by organizationId.

✅ Exception Boundary
   $ grep -rn "HttpException\|NotFoundException\|BadRequest" src/modules/user/domain/ src/modules/user/application/
   → No matches. HTTP exceptions are only used in the presentation layer.

✅ Tests
   $ npx jest --testPathPattern=user --coverage
   PASS  src/modules/user/domain/__tests__/user.entity.spec.ts      (8 tests)
   PASS  src/modules/user/application/__tests__/user.service.spec.ts (6 tests)
   PASS  src/modules/user/presentation/__tests__/user.controller.spec.ts (5 tests)
   
   Statements : 94.2%
   Branches   : 88.9%
   Functions  : 100%
   Lines      : 93.7%
```
