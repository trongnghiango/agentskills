# ONE-WAY DEPENDENCY & REGISTRY DECOUPLING BLUEPRINT (TS / GO / PYTHON)
> Giải pháp triệt tiêu phụ thuộc vòng tròn (Circular Dependency), loại bỏ `forwardRef()` và chuẩn hóa DAG (Directed Acyclic Graph) giữa các module.

---

## 1. NGUYÊN TẮC QUY ĐỊNH BẬC PHỤ THUỘC (TIERED DAG)
Mọi hệ thống Modular Monolith hoặc Microservices đều phải phân cấp ranh giới 3 Tier:
- **Tier 1 (Foundation)**: Utilities, Logging, Storage, Notification, RBAC. Độc lập 100%.
- **Tier 2 (Domain Core)**: Backbone entities (User, Tenant, Organization, Employee). Phụ thuộc Tier 1.
- **Tier 3 (Process Flow)**: Business workflows (Accounting, CRM, Contracts, Dispatcher). Phụ thuộc Tier 2 & Tier 1.

> **ĐỊNH LUẬT BẤT BIẾN**:
> - Tier thấp **TUYỆT ĐỐI CẤM** import module ở Tier cao hơn.
> - Các module trong cùng một Tier **TUYỆT ĐỐI CẤM** import chéo lẫn nhau trực tiếp.

---

## 2. GIẢI PHÁP 1: REGISTRY PATTERN (INVERSION OF CONTROL — ADR-011)
Áp dụng khi Module nền tảng (Tier 1/2) cần thu thập hoặc kích hoạt các thành phần do Module nghiệp vụ (Tier 3) định nghĩa mà không được import ngược lại.

### A. Triển khai trong TypeScript (NestJS / Pure TS)
```typescript
// 1. Module Tier 1 định nghĩa Port và Registry
// foundation/workflow-registry.ts
export interface IWorkflowProvider {
  readonly moduleKey: string;
  executeStep(context: StepContext): Promise<StepResult>;
}

@Injectable()
export class WorkflowRegistry {
  private readonly providers = new Map<string, IWorkflowProvider>();

  public register(provider: IWorkflowProvider): void {
    if (this.providers.has(provider.moduleKey)) {
      throw new Error(`Duplicate provider: ${provider.moduleKey}`);
    }
    this.providers.set(provider.moduleKey, provider);
  }

  public get(key: string): IWorkflowProvider {
    const p = this.providers.get(key);
    if (!p) throw new Error(`Provider not found: ${key}`);
    return p;
  }
}

// 2. Module Tier 3 tự đăng ký khi Bootstrap
// modules/accounting/accounting.module.ts
@Injectable()
export class AccountingWorkflowProvider implements IWorkflowProvider {
  public readonly moduleKey = 'ACCOUNTING';
  async executeStep(ctx: StepContext): Promise<StepResult> { ... }
}

@Module({ ... })
export class AccountingModule implements OnModuleInit {
  constructor(
    private readonly registry: WorkflowRegistry,
    private readonly provider: AccountingWorkflowProvider,
  ) {}

  onModuleInit() {
    this.registry.register(this.provider); // Tự đăng ký vào Tier 1
  }
}
```

### B. Triển khai trong Golang (Composition Root Registry)
```go
// internal/registry/handler_registry.go
package registry

import "fmt"

type CommandHandler interface {
	CommandType() string
	Handle(ctx context.Context, payload []byte) error
}

type CommandRegistry struct {
	handlers map[string]CommandHandler
}

func NewCommandRegistry() *CommandRegistry {
	return &CommandRegistry{handlers: make(map[string]CommandHandler)}
}

func (r *CommandRegistry) Register(h CommandHandler) {
	if _, exists := r.handlers[h.CommandType()]; exists {
		panic(fmt.Sprintf("duplicate handler: %s", h.CommandType()))
	}
	r.handlers[h.CommandType()] = h
}

// cmd/server/main.go (Composition Root khởi tạo và đăng ký 1 chiều)
func main() {
	reg := registry.NewCommandRegistry()
	reg.Register(accounting.NewInvoiceHandler())
	reg.Register(crm.NewDealHandler())
	// Server chỉ phụ thuộc vào reg, các module con không phụ thuộc lẫn nhau
}
```

### C. Triển khai trong Python (Protocol & Registry Decorator)
```python
# ports/action_registry.py
from typing import Protocol, Dict, Type

class ActionHandler(Protocol):
    action_name: str
    def execute(self, payload: dict) -> dict: ...

class ActionRegistry:
    _handlers: Dict[str, ActionHandler] = {}

    @classmethod
    def register(cls, name: str):
        def decorator(handler_cls: Type[ActionHandler]):
            cls._handlers[name] = handler_cls()
            return handler_cls
        return decorator

    @classmethod
    def get(cls, name: str) -> ActionHandler:
        if name not in cls._handlers:
            raise KeyError(f"Action '{name}' is not registered")
        return cls._handlers[name]

# modules/tax/handler.py (Tự đăng ký một chiều)
@ActionRegistry.register("SYNC_TAX")
class SyncTaxHandler:
    action_name = "SYNC_TAX"
    def execute(self, payload: dict) -> dict:
        ...
```

---

## 3. GIẢI PHÁP 2: DOMAIN EVENTS (SELF-CONTAINED PAYLOAD)
Khi một hành động ở Module A dẫn đến hệ quả ở Module B:
1. Module A phát hành sự kiện: `EventBus.publish(new DealClosedEvent({ clientId, amount, contractTerms }))`.
2. **Quy tắc Self-Contained Payload**: Dữ liệu trong Event phải tự chứa đủ thông tin để Module B làm việc.
3. **CẤM**: Module B nhận Event chỉ có mỗi `id`, rồi lại inject Repository của Module A để query ngược lại dữ liệu!
