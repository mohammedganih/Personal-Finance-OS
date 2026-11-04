import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import { payCreditCardBill } from './credit-card.service';
import { undoPayment } from './paymentUndo.service';
import { getMonthlyPlan } from './monthlyPayments.service';
import { getMonthSummary } from './monthSummary.service';
import {
  saveCardStatement, getCardStatements, deleteCardStatement,
  createCardExpense, updateCardExpense, payCardExpense, undoCardExpensePayment, deleteCardExpense,
} from './cardStatement.service';

beforeEach(async () => { await resetDatabase(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-04T06:00:00Z')); });
afterEach(() => vi.useRealTimers());
afterAll(() => prisma.$disconnect());

async function setup() {
  const user = await prisma.user.create({ data: { name: 'Cards', email: 'card-statements@example.com', passwordHash: 'test' } });
  const member = await prisma.familyMember.create({ data: { userId: user.id, name: 'Mohammed Gani', isDefault: true } });
  const bank = await prisma.account.create({ data: { userId: user.id, name: 'ICICI', type: 'SAVINGS', balance: 100000, memberId: member.id } });
  const card = await prisma.creditCard.create({ data: {
    userId: user.id, memberId: member.id, cardName: 'Sapphiro', creditLimit: 300000, outstanding: 16500,
    statementDate: new Date('2026-11-11T00:00:00Z'), dueDate: new Date('2026-11-29T00:00:00Z'), bankAccountId: bank.id,
  } });
  return { user, member, bank, card };
}
const balance = async (id: string) => Number((await prisma.account.findUniqueOrThrow({ where: { id } })).balance);
const october = { statementDate: '2026-10-11', dueDate: '2026-10-29', totalDue: 20000, minimumDue: 5000 };

describe('monthly card statements', () => {
  it('saves a statement with its default period and keeps a newer figure on the card', async () => {
    const { user, card } = await setup();
    const st = await saveCardStatement(user.id, card.id, october);
    expect(st.month).toBe('2026-10');
    expect(st.periodStart.toISOString().slice(0, 10)).toBe('2026-09-12');
    // The card already holds November's figure, so October's statement leaves it alone.
    expect(Number((await prisma.creditCard.findUniqueOrThrow({ where: { id: card.id } })).outstanding)).toBe(16500);
    // Saving again for the same due month replaces it.
    await saveCardStatement(user.id, card.id, { ...october, totalDue: 21000 });
    expect(await prisma.cardStatement.count()).toBe(1);
  });

  it('pays part then the rest, shows due → part paid → paid, and undoes both', async () => {
    const { user, bank, card } = await setup();
    await saveCardStatement(user.id, card.id, october);
    await payCreditCardBill(user.id, card.id, 5000, undefined, { month: '2026-10', paidDate: '2026-10-16' });
    let view = (await getCardStatements(user.id, card.id)).statements[0];
    expect(view).toMatchObject({ status: 'PART_PAID', paidAmount: 5000, remaining: 15000, minimumMet: true, paidDate: '2026-10-16', paidFromAccountName: 'ICICI' });
    // Capped at what is still owed.
    const r = await payCreditCardBill(user.id, card.id, 99999, undefined, { month: '2026-10' });
    expect(r.paid).toBe(15000);
    view = (await getCardStatements(user.id, card.id)).statements[0];
    expect(view.status).toBe('PAID');
    expect(await balance(bank.id)).toBe(80000);
    await expect(payCreditCardBill(user.id, card.id, 1, undefined, { month: '2026-10' })).rejects.toMatchObject({ status: 400 });
    const row = (await getMonthlyPlan(user.id, '2026-10')).rows.find(x => x.type === 'CREDIT_CARD');
    expect(row).toMatchObject({ status: 'PAID', amount: 20000, statementId: view.id });

    await expect(deleteCardStatement(user.id, view.id!)).rejects.toMatchObject({ status: 409 });
    await undoPayment(user.id, { type: 'CREDIT_CARD', id: card.id, month: '2026-10' });
    expect(await balance(bank.id)).toBe(100000);
    expect((await getCardStatements(user.id, card.id)).statements[0].status).toBe('DUE');
    // The card's own November figure was never touched.
    expect(Number((await prisma.creditCard.findUniqueOrThrow({ where: { id: card.id } })).outstanding)).toBe(16500);
    await deleteCardStatement(user.id, view.id!);
    expect(await prisma.cardStatement.count()).toBe(0);
  });

  it('syncs the card from its latest statement', async () => {
    const { user, card } = await setup();
    await saveCardStatement(user.id, card.id, { statementDate: '2026-11-11', dueDate: '2026-11-29', totalDue: 18000, minimumDue: 900 });
    await payCreditCardBill(user.id, card.id, 8000);
    const synced = await prisma.creditCard.findUniqueOrThrow({ where: { id: card.id } });
    expect(Number(synced.outstanding)).toBe(10000);
    expect(Number(synced.minimumPayment)).toBe(900);
    await undoPayment(user.id, { type: 'CREDIT_CARD', id: card.id, month: '2026-11' });
    expect(Number((await prisma.creditCard.findUniqueOrThrow({ where: { id: card.id } })).outstanding)).toBe(18000);
  });

  it('refuses a month with no statement other than the card’s current one', async () => {
    const { user, card } = await setup();
    await expect(payCreditCardBill(user.id, card.id, 100, undefined, { month: '2026-09' })).rejects.toMatchObject({ status: 404 });
  });

  it('breaks a statement down into EMIs, card purchases, card bills and other', async () => {
    const { user, card } = await setup();
    await prisma.cardEMI.create({ data: { userId: user.id, creditCardId: card.id, itemName: 'Laptop', totalAmount: 60000, emiAmount: 5000, tenureMonths: 12, emisPaid: 2, startDate: new Date('2026-08-05T00:00:00Z') } });
    await prisma.recurringBill.create({ data: { userId: user.id, name: 'Streaming', amount: 649, startDate: new Date('2026-09-20T00:00:00Z'), creditCardId: card.id } });
    await createCardExpense(user.id, { creditCardId: card.id, name: 'Groceries', amount: 2000, date: '2026-09-19' });
    await createCardExpense(user.id, { creditCardId: card.id, name: 'Coffee', amount: 300, date: '2026-10-02', payNow: { paidDate: '2026-10-03' } });
    await saveCardStatement(user.id, card.id, { ...october, totalDue: 8000 });
    const { statements, upcoming } = await getCardStatements(user.id, card.id);
    const b = statements[0].breakdown;
    expect(b.emis.map(e => e.amount)).toEqual([5000]);
    expect(b.expenses.map(e => e.name)).toEqual(['Groceries']);
    expect(b.bills.map(e => e.amount)).toEqual([649]);
    expect(b.paidOff.map(e => e.name)).toEqual(['Coffee']);
    expect(b.itemsTotal).toBe(7649);
    expect(b.other).toBe(351);
    expect(upcoming.month).toBe('2026-11');
    expect(upcoming.estimatedTotal).toBe(5649); // EMI + streaming bill, nothing guessed
  });
});

describe('one-off card expenses', () => {
  it('bills on the right statement, or the one picked', async () => {
    const { user, card } = await setup();
    const a = await createCardExpense(user.id, { creditCardId: card.id, name: 'Cloudflare', amount: 1315.05, date: '2026-09-19' });
    const b = await createCardExpense(user.id, { creditCardId: card.id, name: 'BookMyShow', amount: 225.52, date: '2026-09-11', statementMonth: '2026-10' });
    expect([a.statementMonth, b.statementMonth]).toEqual(['2026-10', '2026-10']);
    const moved = await updateCardExpense(user.id, a.id, { date: '2026-10-20' });
    expect(moved.statementMonth).toBe('2026-11');
  });

  it('can be paid off straight away from a bank account, undone and deleted', async () => {
    const { user, bank, card } = await setup();
    const e = await createCardExpense(user.id, { creditCardId: card.id, name: 'Dinner', amount: 1500, date: '2026-11-02', category: 'Food & Dining', payNow: { paidDate: '2026-11-03' } });
    expect(e.paidDate).toBe('2026-11-03');
    expect(await balance(bank.id)).toBe(98500);
    expect(await prisma.transaction.count()).toBe(1);
    await expect(payCardExpense(user.id, e.id)).rejects.toMatchObject({ status: 409 });
    await expect(updateCardExpense(user.id, e.id, { amount: 10 })).rejects.toMatchObject({ status: 409 });
    await undoCardExpensePayment(user.id, e.id);
    expect(await balance(bank.id)).toBe(100000);
    expect(await prisma.transaction.count()).toBe(0);
    await payCardExpense(user.id, e.id, {});
    await deleteCardExpense(user.id, e.id);
    expect(await balance(bank.id)).toBe(100000);
    expect(await prisma.cardExpense.count()).toBe(0);
  });

  it('counts on Home: purchases when no statement is saved, linked ones not twice', async () => {
    const { user, card } = await setup();
    const inv = await prisma.investment.create({ data: { userId: user.id, assetName: 'Gold scheme', assetType: 'GOLD_SCHEME', purchaseDate: new Date('2026-02-09T00:00:00Z'), monthlyAmount: 10000 } });
    await createCardExpense(user.id, { creditCardId: card.id, name: 'Lenses', amount: 7799, date: '2026-10-20' });
    await createCardExpense(user.id, { creditCardId: card.id, name: 'Gold scheme', amount: 10000, date: '2026-10-25', linkedType: 'INVESTMENT', linkedId: inv.id });
    const s = await getMonthSummary(user.id, '2026-11');
    expect(s.combined.cards[0]).toMatchObject({ source: 'EXPENSES', oneOff: 7799, linked: 10000, spending: 7799 });
    expect(s.members[0].cardSpending).toBe(7799);
  });

  it('keeps other households out', async () => {
    const { card } = await setup();
    const other = await prisma.user.create({ data: { name: 'Other', email: 'other-cards@example.com', passwordHash: 'test' } });
    await expect(createCardExpense(other.id, { creditCardId: card.id, name: 'X', amount: 1, date: '2026-11-01' })).rejects.toMatchObject({ status: 404 });
    await expect(getCardStatements(other.id, card.id)).rejects.toMatchObject({ status: 404 });
  });
});
