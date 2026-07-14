# Eval Cases

Run these through `claude-with-access-to-the-skill` (or the internal skill-creator harness) to verify behavior after any change to `SKILL.md` or `option-schemas.md`.

```json
[
  {"id":1,"prompt":"/ka-execute backend '{\"feature\":\"auth\",\"details\":\"Add JWT login\"}'","expected_output_contains":"feat(auth): implement JWT login","description":"Execute a backend plan for JWT authentication"},
  {"id":2,"prompt":"/ka-execute frontend '{\"page\":\"dashboard\",\"features\":[\"charts\",\"filters\"]}'","expected_output_contains":"Created React component Dashboard","description":"Execute a frontend plan for a dashboard UI"},
  {"id":3,"prompt":"/ka-execute ops '{\"env\":\"production\",\"action\":\"deploy\"}'","expected_output_contains":"Type \"ops\" to confirm","description":"Ops actions must require typed confirmation, not plain yes/no"},
  {"id":4,"prompt":"(decisions.json present with status locked, unconsumed)","expected_output_contains":"Tìm thấy quyết định đã chốt từ ka-plan","description":"Handoff from ka-plan is surfaced before asking for action/options"},
  {"id":5,"prompt":"/ka-execute schema '{\"table\":\"users\"}'","expected_output_contains":"Missing/invalid field(s)","description":"Schema action missing required change_type must be rejected at Step 4b, not routed"},
  {"id":6,"prompt":"/ka-execute ops '{\"env\":\"production\",\"action\":\"deploy\"}'","expected_output_contains":"Missing/invalid field(s)","description":"Production ops deploy without rollback_plan must fail schema validation"}
]
```

## Description-optimization loop

After any change to `SKILL.md`'s `description` field, generate ~20 trigger queries (mix of should-trigger / should-not-trigger), run `run_loop.py` from `skill-creator`, adopt the `best_description`, and update the front-matter.
