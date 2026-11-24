# AGENTS.md

This file guides AI coding agents (DeepSeek Harness, Claude Code, Codex, Antigravity) working in this repository or consuming its `ka-*` skill set.

---

## 1. High-level architecture (v6.0)

```
User request → AGENTS.md (always-on Intake & Git Guardian rules) → ka-intake (completeness + fast-track safety floor)
    ├─ missing material business info? → 🛑 batched clarifying questions (1 round for PATCH, max 2 for larger work)
    └─ complete requirement → ka-workflow (lifecycle orchestrator + merged Execute stage)
        ├─ design/trade-off needed → ka-plan (Mode E/Q/D/A) ──locks──> .agents/memory/decisions.json (feature, test_plan, execution_hint)
        ├─ build/deploy stage ────> ka-workflow §4 Execute (schema check + risk tier 1–4) ──routes──> worker skill
        └─ gates enforced by .agents/scripts/state-manager.js:
             • TEST_GATE: script-executed RED & GREEN test runs (no agent-authored evidence files)
             • Human gates: require --approved-by-user "<verbatim user reply>" + audit log (.agents/memory/approvals.log)
```

* **`ka-intake`** – Checks requirement completeness (`skills/ka-intake/references/completeness-checklist.md`). Guarded fast-track skips boilerplate questions when ≥6/8 fields are clear, but **never** guesses destructive/money/auth behavior.
* **`ka-plan`** – Design & reasoning facilitator (merged `ka-think` as Mode E — Explore). Scales user stops proportionally (PATCH 0–1, STANDARD 2, COMPLEX 3 + ADR). Never writes production code.
* **`ka-workflow`** – Lifecycle state machine + **Execute stage** (merged `ka-execute`). Validates per-action payloads (`skills/ka-workflow/references/option-schemas.md`), enforces risk tiers (tier 3–4 are never skippable, even in fast-track), and batches adjacent human gates.
* **`ka-execute` / `ka-think`** – Thin backward-compatibility aliases delegating to `ka-workflow` §4 and `ka-plan` Mode E.
* **Worker & Diagnostic Skills** – `ka-be`, `ka-fe`, `ka-db-schema`, `ka-contract`, `ka-test`, `ka-ops`, `ka-debug`, `ka-review`, `ka-handoff`, `git-guardian`. All workers support **Lite/PATCH proportionality** (zero filler `.md` files, follow existing repo conventions) alongside **Full** SaaS Clean Architecture mode.
* **Language & Autonomous Interaction Rule** – Internal reasoning, commands, state payloads, and code run in English; all user-facing questions, confirmations, and reports mirror the user's input language (Vietnamese/English). Reference: `standards/LANGUAGE_AND_INTERACTION_STANDARD.md`.

---

## 2. Setting up in a target project

See `NEW_PROJECT_SETUP.md` for global `~/.agents/skills/` symlink setup. For per-repo setup:

```bash
mkdir -p .agents/{skills,scripts,memory,config}
cp -r skills/* .agents/skills/

# Choose ONE lifecycle profile:
cp runtime-templates/workflow.json      .agents/config/workflow.json   # Full SaaS / multi-module profile
# OR:
cp runtime-templates/workflow.lite.json .agents/config/workflow.json   # Lite profile for small repos / scripts

cp runtime-templates/state-manager.js   .agents/scripts/state-manager.js
chmod +x .agents/scripts/state-manager.js

# Enable always-on Intake Rule in target project's AGENTS.md (idempotent)
python3 scripts/enable-intake.py /path/to/repo
```

---

## 3. Common developer & verification commands

| Task | Command | Notes |
|------|---------|-------|
| Lint all skill definitions | `python3 scripts/lint-skills.py` | Checks YAML, ≤500-char desc, ≤300 lines, self-contained paths inside `skills/`. |
| Run static eval checks | `node scripts/run-evals.mjs` | Validates all `eval-cases.md` tables/JSON and catalog token footprint. |
| Run offline routing baseline | `node scripts/run-evals.mjs --mode heuristic` | Lexical trigger/anti-trigger sanity check; use `--mode llm` with an API endpoint for semantic evals. |
| Test state-manager runtime | `bash scripts/test-state-manager.sh` | Runs 49 assertions covering `full` + `lite` profiles, human gate quotes, and script-run RED/GREEN gates. |
| List active features | `node .agents/scripts/state-manager.js list` | Shows per-feature states in `.agents/memory/features/`. |
| Initialize / inspect a feature | `node .agents/scripts/state-manager.js update --feature <slug> --proposal INIT` | Isolates state per feature slug. |
| Record TDD RED / GREEN run | `node .agents/scripts/state-manager.js test --feature <slug> --phase red --cmd "<cmd>"` | Required before `PASS` at `TEST_GATE`. |

---

## 4. Reference material

* **Option schemas** – `skills/ka-workflow/references/option-schemas.md`
* **Gate definitions & profiles** – `skills/ka-workflow/references/gates.md`
* **Handoff schema (`decisions.json`)** – `skills/ka-plan/references/handoff-schema.md`
* **Architecture & NFR checklists** – `skills/ka-plan/references/architecture-checklists.md`
* **Completeness checklist** – `skills/ka-intake/references/completeness-checklist.md`
* **Skill architecture map** – `SKILL_THEME.md`

---

## 5. FAQ

* **Can fast-track bypass Tier 3–4 confirmations?** – **No.** Fast-track only auto-confirms Tier 1–2 (`frontend`, `test`, standard `backend`/`contract`). Tier 3 (`schema`, auth/money) and Tier 4 (`ops`) always require typed user confirmation, and `ops` additionally stops at `DEPLOYMENT_GATE`.
* **Can an agent self-approve a gate or fake test output?** – **No.** Human gates require `--approved-by-user "<verbatim user reply>"` (logged to `.agents/memory/approvals.log`), and `TEST_GATE` only accepts runs executed directly by `state-manager.js test` (`--evidence` JSON files are rejected).
* **Do small bug fixes have to create 4 markdown files and 4 Clean Architecture layers?** – **No.** Both `workflow.lite.json` and `PATCH` scale run with zero extra `.md` planning files and follow the repository's existing structure.
