# Eval Cases — ka-fe

`ka-fe` implements React/TanStack UI components, hooks, forms, and component/a11y tests.

```json
[
  {"id":1,"prompt":"viết component OrderList với React Query, trạng thái loading/empty/error và test MSW","should_trigger":true,"description":"Core React + TanStack Query + RTL/MSW work"},
  {"id":2,"prompt":"sửa lỗi nút Lưu không disable khi form đang submit ở màn Profile","should_trigger":true,"expected_behavior":"Lite/PATCH — 0 markdown files, no internal hard-stops, RED->GREEN component test + fix","description":"Small UI fix runs without 3 pre-coding hard-stops"},
  {"id":3,"prompt":"viết migration thêm bảng user_sessions trong Postgres","should_trigger":false,"description":"Belongs to ka-db-schema, not ka-fe"},
  {"id":4,"prompt":"(scenario: API payload omits _actions in an SD-UI repo)","should_trigger":null,"expected_behavior":"Graceful degradation to Read-Only Mode — mutating buttons hidden","description":"Never fail open when _actions is undefined"},
  {"id":5,"prompt":"(scenario: component calls fetch() inside useEffect instead of React Query)","should_trigger":null,"expected_behavior":"Flagged by State Separation rule","description":"Server state belongs in React Query hooks"}
]
```
