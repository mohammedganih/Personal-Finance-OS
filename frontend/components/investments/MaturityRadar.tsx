'use client';

import Link from 'next/link';
import { Radar, ArrowRight } from 'lucide-react';
import { useMaturityRadar } from '@/hooks/useInvestmentIntelligence';
import { formatCurrency, formatDate, getDaysUntil } from '@/lib/format';
import { ASSET_TYPE_ICONS } from '@/lib/constants';

export function MaturityRadar() {
  const { data, isLoading } = useMaturityRadar(6);

  if (isLoading) return <div className="glass-card rounded-2xl h-40 shimmer" />;
  if (!data?.length) return null;

  return (
    <div className="glass-card rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Radar className="w-4 h-4 text-text-muted" />
        <h3 className="text-sm font-semibold text-text-primary">Maturity Radar</h3>
        <span className="text-xs text-text-muted">next 6 months</span>
      </div>

      <div className="space-y-1.5">
        {data.map((m) => {
          const daysLeft = getDaysUntil(m.maturityDate);
          return (
            <div key={m.investmentId} className="flex items-center gap-3 p-2.5 rounded-lg bg-bg-elevated">
              <span className="text-base w-5 text-center shrink-0">{ASSET_TYPE_ICONS[m.assetType] ?? '💼'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-text-primary truncate">{m.assetName}</p>
                <p className="text-xs text-text-muted">Matures {formatDate(m.maturityDate)} · {daysLeft} days</p>
              </div>
              {m.maturityAmount !== null && (
                <p className="text-xs font-mono font-semibold text-success">{formatCurrency(m.maturityAmount, 'INR', true)}</p>
              )}
            </div>
          );
        })}
      </div>

      <Link
        href="/loans?tab=insights"
        className="flex items-center justify-between text-xs text-text-secondary hover:text-accent-violet-light transition-colors pt-1 group"
      >
        <span>💡 See if one of these could pay off a debt sooner</span>
        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </div>
  );
}
