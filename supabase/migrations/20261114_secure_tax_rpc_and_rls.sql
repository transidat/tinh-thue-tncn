-- ==========================================================
-- MIGRATION: BẢO MẬT DỮ LIỆU THUẾ TNCN, KHÓA GHI QUA REST API VÀ BẢO VỆ RPC
-- Thời gian tạo: 2026-11-14
-- Căn cứ kiến trúc: Phương án A (Server Action làm SSOT)
-- ==========================================================

-- 1. XÓA CÁC POLICY CŨ CHO PHÉP FULL ACCESS TRÊN BẢNG THUẾ
DROP POLICY IF EXISTS "Authenticated full access on payroll_items" ON public.payroll_items;
DROP POLICY IF EXISTS "Authenticated full access on tax_periods" ON public.tax_periods;
DROP POLICY IF EXISTS "Allow authenticated read-only payroll_items" ON public.payroll_items;
DROP POLICY IF EXISTS "Allow authenticated read-only tax_periods" ON public.tax_periods;

-- 2. TẠO POLICY CHỈ CHO PHÉP ĐỌC (SELECT) CHO AUTHENTICATED
CREATE POLICY "Allow authenticated read-only payroll_items"
    ON public.payroll_items FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated read-only tax_periods"
    ON public.tax_periods FOR SELECT
    TO authenticated
    USING (true);

-- 3. THÊM LỚP PHÒNG THỦ THỨ HAI: THU HỒI QUYỀN GHI Ở TẦNG BẢNG (TABLE LEVEL GRANTS)
REVOKE INSERT, UPDATE, DELETE ON public.payroll_items FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.tax_periods FROM anon, authenticated;

-- 4. THÊM CÁC CỘT AUDIT TRAIL VÀ CỘT TỔNG GIẢM TRỪ
ALTER TABLE public.tax_periods ADD COLUMN IF NOT EXISTS source_file_name TEXT;
ALTER TABLE public.tax_periods ADD COLUMN IF NOT EXISTS source_file_sha256 TEXT;
ALTER TABLE public.payroll_items ADD COLUMN IF NOT EXISTS total_deductions NUMERIC(15, 2) NOT NULL DEFAULT 0;

-- 5. VIẾT LẠI RPC save_monthly_tax_payroll (SECURITY DEFINER + search_path an toàn)
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
    -- Lấy hoặc tạo mới bản ghi tax_periods kèm theo thông tin file gốc và hash audit
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

    -- Xóa các payroll_items cũ của kỳ này trong cùng transaction
    DELETE FROM public.payroll_items WHERE period_id = v_period_id;

    -- Chèn các bản ghi payroll_items mới đã được tính toán tin cậy từ Server Action
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

-- 6. THU HỒI QUYỀN EXECUTE TẤT CẢ PHIÊN BẢN HÀM RPC TRÊN
-- Thu hồi phiên bản cũ (3 tham số)
REVOKE EXECUTE ON FUNCTION public.save_monthly_tax_payroll(TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
-- Thu hồi phiên bản mới (5 tham số)
REVOKE EXECUTE ON FUNCTION public.save_monthly_tax_payroll(TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;

-- CHỈ CẤP QUYỀN EXECUTE CHO ROLE service_role
GRANT EXECUTE ON FUNCTION public.save_monthly_tax_payroll(TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;
