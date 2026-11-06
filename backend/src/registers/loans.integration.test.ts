import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import { amortise, getLoanRegister } from './loans';
import { createLoan } from '../services/loan.service';
import { decideMonthlyPayment } from '../services/monthlyPayments.service';

beforeEach(async () => { await resetDatabase(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-06T06:00:00Z')); });
afterEach(() => vi.useRealTimers());
afterAll(() => prisma.$disconnect());

describe('loans register', () => {
  it('amortises the balance', () => {
    expect(amortise(30000, 10000, 0, '2026-11')).toEqual({ monthsLeft: 3, endsMonth: '2027-01', interestLeft: 0 });
    expect(amortise(10000, 100, 24, '2026-11')).toEqual({ monthsLeft: null, endsMonth: null, interestLeft: null });
  });

  it('lists active loans with who pays, the account owner, this month\'s instalment, and closed loans apart', async () => {
    const user = await prisma.user.create({ data: { name: 'F', email: 'loanreg@example.com', passwordHash: 'x' } });
    const a = await prisma.familyMember.create({ data: { userId: user.id, name: 'Mohammed' } });
    const b = await prisma.familyMember.create({ data: { userId: user.id, name: 'Fathimah' } });
    const icici = await prisma.account.create({ data: { userId: user.id, memberId: a.id, name: 'ICICI', type: 'SAVINGS', balance: 100000 } });
    const marriage = await createLoan(user.id, { name: 'Marriage', loanType: 'PERSONAL', principal: 60000, interestRate: 0, emi: 10000, remainingBalance: 30000, tenureMonths: 6, startDate: '2026-06-05', paymentDay: 5, memberId: a.id, payerMemberId: b.id, bankAccountId: icici.id, autoDebit: false } as never);
    const old = await prisma.loan.create({ data: { userId: user.id, name: 'Bike', loanType: 'CAR', principal: 20000, interestRate: 0, emi: 2000, remainingBalance: 0, tenureMonths: 10, startDate: new Date('2025-01-05'), isActive: false } });
    await prisma.loanEvent.create({ data: { userId: user.id, loanId: old.id, type: 'CLOSED', date: new Date('2026-03-10') } });

    let reg = await getLoanRegister(user.id);
    expect(reg.totals).toEqual({ totalLeft: 30000, monthlyEmis: 10000, debtFreeMonth: '2027-01', debtFreeName: 'Marriage' });
    expect(reg.loans).toHaveLength(1);
    expect(reg.loans[0]).toMatchObject({
      name: 'Marriage', payerMemberId: b.id, borrowerMemberId: a.id, debitedFromMemberId: a.id, left: 30000,
      amortisation: { monthsLeft: 3, endsMonth: '2027-01', repaidSoFar: 30000 },
      next: { id: marriage.id, type: 'LOAN', status: 'PENDING', dueDate: '2026-11-05', period: '2026-11' },
    });
    expect(reg.closed).toEqual([expect.objectContaining({ name: 'Bike', closedMonth: '2026-03', next: null })]);

    await decideMonthlyPayment(user.id, 'LOAN', marriage.id, 'PAID');
    reg = await getLoanRegister(user.id);
    expect(reg.loans[0].next).toMatchObject({ status: 'PAID', period: '2026-11' });
    expect(reg.loans[0].left).toBe(20000);
  });
});
