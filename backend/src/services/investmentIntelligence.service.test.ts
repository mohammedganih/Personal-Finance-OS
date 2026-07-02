import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import * as authService from './auth.service';
import {
  calculateXIRR, buildCashflows, getAnnualizedReturn, getPortfolioAnnualizedReturn,
  analyzeDiversification, getUpcomingMaturities, buildInvestmentCalendar,
  getAnnualizedReturns, recordDailySnapshot, getPortfolioTrend,
  getInvestmentCalendar, getDiversification, getMaturityRadar,
} from './investmentIntelligence.service';
import { Investment } from '@prisma/client';

function makeInvestment(overrides: Partial<Investment>): Investment {
  return {
    id: 'inv:x', userId: 'u1', assetName: 'Test Asset', assetType: 'STOCK',
    ticker: null, quantity: 0 as any, buyPrice: 0 as any, currentPrice: 0 as any,
    purchaseDate: new Date(), exchange: null, notes: null,
    monthlyAmount: null, fundCategory: null, folioNumber: null,
    maturityDate: null, maturityAmount: null, interestRate: null,
    platform: null, memberId: null, splitMemberId: null, splitRatio: null as any,
    bankAccountId: null, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  } as Investment;
}

describe('calculateXIRR (pure)', () => {
  it('returns null for fewer than 2 cashflows', () => {
    expect(calculateXIRR([{ date: new Date(), amount: 100 }])).toBeNull();
    expect(calculateXIRR([])).toBeNull();
  });

  it('returns null when all cashflows are on the same day (no time elapsed)', () => {
    const d = new Date(2025, 0, 1);
    expect(calculateXIRR([{ date: d, amount: -100 }, { date: d, amount: 110 }])).toBeNull();
  });

  it('solves the closed-form case exactly: 100000 -> 121000 in exactly 1 year is 21%', () => {
    const start = new Date(2024, 0, 1);
    const end = new Date(2025, 0, 1);
    const xirr = calculateXIRR([{ date: start, amount: -100000 }, { date: end, amount: 121000 }]);
    expect(xirr).not.toBeNull();
    expect(xirr!).toBeCloseTo(0.21, 1);
  });

  it('returns a higher rate for a higher final value on the same schedule (monotonicity)', () => {
    const start = new Date(2024, 0, 1);
    const mid1 = new Date(2024, 1, 1);
    const mid2 = new Date(2024, 2, 1);
    const end = new Date(2024, 3, 1);
    const schedule = (finalValue: number) => calculateXIRR([
      { date: start, amount: -1000 }, { date: mid1, amount: -1000 }, { date: mid2, amount: -1000 },
      { date: end, amount: finalValue },
    ]);
    const lower = schedule(3200)!;
    const higher = schedule(3600)!;
    expect(higher).toBeGreaterThan(lower);
  });

  it('returns null for a negative-to-negative pair (no real inflow to solve against)', () => {
    const start = new Date(2024, 0, 1);
    const end = new Date(2025, 0, 1);
    expect(calculateXIRR([{ date: start, amount: -100 }, { date: end, amount: -50 }])).toBeNull();
  });
});

describe('buildCashflows (pure)', () => {
  it('builds a single outflow/inflow pair for a lump-sum holding', () => {
    const inv = makeInvestment({ assetType: 'STOCK', quantity: 10 as any, buyPrice: 100 as any, currentPrice: 150 as any, purchaseDate: new Date(2025, 0, 1) });
    const now = new Date(2025, 6, 1);
    const cfs = buildCashflows(inv, now);
    expect(cfs).toHaveLength(2);
    expect(cfs[0].amount).toBe(-1000);
    expect(cfs[1].amount).toBe(1500);
  });

  it('builds one outflow per elapsed month for an installment holding', () => {
    const inv = makeInvestment({
      assetType: 'SIP', quantity: 50 as any, currentPrice: 25 as any,
      monthlyAmount: 1000 as any, purchaseDate: new Date(2025, 0, 15),
    });
    const now = new Date(2025, 3, 20); // 3 full months elapsed (Jan->Apr)
    const cfs = buildCashflows(inv, now);
    // 3 outflows + 1 final inflow
    expect(cfs).toHaveLength(4);
    expect(cfs.slice(0, 3).every((c) => c.amount === -1000)).toBe(true);
    expect(cfs[3].amount).toBe(50 * 25);
  });

  it('returns an empty array when there is no elapsed month yet', () => {
    const inv = makeInvestment({ assetType: 'SIP', monthlyAmount: 1000 as any, purchaseDate: new Date(2025, 5, 1) });
    const now = new Date(2025, 5, 10); // same month, 0 elapsed
    expect(buildCashflows(inv, now)).toEqual([]);
  });

  it('returns an empty array when investedValue is zero', () => {
    const inv = makeInvestment({ assetType: 'STOCK', quantity: 0 as any, buyPrice: 0 as any });
    expect(buildCashflows(inv, new Date())).toEqual([]);
  });
});

describe('getAnnualizedReturn / getPortfolioAnnualizedReturn (pure)', () => {
  it('computes a positive return for a holding that gained value', () => {
    const inv = makeInvestment({ assetType: 'STOCK', quantity: 10 as any, buyPrice: 100 as any, currentPrice: 120 as any, purchaseDate: new Date(2024, 0, 1) });
    const xirr = getAnnualizedReturn(inv, new Date(2025, 0, 1));
    expect(xirr).not.toBeNull();
    expect(xirr!).toBeGreaterThan(0);
  });

  it('returns null for a holding with no invested value', () => {
    const inv = makeInvestment({ assetType: 'OTHER', quantity: 0 as any, buyPrice: 0 as any });
    expect(getAnnualizedReturn(inv, new Date())).toBeNull();
  });

  it('blends multiple holdings into one overall rate', () => {
    const now = new Date(2025, 0, 1);
    const a = makeInvestment({ id: 'a', assetType: 'STOCK', quantity: 10 as any, buyPrice: 100 as any, currentPrice: 120 as any, purchaseDate: new Date(2024, 0, 1) });
    const b = makeInvestment({ id: 'b', assetType: 'GOLD', quantity: 5 as any, buyPrice: 5000 as any, currentPrice: 5500 as any, purchaseDate: new Date(2024, 0, 1) });
    const overall = getPortfolioAnnualizedReturn([a, b], now);
    expect(overall).not.toBeNull();
  });
});

describe('analyzeDiversification (pure)', () => {
  it('produces no warnings for a single holding', () => {
    const result = analyzeDiversification([{ assetType: 'STOCK', assetName: 'Only Stock', currentValue: 10000 }]);
    expect(result.warnings).toHaveLength(0);
  });

  it('warns when one asset class dominates the portfolio (>=70%)', () => {
    const result = analyzeDiversification([
      { assetType: 'SIP', assetName: 'SIP A', currentValue: 80000 },
      { assetType: 'FIXED_DEPOSIT', assetName: 'FD A', currentValue: 20000 },
    ]);
    expect(result.warnings.some((w) => w.message.includes('Equity'))).toBe(true);
  });

  it('warns when one holding dominates the portfolio (>=40%)', () => {
    const result = analyzeDiversification([
      { assetType: 'STOCK', assetName: 'Big Stock', currentValue: 50000 },
      { assetType: 'GOLD', assetName: 'Gold A', currentValue: 30000 },
      { assetType: 'FIXED_DEPOSIT', assetName: 'FD A', currentValue: 20000 },
    ]);
    expect(result.warnings.some((w) => w.message.includes('Big Stock'))).toBe(true);
  });

  it('produces no warnings for a well-balanced portfolio', () => {
    const result = analyzeDiversification([
      { assetType: 'SIP', assetName: 'SIP A', currentValue: 30000 },
      { assetType: 'FIXED_DEPOSIT', assetName: 'FD A', currentValue: 30000 },
      { assetType: 'GOLD', assetName: 'Gold A', currentValue: 20000 },
      { assetType: 'REAL_ESTATE', assetName: 'Land', currentValue: 20000 },
    ]);
    expect(result.warnings).toHaveLength(0);
  });

  it('groups SIP and MUTUAL_FUND together under Equity', () => {
    const result = analyzeDiversification([
      { assetType: 'SIP', assetName: 'SIP A', currentValue: 10000 },
      { assetType: 'MUTUAL_FUND', assetName: 'MF A', currentValue: 10000 },
    ]);
    const equity = result.classBreakdown.find((c) => c.assetClass === 'Equity');
    expect(equity?.value).toBe(20000);
  });
});

describe('getUpcomingMaturities (pure)', () => {
  const now = new Date(2026, 5, 15);

  it('includes maturities within the window and excludes ones outside it', () => {
    const portfolio = [
      { id: 'a', assetName: 'FD Soon', assetType: 'FIXED_DEPOSIT', maturityDate: new Date(2026, 6, 1), maturityAmount: 50000 },
      { id: 'b', assetName: 'FD Far', assetType: 'FIXED_DEPOSIT', maturityDate: new Date(2027, 6, 1), maturityAmount: 60000 },
      { id: 'c', assetName: 'No Maturity', assetType: 'STOCK', maturityDate: null, maturityAmount: null },
      { id: 'd', assetName: 'FD Past', assetType: 'FIXED_DEPOSIT', maturityDate: new Date(2026, 4, 1), maturityAmount: 10000 },
    ];
    const result = getUpcomingMaturities(portfolio, 6, now);
    expect(result.map((r) => r.investmentId)).toEqual(['a']);
  });

  it('sorts chronologically', () => {
    const portfolio = [
      { id: 'a', assetName: 'Later', assetType: 'FIXED_DEPOSIT', maturityDate: new Date(2026, 8, 1), maturityAmount: 1 },
      { id: 'b', assetName: 'Sooner', assetType: 'FIXED_DEPOSIT', maturityDate: new Date(2026, 6, 1), maturityAmount: 1 },
    ];
    const result = getUpcomingMaturities(portfolio, 6, now);
    expect(result.map((r) => r.investmentId)).toEqual(['b', 'a']);
  });
});

describe('buildInvestmentCalendar (pure)', () => {
  const now = new Date(2026, 5, 15);

  it('projects SIP debits on their purchaseDate day-of-month', () => {
    const entries = buildInvestmentCalendar(
      [{ id: 'a', assetName: 'SIP A', assetType: 'SIP', purchaseDate: new Date(2024, 0, 5), monthlyAmount: 5000 }],
      3, now,
    );
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].date.getDate()).toBe(5);
    expect(entries[0].date.getTime()).toBeGreaterThan(now.getTime());
  });

  it('skips lump-sum types entirely', () => {
    const entries = buildInvestmentCalendar(
      [{ id: 'a', assetName: 'Stock A', assetType: 'STOCK', purchaseDate: new Date(2024, 0, 5), monthlyAmount: null }],
      3, now,
    );
    expect(entries).toHaveLength(0);
  });

  it('skips installment types with no monthlyAmount configured', () => {
    const entries = buildInvestmentCalendar(
      [{ id: 'a', assetName: 'SIP A', assetType: 'SIP', purchaseDate: new Date(2024, 0, 5), monthlyAmount: null }],
      3, now,
    );
    expect(entries).toHaveLength(0);
  });
});

describe('investmentIntelligence.service integration', () => {
  beforeEach(resetDatabase);
  afterAll(() => prisma.$disconnect());

  async function setupUser() {
    const { user } = await authService.register({
      name: 'Test User', email: `invtest-${Date.now()}-${Math.random()}@example.com`, password: 'Password123',
    });
    return user.id;
  }

  it('getAnnualizedReturns computes overall and per-holding rates for a real portfolio', async () => {
    const userId = await setupUser();
    await prisma.investment.create({
      data: { userId, assetName: 'Growth Stock', assetType: 'STOCK', quantity: 10, buyPrice: 100, currentPrice: 150, purchaseDate: new Date(2024, 0, 1) },
    });

    const result = await getAnnualizedReturns(userId);
    expect(result.byHolding).toHaveLength(1);
    expect(result.byHolding[0].xirr).not.toBeNull();
    expect(result.overall).not.toBeNull();
  });

  it('recordDailySnapshot upserts idempotently within the same day', async () => {
    const userId = await setupUser();
    await recordDailySnapshot(userId, { totalInvested: 1000, totalCurrent: 1100, totalPnl: 100 });
    await recordDailySnapshot(userId, { totalInvested: 2000, totalCurrent: 2300, totalPnl: 300 });

    const trend = await getPortfolioTrend(userId, 30);
    expect(trend).toHaveLength(1);
    expect(trend[0].totalCurrent).toBe(2300);
  });

  it('getInvestmentCalendar projects a real SIP within the requested window', async () => {
    const userId = await setupUser();
    await prisma.investment.create({
      data: { userId, assetName: 'Index SIP', assetType: 'SIP', quantity: 50, currentPrice: 25, monthlyAmount: 5000, purchaseDate: new Date(2024, 0, 5) },
    });

    const entries = await getInvestmentCalendar(userId, 3);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].assetType).toBe('SIP');
  });

  it('getDiversification reflects a real concentrated portfolio', async () => {
    const userId = await setupUser();
    await prisma.investment.create({
      data: { userId, assetName: 'Big Stock', assetType: 'STOCK', quantity: 100, buyPrice: 100, currentPrice: 100, purchaseDate: new Date() },
    });
    await prisma.investment.create({
      data: { userId, assetName: 'Small Gold', assetType: 'GOLD', quantity: 1, buyPrice: 5000, currentPrice: 5000, purchaseDate: new Date() },
    });

    const result = await getDiversification(userId);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('getMaturityRadar finds a real FD maturing soon', async () => {
    const userId = await setupUser();
    const soon = new Date();
    soon.setMonth(soon.getMonth() + 2);
    await prisma.investment.create({
      data: { userId, assetName: 'Short FD', assetType: 'FIXED_DEPOSIT', buyPrice: 100000, interestRate: 7, purchaseDate: new Date(), maturityDate: soon, maturityAmount: 107000 },
    });

    const result = await getMaturityRadar(userId, 6);
    expect(result).toHaveLength(1);
    expect(result[0].assetName).toBe('Short FD');
  });
});
