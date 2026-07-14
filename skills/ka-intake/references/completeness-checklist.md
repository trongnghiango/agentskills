# Completeness Checklist

For each request, check these fields. "Material" means: if the AI guessed wrong here, the output would likely be wrong or not what the user wanted — not just cosmetically different.

| Field | Question it answers | Example: material (must ask) | Example: safe to default (don't ask) |
|---|---|---|---|
| **Actor** | Who performs/uses this? | "user báo cáo" — admin hay end-user? Quyền khác nhau hoàn toàn. | Tên biến đại diện actor trong code (`currentUser` vs `user`) |
| **Trigger** | What starts this flow? | "gửi thông báo" — trigger là action của user, cron job, hay webhook? Kiến trúc khác hẳn. | Format log message khi trigger xảy ra |
| **Input** | What data comes in, and from where? | "tính tổng đơn hàng" — input là toàn bộ lịch sử hay chỉ đơn active? Sai thì số liệu sai. | Kiểu dữ liệu nội bộ dùng để cộng (int vs decimal) nếu ngôn ngữ đã ép kiểu rõ |
| **Expected output** | What does "done" produce, in what shape? | "xuất báo cáo" — file Excel, PDF, hay chỉ hiển thị trên UI? | Tên file export mặc định |
| **Success criteria** | How do we know it worked? | "tối ưu tốc độ" — nhanh hơn bao nhiêu, đo bằng gì? Không có mốc thì không biết khi nào dừng. | Ngưỡng log level để debug |
| **Edge cases / exceptions** | What happens when input is empty, invalid, or conflicting? | "hủy đơn hàng" — đơn đã giao rồi thì sao? Không hỏi thì dễ code sai luồng nghiệp vụ. | Message lỗi 404 hiển thị tiếng Anh hay tiếng Việt (nếu app đã có convention) |
| **Constraints** | Performance, security, compliance, budget limits? | "lưu ảnh CMND" — có yêu cầu mã hóa/tuân thủ pháp lý không? Bỏ qua có thể vi phạm luật. | Có nên nén ảnh xuống dưới 500KB nếu không ai yêu cầu cụ thể |
| **Scope boundary** | What is explicitly *not* included? | "thêm tính năng export" — có bao gồm cả import không? Nhầm scope = làm thừa hoặc thiếu. | Có cần thêm nút "Export" vào cả trang mobile nếu app chỉ có web, chưa có mobile |

## How to apply this

1. Go field by field. Most requests will have 5-6 of these already obvious from context (either stated, or unambiguous given the conversation history / existing codebase conventions).
2. Only the fields that are genuinely material AND missing get asked about — this is usually 1-3 fields per request, not all 8.
3. If literally everything is present and unambiguous (a well-specified bug fix, a fully-detailed feature request), there is nothing to ask — proceed directly. This checklist is a filter, not a mandatory questionnaire.
