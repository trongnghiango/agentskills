# STAX-Specific NestJS Extension

> **Auto-loaded** when project is detected as STAX (`@stax/db` or `@stax/contracts` in dependencies or `stax` in project name).
> This extends `references/nestjs.md` — do NOT duplicate content already in that file.

## 1. STAX Module Tier System

| Tier | Characteristics | Examples |
|---|---|---|
| **Tier 1 — Foundation** | No business logic, shared infrastructure | `Rbac`, `AuditLog`, `Notification`, `System` |
| **Tier 2 — Domain Core** | Core business entities, DNA of the system | `User`, `Employee`, `OrgStructure`, `Organization` |
| **Tier 3 — Process Flow** | Business workflows, depends on Tier 2 | `CRM`, `Accounting`, `Contracts`, `Conversation` |

Isolation rule: Tier 1/2 MUST NOT depend on Tier 3. Cross-module only via Port/Interface or EventBus. Imports across modules MUST go through `index.ts` (no deep imports).

## 2. STAX Shared Contracts Convention

All Request/Response schemas MUST be defined as Zod schemas at:
```
packages/contracts/src/{module-name}/...
```
And exported via package `@stax/contracts`.
Both Backend and Frontend import from `@stax/contracts`. Do NOT import from deprecated `shared/contracts/`.

Example:
```typescript
import { z } from 'zod';

export const createLeadSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  phone: z.string().optional(),
  source: z.enum(['WEBSITE', 'REFERRAL', 'COLD_CALL']),
});

export type CreateLeadData = z.infer<typeof createLeadSchema>;
```

## 3. STAX Context Boundaries & ID Suffix Standards (ADR-012)

> **STRICT RULE:** NEVER use `tenantId` in Tier 2/3 domain entities!
- `tenantId`: Platform/system-wide multi-tenancy boundary (AsyncLocalStorage / System Scope).
- `companyId`: HRM Context (Replaces `tenantId` for employer company in HRM).
- `clientId`: CRM Context (Replaces `tenantId` for customer client in CRM).
- `userId`: Login identity.
- `employeeId`: Internal company staff.
- `contactId`: Client contact representative.
- `actorId`: Audit logging only.

## 4. Multi-Tenancy Security & Child Entity Rule

1. **Child Entity Creation:** When creating child entities (`ContractAppendix`, `ContractItem`, `Task`), NEVER use tenant from session/controller payload. Query parent Aggregate Root first, then inherit parent's tenant.
2. **No Unsafe Fallback:** NEVER use `user.tenantId || 1` for external users → throw `ForbiddenException`.

## 5. STAX DI Token Convention

Always use Symbol tokens, never string tokens or class tokens:
```typescript
// ✅ Correct
export const ILeadRepository = Symbol('ILeadRepository');

// ❌ Wrong
@Inject('LeadRepository')  // string token
@Inject(DrizzleLeadRepository)  // class token
```

## 6. STAX DrizzleBaseRepository

All repositories extend `DrizzleBaseRepository` which provides:
- `getDb(tx?)` — returns transactional or default DB connection
- `mapToUpdate(data)` — strips immutable fields (`id`, `createdAt`) before UPDATE

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

## 7. STAX Transaction Manager (ALS-based)

Use `ITransactionManager` with AsyncLocalStorage — never pass `tx` manually through the call stack:
```typescript
@Inject('ITransactionManager') private readonly txManager: ITransactionManager;

async create(dto: CreateLeadDto, clientId: number): Promise<Lead> {
  const saved = await this.txManager.runInTransaction(async (tx) => {
    const entity = new Lead({ clientId, ...dto });
    return this.repo.save(entity, tx);
  });
  // Events AFTER transaction commit
  this.auditLog.log({ action: 'CREATE', entityType: 'Lead', entityId: saved.id }).catch(() => {});
  await this.eventBus.publish(new LeadCreatedEvent(saved));
  return saved;
}
```

## 8. STAX Server-Driven UI (_actions)

Entities that need permission-aware responses must include `_actions` in their Response DTO:

```typescript
export interface LeadResponseDto {
  id: number;
  name: string;
  status: LeadStatus;
  _actions: {
    canEdit: boolean;
    canDelete: boolean;
    canConvert: boolean;
    canAssign: boolean;
  };
}
```

## 9. STAX Pre-Deployment Quality Gates (G0-G6)

Run ALL required gate commands before declaring completion:

```bash
# ── G0: TypeScript, Contracts, DB & Lint ──
pnpm -F @stax/contracts typecheck
pnpm -F @stax/db typecheck
pnpm -F stax-backend check
pnpm -F stax-backend lint

# ── G1: Unit Tests (SPECIFIC FILE ONLY — NEVER RUN FULL SUITE) ──
# 🚨 WARNING: Never run 'pnpm -F stax-backend test' (CPU 100% timeout)
pnpm -F stax-backend test src/modules/<module>/path/to/file.spec.ts

# ── G3: DB Drift Check ──
pnpm db:check-drift

# ── Domain Purity Check ──
grep -rn "@nestjs\|drizzle-orm" src/modules/{module}/domain/
# → Must be empty

# ── Exception Compliance Check ──
grep -rn "NotFoundException\|BadRequestException\|ForbiddenException" src/modules/{module}/application/ src/modules/{module}/domain/
# → Must be empty (use domain exceptions)
```

## 10. STAX File Naming & 5-Step Workflow (Pattern B)

Document paths follow Pattern B directly at:
```
docs/STAX/history/{YYYYMMDD}_{feature_name_snake_case}/
├── analysis.md              # Step 1: Business Analysis & ADR-012
├── implementation_plan.md   # Step 2: Architecture & Contracts Design
├── task.md                  # Step 3: Implementation Checklist
├── test-plan.md             # Step 4: Test Plan (MANDATORY BEFORE CODE)
└── walkthrough.md           # Step 5: Verification & Gate Results
```
