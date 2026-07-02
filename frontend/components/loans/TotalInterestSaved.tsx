'use client';

import { PiggyBank } from 'lucide-react';
import { useDebtStrategy } from '@/hooks/useDebtIntelligence';
import { formatCurrency } from '@/lib/format';

export function TotalInterestSaved() {
  const { data, isLoading } = useDebtStrategy(5000);

  if (isLoading) return <div className="glass-card rounded-2xl h-24 shimmer" />;
  if (!data?.debts?.length || data.totalInterestSaved <= 0) return null;

  const bestLabel = data.bestStrategy === 'avalanche' ? 'Avalanche' : 'Snowball';
  const months = data.bestStrategy === 'avalanche' ? data.avalancheMonthsWithExtra : data.snowballMonthsWithExtra;

  return (
    <div className="glass-card rounded-2xl p-5 flex items-center gap-4 bg-gradient-to-r from-success/10 to-transparent border border-success/20">
      <div className="w-11 h-11 rounded-xl bg-success/15 flex items-center justify-center shrink-0">
        <PiggyBank className="w-5 h-5 text-success" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-text-secondary">Total Interest Saved</p>
        <p className="text-2xl font-bold text-success">{formatCurrency(data.totalInterestSaved, 'INR', true)}</p>
        <p className="text-xs text-text-muted mt-0.5">
          By following the {bestLabel} strategy with {formatCurrency(data.extraPayment, 'INR', true)}/mo extra — debt-free in ~{months} months
        </p>
      </div>
    </div>
  );
}
