'use client';

import { CalendarClock } from 'lucide-react';
import { useInvestmentCalendar } from '@/hooks/useInvestmentIntelligence';
import { formatCurrency, formatDate } from '@/lib/format';
import { ASSET_TYPE_ICONS } from '@/lib/constants';
import { InvestmentCalendarEntry } from '@/types';

function groupByMonth(entries: InvestmentCalendarEntry[]) {
  const groups = new Map<string, InvestmentCalendarEntry[]>();
  for (const e of entries) {
    const key = formatDate(e.date, 'MMMM yyyy');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  return groups;
}

export function InvestmentCalendar() {
  const { data, isLoading } = useInvestmentCalendar(3);

  if (isLoading) return <div className="glass-card rounded-2xl h-56 shimmer" />;
  if (!data?.length) return null;

  const groups = groupByMonth(data);
  const monthlyTotal = (entries: InvestmentCalendarEntry[]) => entries.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <CalendarClock className="w-4 h-4 text-text-muted" />
        <h3 className="text-sm font-semibold text-text-primary">Investment Calendar</h3>
        <span className="text-xs text-text-muted">next 3 months</span>
      </div>

      <div className="space-y-4">
        {Array.from(groups.entries()).map(([month, entries]) => (
          <div key={month}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-text-secondary">{month}</p>
              <p className="text-xs text-text-muted">{formatCurrency(monthlyTotal(entries), 'INR', true)} total</p>
            </div>
            <div className="space-y-1.5">
              {entries.map((e, i) => (
                <div key={`${e.investmentId}-${e.date}-${i}`} className="flex items-center gap-3 p-2 rounded-lg bg-bg-elevated">
                  <span className="text-base w-5 text-center shrink-0">{ASSET_TYPE_ICONS[e.assetType] ?? '💼'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-text-primary truncate">{e.assetName}</p>
                    <p className="text-xs text-text-muted">Debits {formatDate(e.date, 'dd MMM')}</p>
                  </div>
                  <p className="text-xs font-mono font-semibold text-text-primary">{formatCurrency(e.amount, 'INR', true)}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
