// Test runner thuần JavaScript (Node.js) kiểm thử toàn diện Biểu 5 bậc Luật 109/2025/QH15

const PERSONAL_DEDUCTION = 15500000;
const DEPENDENT_DEDUCTION = 6200000;

const TAX_BRACKETS_5 = [
  { bracket: 1, min: 0, max: 10000000, rate: 0.05, quickDeduction: 0 },
  { bracket: 2, min: 10000000, max: 30000000, rate: 0.10, quickDeduction: 500000 },
  { bracket: 3, min: 30000000, max: 60000000, rate: 0.20, quickDeduction: 3500000 },
  { bracket: 4, min: 60000000, max: 100000000, rate: 0.30, quickDeduction: 9500000 },
  { bracket: 5, min: 100000000, max: Infinity, rate: 0.35, quickDeduction: 14500000 },
];

function calculateTaxBy5Brackets(assessableIncome) {
  const safeTNTT = Math.max(0, Math.round(Number(assessableIncome) || 0));
  let rawTax = 0;
  const breakdown = [];

  for (const b of TAX_BRACKETS_5) {
    if (safeTNTT > b.min) {
      const taxablePortion = Math.min(safeTNTT - b.min, b.max - b.min);
      const taxAmount = taxablePortion * b.rate;
      rawTax += taxAmount;
      breakdown.push({ bracket: b.bracket, rate: b.rate, taxablePortion, taxAmount });
    } else {
      breakdown.push({ bracket: b.bracket, rate: b.rate, taxablePortion: 0, taxAmount: 0 });
    }
  }

  const normalizedTax = Math.round(rawTax * 100) / 100;
  const finalPitAmount = Math.max(0, Math.floor(normalizedTax / 1000) * 1000);
  return { rawTax, finalPitAmount, breakdown };
}

function calculateTaxQuick(assessableIncome) {
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

function calculateFullPIT(totalIncome, nonTaxableIncome, insurance, dependentCount) {
  const safeTotal = Math.max(0, Math.round(Number(totalIncome) || 0));
  const safeNonTaxable = Math.max(0, Math.round(Number(nonTaxableIncome) || 0));
  const safeInsurance = Math.max(0, Math.round(Number(insurance) || 0));
  const safeDepCount = Math.max(0, Math.floor(Number(dependentCount) || 0));

  const taxableIncome = Math.max(0, safeTotal - safeNonTaxable);
  const personalDeduction = PERSONAL_DEDUCTION;
  const dependentDeduction = safeDepCount * DEPENDENT_DEDUCTION;
  const totalDeductions = safeInsurance + personalDeduction + dependentDeduction;
  const assessableIncome = Math.max(0, taxableIncome - totalDeductions);

  const { rawTax, finalPitAmount, breakdown } = calculateTaxBy5Brackets(assessableIncome);

  return {
    taxableIncome,
    totalDeductions,
    assessableIncome,
    rawTax,
    finalPitAmount,
    breakdown,
  };
}

function isDependentValidForPeriod(dependent, period) {
  if (dependent.is_inactive) return false;
  const cur = (period || '').trim();
  const from = (dependent.deduction_from || '').trim();
  const to = (dependent.deduction_to || '').trim();
  if (!from || !to) return false;
  if (cur < from) return false;
  if (cur > to) return false;
  return true;
}

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passCount++;
  } else {
    console.error(`[FAIL] ${message}`);
    failCount++;
  }
}

console.log('================================================================');
console.log('CHẠY KIỂM THỬ BỘ 18 TEST CASES - BIỂU THUẾ 5 BẬC (LUẬT 109/2025/QH15)');
console.log('================================================================\n');

// TC1
const tc1 = calculateFullPIT(30000000, 2000000, 2400000, 1);
assert(tc1.taxableIncome === 28000000, 'TC1: TNCT = 28.000.000 đ');
assert(tc1.totalDeductions === 24100000, 'TC1: Tổng giảm trừ = 24.100.000 đ (2.4tr + 15.5tr + 6.2tr)');
assert(tc1.assessableIncome === 3900000, 'TC1: TNTT = 3.900.000 đ');
assert(tc1.finalPitAmount === 195000, 'TC1: Thuế phải nộp = 195.000 đ (3.9tr x 5%)');

// TC2
const tc2 = calculateFullPIT(20000000, 5000000, 2000000, 1);
assert(tc2.assessableIncome === 0, 'TC2: TNCT <= Tổng giảm trừ -> TNTT = 0');
assert(tc2.finalPitAmount === 0, 'TC2: Thuế phải nộp = 0');

// TC3
const tc3_b = calculateTaxBy5Brackets(15000000).finalPitAmount;
const tc3_q = calculateTaxQuick(15000000);
assert(tc3_b === 1000000, 'TC3: TNTT 15tr tính từng bậc -> 1.000.000 đ (500k + 500k)');
assert(tc3_q === 1000000, 'TC3: TNTT 15tr tính nhanh (15tr x 10% - 500k) -> 1.000.000 đ');

// TC4
const tc4_b = calculateTaxBy5Brackets(120000000).finalPitAmount;
const tc4_q = calculateTaxQuick(120000000);
assert(tc4_b === 27500000, 'TC4: TNTT 120tr tính từng bậc -> 27.500.000 đ (500k + 2tr + 6tr + 12tr + 7tr)');
assert(tc4_q === 27500000, 'TC4: TNTT 120tr tính nhanh (120tr x 35% - 14.5tr) -> 27.500.000 đ');

// TC5: Các điểm ranh giới
assert(calculateTaxBy5Brackets(10000000).finalPitAmount === 500000 && calculateTaxQuick(10000000) === 500000, 'TC5: Mốc 10.000.000 đ -> 500.000 đ');
assert(calculateTaxBy5Brackets(30000000).finalPitAmount === 2500000 && calculateTaxQuick(30000000) === 2500000, 'TC5: Mốc 30.000.000 đ -> 2.500.000 đ');
assert(calculateTaxBy5Brackets(60000000).finalPitAmount === 8500000 && calculateTaxQuick(60000000) === 8500000, 'TC5: Mốc 60.000.000 đ -> 8.500.000 đ');
assert(calculateTaxBy5Brackets(100000000).finalPitAmount === 20500000 && calculateTaxQuick(100000000) === 20500000, 'TC5: Mốc 100.000.000 đ -> 20.500.000 đ');

// TC6: Làm tròn xuống nghìn
const tc6 = calculateTaxBy5Brackets(9753000);
assert(tc6.rawTax === 487650, 'TC6: Thuế thô = 487.650 đ');
assert(tc6.finalPitAmount === 487000, 'TC6: Thuế sau làm tròn xuống nghìn = 487.000 đ');

// TC7: Mốc thời gian NPT
const p = '2026-06';
assert(isDependentValidForPeriod({ is_inactive: false, deduction_from: '2026-01', deduction_to: '2026-05' }, p) === false, 'TC7: Đến = T - 1 -> false');
assert(isDependentValidForPeriod({ is_inactive: false, deduction_from: '2026-01', deduction_to: '2026-06' }, p) === true, 'TC7: Đến = T -> true');
assert(isDependentValidForPeriod({ is_inactive: false, deduction_from: '2026-06', deduction_to: '2026-12' }, p) === true, 'TC7: Từ = T -> true');
assert(isDependentValidForPeriod({ is_inactive: false, deduction_from: '2026-07', deduction_to: '2026-12' }, p) === false, 'TC7: Từ = T + 1 -> false');

// TC8: NPT ngưng sử dụng
assert(isDependentValidForPeriod({ is_inactive: true, deduction_from: '2026-01', deduction_to: '2026-12' }, p) === false, 'TC8: is_inactive = true -> false');

console.log(`\n=> KẾT QUẢ: ${passCount} PASSED / ${failCount} FAILED.`);
if (failCount > 0) process.exit(1);
