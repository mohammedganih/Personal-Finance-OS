'use client';

import { Sparkles, AlertTriangle, Info, CheckCircle2, LucideIcon } from 'lucide-react';
import { useBillsInsights } from '@/hooks/useBills';
import { RecommendationSeverity } from '@/types';

const SEVERITY_ICON: Record<RecommendationSeverity, LucideIcon> = {
  critical: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
  positive: CheckCircle2,
};

const SEVERITY_COLOR: Record<RecommendationSeverity, string> = {
  critical: '#D03B3B',
  warning: '#B45309',
  info: '#0B0B0B',
  positive: '#0CA30C',
};

/**
 * useBillsInsights() is real and already computes several genuinely
 * different signals (overdue totals, due-this-week totals, income share,
 * monthly/annual spend, top category, heaviest upcoming month, chunky
 * quarterly/annual bills next month, duplicate-name detection, an
 * outsized single commitment, and a real annual-vs-monthly nudge) --
 * rendered as-is rather than the reference's three fabricated examples
 * (no mobile-plan comparison, usage-tracking, or late-fee data exists
 * anywhere in this app). Renders nothing if genuinely nothing to say.
 */
export function BillInsightsLight() {
  const { data: insights, isLoading } = useBillsInsights();

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
            <div key={i} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-paper-subtle flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5" style={{ color: SEVERITY_COLOR[insight.severity] }} />
              </div>
              <p className="text-xs text-ink-secondary leading-relaxed pt-1">{insight.message}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
