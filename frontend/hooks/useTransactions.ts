'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PaginatedTransactions, TransactionFilters, ApiResponse } from '@/types';
import { useToast } from '@/components/ui/use-toast';

export function useTransactions(filters: TransactionFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, val]) => {
    if (val !== undefined && val !== '') params.set(key, String(val));
  });

  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PaginatedTransactions>>(`/transactions?${params}`);
      return res.data.data;
    },
  });
}


export function useCreateTransaction() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/transactions', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Transaction added' });
    },
    onError: () => toast({ title: 'Failed to add transaction', variant: 'destructive' }),
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.put(`/transactions/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Transaction updated' });
    },
    onError: (err) => toast({ title: 'Failed to update transaction', description: errorMessage(err), variant: 'destructive' }),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/transactions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Transaction deleted' });
    },
    onError: () => toast({ title: 'Failed to delete transaction', variant: 'destructive' }),
  });
}

const errorMessage = (err: unknown) => (err as { response?: { data?: { message?: string } } })?.response?.data?.message;

/** Moves money between two of our own accounts (POST /transactions/transfer). */
export function useCreateTransfer() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: { fromAccountId: string; toAccountId: string; amount: number; date: string; note?: string }) =>
      api.post('/transactions/transfer', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Transfer recorded' });
    },
    onError: (err) => toast({ title: 'Failed to record transfer', description: errorMessage(err), variant: 'destructive' }),
  });
}
