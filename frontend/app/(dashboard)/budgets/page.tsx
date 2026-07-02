'use client';

import { useState } from 'react';
import { Plus, PiggyBank, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useBudgets, useDeleteBudget } from '@/hooks/useBudgets';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatCurrency } from '@/lib/format';
import { BudgetForm } from '@/components/budgets/BudgetForm';
import { Budget, BudgetStatus } from '@/types';

const STATUS_BADGE: Record<BudgetStatus, { variant: 'success' | 'warning' | 'danger'; label: string }> = {
  under: { variant: 'success', label: 'On track' },
  near: { variant: 'warning', label: 'Near limit' },
  over: { variant: 'danger', label: 'Over budget' },
};

const STATUS_INDICATOR: Record<BudgetStatus, string> = {
  under: 'bg-success',
  near: 'bg-warning',
  over: 'bg-danger',
};

function BudgetCard({ budget, onDelete }: { budget: Budget; onDelete: () => void }) {
  const badge = STATUS_BADGE[budget.status];
  const displayPct = Math.min(budget.progressPct, 100);

  return (
    <div className="glass-card-hover rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
            style={{ background: budget.category.color ? `${budget.category.color}20` : 'rgba(124,58,237,0.1)' }}
          >
            {budget.category.icon ?? '💰'}
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">{budget.category.name}</p>
            <Badge variant={badge.variant} className="mt-0.5">{badge.label}</Badge>
          </div>
        </div>
        <button onClick={onDelete} className="p-1.5 rounded text-text-muted hover:text-danger transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div>
        <div className="flex items-end justify-between mb-2">
          <p className="text-xs text-text-secondary">
            {formatCurrency(budget.spent, 'INR', true)} of {formatCurrency(budget.monthlyLimit, 'INR', true)}
          </p>
          <p className="text-xs font-medium text-text-primary">{budget.progressPct.toFixed(0)}%</p>
        </div>
        <Progress value={displayPct} indicatorClassName={STATUS_INDICATOR[budget.status]} />
      </div>

      <p className="text-xs text-text-muted">
        {budget.remaining >= 0
          ? `${formatCurrency(budget.remaining, 'INR', true)} left this month`
          : `${formatCurrency(Math.abs(budget.remaining), 'INR', true)} over this month`}
      </p>
    </div>
  );
}

export default function BudgetsPage() {
  const [showForm, setShowForm] = useState(false);
  const { data: budgets, isLoading } = useBudgets();
  const { mutate: deleteBudget } = useDeleteBudget();

  const list = budgets ?? [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Budgets</h2>
          <p className="text-sm text-text-secondary mt-0.5">{list.length} category budgets this month</p>
        </div>
        <Button onClick={() => setShowForm(true)} size="sm">
          <Plus className="w-4 h-4 mr-1.5" /> New Budget
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass-card rounded-2xl h-40 shimmer" />)}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="No budgets yet"
          description="Set a monthly limit for a category to start tracking your spending against it"
          action={{ label: 'Create Budget', onClick: () => setShowForm(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {list.map((budget) => (
            <BudgetCard key={budget.id} budget={budget} onDelete={() => deleteBudget(budget.id)} />
          ))}
        </div>
      )}

      {showForm && <BudgetForm existingBudgets={list} onClose={() => setShowForm(false)} />}
    </div>
  );
}
