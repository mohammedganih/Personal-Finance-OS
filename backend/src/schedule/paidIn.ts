import { prisma } from '../lib/prisma';
import { dateInMonth, indiaDateKey, shiftMonth } from '../lib/cardPaymentSchedule';
import { currentMonth, instalmentFor, RECURRING_INVESTMENT_TYPES } from './dueItems';

// What has actually gone into a SIP, RD or gold scheme. Months with a recorded
// decision count what was recorded (a skip counts nothing). Months before the
// app started tracking it count the scheduled instalment, honouring pauses and
// amount changes. Months since tracking began with nothing recorded count
// nothing: they are still due.

type Recurring = {
  id: string; purchaseDate: Date; monthlyAmount: unknown; paymentDay?: number | null;
  pauseFrom?: string | null; pauseUntil?: string | null; nextMonthlyAmount?: unknown; nextAmountFrom?: string | null;
  maturityDate?: Date | null; priceUpdatedAt?: Date | null;
};
type Record_ = { period: string; status: string; amount: unknown; paidDate?: Date | null };

/** Money paid in, in total and since the holding's value was last entered. */
export interface PaidIn { total: number; sinceValued: number }

const round = (n: number) => Math.round(n * 100) / 100;

/** Pure: each instalment paid into one recurring investment up to (and including) `month`, with its date (YYYY-MM-DD). */
export function contributions(inv: Recurring, records: Record_[], month: string): { date: string; amount: number }[] {
  const start = currentMonth(inv.purchaseDate);
  const last = inv.maturityDate && currentMonth(inv.maturityDate) < month ? currentMonth(inv.maturityDate) : month;
  const day = inv.paymentDay ?? Number(indiaDateKey(inv.purchaseDate).slice(8, 10));
  const byMonth = new Map(records.map((r) => [r.period, r]));
  const firstRecorded = records.map((r) => r.period).sort()[0] ?? null;
  const out: { date: string; amount: number }[] = [];
  for (let m = start; m <= last; m = shiftMonth(m, 1)) {
    const rec = byMonth.get(m);
    if (rec) {
      if (rec.status !== 'SKIPPED') out.push({ date: rec.paidDate ? indiaDateKey(rec.paidDate) : dateInMonth(m, day), amount: Number(rec.amount ?? 0) });
      continue;
    }
    // Before tracking began: assume the schedule was kept. With no records at all, up to last month.
    const beforeTracking = firstRecorded ? m < firstRecorded : m < month;
    if (beforeTracking) {
      const i = instalmentFor(inv, m);
      if (!i.paused) out.push({ date: dateInMonth(m, day), amount: i.amount });
    }
  }
  return out;
}

/** Pure: money paid into one recurring investment up to (and including) `month`. */
export function paidIntoInvestment(inv: Recurring, records: Record_[], month: string): number {
  return round(contributions(inv, records, month).reduce((s, c) => s + c.amount, 0));
}

/**
 * Pure: total paid in, and the part paid after the value was last entered
 * (an instalment on the same day as the entry is taken as already in it).
 */
export function paidInWithSince(inv: Recurring, records: Record_[], month: string): PaidIn {
  const all = contributions(inv, records, month);
  const since = inv.priceUpdatedAt ? indiaDateKey(inv.priceUpdatedAt) : null;
  return {
    total: round(all.reduce((s, c) => s + c.amount, 0)),
    sinceValued: since ? round(all.filter((c) => c.date > since).reduce((s, c) => s + c.amount, 0)) : 0,
  };
}

/** Paid-in figures for every SIP, RD and gold scheme of the household. */
export async function paidInByInvestment(userId: string, now = new Date()): Promise<Map<string, PaidIn>> {
  const month = currentMonth(now);
  const [investments, records] = await Promise.all([
    prisma.investment.findMany({ where: { userId, assetType: { in: RECURRING_INVESTMENT_TYPES as never } } }),
    prisma.dueStatus.findMany({ where: { userId, itemType: 'INVESTMENT' }, select: { itemId: true, period: true, status: true, amount: true, paidDate: true } }),
  ]);
  return new Map(investments.map((inv) => [inv.id, paidInWithSince(inv, records.filter((r) => r.itemId === inv.id), month)]));
}
