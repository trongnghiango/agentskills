---
name: ka-execute
description: "Alias (deprecated since 6.0) for the Execute stage of ka-workflow. Use when the user explicitly types /ka-execute <action> '<json>'. Do NOT use for natural-language requests — ka-workflow handles those directly."
license: Proprietary - internal ka-team use only
compatibility: Host-agnostic. Delegates entirely to ka-workflow §4 (Execute stage).
metadata:
  version: "2.0.0"
  risk: medium
  source: custom-ka-team
user-invocable: true
---

# ka-execute → ka-workflow (alias)

`ka-execute` was merged into `ka-workflow` in 6.0 to remove one hand-off and one confirmation per action. This alias keeps existing commands working.

When invoked as `/ka-execute <action> '<options-json>'`:

1. Load `ka-workflow` (skill tool, `/ka-workflow`, or `../ka-workflow/SKILL.md`).
2. Run its **§4 Execute stage** with the given action/options as Step 1 input: validate against `../ka-workflow/references/option-schemas.md`, apply the risk tier (tier 3–4 always stop for confirmation — no mode skips this), route to the worker.
3. Afterwards, propose the matching `EXECUTE_<ACTION>` transition with `state-manager.js --feature <slug>`.

Behavior must be identical to running `ka-workflow` directly. If the two ever disagree, `ka-workflow` wins.

## References
- `../ka-workflow/SKILL.md` — §4 Execute stage (source of truth).
- `references/eval-cases.md` — alias evals (explicit `/ka-execute` invocations).
