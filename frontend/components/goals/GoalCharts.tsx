'use client';

import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatCurrency, formatDate } from '@/lib/format';
import { CHART_COLORS } from '@/lib/constants';
import { useGoalContributions } from '@/hooks/useGoals';
import { Goal, GoalProgress } from '@/types';

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

/** Projects month-by-month value from now to the target date using the same compound-growth math as the progress engine. */
export function GoalGrowthChart({ goal, progress }: { goal: Goal; progress: GoalProgress }) {
  const now = new Date();
  const monthlyRate = (goal.expectedReturnRate ?? 0) / 100 / 12;
  const monthly = progress.currentMonthlySavings;
  const monthsLeft = Math.max(1, Math.round(progress.monthsLeft));

  const points = [];
  let value = goal.currentAmount;
  for (let m = 0; m <= monthsLeft; m++) {
    const date = new Date(now.getFullYear(), now.getMonth() + m, 1);
    points.push({ month: formatDate(date, 'MMM yy'), Projected: Math.round(value), Target: goal.targetAmount });
    value = value * (1 + monthlyRate) + monthly;
  }

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-text-primary">Projected Growth</h3>
        <p className="text-xs text-text-secondary mt-0.5">At the current contribution and return assumptions</p>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={points} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="goalProjected" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.3} />
              <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#82829A' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: '#82829A' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v, 'INR', true)} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="Projected" stroke={CHART_COLORS[0]} strokeWidth={2} fillOpacity={1} fill="url(#goalProjected)" />
          <Area type="monotone" dataKey="Target" stroke={CHART_COLORS[5]} strokeWidth={1.5} strokeDasharray="4 4" fill="none" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ContributionTrendChart({ goalId }: { goalId: string }) {
  const { data: contributions, isLoading } = useGoalContributions(goalId);

  if (isLoading) return <div className="glass-card rounded-2xl h-64 shimmer" />;
  if (!contributions?.length) return null;

  const byMonth = new Map<string, number>();
  for (const c of contributions) {
    const key = formatDate(c.date, 'MMM yy');
    byMonth.set(key, (byMonth.get(key) ?? 0) + c.amount);
  }
  const data = Array.from(byMonth.entries()).map(([month, amount]) => ({ month, Contributed: amount })).reverse();

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-text-primary">Monthly Contribution Trend</h3>
        <p className="text-xs text-text-secondary mt-0.5">Logged contributions by month</p>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#82829A' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#82829A' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v, 'INR', true)} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="Contributed" fill={CHART_COLORS[1]} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
