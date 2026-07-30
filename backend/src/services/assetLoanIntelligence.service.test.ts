import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import * as authService from './auth.service';
import * as investmentService from './investment.service';
import * as loanService from './loan.service';
import {
  generateAmortizationSchedule,
  computeAssetLoanSummary,
  generateAssetLoanInsights,
  getAssetLoanSummary,
  getHomeEquitySummary,
  AssetLoanInput,
} from './assetLoanIntelligence.service';

describe('generateAmortizationSchedule', () => {
  it('matches calculateEMISplit for the first installment', () => {
    const schedule = generateAmortizationSchedule({
      principal: 100000,
      interestRate: 12,
      emi: 5000,
      tenureMonths: 30,
      startDate: new Date('2020-01-15'),
    });

    expect(schedule[0].openingBalance).toBe(100000);
    expect(schedule[0].interest).toBeCloseTo(1000, 2);
    expect(schedule[0].principal).toBeCloseTo(4000, 2);
    expect(schedule[0].closingBalance).toBeCloseTo(96000, 2);
    expect(schedule[0].cumulativeInterest).toBeCloseTo(1000, 2);
    expect(schedule[0].cumulativePrincipal).toBeCloseTo(4000, 2);
  });

  it('anchors each row date to the loan start day, one month apart', () => {
    const schedule = generateAmortizationSchedule({
      principal: 100000,
      interestRate: 12,
      emi: 5000,
      tenureMonths: 30,
      startDate: new Date('2020-01-15'),
    });

    expect(schedule[0].date.getMonth()).toBe(1); // Feb
    expect(schedule[0].date.getDate()).toBe(15);
    expect(schedule[1].date.getMonth()).toBe(2); // Mar
  });

  it('fully amortizes to a zero closing balance before the contracted tenure runs out', () => {
    const schedule = generateAmortizationSchedule({
      principal: 100000,
      interestRate: 12,
      emi: 5000,
      tenureMonths: 30,
      startDate: new Date('2020-01-15'),
    });

    const last = schedule[schedule.length - 1];
    expect(last.closingBalance).toBe(0);
    expect(schedule.length).toBeLessThan(30);
    // Total principal repaid across every row must equal the original principal
    expect(last.cumulativePrincipal).toBeCloseTo(100000, 1);
  });

  it('stops at tenureMonths if the EMI is too small to ever pay off the loan', () => {
    const schedule = generateAmortizationSchedule({
      principal: 100000,
      interestRate: 24, // 2%/mo interest on 100000 = 2000, EMI barely covers it
      emi: 2001,
      tenureMonths: 12,
      startDate: new Date('2020-01-01'),
    });
    expect(schedule.length).toBe(12);
  });
});

function buildInput(overrides: Partial<AssetLoanInput> = {}): AssetLoanInput {
  return {
    loanId: 'loan-1',
    investmentId: 'inv-1',
    assetName: 'Farm House',
    assetType: 'REAL_ESTATE',
    purchasePrice: 8000000,
    currentPropertyValue: 9000000,
    ownershipPercent: 100,
    expectedAppreciationRate: null,
    originalLoanAmount: 6000000,
    remainingBalance: 5000000,
    loan: {
      principal: 6000000,
      interestRate: 8,
      emi: 50000,
      tenureMonths: 240,
      startDate: new Date(new Date().getFullYear() - 3, new Date().getMonth(), 1),
    },
    ...overrides,
  };
}

describe('computeAssetLoanSummary', () => {
  it('computes equity as owned value minus outstanding balance', () => {
    const summary = computeAssetLoanSummary(buildInput(), new Date());
    expect(summary.equity).toBeCloseTo(9000000 - 5000000, 0);
  });

  it('computes unrealized gain as owned value minus owned purchase price', () => {
    const summary = computeAssetLoanSummary(buildInput(), new Date());
    expect(summary.unrealizedGain).toBeCloseTo(9000000 - 8000000, 0);
  });

  it('computes loan-to-value as remaining balance over current property value', () => {
    const summary = computeAssetLoanSummary(buildInput(), new Date());
    expect(summary.loanToValue).toBeCloseTo((5000000 / 9000000) * 100, 5);
  });

  it('scales equity and unrealized gain by ownership percent for partial ownership', () => {
    const full = computeAssetLoanSummary(buildInput({ ownershipPercent: 100 }), new Date());
    const half = computeAssetLoanSummary(buildInput({ ownershipPercent: 50 }), new Date());
    expect(half.unrealizedGain).toBeCloseTo(full.unrealizedGain / 2, 0);
  });

  it('reports appreciation since purchase as a percentage of purchase price', () => {
    const summary = computeAssetLoanSummary(buildInput(), new Date());
    expect(summary.appreciationSincePurchasePct).toBeCloseTo(((9000000 - 8000000) / 8000000) * 100, 5);
  });

  it('projects next-year value using the expected appreciation rate when set', () => {
    const summary = computeAssetLoanSummary(buildInput({ expectedAppreciationRate: 10 }), new Date());
    expect(summary.projectedValueNextYear).toBeCloseTo(9000000 * 1.1, 0);
  });

  it('accumulates principal and interest paid from the amortization schedule up to now', () => {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 12); // exactly 12 months elapsed
    const summary = computeAssetLoanSummary(
      buildInput({ loan: { principal: 6000000, interestRate: 8, emi: 50000, tenureMonths: 240, startDate } }),
      new Date(),
    );
    expect(summary.monthsElapsed).toBe(12);
    expect(summary.principalPaid).toBeGreaterThan(0);
    expect(summary.interestPaid).toBeGreaterThan(0);
    // Every rupee of the EMI is either principal or interest each month
    expect(summary.interestShareOfEMIPct).toBeGreaterThan(0);
    expect(summary.interestShareOfEMIPct).toBeLessThan(100);
  });
});

describe('generateAssetLoanInsights', () => {
  it('surfaces an equity-growth insight when principal was paid this month', () => {
    const summary = computeAssetLoanSummary(buildInput(), new Date());
    const insights = generateAssetLoanInsights(summary, 20000000);
    expect(insights.some((i) => i.message.includes('equity increased'))).toBe(true);
  });

  it('surfaces the net-worth contribution insight proportionally to equity', () => {
    const summary = computeAssetLoanSummary(buildInput(), new Date());
    const insights = generateAssetLoanInsights(summary, summary.equity * 2); // asset is exactly 50% of net worth
    const contributionInsight = insights.find((i) => i.message.includes('contributes'));
    expect(contributionInsight?.message).toContain('50%');
  });

  it('omits the net-worth contribution insight when net worth is zero or negative', () => {
    const summary = computeAssetLoanSummary(buildInput(), new Date());
    const insights = generateAssetLoanInsights(summary, 0);
    expect(insights.some((i) => i.message.includes('contributes'))).toBe(false);
  });

  it('flags a warning when interest still dominates the EMI', () => {
    const summary = computeAssetLoanSummary(buildInput(), new Date());
    const insights = generateAssetLoanInsights(summary, 20000000);
    const interestInsight = insights.find((i) => i.message.includes('is interest'));
    expect(interestInsight).toBeDefined();
    if (summary.interestShareOfEMIPct > 50) expect(interestInsight?.severity).toBe('warning');
  });
});

describe('getAssetLoanSummary / getHomeEquitySummary (I/O, DB-backed)', () => {
  // Regression coverage for the collateral-field extraction: ownershipPercent
  // and expectedAppreciationRate used to be flat columns selected directly off
  // Loan.linkedInvestment, now they're read through the InvestmentCollateral
  // overlay (LOAN_WITH_ASSET_INCLUDE / toAssetLoanInput in
  // assetLoanIntelligence.service.ts). This exercises that real DB join.

  beforeEach(resetDatabase);
  afterAll(() => prisma.$disconnect());

  async function setupLinkedAsset(ownershipPercent?: number, expectedAppreciationRate?: number) {
    const { user } = await authService.register({
      name: 'Test User',
      email: `test-${Date.now()}-${Math.random()}@example.com`,
      password: 'Password123',
    });
    const investment = await investmentService.createInvestment(user.id, {
      assetName: 'Family Home', assetType: 'REAL_ESTATE', purchaseDate: '2020-01-01',
      quantity: 0, buyPrice: 8000000, currentPrice: 9000000,
      ...(ownershipPercent !== undefined && { ownershipPercent }),
      ...(expectedAppreciationRate !== undefined && { expectedAppreciationRate }),
    } as any) as any;
    const loan = await loanService.createLoan(user.id, {
      name: 'Home Loan', loanType: 'HOME', principal: 6000000, interestRate: 8,
      emi: 50000, remainingBalance: 5000000, tenureMonths: 240, startDate: '2020-01-01',
      linkedInvestmentId: investment.id,
    } as any) as any;
    return { userId: user.id, investmentId: investment.id, loanId: loan.id };
  }

  it('reads a partial ownershipPercent through the InvestmentCollateral join', async () => {
    const { userId, loanId } = await setupLinkedAsset(60);
    const summary = await getAssetLoanSummary(userId, loanId);
    expect(summary.ownershipPercent).toBe(60);
    expect(summary.equity).toBeCloseTo(9000000 * 0.6 - 5000000, 0);
  });

  it('defaults to 100% ownership when no InvestmentCollateral row exists', async () => {
    const { userId, loanId } = await setupLinkedAsset();
    const summary = await getAssetLoanSummary(userId, loanId);
    expect(summary.ownershipPercent).toBe(100);
    expect(summary.equity).toBeCloseTo(9000000 - 5000000, 0);
  });

  it('projects next-year value using expectedAppreciationRate read through the join', async () => {
    const { userId, loanId } = await setupLinkedAsset(100, 12);
    const summary = await getAssetLoanSummary(userId, loanId);
    expect(summary.projectedValueNextYear).toBeCloseTo(9000000 * 1.12, 0);
  });

  it('getHomeEquitySummary scales totalPropertyValue by ownershipPercent across all linked assets', async () => {
    const { userId } = await setupLinkedAsset(60);
    const home = await getHomeEquitySummary(userId);
    expect(home.totalPropertyValue).toBeCloseTo(9000000 * 0.6, 0);
    expect(home.assets).toHaveLength(1);
  });
});
