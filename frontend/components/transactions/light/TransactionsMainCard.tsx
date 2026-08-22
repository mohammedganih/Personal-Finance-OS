'use client';

import { useState } from 'react';
import { MoneyFlowDiagram } from './MoneyFlowDiagram';
import { RecentTransactionsSection } from './RecentTransactionsSection';
import { TransactionsListPanel } from './TransactionsListPanel';
import { cn } from '@/lib/utils';
import { TransactionType } from '@/types';

const TABS = ['Overview', 'All Transactions', 'Income', 'Expense'] as const;
type Tab = (typeof TABS)[number];

const TAB_TYPE: Record<Tab, TransactionType | undefined> = {
  Overview: undefined, 'All Transactions': undefined, Income: 'INCOME', Expense: 'EXPENSE',
};

/**
 * No "Transfer" tab -- TransactionType is only INCOME|EXPENSE in this app,
 * so there's no transfer concept to filter on (isWealthTransfer flags
 * loan-principal payments on asset-linked debt, not account-to-account
 * transfers -- reusing it here would mislabel what it means).
 *
 * Underline tabs rather than this codebase's usual pill tabs -- these
 * switch the card's entire content (a page section), not a filter on one
 * list, matching the reference's own distinct treatment for it.
 */
export function TransactionsMainCard() {
  const [tab, setTab] = useState<Tab>('Overview');

  return (
    <div className="card-light rounded-2xl p-5">
      <div className="flex items-center gap-6 border-b border-line overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'pb-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
              tab === t ? 'text-ink-primary border-mono' : 'text-ink-muted border-transparent hover:text-ink-secondary'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' ? (
        <>
          <div className="mt-4">
            <MoneyFlowDiagram />
          </div>
          <RecentTransactionsSection onViewAll={() => setTab('All Transactions')} />
        </>
      ) : (
        <TransactionsListPanel type={TAB_TYPE[tab]} />
      )}
    </div>
  );
}
