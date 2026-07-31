'use client';

import { HeartPulse } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useGoalProbability } from '@/hooks/useGoals';

/**
 * Extracted from the old Overview tab's "Goal Health" block -- same data,
 * same useGoalProbability hook, just its own card now that Overview no
 * longer exists as a tab.
 */
export function GoalHealthCard({ goalId }: { goalId: string }) {
  const { data: probability, isLoading } = useGoalProbability(goalId);

  if (isLoading) return <div className="glass-card rounded-2xl p-5 h-56 shimmer" />;
  if (!probability) return null;

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HeartPulse className="w-4 h-4 text-text-muted" />
          <h3 className="text-sm font-semibold text-text-primary">Goal Health</h3>
        </div>
        <Badge variant={probability.color as 'success' | 'warning' | 'danger'}>{probability.band} · {Math.round(probability.score)}</Badge>
      </div>
      <div className="space-y-3">
        {probability.factors.map((f) => (
          <div key={f.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-text-secondary">{f.label}</span>
              <span className="text-xs text-text-muted">{f.detail}</span>
            </div>
            <Progress value={f.score} className="h-1.5" indicatorClassName={f.score >= 70 ? 'bg-success' : f.score >= 40 ? 'bg-warning' : 'bg-danger'} />
          </div>
        ))}
      </div>
    </div>
  );
}
