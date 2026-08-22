'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Receipt, TrendingUp, BarChart3 } from 'lucide-react';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { AccountForm } from '@/components/settings/AccountSetup';

// No "Transfer" chip -- same reasoning as the Dashboard's QuickActionsRow:
// this app has no transfer transaction type to back it. "View Reports"
// links to Analytics rather than the Reports page, which is itself just an
// honest placeholder pointing back to Analytics.
export function QuickActionsRowAccounts() {
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [showTransactionForm, setShowTransactionForm] = useState(false);

  return (
    <div className="card-light rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-ink-primary mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setShowAccountForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-paper-subtle hover:bg-line text-sm font-medium text-ink-primary transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Account
        </button>
        <button
          onClick={() => setShowTransactionForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-paper-subtle hover:bg-line text-sm font-medium text-ink-primary transition-colors"
        >
          <Receipt className="w-4 h-4" /> Add Transaction
        </button>
        <Link
          href="/investments"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-paper-subtle hover:bg-line text-sm font-medium text-ink-primary transition-colors"
        >
          <TrendingUp className="w-4 h-4" /> Add Investment
        </Link>
        <Link
          href="/analytics"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-paper-subtle hover:bg-line text-sm font-medium text-ink-primary transition-colors"
        >
          <BarChart3 className="w-4 h-4" /> View Reports
        </Link>
      </div>

      {showAccountForm && <AccountForm onClose={() => setShowAccountForm(false)} />}
      {showTransactionForm && <TransactionForm onClose={() => setShowTransactionForm(false)} />}
    </div>
  );
}
