import { TaxBreakdownBracket, Dependent } from '@/types/database';

export const PERSONAL_DEDUCTION = 11000000; // 11 triệu đồng / tháng
export const DEPENDENT_DEDUCTION = 4400000; // 4.4 triệu đồng / người / tháng

export interface TaxCalculationResult {
  taxableIncome: number; // Thu nhập chịu thuế
  personalDeduction: number; // Giảm trừ bản thân (11tr)
  dependentDeduction: number; // Giảm trừ NPT
  totalDeductions: number; // Tổng giảm trừ = Bảo hiểm + Bản thân + NPT
  assessableIncome: number; // Thu nhập tính thuế
  pitAmount: number; // Thuế TNCN phải nộp
  calculationBreakdown: TaxBreakdownBracket[];
}

/**
 * Kiểm tra xem người phụ thuộc có hợp lệ trong kỳ tháng tính thuế không
 * @param dependent Đối tượng người phụ thuộc
 * @param period Kỳ tính thuế định dạng 'YYYY-MM'
 */
export function isDependentValidForPeriod(
  dependent: Pick<Dependent, 'is_inactive' | 'deduction_from' | 'deduction_to'>,
  period: string
): boolean {
  if (dependent.is_inactive) {
    return false;
  }

  // Format kiểm tra chuỗi YYYY-MM
  const cur = period.trim();
  const from = (dependent.deduction_from || '').trim();
  const to = (dependent.deduction_to || '').trim();

  if (!from) return false;

  // Nếu kỳ nhỏ hơn thời gian bắt đầu giảm trừ -> Không hợp lệ
  if (cur < from) {
    return false;
  }

  // Nếu có thời gian kết thúc và kỳ lớn hơn thời gian kết thúc -> Không hợp lệ
  if (to && cur > to) {
    return false;
  }

  return true;
}

/**
 * Tính toán thuế TNCN theo biểu thuế lũy tiến từng phần 7 bậc (Việt Nam)
 */
export function calculatePIT(
  totalIncome: number,
  nonTaxableIncome: number,
  insurance: number,
  dependentCount: number
): TaxCalculationResult {
  const safeTotalIncome = Math.max(0, Number(totalIncome) || 0);
  const safeNonTaxable = Math.max(0, Number(nonTaxableIncome) || 0);
  const safeInsurance = Math.max(0, Number(insurance) || 0);
  const safeDepCount = Math.max(0, Math.floor(Number(dependentCount) || 0));

  // 1. Thu nhập chịu thuế (TNCT) = Tổng thu nhập - Các khoản không chịu thuế
  const taxableIncome = Math.max(0, safeTotalIncome - safeNonTaxable);

  // 2. Các khoản giảm trừ
  const personalDeduction = PERSONAL_DEDUCTION;
  const dependentDeduction = safeDepCount * DEPENDENT_DEDUCTION;
  const totalDeductions = safeInsurance + personalDeduction + dependentDeduction;

  // 3. Thu nhập tính thuế (TNTT) = TNCT - Các khoản giảm trừ
  const assessableIncome = Math.max(0, taxableIncome - totalDeductions);

  // 4. Biểu thuế lũy tiến 7 bậc
  const brackets = [
    { bracket: 1, bracketName: 'Bậc 1: Đến 5 triệu (5%)', min: 0, max: 5000000, rate: 0.05 },
    { bracket: 2, bracketName: 'Bậc 2: Trên 5 - 10 triệu (10%)', min: 5000000, max: 10000000, rate: 0.10 },
    { bracket: 3, bracketName: 'Bậc 3: Trên 10 - 18 triệu (15%)', min: 10000000, max: 18000000, rate: 0.15 },
    { bracket: 4, bracketName: 'Bậc 4: Trên 18 - 32 triệu (20%)', min: 18000000, max: 32000000, rate: 0.20 },
    { bracket: 5, bracketName: 'Bậc 5: Trên 32 - 52 triệu (25%)', min: 32000000, max: 52000000, rate: 0.25 },
    { bracket: 6, bracketName: 'Bậc 6: Trên 52 - 80 triệu (30%)', min: 52000000, max: 80000000, rate: 0.30 },
    { bracket: 7, bracketName: 'Bậc 7: Trên 80 triệu (35%)', min: 80000000, max: Infinity, rate: 0.35 },
  ];

  const breakdown: TaxBreakdownBracket[] = [];
  let totalPit = 0;

  for (const b of brackets) {
    if (assessableIncome > b.min) {
      const taxablePortion = Math.min(assessableIncome - b.min, b.max - b.min);
      const taxAmount = Math.round(taxablePortion * b.rate);
      totalPit += taxAmount;

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

  return {
    taxableIncome,
    personalDeduction,
    dependentDeduction,
    totalDeductions,
    assessableIncome,
    pitAmount: totalPit,
    calculationBreakdown: breakdown,
  };
}

/**
 * Định dạng số tiền VNĐ dễ đọc (ví dụ: 12.500.000 đ)
 */
export function formatCurrency(amount: number): string {
  if (isNaN(amount)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN').format(Math.round(amount)) + ' ₫';
}

