# Unified Skill Themes (v6.0)

## Orchestration Layer
- **ka-workflow**: lifecycle orchestrator **and** execution router (merged `ka-execute`). Tracks per-feature state via `.agents/scripts/state-manager.js` (`full` or `lite` profile), validates action payloads (`references/option-schemas.md`), enforces risk tiers 1–4 (tier 3–4 never bypassed), and routes to workers.
- **ka-plan**: design & architecture facilitator (merged `ka-think` as Mode E — Explore). Runs proportional Socratic discovery (E / Q / D / A) and locks `.agents/memory/decisions.json` with `feature`, `test_plan`, and `execution_hint`.
- **ka-execute** / **ka-think**: thin backward-compatibility aliases forwarding explicit `/ka-execute` and `/ka-think` commands to `ka-workflow` §4 and `ka-plan` Mode E.

## Worker & Diagnostic Layer
- **ka-be**: polyglot backend implementer (Lite/PATCH follows existing repo layout with 0 extra `.md` files; Full enforces 4-tier Clean Architecture + single consolidated walkthrough).
- **ka-fe**: React/TanStack UI implementer with 3-state UX, WCAG 2.2 AA a11y, and RTL+MSW tests (no internal pre-coding hard-stops).
- **ka-db-schema**: polyglot database schema & expand–contract migration architect (Drizzle, SQLAlchemy, Prisma, raw SQL; Tier 3).
- **ka-contract**: contract-first API designer (OpenAPI, Zod/Pydantic, Orval) + breaking-change & drift verification.
- **ka-test**: TDD coach & QA architect; enforces script-verified RED → GREEN runs at `TEST_EVIDENCE_GATE`.
- **ka-debug**: 5-phase systematic debugger (reproduce → minimize → hypothesis → fix + regression test + SEV1/2 postmortem).
- **ka-ops**: DevOps/SRE (Docker, K8s least-privilege, release/rollback, observability; Tier 4 + `DEPLOYMENT_GATE`).

## Guardrail & Context Layer
- **ka-intake**: requirement completeness checker paired with the always-on `AGENTS.md` rule; includes a non-bypassable safety floor for destructive/money/auth fast-track requests.
- **ka-review**: context-proportional code, architecture, tenant-isolation, security, and performance auditor.
- **ka-handoff**: cross-session context packager (`docs/handoff/`).
- **git-guardian**: mandatory git safety SOP (branch protection, command risk tiers, recovery protocol).

Every skill is self-contained inside `skills/<name>/` (verified by `scripts/lint-skills.py`) with description ≤ 500 chars, line count ≤ 300, and static + heuristic/LLM evals (`scripts/run-evals.mjs`).
