# Eval Cases for ka-intake

Run these test cases to verify intake boundary calibration.

```json
[
  {
    "id": 1,
    "prompt": "hủy đơn hàng #1234",
    "should_ask": true,
    "missing_field": "edge_cases",
    "reason": "Không rõ đơn đã giao hay chưa - ảnh hưởng trực tiếp đến trạng thái FSM"
  },
  {
    "id": 2,
    "prompt": "sửa lỗi typo 'sucess' thành 'success' trong file login.ts dòng 42",
    "should_ask": false,
    "reason": "Mọi field đều rõ ràng, không có gì material để hỏi"
  },
  {
    "id": 3,
    "prompt": "thêm tính năng export báo cáo hóa đơn",
    "should_ask": true,
    "missing_field": "expected_output, scope_boundary",
    "reason": "Không rõ file Excel 5 sheet hay CSV, không rõ có kèm import không"
  },
  {
    "id": 4,
    "prompt": "lưu ảnh CMND của user vào hệ thống",
    "should_ask": true,
    "missing_field": "constraints",
    "reason": "Dữ liệu nhạy cảm cá nhân, cần xác nhận mã hóa S3 và quyền truy cập"
  },
  {
    "id": 5,
    "prompt": "đổi màu button submit từ xanh sang đỏ",
    "should_ask": false,
    "reason": "Yêu cầu UI cục bộ, không có rủi ro nghiệp vụ"
  },
  {
    "id": 6,
    "prompt": "tối ưu tốc độ trang dashboard",
    "should_ask": true,
    "missing_field": "success_criteria",
    "reason": "Không có mốc đo lường định lượng (<200ms hay <500ms?)"
  },
  {
    "id": 7,
    "prompt": "decisions.json đã có status locked cho request này",
    "should_ask": false,
    "reason": "Intake đã hoàn tất từ trước, khóa quyết định rồi"
  },
  {
    "id": 8,
    "prompt": "fast-track: thêm endpoint GET /api/v1/invoices/summary trả về tổng tiền và số lượng theo tháng, actor là Kế toán, test bằng Jest",
    "should_ask": false,
    "reason": "Có cờ fast-track và đã cung cấp đủ thông tin cốt lõi -> Bypass hỏi, thực thi ngay"
  },
  {
    "id": 9,
    "prompt": "áp dụng template fast-track-hotfix.md sửa lỗi race condition khi bấm nút pay hai lần",
    "should_ask": false,
    "reason": "Sử dụng fast-track template -> Tự động áp dụng Idempotency Key và thực thi TDD"
  }
]
```

## Anti-patterns to catch in eval:
- **Under-triggering**: Tiêu cực bỏ qua câu hỏi khi request mơ hồ, tự ý code giả định nguy hiểm.
- **Over-interrogating**: Hỏi vặt những chi tiết kỹ thuật mà codebase đã có quy ước rõ ràng.
- **Ignoring Fast-Track**: Vẫn hỏi lòng vòng dù người dùng đã gửi template hoặc yêu cầu làm ngay.
