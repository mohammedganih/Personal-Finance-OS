'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

export type HistoryType = 'LOAN' | 'INVESTMENT' | 'CARD_EMI' | 'CREDIT_CARD' | 'BILL';
export interface HistoryEntry {
  key: string; kind: 'PAID' | 'AUTO' | 'SKIPPED' | 'PREPAYMENT' | 'RATE_CHANGE' | 'CLOSED';
  month: string | null; dueDate: string | null; date: string; amount: number | null;
  canUndo: boolean; eventId?: string; note?: string | null;
}
export interface Reminder {
  key: string; kind: 'OVERDUE' | 'DUE_SOON' | 'MATURITY'; type: string; id: string; name: string;
  amount: number | null; dueDate: string; daysLeft: number; memberId: string | null; href: string;
}

type ApiError = { response?: { data?: { message?: string } } };
const message = (e: unknown) => (e as ApiError).response?.data?.message;

export function usePaymentHistory(type: HistoryType, id: string, enabled = true) {
  return useQuery({
    queryKey: ['dashboard', 'payment-history', type, id],
    queryFn: async () => (await api.get<{ data: HistoryEntry[] }>('/dashboard/payment-history', { params: { type, id } })).data.data,
    enabled,
  });
}

/** EMIs, SIPs and card bills due soon or overdue, bill reminders and maturities. */
export function useReminders() {
  return useQuery({
    queryKey: ['dashboard', 'reminders'],
    queryFn: async () => (await api.get<{ data: Reminder[] }>('/dashboard/reminders')).data.data,
    refetchInterval: 5 * 60_000,
  });
}

function useLoanMutation<T>(fn: (vars: T) => Promise<unknown>, success: string) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => { qc.invalidateQueries(); toast({ title: success }); },
    onError: (e: unknown) => toast({ title: message(e) || 'Something went wrong', variant: 'destructive' }),
  });
}

export function usePrepayLoan() {
  return useLoanMutation(({ id, ...body }: { id: string; amount: number; accountId?: string; date?: string; note?: string }) =>
    api.post(`/loans/${id}/prepay`, body), 'Prepayment recorded');
}

export function useChangeLoanRate() {
  return useLoanMutation(({ id, ...body }: { id: string; interestRate: number; emi?: number; date?: string; note?: string }) =>
    api.post(`/loans/${id}/rate`, body), 'Interest rate updated');
}

export function useUndoLoanEvent() {
  return useLoanMutation(({ loanId, eventId }: { loanId: string; eventId: string }) =>
    api.post(`/loans/${loanId}/events/${eventId}/undo`), 'Change undone');
}

export function useSetInvestmentSchedule() {
  return useLoanMutation(({ id, ...body }: { id: string; pauseFrom?: string | null; pauseUntil?: string | null; nextMonthlyAmount?: number | null; nextAmountFrom?: string | null }) =>
    api.put(`/investments/${id}/schedule`, body), 'Schedule saved');
}
