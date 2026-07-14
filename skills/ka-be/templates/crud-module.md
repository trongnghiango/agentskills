# CRUD Module Template

> **Quick Reference**
> | Aspect | Detail |
> |:---|:---|
> | Complexity | Medium |
> | Layers touched | All 4 (Domain → Application → Infrastructure → Presentation) |
> | Key patterns | Rich Entity, Repository Port, Mapper, Paginated Query |
> | Estimated files | 8–12 per module |
> | Prerequisites | Database schema, module naming decided |

---

## 1. Recommended File/Folder Structure

```
src/modules/{module-name}/
├── domain/
│   ├── {entity}.entity.ts          # Rich domain model
│   ├── {entity}.exceptions.ts      # Domain-specific exceptions
│   └── {entity}.repository.port.ts # Repository interface (port)
├── application/
│   ├── {entity}.service.ts         # Application use case orchestrator
│   └── dto/
│       ├── create-{entity}.dto.ts  # Input validation schema
│       ├── update-{entity}.dto.ts
│       └── query-{entity}.dto.ts   # Pagination + filter params
├── infrastructure/
│   ├── {entity}.repository.ts      # Concrete repository implementation
│   ├── {entity}.mapper.ts          # toDomain / toPersistence mappers
│   └── {entity}.schema.ts          # Database schema definition
└── presentation/
    ├── {entity}.controller.ts      # Route handler
    └── {entity}.response.ts        # Response DTO mapper
```

> **Go equivalent structure:**
> ```
> internal/{module}/
> ├── domain/       (entity.go, errors.go, repository.go)
> ├── application/  (service.go, dto.go)
> ├── infra/        (repository_impl.go, mapper.go, schema.go)
> └── handler/      (handler.go, response.go)
> ```

---

## 2. Schema Definition

Define the database schema FIRST — it drives everything downstream.

### TypeScript (Drizzle)

```typescript
// infrastructure/{entity}.schema.ts
import { pgTable, uuid, varchar, text, boolean, timestamp, integer } from 'drizzle-orm/pg-core';

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  price: integer('price').notNull(), // Store in cents
  isActive: boolean('is_active').notNull().default(true),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### Key Schema Rules

- ✅ Always include `organizationId` for tenant isolation
- ✅ Use `isDeleted` + `deletedAt` for soft deletes
- ✅ Store monetary values as integers (cents), never floats
- ✅ Add composite indexes for common query patterns:
  ```typescript
  // Add to schema file
  import { index } from 'drizzle-orm/pg-core';

  // Composite index for tenant-scoped queries
  export const productOrgIdx = index('idx_products_org_active')
    .on(products.organizationId, products.isActive, products.isDeleted);
  ```
- ❌ Never store `tenantId` as a nullable field

---

## 3. Domain Entity

The entity encapsulates business rules and state transitions.

### TypeScript

```typescript
// domain/{entity}.entity.ts
import { ProductNotFoundException, InvalidProductDataException } from './product.exceptions';

export interface ProductProps {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  price: number;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Product {
  private constructor(private readonly props: ProductProps) {}

  // --- Factory Methods ---

  static create(params: {
    organizationId: string;
    name: string;
    description?: string;
    price: number;
  }): Product {
    if (params.price < 0) {
      throw new InvalidProductDataException('Price cannot be negative');
    }
    if (!params.name.trim()) {
      throw new InvalidProductDataException('Name is required');
    }
    return new Product({
      id: crypto.randomUUID(),
      organizationId: params.organizationId,
      name: params.name.trim(),
      description: params.description ?? null,
      price: params.price,
      isActive: true,
      isDeleted: false,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: ProductProps): Product {
    return new Product(props);
  }

  // --- Business Methods ---

  update(params: { name?: string; description?: string; price?: number }): void {
    if (this.props.isDeleted) {
      throw new InvalidProductDataException('Cannot update a deleted product');
    }
    if (params.name !== undefined) this.props.name = params.name.trim();
    if (params.description !== undefined) this.props.description = params.description;
    if (params.price !== undefined) {
      if (params.price < 0) throw new InvalidProductDataException('Price cannot be negative');
      this.props.price = params.price;
    }
    this.props.updatedAt = new Date();
  }

  softDelete(): void {
    if (this.props.isDeleted) return; // Idempotent
    this.props.isDeleted = true;
    this.props.isActive = false;
    this.props.deletedAt = new Date();
    this.props.updatedAt = new Date();
  }

  restore(): void {
    if (!this.props.isDeleted) return; // Idempotent
    this.props.isDeleted = false;
    this.props.isActive = true;
    this.props.deletedAt = null;
    this.props.updatedAt = new Date();
  }

  // --- Getters (read-only access) ---

  get id(): string { return this.props.id; }
  get organizationId(): string { return this.props.organizationId; }
  get name(): string { return this.props.name; }
  get description(): string | null { return this.props.description; }
  get price(): number { return this.props.price; }
  get isActive(): boolean { return this.props.isActive; }
  get isDeleted(): boolean { return this.props.isDeleted; }
  get deletedAt(): Date | null { return this.props.deletedAt; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  toSnapshot(): Readonly<ProductProps> {
    return { ...this.props };
  }
}
```

### Domain Exceptions

```typescript
// domain/{entity}.exceptions.ts
export class ProductNotFoundException extends Error {
  constructor(id: string) {
    super(`Product not found: ${id}`);
    this.name = 'ProductNotFoundException';
  }
}

export class InvalidProductDataException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidProductDataException';
  }
}
```

---

## 4. Repository Port

```typescript
// domain/{entity}.repository.port.ts

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ProductQueryParams {
  organizationId: string;
  page: number;
  pageSize: number;
  search?: string;
  isActive?: boolean;
  sortBy?: 'name' | 'price' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface IProductRepository {
  findById(id: string, organizationId: string): Promise<Product | null>;
  findAll(params: ProductQueryParams): Promise<PaginatedResult<Product>>;
  save(entity: Product): Promise<void>;
  softDelete(id: string, organizationId: string): Promise<void>;
}
```

---

## 5. Mapper Pattern

Mappers translate between persistence rows and domain entities. **Never skip this layer.**

```typescript
// infrastructure/{entity}.mapper.ts
import { Product, ProductProps } from '../domain/product.entity';

// DB row type (from Drizzle inference or manual definition)
type ProductRow = typeof products.$inferSelect;

export class ProductMapper {
  static toDomain(row: ProductRow): Product {
    return Product.reconstitute({
      id: row.id,
      organizationId: row.organizationId,
      name: row.name,
      description: row.description,
      price: row.price,
      isActive: row.isActive,
      isDeleted: row.isDeleted,
      deletedAt: row.deletedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  static toPersistence(entity: Product): Omit<ProductRow, 'createdAt'> {
    const snap = entity.toSnapshot();
    return {
      id: snap.id,
      organizationId: snap.organizationId,
      name: snap.name,
      description: snap.description,
      price: snap.price,
      isActive: snap.isActive,
      isDeleted: snap.isDeleted,
      deletedAt: snap.deletedAt,
      updatedAt: snap.updatedAt,
    };
  }
}
```

- ✅ `toDomain`: DB row → Domain Entity (uses `reconstitute`, not `create`)
- ✅ `toPersistence`: Domain Entity → DB-writable object (excludes immutable `createdAt`)
- ❌ Never pass raw DB rows out of the infrastructure layer

---

## 6. Application Service

```typescript
// application/{entity}.service.ts
import { IProductRepository, ProductQueryParams, PaginatedResult } from '../domain/product.repository.port';
import { Product } from '../domain/product.entity';
import { ProductNotFoundException } from '../domain/product.exceptions';

export class ProductService {
  constructor(private readonly productRepo: IProductRepository) {}

  async create(params: {
    organizationId: string;
    name: string;
    description?: string;
    price: number;
  }): Promise<Product> {
    const product = Product.create(params);
    await this.productRepo.save(product);
    return product;
  }

  async findById(id: string, organizationId: string): Promise<Product> {
    const product = await this.productRepo.findById(id, organizationId);
    if (!product) throw new ProductNotFoundException(id);
    return product;
  }

  async findAll(params: ProductQueryParams): Promise<PaginatedResult<Product>> {
    return this.productRepo.findAll(params);
  }

  async update(
    id: string,
    organizationId: string,
    params: { name?: string; description?: string; price?: number },
  ): Promise<Product> {
    const product = await this.findById(id, organizationId);
    product.update(params);
    await this.productRepo.save(product);
    return product;
  }

  async softDelete(id: string, organizationId: string): Promise<void> {
    const product = await this.findById(id, organizationId);
    product.softDelete();
    await this.productRepo.save(product);
  }

  async restore(id: string, organizationId: string): Promise<Product> {
    const product = await this.findById(id, organizationId);
    product.restore();
    await this.productRepo.save(product);
    return product;
  }
}
```

- ✅ Service only orchestrates: fetch → call domain method → save
- ✅ Business rules live in the Entity, not here
- ❌ Never put validation logic (e.g., `if (price < 0)`) in the service

---

## 7. Controller / Route Handler

```typescript
// presentation/{entity}.controller.ts
import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { ProductService } from '../application/product.service';
import { CreateProductDto, UpdateProductDto, QueryProductDto } from '../application/dto';
import { ProductResponseMapper } from './product.response';
import { CurrentUser } from '@shared/decorators'; // Extract tenant from JWT

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductDto) {
    const product = await this.productService.create({
      organizationId: user.organizationId,
      ...dto,
    });
    return ProductResponseMapper.toResponse(product);
  }

  @Get()
  async findAll(@CurrentUser() user: AuthUser, @Query() query: QueryProductDto) {
    const result = await this.productService.findAll({
      organizationId: user.organizationId,
      ...query,
    });
    return ProductResponseMapper.toPaginatedResponse(result);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const product = await this.productService.findById(id, user.organizationId);
    return ProductResponseMapper.toResponse(product);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    const product = await this.productService.update(id, user.organizationId, dto);
    return ProductResponseMapper.toResponse(product);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.productService.softDelete(id, user.organizationId);
    return { success: true };
  }
}
```

- ✅ `organizationId` comes from `@CurrentUser()` (JWT), never from query/body
- ✅ Response goes through `ProductResponseMapper`, never raw entity
- ❌ Never catch domain exceptions here with try/catch — use a global exception filter

---

## 8. Soft Delete vs Hard Delete Guidance

| Approach | When to Use | Implementation |
|:---|:---|:---|
| **Soft Delete** | Business data, audit trail needed, data recovery required | `isDeleted` flag + `deletedAt` timestamp |
| **Hard Delete** | Temporary data, GDPR compliance, storage cleanup | Physical `DELETE FROM` in scheduled jobs |

### Rules

- ✅ Default to soft delete for all business entities
- ✅ All list queries must filter `WHERE is_deleted = false` by default
- ✅ Provide explicit `?includeDeleted=true` for admin queries only
- ❌ Never hard-delete in a user-facing API endpoint
- ❌ Never soft-delete without setting `deletedAt` timestamp

---

## 9. Checklist

Before marking a CRUD module as complete:

- [ ] Schema has `organizationId`, `isDeleted`, `deletedAt`, `createdAt`, `updatedAt`
- [ ] Composite index on `(organizationId, isDeleted)` exists
- [ ] Entity uses private constructor + `create()` / `reconstitute()` factories
- [ ] Entity enforces invariants in business methods, not in service
- [ ] Repository port is an interface in the domain layer
- [ ] Mapper handles both `toDomain` and `toPersistence`
- [ ] Service only orchestrates (no business logic)
- [ ] Controller extracts `organizationId` from auth context
- [ ] All list queries filter by tenant + soft-delete status
- [ ] Response uses a dedicated DTO mapper
