'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Check, Users } from 'lucide-react';
import { useP2PLoans, useP2PSummary, useUpdateP2PLoan, useDeleteP2PLoan } from '@/hooks/useP2P';
import { formatCurrency, getDaysUntil } from '@/lib/format';
import { P2PForm } from '@/components/loans/P2PForm';
import { P2PLoan } from '@/types';
import { cn } from '@/lib/utils';

/**
 * Compact restyle of the dark P2PGroup's exact data path -- P2P borrowed/lent
 * money isn't really a "loan" (lend/borrow/settle semantics the reference's
 * Loan Overview donut doesn't model) and has no other home in the app, so it
 * keeps its own small section here rather than being folded into or dropped
 * from the redesign.
 */
export function P2PSummaryCard() {
  const { data: loans, isLoading } = useP2PLoans();
  const { data: summary } = useP2PSummary();
  const { mutate: updateLoan } = useUpdateP2PLoan();
  const { mutate: deleteLoan } = useDeleteP2PLoan();
  const [showForm, setShowForm] = useState(false);
  const [editingLoan, setEditingLoan] = useState<P2PLoan | null>(null);

  if (isLoading) return <div className="card-light rounded-2xl h-48 shimmer" />;

  const active = (loans ?? []).filter((l) => !l.isSettled);

  return (
    <div className="card-light rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-mono" />
          <h3 className="text-sm font-semibold text-ink-primary">Peer-to-Peer</h3>
        </div>
        <button
          onClick={() => { setEditingLoan(null); setShowForm(true); }}
          className="flex items-center gap-1 rounded-full bg-paper-subtle hover:bg-line text-ink-primary text-xs font-medium px-3 py-1.5 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Entry
        </button>
      </div>

      {summary && active.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-xl bg-paper-subtle p-3">
            <p className="text-xs text-ink-muted">Lent (they owe me)</p>
            <p className="text-sm font-semibold text-updown-up tabular-nums mt-0.5">{formatCurrency(summary.totalLent, 'INR', true)}</p>
          </div>
          <div className="rounded-xl bg-paper-subtle p-3">
            <p className="text-xs text-ink-muted">Borrowed (I owe)</p>
            <p className="text-sm font-semibold text-updown-down tabular-nums mt-0.5">{formatCurrency(summary.totalBorrowed, 'INR', true)}</p>
          </div>
          <div className="rounded-xl bg-paper-subtle p-3">
            <p className="text-xs text-ink-muted">Net Position</p>
            <p className={cn('text-sm font-semibold tabular-nums mt-0.5', summary.net >= 0 ? 'text-updown-up' : 'text-updown-down')}>
              {summary.net >= 0 ? '+' : ''}{formatCurrency(summary.net, 'INR', true)}
            </p>
          </div>
        </div>
      )}

      {active.length === 0 ? (
        <p className="text-sm text-ink-muted text-center py-4">No money lent or borrowed right now</p>
      ) : (
        <div className="space-y-2">
          {active.map((loan) => {
            const isLent = loan.type === 'LENT';
            const paidBack = loan.amount - loan.remainingAmount;
            const daysLeft = loan.dueDate ? getDaysUntil(loan.dueDate) : null;

            return (
              <div key={loan.id} className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-2.5">
                <span className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                  isLent ? 'bg-updown-up-muted text-updown-up' : 'bg-updown-down-muted text-updown-down')}>
                  {isLent ? '↑' : '↓'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-ink-primary truncate">{loan.personName}</p>
                    {daysLeft !== null && (
                      <span className="text-[11px] text-ink-muted whitespace-nowrap">
                        {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : `Due in ${daysLeft}d`}
                      </span>
                    )}
                  </div>
                  {loan.description && <p className="text-xs text-ink-muted truncate">{loan.description}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className={cn('text-sm font-semibold tabular-nums', isLent ? 'text-updown-up' : 'text-updown-down')}>
                    {formatCurrency(loan.remainingAmount, 'INR', true)}
                  </p>
                  {paidBack > 0 && <p className="text-[11px] text-ink-muted">{formatCurrency(paidBack, 'INR', true)} returned</p>}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button aria-label={`Mark ${loan.personName} settled`} onClick={() => updateLoan({ id: loan.id, data: { isSettled: true } })} className="p-1.5 rounded-lg text-ink-muted hover:text-updown-up hover:bg-updown-up-muted transition-colors">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button aria-label={`Edit ${loan.personName}`} onClick={() => { setEditingLoan(loan); setShowForm(true); }} className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-paper-subtle transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button aria-label={`Delete ${loan.personName}`} onClick={() => deleteLoan(loan.id)} className="p-1.5 rounded-lg text-ink-muted hover:text-updown-down hover:bg-updown-down-muted transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && <P2PForm onClose={() => { setShowForm(false); setEditingLoan(null); }} loan={editingLoan ?? undefined} />}
    </div>
  );
}
