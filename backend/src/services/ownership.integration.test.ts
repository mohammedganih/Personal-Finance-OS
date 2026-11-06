import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import { assertOwned } from '../lib/ownership';
import { createTransaction, updateTransaction } from './transaction.service';
import { createInvestment, updateInvestment } from './investment.service';
import { createGoal, updateGoal } from './goal.service';
import { createBudget } from './budget.service';
import { createLoan, updateLoan } from './loan.service';
import { createBill } from './bill.service';

beforeEach(() => resetDatabase());
afterAll(() => prisma.$disconnect());

// Two households: everything "theirs" belongs to the other login.
async function households() {
  const mk = async (tag: string) => {
    const user = await prisma.user.create({ data: { name: tag, email: `${tag}@example.com`, passwordHash: 'test' } });
    const member = await prisma.familyMember.create({ data: { userId: user.id, name: `${tag} person` } });
    const account = await prisma.account.create({ data: { userId: user.id, name: `${tag} bank`, type: 'SAVINGS', balance: 1000 } });
    const category = await prisma.category.create({ data: { userId: user.id, name: `${tag} food`, type: 'EXPENSE' } });
    const card = await prisma.creditCard.create({ data: { userId: user.id, cardName: `${tag} card`, creditLimit: 10000, dueDate: new Date('2026-11-20') } });
    const investment = await prisma.investment.create({ data: { userId: user.id, assetName: `${tag} flat`, assetType: 'REAL_ESTATE', purchaseDate: new Date('2025-01-01') } });
    return { user, member, account, category, card, investment };
  };
  return { mine: await mk('mine'), theirs: await mk('theirs') };
}
const notFound = { status: 404 };

describe('assertOwned', () => {
  it('accepts own ids and shared default categories, skips empty ids', async () => {
    const { mine } = await households();
    const shared = await prisma.category.create({ data: { name: 'Groceries', type: 'EXPENSE', isDefault: true } });
    await expect(assertOwned(mine.user.id, { accounts: [mine.account.id, null], categories: [mine.category.id, shared.id], members: [undefined, mine.member.id] })).resolves.toBeUndefined();
  });

  it('rejects another household’s ids of every kind', async () => {
    const { mine, theirs } = await households();
    const u = mine.user.id;
    await expect(assertOwned(u, { accounts: [mine.account.id, theirs.account.id] })).rejects.toMatchObject({ status: 404, message: 'Account not found' });
    await expect(assertOwned(u, { categories: [theirs.category.id] })).rejects.toMatchObject({ message: 'Category not found' });
    await expect(assertOwned(u, { members: [theirs.member.id] })).rejects.toMatchObject({ message: 'Family member not found' });
    await expect(assertOwned(u, { creditCards: [theirs.card.id] })).rejects.toMatchObject({ message: 'Credit card not found' });
    await expect(assertOwned(u, { investments: [theirs.investment.id] })).rejects.toMatchObject({ message: 'Investment not found' });
  });
});

describe('create and update refuse another household’s ids', () => {
  it('transactions: account, category, person and split person', async () => {
    const { mine, theirs } = await households();
    const u = mine.user.id;
    const base = { type: 'EXPENSE' as const, amount: 100, date: '2026-11-01', isRecurring: false };
    for (const bad of [{ accountId: theirs.account.id }, { categoryId: theirs.category.id }, { memberId: theirs.member.id }, { splitMemberId: theirs.member.id }]) {
      await expect(createTransaction(u, { ...base, ...bad })).rejects.toMatchObject(notFound);
    }
    // Nothing was written, and the other household's balance did not move.
    expect(await prisma.transaction.count()).toBe(0);
    expect(Number((await prisma.account.findUniqueOrThrow({ where: { id: theirs.account.id } })).balance)).toBe(1000);

    const t = await createTransaction(u, { ...base, accountId: mine.account.id, categoryId: mine.category.id, memberId: mine.member.id });
    await expect(updateTransaction(u, t.id, { accountId: theirs.account.id })).rejects.toMatchObject(notFound);
    expect(Number((await prisma.account.findUniqueOrThrow({ where: { id: theirs.account.id } })).balance)).toBe(1000);
  });

  it('investments, goals, budgets, loans and bills', async () => {
    const { mine, theirs } = await households();
    const u = mine.user.id;
    await expect(createInvestment(u, { assetName: 'RD', assetType: 'RECURRING_DEPOSIT', bankAccountId: theirs.account.id } as never)).rejects.toMatchObject(notFound);
    await expect(updateInvestment(u, mine.investment.id, { memberId: theirs.member.id } as never)).rejects.toMatchObject(notFound);

    await expect(createGoal(u, { name: 'Car', targetAmount: 1000, memberId: theirs.member.id } as never)).rejects.toMatchObject(notFound);
    const goal = await createGoal(u, { name: 'Car', targetAmount: 1000, targetDate: '2027-12-31', goalType: 'CUSTOM', priority: 'MEDIUM', currentAmount: 0 } as never);
    await expect(updateGoal(u, goal.id, { memberId: theirs.member.id } as never)).rejects.toMatchObject(notFound);
    await expect(updateGoal(u, goal.id, { fundingAccountId: theirs.account.id } as never)).rejects.toMatchObject(notFound);

    await expect(createBudget(u, { categoryId: theirs.category.id, monthlyLimit: 500 })).rejects.toMatchObject(notFound);

    const loan = { name: 'Car', loanType: 'CAR', principal: 1000, interestRate: 0, emi: 100, remainingBalance: 1000, tenureMonths: 10, startDate: '2026-09-01' } as const;
    await expect(createLoan(u, { ...loan, bankAccountId: theirs.account.id } as never)).rejects.toMatchObject(notFound);
    await expect(createLoan(u, { ...loan, linkedInvestmentId: theirs.investment.id } as never)).rejects.toMatchObject(notFound);
    const own = await createLoan(u, loan as never);
    await expect(updateLoan(u, own.id, { bankAccountId: theirs.account.id } as never)).rejects.toMatchObject(notFound);

    await expect(createBill(u, { name: 'Rent', amount: 100, startDate: '2026-11-10', frequency: 'MONTHLY', category: 'Rent', currency: 'INR', reminderDays: 3, autoDebit: false, tags: [], creditCardId: theirs.card.id } as never)).rejects.toMatchObject(notFound);
  });
});
