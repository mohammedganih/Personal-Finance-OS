/**
 * Closes every past month that has no month close yet, for every household,
 * from its first record up to last month. Those closes are marked approximate:
 * they are worked out from today's data rolled back through the ledger.
 *
 *   npm run close:backfill --workspace=backend     (uses backend/.env)
 */
import 'dotenv/config';
import '../lib/timezone';
import { prisma } from '../lib/prisma';
import { backfillMonthCloses } from '../services/monthClose.service';

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, familyMembers: { select: { name: true } } } });
  for (const u of users) {
    const closed = await backfillMonthCloses(u.id);
    console.log(`household [${u.familyMembers.map((m) => m.name).join(', ') || 'no members'}]: closed ${closed.length ? closed.join(', ') : 'nothing new'}`);
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
