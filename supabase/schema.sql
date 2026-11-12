-- ==========================================================
-- PHẦN MỀM TÍNH THUẾ TNCN (VN_PIT) - DATABASE SCHEMA
-- Dữ liệu dùng chung cho tất cả tài khoản kế toán đã đăng nhập
-- ==========================================================

-- 1. BẢNG NHÂN VIÊN (employees)
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_code TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    department TEXT,
    tax_code TEXT,
    id_card_number TEXT,
    is_resigned BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index tìm kiếm nhân viên
CREATE INDEX IF NOT EXISTS idx_employees_code ON public.employees(employee_code);
CREATE INDEX IF NOT EXISTS idx_employees_name ON public.employees(full_name);

-- 2. BẢNG NGƯỜI PHỤ THUỘC (dependents)
CREATE TABLE IF NOT EXISTS public.dependents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    relationship TEXT NOT NULL,
    birth_date DATE,
    tax_code TEXT,
    id_card_number TEXT,
    deduction_from TEXT NOT NULL, -- Định dạng 'YYYY-MM'
    deduction_to TEXT,            -- Định dạng 'YYYY-MM', NULL = vô thời hạn
    is_inactive BOOLEAN DEFAULT FALSE NOT NULL, -- Đánh dấu không còn sử dụng
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index tìm người phụ thuộc theo nhân viên
CREATE INDEX IF NOT EXISTS idx_dependents_employee_id ON public.dependents(employee_id);

-- 3. BẢNG KỲ TÍNH THUẾ (tax_periods)
CREATE TABLE IF NOT EXISTS public.tax_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period TEXT NOT NULL UNIQUE, -- 'YYYY-MM' (ví dụ: '2026-10')
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tax_periods_period ON public.tax_periods(period);

-- 4. BẢNG DỮ LIỆU THUẾ CHI TIẾT THEO THÁNG (payroll_items)
CREATE TABLE IF NOT EXISTS public.payroll_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id UUID NOT NULL REFERENCES public.tax_periods(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    employee_code TEXT NOT NULL,
    full_name TEXT NOT NULL,
    tax_code TEXT,
    total_income NUMERIC(15, 2) DEFAULT 0 NOT NULL,         -- Tổng thu nhập trong tháng
    non_taxable_income NUMERIC(15, 2) DEFAULT 0 NOT NULL,   -- Thu nhập không chịu thuế
    insurance NUMERIC(15, 2) DEFAULT 0 NOT NULL,            -- Bảo hiểm bắt buộc (BHXH, BHYT, BHTN...)
    dependent_count INTEGER DEFAULT 0 NOT NULL,             -- Số người phụ thuộc hợp lệ
    personal_deduction NUMERIC(15, 2) DEFAULT 11000000 NOT NULL, -- Giảm trừ bản thân (11tr)
    dependent_deduction NUMERIC(15, 2) DEFAULT 0 NOT NULL,  -- Giảm trừ NPT (dependent_count * 4.4tr)
    taxable_income NUMERIC(15, 2) DEFAULT 0 NOT NULL,       -- Thu nhập chịu thuế = total_income - non_taxable_income
    assessable_income NUMERIC(15, 2) DEFAULT 0 NOT NULL,    -- Thu nhập tính thuế = max(0, taxable_income - các khoản giảm trừ)
    pit_amount NUMERIC(15, 2) DEFAULT 0 NOT NULL,           -- Thuế TNCN phải nộp
    calculation_breakdown JSONB DEFAULT '[]'::jsonb,        -- Chi tiết từng bậc tính lũy tiến
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_period_employee UNIQUE (period_id, employee_code)
);

CREATE INDEX IF NOT EXISTS idx_payroll_period ON public.payroll_items(period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_emp_code ON public.payroll_items(employee_code);

-- ==========================================================
-- ROW LEVEL SECURITY (RLS) - DÙNG CHUNG CHO TẤT CẢ KẾ TOÁN ĐÃ ĐĂNG NHẬP
-- ==========================================================

-- Bật RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dependents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;

-- Cấp quyền đầy đủ cho vai trò đã đăng nhập (authenticated)
-- Employees
DROP POLICY IF EXISTS "Authenticated full access on employees" ON public.employees;
CREATE POLICY "Authenticated full access on employees"
    ON public.employees
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Dependents
DROP POLICY IF EXISTS "Authenticated full access on dependents" ON public.dependents;
CREATE POLICY "Authenticated full access on dependents"
    ON public.dependents
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Tax Periods
DROP POLICY IF EXISTS "Authenticated full access on tax_periods" ON public.tax_periods;
CREATE POLICY "Authenticated full access on tax_periods"
    ON public.tax_periods
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Payroll Items
DROP POLICY IF EXISTS "Authenticated full access on payroll_items" ON public.payroll_items;
CREATE POLICY "Authenticated full access on payroll_items"
    ON public.payroll_items
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

