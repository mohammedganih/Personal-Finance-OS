import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import * as authService from './auth.service';
import {
  computeDebtStats, calculateHealthScore, getUnifiedDebtsWithStats,
  getHealthScore, getDebtStrategy, UnifiedDebt, DebtWithStats,
  simulatePrepayment, buildEMICalendar, generateRecommendations,
  getPrepayment, getEMICalendar, getRecommendations,
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

describe('simulatePrepayment (pure)', () => {
  const debt: UnifiedDebt = {
    id: 'loan:x', sourceType: 'LOAN', sourceId: 'x', name: 'Test Loan',
    remainingBalance: 100000, emi: 5000, interestRate: 12, memberId: null,
  };

  it('reduces months and interest when a lump sum is applied', () => {
    const result = simulatePrepayment(debt, 30000);
    expect(result.newMonths).toBeLessThan(result.baselineMonths);
    expect(result.newInterest).toBeLessThan(result.baselineInterest);
    expect(result.monthsSaved).toBeGreaterThan(0);
    expect(result.interestSaved).toBeGreaterThan(0);
  });

  it('pays off immediately when the lump sum covers the full balance', () => {
    const result = simulatePrepayment(debt, 200000);
    expect(result.newMonths).toBe(0);
    expect(result.newInterest).toBe(0);
  });

  it('has no effect on a zero lump sum', () => {
    const result = simulatePrepayment(debt, 0);
    expect(result.newMonths).toBe(result.baselineMonths);
    expect(result.interestSaved).toBe(0);
  });
});

describe('buildEMICalendar (pure)', () => {
  const now = new Date(2026, 5, 15); // June 15, 2026

  it('projects a loan occurrence on its startDate day-of-month, rolled into the future', () => {
    const loan: DebtWithStats = {
      id: 'loan:a', sourceType: 'LOAN', sourceId: 'a', name: 'Car Loan',
      remainingBalance: 100000, emi: 5000, interestRate: 9, memberId: null,
      startDate: new Date(2024, 0, 5), tenureMonths: 60,
      monthlyInterest: 750, monthlyPrincipal: 4250, monthsToPayoff: 24,
    };
    const entries = buildEMICalendar([loan], 3, now);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].date.getDate()).toBe(5);
    expect(entries[0].date.getTime()).toBeGreaterThan(now.getTime());
  });

  it('caps loan/EMI occurrences at monthsToPayoff', () => {
    const loan: DebtWithStats = {
      id: 'loan:b', sourceType: 'LOAN', sourceId: 'b', name: 'Almost Done',
      remainingBalance: 5000, emi: 5000, interestRate: 9, memberId: null,
      startDate: new Date(2024, 0, 5), tenureMonths: 60,
      monthlyInterest: 37.5, monthlyPrincipal: 4962.5, monthsToPayoff: 1,
    };
    const entries = buildEMICalendar([loan], 6, now);
    expect(entries).toHaveLength(1);
  });

  it('rolls a credit card dueDate forward monthly within the horizon', () => {
    const card: DebtWithStats = {
      id: 'card:c', sourceType: 'CREDIT_CARD', sourceId: 'c', name: 'Visa',
      remainingBalance: 20000, emi: 2000, interestRate: 36, memberId: null,
      dueDate: new Date(2026, 4, 10), // May 10 -- in the past relative to `now`
      monthlyInterest: 600, monthlyPrincipal: 1400, monthsToPayoff: 12,
    };
    const entries = buildEMICalendar([card], 2, now);
    expect(entries.every((e) => e.date.getTime() >= now.getTime())).toBe(true);
    expect(entries.every((e) => e.date.getDate() === 10)).toBe(true);
  });

  it('sorts all entries chronologically across mixed debt types', () => {
    const loan: DebtWithStats = {
      id: 'loan:d', sourceType: 'LOAN', sourceId: 'd', name: 'Loan',
      remainingBalance: 100000, emi: 5000, interestRate: 9, memberId: null,
      startDate: new Date(2024, 0, 25), tenureMonths: 60,
      monthlyInterest: 750, monthlyPrincipal: 4250, monthsToPayoff: 24,
    };
    const card: DebtWithStats = {
      id: 'card:e', sourceType: 'CREDIT_CARD', sourceId: 'e', name: 'Card',
      remainingBalance: 20000, emi: 2000, interestRate: 36, memberId: null,
      dueDate: new Date(2026, 5, 3),
      monthlyInterest: 600, monthlyPrincipal: 1400, monthsToPayoff: 12,
    };
    const entries = buildEMICalendar([loan, card], 2, now);
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i].date.getTime()).toBeGreaterThanOrEqual(entries[i - 1].date.getTime());
    }
  });
});

describe('generateRecommendations (pure)', () => {
  it('returns a single positive message for a debt-free user', () => {
    const health = calculateHealthScore({
      weightedAvgInterestRate: 0, totalMonthlyDebtPayment: 0, monthlyIncome: 50000,
      loansOnTrackCount: 0, loansTotalCount: 0, creditUtilizationPct: 0, hasCreditCards: false,
    });
    const recs = generateRecommendations(health, { debts: [], avalancheOrder: [], bestStrategy: 'avalanche', totalInterestSaved: 0, extraPayment: 5000 });
    expect(recs).toHaveLength(1);
    expect(recs[0].severity).toBe('positive');
  });

  it('flags the highest-rate debt by name as priority 1', () => {
    const debts: DebtWithStats[] = [
      { id: 'card:a', sourceType: 'CREDIT_CARD', sourceId: 'a', name: 'Rewards Card', remainingBalance: 20000, emi: 2000, interestRate: 36, memberId: null, monthlyInterest: 600, monthlyPrincipal: 1400, monthsToPayoff: 12 },
      { id: 'loan:b', sourceType: 'LOAN', sourceId: 'b', name: 'Home Loan', remainingBalance: 500000, emi: 10000, interestRate: 8, memberId: null, monthlyInterest: 3333, monthlyPrincipal: 6667, monthsToPayoff: 60 },
    ];
    const health = calculateHealthScore({
      weightedAvgInterestRate: 15, totalMonthlyDebtPayment: 12000, monthlyIncome: 50000,
      loansOnTrackCount: 1, loansTotalCount: 1, creditUtilizationPct: 20, hasCreditCards: true,
    });
    const recs = generateRecommendations(health, { debts, avalancheOrder: ['card:a', 'loan:b'], bestStrategy: 'avalanche', totalInterestSaved: 1500, extraPayment: 5000 });
    expect(recs[0].debtId).toBe('card:a');
    expect(recs[0].severity).toBe('critical');
  });

  it('flags a debt with monthsToPayoff at the 999 sentinel as never paying off', () => {
    const debts: DebtWithStats[] = [
      { id: 'card:a', sourceType: 'CREDIT_CARD', sourceId: 'a', name: 'Stuck Card', remainingBalance: 20000, emi: 400, interestRate: 36, memberId: null, monthlyInterest: 600, monthlyPrincipal: 0, monthsToPayoff: 999 },
    ];
    const health = calculateHealthScore({
      weightedAvgInterestRate: 36, totalMonthlyDebtPayment: 400, monthlyIncome: 50000,
      loansOnTrackCount: 0, loansTotalCount: 0, creditUtilizationPct: 40, hasCreditCards: true,
    });
    const recs = generateRecommendations(health, { debts, avalancheOrder: ['card:a'], bestStrategy: 'avalanche', totalInterestSaved: 0, extraPayment: 5000 });
    expect(recs.some((r) => r.title.includes("won't pay itself off"))).toBe(true);
  });

  it('assigns unique sequential priorities to every recommendation', () => {
    const debts: DebtWithStats[] = [
      { id: 'card:a', sourceType: 'CREDIT_CARD', sourceId: 'a', name: 'Card', remainingBalance: 20000, emi: 400, interestRate: 36, memberId: null, monthlyInterest: 600, monthlyPrincipal: 0, monthsToPayoff: 999 },
    ];
    const health = calculateHealthScore({
      weightedAvgInterestRate: 36, totalMonthlyDebtPayment: 400, monthlyIncome: 5000,
      loansOnTrackCount: 0, loansTotalCount: 0, creditUtilizationPct: 90, hasCreditCards: true,
    });
    const recs = generateRecommendations(health, { debts, avalancheOrder: ['card:a'], bestStrategy: 'avalanche', totalInterestSaved: 0, extraPayment: 5000 });
    expect(recs.map((r) => r.priority)).toEqual(recs.map((_, i) => i + 1));
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
    expect(result.totalInterestSaved).toBe(Math.max(result.interestSavedAvalanche, result.interestSavedSnowball));
  });

  it('getPrepayment simulates a lump sum against a real loan by its unified id', async () => {
    const userId = await setupUser();
    const loan = await prisma.loan.create({
      data: { userId, name: 'Personal Loan', loanType: 'PERSONAL', principal: 100000, interestRate: 12, emi: 5000, remainingBalance: 100000, tenureMonths: 24, startDate: new Date() },
    });

    const result = await getPrepayment(userId, `loan:${loan.id}`, 30000);
    expect(result.newMonths).toBeLessThan(result.baselineMonths);
    expect(result.interestSaved).toBeGreaterThan(0);
  });

  it('getPrepayment throws for an unknown debt id', async () => {
    const userId = await setupUser();
    await expect(getPrepayment(userId, 'loan:does-not-exist', 1000)).rejects.toThrow();
  });

  it('getEMICalendar projects a loan installment within the requested window', async () => {
    const userId = await setupUser();
    await prisma.loan.create({
      data: { userId, name: 'Car Loan', loanType: 'CAR', principal: 500000, interestRate: 9, emi: 10000, remainingBalance: 300000, tenureMonths: 60, startDate: new Date() },
    });

    const entries = await getEMICalendar(userId, 3);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].sourceType).toBe('LOAN');
  });

  it('getRecommendations returns a debt-free message for a fresh user', async () => {
    const userId = await setupUser();
    const recs = await getRecommendations(userId);
    expect(recs).toHaveLength(1);
    expect(recs[0].severity).toBe('positive');
  });
});
