'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Employee, Dependent, PayrollItem, TaxBreakdownBracket } from '@/types/database';
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
  Info,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';
import {
  downloadIncomeTemplate,
  parseIncomeExcel,
  IncomeImportRow,
  exportTaxPayrollToExcel
} from '@/lib/excel-utils';
import {
  calculatePIT,
  isDependentValidForPeriod,
  formatCurrency,
  PERSONAL_DEDUCTION,
  DEPENDENT_DEDUCTION
} from '@/lib/tax-calculator';

interface CalculatedRow extends IncomeImportRow {
  employeeId?: string;
  dependentCount: number;
  personalDeduction: number;
  dependentDeduction: number;
  taxableIncome: number;
  assessableIncome: number;
  pitAmount: number;
  breakdown: TaxBreakdownBracket[];
}

export default function TaxCalculationPage() {
  const supabase = createClient();

  // Chọn kỳ tính thuế mặc định là tháng hiện tại YYYY-MM
  const [period, setPeriod] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsingFile, setParsingFile] = useState(false);
  const [rawRows, setRawRows] = useState<IncomeImportRow[]>([]);

  // Database caches
  const [employeesMap, setEmployeesMap] = useState<Map<string, Employee>>(new Map());
  const [dependentsByEmpCode, setDependentsByEmpCode] = useState<Map<string, Dependent[]>>(new Map());
  const [dbLoading, setDbLoading] = useState(true);

  // Kết quả tính toán
  const [calculatedItems, setCalculatedItems] = useState<CalculatedRow[]>([]);
  const [savingPeriod, setSavingPeriod] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Modal chi tiết bậc tính của 1 nhân viên
  const [selectedDetailItem, setSelectedDetailItem] = useState<CalculatedRow | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Tải thông tin nhân viên và người phụ thuộc để đối soát
  const loadEmployeesAndDependents = async () => {
    try {
      setDbLoading(true);

      const [empRes, depRes] = await Promise.all([
        supabase.from('employees').select('*'),
        supabase.from('dependents').select('*, employees:employee_id(employee_code)'),
      ]);

      if (empRes.error) throw empRes.error;
      if (depRes.error) throw depRes.error;

      const empMap = new Map<string, Employee>();
      (empRes.data || []).forEach((e) => {
        empMap.set(e.employee_code.toLowerCase().trim(), e);
      });
      setEmployeesMap(empMap);

      const depMap = new Map<string, Dependent[]>();
      (depRes.data || []).forEach((d: any) => {
        const empCode = d.employees?.employee_code?.toLowerCase().trim();
        if (empCode) {
          if (!depMap.has(empCode)) depMap.set(empCode, []);
          depMap.get(empCode)!.push(d);
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

  // Xử lý chọn file Excel
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setSaveSuccess(false);
    setParsingFile(true);

    try {
      const rows = await parseIncomeExcel(file);
      if (rows.length === 0) {
        setNotification({
          type: 'error',
          message: 'Không tìm thấy dòng dữ liệu hợp lệ trong file Excel. Vui lòng kiểm tra lại cấu trúc cột.',
        });
        setRawRows([]);
        setCalculatedItems([]);
      } else {
        setRawRows(rows);
        setNotification({
          type: 'success',
          message: `Đã đọc thành công ${rows.length} dòng thu nhập từ file Excel. Bấm "Thực hiện tính thuế" để tính toán.`,
        });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: 'Lỗi khi đọc file Excel: ' + err.message });
      setRawRows([]);
    } finally {
      setParsingFile(false);
    }
  };

  // Động cơ tính thuế theo kỳ được chọn
  const handleCalculateTax = () => {
    if (rawRows.length === 0) {
      setNotification({ type: 'error', message: 'Chưa có dữ liệu thu nhập để tính toán.' });
      return;
    }

    const results: CalculatedRow[] = rawRows.map((row) => {
      const empCodeKey = row.MaNV.toLowerCase().trim();
      const emp = employeesMap.get(empCodeKey);

      // Lấy danh sách NPT của nhân viên này
      const allDeps = dependentsByEmpCode.get(empCodeKey) || [];

      // Lọc các NPT hợp lệ trong kỳ tháng này
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

      // Tính thuế theo công thức chuẩn Việt Nam
      const calc = calculatePIT(
        row.TongThuNhap,
        row.KhgChiuThue,
        row.BaoHiem,
        dependentCount
      );

      return {
        ...row,
        employeeId: emp?.id,
        dependentCount,
        personalDeduction: calc.personalDeduction,
        dependentDeduction: calc.dependentDeduction,
        taxableIncome: calc.taxableIncome,
        assessableIncome: calc.assessableIncome,
        pitAmount: calc.pitAmount,
        breakdown: calc.calculationBreakdown,
      };
    });

    setCalculatedItems(results);
    setSaveSuccess(false);
    setNotification({
      type: 'success',
      message: `Đã tính toán thuế TNCN thành công cho ${results.length} người lao động trong kỳ ${period}!`,
    });
  };

  // Tự động tính lại khi người dùng đổi kỳ nếu đã có dữ liệu
  useEffect(() => {
    if (rawRows.length > 0) {
      handleCalculateTax();
    }
  }, [period]);

  // Tổng hợp thống kê kỳ tính thuế
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
      totalNonTaxable += item.KhgChiuThue;
      totalInsurance += item.BaoHiem;
      totalTaxable += item.taxableIncome;
      totalAssessable += item.assessableIncome;
      totalTax += item.pitAmount;
      if (item.pitAmount > 0) employeesWithTax++;
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

  // Lưu kỳ tính thuế và các dòng vào database
  const handleSaveToDatabase = async () => {
    if (calculatedItems.length === 0) return;
    setSavingPeriod(true);

    try {
      // 1. Tạo hoặc lấy bản ghi tax_periods theo kỳ (period)
      const { data: existingPeriod } = await supabase
        .from('tax_periods')
        .select('id')
        .eq('period', period)
        .maybeSingle();

      let periodId = existingPeriod?.id;

      if (!periodId) {
        const { data: newPeriod, error: periodErr } = await supabase
          .from('tax_periods')
          .insert({
            period,
            notes: `Tính ngày ${new Date().toLocaleDateString('vi-VN')}`,
          })
          .select('id')
          .single();

        if (periodErr) throw periodErr;
        periodId = newPeriod.id;
      }

      // 2. Xóa các payroll_items cũ của kỳ này trước khi chèn mới để đồng bộ hoàn toàn
      await supabase.from('payroll_items').delete().eq('period_id', periodId);

      // 3. Chuẩn bị dữ liệu chèn payroll_items
      const insertRows = calculatedItems.map((item) => ({
        period_id: periodId,
        employee_id: item.employeeId || null,
        employee_code: item.MaNV.trim(),
        full_name: item.HoTen.trim(),
        tax_code: item.MaSoThue?.trim() || null,
        total_income: item.TongThuNhap,
        non_taxable_income: item.KhgChiuThue,
        insurance: item.BaoHiem,
        dependent_count: item.dependentCount,
        personal_deduction: item.personalDeduction,
        dependent_deduction: item.dependentDeduction,
        taxable_income: item.taxableIncome,
        assessable_income: item.assessableIncome,
        pit_amount: item.pitAmount,
        calculation_breakdown: item.breakdown,
      }));

      const { error: insertErr } = await supabase
        .from('payroll_items')
        .insert(insertRows);

      if (insertErr) throw insertErr;

      setSaveSuccess(true);
      setNotification({
        type: 'success',
        message: `Đã lưu thành công bảng tính thuế kỳ ${period} vào hệ thống!`,
      });
    } catch (err: any) {
      setNotification({ type: 'error', message: 'Lỗi khi lưu bảng thuế: ' + err.message });
    } finally {
      setSavingPeriod(false);
    }
  };

  // Xuất file Excel bảng thuế
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
      non_taxable_income: item.KhgChiuThue,
      insurance: item.BaoHiem,
      dependent_count: item.dependentCount,
      personal_deduction: item.personalDeduction,
      dependent_deduction: item.dependentDeduction,
      taxable_income: item.taxableIncome,
      assessable_income: item.assessableIncome,
      pit_amount: item.pitAmount,
      calculation_breakdown: item.breakdown,
      created_at: '',
      updated_at: '',
    }));

    exportTaxPayrollToExcel(period, exportRows);
  };

  return (
    <div className="space-y-6">
      {/* Notification banner */}
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
          <button onClick={() => setNotification(null)} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2.5">
            <Receipt className="w-7 h-7 text-emerald-600" />
            <span>Tính Thuế Thu Nhập Cá Nhân Theo Tháng</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Import bảng thu nhập &bull; Tự động xét duyệt người phụ thuộc &bull; Tính lũy tiến 7 bậc
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
          {/* Chọn kỳ tính thuế */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>Kỳ tính thuế (Tháng/Năm)</span>
            </label>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Người phụ thuộc sẽ được xét hiệu lực dựa trên tháng này
            </p>
          </div>

          {/* Upload file thu nhập */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Import file Excel thu nhập tháng</span>
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

              {rawRows.length > 0 && (
                <button
                  type="button"
                  onClick={handleCalculateTax}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-md shadow-emerald-200 flex items-center gap-1.5 cursor-pointer flex-shrink-0"
                >
                  <Calculator className="w-4 h-4" />
                  <span>Tính lại thuế</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Gợi ý cột */}
        <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-semibold text-slate-700">Các cột file Excel:</span>
          <span>&bull; MaNV (Mã nhân viên)</span>
          <span>&bull; HoTen (Họ tên)</span>
          <span>&bull; MaSoThue (MST)</span>
          <span>&bull; TongThuNhap (Tổng TN trong tháng)</span>
          <span>&bull; KhgChiuThue (Thu nhập không chịu thuế)</span>
          <span>&bull; BaoHiem (BHXH, BHYT, BHTN...)</span>
        </div>
      </div>

      {/* Thống kê kết quả sau khi tính */}
      {calculatedItems.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Nhân viên tính thuế</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-800 mt-1">
                {summary.totalEmployees}
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">
                {summary.employeesWithTax} người phải nộp thuế
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Tổng thu nhập</p>
              <p className="text-lg sm:text-xl font-bold text-slate-800 mt-1">
                {formatCurrency(summary.totalIncome)}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                KCT: {formatCurrency(summary.totalNonTaxable)}
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Tổng TNTT (toàn cty)</p>
              <p className="text-lg sm:text-xl font-bold text-slate-800 mt-1">
                {formatCurrency(summary.totalAssessable)}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Sau khi trừ bảo hiểm & gia cảnh
              </p>
            </div>

            <div className="bg-emerald-600 p-4 rounded-2xl text-white shadow-md shadow-emerald-200">
              <p className="text-[11px] font-semibold text-emerald-100 uppercase">Tổng Thuế TNCN Phải Nộp</p>
              <p className="text-xl sm:text-2xl font-bold text-white mt-1">
                {formatCurrency(summary.totalTax)}
              </p>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                Kỳ thuế: {period}
              </p>
            </div>
          </div>

          {/* Action buttons lưu & xuất Excel */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="text-xs text-slate-600">
              {saveSuccess ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Đã lưu vào cơ sở dữ liệu hệ thống
                </span>
              ) : (
                <span>Bấm <strong>"Lưu vào hệ thống"</strong> để ghi nhận kỳ thuế này vào lịch sử</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium text-xs sm:text-sm rounded-xl border border-slate-300 transition cursor-pointer"
              >
                <Download className="w-4 h-4 text-slate-500" />
                <span>Xuất Excel bảng thuế</span>
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

          {/* Bảng chi tiết kết quả tính thuế */}
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
                    <th className="py-3 px-3 text-right font-bold text-emerald-800">Thuế TNCN</th>
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
                        {formatCurrency(item.TongThuNhap)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600">
                        {formatCurrency(item.KhgChiuThue)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600">
                        {formatCurrency(item.BaoHiem)}
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
                        {formatCurrency(item.dependentDeduction)}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-800">
                        {formatCurrency(item.assessableIncome)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-sm text-emerald-700">
                        {formatCurrency(item.pitAmount)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedDetailItem(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 rounded-lg border border-emerald-200 transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Chi tiết</span>
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

      {/* ========================================================== */}
      {/* MODAL GIẢI TRÌNH BẬC TÍNH THUẾ CHO 1 NHÂN VIÊN */}
      {/* ========================================================== */}
      {selectedDetailItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-scaleIn">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Giải Trình Bậc Tính Thuế TNCN
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Nhân viên: <strong className="text-slate-800">{selectedDetailItem.HoTen}</strong> ({selectedDetailItem.MaNV}) &bull; Kỳ {period}
                </p>
              </div>
              <button
                onClick={() => setSelectedDetailItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm">
              {/* Tóm tắt các chỉ số */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">1. Tổng thu nhập trong tháng:</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(selectedDetailItem.TongThuNhap)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">2. Thu nhập không chịu thuế:</span>
                  <span className="font-semibold text-slate-800">- {formatCurrency(selectedDetailItem.KhgChiuThue)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5">
                  <span className="text-slate-700 font-medium">&rArr; Thu nhập chịu thuế (TNCT):</span>
                  <span className="font-bold text-slate-900">{formatCurrency(selectedDetailItem.taxableIncome)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">3. Giảm trừ bản thân:</span>
                  <span className="font-semibold text-slate-800">- 11.000.000 ₫</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">
                    4. Giảm trừ người phụ thuộc ({selectedDetailItem.dependentCount} người &times; 4,4 tr):
                  </span>
                  <span className="font-semibold text-slate-800">- {formatCurrency(selectedDetailItem.dependentDeduction)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">5. Các khoản bảo hiểm bắt buộc:</span>
                  <span className="font-semibold text-slate-800">- {formatCurrency(selectedDetailItem.BaoHiem)}</span>
                </div>
                <div className="flex justify-between border-t-2 border-emerald-600 pt-2 text-emerald-900 font-bold">
                  <span>&rArr; Thu nhập tính thuế (TNTT):</span>
                  <span className="text-base">{formatCurrency(selectedDetailItem.assessableIncome)}</span>
                </div>
              </div>

              {/* Chi tiết từng bậc */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Phân rã theo biểu thuế lũy tiến từng phần (7 bậc)
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr>
                        <th className="py-2 px-3">Bậc</th>
                        <th className="py-2 px-3">Thuế suất</th>
                        <th className="py-2 px-3 text-right">Phần thu nhập chịu thuế</th>
                        <th className="py-2 px-3 text-right">Tiền thuế</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedDetailItem.breakdown.map((b) => (
                        <tr
                          key={b.bracket}
                          className={b.taxAmount > 0 ? 'bg-emerald-50/50 font-medium' : 'text-slate-400'}
                        >
                          <td className="py-2 px-3 font-semibold">Bậc {b.bracket}</td>
                          <td className="py-2 px-3">{Math.round(b.rate * 100)}%</td>
                          <td className="py-2 px-3 text-right font-mono">
                            {formatCurrency(b.taxablePortion)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                            {formatCurrency(b.taxAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-emerald-100/60 font-bold text-emerald-950 border-t border-emerald-200">
                      <tr>
                        <td colSpan={3} className="py-2.5 px-3">
                          TỔNG THUẾ TNCN PHẢI NỘP TRONG THÁNG:
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-sm text-emerald-800">
                          {formatCurrency(selectedDetailItem.pitAmount)}
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
                Đóng giải trình
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

