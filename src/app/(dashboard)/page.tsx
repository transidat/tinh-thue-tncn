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
  UserX,
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';
import { formatCurrency } from '@/lib/tax-calculator';

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

        // 1. Thống kê nhân viên
        const { data: employees } = await supabase
          .from('employees')
          .select('id, is_resigned');

        const empList = employees || [];
        const totalEmployees = empList.length;
        const activeEmployees = empList.filter((e) => !e.is_resigned).length;
        const resignedEmployees = totalEmployees - activeEmployees;

        // 2. Thống kê người phụ thuộc
        const { count: depCount } = await supabase
          .from('dependents')
          .select('*', { count: 'exact', head: true })
          .eq('is_inactive', false);

        // 3. Kỳ tính thuế gần nhất
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

  const taxBrackets = [
    { bracket: 1, range: 'Đến 5 triệu VNĐ', rate: '5%', formula: 'TNTT × 5%' },
    { bracket: 2, range: 'Trên 5 - 10 triệu VNĐ', rate: '10%', formula: 'TNTT × 10% - 250.000 ₫' },
    { bracket: 3, range: 'Trên 10 - 18 triệu VNĐ', rate: '15%', formula: 'TNTT × 15% - 750.000 ₫' },
    { bracket: 4, range: 'Trên 18 - 32 triệu VNĐ', rate: '20%', formula: 'TNTT × 20% - 1.650.000 ₫' },
    { bracket: 5, range: 'Trên 32 - 52 triệu VNĐ', rate: '25%', formula: 'TNTT × 25% - 3.250.000 ₫' },
    { bracket: 6, range: 'Trên 52 - 80 triệu VNĐ', rate: '30%', formula: 'TNTT × 30% - 5.850.000 ₫' },
    { bracket: 7, range: 'Trên 80 triệu VNĐ', rate: '35%', formula: 'TNTT × 35% - 9.850.000 ₫' },
  ];

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 rounded-2xl p-6 sm:p-8 text-white shadow-md">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-800/60 text-emerald-100 text-xs font-medium mb-3 backdrop-blur-sm">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
            Cập nhật theo Nghị quyết 954/2020/UBTVQH14
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Hệ Thống Quản Lý & Tính Thuế TNCN
          </h1>
          <p className="text-emerald-100/90 text-sm sm:text-base mt-2 leading-relaxed">
            Dành cho Nhân viên Kế toán doanh nghiệp: Quản lý hồ sơ nhân viên, người phụ thuộc,
            import bảng thu nhập Excel và tính thuế TNCN lũy tiến tự động theo đúng luật thuế hiện hành.
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
        {/* Nhân viên đang làm */}
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

        {/* Người phụ thuộc đang tính */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Người phụ thuộc
            </p>
            <p className="text-2xl font-bold text-slate-800 mt-1">
              {loading ? '...' : stats.totalDependents}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Được giảm trừ 4.400.000 ₫/người
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <HeartHandshake className="w-6 h-6" />
          </div>
        </div>

        {/* Giảm trừ bản thân */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Mức giảm trừ bản thân
            </p>
            <p className="text-xl font-bold text-slate-800 mt-1">
              11.000.000 ₫
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Tương đương 132 triệu ₫/năm
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Thuế tháng gần nhất */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Thuế kỳ gần nhất {stats.latestPeriod ? `(${stats.latestPeriod})` : ''}
            </p>
            <p className="text-xl font-bold text-emerald-700 mt-1">
              {loading ? '...' : formatCurrency(stats.latestTotalTax)}
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

      {/* Main Grid: Quick Actions & Tax Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Quick Navigation / Actions (1 col) */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
            <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span>Thao tác nhanh</span>
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
                    <p className="text-xs text-slate-400">Thêm, sửa, import Excel</p>
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
                    <p className="text-xs text-slate-400">Thời gian giảm trừ, quan hệ</p>
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
                    <p className="text-xs text-slate-400">Import thu nhập & tính lũy tiến</p>
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

          {/* Quick guide card */}
          <div className="bg-slate-100/80 rounded-2xl p-5 border border-slate-200">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-emerald-600" />
              <span>Quy trình cho Kế toán</span>
            </h3>
            <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside leading-relaxed">
              <li><strong className="text-slate-800">Bước 1:</strong> Khởi tạo hoặc import danh sách nhân viên.</li>
              <li><strong className="text-slate-800">Bước 2:</strong> Đăng ký người phụ thuộc và thời gian giảm trừ.</li>
              <li><strong className="text-slate-800">Bước 3:</strong> Vào "Tính thuế tháng", tải file mẫu và import thu nhập.</li>
              <li><strong className="text-slate-800">Bước 4:</strong> Bấm tính thuế tự động, kiểm tra giải trình và lưu kết quả.</li>
            </ol>
          </div>
        </div>

        {/* Right Column: Progressive Tax Rate Table (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                Biểu Thuế Lũy Tiến Từng Phần (Điều 22 Luật Thuế TNCN)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Áp dụng đối với thu nhập từ tiền lương, tiền công
              </p>
            </div>
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
                {taxBrackets.map((item) => (
                  <tr key={item.bracket} className="hover:bg-slate-50/80 transition">
                    <td className="py-2.5 px-3 font-bold text-slate-800">
                      Bậc {item.bracket}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 font-medium">
                      {item.range}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs">
                        {item.rate}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs text-slate-600">
                      {item.formula}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100 text-xs text-slate-600 space-y-1">
            <p>
              <strong className="text-emerald-800 font-semibold">&bull; Thu nhập chịu thuế:</strong> Tổng thu nhập - Các khoản không chịu thuế / miễn thuế (ăn trưa, điện thoại, trang phục theo hạn mức quy định).
            </p>
            <p>
              <strong className="text-emerald-800 font-semibold">&bull; Thu nhập tính thuế (TNTT):</strong> Thu nhập chịu thuế - Các khoản giảm trừ (Bảo hiểm bắt buộc + 11.000.000 ₫ bản thân + NPT × 4.400.000 ₫).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

