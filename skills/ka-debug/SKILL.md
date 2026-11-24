---
name: ka-debug
description: "Debugger có kỷ luật. Dùng khi user nói 'debug', 'lỗi', 'bug', 'crash', 'không chạy', 'sai số', 'treo', 'flaky', hoặc test fail không rõ nguyên nhân. Bắt buộc tái hiện trước khi sửa, tìm root cause bằng bisect/giả thuyết, để lại regression test. Do NOT use for code review (ka-review) hoặc viết feature (ka-be/ka-fe)."
license: Proprietary - internal ka-team use only
compatibility: Host-agnostic. Requires shell; no `.agents/` state needed.
metadata:
  version: "1.2.0"
  risk: low
  source: custom-ka-team
user-invocable: true
---

# Systematic Debugger (ka-debug)

> **Language & Interaction Policy**: Investigation logs and commands run in English. User-facing findings match the user's language (Vietnamese when prompted in Vietnamese).

## 1. Nguyên tắc sắt

1. **Không sửa khi chưa tái hiện được.** Không repro = chưa hiểu bug.
2. **Không đoán.** Mỗi giả thuyết phải có một thí nghiệm chứng minh đúng/sai.
3. **Một thay đổi mỗi lần.** Sửa 3 thứ rồi hết lỗi = không biết cái nào cứu.
4. **Root cause, không phải triệu chứng.** Thêm `try/catch` che lỗi là che bug.
5. **Kết thúc bằng test tái hiện** (fail trước, xanh sau) — bàn giao cho `ka-test`.

## 2. Quy trình 5 pha

### Pha 1 — Tái hiện (Reproduce)
- Thu thập: lệnh, input, môi trường, thời điểm, tần suất, log/stack trace đầy đủ.
- Viết kịch bản repro tối thiểu, chạy được bằng 1 lệnh.
- Ghi rõ: luôn xảy ra / theo điều kiện / ngẫu nhiên (flaky).

Chi tiết checklist: `references/root-cause-playbook.md` mục Reproduce.

### Pha 2 — Thu hẹp (Minimize)
- Bỏ dần input/phần code cho đến khi bug vẫn còn (delta debugging).
- Với regression: `git bisect` giữa commit tốt và xấu (theo `git-guardian` — bisect là thao tác WARNING, không tự ý chạy trên branch có thay đổi chưa commit).

### Pha 3 — Giả thuyết (Hypothesis)
- Liệt kê 3–5 nguyên nhân khả dĩ, xếp theo xác suất.
- Với mỗi cái: dự đoán quan sát được nếu đúng, rồi kiểm tra.
- Ghi bảng: giả thuyết | thí nghiệm | kết quả | kết luận. Không nhảy sang fix khi chưa loại trừ.

### Pha 4 — Sửa + regression test
- Viết test tái hiện bug, chạy thấy RED đúng bug.
- Sửa nguyên nhân gốc, không che triệu chứng.
- GREEN, rồi chạy lại toàn bộ test liên quan.

### Pha 5 — Báo cáo
```
Root cause: <1 câu>
Bằng chứng: <log/test/output>
Phạm vi ảnh hưởng: <module, dữ liệu, user>
Fix: <file:line, mô tả>
Regression test: <file:line>
Phòng ngừa: <test bổ sung / guard / lint rule>
```

## 3. Bảng chống ngụy biện

| Ngụy biện | Thực tế |
|---|---|
| "Chắc do cache, restart thử" | Restart chỉ chứng minh state bẩn, không chứng minh nguyên nhân. |
| "Thêm try/catch cho khỏi crash" | Che lỗi, bug quay lại ở tầng khác. |
| "Sửa tạm, để sau" | Bug tạm thường thành bug vĩnh viễn. Bắt buộc issue + test. |
| "Test fail do flaky" | Kiểm tra trước khi đổ lỗi: chạy 3 lần, xem log race. |
| "Chạy được trên máy tôi" | Môi trường là biến số, so sánh version/dep/config. |

## 4. Flaky / race
- Chạy lặp 10–20 lần, ghi thời điểm fail.
- Tìm shared state, clock, thứ tự async, network, DB isolation.
- Không tăng timeout để "hết flaky" trừ khi có bằng chứng tải thật.
- Theo `ka-test` mục Flaky policy: quarantine, healer tối đa 3 lần, rồi escalate.

## 5. Ranh giới
- Không tự sửa ngoài phạm vi bug; không refactor kèm (tách PR).
- Không chạy lệnh phá huỷ (`reset --hard`, `clean -fd`) — theo `git-guardian`.
- Bug do thiết kế sai → dừng, đưa về `ka-plan`.

## 6. Postmortem (SEV1/SEV2)

Sau khi khắc phục sự cố nghiêm trọng, viết postmortem theo `templates/POSTMORTEM.md` (nằm ngay trong thư mục skill này), lưu `docs/postmortems/<yyyy-mm-dd>-<slug>.md`:
- Dòng thời gian lấy từ nhật ký điều tra Pha 3, không viết lại từ trí nhớ.
- Nguyên nhân gốc kỹ thuật, không phải "ai đó quên".
- Action item có owner + hạn, map sang test/alert/runbook.
