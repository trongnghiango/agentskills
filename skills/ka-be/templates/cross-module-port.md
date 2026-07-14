# Cross-Module Port Template

> **Quick Reference**
> | Aspect | Detail |
> |:---|:---|
> | Complexity | Medium |
> | Layers touched | Domain (port definition) → Infrastructure (adapter) → DI (wiring) |
> | Key patterns | Port/Adapter, Dependency Inversion, Interface Segregation |
> | Critical rule | Port is defined by the CONSUMER, implementation provided by the PROVIDER |
> | Prerequisites | Both modules exist, communication need identified |

---

## 1. Why Direct Repository Import is Forbidden

```
❌ WRONG: Direct cross-module dependency
┌─────────────────┐         ┌─────────────────┐
│  Order Module    │────────▶│  Product Module  │
│                  │         │                  │
│  OrderService    │ imports │ ProductRepo      │
│                  │────────▶│ (concrete class) │
└─────────────────┘         └─────────────────┘

Problems:
• Order module knows Product's internal database structure
• Cannot replace Product module independently
• Circular dependencies become inevitable
• Testing requires the real Product database
```

```
✅ CORRECT: Communication through Port/Interface
┌─────────────────┐         ┌─────────────────┐
│  Order Module    │         │  Product Module  │
│                  │         │                  │
│  OrderService    │         │ ProductPortImpl  │
│       │          │         │       │          │
│       ▼          │         │       ▼          │
│  IProductPort    │◀────────│  (implements)    │
│  (interface)     │   DI    │                  │
└─────────────────┘         └─────────────────┘

Benefits:
• Order defines WHAT it needs (interface)
• Product decides HOW to fulfill it (implementation)
• Modules can be tested independently
• No circular dependency possible
```

---

## 2. Port Definition (in the CONSUMER Module)

The consumer defines exactly what it needs — nothing more (Interface Segregation Principle).

### TypeScript

```typescript
// modules/order/domain/ports/product.port.ts

export interface ProductInfo {
  id: string;
  name: string;
  price: number;
  isAvailable: boolean;
}

export interface IProductPort {
  /**
   * Check if products exist and are available for ordering.
   * Returns only the fields the Order module needs.
   */
  findByIds(productIds: string[], organizationId: string): Promise<ProductInfo[]>;

  /**
   * Validate that all products can be ordered (in stock, active, etc.)
   */
  validateAvailability(
    items: Array<{ productId: string; quantity: number }>,
    organizationId: string,
  ): Promise<{ valid: boolean; unavailable: string[] }>;
}

// DI Token
export const PRODUCT_PORT = Symbol('PRODUCT_PORT');
```

### Go

```go
// internal/order/domain/ports/product_port.go
package ports

import "context"

type ProductInfo struct {
    ID          string
    Name        string
    Price       int
    IsAvailable bool
}

type AvailabilityResult struct {
    Valid       bool
    Unavailable []string
}

type ProductPort interface {
    FindByIDs(ctx context.Context, productIDs []string, orgID string) ([]ProductInfo, error)
    ValidateAvailability(ctx context.Context, items []OrderItem, orgID string) (*AvailabilityResult, error)
}
```

### Port Design Rules

- ✅ Define the port using the **consumer's language** (Order speaks of "availability", not "stock count")
- ✅ Return a **minimal DTO** (`ProductInfo`), not the full `Product` entity
- ✅ Include `organizationId` in every method for tenant isolation
- ❌ Never expose the provider's internal types (Entity, Repository, Schema)
- ❌ Never add methods the consumer doesn't need (keep the interface small)

---

## 3. Implementation (by the PROVIDER Module)

The provider module creates an adapter that implements the consumer's port.

### TypeScript

```typescript
// modules/product/infrastructure/adapters/product-port.adapter.ts
import { IProductPort, ProductInfo } from '@modules/order/domain/ports/product.port';
import { IProductRepository } from '../domain/product.repository.port';

export class ProductPortAdapter implements IProductPort {
  constructor(private readonly productRepo: IProductRepository) {}

  async findByIds(productIds: string[], organizationId: string): Promise<ProductInfo[]> {
    const products = await this.productRepo.findByIds(productIds, organizationId);

    // Map to consumer's DTO — only expose what Order needs
    return products.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      isAvailable: p.isActive && !p.isDeleted,
    }));
  }

  async validateAvailability(
    items: Array<{ productId: string; quantity: number }>,
    organizationId: string,
  ): Promise<{ valid: boolean; unavailable: string[] }> {
    const productIds = items.map((i) => i.productId);
    const products = await this.findByIds(productIds, organizationId);

    const availableIds = new Set(products.filter((p) => p.isAvailable).map((p) => p.id));
    const unavailable = productIds.filter((id) => !availableIds.has(id));

    return { valid: unavailable.length === 0, unavailable };
  }
}
```

### Go

```go
// internal/product/infra/adapters/product_port_adapter.go
package adapters

import (
    "context"
    orderPorts "myapp/internal/order/domain/ports"
    "myapp/internal/product/domain"
)

type ProductPortAdapter struct {
    repo domain.ProductRepository
}

func NewProductPortAdapter(repo domain.ProductRepository) orderPorts.ProductPort {
    return &ProductPortAdapter{repo: repo}
}

func (a *ProductPortAdapter) FindByIDs(
    ctx context.Context, ids []string, orgID string,
) ([]orderPorts.ProductInfo, error) {
    products, err := a.repo.FindByIDs(ctx, ids, orgID)
    if err != nil {
        return nil, err
    }

    result := make([]orderPorts.ProductInfo, 0, len(products))
    for _, p := range products {
        result = append(result, orderPorts.ProductInfo{
            ID:          p.ID,
            Name:        p.Name,
            Price:       p.Price,
            IsAvailable: p.IsActive && !p.IsDeleted,
        })
    }
    return result, nil
}
```

---

## 4. DI Wiring

### TypeScript (NestJS)

```typescript
// modules/product/product.module.ts
import { Module } from '@nestjs/common';
import { PRODUCT_PORT } from '@modules/order/domain/ports/product.port';
import { ProductPortAdapter } from './infrastructure/adapters/product-port.adapter';
import { ProductRepository } from './infrastructure/product.repository';

@Module({
  providers: [
    ProductRepository,
    {
      provide: PRODUCT_PORT,
      useFactory: (repo: ProductRepository) => new ProductPortAdapter(repo),
      inject: [ProductRepository],
    },
  ],
  exports: [PRODUCT_PORT], // Export so Order module can import it
})
export class ProductModule {}
```

```typescript
// modules/order/order.module.ts
import { Module } from '@nestjs/common';
import { ProductModule } from '@modules/product/product.module';
import { OrderService } from './application/order.service';

@Module({
  imports: [ProductModule], // Import to get PRODUCT_PORT
  providers: [OrderService],
})
export class OrderModule {}
```

```typescript
// modules/order/application/order.service.ts
import { Inject } from '@nestjs/common';
import { IProductPort, PRODUCT_PORT } from '../domain/ports/product.port';

export class OrderService {
  constructor(
    @Inject(PRODUCT_PORT) private readonly productPort: IProductPort,
    private readonly orderRepo: IOrderRepository,
  ) {}

  async createOrder(params: CreateOrderParams): Promise<Order> {
    // Use the port — no knowledge of Product's internals
    const availability = await this.productPort.validateAvailability(
      params.items,
      params.organizationId,
    );

    if (!availability.valid) {
      throw new ProductsUnavailableException(availability.unavailable);
    }

    // Proceed with order creation...
  }
}
```

### Go (Constructor Injection)

```go
// cmd/main.go or internal/app/wire.go
func main() {
    // Infrastructure
    productRepo := postgres.NewProductRepository(db)

    // Adapters (Provider → Consumer port)
    productPort := adapters.NewProductPortAdapter(productRepo)

    // Application services
    orderService := application.NewOrderService(orderRepo, productPort)
}
```

---

## 5. Data Flow Diagram

```
┌─────────── Order Module ───────────────────────────────────────────┐
│                                                                    │
│  Controller ──▶ OrderService ──▶ IProductPort.validateAvailability │
│                      │                       │                     │
│                      │                       │ (interface call)    │
└──────────────────────│───────────────────────│─────────────────────┘
                       │                       │
                       │                       ▼
┌──────────────────────│──── Product Module ─────────────────────────┐
│                      │                                             │
│                      │    ProductPortAdapter (implements IProductPort)
│                      │           │                                 │
│                      │           ▼                                 │
│                      │    ProductRepository ──▶ Database           │
│                      │                                             │
└──────────────────────│─────────────────────────────────────────────┘
                       │
                       ▼
                  OrderRepository ──▶ Database
```

---

## 6. Anti-Patterns to Avoid

### ❌ Anti-Pattern 1: Importing another module's repository directly

```typescript
// ❌ NEVER DO THIS
import { ProductRepository } from '@modules/product/infrastructure/product.repository';

export class OrderService {
  constructor(private readonly productRepo: ProductRepository) {} // Direct import!
}
```

### ❌ Anti-Pattern 2: Provider defines the interface

```typescript
// ❌ WRONG — Port defined in the provider module
// modules/product/domain/ports/product-query.port.ts
export interface IProductQueryPort { ... }

// This makes the consumer depend on the provider's contract
```

### ❌ Anti-Pattern 3: Exposing internal entities via port

```typescript
// ❌ WRONG — Leaking Product entity to Order module
export interface IProductPort {
  findByIds(ids: string[]): Promise<Product[]>; // Product entity exposed!
}
```

### ❌ Anti-Pattern 4: Fat interface with unused methods

```typescript
// ❌ WRONG — Order doesn't need updateProduct or deleteProduct
export interface IProductPort {
  findByIds(ids: string[]): Promise<ProductInfo[]>;
  updateProduct(id: string, data: any): Promise<void>; // Unused by Order!
  deleteProduct(id: string): Promise<void>;             // Unused by Order!
}
```

---

## 7. Multiple Consumers Pattern

When multiple modules need different slices of the same provider:

```
┌─ Order Module ──────────┐     ┌─ Product Module ────────────────────┐
│ IProductPort            │◀────│ ProductPortAdapter                  │
│  • findByIds            │     │  (implements IProductPort)          │
│  • validateAvailability │     │                                     │
└─────────────────────────┘     │                                     │
                                │                                     │
┌─ Invoice Module ────────┐     │ InvoiceProductPortAdapter           │
│ IInvoiceProductPort     │◀────│  (implements IInvoiceProductPort)   │
│  • getProductPricing    │     │                                     │
│  • getProductTaxInfo    │     └─────────────────────────────────────┘
└─────────────────────────┘
```

Each consumer defines **its own port** with only the methods it needs. The provider implements each one separately.

---

## 8. Checklist

- [ ] Port interface defined in the **consumer's** domain layer
- [ ] Port returns a consumer-specific DTO, not the provider's entity
- [ ] Port interface follows Interface Segregation (only methods the consumer uses)
- [ ] Adapter implemented in the **provider's** infrastructure layer
- [ ] Adapter maps provider entities to consumer DTOs
- [ ] DI wiring connects the adapter to the port token
- [ ] No direct imports between module infrastructure layers
- [ ] Every port method includes `organizationId` for tenant isolation
- [ ] Unit tests for the consumer mock the port interface
- [ ] Unit tests for the adapter verify correct mapping
