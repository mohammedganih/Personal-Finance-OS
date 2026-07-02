'use client';

import { useState } from 'react';
import { Plus, ArrowUpRight, ArrowDownRight, Search, Pencil, Trash2, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useTransactions, useDeleteTransaction } from '@/hooks/useTransactions';
import { EmptyState } from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import { formatCurrency, formatDate } from '@/lib/format';
import { Transaction, TransactionFilters } from '@/types';
import { MemberBadge } from '@/components/shared/MemberSelector';
import { cn } from '@/lib/utils';
import { TransactionForm } from '@/components/transactions/TransactionForm';

export default function TransactionsPage() {
  const [filters, setFilters] = useState<TransactionFilters>({ page: 1, limit: 20 });
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const { data, isLoading } = useTransactions({ ...filters, search: search || undefined });
  const { mutate: deleteTransaction } = useDeleteTransaction();

  const transactions = data?.transactions ?? [];

  const openAdd = () => { setEditingTransaction(null); setShowForm(true); };
  const openEdit = (t: Transaction) => { setEditingTransaction(t); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingTransaction(null); };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Transactions</h2>
          <p className="text-sm text-text-secondary mt-0.5">
            {data?.pagination.total ?? 0} total records
          </p>
        </div>
        <Button onClick={openAdd} size="sm">
          <Plus className="w-4 h-4 mr-1.5" /> Add Transaction
        </Button>
      </div>

      {/* Filters */}
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
          {(['ALL', 'INCOME', 'EXPENSE'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilters((f) => ({ ...f, type: type === 'ALL' ? undefined : type }))}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-medium transition-colors',
                (type === 'ALL' && !filters.type) || filters.type === type
                  ? 'bg-accent-violet/20 text-accent-violet-light'
                  : 'bg-bg-elevated text-text-secondary hover:text-text-primary'
              )}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-5"><TableSkeleton rows={8} /></div>
        ) : transactions.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            title="No transactions yet"
            description="Start by adding your income or expenses"
            action={{ label: 'Add Transaction', onClick: openAdd }}
          />
        ) : (
          <>
            <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-border text-xs font-medium text-text-muted uppercase tracking-wider">
              <span>Description</span>
              <span>Category / Account</span>
              <span>Date</span>
              <span className="text-right">Amount</span>
              <span />
            </div>

            <div className="divide-y divide-border">
              {transactions.map((t) => (
                <div
                  key={t.id}
                  className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-5 py-3.5 items-center hover:bg-bg-elevated/50 transition-colors group"
                >
                  {/* Description */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      'w-8 h-8 rounded-xl flex items-center justify-center text-xs shrink-0',
                      t.type === 'INCOME' ? 'bg-success/10' : 'bg-danger/10'
                    )}>
                      {t.category?.icon ?? (t.type === 'INCOME' ? '💰' : '💸')}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-text-primary truncate font-medium">
                        {t.description || t.category?.name || 'Transaction'}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {t.isRecurring && <Badge variant="secondary" className="text-xs">Recurring</Badge>}
                        <MemberBadge
                          member={t.member}
                          splitMember={t.splitMember}
                          splitRatio={t.splitRatio ?? undefined}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Category / Account */}
                  <div className="min-w-0">
                    <p className="text-sm text-text-secondary truncate">{t.category?.name ?? '—'}</p>
                    <p className="text-xs text-text-muted truncate">{t.account?.name ?? '—'}</p>
                  </div>

                  {/* Date */}
                  <p className="text-sm text-text-secondary whitespace-nowrap">{formatDate(t.date)}</p>

                  {/* Amount */}
                  <p className={cn(
                    'text-sm font-semibold font-mono text-right whitespace-nowrap',
                    t.type === 'INCOME' ? 'text-success' : 'text-danger'
                  )}>
                    {t.type === 'INCOME' ? '+' : '-'}{formatCurrency(t.amount, 'INR', true)}
                  </p>

                  {/* Actions */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(t)}
                      className="p-1.5 rounded-lg text-text-muted hover:text-accent-violet-light hover:bg-accent-violet/10 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteTransaction(t.id)}
                      className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showForm && (
        <TransactionForm
          onClose={closeForm}
          transaction={editingTransaction ?? undefined}
        />
      )}
    </div>
  );
}
