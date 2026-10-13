# Completeness Checklist & Heuristic Decision Matrix

Tài liệu này xác định ranh giới giữa: **Bắt buộc phải hỏi** (Material gap), **Tự suy luận an toàn từ codebase** (Codebase deducible), và **Kích hoạt Fast-Track** (Bypass questioning).

---

## 1. BẢNG TIÊU CHÍ ĐÁNH GIÁ 8 TRƯỜNG DỮ LIỆU

| Trường dữ liệu | Bản chất nghiệp vụ | Khi nào BẮT BUỘC hỏi (Material) | Khi nào TỰ SUY LUẬN (Safe to default) |
|---|---|---|---|
| **1. Actor** | Ai là người thực hiện? | Quyền hạn khác nhau (Admin vs Khách hàng) làm thay đổi logic bảo vệ. | Đã có ngữ cảnh JWT session hoặc module hiện tại chỉ phục vụ 1 role duy nhất. |
| **2. Trigger** | Cơ chế kích hoạt luồng? | Không rõ là User bấm nút, Cron job chạy nền, hay Webhook đối tác. | Đã chỉ rõ route HTTP REST hoặc component UI cụ thể. |
| **3. Input** | Dữ liệu đầu vào từ đâu? | Thiếu cấu trúc dữ liệu hoặc không rõ phạm vi truy vấn (All vs Active). | Đã có Zod Schema hoặc DTO hiện hữu trong module. |
| **4. Expected Output** | Kết quả đầu ra là gì? | Không rõ định dạng (File Excel/PDF hay chỉ là JSON API trả về). | Đã có convention trả lời của API (`{ success, data, error }`). |
| **5. Success Criteria** | Tiêu chí nghiệm thu? | Yêu cầu định tính mơ hồ ("tối ưu hiệu năng", "làm cho nhanh hơn"). | Yêu cầu định lượng rõ (Unit test pass, lỗi 500 biến mất, trả về 200). |
| **6. Edge Cases** | Khi lỗi hoặc xung đột? | Luồng nghiệp vụ có trạng thái hủy, hoàn tiền, rớt mạng đối tác. | Lỗi cú pháp validation schema (Zod tự bắt lỗi 400). |
| **7. Constraints** | Ràng buộc bảo mật/hạ tầng?| Dữ liệu nhạy cảm (mật khẩu, CCCD, khóa bí mật) cần mã hóa. | Quy ước format code, naming conventions theo linter của repo. |
| **8. Scope Boundary**| Giới hạn phạm vi? | Tính năng lớn dễ phình to (VD: làm Export có kèm Import không?). | Sửa một hàm nhỏ, một component UI đơn lập. |

---

## 2. NGUYÊN TẮC HỎI SOCRATIC THÔNG MINH (ANTI-ANNOYANCE)

Nếu có trường bị thiếu và thực sự thuộc nhóm **Material**:
1. **Tuyệt đối không hỏi câu hỏi mở chung chung**: Thay vì hỏi *"Bạn muốn xử lý lỗi thế nào?"*, hãy đưa ra phương án trắc nghiệm:
   ```text
   🗣️ Để hoàn thiện tính năng [X], cần thống nhất xử lý khi mất mạng:
   • [A (Recommended)] Ghi nhận vào SQLite Outbox và tự động thử lại ngầm (Offline Resilience).
   • [B] Báo lỗi ngay lập tức ra màn hình và hủy giao dịch.
   ```
2. **Khống chế tối đa 2 vòng hỏi**: Nếu sau 2 vòng vẫn chưa có câu trả lời rõ ràng, Agent **tự chọn phương án Recommended**, ghi chú rõ giả định và tiếp tục làm việc.
3. **Quy tắc Fast-Track Override**: Nếu request có chứa template điền sẵn hoặc chứa từ khóa `fast-track`, `tự hành`, `làm ngay` $\longrightarrow$ **BỎ QUA 100% CÂU HỎI**, tự áp dụng các giá trị Recommended!
