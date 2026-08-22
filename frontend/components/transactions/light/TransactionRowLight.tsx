'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MoreVertical } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { Transaction } from '@/types';
import { cn } from '@/lib/utils';

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
 * One transaction row, shared between Recent Transactions (Overview tab)
 * and the day-grouped All/Income/Expense lists -- same real fields
 * (category, member, account) in both places, so one shape covers both
 * rather than a second, thinner row type. Note/split expansion from the
 * old dark TransactionTile is dropped here; editing already surfaces both.
 */
export function TransactionRowLight({ transaction: t, onEdit, onDelete }: {
  transaction: Transaction;
  onEdit: (t: Transaction) => void;
  onDelete: (id: string) => void;
}) {
  const isIncome = t.type === 'INCOME';
  const catColor = t.category?.color ?? '#8b8fa3';

  return (
    <div className="flex items-center gap-3 py-3 group">
      <span
        className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
        style={{ background: `${catColor}1F` }}
      >
        {t.category?.icon ?? (isIncome ? '💰' : '💸')}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-primary truncate">{t.description || t.category?.name || 'Transaction'}</p>
        <p className="text-xs text-ink-muted truncate">{t.category?.name ?? '—'}</p>
      </div>

      {t.category && (
        <span
          className="hidden sm:inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap"
          style={{ color: catColor, background: `${catColor}1F` }}
        >
          {t.category.name}
        </span>
      )}

      {t.member && (
        <span
          className="hidden md:flex w-7 h-7 rounded-full items-center justify-center text-sm shrink-0"
          style={{ background: t.member.color ?? '#8b8fa3' }}
          title={t.member.name}
        >
          {t.member.emoji ?? '👤'}
        </span>
      )}

      <div className="hidden lg:block w-28 shrink-0">
        <p className="text-xs text-ink-secondary truncate">{t.account?.name ?? '—'}</p>
      </div>

      <div className="hidden sm:block w-24 shrink-0 text-right">
        <p className="text-xs text-ink-primary whitespace-nowrap">{formatDate(t.date, 'd MMM yyyy')}</p>
        <p className="text-[11px] text-ink-muted whitespace-nowrap">{formatDate(t.date, 'h:mm a')}</p>
      </div>

      <p className={cn('text-sm font-semibold tabular-nums shrink-0 w-24 text-right whitespace-nowrap', isIncome ? 'text-updown-up' : 'text-updown-down')}>
        {isIncome ? '+' : '-'}{formatCurrency(t.amount, 'INR', true)}
      </p>

      <div className="shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <RowMenu>
          <MenuItem onSelect={() => onEdit(t)}>Edit</MenuItem>
          <MenuItem danger onSelect={() => onDelete(t.id)}>Delete</MenuItem>
        </RowMenu>
      </div>
    </div>
  );
}
