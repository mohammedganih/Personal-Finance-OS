'use client';

import { motion } from 'framer-motion';
import { Skeleton } from '@/components/shared/LoadingSkeleton';
import { useDashboardOverview } from '@/hooks/useDashboard';
import { formatCurrency } from '@/lib/format';

const SEGMENTS = [
  { key: 'otherExpenses', label: 'Expenses', color: 'bg-danger' },
  { key: 'effectiveSubscriptionSpent', label: 'Bills', color: 'bg-accent-violet' },
  { key: 'effectiveEMISpent', label: 'EMIs', color: 'bg-warning' },
  { key: 'effectiveInvestmentSpent', label: 'Investments', color: 'bg-info' },
  { key: 'remainingSafeToSave', label: 'Safe to save', color: 'bg-success' },
] as const;

interface SnapshotBarProps {
  title?: string;
  // Budgets reuses this bar for its own "where income is committed" tier,
  // but needs the "whichever is higher" methodology note that Dashboard's
  // compact glance doesn't -- shown only when passed.
  footnote?: string;
}

/**
 * Proportional view of where this month's income is committed -- replaces
 * the old row of independent StatCards with the actual relationship
 * between income, spend, commitments and surplus. Same fields
 * SafeToSaveBreakdown used to compute independently; also reused as-is by
 * the Budgets page's commitment bar.
 */
export function SnapshotBar({ title = "This month's shape", footnote }: SnapshotBarProps) {
  const { data: overview, isLoading } = useDashboardOverview();

  if (isLoading || !overview) {
    return (
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <Skeleton className="h-3.5 w-full rounded-full" />
        <div className="flex gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-16" />
          ))}
        </div>
      </div>
    );
  }

  const income = overview.monthlyIncome;
  if (income <= 0) return null;

  const segments = SEGMENTS.map((s) => {
    const value = Math.max(0, overview[s.key]);
    const pct = (value / income) * 100;
    return { ...s, value, pct };
  });

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        <span className="text-xs text-text-muted font-mono">{formatCurrency(income, 'INR', true)} income</span>
      </div>

      <div className="h-3.5 w-full rounded-full bg-bg-overlay flex overflow-hidden">
        {segments.map(
          (s, i) =>
            s.pct > 0 && (
              <motion.div
                key={s.key}
                initial={{ width: 0 }}
                animate={{ width: `${s.pct}%` }}
                transition={{ duration: 0.42, delay: i * 0.04, ease: [0.2, 0.8, 0.2, 1] }}
                className={s.color}
                title={`${s.label}: ${formatCurrency(s.value, 'INR', true)}`}
              />
            )
        )}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs">
            <span className={`w-2 h-2 rounded-sm shrink-0 ${s.color}`} />
            <span className="text-text-secondary">{s.label}</span>
            <span className="text-text-primary font-mono font-medium">{formatCurrency(s.value, 'INR', true)}</span>
          </div>
        ))}
      </div>

      {footnote && <p className="text-[11px] text-text-muted leading-relaxed">{footnote}</p>}
    </div>
  );
}
