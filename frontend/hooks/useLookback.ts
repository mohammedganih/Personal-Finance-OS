'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

// Net worth (Wealth), Month history and the Health check (Look back).

export interface SheetItem { id: string; name: string; amount: number; detail?: string }
export interface NetWorthPage {
  sheet: {
    bankBalance: number; investmentValue: number; moneyLent: number; totalAssets: number;
    loanDebt: number; cardEmiDebt: number; cardStatementsDue: number; moneyBorrowed: number; totalDebt: number; netWorth: number;
  };
  items: Record<'bank' | 'investments' | 'gold' | 'lent' | 'loans' | 'cardEmis' | 'cardStatements' | 'borrowed', SheetItem[]>;
  trend: { month: string; netWorth: number; totalDebt: number; approximate: boolean }[];
  sinceLastClose: {
    month: string; approximate: boolean; netWorthThen: number; change: number;
    lines: { key: 'bank' | 'other' | 'debt'; label: string; then: number; now: number; change: number }[];
  } | null;
}

export function useNetWorthPage() {
  return useQuery({
    queryKey: ['wealth', 'net-worth'],
    queryFn: async () => (await api.get<{ data: NetWorthPage }>('/wealth/net-worth')).data.data,
  });
}

export interface CheckInResult { accountId: string; name: string; before: number; after: number; adjustment: number }

/** Today's bank balances; any gap is recorded as an adjustment (not income or spending). */
export function useCheckInBalances() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (balances: { accountId: string; balance: number }[]) =>
      (await api.post<{ data: CheckInResult[] }>('/wealth/check-in', { balances })).data.data,
    onSuccess: (results) => {
      ['wealth', 'dashboard', 'accounts', 'lookback', 'transactions'].forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
      const changed = results.filter((r) => r.adjustment !== 0).length;
      toast({ title: changed ? `Balances updated (${changed} adjusted)` : 'Balances match. Nothing to adjust' });
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast({ title: 'Could not save the balances', description: message, variant: 'destructive' });
    },
  });
}

export interface HistoryRow {
  month: string; salary: number; commitments: number; saved: number; spent: number; leftOver: number;
  netWorth: number; totalDebt: number; approximate: boolean; early: boolean; closedAt: string;
}
export interface MonthHistory { currentMonth: string; currentClosed: boolean; months: HistoryRow[] }

export function useMonthHistory() {
  return useQuery({
    queryKey: ['lookback', 'months'],
    queryFn: async () => (await api.get<{ data: MonthHistory }>('/lookback/months')).data.data,
  });
}

export function useCloseMonth() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async () => (await api.post<{ data: HistoryRow }>('/lookback/close-month')).data.data,
    onSuccess: () => {
      ['lookback', 'wealth'].forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
      toast({ title: 'Month closed', description: 'It closes again on the 1st with the final figures.' });
    },
    onError: () => toast({ title: 'Could not close the month', variant: 'destructive' }),
  });
}

export type Level = 'good' | 'watch' | 'act';
export interface StaleItem { kind: 'PRICE' | 'CARD_STATEMENT' | 'MONTH_CLOSE' | 'BALANCES'; id: string | null; name: string; detail: string; href: string; level: Level }
export interface HealthCheck {
  month: string;
  buffer: { amount: number; target: number; targetIsDefault: boolean; monthlyCommitments: number; monthsCovered: number | null; level: Level };
  debtToIncome: { monthlyEmis: number; income: number; incomeIsSalary: boolean; pct: number | null; level: Level };
  savingsRate: { months: { month: string; income: number; rate: number | null }[]; average: number | null; level: Level };
  maturities: { investmentId: string; assetName: string; assetType: string; maturityDate: string; maturityAmount: number | null; daysAway: number }[];
  stale: StaleItem[];
  advice: {
    score: { score: number; band: string; components: { label: string; score: number; weight: number; detail: string }[] } | null;
    recommendations: { priority: number; severity: 'critical' | 'warning' | 'info' | 'positive'; title: string; description: string }[];
    strategy: { extraPayment: number; bestStrategy: 'avalanche' | 'snowball'; baseMonths: number; monthsWithExtra: number; interestSaved: number; interestRemaining: number; order: string[] } | null;
    diversification: { severity: 'warning' | 'info'; message: string }[];
    funding: { investmentId: string; assetName: string; availableAmount: number; availableDate: string | null; targetDebtName: string; monthsSaved: number; interestSaved: number }[];
    assetLoans: { severity: string; message: string; loanId: string }[];
  };
}

export function useHealthCheck() {
  return useQuery({
    queryKey: ['lookback', 'health'],
    queryFn: async () => (await api.get<{ data: HealthCheck }>('/lookback/health')).data.data,
  });
}
