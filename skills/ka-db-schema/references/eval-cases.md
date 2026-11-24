# Eval Cases — ka-db-schema

| # | Prompt | should_trigger | Ghi chú |
|---|---|---|---|
| 1 | "thêm bảng invoice với quan hệ tenant" | true | schema + index + migration |
| 2 | "đổi kiểu cột amount sang numeric(12,2)" | true | migration an toàn, expand–contract |
| 3 | "thêm index cho tìm kiếm theo phone" | true | composite index |
| 4 | "viết repository query" | false | thuộc `ka-be` |
| 5 | "định nghĩa API response" | false | thuộc `ka-contract` |
