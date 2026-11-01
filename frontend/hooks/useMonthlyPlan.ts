'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type MonthlyPaymentRow = { id: string; type: string; name: string; amount: number; status: string; accountId?: string | null; dueDate?: string; creditCardId?: string };
export type MonthlyPlan = { month: string; rows: MonthlyPaymentRow[]; scheduled: number; paid: number; skipped: number; remaining: number; loans: number; creditCards: number; investments: number; bills: number };
export function useMonthlyPlan() {
  return useQuery({ queryKey: ['dashboard', 'monthly-plan'], queryFn: async () => (await api.get<{ data: { current: MonthlyPlan; next: MonthlyPlan } }>('/dashboard/monthly-plan')).data.data });
}
