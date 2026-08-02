'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Receipt, Target, TrendingUp } from 'lucide-react';
import { TransactionForm } from '@/components/transactions/TransactionForm';

// Every chip goes to a real route or a real dialog -- no "Transfer Money" or
// "Ask AI" placeholders, since neither a transfer transaction type nor an AI
// chat feature exists anywhere in this app.
const LINK_ACTIONS = [
  { label: 'Pay a Bill', href: '/bills', icon: Receipt },
  { label: 'New Goal', href: '/goals', icon: Target },
  { label: 'Invest Now', href: '/investments', icon: TrendingUp },
];

export function QuickActionsRow() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="card-light rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-ink-primary mb-4">Quick Actions</h3>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-paper-subtle hover:bg-line text-sm font-medium text-ink-primary transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Expense
        </button>
        {LINK_ACTIONS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-paper-subtle hover:bg-line text-sm font-medium text-ink-primary transition-colors"
          >
            <a.icon className="w-4 h-4" /> {a.label}
          </Link>
        ))}
      </div>

      {showForm && <TransactionForm onClose={() => setShowForm(false)} />}
    </div>
  );
}
