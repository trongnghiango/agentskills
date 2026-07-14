# Eval Cases

Run these whenever `SKILL.md` or `references/trigger-calibration.md` changes. Complements the worked examples in `trigger-calibration.md` with a broader set including Vietnamese keyword false-positive tests.

```json
[
  {"id":1,"prompt":"nên tách User schema ra sao cho dễ mở rộng sau này?","should_trigger":true,"reason":"open-ended structural decision, no fixed target — needs D1-D5 flow"},
  {"id":2,"prompt":"sửa lỗi regex validate email đang sai","should_trigger":false,"reason":"concrete bug fix, clear target, no design ambiguity"},
  {"id":3,"prompt":"hôm nay nên ăn gì","should_trigger":false,"reason":"casual non-technical use of keyword 'nên' — false positive trap"},
  {"id":4,"prompt":"so sánh event-driven và REST cho module thanh toán","should_trigger":true,"reason":"explicit trade-off comparison, cross-module impact"},
  {"id":5,"prompt":"thêm field phone vào bảng User","should_trigger":false,"reason":"single well-scoped schema change — obvious target, no design needed"},
  {"id":6,"prompt":"thiết kế hệ thống notification cho multi-tenant app","should_trigger":true,"reason":"cross-module, multi-tenant, architectural decision — needs competing approaches"}
]
```

## Anti-pattern to catch in eval
A failing response for id 1, 4, 6 is one that skips the Socratic flow (D1-D5) and jumps to implementation — ka-plan exists to prevent premature commitment to a single approach. A failing response for id 2, 3, 5 is one that runs the full D1-D5 design flow for a trivial or non-technical request — over-triggering burns context and delays the user.
