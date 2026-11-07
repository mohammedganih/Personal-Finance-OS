'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ApiResponse, FinancialScoreResult } from '@/types';

export function useFinancialScore() {
  return useQuery({
    queryKey: ['analytics', 'financial-score'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<FinancialScoreResult>>('/analytics/financial-score');
      return res.data.data;
    },
  });
}
