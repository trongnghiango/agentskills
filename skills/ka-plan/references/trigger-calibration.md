# Trigger Calibration

`ka-plan`'s `description` carries the trigger keywords directly (per the agentskills.io spec: descriptions should include specific keywords that help agents identify relevant tasks). No separate keyword list field is used — matching happens on the semantic content of `description`.

Several of those keywords are extremely common in everyday Vietnamese ("nên", "hay là") and can false-trigger on casual, non-technical questions. Use the "goal is NOT obvious" test below rather than keyword presence alone.

## Worked examples: is the goal obvious?

- **Obvious (do NOT trigger ka-plan)**: "sửa lỗi validate email bị sai regex" — concrete bug, concrete fix target.
- **Not obvious (trigger ka-plan)**: "nên xử lý validate email kiểu gì cho chuẩn" — no fixed target, comparing approaches.
- **Obvious**: "thêm field `phone` vào bảng User" — single, well-scoped schema change.
- **Not obvious**: "user schema nên tách ra sao cho tương lai dễ mở rộng" — open-ended structural decision.

## Eval set (should-trigger / should-not-trigger)

```json
[
  {"id":1,"prompt":"nên tách User schema ra sao cho dễ mở rộng sau này?","should_trigger":true,"reason":"open-ended structural decision, no fixed target"},
  {"id":2,"prompt":"sửa lỗi regex validate email đang sai","should_trigger":false,"reason":"concrete bug fix, clear target, no design ambiguity"},
  {"id":3,"prompt":"hôm nay nên ăn gì","should_trigger":false,"reason":"casual non-technical use of 'nên', not a design question"},
  {"id":4,"prompt":"so sánh event-driven và REST cho module thanh toán","should_trigger":true,"reason":"explicit trade-off comparison, cross-module impact"}
]
```

Run this set through the `skill-creator` description-optimization loop whenever `description` changes, to catch new false positives/negatives before shipping.
