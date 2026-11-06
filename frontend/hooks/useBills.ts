'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  ApiResponse,
  BillFilters,
  BillReminder,
  RecurringBill,
} from '@/types';
import { useToast } from '@/components/ui/use-toast';

// Every mutation invalidates the whole domain: a single payment moves the
// list, summary, calendar, forecast, insights, analytics AND the dashboard.
const BILL_KEYS = ['bills', 'bills-summary', 'bills-calendar', 'bills-forecast', 'bills-insights', 'bills-analytics', 'bills-reminders', 'dashboard'];

function useInvalidateBills() {
  const qc = useQueryClient();
  return () => BILL_KEYS.forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export function useBills(filters: BillFilters = {}) {
  return useQuery({
    queryKey: ['bills', filters],
    queryFn: async () => {
      const res = await api.get<ApiResponse<RecurringBill[]>>('/bills', { params: filters });
      return res.data.data;
    },
  });
}

export function useBillReminders() {
  return useQuery({
    queryKey: ['bills-reminders'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<BillReminder[]>>('/bills/reminders');
      return res.data.data;
    },
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

function useBillMutation<TVars>(
  fn: (vars: TVars) => Promise<unknown>,
  successTitle: string,
  errorTitle: string
) {
  const invalidate = useInvalidateBills();
  const { toast } = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      invalidate();
      toast({ title: successTitle });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast({ title: errorTitle, description: message, variant: 'destructive' });
    },
  });
}

export function useCreateBill() {
  return useBillMutation(
    (data: Record<string, unknown>) => api.post('/bills', data),
    'Bill added',
    'Failed to add bill'
  );
}

export function useUpdateBill() {
  return useBillMutation(
    ({ id, data }: { id: string; data: Record<string, unknown> }) => api.put(`/bills/${id}`, data),
    'Bill updated',
    'Failed to update bill'
  );
}

export function useDeleteBill() {
  return useBillMutation((id: string) => api.delete(`/bills/${id}`), 'Bill deleted', 'Failed to delete bill');
}

export function useDuplicateBill() {
  return useBillMutation(
    (id: string) => api.post(`/bills/${id}/duplicate`),
    'Bill duplicated',
    'Failed to duplicate bill'
  );
}

export function usePauseBill() {
  return useBillMutation(
    ({ id, pausedUntil }: { id: string; pausedUntil?: string | null }) =>
      api.post(`/bills/${id}/pause`, { pausedUntil: pausedUntil ?? null }),
    'Bill paused',
    'Failed to pause bill'
  );
}

export function useResumeBill() {
  return useBillMutation((id: string) => api.post(`/bills/${id}/resume`), 'Bill resumed', 'Failed to resume bill');
}
