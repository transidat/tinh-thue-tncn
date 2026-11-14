import * as XLSX from 'xlsx';
import { PayrollItem } from '@/types/database';

export interface EmployeeImportRow {
  MaNV: string;
  HoTen: string;
  DonVi?: string;
  MaSoThue?: string;
  SoCCCD?: string;
  DaNghiViec?: boolean | string;
  rowNumber: number;
}

export interface IncomeImportRow {
  MaNV: string;
  HoTen: string;
  MaSoThue?: string;
  TongThuNhap: number;
  KhongChiuThue: number;
  BaoHiem: number;
  rowNumber: number;
}

export interface ParseExcelResult<T> {
  validRows: T[];
  errorRows: { rowNumber: number; raw: any; reason: string }[];
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
 * Tải file Excel mẫu thu nhập tháng (chuẩn cột KhongChiuThue)
 */
export function downloadIncomeTemplate() {
  const sampleData = [
    {
      MaNV: 'NV001',
      HoTen: 'Nguyễn Văn A',
      MaSoThue: '8012345678',
      TongThuNhap: 30000000,
      KhongChiuThue: 2000000,
      BaoHiem: 2400000,
    },
    {
      MaNV: 'NV002',
      HoTen: 'Trần Thị B',
      MaSoThue: '8012345679',
      TongThuNhap: 22000000,
      KhongChiuThue: 1500000,
      BaoHiem: 2310000,
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  ws['!cols'] = [
    { wch: 12 }, // MaNV
    { wch: 25 }, // HoTen
    { wch: 15 }, // MaSoThue
    { wch: 18 }, // TongThuNhap
    { wch: 18 }, // KhongChiuThue
    { wch: 18 }, // BaoHiem
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ThuNhapThang');
  XLSX.writeFile(wb, 'Mau_Thu_Nhap_Thang.xlsx');
}

/**
 * Đọc và kiểm tra file Excel danh sách nhân viên
 * - Kiểm tra thiếu Mã NV hoặc Họ tên
 * - Kiểm tra trùng Mã NV trong cùng file Excel
 */
export async function parseEmployeeExcel(file: File): Promise<ParseExcelResult<EmployeeImportRow>> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = wb.SheetNames[0];
  const worksheet = wb.Sheets[firstSheetName];
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  const tempRows: { row: EmployeeImportRow; rowNumber: number }[] = [];
  const errorRows: { rowNumber: number; raw: any; reason: string }[] = [];
  const codeOccurrences: Map<string, number[]> = new Map();

  rawRows.forEach((row, idx) => {
    const rowNumber = idx + 2; // Dòng 1 là tiêu đề
    // Giữ nguyên chuỗi dạng text và số 0 ở đầu
    const maNV = String(row['MaNV'] || row['Mã NV'] || row['Mã nhân viên'] || row['manv'] || '').trim();
    const hoTen = String(row['HoTen'] || row['Họ và tên'] || row['Họ tên'] || row['hoten'] || '').trim();
    const donVi = String(row['DonVi'] || row['Đơn vị'] || row['Phòng ban'] || row['donvi'] || '').trim();
    const maSoThue = String(row['MaSoThue'] || row['Mã số thuế'] || row['MST'] || row['masothue'] || '').trim();
    const soCCCD = String(row['SoCCCD'] || row['Số CCCD'] || row['CCCD'] || row['CMND'] || '').trim();
    const daNghi = row['DaNghiViec'] ?? row['Đã nghỉ việc'] ?? row['Nghỉ việc'] ?? false;

    // Bỏ qua dòng hoàn toàn trống
    if (!maNV && !hoTen && !donVi && !maSoThue && !soCCCD) {
      return;
    }

    if (!maNV) {
      errorRows.push({ rowNumber, raw: row, reason: 'Thiếu Mã nhân viên (bắt buộc)' });
      return;
    }

    if (!hoTen) {
      errorRows.push({ rowNumber, raw: row, reason: 'Thiếu Họ và tên nhân viên (bắt buộc)' });
      return;
    }

    const isResigned =
      typeof daNghi === 'boolean'
        ? daNghi
        : String(daNghi).trim().toLowerCase() === 'có' ||
          String(daNghi).trim().toLowerCase() === 'true' ||
          String(daNghi).trim() === '1';

    const empRow: EmployeeImportRow = {
      MaNV: maNV,
      HoTen: hoTen,
      DonVi: donVi,
      MaSoThue: maSoThue,
      SoCCCD: soCCCD,
      DaNghiViec: isResigned,
      rowNumber,
    };

    tempRows.push({ row: empRow, rowNumber });

    const key = maNV.toLowerCase();
    if (!codeOccurrences.has(key)) {
      codeOccurrences.set(key, []);
    }
    codeOccurrences.get(key)!.push(rowNumber);
  });

  // Kiểm tra trùng Mã NV trong cùng file: Nếu trùng thì báo lỗi tất cả các dòng trùng đó
  const duplicateCodes = new Set<string>();
  codeOccurrences.forEach((rows, code) => {
    if (rows.length > 1) {
      duplicateCodes.add(code);
    }
  });

  const validRows: EmployeeImportRow[] = [];

  tempRows.forEach(({ row, rowNumber }) => {
    const key = row.MaNV.toLowerCase();
    if (duplicateCodes.has(key)) {
      const otherRows = codeOccurrences.get(key)!.filter((r) => r !== rowNumber);
      errorRows.push({
        rowNumber,
        raw: row,
        reason: `Mã NV "${row.MaNV}" bị trùng lặp trong cùng file (với dòng ${otherRows.join(', ')})`,
      });
    } else {
      validRows.push(row);
    }
  });

  return { validRows, errorRows };
}

/**
 * Đọc và kiểm tra file Excel thu nhập tháng (chuẩn cột KhongChiuThue)
 * - Kiểm tra số tiền: chữ, số âm, để trống
 * - Kiểm tra KhongChiuThue > TongThuNhap
 */
export async function parseIncomeExcel(
  fileOrBuffer: File | ArrayBuffer | Buffer
): Promise<ParseExcelResult<IncomeImportRow>> {
  let buffer: ArrayBuffer | Buffer;
  if (typeof (fileOrBuffer as any).arrayBuffer === 'function') {
    buffer = await (fileOrBuffer as File).arrayBuffer();
  } else {
    buffer = fileOrBuffer as ArrayBuffer | Buffer;
  }

  const wb = XLSX.read(buffer, { type: Buffer.isBuffer(buffer) ? 'buffer' : 'array' });
  const firstSheetName = wb.SheetNames[0];
  const worksheet = wb.Sheets[firstSheetName];
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: null });

  const validRows: IncomeImportRow[] = [];
  const errorRows: { rowNumber: number; raw: any; reason: string }[] = [];

  rawRows.forEach((row, idx) => {
    const rowNumber = idx + 2;
    const maNV = String(row['MaNV'] || row['Mã NV'] || row['Mã nhân viên'] || row['manv'] || '').trim();
    const hoTen = String(row['HoTen'] || row['Họ tên'] || row['Họ và tên'] || row['hoten'] || '').trim();
    const maSoThue = String(row['MaSoThue'] || row['Mã số thuế'] || row['MST'] || row['masothue'] || '').trim();

    // Dòng trống
    if (!maNV && !hoTen && row['TongThuNhap'] == null) {
      return;
    }

    if (!maNV) {
      errorRows.push({ rowNumber, raw: row, reason: 'Thiếu Mã nhân viên' });
      return;
    }

    const rawTongTN = row['TongThuNhap'] ?? row['Tổng thu nhập'] ?? row['tongthunhap'];
    const rawKhgCT =
      row['KhongChiuThue'] ??
      row['Không chịu thuế'] ??
      row['khongchiuthue'] ??
      0;
    const rawBH = row['BaoHiem'] ?? row['Bảo hiểm'] ?? row['baohiem'] ?? 0;

    // 1. Kiểm tra để trống hoặc không phải số
    if (rawTongTN === null || rawTongTN === '' || isNaN(Number(rawTongTN))) {
      errorRows.push({ rowNumber, raw: row, reason: `Tổng thu nhập không hợp lệ ("${rawTongTN}")` });
      return;
    }
    if (rawKhgCT !== '' && rawKhgCT !== null && isNaN(Number(rawKhgCT))) {
      errorRows.push({ rowNumber, raw: row, reason: `Thu nhập không chịu thuế không hợp lệ ("${rawKhgCT}")` });
      return;
    }
    if (rawBH !== '' && rawBH !== null && isNaN(Number(rawBH))) {
      errorRows.push({ rowNumber, raw: row, reason: `Tiền bảo hiểm không hợp lệ ("${rawBH}")` });
      return;
    }

    const tongThuNhap = Number(rawTongTN);
    const khongChiuThue = Number(rawKhgCT || 0);
    const baoHiem = Number(rawBH || 0);

    // 2. Kiểm tra số âm
    if (tongThuNhap < 0) {
      errorRows.push({ rowNumber, raw: row, reason: 'Tổng thu nhập không được là số âm' });
      return;
    }
    if (khongChiuThue < 0) {
      errorRows.push({ rowNumber, raw: row, reason: 'Thu nhập không chịu thuế không được là số âm' });
      return;
    }
    if (baoHiem < 0) {
      errorRows.push({ rowNumber, raw: row, reason: 'Tiền bảo hiểm không được là số âm' });
      return;
    }

    // 3. Kiểm tra KhongChiuThue > TongThuNhap
    if (khongChiuThue > tongThuNhap) {
      errorRows.push({
        rowNumber,
        raw: row,
        reason: `Thu nhập không chịu thuế (${khongChiuThue.toLocaleString('vi-VN')} đ) lớn hơn Tổng thu nhập (${tongThuNhap.toLocaleString('vi-VN')} đ)`,
      });
      return;
    }

    validRows.push({
      MaNV: maNV,
      HoTen: hoTen,
      MaSoThue: maSoThue,
      TongThuNhap: Math.round(tongThuNhap),
      KhongChiuThue: Math.round(khongChiuThue),
      BaoHiem: Math.round(baoHiem),
      rowNumber,
    });
  });

  return { validRows, errorRows };
}

/**
 * Xuất bảng thuế tháng ra file Excel chuẩn
 */
export function exportTaxPayrollToExcel(period: string, items: PayrollItem[]) {
  const rows = items.map((item, index) => ({
    STT: index + 1,
    'Mã NV': item.employee_code,
    'Họ và tên': item.full_name,
    'Mã số thuế': item.tax_code || '',
    'Tổng thu nhập (VND)': Math.round(item.total_income),
    'Không chịu thuế (VND)': Math.round(item.non_taxable_income),
    'Bảo hiểm (VND)': Math.round(item.insurance),
    'Số NPT': item.dependent_count,
    'Giảm trừ bản thân (VND)': Math.round(item.personal_deduction),
    'Giảm trừ NPT (VND)': Math.round(item.dependent_deduction),
    'Thu nhập chịu thuế (VND)': Math.round(item.taxable_income),
    'Thu nhập tính thuế (VND)': Math.round(item.assessable_income),
    'Thuế TNCN phải nộp (VND)': Math.round(item.pit_amount),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 6 },  // STT
    { wch: 12 }, // Mã NV
    { wch: 25 }, // Họ tên
    { wch: 15 }, // MST
    { wch: 22 }, // Tổng TN
    { wch: 22 }, // Không chịu thuế
    { wch: 18 }, // Bảo hiểm
    { wch: 10 }, // Số NPT
    { wch: 22 }, // GT Bản thân
    { wch: 22 }, // GT NPT
    { wch: 24 }, // TN Chịu thuế
    { wch: 24 }, // TN Tính thuế
    { wch: 24 }, // Thuế TNCN
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Thue_${period}`);
  XLSX.writeFile(wb, `Bang_Thue_TNCN_${period}.xlsx`);
}
