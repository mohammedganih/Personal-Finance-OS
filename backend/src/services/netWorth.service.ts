import { prisma } from '../lib/prisma';

/**
 * Record-on-read, mirroring investmentIntelligence.service's
 * recordDailySnapshot: each dashboard-overview fetch upserts today's net
 * worth. There is no other source of net-worth history in this schema --
 * account balances and debt are current-value-only -- so this is where
 * real tracking starts, not a backfill of anything that existed before.
 */
export async function recordNetWorthSnapshot(
  userId: string,
  totals: { netWorth: number; totalAssets: number; totalLiabilities: number },
): Promise<void> {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  await prisma.netWorthSnapshot.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, ...totals },
    update: { ...totals },
  });
}

export interface NetWorthTrendPoint {
  date: Date;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
}

export async function getNetWorthTrend(userId: string, days = 180): Promise<NetWorthTrendPoint[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const snapshots = await prisma.netWorthSnapshot.findMany({
    where: { userId, date: { gte: since } },
    orderBy: { date: 'asc' },
  });
  return snapshots.map((s) => ({
    date: s.date,
    netWorth: Number(s.netWorth),
    totalAssets: Number(s.totalAssets),
    totalLiabilities: Number(s.totalLiabilities),
  }));
}
