#!/usr/bin/env python3
"""Lint SKILL.md:
- YAML frontmatter hợp lệ, name khớp thư mục, kebab-case, có metadata.version
- description ≤ 500 ký tự, có trigger + anti-trigger
- SKILL.md ≤ 300 dòng (giữ progressive disclosure)
- Mọi đường dẫn cục bộ tới references/, templates/, examples/, assets/, ../<skill>/ đều tồn tại BÊN TRONG skills/
- Cấm tham chiếu trực tiếp standards/ từ trong SKILL.md (sẽ gãy khi chỉ symlink skills/ ra global)
"""
import glob
import os
import re
import sys

import yaml

MAX_DESC = 500
MAX_LINES = 300
TRIGGER = ("Use when", "Dùng khi", "Triggers:", "Trigger:")
ANTI = ("Do NOT use", "Không dùng", "NOT use for")
KEBAB = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
LOCAL_REF = re.compile(
    r"`((?:\.\./[a-z0-9-]+/)?(?:references|templates|examples|assets)/[A-Za-z0-9._/-]+\.[A-Za-z0-9]+|\.\./[a-z0-9-]+/SKILL\.md)`"
)
ROOT_ONLY_REF = re.compile(r"`(standards/[A-Za-z0-9._/-]+)`")

errors, warns, rows = [], [], []


def main() -> int:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    skills_root = os.path.join(root, "skills")

    for path in sorted(glob.glob(os.path.join(skills_root, "*", "SKILL.md"))):
        name = os.path.basename(os.path.dirname(path))
        rel = os.path.relpath(path, root)
        text = open(path, encoding="utf-8").read()
        lines = text.count("\n") + 1
        if not text.startswith("---"):
            errors.append(f"{rel}: thiếu frontmatter")
            continue
        fm_raw = text.split("---")[1]
        seen_keys = set()
        for key_match in re.finditer(r"^(\s*[a-zA-Z0-9_-]+)\s*:", fm_raw, re.M):
            k = key_match.group(1)
            if k in seen_keys:
                errors.append(f"{rel}: trùng lặp YAML key '{k.strip()}' trong frontmatter (nghi do merge lỗi)")
            seen_keys.add(k)
        try:
            fm = yaml.safe_load(fm_raw) or {}
        except yaml.YAMLError as exc:
            errors.append(f"{rel}: YAML lỗi: {str(exc).splitlines()[0]}")
            continue

        desc = str(fm.get("description", "")).strip()
        version = (fm.get("metadata") or {}).get("version")
        rows.append((name, len(desc), lines, bool(version)))

        if fm.get("name") != name:
            errors.append(f"{rel}: name '{fm.get('name')}' != thư mục '{name}'")
        if not KEBAB.match(str(fm.get("name", ""))):
            errors.append(f"{rel}: name không phải kebab-case")
        if not desc:
            errors.append(f"{rel}: thiếu description")
        elif len(desc) > MAX_DESC:
            errors.append(f"{rel}: description {len(desc)} > {MAX_DESC}")
        if lines > MAX_LINES:
            errors.append(f"{rel}: {lines} dòng > {MAX_LINES} (tách bớt sang references/)")
        if not version:
            warns.append(f"{rel}: thiếu metadata.version")
        if desc and not any(t in desc for t in TRIGGER):
            warns.append(f"{rel}: description thiếu trigger ('Use when'/'Dùng khi')")
        if desc and not any(t in desc for t in ANTI):
            warns.append(f"{rel}: description thiếu anti-trigger")

        base = os.path.dirname(path)
        for bad in set(ROOT_ONLY_REF.findall(text)):
            errors.append(f"{rel}: tham chiếu '{bad}' nằm ngoài skills/ (sẽ hỏng khi symlink global)")

        for ref in set(LOCAL_REF.findall(text)):
            if "<" in ref or "*" in ref or "{" in ref:
                continue
            resolved = os.path.normpath(os.path.join(base, ref))
            if not resolved.startswith(skills_root + os.sep) or not os.path.exists(resolved):
                errors.append(f"{rel}: đường dẫn nội bộ không tồn tại trong skills/: '{ref}'")

    print(f"{'skill':16} {'desc':>5} {'lines':>6}  ver")
    for name, length, lines, has_ver in rows:
        print(f"{name:16} {length:5} {lines:6}  {'ok' if has_ver else '-'}")

    for w in warns:
        print(f"warn: {w}")
    for e in errors:
        print(f"ERROR: {e}", file=sys.stderr)

    print(f"\n{len(rows)} skill | {len(errors)} error | {len(warns)} warn")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
