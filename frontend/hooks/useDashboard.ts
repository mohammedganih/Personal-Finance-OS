'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DashboardOverview, CashflowData, CategoryBreakdown, QuickInsight, Transaction, ApiResponse } from '@/types';

export function useDashboardOverview() {
  return useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<DashboardOverview>>('/dashboard/overview');
      return res.data.data;
    },
  });
}

export function useCashflowTrend(months = 6) {
  return useQuery({
    queryKey: ['dashboard', 'cashflow', months],
    queryFn: async () => {
      const res = await api.get<ApiResponse<CashflowData[]>>(`/dashboard/cashflow?months=${months}`);
      return res.data.data;
    },
  });
}

export function useExpenseBreakdown() {
  return useQuery({
    queryKey: ['dashboard', 'expense-breakdown'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<CategoryBreakdown[]>>('/dashboard/expense-breakdown');
      return res.data.data;
    },
  });
}

export function useQuickInsights() {
  return useQuery({
    queryKey: ['dashboard', 'insights'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<QuickInsight[]>>('/dashboard/insights');
      return res.data.data;
    },
  });
}

export function useRecentTransactions(limit = 5) {
  return useQuery({
    queryKey: ['dashboard', 'recent-transactions', limit],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Transaction[]>>(`/dashboard/recent-transactions?limit=${limit}`);
      return res.data.data;
    },
  });
}
