import { prisma } from '../lib/prisma';
import { QuickInsight } from '../types';
import { monthKey, resolveMonthRange } from '../lib/dateRange';
import { getBalanceSheet, getMonthFlows, getMonthFlowsRange, NOT_MOVES, outgoings, savingsRate } from '../metrics';
import { effectiveStatus, monthlyEquivalent } from '../lib/billSchedule';

/** Monthly cash-flow impact of all currently-active recurring bills. */
function monthlyBillCommitment(
  bills: { amount: unknown; frequency: Parameters<typeof monthlyEquivalent>[0]; customIntervalDays: number | null; status: Parameters<typeof effectiveStatus>[0]['status']; pausedUntil: Date | null }[],
  now: Date
): number {
  return bills
    .filter((b) => effectiveStatus(b, now) === 'ACTIVE')
    .reduce((s, b) => s + monthlyEquivalent(b.frequency, Number(b.amount), b.customIntervalDays), 0);
}

export async function getDashboardOverview(userId: string, month?: number, year?: number) {
  const { start: startOfMonth, end: endOfMonth } = resolveMonthRange(month, year);
  const now = new Date();

  // Net worth, debt and the month's flows all come from the metrics module, so
  // every page shows the same figures.
  const [sheet, flows, subscriptionRows, wealthRows, investments, loans, recurringBills, cardEmis] = await Promise.all([
    getBalanceSheet(userId, now),
    getMonthFlows(userId, monthKey(month, year)),
    prisma.transaction.aggregate({
      where: { userId, kind: 'SPEND', category: { name: 'Subscriptions' }, date: { gte: startOfMonth, lte: endOfMonth } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, kind: 'DEBT', isWealthTransfer: true, date: { gte: startOfMonth, lte: endOfMonth } },
      _sum: { amount: true },
    }),
    prisma.investment.findMany({ where: { userId, assetType: { in: ['SIP', 'RECURRING_DEPOSIT', 'GOLD_SCHEME'] } }, select: { monthlyAmount: true } }),
    prisma.loan.findMany({ where: { userId, isActive: true }, select: { emi: true } }),
    prisma.recurringBill.findMany({
      where: { userId, status: { not: 'ARCHIVED' } },
      select: { amount: true, frequency: true, customIntervalDays: true, status: true, pausedUntil: true },
    }),
    prisma.cardEMI.findMany({ where: { userId, isArchived: false }, select: { emiAmount: true } }),
  ]);

  const { netWorth, totalAssets, totalDebt, bankBalance, investmentValue } = sheet;
  const monthlyIncome = flows.income;
  // Money that left for good: spending plus debt repayments. Saving (SIP, RD,
  // gold) is kept, so it is not an expense.
  const monthlyExpenses = outgoings(flows);
  // Built wealth: investment payments plus EMI principal on an asset-linked loan.
  const monthlyWealthCreation = flows.save + Number(wealthRows._sum.amount ?? 0);
  const monthlySavings = monthlyIncome - monthlyExpenses;
  const savingsRatePct = savingsRate(flows);
  const debtRatio = totalAssets > 0 ? (totalDebt / totalAssets) * 100 : 0;

  const monthlyLoanEMI = loans.reduce((s, l) => s + Number(l.emi), 0);
  const monthlyCardEMI = cardEmis.reduce((s, e) => s + Number(e.emiAmount), 0);
  const totalSubscriptionCost = monthlyBillCommitment(recurringBills, now);
  const totalMonthlyEMI = monthlyLoanEMI + monthlyCardEMI;

  // Actual this month, by what the money was for.
  const actualInvestmentSpent = flows.save;
  const actualSubscriptionSpent = Number(subscriptionRows._sum.amount ?? 0);
  const actualEMISpent = flows.debt;
  const otherExpenses = Math.max(0, flows.spend - actualSubscriptionSpent);

  // Monthly SIP / RD / gold-scheme commitments.
  const monthlyInvestmentCommitment = investments.reduce((s, inv) => s + Number(inv.monthlyAmount || 0), 0);

  // Effective spent (takes max of actual logged spent vs commitment to ensure we cover unpaid/committed bills)
  const effectiveSubscriptionSpent = Math.max(actualSubscriptionSpent, totalSubscriptionCost);
  const effectiveInvestmentSpent = Math.max(actualInvestmentSpent, monthlyInvestmentCommitment);
  const effectiveEMISpent = Math.max(actualEMISpent, totalMonthlyEMI);

  const totalSpentAndCommitted = otherExpenses + effectiveSubscriptionSpent + effectiveInvestmentSpent + effectiveEMISpent;
  const remainingSafeToSave = Math.max(0, monthlyIncome - totalSpentAndCommitted);

  return {
    netWorth,
    totalAssets,
    totalLiabilities: totalDebt,
    monthlyIncome,
    monthlyExpenses,
    monthlyWealthCreation,
    monthlySavings,
    savingsRate: savingsRatePct,
    investmentValue,
    debtRatio,
    totalSubscriptionCost,
    bankBalance,
    monthlyLoanEMI,
    monthlyCardEMI,
    totalMonthlyEMI,
    remainingSafeToSave,
    monthlyInvestmentCommitment,
    actualInvestmentSpent,
    actualSubscriptionSpent,
    actualEMISpent,
    otherExpenses,
    effectiveSubscriptionSpent,
    effectiveInvestmentSpent,
    effectiveEMISpent,
  };
}

export async function getCashflowTrend(userId: string, months = 6, month?: number, year?: number) {
  // Expenses = spending + debt repayments; savings = what is left of income
  // (the same rule as the overview's savings rate). Transfers are not flows.
  const flows = await getMonthFlowsRange(userId, monthKey(month, year), months);
  return flows.map((f) => {
    const [y, m] = f.month.split('-').map(Number);
    const expenses = outgoings(f);
    return {
      month: new Date(y, m - 1, 1).toLocaleString('default', { month: 'short', year: '2-digit' }),
      income: f.income,
      expenses,
      savings: f.income - expenses,
    };
  });
}

export async function getExpenseBreakdown(userId: string, month?: number, year?: number) {
  const { start: startOfMonth, end: endOfMonth } = resolveMonthRange(month, year);

  const expenses = await prisma.transaction.groupBy({
    by: ['categoryId'],
    where: { userId, type: 'EXPENSE', ...NOT_MOVES, date: { gte: startOfMonth, lte: endOfMonth } },
    _sum: { amount: true },
    _count: true,
  });

  const total = expenses.reduce((s, e) => s + Number(e._sum.amount || 0), 0);

  const categories = await prisma.category.findMany({
    where: { id: { in: expenses.map((e) => e.categoryId).filter(Boolean) as string[] } },
    select: { id: true, name: true, icon: true, color: true },
  });

  const catMap = new Map(categories.map((c) => [c.id, c]));

  return expenses.map((e) => {
    const cat = e.categoryId ? catMap.get(e.categoryId) : null;
    const amount = Number(e._sum.amount || 0);
    return {
      categoryId: e.categoryId,
      categoryName: cat?.name ?? 'Uncategorized',
      color: cat?.color ?? '#6B7280',
      icon: cat?.icon ?? '📦',
      total: amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
      count: e._count,
    };
  });
}

export async function getQuickInsights(userId: string, month?: number, year?: number): Promise<QuickInsight[]> {
  const insights: QuickInsight[] = [];
  const [lastMonth, thisMonth] = await getMonthFlowsRange(userId, monthKey(month, year), 2);
  const thisIncome = thisMonth.income;
  const thisExpenses = outgoings(thisMonth);
  const lastExpenses = outgoings(lastMonth);

  if (thisIncome > 0) {
    const rate = savingsRate(thisMonth);
    insights.push({
      type: rate >= 30 ? 'positive' : 'neutral',
      message: `You saved ${rate.toFixed(0)}% of your income this month.`,
      icon: rate >= 30 ? '🎯' : '💡',
    });
  }

  if (lastExpenses > 0 && thisExpenses > 0) {
    const change = ((thisExpenses - lastExpenses) / lastExpenses) * 100;
    if (Math.abs(change) > 5) {
      insights.push({
        type: change > 0 ? 'increase' : 'decrease',
        message: `Expenses ${change > 0 ? 'increased' : 'decreased'} by ${Math.abs(change).toFixed(0)}% vs last month.`,
        icon: change > 0 ? '📈' : '📉',
      });
    }
  }

  const recurringBills = await prisma.recurringBill.findMany({
    where: { userId, status: { not: 'ARCHIVED' } },
    select: { amount: true, frequency: true, customIntervalDays: true, status: true, pausedUntil: true },
  });

  const billCost = monthlyBillCommitment(recurringBills, new Date());

  if (billCost > 0) {
    insights.push({
      type: 'neutral',
      message: `Recurring bills cost ₹${billCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}/month.`,
      icon: '📱',
    });
  }

  return insights;
}

export async function getRecentTransactions(userId: string, limit = 5) {
  const transactions = await prisma.transaction.findMany({
    where: { userId },
    include: {
      category: { select: { id: true, name: true, icon: true, color: true } },
      account: { select: { id: true, name: true } },
    },
    orderBy: { date: 'desc' },
    take: limit,
  });

  return transactions.map((t) => ({ ...t, amount: Number(t.amount) }));
}
