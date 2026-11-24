# Performance Audit — đo trước, sửa một thứ, đo lại

## 1. Ngân sách mặc định (chỉnh theo dự án)

| Hạng mục | Ngân sách |
|---|---|
| API p95 (đọc) | < 300ms |
| API p95 (ghi) | < 500ms |
| Query DB | < 50ms |
| Bundle JS ban đầu | < 250KB gzip |
| LCP / INP / CLS | < 2.5s / < 200ms / < 0.1 |

Vượt ngân sách = finding, không phải "cảm giác chậm".

## 2. Dấu hiệu cần soi trong diff

- **N+1**: query trong vòng lặp, `await` trong `.map()`.
- **Unbounded query**: `findMany()` không `limit`/`take`, list không phân trang.
- **Missing index**: filter/sort trên cột không index, đặc biệt composite `(tenant, field)`.
- **Payload bloat**: trả cả entity thay vì DTO, kèm field không dùng.
- **Sync work trong request**: hash nặng, đọc file lớn, gọi API ngoài tuần tự.
- **Re-render**: object/array literal trong deps, không memo danh sách lớn.
- **Waterfall**: fetch tuần tự thay vì song song.

## 3. Công cụ

```bash
# SQL
psql -c "EXPLAIN (ANALYZE, BUFFERS) <query>"

# Node CPU (script)
node --cpu-prof <script> && npx speedscope *.cpuprofile

# HTTP load
k6 run load.js   # threshold p95<300ms, error<1%

# Bundle + web vitals
npx vite-bundle-visualizer
npx lighthouse <url> --preset=desktop
```

## 4. Quy trình

1. Đo baseline (số thật, môi trường gần prod).
2. Xác định nút thắt bằng profile/EXPLAIN, không đoán.
3. Sửa **một** thay đổi, đo lại, ghi delta.
4. Thêm test/regression guard (query count, budget assertion) nếu được.
5. Báo cáo: baseline → sau → ngân sách → còn lại.

## 5. Red flags

- Tối ưu bằng cách thêm cache mà không có invalidation.
- Đổi index mà không kiểm tra write path.
- "Nhanh hơn trên máy tôi" khi chưa đo môi trường thật.
