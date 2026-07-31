'use client';

import { useMemberAnalytics } from '@/hooks/useFamilyMembers';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

export function MemberSplitSection() {
  const { data, isLoading } = useMemberAnalytics();

  if (isLoading) return (
    <div className="grid grid-cols-2 gap-4">
      {Array.from({ length: 2 }).map((_, i) => <div key={i} className="glass-card rounded-2xl h-56 shimmer" />)}
    </div>
  );

  if (!data?.breakdown?.length) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-text-primary">Per-Person Financial Split</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.breakdown.map(({ member, monthlyIncome, monthlyExpenses, monthlySavings, loanOwed, monthlyEMI, investmentValue }) => {
          const savingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;
          return (
            <div key={member.id} className="glass-card rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                  style={{ background: (member.color ?? '#7C3AED') + '25' }}
                >
                  {member.emoji ?? '👤'}
                </div>
                <div>
                  <p className="text-sm font-bold text-text-primary">{member.name}</p>
                  {member.relation && <p className="text-xs text-text-muted">{member.relation}</p>}
                </div>
                <div
                  className="ml-auto text-sm font-semibold px-3 py-1 rounded-full"
                  style={{ background: (member.color ?? '#7C3AED') + '20', color: member.color ?? '#7C3AED' }}
                >
                  {savingsRate.toFixed(0)}% saved
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Income (this mo.)',   value: monthlyIncome,   color: 'text-success' },
                  { label: 'Expenses (this mo.)', value: monthlyExpenses, color: 'text-danger' },
                  { label: 'Savings (this mo.)',  value: monthlySavings,  color: monthlySavings >= 0 ? 'text-success' : 'text-danger' },
                  { label: 'Monthly EMI burden',  value: monthlyEMI,      color: 'text-warning' },
                  { label: 'Loan outstanding',    value: loanOwed,        color: 'text-danger' },
                  { label: 'Investment value',    value: investmentValue, color: 'text-accent-violet-light' },
                ].map((s) => (
                  <div key={s.label} className="bg-bg-elevated rounded-xl p-2.5">
                    <p className="text-xs text-text-muted">{s.label}</p>
                    <p className={cn('text-sm font-semibold font-mono mt-0.5', s.color)}>
                      {formatCurrency(s.value, 'INR', true)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Unassigned transactions */}
      {(data.unassignedIncome > 0 || data.unassignedExpenses > 0) && (
        <div className="glass-card rounded-xl p-3 flex items-center justify-between text-sm">
          <span className="text-text-secondary">Unassigned transactions (no member tagged)</span>
          <div className="flex gap-4 text-xs font-mono">
            <span className="text-success">+{formatCurrency(data.unassignedIncome, 'INR', true)}</span>
            <span className="text-danger">−{formatCurrency(data.unassignedExpenses, 'INR', true)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
