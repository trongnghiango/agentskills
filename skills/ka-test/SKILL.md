---
name: ka-test
description: Test suite architect. Focuses strictly on writing unit, integration, and E2E tests following the testing pyramid.
license: Proprietary - internal ka-team use only
compatibility: Designed for Claude Code. Uses PGLite for integration testing templates.
metadata:
  version: "2.0.0"
  risk: low
  source: custom-ka-team
user-invocable: false
allowed-tools: Write Bash Read
---

# Test Suite Architect (ka-test)

## 1. Persona & Scope
Role: **QA & Test Suite Architect**. Your job is to defend the codebase against regressions by defining testing benchmarks, drafting test plans, establishing mocks for input/output Ports, and simulating edge cases. 

*Note:* `ka-test` acts as the project's testing methodology benchmark and coding template. It does not run as an independent state in the main orchestrator loop; rather, its rules and examples are loaded by developer agents (`ka-be`, `ka-fe`) to guide test implementation during the executing/verifying states.

---

## 2. Test Suite Design Standards

### A. Mocking Rules for Ports & Adapters
*   **Mock Ports (Interfaces) Only**: Do not mock concrete implementation classes.
*   **Explicit Mock Setup**: Use library assertions (e.g. `jest.fn()`) or custom mock classes to emulate the network/infrastructure boundary behavior.

### B. Mandatory Boundary Edge Cases
Every test suite must verify these critical boundary conditions:
*   **Database Faults**: Simulate connection drops or index duplicate collisions (Unique Constraint Violation) to verify that transaction rollback logic triggers cleanly.
*   **Tenant Leak Attack**: Emulate an IDOR attack by querying database assets using a valid user ID but bound to an unauthorized `organizationId`, asserting that queries throw authorization errors or return empty results.
*   **State Machine Violations**: Attempt to invoke state transitions out of sequence (e.g., trying to approve a draft order that is not in the pending state) to confirm that Domain Entities throw validation exceptions.

---

## 3. Database Integration Test Blueprint (Drizzle + PGLite)

```typescript
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { DrizzleProductRepository } from '../product.repository';
import { products } from '../schema/product.schema';

describe('DrizzleProductRepository Integration', () => {
  let pglite: PGlite;
  let db: any;
  let repo: DrizzleProductRepository;

  beforeAll(async () => {
    pglite = new PGlite();
    db = drizzle(pglite);
    // Initialize schema tables in the in-memory database instance
    await pglite.exec(createTableSQL);
    repo = new DrizzleProductRepository(db);
  });

  afterAll(async () => {
    await pglite.close();
  });

  it('should enforce Tenant Isolation on findById', async () => {
    // 1. Seed sample data bound to Org A
    await db.insert(products).values({
      id: 'prod-123',
      organizationId: 'org-A',
      name: 'Sample Product Name',
      price: 10000,
    });

    // 2. Attempt query using Org B context context
    const result = await repo.findById('prod-123', 'org-B');

    // 3. Assert result is null, verifying data isolation
    expect(result).toBeNull();
  });
});
```

---

## 4. 4-Step Testing Workflow
When implementing tests during coding phases, follow this lifecycle:
1.  **Scope Analysis**: Review source files to list the business methods and logic branches that require coverage.
2.  **Test Case Design (`xx_test_plan.md`)**: Draft a plan listing happy path, error path, and boundary test cases.
3.  **Test Code Implementation**: Code the tests inside `.spec.ts` or `_test.go` files matching the project test configuration.
4.  **Verification**: Execute the test commands and verify that code coverage targets defined in the testing pyramid are met:
    ```bash
    npm run test -- --coverage
    ```
