'use client';

import Link from 'next/link';
import { formatCurrency, formatDate } from '@/lib/format';
import { useGoals, useGoalProgress } from '@/hooks/useGoals';
import { GOAL_TYPE_ICONS } from '@/lib/constants';
import { Goal } from '@/types';

function GoalRow({ goal }: { goal: Goal }) {
  const { data: progress } = useGoalProgress(goal.id);
  const pct = progress?.currentPct ?? (goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0);
  // Each goal's own configured color when it has one, matching the
  // reference's per-goal colored bars -- real data, not a decorative palette.
  const barColor = goal.color || '#0B0B0B';

  return (
    <Link href={`/goals/${goal.id}`} className="flex items-center gap-3 -mx-1 px-1 py-2 rounded-xl hover:bg-paper-subtle transition-colors">
      <div className="w-9 h-9 rounded-xl bg-paper-subtle flex items-center justify-center text-base shrink-0">
        {goal.icon || GOAL_TYPE_ICONS[goal.goalType] || '🎯'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-ink-primary truncate">{goal.name}</p>
          <p className="text-xs text-ink-muted shrink-0">{pct.toFixed(0)}%</p>
        </div>
        <div className="h-1.5 mt-1.5 rounded-full bg-paper-subtle overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: barColor }} />
        </div>
        <p className="text-xs text-ink-muted mt-1">
          {formatCurrency(goal.currentAmount, 'INR', true)} of {formatCurrency(goal.targetAmount, 'INR', true)} · {formatDate(goal.targetDate, 'MMM yyyy')}
        </p>
      </div>
    </Link>
  );
}

export function GoalProgressLight() {
  const { data: goals, isLoading } = useGoals();

  if (isLoading) return <div className="card-light rounded-2xl h-72 shimmer" />;

  const active = (goals ?? []).filter((g) => !g.isCompleted).slice(0, 4);

  return (
    <div className="card-light rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-ink-primary">Goal Progress</h3>
        <Link href="/goals" className="text-xs font-medium text-ink-muted hover:text-ink-primary">View All</Link>
      </div>

      {active.length === 0 ? (
        <p className="text-sm text-ink-muted text-center py-8">No active goals yet</p>
      ) : (
        <div className="space-y-1">
          {active.map((goal) => <GoalRow key={goal.id} goal={goal} />)}
        </div>
      )}
    </div>
  );
}
