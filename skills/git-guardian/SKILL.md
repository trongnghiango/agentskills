---
name: git-guardian
description: >
  Hướng dẫn sử dụng Git một cách an toàn, chuyên nghiệp và hiệu quả cho AI Agent.
  BẮT BUỘC đọc skill này trước khi thực hiện BẤT KỲ thao tác Git nào — kể cả
  git status, git add, git commit, git push, checkout, rebase, reset, stash, merge.
  Kích hoạt khi người dùng đề cập đến: commit, branch, push, pull, merge, rebase,
  stash, worktree, repository, git log, git diff, hoặc bất kỳ lệnh git nào.
  Skill này định nghĩa luật bắt buộc — vi phạm được coi là thất bại.
license: Proprietary - internal ka-team use only
compatibility: Designed for Claude Code. Enforces git safety rules across all git operations.
metadata:
  version: "1.0.0"
  risk: low
  source: custom-ka-team
user-invocable: false
allowed-tools: Bash(git:*) Read
---

# Git Guardian — Standard Operating Procedure

> **Nguyên tắc tối thượng**: An toàn repository quan trọng hơn hoàn thành task.
> Bảo toàn công việc của người dùng quan trọng hơn tiết kiệm thời gian.

---

## 0. Pre-flight Checklist (LUÔN chạy trước khi làm bất cứ điều gì)

Trước khi chạm vào bất kỳ file nào, thực hiện mentally và thực tế:

```
[ ] Đọc kỹ task — hiểu rõ yêu cầu
[ ] git status              → repository có dirty không?
[ ] git branch --show-current → đang ở branch nào?
[ ] git rev-parse HEAD      → HEAD hiện tại là commit nào?
[ ] Có staged files không?
[ ] Có merge/rebase đang dở không?
[ ] Có stash entries không? (git stash list)
```

**Chỉ tiếp tục khi repository ở trạng thái an toàn.**

Nếu repository dirty → hỏi người dùng: *"Repository có uncommitted changes. Tôi có thể tiếp tục không?"*

---

## 1. Core Principles

```
1. Không bao giờ giả định — luôn kiểm tra thực tế
2. Không bao giờ đoán mò — không chắc thì dừng lại hỏi
3. Không bao giờ che giấu lỗi — báo cáo ngay lập tức
4. Giải thích lệnh Git TRƯỚC khi thực thi
5. Mọi thao tác Git phải reversible khi có thể
6. Confidence < 95% → DỪNG → Hỏi người dùng
```

---

## 2. Mandatory Rules (Quy tắc bắt buộc)

Chi tiết từng nhóm rule: xem `references/rules.md`

**Tóm tắt nhanh:**

| Rule | Nội dung | Mức độ |
|------|----------|--------|
| R1 | Không tự đổi branch | FORBIDDEN |
| R2 | Không sửa commit history | FORBIDDEN |
| R3 | Không tự stash | FORBIDDEN |
| R4 | Không force push | FORBIDDEN |
| R5 | Không tự commit | ASK FIRST |
| R6 | Inspect trước khi edit | MANDATORY |
| R7 | Không edit file ngoài scope | FORBIDDEN |
| R8 | Không discard changes | FORBIDDEN |
| R9 | Dirty repo → hỏi trước | MANDATORY |
| R10 | Báo cáo đầy đủ sau task | MANDATORY |

---

## 3. Risk Classification

```
SAFE        → git status, git log, git diff, git branch -a, git show
WARNING     → git add, git commit (phải hỏi trước)
DANGEROUS   → git merge, git cherry-pick, git rebase (cần xác nhận rõ ràng)
FORBIDDEN   → git reset --hard, git push --force, git clean -fd,
              git checkout (không được yêu cầu), git stash (không được yêu cầu)
```

Xem bảng đầy đủ: `references/command-classification.md`

---

## 4. Decision Trees

### 4.1 — Có nên checkout branch không?

```
Cần checkout?
     ↓
Người dùng yêu cầu EXPLICITLY không?
     ↓
  YES → checkout         NO → KHÔNG checkout
```

### 4.2 — Có nên commit không?

```
Task xong rồi?
     ↓
Người dùng yêu cầu auto-commit không?
     ↓
  YES → commit        NO → Hỏi: "Tôi có thể commit với message X không?"
```

### 4.3 — Gặp lỗi Git?

```
Có lỗi xảy ra?
     ↓
DỪNG NGAY
     ↓
Không tự recovery
     ↓
Báo cáo đầy đủ cho người dùng
     ↓
Đợi hướng dẫn
```

### 4.4 — Repository dirty?

```
git status → có thay đổi?
     ↓
  YES → Hỏi người dùng trước khi tiếp tục
  NO  → Tiếp tục bình thường
```

---

## 5. Branch Policy

**Branches được phép làm việc:**
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

**Branches FORBIDDEN — không được tự động thao tác:**
```
main
master
release/*
production
prod
staging
```

Nếu đang ở `main` hoặc `master`: **DỪNG** — thông báo người dùng ngay.

---

## 6. Commit Policy

```
Một thay đổi logic = Một commit

KHÔNG mix trong một commit:
  ✗ refactor + bugfix
  ✗ style + feature
  ✗ docs + code

Commit message format:
  <type>(<scope>): <mô tả ngắn gọn>

  type: feat | fix | docs | style | refactor | test | chore
```

---

## 7. File Safety — Files KHÔNG được chỉnh sửa trừ khi được yêu cầu

```
.env / .env.*
*.secret / *.key / *.pem / *.p12
credentials / tokens / passwords
.git/config (manual edits)
*.lock files (package-lock.json, yarn.lock — chỉ update qua package manager)
```

---

## 8. Recovery Protocol — Khi có sự cố

```
Bước 1: DỪNG NGAY — không làm thêm bất cứ điều gì
Bước 2: Chạy git status để capture trạng thái hiện tại
Bước 3: Báo cáo đầy đủ cho người dùng:
         - Chuyện gì xảy ra
         - Repository ở trạng thái nào
         - Những lệnh đã chạy

Bước 4: KHÔNG TỰ CHẠY:
         ✗ git reset
         ✗ git rebase
         ✗ git stash
         ✗ git checkout -- .

Bước 5: Đợi hướng dẫn từ người dùng
```

**Lý do:** Nhiều AI có xu hướng chạy `reset --hard` để "fix" lỗi, gây mất dữ liệu vĩnh viễn.

---

## 9. Post-flight Report (LUÔN chạy sau khi xong task)

```bash
git status
git diff --stat HEAD
```

Báo cáo:
```
✅ Files đã modified: [danh sách]
✅ Files đã created: [danh sách]
✅ Files đã deleted: [danh sách]
⚠️  Unstaged changes: [nếu có]
📌 Staged nhưng chưa commit: [nếu có]
```

**Không bao giờ ẩn thay đổi.**

---

## 10. Emergency Stop

```
Nếu:
  - Không chắc chắn 95% về lệnh sắp chạy
  - Lệnh không thể undo (reset --hard, push --force)
  - Repository ở trạng thái không mong đợi
  - Có conflict chưa resolve

→ DỪNG NGAY
→ HỎI NGƯỜI DÙNG
→ KHÔNG đoán mò
```

---

## Reference Files

- `references/rules.md` — Chi tiết 10 Mandatory Rules với ví dụ
- `references/command-classification.md` — Bảng phân loại đầy đủ mọi lệnh Git
- `references/workflows.md` — Workflow chuẩn cho các scenario phổ biến

---

*Git Guardian v1.0 — Tuân thủ nghiêm ngặt. Không exception trừ khi người dùng yêu cầu rõ ràng.*
