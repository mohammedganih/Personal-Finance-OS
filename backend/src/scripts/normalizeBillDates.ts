/**
 * One-off, idempotent clean-up: store every bill date the same way the app
 * writes it today (lib/billSchedule parseDateOnly): midnight India time, which
 * is 18:30 UTC on the previous day. Older rows were saved as midnight UTC.
 * Both read as the same calendar day in India time, so no due date moves.
 *
 *   npm run fix:bill-dates --workspace=backend            # preview only
 *   npm run fix:bill-dates --workspace=backend -- --apply # write changes
 *
 * Prints every value it would change and, with --apply, saves them to
 * bill-dates-backup-<timestamp>.json first so they can be restored.
 */
import '../lib/timezone';
import 'dotenv/config';
import fs from 'fs';
import { prisma } from '../lib/prisma';

const IST_OFFSET_MS = 330 * 60 * 1000;
const isUtcMidnight = (d: Date | null): d is Date => !!d && d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
const toIstMidnight = (d: Date) => new Date(d.getTime() - IST_OFFSET_MS);

async function main() {
  const apply = process.argv.includes('--apply');
  const bills = await prisma.recurringBill.findMany({ select: { id: true, name: true, startDate: true, endDate: true, pausedUntil: true } });
  const billChanges = bills.flatMap(b => (['startDate', 'endDate', 'pausedUntil'] as const)
    .filter(f => isUtcMidnight(b[f]))
    .map(f => ({ table: 'recurring_bills', id: b.id, name: b.name, field: f, before: b[f]!.toISOString(), after: toIstMidnight(b[f]!).toISOString() })));

  const occurrences = await prisma.billOccurrence.findMany({ select: { id: true, billId: true, dueDate: true } });
  const taken = new Set(occurrences.map(o => `${o.billId}:${o.dueDate.toISOString()}`));
  const skipped: string[] = [];
  const occChanges = occurrences.filter(o => isUtcMidnight(o.dueDate)).flatMap(o => {
    const after = toIstMidnight(o.dueDate).toISOString();
    if (taken.has(`${o.billId}:${after}`)) { skipped.push(`${o.id} (bill ${o.billId}): a record for that day already exists`); return []; }
    return [{ table: 'bill_occurrences', id: o.id, name: o.billId, field: 'dueDate' as const, before: o.dueDate.toISOString(), after }];
  });

  const changes = [...billChanges, ...occChanges];
  console.log(`${changes.length} date(s) to normalise${apply ? '' : ' (preview, run with --apply to write)'}:`);
  console.table(changes.map(c => ({ table: c.table, name: c.name, field: c.field, before: c.before, after: c.after })));
  if (skipped.length) console.log('Left as is:\n  ' + skipped.join('\n  '));
  if (!apply || !changes.length) return;

  const backup = `bill-dates-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(backup, JSON.stringify(changes, null, 2));
  console.log(`Saved old values to ${backup}`);
  await prisma.$transaction(changes.map(c => c.table === 'recurring_bills'
    ? prisma.recurringBill.update({ where: { id: c.id }, data: { [c.field]: new Date(c.after) } })
    : prisma.billOccurrence.update({ where: { id: c.id }, data: { dueDate: new Date(c.after) } })));
  console.log(`Updated ${changes.length} date(s).`);
}

main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
