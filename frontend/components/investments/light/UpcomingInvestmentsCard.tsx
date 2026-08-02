'use client';

import { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { useInvestmentCalendar } from '@/hooks/useInvestmentIntelligence';
import { ASSET_TYPE_LABELS } from '@/lib/constants';
import { formatCurrency, formatDate, getDaysUntil } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * "SIP Calendar" in the reference, broadened here to "Upcoming Investments":
 * there's no literal SIP model in this app -- SIP, Recurring Deposit and
 * Gold Scheme installments all share the same projected-debit mechanism
 * (useInvestmentCalendar), so this includes all three and labels each
 * honestly by its real type rather than calling every entry a "SIP".
 */
export function UpcomingInvestmentsCard() {
  const { data: entries, isLoading } = useInvestmentCalendar(3);
  const [expanded, setExpanded] = useState(false);

  if (isLoading) return <div className="card-light rounded-2xl h-64 shimmer" />;

  const list = entries ?? [];

  if (list.length === 0) {
    return (
      <div className="card-light rounded-2xl p-5 h-64 flex flex-col items-center justify-center text-center gap-1">
        <p className="text-sm text-ink-muted">No upcoming investments scheduled</p>
        <p className="text-xs text-ink-muted">SIPs, RDs and gold schemes will show up here</p>
      </div>
    );
  }

  const [next, ...rest] = list;

  return (
    <div className="card-light rounded-2xl p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-ink-primary">Upcoming Investments</h3>
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
          <Calendar className="w-4 h-4 text-ink-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink-primary truncate">{next.assetName}</p>
            <span className="text-[11px] font-medium text-ink-primary bg-paper-card border border-line rounded-full px-2 py-0.5 whitespace-nowrap">
              In {getDaysUntil(next.date)} days
            </span>
          </div>
          <p className="text-xs text-ink-muted mt-0.5">
            {formatDate(next.date)} · {next.accountName ?? ASSET_TYPE_LABELS[next.assetType] ?? next.assetType}
          </p>
        </div>
      </div>
      <p className="text-lg font-bold text-ink-primary tabular-nums mt-3">{formatCurrency(next.amount, 'INR', true)}</p>

      {expanded && rest.length > 0 && (
        <div className="mt-4 pt-4 border-t border-line space-y-3">
          {rest.map((e, i) => (
            <div key={`${e.investmentId}-${e.date}-${i}`} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-ink-primary truncate">{e.assetName}</p>
                <p className="text-[11px] text-ink-muted truncate">
                  {formatDate(e.date)} · {e.accountName ?? ASSET_TYPE_LABELS[e.assetType] ?? e.assetType}
                </p>
              </div>
              <span className="text-xs font-medium text-ink-primary tabular-nums shrink-0">{formatCurrency(e.amount, 'INR', true)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
