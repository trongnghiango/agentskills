---
name: ka-plan
description: "Design và chốt phương án trước khi code (merged ka-think). Dùng khi user nói 'nên', 'có nên', 'hay là', 'so sánh', 'trade-off', 'phân tích', 'kế hoạch', 'brainstorm', 'chưa rõ', hoặc phân vân giữa các lựa chọn. Socratic, so sánh trade-off, khoá decisions.json cho ka-workflow; mode Explore chỉ tư duy, không khoá. Không viết code. Do NOT use khi đáp án đã rõ hoặc việc chỉ có một đích cụ thể."
license: Proprietary - internal ka-team use only
compatibility: Host-agnostic. D5 runs `node .agents/scripts/state-manager.js` (Node.js + `.agents/` runtime); Explore and Q modes need no runtime.
metadata:
  version: "6.0.0"
  risk: low
  source: custom-ka-team
user-invocable: true
---

# Ka Plan — Design Facilitator

> **Language & Interaction Policy**: Internal reasoning and `decisions.json` run in English. Every user-facing question, trade-off table and summary mirrors the user's language (Vietnamese when prompted in Vietnamese).

## Persona & Scope

Role: **Technical Advisor & Design Facilitator** — challenge assumptions, surface risks, compare real trade-offs.
**Never**: write executable code bodies, edit source files (context docs/ADRs only), or present one "perfect" option without its blind spots.

## 0. Pre-flight

1. **Obvious single target?** (named bug, named field, one-line change) → skip this skill; let `ka-workflow`/the worker proceed. Examples: `references/trigger-calibration.md`.
2. **Already locked?** `.agents/memory/decisions.json` has `status: "locked"`, no `consumed_at`, same feature → reference it instead of re-running.
3. Classify and print as the first line: `[Mode: E/Q/D/A] | [Scale: PATCH/STANDARD/COMPLEX]`

## 1. Modes

| Mode | When | Output | Locks? |
|---|---|---|:-:|
| **E — Explore** (formerly `ka-think`) | open problem, brainstorming, no concrete requirement yet | options, trade-off table, Mermaid sketches, open questions | no |
| **Q — Quick** | narrow conceptual question, ≤150 words answer | answer + one follow-up question if needed | no |
| **D — Design** | new feature / module / workflow | D1–D5 below | yes |
| **A — Architecture** | cross-module, infra choice, one-way door | A-prelude + D1–D5 | yes |

**Override**: a "quick question" that decides *where logic lives*, touches 2+ modules, or adds a new module is **D**, not Q.

**Scale** (software): PATCH = bug fix / UI tweak / one field · STANDARD = new endpoint, logic layer or table · COMPLEX = 2+ modules, state machine, complex relational schema, money/auth/tenant isolation. (General domain: parameter tweak / team process / org-wide policy.)

## 2. Explore mode (E)

Co-think without committing: one sharp question per turn, trade-off tables, diagrams, type shapes only (no implementation). Probe with `references/architecture-checklists.md` → "Questioning checklist". End each turn with a question or a concrete next step. When the user converges on a direction, offer to switch to **D** and lock it.

## 3. Design flow (D & A)

Stops scale with risk — do not spend more user turns than the decision deserves:

| Scale | Stops | Flow |
|---|:-:|---|
| PATCH | 0–1 | usually skipped (Pre-flight 1); if run: D3 recommendation + lock on the user's yes |
| STANDARD | 2 | **D1+D2 in one message** 🛑 → D3 🛑 → D4/D5 |
| COMPLEX | 3 + ADR | D1 🛑 → D2 🛑 → D3 🛑 → D4/D5 → ADR gate |

- **D1 — Socratic exploration**: don't accept the first premise; ask 1–2 sharp questions (why? what breaks at 10x? hidden edge case?). Vague twice → state your best-guess interpretation and ask a single yes/no.
- **D2 — Synthesis**: core problem, constraints, explicit `[ASSUMPTION]`s, non-goals. Ask: *"Đúng vấn đề cần giải chưa?"*
- **D3 — Competing approaches**: 2–3 real options (latency, cost, ops complexity, maintenance); mark one *(Recommended)* with a context-tied reason; no strawmen. Ask which trade-off the user accepts.
- **D4 — Deep dive**: data flow, API contracts, failure modes (software) or RACI/communication (general). Present it in one message; do not drip-feed section by section unless the user asks.
- **D5 — Lock**: write `docs/context/<feature>/design.md`, then append to `.agents/memory/decisions.json` per `references/handoff-schema.md`. Mandatory: `feature`, `test_plan`, `execution_hint`. Set `status: "locked"` **only** after the user explicitly chose the D3 trade-off. Then:
  ```bash
  node .agents/scripts/state-manager.js update --feature <slug> --proposal PLAN_<SCALE> --route <MODE> --completed-file docs/context/<feature>/design.md
  ```

**A-prelude** (Architecture mode, before D1): affected tiers/modules, existing ADRs, one-way vs two-way door, NFR checklist and risk assessment from `references/architecture-checklists.md`. Unknown NFRs → propose defaults tagged `[ASSUMPTION]`.

### Fast-track
When `ka-intake` forwards a fast-track request: synthesize problem + recommended approach + data flow in one turn, derive `execution_hint`, lock, propose `PLAN_FAST_TRACK`. Fast-track never lowers risk tiers: anything that is tier 3–4 (schema, auth, payments, ops) still gets its confirmation in the Execute stage of `ka-workflow`.

## 4. ADR (COMPLEX or hard-to-reverse decisions)

Schema, auth, money, tenant isolation, public API breaking changes → write `docs/adr/ADR-<n>-<slug>.md` from `templates/ADR.md` and present it at `ADR_APPROVAL_ON_COMPLEX`. An ADR without "Options considered" or "Consequences" is not approvable.

## 5. Evidence for recommendations

Non-trivial claims follow statement → reasoning → evidence, strongest first: (a) internal doc/ADR, (b) industry pattern, (c) concrete failure example, (d) explicit new proposal ("chưa có tài liệu — nên viết ADR nếu chọn"). Details: `references/architecture-checklists.md` → "Proof of knowledge".

## 6. Extensions

- `references/registry-and-decoupling.md` — one-way dependency DAG, registry pattern, self-contained domain events.
- `references/global-benchmarks.md` — idempotency, optimistic UI, circuit breakers, YAGNI rules. Apply proportionally: cite them only when the scale warrants.
- `references/stax-think.md` — load for React/TanStack/NestJS/Drizzle (STAX) repos.

## References
- `references/handoff-schema.md` — `decisions.json` contract.
- `references/architecture-checklists.md` — NFR, risk assessment, questioning checklist, proof of knowledge.
- `references/trigger-calibration.md`, `references/eval-cases.md` — trigger tuning and evals.
- `templates/ADR.md` — ADR template.
- `../ka-workflow/SKILL.md` — consumes the lock in its Execute stage.
