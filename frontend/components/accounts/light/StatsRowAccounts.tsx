'use client';

import { Wallet, Landmark, CreditCard, TrendingUp } from 'lucide-react';
import { StatCardLight } from '@/components/dashboard/light/StatCardLight';
import { AccountHealthGauge } from './AccountHealthGauge';
import { useDashboardOverview, useNetWorthTrend } from '@/hooks/useDashboard';
import { formatCurrency } from '@/lib/format';
import { NetWorthTrendPoint } from '@/types';

function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

// Same ~30-day-apart pair used by StatsRowLoans, generalized to whichever
// field of NetWorthTrendPoint the card needs.
function trendDelta(points: NetWorthTrendPoint[], field: keyof Omit<NetWorthTrendPoint, 'date'>): number | null {
  const current = points[points.length - 1];
  if (!current) return null;
  let previous = points[0];
  const targetDate = new Date(current.date).getTime() - 30 * 24 * 60 * 60 * 1000;
  for (const p of points) {
    if (new Date(p.date).getTime() <= targetDate) previous = p;
  }
  if (previous === current) return null;
  return pctDelta(current[field], previous[field]);
}

export function StatsRowAccounts() {
  const { data: overview, isLoading } = useDashboardOverview();
  const { data: trend } = useNetWorthTrend(35);

  if (isLoading || !overview) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="card-light rounded-2xl h-28 shimmer" />)}
      </div>
    );
  }

  const points = trend ?? [];
  const assetsDelta = trendDelta(points, 'totalAssets');
  const liabilitiesDelta = trendDelta(points, 'totalLiabilities');
  const netWorthDelta = trendDelta(points, 'netWorth');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      <StatCardLight
        label="Total Balance"
        value={formatCurrency(overview.bankBalance, 'INR', true)}
        icon={Wallet}
        emptyHint="Across bank & cash accounts"
      />
      <StatCardLight
        label="Total Assets"
        value={formatCurrency(overview.totalAssets, 'INR', true)}
        icon={Landmark}
        deltaPct={assetsDelta}
        sparkline={points.map((p) => p.totalAssets)}
        sparklineColor="#0CA30C"
        emptyHint={assetsDelta === null ? 'Tracking starts today' : undefined}
      />
      <StatCardLight
        label="Total Liabilities"
        value={formatCurrency(overview.totalLiabilities, 'INR', true)}
        icon={CreditCard}
        deltaPct={liabilitiesDelta}
        deltaGoodWhenUp={false}
        sparkline={points.map((p) => p.totalLiabilities)}
        sparklineColor="#D03B3B"
        emptyHint={liabilitiesDelta === null ? 'Tracking starts today' : undefined}
      />
      <StatCardLight
        label="Net Worth"
        value={formatCurrency(overview.netWorth, 'INR', true)}
        icon={TrendingUp}
        deltaPct={netWorthDelta}
        sparkline={points.map((p) => p.netWorth)}
        sparklineColor="#0CA30C"
        emptyHint={netWorthDelta === null ? 'Tracking starts today' : undefined}
      />
      <AccountHealthGauge />
    </div>
  );
}
