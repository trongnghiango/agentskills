---
name: ka-workflow
description: Master lifecycle orchestrator for a feature from design through archive. Tracks state via a decoupled state store, delegates design work to ka-plan and all execution routing to ka-execute (never routes directly to worker skills), and presents lifecycle gates (ADR approval, code review, deployment, completion) for user confirmation. Use when the user wants to track, resume, or advance a feature through its full workflow, or asks "where are we" / "what's next" on an in-progress feature.
license: Proprietary - internal ka-team use only
compatibility: Designed for Claude Code. Requires Node.js to run `.agents/scripts/state-manager.js` and reads `.agents/config/workflow.json` for gate/state definitions.
metadata:
  version: "5.0.0"
  risk: high
  source: custom-ka-team
allowed-tools: Skill Bash(node .agents/scripts/state-manager.js:*) Read
---

# Master Workflow Orchestrator (ka-workflow)

## 1. Persona & Strategy
Role: **Chief Project Manager & Workflow Orchestrator**. Tracks the lifecycle state of a feature and hands off work to the specialists that own their domains:

- **`ka-intake`** — owns requirement completeness. Runs before any of the below, triggered by the always-on rule in `CLAUDE.md`, not called by `ka-workflow` directly.
- **`ka-plan`** — owns all design/architecture reasoning. Called whenever the state machine enters a design or re-design step.
- **`ka-execute`** — owns all execution routing (backend, frontend, schema, test, ops). Called whenever the state machine enters a build/deploy step.

`ka-workflow` never calls `ka-be`, `ka-fe`, `ka-db-schema`, `ka-test`, or `ka-ops` directly — only `ka-plan` or `ka-execute`, which apply their own hard-stops, risk tiers, and schema validation. Two orchestrators independently deciding when it's safe to touch the same worker skill is the exact failure mode this avoids.

See `assets/architecture-overview.mermaid` for the high-level relationship between all three skills, and `assets/lifecycle-state-machine.mermaid` for the full state/gate diagram referenced throughout this file.

## 2. Decoupled State & Rule Engine Protocol
1. **State Store**: `node .agents/scripts/state-manager.js get` (queries `.agents/memory/state.json`).
2. **Rule Engine**: lifecycle stages and gate definitions live in `.agents/config/workflow.json`. This controls *when a gate exists*, not *whether execution is confirmed* — confirmation strength for anything touching code or infra always comes from `ka-plan`/`ka-execute`, never from `workflow.json` alone.
3. **Session Turn Warning**: if `session_turn` > 15, warn the user of LLM drift risk.
4. **Transition Log**: on every transition, print `🔔 TRANSITION: [OLD_STATE] -> [NEW_STATE]`. Every transition in this version passed through a `ka-plan` lock or a `ka-execute`/gate confirmation first — none happen silently.

## 3. Delegation Protocol

0. **Intake** — every request arrives already filtered through `ka-intake` (triggered by the always-on rule in `CLAUDE.md`, not by `ka-workflow` itself). By the time `ka-workflow` sees a request, missing-but-material business fields have already been asked about or explicitly flagged as assumptions. `ka-workflow` does not re-run this check — it trusts the completed requirement it receives.
1. **Design stages** (new feature, re-design, ADR needed, `COMPLEX_MODE` route) → invoke `ka-plan`. Wait for a locked `decisions.json` entry, or an explicit decline, before proceeding.
2. **Build/deploy stages** → invoke `ka-execute` with no preset action/options. Its own Step 0 finds the locked decision and takes it from there, including its risk-tier ladder and schema validation — `ka-workflow` does not pre-fill or bypass any of it.
3. **Review stage** — present the walkthrough/diff directly (see `BE_REVIEW_GATE` below); this happens after `ka-execute` returns.
4. Once a stage returns, read its proposed next state and, after any required gate is approved, update the store:
   ```bash
   node .agents/scripts/state-manager.js update --proposal [PROPOSED_KEY]
   ```

## 4. Gates
Full descriptions, including the `DEPLOYMENT_GATE` double-confirmation rationale and the `BLOCKER_RESOLUTION_GATE` retry cap, are in `references/gates.md`. Summary:

| Gate | Trigger | Confirmation |
|---|---|---|
| `ADR_APPROVAL_ON_COMPLEX` | `route == COMPLEX_MODE` | 🛑 review + sign off on ADR |
| `BE_REVIEW_GATE` | backend action completes | 🛑 approve code review walkthrough |
| `BE_FE_GATE_ON_UI` | backend proposes `success_with_ui` | 🛑 approve before frontend work starts |
| `DEPLOYMENT_GATE` | before an `ops` action | 🛑 workflow-level approve, then `ka-execute`'s own tier-4 confirm |
| `COMPLETION_GATE` | before `READY_TO_ARCHIVE` | 🛑 confirm feature completion |
| `BLOCKER_RESOLUTION_GATE` | retry limit exceeded | 🛑 manual resolution, max 3 resets per state |

## 5. Drift & Error Recovery
1. **Self-Healing Loop**: on a verification failure from `ka-execute`, propose transition key `failure`; `state-manager.js` tracks retries per-state and moves to `BLOCKED` once the limit is exceeded (see `BLOCKER_RESOLUTION_GATE`). Halt, report the error, wait for manual resolution.
2. **Drift Warning**: if an agent violates directories, skips planning, or writes outside approved specs, stop immediately and output the Drift Detected alert. Treat this like `BLOCKED` — do not resume without explicit user direction.

## References
- `references/gates.md` — full gate descriptions, including retry caps and the deploy double-confirmation rationale.
- `assets/architecture-overview.mermaid` — how `ka-workflow`, `ka-plan`, and `ka-execute` relate.
- `assets/lifecycle-state-machine.mermaid` — full state/gate diagram for the design → build → review → deploy → archive lifecycle.
- `ka-plan`, `ka-execute` — the two skills this orchestrator delegates to.
