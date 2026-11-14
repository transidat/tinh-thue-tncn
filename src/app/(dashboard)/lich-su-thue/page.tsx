'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TaxPeriod, PayrollItem } from '@/types/database';
import {
  History,
  Download,
  Search,
  Calendar,
  Eye,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  Receipt
} from 'lucide-react';
import { exportTaxPayrollToExcel } from '@/lib/excel-utils';
import { formatCurrencyVND } from '@/config/tax-rules';

export default function TaxHistoryPage() {
  const supabase = createClient();

  const [periods, setPeriods] = useState<TaxPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [payrollItems, setPayrollItems] = useState<PayrollItem[]>([]);
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal 4 bước giải trình
  const [selectedDetailItem, setSelectedDetailItem] = useState<PayrollItem | null>(null);

  // Modal xóa kỳ
  const [confirmDeletePeriod, setConfirmDeletePeriod] = useState<TaxPeriod | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const fetchPeriods = async () => {
    try {
      setLoadingPeriods(true);
      const { data, error } = await supabase
        .from('tax_periods')
        .select('*')
        .order('period', { ascending: false });

      if (error) throw error;
      setPeriods(data || []);

      if (data && data.length > 0) {
        setSelectedPeriodId(data[0].id);
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: 'Lỗi tải kỳ thuế: ' + err.message });
    } finally {
      setLoadingPeriods(false);
    }
  };

  useEffect(() => {
    fetchPeriods();
  }, []);

  useEffect(() => {
    if (!selectedPeriodId) {
      setPayrollItems([]);
      return;
    }

    async function fetchItems() {
      try {
        setLoadingItems(true);
        const { data, error } = await supabase
          .from('payroll_items')
          .select('*')
          .eq('period_id', selectedPeriodId)
          .order('employee_code', { ascending: true });

        if (error) throw error;
        setPayrollItems(data || []);
      } catch (err: any) {
        setNotification({ type: 'error', message: 'Lỗi tải chi tiết bảng thuế: ' + err.message });
      } finally {
        setLoadingItems(false);
      }
    }

    fetchItems();
  }, [selectedPeriodId]);

  const currentPeriod = useMemo(() => {
    return periods.find((p) => p.id === selectedPeriodId);
  }, [periods, selectedPeriodId]);

  // Tìm kiếm nhân viên trong bảng tháng theo Mã NV, Họ tên, MST
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return payrollItems;
    const q = searchQuery.toLowerCase().trim();
    return payrollItems.filter(
      (item) =>
        item.full_name.toLowerCase().includes(q) ||
        item.employee_code.toLowerCase().includes(q) ||
        (item.tax_code && item.tax_code.includes(q))
    );
  }, [payrollItems, searchQuery]);

  const stats = useMemo(() => {
    let totalIncome = 0;
    let totalTax = 0;
    let totalAssessable = 0;
    let taxPayerCount = 0;

    payrollItems.forEach((item) => {
      totalIncome += Number(item.total_income || 0);
      totalTax += Number(item.pit_amount || 0);
      totalAssessable += Number(item.assessable_income || 0);
      if (Number(item.pit_amount || 0) > 0) taxPayerCount++;
    });

    return {
      totalEmployees: payrollItems.length,
      taxPayerCount,
      totalIncome,
      totalTax,
      totalAssessable,
    };
  }, [payrollItems]);

  const handleExportExcel = () => {
    if (!currentPeriod || payrollItems.length === 0) return;
    exportTaxPayrollToExcel(currentPeriod.period, payrollItems);
  };

  const handleDeletePeriod = async () => {
    if (!confirmDeletePeriod) return;
    setDeleting(true);

    try {
      const { error } = await supabase
        .from('tax_periods')
        .delete()
        .eq('id', confirmDeletePeriod.id);

      if (error) throw error;

      setNotification({
        type: 'success',
        message: `Đã xóa kỳ thuế ${confirmDeletePeriod.period}`,
      });
      setConfirmDeletePeriod(null);
      fetchPeriods();
    } catch (err: any) {
      setNotification({ type: 'error', message: 'Không thể xóa kỳ thuế: ' + err.message });
    } finally {
      setDeleting(false);
    }
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
            <History className="w-7 h-7 text-emerald-600" />
            <span>Lịch Sử Đóng Thuế TNCN Theo Tháng</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Tra cứu kỳ tính thuế &bull; Tìm kiếm nhân viên &bull; Xuất file Excel báo cáo &bull; Giải trình chi tiết
          </p>
        </div>

        {payrollItems.length > 0 && currentPeriod && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-md shadow-emerald-200 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Xuất Excel kỳ {currentPeriod.period}</span>
            </button>

            <button
              onClick={() => setConfirmDeletePeriod(currentPeriod)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl text-xs sm:text-sm font-medium transition cursor-pointer"
              title="Xóa kỳ thuế này"
            >
              <Trash2 className="w-4 h-4" />
              <span>Xóa kỳ</span>
            </button>
          </div>
        )}
      </div>

      {/* Selector & Search Box */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">
            Chọn kỳ tính thuế:
          </span>
          {loadingPeriods ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          ) : periods.length === 0 ? (
            <span className="text-xs text-slate-400 italic">Chưa có kỳ thuế nào được lưu</span>
          ) : (
            <select
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition cursor-pointer"
            >
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  Tháng {p.period} {p.notes ? `(${p.notes})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {payrollItems.length > 0 && (
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo Mã NV, Họ tên, MST..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
            />
          </div>
        )}
      </div>

      {/* Cards thống kê */}
      {currentPeriod && payrollItems.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Tổng nhân viên</p>
            <p className="text-xl font-bold text-slate-800 mt-1">{stats.totalEmployees}</p>
            <p className="text-xs text-emerald-600 mt-0.5">{stats.taxPayerCount} người nộp thuế</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Tổng thu nhập tháng</p>
            <p className="text-base sm:text-lg font-bold text-slate-800 mt-1">{formatCurrencyVND(stats.totalIncome)}</p>
            <p className="text-xs text-slate-400 mt-0.5">Toàn bộ nhân sự</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Tổng TNTT</p>
            <p className="text-base sm:text-lg font-bold text-slate-800 mt-1">{formatCurrencyVND(stats.totalAssessable)}</p>
            <p className="text-xs text-slate-400 mt-0.5">Sau các khoản giảm trừ</p>
          </div>

          <div className="bg-emerald-600 p-4 rounded-2xl text-white shadow-md shadow-emerald-200">
            <p className="text-[11px] font-semibold text-emerald-100 uppercase">Tổng Thuế TNCN</p>
            <p className="text-lg sm:text-xl font-bold text-white mt-1">{formatCurrencyVND(stats.totalTax)}</p>
            <p className="text-xs text-emerald-100/80 mt-0.5">Kỳ {currentPeriod.period}</p>
          </div>
        </div>
      )}

      {/* Table chi tiết */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loadingPeriods || loadingItems ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="text-sm">Đang tải dữ liệu kỳ thuế...</p>
          </div>
        ) : periods.length === 0 ? (
          <div className="p-12 text-center">
            <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-700">Chưa có lịch sử tính thuế nào</h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              Hãy vào mục <strong>"Tính thuế tháng"</strong>, import thu nhập và bấm lưu để lưu trữ kết quả.
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-700">Không tìm thấy bản ghi</h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {searchQuery ? 'Không có nhân viên phù hợp với từ khóa tìm kiếm.' : 'Kỳ này chưa có dữ liệu chi tiết.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-3">Mã NV</th>
                  <th className="py-3 px-3">Họ và tên</th>
                  <th className="py-3 px-3 text-right">Tổng thu nhập</th>
                  <th className="py-3 px-3 text-right">K.chịu thuế</th>
                  <th className="py-3 px-3 text-right">Bảo hiểm</th>
                  <th className="py-3 px-3 text-center">Số NPT</th>
                  <th className="py-3 px-3 text-right">Giảm trừ NPT</th>
                  <th className="py-3 px-3 text-right">TN Tính thuế</th>
                  <th className="py-3 px-3 text-right font-bold text-emerald-800">Thuế Phải Nộp</th>
                  <th className="py-3 px-3 text-center">Giải trình</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3 font-mono font-bold text-slate-800">
                      {item.employee_code}
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-semibold text-slate-900">{item.full_name}</p>
                      {item.tax_code && (
                        <p className="font-mono text-[11px] text-slate-400">MST: {item.tax_code}</p>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-700 font-medium">
                      {formatCurrencyVND(item.total_income)}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600">
                      {formatCurrencyVND(item.non_taxable_income)}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600">
                      {formatCurrencyVND(item.insurance)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                          item.dependent_count > 0 ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {item.dependent_count}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600">
                      {formatCurrencyVND(item.dependent_deduction)}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-slate-800">
                      {formatCurrencyVND(item.assessable_income)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-700">
                      {formatCurrencyVND(item.pit_amount)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedDetailItem(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 rounded-lg border border-emerald-200 transition cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Xem 4 bước</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Giải trình 4 bước */}
      {selectedDetailItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-scaleIn">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Giải Trình 4 Bước Tính Thuế TNCN (Luật 109/2025/QH15)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Nhân viên: <strong className="text-slate-800">{selectedDetailItem.full_name}</strong> ({selectedDetailItem.employee_code}) &bull; Kỳ {currentPeriod?.period}
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
                <div>
                  <p className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] flex items-center justify-center">1</span>
                    Xác định Thu nhập chịu thuế (TNCT):
                  </p>
                  <p className="text-slate-600 text-xs mt-1 ml-6">
                    = Tổng thu nhập ({formatCurrencyVND(selectedDetailItem.total_income)}) - Thu nhập không chịu thuế ({formatCurrencyVND(selectedDetailItem.non_taxable_income)})
                  </p>
                  <p className="font-bold text-slate-900 ml-6 mt-0.5">
                    &rarr; TNCT = {formatCurrencyVND(selectedDetailItem.taxable_income)}
                  </p>
                </div>

                <div className="border-t border-slate-200 pt-2.5">
                  <p className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] flex items-center justify-center">2</span>
                    Xác định Tổng các khoản giảm trừ:
                  </p>
                  <div className="text-slate-600 text-xs space-y-0.5 ml-6 mt-1">
                    <p>&bull; Bảo hiểm bắt buộc: {formatCurrencyVND(selectedDetailItem.insurance)}</p>
                    <p>&bull; Giảm trừ bản thân: {formatCurrencyVND(selectedDetailItem.personal_deduction)}</p>
                    <p>&bull; Giảm trừ người phụ thuộc ({selectedDetailItem.dependent_count} người): {formatCurrencyVND(selectedDetailItem.dependent_deduction)}</p>
                  </div>
                  <p className="font-bold text-slate-900 ml-6 mt-0.5">
                    &rarr; Tổng giảm trừ = {formatCurrencyVND(Number(selectedDetailItem.insurance) + Number(selectedDetailItem.personal_deduction) + Number(selectedDetailItem.dependent_deduction))}
                  </p>
                </div>

                <div className="border-t border-slate-200 pt-2.5">
                  <p className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] flex items-center justify-center">3</span>
                    Xác định Thu nhập tính thuế (TNTT):
                  </p>
                  <p className="font-bold text-emerald-800 ml-6 mt-0.5 text-sm">
                    &rarr; TNTT = {formatCurrencyVND(selectedDetailItem.assessable_income)}
                  </p>
                </div>
              </div>

              {/* Chi tiết từng bậc */}
              <div>
                <p className="font-bold text-slate-800 flex items-center gap-1.5 mb-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] flex items-center justify-center">4</span>
                  Chi tiết Biểu thuế 5 bậc (Luật 109/2025/QH15):
                </p>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr>
                        <th className="py-2 px-3">Bậc</th>
                        <th className="py-2 px-3 text-center">Thuế suất</th>
                        <th className="py-2 px-3 text-right">Phần TNTT</th>
                        <th className="py-2 px-3 text-right">Tiền thuế</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedDetailItem.calculation_breakdown || []).map((b) => (
                        <tr
                          key={b.bracket}
                          className={b.taxAmount > 0 ? 'bg-emerald-50/50 font-medium' : 'text-slate-400'}
                        >
                          <td className="py-2 px-3 font-semibold">Bậc {b.bracket}</td>
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
                    <tfoot className="bg-emerald-100/70 font-bold text-emerald-950 border-t border-emerald-300">
                      <tr>
                        <td colSpan={3} className="py-2.5 px-3">
                          THUẾ PHẢI NỘP (LÀM TRÒN XUỐNG NGHÌN):
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-sm text-emerald-800">
                          {formatCurrencyVND(selectedDetailItem.pit_amount)}
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

      {/* Modal Xác nhận Xóa kỳ thuế */}
      {confirmDeletePeriod && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">
              Xóa lịch sử kỳ tính thuế?
            </h3>
            <p className="text-sm text-slate-600 mt-2">
              Bạn có chắc chắn muốn xóa toàn bộ dữ liệu tính thuế của kỳ{' '}
              <strong className="text-slate-900">{confirmDeletePeriod.period}</strong>?
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeletePeriod(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDeletePeriod}
                disabled={deleting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm rounded-xl shadow transition flex items-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Xác nhận xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
