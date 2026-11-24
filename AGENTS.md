# AGENTS.md

This file provides guidance to AI coding agents (DeepSeek Harness, Claude Code, Codex) when working with code in this repository.
This file guides AI coding agents (DeepSeek Harness, Claude Code, Codex, Antigravity) working in this repository or consuming its `ka-*` skill set.

> **Prerequisites**: This skill set is designed to work with the global `AGENTS.md` at `~/.dsh/AGENTS.md`. Copy `templates/AGENTS.md.snippet` into your project's AGENTS.md to enable the always-on Intake Rule.

---

## 1. High‑level workflow

## 1. High-level architecture (v6.0)

```
User request → AGENTS.md (always‑on Intake Rule) → ka‑intake (completeness checklist)
    ├─ missing material? → 🛑 batched clarifying questions (max 2 rounds)
    └─ complete requirements → ka‑workflow (lifecycle orchestrator)
        ├─ design/re-design needed → ka‑plan (Socratic D1‑D5) ──locks──> decisions.json (with execution_hint)
        └─ build/deploy stage ───> ka‑execute (reads decisions.json) ──routes──> worker skill (ka‑be / ka‑fe / ka‑db‑schema / ka‑test / ka‑ops)
        └─ gates (ADR approval, BE review, deployment double-confirm, completion) enforced by ka‑workflow
User request → AGENTS.md (always-on Intake & Git Guardian rules) → ka-intake (completeness + fast-track safety floor)
    ├─ missing material business info? → 🛑 batched clarifying questions (1 round for PATCH, max 2 for larger work)
    └─ complete requirement → ka-workflow (lifecycle orchestrator + merged Execute stage)
        ├─ design/trade-off needed → ka-plan (Mode E/Q/D/A) ──locks──> .agents/memory/decisions.json (feature, test_plan, execution_hint)
        ├─ build/deploy stage ────> ka-workflow §4 Execute (schema check + risk tier 1–4) ──routes──> worker skill
        └─ gates enforced by .agents/scripts/state-manager.js:
             • TEST_GATE: script-executed RED & GREEN test runs (no agent-authored evidence files)
             • Human gates: require --approved-by-user "<verbatim user reply>" + audit log (.agents/memory/approvals.log)
```

* **Intake Rule** – Defined in `templates/AGENTS.md.snippet`; always active and loaded unconditionally every session.
* **ka‑intake** – Verifies requirements completeness against `skills/ka-intake/references/completeness-checklist.md` (actor, trigger, input, expected output, success criteria, edge cases, constraints, scope boundary). Asks batched clarifying questions.
* **ka‑workflow** – Master lifecycle orchestrator state machine (`.agents/scripts/state-manager.js`) that coordinates transitions between design, build, review, and deployment stages.
* **ka‑plan** – Technical design facilitator (D1-D5 Socratic flow). Evaluates architectures and outputs a locked `decisions.json` with an `execution_hint`. Never writes code.
* **ka‑execute** – Pure execution router. Consumes `decisions.json`, validates payload against `option-schemas.md`, applies risk-tier confirmations, and invokes worker skills via `Skill` tool calls.
* **Worker Skills** – Implementation skills (`ka-be`, `ka-fe`, `ka-db-schema`, `ka-contract`, `ka-test`, `ka-ops`) and the diagnostic skill (`ka-debug`) that perform the actual code changes, verification, or investigation.
* **Language & Autonomous Interaction Rule** – Internal reasoning, autonomous execution, tool calls, logs, and skill code MUST be in English. User-facing interactions (questions, confirmations, handoff notes, and final reports) MUST match the user's input language (Vietnamese/English). Reference: `standards/LANGUAGE_AND_INTERACTION_STANDARD.md`.
* **`ka-intake`** – Checks requirement completeness (`skills/ka-intake/references/completeness-checklist.md`). Guarded fast-track skips boilerplate questions when ≥6/8 fields are clear, but **never** guesses destructive/money/auth behavior.
* **`ka-plan`** – Design & reasoning facilitator (merged `ka-think` as Mode E — Explore). Scales user stops proportionally (PATCH 0–1, STANDARD 2, COMPLEX 3 + ADR). Never writes production code.
* **`ka-workflow`** – Lifecycle state machine + **Execute stage** (merged `ka-execute`). Validates per-action payloads (`skills/ka-workflow/references/option-schemas.md`), enforces risk tiers (tier 3–4 are never skippable, even in fast-track), and batches adjacent human gates.
* **`ka-execute` / `ka-think`** – Thin backward-compatibility aliases delegating to `ka-workflow` §4 and `ka-plan` Mode E.
* **Worker & Diagnostic Skills** – `ka-be`, `ka-fe`, `ka-db-schema`, `ka-contract`, `ka-test`, `ka-ops`, `ka-debug`, `ka-review`, `ka-handoff`, `git-guardian`. All workers support **Lite/PATCH proportionality** (zero filler `.md` files, follow existing repo conventions) alongside **Full** SaaS Clean Architecture mode.
* **Language & Autonomous Interaction Rule** – Internal reasoning, commands, state payloads, and code run in English; all user-facing questions, confirmations, and reports mirror the user's input language (Vietnamese/English). Reference: `standards/LANGUAGE_AND_INTERACTION_STANDARD.md`.

---

## 2. Setting up the skill set

## 2. Setting up in a target project

See `NEW_PROJECT_SETUP.md` for global `~/.agents/skills/` symlink setup. For per-repo setup:

```bash
# Create the .agents/skills directory (project‑level)
mkdir -p .agents/skills

# Copy the skill definitions into the repo
mkdir -p .agents/{skills,scripts,memory,config}
cp -r skills/* .agents/skills/

# Append the always‑on intake snippet to the target project's AGENTS.md
cat templates/AGENTS.md.snippet >> AGENTS.md
```

# Choose ONE lifecycle profile:

cp runtime-templates/workflow.json      .agents/config/workflow.json   # Full SaaS / multi-module profile

# OR:

cp runtime-templates/workflow.lite.json .agents/config/workflow.json   # Lite profile for small repos / scripts

* The snippet adds the **Intake Rule** that loads unconditionally.
* After copying, commit the new `.agents/` directory so the rules travel with the repo.
  cp runtime-templates/state-manager.js   .agents/scripts/state-manager.js
  chmod +x .agents/scripts/state-manager.js

### Runtime directory

The skills reference a `.agents/` runtime directory in the target project for state management:

```bash
# Initialize the .agents runtime structure
mkdir -p .agents/{scripts,memory,config}

# state-manager.js  — required by ka-workflow and ka-plan for state transitions
# workflow.json     — lifecycle stages and gate definitions (read by ka-workflow)
# state.json        — created at runtime, tracks current feature state
# decisions.json    — created by ka-plan at D5, consumed by ka-execute at Step 0
# Enable always-on Intake Rule in target project's AGENTS.md (idempotent)
python3 scripts/enable-intake.py /path/to/repo
```

> **Note**: `state-manager.js` and `workflow.json` are project-specific runtime files, not shipped with this skill set. Create them based on your project's lifecycle needs.

---

## 2.1 Triển khai Intake Rule cho một dự án

## 3. Common developer & verification commands

Chỉ bật cho repo dùng bộ skill ka-* và có `.agents/` runtime. Không đặt trong `~/.dsh/AGENTS.md` vì nó áp cho mọi project.

```bash
# Xem trước
python3 scripts/enable-intake.py /path/to/repo --dry-run

# Bật (idempotent, chèn block có marker vào AGENTS.md)
python3 scripts/enable-intake.py /path/to/repo

# Gỡ: xoá block giữa <!-- ka:intake-rule:start --> và <!-- ka:intake-rule:end -->
```

Sau khi bật, mỗi session trong repo đó nạp rule này vô điều kiện; agent gọi skill `ka-intake` trước khi làm bất kỳ việc gì.

## 3. Common developer commands

| Task                                       | Command                                                                                   | Notes                                                                                                        |
| ------------------------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Initialise the skill store                 | `node .agents/scripts/state-manager.js update --proposal INIT`                          | Creates `state.json` if it does not exist.                                                                 |
| Inspect current workflow state             | `node .agents/scripts/state-manager.js get`                                             | Shows the active state (e.g. `DESIGN_NEEDED`).                                                             |
| Reset a blocked state (max 3 resets)      | `node .agents/scripts/state-manager.js update --proposal RESUME --reset-retries`        | Used after a `BLOCKED` gate.                                                                               |
| Run a single worker skill manually (debug) | `claude code /ka-execute backend '{"feature":"auth","details":"Add JWT login"}'`        | Skips ka‑plan; still validates schema and risk‑tier.                                                       |
| List available skills                      | `/` trong composer (DSH) hoặc catalog tự động                                       | Shows `ka-intake`, `ka-plan`, `ka‑execute`, `ka‑workflow`.                                         |
| Lint all skill definitions                 | `python3 scripts/lint-skills.py`                                                        | Checks YAML, ≤500-char desc, ≤300 lines, self-contained paths inside `skills/`.                          |
| Run static eval checks                     | `node scripts/run-evals.mjs`                                                            | Validates all `eval-cases.md` tables/JSON and catalog token footprint.                                     |
| Run offline routing baseline               | `node scripts/run-evals.mjs --mode heuristic`                                           | Lexical trigger/anti-trigger sanity check; use `--mode llm` with an API endpoint for semantic evals.       |
| Test state-manager runtime                 | `bash scripts/test-state-manager.sh`                                                    | Runs 49 assertions covering `full` + `lite` profiles, human gate quotes, and script-run RED/GREEN gates. |
| List active features                       | `node .agents/scripts/state-manager.js list`                                            | Shows per-feature states in `.agents/memory/features/`.                                                    |
| Initialize / inspect a feature             | `node .agents/scripts/state-manager.js update --feature <slug> --proposal INIT`         | Isolates state per feature slug.                                                                             |
| Record TDD RED / GREEN run                 | `node .agents/scripts/state-manager.js test --feature <slug> --phase red --cmd "<cmd>"` | Required before `PASS` at `TEST_GATE`.                                                                   |

The repository does **not** have a build system, test runner, or lint configuration because the artefacts are declarative skill definitions and documentation.

---

## 4. Invoking the skills

## 4. Reference material

* **`/ka-intake`** – never invoked directly; the always‑on rule triggers it.
* **`/ka-plan`** – run explicitly or automatically when a request is non‑obvious (see `ka‑plan` description). Example: ` /ka-plan`.
* **`/ka-execute`** – route an explicit action, e.g. ` /ka-execute backend '{"feature":"auth","details":"Add JWT login"}'`.
* **`/ka-workflow`** – manage an in‑progress feature, e.g. ` /ka-workflow` to view the current gate or advance the state.
* **Option schemas** – `skills/ka-workflow/references/option-schemas.md`
* **Gate definitions & profiles** – `skills/ka-workflow/references/gates.md`
* **Handoff schema (`decisions.json`)** – `skills/ka-plan/references/handoff-schema.md`
* **Architecture & NFR checklists** – `skills/ka-plan/references/architecture-checklists.md`
* **Completeness checklist** – `skills/ka-intake/references/completeness-checklist.md`
* **Skill architecture map** – `SKILL_THEME.md`

All skills load through the host skill tool: DSH calls `skill` or resolves `/skill-name` in the composer.

---

## 5. Reference material

## 5. FAQ

* **Option schemas** – `skills/ka-execute/references/option-schemas.md` (JSON schema for each action).
* **Handoff schema** – `skills/ka-plan/references/handoff-schema.md` (structure of `decisions.json`).
* **Completeness checklist** – `skills/ka-intake/references/completeness-checklist.md` (fields to verify in intake).
* **Gate definitions** – `skills/ka-workflow/references/gates.md` (ADR, backend review, deployment, completion, blocker‑resolution).
* **STAX extensions** – `skills/ka-plan/references/stax-think.md` (auto‑loaded when a STAX stack is detected).
* **Trigger calibration** – `skills/ka-plan/references/trigger-calibration.md` (calibration of design triggers).
* **Evaluation cases** – `skills/ka-intake/references/eval-cases.md` (eval queries for intake completeness).
* **Skill architecture map** – `SKILL_THEME.md` (orchestration / worker / utility layer overview and integration flow).

---

## 6. FAQ

* **How does the agent know when to ask clarifying questions?** – The always‑on Intake Rule loads `ka‑intake`, which runs the checklist and asks *batched* questions for any *material* missing fields.
* **What if a user supplies an action without required options?** – `ka‑execute` validates against the option schema and issues a hard‑stop asking for a correct JSON payload.
* **Can I bypass the risk‑tier confirmation?** – No. Tier‑1–4 confirmations are hard stops enforced by `ka‑execute`. Tier‑4 (ops) requires the action name, environment, and rollback plan.
* **Where are the state transitions logged?** – `ka‑workflow` prints `🔔 TRANSITION: [OLD] -> [NEW]` on each state change.

---

*End of AGENTS.md*

* **Can fast-track bypass Tier 3–4 confirmations?** – **No.** Fast-track only auto-confirms Tier 1–2 (`frontend`, `test`, standard `backend`/`contract`). Tier 3 (`schema`, auth/money) and Tier 4 (`ops`) always require typed user confirmation, and `ops` additionally stops at `DEPLOYMENT_GATE`.
* **Can an agent self-approve a gate or fake test output?** – **No.** Human gates require `--approved-by-user "<verbatim user reply>"` (logged to `.agents/memory/approvals.log`), and `TEST_GATE` only accepts runs executed directly by `state-manager.js test` (`--evidence` JSON files are rejected).
* **Do small bug fixes have to create 4 markdown files and 4 Clean Architecture layers?** – **No.** Both `workflow.lite.json` and `PATCH` scale run with zero extra `.md` planning files and follow the repository's existing structure.
