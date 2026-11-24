// Mẫu test theo TDD: chạy để thấy RED trước, rồi code tối thiểu cho GREEN.
// Hỗ trợ jest và vitest (cùng API expect).

import { productFactory } from './factory'
import { ProductService } from './product.service'
import { InMemoryProductRepository } from './product.repository.fake'

describe('ProductService.getVisible', () => {
  // Arrange dùng chung, không chia sẻ state giữa test.
  let repo: InMemoryProductRepository
  let service: ProductService

  beforeEach(() => {
    repo = new InMemoryProductRepository()
    service = new ProductService(repo)
  })

  it('should return null when product belongs to another organization', async () => {
    await repo.save(productFactory({ organizationId: 'org-0002' }))

    const result = await service.getVisible('prod-0001', { organizationId: 'org-0001' })

    expect(result).toBeNull()
  })

  it('should return product when organization matches', async () => {
    await repo.save(productFactory())

    const result = await service.getVisible('prod-0001', { organizationId: 'org-0001' })

    expect(result?.id).toBe('prod-0001')
  })
})
