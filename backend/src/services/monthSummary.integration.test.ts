import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import { getMonthSummary, saveSalary } from './monthSummary.service';

beforeEach(async () => { await resetDatabase(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-04T08:00:00Z')); });
afterEach(() => vi.useRealTimers());
afterAll(() => prisma.$disconnect());

async function setup() {
  const user = await prisma.user.create({ data: { name: 'Summary test', email: 'summary@example.com', passwordHash: 'test' } });
  const a = await prisma.familyMember.create({ data: { userId: user.id, name: 'Mohammed Gani', isDefault: true } });
  const b = await prisma.familyMember.create({ data: { userId: user.id, name: 'Fathimah' } });
  return { user, a, b };
}

describe('month summary from saved records', () => {
  it('works out who pays each row and flags shared loans', async () => {
    const { user, a, b } = await setup();
    const loan = { userId: user.id, loanType: 'PERSONAL' as const, principal: 10000, remainingBalance: 10000, emi: 2000, tenureMonths: 5, interestRate: 0, startDate: new Date('2026-09-30'), paymentDay: 7 };
    await prisma.loan.create({ data: { ...loan, name: 'Joint loan', memberId: a.id, payerMemberId: b.id } });
    await prisma.loan.create({ data: { ...loan, name: 'Own loan', memberId: a.id, payerMemberId: a.id } });
    const card = await prisma.creditCard.create({ data: { userId: user.id, cardName: 'Test card', creditLimit: 50000, dueDate: new Date('2026-11-18'), outstanding: 5000, memberId: b.id } });
    await prisma.recurringBill.create({ data: { userId: user.id, name: 'Streaming', amount: 500, startDate: new Date('2026-11-09'), creditCardId: card.id } });
    await prisma.recurringBill.create({ data: { userId: user.id, name: 'Water', amount: 300, startDate: new Date('2026-11-12') } });

    const s = await getMonthSummary(user.id, '2026-11');
    const [ma, mb] = s.members;
    expect(ma.loans.items.map(i => [i.name, i.shared])).toEqual([['Own loan', false]]);
    expect(mb.loans.items.map(i => [i.name, i.shared])).toEqual([['Joint loan', true]]);
    // Bill with no person falls back to the card's owner.
    expect(mb.bills.items.map(i => i.name)).toEqual(['Streaming']);
    expect(mb.cards[0]).toMatchObject({ statement: 5000, deducted: 500, spending: 4500 });
    expect(s.unassigned.map(u => u.name)).toEqual(['Water']);
  });

  it('confirming an expected salary keeps the numbers and drops the "expected" flag', async () => {
    const { user, a } = await setup();
    await saveSalary(user.id, { memberId: a.id, month: '2026-10', amount: 90000 });
    const expected = (await getMonthSummary(user.id, '2026-11')).members[0];
    expect(expected).toMatchObject({ salary: 90000, salaryIsEstimate: true });
    // Home's Confirm saves last month's amount for this month.
    await saveSalary(user.id, { memberId: a.id, month: '2026-11', amount: expected.salary });
    const confirmed = (await getMonthSummary(user.id, '2026-11')).members[0];
    expect(confirmed).toMatchObject({ salary: 90000, salaryIsEstimate: false, left: expected.left, free: expected.free });
  });

  it('saves salary per month and only for the user\'s own members', async () => {
    const { user, a } = await setup();
    await saveSalary(user.id, { memberId: a.id, month: '2026-10', amount: 90000 });
    expect((await getMonthSummary(user.id, '2026-11')).members[0]).toMatchObject({ salary: 90000, salaryIsEstimate: true });
    await saveSalary(user.id, { memberId: a.id, month: '2026-11', amount: 95000 });
    await saveSalary(user.id, { memberId: a.id, month: '2026-11', amount: 96000 });
    expect((await getMonthSummary(user.id, '2026-11')).members[0]).toMatchObject({ salary: 96000, salaryIsEstimate: false });
    expect(await prisma.monthlySalary.count()).toBe(2);

    const other = await prisma.user.create({ data: { name: 'Other', email: 'other@example.com', passwordHash: 'test' } });
    await expect(saveSalary(other.id, { memberId: a.id, month: '2026-11', amount: 1 })).rejects.toMatchObject({ status: 404 });
  });
});
