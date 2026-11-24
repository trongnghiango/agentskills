#!/usr/bin/env python3
"""Lint SKILL.md: frontmatter hợp lệ, mô tả ≤ 500 ký tự, trigger, references tồn tại."""
import glob
import os
import re
import sys

import yaml

MAX = 500
TRIGGER = ("Use when", "Dùng khi", "Triggers:", "Trigger:")
ANTI = ("Do NOT use", "Không dùng", "NOT use for")
KEBAB = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

errors, warns, rows = [], [], []


def main() -> int:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for path in sorted(glob.glob(os.path.join(root, "skills", "*", "SKILL.md"))):
        name = os.path.basename(os.path.dirname(path))
        rel = os.path.relpath(path, root)
        text = open(path, encoding="utf-8").read()
        if not text.startswith("---"):
            errors.append(f"{rel}: thiếu frontmatter")
            continue
        try:
            fm = yaml.safe_load(text.split("---")[1]) or {}
        except yaml.YAMLError as exc:
            errors.append(f"{rel}: YAML lỗi: {str(exc).splitlines()[0]}")
            continue

        desc = str(fm.get("description", "")).strip()
        version = (fm.get("metadata") or {}).get("version")
        rows.append((name, len(desc), bool(version)))

        if fm.get("name") != name:
            errors.append(f"{rel}: name '{fm.get('name')}' != thư mục '{name}'")
        if not KEBAB.match(str(fm.get("name", ""))):
            errors.append(f"{rel}: name không phải kebab-case")
        if not desc:
            errors.append(f"{rel}: thiếu description")
        elif len(desc) > MAX:
            errors.append(f"{rel}: description {len(desc)} > {MAX}")
        if not version:
            warns.append(f"{rel}: thiếu metadata.version")
        if desc and not any(t in desc for t in TRIGGER):
            warns.append(f"{rel}: description thiếu trigger ('Use when'/'Dùng khi')")
        if desc and not any(t in desc for t in ANTI):
            warns.append(f"{rel}: description thiếu anti-trigger")

        base = os.path.dirname(path)
        for ref in re.findall(r"([A-Za-z0-9_./-]*references/[A-Za-z0-9._-]+\.md)", text):
            candidates = [os.path.join(base, ref), os.path.join(root, ref), os.path.join(base, "references", os.path.basename(ref))]
            if not any(os.path.exists(c) for c in candidates):
                errors.append(f"{rel}: thiếu {ref}")

    print(f"{'skill':16} {'desc':>5}  ver")
    for name, length, has_ver in rows:
        print(f"{name:16} {length:5}  {'ok' if has_ver else '-'}")

    for w in warns:
        print(f"warn: {w}")
    for e in errors:
        print(f"ERROR: {e}", file=sys.stderr)

    print(f"\n{len(rows)} skill | {len(errors)} error | {len(warns)} warn")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
