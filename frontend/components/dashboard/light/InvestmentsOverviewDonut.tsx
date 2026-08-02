'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { useDiversification, useAnnualizedReturns } from '@/hooks/useInvestmentIntelligence';
import { usePortfolioSummary } from '@/hooks/useInvestments';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

const SIZE = 160;
const STROKE = 18;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

// This dashboard's palette is almost entirely black/white/gray, with color
// reserved for gain/loss direction -- so the donut is a monochrome navy-to-
// gray ramp (largest holding darkest) rather than a categorical rainbow.
const MONO_RAMP = ['#111827', '#4B5563', '#9CA3AF', '#D1D5DB', '#E5E7EB', '#F3F4F6'];

function Delta({ pct, amount }: { pct: number; amount?: string }) {
  const isUp = pct >= 0;
  return (
    <span className={cn('inline-flex items-center gap-1 text-sm font-medium', isUp ? 'text-updown-up' : 'text-updown-down')}>
      {isUp ? '↗' : '↘'} {Math.abs(pct).toFixed(1)}%{amount ? ` (${amount})` : ''}
    </span>
  );
}

/** Same SVG stroke-circle sweep as components/investments/AllocationDonut.tsx,
 *  driven by asset CLASS (Equity/Debt/Gold/...) rather than per-holding type --
 *  the grouping this card actually needs. Now the wide card in its row (see
 *  dashboard/page.tsx), so it carries the full Total Value / P&L / All Time
 *  Return stats the reference shows, not just the ring. */
export function InvestmentsOverviewDonut() {
  const { data, isLoading } = useDiversification();
  const { data: summary } = usePortfolioSummary();
  const { data: returns } = useAnnualizedReturns();
  const reduceMotion = useReducedMotion();

  if (isLoading) return <div className="card-light rounded-2xl h-64 shimmer" />;

  const breakdown = data?.classBreakdown ?? [];
  const total = breakdown.reduce((s, b) => s + b.value, 0);

  if (breakdown.length === 0) {
    return (
      <div className="card-light rounded-2xl p-5 h-64 flex items-center justify-center text-sm text-ink-muted">
        No holdings yet
      </div>
    );
  }

  const entries = [...breakdown]
    .sort((a, b) => b.value - a.value)
    .map((b, i) => ({ ...b, color: MONO_RAMP[i % MONO_RAMP.length] }));

  let cumulative = 0;
  const segments = entries.map((e) => {
    const startFrac = cumulative / 100;
    cumulative += e.percentage;
    return { ...e, segLen: (e.percentage / 100) * CIRCUMFERENCE, rotation: startFrac * 360 - 90 };
  });

  const pnlPct = summary && summary.totalInvested > 0 ? (summary.totalPnl / summary.totalInvested) * 100 : null;

  return (
    <div className="card-light rounded-2xl p-5">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-ink-primary">Investments Overview</h3>
        <Link href="/investments" className="text-xs font-medium text-ink-muted hover:text-ink-primary">View All</Link>
      </div>

      <div className="flex items-center gap-8 flex-wrap">
        <div className="flex flex-col gap-5 min-w-40">
          <div>
            <p className="text-xs text-ink-muted">Total Value</p>
            <p className="text-2xl font-bold text-ink-primary tabular-nums mt-0.5">{formatCurrency(total, 'INR', true)}</p>
            {pnlPct !== null && summary && (
              <div className="mt-1"><Delta pct={pnlPct} amount={formatCurrency(summary.totalPnl, 'INR', true)} /></div>
            )}
          </div>
          {returns?.overall != null && (
            <div>
              <p className="text-xs text-ink-muted">All Time Return</p>
              <div className="mt-1"><Delta pct={returns.overall * 100} /></div>
            </div>
          )}
        </div>

        <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="#F3F3F1" strokeWidth={STROKE} />
            {segments.map((s, i) => (
              <motion.circle
                key={s.assetClass}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth={STROKE}
                strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                initial={reduceMotion ? false : { strokeDashoffset: CIRCUMFERENCE }}
                animate={{ strokeDashoffset: CIRCUMFERENCE - s.segLen }}
                transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                transform={`rotate(${s.rotation} ${SIZE / 2} ${SIZE / 2})`}
              />
            ))}
          </svg>
        </div>

        <div className="flex-1 min-w-32 space-y-2">
          {segments.map((s) => (
            <div key={s.assetClass} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="text-xs text-ink-secondary flex-1 truncate">{s.assetClass}</span>
              <span className="text-xs text-ink-muted">{s.percentage.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
