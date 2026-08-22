'use client';

import { useDashboardOverview, useExpenseBreakdown } from '@/hooks/useDashboard';
import { formatCurrency } from '@/lib/format';

// Fixed viewBox the SVG bands are drawn in; HTML labels are positioned with
// matching percentages so both layers scale together regardless of the
// card's actual rendered width (preserveAspectRatio="none"), same technique
// as the Dashboard's CashFlowSankey.
const VB_W = 640;
const SOURCE_X = 88;
const MID_X = 224;
const MID_LABEL_END = 384;
const TARGET_X = 480;
const MIN_W1 = 10, MAX_W1 = 30;
const MIN_W2 = 4, MAX_W2 = 14;

// Same 4-bucket palette as the Dashboard's CashFlowSankey, reused
// deliberately so the two pages read as the same breakdown.
const BUCKET_COLOR = { investments: '#4A3AA7', expenses: '#2A78D6', bills: '#EB6834', savings: '#008300' };

// Categories that dashboard.service.ts's otherExpenses already excludes
// from "real" spending (Investment/Subscriptions/EMI have their own
// buckets) -- filtered out here so the Expenses branch's children sum to
// the same otherExpenses figure the Expenses node itself shows.
const EXCLUDED_EXPENSE_CATEGORIES = ['Investment', 'Subscriptions', 'Loan EMI', 'Card EMI'];
const TOP_CATEGORIES = 5;

interface FlowChild { key: string; label: string; amount: number; icon: string }

export function MoneyFlowDiagram() {
  const { data: overview, isLoading: overviewLoading } = useDashboardOverview();
  const { data: breakdown, isLoading: breakdownLoading } = useExpenseBreakdown();

  if (overviewLoading || breakdownLoading || !overview) {
    return <div className="h-[420px] rounded-2xl shimmer" />;
  }

  if (overview.monthlyIncome <= 0) {
    return (
      <div className="h-[420px] flex items-center justify-center text-sm text-ink-muted">
        Log some transactions to see your money flow
      </div>
    );
  }

  const income = overview.monthlyIncome;

  const expenseCategories = (breakdown ?? [])
    .filter((c) => !EXCLUDED_EXPENSE_CATEGORIES.includes(c.categoryName))
    .sort((a, b) => b.total - a.total);
  const topCategories = expenseCategories.slice(0, TOP_CATEGORIES);
  const otherCategoriesTotal = expenseCategories.slice(TOP_CATEGORIES).reduce((s, c) => s + c.total, 0);

  const expenseChildren: FlowChild[] = topCategories.map((c) => ({
    key: c.categoryId ?? c.categoryName, label: c.categoryName, amount: c.total, icon: c.icon,
  }));
  if (otherCategoriesTotal > 0) expenseChildren.push({ key: 'others', label: 'Others', amount: otherCategoriesTotal, icon: '📦' });

  const billsChildren: FlowChild[] = [];
  if (overview.actualEMISpent > 0) billsChildren.push({ key: 'emi', label: 'EMIs', amount: overview.actualEMISpent, icon: '🏦' });
  if (overview.actualSubscriptionSpent > 0) billsChildren.push({ key: 'subs', label: 'Bills & Subscriptions', amount: overview.actualSubscriptionSpent, icon: '🧾' });

  const buckets = [
    { key: 'investments', label: 'Investments', amount: overview.actualInvestmentSpent, color: BUCKET_COLOR.investments, children: [] as FlowChild[] },
    { key: 'expenses', label: 'Expenses', amount: overview.otherExpenses, color: BUCKET_COLOR.expenses, children: expenseChildren },
    { key: 'bills', label: 'Bills & EMIs', amount: overview.actualSubscriptionSpent + overview.actualEMISpent, color: BUCKET_COLOR.bills, children: billsChildren },
    { key: 'savings', label: 'Savings', amount: overview.monthlySavings, color: BUCKET_COLOR.savings, children: [] as FlowChild[] },
  ];

  const level2Count = buckets.reduce((s, b) => s + b.children.length, 0);
  const VB_H = Math.max(280, level2Count * 44);

  const rowH1 = VB_H / buckets.length;
  const rows1 = buckets.map((b, i) => ({ ...b, pct: (Math.max(0, b.amount) / income) * 100, y: rowH1 * (i + 0.5) }));

  const rowH2 = level2Count > 0 ? VB_H / level2Count : 0;
  let idx2 = 0;
  const rows2 = rows1.flatMap((b) =>
    b.children.map((c) => {
      const row = { ...c, color: b.color, parentY: b.y, pct: (Math.max(0, c.amount) / income) * 100, y: rowH2 * (idx2 + 0.5) };
      idx2 += 1;
      return row;
    })
  );

  const sourceMidY = VB_H / 2;
  const mid1X = (SOURCE_X + MID_X) / 2;
  const mid2X = (MID_LABEL_END + TARGET_X) / 2;

  return (
    <div className="rounded-2xl p-1">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-ink-primary">Money Flow Overview</h3>
          <p className="text-xs text-ink-muted">Where your money came from and where it went</p>
        </div>
      </div>

      <div className="relative" style={{ height: VB_H }}>
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          <rect x={SOURCE_X} y={sourceMidY - 24} width={5} height={48} rx={2.5} fill="#10B981" />

          {rows1.map((r) => {
            const width = MIN_W1 + (Math.min(100, r.pct) / 100) * (MAX_W1 - MIN_W1);
            return (
              <path
                key={r.key}
                d={`M${SOURCE_X + 8},${sourceMidY} C${mid1X},${sourceMidY} ${mid1X},${r.y} ${MID_X - 6},${r.y}`}
                fill="none" stroke={r.color} strokeOpacity={0.28} strokeWidth={width} strokeLinecap="round"
              />
            );
          })}

          {rows2.map((r) => {
            const width = MIN_W2 + (Math.min(100, r.pct) / 100) * (MAX_W2 - MIN_W2);
            return (
              <path
                key={r.key}
                d={`M${MID_LABEL_END + 8},${r.parentY} C${mid2X},${r.parentY} ${mid2X},${r.y} ${TARGET_X - 6},${r.y}`}
                fill="none" stroke={r.color} strokeOpacity={0.22} strokeWidth={width} strokeLinecap="round"
              />
            );
          })}
        </svg>

        <div
          className="absolute flex flex-col justify-center"
          style={{ left: 0, width: `${((SOURCE_X - 8) / VB_W) * 100}%`, top: `${(sourceMidY / VB_H) * 100}%`, transform: 'translateY(-50%)' }}
        >
          <p className="text-xs font-medium text-ink-primary truncate">Total Income</p>
          <p className="text-[11px] text-ink-muted font-mono truncate">{formatCurrency(income, 'INR', true)}</p>
          <p className="text-[10px] text-ink-muted">100%</p>
        </div>

        {rows1.map((r) => (
          <div
            key={r.key}
            className="absolute flex flex-col justify-center"
            style={{ left: `${((MID_X + 10) / VB_W) * 100}%`, width: `${((MID_LABEL_END - MID_X - 16) / VB_W) * 100}%`, top: `${(r.y / VB_H) * 100}%`, transform: 'translateY(-50%)' }}
          >
            <p className="text-xs font-medium text-ink-primary truncate">{r.label}</p>
            <p className="text-[11px] text-ink-muted font-mono truncate">{formatCurrency(r.amount, 'INR', true)} · {r.pct.toFixed(1)}%</p>
          </div>
        ))}

        {rows2.map((r) => (
          <div
            key={r.key}
            className="absolute flex items-center gap-2"
            style={{ left: `${((TARGET_X + 10) / VB_W) * 100}%`, right: 0, top: `${(r.y / VB_H) * 100}%`, transform: 'translateY(-50%)' }}
          >
            <span className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-ink-primary truncate">{r.label}</p>
              <p className="text-[10px] text-ink-muted font-mono truncate">{formatCurrency(r.amount, 'INR', true)} · {r.pct.toFixed(1)}%</p>
            </span>
            <span className="w-6 h-6 rounded-md flex items-center justify-center text-xs shrink-0" style={{ background: `${r.color}1F` }}>
              {r.icon}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
