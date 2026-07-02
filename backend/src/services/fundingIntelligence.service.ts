import { prisma } from '../lib/prisma';
import { getUnifiedDebtsWithStats, simulatePrepayment, UnifiedDebt } from './debtIntelligence.service';
import { computeInvestmentValue } from './investment.service';

export type FundingSourceType = 'MATURITY' | 'LIQUID_HOLDING';

export interface FundingOpportunity {
  sourceType: FundingSourceType;
  investmentId: string;
  assetName: string;
  assetType: string;
  availableAmount: number;
  availableDate: Date | null; // null = liquid, available now
  targetDebtId: string;
  targetDebtName: string;
  monthsSaved: number;
  interestSaved: number;
  newMonths: number;
}

interface InvestmentInput {
  id: string;
  assetName: string;
  assetType: string;
  currentValue: number;
  maturityDate: Date | null;
  maturityAmount: number | null;
}

// FDs/RDs/gold schemes are locked until maturity -- only meaningful as a
// funding source once that date arrives. Everything else here (stocks, MFs,
// SIPs, ETFs, crypto, physical gold) can be sold/redeemed today, so its
// current value counts as available now. Real estate and "other" are
// excluded -- not realistically liquid on a debt-payoff timeline.
const MATURITY_TYPES = new Set(['FIXED_DEPOSIT', 'RECURRING_DEPOSIT', 'GOLD_SCHEME']);
const LIQUID_TYPES = new Set(['STOCK', 'MUTUAL_FUND', 'SIP', 'ETF', 'CRYPTO', 'GOLD']);

/**
 * Pure function: for every maturing or liquid holding, computes what would
 * happen if its full value were thrown at the user's single highest-interest
 * debt (the avalanche target -- mathematically the best single destination
 * for any one-time amount). Reuses simulatePrepayment unchanged so the
 * numbers are identical to the debt module's own Prepayment Calculator.
 * Returns [] when there's no debt to pay off -- there's nothing to recommend.
 */
export function buildFundingOpportunities(
  investments: InvestmentInput[],
  debts: UnifiedDebt[],
  now: Date,
  maturityMonthsAhead = 6,
): FundingOpportunity[] {
  if (debts.length === 0) return [];

  const targetDebt = [...debts].sort((a, b) => b.interestRate - a.interestRate)[0];
  const horizonEnd = new Date(now.getFullYear(), now.getMonth() + maturityMonthsAhead, now.getDate());

  const opportunities: FundingOpportunity[] = [];

  for (const inv of investments) {
    let sourceType: FundingSourceType | null = null;
    let availableAmount = 0;
    let availableDate: Date | null = null;

    if (MATURITY_TYPES.has(inv.assetType) && inv.maturityDate && inv.maturityDate >= now && inv.maturityDate <= horizonEnd) {
      sourceType = 'MATURITY';
      availableAmount = inv.maturityAmount ?? inv.currentValue;
      availableDate = inv.maturityDate;
    } else if (LIQUID_TYPES.has(inv.assetType) && inv.currentValue > 0) {
      sourceType = 'LIQUID_HOLDING';
      availableAmount = inv.currentValue;
    }

    if (!sourceType || availableAmount <= 0) continue;

    const impact = simulatePrepayment(targetDebt, availableAmount);
    opportunities.push({
      sourceType,
      investmentId: inv.id,
      assetName: inv.assetName,
      assetType: inv.assetType,
      availableAmount,
      availableDate,
      targetDebtId: targetDebt.id,
      targetDebtName: targetDebt.name,
      monthsSaved: impact.monthsSaved,
      interestSaved: impact.interestSaved,
      newMonths: impact.newMonths,
    });
  }

  return opportunities.sort((a, b) => b.interestSaved - a.interestSaved);
}

export async function getFundingOpportunities(userId: string, maturityMonthsAhead = 6): Promise<FundingOpportunity[]> {
  const now = new Date();
  const [investmentsRaw, debts] = await Promise.all([
    prisma.investment.findMany({ where: { userId } }),
    getUnifiedDebtsWithStats(userId),
  ]);

  const investments: InvestmentInput[] = investmentsRaw.map((inv) => ({
    id: inv.id,
    assetName: inv.assetName,
    assetType: inv.assetType,
    currentValue: computeInvestmentValue(inv, now).currentValue,
    maturityDate: inv.maturityDate,
    maturityAmount: inv.maturityAmount ? Number(inv.maturityAmount) : null,
  }));

  return buildFundingOpportunities(investments, debts, now, maturityMonthsAhead);
}
