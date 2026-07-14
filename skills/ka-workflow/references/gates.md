# Gates — Full Descriptions

For each gate, `ka-workflow` is responsible for *presenting* it; the underlying risk decision for build/deploy actions still comes from `ka-execute`'s risk-tier table (see `ka-execute/references/option-schemas.md`), not from this list alone.

* **`ADR_APPROVAL_ON_COMPLEX`**: if `route === 'COMPLEX_MODE'`, halt and 🛑 ask the user to review and sign off on the ADR/technical design document produced by `ka-plan`.
* **`BE_REVIEW_GATE`**: after `ka-execute` completes a backend action, 🛑 present the Code Review Walkthrough. Verify it contains a **Security & Isolation Code Diff** section before letting the user approve the transition to verify.
* **`BE_FE_GATE_ON_UI`**: if the backend walkthrough proposes transition key `success_with_ui` toward `FE_PLANNING`, 🛑 confirm the walkthrough's Security & Isolation section exists before asking for approval.
* **`DEPLOYMENT_GATE`**: before invoking `ka-execute` for an `ops` action, 🛑 present the ops plan: *"Infrastructure package ready. Deploy to staging?"* This is in addition to, not instead of, `ka-execute`'s own tier-4 confirmation (type-to-confirm + rollback acknowledgement). The user confirms twice for deploys — once at the workflow level, once at the execute level. This redundancy is intentional for the highest-risk action in the system.
* **`COMPLETION_GATE`**: before transitioning to `READY_TO_ARCHIVE`, 🛑 display the E2E walkthrough and ask: *"Confirm feature completion and archive?"*
* **`BLOCKER_RESOLUTION_GATE`**: when state transitions to `BLOCKED` (retry limit exceeded or deploy failure), freeze execution, display the blockers, and wait for:
  ```bash
  node .agents/scripts/state-manager.js update --proposal [resume_be | resume_patch | resume_fe | rollback_to_design] --reset-retries
  ```
  **Limit: at most 3 resets per state per feature.** On the 4th consecutive failure for the same state, do not offer `--reset-retries` again — report that the state appears structurally blocked and recommend returning to `ka-plan` to re-examine the design instead of retrying execution.

## Transition Keys Reference

All `next_state_proposal` keys used by worker skills and consumed by `ka-workflow`:

| Key | Proposed by | Meaning |
|-----|-------------|---------|
| `success` | ka-plan, ka-contract, ka-db-schema, ka-fe, ka-review, ka-ops | Stage completed successfully. |
| `success_with_ui` | ka-be | Backend completed; frontend work is required next. Routes through `BE_FE_GATE_ON_UI`. |
| `success_no_ui` | ka-be | Backend completed; no frontend work needed. Skips `FE_PLANNING`. |
| `failure` | ka-be, ka-fe, ka-ops, ka-review | Stage failed verification. Triggers retry logic; may escalate to `BLOCKER_RESOLUTION_GATE` after retry limit. |

When adding a new worker skill, register its transition keys in this table and in `workflow.json` state definitions.

---

## Changelog from 4.2.0 → 5.0.0

- **Removed** direct routing to `ka-be`, `ka-fe`, `ka-db-schema`, `ka-test`, `ka-ops` — all execution now goes through `ka-execute`. Two orchestrators independently deciding when a worker skill is safe to invoke was a design conflict, not a feature.
- **Removed** "Auto-executing" default behavior. Every transition now traces back to either a `ka-plan` lock or a `ka-execute`/gate confirmation.
- **Fixed** worker list: added `ka-contract` and `ka-review` (as corresponding skill definitions are now fully implemented), added `ka-test`, renamed `ka-think` references to `ka-plan`.
- **Fixed** `risk` metadata from `low` to `high` — this skill can reach `DEPLOYMENT_GATE` and controls transitions toward production changes.
- **Added** a 3-reset cap on `BLOCKER_RESOLUTION_GATE`'s `--reset-retries`, matching the retry-limit pattern in `ka-execute`.
- **5.0.0**: restructured frontmatter for agentskills.io spec compliance — removed non-standard `auto-trigger-keywords` field (keywords folded into `description`), moved long content to `references/` and `assets/`, added `license`, `compatibility`, `allowed-tools`.
