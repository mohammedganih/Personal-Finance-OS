'use client';

import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { Skeleton } from '@/components/shared/LoadingSkeleton';
import { useBillsSummary, useBillReminders } from '@/hooks/useBills';
import { formatCurrency } from '@/lib/format';
import { BillReminder } from '@/types';

/**
 * Names the 1-2 most urgent reminders, exactly like Payment Radar already
 * ranks them. Only claims "everything else is on auto-debit" when that's
 * actually true of what's left unnamed -- a real pending manual bill
 * doesn't get quietly folded into that reassurance just because some other
 * bill happens to be on auto-debit.
 */
function buildNarrative(reminders: BillReminder[] | undefined): string {
  if (!reminders || reminders.length === 0) {
    return "All clear — nothing needs your attention right now.";
  }

  const sorted = [...reminders].sort((a, b) => a.dueInDays - b.dueInDays);
  const phrase = (r: BillReminder) =>
    r.kind === 'overdue'
      ? `${r.name} is ${Math.abs(r.dueInDays)} day${Math.abs(r.dueInDays) === 1 ? '' : 's'} overdue`
      : r.kind === 'due_today'
      ? `${r.name} is due today`
      : `${r.name} is due in ${r.dueInDays} day${r.dueInDays === 1 ? '' : 's'}`;

  const named = sorted.slice(0, 2);
  const rest = sorted.slice(2);
  const sentence = named.length === 2 ? `${phrase(named[0])} and ${phrase(named[1])}` : phrase(named[0]);

  if (rest.length === 0) return `${sentence}.`;
  if (rest.every((r) => r.autoDebit)) return `${sentence} — everything else is on auto-debit and needs nothing from you.`;
  return `${sentence}, plus ${rest.length} more this week.`;
}

export function BillsHero() {
  const { data: summary, isLoading } = useBillsSummary();
  const { data: reminders } = useBillReminders();

  if (isLoading || !summary) {
    return (
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-96" />
        <Skeleton className="h-10 w-56" />
      </div>
    );
  }

  const actionable = summary.dueThisWeek.overdueCount + summary.dueThisWeek.dueTodayCount + summary.dueThisWeek.upcomingCount;
  const headline = actionable === 0
    ? 'All clear — nothing needs your attention right now.'
    : `${actionable} bill${actionable === 1 ? '' : 's'} need${actionable === 1 ? 's' : ''} attention this week.`;
  const narrative = buildNarrative(reminders);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: [0.2, 0.8, 0.2, 1] }}
      className="rounded-2xl p-6 bg-bg-surface border border-border shadow-raised"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-text-muted">Joint · this week</p>
          <p className="text-lg font-medium text-text-primary mt-1 max-w-xl text-balance">{headline}</p>
          <p className="text-sm text-text-secondary mt-1 max-w-xl">{narrative}</p>
          <div className="flex items-end gap-3 flex-wrap mt-3">
            <span className="text-3xl font-bold tracking-tight text-text-primary tabular-nums">
              {formatCurrency(summary.dueThisWeek.remaining)}
            </span>
            <span className="text-xs text-text-muted mb-1.5">due this week</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 shrink-0">
          <StatCard compact title="Monthly Commitment" value={summary.monthlyCommitment} />
          <StatCard
            compact title="On Auto-Debit" value={summary.autoDebitMonthly}
            icon={Zap} iconColor="bg-accent-violet/15 text-accent-violet-light"
          />
        </div>
      </div>
    </motion.div>
  );
}
