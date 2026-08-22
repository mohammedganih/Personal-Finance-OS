'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { differenceInMonths } from 'date-fns';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MoreVertical, Plus, ArrowUpDown, Check } from 'lucide-react';
import { useGoals, useDeleteGoal, useGoalProgress } from '@/hooks/useGoals';
import { GOAL_TYPE_ICONS } from '@/lib/constants';
import { GOAL_TERMS, goalTermFor } from '@/lib/goalTermMeta';
import { formatCurrency, formatDate } from '@/lib/format';
import { Goal } from '@/types';
import { cn } from '@/lib/utils';
import { GoalForm } from '@/components/goals/GoalForm';
import { GoalContributionForm } from '@/components/goals/GoalContributionForm';

const TABS = ['All', ...GOAL_TERMS] as const;
type Tab = (typeof TABS)[number];

type SortKey = 'targetDate' | 'progress' | 'saved';
const SORT_OPTIONS: SortKey[] = ['targetDate', 'progress', 'saved'];
const SORT_LABEL: Record<SortKey, string> = {
  targetDate: 'Target Date',
  progress: 'Progress',
  saved: 'Amount Saved',
};

function timeLeftLabel(months: number): string {
  const rounded = Math.round(months);
  if (rounded <= 0) return 'Due now';
  const y = Math.floor(rounded / 12);
  const m = rounded % 12;
  const parts: string[] = [];
  if (y > 0) parts.push(`${y} year${y === 1 ? '' : 's'}`);
  if (m > 0 || y === 0) parts.push(`${m} month${m === 1 ? '' : 's'}`);
  return `${parts.join(' ')} left`;
}

// currentAmount/targetAmount ratio, same fallback computation
// useGoalProgress's own currentPct uses -- available instantly from the
// goals list so tabs/sort don't wait on N per-row fetches.
function simplePct(goal: Goal): number {
  return goal.targetAmount > 0 ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) : 0;
}

function RowMenu({ children }: { children: React.ReactNode }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-paper-subtle transition-colors">
          <MoreVertical className="w-4 h-4" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" className="min-w-44 rounded-xl bg-paper-card border border-line shadow-soft py-1.5 z-40">
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
 * Status reuses the same "expected finish date vs target date" comparison
 * the backend's getGoalInsights already makes for its warning/positive
 * insights -- recomputed here per-row from useGoalProgress(goal.id) rather
 * than adding a bulk status endpoint. Same per-row-hook convention as
 * GoalProgressLight.tsx on the Dashboard.
 */
function GoalRow({ goal, onEdit, onContribute, onDelete }: {
  goal: Goal;
  onEdit: (goal: Goal) => void;
  onContribute: (goal: Goal) => void;
  onDelete: (id: string) => void;
}) {
  const { data: progress } = useGoalProgress(goal.id);

  const pct = progress?.currentPct ?? simplePct(goal);
  const monthsLeft = differenceInMonths(new Date(goal.targetDate), new Date());
  const term = goalTermFor(goal.targetDate);
  const isAtRisk = progress
    ? (progress.expectedFinishDate === null || new Date(progress.expectedFinishDate) > new Date(goal.targetDate))
    : null;
  const barColor = goal.color || '#0B0B0B';

  return (
    <tr>
      <td className="px-1 py-3.5">
        <Link href={`/goals/${goal.id}`} className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-lg bg-paper-subtle flex items-center justify-center text-base shrink-0">
            {goal.icon || GOAL_TYPE_ICONS[goal.goalType] || '🎯'}
          </span>
          <span className="min-w-0">
            <p className="text-sm font-medium text-ink-primary truncate">{goal.name}</p>
            <p className="text-xs text-ink-muted truncate">{term} Goal</p>
          </span>
        </Link>
      </td>
      <td className="px-1 py-3.5 whitespace-nowrap">
        <p className="text-sm text-ink-primary tabular-nums">{formatCurrency(goal.targetAmount, 'INR', true)}</p>
      </td>
      <td className="px-1 py-3.5 whitespace-nowrap">
        <p className="text-sm text-ink-primary tabular-nums">{formatCurrency(goal.currentAmount, 'INR', true)}</p>
        <p className="text-xs text-ink-muted tabular-nums">{pct.toFixed(0)}% of target</p>
      </td>
      <td className="px-1 py-3.5 min-w-32">
        <span className="text-xs font-semibold text-ink-primary tabular-nums block mb-1">{pct.toFixed(0)}%</span>
        <div className="h-1.5 bg-paper-subtle rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColor }} />
        </div>
      </td>
      <td className="px-1 py-3.5 whitespace-nowrap">
        <p className="text-sm text-ink-primary tabular-nums">{formatDate(goal.targetDate, 'MMM yyyy')}</p>
        <p className="text-xs text-ink-muted">{timeLeftLabel(monthsLeft)}</p>
      </td>
      <td className="px-1 py-3.5 whitespace-nowrap">
        {isAtRisk === null ? (
          <span className="text-xs text-ink-muted">—</span>
        ) : (
          <span
            className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{ color: isAtRisk ? '#B45309' : '#0CA30C', background: isAtRisk ? '#B4530914' : '#0CA30C14' }}
          >
            {isAtRisk ? 'At Risk' : 'On Track'}
          </span>
        )}
      </td>
      <td className="px-1 py-3.5 text-right">
        <RowMenu>
          <MenuItem onSelect={() => onContribute(goal)}>Add Contribution</MenuItem>
          <MenuItem onSelect={() => onEdit(goal)}>Edit</MenuItem>
          <MenuItem danger onSelect={() => onDelete(goal.id)}>Delete</MenuItem>
        </RowMenu>
      </td>
    </tr>
  );
}

export function GoalsTable() {
  const { data: goals, isLoading } = useGoals();
  const { mutate: deleteGoal } = useDeleteGoal();

  const [tab, setTab] = useState<Tab>('All');
  const [sortKey, setSortKey] = useState<SortKey>('targetDate');
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [contributingGoal, setContributingGoal] = useState<Goal | null>(null);

  const active = useMemo(() => (goals ?? []).filter((g) => !g.isCompleted), [goals]);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { All: active.length, 'Short Term': 0, 'Mid Term': 0, 'Long Term': 0 };
    for (const g of active) c[goalTermFor(g.targetDate)]++;
    return c;
  }, [active]);

  const filtered = useMemo(
    () => (tab === 'All' ? active : active.filter((g) => goalTermFor(g.targetDate) === tab)),
    [active, tab]
  );

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      if (sortKey === 'targetDate') return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
      if (sortKey === 'progress') return simplePct(b) - simplePct(a);
      return b.currentAmount - a.currentAmount;
    });
    return list;
  }, [filtered, sortKey]);

  const openEdit = (goal: Goal) => setEditingGoal(goal);
  const closeForm = () => { setShowForm(false); setEditingGoal(null); };

  if (isLoading) return <div className="card-light rounded-2xl h-96 shimmer" />;

  return (
    <div className="card-light rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-0.5 bg-paper-subtle rounded-full p-0.5 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap', tab === t ? 'bg-mono text-white' : 'text-ink-secondary hover:text-ink-primary')}
            >
              {t} {counts[t] > 0 && `(${counts[t]})`}
            </button>
          ))}
        </div>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex items-center gap-1.5 rounded-full border border-line bg-paper-card px-3.5 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink-primary hover:border-line-strong transition-colors">
              <ArrowUpDown className="w-3.5 h-3.5" />
              Sort: {SORT_LABEL[sortKey]}
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" className="min-w-44 rounded-xl bg-paper-card border border-line shadow-soft py-1.5 z-40">
              {SORT_OPTIONS.map((key) => (
                <DropdownMenu.Item
                  key={key}
                  onSelect={() => setSortKey(key)}
                  className="px-3.5 py-2 text-xs font-medium cursor-pointer outline-none flex items-center justify-between text-ink-secondary hover:bg-paper-subtle hover:text-ink-primary transition-colors"
                >
                  {SORT_LABEL[key]}
                  {sortKey === key && <Check className="w-3.5 h-3.5" />}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {sorted.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-sm text-ink-muted">No goals in this view</div>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="text-left">
                <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2">Goal</th>
                <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2">Target Amount</th>
                <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2">Amount Saved</th>
                <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2">Progress</th>
                <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2">Target Date</th>
                <th className="text-[11px] font-medium text-ink-muted uppercase tracking-wide px-1 pb-2">Status</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sorted.map((goal) => (
                <GoalRow
                  key={goal.id}
                  goal={goal}
                  onEdit={openEdit}
                  onContribute={setContributingGoal}
                  onDelete={deleteGoal}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        onClick={() => setShowForm(true)}
        className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-ink-secondary hover:text-ink-primary mt-3 pt-3 border-t border-line transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Add New Goal
      </button>

      {(showForm || editingGoal) && <GoalForm onClose={closeForm} goal={editingGoal ?? undefined} />}
      {contributingGoal && <GoalContributionForm goalId={contributingGoal.id} onClose={() => setContributingGoal(null)} />}
    </div>
  );
}
