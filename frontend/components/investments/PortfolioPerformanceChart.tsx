'use client';

import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { usePortfolioTrend, useAnnualizedReturns } from '@/hooks/useInvestmentIntelligence';
import { formatCurrency, formatDate, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

const RANGES = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'All', days: 730 },
] as const;

type Mode = 'value' | 'returns';

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
        active ? 'bg-mono text-white' : 'text-ink-secondary hover:bg-paper-subtle'
      )}
    >
      {children}
    </button>
  );
}

function CustomTooltip({ active, payload, label, mode }: { active?: boolean; payload?: Array<{ value: number }>; label?: string; mode: Mode }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-paper-card border border-line rounded-xl px-3.5 py-2.5 shadow-soft">
      <p className="text-[11px] text-ink-muted mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-ink-primary tabular-nums">
        {mode === 'value' ? formatCurrency(payload[0].value, 'INR', true) : formatPercent(payload[0].value)}
      </p>
    </div>
  );
}

/**
 * "Net Added"/"Market Gain" only reconcile against whatever real snapshot
 * history exists in the selected range -- InvestmentSnapshot rows are
 * recorded on read, never backfilled (see investmentIntelligence.service.ts),
 * so a 1Y/All range can have real history much shorter than the tab implies.
 * The caveat note below surfaces that honestly instead of hiding it.
 */
export function PortfolioPerformanceChart() {
  const [range, setRange] = useState<(typeof RANGES)[number]>(RANGES[3]);
  const [mode, setMode] = useState<Mode>('value');
  const { data, isLoading } = usePortfolioTrend(range.days);
  const { data: returns } = useAnnualizedReturns();

  if (isLoading) return <div className="card-light rounded-2xl h-96 shimmer" />;

  const points = data ?? [];

  const chartPoints = points.map((p) => ({
    date: formatDate(p.date, 'dd MMM'),
    value: p.totalCurrent,
    returns: p.totalInvested > 0 ? ((p.totalCurrent - p.totalInvested) / p.totalInvested) * 100 : 0,
  }));

  const first = points[0];
  const last = points[points.length - 1];
  const netAdded = first && last ? last.totalInvested - first.totalInvested : null;
  const marketGain = first && last ? last.totalPnl - first.totalPnl : null;
  const marketGainPct = marketGain !== null && first.totalCurrent > 0 ? (marketGain / first.totalCurrent) * 100 : null;

  const expectedStart = new Date();
  expectedStart.setDate(expectedStart.getDate() - range.days + 2); // small tolerance
  const isTruncated = !!first && new Date(first.date) > expectedStart;

  return (
    <div className="card-light rounded-2xl p-5">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
        <h3 className="text-sm font-semibold text-ink-primary">Portfolio Performance</h3>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-0.5 bg-paper-subtle rounded-full p-0.5">
            <TabButton active={mode === 'value'} onClick={() => setMode('value')}>Value</TabButton>
            <TabButton active={mode === 'returns'} onClick={() => setMode('returns')}>Returns (%)</TabButton>
          </div>
          <div className="flex items-center gap-0.5 bg-paper-subtle rounded-full p-0.5">
            {RANGES.map((r) => (
              <TabButton key={r.label} active={r.label === range.label} onClick={() => setRange(r)}>{r.label}</TabButton>
            ))}
          </div>
        </div>
      </div>

      {points.length < 2 ? (
        <div className="flex items-center justify-center h-56 text-center px-6">
          <p className="text-xs text-ink-muted">
            Today&apos;s value has been recorded. There&apos;s no way to know what your portfolio was worth before now,
            so this chart fills in for real as you keep using the app — check back in a few days.
          </p>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartPoints} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(11,11,11,0.06)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#898781' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: '#898781' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => (mode === 'value' ? formatCurrency(v, 'INR', true) : `${v.toFixed(0)}%`)}
              />
              <Tooltip content={<CustomTooltip mode={mode} />} />
              <Line
                type="monotone"
                dataKey={mode}
                stroke="#0B0B0B"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-line">
            <div>
              <p className="text-xs text-ink-muted">Initial Value</p>
              <p className="text-sm font-semibold text-ink-primary tabular-nums mt-0.5">{formatCurrency(first.totalCurrent, 'INR', true)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Net Added</p>
              <p className="text-sm font-semibold text-ink-primary tabular-nums mt-0.5">{formatCurrency(netAdded ?? 0, 'INR', true)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Market Gain</p>
              <p className={cn('text-sm font-semibold tabular-nums mt-0.5', (marketGain ?? 0) >= 0 ? 'text-updown-up' : 'text-updown-down')}>
                {formatCurrency(marketGain ?? 0, 'INR', true)}
                {marketGainPct !== null && ` (${formatPercent(marketGainPct)})`}
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">XIRR</p>
              <p className="text-sm font-semibold text-ink-primary tabular-nums mt-0.5">
                {returns?.overall !== null && returns?.overall !== undefined ? formatPercent(returns.overall * 100) : '—'}
              </p>
            </div>
          </div>

          {isTruncated && (
            <p className="text-[11px] text-ink-muted mt-2">History since {formatDate(first.date, 'dd MMM yyyy')}</p>
          )}
        </>
      )}
    </div>
  );
}
