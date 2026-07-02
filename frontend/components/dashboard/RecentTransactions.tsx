'use client';

import Link from 'next/link';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { useRecentTransactions } from '@/hooks/useDashboard';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import { cn } from '@/lib/utils';

export function RecentTransactions() {
  const { data: transactions, isLoading } = useRecentTransactions(6);

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Recent Transactions</h3>
          <p className="text-xs text-text-secondary mt-0.5">Latest financial activity</p>
        </div>
        <Link href="/transactions" className="text-xs text-accent-violet-light hover:underline">
          View all
        </Link>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : (transactions || []).length === 0 ? (
        <p className="text-sm text-text-muted text-center py-8">No transactions yet</p>
      ) : (
        <div className="space-y-1">
          {(transactions || []).map((t) => (
            <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-bg-elevated transition-colors group animate-fade-in">
              <div className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0',
                t.type === 'INCOME' ? 'bg-success/10' : 'bg-danger/10'
              )}>
                {t.category?.icon ?? (t.type === 'INCOME' ? '💰' : '💸')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-text-primary truncate">
                  {t.description || t.category?.name || 'Transaction'}
                </p>
                <p className="text-xs text-text-muted">{formatDate(t.date, 'dd MMM')}</p>
              </div>
              <div className={cn(
                'flex items-center gap-1 text-sm font-semibold font-mono shrink-0',
                t.type === 'INCOME' ? 'text-success' : 'text-danger'
              )}>
                {t.type === 'INCOME' ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {formatCurrency(t.amount, 'INR', true)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
