'use client';

import { PieChart, AlertTriangle } from 'lucide-react';
import { useDiversification } from '@/hooks/useInvestmentIntelligence';
import { formatCurrency } from '@/lib/format';
import { CHART_COLORS } from '@/lib/constants';

export function DiversificationCard() {
  const { data, isLoading } = useDiversification();

  if (isLoading) return <div className="glass-card rounded-2xl h-56 shimmer" />;
  if (!data?.classBreakdown?.length) return null;

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <PieChart className="w-4 h-4 text-text-muted" />
        <h3 className="text-sm font-semibold text-text-primary">Diversification</h3>
      </div>

      <div className="space-y-2">
        {data.classBreakdown.map((c, i) => (
          <div key={c.assetClass}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                <span className="text-xs text-text-secondary">{c.assetClass}</span>
              </div>
              <span className="text-xs text-text-muted font-mono">
                {formatCurrency(c.value, 'INR', true)} · {c.percentage.toFixed(0)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-bg-elevated overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${c.percentage}%`, background: CHART_COLORS[i % CHART_COLORS.length] }}
              />
            </div>
          </div>
        ))}
      </div>

      {data.warnings.length > 0 && (
        <div className="space-y-2 pt-1">
          {data.warnings.map((w, i) => (
            <div key={i} className="rounded-xl p-3 flex items-start gap-2 bg-warning/8 border border-warning/20">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-warning" />
              <p className="text-xs text-text-secondary">{w.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
