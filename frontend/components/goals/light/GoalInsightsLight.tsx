'use client';

import Link from 'next/link';
import { Sparkles, AlertTriangle, CheckCircle2, Lightbulb, LucideIcon } from 'lucide-react';
import { useGoalInsights } from '@/hooks/useGoals';
import { GoalRecommendationSeverity } from '@/types';

const SEVERITY_ICON: Record<GoalRecommendationSeverity, LucideIcon> = {
  critical: AlertTriangle,
  warning: AlertTriangle,
  info: Lightbulb,
  positive: CheckCircle2,
};

const SEVERITY_COLOR: Record<GoalRecommendationSeverity, string> = {
  critical: '#D03B3B',
  warning: '#B45309',
  info: '#0B0B0B',
  positive: '#0CA30C',
};

/**
 * useGoalInsights() is already real, cross-goal content (goalIntelligence
 * .service.ts::getGoalInsights) -- flags goals running behind their target
 * pace (warning) or ahead of it (positive). Same card shell as
 * LoanInsightsLight, with each insight linking to its own goal rather than
 * a single shared "view plan" action, since insights here span goals.
 */
export function GoalInsightsLight() {
  const { data: insights, isLoading } = useGoalInsights();

  if (isLoading) return <div className="card-light rounded-2xl h-64 shimmer" />;

  const list = insights ?? [];
  if (list.length === 0) return null;

  return (
    <div className="card-light rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-mono" />
        <h3 className="text-sm font-semibold text-ink-primary">AI Insights</h3>
      </div>

      <div className="space-y-3">
        {list.map((insight, i) => {
          const Icon = SEVERITY_ICON[insight.severity];
          return (
            <div key={`${insight.goalId}-${i}`} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-paper-subtle flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5" style={{ color: SEVERITY_COLOR[insight.severity] }} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-ink-primary">{insight.goalName}</p>
                <p className="text-xs text-ink-secondary leading-relaxed mt-0.5">
                  {insight.message}{' '}
                  <Link href={`/goals/${insight.goalId}`} className="text-ink-primary font-medium hover:underline">
                    View Goal →
                  </Link>
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
