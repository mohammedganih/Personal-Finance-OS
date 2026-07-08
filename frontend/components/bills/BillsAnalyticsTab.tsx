'use client';

import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useBillsAnalytics } from '@/hooks/useBills';
import { formatCurrency } from '@/lib/format';
import { BILL_FREQUENCY_LABELS, billCategoryMeta } from '@/lib/constants';
import { cn } from '@/lib/utils';

const MAX_SLICES = 6;
// Neutral, outside the categorical set -- signals "aggregate", not a category.
const OTHER_COLOR = '#82829A';
const TREND_HUE = '#3987e5';

const TooltipBox = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg-surface border border-border rounded-xl px-4 py-3 shadow-card">
      {label && <p className="text-xs font-semibold text-text-secondary mb-2">{label}</p>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="text-xs text-text-secondary capitalize">{p.name}</span>
          <span className="text-xs font-medium text-text-primary font-mono">{formatCurrency(p.value, 'INR', true)}</span>
        </div>
      ))}
    </div>
  );
};

export function BillsAnalyticsTab() {
  const { data, isLoading } = useBillsAnalytics();

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass-card rounded-2xl h-72 shimmer" />)}
      </div>
    );
  }

  if (data.categoryBreakdown.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center text-sm text-text-muted">
        Add a few bills and the analytics will light up here.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <CategoryDonut data={data} />
      <TrendChart data={data} />
      <VendorSpend data={data} />
      <LargestBills data={data} />
    </div>
  );
}

type Analytics = NonNullable<ReturnType<typeof useBillsAnalytics>['data']>;

function CategoryDonut({ data }: { data: Analytics }) {
  const sorted = [...data.categoryBreakdown].sort((a, b) => b.monthlyEquivalent - a.monthlyEquivalent);
  const top = sorted.slice(0, MAX_SLICES).map((c) => ({
    name: c.category,
    value: c.monthlyEquivalent,
    share: c.share,
    color: billCategoryMeta(c.category).color,
    icon: billCategoryMeta(c.category).icon,
  }));
  const rest = sorted.slice(MAX_SLICES);
  const otherTotal = rest.reduce((s, c) => s + c.monthlyEquivalent, 0);
  const chartData = otherTotal > 0
    ? [...top, { name: `Other (${rest.length})`, value: otherTotal, share: (otherTotal / Math.max(1, data.totalMonthly)) * 100, color: OTHER_COLOR, icon: '⋯' }]
    : top;

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-text-primary">Category Breakdown</h3>
        <p className="text-xs text-text-secondary mt-0.5">Monthly-equivalent recurring spend</p>
      </div>
      <div className="flex items-center gap-4">
        <ResponsiveContainer width="52%" height={200}>
          <PieChart>
            <Pie data={chartData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2} dataKey="value">
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [formatCurrency(value, 'INR', true) + '/mo', '']}
              contentStyle={{ background: 'var(--bg-surface)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', fontSize: '12px' }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex-1 space-y-2 overflow-hidden">
          {chartData.map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
              <span className="text-sm leading-none shrink-0">{item.icon}</span>
              <p className="text-text-secondary truncate flex-1">{item.name}</p>
              <span className="text-text-muted shrink-0">{item.share.toFixed(0)}%</span>
              <span className="text-text-primary font-medium font-mono shrink-0">{formatCurrency(item.value, 'INR', true)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TrendChart({ data }: { data: Analytics }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-text-primary">Monthly Trend</h3>
        <p className="text-xs text-text-secondary mt-0.5">Paid so far vs projected — 6 months back, 6 ahead</p>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data.trend} margin={{ top: 5, right: 5, left: -15, bottom: 0 }} barSize={18}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#555568' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#555568' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v, 'INR', true)} />
          <Tooltip content={<TooltipBox />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} formatter={(v) => <span style={{ color: '#9898A8' }}>{v}</span>} />
          {/* One measure, two states: same hue, projected at reduced opacity */}
          <Bar name="paid" dataKey="paid" stackId="m" fill={TREND_HUE} />
          <Bar name="projected" dataKey="projected" stackId="m" fill={TREND_HUE} fillOpacity={0.4} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function VendorSpend({ data }: { data: Analytics }) {
  const max = Math.max(1, ...data.vendorSpend.map((v) => v.monthlyEquivalent));
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-text-primary">Vendor Spend</h3>
        <p className="text-xs text-text-secondary mt-0.5">Who gets your money every month</p>
      </div>
      {data.vendorSpend.length === 0 ? (
        <p className="text-xs text-text-muted py-6 text-center">No vendors yet</p>
      ) : (
        <div className="space-y-2.5">
          {data.vendorSpend.map((v) => (
            <div key={v.vendor} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-secondary truncate">{v.vendor}{v.count > 1 ? ` × ${v.count}` : ''}</span>
                <span className="font-mono text-text-primary shrink-0">{formatCurrency(v.monthlyEquivalent, 'INR', true)}/mo</span>
              </div>
              <div className="h-1.5 bg-bg-overlay rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(v.monthlyEquivalent / max) * 100}%`, background: TREND_HUE }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LargestBills({ data }: { data: Analytics }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-text-primary">Largest Commitments</h3>
        <p className="text-xs text-text-secondary mt-0.5">Biggest recurring line items, monthly-equivalent</p>
      </div>
      <div className="space-y-2">
        {data.largestBills.map((bill, rank) => {
          const meta = billCategoryMeta(bill.category);
          return (
            <div key={bill.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-bg-elevated">
              <span className={cn('text-xs font-bold w-5 text-center shrink-0', rank === 0 ? 'text-warning' : 'text-text-muted')}>
                #{rank + 1}
              </span>
              <span className="text-base shrink-0">{bill.icon || meta.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-text-primary truncate">{bill.name}</p>
                <p className="text-[10px] text-text-muted">
                  {bill.category} · {BILL_FREQUENCY_LABELS[bill.frequency]} · {formatCurrency(bill.amount, 'INR', true)}/cycle
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-mono font-semibold text-text-primary">{formatCurrency(bill.monthlyEquivalent, 'INR', true)}/mo</p>
                <p className="text-[10px] text-text-muted">{bill.share.toFixed(0)}% of total</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
