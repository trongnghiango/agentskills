# BỘ TIÊU CHUẨN DIỆT RÁC AI & THIẾT KẾ THỰC CHẤT (ANTI-AI GARBAGE STANDARD)
> Loại bỏ hoàn toàn mã nguồn thừa thãi, các hàm "ma" (Ghost Code) không ai gọi, trừu tượng hóa viển vông (YAGNI) và các hành vi gian lận kỹ thuật.

---

## 1. ĐỊNH NGHĨA "RÁC THƯỢNG ĐẲNG" (CLEAN GARBAGE / GHOST CODE)
Rác AI nguy hiểm nhất không phải là code xấu, mà là **Code viết rất đẹp, rất clean, có comment đầy đủ nhưng KHÔNG AI GỌI ĐẾN trong luồng chạy thực tế** hoặc giải quyết một bài toán tưởng tượng không có trong ngữ cảnh dự án.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   3 DẠNG RÁC AI PHỔ BIẾN CẦN DIỆT TRỪ                  │
├────────────────────────────────────────────────────────────────────────┤
│ 1. HÀM MA (Ghost Methods / 0 References):                              │
│    Viết trọn bộ 10 hàm CRUD hoặc helpers, nhưng hệ thống chỉ dùng đúng │
│    1 hàm. 9 hàm còn lại nằm chết khô trong codebase.                   │
├────────────────────────────────────────────────────────────────────────┤
│ 2. ẢO TƯỞNG TƯƠNG LAI (Speculative Generality / YAGNI):                │
│    Nghiệp vụ chỉ có 1 trường hợp cụ thể, nhưng dựng Factory, Strategy, │
│    Generic Providers "để sau này mở rộng" -> Over-engineering cực đoan.│
├────────────────────────────────────────────────────────────────────────┤
│ 3. ÉP SỐ BỀ MẶT (Anti-Fraud Violations):                               │
│    Hardcode điều kiện `if (id === '...')` hoặc tự sinh bản ghi ảo để   │
│    ép cho số liệu báo cáo/test khớp giả tạo.                           │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. NGUYÊN TẮC THIẾT KẾ THỰC CHẤT (STEVE JOBS CRAFTSMANSHIP)

1. **Quy tắc Đồ thị Gọi (Active Call-Graph Rule)**:
   - Mọi hàm public, class hay helper mới tạo ra bắt buộc phải có ít nhất **1 điểm gọi (caller) thực tế** trong chuỗi thực thi:
     $$\text{Route / Controller} \longrightarrow \text{Use Case} \longrightarrow \text{Domain Entity}$$
   - Bất kỳ hàm nào sinh ra mà chỉ có file test của chính nó gọi, nhưng không có luồng thực tế nào gọi $\longrightarrow$ **XÓA BỎ NGAY LẬP TỨC**.

2. **Quy tắc Số Ba (The Rule of Three)**:
   - Viết inline cho đến khi đoạn logic lặp lại ở **3 nơi độc lập**, mới được gom thành Utility/Service dùng chung. Cấm mới viết lần đầu đã vội vã tạo thư mục `common/helpers/`.

3. **Quy tắc Một Màn Hình (Single Screen Viewport Rule: 40–50 dòng/hàm)**:
   - Hàm nghiệp vụ khống chế $\le 40-50$ dòng code, đọc hiểu trọn vẹn trong 5 giây mà không cần cuộn trang.
   - Hàm chính (`execute`) chỉ là Nhạc trưởng điều phối ($\le 20$ dòng), ủy thác cho private helpers.
   - Dùng Guard Clauses (Return Early), khống chế tối đa 2 cấp lồng nhánh `if/else`.

4. **Trung thực Kỹ thuật Tuyệt đối (Zero Technical Dishonesty)**:
   - Mọi phép tính toán là công thức đại số phổ quát. Cấm regex đoán mò trạng thái text tự do.
   - Khi số liệu bị lệch, in danh sách sai lệch và tìm root cause ở dữ liệu thô.
