'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { CashflowChart } from '@/components/dashboard/CashflowChart';
import { ExpensePieChart } from '@/components/dashboard/ExpensePieChart';
import { useMemberAnalytics } from '@/hooks/useFamilyMembers';
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

      {/* Loan strategy now lives in Loans -> Debt Insights (covers credit cards
          and card EMIs too, not just loans) */}
      <Link
        href="/loans"
        className="glass-card-hover rounded-2xl p-4 flex items-center justify-between group"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">🧠</span>
          <div>
            <p className="text-sm font-semibold text-text-primary">Debt Health Score & Payoff Strategy</p>
            <p className="text-xs text-text-secondary mt-0.5">Avalanche vs Snowball, prepayment savings, and more — now in Loans</p>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-accent-violet-light group-hover:translate-x-0.5 transition-all" />
      </Link>

      {/* Standard charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CashflowChart />
        <ExpensePieChart />
      </div>

      <SavingsTrend />
    </div>
  );
}
