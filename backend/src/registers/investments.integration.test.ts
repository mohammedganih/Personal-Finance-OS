import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import { getInvestmentRegister } from './investments';
import { paidIntoInvestment } from '../schedule/paidIn';
import { decideMonthlyPayment } from '../services/monthlyPayments.service';

beforeEach(async () => { await resetDatabase(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-06T06:00:00Z')); });
afterEach(() => vi.useRealTimers());
afterAll(() => prisma.$disconnect());

describe('paid in', () => {
  const sip = { id: 's', purchaseDate: new Date('2026-06-09T06:00:00Z'), monthlyAmount: 1000 };
  it('counts the schedule before tracking began, then only what was recorded', () => {
    // Jun..Aug before tracking (3 000), Sep paid 1 000, Oct skipped, Nov not paid yet.
    expect(paidIntoInvestment(sip, [{ period: '2026-09', status: 'PAID', amount: 1000 }, { period: '2026-10', status: 'SKIPPED', amount: 0 }], '2026-11')).toBe(4000);
  });
  it('with nothing recorded, assumes every month up to last month was paid, honouring pauses and amount changes', () => {
    expect(paidIntoInvestment({ ...sip, pauseFrom: '2026-07', pauseUntil: '2026-07', nextMonthlyAmount: 2000, nextAmountFrom: '2026-09' }, [], '2026-11')).toBe(1000 + 1000 + 2000 + 2000);
  });
});

describe('savings & investments register', () => {
  it('gold scheme is worth what was paid in, with its maturity bonus; a SIP is worth what was paid in until a value is entered', async () => {
    const user = await prisma.user.create({ data: { name: 'F', email: 'invreg@example.com', passwordHash: 'x' } });
    const bank = await prisma.account.create({ data: { userId: user.id, name: 'Bank', type: 'SAVINGS', balance: 100000 } });
    // 11 x 10,000 from Feb 2026, maturing Dec 2026 with 1,10,000 + a 10,000 bonus.
    const gold = await prisma.investment.create({ data: { userId: user.id, assetName: 'Gold scheme', assetType: 'GOLD_SCHEME', monthlyAmount: 10000, quantity: 4.9, currentPrice: 13000, purchaseDate: new Date('2026-02-09T06:00:00Z'), maturityDate: new Date('2026-12-09T06:00:00Z'), maturityAmount: 120000, bankAccountId: bank.id, autoDebit: false } });
    const sip = await prisma.investment.create({ data: { userId: user.id, assetName: 'Index SIP', assetType: 'SIP', monthlyAmount: 2500, quantity: 100, currentPrice: 260, purchaseDate: new Date('2026-08-09T06:00:00Z') } });
    await prisma.dueStatus.create({ data: { userId: user.id, itemType: 'INVESTMENT', itemId: gold.id, period: '2026-10', status: 'PAID', amount: 10000 } });
    await decideMonthlyPayment(user.id, 'INVESTMENT', gold.id, 'PAID');

    const reg = await getInvestmentRegister(user.id);
    const g = reg.holdings.find((h) => h.name === 'Gold scheme')!;
    // Feb..Sep before tracking (8 x 10,000) + Oct + Nov recorded.
    expect(g).toMatchObject({ invested: 100000, value: 100000, monthly: 10000, maturityAmount: 120000, maturityBonus: 10000, next: { status: 'PAID', period: '2026-11' } });
    const s = reg.holdings.find((h) => h.name === 'Index SIP')!;
    // Aug..Oct assumed, Nov due. The units and NAV were never entered as a value.
    expect(s).toMatchObject({ invested: 7500, value: 7500, recurring: true, valuation: { atPaidIn: true, needsUpdate: true } });
    expect(reg.totals).toEqual({ totalValue: 107500, addedThisMonth: 10000, nextMaturity: { name: 'Gold scheme', date: '2026-12-09', amount: 120000 } });

    // A value entered on 20 Sep (after the Aug and Sep instalments): the 9 Oct instalment is added on top.
    await prisma.investment.update({ where: { id: sip.id }, data: { enteredValue: 5400, priceUpdatedAt: new Date('2026-09-20T06:00:00Z') } });
    const later = (await getInvestmentRegister(user.id)).holdings.find((h) => h.name === 'Index SIP')!;
    expect(later).toMatchObject({ invested: 7500, value: 7900, valuation: { atPaidIn: false, valuedAt: '2026-09-20', addedSince: 2500, needsUpdate: false } });
  });
});
