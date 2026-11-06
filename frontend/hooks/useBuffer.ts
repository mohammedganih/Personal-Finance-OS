'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

export interface BufferAccount { id: string; name: string; balance: number }
export interface Buffer {
  /** Buffer accounts' balance less this month's still-pending payments from them. */
  amount: number; balance: number; pendingFromBuffer: number;
  target: number; targetIsDefault: boolean; defaultTarget: number; monthlyCommitments: number;
  accounts: BufferAccount[]; accountsAreDefault: boolean;
}

export function useBuffer() {
  return useQuery({
    queryKey: ['dashboard', 'buffer'],
    queryFn: async () => (await api.get<{ data: Buffer }>('/dashboard/buffer')).data.data,
  });
}

/** Saves the buffer target (null = 3 months of commitments) and accounts (empty = all savings accounts). */
export function useSaveBufferSettings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (body: { bufferTarget?: number | null; bufferAccountIds?: string[] }) => api.put('/dashboard/settings/buffer', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dashboard'] }); toast({ title: 'Buffer saved' }); },
    onError: () => toast({ title: 'Could not save the buffer', variant: 'destructive' }),
  });
}

export interface WhereWeStand {
  netWorth: number;
  /** Change since the last month close; null before any month is closed. */
  netWorthChange: { amount: number; sinceMonth: string; approximate: boolean } | null;
  buffer: Buffer;
  debt: { total: number; lastEndsMonth: string | null; lastEndsName: string | null };
}

export function useWhereWeStand() {
  return useQuery({
    queryKey: ['dashboard', 'where-we-stand'],
    queryFn: async () => (await api.get<{ data: WhereWeStand }>('/dashboard/where-we-stand')).data.data,
  });
}
