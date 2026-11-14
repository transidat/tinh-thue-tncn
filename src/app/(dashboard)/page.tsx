'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  Users,
  HeartHandshake,
  Receipt,
  History,
  UserCheck,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';
import {
  PERSONAL_DEDUCTION,
  DEPENDENT_DEDUCTION,
  TAX_BRACKETS_5,
  formatCurrencyVND
} from '@/config/tax-rules';

export default function DashboardPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    resignedEmployees: 0,
    totalDependents: 0,
    latestPeriod: '',
    latestTotalTax: 0,
    latestEmployeeCount: 0,
  });

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);

        const { data: employees } = await supabase
          .from('employees')
          .select('id, is_resigned, is_deleted');

        const activeList = (employees || []).filter((e) => !e.is_deleted);
        const totalEmployees = activeList.length;
        const activeEmployees = activeList.filter((e) => !e.is_resigned).length;
        const resignedEmployees = totalEmployees - activeEmployees;

        const { count: depCount } = await supabase
          .from('dependents')
          .select('*', { count: 'exact', head: true })
          .eq('is_inactive', false);

        const { data: latestPeriods } = await supabase
          .from('tax_periods')
          .select('id, period')
          .order('period', { ascending: false })
          .limit(1);

        let latestPeriod = '';
        let latestTotalTax = 0;
        let latestEmployeeCount = 0;

        if (latestPeriods && latestPeriods.length > 0) {
          latestPeriod = latestPeriods[0].period;
          const { data: items } = await supabase
            .from('payroll_items')
            .select('pit_amount')
            .eq('period_id', latestPeriods[0].id);

          if (items) {
            latestEmployeeCount = items.length;
            latestTotalTax = items.reduce((sum, item) => sum + Number(item.pit_amount || 0), 0);
          }
        }

        setStats({
          totalEmployees,
          activeEmployees,
          resignedEmployees,
          totalDependents: depCount || 0,
          latestPeriod,
          latestTotalTax,
          latestEmployeeCount,
        });
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [supabase]);

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 rounded-2xl p-6 sm:p-8 text-white shadow-md">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-800/60 text-emerald-100 text-xs font-medium mb-3 backdrop-blur-sm">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
            Cập nhật theo Luật Thuế TNCN 2025 (Luật số 109/2025/QH15)
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Hệ Thống Quản Lý & Tính Thuế TNCN
          </h1>
          <p className="text-emerald-100/90 text-sm sm:text-base mt-2 leading-relaxed">
            Áp dụng Biểu thuế lũy tiến từng phần 5 bậc từ kỳ tính thuế 2026. Quản lý hồ sơ nhân viên, người phụ thuộc,
            import bảng thu nhập Excel và tính thuế TNCN tự động chính xác cho Kế toán.
          </p>

          <div className="flex flex-wrap gap-3 mt-5">
            <Link
              href="/tinh-thue"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-emerald-800 font-semibold text-sm rounded-xl shadow hover:bg-emerald-50 transition"
            >
              <Receipt className="w-4 h-4 text-emerald-600" />
              <span>Tính thuế tháng ngay</span>
            </Link>
            <Link
              href="/nhan-vien"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-800/60 hover:bg-emerald-800/80 text-white font-medium text-sm rounded-xl transition backdrop-blur-sm border border-emerald-500/40"
            >
              <Users className="w-4 h-4" />
              <span>Quản lý nhân viên</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Nhân viên đang làm
            </p>
            <p className="text-2xl font-bold text-slate-800 mt-1">
              {loading ? '...' : stats.activeEmployees}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Tổng số: {stats.totalEmployees} ({stats.resignedEmployees} đã nghỉ)
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Người phụ thuộc
            </p>
            <p className="text-2xl font-bold text-slate-800 mt-1">
              {loading ? '...' : stats.totalDependents}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Giảm trừ {formatCurrencyVND(DEPENDENT_DEDUCTION)}/người
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <HeartHandshake className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Giảm trừ bản thân
            </p>
            <p className="text-xl font-bold text-slate-800 mt-1">
              {formatCurrencyVND(PERSONAL_DEDUCTION)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Tương đương 186 triệu ₫/năm
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Thuế kỳ gần nhất {stats.latestPeriod ? `(${stats.latestPeriod})` : ''}
            </p>
            <p className="text-xl font-bold text-emerald-700 mt-1">
              {loading ? '...' : formatCurrencyVND(stats.latestTotalTax)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {stats.latestEmployeeCount > 0
                ? `${stats.latestEmployeeCount} nhân viên tính thuế`
                : 'Chưa có kỳ thuế'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Receipt className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Grid: Quick Actions & Biểu 5 bậc mới */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
            <h2 className="text-base font-bold text-slate-800 mb-3">
              Thao tác nhanh
            </h2>
            <div className="space-y-2">
              <Link
                href="/nhan-vien"
                className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700 group-hover:text-emerald-700 transition">
                      Quản lý nhân viên
                    </p>
                    <p className="text-xs text-slate-400">Thêm, sửa, import Excel upsert</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition" />
              </Link>

              <Link
                href="/nguoi-phu-thuoc"
                className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                    <HeartHandshake className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700 group-hover:text-blue-700 transition">
                      Người phụ thuộc
                    </p>
                    <p className="text-xs text-slate-400">Thời gian giảm trừ từ - đến</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition" />
              </Link>

              <Link
                href="/tinh-thue"
                className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700 group-hover:text-amber-700 transition">
                      Tính thuế theo tháng
                    </p>
                    <p className="text-xs text-slate-400">Import thu nhập & tính 5 bậc</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-600 group-hover:translate-x-0.5 transition" />
              </Link>

              <Link
                href="/lich-su-thue"
                className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                    <History className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700 group-hover:text-purple-700 transition">
                      Lịch sử đóng thuế
                    </p>
                    <p className="text-xs text-slate-400">Xem lại các kỳ & xuất Excel</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-purple-600 group-hover:translate-x-0.5 transition" />
              </Link>
            </div>
          </div>

          <div className="bg-slate-100/80 rounded-2xl p-5 border border-slate-200">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-emerald-600" />
              <span>Quy trình tính thuế</span>
            </h3>
            <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside leading-relaxed">
              <li><strong className="text-slate-800">Bước 1:</strong> Thêm hoặc import danh sách nhân viên.</li>
              <li><strong className="text-slate-800">Bước 2:</strong> Đăng ký người phụ thuộc (từ tháng đến tháng).</li>
              <li><strong className="text-slate-800">Bước 3:</strong> Vào "Tính thuế tháng", tải file mẫu và import thu nhập.</li>
              <li><strong className="text-slate-800">Bước 4:</strong> Xem giải trình 4 bước, lưu và xuất Excel.</li>
            </ol>
          </div>
        </div>

        {/* Bảng Biểu thuế 5 bậc Luật 109/2025/QH15 */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
          <div className="mb-4">
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              Biểu Thuế Lũy Tiến Từng Phần 5 Bậc (Luật số 109/2025/QH15)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Áp dụng cho thu nhập từ tiền lương, tiền công từ kỳ tính thuế năm 2026
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3 rounded-l-lg">Bậc</th>
                  <th className="py-2.5 px-3">Phần TNTT / tháng</th>
                  <th className="py-2.5 px-3 text-center">Thuế suất</th>
                  <th className="py-2.5 px-3 rounded-r-lg">Cách tính nhanh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {TAX_BRACKETS_5.map((item) => (
                  <tr key={item.bracket} className="hover:bg-slate-50/80 transition">
                    <td className="py-2.5 px-3 font-bold text-slate-800">
                      Bậc {item.bracket}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 font-medium">
                      {item.bracket === 1 && 'Đến 10.000.000 ₫'}
                      {item.bracket === 2 && 'Trên 10 - 30 triệu ₫'}
                      {item.bracket === 3 && 'Trên 30 - 60 triệu ₫'}
                      {item.bracket === 4 && 'Trên 60 - 100 triệu ₫'}
                      {item.bracket === 5 && 'Trên 100 triệu ₫'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs">
                        {Math.round(item.rate * 100)}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs text-slate-600">
                      {item.quickDeduction === 0
                        ? 'TNTT × 5%'
                        : `TNTT × ${Math.round(item.rate * 100)}% − ${formatCurrencyVND(item.quickDeduction)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100 text-xs text-slate-600 space-y-1">
            <p>
              <strong className="text-emerald-800 font-semibold">&bull; Mức giảm trừ gia cảnh mới:</strong> Bản thân {formatCurrencyVND(PERSONAL_DEDUCTION)}/tháng; Mỗi người phụ thuộc {formatCurrencyVND(DEPENDENT_DEDUCTION)}/tháng.
            </p>
            <p>
              <strong className="text-emerald-800 font-semibold">&bull; Làm tròn:</strong> Thuế tổng cộng được làm tròn xuống hàng nghìn theo đúng quy định.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
