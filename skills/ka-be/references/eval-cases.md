# Eval Cases — ka-be

`ka-be` is routed from `ka-workflow` (Execute stage) or matched for backend implementation work. Cases include both trigger checks and behavioral checks `(scenario: ...)`.

```json
[
  {"id":1,"prompt":"viết use case hủy đơn hàng trong module orders theo Clean Architecture","should_trigger":true,"description":"Backend use case & domain invariant implementation"},
  {"id":2,"prompt":"sửa bug validate email trong AuthService kèm regression test","should_trigger":true,"expected_behavior":"Lite/PATCH mode — 0 extra .md planning files, RED->GREEN test + minimal fix","description":"Small backend fix uses Lite/PATCH proportionality"},
  {"id":3,"prompt":"thiết kế OpenAPI spec và sinh Orval client cho orders","should_trigger":false,"description":"Belongs to ka-contract, not ka-be"},
  {"id":4,"prompt":"(scenario: multi-tenant backend change in Full mode)","should_trigger":null,"expected_behavior":"One consolidated docs/context/<feature>/be_walkthrough.md including Security & Isolation Code Diff + state-manager.js test RED/GREEN","description":"Full mode produces 1 walkthrough with tenant isolation proof, not 4 filler docs"},
  {"id":5,"prompt":"(scenario: domain entity imports @nestjs/common or drizzle-orm in Full mode)","should_trigger":null,"expected_behavior":"Rejected by Domain Purity commandment #1","description":"Domain layer stays framework-free in Full mode"}
]
```
