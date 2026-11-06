'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useCheckInBalances, useNetWorthPage, SheetItem } from '@/hooks/useLookback';
import { RegisterPage, DetailDrawer } from '@/components/register/Register';
import { NetWorthTrend } from '@/components/lookback/NetWorthTrend';

// Net worth: what we own less what we owe, how it moved month to month, and a
// balance check-in to bring bank balances in line with the bank.

const btn = 'rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-primary hover:bg-paper-subtle';
const monthName = (m: string) => formatDate(`${m}-01`, 'MMMM');
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatCurrency(Math.abs(n))}`;

function Group({ title, rows, href, empty }: { title: string; rows: SheetItem[]; href: string; empty?: string }) {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  if (!rows.length && !empty) return null;
  return (
    <div className="border-b border-line px-5 py-3 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <Link href={href} className="text-sm font-semibold text-ink-primary hover:underline">{title}</Link>
        <span className="text-sm font-semibold tabular-nums text-ink-primary">{formatCurrency(total)}</span>
      </div>
      {rows.length ? (
        <ul className="mt-1.5 space-y-1">
          {rows.map((r) => (
            <li key={r.id} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-ink-secondary">{r.name}</span>
              <span className="shrink-0 tabular-nums text-ink-secondary">{formatCurrency(r.amount)}</span>
            </li>
          ))}
        </ul>
      ) : <p className="mt-1 text-xs text-ink-muted">{empty}</p>}
    </div>
  );
}

function CheckIn({ accounts, onClose }: { accounts: SheetItem[]; onClose: () => void }) {
  const save = useCheckInBalances();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(accounts.map((a) => [a.id, String(a.amount)])));
  const parsed = accounts.map((a) => ({ a, value: values[a.id]?.trim() === '' ? NaN : Number(values[a.id]) }));
  const invalid = parsed.some((p) => !Number.isFinite(p.value));
  const submit = () => {
    if (invalid) return;
    save.mutate(parsed.map((p) => ({ accountId: p.a.id, balance: p.value })), { onSuccess: onClose });
  };
  return (
    <DetailDrawer open onClose={onClose} title="Balance check-in" subtitle="Type each balance as the bank app shows it today.">
      <p className="text-sm text-ink-secondary">Any difference is saved as an adjustment. It changes the balance but doesn&apos;t count as income or spending.</p>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {parsed.map(({ a, value }) => {
          const gap = Number.isFinite(value) ? Math.round((value - a.amount) * 100) / 100 : 0;
          return (
            <label key={a.id} className="block">
              <span className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-ink-primary">{a.name}</span>
                <span className="text-xs text-ink-muted">In the app: {formatCurrency(a.amount)}</span>
              </span>
              <input
                inputMode="decimal" value={values[a.id] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [a.id]: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-line bg-paper-card px-3 py-2 text-sm tabular-nums text-ink-primary focus:border-ink-primary focus:outline-none"
                aria-invalid={!Number.isFinite(value) || undefined}
              />
              {gap !== 0 && <span className={cn('mt-0.5 block text-xs', gap > 0 ? 'text-updown-up' : 'text-updown-down')}>Adjustment {signed(gap)}</span>}
            </label>
          );
        })}
        <button type="submit" disabled={invalid || save.isPending} className="w-full rounded-full bg-mono py-2.5 text-sm font-medium text-white hover:bg-mono-hover disabled:opacity-50">
          {save.isPending ? 'Saving…' : 'Save balances'}
        </button>
      </form>
    </DetailDrawer>
  );
}

export default function NetWorthPage() {
  const { data, isLoading, isError } = useNetWorthPage();
  const [checkIn, setCheckIn] = useState(false);
  const since = data?.sinceLastClose;

  return (
    <RegisterPage
      totals={[
        { label: 'Net worth', value: data ? formatCurrency(data.sheet.netWorth) : '—' },
        { label: 'What we own', value: data ? formatCurrency(data.sheet.totalAssets) : '—' },
        { label: 'What we owe', value: data ? formatCurrency(data.sheet.totalDebt) : '—' },
        {
          label: since ? `Since ${monthName(since.month)} close` : 'Since last close',
          value: since ? signed(since.change) : '—',
          note: since ? (since.approximate ? 'that close is approximate' : undefined) : 'no month closed yet',
        },
      ]}
      actions={<button type="button" className={btn} onClick={() => setCheckIn(true)} disabled={!data?.items.bank.length}>Balance check-in</button>}
    >
      {isError && <p className="card-light px-5 py-4 text-sm text-updown-down">Couldn&apos;t load net worth. Try again in a moment.</p>}
      {isLoading && <p className="card-light px-5 py-8 text-center text-sm text-ink-muted">Loading…</p>}

      {data && (
        <>
          {since && (
            <section className="card-light">
              <h2 className="border-b border-line px-5 py-3 text-[15px] font-semibold text-ink-primary">What changed since the {monthName(since.month)} close</h2>
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                    <th scope="col" className="w-[40%] py-2 pl-5 pr-2">Part</th>
                    <th scope="col" className="hidden px-2 py-2 text-right sm:table-cell">Then</th>
                    <th scope="col" className="px-2 py-2 text-right">Now</th>
                    <th scope="col" className="py-2 pl-2 pr-5 text-right">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {since.lines.map((l) => {
                    // Debt going down is good news, so its colour is flipped.
                    const good = l.key === 'debt' ? l.change < 0 : l.change > 0;
                    return (
                      <tr key={l.key} className="border-b border-line last:border-b-0">
                        <td className="py-2.5 pl-5 pr-2 text-ink-primary">{l.label}</td>
                        <td className="hidden px-2 py-2.5 text-right tabular-nums text-ink-secondary sm:table-cell">{formatCurrency(l.then)}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-ink-primary">{formatCurrency(l.now)}</td>
                        <td className={cn('py-2.5 pl-2 pr-5 text-right font-medium tabular-nums', l.change === 0 ? 'text-ink-muted' : good ? 'text-updown-up' : 'text-updown-down')}>{signed(l.change)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="px-5 py-3 text-xs text-ink-muted">Investments, gold and money lent are worked out from net worth, since a close keeps bank balances and debt only.</p>
            </section>
          )}

          <section className="card-light px-5 py-4">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h2 className="text-[15px] font-semibold text-ink-primary">Net worth by month</h2>
              <Link href="/history" className="text-xs font-medium text-ink-secondary hover:underline">Month history</Link>
            </div>
            <NetWorthTrend points={data.trend} now={data.sheet.netWorth} />
            {data.trend.some((t) => t.approximate) && <p className="mt-1 text-xs text-ink-muted">Hollow dots are months worked out afterwards, so they&apos;re approximate.</p>}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card-light">
              <h2 className="flex items-baseline justify-between border-b border-line px-5 py-3 text-[15px] font-semibold text-ink-primary">
                What we own <span className="tabular-nums">{formatCurrency(data.sheet.totalAssets)}</span>
              </h2>
              <Group title="Bank and cash" rows={data.items.bank} href="/accounts" empty="No bank accounts yet." />
              <Group title="Investments" rows={data.items.investments} href="/investments" />
              <Group title="Gold" rows={data.items.gold} href="/investments" />
              <Group title="Money lent" rows={data.items.lent} href="/loans" />
            </section>
            <section className="card-light">
              <h2 className="flex items-baseline justify-between border-b border-line px-5 py-3 text-[15px] font-semibold text-ink-primary">
                What we owe <span className="tabular-nums">{formatCurrency(data.sheet.totalDebt)}</span>
              </h2>
              <Group title="Loans" rows={data.items.loans} href="/loans" empty="No loans." />
              <Group title="Card EMIs" rows={data.items.cardEmis} href="/credit-cards" />
              <Group title="Unpaid card statements" rows={data.items.cardStatements} href="/credit-cards" />
              <Group title="Money borrowed" rows={data.items.borrowed} href="/loans" />
            </section>
          </div>
        </>
      )}

      {checkIn && data && <CheckIn accounts={data.items.bank} onClose={() => setCheckIn(false)} />}
    </RegisterPage>
  );
}
