# 🧾 VN_PIT — Hệ Thống Quản Lý & Tính Thuế Thu Nhập Cá Nhân

> Phần mềm tính Thuế Thu nhập cá nhân (TNCN) dành cho Kế toán doanh nghiệp Việt Nam, áp dụng **Biểu thuế lũy tiến từng phần 5 bậc** theo **Luật Thuế TNCN 2025 (Luật số 109/2025/QH15)** từ kỳ tính thuế năm 2026.

---

## ✨ Tính Năng Chính

| Phân hệ | Mô tả nghiệp vụ |
|---|---|
| 👥 **Quản lý nhân viên** | CRUD nhân viên, xóa mềm (soft delete), import Excel (`.xlsx`) tự động cập nhật ghi đè (Upsert) khi trùng mã, kiểm tra trùng lặp trong file |
| 👨‍👩‍👧 **Người phụ thuộc** | Đăng ký người phụ thuộc, bắt buộc đủ 2 mốc thời gian Từ tháng/năm đến Đến tháng/năm, danh mục quan hệ chuẩn, checkbox Không còn sử dụng |
| 🧮 **Tính thuế tháng** | Xử lý hoàn toàn phía Server (Server Action), tự động tra soát NPT từ CSDL, kiểm tra mã NV bắt buộc, tính tự động 4 bước minh bạch, ghi đè kỳ cũ trong transaction an toàn |
| 🛡️ **Kiểm toán & Toàn vẹn dữ liệu** | Tự động tính mã băm SHA-256 của file Excel nguồn lưu vào `tax_periods` để đối soát; khóa hoàn toàn quyền ghi trực tiếp qua REST API |
| 📊 **Lịch sử đóng thuế** | Tra cứu các kỳ đã lưu, tìm kiếm nhân viên trong bảng tháng, xuất báo cáo Excel định dạng VND có phân cách hàng nghìn |
| 🔐 **Bảo mật & Phân quyền** | Đăng nhập an toàn qua Supabase Auth, tắt đăng ký công khai, RPC bọc `SECURITY DEFINER` với `search_path` an toàn và chỉ cấp quyền gọi cho `service_role` |

---

## 📐 Biểu Thuế Lũy Tiến Từng Phần (5 Bậc) — Luật 109/2025/QH15

Áp dụng cho thu nhập từ tiền lương, tiền công:

| Bậc | Thu nhập tính thuế (TNTT) / tháng | Thuế suất | Công thức tính nhanh |
|:---:|---|:---:|---|
| **1** | Đến 10.000.000 ₫ | **5%** | TNTT × 5% |
| **2** | Trên 10.000.000 ₫ → 30.000.000 ₫ | **10%** | TNTT × 10% − 500.000 ₫ |
| **3** | Trên 30.000.000 ₫ → 60.000.000 ₫ | **20%** | TNTT × 20% − 3.500.000 ₫ |
| **4** | Trên 60.000.000 ₫ → 100.000.000 ₫ | **30%** | TNTT × 30% − 9.500.000 ₫ |
| **5** | Trên 100.000.000 ₫ | **35%** | TNTT × 35% − 14.500.000 ₫ |

> 📌 **Mức giảm trừ gia cảnh:**
> - Bản thân người nộp thuế: **15.500.000 ₫/tháng** (186 triệu ₫/năm)
> - Mỗi người phụ thuộc: **6.200.000 ₫/người/tháng** (74.4 triệu ₫/năm)
> - **Làm tròn:** Tiền thuế tổng cộng cuối cùng được làm tròn **xuống** hàng nghìn.

---

## 🛠️ Công Nghệ Sử Dụng

- **Next.js 14** (App Router, Server Actions) — React Framework
- **TypeScript** — Định kiểu tĩnh chặt chẽ, Single Source of Truth (SSOT) cho logic thuế
- **Supabase** — Cơ sở dữ liệu PostgreSQL + Auth + Row Level Security (RLS)
- **Vitest** — Khung kiểm thử tự động tốc độ cao (Unit Test & Security Test)
- **Tailwind CSS** — Giao diện responsive, sạch sẽ, hiện đại
- **Lucide React** — Icon trực quan
- **SheetJS (xlsx)** — Đọc & xuất file Excel chuyên dụng

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### 1. Chuẩn bị môi trường
Sao chép file `.env.example` thành `.env.local` và điền thông tin dự án Supabase:

```bash
cp .env.example .env.local
```

Nội dung `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Khóa bí mật máy chủ (chỉ dùng phía Server trong Server Action, tuyệt đối không lộ ra client)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 2. Thiết lập CSDL và Tài khoản Kế toán trên Supabase
1. **Chạy Migration SQL**:
   Mở **SQL Editor** trên Supabase Dashboard và chạy nội dung file:
   - `supabase/schema.sql` (hoặc chạy tuần tự migration trong `supabase/migrations/`)
   - Đặc biệt áp dụng `supabase/migrations/20261114_secure_tax_rpc_and_rls.sql` để thiết lập RLS khóa ghi và bảo vệ RPC.
2. **Tắt Đăng ký người dùng tự do**:
   Vào **Authentication** → **Sign In / Up** → chuyển **"Allow new users to sign up"** thành **OFF** → bấm **Save**.
3. **Tạo tài khoản Kế toán**:
   Vào **Authentication** → **Users** → bấm **Add user** → chọn **Create user** → điền Email và Mật khẩu kế toán.

### 3. Cài đặt thư viện & Khởi chạy

```bash
# Cài đặt thư viện
npm install

# Chạy bộ kiểm thử tự động (11 tests xác minh logic 5 bậc và bảo mật Server Action)
npm test

# Khởi động máy chủ phát triển
npm run dev
```

Mở trình duyệt truy cập: **http://localhost:3000**

---

## 📁 Cấu Trúc Thư Mục

```
VN_PIT/
├── src/
│   ├── config/
│   │   └── tax-rules.ts          # Nguồn cấu hình tham số thuế DUY NHẤT (15.5tr, 6.2tr, 5 bậc)
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/page.tsx    # Trang đăng nhập duy nhất (đã xóa bỏ trang đăng ký)
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx        # Layout dashboard & kiểm tra session
│   │   │   ├── page.tsx          # Tổng quan & bảng tra cứu 5 bậc
│   │   │   ├── nhan-vien/        # CRUD nhân viên, xóa mềm, import Excel upsert
│   │   │   ├── nguoi-phu-thuoc/  # Quản lý người phụ thuộc (2 mốc thời gian)
│   │   │   ├── tinh-thue/
│   │   │   │   ├── page.tsx      # Giao diện tính thuế tháng & bảng xem trước
│   │   │   │   └── actions.ts    # Server Action: đọc file, hash SHA-256, tra NPT & lưu DB
│   │   │   └── lich-su-thue/     # Lịch sử thuế, tìm kiếm, xuất Excel VND
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/layout/        # Navbar, Drawer responsive
│   ├── lib/
│   │   ├── __tests__/            # Bộ test Vitest (tax-calculator.test.ts, server-actions.test.ts)
│   │   ├── tax-calculator.ts     # Engine tính toán thuế theo tax-rules
│   │   ├── excel-utils.ts        # Đọc/xuất Excel (chuẩn cột KhongChiuThue)
│   │   └── supabase/
│   │       ├── client.ts         # Supabase client cho trình duyệt
│   │       ├── server.ts         # Supabase client cho Server Actions (cookie SSR)
│   │       ├── service-role.ts   # Supabase client cho Service Role Key (bảo mật server)
│   │       └── middleware.ts     # Middleware bảo vệ route
│   ├── middleware.ts             # Chuyển hướng người chưa đăng nhập về /login
│   └── types/database.ts         # TypeScript interfaces
├── supabase/
│   ├── schema.sql                # Schema CSDL hoàn chỉnh
│   └── migrations/               # Các migration lịch sử (bao gồm RLS khóa ghi & hardened RPC)
├── vitest.config.mjs             # Cấu hình test runner Vitest
├── .env.example
├── .gitignore
├── package.json
└── tsconfig.json
```

---

## 📄 Căn Cứ Pháp Lý

- **Luật Thuế Thu nhập cá nhân 2025 (Luật số 109/2025/QH15)** — Biểu thuế lũy tiến từng phần 5 bậc và điều chỉnh mức giảm trừ gia cảnh.
- **Nghị định & Thông tư hướng dẫn thi hành Luật Thuế TNCN**.
