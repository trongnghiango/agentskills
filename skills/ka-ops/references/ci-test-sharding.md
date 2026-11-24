# CI Test Sharding & Parallelism

## 1. Khi nào cần shard

- Suite > 5 phút trên 1 runner.
- Có nhóm test độc lập (unit / integration / e2e) dễ tách.
- PR phải chờ lâu vì CI tuần tự.

## 2. Shard theo công cụ

```bash
jest --shard=1/4            # Jest
vitest run --shard=1/4      # Vitest
npx playwright test --shard=1/4
```

## 3. GitHub Actions matrix

```yaml
jobs:
  test:
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3, 4]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm test -- --shard=${{ matrix.shard }}/4
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: test-report-${{ matrix.shard }}
          path: reports/
```

## 4. Cân bằng shard

- Chia theo **thời gian chạy** đo được, không theo số file.
- Lệch > 1.5× → cân bằng lại hoặc tách nhóm chậm.
- E2E để shard riêng, không trộn unit.

## 5. Quy tắc

- Mỗi shard độc lập: DB riêng (transaction/template), không share port.
- Upload report + screenshot + trace kể cả khi fail.
- Không shard test có side-effect toàn cục (migration, seed chung).
- Cache dependency giữa shard.
- Mục tiêu: shard chậm nhất < 5 phút.
