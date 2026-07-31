'use client';

import Link from 'next/link';
import { Sparkles, AlertTriangle, Radar } from 'lucide-react';
import { useDiversification, useMaturityRadar } from '@/hooks/useInvestmentIntelligence';
import { formatCurrency, formatDate, getDaysUntil } from '@/lib/format';

interface AIInsightStackProps {
  onReviewAllocation?: () => void;
}

/**
 * Nothing computed here is new -- every sentence is DiversificationCard's
 * warnings or MaturityRadar's nearest upcoming maturity, promoted out of
 * their own cards and read as advice instead of a data table. Deliberately
 * doesn't invent a SIP-consistency insight or a rupee prepayment saving --
 * neither is backed by real data today (Transactions has no link back to
 * the Investment it paid), so this stays silent rather than guess.
 */
export function AIInsightStack({ onReviewAllocation }: AIInsightStackProps) {
  const { data: diversification } = useDiversification();
  const { data: maturities } = useMaturityRadar(6);

  const warnings = diversification?.warnings ?? [];
  const nextMaturity = maturities?.[0];

  if (warnings.length === 0 && !nextMaturity) return null;

  return (
    <div className="glass-card rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-text-muted" />
        <h3 className="text-sm font-semibold text-text-primary">AI Advisor</h3>
      </div>

      <div className="space-y-2">
        {warnings.map((w, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-warning/15 text-warning flex items-center justify-center shrink-0">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <p className="text-xs text-text-secondary leading-relaxed pt-1">
              {w.message}{' '}
              <button type="button" onClick={onReviewAllocation} className="text-accent-violet-light hover:underline">
                Review allocation →
              </button>
            </p>
          </div>
        ))}

        {nextMaturity && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-info/15 text-info flex items-center justify-center shrink-0">
              <Radar className="w-3.5 h-3.5" />
            </div>
            <p className="text-xs text-text-secondary leading-relaxed pt-1">
              Your {nextMaturity.assetName} matures {formatDate(nextMaturity.maturityDate)}
              {' '}({getDaysUntil(nextMaturity.maturityDate)} days)
              {nextMaturity.maturityAmount !== null && <> for {formatCurrency(nextMaturity.maturityAmount, 'INR', true)}</>}.{' '}
              <Link href="/loans" className="text-accent-violet-light hover:underline">
                See if this could pay off a debt sooner →
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
