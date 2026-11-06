import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { resetDatabase, prisma } from '../test/db';
import { createOldTables, dropOldTables, insertBillOccurrences, insertMonthlyPayments } from '../test/oldTables';

// Runs the data-copy part of the 20261106030000_due_status migration against
// seeded old-table rows, the same way it ran on the dev DB.
const migration = fs.readFileSync(path.resolve(__dirname, '../../prisma/migrations/20261106030000_due_status/migration.sql'), 'utf8');
const copy = migration.slice(migration.indexOf('-- ─── Copy every'))
  .split(/;\s*\n/).map((s) => s.replace(/^\s*--.*$/gm, '').trim()).filter(Boolean);

beforeAll(() => createOldTables());
beforeEach(() => resetDatabase());
afterAll(async () => { await dropOldTables(); await prisma.$disconnect(); });

describe('due_status migration copy', () => {
  it('copies month-plan records and bill occurrences, keeping two bill dates in one month apart', async () => {
    const user = await prisma.user.create({ data: { name: 'F', email: 'due-copy@example.com', passwordHash: 'x' } });
    const bank = await prisma.account.create({ data: { userId: user.id, name: 'Bank', type: 'SAVINGS', balance: 0 } });
    const txn = await prisma.transaction.create({ data: { userId: user.id, type: 'EXPENSE', amount: 500, date: new Date('2026-10-05T06:00:00Z'), accountId: bank.id } });
    const bill = await prisma.recurringBill.create({ data: { userId: user.id, name: 'Maid', amount: 500, startDate: new Date('2026-10-01'), frequency: 'WEEKLY', category: 'Home' } });
    await insertMonthlyPayments([
      { userId: user.id, entityType: 'LOAN', entityId: 'loan1', month: '2026-10', status: 'PAID', amount: 10000, transactionIds: [txn.id] },
      { userId: user.id, entityType: 'CREDIT_CARD', entityId: 'card1', month: '2026-11', status: 'SKIPPED', amount: 0 },
    ]);
    // India-midnight due dates, as the app stores them (18:30 UTC the day before).
    await insertBillOccurrences([
      { userId: user.id, billId: bill.id, dueDate: new Date('2026-10-04T18:30:00Z'), status: 'PAID', amount: 500, transactionId: txn.id, paidDate: new Date('2026-10-05T06:00:00Z') },
      { userId: user.id, billId: bill.id, dueDate: new Date('2026-10-11T18:30:00Z'), status: 'SKIPPED' },
    ]);

    for (const sql of copy) await prisma.$executeRawUnsafe(sql);

    const rows = await prisma.dueStatus.findMany({ orderBy: [{ itemType: 'asc' }, { dueKey: 'asc' }] });
    expect(rows.map((r) => [r.itemType, r.itemId, r.period, r.dueKey, r.status, r.accountId, r.transactionIds])).toEqual([
      ['BILL', bill.id, '2026-10', '2026-10-05', 'PAID', bank.id, [txn.id]],
      ['BILL', bill.id, '2026-10', '2026-10-12', 'SKIPPED', null, []],
      ['CARD_STATEMENT', 'card1', '2026-11', '', 'SKIPPED', null, []],
      ['LOAN', 'loan1', '2026-10', '', 'PAID', bank.id, [txn.id]],
    ]);
    expect(rows.find((r) => r.itemType === 'LOAN')!.paidDate!.toISOString()).toBe('2026-10-05T06:00:00.000Z');
  });
});
