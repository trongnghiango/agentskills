# ⚡ FAST-TRACK HOTFIX / BUG RESOLUTION TEMPLATE
> Sử dụng template này khi cần vá lỗi khẩn cấp mà KHÔNG cần phỏng vấn lòng vòng.
> AI Agent bắt buộc áp dụng quy trình Root-Cause-First 5 bước: Viết test fail -> Sửa root cause -> Test pass.

---

## 1. MÔ TẢ LỖI (BUG SYMPTOM)
- **Hành vi lỗi thực tế (Actual Bug)**: [VD: Khi bấm lưu hợp đồng lần 2 thì bị lỗi 500 duplicate key / Worker cào thuế bị treo khi gặp captcha xấu]
- **Hành vi kỳ vọng (Expected Behavior)**: [VD: Trả về kết quả thành công mà không tạo bản ghi trùng lặp / Tự ngắt mạch sau 3 lần fail]
- **Các bước tái hiện (Reproduction Steps)**:
  1. [Bước 1: Gọi endpoint hoặc trigger event...]
  2. [Bước 2: Gửi payload...]
  3. [Bước 3: Quan sát thấy lỗi ném ra...]

## 2. DẤU VẾT & LOGS (ERROR TRACE)
- **File & Vùng nghi vấn**: [VD: `src/modules/accounting/use-cases/pay-invoice.ts:45`]
- **Stack trace / Log lỗi**:
  ```text
  [Dán log hoặc mã lỗi vào đây]
  ```

## 3. RÀNG BUỘC SỬA CHỮA (FIX CONSTRAINTS)
- [ ] **CẤM BÙA CODE**: Tuyệt đối không thêm `if/else` chắp vá hoặc try/catch nuốt lỗi (swallow exception).
- [ ] **ROOT-CAUSE FIRST**: Sửa tận gốc tại Domain Invariant hoặc State Engine, không sửa bề mặt Controller/UI.
- [ ] **REGRESSION PROOF**: Phải có 1 Unit Test tái hiện lỗi trước khi sửa (Test-First Red).
