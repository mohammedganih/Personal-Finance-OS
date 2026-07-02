import { BillingCycle } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { QuickInsight } from '../types';

const BILLING_MULTIPLIERS: Record<BillingCycle, number> = {
  MONTHLY: 1, QUARTERLY: 1 / 3, HALF_YEARLY: 1 / 6, YEARLY: 1 / 12,
};

export async function getDashboardOverview(userId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [transactions, investments, loans, accounts, subscriptions, cardEmis] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, date: { gte: startOfMonth, lte: endOfMonth } },
      select: { type: true, amount: true, category: { select: { name: true } } },
    }),
    prisma.investment.findMany({
      where: { userId },
      select: { quantity: true, currentPrice: true, monthlyAmount: true, assetType: true },
    }),
    prisma.loan.findMany({
      where: { userId, isActive: true },
      select: { remainingBalance: true, emi: true },
    }),
    prisma.account.findMany({
      where: { userId },
      select: { balance: true },
    }),
    prisma.subscription.findMany({
      where: { userId, isActive: true },
      select: { amount: true, billingCycle: true },
    }),
    prisma.cardEMI.findMany({
      where: { userId, isArchived: false },
      select: { emiAmount: true, totalAmount: true, tenureMonths: true, emisPaid: true, isNoCost: true, interestRate: true },
    }),
  ]);

  const monthlyIncome = transactions
    .filter((t) => t.type === 'INCOME')
    .reduce((s, t) => s + Number(t.amount), 0);

  const monthlyExpenses = transactions
    .filter((t) => t.type === 'EXPENSE')
    .reduce((s, t) => s + Number(t.amount), 0);

  const investmentValue = investments.reduce(
    (s, i) => s + Number(i.quantity) * Number(i.currentPrice),
    0
  );

  const loanDebt = loans.reduce((s, l) => s + Number(l.remainingBalance), 0);
  const monthlyLoanEMI = loans.reduce((s, l) => s + Number(l.emi), 0);

  // Card EMIs: monthly burden + outstanding
  const monthlyCardEMI = cardEmis.reduce((s, e) => s + Number(e.emiAmount), 0);
  const cardEMIDebt = cardEmis.reduce((s, e) => {
    const remaining = Math.max(0, e.tenureMonths - e.emisPaid);
    if (e.isNoCost || !e.interestRate) return s + Number(e.emiAmount) * remaining;
    const r = Number(e.interestRate) / 100 / 12;
    const P = Number(e.totalAmount);
    const n = e.emisPaid;
    const E = Number(e.emiAmount);
    if (r <= 0) return s + E * remaining;
    const outstanding = P * Math.pow(1 + r, n) - E * (Math.pow(1 + r, n) - 1) / r;
    return s + Math.max(0, outstanding);
  }, 0);

  const totalDebt = loanDebt + cardEMIDebt;
  const bankBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const totalAssets = bankBalance + investmentValue;
  const netWorth = totalAssets - totalDebt;

  const monthlySavings = monthlyIncome - monthlyExpenses;
  const savingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;
  const debtRatio = totalAssets > 0 ? (totalDebt / totalAssets) * 100 : 0;

  const totalSubscriptionCost = subscriptions.reduce((s, sub) => {
    return s + Number(sub.amount) * (BILLING_MULTIPLIERS[sub.billingCycle] ?? 1);
  }, 0);

  const totalMonthlyEMI = monthlyLoanEMI + monthlyCardEMI;

  // Actual spent on these specific categories this month
  const actualInvestmentSpent = transactions
    .filter((t) => t.type === 'EXPENSE' && t.category?.name === 'Investment')
    .reduce((s, t) => s + Number(t.amount), 0);

  const actualSubscriptionSpent = transactions
    .filter((t) => t.type === 'EXPENSE' && t.category?.name === 'Subscriptions')
    .reduce((s, t) => s + Number(t.amount), 0);

  const actualEMISpent = transactions
    .filter((t) => t.type === 'EXPENSE' && (t.category?.name === 'Loan EMI' || t.category?.name === 'Card EMI'))
    .reduce((s, t) => s + Number(t.amount), 0);

  const otherExpenses = Math.max(0, monthlyExpenses - actualInvestmentSpent - actualSubscriptionSpent - actualEMISpent);

  // Monthly investment SIP / recurring commitments from investments table
  const monthlyInvestmentCommitment = investments
    .filter((inv) => ['SIP', 'RECURRING_DEPOSIT', 'GOLD_SCHEME'].includes(inv.assetType))
    .reduce((s, inv) => s + Number(inv.monthlyAmount || 0), 0);

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
    monthlySavings,
    savingsRate,
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

export async function getCashflowTrend(userId: string, months = 6) {
  const result = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

    const transactions = await prisma.transaction.findMany({
      where: { userId, date: { gte: start, lte: end } },
      select: { type: true, amount: true },
    });

    const income = transactions
      .filter((t) => t.type === 'INCOME')
      .reduce((s, t) => s + Number(t.amount), 0);
    const expenses = transactions
      .filter((t) => t.type === 'EXPENSE')
      .reduce((s, t) => s + Number(t.amount), 0);

    result.push({
      month: date.toLocaleString('default', { month: 'short', year: '2-digit' }),
      income,
      expenses,
      savings: income - expenses,
    });
  }

  return result;
}

export async function getExpenseBreakdown(userId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const expenses = await prisma.transaction.groupBy({
    by: ['categoryId'],
    where: { userId, type: 'EXPENSE', date: { gte: startOfMonth } },
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

export async function getQuickInsights(userId: string): Promise<QuickInsight[]> {
  const insights: QuickInsight[] = [];
  const now = new Date();

  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const [thisMonth, lastMonth] = await Promise.all([
    prisma.transaction.findMany({ where: { userId, date: { gte: thisMonthStart } } }),
    prisma.transaction.findMany({
      where: { userId, date: { gte: lastMonthStart, lte: lastMonthEnd } },
    }),
  ]);

  const thisIncome = thisMonth.filter((t) => t.type === 'INCOME').reduce((s, t) => s + Number(t.amount), 0);
  const thisExpenses = thisMonth.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.amount), 0);
  const lastExpenses = lastMonth.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.amount), 0);

  if (thisIncome > 0) {
    const rate = ((thisIncome - thisExpenses) / thisIncome) * 100;
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

  const subscriptions = await prisma.subscription.findMany({
    where: { userId, isActive: true },
    select: { amount: true, billingCycle: true },
  });

  const subCost = subscriptions.reduce((s, sub) => {
    return s + Number(sub.amount) * (BILLING_MULTIPLIERS[sub.billingCycle] ?? 1);
  }, 0);

  if (subCost > 0) {
    insights.push({
      type: 'neutral',
      message: `Subscriptions cost ₹${subCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}/month.`,
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
