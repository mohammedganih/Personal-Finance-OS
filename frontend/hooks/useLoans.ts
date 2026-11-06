'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Loan, ApiResponse, AssetLoanSummary } from '@/types';
import { useToast } from '@/components/ui/use-toast';

export function useLoans() {
  return useQuery({
    queryKey: ['loans'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Loan[]>>('/loans');
      return res.data.data;
    },
  });
}

export function useCreateLoan() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/loans', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['loans'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['dashboard', 'monthly-plan'] });
      toast({ title: 'Loan added' }); },
    onError: () => toast({ title: 'Failed to add loan', variant: 'destructive' }),
  });
}

export function useUpdateLoan() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.put(`/loans/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['loans'] }); qc.invalidateQueries({ queryKey: ['dashboard', 'monthly-plan'] });
      toast({ title: 'Loan updated' }); },
    onError: () => toast({ title: 'Failed to update loan', variant: 'destructive' }),
  });
}

export function useDeleteLoan() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/loans/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['loans'] }); qc.invalidateQueries({ queryKey: ['dashboard', 'monthly-plan'] });
      toast({ title: 'Loan deleted' }); },
    onError: () => toast({ title: 'Failed to delete loan', variant: 'destructive' }),
  });
}

export function useAssetLoanSummary(loanId: string | undefined) {
  return useQuery({
    queryKey: ['asset-loans', loanId, 'summary'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<AssetLoanSummary>>(`/asset-loans/${loanId}/summary`);
      return res.data.data;
    },
    enabled: !!loanId,
  });
}
