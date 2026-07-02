'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CardEMI, CardEMISummary, ApiResponse } from '@/types';
import { useToast } from '@/components/ui/use-toast';

export function useCardEMIs(includeArchived = false) {
  return useQuery({
    queryKey: ['card-emis', includeArchived],
    queryFn: async () => {
      const res = await api.get<ApiResponse<CardEMI[]>>(`/card-emis?archived=${includeArchived}`);
      return res.data.data;
    },
  });
}

export function useCardEMIsForCard(creditCardId: string) {
  return useQuery({
    queryKey: ['card-emis', 'card', creditCardId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<CardEMI[]>>(`/card-emis/card/${creditCardId}`);
      return res.data.data;
    },
    enabled: !!creditCardId,
  });
}

export function useCardEMISummary() {
  return useQuery({
    queryKey: ['card-emis', 'summary'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<CardEMISummary>>('/card-emis/summary');
      return res.data.data;
    },
  });
}

export function useCreateCardEMI() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/card-emis', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card-emis'] });
      qc.invalidateQueries({ queryKey: ['credit-cards'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Card EMI added' });
    },
    onError: () => toast({ title: 'Failed to add Card EMI', variant: 'destructive' }),
  });
}

export function useUpdateCardEMI() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.put(`/card-emis/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card-emis'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Card EMI updated' });
    },
    onError: () => toast({ title: 'Failed to update', variant: 'destructive' }),
  });
}

export function useDeleteCardEMI() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/card-emis/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card-emis'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Card EMI deleted' });
    },
    onError: () => toast({ title: 'Failed to delete', variant: 'destructive' }),
  });
}

export function usePayCardEMI() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, accountId }: { id: string; accountId?: string }) =>
      api.post(`/card-emis/${id}/pay`, { accountId }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['card-emis'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      const { isComplete } = res.data.data;
      toast({ title: isComplete ? '🎉 EMI fully paid off!' : 'EMI instalment recorded' });
    },
    onError: () => toast({ title: 'Failed to record payment', variant: 'destructive' }),
  });
}
