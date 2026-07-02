'use client';

import { Target } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { formatCurrency, formatDate, getDaysUntil } from '@/lib/format';
import { useGoals } from '@/hooks/useGoals';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';

export function GoalProgressCard() {
  const { data: goals, isLoading } = useGoals();

  if (isLoading) return <div className="glass-card rounded-2xl p-5"><TableSkeleton rows={3} /></div>;

  const active = (goals || []).filter((g) => !g.isCompleted).slice(0, 4);

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Goal Progress</h3>
          <p className="text-xs text-text-secondary mt-0.5">{active.length} active goals</p>
        </div>
        <Target className="w-4 h-4 text-text-muted" />
      </div>

      {active.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-8">No active goals. Add one!</p>
      ) : (
        <div className="space-y-4">
          {active.map((goal) => {
            const pct = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
            const daysLeft = getDaysUntil(goal.targetDate);
            const monthsLeft = Math.max(Math.ceil(daysLeft / 30), 1);
            const remaining = goal.targetAmount - goal.currentAmount;
            const perMonth = remaining / monthsLeft;

            return (
              <div key={goal.id} className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg leading-none">{goal.icon ?? '🎯'}</span>
                    <div>
                      <p className="text-xs font-medium text-text-primary">{goal.name}</p>
                      <p className="text-xs text-text-muted">{formatDate(goal.targetDate, 'MMM yyyy')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-text-primary font-mono">
                      {formatCurrency(goal.currentAmount, 'INR', true)}
                    </p>
                    <p className="text-xs text-text-muted font-mono">/ {formatCurrency(goal.targetAmount, 'INR', true)}</p>
                  </div>
                </div>
                <Progress value={pct} className="h-1.5" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">{pct.toFixed(1)}% complete</span>
                  <span className="text-xs text-accent-violet-light">
                    ~{formatCurrency(perMonth, 'INR', true)}/mo needed
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
