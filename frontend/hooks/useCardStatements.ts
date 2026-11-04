'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

export type StatementStatus = 'DUE' | 'PART_PAID' | 'PAID';
export interface BreakdownItem { kind: 'EMI' | 'EXPENSE' | 'BILL'; id: string; name: string; amount: number; date: string | null; category?: string | null; linkedType?: string | null }
export interface Breakdown { emis: BreakdownItem[]; expenses: BreakdownItem[]; bills: BreakdownItem[]; paidOff: BreakdownItem[]; itemsTotal: number; other: number }
export interface StatementPayment { transactionId: string; amount: number; date: string; accountId: string | null; accountName: string | null }
export interface CardStatement {
  id: string; month: string; periodStart: string; statementDate: string; dueDate: string;
  issued: true; totalDue: number; minimumDue: number | null; notes: string | null;
  paidAmount: number; remaining: number; status: StatementStatus; overdue: boolean; minimumMet: boolean;
  paidDate: string | null; paidFromAccountId: string | null; paidFromAccountName: string | null;
  payments: StatementPayment[]; breakdown: Breakdown;
}
export interface UpcomingStatement { month: string; periodStart: string; statementDate: string; dueDate: string; issued: false; estimatedTotal: number; breakdown: Breakdown }
export interface CardStatements { cardId: string; statements: CardStatement[]; upcoming: UpcomingStatement }
export interface CardExpense {
  id: string; creditCardId: string; memberId: string | null; name: string; amount: number; date: string; category: string;
  statementMonth: string; linkedType: string | null; linkedId: string | null;
  paidDate: string | null; paidFromAccountId: string | null; transactionId: string | null; notes: string | null;
}

type ApiError = { response?: { data?: { message?: string } } };
const message = (e: unknown) => (e as ApiError).response?.data?.message;

export function useCardStatements(cardId: string | undefined) {
  return useQuery({
    queryKey: ['credit-cards', 'statements', cardId],
    queryFn: async () => (await api.get<{ data: CardStatements }>(`/credit-cards/${cardId}/statements`)).data.data,
    enabled: !!cardId,
  });
}

export function useCardExpenses(cardId: string | undefined) {
  return useQuery({
    queryKey: ['credit-cards', 'expenses', cardId],
    queryFn: async () => (await api.get<{ data: CardExpense[] }>('/credit-cards/expenses', { params: { cardId } })).data.data,
    enabled: !!cardId,
  });
}

/** Card writes move statements, Home, funding and balances, so refresh everything. */
function useCardMutation<T>(fn: (vars: T) => Promise<unknown>, success: string) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => { qc.invalidateQueries(); toast({ title: success }); },
    onError: (e: unknown) => toast({ title: message(e) || 'Something went wrong', variant: 'destructive' }),
  });
}

export interface SaveStatementInput { statementDate: string; dueDate: string; periodStart?: string; totalDue: number; minimumDue?: number | null; notes?: string | null }
export const useSaveStatement = () => useCardMutation(({ cardId, ...body }: SaveStatementInput & { cardId: string }) => api.post(`/credit-cards/${cardId}/statements`, body), 'Statement saved');
export const useDeleteStatement = () => useCardMutation((id: string) => api.delete(`/credit-cards/statements/${id}`), 'Statement deleted');

export interface CardExpenseInput {
  creditCardId: string; name: string; amount: number; date: string; category?: string; memberId?: string | null;
  statementMonth?: string; notes?: string | null; payNow?: { accountId?: string | null; paidDate?: string };
}
export const useCreateCardExpense = () => useCardMutation((body: CardExpenseInput) => api.post('/credit-cards/expenses', body), 'Card expense added');
export const useUpdateCardExpense = () => useCardMutation(({ id, ...body }: Partial<CardExpenseInput> & { id: string }) => api.put(`/credit-cards/expenses/${id}`, body), 'Card expense updated');
export const useDeleteCardExpense = () => useCardMutation((id: string) => api.delete(`/credit-cards/expenses/${id}`), 'Card expense deleted');
export const usePayCardExpense = () => useCardMutation(({ id, ...body }: { id: string; accountId?: string | null; paidDate?: string }) => api.post(`/credit-cards/expenses/${id}/pay`, body), 'Marked paid off');
export const useUndoCardExpensePayment = () => useCardMutation((id: string) => api.post(`/credit-cards/expenses/${id}/undo-pay`), 'Payment undone');
