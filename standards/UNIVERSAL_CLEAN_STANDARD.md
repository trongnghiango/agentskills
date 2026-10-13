# UNIVERSAL CLEAN ARCHITECTURE & POLYGLOT STANDARD
> Tiêu chuẩn kiến trúc phần mềm sạch và mã nguồn thuần khiết áp dụng thống nhất cho TypeScript, Golang và Python.

---

## 1. NGUYÊN TẮC PHỤ THUỘC BẤT BIẾN (THE DEPENDENCY RULE)
Mọi hệ thống phần mềm (Web, Desktop, Worker Daemon, API Service) phân tầng theo mô hình 4 lớp:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        4. INFRASTRUCTURE LAYER                         │
│  Frameworks (NestJS, FastAPI, Gin), DB (PostgreSQL, SQLite WAL), Redis │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼ Configures & Injects
┌────────────────────────────────────────────────────────────────────────┐
│                        3. ADAPTERS LAYER (INTERFACE)                   │
│  Controllers, Repositories Impl, Mappers, BullMQ Workers, CLI entries  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼ Implements Ports
┌────────────────────────────────────────────────────────────────────────┐
│                      2. APPLICATION LAYER (USE CASES)                  │
│  Use Cases, Commands, Queries, Inbound/Outbound Port Interfaces        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼ Orchestrates
┌────────────────────────────────────────────────────────────────────────┐
│                          1. DOMAIN LAYER (CORE)                        │
│  Entities, Value Objects, Pure Business Rules, Deterministic FSM       │
│  >>> ZERO EXTERNAL DEPENDENCIES (Không ORM, Không Web, Không IO) <<<   │
└────────────────────────────────────────────────────────────────────────┘
```

> **QUY TẮC CỐT TỬ**: Mã nguồn ở tầng bên trong **tuyệt đối không được import hay phụ thuộc** vào mã nguồn ở tầng bên ngoài. Tầng ngoài phụ thuộc vào tầng trong thông qua **Ports (Interfaces)**.

---

## 2. BẢN ĐỒ ĐỐI CHIẾU 3 HỆ SINH THÁI (TS vs GO vs PYTHON)

| Khái niệm Clean Arch | TypeScript (NestJS / React / Tauri) | Golang (Clean Layout) | Python (FastAPI / Worker) |
| :--- | :--- | :--- | :--- |
| **Domain Entities** | Pure TS Classes với private properties | Go `struct` với unexported fields | Pure `dataclass(frozen=True)` / Class |
| **Ports (Interfaces)** | TypeScript `interface` / Symbol token | Go `type TaskRepo interface` | `typing.Protocol` / `abc.ABC` |
| **Use Cases** | `*.use-case.ts` (Orchestrator $\le 20$ dòng) | `type UseCase struct` + `Execute()` | `class ExecuteUseCase:` |
| **Adapters** | Drizzle Repository, Express/Nest Controller | `pgx` Repo struct, Gin/Fiber Handler | SQLite WAL Adapter, FastAPI router |
| **Dependency Injection**| NestJS IoC Container | Composition Root tại `cmd/server/main.go` | `container.py` (Manual DI) |
| **Validation / Contract**| Zod Schema (`packages/contracts`) | Go struct tags (`validator/v10`) | Pydantic v2 BaseModels |

---

## 3. TIÊU CHUẨN THIẾT KẾ DOMAIN & FSM
1. **Rich Domain Model**: Entity tự bảo vệ Invariants qua methods (VD: `order.complete()`, `invoice.markAsPaid()`). Cấm Anemic Models (class chỉ có public getter/setter).
2. **Value Objects**: Bất biến (Immutable), bình đẳng theo giá trị, tự thẩm định tính hợp lệ ngay khi khởi tạo (`TaxCode`, `Money`, `DateRange`).
3. **Pure State Machine Engine (`*.engine.ts` / `fsm_engine.py`)**:
   $$\text{FSM}(\text{CurrentState}, \text{Event}, \text{Context}) \longrightarrow (\text{NextState}, [\text{Events}], \text{Result})$$
   - Là **Pure Function tất định**: CẤM I/O và CẤM từ khóa `async` bên trong FSM Engine.
