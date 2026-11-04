import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import { decideMonthlyPayment, getMonthlyPlan } from './monthlyPayments.service';
import { undoPayment } from './paymentUndo.service';
import { prepayLoan, changeLoanRate, undoLoanEvent, getLoanEvents } from './loanEvents.service';
import { setInvestmentSchedule } from './investment.service';
import { getPaymentHistory, getReminders } from './paymentHistory.service';
import { getMonthSummary } from './monthSummary.service';
import { createBill, payOccurrence } from './bill.service';
import { createLoan } from './loan.service';
import { createCardEMI } from './card-emi.service';
import { createCreditCard } from './credit-card.service';

beforeEach(async () => { await resetDatabase(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-04T06:00:00Z')); });
afterEach(() => vi.useRealTimers());
afterAll(() => prisma.$disconnect());

async function setup() {
  const user = await prisma.user.create({ data: { name: 'Family', email: 'family@example.com', passwordHash: 'test' } });
  const a = await prisma.familyMember.create({ data: { userId: user.id, name: 'Mohammed Gani', isDefault: true } });
  const b = await prisma.familyMember.create({ data: { userId: user.id, name: 'Fathimah' } });
  const account = await prisma.account.create({ data: { userId: user.id, name: 'Bank', type: 'SAVINGS', balance: 100000, memberId: a.id } });
  return { user, a, b, account };
}
const balance = async (id: string) => Number((await prisma.account.findUniqueOrThrow({ where: { id } })).balance);
const loanRow = async (id: string) => prisma.loan.findUniqueOrThrow({ where: { id } });

describe('splits on loans, bills and card EMIs', () => {
  it('splits a loan, a bill and a card EMI between both people on the month sheet', async () => {
    const { user, a, b, account } = await setup();
    await createLoan(user.id, { name: 'Car', loanType: 'CAR', principal: 100000, interestRate: 0, emi: 10000, remainingBalance: 100000, tenureMonths: 10, startDate: '2026-09-01', payerMemberId: a.id, memberId: a.id, splitMemberId: b.id, splitRatio: 50 });
    await createBill(user.id, { name: 'Rent', amount: 20000, startDate: '2026-11-10', frequency: 'MONTHLY', category: 'Rent', currency: 'INR', reminderDays: 3, autoDebit: false, tags: [], memberId: a.id, accountId: account.id, splitMemberId: b.id, splitRatio: 70 });
    const card = await createCreditCard(user.id, { cardName: 'Card', creditLimit: 100000, outstanding: 0, dueDate: '2026-11-20', memberId: a.id });
    await createCardEMI(user.id, { creditCardId: card.id, itemName: 'Phone', totalAmount: 6000, emiAmount: 3000, tenureMonths: 2, emisPaid: 0, isNoCost: true, startDate: '2026-10-25', memberId: b.id, splitMemberId: a.id, splitRatio: 50 });

    const s = await getMonthSummary(user.id, '2026-11');
    const [ma, mb] = s.members;
    expect(ma.loans.total).toBe(5000 + 1500);
    expect(mb.loans.total).toBe(5000 + 1500);
    expect(ma.bills.total).toBe(14000);
    expect(mb.bills.total).toBe(6000);
    expect(s.combined.loans.total).toBe(13000);
  });

  it('copies the split onto loan and bill payment expenses', async () => {
    const { user, a, b, account } = await setup();
    const loan = await createLoan(user.id, { name: 'Car', loanType: 'CAR', principal: 100000, interestRate: 0, emi: 10000, remainingBalance: 100000, tenureMonths: 10, startDate: '2026-09-01', payerMemberId: a.id, bankAccountId: account.id, splitMemberId: b.id });
    await decideMonthlyPayment(user.id, 'LOAN', loan.id, 'PAID');
    const bill = await createBill(user.id, { name: 'Rent', amount: 20000, startDate: '2026-11-10', frequency: 'MONTHLY', category: 'Rent', currency: 'INR', reminderDays: 3, autoDebit: false, tags: [], memberId: a.id, accountId: account.id, splitMemberId: b.id });
    await payOccurrence(user.id, bill.id, { dueDate: '2026-11-10', createTransaction: true });
    expect(await prisma.ownershipSplit.count({ where: { entityType: 'TRANSACTION', secondaryMemberId: b.id } })).toBe(2);
  });

  it('rejects a person from another household', async () => {
    const { user } = await setup();
    const other = await prisma.user.create({ data: { name: 'Other', email: 'other-family@example.com', passwordHash: 'test' } });
    const stranger = await prisma.familyMember.create({ data: { userId: other.id, name: 'Stranger' } });
    await expect(createLoan(user.id, { name: 'X', loanType: 'OTHER', principal: 1000, interestRate: 0, emi: 100, remainingBalance: 1000, tenureMonths: 10, startDate: '2026-09-01', splitMemberId: stranger.id }))
      .rejects.toMatchObject({ status: 404 });
  });
});

describe('loan prepayment, rate change and history', () => {
  async function loanFor(userId: string, accountId: string) {
    return prisma.loan.create({ data: { userId, name: 'Home', loanType: 'HOME', principal: 50000, remainingBalance: 50000, emi: 5000, tenureMonths: 10, interestRate: 12, startDate: new Date('2026-08-01'), bankAccountId: accountId } });
  }

  it('prepays principal from the linked account and undoes it', async () => {
    const { user, account } = await setup();
    const loan = await loanFor(user.id, account.id);
    const { event } = await prepayLoan(user.id, loan.id, { amount: 20000 });
    expect(Number((await loanRow(loan.id)).remainingBalance)).toBe(30000);
    expect(await balance(account.id)).toBe(80000);
    expect(event).toMatchObject({ type: 'PREPAYMENT', balanceBefore: 50000, balanceAfter: 30000 });
    await undoLoanEvent(user.id, loan.id, event.id);
    expect(Number((await loanRow(loan.id)).remainingBalance)).toBe(50000);
    expect(await balance(account.id)).toBe(100000);
    expect(await getLoanEvents(user.id, loan.id)).toHaveLength(0);
  });

  it('refuses more than the balance, closes the loan when cleared, and reopens on undo', async () => {
    const { user, account } = await setup();
    const loan = await loanFor(user.id, account.id);
    await expect(prepayLoan(user.id, loan.id, { amount: 60000 })).rejects.toMatchObject({ status: 400 });
    const { event, isPaidOff } = await prepayLoan(user.id, loan.id, { amount: 50000 });
    expect(isPaidOff).toBe(true);
    expect((await loanRow(loan.id)).isActive).toBe(false);
    expect((await getLoanEvents(user.id, loan.id)).map(e => e.type).sort()).toEqual(['CLOSED', 'PREPAYMENT']);
    await undoLoanEvent(user.id, loan.id, event.id);
    expect((await loanRow(loan.id)).isActive).toBe(true);
    expect(await getLoanEvents(user.id, loan.id)).toHaveLength(0);
  });

  it('will not undo a prepayment after a later EMI was paid', async () => {
    const { user, account } = await setup();
    const loan = await loanFor(user.id, account.id);
    const { event } = await prepayLoan(user.id, loan.id, { amount: 10000 });
    vi.setSystemTime(new Date('2026-11-04T07:00:00Z'));
    await decideMonthlyPayment(user.id, 'LOAN', loan.id, 'PAID');
    await expect(undoLoanEvent(user.id, loan.id, event.id)).rejects.toMatchObject({ status: 409 });
  });

  it('changes the rate and EMI, and undo restores both', async () => {
    const { user, account } = await setup();
    const loan = await loanFor(user.id, account.id);
    const event = await changeLoanRate(user.id, loan.id, { interestRate: 9.5, emi: 4800 });
    expect(await loanRow(loan.id)).toMatchObject({});
    expect(Number((await loanRow(loan.id)).interestRate)).toBe(9.5);
    expect(Number((await loanRow(loan.id)).emi)).toBe(4800);
    await undoLoanEvent(user.id, loan.id, event.id);
    expect(Number((await loanRow(loan.id)).interestRate)).toBe(12);
    expect(Number((await loanRow(loan.id)).emi)).toBe(5000);
  });

  it('records a CLOSED entry when the last EMI clears the loan, removed on undo', async () => {
    const { user } = await setup();
    const loan = await prisma.loan.create({ data: { userId: user.id, name: 'Last', loanType: 'PERSONAL', principal: 3000, remainingBalance: 1000, emi: 1000, tenureMonths: 3, interestRate: 0, startDate: new Date('2026-08-01') } });
    await decideMonthlyPayment(user.id, 'LOAN', loan.id, 'PAID');
    expect((await getLoanEvents(user.id, loan.id)).map(e => e.type)).toEqual(['CLOSED']);
    await undoPayment(user.id, { type: 'LOAN', id: loan.id });
    expect(await getLoanEvents(user.id, loan.id)).toHaveLength(0);
  });
});

describe('SIP pause and amount change', () => {
  it('skips paused months and uses the new amount from its month', async () => {
    const { user } = await setup();
    const sip = await prisma.investment.create({ data: { userId: user.id, assetName: 'SIP', assetType: 'SIP', purchaseDate: new Date('2026-06-05'), monthlyAmount: 2500 } });
    await setInvestmentSchedule(user.id, sip.id, { pauseFrom: '2026-12', pauseUntil: '2027-01', nextMonthlyAmount: 4000, nextAmountFrom: '2027-02' });
    const amount = async (m: string) => (await getMonthlyPlan(user.id, m)).rows.find(r => r.id === sip.id)?.amount;
    expect(await amount('2026-11')).toBe(2500);
    expect(await amount('2026-12')).toBeUndefined();
    expect(await amount('2027-02')).toBe(4000);
  });

  it('rejects an incomplete or backwards schedule and lump-sum holdings', async () => {
    const { user } = await setup();
    const sip = await prisma.investment.create({ data: { userId: user.id, assetName: 'SIP', assetType: 'SIP', purchaseDate: new Date('2026-06-05'), monthlyAmount: 2500 } });
    await expect(setInvestmentSchedule(user.id, sip.id, { nextMonthlyAmount: 3000 })).rejects.toMatchObject({ status: 400 });
    await expect(setInvestmentSchedule(user.id, sip.id, { pauseFrom: '2027-03', pauseUntil: '2027-01' })).rejects.toMatchObject({ status: 400 });
    const stock = await prisma.investment.create({ data: { userId: user.id, assetName: 'Stock', assetType: 'STOCK', purchaseDate: new Date('2026-06-05') } });
    await expect(setInvestmentSchedule(user.id, stock.id, { pauseFrom: '2026-12' })).rejects.toMatchObject({ status: 400 });
  });

  it('refuses to pay a paused month at the scheduled amount', async () => {
    const { user } = await setup();
    const sip = await prisma.investment.create({ data: { userId: user.id, assetName: 'SIP', assetType: 'SIP', purchaseDate: new Date('2026-06-05'), monthlyAmount: 2500 } });
    await setInvestmentSchedule(user.id, sip.id, { pauseFrom: '2026-11' });
    await expect(decideMonthlyPayment(user.id, 'INVESTMENT', sip.id, 'PAID')).rejects.toMatchObject({ status: 400 });
  });
});

describe('payment history and reminders', () => {
  it('lists payments and loan changes newest first, with only the latest loan payment undoable', async () => {
    const { user, account } = await setup();
    const loan = await prisma.loan.create({ data: { userId: user.id, name: 'Home', loanType: 'HOME', principal: 50000, remainingBalance: 50000, emi: 5000, tenureMonths: 10, interestRate: 0, startDate: new Date('2026-08-01'), bankAccountId: account.id } });
    await decideMonthlyPayment(user.id, 'LOAN', loan.id, 'PAID', undefined, { month: '2026-10' });
    vi.setSystemTime(new Date('2026-11-04T07:00:00Z'));
    await decideMonthlyPayment(user.id, 'LOAN', loan.id, 'PAID');
    vi.setSystemTime(new Date('2026-11-04T08:00:00Z'));
    await prepayLoan(user.id, loan.id, { amount: 1000 });
    const history = await getPaymentHistory(user.id, 'LOAN', loan.id);
    // Order is by recorded time; payment timestamps come from the DB clock in tests, so compare as a set.
    expect(history.map(h => [h.kind, h.month, h.canUndo])).toEqual(expect.arrayContaining([
      ['PREPAYMENT', '2026-11', true], ['PAID', '2026-11', true], ['PAID', '2026-10', false],
    ]));
    expect(history).toHaveLength(3);
  });

  it('refuses another household\'s item', async () => {
    const { user } = await setup();
    const other = await prisma.user.create({ data: { name: 'Other', email: 'other-history@example.com', passwordHash: 'test' } });
    const loan = await prisma.loan.create({ data: { userId: other.id, name: 'X', loanType: 'OTHER', principal: 1000, remainingBalance: 1000, emi: 100, tenureMonths: 10, interestRate: 0, startDate: new Date('2026-08-01') } });
    await expect(getPaymentHistory(user.id, 'LOAN', loan.id)).rejects.toMatchObject({ status: 404 });
  });

  it('reminds about due-soon and overdue EMIs/SIPs and upcoming maturities', async () => {
    const { user } = await setup();
    await prisma.investment.create({ data: { userId: user.id, assetName: 'SIP soon', assetType: 'SIP', purchaseDate: new Date('2026-06-06'), monthlyAmount: 2500 } });
    await prisma.investment.create({ data: { userId: user.id, assetName: 'SIP later', assetType: 'SIP', purchaseDate: new Date('2026-06-25'), monthlyAmount: 1000 } });
    await prisma.investment.create({ data: { userId: user.id, assetName: 'RD', assetType: 'RECURRING_DEPOSIT', purchaseDate: new Date('2025-11-20'), monthlyAmount: 500, maturityDate: new Date('2026-11-25'), maturityAmount: 6200 } });
    const reminders = await getReminders(user.id);
    const names = reminders.map(r => `${r.kind}:${r.name}`);
    expect(names).toContain('DUE_SOON:SIP soon');
    expect(names).toContain('OVERDUE:SIP soon'); // last month's, never recorded
    expect(names).toContain('MATURITY:RD matures');
    expect(names).not.toContain('DUE_SOON:SIP later');
    expect(reminders[0].kind).toBe('OVERDUE');
  });
});
