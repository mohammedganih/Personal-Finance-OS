'use client';

import { useBudgets } from '@/hooks/useBudgets';
import { BUDGET_STATUS_COLOR } from '@/lib/budgetStatusMeta';
import { formatCurrency } from '@/lib/format';

const TOP_N = 3;

/** Ranked by real utilization (progressPct), not limited to formally
 * "over" budgets -- a category at 75% deserves a look even if it hasn't
 * crossed the over-budget line yet, same as the reference's own list
 * (which includes a 75%-utilized, still-under-budget category). */
export function TopOverspentCategories({ onViewAll }: { onViewAll: () => void }) {
  const { data: budgets, isLoading } = useBudgets();

  if (isLoading) return <div className="card-light rounded-2xl h-64 shimmer" />;

  const ranked = [...(budgets ?? [])].filter((b) => b.spent > 0).sort((a, b) => b.progressPct - a.progressPct);
  if (ranked.length === 0) return null;

  const top = ranked.slice(0, TOP_N);

  return (
    <div className="card-light rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-ink-primary">Top Overspent Categories</h3>
        {ranked.length > TOP_N && (
          <button onClick={onViewAll} className="text-xs font-medium text-ink-muted hover:text-ink-primary transition-colors">
            View All
          </button>
        )}
      </div>

      <div className="space-y-3.5">
        {top.map((budget) => {
          const color = BUDGET_STATUS_COLOR[budget.status];
          const pct = Math.min(100, budget.progressPct);
          return (
            <div key={budget.id}>
              <div className="flex items-center gap-2.5 mb-1.5">
                <span className="w-7 h-7 rounded-lg bg-paper-subtle flex items-center justify-center text-sm shrink-0">
                  {budget.category.icon ?? '💰'}
                </span>
                <span className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-ink-primary truncate">{budget.category.name}</p>
                  <p className="text-[11px] text-ink-muted truncate">
                    {formatCurrency(budget.spent, 'INR', true)} of {formatCurrency(budget.monthlyLimit, 'INR', true)}
                  </p>
                </span>
                <span className="text-xs font-semibold tabular-nums shrink-0" style={{ color }}>{budget.progressPct.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 bg-paper-subtle rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
