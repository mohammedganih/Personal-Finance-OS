import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import { dueItems, monthsBetween } from './dueItems';
import { decideMonthlyPayment, getMonthlyPlan } from '../services/monthlyPayments.service';
import { getEMICalendar } from '../services/debtIntelligence.service';
import { getInvestmentCalendar } from '../services/investmentIntelligence.service';
import { createBill, payOccurrence } from '../services/bill.service';
import { createLoan } from '../services/loan.service';
import { createCreditCard } from '../services/credit-card.service';
import { createCardEMI } from '../services/card-emi.service';

beforeEach(async () => { await resetDatabase(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-04T06:00:00Z')); });
afterEach(() => vi.useRealTimers());
afterAll(() => prisma.$disconnect());

async function household() {
  const user = await prisma.user.create({ data: { name: 'Family', email: 'schedule@example.com', passwordHash: 'x' } });
  const a = await prisma.familyMember.create({ data: { userId: user.id, name: 'Mohammed' } });
  const b = await prisma.familyMember.create({ data: { userId: user.id, name: 'Fathimah' } });
  const bank = await prisma.account.create({ data: { userId: user.id, name: 'Bank', type: 'SAVINGS', balance: 500000 } });
  const loan = await createLoan(user.id, { name: 'Car', loanType: 'CAR', principal: 120000, interestRate: 0, emi: 10000, remainingBalance: 120000, tenureMonths: 12, startDate: '2026-01-05', paymentDay: 5, payerMemberId: a.id, memberId: a.id, bankAccountId: bank.id } as never);
  const rd = await prisma.investment.create({ data: { userId: user.id, assetName: 'RD', assetType: 'RECURRING_DEPOSIT', monthlyAmount: 5000, purchaseDate: new Date('2026-01-10'), bankAccountId: bank.id, memberId: b.id } });
  await prisma.ownershipSplit.create({ data: { userId: user.id, entityType: 'INVESTMENT', entityId: rd.id, secondaryMemberId: a.id, ratio: 50 } });
  const card = await createCreditCard(user.id, { cardName: 'Card', creditLimit: 100000, outstanding: 0, dueDate: '2026-11-20', memberId: a.id } as never);
  const emi = await createCardEMI(user.id, { creditCardId: card.id, itemName: 'Phone', totalAmount: 6000, emiAmount: 2000, tenureMonths: 3, emisPaid: 0, isNoCost: true, startDate: '2026-10-25' } as never);
  const bill = await createBill(user.id, { name: 'Rent', amount: 20000, startDate: '2026-11-10', frequency: 'MONTHLY', category: 'Rent', currency: 'INR', reminderDays: 3, autoDebit: true, tags: [], accountId: bank.id, memberId: a.id });
  return { user, a, b, bank, loan, rd, card, emi, bill };
}

describe('schedule engine', () => {
  it('lists every commitment per month with who pays, splits and status', async () => {
    const { user, a, b, loan, rd, emi, bill } = await household();
    const items = await dueItems(user.id, '2026-11', '2026-12');
    const pick = (type: string, period: string) => items.find((i) => i.itemType === type && i.period === period);

    expect(pick('LOAN', '2026-11')).toMatchObject({ itemId: loan.id, dueDate: '2026-11-05', amount: 10000, payerMemberId: a.id, status: 'PENDING' });
    expect(pick('INVESTMENT', '2026-12')).toMatchObject({ itemId: rd.id, dueDate: '2026-12-10', amount: 5000, payerMemberId: b.id, split: { memberId: a.id, pct: 50 } });
    expect(pick('CARD_EMI', '2026-11')).toMatchObject({ itemId: emi.id, amount: 2000, creditCardId: emi.creditCardId });
    expect(pick('BILL', '2026-12')).toMatchObject({ itemId: bill.id, dueDate: '2026-12-10', autoDebit: true, status: 'PENDING' });
    expect(items.map((i) => i.period)).toEqual([...items.map((i) => i.period)].sort());
  });

  it('shows what was paid, and the month plan is built from it', async () => {
    const { user, loan, bill } = await household();
    await decideMonthlyPayment(user.id, 'LOAN', loan.id, 'PAID');
    await payOccurrence(user.id, bill.id, { dueDate: '2026-11-10', createTransaction: true });
    const items = await dueItems(user.id, '2026-11', '2026-11');
    expect(items.find((i) => i.itemType === 'LOAN')).toMatchObject({ status: 'PAID', paidAmount: 10000, paidDate: expect.any(String) });
    expect(items.find((i) => i.itemType === 'BILL')).toMatchObject({ status: 'PAID', paidAmount: 20000 });

    const plan = await getMonthlyPlan(user.id, '2026-11');
    expect(plan.rows).toHaveLength(items.length);
    expect(plan.paid).toBe(30000);
  });

  it('can be limited to some item types', async () => {
    const { user } = await household();
    const items = await dueItems(user.id, '2026-11', '2026-11', { types: ['LOAN'] });
    expect(new Set(items.map((i) => i.itemType))).toEqual(new Set(['LOAN']));
  });

  it('monthsBetween covers year ends', () => {
    expect(monthsBetween('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
    expect(monthsBetween('2026-11', '2026-10')).toEqual([]);
  });
});

describe('upcoming lists use the engine', () => {
  it('Loans: an EMI paid this month no longer shows as due (bug 8)', async () => {
    const { user, loan } = await household();
    vi.setSystemTime(new Date('2026-11-02T06:00:00Z')); // before the 5th
    const before = (await getEMICalendar(user.id, 2)).filter((e) => e.debtId === `loan:${loan.id}`);
    expect(before.map((e) => e.date.toISOString().slice(0, 10))).toEqual(['2026-11-04', '2026-12-04']); // 5th, India midnight
    await decideMonthlyPayment(user.id, 'LOAN', loan.id, 'PAID');
    const after = (await getEMICalendar(user.id, 2)).filter((e) => e.debtId === `loan:${loan.id}`);
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ sourceType: 'LOAN', name: 'Car', amount: 10000 });
  });

  it('Investments: upcoming instalments come with the account name', async () => {
    const { user, rd } = await household();
    const entries = await getInvestmentCalendar(user.id, 2);
    expect(entries.map((e) => [e.investmentId, e.assetType, e.accountName, e.amount])).toEqual([
      [rd.id, 'RECURRING_DEPOSIT', 'Bank', 5000],
      [rd.id, 'RECURRING_DEPOSIT', 'Bank', 5000],
    ]);
  });
});
