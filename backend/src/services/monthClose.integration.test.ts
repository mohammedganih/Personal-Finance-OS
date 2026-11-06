import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import { backfillMonthCloses, closeMonth, closePreviousMonthIfOpen, lastClose, positionAtMonthEnd } from './monthClose.service';
import { saveSalary } from './monthSummary.service';
import { createTransaction } from './transaction.service';
import { decideMonthlyPayment } from './monthlyPayments.service';
import { createLoan } from './loan.service';
import { getBalanceSheet } from '../metrics';

beforeEach(async () => { await resetDatabase(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-06T06:00:00Z')); });
afterEach(() => vi.useRealTimers());
afterAll(() => prisma.$disconnect());

async function household() {
  const user = await prisma.user.create({ data: { name: 'Family', email: 'close@example.com', passwordHash: 'x' } });
  const a = await prisma.familyMember.create({ data: { userId: user.id, name: 'Mohammed', isDefault: true } });
  const bank = await prisma.account.create({ data: { userId: user.id, memberId: a.id, name: 'Bank', type: 'SAVINGS', balance: 100000 } });
  return { user, a, bank };
}

describe('month close', () => {
  it('rolls today\'s balances and debt back to month end through the ledger', async () => {
    const { user, a, bank } = await household();
    const loan = await createLoan(user.id, { name: 'Car', loanType: 'CAR', principal: 50000, interestRate: 12, emi: 10000, remainingBalance: 50000, tenureMonths: 6, startDate: '2026-01-05', bankAccountId: bank.id } as never);
    await createTransaction(user.id, { type: 'EXPENSE', amount: 5000, date: '2026-10-20', accountId: bank.id, memberId: a.id, isRecurring: false }); // in October
    await createTransaction(user.id, { type: 'EXPENSE', amount: 3000, date: '2026-11-03', accountId: bank.id, memberId: a.id, isRecurring: false }); // after October
    await decideMonthlyPayment(user.id, 'LOAN', loan.id, 'PAID'); // 6 Nov: 500 interest + 9,500 principal
    const now = await getBalanceSheet(user.id);
    expect(now).toMatchObject({ bankBalance: 82000, loanDebt: 40500 });

    const oct = await positionAtMonthEnd(user.id, '2026-10');
    expect(oct.balances).toEqual([{ accountId: bank.id, name: 'Bank', balance: 95000 }]);
    expect(oct.totalDebt).toBe(now.totalDebt + 9500);
    expect(oct.netWorth).toBe(95000 - 50000);
  });

  it('freezes the sheet per person, closes last month once, and backfills earlier months as approximate', async () => {
    const { user, a, bank } = await household();
    await saveSalary(user.id, { memberId: a.id, month: '2026-08', amount: 90000, accountId: bank.id });
    await createTransaction(user.id, { type: 'EXPENSE', amount: 2000, date: '2026-10-10', accountId: bank.id, memberId: a.id, isRecurring: false });

    const oct = await closePreviousMonthIfOpen(user.id);
    expect(oct).toMatchObject({ month: '2026-10', approximate: false });
    expect((oct!.members as { name: string; salary: number; spentSoFar: number }[])[0]).toMatchObject({ name: 'Mohammed', salary: 90000, spentSoFar: 2000 });
    expect(await closePreviousMonthIfOpen(user.id)).toBeNull();

    expect(await backfillMonthCloses(user.id)).toEqual(['2026-08', '2026-09']);
    const closes = await prisma.monthClose.findMany({ where: { userId: user.id }, orderBy: { month: 'asc' } });
    expect(closes.map((c) => [c.month, c.approximate])).toEqual([['2026-08', true], ['2026-09', true], ['2026-10', false]]);
    expect((await lastClose(user.id))?.month).toBe('2026-10');

    // Closing again replaces, never duplicates.
    await closeMonth(user.id, '2026-10');
    expect(await prisma.monthClose.count({ where: { userId: user.id } })).toBe(3);
  });
});
