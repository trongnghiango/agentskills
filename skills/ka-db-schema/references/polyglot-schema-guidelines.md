# POLYGLOT DATABASE SCHEMA & DRIFT GOVERNANCE BLUEPRINT
> Hướng dẫn thiết kế Schema cơ sở dữ liệu quan hệ, Indexing đa tầng, kiểm soát Schema Drift và bảo vệ tính bất biến của dữ liệu.

---

## 1. NGUYÊN TẮC THIẾT KẾ SCHEMA BẤT DI BẤT DỊCH
1. **Khóa Ngoại & Ràng buộc toàn vẹn (Foreign Key Constraints)**:
   - Mọi quan hệ giữa các bảng phải có Foreign Key tường minh với quy tắc xóa (`onDelete: 'restrict'` hoặc `'cascade'`).
   - Cấm foreign key ảo (chỉ lưu ID mà không có ràng buộc DB level).
2. **Index Bắt buộc theo Mẫu Truy vấn (Query-Driven Composite Indexing)**:
   - Mọi bảng multi-tenant bắt buộc có Composite Index bao gồm trường tenant và trường lọc/sắp xếp:
     `index("idx_invoices_tenant_status").on(table.tenantId, table.status)`
     `index("idx_invoices_tenant_created").on(table.tenantId, table.createdAt)`
3. **Bảo vệ Tính Bất biến (Financial Immutability)**:
   - Với bảng tài chính, kế toán, hóa đơn: **CẤM XÓA CỨNG (Hard Delete)**.
   - Bắt buộc lưu lịch sử chỉnh sửa hoặc áp dụng mô hình Append-Only Event Ledger.
4. **Kiểm soát Schema Drift (Zero-Drift Rule)**:
   - Trước khi commit thay đổi DB, bắt buộc chạy kiểm tra lệch schema giữa Code ORM và DB thực tế (`drizzle-kit check`, `alembic check`).

---

## 2. BLUEPRINTS TRÊN 3 HỆ SINH THÁI (TS / PYTHON / GO)

### A. TypeScript — Drizzle ORM Blueprint
```typescript
import { pgTable, text, timestamp, numeric, pgEnum, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const invoiceStatusEnum = pgEnum('invoice_status', ['DRAFT', 'ISSUED', 'PAID', 'CANCELLED']);

export const invoices = pgTable('invoices', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  invoiceNumber: text('invoice_number').notNull(),
  totalAmount: numeric('total_amount', { precision: 18, scale: 2 }).notNull(),
  status: invoiceStatusEnum('status').default('DRAFT').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tenantNumberIdx: uniqueIndex('idx_invoices_tenant_number').on(table.tenantId, table.invoiceNumber),
  tenantStatusIdx: index('idx_invoices_tenant_status').on(table.tenantId, table.status),
  tenantCreatedIdx: index('idx_invoices_tenant_created').on(table.tenantId, table.createdAt),
}));
```

### B. Python — SQLAlchemy / SQLite WAL Blueprint
```python
from sqlalchemy import Column, String, Numeric, Enum, DateTime, Index
from sqlalchemy.orm import declarative_base
import enum
from datetime import datetime

Base = declarative_base()

class InvoiceStatusEnum(enum.Enum):
    DRAFT = "DRAFT"
    ISSUED = "ISSUED"
    PAID = "PAID"
    CANCELLED = "CANCELLED"

class InvoiceModel(Base):
    __tablename__ = "invoices"

    id = Column(String, primary_key=True)
    tenant_id = Column(String, nullable=False)
    invoice_number = Column(String, nullable=False)
    total_amount = Column(Numeric(18, 2), nullable=False)
    status = Column(Enum(InvoiceStatusEnum), default=InvoiceStatusEnum.DRAFT, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("idx_invoices_tenant_status", "tenant_id", "status"),
        Index("idx_invoices_tenant_created", "tenant_id", "created_at"),
    )
```

### C. Golang / Raw PostgreSQL Migration Blueprint
```sql
CREATE TYPE invoice_status AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'CANCELLED');

CREATE TABLE invoices (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    invoice_number TEXT NOT NULL,
    total_amount NUMERIC(18, 2) NOT NULL,
    status invoice_status NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_invoices_tenant_number ON invoices(tenant_id, invoice_number);
CREATE INDEX idx_invoices_tenant_status ON invoices(tenant_id, status);
CREATE INDEX idx_invoices_tenant_created ON invoices(tenant_id, created_at);
```
