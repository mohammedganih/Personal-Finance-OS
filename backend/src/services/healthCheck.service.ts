import { prisma } from '../lib/prisma';
import { indiaDateKey, shiftMonth } from '../lib/cardPaymentSchedule';
import { currentMonth } from '../schedule/dueItems';
import { getMonthFlowsRange, savingsRate } from '../metrics';
import { getBuffer } from './buffer.service';
import { getMonthSummary } from './monthSummary.service';
import { cardDays, cycleForDueMonth } from './cardStatement.service';
import { getFinancialScore } from './analytics.service';
import { getDebtStrategy, getRecommendations } from './debtIntelligence.service';
import { getDiversification, getMaturityRadar } from './investmentIntelligence.service';
import { getFundingOpportunities } from './fundingIntelligence.service';
import { getAssetLoanInsights } from './assetLoanIntelligence.service';
import { STALE_VALUE_DAYS, valueStatus } from './investment.service';

// The Health check page: a few plain checks (buffer, debt to income, savings
// rate, maturities, out-of-date data), each with a level, plus the advice the
// older engines give (score, debt order, diversification, funding).

export type Level = 'good' | 'watch' | 'act';

const DAY = 24 * 60 * 60 * 1000;
const round = (n: number) => Math.round(n * 100) / 100;
/** Holdings valued by units × price, which go stale when the price isn't updated. */
const PRICED_TYPES = new Set(['STOCK', 'ETF', 'CRYPTO']);
export const STALE_PRICE_DAYS = STALE_VALUE_DAYS;
export const STALE_BALANCE_DAYS = 30;

export interface StaleItem {
  kind: 'PRICE' | 'CARD_STATEMENT' | 'MONTH_CLOSE' | 'BALANCES';
  id: string | null; name: string; detail: string; href: string; level: Level;
}

/** Pure: levels for the headline checks. */
export function bufferLevel(amount: number, target: number): Level {
  if (target <= 0 || amount >= target) return 'good';
  return amount >= target / 2 ? 'watch' : 'act';
}
/** EMIs as a share of take-home pay: up to 30% is comfortable, over 40% is stretched. */
export function debtToIncomeLevel(pct: number | null): Level {
  if (pct == null || pct <= 30) return 'good';
  return pct <= 40 ? 'watch' : 'act';
}
/** No income recorded in the last three months: worth a look, since the rate can't be worked out. */
export function savingsRateLevel(pct: number | null): Level {
  if (pct == null) return 'watch';
  if (pct >= 20) return 'good';
  return pct >= 10 ? 'watch' : 'act';
}

/**
 * Pure: SIPs and mutual funds with no value entered (valued at what was paid
 * in) or one older than STALE_VALUE_DAYS, and priced holdings (stocks, ETFs,
 * crypto) whose units or price haven't changed in that time.
 */
export function stalePrices(
  investments: { id: string; assetName: string; assetType: string; quantity: unknown; enteredValue: unknown; priceUpdatedAt: Date | null; updatedAt: Date }[],
  now: Date,
): StaleItem[] {
  const out: (StaleItem & { order: number })[] = [];
  for (const i of investments) {
    const base = { kind: 'PRICE' as const, id: i.id, name: i.assetName, level: 'watch' as const, href: '/investments' };
    const status = valueStatus(i, undefined, now);
    if (status) {
      if (status.atPaidIn) out.push({ ...base, order: 1e6, detail: 'Valued at the amount paid in. Enter its value (units × NAV, or the value) to see how it is doing.' });
      else if (status.needsUpdate) out.push({ ...base, order: status.daysSinceValued!, detail: `Value last entered ${status.daysSinceValued} days ago; instalments since are added on top.` });
      continue;
    }
    if (!PRICED_TYPES.has(i.assetType) || Number(i.quantity) <= 0) continue;
    const days = Math.floor((now.getTime() - (i.priceUpdatedAt ?? i.updatedAt).getTime()) / DAY);
    if (days >= STALE_PRICE_DAYS) out.push({ ...base, order: days, detail: `Units or price last updated ${days} days ago, so its value may be off.` });
  }
  return out.sort((a, b) => b.order - a.order).map(({ order: _order, ...s }) => s);
}

/** Pure: the latest statement date that has passed for each card, where no statement was entered for it. */
export function missingStatements(
  cards: { id: string; cardName: string; statementDate: Date | null; dueDate: Date }[],
  saved: { creditCardId: string; month: string }[],
  now: Date,
): StaleItem[] {
  const today = indiaDateKey(now);
  const month = today.slice(0, 7);
  const have = new Set(saved.map((s) => `${s.creditCardId}|${s.month}`));
  const out: StaleItem[] = [];
  for (const card of cards) {
    if (!card.statementDate) continue;
    const days = cardDays(card);
    // The newest cycle whose statement date is today or earlier.
    const cycle = [shiftMonth(month, 1), month, shiftMonth(month, -1)].map((m) => cycleForDueMonth(days, m)).find((c) => c.statementDate <= today);
    if (!cycle || have.has(`${card.id}|${cycle.month}`)) continue;
    out.push({
      kind: 'CARD_STATEMENT', id: card.id, name: card.cardName, level: 'act', href: '/credit-cards',
      detail: `The statement dated ${cycle.statementDate} (due ${cycle.dueDate}) hasn't been entered.`,
    });
  }
  return out;
}

/** Runs an advice engine; a failure leaves that part out instead of breaking the page. */
async function optional<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try { return await run(); } catch { return fallback; }
}

export async function getHealthCheck(userId: string, now = new Date()) {
  const month = currentMonth(now);
  const lastMonth = shiftMonth(month, -1);
  const [buffer, summary, flows, loans, cardEmis, investments, cards, statements, lastClose, lastCheckIn] = await Promise.all([
    getBuffer(userId, month),
    getMonthSummary(userId, month),
    getMonthFlowsRange(userId, lastMonth, 3),
    prisma.loan.findMany({ where: { userId, isActive: true }, select: { emi: true } }),
    prisma.cardEMI.findMany({ where: { userId, isArchived: false }, select: { emiAmount: true, emisPaid: true, tenureMonths: true } }),
    prisma.investment.findMany({ where: { userId }, select: { id: true, assetName: true, assetType: true, quantity: true, enteredValue: true, priceUpdatedAt: true, updatedAt: true } }),
    prisma.creditCard.findMany({ where: { userId, isActive: true }, select: { id: true, cardName: true, statementDate: true, dueDate: true } }),
    prisma.cardStatement.findMany({ where: { userId }, select: { creditCardId: true, month: true } }),
    prisma.monthClose.findUnique({ where: { userId_month: { userId, month: lastMonth } }, select: { month: true } }),
    prisma.userSettings.findUnique({ where: { userId }, select: { balancesCheckedAt: true } }),
  ]);

  // Buffer: months of commitments the buffer covers.
  const monthsCovered = buffer.monthlyCommitments > 0 ? round(buffer.amount / buffer.monthlyCommitments) : null;

  // Debt to income: this month's EMIs (loans and card EMIs still running) over take-home pay.
  const monthlyEmis = round(
    loans.reduce((s, l) => s + Number(l.emi), 0)
    + cardEmis.filter((e) => e.emisPaid < e.tenureMonths).reduce((s, e) => s + Number(e.emiAmount), 0),
  );
  const withIncome = flows.filter((f) => f.income > 0);
  const avgIncome = withIncome.length ? withIncome.reduce((s, f) => s + f.income, 0) / withIncome.length : 0;
  const income = summary.combined.salary > 0 ? summary.combined.salary : round(avgIncome);
  const dtiPct = income > 0 ? round((monthlyEmis / income) * 100) : null;

  // Savings rate: the last three full months, from the ledger.
  const months = flows.map((f) => ({ month: f.month, income: round(f.income), rate: f.income > 0 ? round(savingsRate(f)) : null }));
  const rated = months.filter((m) => m.rate != null);
  const avgRate = rated.length ? round(rated.reduce((s, m) => s + m.rate!, 0) / rated.length) : null;

  const stale: StaleItem[] = [
    ...missingStatements(cards, statements, now),
    ...stalePrices(investments, now),
  ];
  if (!lastClose) {
    stale.push({ kind: 'MONTH_CLOSE', id: null, name: `${lastMonth} isn't closed`, level: 'watch', href: '/history', detail: 'Close it on Month history so it shows up in the trend.' });
  }
  const checkedAt = lastCheckIn?.balancesCheckedAt;
  const checkInDays = checkedAt ? Math.floor((now.getTime() - checkedAt.getTime()) / DAY) : null;
  if (checkInDays == null || checkInDays >= STALE_BALANCE_DAYS) {
    stale.push({
      kind: 'BALANCES', id: null, name: 'Bank balances', level: 'watch', href: '/net-worth',
      detail: checkInDays == null ? 'Never checked against the bank. A check-in on Net worth fixes any drift.' : `Last checked against the bank ${checkInDays} days ago.`,
    });
  }

  const [score, recommendations, strategy, diversification, maturities, funding, assetLoans] = await Promise.all([
    optional(() => getFinancialScore(userId), null),
    optional(() => getRecommendations(userId), []),
    optional(() => getDebtStrategy(userId, 5000), null),
    optional(() => getDiversification(userId), null),
    optional(() => getMaturityRadar(userId, 6), []),
    optional(() => getFundingOpportunities(userId, 6), []),
    optional(() => getAssetLoanInsights(userId), []),
  ]);

  return {
    month,
    buffer: {
      amount: buffer.amount, target: buffer.target, targetIsDefault: buffer.targetIsDefault,
      monthlyCommitments: buffer.monthlyCommitments, monthsCovered, level: bufferLevel(buffer.amount, buffer.target),
    },
    debtToIncome: { monthlyEmis, income, incomeIsSalary: summary.combined.salary > 0, pct: dtiPct, level: debtToIncomeLevel(dtiPct) },
    savingsRate: { months, average: avgRate, level: savingsRateLevel(avgRate) },
    maturities: maturities.map((m) => ({ ...m, daysAway: Math.ceil((new Date(m.maturityDate).getTime() - now.getTime()) / DAY) })),
    stale,
    advice: {
      score,
      recommendations,
      strategy: strategy && strategy.debts.length ? {
        extraPayment: strategy.extraPayment, bestStrategy: strategy.bestStrategy, baseMonths: strategy.baseMonths,
        monthsWithExtra: strategy.bestStrategy === 'avalanche' ? strategy.avalancheMonthsWithExtra : strategy.snowballMonthsWithExtra,
        interestSaved: strategy.totalInterestSaved, interestRemaining: strategy.totalInterestRemaining,
        order: (strategy.bestStrategy === 'avalanche' ? strategy.avalancheOrder : strategy.snowballOrder)
          .map((id) => strategy.debts.find((d) => d.id === id)?.name).filter((n): n is string => !!n),
      } : null,
      diversification: diversification?.warnings ?? [],
      funding: funding.slice(0, 3),
      assetLoans: assetLoans.slice(0, 4),
    },
  };
}

export type HealthCheck = Awaited<ReturnType<typeof getHealthCheck>>;
