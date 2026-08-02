import { prisma } from '../lib/prisma';

/**
 * Record-on-read, mirroring netWorth.service's recordNetWorthSnapshot: each
 * debt-overview fetch upserts today's total loan + credit card outstanding.
 * There's no other source of this history -- NetWorthSnapshot's
 * totalLiabilities excludes credit card revolving balances and isn't
 * loan-scoped -- so this is where real tracking starts, not a backfill.
 */
export async function recordDebtSnapshot(userId: string, totalOutstanding: number): Promise<void> {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  await prisma.debtSnapshot.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, totalOutstanding },
    update: { totalOutstanding },
  });
}

export interface DebtTrendPoint {
  date: Date;
  totalOutstanding: number;
}

export async function getDebtTrend(userId: string, days = 180): Promise<DebtTrendPoint[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const snapshots = await prisma.debtSnapshot.findMany({
    where: { userId, date: { gte: since } },
    orderBy: { date: 'asc' },
  });
  return snapshots.map((s) => ({ date: s.date, totalOutstanding: Number(s.totalOutstanding) }));
}
