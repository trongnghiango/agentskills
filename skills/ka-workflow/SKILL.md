---
name: ka-workflow
description: "Feature lifecycle orchestrator + execution router (merged ka-execute). Dùng khi theo dõi/tiếp tục feature qua design → build → test → review → deploy, hỏi 'đang ở đâu', hoặc chạy action backend/frontend/schema/contract/test/ops với risk tier. Do NOT use for câu hỏi thiết kế (ka-plan) hay sửa nhỏ không cần theo dõi vòng đời."
license: Proprietary - internal ka-team use only
compatibility: Host-agnostic (DSH, Claude Code, Codex, Antigravity). Requires Node.js for `.agents/scripts/state-manager.js` and `.agents/config/workflow.json` (full or lite profile).
metadata:
  version: "6.0.0"
  risk: high
  source: custom-ka-team
user-invocable: true
---

# Workflow Orchestrator & Execution Router (ka-workflow)

> **Language & Interaction Policy**: State commands, payloads and logs run in English. Every user-facing prompt (gate approvals, risk confirmations, status reports) mirrors the user's language (Vietnamese when prompted in Vietnamese).

## 1. Role

Tracks one feature's lifecycle and routes build/deploy work to worker skills. Since 6.0 it **includes the Execute stage** formerly owned by `ka-execute` (now a thin alias), removing one hand-off and one confirmation per action.

| Owner | Responsibility |
|---|---|
| `ka-intake` | requirement completeness (always-on rule, runs before this skill) |
| `ka-plan` | design decisions → `.agents/memory/decisions.json` |
| **`ka-workflow`** | state, gates, Execute stage (schema validation, risk tier, routing) |
| `ka-be` / `ka-fe` / `ka-db-schema` / `ka-contract` / `ka-test` / `ka-ops` | implementation |

Diagrams: `assets/architecture-overview.mermaid`, `assets/lifecycle-state-machine.mermaid`.

## 2. State store (enforced, not advisory)

```bash
node .agents/scripts/state-manager.js list                                  # all features
node .agents/scripts/state-manager.js get    --feature <slug>
node .agents/scripts/state-manager.js update --feature <slug> --proposal <KEY> [--approved-by-user "<reply>"]
node .agents/scripts/state-manager.js test   --feature <slug> --phase red|green --cmd "<test command>"
```

- **Always pass `--feature <slug>`** (kebab-case feature name). Omitting it uses the legacy single `state.json`.
- Human gates refuse to move (exit 4) without `--approved-by-user` containing the user's **verbatim** reply. Never invent it.
- `TEST_GATE` only accepts RED/GREEN runs executed by the script itself (exit 2/3 otherwise). Do not hand-write evidence.
- Print `🔔 TRANSITION: [OLD] -> [NEW]` after each successful update. Full gate rules: `references/gates.md`.
- Profile: `full` (`workflow.json`) for products touching money/auth/tenant data; `lite` (`workflow.lite.json`) for small repos — `IN_PROGRESS → TEST_GATE → COMPLETION_GATE`.

## 3. Lifecycle (full profile)

1. **Design** (`DESIGN_NEEDED`) → invoke `ka-plan`. It locks a decision and proposes `PLAN_PATCH | PLAN_STANDARD | PLAN_COMPLEX | PLAN_FAST_TRACK`. COMPLEX goes through `ADR_GATE`.
2. **Execute** (`LOCKED_DECISION`) → run §4, then propose `EXECUTE_<ACTION>`.
3. **Test** (`TEST_GATE`) → RED/GREEN via `state-manager.js test`, then `PASS`.
4. **Review** (`REVIEW_GATE`) → present walkthrough; in `full` profile first run a `ka-review` pass on the diff.
5. **More work / deploy / finish** (`BUILD_DONE`) → `NEXT_STEP`, `PROPOSE_DEPLOY`, or `SKIP_DEPLOY`.
6. **Completion** (`COMPLETION_GATE`) → user confirms → `READY_TO_ARCHIVE`.

## 4. Execute stage (formerly ka-execute)

### Step 0 — Locked handoff
Find the newest entry in `.agents/memory/decisions.json` with `status: "locked"`, no `consumed_at`, and matching `feature` (if set).
- Found and locked **in this session** after the user picked the D3 trade-off → adopt it without re-asking.
- Found from an earlier session → show summary + action + options + tier in one line and ask "Dùng luôn? (yes/no)". 🛑
- Not found → Step 1.

### Step 1 — Action & options (only without a handoff)
Ask once for action (`backend | frontend | schema | contract | test | ops`) **and** options JSON in the same message. Invalid action or unparseable JSON → re-ask; cancel after 3 failed attempts.

### Step 2 — Validate
Validate options against `references/option-schemas.md`. Applies to handoff options too. On failure list missing/invalid fields and re-ask. 🛑

### Step 3 — Risk tier (never skippable for tier ≥ 3)

| Tier | Default for | Confirmation |
|---|---|---|
| 1 | frontend, test | none beyond the plan — proceed |
| 2 | backend, contract | none if adopted from an in-session locked decision; otherwise `yes/no` |
| 3 | schema; backend touching auth/payments/tenant isolation | user types the action name back 🛑 |
| 4 | ops | user types the action name **and** confirms env + rollback plan 🛑 |

**Fast-track / autonomous goals may auto-confirm tier 1–2 only.** Tier 3–4 always stop, whatever the mode. Custom actions must declare a tier — never default to 1.

### Step 4 — Route
Load the worker skill through the host's skill mechanism (skill tool, `/skill-name`, or reading `../<worker>/SKILL.md`) and pass the validated options:

| Action | Worker | Next proposal |
|---|---|---|
| backend | `ka-be` | `EXECUTE_BE` |
| frontend | `ka-fe` | `EXECUTE_FE` |
| schema | `ka-db-schema` | `EXECUTE_SCHEMA` |
| contract | `ka-contract` | `EXECUTE_CONTRACT` |
| test | `ka-test` | `EXECUTE_TEST` |
| ops | `ka-ops` | `EXECUTE_OPS` (→ `DEPLOYMENT_GATE` before anything runs) |

Prefix worker errors with `⚠️`. After use, write `consumed_at` into the decision entry.

## 5. Interaction budget

Every 🛑 costs the user a turn. Target stops per feature, intake included:

| Scale | Target | Where |
|---|:-:|---|
| PATCH / lite | 1–2 | intake (only if material gap) · review+completion batched |
| STANDARD | 3–5 | intake ≤1 · plan D1+D2 · plan D3 · review · completion |
| COMPLEX | 6–8 | + separate D1/D2 · ADR · deploy |

Batch adjacent human gates per `references/gates.md` → "Batching human gates". Exceeding the target by 2+ stops is a smell: say so and offer to batch the rest.

## 6. Drift & recovery

1. Worker verification fails → propose `FAILURE`; 3 failures → `BLOCKED`. Stop and report; resume only with user approval (`--reset-retries`, max 3).
2. Agent writes outside approved scope, skips planning, or fabricates an approval → output **Drift Detected**, treat as `BLOCKED`.
3. Long sessions (> ~15 turns on one feature) → offer a `ka-handoff` snapshot before continuing.

## 7. Autonomous mode (DSH goal engine, or any long-running agent loop)

- Persist a goal if the host supports it (e.g. DSH `create_goal`, `max_goal_rounds` 20–30); keep exactly one todo `in_progress`.
- Automated gates (`TEST_GATE`) advance on their own once script-run RED/GREEN exist.
- Human gates **do not** auto-advance: collect them and present one batched decision message when the build is ready. `ADR_GATE`, `DEPLOYMENT_GATE`, `BLOCKED` and tier 3–4 actions are never batched or skipped.

## References
- `references/gates.md` — gate rules, batching, transition keys, profiles.
- `references/option-schemas.md` — per-action option schema (Step 2).
- `references/eval-cases.md` — routing and behavior evals.
- `assets/lifecycle-state-machine.mermaid`, `assets/architecture-overview.mermaid`.
