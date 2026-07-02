'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { usePortfolioTrend } from '@/hooks/useInvestmentIntelligence';
import { ChartSkeleton } from '@/components/shared/LoadingSkeleton';
import { CHART_COLORS } from '@/lib/constants';

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg-surface border border-border rounded-xl px-4 py-3 shadow-card">
      <p className="text-xs font-semibold text-text-secondary mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="text-xs text-text-secondary capitalize">{p.name}</span>
          <span className="text-xs font-medium text-text-primary font-mono">{formatCurrency(p.value, 'INR', true)}</span>
        </div>
      ))}
    </div>
  );
};

export function PortfolioTrendChart() {
  const { data, isLoading } = usePortfolioTrend(180);

  if (isLoading) return <ChartSkeleton height="h-72" />;

  const points = (data ?? []).map((p) => ({
    date: formatDate(p.date, 'dd MMM'),
    Invested: p.totalInvested,
    'Current Value': p.totalCurrent,
  }));

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp className="w-4 h-4 text-text-muted" />
        <h3 className="text-sm font-semibold text-text-primary">Portfolio Trend</h3>
      </div>
      <p className="text-xs text-text-secondary mb-4">Invested vs current value, recorded each time you visit</p>

      {points.length < 2 ? (
        <div className="flex items-center justify-center h-48 text-center px-6">
          <p className="text-xs text-text-muted">
            Today&apos;s value has been recorded. There&apos;s no way to know what your portfolio was worth before now,
            so this chart fills in for real as you keep using the app — check back in a few days.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={points} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorCurrentValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS[1]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHART_COLORS[1]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#82829A' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#82829A' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v, 'INR', true)} />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} formatter={(v) => <span style={{ color: '#9898A8' }}>{v}</span>} />
            <Area type="monotone" dataKey="Invested" stroke={CHART_COLORS[0]} strokeWidth={2} fillOpacity={1} fill="url(#colorInvested)" />
            <Area type="monotone" dataKey="Current Value" stroke={CHART_COLORS[1]} strokeWidth={2} fillOpacity={1} fill="url(#colorCurrentValue)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
