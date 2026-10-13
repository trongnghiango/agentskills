# FAST-TRACK REQUIREMENTS & ZERO-BABYSITTING SPECIFICATIONS
> Cẩm nang kích hoạt chế độ tự hành thần tốc trên DeepSeek Harness (DSH). Loại bỏ hoàn toàn việc phỏng vấn vòng vo khi đã có yêu cầu rõ ràng.

---

## 1. KHI NÀO SỬ DỤNG FAST-TRACK MODE?
- Khi bạn muốn đẩy nhanh tiến độ triển khai tính năng hoặc vá lỗi.
- Khi bạn đã có sẵn ý tưởng, chỉ cần AI thực thi sạch sẽ từ đầu đến cuối mà không ngắt quãng để hỏi từng câu nhỏ.

---

## 2. BỐN TEMPLATE MẪU FAST-TRACK

| Mẫu Template | Vị trí file trong `agentskills` | Mục đích sử dụng |
| :--- | :--- | :--- |
| **1. Tính năng Mới** | `skills/ka-intake/templates/fast-track-feature.md` | Dựng Use Case, FSM, UI 4 trạng thái cho tính năng mới. |
| **2. Vá lỗi Khẩn cấp** | `skills/ka-intake/templates/fast-track-hotfix.md` | Root-Cause-First 5 bước: Viết test fail -> Sửa gốc -> Test pass. |
| **3. Worker / Xử lý Nền** | `skills/ka-intake/templates/fast-track-worker.md` | Tác vụ chạy nền, hàng đợi BullMQ/Celery, Outbox, chống nghẽn node. |
| **4. Tái cấu trúc Kiến trúc** | `skills/ka-intake/templates/fast-track-refactor.md` | Bẻ gãy phụ thuộc vòng, Single Screen Rule, Registry Pattern. |

---

## 3. CÁCH KÍCH HOẠT NHANH TRÊN DEEPSEEK HARNESS (DSH)
Chỉ cần gửi prompt kèm từ khóa:
> *"Kích hoạt Fast-Track tự hành cho tính năng [Tên tính năng]. Thông tin cốt lõi: Actor: [X], Trigger: [Y], Input: [Z], Output: [W]. Triển khai Clean Architecture và tự kiểm thử đến cùng."*

Hoặc dán nội dung từ template đã điền:
- `ka-intake` phát hiện cờ Fast-Track -> **Bỏ qua toàn bộ câu hỏi Socratic**.
- `ka-plan` tổng hợp giải pháp trong 1 turn -> Khóa `decisions.json`.
- `ka-workflow` gọi `create_goal` trên DSH -> Kích hoạt vòng lặp tự hành 100%.
- Subagent `ka-review` audit độc lập -> Báo cáo bằng chứng nghiệm thu kèm ảnh screenshots.
