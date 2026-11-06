import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { resetDatabase, prisma } from '../test/db';

// Runs the data part of the 20261106 transaction-kinds migration against seeded
// rows, so the backfill rules are checked the same way they ran on the dev DB.
const migration = fs.readFileSync(path.resolve(__dirname, '../../prisma/migrations/20261106000000_transaction_kinds/migration.sql'), 'utf8');
const backfill = migration.slice(migration.indexOf('-- ─── Backfill'))
  .split(/;\s*\n/).map((s) => s.replace(/^\s*--.*$/gm, '').trim()).filter(Boolean);

beforeEach(() => resetDatabase());
afterAll(() => prisma.$disconnect());

async function runBackfill() {
  await prisma.transaction.updateMany({ data: { kind: 'SPEND', sourceType: null, sourceId: null, period: null } });
  for (const sql of backfill) await prisma.$executeRawUnsafe(sql);
}

describe('transaction kinds backfill', () => {
  it('classifies and links existing entries', async () => {
    const user = await prisma.user.create({ data: { name: 'F', email: 'kinds@example.com', passwordHash: 'x' } });
    const cat = async (name: string) => (await prisma.category.create({ data: { userId: user.id, name, type: 'EXPENSE' } })).id;
    const [inv, emi, cardEmi, wealth, food, cardBill] = await Promise.all(['Investment', 'Loan EMI', 'Card EMI', 'Wealth Creation', 'Food', 'Credit Card Bill'].map(cat));
    const t = (data: Partial<{ type: 'INCOME' | 'EXPENSE'; categoryId: string; isWealthTransfer: boolean; date: Date }>) =>
      prisma.transaction.create({ data: { userId: user.id, type: 'EXPENSE', amount: 100, date: new Date('2026-10-31T20:00:00Z'), ...data } });

    const salary = await t({ type: 'INCOME' });
    const sip = await t({ categoryId: inv });               // linked from monthly_payments below
    const oldSip = await t({ categoryId: inv });            // unlinked, by category
    const interest = await t({ categoryId: emi });
    const principal = await t({ categoryId: wealth, isWealthTransfer: true });
    const oldCardEmi = await t({ categoryId: cardEmi });
    const groceries = await t({ categoryId: food });
    const cardPayment = await t({ categoryId: cardBill });
    const billPaid = await t({ categoryId: food });

    await prisma.monthlyPayment.createMany({ data: [
      { userId: user.id, entityType: 'INVESTMENT', entityId: 'inv1', month: '2026-10', status: 'PAID', amount: 100, transactionIds: [sip.id] },
      { userId: user.id, entityType: 'LOAN', entityId: 'loan1', month: '2026-09', status: 'PAID', amount: 200, transactionIds: [interest.id, principal.id] },
      { userId: user.id, entityType: 'CREDIT_CARD', entityId: 'card1', month: '2026-11', status: 'PAID', amount: 100, transactionIds: [cardPayment.id] },
    ] });
    const bill = await prisma.recurringBill.create({ data: { userId: user.id, name: 'Rent', amount: 100, startDate: new Date('2026-01-01'), frequency: 'MONTHLY', category: 'Rent' } });
    await prisma.billOccurrence.create({ data: { userId: user.id, billId: bill.id, dueDate: new Date('2026-10-31T19:00:00Z'), status: 'PAID', amount: 100, transactionId: billPaid.id } });

    await runBackfill();
    const get = async (id: string) => prisma.transaction.findUniqueOrThrow({ where: { id }, select: { kind: true, sourceType: true, sourceId: true, period: true } });

    expect(await get(salary.id)).toMatchObject({ kind: 'INCOME', sourceType: null });
    expect(await get(sip.id)).toEqual({ kind: 'SAVE', sourceType: 'INVESTMENT', sourceId: 'inv1', period: '2026-10' });
    expect((await get(oldSip.id)).kind).toBe('SAVE');
    expect(await get(interest.id)).toEqual({ kind: 'DEBT', sourceType: 'LOAN', sourceId: 'loan1', period: '2026-09' });
    expect((await get(principal.id)).kind).toBe('DEBT');
    expect((await get(oldCardEmi.id)).kind).toBe('DEBT');
    expect((await get(groceries.id)).kind).toBe('SPEND');
    // The card bill is everyday spending.
    expect(await get(cardPayment.id)).toEqual({ kind: 'SPEND', sourceType: 'CREDIT_CARD', sourceId: 'card1', period: '2026-11' });
    // 31 Oct 19:00 UTC is 1 Nov in India.
    expect(await get(billPaid.id)).toEqual({ kind: 'SPEND', sourceType: 'BILL', sourceId: bill.id, period: '2026-11' });
  });
});
