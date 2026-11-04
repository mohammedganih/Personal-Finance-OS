'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import { useAccounts } from '@/hooks/useAccounts';
import { useUndoPayment, UNDOABLE_TYPES, MonthlyPaymentRow } from '@/hooks/useMonthlyPlan';
import { useToast } from '@/components/ui/use-toast';

// One set of Pay / Tick off / Skip / Undo controls, shared by Home, Loans,
// Investments and Bills, so every payment behaves the same everywhere.

export type PayableRow = Pick<MonthlyPaymentRow, 'id' | 'type' | 'name' | 'amount' | 'status' | 'dueDate' | 'accountId' | 'creditCardId' | 'remaining'>;
export interface PayOptions { accountId?: string; amount?: number; paidDate?: string }

/** Card EMIs and bills charged to a card are paid with the card bill: ticking them moves no money. */
export const isTickOnly = (r: Pick<PayableRow, 'type' | 'creditCardId'>) => r.type === 'CARD_EMI' || (r.type === 'BILL' && !!r.creditCardId);
const canSkip = (r: PayableRow) => r.type === 'LOAN' || r.type === 'INVESTMENT' || r.type === 'BILL';
const todayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

const pill = 'rounded-full border border-line-strong bg-paper-card px-3 py-1 text-xs font-medium text-ink-primary hover:bg-paper-subtle disabled:opacity-50';

function request(row: PayableRow, planMonth: string | undefined, status: 'PAID' | 'SKIPPED', o: PayOptions) {
  switch (row.type) {
    case 'BILL':
      return status === 'SKIPPED'
        ? api.post(`/bills/${row.id}/skip`, { dueDate: row.dueDate })
        : api.post(`/bills/${row.id}/pay`, { createTransaction: true, dueDate: row.dueDate, amount: o.amount, paidDate: o.paidDate, accountId: o.accountId ?? (row.creditCardId ? undefined : row.accountId ?? undefined) });
    case 'CARD_EMI':
      return api.post(`/card-emis/${row.id}/pay`, {});
    case 'CREDIT_CARD':
      return api.post(`/credit-cards/${row.creditCardId ?? row.id}/pay`, { amount: o.amount ?? row.remaining ?? row.amount, accountId: o.accountId ?? row.accountId ?? undefined });
    default:
      return api.post('/dashboard/monthly-payment', { type: row.type, id: row.id, status, month: planMonth, accountId: o.accountId ?? row.accountId ?? undefined, amount: o.amount, paidDate: o.paidDate });
  }
}

/** Pay / skip with a "· Undo" toast, plus a plain undo. */
export function usePaymentActions() {
  const qc = useQueryClient();
  const { toast, dismiss } = useToast();
  const undo = useUndoPayment();
  const pay = useMutation({
    mutationFn: ({ row, planMonth, status, options }: { row: PayableRow; planMonth?: string; status: 'PAID' | 'SKIPPED'; options: PayOptions }) =>
      request(row, planMonth, status, options),
    onSuccess: (_res, { row, planMonth, status, options }) => {
      qc.invalidateQueries();
      const month = row.type === 'LOAN' || row.type === 'INVESTMENT' ? planMonth : row.dueDate?.slice(0, 7);
      const id = toast({
        title: status === 'SKIPPED' ? 'Skipped this month' : isTickOnly(row) ? 'Ticked off · paid with the card bill' : 'Payment recorded',
        description: `${row.name} · ${formatCurrency(options.amount ?? (row.type === 'CREDIT_CARD' ? row.remaining ?? row.amount : row.amount))}`,
        duration: 10_000,
        action: (
          <button type="button" className={cn(pill, 'mr-6 shrink-0')} onClick={() => { undo.mutate({ type: row.type, id: row.creditCardId && row.type === 'CREDIT_CARD' ? row.creditCardId : row.id, month, dueDate: row.dueDate }); dismiss(id); }}>
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
  return { pay, undo, busy: pay.isPending || undo.isPending };
}

export function PaymentActions({ row, planMonth, className }: { row: PayableRow; planMonth?: string; className?: string }) {
  const { pay, undo, busy } = usePaymentActions();
  const { data: accounts } = useAccounts();
  const [open, setOpen] = useState(false);
  const owed = row.type === 'CREDIT_CARD' ? row.remaining ?? row.amount : row.amount;
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState(String(owed));
  const [paidDate, setPaidDate] = useState(todayKey());
  const box = useRef<HTMLDivElement>(null);
  const tickOnly = isTickOnly(row);
  const movesMoney = !tickOnly;
  const needsDate = row.type === 'BILL' && !row.dueDate;

  useEffect(() => { setAmount(String(owed)); }, [owed]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);

  if (row.status !== 'PENDING') {
    if (!UNDOABLE_TYPES.includes(row.type)) return null;
    const month = row.type === 'LOAN' || row.type === 'INVESTMENT' ? planMonth : row.dueDate?.slice(0, 7);
    return (
      <span className={cn('inline-flex items-center gap-2', className)}>
        <span className="text-xs text-ink-muted">{row.status === 'SKIPPED' ? 'Skipped' : 'Paid'}</span>
        <button
          type="button" disabled={busy} className={pill}
          onClick={() => { if (window.confirm(`Undo the ${row.status === 'SKIPPED' ? 'skip' : 'payment'} for ${row.name}?`)) undo.mutate({ type: row.type, id: row.type === 'CREDIT_CARD' ? row.creditCardId ?? row.id : row.id, month, dueDate: row.dueDate }); }}
        >
          Undo
        </button>
      </span>
    );
  }

  const submit = (status: 'PAID' | 'SKIPPED', withOptions: boolean) => {
    const n = Number(amount);
    const options: PayOptions = withOptions && movesMoney ? {
      accountId: accountId || undefined,
      amount: Number.isFinite(n) && n > 0 && n !== owed ? n : undefined,
      paidDate: row.type === 'CREDIT_CARD' || paidDate === todayKey() ? undefined : paidDate,
    } : {};
    pay.mutate({ row, planMonth, status, options }, { onSuccess: () => setOpen(false) });
  };

  return (
    <div ref={box} className={cn('relative inline-flex items-center gap-1.5', className)}>
      <button type="button" disabled={busy || needsDate} onClick={() => (row.type === 'CREDIT_CARD' ? setOpen(true) : submit('PAID', false))} className={pill}
        title={tickOnly ? 'Counts it as part of the card bill. No money moves.' : undefined}>
        {tickOnly ? 'Tick off' : row.type === 'CREDIT_CARD' ? 'Pay card' : 'Mark paid'}
      </button>
      {(movesMoney || canSkip(row)) && (
        <button type="button" aria-label={`More options for ${row.name}`} aria-expanded={open} onClick={() => setOpen((o) => !o)} className="grid h-7 w-7 place-items-center rounded-full text-ink-muted hover:bg-paper-subtle hover:text-ink-primary">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      )}
      {open && (
        <div role="dialog" aria-label={`Pay ${row.name}`} className="absolute right-0 top-full z-30 mt-1 grid w-72 gap-2.5 rounded-xl border border-line bg-paper-card p-3 text-left text-xs text-ink-secondary shadow-lg">
          <p className="text-sm font-medium text-ink-primary">{row.name}</p>
          {movesMoney && <>
            <label className="grid gap-1">Paid from
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="rounded-lg border border-line bg-paper-subtle p-2 text-ink-primary">
                <option value="">{row.accountId ? `Linked account (${accounts?.find((a) => a.id === row.accountId)?.name ?? 'saved'})` : 'No account (cash / other)'}</option>
                {accounts?.filter((a) => a.isActive !== false).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1">Amount
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-lg border border-line bg-paper-subtle p-2 tabular-nums text-ink-primary" />
            </label>
            {row.type !== 'CREDIT_CARD' && (
              <label className="grid gap-1">Paid on
                <input type="date" value={paidDate} max={todayKey()} onChange={(e) => setPaidDate(e.target.value)} className="rounded-lg border border-line bg-paper-subtle p-2 text-ink-primary" />
              </label>
            )}
          </>}
          <div className="flex flex-wrap gap-2 pt-1">
            {movesMoney && <button type="button" disabled={busy} onClick={() => submit('PAID', true)} className="rounded-lg bg-mono px-3 py-1.5 font-medium text-white disabled:opacity-50">Save payment</button>}
            {canSkip(row) && <button type="button" disabled={busy || needsDate} onClick={() => submit('SKIPPED', false)} className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-50">Skip this month</button>}
          </div>
        </div>
      )}
    </div>
  );
}
