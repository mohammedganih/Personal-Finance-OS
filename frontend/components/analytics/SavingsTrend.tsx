'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useCashflowTrend } from '@/hooks/useDashboard';
import { formatCurrency } from '@/lib/format';

export function SavingsTrend() {
  const { data: cashflow } = useCashflowTrend(12);
  const savingsData = (cashflow ?? []).map((d) => ({
    month: d.month,
    savings: d.savings,
    rate: d.income > 0 ? (d.savings / d.income) * 100 : 0,
  }));

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-text-primary">Savings Trend</h3>
        <p className="text-xs text-text-secondary mt-0.5">Monthly net savings — last 12 months</p>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={savingsData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#555568' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#555568' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v, 'INR', true)} />
          <Tooltip
            formatter={(v: number) => [formatCurrency(v, 'INR', true), 'Savings']}
            contentStyle={{ background: '#111118', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', fontSize: '12px' }}
          />
          <Bar dataKey="savings" radius={[6, 6, 0, 0]}>
            {savingsData.map((entry, i) => (
              <Cell key={i} fill={entry.savings >= 0 ? '#10B981' : '#EF4444'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
