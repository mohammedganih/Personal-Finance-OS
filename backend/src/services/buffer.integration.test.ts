import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import { getBuffer, saveBufferSettings } from './buffer.service';
import { createLoan } from './loan.service';
import { createBill } from './bill.service';

beforeEach(async () => { await resetDatabase(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-06T06:00:00Z')); });
afterEach(() => vi.useRealTimers());
afterAll(() => prisma.$disconnect());

async function household() {
  const user = await prisma.user.create({ data: { name: 'Family', email: 'buffer@example.com', passwordHash: 'x' } });
  const savings = await prisma.account.create({ data: { userId: user.id, name: 'Savings', type: 'SAVINGS', balance: 200000, createdAt: new Date('2025-01-01') } });
  const salary = await prisma.account.create({ data: { userId: user.id, name: 'Salary', type: 'SAVINGS', balance: 50000, createdAt: new Date('2025-01-02') } });
  const current = await prisma.account.create({ data: { userId: user.id, name: 'Current', type: 'CHECKING', balance: 99999 } });
  // 10,000 EMI on the 20th from Savings (still pending), 2,000 bill on the 2nd from Salary (pending too).
  await createLoan(user.id, { name: 'Car', loanType: 'CAR', principal: 100000, interestRate: 0, emi: 10000, remainingBalance: 100000, tenureMonths: 10, startDate: '2026-01-20', paymentDay: 20, bankAccountId: savings.id, autoDebit: false } as never);
  await createBill(user.id, { name: 'Power', amount: 2000, startDate: '2026-11-02', frequency: 'MONTHLY', category: 'Utilities', currency: 'INR', reminderDays: 3, autoDebit: false, tags: [], accountId: salary.id });
  return { user, savings, salary, current };
}

describe('buffer', () => {
  it('defaults to every savings account, less what is still due from them, against 3 months of commitments', async () => {
    const { user } = await household();
    const b = await getBuffer(user.id);
    expect(b).toMatchObject({
      balance: 250000, pendingFromBuffer: 12000, amount: 238000,
      monthlyCommitments: 12000, defaultTarget: 36000, target: 36000, targetIsDefault: true, accountsAreDefault: true,
    });
    expect(b.accounts.map((a) => a.name)).toEqual(['Savings', 'Salary']);
  });

  it('uses the chosen accounts and target once saved, and refuses another household\'s account', async () => {
    const { user, savings } = await household();
    const b = await saveBufferSettings(user.id, { bufferTarget: 150000, bufferAccountIds: [savings.id] });
    expect(b).toMatchObject({ balance: 200000, pendingFromBuffer: 10000, amount: 190000, target: 150000, targetIsDefault: false, accountsAreDefault: false });

    const reset = await saveBufferSettings(user.id, { bufferTarget: null, bufferAccountIds: [] });
    expect(reset).toMatchObject({ targetIsDefault: true, accountsAreDefault: true });

    const other = await prisma.user.create({ data: { name: 'O', email: 'o-buf@example.com', passwordHash: 'x' } });
    const theirs = await prisma.account.create({ data: { userId: other.id, name: 'X', type: 'SAVINGS', balance: 1 } });
    await expect(saveBufferSettings(user.id, { bufferAccountIds: [theirs.id] })).rejects.toMatchObject({ status: 404 });
  });
});
