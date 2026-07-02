import { Investment } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { addMonthsClamped } from '../lib/dateMath';
import { computeInvestmentValue, getPortfolioSummary } from './investment.service';

// ── XIRR (annualized return) ────────────────────────────────────────────────

export interface CashFlow {
  date: Date;
  amount: number; // negative = money out (invested), positive = money in (current value)
}

const XIRR_MAX_ITERATIONS = 100;
const XIRR_TOLERANCE = 1e-7;
const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

/**
 * Newton-Raphson XIRR solver: the annualized rate r such that the present
 * value of every cashflow (discounted from the earliest date) sums to zero.
 * A single-outflow/single-inflow pair (every lump-sum or FD holding) has a
 * closed-form solution and always converges; installment holdings (SIP, RD,
 * gold scheme) have N monthly outflows plus one inflow today and need the
 * iterative solver. Returns null rather than a misleading number when there
 * isn't enough data or the solver doesn't converge.
 */
export function calculateXIRR(cashflows: CashFlow[]): number | null {
  if (cashflows.length < 2) return null;
  const sorted = [...cashflows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const t0 = sorted[0].date.getTime();
  const years = sorted.map((cf) => (cf.date.getTime() - t0) / MS_PER_YEAR);

  if (years[years.length - 1] <= 0) return null; // no time elapsed to annualize over

  if (sorted.length === 2 && sorted[0].amount < 0 && sorted[1].amount > 0) {
    const ratio = sorted[1].amount / -sorted[0].amount;
    return ratio > 0 ? Math.pow(ratio, 1 / years[1]) - 1 : null;
  }

  let rate = 0.15;
  for (let i = 0; i < XIRR_MAX_ITERATIONS; i++) {
    let f = 0;
    let fPrime = 0;
    for (let j = 0; j < sorted.length; j++) {
      const factor = Math.pow(1 + rate, years[j]);
      if (!Number.isFinite(factor) || factor === 0) return null;
      f += sorted[j].amount / factor;
      fPrime -= (years[j] * sorted[j].amount) / (factor * (1 + rate));
    }
    if (Math.abs(fPrime) < 1e-12) return null;
    const newRate = rate - f / fPrime;
    if (!Number.isFinite(newRate) || newRate <= -1) return null;
    if (Math.abs(newRate - rate) < XIRR_TOLERANCE) return newRate;
    rate = newRate;
  }
  return null; // did not converge within max iterations
}

const INSTALLMENT_TYPES = new Set(['SIP', 'RECURRING_DEPOSIT', 'GOLD_SCHEME']);

/**
 * Builds the real cashflow history for one holding. Installment types get
 * one outflow per elapsed month (their actual contribution schedule) plus
 * today's value as the final inflow; lump-sum types (and FDs) get a single
 * outflow/inflow pair.
 */
export function buildCashflows(inv: Investment, now: Date): CashFlow[] {
  const { investedValue, currentValue } = computeInvestmentValue(inv, now);
  if (investedValue <= 0) return [];

  const monthly = inv.monthlyAmount ? Number(inv.monthlyAmount) : 0;

  if (INSTALLMENT_TYPES.has(inv.assetType) && monthly > 0) {
    const monthsElapsed = monthDiff(inv.purchaseDate, now);
    if (monthsElapsed <= 0) return [];
    const cashflows: CashFlow[] = [];
    for (let m = 0; m < monthsElapsed; m++) {
      cashflows.push({ date: addMonths(inv.purchaseDate, m), amount: -monthly });
    }
    cashflows.push({ date: now, amount: currentValue });
    return cashflows;
  }

  return [
    { date: inv.purchaseDate, amount: -investedValue },
    { date: now, amount: currentValue },
  ];
}

export function getAnnualizedReturn(inv: Investment, now: Date): number | null {
  return calculateXIRR(buildCashflows(inv, now));
}

export function getPortfolioAnnualizedReturn(investments: Investment[], now: Date): number | null {
  const all: CashFlow[] = investments.flatMap((inv) => buildCashflows(inv, now));
  return all.length >= 2 ? calculateXIRR(all) : null;
}

export interface HoldingReturn {
  investmentId: string;
  assetName: string;
  xirr: number | null;
}

export async function getAnnualizedReturns(userId: string): Promise<{ overall: number | null; byHolding: HoldingReturn[] }> {
  const investments = await prisma.investment.findMany({ where: { userId } });
  const now = new Date();
  return {
    overall: getPortfolioAnnualizedReturn(investments, now),
    byHolding: investments.map((inv) => ({ investmentId: inv.id, assetName: inv.assetName, xirr: getAnnualizedReturn(inv, now) })),
  };
}

function monthDiff(from: Date, to: Date): number {
  return Math.max(0, (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()));
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

// ── Portfolio trend (recorded, not backfilled) ──────────────────────────────

/**
 * Upserts today's portfolio totals. There's no way to honestly reconstruct
 * history for price-tracked holdings (no NAV/price history is stored) --
 * rather than fabricate a backdated trend via interpolation, this records
 * one real data point per day going forward, called on every portfolio
 * summary fetch so the trend fills in naturally as the app is used.
 */
export async function recordDailySnapshot(
  userId: string,
  totals: { totalInvested: number; totalCurrent: number; totalPnl: number },
): Promise<void> {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  await prisma.investmentSnapshot.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, ...totals },
    update: { ...totals },
  });
}

export interface TrendPoint {
  date: Date;
  totalInvested: number;
  totalCurrent: number;
  totalPnl: number;
}

export async function getPortfolioTrend(userId: string, days = 180): Promise<TrendPoint[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const snapshots = await prisma.investmentSnapshot.findMany({
    where: { userId, date: { gte: since } },
    orderBy: { date: 'asc' },
  });
  return snapshots.map((s) => ({
    date: s.date,
    totalInvested: Number(s.totalInvested),
    totalCurrent: Number(s.totalCurrent),
    totalPnl: Number(s.totalPnl),
  }));
}

// ── Investment calendar (upcoming SIP/RD/gold-scheme debits) ───────────────

export interface InvestmentCalendarEntry {
  date: Date;
  investmentId: string;
  assetName: string;
  assetType: string;
  amount: number;
}

/**
 * Projects upcoming installment debits for SIP/RD/gold-scheme holdings,
 * mirroring the debt module's EMI Calendar. The day-of-month is inferred
 * from purchaseDate since there's no separate due-day field.
 */
export function buildInvestmentCalendar(
  investments: { id: string; assetName: string; assetType: string; purchaseDate: Date; monthlyAmount: number | null }[],
  monthsAhead: number,
  now: Date,
): InvestmentCalendarEntry[] {
  const entries: InvestmentCalendarEntry[] = [];
  const horizonEnd = new Date(now.getFullYear(), now.getMonth() + monthsAhead, 0, 23, 59, 59);

  for (const inv of investments) {
    if (!INSTALLMENT_TYPES.has(inv.assetType) || !inv.monthlyAmount) continue;
    const anchorDay = inv.purchaseDate.getDate();
    let cursor = new Date(now.getFullYear(), now.getMonth(), Math.min(anchorDay, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()));
    if (cursor < now) cursor = addMonthsClamped(cursor, 1, anchorDay);
    let count = 0;
    while (cursor <= horizonEnd && count < monthsAhead) {
      entries.push({ date: new Date(cursor), investmentId: inv.id, assetName: inv.assetName, assetType: inv.assetType, amount: inv.monthlyAmount });
      cursor = addMonthsClamped(cursor, 1, anchorDay);
      count++;
    }
  }

  entries.sort((a, b) => a.date.getTime() - b.date.getTime());
  return entries;
}

export async function getInvestmentCalendar(userId: string, monthsAhead = 3): Promise<InvestmentCalendarEntry[]> {
  const investments = await prisma.investment.findMany({
    where: { userId },
    select: { id: true, assetName: true, assetType: true, purchaseDate: true, monthlyAmount: true },
  });
  return buildInvestmentCalendar(
    investments.map((i) => ({ ...i, monthlyAmount: i.monthlyAmount ? Number(i.monthlyAmount) : null })),
    monthsAhead,
    new Date(),
  );
}

// ── Diversification & concentration ─────────────────────────────────────────

export type AssetClass = 'Equity' | 'Debt' | 'Gold' | 'Real Estate' | 'Crypto' | 'Other';

const ASSET_CLASS_MAP: Record<string, AssetClass> = {
  STOCK: 'Equity', MUTUAL_FUND: 'Equity', SIP: 'Equity', ETF: 'Equity',
  FIXED_DEPOSIT: 'Debt', RECURRING_DEPOSIT: 'Debt',
  GOLD: 'Gold', GOLD_SCHEME: 'Gold',
  REAL_ESTATE: 'Real Estate',
  CRYPTO: 'Crypto',
  OTHER: 'Other',
};

export interface DiversificationWarning {
  severity: 'warning' | 'info';
  message: string;
}

export interface DiversificationResult {
  classBreakdown: { assetClass: AssetClass; value: number; percentage: number }[];
  warnings: DiversificationWarning[];
}

/**
 * Pure function: buckets holdings into broad asset classes (a MUTUAL_FUND
 * and a SIP both carry equity risk even though they're different Prisma
 * asset types) and flags concentration -- one asset class or one single
 * holding dominating the portfolio. Both warnings only fire with 2+
 * holdings; a portfolio with exactly one holding is trivially "concentrated"
 * and that's not useful information.
 */
export function analyzeDiversification(portfolio: { assetType: string; assetName: string; currentValue: number }[]): DiversificationResult {
  const totalValue = portfolio.reduce((s, i) => s + i.currentValue, 0);
  const byClass = portfolio.reduce<Record<string, number>>((acc, i) => {
    const cls = ASSET_CLASS_MAP[i.assetType] ?? 'Other';
    acc[cls] = (acc[cls] ?? 0) + i.currentValue;
    return acc;
  }, {});

  const classBreakdown = Object.entries(byClass)
    .map(([assetClass, value]) => ({ assetClass: assetClass as AssetClass, value, percentage: totalValue > 0 ? (value / totalValue) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);

  const warnings: DiversificationWarning[] = [];
  if (totalValue > 0 && portfolio.length > 1) {
    const dominantClass = classBreakdown[0];
    if (dominantClass.percentage >= 70) {
      warnings.push({
        severity: 'warning',
        message: `${dominantClass.assetClass} makes up ${dominantClass.percentage.toFixed(0)}% of your portfolio — consider diversifying into other asset classes.`,
      });
    }

    const dominantHolding = [...portfolio].sort((a, b) => b.currentValue - a.currentValue)[0];
    const holdingPct = (dominantHolding.currentValue / totalValue) * 100;
    if (holdingPct >= 40) {
      warnings.push({
        severity: 'warning',
        message: `"${dominantHolding.assetName}" alone is ${holdingPct.toFixed(0)}% of your portfolio — a concentration risk if it underperforms.`,
      });
    }
  }

  return { classBreakdown, warnings };
}

export async function getDiversification(userId: string): Promise<DiversificationResult> {
  const { portfolio } = await getPortfolioSummary(userId);
  return analyzeDiversification(portfolio);
}

// ── Maturity radar ───────────────────────────────────────────────────────────

export interface MaturityEntry {
  investmentId: string;
  assetName: string;
  assetType: string;
  maturityDate: Date;
  maturityAmount: number | null;
}

/** Pure function: FDs/RDs/gold schemes maturing within the given window. */
export function getUpcomingMaturities(
  portfolio: { id: string; assetName: string; assetType: string; maturityDate: Date | null; maturityAmount: number | null }[],
  monthsAhead: number,
  now: Date,
): MaturityEntry[] {
  const horizonEnd = new Date(now.getFullYear(), now.getMonth() + monthsAhead, now.getDate(), 23, 59, 59);
  return portfolio
    .filter((i): i is typeof i & { maturityDate: Date } => i.maturityDate !== null && i.maturityDate >= now && i.maturityDate <= horizonEnd)
    .map((i) => ({ investmentId: i.id, assetName: i.assetName, assetType: i.assetType, maturityDate: i.maturityDate, maturityAmount: i.maturityAmount }))
    .sort((a, b) => a.maturityDate.getTime() - b.maturityDate.getTime());
}

export async function getMaturityRadar(userId: string, monthsAhead = 6): Promise<MaturityEntry[]> {
  const { portfolio } = await getPortfolioSummary(userId);
  return getUpcomingMaturities(portfolio, monthsAhead, new Date());
}
