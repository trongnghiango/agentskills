# Git Command Classification

## 🟢 SAFE — Freely executable, no prior confirmation needed

```bash
# Inspection
git status
git log
git log --oneline
git log --graph
git diff
git diff --stat
git diff HEAD
git diff <branch1>..<branch2>
git show
git show <commit>
git branch
git branch -a
git branch -r
git tag
git remote -v
git config --list
git rev-parse HEAD
git rev-parse --abbrev-ref HEAD

# Comparison & Diagnostics
git blame <file>
git shortlog
git describe
git ls-files
git ls-tree HEAD
```

---

## 🟡 WARNING — Execute only after explanation and user confirmation

```bash
# Staging
git add <file>          # OK if file is within task scope
git add -p              # Interactive hunk staging
git add .               # REQUIRES CONFIRMATION — stages everything indiscriminately

# Commit
git commit -m "..."     # Always ask user first about the commit message
git commit --no-edit    # Only after resolving merge conflicts

# Branch creation (local only)
git branch <new-branch>
git checkout -b <new-branch>    # Only when explicitly requested
git switch -c <new-branch>      # Only when explicitly requested

# Fetch (safe, download metadata only)
git fetch
git fetch --all
git fetch --prune

# Restore staged status only
git restore --staged <file>     # Unstage without losing working tree changes
```

---

## 🟠 DANGEROUS — Requires explicit user confirmation + risk explanation

```bash
# Merge
git merge <branch>          # Explain potential conflicts before running
git merge --no-ff <branch>
git merge --squash <branch>

# Pull
git pull                    # Equivalent to fetch + merge; explain risks
git pull --rebase           # Rebase risk; requires high caution

# Cherry-pick
git cherry-pick <commit>    # Explain that commit will be duplicated

# Push (non-force)
git push origin <branch>    # Confirm target branch and remote name

# Delete branch (local, already merged)
git branch -d <branch>      # Only if branch has been safely merged

# Revert (safe but creates new commit)
git revert <commit>         # Explain that a new revert commit will be created
```

---

## 🔴 FORBIDDEN — Never execute unless explicitly ordered with acknowledged consequences

```bash
# Rewrite history
git reset HEAD~1            # Any variant
git reset --soft HEAD~1
git reset --mixed HEAD~1
git reset --hard HEAD~1
git reset --hard            # Destroys all uncommitted changes
git rebase                  # Any rebase operation
git rebase -i
git rebase --onto
git commit --amend
git filter-branch
git filter-repo

# Discard changes
git checkout -- .
git checkout -- <file>
git restore .
git restore <file>
git clean -fd
git clean -fx
git clean -fxd

# Force operations
git push --force
git push -f
git push --force-with-lease
git push --force-if-includes

# Branch deletion (unmerged)
git branch -D <branch>      # Force deletes unmerged branch — data loss risk

# Autonomous Stashing
git stash
git stash push
git stash pop
git stash apply
git stash drop
git stash clear

# Autonomous Branch Switching
git checkout <other-branch>
git switch <other-branch>
```

---

## ⛔ NEVER — Strictly banned under all circumstances

```bash
# Deleting critical references
git update-ref -d HEAD
git symbolic-ref HEAD /dev/null

# Unsafe worktree actions
git worktree move

# Unsafe garbage collection
git gc --prune=now          # Can delete unreachable recovery commits

# Premature reflog expiration
git reflog expire --all --expire=now
```

---

## Quick Matrix for Protected Branches

| Branch | Allowed Actions | Forbidden Actions |
|--------|----------------|-------------------|
| `main` | read, diff, log | commit, merge, push, rebase |
| `master` | read, diff, log | commit, merge, push, rebase |
| `release/*` | read, diff, log | all write operations |
| `production` | read only | all mutating operations |
| `feature/*` | all safe + warning | force push |
| `bugfix/*` | all safe + warning | force push |
