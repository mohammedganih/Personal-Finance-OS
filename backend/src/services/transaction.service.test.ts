import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import * as authService from './auth.service';
import * as transactionService from './transaction.service';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

async function setupUserWithAccount(startingBalance = 10000) {
  const { user } = await authService.register({
    name: 'Test User',
    email: `test-${Date.now()}-${Math.random()}@example.com`,
    password: 'Password123',
  });
  const account = await prisma.account.create({
    data: { userId: user.id, name: 'Test Account', type: 'SAVINGS', balance: startingBalance },
  });
  return { userId: user.id, accountId: account.id };
}

async function getBalance(accountId: string) {
  const account = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });
  return Number(account.balance);
}

// createTransaction's return type is a loosely-typed Record<string, unknown>;
// narrow it here once rather than casting at every call site below.
async function createTxn(...args: Parameters<typeof transactionService.createTransaction>) {
  const result = await transactionService.createTransaction(...args);
  return result as unknown as { id: string };
}

describe('transaction.service balance sync', () => {
  // This suite exists specifically to guard the bug fixed in this project's
  // Phase 0: Account.balance used to only be adjusted on create, silently
  // drifting on every edit/delete of a transaction linked to an account.

  it('create: EXPENSE decreases the linked account balance', async () => {
    const { userId, accountId } = await setupUserWithAccount(10000);
    await transactionService.createTransaction(userId, {
      type: 'EXPENSE', amount: 1500, date: '2026-01-01', accountId, isRecurring: false,
    });
    expect(await getBalance(accountId)).toBeCloseTo(8500, 2);
  });

  it('create: INCOME increases the linked account balance', async () => {
    const { userId, accountId } = await setupUserWithAccount(10000);
    await transactionService.createTransaction(userId, {
      type: 'INCOME', amount: 2000, date: '2026-01-01', accountId, isRecurring: false,
    });
    expect(await getBalance(accountId)).toBeCloseTo(12000, 2);
  });

  it('create: without an accountId, no account is touched', async () => {
    const { userId, accountId } = await setupUserWithAccount(10000);
    await transactionService.createTransaction(userId, {
      type: 'EXPENSE', amount: 1500, date: '2026-01-01', isRecurring: false,
    });
    expect(await getBalance(accountId)).toBeCloseTo(10000, 2);
  });

  it('update: changing the amount reverses the old delta and applies the new one', async () => {
    const { userId, accountId } = await setupUserWithAccount(10000);
    const txn = await createTxn(userId, {
      type: 'EXPENSE', amount: 1000, date: '2026-01-01', accountId, isRecurring: false,
    });
    expect(await getBalance(accountId)).toBeCloseTo(9000, 2); // sanity check

    await transactionService.updateTransaction(userId, txn.id, { amount: 4000 });
    expect(await getBalance(accountId)).toBeCloseTo(6000, 2); // 10000 - 4000, not 9000 - 4000
  });

  it('update: changing type from EXPENSE to INCOME flips the balance impact', async () => {
    const { userId, accountId } = await setupUserWithAccount(10000);
    const txn = await createTxn(userId, {
      type: 'EXPENSE', amount: 1000, date: '2026-01-01', accountId, isRecurring: false,
    });

    await transactionService.updateTransaction(userId, txn.id, { type: 'INCOME' });
    expect(await getBalance(accountId)).toBeCloseTo(11000, 2); // 10000 + 1000, not 10000 - 1000
  });

  it('update: moving a transaction to a different account debits the new one and credits back the old one', async () => {
    const { userId, accountId } = await setupUserWithAccount(10000);
    const otherAccount = await prisma.account.create({
      data: { userId, name: 'Other Account', type: 'SAVINGS', balance: 5000 },
    });

    const txn = await createTxn(userId, {
      type: 'EXPENSE', amount: 1000, date: '2026-01-01', accountId, isRecurring: false,
    });
    expect(await getBalance(accountId)).toBeCloseTo(9000, 2);

    await transactionService.updateTransaction(userId, txn.id, { accountId: otherAccount.id });

    expect(await getBalance(accountId)).toBeCloseTo(10000, 2); // fully reversed
    expect(await getBalance(otherAccount.id)).toBeCloseTo(4000, 2); // 5000 - 1000
  });

  it('delete: reverses the balance impact', async () => {
    const { userId, accountId } = await setupUserWithAccount(10000);
    const txn = await createTxn(userId, {
      type: 'EXPENSE', amount: 1500, date: '2026-01-01', accountId, isRecurring: false,
    });
    expect(await getBalance(accountId)).toBeCloseTo(8500, 2);

    await transactionService.deleteTransaction(userId, txn.id);
    expect(await getBalance(accountId)).toBeCloseTo(10000, 2);
  });

  it('delete: a transaction with no accountId leaves accounts untouched', async () => {
    const { userId, accountId } = await setupUserWithAccount(10000);
    const txn = await createTxn(userId, {
      type: 'EXPENSE', amount: 1500, date: '2026-01-01', isRecurring: false,
    });

    await transactionService.deleteTransaction(userId, txn.id);
    expect(await getBalance(accountId)).toBeCloseTo(10000, 2);
  });
});
