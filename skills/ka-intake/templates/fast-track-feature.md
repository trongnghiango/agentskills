# ⚡ FAST-TRACK FEATURE SPECIFICATION TEMPLATE
> Sử dụng template này khi cần triển khai tính năng mới thần tốc mà KHÔNG cần qua phỏng vấn Socratic lòng vòng.
> AI Agent khi nhận template này sẽ tự động suy luận các chi tiết kỹ thuật an toàn, khóa `decisions.json` và kích hoạt tự hành ngay lập tức.

---

## 1. THÔNG TIN CỐT LÕI (CORE INPUT)
- **Tên tính năng (Feature Name)**: [VD: Tra cứu hóa đơn tự động / Phê duyệt đơn hàng qua Telegram]
- **Tác nhân chính (Actor)**: [VD: Admin / Kế toán / End-User / Cron Worker / System]
- **Điều kiện kích hoạt (Trigger)**: [VD: Người dùng bấm nút trên UI / Nhận webhook từ Cổng Thuế / Đơn hàng chuyển trạng thái APPROVED]
- **Dữ liệu đầu vào (Input Payload)**: [VD: `{ orderId: string, reason?: string }` hoặc dải ngày tháng `fromDate`, `toDate`]
- **Kết quả mong đợi (Expected Output)**: [VD: Bản ghi được cập nhật trạng thái, phát hành sự kiện Domain Event, trả về DTO chuẩn]

## 2. RÀNG BUỘC NGHIỆP VỤ & BẢO VỆ (BUSINESS INVARIANTS & RESILIENCE)
- **Quy tắc bất biến (Invariants)**: [VD: Chỉ đơn hàng ở trạng thái PENDING mới được duyệt; Số tiền thanh toán không được âm]
- **Bảo vệ Idempotency (Trùng lặp)**: [VD: Khóa theo `requestId` hoặc `idempotencyKey`; Bấm 2 lần liên tiếp không trừ tiền 2 lần]
- **Xử lý khi lỗi mạng / đối tác (Failure Handling)**: [VD: Lưu vào bộ đệm SQLite Outbox / Kích hoạt Circuit Breaker sau 3 lần lỗi]

## 3. PHẠM VI RANH GIỚI (SCOPE BOUNDARY)
- **Trong Scope (In-Scope)**: [VD: API Backend + Use Case + Pure FSM + UI 4 trạng thái]
- **Ngoài Scope (Out-of-Scope)**: [VD: Không làm phần phân quyền tùy biến; Không làm xuất PDF ở đợt này]

## 4. TIÊU CHÍ HOÀN THÀNH (DEFINITION OF DONE)
- [ ] Domain Model & FSM thuần 100% không dính framework.
- [ ] Hàm nghiệp vụ $\le 40-50$ dòng (Single Screen Rule), không dùng `any`.
- [ ] 100% Unit test cho Domain/Use Case pass.
- [ ] Visual UI Test chụp ảnh 4 trạng thái (nếu có UI).
- [ ] Không có Dead code (Zero Ghost Methods).
