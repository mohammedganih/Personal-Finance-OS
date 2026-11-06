'use client';

import { Wallet, Target, TrendingUp, Repeat } from 'lucide-react';
import { StatCardLight } from '@/components/dashboard/StatCardLight';
import { usePortfolioSummary } from '@/hooks/useInvestments';
import { usePortfolioTrend } from '@/hooks/useInvestmentIntelligence';
import { formatCurrency } from '@/lib/format';

function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function StatsRowInvestments() {
  const { data: summary, isLoading } = usePortfolioSummary();
  // Same "closest point ~30 days back, falling back to the earliest available"
  // lookback already used for the Dashboard's Investments Value stat card.
  const { data: trend } = usePortfolioTrend(35);

  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card-light rounded-2xl h-28 shimmer" />)}
      </div>
    );
  }

  const points = trend ?? [];
  const current = points[points.length - 1];
  let previous = points[0];
  if (current) {
    const targetDate = new Date(current.date).getTime() - 30 * 24 * 60 * 60 * 1000;
    for (const p of points) {
      if (new Date(p.date).getTime() <= targetDate) previous = p;
    }
  }
  const valueDelta = current && previous && previous !== current
    ? pctDelta(current.totalCurrent, previous.totalCurrent)
    : null;

  const returnPct = summary.totalInvested > 0 ? (summary.totalPnl / summary.totalInvested) * 100 : null;

  const monthlyInvestment = summary.portfolio.reduce((s, inv) => s + (inv.monthlyAmount ?? 0), 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCardLight
        label="Total Investment Value"
        value={formatCurrency(summary.totalCurrent, 'INR', true)}
        icon={Wallet}
        deltaPct={valueDelta}
        sparkline={points.length > 1 ? points.map((p) => p.totalCurrent) : undefined}
        sparklineColor="#94A3B8"
        emptyHint={valueDelta === null ? 'Not enough history yet' : undefined}
      />
      <StatCardLight
        label="Total Invested"
        value={formatCurrency(summary.totalInvested, 'INR', true)}
        icon={Target}
        emptyHint="All time invested"
      />
      <StatCardLight
        label="Overall Returns"
        value={formatCurrency(summary.totalPnl, 'INR', true)}
        icon={TrendingUp}
        deltaPct={returnPct}
        deltaLabel="All time return"
        sparklineColor="#10B981"
      />
      <StatCardLight
        label="Monthly Investment"
        value={formatCurrency(monthlyInvestment, 'INR', true)}
        icon={Repeat}
        emptyHint="Recurring SIP/RD/Gold Scheme"
      />
    </div>
  );
}
