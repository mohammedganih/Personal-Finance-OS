'use client';

import { TrendingUp } from 'lucide-react';
import { useBudgets } from '@/hooks/useBudgets';
import { computeBudgetPacing } from '@/lib/budgetPacing';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

interface BurnRateCardProps {
  onSelectBudget?: (budgetId: string) => void;
}

/**
 * The pace tick is the same time-elapsed marker technique as Loans'
 * per-loan progress bar (computeLoanStats), applied to combined budget
 * spend instead of loan tenure. Its position has no meaning on its own --
 * the caption sentence above it is the accessible source of truth.
 */
export function BurnRateCard({ onSelectBudget }: BurnRateCardProps) {
  const { data: budgets, isLoading } = useBudgets();

  if (isLoading) return <div className="glass-card rounded-2xl h-40 shimmer" />;
  if (!budgets?.length) return null;

  const pacing = computeBudgetPacing(budgets);
  const burnPct = Math.min(100, pacing.combinedBurnPct);

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-text-muted" /> Budget Burn Rate
        </h3>
        <p className="text-xs text-text-secondary mt-1">
          {pacing.daysElapsed} of {pacing.daysInMonth} days elapsed ({pacing.elapsedPct.toFixed(0)}%) · {pacing.combinedBurnPct.toFixed(0)}% of combined budget spent
          — the tick marks where you&apos;d be if spend matched the calendar exactly.
        </p>
      </div>

      <div className="relative h-2 bg-bg-overlay rounded-full overflow-hidden">
        <div
          className={cn('absolute inset-y-0 left-0 rounded-full transition-all duration-500', pacing.isPacingWell ? 'bg-gradient-success' : 'bg-gradient-danger')}
          style={{ width: `${burnPct}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-warning/70"
          style={{ left: `${Math.min(pacing.elapsedPct, 99)}%` }}
          title={`Day ${pacing.daysElapsed} of ${pacing.daysInMonth} — you'd expect ${pacing.elapsedPct.toFixed(0)}% spent by now`}
        />
      </div>

      {pacing.worstOffender && (
        <div>
          <p className="text-xs font-semibold text-text-secondary mb-2">Spending forecast</p>
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-danger/15 text-danger flex items-center justify-center shrink-0">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <p className="text-xs text-text-secondary leading-relaxed pt-1">
              {pacing.worstOffender.budget.category.name} is projected to finish {(pacing.worstOffender.projectedPct - 100).toFixed(0)}% over budget —{' '}
              {formatCurrency(pacing.worstOffender.projectedOverAmount, 'INR', true)} more than planned, at the current pace.{' '}
              <button
                type="button"
                onClick={() => onSelectBudget?.(pacing.worstOffender!.budget.id)}
                className="text-accent-violet-light hover:underline"
              >
                Adjust the limit →
              </button>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
