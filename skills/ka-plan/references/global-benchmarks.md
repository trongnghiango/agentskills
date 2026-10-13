# GLOBAL TECH BENCHMARKS & ARCHITECTURAL PATTERNS
> Đúc kết các mẫu kiến trúc và mỹ cảm kỹ thuật từ các công ty công nghệ hàng đầu thế giới để áp dụng vào các dự án Clean Architecture.

---

## 1. STRIPE: TOÀN VẸN TÀI CHÍNH & IDEMPOTENCY TUYỆT ĐỐI
- **Nguyên lý Sổ cái Bất biến (Append-Only Ledger)**:
  - Tuyệt đối không bao giờ cập nhật (`UPDATE`) số dư trực tiếp.
  - Mọi giao dịch là một bút toán tăng/giảm độc lập. Số dư là tổng tích lũy của toàn bộ sự kiện.
  - **Zero Ghost Transactions**: CSDL chỉ phản ánh đúng chứng từ có thực, không tự sinh bút toán ảo để bù tiền chênh lệch.
- **Idempotency Key Protocol**:
  - Mọi API thay đổi trạng thái (POST/PUT/PATCH) bắt buộc hỗ trợ header `Idempotency-Key` (hoặc `requestId`).
  - Sử dụng Cache/DB lưu kết quả theo key trong 24h. Nếu client gửi lại cùng key do mạng chập chờn, trả về ngay kết quả cũ mà không thực hiện lại logic.

---

## 2. LINEAR & FIGMA: TRẢI NGHIỆM TỨC THÌ (LOCAL-FIRST & OPTIMISTIC 60FPS)
- **Zero Spinner Latency**:
  - Khi người dùng tương tác (đổi status, check checkbox, comment), UI cập nhật ngay trong 16ms (chuẩn 60fps).
  - Đẩy mutation vào queue ngầm để sync về server.
  - Nếu server từ chối: Rollback trạng thái nhẹ nhàng và hiển thị thông báo lỗi nhân bản.
- **4 UI States Bắt buộc**:
  - Không bao giờ để component rơi vào trạng thái "trắng trơn" hoặc lỗi unhandled.
  - Mọi view đều phải có: `Loading Skeleton`, `Empty State` (gợi ý hành động), `Error State` (nút retry), `Success State`.

---

## 3. NETFLIX & UBER: KHÁNG LỖI HẠ TẦNG & CHỐNG NGHẼN WORKER NODES
- **Circuit Breaker (Ngắt mạch tự động)**:
  - 3 trạng thái: `CLOSED` (bình thường), `OPEN` (ngắt kết nối sau $N$ lần lỗi liên tiếp), `HALF-OPEN` (thử nghiệm lưu lượng nhỏ).
  - Ứng dụng: Khi gọi cổng bên thứ ba (Cổng Thuế, SMS, Payment Gateway), ngắt mạch ngay nếu phát hiện nguy cơ khóa tài khoản hoặc lỗi 502/504 kéo dài.
- **Transactional Outbox Pattern**:
  - Không bao giờ gọi HTTP hoặc bắn Message Queue bên trong DB transaction.
  - Ghi sự kiện vào bảng Outbox cục bộ (hoặc SQLite WAL cục bộ) cùng transaction.
  - Daemon riêng biệt quét và gửi bù sự kiện ra bên ngoài, đảm bảo dữ liệu không bao giờ bị mất (Zero Data Loss).

---

## 4. STEVE JOBS & APPLE: MỸ CẢM KỸ THUẬT & DIỆT RÁC AI (ANTI-GARBAGE)
- **Mặt sau của chiếc tủ (The Back of the Cabinet)**:
  - Người dùng không nhìn thấy code, nhưng kỹ sư biết chất lượng bên trong.
  - Giữ gìn sự trong sạch tuyệt đối của Domain Layer: 0% dính framework/ORM.
  - Single Screen Rule: Mọi hàm $\le 40-50$ dòng code, đọc hiểu cấu trúc trong 5 giây.
- **Dao cạo Ockham & Luật YAGNI (Diệt Ghost Code)**:
  - Cắt bỏ mọi thứ không cần thiết.
  - **CẤM** tạo các hàm "phòng hờ tương lai", factory trừu tượng cho bài toán 1 nhánh, hoặc helpers không có ai gọi trong thực tế.
  - Mọi hàm sinh ra phải có ít nhất 1 caller thực sự trong runtime call-graph.
