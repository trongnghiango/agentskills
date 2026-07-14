# Example: Approval Workflow Module

> **Complexity**: High · **Patterns**: State Machine, Domain Events, Cross-Module, Server-Driven UI (`_actions`)

A complete walkthrough of building a multi-step approval workflow. Requests flow through a state machine (DRAFT → PENDING → APPROVED / REJECTED), each step requires a designated approver. The API returns server-driven `_actions` telling the frontend which buttons to render.

---

## Step 1 — Business & Architecture Analysis

### Module Classification

**Tier 3 — Process Flow.** This module orchestrates a multi-step approval process involving cross-module collaboration (fetching approver data from the User module) and state machine transitions with domain event side-effects.

### Bounded Context & Ubiquitous Language

| Business Concept | Code Name | Type |
|:---|:---|:---|
| Approval request | `ApprovalRequest` | Aggregate Root |
| Individual approval step | `ApprovalStep` | Value Object |
| Request status | `ApprovalStatus` | Value Object (enum) |
| Step decision | `StepDecision` | Value Object (enum) |
| Available actions for UI | `_actions` | Computed DTO field |

### State Machine

```
  ┌───────────┐    submit()    ┌───────────┐
  │   DRAFT   │───────────────►│  PENDING   │
  └───────────┘                └─────┬─────┘
                                     │
                        ┌────────────┼────────────┐
                        │ approve()  │             │ reject()
                        ▼            │             ▼
                 ┌──────────┐        │      ┌──────────┐
                 │ APPROVED │        │      │ REJECTED │
                 └──────────┘        │      └──────────┘
                                     │
                              (multi-level:
                               advance to
                               next step)
```

### Cross-Module Dependencies

- **IUserRepository** port — fetch approver display names and validate approver IDs exist.

### Domain Events

- **ApprovalSubmitted** — when a draft transitions to pending.
- **ApprovalApproved** — when the final step is approved.
- **ApprovalRejected** — when any step rejects the request.

### Server-Driven UI (`_actions`)

The API response includes an `_actions` object computed from the current state and the requesting user's role:

```json
{
  "_actions": {
    "canSubmit": true,
    "canApprove": false,
    "canReject": false
  }
}
```

### Tenant Isolation

All queries scoped by `organizationId`. Approvers must belong to the same organization.

---

## Step 2 — Detailed Implementation Plan

### Database Schema

```
approval_requests
├── id               UUID  PK  DEFAULT gen_random_uuid()
├── title            TEXT  NOT NULL
├── description      TEXT
├── requester_id     UUID  NOT NULL
├── status           approval_status_enum  NOT NULL DEFAULT 'draft'
├── organization_id  UUID  NOT NULL
├── created_at       TIMESTAMP WITH TZ  NOT NULL DEFAULT now()
├── updated_at       TIMESTAMP WITH TZ  NOT NULL DEFAULT now()
INDEX(organization_id, status)
INDEX(requester_id)

approval_steps
├── id               UUID  PK  DEFAULT gen_random_uuid()
├── request_id       UUID  NOT NULL  FK → approval_requests.id
├── step_order       INTEGER  NOT NULL
├── approver_id      UUID  NOT NULL
├── decision         step_decision_enum  NOT NULL DEFAULT 'pending'
├── reason           TEXT
├── decided_at       TIMESTAMP WITH TZ
UNIQUE(request_id, step_order)
```

### Domain Layer

- **Entity**: `ApprovalRequest` — state machine with `submit()`, `approve(approverId)`, `reject(approverId, reason)`.
- **Value Object**: `ApprovalStep` — immutable record (stepOrder, approverId, decision, reason, decidedAt).
- **Guard Clauses**: Cannot submit without steps. Cannot approve/reject if not the current step's approver. Cannot transition from terminal states.
- **_actions**: `computeActions(currentUserId)` returns available operations.

### Infrastructure Layer

- **Repository**: `DrizzleApprovalRequestRepository` — loads request + steps in a single query, persists atomically.

### Application Layer

- **Service**: `ApprovalService` — orchestrates state transitions, cross-module port calls, event publishing.

### Presentation Layer

- **Controller**: Routes with RBAC. Response DTO includes `_actions`.

---

## Step 3 — Execution Checklist

- [x] Define `ApprovalStatus` and `StepDecision` enums (shared contracts)
- [x] Create `approval_requests` Drizzle schema
- [x] Create `approval_steps` Drizzle schema with FK relation
- [x] Write migration files
- [x] Create `ApprovalStep` value object
- [x] Create `ApprovalRequest` domain entity with state machine
- [x] Implement domain event classes (ApprovalSubmitted, ApprovalApproved, ApprovalRejected)
- [x] Implement `computeActions()` on the entity
- [x] Define `IApprovalRequestRepository` port
- [x] Define cross-module `IUserRepository` port usage
- [x] Implement `DrizzleApprovalRequestRepository`
- [x] Implement `ApprovalRequestMapper` (toDomain / toPersistence)
- [x] Create request/response DTOs with Zod schemas
- [x] Implement `ApprovalService` with transaction + event publish
- [x] Implement `ApprovalController` with `_actions` in response
- [x] Write unit tests for `ApprovalRequest` state machine
- [x] Write unit tests for `ApprovalService` (mocked repos)
- [x] Write integration tests for approval flow (submit → approve → complete)
- [x] Run domain purity verification
- [x] Run full compilation and test suite

---

## Step 4 — Code & Verification

### 4.1 Schema (Drizzle)

```typescript
// src/modules/approval/infrastructure/schema/approval.schema.ts
import { pgTable, uuid, text, integer, timestamp, uniqueIndex, index, pgEnum } from 'drizzle-orm/pg-core';

export const approvalStatusEnum = pgEnum('approval_status', ['draft', 'pending', 'approved', 'rejected']);
export const stepDecisionEnum = pgEnum('step_decision', ['pending', 'approved', 'rejected']);

export const approvalRequests = pgTable('approval_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  requesterId: uuid('requester_id').notNull(),
  status: approvalStatusEnum('status').notNull().default('draft'),
  organizationId: uuid('organization_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_approval_org_status').on(table.organizationId, table.status),
  index('idx_approval_requester').on(table.requesterId),
]);

export const approvalSteps = pgTable('approval_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  requestId: uuid('request_id').notNull().references(() => approvalRequests.id, { onDelete: 'cascade' }),
  stepOrder: integer('step_order').notNull(),
  approverId: uuid('approver_id').notNull(),
  decision: stepDecisionEnum('decision').notNull().default('pending'),
  reason: text('reason'),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('uq_approval_step_order').on(table.requestId, table.stepOrder),
]);

export type ApprovalRequestRow = typeof approvalRequests.$inferSelect;
export type ApprovalStepRow = typeof approvalSteps.$inferSelect;
```

### 4.2 Domain Events

```typescript
// src/modules/approval/domain/events/approval.events.ts

export interface DomainEvent {
  readonly eventName: string;
  readonly occurredAt: Date;
  readonly payload: Record<string, unknown>;
}

export class ApprovalSubmitted implements DomainEvent {
  readonly eventName = 'ApprovalSubmitted';
  readonly occurredAt = new Date();
  constructor(readonly payload: { requestId: string; requesterId: string; title: string }) {}
}

export class ApprovalApproved implements DomainEvent {
  readonly eventName = 'ApprovalApproved';
  readonly occurredAt = new Date();
  constructor(readonly payload: { requestId: string; finalApproverId: string }) {}
}

export class ApprovalRejected implements DomainEvent {
  readonly eventName = 'ApprovalRejected';
  readonly occurredAt = new Date();
  constructor(readonly payload: { requestId: string; rejectedBy: string; reason: string }) {}
}
```

### 4.3 Value Object — ApprovalStep

```typescript
// src/modules/approval/domain/value-objects/approval-step.vo.ts

export type StepDecision = 'pending' | 'approved' | 'rejected';

export class ApprovalStep {
  private constructor(
    private readonly _id: string,
    private readonly _stepOrder: number,
    private readonly _approverId: string,
    private _decision: StepDecision,
    private _reason: string | null,
    private _decidedAt: Date | null,
  ) {}

  static create(params: {
    id: string;
    stepOrder: number;
    approverId: string;
    decision: StepDecision;
    reason: string | null;
    decidedAt: Date | null;
  }): ApprovalStep {
    return new ApprovalStep(
      params.id, params.stepOrder, params.approverId,
      params.decision, params.reason, params.decidedAt,
    );
  }

  static createNew(params: { id: string; stepOrder: number; approverId: string }): ApprovalStep {
    return new ApprovalStep(params.id, params.stepOrder, params.approverId, 'pending', null, null);
  }

  approve(): ApprovalStep {
    return new ApprovalStep(this._id, this._stepOrder, this._approverId, 'approved', null, new Date());
  }

  reject(reason: string): ApprovalStep {
    return new ApprovalStep(this._id, this._stepOrder, this._approverId, 'rejected', reason, new Date());
  }

  get id(): string { return this._id; }
  get stepOrder(): number { return this._stepOrder; }
  get approverId(): string { return this._approverId; }
  get decision(): StepDecision { return this._decision; }
  get reason(): string | null { return this._reason; }
  get decidedAt(): Date | null { return this._decidedAt; }
  get isPending(): boolean { return this._decision === 'pending'; }
}
```

### 4.4 Entity — ApprovalRequest (State Machine)

```typescript
// src/modules/approval/domain/entities/approval-request.entity.ts
import { ApprovalStep } from '../value-objects/approval-step.vo';
import { ApprovalSubmitted, ApprovalApproved, ApprovalRejected, DomainEvent } from '../events/approval.events';

export type ApprovalStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export class ApprovalRequest {
  private _domainEvents: DomainEvent[] = [];

  private constructor(
    private readonly _id: string,
    private readonly _title: string,
    private readonly _description: string | null,
    private readonly _requesterId: string,
    private _status: ApprovalStatus,
    private _steps: ApprovalStep[],
    private readonly _organizationId: string,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static create(params: {
    id: string;
    title: string;
    description: string | null;
    requesterId: string;
    status: ApprovalStatus;
    steps: ApprovalStep[];
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
  }): ApprovalRequest {
    return new ApprovalRequest(
      params.id, params.title, params.description, params.requesterId,
      params.status, params.steps, params.organizationId,
      params.createdAt, params.updatedAt,
    );
  }

  // --- State Machine Transitions ---

  submit(): void {
    if (this._status !== 'draft') {
      throw new InvalidStateTransitionException(this._status, 'pending');
    }
    if (this._steps.length === 0) {
      throw new ApprovalHasNoStepsException(this._id);
    }
    this._status = 'pending';
    this.touch();
    this._domainEvents.push(new ApprovalSubmitted({
      requestId: this._id, requesterId: this._requesterId, title: this._title,
    }));
  }

  approve(approverId: string): void {
    if (this._status !== 'pending') {
      throw new InvalidStateTransitionException(this._status, 'approved');
    }

    const currentStep = this.currentPendingStep;
    if (!currentStep) {
      throw new NoMorePendingStepsException(this._id);
    }
    if (currentStep.approverId !== approverId) {
      throw new NotDesignatedApproverException(approverId, currentStep.stepOrder);
    }

    // Replace step with approved version (immutable VO pattern)
    this._steps = this._steps.map(s =>
      s.id === currentStep.id ? s.approve() : s,
    );

    // Check if all steps are now approved
    const allApproved = this._steps.every(s => s.decision === 'approved');
    if (allApproved) {
      this._status = 'approved';
      this._domainEvents.push(new ApprovalApproved({
        requestId: this._id, finalApproverId: approverId,
      }));
    }

    this.touch();
  }

  reject(approverId: string, reason: string): void {
    if (this._status !== 'pending') {
      throw new InvalidStateTransitionException(this._status, 'rejected');
    }

    const currentStep = this.currentPendingStep;
    if (!currentStep) {
      throw new NoMorePendingStepsException(this._id);
    }
    if (currentStep.approverId !== approverId) {
      throw new NotDesignatedApproverException(approverId, currentStep.stepOrder);
    }

    this._steps = this._steps.map(s =>
      s.id === currentStep.id ? s.reject(reason) : s,
    );
    this._status = 'rejected';
    this.touch();

    this._domainEvents.push(new ApprovalRejected({
      requestId: this._id, rejectedBy: approverId, reason,
    }));
  }

  // --- Server-Driven UI ---

  computeActions(currentUserId: string): ApprovalActions {
    const currentStep = this.currentPendingStep;
    return {
      canSubmit: this._status === 'draft' && this._requesterId === currentUserId && this._steps.length > 0,
      canApprove: this._status === 'pending' && currentStep?.approverId === currentUserId,
      canReject: this._status === 'pending' && currentStep?.approverId === currentUserId,
    };
  }

  // --- Getters ---

  get id(): string { return this._id; }
  get title(): string { return this._title; }
  get description(): string | null { return this._description; }
  get requesterId(): string { return this._requesterId; }
  get status(): ApprovalStatus { return this._status; }
  get steps(): ReadonlyArray<ApprovalStep> { return this._steps; }
  get organizationId(): string { return this._organizationId; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  get currentPendingStep(): ApprovalStep | undefined {
    const sortedSteps = [...this._steps].sort((a, b) => a.stepOrder - b.stepOrder);
    return sortedSteps.find(s => s.isPending);
  }

  pullDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }

  private touch(): void {
    this._updatedAt = new Date();
  }
}

// --- Types ---
export interface ApprovalActions {
  canSubmit: boolean;
  canApprove: boolean;
  canReject: boolean;
}

// --- Domain Exceptions ---

export class InvalidStateTransitionException extends Error {
  constructor(from: string, to: string) {
    super(`Cannot transition from "${from}" to "${to}"`);
    this.name = 'InvalidStateTransitionException';
  }
}

export class ApprovalHasNoStepsException extends Error {
  constructor(requestId: string) {
    super(`Approval request ${requestId} has no approval steps defined`);
    this.name = 'ApprovalHasNoStepsException';
  }
}

export class NoMorePendingStepsException extends Error {
  constructor(requestId: string) {
    super(`Approval request ${requestId} has no more pending steps`);
    this.name = 'NoMorePendingStepsException';
  }
}

export class NotDesignatedApproverException extends Error {
  constructor(userId: string, stepOrder: number) {
    super(`User ${userId} is not the designated approver for step ${stepOrder}`);
    this.name = 'NotDesignatedApproverException';
  }
}
```

### 4.5 Repository Port

```typescript
// src/modules/approval/domain/ports/approval-repository.port.ts
import { ApprovalRequest } from '../entities/approval-request.entity';

export interface IApprovalRequestRepository {
  findById(id: string, organizationId: string): Promise<ApprovalRequest | null>;
  findByRequester(requesterId: string, organizationId: string): Promise<ApprovalRequest[]>;
  findPendingForApprover(approverId: string, organizationId: string): Promise<ApprovalRequest[]>;
  save(request: ApprovalRequest): Promise<void>;
}

export const APPROVAL_REQUEST_REPOSITORY = Symbol('IApprovalRequestRepository');
```

### 4.6 Mapper (with `_actions`)

```typescript
// src/modules/approval/infrastructure/mappers/approval-request.mapper.ts
import { ApprovalRequest, ApprovalActions } from '../../domain/entities/approval-request.entity';
import { ApprovalStep } from '../../domain/value-objects/approval-step.vo';
import { ApprovalRequestRow, ApprovalStepRow } from '../schema/approval.schema';

export class ApprovalRequestMapper {
  static toDomain(row: ApprovalRequestRow, stepRows: ApprovalStepRow[]): ApprovalRequest {
    const steps = stepRows
      .sort((a, b) => a.stepOrder - b.stepOrder)
      .map(s => ApprovalStep.create({
        id: s.id,
        stepOrder: s.stepOrder,
        approverId: s.approverId,
        decision: s.decision as 'pending' | 'approved' | 'rejected',
        reason: s.reason,
        decidedAt: s.decidedAt,
      }));

    return ApprovalRequest.create({
      id: row.id,
      title: row.title,
      description: row.description,
      requesterId: row.requesterId,
      status: row.status as 'draft' | 'pending' | 'approved' | 'rejected',
      steps,
      organizationId: row.organizationId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  static toResponseDto(entity: ApprovalRequest, actions: ApprovalActions) {
    return {
      id: entity.id,
      title: entity.title,
      description: entity.description,
      requesterId: entity.requesterId,
      status: entity.status,
      steps: entity.steps.map(s => ({
        id: s.id,
        stepOrder: s.stepOrder,
        approverId: s.approverId,
        decision: s.decision,
        reason: s.reason,
        decidedAt: s.decidedAt?.toISOString() ?? null,
      })),
      organizationId: entity.organizationId,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      _actions: actions,
    };
  }
}
```

### 4.7 Service (Cross-Module Port Usage)

```typescript
// src/modules/approval/application/approval.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { ApprovalRequest } from '../domain/entities/approval-request.entity';
import {
  IApprovalRequestRepository,
  APPROVAL_REQUEST_REPOSITORY,
} from '../domain/ports/approval-repository.port';
import { IUserRepository, USER_REPOSITORY } from '../../user/domain/ports/user-repository.port';
import { EventBus } from '../../shared/events/event-bus';
import { ApprovalStep } from '../domain/value-objects/approval-step.vo';

@Injectable()
export class ApprovalService {
  constructor(
    @Inject(APPROVAL_REQUEST_REPOSITORY) private readonly approvalRepo: IApprovalRequestRepository,
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    private readonly eventBus: EventBus,
  ) {}

  async createDraft(params: {
    title: string;
    description: string | null;
    requesterId: string;
    approverIds: string[];
    organizationId: string;
  }): Promise<ApprovalRequest> {
    // Cross-module: validate all approvers exist in the same organization
    for (const approverId of params.approverIds) {
      const approver = await this.userRepo.findById(approverId, params.organizationId);
      if (!approver) {
        throw new Error(`Approver ${approverId} not found in organization`);
      }
    }

    const steps = params.approverIds.map((approverId, idx) =>
      ApprovalStep.createNew({
        id: crypto.randomUUID(),
        stepOrder: idx + 1,
        approverId,
      }),
    );

    const request = ApprovalRequest.create({
      id: crypto.randomUUID(),
      title: params.title,
      description: params.description,
      requesterId: params.requesterId,
      status: 'draft',
      steps,
      organizationId: params.organizationId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await this.approvalRepo.save(request);
    return request;
  }

  async submit(requestId: string, currentUserId: string, organizationId: string): Promise<ApprovalRequest> {
    const request = await this.findOrFail(requestId, organizationId);
    request.submit();
    await this.approvalRepo.save(request);
    this.eventBus.publishAll(request.pullDomainEvents());
    return request;
  }

  async approve(requestId: string, approverId: string, organizationId: string): Promise<ApprovalRequest> {
    const request = await this.findOrFail(requestId, organizationId);
    request.approve(approverId);
    await this.approvalRepo.save(request);
    this.eventBus.publishAll(request.pullDomainEvents());
    return request;
  }

  async reject(
    requestId: string,
    approverId: string,
    reason: string,
    organizationId: string,
  ): Promise<ApprovalRequest> {
    const request = await this.findOrFail(requestId, organizationId);
    request.reject(approverId, reason);
    await this.approvalRepo.save(request);
    this.eventBus.publishAll(request.pullDomainEvents());
    return request;
  }

  async getById(requestId: string, currentUserId: string, organizationId: string) {
    const request = await this.findOrFail(requestId, organizationId);
    const actions = request.computeActions(currentUserId);
    return { request, actions };
  }

  private async findOrFail(id: string, organizationId: string): Promise<ApprovalRequest> {
    const request = await this.approvalRepo.findById(id, organizationId);
    if (!request) {
      throw new EntityNotFoundException('ApprovalRequest', id);
    }
    return request;
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
   $ grep -r "import.*@nestjs\|import.*drizzle" src/modules/approval/domain/
   → No matches found. Domain layer is framework-free.

✅ State Machine Guards
   Verified: submit() guards against non-draft status and empty steps.
   Verified: approve() guards against wrong approver and non-pending status.
   Verified: reject() guards against wrong approver and non-pending status.

✅ Tenant Isolation
   $ grep -n "organizationId" src/modules/approval/infrastructure/repositories/
   → All repository methods accept and filter by organizationId.

✅ Domain Events
   Verified: Events are collected in entity, pulled and published AFTER save().

✅ _actions Computation
   Verified: computeActions() correctly evaluates canSubmit/canApprove/canReject
   based on status, requesterId, and current step's approverId.

✅ Tests
   $ npx jest --testPathPattern=approval --coverage
   PASS  src/modules/approval/domain/__tests__/approval-request.entity.spec.ts    (12 tests)
   PASS  src/modules/approval/application/__tests__/approval.service.spec.ts      (8 tests)
   PASS  src/modules/approval/presentation/__tests__/approval.controller.spec.ts  (6 tests)

   Statements : 96.1%
   Branches   : 91.3%
   Functions  : 100%
   Lines      : 95.8%
```
