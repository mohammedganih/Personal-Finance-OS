'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { usePeriodStore } from '@/stores/period.store';
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
export interface SummaryTotals {
  salary: number; loans: SummaryBucket; investments: SummaryBucket; bills: SummaryBucket;
  cards: CardSplit[]; cardSpending: number; left: number; free: number;
}
export interface MemberSummary extends SummaryTotals {
  memberId: string; name: string; color: string | null; emoji: string | null; salaryIsEstimate: boolean;
}
export interface MonthSummary {
  month: string; members: MemberSummary[]; combined: SummaryTotals;
  unassigned: { id: string; type: string; name: string; amount: number }[];
}

/** `YYYY-MM` from the header period selector. */
export function usePeriodMonth() {
  const { month, year } = usePeriodStore();
  return `${year}-${String(month).padStart(2, '0')}`;
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
    mutationFn: (body: { memberId: string; month: string; amount: number }) => api.put('/dashboard/salary', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard'] }),
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast({ title: 'Could not save salary', description: message, variant: 'destructive' });
    },
  });
}
