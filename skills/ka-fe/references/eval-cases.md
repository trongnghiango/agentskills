# Eval Cases

Run these whenever `SKILL.md` changes. `ka-fe` is `user-invocable: false` — these cases test behavior when routed from `ka-execute`.

```json
[
  {"id":1,"prompt":"(ka-fe receives handoff with 03_be_walkthrough.md present in docs/context/)","expected_behavior":"Handoff-driven mode — extracts contract paths, schemas, and _actions from walkthrough before starting","description":"Context Handoff Check must detect and use existing BE walkthrough"},
  {"id":2,"prompt":"(ka-fe receives options but no handoff file exists)","expected_behavior":"Independent mode — proceeds with API Contract Alignment from shared/contracts/ or src/api/generated/","description":"Missing handoff should not block FE work, just switch mode"},
  {"id":3,"prompt":"(API response missing _actions field)","expected_behavior":"Graceful Degradation — hide all mutating buttons, render Read-Only Mode","description":"Missing _actions must never fail-open with visible edit/delete buttons"},
  {"id":4,"prompt":"(ka-fe Step 1 analysis completed)","expected_behavior":"HARD STOP — must print 'Vui lòng gõ OK để tôi tiến hành thiết kế kiến trúc FE' and wait","description":"Skipping hard-stop at Step 1 risks building on unvalidated UI assumptions"},
  {"id":5,"prompt":"(ka-fe implementation uses raw fetch() instead of React Query hook)","expected_behavior":"Commandment #1 violation — data fetching must use custom hooks wrapping React Query","description":"Exit verification must catch raw fetch/axios usage outside React Query"}
]
```

## Anti-pattern to catch in eval
A failing response for id 3 renders action buttons when `_actions` is undefined — this is a security-sensitive UI leak. A failing response for id 4 skips the hard-stop and proceeds directly to implementation plan — the user loses the opportunity to correct UI assumptions early.
