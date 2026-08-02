'use client';

import { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, Receipt, CheckCircle2, Clock, AlertTriangle, CalendarClock } from 'lucide-react';
import { useBillsSummary } from '@/hooks/useBills';
import { formatCurrency } from '@/lib/format';
import { BillRangeTotals } from '@/types';

const RANGE_OPTIONS = [
  { key: 'thisMonth', label: 'This Month' },
  { key: 'nextMonth', label: 'Next Month' },
  { key: 'next3Months', label: 'Next 3 Months' },
  { key: 'next6Months', label: 'Next 6 Months' },
  { key: 'next12Months', label: 'Next 12 Months' },
  { key: 'dueThisWeek', label: 'Due This Week' },
] as const;

type RangeKey = (typeof RANGE_OPTIONS)[number]['key'];

/**
 * The reference's own "This Month" dropdown inside the Summary card maps
 * directly onto BillsSummary's real range buckets (thisMonth/nextMonth/
 * next3Months/...) -- already computed server-side, not scoped to the
 * header's period selector (getBillsSummary always anchors to the real
 * current date, independent of that control).
 */
export function BillsSummaryCard() {
  const { data: summary, isLoading } = useBillsSummary();
  const [range, setRange] = useState<RangeKey>('thisMonth');

  if (isLoading || !summary) return <div className="card-light rounded-2xl h-80 shimmer" />;

  const totals: BillRangeTotals = summary[range];
  const rangeLabel = RANGE_OPTIONS.find((r) => r.key === range)!.label;

  return (
    <div className="card-light rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-ink-primary">Summary</h3>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex items-center gap-1 text-xs font-medium text-ink-secondary hover:text-ink-primary transition-colors">
              {rangeLabel}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" className="min-w-40 rounded-xl bg-paper-card border border-line shadow-soft py-1.5 z-40">
              {RANGE_OPTIONS.map((r) => (
                <DropdownMenu.Item
                  key={r.key}
                  onSelect={() => setRange(r.key)}
                  className="px-3.5 py-2 text-xs font-medium text-ink-secondary hover:bg-paper-subtle hover:text-ink-primary cursor-pointer outline-none transition-colors"
                >
                  {r.label}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs text-ink-secondary">
            <span className="w-6 h-6 rounded-full bg-paper-subtle flex items-center justify-center"><Receipt className="w-3.5 h-3.5 text-ink-primary" /></span>
            Total Bills
          </span>
          <span className="text-sm font-semibold text-ink-primary tabular-nums">{formatCurrency(totals.total, 'INR', true)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs text-ink-secondary">
            <span className="w-6 h-6 rounded-full bg-updown-up-muted flex items-center justify-center"><CheckCircle2 className="w-3.5 h-3.5 text-updown-up" /></span>
            Paid
          </span>
          <span className="text-sm font-semibold text-updown-up tabular-nums">{formatCurrency(totals.paid, 'INR', true)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs text-ink-secondary">
            <span className="w-6 h-6 rounded-full bg-paper-subtle flex items-center justify-center"><Clock className="w-3.5 h-3.5 text-ink-primary" /></span>
            Upcoming
          </span>
          <span className="text-sm font-semibold text-ink-primary tabular-nums">{formatCurrency(totals.upcoming + totals.dueToday, 'INR', true)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs text-ink-secondary">
            <span className="w-6 h-6 rounded-full bg-updown-down-muted flex items-center justify-center"><AlertTriangle className="w-3.5 h-3.5 text-updown-down" /></span>
            Overdue
          </span>
          <span className="text-sm font-semibold text-updown-down tabular-nums">{formatCurrency(totals.overdue, 'INR', true)}</span>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-paper-subtle p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-ink-primary">Total Due {rangeLabel}</p>
          <p className="text-2xl font-bold text-ink-primary tabular-nums mt-0.5">{formatCurrency(totals.remaining, 'INR', true)}</p>
          <p className="text-xs text-ink-muted mt-1">{totals.count} bill{totals.count === 1 ? '' : 's'} due {rangeLabel.toLowerCase()}</p>
        </div>
        <span className="w-9 h-9 rounded-full bg-paper-card border border-line flex items-center justify-center shrink-0">
          <CalendarClock className="w-4 h-4 text-ink-primary" />
        </span>
      </div>
    </div>
  );
}
