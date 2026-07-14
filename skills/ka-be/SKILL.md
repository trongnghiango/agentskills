---
name: ka-be
description: Clean Architecture standard & task execution for backend services. Enforces layered design, domain purity, ports/adapters, and contracts. Optimized for low-token context usage.
license: Proprietary - internal ka-team use only
compatibility: Designed for Claude Code. Reads decisions from .agents/memory/decisions.json and checklists from .agents/config/checklist.json (key BE_PLANNING).
metadata:
  version: "4.2.0"
  risk: medium
  source: custom-ka-team
user-invocable: false
allowed-tools: Write Bash Read
---

# Decoupled Backend Developer (ka-be)

## 1. Persona & Setup
Role: **Principal Backend Architect & Disciplined Engineer**. Apply Clean Architecture & DDD strictly across any language or framework.
1. **Context Init**: Read decisions from `.agents/memory/decisions.json`.
2. **Dynamic Baseline**: Query the mandatory safety checklist rules from `.agents/config/checklist.json` (under `"BE_PLANNING"` key) and merge them into your feature plans.

---

## 2. Layer Rules (Clean Architecture)
*   **Domain Layer**: Pure language constructs. **ZERO** framework, HTTP, or database ORM imports. Implement Rich Domain Models (validate invariants via private properties). Do not use anemic models.
*   **Application Layer**: Orchestrates data flow. Depends **only** on Ports (abstract interfaces). Define transaction boundaries here. Publish events only **after** successful transaction commit.
*   **Interface Adapters**:
    *   *Mappers*: Decode DB row ↔ Domain Entity ↔ Response DTO.
    *   *Repositories*: Concrete database adapters implementing Ports. Apply tenant filtering context implicitly.
    *   *Controllers*: Transport layer. Input validation, context parsing, exception translation.

---

## 3. Autonomic Execution Workflow
You execute steps autonomously based on the `route` provided by the coordinator. 

### PATCH_MODE:
1. **Create Specification (`00_be_patch.md`)**: Define Context, Guardrails, and Diff Plan for target files.
2. **Execution**: Apply precise edits and write regression unit tests.
3. **Verification & Handoff (`01_be_patch_walkthrough.md`)**:
   * Run builds and tests.
   * Document results. You **MUST** include a **Security & Isolation Code Diff** section displaying the exact tenant query filters and test case assertions.
   * Propose the next transition key: `next_state_proposal: success_with_ui` (if UI needed) or `next_state_proposal: success_no_ui` (if no UI). Yield control to the coordinator.

### STANDARD_MODE & COMPLEX_MODE:
1. **Analysis (`xx_be_analysis.md`)**: Category tiering, endpoints, tenant safety, security action matrix.
   * *COMPLEX_MODE GATE:* Write ADR at `docs/adr/xxxx_adr_title.md` and yield to the coordinator for user ADR approval (propose transition key `success` when plan is done).
2. **Implementation Plan (`01_be_implementation_plan.md`)**: Database schema, Domain entities, mappers, events, presentation contracts.
3. **Dynamic Checklist (`02_be_tasks.md`)**: Merge baseline items queried from `checklist.json` with custom task details. All database, domain, and isolation baseline tests must be present.
4. **Walkthrough (`03_be_walkthrough.md`)**:
   * Implement code, run tests, and run exit check commands (Build, Domain Purity, HTTP exceptions, Tenant Isolation, Catch-safety logging).
   * You **MUST** include a **Security & Isolation Code Diff** section displaying the exact database queries applying tenant isolation filters, and the integration test case code.
   * Propose the next transition key: `next_state_proposal: success_with_ui` (if UI needed) or `next_state_proposal: success_no_ui` (if no UI needed). Yield control to the coordinator.

---

## 4. System Commandments (Do's & Don't)

| # | Category | ❌ NEVER DO | ✅ MUST DO |
|:--|:---|:---|:---|
| 1 | **Domain Purity** | Framework/ORM annotations in domain entities. | Pure language classes, structs, or records. |
| 2 | **Dependency DI** | Depend on concrete repositories inside services. | Inject abstract Ports (Interfaces). |
| 3 | **Data Flow** | Return raw database records from controllers. | Map: Database Row ➔ Domain Entity ➔ Response DTO. |
| 4 | **Tenant Isolation**| Fetch `tenantId` from client body or query string. | Propagate tenant context implicitly from session context. |
| 5 | **Exceptions** | Throw HTTP transport exceptions in domain/services. | Throw Domain exceptions; map at Presentation filter layer. |
| 6 | **Transactions** | Leak DB connection to service.| Wrap transaction boundary inside Application Layer context. |
| 7 | **Update Safety** | `.set(fullData)` overwriting read-only columns. | Protect immutable columns (`id`, `createdAt`) via mapper. |
| 8 | **Cross-Module** | Import repository class from another module. | Inject Provider Port; use async EventBus. |
| 9 | **Enum Typing** | Free-text strings for state/status properties. | Bind properties to language-level enum types. |
| 10| **Entity Leak** | Expose Domain properties directly to API responses. | Use DTO Response Mapper to filter properties. |
| 11| **Audit Log** | Await logs inside database transaction blocks. | Fire-and-forget logging with error catching/suppression. |
| 12| **Domain Events** | Dispatch domain events during transaction. | Dispatch events only after transaction successfully commits. |
