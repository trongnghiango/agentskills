# Git Command Classification

## 🟢 SAFE — Chạy tự do, không cần xác nhận

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

# So sánh
git blame <file>
git shortlog
git describe
git ls-files
git ls-tree HEAD
```

---

## 🟡 WARNING — Chạy sau khi giải thích và xác nhận

```bash
# Staging
git add <file>          # OK nếu file đúng scope
git add -p              # OK, interactive
git add .               # CẦN XÁC NHẬN — add tất cả

# Commit
git commit -m "..."     # Hỏi trước về message
git commit --no-edit    # Chỉ dùng sau merge conflict

# Branch creation (local only)
git branch <new-branch>
git checkout -b <new-branch>    # Chỉ khi được yêu cầu
git switch -c <new-branch>      # Chỉ khi được yêu cầu

# Fetch (safe, chỉ download)
git fetch
git fetch --all
git fetch --prune

# Restore staged only
git restore --staged <file>     # unstage, không mất changes
```

---

## 🟠 DANGEROUS — Cần xác nhận rõ ràng + giải thích đầy đủ rủi ro

```bash
# Merge
git merge <branch>          # Giải thích conflicts có thể xảy ra
git merge --no-ff <branch>
git merge --squash <branch>

# Pull
git pull                    # = fetch + merge, giải thích rõ
git pull --rebase           # Đặc biệt cẩn thận

# Cherry-pick
git cherry-pick <commit>    # Giải thích commit sẽ được copy

# Push (non-force)
git push origin <branch>    # Xác nhận branch và remote

# Delete branch (local đã merge)
git branch -d <branch>      # Chỉ khi đã merge

# Revert (safe nhưng tạo commit mới)
git revert <commit>         # Giải thích sẽ tạo revert commit
```

---

## 🔴 FORBIDDEN — Không thực thi trừ khi người dùng yêu cầu + xác nhận + hiểu hậu quả

```bash
# Rewrite history
git reset HEAD~1            # Bất kỳ variant nào
git reset --soft HEAD~1
git reset --mixed HEAD~1
git reset --hard HEAD~1
git reset --hard            # Xóa mọi uncommitted changes
git rebase                  # Bất kỳ variant nào
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

# Branch delete (chưa merge)
git branch -D <branch>      # Xóa dù chưa merge — cực kỳ nguy hiểm

# Stash (không được yêu cầu)
git stash
git stash push
git stash pop
git stash apply
git stash drop
git stash clear

# Branch switch (không được yêu cầu)
git checkout <other-branch>
git switch <other-branch>
```

---

## ⛔ NEVER — Không bao giờ trong bất kỳ tình huống nào

```bash
# Xóa refs quan trọng
git update-ref -d HEAD
git symbolic-ref HEAD /dev/null

# Worktree nguy hiểm
git worktree move           # Không tự ý move worktree

# GC không cẩn thận
git gc --prune=now          # Có thể xóa commits unreachable

# Reflog expire sớm
git reflog expire --all --expire=now
```

---

## Bảng nhanh cho Protected Branches

| Branch | Allowed Actions | Forbidden |
|--------|----------------|-----------|
| `main` | read, diff, log | commit, merge, push, rebase |
| `master` | read, diff, log | commit, merge, push, rebase |
| `release/*` | read, diff, log | mọi write operations |
| `production` | read only | tất cả |
| `feature/*` | tất cả safe + warning | force push |
| `bugfix/*` | tất cả safe + warning | force push |
