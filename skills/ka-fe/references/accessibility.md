# Accessibility (WCAG 2.2 AA)

## 1. Checklist bắt buộc

- [ ] Semantic HTML: `button`, `a`, `label`, `nav`, `main`, heading đúng cấp.
- [ ] Mọi input có `<label htmlFor>` hoặc `aria-label`; lỗi gắn `aria-describedby`.
- [ ] Keyboard: mọi action làm được bằng Tab/Enter/Space/Esc; không bẫy focus.
- [ ] Focus visible: không `outline: none` mà không thay thế.
- [ ] Contrast: text ≥ 4.5:1, UI lớn ≥ 3:1.
- [ ] Ảnh có `alt` (trang trí thì `alt=""`), icon-only button có `aria-label`.
- [ ] Trạng thái động: `aria-live="polite"` cho toast/loading, `role="alert"` cho lỗi.
- [ ] Modal: focus trap + Esc + trả focus về trigger.
- [ ] Không chỉ dùng màu để truyền đạt trạng thái.
- [ ] `prefers-reduced-motion` cho animation lớn.

## 2. Test

```tsx
// Ưu tiên query theo role/label — vừa test hành vi vừa test a11y
const btn = screen.getByRole('button', { name: /lưu/i })
```

- `@testing-library/jest-dom` + `jest-axe` / `vitest-axe`: `expect(await axe(container)).toHaveNoViolations()`.
- Thủ công: chỉ dùng bàn phím đi hết luồng chính, đọc bằng screen reader 1 lần cho luồng quan trọng.

## 3. Red flags

- `div onClick` thay vì `button`.
- `aria-label` trùng nhau cho nhiều nút ("Sửa" × 10) — thêm ngữ cảnh.
- `tabIndex` dương.
- Placeholder thay cho label.
- Toast lỗi không được thông báo cho screen reader.
