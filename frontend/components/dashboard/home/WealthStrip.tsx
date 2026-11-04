'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import { useDashboardOverview, useNetWorthTrend } from '@/hooks/useDashboard';
import { useDebtOverview, useDebtTrend } from '@/hooks/useDebtIntelligence';
import { useGoals, useGoalInsights } from '@/hooks/useGoals';

function Tile({ label, value, href, note, good }: { label: string; value: string; href: string; note?: string | null; good?: boolean }) {
  return (
    <Link href={href} className="card-light-hover flex items-center justify-between gap-2 rounded-2xl px-4 py-3.5" aria-label={`${label}: ${value}. Open`}>
      <div className="min-w-0">
        <small className="block text-xs text-ink-muted">{label}</small>
        <b className="text-[19px] tabular-nums text-ink-primary">{value}</b>
        {note && <em className={cn('ml-1.5 text-xs font-medium not-italic', good ? 'text-updown-up' : 'text-updown-down')}>{note}</em>}
      </div>
      <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-muted" />
    </Link>
  );
}

export function WealthStrip() {
  const { data: overview } = useDashboardOverview();
  const { data: nwTrend } = useNetWorthTrend(180);
  const { data: debt } = useDebtOverview();
  const { data: debtTrend } = useDebtTrend(31);
  const { data: goals } = useGoals();
  const { data: insights } = useGoalInsights();

  const nw = nwTrend ?? [];
  const nwPrev = nw.length > 1 ? nw[nw.length - 2].netWorth : null;
  const nwPct = nwPrev && overview ? ((overview.netWorth - nwPrev) / Math.abs(nwPrev)) * 100 : null;

  const dt = debtTrend ?? [];
  const debtDrop = dt.length > 1 ? dt[0].totalOutstanding - dt[dt.length - 1].totalOutstanding : null;

  const active = (goals ?? []).filter((g) => !g.isCompleted);
  const atRisk = new Set((insights ?? []).filter((i) => i.severity === 'warning').map((i) => i.goalId));
  const onTrack = active.filter((g) => !atRisk.has(g.id)).length;

  const dash = '—';
  return (
    <section className="grid content-start gap-3">
      <div className="mx-0.5 flex items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-ink-primary">Our wealth</h2>
        <span className="text-xs text-ink-muted">Right now</span>
      </div>
      <Tile
        label="Net worth" href="/accounts"
        value={overview ? formatCurrency(overview.netWorth) : dash}
        note={nwPct !== null && Number.isFinite(nwPct) ? `${nwPct >= 0 ? '↑' : '↓'} ${Math.abs(nwPct).toFixed(1)}%` : null}
        good={(nwPct ?? 0) >= 0}
      />
      <Tile label="Investments value" href="/investments" value={overview ? formatCurrency(overview.investmentValue) : dash} />
      <Tile
        label="Loans left to repay" href="/loans"
        value={debt ? formatCurrency(debt.totalOutstanding) : dash}
        note={debtDrop ? `${debtDrop > 0 ? '↓' : '↑'} ${formatCurrency(Math.abs(debtDrop))}` : null}
        good={(debtDrop ?? 0) > 0}
      />
      <Tile label="Goals" href="/goals" value={goals ? (active.length ? `${onTrack} of ${active.length} on track` : 'No active goals') : dash} />
    </section>
  );
}
