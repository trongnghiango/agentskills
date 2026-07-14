# STAX-Specific NestJS Extension

> **Auto-loaded** when project is detected as STAX (`@core/shared` in dependencies or `stax` in project name).
> This extends `references/nestjs.md` — do NOT duplicate content already in that file.

## 1. STAX Module Tier System

| Tier | Characteristics | Examples |
|---|---|---|
| **Tier 1 — Foundation** | No business logic, shared across system | `Rbac`, `AuditLog`, `Notification`, `Storage` |
| **Tier 2 — Domain Core** | Core business entities, DNA of the system | `User`, `Employee`, `OrgStructure` |
| **Tier 3 — Process Flow** | Business workflows, depends on Tier 2 | `CRM`, `Accounting`, `Contracts` |

Isolation rule: Tier 2 MUST NOT depend on Tier 3. Cross-module only via Port/Interface or EventBus.

## 2. STAX Shared Contracts Convention

All Request/Response schemas MUST be defined as Zod schemas at:
```
shared/contracts/{module-name}.contract.ts
```

Both Backend and Frontend import from this single source of truth.

Example:
```typescript
import { z } from 'zod';

export const CreateLeadSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  phone: z.string().optional(),
  source: z.enum(['WEBSITE', 'REFERRAL', 'COLD_CALL']),
});

export type CreateLeadDto = z.infer<typeof CreateLeadSchema>;
```

## 3. STAX DI Token Convention

Always use Symbol tokens, never string tokens or class tokens:
```typescript
// ✅ Correct
export const ILeadRepository = Symbol('ILeadRepository');

// ❌ Wrong
@Inject('LeadRepository')  // string token
@Inject(DrizzleLeadRepository)  // class token
```

## 4. STAX DrizzleBaseRepository

All repositories extend `DrizzleBaseRepository` which provides:
- `getDb(tx?)` — returns transactional or default DB connection
- `mapToUpdate(data)` — strips immutable fields (id, createdAt) before UPDATE

```typescript
@Injectable()
export class DrizzleLeadRepository
  extends DrizzleBaseRepository
  implements ILeadRepository
{
  async save(entity: Lead, tx?: Transaction): Promise<Lead> {
    const db = this.getDb(tx);
    const data = LeadMapper.toPersistence(entity);
    if (entity.id) {
      // mapToUpdate() protects immutable fields
      await db.update(leads).set(this.mapToUpdate(data)).where(eq(leads.id, entity.id));
      return entity;
    }
    const [inserted] = await db.insert(leads).values(data).returning();
    return LeadMapper.toDomain(inserted);
  }
}
```

## 5. STAX Transaction Manager (ALS-based)

Use `ITransactionManager` with AsyncLocalStorage — never pass `tx` manually through the call stack:
```typescript
@Inject('ITransactionManager') private readonly txManager: ITransactionManager;

async create(dto: CreateLeadDto, orgId: number): Promise<Lead> {
  const saved = await this.txManager.runInTransaction(async (tx) => {
    const entity = new Lead({ ... });
    return this.repo.save(entity, tx);
  });
  // Events AFTER transaction
  await this.eventBus.publish(new LeadCreatedEvent(saved));
  return saved;
}
```

## 6. STAX Audit Log Convention

Always fire-and-forget with `.catch()` — NEVER await inside transaction:
```typescript
// ✅ Correct
this.auditLog.log({ action: 'CREATE', entityType: 'Lead', entityId: saved.id }).catch(() => {});

// ❌ Wrong — blocks transaction, can cause cascade failure
await this.auditLog.log({ ... });
```

## 7. STAX Server-Driven UI (_actions)

Entities that need permission-aware responses must include `_actions` in their Response DTO:

```typescript
export interface LeadResponseDto {
  id: number;
  name: string;
  status: LeadStatus;
  // Server-Driven UI
  _actions: {
    canEdit: boolean;
    canDelete: boolean;
    canConvert: boolean;
    canAssign: boolean;
  };
}

// Computed in the Response Mapper, NOT in Controller
export class LeadResponseMapper {
  static toResponse(entity: Lead, userRole: UserRole): LeadResponseDto {
    return {
      id: entity.id,
      name: entity.name,
      status: entity.status,
      _actions: {
        canEdit: entity.status !== 'CONVERTED' && ['ADMIN', 'SALES_MANAGER'].includes(userRole),
        canDelete: entity.status === 'DRAFT' && userRole === 'ADMIN',
        canConvert: entity.status === 'QUALIFIED' && ['ADMIN', 'SALES_MANAGER'].includes(userRole),
        canAssign: ['ADMIN', 'SALES_MANAGER'].includes(userRole),
      },
    };
  }
}
```

## 8. STAX Integration Testing (PGLite)

Use `@electric-sql/pglite` for in-memory PostgreSQL integration tests:
```typescript
import { PGlite } from '@electric-sql/pglite';

describe('DrizzleLeadRepository', () => {
  let db: PGlite;
  let repo: DrizzleLeadRepository;

  beforeAll(async () => {
    db = new PGlite();
    // Run migrations or create tables
    await db.exec(createTablesSQL);
    repo = new DrizzleLeadRepository(drizzle(db));
  });

  afterAll(async () => {
    await db.close();
  });

  it('should save and find by id', async () => {
    const lead = new Lead({ organizationId: 1, name: 'Test Lead', status: 'NEW' });
    const saved = await repo.save(lead);
    const found = await repo.findById(saved.id!, 1);
    expect(found).not.toBeNull();
    expect(found!.name).toBe('Test Lead');
  });
});
```

## 9. STAX Exit Verification Commands

Run ALL 5 commands and paste results before declaring completion:

```bash
# 1. TypeScript build
npm run build
# → Must have 0 errors

# 2. Domain purity
grep -r "@nestjs\|drizzle-orm" src/modules/{module}/domain/
# → Must be empty

# 3. Exception compliance
grep -r "NotFoundException\|BadRequestException\|ForbiddenException" src/modules/{module}/application/ src/modules/{module}/domain/
# → Must be empty

# 4. Tenant isolation
grep -r "\.where(" src/modules/{module}/infrastructure/ | grep -v "organizationId"
# → Review each line

# 5. Audit log compliance
grep -r "auditLog\.log" src/modules/{module}/ | grep -v "\.catch"
# → Must be empty (all auditLog.log must have .catch())
```

## 10. STAX File Naming Convention

Document paths follow this structure:
```
docs/context/{YYYYMMDD}_{feature_name_snake_case}/
├── 00_be_analysis.md
├── 01_be_implementation_plan.md
├── 02_be_tasks.md
└── 03_be_walkthrough.md
```

After completion, move to `docs/history/{YYYYMMDD}_{feature_name_snake_case}/`.
