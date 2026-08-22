'use client';

import { TransactionsMainCard } from '@/components/transactions/light/TransactionsMainCard';
import { TransactionsSummaryCard } from '@/components/transactions/light/TransactionsSummaryCard';
import { TransactionInsightsLight } from '@/components/transactions/light/TransactionInsightsLight';

export default function TransactionsPage() {
  return (
    <div className="space-y-4 mx-auto max-w-7xl">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2">
          <TransactionsMainCard />
        </div>
        <div className="space-y-4">
          <TransactionsSummaryCard />
          <TransactionInsightsLight />
        </div>
      </div>
    </div>
  );
}
