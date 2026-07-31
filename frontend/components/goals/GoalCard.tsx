'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Ring } from '@/components/shared/Ring';
import { formatCurrency, formatDate } from '@/lib/format';
import { GOAL_TYPE_ICONS, GOAL_PRIORITY_LABELS } from '@/lib/constants';
import { useGoalProgress, useGoalProbability } from '@/hooks/useGoals';
import { GoalContributionForm } from '@/components/goals/GoalContributionForm';
import { goalPredictionSentence } from '@/lib/goalPrediction';
import { Goal, GoalPriority } from '@/types';
import { cn } from '@/lib/utils';

const PRIORITY_BADGE: Record<GoalPriority, 'danger' | 'warning' | 'default' | 'secondary'> = {
  CRITICAL: 'danger', HIGH: 'warning', MEDIUM: 'default', LOW: 'secondary',
};

/**
 * A ring reads as a filling vessel in a way a linear bar doesn't -- the
 * point of this redesign. If useGoalProbability fails, the badge just
 * quietly doesn't render; pct already falls back to a simple client-side
 * calc so the ring itself never blanks.
 */
export function GoalCard({ goal }: { goal: Goal }) {
  const [showContribute, setShowContribute] = useState(false);
  const { data: progress, isLoading: progressLoading } = useGoalProgress(goal.id);
  const { data: probability } = useGoalProbability(goal.id);

  const pct = progress?.currentPct ?? (goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0);
  const ringColor = goal.color || '#7C3AED';

  return (
    <div className="glass-card-hover rounded-2xl p-5 space-y-4">
      <Link href={`/goals/${goal.id}`} className="block space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
              style={{ background: goal.color ? `${goal.color}20` : 'rgba(124,58,237,0.1)' }}
            >
              {goal.icon || GOAL_TYPE_ICONS[goal.goalType] || '🎯'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary truncate">{goal.name}</p>
              <div className="flex items-center gap-1.5 text-xs text-text-muted mt-0.5">
                <span>Target {formatDate(goal.targetDate, 'MMM yyyy')}</span>
                <Badge variant={PRIORITY_BADGE[goal.priority]} className="text-[10px] px-1.5 py-0">{GOAL_PRIORITY_LABELS[goal.priority]}</Badge>
              </div>
            </div>
          </div>
          {probability && (
            <Badge variant={probability.color as 'success' | 'warning' | 'danger'} className="shrink-0">{Math.round(probability.score)}% likely</Badge>
          )}
        </div>

        <div className="flex items-center gap-5">
          <Ring
            pct={pct} size={76} strokeWidth={7} color={ringColor}
            centerLabel={<span className="text-sm font-bold text-text-primary">{pct.toFixed(0)}%</span>}
          />
          <div className="flex-1 space-y-1.5 min-w-0">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">Saved</span>
              <span className="font-semibold font-mono text-text-primary">{formatCurrency(goal.currentAmount, 'INR', true)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">Target</span>
              <span className="font-semibold font-mono text-text-primary">{formatCurrency(goal.targetAmount, 'INR', true)}</span>
            </div>
            {!progressLoading && progress && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">Required</span>
                <span className={cn('font-semibold font-mono', progress.savingsGap > 0 ? 'text-danger' : 'text-success')}>
                  {formatCurrency(progress.requiredMonthlySavings, 'INR', true)}/mo
                </span>
              </div>
            )}
          </div>
        </div>

        {!progressLoading && progress && (
          <p className="text-xs text-text-secondary leading-relaxed">{goalPredictionSentence(goal, progress)}</p>
        )}
      </Link>

      <button
        type="button"
        onClick={() => setShowContribute(true)}
        className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-accent-violet-light hover:bg-accent-violet/10 rounded-xl py-2 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Add contribution
      </button>

      {showContribute && <GoalContributionForm goalId={goal.id} onClose={() => setShowContribute(false)} />}
    </div>
  );
}
