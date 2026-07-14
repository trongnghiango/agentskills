# Eval Cases

Run these whenever `SKILL.md` or `completeness-checklist.md` changes.

```json
[
  {"id":1,"prompt":"hủy đơn hàng #1234","should_ask":true,"missing_field":"edge_cases","reason":"không rõ đơn đã giao hay chưa - ảnh hưởng luồng xử lý"},
  {"id":2,"prompt":"sửa lỗi typo 'sucess' thành 'success' trong file login.ts dòng 42","should_ask":false,"reason":"mọi field đều rõ ràng, không có gì material để hỏi"},
  {"id":3,"prompt":"thêm tính năng export báo cáo","should_ask":true,"missing_field":"expected_output, scope_boundary","reason":"không rõ định dạng file, không rõ có bao gồm import không"},
  {"id":4,"prompt":"lưu ảnh CMND của user vào hệ thống","should_ask":true,"missing_field":"constraints","reason":"dữ liệu nhạy cảm, cần hỏi yêu cầu mã hóa/tuân thủ trước khi code"},
  {"id":5,"prompt":"đổi màu button submit từ xanh sang đỏ","should_ask":false,"reason":"yêu cầu cụ thể, không có field nghiệp vụ nào còn thiếu"},
  {"id":6,"prompt":"tối ưu tốc độ trang dashboard","should_ask":true,"missing_field":"success_criteria","reason":"không có mốc đo lường, không biết khi nào coi là xong"},
  {"id":7,"prompt":"(decisions.json đã có status locked cho request này)","should_ask":false,"reason":"intake coi như đã hoàn tất từ trước, không hỏi lại"}
]
```

## Anti-pattern to catch in eval
A failing response for id 1, 3, 4, 6 is one that proceeds directly to `ka-workflow`/`ka-plan` without asking — that's the AI silently filling a material gap with its own assumption, which is exactly what `ka-intake` exists to prevent. A failing response for id 2, 5, 7 is one that asks unnecessary questions about non-material details — that's over-triggering, which erodes trust in the questions that do matter.
