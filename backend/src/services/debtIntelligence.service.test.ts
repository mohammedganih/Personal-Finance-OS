import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import * as authService from './auth.service';
import {
  computeDebtStats, calculateHealthScore, getUnifiedDebtsWithStats,
  getHealthScore, getDebtStrategy, UnifiedDebt,
} from './debtIntelligence.service';

describe('computeDebtStats (pure)', () => {
  const base: UnifiedDebt = {
    id: 'loan:x', sourceType: 'LOAN', sourceId: 'x', name: 'Test',
    remainingBalance: 100000, emi: 5000, interestRate: 12, memberId: null,
  };

  it('splits a standard debt into interest and principal', () => {
    const stats = computeDebtStats(base);
    expect(stats.monthlyInterest).toBeCloseTo(1000, 2); // 100000 * (12/100/12)
    expect(stats.monthlyPrincipal).toBeCloseTo(4000, 2);
    expect(stats.monthsToPayoff).toBeGreaterThan(0);
  });

  it('handles a zero-interest debt as flat division', () => {
    const stats = computeDebtStats({ ...base, interestRate: 0 });
    expect(stats.monthlyInterest).toBe(0);
    expect(stats.monthsToPayoff).toBe(20); // 100000 / 5000
  });

  it('never returns a negative or infinite monthsToPayoff for a stuck debt (emi <= interest)', () => {
    const stats = computeDebtStats({ ...base, emi: 500, interestRate: 24 }); // interest alone is 2000/mo, exceeds EMI
    expect(stats.monthsToPayoff).toBe(999); // sentinel for "never pays off at this rate"
    expect(Number.isFinite(stats.monthsToPayoff)).toBe(true);
  });
});

describe('calculateHealthScore (pure)', () => {
  it('scores a debt-free user as a perfect, neutral 100', () => {
    const result = calculateHealthScore({
      weightedAvgInterestRate: 0, totalMonthlyDebtPayment: 0, monthlyIncome: 50000,
      loansOnTrackCount: 0, loansTotalCount: 0, creditUtilizationPct: 0, hasCreditCards: false,
    });
    expect(result.score).toBe(100);
    expect(result.band).toBe('excellent');
  });

  it('penalizes high interest rate, high DTI, and high utilization together', () => {
    const result = calculateHealthScore({
      weightedAvgInterestRate: 24, totalMonthlyDebtPayment: 40000, monthlyIncome: 50000, // 80% DTI
      loansOnTrackCount: 0, loansTotalCount: 2, creditUtilizationPct: 90, hasCreditCards: true,
    });
    expect(result.score).toBeLessThan(30);
    expect(result.band).toBe('critical');
  });

  it('does not penalize on-track score when the user has no loans (credit-card-only)', () => {
    const result = calculateHealthScore({
      weightedAvgInterestRate: 0, totalMonthlyDebtPayment: 0, monthlyIncome: 50000,
      loansOnTrackCount: 0, loansTotalCount: 0, creditUtilizationPct: 0, hasCreditCards: true,
    });
    const onTrackFactor = result.factors.find((f) => f.label === 'On-track loans')!;
    expect(onTrackFactor.score).toBe(100);
  });

  it('every factor weight sums to 1', () => {
    const result = calculateHealthScore({
      weightedAvgInterestRate: 10, totalMonthlyDebtPayment: 10000, monthlyIncome: 50000,
      loansOnTrackCount: 1, loansTotalCount: 2, creditUtilizationPct: 40, hasCreditCards: true,
    });
    const totalWeight = result.factors.reduce((s, f) => s + f.weight, 0);
    expect(totalWeight).toBeCloseTo(1, 5);
  });
});

describe('debtIntelligence.service integration', () => {
  beforeEach(resetDatabase);
  afterAll(() => prisma.$disconnect());

  async function setupUser() {
    const { user } = await authService.register({
      name: 'Test User', email: `debt-${Date.now()}-${Math.random()}@example.com`, password: 'Password123',
    });
    return user.id;
  }

  it('unifies a loan, a credit card with min payment + rate, and an interest-bearing card EMI', async () => {
    const userId = await setupUser();
    await prisma.loan.create({
      data: { userId, name: 'Car Loan', loanType: 'CAR', principal: 500000, interestRate: 9, emi: 10000, remainingBalance: 300000, tenureMonths: 60, startDate: new Date() },
    });
    const card = await prisma.creditCard.create({
      data: { userId, cardName: 'Visa', creditLimit: 100000, outstanding: 20000, minimumPayment: 2000, interestRate: 36, dueDate: new Date() },
    });
    await prisma.cardEMI.create({
      data: { userId, creditCardId: card.id, itemName: 'Laptop', totalAmount: 60000, emiAmount: 5500, tenureMonths: 12, emisPaid: 2, isNoCost: false, interestRate: 15, startDate: new Date() },
    });

    const debts = await getUnifiedDebtsWithStats(userId);
    expect(debts).toHaveLength(3);
    expect(debts.map((d) => d.sourceType).sort()).toEqual(['CARD_EMI', 'CREDIT_CARD', 'LOAN']);
  });

  it('excludes a credit card with outstanding but no minimumPayment/interestRate set', async () => {
    const userId = await setupUser();
    await prisma.creditCard.create({
      data: { userId, cardName: 'No-rate card', creditLimit: 50000, outstanding: 10000, dueDate: new Date() },
    });

    const debts = await getUnifiedDebtsWithStats(userId);
    expect(debts).toHaveLength(0);
  });

  it('getHealthScore returns a full result for a fresh user with no debts', async () => {
    const userId = await setupUser();
    const result = await getHealthScore(userId);
    expect(result.score).toBe(100);
    expect(result.factors).toHaveLength(4);
  });

  it('getDebtStrategy ranks by interest rate for avalanche and by balance for snowball', async () => {
    const userId = await setupUser();
    await prisma.loan.create({
      data: { userId, name: 'High Rate Small', loanType: 'PERSONAL', principal: 20000, interestRate: 24, emi: 2000, remainingBalance: 15000, tenureMonths: 12, startDate: new Date() },
    });
    await prisma.loan.create({
      data: { userId, name: 'Low Rate Large', loanType: 'HOME', principal: 500000, interestRate: 8, emi: 10000, remainingBalance: 400000, tenureMonths: 240, startDate: new Date() },
    });

    const result = await getDebtStrategy(userId, 5000);
    const avalancheFirst = result.debts.find((d) => d.id === result.avalancheOrder[0])!;
    const snowballFirst = result.debts.find((d) => d.id === result.snowballOrder[0])!;

    expect(avalancheFirst.name).toBe('High Rate Small'); // highest rate first
    expect(snowballFirst.name).toBe('High Rate Small'); // also smallest balance here, same debt
    expect(result.interestSavedAvalanche).toBeGreaterThanOrEqual(0);
    expect(result.interestSavedSnowball).toBeGreaterThanOrEqual(0);
  });
});
