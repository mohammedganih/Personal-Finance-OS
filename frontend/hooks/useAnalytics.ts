'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ApiResponse, FinancialScoreResult, SpendingRhythm } from '@/types';

export function useSpendingRhythm() {
  return useQuery({
    queryKey: ['analytics', 'spending-rhythm'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<SpendingRhythm>>('/analytics/spending-rhythm');
      return res.data.data;
    },
  });
}

export function useFinancialScore() {
  return useQuery({
    queryKey: ['analytics', 'financial-score'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<FinancialScoreResult>>('/analytics/financial-score');
      return res.data.data;
    },
  });
}
