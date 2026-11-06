import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { resetDatabase, prisma } from '../test/db';
import { getSpending } from './spending.service';
import { getBudgets } from './budget.service';
import { createTransaction, createTransfer } from './transaction.service';
import { createCardExpense } from './cardStatement.service';
import { createBill } from './bill.service';
import { payCreditCardBill } from './credit-card.service';

beforeEach(async () => { await resetDatabase(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-20T06:00:00Z')); });
afterEach(() => vi.useRealTimers());
afterAll(() => prisma.$disconnect());

async function household() {
  const user = await prisma.user.create({ data: { name: 'F', email: 'spending@example.com', passwordHash: 'x' } });
  const bank = await prisma.account.create({ data: { userId: user.id, name: 'Bank', type: 'SAVINGS', balance: 100000 } });
  const other = await prisma.account.create({ data: { userId: user.id, name: 'Other', type: 'SAVINGS', balance: 0 } });
  const food = await prisma.category.create({ data: { userId: user.id, name: 'Groceries', type: 'EXPENSE', color: '#22C55E' } });
  const card = await prisma.creditCard.create({ data: { userId: user.id, cardName: 'Rewards', creditLimit: 100000, outstanding: 5000, dueDate: new Date('2026-11-29'), bankAccountId: bank.id } });
  return { user, bank, other, food, card };
}

describe('spending', () => {
  it('lists bank and card purchases together by day, everyday spending only by default', async () => {
    const { user, bank, other, food, card } = await household();
    await createTransaction(user.id, { type: 'EXPENSE', amount: 800, date: '2026-11-18', accountId: bank.id, categoryId: food.id, description: 'Vegetables', isRecurring: false });
    await createCardExpense(user.id, { creditCardId: card.id, name: 'Big basket', amount: 1200, date: '2026-11-18', category: 'groceries' } as never);
    await createTransfer(user.id, { fromAccountId: bank.id, toAccountId: other.id, amount: 5000, date: '2026-11-19' });
    await payCreditCardBill(user.id, card.id, 5000);

    const s = await getSpending(user.id, '2026-11');
    expect(s.total).toBe(2000);
    expect(s.days.map((d) => [d.date, d.total, d.entries.map((e) => `${e.source}:${e.name}`)])).toEqual([
      ['2026-11-18', 2000, expect.arrayContaining(['BANK:Vegetables', 'CARD:Big basket'])],
    ]);
    // The card purchase landed on the same category (matched by name, ignoring case).
    expect(s.categories).toEqual([{ categoryId: food.id, name: 'Groceries', color: '#22C55E', total: 2000, limit: null, budgetId: null }]);

    const all = await getSpending(user.id, '2026-11', true);
    expect(all.total).toBe(2000); // transfers and the card bill show, but aren't spending
    expect(all.days.flatMap((d) => d.entries).map((e) => e.kind).sort()).toEqual(['SPEND', 'SPEND', 'SPEND', 'TRANSFER', 'TRANSFER']);
  });

  it('a category limit counts card purchases but not the card bill', async () => {
    const { user, bank, food, card } = await household();
    await prisma.budget.create({ data: { userId: user.id, categoryId: food.id, monthlyLimit: 3000 } });
    await createTransaction(user.id, { type: 'EXPENSE', amount: 800, date: '2026-11-18', accountId: bank.id, categoryId: food.id, isRecurring: false });
    await createCardExpense(user.id, { creditCardId: card.id, name: 'Big basket', amount: 1200, date: '2026-11-18', category: 'Groceries' } as never);
    const [budget] = await getBudgets(user.id);
    expect(budget.spent).toBe(2000);
    expect((await getSpending(user.id, '2026-11')).categories[0]).toMatchObject({ total: 2000, limit: 3000, budgetId: budget.id });
  });

  it('bills and card purchases get a category from the one list, created when missing', async () => {
    const { user } = await household();
    const bill = await createBill(user.id, { name: 'Gym', amount: 1500, startDate: '2026-11-05', frequency: 'MONTHLY', category: 'Fitness', currency: 'INR', reminderDays: 3, autoDebit: false, tags: [] });
    const row = await prisma.recurringBill.findUniqueOrThrow({ where: { id: bill.id }, include: { categoryRef: true } });
    expect(row.categoryRef).toMatchObject({ name: 'Fitness', type: 'EXPENSE', userId: user.id });
  });
});

describe('category migration', () => {
  const migration = fs.readFileSync(path.resolve(__dirname, '../../prisma/migrations/20261107000000_one_category_list/migration.sql'), 'utf8');
  const data = migration.slice(migration.indexOf('-- ─── One category list')).split(/;\s*\n/).map((s) => s.replace(/^\s*--.*$/gm, '').trim()).filter(Boolean);

  it('links every bill and card purchase to a category, creating missing ones once', async () => {
    const { user, card } = await household();
    await prisma.recurringBill.createMany({ data: [
      { userId: user.id, name: 'Wifi', amount: 700, startDate: new Date('2026-01-01'), category: 'Wifi' },
      { userId: user.id, name: 'Wifi 2', amount: 700, startDate: new Date('2026-01-01'), category: 'wifi ' },
    ] });
    await prisma.cardExpense.create({ data: { userId: user.id, creditCardId: card.id, name: 'Milk', amount: 50, date: new Date('2026-11-01'), statementMonth: '2026-11', category: 'GROCERIES' } });
    for (const sql of data) await prisma.$executeRawUnsafe(sql);
    const cats = await prisma.category.findMany({ where: { userId: user.id }, select: { name: true } });
    expect(cats.map((c) => c.name).sort()).toEqual(['Groceries', 'Wifi']);
    expect(await prisma.recurringBill.count({ where: { userId: user.id, categoryId: null } })).toBe(0);
    expect((await prisma.cardExpense.findFirstOrThrow({ include: { categoryRef: true } })).categoryRef?.name).toBe('Groceries');
  });
});
