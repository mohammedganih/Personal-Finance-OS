'use client';

import { formatCurrency, formatDate } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { useGoalScenarios } from '@/hooks/useGoals';
import { cn } from '@/lib/utils';

function probabilityBadge(score: number): 'success' | 'warning' | 'danger' {
  if (score >= 70) return 'success';
  if (score >= 40) return 'warning';
  return 'danger';
}

export function GoalScenariosTab({ goalId }: { goalId: string }) {
  const { data: scenarios, isLoading } = useGoalScenarios(goalId);

  if (isLoading) return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass-card rounded-2xl h-56 shimmer" />)}</div>;
  if (!scenarios?.length) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {scenarios.map((s) => (
        <div key={s.name} className="glass-card rounded-2xl p-5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-text-primary">{s.name}</p>
              <p className="text-xs text-text-secondary mt-0.5">{s.description}</p>
            </div>
            <Badge variant={probabilityBadge(s.probability)} className="shrink-0">{Math.round(s.probability)}%</Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-bg-elevated rounded-lg p-2.5">
              <p className="text-text-muted">Completion Date</p>
              <p className="font-semibold text-text-primary mt-0.5">
                {s.completionDate ? formatDate(s.completionDate, 'MMM yyyy') : 'Never'}
              </p>
            </div>
            <div className="bg-bg-elevated rounded-lg p-2.5">
              <p className="text-text-muted">Monthly Needed</p>
              <p className="font-semibold text-text-primary mt-0.5 font-mono">{formatCurrency(s.monthlySavingNeeded, 'INR', true)}</p>
            </div>
            <div className="bg-bg-elevated rounded-lg p-2.5">
              <p className="text-text-muted">Total Contributions</p>
              <p className="font-semibold text-text-primary mt-0.5 font-mono">{formatCurrency(s.totalContributions, 'INR', true)}</p>
            </div>
            <div className="bg-bg-elevated rounded-lg p-2.5">
              <p className="text-text-muted">Investment Growth</p>
              <p className={cn('font-semibold mt-0.5 font-mono', s.investmentGrowth > 0 ? 'text-success' : 'text-text-primary')}>
                {formatCurrency(s.investmentGrowth, 'INR', true)}
              </p>
            </div>
          </div>

          {s.inflationImpact > 0 && (
            <p className="text-xs text-warning">
              Inflation adds {formatCurrency(s.inflationImpact, 'INR', true)} to the real cost of this goal.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
