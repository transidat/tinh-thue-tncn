-- ==========================================================
-- PHẦN MỀM TÍNH THUẾ TNCN (VN_PIT) - DATABASE SCHEMA
-- Căn cứ: Luật Thuế TNCN 2025 (Luật số 109/2025/QH15)
-- Dữ liệu dùng chung cho tài khoản kế toán đã đăng nhập
-- ==========================================================

-- 1. BẢNG NHÂN VIÊN (employees)
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_code TEXT NOT NULL,
    full_name TEXT NOT NULL,
    department TEXT,
    tax_code TEXT,
    id_card_number TEXT,
    is_resigned BOOLEAN DEFAULT FALSE NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Unique index cho Mã NV đối với các nhân viên chưa bị xóa mềm
CREATE UNIQUE INDEX IF NOT EXISTS uq_employees_code_active ON public.employees(employee_code) WHERE is_deleted = false;
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
    deduction_to TEXT NOT NULL,   -- Định dạng 'YYYY-MM' (bắt buộc cả 2 mốc)
    is_inactive BOOLEAN DEFAULT FALSE NOT NULL, -- Đánh dấu không còn sử dụng
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dependents_employee_id ON public.dependents(employee_id);

-- 3. BẢNG KỲ TÍNH THUẾ (tax_periods)
CREATE TABLE IF NOT EXISTS public.tax_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period TEXT NOT NULL UNIQUE, -- 'YYYY-MM' (ví dụ: '2026-01')
    notes TEXT,
    source_file_name TEXT,
    source_file_sha256 TEXT,
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
    personal_deduction NUMERIC(15, 2) DEFAULT 15500000 NOT NULL, -- Giảm trừ bản thân (15.5tr Luật 2025)
    dependent_deduction NUMERIC(15, 2) DEFAULT 0 NOT NULL,  -- Giảm trừ NPT (dependent_count * 6.2tr)
    total_deductions NUMERIC(15, 2) DEFAULT 0 NOT NULL,     -- Tổng giảm trừ (bảo hiểm + bản thân + NPT)
    taxable_income NUMERIC(15, 2) DEFAULT 0 NOT NULL,       -- Thu nhập chịu thuế = total_income - non_taxable_income
    assessable_income NUMERIC(15, 2) DEFAULT 0 NOT NULL,    -- Thu nhập tính thuế = max(0, taxable_income - các khoản giảm trừ)
    pit_amount NUMERIC(15, 2) DEFAULT 0 NOT NULL,           -- Thuế TNCN phải nộp (sau khi làm tròn xuống nghìn)
    calculation_breakdown JSONB DEFAULT '[]'::jsonb,        -- Chi tiết 5 bậc tính lũy tiến
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_period_employee UNIQUE (period_id, employee_code)
);

CREATE INDEX IF NOT EXISTS idx_payroll_period ON public.payroll_items(period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_emp_code ON public.payroll_items(employee_code);

-- 5. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dependents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated full access on employees" ON public.employees;
CREATE POLICY "Authenticated full access on employees"
    ON public.employees FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated full access on dependents" ON public.dependents;
CREATE POLICY "Authenticated full access on dependents"
    ON public.dependents FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Khóa quyền ghi qua PostgREST REST API trên tax_periods và payroll_items
DROP POLICY IF EXISTS "Authenticated full access on tax_periods" ON public.tax_periods;
DROP POLICY IF EXISTS "Allow authenticated read-only tax_periods" ON public.tax_periods;
CREATE POLICY "Allow authenticated read-only tax_periods"
    ON public.tax_periods FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated full access on payroll_items" ON public.payroll_items;
DROP POLICY IF EXISTS "Allow authenticated read-only payroll_items" ON public.payroll_items;
CREATE POLICY "Allow authenticated read-only payroll_items"
    ON public.payroll_items FOR SELECT TO authenticated USING (true);

-- Thu hồi quyền ghi ở tầng bảng
REVOKE INSERT, UPDATE, DELETE ON public.payroll_items FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.tax_periods FROM anon, authenticated;

-- 6. HÀM RPC LƯU KỲ TÍNH THUẾ TRONG TRANSACTION AN TOÀN (CHỈ DÀNH CHO SERVICE ROLE)
CREATE OR REPLACE FUNCTION public.save_monthly_tax_payroll(
    p_period TEXT,
    p_notes TEXT,
    p_source_file_name TEXT,
    p_source_file_sha256 TEXT,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_period_id UUID;
    v_item JSONB;
    v_inserted_count INT := 0;
BEGIN
    -- Lấy hoặc tạo mới tax_periods
    SELECT id INTO v_period_id FROM public.tax_periods WHERE period = p_period;
    
    IF v_period_id IS NULL THEN
        INSERT INTO public.tax_periods (period, notes, source_file_name, source_file_sha256)
        VALUES (p_period, p_notes, p_source_file_name, p_source_file_sha256)
        RETURNING id INTO v_period_id;
    ELSE
        UPDATE public.tax_periods
        SET notes = p_notes,
            source_file_name = p_source_file_name,
            source_file_sha256 = p_source_file_sha256,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_period_id;
    END IF;

    -- Xóa các payroll_items cũ của kỳ này
    DELETE FROM public.payroll_items WHERE period_id = v_period_id;

    -- Chèn các bản ghi payroll_items mới
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.payroll_items (
            period_id,
            employee_id,
            employee_code,
            full_name,
            tax_code,
            total_income,
            non_taxable_income,
            insurance,
            dependent_count,
            personal_deduction,
            dependent_deduction,
            total_deductions,
            taxable_income,
            assessable_income,
            pit_amount,
            calculation_breakdown
        ) VALUES (
            v_period_id,
            CASE WHEN (v_item->>'employee_id') IS NOT NULL AND (v_item->>'employee_id') <> '' THEN (v_item->>'employee_id')::UUID ELSE NULL END,
            v_item->>'employee_code',
            v_item->>'full_name',
            v_item->>'tax_code',
            COALESCE((v_item->>'total_income')::NUMERIC, 0),
            COALESCE((v_item->>'non_taxable_income')::NUMERIC, 0),
            COALESCE((v_item->>'insurance')::NUMERIC, 0),
            COALESCE((v_item->>'dependent_count')::INT, 0),
            COALESCE((v_item->>'personal_deduction')::NUMERIC, 15500000),
            COALESCE((v_item->>'dependent_deduction')::NUMERIC, 0),
            COALESCE((v_item->>'total_deductions')::NUMERIC, 0),
            COALESCE((v_item->>'taxable_income')::NUMERIC, 0),
            COALESCE((v_item->>'assessable_income')::NUMERIC, 0),
            COALESCE((v_item->>'pit_amount')::NUMERIC, 0),
            COALESCE(v_item->'calculation_breakdown', '[]'::jsonb)
        );
        v_inserted_count := v_inserted_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'period_id', v_period_id,
        'period', p_period,
        'source_file_name', p_source_file_name,
        'source_file_sha256', p_source_file_sha256,
        'inserted_count', v_inserted_count
    );
END;
$$;

-- Thu hồi quyền từ public/anon/authenticated và chỉ cấp cho service_role
REVOKE EXECUTE ON FUNCTION public.save_monthly_tax_payroll(TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.save_monthly_tax_payroll(TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_monthly_tax_payroll(TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;
