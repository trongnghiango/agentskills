---
name: ka-intake
description: Requirement completeness checker. Before any design or execution work begins, verifies the request contains enough business-level detail (actor, trigger, input, expected output, success criteria, edge cases, constraints, scope boundary) to act on without the AI silently filling gaps with assumptions. Asks batched clarifying questions when information is missing and matters to the outcome. Invoked automatically by the always-on Intake Rule in CLAUDE.md, not typed directly by the user.
license: Proprietary - internal ka-team use only
compatibility: Designed for Claude Code. Loaded via the always-on rule in CLAUDE.md — see references/completeness-checklist.md for the field checklist this rule points to.
metadata:
  version: "1.0.0"
  risk: low
  source: custom-ka-team
user-invocable: false
allowed-tools: Read
---

# Ka Intake — Requirement Completeness Check

## Purpose
Sits before `ka-plan` and `ka-execute` in every request. Its only job is to answer one question honestly: **does this request already contain enough business-level detail to act on without guessing?** If not, it asks — instead of letting the AI quietly fill the gap with a "reasonable" assumption that may not match what the user actually wants.

This is not the same job as `ka-plan`'s D1 Socratic exploration. `ka-plan` challenges *design* assumptions ("why are we doing this, what breaks at scale"). `ka-intake` checks *requirement* completeness ("do we even know who the actor is, what triggers this, what counts as success") — a request can be technically unambiguous in design terms while still missing basic business facts. Both can fire on the same request; `ka-intake` runs first.

## When this activates
Triggered by the always-on Intake Rule in `CLAUDE.md` on every request, before `ka-workflow`/`ka-plan`/`ka-execute` begin work — **not** typed directly (`user-invocable: false`). Skipped only if the request already references a locked `decisions.json` entry (intake was already done for that decision).

## Dual Execution Modes (Socratic vs Fast-Track)

`ka-intake` operates in one of two modes depending on the request nature:

### Mode A: Fast-Track Autonomous Mode (Bypass Questions)
**Kích hoạt khi**:
1. User cung cấp một trong các template mẫu từ `templates/` (`fast-track-feature.md`, `fast-track-hotfix.md`, `fast-track-worker.md`, `fast-track-refactor.md`).
2. User sử dụng các từ khóa gia tốc: *"fast-track"*, *"tự hành"*, *"triển khai nhanh"*, *"bỏ qua phỏng vấn"*, *"không hỏi vòng vo"*, *"làm ngay"*.
3. Request đã có đủ 5/8 trường cốt lõi và các trường còn lại thuộc nhóm có thể tự suy luận an toàn từ codebase.

**Hành vi trong Fast-Track Mode**:
- **KHÔNG HỎI BẤT KỲ CÂU NÀO** (Bypass Step 2 batched questions).
- Tự động điền các giá trị mặc định chuẩn mực dựa trên codebase (convention over configuration).
- Tóm tắt yêu cầu trong 3 dòng dứt khoát:
  ```text
  ⚡ FAST-TRACK ACTIVATED:
  • Mục tiêu: <Core Goal>
  • Ranh giới: <In-scope vs Out-of-scope>
  • Tiêu chuẩn: Clean Architecture 4 tầng + TDD + Single Screen Rule
  ```
- Lập tức chuyển sang `ka-plan` (để khóa `decisions.json` trong 1 turn) hoặc `ka-execute` để tự hành 100%.

### Mode B: Socratic Exploration Mode (Phỏng vấn Khai phá)
**Kích hoạt khi**: Request ngắn gọn, mơ hồ, chưa rõ actor hay mục tiêu nghiệp vụ cốt lõi và KHÔNG bật cờ fast-track. Tiến hành theo Step 1 đến Step 4 bên dưới.

## Step 1 — Run the checklist
Check the request against `references/completeness-checklist.md`. For each field, classify as:
- **Present** — stated explicitly or unambiguously implied by context already in the conversation.
- **Missing but safe to default** — a technical detail with no business consequence (e.g. variable naming, code style) — do not ask.
- **Missing and material** — could change the outcome, scope, or correctness if guessed wrong — must ask.

## Step 2 — Ask, batched
If any field is "Missing and material", ask for **all of them in a single message**, not one at a time.
```
🗣️ Để làm đúng, mình cần biết thêm:
1. <field>: <question>
2. <field>: <question>
[...]
```
🛑 **HARD STOP** — wait for the user's reply.

**Limit: at most 2 rounds of batched questions.** If material gaps remain after round 2, state your best-guess interpretation explicitly, flag it as an assumption, and proceed — do not loop a third time. This mirrors the same loop-exit pattern already used in `ka-plan`'s D1.

## Step 3 — Confirm the completed requirement
Once all material fields are resolved (answered or explicitly flagged as an assumption), restate the requirement back in 2-4 sentences and proceed — no need for a separate yes/no here if the restatement is uncontroversial; only re-confirm if the user's answers were themselves ambiguous.

## Step 4 — Hand off
Pass the completed requirement forward:
- If it implies a design/architecture decision → `ka-workflow` routes to `ka-plan`.
- If it's a concrete, already-scoped action → `ka-workflow` routes to `ka-execute` directly.

`ka-intake` does not decide which of these two paths to take — that classification still belongs to `ka-workflow`/`ka-plan`. `ka-intake` only guarantees the input to that classification is complete.

## References
- `references/completeness-checklist.md` — the fields checked in Step 1, with worked examples of "material" vs "safe to default".
- `references/eval-cases.md` — should-ask / should-not-ask test prompts.
- `ka-plan` — design reasoning, runs after intake if a design question is triggered.
- `ka-workflow` — routes the completed requirement to the right next skill.
