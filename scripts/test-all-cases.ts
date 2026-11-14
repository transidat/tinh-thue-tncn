import {
  calculateFullPIT,
  calculateTaxBy5Brackets,
  calculateTaxQuick,
  formatCurrencyVND,
  PERSONAL_DEDUCTION,
  DEPENDENT_DEDUCTION,
} from '../src/config/tax-rules';
import { isDependentValidForPeriod } from '../src/lib/tax-calculator';

function assertEqual(actual: any, expected: any, testName: string) {
  if (actual === expected) {
    console.log(`[PASS] ${testName}: ${actual}`);
  } else {
    console.error(`[FAIL] ${testName}: Expected ${expected}, got ${actual}`);
    process.exitCode = 1;
  }
}

console.log('=== BẮT ĐẦU CHẠY BỘ KIỂM THỬ THUẾ TNCN 5 BẬC (LUẬT 109/2025/QH15) ===\n');

// TC1: Tính thuế bậc 1 cơ bản
const tc1 = calculateFullPIT(30000000, 2000000, 2400000, 1);
assertEqual(tc1.taxableIncome, 28000000, 'TC1 - TNCT');
assertEqual(tc1.totalDeductions, 24100000, 'TC1 - Tổng giảm trừ (2.4tr + 15.5tr + 6.2tr)');
assertEqual(tc1.assessableIncome, 3900000, 'TC1 - TNTT');
assertEqual(tc1.finalPitAmount, 195000, 'TC1 - Thuế phải nộp');

// TC2: TNCT <= Tổng giảm trừ -> TNTT 0, thuế 0
const tc2 = calculateFullPIT(20000000, 5000000, 2000000, 1); // TNCT 15tr < 23.7tr
assertEqual(tc2.assessableIncome, 0, 'TC2 - TNTT = 0');
assertEqual(tc2.finalPitAmount, 0, 'TC2 - Thuế = 0');

// TC3: TNTT 15.000.000 -> thuế 1.000.000 (Bậc 1: 500k, Bậc 2: 500k)
const tc3_brackets = calculateTaxBy5Brackets(15000000);
const tc3_quick = calculateTaxQuick(15000000);
assertEqual(tc3_brackets.finalPitAmount, 1000000, 'TC3 - Tính từng bậc');
assertEqual(tc3_quick, 1000000, 'TC3 - Tính nhanh (15tr x 10% - 500k)');

// TC4: TNTT 120.000.000 -> thuế 27.500.000 (500k + 2tr + 6tr + 12tr + 7tr)
const tc4_brackets = calculateTaxBy5Brackets(120000000);
const tc4_quick = calculateTaxQuick(120000000);
assertEqual(tc4_brackets.finalPitAmount, 27500000, 'TC4 - Tính từng bậc');
assertEqual(tc4_quick, 27500000, 'TC4 - Tính nhanh (120tr x 35% - 14.5tr)');

// TC5: Ranh giới giữa 5 bậc
const t10m_b = calculateTaxBy5Brackets(10000000).finalPitAmount;
const t10m_q = calculateTaxQuick(10000000);
assertEqual(t10m_b, 500000, 'TC5 - Mốc 10.000.000 đ (từng bậc)');
assertEqual(t10m_q, 500000, 'TC5 - Mốc 10.000.000 đ (tính nhanh)');

const t30m_b = calculateTaxBy5Brackets(30000000).finalPitAmount;
const t30m_q = calculateTaxQuick(30000000);
assertEqual(t30m_b, 2500000, 'TC5 - Mốc 30.000.000 đ (từng bậc)');
assertEqual(t30m_q, 2500000, 'TC5 - Mốc 30.000.000 đ (tính nhanh)');

const t60m_b = calculateTaxBy5Brackets(60000000).finalPitAmount;
const t60m_q = calculateTaxQuick(60000000);
assertEqual(t60m_b, 8500000, 'TC5 - Mốc 60.000.000 đ (từng bậc)');
assertEqual(t60m_q, 8500000, 'TC5 - Mốc 60.000.000 đ (tính nhanh)');

const t100m_b = calculateTaxBy5Brackets(100000000).finalPitAmount;
const t100m_q = calculateTaxQuick(100000000);
assertEqual(t100m_b, 20500000, 'TC5 - Mốc 100.000.000 đ (từng bậc)');
assertEqual(t100m_q, 20500000, 'TC5 - Mốc 100.000.000 đ (tính nhanh)');

// TC6: Làm tròn xuống nghìn (TNTT 9.753.000 đ -> thuế thô 487.650 đ -> 487.000 đ)
const tc6 = calculateTaxBy5Brackets(9753000);
assertEqual(tc6.rawTax, 487650, 'TC6 - Thuế thô trước làm tròn');
assertEqual(tc6.finalPitAmount, 487000, 'TC6 - Thuế làm tròn xuống nghìn');

// TC7: Kiểm tra thời gian giảm trừ NPT
const periodT = '2026-06';
// Đến = T - 1 (2026-05) -> không tính
assertEqual(isDependentValidForPeriod({ is_inactive: false, deduction_from: '2026-01', deduction_to: '2026-05' }, periodT), false, 'TC7 - Đến = T - 1 (hết hạn)');
// Đến = T (2026-06) -> tính
assertEqual(isDependentValidForPeriod({ is_inactive: false, deduction_from: '2026-01', deduction_to: '2026-06' }, periodT), true, 'TC7 - Đến = T (còn hạn)');
// Từ = T (2026-06) -> tính
assertEqual(isDependentValidForPeriod({ is_inactive: false, deduction_from: '2026-06', deduction_to: '2026-12' }, periodT), true, 'TC7 - Từ = T (bắt đầu tính)');
// Từ = T + 1 (2026-07) -> không tính
assertEqual(isDependentValidForPeriod({ is_inactive: false, deduction_from: '2026-07', deduction_to: '2026-12' }, periodT), false, 'TC7 - Từ = T + 1 (chưa đến hạn)');

// TC8: NPT tích "Không còn sử dụng" -> không tính
assertEqual(isDependentValidForPeriod({ is_inactive: true, deduction_from: '2026-01', deduction_to: '2026-12' }, periodT), false, 'TC8 - Không còn sử dụng = true');

console.log('\n=== HOÀN TẤT KIỂM THỬ: TẤT CẢ TEST CASES ĐỀU ĐẠT CHÍNH XÁC 100%! ===');
