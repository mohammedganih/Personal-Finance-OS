'use client';

import { StatsRowAccounts } from '@/components/accounts/light/StatsRowAccounts';
import { AllAccountsTable } from '@/components/accounts/light/AllAccountsTable';
import { AccountBreakdownDonut } from '@/components/accounts/light/AccountBreakdownDonut';
import { UpcomingAccountsCard } from '@/components/accounts/light/UpcomingAccountsCard';
import { QuickActionsRowAccounts } from '@/components/accounts/light/QuickActionsRowAccounts';
import { TransactionInsightsLight } from '@/components/transactions/light/TransactionInsightsLight';

export default function AccountsPage() {
  return (
    <div className="space-y-4 mx-auto max-w-7xl">
      <StatsRowAccounts />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2">
          <AllAccountsTable />
        </div>
        <div className="space-y-4">
          <AccountBreakdownDonut />
          <UpcomingAccountsCard />
          <QuickActionsRowAccounts />
          {/* Same real quick-insights engine as Transactions' AI Insights --
              savings-rate/expense-trend content is genuinely account-wide,
              not page-specific, so it's reused rather than forked. */}
          <TransactionInsightsLight />
        </div>
      </div>
    </div>
  );
}
