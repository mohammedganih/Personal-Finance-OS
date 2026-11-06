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

export interface CardRow {
  id: string; cardName: string; bank: string | null; lastFourDigits: string | null;
  memberId: string | null; bankAccountId: string | null; creditLimit: number;
  statementDue: { amount: number; dueDate: string; month: string; overdue: boolean } | null;
  buildingNow: { amount: number; dueDate: string };
  emiCount: number; emiStillToBill: number; available: number;
}
export interface CardRegister {
  totals: { statementDue: number; nextDueDate: string | null; buildingNow: number; available: number };
  cards: CardRow[];
}

export function useCardRegister() {
  return useQuery({
    queryKey: ['credit-cards', 'register'],
    queryFn: async () => (await api.get<{ data: CardRegister }>('/registers/cards')).data.data,
  });
}

export interface BillRow {
  id: string; name: string; vendor: string | null; category: string; frequency: string;
  amount: number; monthlyEquivalent: number; setAsidePerMonth: number | null;
  status: 'ACTIVE' | 'PAUSED'; autoDebit: boolean; payerMemberId: string | null;
  paidFrom: { kind: 'ACCOUNT' | 'CARD'; id: string; name: string } | null;
  subscription: boolean; utility: boolean; yearly: boolean;
  next: DueRow | null;
}
export interface BillRegister {
  totals: { monthlyTotal: number; dueThisMonthLeft: number; yearlyCosts: number; yearlySetAside: number };
  bills: BillRow[];
}

export function useBillRegister() {
  return useQuery({
    queryKey: ['bills', 'register'],
    queryFn: async () => (await api.get<{ data: BillRegister }>('/registers/bills')).data.data,
  });
}

export interface HoldingRow {
  id: string; name: string; assetType: string; platform: string | null;
  value: number; invested: number; monthly: number | null;
  memberId: string | null; split: { memberId: string; pct: number } | null;
  maturityDate: string | null; maturityAmount: number | null; maturityBonus: number | null;
  recurring: boolean; autoDebit: boolean; bankAccountId: string | null;
  next: DueRow | null;
}
export interface InvestmentRegister {
  totals: { totalValue: number; addedThisMonth: number; nextMaturity: { name: string; date: string; amount: number | null } | null };
  holdings: HoldingRow[];
}

export function useInvestmentRegister() {
  return useQuery({
    queryKey: ['investments', 'register'],
    queryFn: async () => (await api.get<{ data: InvestmentRegister }>('/registers/investments')).data.data,
  });
}
