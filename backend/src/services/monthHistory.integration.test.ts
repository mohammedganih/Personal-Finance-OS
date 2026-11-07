import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import { closeCurrentMonth, closePreviousMonthIfOpen, getMonthHistory } from './monthClose.service';
import { saveSalary } from './monthSummary.service';
import { createTransaction } from './transaction.service';

beforeEach(async () => { await resetDatabase(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-06T06:00:00Z')); });
afterEach(() => vi.useRealTimers());
afterAll(() => prisma.$disconnect());

async function household() {
  const user = await prisma.user.create({ data: { name: 'F', email: 'history@example.com', passwordHash: 'x' } });
  const a = await prisma.familyMember.create({ data: { userId: user.id, name: 'A', isDefault: true } });
  const bank = await prisma.account.create({ data: { userId: user.id, memberId: a.id, name: 'Bank', type: 'SAVINGS', balance: 50000 } });
  return { user, a, bank };
}

describe('month history', () => {
  it('closing this month early shows it as early, and the 1st closes it again with the final figures', async () => {
    const { user, a, bank } = await household();
    await saveSalary(user.id, { memberId: a.id, month: '2026-11', amount: 90000, accountId: bank.id });
    await createTransaction(user.id, { type: 'EXPENSE', amount: 2000, date: '2026-11-05', accountId: bank.id, memberId: a.id, isRecurring: false });

    const early = await closeCurrentMonth(user.id);
    expect(early.month).toBe('2026-11');
    let history = await getMonthHistory(user.id);
    expect(history).toMatchObject({ currentMonth: '2026-11', currentClosed: true });
    expect(history.months).toHaveLength(1);
    expect(history.months[0]).toMatchObject({ month: '2026-11', salary: 90000, spent: 2000, early: true, approximate: false });
    expect(history.months[0].leftOver).toBe(88000);
    expect(history.months[0].netWorth).toBe(138000);

    // More spending after the early close, then the daily job on 1 Dec.
    await createTransaction(user.id, { type: 'EXPENSE', amount: 1000, date: '2026-11-20', accountId: bank.id, memberId: a.id, isRecurring: false });
    vi.setSystemTime(new Date('2026-12-01T01:00:00Z'));
    expect(await closePreviousMonthIfOpen(user.id)).not.toBeNull();
    history = await getMonthHistory(user.id);
    expect(history.currentClosed).toBe(false);
    expect(history.months[0]).toMatchObject({ month: '2026-11', spent: 3000, early: false, netWorth: 137000 });
    // Already closed after month end: left alone.
    expect(await closePreviousMonthIfOpen(user.id)).toBeNull();
  });
});
