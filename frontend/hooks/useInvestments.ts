'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Investment, PortfolioSummary, ApiResponse } from '@/types';
import { useToast } from '@/components/ui/use-toast';

export function useInvestments() {
  return useQuery({
    queryKey: ['investments'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Investment[]>>('/investments');
      return res.data.data;
    },
  });
}

export function usePortfolioSummary() {
  return useQuery({
    queryKey: ['investments', 'summary'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PortfolioSummary>>('/investments/summary');
      return res.data.data;
    },
  });
}

export function useCreateInvestment() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/investments', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['investments'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); toast({ title: 'Investment added' }); },
    onError: () => toast({ title: 'Failed to add investment', variant: 'destructive' }),
  });
}

export function useUpdateInvestment() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.put(`/investments/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['investments'] }); toast({ title: 'Investment updated' }); },
    onError: () => toast({ title: 'Failed to update investment', variant: 'destructive' }),
  });
}

export function useDeleteInvestment() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/investments/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['investments'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); toast({ title: 'Investment deleted' }); },
    onError: () => toast({ title: 'Failed to delete investment', variant: 'destructive' }),
  });
}

export function usePayInvestment() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, accountId }: { id: string; accountId?: string }) =>
      api.post(`/investments/${id}/pay`, { accountId }),
    onSuccess: (res) => {
      const { amount, isInstallment } = res.data.data;
      qc.invalidateQueries({ queryKey: ['investments'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast({
        title: isInstallment ? 'Payment logged as expense' : 'Investment logged as expense',
        description: `₹${Number(amount).toLocaleString('en-IN')} added to this month's expenses`,
      });
    },
    onError: () => toast({ title: 'Failed to log payment', variant: 'destructive' }),
  });
}
