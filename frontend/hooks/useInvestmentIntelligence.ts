'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AnnualizedReturns, TrendPoint, InvestmentCalendarEntry, DiversificationResult, MaturityEntry, ApiResponse } from '@/types';

export function useAnnualizedReturns() {
  return useQuery({
    queryKey: ['investments', 'xirr'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<AnnualizedReturns>>('/investments/xirr');
      return res.data.data;
    },
  });
}

export function usePortfolioTrend(days = 180) {
  return useQuery({
    queryKey: ['investments', 'trend', days],
    queryFn: async () => {
      const res = await api.get<ApiResponse<TrendPoint[]>>('/investments/trend', { params: { days } });
      return res.data.data;
    },
  });
}

export function useInvestmentCalendar(monthsAhead = 3) {
  return useQuery({
    queryKey: ['investments', 'calendar', monthsAhead],
    queryFn: async () => {
      const res = await api.get<ApiResponse<InvestmentCalendarEntry[]>>('/investments/calendar', { params: { months: monthsAhead } });
      return res.data.data;
    },
  });
}

export function useDiversification() {
  return useQuery({
    queryKey: ['investments', 'diversification'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<DiversificationResult>>('/investments/diversification');
      return res.data.data;
    },
  });
}

export function useMaturityRadar(monthsAhead = 6) {
  return useQuery({
    queryKey: ['investments', 'maturities', monthsAhead],
    queryFn: async () => {
      const res = await api.get<ApiResponse<MaturityEntry[]>>('/investments/maturities', { params: { months: monthsAhead } });
      return res.data.data;
    },
  });
}
