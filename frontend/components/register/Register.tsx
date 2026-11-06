'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';

// Register building blocks: Loans, Credit cards, Bills & subscriptions and
// Savings & investments are all the same shape -- a few key totals, a list of
// items, and a detail panel with the schedule, history and payment actions.

export interface RegisterTotal {
  label: string;
  value: ReactNode;
  /** A short line under the value (a date, what it includes). */
  note?: ReactNode;
}

/** The page: header totals, then the register itself, then anything below (e.g. closed items). */
export function RegisterPage({ totals, actions, children }: { totals: RegisterTotal[]; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl space-y-4 text-ink-primary">
      <RegisterHeader totals={totals} actions={actions} />
      {children}
    </div>
  );
}

export function RegisterHeader({ totals, actions }: { totals: RegisterTotal[]; actions?: ReactNode }) {
  return (
    <section className="card-light flex flex-wrap items-end justify-between gap-x-8 gap-y-3 px-5 py-4 text-ink-primary">
      <dl className="grid flex-1 grid-cols-2 gap-x-8 gap-y-3 sm:flex sm:flex-wrap">
        {totals.map((t) => (
          <div key={t.label} className="min-w-0">
            <dt className="text-xs text-ink-muted">{t.label}</dt>
            <dd className="text-xl font-bold tabular-nums text-ink-primary">{t.value}</dd>
            {t.note && <dd className="text-[11px] text-ink-muted">{t.note}</dd>}
          </div>
        ))}
      </dl>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </section>
  );
}

export interface RegisterColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Right-align numbers. */
  numeric?: boolean;
  /** Hidden below the sm breakpoint (the row's first column should carry what matters on a phone). */
  hideOnPhone?: boolean;
  className?: string;
}

/** A plain table; each row opens the detail drawer. Columns marked hideOnPhone drop out on narrow screens. */
export function RegisterTable<T>({ title, columns, rows, rowKey, onOpen, empty, selectedKey }: {
  title?: ReactNode;
  columns: RegisterColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onOpen?: (row: T) => void;
  empty?: ReactNode;
  selectedKey?: string | null;
}) {
  return (
    <section className="card-light overflow-hidden">
      {title && <h2 className="border-b border-line px-5 py-3 text-[15px] font-semibold text-ink-primary">{title}</h2>}
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-muted">{empty ?? 'Nothing here yet.'}</p>
      ) : (
        <table className="w-full table-fixed text-sm text-ink-primary">
          <thead>
            <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn('px-3 py-2.5 font-semibold first:pl-5 last:pr-5', c.numeric && 'text-right', c.hideOnPhone && 'hidden sm:table-cell', c.className)}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const key = rowKey(row);
              return (
                <tr
                  key={key}
                  tabIndex={onOpen ? 0 : undefined}
                  onClick={onOpen ? () => onOpen(row) : undefined}
                  onKeyDown={onOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(row); } } : undefined}
                  aria-selected={selectedKey === key || undefined}
                  className={cn('border-b border-line align-top last:border-b-0', onOpen && 'cursor-pointer hover:bg-paper-subtle focus-visible:bg-paper-subtle focus-visible:outline-none', selectedKey === key && 'bg-paper-subtle')}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn('px-3 py-3 first:pl-5 last:pr-5', c.numeric && 'text-right tabular-nums', c.hideOnPhone && 'hidden sm:table-cell', c.className)}>{c.cell(row)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** Side panel on wide screens, a full-height sheet on a phone. Escape or the backdrop closes it. */
export function DetailDrawer({ open, onClose, title, subtitle, children }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    panel.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full flex-col bg-paper-card text-ink-primary shadow-soft-hover focus:outline-none sm:max-w-lg"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-ink-primary">{title}</h2>
            {subtitle && <p className="text-xs text-ink-muted">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-ink-muted hover:bg-paper-subtle hover:text-ink-primary"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 pb-24">{children}</div>
      </div>
    </div>
  );
}

/** A titled block inside the drawer. */
export function DrawerSection({ title, action, children }: { title: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export type DueState = 'PENDING' | 'PAID' | 'AUTO' | 'SKIPPED' | 'OVERDUE' | string;
const STATE_LABEL: Record<string, string> = { PAID: 'Paid', AUTO: 'Auto-paid', SKIPPED: 'Skipped', PENDING: 'Due', OVERDUE: 'Overdue' };
const STATE_STYLE: Record<string, string> = {
  PAID: 'bg-updown-up-muted text-updown-up', AUTO: 'bg-updown-up-muted text-updown-up',
  SKIPPED: 'bg-paper-subtle text-ink-muted', PENDING: 'bg-paper-subtle text-ink-secondary', OVERDUE: 'bg-updown-down-muted text-updown-down',
};

/** "5 Nov · Due" -- the next instalment and where it stands. A pending one past its date shows as Overdue. */
export function NextDueCell({ dueDate, status, amount }: { dueDate?: string | null; status?: DueState | null; amount?: ReactNode }) {
  if (!dueDate) return <span className="text-ink-muted">—</span>;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const state = status === 'PENDING' && dueDate < today ? 'OVERDUE' : status ?? 'PENDING';
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="tabular-nums text-ink-primary">{formatDate(dueDate, 'd MMM')}</span>
      <span className={cn('rounded-full px-1.5 py-px text-[10.5px] font-medium', STATE_STYLE[state] ?? STATE_STYLE.PENDING)}>{STATE_LABEL[state] ?? state}</span>
      {amount && <span className="text-xs text-ink-muted">{amount}</span>}
    </span>
  );
}

/** Small grey label/value list for drawer summaries. */
export function Facts({ items }: { items: { label: ReactNode; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      {items.map((f, i) => (
        <div key={i} className="min-w-0">
          <dt className="text-xs text-ink-muted">{f.label}</dt>
          <dd className="truncate font-medium tabular-nums text-ink-primary">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}
