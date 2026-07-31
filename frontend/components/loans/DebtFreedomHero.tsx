'use client';

import { motion } from 'framer-motion';
import { addMonths, format } from 'date-fns';
import { useDebtStrategy, useHealthScore } from '@/hooks/useDebtIntelligence';
import { Skeleton } from '@/components/shared/LoadingSkeleton';
import { formatCurrency } from '@/lib/format';
import { HealthScoreBand } from '@/types';
import { cn } from '@/lib/utils';

const BAND_COLOR: Record<HealthScoreBand, string> = {
  excellent: 'text-success', good: 'text-success', fair: 'text-warning', poor: 'text-warning', critical: 'text-danger',
};
const BAND_LABEL: Record<HealthScoreBand, string> = {
  excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Poor', critical: 'Critical',
};

interface DebtFreedomHeroProps {
  extraPayment: number;
}

/**
 * "How close am I to being debt-free" as a date and a feeling of momentum,
 * not a scoreboard of loans/cards/IOUs. Mirrors the Dashboard hero's shell.
 * No debt at all is its own distinct win state -- not the generic empty
 * state used elsewhere for "you haven't added data yet".
 */
export function DebtFreedomHero({ extraPayment }: DebtFreedomHeroProps) {
  const { data: strategy, isLoading } = useDebtStrategy(extraPayment);
  const { data: health } = useHealthScore();

  if (isLoading || !strategy) {
    return (
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-10 w-56" />
      </div>
    );
  }

  if (strategy.debts.length === 0) {
    return (
      <div className="rounded-2xl p-6 bg-bg-surface border border-success/25 shadow-raised">
        <p className="text-sm text-text-muted">Joint · all debt combined</p>
        <h2 className="text-2xl font-semibold text-text-primary mt-1">You&apos;re debt-free 🎉</h2>
        <p className="text-sm text-text-secondary mt-1">
          No active loans, revolving card balances, or card EMIs to track. Keep it that way.
        </p>
      </div>
    );
  }

  const bestMonths = strategy.bestStrategy === 'avalanche' ? strategy.avalancheMonthsWithExtra : strategy.snowballMonthsWithExtra;
  const monthsSooner = strategy.baseMonths - bestMonths;
  const debtFreeDate = addMonths(new Date(), bestMonths);
  const order = strategy.bestStrategy === 'avalanche' ? strategy.avalancheOrder : strategy.snowballOrder;
  const firstDebt = strategy.debts.find((d) => d.id === order[0]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: [0.2, 0.8, 0.2, 1] }}
      className="rounded-2xl p-6 bg-bg-surface border border-border shadow-raised"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-text-muted">Joint · all debt combined</p>
          <h2 className="text-xl sm:text-2xl font-semibold text-text-primary mt-1 max-w-xl text-balance">
            {monthsSooner >= 1
              ? `You could be debt-free ${monthsSooner} month${monthsSooner === 1 ? '' : 's'} sooner.`
              : "Here's your path to being debt-free."}
          </h2>
          {extraPayment > 0 && firstDebt && (
            <p className="text-sm text-text-secondary mt-1 max-w-xl">
              Following the {strategy.bestStrategy === 'avalanche' ? 'Avalanche' : 'Snowball'} strategy with{' '}
              {formatCurrency(extraPayment, 'INR', true)}/mo extra, starting with your {firstDebt.name} at {firstDebt.interestRate}% p.a.
            </p>
          )}
          <div className="flex items-baseline gap-2 mt-3 flex-wrap">
            <span className="text-3xl font-bold text-text-primary tracking-tight">{format(debtFreeDate, 'MMM yyyy')}</span>
            {monthsSooner >= 1 && (
              <span className="text-xs font-medium text-success bg-success/10 px-2.5 py-1 rounded-full">
                ↓ {monthsSooner}mo earlier · {strategy.bestStrategy} + {formatCurrency(extraPayment, 'INR', true)}/mo
              </span>
            )}
          </div>
        </div>

        {health && (
          <div className="text-right shrink-0">
            <p className="text-xs text-text-muted">Debt Health</p>
            <p className={cn('font-mono text-3xl leading-tight', BAND_COLOR[health.band])}>
              {Math.round(health.score)}<span className="text-xs text-text-muted"> /100</span>
            </p>
            <p className={cn('text-xs font-semibold', BAND_COLOR[health.band])}>{BAND_LABEL[health.band]}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
