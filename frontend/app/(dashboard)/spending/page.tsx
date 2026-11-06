'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/lib/format';
import { usePeriodMonth } from '@/hooks/useMonthSummary';
import { useSpending, SpendingEntry, SpendingCategory } from '@/hooks/useRegisters';
import { useBudgets, useDeleteBudget } from '@/hooks/useBudgets';
import { useDeleteTransaction } from '@/hooks/useTransactions';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { RegisterHeader } from '@/components/register/Register';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { BudgetForm } from '@/components/budgets/BudgetForm';
import { Budget, Transaction } from '@/types';

// Spending: where the month's money went, bank and cards together, day by day,
// with a category breakdown and optional limits per category.

const FALLBACK_COLORS = ['#1F2937', '#6B7280', '#B8B6B0', '#D97706', '#16A34A', '#2563EB', '#9333EA', '#DC2626'];
const KIND_LABEL: Record<string, string> = { TRANSFER: 'transfer', SAVE: 'saving', DEBT: 'EMI', INCOME: 'income', ADJUST: 'adjustment' };

/** The edit form takes a transaction; build one from a bank entry. */
function asTransaction(e: SpendingEntry): Transaction {
  return {
    id: e.id, type: e.type ?? 'EXPENSE', amount: e.amount, description: e.name, notes: e.notes, date: e.date, isRecurring: e.isRecurring,
    kind: e.kind, memberId: e.memberId, splitMemberId: e.splitMemberId, splitRatio: e.splitRatio,
    category: e.categoryId ? { id: e.categoryId, name: e.categoryName ?? '', icon: null, color: e.categoryColor } : null,
    account: e.accountId ? { id: e.accountId, name: e.from ?? '', type: 'SAVINGS' } : null,
  } as unknown as Transaction;
}

function CategoryBreakdown({ categories, total, onLimit, onRemoveLimit }: { categories: SpendingCategory[]; total: number; onLimit: (c: SpendingCategory) => void; onRemoveLimit: (c: SpendingCategory) => void }) {
  const color = (c: SpendingCategory, i: number) => c.color ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length];
  const spent = categories.filter((c) => c.total > 0);
  return (
    <section className="card-light px-5 py-4">
      <h2 className="mb-2 text-[15px] font-semibold text-ink-primary">By category</h2>
      {total > 0 && (
        <div className="mb-3 flex h-2.5 overflow-hidden rounded-full bg-paper-subtle" aria-hidden="true">
          {spent.map((c, i) => <i key={c.categoryId ?? 'none'} className="block h-full" style={{ width: `${(c.total / total) * 100}%`, background: color(c, i) }} />)}
        </div>
      )}
      {categories.length === 0 ? <p className="text-sm text-ink-muted">Nothing spent yet this month.</p> : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {categories.map((c, i) => {
            const over = c.limit != null && c.total > c.limit;
            return (
              <li key={c.categoryId ?? 'none'} className="min-w-0 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 truncate text-ink-primary"><i className="h-2 w-2 shrink-0 rounded-full" style={{ background: color(c, i) }} />{c.name}</span>
                  <span className="shrink-0 tabular-nums text-ink-primary">
                    {formatCurrency(c.total)}
                    {c.limit != null && <span className={cn('text-xs', over ? 'text-updown-down' : 'text-ink-muted')}> of {formatCurrency(c.limit)}</span>}
                  </span>
                </div>
                {c.limit != null && (
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-paper-subtle">
                    <i className={cn('block h-full', over ? 'bg-updown-down' : c.total >= c.limit * 0.8 ? 'bg-amber-500' : 'bg-updown-up')} style={{ width: `${Math.min(100, c.limit > 0 ? (c.total / c.limit) * 100 : 100)}%` }} />
                  </div>
                )}
                {c.categoryId && (
                  <span className="mt-0.5 flex gap-3 text-[11px] text-ink-muted">
                    <button type="button" onClick={() => onLimit(c)} className="underline underline-offset-2 hover:text-ink-primary">{c.limit != null ? 'Change limit' : 'Set a limit'}</button>
                    {c.budgetId && <button type="button" onClick={() => onRemoveLimit(c)} className="underline underline-offset-2 hover:text-ink-primary">Remove limit</button>}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function SpendingPage() {
  const month = usePeriodMonth();
  const [all, setAll] = useState(false);
  const { data, isLoading, isError } = useSpending(month, all);
  const { data: budgets } = useBudgets();
  const { data: members } = useFamilyMembers();
  const remove = useDeleteTransaction();
  const removeLimit = useDeleteBudget();
  const [editing, setEditing] = useState<SpendingEntry | null>(null);
  const [limit, setLimit] = useState<{ budget?: Budget; categoryId: string } | null>(null);
  const names = new Map((members ?? []).map((m) => [m.id, m.name.split(' ')[0]]));

  const [y, m] = month.split('-').map(Number);
  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const days = todayKey.slice(0, 7) === month ? Number(todayKey.slice(8)) : new Date(y, m, 0).getDate();
  const top = data?.categories.find((c) => c.total > 0);

  return (
    <div className="mx-auto max-w-6xl space-y-4 text-ink-primary">
      <RegisterHeader
        totals={[
          { label: `Spent in ${formatDate(`${month}-01`, 'MMMM')}`, value: data ? formatCurrency(data.total) : '—', note: 'bank and card, everyday spending' },
          { label: 'A day', value: data ? formatCurrency(data.total / Math.max(1, days)) : '—', note: `over ${days} days` },
          { label: 'Biggest category', value: top ? top.name : '—', note: top ? formatCurrency(top.total) : undefined },
        ]}
        actions={
          <label className="flex items-center gap-2 text-xs text-ink-secondary">
            <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
            Show transfers, saving, EMIs and income too
          </label>
        }
      />
      {isLoading && <div className="card-light h-64 shimmer" />}
      {isError && <p role="alert" className="card-light p-5 text-sm text-ink-secondary">Could not load spending. Please refresh.</p>}
      {data && (
        <CategoryBreakdown
          categories={data.categories}
          total={data.total}
          onLimit={(c) => setLimit({ categoryId: c.categoryId!, budget: (budgets ?? []).find((b) => b.id === c.budgetId) })}
          onRemoveLimit={(c) => { if (c.budgetId && window.confirm(`Remove the ${c.name} limit?`)) removeLimit.mutate(c.budgetId); }}
        />
      )}
      {data && data.days.length === 0 && <p className="card-light p-6 text-center text-sm text-ink-muted">Nothing recorded this month yet. Use + to add a spend.</p>}
      {data?.days.map((d) => (
        <section key={d.date} className="card-light overflow-hidden">
          <h3 className="flex justify-between border-b border-line px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            <span>{formatDate(d.date, 'EEE d MMM')}</span><span className="tabular-nums">{formatCurrency(d.total)}</span>
          </h3>
          <ul className="divide-y divide-line">
            {d.entries.map((e) => (
              <li key={`${e.source}-${e.id}`} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <button
                  type="button"
                  disabled={e.source === 'CARD'}
                  onClick={() => setEditing(e)}
                  className="min-w-0 flex-1 text-left disabled:cursor-default"
                >
                  <p className="truncate font-medium text-ink-primary">{e.name}</p>
                  <p className="truncate text-xs text-ink-muted">
                    {e.categoryName ?? 'Uncategorised'}
                    {e.memberId && names.get(e.memberId) ? ` · ${names.get(e.memberId)}` : ''}
                    {e.from ? ` · ${e.source === 'CARD' ? 'card ' : ''}${e.from}` : ''}
                    {e.kind !== 'SPEND' && ` · ${KIND_LABEL[e.kind] ?? e.kind.toLowerCase()}`}
                    {e.sourceType === 'CREDIT_CARD' && ' · card bill'}
                  </p>
                </button>
                <span className={cn('shrink-0 tabular-nums', e.incoming ? 'text-updown-up' : e.kind === 'SPEND' ? 'text-ink-primary' : 'text-ink-muted')}>{e.incoming ? '+' : ''}{formatCurrency(e.amount)}</span>
                {e.source === 'CARD' ? (
                  <Link href="/credit-cards" className="shrink-0 text-[11px] text-ink-muted underline underline-offset-2">card</Link>
                ) : !e.sourceType ? (
                  <button type="button" aria-label={`Delete ${e.name}`} onClick={() => { if (window.confirm(`Delete ${e.name}?`)) remove.mutate(e.id); }} className="shrink-0 rounded-lg p-1 text-ink-muted hover:bg-updown-down-muted hover:text-updown-down">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : <span className="w-[22px] shrink-0" />}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {editing && <TransactionForm transaction={asTransaction(editing)} onClose={() => setEditing(null)} />}
      {limit && <BudgetForm existingBudgets={(budgets ?? []).filter((b) => b.categoryId !== limit.categoryId)} budget={limit.budget} categoryId={limit.categoryId} onClose={() => setLimit(null)} />}
    </div>
  );
}
