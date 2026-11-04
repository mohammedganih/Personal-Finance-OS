'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useAccounts } from '@/hooks/useAccounts';
import { useCategories } from '@/hooks/useCategories';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import {
  CardExpense, CardStatement, UpcomingStatement,
  useCreateCardExpense, useSaveStatement, useUpdateCardExpense, usePayCardExpense,
} from '@/hooks/useCardStatements';
import { formatCurrency, formatDate } from '@/lib/format';
import { CreditCard } from '@/types';

export const todayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
export const field = 'w-full rounded-lg border border-line bg-paper-subtle p-2 text-sm text-ink-primary';
const primary = 'rounded-full bg-mono px-4 py-2 text-xs font-medium text-white hover:bg-mono-hover disabled:opacity-50';
const secondary = 'rounded-full border border-line-strong px-4 py-2 text-xs font-medium text-ink-primary hover:bg-paper-subtle';

/** Light-theme dialog shell, matching the other paper-and-ink pages. */
export function LightDialog({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-paper-card p-5 shadow-soft">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-base font-semibold text-ink-primary">{title}</Dialog.Title>
              {subtitle && <Dialog.Description className="mt-0.5 text-xs text-ink-muted">{subtitle}</Dialog.Description>}
            </div>
            <Dialog.Close aria-label="Close" className="rounded-lg p-1 text-ink-muted hover:bg-paper-subtle hover:text-ink-primary"><X className="h-4 w-4" /></Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Field({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: React.ReactNode; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="grid gap-1 text-xs text-ink-secondary">
      {label}
      {children}
      {hint && <span className="text-[11px] text-ink-muted">{hint}</span>}
    </label>
  );
}

function AccountSelect({ id, value, onChange, card }: { id: string; value: string; onChange: (v: string) => void; card: CreditCard }) {
  const { data: accounts } = useAccounts();
  const linked = accounts?.find((a) => a.id === card.bankAccountId);
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={field}>
      <option value="">{linked ? `Card's bill account (${linked.name})` : 'No account (cash / other)'}</option>
      {accounts?.filter((a) => a.isActive !== false && a.type !== 'CREDIT_CARD').map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
    </select>
  );
}

/** Enter (or correct) a statement exactly as printed. */
export function StatementDialog({ card, statement, suggested, onClose }: { card: CreditCard; statement?: CardStatement; suggested?: UpcomingStatement; onClose: () => void }) {
  const save = useSaveStatement();
  const base = statement ?? suggested;
  const [statementDate, setStatementDate] = useState(base?.statementDate ?? '');
  const [dueDate, setDueDate] = useState(base?.dueDate ?? '');
  const [periodStart, setPeriodStart] = useState(base?.periodStart ?? '');
  const [total, setTotal] = useState(statement ? String(statement.totalDue) : '');
  const [minimum, setMinimum] = useState(statement?.minimumDue != null ? String(statement.minimumDue) : '');
  const [notes, setNotes] = useState(statement?.notes ?? '');
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(statementDate) && dueDate >= statementDate && total !== '' && Number(total) >= 0 && (!periodStart || periodStart <= statementDate);
  return (
    <LightDialog title={statement ? 'Edit statement' : 'Add statement'} subtitle={`${card.cardName}${card.lastFourDigits ? ` •••• ${card.lastFourDigits}` : ''} · enter the figures as printed on the statement`} onClose={onClose}>
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Statement date" htmlFor="st-date"><input id="st-date" type="date" value={statementDate} onChange={(e) => setStatementDate(e.target.value)} className={field} /></Field>
          <Field label="Due date" htmlFor="st-due"><input id="st-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={field} /></Field>
        </div>
        <Field label="Period starts" htmlFor="st-start" hint="Leave as is unless your statement shows a different start."><input id="st-start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className={field} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Total due" htmlFor="st-total"><input id="st-total" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="37548.11" className={`${field} tabular-nums`} /></Field>
          <Field label="Minimum due" htmlFor="st-min"><input id="st-min" inputMode="decimal" value={minimum} onChange={(e) => setMinimum(e.target.value)} placeholder="15280" className={`${field} tabular-nums`} /></Field>
        </div>
        <Field label="Notes" htmlFor="st-notes"><input id="st-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className={field} /></Field>
        {dueDate && statementDate && dueDate < statementDate && <p className="text-xs text-updown-down">The due date must be on or after the statement date.</p>}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={secondary}>Cancel</button>
        <button type="button" disabled={!valid || save.isPending} className={primary} onClick={() => save.mutate(
          { cardId: card.id, statementDate, dueDate, periodStart: periodStart || undefined, totalDue: Number(total), minimumDue: minimum === '' ? null : Number(minimum), notes: notes || null },
          { onSuccess: onClose },
        )}>Save statement</button>
      </div>
    </LightDialog>
  );
}

/** A one-off purchase on the card (not an EMI), optionally already paid off from a bank account. */
export function CardExpenseDialog({ card, expense, onClose }: { card: CreditCard; expense?: CardExpense; onClose: () => void }) {
  const create = useCreateCardExpense();
  const update = useUpdateCardExpense();
  const { data: categories } = useCategories();
  const { data: members } = useFamilyMembers();
  const [name, setName] = useState(expense?.name ?? '');
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [date, setDate] = useState(expense?.date ?? todayKey());
  const [category, setCategory] = useState(expense?.category ?? 'Shopping');
  const [memberId, setMemberId] = useState(expense?.memberId ?? card.memberId ?? '');
  const [notes, setNotes] = useState(expense?.notes ?? '');
  const [paidOff, setPaidOff] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [paidDate, setPaidDate] = useState(todayKey());
  const n = Number(amount);
  const valid = name.trim() !== '' && n > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const busy = create.isPending || update.isPending;
  const names = Array.from(new Set(['Shopping', 'Groceries', 'Food & Dining', 'Subscriptions', 'Entertainment', 'Travel', 'Healthcare', ...(categories ?? []).filter((c) => c.type === 'EXPENSE').map((c) => c.name), 'Other']));
  const submit = () => {
    const body = { name: name.trim(), amount: n, date, category, memberId: memberId || null, notes: notes || null };
    if (expense) update.mutate({ id: expense.id, ...body, ...(expense.paidDate ? { amount: undefined } : {}) }, { onSuccess: onClose });
    else create.mutate({ creditCardId: card.id, ...body, ...(paidOff && { payNow: { accountId: accountId || null, paidDate } }) }, { onSuccess: onClose });
  };
  return (
    <LightDialog title={expense ? 'Edit card expense' : 'Add card expense'} subtitle={`A one-off purchase on ${card.cardName}, not an EMI. It goes on the statement for the period it falls in.`} onClose={onClose}>
      <div className="grid gap-3">
        <Field label="What was it?" htmlFor="ce-name"><input id="ce-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Lenskart" className={field} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount" htmlFor="ce-amount"><input id="ce-amount" inputMode="decimal" value={amount} disabled={!!expense?.paidDate} onChange={(e) => setAmount(e.target.value)} placeholder="7799" className={`${field} tabular-nums disabled:opacity-60`} /></Field>
          <Field label="Date" htmlFor="ce-date"><input id="ce-date" type="date" value={date} max={todayKey()} onChange={(e) => setDate(e.target.value)} className={field} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category" htmlFor="ce-cat">
            <select id="ce-cat" value={category} onChange={(e) => setCategory(e.target.value)} className={field}>{names.map((c) => <option key={c}>{c}</option>)}</select>
          </Field>
          <Field label="Who it's for" htmlFor="ce-member">
            <select id="ce-member" value={memberId} onChange={(e) => setMemberId(e.target.value)} className={field}>
              <option value="">Not set</option>
              {members?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Notes" htmlFor="ce-notes"><input id="ce-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className={field} /></Field>
        {expense?.paidDate && <p className="text-xs text-ink-muted">Paid off on {formatDate(expense.paidDate, 'd MMM yyyy')}. Undo the payment to change the amount.</p>}
        {!expense && (
          <div className="rounded-xl border border-line p-3">
            <label className="flex items-center gap-2 text-sm text-ink-primary">
              <input type="checkbox" checked={paidOff} onChange={(e) => setPaidOff(e.target.checked)} className="h-4 w-4 accent-[var(--color-mono,#111)]" />
              I&apos;ve already paid this off
            </label>
            <p className="mt-1 text-[11px] text-ink-muted">Records the payment from a bank account now, so it won&apos;t count towards the statement.</p>
            {paidOff && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="Paid from" htmlFor="ce-acct"><AccountSelect id="ce-acct" value={accountId} onChange={setAccountId} card={card} /></Field>
                <Field label="Paid on" htmlFor="ce-paid"><input id="ce-paid" type="date" value={paidDate} max={todayKey()} onChange={(e) => setPaidDate(e.target.value)} className={field} /></Field>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={secondary}>Cancel</button>
        <button type="button" disabled={!valid || busy} onClick={submit} className={primary}>{expense ? 'Save' : paidOff ? `Add and pay ${n > 0 ? formatCurrency(n) : ''}` : 'Add expense'}</button>
      </div>
    </LightDialog>
  );
}

/** Pay off an existing card purchase from a bank account. */
export function PayExpenseDialog({ card, expense, onClose }: { card: CreditCard; expense: CardExpense; onClose: () => void }) {
  const pay = usePayCardExpense();
  const [accountId, setAccountId] = useState('');
  const [paidDate, setPaidDate] = useState(todayKey());
  return (
    <LightDialog title={`Mark paid off · ${expense.name}`} subtitle={`${formatCurrency(expense.amount)} paid back to ${card.cardName} straight away.`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Paid from" htmlFor="pe-acct"><AccountSelect id="pe-acct" value={accountId} onChange={setAccountId} card={card} /></Field>
        <Field label="Paid on" htmlFor="pe-date"><input id="pe-date" type="date" value={paidDate} max={todayKey()} onChange={(e) => setPaidDate(e.target.value)} className={field} /></Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={secondary}>Cancel</button>
        <button type="button" disabled={pay.isPending} className={primary} onClick={() => pay.mutate({ id: expense.id, accountId: accountId || null, paidDate }, { onSuccess: onClose })}>Record payment</button>
      </div>
    </LightDialog>
  );
}
