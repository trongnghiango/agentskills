---
name: ka-think
description: "Alias (deprecated since 6.0) for ka-plan Explore mode. Use when the user explicitly types /ka-think to brainstorm or co-think without locking a decision. Do NOT use for natural-language design requests — ka-plan handles those directly."
license: Proprietary - internal ka-team use only
compatibility: Host-agnostic. Delegates entirely to ka-plan (Mode E — Explore). No repository side-effects.
metadata:
  version: "3.0.0"
  risk: low
  source: custom-ka-team
user-invocable: true
---

# ka-think → ka-plan Explore mode (alias)

`ka-think` and `ka-plan` ran the same Q/D/A classification and D1–D5 flow, which made routing ambiguous. Since 6.0 `ka-plan` owns both; this alias keeps `/ka-think` working.

When invoked as `/ka-think ...`:

1. Load `ka-plan` (skill tool, `/ka-plan`, or `../ka-plan/SKILL.md`).
2. Start in **Mode E — Explore**: co-think, one sharp question per turn, trade-off tables, Mermaid sketches; no code, no file changes, no `decisions.json` lock.
3. Use `../ka-plan/references/architecture-checklists.md` for the NFR checklist, risk assessment, questioning checklist and proof-of-knowledge rules.
4. If the user converges on a direction, offer to switch to Mode D and lock it.

## References
- `../ka-plan/SKILL.md` — source of truth.
- `references/eval-cases.md` — alias evals.
