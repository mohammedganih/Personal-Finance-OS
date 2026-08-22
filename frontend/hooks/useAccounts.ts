'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Account, ApiResponse } from '@/types';
import { useToast } from '@/components/ui/use-toast';

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Account[]>>('/accounts');
      return res.data.data;
    },
  });
}

// AccountSetup's own AccountForm still manages create/update with its own
// inline useMutation calls -- this is just the delete action the light
// Accounts table's row menu needs, following the useDelete* naming
// convention every other domain hook already uses.
export function useDeleteAccount() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/accounts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] });
      toast({ title: 'Account removed' });
    },
    onError: () => toast({ title: 'Failed to remove account', variant: 'destructive' }),
  });
}
