import { describe, it, expect } from 'vitest';
import {
  calculateFullPIT,
  calculateTaxBy5Brackets,
  calculateTaxQuick,
  isDependentValidForPeriod,
} from '../tax-calculator';
import { Dependent } from '@/types/database';

describe('Bộ test tính thuế TNCN (VN_PIT - Luật 109/2025/QH15)', () => {
  // TC1: TongThuNhap 30.000.000, KhongChiuThue 2.000.000, BaoHiem 2.400.000, 1 NPT
  // TNCT = 28.000.000
  // Tổng giảm trừ = 2.400.000 (BH) + 15.500.000 (bản thân) + 6.200.000 (1 NPT) = 24.100.000
  // TNTT = 28.000.000 - 24.100.000 = 3.900.000
  // Thuế = 3.900.000 * 5% = 195.000
  it('TC1: Tính đầy đủ 4 bước với thu nhập 30tr, không chịu thuế 2tr, bảo hiểm 2.4tr, 1 NPT', () => {
    const result = calculateFullPIT(30000000, 2000000, 2400000, 1);

    expect(result.taxableIncome).toBe(28000000);
    expect(result.personalDeduction).toBe(15500000);
    expect(result.dependentDeduction).toBe(6200000);
    expect(result.totalDeductions).toBe(24100000);
    expect(result.assessableIncome).toBe(3900000);
    expect(result.finalPitAmount).toBe(195000);
  });

  // TC2: TNCT <= tổng giảm trừ -> thuế 0
  it('TC2: TNCT nhỏ hơn hoặc bằng tổng giảm trừ -> thuế = 0', () => {
    // Thu nhập 15.000.000, không chịu thuế 0, bản thân 15.500.000 -> TNTT = 0
    const result1 = calculateFullPIT(15000000, 0, 0, 0);
    expect(result1.taxableIncome).toBe(15000000);
    expect(result1.assessableIncome).toBe(0);
    expect(result1.finalPitAmount).toBe(0);

    // Thu nhập 20.000.000, bảo hiểm 2.5tr, 1 NPT (6.2tr) + bản thân 15.5tr = 24.2tr > 20tr
    const result2 = calculateFullPIT(20000000, 0, 2500000, 1);
    expect(result2.assessableIncome).toBe(0);
    expect(result2.finalPitAmount).toBe(0);
  });

  // TC3: TNTT 15.000.000 -> thuế 1.000.000
  // Bậc 1: 10tr * 5% = 500.000
  // Bậc 2: 5tr * 10% = 500.000
  // Tổng = 1.000.000
  it('TC3: TNTT 15.000.000 -> thuế 1.000.000', () => {
    const { finalPitAmount } = calculateTaxBy5Brackets(15000000);
    expect(finalPitAmount).toBe(1000000);

    const quickAmount = calculateTaxQuick(15000000);
    expect(quickAmount).toBe(1000000);
  });

  // TC4: TNTT 120.000.000 -> thuế 27.500.000
  // B1: 10tr * 5% = 500.000
  // B2: 20tr * 10% = 2.000.000
  // B3: 30tr * 20% = 6.000.000
  // B4: 40tr * 30% = 12.000.000
  // B5: 20tr * 35% = 7.000.000
  // Tổng = 27.500.000
  it('TC4: TNTT 120.000.000 -> thuế 27.500.000', () => {
    const { finalPitAmount } = calculateTaxBy5Brackets(120000000);
    expect(finalPitAmount).toBe(27500000);

    const quickAmount = calculateTaxQuick(120000000);
    expect(quickAmount).toBe(27500000);
  });

  // TC5: TNTT 10tr, 30tr, 60tr, 100tr -> 500.000 / 2.500.000 / 8.500.000 / 20.500.000
  // Công thức từng bậc và công thức nhanh cho cùng kết quả
  it('TC5: Đối chiếu 2 công thức tại 4 mốc ranh giới (10tr, 30tr, 60tr, 100tr)', () => {
    const testCases = [
      { tntt: 10000000, expected: 500000 },
      { tntt: 30000000, expected: 2500000 },
      { tntt: 60000000, expected: 8500000 },
      { tntt: 100000000, expected: 20500000 },
    ];

    for (const { tntt, expected } of testCases) {
      const byBrackets = calculateTaxBy5Brackets(tntt).finalPitAmount;
      const byQuick = calculateTaxQuick(tntt);

      expect(byBrackets).toBe(expected);
      expect(byQuick).toBe(expected);
      expect(byBrackets).toBe(byQuick);
    }
  });

  // TC6: TNTT 9.753.000 -> thuế thô 487.650 -> phải nộp 487.000
  it('TC6: TNTT 9.753.000 -> thuế thô 487.650 -> làm tròn xuống nghìn = 487.000', () => {
    const { rawTax, finalPitAmount } = calculateTaxBy5Brackets(9753000);
    expect(rawTax).toBe(487650);
    expect(finalPitAmount).toBe(487000);

    const quickAmount = calculateTaxQuick(9753000);
    expect(quickAmount).toBe(487000);
  });

  // TC7: NPT với Đến = T−1 (không tính), Đến = T (tính), Từ = T (tính), Từ = T+1 (không tính)
  it('TC7: Kiểm tra hiệu lực NPT theo kỳ T (2026-06)', () => {
    const period = '2026-06';

    const baseDep: Dependent = {
      id: 'dep-1',
      employee_id: 'emp-1',
      full_name: 'Nguyễn Con',
      relationship: 'Con',
      birth_date: '2015-01-01',
      tax_code: null,
      id_card_number: null,
      deduction_from: '2026-01',
      deduction_to: '2026-12',
      is_inactive: false,
      created_at: '',
      updated_at: '',
    };

    // 1. Đến = T - 1 (2026-05) -> Hết hạn -> Không tính
    const depExpired: Dependent = {
      ...baseDep,
      deduction_from: '2026-01',
      deduction_to: '2026-05',
    };
    expect(isDependentValidForPeriod(depExpired, period)).toBe(false);

    // 2. Đến = T (2026-06) -> Vẫn còn trong tháng cuối -> Được tính
    const depEndAtPeriod: Dependent = {
      ...baseDep,
      deduction_from: '2026-01',
      deduction_to: '2026-06',
    };
    expect(isDependentValidForPeriod(depEndAtPeriod, period)).toBe(true);

    // 3. Từ = T (2026-06) -> Bắt đầu tính từ tháng này -> Được tính
    const depStartAtPeriod: Dependent = {
      ...baseDep,
      deduction_from: '2026-06',
      deduction_to: '2026-12',
    };
    expect(isDependentValidForPeriod(depStartAtPeriod, period)).toBe(true);

    // 4. Từ = T + 1 (2026-07) -> Chưa đến hạn -> Không tính
    const depFuture: Dependent = {
      ...baseDep,
      deduction_from: '2026-07',
      deduction_to: '2026-12',
    };
    expect(isDependentValidForPeriod(depFuture, period)).toBe(false);

    // Phụ: Nếu is_inactive = true -> Không tính bất kể thời gian
    const depInactive: Dependent = {
      ...baseDep,
      is_inactive: true,
    };
    expect(isDependentValidForPeriod(depInactive, period)).toBe(false);
  });
});
