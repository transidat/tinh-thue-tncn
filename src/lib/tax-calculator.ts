import { Dependent } from '@/types/database';
export * from '@/config/tax-rules';
import {
  calculateFullPIT,
  formatCurrencyVND,
  TaxCalculationDetailResult,
} from '@/config/tax-rules';

/**
 * Kiểm tra xem người phụ thuộc có hợp lệ trong kỳ tháng tính thuế không
 * Điều kiện:
 * 1. Không bị đánh dấu "Không còn sử dụng" (is_inactive === false)
 * 2. Bắt buộc cả 2 mốc deduction_from và deduction_to
 * 3. deduction_from <= period <= deduction_to
 */
export function isDependentValidForPeriod(
  dependent: Pick<Dependent, 'is_inactive' | 'deduction_from' | 'deduction_to'>,
  period: string
): boolean {
  if (dependent.is_inactive) {
    return false;
  }

  const cur = (period || '').trim();
  const from = (dependent.deduction_from || '').trim();
  const to = (dependent.deduction_to || '').trim();

  // Bắt buộc cả 2 mốc thời gian
  if (!from || !to) return false;

  // Nếu kỳ nhỏ hơn mốc bắt đầu
  if (cur < from) {
    return false;
  }

  // Nếu kỳ lớn hơn mốc kết thúc
  if (cur > to) {
    return false;
  }

  return true;
}

/**
 * Hàm tương thích ngược với code cũ, gọi sang calculateFullPIT
 */
export function calculatePIT(
  totalIncome: number,
  nonTaxableIncome: number,
  insurance: number,
  dependentCount: number
): {
  taxableIncome: number;
  personalDeduction: number;
  dependentDeduction: number;
  totalDeductions: number;
  assessableIncome: number;
  pitAmount: number;
  rawTax: number;
  calculationBreakdown: any[];
} {
  const result: TaxCalculationDetailResult = calculateFullPIT(
    totalIncome,
    nonTaxableIncome,
    insurance,
    dependentCount
  );

  return {
    taxableIncome: result.taxableIncome,
    personalDeduction: result.personalDeduction,
    dependentDeduction: result.dependentDeduction,
    totalDeductions: result.totalDeductions,
    assessableIncome: result.assessableIncome,
    pitAmount: result.finalPitAmount,
    rawTax: result.rawTax,
    calculationBreakdown: result.breakdown,
  };
}

export const formatCurrency = formatCurrencyVND;
