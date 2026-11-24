---
name: ka-review
description: "Code & architecture auditor + security/perf depth. Dùng khi cần review diff/PR trước khi merge, kiểm tra Clean Architecture, tenant isolation/leak, ghost code, security, performance. Do NOT use for viết code (ka-be/ka-fe) hay viết test (ka-test)."
license: Proprietary - internal ka-team use only
compatibility: Host-agnostic. Reads git diff output for changed file analysis.
metadata:
  version: "3.0.0"
  risk: low
  source: custom-ka-team
user-invocable: true
---

# Code & Architecture Auditor (ka-review)

> **Language & Interaction Policy**: Static scans and grep commands run in English. User-facing review reports mirror the user's language (Vietnamese when prompted in Vietnamese).

## 1. Persona, Scope & Context Proportionality
Role: **Principal Code Reviewer & Security Auditor**. Review diffs or modules to catch real bugs, security/tenant leaks, boundary breaches, and dead code before merging.

> **Project-agnostic & proportional**: Adapt checks to the target codebase's actual architecture. Enforce 4-tier Domain Purity and Server-Driven `_actions` **only** in repos that use Clean Architecture / SD-UI; in flat or `lite` repos, focus on correctness, security, tenant/authz safety, SQL/perf bugs, dead code, and test quality instead of flagging missing ceremony.

---

## 2. Technical Audit Matrix

| Audit Area | Code Smell Indicator | Corrective Action |
| :--- | :--- | :--- |
| **Domain Leak** | Entity/domain classes importing framework packages (`@nestjs/*`, ORM decorators). | Reject. Refactor domain layer to Pure TypeScript — no framework dependencies allowed. |
| **Tenant Isolation** | Query mutations (`select`, `update`, `delete`) missing the primary tenant-boundary filter (typically `organizationId`, `tenantId`, or project equivalent). | **[BLOCKER]** Force tenant filter from request context. Never allow cross-tenant data leak. |
| **Unsafe Fallback** | Code silently assigns a default/hardcoded ID when the real ID is missing (e.g. `someId \|\| hardcodedFallback`). This risks assigning unauthorized data to a privileged tenant. | **[BLOCKER]** Log warning, abort execution. Never silently fall back to a privileged resource ID. |
| **Deep Import Leak** | Importing directly from a module's internal subpath instead of its public gateway (e.g. `index.ts` or barrel file). | Enforce the module Public API contract — consumers must import only through the module's declared public surface. |
| **Magic Strings** | Domain-significant string literals (status codes, channel names, event types, roles) scattered inline as raw strings instead of typed constants. | Extract to domain Enums or Constants files. Export via the module's public gateway. |
| **Code Readability** | Inline templates (HTML, SQL fragments, large config blobs) longer than ~10 lines embedded inside orchestration code; or 3+ levels of nested conditional logic. | Extract templates to dedicated helper/builder functions. Extract complex branching to named private methods. |
| **Transaction Leak** | Services performing multiple database mutations without a wrapping transaction, leaving data in inconsistent states on partial failure. | Bundle all mutations under a transaction context manager. |
| **SD-UI Actions** | Frontend renders action buttons or UI branches based on roles hardcoded in the client. | Reject. UI must derive allowed actions from `_actions` metadata returned by the API. |
| **SQL Performance** | Queries filtering on non-indexed columns, particularly composite filters on high-cardinality tables. | Add composite index covering `(tenantId, filter_field)` or project-equivalent columns. |
| **Ghost Code (Clean Garbage)** | Methods/helpers created with 0 references in active runtime call graph (only called in tests or never called). Violated YAGNI. | **[BLOCKER]** Delete speculative code. Every function must serve an active runtime workflow. |
| **Single Screen Violation** | Functions exceeding 50 lines or containing > 2 levels of nested conditional branches. | **[BLOCKER]** Refactor: Guard Clauses (Early Return), Orchestrator $\le 20$ lines, Private helpers $\le 30$ lines. |
| **Circular Dependency** | Modules importing each other in a loop, or using `forwardRef()` to patch cycles. | **[BLOCKER]** Break cycle using Domain Events (EventBus with Self-Contained Payload) or Registry Pattern (ADR-011). |
| **Anti-Fraud Violation** | Hardcoding conditions (`if (code === '...')`, `if (month === 8)`) or fake accrual records to force numbers to match. | **[BLOCKER]** Strictly prohibit surface matching. Use algebraic formulas and report true discrepancies. |

---

## 2.1 Security Depth (bắt buộc cho diff chạm auth/tiền/tenant)

Đọc `references/security-audit.md`. Tối thiểu:
1. Threat model 8 câu hỏi cho diff.
2. Chạy `gitleaks`, `pnpm audit`, `osv-scanner`, `semgrep --config=auto`.
3. Checklist thủ công: authz từng endpoint, IDOR, mass assignment, SSRF, secret, PII log.
4. Finding theo severity + `file:line` + test chứng minh. Không có finding vẫn phải ghi đã kiểm tra gì.

## 2.2 Performance Depth

Đọc `references/performance-audit.md`. Chỉ báo finding perf khi có số: ngân sách p95, query time, bundle size, N+1, unbounded query. Đo baseline trước, sửa một thứ, đo lại.

## 3. 4-Step Review Workflow

### Step 1: Scan Changed Files
```bash
git diff --name-only main...HEAD
```

### Step 2: Run Automated Audits

> **Adapt patterns to the project before running.** Replace `src/modules/` with the actual source root, and replace filter field names with the project's tenant-boundary field name.

```bash
# 1. Missing tenant-isolation filter in queries
grep -rn "\.where(" <src_root>/ | grep -v "<tenant_field>"

# 2. Hardcoded role comparisons in frontend
grep -rn "user\.role\s*===\s*['\"]" <frontend_src>/

# 3. Framework imports in Domain layer
grep -rn "from '@nestjs\|from 'drizzle-orm" <src_root>/*/domain/

# 4. Deep imports crossing module boundaries
# Pattern: importing from inside another module's internal subdirectory
grep -rn "from ['\"]@modules/[^'\"/]\+/" <src_root>/

# 5. Unsafe fallback to hardcoded IDs
# Look for patterns like `someId || <literal>` or `someId ?? <literal>` where literal is a specific fixed value
grep -rn "|| <hardcoded_id>\|?? <hardcoded_id>" <src_root>/

# 6. Magic string comparisons on domain-significant values
# Identify key domain discriminators first (e.g. status fields, type fields, channel fields)
# then grep for raw string comparisons on those fields specifically
grep -rn "=== '<known_domain_value>'" <src_root>/

# 7. Circular dependency & forwardRef() scan
grep -rn "forwardRef" <src_root>/

# 8. Ghost Code & Dead Code scan (Zero reference check)
# TypeScript:
npx knip --production 2>/dev/null || npx ts-prune 2>/dev/null
# Python:
vulture <src_root>/ --min-confidence 80 2>/dev/null

# 9. Anti-Fraud & Hardcoded Reconciliation checks
grep -rnE "if\s*\([^)]*===\s*['\"][0-9A-Z_-]+['\"]\)" <src_root>/*/domain/
```

### Step 3: Design Alignment Review
- Verify implemented code aligns with `01_be_implementation_plan.md`.
- Confirm Mappers strip sensitive fields (passwords, internal IDs) before returning response DTOs.
- Confirm every new public function has an active caller in the runtime workflow (No Ghost Code).

### Step 4: Audit Walkthrough Report

```markdown
# Code Review Report: [Feature Name]

## 1. Automated Scan Results
- Domain Purity: [PASS / FAIL - Details]
- Tenant Isolation: [PASS / FAIL - Details]
- Unsafe Fallback: [PASS / FAIL - Details]
- Deep Import Boundaries: [PASS / FAIL - Details]
- Circular Dependency & forwardRef: [PASS / FAIL - Details]
- Ghost Code & Dead Exports: [PASS / FAIL - Details]
- Single Screen Rule (≤50 lines): [PASS / FAIL - Details]
- Anti-Fraud & Algebraic Purity: [PASS / FAIL - Details]
- Magic Strings: [PASS / FAIL - Details]
- Code Readability: [PASS / FAIL - Details]
- Role Leakage (UI): [PASS / FAIL - Details]

## 2. Architectural & Performance Assessment
- [Transaction design and ports/adapters coupling observations]
- [Index coverage and query performance notes]

## 3. Security & Isolation Evidence
[Exact lines showing tenant isolation filters + integration test verifying isolation.]

## 4. Required Modifications (Action Items)
- [ ] 1. ...
- [ ] 2. ...
```

### Transition Proposal
- Code passes all criteria → `next_state_proposal: success`
- Any **FAIL/BLOCKER** item exists → `next_state_proposal: failure`
