'use client';

import { CashflowChart } from '@/components/dashboard/CashflowChart';
import { ExpensePieChart } from '@/components/dashboard/ExpensePieChart';
import { useMemberAnalytics, useLoanStrategy } from '@/hooks/useFamilyMembers';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useCashflowTrend } from '@/hooks/useDashboard';

// ─── Member Split Cards ────────────────────────────────────────────────────────
function MemberSplitSection() {
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

// ─── Loan Strategy Section ────────────────────────────────────────────────────
function LoanStrategySection() {
  const { data, isLoading } = useLoanStrategy();

  if (isLoading) return <div className="glass-card rounded-2xl h-64 shimmer" />;
  if (!data?.loans?.length) return null;

  const avalanche = data.avalancheOrder.map((id) => data.loans.find((l) => l.id === id)!).filter(Boolean);
  const snowball  = data.snowballOrder.map((id) => data.loans.find((l) => l.id === id)!).filter(Boolean);

  return (
    <div className="glass-card rounded-2xl p-5 space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">Loan Closure Strategy</h3>
        <p className="text-xs text-text-secondary mt-0.5">
          Monthly interest burning: <span className="text-danger font-semibold font-mono">{formatCurrency(data.totalMonthlyInterest, 'INR', true)}</span>
        </p>
      </div>

      {/* Strategy comparison */}
      <div className="grid grid-cols-2 gap-4">
        {/* Avalanche */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏔️</span>
            <div>
              <p className="text-xs font-semibold text-text-primary">Avalanche Strategy</p>
              <p className="text-xs text-text-muted">Highest interest rate first — saves the most money</p>
            </div>
          </div>
          <div className="space-y-1.5">
            {avalanche.map((loan, i) => (
              <div key={loan.id} className="flex items-center gap-2 p-2 rounded-lg bg-bg-elevated">
                <span className="text-xs font-bold text-text-muted w-4">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">{loan.name}</p>
                  <p className="text-xs text-text-muted">{loan.interestRate}% · {loan.monthsToPayoff}mo</p>
                </div>
                {loan.member && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white shrink-0" style={{ background: loan.member.color ?? '#7C3AED' }}>
                    {loan.member.name}
                  </span>
                )}
              </div>
            ))}
          </div>
          {data.interestSavedAvalanche > 0 && (
            <div className="bg-success/8 border border-success/20 rounded-xl p-2.5 text-center">
              <p className="text-xs text-text-muted">With extra ₹5,000/mo</p>
              <p className="text-sm font-bold text-success">Save {formatCurrency(data.interestSavedAvalanche, 'INR', true)} interest</p>
              <p className="text-xs text-text-muted">{data.avalancheMonthsWith5k} vs {data.baseMonths} months</p>
            </div>
          )}
        </div>

        {/* Snowball */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">⛄</span>
            <div>
              <p className="text-xs font-semibold text-text-primary">Snowball Strategy</p>
              <p className="text-xs text-text-muted">Smallest balance first — fastest psychological wins</p>
            </div>
          </div>
          <div className="space-y-1.5">
            {snowball.map((loan, i) => (
              <div key={loan.id} className="flex items-center gap-2 p-2 rounded-lg bg-bg-elevated">
                <span className="text-xs font-bold text-text-muted w-4">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">{loan.name}</p>
                  <p className="text-xs text-text-muted">{formatCurrency(loan.remainingBalance, 'INR', true)} · {loan.monthsToPayoff}mo</p>
                </div>
                {loan.member && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white shrink-0" style={{ background: loan.member.color ?? '#7C3AED' }}>
                    {loan.member.name}
                  </span>
                )}
              </div>
            ))}
          </div>
          {data.interestSavedSnowball > 0 && (
            <div className="bg-info/8 border border-info/20 rounded-xl p-2.5 text-center">
              <p className="text-xs text-text-muted">With extra ₹5,000/mo</p>
              <p className="text-sm font-bold text-info">Save {formatCurrency(data.interestSavedSnowball, 'INR', true)} interest</p>
              <p className="text-xs text-text-muted">{data.snowballMonthsWith5k} vs {data.baseMonths} months</p>
            </div>
          )}
        </div>
      </div>

      {/* Recommendation */}
      <div className="bg-accent-violet/8 border border-accent-violet/20 rounded-xl p-3">
        <p className="text-xs font-semibold text-accent-violet-light mb-1">💡 Recommendation</p>
        <p className="text-xs text-text-secondary">
          {data.interestSavedAvalanche > data.interestSavedSnowball
            ? `Avalanche saves you ${formatCurrency(data.interestSavedAvalanche - data.interestSavedSnowball, 'INR', true)} more interest than Snowball. Start with ${avalanche[0]?.name}.`
            : `Both strategies save similar amounts. Snowball gives you a quick win by clearing ${snowball[0]?.name} in ~${snowball[0]?.monthsToPayoff} months.`}
          {' '}Redirect freed-up EMI payments to the next loan each time one closes.
        </p>
      </div>
    </div>
  );
}

// ─── Savings Trend ────────────────────────────────────────────────────────────
function SavingsTrend() {
  const { data: cashflow } = useCashflowTrend(12);
  const savingsData = (cashflow ?? []).map((d) => ({
    month: d.month,
    savings: d.savings,
    rate: d.income > 0 ? (d.savings / d.income) * 100 : 0,
  }));

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-text-primary">Savings Trend</h3>
        <p className="text-xs text-text-secondary mt-0.5">Monthly net savings — last 12 months</p>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={savingsData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#555568' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#555568' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v, 'INR', true)} />
          <Tooltip
            formatter={(v: number) => [formatCurrency(v, 'INR', true), 'Savings']}
            contentStyle={{ background: '#111118', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', fontSize: '12px' }}
          />
          <Bar dataKey="savings" radius={[6, 6, 0, 0]}>
            {savingsData.map((entry, i) => (
              <Cell key={i} fill={entry.savings >= 0 ? '#10B981' : '#EF4444'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-text-primary">Analytics & Insights</h2>
        <p className="text-sm text-text-secondary mt-0.5">Per-person split, spending trends, and loan strategy</p>
      </div>

      {/* Per-member split — most important */}
      <MemberSplitSection />

      {/* Loan strategy */}
      <LoanStrategySection />

      {/* Standard charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CashflowChart />
        <ExpensePieChart />
      </div>

      <SavingsTrend />
    </div>
  );
}
