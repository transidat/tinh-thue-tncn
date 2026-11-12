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

## 📄 Căn cứ pháp lý

- **Nghị quyết 954/2020/UBTVQH14** — Điều chỉnh mức giảm trừ gia cảnh
- **Điều 22, Luật Thuế Thu nhập cá nhân** — Biểu thuế lũy tiến từng phần
- **Thông tư 111/2013/TT-BTC** — Hướng dẫn thực hiện Luật Thuế TNCN

