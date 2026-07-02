import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error.middleware';
import { CreateBudgetInput, UpdateBudgetInput } from '../validators/budget.validator';
import { resolveMonthRange } from '../lib/dateRange';

export type BudgetStatus = 'under' | 'near' | 'over';

/**
 * Pure function -- no I/O -- so the under/near/over classification and the
 * remaining/progress math can be unit tested without a database.
 */
export function calculateBudgetProgress(monthlyLimit: number, spent: number) {
  const remaining = monthlyLimit - spent;
  const progressPct = monthlyLimit > 0 ? (spent / monthlyLimit) * 100 : 0;
  const status: BudgetStatus = progressPct >= 100 ? 'over' : progressPct >= 80 ? 'near' : 'under';

  return { spent, remaining, progressPct, status };
}

async function getMonthlySpendByCategory(userId: string, categoryIds: string[], month?: number, year?: number) {
  const { start: startOfMonth, end: endOfMonth } = resolveMonthRange(month, year);

  const grouped = await prisma.transaction.groupBy({
    by: ['categoryId'],
    where: {
      userId,
      type: 'EXPENSE',
      categoryId: { in: categoryIds },
      date: { gte: startOfMonth, lte: endOfMonth },
    },
    _sum: { amount: true },
  });

  const spendMap = new Map<string, number>();
  for (const row of grouped) {
    if (row.categoryId) spendMap.set(row.categoryId, Number(row._sum.amount ?? 0));
  }
  return spendMap;
}

export async function getBudgets(userId: string, month?: number, year?: number) {
  const budgets = await prisma.budget.findMany({
    where: { userId },
    include: { category: { select: { id: true, name: true, icon: true, color: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const spendMap = await getMonthlySpendByCategory(userId, budgets.map((b) => b.categoryId), month, year);

  return budgets.map((b) => {
    const limit = Number(b.monthlyLimit);
    const spent = spendMap.get(b.categoryId) ?? 0;
    return { ...b, monthlyLimit: limit, ...calculateBudgetProgress(limit, spent) };
  });
}

export async function createBudget(userId: string, input: CreateBudgetInput) {
  const budget = await prisma.budget.create({
    data: { userId, categoryId: input.categoryId, monthlyLimit: input.monthlyLimit },
    include: { category: { select: { id: true, name: true, icon: true, color: true } } },
  });

  const spendMap = await getMonthlySpendByCategory(userId, [budget.categoryId]);
  const limit = Number(budget.monthlyLimit);
  const spent = spendMap.get(budget.categoryId) ?? 0;
  return { ...budget, monthlyLimit: limit, ...calculateBudgetProgress(limit, spent) };
}

export async function updateBudget(userId: string, id: string, input: UpdateBudgetInput) {
  const existing = await prisma.budget.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Budget not found', 404);

  const budget = await prisma.budget.update({
    where: { id },
    data: { monthlyLimit: input.monthlyLimit },
    include: { category: { select: { id: true, name: true, icon: true, color: true } } },
  });

  const spendMap = await getMonthlySpendByCategory(userId, [budget.categoryId]);
  const limit = Number(budget.monthlyLimit);
  const spent = spendMap.get(budget.categoryId) ?? 0;
  return { ...budget, monthlyLimit: limit, ...calculateBudgetProgress(limit, spent) };
}

export async function deleteBudget(userId: string, id: string) {
  const existing = await prisma.budget.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Budget not found', 404);
  await prisma.budget.delete({ where: { id } });
}
