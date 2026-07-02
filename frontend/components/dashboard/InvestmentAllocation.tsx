'use client';

import { RadialBarChart, RadialBar, Legend, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency } from '@/lib/format';
import { usePortfolioSummary } from '@/hooks/useInvestments';
import { ChartSkeleton } from '@/components/shared/LoadingSkeleton';
import { ASSET_TYPE_LABELS, CHART_COLORS } from '@/lib/constants';

export function InvestmentAllocation() {
  const { data, isLoading } = usePortfolioSummary();

  if (isLoading) return <ChartSkeleton height="h-72" />;

  const allocation = data?.allocationByType ?? {};
  const entries = Object.entries(allocation).map(([type, value], i) => ({
    name: ASSET_TYPE_LABELS[type] ?? type,
    value,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-text-primary">Investment Allocation</h3>
        <p className="text-xs text-text-secondary mt-0.5">Portfolio by asset type</p>
      </div>

      {entries.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-text-muted text-sm">
          No investments tracked
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-text-secondary">Total Value</p>
              <p className="text-lg font-bold text-text-primary">
                {formatCurrency(data?.totalCurrent ?? 0, 'INR', true)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-text-secondary">Total P&L</p>
              <p className={`text-sm font-semibold ${(data?.totalPnl ?? 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                {(data?.totalPnl ?? 0) >= 0 ? '+' : ''}{formatCurrency(data?.totalPnl ?? 0, 'INR', true)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {entries.map((e, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: e.fill }} />
                <p className="text-xs text-text-secondary flex-1 truncate">{e.name}</p>
                <p className="text-xs font-medium text-text-primary font-mono">
                  {formatCurrency(e.value, 'INR', true)}
                </p>
                <p className="text-xs text-text-muted w-10 text-right">
                  {data?.totalCurrent ? ((e.value / data.totalCurrent) * 100).toFixed(1) : 0}%
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
