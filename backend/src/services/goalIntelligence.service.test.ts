import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import * as authService from './auth.service';
import * as goalService from './goal.service';
import {
  requiredMonthlyPayment, monthsToReachTarget, computeGoalProgress,
  calculateGoalProbability, runGoalScenarios, computeGoalMilestones,
  generateGoalRecommendations, GoalInput,
  getGoalProgress, getGoalProbability, getGoalScenarios, getGoalMilestones,
  getGoalRecommendations, getGoalInsights,
} from './goalIntelligence.service';

function futureValue(pv: number, payment: number, months: number, rate: number): number {
  const growth = Math.pow(1 + rate, months);
  return pv * growth + payment * (rate === 0 ? months : (growth - 1) / rate);
}

describe('requiredMonthlyPayment (pure)', () => {
  it('round-trips: the computed payment actually reaches the target when compounded forward', () => {
    const target = 500000, pv = 50000, months = 24, rate = 0.01;
    const payment = requiredMonthlyPayment(target, pv, months, rate);
    const reached = futureValue(pv, payment, months, rate);
    expect(reached).toBeCloseTo(target, 0);
  });

  it('falls back to flat division at 0% rate', () => {
    const payment = requiredMonthlyPayment(120000, 0, 12, 0);
    expect(payment).toBeCloseTo(10000, 5);
  });

  it('returns 0 when already at or above target after growth', () => {
    const payment = requiredMonthlyPayment(100000, 200000, 12, 0.01);
    expect(payment).toBe(0);
  });

  it('returns the full remaining amount when months is 0', () => {
    const payment = requiredMonthlyPayment(100000, 40000, 0, 0.01);
    expect(payment).toBe(60000);
  });
});

describe('monthsToReachTarget (pure)', () => {
  it('round-trips with requiredMonthlyPayment: the same payment/months pair is self-consistent', () => {
    const target = 500000, pv = 50000, months = 24, rate = 0.01;
    const payment = requiredMonthlyPayment(target, pv, months, rate);
    const solvedMonths = monthsToReachTarget(target, pv, payment, rate);
    expect(solvedMonths).not.toBeNull();
    expect(solvedMonths!).toBeCloseTo(months, 0);
  });

  it('returns null when there is no contribution and no growth', () => {
    expect(monthsToReachTarget(100000, 10000, 0, 0)).toBeNull();
  });

  it('returns null when present value cannot grow to target with zero contribution and zero rate', () => {
    expect(monthsToReachTarget(100000, 5000, 0, 0)).toBeNull();
  });

  it('returns 0 when already at the target', () => {
    expect(monthsToReachTarget(100000, 150000, 5000, 0.01)).toBe(0);
  });

  it('solves correctly for growth-only (no contribution, positive rate)', () => {
    const months = monthsToReachTarget(200000, 100000, 0, 0.01);
    expect(months).not.toBeNull();
    expect(futureValue(100000, 0, months!, 0.01)).toBeCloseTo(200000, 0);
  });
});

describe('computeGoalProgress (pure)', () => {
  const base: GoalInput = {
    targetAmount: 500000, currentAmount: 100000,
    targetDate: new Date(2027, 0, 1),
    monthlyContribution: 10000, expectedReturnRate: 8, expectedInflationRate: null,
  };
  const now = new Date(2026, 0, 1);

  it('computes currentPct correctly and caps at 100', () => {
    const progress = computeGoalProgress(base, [], now);
    expect(progress.currentPct).toBeCloseTo(20, 5);

    const overfunded = computeGoalProgress({ ...base, currentAmount: 600000 }, [], now);
    expect(overfunded.currentPct).toBe(100);
  });

  it('inflation-adjusts the goal value when expectedInflationRate is set', () => {
    const withInflation = computeGoalProgress({ ...base, expectedInflationRate: 6 }, [], now);
    const withoutInflation = computeGoalProgress(base, [], now);
    expect(withInflation.inflationAdjustedGoalValue).toBeGreaterThan(withoutInflation.inflationAdjustedGoalValue);
  });

  it('detects an increasing contribution trend', () => {
    const contributions = [
      { amount: 5000, date: new Date(2025, 7, 1) },
      { amount: 5000, date: new Date(2025, 8, 1) },
      { amount: 15000, date: new Date(2025, 10, 1) },
      { amount: 15000, date: new Date(2025, 11, 1) },
    ];
    const progress = computeGoalProgress(base, contributions, now);
    expect(progress.contributionTrend).toBe('increasing');
  });

  it('reports insufficient_data with fewer than 2 recent contributions', () => {
    const progress = computeGoalProgress(base, [{ amount: 5000, date: new Date(2025, 11, 1) }], now);
    expect(progress.contributionTrend).toBe('insufficient_data');
  });

  it('weekly/daily/annual required savings derive consistently from the monthly figure', () => {
    const progress = computeGoalProgress(base, [], now);
    expect(progress.requiredAnnualSavings).toBeCloseTo(progress.requiredMonthlySavings * 12, 5);
  });

  it('returns a null expectedFinishDate when the current pace can never reach the target', () => {
    const stuck = computeGoalProgress({ ...base, monthlyContribution: 0, expectedReturnRate: 0 }, [], now);
    expect(stuck.expectedFinishDate).toBeNull();
  });
});

describe('calculateGoalProbability (pure)', () => {
  it('scores a fully-on-pace, low-debt, consistent goal as Very Safe or On Track', () => {
    const result = calculateGoalProbability({
      requiredMonthlySavings: 10000, currentMonthlySavings: 12000,
      contributionCount: 6, contributionConsistency: 0.95,
      monthlyIncome: 100000, debtRatio: 10,
      isEmergencyFundGoal: false, hasAdequateEmergencyFund: true,
    });
    expect(['Very Safe', 'On Track']).toContain(result.band);
  });

  it('scores a far-behind, high-debt goal as High Risk or Unlikely', () => {
    const result = calculateGoalProbability({
      requiredMonthlySavings: 50000, currentMonthlySavings: 2000,
      contributionCount: 6, contributionConsistency: 0.2,
      monthlyIncome: 40000, debtRatio: 70,
      isEmergencyFundGoal: false, hasAdequateEmergencyFund: false,
    });
    expect(['High Risk', 'Unlikely']).toContain(result.band);
  });

  it('does not penalize emergency-fund readiness for the emergency fund goal itself', () => {
    const result = calculateGoalProbability({
      requiredMonthlySavings: 10000, currentMonthlySavings: 10000,
      contributionCount: 3, contributionConsistency: 0.9,
      monthlyIncome: 50000, debtRatio: 20,
      isEmergencyFundGoal: true, hasAdequateEmergencyFund: false,
    });
    const efFactor = result.factors.find((f) => f.label === 'Emergency Fund Readiness')!;
    expect(efFactor.score).toBe(100);
  });

  it('every factor weight sums to 1', () => {
    const result = calculateGoalProbability({
      requiredMonthlySavings: 10000, currentMonthlySavings: 10000,
      contributionCount: 3, contributionConsistency: 0.9,
      monthlyIncome: 50000, debtRatio: 20,
      isEmergencyFundGoal: false, hasAdequateEmergencyFund: true,
    });
    const totalWeight = result.factors.reduce((s, f) => s + f.weight, 0);
    expect(totalWeight).toBeCloseTo(1, 5);
  });
});

describe('runGoalScenarios (pure)', () => {
  const goal: GoalInput = {
    targetAmount: 500000, currentAmount: 100000,
    targetDate: new Date(2028, 0, 1),
    monthlyContribution: 10000, expectedReturnRate: 8, expectedInflationRate: null,
  };
  const now = new Date(2026, 0, 1);

  it('produces exactly the 6 named scenarios', () => {
    const scenarios = runGoalScenarios(goal, now);
    expect(scenarios.map((s) => s.name)).toEqual([
      'Current Plan', 'Increase Monthly Savings', 'Delay Goal',
      'Increase Investment Return', 'Reduce Goal Cost', 'Early Achievement',
    ]);
  });

  it('"Increase Monthly Savings" finishes no later than "Current Plan"', () => {
    const scenarios = runGoalScenarios(goal, now);
    const current = scenarios.find((s) => s.name === 'Current Plan')!;
    const increased = scenarios.find((s) => s.name === 'Increase Monthly Savings')!;
    if (current.completionDate && increased.completionDate) {
      expect(increased.completionDate.getTime()).toBeLessThanOrEqual(current.completionDate.getTime());
    }
  });

  it('"Reduce Goal Cost" requires a lower monthly saving than "Current Plan"', () => {
    const scenarios = runGoalScenarios(goal, now);
    const current = scenarios.find((s) => s.name === 'Current Plan')!;
    const reduced = scenarios.find((s) => s.name === 'Reduce Goal Cost')!;
    expect(reduced.monthlySavingNeeded).toBeLessThan(current.monthlySavingNeeded);
  });
});

describe('computeGoalMilestones (pure)', () => {
  const goal: GoalInput = {
    targetAmount: 100000, currentAmount: 60000,
    targetDate: new Date(2027, 0, 1),
    monthlyContribution: 5000, expectedReturnRate: null, expectedInflationRate: null,
  };
  const createdAt = new Date(2025, 0, 1);

  it('marks thresholds already covered by the seed amount as achieved at goal creation', () => {
    const milestones = computeGoalMilestones(goal, [], createdAt);
    const m50 = milestones.find((m) => m.percentage === 50)!;
    expect(m50.achieved).toBe(true);
    expect(m50.achievedAt).toEqual(createdAt);

    const m75 = milestones.find((m) => m.percentage === 75)!;
    expect(m75.achieved).toBe(false);
  });

  it('marks a threshold crossed by a later contribution with that contribution\'s date', () => {
    // currentAmount (80000) already includes the logged contribution, exactly
    // as goal.service does in real usage -- seed is 80000-20000=60000 (60%,
    // below the 75% threshold), and the contribution is what pushes it over.
    const contributionDate = new Date(2025, 5, 1);
    const milestones = computeGoalMilestones({ ...goal, currentAmount: 80000 }, [{ amount: 20000, date: contributionDate }], createdAt);
    const m75 = milestones.find((m) => m.percentage === 75)!;
    expect(m75.achieved).toBe(true);
    expect(m75.achievedAt).toEqual(contributionDate);
  });

  it('never marks a threshold achieved if it is never reached', () => {
    const milestones = computeGoalMilestones({ ...goal, currentAmount: 10000 }, [], createdAt);
    expect(milestones.every((m) => m.percentage > 10 ? !m.achieved : true)).toBe(true);
  });
});

describe('generateGoalRecommendations (pure)', () => {
  const probability = calculateGoalProbability({
    requiredMonthlySavings: 10000, currentMonthlySavings: 10000,
    contributionCount: 3, contributionConsistency: 0.9,
    monthlyIncome: 50000, debtRatio: 20,
    isEmergencyFundGoal: false, hasAdequateEmergencyFund: true,
  });

  it('returns a single positive message when the goal is already achieved', () => {
    const progress = computeGoalProgress(
      { targetAmount: 100000, currentAmount: 100000, targetDate: new Date(2027, 0, 1), monthlyContribution: 5000, expectedReturnRate: null, expectedInflationRate: null },
      [], new Date(2026, 0, 1),
    );
    const recs = generateGoalRecommendations({ name: 'Test Goal', goalType: 'CUSTOM' }, progress, probability, true);
    expect(recs).toHaveLength(1);
    expect(recs[0].severity).toBe('positive');
  });

  it('flags a behind-schedule goal with a concrete rupee gap', () => {
    const progress = computeGoalProgress(
      { targetAmount: 1000000, currentAmount: 10000, targetDate: new Date(2026, 6, 1), monthlyContribution: 1000, expectedReturnRate: null, expectedInflationRate: null },
      [], new Date(2026, 0, 1),
    );
    const recs = generateGoalRecommendations({ name: 'Farm House', goalType: 'FARM_HOUSE' }, progress, probability, true);
    expect(recs.some((r) => r.title.includes('behind schedule'))).toBe(true);
  });

  it('recommends completing the emergency fund first when this goal is not it and none exists', () => {
    const progress = computeGoalProgress(
      { targetAmount: 500000, currentAmount: 100000, targetDate: new Date(2028, 0, 1), monthlyContribution: 10000, expectedReturnRate: 8, expectedInflationRate: null },
      [], new Date(2026, 0, 1),
    );
    const recs = generateGoalRecommendations({ name: 'Car Purchase', goalType: 'CAR_PURCHASE' }, progress, probability, false);
    expect(recs.some((r) => r.title.includes('Emergency fund'))).toBe(true);
  });
});

describe('goalIntelligence.service integration', () => {
  beforeEach(resetDatabase);
  afterAll(() => prisma.$disconnect());

  async function setupUser() {
    const { user } = await authService.register({
      name: 'Test User', email: `goaltest-${Date.now()}-${Math.random()}@example.com`, password: 'Password123',
    });
    return user.id;
  }

  it('getGoalProgress reflects a real goal end to end', async () => {
    const userId = await setupUser();
    const goal = await goalService.createGoal(userId, {
      name: 'Emergency Fund', goalType: 'EMERGENCY_FUND', priority: 'HIGH',
      targetAmount: 300000, currentAmount: 50000, targetDate: '2027-01-01', monthlyContribution: 10000,
    } as any);

    const progress = await getGoalProgress(userId, goal.id);
    expect(progress.currentPct).toBeCloseTo((50000 / 300000) * 100, 3);
  });

  it('getGoalProbability integrates real income from the dashboard service', async () => {
    const userId = await setupUser();
    await prisma.transaction.create({ data: { userId, type: 'INCOME', amount: 100000, date: new Date() } });
    const goal = await goalService.createGoal(userId, {
      name: 'Car Purchase', goalType: 'CAR_PURCHASE', priority: 'MEDIUM',
      targetAmount: 500000, currentAmount: 100000, targetDate: '2028-01-01', monthlyContribution: 15000,
    } as any);

    const probability = await getGoalProbability(userId, goal.id);
    expect(probability.factors.find((f) => f.label === 'Affordability')?.detail).toContain('% of monthly income');
  });

  it('getGoalScenarios, getGoalMilestones, getGoalRecommendations all resolve for a real goal', async () => {
    const userId = await setupUser();
    const goal = await goalService.createGoal(userId, {
      name: 'Perth Relocation', goalType: 'RELOCATION', priority: 'CRITICAL',
      targetAmount: 1500000, currentAmount: 200000, targetDate: '2028-06-01', monthlyContribution: 25000, expectedReturnRate: 7,
    } as any);

    const [scenarios, milestones, recommendations] = await Promise.all([
      getGoalScenarios(userId, goal.id),
      getGoalMilestones(userId, goal.id),
      getGoalRecommendations(userId, goal.id),
    ]);

    expect(scenarios).toHaveLength(6);
    expect(milestones).toHaveLength(5);
    expect(recommendations.length).toBeGreaterThan(0);
  });

  it('getGoalInsights flags a real goal that is behind schedule', async () => {
    const userId = await setupUser();
    await goalService.createGoal(userId, {
      name: 'Farm House', goalType: 'FARM_HOUSE', priority: 'LOW',
      targetAmount: 2000000, currentAmount: 10000, targetDate: '2026-08-01', monthlyContribution: 500,
    } as any);

    const insights = await getGoalInsights(userId);
    expect(insights.some((i) => i.goalName === 'Farm House' && i.severity === 'warning')).toBe(true);
  });

  it('createContribution increments currentAmount and deleteContribution decrements it back', async () => {
    const userId = await setupUser();
    const goal = await goalService.createGoal(userId, {
      name: 'Trip', goalType: 'TRAVEL', priority: 'LOW',
      targetAmount: 200000, currentAmount: 0, targetDate: '2027-01-01',
    } as any);

    const contribution = await goalService.createContribution(userId, goal.id, { amount: 15000, date: '2026-01-15', type: 'ONE_TIME' } as any);
    const afterAdd = await goalService.getGoal(userId, goal.id);
    expect(afterAdd.currentAmount).toBe(15000);

    await goalService.deleteContribution(userId, goal.id, contribution.id);
    const afterDelete = await goalService.getGoal(userId, goal.id);
    expect(afterDelete.currentAmount).toBe(0);
  });
});
