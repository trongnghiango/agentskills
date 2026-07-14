# Git Guardian — Mandatory Rules (Chi tiết)

## Rule 1 — Không tự đổi branch

**Nguyên tắc:** Chỉ đổi branch khi người dùng yêu cầu EXPLICITLY.

**FORBIDDEN (không có lệnh rõ ràng):**
```bash
git checkout <branch>
git switch <branch>
git checkout -b <new-branch>
git switch -c <new-branch>
git worktree move
```

**ALLOWED khi người dùng nói:** *"Chuyển sang branch feature/xyz"*, *"Tạo branch mới tên abc"*

**Lý do:** Đổi branch có thể mang theo untracked changes, gây conflict không mong muốn, hoặc làm người dùng mất định hướng.

---

## Rule 2 — Không sửa commit history

**FORBIDDEN tuyệt đối (trừ khi yêu cầu cực kỳ rõ ràng):**
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

**Lý do:** Rewrite history trên shared branch phá vỡ repository của toàn team.

**Ngoại lệ:** Chỉ chấp nhận khi người dùng nói rõ ràng branch là local, chưa push, và họ hiểu hậu quả.

---

## Rule 3 — Không tự stash

**FORBIDDEN:**
```bash
git stash
git stash push
git stash pop
git stash apply
git stash drop
git stash clear
```

**Lý do:** Stash ẩn công việc của người dùng. Nếu AI tự stash rồi quên báo cáo, người dùng sẽ mất track thay đổi.

**Thay thế:** Nếu cần "dọn" working tree, hãy hỏi người dùng muốn làm gì với những thay đổi hiện tại.

---

## Rule 4 — Không force push

**FORBIDDEN tuyệt đối:**
```bash
git push --force
git push -f
git push --force-with-lease
git push --force-if-includes
```

**Lý do:** Force push có thể xóa commits của người khác trên shared branch vĩnh viễn.

**Không có ngoại lệ** — ngay cả khi người dùng nói "force push đi" mà không giải thích lý do, hãy xác nhận lại và cảnh báo rõ rủi ro.

---

## Rule 5 — Không tự commit

**Quy trình đúng:**
```
Task xong
  ↓
Chạy git status + git diff
  ↓
Hỏi người dùng: "Tôi có thể commit với message '[type]: [mô tả]' không?"
  ↓
Đợi xác nhận
  ↓
git commit -m "..."
```

**Ngoại lệ:** Nếu người dùng đã nói từ đầu *"tự động commit sau mỗi thay đổi"* thì được phép — nhưng vẫn phải báo cáo message sẽ dùng.

---

## Rule 6 — Inspect trước khi edit

**Bắt buộc chạy trước khi chỉnh sửa bất kỳ file nào:**
```bash
git status
git branch --show-current
git rev-parse HEAD
git log --oneline -5    # optional nhưng recommended
```

**Output phải được đọc và xử lý** — không chỉ chạy cho có.

---

## Rule 7 — Không edit files ngoài scope

**Chỉ sửa files được yêu cầu trong task.**

Ví dụ: Task là *"sửa bug trong auth.py"* → không được sửa thêm `utils.py` hay `config.py` dù thấy code xấu.

**Ngoại lệ:** Nếu phát hiện file liên quan cần sửa, báo cáo và hỏi trước: *"Tôi thấy X cũng cần sửa để fix bug này. Tôi có thể sửa thêm không?"*

---

## Rule 8 — Không discard changes

**FORBIDDEN:**
```bash
git checkout -- .
git checkout -- <file>
git restore .
git restore <file>
git clean -fd
git clean -fx
git clean -fxd
git reset --hard
```

**Lý do:** Những lệnh này xóa công việc của người dùng không thể khôi phục (trừ reflog trong một số trường hợp).

**Nếu cần clean:** Hỏi rõ ràng người dùng từng file/thư mục cụ thể.

---

## Rule 9 — Dirty repository → hỏi trước

**Quy trình:**
```
git status → có thay đổi chưa commit?
  ↓
Thông báo: "Repository hiện có uncommitted changes:
  [liệt kê files]
Tôi có thể tiếp tục không? Những thay đổi này sẽ không bị ảnh hưởng."
  ↓
Đợi người dùng xác nhận
```

**Không tự ý tiếp tục** dù task có vẻ không liên quan đến những changes đó.

---

## Rule 10 — Báo cáo đầy đủ sau task

**Sau khi hoàn thành mọi task có liên quan đến files:**
```bash
git status
git diff --stat HEAD
```

**Báo cáo bắt buộc:**
```
📁 Thay đổi trong task này:
  Modified:  [danh sách]
  Created:   [danh sách]
  Deleted:   [danh sách]
  Untracked: [danh sách nếu có]

💾 Trạng thái staging:
  Staged:    [danh sách nếu có]
  Unstaged:  [danh sách nếu có]
```

**Không được ẩn bất kỳ thay đổi nào**, kể cả thay đổi nhỏ như sửa whitespace.
