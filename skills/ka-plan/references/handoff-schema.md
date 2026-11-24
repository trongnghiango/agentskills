# Handoff Schema — `decisions.json`

Written by `ka-plan` at Step D5, consumed by the Execute stage of `ka-workflow` (§4, Step 0). This file is the contract between the two skills — treat any change to its shape as a breaking change for both.

## Full schema

```json
{
  "version": "1.0",
  "proposal_id": "<slug>-<yyyy-mm-dd>",
  "feature": "<feature slug — same value passed to state-manager.js --feature>",
  "fast_track": false,
  "domain": "SOFTWARE | GENERAL",
  "mode": "Q | D | A",
  "scale": "PATCH | STANDARD | COMPLEX",
  "status": "locked",
  "created_at": "<ISO timestamp>",
  "context_file": "docs/context/xx_tk_design.md",
  "decision": {
    "summary": "<1-line plain language summary of what was decided>",
    "chosen_approach": "<name of the option chosen in D3>",
    "rejected_approaches": ["<option A>", "<option B>"],
    "tradeoffs_accepted": "<the trade-off the user explicitly agreed to in D3>"
  },
  "test_plan": {
    "strategy": "TDD | test-first for bug fix | characterization first",
    "levels": ["unit", "integration"],
    "cases": ["<behavior> — <level> — <RED case đầu tiên>"],
    "coverage_target": "<vd: domain 80% branch>"
  },
  "execution_hint": {
    "action": "backend | frontend | schema | contract | test | ops",
    "options": { "...": "action-specific payload — see ka-workflow/references/option-schemas.md for the exact shape each action expects" },
    "risk_tier": 1
  }
}
```

## Locking rules

- Only write `"status": "locked"` after the user has explicitly confirmed the D3 trade-off choice. A decision inferred by `ka-plan` alone, without that confirmation, must not be locked.
- `consumed_at` is added later, by the Execute stage of `ka-workflow`, once the handoff has been used — `ka-plan` never sets this field itself.

## `test_plan` (bắt buộc)

`test_plan` không được để trống. Nó trả lời: hành vi nào được test ở tầng nào, case RED đầu tiên là gì, ngưỡng coverage áp cho layer nào.

- Feature mới → `strategy: "TDD"`, `cases` phải có case RED đầu tiên.
- Bug fix → `strategy: "test-first for bug fix"`, `cases` phải có test tái hiện bug.
- Code cũ chưa có test → `strategy: "characterization first"`.
- Không có test plan → `ka-plan` không được set `status: "locked"`.

## Deriving `execution_hint`

This is the step that lets `ka-workflow`'s Execute stage skip re-asking the user for action/options (Step 1).

**`action`** — derive from what D4 actually touches:
| D4 touches | action |
|---|---|
| New/changed API or business logic | `backend` |
| UI/component work | `frontend` |
| DB/table/migration changes | `schema` |
| New or updated test coverage | `test` |
| Deployment, infra, or release changes | `ops` |

**`options`** — assemble the concrete parameters implied by the D4 deep dive (feature name, affected files/modules, short description). The shape must satisfy the schema for that action defined in `ka-workflow/references/option-schemas.md` — check it before writing `execution_hint.options`, since the Execute stage will reject anything that doesn't validate.

**`risk_tier`** — default by action:
| Action | Default tier |
|---|---|
| frontend, test | 1 |
| backend, contract | 2 |
| schema | 3 |
| ops | 4 |

`fast_track: true` never lowers a tier: tier 3–4 actions are always confirmed by the user.

Raise the tier above these defaults if D1–D4 surfaced unusual blast radius — e.g. a `backend` change that touches auth or payments should be tier 3, not the tier-2 default.
