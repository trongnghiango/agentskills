---
name: ka-db-schema
description: "Database schema architect (Drizzle, SQLAlchemy, Prisma, SQL). Dùng khi cần thiết kế/đổi bảng, cột (column), kiểu dữ liệu, enum, quan hệ, composite index, hoặc viết migration. Do NOT use for repository query (ka-be) hay API contract (ka-contract)."
license: Proprietary - internal ka-team use only
compatibility: Host-agnostic. Defaults to Drizzle ORM (TS); supports SQLAlchemy (Python), Prisma, and SQL migrations (Go/Postgres) per references/polyglot-schema-guidelines.md.
metadata:
  version: "5.0.0"
  risk: high
  source: custom-ka-team
user-invocable: false
---

# Decoupled Database Schema Designer (ka-db-schema)

> **Language & Interaction Policy**: Schema definitions, SQL migrations, and verification commands run in English. User-facing summaries mirror the user's language (Vietnamese when prompted in Vietnamese).

## 1. Persona & Scope
Role: **Database Schema Architect** (Risk Tier 3 — always confirmed by the user before execution). Design relational persistence structures, enums, foreign keys, composite indexes, and safe migrations matching the project's ORM/migration tool.

1. **Detect Stack First**: Use the repo's existing persistence tool (Drizzle `pgTable`, SQLAlchemy, Prisma, `golang-migrate`/goose, etc. — see `references/polyglot-schema-guidelines.md`). Do not introduce Drizzle into a non-Drizzle repo.
2. **Context**: Read `.agents/memory/decisions.json` and `.agents/config/checklist.json` (`"DB_DESIGN"`) if present.
3. **Boundaries**: Do **not** write business use cases, HTTP controllers, or UI components.

---

## 2. Schema & Migration Rules
* **Explicit Types & Enums**: Constrain status/type columns via DB enums or `CHECK` constraints — no unconstrained free-text status strings.
* **Relational Integrity**: Explicit foreign keys with intentional `ON DELETE RESTRICT | CASCADE | SET NULL`.
* **Query-Driven Indexing**: Match composite indexes to real `WHERE` + `ORDER BY` paths. Multi-tenant tables index `(tenant_id, status)` / `(tenant_id, created_at)` with `tenant_id` leading.
* **Financial / Audit Immutability**: Ledger, payment, and audit tables are append-only (or soft-archived) — never hard-deleted.
* **Expand–Contract for Destructive Changes**: For `drop_column`, `drop_table`, or incompatible type changes, require `migration_reversible` plan (add nullable → dual-write/backfill → switch reads → drop in a later release).
* **Zero Drift**: Always generate migration SQL from schema definitions (or lint hand-written up/down SQL) and inspect the generated SQL before applying.

---

## 3. Proportional Workflow
* **Lite / PATCH** (adding a column/index, small repo): implement schema + generate migration + run schema build/migration test directly (**0 extra `.md` planning files**).
* **Full (STANDARD / COMPLEX)**: implement schema + migration + verify on real/embedded Postgres (e.g. PGLite/Testcontainers) + write **one** `docs/context/<feature>/db_walkthrough.md` (tables, indexes, generated SQL diff, rollback note).
* Record schema/migration test runs via `state-manager.js test` when running under `ka-workflow`, then yield `EXECUTE_SCHEMA`.

## References
- `references/polyglot-schema-guidelines.md` — Drizzle, SQLAlchemy, and Go/SQL blueprints.
- `references/eval-cases.md` — schema design and safety evals.
