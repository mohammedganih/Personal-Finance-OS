'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { P2PLoan, P2PSummary, ApiResponse } from '@/types';
import { useToast } from '@/components/ui/use-toast';

export function useP2PLoans() {
  return useQuery({
    queryKey: ['p2p'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<P2PLoan[]>>('/p2p');
      return res.data.data;
    },
  });
}

export function useP2PSummary() {
  return useQuery({
    queryKey: ['p2p', 'summary'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<P2PSummary>>('/p2p/summary');
      return res.data.data;
    },
  });
}

export function useCreateP2PLoan() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/p2p', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['p2p'] }); toast({ title: 'P2P entry added' }); },
    onError: () => toast({ title: 'Failed to add', variant: 'destructive' }),
  });
}

export function useUpdateP2PLoan() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.put(`/p2p/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['p2p'] }); toast({ title: 'Updated' }); },
    onError: () => toast({ title: 'Failed to update', variant: 'destructive' }),
  });
}

export function useDeleteP2PLoan() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/p2p/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['p2p'] }); toast({ title: 'Entry deleted' }); },
    onError: () => toast({ title: 'Failed to delete', variant: 'destructive' }),
  });
}
