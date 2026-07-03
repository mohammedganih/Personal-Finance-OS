import { Goal, GoalContribution } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error.middleware';
import { getDashboardOverview } from './dashboard.service';

// ── Shared input shape ──────────────────────────────────────────────────────

export interface GoalInput {
  targetAmount: number;
  currentAmount: number;
  targetDate: Date;
  monthlyContribution: number | null;
  expectedReturnRate: number | null;
  expectedInflationRate: number | null;
}

function toGoalInput(goal: Goal): GoalInput {
  return {
    targetAmount: Number(goal.targetAmount),
    currentAmount: Number(goal.currentAmount),
    targetDate: goal.targetDate,
    monthlyContribution: goal.monthlyContribution ? Number(goal.monthlyContribution) : null,
    expectedReturnRate: goal.expectedReturnRate ? Number(goal.expectedReturnRate) : null,
    expectedInflationRate: goal.expectedInflationRate ? Number(goal.expectedInflationRate) : null,
  };
}

function monthsBetween(from: Date, to: Date): number {
  const days = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, days / 30.44);
}

// ── Progress Engine ──────────────────────────────────────────────────────────

export interface GoalProgress {
  currentPct: number;
  remainingAmount: number;
  monthsLeft: number;
  requiredMonthlySavings: number;
  requiredWeeklySavings: number;
  requiredDailySavings: number;
  requiredAnnualSavings: number;
  currentMonthlySavings: number;
  savingsGap: number; // required - current, negative means ahead of plan
  averageMonthlyContribution: number;
  contributionTrend: 'increasing' | 'decreasing' | 'flat' | 'insufficient_data';
  expectedFinishDate: Date | null; // null = never at current pace
  projectedFutureValue: number;
  inflationAdjustedGoalValue: number;
  realPurchasingPower: number;
}

/**
 * Solves the standard ordinary-annuity payment formula for the monthly
 * contribution needed to grow `presentValue` to `futureValueTarget` over
 * `months` months at `monthlyRate`. Falls back to flat division when the
 * rate is 0 (no growth assumption).
 */
export function requiredMonthlyPayment(futureValueTarget: number, presentValue: number, months: number, monthlyRate: number): number {
  if (months <= 0) return Math.max(0, futureValueTarget - presentValue);
  const remaining = futureValueTarget - presentValue * Math.pow(1 + monthlyRate, months);
  if (remaining <= 0) return 0;
  if (monthlyRate === 0) return remaining / months;
  return (remaining * monthlyRate) / (Math.pow(1 + monthlyRate, months) - 1);
}

/**
 * Solves the same annuity formula for the NUMBER OF MONTHS needed to reach
 * futureValueTarget given a fixed monthly contribution. Returns null when
 * the target is mathematically unreachable at this pace (no growth and no
 * contribution, or a contribution too small relative to a negative-growth
 * scenario) -- a sentinel rather than a misleading number, same convention
 * as the debt module's payoff-time calculations.
 */
export function monthsToReachTarget(futureValueTarget: number, presentValue: number, monthlyContribution: number, monthlyRate: number): number | null {
  if (presentValue >= futureValueTarget) return 0;

  if (monthlyRate === 0) {
    if (monthlyContribution <= 0) return null;
    return (futureValueTarget - presentValue) / monthlyContribution;
  }

  if (monthlyContribution <= 0) {
    if (presentValue <= 0) return null;
    const ratio = futureValueTarget / presentValue;
    if (ratio <= 1) return 0;
    return Math.log(ratio) / Math.log(1 + monthlyRate);
  }

  const perpetuityLevel = monthlyContribution / monthlyRate;
  const numerator = futureValueTarget + perpetuityLevel;
  const denominator = presentValue + perpetuityLevel;
  if (denominator <= 0 || numerator / denominator <= 0) return null;
  const ratio = numerator / denominator;
  if (ratio <= 1) return 0;
  return Math.log(ratio) / Math.log(1 + monthlyRate);
}

function addMonthsFractional(date: Date, months: number): Date {
  const wholeMonths = Math.floor(months);
  const fractionalDays = (months - wholeMonths) * 30.44;
  const d = new Date(date.getFullYear(), date.getMonth() + wholeMonths, date.getDate() + Math.round(fractionalDays));
  return d;
}

/**
 * Pure function: the full progress picture for one goal, given its own
 * fields and its logged contribution history (for the trend/average -- the
 * only two numbers that need real history rather than just current state).
 */
export function computeGoalProgress(goal: GoalInput, contributions: { amount: number; date: Date }[], now: Date): GoalProgress {
  const currentPct = goal.targetAmount > 0 ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) : 0;
  const remainingAmount = Math.max(0, goal.targetAmount - goal.currentAmount);
  const monthsLeft = monthsBetween(now, goal.targetDate);

  const monthlyRate = (goal.expectedReturnRate ?? 0) / 100 / 12;
  const inflationRate = (goal.expectedInflationRate ?? 0) / 100 / 12;

  const inflationAdjustedGoalValue = goal.expectedInflationRate
    ? goal.targetAmount * Math.pow(1 + inflationRate, monthsLeft)
    : goal.targetAmount;

  const requiredMonthlySavings = requiredMonthlyPayment(inflationAdjustedGoalValue, goal.currentAmount, monthsLeft, monthlyRate);
  const requiredWeeklySavings = requiredMonthlySavings / 4.345;
  const requiredDailySavings = requiredMonthlySavings / 30.44;
  const requiredAnnualSavings = requiredMonthlySavings * 12;

  // Average actual monthly contribution over the last 6 months of history.
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
  const recentContributions = contributions.filter((c) => c.date >= sixMonthsAgo && c.date <= now);
  const monthsOfHistory = Math.max(1, monthsBetween(sixMonthsAgo, now));
  const averageMonthlyContribution = recentContributions.reduce((s, c) => s + c.amount, 0) / monthsOfHistory;

  // Trend: compare the more recent half of the window to the older half.
  let contributionTrend: GoalProgress['contributionTrend'] = 'insufficient_data';
  if (recentContributions.length >= 2) {
    const midpoint = new Date(sixMonthsAgo.getTime() + (now.getTime() - sixMonthsAgo.getTime()) / 2);
    const olderHalf = recentContributions.filter((c) => c.date < midpoint).reduce((s, c) => s + c.amount, 0);
    const newerHalf = recentContributions.filter((c) => c.date >= midpoint).reduce((s, c) => s + c.amount, 0);
    if (newerHalf > olderHalf * 1.1) contributionTrend = 'increasing';
    else if (newerHalf < olderHalf * 0.9) contributionTrend = 'decreasing';
    else contributionTrend = 'flat';
  }

  const currentMonthlySavings = goal.monthlyContribution ?? averageMonthlyContribution;
  const savingsGap = requiredMonthlySavings - currentMonthlySavings;

  const monthsAtCurrentPace = monthsToReachTarget(inflationAdjustedGoalValue, goal.currentAmount, currentMonthlySavings, monthlyRate);
  const expectedFinishDate = monthsAtCurrentPace === null ? null : addMonthsFractional(now, monthsAtCurrentPace);

  const projectedFutureValue = goal.currentAmount * Math.pow(1 + monthlyRate, monthsLeft)
    + currentMonthlySavings * (monthlyRate === 0 ? monthsLeft : (Math.pow(1 + monthlyRate, monthsLeft) - 1) / monthlyRate);

  const realPurchasingPower = goal.expectedInflationRate
    ? projectedFutureValue / Math.pow(1 + inflationRate, monthsLeft)
    : projectedFutureValue;

  return {
    currentPct, remainingAmount, monthsLeft,
    requiredMonthlySavings, requiredWeeklySavings, requiredDailySavings, requiredAnnualSavings,
    currentMonthlySavings, savingsGap,
    averageMonthlyContribution, contributionTrend,
    expectedFinishDate, projectedFutureValue,
    inflationAdjustedGoalValue, realPurchasingPower,
  };
}

// ── Success Probability Engine ──────────────────────────────────────────────

export type ProbabilityBand = 'Very Safe' | 'On Track' | 'Moderate Risk' | 'High Risk' | 'Unlikely';

export interface ProbabilityFactor {
  label: string;
  score: number; // 0-100
  weight: number;
  detail: string;
}

export interface GoalProbability {
  score: number;
  band: ProbabilityBand;
  color: string;
  factors: ProbabilityFactor[];
}

function clampScore(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function bandFor(score: number): { band: ProbabilityBand; color: string } {
  if (score >= 85) return { band: 'Very Safe', color: 'success' };
  if (score >= 70) return { band: 'On Track', color: 'success' };
  if (score >= 50) return { band: 'Moderate Risk', color: 'warning' };
  if (score >= 30) return { band: 'High Risk', color: 'danger' };
  return { band: 'Unlikely', color: 'danger' };
}

/**
 * Weighted 5-factor model, same "each factor independently meaningful and
 * surfaced, never one opaque number" pattern as the debt Health Score.
 * Factors chosen are the ones honestly computable from real data already
 * in this app -- pace and consistency from the goal's own history,
 * affordability from real income (dashboard), debt burden from the real
 * debt ratio, and an emergency-fund gate that checks the user's OTHER goals.
 */
export function calculateGoalProbability(input: {
  requiredMonthlySavings: number;
  currentMonthlySavings: number;
  contributionCount: number;
  contributionConsistency: number; // 0-1, 1 = perfectly regular
  monthlyIncome: number;
  debtRatio: number; // 0-100
  isEmergencyFundGoal: boolean;
  hasAdequateEmergencyFund: boolean;
}): GoalProbability {
  const {
    requiredMonthlySavings, currentMonthlySavings, contributionCount, contributionConsistency,
    monthlyIncome, debtRatio, isEmergencyFundGoal, hasAdequateEmergencyFund,
  } = input;

  // 1. Pace: current savings rate vs what's required.
  const paceRatio = requiredMonthlySavings > 0 ? currentMonthlySavings / requiredMonthlySavings : 1;
  const paceScore = clampScore(paceRatio * 100);

  // 2. Consistency: regularity of contribution history. Neutral with too little history to judge.
  const consistencyScore = contributionCount >= 2 ? clampScore(contributionConsistency * 100) : 70;

  // 3. Affordability: required savings as a share of real monthly income.
  const affordabilityPct = monthlyIncome > 0 ? (requiredMonthlySavings / monthlyIncome) * 100 : 0;
  const affordabilityScore = monthlyIncome > 0 ? clampScore(100 - (affordabilityPct / 40) * 100) : 70;

  // 4. Debt burden: reuses the same asset-based debt ratio as the dashboard.
  const debtScore = clampScore(100 - (debtRatio / 60) * 100);

  // 5. Emergency fund readiness: only penalized when this ISN'T itself the
  //    emergency fund goal and no adequate one exists elsewhere.
  const emergencyScore = isEmergencyFundGoal || hasAdequateEmergencyFund ? 100 : 40;

  const factors: ProbabilityFactor[] = [
    { label: 'Savings Pace', score: paceScore, weight: 0.3, detail: `Saving ${paceRatio >= 1 ? 'at or above' : `${(paceRatio * 100).toFixed(0)}% of`} the required rate` },
    { label: 'Contribution Consistency', score: consistencyScore, weight: 0.2, detail: contributionCount >= 2 ? `${(contributionConsistency * 100).toFixed(0)}% regular` : 'Not enough history yet' },
    { label: 'Affordability', score: affordabilityScore, weight: 0.2, detail: monthlyIncome > 0 ? `${affordabilityPct.toFixed(1)}% of monthly income` : 'No income recorded' },
    { label: 'Debt Burden', score: debtScore, weight: 0.15, detail: `${debtRatio.toFixed(1)}% debt-to-assets` },
    { label: 'Emergency Fund Readiness', score: emergencyScore, weight: 0.15, detail: isEmergencyFundGoal ? 'This is your emergency fund' : hasAdequateEmergencyFund ? 'Emergency fund in place' : 'No adequate emergency fund yet' },
  ];

  const score = clampScore(factors.reduce((s, f) => s + f.score * f.weight, 0));
  const { band, color } = bandFor(score);

  return { score, band, color, factors };
}

// ── Scenario Engine ──────────────────────────────────────────────────────────

export interface ScenarioResult {
  name: string;
  description: string;
  completionDate: Date | null;
  monthlySavingNeeded: number;
  probability: number;
  totalContributions: number;
  investmentGrowth: number;
  inflationImpact: number;
}

function simulateScenario(
  name: string, description: string,
  goal: GoalInput, now: Date,
  overrides: { monthlyContribution?: number; targetDate?: Date; expectedReturnRate?: number; targetAmount?: number },
): ScenarioResult {
  const merged: GoalInput = {
    ...goal,
    monthlyContribution: overrides.monthlyContribution ?? goal.monthlyContribution,
    targetDate: overrides.targetDate ?? goal.targetDate,
    expectedReturnRate: overrides.expectedReturnRate ?? goal.expectedReturnRate,
    targetAmount: overrides.targetAmount ?? goal.targetAmount,
  };

  const monthsLeft = monthsBetween(now, merged.targetDate);
  const monthlyRate = (merged.expectedReturnRate ?? 0) / 100 / 12;
  const inflationRate = (merged.expectedInflationRate ?? 0) / 100 / 12;
  const inflationAdjustedTarget = merged.expectedInflationRate
    ? merged.targetAmount * Math.pow(1 + inflationRate, monthsLeft)
    : merged.targetAmount;

  const monthly = merged.monthlyContribution ?? 0;
  const monthsToFinish = monthsToReachTarget(inflationAdjustedTarget, merged.currentAmount, monthly, monthlyRate);
  const completionDate = monthsToFinish === null ? null : addMonthsFractional(now, monthsToFinish);
  const monthlySavingNeeded = requiredMonthlyPayment(inflationAdjustedTarget, merged.currentAmount, monthsLeft, monthlyRate);

  const effectiveMonths = monthsToFinish ?? monthsLeft;
  const totalContributions = merged.currentAmount + monthly * effectiveMonths;
  const futureValue = merged.currentAmount * Math.pow(1 + monthlyRate, effectiveMonths)
    + monthly * (monthlyRate === 0 ? effectiveMonths : (Math.pow(1 + monthlyRate, effectiveMonths) - 1) / monthlyRate);
  const investmentGrowth = Math.max(0, futureValue - totalContributions);
  const inflationImpact = inflationAdjustedTarget - merged.targetAmount;

  // Rough probability proxy: how comfortably the plan's own monthly
  // contribution covers what that plan itself requires.
  const probability = monthlySavingNeeded > 0 ? clampScore((monthly / monthlySavingNeeded) * 100) : 100;

  return { name, description, completionDate, monthlySavingNeeded, probability, totalContributions, investmentGrowth, inflationImpact };
}

/** Six named scenarios, each a variation on the base plan. */
export function runGoalScenarios(goal: GoalInput, now: Date): ScenarioResult[] {
  const baseMonthly = goal.monthlyContribution ?? 0;
  const baseMonthsLeft = monthsBetween(now, goal.targetDate);

  return [
    simulateScenario('Current Plan', 'Your plan exactly as configured today', goal, now, {}),
    simulateScenario('Increase Monthly Savings', 'Contribute 20% more per month', goal, now, { monthlyContribution: baseMonthly * 1.2 }),
    simulateScenario('Delay Goal', 'Push the target date back by 6 months', goal, now, { targetDate: addMonthsFractional(goal.targetDate, 6) }),
    simulateScenario('Increase Investment Return', 'Assume 2 percentage points higher annual return', goal, now, { expectedReturnRate: (goal.expectedReturnRate ?? 0) + 2 }),
    simulateScenario('Reduce Goal Cost', 'Target 10% less', goal, now, { targetAmount: goal.targetAmount * 0.9 }),
    simulateScenario('Early Achievement', 'Finish 6 months sooner', goal, now, { targetDate: addMonthsFractional(goal.targetDate, -Math.min(6, baseMonthsLeft)) }),
  ];
}

// ── Milestones ───────────────────────────────────────────────────────────────

export interface GoalMilestone {
  percentage: number;
  achieved: boolean;
  achievedAt: Date | null;
  amountAtMilestone: number;
}

const MILESTONE_THRESHOLDS = [10, 25, 50, 75, 100];

/**
 * Pure function: milestones are derived, not stored. Reconstructs a running
 * balance from the contribution ledger (oldest first) starting from the
 * implied "seed" amount (whatever currentAmount was before any logged
 * contribution -- e.g. money the goal started with at creation) so a
 * threshold crossed before the first logged contribution still gets a real
 * achievedAt date instead of null.
 */
export function computeGoalMilestones(goal: GoalInput, contributions: { amount: number; date: Date }[], goalCreatedAt: Date): GoalMilestone[] {
  const sorted = [...contributions].sort((a, b) => a.date.getTime() - b.date.getTime());
  const seed = goal.currentAmount - sorted.reduce((s, c) => s + c.amount, 0);

  const milestones: GoalMilestone[] = MILESTONE_THRESHOLDS.map((pct) => ({
    percentage: pct, achieved: false, achievedAt: null, amountAtMilestone: (pct / 100) * goal.targetAmount,
  }));

  let running = seed;
  for (const m of milestones) {
    if (running >= m.amountAtMilestone) { m.achieved = true; m.achievedAt = goalCreatedAt; }
  }
  for (const c of sorted) {
    running += c.amount;
    for (const m of milestones) {
      if (!m.achieved && running >= m.amountAtMilestone) { m.achieved = true; m.achievedAt = c.date; }
    }
  }

  return milestones;
}

// ── Recommendation Engine ───────────────────────────────────────────────────

export type GoalRecommendationSeverity = 'critical' | 'warning' | 'info' | 'positive';

export interface GoalRecommendation {
  priority: number;
  severity: GoalRecommendationSeverity;
  title: string;
  description: string;
}

export function generateGoalRecommendations(
  goal: { name: string; goalType: string },
  progress: GoalProgress,
  probability: GoalProbability,
  hasAdequateEmergencyFund: boolean,
): GoalRecommendation[] {
  const recs: GoalRecommendation[] = [];

  if (progress.currentPct >= 100) {
    return [{ priority: 1, severity: 'positive', title: 'Goal achieved', description: `"${goal.name}" has reached its target. Consider marking it complete or setting a new stretch target.` }];
  }

  if (goal.goalType !== 'EMERGENCY_FUND' && !hasAdequateEmergencyFund) {
    recs.push({
      priority: 1, severity: 'warning',
      title: 'Emergency fund should come first',
      description: `You don't have an adequately funded Emergency Fund goal yet. Prioritize that before "${goal.name}" to avoid breaking this goal's savings during an emergency.`,
    });
  }

  if (progress.savingsGap > 0) {
    recs.push({
      priority: 1, severity: progress.savingsGap > progress.requiredMonthlySavings * 0.5 ? 'critical' : 'warning',
      title: `You're ₹${Math.round(progress.savingsGap).toLocaleString('en-IN')}/month behind schedule`,
      description: `Increase your contribution by ₹${Math.round(progress.savingsGap).toLocaleString('en-IN')}/month to stay on track for the target date, or delay the goal.`,
    });

    const delayNote = progress.expectedFinishDate
      ? `At the current pace, this goal finishes around ${progress.expectedFinishDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })} instead.`
      : `At the current pace, this goal will never reach its target -- the contribution doesn't outpace what's needed.`;
    recs.push({ priority: 2, severity: 'info', title: 'Alternative: delay the target date', description: delayNote });
  } else if (progress.savingsGap < 0) {
    recs.push({
      priority: 3, severity: 'positive',
      title: 'Ahead of schedule',
      description: `You're saving ₹${Math.round(-progress.savingsGap).toLocaleString('en-IN')}/month more than required -- this goal could finish early.`,
    });
  }

  const worstFactor = [...probability.factors].sort((a, b) => a.score - b.score)[0];
  if (worstFactor && worstFactor.score < 50 && worstFactor.label !== 'Emergency Fund Readiness') {
    recs.push({ priority: 2, severity: 'warning', title: `${worstFactor.label} needs attention`, description: worstFactor.detail });
  }

  if (recs.length === 0) {
    recs.push({ priority: 1, severity: 'positive', title: 'On track', description: `"${goal.name}" is progressing well at its current pace.` });
  }

  return recs.sort((a, b) => a.priority - b.priority).map((r, i) => ({ ...r, priority: i + 1 }));
}

// ── Orchestration (I/O) ──────────────────────────────────────────────────────

async function getContributionsFor(goalId: string): Promise<{ amount: number; date: Date }[]> {
  const rows = await prisma.goalContribution.findMany({ where: { goalId }, orderBy: { date: 'asc' } });
  return rows.map((r) => ({ amount: Number(r.amount), date: r.date }));
}

function contributionConsistency(contributions: { amount: number; date: Date }[]): number {
  if (contributions.length < 2) return 1;
  const amounts = contributions.map((c) => c.amount);
  const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
  if (mean === 0) return 1;
  const variance = amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length;
  const cv = Math.sqrt(variance) / mean; // coefficient of variation
  return Math.max(0, 1 - Math.min(1, cv));
}

async function hasAdequateEmergencyFund(userId: string, excludeGoalId?: string): Promise<boolean> {
  const efGoals = await prisma.goal.findMany({ where: { userId, goalType: 'EMERGENCY_FUND', id: excludeGoalId ? { not: excludeGoalId } : undefined } });
  return efGoals.some((g) => Number(g.currentAmount) >= Number(g.targetAmount) * 0.8);
}

async function loadGoal(userId: string, goalId: string): Promise<Goal> {
  const goal = await prisma.goal.findFirst({ where: { id: goalId, userId } });
  if (!goal) throw createError('Goal not found', 404);
  return goal;
}

export async function getGoalProgress(userId: string, goalId: string): Promise<GoalProgress> {
  const goal = await loadGoal(userId, goalId);
  const contributions = await getContributionsFor(goalId);
  return computeGoalProgress(toGoalInput(goal), contributions, new Date());
}

export async function getGoalProbability(userId: string, goalId: string): Promise<GoalProbability> {
  const goal = await loadGoal(userId, goalId);
  const contributions = await getContributionsFor(goalId);
  const progress = computeGoalProgress(toGoalInput(goal), contributions, new Date());
  const overview = await getDashboardOverview(userId);
  const adequateEF = await hasAdequateEmergencyFund(userId, goalId);

  return calculateGoalProbability({
    requiredMonthlySavings: progress.requiredMonthlySavings,
    currentMonthlySavings: progress.currentMonthlySavings,
    contributionCount: contributions.length,
    contributionConsistency: contributionConsistency(contributions),
    monthlyIncome: overview.monthlyIncome,
    debtRatio: overview.debtRatio,
    isEmergencyFundGoal: goal.goalType === 'EMERGENCY_FUND',
    hasAdequateEmergencyFund: adequateEF,
  });
}

export async function getGoalScenarios(userId: string, goalId: string): Promise<ScenarioResult[]> {
  const goal = await loadGoal(userId, goalId);
  return runGoalScenarios(toGoalInput(goal), new Date());
}

export async function getGoalMilestones(userId: string, goalId: string): Promise<GoalMilestone[]> {
  const goal = await loadGoal(userId, goalId);
  const contributions = await getContributionsFor(goalId);
  return computeGoalMilestones(toGoalInput(goal), contributions, goal.createdAt);
}

export async function getGoalRecommendations(userId: string, goalId: string): Promise<GoalRecommendation[]> {
  const goal = await loadGoal(userId, goalId);
  const contributions = await getContributionsFor(goalId);
  const progress = computeGoalProgress(toGoalInput(goal), contributions, new Date());
  const probability = await getGoalProbability(userId, goalId);
  const adequateEF = await hasAdequateEmergencyFund(userId, goalId);
  return generateGoalRecommendations({ name: goal.name, goalType: goal.goalType }, progress, probability, adequateEF);
}

// ── Cross-goal insights ──────────────────────────────────────────────────────

export interface GoalInsight {
  goalId: string;
  goalName: string;
  message: string;
  severity: GoalRecommendationSeverity;
}

export async function getGoalInsights(userId: string): Promise<GoalInsight[]> {
  const goals = await prisma.goal.findMany({ where: { userId, isCompleted: false } });
  const now = new Date();
  const insights: GoalInsight[] = [];

  for (const goal of goals) {
    const contributions = await getContributionsFor(goal.id);
    const progress = computeGoalProgress(toGoalInput(goal), contributions, now);

    if (progress.currentPct >= 100) continue;

    if (progress.expectedFinishDate && progress.expectedFinishDate > goal.targetDate) {
      const monthsLate = Math.round(monthsBetween(goal.targetDate, progress.expectedFinishDate));
      if (monthsLate > 0) {
        insights.push({
          goalId: goal.id, goalName: goal.name, severity: 'warning',
          message: `${goal.name} will be delayed by ~${monthsLate} month${monthsLate === 1 ? '' : 's'} at the current pace.`,
        });
      }
    } else if (progress.expectedFinishDate && progress.expectedFinishDate < goal.targetDate) {
      const monthsEarly = Math.round(monthsBetween(progress.expectedFinishDate, goal.targetDate));
      if (monthsEarly > 0) {
        insights.push({
          goalId: goal.id, goalName: goal.name, severity: 'positive',
          message: `${goal.name} is ahead of schedule -- on pace to finish ~${monthsEarly} month${monthsEarly === 1 ? '' : 's'} early.`,
        });
      }
    }
  }

  return insights;
}
