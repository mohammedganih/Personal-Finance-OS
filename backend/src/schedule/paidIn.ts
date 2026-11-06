import { prisma } from '../lib/prisma';
import { shiftMonth } from '../lib/cardPaymentSchedule';
import { currentMonth, instalmentFor, RECURRING_INVESTMENT_TYPES } from './dueItems';

// What has actually gone into a SIP, RD or gold scheme. Months with a recorded
// decision count what was recorded (a skip counts nothing). Months before the
// app started tracking it count the scheduled instalment, honouring pauses and
// amount changes. Months since tracking began with nothing recorded count
// nothing: they are still due.

type Recurring = { id: string; purchaseDate: Date; monthlyAmount: unknown; pauseFrom?: string | null; pauseUntil?: string | null; nextMonthlyAmount?: unknown; nextAmountFrom?: string | null; maturityDate?: Date | null };
type Record_ = { period: string; status: string; amount: unknown };

const round = (n: number) => Math.round(n * 100) / 100;

/** Pure: money paid into one recurring investment up to (and including) `month`. */
export function paidIntoInvestment(inv: Recurring, records: Record_[], month: string): number {
  const start = currentMonth(inv.purchaseDate);
  const last = inv.maturityDate && currentMonth(inv.maturityDate) < month ? currentMonth(inv.maturityDate) : month;
  const byMonth = new Map(records.map((r) => [r.period, r]));
  const firstRecorded = records.map((r) => r.period).sort()[0] ?? null;
  let total = 0;
  for (let m = start; m <= last; m = shiftMonth(m, 1)) {
    const rec = byMonth.get(m);
    if (rec) { if (rec.status !== 'SKIPPED') total += Number(rec.amount ?? 0); continue; }
    // Before tracking began: assume the schedule was kept. With no records at all, up to last month.
    const beforeTracking = firstRecorded ? m < firstRecorded : m < month;
    if (beforeTracking) {
      const i = instalmentFor(inv, m);
      if (!i.paused) total += i.amount;
    }
  }
  return round(total);
}

/** Paid-in totals for every SIP, RD and gold scheme of the household. */
export async function paidInByInvestment(userId: string, now = new Date()): Promise<Map<string, number>> {
  const month = currentMonth(now);
  const [investments, records] = await Promise.all([
    prisma.investment.findMany({ where: { userId, assetType: { in: RECURRING_INVESTMENT_TYPES as never } } }),
    prisma.dueStatus.findMany({ where: { userId, itemType: 'INVESTMENT' }, select: { itemId: true, period: true, status: true, amount: true } }),
  ]);
  return new Map(investments.map((inv) => [inv.id, paidIntoInvestment(inv, records.filter((r) => r.itemId === inv.id), month)]));
}
