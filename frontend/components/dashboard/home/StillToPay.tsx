'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/lib/format';
import { useMonthlyPlan, MonthlyPaymentRow, MonthlyPlan } from '@/hooks/useMonthlyPlan';
import { useAccountFunding } from '@/hooks/useAccountFunding';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { useCreditCards } from '@/hooks/useCreditCards';
import { PaymentActions, isTickOnly } from '@/components/shared/PaymentActions';

// What is still to pay: last month's missed items and anything already past due
// (Overdue), then this week, then later this month. Card EMIs and bills charged
// to a card sit under their card: ticking them moves no money, paying the card does.

type Row = MonthlyPaymentRow & { planMonth: string };
type CardGroup = { kind: 'card'; cardId: string; name: string; statement?: Row; items: Row[]; dueDate?: string; memberId?: string | null };
type Entry = { kind: 'row'; row: Row; dueDate?: string } | CardGroup;

const owed = (r: MonthlyPaymentRow) => (r.type === 'CREDIT_CARD' ? r.remaining ?? r.amount : r.amount);
const entryOwed = (e: Entry) => (e.kind === 'row' ? owed(e.row) : e.statement ? owed(e.statement) : e.items.reduce((t, i) => t + i.amount, 0));
const istToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const addDays = (key: string, n: number) => { const d = new Date(`${key}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const DISMISS_KEY = 'shazah:topups-moved';

/** Plain rows plus one group per card (its statement, EMIs and card-charged bills), earliest first. */
export function buildEntries(rows: Row[], cardNames: Map<string, string>): Entry[] {
  const groups = new Map<string, CardGroup>();
  const entries: Entry[] = [];
  for (const row of rows) {
    const cardId = row.type === 'CREDIT_CARD' ? row.creditCardId ?? row.id : isTickOnly(row) ? row.creditCardId : undefined;
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

/** Amount each person still owes, honouring splits (e.g. a 50/50 RD). */
export function perPerson(entries: Entry[]) {
  const totals = new Map<string, number>();
  const add = (id: string | null | undefined, n: number) => totals.set(id ?? '', (totals.get(id ?? '') ?? 0) + n);
  for (const e of entries) {
    if (e.kind === 'card') { add(e.memberId, entryOwed(e)); continue; }
    const amount = owed(e.row);
    const sp = e.row.split;
    if (sp && e.row.memberId) { add(sp.memberId, (amount * sp.pct) / 100); add(e.row.memberId, amount - (amount * sp.pct) / 100); }
    else add(e.row.memberId, amount);
  }
  return totals;
}

function DateCell({ date, overdue }: { date?: string; overdue?: boolean }) {
  return (
    <div className={cn('text-center text-[11px] leading-tight', overdue ? 'text-updown-down' : 'text-ink-muted')}>
      {date ? <><b className={cn('block text-base', overdue ? 'text-updown-down' : 'text-ink-primary')}>{formatDate(date, 'd')}</b>{formatDate(date, 'MMM')}</> : '—'}
    </div>
  );
}

const rowGrid = 'grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[52px_minmax(0,1fr)_auto_auto]';
const actionCell = 'col-start-2 col-end-4 justify-self-start sm:col-auto sm:justify-self-end';

function CardGroupRow({ group, who, overdue }: { group: CardGroup; who: string; overdue: boolean }) {
  const [open, setOpen] = useState(false);
  const inside = group.items.reduce((s, i) => s + i.amount, 0);
  const st = group.statement;
  return (
    <li className="border-b border-line py-2.5 last:border-b-0">
      <div className={rowGrid}>
        <DateCell date={group.dueDate} overdue={overdue} />
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
          {!st && <p className="text-[11px] text-amber-800">Statement not entered yet. <Link href="/loans#your-loans" className="underline">Enter it on Loans &amp; Cards</Link>.</p>}
          {st?.paidAmount ? <p className="text-[11px] text-ink-muted">{formatCurrency(st.paidAmount)} paid so far</p> : null}
        </div>
        <span className="text-sm font-semibold tabular-nums text-ink-primary">{formatCurrency(st ? owed(st) : inside)}</span>
        <div className={actionCell}>{st && <PaymentActions row={st} planMonth={st.planMonth} />}</div>
      </div>
      {open && (
        <ul className="ml-[56px] mt-2 grid gap-1.5 border-l border-line pl-3 sm:ml-[64px]">
          {group.items.map((item) => (
            <li key={`${item.type}-${item.id}-${item.dueDate}`} className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-ink-secondary">
              <span className="min-w-0">{item.name}{item.dueDate && <span className="text-ink-muted"> · {formatDate(item.dueDate, 'd MMM')}</span>}</span>
              <span className="flex items-center gap-2">
                <span className="tabular-nums">{formatCurrency(item.amount)}</span>
                <PaymentActions row={item} planMonth={item.planMonth} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function Section({ title, entries, who, overdue, tone }: { title: string; entries: Entry[]; who: (id?: string | null) => string; overdue?: boolean; tone?: 'down' }) {
  if (!entries.length) return null;
  const total = entries.reduce((s, e) => s + entryOwed(e), 0);
  return (
    <div className="mt-3 first:mt-0">
      <h3 className={cn('flex justify-between text-[11px] font-semibold uppercase tracking-wider', tone === 'down' ? 'text-updown-down' : 'text-ink-muted')}>
        <span>{title}</span><span className="tabular-nums">{formatCurrency(total)}</span>
      </h3>
      <ul>
        {entries.map((entry) => entry.kind === 'card' ? (
          <CardGroupRow key={`card-${entry.cardId}`} group={entry} who={who(entry.memberId)} overdue={!!overdue} />
        ) : (
          <li key={`${entry.row.planMonth}-${entry.row.type}-${entry.row.id}-${entry.row.dueDate}`} className={cn(rowGrid, 'border-b border-line py-2.5 last:border-b-0')}>
            <DateCell date={entry.row.dueDate} overdue={overdue} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink-primary">{entry.row.name}</p>
              <p className="text-xs text-ink-muted">{who(entry.row.memberId)}{entry.row.split ? ` · split ${100 - entry.row.split.pct}/${entry.row.split.pct}` : ''}</p>
            </div>
            <span className="text-sm font-semibold tabular-nums text-ink-primary">{formatCurrency(entry.row.amount)}</span>
            <div className={actionCell}><PaymentActions row={entry.row} planMonth={entry.row.planMonth} /></div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function useMovedTopUps() {
  const [moved, setMoved] = useState<string[]>([]);
  useEffect(() => {
    try { setMoved(JSON.parse(sessionStorage.getItem(DISMISS_KEY) ?? '[]')); } catch { /* storage unavailable */ }
  }, []);
  const markMoved = (key: string) => {
    const next = [...moved, key];
    setMoved(next);
    try { sessionStorage.setItem(DISMISS_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  };
  return { moved, markMoved };
}

export function StillToPay() {
  const { data, isLoading, isError } = useMonthlyPlan();
  const { data: funding } = useAccountFunding();
  const { data: members } = useFamilyMembers();
  const { data: cards } = useCreditCards();
  const { moved, markMoved } = useMovedTopUps();

  const names = new Map((members ?? []).map((m) => [m.id, m.name.split(' ')[0]]));
  const who = (memberId?: string | null) => (memberId && names.get(memberId) ? `${names.get(memberId)} pays` : 'No person set');
  const today = istToday();
  const weekEnd = addDays(today, 6);

  const pending = (plan?: MonthlyPlan): Row[] =>
    (plan?.rows ?? []).filter((r) => r.status === 'PENDING').map((r) => ({ ...r, planMonth: plan!.month }));
  const lastMonth = pending(data?.previous).filter((r) => r.type !== 'CREDIT_CARD');
  const thisMonth = pending(data?.current);
  const entries = buildEntries([...lastMonth, ...thisMonth], new Map((cards ?? []).map((c) => [c.id, c.cardName])));

  // A card group follows its statement's due date; its items may come from last month's cycle.
  const isOverdue = (e: Entry) => (e.kind === 'row' ? e.row.planMonth !== data?.current.month : !e.statement && e.items.some((i) => i.planMonth !== data?.current.month)) || (!!e.dueDate && e.dueDate < today);
  const overdue = entries.filter(isOverdue);
  const thisWeek = entries.filter((e) => !isOverdue(e) && (!e.dueDate || e.dueDate <= weekEnd));
  const later = entries.filter((e) => !isOverdue(e) && !!e.dueDate && e.dueDate > weekEnd);
  const left = entries.reduce((s, e) => s + entryOwed(e), 0);
  const people = Array.from(perPerson(entries).entries()).filter(([, n]) => n > 0.5);
  const topUps = (funding?.accounts ?? []).filter((a) => a.amountToAdd > 0 && !moved.includes(`${a.id}:${a.amountToAdd}`));

  return (
    <section className="card-light min-w-0 rounded-2xl px-5 py-[18px]">
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-ink-primary">Still to pay</h2>
        {data && <span className="text-xs text-ink-muted">{formatCurrency(left)} left · {entries.length} {entries.length === 1 ? 'payment' : 'payments'}</span>}
      </div>

      {people.length > 0 && (
        <p className="mb-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-secondary">
          {people.map(([id, n]) => <span key={id || 'none'}>{id ? names.get(id) ?? 'Someone' : 'No person set'} <b className="tabular-nums text-ink-primary">{formatCurrency(Math.round(n))}</b></span>)}
        </p>
      )}

      {topUps.map((a) => (
        <div key={a.id} className="mb-2 flex items-start gap-2.5 rounded-xl bg-amber-50 px-3 py-2.5 text-[13px] text-amber-800">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">
            Move {formatCurrency(a.amountToAdd)} to {a.name}
            {a.nextPayment?.dueDate ? <> before {formatDate(a.nextPayment.dueDate, 'd MMM')}</> : null}
            {a.nextPayment ? <> to cover {a.nextPayment.name}</> : null}.
          </span>
          <button type="button" onClick={() => markMoved(`${a.id}:${a.amountToAdd}`)} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300 px-2 py-0.5 text-xs font-medium hover:bg-amber-100" title="Hides this until the amount changes. Update the account balance on Accounts to make it permanent.">
            <X aria-hidden="true" className="h-3 w-3" />Done, I moved it
          </button>
        </div>
      ))}

      {isLoading && <div className="h-40 rounded-xl shimmer" />}
      {isError && <p role="alert" className="text-sm text-ink-secondary">Could not load payments. Please refresh.</p>}
      {data && entries.length === 0 && <p className="py-6 text-center text-sm text-ink-muted">Everything for this month is paid.</p>}

      <Section title="Overdue" entries={overdue} who={who} overdue tone="down" />
      <Section title="Due this week" entries={thisWeek} who={who} />
      <Section title="Later this month" entries={later} who={who} />
    </section>
  );
}
