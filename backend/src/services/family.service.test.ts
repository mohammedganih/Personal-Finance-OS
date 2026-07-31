import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import * as authService from './auth.service';
import { simulatePayoff, getMemberAnalytics } from './family.service';

describe('simulatePayoff', () => {
  it('pays off a zero-interest loan in exactly balance/emi months', () => {
    const result = simulatePayoff([{ remainingBalance: 10000, emi: 1000, interestRate: 0 }], 0);
    expect(result.months).toBe(10);
    expect(result.totalInterest).toBe(0);
  });

  it('accrues interest when the rate is nonzero', () => {
    const result = simulatePayoff([{ remainingBalance: 10000, emi: 1000, interestRate: 12 }], 0);
    expect(result.totalInterest).toBeGreaterThan(0);
  });

  it('total interest paying only minimums is order-independent', () => {
    const loans = [
      { remainingBalance: 20000, emi: 1000, interestRate: 24 },
      { remainingBalance: 5000, emi: 200, interestRate: 6 },
    ];
    const forward = simulatePayoff(loans, 0);
    const reversed = simulatePayoff([...loans].reverse(), 0);
    expect(forward.totalInterest).toBeCloseTo(reversed.totalInterest, 4);
  });

  it('avalanche order (highest interest first) never costs more total interest than snowball order', () => {
    const avalancheOrder = [
      { remainingBalance: 20000, emi: 1000, interestRate: 24 },
      { remainingBalance: 5000, emi: 200, interestRate: 6 },
    ];
    const snowballOrder = [
      { remainingBalance: 5000, emi: 200, interestRate: 6 },
      { remainingBalance: 20000, emi: 1000, interestRate: 24 },
    ];
    const avalanche = simulatePayoff(avalancheOrder, 1000);
    const snowball = simulatePayoff(snowballOrder, 1000);
    expect(avalanche.totalInterest).toBeLessThanOrEqual(snowball.totalInterest);
  });

  it('extra payment never increases months to pay off', () => {
    const loans = [{ remainingBalance: 20000, emi: 1000, interestRate: 24 }];
    const noExtra = simulatePayoff(loans, 0);
    const withExtra = simulatePayoff(loans, 2000);
    expect(withExtra.months).toBeLessThanOrEqual(noExtra.months);
  });

  it('returns a month-by-month balance schedule starting at the initial total and ending at zero', () => {
    const loans = [
      { remainingBalance: 20000, emi: 1000, interestRate: 24 },
      { remainingBalance: 5000, emi: 200, interestRate: 6 },
    ];
    const result = simulatePayoff(loans, 0);
    expect(result.schedule[0]).toBe(25000);
    expect(result.schedule).toHaveLength(result.months + 1);
    expect(result.schedule[result.schedule.length - 1]).toBeLessThanOrEqual(0.01);
  });

  it('a schedule with extra payment reaches zero in fewer entries than one without', () => {
    const loans = [{ remainingBalance: 20000, emi: 1000, interestRate: 24 }];
    const noExtra = simulatePayoff(loans, 0);
    const withExtra = simulatePayoff(loans, 2000);
    expect(withExtra.schedule.length).toBeLessThanOrEqual(noExtra.schedule.length);
  });
});

describe('getMemberAnalytics (split-overlay regression)', () => {
  // txnShare/invShare used to read splitMemberId/splitRatio straight off the
  // Transaction/Investment row; they now look them up from the OwnershipSplit
  // overlay table. This locks in the same per-member math either way.

  beforeEach(resetDatabase);
  afterAll(() => prisma.$disconnect());

  it('splits a transaction and an investment 60/40 between two members, with the rest unassigned', async () => {
    const { user } = await authService.register({
      name: 'Test User', email: `test-${Date.now()}-${Math.random()}@example.com`, password: 'Password123',
    });
    const alice = await prisma.familyMember.create({ data: { userId: user.id, name: 'Alice' } });
    const bob   = await prisma.familyMember.create({ data: { userId: user.id, name: 'Bob' } });

    // Alice earns 1000, split 60/40 with Bob.
    const txn = await prisma.transaction.create({
      data: { userId: user.id, type: 'INCOME', amount: 1000, date: new Date(), memberId: alice.id },
    });
    await prisma.ownershipSplit.create({
      data: { userId: user.id, entityType: 'TRANSACTION', entityId: txn.id, secondaryMemberId: bob.id, ratio: 60 },
    });

    // Alice holds an investment worth 500 (10 units @ 50), split 60/40 with Bob.
    const inv = await prisma.investment.create({
      data: {
        userId: user.id, assetName: 'Test Fund', assetType: 'STOCK',
        quantity: 10, buyPrice: 50, currentPrice: 50, purchaseDate: new Date(), memberId: alice.id,
      },
    });
    await prisma.ownershipSplit.create({
      data: { userId: user.id, entityType: 'INVESTMENT', entityId: inv.id, secondaryMemberId: bob.id, ratio: 60 },
    });

    // An unassigned transaction (no memberId at all) should count toward neither member.
    await prisma.transaction.create({
      data: { userId: user.id, type: 'EXPENSE', amount: 250, date: new Date() },
    });

    const { breakdown, unassignedExpenses } = await getMemberAnalytics(user.id);
    const aliceRow = breakdown.find((b) => b.member.id === alice.id)!;
    const bobRow   = breakdown.find((b) => b.member.id === bob.id)!;

    expect(aliceRow.totalIncome).toBeCloseTo(600, 2);   // 1000 * 60%
    expect(bobRow.totalIncome).toBeCloseTo(400, 2);      // 1000 * 40%
    expect(aliceRow.investmentValue).toBeCloseTo(300, 2); // 500 * 60%
    expect(bobRow.investmentValue).toBeCloseTo(200, 2);   // 500 * 40%
    expect(unassignedExpenses).toBeCloseTo(250, 2);
  });
});
