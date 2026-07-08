'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  ApiResponse,
  BillCalendarOccurrence,
  BillDetail,
  BillFilters,
  BillForecastMonth,
  BillInsight,
  BillReminder,
  BillsAnalytics,
  BillsSummary,
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

export function useBill(id: string | null) {
  return useQuery({
    queryKey: ['bills', 'detail', id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<BillDetail>>(`/bills/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });
}

export function useBillsSummary() {
  return useQuery({
    queryKey: ['bills-summary'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<BillsSummary>>('/bills/summary');
      return res.data.data;
    },
  });
}

export function useBillsCalendar(start?: string, end?: string) {
  return useQuery({
    queryKey: ['bills-calendar', start, end],
    queryFn: async () => {
      const res = await api.get<ApiResponse<BillCalendarOccurrence[]>>('/bills/calendar', {
        params: { start, end },
      });
      return res.data.data;
    },
  });
}

export function useBillsForecast(months = 12) {
  return useQuery({
    queryKey: ['bills-forecast', months],
    queryFn: async () => {
      const res = await api.get<ApiResponse<BillForecastMonth[]>>('/bills/forecast', { params: { months } });
      return res.data.data;
    },
  });
}

export function useBillsInsights() {
  return useQuery({
    queryKey: ['bills-insights'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<BillInsight[]>>('/bills/insights');
      return res.data.data;
    },
  });
}

export function useBillsAnalytics() {
  return useQuery({
    queryKey: ['bills-analytics'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<BillsAnalytics>>('/bills/analytics');
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

export function usePayBillOccurrence() {
  return useBillMutation(
    ({ id, ...data }: { id: string; dueDate: string; amount?: number; accountId?: string | null; createTransaction?: boolean }) =>
      api.post(`/bills/${id}/pay`, { createTransaction: true, ...data }),
    'Payment recorded',
    'Failed to record payment'
  );
}

export function useSkipBillOccurrence() {
  return useBillMutation(
    ({ id, ...data }: { id: string; dueDate: string; notes?: string }) => api.post(`/bills/${id}/skip`, data),
    'Occurrence skipped',
    'Failed to skip occurrence'
  );
}

export function useUndoBillOccurrence() {
  return useBillMutation(
    ({ id, dueDate }: { id: string; dueDate: string }) => api.post(`/bills/${id}/undo`, { dueDate }),
    'Occurrence reverted',
    'Failed to revert occurrence'
  );
}

export function useBulkBillAction() {
  return useBillMutation(
    (data: { ids: string[]; action: string; category?: string; frequency?: string; customIntervalDays?: number; pausedUntil?: string | null }) =>
      api.post('/bills/bulk', data),
    'Bulk action applied',
    'Bulk action failed'
  );
}
