import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import { loanBalance, syncLoanBalance } from './progress';
import { decideMonthlyPayment } from '../services/monthlyPayments.service';
import { undoPayment } from '../services/paymentUndo.service';
import { prepayLoan, undoLoanEvent } from '../services/loanEvents.service';
import { createLoan, updateLoan } from '../services/loan.service';
import { createCardEMI, getCardEMIs } from '../services/card-emi.service';

beforeEach(async () => { await resetDatabase(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-06T06:00:00Z')); });
afterEach(() => vi.useRealTimers());
afterAll(() => prisma.$disconnect());

async function setup() {
  const user = await prisma.user.create({ data: { name: 'Family', email: 'progress@example.com', passwordHash: 'x' } });
  const bank = await prisma.account.create({ data: { userId: user.id, name: 'Bank', type: 'SAVINGS', balance: 500000 } });
  const loan = await createLoan(user.id, { name: 'Car', loanType: 'CAR', principal: 100000, interestRate: 12, emi: 10000, remainingBalance: 100000, tenureMonths: 12, startDate: '2026-01-05', bankAccountId: bank.id } as never);
  return { user, bank, loan };
}
const cached = async (id: string) => Number((await prisma.loan.findUniqueOrThrow({ where: { id } })).remainingBalance);

describe('loan balance from recorded payments', () => {
  it('opening balance less principal of recorded EMIs and prepayments; undo puts it back', async () => {
    const { user, loan } = await setup();
    await decideMonthlyPayment(user.id, 'LOAN', loan.id, 'PAID'); // 1% interest = 1000, principal 9000
    expect(await cached(loan.id)).toBe(91000);
    await prepayLoan(user.id, loan.id, { amount: 21000 });
    expect(await cached(loan.id)).toBe(70000);

    const events = await prisma.loanEvent.findMany({ where: { loanId: loan.id, type: 'PREPAYMENT' } });
    await undoLoanEvent(user.id, loan.id, events[0].id);
    expect(await cached(loan.id)).toBe(91000);
    await undoPayment(user.id, { type: 'LOAN', id: loan.id, month: '2026-11' });
    expect(await cached(loan.id)).toBe(100000);
  });

  it('a balance typed by hand becomes the new starting point', async () => {
    const { user, loan } = await setup();
    await decideMonthlyPayment(user.id, 'LOAN', loan.id, 'PAID');
    await updateLoan(user.id, loan.id, { remainingBalance: 80000 } as never);
    expect(await cached(loan.id)).toBe(80000);
    await undoPayment(user.id, { type: 'LOAN', id: loan.id, month: '2026-11' });
    expect(await cached(loan.id)).toBe(89000);
  });

  it('a stale cache is corrected from the records', async () => {
    const { loan } = await setup();
    await prisma.loan.update({ where: { id: loan.id }, data: { remainingBalance: 1 } });
    expect(await syncLoanBalance(prisma, loan.id)).toBe(100000);
    expect(await loanBalance(prisma, { id: loan.id, openingBalance: 100000 })).toBe(100000);
  });
});

describe('card EMI progress from the schedule', () => {
  it('counts instalments billed by date, whatever count was typed, and archives when done', async () => {
    const { user } = await setup();
    const card = await prisma.creditCard.create({ data: { userId: user.id, cardName: 'Card', creditLimit: 100000, statementDate: new Date('2026-07-09'), dueDate: new Date('2026-07-29') } });
    // First due 29 Apr; by 6 Nov the Apr..Oct instalments (7) are billed.
    const flight = await createCardEMI(user.id, { creditCardId: card.id, itemName: 'Flight', totalAmount: 58986, emiAmount: 6554, tenureMonths: 9, emisPaid: 2, isNoCost: true, startDate: '2026-04-04' } as never);
    expect(flight.emisPaid).toBe(7);
    vi.setSystemTime(new Date('2027-01-02T06:00:00Z'));
    const [after] = await getCardEMIs(user.id, true);
    expect(after).toMatchObject({ emisPaid: 9, isArchived: true, emisRemaining: 0, outstanding: 0 });
  });
});
