import { getDiversification, getInvestmentHealth } from './investmentIntelligence.service';
import { getHealthScore, bandFor, HealthScoreBand } from './debtIntelligence.service';
import { getDashboardOverview } from './dashboard.service';

// ── Spending Rhythm ─────────────────────────────────────────────────────────

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
