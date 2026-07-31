'use client';

import { useState } from 'react';
import { Pencil, Trash2, ChevronRight } from 'lucide-react';
import { MemberBadge } from '@/components/shared/MemberSelector';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format';
import { Transaction } from '@/types';
import { cn } from '@/lib/utils';

interface TransactionTileProps {
  transaction: Transaction;
  onEdit: (t: Transaction) => void;
  onDelete: (id: string) => void;
}

/**
 * One row in a day-grouped transaction list. Expands in place to show notes
 * and the split breakdown -- the only way to see notes at all, since the
 * form is the sole place that writes them.
 */
export function TransactionTile({ transaction: t, onEdit, onDelete }: TransactionTileProps) {
  const [expanded, setExpanded] = useState(false);
  const isIncome = t.type === 'INCOME';
  const hasDetail = Boolean(t.notes) || Boolean(t.splitMember);

  const toggle = () => hasDetail && setExpanded((v) => !v);

  return (
    <div className="border-b border-border last:border-b-0">
      <div
        role={hasDetail ? 'button' : undefined}
        tabIndex={hasDetail ? 0 : undefined}
        aria-expanded={hasDetail ? expanded : undefined}
        onClick={toggle}
        onKeyDown={(e) => {
          if (hasDetail && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            toggle();
          }
        }}
        className={cn(
          'flex items-center gap-3 px-4 py-3 group',
          hasDetail && 'cursor-pointer hover:bg-bg-elevated/50 transition-colors'
        )}
      >
        <div
          className={cn(
            'w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0',
            isIncome ? 'bg-success/10' : 'bg-danger/10'
          )}
        >
          {t.category?.icon ?? (isIncome ? '💰' : '💸')}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-medium text-text-primary truncate">
              {t.description || t.category?.name || 'Transaction'}
            </p>
            {t.isRecurring && <Badge variant="secondary" className="text-xs">Recurring</Badge>}
            <MemberBadge member={t.member} splitMember={t.splitMember} splitRatio={t.splitRatio ?? undefined} />
          </div>
          <p className="text-xs text-text-muted truncate mt-0.5">
            {t.category?.name ?? '—'}
            {t.account ? ` · ${t.account.name}` : ''}
          </p>
        </div>

        <p
          className={cn(
            'text-sm font-semibold font-mono whitespace-nowrap',
            isIncome ? 'text-success' : 'text-danger'
          )}
        >
          {isIncome ? '+' : '-'}
          {formatCurrency(t.amount, 'INR', true)}
        </p>

        {hasDetail && (
          <ChevronRight
            className={cn('w-3.5 h-3.5 text-text-muted transition-transform shrink-0', expanded && 'rotate-90')}
          />
        )}

        {/* Always visible below sm: hover-reveal has no equivalent on touch. */}
        <div
          className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onEdit(t)}
            aria-label={`Edit ${t.description || 'transaction'}`}
            className="p-1.5 rounded-lg text-text-muted hover:text-accent-violet-light hover:bg-accent-violet/10 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(t.id)}
            aria-label={`Delete ${t.description || 'transaction'}`}
            className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {expanded && hasDetail && (
        <div className="px-4 pb-3 pl-16 -mt-1 space-y-1.5 text-xs text-text-secondary">
          {t.notes && <p className="whitespace-pre-wrap">{t.notes}</p>}
          {t.splitMember && t.member && (
            <p className="text-text-muted">
              Split: {t.member.name} {t.splitRatio ?? 50}% · {t.splitMember.name} {100 - (t.splitRatio ?? 50)}%
            </p>
          )}
        </div>
      )}
    </div>
  );
}
