'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Home } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/format';
import { ASSET_TYPE_ICONS } from '@/lib/constants';
import { useAssetLoanSummary, useAmortizationSchedule } from '@/hooks/useLoans';
import { cn } from '@/lib/utils';

interface AssetLoanEquityCardProps {
  loanId: string;
  loanName: string;
}

/**
 * Everything the spec asks for about ONE loan-asset pair: equity, LTV,
 * principal/interest paid, appreciation, ROI -- plus an expandable full
 * amortization schedule. All numbers come from the backend's on-demand
 * computation (assetLoanIntelligence.service.ts), never persisted here.
 */
export function AssetLoanEquityCard({ loanId, loanName }: AssetLoanEquityCardProps) {
  const { data: summary, isLoading } = useAssetLoanSummary(loanId);
  const [showSchedule, setShowSchedule] = useState(false);
  const { data: schedule } = useAmortizationSchedule(showSchedule ? loanId : undefined);

  if (isLoading) return <div className="glass-card rounded-2xl h-40 shimmer" />;
  if (!summary) return null;

  const stats = [
    { label: 'Home Equity', value: summary.equity, color: 'text-success' },
    { label: 'Outstanding Loan', value: summary.remainingBalance, color: 'text-danger' },
    { label: 'Principal Paid', value: summary.principalPaid, color: 'text-success' },
    { label: 'Interest Paid', value: summary.interestPaid, color: 'text-warning' },
  ];

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{ASSET_TYPE_ICONS[summary.assetType] ?? '🏠'}</span>
          <div>
            <p className="text-sm font-semibold text-text-primary">{summary.assetName}</p>
            <p className="text-xs text-text-muted">Backing &quot;{loanName}&quot;</p>
          </div>
        </div>
        <Badge variant={summary.loanToValue < 60 ? 'success' : summary.loanToValue < 85 ? 'warning' : 'danger'}>
          LTV {summary.loanToValue.toFixed(0)}%
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-bg-elevated rounded-xl p-3">
            <p className="text-xs text-text-muted">{s.label}</p>
            <p className={cn('text-sm font-bold font-mono mt-0.5', s.color)}>{formatCurrency(s.value, 'INR', true)}</p>
          </div>
        ))}
      </div>

      {/* Property value / appreciation / ROI */}
      <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border text-xs">
        <div>
          <p className="text-text-muted">Market Value</p>
          <p className="font-mono text-text-secondary mt-0.5">{formatCurrency(summary.currentPropertyValue, 'INR', true)}</p>
        </div>
        <div>
          <p className="text-text-muted">Appreciation</p>
          <p className={cn('font-mono mt-0.5', summary.appreciationSincePurchasePct >= 0 ? 'text-success' : 'text-danger')}>
            {summary.appreciationSincePurchasePct >= 0 ? '+' : ''}{summary.appreciationSincePurchasePct.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-text-muted">ROI (leveraged)</p>
          <p className={cn('font-mono mt-0.5', summary.roi >= 0 ? 'text-success' : 'text-danger')}>
            {summary.roi >= 0 ? '+' : ''}{summary.roi.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Loan-to-value bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-text-secondary">Equity built</span>
          <span className="text-text-primary font-semibold">{(100 - summary.loanToValue).toFixed(1)}%</span>
        </div>
        <Progress value={100 - summary.loanToValue} className="h-2" indicatorClassName="bg-gradient-success" />
      </div>

      {/* Amortization toggle */}
      <button
        onClick={() => setShowSchedule((s) => !s)}
        className="w-full flex items-center justify-center gap-1.5 text-xs text-accent-violet-light hover:underline py-1"
      >
        {showSchedule ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {showSchedule ? 'Hide' : 'View'} full amortization schedule
      </button>

      {showSchedule && (
        <div className="max-h-64 overflow-y-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-bg-elevated">
              <tr className="text-text-muted">
                <th className="text-left px-2 py-1.5 font-medium">Month</th>
                <th className="text-right px-2 py-1.5 font-medium">Interest</th>
                <th className="text-right px-2 py-1.5 font-medium">Principal</th>
                <th className="text-right px-2 py-1.5 font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {schedule?.map((row) => (
                <tr key={row.month} className="border-t border-border/50">
                  <td className="px-2 py-1 text-text-secondary">{formatDate(row.date, 'MMM yyyy')}</td>
                  <td className="px-2 py-1 text-right font-mono text-warning">{formatCurrency(row.interest, 'INR', true)}</td>
                  <td className="px-2 py-1 text-right font-mono text-success">{formatCurrency(row.principal, 'INR', true)}</td>
                  <td className="px-2 py-1 text-right font-mono text-text-secondary">{formatCurrency(row.closingBalance, 'INR', true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Cross-loan summary card for the top of the Loans page -- linked to Home Equity data. */
export function HomeEquityBanner({ totalEquity, weightedLTV, count }: { totalEquity: number; weightedLTV: number; count: number }) {
  if (count === 0) return null;
  return (
    <div className="glass-card rounded-2xl p-4 flex items-center gap-3 bg-success/5 border border-success/15">
      <div className="w-9 h-9 rounded-xl bg-success/15 flex items-center justify-center shrink-0">
        <Home className="w-4 h-4 text-success" />
      </div>
      <div className="flex-1">
        <p className="text-xs text-text-secondary">
          {count} asset{count > 1 ? 's' : ''} linked to a loan · weighted LTV {weightedLTV.toFixed(0)}%
        </p>
        <p className="text-sm font-bold text-success">{formatCurrency(totalEquity, 'INR', true)} total equity built</p>
      </div>
    </div>
  );
}
