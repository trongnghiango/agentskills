# Refactoring & Legacy Code

## 1. Khi nào refactor, khi nào không

| Tình huống | Hành động |
|---|---|
| Cần sửa bug trong code rối | Characterization test trước, sửa tối thiểu |
| Thêm feature vào module rối | Refactor cục bộ quanh điểm chạm, không refactor toàn bộ |
| Module chết/không còn dùng | Xoá (Ghost Code rule), không refactor |
| Rewrite toàn bộ | Chỉ khi có ADR + lý do chi phí, ưu tiên strangler |

## 2. Characterization test (bắt buộc trước khi chạm code cũ)

1. Viết test ghi lại hành vi **hiện tại**, kể cả hành vi xấu.
2. Chạy xanh.
3. Refactor dưới lưới an toàn.
4. Chỉ sau khi refactor xong mới siết assertion theo hành vi đúng (nếu spec đổi).

Không có characterization test = không được refactor code chưa có test.

## 3. Strangler fig (thay dần)

1. Xác định seam: interface/port mà code cũ đi qua.
2. Dựng implementation mới song song sau cùng interface.
3. Route một phần traffic/case sang mới (flag).
4. So sánh output hai bên (shadow/diff) trước khi chuyển hết.
5. Xoá code cũ + flag khi 100%.

## 4. Quy tắc commit refactor

- Refactor tách commit khỏi feature/fix.
- Test xanh trước và sau; không đổi behavior trong commit refactor.
- Mỗi commit ≤ 400 dòng diff; commit lớn thì tách theo module.
- Không refactor khi đang fix bug (trừ refactor tối thiểu để test được).

## 5. Exit checklist

- [ ] Characterization test có trước khi sửa.
- [ ] Behavior không đổi (trừ khi spec đổi, có ghi chú).
- [ ] Không còn code chết/flag cũ.
- [ ] Domain purity + import boundary vẫn đúng.
