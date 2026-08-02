'use client';

import { Sparkles } from 'lucide-react';
import { useQuickInsights } from '@/hooks/useDashboard';
import { cn } from '@/lib/utils';

// Same rule-based engine QuickInsights.tsx already uses on the dark
// Dashboard -- "AI Insights" matches this app's existing naming convention
// for rule-based insight stacks elsewhere (Investments, Loans, Budgets),
// not a claim that an LLM generated these.
const TYPE_STYLE = {
  positive: 'bg-updown-up-muted text-updown-up',
  decrease: 'bg-updown-up-muted text-updown-up',
  increase: 'bg-updown-down-muted text-updown-down',
  neutral: 'bg-[#EEF2FF] text-[#4338CA]',
};

// 'neutral' insights aren't all the same kind of neutral -- rotating a
// couple of muted pastels keeps the list from reading as one flat gray
// block, closer to the reference's varied icon chips.
const NEUTRAL_ROTATION = ['bg-[#EEF2FF] text-[#4338CA]', 'bg-[#F0F9FF] text-[#0369A1]'];

export function AiInsightsLight() {
  const { data: insights, isLoading } = useQuickInsights();

  if (isLoading) return <div className="card-light rounded-2xl h-64 shimmer" />;
  if (!insights?.length) return null;

  return (
    <div className="card-light rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-mono" />
        <h3 className="text-sm font-semibold text-ink-primary">AI Insights</h3>
      </div>
      <div className="space-y-2">
        {insights.map((insight, i) => {
          const style = insight.type === 'neutral' ? NEUTRAL_ROTATION[i % NEUTRAL_ROTATION.length] : TYPE_STYLE[insight.type];
          return (
            <div key={i} className="flex items-start gap-3">
              <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0', style)}>
                {insight.icon}
              </span>
              <p className="text-xs text-ink-secondary leading-relaxed pt-1">{insight.message}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
