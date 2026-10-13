# INTERACTIVE E2E & VISUAL SCREENSHOT TESTING PROTOCOL
> Quy trình kiểm thử tương tác thực tế, chụp ảnh màn hình từng giai đoạn (Stage-by-Stage Screenshots) và xuất báo cáo nghiệm thu trực quan.

---

## 1. TRIẾT LÝ: "THẤY MỚI TIN" (VISUAL EVIDENCE OVER DOM CHECKS)
- Đừng chỉ dừng lại ở việc kiểm tra DOM `expect(element).toBeInTheDocument()`.
- Một giao diện có thể render thẻ HTML nhưng bị vỡ layout, bị che khuất bởi modal khác, hoặc hiển thị chữ trắng trên nền trắng.
- **Bắt buộc**: Kiểm thử tương tác như người dùng thực tế và lưu lại bằng chứng thị giác (Screenshots) qua 4 giai đoạn vòng đời.

---

## 2. BỐN GIAI ĐOẠN CHỤP ẢNH BẮT BUỘC (4-STAGE SCREENSHOT PIPELINE)

Mọi kịch bản kiểm thử E2E tương tác phải tự động ghi lại 4 ảnh:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ STAGE 1: TRẠNG THÁI BAN ĐẦU / RỖNG (Initial / Empty State)             │
│ • Kiểm tra: Trang khi chưa có dữ liệu hoặc danh sách rỗng.             │
│ • Kỳ vọng: Hiển thị Empty State đẹp mắt, nút hướng dẫn tạo mới rõ ràng.│
│ • Đường dẫn lưu: `artifacts/screenshots/<feature>_01_empty.png`        │
├────────────────────────────────────────────────────────────────────────┤
│ STAGE 2: TRẠNG THÁI ĐANG THỰC THI (In-Flight / Loading State)          │
│ • Kiểm tra: Khi người dùng bấm nút Submit / Tìm kiếm / Đồng bộ.        │
│ • Kỳ vọng: Nút chuyển sang loading spinner, disabled chống double-click│
│   hoặc hiển thị Skeleton Loader mượt mà.                               │
│ • Đường dẫn lưu: `artifacts/screenshots/<feature>_02_loading.png`      │
├────────────────────────────────────────────────────────────────────────┤
│ STAGE 3: TRẠNG THÁI THÀNH CÔNG (Success / Populated State)             │
│ • Kiểm tra: Dữ liệu đã tải xong hoặc hành động hoàn tất.               │
│ • Kỳ vọng: Toast thông báo thành công xanh lá, bảng hiển thị dữ liệu   │
│   chuẩn xác, badge trạng thái chuyển sang ACTIVE / COMPLETED.          │
│ • Đường dẫn lưu: `artifacts/screenshots/<feature>_03_success.png`      │
├────────────────────────────────────────────────────────────────────────┤
│ STAGE 4: TRẠNG THÁI BIÊN / LỖI (Error / Edge Case State)               │
│ • Kiểm tra: Khi nhập sai form hoặc cố tình ngắt mạng / lỗi server.    │
│ • Kỳ vọng: Thông báo lỗi nhân bản, viền đỏ trường nhập liệu, nút       │
│   thử lại (Retry) hoạt động tốt.                                       │
│ • Đường dẫn lưu: `artifacts/screenshots/<feature>_04_error.png`        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. PLAYWRIGHT E2E SCREENSHOT BLUEPRINT (CHUẨN THỰC THI)

```typescript
// e2e/tests/invoice-sync.e2e.spec.ts
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Invoice Sync Workflow with 4-Stage Screenshots', () => {
  const screenshotDir = path.join(process.cwd(), 'artifacts/screenshots/invoice-sync');

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  test('hoàn thành toàn bộ vòng đời tương tác với đầy đủ bằng chứng ảnh', async ({ page }) => {
    // 1. STAGE 1: INITIAL EMPTY STATE
    await page.goto('/invoices');
    await expect(page.locator('[data-testid="empty-invoice-view"]')).toBeVisible();
    await page.screenshot({ path: `${screenshotDir}/01_empty_state.png`, fullPage: true });

    // 2. STAGE 2: IN-FLIGHT LOADING STATE
    await page.fill('[data-testid="tax-code-input"]', '0318433502');
    const syncBtn = page.locator('[data-testid="sync-invoices-button"]');
    await syncBtn.click();
    // Chụp ngay khoảnh khắc nút chuyển loading và disabled
    await expect(syncBtn).toBeDisabled();
    await page.screenshot({ path: `${screenshotDir}/02_loading_state.png` });

    // 3. STAGE 3: SUCCESS STATE
    await expect(page.locator('[data-testid="invoice-table"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.toast-success')).toBeVisible();
    await page.screenshot({ path: `${screenshotDir}/03_success_state.png`, fullPage: true });

    // 4. STAGE 4: ERROR & RECOVERY STATE
    await page.fill('[data-testid="tax-code-input"]', 'INVALID_TAX_CODE');
    await syncBtn.click();
    await expect(page.locator('.error-banner')).toContainText('Mã số thuế không hợp lệ');
    await page.screenshot({ path: `${screenshotDir}/04_error_state.png` });
  });
});
```

---

## 4. XUẤT BÁO CÁO NGHIỆM THU TRỰC QUAN (MARKDOWN EMBEDDED REPORT)

Sau khi test hoàn tất, kịch bản tự động xuất file báo cáo nghiệm thu tại `artifacts/reports/<feature>_acceptance_report.md` với định dạng Markdown trực quan:

```markdown
# 📸 VISUAL ACCEPTANCE REPORT: [Tên tính năng]
> Ngày nghiệm thu: [YYYY-MM-DD] | Kết quả: PASS | Độ phân giải: 1920x1080 Desktop

### 1. Trạng thái Ban đầu (Stage 1 - Empty State)
![Empty State](<artifacts/screenshots/invoice-sync/01_empty_state.png>)
- *Đánh giá*: Giao diện hiển thị rõ ràng, không có lỗi console, có nút hướng dẫn người dùng bắt đầu.

### 2. Trạng thái Đang xử lý (Stage 2 - Loading State)
![Loading State](<artifacts/screenshots/invoice-sync/02_loading_state.png>)
- *Đánh giá*: Nút bấm bị vô hiệu hóa lập tức, ngăn chặn double-click, hiệu ứng loading mượt mà.

### 3. Trạng thái Thành công (Stage 3 - Success State)
![Success State](<artifacts/screenshots/invoice-sync/03_success_state.png>)
- *Đánh giá*: Bảng dữ liệu hiển thị đúng định dạng tiền tệ VNĐ, badge trạng thái xanh lá.

### 4. Trạng thái Phòng thủ Lỗi (Stage 4 - Error Recovery State)
![Error State](<artifacts/screenshots/invoice-sync/04_error_state.png>)
- *Đánh giá*: Thông báo lỗi nhân bản, không vỡ layout, cho phép người dùng sửa và thử lại.
```
