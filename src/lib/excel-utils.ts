import * as XLSX from 'xlsx';
import { PayrollItem } from '@/types/database';

export interface EmployeeImportRow {
  MaNV: string;
  HoTen: string;
  DonVi?: string;
  MaSoThue?: string;
  SoCCCD?: string;
  DaNghiViec?: boolean | string;
}

export interface IncomeImportRow {
  MaNV: string;
  HoTen: string;
  MaSoThue?: string;
  TongThuNhap: number;
  KhgChiuThue: number;
  BaoHiem: number;
}

/**
 * Tải file Excel mẫu danh sách nhân viên
 */
export function downloadEmployeeTemplate() {
  const sampleData = [
    {
      MaNV: 'NV001',
      HoTen: 'Nguyễn Văn A',
      DonVi: 'Phòng Kế toán',
      MaSoThue: '8012345678',
      SoCCCD: '001090123456',
      DaNghiViec: 'Không',
    },
    {
      MaNV: 'NV002',
      HoTen: 'Trần Thị B',
      DonVi: 'Phòng Kinh doanh',
      MaSoThue: '8012345679',
      SoCCCD: '001192654321',
      DaNghiViec: 'Không',
    },
    {
      MaNV: 'NV003',
      HoTen: 'Lê Văn C',
      DonVi: 'Phòng Kỹ thuật',
      MaSoThue: '8012345680',
      SoCCCD: '001088789123',
      DaNghiViec: 'Có',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  // Đặt độ rộng các cột
  ws['!cols'] = [
    { wch: 12 }, // MaNV
    { wch: 25 }, // HoTen
    { wch: 20 }, // DonVi
    { wch: 15 }, // MaSoThue
    { wch: 18 }, // SoCCCD
    { wch: 14 }, // DaNghiViec
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DanhSachNhanVien');
  XLSX.writeFile(wb, 'Mau_Danh_Sach_Nhan_Vien.xlsx');
}

/**
 * Tải file Excel mẫu thu nhập tháng
 */
export function downloadIncomeTemplate() {
  const sampleData = [
    {
      MaNV: 'NV001',
      HoTen: 'Nguyễn Văn A',
      MaSoThue: '8012345678',
      TongThuNhap: 25000000,
      KhgChiuThue: 1500000,
      BaoHiem: 2625000,
    },
    {
      MaNV: 'NV002',
      HoTen: 'Trần Thị B',
      MaSoThue: '8012345679',
      TongThuNhap: 18000000,
      KhgChiuThue: 1000000,
      BaoHiem: 1890000,
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  ws['!cols'] = [
    { wch: 12 }, // MaNV
    { wch: 25 }, // HoTen
    { wch: 15 }, // MaSoThue
    { wch: 16 }, // TongThuNhap
    { wch: 16 }, // KhgChiuThue
    { wch: 16 }, // BaoHiem
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ThuNhapThang');
  XLSX.writeFile(wb, 'Mau_Thu_Nhap_Thang.xlsx');
}

/**
 * Đọc file Excel danh sách nhân viên
 */
export async function parseEmployeeExcel(file: File): Promise<EmployeeImportRow[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = wb.SheetNames[0];
  const worksheet = wb.Sheets[firstSheetName];
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  const cleanedRows: EmployeeImportRow[] = [];

  for (const row of rawRows) {
    // Tìm các trường dựa trên tên cột linh hoạt (hỗ trợ cả có dấu và không dấu)
    const maNV = String(row['MaNV'] || row['Mã NV'] || row['Mã nhân viên'] || row['manv'] || '').trim();
    const hoTen = String(row['HoTen'] || row['Họ và tên'] || row['Họ tên'] || row['hoten'] || '').trim();
    const donVi = String(row['DonVi'] || row['Đơn vị'] || row['Phòng ban'] || row['donvi'] || '').trim();
    const maSoThue = String(row['MaSoThue'] || row['Mã số thuế'] || row['MST'] || row['masothue'] || '').trim();
    const soCCCD = String(row['SoCCCD'] || row['Số CCCD'] || row['CCCD'] || row['CMND'] || '').trim();
    const daNghi = row['DaNghiViec'] ?? row['Đã nghỉ việc'] ?? row['Nghỉ việc'] ?? false;

    if (!maNV || !hoTen) {
      continue; // Bỏ qua dòng trống hoặc thiếu mã/họ tên
    }

    const isResigned =
      typeof daNghi === 'boolean'
        ? daNghi
        : String(daNghi).trim().toLowerCase() === 'có' ||
          String(daNghi).trim().toLowerCase() === 'true' ||
          String(daNghi).trim() === '1';

    cleanedRows.push({
      MaNV: maNV,
      HoTen: hoTen,
      DonVi: donVi,
      MaSoThue: maSoThue,
      SoCCCD: soCCCD,
      DaNghiViec: isResigned,
    });
  }

  return cleanedRows;
}

/**
 * Đọc file Excel thu nhập tháng
 */
export async function parseIncomeExcel(file: File): Promise<IncomeImportRow[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = wb.SheetNames[0];
  const worksheet = wb.Sheets[firstSheetName];
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: 0 });

  const cleanedRows: IncomeImportRow[] = [];

  for (const row of rawRows) {
    const maNV = String(row['MaNV'] || row['Mã NV'] || row['Mã nhân viên'] || row['manv'] || '').trim();
    const hoTen = String(row['HoTen'] || row['Họ tên'] || row['Họ và tên'] || row['hoten'] || '').trim();
    const maSoThue = String(row['MaSoThue'] || row['Mã số thuế'] || row['MST'] || row['masothue'] || '').trim();

    if (!maNV) continue;

    const tongThuNhap = Number(row['TongThuNhap'] ?? row['Tổng thu nhập'] ?? row['tongthunhap'] ?? 0);
    const khgChiuThue = Number(row['KhgChiuThue'] ?? row['Không chịu thuế'] ?? row['khgchiuthue'] ?? 0);
    const baoHiem = Number(row['BaoHiem'] ?? row['Bảo hiểm'] ?? row['baohiem'] ?? 0);

    cleanedRows.push({
      MaNV: maNV,
      HoTen: hoTen,
      MaSoThue: maSoThue,
      TongThuNhap: isNaN(tongThuNhap) ? 0 : tongThuNhap,
      KhgChiuThue: isNaN(khgChiuThue) ? 0 : khgChiuThue,
      BaoHiem: isNaN(baoHiem) ? 0 : baoHiem,
    });
  }

  return cleanedRows;
}

/**
 * Xuất bảng thuế tháng ra file Excel
 */
export function exportTaxPayrollToExcel(period: string, items: PayrollItem[]) {
  const rows = items.map((item, index) => ({
    STT: index + 1,
    'Mã NV': item.employee_code,
    'Họ và tên': item.full_name,
    'Mã số thuế': item.tax_code || '',
    'Tổng thu nhập (VNĐ)': item.total_income,
    'Không chịu thuế (VNĐ)': item.non_taxable_income,
    'Bảo hiểm (VNĐ)': item.insurance,
    'Số NPT': item.dependent_count,
    'Giảm trừ bản thân (VNĐ)': item.personal_deduction,
    'Giảm trừ NPT (VNĐ)': item.dependent_deduction,
    'Thu nhập chịu thuế (VNĐ)': item.taxable_income,
    'Thu nhập tính thuế (VNĐ)': item.assessable_income,
    'Thuế TNCN phải nộp (VNĐ)': item.pit_amount,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 6 },  // STT
    { wch: 12 }, // Mã NV
    { wch: 25 }, // Họ tên
    { wch: 15 }, // MST
    { wch: 20 }, // Tổng TN
    { wch: 20 }, // Không chịu thuế
    { wch: 16 }, // Bảo hiểm
    { wch: 10 }, // Số NPT
    { wch: 20 }, // GT Bản thân
    { wch: 20 }, // GT NPT
    { wch: 22 }, // TN Chịu thuế
    { wch: 22 }, // TN Tính thuế
    { wch: 22 }, // Thuế TNCN
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Thue_${period}`);
  XLSX.writeFile(wb, `Bang_Thue_TNCN_${period}.xlsx`);
}

