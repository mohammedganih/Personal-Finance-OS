'use client';

import { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MoreVertical, ChevronDown } from 'lucide-react';
import { useBills, usePauseBill, useResumeBill, useDeleteBill, useDuplicateBill } from '@/hooks/useBills';
import { billCategoryIcon, billCategoryColor, isSubscriptionCategory } from '@/lib/billCategoryMeta';
import { BILL_FREQUENCY_LABELS } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/format';
import { BillForm } from '@/components/bills/BillForm';
import { BillStatus, RecurringBill } from '@/types';
import { cn } from '@/lib/utils';

const TABS = ['All', 'Active', 'Paused', 'Cancelled'] as const;
type Tab = (typeof TABS)[number];

// The reference's Active/Cancelled binary is squeezed from this app's real
// 3-state bill lifecycle -- Paused kept as its own real state (temporarily
// suspended, not cancelled) rather than folded into either.
const STATUS_LABEL: Record<BillStatus, string> = { ACTIVE: 'Active', PAUSED: 'Paused', ARCHIVED: 'Cancelled' };
const STATUS_COLOR: Record<BillStatus, string> = { ACTIVE: '#0CA30C', PAUSED: '#B45309', ARCHIVED: '#898781' };

const VISIBLE_ROWS = 8;

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

function MenuItem({ onSelect, danger, children }: { onSelect: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={cn(
        'px-3.5 py-2 text-xs font-medium cursor-pointer outline-none transition-colors',
        danger ? 'text-updown-down hover:bg-updown-down-muted' : 'text-ink-secondary hover:bg-paper-subtle hover:text-ink-primary'
      )}
    >
      {children}
    </DropdownMenu.Item>
  );
}

/**
 * There's no real "is this a subscription" field -- Bills and Subscriptions
 * are the same RecurringBill table. isSubscriptionCategory() applies the
 * same Entertainment/Software/Fitness heuristic the existing bill-insights
 * engine already uses once (bill.service.ts's annual-plan nudge), just
 * consistently as the actual filter here.
 */
export function SubscriptionsTable() {
  const { data: bills, isLoading } = useBills();
  const { mutate: pauseBill } = usePauseBill();
  const { mutate: resumeBill } = useResumeBill();
  const { mutate: deleteBill } = useDeleteBill();
  const { mutate: duplicateBill } = useDuplicateBill();
  const [tab, setTab] = useState<Tab>('All');
  const [expanded, setExpanded] = useState(false);
  const [editingBill, setEditingBill] = useState<RecurringBill | null>(null);
  const [showForm, setShowForm] = useState(false);

  if (isLoading) return <div className="card-light rounded-2xl h-96 shimmer" />;

  const subscriptions = (bills ?? []).filter((b) => isSubscriptionCategory(b.category));

  const counts = {
    All: subscriptions.length,
    Active: subscriptions.filter((b) => b.effectiveStatus === 'ACTIVE').length,
    Paused: subscriptions.filter((b) => b.effectiveStatus === 'PAUSED').length,
    Cancelled: subscriptions.filter((b) => b.effectiveStatus === 'ARCHIVED').length,
  };

  const filtered = subscriptions.filter((b) => {
    if (tab === 'All') return true;
    if (tab === 'Active') return b.effectiveStatus === 'ACTIVE';
    if (tab === 'Paused') return b.effectiveStatus === 'PAUSED';
    if (tab === 'Cancelled') return b.effectiveStatus === 'ARCHIVED';
    return true;
  });

  const visible = expanded ? filtered : filtered.slice(0, VISIBLE_ROWS);

  return (
    <div className="card-light rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-ink-primary">Subscriptions</h3>
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

      {subscriptions.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-sm text-ink-muted">No subscriptions tracked yet</div>
      ) : filtered.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-sm text-ink-muted">Nothing in this view</div>
      ) : (
        <>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full min-w-[680px]">
              <thead>
                <tr className="text-left">
                  <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2">Subscription</th>
                  <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2">Category</th>
                  <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2">Billing Cycle</th>
                  <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2 text-right">Amount</th>
                  <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2">Next Billing</th>
                  <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2">Status</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visible.map((b) => {
                  const Icon = billCategoryIcon(b.category);
                  const color = billCategoryColor(b.category);

                  return (
                    <tr key={b.id}>
                      <td className="px-1 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="w-9 h-9 rounded-lg bg-paper-subtle flex items-center justify-center shrink-0" style={{ color }}>
                            <Icon className="w-4 h-4" />
                          </span>
                          <span className="min-w-0">
                            <p className="text-sm font-medium text-ink-primary truncate">{b.name}</p>
                            {b.vendor && <p className="text-xs text-ink-muted truncate">{b.vendor}</p>}
                          </span>
                        </div>
                      </td>
                      <td className="px-1 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-full bg-paper-subtle px-2.5 py-1 text-[11px] font-medium text-ink-secondary">
                          {b.category}
                        </span>
                      </td>
                      <td className="px-1 py-3.5 whitespace-nowrap text-sm text-ink-primary">
                        {BILL_FREQUENCY_LABELS[b.frequency] ?? b.frequency}
                      </td>
                      <td className="px-1 py-3.5 text-right whitespace-nowrap text-sm font-semibold text-ink-primary tabular-nums">
                        {formatCurrency(b.amount, 'INR', true)}
                      </td>
                      <td className="px-1 py-3.5 whitespace-nowrap">
                        {b.nextDueDate ? (
                          <>
                            <p className="text-sm text-ink-primary tabular-nums">{formatDate(b.nextDueDate, 'd MMM yyyy')}</p>
                            <p className="text-xs text-ink-muted">{b.dueInDays !== null ? `in ${b.dueInDays}d` : ''}</p>
                          </>
                        ) : (
                          <span className="text-sm text-ink-muted">—</span>
                        )}
                      </td>
                      <td className="px-1 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ color: STATUS_COLOR[b.effectiveStatus], background: `${STATUS_COLOR[b.effectiveStatus]}14` }}>
                          {STATUS_LABEL[b.effectiveStatus]}
                        </span>
                      </td>
                      <td className="px-1 py-3.5 text-right">
                        <RowMenu>
                          {b.effectiveStatus === 'PAUSED' ? (
                            <MenuItem onSelect={() => resumeBill(b.id)}>Resume</MenuItem>
                          ) : b.effectiveStatus === 'ACTIVE' ? (
                            <MenuItem onSelect={() => pauseBill({ id: b.id })}>Pause</MenuItem>
                          ) : null}
                          <MenuItem onSelect={() => { setEditingBill(b); setShowForm(true); }}>Edit</MenuItem>
                          <MenuItem onSelect={() => duplicateBill(b.id)}>Duplicate</MenuItem>
                          <MenuItem danger onSelect={() => deleteBill(b.id)}>Delete</MenuItem>
                        </RowMenu>
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
              {expanded ? 'Show Less' : 'View All Subscriptions'}
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', expanded && 'rotate-180')} />
            </button>
          )}
        </>
      )}

      {showForm && <BillForm onClose={() => { setShowForm(false); setEditingBill(null); }} bill={editingBill ?? undefined} />}
    </div>
  );
}
