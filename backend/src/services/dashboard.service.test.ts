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

describe('dashboard.service month scoping', () => {

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

  it('investmentValue counts a SIP at the value entered for it', async () => {
    const userId = await setupUser();
    await prisma.investment.create({
      data: {
        userId, assetName: 'Test SIP', assetType: 'SIP',
        quantity: 100, currentPrice: 50, monthlyAmount: 5000, enteredValue: 5000,
        purchaseDate: new Date(), priceUpdatedAt: new Date(),
      },
    });

    const overview = await dashboardService.getDashboardOverview(userId);
    expect(overview.investmentValue).toBe(5000);
  });
});

describe('dashboard.service P2P debt in Net Worth', () => {
  // Regression coverage for the Phase 5 fix: money borrowed from an
  // individual used to be invisible to totalDebt/netWorth/debtRatio.

  it('a BORROWED P2P loan reduces netWorth and increases totalLiabilities by its remainingAmount', async () => {
    const userId = await setupUser();
    await prisma.account.create({ data: { userId, name: 'Bank', type: 'SAVINGS', balance: 100000 } });

    const baseline = await dashboardService.getDashboardOverview(userId);

    await prisma.p2PLoan.create({
      data: { userId, personName: 'Alex', type: 'BORROWED', amount: 20000, remainingAmount: 20000, date: new Date() },
    });

    const overview = await dashboardService.getDashboardOverview(userId);
    expect(overview.netWorth).toBeCloseTo(baseline.netWorth - 20000, 2);
    expect(overview.totalLiabilities).toBeCloseTo(baseline.totalLiabilities + 20000, 2);
  });

  // Money lent out is still ours: it counts as an asset (redesign plan, bug 3), never as a liability.
  it('a LENT P2P loan adds to assets and net worth, not to liabilities', async () => {
    const userId = await setupUser();
    await prisma.account.create({ data: { userId, name: 'Bank', type: 'SAVINGS', balance: 100000 } });

    const baseline = await dashboardService.getDashboardOverview(userId);

    await prisma.p2PLoan.create({
      data: { userId, personName: 'Sam', type: 'LENT', amount: 15000, remainingAmount: 15000, date: new Date() },
    });

    const overview = await dashboardService.getDashboardOverview(userId);
    expect(overview.netWorth).toBeCloseTo(baseline.netWorth + 15000, 2);
    expect(overview.totalAssets).toBeCloseTo(baseline.totalAssets + 15000, 2);
    expect(overview.totalLiabilities).toBeCloseTo(baseline.totalLiabilities, 2);
  });

  it('a settled BORROWED P2P loan is excluded from totalLiabilities', async () => {
    const userId = await setupUser();
    await prisma.account.create({ data: { userId, name: 'Bank', type: 'SAVINGS', balance: 100000 } });

    const baseline = await dashboardService.getDashboardOverview(userId);

    await prisma.p2PLoan.create({
      data: {
        userId, personName: 'Jordan', type: 'BORROWED', amount: 10000, remainingAmount: 0,
        date: new Date(), isSettled: true,
      },
    });

    const overview = await dashboardService.getDashboardOverview(userId);
    expect(overview.netWorth).toBeCloseTo(baseline.netWorth, 2);
  });
});
