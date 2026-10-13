# PURE FINITE STATE MACHINE (FSM) ENGINE TEMPLATE
> Mẫu thiết kế bộ tính toán chuyển đổi trạng thái tất định (Pure Function), độc lập 100% với I/O, Database và Framework.

---

## 1. NGUYÊN TẮC THIẾT KẾ FSM THUẦN
1. **Không I/O & Không Async**: FSM Engine là một hàm toán học thuần túy:
   $$\text{Engine}(S_{\text{current}}, \text{Event}, \text{Context}) \longrightarrow (S_{\text{next}}, [\text{DomainEvents}], \text{Result})$$
   Tuyệt đối cấm từ khóa `async`, cấm gọi Database hay HTTP bên trong FSM.
2. **Ma trận chuyển trạng thái (State Transition Matrix)**: Khai báo tường minh quan hệ giữa Trạng thái hiện tại $\times$ Sự kiện $\rightarrow$ Trạng thái kế tiếp.

---

## 2. TRIỂN KHAI TRONG TYPESCRIPT (`*.engine.ts`)

```typescript
// modules/orders/domain/services/order-fsm.engine.ts

export enum OrderStatus {
  DRAFT = 'DRAFT',
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
  FULFILLED = 'FULFILLED',
}

export enum OrderEvent {
  SUBMIT = 'SUBMIT',
  CONFIRM_PAYMENT = 'CONFIRM_PAYMENT',
  CANCEL = 'CANCEL',
  FULFILL = 'FULFILL',
}

export interface TransitionContext {
  actorRole: string;
  isPaidInFull: boolean;
  cancellationReason?: string;
}

export class OrderFsmEngine {
  private static readonly MATRIX: Record<OrderStatus, Partial<Record<OrderEvent, OrderStatus>>> = {
    [OrderStatus.DRAFT]: {
      [OrderEvent.SUBMIT]: OrderStatus.PENDING_PAYMENT,
      [OrderEvent.CANCEL]: OrderStatus.CANCELLED,
    },
    [OrderStatus.PENDING_PAYMENT]: {
      [OrderEvent.CONFIRM_PAYMENT]: OrderStatus.PAID,
      [OrderEvent.CANCEL]: OrderStatus.CANCELLED,
    },
    [OrderStatus.PAID]: {
      [OrderEvent.FULFILL]: OrderStatus.FULFILLED,
    },
    [OrderStatus.FULFILLED]: {},
    [OrderStatus.CANCELLED]: {},
  };

  public static transition(
    current: OrderStatus,
    event: OrderEvent,
    ctx: TransitionContext,
  ): Result<OrderStatus, DomainError> {
    const next = this.MATRIX[current]?.[event];
    if (!next) {
      return Result.fail(new DomainError('INVALID_TRANSITION', `Không thể chuyển từ ${current} qua sự kiện ${event}`));
    }

    // Guard Clauses: Kiểm tra điều kiện bảo vệ
    if (event === OrderEvent.CONFIRM_PAYMENT && !ctx.isPaidInFull) {
      return Result.fail(new DomainError('INSUFFICIENT_PAYMENT', 'Chưa thanh toán đủ số tiền đơn hàng'));
    }

    if (event === OrderEvent.CANCEL && current === OrderStatus.PAID) {
      return Result.fail(new DomainError('CANNOT_CANCEL_PAID_ORDER', 'Đơn hàng đã thanh toán không thể tự do hủy'));
    }

    return Result.ok(next);
  }
}
```

---

## 3. TRIỂN KHAI TRONG PYTHON (`fsm_engine.py`)

```python
# src/domain/services/order_fsm.py
from enum import Enum
from typing import Dict, Optional, Tuple

class OrderStatus(str, Enum):
    DRAFT = "DRAFT"
    PENDING_PAYMENT = "PENDING_PAYMENT"
    PAID = "PAID"
    CANCELLED = "CANCELLED"

class OrderEvent(str, Enum):
    SUBMIT = "SUBMIT"
    PAY = "PAY"
    CANCEL = "CANCEL"

class OrderFsmEngine:
    MATRIX: Dict[OrderStatus, Dict[OrderEvent, OrderStatus]] = {
        OrderStatus.DRAFT: {
            OrderEvent.SUBMIT: OrderStatus.PENDING_PAYMENT,
            OrderEvent.CANCEL: OrderStatus.CANCELLED,
        },
        OrderStatus.PENDING_PAYMENT: {
            OrderEvent.PAY: OrderStatus.PAID,
            OrderEvent.CANCEL: OrderStatus.CANCELLED,
        },
        OrderStatus.PAID: {},
        OrderStatus.CANCELLED: {},
    }

    @classmethod
    def transition(cls, current: OrderStatus, event: OrderEvent) -> Tuple[Optional[OrderStatus], Optional[str]]:
        next_state = cls.MATRIX.get(current, {}).get(event)
        if not next_state:
            return None, f"Không thể chuyển từ {current} qua {event}"
        return next_state, None
```
