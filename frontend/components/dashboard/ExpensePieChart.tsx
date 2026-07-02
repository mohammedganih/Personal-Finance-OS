'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/lib/format';
import { useExpenseBreakdown } from '@/hooks/useDashboard';
import { ChartSkeleton } from '@/components/shared/LoadingSkeleton';

const MAX_SLICES = 6;
const OTHER_COLOR = '#82829A'; // neutral, deliberately outside the categorical set -- signals "aggregate", not a real category

export function ExpensePieChart() {
  const { data, isLoading } = useExpenseBreakdown();

  if (isLoading) return <ChartSkeleton height="h-80" />;

  const sorted = [...(data || [])].sort((a, b) => b.total - a.total);

  const top = sorted.slice(0, MAX_SLICES).map((item) => ({
    name: item.categoryName,
    value: item.total,
    color: item.color,
    icon: item.icon,
  }));

  const rest = sorted.slice(MAX_SLICES);
  const otherTotal = rest.reduce((sum, item) => sum + item.total, 0);

  // Every slice rendered in the pie has a matching row in the legend below --
  // previously the pie plotted every category while the legend capped at 6,
  // leaving slices 7+ unlabeled with no way to identify them.
  const chartData = otherTotal > 0
    ? [...top, { name: `Other (${rest.length})`, value: otherTotal, color: OTHER_COLOR, icon: '⋯' }]
    : top;

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-text-primary">Expense Breakdown</h3>
        <p className="text-xs text-text-secondary mt-0.5">This month by category</p>
      </div>

      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-text-muted text-sm">
          No expenses this month
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <ResponsiveContainer width="55%" height={200}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [formatCurrency(value, 'INR', true), '']}
                contentStyle={{ background: 'var(--bg-surface)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="flex-1 space-y-2 overflow-hidden">
            {chartData.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-base leading-none">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-text-secondary truncate">{item.name}</p>
                </div>
                <span className="text-text-primary font-medium font-mono shrink-0">
                  {formatCurrency(item.value, 'INR', true)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
