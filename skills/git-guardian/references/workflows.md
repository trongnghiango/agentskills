# Git Guardian — Workflows Chuẩn

## Workflow 1: Bắt đầu một task mới

```bash
# Bước 1: Pre-flight
git status
git branch --show-current
git rev-parse HEAD

# Bước 2: Nếu dirty → hỏi người dùng
# Bước 3: Nếu đang ở main/master → cảnh báo ngay

# Bước 4: Đọc task kỹ, xác nhận scope files
# Bước 5: Bắt đầu làm việc
```

---

## Workflow 2: Hoàn thành task và commit

```bash
# Bước 1: Post-flight check
git status
git diff

# Bước 2: Review thay đổi
git diff --stat

# Bước 3: Báo cáo cho người dùng
# "Tôi đã sửa X files. Bạn muốn tôi commit với message '[feat]: ...' không?"

# Bước 4: Chờ xác nhận

# Bước 5: Stage đúng files
git add <files-cụ-thể>   # Không dùng git add . trừ khi được yêu cầu

# Bước 6: Commit
git commit -m "<type>(<scope>): <description>"

# Bước 7: Báo cáo commit hash
git log --oneline -1
```

---

## Workflow 3: Làm việc với feature branch

```bash
# Tình huống: Người dùng yêu cầu tạo feature branch

# Bước 1: Kiểm tra trạng thái hiện tại
git status
git branch --show-current

# Bước 2: Xác nhận từ branch nào tạo
# Hỏi: "Bạn muốn tạo branch từ main hay branch hiện tại (X)?"

# Bước 3: Tạo và switch (chỉ khi được yêu cầu rõ ràng)
git checkout -b feature/<name>
# hoặc
git switch -c feature/<name>

# Bước 4: Xác nhận
git branch --show-current
```

---

## Workflow 4: Merge feature vào main (khi được yêu cầu)

```bash
# Bước 1: Cảnh báo — đây là DANGEROUS operation
# Thông báo: "Tôi sắp merge feature/X vào main. Thao tác này không thể undo dễ dàng."

# Bước 2: Kiểm tra trạng thái
git status
git log main..feature/X --oneline  # Xem commits sẽ merge

# Bước 3: Xác nhận với người dùng về số commits và nội dung

# Bước 4: Checkout main (chỉ sau khi được xác nhận)
git checkout main
git pull origin main   # Sync latest

# Bước 5: Merge
git merge --no-ff feature/X    # Prefer no-ff để giữ history rõ ràng

# Bước 6: Nếu có conflict → DỪNG, báo cáo, đợi hướng dẫn

# Bước 7: Nếu sạch → báo cáo kết quả
git log --oneline -5
```

---

## Workflow 5: Gặp conflict

```bash
# Tình huống: git merge/pull sinh ra conflict

# Bước 1: DỪNG NGAY
# Bước 2: Báo cáo
git status   # Liệt kê files conflicted
git diff     # Hiện chi tiết conflict

# Bước 3: Thông báo người dùng:
# "Có conflict trong X files:
#   - path/to/file1.py
#   - path/to/file2.js
# Bạn muốn tôi hiển thị nội dung conflict để bạn quyết định không?"

# Bước 4: Đợi hướng dẫn
# KHÔNG tự resolve conflict trừ khi người dùng yêu cầu và giải thích rõ
# cách resolve (chọn theirs, ours, hay custom)

# Bước 5: Sau khi resolve
git add <resolved-files>
git commit   # Dùng merge commit message mặc định
```

---

## Workflow 6: Undone mistake (do người dùng yêu cầu)

```bash
# Tình huống: Người dùng yêu cầu undo một thay đổi

# Case A: Undo commit gần nhất (chưa push)
# CẢNH BÁO: "Lệnh này sẽ xóa commit X. Bạn chắc chắn không?"
git revert HEAD        # AN TOÀN HƠN — tạo commit mới
# hoặc (chỉ khi người dùng hiểu rõ)
git reset --soft HEAD~1   # Giữ changes, xóa commit

# Case B: Undo file về commit cũ
git show HEAD:<file> > <file>   # An toàn hơn checkout
# HOẶC
git restore --source=HEAD <file>

# Case C: Undo staging
git restore --staged <file>

# LUÔN chạy git status sau để xác nhận trạng thái
```

---

## Workflow 7: Xem lịch sử và debug

```bash
# Xem log đẹp
git log --oneline --graph --all --decorate

# Xem thay đổi của một commit
git show <commit-hash>

# Tìm commit gây ra bug
git bisect start
git bisect bad HEAD
git bisect good <known-good-commit>
# → Đây là SAFE operation, chỉ navigation

# Xem ai sửa dòng nào
git blame <file>
git blame -L 10,20 <file>

# Tìm trong history
git log --grep="keyword"
git log -S "code string"   # Pickaxe search
```

---

## Workflow 8: Sync với remote (an toàn)

```bash
# Fetch only (SAFE — không thay đổi local)
git fetch origin
git fetch --all

# Xem diff với remote
git diff HEAD origin/main

# Pull (WARNING — hỏi trước)
# Thông báo: "Tôi sắp pull từ origin/main. Branch hiện tại sẽ được update."
git pull origin <branch>

# Push (WARNING — hỏi trước, check branch)
# Thông báo: "Tôi sắp push branch X lên origin. OK không?"
git push origin <branch>
```

---

## Xử lý tình huống đặc biệt

### AI đang ở main branch
```
→ DỪNG NGAY
→ Thông báo: "Tôi đang ở branch 'main'. Đây là protected branch.
   Tôi sẽ không thực hiện bất kỳ thay đổi nào ở đây.
   Bạn muốn tôi tạo feature branch mới không?"
→ Đợi hướng dẫn
```

### AI phát hiện .env hoặc secrets file
```
→ Không đọc nội dung
→ Không add vào staging
→ Kiểm tra .gitignore
→ Thông báo: "Tôi thấy file .env. File này có trong .gitignore chưa?"
```

### Repository ở trạng thái MERGING hoặc REBASING
```
git status → "You have unmerged paths" hoặc "rebase in progress"

→ DỪNG NGAY
→ Báo cáo trạng thái chi tiết
→ Hỏi: "Repository đang ở giữa một merge/rebase. 
   Bạn muốn tiếp tục hay abort?"
→ Không tự quyết định
```
