'use client';

import Link from 'next/link';
import { Target } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/format';
import { useGoals, useGoalProgress, useGoalProbability } from '@/hooks/useGoals';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import { GOAL_TYPE_ICONS } from '@/lib/constants';
import { Goal } from '@/types';
import { cn } from '@/lib/utils';

function GoalRow({ goal }: { goal: Goal }) {
  const { data: progress } = useGoalProgress(goal.id);
  const { data: probability } = useGoalProbability(goal.id);
  const pct = progress?.currentPct ?? (goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0);

  return (
    <Link href={`/goals/${goal.id}`} className="block space-y-2 -mx-1 px-1 py-1 rounded-lg hover:bg-bg-elevated/50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none">{goal.icon || GOAL_TYPE_ICONS[goal.goalType] || '🎯'}</span>
          <div>
            <p className="text-xs font-medium text-text-primary">{goal.name}</p>
            <p className="text-xs text-text-muted">{formatDate(goal.targetDate, 'MMM yyyy')}</p>
          </div>
        </div>
        <div className="text-right flex flex-col items-end gap-0.5">
          <p className="text-xs font-semibold text-text-primary font-mono">
            {formatCurrency(goal.currentAmount, 'INR', true)}
          </p>
          {probability && <Badge variant={probability.color as 'success' | 'warning' | 'danger'} className="text-[10px] px-1.5 py-0">{probability.band}</Badge>}
        </div>
      </div>
      <Progress value={pct} className="h-1.5" />
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">{pct.toFixed(1)}% complete</span>
        {progress && (
          <span className={cn('text-xs', progress.savingsGap > 0 ? 'text-danger' : 'text-accent-violet-light')}>
            ~{formatCurrency(progress.requiredMonthlySavings, 'INR', true)}/mo needed
          </span>
        )}
      </div>
    </Link>
  );
}

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
          {active.map((goal) => <GoalRow key={goal.id} goal={goal} />)}
        </div>
      )}
    </div>
  );
}
