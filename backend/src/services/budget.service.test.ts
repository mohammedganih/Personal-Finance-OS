import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import * as authService from './auth.service';
import * as budgetService from './budget.service';
import { calculateBudgetProgress } from './budget.service';

describe('calculateBudgetProgress (pure)', () => {
  it('classifies comfortably-under-limit spending as under', () => {
    const result = calculateBudgetProgress(10000, 3000);
    expect(result.status).toBe('under');
    expect(result.remaining).toBe(7000);
    expect(result.progressPct).toBeCloseTo(30, 5);
  });

  it('classifies 80-99% of the limit as near', () => {
    const result = calculateBudgetProgress(10000, 8500);
    expect(result.status).toBe('near');
  });

  it('classifies at-or-over the limit as over', () => {
    const atLimit = calculateBudgetProgress(10000, 10000);
    expect(atLimit.status).toBe('over');

    const overLimit = calculateBudgetProgress(10000, 12000);
    expect(overLimit.status).toBe('over');
    expect(overLimit.remaining).toBe(-2000); // negative remaining is meaningful -- "how far over"
  });

  it('does not divide by zero for a zero-limit budget', () => {
    const result = calculateBudgetProgress(0, 500);
    expect(result.progressPct).toBe(0);
    expect(Number.isFinite(result.progressPct)).toBe(true);
  });
});

describe('budget.service integration', () => {
  beforeEach(resetDatabase);
  afterAll(() => prisma.$disconnect());

  async function setupUserWithCategory() {
    const { user } = await authService.register({
      name: 'Test User',
      email: `budget-${Date.now()}-${Math.random()}@example.com`,
      password: 'Password123',
    });
    const category = await prisma.category.create({
      data: { userId: user.id, name: 'Groceries Test', type: 'EXPENSE' },
    });
    return { userId: user.id, categoryId: category.id };
  }

  it('reports zero spend for a brand-new budget with no transactions', async () => {
    const { userId, categoryId } = await setupUserWithCategory();
    const budget = await budgetService.createBudget(userId, { categoryId, monthlyLimit: 5000 });

    expect(budget.spent).toBe(0);
    expect(budget.status).toBe('under');
  });

  it('reflects this month\'s expense transactions in that category', async () => {
    const { userId, categoryId } = await setupUserWithCategory();
    await budgetService.createBudget(userId, { categoryId, monthlyLimit: 5000 });

    await prisma.transaction.create({
      data: { userId, categoryId, type: 'EXPENSE', amount: 4200, date: new Date() },
    });

    const [budget] = await budgetService.getBudgets(userId);
    expect(budget.spent).toBe(4200);
    expect(budget.status).toBe('near'); // 84%
  });

  it('does not count income transactions or transactions in a different category', async () => {
    const { userId, categoryId } = await setupUserWithCategory();
    const otherCategory = await prisma.category.create({
      data: { userId, name: 'Other Test', type: 'EXPENSE' },
    });
    await budgetService.createBudget(userId, { categoryId, monthlyLimit: 5000 });

    await prisma.transaction.create({
      data: { userId, categoryId, type: 'INCOME', amount: 9999, date: new Date() },
    });
    await prisma.transaction.create({
      data: { userId, categoryId: otherCategory.id, type: 'EXPENSE', amount: 8888, date: new Date() },
    });

    const [budget] = await budgetService.getBudgets(userId);
    expect(budget.spent).toBe(0);
  });

  it('rejects a second budget for the same category', async () => {
    const { userId, categoryId } = await setupUserWithCategory();
    await budgetService.createBudget(userId, { categoryId, monthlyLimit: 5000 });

    await expect(
      prisma.budget.create({ data: { userId, categoryId, monthlyLimit: 3000 } })
    ).rejects.toThrow();
  });

  it('deleting the category cascades to its budget', async () => {
    const { userId, categoryId } = await setupUserWithCategory();
    const budget = await budgetService.createBudget(userId, { categoryId, monthlyLimit: 5000 });

    await prisma.category.delete({ where: { id: categoryId } });

    const stillExists = await prisma.budget.findUnique({ where: { id: budget.id } });
    expect(stillExists).toBeNull();
  });

  it('update and delete are scoped to the owning user', async () => {
    const { userId, categoryId } = await setupUserWithCategory();
    const { userId: otherUserId } = await setupUserWithCategory();
    const budget = await budgetService.createBudget(userId, { categoryId, monthlyLimit: 5000 });

    await expect(
      budgetService.updateBudget(otherUserId, budget.id, { monthlyLimit: 1 })
    ).rejects.toMatchObject({ status: 404 });

    await expect(
      budgetService.deleteBudget(otherUserId, budget.id)
    ).rejects.toMatchObject({ status: 404 });
  });
});
