'use client';

import { useState } from 'react';
import { Landmark, CreditCard as CreditCardIcon, ShoppingBag, ChevronDown, LucideIcon } from 'lucide-react';
import { useEMICalendar } from '@/hooks/useDebtIntelligence';
import { formatCurrency, formatDate, getDaysUntil } from '@/lib/format';
import { DebtSourceType } from '@/types';
import { cn } from '@/lib/utils';

const SOURCE_ICONS: Record<DebtSourceType, LucideIcon> = {
  LOAN: Landmark,
  CREDIT_CARD: CreditCardIcon,
  CARD_EMI: ShoppingBag,
};

const SOURCE_LABELS: Record<DebtSourceType, string> = {
  LOAN: 'Loan EMI',
  CREDIT_CARD: 'Credit Card',
  CARD_EMI: 'Card EMI',
};

function daysLabel(days: number): string {
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

/** Same shell as the Investments page's UpcomingInvestmentsCard, over
 * useEMICalendar -- already merges LOAN/CREDIT_CARD/CARD_EMI due dates in
 * one real, sorted list (debtIntelligence.service.ts::buildEMICalendar). */
export function UpcomingEMIsCard() {
  const { data: entries, isLoading } = useEMICalendar(3);
  const [expanded, setExpanded] = useState(false);

  if (isLoading) return <div className="card-light rounded-2xl h-64 shimmer" />;

  const list = entries ?? [];

  if (list.length === 0) {
    return (
      <div className="card-light rounded-2xl p-5 h-64 flex flex-col items-center justify-center text-center gap-1">
        <p className="text-sm text-ink-muted">No upcoming EMIs scheduled</p>
        <p className="text-xs text-ink-muted">Loan and card payments will show up here</p>
      </div>
    );
  }

  const [next, ...rest] = list;
  const NextIcon = SOURCE_ICONS[next.sourceType];

  return (
    <div className="card-light rounded-2xl p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-ink-primary">Upcoming EMIs</h3>
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
          <p className="text-xs text-ink-muted mt-0.5">{formatDate(next.date)} · {SOURCE_LABELS[next.sourceType]}</p>
        </div>
      </div>
      <p className="text-lg font-bold text-ink-primary tabular-nums mt-3">{formatCurrency(next.amount, 'INR', true)}</p>

      {expanded && rest.length > 0 && (
        <div className="mt-4 pt-4 border-t border-line space-y-3">
          {rest.map((e, i) => (
            <div key={`${e.debtId}-${e.date}-${i}`} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-ink-primary truncate">{e.name}</p>
                <p className="text-[11px] text-ink-muted truncate">{formatDate(e.date)} · {SOURCE_LABELS[e.sourceType]}</p>
              </div>
              <span className="text-xs font-medium text-ink-primary tabular-nums shrink-0">{formatCurrency(e.amount, 'INR', true)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
