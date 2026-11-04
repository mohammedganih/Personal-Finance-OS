'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/lib/format';
import { useMonthlyPlan, useUndoPayment, MonthlyPaymentRow } from '@/hooks/useMonthlyPlan';
import { useAccountFunding } from '@/hooks/useAccountFunding';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { useCreditCards } from '@/hooks/useCreditCards';
import { useToast } from '@/components/ui/use-toast';

// Pending rows for the current calendar month, earliest first. Card EMIs and
// bills charged to a card sit under their card: ticking them moves no money,
// paying the card bill does. Mark paid offers Undo in its confirmation toast.

const isOnCard = (r: MonthlyPaymentRow) => r.type === 'CARD_EMI' || (r.type === 'BILL' && !!r.creditCardId);
const owed = (r: MonthlyPaymentRow) => (r.type === 'CREDIT_CARD' ? r.remaining ?? r.amount : r.amount);

type CardGroup = { kind: 'card'; cardId: string; name: string; statement?: MonthlyPaymentRow; items: MonthlyPaymentRow[]; dueDate?: string; memberId?: string | null };
type Entry = { kind: 'row'; row: MonthlyPaymentRow; dueDate?: string } | CardGroup;

function useMarkPaid() {
  const qc = useQueryClient();
  const { toast, dismiss } = useToast();
  const undo = useUndoPayment();
  const pay = useMutation({
    mutationFn: (row: MonthlyPaymentRow) => row.type === 'BILL'
      ? api.post(`/bills/${row.id}/pay`, { createTransaction: true, dueDate: row.dueDate, accountId: row.creditCardId ? undefined : row.accountId ?? undefined })
      : row.type === 'CARD_EMI'
        ? api.post(`/card-emis/${row.id}/pay`, {})
        : api.post('/dashboard/monthly-payment', { type: row.type, id: row.id, status: 'PAID', accountId: row.accountId || undefined }),
    onSuccess: (_res, row) => {
      qc.invalidateQueries();
      const target = { type: row.type, id: row.id, month: row.dueDate?.slice(0, 7), dueDate: row.dueDate };
      const id = toast({
        title: isOnCard(row) ? 'Ticked off · paid with the card bill' : 'Payment recorded',
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

/** Plain rows plus one group per card (its statement, EMIs and card-charged bills). */
export function buildEntries(rows: MonthlyPaymentRow[], cardNames: Map<string, string>): Entry[] {
  const groups = new Map<string, CardGroup>();
  const entries: Entry[] = [];
  for (const row of rows) {
    const cardId = row.type === 'CREDIT_CARD' ? row.creditCardId ?? row.id : isOnCard(row) ? row.creditCardId : undefined;
    if (!cardId) { entries.push({ kind: 'row', row, dueDate: row.dueDate }); continue; }
    let g = groups.get(cardId);
    if (!g) {
      g = { kind: 'card', cardId, name: cardNames.get(cardId) ?? 'Card', items: [] };
      groups.set(cardId, g);
      entries.push(g);
    }
    if (row.type === 'CREDIT_CARD') { g.statement = row; g.name = row.name.replace(/ - statement balance$/, ''); g.memberId = row.memberId; }
    else g.items.push(row);
  }
  for (const g of Array.from(groups.values())) {
    g.dueDate = g.statement?.dueDate ?? g.items.map((i) => i.dueDate).filter(Boolean).sort()[0];
    g.memberId ??= g.items[0]?.memberId;
  }
  return entries.sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
}

function DateCell({ date }: { date?: string }) {
  return (
    <div className="text-center text-[11px] leading-tight text-ink-muted">
      {date ? <><b className="block text-base text-ink-primary">{formatDate(date, 'd')}</b>{formatDate(date, 'MMM')}</> : '—'}
    </div>
  );
}

const pill = 'rounded-full border border-line-strong bg-paper-card px-3 py-1 text-xs font-medium text-ink-primary hover:bg-paper-subtle disabled:opacity-50';

function CardGroupRow({ group, who, mark, pending }: { group: CardGroup; who: string; mark: (r: MonthlyPaymentRow) => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  const inside = group.items.reduce((s, i) => s + i.amount, 0);
  const st = group.statement;
  const amount = st ? owed(st) : inside;
  return (
    <li className="border-b border-line py-2.5 last:border-b-0">
      <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[52px_minmax(0,1fr)_auto_auto]">
        <DateCell date={group.dueDate} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink-primary">{group.name} bill</p>
          <p className="text-xs text-ink-muted">
            {who}
            {group.items.length > 0 && (
              <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="ml-1.5 inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-ink-primary">
                <ChevronRight aria-hidden="true" className={cn('h-3 w-3 transition-transform', open && 'rotate-90')} />
                includes {group.items.length} {group.items.length === 1 ? 'item' : 'items'} · {formatCurrency(inside)}
              </button>
            )}
          </p>
          {!st && <p className="text-[11px] text-amber-800">Statement not entered yet. Update it on Loans &amp; Cards.</p>}
          {st?.paidAmount ? <p className="text-[11px] text-ink-muted">{formatCurrency(st.paidAmount)} paid so far</p> : null}
        </div>
        <span className="text-sm font-semibold tabular-nums text-ink-primary">{formatCurrency(amount)}</span>
        <div className="col-start-2 col-end-4 justify-self-start sm:col-auto sm:justify-self-auto">
          <Link href="/loans#your-loans" className={cn(pill, 'inline-block')}>Pay card</Link>
        </div>
      </div>
      {open && (
        <ul className="ml-[56px] mt-2 grid gap-1.5 border-l border-line pl-3 sm:ml-[64px]">
          {group.items.map((item) => (
            <li key={`${item.type}-${item.id}-${item.dueDate}`} className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-ink-secondary">
              <span className="min-w-0">{item.name}{item.dueDate && <span className="text-ink-muted"> · {formatDate(item.dueDate, 'd MMM')}</span>}</span>
              <span className="flex items-center gap-2">
                <span className="tabular-nums">{formatCurrency(item.amount)}</span>
                <button type="button" disabled={pending || (item.type === 'BILL' && !item.dueDate)} onClick={() => mark(item)} className={pill} title="Counts it as part of the card bill. No money moves.">Tick off</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function StillToPay() {
  const { data, isLoading, isError } = useMonthlyPlan();
  const { data: funding } = useAccountFunding();
  const { data: members } = useFamilyMembers();
  const { data: cards } = useCreditCards();
  const { mark, pending } = useMarkPaid();

  const names = new Map((members ?? []).map((m) => [m.id, m.name.split(' ')[0]]));
  const who = (memberId?: string | null) => (memberId && names.get(memberId) ? `${names.get(memberId)} pays` : 'No person set');
  const rows = (data?.current.rows ?? []).filter((r) => r.status === 'PENDING');
  const entries = buildEntries(rows, new Map((cards ?? []).map((c) => [c.id, c.cardName])));
  // Card EMIs/bills inside a card group are paid through the card, so count the statement (or them, if none).
  const left = entries.reduce((s, e) => s + (e.kind === 'row' ? owed(e.row) : e.statement ? owed(e.statement) : e.items.reduce((t, i) => t + i.amount, 0)), 0);
  const topUps = (funding?.accounts ?? []).filter((a) => a.amountToAdd > 0);

  return (
    <section className="card-light min-w-0 rounded-2xl px-5 py-[18px]">
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-ink-primary">Still to pay</h2>
        {data && <span className="text-xs text-ink-muted">{formatCurrency(left)} left · {entries.length} {entries.length === 1 ? 'payment' : 'payments'}</span>}
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
      {data && entries.length === 0 && <p className="py-6 text-center text-sm text-ink-muted">Everything for this month is paid.</p>}

      <ul>
        {entries.map((entry) => entry.kind === 'card' ? (
          <CardGroupRow key={`card-${entry.cardId}`} group={entry} who={who(entry.memberId)} mark={mark} pending={pending} />
        ) : (
          <li key={`${entry.row.type}-${entry.row.id}-${entry.row.dueDate}`} className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line py-2.5 last:border-b-0 sm:grid-cols-[52px_minmax(0,1fr)_auto_auto]">
            <DateCell date={entry.row.dueDate} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink-primary">{entry.row.name}</p>
              <p className="text-xs text-ink-muted">{who(entry.row.memberId)}</p>
            </div>
            <span className="text-sm font-semibold tabular-nums text-ink-primary">{formatCurrency(entry.row.amount)}</span>
            <div className="col-start-2 col-end-4 justify-self-start sm:col-auto sm:justify-self-auto">
              <button type="button" disabled={pending || (entry.row.type === 'BILL' && !entry.row.dueDate)} onClick={() => mark(entry.row)} className={pill}>
                Mark paid
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
