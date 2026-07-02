'use client';

import { Wallet } from 'lucide-react';
import { useFundingOpportunities } from '@/hooks/useDebtIntelligence';
import { formatCurrency, formatDate } from '@/lib/format';
import { ASSET_TYPE_ICONS } from '@/lib/constants';

export function FundingSources() {
  const { data, isLoading } = useFundingOpportunities(6);

  if (isLoading) return <div className="glass-card rounded-2xl h-48 shimmer" />;
  if (!data?.length) return null;

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Wallet className="w-4 h-4 text-text-muted" />
        <h3 className="text-sm font-semibold text-text-primary">Funding Sources</h3>
      </div>
      <p className="text-xs text-text-secondary -mt-2">
        Maturing deposits and sellable holdings, each shown against what they&apos;d save if put toward{' '}
        <span className="text-text-primary font-medium">{data[0].targetDebtName}</span> (your highest-interest debt).
      </p>

      <div className="space-y-2">
        {data.map((op) => (
          <div key={op.investmentId} className="flex items-center gap-3 p-3 rounded-xl bg-bg-elevated">
            <span className="text-lg w-6 text-center shrink-0">{ASSET_TYPE_ICONS[op.assetType] ?? '💼'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-text-primary truncate">{op.assetName}</p>
              <p className="text-xs text-text-muted">
                {op.sourceType === 'MATURITY' && op.availableDate
                  ? `Matures ${formatDate(op.availableDate)} · ${formatCurrency(op.availableAmount, 'INR', true)}`
                  : `Available now · ${formatCurrency(op.availableAmount, 'INR', true)}`}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-semibold font-mono text-success">
                Save {formatCurrency(op.interestSaved, 'INR', true)}
              </p>
              <p className="text-xs text-text-muted">{op.monthsSaved} months sooner</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-text-muted">
        Want a different target debt or a partial amount? Use the Prepayment Calculator below.
      </p>
    </div>
  );
}
