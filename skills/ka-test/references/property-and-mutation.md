# Property-based & Mutation Testing

## 1. Property-based (khi nào)

Dùng khi có **bất biến** dễ phát biểu nhưng khó liệt kê case:

| Loại bất biến | Ví dụ |
|---|---|
| Round-trip | `parse(serialize(x)) === x` |
| Idempotent | `f(f(x)) === f(x)` (retry, webhook, normalize) |
| Commutative | cộng tiền, merge set không phụ thuộc thứ tự |
| Invariant | tổng phần = tổng; VAT + net = gross |
| Ordering | sort ổn định, phân trang không trùng/thiếu |

Ví dụ fast-check:

```ts
import fc from 'fast-check'
import { tax } from './tax'

test('net + vat = gross for any amount', () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 1_000_000 }), (amount) => {
      const { net, vat } = tax(amount, 0.08)
      return net + vat === amount
    }),
  )
})
```

Không dùng property-based thay unit test thường; dùng bổ sung cho invariant.

## 2. Mutation testing (đo chất lượng test)

- Công cụ: Stryker (TS/JS), pitest (Java), mutmut (Python).
- Chạy trên module rủi ro cao (auth, tiền, tenant, FSM), không toàn repo mỗi PR.
- Ngưỡng: mutation score ≥ 80% cho module rủi ro cao.
- Mutant sống sót = test chưa bắt được hành vi → viết test, không `// Stryker disable`.

```json
// stryker.conf.json (rút gọn)
{ "mutate": ["src/modules/**/domain/**/*.ts"],
  "testRunner": "jest",
  "thresholds": { "high": 85, "low": 80, "break": 75 } }
```

## 3. Coverage vs mutation

| | Coverage | Mutation |
|---|---|---|
| Đo | dòng được chạy | hành vi bị test bắt |
| Trả lời | "đã chạy chưa" | "test có ý nghĩa không" |
| Dùng khi | cổng tối thiểu CI | module rủi ro cao |

Coverage là tín hiệu; mutation là bằng chứng.
