#!/usr/bin/env python3
"""Bật Intake Rule (ka-intake) cho một dự án cụ thể.

Chèn block có marker vào <project>/AGENTS.md. Chạy lại không nhân đôi.
Gỡ: xoá mọi thứ giữa hai marker.
"""
import argparse
import os
import sys

START = "<!-- ka:intake-rule:start -->"
END = "<!-- ka:intake-rule:end -->"

BLOCK = f"""{START}
## Intake Rule (always active)

Trước khi implement bất kỳ yêu cầu nào — kể cả yêu cầu "nghe đơn giản" — kiểm tra thông tin đã đủ thành yêu cầu nghiệp vụ hoàn chỉnh chưa, theo checklist trong skill `ka-intake`.

- Thiếu field nghiệp vụ mà có thể đổi kết quả → hỏi trước. Không tự suy diễn, không tự chọn mặc định thay user.
- Giả định kỹ thuật vô hại (tên biến, format code) thì không cần hỏi.
- "Nghe đơn giản" không phải bằng chứng — đối chiếu checklist, đừng dựa cảm tính.
- Gộp câu hỏi vào một message, không hỏi từng câu một.
- Đã có quyết định khoá (`decisions.json`, `status: "locked"`) → coi như intake xong, không hỏi lại.
{END}"""


def main() -> int:
    ap = argparse.ArgumentParser(description="Enable the ka-intake rule for one project.")
    ap.add_argument("project", help="Project root (contains AGENTS.md)")
    ap.add_argument("--dry-run", action="store_true", help="Print the plan, write nothing")
    args = ap.parse_args()

    root = os.path.abspath(os.path.expanduser(args.project))
    if not os.path.isdir(root):
        print(f"error: not a directory: {root}", file=sys.stderr)
        return 2
    target = os.path.join(root, "AGENTS.md")

    if not os.path.isdir(os.path.join(root, ".agents")):
        print(f"warning: {root}/.agents missing; ka-* state (decisions.json) may not work")

    text = ""
    if os.path.isfile(target):
        with open(target, encoding="utf-8") as fh:
            text = fh.read()

    if START in text:
        if END in text and text.index(START) < text.index(END):
            print(f"already enabled: {target}")
            return 0
        print(f"error: broken markers in {target}; fix by hand", file=sys.stderr)
        return 3

    if text.strip():
        new = text.rstrip("\n") + "\n\n" + BLOCK + "\n"
    else:
        new = "# AGENTS.md\n\n" + BLOCK + "\n"

    if args.dry_run:
        print(f"would write {target} (+{len(BLOCK.splitlines())} lines)")
        return 0

    with open(target, "w", encoding="utf-8") as fh:
        fh.write(new)
    print(f"enabled: {target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
