# New Project Setup — Ka Framework Skills (v6.0)

> Bộ skill `ka-*` tự chứa hoàn toàn bên trong `skills/` (không phụ thuộc đường dẫn ngoài khi symlink global sang `~/.agents/skills/`).
> Dưới đây là các bước khởi tạo cho một dự án mới tuỳ theo quy mô (**Lite** hoặc **Full**).

---

## 1. Nạp Skills (Global hoặc Per-Project)

Nếu máy đã symlink `skills/*` vào `~/.agents/skills/` thì các host tương thích (DSH, Antigravity, v.v.) tự nhận diện toàn bộ 13 core skills + 2 alias (`ka-execute`, `ka-think`).

Nếu muốn đóng gói đi kèm repo (cho Claude Code, Codex, team chung):
```bash
mkdir -p .agents/skills
cp -r ~/Repos/github.com/trongnghiango/agentskills/skills/* .agents/skills/
```

---

## 2. Khởi tạo Runtime theo quy mô dự án (`Lite` vs `Full`)

```bash
mkdir -p .agents/scripts .agents/config .agents/memory

cp ~/Repos/github.com/trongnghiango/agentskills/runtime-templates/state-manager.js \
   .agents/scripts/state-manager.js
chmod +x .agents/scripts/state-manager.js
```

Chọn **1 trong 2** cấu hình vòng đời:

### Phương án A — Lite Profile (Khuyên dùng cho repo nhỏ, CLI, script, solo)
Chỉ giữ `IN_PROGRESS → TEST_GATE → COMPLETION_GATE` (+ `DEPLOYMENT_GATE` cho ops), không ép 4 tầng, không sinh file `.md` trung gian:
```bash
cp ~/Repos/github.com/trongnghiango/agentskills/runtime-templates/workflow.lite.json \
   .agents/config/workflow.json
```

### Phương án B — Full Profile (Cho SaaS multi-tenant, tài chính, nhiều module)
Đầy đủ `DESIGN_NEEDED → ADR_GATE → LOCKED_DECISION → TEST_GATE → REVIEW_GATE → DEPLOYMENT_GATE → COMPLETION_GATE`:
```bash
cp ~/Repos/github.com/trongnghiango/agentskills/runtime-templates/workflow.json \
   .agents/config/workflow.json

cat > .agents/config/checklist.json <<'EOF'
{ "BE_PLANNING": [], "FE_PLANNING": [], "DB_DESIGN": [], "CONTRACT_DESIGN": [] }
EOF
```

### Bật Intake & Git Guardian Rules trong `AGENTS.md`
```bash
python3 ~/Repos/github.com/trongnghiango/agentskills/scripts/enable-intake.py .
```

> **Lưu ý `.gitignore`** (trạng thái runtime không commit lên git):
> ```gitignore
> .agents/memory/
> ```

---

## 3. Cách vận hành cơ chế Gate mới

* **Cô lập theo feature**: luôn truyền `--feature <slug>` (ví dụ `--feature order-cancel`) để làm nhiều tính năng song song không đè trạng thái nhau.
* **Test Gate chạy thật**:
  ```bash
  node .agents/scripts/state-manager.js test --feature order-cancel --phase red   --cmd "pnpm test orders"
  # ...viết code...
  node .agents/scripts/state-manager.js test --feature order-cancel --phase green --cmd "pnpm test orders"
  node .agents/scripts/state-manager.js update --feature order-cancel --proposal PASS --cases "cancel pending; reject shipped"
  ```
* **Human Gate có đối chiếu**: mọi gate người duyệt bắt buộc kèm `--approved-by-user "<câu trả lời thật của user>"`, được lưu vết tại `.agents/memory/approvals.log`.
