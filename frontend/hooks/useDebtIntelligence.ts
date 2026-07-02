'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { HealthScoreResult, DebtStrategy, PrepaymentResult, CalendarEntry, Recommendation, ApiResponse } from '@/types';

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

export function usePrepaymentCalculator() {
  return useMutation({
    mutationFn: async ({ debtId, lumpSum }: { debtId: string; lumpSum: number }) => {
      const res = await api.get<ApiResponse<PrepaymentResult>>('/debt/prepayment', { params: { debtId, lumpSum } });
      return res.data.data;
    },
  });
}

export function useEMICalendar(monthsAhead = 3) {
  return useQuery({
    queryKey: ['debt', 'calendar', monthsAhead],
    queryFn: async () => {
      const res = await api.get<ApiResponse<CalendarEntry[]>>('/debt/calendar', { params: { months: monthsAhead } });
      return res.data.data;
    },
  });
}

export function useDebtRecommendations() {
  return useQuery({
    queryKey: ['debt', 'recommendations'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Recommendation[]>>('/debt/recommendations');
      return res.data.data;
    },
  });
}
