'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Subscription, ApiResponse } from '@/types';
import { useToast } from '@/components/ui/use-toast';

export function useSubscriptions() {
  return useQuery({
    queryKey: ['subscriptions'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Subscription[]>>('/subscriptions');
      return res.data.data;
    },
  });
}

export function useCreateSubscription() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/subscriptions', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subscriptions'] }); toast({ title: 'Subscription added' }); },
    onError: () => toast({ title: 'Failed to add subscription', variant: 'destructive' }),
  });
}

export function useUpdateSubscription() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.put(`/subscriptions/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subscriptions'] }); toast({ title: 'Subscription updated' }); },
    onError: () => toast({ title: 'Failed to update subscription', variant: 'destructive' }),
  });
}

export function useDeleteSubscription() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/subscriptions/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subscriptions'] }); toast({ title: 'Subscription deleted' }); },
    onError: () => toast({ title: 'Failed to delete subscription', variant: 'destructive' }),
  });
}
