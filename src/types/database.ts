export interface Employee {
  id: string;
  employee_code: string;
  full_name: string;
  department: string | null;
  tax_code: string | null;
  id_card_number: string | null;
  is_resigned: boolean;
  is_deleted?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Dependent {
  id: string;
  employee_id: string;
  full_name: string;
  relationship: string;
  birth_date: string | null;
  tax_code: string | null;
  id_card_number: string | null;
  deduction_from: string; // 'YYYY-MM'
  deduction_to: string;   // 'YYYY-MM' (bắt buộc cả 2 mốc)
  is_inactive: boolean;
  created_at: string;
  updated_at: string;
  employees?: Employee;
}

export interface TaxPeriod {
  id: string;
  period: string; // 'YYYY-MM'
  notes: string | null;
  source_file_name?: string | null;
  source_file_sha256?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaxBreakdownBracket {
  bracket: number; // 1 to 5
  bracketName: string;
  rate: number; // e.g. 0.05
  taxablePortion: number; // Phần TNTT trong bậc này
  taxAmount: number; // Tiền thuế của bậc
}

export interface PayrollItem {
  id: string;
  period_id: string;
  employee_id: string | null;
  employee_code: string;
  full_name: string;
  tax_code: string | null;
  total_income: number;
  non_taxable_income: number;
  insurance: number;
  dependent_count: number;
  personal_deduction: number;
  dependent_deduction: number;
  total_deductions?: number;
  taxable_income: number;
  assessable_income: number;
  pit_amount: number;
  calculation_breakdown: TaxBreakdownBracket[];
  created_at: string;
  updated_at: string;
}
