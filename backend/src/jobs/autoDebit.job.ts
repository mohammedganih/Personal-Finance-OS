import cron from 'node-cron';
import { autoConfirmAll } from '../schedule/autoConfirm';

async function run(trigger: string) {
  try {
    const results = await autoConfirmAll();
    const confirmed = results.reduce((n, r) => n + r.confirmed.length, 0);
    const failed = results.reduce((n, r) => n + r.failed.length, 0);
    if (confirmed || failed) console.log(`[auto-debit] ${trigger}: confirmed ${confirmed}, failed ${failed}`);
    for (const r of results) for (const f of r.failed) console.warn(`[auto-debit] could not confirm ${f.itemType} "${f.name}" (${f.dueDate}): ${f.reason}`);
  } catch (error) {
    console.error('[auto-debit] run failed:', error);
  }
}

/**
 * Confirms auto-debited EMIs, instalments and bills on their due date: every
 * day at 06:00 India time, and once shortly after the server starts (a laptop
 * backend is rarely running at 06:00). Off in tests, or with AUTO_DEBIT_JOB=off.
 */
export function startAutoDebitJob() {
  if (process.env.NODE_ENV === 'test' || process.env.AUTO_DEBIT_JOB === 'off') return;
  cron.schedule('0 6 * * *', () => { void run('daily'); }, { timezone: 'Asia/Kolkata' });
  setTimeout(() => { void run('startup'); }, 15_000).unref();
}
