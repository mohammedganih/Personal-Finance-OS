'use client';

import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { useDashboardOverview, useCashflowTrend } from '@/hooks/useDashboard';
import { formatCurrency } from '@/lib/format';

// Same 4-bucket palette as MoneyFlowDiagram/CashFlowSankey, plus emerald
// for income (matching the flow diagram's own income-bar color) -- one
// consistent mapping across the whole page rather than a second ad-hoc set.
const ROW_COLOR = { income: '#10B981', expenses: '#2A78D6', bills: '#EB6834', investments: '#4A3AA7', savings: '#008300' };

function Row({ label, amount, color }: { label: string; amount: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-xs text-ink-secondary">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
        {label}
      </span>
      <span className="text-sm font-semibold text-ink-primary tabular-nums">{formatCurrency(amount, 'INR', true)}</span>
    </div>
  );
}

/** Same real figures as MoneyFlowDiagram (otherExpenses for "Total
 * Expenses", so the two cards never disagree) -- Net Savings sparkline
 * comes from useCashflowTrend's real monthly savings history. */
export function TransactionsSummaryCard() {
  const { data: overview, isLoading } = useDashboardOverview();
  const { data: trend } = useCashflowTrend(6);

  if (isLoading || !overview) return <div className="card-light rounded-2xl h-80 shimmer" />;

  const billsTotal = overview.actualSubscriptionSpent + overview.actualEMISpent;
  const sparkData = (trend ?? []).map((p) => ({ v: p.savings }));

  return (
    <div className="card-light rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-ink-primary mb-4">Summary</h3>

      <div className="space-y-3">
        <Row label="Total Income" amount={overview.monthlyIncome} color={ROW_COLOR.income} />
        <Row label="Total Expenses" amount={overview.otherExpenses} color={ROW_COLOR.expenses} />
        <Row label="Bills & EMIs" amount={billsTotal} color={ROW_COLOR.bills} />
        <Row label="Investments" amount={overview.actualInvestmentSpent} color={ROW_COLOR.investments} />
        <Row label="Savings" amount={overview.monthlySavings} color={ROW_COLOR.savings} />
      </div>

      <div className="mt-4 rounded-xl bg-updown-up-muted p-4">
        <p className="text-sm font-semibold text-ink-primary">Net Savings</p>
        <p className="text-2xl font-bold text-ink-primary tabular-nums mt-0.5">{formatCurrency(overview.monthlySavings, 'INR', true)}</p>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-updown-up font-medium">{overview.savingsRate.toFixed(1)}% of income</p>
          {sparkData.length > 1 && (
            <div className="w-20 h-6">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparkData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                  <Line type="monotone" dataKey="v" stroke="#006300" strokeWidth={1.75} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
