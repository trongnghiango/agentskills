# Test Design Catalog — Chọn tầng & case bắt buộc

## 1. Chọn tầng test

| Tầng | Phạm vi | Ngân sách | Không được làm |
|---|---|---|---|
| Unit | 1 hàm/entity, không I/O | < 5ms/test | DB, mạng, filesystem, clock thật |
| Integration | module + DB/HTTP thật (PGLite, testcontainers) | < 200ms/test | mock repository rồi gọi nó |
| E2E | luồng người dùng qua UI/API thật | < 30s/luồng | lạm dụng e2e cho logic |
| Contract | consumer ↔ provider | nhanh | coi contract test thay integration |

**Layer decision**: nếu unit/component test bắt được hành vi → không viết E2E cho nó. E2E chỉ cho luồng không thể chứng minh ở tầng thấp hơn.

## 2. Case bắt buộc theo loại thay đổi

| Thay đổi | Case bắt buộc |
|---|---|
| Domain logic / Entity / FSM | happy path, error path, boundary (min/max/empty), invariant bất biến, transition sai thứ tự |
| Repository / query | tenant isolation (đọc và ghi), unique constraint violation, transaction rollback, not-found |
| API endpoint | 2xx, 400 validation, 401/403 authz, 404, 409 conflict, 500 có kiểm soát |
| Frontend component | empty, loading, success, error, dữ liệu dài (overflow), a11y role/label |
| Migration | up chạy trên schema cũ, down/rollback, backfill idempotent |
| Bug fix | test tái hiện đúng bug (fail trước, xanh sau) |

## 3. Quy ước viết

- Tên: `should <behavior> when <condition>`.
- Arrange — Act — Assert, một hành vi mỗi test.
- Assert trên kết quả quan sát được; không assert số lần gọi mock trừ khi đó là hợp đồng.
- Dùng factory/builder cho dữ liệu; seed cố định; không `Date.now()`, `Math.random()`, `uuid()` trong test trừ khi đang test chính thứ đó.
- Data layer: dùng DB thật/in-memory, không mock repository.
- Mỗi test phải có ít nhất một assertion thất bại được khi hành vi sai.

## 4. Flaky policy

1. Test flaky → quarantine ngay, mở issue kèm log.
2. Sửa nguyên nhân gốc (race, clock, network, shared state).
3. Healer/thử lại tối đa 3 lần, sau đó escalate — cấm chạy lại đến khi xanh.
4. Không `skip` vĩnh viễn không ghi lý do.

## 5. Coverage policy

- Coverage là tín hiệu, không phải mục tiêu.
- Ngưỡng tối thiểu: domain + application layer 80% branch; phần còn lại theo quyết định trong `test_plan`.
- Không tăng coverage bằng test trivial. Với code rủi ro cao (auth, tiền, tenant), dùng mutation score ≥ 80% nếu dự án có Stryker/pitest.
