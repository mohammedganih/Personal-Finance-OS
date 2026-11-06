'use client';

import { useState } from 'react';
import { Sparkles, TrendingUp, AlertTriangle, PiggyBank } from 'lucide-react';
import { useBudgets } from '@/hooks/useBudgets';
import { formatCurrency } from '@/lib/format';
import { Budget } from '@/types';
import { BudgetForm } from '@/components/budgets/BudgetForm';

/**
 * Computed purely from real Budget fields (progressPct, remaining, status)
 * -- no bulk insights endpoint exists for budgets, unlike Goals/Loans, so
 * this stays close to the pattern those pages established: real numbers,
 * no invented "vs average" framing that can't be honestly computed.
 */
export function BudgetInsightsLight() {
  const { data: budgets, isLoading } = useBudgets();
  const [editing, setEditing] = useState<Budget | null>(null);

  if (isLoading) return <div className="card-light rounded-2xl h-64 shimmer" />;

  const list = budgets ?? [];
  if (list.length === 0) return null;

  const onTrackCount = list.filter((b) => b.status === 'under').length;
  const worstOver = [...list].filter((b) => b.status !== 'under').sort((a, b) => b.progressPct - a.progressPct)[0];
  const biggestUnder = [...list].filter((b) => b.status === 'under' && b.remaining > 0).sort((a, b) => b.remaining - a.remaining)[0];

  return (
    <div className="card-light rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-mono" />
        <h3 className="text-sm font-semibold text-ink-primary">Budget Insights</h3>
      </div>

      <div className="space-y-3">
        {onTrackCount > 0 && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-paper-subtle flex items-center justify-center shrink-0">
              <TrendingUp className="w-3.5 h-3.5" style={{ color: '#0CA30C' }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-ink-primary">You&apos;re doing great!</p>
              <p className="text-xs text-ink-secondary leading-relaxed mt-0.5">
                {onTrackCount} categor{onTrackCount === 1 ? 'y is' : 'ies are'} on track this month.
              </p>
            </div>
          </div>
        )}

        {worstOver && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-paper-subtle flex items-center justify-center shrink-0">
              <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#B45309' }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-ink-primary">{worstOver.category.name} is at {worstOver.progressPct.toFixed(0)}% of its budget.</p>
              <p className="text-xs text-ink-secondary leading-relaxed mt-0.5">
                Consider setting a lower limit next month.{' '}
                <button type="button" onClick={() => setEditing(worstOver)} className="text-ink-primary font-medium hover:underline">
                  Adjust Budget →
                </button>
              </p>
            </div>
          </div>
        )}

        {biggestUnder && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-paper-subtle flex items-center justify-center shrink-0">
              <PiggyBank className="w-3.5 h-3.5 text-mono" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-ink-primary">You can save {formatCurrency(biggestUnder.remaining, 'INR', true)} in {biggestUnder.category.name}.</p>
              <p className="text-xs text-ink-secondary leading-relaxed mt-0.5">
                You&apos;re under budget in this category.{' '}
                <button type="button" onClick={() => setEditing(biggestUnder)} className="text-ink-primary font-medium hover:underline">
                  Reallocate Budget →
                </button>
              </p>
            </div>
          </div>
        )}
      </div>

      {editing && <BudgetForm existingBudgets={list} budget={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
