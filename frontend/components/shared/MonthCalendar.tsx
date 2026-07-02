'use client';

import { useMemo, useState } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, isToday, addMonths, subMonths, format,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface CalendarEvent {
  date: string; // ISO date
  label: string;
  amount: number;
  icon?: string;
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * Shared month-grid calendar: pass any list of dated events and it renders
 * a real day-grid (not a flat list grouped by month), with a dot per day
 * that has events, prev/next navigation, and a click-to-expand day panel.
 * Used by both the debt EMI Calendar and the investment SIP/RD calendar so
 * the two don't diverge into two different visual languages.
 */
export function MonthCalendar({ events, colorClass = 'bg-accent-violet' }: { events: CalendarEvent[]; colorClass?: string }) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth));
    const end = endOfWeek(endOfMonth(viewMonth));
    return eachDayOfInterval({ start, end });
  }, [viewMonth]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = format(new Date(e.date), 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [events]);

  const monthTotal = useMemo(
    () => events
      .filter((e) => isSameMonth(new Date(e.date), viewMonth))
      .reduce((s, e) => s + e.amount, 0),
    [events, viewMonth],
  );

  const selectedEvents = selectedDay ? eventsByDay.get(format(selectedDay, 'yyyy-MM-dd')) ?? [] : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => { setViewMonth((m) => subMonths(m, 1)); setSelectedDay(null); }}
          className="p-1.5 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-text-primary">{format(viewMonth, 'MMMM yyyy')}</p>
          {monthTotal > 0 && <p className="text-xs text-text-muted">{formatCurrency(monthTotal, 'INR', true)} total</p>}
        </div>
        <button
          type="button"
          onClick={() => { setViewMonth((m) => addMonths(m, 1)); setSelectedDay(null); }}
          className="p-1.5 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((d, i) => (
          <div key={i} className="text-[10px] font-medium text-text-muted text-center py-1">{d}</div>
        ))}
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDay.get(key) ?? [];
          const inMonth = isSameMonth(day, viewMonth);
          const selected = !!selectedDay && isSameDay(day, selectedDay);

          return (
            <button
              type="button"
              key={key}
              onClick={() => dayEvents.length > 0 && setSelectedDay(selected ? null : day)}
              disabled={dayEvents.length === 0}
              className={cn(
                'aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 text-xs transition-colors',
                !inMonth && 'opacity-30',
                isToday(day) && !selected && 'ring-1 ring-accent-violet/40',
                dayEvents.length > 0 ? 'bg-bg-elevated hover:bg-bg-overlay cursor-pointer' : 'cursor-default',
                selected && 'bg-accent-violet/20 ring-1 ring-accent-violet',
              )}
            >
              <span className={cn('text-text-secondary', isToday(day) && 'text-accent-violet-light font-bold')}>
                {format(day, 'd')}
              </span>
              {dayEvents.length > 0 && <span className={cn('w-1.5 h-1.5 rounded-full', colorClass)} />}
            </button>
          );
        })}
      </div>

      {selectedDay && selectedEvents.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-border">
          <p className="text-xs font-semibold text-text-secondary">{format(selectedDay, 'dd MMMM yyyy')}</p>
          {selectedEvents.map((e, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-bg-elevated">
              {e.icon && <span className="text-sm w-5 text-center shrink-0">{e.icon}</span>}
              <span className="text-xs text-text-primary flex-1 truncate">{e.label}</span>
              <span className="text-xs font-mono font-semibold text-text-primary">{formatCurrency(e.amount, 'INR', true)}</span>
            </div>
          ))}
        </div>
      )}

      {events.length === 0 && (
        <p className="text-xs text-text-muted text-center py-4">Nothing scheduled</p>
      )}
    </div>
  );
}
