# Observability Baseline

## 1. Log

- JSON structured: `ts, level, service, env, request_id, user_id (hash), route, status, latency_ms, error_code`.
- Không log PII/token/mật khẩu.
- Mỗi request một `request_id`, truyền qua mọi tầng (header `x-request-id`).

## 2. Metrics (RED / USE)

| Loại | Metric |
|---|---|
| RED (request) | Rate, Errors, Duration (p50/p95/p99) theo route |
| USE (resource) | Utilization, Saturation, Errors cho DB/queue/CPU |
| Business | đơn tạo thành công, đăng nhập fail, job backlog |

## 3. Trace

- Span cho: HTTP handler → use case → DB query → external call.
- Gắn `request_id`/`trace_id` vào log.
- Cảnh báo khi span ngoài > 20% tổng latency.

## 4. SLI/SLO

- SLI: tỉ lệ request thành công + latency dưới ngưỡng.
- SLO ví dụ: 99.5% request < 300ms trong 30 ngày.
- Error budget: 0.5% → dùng để quyết định dừng feature hay ưu tiên ổn định.

## 5. Alert

- Alert theo triệu chứng người dùng thấy (5xx, p95, SLO burn), không theo CPU đơn thuần.
- Mỗi alert phải có: runbook, ngưỡng, thời gian giữ, người nhận.
- Sau deploy: xem dashboard 15 phút, không rời màn hình.

## 6. Checklist cho service mới

- [ ] Health/readiness endpoint
- [ ] Structured log + request id
- [ ] RED metrics + dashboard
- [ ] Trace cho luồng chính
- [ ] Alert 5xx + latency + backlog
- [ ] Runbook ngắn trong repo
