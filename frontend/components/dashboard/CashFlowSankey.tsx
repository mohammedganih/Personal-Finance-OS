'use client';

import { ShoppingBag, FileText, TrendingUp, PiggyBank, LucideIcon } from 'lucide-react';
import { useDashboardOverview } from '@/hooks/useDashboard';
import { formatCurrency } from '@/lib/format';

// Fixed viewBox the SVG bands are drawn in; HTML labels are positioned with
// matching percentages so both layers scale together regardless of the
// card's actual rendered width (preserveAspectRatio="none"). TARGET_X and
// the "Income" label zone both leave real room for their text so labels
// never overflow the card into its neighbor.
const VB_W = 400;
const VB_H = 220;
const SOURCE_X = 68;
const TARGET_X = 272;
const MIN_WIDTH = 10;
const MAX_WIDTH = 34;

interface Category { key: string; label: string; color: string; icon: LucideIcon; amount: number }

/**
 * Income -> Expenses / Bills & EMIs / Investments / Savings -- deliberately
 * not split into Needs/Lifestyle (no Category.spendType field exists, same
 * gap already flagged and skipped on the Analytics page). Uses actualX
 * fields (real transactions logged this month), not the effectiveX fields
 * (max of actual vs. full recurring commitment) -- those can each exceed
 * what was actually spent, so summing them double-counts and can blow past
 * 100% of income. otherExpenses + actualSubscription + actualEMI +
 * actualInvestment = monthlyExpenses by construction (dashboard.service),
 * and monthlyExpenses + monthlySavings = monthlyIncome, so these four
 * categories genuinely partition income -- what a flow diagram implies.
 *
 * Built as a custom flow diagram rather than recharts' Sankey: with real
 * data these four categories can differ by 100x (e.g. Bills & EMIs vs
 * Investments), and Sankey's raw value-proportional band width made small
 * categories vanish and large ones swallow the card. Band width here is
 * still ordered by proportion but clamped to a readable range, and every
 * band carries its own amount + percentage label regardless of width.
 */
export function CashFlowSankey() {
  const { data: overview, isLoading } = useDashboardOverview();

  if (isLoading || !overview) {
    return <div className="card-light rounded-2xl h-64 shimmer" />;
  }

  if (overview.monthlyIncome <= 0) {
    return (
      <div className="card-light rounded-2xl p-5 h-64 flex items-center justify-center text-sm text-ink-muted">
        Log some transactions to see your cash flow
      </div>
    );
  }

  const categories: Category[] = [
    { key: 'expenses', label: 'Expenses', color: '#2A78D6', icon: ShoppingBag, amount: overview.otherExpenses },
    { key: 'bills', label: 'Bills & EMIs', color: '#EB6834', icon: FileText, amount: overview.actualSubscriptionSpent + overview.actualEMISpent },
    { key: 'investments', label: 'Investments', color: '#4A3AA7', icon: TrendingUp, amount: overview.actualInvestmentSpent },
    { key: 'savings', label: 'Savings', color: '#008300', icon: PiggyBank, amount: overview.monthlySavings },
  ];

  const rowH = VB_H / categories.length;
  const rows = categories.map((c, i) => ({
    ...c,
    pct: (Math.max(0, c.amount) / overview.monthlyIncome) * 100,
    y: rowH * (i + 0.5),
  }));

  const sourceMidY = VB_H / 2;

  return (
    <div className="card-light rounded-2xl p-5 overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-ink-primary">Cash Flow Overview</h3>
        <span className="flex items-center gap-1.5 rounded-full bg-paper-subtle px-3 py-1 text-xs font-medium text-ink-primary">
          This Month
        </span>
      </div>

      <div className="relative h-64 mt-2">
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          <rect x={SOURCE_X} y={sourceMidY - 24} width={5} height={48} rx={2.5} fill="#10B981" />
          {rows.map((r) => {
            const width = MIN_WIDTH + (Math.min(100, r.pct) / 100) * (MAX_WIDTH - MIN_WIDTH);
            const midX = (SOURCE_X + TARGET_X) / 2;
            return (
              <path
                key={r.key}
                d={`M${SOURCE_X + 8},${sourceMidY} C${midX},${sourceMidY} ${midX},${r.y} ${TARGET_X - 6},${r.y}`}
                fill="none"
                stroke={r.color}
                strokeOpacity={0.3}
                strokeWidth={width}
                strokeLinecap="round"
              />
            );
          })}
        </svg>

        {/* Income label, in the reserved zone left of the source bar */}
        <div
          className="absolute flex flex-col justify-center"
          style={{ left: 0, width: `${((SOURCE_X - 10) / VB_W) * 100}%`, top: `${(sourceMidY / VB_H) * 100}%`, transform: 'translateY(-50%)' }}
        >
          <p className="text-xs font-medium text-ink-primary truncate">Income</p>
          <p className="text-[11px] text-ink-muted font-mono truncate">{formatCurrency(overview.monthlyIncome, 'INR', true)}</p>
        </div>

        {/* Category rows, in the reserved zone right of TARGET_X */}
        {rows.map((r) => (
          <div
            key={r.key}
            className="absolute flex items-center justify-between gap-2"
            style={{ left: `${(TARGET_X / VB_W) * 100}%`, right: 0, top: `${(r.y / VB_H) * 100}%`, transform: 'translateY(-50%)' }}
          >
            <span className="min-w-0">
              <p className="text-xs font-medium text-ink-primary truncate">{r.label}</p>
              <p className="text-[11px] text-ink-muted font-mono truncate">{formatCurrency(r.amount, 'INR', true)} ({r.pct.toFixed(1)}%)</p>
            </span>
            <span className="w-8 h-8 rounded-lg bg-paper-subtle flex items-center justify-center shrink-0">
              <r.icon className="w-4 h-4 text-ink-primary" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
