'use client';

import { Bell, CalendarClock, Sparkles, Zap } from 'lucide-react';
import { useBillReminders, useBillsInsights, useBillsSummary, usePayBillOccurrence, useSkipBillOccurrence } from '@/hooks/useBills';
import { formatCurrency, formatDate } from '@/lib/format';
import { BILL_FREQUENCY_LABELS, billCategoryMeta } from '@/lib/constants';
import { cn } from '@/lib/utils';

/**
 * Upcoming payments within each bill's reminder window, plus anything
 * overdue -- already the best-built list in the app. Kept exactly as
 * shipped, just promoted out from behind the four StatCards it used to
 * share the page with (now folded into BillsHero).
 */
export function PaymentRadar() {
  const { data: reminders, isLoading } = useBillReminders();
  const { mutate: payBill } = usePayBillOccurrence();
  const { mutate: skipBill } = useSkipBillOccurrence();

  const kindStyle = {
    overdue: 'text-danger',
    due_today: 'text-danger',
    upcoming: 'text-warning',
  } as const;

  return (
    <div className="glass-card rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Bell className="w-4 h-4 text-accent-violet-light" />
        <h3 className="text-sm font-semibold text-text-primary">Payment Radar</h3>
      </div>
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 rounded-xl shimmer" />)}</div>
      ) : !reminders || reminders.length === 0 ? (
        <p className="text-xs text-text-muted py-6 text-center">All clear — nothing needs your attention right now. 🎉</p>
      ) : (
        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          {reminders.map((r) => (
            <div key={`${r.billId}-${r.dueDate}`} className="flex items-center gap-3 p-2.5 rounded-xl bg-bg-elevated">
              <span className="text-base w-6 text-center shrink-0">{r.icon || billCategoryMeta(r.category).icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-text-primary truncate">
                  {r.name}
                  {r.autoDebit && <Zap className="w-3 h-3 inline ml-1 text-accent-violet-light" />}
                </p>
                <p className={cn('text-xs', kindStyle[r.kind])}>
                  {r.kind === 'overdue'
                    ? `${Math.abs(r.dueInDays)}d overdue`
                    : r.kind === 'due_today'
                      ? 'Due today'
                      : `Due ${formatDate(r.dueDate, 'dd MMM')} (${r.dueInDays}d)`}
                </p>
              </div>
              <span className="text-xs font-mono font-semibold text-text-primary shrink-0">
                {formatCurrency(r.amount, 'INR', true)}
              </span>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => payBill({ id: r.billId, dueDate: r.dueDate })}
                  aria-label={`Pay ${r.name}`}
                  className="px-2 py-1 rounded-lg bg-success/10 text-success text-xs font-medium hover:bg-success/20 transition-colors"
                >
                  Pay
                </button>
                <button
                  onClick={() => skipBill({ id: r.billId, dueDate: r.dueDate })}
                  aria-label={`Skip ${r.name}`}
                  title="Skip this occurrence"
                  className="px-2 py-1 rounded-lg bg-bg-overlay text-text-muted text-xs hover:text-warning transition-colors"
                >
                  Skip
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CommitmentOutlook({ summary }: { summary: NonNullable<ReturnType<typeof useBillsSummary>['data']> }) {
  const horizons = [
    { label: 'This Month', totals: summary.thisMonth },
    { label: 'Next Month', totals: summary.nextMonth },
    { label: '3 Months', totals: summary.next3Months },
    { label: '6 Months', totals: summary.next6Months },
    { label: '12 Months', totals: summary.next12Months },
  ];
  return (
    <div className="glass-card rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <CalendarClock className="w-4 h-4 text-accent-violet-light" />
        <h3 className="text-sm font-semibold text-text-primary">Commitment Outlook</h3>
        <span className="text-xs text-text-muted ml-auto">avg {formatCurrency(summary.avgMonthlyNext12, 'INR', true)}/mo</span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {horizons.map((h) => (
          <div key={h.label} className="rounded-xl bg-bg-elevated p-2.5 text-center">
            <p className="text-[10px] text-text-muted">{h.label}</p>
            <p className="text-xs font-bold font-mono text-text-primary mt-1">{formatCurrency(h.totals.total, 'INR', true)}</p>
            <p className="text-[10px] text-text-muted mt-0.5">{h.totals.count} bills</p>
          </div>
        ))}
      </div>

      {summary.autoDebitMonthly > 0 && (
        <div className="flex items-center gap-3 pt-3 border-t border-border">
          <div className="w-8 h-8 rounded-xl bg-accent-violet/10 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-accent-violet-light" />
          </div>
          <p className="text-xs text-text-secondary">
            <span className="font-semibold text-text-primary">{formatCurrency(summary.autoDebitMonthly, 'INR', true)}/mo</span> leaves your account without asking — keep the balance ready.
          </p>
        </div>
      )}
    </div>
  );
}

export function FrequencyMix({ summary }: { summary: NonNullable<ReturnType<typeof useBillsSummary>['data']> }) {
  if (summary.byFrequency.length === 0) return null;
  return (
    <div className="glass-card rounded-2xl p-5 space-y-2.5">
      <h3 className="text-sm font-semibold text-text-primary">By Billing Cycle</h3>
      <div className="space-y-1.5">
        {summary.byFrequency.map((f) => (
          <div key={f.frequency} className="flex items-center justify-between text-xs">
            <span className="text-text-secondary">
              {BILL_FREQUENCY_LABELS[f.frequency]} <span className="text-text-muted">× {f.count}</span>
            </span>
            <span className="font-mono text-text-primary">
              {formatCurrency(f.monthlyEquivalent, 'INR', true)}<span className="text-text-muted">/mo</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function InsightsPanel() {
  const { data: insights } = useBillsInsights();
  if (!insights?.length) return null;

  const severityStyle = {
    critical: 'bg-danger/8 border-danger/25 text-danger',
    warning: 'bg-warning/8 border-warning/20 text-warning',
    info: 'bg-bg-elevated border-border text-text-secondary',
    positive: 'bg-success/8 border-success/20 text-success',
  } as const;

  return (
    <div className="glass-card rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-accent-violet-light" />
        <h3 className="text-sm font-semibold text-text-primary">Smart Insights</h3>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {insights.map((insight, i) => (
          <div key={i} className={cn('rounded-xl border px-3 py-2.5 text-xs flex items-start gap-2', severityStyle[insight.severity])}>
            <span className="shrink-0">{insight.icon}</span>
            <span>{insight.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
