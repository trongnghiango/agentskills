# POLYGLOT TESTING BLUEPRINTS & ROOT-CAUSE PROTOCOL (TS / PYTHON / GO)
> Bộ cẩm nang thiết kế kiểm thử tự động đa ngôn ngữ theo kim tự tháp 70-20-10 và quy trình sửa lỗi Root-Cause-First.

---

## 1. KIM TỰ THÁP KIỂM THỬ THỰC CHIẾN
- **70% Unit Tests**: Chạy < 1s, kiểm thử Pure Domain Entities, Value Objects, và Pure FSM Engines mà không cần I/O.
- **20% Integration Tests**: Kiểm thử Repository Adapters với Database cục bộ (PGLite / SQLite WAL in-memory).
- **10% E2E & Visual Screenshot Tests**: Kiểm thử toàn trình luồng tương tác thực tế với ảnh chụp 4 giai đoạn.

---

## 2. QUY TRÌNH FIX BUG ROOT-CAUSE-FIRST 5 BƯỚC

```text
[BƯỚC 1: TÁI HIỆN (RED)]   ──► Viết 1 Unit Test mô phỏng chính xác điều kiện lỗi -> Test FAIL.
         │
         ▼
[BƯỚC 2: TRUY VẾT]         ──► Tìm nguyên nhân gốc rễ (Root Cause) trong Domain Model hoặc FSM.
         │
         ▼
[BƯỚC 3: SỬA TẬN GỐC]      ──► Sửa logic tại Domain Invariant / State Engine (Cấm patch if/else ở UI).
         │
         ▼
[BƯỚC 4: XÁC MINH (GREEN)] ──► Chạy lại Unit Test ở Bước 1 -> Test PASS.
         │
         ▼
[BƯỚC 5: HỒI QUY]          ──► Chạy targeted regression tests các luồng lân cận để bảo vệ hệ thống.
```

---

## 3. BLUEPRINTS TRÊN 3 HỆ SINH THÁI

### A. TypeScript: Unit Test cho Pure FSM Engine
```typescript
import { OrderFsmEngine, OrderStatus, OrderEvent } from './order-fsm.engine';

describe('OrderFsmEngine (Pure Domain)', () => {
  it('phải chuyển từ DRAFT sang PENDING_PAYMENT khi nhận sự kiện SUBMIT', () => {
    const result = OrderFsmEngine.transition(OrderStatus.DRAFT, OrderEvent.SUBMIT, {
      actorRole: 'CUSTOMER',
      isPaidInFull: false,
    });
    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toBe(OrderStatus.PENDING_PAYMENT);
  });

  it('phải từ chối chuyển sang PAID nếu chưa thanh toán đủ tiền', () => {
    const result = OrderFsmEngine.transition(OrderStatus.PENDING_PAYMENT, OrderEvent.CONFIRM_PAYMENT, {
      actorRole: 'SYSTEM',
      isPaidInFull: false, // Guard fail
    });
    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe('INSUFFICIENT_PAYMENT');
  });
});
```

### B. Python: Pytest Unit Test cho Value Object & Invariants
```python
import pytest
from domain.entities import TaxCode, InvoiceRecord

def test_tax_code_valid():
    tc = TaxCode("0318433502")
    assert tc.value == "0318433502"
    assert not tc.is_branch

def test_tax_code_invalid_raises_value_error():
    with pytest.raises(ValueError, match="Mã số thuế không hợp lệ"):
        TaxCode("123ABC_INVALID")

def test_invoice_cannot_have_negative_amount():
    tc = TaxCode("0318433502")
    with pytest.raises(ValueError, match="Số tiền hóa đơn không được âm"):
        InvoiceRecord("INV-01", tc, total_amount=-50000.0)
```

### C. Golang: Table-Driven Unit Test
```go
package domain_test

import (
	"testing"
	"myproject/internal/domain"
)

func TestTask_Completion(t *testing.T) {
	tests := []struct {
		name        string
		initialDone bool
		wantErr     bool
	}{
		{"hoàn thành task mới", false, false},
		{"báo lỗi khi task đã xong trước đó", true, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			task, err := domain.NewTask("1", "tenant-1", "Tiêu đề", "Mô tả")
			if err != nil {
				t.Fatalf("khởi tạo thất bại: %v", err)
			}
			if tt.initialDone {
				_ = task.Complete()
			}
			err = task.Complete()
			if (err != nil) != tt.wantErr {
				t.Errorf("Complete() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
```
