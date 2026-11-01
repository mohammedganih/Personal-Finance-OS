 'use client';

import { CalendarDays, ChevronDown } from 'lucide-react';
import { useAccountFunding, type FundingPayment } from '@/hooks/useAccountFunding';
import { formatCurrency, formatDate } from '@/lib/format';

function PaymentItem({ payment, today }: { payment: FundingPayment; today: string }) {
  return <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-paper-subtle"><CalendarDays aria-hidden="true" className="h-4 w-4 text-mono" /></div>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
        <p className="min-w-0 flex-1 text-xs font-medium text-ink-primary break-words">{payment.name}</p>
        <p className="text-xs font-semibold tabular-nums text-ink-primary">{formatCurrency(payment.amount)}</p>
      </div>
      <p className="mt-1 text-[11px] text-ink-muted">{payment.dueDate && formatDate(payment.dueDate, 'd MMM')}{payment.dueDate === today && ' / Today'}</p>
      <p className="mt-0.5 text-[11px] text-ink-muted break-words">{payment.accountName}</p>
    </div>
  </li>;
}

export function UpcomingList() {
  const { data, isLoading, isError } = useAccountFunding();
  if (isLoading) return <div className="card-light rounded-2xl h-72 shimmer" />;
  const payments = data?.next7Days ?? [];
  return <section className="card-light flex h-full flex-col rounded-2xl p-5">
    <div className="mb-4 flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-ink-primary">Next 7 Days</h3>
      {!isError && <span className="text-xs text-ink-muted">{payments.length} {payments.length === 1 ? 'payment' : 'payments'}</span>}
    </div>
    {isError ? <p className="text-sm text-ink-secondary">Could not load upcoming payments.</p> : !payments.length ? <p className="py-6 text-sm text-ink-muted">Nothing scheduled in the next 7 days.</p> : <>
      <ul className="divide-y divide-line">{payments.slice(0, 3).map(payment => <PaymentItem key={`${payment.type}:${payment.id}:${payment.dueDate}`} payment={payment} today={data!.today} />)}</ul>
      {payments.length > 3 && <details className="group mt-4 border-t border-line pt-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded text-xs font-medium text-ink-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mono [&::-webkit-details-marker]:hidden"><span className="group-open:hidden">Show {payments.length - 3} more payments</span><span className="hidden group-open:inline">Show fewer payments</span><ChevronDown aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-open:rotate-180" /></summary>
        <ul className="mt-4 max-h-80 divide-y divide-line overflow-y-auto">{payments.slice(3).map(payment => <PaymentItem key={`${payment.type}:${payment.id}:${payment.dueDate}`} payment={payment} today={data!.today} />)}</ul>
      </details>}
    </>}
  </section>;
}
