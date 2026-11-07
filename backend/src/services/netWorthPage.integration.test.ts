import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import { changeSince, checkInBalances, getNetWorthPage } from './netWorthPage.service';
import { closeMonth } from './monthClose.service';
import { createLoan } from './loan.service';
import { createTransaction } from './transaction.service';
import { getBalanceSheet, getMonthFlows } from '../metrics';

beforeEach(async () => { await resetDatabase(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-06T06:00:00Z')); });
afterEach(() => vi.useRealTimers());
afterAll(() => prisma.$disconnect());

async function household() {
  const user = await prisma.user.create({ data: { name: 'F', email: 'nw@example.com', passwordHash: 'x' } });
  const bank = await prisma.account.create({ data: { userId: user.id, name: 'Bank', type: 'SAVINGS', balance: 100000 } });
  const cash = await prisma.account.create({ data: { userId: user.id, name: 'Cash', type: 'CASH', balance: 2000 } });
  return { user, bank, cash };
}

describe('net worth page', () => {
  it('splits the change since a close into bank, other assets and debt', () => {
    const lines = changeSince({ netWorth: 50000, totalDebt: 40000, bank: 60000 }, { netWorth: 55000, totalDebt: 35000, bankBalance: 58000 });
    expect(lines.map((l) => [l.key, l.then, l.now, l.change])).toEqual([
      ['bank', 60000, 58000, -2000],
      ['other', 30000, 32000, 2000],
      ['debt', 40000, 35000, -5000],
    ]);
  });

  it('lists assets and debts line by line, adding up to the balance sheet, with the trend from month closes', async () => {
    const { user, bank } = await household();
    await prisma.investment.create({ data: { userId: user.id, assetName: 'Index fund', assetType: 'MUTUAL_FUND', quantity: 10, buyPrice: 100, currentPrice: 150, enteredValue: 1500, purchaseDate: new Date('2026-01-01') } });
    await prisma.investment.create({ data: { userId: user.id, assetName: 'Gold coin', assetType: 'GOLD', quantity: 2, buyPrice: 6000, currentPrice: 7000, purchaseDate: new Date('2026-01-01') } });
    await prisma.p2PLoan.create({ data: { userId: user.id, personName: 'Ali', type: 'LENT', amount: 5000, remainingAmount: 3000, date: new Date('2026-09-01') } });
    await prisma.p2PLoan.create({ data: { userId: user.id, personName: 'Sara', type: 'BORROWED', amount: 1000, remainingAmount: 1000, date: new Date('2026-09-01') } });
    await createLoan(user.id, { name: 'Car', loanType: 'CAR', principal: 30000, interestRate: 0, emi: 10000, remainingBalance: 30000, tenureMonths: 3, startDate: '2026-01-05', autoDebit: false } as never);
    await closeMonth(user.id, '2026-10');
    await createTransaction(user.id, { type: 'EXPENSE', amount: 4000, date: '2026-11-04', accountId: bank.id, isRecurring: false });

    const page = await getNetWorthPage(user.id);
    expect(page.sheet).toEqual(await getBalanceSheet(user.id));
    expect(page.items.bank.map((b) => [b.name, b.amount])).toEqual([['Bank', 96000], ['Cash', 2000]]);
    expect(page.items.investments.map((i) => [i.name, i.amount])).toEqual([['Index fund', 1500]]);
    expect(page.items.gold.map((i) => [i.name, i.amount])).toEqual([['Gold coin', 14000]]);
    expect(page.items.lent.map((i) => [i.name, i.amount])).toEqual([['Ali', 3000]]);
    expect(page.items.borrowed.map((i) => [i.name, i.amount])).toEqual([['Sara', 1000]]);
    expect(page.items.loans.map((i) => [i.name, i.amount])).toEqual([['Car', 30000]]);
    expect(page.sheet.netWorth).toBe(98000 + 1500 + 14000 + 3000 - 30000 - 1000);
    expect(page.trend).toEqual([{ month: '2026-10', netWorth: page.sheet.netWorth + 4000, totalDebt: 31000, approximate: false }]);
    expect(page.sinceLastClose).toMatchObject({ month: '2026-10', change: -4000 });
    expect(page.sinceLastClose!.lines.find((l) => l.key === 'bank')!.change).toBe(-4000);
    expect(page.sinceLastClose!.lines.find((l) => l.key === 'other')!.change).toBe(0);
  });

  it('a balance check-in records ADJUST entries for the gaps, which are not income or spending', async () => {
    const { user, bank, cash } = await household();
    const results = await checkInBalances(user.id, [{ accountId: bank.id, balance: 98500.5 }, { accountId: cash.id, balance: 2000 }]);
    expect(results.map((r) => [r.name, r.adjustment])).toEqual([['Bank', -1499.5], ['Cash', 0]]);
    expect(results[1].transactionId).toBeNull();

    const entries = await prisma.transaction.findMany({ where: { userId: user.id } });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: 'ADJUST', type: 'EXPENSE', sourceType: 'BALANCE_CHECK', accountId: bank.id, period: '2026-11' });
    expect(Number(entries[0].amount)).toBe(1499.5);
    expect(Number((await prisma.account.findUniqueOrThrow({ where: { id: bank.id } })).balance)).toBe(98500.5);

    const flows = await getMonthFlows(user.id, '2026-11');
    expect(flows).toMatchObject({ income: 0, spend: 0 });

    await checkInBalances(user.id, [{ accountId: bank.id, balance: 100000 }]);
    expect((await prisma.transaction.findFirstOrThrow({ where: { userId: user.id, type: 'INCOME' } })).kind).toBe('ADJUST');
  });

  it('refuses card accounts, repeats and other households\' accounts', async () => {
    const { user, bank } = await household();
    const card = await prisma.account.create({ data: { userId: user.id, name: 'Card', type: 'CREDIT_CARD', balance: 0 } });
    const other = await prisma.user.create({ data: { name: 'O', email: 'other-nw@example.com', passwordHash: 'x' } });
    const theirs = await prisma.account.create({ data: { userId: other.id, name: 'Theirs', type: 'SAVINGS', balance: 10 } });
    await expect(checkInBalances(user.id, [{ accountId: card.id, balance: 5 }])).rejects.toThrow(/statements/);
    await expect(checkInBalances(user.id, [{ accountId: bank.id, balance: 5 }, { accountId: bank.id, balance: 6 }])).rejects.toThrow(/once/);
    await expect(checkInBalances(user.id, [{ accountId: theirs.id, balance: 5 }])).rejects.toThrow();
    expect(Number((await prisma.account.findUniqueOrThrow({ where: { id: theirs.id } })).balance)).toBe(10);
  });
});
