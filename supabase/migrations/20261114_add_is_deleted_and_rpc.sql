-- Migration: Thêm is_deleted vào employees và tạo hàm RPC Transaction an toàn

-- 1. Thêm cột is_deleted vào employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE NOT NULL;

-- 2. Cập nhật ràng buộc unique cho employee_code: chỉ unique với các nhân viên chưa bị xóa mềm
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_employee_code_key;
DROP INDEX IF EXISTS public.uq_employees_code_active;
CREATE UNIQUE INDEX IF NOT EXISTS uq_employees_code_active ON public.employees(employee_code) WHERE is_deleted = false;

-- 3. Tạo hàm RPC lưu kỳ tính thuế trong một Transaction an toàn
CREATE OR REPLACE FUNCTION public.save_monthly_tax_payroll(
    p_period TEXT,
    p_notes TEXT,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_period_id UUID;
    v_item JSONB;
    v_inserted_count INT := 0;
BEGIN
    -- Kiểm tra quyền: chỉ cho phép user đã đăng nhập
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Yêu cầu xác thực tài khoản kế toán.';
    END IF;

    -- Lấy hoặc tạo mới bản ghi tax_periods
    SELECT id INTO v_period_id FROM public.tax_periods WHERE period = p_period;
    
    IF v_period_id IS NULL THEN
        INSERT INTO public.tax_periods (period, notes)
        VALUES (p_period, p_notes)
        RETURNING id INTO v_period_id;
    ELSE
        UPDATE public.tax_periods
        SET notes = p_notes, updated_at = timezone('utc'::text, now())
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
        'inserted_count', v_inserted_count
    );
END;
$$;
