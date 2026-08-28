---
name: ka-handoff
description: Compact the current conversation into a handoff document for another agent to pick up.
argument-hint: "What will the next session be used for?"
---

## Output location

| Item | Rule |
|---|---|
| Directory | `docs/handoff/` (create if it does not exist) |
| Filename | `{yyyy-MM-dd-HHmmss}_handoff[-{slug}].md` |
| Slug source | Argument text if provided, else inferred focus of the conversation |
| Slug format | lowercase, spaces → `-`, strip any char outside `[a-z0-9-]`, max 60 chars |
| Collisions | Timestamp granularity is seconds — do not overwrite; if a collision still occurs, append `-2`, `-3`, ... |
| Latest pointer | After writing, copy the same content to `docs/handoff/latest.md` (full copy, not a symlink — cross-platform safe). Overwrite `latest.md` every time. |

## Required sections (in order)

| Section | Content |
|---|---|
| Focus | Argument text if provided, else inferred from conversation |
| Handoff reason | One of: `context-limit` / `phase-complete` / `blocked` / `user-initiated` |
| Repo state | Current branch, HEAD commit hash, dirty/uncommitted files (`git status --short` output) |
| State | Current status, one paragraph max |
| Verification | Last known build/test result (pass/fail) + exact command to re-verify |
| Constraints | Do-not-touch areas, non-negotiables, anything explicitly out of scope |
| Risk context | Current risk tier per CLAUDE.md four-tier ladder, if the work touches a classified operation |
| Artifacts | Links/paths to PRDs, plans, ADRs, issues, commits, diffs — reference only, do not duplicate content |
| Decisions | Pull from `decisions.json` if present in the workspace; else summarize inline |
| Next steps | Ordered list, actionable |
| Blockers | Open questions / unresolved risks |
| Prior handoff | Path to the previous handoff file in this chain, if one exists (check `docs/handoff/latest.md` before overwriting it) |
| Suggested skills | From `.claude/skills/` (or configured registry) matching Next steps — name + one-line reason |

## Rules

- Redact secrets/PII (API keys, tokens, passwords, personal data) before writing — replace with `[REDACTED]`, never omit the surrounding context silently.
- If a required section has no content, write `N/A` — do not omit the header.
- Do not duplicate content already captured in other artifacts (PRDs, plans, ADRs, issues, commits, diffs). Reference them by path or URL instead.
- If the user passed arguments, treat them as a description of what the next session will focus on and tailor the doc accordingly.
- Before writing, read the existing `docs/handoff/latest.md` (if any) and capture its path in "Prior handoff" — do this before it gets overwritten.
- Gather repo state and verification status via actual commands (`git status`, `git rev-parse HEAD`, test runner), not from memory of the conversation.
- After writing both files, confirm success (file exists, non-empty) before reporting completion to the user.
- Report back to the user: the timestamped file path, and that `latest.md` was updated.