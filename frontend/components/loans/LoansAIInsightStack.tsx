'use client';

import Link from 'next/link';
import { Sparkles, Mountain, Wallet, Home } from 'lucide-react';
import { useDebtStrategy, useFundingOpportunities } from '@/hooks/useDebtIntelligence';
import { useAssetLoanInsights } from '@/hooks/useLoans';
import { formatCurrency, formatDate } from '@/lib/format';

interface LoansAIInsightStackProps {
  extraPayment: number;
}

/**
 * Every sentence here is a real, already-shipped computation, promoted out
 * of its own card: PayoffStrategyComparison's avalanche/snowball delta,
 * FundingSources' top maturity cross-link (the same tip Investments' own
 * AIInsightStack surfaces from the other direction), and
 * AssetLoanEquityCard's equity insight. Nothing new is computed here.
 */
export function LoansAIInsightStack({ extraPayment }: LoansAIInsightStackProps) {
  const { data: strategy } = useDebtStrategy(extraPayment);
  const { data: funding } = useFundingOpportunities(6);
  const { data: equityInsights } = useAssetLoanInsights();

  const topFunding = funding?.[0];
  const topEquity = equityInsights?.[0];

  let strategyInsight: string | null = null;
  if (strategy && strategy.debts.length > 0 && strategy.totalInterestSaved > 0) {
    const better = strategy.bestStrategy;
    const betterLabel = better === 'avalanche' ? 'Avalanche' : 'Snowball';
    const worseLabel = better === 'avalanche' ? 'Snowball' : 'Avalanche';
    const delta = Math.abs(strategy.interestSavedAvalanche - strategy.interestSavedSnowball);
    const order = better === 'avalanche' ? strategy.avalancheOrder : strategy.snowballOrder;
    const first = strategy.debts.find((d) => d.id === order[0]);
    strategyInsight = `${betterLabel} saves ${formatCurrency(delta, 'INR', true)} more than ${worseLabel}${
      first ? ` — start with your ${first.name} (${first.interestRate}% p.a.)` : ''
    }.`;
  }

  if (!strategyInsight && !topFunding && !topEquity) return null;

  return (
    <div className="glass-card rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-text-muted" />
        <h3 className="text-sm font-semibold text-text-primary">AI Advisor</h3>
      </div>

      <div className="space-y-2">
        {strategyInsight && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-accent-violet/15 text-accent-violet-light flex items-center justify-center shrink-0">
              <Mountain className="w-3.5 h-3.5" />
            </div>
            <p className="text-xs text-text-secondary leading-relaxed pt-1">{strategyInsight}</p>
          </div>
        )}

        {topFunding && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-success/15 text-success flex items-center justify-center shrink-0">
              <Wallet className="w-3.5 h-3.5" />
            </div>
            <p className="text-xs text-text-secondary leading-relaxed pt-1">
              Your {topFunding.assetName}{' '}
              {topFunding.sourceType === 'MATURITY' && topFunding.availableDate ? `matures ${formatDate(topFunding.availableDate)}` : 'is available now'} —
              redirect it toward {topFunding.targetDebtName} to save {formatCurrency(topFunding.interestSaved, 'INR', true)} in interest.{' '}
              <Link href="/investments" className="text-accent-violet-light hover:underline">Same tip, from Investments →</Link>
            </p>
          </div>
        )}

        {topEquity && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-info/15 text-info flex items-center justify-center shrink-0">
              <Home className="w-3.5 h-3.5" />
            </div>
            <p className="text-xs text-text-secondary leading-relaxed pt-1">{topEquity.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
