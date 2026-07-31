'use client';

import { CalendarDays } from 'lucide-react';
import { Skeleton } from '@/components/shared/LoadingSkeleton';
import { useSpendingRhythm } from '@/hooks/useAnalytics';
import { formatCurrency } from '@/lib/format';

export function SpendingRhythmHeatmap() {
  const { data, isLoading } = useSpendingRhythm();

  if (isLoading || !data) {
    return (
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <Skeleton className="h-4 w-48" />
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-md" />)}
        </div>
      </div>
    );
  }

  const maxAvg = Math.max(...data.days.map((d) => d.avgAmount), 1);
  const weekdayAvg = data.days.reduce((s, d) => s + d.avgAmount, 0) / 7;
  const peakDelta = data.peakDay && weekdayAvg > 0 ? ((data.peakDay.avgAmount - weekdayAvg) / weekdayAvg) * 100 : 0;

  return (
    <div className="glass-card rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-accent-violet-light" />
        <h3 className="text-sm font-semibold text-text-primary">Weekly Spending Rhythm</h3>
      </div>

      {!data.hasEnoughData ? (
        <p className="text-xs text-text-muted py-6 text-center">
          Patterns need a few weeks of data to be reliable — keep logging transactions and this will fill in.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1.5">
            {data.days.map((d, i) => {
              const opacity = d.avgAmount > 0 ? 0.15 + (d.avgAmount / maxAvg) * 0.75 : 0.06;
              return (
                <div key={d.day} className="space-y-1 text-center">
                  <p className="text-[10px] text-text-muted">{d.day}</p>
                  <div
                    className="aspect-square rounded-md bg-accent-violet transition-opacity"
                    style={{ opacity, animationDelay: `${i * 15}ms` }}
                    title={`${d.day}: ${formatCurrency(d.avgAmount, 'INR', true)} average`}
                  />
                </div>
              );
            })}
          </div>

          {/* Color intensity alone conveys nothing to a screen reader. */}
          <table className="sr-only">
            <caption>Average spend by day of week</caption>
            <thead><tr><th>Day</th><th>Average spend</th></tr></thead>
            <tbody>
              {data.days.map((d) => (
                <tr key={d.day}><td>{d.day}</td><td>{formatCurrency(d.avgAmount)}</td></tr>
              ))}
            </tbody>
          </table>

          {data.peakDay && data.peakDay.avgAmount > 0 && (
            <p className="text-xs text-text-secondary">
              {data.peakDay.day}s average {formatCurrency(data.peakDay.avgAmount, 'INR', true)}
              {peakDelta > 5 && ` — about ${peakDelta.toFixed(0)}% higher than your weekday average`}.
            </p>
          )}
        </>
      )}
    </div>
  );
}
