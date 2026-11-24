# Git Guardian — Mandatory Rules (Detailed)

> **User Communication Convention**: When prompting the user for decisions under these rules (e.g. Rule 1, 5, 9), converse in the user's conversation language (Vietnamese when prompted in Vietnamese).

---

## Rule 1 — No Autonomous Branch Switching

**Principle:** Only switch or create branches when EXPLICITLY requested by the user.

**FORBIDDEN (without explicit user command):**
```bash
git checkout <branch>
git switch <branch>
git checkout -b <new-branch>
git switch -c <new-branch>
git worktree move
```

**ALLOWED when the user says:** *"Switch to branch feature/xyz"*, *"Create a new branch named abc"* (or in Vietnamese: *"chuyển sang branch abc"*, *"tạo nhánh mới"*).

**Rationale:** Switching branches carries uncommitted changes across branches, causes unexpected merge conflicts, and disorients the user.

---

## Rule 2 — No History Rewriting

**Strictly FORBIDDEN:**
```bash
git rebase
git rebase -i
git rebase --onto
git reset HEAD~1
git reset --soft HEAD~1
git reset --mixed HEAD~1
git reset --hard HEAD~1
git commit --amend
git filter-branch
git filter-repo
```

**Rationale:** Rewriting history on shared branches disrupts collaborators' local states and damages repository integrity.

**Exception:** Permissible ONLY if the user explicitly specifies that the branch is local, unpushed, and acknowledges the risks.

---

## Rule 3 — No Autonomous Stashing

**FORBIDDEN:**
```bash
git stash
git stash push
git stash pop
git stash apply
git stash drop
git stash clear
```

**Rationale:** Stashing hides the user's ongoing work into an opaque stack. If the agent stashes and forgets to pop/report, work becomes orphaned.

**Alternative:** If working tree cleanup is required, ask the user in their language what to do with the active modifications.

---

## Rule 4 — No Force Pushing

**Strictly FORBIDDEN:**
```bash
git push --force
git push -f
git push --force-with-lease
git push --force-if-includes
```

**Rationale:** Force pushing can permanently erase commits from remote team branches.

**No Exceptions:** Even if the user says "just force push", re-confirm explicitly and highlight the severe data-loss hazard before proceeding.

---

## Rule 5 — No Autonomous Commits

**Standard Flow:**
```
Task complete
      ↓
Run `git status` + `git diff`
      ↓
Ask user: "May I commit these changes with message '[type]: [description]'?"
(In Vietnamese if user is Vietnamese: "Tôi có thể commit với message '...' không?")
      ↓
Wait for user confirmation
      ↓
git commit -m "..."
```

**Exception:** Permissible only if the user explicitly gave prior instruction to auto-commit each change. Even then, report the commit message and hash immediately.

---

## Rule 6 — Inspect Before Editing

**MANDATORY inspection before modifying any repository file:**
```bash
git status
git branch --show-current
git rev-parse HEAD
```

Confirm that the active branch is a valid working branch (not `main` or `master`) and that existing uncommitted changes are acknowledged.

---

## Rule 7 — No Editing Outside Scope

**Principle:** Touch only files directly relevant to the assigned task.

- Do not reformat unrelated files.
- Do not refactor files outside the task scope.
- Do not remove existing comments or TODOs in surrounding files.

---

## Rule 8 — Never Discard Working Tree Changes

**Strictly FORBIDDEN:**
```bash
git checkout -- .
git checkout -- <file>
git restore .
git restore <file>
git clean -fd
git clean -fx
```

**Rationale:** These operations permanently delete uncommitted code with zero chance of recovery.

---

## Rule 9 — Alert on Dirty Repository

**MANDATORY:** If `git status` reveals untracked or unstaged files before starting work:
- Do NOT silently ignore or stash them.
- Prompt the user in their language: *"Repository currently has uncommitted changes. Would you like me to proceed?"* (e.g., *"Repository có uncommitted changes. Tôi có thể tiếp tục không?"*).

---

## Rule 10 — Post-Task Report

**MANDATORY:** After completing work, run:
```bash
git status
git diff --stat HEAD
```

Present an honest summary in the user's language:
- Modified files
- Created files
- Deleted files
- Unstaged / staged status
