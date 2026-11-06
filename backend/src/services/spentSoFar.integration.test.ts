import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import { getMonthSummary, saveSalary } from './monthSummary.service';
import { createTransaction, createTransfer } from './transaction.service';
import { createBill, payOccurrence } from './bill.service';
import { createCardExpense } from './cardStatement.service';

beforeEach(async () => { await resetDatabase(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-20T06:00:00Z')); });
afterEach(() => vi.useRealTimers());
afterAll(() => prisma.$disconnect());

async function household() {
  const user = await prisma.user.create({ data: { name: 'Family', email: 'spent@example.com', passwordHash: 'x' } });
  const a = await prisma.familyMember.create({ data: { userId: user.id, name: 'Mohammed', isDefault: true, createdAt: new Date('2025-01-01') } });
  const b = await prisma.familyMember.create({ data: { userId: user.id, name: 'Fathimah', createdAt: new Date('2025-01-02') } });
  const bank = await prisma.account.create({ data: { userId: user.id, memberId: a.id, name: 'Bank', type: 'SAVINGS', balance: 500000 } });
  const other = await prisma.account.create({ data: { userId: user.id, memberId: b.id, name: 'Other', type: 'SAVINGS', balance: 0 } });
  const card = await prisma.creditCard.create({ data: { userId: user.id, cardName: 'Card', creditLimit: 100000, statementDate: new Date('2026-07-11'), dueDate: new Date('2026-07-29'), memberId: b.id } });
  await saveSalary(user.id, { memberId: a.id, month: '2026-11', amount: 100000, accountId: bank.id });
  return { user, a, b, bank, other, card };
}

describe('quick add', () => {
  it('a spend from a bank account or on a card, with just amount and what, lands in spent so far', async () => {
    const { user, a, b, bank, card } = await household();
    // The two payloads Quick add sends (today = 20 Nov, after the card's statement day).
    await createTransaction(user.id, { type: 'EXPENSE', amount: 250, description: 'Tea', date: '2026-11-20', accountId: bank.id, memberId: a.id, isRecurring: false });
    await createCardExpense(user.id, { creditCardId: card.id, name: 'Petrol', amount: 1500, date: '2026-11-20', memberId: b.id } as never);
    const s = await getMonthSummary(user.id, '2026-11');
    expect(s.members[0].spentSoFar.items.map((i) => [i.name, i.amount])).toEqual([['Tea', 250]]);
    expect(s.members[1].spentSoFar.items.map((i) => [i.name, i.amount])).toEqual([['Petrol (Card)', 1500]]);
    expect(Number((await prisma.account.findUniqueOrThrow({ where: { id: bank.id } })).balance)).toBe(500000 + 100000 - 250);
  });
});

describe('spent so far', () => {
  it('counts everyday spending not already on the sheet, split per person, and gives still free', async () => {
    const { user, a, b, bank, other, card } = await household();
    const day = '2026-11-15';
    // Counted: a hand-typed spend shared 50/50, and a card purchase that lands on next month's statement.
    await createTransaction(user.id, { type: 'EXPENSE', amount: 4000, date: day, accountId: bank.id, memberId: a.id, splitMemberId: b.id, splitRatio: 50, description: 'Groceries', isRecurring: false });
    await createCardExpense(user.id, { creditCardId: card.id, name: 'Shoes', amount: 3000, date: day } as never);
    // Not counted: a bill payment (Bills bucket), a transfer, saving, and a card purchase on this month's statement.
    const bill = await createBill(user.id, { name: 'Rent', amount: 20000, startDate: '2026-11-10', frequency: 'MONTHLY', category: 'Rent', currency: 'INR', reminderDays: 3, autoDebit: false, tags: [], accountId: bank.id, memberId: a.id });
    await payOccurrence(user.id, bill.id, { dueDate: '2026-11-10', createTransaction: true });
    await createTransfer(user.id, { fromAccountId: bank.id, toAccountId: other.id, amount: 9000, date: day });
    await prisma.transaction.create({ data: { userId: user.id, type: 'EXPENSE', kind: 'SAVE', amount: 5000, date: new Date(`${day}T06:00:00Z`), memberId: a.id } });
    await createCardExpense(user.id, { creditCardId: card.id, name: 'Lunch', amount: 700, date: '2026-11-05' } as never); // before the 11th: this month's statement

    const s = await getMonthSummary(user.id, '2026-11');
    const [ma, mb] = s.members;
    expect(ma.spentSoFar.total).toBe(2000);
    expect(mb.spentSoFar.total).toBe(2000 + 3000);
    expect(ma.spentSoFar.items[0]).toMatchObject({ name: 'Groceries', amount: 2000, fullAmount: 4000, sharePct: 50 });
    expect(mb.spentSoFar.items.map((i) => i.name).sort()).toEqual(['Groceries', 'Shoes (Card)']);
    expect(s.combined.spentSoFar.total).toBe(7000);
    expect(ma.stillFree).toBe(ma.free - 2000);
    expect(s.combined.stillFree).toBe(s.combined.free - 7000);
  });
});
