# Eval Cases — ka-test

Chạy các prompt sau để kiểm tra routing và hành vi. Kỳ vọng: skill load đúng, TDD loop được nêu, evidence được đòi.

| # | Prompt | should_trigger | Ghi chú |
|---|---|---|---|
| 1 | "viết test cho module thanh toán" | true | test-first, hỏi case biên |
| 2 | "fix bug này rồi thêm test" | true | test tái hiện trước khi sửa |
| 3 | "coverage đang 40%, làm sao tăng" | true | coverage là tín hiệu, không phải mục tiêu |
| 4 | "test này flaky, chạy lại là xanh" | true | quarantine, tìm race, không re-run |
| 5 | "set up Playwright và CI" | false | thuộc `ka-ops` |
| 6 | "review PR này" | false | thuộc `ka-review` |

## Anti-pattern cần bắt được khi eval

- Nhận viết test sau khi code đã xong mà không có RED.
- Đề xuất tăng coverage bằng test trivial.
- Sửa test để pass thay vì sửa code.
- Đề xuất `skip`/`retry` cho flaky.
