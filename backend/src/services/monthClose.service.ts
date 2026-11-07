import { prisma } from '../lib/prisma';
import { signedDelta } from '../lib/accountBalance';
import { shiftMonth } from '../lib/cardPaymentSchedule';
import { currentMonth } from '../schedule/dueItems';
import { getBalanceSheet } from '../metrics';
import { getMonthSummary, Totals } from './monthSummary.service';

// Month close: the month sheet frozen at month end, plus net worth, debt and
// bank balances as they stood then. Home compares today's net worth with the
// last close; Month history (later) lists them side by side.

const round = (n: number) => Math.round(n * 100) / 100;

/** The sheet totals kept for each person (and combined); the item lists are not stored. */
export function sheetTotals(t: Totals) {
  return {
    salary: t.salary, loans: t.loans.total, investments: t.investments.total, bills: t.bills.total,
    cardSpending: t.cardSpending, left: t.left, free: t.free, spentSoFar: t.spentSoFar.total, stillFree: t.stillFree,
  };
}

/**
 * Net worth, debt and bank balances at the end of `month`, from today's figures
 * rolled back through the ledger: every bank entry dated after month end is
 * undone, and loan principal repaid after it is added back to the debt.
 * Investments, card debt and money lent or borrowed are taken as they are today.
 */
export async function positionAtMonthEnd(userId: string, month: string, now = new Date()) {
  const end = new Date(`${shiftMonth(month, 1)}-01T00:00:00+05:30`);
  const [sheet, accounts, later, principalAfter, prepaidAfter] = await Promise.all([
    getBalanceSheet(userId, now),
    prisma.account.findMany({ where: { userId, type: { not: 'CREDIT_CARD' } }, select: { id: true, name: true, balance: true }, orderBy: { createdAt: 'asc' } }),
    prisma.transaction.findMany({ where: { userId, accountId: { not: null }, date: { gte: end } }, select: { accountId: true, type: true, amount: true } }),
    prisma.transaction.aggregate({ where: { userId, sourceType: 'LOAN', description: { startsWith: 'EMI Principal' }, date: { gte: end } }, _sum: { amount: true } }),
    prisma.loanEvent.aggregate({ where: { userId, type: 'PREPAYMENT', date: { gte: end } }, _sum: { amount: true } }),
  ]);
  const movedAfter = new Map<string, number>();
  for (const t of later) movedAfter.set(t.accountId!, (movedAfter.get(t.accountId!) ?? 0) + signedDelta(t.type, Number(t.amount)));
  const balances = accounts.map((a) => ({ accountId: a.id, name: a.name, balance: round(Number(a.balance) - (movedAfter.get(a.id) ?? 0)) }));
  const bankThen = round(balances.reduce((s, b) => s + b.balance, 0));
  const repaidAfter = Number(principalAfter._sum.amount ?? 0) + Number(prepaidAfter._sum.amount ?? 0);
  const totalDebt = round(sheet.totalDebt + repaidAfter);
  const netWorth = round(sheet.netWorth - (sheet.bankBalance - bankThen) - repaidAfter);
  return { netWorth, totalDebt, balances };
}

/** Freezes `month` for the household (replacing an earlier close of the same month). */
export async function closeMonth(userId: string, month: string, options: { approximate?: boolean; now?: Date } = {}) {
  const now = options.now ?? new Date();
  const [summary, position] = await Promise.all([getMonthSummary(userId, month), positionAtMonthEnd(userId, month, now)]);
  const data = {
    members: summary.members.map((m) => ({ memberId: m.memberId, name: m.name, salaryIsEstimate: m.salaryIsEstimate, ...sheetTotals(m) })),
    combined: sheetTotals(summary.combined),
    netWorth: position.netWorth, totalDebt: position.totalDebt, balances: position.balances,
    approximate: options.approximate ?? false, closedAt: now,
  };
  return prisma.monthClose.upsert({ where: { userId_month: { userId, month } }, create: { userId, month, ...data }, update: data });
}

/** Start of `month` (YYYY-MM) in India time. */
const monthStartIndia = (month: string) => new Date(`${month}-01T00:00:00+05:30`);

/**
 * Closes last month if it hasn't been, or if it was closed early by hand
 * (before the month ended). The daily job runs this; on the 1st it closes the
 * month just ended.
 */
export async function closePreviousMonthIfOpen(userId: string, now = new Date()) {
  const month = shiftMonth(currentMonth(now), -1);
  const existing = await prisma.monthClose.findUnique({ where: { userId_month: { userId, month } } });
  if (existing && existing.closedAt >= monthStartIndia(shiftMonth(month, 1))) return null;
  return closeMonth(userId, month, { now });
}

/** "Close month" on Month history: freezes this month now; the 1st of next month closes it again with the final figures. */
export async function closeCurrentMonth(userId: string, now = new Date()) {
  return closeMonth(userId, currentMonth(now), { now });
}

export interface HistoryRow {
  month: string;
  salary: number;
  /** Loan EMIs and bills. */
  commitments: number;
  /** Put into savings and investments. */
  saved: number;
  /** Card statements and everyday spending. */
  spent: number;
  /** Salary less all of the above. */
  leftOver: number;
  netWorth: number;
  totalDebt: number;
  approximate: boolean;
  /** Closed before the month ended (by hand); it is closed again on the 1st. */
  early: boolean;
  closedAt: Date;
}

type StoredTotals = Partial<ReturnType<typeof sheetTotals>>;

/** One closed month as a Month history row. */
export function historyRow(c: { month: string; combined: unknown; netWorth: unknown; totalDebt: unknown; approximate: boolean; closedAt: Date }): HistoryRow {
  const t = (c.combined ?? {}) as StoredTotals;
  const n = (v: unknown) => Number(v ?? 0);
  return {
    month: c.month,
    salary: n(t.salary),
    commitments: round(n(t.loans) + n(t.bills)),
    saved: n(t.investments),
    spent: round(n(t.cardSpending) + n(t.spentSoFar)),
    leftOver: n(t.stillFree),
    netWorth: n(c.netWorth), totalDebt: n(c.totalDebt),
    approximate: c.approximate,
    early: c.closedAt < monthStartIndia(shiftMonth(c.month, 1)),
    closedAt: c.closedAt,
  };
}

/** Every closed month, newest first, and whether this month is closed yet. */
export async function getMonthHistory(userId: string, now = new Date()) {
  const closes = await prisma.monthClose.findMany({ where: { userId }, orderBy: { month: 'desc' } });
  const month = currentMonth(now);
  return { currentMonth: month, currentClosed: closes.some((c) => c.month === month), months: closes.map(historyRow) };
}

/**
 * Closes every month from the household's first record up to last month that
 * has no close yet, marked approximate (worked out after the fact).
 */
export async function backfillMonthCloses(userId: string, now = new Date()) {
  const [firstTxn, firstSalary, existing] = await Promise.all([
    prisma.transaction.findFirst({ where: { userId }, orderBy: { date: 'asc' }, select: { date: true } }),
    prisma.monthlySalary.findFirst({ where: { userId }, orderBy: { month: 'asc' }, select: { month: true } }),
    prisma.monthClose.findMany({ where: { userId }, select: { month: true } }),
  ]);
  const starts = [firstTxn ? currentMonth(firstTxn.date) : null, firstSalary?.month ?? null].filter((m): m is string => !!m).sort();
  if (!starts.length) return [];
  const last = shiftMonth(currentMonth(now), -1);
  const done = new Set(existing.map((c) => c.month));
  const closed: string[] = [];
  for (let m = starts[0]; m <= last; m = shiftMonth(m, 1)) {
    if (done.has(m)) continue;
    await closeMonth(userId, m, { approximate: true, now });
    closed.push(m);
  }
  return closed;
}

/** The latest close before `month` (default: this month), for "since last month" comparisons. */
export async function lastClose(userId: string, month = currentMonth()) {
  return prisma.monthClose.findFirst({ where: { userId, month: { lt: month } }, orderBy: { month: 'desc' } });
}
