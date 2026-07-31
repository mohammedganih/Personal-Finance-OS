'use client';

import { useMemo } from 'react';
import { addMonths, format } from 'date-fns';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { TrendingDown } from 'lucide-react';
import { useDebtStrategy } from '@/hooks/useDebtIntelligence';
import { ChartSkeleton } from '@/components/shared/LoadingSkeleton';
import { formatCurrency } from '@/lib/format';

const ACCELERATED_COLOR = '#A78BFA'; // accent-violet-light, matching the legend text

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg-surface border border-border rounded-xl px-4 py-3 shadow-card">
      <p className="text-xs font-semibold text-text-secondary mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="text-xs text-text-secondary">{p.name}</span>
          <span className="text-xs font-medium text-text-primary font-mono">{formatCurrency(p.value, 'INR', true)}</span>
        </div>
      ))}
    </div>
  );
};

interface RepaymentTimelineChartProps {
  extraPayment: number;
}

/**
 * Month-by-month total balance, contracted pace vs the recommended
 * strategy + extra payment -- a real amortization schedule generated
 * backend-side (see simulatePayoff's `schedule`), not a stylized illustration.
 */
export function RepaymentTimelineChart({ extraPayment }: RepaymentTimelineChartProps) {
  const { data, isLoading } = useDebtStrategy(extraPayment);

  const points = useMemo(() => {
    if (!data?.debts?.length) return [];
    const { contractedSchedule, acceleratedSchedule } = data;
    const now = new Date();
    const maxLen = Math.max(contractedSchedule.length, acceleratedSchedule.length);
    return Array.from({ length: maxLen }, (_, i) => ({
      month: i,
      date: format(addMonths(now, i), 'MMM yy'),
      Contracted: i < contractedSchedule.length ? contractedSchedule[i] : 0,
      Accelerated: i < acceleratedSchedule.length ? acceleratedSchedule[i] : 0,
    }));
  }, [data]);

  if (isLoading) return <ChartSkeleton height="h-72" />;
  if (!data?.debts?.length || points.length < 2) return null;

  const debtFreeMonth = points.findIndex((p) => p.Accelerated <= 0);
  const contractedMonth = points.length - 1;
  const debtFreeDate = points[debtFreeMonth >= 0 ? debtFreeMonth : contractedMonth]?.date;
  const contractedDate = points[contractedMonth]?.date;
  const gap = contractedMonth - (debtFreeMonth >= 0 ? debtFreeMonth : contractedMonth);

  const ariaLabel = gap > 0
    ? `Total debt balance declines to zero by ${debtFreeDate} at the accelerated pace, about ${gap} months sooner than the contracted schedule which reaches zero by ${contractedDate}.`
    : `Total debt balance declines to zero by ${contractedDate} at the current contracted pace.`;

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-text-muted" />
          <h3 className="text-sm font-semibold text-text-primary">Repayment Timeline</h3>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-accent-violet-light">
            <span className="w-2.5 h-0.5 rounded-full bg-accent-violet-light inline-block" /> Accelerated (+{formatCurrency(extraPayment, 'INR', true)}/mo)
          </span>
          <span className="text-text-muted">┄ Contracted pace</span>
        </div>
      </div>

      <div role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height={240} aria-hidden="true">
          <LineChart data={points} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#82829A' }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(points.length / 8))} />
            <YAxis tick={{ fontSize: 11, fill: '#82829A' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v, 'INR', true)} />
            <Tooltip content={<CustomTooltip />} />
            {debtFreeMonth >= 0 && (
              <ReferenceLine x={points[debtFreeMonth]?.date} stroke="#F0F0F8" strokeDasharray="3 3" label={{ value: 'Debt-free', position: 'insideTopRight', fontSize: 10, fill: '#9898A8' }} />
            )}
            <Line type="monotone" dataKey="Contracted" stroke="#82829A" strokeWidth={2} strokeDasharray="4 4" dot={false} />
            <Line type="monotone" dataKey="Accelerated" stroke={ACCELERATED_COLOR} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
