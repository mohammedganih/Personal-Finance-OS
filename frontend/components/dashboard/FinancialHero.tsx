'use client';

import { motion } from 'framer-motion';
import { StatCard } from '@/components/ui/StatCard';
import { Skeleton } from '@/components/shared/LoadingSkeleton';
import { useDashboardOverview, useCashflowTrend } from '@/hooks/useDashboard';
import { useAuthStore } from '@/stores/auth.store';
import { useCountUp } from '@/hooks/useCountUp';
import { formatCurrency } from '@/lib/format';
import { BarChart3, CreditCard } from 'lucide-react';

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

/**
 * Builds the "you saved X, Y% better than last month" narrative from the
 * two most recent points in the cashflow trend. Falls back to a neutral
 * line when there isn't a comparable previous month (new account, or a
 * previous month with zero savings makes a %-change meaningless).
 */
function useNarrative() {
  const { data: trend } = useCashflowTrend(2);
  if (!trend || trend.length < 2) return null;

  const current = trend[trend.length - 1];
  const previous = trend[trend.length - 2];
  if (previous.savings === 0) return null;

  const deltaPct = ((current.savings - previous.savings) / Math.abs(previous.savings)) * 100;
  const better = deltaPct >= 0;

  return {
    savings: current.savings,
    deltaPct,
    better,
    sentence: `You ${current.savings >= 0 ? 'saved' : 'spent'} ${formatCurrency(Math.abs(current.savings), 'INR', true)} this month — ${Math.abs(deltaPct).toFixed(0)}% ${better ? 'better' : 'behind'} than last month.`,
  };
}

export function FinancialHero() {
  const { data: overview, isLoading } = useDashboardOverview();
  const { user } = useAuthStore();
  const narrative = useNarrative();
  const netWorth = useCountUp(overview?.netWorth ?? 0);

  if (isLoading || !overview) {
    return (
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-10 w-56" />
      </div>
    );
  }

  const wealthUp = overview.monthlyWealthCreation >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: [0.2, 0.8, 0.2, 1] }}
      className="rounded-2xl p-6 bg-bg-surface border border-border shadow-raised space-y-5"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-text-muted">
            {greeting()}, {user?.name?.split(' ')[0] ?? 'there'}
          </p>
          <p className="text-lg font-medium text-text-primary mt-1 max-w-xl">
            {narrative?.sentence ?? "Here's your financial snapshot."}
          </p>
        </div>
      </div>

      <div className="flex items-end gap-3 flex-wrap">
        <span className="text-4xl font-bold tracking-tight text-text-primary tabular-nums">
          {formatCurrency(Math.round(netWorth))}
        </span>
        <span
          className={
            wealthUp
              ? 'text-xs font-medium text-success bg-success/10 px-2.5 py-1 rounded-full mb-1.5'
              : 'text-xs font-medium text-danger bg-danger/10 px-2.5 py-1 rounded-full mb-1.5'
          }
        >
          {wealthUp ? '+' : ''}
          {formatCurrency(overview.monthlyWealthCreation, 'INR', true)} this month
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-md">
        <StatCard
          compact
          title="Investment Value"
          value={overview.investmentValue}
          icon={BarChart3}
          iconColor="bg-warning/15 text-warning"
        />
        <StatCard
          compact
          title="Debt Ratio"
          value={overview.debtRatio}
          icon={CreditCard}
          iconColor="bg-danger/15 text-danger"
          isCurrency={false}
          isPercent
          invertChange
        />
      </div>
    </motion.div>
  );
}
