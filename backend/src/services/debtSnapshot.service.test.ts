import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import * as authService from './auth.service';
import { recordDebtSnapshot, getDebtTrend } from './debtSnapshot.service';

describe('debtSnapshot.service integration', () => {
  beforeEach(resetDatabase);
  afterAll(() => prisma.$disconnect());

  async function setupUser() {
    const { user } = await authService.register({
      name: 'Test User', email: `debttest-${Date.now()}-${Math.random()}@example.com`, password: 'Password123',
    });
    return user.id;
  }

  it('recordDebtSnapshot upserts idempotently within the same day', async () => {
    const userId = await setupUser();
    await recordDebtSnapshot(userId, 500000);
    await recordDebtSnapshot(userId, 480000);

    const trend = await getDebtTrend(userId, 30);
    expect(trend).toHaveLength(1);
    expect(trend[0].totalOutstanding).toBe(480000);
  });

  it('getDebtTrend returns snapshots in ascending date order', async () => {
    const userId = await setupUser();
    const today = new Date();
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const twoDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2);

    await prisma.debtSnapshot.createMany({
      data: [
        { userId, date: twoDaysAgo, totalOutstanding: 520000 },
        { userId, date: yesterday, totalOutstanding: 510000 },
      ],
    });
    await recordDebtSnapshot(userId, 500000);

    const trend = await getDebtTrend(userId, 30);
    expect(trend).toHaveLength(3);
    expect(trend.map((t) => t.totalOutstanding)).toEqual([520000, 510000, 500000]);
  });

  it('getDebtTrend excludes snapshots older than the requested window', async () => {
    const userId = await setupUser();
    const today = new Date();
    const farBack = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 200);

    await prisma.debtSnapshot.create({
      data: { userId, date: farBack, totalOutstanding: 999999 },
    });
    await recordDebtSnapshot(userId, 500000);

    const trend = await getDebtTrend(userId, 180);
    expect(trend).toHaveLength(1);
    expect(trend[0].totalOutstanding).toBe(500000);
  });
});
