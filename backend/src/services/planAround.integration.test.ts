import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import { getPlanAround } from './monthlyPayments.service';

beforeEach(async () => { await resetDatabase(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-04T06:00:00Z')); });
afterEach(() => vi.useRealTimers());
afterAll(() => prisma.$disconnect());

describe('monthly plan for a chosen month (Home ?m=)', () => {
  it('defaults to this month with last and next month around it', async () => {
    const user = await prisma.user.create({ data: { name: 'Family', email: 'plan@example.com', passwordHash: 'test' } });
    const plan = await getPlanAround(user.id);
    expect([plan.previous.month, plan.current.month, plan.next.month]).toEqual(['2026-10', '2026-11', '2026-12']);
  });

  it('centres on the chosen month, across a year boundary', async () => {
    const user = await prisma.user.create({ data: { name: 'Family', email: 'plan2@example.com', passwordHash: 'test' } });
    await prisma.loan.create({ data: { userId: user.id, name: 'Car', loanType: 'CAR', principal: 100000, interestRate: 0, emi: 10000, remainingBalance: 50000, tenureMonths: 10, startDate: new Date('2025-06-05') } });
    const plan = await getPlanAround(user.id, '2026-01');
    expect([plan.previous.month, plan.current.month, plan.next.month]).toEqual(['2025-12', '2026-01', '2026-02']);
    expect(plan.current.rows.find(r => r.type === 'LOAN')?.amount).toBe(10000);
  });
});
