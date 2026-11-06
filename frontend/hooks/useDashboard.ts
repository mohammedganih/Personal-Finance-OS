'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DashboardOverview, QuickInsight, NetWorthTrendPoint, ApiResponse } from '@/types';
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

// Deliberately NOT period-scoped -- net worth is always "right now", not a
// per-month figure, same reasoning as useRecentTransactions below.
export function useNetWorthTrend(days = 180) {
  return useQuery({
    queryKey: ['dashboard', 'net-worth-trend', days],
    queryFn: async () => {
      const res = await api.get<ApiResponse<NetWorthTrendPoint[]>>('/dashboard/net-worth-trend', { params: { days } });
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
