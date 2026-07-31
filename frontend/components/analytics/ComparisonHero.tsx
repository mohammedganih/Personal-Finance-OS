'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/shared/LoadingSkeleton';
import { useCashflowTrend } from '@/hooks/useDashboard';
import { buildComparisonNarrative, ComparisonMode } from '@/lib/comparisonNarrative';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

const MODES: { key: ComparisonMode; label: string }[] = [
  { key: 'month', label: 'Vs last month' },
  { key: 'year', label: 'Vs last year' },
];

export function ComparisonHero() {
  const [mode, setMode] = useState<ComparisonMode>('month');
  // 13 months so index 0 lands on the same calendar month a year ago --
  // "vs last year" needs no separate endpoint.
  const { data: trend, isLoading } = useCashflowTrend(13);

  if (isLoading || !trend) {
    return (
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-10 w-48" />
      </div>
    );
  }

  const result = buildComparisonNarrative(trend, mode);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: [0.2, 0.8, 0.2, 1] }}
      className="rounded-2xl p-6 bg-bg-surface border border-border shadow-raised"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-text-muted">Joint · {trend[trend.length - 1]?.month}</p>
          <h2 className="text-lg font-medium text-text-primary mt-1 max-w-xl text-balance">{result.title}</h2>
          <p className="text-sm text-text-secondary mt-1 max-w-xl">{result.narrative}</p>

          {result.comparisonAvailable && (
            <div className="flex items-end gap-3 flex-wrap mt-3">
              <span
                className={cn(
                  'text-3xl font-bold tracking-tight tabular-nums',
                  result.deltaAmount >= 0 ? 'text-success' : 'text-danger'
                )}
              >
                {result.deltaAmount >= 0 ? '+' : '-'}
                {formatCurrency(Math.abs(result.deltaAmount))}
              </span>
              <span className="text-xs text-text-muted mb-1.5">{result.comparisonLabel}</span>
            </div>
          )}
        </div>

        <div
          role="radiogroup"
          aria-label="Comparison period"
          className="inline-flex bg-bg-elevated rounded-full p-1 gap-1 shrink-0"
        >
          {MODES.map((m) => (
            <button
              key={m.key}
              role="radio"
              aria-checked={mode === m.key}
              onClick={() => setMode(m.key)}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors',
                mode === m.key
                  ? 'bg-bg-surface text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
