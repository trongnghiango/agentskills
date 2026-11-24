# Root Cause Playbook

## Reproduce checklist
- [ ] Lệnh repro tối thiểu, chạy lại được
- [ ] Input gây lỗi (kèm dữ liệu thật hoặc factory)
- [ ] Môi trường: OS, runtime, version dependency, biến môi trường, config
- [ ] Log/stack trace đầy đủ, không cắt
- [ ] Tần suất: 100% / theo điều kiện / ngẫu nhiên
- [ ] Thời điểm bắt đầu: sau commit/deploy/config nào

## Hypothesis log (dùng trong suốt quá trình)

| # | Giả thuyết | Thí nghiệm | Kết quả | Kết luận |
|---|---|---|---|---|
| 1 | | | | |

Quy tắc: mỗi hàng phải có khả năng chứng minh SAI. Thí nghiệm không thể fail = vô nghĩa.

## Kỹ thuật thu hẹp
1. **Delta debugging** — bỏ nửa input, giữ nửa còn lại nếu bug vẫn còn.
2. **git bisect** — tìm commit gây lỗi (chỉ trên lịch sử sạch).
3. **Divide & conquer theo tầng** — log ở biên từng tầng (controller → use case → repo → DB) để tìm tầng đầu tiên sai.
4. **So sánh với case chạy được** — khác biệt gì giữa hai input/đường đi.
5. **5 Whys** — sau khi có nguyên nhân gần, hỏi "tại sao" 5 lần để tới gốc.

## Stop rules
- Quá 45 phút không tiến triển → tóm tắt trạng thái, hỏi user hoặc đổi hướng giả thuyết.
- Phải sửa > 3 chỗ mới hết → nghi ngờ thiết kế, đưa về `ka-plan`.
- Bug chạm auth/tenant/tiền → coi là tier 3+, xin xác nhận trước khi sửa.
