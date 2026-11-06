import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import { autoConfirm } from './autoConfirm';
import { getMonthlyPlan } from '../services/monthlyPayments.service';
import { undoPayment } from '../services/paymentUndo.service';
import { getPaymentHistory } from '../services/paymentHistory.service';
import { createLoan } from '../services/loan.service';
import { createBill } from '../services/bill.service';
import { createCardEMI } from '../services/card-emi.service';

beforeEach(async () => { await resetDatabase(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-12T06:00:00Z')); });
afterEach(() => vi.useRealTimers());
afterAll(() => prisma.$disconnect());

async function household() {
  const user = await prisma.user.create({ data: { name: 'Family', email: 'auto@example.com', passwordHash: 'x' } });
  const bank = await prisma.account.create({ data: { userId: user.id, name: 'Bank', type: 'SAVINGS', balance: 100000 } });
  const loanBase = { loanType: 'CAR', principal: 100000, interestRate: 0, emi: 10000, remainingBalance: 100000, tenureMonths: 10, startDate: '2026-01-01', bankAccountId: bank.id };
  const carLoan = await createLoan(user.id, { ...loanBase, name: 'Car', paymentDay: 5 } as never);           // due 5 Nov: confirmed
  const laterLoan = await createLoan(user.id, { ...loanBase, name: 'Later', paymentDay: 20 } as never);      // due 20 Nov: not yet
  const manualLoan = await createLoan(user.id, { ...loanBase, name: 'Manual', paymentDay: 3, autoDebit: false } as never);
  const rd = await prisma.investment.create({ data: { userId: user.id, assetName: 'RD', assetType: 'RECURRING_DEPOSIT', monthlyAmount: 5000, purchaseDate: new Date('2026-01-10'), bankAccountId: bank.id, autoDebit: true } });
  const card = await prisma.creditCard.create({ data: { userId: user.id, cardName: 'Card', creditLimit: 100000, statementDate: new Date('2026-07-01'), dueDate: new Date('2026-07-08') } });
  const emi = await createCardEMI(user.id, { creditCardId: card.id, itemName: 'Phone', totalAmount: 6000, emiAmount: 2000, tenureMonths: 3, isNoCost: true, startDate: '2026-09-25' } as never);
  const bill = { amount: 999, startDate: '2026-11-02', frequency: 'MONTHLY', category: 'Internet', currency: 'INR', reminderDays: 3, tags: [] };
  const bankBill = await createBill(user.id, { ...bill, name: 'Internet', autoDebit: true, accountId: bank.id } as never);
  const cardBill = await createBill(user.id, { ...bill, name: 'Netflix', autoDebit: true, creditCardId: card.id } as never);
  return { user, bank, carLoan, laterLoan, manualLoan, rd, emi, bankBill, cardBill };
}
const balance = async (id: string) => Number((await prisma.account.findUniqueOrThrow({ where: { id } })).balance);

describe('auto-debit', () => {
  it('confirms auto-debited items due by today, with the same ledger entries as Mark paid', async () => {
    const { user, bank, carLoan, rd, emi, bankBill, cardBill } = await household();
    const result = await autoConfirm(user.id);
    expect(result.failed).toEqual([]);
    expect(new Set(result.confirmed.map((c) => c.itemId))).toEqual(new Set([carLoan.id, rd.id, emi.id, bankBill.id, cardBill.id]));

    // Loan (10,000), RD (5,000) and the bank-paid bill (999) left the bank; the card EMI and card bill did not.
    expect(await balance(bank.id)).toBe(100000 - 10000 - 5000 - 999);
    expect(await prisma.transaction.count({ where: { userId: user.id } })).toBe(3);
    expect(await prisma.dueStatus.count({ where: { userId: user.id, status: 'AUTO' } })).toBe(5);

    const plan = await getMonthlyPlan(user.id, '2026-11');
    expect(plan.rows.filter((r) => r.status === 'AUTO')).toHaveLength(5);
    expect(plan.paid).toBe(10000 + 5000 + 2000 + 999 + 999);
  });

  it('leaves manual items, items not yet due and earlier months alone, and is safe to run again', async () => {
    const { user, laterLoan, manualLoan } = await household();
    await autoConfirm(user.id);
    const again = await autoConfirm(user.id);
    expect(again.confirmed).toEqual([]);
    const plan = await getMonthlyPlan(user.id, '2026-11');
    expect(plan.rows.find((r) => r.id === laterLoan.id)?.status).toBe('PENDING');
    expect(plan.rows.find((r) => r.id === manualLoan.id)?.status).toBe('PENDING');
    expect(await prisma.dueStatus.count({ where: { userId: user.id, period: { lt: '2026-11' } } })).toBe(0);
  });

  it('an automatic confirmation is undone like a payment, and shows in history', async () => {
    const { user, bank, carLoan } = await household();
    await autoConfirm(user.id);
    const history = await getPaymentHistory(user.id, 'LOAN', carLoan.id);
    expect(history[0]).toMatchObject({ kind: 'AUTO', month: '2026-11', canUndo: true });
    await undoPayment(user.id, { type: 'LOAN', id: carLoan.id, month: '2026-11' });
    expect(Number((await prisma.loan.findUniqueOrThrow({ where: { id: carLoan.id } })).remainingBalance)).toBe(100000);
    expect(await balance(bank.id)).toBe(100000 - 5000 - 999);
  });
});
