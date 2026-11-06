import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import { getBillRegister } from './bills';
import { createBill, payOccurrence } from '../services/bill.service';

beforeEach(async () => { await resetDatabase(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-06T06:00:00Z')); });
afterEach(() => vi.useRealTimers());
afterAll(() => prisma.$disconnect());

const base = { currency: 'INR', reminderDays: 3, autoDebit: false, tags: [] };

describe('bills register', () => {
  it('monthly equivalent, set-aside for yearly bills, next due, who pays and where from', async () => {
    const user = await prisma.user.create({ data: { name: 'F', email: 'billreg@example.com', passwordHash: 'x' } });
    const a = await prisma.familyMember.create({ data: { userId: user.id, name: 'Mohammed' } });
    const bank = await prisma.account.create({ data: { userId: user.id, name: 'ICICI', type: 'SAVINGS', balance: 100000 } });
    const card = await prisma.creditCard.create({ data: { userId: user.id, cardName: 'Rewards', creditLimit: 100000, dueDate: new Date('2026-11-29'), memberId: a.id } });
    const rent = await createBill(user.id, { ...base, name: 'Rent', amount: 20000, startDate: '2026-01-03', frequency: 'MONTHLY', category: 'Housing', accountId: bank.id, memberId: a.id });
    await createBill(user.id, { ...base, name: 'Netflix', amount: 649, startDate: '2026-01-20', frequency: 'MONTHLY', category: 'Entertainment', creditCardId: card.id });
    await createBill(user.id, { ...base, name: 'Insurance', amount: 24000, startDate: '2026-03-15', frequency: 'YEARLY', category: 'Insurance', accountId: bank.id });
    await payOccurrence(user.id, rent.id, { dueDate: '2026-11-03', createTransaction: true });

    const reg = await getBillRegister(user.id);
    const by = Object.fromEntries(reg.bills.map((b) => [b.name, b]));
    expect(by.Rent).toMatchObject({ monthlyEquivalent: 20000, setAsidePerMonth: null, payerMemberId: a.id, paidFrom: { kind: 'ACCOUNT', name: 'ICICI' }, next: { status: 'PAID', dueDate: '2026-11-03' } });
    expect(by.Netflix).toMatchObject({ subscription: true, payerMemberId: a.id, paidFrom: { kind: 'CARD', name: 'Rewards' }, next: { status: 'PENDING', dueDate: '2026-11-20' } });
    expect(by.Insurance).toMatchObject({ yearly: true, monthlyEquivalent: 2000, setAsidePerMonth: 2000, next: { status: 'PENDING', dueDate: '2027-03-15', period: '2027-03' } });
    expect(reg.totals).toEqual({ monthlyTotal: 22649, dueThisMonthLeft: 649, yearlyCosts: 24000, yearlySetAside: 2000 });
  });
});
