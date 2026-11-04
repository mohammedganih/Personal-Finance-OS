 'use client';

import { useMonthlyPlan } from '@/hooks/useMonthlyPlan';
import { PaymentActions } from '@/components/shared/PaymentActions';
import { ChevronDown } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';

export function MonthlyPayments({ type }: { type?: 'LOAN' | 'INVESTMENT' }) {
  const { data, isLoading, isError } = useMonthlyPlan();
  if (isLoading) return <div className="card-light rounded-2xl p-5">Loading monthly payments...</div>;
  if (isError || !data) return <div role="alert" className="card-light rounded-2xl p-5">Could not load monthly payments. Please refresh.</div>;
  if (!type) return <div className="grid h-full grid-cols-1 gap-4 md:grid-cols-2">
    {[data.current, data.next].map((plan, index) => <section key={plan.month} className="card-light flex h-full flex-col rounded-2xl p-5">
      <div className="flex min-h-10 flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink-primary">{index === 0 ? 'Still needed this month' : 'Prepare for next month'}</h3>
        <span className="text-xs text-ink-muted">{formatDate(`${plan.month}-01`, 'MMM yyyy')}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-ink-primary break-words">{formatCurrency(plan.remaining)}</p>
      <p className="mt-2 text-xs text-ink-muted">{plan.rows.filter(row => row.status === 'PENDING').length} outstanding payments</p>
      <dl className="my-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-xs">
        <div><dt className="text-ink-muted">Scheduled</dt><dd className="mt-1 font-medium tabular-nums text-ink-primary">{formatCurrency(plan.scheduled)}</dd></div>
        <div><dt className="text-ink-muted">Already paid</dt><dd className="mt-1 font-medium tabular-nums text-ink-primary">{formatCurrency(plan.paid)}</dd></div>
      </dl>
      <details className="group mt-auto border-t border-line pt-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded text-xs font-medium text-ink-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mono [&::-webkit-details-marker]:hidden"><span>View schedule breakdown</span><ChevronDown aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-open:rotate-180" /></summary>
        <dl className="mt-4 space-y-2 text-xs">{[['Loans', plan.loans], ['Credit cards', plan.creditCards], ['SIP / RD / Gold', plan.investments], ['Bills', plan.bills], ['Skipped', plan.skipped]].map(([label, amount]) => <div key={label} className="flex justify-between gap-3"><dt className="text-ink-muted">{label}</dt><dd className="font-medium tabular-nums text-ink-primary">{formatCurrency(Number(amount))}</dd></div>)}</dl>
        <p className="mt-4 text-xs leading-relaxed text-ink-muted">Based on saved schedules and recorded payments. Skipped EMIs remain debt. Overdue card balances are included this month; other previous overdue months are excluded. Next month assumes pending EMIs are paid this month. Card balances and card EMIs are tracked separately; future card spending is not estimated.</p>
      </details>
    </section>)}
  </div>;
  const rows = data.current.rows.filter(r => r.type === type || (type === 'LOAN' && ['CARD_EMI', 'CREDIT_CARD'].includes(r.type)));
  return <section className="card-light rounded-2xl p-5 space-y-4">
    <h3 className="text-sm font-semibold text-ink-primary">{type === 'LOAN' ? 'Loan and credit card' : 'SIP, RD & gold scheme'} payments - {formatDate(`${data.current.month}-01`, 'MMM yyyy')}</h3>
    <p className="text-xs text-ink-muted">Record a payment you have made, or skip this month. Use ⋯ to choose the account, a different amount or the date paid. Payments create transactions; skips record status without moving money; Undo reverses either.{type === 'LOAN' && ' Card EMIs are ticked off and paid with the card bill.'}</p>
    {rows.length === 0 && <p className="text-sm text-ink-muted">No monthly payments scheduled.</p>}
    {rows.map(row => <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-primary">{row.name}</p>
        <p className="text-xs text-ink-secondary">{formatCurrency(row.type === 'CREDIT_CARD' ? row.remaining ?? row.amount : row.amount)}{row.dueDate && <> · due {formatDate(row.dueDate, 'd MMM')}</>}{row.paidAmount ? <> · {formatCurrency(row.paidAmount)} paid so far</> : null}</p>
      </div>
      <PaymentActions row={row} planMonth={data.current.month} />
    </div>)}
  </section>;
}
