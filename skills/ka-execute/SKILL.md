---
name: ka-execute
description: Pure execution router. Consumes a locked decision from ka-plan (or asks the user directly) and forwards a schema-validated action to the matching implementation skill (ka-be, ka-fe, ka-db-schema, ka-contract, ka-test, ka-ops) with risk-tiered confirmation. Never edits repository files itself. Use when the user wants to run, deploy, apply, execute, orchestrate, launch, start, or trigger a backend, frontend, schema, contract, test, or ops action — especially after a design decision has already been made.
license: Proprietary - internal ka-team use only
compatibility: Designed for Claude Code. Requires the `Skill` tool to route to target skills, and reads `.agents/memory/decisions.json` when present.
metadata:
  version: "1.5.0"
  risk: medium
  source: custom-ka-team
allowed-tools: Skill Read
---

# Ka Execute – Orchestration / Routing Skill

## Purpose
Dispatches `ka-plan` outcomes, or a directly-specified action, to the appropriate concrete implementation skill. **Never** edits repository files itself; it only forwards validated arguments via the `Skill` tool and returns the target skill's response.

## Interaction Flow (Hard Stops)

### Step 0 — Check for a Locked Handoff
Look for the most recent `.agents/memory/decisions.json` entry where `status == "locked"` and no `consumed_at` field is present.

- **Not found** → proceed to Step 1 as normal.
- **Found** → present it:
```
🗣️ Tìm thấy quyết định đã chốt từ ka-plan:
"<decision.summary>"
→ Action đề xuất: <execution_hint.action>
→ Options đề xuất: <execution_hint.options>
→ Risk tier: <execution_hint.risk_tier>
Dùng luôn thông tin này? (yes / no, tôi muốn nhập lại từ đầu)
```
🛑 **HARD STOP**. On `yes`, adopt `action`/`options`/`risk_tier` and skip to Step 4b. On `no`, discard the handoff and continue at Step 1.

Once Step 7 completes and a handoff was used, write `consumed_at: <ISO timestamp>` back into that entry so it isn't re-offered.

### Steps 1–4 — Ask directly (only reached if no handoff was used or accepted)
1. **Ask for Action**: `Which action do you want to execute? Options: backend, frontend, schema, contract, test, ops` 🛑 **HARD STOP**.
2. **Validate Action**: if unsupported, reply `❌ Unknown action: <action>. Supported: backend, frontend, schema, contract, test, ops.` 🛑 **HARD STOP**, retry. After 3 consecutive invalid replies: `Execution cancelled — no valid action provided after 3 attempts.`
3. **Ask for Options**: `Please provide a JSON object with the options for <action>.` 🛑 **HARD STOP**.
4. **Parse Options**: on failure, `⚠️ Could not parse options as JSON. Send a valid JSON object.` 🛑 **HARD STOP**, retry. After 3 consecutive failures: `Execution cancelled — could not obtain valid JSON after 3 attempts.`

### Step 4b — Validate Against Schema
Validate the parsed (or handoff-provided) options against the per-action schema in `references/option-schemas.md`. This check applies unconditionally — a handoff's `execution_hint.options` is not exempt.
```
⚠️ Missing/invalid field(s) for `<action>`: <field1>, <field2>. Expected: <schema summary>.
```
🛑 **HARD STOP** on failure; re-prompt for corrected JSON.

### Step 5 — Risk-Tiered Confirmation
Look up the risk tier (`execution_hint.risk_tier` if from a handoff, otherwise the default in the Routing Table below).

| Tier | Confirmation |
|---|---|
| 1–2 | Simple: `Execute <action> with these options? (yes/no)` |
| 3 | Must type the action name back exactly — plain "yes" is not accepted. |
| 4 | Must type the action name back **and** explicitly confirm environment + rollback plan before proceeding. |

🛑 **HARD STOP** at the applicable format. Anything else → `Execution cancelled.`

### Step 6 — Route to Target Skill
```typescript
if (action === 'backend')  await Skill({skill: 'ka-be', args: JSON.stringify(options)});
if (action === 'frontend') await Skill({skill: 'ka-fe', args: JSON.stringify(options)});
if (action === 'schema')   await Skill({skill: 'ka-db-schema', args: JSON.stringify(options)});
if (action === 'contract') await Skill({skill: 'ka-contract', args: JSON.stringify(options)});
if (action === 'test')     await Skill({skill: 'ka-test', args: JSON.stringify(options)});
if (action === 'ops')      await Skill({skill: 'ka-ops', args: JSON.stringify(options)});
```
Prefix any error from the target skill with `⚠️` and forward it.

### Step 7 — Return Response
Pass the target skill's output verbatim back to the user. If a handoff was used, write `consumed_at` as described in Step 0.

## Routing Table

| Action | Target Skill | Default Risk Tier |
|---|---|---|
| backend | ka-be | 2 |
| frontend | ka-fe | 1 |
| schema | ka-db-schema | 3 |
| contract | ka-contract | 2 |
| test | ka-test | 1 |
| ops | ka-ops | 4 |
| *custom* | *add-your-skill* | *assign explicitly — never default to tier 1* |

Full option schemas per action live in `references/option-schemas.md`. Eval prompts for testing this flow live in `references/eval-cases.md`.

## Diagram

See `../ka-workflow/assets/architecture-overview.mermaid` for how `ka-execute` fits between `ka-plan` and the worker skills.

## References
- `references/option-schemas.md` — JSON schema per action, used at Step 4b.
- `references/eval-cases.md` — should-trigger and validation test prompts.
- `ka-plan` — produces the `decisions.json` handoff consumed at Step 0.
