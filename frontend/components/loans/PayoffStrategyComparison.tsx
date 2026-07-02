'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDebtStrategy } from '@/hooks/useDebtIntelligence';
import { formatCurrency } from '@/lib/format';
import { UnifiedDebt } from '@/types';

function StrategyColumn({
  icon, title, subtitle, order, debts, monthsWithExtra, interestSaved, extraPayment, accentClass,
}: {
  icon: string; title: string; subtitle: string; order: string[]; debts: UnifiedDebt[];
  monthsWithExtra: number; interestSaved: number; extraPayment: number; accentClass: string;
}) {
  const ordered = order.map((id) => debts.find((d) => d.id === id)!).filter(Boolean);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <div>
          <p className="text-xs font-semibold text-text-primary">{title}</p>
          <p className="text-xs text-text-muted">{subtitle}</p>
        </div>
      </div>
      <div className="space-y-1.5">
        {ordered.map((debt, i) => (
          <div key={debt.id} className="flex items-center gap-2 p-2 rounded-lg bg-bg-elevated">
            <span className="text-xs font-bold text-text-muted w-4">#{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-text-primary truncate">{debt.name}</p>
              <p className="text-xs text-text-muted">{debt.interestRate}% · {formatCurrency(debt.remainingBalance, 'INR', true)}</p>
            </div>
          </div>
        ))}
      </div>
      {extraPayment > 0 && interestSaved > 0 && (
        <div className={`${accentClass} rounded-xl p-2.5 text-center`}>
          <p className="text-xs text-text-muted">With extra {formatCurrency(extraPayment, 'INR', true)}/mo</p>
          <p className="text-sm font-bold text-text-primary">Save {formatCurrency(interestSaved, 'INR', true)} interest</p>
          <p className="text-xs text-text-muted">{monthsWithExtra} months to debt-free</p>
        </div>
      )}
    </div>
  );
}

export function PayoffStrategyComparison() {
  const [extraInput, setExtraInput] = useState('5000');
  const extraPayment = Math.max(0, Number(extraInput) || 0);
  const { data, isLoading } = useDebtStrategy(extraPayment);

  if (isLoading) return <div className="glass-card rounded-2xl h-96 shimmer" />;
  if (!data?.debts?.length) return null;

  const better = data.interestSavedAvalanche > data.interestSavedSnowball ? 'avalanche' : 'snowball';
  const avalancheFirst = data.debts.find((d) => d.id === data.avalancheOrder[0]);
  const snowballFirst = data.debts.find((d) => d.id === data.snowballOrder[0]);

  return (
    <div className="glass-card rounded-2xl p-5 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Payoff Strategy</h3>
          <p className="text-xs text-text-secondary mt-0.5">
            Interest burning: <span className="text-danger font-semibold">{formatCurrency(data.totalMonthlyInterest, 'INR', true)}/mo</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-text-secondary whitespace-nowrap">Extra payment/mo</Label>
          <Input
            type="number"
            step="500"
            value={extraInput}
            onChange={(e) => setExtraInput(e.target.value)}
            className="w-28 h-8 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StrategyColumn
          icon="🏔️" title="Avalanche Strategy" subtitle="Highest interest rate first — saves the most money"
          order={data.avalancheOrder} debts={data.debts} monthsWithExtra={data.avalancheMonthsWithExtra}
          interestSaved={data.interestSavedAvalanche} extraPayment={extraPayment}
          accentClass="bg-success/8 border border-success/20"
        />
        <StrategyColumn
          icon="⛄" title="Snowball Strategy" subtitle="Smallest balance first — fastest psychological wins"
          order={data.snowballOrder} debts={data.debts} monthsWithExtra={data.snowballMonthsWithExtra}
          interestSaved={data.interestSavedSnowball} extraPayment={extraPayment}
          accentClass="bg-info/8 border border-info/20"
        />
      </div>

      {extraPayment > 0 && (
        <div className="bg-accent-violet/8 border border-accent-violet/20 rounded-xl p-3">
          <p className="text-xs font-semibold text-accent-violet-light mb-1">💡 Recommendation</p>
          <p className="text-xs text-text-secondary">
            {better === 'avalanche'
              ? `Avalanche saves you ${formatCurrency(data.interestSavedAvalanche - data.interestSavedSnowball, 'INR', true)} more interest than Snowball. Start with ${avalancheFirst?.name}.`
              : `Both strategies save similar amounts. Snowball gives you a quick win by clearing ${snowballFirst?.name} in ~${snowballFirst?.monthsToPayoff} months.`}
            {' '}Redirect freed-up payments to the next debt each time one closes.
          </p>
        </div>
      )}
    </div>
  );
}
