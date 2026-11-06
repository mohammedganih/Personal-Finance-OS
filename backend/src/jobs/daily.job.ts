import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { autoConfirm } from '../schedule/autoConfirm';
import { closePreviousMonthIfOpen } from '../services/monthClose.service';

/**
 * The daily round for every household:
 * - auto-debit: confirms this month's auto-debited items due by today;
 * - month close: freezes last month's sheet if it isn't yet (so on the 1st,
 *   the month just ended is closed).
 */
export async function runDaily(trigger: string, now = new Date()) {
  const users = await prisma.user.findMany({ select: { id: true } });
  let confirmed = 0, failed = 0, closed = 0;
  for (const { id } of users) {
    try {
      const auto = await autoConfirm(id, now);
      confirmed += auto.confirmed.length;
      failed += auto.failed.length;
      for (const f of auto.failed) console.warn(`[daily] could not confirm ${f.itemType} "${f.name}" (${f.dueDate}): ${f.reason}`);
      if (await closePreviousMonthIfOpen(id, now)) closed++;
    } catch (error) {
      console.error(`[daily] ${trigger} failed for a household:`, error);
    }
  }
  if (confirmed || failed || closed) console.log(`[daily] ${trigger}: auto-confirmed ${confirmed}, failed ${failed}, months closed ${closed}`);
}

/**
 * Every day at 06:00 India time, and once shortly after the server starts
 * (a laptop backend is rarely running at 06:00). Off in tests, or with
 * AUTO_DEBIT_JOB=off.
 */
export function startDailyJobs() {
  if (process.env.NODE_ENV === 'test' || process.env.AUTO_DEBIT_JOB === 'off') return;
  cron.schedule('0 6 * * *', () => { void runDaily('daily'); }, { timezone: 'Asia/Kolkata' });
  setTimeout(() => { void runDaily('startup'); }, 15_000).unref();
}
