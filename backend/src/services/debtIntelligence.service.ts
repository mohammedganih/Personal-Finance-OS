import { prisma } from '../lib/prisma';
import { calcEMIOutstanding } from './card-emi.service';
import { simulatePayoff } from './family.service';

export type DebtSourceType = 'LOAN' | 'CREDIT_CARD' | 'CARD_EMI';

export interface UnifiedDebt {
  id: string; // "loan:<id>" / "card:<id>" / "emi:<id>" -- unique across all three sources
  sourceType: DebtSourceType;
  sourceId: string;
  name: string;
  remainingBalance: number;
  emi: number;
  interestRate: number;
  memberId: string | null;
  // Only populated for LOAN -- the other two sources don't have a
  // "contracted schedule" to be ahead of or behind on.
  startDate?: Date;
  tenureMonths?: number;
}

export interface DebtWithStats extends UnifiedDebt {
  monthlyInterest: number;
  monthlyPrincipal: number;
  monthsToPayoff: number;
}

/**
 * Aggregates every interest-bearing liability into one normalized shape so
 * the payoff-simulation engine (simulatePayoff, already generic and tested)
 * can run across the user's *entire* debt picture, not just Loan records.
 *
 * Credit card revolving balances are only included when the card has BOTH
 * a minimumPayment and an interestRate set -- without a real fixed monthly
 * payment, there's no honest "emi" to simulate against, and fabricating one
 * (e.g. defaulting to some % of balance) would produce a number that looks
 * precise but isn't grounded in anything the user actually agreed to pay.
 * A card missing either field still counts toward credit utilization
 * elsewhere; it just can't participate in avalanche/snowball simulation.
 */
async function getUnifiedDebts(userId: string): Promise<UnifiedDebt[]> {
  const [loans, cards, cardEmis] = await Promise.all([
    prisma.loan.findMany({ where: { userId, isActive: true } }),
    prisma.creditCard.findMany({ where: { userId, isActive: true } }),
    prisma.cardEMI.findMany({ where: { userId, isArchived: false }, include: { creditCard: { select: { cardName: true } } } }),
  ]);

  const debts: UnifiedDebt[] = [];

  for (const l of loans) {
    debts.push({
      id: `loan:${l.id}`,
      sourceType: 'LOAN',
      sourceId: l.id,
      name: l.name,
      remainingBalance: Number(l.remainingBalance),
      emi: Number(l.emi),
      interestRate: Number(l.interestRate),
      memberId: l.memberId,
      startDate: l.startDate,
      tenureMonths: l.tenureMonths,
    });
  }

  for (const c of cards) {
    const outstanding = Number(c.outstanding);
    if (outstanding > 0 && c.minimumPayment && c.interestRate) {
      debts.push({
        id: `card:${c.id}`,
        sourceType: 'CREDIT_CARD',
        sourceId: c.id,
        name: `${c.cardName} (revolving)`,
        remainingBalance: outstanding,
        emi: Number(c.minimumPayment),
        interestRate: Number(c.interestRate),
        memberId: c.memberId,
      });
    }
  }

  for (const e of cardEmis) {
    const outstanding = calcEMIOutstanding(e);
    if (outstanding > 0) {
      debts.push({
        id: `emi:${e.id}`,
        sourceType: 'CARD_EMI',
        sourceId: e.id,
        name: `${e.itemName} (${e.creditCard.cardName})`,
        remainingBalance: outstanding,
        emi: Number(e.emiAmount),
        interestRate: e.isNoCost ? 0 : Number(e.interestRate ?? 0),
        memberId: e.memberId,
      });
    }
  }

  return debts;
}

/**
 * Pure function -- no I/O -- computing the same amortization-based stats for
 * any debt, regardless of source. Mirrors the formula the frontend's
 * computeLoanStats already used for Loan records (n = -ln(1 - rB/EMI) /
 * ln(1+r)), generalized to work for credit cards and card EMIs too.
 */
export function computeDebtStats(debt: UnifiedDebt): DebtWithStats {
  const r = debt.interestRate / 100 / 12;
  const monthlyInterest = r > 0 ? debt.remainingBalance * r : 0;
  const monthlyPrincipal = Math.max(0, debt.emi - monthlyInterest);

  // 999 is the sentinel for "does not actually pay off at this rate/payment".
  // Loan EMIs are contractually always above their own interest, so this case
  // was near-impossible there -- but a credit card's minimumPayment can be,
  // and legitimately is, sometimes lower than the interest it accrues. In
  // that case the flat remaining/emi division used to be reached instead,
  // which understates payoff time (it ignores that the balance doesn't
  // actually shrink at all, since payments barely cover -- or don't cover --
  // the interest). Only fall back to flat division when truly interest-free.
  let monthsToPayoff: number;
  if (r > 0) {
    if (debt.emi > monthlyInterest) {
      const ratio = (r * debt.remainingBalance) / debt.emi;
      monthsToPayoff = ratio >= 1 || ratio <= 0 ? 999 : Math.ceil(-Math.log(1 - ratio) / Math.log(1 + r));
    } else {
      monthsToPayoff = 999;
    }
  } else {
    monthsToPayoff = debt.emi > 0 ? Math.ceil(debt.remainingBalance / debt.emi) : 999;
  }

  return { ...debt, monthlyInterest, monthlyPrincipal, monthsToPayoff };
}

export async function getUnifiedDebtsWithStats(userId: string): Promise<DebtWithStats[]> {
  const debts = await getUnifiedDebts(userId);
  return debts.map(computeDebtStats);
}

// ── Health Score ────────────────────────────────────────────────────────────

export type HealthScoreBand = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';

export interface HealthScoreFactor {
  label: string;
  score: number; // 0-100
  weight: number; // fraction of total, sums to 1 across all factors
  detail: string;
}

export interface HealthScoreResult {
  score: number; // 0-100, weighted composite
  band: HealthScoreBand;
  factors: HealthScoreFactor[];
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function bandFor(score: number): HealthScoreBand {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  if (score >= 20) return 'poor';
  return 'critical';
}

/**
 * Pure function -- every input is a plain number so this is unit-testable
 * without touching the database. Four factors, each independently
 * meaningful and individually surfaced (never just one opaque number):
 *
 *  - Interest burden: weighted-average rate across all debts. 0% -> 100,
 *    24%+ (a common ceiling for Indian credit card/personal loan rates) -> 0.
 *  - Debt-to-income: monthly EMI/minimum-payment burden vs monthly income.
 *    Lending-industry rule of thumb: <20% healthy, >40% risky.
 *  - On-track ratio: of your Loan records specifically (the only debt type
 *    with a contracted schedule to be ahead/behind on), what fraction are
 *    paying down principal at least as fast as time is passing. Neutral
 *    (100) when there are no loans, so a credit-card-only user isn't
 *    penalized for a concept that doesn't apply to them.
 *  - Credit utilization: outstanding vs limit across active cards.
 *    Standard guidance: <30% good, >50% risky. Neutral (100) with no cards.
 */
export function calculateHealthScore(input: {
  weightedAvgInterestRate: number;
  totalMonthlyDebtPayment: number;
  monthlyIncome: number;
  loansOnTrackCount: number;
  loansTotalCount: number;
  creditUtilizationPct: number;
  hasCreditCards: boolean;
}): HealthScoreResult {
  const {
    weightedAvgInterestRate, totalMonthlyDebtPayment, monthlyIncome,
    loansOnTrackCount, loansTotalCount, creditUtilizationPct, hasCreditCards,
  } = input;

  const rateScore = clampScore(100 - (weightedAvgInterestRate / 24) * 100);

  const dti = monthlyIncome > 0 ? (totalMonthlyDebtPayment / monthlyIncome) * 100 : 0;
  const dtiScore = monthlyIncome > 0 ? clampScore(100 - (dti / 40) * 100) : 100;

  const onTrackScore = loansTotalCount > 0 ? (loansOnTrackCount / loansTotalCount) * 100 : 100;

  const utilScore = hasCreditCards ? clampScore(100 - (creditUtilizationPct / 50) * 100) : 100;

  const factors: HealthScoreFactor[] = [
    { label: 'Interest burden', score: rateScore, weight: 0.3, detail: `${weightedAvgInterestRate.toFixed(1)}% weighted-average rate` },
    { label: 'Debt-to-income', score: dtiScore, weight: 0.3, detail: monthlyIncome > 0 ? `${dti.toFixed(1)}% of monthly income` : 'No income recorded this month' },
    { label: 'On-track loans', score: onTrackScore, weight: 0.2, detail: loansTotalCount > 0 ? `${loansOnTrackCount}/${loansTotalCount} loans ahead of schedule` : 'No loans to track' },
    { label: 'Credit utilization', score: utilScore, weight: 0.2, detail: hasCreditCards ? `${creditUtilizationPct.toFixed(1)}% of total limit` : 'No credit cards' },
  ];

  const score = clampScore(factors.reduce((sum, f) => sum + f.score * f.weight, 0));

  return { score, band: bandFor(score), factors };
}

export async function getHealthScore(userId: string): Promise<HealthScoreResult> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [debts, loans, cards, incomeTxns] = await Promise.all([
    getUnifiedDebtsWithStats(userId),
    prisma.loan.findMany({ where: { userId, isActive: true } }),
    prisma.creditCard.findMany({ where: { userId, isActive: true } }),
    prisma.transaction.findMany({
      where: { userId, type: 'INCOME', date: { gte: startOfMonth, lte: endOfMonth } },
      select: { amount: true },
    }),
  ]);

  const monthlyIncome = incomeTxns.reduce((s, t) => s + Number(t.amount), 0);
  const totalMonthlyDebtPayment = debts.reduce((s, d) => s + d.emi, 0);

  const totalBalance = debts.reduce((s, d) => s + d.remainingBalance, 0);
  const weightedAvgInterestRate = totalBalance > 0
    ? debts.reduce((s, d) => s + d.interestRate * d.remainingBalance, 0) / totalBalance
    : 0;

  let loansOnTrackCount = 0;
  for (const l of loans) {
    const monthsElapsed = Math.max(0, Math.floor((now.getTime() - l.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
    const timePct = l.tenureMonths > 0 ? Math.min((monthsElapsed / l.tenureMonths) * 100, 100) : 0;
    const repaidPct = Number(l.principal) > 0 ? Math.min(((Number(l.principal) - Number(l.remainingBalance)) / Number(l.principal)) * 100, 100) : 0;
    if (repaidPct >= timePct) loansOnTrackCount++;
  }

  const totalLimit = cards.reduce((s, c) => s + Number(c.creditLimit), 0);
  const totalCardOutstanding = cards.reduce((s, c) => s + Number(c.outstanding), 0);
  const creditUtilizationPct = totalLimit > 0 ? (totalCardOutstanding / totalLimit) * 100 : 0;

  return calculateHealthScore({
    weightedAvgInterestRate,
    totalMonthlyDebtPayment,
    monthlyIncome,
    loansOnTrackCount,
    loansTotalCount: loans.length,
    creditUtilizationPct,
    hasCreditCards: cards.length > 0,
  });
}

// ── Payoff strategy (avalanche vs snowball) ─────────────────────────────────

export async function getDebtStrategy(userId: string, extraPayment = 5000) {
  const debts = await getUnifiedDebtsWithStats(userId);

  const avalanche = [...debts].sort((a, b) => b.interestRate - a.interestRate);
  const snowball = [...debts].sort((a, b) => a.remainingBalance - b.remainingBalance);
  const totalMonthlyInterest = debts.reduce((s, d) => s + d.monthlyInterest, 0);

  const base = simulatePayoff(avalanche, 0);
  const avalancheWithExtra = simulatePayoff(avalanche, extraPayment);
  const snowballWithExtra = simulatePayoff(snowball, extraPayment);

  return {
    debts,
    avalancheOrder: avalanche.map((d) => d.id),
    snowballOrder: snowball.map((d) => d.id),
    totalMonthlyInterest,
    extraPayment,
    baseMonths: base.months,
    avalancheMonthsWithExtra: avalancheWithExtra.months,
    snowballMonthsWithExtra: snowballWithExtra.months,
    interestSavedAvalanche: Math.max(0, base.totalInterest - avalancheWithExtra.totalInterest),
    interestSavedSnowball: Math.max(0, base.totalInterest - snowballWithExtra.totalInterest),
  };
}
