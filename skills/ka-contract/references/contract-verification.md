# Contract Verification — design xong chưa đủ

Thiết kế OpenAPI/Zod chỉ là nửa hợp đồng. Nửa còn lại là chứng minh hai phía còn khớp.

## 1. Consumer-driven (Pact)

1. Consumer test ghi lại interaction thật (request → response mong đợi).
2. Publish pact lên broker.
3. Provider verify: chạy lại interaction trên provider thật.
4. Gate: `can-i-deploy` phải xanh trước khi deploy consumer hoặc provider.

Khi nào dùng: BE và FE deploy độc lập, nhiều consumer (mobile, partner), hoặc API công khai.

## 2. OpenAPI drift check

```bash
# Sinh lại spec từ code rồi so với spec đã commit
<generate-spec> > /tmp/openapi.generated.yaml
diff -u lib/api-spec/openapi.yaml /tmp/openapi.generated.yaml
```

Drift không giải thích được = FAIL. Spec là nguồn sự thật, không phải file trang trí.

## 3. Breaking change checklist

| Thay đổi | Breaking? |
|---|---|
| Xoá field / endpoint | Có |
| Đổi type, đổi tên field | Có |
| Thêm enum value mà client xử lý exhaustive | Có (client crash) |
| Đổi status code / error shape | Có |
| Thêm field optional | Không |
| Thêm endpoint | Không |

Breaking change phải: version mới (`/v2` hoặc header), deprecation window, `Sunset` header, thông báo consumer.

## 4. Exit evidence

- Pact verify / `can-i-deploy` output.
- Diff spec sạch hoặc danh sách breaking change đã được duyệt.
- Orval client build xanh.

Không có evidence → không chuyển `BUILD_DONE`.
