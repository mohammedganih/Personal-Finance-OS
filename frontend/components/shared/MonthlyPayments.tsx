 'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useMonthlyPlan, useUndoPayment, UNDOABLE_TYPES, MonthlyPaymentRow } from '@/hooks/useMonthlyPlan';
import { useAccounts } from '@/hooks/useAccounts';
import { ChevronDown } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { useToast } from '@/components/ui/use-toast';

export function MonthlyPayments({ type }: { type?: 'LOAN' | 'INVESTMENT' }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: accounts } = useAccounts();
  const [accountId, setAccountId] = useState('');
  const { data, isLoading, isError } = useMonthlyPlan();
  const undo = useUndoPayment();
  const action = useMutation({ mutationFn: ({ row, status }: { row: MonthlyPaymentRow; status: string }) => row.type === 'CARD_EMI'
    ? api.post(`/card-emis/${row.id}/pay`, { accountId: accountId || undefined })
    : api.post('/dashboard/monthly-payment', { type: row.type, id: row.id, status, accountId: accountId || row.accountId || undefined }),
    onSuccess: () => { qc.invalidateQueries(); toast({ title: 'Monthly status updated' }); },
    onError: (error: unknown) => { const e = error as { response?: { data?: { message?: string } } }; toast({ title: e.response?.data?.message || 'Could not record payment', variant: 'destructive' }); },
  });
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
    <h3 className="text-sm font-semibold text-ink-primary">{type === 'LOAN' ? 'Loan and credit card' : 'SIP, RD & gold scheme'} payments - {data.current.month}</h3>
    <p className="text-xs text-ink-muted">Record a payment you have made, or skip this month. Payments create transactions; skips record status without moving money. Earlier transactions are not automatically matched to an installment.</p>
    <label className="flex flex-wrap gap-2 items-center text-sm text-ink-secondary">Pay from <select aria-label="Payment account" value={accountId} onChange={e => setAccountId(e.target.value)} className="bg-paper-subtle border border-line rounded-lg p-2"><option value="">Linked account / no account</option>{accounts?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    {rows.length === 0 && <p className="text-sm text-ink-muted">No monthly payments scheduled.</p>}
    {rows.map(row => <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
      <div><p className="text-sm font-medium text-ink-primary">{row.name}</p><p className="text-xs text-ink-secondary">{formatCurrency(row.amount)} | {row.status === 'PAID' ? 'Paid this month' : row.status === 'SKIPPED' ? 'Skipped this month' : 'Not paid this month'}</p></div>
      {row.dueDate && <span className="text-xs text-ink-muted">Due {row.dueDate}</span>}
      {UNDOABLE_TYPES.includes(row.type) && row.status !== 'PENDING' && <button disabled={undo.isPending} onClick={() => { if (window.confirm(`Undo the ${row.status === 'PAID' ? 'payment' : 'skip'} for ${row.name}?`)) undo.mutate({ type: row.type, id: row.id, month: row.type === 'CARD_EMI' ? row.dueDate?.slice(0, 7) : data.current.month }); }} className="border border-line rounded-lg px-3 py-2 text-xs disabled:opacity-50">Undo</button>}
      {row.type === 'CREDIT_CARD' && row.status !== 'PAID' && <a href="#your-loans" className="text-xs underline text-ink-secondary">Pay via Pay Bill below</a>}
      {['LOAN', 'INVESTMENT', 'CARD_EMI'].includes(row.type) && row.status !== 'PAID' && <div className="flex gap-2"><button disabled={action.isPending} onClick={() => action.mutate({ row, status: 'PAID' })} className="bg-mono text-white rounded-lg px-3 py-2 text-xs disabled:opacity-50">{row.type === 'CARD_EMI' ? 'Tick off' : row.status === 'SKIPPED' ? 'Pay instead' : 'Record payment'}</button>{row.type !== 'CARD_EMI' && row.status !== 'SKIPPED' && <button disabled={action.isPending} onClick={() => action.mutate({ row, status: 'SKIPPED' })} className="border border-line rounded-lg px-3 py-2 text-xs disabled:opacity-50">Skip this month</button>}</div>}
    </div>)}
  </section>;
}
