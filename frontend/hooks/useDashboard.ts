'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DashboardOverview, CashflowData, CategoryBreakdown, QuickInsight, Transaction, ApiResponse } from '@/types';
import { usePeriodStore } from '@/stores/period.store';

export function useDashboardOverview() {
  const { month, year } = usePeriodStore();

  return useQuery({
    queryKey: ['dashboard', 'overview', month, year],
    queryFn: async () => {
      const res = await api.get<ApiResponse<DashboardOverview>>('/dashboard/overview', { params: { month, year } });
      return res.data.data;
    },
  });
}

export function useCashflowTrend(months = 6) {
  const { month, year } = usePeriodStore();

  return useQuery({
    queryKey: ['dashboard', 'cashflow', months, month, year],
    queryFn: async () => {
      const res = await api.get<ApiResponse<CashflowData[]>>('/dashboard/cashflow', { params: { months, month, year } });
      return res.data.data;
    },
  });
}

export function useExpenseBreakdown() {
  const { month, year } = usePeriodStore();

  return useQuery({
    queryKey: ['dashboard', 'expense-breakdown', month, year],
    queryFn: async () => {
      const res = await api.get<ApiResponse<CategoryBreakdown[]>>('/dashboard/expense-breakdown', { params: { month, year } });
      return res.data.data;
    },
  });
}

export function useQuickInsights() {
  const { month, year } = usePeriodStore();

  return useQuery({
    queryKey: ['dashboard', 'insights', month, year],
    queryFn: async () => {
      const res = await api.get<ApiResponse<QuickInsight[]>>('/dashboard/insights', { params: { month, year } });
      return res.data.data;
    },
  });
}

// Deliberately NOT period-scoped -- "recent activity" is a different concept
// from "this period's activity" and shouldn't jump around when the period
// selector changes.
export function useRecentTransactions(limit = 5) {
  return useQuery({
    queryKey: ['dashboard', 'recent-transactions', limit],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Transaction[]>>(`/dashboard/recent-transactions?limit=${limit}`);
      return res.data.data;
    },
  });
}
