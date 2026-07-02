'use client';

import { Percent } from 'lucide-react';
import { useAnnualizedReturns } from '@/hooks/useInvestmentIntelligence';
import { cn } from '@/lib/utils';

function formatXirr(xirr: number | null): string {
  if (xirr === null) return 'N/A';
  return `${xirr >= 0 ? '+' : ''}${(xirr * 100).toFixed(1)}%`;
}

function xirrColor(xirr: number | null): string {
  if (xirr === null) return 'text-text-muted';
  return xirr >= 0 ? 'text-success' : 'text-danger';
}

export function AnnualizedReturns() {
  const { data, isLoading } = useAnnualizedReturns();

  if (isLoading) return <div className="glass-card rounded-2xl h-56 shimmer" />;
  if (!data?.byHolding?.length) return null;

  const sorted = [...data.byHolding].sort((a, b) => (b.xirr ?? -Infinity) - (a.xirr ?? -Infinity));

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Percent className="w-4 h-4 text-text-muted" />
          <h3 className="text-sm font-semibold text-text-primary">Annualized Return</h3>
        </div>
        <div className={cn('text-2xl font-bold', xirrColor(data.overall))}>{formatXirr(data.overall)}</div>
      </div>
      <p className="text-xs text-text-secondary -mt-2">
        Time-weighted (XIRR) return across your whole portfolio — accounts for when each rupee actually went in, unlike a flat P&amp;L%.
      </p>

      <div className="space-y-1.5">
        {sorted.map((h) => (
          <div key={h.investmentId} className="flex items-center justify-between p-2 rounded-lg bg-bg-elevated">
            <p className="text-xs font-medium text-text-primary truncate">{h.assetName}</p>
            <p className={cn('text-xs font-semibold font-mono', xirrColor(h.xirr))}>{formatXirr(h.xirr)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
