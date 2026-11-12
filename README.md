# 🧾 VN_PIT — Hệ Thống Quản Lý & Tính Thuế TNCN

> Phần mềm tính thuế Thu nhập cá nhân (TNCN) dành cho kế toán doanh nghiệp Việt Nam, áp dụng biểu thuế lũy tiến 7 bậc theo **Nghị quyết 954/2020/UBTVQH14** và **Điều 22 Luật Thuế TNCN**.

---

## ✨ Tính năng chính

| Tính năng | Mô tả |
|-----------|-------|
| 👥 **Quản lý nhân viên** | Thêm, sửa, import danh sách nhân viên từ file Excel |
| 👨‍👩‍👧 **Người phụ thuộc** | Đăng ký người phụ thuộc, thiết lập thời gian giảm trừ |
| 🧮 **Tính thuế tháng** | Import thu nhập từ Excel, tính thuế TNCN lũy tiến tự động |
| 📊 **Lịch sử đóng thuế** | Xem lại các kỳ tính thuế, xuất báo cáo Excel |
| 🔐 **Xác thực người dùng** | Đăng nhập bảo mật qua Supabase Auth — chỉ kế toán nội bộ mới có quyền truy cập |

---

## 📐 Biểu thuế lũy tiến từng phần (7 bậc)

| Bậc | Phần TNTT / tháng | Thuế suất | Cách tính nhanh |
|-----|--------------------|-----------|-----------------|
| 1 | Đến 5.000.000 ₫ | **5%** | TNTT × 5% |
| 2 | Trên 5 → 10 triệu ₫ | **10%** | TNTT × 10% − 250.000 ₫ |
| 3 | Trên 10 → 18 triệu ₫ | **15%** | TNTT × 15% − 750.000 ₫ |
| 4 | Trên 18 → 32 triệu ₫ | **20%** | TNTT × 20% − 1.650.000 ₫ |
| 5 | Trên 32 → 52 triệu ₫ | **25%** | TNTT × 25% − 3.250.000 ₫ |
| 6 | Trên 52 → 80 triệu ₫ | **30%** | TNTT × 30% − 5.850.000 ₫ |
| 7 | Trên 80 triệu ₫ | **35%** | TNTT × 35% − 9.850.000 ₫ |

> **Mức giảm trừ:** Bản thân **11.000.000 ₫/tháng** · Người phụ thuộc **4.400.000 ₫/người/tháng**

---

## 🛠️ Công nghệ sử dụng

- **[Next.js 14](https://nextjs.org/)** (App Router) — React framework
- **[TypeScript](https://www.typescriptlang.org/)** — Type-safe code
- **[Supabase](https://supabase.com/)** — Backend (PostgreSQL + Auth + RLS)
- **[Tailwind CSS](https://tailwindcss.com/)** — Styling
- **[Lucide React](https://lucide.dev/)** — Icon set
- **[SheetJS (xlsx)](https://sheetjs.com/)** — Đọc/xuất file Excel

---

## 🚀 Hướng dẫn cài đặt

### Yêu cầu

- **Node.js** >= 18.x
- **npm** hoặc **pnpm**
- Tài khoản **Supabase** (miễn phí)

### 1. Clone dự án

```bash
git clone <repository-url>
cd VN_PIT
```

### 2. Cài đặt dependencies

```bash
npm install
```

### 3. Cấu hình biến môi trường

Sao chép file `.env.example` thành `.env.local` và điền thông tin Supabase:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> Lấy thông tin từ: **Supabase Dashboard → Project Settings → API**

### 4. Khởi tạo database

Chạy file schema trong **Supabase SQL Editor**:

```bash
# Mở file này và paste vào Supabase SQL Editor
supabase/schema.sql
```

File schema sẽ tạo các bảng:
- `employees` — Hồ sơ nhân viên
- `dependents` — Người phụ thuộc
- `tax_periods` — Kỳ tính thuế
- `payroll_items` — Chi tiết thuế từng tháng

Và bật **Row Level Security (RLS)** — chỉ người dùng đã đăng nhập mới có quyền truy cập dữ liệu.

### 5. Khởi chạy ứng dụng

```bash
npm run dev
```

Truy cập tại: [http://localhost:3000](http://localhost:3000)

---

## 📋 Quy trình sử dụng

```
Bước 1  →  Nhập / import danh sách nhân viên
Bước 2  →  Đăng ký người phụ thuộc & thời gian giảm trừ
Bước 3  →  Vào "Tính thuế tháng" → tải file mẫu → import thu nhập
Bước 4  →  Bấm tính thuế tự động → kiểm tra giải trình → lưu kết quả
```

---

## 📁 Cấu trúc thư mục

```
VN_PIT/
├── src/
│   ├── app/
│   │   ├── (dashboard)/          # Layout & trang chính
│   │   │   └── page.tsx          # Dashboard tổng quan
│   │   ├── layout.tsx            # Root layout
│   │   └── globals.css           # Global styles
│   ├── components/
│   │   └── layout/
│   │       └── Navbar.tsx        # Thanh điều hướng
│   ├── lib/
│   │   ├── tax-calculator.ts     # Logic tính thuế TNCN lũy tiến
│   │   ├── excel-utils.ts        # Tiện ích đọc/xuất Excel
│   │   ├── utils.ts              # Helper chung
│   │   └── supabase/
│   │       ├── client.ts         # Supabase client (browser)
│   │       ├── server.ts         # Supabase client (server)
│   │       └── middleware.ts     # Auth middleware
│   ├── middleware.ts             # Next.js middleware (session refresh)
│   └── types/
│       └── database.ts           # TypeScript interfaces
├── supabase/
│   └── schema.sql                # SQL schema & RLS policies
├── .env.example                  # Mẫu biến môi trường
├── next.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```

---

## ⚙️ Scripts

| Lệnh | Mô tả |
|------|-------|
| `npm run dev` | Khởi chạy môi trường development |
| `npm run build` | Build production |
| `npm run start` | Chạy bản build production |
| `npm run lint` | Kiểm tra linting |

---

## 🔒 Bảo mật

- **Row Level Security (RLS)** được bật trên tất cả bảng Supabase — dữ liệu chỉ truy cập được khi đã xác thực.
- **Middleware** tự động làm mới session và chuyển hướng về trang đăng nhập nếu chưa xác thực.
- **Biến môi trường** nhạy cảm (Service Role Key) không được đặt với prefix `NEXT_PUBLIC_`.

---

## 📄 Căn cứ pháp lý

- **Nghị quyết 954/2020/UBTVQH14** — Điều chỉnh mức giảm trừ gia cảnh
- **Điều 22, Luật Thuế Thu nhập cá nhân** — Biểu thuế lũy tiến từng phần
- **Thông tư 111/2013/TT-BTC** — Hướng dẫn thực hiện Luật Thuế TNCN

