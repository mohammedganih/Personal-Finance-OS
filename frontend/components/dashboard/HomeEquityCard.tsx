'use client';

import Link from 'next/link';
import { Home } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { useHomeEquitySummary } from '@/hooks/useLoans';

/**
 * Dashboard-level rollup of every loan-linked asset: total equity, weighted
 * LTV, and this month's principal-vs-interest split. Renders nothing when
 * the user hasn't linked any loan to an asset -- no empty-state clutter for
 * the common case where this feature isn't in use yet.
 */
export function HomeEquityCard() {
  const { data } = useHomeEquitySummary();
  if (!data || data.assets.length === 0) return null;

  const principalThisMonth = data.assets.reduce((s, a) => s + a.principalPaidThisMonth, 0);
  const interestThisMonth = data.assets.reduce((s, a) => s + a.interestPaidThisMonth, 0);

  return (
    <Link href="/loans" className="glass-card-hover rounded-2xl p-5 space-y-3 block">
      <div className="flex items-center gap-2">
        <Home className="w-4 h-4 text-text-muted" />
        <h3 className="text-sm font-semibold text-text-primary">Home Equity</h3>
      </div>

      <div>
        <p className="text-2xl font-bold text-success">{formatCurrency(data.totalEquity, 'INR', true)}</p>
        <p className="text-xs text-text-muted mt-0.5">
          across {data.assets.length} linked asset{data.assets.length > 1 ? 's' : ''} · {formatCurrency(data.totalPropertyValue, 'INR', true)} value
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border">
        <div>
          <p className="text-text-muted">Weighted LTV</p>
          <p className="font-mono font-semibold text-text-primary mt-0.5">{data.weightedLTV.toFixed(0)}%</p>
        </div>
        <div>
          <p className="text-text-muted">This Month</p>
          <p className="font-mono text-xs mt-0.5">
            <span className="text-success">{formatCurrency(principalThisMonth, 'INR', true)}</span>
            {' / '}
            <span className="text-warning">{formatCurrency(interestThisMonth, 'INR', true)}</span>
          </p>
        </div>
      </div>
    </Link>
  );
}
