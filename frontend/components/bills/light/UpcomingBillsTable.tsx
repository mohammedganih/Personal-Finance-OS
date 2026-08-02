'use client';

import { useMemo, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MoreVertical, ChevronDown } from 'lucide-react';
import { useBills, useBillsCalendar, usePayBillOccurrence, useSkipBillOccurrence, useUndoBillOccurrence } from '@/hooks/useBills';
import { usePeriodStore } from '@/stores/period.store';
import { billCategoryIcon, billCategoryColor } from '@/lib/billCategoryMeta';
import { formatCurrency, formatDate, getDaysUntil } from '@/lib/format';
import { BillOccurrenceStatus } from '@/types';
import { cn } from '@/lib/utils';

const TABS = ['All', 'Due Soon', 'Paid', 'Upcoming', 'Overdue'] as const;
type Tab = (typeof TABS)[number];

const STATUS_LABEL: Record<BillOccurrenceStatus, string> = {
  PAID: 'Paid', SKIPPED: 'Skipped', PAUSED: 'Paused', OVERDUE: 'Overdue', DUE_TODAY: 'Due Today', UPCOMING: 'Upcoming',
};

const STATUS_COLOR: Record<BillOccurrenceStatus, string> = {
  PAID: '#0CA30C', SKIPPED: '#898781', PAUSED: '#898781', OVERDUE: '#D03B3B', DUE_TODAY: '#B45309', UPCOMING: '#52514E',
};

const VISIBLE_ROWS = 8;

function dueLabel(dueInDays: number): string {
  if (dueInDays < 0) return `${Math.abs(dueInDays)}d overdue`;
  if (dueInDays === 0) return 'Today';
  return `In ${dueInDays} days`;
}

function RowMenu({ children }: { children: React.ReactNode }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-paper-subtle transition-colors">
          <MoreVertical className="w-4 h-4" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" className="min-w-36 rounded-xl bg-paper-card border border-line shadow-soft py-1.5 z-40">
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MenuItem({ onSelect, children }: { onSelect: () => void; children: React.ReactNode }) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className="px-3.5 py-2 text-xs font-medium text-ink-secondary hover:bg-paper-subtle hover:text-ink-primary cursor-pointer outline-none transition-colors"
    >
      {children}
    </DropdownMenu.Item>
  );
}

/**
 * Each row is a real occurrence from getBillsCalendar (backend-computed
 * status via billSchedule.ts's projectOccurrences), scoped to the header's
 * selected period -- not a client-invented label. Bank/account subtext
 * joins in from useBills() since BillCalendarOccurrence itself doesn't
 * carry that linkage.
 */
export function UpcomingBillsTable() {
  const { month, year } = usePeriodStore();
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = formatDate(new Date(year, month, 0), 'yyyy-MM-dd');

  const { data: occurrences, isLoading } = useBillsCalendar(start, end);
  const { data: bills } = useBills();
  const { mutate: payOccurrence } = usePayBillOccurrence();
  const { mutate: skipOccurrence } = useSkipBillOccurrence();
  const { mutate: undoOccurrence } = useUndoBillOccurrence();
  const [tab, setTab] = useState<Tab>('All');
  const [expanded, setExpanded] = useState(false);

  const billsById = useMemo(() => new Map((bills ?? []).map((b) => [b.id, b])), [bills]);

  if (isLoading) return <div className="card-light rounded-2xl h-96 shimmer" />;

  const list = occurrences ?? [];
  const counts = {
    All: list.length,
    'Due Soon': list.filter((o) => (o.status === 'DUE_TODAY' || o.status === 'UPCOMING') && getDaysUntil(o.dueDate) <= 7).length,
    Paid: list.filter((o) => o.status === 'PAID').length,
    Upcoming: list.filter((o) => o.status === 'UPCOMING').length,
    Overdue: list.filter((o) => o.status === 'OVERDUE').length,
  };

  const filtered = list.filter((o) => {
    if (tab === 'All') return true;
    if (tab === 'Due Soon') return (o.status === 'DUE_TODAY' || o.status === 'UPCOMING') && getDaysUntil(o.dueDate) <= 7;
    if (tab === 'Paid') return o.status === 'PAID';
    if (tab === 'Upcoming') return o.status === 'UPCOMING';
    if (tab === 'Overdue') return o.status === 'OVERDUE';
    return true;
  });

  const visible = expanded ? filtered : filtered.slice(0, VISIBLE_ROWS);

  return (
    <div className="card-light rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-ink-primary">Upcoming Bills</h3>
        <div className="flex items-center gap-0.5 bg-paper-subtle rounded-full p-0.5 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap', tab === t ? 'bg-mono text-white' : 'text-ink-secondary hover:text-ink-primary')}
            >
              {t} {counts[t] > 0 && `(${counts[t]})`}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-sm text-ink-muted">No bills in this view</div>
      ) : (
        <>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full min-w-[680px]">
              <thead>
                <tr className="text-left">
                  <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2">Bill</th>
                  <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2">Category</th>
                  <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2">Due Date</th>
                  <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2 text-right">Amount</th>
                  <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2">Status</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visible.map((o, i) => {
                  const Icon = billCategoryIcon(o.category);
                  const color = billCategoryColor(o.category);
                  const bill = billsById.get(o.billId);
                  const subtext = bill?.creditCard
                    ? `${bill.creditCard.bank ?? 'Card'} •••• ${bill.creditCard.lastFourDigits ?? ''}`
                    : bill?.account?.name ?? o.vendor ?? undefined;
                  const daysUntil = getDaysUntil(o.dueDate);

                  return (
                    <tr key={`${o.billId}-${o.dueDate}-${i}`}>
                      <td className="px-1 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="w-9 h-9 rounded-lg bg-paper-subtle flex items-center justify-center shrink-0" style={{ color }}>
                            <Icon className="w-4 h-4" />
                          </span>
                          <span className="min-w-0">
                            <p className="text-sm font-medium text-ink-primary truncate">{o.name}</p>
                            {subtext && <p className="text-xs text-ink-muted truncate">{subtext}</p>}
                          </span>
                        </div>
                      </td>
                      <td className="px-1 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-full bg-paper-subtle px-2.5 py-1 text-[11px] font-medium text-ink-secondary">
                          {o.category}
                        </span>
                      </td>
                      <td className="px-1 py-3.5 whitespace-nowrap">
                        <p className={cn('text-sm tabular-nums', daysUntil <= 0 ? 'text-updown-down font-medium' : 'text-ink-primary')}>{formatDate(o.dueDate, 'd MMM yyyy')}</p>
                        <p className="text-xs text-ink-muted">{dueLabel(daysUntil)}</p>
                      </td>
                      <td className="px-1 py-3.5 text-right whitespace-nowrap">
                        <p className="text-sm font-semibold text-ink-primary tabular-nums">{formatCurrency(o.amount, 'INR', true)}</p>
                      </td>
                      <td className="px-1 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ color: STATUS_COLOR[o.status], background: `${STATUS_COLOR[o.status]}14` }}>
                          {STATUS_LABEL[o.status]}
                        </span>
                      </td>
                      <td className="px-1 py-3.5 text-right">
                        {(o.status === 'PAID' || o.status === 'SKIPPED') ? (
                          <RowMenu>
                            <MenuItem onSelect={() => undoOccurrence({ id: o.billId, dueDate: o.dueDate })}>Undo</MenuItem>
                          </RowMenu>
                        ) : o.status === 'PAUSED' ? null : (
                          <RowMenu>
                            <MenuItem onSelect={() => payOccurrence({ id: o.billId, dueDate: o.dueDate })}>Pay</MenuItem>
                            <MenuItem onSelect={() => skipOccurrence({ id: o.billId, dueDate: o.dueDate })}>Skip</MenuItem>
                          </RowMenu>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filtered.length > VISIBLE_ROWS && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-ink-secondary hover:text-ink-primary mt-3 pt-3 border-t border-line transition-colors"
            >
              {expanded ? 'Show Less' : 'View All Bills'}
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', expanded && 'rotate-180')} />
            </button>
          )}
        </>
      )}
    </div>
  );
}
