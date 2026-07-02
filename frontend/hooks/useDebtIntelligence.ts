'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { HealthScoreResult, DebtStrategy, ApiResponse } from '@/types';

export function useHealthScore() {
  return useQuery({
    queryKey: ['debt', 'health-score'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<HealthScoreResult>>('/debt/health-score');
      return res.data.data;
    },
  });
}

export function useDebtStrategy(extraPayment = 5000) {
  return useQuery({
    queryKey: ['debt', 'strategy', extraPayment],
    queryFn: async () => {
      const res = await api.get<ApiResponse<DebtStrategy>>('/debt/strategy', { params: { extraPayment } });
      return res.data.data;
    },
  });
}
