'use client';

import { useQuickInsights } from '@/hooks/useDashboard';
import { cn } from '@/lib/utils';

const typeColors = {
  positive: 'border-l-success bg-success/5 text-success',
  decrease: 'border-l-success bg-success/5 text-success',
  increase: 'border-l-danger bg-danger/5 text-danger',
  neutral: 'border-l-accent-violet bg-accent-violet/5 text-accent-violet-light',
};

export function QuickInsights() {
  const { data: insights, isLoading } = useQuickInsights();

  if (isLoading || !insights?.length) return null;

  return (
    <div className="glass-card rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-text-primary mb-4">Quick Insights</h3>
      <div className="space-y-2">
        {insights.map((insight, i) => (
          <div
            key={i}
            className={cn(
              'flex items-start gap-3 p-3 rounded-xl border-l-2 text-sm',
              typeColors[insight.type]
            )}
          >
            <span className="text-base leading-none shrink-0">{insight.icon}</span>
            <p className="text-xs leading-relaxed">{insight.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
