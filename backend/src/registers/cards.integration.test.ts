import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import { getCardRegister } from './cards';
import { createCardExpense, saveCardStatement } from '../services/cardStatement.service';
import { payCreditCardBill } from '../services/credit-card.service';

beforeEach(async () => { await resetDatabase(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-14T06:00:00Z')); });
afterEach(() => vi.useRealTimers());
afterAll(() => prisma.$disconnect());

describe('credit cards register', () => {
  it('statement due, building now, EMIs still to bill and the limit left', async () => {
    const user = await prisma.user.create({ data: { name: 'F', email: 'cardreg@example.com', passwordHash: 'x' } });
    const bank = await prisma.account.create({ data: { userId: user.id, name: 'Bank', type: 'SAVINGS', balance: 100000 } });
    const card = await prisma.creditCard.create({ data: { userId: user.id, cardName: 'Rewards', creditLimit: 100000, statementDate: new Date('2026-10-11'), dueDate: new Date('2026-10-29'), bankAccountId: bank.id } });
    // A 3 x 2,000 EMI that started billing in October: Oct billed, Nov + Dec still to bill.
    await prisma.cardEMI.create({ data: { userId: user.id, creditCardId: card.id, itemName: 'Phone', totalAmount: 6000, emiAmount: 2000, tenureMonths: 3, startDate: new Date('2026-09-20') } });
    await saveCardStatement(user.id, card.id, { statementDate: '2026-11-11', dueDate: '2026-11-29', totalDue: 9000 } as never);
    await payCreditCardBill(user.id, card.id, 4000, bank.id, { month: '2026-11' });
    await createCardExpense(user.id, { creditCardId: card.id, name: 'Shoes', amount: 1500, date: '2026-11-13' } as never); // this cycle

    const reg = await getCardRegister(user.id);
    expect(reg.cards).toHaveLength(1);
    const c = reg.cards[0];
    expect(c.statementDue).toMatchObject({ amount: 5000, dueDate: '2026-11-29', month: '2026-11', overdue: false });
    expect(c.buildingNow).toEqual({ amount: 1500 + 2000, dueDate: '2026-12-29' });
    expect(c.emiStillToBill).toBe(4000);
    expect(c.available).toBe(100000 - 5000 - 1500 - 4000);
    expect(reg.totals).toEqual({ statementDue: 5000, nextDueDate: '2026-11-29', buildingNow: 3500, available: 89500 });
  });
});
