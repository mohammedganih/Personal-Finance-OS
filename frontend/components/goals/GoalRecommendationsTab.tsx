'use client';

import { AlertTriangle, AlertCircle, Info, CheckCircle2, Lightbulb } from 'lucide-react';
import { useGoalRecommendations } from '@/hooks/useGoals';
import { GoalRecommendationSeverity } from '@/types';
import { cn } from '@/lib/utils';

const SEVERITY_CONFIG: Record<GoalRecommendationSeverity, { icon: typeof AlertTriangle; text: string; bg: string; border: string }> = {
  critical: { icon: AlertTriangle, text: 'text-danger',  bg: 'bg-danger/8',  border: 'border-danger/20' },
  warning:  { icon: AlertCircle,   text: 'text-warning', bg: 'bg-warning/8', border: 'border-warning/20' },
  info:     { icon: Info,          text: 'text-info',    bg: 'bg-info/8',    border: 'border-info/20' },
  positive: { icon: CheckCircle2,  text: 'text-success',  bg: 'bg-success/8', border: 'border-success/20' },
};

export function GoalRecommendationsTab({ goalId }: { goalId: string }) {
  const { data, isLoading } = useGoalRecommendations(goalId);

  if (isLoading) return <div className="glass-card rounded-2xl h-48 shimmer" />;
  if (!data?.length) return null;

  return (
    <div className="glass-card rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-text-muted" />
        <h3 className="text-sm font-semibold text-text-primary">Recommended Actions</h3>
      </div>
      <div className="space-y-2">
        {data.map((rec) => {
          const cfg = SEVERITY_CONFIG[rec.severity];
          const Icon = cfg.icon;
          return (
            <div key={`${rec.priority}-${rec.title}`} className={cn('rounded-xl p-3 flex items-start gap-3 border', cfg.bg, cfg.border)}>
              <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', cfg.text)} />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-text-primary">{rec.title}</p>
                <p className="text-xs text-text-secondary mt-0.5">{rec.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
