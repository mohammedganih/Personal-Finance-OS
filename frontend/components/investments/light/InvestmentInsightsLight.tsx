'use client';

import Link from 'next/link';
import { Sparkles, AlertTriangle, Radar } from 'lucide-react';
import { useDiversification, useMaturityRadar } from '@/hooks/useInvestmentIntelligence';
import { formatCurrency, formatDate, getDaysUntil } from '@/lib/format';

interface InvestmentInsightsLightProps {
  onReviewAllocation: () => void;
}

/**
 * Restyle of the dark AIInsightStack's logic, unchanged: every line is a real
 * diversification warning or the nearest real upcoming maturity, never
 * invented filler. Renders nothing when there's nothing real to say.
 */
export function InvestmentInsightsLight({ onReviewAllocation }: InvestmentInsightsLightProps) {
  const { data: diversification } = useDiversification();
  const { data: maturities } = useMaturityRadar(6);

  const warnings = diversification?.warnings ?? [];
  const nextMaturity = maturities?.[0];

  if (warnings.length === 0 && !nextMaturity) return null;

  return (
    <div className="card-light rounded-2xl p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-mono" />
        <h3 className="text-sm font-semibold text-ink-primary">Investment Insights</h3>
      </div>

      <div className="space-y-3 flex-1">
        {warnings.map((w, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-paper-subtle flex items-center justify-center shrink-0">
              <AlertTriangle className="w-3.5 h-3.5 text-ink-primary" />
            </div>
            <p className="text-xs text-ink-secondary leading-relaxed pt-1">
              {w.message}{' '}
              <button type="button" onClick={onReviewAllocation} className="text-ink-primary font-medium hover:underline">
                Review allocation →
              </button>
            </p>
          </div>
        ))}

        {nextMaturity && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-paper-subtle flex items-center justify-center shrink-0">
              <Radar className="w-3.5 h-3.5 text-ink-primary" />
            </div>
            <p className="text-xs text-ink-secondary leading-relaxed pt-1">
              Your {nextMaturity.assetName} matures {formatDate(nextMaturity.maturityDate)}
              {' '}({getDaysUntil(nextMaturity.maturityDate)} days)
              {nextMaturity.maturityAmount !== null && <> for {formatCurrency(nextMaturity.maturityAmount, 'INR', true)}</>}.{' '}
              <Link href="/loans" className="text-ink-primary font-medium hover:underline">
                See if this could pay off a debt sooner →
              </Link>
            </p>
          </div>
        )}
      </div>

      <button
        onClick={onReviewAllocation}
        className="w-full text-center rounded-xl bg-paper-subtle hover:bg-line px-3.5 py-2.5 text-xs font-medium text-ink-primary transition-colors mt-4"
      >
        View Detailed Insights
      </button>
    </div>
  );
}
