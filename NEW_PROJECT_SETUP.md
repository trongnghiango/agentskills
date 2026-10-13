# New Project Setup — Ka Framework Skills (Global Reuse Guide)

> Khi bắt đầu một dự án MỚI, bộ skill chung (Ka framework) đã được nạp global qua `~/.agents/skills/`.
> Dưới đây là 2 việc cần làm để kích hoạt đầy đủ cơ chế workflow.

---

## 1. Skills chung (Ka framework) — ĐÃ CÓ GLOBAL

14 skills framework sau đã được symlink vào `~/.agents/skills/` (tầng user-agents của DSH, rank 500):

`git-guardian`, `ka-be`, `ka-contract`, `ka-db-schema`, `ka-execute`, `ka-fe`,
`ka-handoff`, `ka-intake`, `ka-ops`, `ka-plan`, `ka-review`, `ka-test`,
`ka-think`, `ka-workflow`.

→ **Không cần làm gì thêm.** DSH tự quét `~/.agents/skills/` cho MỌI dự án.

---

## 2. Runtime cho `ka-workflow` & `ka-plan` — CẦN KHỞI TẠO PER-PROJECT

`ka-workflow` và `ka-plan` dùng máy trạng thái `state-manager.js` + `workflow.json` nằm TRONG từng dự án.

```bash
# Trong thư mục gốc dự án mới
mkdir -p .agents/scripts .agents/config .agents/memory

cp ~/Repos/github.com/trongnghiango/agentskills/runtime-templates/state-manager.js .agents/scripts/state-manager.js
cp ~/Repos/github.com/trongnghiango/agentskills/runtime-templates/workflow.json .agents/config/workflow.json

chmod +x .agents/scripts/state-manager.js

# (Tùy chọn) Thêm checklist BE_PLANNING cho dự án mới
cat > .agents/config/checklist.json <<'EOF'
{ "BE_PLANNING": [] }
EOF
```

> ⚠️ Thêm vào `.gitignore` (state runtime không commit):
> ```
> .agents/memory/state.json
> .agents/memory/decisions.json
> ```

---

## 3. Lưu ý về STAX-specific skills

15 `stax-*` skills là tri thức RIÊNG của dự án STAX — chỉ tồn tại trong `STAX/.agents/skills/`
(project-agents, rank 200). Chúng KHÔNG được symlink global. Dự án khác muốn dùng pattern
tương tự thì tự tạo domain skills riêng của mình.

---
