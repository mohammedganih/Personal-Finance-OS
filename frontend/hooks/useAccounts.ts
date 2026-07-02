'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Account, ApiResponse } from '@/types';

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Account[]>>('/accounts');
      return res.data.data;
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/categories');
      return res.data.data;
    },
    staleTime: 10 * 60 * 1000,
  });
}
