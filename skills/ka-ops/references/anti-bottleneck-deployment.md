# KHUYẾN CÁO TRIỂN KHAI THÔNG MINH & CHỐNG NGHẼN NODE / WORKER
> Cẩm nang cấu hình và điều phối triển khai tự động, tối ưu tài nguyên phần cứng, triệt tiêu nghẽn cổ chai (Bottlenecks) và bảo vệ hệ thống không bị đơ giật trong quá trình Rolling Update.

---

## 1. NGUYÊN NHÂN GÂY NGHẼN VÀ TREO NODE KHI VẬN HÀNH

```text
┌────────────────────────────────────────────────────────────────────────┐
│             4 NGUY CƠ GÂY CHẾT NODE & NGHẼN MẠNG PHỔ BIẾN NHẤT         │
├────────────────────────────────────────────────────────────────────────┤
│ 1. NGHẼN EVENT LOOP (Node.js Main Thread Blocking):                    │
│    Parse JSON/XML hàng chục MB, hash mật khẩu hoặc mã hóa trên luồng   │
│    chính -> Làm đơ toàn bộ các request HTTP khác đang chờ.             │
├────────────────────────────────────────────────────────────────────────┤
│ 2. CẠN KIỆT CONNECTION POOL CƠ SỞ DỮ LIỆU (DB Pool Exhaustion):        │
│    Mỗi Pod/Worker tự mở 30-50 kết nối. Khi scale 5 node -> 250 kết     │
│    nối -> Vượt quá `max_connections` của PostgreSQL -> DB sập.         │
├────────────────────────────────────────────────────────────────────────┤
│ 3. TRANH CHẤP TÀI NGUYÊN WORKER (Thread / CPU Thrashing):              │
│    Cấu hình BullMQ/Celery concurrency = 50 trên VPS 2 Core -> CPU 100% │
│    do context-switching liên tục, các tác vụ đều bị timeout.           │
├────────────────────────────────────────────────────────────────────────┤
│ 4. SỐC LƯU LƯỢNG KHI DEPLOY (Deployment Thundering Herd & Bad Probes): │
│    Bộ điều phối (K8s/Docker Swarm) đẩy traffic vào Pod mới trước khi   │
│    NestJS bootstrap xong, hoặc kill Pod cũ khi job đang chạy dở dang.  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. CÔNG THỨC VÀNG TỐI ƯU CẤU HÌNH TÀI NGUYÊN

### A. Công thức Tính Kích thước DB Connection Pool
Tuyệt đối không để mặc định connection pool quá lớn:
$$\text{Pool Size Tối Đa Mỗi Node} = \frac{\text{PostgreSQL Max Connections} \times 0.8}{\text{Tổng Số Lượng Pods / Worker Instances}}$$
* *Ví dụ*: PostgreSQL cho phép tối đa 100 kết nối. Dự kiến chạy 4 Pods Backend + 2 Worker:
  $$\text{Pool Size} = \frac{100 \times 0.8}{6} \approx 13 \text{ connections/node}$$
* Với quy mô lớn: **Bắt buộc đặt PgBouncer** ở chế độ `Transaction Pooling` đứng trước PostgreSQL.

### B. Công thức Tính Số Luồng Worker Concurrency (BullMQ / Celery / Goroutines)
* **Đối với tác vụ I/O-bound (Cào web, gọi API bên thứ ba, tải file)**:
  $$\text{Concurrency} = \text{CPU Cores} \times \left(1 + \frac{\text{Wait Time}}{\text{Compute Time}}\right) \approx 3 \text{ đến } 5 \times \text{Cores}$$
* **Đối với tác vụ CPU-bound (Xử lý ảnh, parse file Excel lớn, sinh báo cáo)**:
  $$\text{Concurrency} = \text{CPU Cores} - 1 \quad (\text{dành 1 core cho OS \& Event Loop})$$

---

## 3. BẢO VỆ ROLLOUT KHÔNG DOWNTIME (ZERO-DOWNTIME ROLLING DEPLOYMENT)

### A. Chuẩn hóa Liveness & Readiness Probes (Kubernetes / Docker Compose)
Pod mới chỉ được phép nhận traffic khi đã sẵn sàng 100%:
```yaml
readinessProbe:
  httpGet:
    path: /health/readiness
    port: 3000
  initialDelaySeconds: 15    # Chờ NestJS/FastAPI bootstrap xong
  periodSeconds: 5
  failureThreshold: 3
livenessProbe:
  httpGet:
    path: /health/liveness
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
```

### B. Xử lý Dừng Văn Minh (Graceful Shutdown & Drain Jobs)
Khi nhận tín hiệu `SIGTERM` từ Docker/K8s:
1. **Dừng nhận việc mới**: Ngừng kéo job mới từ BullMQ / Redis queue.
2. **Chờ hoàn tất việc dở dang (Drain Timeout)**: Cho phép các job đang chạy tối đa 30–60 giây để kết thúc và commit dữ liệu.
3. **Đóng kết nối**: Đóng DB connection pool, Redis client.
4. **Thoát an toàn**: `process.exit(0)`.

```typescript
// bootstrap/graceful-shutdown.ts
async function enableGracefulShutdown(app: INestApplication, worker: Worker) {
  process.on('SIGTERM', async () => {
    console.log('🔔 SIGTERM received: Bắt đầu drain worker và đóng server...');
    await worker.close(); // Chờ job hiện tại xong, không nhận job mới
    await app.close();    // Đóng HTTP server & DB connections
    console.log('✅ Graceful shutdown hoàn tất.');
    process.exit(0);
  });
}
```

---

## 4. CHIẾN LƯỢC TÁCH BIỆT NODE TÍNH TOÁN (NODE SEPARATION ARCHITECTURE)

Để ngăn chặn việc một tác vụ cào dữ liệu nặng làm sập giao diện web của người dùng:
- **Node A (API & BFF)**: Chỉ phục vụ REST/GraphQL HTTP requests của người dùng. Tài nguyên ưu tiên RAM và độ trễ mạng thấp.
- **Node B (Async Workers)**: Chuyên chạy BullMQ / Python Workers. Tài nguyên ưu tiên CPU và băng thông mạng ra ngoài.
- **Node C (Cron Schedulers & Relay)**: Chuyên chạy các tác vụ định kỳ và Outbox Relay.
