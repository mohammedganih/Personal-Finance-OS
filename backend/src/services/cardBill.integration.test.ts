import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import { payCreditCardBill } from './credit-card.service';
import { payCardEMI } from './card-emi.service';
import { payOccurrence } from './bill.service';
import { getMonthlyPlan } from './monthlyPayments.service';
import { undoPayment } from './paymentUndo.service';

beforeEach(async () => { await resetDatabase(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-04T06:00:00Z')); });
afterEach(() => vi.useRealTimers());
afterAll(() => prisma.$disconnect());

async function setup(outstanding = 10000) {
  const user = await prisma.user.create({ data: { name: 'Card bill test', email: 'card-bill@example.com', passwordHash: 'test' } });
  const account = await prisma.account.create({ data: { userId: user.id, name: 'Bank', type: 'SAVINGS', balance: 50000 } });
  const card = await prisma.creditCard.create({ data: { userId: user.id, cardName: 'Card', creditLimit: 100000, outstanding, statementDate: new Date('2026-09-25'), dueDate: new Date('2026-10-15'), bankAccountId: account.id } });
  return { user, account, card };
}
const balance = async (id: string) => Number((await prisma.account.findUniqueOrThrow({ where: { id } })).balance);
const cardRow = async (userId: string) => (await getMonthlyPlan(userId, '2026-10')).rows.find(r => r.type === 'CREDIT_CARD');

describe('card bill is where card money moves', () => {
  it('keeps a paid statement on the plan as PAID, debiting the linked account', async () => {
    const { user, account, card } = await setup();
    await payCreditCardBill(user.id, card.id, 10000);
    expect(await balance(account.id)).toBe(40000);
    expect(await cardRow(user.id)).toMatchObject({ status: 'PAID', amount: 10000, paidAmount: 10000, remaining: 0 });
    expect((await getMonthlyPlan(user.id, '2026-10')).paid).toBe(10000);
  });

  it('adds part payments to the same month and counts the rest as pending', async () => {
    const { user, card } = await setup();
    await payCreditCardBill(user.id, card.id, 3000);
    await payCreditCardBill(user.id, card.id, 2000);
    expect(await cardRow(user.id)).toMatchObject({ status: 'PENDING', amount: 10000, paidAmount: 5000, remaining: 5000 });
    const plan = await getMonthlyPlan(user.id, '2026-10');
    expect(plan.paid).toBe(5000);
    expect(plan.creditCards).toBe(5000);
    const event = await prisma.dueStatus.findFirstOrThrow({ where: { itemType: 'CARD_STATEMENT' } });
    expect(event.transactionIds).toHaveLength(2);
  });

  it('undoes every payment made against the statement month', async () => {
    const { user, account, card } = await setup();
    await payCreditCardBill(user.id, card.id, 3000);
    await payCreditCardBill(user.id, card.id, 7000);
    await undoPayment(user.id, { type: 'CREDIT_CARD', id: card.id, month: '2026-10' });
    expect(await balance(account.id)).toBe(50000);
    expect(Number((await prisma.creditCard.findUniqueOrThrow({ where: { id: card.id } })).outstanding)).toBe(10000);
    expect(await prisma.transaction.count()).toBe(0);
    expect(await cardRow(user.id)).toMatchObject({ status: 'PENDING', amount: 10000 });
  });

  it('refuses to pay a card with nothing outstanding', async () => {
    const { user, card } = await setup(0);
    await expect(payCreditCardBill(user.id, card.id, 500)).rejects.toMatchObject({ status: 400 });
  });

  it('records one expense in total for a card EMI plus the card bill', async () => {
    const { user, account, card } = await setup(3000);
    const emi = await prisma.cardEMI.create({ data: { userId: user.id, creditCardId: card.id, itemName: 'Phone', totalAmount: 6000, emiAmount: 3000, tenureMonths: 2, startDate: new Date('2026-09-01'), isNoCost: true } });
    await payCardEMI(user.id, emi.id);
    await payCreditCardBill(user.id, card.id, 3000);
    expect(await prisma.transaction.count()).toBe(1);
    expect(await balance(account.id)).toBe(47000);
  });

  it('ticks off a bill charged to a card without an expense; a bank-paid bill still records one', async () => {
    const { user, account, card } = await setup();
    const onCard = await prisma.recurringBill.create({ data: { userId: user.id, name: 'Streaming', amount: 649, startDate: new Date('2026-10-09'), creditCardId: card.id } });
    const fromBank = await prisma.recurringBill.create({ data: { userId: user.id, name: 'Power', amount: 1200, startDate: new Date('2026-10-09'), accountId: account.id } });
    await payOccurrence(user.id, onCard.id, { dueDate: '2026-10-09', createTransaction: true });
    await payOccurrence(user.id, fromBank.id, { dueDate: '2026-10-09', createTransaction: true });
    expect(await prisma.transaction.count()).toBe(1);
    expect(await balance(account.id)).toBe(48800);
    expect(await prisma.dueStatus.count({ where: { itemType: 'BILL', status: 'PAID' } })).toBe(2);
  });
});
