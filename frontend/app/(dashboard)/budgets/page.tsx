'use client';

import { useState } from 'react';
import { Plus, PiggyBank, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { SnapshotBar } from '@/components/dashboard/SnapshotBar';
import { SafeToSpendHero } from '@/components/budgets/SafeToSpendHero';
import { BurnRateCard } from '@/components/budgets/BurnRateCard';
import { BudgetsAIInsightStack } from '@/components/budgets/BudgetsAIInsightStack';
import { useBudgets, useDeleteBudget } from '@/hooks/useBudgets';
import { computeBudgetPacing } from '@/lib/budgetPacing';
import { formatCurrency } from '@/lib/format';
import { BudgetForm } from '@/components/budgets/BudgetForm';
import { Budget, BudgetStatus } from '@/types';
import { cn } from '@/lib/utils';

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

const STATUS_GROUPS: { status: BudgetStatus; icon: string; label: string }[] = [
  { status: 'over', icon: '🔴', label: 'Over budget' },
  { status: 'near', icon: '🟡', label: 'Near limit' },
  { status: 'under', icon: '🟢', label: 'On track' },
];

function BudgetTile({ budget, elapsedPct, isHighlighted, onDelete }: {
  budget: Budget; elapsedPct: number; isHighlighted: boolean; onDelete: () => void;
}) {
  const badge = STATUS_BADGE[budget.status];
  const displayPct = Math.min(budget.progressPct, 100);

  return (
    <div
      id={`budget-${budget.id}`}
      className={cn(
        'glass-card-hover rounded-2xl p-5 space-y-4 transition-shadow duration-300',
        isHighlighted && 'ring-2 ring-accent-violet/60'
      )}
    >
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
        <button aria-label={`Delete ${budget.category.name} budget`} onClick={onDelete} className="p-1.5 rounded text-text-muted hover:text-danger transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div>
        <div className="flex items-end justify-between mb-2">
          <p className="text-xs text-text-secondary">
            {formatCurrency(budget.spent, 'INR', true)} of {formatCurrency(budget.monthlyLimit, 'INR', true)} · {elapsedPct.toFixed(0)}% of month elapsed
          </p>
          <p className="text-xs font-medium text-text-primary">{budget.progressPct.toFixed(0)}%</p>
        </div>
        {/* Pace tick -- same time-elapsed marker as a loan's progress bar,
            applied to this category's spend instead of loan tenure. */}
        <div className="relative">
          <Progress value={displayPct} indicatorClassName={STATUS_INDICATOR[budget.status]} />
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-text-primary/40"
            style={{ left: `${Math.min(elapsedPct, 99)}%` }}
            title={`Day ${elapsedPct.toFixed(0)}% into the month — you'd expect ${elapsedPct.toFixed(0)}% spent by now`}
          />
        </div>
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
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const { data: budgets, isLoading } = useBudgets();
  const { mutate: deleteBudget } = useDeleteBudget();

  const list = budgets ?? [];
  const elapsedPct = list.length > 0 ? computeBudgetPacing(list).elapsedPct : 0;

  const scrollToBudget = (budgetId: string) => {
    setHighlightedId(budgetId);
    document.getElementById(`budget-${budgetId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => setHighlightedId((cur) => (cur === budgetId ? null : cur)), 1600);
  };

  // Grouped by status -- the one thing worth acting on (over budget) is
  // always first, not alphabetical or creation order.
  const grouped = STATUS_GROUPS.map((g) => ({ ...g, items: list.filter((b) => b.status === g.status) })).filter((g) => g.items.length > 0);

  return (
    <PageShell>
      <PageHeader
        title="Budgets"
        subtitle={`${list.length} category budgets this month`}
        action={
          <Button onClick={() => setShowForm(true)} size="sm">
            <Plus className="w-4 h-4 mr-1.5" /> New Budget
          </Button>
        }
      />

      {/* Tier 1: the safe-to-spend number and pacing verdict answer "am I
          okay" without a click -- stays visible even with zero budgets. */}
      <SafeToSpendHero />

      {/* Tier 2: where income is committed -- the same bar as Dashboard's snapshot. */}
      <SnapshotBar
        title="Where your income is committed"
        footnote="Expenses, bills, EMIs and investments each use whichever is higher: what's already logged this month, or what you're committed to pay — so nothing due is missed just because it hasn't been paid yet."
      />

      {isLoading ? (
        <div className="space-y-4">
          <div className="glass-card rounded-2xl h-32 shimmer" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass-card rounded-2xl h-40 shimmer" />)}
          </div>
        </div>
      ) : list.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center space-y-3">
          <PiggyBank className="w-10 h-10 text-text-muted mx-auto" />
          <div>
            <p className="text-base font-semibold text-text-primary">No category budgets yet</p>
            <p className="text-sm text-text-secondary mt-1">Set a limit on your biggest category first — the safe-to-spend number above doesn&apos;t need one, but a pace worth watching does.</p>
          </div>
          <Button onClick={() => setShowForm(true)} size="sm">
            <Plus className="w-4 h-4 mr-1.5" /> Create Budget
          </Button>
        </div>
      ) : (
        <>
          {/* Tier 3: why the number is what it is, and the one action worth taking. */}
          <div className="grid lg:grid-cols-2 gap-4">
            <BurnRateCard onSelectBudget={scrollToBudget} />
            <BudgetsAIInsightStack />
          </div>

          {/* Tier 4: category budgets, grouped by status -- not by name. */}
          <div className="space-y-6">
            {grouped.map((g) => (
              <div key={g.status}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{g.icon}</span>
                  <h3 className="text-sm font-semibold text-text-secondary">{g.label}</h3>
                  <span className="text-xs text-text-muted">({g.items.length})</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {g.items.map((budget) => (
                    <BudgetTile
                      key={budget.id} budget={budget} elapsedPct={elapsedPct}
                      isHighlighted={highlightedId === budget.id}
                      onDelete={() => deleteBudget(budget.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showForm && <BudgetForm existingBudgets={list} onClose={() => setShowForm(false)} />}
    </PageShell>
  );
}
