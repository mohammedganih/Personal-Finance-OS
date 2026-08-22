'use client';

import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useGoals } from '@/hooks/useGoals';
import { GOAL_TYPE_ICONS } from '@/lib/constants';
import { formatCurrency, formatDate, getDaysUntil } from '@/lib/format';
import { cn } from '@/lib/utils';

function daysLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

/** Same "next + expandable rest" shell as UpcomingEMIsCard/UpcomingBillsCalendarCard,
 * sorted by the real targetDate already on Goal -- no separate timeline endpoint needed. */
export function GoalTimelineCard() {
  const { data: goals, isLoading } = useGoals();

  const [expanded, setExpanded] = useState(false);

  const list = useMemo(
    () => (goals ?? [])
      .filter((g) => !g.isCompleted)
      .sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime()),
    [goals]
  );

  if (isLoading) return <div className="card-light rounded-2xl h-64 shimmer" />;

  if (list.length === 0) {
    return (
      <div className="card-light rounded-2xl p-5 h-64 flex flex-col items-center justify-center text-center gap-1">
        <p className="text-sm text-ink-muted">No goals scheduled yet</p>
        <p className="text-xs text-ink-muted">Upcoming target dates will show up here</p>
      </div>
    );
  }

  const [next, ...rest] = list;

  return (
    <div className="card-light rounded-2xl p-5 flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-ink-primary">Goal Timeline</h3>
        {rest.length > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-ink-primary transition-colors"
          >
            View All
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', expanded && 'rotate-180')} />
          </button>
        )}
      </div>
      <p className="text-xs text-ink-muted mb-3">Next upcoming target</p>

      <div className="flex items-start gap-3 p-3.5 rounded-xl bg-paper-subtle">
        <div className="w-9 h-9 rounded-full bg-paper-card border border-line flex items-center justify-center text-base shrink-0">
          {next.icon || GOAL_TYPE_ICONS[next.goalType] || '🎯'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink-primary truncate">{next.name}</p>
            <span className="text-[11px] font-medium text-ink-primary bg-paper-card border border-line rounded-full px-2 py-0.5 whitespace-nowrap">
              {daysLabel(getDaysUntil(next.targetDate))}
            </span>
          </div>
          <p className="text-xs text-ink-muted mt-0.5">{formatDate(next.targetDate)}</p>
        </div>
      </div>
      <p className="text-lg font-bold text-ink-primary tabular-nums mt-3">Target: {formatCurrency(next.targetAmount, 'INR', true)}</p>

      {expanded && rest.length > 0 && (
        <div className="mt-4 pt-4 border-t border-line space-y-3">
          {rest.map((g) => (
            <div key={g.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-ink-primary truncate">{g.name}</p>
                <p className="text-[11px] text-ink-muted truncate">{formatDate(g.targetDate)} · {daysLabel(getDaysUntil(g.targetDate))}</p>
              </div>
              <span className="text-xs font-medium text-ink-primary tabular-nums shrink-0">{formatCurrency(g.targetAmount, 'INR', true)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
