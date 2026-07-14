# Handoff Schema — `decisions.json`

Written by `ka-plan` at Step D5, consumed by `ka-execute` at its Step 0. This file is the contract between the two skills — treat any change to its shape as a breaking change for both.

## Full schema

```json
{
  "version": "1.0",
  "proposal_id": "<slug>-<yyyy-mm-dd>",
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
  "execution_hint": {
    "action": "backend | frontend | schema | test | ops",
    "options": { "...": "action-specific payload — see ka-execute/references/option-schemas.md for the exact shape each action expects" },
    "risk_tier": 1
  }
}
```

## Locking rules

- Only write `"status": "locked"` after the user has explicitly confirmed the D3 trade-off choice. A decision inferred by `ka-plan` alone, without that confirmation, must not be locked.
- `consumed_at` is added later, by `ka-execute`, once the handoff has been used — `ka-plan` never sets this field itself.

## Deriving `execution_hint`

This is the step that lets `ka-execute` skip re-asking the user for action/options at its Step 1–4.

**`action`** — derive from what D4 actually touches:
| D4 touches | action |
|---|---|
| New/changed API or business logic | `backend` |
| UI/component work | `frontend` |
| DB/table/migration changes | `schema` |
| New or updated test coverage | `test` |
| Deployment, infra, or release changes | `ops` |

**`options`** — assemble the concrete parameters implied by the D4 deep dive (feature name, affected files/modules, short description). The shape must satisfy the schema for that action defined in `ka-execute/references/option-schemas.md` — check it before writing `execution_hint.options`, since `ka-execute` will reject anything that doesn't validate.

**`risk_tier`** — default by action:
| Action | Default tier |
|---|---|
| frontend, test | 1 |
| backend | 2 |
| schema | 3 |
| ops | 4 |

Raise the tier above these defaults if D1–D4 surfaced unusual blast radius — e.g. a `backend` change that touches auth or payments should be tier 3, not the tier-2 default.
