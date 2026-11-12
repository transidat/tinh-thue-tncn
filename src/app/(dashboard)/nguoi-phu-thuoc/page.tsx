'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Dependent, Employee } from '@/types/database';
import {
  HeartHandshake,
  UserPlus,
  Search,
  Filter,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  X,
  Calendar,
  Clock,
  User,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';

export default function DependentsPage() {
  const supabase = createClient();

  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Bộ lọc
  const [searchQuery, setSearchQuery] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Notification state
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form Modal (Thêm / Sửa)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDependent, setEditingDependent] = useState<Dependent | null>(null);
  const [formData, setFormData] = useState({
    employee_id: '',
    full_name: '',
    relationship: 'Con',
    birth_date: '',
    tax_code: '',
    id_card_number: '',
    deduction_from: '',
    deduction_to: '',
    is_inactive: false,
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete Confirm Modal
  const [deletingDependent, setDeletingDependent] = useState<Dependent | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Tải dữ liệu ban đầu
  const fetchData = async () => {
    try {
      setLoading(true);

      // 1. Tải danh sách nhân viên
      const { data: emps, error: empErr } = await supabase
        .from('employees')
        .select('*')
        .order('full_name', { ascending: true });
      if (empErr) throw empErr;
      setEmployees(emps || []);

      // 2. Tải danh sách người phụ thuộc kèm thông tin nhân viên
      const { data: deps, error: depErr } = await supabase
        .from('dependents')
        .select(`
          *,
          employees:employee_id (
            id,
            employee_code,
            full_name,
            department
          )
        `)
        .order('created_at', { ascending: false });

      if (depErr) throw depErr;
      setDependents(deps || []);
    } catch (err: any) {
      setNotification({ type: 'error', message: 'Lỗi tải dữ liệu: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Tính toán trạng thái hiệu lực hiện tại theo tháng năm này
  const currentMonth = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, []);

  const getStatusBadge = (dep: Dependent) => {
    if (dep.is_inactive) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
          <XCircle className="w-3 h-3 text-slate-400" />
          <span>Ngưng sử dụng</span>
        </span>
      );
    }

    if (dep.deduction_to && currentMonth > dep.deduction_to) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3 h-3 text-amber-500" />
          <span>Hết hạn giảm trừ</span>
        </span>
      );
    }

    if (currentMonth < dep.deduction_from) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          <Clock className="w-3 h-3 text-blue-500" />
          <span>Chưa đến hạn</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
        <span>Đang giảm trừ</span>
      </span>
    );
  };

  // Lọc danh sách
  const filteredDependents = useMemo(() => {
    return dependents.filter((dep) => {
      // 1. Lọc theo nhân viên
      if (employeeFilter !== 'all' && dep.employee_id !== employeeFilter) {
        return false;
      }

      // 2. Lọc theo trạng thái
      if (statusFilter === 'active' && dep.is_inactive) return false;
      if (statusFilter === 'inactive' && !dep.is_inactive) return false;

      // 3. Tìm kiếm
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const empName = dep.employees?.full_name?.toLowerCase() || '';
      const empCode = dep.employees?.employee_code?.toLowerCase() || '';
      const depName = dep.full_name.toLowerCase();
      const depMST = dep.tax_code || '';
      const depCCCD = dep.id_card_number || '';
      const relation = dep.relationship.toLowerCase();

      return (
        depName.includes(q) ||
        empName.includes(q) ||
        empCode.includes(q) ||
        depMST.includes(q) ||
        depCCCD.includes(q) ||
        relation.includes(q)
      );
    });
  }, [dependents, employeeFilter, statusFilter, searchQuery]);

  // Mở modal Thêm
  const handleOpenAdd = () => {
    setEditingDependent(null);
    setFormData({
      employee_id: employees.length > 0 ? employees[0].id : '',
      full_name: '',
      relationship: 'Con',
      birth_date: '',
      tax_code: '',
      id_card_number: '',
      deduction_from: currentMonth,
      deduction_to: '',
      is_inactive: false,
    });
    setFormError('');
    setIsFormOpen(true);
  };

  // Mở modal Sửa
  const handleOpenEdit = (dep: Dependent) => {
    setEditingDependent(dep);
    setFormData({
      employee_id: dep.employee_id,
      full_name: dep.full_name,
      relationship: dep.relationship,
      birth_date: dep.birth_date || '',
      tax_code: dep.tax_code || '',
      id_card_number: dep.id_card_number || '',
      deduction_from: dep.deduction_from,
      deduction_to: dep.deduction_to || '',
      is_inactive: dep.is_inactive,
    });
    setFormError('');
    setIsFormOpen(true);
  };

  // Submit Form Thêm/Sửa
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.employee_id) {
      setFormError('Vui lòng chọn nhân viên.');
      return;
    }
    if (!formData.full_name.trim()) {
      setFormError('Vui lòng nhập Họ và tên người phụ thuộc.');
      return;
    }
    if (!formData.relationship.trim()) {
      setFormError('Vui lòng nhập mối quan hệ với nhân viên.');
      return;
    }
    if (!formData.deduction_from) {
      setFormError('Vui lòng chọn mốc thời gian bắt đầu giảm trừ (Từ tháng/năm).');
      return;
    }

    if (formData.deduction_to && formData.deduction_from > formData.deduction_to) {
      setFormError('Thời gian bắt đầu giảm trừ phải nhỏ hơn hoặc bằng thời gian kết thúc.');
      return;
    }

    setFormSubmitting(true);

    try {
      if (editingDependent) {
        // Cập nhật
        const { error } = await supabase
          .from('dependents')
          .update({
            employee_id: formData.employee_id,
            full_name: formData.full_name.trim(),
            relationship: formData.relationship.trim(),
            birth_date: formData.birth_date || null,
            tax_code: formData.tax_code.trim() || null,
            id_card_number: formData.id_card_number.trim() || null,
            deduction_from: formData.deduction_from,
            deduction_to: formData.deduction_to || null,
            is_inactive: formData.is_inactive,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingDependent.id);

        if (error) throw error;
        setNotification({ type: 'success', message: 'Cập nhật người phụ thuộc thành công!' });
      } else {
        // Thêm mới
        const { error } = await supabase.from('dependents').insert({
          employee_id: formData.employee_id,
          full_name: formData.full_name.trim(),
          relationship: formData.relationship.trim(),
          birth_date: formData.birth_date || null,
          tax_code: formData.tax_code.trim() || null,
          id_card_number: formData.id_card_number.trim() || null,
          deduction_from: formData.deduction_from,
          deduction_to: formData.deduction_to || null,
          is_inactive: formData.is_inactive,
        });

        if (error) throw error;
        setNotification({ type: 'success', message: 'Thêm mới người phụ thuộc thành công!' });
      }

      setIsFormOpen(false);
      fetchData();
    } catch (err: any) {
      setFormError(err.message || 'Lỗi khi lưu thông tin người phụ thuộc.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Xác nhận Xóa
  const handleDeleteConfirm = async () => {
    if (!deletingDependent) return;
    setDeleteSubmitting(true);

    try {
      const { error } = await supabase
        .from('dependents')
        .delete()
        .eq('id', deletingDependent.id);

      if (error) throw error;

      setNotification({ type: 'success', message: `Đã xóa người phụ thuộc ${deletingDependent.full_name}` });
      setDeletingDependent(null);
      fetchData();
    } catch (err: any) {
      setNotification({ type: 'error', message: 'Không thể xóa: ' + err.message });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Thông báo Notification */}
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

      {/* Header & Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2.5">
            <HeartHandshake className="w-7 h-7 text-emerald-600" />
            <span>Quản Lý Người Phụ Thuộc</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Tổng cộng: <strong className="text-slate-700">{dependents.length}</strong> hồ sơ &bull;{' '}
            Mức giảm trừ:{' '}
            <strong className="text-emerald-700">4.400.000 ₫/người/tháng</strong>
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-md shadow-emerald-200 cursor-pointer self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Đăng ký người phụ thuộc</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo Tên NPT, Tên/Mã nhân viên, CCCD, MST, Quan hệ..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
          />
        </div>

        {/* Filter by Employee */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 hidden sm:block" />
          <select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition max-w-[200px]"
          >
            <option value="all">Tất cả nhân viên</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.employee_code} - {emp.full_name}
              </option>
            ))}
          </select>

          {/* Filter by Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang kích hoạt</option>
            <option value="inactive">Đã ngưng sử dụng</option>
          </select>
        </div>
      </div>

      {/* Dependents Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="text-sm">Đang tải hồ sơ người phụ thuộc...</p>
          </div>
        ) : filteredDependents.length === 0 ? (
          <div className="p-12 text-center">
            <HeartHandshake className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-700">Chưa có người phụ thuộc nào</h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery || employeeFilter !== 'all' || statusFilter !== 'all'
                ? 'Không tìm thấy hồ sơ phù hợp với bộ lọc hiện tại.'
                : 'Bắt đầu đăng ký người phụ thuộc cho nhân viên để được tính giảm trừ thuế.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Nhân viên</th>
                  <th className="py-3 px-4">Họ tên người phụ thuộc</th>
                  <th className="py-3 px-4">Mối quan hệ</th>
                  <th className="py-3 px-4">Ngày sinh</th>
                  <th className="py-3 px-4">MST / CCCD</th>
                  <th className="py-3 px-4">Thời gian giảm trừ</th>
                  <th className="py-3 px-4 text-center">Hiệu lực</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDependents.map((dep) => (
                  <tr
                    key={dep.id}
                    className={`hover:bg-slate-50/80 transition ${
                      dep.is_inactive ? 'bg-slate-50/50 text-slate-400' : ''
                    }`}
                  >
                    {/* Nhân viên liên kết */}
                    <td className="py-3 px-4">
                      {dep.employees ? (
                        <div>
                          <p className="font-semibold text-slate-800">
                            {dep.employees.full_name}
                          </p>
                          <p className="font-mono text-xs text-slate-500">
                            {dep.employees.employee_code}{' '}
                            {dep.employees.department && `• ${dep.employees.department}`}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Chưa liên kết</span>
                      )}
                    </td>

                    {/* Họ tên NPT */}
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {dep.full_name}
                    </td>

                    {/* Mối quan hệ */}
                    <td className="py-3 px-4 text-slate-700">
                      <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-medium">
                        {dep.relationship}
                      </span>
                    </td>

                    {/* Ngày sinh */}
                    <td className="py-3 px-4 text-slate-600">
                      {dep.birth_date ? (
                        new Date(dep.birth_date).toLocaleDateString('vi-VN')
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>

                    {/* MST / CCCD */}
                    <td className="py-3 px-4 font-mono text-slate-600 text-xs">
                      {dep.tax_code && <div>MST: {dep.tax_code}</div>}
                      {dep.id_card_number && <div>CCCD: {dep.id_card_number}</div>}
                      {!dep.tax_code && !dep.id_card_number && (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>

                    {/* Thời gian giảm trừ */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-mono text-xs text-slate-700">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {dep.deduction_from} &rarr; {dep.deduction_to || 'Vô thời hạn'}
                        </span>
                      </div>
                    </td>

                    {/* Trạng thái hiệu lực */}
                    <td className="py-3 px-4 text-center">
                      {getStatusBadge(dep)}
                    </td>

                    {/* Thao tác */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEdit(dep)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition"
                          title="Chỉnh sửa thông tin"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingDependent(dep)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition"
                          title="Xóa người phụ thuộc"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================== */}
      {/* MODAL THÊM / CHỈNH SỬA NGƯỜI PHỤ THUỘC */}
      {/* ========================================================== */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-scaleIn">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">
                {editingDependent ? 'Chỉnh Sửa Người Phụ Thuộc' : 'Đăng Ký Người Phụ Thuộc Mới'}
              </h2>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs sm:text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Chọn nhân viên */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Nhân viên bảo trợ <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                >
                  <option value="">-- Chọn nhân viên --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.employee_code} - {emp.full_name} ({emp.department || 'Chưa rõ phòng ban'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Họ tên NPT & Mối quan hệ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Họ tên người phụ thuộc <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="VD: Nguyễn Văn Con"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Mối quan hệ <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.relationship}
                    onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                  >
                    <option value="Con">Con (dưới 18 tuổi hoặc đang học)</option>
                    <option value="Vợ/Chồng">Vợ / Chồng</option>
                    <option value="Cha đẻ/Mẹ đẻ">Cha đẻ / Mẹ đẻ</option>
                    <option value="Cha chồng/Mẹ chồng">Cha chồng / Mẹ chồng</option>
                    <option value="Cha vợ/Mẹ vợ">Cha vợ / Mẹ vợ</option>
                    <option value="Người thân khác">Người thân khác không nơi nương tựa</option>
                  </select>
                </div>
              </div>

              {/* Ngày sinh & MST / CCCD */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Ngày sinh
                  </label>
                  <input
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Mã số thuế (nếu có)
                  </label>
                  <input
                    type="text"
                    value={formData.tax_code}
                    onChange={(e) => setFormData({ ...formData, tax_code: e.target.value })}
                    placeholder="VD: 8523..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Số CCCD
                  </label>
                  <input
                    type="text"
                    value={formData.id_card_number}
                    onChange={(e) => setFormData({ ...formData, id_card_number: e.target.value })}
                    placeholder="VD: 0012..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Thời gian giảm trừ: Từ tháng/năm đến tháng/năm */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                  Thời gian tính giảm trừ gia cảnh
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">
                      Từ tháng/năm <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="month"
                      required
                      value={formData.deduction_from}
                      onChange={(e) => setFormData({ ...formData, deduction_from: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 mb-1">
                      Đến tháng/năm <span className="text-slate-400 font-normal">(bỏ trống nếu vô thời hạn)</span>
                    </label>
                    <input
                      type="month"
                      value={formData.deduction_to}
                      onChange={(e) => setFormData({ ...formData, deduction_to: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Checkbox Đánh dấu không còn sử dụng */}
              <div className="pt-1">
                <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/70 transition">
                  <input
                    type="checkbox"
                    checked={formData.is_inactive}
                    onChange={(e) => setFormData({ ...formData, is_inactive: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-semibold text-slate-800">
                      Đánh dấu không còn sử dụng (không tính giảm trừ)
                    </span>
                    <p className="text-xs text-slate-500">
                      Khi tích chọn, người phụ thuộc này sẽ không được đưa vào tính giảm trừ thuế trong bất kỳ kỳ lương nào.
                    </p>
                  </div>
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl shadow-md shadow-emerald-200 transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {formSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingDependent ? 'Cập nhật' : 'Lưu hồ sơ'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL XÁC NHẬN XÓA NPT */}
      {/* ========================================================== */}
      {deletingDependent && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">
              Xóa hồ sơ người phụ thuộc?
            </h3>
            <p className="text-sm text-slate-600 mt-2">
              Bạn có chắc chắn muốn xóa người phụ thuộc{' '}
              <strong className="text-slate-900">{deletingDependent.full_name}</strong> ({deletingDependent.relationship})?
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingDependent(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleteSubmitting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm rounded-xl shadow transition flex items-center gap-2 disabled:opacity-60"
              >
                {deleteSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Xác nhận xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

