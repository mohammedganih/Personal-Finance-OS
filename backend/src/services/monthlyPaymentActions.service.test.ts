import { describe, it, expect, vi, beforeEach } from 'vitest';
const { tx } = vi.hoisted(() => ({ tx: {
  loan: { findFirst: vi.fn(), update: vi.fn() }, investment: { findFirst: vi.fn(), update: vi.fn() },
  account: { findFirst: vi.fn(), update: vi.fn() },
  monthlyPayment: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn(), update: vi.fn() },
  transaction: { create: vi.fn() },
  ownershipSplit: { findUnique: vi.fn(), upsert: vi.fn() }, loanEvent: { create: vi.fn() },
} }));
vi.mock('../lib/prisma', () => ({ prisma: { $transaction: (fn: (client: typeof tx) => unknown) => fn(tx) } }));
vi.mock('../lib/paymentCategory', () => ({ findCategory: vi.fn().mockResolvedValue('category') }));
import { decideMonthlyPayment } from './monthlyPayments.service';
beforeEach(() => {
  vi.resetAllMocks();
  tx.loan.findFirst.mockResolvedValue({ id: 'loan', name: 'Home', remainingBalance: 3000, emi: 5000, interestRate: 12, startDate: new Date('2020-01-01'), bankAccountId: 'account' });
  tx.account.findFirst.mockResolvedValue({ id: 'account' });
  tx.monthlyPayment.create.mockResolvedValue({ id: 'event' });
  tx.transaction.create.mockImplementation(async ({ data }) => ({ id: 'txn', ...data }));
});
describe('monthly payment decisions', () => {
  it('rejects a duplicate payment before moving money', async () => {
    tx.monthlyPayment.findUnique.mockResolvedValue({ status: 'PAID' });
    await expect(decideMonthlyPayment('user', 'LOAN', 'loan', 'PAID')).rejects.toThrow('Already paid');
    expect(tx.transaction.create).not.toHaveBeenCalled();
    expect(tx.account.update).not.toHaveBeenCalled();
  });
  it('records skip without creating a transaction or changing the loan', async () => {
    await decideMonthlyPayment('user', 'LOAN', 'loan', 'SKIPPED');
    expect(tx.monthlyPayment.create).toHaveBeenCalled();
    expect(tx.transaction.create).not.toHaveBeenCalled();
    expect(tx.loan.update).not.toHaveBeenCalled();
  });
  it('logs capped principal and interest and debits the linked account', async () => {
    await decideMonthlyPayment('user', 'LOAN', 'loan', 'PAID');
    expect(tx.transaction.create.mock.calls.map(([arg]) => arg.data.amount)).toEqual([30, 3000]);
    expect(tx.account.update).toHaveBeenCalledWith({ where: { id: 'account' }, data: { balance: { decrement: 3030 } } });
  });
  it('rejects accounts owned by another user', async () => {
    tx.account.findFirst.mockResolvedValue(null);
    await expect(decideMonthlyPayment('user', 'LOAN', 'loan', 'PAID', 'foreign')).rejects.toThrow('Account not found');
    expect(tx.transaction.create).not.toHaveBeenCalled();
  });
});
