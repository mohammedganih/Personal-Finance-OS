import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import { bucketFlows, getBalanceSheet, getMonthFlows, getTotalDebt, savingsRate, unpaidStatements } from '.';
import { getDashboardOverview } from '../services/dashboard.service';
import { getBudgets } from '../services/budget.service';
import { createTransfer } from '../services/transaction.service';

beforeEach(async () => { await resetDatabase(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-20T06:00:00Z')); });
afterEach(() => vi.useRealTimers());
afterAll(() => prisma.$disconnect());

describe('pure helpers', () => {
  it('savings rate = (income − spend − debt) / income; saving is kept', () => {
    expect(savingsRate({ month: '2026-11', income: 100000, spend: 40000, save: 20000, debt: 30000 })).toBe(30);
    expect(savingsRate({ month: '2026-11', income: 0, spend: 10, save: 0, debt: 0 })).toBe(0);
  });

  it('buckets by India-time month and ignores transfers', () => {
    const rows = [
      { kind: 'INCOME' as const, amount: 100, date: new Date('2026-10-31T20:00:00Z') }, // 1 Nov in India
      { kind: 'SPEND' as const, amount: 30, date: new Date('2026-11-10T06:00:00Z') },
      { kind: 'TRANSFER' as const, amount: 999, date: new Date('2026-11-10T06:00:00Z') },
    ];
    expect(bucketFlows(rows, ['2026-10', '2026-11'])).toEqual([
      { month: '2026-10', income: 0, spend: 0, save: 0, debt: 0 },
      { month: '2026-11', income: 100, spend: 30, save: 0, debt: 0 },
    ]);
  });

  it('a statement is owed until card-bill payments for its month cover it', () => {
    const statements = [{ creditCardId: 'c1', month: '2026-11', totalDue: 10000 }, { creditCardId: 'c1', month: '2026-10', totalDue: 5000 }];
    const payments = [
      { entityId: 'c1', month: '2026-11', status: 'PAID', amount: 4000 },
      { entityId: 'c1', month: '2026-10', status: 'PAID', amount: 5000 },
      { entityId: 'c1', month: '2026-11', status: 'SKIPPED', amount: 6000 },
    ];
    expect(unpaidStatements(statements, payments)).toBe(6000);
  });
});

async function household() {
  const user = await prisma.user.create({ data: { name: 'Family', email: 'metrics@example.com', passwordHash: 'x' } });
  const bank = await prisma.account.create({ data: { userId: user.id, name: 'Bank', type: 'SAVINGS', balance: 200000 } });
  const other = await prisma.account.create({ data: { userId: user.id, name: 'Other bank', type: 'SAVINGS', balance: 0 } });
  // A card set up as an account must not count: card debt comes from statements and EMIs.
  await prisma.account.create({ data: { userId: user.id, name: 'Old card account', type: 'CREDIT_CARD', balance: -7000 } });
  await prisma.loan.create({ data: { userId: user.id, name: 'Car', loanType: 'CAR', principal: 500000, interestRate: 9, emi: 12000, remainingBalance: 300000, tenureMonths: 48, startDate: new Date('2025-01-05') } });
  const card = await prisma.creditCard.create({ data: { userId: user.id, cardName: 'Card', creditLimit: 100000, outstanding: 99999, dueDate: new Date('2026-11-29') } });
  await prisma.cardEMI.create({ data: { userId: user.id, creditCardId: card.id, itemName: 'Phone', totalAmount: 24000, emiAmount: 2000, tenureMonths: 12, emisPaid: 6, isNoCost: true, startDate: new Date('2026-05-01') } });
  await prisma.cardStatement.create({ data: { userId: user.id, creditCardId: card.id, month: '2026-11', totalDue: 20000, dueDate: new Date('2026-11-29'), statementDate: new Date('2026-11-11'), periodStart: new Date('2026-10-12') } });
  await prisma.dueStatus.create({ data: { userId: user.id, itemType: 'CARD_STATEMENT', itemId: card.id, period: '2026-11', status: 'PAID', amount: 5000 } });
  await prisma.p2PLoan.createMany({ data: [
    { userId: user.id, personName: 'Sam', type: 'LENT', amount: 10000, remainingAmount: 10000, date: new Date('2026-09-01') },
    { userId: user.id, personName: 'Uncle', type: 'BORROWED', amount: 50000, remainingAmount: 40000, date: new Date('2026-08-01') },
  ] });
  return { user, bank, other };
}

describe('balance sheet', () => {
  it('net worth = bank + investments + money lent − loans − card EMIs − unpaid statements − money borrowed', async () => {
    const { user } = await household();
    const sheet = await getBalanceSheet(user.id);
    expect(sheet).toMatchObject({
      bankBalance: 200000, investmentValue: 0, moneyLent: 10000, totalAssets: 210000,
      loanDebt: 300000, cardEmiDebt: 12000, cardStatementsDue: 15000, moneyBorrowed: 40000, totalDebt: 367000,
      netWorth: -157000,
    });
  });

  it('Home, Net worth and Loans all show the same debt', async () => {
    const { user } = await household();
    const [overview, total] = await Promise.all([getDashboardOverview(user.id), getTotalDebt(user.id)]);
    expect(overview.totalLiabilities).toBe(total);
    expect(overview.netWorth).toBe(-157000);
  });
});

describe('month flows', () => {
  it('counts by kind, keeps saving out of expenses and transfers out of everything', async () => {
    const { user, bank, other } = await household();
    const at = new Date('2026-11-05T06:00:00Z');
    await prisma.transaction.createMany({ data: [
      { userId: user.id, type: 'INCOME', kind: 'INCOME', amount: 100000, date: at },
      { userId: user.id, type: 'EXPENSE', kind: 'SPEND', amount: 30000, date: at },
      { userId: user.id, type: 'EXPENSE', kind: 'SAVE', amount: 20000, date: at },
      { userId: user.id, type: 'EXPENSE', kind: 'DEBT', amount: 12000, date: at },
      { userId: user.id, type: 'EXPENSE', kind: 'ADJUST', amount: 500, date: at },
    ] });
    await createTransfer(user.id, { fromAccountId: bank.id, toAccountId: other.id, amount: 50000, date: '2026-11-06' });

    expect(await getMonthFlows(user.id, '2026-11')).toEqual({ month: '2026-11', income: 100000, spend: 30000, save: 20000, debt: 12000 });
    const overview = await getDashboardOverview(user.id);
    expect(overview).toMatchObject({ monthlyIncome: 100000, monthlyExpenses: 42000, monthlySavings: 58000, actualInvestmentSpent: 20000, actualEMISpent: 12000 });
    expect(overview.savingsRate).toBeCloseTo(58, 6);
  });

  it('budgets count only everyday spending in their category', async () => {
    const { user } = await household();
    const cat = await prisma.category.create({ data: { userId: user.id, name: 'Gold', type: 'EXPENSE' } });
    await prisma.budget.create({ data: { userId: user.id, categoryId: cat.id, monthlyLimit: 10000 } });
    const at = new Date('2026-11-05T06:00:00Z');
    await prisma.transaction.createMany({ data: [
      { userId: user.id, type: 'EXPENSE', kind: 'SPEND', amount: 2500, date: at, categoryId: cat.id },
      { userId: user.id, type: 'EXPENSE', kind: 'SAVE', amount: 5000, date: at, categoryId: cat.id },
    ] });
    const [budget] = await getBudgets(user.id);
    expect(budget.spent).toBe(2500);
  });
});
