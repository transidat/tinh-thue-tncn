'use client';

import { useState } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  AlertCircle,
  CheckCircle2,
  Save,
  RotateCcw,
  Info,
  Calendar,
  Users,
  ShieldCheck,
  Hash,
} from 'lucide-react';
import { formatCurrencyVND } from '@/config/tax-rules';
import { downloadIncomeTemplate } from '@/lib/excel-utils';
import {
  previewMonthlyPayrollAction,
  saveMonthlyPayrollAction,
  CalculationRowResult,
  ActionErrorItem,
} from './actions';

export default function TinhThuePage() {
  const currentMonthStr = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  const [period, setPeriod] = useState<string>(currentMonthStr);
  const [notes, setNotes] = useState<string>('');

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Dữ liệu tính toán trả về từ Server Action
  const [calculatedItems, setCalculatedItems] = useState<CalculationRowResult[]>([]);
  const [actionErrors, setActionErrors] = useState<ActionErrorItem[]>([]);
  const [auditInfo, setAuditInfo] = useState<{ fileName?: string; fileSha256?: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Xử lý khi người dùng chọn file Excel
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setSaveSuccess(false);
    setAuditInfo(null);
    setIsProcessing(true);
    setNotification(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('period', period);
      formData.append('notes', notes);

      // Gọi Server Action để parse và tính thuế phía server
      const result = await previewMonthlyPayrollAction(formData);

      if (!result.ok) {
        setNotification({ type: 'error', message: result.error || 'Lỗi khi xử lý file trên server' });
        setCalculatedItems([]);
        setActionErrors(result.errors || []);
        return;
      }

      setCalculatedItems(result.items || []);
      setActionErrors(result.errors || []);
      setAuditInfo({
        fileName: result.sourceFileName,
        fileSha256: result.sourceFileSha256,
      });

      if ((result.items || []).length === 0) {
        setNotification({
          type: 'error',
          message: 'Không có dòng dữ liệu nào hợp lệ để tính thuế. Vui lòng kiểm tra danh sách lỗi bên dưới.',
        });
      } else {
        setNotification({
          type: 'success',
          message: `Server đã tính thuế thành công cho ${result.items?.length} nhân viên hợp lệ (File: ${result.sourceFileName})!`,
        });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: 'Lỗi khi gửi file lên server: ' + err.message });
      setCalculatedItems([]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Tính lại khi người dùng đổi kỳ tính thuế
  const handlePeriodChange = async (newPeriod: string) => {
    setPeriod(newPeriod);
    if (!selectedFile) return;

    setSaveSuccess(false);
    setIsProcessing(true);
    setNotification(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('period', newPeriod);
      formData.append('notes', notes);

      const result = await previewMonthlyPayrollAction(formData);
      if (result.ok) {
        setCalculatedItems(result.items || []);
        setActionErrors(result.errors || []);
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: 'Lỗi cập nhật kỳ tính thuế: ' + err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  // Lưu bảng thuế vào CSDL thông qua Server Action
  const handleSaveToDatabase = async () => {
    if (!selectedFile || calculatedItems.length === 0) return;
    setIsSaving(true);
    setNotification(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('period', period);
      formData.append('notes', notes);

      const result = await saveMonthlyPayrollAction(formData);

      if (!result.ok) {
        setNotification({ type: 'error', message: result.error || 'Lỗi khi lưu bảng thuế' });
        return;
      }

      setSaveSuccess(true);
      setAuditInfo({
        fileName: result.sourceFileName,
        fileSha256: result.sourceFileSha256,
      });
      setNotification({
        type: 'success',
        message: `Đã lưu và ghi đè an toàn bảng tính thuế kỳ ${period} vào hệ thống (${result.savedCount} bản ghi)!`,
      });
    } catch (err: any) {
      setNotification({ type: 'error', message: 'Lỗi khi lưu bảng thuế: ' + err.message });
    } finally {
      setIsSaving(false);
    }
  };

  // Tổng hợp số liệu hiển thị
  const summary = {
    totalEmployees: calculatedItems.length,
    employeesWithTax: calculatedItems.filter((i) => i.pitAmount > 0).length,
    totalIncome: calculatedItems.reduce((sum, i) => sum + i.tongThuNhap, 0),
    totalNonTaxable: calculatedItems.reduce((sum, i) => sum + i.khongChiuThue, 0),
    totalInsurance: calculatedItems.reduce((sum, i) => sum + i.baoHiem, 0),
    totalTaxable: calculatedItems.reduce((sum, i) => sum + i.taxableIncome, 0),
    totalAssessable: calculatedItems.reduce((sum, i) => sum + i.assessableIncome, 0),
    totalTax: calculatedItems.reduce((sum, i) => sum + i.pitAmount, 0),
  };

  return (
    <div className="space-y-6">
      {notification && (
        <div
          className={`p-4 rounded-xl flex items-start gap-3 transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : notification.type === 'error'
              ? 'bg-rose-50 text-rose-800 border border-rose-200'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}
        >
          {notification.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />}
          {notification.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 flex-shrink-0" />}
          {notification.type === 'info' && <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />}
          <div className="flex-1 font-medium">{notification.message}</div>
        </div>
      )}

      {/* Audit trail box khi có file */}
      {auditInfo?.fileSha256 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              <strong>File kiểm toán:</strong> {auditInfo.fileName}
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
            <Hash className="w-3.5 h-3.5 text-slate-400" />
            <span>SHA-256: {auditInfo.fileSha256}</span>
          </div>
        </div>
      )}

      {/* Vùng chọn kỳ và tải file */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-600" />
            1. Chọn Kỳ Tính Thuế
          </h2>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Kỳ tính thuế (Tháng/Năm)
            </label>
            <input
              type="month"
              value={period}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Ghi chú bảng thuế
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ví dụ: Bảng lương tháng 01/2026 chính thức"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            />
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={downloadIncomeTemplate}
              className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              <Download className="w-4 h-4" />
              Tải mẫu Excel thu nhập
            </button>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Upload className="w-5 h-5 text-emerald-600" />
            2. Tải File Excel Thu Nhập (Xử lý an toàn phía Server)
          </h2>

          <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 text-center transition-all bg-slate-50/50 hover:bg-emerald-50/20">
            <input
              type="file"
              id="excel-income-upload"
              accept=".xlsx, .xls"
              className="hidden"
              onChange={handleFileChange}
              disabled={isProcessing}
            />
            <label htmlFor="excel-income-upload" className="cursor-pointer block space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">
                  {selectedFile ? selectedFile.name : 'Nhấp để chọn file Excel bảng thu nhập'}
                </p>
                <p className="text-xs text-slate-500 mt-1">Hỗ trợ định dạng .xlsx, .xls</p>
              </div>
              <span className="inline-block px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all">
                {isProcessing ? 'Server đang phân tích & tính toán...' : 'Chọn file từ máy tính'}
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Danh sách lỗi dòng nếu có */}
      {actionErrors.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-rose-800 font-bold">
            <AlertCircle className="w-5 h-5 text-rose-600" />
            Có {actionErrors.length} dòng dữ liệu lỗi không được tính thuế:
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1.5 text-xs">
            {actionErrors.map((err, i) => (
              <div key={i} className="flex items-center gap-2 bg-white/80 p-2 rounded-lg border border-rose-100 text-rose-900">
                <span className="font-semibold px-1.5 py-0.5 bg-rose-200 rounded text-[11px]">Dòng {err.row}</span>
                {err.maNV && <span className="font-mono font-bold text-slate-700">[{err.maNV}]</span>}
                <span>{err.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tóm tắt số liệu */}
      {calculatedItems.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Tổng Hợp Kết Quả Tính Thuế Kỳ {period}</h3>
              <p className="text-xs text-slate-500 mt-0.5">Biểu thuế 5 bậc lũy tiến - Luật Thuế TNCN số 109/2025/QH15</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveToDatabase}
                disabled={isSaving || saveSuccess}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-all ${
                  saveSuccess
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
                }`}
              >
                {isSaving ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" />
                    Đang lưu vào CSDL...
                  </>
                ) : saveSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Đã lưu CSDL
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Lưu Bảng Thuế Kỳ {period}
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 font-medium">Tổng số lao động</span>
              <p className="text-xl font-black text-slate-900 mt-1">{summary.totalEmployees}</p>
              <span className="text-[11px] text-emerald-700 mt-1 block">
                {summary.employeesWithTax} người phải nộp thuế
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 font-medium">Tổng thu nhập</span>
              <p className="text-xl font-black text-slate-900 mt-1">{formatCurrencyVND(summary.totalIncome)}</p>
              <span className="text-[11px] text-slate-500 mt-1 block">
                BH: {formatCurrencyVND(summary.totalInsurance)}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 font-medium">Thu nhập tính thuế (TNTT)</span>
              <p className="text-xl font-black text-blue-700 mt-1">{formatCurrencyVND(summary.totalAssessable)}</p>
              <span className="text-[11px] text-slate-500 mt-1 block">
                TNCT: {formatCurrencyVND(summary.totalTaxable)}
              </span>
            </div>

            <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-100">
              <span className="text-xs text-emerald-800 font-semibold">TỔNG THUẾ TNCN PHẢI NỘP</span>
              <p className="text-2xl font-black text-emerald-700 mt-1">{formatCurrencyVND(summary.totalTax)}</p>
              <span className="text-[11px] text-emerald-800 mt-1 block">Đã làm tròn xuống nghìn</span>
            </div>
          </div>
        </div>
      )}

      {/* Bảng chi tiết từng nhân viên */}
      {calculatedItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              Chi Tiết Tính Thuế Từng Nhân Viên
            </h3>
            <span className="text-xs text-slate-500">Hiển thị {calculatedItems.length} nhân viên</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="py-3 px-3">STT</th>
                  <th className="py-3 px-3">Mã NV</th>
                  <th className="py-3 px-3">Họ và tên</th>
                  <th className="py-3 px-3 text-right">Tổng thu nhập</th>
                  <th className="py-3 px-3 text-right">Không chịu thuế</th>
                  <th className="py-3 px-3 text-right">Bảo hiểm</th>
                  <th className="py-3 px-3 text-center">NPT</th>
                  <th className="py-3 px-3 text-right">Tổng giảm trừ</th>
                  <th className="py-3 px-3 text-right">TNTT</th>
                  <th className="py-3 px-3 text-right text-emerald-800 font-bold">Thuế PIT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {calculatedItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-3 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-800">{item.maNV}</td>
                    <td className="py-3 px-3 font-medium text-slate-900">{item.hoTen}</td>
                    <td className="py-3 px-3 text-right font-mono">{formatCurrencyVND(item.tongThuNhap)}</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-500">{formatCurrencyVND(item.khongChiuThue)}</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-500">{formatCurrencyVND(item.baoHiem)}</td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                        {item.dependentCount}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-600">
                      {formatCurrencyVND(item.totalDeductions)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-blue-700">
                      {formatCurrencyVND(item.assessableIncome)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-emerald-700 text-sm">
                      {formatCurrencyVND(item.pitAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
