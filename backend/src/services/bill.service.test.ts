import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import * as authService from './auth.service';
import * as billService from './bill.service';
import { toDateKey } from '../lib/billSchedule';

function isoDaysFromToday(days: number): string {
  const d = new Date();
  return toDateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
}

async function setupUser() {
  const { user } = await authService.register({
    name: 'Bill Tester',
    email: `bills-${Date.now()}-${Math.random()}@example.com`,
    password: 'Password123',
  });
  return user.id;
}

function baseBill(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Netflix',
    category: 'Entertainment',
    amount: 649,
    currency: 'INR',
    frequency: 'MONTHLY' as const,
    startDate: isoDaysFromToday(0),
    reminderDays: 3,
    autoDebit: true,
    tags: [],
    ...overrides,
  };
}

describe('bill.service integration', () => {
  beforeEach(resetDatabase);
  afterAll(() => prisma.$disconnect());

  it('creates a bill with computed monthly equivalent and next due date', async () => {
    const userId = await setupUser();
    const bill = await billService.createBill(userId, baseBill());

    expect(bill.monthlyEquivalent).toBe(649);
    expect(bill.effectiveStatus).toBe('ACTIVE');
    expect(toDateKey(bill.nextDueDate!)).toBe(isoDaysFromToday(0));
    expect(bill.dueInDays).toBe(0);
  });

  it('paying an occurrence records it, creates a transaction, draws down the account, and advances the due date', async () => {
    const userId = await setupUser();
    const account = await prisma.account.create({
      data: { userId, name: 'Salary Account', type: 'SAVINGS', balance: 10000 },
    });
    const bill = await billService.createBill(userId, baseBill({ accountId: account.id }));
    const dueDate = isoDaysFromToday(0);

    const occurrence = await billService.payOccurrence(userId, bill.id, {
      dueDate,
      createTransaction: true,
    });
    expect(occurrence.status).toBe('PAID');
    expect(occurrence.amount).toBe(649);

    const txn = await prisma.transaction.findUnique({ where: { id: occurrence.transactionId! } });
    expect(txn).not.toBeNull();
    expect(Number(txn!.amount)).toBe(649);
    expect(txn!.type).toBe('EXPENSE');

    const refreshedAccount = await prisma.account.findUnique({ where: { id: account.id } });
    expect(Number(refreshedAccount!.balance)).toBe(10000 - 649);

    const [refreshed] = await billService.getBills(userId);
    expect(refreshed.nextDueDate).not.toBeNull();
    expect(toDateKey(refreshed.nextDueDate!)).not.toBe(dueDate); // advanced to next cycle

    // Double payment of the same occurrence must be rejected.
    await expect(
      billService.payOccurrence(userId, bill.id, { dueDate, createTransaction: false })
    ).rejects.toMatchObject({ status: 409 });
  });

  it('rejects paying a date that is not on the schedule', async () => {
    const userId = await setupUser();
    const bill = await billService.createBill(userId, baseBill());
    await expect(
      billService.payOccurrence(userId, bill.id, { dueDate: isoDaysFromToday(3), createTransaction: false })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('skipping an occurrence advances the due date without losing history, and undo restores it', async () => {
    const userId = await setupUser();
    const bill = await billService.createBill(userId, baseBill());
    const dueDate = isoDaysFromToday(0);

    await billService.skipOccurrence(userId, bill.id, { dueDate, notes: 'Paused gym month' });

    const detail = await billService.getBill(userId, bill.id);
    expect(detail.history).toHaveLength(1);
    expect(detail.history[0].status).toBe('SKIPPED');
    expect(toDateKey(detail.nextDueDate!)).not.toBe(dueDate);

    await billService.undoOccurrence(userId, bill.id, dueDate);
    const restored = await billService.getBill(userId, bill.id);
    expect(restored.history).toHaveLength(0);
    expect(toDateKey(restored.nextDueDate!)).toBe(dueDate);
  });

  it('undoing a payment deletes the auto-created transaction and restores the balance', async () => {
    const userId = await setupUser();
    const account = await prisma.account.create({
      data: { userId, name: 'Checking', type: 'CHECKING', balance: 5000 },
    });
    const bill = await billService.createBill(userId, baseBill({ accountId: account.id }));
    const dueDate = isoDaysFromToday(0);

    const occ = await billService.payOccurrence(userId, bill.id, { dueDate, createTransaction: true });
    await billService.undoOccurrence(userId, bill.id, dueDate);

    expect(await prisma.transaction.findUnique({ where: { id: occ.transactionId! } })).toBeNull();
    const refreshed = await prisma.account.findUnique({ where: { id: account.id } });
    expect(Number(refreshed!.balance)).toBe(5000);
  });

  it('summarizes mixed frequencies into monthly commitment and month buckets', async () => {
    const userId = await setupUser();
    await billService.createBill(userId, baseBill({ name: 'Rent', category: 'Housing', amount: 20000 }));
    await billService.createBill(
      userId,
      baseBill({ name: 'Term Insurance', category: 'Insurance', amount: 12000, frequency: 'YEARLY' })
    );

    const summary = await billService.getBillsSummary(userId);
    expect(summary.monthlyCommitment).toBeCloseTo(20000 + 1000, 5);
    expect(summary.annualCommitment).toBeCloseTo(21000 * 12, 5);
    expect(summary.activeCount).toBe(2);
    // Both first occurrences land today, i.e. inside the current month.
    expect(summary.thisMonth.total).toBeCloseTo(32000, 5);
    expect(summary.thisMonth.remaining).toBeCloseTo(32000, 5);
  });

  it('pause suspends projections and resume restores them', async () => {
    const userId = await setupUser();
    const bill = await billService.createBill(userId, baseBill());

    const paused = await billService.pauseBill(userId, bill.id, {});
    expect(paused.effectiveStatus).toBe('PAUSED');
    expect(paused.nextDueDate).toBeNull();

    const summary = await billService.getBillsSummary(userId);
    expect(summary.monthlyCommitment).toBe(0);
    expect(summary.pausedCount).toBe(1);

    const resumed = await billService.resumeBill(userId, bill.id);
    expect(resumed.effectiveStatus).toBe('ACTIVE');
    expect(resumed.nextDueDate).not.toBeNull();
  });

  it('bulk archive hides bills from the default list but keeps them retrievable', async () => {
    const userId = await setupUser();
    const a = await billService.createBill(userId, baseBill({ name: 'A' }));
    const b = await billService.createBill(userId, baseBill({ name: 'B' }));

    await billService.bulkAction(userId, { ids: [a.id, b.id], action: 'archive' });
    expect(await billService.getBills(userId)).toHaveLength(0);
    expect(await billService.getBills(userId, { status: 'ARCHIVED' })).toHaveLength(2);

    await billService.bulkAction(userId, { ids: [a.id], action: 'restore' });
    expect(await billService.getBills(userId)).toHaveLength(1);
  });

  it('duplicate copies the definition but not the payment history', async () => {
    const userId = await setupUser();
    const bill = await billService.createBill(userId, baseBill());
    await billService.payOccurrence(userId, bill.id, { dueDate: isoDaysFromToday(0), createTransaction: false });

    const copy = await billService.duplicateBill(userId, bill.id);
    expect(copy.name).toBe('Netflix (Copy)');
    const detail = await billService.getBill(userId, copy.id);
    expect(detail.history).toHaveLength(0);
  });

  it('calendar reflects paid/skipped/upcoming statuses', async () => {
    const userId = await setupUser();
    const bill = await billService.createBill(userId, baseBill());
    await billService.payOccurrence(userId, bill.id, { dueDate: isoDaysFromToday(0), createTransaction: false });

    const monthAhead = new Date();
    const calendar = await billService.getBillsCalendar(
      userId,
      isoDaysFromToday(0),
      toDateKey(new Date(monthAhead.getFullYear(), monthAhead.getMonth() + 1, monthAhead.getDate()))
    );
    expect(calendar.length).toBeGreaterThanOrEqual(2);
    expect(calendar[0].status).toBe('PAID');
    expect(calendar.some((o) => o.status === 'UPCOMING')).toBe(true);
  });

  it('does not let one user touch another user\'s bill', async () => {
    const owner = await setupUser();
    const intruder = await setupUser();
    const bill = await billService.createBill(owner, baseBill());

    await expect(billService.getBill(intruder, bill.id)).rejects.toMatchObject({ status: 404 });
    await expect(billService.deleteBill(intruder, bill.id)).rejects.toMatchObject({ status: 404 });
    await expect(
      billService.bulkAction(intruder, { ids: [bill.id], action: 'delete' })
    ).rejects.toMatchObject({ status: 404 });
  });
});
