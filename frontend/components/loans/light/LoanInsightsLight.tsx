'use client';

import { useState } from 'react';
import { Sparkles, AlertTriangle, CheckCircle2, Lightbulb, LucideIcon } from 'lucide-react';
import { useDebtRecommendations } from '@/hooks/useDebtIntelligence';
import { RecommendationSeverity } from '@/types';
import { PrepaymentPlanDialog } from './PrepaymentPlanDialog';

const SEVERITY_ICON: Record<RecommendationSeverity, LucideIcon> = {
  critical: AlertTriangle,
  warning: AlertTriangle,
  info: Lightbulb,
  positive: CheckCircle2,
};

const SEVERITY_COLOR: Record<RecommendationSeverity, string> = {
  critical: '#D03B3B',
  warning: '#B45309',
  info: '#0B0B0B',
  positive: '#0CA30C',
};

/**
 * useDebtRecommendations() is already real, ranked, structured content --
 * this is exactly what RecommendationCards.tsx/LoansAIInsightStack.tsx
 * rendered before, just moved into the new card shell. Renders whatever
 * real recommendations exist rather than capping to a single line. The
 * "info" severity is, by construction (generateRecommendations,
 * debtIntelligence.service.ts), only ever the payoff-strategy
 * recommendation -- its "View Plan" opens the same PrepaymentPlanDialog
 * as the Loan Overview panel.
 */
export function LoanInsightsLight() {
  const { data: recommendations, isLoading } = useDebtRecommendations();
  const [showPlan, setShowPlan] = useState(false);

  if (isLoading) return <div className="card-light rounded-2xl h-64 shimmer" />;

  const recs = recommendations ?? [];
  if (recs.length === 0) return null;

  return (
    <div className="card-light rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-mono" />
        <h3 className="text-sm font-semibold text-ink-primary">AI Insights</h3>
      </div>

      <div className="space-y-3">
        {recs.map((r) => {
          const Icon = SEVERITY_ICON[r.severity];
          return (
            <div key={r.priority} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-paper-subtle flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5" style={{ color: SEVERITY_COLOR[r.severity] }} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-ink-primary">{r.title}</p>
                <p className="text-xs text-ink-secondary leading-relaxed mt-0.5">
                  {r.description}{' '}
                  {r.severity === 'info' && (
                    <button type="button" onClick={() => setShowPlan(true)} className="text-ink-primary font-medium hover:underline">
                      View Plan →
                    </button>
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {showPlan && <PrepaymentPlanDialog onClose={() => setShowPlan(false)} />}
    </div>
  );
}
