# Code Pattern Templates

> **Lazy-Loading Rule**: Read this index FIRST. Only load a specific template file when the current task matches its pattern.

| Pattern | File | When to Use | Complexity |
|:---|:---|:---|:---|
| CRUD Module | `crud-module.md` | New module with Create/Read/Update/Delete operations | Medium |
| Event-Driven Module | `event-driven-module.md` | Module that publishes or subscribes to Domain Events | High |
| Cross-Module Port | `cross-module-port.md` | Module A needs to call/query Module B via interface | Medium |
| Multi-Tenant Query | `multi-tenant-query.md` | Complex tenant isolation: bypass, shared data, cross-org queries | Medium |
| Server-Driven UI | `server-driven-ui.md` | API response includes `_actions` based on entity state + user role | High |
| Transaction Orchestration | `transaction-orchestration.md` | Multiple aggregates modified in 1 transaction with rollback safety | High |

## How to Use

1. **Identify the pattern** — Match your current task to a row above.
2. **Load the template** — Read only the file(s) that apply to your task.
3. **Adapt, don't copy** — Templates are structural guides, not boilerplate. Adapt naming, fields, and logic to your domain.
4. **Combine when needed** — A single feature may use multiple patterns (e.g., CRUD + Event-Driven + Multi-Tenant).

## Template Structure

Every template follows this format:

```
┌─ Quick Reference (summary box)
├─ File/Folder Structure
├─ Layer-by-layer implementation guide
│   ├─ Domain Layer
│   ├─ Application Layer
│   ├─ Infrastructure Layer
│   └─ Presentation Layer
├─ Code Examples (TypeScript primary, Go secondary)
├─ Anti-Patterns (❌) vs Correct Patterns (✅)
└─ Checklist
```
