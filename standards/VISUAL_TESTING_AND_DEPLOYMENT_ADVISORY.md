# INTERACTIVE VISUAL TESTING & SMART DEPLOYMENT ADVISORY
> Tiêu chuẩn kiểm thử tương tác thực tế bằng ảnh chụp màn hình (Visual Evidence) và Cẩm nang triển khai thông minh chống nghẽn node / worker.

---

## 1. QUY TRÌNH KIỂM THỬ TƯƠNG TÁC THỰC TẾ (4-STAGE SCREENSHOTS)

Thay vì chỉ kiểm tra thẻ DOM trừu tượng, mọi tính năng có giao diện người dùng (Web, Desktop Tauri) bắt buộc chụp và lưu ảnh 4 giai đoạn vòng đời vào thư mục `artifacts/screenshots/`:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ 1. STAGE 1 (EMPTY)   : Chụp giao diện lúc ban đầu khi chưa có dữ liệu. │
│ 2. STAGE 2 (LOADING) : Chụp trạng thái nút bấm đang quay spinner & disabled.
│ 3. STAGE 3 (SUCCESS) : Chụp giao diện sau khi tải thành công (Badge xanh).
│ 4. STAGE 4 (ERROR)   : Chụp giao diện xử lý lỗi biên & nút thử lại (Retry).
└────────────────────────────────────────────────────────────────────────┘
```

### Báo Cáo Nghiệm Thu Trực Quan (Embedded Visual Report)
Báo cáo nghiệm thu tự động xuất ra tại `artifacts/reports/<feature>_acceptance.md` với cú pháp Markdown nhúng ảnh:
```markdown
### Giai đoạn 3: Trạng thái Thành công (Success State)
![Success State](<artifacts/screenshots/order_sync_03_success.png>)
- *Đánh giá*: Dữ liệu hiển thị đúng định dạng tiền tệ VNĐ, badge trạng thái chuyển sang ACTIVE.
```

---

## 2. KHUYẾN CÁO TRIỂN KHAI THÔNG MINH & CHỐNG NGHẼN NODE / WORKER

### A. Công thức Tính Kích thước DB Connection Pool (Chống sập Database)
$$\text{Pool Size Tối Đa Mỗi Node} = \frac{\text{PostgreSQL Max Connections} \times 0.8}{\text{Tổng Số Lượng Pods / Worker Instances}}$$
* Với quy mô lớn: Đặt **PgBouncer** ở chế độ `Transaction Pooling` đứng trước PostgreSQL.

### B. Công thức Tính Số Luồng Worker Concurrency (Chống nghẽn CPU)
* **Tác vụ I/O-bound (Cào web, gọi API bên ngoài, tải file)**:
  $$\text{Concurrency} = \text{CPU Cores} \times 3 \text{ đến } 5$$
* **Tác vụ CPU-bound (Xử lý ảnh, parse file Excel lớn, mã hóa)**:
  $$\text{Concurrency} = \text{CPU Cores} - 1 \quad (\text{dành 1 core cho OS \& Event Loop})$$

### C. Triển khai Zero-Downtime & Graceful Shutdown
1. **Readiness Probe**: Trì hoãn 15–30s cho đến khi NestJS/FastAPI bootstrap hoàn toàn mới cho nhận traffic.
2. **Graceful Shutdown**: Khi nhận `SIGTERM`, dừng nhận job mới từ BullMQ, chờ tối đa 30s để hoàn tất các job đang xử lý dở dang, sau đó mới đóng DB pool và thoát an toàn (`process.exit(0)`).
3. **Phân tách Node Vật lý**: Tách biệt rõ Node phục vụ Web/API và Node chuyên chạy Worker nền để tránh việc Worker nặng làm đơ giao diện người dùng.
