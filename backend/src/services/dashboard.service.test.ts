import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import * as authService from './auth.service';
import * as dashboardService from './dashboard.service';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

async function setupUser() {
  const { user } = await authService.register({
    name: 'Test User',
    email: `dash-${Date.now()}-${Math.random()}@example.com`,
    password: 'Password123',
  });
  return user.id;
}

async function addExpense(userId: string, amount: number, date: Date, categoryId?: string) {
  await prisma.transaction.create({
    data: { userId, type: 'EXPENSE', amount, date, categoryId },
  });
}

describe('dashboard.service month scoping', () => {
  it('getExpenseBreakdown for a past month does not include the current month\'s spending', async () => {
    const userId = await setupUser();
    const category = await prisma.category.create({ data: { userId, name: 'Test Cat', type: 'EXPENSE' } });

    // Two months ago: 1000. This month: 5000.
    const now = new Date();
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 10);
    await addExpense(userId, 1000, twoMonthsAgo, category.id);
    await addExpense(userId, 5000, now, category.id);

    const breakdown = await dashboardService.getExpenseBreakdown(
      userId,
      twoMonthsAgo.getMonth() + 1,
      twoMonthsAgo.getFullYear()
    );

    expect(breakdown).toHaveLength(1);
    expect(breakdown[0].total).toBe(1000); // not 6000 -- this was the bug (missing upper date bound)
  });

  it('getDashboardOverview for a past month reflects only that month\'s income/expenses', async () => {
    const userId = await setupUser();
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 5);

    await prisma.transaction.create({ data: { userId, type: 'INCOME', amount: 20000, date: lastMonth } });
    await prisma.transaction.create({ data: { userId, type: 'INCOME', amount: 99999, date: now } });

    const overview = await dashboardService.getDashboardOverview(
      userId,
      lastMonth.getMonth() + 1,
      lastMonth.getFullYear()
    );

    expect(overview.monthlyIncome).toBe(20000);
  });

  it('getCashflowTrend anchored to a past month builds a window ending at that month, not today', async () => {
    const userId = await setupUser();
    const now = new Date();
    const anchor = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    await prisma.transaction.create({ data: { userId, type: 'INCOME', amount: 7000, date: anchor } });
    // This should NOT appear in a 3-month trend ending 3 months ago.
    await prisma.transaction.create({ data: { userId, type: 'INCOME', amount: 50000, date: now } });

    const trend = await dashboardService.getCashflowTrend(
      userId,
      3,
      anchor.getMonth() + 1,
      anchor.getFullYear()
    );

    expect(trend).toHaveLength(3);
    const totalIncome = trend.reduce((s, m) => s + m.income, 0);
    expect(totalIncome).toBe(7000); // the 50000 from "now" must not leak in
  });

  it('with no month/year passed, behaves exactly as "this month" (backward compatible)', async () => {
    const userId = await setupUser();
    await prisma.transaction.create({ data: { userId, type: 'INCOME', amount: 4321, date: new Date() } });

    const overview = await dashboardService.getDashboardOverview(userId);
    expect(overview.monthlyIncome).toBe(4321);
  });

  it('investmentValue values a Recurring Deposit by deposits + accrued interest, not quantity*currentPrice', async () => {
    const userId = await setupUser();
    // RD form never collects currentPrice (it stays 0) -- quantity is
    // installments paid. The old naive quantity*currentPrice formula valued
    // this at ₹0 no matter how much was actually deposited.
    await prisma.investment.create({
      data: {
        userId, assetName: 'Test RD', assetType: 'RECURRING_DEPOSIT',
        quantity: 4, currentPrice: 0, monthlyAmount: 30000, interestRate: 6,
        purchaseDate: new Date(),
      },
    });

    const overview = await dashboardService.getDashboardOverview(userId);
    expect(overview.investmentValue).toBeGreaterThan(100000); // 4 * 30000 deposited, plus interest
  });

  it('investmentValue matches a simple SIP\'s quantity*currentPrice (the one case where the old formula was coincidentally right)', async () => {
    const userId = await setupUser();
    await prisma.investment.create({
      data: {
        userId, assetName: 'Test SIP', assetType: 'SIP',
        quantity: 100, currentPrice: 50, monthlyAmount: 5000,
        purchaseDate: new Date(),
      },
    });

    const overview = await dashboardService.getDashboardOverview(userId);
    expect(overview.investmentValue).toBe(5000); // 100 * 50
  });
});
