# Audit bộ skill ka-* — 2026-11-25

Phạm vi: `skills/` (14 skill), `standards/`, `runtime-templates/workflow.json`, `AGENTS.md`. Đối chiếu với các bộ skill công khai cho coding agent (2025–2026). Trọng tâm: testing/TDD.

## 1. Kết luận điều hành

Bộ skill mạnh ở **thiết kế → triển khai backend → review kiến trúc**. Yếu ở **kiểm thử**, và gần như trống ở **vận hành sau deploy** (perf, observability, release, incident, legacy).

Điểm ước lượng theo trục (0–10):

| Trục | Điểm | Ghi chú |
|---|:-:|---|
| Requirements / intake | 8 | ka-intake có checklist, 2 mode, batched questions |
| Design / architecture | 9 | ka-plan + ka-think, gate D2, decisions.json |
| Backend implementation | 9 | ka-be 203KB, 6 stack (NestJS, Hono, Go, Java, Python, STAX) |
| Frontend implementation | 7 | ka-fe mạnh về SD-UI, **0 đề cập test** |
| DB schema | 8 | Drizzle + migration, blueprint PGLite |
| API contract | 6 | design-only (Zod/OpenAPI/Orval), không có verify |
| **Testing / TDD** | **2** | ka-test 113 ký tự mô tả, không có TDD loop, không gate |
| Code review | 7 | audit matrix 13 mục, grep cụ thể |
| Ops / deploy | 6 | Docker/K8s, thiếu release/rollback/flag |
| Security | 4 | pattern-based, thiếu threat model, secret scan, dep audit |
| Performance | 2 | chỉ có 1 dòng SQL perf trong review |
| Observability | 0 | không có |
| Docs / handoff | 4 | chỉ ka-handoff |
| Release / versioning | 1 | không có |
| Debug / incident | 1 | chỉ recovery protocol của git-guardian |
| Refactor / legacy | 1 | không có |
| Accessibility | 0 | không có |
| Supply chain | 0 | không có |

Trung bình ~4,3/10; nhưng lệch mạnh: pipeline "happy path" tốt, vòng phản hồi (test/debug/verify) yếu.

## 2. Phương pháp

- Đọc toàn bộ 14 `SKILL.md` (65 file, ~370KB), frontmatter, references, templates, examples.
- Đếm từ khoá theo skill (test/coverage/mutation/flaky/tdd), kiểm tra catalog DSH (mô tả bị cắt ở 500 ký tự).
- Kiểm tra `runtime-templates/workflow.json` (state machine) và `references/gates.md`.
- So sánh với: anthropics/skills, obra/superpowers, jeffallan/claude-skills (test-master), mthines/agent-skills (tdd, e2e-testing), zeroes-ones tdd-guide, testcontainers/claude-skills, PactFlow agent skills.

## 3. Hiện trạng 14 skill

| Skill | Vai trò | Kích thước | Trigger trong description | Gọi tay | Test |
|---|---|---|:-:|:-:|:-:|
| git-guardian | An toàn git | 18,8KB / 4 file | yếu (520 ký tự, bị cắt) | ✓ | – |
| ka-intake | Lọc yêu cầu | 19,7KB / 7 | mạnh (449) | ✓ | – |
| ka-plan | Chốt thiết kế | 24,4KB / 7 | mạnh (357) | ✓ | không |
| ka-think | Tư duy có cấu trúc | 11,1KB / 1 | vừa (161) | ✓ | – |
| ka-execute | Router thực thi | 10,5KB / 3 | vừa (507, bị cắt) | ✓ | – |
| ka-workflow | Điều phối vòng đời | 12,8KB / 5 | vừa (489) | ✓ | 2 dòng |
| ka-be | Backend dev | 203KB / 20 | yếu (176) | ✗ | 6 dòng |
| ka-fe | Frontend dev | 20,7KB / 7 | rất yếu (85) | ✗ | **0** |
| ka-db-schema | Schema/Drizzle | 7,3KB / 2 | yếu (154) | ✗ | không |
| ka-contract | Hợp đồng API | 10,5KB / 3 | yếu (160) | ✓ | không |
| ka-test | Test architect | 15,5KB / 3 | yếu (113) | ✗ | toàn bộ |
| ka-review | Audit code | 9,4KB / 2 | rất yếu (106) | ✓ | không |
| ka-ops | DevOps | 12KB / 3 | rất yếu (91) | ✗ | không |
| ka-handoff | Handoff | 3,7KB / 1 | yếu (86) | ✓ | – |

Catalog DSH ~966 token/session cho 14 mô tả. Hai mô tả vượt 500 ký tự (git-guardian 520, ka-execute 507) → bị cắt, mất trigger cuối.

## 4. Phủ theo vòng đời

`Intake → Design → Contract → Schema → BE/FE → Test → Review → Deploy → Operate → Maintain`

| Bước | Có skill? | Chất lượng | Khoảng hở chính |
|---|:-:|---|---|
| Intake | ✓ | cao | không có checklist riêng cho bug report/incident |
| Design | ✓ | cao | không có template ADR, không có test strategy |
| Contract | ✓ | vừa | không verify consumer/provider |
| Schema | ✓ | vừa | không test migration trên Postgres thật |
| BE | ✓ | cao | TDD không bắt buộc |
| FE | ✓ | vừa | **không test gì**: component, a11y, visual baseline |
| Test | ✓ | **thấp** | xem mục 5 |
| Review | ✓ | vừa | thiếu security depth, perf, a11y |
| Deploy | ✓ | vừa | thiếu rollback, feature flag, canary |
| Operate | ✗ | – | observability, SLO, incident |
| Maintain | ✗ | – | legacy/refactor, dep upgrade |

## 5. Trọng tâm: testing / TDD

### 5.1 Bằng chứng

- `TDD` xuất hiện **1 lần** trong toàn repo: `skills/ka-intake/SKILL.md:43`, như một nhãn trong danh sách tiêu chuẩn — không có quy trình.
- `ka-test` (v2.0.0) có 4 bước: Scope Analysis → Test Case Design → Implementation → Verification (`skills/ka-test/SKILL.md:90-98`). Không có test-first, không có red-green-refactor, không "watch it fail".
- Coverage chỉ là "verify targets defined in the testing pyramid are met" + `npm run test -- --coverage` — **không con số, không gate**.
- `ka-fe`: 0 đề cập test.
- `workflow.json`: `LOCKED_DECISION.EXECUTE_TEST → BUILD_DONE`; từ `BUILD_DONE` có thể đi thẳng `COMPLETION_GATE`. Không có `TEST_GATE` → **có thể bỏ qua test hoàn toàn** mà workflow vẫn xanh.
- `ka-plan` không yêu cầu đầu ra test strategy; `handoff-schema.md` có dòng "New or updated test coverage" nhưng không bắt buộc.

### 5.2 Khoảng hở so với chuẩn ngoài

| # | Hạng mục | Hiện trạng | Chuẩn tham chiếu | Ưu tiên |
|---|---|---|---|---|
| T1 | TDD loop (red → green → refactor, chứng kiến fail) | không có | superpowers `test-driven-development`: "Iron Law — NO PRODUCTION CODE WITHOUT A FAILING TEST" + bảng rationalizations | P0 |
| T2 | Test-first cho bug fix | không có | test tái hiện bug trước khi sửa | P0 |
| T3 | Characterization test cho code cũ | không có | zeroes-ones route A4 | P1 |
| T4 | Coverage policy có số | không | mutation score ≥ 85% thay vì line coverage | P1 |
| T5 | Property-based test | không có | fast-check/Hypothesis, invariants | P2 |
| T6 | Mutation testing | không có | Stryker/pitest | P2 |
| T7 | Contract verify (consumer/provider) | chỉ design | PactFlow: consumer → provider verify → `can-i-deploy` | P1 |
| T8 | Flaky test (quarantine, healer cap) | không có | mthines e2e: healer tối đa 3 lần rồi escalate | P1 |
| T9 | Test data factory (seed cố định, không `Date.now()`) | không có | zeroes-ones TDD11 | P1 |
| T10 | Layer decision (unit vs integration vs e2e) | chỉ "pyramid" 1 câu | mthines `rules/layer-decision.md` | P1 |
| T11 | FE test: component (RTL + MSW), a11y | không có | jeffallan `accessibility-testing`, mthines `/ui-verify` | P1 |
| T12 | Visual baseline diff | có 4-stage screenshot, không có baseline | Playwright snapshot + baseline cache | P2 |
| T13 | Load/perf test (k6, p95/p99) | không có | test-master `performance-testing.md` | P2 |
| T14 | CI sharding/parallel | không có | zeroes-ones TDD4 "shardable" | P2 |
| T15 | Test plan trong design | không bắt buộc | mthines "one sealed runnable check per goal" | P0 |
| T16 | Test evidence ở gate | không có | "CHECKS n/n PASS" | P0 |

### 5.3 Chất lượng kỹ thuật trong ka-test

- Blueprint PGLite dùng `let db: any` (`skills/ka-test/SKILL.md` mục 3) — vi phạm chính quy tắc Zero `any` của ka-review. Nên dùng `PgliteDatabase<typeof schema>`.
- Test seed inline bằng SQL thủ công, không factory/builder.
- Không có assertion pattern (expect theo behavior vs implementation) — làm test dễ vỡ khi refactor.
- Mocking rule chỉ 2 dòng, thiếu: không mock behavior của chính code đang test, không mock nội bộ module.

## 6. Landscape tham chiếu

| Bộ | Điểm đáng học |
|---|---|
| [obra/superpowers](https://github.com/obra/superpowers) | TDD Iron Law, bảng chống ngụy biện, skill auto-trigger bằng "using-superpowers" |
| [jeffallan/claude-skills](https://github.com/jeffallan/claude-skills) | `test-master` phân tầng unit/int/e2e/perf/security; `legacy-modernizer` |
| [mthines/agent-skills](https://github.com/mthines/agent-skills) | "thin index, do not preload"; `rules/layer-decision.md`; healer cap; eval with/without skill |
| [zeroes-ones tdd-guide](https://github.com/zeroes-ones/Skills/blob/main/skills/06-quality/tdd-guide/SKILL.md) | Routing A1–A9 (greenfield/bug/legacy/mutation/property/contract), negative constraint có mechanical trigger, mutation ≥ 85% |
| [PactFlow agent skills](https://docs.pact.io/ai_tools/installation) | Contract testing end-to-end + `can-i-deploy` |
| [anthropics/skills](https://github.com/anthropics/skills) | Progressive disclosure tới mức "đừng đọc source script" |

Bài học chung: skill chất lượng cao = **index mỏng + rules/ quyết định + references/ nội dung + checklist đánh số + vòng verify đóng + eval**.

## 7. Lỗ hổng ngoài testing

| Hạng mục | Hiện trạng | Đề xuất |
|---|---|---|
| Security depth | pattern grep | threat model theo diff, secret scan, `pnpm audit`/OSV, authz matrix |
| Performance | 0 | budget (p95, bundle size), profiling recipe |
| Observability | 0 | log/metric/trace convention, SLO, dashboard check sau deploy |
| Release | 0 | semver, changelog, feature flag, canary, rollback |
| Debug/incident | 0 | systematic debugging: reproduce → minimize → bisect → fix → regression test |
| Legacy/refactor | 0 | characterization test + strangler fig |
| A11y | 0 | checklist WCAG + test tự động |
| Dep/supply chain | 0 | lockfile audit, license, pin policy |
| Docs | chỉ handoff | docs audit theo diff, ADR template |
| ADR | chỉ gate | template + thư mục `docs/adr/` |

## 8. Vấn đề cấu trúc

1. **Frontmatter lỗi thời**: 14/14 skill ghi `compatibility: Designed for Claude Code`; sau khi chuyển sang AGENTS.md là sai.
2. **`allowed-tools` kiểu Claude Code** (`Bash(node ...:*)`) — DSH không hiểu, gây hiểu nhầm về quyền.
3. **Trigger yếu**: 8/14 description không có "Use when…"; 6 skill không có anti-trigger. Model chỉ load khi trúng tên skill.
4. **Mô tả > 500 ký tự** → DSH cắt (git-guardian, ka-execute).
5. **Eval thiếu**: chỉ 6 skill có `references/eval-cases.md`; ka-test, ka-review, ka-intake, ka-workflow, ka-think không có.
6. **Workflow thiếu gate test** (mục 5.1) và không có state cho debug/refactor.
7. **ka-test là thư viện, không phải actor**: mô tả ghi "does not run as independent state" — nghĩa là không ai chịu trách nhiệm chạy test.

## 9. Đề xuất

### P0 — làm ngay (1 tuần)

1. **Biến ka-test thành TDD authority**:
   - Thêm `references/tdd-loop.md`: Iron Law (không code production khi chưa có test fail), red → green → refactor, bắt buộc dán output fail trước khi sửa, bảng "Common Rationalizations" + "Red Flags".
   - Thêm `references/test-design-catalog.md`: bảng chọn tầng (unit/integration/e2e) theo loại thay đổi; happy/error/boundary bắt buộc.
   - Thêm `templates/factory.ts`, `templates/spec.spec.ts` (RTL + MSW cho FE).
   - Sửa blueprint PGLite: bỏ `any`, dùng factory.
2. **TEST_GATE trong workflow**: `EXECUTE_TEST → TEST_GATE → BUILD_DONE`; gate yêu cầu evidence (lệnh test + kết quả + coverage delta). Không có evidence → `BLOCKED`.
3. **ka-plan xuất test strategy**: thêm mục bắt buộc vào handoff (`test_plan`: AC → test level → case list).
4. **ka-fe có mục Testing**: component test, MSW, a11y assertion, visual baseline.

### P1 — 2–3 tuần

5. Contract verify: mở rộng ka-contract (consumer test, provider verify, `can-i-deploy`) hoặc skill `ka-contract-verify`.
6. Skill `ka-debug` (systematic debugging + regression test bắt buộc sau fix).
7. Security depth trong ka-review: threat model theo diff, secret scan, dep audit.
8. Flaky policy + quarantine + healer cap trong ka-test.

### P2 — sau

9. `ka-perf` (budget + k6 + profiling).
10. `ka-release` (semver, changelog, feature flag, rollback, post-deploy verify).
11. Property-based + mutation testing (Stryker) trong ka-test.
12. `ka-refactor` (legacy + characterization test).
13. A11y checklist.
14. Observability convention.

### Sửa cấu trúc (làm cùng P0)

- Chuẩn hoá frontmatter: `compatibility` → DSH; bỏ `allowed-tools` Claude-only hoặc map sang permission preset.
- Mọi description < 500 ký tự, có "Use when <trigger>" + "Do NOT use for <anti-trigger>".
- Thêm eval cho ka-test, ka-review, ka-intake, ka-workflow.

## 10. Lộ trình & nghiệm thu

| Phase | Nội dung | Nghiệm thu |
|---|---|---|
| 1 | TDD loop + TEST_GATE + test plan trong ka-plan | workflow không thể sang BUILD_DONE khi thiếu test evidence; eval ka-test pass |
| 2 | Contract verify, ka-debug, security depth, flaky | mỗi skill có eval-cases; ka-review bắt được secret/dep |
| 3 | perf, release, property/mutation, refactor, a11y | có skill + template + eval; catalog vẫn < 1.100 token |

## 11. Phụ lục — lệnh kiểm tra

```bash
# đếm trigger/test
grep -ril "tdd\|red-green\|mutation\|property-based\|flaky" skills standards

# mô tả dài quá 500 ký tự
python3 -c "import glob,re, yaml; [print(f.split('/')[0], len(yaml.safe_load(open(f).read().split('---')[1])['description'])) for f in glob.glob('skills/*/SKILL.md') if len(yaml.safe_load(open(f).read().split('---')[1])['description'])>500]"

# kiểm tra gate
grep -n "TEST" runtime-templates/workflow.json
```

---

## Trạng thái triển khai (2026-11-25)

| Ưu tiên | Hạng mục | Trạng thái |
|---|---|---|
| P0 | TDD loop, TEST_EVIDENCE_GATE, test_plan, FE testing | ✅ (ka-test 3.1.0, workflow v2) |
| P1 | Contract verify, ka-debug, security depth, flaky policy | ✅ (ka-contract 5.0.0, ka-debug 1.0.0, ka-review 2.4.0) |
| P2 | perf, release/rollback, observability, refactor/legacy, a11y, property+mutation | ✅ dạng references (không thêm skill mới) |
| Cấu trúc | mô tả < 500 ký tự, compatibility DSH, eval cases | ✅ 15 skill, 6 eval |

Còn mở: ADR template, docs audit, CI sharding, incident/postmortem.

### Cập nhật lần 2 (enforcement + eval + artifact)

| Hạng mục | Trạng thái |
|---|---|
| Gate enforcement | ✅ `state-manager.js` validate evidence, 7 test |
| Pre-commit + CI | ✅ lint-skills, gitleaks, node --check, gate test, evals static |
| Eval harness | ✅ `scripts/run-evals.mjs` (static + llm mode), 72 case / 15 skill |
| ADR template | ✅ `templates/ADR.md`, wired vào ka-plan COMPLEX_MODE |
| Postmortem | ✅ `templates/POSTMORTEM.md`, wired vào ka-debug |
| CI sharding | ✅ `ka-ops/references/ci-test-sharding.md` |
| Eval coverage | ✅ 15/15 skill có eval-cases |

Điểm ước lượng: ~8,1/10. Còn thiếu để 9+: chạy LLM eval thật và ghi nhận pass rate; CI xanh thật trên GitHub; state-manager được copy vào các repo đích; docs audit.
