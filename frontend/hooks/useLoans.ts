'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Loan, ApiResponse, AmortizationRow, AssetLoanSummary, AssetLoanInsight, HomeEquitySummary } from '@/types';
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['loans'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); toast({ title: 'Loan added' }); },
    onError: () => toast({ title: 'Failed to add loan', variant: 'destructive' }),
  });
}

export function useUpdateLoan() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.put(`/loans/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['loans'] }); toast({ title: 'Loan updated' }); },
    onError: () => toast({ title: 'Failed to update loan', variant: 'destructive' }),
  });
}

export function useDeleteLoan() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/loans/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['loans'] }); toast({ title: 'Loan deleted' }); },
    onError: () => toast({ title: 'Failed to delete loan', variant: 'destructive' }),
  });
}

export function usePayLoanEMI() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, accountId }: { id: string; accountId?: string }) =>
      api.post(`/loans/${id}/pay`, { accountId }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['loans'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      const { isPaidOff } = res.data.data;
      toast({ title: isPaidOff ? '🎉 Loan fully paid off!' : 'EMI payment recorded' });
    },
    onError: () => toast({ title: 'Failed to record payment', variant: 'destructive' }),
  });
}

export function useLinkLoanAsset() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, investmentId }: { id: string; investmentId: string | null }) =>
      api.post(`/loans/${id}/link-asset`, { investmentId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loans'] });
      qc.invalidateQueries({ queryKey: ['investments'] });
      qc.invalidateQueries({ queryKey: ['asset-loans'] });
      toast({ title: 'Asset link updated' });
    },
    onError: () => toast({ title: 'Failed to update asset link', variant: 'destructive' }),
  });
}

export function useAmortizationSchedule(loanId: string | undefined) {
  return useQuery({
    queryKey: ['asset-loans', loanId, 'amortization'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<AmortizationRow[]>>(`/asset-loans/${loanId}/amortization`);
      return res.data.data;
    },
    enabled: !!loanId,
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

export function useAllAssetLoanSummaries() {
  return useQuery({
    queryKey: ['asset-loans', 'summaries'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<AssetLoanSummary[]>>('/asset-loans/summaries');
      return res.data.data;
    },
  });
}

export function useAssetLoanInsights() {
  return useQuery({
    queryKey: ['asset-loans', 'insights'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<AssetLoanInsight[]>>('/asset-loans/insights');
      return res.data.data;
    },
  });
}

export function useHomeEquitySummary() {
  return useQuery({
    queryKey: ['asset-loans', 'home-equity'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<HomeEquitySummary>>('/asset-loans/home-equity');
      return res.data.data;
    },
  });
}
