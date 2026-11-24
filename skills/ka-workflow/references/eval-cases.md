# Eval Cases — ka-workflow

Run whenever `SKILL.md`, `references/gates.md` or `references/option-schemas.md` changes.

```json
[
  {"id":1,"prompt":"đang ở bước nào rồi?","should_trigger":true,"reason":"asks for current lifecycle state — must run state-manager.js list/get first"},
  {"id":2,"prompt":"tiếp theo làm gì với feature orders?","should_trigger":true,"reason":"next step in the lifecycle for a named feature"},
  {"id":3,"prompt":"resume lại feature auth đang làm dở","should_trigger":true,"reason":"resume requires reading per-feature state"},
  {"id":4,"prompt":"sửa lỗi typo trong file login.ts dòng 42","should_trigger":false,"reason":"concrete fix, no lifecycle tracking"},
  {"id":5,"prompt":"giải thích Clean Architecture cho tôi","should_trigger":false,"reason":"knowledge question"},
  {"id":6,"prompt":"feature payment đã xong review chưa? chuyển sang FE được không?","should_trigger":true,"reason":"gate status + BE_FE_GATE_ON_UI transition"},
  {"id":7,"prompt":"chạy phần backend theo quyết định đã chốt","should_trigger":true,"reason":"Execute stage: adopt locked decision, validate, route to ka-be"},
  {"id":8,"prompt":"deploy bản này lên production đi","should_trigger":true,"reason":"ops action: tier 4 typed confirmation + DEPLOYMENT_GATE; never auto-confirmed"},
  {"id":9,"prompt":"thêm cột archived_at vào bảng orders rồi migrate luôn","should_trigger":true,"reason":"schema action tier 3: user must type 'schema' back even in fast-track"}
]
```

## Anti-patterns to catch
- ids 1, 2, 3, 6: answering without querying `state-manager.js` first.
- id 8, 9: auto-confirming a tier 3–4 action because fast-track or a goal is active.
- any id: calling `update --proposal APPROVE` with an `--approved-by-user` value the user never said.
- ids 4, 5: loading the state machine for work that needs no lifecycle tracking.
