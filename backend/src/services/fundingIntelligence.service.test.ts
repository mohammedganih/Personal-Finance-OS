import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import * as authService from './auth.service';
import { buildFundingOpportunities, getFundingOpportunities } from './fundingIntelligence.service';
import { UnifiedDebt } from './debtIntelligence.service';

const now = new Date(2026, 5, 15);

const debt: UnifiedDebt = {
  id: 'loan:x', sourceType: 'LOAN', sourceId: 'x', name: 'High Rate Loan',
  remainingBalance: 200000, emi: 8000, interestRate: 18, memberId: null,
};

describe('buildFundingOpportunities (pure)', () => {
  it('returns an empty list when there are no debts', () => {
    const result = buildFundingOpportunities(
      [{ id: 'a', assetName: 'FD A', assetType: 'FIXED_DEPOSIT', currentValue: 50000, maturityDate: new Date(2026, 6, 1), maturityAmount: 52000 }],
      [], now,
    );
    expect(result).toEqual([]);
  });

  it('includes a maturity within the window, targeting the highest-rate debt', () => {
    const result = buildFundingOpportunities(
      [{ id: 'a', assetName: 'FD A', assetType: 'FIXED_DEPOSIT', currentValue: 50000, maturityDate: new Date(2026, 6, 1), maturityAmount: 52000 }],
      [debt], now, 6,
    );
    expect(result).toHaveLength(1);
    expect(result[0].sourceType).toBe('MATURITY');
    expect(result[0].availableAmount).toBe(52000);
    expect(result[0].targetDebtId).toBe('loan:x');
    expect(result[0].interestSaved).toBeGreaterThan(0);
  });

  it('excludes a maturity outside the requested window', () => {
    const result = buildFundingOpportunities(
      [{ id: 'a', assetName: 'FD Far', assetType: 'FIXED_DEPOSIT', currentValue: 50000, maturityDate: new Date(2027, 6, 1), maturityAmount: 52000 }],
      [debt], now, 6,
    );
    expect(result).toHaveLength(0);
  });

  it('excludes a locked type with no maturityDate set', () => {
    const result = buildFundingOpportunities(
      [{ id: 'a', assetName: 'RD no date', assetType: 'RECURRING_DEPOSIT', currentValue: 50000, maturityDate: null, maturityAmount: null }],
      [debt], now,
    );
    expect(result).toHaveLength(0);
  });

  it('includes a liquid holding as available now (no date)', () => {
    const result = buildFundingOpportunities(
      [{ id: 'a', assetName: 'Reliance Stock', assetType: 'STOCK', currentValue: 80000, maturityDate: null, maturityAmount: null }],
      [debt], now,
    );
    expect(result).toHaveLength(1);
    expect(result[0].sourceType).toBe('LIQUID_HOLDING');
    expect(result[0].availableDate).toBeNull();
  });

  it('excludes real estate and other non-liquid types', () => {
    const result = buildFundingOpportunities(
      [
        { id: 'a', assetName: 'Land', assetType: 'REAL_ESTATE', currentValue: 5000000, maturityDate: null, maturityAmount: null },
        { id: 'b', assetName: 'Misc', assetType: 'OTHER', currentValue: 10000, maturityDate: null, maturityAmount: null },
      ],
      [debt], now,
    );
    expect(result).toHaveLength(0);
  });

  it('sorts opportunities by interest saved, descending', () => {
    const result = buildFundingOpportunities(
      [
        { id: 'a', assetName: 'Small Stock', assetType: 'STOCK', currentValue: 10000, maturityDate: null, maturityAmount: null },
        { id: 'b', assetName: 'Big Stock', assetType: 'STOCK', currentValue: 150000, maturityDate: null, maturityAmount: null },
      ],
      [debt], now,
    );
    expect(result[0].assetName).toBe('Big Stock');
    expect(result[0].interestSaved).toBeGreaterThanOrEqual(result[1].interestSaved);
  });

  it('targets the single highest-interest-rate debt when multiple debts exist', () => {
    const lowRate: UnifiedDebt = { id: 'loan:low', sourceType: 'LOAN', sourceId: 'low', name: 'Low Rate', remainingBalance: 500000, emi: 10000, interestRate: 8, memberId: null };
    const result = buildFundingOpportunities(
      [{ id: 'a', assetName: 'Stock A', assetType: 'STOCK', currentValue: 50000, maturityDate: null, maturityAmount: null }],
      [lowRate, debt], now,
    );
    expect(result[0].targetDebtId).toBe('loan:x'); // debt has the higher rate (18% vs 8%)
  });
});

describe('fundingIntelligence.service integration', () => {
  beforeEach(resetDatabase);
  afterAll(() => prisma.$disconnect());

  async function setupUser() {
    const { user } = await authService.register({
      name: 'Test User', email: `fundtest-${Date.now()}-${Math.random()}@example.com`, password: 'Password123',
    });
    return user.id;
  }

  it('returns nothing for a user with investments but no debts', async () => {
    const userId = await setupUser();
    await prisma.investment.create({
      data: { userId, assetName: 'Stock A', assetType: 'STOCK', quantity: 10, buyPrice: 100, currentPrice: 150, purchaseDate: new Date() },
    });
    const result = await getFundingOpportunities(userId);
    expect(result).toEqual([]);
  });

  it('finds a real maturing FD and a real liquid stock, both targeting the same real debt', async () => {
    const userId = await setupUser();
    await prisma.loan.create({
      data: { userId, name: 'Personal Loan', loanType: 'PERSONAL', principal: 200000, interestRate: 18, emi: 8000, remainingBalance: 150000, tenureMonths: 24, startDate: new Date() },
    });
    const soon = new Date();
    soon.setMonth(soon.getMonth() + 2);
    await prisma.investment.create({
      data: { userId, assetName: 'Bank FD', assetType: 'FIXED_DEPOSIT', buyPrice: 100000, interestRate: 7, purchaseDate: new Date(), maturityDate: soon, maturityAmount: 107000 },
    });
    await prisma.investment.create({
      data: { userId, assetName: 'Growth Stock', assetType: 'STOCK', quantity: 10, buyPrice: 1000, currentPrice: 1500, purchaseDate: new Date() },
    });

    const result = await getFundingOpportunities(userId);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.targetDebtName === 'Personal Loan')).toBe(true);
  });
});
