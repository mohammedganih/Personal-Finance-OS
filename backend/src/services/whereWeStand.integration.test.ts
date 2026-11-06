import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import { getWhereWeStand, monthsToRepay } from './whereWeStand.service';
import { closeMonth } from './monthClose.service';
import { createLoan } from './loan.service';
import { createTransaction } from './transaction.service';

beforeEach(async () => { await resetDatabase(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-06T06:00:00Z')); });
afterEach(() => vi.useRealTimers());
afterAll(() => prisma.$disconnect());

describe('where we stand', () => {
  it('months to repay a loan', () => {
    expect(monthsToRepay(30000, 10000, 0)).toBe(3);
    expect(monthsToRepay(100000, 500, 12)).toBeNull(); // EMI below the interest
  });

  it('net worth against the last close, buffer, and the month the last debt ends', async () => {
    const user = await prisma.user.create({ data: { name: 'F', email: 'wws@example.com', passwordHash: 'x' } });
    const bank = await prisma.account.create({ data: { userId: user.id, name: 'Bank', type: 'SAVINGS', balance: 100000 } });
    await createLoan(user.id, { name: 'Car', loanType: 'CAR', principal: 30000, interestRate: 0, emi: 10000, remainingBalance: 30000, tenureMonths: 3, startDate: '2026-01-05', autoDebit: false } as never);
    const card = await prisma.creditCard.create({ data: { userId: user.id, cardName: 'Card', creditLimit: 100000, statementDate: new Date('2026-07-09'), dueDate: new Date('2026-07-29') } });
    await prisma.cardEMI.create({ data: { userId: user.id, creditCardId: card.id, itemName: 'Laptop', totalAmount: 24000, emiAmount: 2000, tenureMonths: 12, startDate: new Date('2026-09-20') } });

    expect((await getWhereWeStand(user.id)).netWorthChange).toBeNull();
    await closeMonth(user.id, '2026-10');
    await createTransaction(user.id, { type: 'EXPENSE', amount: 4000, date: '2026-11-04', accountId: bank.id, isRecurring: false });

    const w = await getWhereWeStand(user.id);
    expect(w.netWorthChange).toEqual({ amount: -4000, sinceMonth: '2026-10', approximate: false });
    expect(w.netWorth).toBe(96000 - 30000 - 24000);
    expect(w.buffer.accounts.map((a) => a.name)).toEqual(['Bank']);
    // Car: Nov, Dec, Jan. Laptop: first due Oct 2026, 12 instalments, so the last is Sep 2027.
    expect(w.debt).toEqual({ total: 54000, lastEndsMonth: '2027-09', lastEndsName: 'Laptop' });
  });
});
