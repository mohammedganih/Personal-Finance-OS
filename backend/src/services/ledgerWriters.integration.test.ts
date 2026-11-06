import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import { decideMonthlyPayment } from './monthlyPayments.service';
import { createBill, payOccurrence } from './bill.service';
import { createLoan } from './loan.service';
import { createCreditCard, payCreditCardBill } from './credit-card.service';
import { createCardExpense } from './cardStatement.service';
import { prepayLoan } from './loanEvents.service';
import { createTransaction, updateTransaction } from './transaction.service';

beforeEach(async () => { await resetDatabase(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-04T06:00:00Z')); });
afterEach(() => vi.useRealTimers());
afterAll(() => prisma.$disconnect());

async function setup() {
  const user = await prisma.user.create({ data: { name: 'Family', email: 'ledger@example.com', passwordHash: 'test' } });
  const account = await prisma.account.create({ data: { userId: user.id, name: 'Bank', type: 'SAVINGS', balance: 500000 } });
  return { user, account };
}
const ledger = (where: object) => prisma.transaction.findMany({ where, select: { kind: true, sourceType: true, sourceId: true, period: true, type: true }, orderBy: { createdAt: 'asc' } });

describe('every writer records what the money was for', () => {
  it('loan EMIs are DEBT and SIP/RD instalments are SAVE, for the plan month', async () => {
    const { user, account } = await setup();
    const loan = await createLoan(user.id, { name: 'Car', loanType: 'CAR', principal: 100000, interestRate: 12, emi: 10000, remainingBalance: 100000, tenureMonths: 12, startDate: '2026-01-05', bankAccountId: account.id } as never);
    const rd = await prisma.investment.create({ data: { userId: user.id, assetName: 'RD', assetType: 'RECURRING_DEPOSIT', monthlyAmount: 5000, purchaseDate: new Date('2026-01-03'), bankAccountId: account.id } });

    await decideMonthlyPayment(user.id, 'LOAN', loan.id, 'PAID', undefined, { month: '2026-10' });
    await decideMonthlyPayment(user.id, 'INVESTMENT', rd.id, 'PAID');

    const loanRows = await ledger({ sourceType: 'LOAN' });
    expect(loanRows).toHaveLength(2); // interest + principal
    for (const r of loanRows) expect(r).toMatchObject({ kind: 'DEBT', sourceId: loan.id, period: '2026-10' });
    expect(await ledger({ sourceType: 'INVESTMENT' })).toEqual([{ kind: 'SAVE', sourceType: 'INVESTMENT', sourceId: rd.id, period: '2026-11', type: 'EXPENSE' }]);
  });

  it('bills, the card bill and card purchases paid off are SPEND', async () => {
    const { user, account } = await setup();
    const bill = await createBill(user.id, { name: 'Rent', amount: 20000, startDate: '2026-11-10', frequency: 'MONTHLY', category: 'Rent', currency: 'INR', reminderDays: 3, autoDebit: false, tags: [], accountId: account.id });
    await payOccurrence(user.id, bill.id, { dueDate: '2026-11-10', createTransaction: true });
    expect(await ledger({ sourceType: 'BILL' })).toEqual([{ kind: 'SPEND', sourceType: 'BILL', sourceId: bill.id, period: '2026-11', type: 'EXPENSE' }]);

    const card = await createCreditCard(user.id, { cardName: 'Card', creditLimit: 100000, outstanding: 9000, dueDate: '2026-11-20', bankAccountId: account.id } as never);
    await payCreditCardBill(user.id, card.id, 9000);
    expect(await ledger({ sourceType: 'CREDIT_CARD' })).toEqual([{ kind: 'SPEND', sourceType: 'CREDIT_CARD', sourceId: card.id, period: '2026-11', type: 'EXPENSE' }]);

    const expense = await createCardExpense(user.id, { creditCardId: card.id, name: 'Shoes', amount: 2000, date: '2026-11-02', payNow: { accountId: account.id } } as never);
    const [row] = await ledger({ sourceType: 'CARD_EXPENSE' });
    expect(row).toMatchObject({ kind: 'SPEND', sourceId: expense.id });
    expect(row.period).toMatch(/^2026-1[12]$/);
  });

  it('a prepayment is DEBT and points at its loan event', async () => {
    const { user, account } = await setup();
    const loan = await createLoan(user.id, { name: 'Car', loanType: 'CAR', principal: 100000, interestRate: 0, emi: 10000, remainingBalance: 100000, tenureMonths: 10, startDate: '2026-01-05', bankAccountId: account.id } as never);
    const { event } = await prepayLoan(user.id, loan.id, { amount: 25000 });
    expect(await ledger({ sourceType: 'LOAN_EVENT' })).toEqual([{ kind: 'DEBT', sourceType: 'LOAN_EVENT', sourceId: event.id, period: '2026-11', type: 'EXPENSE' }]);
  });

  it('hand-typed income is INCOME, spending is SPEND, and a changed type follows', async () => {
    const { user, account } = await setup();
    const income = await createTransaction(user.id, { type: 'INCOME', amount: 1000, date: '2026-11-01', accountId: account.id, isRecurring: false });
    const spend = await createTransaction(user.id, { type: 'EXPENSE', amount: 300, date: '2026-11-01', accountId: account.id, isRecurring: false });
    expect(income.kind).toBe('INCOME');
    expect(spend.kind).toBe('SPEND');
    expect((await updateTransaction(user.id, spend.id, { type: 'INCOME' })).kind).toBe('INCOME');
  });
});
