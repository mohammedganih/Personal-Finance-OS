'use client';

import { Briefcase, CreditCard, PieChart, TrendingUp } from 'lucide-react';
import { StatCardLight } from '@/components/dashboard/StatCardLight';
import { useBudgets, useBudgetsForPeriod } from '@/hooks/useBudgets';
import { computeBudgetPacing } from '@/lib/budgetPacing';
import { usePeriodStore } from '@/stores/period.store';
import { formatCurrency } from '@/lib/format';

export function StatsRowBudgets() {
  const { month, year } = usePeriodStore();
  const { data: budgets, isLoading } = useBudgets();

  const prevDate = new Date(year, month - 2, 1); // month is 1-indexed
  const { data: prevBudgets } = useBudgetsForPeriod(prevDate.getMonth() + 1, prevDate.getFullYear());

  if (isLoading || !budgets) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card-light rounded-2xl h-28 shimmer" />)}
      </div>
    );
  }

  const pacing = computeBudgetPacing(budgets);
  const remaining = pacing.combinedLimit - pacing.combinedSpent;
  const remainingPct = pacing.combinedLimit > 0 ? (remaining / pacing.combinedLimit) * 100 : 0;

  const prevUtilization = prevBudgets && prevBudgets.length > 0
    ? computeBudgetPacing(prevBudgets).combinedBurnPct
    : null;
  const utilizationDelta = prevUtilization !== null ? pacing.combinedBurnPct - prevUtilization : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCardLight
        label="Total Budgeted"
        value={formatCurrency(pacing.combinedLimit, 'INR', true)}
        icon={Briefcase}
        emptyHint={`Across ${budgets.length} categor${budgets.length === 1 ? 'y' : 'ies'}`}
      />
      <StatCardLight
        label="Total Spent"
        value={formatCurrency(pacing.combinedSpent, 'INR', true)}
        icon={CreditCard}
        emptyHint={`${pacing.combinedBurnPct.toFixed(1)}% of budget`}
      />
      <StatCardLight
        label="Remaining"
        value={formatCurrency(Math.max(0, remaining), 'INR', true)}
        icon={PieChart}
        emptyHint={`${Math.max(0, remainingPct).toFixed(1)}% of budget`}
      />
      <StatCardLight
        label="Average Utilization"
        value={`${pacing.combinedBurnPct.toFixed(1)}%`}
        icon={TrendingUp}
        deltaPct={utilizationDelta}
        deltaGoodWhenUp={false}
        deltaLabel="vs last month"
        emptyHint={utilizationDelta === null ? 'No data for last month' : undefined}
      />
    </div>
  );
}
