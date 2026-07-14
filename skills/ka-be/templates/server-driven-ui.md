# Server-Driven UI Template

> **Quick Reference**
> | Aspect | Detail |
> |:---|:---|
> | Complexity | High |
> | Layers touched | Domain (state rules) → Application (action computation) → Presentation (response mapping) |
> | Key patterns | `_actions` response field, Permission Matrix, State Machine |
> | Critical rule | `_actions` computed in the DTO mapper or response builder, NOT in the controller |
> | Prerequisites | Role-based auth system, entity state machine defined |

---

## 1. What is `_actions`?

The server tells the client **what operations are available** for each entity, based on:
- The **current user's permissions** (role-based)
- The **entity's current state** (state-based)

This eliminates client-side permission logic — the client only renders buttons the server says are valid.

### Response Structure

```json
{
  "data": {
    "id": "order-123",
    "status": "PENDING",
    "totalAmount": 15000,
    "customerName": "John Doe",
    "createdAt": "2025-01-15T10:30:00Z"
  },
  "_actions": {
    "canView": true,
    "canEdit": true,
    "canDelete": false,
    "canApprove": true,
    "canReject": true,
    "canCancel": true,
    "canExport": false
  }
}
```

### For List Responses

```json
{
  "data": [
    {
      "id": "order-123",
      "status": "PENDING",
      "_actions": { "canEdit": true, "canApprove": true, "canDelete": false }
    },
    {
      "id": "order-456",
      "status": "APPROVED",
      "_actions": { "canEdit": false, "canApprove": false, "canDelete": false }
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "total": 2 }
}
```

---

## 2. Permission + Entity State Matrix

Define a matrix that maps `(role, entityState) → allowedActions`.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Order Actions Matrix                         │
├──────────────┬──────────┬──────────┬──────────┬────────────────┤
│ Action       │ DRAFT    │ PENDING  │ APPROVED │ REJECTED       │
├──────────────┼──────────┼──────────┼──────────┼────────────────┤
│ canView      │ owner,mgr│ all      │ all      │ all            │
│ canEdit      │ owner    │ owner    │ —        │ owner          │
│ canDelete    │ owner    │ —        │ —        │ owner          │
│ canSubmit    │ owner    │ —        │ —        │ owner          │
│ canApprove   │ —        │ manager  │ —        │ —              │
│ canReject    │ —        │ manager  │ —        │ —              │
│ canCancel    │ owner    │ owner,mgr│ manager  │ —              │
│ canExport    │ —        │ —        │ admin    │ —              │
└──────────────┴──────────┴──────────┴──────────┴────────────────┘
```

---

## 3. Action Definition Types

### TypeScript

```typescript
// shared/types/actions.ts
export interface EntityActions {
  [actionName: string]: boolean;
}

// Module-specific action types for type safety
export interface OrderActions extends EntityActions {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  canReject: boolean;
  canCancel: boolean;
  canExport: boolean;
}
```

---

## 4. Where to Compute `_actions`

> 🚨 **Critical Rule**: Compute `_actions` in the **response mapper / DTO builder**, NOT in the controller.

```
❌ WRONG: Controller computes actions
Controller
  ├─ fetch entity
  ├─ compute actions (business logic leak!)
  └─ return { data, _actions }

✅ CORRECT: Response mapper computes actions
Controller
  ├─ fetch entity
  └─ ResponseMapper.toResponse(entity, userContext)
        ├─ map entity fields to DTO
        ├─ compute _actions from (entity.state, user.roles)
        └─ return { data, _actions }
```

---

## 5. Action Resolver Implementation

### TypeScript

```typescript
// modules/order/presentation/order-action.resolver.ts

export interface ActionContext {
  userId: string;
  roles: string[];
  organizationId: string;
}

export class OrderActionResolver {
  static resolve(order: Order, ctx: ActionContext): OrderActions {
    const isOwner = order.createdBy === ctx.userId;
    const isManager = ctx.roles.includes('manager');
    const isAdmin = ctx.roles.includes('admin');
    const status = order.status;

    return {
      canView: true, // Everyone can view within their org

      canEdit: isOwner && ['DRAFT', 'PENDING', 'REJECTED'].includes(status),

      canDelete: isOwner && status === 'DRAFT',

      canSubmit: isOwner && ['DRAFT', 'REJECTED'].includes(status),

      canApprove: isManager && status === 'PENDING',

      canReject: isManager && status === 'PENDING',

      canCancel:
        (isOwner && ['DRAFT', 'PENDING'].includes(status)) ||
        (isManager && ['PENDING', 'APPROVED'].includes(status)),

      canExport: isAdmin && status === 'APPROVED',
    };
  }
}
```

### Role-Based Resolution (Extracted)

```typescript
// For complex permission systems, extract role checks into a separate resolver

export class RoleResolver {
  static can(action: string, roles: string[]): boolean {
    const permissions: Record<string, string[]> = {
      'order.approve': ['manager', 'admin'],
      'order.reject': ['manager', 'admin'],
      'order.export': ['admin'],
      'order.create': ['member', 'manager', 'admin'],
      'order.delete': ['member', 'manager', 'admin'], // + ownership check
    };

    const required = permissions[action] ?? [];
    return roles.some((r) => required.includes(r));
  }
}
```

### State-Based Resolution (Extracted)

```typescript
// For state machine validation, extract valid transitions

export class OrderStateMachine {
  private static transitions: Record<string, string[]> = {
    DRAFT: ['PENDING', 'CANCELLED'],
    PENDING: ['APPROVED', 'REJECTED', 'CANCELLED'],
    APPROVED: ['CANCELLED'],
    REJECTED: ['PENDING'], // Can resubmit
    CANCELLED: [],         // Terminal state
  };

  static canTransitionTo(currentStatus: string, targetStatus: string): boolean {
    return (this.transitions[currentStatus] ?? []).includes(targetStatus);
  }

  static availableTransitions(currentStatus: string): string[] {
    return this.transitions[currentStatus] ?? [];
  }
}
```

---

## 6. Response Mapper with `_actions`

### TypeScript

```typescript
// modules/order/presentation/order.response.ts
import { OrderActionResolver, ActionContext } from './order-action.resolver';

export interface OrderResponse {
  data: {
    id: string;
    status: string;
    totalAmount: number;
    customerName: string;
    createdAt: string;
  };
  _actions: OrderActions;
}

export interface PaginatedOrderResponse {
  data: Array<OrderResponse['data'] & { _actions: OrderActions }>;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export class OrderResponseMapper {
  static toResponse(order: Order, ctx: ActionContext): OrderResponse {
    return {
      data: {
        id: order.id,
        status: order.status,
        totalAmount: order.totalAmount,
        customerName: order.customerName,
        createdAt: order.createdAt.toISOString(),
      },
      _actions: OrderActionResolver.resolve(order, ctx),
    };
  }

  static toPaginatedResponse(
    result: PaginatedResult<Order>,
    ctx: ActionContext,
  ): PaginatedOrderResponse {
    return {
      data: result.data.map((order) => ({
        id: order.id,
        status: order.status,
        totalAmount: order.totalAmount,
        customerName: order.customerName,
        createdAt: order.createdAt.toISOString(),
        _actions: OrderActionResolver.resolve(order, ctx),
      })),
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }
}
```

---

## 7. Controller Usage

```typescript
// modules/order/presentation/order.controller.ts
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get(':id')
  async findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const order = await this.orderService.findById(id, user.organizationId);

    // ✅ Actions computed inside the mapper, not here
    return OrderResponseMapper.toResponse(order, {
      userId: user.id,
      roles: user.roles,
      organizationId: user.organizationId,
    });
  }

  @Get()
  async findAll(@CurrentUser() user: AuthUser, @Query() query: QueryOrderDto) {
    const result = await this.orderService.findAll({
      organizationId: user.organizationId,
      ...query,
    });
    return OrderResponseMapper.toPaginatedResponse(result, {
      userId: user.id,
      roles: user.roles,
      organizationId: user.organizationId,
    });
  }
}
```

- ✅ Controller passes `ActionContext` to the mapper
- ✅ Controller has zero knowledge of action computation logic
- ❌ Never compute actions in the controller body

---

## 8. Frontend Consumption Guidance

### How the Frontend Should Use `_actions`

```typescript
// Frontend component (React/Vue example)
function OrderDetail({ order }: { order: OrderResponse }) {
  const { data, _actions } = order;

  return (
    <div>
      <h1>Order {data.id}</h1>
      <p>Status: {data.status}</p>
      <p>Total: ${data.totalAmount / 100}</p>

      {/* Conditionally render buttons based on _actions */}
      <div className="actions">
        {_actions.canEdit && <Button onClick={handleEdit}>Edit</Button>}
        {_actions.canApprove && <Button onClick={handleApprove} variant="success">Approve</Button>}
        {_actions.canReject && <Button onClick={handleReject} variant="danger">Reject</Button>}
        {_actions.canCancel && <Button onClick={handleCancel}>Cancel</Button>}
        {_actions.canExport && <Button onClick={handleExport}>Export PDF</Button>}
        {_actions.canDelete && <Button onClick={handleDelete} variant="danger">Delete</Button>}
      </div>
    </div>
  );
}
```

### Frontend Rules

- ✅ Use `_actions` as the **single source of truth** for UI button visibility
- ✅ Disable or hide buttons when `_actions.canX === false`
- ✅ The server is authoritative — the client never computes permissions
- ❌ Never duplicate permission logic on the frontend
- ❌ Never show a button and then rely on a 403 error to block the action

---

## 9. Anti-Patterns

### ❌ Anti-Pattern 1: Frontend computes permissions

```typescript
// ❌ NEVER duplicate server logic in the client
const canApprove = user.role === 'manager' && order.status === 'PENDING';
```

### ❌ Anti-Pattern 2: Actions in the controller

```typescript
// ❌ Business logic leak
@Get(':id')
async findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
  const order = await this.orderService.findById(id, user.organizationId);
  return {
    data: order,
    _actions: {
      canApprove: user.roles.includes('manager') && order.status === 'PENDING',
    },
  };
}
```

### ❌ Anti-Pattern 3: Sending all possible actions as strings

```json
{
  "_actions": ["edit", "approve", "reject"]
}
```
Use boolean flags for clearer frontend consumption and easier TypeScript typing.

---

## 10. Checklist

- [ ] `_actions` is a flat object with boolean flags (`canX: true/false`)
- [ ] Actions are computed in the response mapper, not in the controller
- [ ] Action resolver takes `(entity, actionContext)` as input
- [ ] Role-based rules and state-based rules are separated
- [ ] Permission matrix is documented for the team
- [ ] Every list response includes per-item `_actions`
- [ ] Frontend only uses `_actions` for button visibility (no client-side permission logic)
- [ ] State transitions are validated server-side even if `_actions` says allowed
- [ ] Unit tests cover all cells in the permission matrix
