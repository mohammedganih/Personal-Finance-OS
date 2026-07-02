'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { formatCurrency } from '@/lib/format';
import { useCashflowTrend } from '@/hooks/useDashboard';
import { ChartSkeleton } from '@/components/shared/LoadingSkeleton';

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
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

export function CashflowChart() {
  const { data, isLoading } = useCashflowTrend(6);

  if (isLoading) return <ChartSkeleton height="h-80" />;

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-text-primary">Monthly Cashflow</h3>
        <p className="text-xs text-text-secondary mt-0.5">Income vs Expenses — last 6 months</p>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#555568' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#555568' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v, 'INR', true)} />
          <Tooltip content={<CustomTooltip />} />
          <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} formatter={(v) => <span style={{ color: '#9898A8' }}>{v}</span>} />
          <Area type="monotone" dataKey="income" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorIncome)" />
          <Area type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={2} fillOpacity={1} fill="url(#colorExpenses)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
