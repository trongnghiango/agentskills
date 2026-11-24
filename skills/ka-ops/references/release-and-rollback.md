# Release, Migration & Rollback

## 1. Versioning (semver)

- MAJOR: breaking API/DB contract.
- MINOR: thêm tính năng tương thích ngược.
- PATCH: fix.
- Ghi changelog theo [Keep a Changelog](https://keepachangelog.com): Added / Changed / Deprecated / Removed / Fixed / Security.

## 2. Migration an toàn (expand–contract)

1. **Expand**: thêm cột/bảng mới nullable, không đổi cột cũ.
2. **Dual-write / backfill**: ghi cả hai nơi, backfill theo batch có idempotent.
3. **Switch read** sang mới, theo dõi.
4. **Contract**: xoá cột cũ ở release sau.

Cấm trong một bước: đổi tên cột có dữ liệu, drop cột đang đọc, thêm NOT NULL không default trên bảng lớn.

## 3. Feature flag

- Mỗi thay đổi rủi ro cao nằm sau flag, mặc định off.
- Vòng đời: tạo → bật nội bộ → canary 5% → 50% → 100% → xoá flag (có deadline).
- Flag không xoá = nợ kỹ thuật; ghi ngày xoá khi tạo.

## 4. Canary & verify sau deploy

1. Deploy 1 instance/canary 5%, theo dõi 10–15 phút.
2. Kiểm tra: error rate, p95, 5xx, queue backlog, log lỗi mới.
3. Tăng dần 5 → 50 → 100%.
4. Post-deploy checklist: health endpoint, smoke test luồng chính, dashboard, alert im lặng.

## 5. Rollback

- Code: revert image/tag trước, không sửa tay trên prod.
- DB: forward-only — viết migration đảo nếu cần, không chạy down mù.
- Quyết định rollback khi: error rate > 2× baseline, p95 > 2× ngân sách, mất dữ liệu, lỗi auth/tiền.
- Ghi timeline + nguyên nhân vào `docs/handoff/`.
