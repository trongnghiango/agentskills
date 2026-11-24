# Security Audit — theo diff, không theo cảm tính

## 1. Threat model tối thiểu cho mỗi diff

| Câu hỏi | Nếu "có" |
|---|---|
| Endpoint mới/đổi quyền? | Vẽ authz matrix: role × action → allow/deny |
| Nhận input từ client? | Validate ở biên (Zod), coerce, giới hạn độ dài |
| Truy vấn DB? | Parameterized; cấm nối chuỗi SQL; kiểm tra tenant filter |
| Render HTML / rich text? | Escape; cấm `dangerouslySetInnerHTML` không sanitize |
| Gọi URL từ input? | SSRF allowlist, chặn IP nội bộ, timeout |
| Upload file? | Giới hạn type/size, lưu ngoài webroot, đổi tên |
| Log dữ liệu? | Không log PII, token, mật khẩu, số thẻ |
| Secret mới? | Không commit; dùng env/secret store; rotate |

## 2. Lệnh quét

```bash
# Secret trong diff và repo
gitleaks detect --no-git -v || true

# Dependency có lỗ hổng
pnpm audit --prod || true
osv-scanner -r . || true

# Semgrep rules mặc định (injection, XSS, crypto yếu)
semgrep --config=auto --error . || true

# Container filesystem (nếu có Dockerfile)
trivy fs --scanners vuln,secret . || true
```

## 3. Checklist thủ công (không tool nào bắt hết)

- [ ] Mọi endpoint mới có authz check, không chỉ authentication.
- [ ] Không mass assignment: chỉ map field được phép (không spread body vào entity).
- [ ] IDOR: mọi query có tenant/owner filter; thử ID của tenant khác.
- [ ] Error message không lộ stack, SQL, tên bảng, đường dẫn nội bộ.
- [ ] Rate limit cho login/OTP/search tốn kém.
- [ ] Webhook: verify signature + replay window.
- [ ] Cookie: HttpOnly, Secure, SameSite.
- [ ] JWT: verify alg, exp, issuer; không tin claim client tự khai.
- [ ] CORS: không `*` cho endpoint có credential.
- [ ] Log injection: escape newline từ input.

## 4. Định dạng finding

| Severity | Ý nghĩa | Ví dụ |
|---|---|---|
| Critical | Khai thác được, mất dữ liệu | SQLi, authz thiếu ở endpoint tiền |
| High | Leo thang quyền, lộ dữ liệu | IDOR, secret trong repo |
| Medium | Cần điều kiện | XSS stored có sanitize một phần |
| Low | Cứng hoá | Thiếu rate limit, log quá nhiều |

Mỗi finding: `file:line` + tái hiện + fix đề xuất + test chứng minh. Không có finding = ghi rõ "đã kiểm tra X, Y, Z".
