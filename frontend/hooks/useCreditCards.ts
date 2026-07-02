'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CreditCard, ApiResponse } from '@/types';
import { useToast } from '@/components/ui/use-toast';

export function useCreditCards() {
  return useQuery({
    queryKey: ['credit-cards'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<CreditCard[]>>('/credit-cards');
      return res.data.data;
    },
  });
}

export function useCreateCreditCard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/credit-cards', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['credit-cards'] }); toast({ title: 'Credit card added' }); },
    onError: () => toast({ title: 'Failed to add credit card', variant: 'destructive' }),
  });
}

export function useUpdateCreditCard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.put(`/credit-cards/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['credit-cards'] }); toast({ title: 'Credit card updated' }); },
    onError: () => toast({ title: 'Failed to update', variant: 'destructive' }),
  });
}

export function useDeleteCreditCard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/credit-cards/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['credit-cards'] }); toast({ title: 'Credit card removed' }); },
    onError: () => toast({ title: 'Failed to remove', variant: 'destructive' }),
  });
}

export function usePayCreditCardBill() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, amount, accountId }: { id: string; amount: number; accountId?: string }) =>
      api.post(`/credit-cards/${id}/pay`, { amount, accountId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['credit-cards'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Bill payment recorded' });
    },
    onError: () => toast({ title: 'Failed to record payment', variant: 'destructive' }),
  });
}
