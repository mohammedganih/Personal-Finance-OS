import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import { getMonthlyPlan } from './monthlyPayments.service';

beforeEach(async () => { await resetDatabase(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-04T06:00:00Z')); });
afterEach(() => vi.useRealTimers());
afterAll(() => prisma.$disconnect());

async function closedLoan() {
  const user = await prisma.user.create({ data: { name: 'Family', email: 'close@example.com', passwordHash: 'test' } });
  // Edited today (updatedAt = 4 Nov), long after it closed.
  const loan = await prisma.loan.create({ data: { userId: user.id, name: 'Bike', loanType: 'CAR', principal: 60000, interestRate: 0, emi: 5000, remainingBalance: 0, tenureMonths: 12, startDate: new Date('2026-01-05'), isActive: false } });
  return { user, loan };
}
const loanRows = async (userId: string, month: string) => (await getMonthlyPlan(userId, month)).rows.filter(r => r.type === 'LOAN');

describe('closed loans in earlier months', () => {
  it('uses the CLOSED history entry, not the last edit, as the close date', async () => {
    const { user, loan } = await closedLoan();
    await prisma.loanEvent.create({ data: { userId: user.id, loanId: loan.id, type: 'CLOSED', date: new Date('2026-09-15'), balanceBefore: 5000, balanceAfter: 0 } });
    // August: still being repaid. October: already closed, even though the loan was edited in November.
    expect(await loanRows(user.id, '2026-08')).toHaveLength(1);
    expect(await loanRows(user.id, '2026-10')).toHaveLength(0);
  });

  it('takes the latest CLOSED entry when a loan was closed, reopened and closed again', async () => {
    const { user, loan } = await closedLoan();
    await prisma.loanEvent.create({ data: { userId: user.id, loanId: loan.id, type: 'CLOSED', date: new Date('2026-06-10') } });
    await prisma.loanEvent.create({ data: { userId: user.id, loanId: loan.id, type: 'CLOSED', date: new Date('2026-09-15') } });
    expect(await loanRows(user.id, '2026-08')).toHaveLength(1);
  });

  it('falls back to the last edit when the loan has no CLOSED entry', async () => {
    const { user } = await closedLoan();
    expect(await loanRows(user.id, '2026-10')).toHaveLength(1);
  });
});
