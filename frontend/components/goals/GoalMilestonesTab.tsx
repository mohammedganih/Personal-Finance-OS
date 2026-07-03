'use client';

import { Check } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { useGoalMilestones } from '@/hooks/useGoals';
import { cn } from '@/lib/utils';

export function GoalMilestonesTab({ goalId }: { goalId: string }) {
  const { data: milestones, isLoading } = useGoalMilestones(goalId);

  if (isLoading) return <div className="glass-card rounded-2xl h-80 shimmer" />;
  if (!milestones?.length) return null;

  return (
    <div className="glass-card rounded-2xl p-5 space-y-5">
      <h3 className="text-sm font-semibold text-text-primary">Milestones</h3>

      <div className="flex items-center justify-between">
        {milestones.map((m, i) => (
          <div key={m.percentage} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  'w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all',
                  m.achieved
                    ? 'bg-success/15 border-success text-success animate-in zoom-in-95 duration-500'
                    : 'bg-bg-elevated border-border text-text-muted',
                )}
              >
                {m.achieved ? <Check className="w-5 h-5" /> : `${m.percentage}%`}
              </div>
              <div className="text-center">
                <p className={cn('text-xs font-medium', m.achieved ? 'text-text-primary' : 'text-text-muted')}>{m.percentage}%</p>
                <p className="text-[10px] text-text-muted font-mono">{formatCurrency(m.amountAtMilestone, 'INR', true)}</p>
                {m.achieved && m.achievedAt && (
                  <p className="text-[10px] text-success mt-0.5">{formatDate(m.achievedAt, 'MMM yyyy')}</p>
                )}
              </div>
            </div>
            {i < milestones.length - 1 && (
              <div className={cn('h-0.5 flex-1 -mt-6 mx-1', m.achieved ? 'bg-success/50' : 'bg-border')} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
