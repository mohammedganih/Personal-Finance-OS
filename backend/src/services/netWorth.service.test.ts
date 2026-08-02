import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import * as authService from './auth.service';
import { recordNetWorthSnapshot, getNetWorthTrend } from './netWorth.service';

describe('netWorth.service integration', () => {
  beforeEach(resetDatabase);
  afterAll(() => prisma.$disconnect());

  async function setupUser() {
    const { user } = await authService.register({
      name: 'Test User', email: `nwtest-${Date.now()}-${Math.random()}@example.com`, password: 'Password123',
    });
    return user.id;
  }

  it('recordNetWorthSnapshot upserts idempotently within the same day', async () => {
    const userId = await setupUser();
    await recordNetWorthSnapshot(userId, { netWorth: 100000, totalAssets: 150000, totalLiabilities: 50000 });
    await recordNetWorthSnapshot(userId, { netWorth: 120000, totalAssets: 160000, totalLiabilities: 40000 });

    const trend = await getNetWorthTrend(userId, 30);
    expect(trend).toHaveLength(1);
    expect(trend[0].netWorth).toBe(120000);
    expect(trend[0].totalAssets).toBe(160000);
    expect(trend[0].totalLiabilities).toBe(40000);
  });

  it('getNetWorthTrend returns snapshots in ascending date order', async () => {
    const userId = await setupUser();
    const today = new Date();
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const twoDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2);

    await prisma.netWorthSnapshot.createMany({
      data: [
        { userId, date: twoDaysAgo, netWorth: 90000, totalAssets: 90000, totalLiabilities: 0 },
        { userId, date: yesterday, netWorth: 95000, totalAssets: 95000, totalLiabilities: 0 },
      ],
    });
    await recordNetWorthSnapshot(userId, { netWorth: 100000, totalAssets: 100000, totalLiabilities: 0 });

    const trend = await getNetWorthTrend(userId, 30);
    expect(trend).toHaveLength(3);
    expect(trend.map((t) => t.netWorth)).toEqual([90000, 95000, 100000]);
  });

  it('getNetWorthTrend excludes snapshots older than the requested window', async () => {
    const userId = await setupUser();
    const today = new Date();
    const farBack = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 200);

    await prisma.netWorthSnapshot.create({
      data: { userId, date: farBack, netWorth: 10000, totalAssets: 10000, totalLiabilities: 0 },
    });
    await recordNetWorthSnapshot(userId, { netWorth: 50000, totalAssets: 50000, totalLiabilities: 0 });

    const trend = await getNetWorthTrend(userId, 180);
    expect(trend).toHaveLength(1);
    expect(trend[0].netWorth).toBe(50000);
  });
});
