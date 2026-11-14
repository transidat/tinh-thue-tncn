import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import * as XLSX from 'xlsx';

// Mock SSR createClient
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// Mock Service Role Client
vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import {
  previewMonthlyPayrollAction,
  saveMonthlyPayrollAction,
} from '@/app/(dashboard)/tinh-thue/actions';

function createMockIncomeExcelBuffer(rows: any[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ThuNhap');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

describe('Bộ test Server Action: Xác thực, Soft-Delete, Idempotency, Audit SHA-256', () => {
  const period = '2026-06';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 7.7: Chưa đăng xuất / không có session -> trả về { ok: false, error: 'Vui lòng đăng nhập' }
  it('Test 7.7 (Unauthorized): Người dùng chưa đăng nhập gọi Server Action phải bị từ chối', async () => {
    // Giả lập session null (chưa đăng nhập)
    (createClient as any).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('Auth session missing') }),
      },
    });

    const formData = new FormData();
    formData.append('period', period);
    const fakeFile = new File(['fake content'], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    formData.append('file', fakeFile);

    const previewRes = await previewMonthlyPayrollAction(formData);
    expect(previewRes.ok).toBe(false);
    expect(previewRes.error).toBe('Vui lòng đăng nhập');

    const saveRes = await saveMonthlyPayrollAction(formData);
    expect(saveRes.ok).toBe(false);
    expect(saveRes.error).toBe('Vui lòng đăng nhập');
  });

  // Test 7.6: Nhân viên is_deleted = true -> Báo lỗi dòng, không tính
  it('Test 7.6 (Soft-deleted): Nhân viên bị xóa mềm (is_deleted = true) phải bị từ chối', async () => {
    (createClient as any).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'employees') {
          return {
            select: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'emp-active-1',
                  employee_code: 'EMP001',
                  full_name: 'Nguyễn Văn Đang Làm',
                  tax_code: '8000000001',
                  is_deleted: false,
                  is_resigned: false,
                },
                {
                  id: 'emp-deleted-2',
                  employee_code: 'EMP_DELETED',
                  full_name: 'Trần Văn Đã Xóa',
                  tax_code: '8000000002',
                  is_deleted: true, // Xóa mềm
                  is_resigned: true,
                },
              ],
            }),
          };
        }
        if (table === 'dependents') {
          return {
            select: vi.fn().mockResolvedValue({ data: [] }),
          };
        }
        return { select: vi.fn().mockResolvedValue({ data: [] }) };
      }),
    });

    const excelBuffer = createMockIncomeExcelBuffer([
      { MaNV: 'EMP001', HoTen: 'Nguyễn Văn Đang Làm', TongThuNhap: 25000000, KhongChiuThue: 0, BaoHiem: 2000000 },
      { MaNV: 'EMP_DELETED', HoTen: 'Trần Văn Đã Xóa', TongThuNhap: 30000000, KhongChiuThue: 0, BaoHiem: 2500000 },
    ]);

    const formData = new FormData();
    formData.append('period', period);
    const file = new File([excelBuffer], 'income_test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    formData.append('file', file);

    const result = await previewMonthlyPayrollAction(formData);

    expect(result.ok).toBe(true);
    // Chỉ có 1 nhân viên hợp lệ (EMP001)
    expect(result.items?.length).toBe(1);
    expect(result.items?.[0].maNV).toBe('EMP001');

    // Nhân viên xóa mềm phải nằm trong danh sách lỗi
    const deletedError = result.errors?.find((e) => e.maNV === 'EMP_DELETED');
    expect(deletedError).toBeDefined();
    expect(deletedError?.reason).toContain('đã bị xóa trong hệ thống (xóa mềm)');
  });

  // Test 7.8 (Audit SHA-256): Server Action tính đúng SHA-256 từ file nhị phân gốc
  it('Test 7.8 (Audit SHA-256): Kiểm tra tính toàn vẹn và khớp mã băm SHA-256 của file', async () => {
    (createClient as any).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [] }),
      }),
    });

    const excelBuffer = createMockIncomeExcelBuffer([
      { MaNV: 'EMP001', HoTen: 'Nguyễn Văn A', TongThuNhap: 20000000, KhongChiuThue: 0, BaoHiem: 1500000 },
    ]);

    // Tính mã SHA-256 trực tiếp từ buffer
    const expectedSha256 = crypto.createHash('sha256').update(excelBuffer).digest('hex');

    const formData = new FormData();
    formData.append('period', period);
    const file = new File([excelBuffer], 'bang_luong_thang_06.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    formData.append('file', file);

    const result = await previewMonthlyPayrollAction(formData);

    expect(result.sourceFileName).toBe('bang_luong_thang_06.xlsx');
    expect(result.sourceFileSha256).toBe(expectedSha256);
  });

  // Test 7.4 (Idempotency): Gọi lưu cùng 1 tháng 2 lần -> RPC được gọi đúng cách và không nhân đôi
  it('Test 7.4 (Idempotency): Lưu cùng một tháng hai lần không làm biến dạng hay nhân đôi dữ liệu', async () => {
    (createClient as any).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'employees') {
          return {
            select: vi.fn().mockResolvedValue({
              data: [
                { id: 'emp-1', employee_code: 'EMP001', full_name: 'Nguyễn Văn A', is_deleted: false },
              ],
            }),
          };
        }
        return { select: vi.fn().mockResolvedValue({ data: [] }) };
      }),
    });

    const mockRpc = vi.fn().mockResolvedValue({
      data: { success: true, inserted_count: 1 },
      error: null,
    });

    (createServiceRoleClient as any).mockReturnValue({
      rpc: mockRpc,
    });

    const excelBuffer = createMockIncomeExcelBuffer([
      { MaNV: 'EMP001', HoTen: 'Nguyễn Văn A', TongThuNhap: 30000000, KhongChiuThue: 0, BaoHiem: 2000000 },
    ]);

    const makeFormData = () => {
      const fd = new FormData();
      fd.append('period', period);
      fd.append('notes', 'Lần 1');
      fd.append('file', new File([excelBuffer], 'payroll.xlsx'));
      return fd;
    };

    // Lần 1
    const res1 = await saveMonthlyPayrollAction(makeFormData());
    expect(res1.ok).toBe(true);
    expect(res1.savedCount).toBe(1);

    // Lần 2 (cùng kỳ, cùng file)
    const res2 = await saveMonthlyPayrollAction(makeFormData());
    expect(res2.ok).toBe(true);
    expect(res2.savedCount).toBe(1);

    // Cả 2 lần tổng thuế và tổng thu nhập tính toán đều hoàn toàn đồng nhất
    expect(res1.summary?.totalPitAmount).toBe(res2.summary?.totalPitAmount);
    expect(res1.summary?.totalAssessableIncome).toBe(res2.summary?.totalAssessableIncome);
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });
});
