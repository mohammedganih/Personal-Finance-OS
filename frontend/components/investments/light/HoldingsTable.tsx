'use client';

import { useState } from 'react';
import { PieChart, TrendingUp, Coins, Landmark, Wallet, ChevronDown, LucideIcon } from 'lucide-react';
import { usePortfolioSummary } from '@/hooks/useInvestments';
import { HOLDING_BUCKETS, BUCKET_COLORS, bucketForAssetType, HoldingBucket } from '@/lib/investmentBuckets';
import { ASSET_TYPE_LABELS } from '@/lib/constants';
import { formatCurrency, formatPercent } from '@/lib/format';
import { InvestmentWithPnl } from '@/types';
import { cn } from '@/lib/utils';

const BUCKET_ICONS: Record<HoldingBucket, LucideIcon> = {
  'Mutual Funds': PieChart,
  Stocks: TrendingUp,
  Gold: Coins,
  'Debt Funds': Landmark,
  'Cash & Others': Wallet,
};

const VISIBLE_ROWS = 8;

interface HoldingsTableProps {
  activeBucket: HoldingBucket | 'All';
  onSelectBucket: (bucket: HoldingBucket | 'All') => void;
  onSelectInvestment: (inv: InvestmentWithPnl) => void;
}

export function HoldingsTable({ activeBucket, onSelectBucket, onSelectInvestment }: HoldingsTableProps) {
  const { data: summary, isLoading } = usePortfolioSummary();
  const [expanded, setExpanded] = useState(false);

  if (isLoading) return <div id="investment-holdings" className="card-light rounded-2xl h-96 shimmer" />;

  const portfolio = summary?.portfolio ?? [];
  const total = summary?.totalCurrent ?? 0;

  const filtered = activeBucket === 'All'
    ? portfolio
    : portfolio.filter((inv) => bucketForAssetType(inv.assetType) === activeBucket);

  const sorted = [...filtered].sort((a, b) => b.currentValue - a.currentValue);
  const visible = expanded ? sorted : sorted.slice(0, VISIBLE_ROWS);

  return (
    <div id="investment-holdings" className="card-light rounded-2xl p-5">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h3 className="text-sm font-semibold text-ink-primary">Holdings</h3>
        <div className="flex items-center gap-0.5 bg-paper-subtle rounded-full p-0.5 flex-wrap">
          <button
            onClick={() => onSelectBucket('All')}
            className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-colors', activeBucket === 'All' ? 'bg-mono text-white' : 'text-ink-secondary hover:text-ink-primary')}
          >
            All Holdings
          </button>
          {HOLDING_BUCKETS.map((bucket) => (
            <button
              key={bucket}
              onClick={() => onSelectBucket(bucket)}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-colors', activeBucket === bucket ? 'bg-mono text-white' : 'text-ink-secondary hover:text-ink-primary')}
            >
              {bucket}
            </button>
          ))}
        </div>
      </div>

      {portfolio.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-sm text-ink-muted">No investments tracked yet</div>
      ) : sorted.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-sm text-ink-muted">No holdings in this category</div>
      ) : (
        <>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="text-left">
                  <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2">Investment</th>
                  <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2">Type</th>
                  <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2 text-right">Invested</th>
                  <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2 text-right">Current Value</th>
                  <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2 text-right">Returns</th>
                  <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2 text-right">Returns (%)</th>
                  <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2 text-right">% of Portfolio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visible.map((inv) => {
                  const bucket = bucketForAssetType(inv.assetType);
                  const Icon = BUCKET_ICONS[bucket];
                  const subtext = inv.monthlyAmount ? `${formatCurrency(inv.monthlyAmount, 'INR', true)}/mo` : 'Lump Sum';
                  const pctOfPortfolio = total > 0 ? (inv.currentValue / total) * 100 : 0;

                  return (
                    <tr
                      key={inv.id}
                      onClick={() => onSelectInvestment(inv)}
                      className="cursor-pointer hover:bg-paper-subtle transition-colors"
                    >
                      <td className="px-1 py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-lg bg-paper-subtle flex items-center justify-center shrink-0" style={{ color: BUCKET_COLORS[bucket] }}>
                            <Icon className="w-4 h-4" />
                          </span>
                          <span className="min-w-0">
                            <p className="text-sm font-medium text-ink-primary truncate max-w-[220px]">{inv.assetName}</p>
                            <p className="text-xs text-ink-muted truncate">{subtext}</p>
                          </span>
                        </div>
                      </td>
                      <td className="px-1 py-3">
                        <span className="inline-flex items-center rounded-full bg-paper-subtle px-2.5 py-1 text-[11px] font-medium text-ink-secondary whitespace-nowrap">
                          {ASSET_TYPE_LABELS[inv.assetType] ?? inv.assetType}
                        </span>
                      </td>
                      <td className="px-1 py-3 text-right text-sm text-ink-primary tabular-nums whitespace-nowrap">{formatCurrency(inv.investedValue, 'INR', true)}</td>
                      <td className="px-1 py-3 text-right text-sm font-semibold text-ink-primary tabular-nums whitespace-nowrap">{formatCurrency(inv.currentValue, 'INR', true)}</td>
                      <td className={cn('px-1 py-3 text-right text-sm tabular-nums whitespace-nowrap', inv.pnl >= 0 ? 'text-updown-up' : 'text-updown-down')}>
                        {inv.pnl >= 0 ? '+' : ''}{formatCurrency(inv.pnl, 'INR', true)}
                      </td>
                      <td className={cn('px-1 py-3 text-right text-sm tabular-nums whitespace-nowrap', inv.pnlPercent >= 0 ? 'text-updown-up' : 'text-updown-down')}>
                        {formatPercent(inv.pnlPercent)}
                      </td>
                      <td className="px-1 py-3 text-right text-sm text-ink-muted tabular-nums whitespace-nowrap">{pctOfPortfolio.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {sorted.length > VISIBLE_ROWS && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-ink-secondary hover:text-ink-primary mt-3 pt-3 border-t border-line transition-colors"
            >
              {expanded ? 'Show Less' : 'View All Holdings'}
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', expanded && 'rotate-180')} />
            </button>
          )}
        </>
      )}
    </div>
  );
}
