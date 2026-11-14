'use server';

import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { parseIncomeExcel } from '@/lib/excel-utils';
import { calculateFullPIT, isDependentValidForPeriod } from '@/lib/tax-calculator';
import { Dependent, Employee } from '@/types/database';

export interface CalculationRowResult {
  rowNumber: number;
  employeeId: string | null;
  maNV: string;
  hoTen: string;
  maSoThue: string;
  tongThuNhap: number;
  khongChiuThue: number;
  baoHiem: number;
  dependentCount: number;
  personalDeduction: number;
  dependentDeduction: number;
  totalDeductions: number;
  taxableIncome: number;
  assessableIncome: number;
  pitAmount: number;
  calculationBreakdown: any[];
}

export interface ActionErrorItem {
  row: number;
  maNV: string;
  reason: string;
}

export interface PayrollActionResult {
  ok: boolean;
  error?: string;
  period?: string;
  savedCount?: number;
  sourceFileName?: string;
  sourceFileSha256?: string;
  items?: CalculationRowResult[];
  errors?: ActionErrorItem[];
  summary?: {
    totalEmployees: number;
    totalIncome: number;
    totalTaxableIncome: number;
    totalAssessableIncome: number;
    totalPitAmount: number;
  };
}

/**
 * Hàm chung: Xác thực session người dùng và nạp dữ liệu DB để tính toán thuế
 */
async function processIncomeFile(
  formData: FormData
): Promise<{
  error?: string;
  period?: string;
  notes?: string;
  fileName?: string;
  fileSha256?: string;
  calculatedRows?: CalculationRowResult[];
  errors?: ActionErrorItem[];
}> {
  // 1. Kiểm tra session bằng SSR client
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Vui lòng đăng nhập' };
  }

  // 2. Nhận dữ liệu từ FormData
  const period = formData.get('period') as string;
  const notes = (formData.get('notes') as string) || '';
  const file = formData.get('file') as File | null;

  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return { error: 'Kỳ tính thuế không hợp lệ (định dạng YYYY-MM)' };
  }

  if (!file || file.size === 0) {
    return { error: 'Vui lòng chọn file Excel thu nhập hợp lệ' };
  }

  // 3. Đọc buffer trên server và tính SHA-256
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileSha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const fileName = file.name || 'income.xlsx';

  // 4. Parse file trên server
  const parseResult = await parseIncomeExcel(buffer);
  const actionErrors: ActionErrorItem[] = parseResult.errorRows.map((e) => ({
    row: e.rowNumber,
    maNV: e.raw?.MaNV || '',
    reason: e.reason,
  }));

  // 5. Query danh sách nhân viên còn hiệu lực (chưa bị xóa mềm) và NPT
  const { data: employeesData } = await supabase
    .from('employees')
    .select('id, employee_code, full_name, tax_code, is_deleted, is_resigned');

  const { data: dependentsData } = await supabase
    .from('dependents')
    .select('id, employee_id, full_name, relationship, deduction_from, deduction_to, is_inactive');

  const employees = (employeesData || []) as Employee[];
  const dependents = (dependentsData || []) as Dependent[];

  // Tạo map tra cứu nhanh
  const empMap = new Map<string, Employee>();
  const empDeletedMap = new Map<string, boolean>();

  employees.forEach((emp) => {
    if (emp.is_deleted) {
      empDeletedMap.set(emp.employee_code.toLowerCase().trim(), true);
    } else {
      empMap.set(emp.employee_code.toLowerCase().trim(), emp);
    }
  });

  // Tạo map NPT hiệu lực theo kỳ T
  const depCountMap = new Map<string, number>();
  dependents.forEach((dep) => {
    if (isDependentValidForPeriod(dep, period)) {
      const current = depCountMap.get(dep.employee_id) || 0;
      depCountMap.set(dep.employee_id, current + 1);
    }
  });

  // 6. Tính toán cho từng dòng hợp lệ từ file
  const calculatedRows: CalculationRowResult[] = [];

  for (const item of parseResult.validRows) {
    const codeKey = item.MaNV.toLowerCase().trim();

    // Kiểm tra nhân viên đã bị xóa mềm
    if (empDeletedMap.get(codeKey)) {
      actionErrors.push({
        row: item.rowNumber,
        maNV: item.MaNV,
        reason: `Nhân viên "${item.MaNV}" đã bị xóa trong hệ thống (xóa mềm)`,
      });
      continue;
    }

    // Kiểm tra nhân viên có tồn tại trong hệ thống
    const emp = empMap.get(codeKey);
    if (!emp) {
      actionErrors.push({
        row: item.rowNumber,
        maNV: item.MaNV,
        reason: `Mã nhân viên "${item.MaNV}" không tồn tại trong danh mục nhân viên`,
      });
      continue;
    }

    // Lấy số NPT hiệu lực từ DB (tuyệt đối không nhận từ client)
    const depCount = depCountMap.get(emp.id) || 0;

    // Tính toán thuế bằng hàm SSOT chuẩn (TypeScript)
    const calc = calculateFullPIT(
      item.TongThuNhap,
      item.KhongChiuThue,
      item.BaoHiem,
      depCount
    );

    calculatedRows.push({
      rowNumber: item.rowNumber,
      employeeId: emp.id,
      maNV: emp.employee_code,
      hoTen: item.HoTen || emp.full_name,
      maSoThue: item.MaSoThue || emp.tax_code || '',
      tongThuNhap: item.TongThuNhap,
      khongChiuThue: item.KhongChiuThue,
      baoHiem: item.BaoHiem,
      dependentCount: depCount,
      personalDeduction: calc.personalDeduction,
      dependentDeduction: calc.dependentDeduction,
      totalDeductions: calc.totalDeductions,
      taxableIncome: calc.taxableIncome,
      assessableIncome: calc.assessableIncome,
      pitAmount: calc.finalPitAmount,
      calculationBreakdown: calc.breakdown,
    });
  }

  return {
    period,
    notes,
    fileName,
    fileSha256,
    calculatedRows,
    errors: actionErrors,
  };
}

/**
 * Server Action: Xem trước kết quả tính thuế (KHÔNG ghi vào CSDL)
 */
export async function previewMonthlyPayrollAction(
  formData: FormData
): Promise<PayrollActionResult> {
  const processed = await processIncomeFile(formData);

  if (processed.error) {
    return { ok: false, error: processed.error };
  }

  const items = processed.calculatedRows || [];
  const summary = {
    totalEmployees: items.length,
    totalIncome: items.reduce((sum, r) => sum + r.tongThuNhap, 0),
    totalTaxableIncome: items.reduce((sum, r) => sum + r.taxableIncome, 0),
    totalAssessableIncome: items.reduce((sum, r) => sum + r.assessableIncome, 0),
    totalPitAmount: items.reduce((sum, r) => sum + r.pitAmount, 0),
  };

  return {
    ok: true,
    period: processed.period,
    sourceFileName: processed.fileName,
    sourceFileSha256: processed.fileSha256,
    items,
    errors: processed.errors,
    summary,
  };
}

/**
 * Server Action: Tính toán và lưu bảng thuế vào CSDL thông qua RPC bảo mật với Service Role Key
 */
export async function saveMonthlyPayrollAction(
  formData: FormData
): Promise<PayrollActionResult> {
  const processed = await processIncomeFile(formData);

  if (processed.error) {
    return { ok: false, error: processed.error };
  }

  const items = processed.calculatedRows || [];
  if (items.length === 0) {
    return {
      ok: false,
      error: 'Không có dòng dữ liệu hợp lệ nào để lưu bảng thuế.',
      errors: processed.errors,
    };
  }

  // Chuẩn bị payload chuẩn đã tính toán tin cậy từ server
  const rpcItems = items.map((r) => ({
    employee_id: r.employeeId,
    employee_code: r.maNV,
    full_name: r.hoTen,
    tax_code: r.maSoThue,
    total_income: r.tongThuNhap,
    non_taxable_income: r.khongChiuThue,
    insurance: r.baoHiem,
    dependent_count: r.dependentCount,
    personal_deduction: r.personalDeduction,
    dependent_deduction: r.dependentDeduction,
    total_deductions: r.totalDeductions,
    taxable_income: r.taxableIncome,
    assessable_income: r.assessableIncome,
    pit_amount: r.pitAmount,
    calculation_breakdown: r.calculationBreakdown,
  }));

  // Gọi RPC bằng Service Role Client (quyền thực thi duy nhất được cấp cho service_role)
  const serviceSupabase = createServiceRoleClient();
  const { data: rpcResult, error: rpcError } = await serviceSupabase.rpc(
    'save_monthly_tax_payroll',
    {
      p_period: processed.period,
      p_notes: processed.notes || `Tính ngày ${new Date().toLocaleDateString('vi-VN')}`,
      p_source_file_name: processed.fileName,
      p_source_file_sha256: processed.fileSha256,
      p_items: rpcItems,
    }
  );

  if (rpcError) {
    console.error('Lỗi gọi RPC save_monthly_tax_payroll:', rpcError);
    return {
      ok: false,
      error: `Không thể lưu bảng thuế vào CSDL: ${rpcError.message}`,
    };
  }

  const summary = {
    totalEmployees: items.length,
    totalIncome: items.reduce((sum, r) => sum + r.tongThuNhap, 0),
    totalTaxableIncome: items.reduce((sum, r) => sum + r.taxableIncome, 0),
    totalAssessableIncome: items.reduce((sum, r) => sum + r.assessableIncome, 0),
    totalPitAmount: items.reduce((sum, r) => sum + r.pitAmount, 0),
  };

  return {
    ok: true,
    period: processed.period,
    savedCount: rpcResult?.inserted_count ?? items.length,
    sourceFileName: processed.fileName,
    sourceFileSha256: processed.fileSha256,
    items,
    errors: processed.errors,
    summary,
  };
}
