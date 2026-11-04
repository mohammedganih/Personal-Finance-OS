'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import {
  MemberSummary, MonthSummary, SummaryBucket, SummaryTotals, CardSplit,
  useMonthSummary, usePeriodMonth, useSaveSalary,
} from '@/hooks/useMonthSummary';

// The family's paper sheet: salary − loans − investments − bills = left for the
// month; minus last month's card spending = free to spend & buffer.

const money = (n: number) => formatCurrency(n);
const initials = (name: string) => name.trim().charAt(0).toUpperCase() || '?';
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
const UNASSIGNED_HREF: Record<string, string> = { LOAN: '/loans', CARD_EMI: '/loans', CREDIT_CARD: '/loans', INVESTMENT: '/investments', BILL: '/bills' };

function Avatar({ label, color, combined }: { label: string; color?: string | null; combined?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid h-8 w-8 shrink-0 place-items-center rounded-full font-bold',
        combined ? 'border border-line-strong bg-paper-card text-[9.5px] text-ink-primary' : 'bg-mono text-xs text-white',
      )}
      style={!combined && color ? { background: color } : undefined}
    >
      {label}
    </span>
  );
}

function SalaryInput({ member, month }: { member: MemberSummary; month: string }) {
  const save = useSaveSalary();
  const [value, setValue] = useState(String(member.salary));
  useEffect(() => setValue(String(member.salary)), [member.salary, member.memberId, month]);
  const id = `salary-${member.memberId}`;

  const commit = (confirmEstimate: boolean) => {
    const amount = Number(value.replace(/[^\d.]/g, ''));
    if (!Number.isFinite(amount) || amount < 0) { setValue(String(member.salary)); return; }
    if (amount === member.salary && !(confirmEstimate && member.salaryIsEstimate)) return;
    save.mutate({ memberId: member.memberId, month, amount });
  };

  return (
    <div className="rounded-xl bg-paper-subtle px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-ink-secondary">Salary received</label>
        <div className="flex items-center text-lg font-bold tabular-nums text-ink-primary">
          <span aria-hidden="true">₹</span>
          <input
            id={id}
            inputMode="numeric"
            value={value}
            disabled={save.isPending}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => commit(false)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(true); (e.target as HTMLInputElement).blur(); } }}
            className="w-32 rounded bg-transparent p-0 text-right tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-mono focus-visible:ring-offset-4 focus-visible:ring-offset-paper-subtle disabled:opacity-60"
          />
        </div>
      </div>
      {member.salaryIsEstimate && <p className="mt-1 text-[11px] text-ink-muted">Estimate, from last month. Press Enter to confirm.</p>}
    </div>
  );
}

function Line({ label, bucket, names, showWho }: { label: string; bucket: SummaryBucket; names: Map<string, string>; showWho?: boolean }) {
  const progress = bucket.total === 0 ? (bucket.items.length ? 'Skipped' : 'Nothing due') : bucket.paid >= bucket.total ? 'All paid' : `${money(bucket.paid)} of ${money(bucket.total)} paid`;
  return (
    <details className="group border-b border-line">
      <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 rounded py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mono [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 whitespace-nowrap text-sm font-medium text-ink-secondary">
          <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 text-ink-muted transition-transform group-open:rotate-90" />{label}
        </span>
        <span className="row-span-2 whitespace-nowrap text-sm font-semibold tabular-nums text-ink-primary">− {money(bucket.total)}</span>
        <span className="ml-[22px] text-[11px] font-medium text-ink-muted">{progress}</span>
      </summary>
      {bucket.items.length === 0 ? (
        <p className="mb-2.5 ml-[22px] text-xs text-ink-muted">Nothing scheduled this month.</p>
      ) : (
        <ul className="mb-2.5 grid gap-1.5 pl-[22px] pr-0.5 text-[13px]">
          {bucket.items.map((item) => {
            const paid = item.status === 'PAID';
            const skipped = item.status === 'SKIPPED';
            const who = showWho && item.memberId ? names.get(item.memberId) : undefined;
            const debitedFrom = item.debitedFromMemberId ? names.get(item.debitedFromMemberId) : undefined;
            return (
              <li key={`${item.type}-${item.id}-${item.dueDate}`} className="flex justify-between gap-2 text-ink-secondary">
                <span className={cn('min-w-0', skipped && 'line-through')}>
                  <span
                    className={cn('mr-1.5 inline-grid h-[15px] w-[15px] place-items-center rounded-full border align-[-2px]', paid ? 'border-updown-up bg-updown-up text-white' : 'border-line-strong text-transparent')}
                    aria-label={paid ? 'Paid' : skipped ? 'Skipped' : 'Not paid yet'}
                    role="img"
                  >
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  </span>
                  {item.name}
                  {item.shared && <Tag>shared</Tag>}
                  {skipped && <Tag>skipped</Tag>}
                  {who && <Tag>{firstName(who)}</Tag>}
                  {item.fullAmount !== null && item.sharePct !== null && <Tag>{item.sharePct === 50 ? 'half' : `${item.sharePct}%`} of {money(item.fullAmount)}</Tag>}
                  {debitedFrom && <span className="mt-0.5 block pl-[21px] text-[11px] text-ink-muted">Debited from {firstName(debitedFrom)}&apos;s account</span>}
                </span>
                <span className="shrink-0 font-medium tabular-nums">{money(item.amount)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </details>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="ml-1.5 rounded-full bg-paper-subtle px-1.5 py-px text-[10.5px] font-medium text-ink-secondary no-underline">{children}</span>;
}

function CardLine({ cards, total, names, showWho }: { cards: CardSplit[]; total: number; names: Map<string, string>; showWho?: boolean }) {
  return (
    <div className="rounded-xl bg-amber-50 px-2.5">
      <details className="group">
        <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 rounded py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2 text-sm font-medium text-amber-800">
            <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />Last month&apos;s card spending
          </span>
          <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-amber-800">− {money(total)}</span>
        </summary>
        {cards.length === 0 ? (
          <p className="mb-2.5 ml-[22px] text-xs text-amber-800">No card statement due this month.</p>
        ) : (
          <ul className="mb-2.5 grid gap-1.5 pl-[22px] text-[13px] text-ink-secondary">
            {cards.map((card) => {
              const who = showWho && card.memberId ? names.get(card.memberId) : undefined;
              return (
                <li key={card.creditCardId} className="grid gap-1.5">
                  <span className="flex justify-between gap-2"><span>{card.name} statement{who && <Tag>{firstName(who)}</Tag>}</span><span className="font-medium tabular-nums">{money(card.statement)}</span></span>
                  {card.deducted > 0 && <span className="flex justify-between gap-2"><span>minus EMIs &amp; bills already counted above</span><span className="font-medium tabular-nums">−{money(card.deducted)}</span></span>}
                  {card.needsStatementUpdate && (
                    <span className="text-xs text-amber-800">
                      EMIs and bills on this card are more than its saved statement. <Link href="/loans" className="underline">Update the statement</Link>.
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </details>
    </div>
  );
}

function Sheet({ title, subtitle, avatar, salary, totals, names, combined }: {
  title: string; subtitle: string; avatar: React.ReactNode; salary: React.ReactNode;
  totals: SummaryTotals; names: Map<string, string>; combined?: boolean;
}) {
  const base = Math.max(1, totals.salary);
  const w = (v: number) => `${(Math.max(0, v) / base) * 100}%`;
  const negative = totals.free < 0;
  return (
    <article className={cn('card-light grid min-w-0 content-start rounded-2xl px-5 py-[18px]', combined && 'bg-paper-subtle')}>
      <div className="mb-2.5 flex items-center gap-2.5">
        {avatar}
        <p className="text-sm font-semibold text-ink-primary">{title}<small className="block text-xs font-normal text-ink-muted">{subtitle}</small></p>
      </div>
      {salary}
      <Line label="Loans & EMIs" bucket={totals.loans} names={names} showWho={combined} />
      <Line label="Investments" bucket={totals.investments} names={names} showWho={combined} />
      <Line label="Bills" bucket={totals.bills} names={names} showWho={combined} />
      <div className="flex justify-between px-0.5 py-3 text-sm font-semibold text-ink-primary">
        <span>Left for the month</span><span className="tabular-nums">{money(totals.left)}</span>
      </div>
      <CardLine cards={totals.cards} total={totals.cardSpending} names={names} showWho={combined} />
      <div className={cn('mt-3 flex items-center justify-between gap-2 rounded-xl p-3.5', negative ? 'bg-updown-down-muted text-updown-down' : 'bg-updown-up-muted text-updown-up')}>
        <span className="text-xs font-semibold">Free to spend &amp; buffer</span>
        <span className="text-2xl font-bold tabular-nums tracking-tight">{money(totals.free)}</span>
      </div>
      <div className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-paper-subtle" title="Loans, investments, bills, card spending, free">
        <i className="block h-full bg-mono" style={{ width: w(totals.loans.total) }} />
        <i className="block h-full bg-ink-secondary" style={{ width: w(totals.investments.total) }} />
        <i className="block h-full bg-[#B8B6B0]" style={{ width: w(totals.bills.total) }} />
        <i className="block h-full bg-amber-500" style={{ width: w(totals.cardSpending) }} />
        <i className="block h-full bg-updown-up" style={{ width: w(totals.free) }} />
      </div>
    </article>
  );
}

function Unassigned({ rows }: { rows: MonthSummary['unassigned'] }) {
  if (!rows.length) return null;
  return (
    <details className="group rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
      <summary className="cursor-pointer list-none underline underline-offset-2 [&::-webkit-details-marker]:hidden">
        {rows.length} {rows.length === 1 ? 'item has' : 'items have'} no person set
      </summary>
      <p className="mt-2 text-amber-800">These count in Combined, but not in anyone&apos;s own card.</p>
      <ul className="mt-1.5 grid gap-1">
        {rows.map((r) => (
          <li key={`${r.type}-${r.id}`} className="flex flex-wrap justify-between gap-2">
            <span>{r.name} · {money(r.amount)}</span>
            <Link href={UNASSIGNED_HREF[r.type] ?? '/settings'} className="font-medium underline">Set who pays</Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function MonthSheet() {
  const month = usePeriodMonth();
  const { data, isLoading, isError } = useMonthSummary(month);

  const header = (
    <div className="mx-0.5 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-[15px] font-semibold text-ink-primary">This month</h2>
      <span className="text-xs text-ink-muted">Salary in, commitments out, what&apos;s left</span>
    </div>
  );

  if (isLoading) {
    return (
      <section className="space-y-3">
        {header}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="card-light h-96 rounded-2xl shimmer" />)}
        </div>
      </section>
    );
  }
  if (isError || !data) return <div role="alert" className="card-light rounded-2xl p-5 text-sm text-ink-secondary">Could not load this month. Please refresh.</div>;
  if (!data.members.length) {
    return (
      <section className="space-y-3">
        {header}
        <div className="card-light rounded-2xl p-5 text-sm text-ink-secondary">
          Add your family members in <Link href="/settings" className="font-medium underline">Settings</Link> to see each person&apos;s month.
        </div>
      </section>
    );
  }

  const names = new Map(data.members.map((m) => [m.memberId, m.name]));
  return (
    <section className="space-y-3">
      {header}
      <Unassigned rows={data.unassigned} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {data.members.map((m) => (
          <Sheet
            key={m.memberId}
            title={m.name}
            subtitle={`Paid from ${firstName(m.name)}'s salary`}
            avatar={<Avatar label={m.emoji || initials(m.name)} color={m.color} />}
            salary={<SalaryInput member={m} month={data.month} />}
            totals={m}
            names={names}
          />
        ))}
        <Sheet
          combined
          title="Combined"
          subtitle={data.members.length === 2 ? 'Both of you together' : 'Everyone together'}
          avatar={<Avatar combined label={data.members.slice(0, 3).map((m) => initials(m.name)).join('+')} />}
          salary={
            <div className="flex items-center justify-between gap-2 rounded-xl bg-paper-card px-3 py-2.5">
              <span className="text-xs font-medium text-ink-secondary">Salary received</span>
              <span className="text-lg font-bold tabular-nums text-ink-primary">{money(data.combined.salary)}</span>
            </div>
          }
          totals={data.combined}
          names={names}
        />
      </div>
    </section>
  );
}
