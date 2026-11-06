'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';

export type MonthlyPaymentRow = { id: string; type: string; name: string; amount: number; status: string; accountId?: string | null; dueDate?: string; creditCardId?: string; memberId?: string | null; shared?: boolean; paidAmount?: number; remaining?: number; split?: { memberId: string; pct: number }; statementId?: string };
export type MonthlyPlan = { month: string; rows: MonthlyPaymentRow[]; scheduled: number; paid: number; skipped: number; remaining: number; loans: number; creditCards: number; investments: number; bills: number };
/** The plan for `month` (YYYY-MM, default this month) with the months either side. */
export function useMonthlyPlan(month?: string) {
  return useQuery({
    queryKey: ['dashboard', 'monthly-plan', month ?? 'current'],
    queryFn: async () => (await api.get<{ data: { current: MonthlyPlan; next: MonthlyPlan; previous?: MonthlyPlan } }>('/dashboard/monthly-plan', { params: month ? { month } : undefined })).data.data,
  });
}

export type UndoTarget = { type: string; id: string; month?: string; dueDate?: string | null };
export const UNDOABLE_TYPES = ['LOAN', 'INVESTMENT', 'CARD_EMI', 'CREDIT_CARD', 'BILL'];

/** Reverses a recorded paid/skipped instalment (POST /dashboard/monthly-payment/undo). */
export function useUndoPayment() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ type, id, month, dueDate }: UndoTarget) =>
      api.post('/dashboard/monthly-payment/undo', { type, id, month, dueDate: type === 'BILL' ? dueDate ?? undefined : undefined }),
    onSuccess: () => { qc.invalidateQueries(); toast({ title: 'Payment undone' }); },
    onError: (error: unknown) => {
      const e = error as { response?: { data?: { message?: string } } };
      toast({ title: 'Could not undo', description: e.response?.data?.message, variant: 'destructive' });
    },
  });
}
