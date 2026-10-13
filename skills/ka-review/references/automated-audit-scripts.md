# AUTOMATED CODE & ARCHITECTURE AUDIT SCRIPTS
> Bộ script bash chạy nhanh trong 1 giây để Subagent `ka-review` và CI tự động quét các vi phạm kiến trúc và diệt rác AI.

---

## 1. QUÉT RÁC THƯỢNG ĐẲNG & DEAD CODE (ZERO REFERENCES)

```bash
# TypeScript / JavaScript (Tìm các export không ai gọi)
npx knip --production 2>/dev/null || npx ts-prune 2>/dev/null

# Python (Tìm dead code với độ tin cậy >= 80%)
vulture src/ --min-confidence 80 2>/dev/null
```

---

## 2. QUÉT ĐỘ DÀI HÀM (SINGLE SCREEN RULE $\le$ 50 DÒNG)

```bash
# Quét tìm các hàm/method dài quá 50 dòng trong TypeScript/Python
# Sử dụng awk đếm số dòng giữa các dấu ngoặc nhọn hoặc indent
awk '
  /{/ { depth++; if (depth==1) { start=NR; line=$0 } }
  /}/ { depth--; if (depth==0 && (NR-start) > 50) { print FILENAME ":" start " [HÀM DÀI " (NR-start) " DÒNG]: " line } }
' $(find src/ -name "*.ts" -not -path "*/node_modules/*")
```

---

## 3. QUÉT VI PHẠM RANH GIỚI KIẾN TRÚC & PHỤ THUỘC VÒNG

```bash
# 1. Quét lậu framework/ORM vào Domain Layer (BẮT BUỘC RỖNG)
grep -rnE "from '@nestjs|from 'drizzle|from 'fastapi|from 'express" src/**/domain/ 2>/dev/null

# 2. Quét lệnh cấm forwardRef() (BẮT BUỘC RỖNG)
grep -rn "forwardRef" src/ 2>/dev/null

# 3. Quét cấm dùng 'any' trong TypeScript (BẮT BUỘC RỖNG)
grep -rnE ":\s*any\b" src/ --exclude-dir=node_modules 2>/dev/null

# 4. Quét gian lận ép số bề mặt (Anti-Fraud check)
grep -rnE "if\s*\([^)]*===\s*['\"][0-9A-Z_-]+['\"]\)" src/**/domain/ 2>/dev/null
```

---

## 4. QUÉT BẢO VỆ MULTI-TENANCY & SQL INDEXING

```bash
# 1. Tìm các câu lệnh query thiếu filter tenant
grep -rn "\.where(" src/ | grep -vE "tenantId|organizationId|companyId|clientId"

# 2. Tìm hardcode role check trên Frontend
grep -rnE "user\.role\s*===\s*['\"][A-Z_]+['\"]" frontend/src/ 2>/dev/null
```
