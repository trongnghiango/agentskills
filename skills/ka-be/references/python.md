# Python Clean / Hexagonal Architecture Blueprint

This blueprint describes the specific implementation standards for Python 3.11+ backend services, workers, and CLI applications (as established in `tax-service-portal`).

---

## 1. Technical Stack & Patterns

| Layer | Standard Tools & Libraries | Architectural Constraint |
| :--- | :--- | :--- |
| **Domain Core** | Pure Python, `dataclasses(frozen=True)`, Domain Exceptions | **100% PURE**. CẤM import `fastapi`, `sqlite3`, `curl_cffi`, `pydantic-settings`, network I/O. |
| **Ports (Interfaces)**| `typing.Protocol` hoặc `abc.ABC` + `@abstractmethod` | Định nghĩa giao kèo trừu tượng cho Repositories, Network, Alert, Exporters. |
| **Application Layer** | Use Case classes, Commands, Queries, DTOs | Nhạc trưởng điều phối, Single Screen Rule ($\le 40-50$ dòng/hàm). Không gọi trực tiếp DB adapter. |
| **Adapters Layer** | FastAPI routers, SQLite WAL Outbox, curl_cffi clients, BullMQ/Redis workers | Chuyển đổi hai chiều: ORM/DB Row $\leftrightarrow$ Domain Entity $\leftrightarrow$ Output DTO. |
| **Composition Root** | `container.py` (Manual DI) | Khởi tạo adapters và tiêm (inject) vào Use Cases. |
| **Type Safety** | `mypy --strict` | 100% hàm có type annotations đầy đủ. Cấm dùng `Any` vô tội vạ. |

---

## 2. Standard Code Blueprints

### A. Pure Domain Entity & Value Object (Python)
```python
# src/domain/entities.py
from dataclasses import dataclass
from typing import Optional
import re

@dataclass(frozen=True)
class TaxCode:
    value: str

    def __post_init__(self) -> None:
        cleaned = self.value.strip()
        if not re.match(r"^[0-9]{10}(-[0-9]{3})?$", cleaned):
            raise ValueError(f"Mã số thuế không hợp lệ: {self.value}")
        object.__setattr__(self, "value", cleaned)

class InvoiceRecord:
    def __init__(self, invoice_id: str, tax_code: TaxCode, total_amount: float):
        if total_amount < 0:
            raise ValueError("Số tiền hóa đơn không được âm")
        self._invoice_id = invoice_id
        self._tax_code = tax_code
        self._total_amount = total_amount
        self._is_synced = False

    @property
    def invoice_id(self) -> str:
        return self._invoice_id

    @property
    def is_synced(self) -> bool:
        return self._is_synced

    def mark_as_synced(self) -> None:
        self._is_synced = True
```

### B. Outbound Port Interface (Protocol)
```python
# src/ports/invoice_storage.py
from typing import Protocol, Optional
from domain.entities import InvoiceRecord

class IInvoiceStoragePort(Protocol):
    def find_by_id(self, invoice_id: str) -> Optional[InvoiceRecord]:
        ...

    def save(self, record: InvoiceRecord) -> None:
        ...
```

### C. Application Use Case (Single Screen Rule $\le 40$ dòng)
```python
# src/use_cases/sync_invoice.py
from dataclasses import dataclass
from ports.invoice_storage import IInvoiceStoragePort
from ports.invoice_network import IInvoiceNetworkPort
from domain.entities import TaxCode, InvoiceRecord

@dataclass(frozen=True)
class SyncInvoiceCommand:
    invoice_id: str
    tax_code_str: str

class SyncInvoiceUseCase:
    def __init__(self, network: IInvoiceNetworkPort, storage: IInvoiceStoragePort) -> None:
        self._network = network
        self._storage = storage

    def execute(self, cmd: SyncInvoiceCommand) -> InvoiceRecord:
        # 1. Guard input
        tax_code = TaxCode(cmd.tax_code_str)
        
        # 2. Fetch from network port
        raw_data = self._network.fetch_invoice(cmd.invoice_id, tax_code)
        
        # 3. Create domain entity & invariants check
        record = InvoiceRecord(
            invoice_id=cmd.invoice_id,
            tax_code=tax_code,
            total_amount=raw_data.amount
        )
        record.mark_as_synced()
        
        # 4. Persist via storage port
        self._storage.save(record)
        return record
```

### D. SQLite WAL Outbox Adapter (Chống mất dữ liệu ngoại tuyến)
```python
# src/adapters/storage/sqlite_outbox.py
import sqlite3
import json
from typing import Dict, Any

class SqliteOutboxAdapter:
    def __init__(self, db_path: str) -> None:
        self._conn = sqlite3.connect(db_path)
        self._conn.execute("PRAGMA journal_mode=WAL;")
        self._ensure_table()

    def _ensure_table(self) -> None:
        with self._conn:
            self._conn.execute("""
                CREATE TABLE IF NOT EXISTS outbox_events (
                    id TEXT PRIMARY KEY,
                    event_type TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    status TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

    def push(self, event_id: str, event_type: str, payload: Dict[str, Any]) -> None:
        with self._conn:
            self._conn.execute(
                "INSERT INTO outbox_events (id, event_type, payload, status) VALUES (?, ?, ?, 'PENDING')",
                (event_id, event_type, json.dumps(payload))
            )
```
