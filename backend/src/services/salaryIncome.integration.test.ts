import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import { saveSalary } from './monthSummary.service';

beforeEach(() => resetDatabase());
afterAll(() => prisma.$disconnect());

async function setup() {
  const user = await prisma.user.create({ data: { name: 'Family', email: 'salary@example.com', passwordHash: 'test' } });
  const member = await prisma.familyMember.create({ data: { userId: user.id, name: 'Fathimah' } });
  // The first savings account (by creation) is the default.
  const main = await prisma.account.create({ data: { userId: user.id, memberId: member.id, name: 'HDFC', type: 'SAVINGS', balance: 1000, createdAt: new Date('2025-01-01') } });
  const second = await prisma.account.create({ data: { userId: user.id, memberId: member.id, name: 'Canara', type: 'SAVINGS', balance: 0, createdAt: new Date('2025-02-01') } });
  const salaryCat = await prisma.category.create({ data: { userId: user.id, name: 'Salary', type: 'INCOME' } });
  return { user, member, main, second, salaryCat };
}
const balance = async (id: string) => Number((await prisma.account.findUniqueOrThrow({ where: { id } })).balance);
const entries = (userId: string) => prisma.transaction.findMany({ where: { userId, type: 'INCOME' } });

describe('salary as an income entry', () => {
  it('credits the person’s first savings account with one INCOME entry', async () => {
    const { user, member, main, salaryCat } = await setup();
    const saved = await saveSalary(user.id, { memberId: member.id, month: '2026-11', amount: 120000 });
    expect(saved.accountId).toBe(main.id);
    const [t] = await entries(user.id);
    expect(t).toMatchObject({ kind: 'INCOME', sourceType: 'SALARY', sourceId: saved.id, period: '2026-11', accountId: main.id, memberId: member.id, categoryId: salaryCat.id });
    expect(Number(t.amount)).toBe(120000);
    expect(await balance(main.id)).toBe(121000);
  });

  it('changing the amount moves the balance by the difference; 0 removes the entry', async () => {
    const { user, member, main } = await setup();
    await saveSalary(user.id, { memberId: member.id, month: '2026-11', amount: 120000 });
    await saveSalary(user.id, { memberId: member.id, month: '2026-11', amount: 118500 });
    expect(await entries(user.id)).toHaveLength(1);
    expect(await balance(main.id)).toBe(119500);
    await saveSalary(user.id, { memberId: member.id, month: '2026-11', amount: 0 });
    expect(await entries(user.id)).toHaveLength(0);
    expect(await balance(main.id)).toBe(1000);
  });

  it('moving it to another account moves the money too, and the choice sticks', async () => {
    const { user, member, main, second } = await setup();
    await saveSalary(user.id, { memberId: member.id, month: '2026-11', amount: 50000 });
    await saveSalary(user.id, { memberId: member.id, month: '2026-11', amount: 50000, accountId: second.id });
    expect(await balance(main.id)).toBe(1000);
    expect(await balance(second.id)).toBe(50000);
    await saveSalary(user.id, { memberId: member.id, month: '2026-11', amount: 51000 });
    expect(await balance(second.id)).toBe(51000);
  });

  it('adopts a salary already typed by hand instead of counting it twice', async () => {
    const { user, member, main, salaryCat } = await setup();
    const typed = await prisma.transaction.create({ data: { userId: user.id, type: 'INCOME', kind: 'INCOME', amount: 119000, date: new Date('2026-10-31T20:00:00Z'), memberId: member.id, accountId: main.id, categoryId: salaryCat.id, description: 'Salary' } });
    await prisma.account.update({ where: { id: main.id }, data: { balance: { increment: 119000 } } }); // what the typed entry did
    await saveSalary(user.id, { memberId: member.id, month: '2026-11', amount: 120000 });
    const all = await entries(user.id);
    expect(all.map((t) => t.id)).toEqual([typed.id]);
    expect(Number(all[0].amount)).toBe(120000);
    expect(all[0].sourceType).toBe('SALARY');
    expect(await balance(main.id)).toBe(121000);
  });

  it('refuses another household’s account', async () => {
    const { user, member } = await setup();
    const other = await prisma.user.create({ data: { name: 'O', email: 'o-sal@example.com', passwordHash: 'x' } });
    const theirs = await prisma.account.create({ data: { userId: other.id, name: 'X', type: 'SAVINGS', balance: 0 } });
    await expect(saveSalary(user.id, { memberId: member.id, month: '2026-11', amount: 1, accountId: theirs.id })).rejects.toMatchObject({ status: 404 });
    expect(await balance(theirs.id)).toBe(0);
  });
});
