'use client';

import Link from 'next/link';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/format';
import { GOAL_TYPE_ICONS, GOAL_PRIORITY_LABELS } from '@/lib/constants';
import { useGoalProgress, useGoalProbability } from '@/hooks/useGoals';
import { Goal, GoalPriority } from '@/types';
import { cn } from '@/lib/utils';

const PRIORITY_BADGE: Record<GoalPriority, 'danger' | 'warning' | 'default' | 'secondary'> = {
  CRITICAL: 'danger', HIGH: 'warning', MEDIUM: 'default', LOW: 'secondary',
};

export function GoalCard({ goal }: { goal: Goal }) {
  const { data: progress, isLoading: progressLoading } = useGoalProgress(goal.id);
  const { data: probability } = useGoalProbability(goal.id);

  const pct = progress?.currentPct ?? (goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0);

  return (
    <Link href={`/goals/${goal.id}`} className="glass-card-hover rounded-2xl p-5 space-y-4 block">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
            style={{ background: goal.color ? `${goal.color}20` : 'rgba(124,58,237,0.1)' }}
          >
            {goal.icon || GOAL_TYPE_ICONS[goal.goalType] || '🎯'}
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">{goal.name}</p>
            <p className="text-xs text-text-muted">Target: {formatDate(goal.targetDate, 'MMM yyyy')}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={PRIORITY_BADGE[goal.priority]}>{GOAL_PRIORITY_LABELS[goal.priority]}</Badge>
          {probability && (
            <Badge variant={probability.color as 'success' | 'warning' | 'danger'}>{probability.band}</Badge>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-end justify-between mb-2">
          <p className="text-xs text-text-secondary">Progress</p>
          <p className="text-xs font-medium text-text-primary">{pct.toFixed(1)}%</p>
        </div>
        <Progress value={pct} className="h-2" />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-text-muted">Saved</p>
          <p className="text-sm font-semibold font-mono text-text-primary">{formatCurrency(goal.currentAmount, 'INR', true)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-text-muted">Target</p>
          <p className="text-sm font-semibold font-mono text-text-primary">{formatCurrency(goal.targetAmount, 'INR', true)}</p>
        </div>
      </div>

      {!progressLoading && progress && (
        <div className="p-2.5 rounded-xl bg-bg-elevated flex items-center justify-between">
          <p className="text-xs text-text-secondary">Required</p>
          <p className={cn('text-xs font-semibold', progress.savingsGap > 0 ? 'text-danger' : 'text-success')}>
            {formatCurrency(progress.requiredMonthlySavings, 'INR', true)}/mo
            {progress.savingsGap > 0 && ` (short by ${formatCurrency(progress.savingsGap, 'INR', true)})`}
          </p>
        </div>
      )}
    </Link>
  );
}
