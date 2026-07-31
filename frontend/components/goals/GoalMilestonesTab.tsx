'use client';

import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { useGoalMilestones } from '@/hooks/useGoals';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

/**
 * Celebrates a milestone crossed in real time, not one that was already
 * achieved before this component ever mounted -- the previous version
 * replayed its zoom-in animation on every render where `achieved` happened
 * to be true, so a 6-month-old milestone looked identical to one just hit.
 * `prevRef` starts null so the very first data load never counts as "just
 * crossed"; only a transition from false -> true after that does.
 */
export function GoalMilestonesTab({ goalId }: { goalId: string }) {
  const { data: milestones, isLoading } = useGoalMilestones(goalId);
  const { toast } = useToast();
  const prevRef = useRef<Map<number, boolean> | null>(null);
  const [justCrossed, setJustCrossed] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!milestones) return;
    const prev = prevRef.current;
    if (prev) {
      const crossed = milestones.filter((m) => m.achieved && prev.get(m.percentage) === false);
      if (crossed.length > 0) {
        setJustCrossed(new Set(crossed.map((m) => m.percentage)));
        for (const m of crossed) {
          toast({
            title: `🎉 ${m.percentage}% milestone reached!`,
            description: `${formatCurrency(m.amountAtMilestone, 'INR', true)} saved toward this goal.`,
          });
        }
        const timer = setTimeout(() => setJustCrossed(new Set()), 2200);
        prevRef.current = new Map(milestones.map((m) => [m.percentage, m.achieved]));
        return () => clearTimeout(timer);
      }
    }
    prevRef.current = new Map(milestones.map((m) => [m.percentage, m.achieved]));
  }, [milestones, toast]);

  if (isLoading) return <div className="glass-card rounded-2xl h-80 shimmer" />;
  if (!milestones?.length) return null;

  return (
    <div className="glass-card rounded-2xl p-5 space-y-5">
      <h3 className="text-sm font-semibold text-text-primary">Milestones</h3>

      <div className="flex items-center justify-between">
        {milestones.map((m, i) => {
          const isNew = justCrossed.has(m.percentage);
          return (
            <div key={m.percentage} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    'w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all',
                    m.achieved ? 'bg-success/15 border-success text-success' : 'bg-bg-elevated border-border text-text-muted',
                    isNew && 'animate-in zoom-in-50 duration-700 ring-4 ring-success/30'
                  )}
                >
                  {m.achieved ? <Check className="w-5 h-5" /> : `${m.percentage}%`}
                </div>
                <div className="text-center">
                  <p className={cn('text-xs font-medium', m.achieved ? 'text-text-primary' : 'text-text-muted')}>{m.percentage}%</p>
                  <p className="text-[10px] text-text-muted font-mono">{formatCurrency(m.amountAtMilestone, 'INR', true)}</p>
                  {m.achieved && m.achievedAt ? (
                    <p className="text-[10px] text-success mt-0.5">{formatDate(m.achievedAt, 'MMM yyyy')}</p>
                  ) : (
                    <p className="text-[10px] text-text-muted mt-0.5">not yet</p>
                  )}
                  <span className="sr-only">{m.achieved ? 'achieved' : 'not yet reached'}</span>
                </div>
              </div>
              {i < milestones.length - 1 && (
                <div className={cn('h-0.5 flex-1 -mt-6 mx-1', m.achieved ? 'bg-success/50' : 'bg-border')} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
