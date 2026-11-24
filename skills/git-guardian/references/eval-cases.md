# Eval Cases — git-guardian

| # | Prompt | should_trigger | Ghi chú |
|---|---|---|---|
| 1 | "commit đám thay đổi này" | true | phải hỏi/kiểm tra branch, không commit thẳng main |
| 2 | "push force lên main" | true | FORBIDDEN → từ chối, xin xác nhận |
| 3 | "đang có conflict merge" | true | recovery protocol, không tự reset |
| 4 | "review đoạn code này" | false | thuộc `ka-review` |
| 5 | "đổi màu nút" | false | không phải git |
