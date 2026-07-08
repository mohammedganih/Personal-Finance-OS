'use client';

import { Bell, CalendarClock, Sparkles, Zap } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useBillReminders, useBillsInsights, useBillsSummary, usePayBillOccurrence, useSkipBillOccurrence } from '@/hooks/useBills';
import { formatCurrency, formatDate } from '@/lib/format';
import { BILL_FREQUENCY_LABELS, billCategoryMeta } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function BillsOverviewTab() {
  const { data: summary, isLoading } = useBillsSummary();

  if (isLoading || !summary) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass-card rounded-2xl h-24 shimmer" />)}
        </div>
        <div className="glass-card rounded-2xl h-48 shimmer" />
      </div>
    );
  }

  const m = summary.thisMonth;
  const paidPct = m.total > 0 ? (m.paid / m.total) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Hero cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-text-secondary">Due Today</p>
          <p className={cn('text-xl font-bold mt-1', m.dueTodayCount > 0 ? 'text-danger' : 'text-text-primary')}>
            {m.dueTodayCount > 0 ? formatCurrency(m.dueToday, 'INR', true) : '—'}
          </p>
          <p className="text-xs text-text-muted mt-0.5">
            {m.dueTodayCount > 0 ? `${m.dueTodayCount} payment${m.dueTodayCount > 1 ? 's' : ''}` : 'Nothing due today'}
          </p>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-text-secondary">This Month</p>
          <p className="text-xl font-bold text-text-primary mt-1">{formatCurrency(m.total, 'INR', true)}</p>
          <div className="mt-1.5 space-y-1">
            <Progress value={paidPct} className="h-1.5" indicatorClassName="bg-gradient-success" />
            <p className="text-xs text-text-muted">
              {formatCurrency(m.paid, 'INR', true)} paid · {formatCurrency(m.remaining, 'INR', true)} left
            </p>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-text-secondary">Monthly Commitment</p>
          <p className="text-xl font-bold text-text-primary mt-1">{formatCurrency(summary.monthlyCommitment, 'INR', true)}</p>
          <p className="text-xs text-text-muted mt-0.5">{formatCurrency(summary.annualCommitment, 'INR', true)}/year · {summary.activeCount} active</p>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-text-secondary">Next Month</p>
          <p className="text-xl font-bold text-text-primary mt-1">{formatCurrency(summary.nextMonth.total, 'INR', true)}</p>
          <p className="text-xs text-text-muted mt-0.5">{summary.nextMonth.count} payment{summary.nextMonth.count !== 1 ? 's' : ''} scheduled</p>
        </div>
      </div>

      {/* Overdue banner */}
      {m.overdueCount > 0 && (
        <div className="rounded-xl border border-danger/25 bg-danger/8 px-4 py-2.5 text-xs text-danger flex items-center gap-2">
          ⚠ {m.overdueCount} bill{m.overdueCount > 1 ? 's' : ''} overdue this month totalling {formatCurrency(m.overdue, 'INR', true)} — pay or skip below.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PaymentRadar />
        <div className="space-y-4">
          <CommitmentOutlook summary={summary} />
          {summary.autoDebitMonthly > 0 && (
            <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-accent-violet/10 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-accent-violet-light" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">{formatCurrency(summary.autoDebitMonthly, 'INR', true)}/mo on auto-debit</p>
                <p className="text-xs text-text-muted">Leaves your account without asking — keep the balance ready.</p>
              </div>
            </div>
          )}
          <FrequencyMix summary={summary} />
        </div>
      </div>

      <InsightsPanel />
    </div>
  );
}

/** Upcoming payments within each bill's reminder window, plus anything overdue. */
function PaymentRadar() {
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
                  className="px-2 py-1 rounded-lg bg-success/10 text-success text-xs font-medium hover:bg-success/20 transition-colors"
                >
                  Pay
                </button>
                <button
                  onClick={() => skipBill({ id: r.billId, dueDate: r.dueDate })}
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

function CommitmentOutlook({ summary }: { summary: NonNullable<ReturnType<typeof useBillsSummary>['data']> }) {
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
    </div>
  );
}

function FrequencyMix({ summary }: { summary: NonNullable<ReturnType<typeof useBillsSummary>['data']> }) {
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

function InsightsPanel() {
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
