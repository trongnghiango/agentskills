# ONE-WAY DEPENDENCY & REGISTRY PATTERN STANDARD
> Chuẩn hóa cấu trúc đồ thị phụ thuộc một chiều (Directed Acyclic Graph - DAG) và triệt tiêu phụ thuộc vòng tròn giữa các module.

---

## 1. MÔ HÌNH PHÂN CẤP 3 TẦNG MODULE (TIERED DAG)

```text
       TIER 1 (Foundation)         [Rbac, Notification, Logging, System, Storage]
              ▲
              │ (Import hợp lệ)
       TIER 2 (Domain Core)        [User, Tenant, Organization, Employee]
              ▲
              │ (Import hợp lệ)
       TIER 3 (Process Flow)       [Accounting, CRM, Contracts, Dispatcher]
```

- **Quy tắc 1**: Tier thấp **TUYỆT ĐỐI KHÔNG** import Tier cao. (Tier 1 không import Tier 2/3; Tier 2 không import Tier 3).
- **Quy tắc 2**: Các module trong cùng một Tier **CẤM IMPORT TRỰC TIẾP** lẫn nhau.
- **Quy tắc 3**: **LỆNH CẤM `forwardRef()` TUYỆT ĐỐI**: Không dùng `forwardRef()` để vá víu lỗi vòng tròn. Thay thế 100% bằng:
  1. **Registry Pattern (ADR-011)**.
  2. **Domain Events qua EventBus**.

---

## 2. TRIỂN KHAI REGISTRY PATTERN (INVERSION OF CONTROL)

Khi một Module cấp trên (Tier 1/2) cần biết danh sách các Provider/Handler do các Module nghiệp vụ cấp dưới (Tier 3) cung cấp:
- **Module cấp trên**: Định nghĩa Interface và tạo `Registry` trung tâm với các method `register(provider)` và `get(key)`.
- **Module cấp dưới**: Tự đăng ký chính mình vào Registry của Module cấp trên lúc ứng dụng khởi động.

### TypeScript / NestJS
```typescript
// Tier 1: Registry trung tâm
@Injectable()
export class ActionRegistry {
  private map = new Map<string, IActionProvider>();
  register(p: IActionProvider) { this.map.set(p.key, p); }
  get(key: string) { return this.map.get(key); }
}

// Tier 3: Tự đăng ký lúc bootstrap
@Module({ ... })
export class AccountingModule implements OnModuleInit {
  constructor(private reg: ActionRegistry, private provider: AccountingActionProvider) {}
  onModuleInit() { this.reg.register(this.provider); }
}
```

### Golang
```go
// Composition Root đăng ký một chiều tại cmd/server/main.go
registry := internal.NewHandlerRegistry()
registry.Register("INVOICE", invoice.NewHandler())
registry.Register("DEAL", crm.NewHandler())
```

### Python
```python
# Decorator Registry đăng ký một chiều
@ActionRegistry.register("SYNC_TAX")
class SyncTaxHandler:
    def execute(self, payload): ...
```

---

## 3. DOMAIN EVENTS VỚI SELF-CONTAINED PAYLOAD
Khi hành động ở Module A dẫn đến hệ quả ở Module B:
- Module A phát hành sự kiện: `EventBus.publish(new DealWonDomainEvent({ clientId, dealId, contractTerms, amount }))`.
- **Bắt buộc**: Payload sự kiện phải chứa đủ thông tin để Module B và C thực thi ngay.
- **Cấm**: Listener ở Module B nhận event chỉ có mỗi `dealId`, rồi lại gọi ngược lại Repository của Module A để query dữ liệu.
