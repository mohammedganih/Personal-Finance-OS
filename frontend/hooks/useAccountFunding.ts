 'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
export interface FundingPayment {
  id: string; type: string; name: string; amount: number; dueDate?: string;
  accountId?: string | null; overdue: boolean; accountName?: string;
}
export interface FundingAccount {
  id: string; name: string; bankName?: string | null; owner: string;
  currentBalance: number; preferredMinimum: number; upcomingObligations: number;
  targetBalance: number; amountToAdd: number; surplus: number; overdue: number;
  dueNext7Days: number; remainingThisMonth: number;
  status: 'READY' | 'SHORT' | 'FUND_SOON' | 'SURPLUS' | 'NO_UPCOMING_PAYMENTS';
  nextPayment: FundingPayment | null; payments: FundingPayment[];
}
export interface AccountFundingPlan {
  month: string; today: string; end: string; accounts: FundingAccount[];
  totals: { required: number; available: number; toAllocate: number; surplus: number; unassigned: number };
  unassigned: FundingPayment[]; next7Days: FundingPayment[];
  transfers: { fromId: string; from: string; toId: string; to: string; amount: number }[];
}
export function useAccountFunding() {
  return useQuery({ queryKey: ['dashboard', 'account-funding'],
    queryFn: async () => (await api.get<{ data: AccountFundingPlan }>('/dashboard/account-funding')).data.data,
    refetchInterval: 60_000 });
}
