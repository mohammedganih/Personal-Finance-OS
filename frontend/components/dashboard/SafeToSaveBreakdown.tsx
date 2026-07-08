'use client';

import { useDashboardOverview } from '@/hooks/useDashboard';
import { formatCurrency } from '@/lib/format';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import { PiggyBank, ShieldCheck, Target, TrendingUp, HelpCircle, ArrowRight, Info } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export function SafeToSaveBreakdown() {
  const { data: overview, isLoading } = useDashboardOverview();
  const [activeTip, setActiveTip] = useState<number | null>(null);

  if (isLoading || !overview) {
    return (
      <div className="glass-card rounded-2xl p-5">
        <TableSkeleton rows={4} />
      </div>
    );
  }

  const {
    monthlyIncome,
    otherExpenses,
    effectiveSubscriptionSpent,
    effectiveInvestmentSpent,
    effectiveEMISpent,
    remainingSafeToSave,
  } = overview;

  const totalSpentAndCommitted =
    otherExpenses +
    effectiveSubscriptionSpent +
    effectiveInvestmentSpent +
    effectiveEMISpent;

  const safeToSaveRate =
    monthlyIncome > 0 ? (remainingSafeToSave / monthlyIncome) * 100 : 0;

  // Visual percentages of income
  const pctExpenses = monthlyIncome > 0 ? (otherExpenses / monthlyIncome) * 100 : 0;
  const pctSubs = monthlyIncome > 0 ? (effectiveSubscriptionSpent / monthlyIncome) * 100 : 0;
  const pctInvest = monthlyIncome > 0 ? (effectiveInvestmentSpent / monthlyIncome) * 100 : 0;
  const pctEMI = monthlyIncome > 0 ? (effectiveEMISpent / monthlyIncome) * 100 : 0;
  const pctSafe = monthlyIncome > 0 ? (remainingSafeToSave / monthlyIncome) * 100 : 0;

  // Determine saving health status
  let statusText = 'Budget Conscious';
  let statusColor = 'text-amber-500 bg-amber-500/10';
  let statusDesc = 'Try finding small areas to optimize recurring bills or general expenses.';

  if (safeToSaveRate >= 30) {
    statusText = 'Super Saver';
    statusColor = 'text-emerald-500 bg-emerald-500/10';
    statusDesc = 'Fantastic! You have a robust surplus. Perfect for building serious wealth.';
  } else if (safeToSaveRate >= 15) {
    statusText = 'Healthy Saver';
    statusColor = 'text-accent-violet-light bg-accent-violet/15';
    statusDesc = 'Good job! You maintain a steady savings potential. Keep up the consistency.';
  }

  const savingTips = [
    {
      id: 1,
      title: 'High-Yield Emergency Fund',
      desc: 'Lock 3 to 6 months of living expenses in an accessible high-yield savings account or liquid fund to ensure you never have to break investments during emergencies.',
      icon: ShieldCheck,
      color: 'text-emerald-400 bg-emerald-500/10',
    },
    {
      id: 2,
      title: 'Target Active Financial Goals',
      desc: 'Allocate your safe-to-save surplus directly into your active goals (e.g. Travel, Gadgets, House down-payment) to accelerate goal completion rates.',
      icon: Target,
      color: 'text-accent-violet-light bg-accent-violet/10',
    },
    {
      id: 3,
      title: 'Automated Investing',
      desc: 'Set up an auto-sweep deposit or recurring stock/MF SIP that executes a day after your salary arrives. Saving first is the ultimate wealth builder.',
      icon: TrendingUp,
      color: 'text-amber-400 bg-amber-500/10',
    },
  ];

  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col md:grid md:grid-cols-12 gap-6">
      {/* Visual Calculator Section */}
      <div className="md:col-span-7 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <PiggyBank className="w-5 h-5 text-accent-violet-light" />
            Safe-to-Save Planner
          </h3>
          <p className="text-xs text-text-secondary mt-0.5">
            Your true disposable surplus after accounting for all expenses, recurring bills, and investments.
          </p>
        </div>

        {/* Stacked Progress Bar */}
        <div className="h-3 w-full rounded-full bg-bg flex overflow-hidden border border-border">
          {pctExpenses > 0 && (
            <div
              className="bg-danger/80 transition-all duration-300"
              style={{ width: `${pctExpenses}%` }}
              title={`Expenses: ${pctExpenses.toFixed(1)}%`}
            />
          )}
          {pctSubs > 0 && (
            <div
              className="bg-purple-600/80 transition-all duration-300"
              style={{ width: `${pctSubs}%` }}
              title={`Recurring Bills: ${pctSubs.toFixed(1)}%`}
            />
          )}
          {pctInvest > 0 && (
            <div
              className="bg-amber-500/80 transition-all duration-300"
              style={{ width: `${pctInvest}%` }}
              title={`Investments: ${pctInvest.toFixed(1)}%`}
            />
          )}
          {pctEMI > 0 && (
            <div
              className="bg-orange-500/80 transition-all duration-300"
              style={{ width: `${pctEMI}%` }}
              title={`EMIs: ${pctEMI.toFixed(1)}%`}
            />
          )}
          {pctSafe > 0 && (
            <div
              className="bg-success/80 transition-all duration-300"
              style={{ width: `${pctSafe}%` }}
              title={`Safe-to-Save: ${pctSafe.toFixed(1)}%`}
            />
          )}
        </div>

        {/* Detailed Breakdown List */}
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between p-2 rounded-xl bg-success/5 hover:bg-success/10 transition-colors">
            <span className="font-medium text-success">Monthly Income</span>
            <span className="font-bold font-mono text-success">+{formatCurrency(monthlyIncome)}</span>
          </div>

          <div className="flex items-center justify-between p-2 rounded-xl bg-bg hover:bg-bg-elevated transition-colors text-text-secondary">
            <span>General Expenses (excluding fixed bills)</span>
            <span className="font-mono text-text-primary">-{formatCurrency(otherExpenses)}</span>
          </div>

          <div className="flex items-center justify-between p-2 rounded-xl bg-bg hover:bg-bg-elevated transition-colors text-text-secondary">
            <span>Recurring Bills (this month)</span>
            <span className="font-mono text-text-primary">-{formatCurrency(effectiveSubscriptionSpent)}</span>
          </div>

          <div className="flex items-center justify-between p-2 rounded-xl bg-bg hover:bg-bg-elevated transition-colors text-text-secondary">
            <span>Investments (this month&apos;s SIP, RD &amp; Gold Scheme)</span>
            <span className="font-mono text-text-primary">-{formatCurrency(effectiveInvestmentSpent)}</span>
          </div>

          <div className="flex items-center justify-between p-2 rounded-xl bg-bg hover:bg-bg-elevated transition-colors text-text-secondary">
            <span>EMIs & Loans (this month)</span>
            <span className="font-mono text-text-primary">-{formatCurrency(effectiveEMISpent)}</span>
          </div>

          <p className="text-[11px] text-text-muted leading-relaxed px-2 flex items-start gap-1">
            <Info className="w-3 h-3 mt-0.5 shrink-0" />
            Each of the three rows above uses whichever is higher: what you&apos;ve already logged this
            month, or what you&apos;re committed to pay — so nothing due is missed just because it
            hasn&apos;t been paid yet. This is separate from your total investment portfolio value,
            shown elsewhere on the dashboard.
          </p>

          <div className="flex items-center justify-between p-2.5 rounded-xl border border-accent-violet/30 bg-accent-violet/5 hover:bg-accent-violet/10 transition-all font-semibold mt-2">
            <span className="text-accent-violet-light text-sm">Remaining Safe-to-Save Surplus</span>
            <span className="font-mono text-accent-violet-light text-sm">{formatCurrency(remainingSafeToSave)}</span>
          </div>
        </div>
      </div>

      {/* Saving Advisor / Tips Section */}
      <div className="md:col-span-5 flex flex-col justify-between border-t md:border-t-0 md:border-l border-border pt-6 md:pt-0 md:pl-6 space-y-4">
        {/* Status indicator */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-xs text-text-secondary">Savings Health:</p>
            <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold', statusColor)}>
              {statusText} ({safeToSaveRate.toFixed(0)}%)
            </span>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            {statusDesc}
          </p>
        </div>

        {/* Tips list */}
        <div className="space-y-2 flex-1">
          <p className="text-xs font-semibold text-text-primary mb-1">Careful Saving Advice:</p>
          {savingTips.map((tip) => {
            const Icon = tip.icon;
            const isOpen = activeTip === tip.id;
            return (
              <div
                key={tip.id}
                onClick={() => setActiveTip(isOpen ? null : tip.id)}
                className="group border border-border/60 hover:border-accent-violet-light/50 bg-bg-surface/50 hover:bg-bg-elevated p-2.5 rounded-xl transition-all cursor-pointer select-none space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn('p-1.5 rounded-lg text-xs shrink-0', tip.color)}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-medium text-text-primary group-hover:text-accent-violet-light transition-colors">
                      {tip.title}
                    </span>
                  </div>
                  <ArrowRight className={cn('w-3.5 h-3.5 text-text-muted group-hover:translate-x-0.5 transition-all', isOpen ? 'rotate-90 text-accent-violet-light' : '')} />
                </div>
                {isOpen && (
                  <p className="text-[11px] text-text-muted leading-relaxed pl-7 animate-fade-in">
                    {tip.desc}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
