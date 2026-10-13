# ⚡ FAST-TRACK BACKGROUND WORKER & INTEGRATION SPEC TEMPLATE
> Sử dụng template này để thiết kế các worker chạy nền (BullMQ, Celery, Go Goroutines), cào dữ liệu, xử lý hàng đợi, đồng bộ dữ liệu ngoại vi mà không làm nghẽn node.

---

## 1. THÔNG SỐ TÁC VỤ NỀN (BACKGROUND JOB PROFILE)
- **Tên Worker / Queue**: [VD: `tax-sync-worker` / Queue: `tax-sync-queue`]
- **Công nghệ & Runtime**: [VD: Python uvloop / Node.js BullMQ / Go Priority Pool]
- **Nguồn kích hoạt (Trigger)**: [VD: Định kỳ Cron mỗi 15 phút / Job bắn từ Monolith HTTP / Telegram Webhook]
- **Tải trọng công việc (Job Payload)**: [VD: `{ mst: string, dateRange: { from: string, to: string }, priority: number }`]

## 2. KHẢ NĂNG KHÁNG LỖI & CHỐNG NGHẼN NODE (RESILIENCE & ANTI-BOTTLENECK)
- **Cơ chế Idempotency**: [VD: Job ID = hash(mst + dateRange) -> Tránh chạy trùng lặp]
- **Bảo vệ tài nguyên & Concurrency**:
  - Tối đa bao nhiêu concurrent jobs? [VD: 2 workers per CPU core]
  - Timeout cho mỗi job: [VD: 60s]
  - Rate limit với bên ngoài: [VD: 1 req/giây cho mỗi tài khoản, tối đa 30 req/giây toàn hệ thống]
- **Cơ chế ngắt mạch (Circuit Breaker)**: [VD: Sau 3 lần lỗi liên tiếp (sai pass/captcha) -> Đổi status sang OPEN, tạm dừng 15 phút, gửi cảnh báo khẩn cấp]
- **Bền vững ngoại tuyến (Offline Buffer)**: [VD: Ghi kết quả vào SQLite WAL Outbox trước khi đẩy về máy chủ chính]

## 3. TIÊU CHÍ HOÀN THÀNH (DEFINITION OF DONE)
- [ ] Không block Event Loop (Node.js) / Không gây CPU starvation (Go/Python).
- [ ] Giải phóng toàn bộ tài nguyên (Browser session, HTTP connections, DB pool) khi kết thúc job.
- [ ] Đầy đủ cơ chế Graceful Shutdown (Xử lý xong job dở dang khi nhận SIGTERM).
- [ ] Unit Test cho Worker Use Case & Outbox State Machine.
