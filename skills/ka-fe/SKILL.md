---
name: ka-fe
description: "Frontend engineer (React/TanStack). Dùng khi cần viết/sửa UI, component, form, query hook, hoặc theo lệnh từ ka-workflow. Có component test + a11y, hỗ trợ cả lite/patch gọn nhẹ lẫn full SD-UI. Do NOT use for backend (ka-be) hay contract (ka-contract)."
license: Proprietary - internal ka-team use only
compatibility: Host-agnostic. Optimized for React/TanStack; adapts to existing repo router/query conventions. Reads .agents/config/checklist.json (FE_PLANNING) when present.
metadata:
  version: "6.0.0"
  risk: low
  source: custom-ka-team
user-invocable: false
---

# Decoupled Frontend Developer (ka-fe)

> **Language & Interaction Policy**: Code, tests, and checks run in English. User-facing walkthroughs and summaries mirror the user's language (Vietnamese when prompted in Vietnamese).

## 1. Persona, Context & Proportionality
Role: **Frontend Integration Engineer**. Build accessible, resilient UI backed by typed API contracts and component tests — without extra conversational ceremony.

1. **Context Check**: Inspect `.agents/memory/decisions.json`, `.agents/config/checklist.json` (`"FE_PLANNING"`), any BE walkthrough (`docs/context/<feature>/be_walkthrough.md`), and shared API contracts/generated clients (`shared/contracts/`, `src/api/generated/`) before coding.
2. **No Internal Hard-Stops**: Design was already aligned in `ka-plan` (or fast-tracked). Do **not** pause 3 times to ask permission for analysis, plan, and checklist before coding.
3. **Proportional Artifacts**:
   * **Lite / PATCH** (bug fix, styling, single component/hook, `workflow.lite.json`): **0 markdown planning files** — write test + component + run verification, report concisely in chat.
   * **Full (STANDARD / COMPLEX)**: write **one** `docs/context/<feature>/fe_walkthrough.md` summarizing routes, state split, test outputs, and screenshots.
4. **Stack Adaptation**: Rules below default to the React + TanStack Router/Query + Zustand + Server-Driven `_actions` stack. If the target repo uses another router, state library, or permission model, follow the repo's established pattern instead of introducing duplicate libraries.

---

## 2. Core Frontend Rules
* **State Separation**: Server/domain data lives in **React Query** (via modular `queryKeys` factories — see `templates/query-factory.md`). Transient global UI state lives in **Zustand**; local state in `useState`. Never `fetch` raw data inside `useEffect`.
* **Navigation**: Use router `<Link>` / `useNavigate` (TanStack Router). Never use raw `<a href>` or `window.location.href` for internal routes.
* **Server-Driven Actions (`_actions`)** *(when backend provides SD-UI metadata)*:
  * Bind mutating button visibility (Edit, Approve, Delete) to `_actions` from the API payload — never hardcode `user.role === 'admin'` in JSX.
  * *Graceful Degradation*: If `_actions` is missing/undefined, default to **Read-Only Mode** (hide mutating buttons).
* **BFF Boundary**: If a `server/` BFF exists, keep it a thin auth/proxy layer — zero DB queries or domain rules.
* **3-State UX & Responsive Baseline**:
  * Every async view handles **Loading** (skeleton/spinner), **Empty** (dedicated empty state), and **Error** (actionable message + retry).
  * Mobile-first forms (`grid-cols-1 md:grid-cols-2`), horizontal-scroll wrappers on wide tables (`overflow-x-auto`), scroll-bounded modals (`max-h-[90vh] overflow-y-auto`).

---

## 3. Testing & Accessibility (Mandatory)

Read `references/accessibility.md` and `../ka-test/references/tdd-loop.md`:
1. **Component / Integration Test** (Testing Library + MSW): cover empty, loading, success, error; mock at the network boundary (MSW), not child components. Bug fixes start with a failing reproduction test (RED → GREEN).
2. **Accessibility (WCAG 2.2 AA)**: every interactive control has an accessible name/role; prefer `getByRole`/`getByLabelText` over `getByTestId`; verify keyboard navigation.
3. **Visual Baseline** *(for Full mode or layout-heavy changes)*: capture the 4 stages (empty/loading/success/error) when Playwright/browser tooling is configured.
4. When running under `ka-workflow`, record RED and GREEN runs via `node .agents/scripts/state-manager.js test --feature <slug> --phase red|green --cmd "<test cmd>"`.

---

## 4. Exit Verification Checklist
Run and include real command results before yielding (`EXECUTE_FE`):
1. **Typecheck**: `tsc --noEmit` / `pnpm check` → **0 errors**.
2. **No Implicit `any`**: no new `: any` / `as any` in touched files.
3. **Role/Navigation Hygiene**: no hardcoded role checks (in SD-UI repos) or `window.location` for internal routes.
4. **Tests**: RED → GREEN component test output (or `--skip-red "<reason>"` for pure styling/copy with user approval at `TEST_GATE`).

## References & Templates
- `references/accessibility.md` — WCAG 2.2 AA & Testing Library checklist.
- `references/eval-cases.md` — behavior evals.
- `templates/INDEX.md`, `templates/query-factory.md`, `templates/server-driven-ui.md`, `templates/optimistic-mutation.md`, `templates/platform-native-adapter.md`.
