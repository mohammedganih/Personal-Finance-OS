'use client';

import { useState } from 'react';
import { ChevronRight, CreditCard as CardIcon, Plus } from 'lucide-react';
import { useCreditCards, useDeleteCreditCard } from '@/hooks/useCreditCards';
import { useCardEMIs } from '@/hooks/useCardEMIs';
import { useAccounts } from '@/hooks/useAccounts';
import {
  Breakdown, CardExpense, CardStatement, UpcomingStatement,
  useCardExpenses, useCardStatements, useDeleteCardExpense, useDeleteStatement, useUndoCardExpensePayment,
} from '@/hooks/useCardStatements';
import { PaymentActions } from '@/components/shared/PaymentActions';
import { CreditCardForm } from '@/components/loans/CreditCardForm';
import { CardEMIsDialog } from '@/components/loans/CardEMIsDialog';
import { CardExpenseDialog, PayExpenseDialog, StatementDialog } from './CardDialogs';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { CreditCard } from '@/types';

const pill = 'rounded-full border border-line-strong bg-paper-card px-3 py-1 text-xs font-medium text-ink-primary hover:bg-paper-subtle disabled:opacity-50';
const link = 'text-xs text-ink-muted underline underline-offset-2 hover:text-ink-primary';
const period = (s: { periodStart: string; statementDate: string }) => `${formatDate(s.periodStart, 'd MMM')} – ${formatDate(s.statementDate, 'd MMM yyyy')}`;

const STATUS: Record<CardStatement['status'], { label: string; tone: string }> = {
  DUE: { label: 'Due', tone: 'bg-amber-50 text-amber-800' },
  PART_PAID: { label: 'Part paid', tone: 'bg-amber-50 text-amber-800' },
  PAID: { label: 'Paid', tone: 'bg-updown-up-muted text-updown-up' },
};

function BreakdownList({ b, total }: { b: Breakdown; total: number | null }) {
  const group = (title: string, items: Breakdown['emis'], note?: string) => items.length > 0 && (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{title}<span className="ml-1 normal-case tracking-normal">· {formatCurrency(items.reduce((s, i) => s + i.amount, 0))}</span></p>
      <ul className="mt-1 grid gap-1">
        {items.map((i) => (
          <li key={`${i.kind}-${i.id}`} className="flex justify-between gap-3 text-[13px] text-ink-secondary">
            <span className="min-w-0 truncate">{i.name}{i.date && <span className="text-ink-muted"> · {formatDate(i.date, 'd MMM')}</span>}{i.linkedType && <span className="ml-1 rounded-full bg-paper-subtle px-1.5 text-[10px] text-ink-muted">counted in {i.linkedType === 'INVESTMENT' ? 'investments' : i.linkedType.toLowerCase() + 's'}</span>}</span>
            <span className="tabular-nums">{formatCurrency(i.amount)}</span>
          </li>
        ))}
      </ul>
      {note && <p className="mt-0.5 text-[11px] text-ink-muted">{note}</p>}
    </div>
  );
  return (
    <div className="grid gap-3 border-t border-line pt-3">
      {group('Card EMIs', b.emis)}
      {group('Card expenses', b.expenses)}
      {group('Bills on the card', b.bills)}
      {total != null && Math.abs(b.other) >= 0.01 && (
        <div className="flex justify-between gap-3 text-[13px] text-ink-secondary">
          <span>Other charges <span className="text-ink-muted">(interest, GST, fees or purchases not entered)</span></span>
          <span className="tabular-nums">{formatCurrency(b.other)}</span>
        </div>
      )}
      {group('Paid off straight away', b.paidOff, 'Not part of the total above.')}
      {!b.emis.length && !b.expenses.length && !b.bills.length && !b.paidOff.length && <p className="text-xs text-ink-muted">Nothing entered for this period yet.</p>}
    </div>
  );
}

function StatementRow({ card, st, onEdit }: { card: CreditCard; st: CardStatement; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  const del = useDeleteStatement();
  const s = STATUS[st.status];
  const row = {
    id: card.id, type: 'CREDIT_CARD', name: `${card.cardName} · ${formatDate(st.statementDate, 'MMM yyyy')} statement`,
    amount: st.totalDue, remaining: st.remaining, status: st.status === 'PAID' ? 'PAID' : 'PENDING',
    dueDate: st.dueDate, accountId: card.bankAccountId ?? null, creditCardId: card.id, statementId: st.id,
  };
  return (
    <li className="border-b border-line py-3 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-primary">
            {period(st)}
            <span className={cn('ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium', st.overdue ? 'bg-updown-down-muted text-updown-down' : s.tone)}>{st.overdue ? 'Overdue' : s.label}</span>
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            Due {formatDate(st.dueDate, 'd MMM yyyy')}{st.minimumDue != null && <> · minimum {formatCurrency(st.minimumDue)}{st.paidAmount > 0 && !st.minimumMet && <span className="text-updown-down"> (not met)</span>}</>}
          </p>
          {st.paidAmount > 0 && (
            <p className="text-xs text-ink-secondary">
              {formatCurrency(st.paidAmount)} paid{st.paidDate && <> on {formatDate(st.paidDate, 'd MMM')}</>}{st.paidFromAccountName ? <> from {st.paidFromAccountName}</> : null}
              {st.payments.length > 1 && <span className="text-ink-muted"> · {st.payments.length} payments</span>}
              {st.remaining > 0 && <> · {formatCurrency(st.remaining)} left</>}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-base font-semibold tabular-nums text-ink-primary">{formatCurrency(st.totalDue)}</p>
          <div className="mt-1"><PaymentActions row={row} planMonth={st.month} /></div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-3">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={cn(link, 'inline-flex items-center gap-0.5')}>
          <ChevronRight aria-hidden="true" className={cn('h-3 w-3 transition-transform', open && 'rotate-90')} />What&apos;s on it
        </button>
        <button type="button" onClick={onEdit} className={link}>Edit</button>
        {st.paidAmount === 0 && <button type="button" onClick={() => { if (window.confirm('Delete this statement?')) del.mutate(st.id); }} className={link}>Delete</button>}
      </div>
      {open && <div className="mt-2"><BreakdownList b={st.breakdown} total={st.totalDue} /></div>}
    </li>
  );
}

function UpcomingPanel({ up, onEnter }: { up: UpcomingStatement; onEnter: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl bg-paper-subtle p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink-primary">Building now · {period(up)}</p>
          <p className="text-xs text-ink-muted">Statement on {formatDate(up.statementDate, 'd MMM')}, due {formatDate(up.dueDate, 'd MMM yyyy')}. From EMIs, card expenses and card bills entered so far.</p>
        </div>
        <div className="text-right">
          <p className="text-base font-semibold tabular-nums text-ink-primary">{formatCurrency(up.estimatedTotal)}</p>
          <p className="text-[11px] text-ink-muted">so far</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-3">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={cn(link, 'inline-flex items-center gap-0.5')}>
          <ChevronRight aria-hidden="true" className={cn('h-3 w-3 transition-transform', open && 'rotate-90')} />What&apos;s on it
        </button>
        <button type="button" onClick={onEnter} className={link}>Statement arrived? Enter it</button>
      </div>
      {open && <div className="mt-2"><BreakdownList b={up.breakdown} total={null} /></div>}
    </div>
  );
}

function ExpenseRow({ card, e, onEdit, onPay }: { card: CreditCard; e: CardExpense; onEdit: () => void; onPay: () => void }) {
  const del = useDeleteCardExpense();
  const undo = useUndoCardExpensePayment();
  const { data: accounts } = useAccounts();
  const from = accounts?.find((a) => a.id === e.paidFromAccountId)?.name;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink-primary">{e.name}</p>
        <p className="text-xs text-ink-muted">
          {formatDate(e.date, 'd MMM yyyy')} · {e.category} ·{' '}
          {e.paidDate
            ? <span className="text-updown-up">paid off {formatDate(e.paidDate, 'd MMM')}{from ? ` from ${from}` : ''}</span>
            : <>on the {formatDate(`${e.statementMonth}-01`, 'MMM')} statement</>}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold tabular-nums text-ink-primary">{formatCurrency(e.amount)}</span>
        {e.paidDate
          ? <button type="button" disabled={undo.isPending} onClick={() => { if (window.confirm(`Undo the payment for ${e.name}?`)) undo.mutate(e.id); }} className={pill}>Undo</button>
          : <button type="button" onClick={onPay} className={pill} title="Paid it back to the card straight away">Paid off</button>}
        <button type="button" onClick={onEdit} className={link}>Edit</button>
        <button type="button" onClick={() => { if (window.confirm(`Delete ${e.name}?${e.paidDate ? ' Its payment is undone too.' : ''}`)) del.mutate(e.id); }} className={link}>Delete</button>
      </div>
    </li>
  );
}

function CardPanel({ card }: { card: CreditCard }) {
  const { data: emis } = useCardEMIs(false);
  const { data: accounts } = useAccounts();
  const { data, isLoading } = useCardStatements(card.id);
  const { data: expenses } = useCardExpenses(card.id);
  const deleteCard = useDeleteCreditCard();
  const [dialog, setDialog] = useState<
    | { kind: 'statement'; statement?: CardStatement; suggested?: UpcomingStatement }
    | { kind: 'expense'; expense?: CardExpense }
    | { kind: 'pay'; expense: CardExpense }
    | { kind: 'emis' } | { kind: 'edit' } | null
  >(null);
  const [showAll, setShowAll] = useState(false);

  const active = (emis ?? []).filter((e) => e.creditCardId === card.id && !e.isArchived);
  const emiOutstanding = active.reduce((s, e) => s + e.outstanding, 0);
  const used = card.outstanding + emiOutstanding;
  const utilization = card.creditLimit > 0 ? Math.min(100, (used / card.creditLimit) * 100) : 0;
  const payFrom = accounts?.find((a) => a.id === card.bankAccountId)?.name;
  const list = expenses ?? [];
  // An entered statement not yet paid in full; otherwise the statement building now
  // (EMIs + card expenses + card bills so far), which switches to the real one once entered.
  const unpaid = data?.statements.find((st) => st.status !== 'PAID');
  const current = data && (unpaid
    ? { amount: unpaid.remaining, dueDate: unpaid.dueDate, unpaid: true }
    : { amount: data.upcoming.estimatedTotal, dueDate: data.upcoming.dueDate, unpaid: false });
  const shown = showAll ? list : list.slice(0, 8);

  return (
    <div className="space-y-4">
      <section className="card-light rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-paper-subtle text-ink-primary"><CardIcon className="h-5 w-5" /></span>
            <div>
              <h2 className="text-base font-semibold text-ink-primary">{card.cardName}</h2>
              <p className="text-xs text-ink-muted">{card.bank ?? 'Credit card'}{card.lastFourDigits ? ` •••• ${card.lastFourDigits}` : ''}{payFrom ? ` · bill paid from ${payFrom}` : ''}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setDialog({ kind: 'expense' })} className="inline-flex items-center gap-1 rounded-full bg-mono px-3 py-1.5 text-xs font-medium text-white hover:bg-mono-hover"><Plus className="h-3.5 w-3.5" />Card expense</button>
            <button type="button" onClick={() => setDialog({ kind: 'statement', suggested: data?.upcoming })} className={pill}>Add statement</button>
            <button type="button" onClick={() => setDialog({ kind: 'emis' })} className={pill}>EMIs ({active.length})</button>
            <button type="button" onClick={() => setDialog({ kind: 'edit' })} className={pill}>Edit card</button>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-ink-muted">{current?.unpaid ? 'Statement due' : 'Current statement'}</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums text-ink-primary">{current ? formatCurrency(current.amount) : '…'}</dd>
            {current && <dd className="text-ink-muted">{current.unpaid ? 'left to pay' : 'so far'} · due {formatDate(current.dueDate, 'd MMM')}</dd>}
          </div>
          <div><dt className="text-ink-muted">EMIs still to bill</dt><dd className="mt-1 text-sm font-semibold tabular-nums text-ink-primary">{formatCurrency(emiOutstanding)}</dd><dd className="text-ink-muted">{active.length} active</dd></div>
          <div><dt className="text-ink-muted">Credit limit</dt><dd className="mt-1 text-sm font-semibold tabular-nums text-ink-primary">{formatCurrency(card.creditLimit, 'INR', true)}</dd></div>
          <div>
            <dt className="text-ink-muted">Used</dt><dd className="mt-1 text-sm font-semibold tabular-nums text-ink-primary">{utilization.toFixed(1)}%</dd>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper-subtle"><div className="h-full rounded-full bg-mono" style={{ width: `${utilization}%` }} /></div>
          </div>
        </dl>
      </section>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5">
        <section className="card-light rounded-2xl p-5 lg:col-span-3">
          <h3 className="text-sm font-semibold text-ink-primary">Statements</h3>
          <p className="mb-3 text-xs text-ink-muted">Each month&apos;s statement as printed, with what you paid. Pay and Undo work like everywhere else.</p>
          {isLoading || !data ? <div className="h-32 rounded-xl shimmer" /> : (
            <>
              <UpcomingPanel up={data.upcoming} onEnter={() => setDialog({ kind: 'statement', suggested: data.upcoming })} />
              {data.statements.length === 0
                ? <p className="mt-4 text-sm text-ink-muted">No statements entered yet.</p>
                : <ul className="mt-2">{data.statements.map((st) => <StatementRow key={st.id} card={card} st={st} onEdit={() => setDialog({ kind: 'statement', statement: st })} />)}</ul>}
            </>
          )}
        </section>

        <section className="card-light rounded-2xl p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-ink-primary">Card expenses</h3>
          <p className="mb-2 text-xs text-ink-muted">One-off purchases on the card (not EMIs). Mark one &ldquo;Paid off&rdquo; if you cleared it from your bank the same month.</p>
          {list.length === 0 ? <p className="py-6 text-center text-sm text-ink-muted">No card expenses yet.</p> : (
            <ul>{shown.map((e) => <ExpenseRow key={e.id} card={card} e={e} onEdit={() => setDialog({ kind: 'expense', expense: e })} onPay={() => setDialog({ kind: 'pay', expense: e })} />)}</ul>
          )}
          {list.length > 8 && <button type="button" onClick={() => setShowAll((v) => !v)} className={cn(link, 'mt-2')}>{showAll ? 'Show fewer' : `Show all ${list.length}`}</button>}
        </section>
      </div>

      {dialog?.kind === 'statement' && <StatementDialog card={card} statement={dialog.statement} suggested={dialog.suggested} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'expense' && <CardExpenseDialog card={card} expense={dialog.expense} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'pay' && <PayExpenseDialog card={card} expense={dialog.expense} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'emis' && <CardEMIsDialog card={card} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'edit' && <CreditCardForm card={card} onClose={() => setDialog(null)} />}
      <p className="text-right">
        <button type="button" className={link} onClick={() => { if (window.confirm(`Delete ${card.cardName}? Its EMIs, statements and card expenses are deleted too.`)) deleteCard.mutate(card.id); }}>Delete this card</button>
      </p>
    </div>
  );
}

export function CreditCardsView() {
  const { data: cards, isLoading } = useCreditCards();
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  if (isLoading) return <div className="card-light h-96 rounded-2xl shimmer" />;
  const active = (cards ?? []).filter((c) => c.isActive);
  const card = active.find((c) => c.id === selected) ?? active[0];
  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Cards">
          {active.length > 1 && active.map((c) => (
            <button key={c.id} type="button" role="tab" aria-selected={c.id === card?.id} onClick={() => setSelected(c.id)}
              className={cn('rounded-full px-3 py-1.5 text-xs font-medium', c.id === card?.id ? 'bg-mono text-white' : 'border border-line-strong text-ink-primary hover:bg-paper-subtle')}>
              {c.cardName}{c.lastFourDigits ? ` ··${c.lastFourDigits}` : ''}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setAdding(true)} className={pill}>Add a card</button>
      </div>
      {card ? (
        <CardPanel key={card.id} card={card} />
      ) : (
        <div className="card-light grid h-48 place-items-center rounded-2xl text-sm text-ink-muted">No credit cards yet.</div>
      )}
      {adding && <CreditCardForm onClose={() => setAdding(false)} />}
    </div>
  );
}
