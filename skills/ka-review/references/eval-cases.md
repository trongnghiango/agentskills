# Eval Cases — ka-review

| # | Prompt | should_trigger | Ghi chú |
|---|---|---|---|
| 1 | "review diff này trước khi merge" | true | chạy matrix + security depth |
| 2 | "kiểm tra có lỗi tenant isolation không" | true | blocker |
| 3 | "code này có phải ghost code không" | true | knip/ts-prune |
| 4 | "viết test cho module này" | false | thuộc `ka-test` |
| 5 | "deploy lên staging" | false | thuộc `ka-ops` |

## Anti-pattern cần bắt
- Kết luận PASS mà không chạy lệnh nào.
- Bỏ qua authz vì "endpoint đã có guard".
- Không nêu `file:line`.
