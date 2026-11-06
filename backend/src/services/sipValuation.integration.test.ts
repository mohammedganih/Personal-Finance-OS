import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import { computeInvestmentValue, createInvestment, enteredValueOnCreate, enteredValueOnUpdate, updateInvestment, valueStatus } from './investment.service';
import { decideMonthlyPayment } from './monthlyPayments.service';
import { paidInByInvestment, paidInWithSince } from '../schedule/paidIn';
import { getBalanceSheet } from '../metrics';

// SIPs and mutual funds: worth what was paid in until a value is entered; then
// the entered value plus any instalments paid after it.

beforeEach(async () => { await resetDatabase(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-06T06:00:00Z')); });
afterEach(() => vi.useRealTimers());
afterAll(() => prisma.$disconnect());

const sip = { id: 's', purchaseDate: new Date('2026-07-05T06:00:00Z'), monthlyAmount: 1000, paymentDay: 5 };

describe('SIP valuation rules', () => {
  it('splits what was paid in at the date the value was entered', () => {
    // Jul..Oct assumed (5th of each month); Nov not recorded yet.
    expect(paidInWithSince({ ...sip, priceUpdatedAt: null }, [], '2026-11')).toEqual({ total: 4000, sinceValued: 0 });
    expect(paidInWithSince({ ...sip, priceUpdatedAt: new Date('2026-08-20T06:00:00Z') }, [], '2026-11')).toEqual({ total: 4000, sinceValued: 2000 });
    // An instalment on the same day as the entry is taken as already in the value.
    expect(paidInWithSince({ ...sip, priceUpdatedAt: new Date('2026-10-05T10:00:00Z') }, [], '2026-11').sinceValued).toBe(0);
    // A recorded payment counts from its paid date.
    const records = [{ period: '2026-11', status: 'PAID', amount: 1500, paidDate: new Date('2026-11-06T05:00:00Z') }];
    expect(paidInWithSince({ ...sip, priceUpdatedAt: new Date('2026-11-01T06:00:00Z') }, records, '2026-11')).toEqual({ total: 5500, sinceValued: 1500 });
  });

  it('values a SIP at paid in, then at the entered value plus later instalments', () => {
    const inv = { assetType: 'SIP', quantity: 40, buyPrice: 0, currentPrice: 90, monthlyAmount: 1000, purchaseDate: sip.purchaseDate, enteredValue: null, priceUpdatedAt: null } as never;
    expect(computeInvestmentValue(inv, new Date(), { total: 4000, sinceValued: 0 })).toEqual({ investedValue: 4000, currentValue: 4000, valuedAtPaidIn: true });
    const valued = { ...(inv as object), enteredValue: 3600, priceUpdatedAt: new Date('2026-09-01') } as never;
    expect(computeInvestmentValue(valued, new Date(), { total: 4000, sinceValued: 2000 })).toEqual({ investedValue: 4000, currentValue: 5600, valuedAtPaidIn: false });
  });

  it('values a lump-sum mutual fund at what was paid until a value is entered', () => {
    const mf = { assetType: 'MUTUAL_FUND', quantity: 10, buyPrice: 100, currentPrice: 130, enteredValue: null } as never;
    expect(computeInvestmentValue(mf, new Date()).currentValue).toBe(1000);
    expect(computeInvestmentValue({ ...(mf as object), enteredValue: 1300 } as never, new Date()).currentValue).toBe(1300);
  });

  it('takes the entered value from a typed value, or units × NAV', () => {
    expect(enteredValueOnCreate({ assetType: 'SIP', quantity: 10, currentPrice: 50 })).toBe(500);
    expect(enteredValueOnCreate({ assetType: 'SIP', quantity: 10, currentPrice: 50, currentValue: 520 })).toBe(520);
    expect(enteredValueOnCreate({ assetType: 'SIP', quantity: 0, currentPrice: 0 })).toBeNull();
    expect(enteredValueOnCreate({ assetType: 'STOCK', quantity: 10, currentPrice: 50 })).toBeNull();
    const existing = { assetType: 'SIP', quantity: 10, currentPrice: 50 };
    expect(enteredValueOnUpdate(existing, { quantity: 10, currentPrice: 50 })).toEqual({}); // nothing changed
    expect(enteredValueOnUpdate(existing, { currentPrice: 55 })).toEqual({ enteredValue: 550 });
    expect(enteredValueOnUpdate(existing, { currentValue: 600 })).toEqual({ enteredValue: 600 });
  });

  it('says when a value needs updating', () => {
    const now = new Date('2026-11-06T06:00:00Z');
    expect(valueStatus({ assetType: 'SIP', enteredValue: null, priceUpdatedAt: null }, undefined, now)).toMatchObject({ atPaidIn: true, needsUpdate: true });
    expect(valueStatus({ assetType: 'SIP', enteredValue: 100, priceUpdatedAt: new Date('2026-10-30') }, { total: 0, sinceValued: 0 }, now)).toMatchObject({ atPaidIn: false, needsUpdate: false, valuedAt: '2026-10-30' });
    expect(valueStatus({ assetType: 'SIP', enteredValue: 100, priceUpdatedAt: new Date('2026-08-01') }, undefined, now)).toMatchObject({ needsUpdate: true, daysSinceValued: 97 });
    expect(valueStatus({ assetType: 'GOLD_SCHEME', enteredValue: null, priceUpdatedAt: null }, undefined, now)).toBeNull();
  });
});

describe('SIP valuation end to end', () => {
  it('paid in, then a typed value, then an instalment on top', async () => {
    const user = await prisma.user.create({ data: { name: 'F', email: 'sipval@example.com', passwordHash: 'x' } });
    const bank = await prisma.account.create({ data: { userId: user.id, name: 'Bank', type: 'SAVINGS', balance: 100000 } });
    const inv = await createInvestment(user.id, {
      assetName: 'Flexi', assetType: 'SIP', monthlyAmount: 2000, paymentDay: 5, purchaseDate: '2026-08-05',
      quantity: 0, buyPrice: 0, currentPrice: 0, bankAccountId: bank.id, recurringActive: true,
    } as never);
    // Aug, Sep, Oct assumed paid: 6,000.
    expect((await getBalanceSheet(user.id)).investmentValue).toBe(6000);

    await updateInvestment(user.id, inv.id, { currentValue: 6300 } as never);
    expect((await getBalanceSheet(user.id)).investmentValue).toBe(6300);

    // Nov instalment paid after the value was entered: added on top.
    vi.setSystemTime(new Date('2026-11-07T06:00:00Z'));
    await decideMonthlyPayment(user.id, 'INVESTMENT', inv.id, 'PAID', bank.id);
    expect((await paidInByInvestment(user.id)).get(inv.id)).toEqual({ total: 8000, sinceValued: 2000 });
    expect((await getBalanceSheet(user.id)).investmentValue).toBe(8300);

    // Entering units × NAV replaces it.
    await updateInvestment(user.id, inv.id, { quantity: 100, currentPrice: 84 } as never);
    expect((await getBalanceSheet(user.id)).investmentValue).toBe(8400);
  });
});
