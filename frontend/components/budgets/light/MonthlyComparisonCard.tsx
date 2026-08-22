'use client';

import { ArrowUp, ArrowDown } from 'lucide-react';
import { useBudgets, useBudgetsForPeriod } from '@/hooks/useBudgets';
import { computeBudgetPacing } from '@/lib/budgetPacing';
import { usePeriodStore } from '@/stores/period.store';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

function DeltaBadge({ delta, format }: { delta: number | null; format: (v: number) => string }) {
  if (delta === null || delta === 0) return <span className="text-xs text-ink-muted">—</span>;
  const isUp = delta > 0;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', isUp ? 'text-updown-down' : 'text-updown-up')}>
      {isUp ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      {format(Math.abs(delta))}
    </span>
  );
}

/** No dropdown period picker (unlike the reference) -- always compares
 * against the single previous calendar month, which is what "vs last
 * month" already means everywhere else in this app (StatCardLight's own
 * deltaLabel convention). */
export function MonthlyComparisonCard() {
  const { month, year } = usePeriodStore();
  const { data: budgets, isLoading } = useBudgets();

  const prevDate = new Date(year, month - 2, 1);
  const { data: prevBudgets } = useBudgetsForPeriod(prevDate.getMonth() + 1, prevDate.getFullYear());

  if (isLoading || !budgets) return <div className="card-light rounded-2xl h-52 shimmer" />;
  if (budgets.length === 0) return null;

  const pacing = computeBudgetPacing(budgets);
  const overspentCount = budgets.filter((b) => b.status === 'over').length;

  const hasPrev = !!prevBudgets && prevBudgets.length > 0;
  const prevPacing = hasPrev ? computeBudgetPacing(prevBudgets!) : null;
  const prevOverspentCount = hasPrev ? prevBudgets!.filter((b) => b.status === 'over').length : null;

  const utilizationDelta = prevPacing ? pacing.combinedBurnPct - prevPacing.combinedBurnPct : null;
  const spentDelta = prevPacing ? pacing.combinedSpent - prevPacing.combinedSpent : null;
  const overspentDelta = prevOverspentCount !== null ? overspentCount - prevOverspentCount : null;

  return (
    <div className="card-light rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-ink-primary">Monthly Comparison</h3>
        <span className="text-xs text-ink-muted">vs {formatDate(prevDate, 'MMM yyyy')}</span>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-secondary">Budget Utilization</span>
          <span className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink-primary tabular-nums">{pacing.combinedBurnPct.toFixed(1)}%</span>
            <DeltaBadge delta={utilizationDelta} format={(v) => `${v.toFixed(1)}%`} />
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-secondary">Total Spent</span>
          <span className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink-primary tabular-nums">{formatCurrency(pacing.combinedSpent, 'INR', true)}</span>
            <DeltaBadge delta={spentDelta} format={(v) => formatCurrency(v, 'INR', true)} />
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-secondary">Overspent Categories</span>
          <span className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink-primary tabular-nums">{overspentCount}</span>
            <DeltaBadge delta={overspentDelta} format={(v) => `${v}`} />
          </span>
        </div>
      </div>
    </div>
  );
}
