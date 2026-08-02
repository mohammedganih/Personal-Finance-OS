'use client';

import { Bell } from 'lucide-react';
import { useBillReminders } from '@/hooks/useBills';
import { useCreditCards } from '@/hooks/useCreditCards';
import { useLoans } from '@/hooks/useLoans';
import { formatCurrency, getDaysUntil } from '@/lib/format';
import { billCategoryMeta, LOAN_TYPE_LABELS } from '@/lib/constants';

interface UpcomingItem {
  id: string;
  name: string;
  subtitle: string;
  amount: number;
  dueInDays: number;
  icon: string;
}

/** Next occurrence of a loan's EMI, using its start date's day-of-month --
 *  loans store no explicit due-day, so this is the standard EMI auto-debit
 *  convention (same day-of-month as disbursal), not a fabricated field. */
function nextLoanDueDate(startDate: string, from: Date): Date {
  const day = new Date(startDate).getDate();
  const candidate = new Date(from.getFullYear(), from.getMonth(), day);
  if (candidate < from) candidate.setMonth(candidate.getMonth() + 1);
  return candidate;
}

export function UpcomingList() {
  const { data: bills, isLoading: billsLoading } = useBillReminders();
  const { data: cards, isLoading: cardsLoading } = useCreditCards();
  const { data: loans, isLoading: loansLoading } = useLoans();

  if (billsLoading || cardsLoading || loansLoading) {
    return <div className="card-light rounded-2xl h-72 shimmer" />;
  }

  const now = new Date();
  const items: UpcomingItem[] = [];

  for (const b of bills ?? []) {
    items.push({
      id: `bill-${b.billId}`,
      name: b.name,
      subtitle: b.category,
      amount: b.amount,
      dueInDays: b.dueInDays,
      icon: b.icon || billCategoryMeta(b.category).icon,
    });
  }

  for (const c of (cards ?? []).filter((c) => c.isActive && c.outstanding > 0)) {
    items.push({
      id: `card-${c.id}`,
      name: `${c.cardName} Bill`,
      subtitle: c.bank ?? 'Credit Card',
      amount: c.outstanding,
      dueInDays: getDaysUntil(c.dueDate),
      icon: '💳',
    });
  }

  for (const l of (loans ?? []).filter((l) => l.isActive)) {
    items.push({
      id: `loan-${l.id}`,
      name: `${LOAN_TYPE_LABELS[l.loanType] ?? l.loanType} EMI`,
      subtitle: l.lender ?? 'Loan',
      amount: l.emi,
      dueInDays: getDaysUntil(nextLoanDueDate(l.startDate, now)),
      icon: '🏠',
    });
  }

  items.sort((a, b) => a.dueInDays - b.dueInDays);
  const top = items.slice(0, 6);

  return (
    <div className="card-light rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-mono" />
          <h3 className="text-sm font-semibold text-ink-primary">Upcoming</h3>
        </div>
      </div>

      {top.length === 0 ? (
        <p className="text-sm text-ink-muted text-center py-8">Nothing due soon</p>
      ) : (
        <div className="space-y-1">
          {top.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-paper-subtle transition-colors">
              <div className="w-9 h-9 rounded-xl bg-paper-subtle flex items-center justify-center text-base shrink-0">
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-primary truncate">{item.name}</p>
                <p className="text-xs text-ink-muted truncate">{item.subtitle}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-ink-primary tabular-nums">{formatCurrency(item.amount, 'INR', true)}</p>
                <p className="text-xs text-ink-muted">
                  {item.dueInDays < 0 ? `${Math.abs(item.dueInDays)}d overdue` : item.dueInDays === 0 ? 'Today' : `In ${item.dueInDays}d`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
