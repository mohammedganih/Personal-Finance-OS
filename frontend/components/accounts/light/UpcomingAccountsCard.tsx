'use client';

import { useMemo, useState } from 'react';
import { Landmark, CreditCard as CreditCardIcon, ShoppingBag, ChevronDown, LucideIcon } from 'lucide-react';
import { useEMICalendar } from '@/hooks/useDebtIntelligence';
import { useBillReminders } from '@/hooks/useBills';
import { billCategoryIcon } from '@/lib/billCategoryMeta';
import { formatCurrency, formatDate, getDaysUntil } from '@/lib/format';
import { DebtSourceType } from '@/types';
import { cn } from '@/lib/utils';

const EMI_ICONS: Record<DebtSourceType, LucideIcon> = {
  LOAN: Landmark, CREDIT_CARD: CreditCardIcon, CARD_EMI: ShoppingBag,
};
const EMI_LABELS: Record<DebtSourceType, string> = {
  LOAN: 'Loan EMI', CREDIT_CARD: 'Credit Card', CARD_EMI: 'Card EMI',
};

interface UpcomingEntry { id: string; name: string; subtitle: string; date: string; amount: number; icon: LucideIcon }

function daysLabel(days: number): string {
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

/** Merges the same two real, already-built sources the Loans and Bills
 * pages each show separately (EMI calendar, bill reminders -- the latter
 * already covers Insurance since that's just another bill category) into
 * one combined "what's due" feed for the account overview. No separate
 * SIP-due concept exists -- SIPs are automatic recurring debits, not a
 * tracked due-date event, so they're not fabricated into this list. */
export function UpcomingAccountsCard() {
  const { data: emis, isLoading: emisLoading } = useEMICalendar(2);
  const { data: bills, isLoading: billsLoading } = useBillReminders();
  const [expanded, setExpanded] = useState(false);

  const list = useMemo(() => {
    const emiEntries: UpcomingEntry[] = (emis ?? []).map((e) => ({
      id: `emi-${e.debtId}-${e.date}`, name: e.name, subtitle: EMI_LABELS[e.sourceType], date: e.date, amount: e.amount, icon: EMI_ICONS[e.sourceType],
    }));
    const billEntries: UpcomingEntry[] = (bills ?? [])
      .filter((b) => b.kind !== 'overdue')
      .map((b) => ({
        id: `bill-${b.billId}-${b.dueDate}`, name: b.name, subtitle: b.category, date: b.dueDate, amount: b.amount, icon: billCategoryIcon(b.category),
      }));
    return [...emiEntries, ...billEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [emis, bills]);

  if (emisLoading || billsLoading) return <div className="card-light rounded-2xl h-64 shimmer" />;

  if (list.length === 0) {
    return (
      <div className="card-light rounded-2xl p-5 h-64 flex flex-col items-center justify-center text-center gap-1">
        <p className="text-sm text-ink-muted">Nothing due soon</p>
        <p className="text-xs text-ink-muted">EMIs and bills nearing their due date will show up here</p>
      </div>
    );
  }

  const [next, ...rest] = list;
  const NextIcon = next.icon;

  return (
    <div className="card-light rounded-2xl p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-ink-primary">Upcoming</h3>
        {rest.length > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-ink-primary transition-colors"
          >
            View All
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', expanded && 'rotate-180')} />
          </button>
        )}
      </div>

      <div className="flex items-start gap-3 p-3.5 rounded-xl bg-paper-subtle">
        <div className="w-9 h-9 rounded-full bg-paper-card border border-line flex items-center justify-center shrink-0">
          <NextIcon className="w-4 h-4 text-ink-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink-primary truncate">{next.name}</p>
            <span className="text-[11px] font-medium text-ink-primary bg-paper-card border border-line rounded-full px-2 py-0.5 whitespace-nowrap">
              {daysLabel(getDaysUntil(next.date))}
            </span>
          </div>
          <p className="text-xs text-ink-muted mt-0.5">{formatDate(next.date)} · {next.subtitle}</p>
        </div>
      </div>
      <p className="text-lg font-bold text-ink-primary tabular-nums mt-3">{formatCurrency(next.amount, 'INR', true)}</p>

      {expanded && rest.length > 0 && (
        <div className="mt-4 pt-4 border-t border-line space-y-3">
          {rest.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-ink-primary truncate">{e.name}</p>
                <p className="text-[11px] text-ink-muted truncate">{formatDate(e.date)} · {e.subtitle}</p>
              </div>
              <span className="text-xs font-medium text-ink-primary tabular-nums shrink-0">{formatCurrency(e.amount, 'INR', true)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
