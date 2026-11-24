# Eval Cases — ka-execute (alias)

Only explicit `/ka-execute` invocations should route here; natural-language execution requests belong to `ka-workflow`. Behavior is defined by `ka-workflow` §4.

```json
[
  {"id":1,"prompt":"/ka-execute backend '{\"feature\":\"auth\",\"details\":\"Add JWT login\"}'","should_trigger":true,"expected_behavior":"validate schema, tier 2, route to ka-be, propose EXECUTE_BE","description":"Alias forwards a valid backend action"},
  {"id":2,"prompt":"/ka-execute frontend '{\"page\":\"dashboard\",\"features\":[\"charts\",\"filters\"]}'","should_trigger":true,"expected_behavior":"tier 1, route to ka-fe without extra confirmation","description":"Low-risk action is not slowed down by confirmations"},
  {"id":3,"prompt":"/ka-execute ops '{\"env\":\"production\",\"action\":\"deploy\",\"rollback_plan\":\"revert to v1.2.3\"}'","should_trigger":true,"expected_behavior":"tier 4: user must type 'ops' and confirm env + rollback; then EXECUTE_OPS lands on DEPLOYMENT_GATE","description":"Ops always requires typed confirmation, even in fast-track"},
  {"id":4,"prompt":"/ka-execute schema '{\"table\":\"users\"}'","should_trigger":true,"expected_output_contains":"change_type","description":"Missing required change_type must be rejected before routing"},
  {"id":5,"prompt":"/ka-execute ops '{\"env\":\"production\",\"action\":\"restart\"}'","should_trigger":true,"expected_output_contains":"rollback_plan","description":"Production ops without rollback_plan fails schema validation"}
]
```
