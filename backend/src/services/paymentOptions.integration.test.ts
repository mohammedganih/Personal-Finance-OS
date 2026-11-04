import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import { decideMonthlyPayment, getMonthlyPlan, previousMonth } from './monthlyPayments.service';
import { payInvestment } from './investment.service';
import { undoPayment } from './paymentUndo.service';

beforeEach(async () => { await resetDatabase(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-04T06:00:00Z')); });
afterEach(() => vi.useRealTimers());
afterAll(() => prisma.$disconnect());

async function setup() {
  const user = await prisma.user.create({ data: { name: 'Options test', email: 'options@example.com', passwordHash: 'test' } });
  const account = await prisma.account.create({ data: { userId: user.id, name: 'Bank', type: 'SAVINGS', balance: 100000 } });
  const sip = await prisma.investment.create({ data: { userId: user.id, assetName: 'SIP', assetType: 'SIP', purchaseDate: new Date('2026-06-05'), monthlyAmount: 2500, bankAccountId: account.id } });
  const loan = await prisma.loan.create({ data: { userId: user.id, name: 'Loan', loanType: 'PERSONAL', principal: 10000, remainingBalance: 10000, emi: 2000, tenureMonths: 5, interestRate: 0, startDate: new Date('2026-08-01'), bankAccountId: account.id } });
  return { user, account, sip, loan };
}

describe('payment options', () => {
  it('works out last month across a year boundary', () => {
    expect(previousMonth('2027-01')).toBe('2026-12');
    expect(previousMonth('2026-11')).toBe('2026-10');
  });

  it('records last month\'s missed instalment against last month', async () => {
    const { user, sip } = await setup();
    expect((await getMonthlyPlan(user.id, '2026-10')).rows.find(r => r.id === sip.id)?.status).toBe('PENDING');
    await decideMonthlyPayment(user.id, 'INVESTMENT', sip.id, 'PAID', undefined, { month: '2026-10' });
    expect((await getMonthlyPlan(user.id, '2026-10')).rows.find(r => r.id === sip.id)?.status).toBe('PAID');
    expect((await getMonthlyPlan(user.id, '2026-11')).rows.find(r => r.id === sip.id)?.status).toBe('PENDING');
  });

  it('refuses months older than last month', async () => {
    const { user, sip } = await setup();
    await expect(decideMonthlyPayment(user.id, 'INVESTMENT', sip.id, 'PAID', undefined, { month: '2026-09' })).rejects.toMatchObject({ status: 400 });
  });

  it('uses a different amount and paid date when given', async () => {
    const { user, account, sip, loan } = await setup();
    await decideMonthlyPayment(user.id, 'INVESTMENT', sip.id, 'PAID', undefined, { amount: 3000, paidDate: '2026-11-02' });
    const txn = await prisma.transaction.findFirstOrThrow({ where: { userId: user.id } });
    expect(Number(txn.amount)).toBe(3000);
    expect(txn.date.toISOString().slice(0, 10)).toBe('2026-11-02');
    // A smaller loan payment only reduces the balance by what was paid.
    await decideMonthlyPayment(user.id, 'LOAN', loan.id, 'PAID', undefined, { amount: 500 });
    expect(Number((await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } })).remainingBalance)).toBe(9500);
    expect(Number((await prisma.account.findUniqueOrThrow({ where: { id: account.id } })).balance)).toBe(96500);
  });

  it('rejects a paid date in the future', async () => {
    const { user, sip } = await setup();
    await expect(decideMonthlyPayment(user.id, 'INVESTMENT', sip.id, 'PAID', undefined, { paidDate: '2026-12-01' })).rejects.toMatchObject({ status: 400 });
  });

  it('attaches the other person\'s share to split rows', async () => {
    const { user, sip } = await setup();
    const a = await prisma.familyMember.create({ data: { userId: user.id, name: 'A' } });
    const b = await prisma.familyMember.create({ data: { userId: user.id, name: 'B' } });
    await prisma.investment.update({ where: { id: sip.id }, data: { memberId: a.id } });
    await prisma.ownershipSplit.create({ data: { userId: user.id, entityType: 'INVESTMENT', entityId: sip.id, secondaryMemberId: b.id, ratio: 60 } });
    expect((await getMonthlyPlan(user.id, '2026-11')).rows.find(r => r.id === sip.id)?.split).toEqual({ memberId: b.id, pct: 40 });
  });

  it('gives payment expenses the split of the item paid, and undo removes it', async () => {
    const { user, sip } = await setup();
    const a = await prisma.familyMember.create({ data: { userId: user.id, name: 'A' } });
    const b = await prisma.familyMember.create({ data: { userId: user.id, name: 'B' } });
    await prisma.investment.update({ where: { id: sip.id }, data: { memberId: a.id } });
    await prisma.ownershipSplit.create({ data: { userId: user.id, entityType: 'INVESTMENT', entityId: sip.id, secondaryMemberId: b.id, ratio: 50 } });
    await decideMonthlyPayment(user.id, 'INVESTMENT', sip.id, 'PAID');
    const txn = await prisma.transaction.findFirstOrThrow({ where: { userId: user.id } });
    expect(txn.memberId).toBe(a.id);
    expect(await prisma.ownershipSplit.findUnique({ where: { entityType_entityId: { entityType: 'TRANSACTION', entityId: txn.id } } })).toMatchObject({ secondaryMemberId: b.id });
    await undoPayment(user.id, { type: 'INVESTMENT', id: sip.id });
    expect(await prisma.ownershipSplit.count({ where: { entityType: 'TRANSACTION' } })).toBe(0);
  });

  it('records a one-off investment purchase only once', async () => {
    const { user } = await setup();
    const stock = await prisma.investment.create({ data: { userId: user.id, assetName: 'Stock', assetType: 'STOCK', quantity: 10, buyPrice: 100, purchaseDate: new Date('2026-10-01') } });
    await payInvestment(user.id, stock.id);
    await expect(payInvestment(user.id, stock.id)).rejects.toMatchObject({ status: 409 });
    expect(await prisma.transaction.count({ where: { userId: user.id } })).toBe(1);
  });

  it('shows the scheduled EMI for earlier months, including loans closed since', async () => {
    const { user, loan } = await setup();
    await prisma.loan.update({ where: { id: loan.id }, data: { remainingBalance: 700 } });
    const closed = await prisma.loan.create({ data: { userId: user.id, name: 'Closed', loanType: 'PERSONAL', principal: 4000, remainingBalance: 0, emi: 1000, tenureMonths: 4, interestRate: 0, startDate: new Date('2026-06-01'), isActive: false } });
    const october = await getMonthlyPlan(user.id, '2026-10');
    expect(october.rows.find(r => r.id === loan.id)?.amount).toBe(2000);
    expect(october.rows.find(r => r.id === closed.id)?.amount).toBe(1000);
    // This month uses the real balance, and the closed loan is gone.
    const november = await getMonthlyPlan(user.id, '2026-11');
    expect(november.rows.find(r => r.id === loan.id)?.amount).toBe(700);
    expect(november.rows.find(r => r.id === closed.id)).toBeUndefined();
  });
});
