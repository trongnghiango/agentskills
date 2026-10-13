# POLYGLOT CONTRACT-FIRST SPECIFICATION BLUEPRINT (TS / PYTHON / GO)
> Chuẩn hóa hợp đồng giao tiếp giữa Frontend và Backend, giữa các Microservices, và loại bỏ hoàn toàn việc "đoán mò API".

---

## 1. PHÂN ĐỊNH 3 TẦNG DỮ LIỆU BẤT BIẾN (DECISION D2)

```text
       NGOÀI (Boundary) ◄──────────────► TRUNG GIAN (App) ◄──────────────► TRONG CÙNG (Core)
       
  ┌─────────────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐
  │   1. PUBLIC CONTRACTS   │      │ 2. APPLICATION COMMANDS │      │    3. DOMAIN ENTITIES   │
  │   (Zod / Pydantic / Go) │      │   & QUERIES (Internal)  │      │    & VALUE OBJECTS      │
  ├─────────────────────────┤      ├─────────────────────────┤      ├─────────────────────────┤
  │ - Request/Response DTOs │ ──►  │ - Plain Structs/Classes │ ──►  │ - Rich Entities         │
  │ - DÙNG CHUNG: FE ↔ BE   │      │ - Gom thêm Auth Context │      │ - Pure Business Rules   │
  │ - Strict Sanitization   │      │   (actorId, tenantId)   │      │ - Invariants / State    │
  │ - KHÔNG chứa context ẩn │      │ - KHÔNG export ra FE    │      │ - Độc lập 100%          │
  └─────────────────────────┘      └─────────────────────────┘      └─────────────────────────┘
```

1. **Public Contracts (Request/Response DTOs)**:
   - Nằm ở package chung (VD: `packages/contracts/` hoặc `shared/contracts/`).
   - Khai báo Schema chặt chẽ cho: `Params`, `Query`, `Body`, và `Response`.
   - **CẤM**: Truyền `tenantId` hoặc `actorId` trong Body/Query của Public Contract (Gateway tự trích xuất từ JWT/ALS).
2. **Application Commands/Queries (Internal DTOs)**:
   - Nằm trong thư mục `application/` của Backend.
   - Gom dữ liệu từ Request DTO cộng thêm context bảo mật (`actorId`, `tenantId`, `actorRoles`).
3. **Domain Entities**:
   - Nằm trong `domain/`. Tuyệt đối không bao giờ trả thẳng Entity ra ngoài API.

---

## 2. CHUẨN GIAO THỨC TRẢ VỀ (CANONICAL API ENVELOPES)

### A. Phản hồi Thành công (Success Response Envelope)
```json
{
  "success": true,
  "data": {
    "id": "HD-260812-001",
    "contractNumber": "HD-260812-0318433502",
    "totalAmount": 15000000,
    "status": "PENDING_APPROVAL",
    "_actions": {
      "canApprove": true,
      "canEdit": false,
      "canDelete": false
    }
  },
  "meta": {
    "timestamp": "2026-10-13T10:00:00.000Z"
  }
}
```

### B. Phản hồi Lỗi Chuẩn hóa (Flat Error Structure)
```json
{
  "success": false,
  "statusCode": 422,
  "errorCode": "DOMAIN_VALIDATION_ERROR",
  "message": "Số tiền thanh toán vượt quá số nợ còn lại của hóa đơn",
  "errors": [
    { "field": "amount", "issue": "Giá trị tối đa được phép là 5,000,000 VNĐ" }
  ],
  "path": "/api/v1/invoices/INV-01/pay",
  "timestamp": "2026-10-13T10:00:00.000Z"
}
```

---

## 3. THỰC THI TRÊN 3 HỆ SINH THÁI (TS, PYTHON, GO)

### A. TypeScript (Zod Contract)
```typescript
import { z } from 'zod';

export const CreateInvoiceRequestSchema = z.object({
  taxCode: z.string().regex(/^[0-9]{10}(-[0-9]{3})?$/, 'Mã số thuế không hợp lệ'),
  items: z.array(z.object({
    description: z.string().min(1, 'Mô tả không được để trống'),
    unitPrice: z.number().positive('Đơn giá phải lớn hơn 0'),
    quantity: z.number().int().positive('Số lượng phải là số nguyên dương'),
  })).min(1, 'Hóa đơn phải có ít nhất 1 dòng hàng'),
});

export type CreateInvoiceRequest = z.infer<typeof CreateInvoiceRequestSchema>;
```

### B. Python (Pydantic v2 Contract)
```python
from pydantic import BaseModel, Field, field_validator
from typing import List
import re

class InvoiceItemDTO(BaseModel):
    description: str = Field(min_length=1)
    unit_price: float = Field(gt=0)
    quantity: int = Field(gt=0)

class CreateInvoiceRequestDTO(BaseModel):
    tax_code: str
    items: List[InvoiceItemDTO] = Field(min_length=1)

    @field_validator('tax_code')
    def validate_tax_code(cls, v: str) -> str:
        if not re.match(r"^[0-9]{10}(-[0-9]{3})?$", v):
            raise ValueError('Mã số thuế không hợp lệ')
        return v
```

### C. Golang (Validator v10 Contract)
```go
package contract

type InvoiceItemDTO struct {
	Description string  `json:"description" validate:"required,min=1"`
	UnitPrice   float64 `json:"unitPrice" validate:"required,gt=0"`
	Quantity    int     `json:"quantity" validate:"required,gt=0"`
}

type CreateInvoiceRequestDTO struct {
	TaxCode string           `json:"taxCode" validate:"required,len=10|len=14"`
	Items   []InvoiceItemDTO `json:"items" validate:"required,min=1,dive"`
}
```
