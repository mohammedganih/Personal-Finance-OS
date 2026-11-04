import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import { payCardEMI } from './card-emi.service';
import { getMonthlyPlan } from './monthlyPayments.service';
import { getEMICalendar } from './debtIntelligence.service';
import { indiaDateKey } from '../lib/cardPaymentSchedule';
beforeEach(async () => { await resetDatabase(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-04T00:00:00Z')); });
afterEach(() => vi.useRealTimers());
afterAll(() => prisma.$disconnect());
async function setup(tenureMonths = 1, startDate = '2026-09-20') {
  const user = await prisma.user.create({ data: { name: 'Card test', email: 'card-schedule@example.com', passwordHash: 'test' } });
  const account = await prisma.account.create({ data: { userId: user.id, name: 'Bank', type: 'SAVINGS', balance: 10000 } });
  const card = await prisma.creditCard.create({ data: { userId: user.id, cardName: 'Card', creditLimit: 100000, outstanding: 0, statementDate: new Date('2026-07-09'), dueDate: new Date('2026-07-29') } });
  const emi = await prisma.cardEMI.create({ data: { userId: user.id, creditCardId: card.id, itemName: 'Purchase', totalAmount: 3000 * tenureMonths, emiAmount: 3000, tenureMonths, startDate: new Date(startDate), isNoCost: true } });
  return { user, account, card, emi };
}
describe('card payments and monthly planning integration', () => {
  it('ticks off the due-month instalment without moving money, and removes a final payment from next month', async () => {
    const { user, account, emi } = await setup();
    expect((await getMonthlyPlan(user.id, '2026-10')).creditCards).toBe(3000);
    expect((await getMonthlyPlan(user.id, '2026-11')).creditCards).toBe(0);
    const result = await payCardEMI(user.id, emi.id, account.id);
    expect(result.isComplete).toBe(true);
    // The EMI is part of the card bill: no bank debit until the card bill is paid.
    expect(Number((await prisma.account.findUniqueOrThrow({ where: { id: account.id } })).balance)).toBe(10000);
    const plan = await getMonthlyPlan(user.id, '2026-10');
    expect(plan.paid).toBe(3000); expect(plan.remaining).toBe(0);
    expect(await prisma.transaction.count({ where: { userId: user.id } })).toBe(0);
    expect((await prisma.monthlyPayment.findFirstOrThrow({ where: { userId: user.id } })).month).toBe('2026-10');
  });
  it('does not record a second payment in the same month for a late installment', async () => {
    const { user, account, emi } = await setup(12, '2026-03-01');
    await payCardEMI(user.id, emi.id, account.id);
    await expect(payCardEMI(user.id, emi.id, account.id)).rejects.toThrow('already recorded');
    expect(await prisma.monthlyPayment.count({ where: { userId: user.id } })).toBe(1);
    const calendar = await getEMICalendar(user.id, 3);
    expect(calendar.filter(e => e.sourceType === 'CARD_EMI').map(e => indiaDateKey(e.date))).toEqual(['2026-11-29', '2026-12-29']);
    expect((await getMonthlyPlan(user.id, '2026-11')).creditCards).toBe(3000);
  });
  it('rejects a future cycle and never touches a bank account', async () => {
    const { user, account, emi } = await setup(2, '2026-10-20');
    await expect(payCardEMI(user.id, emi.id, account.id)).rejects.toThrow('not due this month');
    await prisma.cardEMI.update({ where: { id: emi.id }, data: { startDate: new Date('2026-09-20') } });
    const other = await prisma.user.create({ data: { name: 'Other', email: 'other-card@example.com', passwordHash: 'test' } });
    const foreign = await prisma.account.create({ data: { userId: other.id, name: 'Other bank', type: 'SAVINGS', balance: 10000 } });
    await payCardEMI(user.id, emi.id, foreign.id);
    expect(Number((await prisma.account.findUniqueOrThrow({ where: { id: foreign.id } })).balance)).toBe(10000);
    expect(await prisma.transaction.count()).toBe(0);
  });
});
