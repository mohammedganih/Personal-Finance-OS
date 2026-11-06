import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { syncCardEMIProgress } from '../schedule/progress';
import { resetDatabase, prisma } from '../test/db';
import { decideMonthlyPayment, getMonthlyPlan } from './monthlyPayments.service';
import { payCardEMI } from './card-emi.service';
import { payOccurrence } from './bill.service';
import { undoPayment } from './paymentUndo.service';

beforeEach(async () => { await resetDatabase(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-04T06:00:00Z')); });
afterEach(() => vi.useRealTimers());
afterAll(() => prisma.$disconnect());

async function setup() {
  const user = await prisma.user.create({ data: { name: 'Undo test', email: 'undo@example.com', passwordHash: 'test' } });
  const account = await prisma.account.create({ data: { userId: user.id, name: 'Bank', type: 'SAVINGS', balance: 100000 } });
  return { user, account };
}
const balance = async (id: string) => Number((await prisma.account.findUniqueOrThrow({ where: { id } })).balance);

describe('undo a recorded payment', () => {
  it('reverses a loan EMI: transactions, bank balance, loan balance and month status', async () => {
    const { user, account } = await setup();
    const loan = await prisma.loan.create({ data: { userId: user.id, name: 'Loan', loanType: 'PERSONAL', principal: 12000, remainingBalance: 12000, emi: 2100, tenureMonths: 6, interestRate: 12, startDate: new Date('2026-09-01'), paymentDay: 5, bankAccountId: account.id } });
    await decideMonthlyPayment(user.id, 'LOAN', loan.id, 'PAID');
    expect(await balance(account.id)).toBe(97900);
    expect(Number((await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } })).remainingBalance)).toBe(10020);

    await undoPayment(user.id, { type: 'LOAN', id: loan.id });
    expect(await balance(account.id)).toBe(100000);
    expect(Number((await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } })).remainingBalance)).toBe(12000);
    expect(await prisma.transaction.count({ where: { userId: user.id } })).toBe(0);
    expect((await getMonthlyPlan(user.id, '2026-10')).rows[0].status).toBe('PENDING');
    // Can be paid again after the undo.
    await decideMonthlyPayment(user.id, 'LOAN', loan.id, 'PAID');
    expect(await balance(account.id)).toBe(97900);
  });

  it('reopens a loan that the undone payment had paid off', async () => {
    const { user } = await setup();
    const loan = await prisma.loan.create({ data: { userId: user.id, name: 'Last EMI', loanType: 'PERSONAL', principal: 5000, remainingBalance: 1500, emi: 2000, tenureMonths: 3, interestRate: 0, startDate: new Date('2026-08-01') } });
    expect(await decideMonthlyPayment(user.id, 'LOAN', loan.id, 'PAID')).toMatchObject({ isPaidOff: true });
    await undoPayment(user.id, { type: 'LOAN', id: loan.id });
    expect(await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } })).toMatchObject({ isActive: true });
    expect(Number((await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } })).remainingBalance)).toBe(1500);
  });

  it('refuses a second payment in the same month (no double pay)', async () => {
    const { user } = await setup();
    const loan = await prisma.loan.create({ data: { userId: user.id, name: 'Loan', loanType: 'PERSONAL', principal: 10000, remainingBalance: 10000, emi: 2000, tenureMonths: 5, interestRate: 0, startDate: new Date('2026-09-01') } });
    await decideMonthlyPayment(user.id, 'LOAN', loan.id, 'PAID');
    await expect(decideMonthlyPayment(user.id, 'LOAN', loan.id, 'PAID')).rejects.toMatchObject({ status: 409 });
    expect(Number((await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } })).remainingBalance)).toBe(8000);
  });

  it('only undoes the latest loan payment', async () => {
    const { user } = await setup();
    const loan = await prisma.loan.create({ data: { userId: user.id, name: 'Loan', loanType: 'PERSONAL', principal: 10000, remainingBalance: 10000, emi: 2000, tenureMonths: 5, interestRate: 0, startDate: new Date('2026-08-01') } });
    await prisma.monthlyPayment.create({ data: { userId: user.id, entityType: 'LOAN', entityId: loan.id, month: '2026-11', status: 'PAID', amount: 2000 } });
    await prisma.monthlyPayment.create({ data: { userId: user.id, entityType: 'LOAN', entityId: loan.id, month: '2026-10', status: 'PAID', amount: 2000 } });
    await expect(undoPayment(user.id, { type: 'LOAN', id: loan.id, month: '2026-10' })).rejects.toMatchObject({ status: 409 });
  });

  it('reverses an RD instalment and its instalment count', async () => {
    const { user, account } = await setup();
    const rd = await prisma.investment.create({ data: { userId: user.id, assetName: 'RD', assetType: 'RECURRING_DEPOSIT', quantity: 3, purchaseDate: new Date('2026-07-01'), monthlyAmount: 5000, bankAccountId: account.id } });
    await decideMonthlyPayment(user.id, 'INVESTMENT', rd.id, 'PAID');
    expect(Number((await prisma.investment.findUniqueOrThrow({ where: { id: rd.id } })).quantity)).toBe(4);
    await undoPayment(user.id, { type: 'INVESTMENT', id: rd.id });
    expect(Number((await prisma.investment.findUniqueOrThrow({ where: { id: rd.id } })).quantity)).toBe(3);
    expect(await balance(account.id)).toBe(100000);
    expect(await prisma.monthlyPayment.count()).toBe(0);
  });

  it('clears a skipped month without touching money', async () => {
    const { user, account } = await setup();
    const sip = await prisma.investment.create({ data: { userId: user.id, assetName: 'SIP', assetType: 'SIP', purchaseDate: new Date('2026-07-01'), monthlyAmount: 2500, bankAccountId: account.id } });
    await decideMonthlyPayment(user.id, 'INVESTMENT', sip.id, 'SKIPPED');
    const result = await undoPayment(user.id, { type: 'INVESTMENT', id: sip.id });
    expect(result).toMatchObject({ previousStatus: 'SKIPPED' });
    expect(await prisma.monthlyPayment.count()).toBe(0);
    expect(await balance(account.id)).toBe(100000);
  });

  // Card EMI progress comes from the schedule's dates (billed once due), not from ticks.
  it('reverses a card EMI tick; progress follows the due date, not the tick', async () => {
    const { user, account } = await setup();
    const card = await prisma.creditCard.create({ data: { userId: user.id, cardName: 'Card', creditLimit: 100000, outstanding: 0, statementDate: new Date('2026-07-09'), dueDate: new Date('2026-07-29') } });
    const emi = await prisma.cardEMI.create({ data: { userId: user.id, creditCardId: card.id, itemName: 'Phone', totalAmount: 3000, emiAmount: 3000, tenureMonths: 1, startDate: new Date('2026-09-20'), isNoCost: true } });
    await payCardEMI(user.id, emi.id, account.id);
    expect(await prisma.monthlyPayment.count({ where: { entityId: emi.id, status: 'PAID' } })).toBe(1);
    expect(await prisma.cardEMI.findUniqueOrThrow({ where: { id: emi.id } })).toMatchObject({ emisPaid: 0, isArchived: false }); // due 29 Oct
    await undoPayment(user.id, { type: 'CARD_EMI', id: emi.id, month: '2026-10' });
    expect(await prisma.monthlyPayment.count({ where: { entityId: emi.id } })).toBe(0);
    vi.setSystemTime(new Date('2026-10-30T06:00:00Z'));
    await syncCardEMIProgress(prisma, user.id, emi.id);
    expect(await prisma.cardEMI.findUniqueOrThrow({ where: { id: emi.id } })).toMatchObject({ emisPaid: 1, isArchived: true });
    expect(await balance(account.id)).toBe(100000);
    expect(await prisma.transaction.count({ where: { userId: user.id } })).toBe(0);
  });

  it('undoes a bill payment through the same endpoint', async () => {
    const { user, account } = await setup();
    const bill = await prisma.recurringBill.create({ data: { userId: user.id, name: 'Power', amount: 1200, startDate: new Date('2026-10-07'), accountId: account.id } });
    await payOccurrence(user.id, bill.id, { dueDate: '2026-10-07', createTransaction: true });
    expect(await balance(account.id)).toBe(98800);
    await expect(undoPayment(user.id, { type: 'BILL', id: bill.id })).rejects.toMatchObject({ status: 400 });
    await undoPayment(user.id, { type: 'BILL', id: bill.id, dueDate: '2026-10-07' });
    expect(await balance(account.id)).toBe(100000);
    expect(await prisma.billOccurrence.count()).toBe(0);
  });

  it('only touches the signed-in user\'s records', async () => {
    const { user } = await setup();
    const other = await prisma.user.create({ data: { name: 'Other', email: 'other-undo@example.com', passwordHash: 'test' } });
    const loan = await prisma.loan.create({ data: { userId: user.id, name: 'Loan', loanType: 'PERSONAL', principal: 10000, remainingBalance: 10000, emi: 2000, tenureMonths: 5, interestRate: 0, startDate: new Date('2026-09-01') } });
    await decideMonthlyPayment(user.id, 'LOAN', loan.id, 'PAID');
    await expect(undoPayment(other.id, { type: 'LOAN', id: loan.id })).rejects.toMatchObject({ status: 404 });
    expect(await prisma.monthlyPayment.count()).toBe(1);
  });
});
