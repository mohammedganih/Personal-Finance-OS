'use client';

import { CalendarClock } from 'lucide-react';
import { useEMICalendar } from '@/hooks/useDebtIntelligence';
import { formatCurrency, formatDate } from '@/lib/format';
import { CalendarEntry, DebtSourceType } from '@/types';

const SOURCE_ICON: Record<DebtSourceType, string> = {
  LOAN: '🏦',
  CREDIT_CARD: '💳',
  CARD_EMI: '🛒',
};

function groupByMonth(entries: CalendarEntry[]) {
  const groups = new Map<string, CalendarEntry[]>();
  for (const e of entries) {
    const key = formatDate(e.date, 'MMMM yyyy');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  return groups;
}

export function EMICalendar() {
  const { data, isLoading } = useEMICalendar(3);

  if (isLoading) return <div className="glass-card rounded-2xl h-56 shimmer" />;
  if (!data?.length) return null;

  const groups = groupByMonth(data);
  const monthlyTotal = (entries: CalendarEntry[]) => entries.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <CalendarClock className="w-4 h-4 text-text-muted" />
        <h3 className="text-sm font-semibold text-text-primary">EMI Calendar</h3>
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
                <div key={`${e.debtId}-${e.date}-${i}`} className="flex items-center gap-3 p-2 rounded-lg bg-bg-elevated">
                  <span className="text-base w-5 text-center shrink-0">{SOURCE_ICON[e.sourceType]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-text-primary truncate">{e.name}</p>
                    <p className="text-xs text-text-muted">Due {formatDate(e.date, 'dd MMM')}</p>
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
