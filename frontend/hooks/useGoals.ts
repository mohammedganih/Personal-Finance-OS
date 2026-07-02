'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Goal, ApiResponse } from '@/types';
import { useToast } from '@/components/ui/use-toast';

export function useGoals() {
  return useQuery({
    queryKey: ['goals'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Goal[]>>('/goals');
      return res.data.data;
    },
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/goals', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); toast({ title: 'Goal created' }); },
    onError: () => toast({ title: 'Failed to create goal', variant: 'destructive' }),
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.put(`/goals/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); toast({ title: 'Goal updated' }); },
    onError: () => toast({ title: 'Failed to update goal', variant: 'destructive' }),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/goals/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); toast({ title: 'Goal deleted' }); },
    onError: () => toast({ title: 'Failed to delete goal', variant: 'destructive' }),
  });
}
