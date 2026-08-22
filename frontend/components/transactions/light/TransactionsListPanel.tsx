'use client';

import { useMemo, useState } from 'react';
import { Search, ArrowLeftRight, Loader2 } from 'lucide-react';
import { usePeriodStore } from '@/stores/period.store';
import { useInfiniteTransactions, useDeleteTransaction } from '@/hooks/useTransactions';
import { groupTransactionsByDay } from '@/lib/groupTransactionsByDay';
import { formatCurrency, formatDate } from '@/lib/format';
import { TransactionRowLight } from './TransactionRowLight';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { Transaction, TransactionType } from '@/types';
import { cn } from '@/lib/utils';

/** All Transactions / Income / Expense tabs -- scoped to the header's
 * period selector (start/endDate), unlike the Overview tab's Recent
 * Transactions which is deliberately period-independent. */
export function TransactionsListPanel({ type }: { type?: TransactionType }) {
  const { month, year } = usePeriodStore();
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = formatDate(new Date(year, month, 0), 'yyyy-MM-dd');

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Transaction | null>(null);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteTransactions({
    type, startDate, endDate, search: search || undefined,
  });
  const { mutate: deleteTransaction } = useDeleteTransaction();

  const transactions = useMemo(() => data?.pages.flatMap((p) => p.transactions) ?? [], [data]);
  const groups = useMemo(() => groupTransactionsByDay(transactions), [transactions]);

  return (
    <div className="mt-4">
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
        <input
          placeholder="Search transactions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-9 pl-9 pr-3 rounded-xl border border-line bg-paper-card text-sm text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-line-strong"
        />
      </div>

      {isLoading ? (
        <div className="h-64 rounded-xl shimmer" />
      ) : transactions.length === 0 ? (
        <div className="h-48 flex flex-col items-center justify-center gap-1 text-center">
          <ArrowLeftRight className="w-8 h-8 text-ink-muted mb-1" />
          <p className="text-sm text-ink-muted">No transactions in this view</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="flex items-center justify-between px-1 mb-1">
                <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">{group.label}</p>
                <p className={cn('text-xs font-mono', group.net >= 0 ? 'text-updown-up' : 'text-updown-down')}>
                  {group.net >= 0 ? '+' : ''}{formatCurrency(group.net, 'INR', true)}
                </p>
              </div>
              <div className="divide-y divide-line">
                {group.items.map((t) => (
                  <TransactionRowLight key={t.id} transaction={t} onEdit={setEditing} onDelete={deleteTransaction} />
                ))}
              </div>
            </div>
          ))}

          {hasNextPage && (
            <div className="flex justify-center pt-1">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="flex items-center gap-1.5 rounded-full border border-line bg-paper-card px-4 py-2 text-xs font-medium text-ink-secondary hover:text-ink-primary hover:border-line-strong transition-colors"
              >
                {isFetchingNextPage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}

      {editing && <TransactionForm transaction={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
