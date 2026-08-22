'use client';

import { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MoreVertical, Plus } from 'lucide-react';
import { useBudgets, useDeleteBudget } from '@/hooks/useBudgets';
import { BUDGET_STATUS_LABEL, BUDGET_STATUS_COLOR } from '@/lib/budgetStatusMeta';
import { formatCurrency } from '@/lib/format';
import { Budget, BudgetStatus } from '@/types';
import { cn } from '@/lib/utils';
import { BudgetForm } from '@/components/budgets/BudgetForm';

export const BUDGET_TABS = ['All Categories', 'On Track', 'Watch Out', 'Over Budget'] as const;
export type BudgetTab = (typeof BUDGET_TABS)[number];

const TAB_STATUS: Record<BudgetTab, BudgetStatus | undefined> = {
  'All Categories': undefined, 'On Track': 'under', 'Watch Out': 'near', 'Over Budget': 'over',
};

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

function BudgetRow({ budget, onEdit, onDelete }: { budget: Budget; onEdit: (b: Budget) => void; onDelete: (id: string) => void }) {
  const pct = Math.min(100, budget.progressPct);
  const color = BUDGET_STATUS_COLOR[budget.status];

  return (
    <tr id={`budget-row-${budget.id}`}>
      <td className="px-1 py-3.5">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg bg-paper-subtle flex items-center justify-center text-base shrink-0">
            {budget.category.icon ?? '💰'}
          </span>
          <span className="min-w-0">
            <p className="text-sm font-medium text-ink-primary truncate">{budget.category.name}</p>
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium mt-0.5"
              style={{ color, background: `${color}1F` }}
            >
              {BUDGET_STATUS_LABEL[budget.status]}
            </span>
          </span>
        </div>
      </td>
      <td className="px-1 py-3.5 whitespace-nowrap">
        <p className="text-sm text-ink-primary tabular-nums">{formatCurrency(budget.monthlyLimit, 'INR', true)}</p>
      </td>
      <td className="px-1 py-3.5 whitespace-nowrap">
        <p className="text-sm text-ink-primary tabular-nums">{formatCurrency(budget.spent, 'INR', true)}</p>
      </td>
      <td className="px-1 py-3.5 whitespace-nowrap">
        <p className={cn('text-sm tabular-nums', budget.remaining < 0 ? 'text-updown-down' : 'text-ink-primary')}>
          {budget.remaining < 0 ? `-${formatCurrency(Math.abs(budget.remaining), 'INR', true)}` : formatCurrency(budget.remaining, 'INR', true)}
        </p>
      </td>
      <td className="px-1 py-3.5 min-w-32">
        <span className="text-xs font-semibold text-ink-primary tabular-nums block mb-1">{budget.progressPct.toFixed(0)}%</span>
        <div className="h-1.5 bg-paper-subtle rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
        </div>
      </td>
      <td className="px-1 py-3.5 text-right">
        <RowMenu>
          <MenuItem onSelect={() => onEdit(budget)}>Edit Limit</MenuItem>
          <MenuItem danger onSelect={() => onDelete(budget.id)}>Delete</MenuItem>
        </RowMenu>
      </td>
    </tr>
  );
}

/**
 * Reference's Needs/Wants/Savings & Investments tabs have no backing data
 * -- Category has no spend-type field, the same gap already flagged and
 * skipped on Analytics/the Dashboard's CashFlowSankey. Swapped for tabs
 * over the real BudgetStatus instead (On Track/Watch Out/Over Budget,
 * backend/src/services/budget.service.ts's own under/near/over) -- same
 * tabbed-grouping interaction, backed by a real field.
 */
export function BudgetCategoryTable({ tab, onTabChange }: { tab: BudgetTab; onTabChange: (t: BudgetTab) => void }) {
  const { data: budgets, isLoading } = useBudgets();
  const { mutate: deleteBudget } = useDeleteBudget();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);

  if (isLoading) return <div className="card-light rounded-2xl h-96 shimmer" />;

  const list = budgets ?? [];
  const counts: Record<BudgetTab, number> = {
    'All Categories': list.length,
    'On Track': list.filter((b) => b.status === 'under').length,
    'Watch Out': list.filter((b) => b.status === 'near').length,
    'Over Budget': list.filter((b) => b.status === 'over').length,
  };
  const filtered = tab === 'All Categories' ? list : list.filter((b) => b.status === TAB_STATUS[tab]);

  return (
    <div className="card-light rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-ink-primary mb-4">Budget by Category</h3>

      <div className="flex items-center gap-0.5 bg-paper-subtle rounded-full p-0.5 flex-wrap mb-4">
        {BUDGET_TABS.map((t) => (
          <button
            key={t}
            onClick={() => onTabChange(t)}
            className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap', tab === t ? 'bg-mono text-white' : 'text-ink-secondary hover:text-ink-primary')}
          >
            {t} {counts[t] > 0 && `(${counts[t]})`}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="h-40 flex flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm text-ink-muted">No category budgets yet</p>
          <p className="text-xs text-ink-muted">Set a limit on your biggest category to start tracking</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-sm text-ink-muted">No categories in this view</div>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="text-left">
                <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2">Category</th>
                <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2">Budgeted</th>
                <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2">Spent</th>
                <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2">Remaining</th>
                <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2">Utilization</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((budget) => (
                <BudgetRow key={budget.id} budget={budget} onEdit={setEditing} onDelete={deleteBudget} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        onClick={() => setShowForm(true)}
        className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-ink-secondary hover:text-ink-primary mt-3 pt-3 border-t border-line transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Add New Category
      </button>

      {(showForm || editing) && (
        <BudgetForm existingBudgets={list} budget={editing ?? undefined} onClose={() => { setShowForm(false); setEditing(null); }} />
      )}
    </div>
  );
}
