import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error.middleware';
import { calculateEMISplit } from './loan.service';
import { addMonthsClamped } from '../lib/dateMath';
import { getDashboardOverview } from './dashboard.service';

// ── Amortization ─────────────────────────────────────────────────────────────

export interface LoanScheduleInput {
  principal: number;
  interestRate: number;
  emi: number;
  tenureMonths: number;
  startDate: Date;
}

export interface AmortizationRow {
  month: number;
  date: Date;
  openingBalance: number;
  interest: number;
  principal: number;
  closingBalance: number;
  cumulativeInterest: number;
  cumulativePrincipal: number;
}

/**
 * Pure function: the full month-by-month amortization schedule from day one
 * to payoff (or contracted tenure end, whichever comes first). Reuses
 * calculateEMISplit -- the same function payLoanEMI uses to split a real
 * payment -- so the schedule always agrees with what actually gets recorded.
 */
export function generateAmortizationSchedule(loan: LoanScheduleInput): AmortizationRow[] {
  const rows: AmortizationRow[] = [];
  const anchorDay = loan.startDate.getDate();
  let balance = loan.principal;
  let cumulativeInterest = 0;
  let cumulativePrincipal = 0;

  for (let month = 1; month <= loan.tenureMonths && balance > 0.5; month++) {
    const { interestPortion, actualPayment, newBalance } = calculateEMISplit(balance, loan.emi, loan.interestRate);
    // actualPayment (not the theoretical principalPortion) caps the final
    // installment at what's actually owed, so cumulativePrincipal always
    // sums to exactly the original loan principal.
    const principal = actualPayment - interestPortion;
    cumulativeInterest += interestPortion;
    cumulativePrincipal += principal;

    rows.push({
      month,
      date: addMonthsClamped(loan.startDate, month, anchorDay),
      openingBalance: balance,
      interest: interestPortion,
      principal,
      closingBalance: newBalance,
      cumulativeInterest,
      cumulativePrincipal,
    });

    balance = newBalance;
  }

  return rows;
}

/** Whole months between two dates (floor, never negative). */
function monthsBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()));
}

// ── Equity / LTV / ROI ───────────────────────────────────────────────────────

export interface AssetLoanInput {
  loanId: string;
  investmentId: string;
  assetName: string;
  assetType: string;
  purchasePrice: number;
  currentPropertyValue: number;
  ownershipPercent: number;
  expectedAppreciationRate: number | null;
  originalLoanAmount: number;
  remainingBalance: number;
  loan: LoanScheduleInput;
}

export interface AssetLoanSummary {
  loanId: string;
  investmentId: string;
  assetName: string;
  assetType: string;
  currentPropertyValue: number;
  purchasePrice: number;
  originalLoanAmount: number;
  remainingBalance: number;
  ownershipPercent: number;
  equity: number;
  unrealizedGain: number;
  loanToValue: number;
  principalPaid: number;
  interestPaid: number;
  totalInterestRemaining: number;
  monthsElapsed: number;
  roi: number;
  appreciationSincePurchasePct: number;
  annualizedAppreciationPct: number;
  projectedValueNextYear: number;
  principalPaidThisMonth: number;
  interestPaidThisMonth: number;
  interestShareOfEMIPct: number;
}

/**
 * Pure function: every asset-loan headline stat, derived from the schedule
 * and the asset's own recorded value -- nothing here is persisted, so it can
 * never drift from the Loan/Investment rows it was computed from.
 */
export function computeAssetLoanSummary(input: AssetLoanInput, now: Date): AssetLoanSummary {
  const schedule = generateAmortizationSchedule(input.loan);
  const monthsElapsed = Math.min(monthsBetween(input.loan.startDate, now), schedule.length);

  // principalPaid comes from the loan's actual remainingBalance -- real money
  // that has actually moved -- not from a theoretical schedule anchored to
  // wall-clock time. The two easily diverge: a loan is often added to the app
  // with real payments already behind it (remainingBalance < principal) on
  // the very day it's entered (startDate = today), which would otherwise
  // show zero principal/interest paid despite genuine prior repayment.
  // interestPaid is then read off the schedule row that reaches the same
  // cumulative principal, so it stays consistent with the real number.
  const principalPaid = Math.max(0, input.originalLoanAmount - input.remainingBalance);
  const progressIndex = principalPaid > 0.5 ? schedule.findIndex((r) => r.cumulativePrincipal >= principalPaid - 0.01) : -1;
  const progressRow = progressIndex >= 0 ? schedule[progressIndex] : schedule[schedule.length - 1];

  const interestPaid = principalPaid > 0.5 ? (progressRow?.cumulativeInterest ?? 0) : 0;
  const totalScheduledInterest = schedule.reduce((s, r) => s + r.interest, 0);
  const totalInterestRemaining = Math.max(0, totalScheduledInterest - interestPaid);

  const ownershipShare = input.ownershipPercent / 100;
  const ownedValue = input.currentPropertyValue * ownershipShare;
  const equity = ownedValue - input.remainingBalance;
  const unrealizedGain = ownedValue - input.purchasePrice * ownershipShare;
  const loanToValue = input.currentPropertyValue > 0 ? (input.remainingBalance / input.currentPropertyValue) * 100 : 0;

  const downPayment = Math.max(0, input.purchasePrice * ownershipShare - input.originalLoanAmount * ownershipShare);
  const cashInvested = downPayment + principalPaid;
  const roi = cashInvested > 0 ? ((equity - cashInvested) / cashInvested) * 100 : 0;

  const yearsOwned = Math.max(monthsElapsed / 12, 1 / 12);
  const appreciationSinceForPct = input.purchasePrice > 0 ? ((input.currentPropertyValue - input.purchasePrice) / input.purchasePrice) * 100 : 0;
  const annualizedAppreciationPct = input.purchasePrice > 0
    ? (Math.pow(input.currentPropertyValue / input.purchasePrice, 1 / yearsOwned) - 1) * 100
    : 0;

  const appreciationRateForProjection = input.expectedAppreciationRate ?? annualizedAppreciationPct;
  const projectedValueNextYear = input.currentPropertyValue * (1 + appreciationRateForProjection / 100);

  const principalPaidThisMonth = principalPaid > 0.5 ? (progressRow?.principal ?? 0) : 0;
  const interestPaidThisMonth = principalPaid > 0.5 ? (progressRow?.interest ?? 0) : 0;
  const emi = input.loan.emi;
  const interestShareOfEMIPct = emi > 0 ? (interestPaidThisMonth / emi) * 100 : 0;

  return {
    loanId: input.loanId,
    investmentId: input.investmentId,
    assetName: input.assetName,
    assetType: input.assetType,
    currentPropertyValue: input.currentPropertyValue,
    purchasePrice: input.purchasePrice,
    originalLoanAmount: input.originalLoanAmount,
    remainingBalance: input.remainingBalance,
    ownershipPercent: input.ownershipPercent,
    equity,
    unrealizedGain,
    loanToValue,
    principalPaid,
    interestPaid,
    totalInterestRemaining,
    monthsElapsed,
    roi,
    appreciationSincePurchasePct: appreciationSinceForPct,
    annualizedAppreciationPct,
    projectedValueNextYear,
    principalPaidThisMonth,
    interestPaidThisMonth,
    interestShareOfEMIPct,
  };
}

// ── Insights ─────────────────────────────────────────────────────────────────

export type AssetLoanInsightSeverity = 'positive' | 'info' | 'warning';

export interface AssetLoanInsight {
  severity: AssetLoanInsightSeverity;
  message: string;
  loanId: string;
}

/**
 * Pure function: turns one summary (+ the user's total net worth) into the
 * handful of plain-English observations the spec asks for. Skips anything
 * that isn't concretely computable (e.g. "this month" figures are omitted
 * once the loan is fully paid off, rather than showing a stale/zero number).
 */
export function generateAssetLoanInsights(summary: AssetLoanSummary, netWorth: number): AssetLoanInsight[] {
  const insights: AssetLoanInsight[] = [];

  if (summary.principalPaidThisMonth > 0) {
    insights.push({
      severity: 'positive',
      loanId: summary.loanId,
      message: `Your ${summary.assetName} equity increased by ₹${Math.round(summary.principalPaidThisMonth).toLocaleString('en-IN')} this month.`,
    });
  }

  if (summary.interestShareOfEMIPct > 0) {
    insights.push({
      severity: summary.interestShareOfEMIPct > 50 ? 'warning' : 'info',
      loanId: summary.loanId,
      message: `Only ${summary.interestShareOfEMIPct.toFixed(0)}% of your ${summary.assetName} EMI is interest.`,
    });
  }

  insights.push({
    severity: 'positive',
    loanId: summary.loanId,
    message: `You have built ₹${(summary.equity / 100000).toFixed(1)}L of equity in ${summary.assetName}.`,
  });

  if (Math.abs(summary.appreciationSincePurchasePct) >= 1) {
    insights.push({
      severity: summary.appreciationSincePurchasePct >= 0 ? 'positive' : 'warning',
      loanId: summary.loanId,
      message: `Your ${summary.assetName}'s market value ${summary.appreciationSincePurchasePct >= 0 ? 'increased' : 'decreased'} by ${Math.abs(summary.appreciationSincePurchasePct).toFixed(0)}% since purchase.`,
    });
  }

  if (netWorth > 0) {
    const contributionPct = (summary.equity / netWorth) * 100;
    if (contributionPct >= 1) {
      insights.push({
        severity: 'info',
        loanId: summary.loanId,
        message: `${summary.assetName} contributes ${contributionPct.toFixed(0)}% of your total net worth.`,
      });
    }
  }

  return insights;
}

// ── Orchestrators (I/O) ──────────────────────────────────────────────────────

interface LoadedLoan {
  id: string;
  name: string;
  principal: unknown;
  interestRate: unknown;
  emi: unknown;
  remainingBalance: unknown;
  tenureMonths: number;
  startDate: Date;
  linkedInvestment: {
    id: string;
    assetName: string;
    assetType: string;
    buyPrice: unknown;
    currentPrice: unknown;
    ownershipPercent: unknown;
    expectedAppreciationRate: unknown;
  } | null;
}

function toAssetLoanInput(loan: LoadedLoan): AssetLoanInput {
  if (!loan.linkedInvestment) throw createError('Loan is not linked to an asset', 400);
  const inv = loan.linkedInvestment;
  return {
    loanId: loan.id,
    investmentId: inv.id,
    assetName: inv.assetName,
    assetType: inv.assetType,
    purchasePrice: Number(inv.buyPrice),
    currentPropertyValue: Number(inv.currentPrice),
    ownershipPercent: inv.ownershipPercent ? Number(inv.ownershipPercent) : 100,
    expectedAppreciationRate: inv.expectedAppreciationRate ? Number(inv.expectedAppreciationRate) : null,
    originalLoanAmount: Number(loan.principal),
    remainingBalance: Number(loan.remainingBalance),
    loan: {
      principal: Number(loan.principal),
      interestRate: Number(loan.interestRate),
      emi: Number(loan.emi),
      tenureMonths: loan.tenureMonths,
      startDate: loan.startDate,
    },
  };
}

const LOAN_WITH_ASSET_INCLUDE = {
  linkedInvestment: {
    select: { id: true, assetName: true, assetType: true, buyPrice: true, currentPrice: true, ownershipPercent: true, expectedAppreciationRate: true },
  },
} as const;

async function loadLinkedLoan(userId: string, loanId: string): Promise<LoadedLoan> {
  const loan = await prisma.loan.findFirst({
    where: { id: loanId, userId },
    include: LOAN_WITH_ASSET_INCLUDE,
  });
  if (!loan) throw createError('Loan not found', 404);
  if (!loan.linkedInvestmentId) throw createError('Loan is not linked to an asset', 400);
  return loan;
}

export async function getAmortizationSchedule(userId: string, loanId: string): Promise<AmortizationRow[]> {
  const loan = await prisma.loan.findFirst({ where: { id: loanId, userId } });
  if (!loan) throw createError('Loan not found', 404);
  return generateAmortizationSchedule({
    principal: Number(loan.principal),
    interestRate: Number(loan.interestRate),
    emi: Number(loan.emi),
    tenureMonths: loan.tenureMonths,
    startDate: loan.startDate,
  });
}

export async function getAssetLoanSummary(userId: string, loanId: string): Promise<AssetLoanSummary> {
  const loan = await loadLinkedLoan(userId, loanId);
  return computeAssetLoanSummary(toAssetLoanInput(loan), new Date());
}

export async function getAllAssetLoanSummaries(userId: string): Promise<AssetLoanSummary[]> {
  const loans = await prisma.loan.findMany({
    where: { userId, linkedInvestmentId: { not: null } },
    include: LOAN_WITH_ASSET_INCLUDE,
  });
  const now = new Date();
  return loans.filter((l) => l.linkedInvestment).map((l) => computeAssetLoanSummary(toAssetLoanInput(l), now));
}

export async function getAssetLoanInsights(userId: string): Promise<AssetLoanInsight[]> {
  const [summaries, overview] = await Promise.all([
    getAllAssetLoanSummaries(userId),
    getDashboardOverview(userId),
  ]);
  return summaries.flatMap((s) => generateAssetLoanInsights(s, overview.netWorth));
}

export async function getHomeEquitySummary(userId: string) {
  const summaries = await getAllAssetLoanSummaries(userId);
  const totalEquity = summaries.reduce((s, x) => s + x.equity, 0);
  const totalPropertyValue = summaries.reduce((s, x) => s + x.currentPropertyValue * (x.ownershipPercent / 100), 0);
  const totalOutstanding = summaries.reduce((s, x) => s + x.remainingBalance, 0);
  const totalPrincipalPaid = summaries.reduce((s, x) => s + x.principalPaid, 0);
  const totalInterestPaid = summaries.reduce((s, x) => s + x.interestPaid, 0);
  const weightedLTV = totalPropertyValue > 0 ? (totalOutstanding / totalPropertyValue) * 100 : 0;

  return {
    assets: summaries,
    totalEquity,
    totalPropertyValue,
    totalOutstanding,
    totalPrincipalPaid,
    totalInterestPaid,
    weightedLTV,
  };
}
