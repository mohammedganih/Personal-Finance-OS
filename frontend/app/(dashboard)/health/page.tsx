'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, AlertOctagon, ChevronRight } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useHealthCheck, Level } from '@/hooks/useLookback';
import { RegisterPage } from '@/components/register/Register';

// Health check: is the buffer enough, is debt in hand, are we saving, what
// matures soon, and is any data out of date. Then the advice engines' tips.

const LEVEL: Record<Level, { label: string; icon: typeof CheckCircle2; className: string }> = {
  good: { label: 'Good', icon: CheckCircle2, className: 'bg-updown-up-muted text-updown-up' },
  watch: { label: 'Worth a look', icon: AlertTriangle, className: 'bg-gauge-fair/15 text-[#8A5A00]' },
  act: { label: 'Act on this', icon: AlertOctagon, className: 'bg-updown-down-muted text-updown-down' },
};
const SEVERITY_LEVEL: Record<string, Level> = { critical: 'act', warning: 'watch', info: 'good', positive: 'good' };

function LevelBadge({ level }: { level: Level }) {
  const l = LEVEL[level];
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', l.className)}>
      <l.icon className="h-3 w-3" aria-hidden="true" />{l.label}
    </span>
  );
}

function Check({ title, level, value, children, href }: { title: string; level: Level; value: ReactNode; children: ReactNode; href?: string }) {
  return (
    <section className="card-light flex flex-col gap-2 px-5 py-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink-primary">{title}</h2>
        <LevelBadge level={level} />
      </div>
      <p className="text-2xl font-bold tabular-nums text-ink-primary">{value}</p>
      <div className="text-sm text-ink-secondary">{children}</div>
      {href && <Link href={href} className="mt-auto inline-flex items-center gap-0.5 text-xs font-medium text-ink-secondary hover:underline">Open <ChevronRight className="h-3 w-3" /></Link>}
    </section>
  );
}

const money = (n: number) => formatCurrency(Math.round(n));
const pct = (n: number | null) => (n == null ? '—' : `${Math.round(n)}%`);

export default function HealthPage() {
  const { data, isLoading, isError } = useHealthCheck();

  if (isError) return <div className="mx-auto max-w-6xl"><p className="card-light px-5 py-4 text-sm text-updown-down">Couldn&apos;t run the health check. Try again in a moment.</p></div>;
  if (isLoading || !data) return <div className="mx-auto max-w-6xl"><p className="card-light px-5 py-8 text-center text-sm text-ink-muted">Running the checks…</p></div>;

  const { buffer, debtToIncome: dti, savingsRate: sr, maturities, stale, advice } = data;
  const levels: Level[] = [buffer.level, dti.level, sr.level, ...stale.map((s) => s.level)];
  const count = (l: Level) => levels.filter((x) => x === l).length;
  const tips = advice.recommendations.filter((r) => r.severity !== 'positive').slice(0, 5);
  const good = [...advice.recommendations.filter((r) => r.severity === 'positive').map((r) => r.title), ...advice.assetLoans.filter((a) => a.severity === 'positive').map((a) => a.message)].slice(0, 4);

  return (
    <RegisterPage
      totals={[
        { label: 'To act on', value: count('act') },
        { label: 'Worth a look', value: count('watch') },
        { label: 'Score', value: advice.score ? `${advice.score.score}/100` : '—', note: advice.score ? `${advice.score.band.toLowerCase()} · debt, savings, investments` : undefined },
      ]}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Check title="Buffer" level={buffer.level} value={money(buffer.amount)} href="/dashboard">
          Target {money(buffer.target)}{buffer.targetIsDefault ? ' (3 months of commitments)' : ''}.
          {buffer.monthsCovered != null && (buffer.monthsCovered > 0
            ? <> Covers about <b className="font-semibold text-ink-primary">{buffer.monthsCovered.toFixed(1)} months</b> of commitments.</>
            : <> It doesn&apos;t cover this month&apos;s commitments yet.</>)}
        </Check>
        <Check title="Debt to income" level={dti.level} value={pct(dti.pct)} href="/loans">
          {money(dti.monthlyEmis)} of EMIs a month against {money(dti.income)} {dti.incomeIsSalary ? 'salary this month' : 'average income'}. Up to 30% is comfortable; over 40% is stretched.
        </Check>
        <Check title="Savings rate" level={sr.level} value={pct(sr.average)} href="/history">
          Share of income not spent or used on debt, last {sr.months.length} months:{' '}
          {sr.months.map((m) => `${formatDate(`${m.month}-01`, 'MMM')} ${pct(m.rate)}`).join(' · ')}. Aim for 20% or more.
        </Check>
        <Check title="Maturing in 6 months" level="good" value={maturities.length} href="/investments">
          {maturities.length ? (
            <ul className="space-y-0.5">
              {maturities.slice(0, 3).map((m) => (
                <li key={m.investmentId} className="flex justify-between gap-2">
                  <span className="truncate">{m.assetName}</span>
                  <span className="shrink-0 tabular-nums">{formatDate(m.maturityDate, 'd MMM')}{m.maturityAmount ? ` · ${money(m.maturityAmount)}` : ''}</span>
                </li>
              ))}
            </ul>
          ) : 'Nothing matures in the next six months.'}
        </Check>
      </div>

      <section className="card-light">
        <h2 className="border-b border-line px-5 py-3 text-[15px] font-semibold text-ink-primary">Out of date</h2>
        {stale.length ? (
          <ul>
            {stale.map((s) => (
              <li key={`${s.kind}-${s.id ?? s.name}`} className="border-b border-line last:border-b-0">
                <Link href={s.href} className="flex items-start justify-between gap-3 px-5 py-3 hover:bg-paper-subtle">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink-primary">{s.name}</span>
                    <span className="block text-xs text-ink-muted">{s.detail}</span>
                  </span>
                  <LevelBadge level={s.level} />
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="px-5 py-6 text-center text-sm text-ink-muted">Everything is up to date.</p>}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card-light">
          <h2 className="border-b border-line px-5 py-3 text-[15px] font-semibold text-ink-primary">Paying off debt</h2>
          <div className="space-y-3 px-5 py-4 text-sm text-ink-secondary">
            {advice.strategy ? (
              <>
                <p>
                  Paying <b className="font-semibold text-ink-primary">{money(advice.strategy.extraPayment)} extra</b> a month,{' '}
                  {advice.strategy.bestStrategy === 'avalanche' ? 'highest interest first' : 'smallest balance first'}, clears the debt in{' '}
                  <b className="font-semibold text-ink-primary">{advice.strategy.monthsWithExtra} months</b> instead of {advice.strategy.baseMonths}
                  {advice.strategy.interestSaved > 0 && <> and saves {money(advice.strategy.interestSaved)} in interest</>}.
                </p>
                {advice.strategy.order.length > 1 && <p>Order: {advice.strategy.order.join(' → ')}.</p>}
              </>
            ) : <p>No debt to plan for.</p>}
            {advice.funding.length > 0 && (
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Could pay some off</p>
                <ul className="space-y-1">
                  {advice.funding.map((f) => (
                    <li key={f.investmentId}>
                      {f.assetName} ({money(f.availableAmount)}{f.availableDate ? `, from ${formatDate(f.availableDate, 'd MMM')}` : ', available now'}) on {f.targetDebtName}:{' '}
                      {f.monthsSaved} months sooner, {money(f.interestSaved)} less interest.
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        <section className="card-light">
          <h2 className="border-b border-line px-5 py-3 text-[15px] font-semibold text-ink-primary">Tips</h2>
          <ul className="divide-y divide-line">
            {tips.map((r) => (
              <li key={r.title} className="flex items-start justify-between gap-3 px-5 py-3">
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink-primary">{r.title}</span>
                  <span className="block text-xs text-ink-muted">{r.description}</span>
                </span>
                <LevelBadge level={SEVERITY_LEVEL[r.severity] ?? 'good'} />
              </li>
            ))}
            {advice.diversification.map((d) => (
              <li key={d.message} className="flex items-start justify-between gap-3 px-5 py-3">
                <span className="min-w-0 text-sm text-ink-primary">{d.message}</span>
                <LevelBadge level={d.severity === 'warning' ? 'watch' : 'good'} />
              </li>
            ))}
            {!tips.length && !advice.diversification.length && <li className="px-5 py-6 text-center text-sm text-ink-muted">No tips right now.</li>}
          </ul>
          {good.length > 0 && (
            <div className="border-t border-line px-5 py-3 text-xs text-ink-muted">
              <p className="mb-1 font-semibold uppercase tracking-wider">Going well</p>
              <ul className="list-disc space-y-0.5 pl-4">{good.map((g) => <li key={g}>{g}</li>)}</ul>
            </div>
          )}
        </section>
      </div>
    </RegisterPage>
  );
}
