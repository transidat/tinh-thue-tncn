'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Employee } from '@/types/database';
import {
  Users,
  UserPlus,
  FileSpreadsheet,
  Download,
  Upload,
  Search,
  Filter,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  X,
  FileCheck,
  Building,
  RefreshCw
} from 'lucide-react';
import {
  downloadEmployeeTemplate,
  parseEmployeeExcel,
  EmployeeImportRow
} from '@/lib/excel-utils';

export default function EmployeesPage() {
  const supabase = createClient();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'resigned'>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form Modal (Thêm / Sửa)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({
    employee_code: '',
    full_name: '',
    department: '',
    tax_code: '',
    id_card_number: '',
    is_resigned: false,
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete Confirm Modal (Xóa mềm)
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Import Excel Modal
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedValidRows, setParsedValidRows] = useState<EmployeeImportRow[]>([]);
  const [parsedErrorRows, setParsedErrorRows] = useState<{ rowNumber: number; reason: string }[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importResults, setImportResults] = useState<{
    newCount: number;
    updatedCount: number;
    errors: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Tải danh sách nhân viên chưa bị xóa mềm
  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Lọc bỏ các nhân viên đã bị xóa mềm (is_deleted === true)
      const activeList = (data || []).filter((e) => !e.is_deleted);
      setEmployees(activeList);
    } catch (err: any) {
      setNotification({ type: 'error', message: 'Lỗi tải danh sách: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.department && e.department.trim()) {
        set.add(e.department.trim());
      }
    });
    return Array.from(set);
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (statusFilter === 'active' && emp.is_resigned) return false;
      if (statusFilter === 'resigned' && !emp.is_resigned) return false;
      if (deptFilter !== 'all' && emp.department !== deptFilter) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        emp.full_name.toLowerCase().includes(q) ||
        emp.employee_code.toLowerCase().includes(q) ||
        (emp.department && emp.department.toLowerCase().includes(q)) ||
        (emp.tax_code && emp.tax_code.includes(q)) ||
        (emp.id_card_number && emp.id_card_number.includes(q))
      );
    });
  }, [employees, statusFilter, deptFilter, searchQuery]);

  const handleOpenAdd = () => {
    setEditingEmployee(null);
    setFormData({
      employee_code: '',
      full_name: '',
      department: '',
      tax_code: '',
      id_card_number: '',
      is_resigned: false,
    });
    setFormError('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData({
      employee_code: emp.employee_code,
      full_name: emp.full_name,
      department: emp.department || '',
      tax_code: emp.tax_code || '',
      id_card_number: emp.id_card_number || '',
      is_resigned: emp.is_resigned,
    });
    setFormError('');
    setIsFormOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.employee_code.trim()) {
      setFormError('Vui lòng nhập Mã nhân viên.');
      return;
    }
    if (!formData.full_name.trim()) {
      setFormError('Vui lòng nhập Họ và tên nhân viên.');
      return;
    }

    setFormSubmitting(true);

    try {
      if (editingEmployee) {
        // Cập nhật
        const { error } = await supabase
          .from('employees')
          .update({
            employee_code: formData.employee_code.trim(),
            full_name: formData.full_name.trim(),
            department: formData.department.trim() || null,
            tax_code: formData.tax_code.trim() || null,
            id_card_number: formData.id_card_number.trim() || null,
            is_resigned: formData.is_resigned,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingEmployee.id);

        if (error) {
          if (error.code === '23505') {
            throw new Error('Mã nhân viên này đã tồn tại trong hệ thống.');
          }
          throw error;
        }

        setNotification({ type: 'success', message: 'Cập nhật nhân viên thành công!' });
      } else {
        // Thêm mới
        const { error } = await supabase.from('employees').insert({
          employee_code: formData.employee_code.trim(),
          full_name: formData.full_name.trim(),
          department: formData.department.trim() || null,
          tax_code: formData.tax_code.trim() || null,
          id_card_number: formData.id_card_number.trim() || null,
          is_resigned: formData.is_resigned,
          is_deleted: false,
        });

        if (error) {
          if (error.code === '23505') {
            throw new Error('Mã nhân viên này đã tồn tại trong hệ thống.');
          }
          throw error;
        }

        setNotification({ type: 'success', message: 'Thêm mới nhân viên thành công!' });
      }

      setIsFormOpen(false);
      fetchEmployees();
    } catch (err: any) {
      setFormError(err.message || 'Lỗi khi lưu thông tin nhân viên.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Xóa mềm nhân viên (is_deleted = true) để giữ nguyên lịch sử thuế
  const handleDeleteConfirm = async () => {
    if (!deletingEmployee) return;
    setDeleteSubmitting(true);

    try {
      // Thử cập nhật is_deleted: true trước
      const { error } = await supabase
        .from('employees')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', deletingEmployee.id);

      if (error) {
        // Nếu cột is_deleted chưa có trong schema, thông báo lỗi an toàn
        throw error;
      }

      setNotification({
        type: 'success',
        message: `Đã xóa nhân viên ${deletingEmployee.full_name} (lịch sử thuế vẫn được lưu giữ an toàn)`,
      });
      setDeletingEmployee(null);
      fetchEmployees();
    } catch (err: any) {
      setNotification({ type: 'error', message: 'Không thể xóa: ' + err.message });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Chọn file Excel
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportResults(null);
    try {
      const { validRows, errorRows } = await parseEmployeeExcel(file);
      setParsedValidRows(validRows);
      setParsedErrorRows(errorRows.map((er) => ({ rowNumber: er.rowNumber, reason: er.reason })));
    } catch (err: any) {
      setNotification({ type: 'error', message: 'Không thể đọc file Excel: ' + err.message });
      setParsedValidRows([]);
      setParsedErrorRows([]);
    }
  };

  // Thực hiện Import Excel với cơ chế Upsert (thêm mới hoặc cập nhật ghi đè)
  const handleExecuteImport = async () => {
    if (parsedValidRows.length === 0 && parsedErrorRows.length === 0) return;

    setImportLoading(true);
    let newCount = 0;
    let updatedCount = 0;
    const errors: string[] = parsedErrorRows.map((e) => `Dòng ${e.rowNumber}: ${e.reason}`);

    // Tải toàn bộ nhân viên trong CSDL (bao gồm cả nhân viên đã xóa mềm để kiểm tra)
    const { data: allDbEmps } = await supabase.from('employees').select('*');
    const existingMap = new Map<string, any>();
    (allDbEmps || []).forEach((e) => {
      existingMap.set(e.employee_code.toLowerCase().trim(), e);
    });

    for (const row of parsedValidRows) {
      const codeKey = row.MaNV.toLowerCase().trim();
      const existing = existingMap.get(codeKey);

      if (existing) {
        // Nếu đã bị xóa mềm -> Báo lỗi dòng chờ xác nhận
        if (existing.is_deleted) {
          errors.push(`Dòng ${row.rowNumber}: Mã NV "${row.MaNV}" đã bị xóa mềm trước đó, vui lòng khôi phục trong CSDL.`);
          continue;
        }

        // Nếu nhân viên đang tồn tại -> CẬP NHẬT GHI ĐÈ thông tin
        try {
          const { error: updateErr } = await supabase
            .from('employees')
            .update({
              full_name: row.HoTen.trim(),
              department: row.DonVi?.trim() || null,
              tax_code: row.MaSoThue?.trim() || null,
              id_card_number: row.SoCCCD?.trim() || null,
              is_resigned: Boolean(row.DaNghiViec),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updateErr) {
            errors.push(`Dòng ${row.rowNumber} (Mã ${row.MaNV}): ${updateErr.message}`);
          } else {
            updatedCount++;
          }
        } catch (err: any) {
          errors.push(`Dòng ${row.rowNumber} (Mã ${row.MaNV}): ${err.message}`);
        }
      } else {
        // Nếu chưa có -> THÊM MỚI
        try {
          const { error: insertErr } = await supabase.from('employees').insert({
            employee_code: row.MaNV.trim(),
            full_name: row.HoTen.trim(),
            department: row.DonVi?.trim() || null,
            tax_code: row.MaSoThue?.trim() || null,
            id_card_number: row.SoCCCD?.trim() || null,
            is_resigned: Boolean(row.DaNghiViec),
            is_deleted: false,
          });

          if (insertErr) {
            errors.push(`Dòng ${row.rowNumber} (Mã ${row.MaNV}): ${insertErr.message}`);
          } else {
            newCount++;
            existingMap.set(codeKey, { employee_code: row.MaNV.trim() });
          }
        } catch (err: any) {
          errors.push(`Dòng ${row.rowNumber} (Mã ${row.MaNV}): ${err.message}`);
        }
      }
    }

    setImportResults({
      newCount,
      updatedCount,
      errors: errors.slice(0, 10), // Giữ tối đa 10 lỗi hiển thị
    });

    setImportLoading(false);
    fetchEmployees();
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

      {/* Header & Action buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2.5">
            <Users className="w-7 h-7 text-emerald-600" />
            <span>Quản Lý Danh Sách Nhân Viên</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Tổng cộng: <strong className="text-slate-700">{employees.length}</strong> nhân viên &bull;{' '}
            <strong className="text-emerald-700">
              {employees.filter((e) => !e.is_resigned).length}
            </strong>{' '}
            đang làm việc &bull;{' '}
            <strong className="text-slate-500">
              {employees.filter((e) => e.is_resigned).length}
            </strong>{' '}
            đã nghỉ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={downloadEmployeeTemplate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white text-slate-700 hover:bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium transition shadow-xs cursor-pointer"
            title="Tải file Excel mẫu để nhập dữ liệu"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Tải mẫu Excel</span>
          </button>

          <button
            onClick={() => {
              setIsImportOpen(true);
              setImportFile(null);
              setParsedValidRows([]);
              setParsedErrorRows([]);
              setImportResults(null);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300 rounded-xl text-xs sm:text-sm font-medium transition shadow-xs cursor-pointer"
          >
            <Upload className="w-4 h-4 text-emerald-600" />
            <span>Import Excel</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-md shadow-emerald-200 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Thêm nhân viên</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo Mã NV, Họ tên, Đơn vị, MST, CCCD..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 hidden sm:block" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang làm việc</option>
            <option value="resigned">Đã nghỉ việc</option>
          </select>

          {departments.length > 0 && (
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            >
              <option value="all">Tất cả đơn vị</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Employee List Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="text-sm">Đang tải danh sách nhân viên...</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-700">Chưa có nhân viên nào</h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'all' || deptFilter !== 'all'
                ? 'Không tìm thấy kết quả phù hợp với bộ lọc hiện tại.'
                : 'Bắt đầu bằng cách thêm nhân viên mới hoặc import từ file Excel.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Mã NV</th>
                  <th className="py-3 px-4">Họ và tên</th>
                  <th className="py-3 px-4">Đơn vị / Phòng ban</th>
                  <th className="py-3 px-4">Mã số thuế</th>
                  <th className="py-3 px-4">Số CCCD</th>
                  <th className="py-3 px-4 text-center">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp) => (
                  <tr
                    key={emp.id}
                    className={`hover:bg-slate-50/80 transition ${
                      emp.is_resigned ? 'bg-slate-50/50 text-slate-400' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      {emp.employee_code}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {emp.full_name}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {emp.department ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-slate-400" />
                          <span>{emp.department}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Chưa cập nhật</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {emp.tax_code || <span className="text-slate-400 italic">—</span>}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {emp.id_card_number || <span className="text-slate-400 italic">—</span>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {emp.is_resigned ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle className="w-3 h-3" />
                          <span>Đã nghỉ việc</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Đang làm việc</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEdit(emp)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
                          title="Chỉnh sửa thông tin"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingEmployee(emp)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                          title="Xóa nhân viên (xóa mềm)"
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

      {/* Modal Thêm / Chỉnh sửa */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-scaleIn">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">
                {editingEmployee ? 'Chỉnh Sửa Thông Tin Nhân Viên' : 'Thêm Mới Nhân Viên'}
              </h2>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Mã nhân viên <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.employee_code}
                    onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })}
                    placeholder="VD: NV001"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Họ và tên <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="VD: Nguyễn Văn A"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Đơn vị / Phòng ban
                </label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="VD: Phòng Kế toán - Tài chính"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Mã số thuế (MST)
                  </label>
                  <input
                    type="text"
                    value={formData.tax_code}
                    onChange={(e) => setFormData({ ...formData, tax_code: e.target.value })}
                    placeholder="VD: 8012345678"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
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
                    placeholder="VD: 001090123456"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/70 transition">
                  <input
                    type="checkbox"
                    checked={formData.is_resigned}
                    onChange={(e) => setFormData({ ...formData, is_resigned: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-semibold text-slate-800">
                      Đánh dấu nhân viên đã nghỉ việc
                    </span>
                    <p className="text-xs text-slate-500">
                      Nhân viên đã nghỉ việc sẽ không đưa vào danh sách tính thuế thường xuyên.
                    </p>
                  </div>
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl shadow-md shadow-emerald-200 transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {formSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingEmployee ? 'Cập nhật' : 'Thêm mới'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Xóa mềm nhân viên */}
      {deletingEmployee && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">
              Xóa nhân viên khỏi danh sách?
            </h3>
            <p className="text-sm text-slate-600 mt-2">
              Bạn có chắc chắn muốn xóa nhân viên{' '}
              <strong className="text-slate-900">{deletingEmployee.full_name}</strong> (Mã:{' '}
              {deletingEmployee.employee_code})?
            </p>
            <p className="text-xs text-emerald-700 mt-2 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
              Cơ chế xóa mềm (Soft Delete): Hồ sơ nhân viên sẽ ẩn khỏi danh sách nhưng toàn bộ lịch sử thuế và bảng lương cũ vẫn được bảo lưu nguyên vẹn.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingEmployee(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleteSubmitting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm rounded-xl shadow transition flex items-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                {deleteSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Xác nhận xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Import Excel với cơ chế Upsert */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-scaleIn">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <h2 className="text-lg font-bold text-slate-800">
                  Import Danh Sách Nhân Viên (Tự động Cập nhật / Thêm mới)
                </h2>
              </div>
              <button
                onClick={() => setIsImportOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-2xl p-6 text-center bg-emerald-50/40 cursor-pointer transition group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx, .xls"
                  className="hidden"
                />
                <Upload className="w-10 h-10 text-emerald-600 mx-auto mb-2 group-hover:scale-110 transition" />
                <p className="text-sm font-semibold text-slate-700">
                  {importFile ? importFile.name : 'Bấm vào đây để chọn file Excel (.xlsx, .xls)'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Định dạng: MaNV (text giữ số 0), HoTen (bắt buộc), DonVi, MaSoThue, SoCCCD, DaNghiViec
                </p>
              </div>

              {/* Báo cáo kết quả xử lý */}
              {importResults && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-sm">
                  <p className="font-semibold text-slate-800">Báo cáo kết quả xử lý import:</p>
                  <div className="flex flex-wrap gap-4 text-xs sm:text-sm">
                    <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                      <CheckCircle2 className="w-4 h-4" />
                      Thêm mới: {importResults.newCount} nhân viên
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-blue-700 font-semibold bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                      <RefreshCw className="w-4 h-4" />
                      Cập nhật (ghi đè): {importResults.updatedCount} nhân viên
                    </span>
                    {importResults.errors.length > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-rose-700 font-semibold bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                        <AlertCircle className="w-4 h-4" />
                        Lỗi: {importResults.errors.length} dòng
                      </span>
                    )}
                  </div>
                  {importResults.errors.length > 0 && (
                    <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200 mt-2 space-y-1">
                      <p className="font-bold">Chi tiết lỗi:</p>
                      {importResults.errors.map((err, i) => (
                        <p key={i}>&bull; {err}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Cảnh báo lỗi đọc trước nếu có */}
              {parsedErrorRows.length > 0 && !importResults && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-rose-800">
                    <AlertCircle className="w-4 h-4" />
                    Phát hiện {parsedErrorRows.length} dòng lỗi trong file (sẽ bị bỏ qua):
                  </p>
                  {parsedErrorRows.slice(0, 5).map((err, i) => (
                    <p key={i}>&bull; Dòng {err.rowNumber}: {err.reason}</p>
                  ))}
                  {parsedErrorRows.length > 5 && (
                    <p className="italic">...và còn {parsedErrorRows.length - 5} dòng lỗi khác.</p>
                  )}
                </div>
              )}

              {/* Xem trước dữ liệu */}
              {parsedValidRows.length > 0 && !importResults && (
                <div>
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                    Xem trước {parsedValidRows.length} dòng hợp lệ sẵn sàng import:
                  </span>
                  <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-52">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 sticky top-0">
                        <tr>
                          <th className="py-2 px-3">Dòng</th>
                          <th className="py-2 px-3">Mã NV</th>
                          <th className="py-2 px-3">Họ tên</th>
                          <th className="py-2 px-3">Đơn vị</th>
                          <th className="py-2 px-3">MST</th>
                          <th className="py-2 px-3">CCCD</th>
                          <th className="py-2 px-3">Đã nghỉ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedValidRows.slice(0, 10).map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-1.5 px-3 text-slate-400">#{row.rowNumber}</td>
                            <td className="py-1.5 px-3 font-mono font-bold text-slate-800">{row.MaNV}</td>
                            <td className="py-1.5 px-3 font-semibold text-slate-900">{row.HoTen}</td>
                            <td className="py-1.5 px-3 text-slate-600">{row.DonVi || '—'}</td>
                            <td className="py-1.5 px-3 font-mono text-slate-600">{row.MaSoThue || '—'}</td>
                            <td className="py-1.5 px-3 font-mono text-slate-600">{row.SoCCCD || '—'}</td>
                            <td className="py-1.5 px-3">
                              {row.DaNghiViec ? (
                                <span className="text-rose-600 font-medium">Có</span>
                              ) : (
                                <span className="text-emerald-600">Không</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={downloadEmployeeTemplate}
                className="inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:underline font-medium cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải lại file mẫu</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsImportOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
                >
                  {importResults ? 'Đóng' : 'Hủy'}
                </button>
                {parsedValidRows.length > 0 && !importResults && (
                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    disabled={importLoading}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl shadow transition flex items-center gap-2 disabled:opacity-60 cursor-pointer"
                  >
                    {importLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Đang xử lý import...</span>
                      </>
                    ) : (
                      <>
                        <FileCheck className="w-4 h-4" />
                        <span>Tiến hành Import ({parsedValidRows.length} dòng)</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
