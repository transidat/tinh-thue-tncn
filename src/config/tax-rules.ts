// =====================================================================
// FILE CẤU HÌNH THAM SỐ THUẾ TNCN DUY NHẤT CỦA HỆ THỐNG
// Căn cứ pháp lý: Luật Thuế Thu nhập cá nhân 2025 (Luật số 109/2025/QH15)
// Áp dụng cho kỳ tính thuế từ năm 2026
// =====================================================================

export interface TaxBracketConfig {
  bracket: number;
  bracketName: string;
  min: number;
  max: number;
  rate: number;
  quickDeduction: number;
}

// 1. Mức giảm trừ gia cảnh
export const PERSONAL_DEDUCTION = 15500000; // 15.500.000 ₫/tháng (186 triệu ₫/năm)
export const DEPENDENT_DEDUCTION = 6200000;  // 6.200.000 ₫/người/tháng (74.4 triệu ₫/năm)

// 2. Biểu thuế lũy tiến từng phần 5 bậc (Luật 109/2025/QH15)
export const TAX_BRACKETS_5: TaxBracketConfig[] = [
  {
    bracket: 1,
    bracketName: 'Bậc 1: Đến 10 triệu (5%)',
    min: 0,
    max: 10000000,
    rate: 0.05,
    quickDeduction: 0,
  },
  {
    bracket: 2,
    bracketName: 'Bậc 2: Trên 10 - 30 triệu (10%)',
    min: 10000000,
    max: 30000000,
    rate: 0.10,
    quickDeduction: 500000,
  },
  {
    bracket: 3,
    bracketName: 'Bậc 3: Trên 30 - 60 triệu (20%)',
    min: 30000000,
    max: 60000000,
    rate: 0.20,
    quickDeduction: 3500000,
  },
  {
    bracket: 4,
    bracketName: 'Bậc 4: Trên 60 - 100 triệu (30%)',
    min: 60000000,
    max: 100000000,
    rate: 0.30,
    quickDeduction: 9500000,
  },
  {
    bracket: 5,
    bracketName: 'Bậc 5: Trên 100 triệu (35%)',
    min: 100000000,
    max: Infinity,
    rate: 0.35,
    quickDeduction: 14500000,
  },
];

export interface TaxBracketDetail {
  bracket: number;
  bracketName: string;
  rate: number;
  taxablePortion: number; // Phần TNTT rơi vào bậc này
  taxAmount: number; // Tiền thuế của bậc (chưa làm tròn)
}

export interface TaxCalculationDetailResult {
  taxableIncome: number; // Bước 1: Thu nhập chịu thuế
  insurance: number; // Bảo hiểm bắt buộc
  personalDeduction: number; // Giảm trừ bản thân (15.5tr)
  dependentDeduction: number; // Giảm trừ NPT (count * 6.2tr)
  totalDeductions: number; // Bước 2: Tổng các khoản giảm trừ
  assessableIncome: number; // Bước 3: Thu nhập tính thuế
  rawTax: number; // Tổng thuế lũy tiến trước làm tròn
  finalPitAmount: number; // Bước 4: Tiền thuế phải nộp (sau khi làm tròn xuống nghìn)
  breakdown: TaxBracketDetail[];
}

/**
 * Tính thuế lũy tiến từng phần theo 5 bậc của Luật 109/2025/QH15
 * @param assessableIncome Thu nhập tính thuế (TNTT)
 */
export function calculateTaxBy5Brackets(assessableIncome: number): {
  rawTax: number;
  finalPitAmount: number;
  breakdown: TaxBracketDetail[];
} {
  const safeTNTT = Math.max(0, Math.round(Number(assessableIncome) || 0));
  const breakdown: TaxBracketDetail[] = [];
  let rawTax = 0;

  for (const b of TAX_BRACKETS_5) {
    if (safeTNTT > b.min) {
      const taxablePortion = Math.min(safeTNTT - b.min, b.max - b.min);
      const taxAmount = taxablePortion * b.rate; // Không làm tròn từng bậc
      rawTax += taxAmount;

      breakdown.push({
        bracket: b.bracket,
        bracketName: b.bracketName,
        rate: b.rate,
        taxablePortion,
        taxAmount,
      });
    } else {
      breakdown.push({
        bracket: b.bracket,
        bracketName: b.bracketName,
        rate: b.rate,
        taxablePortion: 0,
        taxAmount: 0,
      });
    }
  }

  // Xử lý sai số số thực về 2 chữ số thập phân TRƯỚC khi floor xuống nghìn
  const normalizedTax = Math.round(rawTax * 100) / 100;
  const finalPitAmount = Math.max(0, Math.floor(normalizedTax / 1000) * 1000);

  return {
    rawTax,
    finalPitAmount,
    breakdown,
  };
}

/**
 * Tính thuế nhanh theo công thức bậc (dùng để đối soát với cách tính từng bậc)
 */
export function calculateTaxQuick(assessableIncome: number): number {
  const safeTNTT = Math.max(0, Math.round(Number(assessableIncome) || 0));
  if (safeTNTT <= 0) return 0;

  let rawTax = 0;
  if (safeTNTT <= 10000000) {
    rawTax = safeTNTT * 0.05;
  } else if (safeTNTT <= 30000000) {
    rawTax = safeTNTT * 0.10 - 500000;
  } else if (safeTNTT <= 60000000) {
    rawTax = safeTNTT * 0.20 - 3500000;
  } else if (safeTNTT <= 100000000) {
    rawTax = safeTNTT * 0.30 - 9500000;
  } else {
    rawTax = safeTNTT * 0.35 - 14500000;
  }

  const normalizedTax = Math.round(rawTax * 100) / 100;
  return Math.max(0, Math.floor(normalizedTax / 1000) * 1000);
}

/**
 * Tính toàn bộ 4 bước Thuế TNCN cho 1 người lao động trong tháng
 */
export function calculateFullPIT(
  totalIncome: number,
  nonTaxableIncome: number,
  insurance: number,
  dependentCount: number
): TaxCalculationDetailResult {
  const safeTotal = Math.max(0, Math.round(Number(totalIncome) || 0));
  const safeNonTaxable = Math.max(0, Math.round(Number(nonTaxableIncome) || 0));
  const safeInsurance = Math.max(0, Math.round(Number(insurance) || 0));
  const safeDepCount = Math.max(0, Math.floor(Number(dependentCount) || 0));

  // Bước 1: Thu nhập chịu thuế (TNCT) = Tổng thu nhập - Thu nhập không chịu thuế
  // (Tuyệt đối không trừ bảo hiểm ở bước này)
  const taxableIncome = Math.max(0, safeTotal - safeNonTaxable);

  // Bước 2: Tổng các khoản giảm trừ = Bảo hiểm + Bản thân (15.5tr) + NPT (count * 6.2tr)
  const personalDeduction = PERSONAL_DEDUCTION;
  const dependentDeduction = safeDepCount * DEPENDENT_DEDUCTION;
  const totalDeductions = safeInsurance + personalDeduction + dependentDeduction;

  // Bước 3: Thu nhập tính thuế (TNTT) = max(0, TNCT - Tổng giảm trừ)
  const assessableIncome = Math.max(0, taxableIncome - totalDeductions);

  // Bước 4: Tính thuế theo biểu 5 bậc và làm tròn xuống nghìn
  const { rawTax, finalPitAmount, breakdown } = calculateTaxBy5Brackets(assessableIncome);

  return {
    taxableIncome,
    insurance: safeInsurance,
    personalDeduction,
    dependentDeduction,
    totalDeductions,
    assessableIncome,
    rawTax,
    finalPitAmount,
    breakdown,
  };
}

/**
 * Định dạng số tiền VND chuẩn có dấu chấm phân cách hàng nghìn (ví dụ: 15.000.000 ₫)
 */
export function formatCurrencyVND(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return '0 ₫';
  const rounded = Math.round(amount);
  return new Intl.NumberFormat('vi-VN').format(rounded) + ' ₫';
}
