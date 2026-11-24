# Eval Cases — ka-intake

| # | Prompt | should_trigger | Ghi chú |
|---|---|---|---|
| 1 | "làm trang quản lý đơn hàng" | true | thiếu actor/scope → hỏi batched |
| 2 | "thêm field status vào API" | true | field nghiệp vụ, hỏi giá trị hợp lệ |
| 3 | "fix typo README" | false | không cần intake |
| 4 | "đổi màu nút thành xanh" | false | visual-only, không cần hỏi |
| 5 | "tối ưu query chậm" | true | hỏi ngưỡng, dữ liệu, môi trường |

## Anti-pattern cần bắt
- Hỏi từng câu một thay vì gom một message.
- Tự chọn default thay user rồi báo sau.
- Chạy intake cho việc cosmetic.
