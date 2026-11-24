# Eval Cases — ka-debug

| # | Prompt | should_trigger | Ghi chú |
|---|---|---|---|
| 1 | "app crash khi upload file lớn" | true | repro trước, tìm root cause |
| 2 | "test này lúc xanh lúc đỏ" | true | flaky, tìm race, không retry mù |
| 3 | "số liệu tháng 8 lệch 3 đồng" | true | điều tra dữ liệu, không hardcode |
| 4 | "viết feature mới" | false | thuộc `ka-be` |
| 5 | "review diff" | false | thuộc `ka-review` |
