# Eval Cases

Run these whenever `SKILL.md` changes. `ka-contract` is `user-invocable: true` — test both trigger matching and execution behavior.

```json
[
  {"id":1,"prompt":"thiết kế API contract cho module quản lý đơn hàng","should_trigger":true,"reason":"explicit API contract design request — core use case"},
  {"id":2,"prompt":"tạo OpenAPI spec cho endpoint GET /api/v1/products","should_trigger":true,"reason":"OpenAPI specification is contract-first work"},
  {"id":3,"prompt":"viết business logic xử lý thanh toán","should_trigger":false,"reason":"business logic belongs to ka-be, not contract design"},
  {"id":4,"prompt":"thêm column status vào bảng orders","should_trigger":false,"reason":"database schema change belongs to ka-db-schema"},
  {"id":5,"prompt":"(ka-contract generates Zod schemas without checking existing Drizzle schema)","expected_behavior":"should reference database schema or mock specs before deriving DTOs — Guideline #2","description":"Auto-derive DTO rule requires checking source schema first"}
]
```

## Anti-pattern to catch in eval
A failing response for id 3 or 4 executes contract design work for a request that belongs to another skill — scope leak wastes effort and produces misaligned artifacts. A failing response for id 5 generates Zod schemas that don't match the actual database structure — the whole point of contract-first is consistency between layers.
