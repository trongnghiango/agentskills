---
name: git-guardian
description: "Git safety layer. MANDATORY before ANY git command (status, add, commit, push, checkout, rebase, reset, stash, merge): branch protection, safe checkouts, commit policy, disaster prevention. Triggers: git, commit, branch, push, pull, merge, rebase, stash, worktree, diff, tạo nhánh, đẩy code, kéo code, gộp nhánh. Do NOT use for non-git tasks."
license: Proprietary - internal ka-team use only
compatibility: Host-agnostic. Enforces git safety rules across all git operations.
metadata:
  version: "2.2.0"
  risk: low
  source: custom-ka-team
user-invocable: false
---

# Git Guardian — Standard Operating Procedure

> **Supreme Principle**: Repository safety precedes task completion.
> Preserving the user's uncommitted work precedes saving time.

> **Language & Interaction Policy**: Autonomous execution, risk classification, and git commands run strictly in English. When prompting the user (dirty repository warning, commit confirmation, error recovery reporting, post-flight status), ALWAYS communicate in the user's prompt language (defaulting to Vietnamese when the user prompts in Vietnamese).

---

## 0. Pre-flight Checklist (ALWAYS run before touching any file)

Before inspecting or modifying files, execute mentally and in reality:

```
[ ] Read the task carefully — understand the exact requirements
[ ] git status              → Is the repository dirty?
[ ] git branch --show-current → What is the current active branch?
[ ] git rev-parse HEAD      → What is the current HEAD commit hash?
[ ] Are there staged files?
[ ] Is a merge or rebase in progress?
[ ] Are there stash entries? (git stash list)
```

**Only proceed when the repository is in a safe state.**

If the repository is dirty → prompt the user in their language (e.g., Vietnamese: *"Repository có uncommitted changes. Tôi có thể tiếp tục không?"* / English: *"Repository has uncommitted changes. May I proceed?"*).

---

## 1. Core Principles

```
1. Never assume — always inspect actual git state.
2. Never guess — when in doubt, stop and ask.
3. Never conceal errors — report failures immediately.
4. Explain git commands BEFORE execution.
5. Every git operation must be reversible whenever possible.
6. Confidence < 95% → STOP → Ask the user.
```

---

## 2. Mandatory Rules

For detailed group rules: see `references/rules.md`.

**Quick Reference:**

| Rule | Rule Name | Description | Severity |
|------|-----------|-------------|----------|
| **R1** | No autonomous branch switching | Only switch branches when explicitly requested | FORBIDDEN |
| **R2** | No history modification | No reset --hard, no rebase -i, no amend on pushed commits | FORBIDDEN |
| **R3** | No autonomous stash | Never stash uncommitted work without permission | FORBIDDEN |
| **R4** | No force push | Force pushing (`--force`, `-f`) is strictly banned | FORBIDDEN |
| **R5** | No autonomous commit | Always ask confirmation before committing | ASK FIRST |
| **R6** | Inspect before edit | Check branch and clean state before editing | MANDATORY |
| **R7** | No edits outside scope | Strictly touch only files within task boundary | FORBIDDEN |
| **R8** | No discarding changes | Never run `git checkout -- .` or `git restore .` | FORBIDDEN |
| **R9** | Dirty repo alert | Always ask when untracked/dirty changes exist | MANDATORY |
| **R10** | Post-task report | Provide diffstat and status after task completion | MANDATORY |

---

## 3. Command Risk Classification

```
SAFE        → git status, git log, git diff, git branch -a, git show, git rev-parse
WARNING     → git add, git commit (Must ask user first)
DANGEROUS   → git merge, git cherry-pick, git rebase (Requires explicit confirmation)
FORBIDDEN   → git reset --hard, git push --force, git clean -fd,
              git checkout (unprompted), git stash (unprompted)
```

See full classification table: `references/command-classification.md`.

---

## 4. Decision Trees

### 4.1 — Should I switch branches?

```
Need to switch branch?
      ↓
Did the user EXPLICITLY request it?
      ↓
   YES → Checkout / Switch         NO → DO NOT switch
```

### 4.2 — Should I commit changes?

```
Task completed?
      ↓
Did user enable explicit auto-commit?
      ↓
   YES → Commit        NO → Ask user: "May I commit these changes with message X?"
```

### 4.3 — Encountered a Git error?

```
Error occurred?
      ↓
STOP IMMEDIATELY
      ↓
Do NOT attempt autonomous self-recovery
      ↓
Report full state and error to user
      ↓
Wait for user instructions
```

### 4.4 — Repository dirty?

```
git status → has changes?
      ↓
   YES → Ask user before proceeding
   NO  → Proceed normally
```

---

## 5. Branch Policy

**Allowed working branches:**
```
feature/*
bugfix/*
fix/*
docs/*
experiment/*
agent/*
chore/*
hotfix/*
```

**FORBIDDEN branches — Never operate directly without explicit user override:**
```
main
master
release/*
production
prod
staging
```

If currently on `main` or `master`: **STOP** — alert the user immediately.

---

## 6. Commit Policy

```
One logical change = One commit

DO NOT mix in a single commit:
  ✗ refactor + bugfix
  ✗ style formatting + new feature
  ✗ documentation + application code

Commit message format:
  <type>(<scope>): <concise description in English>

  type: feat | fix | docs | style | refactor | test | chore
```

---

## 7. File Safety — NEVER edit unless explicitly instructed

```
.env / .env.*
*.secret / *.key / *.pem / *.p12
credentials / tokens / passwords
.git/config (manual direct edits)
*.lock files (package-lock.json, yarn.lock, pnpm-lock.yaml — only update via package managers)
```

---

## 8. Recovery Protocol — In Case of Incident

```
Step 1: STOP IMMEDIATELY — do not execute additional mutating commands.
Step 2: Run `git status` to capture the current state.
Step 3: Report fully to the user in their language:
         - What happened
         - Current repository state
         - Exact commands that were run
Step 4: NEVER autonomously run:
         ✗ git reset
         ✗ git rebase
         ✗ git stash
         ✗ git checkout -- .
Step 5: Await user instructions.
```

**Rationale:** AI agents attempting `reset --hard` to "recover" from an error cause permanent, irrecoverable data loss.

---

## 9. Post-flight Report (ALWAYS run after task completion)

```bash
git status
git diff --stat HEAD
```

Report to the user in their language:
```
✅ Modified files: [list]
✅ Created files: [list]
✅ Deleted files: [list]
⚠️  Unstaged changes: [if any]
📌 Staged uncommitted changes: [if any]
```

**Never hide or silence file changes.**

---

## 10. Emergency Stop

```
If:
  - Confidence < 95% about the command to be executed
  - Command is irreversible (reset --hard, push --force)
  - Repository is in an unexpected state
  - Unresolved conflicts exist

→ STOP IMMEDIATELY
→ ASK THE USER
→ NEVER GUESS
```

---

## Reference Files

- `references/rules.md` — Detailed breakdown of the 10 Mandatory Rules with examples
- `references/command-classification.md` — Complete risk classification of all Git commands
- `references/workflows.md` — Standard workflows for common scenarios

---

*Git Guardian v2.0 — Strict compliance required. No exceptions unless explicitly requested by the user.*
