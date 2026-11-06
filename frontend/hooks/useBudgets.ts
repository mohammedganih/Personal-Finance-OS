'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Budget, ApiResponse } from '@/types';
import { useToast } from '@/components/ui/use-toast';
import { usePeriodStore } from '@/stores/period.store';

// enabled defaults to true; HeaderLight passes false on every route but
// Budgets so its Add-flow fetch (needed to exclude already-budgeted
// categories from the picker) doesn't fire on every other light route too.
export function useBudgets(enabled = true) {
  const { month, year } = usePeriodStore();
  return useBudgetsForPeriod(month, year, enabled);
}

// Explicit month/year rather than reading the period store -- lets the
// Monthly Comparison card fetch the prior month's budgets regardless of
// whatever period the header selector is currently showing.
export function useBudgetsForPeriod(month: number, year: number, enabled = true) {
  return useQuery({
    // ['budgets'] as a prefix (below) still invalidates every month's cached
    // query on create/update/delete -- React Query matches by key prefix.
    queryKey: ['budgets', month, year],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Budget[]>>('/budgets', { params: { month, year } });
      return res.data.data;
    },
    enabled,
  });
}

export function useCreateBudget() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/budgets', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] }); qc.invalidateQueries({ queryKey: ['transactions', 'spending'] });
      toast({ title: 'Budget created' });
    },
    onError: () => toast({ title: 'Failed to create budget', variant: 'destructive' }),
  });
}

export function useUpdateBudget() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.put(`/budgets/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] }); qc.invalidateQueries({ queryKey: ['transactions', 'spending'] });
      toast({ title: 'Budget updated' });
    },
    onError: () => toast({ title: 'Failed to update budget', variant: 'destructive' }),
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/budgets/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] }); qc.invalidateQueries({ queryKey: ['transactions', 'spending'] });
      toast({ title: 'Limit removed' });
    },
    onError: () => toast({ title: 'Failed to delete budget', variant: 'destructive' }),
  });
}
