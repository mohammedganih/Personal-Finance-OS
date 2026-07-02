'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Budget, ApiResponse } from '@/types';
import { useToast } from '@/components/ui/use-toast';

export function useBudgets() {
  return useQuery({
    queryKey: ['budgets'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Budget[]>>('/budgets');
      return res.data.data;
    },
  });
}

export function useCreateBudget() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/budgets', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] });
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
      qc.invalidateQueries({ queryKey: ['budgets'] });
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
      qc.invalidateQueries({ queryKey: ['budgets'] });
      toast({ title: 'Budget deleted' });
    },
    onError: () => toast({ title: 'Failed to delete budget', variant: 'destructive' }),
  });
}
