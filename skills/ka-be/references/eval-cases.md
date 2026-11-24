# Eval Cases

Run these whenever `SKILL.md` changes. `ka-be` is `user-invocable: false` — these cases test behavior when routed from `ka-execute`.

```json
[
  {"id":1,"prompt":"/ka-execute backend '{\"feature\":\"auth\",\"details\":\"Fix login validation regex\"}'","expected_behavior":"PATCH_MODE — single file fix with regression test, no full analysis cycle","description":"Simple bug fix should route to PATCH_MODE, not STANDARD_MODE"},
  {"id":2,"prompt":"/ka-execute backend '{\"feature\":\"orders\",\"details\":\"Add order cancellation with state machine and event publishing\"}'","expected_behavior":"STANDARD_MODE or COMPLEX_MODE — full analysis, implementation plan, dynamic checklist, walkthrough","description":"Multi-concern feature requiring analysis and planning steps"},
  {"id":3,"prompt":"(ka-be receives options with feature touching 3+ modules and requiring ADR)","expected_behavior":"COMPLEX_MODE — writes ADR at docs/adr/, yields to coordinator for ADR approval before coding","description":"Cross-module feature must trigger COMPLEX_MODE gate"},
  {"id":4,"prompt":"(ka-be walkthrough output)","expected_behavior":"MUST include Security & Isolation Code Diff section showing tenant query filters and test assertions","description":"Every walkthrough must prove tenant isolation — missing this section is a blocker"},
  {"id":5,"prompt":"(ka-be implementation imports @nestjs/common in domain entity)","expected_behavior":"Domain Purity violation — Commandment #1 forbids framework imports in domain layer","description":"Exit check must catch framework imports in domain entities"}
]
```

## Anti-pattern to catch in eval
A failing response for id 1 runs the full STANDARD_MODE cycle for a simple patch — wasting tokens and user time. A failing response for id 4 produces a walkthrough without the Security & Isolation Code Diff section — this is the single most important audit artifact ka-be produces.
