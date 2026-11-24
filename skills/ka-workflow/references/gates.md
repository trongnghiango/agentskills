# Gates — Full Descriptions

Gates are enforced by `.agents/scripts/state-manager.js`, not by prompt discipline alone:

| Mechanism | workflow.json field | What the script checks | Exit code on refusal |
|---|---|---|:-:|
| Human approval | `"approval": "human"` (optionally `approval_for`) | `--approved-by-user "<user reply, verbatim>"` present; appended to `.agents/memory/approvals.log` | 4 |
| Test evidence | `"verify": "test_runs"` | a RED run (exit ≠ 0) and a later GREEN run (exit 0) that **the script itself executed** via `state-manager.js test` | 2 / 3 |

> [!IMPORTANT]
> `--approved-by-user` must contain the user's actual reply. Never fill it from your own inference, a previous turn, or a generic "approved". The audit log makes fabricated approvals visible in review; treat a fabricated approval as a drift incident.

## Gate list

* **`ADR_APPROVAL_ON_COMPLEX`** (state `ADR_GATE`, human): when `route == COMPLEX_MODE`, present the ADR (`docs/adr/ADR-<n>-<slug>.md`, template in `../ka-plan/templates/ADR.md`). An ADR without "Options considered" or "Consequences" is not approvable.
* **`TEST_EVIDENCE_GATE`** (state `TEST_GATE`, script-verified): every build action (`EXECUTE_BE/FE/SCHEMA/CONTRACT/TEST`) lands here — there is no path from build to review that skips tests.
  ```bash
  node .agents/scripts/state-manager.js test --feature <slug> --phase red   --cmd "pnpm vitest run src/orders"   # must fail
  # ...implement...
  node .agents/scripts/state-manager.js test --feature <slug> --phase green --cmd "pnpm vitest run src/orders"   # must pass
  node .agents/scripts/state-manager.js update --feature <slug> --proposal PASS --cases "cancel delivered order; cancel twice"
  ```
  No RED is possible (pure refactor, config, docs, styling)? Use `--skip-red "<reason>"` **with** `--approved-by-user`. A RED run recorded after a GREEN run invalidates that GREEN. See `../ka-test/references/tdd-loop.md`.
* **`REVIEW_GATE`** (human): present the walkthrough/diff (backend: must contain the **Security & Isolation Code Diff** section). Transitions: `APPROVE`/`SUCCESS_NO_UI` → `BUILD_DONE`, `SUCCESS_WITH_UI` → `BE_FE_GATE_ON_UI`, `REQUEST_CHANGES` → `LOCKED_DECISION`. In `full` profile run a `ka-review` pass before presenting.
* **`BE_FE_GATE_ON_UI`** (human): approve starting frontend work. `APPROVE` → `LOCKED_DECISION` (then `EXECUTE_FE`), `SKIP_UI` → `BUILD_DONE`.
* **`DEPLOYMENT_GATE`** (human): every `ops` action passes here, including `EXECUTE_OPS` straight from `LOCKED_DECISION`. Present env + rollback plan; this is in addition to the tier-4 type-to-confirm in the Execute stage of `ka-workflow`.
* **`COMPLETION_GATE`** (human): show the final walkthrough; `APPROVE` → `READY_TO_ARCHIVE`, `REQUEST_CHANGES` → `LOCKED_DECISION`.
* **`BLOCKER_RESOLUTION_GATE`** (state `BLOCKED`, human): entered after 3 `FAILURE` proposals in one state, a failed deploy, or a `FAIL` at the test gate. Resume with
  ```bash
  node .agents/scripts/state-manager.js update --feature <slug> --proposal RESUME_PATCH --reset-retries --approved-by-user "<reply>"
  ```
  **Max 3 resets per state per feature.** The 4th reset returns the feature to the initial state — re-examine the design instead of retrying.

## Batching human gates (practicality)

Human gates exist to get a decision, not to generate turns. When two gates are adjacent and nothing changes between them, present them in **one** message and apply both transitions with the same reply:

| Situation | One message covers |
|---|---|
| PATCH / fast-track with no UI and no deploy | `REVIEW_GATE` + `COMPLETION_GATE` |
| Backend done, UI already agreed in the plan | `REVIEW_GATE (SUCCESS_WITH_UI)` + `BE_FE_GATE_ON_UI` |

Never batch `ADR_GATE`, `DEPLOYMENT_GATE`, or `BLOCKER_RESOLUTION_GATE` with anything else.

## Transition keys reference

| Key | Proposed by | Meaning |
|---|---|---|
| `PLAN_PATCH` / `PLAN_STANDARD` / `PLAN_COMPLEX` / `PLAN_FAST_TRACK` | ka-plan | Decision locked at that scale |
| `EXECUTE_BE` / `EXECUTE_FE` / `EXECUTE_SCHEMA` / `EXECUTE_CONTRACT` / `EXECUTE_TEST` | ka-workflow (Execute stage) | Worker finished; go verify tests |
| `EXECUTE_OPS` | ka-workflow (Execute stage) | Ops requested; go to deployment gate |
| `PASS` / `FAIL` | ka-test / worker | Test gate result |
| `APPROVE` / `REJECT` / `REQUEST_CHANGES` | user, via the agent | Human gate decision |
| `SUCCESS_WITH_UI` / `SUCCESS_NO_UI` | ka-be (approved by user) | Review approved, with/without UI follow-up |
| `NEXT_STEP` | ka-workflow | More build work in the same feature |
| `FAILURE` | any worker | Counts a retry; 3 → `BLOCKED` |

When adding a worker skill, register its keys here and in `workflow.json`.

## Profiles

| Profile | File | States | Use for |
|---|---|---|---|
| `full` | `runtime-templates/workflow.json` | design → ADR → build → test → review → deploy → completion | multi-module products, money/auth/tenant data |
| `lite` | `runtime-templates/workflow.lite.json` | in-progress → test → completion (+ deploy gate) | small repos, scripts, solo work |

## Changelog

- **6.0.0**: human gates require `--approved-by-user` + audit log; test gate accepts only script-executed runs (`--evidence` removed); every build action goes through `TEST_GATE`; `EXECUTE_OPS` can no longer skip `DEPLOYMENT_GATE`; `BE_REVIEW_GATE` → `REVIEW_GATE`; per-feature state (`--feature`); `lite` profile; gate batching rules.
- **5.0.0**: all execution routed through a single router; 3-reset cap on `BLOCKER_RESOLUTION_GATE`.
