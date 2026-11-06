'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { MonthlyPaymentRow } from '@/hooks/useMonthlyPlan';

// Registers: one read per page. Each lives under its domain's query key, so
// the existing create / edit / delete / pay hooks refresh it.

/** An instalment as the shared payment buttons take it, with the month it belongs to. */
export type DueRow = MonthlyPaymentRow & { period: string };

export interface LoanRow {
  id: string; name: string; loanType: string; lender: string | null; isActive: boolean;
  borrowerMemberId: string | null; payerMemberId: string | null; debitedFromMemberId: string | null;
  bankAccountId: string | null; autoDebit: boolean;
  emi: number; interestRate: number; principal: number; left: number;
  amortisation: { monthsLeft: number | null; endsMonth: string | null; interestLeft: number | null; repaidSoFar: number };
  closedMonth: string | null;
  next: DueRow | null;
}
export interface LoanRegister {
  totals: { totalLeft: number; monthlyEmis: number; debtFreeMonth: string | null; debtFreeName: string | null };
  loans: LoanRow[];
  closed: LoanRow[];
}

export function useLoanRegister() {
  return useQuery({
    queryKey: ['loans', 'register'],
    queryFn: async () => (await api.get<{ data: LoanRegister }>('/registers/loans')).data.data,
  });
}
