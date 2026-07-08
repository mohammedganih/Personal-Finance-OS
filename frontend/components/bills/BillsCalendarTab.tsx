'use client';

import { useMemo, useState } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, isToday, addMonths, subMonths, format, parseISO,
} from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, List, Zap } from 'lucide-react';
import { useBillsCalendar, usePayBillOccurrence, useSkipBillOccurrence, useUndoBillOccurrence } from '@/hooks/useBills';
import { formatCurrency } from '@/lib/format';
import { billCategoryMeta } from '@/lib/constants';
import { BillCalendarOccurrence, BillOccurrenceStatus } from '@/types';
import { cn } from '@/lib/utils';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Status is never color-alone: the agenda + day panel spell it out in text,
// and paid/skipped dots are also distinguished by shape (ring vs solid).
const STATUS_DOT: Record<BillOccurrenceStatus, string> = {
  PAID: 'bg-success',
  SKIPPED: 'bg-transparent border border-text-muted',
  PAUSED: 'bg-transparent border border-warning',
  OVERDUE: 'bg-danger',
  DUE_TODAY: 'bg-danger',
  UPCOMING: 'bg-accent-violet',
};

const STATUS_LABEL: Record<BillOccurrenceStatus, string> = {
  PAID: 'Paid',
  SKIPPED: 'Skipped',
  PAUSED: 'Paused',
  OVERDUE: 'Overdue',
  DUE_TODAY: 'Due today',
  UPCOMING: 'Upcoming',
};

const STATUS_TEXT: Record<BillOccurrenceStatus, string> = {
  PAID: 'text-success',
  SKIPPED: 'text-text-muted',
  PAUSED: 'text-warning',
  OVERDUE: 'text-danger',
  DUE_TODAY: 'text-danger',
  UPCOMING: 'text-text-secondary',
};

export function BillsCalendarTab() {
  const [view, setView] = useState<'month' | 'agenda'>('month');
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Fetch a padded window so navigating a month either way is instant.
  const rangeStart = format(subMonths(startOfMonth(viewMonth), 1), 'yyyy-MM-dd');
  const rangeEnd = format(endOfMonth(addMonths(viewMonth, 1)), 'yyyy-MM-dd');
  const { data: occurrences, isLoading } = useBillsCalendar(rangeStart, rangeEnd);

  const byDay = useMemo(() => {
    const map = new Map<string, BillCalendarOccurrence[]>();
    for (const occ of occurrences ?? []) {
      if (!map.has(occ.dueDate)) map.set(occ.dueDate, []);
      map.get(occ.dueDate)!.push(occ);
    }
    return map;
  }, [occurrences]);

  const monthOccurrences = useMemo(
    () => (occurrences ?? []).filter((o) => isSameMonth(parseISO(o.dueDate), viewMonth)),
    [occurrences, viewMonth]
  );
  const monthTotal = monthOccurrences
    .filter((o) => o.status !== 'SKIPPED' && o.status !== 'PAUSED')
    .reduce((s, o) => s + o.amount, 0);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth));
    const end = endOfWeek(endOfMonth(viewMonth));
    return eachDayOfInterval({ start, end });
  }, [viewMonth]);

  const selectedKey = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : null;
  const selectedOccurrences = selectedKey ? byDay.get(selectedKey) ?? [] : [];

  if (isLoading) return <div className="glass-card rounded-2xl h-96 shimmer" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-bg-elevated rounded-xl p-1 border border-border">
          {([['month', CalendarDays, 'Month'], ['agenda', List, 'Agenda']] as const).map(([key, Icon, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5',
                view === key ? 'bg-bg-surface text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'
              )}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs text-text-muted">
          {(
            [
              ['UPCOMING', 'Upcoming'],
              ['PAID', 'Paid'],
              ['OVERDUE', 'Overdue'],
              ['SKIPPED', 'Skipped'],
            ] as const
          ).map(([status, label]) => (
            <span key={status} className="flex items-center gap-1.5">
              <span className={cn('w-2 h-2 rounded-full', STATUS_DOT[status])} />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="glass-card rounded-2xl p-5">
        {/* Month header */}
        <div className="flex items-center justify-between mb-4">
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
            <p className="text-xs text-text-muted">
              {monthOccurrences.length} bills · {formatCurrency(monthTotal, 'INR', true)} scheduled
            </p>
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

        {view === 'month' ? (
          <>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAY_LABELS.map((d, i) => (
                <div key={i} className="text-[10px] font-medium text-text-muted text-center py-1">{d}</div>
              ))}
              {days.map((day) => {
                const key = format(day, 'yyyy-MM-dd');
                const dayOccs = byDay.get(key) ?? [];
                const inMonth = isSameMonth(day, viewMonth);
                const selected = !!selectedDay && isSameDay(day, selectedDay);
                const dayTotal = dayOccs
                  .filter((o) => o.status !== 'SKIPPED' && o.status !== 'PAUSED')
                  .reduce((s, o) => s + o.amount, 0);

                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => dayOccs.length > 0 && setSelectedDay(selected ? null : day)}
                    disabled={dayOccs.length === 0}
                    className={cn(
                      'aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 text-xs transition-colors relative',
                      !inMonth && 'opacity-30',
                      isToday(day) && !selected && 'ring-1 ring-accent-violet/40',
                      dayOccs.length > 0 ? 'bg-bg-elevated hover:bg-bg-overlay cursor-pointer' : 'cursor-default',
                      selected && 'bg-accent-violet/20 ring-1 ring-accent-violet',
                    )}
                  >
                    <span className={cn('text-text-secondary', isToday(day) && 'text-accent-violet-light font-bold')}>
                      {format(day, 'd')}
                    </span>
                    {dayOccs.length > 0 && (
                      <span className="flex items-center gap-0.5">
                        {dayOccs.slice(0, 3).map((o, i) => (
                          <span key={i} className={cn('w-1.5 h-1.5 rounded-full', STATUS_DOT[o.status])} />
                        ))}
                        {dayOccs.length > 3 && <span className="text-[8px] text-text-muted">+{dayOccs.length - 3}</span>}
                      </span>
                    )}
                    {dayTotal > 0 && inMonth && (
                      <span className="text-[8px] text-text-muted leading-none hidden md:block">
                        {formatCurrency(dayTotal, 'INR', true)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {selectedDay && selectedOccurrences.length > 0 && (
              <div className="space-y-1.5 pt-3 mt-3 border-t border-border">
                <p className="text-xs font-semibold text-text-secondary">{format(selectedDay, 'dd MMMM yyyy')}</p>
                {selectedOccurrences.map((occ) => (
                  <OccurrenceRow key={`${occ.billId}-${occ.dueDate}`} occ={occ} />
                ))}
              </div>
            )}
          </>
        ) : (
          <AgendaView occurrences={monthOccurrences} />
        )}
      </div>
    </div>
  );
}

function AgendaView({ occurrences }: { occurrences: BillCalendarOccurrence[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, BillCalendarOccurrence[]>();
    for (const occ of occurrences) {
      if (!map.has(occ.dueDate)) map.set(occ.dueDate, []);
      map.get(occ.dueDate)!.push(occ);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [occurrences]);

  if (grouped.length === 0) {
    return <p className="text-xs text-text-muted text-center py-8">Nothing scheduled this month</p>;
  }

  return (
    <div className="space-y-4 max-h-[32rem] overflow-y-auto pr-1">
      {grouped.map(([date, occs]) => (
        <div key={date} className="flex gap-3">
          <div className="w-12 text-center shrink-0 pt-1">
            <p className={cn('text-lg font-bold leading-none', isToday(parseISO(date)) ? 'text-accent-violet-light' : 'text-text-primary')}>
              {format(parseISO(date), 'dd')}
            </p>
            <p className="text-[10px] text-text-muted uppercase">{format(parseISO(date), 'EEE')}</p>
          </div>
          <div className="flex-1 space-y-1.5 min-w-0">
            {occs.map((occ) => (
              <OccurrenceRow key={`${occ.billId}-${occ.dueDate}`} occ={occ} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function OccurrenceRow({ occ }: { occ: BillCalendarOccurrence }) {
  const { mutate: payBill, isPending: isPaying } = usePayBillOccurrence();
  const { mutate: skipBill, isPending: isSkipping } = useSkipBillOccurrence();
  const { mutate: undoBill, isPending: isUndoing } = useUndoBillOccurrence();
  const meta = billCategoryMeta(occ.category);
  const actionable = occ.status === 'UPCOMING' || occ.status === 'DUE_TODAY' || occ.status === 'OVERDUE';
  const undoable = occ.status === 'PAID' || occ.status === 'SKIPPED';

  return (
    <div className="flex items-center gap-2.5 p-2 rounded-xl bg-bg-elevated">
      <span className="text-sm w-6 text-center shrink-0">{occ.icon || meta.icon}</span>
      <div className="flex-1 min-w-0">
        <p className={cn('text-xs font-medium truncate', occ.status === 'SKIPPED' ? 'text-text-muted line-through' : 'text-text-primary')}>
          {occ.name}
          {occ.autoDebit && <Zap className="w-3 h-3 inline ml-1 text-accent-violet-light" />}
        </p>
        <p className={cn('text-[10px]', STATUS_TEXT[occ.status])}>{STATUS_LABEL[occ.status]} · {occ.category}</p>
      </div>
      <span className={cn('text-xs font-mono font-semibold shrink-0', occ.status === 'SKIPPED' || occ.status === 'PAUSED' ? 'text-text-muted line-through' : 'text-text-primary')}>
        {formatCurrency(occ.amount, 'INR', true)}
      </span>
      {actionable && (
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => payBill({ id: occ.billId, dueDate: occ.dueDate })}
            disabled={isPaying}
            className="px-2 py-0.5 rounded-lg bg-success/10 text-success text-[10px] font-medium hover:bg-success/20 transition-colors"
          >
            Pay
          </button>
          <button
            onClick={() => skipBill({ id: occ.billId, dueDate: occ.dueDate })}
            disabled={isSkipping}
            className="px-2 py-0.5 rounded-lg bg-bg-overlay text-text-muted text-[10px] hover:text-warning transition-colors"
          >
            Skip
          </button>
        </div>
      )}
      {undoable && (
        <button
          onClick={() => undoBill({ id: occ.billId, dueDate: occ.dueDate })}
          disabled={isUndoing}
          title={occ.status === 'PAID' ? 'Undo payment (reverses the transaction)' : 'Undo skip'}
          className="px-2 py-0.5 rounded-lg bg-bg-overlay text-text-muted text-[10px] hover:text-text-primary transition-colors shrink-0"
        >
          Undo
        </button>
      )}
    </div>
  );
}
