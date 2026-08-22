'use client';

import { useState } from 'react';
import { useRecentTransactions } from '@/hooks/useDashboard';
import { useDeleteTransaction } from '@/hooks/useTransactions';
import { TransactionRowLight } from './TransactionRowLight';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { Transaction } from '@/types';

/** Overview tab's transaction list -- deliberately not period-scoped
 * (useRecentTransactions), same "recent activity, not this period's
 * activity" reasoning as the Dashboard. "View All" hands off to the
 * parent's tab state rather than a route, since All Transactions is a
 * sibling tab in the same card, not a separate page. */
export function RecentTransactionsSection({ onViewAll }: { onViewAll: () => void }) {
  const { data: transactions, isLoading } = useRecentTransactions(5);
  const { mutate: deleteTransaction } = useDeleteTransaction();
  const [editing, setEditing] = useState<Transaction | null>(null);

  return (
    <div className="mt-5 pt-5 border-t border-line">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-ink-primary">Recent Transactions</h3>
        <button onClick={onViewAll} className="text-xs font-medium text-ink-muted hover:text-ink-primary transition-colors">
          View All
        </button>
      </div>

      {isLoading ? (
        <div className="h-48 rounded-xl shimmer" />
      ) : !transactions || transactions.length === 0 ? (
        <div className="h-32 flex items-center justify-center text-sm text-ink-muted">No transactions yet</div>
      ) : (
        <div className="divide-y divide-line">
          {transactions.map((t) => (
            <TransactionRowLight key={t.id} transaction={t} onEdit={setEditing} onDelete={deleteTransaction} />
          ))}
        </div>
      )}

      {editing && <TransactionForm transaction={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
