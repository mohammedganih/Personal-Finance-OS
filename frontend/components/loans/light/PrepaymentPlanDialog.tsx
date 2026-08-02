'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useDebtStrategy } from '@/hooks/useDebtIntelligence';
import { formatCurrency } from '@/lib/format';

interface PrepaymentPlanDialogProps {
  onClose: () => void;
}

/**
 * Reuses the dark-theme dialog primitives' fabric doesn't fit here: unlike
 * InvestmentForm/InvestmentDetailDialog (existing dark dialogs reused as-is
 * from the light pages), this is new UI with nothing dark to preserve, so
 * it's built directly on @radix-ui/react-dialog with light tokens -- same
 * reasoning that produced PeriodSelectorLight instead of overriding the
 * shared (dark-hardcoded) components/ui/select.tsx.
 *
 * A condensed, dialog-sized version of PayoffStrategyComparison's real
 * data (useDebtStrategy) -- an editable extra-payment amount and the
 * resulting headline numbers -- not its full inline charts/timeline.
 */
export function PrepaymentPlanDialog({ onClose }: PrepaymentPlanDialogProps) {
  const [extraPayment, setExtraPayment] = useState(5000);
  const { data: strategy, isLoading } = useDebtStrategy(extraPayment);

  const bestMonths = strategy
    ? (strategy.bestStrategy === 'avalanche' ? strategy.avalancheMonthsWithExtra : strategy.snowballMonthsWithExtra)
    : null;
  const monthsSooner = strategy && bestMonths !== null ? strategy.baseMonths - bestMonths : null;
  const order = strategy ? (strategy.bestStrategy === 'avalanche' ? strategy.avalancheOrder : strategy.snowballOrder) : [];
  const firstDebt = strategy?.debts.find((d) => d.id === order[0]);

  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-paper-card border border-line shadow-soft p-6">
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="text-base font-semibold text-ink-primary">Prepayment Plan</Dialog.Title>
            <Dialog.Close className="p-1 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-paper-subtle transition-colors">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          <label className="block text-xs font-medium text-ink-secondary mb-1.5">Extra payment per month</label>
          <div className="relative mb-5">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-muted">₹</span>
            <input
              type="number"
              min={0}
              step={500}
              value={extraPayment}
              onChange={(e) => setExtraPayment(Math.max(0, Number(e.target.value)))}
              className="w-full rounded-xl border border-line bg-paper pl-7 pr-3.5 py-2.5 text-sm text-ink-primary tabular-nums focus:outline-none focus:ring-2 focus:ring-mono/20"
            />
          </div>

          {isLoading || !strategy ? (
            <div className="h-32 rounded-xl shimmer" />
          ) : strategy.debts.length === 0 ? (
            <p className="text-sm text-ink-muted">No active debt to simulate a plan for.</p>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl bg-paper-subtle p-4">
                <p className="text-xs text-ink-muted">Interest saved</p>
                <p className="text-xl font-bold text-updown-up tabular-nums mt-0.5">
                  {formatCurrency(strategy.totalInterestSaved, 'INR', true)}
                </p>
              </div>
              <div className="rounded-xl bg-paper-subtle p-4">
                <p className="text-xs text-ink-muted">Debt-free sooner by</p>
                <p className="text-xl font-bold text-ink-primary tabular-nums mt-0.5">
                  {monthsSooner !== null && monthsSooner >= 1 ? `${monthsSooner} month${monthsSooner === 1 ? '' : 's'}` : '—'}
                </p>
              </div>
              {firstDebt && (
                <p className="text-xs text-ink-secondary leading-relaxed">
                  Best plan: the <span className="font-medium text-ink-primary">{strategy.bestStrategy === 'avalanche' ? 'Avalanche' : 'Snowball'}</span> strategy,
                  starting with <span className="font-medium text-ink-primary">{firstDebt.name}</span> at {firstDebt.interestRate}% p.a.
                </p>
              )}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
