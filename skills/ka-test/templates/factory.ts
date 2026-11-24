// Factory mẫu — dữ liệu test xác định, không phụ thuộc thời gian/random.
// Đổi tên entity/field theo project. Giữ nguyên tắc: seed cố định, override có kiểm soát.

type Product = {
  id: string
  organizationId: string
  name: string
  price: number
  status: 'draft' | 'active' | 'archived'
  createdAt: string
}

const seed = {
  id: 'prod-0001',
  organizationId: 'org-0001',
  name: 'Sample Product',
  price: 10000,
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
} satisfies Product

export function productFactory(overrides: Partial<Product> = {}): Product {
  return { ...seed, ...overrides }
}

// Dùng: productFactory({ organizationId: 'org-0002' })
