# Unified Skill Themes

## Orchestration Layer
- **ka-workflow**: master lifecycle orchestrator; tracks feature state via `.agents/scripts/state-manager.js`; delegates design to `ka-plan` and execution to `ka-execute`.
- **ka-execute**: pure execution router; validates options against `references/option-schemas.md`, applies risk‑tiered confirmation, forwards to worker skills.
- **ka-plan**: design facilitator; produces locked decision handoff (`.agents/memory/decisions.json`); never writes executable code.

Integration: `ka-workflow` → design stage → `ka-plan`; on completion `ka-workflow` → build stage → `ka-execute`; `ka-execute` reads locked decision, then routes to appropriate worker skill.

## Worker Layer
- **ka-be**: backend implementation skill.
- **ka-fe**: frontend UI implementation skill.
- **ka-db-schema**: database schema design skill.
- **ka-test**: testing skill.
- **ka-ops**: operations / deployment skill.

Integration: `ka-execute` routes actions (`backend`, `frontend`, `schema`, `test`, `ops`) to corresponding worker skill.

## Utility Layer
- **ka-intake**: requirement completeness checker; always active, loads checklist, and batches clarifying questions.
- **ka-contract**: contract-first designer for API specifications (OpenAPI) and client validations (Zod/Orval).
- **ka-review**: code and architecture compliance auditor; scans changes, checks domain leak, and tenant isolation constraints.
- **git-guardian**: git safety layer; enforces branch policies, safe checkouts/commits, and disaster recovery protocol.

All skills expose `metadata` (version, risk, source) and declare `allowed-tools` per spec at https://agentskills.io/specification.