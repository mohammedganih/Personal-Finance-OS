import { prisma } from '../lib/prisma';
import { NOT_MOVES } from '../metrics';
import { getDiversification, getInvestmentHealth } from './investmentIntelligence.service';
import { getHealthScore, bandFor, HealthScoreBand } from './debtIntelligence.service';
import { getDashboardOverview } from './dashboard.service';

// ── Spending Rhythm ─────────────────────────────────────────────────────────

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface SpendingRhythmDay {
  day: string;
  dayIndex: number; // 0 = Mon .. 6 = Sun
  avgAmount: number;
  occurrences: number;
}

export interface SpendingRhythm {
  days: SpendingRhythmDay[];
  weeksOfData: number;
  hasEnoughData: boolean;
  peakDay: SpendingRhythmDay | null;
}

/**
 * Pure function over already-fetched expense transactions. Averages spend
 * per weekday across however many times that weekday has actually occurred
 * in the data, not total/7 -- a user with 10 weeks of history shouldn't have
 * Friday's average diluted by weeks that haven't happened yet.
 */
export function computeSpendingRhythm(transactions: { date: Date; amount: number }[], now: Date): SpendingRhythm {
  const totals = new Array(7).fill(0);
  const occurrenceDates: Set<string>[] = Array.from({ length: 7 }, () => new Set());
  let earliest: Date | null = null;

  for (const t of transactions) {
    const jsDay = t.date.getDay(); // 0 = Sun .. 6 = Sat
    const dayIndex = (jsDay + 6) % 7; // 0 = Mon .. 6 = Sun
    totals[dayIndex] += t.amount;
    occurrenceDates[dayIndex].add(t.date.toISOString().slice(0, 10));
    if (!earliest || t.date < earliest) earliest = t.date;
  }

  const days: SpendingRhythmDay[] = WEEKDAY_LABELS.map((day, dayIndex) => {
    const occurrences = occurrenceDates[dayIndex].size;
    return {
      day,
      dayIndex,
      avgAmount: occurrences > 0 ? totals[dayIndex] / occurrences : 0,
      occurrences,
    };
  });

  const weeksOfData = earliest ? Math.floor((now.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24 * 7)) : 0;
  const hasEnoughData = weeksOfData >= 12;

  const withData = days.filter((d) => d.occurrences > 0);
  const peakDay = withData.length > 0 ? withData.reduce((a, b) => (b.avgAmount > a.avgAmount ? b : a)) : null;

  return { days, weeksOfData, hasEnoughData, peakDay };
}

export async function getSpendingRhythm(userId: string): Promise<SpendingRhythm> {
  const transactions = await prisma.transaction.findMany({
    where: { userId, type: 'EXPENSE', isWealthTransfer: false, ...NOT_MOVES },
    select: { date: true, amount: true },
  });

  return computeSpendingRhythm(
    transactions.map((t) => ({ date: t.date, amount: Number(t.amount) })),
    new Date()
  );
}

// ── Financial Score ─────────────────────────────────────────────────────────

export interface FinancialScoreComponent {
  label: string;
  score: number; // 0-100
  weight: number; // fraction of total, sums to 1
  detail: string;
}

export interface FinancialScoreResult {
  score: number; // 0-100, weighted composite
  band: HealthScoreBand;
  components: FinancialScoreComponent[];
}

const SAVINGS_RATE_CEILING = 25; // % savings rate treated as "excellent" for scoring purposes

/**
 * Composes the two health scores this dossier pass already built elsewhere
 * (Debt Health on Loans, Investment Health on Investments) with this
 * month's savings rate -- three real numbers, not a fourth kind of math.
 * When the household has no investments yet, that's a neutral fact, not a
 * penalty, so its weight is redistributed rather than scored as zero.
 */
export function computeFinancialScore(input: {
  debtScore: number;
  investmentScore: number | null;
  savingsRatePct: number;
}): FinancialScoreResult {
  const { debtScore, investmentScore, savingsRatePct } = input;
  const savingsScore = Math.max(0, Math.min(100, (savingsRatePct / SAVINGS_RATE_CEILING) * 100));

  const baseWeights = { debt: 0.35, investment: 0.35, savings: 0.3 };
  const hasInvestments = investmentScore !== null;
  const activeWeightSum = hasInvestments ? 1 : baseWeights.debt + baseWeights.savings;

  const components: FinancialScoreComponent[] = [
    {
      label: 'Debt Health',
      score: debtScore,
      weight: baseWeights.debt / activeWeightSum,
      detail: `${Math.round(debtScore)}/100 from Loans`,
    },
    {
      label: 'Savings Rate',
      score: savingsScore,
      weight: baseWeights.savings / activeWeightSum,
      detail: `${savingsRatePct.toFixed(1)}% saved this month`,
    },
  ];

  if (hasInvestments) {
    components.splice(1, 0, {
      label: 'Investment Health',
      score: investmentScore,
      weight: baseWeights.investment / activeWeightSum,
      detail: `${Math.round(investmentScore)}/100 from Investments`,
    });
  }

  const score = Math.round(components.reduce((sum, c) => sum + c.score * c.weight, 0));

  return { score, band: bandFor(score), components };
}

export async function getFinancialScore(userId: string): Promise<FinancialScoreResult> {
  const [{ classBreakdown }, investmentHealth, debtHealth, overview] = await Promise.all([
    getDiversification(userId),
    getInvestmentHealth(userId),
    getHealthScore(userId),
    getDashboardOverview(userId),
  ]);

  return computeFinancialScore({
    debtScore: debtHealth.score,
    investmentScore: classBreakdown.length > 0 ? investmentHealth.score : null,
    savingsRatePct: overview.savingsRate,
  });
}
