'use client';

import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { useDashboardOverview } from '@/hooks/useDashboard';
import { useBudgets } from '@/hooks/useBudgets';
import { computeBudgetPacing } from '@/lib/budgetPacing';
import { formatCurrency } from '@/lib/format';
import { Skeleton } from '@/components/shared/LoadingSkeleton';
import { cn } from '@/lib/utils';

function savingsHealthBand(rate: number): { label: string; color: string } {
  if (rate >= 30) return { label: 'Super Saver', color: 'text-success' };
  if (rate >= 15) return { label: 'Healthy Saver', color: 'text-accent-violet-light' };
  return { label: 'Budget Conscious', color: 'text-warning' };
}

/**
 * The headline number comes from useDashboardOverview alone, so a failing
 * or empty useBudgets never blanks it -- only the pacing sentence, which
 * needs category limits to mean anything, degrades gracefully instead.
 */
export function SafeToSpendHero() {
  const { data: overview, isLoading } = useDashboardOverview();
  const { data: budgets } = useBudgets();

  if (isLoading || !overview) {
    return (
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-10 w-56" />
      </div>
    );
  }

  const rate = overview.monthlyIncome > 0 ? (overview.remainingSafeToSave / overview.monthlyIncome) * 100 : 0;
  const band = savingsHealthBand(rate);
  const now = new Date();
  const pacing = budgets && budgets.length > 0 ? computeBudgetPacing(budgets, now) : null;

  const headline = pacing
    ? pacing.isPacingWell ? "You're pacing well this month." : "You're spending faster than the month is passing."
    : "Here's what's safe to spend.";

  const sub = pacing?.worstOffender
    ? `Spending is tracking ${pacing.isPacingWell ? 'under' : 'close to'} budget, but one category — ${pacing.worstOffender.budget.category.name} — is running ahead of pace and projected to finish over.`
    : pacing
    ? 'Every category is tracking within pace for the month so far.'
    : 'Set a budget on your biggest category to start seeing your pace here.';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: [0.2, 0.8, 0.2, 1] }}
      className="rounded-2xl p-6 bg-bg-surface border border-border shadow-raised"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-text-muted">
            {format(now, 'MMMM')}{pacing ? ` · ${pacing.daysElapsed} of ${pacing.daysInMonth} days elapsed` : ''}
          </p>
          <p className="text-lg font-medium text-text-primary mt-1 max-w-xl text-balance">{headline}</p>
          <p className="text-sm text-text-secondary mt-1 max-w-xl">{sub}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-text-muted">Savings Health</p>
          <p className={cn('font-mono text-2xl leading-tight', band.color)}>{rate.toFixed(1)}%</p>
          <p className={cn('text-xs font-semibold', band.color)}>{band.label}</p>
        </div>
      </div>

      <div className="flex items-end gap-3 flex-wrap mt-4">
        <span className="text-3xl font-bold tracking-tight text-text-primary tabular-nums">
          {formatCurrency(Math.max(0, overview.remainingSafeToSave))}
        </span>
        <span className="text-xs text-text-muted mb-1.5">safe to spend · rest of {format(now, 'MMMM')}</span>
      </div>
    </motion.div>
  );
}
