'use client';

import Link from 'next/link';
import { ArrowRight, PiggyBank } from 'lucide-react';
import { useBudgets } from '@/hooks/useBudgets';
import { Progress } from '@/components/ui/progress';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import { formatCurrency } from '@/lib/format';
import { BudgetStatus } from '@/types';

const STATUS_INDICATOR: Record<BudgetStatus, string> = {
  under: 'bg-success',
  near: 'bg-warning',
  over: 'bg-danger',
};

const MAX_SHOWN = 4;

export function BudgetOverview() {
  const { data: budgets, isLoading } = useBudgets();

  if (isLoading) {
    return (
      <div className="glass-card rounded-2xl p-5">
        <TableSkeleton rows={3} />
      </div>
    );
  }

  const list = budgets ?? [];

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Budgets</h3>
          <p className="text-xs text-text-secondary mt-0.5">This month by category</p>
        </div>
        <Link href="/budgets" className="text-xs text-accent-violet-light hover:underline flex items-center gap-1">
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <PiggyBank className="w-8 h-8 text-text-muted mb-2" />
          <p className="text-xs text-text-muted">No budgets set yet</p>
          <Link href="/budgets" className="text-xs text-accent-violet-light hover:underline mt-1">
            Create your first budget
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {list.slice(0, MAX_SHOWN).map((budget) => (
            <div key={budget.id} className="animate-fade-in">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-text-secondary flex items-center gap-1.5 truncate">
                  <span>{budget.category.icon}</span> {budget.category.name}
                </p>
                <p className="text-xs font-medium text-text-primary font-mono shrink-0">
                  {formatCurrency(budget.spent, 'INR', true)} / {formatCurrency(budget.monthlyLimit, 'INR', true)}
                </p>
              </div>
              <Progress
                value={Math.min(budget.progressPct, 100)}
                className="h-1.5"
                indicatorClassName={STATUS_INDICATOR[budget.status]}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
