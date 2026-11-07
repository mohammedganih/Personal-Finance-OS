'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { FamilyMember, ApiResponse } from '@/types';
import { useToast } from '@/components/ui/use-toast';

export function useFamilyMembers() {
  return useQuery({
    queryKey: ['family-members'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<FamilyMember[]>>('/family');
      return res.data.data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateFamilyMember() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/family', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['family-members'] }); toast({ title: 'Member added' }); },
    onError: () => toast({ title: 'Failed to add member', variant: 'destructive' }),
  });
}

export function useUpdateFamilyMember() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.put(`/family/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['family-members'] }); toast({ title: 'Updated' }); },
    onError: () => toast({ title: 'Failed to update', variant: 'destructive' }),
  });
}

export function useDeleteFamilyMember() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/family/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['family-members'] }); toast({ title: 'Member removed' }); },
    onError: () => toast({ title: 'Failed to remove', variant: 'destructive' }),
  });
}
