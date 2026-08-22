'use client';

import { Sparkles } from 'lucide-react';
import { useQuickInsights } from '@/hooks/useDashboard';
import { QuickInsight } from '@/types';

const TYPE_COLOR: Record<QuickInsight['type'], string> = {
  positive: '#0CA30C',
  decrease: '#0CA30C',
  increase: '#B45309',
  neutral: '#0B0B0B',
};

/** useQuickInsights() already returns its own emoji per insight
 * (dashboard.service.ts::getQuickInsights) -- rendered directly rather
 * than remapped to a Lucide icon, unlike the severity-based insight cards
 * elsewhere that only carry a category, not their own icon. */
export function TransactionInsightsLight() {
  const { data: insights, isLoading } = useQuickInsights();

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
        {list.map((insight, i) => (
          <div key={i} className="flex items-start gap-3">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm"
              style={{ background: `${TYPE_COLOR[insight.type]}1F` }}
            >
              {insight.icon}
            </div>
            <p className="text-xs text-ink-secondary leading-relaxed">{insight.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
