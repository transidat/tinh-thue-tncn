'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Employee, Dependent, PayrollItem } from '@/types/database';
import {
  Receipt,
  FileSpreadsheet,
  Download,
  Upload,
  Calculator,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Eye,
  Calendar,
  RefreshCw
} from 'lucide-react';
import {
  downloadIncomeTemplate,
  parseIncomeExcel,
  IncomeImportRow,
  exportTaxPayrollToExcel
} from '@/lib/excel-utils';
import {
  calculateFullPIT,
  isDependentValidForPeriod,
  formatCurrencyVND,
  TaxCalculationDetailResult
} from '@/lib/tax-calculator';

interface CalculatedPayrollRow extends IncomeImportRow {
  employeeId?: string;
  dependentCount: number;
  calcResult: TaxCalculationDetailResult;
}

export default function TaxCalculationPage() {
  const supabase = createClient();

  const [period, setPeriod] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsingFile, setParsingFile] = useState(false);
  const [rawValidRows, setRawValidRows] = useState<IncomeImportRow[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  // Database caches
  const [employeesMap, setEmployeesMap] = useState<Map<string, Employee>>(new Map());
  const [dependentsByEmpCode, setDependentsByEmpCode] = useState<Map<string, Dependent[]>>(new Map());
  const [dbLoading, setDbLoading] = useState(true);

  // Kết quả tính thuế
  const [calculatedItems, setCalculatedItems] = useState<CalculatedPayrollRow[]>([]);
  const [savingPeriod, setSavingPeriod] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Modal giải trình 4 bước
  const [selectedDetailItem, setSelectedDetailItem] = useState<CalculatedPayrollRow | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const loadEmployeesAndDependents = async () => {
    try {
      setDbLoading(true);

      const [empRes, depRes] = await Promise.all([
        supabase.from('employees').select('*'),
        supabase.from('dependents').select('*, employees:employee_id(employee_code, is_deleted)'),
      ]);

      if (empRes.error) throw empRes.error;
      if (depRes.error) throw depRes.error;

      // Chỉ lấy các nhân viên chưa bị xóa mềm
      const empMap = new Map<string, Employee>();
      (empRes.data || []).forEach((e) => {
        if (!e.is_deleted) {
          empMap.set(e.employee_code.toLowerCase().trim(), e);
        }
      });
      setEmployeesMap(empMap);

      const depMap = new Map<string, Dependent[]>();
      (depRes.data || []).forEach((d: any) => {
        if (!d.employees?.is_deleted) {
          const empCode = d.employees?.employee_code?.toLowerCase().trim();
          if (empCode) {
            if (!depMap.has(empCode)) depMap.set(empCode, []);
            depMap.get(empCode)!.push(d);
          }
        }
      });
      setDependentsByEmpCode(depMap);
    } catch (err: any) {
      setNotification({ type: 'error', message: 'Lỗi tải danh mục: ' + err.message });
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => {
    loadEmployeesAndDependents();
  }, []);

  // Đọc file Excel thu nhập tháng
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setSaveSuccess(false);
    setParsingFile(true);

    try {
      const { validRows, errorRows } = await parseIncomeExcel(file);
      const errorsList: string[] = errorRows.map((er) => `Dòng ${er.rowNumber}: ${er.reason}`);

      // Kiểm tra ràng buộc: Mã NV bắt buộc phải tồn tại trong danh mục nhân viên
      const finalValidRows: IncomeImportRow[] = [];

      for (const row of validRows) {
        const emp = employeesMap.get(row.MaNV.toLowerCase().trim());
        if (!emp) {
          errorsList.push(`Dòng ${row.rowNumber}: Mã NV "${row.MaNV}" (${row.HoTen}) không tồn tại trong danh mục nhân viên, đã bỏ qua.`);
        } else {
          finalValidRows.push(row);
        }
      }

      setImportErrors(errorsList);
      setRawValidRows(finalValidRows);

      if (finalValidRows.length === 0) {
        setNotification({
          type: 'error',
          message: 'Không có dòng dữ liệu nào hợp lệ để tính thuế. Vui lòng kiểm tra lại danh sách lỗi bên dưới.',
        });
        setCalculatedItems([]);
      } else {
        setNotification({
          type: 'success',
          message: `Đã đọc thành công ${finalValidRows.length} nhân viên hợp lệ từ file Excel!`,
        });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: 'Lỗi khi đọc file Excel: ' + err.message });
      setRawValidRows([]);
      setImportErrors([]);
    } finally {
      setParsingFile(false);
    }
  };

  // Tính thuế cho các dòng hợp lệ theo kỳ tháng được chọn
  const handleCalculateTax = () => {
    if (rawValidRows.length === 0) {
      setNotification({ type: 'error', message: 'Chưa có dữ liệu thu nhập để tính toán.' });
      return;
    }

    const results: CalculatedPayrollRow[] = rawValidRows.map((row) => {
      const empCodeKey = row.MaNV.toLowerCase().trim();
      const emp = employeesMap.get(empCodeKey);

      // Tìm người phụ thuộc của nhân viên này
      const allDeps = dependentsByEmpCode.get(empCodeKey) || [];

      // Lọc các NPT hợp lệ trong tháng kỳ này: Không còn sử dụng = false VÀ deduction_from <= period <= deduction_to
      const validDeps = allDeps.filter((dep) =>
        isDependentValidForPeriod(
          {
            is_inactive: dep.is_inactive,
            deduction_from: dep.deduction_from,
            deduction_to: dep.deduction_to,
          },
          period
        )
      );

      const dependentCount = validDeps.length;

      // Tính toàn bộ 4 bước theo Biểu 5 bậc mới (Luật 109/2025/QH15)
      const calcResult = calculateFullPIT(
        row.TongThuNhap,
        row.KhongChiuThue,
        row.BaoHiem,
        dependentCount
      );

      return {
        ...row,
        employeeId: emp?.id,
        dependentCount,
        calcResult,
      };
    });

    setCalculatedItems(results);
    setSaveSuccess(false);
    setNotification({
      type: 'success',
      message: `Đã tính toán thuế TNCN thành công theo biểu 5 bậc mới cho ${results.length} nhân viên trong kỳ ${period}!`,
    });
  };

  useEffect(() => {
    if (rawValidRows.length > 0) {
      handleCalculateTax();
    }
  }, [period, rawValidRows]);

  const summary = useMemo(() => {
    let totalIncome = 0;
    let totalNonTaxable = 0;
    let totalInsurance = 0;
    let totalTaxable = 0;
    let totalAssessable = 0;
    let totalTax = 0;
    let employeesWithTax = 0;

    calculatedItems.forEach((item) => {
      totalIncome += item.TongThuNhap;
      totalNonTaxable += item.KhongChiuThue;
      totalInsurance += item.BaoHiem;
      totalTaxable += item.calcResult.taxableIncome;
      totalAssessable += item.calcResult.assessableIncome;
      totalTax += item.calcResult.finalPitAmount;
      if (item.calcResult.finalPitAmount > 0) employeesWithTax++;
    });

    return {
      totalEmployees: calculatedItems.length,
      employeesWithTax,
      totalIncome,
      totalNonTaxable,
      totalInsurance,
      totalTaxable,
      totalAssessable,
      totalTax,
    };
  }, [calculatedItems]);

  // Lưu kỳ tính thuế vào CSDL: Ghi đè sạch sẽ nếu đã có kỳ này
  const handleSaveToDatabase = async () => {
    if (calculatedItems.length === 0) return;
    setSavingPeriod(true);

    try {
      // 1. Chuẩn bị mảng bản ghi
      const payloadItems = calculatedItems.map((item) => ({
        employee_id: item.employeeId || null,
        employee_code: item.MaNV.trim(),
        full_name: item.HoTen.trim(),
        tax_code: item.MaSoThue?.trim() || null,
        total_income: item.TongThuNhap,
        non_taxable_income: item.KhongChiuThue,
        insurance: item.BaoHiem,
        dependent_count: item.dependentCount,
        personal_deduction: item.calcResult.personalDeduction,
        dependent_deduction: item.calcResult.dependentDeduction,
        taxable_income: item.calcResult.taxableIncome,
        assessable_income: item.calcResult.assessableIncome,
        pit_amount: item.calcResult.finalPitAmount,
        calculation_breakdown: item.calcResult.breakdown,
      }));

      // 2. Thử gọi RPC transaction an toàn trước
      const rpcResult = await supabase.rpc('save_monthly_tax_payroll', {
        p_period: period,
        p_notes: `Tính ngày ${new Date().toLocaleDateString('vi-VN')}`,
        p_items: payloadItems,
      });

      if (rpcResult.error) {
        // Fallback: Nếu hàm RPC chưa được cài đặt trong CSDL, thực hiện tuần tự qua Supabase client
        console.warn('RPC not available, falling back to direct client operations:', rpcResult.error.message);

        // Lấy hoặc tạo period
        let periodId: string;
        const { data: existingPeriod } = await supabase
          .from('tax_periods')
          .select('id')
          .eq('period', period)
          .maybeSingle();

        if (existingPeriod?.id) {
          periodId = existingPeriod.id;
        } else {
          const { data: newPeriod, error: pErr } = await supabase
            .from('tax_periods')
            .insert({ period, notes: `Tính ngày ${new Date().toLocaleDateString('vi-VN')}` })
            .select('id')
            .single();
          if (pErr) throw pErr;
          periodId = newPeriod.id;
        }

        // Xóa sạch các dòng cũ của kỳ này
        await supabase.from('payroll_items').delete().eq('period_id', periodId);

        // Chèn mới
        const insertRows = payloadItems.map((pi) => ({
          period_id: periodId,
          ...pi,
        }));
        const { error: insErr } = await supabase.from('payroll_items').insert(insertRows);
        if (insErr) throw insErr;
      }

      setSaveSuccess(true);
      setNotification({
        type: 'success',
        message: `Đã lưu thành công và ghi đè bảng tính thuế kỳ ${period} vào hệ thống!`,
      });
    } catch (err: any) {
      setNotification({ type: 'error', message: 'Lỗi khi lưu bảng thuế: ' + err.message });
    } finally {
      setSavingPeriod(false);
    }
  };

  const handleExportExcel = () => {
    if (calculatedItems.length === 0) return;

    const exportRows: PayrollItem[] = calculatedItems.map((item, idx) => ({
      id: String(idx),
      period_id: period,
      employee_id: item.employeeId || null,
      employee_code: item.MaNV,
      full_name: item.HoTen,
      tax_code: item.MaSoThue || null,
      total_income: item.TongThuNhap,
      non_taxable_income: item.KhongChiuThue,
      insurance: item.BaoHiem,
      dependent_count: item.dependentCount,
      personal_deduction: item.calcResult.personalDeduction,
      dependent_deduction: item.calcResult.dependentDeduction,
      taxable_income: item.calcResult.taxableIncome,
      assessable_income: item.calcResult.assessableIncome,
      pit_amount: item.calcResult.finalPitAmount,
      calculation_breakdown: item.calcResult.breakdown,
      created_at: '',
      updated_at: '',
    }));

    exportTaxPayrollToExcel(period, exportRows);
  };

  return (
    <div className="space-y-6">
      {notification && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between shadow-md animate-fadeIn ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            )}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="p-1 hover:opacity-75 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2.5">
            <Receipt className="w-7 h-7 text-emerald-600" />
            <span>Tính Thuế TNCN Theo Tháng (Biểu 5 Bậc 2026)</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Biểu thuế 5 bậc Luật 109/2025/QH15 &bull; Giảm trừ bản thân 15.5tr &bull; NPT 6.2tr &bull; Làm tròn xuống nghìn
          </p>
        </div>

        <button
          onClick={downloadIncomeTemplate}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white text-slate-700 hover:bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium transition shadow-xs self-start sm:self-auto cursor-pointer"
        >
          <Download className="w-4 h-4 text-slate-500" />
          <span>Tải mẫu Excel thu nhập</span>
        </button>
      </div>

      {/* Control Box: Chọn kỳ & Upload Excel */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>Kỳ tính thuế (Tháng/Năm)</span>
            </label>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Người phụ thuộc sẽ xét hiệu lực trong tháng này
            </p>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Import file Excel thu nhập tháng (Cột: KhongChiuThue)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".xlsx, .xls"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={parsingFile}
                className="flex-1 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 rounded-xl text-xs sm:text-sm text-slate-700 flex items-center justify-center gap-2 cursor-pointer transition truncate"
              >
                {parsingFile ? (
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                ) : (
                  <Upload className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                )}
                <span className="truncate">
                  {selectedFile ? selectedFile.name : 'Bấm chọn file Excel thu nhập (.xlsx, .xls)'}
                </span>
              </button>

              {rawValidRows.length > 0 && (
                <button
                  type="button"
                  onClick={handleCalculateTax}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-md shadow-emerald-200 flex items-center gap-1.5 cursor-pointer flex-shrink-0"
                >
                  <Calculator className="w-4 h-4" />
                  <span>Tính lại</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Danh sách lỗi khi import file thu nhập */}
        {importErrors.length > 0 && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-rose-800">
              <AlertCircle className="w-4 h-4" />
              Có {importErrors.length} dòng dữ liệu bị lỗi trong file Excel (đã bỏ qua):
            </p>
            {importErrors.slice(0, 5).map((err, i) => (
              <p key={i}>&bull; {err}</p>
            ))}
            {importErrors.length > 5 && (
              <p className="italic">...và {importErrors.length - 5} dòng lỗi khác.</p>
            )}
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-semibold text-slate-700">Các cột bắt buộc:</span>
          <span>&bull; MaNV (phải tồn tại trong CSDL)</span>
          <span>&bull; HoTen</span>
          <span>&bull; MaSoThue</span>
          <span>&bull; TongThuNhap</span>
          <span>&bull; KhongChiuThue</span>
          <span>&bull; BaoHiem</span>
        </div>
      </div>

      {/* Thống kê sau khi tính */}
      {calculatedItems.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Nhân viên tính thuế</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-800 mt-1">
                {summary.totalEmployees}
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">
                {summary.employeesWithTax} người có thuế phải nộp
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Tổng thu nhập</p>
              <p className="text-lg sm:text-xl font-bold text-slate-800 mt-1">
                {formatCurrencyVND(summary.totalIncome)}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                KCT: {formatCurrencyVND(summary.totalNonTaxable)}
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Tổng TNTT (toàn cty)</p>
              <p className="text-lg sm:text-xl font-bold text-slate-800 mt-1">
                {formatCurrencyVND(summary.totalAssessable)}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Sau khi trừ bảo hiểm & gia cảnh
              </p>
            </div>

            <div className="bg-emerald-600 p-4 rounded-2xl text-white shadow-md shadow-emerald-200">
              <p className="text-[11px] font-semibold text-emerald-100 uppercase">Tổng Thuế TNCN Phải Nộp</p>
              <p className="text-xl sm:text-2xl font-bold text-white mt-1">
                {formatCurrencyVND(summary.totalTax)}
              </p>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                Kỳ thuế: {period} (Làm tròn xuống nghìn)
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="text-xs text-slate-600">
              {saveSuccess ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Đã ghi đè và lưu kết quả vào hệ thống thành công!
                </span>
              ) : (
                <span>Bấm <strong>"Lưu vào hệ thống"</strong> để ghi nhận kỳ thuế (tự động ghi đè sạch sẽ nếu kỳ đã có)</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium text-xs sm:text-sm rounded-xl border border-slate-300 transition cursor-pointer"
              >
                <Download className="w-4 h-4 text-slate-500" />
                <span>Xuất Excel</span>
              </button>

              <button
                type="button"
                onClick={handleSaveToDatabase}
                disabled={savingPeriod}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-md shadow-emerald-200 transition disabled:opacity-60 cursor-pointer"
              >
                {savingPeriod ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Lưu vào hệ thống</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Bảng chi tiết */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800">
                Bảng Tính Thuế Chi Tiết &bull; Kỳ {period}
              </h2>
              <span className="text-xs text-slate-500">
                Hiển thị {calculatedItems.length} người lao động
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3 px-3">Mã NV</th>
                    <th className="py-3 px-3">Họ và tên</th>
                    <th className="py-3 px-3 text-right">Tổng TN</th>
                    <th className="py-3 px-3 text-right">Không chịu thuế</th>
                    <th className="py-3 px-3 text-right">Bảo hiểm</th>
                    <th className="py-3 px-3 text-center">Số NPT</th>
                    <th className="py-3 px-3 text-right">Giảm trừ NPT</th>
                    <th className="py-3 px-3 text-right">TN Tính Thuế</th>
                    <th className="py-3 px-3 text-right font-bold text-emerald-800">Thuế Phải Nộp</th>
                    <th className="py-3 px-3 text-center">Giải trình</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {calculatedItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3 font-mono font-bold text-slate-800">
                        {item.MaNV}
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-semibold text-slate-900">{item.HoTen}</p>
                        {item.MaSoThue && (
                          <p className="font-mono text-[11px] text-slate-400">MST: {item.MaSoThue}</p>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-slate-700">
                        {formatCurrencyVND(item.TongThuNhap)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600">
                        {formatCurrencyVND(item.KhongChiuThue)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600">
                        {formatCurrencyVND(item.BaoHiem)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                            item.dependentCount > 0
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {item.dependentCount}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600">
                        {formatCurrencyVND(item.calcResult.dependentDeduction)}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-800">
                        {formatCurrencyVND(item.calcResult.assessableIncome)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-sm text-emerald-700">
                        {formatCurrencyVND(item.calcResult.finalPitAmount)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedDetailItem(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 rounded-lg border border-emerald-200 transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>4 Bước</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Giải trình 4 bước minh bạch */}
      {selectedDetailItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-scaleIn">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Giải Trình 4 Bước Tính Thuế TNCN (Luật 109/2025/QH15)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Nhân viên: <strong className="text-slate-800">{selectedDetailItem.HoTen}</strong> ({selectedDetailItem.MaNV}) &bull; Kỳ {period}
                </p>
              </div>
              <button
                onClick={() => setSelectedDetailItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                {/* Bước 1 */}
                <div>
                  <p className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] flex items-center justify-center">1</span>
                    Xác định Thu nhập chịu thuế (TNCT):
                  </p>
                  <p className="text-slate-600 text-xs mt-1 ml-6">
                    = Tổng thu nhập ({formatCurrencyVND(selectedDetailItem.TongThuNhap)}) - Thu nhập không chịu thuế ({formatCurrencyVND(selectedDetailItem.KhongChiuThue)})
                  </p>
                  <p className="font-bold text-slate-900 ml-6 mt-0.5">
                    &rarr; TNCT = {formatCurrencyVND(selectedDetailItem.calcResult.taxableIncome)}
                  </p>
                </div>

                {/* Bước 2 */}
                <div className="border-t border-slate-200 pt-2.5">
                  <p className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] flex items-center justify-center">2</span>
                    Xác định Tổng các khoản giảm trừ:
                  </p>
                  <div className="text-slate-600 text-xs space-y-0.5 ml-6 mt-1">
                    <p>&bull; Bảo hiểm bắt buộc: {formatCurrencyVND(selectedDetailItem.BaoHiem)}</p>
                    <p>&bull; Giảm trừ bản thân: {formatCurrencyVND(selectedDetailItem.calcResult.personalDeduction)}</p>
                    <p>&bull; Giảm trừ người phụ thuộc ({selectedDetailItem.dependentCount} người): {formatCurrencyVND(selectedDetailItem.calcResult.dependentDeduction)}</p>
                  </div>
                  <p className="font-bold text-slate-900 ml-6 mt-0.5">
                    &rarr; Tổng giảm trừ = {formatCurrencyVND(selectedDetailItem.calcResult.totalDeductions)}
                  </p>
                </div>

                {/* Bước 3 */}
                <div className="border-t border-slate-200 pt-2.5">
                  <p className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] flex items-center justify-center">3</span>
                    Xác định Thu nhập tính thuế (TNTT):
                  </p>
                  <p className="text-slate-600 text-xs mt-1 ml-6">
                    = max(0, TNCT - Tổng giảm trừ)
                  </p>
                  <p className="font-bold text-emerald-800 ml-6 mt-0.5 text-sm">
                    &rarr; TNTT = {formatCurrencyVND(selectedDetailItem.calcResult.assessableIncome)}
                  </p>
                </div>
              </div>

              {/* Bước 4 */}
              <div>
                <p className="font-bold text-slate-800 flex items-center gap-1.5 mb-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] flex items-center justify-center">4</span>
                  Tính thuế theo Biểu lũy tiến 5 bậc (Luật 109/2025/QH15):
                </p>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr>
                        <th className="py-2 px-3">Bậc</th>
                        <th className="py-2 px-3">Mức TNTT / tháng</th>
                        <th className="py-2 px-3 text-center">Thuế suất</th>
                        <th className="py-2 px-3 text-right">Phần TNTT</th>
                        <th className="py-2 px-3 text-right">Tiền thuế</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedDetailItem.calcResult.breakdown.map((b) => (
                        <tr
                          key={b.bracket}
                          className={b.taxAmount > 0 ? 'bg-emerald-50/50 font-medium' : 'text-slate-400'}
                        >
                          <td className="py-2 px-3 font-semibold">Bậc {b.bracket}</td>
                          <td className="py-2 px-3 text-[11px]">{b.bracketName.split(':')[1]?.trim() || ''}</td>
                          <td className="py-2 px-3 text-center">{Math.round(b.rate * 100)}%</td>
                          <td className="py-2 px-3 text-right font-mono">
                            {formatCurrencyVND(b.taxablePortion)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                            {formatCurrencyVND(b.taxAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-slate-200 bg-slate-50 text-xs">
                      <tr>
                        <td colSpan={4} className="py-2 px-3 font-semibold text-slate-700">
                          Tổng thuế trước khi làm tròn:
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                          {formatCurrencyVND(selectedDetailItem.calcResult.rawTax)}
                        </td>
                      </tr>
                      <tr className="bg-emerald-100/70 font-bold text-emerald-950 border-t border-emerald-300">
                        <td colSpan={4} className="py-2.5 px-3">
                          THUẾ PHẢI NỘP (LÀM TRÒN XUỐNG NGHÌN):
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-sm text-emerald-800">
                          {formatCurrencyVND(selectedDetailItem.calcResult.finalPitAmount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDetailItem(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs sm:text-sm font-medium rounded-xl transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
