# Eval Cases

Run these whenever `SKILL.md` or `references/gates.md` changes.

```json
[
  {"id":1,"prompt":"đang ở bước nào rồi?","should_trigger":true,"reason":"user asking about current workflow state — core use case of ka-workflow"},
  {"id":2,"prompt":"tiếp theo làm gì?","should_trigger":true,"reason":"user asking for next step in the lifecycle — state machine query"},
  {"id":3,"prompt":"resume lại feature auth đang làm dở","should_trigger":true,"reason":"resuming an in-progress feature requires reading state.json and advancing"},
  {"id":4,"prompt":"sửa lỗi typo trong file login.ts dòng 42","should_trigger":false,"reason":"concrete bug fix with clear target — no lifecycle tracking needed"},
  {"id":5,"prompt":"giải thích Clean Architecture cho tôi","should_trigger":false,"reason":"knowledge question, not a feature lifecycle action"},
  {"id":6,"prompt":"feature payment đã xong BE review chưa? chuyển sang FE được không?","should_trigger":true,"reason":"explicitly asking about gate status and requesting state transition"}
]
```

## Anti-pattern to catch in eval
A failing response for id 1, 2, 3, 6 is one that skips state store query (`state-manager.js get`) and proceeds directly to implementation — ka-workflow must always check current state before acting. A failing response for id 4, 5 is one that loads the state machine when no lifecycle tracking is relevant — over-triggering wastes context tokens and confuses the user.
