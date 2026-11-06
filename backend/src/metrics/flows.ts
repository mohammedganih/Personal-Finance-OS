import type { TransactionKind } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { monthOf } from '../lib/ledger';

/** Money in and out for one month, by what it was for. Transfers and adjustments are not flows. */
export interface MonthFlows {
  month: string;
  income: number;
  spend: number;
  save: number;
  debt: number;
}

/** Ledger kinds that are real money in or out (transfers and balance corrections are not). */
export const FLOW_KINDS: TransactionKind[] = ['INCOME', 'SPEND', 'SAVE', 'DEBT'];
/** Prisma filter that leaves out transfers between own accounts and balance corrections. */
export const NOT_MOVES = { kind: { in: FLOW_KINDS } };

/** First instant of a `YYYY-MM` month in India time. */
export function monthStart(month: string): Date {
  return new Date(`${month}-01T00:00:00+05:30`);
}
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Pure: buckets ledger rows into months. */
export function bucketFlows(rows: { kind: TransactionKind; amount: unknown; date: Date }[], months: string[]): MonthFlows[] {
  const byMonth = new Map(months.map((m) => [m, { month: m, income: 0, spend: 0, save: 0, debt: 0 }]));
  for (const r of rows) {
    const bucket = byMonth.get(monthOf(r.date));
    if (!bucket) continue;
    const amount = Number(r.amount);
    if (r.kind === 'INCOME') bucket.income += amount;
    else if (r.kind === 'SPEND') bucket.spend += amount;
    else if (r.kind === 'SAVE') bucket.save += amount;
    else if (r.kind === 'DEBT') bucket.debt += amount;
  }
  return months.map((m) => byMonth.get(m)!);
}

/** Flows for `count` months ending with `lastMonth` (oldest first), in one query. */
export async function getMonthFlowsRange(userId: string, lastMonth: string, count: number): Promise<MonthFlows[]> {
  const months = Array.from({ length: count }, (_, i) => addMonths(lastMonth, i - (count - 1)));
  const rows = await prisma.transaction.findMany({
    where: { userId, ...NOT_MOVES, date: { gte: monthStart(months[0]), lt: monthStart(addMonths(lastMonth, 1)) } },
    select: { kind: true, amount: true, date: true },
  });
  return bucketFlows(rows, months);
}

export async function getMonthFlows(userId: string, month: string): Promise<MonthFlows> {
  return (await getMonthFlowsRange(userId, month, 1))[0];
}

/** Money out that is gone: spending plus debt repayments (saving is kept). */
export const outgoings = (f: MonthFlows) => f.spend + f.debt;

/** Share of income left after spending and debt repayments, in %. 0 when there is no income. */
export function savingsRate(f: MonthFlows): number {
  return f.income > 0 ? ((f.income - outgoings(f)) / f.income) * 100 : 0;
}
