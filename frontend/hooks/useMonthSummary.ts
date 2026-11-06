'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { usePeriodStore } from '@/stores/period.store';
import { toMonthKey } from '@/lib/monthParam';
import { useToast } from '@/components/ui/use-toast';

export interface SummaryItem {
  id: string; type: string; name: string; amount: number; status: string;
  dueDate: string | null; shared: boolean; memberId: string | null;
  fullAmount: number | null; sharePct: number | null; debitedFromMemberId: string | null;
}
export interface SummaryBucket { total: number; paid: number; items: SummaryItem[] }
export interface CardSplit {
  creditCardId: string; name: string; memberId: string | null; dueDate: string | null; status: string;
  statement: number; deducted: number; spending: number; needsStatementUpdate: boolean;
  /** STATEMENT = saved statement; EXPENSES = statement building now from EMIs + card expenses; CARD = figure typed on the card. */
  source?: 'STATEMENT' | 'EXPENSES' | 'CARD';
}
/** Everyday spending this month not already on the sheet: from a bank account, or a card purchase not yet on a statement. */
export interface SpentEntry {
  id: string; source: 'TRANSACTION' | 'CARD'; name: string; date: string; amount: number;
  memberId: string | null; fullAmount: number | null; sharePct: number | null;
}
export interface SummaryTotals {
  salary: number; loans: SummaryBucket; investments: SummaryBucket; bills: SummaryBucket;
  cards: CardSplit[]; cardSpending: number; left: number; free: number;
  spentSoFar: { total: number; items: SpentEntry[] };
  stillFree: number;
}
export interface MemberSummary extends SummaryTotals {
  memberId: string; name: string; color: string | null; emoji: string | null; salaryIsEstimate: boolean;
}
export interface MonthSummary {
  month: string; members: MemberSummary[]; combined: SummaryTotals;
  unassigned: { id: string; type: string; name: string; amount: number }[];
}

/** `YYYY-MM` from the header period selector (kept in the URL as `?m=`). */
export function usePeriodMonth() {
  const { month, year } = usePeriodStore();
  return toMonthKey(month, year);
}

export function useMonthSummary(month: string) {
  return useQuery({
    queryKey: ['dashboard', 'month-summary', month],
    queryFn: async () => (await api.get<{ data: MonthSummary }>('/dashboard/month-summary', { params: { month } })).data.data,
  });
}

export function useSaveSalary() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (body: { memberId: string; month: string; amount: number; accountId?: string | null }) => api.put('/dashboard/salary', body),
    // The salary is an income entry that credits a bank account, so balances and the ledger change too.
    onSuccess: () => ['dashboard', 'accounts', 'transactions'].forEach((key) => qc.invalidateQueries({ queryKey: [key] })),
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast({ title: 'Could not save salary', description: message, variant: 'destructive' });
    },
  });
}
