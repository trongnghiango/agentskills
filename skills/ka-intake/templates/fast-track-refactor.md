# ⚡ FAST-TRACK REFACTORING & DECOUPLING SPEC TEMPLATE
> Sử dụng template này khi cần tái cấu trúc phân tầng Clean Architecture, bẻ gãy Circular Dependency, loại bỏ `forwardRef()` và áp dụng Registry Pattern (ADR-011).

---

## 1. MỤC TIÊU TÁI CẤU TRÚC (REFACTORING OBJECTIVE)
- **Vấn đề cấu trúc hiện tại**: [VD: Module CRM và Module Accounting đang import vòng tròn lẫn nhau qua `forwardRef()` / Controller đang query DB trực tiếp dài 120 dòng]
- **Mục tiêu đạt được**: [VD: Bẻ gãy phụ thuộc qua Domain Events / Tách 4 tầng Clean Architecture, hàm $\le 40-50$ dòng]
- **Phạm vi module ảnh hưởng**: [VD: `src/modules/accounting/`, `src/modules/crm/`]

## 2. CHIẾN LƯỢC BẺ GÃY PHỤ THUỘC (DECOUPLING STRATEGY)
- [ ] **Phương án 1 — Domain Events qua EventBus**:
  - Module phát hành sự kiện: [VD: `DealWonEvent`] với **Self-Contained Payload**.
  - Module nhận sự kiện đăng ký Listener độc lập. Cấm Listener inject Repository của Module phát hành.
- [ ] **Phương án 2 — Registry Pattern (ADR-011)**:
  - Module cấp trên định nghĩa Provider Port và Registry.
  - Module cấp dưới tự đăng ký Provider vào Registry lúc khởi động (`onModuleInit` / init function).
- [ ] **Phương án 3 — Single Screen Rule Refactoring**:
  - Đập phẳng các khối `if/else` lồng nhau thành Guard Clauses.
  - Tách hàm chính thành Orchestrator ($\le 20$ dòng) + private helper methods ($\le 30$ dòng).

## 3. RÀNG BUỘC SỐNG CÒN (NON-NEGOTIABLES)
- [ ] **ZERO BEHAVIOR CHANGE**: Không làm thay đổi bất kỳ hành vi nghiệp vụ nào của hệ thống.
- [ ] **ZERO DEAD CODE**: Không để lại các hàm cũ không dùng (xóa sạch code cũ sau khi thay thế).
- [ ] **REGRESSION PASS**: 100% existing tests phải PASS sau khi tái cấu trúc.
