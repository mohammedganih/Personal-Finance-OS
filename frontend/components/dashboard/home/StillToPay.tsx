'use client';

import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { useMonthlyPlan, useUndoPayment, MonthlyPaymentRow } from '@/hooks/useMonthlyPlan';
import { useAccountFunding } from '@/hooks/useAccountFunding';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { useToast } from '@/components/ui/use-toast';

// Pending rows for the current calendar month, earliest first. Mark paid reuses
// the same endpoints as components/shared/MonthlyPayments.tsx and the bills page,
// and offers Undo in the confirmation toast.

function useMarkPaid() {
  const qc = useQueryClient();
  const { toast, dismiss } = useToast();
  const undo = useUndoPayment();
  const pay = useMutation({
    mutationFn: (row: MonthlyPaymentRow) => row.type === 'BILL'
      ? api.post(`/bills/${row.id}/pay`, { createTransaction: true, dueDate: row.dueDate, accountId: row.accountId ?? undefined })
      : row.type === 'CARD_EMI'
        ? api.post(`/card-emis/${row.id}/pay`, {})
        : api.post('/dashboard/monthly-payment', { type: row.type, id: row.id, status: 'PAID', accountId: row.accountId || undefined }),
    onSuccess: (_res, row) => {
      qc.invalidateQueries();
      const target = { type: row.type, id: row.id, month: row.dueDate?.slice(0, 7), dueDate: row.dueDate };
      const id = toast({
        title: 'Payment recorded',
        description: `${row.name} · ${formatCurrency(row.amount)}`,
        duration: 10_000,
        action: (
          <button
            type="button"
            onClick={() => { undo.mutate(target); dismiss(id); }}
            className="mr-6 shrink-0 rounded-full border border-line-strong bg-paper-card px-3 py-1 text-xs font-medium text-ink-primary hover:bg-paper-subtle"
          >
            Undo
          </button>
        ),
      });
    },
    onError: (error: unknown) => {
      const e = error as { response?: { data?: { message?: string } } };
      toast({ title: e.response?.data?.message || 'Could not record payment', variant: 'destructive' });
    },
  });
  return { pending: pay.isPending || undo.isPending, mark: (row: MonthlyPaymentRow) => pay.mutate(row) };
}

export function StillToPay() {
  const { data, isLoading, isError } = useMonthlyPlan();
  const { data: funding } = useAccountFunding();
  const { data: members } = useFamilyMembers();
  const { mark, pending } = useMarkPaid();

  const names = new Map((members ?? []).map((m) => [m.id, m.name.split(' ')[0]]));
  const rows = (data?.current.rows ?? [])
    .filter((r) => r.status === 'PENDING')
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
  const left = rows.reduce((s, r) => s + r.amount, 0);
  const topUps = (funding?.accounts ?? []).filter((a) => a.amountToAdd > 0);

  return (
    <section className="card-light min-w-0 rounded-2xl px-5 py-[18px]">
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-ink-primary">Still to pay</h2>
        {data && <span className="text-xs text-ink-muted">{formatCurrency(left)} left · {rows.length} {rows.length === 1 ? 'payment' : 'payments'}</span>}
      </div>

      {topUps.map((a) => (
        <p key={a.id} className="mb-2 flex items-center gap-2.5 rounded-xl bg-amber-50 px-3 py-2.5 text-[13px] text-amber-800">
          <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span>
            Move {formatCurrency(a.amountToAdd)} to {a.name}
            {a.nextPayment?.dueDate ? <> before {formatDate(a.nextPayment.dueDate, 'd MMM')}</> : null}
            {a.nextPayment ? <> to cover {a.nextPayment.name}</> : null}.
          </span>
        </p>
      ))}

      {isLoading && <div className="h-40 rounded-xl shimmer" />}
      {isError && <p role="alert" className="text-sm text-ink-secondary">Could not load payments. Please refresh.</p>}
      {data && rows.length === 0 && <p className="py-6 text-center text-sm text-ink-muted">Everything for this month is paid.</p>}

      <ul>
        {rows.map((row) => (
          <li key={`${row.type}-${row.id}-${row.dueDate}`} className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line py-2.5 last:border-b-0 sm:grid-cols-[52px_minmax(0,1fr)_auto_auto]">
            <div className="text-center text-[11px] leading-tight text-ink-muted">
              {row.dueDate ? <><b className="block text-base text-ink-primary">{formatDate(row.dueDate, 'd')}</b>{formatDate(row.dueDate, 'MMM')}</> : '—'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink-primary">{row.name}</p>
              <p className="text-xs text-ink-muted">{row.memberId && names.get(row.memberId) ? `${names.get(row.memberId)} pays` : 'No person set'}</p>
            </div>
            <span className="text-sm font-semibold tabular-nums text-ink-primary">{formatCurrency(row.amount)}</span>
            <div className="col-start-2 col-end-4 justify-self-start sm:col-auto sm:justify-self-auto">
              {row.type === 'CREDIT_CARD' ? (
                <Link href="/loans" className="inline-block rounded-full border border-line-strong bg-paper-card px-3 py-1 text-xs font-medium text-ink-primary hover:bg-paper-subtle">Pay card</Link>
              ) : (
                <button
                  type="button"
                  disabled={pending || (row.type === 'BILL' && !row.dueDate)}
                  onClick={() => mark(row)}
                  className="rounded-full border border-line-strong bg-paper-card px-3 py-1 text-xs font-medium text-ink-primary hover:bg-paper-subtle disabled:opacity-50"
                >
                  Mark paid
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
