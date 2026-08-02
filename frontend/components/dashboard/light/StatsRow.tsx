'use client';

import { TrendingUp, Wallet, CreditCard, PieChart, Target } from 'lucide-react';
import { StatCardLight } from './StatCardLight';
import { useDashboardOverview, useCashflowTrend, useNetWorthTrend } from '@/hooks/useDashboard';
import { usePortfolioTrend } from '@/hooks/useInvestmentIntelligence';
import { formatCurrency } from '@/lib/format';

function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function StatsRow() {
  const { data: overview, isLoading: overviewLoading } = useDashboardOverview();
  const { data: cashflow } = useCashflowTrend(6);
  const { data: netWorthTrend } = useNetWorthTrend(180);
  const { data: portfolioTrend } = usePortfolioTrend(180);

  if (overviewLoading || !overview) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="card-light rounded-2xl h-32 shimmer" />)}
      </div>
    );
  }

  const income = cashflow ?? [];
  const incomeCurrent = income[income.length - 1];
  const incomePrev = income[income.length - 2];

  const nwPoints = netWorthTrend ?? [];
  const nwCurrent = nwPoints[nwPoints.length - 1];
  const nwPrev = nwPoints[nwPoints.length - 2];

  // Compare against the point closest to 30 days before the most recent one,
  // falling back to the earliest available point when there's less history
  // than that -- real data either way, never backfilled.
  const invPoints = portfolioTrend ?? [];
  const invCurrent = invPoints[invPoints.length - 1];
  let invPrev = invPoints[0];
  if (invCurrent) {
    const targetDate = new Date(invCurrent.date).getTime() - 30 * 24 * 60 * 60 * 1000;
    for (const p of invPoints) {
      if (new Date(p.date).getTime() <= targetDate) invPrev = p;
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      <StatCardLight
        label="Net Worth"
        value={formatCurrency(overview.netWorth, 'INR', true)}
        icon={TrendingUp}
        deltaPct={nwPrev ? pctDelta(nwCurrent.netWorth, nwPrev.netWorth) : null}
        deltaLabel="vs last reading"
        sparkline={nwPoints.length > 1 ? nwPoints.map((p) => p.netWorth) : undefined}
        sparklineColor="#94A3B8"
        emptyHint={nwPoints.length < 2 ? 'Tracking starts today' : undefined}
      />
      <StatCardLight
        label="Monthly Income"
        value={formatCurrency(overview.monthlyIncome, 'INR', true)}
        icon={Wallet}
        deltaPct={incomePrev ? pctDelta(incomeCurrent.income, incomePrev.income) : null}
        sparkline={income.length > 1 ? income.map((c) => c.income) : undefined}
        sparklineColor="#10B981"
      />
      <StatCardLight
        label="Monthly Expenses"
        value={formatCurrency(overview.monthlyExpenses, 'INR', true)}
        icon={CreditCard}
        deltaPct={incomePrev ? pctDelta(incomeCurrent.expenses, incomePrev.expenses) : null}
        deltaGoodWhenUp={false}
        sparkline={income.length > 1 ? income.map((c) => c.expenses) : undefined}
        sparklineColor="#EF4444"
      />
      <StatCardLight
        label="Investments Value"
        value={formatCurrency(overview.investmentValue, 'INR', true)}
        icon={PieChart}
        deltaPct={invCurrent && invPrev && invPrev !== invCurrent ? pctDelta(invCurrent.totalCurrent, invPrev.totalCurrent) : null}
        sparkline={invPoints.length > 1 ? invPoints.map((p) => p.totalCurrent) : undefined}
        sparklineColor="#94A3B8"
        emptyHint={invPoints.length < 2 ? 'Tracking starts today' : undefined}
      />
      <StatCardLight
        label="Savings Rate"
        value={`${overview.savingsRate.toFixed(1)}%`}
        icon={Target}
        ring={overview.savingsRate}
        ringColor="#10B981"
      />
    </div>
  );
}
