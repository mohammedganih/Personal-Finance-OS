'use client';

import { useMemo, useState } from 'react';
import { Plus, Search, ArrowLeftRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { useInfiniteTransactions, useDeleteTransaction } from '@/hooks/useTransactions';
import { EmptyState } from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import { TransactionTile } from '@/components/transactions/TransactionTile';
import { Transaction, TransactionFilters } from '@/types';
import { groupTransactionsByDay } from '@/lib/groupTransactionsByDay';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { TransactionForm } from '@/components/transactions/TransactionForm';

export default function TransactionsPage() {
  const [type, setType] = useState<TransactionFilters['type'] | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteTransactions({
    type,
    search: search || undefined,
  });
  const { mutate: deleteTransaction } = useDeleteTransaction();

  const transactions = useMemo(() => data?.pages.flatMap((p) => p.transactions) ?? [], [data]);
  const total = data?.pages[0]?.pagination.total ?? 0;
  const groups = useMemo(() => groupTransactionsByDay(transactions), [transactions]);

  const openAdd = () => { setEditingTransaction(null); setShowForm(true); };
  const openEdit = (t: Transaction) => { setEditingTransaction(t); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingTransaction(null); };

  return (
    <PageShell>
      <PageHeader
        title="Transactions"
        subtitle={`${total} total records`}
        action={
          <Button onClick={openAdd} size="sm">
            <Plus className="w-4 h-4 mr-1.5" /> Add Transaction
          </Button>
        }
      />

      {/* Filters -- just search + type today, so it stays a single row
          rather than a collapsible sheet; revisit if more filters land. */}
      <div className="glass-card rounded-2xl p-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <Input
            placeholder="Search transactions..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {(['ALL', 'INCOME', 'EXPENSE'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t === 'ALL' ? undefined : t)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-medium transition-colors',
                (t === 'ALL' && !type) || type === t
                  ? 'bg-accent-violet/20 text-accent-violet-light'
                  : 'bg-bg-elevated text-text-secondary hover:text-text-primary'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="glass-card rounded-2xl p-5">
          <TableSkeleton rows={8} />
        </div>
      ) : transactions.length === 0 ? (
        <div className="glass-card rounded-2xl overflow-hidden">
          <EmptyState
            icon={ArrowLeftRight}
            title="No transactions yet"
            description="Start by adding your income or expenses"
            action={{ label: 'Add Transaction', onClick: openAdd }}
          />
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="flex items-center justify-between px-1 mb-2">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">{group.label}</p>
                <p className={cn('text-xs font-mono', group.net >= 0 ? 'text-success' : 'text-danger')}>
                  {group.net >= 0 ? '+' : ''}{formatCurrency(group.net, 'INR', true)}
                </p>
              </div>
              <div className="glass-card rounded-2xl overflow-hidden">
                {group.items.map((t) => (
                  <TransactionTile key={t.id} transaction={t} onEdit={openEdit} onDelete={deleteTransaction} />
                ))}
              </div>
            </div>
          ))}

          {hasNextPage && (
            <div className="flex justify-center pt-1">
              <Button variant="outline" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Load more'}
              </Button>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <TransactionForm
          onClose={closeForm}
          transaction={editingTransaction ?? undefined}
        />
      )}
    </PageShell>
  );
}
