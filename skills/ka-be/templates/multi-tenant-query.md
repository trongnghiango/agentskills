# Multi-Tenant Query Template

> **Quick Reference**
> | Aspect | Detail |
> |:---|:---|
> | Complexity | Medium |
> | Layers touched | Presentation (context extraction) → Application (propagation) → Infrastructure (query filtering) |
> | Key patterns | Implicit Tenant Context, AsyncLocalStorage / context.Context, Composite Indexes |
> | Critical rule | Tenant ID comes from JWT/session, NEVER from query string or request body |
> | Prerequisites | Authentication middleware, tenant context propagation in place |

---

## 1. Standard Tenant Isolation Pattern

Every query that touches tenant data **must** filter by `organizationId`.

### TypeScript (Drizzle)

```typescript
// infrastructure/product.repository.ts
import { eq, and, ilike, sql } from 'drizzle-orm';
import { products } from './product.schema';

export class ProductRepository implements IProductRepository {
  constructor(private readonly db: DrizzleClient) {}

  async findAll(params: ProductQueryParams): Promise<PaginatedResult<Product>> {
    const conditions = [
      eq(products.organizationId, params.organizationId), // ← ALWAYS present
      eq(products.isDeleted, false),
    ];

    if (params.isActive !== undefined) {
      conditions.push(eq(products.isActive, params.isActive));
    }
    if (params.search) {
      conditions.push(ilike(products.name, `%${params.search}%`));
    }

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(products)
        .where(and(...conditions))
        .limit(params.pageSize)
        .offset((params.page - 1) * params.pageSize)
        .orderBy(products[params.sortBy ?? 'createdAt']),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(products)
        .where(and(...conditions)),
    ]);

    const total = Number(countResult[0].count);
    return {
      data: data.map(ProductMapper.toDomain),
      total,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.ceil(total / params.pageSize),
    };
  }

  async findById(id: string, organizationId: string): Promise<Product | null> {
    const [row] = await this.db
      .select()
      .from(products)
      .where(
        and(
          eq(products.id, id),
          eq(products.organizationId, organizationId), // ← ALWAYS present
          eq(products.isDeleted, false),
        ),
      );
    return row ? ProductMapper.toDomain(row) : null;
  }
}
```

### Go (sqlx)

```go
// internal/product/infra/product_repository.go
func (r *ProductRepository) FindAll(
    ctx context.Context, orgID string, filter ProductFilter,
) ([]domain.Product, int, error) {
    query := `
        SELECT * FROM products
        WHERE organization_id = $1        -- ALWAYS present
          AND is_deleted = false
    `
    args := []interface{}{orgID}
    argIdx := 2

    if filter.IsActive != nil {
        query += fmt.Sprintf(" AND is_active = $%d", argIdx)
        args = append(args, *filter.IsActive)
        argIdx++
    }

    if filter.Search != "" {
        query += fmt.Sprintf(" AND name ILIKE $%d", argIdx)
        args = append(args, "%"+filter.Search+"%")
        argIdx++
    }

    // Count + paginated fetch
    // ...
}

func (r *ProductRepository) FindByID(
    ctx context.Context, id string, orgID string,
) (*domain.Product, error) {
    query := `
        SELECT * FROM products
        WHERE id = $1
          AND organization_id = $2    -- ALWAYS present
          AND is_deleted = false
    `
    // ...
}
```

### Rules

- ✅ Every `SELECT`, `UPDATE`, `DELETE` query must include `WHERE organization_id = ?`
- ✅ `organizationId` is passed as a parameter, never hardcoded
- ❌ Never write a query that returns data across organizations
- ❌ Never trust client-provided `organizationId` in query params or body

---

## 2. Where Tenant Context Comes From

```
✅ CORRECT: Tenant from authenticated session
┌──────────┐    JWT    ┌──────────────┐    Context    ┌─────────────┐
│  Client   │─────────▶│  Auth Guard  │──────────────▶│  Controller │
│           │          │              │               │  extracts   │
│           │          │  Validates   │               │  orgId from │
│           │          │  JWT token   │               │  user.orgId │
└──────────┘          └──────────────┘               └─────────────┘

❌ WRONG: Tenant from query string
GET /products?organizationId=abc123    ← Client can spoof this!
```

### TypeScript

```typescript
// presentation/product.controller.ts
@Get()
async findAll(@CurrentUser() user: AuthUser, @Query() query: QueryProductDto) {
  // ✅ orgId from JWT-authenticated user
  return this.productService.findAll({
    organizationId: user.organizationId,
    ...query,
  });
}

// ❌ NEVER DO THIS
@Get()
async findAll(@Query('organizationId') orgId: string) {
  // Client can pass any orgId — data leak!
}
```

### Go

```go
// handler/product_handler.go
func (h *ProductHandler) FindAll(w http.ResponseWriter, r *http.Request) {
    // ✅ orgId from context (set by auth middleware)
    user := middleware.UserFromContext(r.Context())
    orgID := user.OrganizationID

    // ❌ NEVER: orgID := r.URL.Query().Get("organizationId")
}
```

---

## 3. Implicit Propagation

For deep call stacks, propagate tenant context implicitly rather than threading it through every function.

### TypeScript (AsyncLocalStorage)

```typescript
// shared/infrastructure/tenant-context.ts
import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContext {
  organizationId: string;
  userId: string;
  roles: string[];
  isSuperAdmin: boolean;
}

const tenantStorage = new AsyncLocalStorage<TenantContext>();

export const TenantContext = {
  run<T>(context: TenantContext, fn: () => T): T {
    return tenantStorage.run(context, fn);
  },

  current(): TenantContext {
    const ctx = tenantStorage.getStore();
    if (!ctx) throw new Error('TenantContext not initialized — missing middleware?');
    return ctx;
  },

  currentOrgId(): string {
    return TenantContext.current().organizationId;
  },
};
```

```typescript
// middleware/tenant.middleware.ts
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const user = req.user as AuthUser;
    TenantContext.run(
      {
        organizationId: user.organizationId,
        userId: user.id,
        roles: user.roles,
        isSuperAdmin: user.roles.includes('super_admin'),
      },
      () => next(),
    );
  }
}
```

### Go (context.Context)

```go
// pkg/middleware/tenant.go
type tenantKey struct{}

type TenantCtx struct {
    OrganizationID string
    UserID         string
    Roles          []string
    IsSuperAdmin   bool
}

func WithTenant(ctx context.Context, t TenantCtx) context.Context {
    return context.WithValue(ctx, tenantKey{}, t)
}

func TenantFrom(ctx context.Context) TenantCtx {
    t, ok := ctx.Value(tenantKey{}).(TenantCtx)
    if !ok {
        panic("tenant context not set — missing middleware?")
    }
    return t
}

func TenantMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        user := UserFromJWT(r)
        ctx := WithTenant(r.Context(), TenantCtx{
            OrganizationID: user.OrgID,
            UserID:         user.ID,
            Roles:          user.Roles,
            IsSuperAdmin:   slices.Contains(user.Roles, "super_admin"),
        })
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

---

## 4. Bypass Scenarios

Some operations legitimately need cross-tenant access:

| Scenario | Who | Example |
|:---|:---|:---|
| Super-admin dashboard | Platform operators | View all organizations' stats |
| System background jobs | Cron / queue workers | Nightly billing calculation |
| Data migrations | DevOps scripts | Schema updates across all tenants |
| Cross-org reporting | Platform analytics | Aggregated platform metrics |

### How to Safely Bypass

```typescript
// shared/infrastructure/tenant-bypass.ts
export interface TenantBypassOptions {
  reason: string;        // Required: Why is bypass needed?
  initiator: string;     // Required: Who is bypassing? (userId or 'system')
  auditLog: boolean;     // Must be true for production
}

export function runWithoutTenantFilter<T>(
  options: TenantBypassOptions,
  fn: () => Promise<T>,
): Promise<T> {
  // Log the bypass for audit
  if (options.auditLog) {
    logger.warn('[TENANT_BYPASS]', {
      reason: options.reason,
      initiator: options.initiator,
      timestamp: new Date().toISOString(),
    });
  }

  // Run with a special context that repositories can check
  return TenantContext.run(
    {
      organizationId: '__SYSTEM_BYPASS__',
      userId: options.initiator,
      roles: ['system'],
      isSuperAdmin: true,
    },
    fn,
  );
}
```

```typescript
// infrastructure/product.repository.ts (updated)
async findAll(params: ProductQueryParams): Promise<PaginatedResult<Product>> {
  const conditions = [eq(products.isDeleted, false)];

  // Only apply tenant filter when NOT in bypass mode
  if (params.organizationId !== '__SYSTEM_BYPASS__') {
    conditions.push(eq(products.organizationId, params.organizationId));
  }

  // ... rest of query
}
```

### Bypass Rules

- ✅ Every bypass must include a `reason` string (auditable)
- ✅ Every bypass must be logged with timestamp and initiator
- ✅ Bypass is **opt-in** — default behavior always filters by tenant
- ❌ Never expose a bypass API endpoint to regular users
- ❌ Never disable tenant filtering globally (e.g., via env var)
- ❌ Never use `__SYSTEM_BYPASS__` as a real organization ID

---

## 5. Composite Index Strategy

Tenant-scoped queries need efficient indexes to avoid full table scans.

### Common Patterns

```sql
-- Pattern 1: Tenant + soft-delete (used in every list query)
CREATE INDEX idx_products_org_deleted
  ON products (organization_id, is_deleted);

-- Pattern 2: Tenant + status filter
CREATE INDEX idx_products_org_active
  ON products (organization_id, is_active, is_deleted);

-- Pattern 3: Tenant + date range (for reports)
CREATE INDEX idx_products_org_created
  ON products (organization_id, created_at DESC)
  WHERE is_deleted = false;  -- Partial index

-- Pattern 4: Tenant + unique constraint
CREATE UNIQUE INDEX idx_products_org_name_unique
  ON products (organization_id, name)
  WHERE is_deleted = false;  -- Tenant-scoped uniqueness

-- Pattern 5: Tenant + search (text search)
CREATE INDEX idx_products_org_name_search
  ON products (organization_id, name varchar_pattern_ops)
  WHERE is_deleted = false;
```

### Drizzle Index Definitions

```typescript
import { index, uniqueIndex } from 'drizzle-orm/pg-core';

export const productOrgDeletedIdx = index('idx_products_org_deleted')
  .on(products.organizationId, products.isDeleted);

export const productOrgActiveIdx = index('idx_products_org_active')
  .on(products.organizationId, products.isActive, products.isDeleted);

// For tenant-scoped uniqueness
export const productOrgNameUniqueIdx = uniqueIndex('idx_products_org_name_unique')
  .on(products.organizationId, products.name)
  .where(sql`is_deleted = false`);
```

### Index Rules

- ✅ Lead with `organization_id` in composite indexes (highest cardinality filter first)
- ✅ Use partial indexes with `WHERE is_deleted = false` to reduce index size
- ✅ Add indexes based on actual query patterns, not speculation
- ❌ Never create a single-column index on `organization_id` alone (composite is better)
- ❌ Never forget to include `is_deleted` in uniqueness constraints

---

## 6. Checklist

- [ ] All queries filter by `organizationId` extracted from auth context
- [ ] No endpoint accepts `organizationId` from query params or request body
- [ ] Tenant context is propagated via AsyncLocalStorage (TS) or context.Context (Go)
- [ ] Bypass mechanism exists with audit logging for system/admin operations
- [ ] Composite indexes lead with `organization_id`
- [ ] Unique constraints are tenant-scoped (`organization_id` + field)
- [ ] Partial indexes use `WHERE is_deleted = false` where applicable
- [ ] Integration tests verify tenant isolation (user A cannot see user B's data)
- [ ] Super-admin bypass is tested separately with audit log verification
