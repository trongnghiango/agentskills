# TDD Loop — Bắt buộc cho mọi code production

## Iron Law

**KHÔNG viết code production khi chưa có một test fail chứng minh hành vi đó là cần.**

Không có ngoại lệ "chắc chắn đúng rồi". Nếu chưa thấy test fail, chưa biết test có kiểm tra đúng thứ mình nghĩ hay không.

## Vòng lặp

1. **RED** — viết một test nhỏ nhất mô tả hành vi mong muốn. Chạy. Dán output fail (`expected` vs `actual`).
2. **GREEN** — viết code tối thiểu để test pass. Không thêm nhánh, tham số, abstraction chưa có test đòi.
3. **REFACTOR** — dọn code và test khi đang xanh. Chạy lại toàn bộ test liên quan.
4. Lặp lại cho hành vi tiếp theo. Commit test + code cùng nhau.

Quy tắc phụ:
- Mỗi vòng ≤ 15 phút. Lâu hơn nghĩa là test đang mô tả quá nhiều hành vi — tách nhỏ.
- Test phải chạy độc lập, không phụ thuộc thứ tự.
- Test mới fail vì lý do đúng (thiếu hành vi), không fail vì lỗi cú pháp hay import.

## Biến thể

### Bug fix
1. Viết test tái hiện bug, chạy và **thấy nó fail đúng bug đó**.
2. Sửa code đến khi xanh.
3. Test này ở lại làm regression test vĩnh viễn.

Không nhận bug fix khi không có bước 1.

### Legacy / code chưa có test
1. **Characterization test**: viết test ghi lại hành vi hiện tại (kể cả hành vi xấu), chạy xanh.
2. Refactor dưới lưới an toàn đó.
3. Chỉ sau khi refactor xong mới siết assertion theo hành vi đúng.

### Spike / prototype
Được bỏ TDD khi code sẽ bị xoá (throwaway). Trước khi merge: xoá spike hoặc viết lại test-first.

## Evidence cho TEST_EVIDENCE_GATE

Gate chỉ PASS khi có đủ:
1. Lệnh test đã chạy.
2. Output **RED** trước khi sửa (dán nguyên văn dòng fail).
3. Output **GREEN** sau khi sửa.
4. Danh sách case đã thêm/sửa + coverage delta (nếu CI có coverage).

Thiếu mục 2 với feature mới hoặc bug fix → FAIL, quay lại `LOCKED_DECISION`.

## Common Rationalizations

| Ngụy biện | Thực tế |
|---|---|
| "Test xong viết sau cũng được, giờ code trước cho nhanh" | Test viết sau chỉ kiểm tra code đã viết, không kiểm tra hành vi cần có. Bỏ sót case là mặc định. |
| "Hàm này đơn giản, không cần test" | Hàm đơn giản sai âm thầm nhất. Test 5 dòng rẻ hơn 1 giờ debug. |
| "Tôi đã thử tay rồi, chạy đúng" | Thử tay không để lại regression test, lần sau sửa là mất. |
| "Coverage 90% rồi là đủ" | Coverage đếm dòng chạy, không đếm hành vi đúng. Ưu tiên case biên và lỗi. |
| "Chỉ sửa 1 dòng, khỏi test" | Một dòng là chỗ hay sai nhất. Test tái hiện trước, sửa 1 dòng, xanh. |
| "Test cũ fail, sửa test cho xanh" | Chỉ được sửa test khi spec đổi, và phải ghi lý do trong commit. |

## Red Flags — STOP

- Test chưa từng fail (chưa chứng kiến RED).
- Assert trên mock call thay vì trên behavior/kết quả.
- Test pass dù xoá code production.
- Test phụ thuộc `Date.now()`, random, mạng, thứ tự chạy.
- Thêm `expect` yếu (`.toBeDefined()`) để đủ số lượng.
- Nới lỏng assertion để xanh thay vì sửa code.
- Chạy lại test flaky đến khi xanh thay vì tìm nguyên nhân.
