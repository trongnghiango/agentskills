---
name: ka-intake
description: "Requirement completeness checker. Dùng khi nhận yêu cầu mới chưa rõ actor/scope/input/output/success criteria — hỏi gom một lượt trước khi thiết kế hay code. Auto qua Intake Rule trong AGENTS.md; /ka-intake cũng gọi được. Do NOT use for việc cosmetic/typo."
license: Proprietary - internal ka-team use only
compatibility: Host-agnostic. Loaded via the always-on Intake Rule in AGENTS.md — see references/completeness-checklist.md.
metadata:
  version: "2.0.0"
  risk: low
  source: custom-ka-team
user-invocable: true
---

# Ka Intake — Requirement Completeness Check

> **Language & Interaction Policy**: Checklist evaluation runs internally in English. Every user-facing prompt (batched clarifying questions, fast-track summary, assumptions) MUST match the user's input language (Vietnamese when prompted in Vietnamese).

## Purpose
Sits before `ka-plan` and `ka-workflow` on every request. Its only job is to answer honestly: **does this request contain enough business-level detail to act on without guessing?** If not, it asks — instead of letting the agent quietly invent business rules.

- `ka-intake` checks *requirement* completeness (actor, trigger, input, output, success criteria, edge cases, constraints, scope).
- `ka-plan` challenges *design* trade-offs ("what breaks at 10x, which architecture"). `ka-intake` runs first.

## When this activates
Triggered by the always-on Intake Rule in `AGENTS.md` before `ka-workflow` or `ka-plan` begins work, or manually via `/ka-intake`.
**Skip immediately** when:
1. A locked `decisions.json` entry (`status: "locked"`, unconsumed) already covers this feature, OR
2. The request is a pure cosmetic/typo fix, knowledge question, or read-only inspection with zero ambiguity.

## Dual Execution Modes (Fast-Track vs Batched Check)

### Mode A: Guarded Fast-Track Mode
**Activates ONLY when**:
1. User supplies a structured template from `templates/` (`fast-track-feature.md`, `fast-track-hotfix.md`, `fast-track-worker.md`, `fast-track-refactor.md`), OR
2. At least **6 of 8** checklist fields are already present/unambiguous from repo context and the remaining fields are harmless technical defaults, OR
3. User explicitly requests skipping discovery (`/ka-intake --fast-track`, *"fast-track"*, *"bỏ qua phỏng vấn"*). Casual urgency words alone (*"làm ngay"*, *"nhanh lên"*) on a 1-line vague prompt do **NOT** qualify if material business fields are missing.

**Safety floor in Fast-Track Mode (non-negotiable)**:
- If the request touches **irreversible / high-blast-radius** behavior (deleting/mutating production data, money/billing math, auth/permissions/tenant isolation, or production ops) AND a material field is ambiguous → ask **1 compact question** (≤3 bullets) instead of guessing.
- Fast-Track **never waives** Tier 3–4 confirmations (`schema`, `ops`, auth/payment changes) in `ka-workflow`.
- Otherwise, ask 0 questions, state any safe defaults explicitly in 3 lines, and hand off:
  ```text
  ⚡ FAST-TRACK ACTIVATED:
  • Mục tiêu & Ranh giới: <Core Goal | In-scope vs Out-of-scope>
  • Giả định mặc định: <Explicit defaults inferred from repo>
  • Tiếp theo: ka-plan (1-turn lock) / ka-workflow Execute
  ```

### Mode B: Batched Completeness Check (Default for ambiguous requests)

#### Step 1 — Run the checklist
Classify each field in `references/completeness-checklist.md`:
- **Present** — stated or unambiguously implied by conversation/codebase context.
- **Missing, safe to default** — technical detail with no business consequence — do not ask.
- **Missing and material** — could change outcome, scope, permissions, or data integrity if guessed wrong — must ask.

#### Step 2 — Ask once, batched
Ask all "Missing and material" fields in **one compact message** (aim for 2–4 sharp questions, never a 10-item questionnaire):
```text
🗣️ Để làm đúng, mình cần chốt nhanh:
1. <field>: <question + concrete options if helpful>
2. <field>: <question>
```
🛑 **HARD STOP** — wait for the user's reply.

**Max 2 rounds.** For small/PATCH work, cap at **1 round**. If gaps remain after the cap, state your best-guess assumptions explicitly (`[ASSUMPTION]`) and proceed.

#### Step 3 — Hand off (no extra confirmation turn)
Restate the completed requirement in 2–3 sentences (including any `[ASSUMPTION]` tags) and immediately route forward without asking an extra "is this restatement OK?":
- Needs design/trade-off choice → `ka-plan`.
- Concrete, scoped action → `ka-workflow` (Execute stage) or the matching worker in `lite` repos.

## References
- `references/completeness-checklist.md` — the 8 fields with "material" vs "safe to default" examples.
- `references/eval-cases.md` — should-ask / should-not-ask / fast-track guard eval prompts.
- `templates/fast-track-feature.md`, `templates/fast-track-hotfix.md`, `templates/fast-track-worker.md`, `templates/fast-track-refactor.md`.
